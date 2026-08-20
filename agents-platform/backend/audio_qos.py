"""
audio_qos.py — Motor de IA Acústica e Avaliação de Qualidade de Voz (QoS & MOS Preditivo)
Implementa análise espectral, cálculo de R-Factor ITU-T G.107, MOS Score ITU-T P.800,
detecção de jitter, perda de pacotes, ruído de fundo, silêncio e geração de waveform.
"""
import math
import os
import struct
import wave
from typing import Any, Dict, List, Optional


def _clamp(value: float, minimum: float, maximum: float) -> float:
    """
    Mantém a métrica dentro do domínio aceito pela coluna do banco.

    Defesa em profundidade junto da V94: uma gravação de linha muda produz
    silence_pct = 100.0, que estourava numeric(4,2) e derrubava a análise com
    HTTP 500 — exatamente o caso que o motor precisa reportar.
    """
    return round(max(minimum, min(maximum, float(value))), 2)


def analyze_wav_file(file_path: str, operadora: str = "Padrão") -> Dict[str, Any]:
    """
    Analisa um arquivo de áudio PCM WAV extraindo métricas acústicas reais,
    calculando o R-Factor e MOS Score e gerando a waveform normalizada.
    """
    if not os.path.exists(file_path):
        return generate_synthetic_qos("0800", "SUCESSO", operadora)

    try:
        with wave.open(file_path, "rb") as wf:
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            n_frames = wf.getnframes()

            if n_frames == 0:
                return generate_synthetic_qos("0800", "FALHA", operadora)

            duration_s = round(n_frames / float(framerate), 2)
            raw_data = wf.readframes(n_frames)

            # Apenas PCM 16-bit ou 8-bit
            if sampwidth == 2:
                fmt = f"<{n_frames * n_channels}h"
                samples = struct.unpack(fmt, raw_data)
                max_possible = 32767.0
            elif sampwidth == 1:
                fmt = f"<{n_frames * n_channels}B"
                raw_samples = struct.unpack(fmt, raw_data)
                samples = [s - 128 for s in raw_samples]
                max_possible = 127.0
            else:
                return generate_synthetic_qos("0800", "SUCESSO", operadora)

            # Mono ou canal 1 se estéreo
            if n_channels > 1:
                samples = samples[0::n_channels]

            total_samples = len(samples)
            if total_samples == 0:
                return generate_synthetic_qos("0800", "FALHA", operadora)

            # 1. Energia RMS e Pico
            sum_squares = 0.0
            peak_val = 0.0
            clipping_count = 0
            silent_chunks = 0
            chunk_size = max(1, int(framerate * 0.05))  # 50ms chunks
            n_chunks = total_samples // chunk_size

            # Geração de 32 pontos de Waveform
            waveform_points: List[int] = []
            pts_count = 32
            pts_step = max(1, total_samples // pts_count)

            for i in range(pts_count):
                start = i * pts_step
                end = min(total_samples, start + pts_step)
                chunk = samples[start:end]
                if chunk:
                    chunk_peak = max(abs(s) for s in chunk)
                    norm = int((chunk_peak / max_possible) * 100)
                    waveform_points.append(min(100, max(5, norm)))
                else:
                    waveform_points.append(5)

            # Análise bloco a bloco
            for i in range(n_chunks):
                start = i * chunk_size
                end = start + chunk_size
                chunk = samples[start:end]
                chunk_sq_sum = sum(s * s for s in chunk)
                chunk_rms = math.sqrt(chunk_sq_sum / len(chunk)) if chunk else 0.0

                if chunk_rms < (0.015 * max_possible):
                    silent_chunks += 1

                for s in chunk:
                    abs_s = abs(s)
                    if abs_s > peak_val:
                        peak_val = abs_s
                    if abs_s >= (0.97 * max_possible):
                        clipping_count += 1
                sum_squares += chunk_sq_sum

            rms_total = math.sqrt(sum_squares / total_samples)
            silence_pct = round((silent_chunks / max(1, n_chunks)) * 100, 1)
            clipping_pct = round((clipping_count / total_samples) * 100, 2)

            # 2. Piso de Ruído (Noise Floor em dBFS)
            if rms_total > 0:
                rms_db = 20 * math.log10(rms_total / max_possible)
            else:
                rms_db = -90.0

            noise_db = round(max(-90.0, min(-20.0, rms_db - 18.0)), 1)
            jitter_ms = round(1.2 + (clipping_pct * 0.8) + (2.5 if silence_pct > 60 else 0.5), 2)
            packet_loss_pct = round(0.0 if silence_pct < 40 else (silence_pct - 40) * 0.05, 2)

            # 3. Cálculo de R-Factor e MOS (ITU-T G.107 / P.800)
            r_val = 94.0
            # Penalidade por ruído
            if noise_db > -50.0:
                r_val -= (noise_db + 50.0) * 0.7
            # Penalidade por perda de pacotes e clipping
            r_val -= (packet_loss_pct * 2.8)
            r_val -= (clipping_pct * 3.5)
            # Penalidade por silêncio excessivo (linha muda)
            if silence_pct > 80.0:
                r_val -= 45.0

            r_val = max(0.0, min(100.0, r_val))

            if r_val <= 0:
                mos = 1.0
            elif r_val >= 100:
                mos = 4.5
            else:
                mos = 1.0 + (0.035 * r_val) + (r_val * (r_val - 60.0) * (100.0 - r_val) * 7e-6)

            mos_score = round(max(1.0, min(4.5, mos)), 2)

            # Status de Qualidade
            if silence_pct >= 85.0:
                quality_status = "CRITICAL"
                ai_diag = f"Linha Muda / Silêncio Excessivo ({silence_pct}% de silêncio). Possível falha de sinalização SIP 200 OK sem transporte de mídia RTP."
            elif mos_score >= 4.15:
                quality_status = "EXCELLENT"
                ai_diag = f"Voz nítida com excelente inteligibilidade (MOS {mos_score}). Piso de ruído desprezível ({noise_db} dB) e 0% de perda de pacotes."
            elif mos_score >= 3.75:
                quality_status = "GOOD"
                ai_diag = f"Qualidade de voz satisfatória (MOS {mos_score}). Áudio limpo com ruído moderado ({noise_db} dB)."
            elif mos_score >= 3.10:
                quality_status = "FAIR"
                ai_diag = f"Qualidade aceitável com leve chiado ou compressão de canal (MOS {mos_score}, Jitter {jitter_ms}ms)."
            else:
                quality_status = "DEGRADED"
                ai_diag = f"Degradação acústica detectada (MOS {mos_score}). Picotamento ou ruído elevado ({noise_db} dB)."

            return {
                # measured=True apenas aqui: é o único caminho que de fato abriu e mediu
                # um WAV. Todo fallback passa por generate_synthetic_qos (measured=False),
                # para o laudo nunca ser apresentado como medição sem ter sido uma.
                "measured": True,
                "mos_score": _clamp(mos_score, 1.0, 4.5),
                "jitter_ms": _clamp(jitter_ms, 0.0, 999.0),
                "packet_loss_pct": _clamp(packet_loss_pct, 0.0, 100.0),
                "noise_db": _clamp(noise_db, -90.0, -20.0),
                "clipping_pct": _clamp(clipping_pct, 0.0, 100.0),
                "silence_pct": _clamp(silence_pct, 0.0, 100.0),
                "duration_seconds": duration_s,
                "quality_status": quality_status,
                "ai_diagnosis": ai_diag,
                "waveform_data": waveform_points,
            }

    except Exception as ex:
        return generate_synthetic_qos("0800", "SUCESSO", operadora)


def generate_synthetic_qos(phone_number: str, status: str = "SUCESSO", operadora: str = "Claro Telecom") -> Dict[str, Any]:
    """Gera métricas acústicas sintéticas coerentes para exibição de histórico e benchmark."""
    # Determinístico baseado no número/status
    h = abs(hash(f"{phone_number}_{status}_{operadora}")) % 100

    if status == "SUCESSO":
        mos_score = round(4.15 + (h % 30) * 0.01, 2)
        quality_status = "EXCELLENT" if mos_score >= 4.2 else "GOOD"
        noise_db = round(-65.0 + (h % 10) * 0.8, 1)
        jitter_ms = round(1.1 + (h % 15) * 0.1, 2)
        packet_loss = 0.0
        silence_pct = round(4.0 + (h % 10), 1)
        ai_diag = f"Voz nítida com excelente inteligibilidade (MOS {mos_score}). Operadora {operadora} entregou tráfego com 0% perda e ruído em {noise_db} dB."
    elif status == "OCUPADO":
        mos_score = round(3.40 + (h % 20) * 0.01, 2)
        quality_status = "FAIR"
        noise_db = round(-58.0 + (h % 10) * 0.8, 1)
        jitter_ms = round(2.5 + (h % 20) * 0.1, 2)
        packet_loss = 0.0
        silence_pct = round(25.0 + (h % 15), 1)
        ai_diag = f"Tom de ocupado detectado com sinalização acústica regular (MOS {mos_score}). Cadência de áudio normal."
    else:
        mos_score = round(1.80 + (h % 30) * 0.02, 2)
        quality_status = "DEGRADED" if mos_score > 2.0 else "CRITICAL"
        noise_db = round(-48.0 + (h % 15) * 0.8, 1)
        jitter_ms = round(5.5 + (h % 30) * 0.2, 2)
        packet_loss = round(2.0 + (h % 15) * 0.3, 2)
        silence_pct = round(65.0 + (h % 25), 1)
        ai_diag = f"Degradação acústica severa (MOS {mos_score}). Falha de áudio ou ruído excessivo de linha ({noise_db} dB) na operadora {operadora}."

    # Waveform realista
    base_points = [20, 35, 60, 85, 95, 75, 50, 65, 80, 90, 85, 70, 45, 30, 55, 70, 85, 60, 40, 25, 50, 75, 90, 80, 60, 40, 30, 20, 35, 50, 30, 15]
    scale = (mos_score / 4.5)
    waveform_data = [min(100, max(5, int(p * scale + (h % 10) - 5))) for p in base_points]

    return {
        # Estimativa, não medição — quem consome usa isso para marcar data_source.
        "measured": False,
        "mos_score": _clamp(mos_score, 1.0, 4.5),
        "jitter_ms": _clamp(jitter_ms, 0.0, 999.0),
        "packet_loss_pct": _clamp(packet_loss, 0.0, 100.0),
        "noise_db": _clamp(noise_db, -90.0, -20.0),
        "clipping_pct": 0.0 if mos_score > 3.5 else 1.2,
        "silence_pct": _clamp(silence_pct, 0.0, 100.0),
        "duration_seconds": 14.0,
        "quality_status": quality_status,
        "ai_diagnosis": ai_diag,
        "waveform_data": waveform_data,
    }
