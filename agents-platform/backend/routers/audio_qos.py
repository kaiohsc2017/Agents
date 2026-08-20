"""
routers/audio_qos.py — Endpoints para Audio QoS & MOS Preditivo (IA Acústica)
Consulta de métricas acústicas, MOS Score por operadora e análise em tempo real.

Origem do dado (`data_source`, V93):
  * "real"      — MOS/jitter/ruído medidos de um WAV gravado pelo MixMonitor durante o
                  teste de conectividade (contexto `asteriskia-test` do dialplan, caminho
                  registrado em `test_results.recording_path`).
  * "synthetic" — estimativa determinística (`generate_synthetic_qos`), usada quando não
                  existe gravação para o teste. Nunca é apresentada como medição.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from audio_qos import analyze_wav_file, generate_synthetic_qos
from database import DB
from auth import require_permission

router = APIRouter()

# Métricas de QoS acústico exigem PERM_READ/WRITE_telecom.qos (ou ADMIN legado) —
# resource_key já existente no catálogo Java (ResourceCatalog.java).
_READ  = [Depends(require_permission("telecom.qos", "read"))]
_WRITE = [Depends(require_permission("telecom.qos", "write"))]

# Diretório das gravações do Asterisk (volume agentia_asterisk_recordings, montado :ro).
# Qualquer caminho fora daqui é recusado antes de abrir o arquivo — o motor acústico lê o
# disco diretamente, então aceitar caminho livre seria leitura arbitrária de arquivo.
RECORDINGS_BASE = Path(os.getenv("QOS_RECORDINGS_DIR", "/var/spool/asterisk/monitor")).resolve()

SOURCE_REAL = "real"
SOURCE_SYNTHETIC = "synthetic"


class AudioQosAnalyzeRequest(BaseModel):
    phone_number: str = Field(..., max_length=30)
    operadora_name: str = Field(default="Padrão", max_length=100)
    test_result_id: Optional[int] = None
    status: Optional[str] = "SUCESSO"


def _safe_recording_path(raw_path: Optional[str]) -> Optional[str]:
    """
    Valida um caminho de gravação vindo do banco: precisa ser um .wav existente dentro de
    RECORDINGS_BASE. Devolve o caminho resolvido ou None (nesse caso a análise é sintética).
    """
    if not raw_path:
        return None
    try:
        candidate = Path(raw_path).resolve()
    except (OSError, ValueError):
        return None
    if candidate.suffix.lower() != ".wav":
        return None
    if not candidate.is_relative_to(RECORDINGS_BASE):
        return None
    if not candidate.is_file():
        return None
    return str(candidate)


async def _recording_for_test(conn, test_result_id: Optional[int]) -> Optional[str]:
    """Caminho validado da gravação de um teste de conectividade, se houver."""
    if not test_result_id:
        return None
    raw = await conn.fetchval(
        "SELECT recording_path FROM test_results WHERE id = $1", test_result_id
    )
    return _safe_recording_path(raw)


async def _latest_recording_for_phone(conn, phone_number: str) -> Optional[str]:
    """
    Gravação mais recente disponível para um número testado — usada pelo nó de fluxo de
    Audio QoS, que conhece o telefone mas não um test_result específico.
    """
    if not phone_number:
        return None
    raw = await conn.fetchval(
        """
        SELECT tr.recording_path
        FROM test_results tr
        JOIN number_tests nt ON tr.number_test_id = nt.id
        WHERE nt.phone_number = $1 AND tr.recording_path IS NOT NULL
        ORDER BY tr.executed_at DESC
        LIMIT 1
        """,
        phone_number,
    )
    return _safe_recording_path(raw)


def _measure(recording_path: Optional[str], phone_number: str, call_status: str, operadora: str):
    """
    Executa a medição acústica real quando existe gravação; caso contrário devolve a
    estimativa sintética. Retorna (métricas, data_source).
    """
    if recording_path:
        metrics = analyze_wav_file(recording_path, operadora)
        # analyze_wav_file cai no sintético sozinho se o WAV estiver ilegível/vazio ou em
        # formato não suportado (ex.: G.729 sem transcodificação) — nesse caso o laudo NÃO
        # pode ser rotulado como medição.
        source = SOURCE_REAL if metrics.pop("measured", False) else SOURCE_SYNTHETIC
        return metrics, source
    metrics = generate_synthetic_qos(phone_number, call_status, operadora)
    metrics.pop("measured", None)
    return metrics, SOURCE_SYNTHETIC


def _waveform(value: Any) -> List[int]:
    return value if isinstance(value, list) else json.loads(value or "[]")


@router.get("/summary", dependencies=_READ)
async def get_qos_summary():
    """Retorna o resumo executivo de qualidade acústica e ranking de MOS por operadora."""
    async with DB() as conn:
        # 1. Estatísticas Gerais
        stats = await conn.fetchrow(
            """
            SELECT
                COUNT(*) as total_evaluated,
                COALESCE(ROUND(AVG(mos_score)::numeric, 2), 4.25) as avg_mos,
                COALESCE(ROUND(AVG(jitter_ms)::numeric, 2), 1.85) as avg_jitter,
                COALESCE(ROUND(AVG(noise_db)::numeric, 1), -62.0) as avg_noise,
                COUNT(*) FILTER (WHERE quality_status IN ('EXCELLENT', 'GOOD')) as good_count,
                COUNT(*) FILTER (WHERE quality_status IN ('DEGRADED', 'CRITICAL')) as degraded_count,
                COUNT(*) FILTER (WHERE data_source = 'real') as real_count
            FROM audio_qos_metrics
            """
        )

        # 2. Ranking de MOS por Operadora (para gráficos no Dashboard)
        operadoras_rows = await conn.fetch(
            """
            SELECT
                COALESCE(operadora_name, 'Padrão') as operadora,
                ROUND(AVG(mos_score)::numeric, 2) as avg_mos,
                ROUND(AVG(jitter_ms)::numeric, 2) as avg_jitter,
                ROUND(AVG(noise_db)::numeric, 1) as avg_noise,
                COUNT(*) as tests_count,
                COUNT(*) FILTER (WHERE data_source = 'real') as real_count
            FROM audio_qos_metrics
            GROUP BY operadora_name
            ORDER BY avg_mos DESC
            """
        )

        # 3. Últimas avaliações
        recent_rows = await conn.fetch(
            """
            SELECT id, test_result_id, phone_number, operadora_name, mos_score, jitter_ms,
                   noise_db, packet_loss_pct, quality_status, ai_diagnosis, waveform_data,
                   data_source, created_at
            FROM audio_qos_metrics
            ORDER BY created_at DESC
            LIMIT 15
            """
        )

        total = stats["total_evaluated"] or 0
        good = stats["good_count"] or 0
        sla_pass_pct = round((good / total) * 100, 1) if total > 0 else 100.0

        return {
            "total_evaluated": total,
            "real_measured": stats["real_count"] or 0,
            "avg_mos": float(stats["avg_mos"]),
            "avg_jitter_ms": float(stats["avg_jitter"]),
            "avg_noise_db": float(stats["avg_noise"]),
            "sla_pass_pct": sla_pass_pct,
            "degraded_count": stats["degraded_count"] or 0,
            "mos_by_operadora": [
                {
                    "operadora": r["operadora"],
                    "avg_mos": float(r["avg_mos"]),
                    "avg_jitter_ms": float(r["avg_jitter"]),
                    "avg_noise_db": float(r["avg_noise"]),
                    "tests_count": r["tests_count"],
                    "real_measured": r["real_count"] or 0,
                }
                for r in operadoras_rows
            ],
            "recent_metrics": [
                {
                    "id": str(r["id"]),
                    "test_result_id": r["test_result_id"],
                    "phone_number": r["phone_number"],
                    "operadora_name": r["operadora_name"],
                    "mos_score": float(r["mos_score"]),
                    "jitter_ms": float(r["jitter_ms"]),
                    "noise_db": float(r["noise_db"]),
                    "packet_loss_pct": float(r["packet_loss_pct"]),
                    "quality_status": r["quality_status"],
                    "ai_diagnosis": r["ai_diagnosis"],
                    "waveform_data": _waveform(r["waveform_data"]),
                    "data_source": r["data_source"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                }
                for r in recent_rows
            ]
        }


@router.get("/test/{test_result_id}", dependencies=_READ)
async def get_qos_by_test(test_result_id: int):
    """
    Retorna métricas de QoS e waveform para um resultado de teste específico.

    Se a gravação real do teste já existir e o laudo salvo ainda for sintético (métrica
    gerada antes de o MixMonitor terminar de escrever o arquivo), o laudo é remedido a
    partir do WAV e atualizado — uma vez, sem reprocessar em cada consulta.
    """
    async with DB() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, test_result_id, phone_number, operadora_name, recording_path,
                   mos_score, jitter_ms, packet_loss_pct, noise_db, clipping_pct,
                   silence_pct, quality_status, ai_diagnosis, waveform_data, data_source,
                   created_at
            FROM audio_qos_metrics
            WHERE test_result_id = $1
            """,
            test_result_id
        )

        if not row:
            # Busca dados do teste para gerar o laudo
            test_row = await conn.fetchrow(
                """
                SELECT tr.id, nt.phone_number, tr.status, tr.sip_response_code, tr.recording_path
                FROM test_results tr
                LEFT JOIN number_tests nt ON tr.number_test_id = nt.id
                WHERE tr.id = $1
                """,
                test_result_id
            )
            if not test_row:
                raise HTTPException(status_code=404, detail="Resultado de teste não encontrado.")

            phone = test_row["phone_number"] or "08007771234"
            st = test_row["status"] or "SUCESSO"
            operadora = "Claro Telecom"
            recording = _safe_recording_path(test_row["recording_path"])
            metrics, source = _measure(recording, phone, st, operadora)

            # Salva para idempotência
            new_id = await conn.fetchval(
                """
                INSERT INTO audio_qos_metrics (
                    test_result_id, phone_number, operadora_name, recording_path, mos_score,
                    jitter_ms, packet_loss_pct, noise_db, clipping_pct, silence_pct,
                    quality_status, ai_diagnosis, waveform_data, data_source
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id
                """,
                test_result_id, phone, operadora, recording, metrics["mos_score"],
                metrics["jitter_ms"], metrics["packet_loss_pct"], metrics["noise_db"],
                metrics["clipping_pct"], metrics["silence_pct"], metrics["quality_status"],
                metrics["ai_diagnosis"], json.dumps(metrics["waveform_data"]), source
            )

            metrics["id"] = str(new_id)
            metrics["test_result_id"] = test_result_id
            metrics["phone_number"] = phone
            metrics["operadora_name"] = operadora
            metrics["recording_path"] = recording
            metrics["data_source"] = source
            return metrics

        # Laudo sintético que agora tem gravação disponível → remede uma única vez.
        if row["data_source"] != SOURCE_REAL:
            recording = await _recording_for_test(conn, test_result_id)
            operadora = row["operadora_name"] or "Padrão"
            metrics, source = _measure(recording, row["phone_number"] or "", "SUCESSO", operadora)
            # WAV ausente ou ilegível (formato não suportado, arquivo vazio): mantém o
            # laudo sintético já salvo, sem regravar nada.
            if source == SOURCE_REAL:
                await conn.execute(
                    """
                    UPDATE audio_qos_metrics
                       SET recording_path = $2, mos_score = $3, jitter_ms = $4,
                           packet_loss_pct = $5, noise_db = $6, clipping_pct = $7,
                           silence_pct = $8, quality_status = $9, ai_diagnosis = $10,
                           waveform_data = $11, data_source = 'real'
                     WHERE id = $1
                    """,
                    row["id"], recording, metrics["mos_score"], metrics["jitter_ms"],
                    metrics["packet_loss_pct"], metrics["noise_db"], metrics["clipping_pct"],
                    metrics["silence_pct"], metrics["quality_status"], metrics["ai_diagnosis"],
                    json.dumps(metrics["waveform_data"])
                )
                metrics["id"] = str(row["id"])
                metrics["test_result_id"] = test_result_id
                metrics["phone_number"] = row["phone_number"]
                metrics["operadora_name"] = row["operadora_name"]
                metrics["recording_path"] = recording
                metrics["data_source"] = SOURCE_REAL
                metrics["created_at"] = row["created_at"].isoformat() if row["created_at"] else None
                return metrics

        return {
            "id": str(row["id"]),
            "test_result_id": row["test_result_id"],
            "phone_number": row["phone_number"],
            "operadora_name": row["operadora_name"],
            "recording_path": row["recording_path"],
            "mos_score": float(row["mos_score"]),
            "jitter_ms": float(row["jitter_ms"]),
            "packet_loss_pct": float(row["packet_loss_pct"]),
            "noise_db": float(row["noise_db"]),
            "clipping_pct": float(row["clipping_pct"]),
            "silence_pct": float(row["silence_pct"]),
            "quality_status": row["quality_status"],
            "ai_diagnosis": row["ai_diagnosis"],
            "waveform_data": _waveform(row["waveform_data"]),
            "data_source": row["data_source"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }


@router.post("/analyze", status_code=status.HTTP_201_CREATED, dependencies=_WRITE)
async def analyze_audio_endpoint(req: AudioQosAnalyzeRequest):
    """
    Executa a análise acústica e salva o laudo de QoS.

    O caminho do áudio nunca vem do chamador: é resolvido no servidor a partir do
    test_result_id informado (ou da gravação mais recente do número). Sem gravação, o
    laudo é sintético e marcado como tal.
    """
    async with DB() as conn:
        recording = await _recording_for_test(conn, req.test_result_id)
        if not recording:
            recording = await _latest_recording_for_phone(conn, req.phone_number)

        metrics, source = _measure(
            recording, req.phone_number, req.status or "SUCESSO", req.operadora_name
        )

        new_id = await conn.fetchval(
            """
            INSERT INTO audio_qos_metrics (
                test_result_id, phone_number, operadora_name, recording_path,
                mos_score, jitter_ms, packet_loss_pct, noise_db, clipping_pct,
                silence_pct, quality_status, ai_diagnosis, waveform_data, data_source
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id
            """,
            req.test_result_id, req.phone_number, req.operadora_name, recording,
            metrics["mos_score"], metrics["jitter_ms"], metrics["packet_loss_pct"],
            metrics["noise_db"], metrics["clipping_pct"], metrics["silence_pct"],
            metrics["quality_status"], metrics["ai_diagnosis"],
            json.dumps(metrics["waveform_data"]), source
        )

    metrics["id"] = str(new_id)
    metrics["phone_number"] = req.phone_number
    metrics["operadora_name"] = req.operadora_name
    metrics["recording_path"] = recording
    metrics["data_source"] = source
    return metrics
