"""ai_service.py — Orquestra STT → LLM → TTS para o fluxo de alerta Zabbix.

Camada fina sobre `GeminiService`: monta o texto do incidente a narrar e
decide, a partir do áudio de resposta do atendente, qual status final
gravar. Nenhum método aqui deixa uma exceção do provedor de IA escapar —
qualquer falha vira log + um resultado neutro (nunca trava a ligação).
"""

from __future__ import annotations

import logging

from services.gemini_service import GeminiError, GeminiService

logger = logging.getLogger("ai-agent.ai_service")

_SEVERITY_LABELS = {
    "1": "informativa",
    "2": "atenção",
    "3": "média",
    "4": "alta",
    "5": "desastre",
}


class AiService:
    def __init__(self, gemini: GeminiService) -> None:
        self._gemini = gemini

    def build_incident_narration(self, alert: dict) -> str:
        """Monta o texto falado a partir dos dados do incidente (backend)."""
        host = alert.get("zabbixHost") or "host desconhecido"
        summary = alert.get("zabbixIncidentSummary") or "incidente sem descrição"
        severity_raw = str(alert.get("zabbixSeverity") or "").strip()
        severity = _SEVERITY_LABELS.get(severity_raw, severity_raw or "não informada")
        return (
            "Atenção. Alerta crítico do Zabbix. "
            f"Host afetado: {host}. "
            f"Severidade: {severity}. "
            f"Resumo do incidente: {summary}. "
            "Se você está ciente e vai tratar este incidente, diga: reconhecido. "
            "Caso contrário, diga: não posso atender agora."
        )

    async def narrate(self, text: str) -> bytes | None:
        """Sintetiza o texto em áudio slin8. None em falha (chamador decide o fallback)."""
        try:
            return await self._gemini.synthesize_speech(text)
        except GeminiError:
            return None

    async def interpret_operator_response(self, pcm_slin8: bytes) -> str:
        """Transcreve + classifica a resposta do atendente.

        Retorna sempre um dos três rótulos ("RECONHECIDO"/"NAO_RECONHECIDO"/
        "SILENCIO") — nunca propaga exceção, mesmo se o STT falhar (nesse
        caso considera SILENCIO, o rótulo mais conservador).
        """
        try:
            transcript = await self._gemini.transcribe(pcm_slin8)
        except GeminiError:
            logger.warning("STT indisponível — tratando resposta do atendente como silêncio.")
            return "SILENCIO"
        return await self._gemini.classify_response(transcript)
