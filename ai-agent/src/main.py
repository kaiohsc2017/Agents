"""main.py — Servidor AudioSocket asyncio do ai-agent (Módulo 3: Alerta Zabbix).

Ponto de entrada do serviço: aceita conexões TCP do Asterisk na porta
AUDIOSOCKET_PORT (padrão 9092, sem porta publicada ao host — só rede interna
do docker-compose) e delega cada conexão ao fluxo único deste serviço,
`flows.zabbix_alert_flow`.

Fail-closed no boot: se GEMINI_API_KEY/INTERNAL_API_KEY estiverem ausentes,
o processo encerra imediatamente com log claro (nunca degrada silenciosamente
aceitando conexões que vão falhar em toda chamada real).
"""

from __future__ import annotations

import asyncio
import logging
import sys

from config import ConfigError, load_settings
from flows.zabbix_alert_flow import handle_connection
from services.ai_service import AiService
from services.backend_client import BackendClient
from services.gemini_service import GeminiService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("ai-agent.main")


async def _serve(settings) -> None:
    backend = BackendClient(
        base_url=settings.backend_url,
        internal_api_key=settings.internal_api_key,
        timeout_seconds=settings.backend_timeout_seconds,
    )
    gemini = GeminiService(
        api_key=settings.gemini_api_key,
        model_stt=settings.gemini_model_stt,
        model_llm=settings.gemini_model_llm,
        model_tts=settings.gemini_model_tts,
    )
    ai_service = AiService(gemini)

    async def _on_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peer = writer.get_extra_info("peername")
        logger.info("Conexão AudioSocket aceita: %s", peer)
        try:
            await handle_connection(
                reader, writer, backend, ai_service, settings.listen_timeout_seconds
            )
        finally:
            logger.info("Conexão AudioSocket finalizada: %s", peer)

    server = await asyncio.start_server(
        _on_client, settings.audiosocket_host, settings.audiosocket_port
    )
    sockets = ", ".join(str(sock.getsockname()) for sock in server.sockets or [])
    logger.info("ai-agent (Módulo 3) escutando AudioSocket em %s", sockets)

    async with server:
        await server.serve_forever()


def main() -> None:
    try:
        settings = load_settings()
    except ConfigError as exc:
        logger.critical("Falha de configuração no boot: %s", exc)
        sys.exit(1)

    try:
        asyncio.run(_serve(settings))
    except KeyboardInterrupt:
        logger.info("ai-agent encerrado (KeyboardInterrupt).")


if __name__ == "__main__":
    main()
