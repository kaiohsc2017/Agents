"""
routers/audio_qos.py — Endpoints para Audio QoS & MOS Preditivo (IA Acústica)
Consulta de métricas acústicas, MOS Score por operadora e análise em tempo real.
"""
import json
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from audio_qos import analyze_wav_file, generate_synthetic_qos
from database import DB

router = APIRouter()


class AudioQosAnalyzeRequest(BaseModel):
    phone_number: str = Field(..., max_length=30)
    operadora_name: str = Field(default="Padrão", max_length=100)
    recording_path: Optional[str] = None
    test_result_id: Optional[int] = None
    status: Optional[str] = "SUCESSO"


@router.get("/summary")
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
                COUNT(*) FILTER (WHERE quality_status IN ('DEGRADED', 'CRITICAL')) as degraded_count
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
                COUNT(*) as tests_count
            FROM audio_qos_metrics
            GROUP BY operadora_name
            ORDER BY avg_mos DESC
            """
        )

        # 3. Últimas avaliações
        recent_rows = await conn.fetch(
            """
            SELECT id, test_result_id, phone_number, operadora_name, mos_score, jitter_ms,
                   noise_db, packet_loss_pct, quality_status, ai_diagnosis, waveform_data, created_at
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
                    "waveform_data": r["waveform_data"] if isinstance(r["waveform_data"], list) else json.loads(r["waveform_data"] or "[]"),
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                }
                for r in recent_rows
            ]
        }


@router.get("/test/{test_result_id}")
async def get_qos_by_test(test_result_id: int):
    """Retorna métricas de QoS e waveform para um resultado de teste específico."""
    async with DB() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, test_result_id, phone_number, operadora_name, recording_path,
                   mos_score, jitter_ms, packet_loss_pct, noise_db, clipping_pct,
                   silence_pct, quality_status, ai_diagnosis, waveform_data, created_at
            FROM audio_qos_metrics
            WHERE test_result_id = $1
            """,
            test_result_id
        )

        if not row:
            # Busca dados do teste para gerar análise
            test_row = await conn.fetchrow(
                """
                SELECT tr.id, nt.phone_number, tr.status, tr.sip_response_code
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
            synth = generate_synthetic_qos(phone, st, "Claro Telecom")

            # Salva para idempotência
            new_id = await conn.fetchval(
                """
                INSERT INTO audio_qos_metrics (
                    test_result_id, phone_number, operadora_name, mos_score, jitter_ms,
                    packet_loss_pct, noise_db, clipping_pct, silence_pct, quality_status,
                    ai_diagnosis, waveform_data
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
                """,
                test_result_id, phone, "Claro Telecom", synth["mos_score"], synth["jitter_ms"],
                synth["packet_loss_pct"], synth["noise_db"], synth["clipping_pct"],
                synth["silence_pct"], synth["quality_status"], synth["ai_diagnosis"],
                json.dumps(synth["waveform_data"])
            )

            synth["id"] = str(new_id)
            synth["test_result_id"] = test_result_id
            synth["phone_number"] = phone
            synth["operadora_name"] = "Claro Telecom"
            return synth

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
            "waveform_data": row["waveform_data"] if isinstance(row["waveform_data"], list) else json.loads(row["waveform_data"] or "[]"),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }


@router.post("/analyze", status_code=status.HTTP_201_CREATED)
async def analyze_audio_endpoint(req: AudioQosAnalyzeRequest):
    """Executa a análise acústica do áudio gravado e salva o laudo de QoS."""
    if req.recording_path and req.recording_path.endswith(".wav"):
        res = analyze_wav_file(req.recording_path, req.operadora_name)
    else:
        res = generate_synthetic_qos(req.phone_number, req.status or "SUCESSO", req.operadora_name)

    async with DB() as conn:
        new_id = await conn.fetchval(
            """
            INSERT INTO audio_qos_metrics (
                test_result_id, phone_number, operadora_name, recording_path,
                mos_score, jitter_ms, packet_loss_pct, noise_db, clipping_pct,
                silence_pct, quality_status, ai_diagnosis, waveform_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
            """,
            req.test_result_id, req.phone_number, req.operadora_name, req.recording_path,
            res["mos_score"], res["jitter_ms"], res["packet_loss_pct"], res["noise_db"],
            res["clipping_pct"], res["silence_pct"], res["quality_status"], res["ai_diagnosis"],
            json.dumps(res["waveform_data"])
        )

    res["id"] = str(new_id)
    res["phone_number"] = req.phone_number
    res["operadora_name"] = req.operadora_name
    return res
