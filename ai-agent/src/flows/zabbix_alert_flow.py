"""zabbix_alert_flow.py — Fluxo único deste serviço: Módulo 3 (Alerta Zabbix).

Ponta a ponta por conexão AudioSocket:
    1. Lê o frame inicial (kind=UUID) — identifica a chamada.
    2. Busca o incidente no backend Java (`GET /alert-calls/by-uuid/{uuid}`).
    3. Narra o incidente por voz (TTS).
    4. Escuta a resposta falada do atendente por um tempo limitado.
    5. Classifica a resposta (STT + LLM) e decide o status final.
    6. Atualiza o status no backend (`PATCH /alert-calls/by-uuid/{uuid}`).
    7. Encerra a chamada.

Nunca deixa uma exceção não tratada travar a conexão: todo o corpo roda num
try/except com fallback para status "FALHA" reportado ao backend, e o socket
é sempre fechado no finally — mesma disciplina já usada no restante do
projeto para nunca deixar um recurso pendurado.
"""

from __future__ import annotations

import asyncio
import logging

from protocol import (
    Frame,
    FrameKind,
    ProtocolError,
    encode_hangup_frame,
    parse_uuid_payload,
    read_frame,
    write_audio,
)
from services.ai_service import AiService
from services.backend_client import BackendClient

logger = logging.getLogger("ai-agent.zabbix_alert_flow")

_CLASSIFICATION_TO_STATUS = {
    "RECONHECIDO": "ATENDIDA",
    "NAO_RECONHECIDO": "NAO_ATENDIDA",
    "SILENCIO": "NAO_ATENDIDA",
}

# Teto defensivo de bytes acumulados ao escutar a resposta do atendente (achado
# HIGH da revisão de segurança 2026-08-20): sem isso, um peer que mande frames
# de áudio válidos sem parar durante toda a janela de timeout poderia crescer o
# buffer indefinidamente. PCM slin8 = 16000 bytes/s; folga de 4x sobre o maior
# timeout configurável razoável cobre qualquer uso legítimo com margem.
_MAX_RESPONSE_BUFFER_BYTES = 16000 * 60 * 4  # ~4 min de áudio a 16000 bytes/s


class _CleanHangup(Exception):
    """Sinaliza que o peer encerrou a conexão com um frame HANGUP explícito.

    Distinto de um EOF/protocolo inválido: é o desligamento normal do protocolo
    AudioSocket (inclusive o probe do healthcheck, ver docker-compose.yml) — não
    deve gerar warning no log, só as desconexões genuinamente inesperadas.
    """


async def _read_initial_uuid(reader: asyncio.StreamReader) -> str | None:
    """Lê frames até achar o frame UUID inicial.

    Levanta `_CleanHangup` se o peer mandar um HANGUP explícito antes do UUID
    (desligamento normal, nunca logado como warning). Retorna None só quando a
    conexão termina sem nenhum frame reconhecível (EOF cru) — esse caso sim é
    anômalo e deve ser logado.
    """
    frame: Frame | None = await read_frame(reader)
    while frame is not None:
        if frame.kind == FrameKind.UUID:
            return parse_uuid_payload(frame.payload)
        if frame.kind == FrameKind.HANGUP:
            raise _CleanHangup()
        frame = await read_frame(reader)
    return None


async def _listen_for_response(
    reader: asyncio.StreamReader, timeout_seconds: int
) -> bytes:
    """Acumula áudio recebido do atendente por até `timeout_seconds`."""
    buffer = bytearray()

    async def _collect() -> None:
        while True:
            frame = await read_frame(reader)
            if frame is None or frame.kind == FrameKind.HANGUP:
                return
            if frame.kind == FrameKind.AUDIO:
                if len(buffer) + len(frame.payload) > _MAX_RESPONSE_BUFFER_BYTES:
                    logger.warning(
                        "Buffer de resposta do atendente atingiu o teto defensivo "
                        "(%d bytes) — parando a coleta antes do timeout.",
                        _MAX_RESPONSE_BUFFER_BYTES,
                    )
                    return
                buffer.extend(frame.payload)

    try:
        await asyncio.wait_for(_collect(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        pass  # esperado — é o tempo normal de escuta, não um erro
    return bytes(buffer)


async def handle_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    backend: BackendClient,
    ai_service: AiService,
    listen_timeout_seconds: int,
) -> None:
    uuid: str | None = None
    final_status = "FALHA"
    try:
        try:
            # Timeout defensivo (achado LOW da revisão de segurança 2026-08-20): sem
            # isso, um peer que abre a conexão e nunca envia o frame UUID prenderia a
            # coroutine indefinidamente — só o Asterisk deveria conectar aqui, mas o
            # custo desta defesa é baixo.
            uuid = await asyncio.wait_for(_read_initial_uuid(reader), timeout=10)
        except _CleanHangup:
            # Desligamento normal do protocolo (inclui o probe do healthcheck) — não é erro.
            logger.debug("Conexão AudioSocket encerrada por HANGUP explícito antes do UUID.")
            return
        except asyncio.TimeoutError:
            logger.warning("Timeout aguardando o frame UUID inicial — encerrando conexão.")
            return
        except (asyncio.IncompleteReadError, ProtocolError) as exc:
            logger.warning("Conexão AudioSocket encerrada antes do frame UUID: %s", exc)
            return

        if uuid is None:
            logger.warning("Conexão AudioSocket sem UUID inicial válido — encerrando.")
            return

        logger.info("Nova chamada de alerta — uuid=%s", uuid)

        alert = await backend.get_alert_by_uuid(uuid)
        if alert is None:
            logger.warning("Incidente não encontrado para uuid=%s — encerrando chamada.", uuid)
            return

        narration = ai_service.build_incident_narration(alert)
        audio = await ai_service.narrate(narration)
        if audio is None:
            logger.error("TTS indisponível para uuid=%s — encerrando sem narrar.", uuid)
            final_status = "FALHA"
        else:
            await write_audio(writer, audio)

            response_pcm = await _listen_for_response(reader, listen_timeout_seconds)
            classification = await ai_service.interpret_operator_response(response_pcm)
            final_status = _CLASSIFICATION_TO_STATUS.get(classification, "NAO_ATENDIDA")
            logger.info(
                "Resposta do atendente classificada como %s (uuid=%s) → status=%s",
                classification,
                uuid,
                final_status,
            )

    except (asyncio.IncompleteReadError, ConnectionResetError) as exc:
        # A ligação pode cair no meio (atendente desligou) — não é uma falha
        # do serviço, é o comportamento esperado de uma chamada real.
        logger.info("Conexão AudioSocket encerrada pelo peer (uuid=%s): %s", uuid, exc)
    except Exception:  # noqa: BLE001 — última linha de defesa da conexão
        logger.exception("Erro inesperado no fluxo de alerta Zabbix (uuid=%s)", uuid)
    finally:
        if uuid is not None:
            await backend.update_call_status(uuid, final_status)
        try:
            writer.write(encode_hangup_frame())
            await writer.drain()
        except (ConnectionResetError, OSError):
            pass
        writer.close()
        try:
            await writer.wait_closed()
        except (ConnectionResetError, OSError):
            pass
