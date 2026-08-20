"""Testes de zabbix_alert_flow.py — fluxo ponta a ponta do Módulo 3.

Todos os componentes externos (reader/writer AudioSocket, BackendClient,
AiService) são mockados — nenhum socket real é aberto.
"""

from __future__ import annotations

import asyncio
import struct
from unittest.mock import AsyncMock, MagicMock

import pytest

from flows import zabbix_alert_flow
from flows.zabbix_alert_flow import handle_connection
from protocol import FrameKind

UUID_TEXTO = "01234567-89ab-cdef-0123-456789abcdef"
UUID_BYTES = bytes.fromhex("0123456789abcdef0123456789abcdef")


def _frame_bytes(kind: int, payload: bytes = b"") -> bytes:
    return struct.pack(">BH", kind, len(payload)) + payload


class _FakeReader:
    """Fila de frames pré-programada — cada chamada a readexactly avança nela."""

    def __init__(self, frames: list[bytes]) -> None:
        # concatena todos os frames num único stream de bytes, como um socket real.
        self._buffer = b"".join(frames)
        self._offset = 0

    async def readexactly(self, n: int) -> bytes:
        restante = len(self._buffer) - self._offset
        if restante < n:
            chunk = self._buffer[self._offset :]
            self._offset = len(self._buffer)
            raise asyncio.IncompleteReadError(chunk, n)
        chunk = self._buffer[self._offset : self._offset + n]
        self._offset += n
        return chunk


def _make_writer() -> MagicMock:
    writer = MagicMock()
    writer.write = MagicMock()
    writer.drain = AsyncMock()
    writer.close = MagicMock()
    writer.wait_closed = AsyncMock()
    return writer


def _make_backend(alert: dict | None) -> AsyncMock:
    backend = AsyncMock()
    backend.get_alert_by_uuid.return_value = alert
    backend.update_call_status.return_value = True
    return backend


def _make_ai_service(narration: str = "narração de teste", audio: bytes | None = b"audio-pcm", classification: str = "RECONHECIDO") -> AsyncMock:
    ai_service = AsyncMock()
    ai_service.build_incident_narration = MagicMock(return_value=narration)
    ai_service.narrate.return_value = audio
    ai_service.interpret_operator_response.return_value = classification
    return ai_service


# --- caminho feliz completo --------------------------------------------------


async def test_handle_connection_fluxo_completo_reconhecido():
    # Arrange
    reader = _FakeReader(
        [
            _frame_bytes(FrameKind.UUID, UUID_BYTES),
            _frame_bytes(FrameKind.AUDIO, b"\x00\x01" * 10),
            _frame_bytes(FrameKind.HANGUP),
        ]
    )
    writer = _make_writer()
    backend = _make_backend({"zabbixHost": "srv-01"})
    ai_service = _make_ai_service(classification="RECONHECIDO")

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert
    backend.get_alert_by_uuid.assert_called_once_with(UUID_TEXTO)
    backend.update_call_status.assert_called_once_with(UUID_TEXTO, "ATENDIDA")
    writer.close.assert_called_once()


async def test_handle_connection_classificacao_nao_reconhecido_grava_status_correto():
    # Arrange
    reader = _FakeReader(
        [
            _frame_bytes(FrameKind.UUID, UUID_BYTES),
            _frame_bytes(FrameKind.HANGUP),
        ]
    )
    writer = _make_writer()
    backend = _make_backend({"zabbixHost": "srv-01"})
    ai_service = _make_ai_service(classification="NAO_RECONHECIDO")

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert
    backend.update_call_status.assert_called_once_with(UUID_TEXTO, "NAO_ATENDIDA")


async def test_handle_connection_classificacao_silencio_grava_nao_atendida():
    # Arrange
    reader = _FakeReader(
        [
            _frame_bytes(FrameKind.UUID, UUID_BYTES),
            _frame_bytes(FrameKind.HANGUP),
        ]
    )
    writer = _make_writer()
    backend = _make_backend({"zabbixHost": "srv-01"})
    ai_service = _make_ai_service(classification="SILENCIO")

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert
    backend.update_call_status.assert_called_once_with(UUID_TEXTO, "NAO_ATENDIDA")


# --- _CleanHangup: desligamento normal antes do UUID (ex: healthcheck) ------------


async def test_handle_connection_hangup_antes_do_uuid_nao_atualiza_backend(caplog):
    # Arrange — probe do healthcheck: conecta e manda HANGUP sem nunca enviar UUID
    reader = _FakeReader([_frame_bytes(FrameKind.HANGUP)])
    writer = _make_writer()
    backend = _make_backend(None)
    ai_service = _make_ai_service()

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert — nunca chega a consultar/atualizar o backend (nem tem uuid), e não
    # deve ter gerado warning (desligamento normal, não erro de protocolo)
    backend.get_alert_by_uuid.assert_not_called()
    backend.update_call_status.assert_not_called()
    assert "WARNING" not in [r.levelname for r in caplog.records if "HANGUP" in r.message or True]


async def test_handle_connection_hangup_antes_do_uuid_fecha_conexao():
    # Arrange
    reader = _FakeReader([_frame_bytes(FrameKind.HANGUP)])
    writer = _make_writer()
    backend = _make_backend(None)
    ai_service = _make_ai_service()

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert — mesmo no early-return do _CleanHangup, a conexão é encerrada
    # normalmente (frame de hangup escrito + socket fechado no finally)
    writer.close.assert_called_once()


# --- timeout aguardando o frame UUID inicial --------------------------------------


async def test_handle_connection_timeout_aguardando_uuid_nao_atualiza_backend(mocker):
    # Arrange — simula um peer que nunca manda nenhum frame dentro dos 10s de timeout
    reader = MagicMock()

    async def _nunca_retorna(n):
        await asyncio.sleep(999)

    reader.readexactly = AsyncMock(side_effect=_nunca_retorna)
    writer = _make_writer()
    backend = _make_backend(None)
    ai_service = _make_ai_service()
    mocker.patch("asyncio.wait_for", side_effect=asyncio.TimeoutError())

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert
    backend.get_alert_by_uuid.assert_not_called()
    backend.update_call_status.assert_not_called()


# --- frame malformado / EOF antes do UUID -----------------------------------------


async def test_handle_connection_eof_antes_do_uuid_encerra_sem_erro():
    # Arrange — conexão cai no meio do header do primeiro frame
    reader = _FakeReader([b"\x10"])
    writer = _make_writer()
    backend = _make_backend(None)
    ai_service = _make_ai_service()

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert
    backend.get_alert_by_uuid.assert_not_called()
    writer.close.assert_called_once()


async def test_handle_connection_payload_uuid_malformado_encerra_sem_erro():
    # Arrange — frame kind=UUID mas com payload de tamanho errado (ProtocolError)
    reader = _FakeReader([_frame_bytes(FrameKind.UUID, b"\x00" * 5)])
    writer = _make_writer()
    backend = _make_backend(None)
    ai_service = _make_ai_service()

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert — ProtocolError é capturada, conexão encerrada graciosamente
    backend.get_alert_by_uuid.assert_not_called()
    writer.close.assert_called_once()


# --- incidente não encontrado no backend ------------------------------------------


async def test_handle_connection_incidente_nao_encontrado_nao_narra():
    # Arrange — backend não acha o alerta associado ao UUID
    reader = _FakeReader([_frame_bytes(FrameKind.UUID, UUID_BYTES)])
    writer = _make_writer()
    backend = _make_backend(alert=None)
    ai_service = _make_ai_service()

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert — sem alerta, nunca chama narrate; e como uuid é None-safe (uuid
    # setado antes do retorno), o backend é atualizado com o status default
    ai_service.narrate.assert_not_called()
    backend.update_call_status.assert_called_once_with(UUID_TEXTO, "FALHA")


# --- TTS indisponível (ex: cota do Gemini esgotada) -------------------------------


async def test_handle_connection_tts_indisponivel_grava_status_falha():
    # Arrange — ai_service.narrate devolve None (GeminiError tratado internamente,
    # reproduz o cenário real de cota esgotada em produção)
    reader = _FakeReader([_frame_bytes(FrameKind.UUID, UUID_BYTES)])
    writer = _make_writer()
    backend = _make_backend({"zabbixHost": "srv-01"})
    ai_service = _make_ai_service(audio=None)

    # Act
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert
    backend.update_call_status.assert_called_once_with(UUID_TEXTO, "FALHA")
    ai_service.interpret_operator_response.assert_not_called()


# --- desconexão abrupta do peer durante a chamada ---------------------------------


async def test_handle_connection_connection_reset_durante_narracao_grava_falha():
    # Arrange — a escrita do áudio falha porque o peer derrubou a conexão
    reader = _FakeReader([_frame_bytes(FrameKind.UUID, UUID_BYTES)])
    writer = _make_writer()
    writer.write.side_effect = ConnectionResetError("conexão resetada pelo peer")
    backend = _make_backend({"zabbixHost": "srv-01"})
    ai_service = _make_ai_service()

    # Act — nunca deve propagar a exceção para fora de handle_connection
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert — o hangup final também tenta escrever, mas está protegido por
    # try/except próprio; o status registrado é o default (FALHA), já que a
    # escrita do áudio nunca terminou de fato antes de propagar o erro.
    backend.update_call_status.assert_called_once_with(UUID_TEXTO, "FALHA")


async def test_handle_connection_erro_inesperado_generico_grava_falha_e_nao_propaga():
    # Arrange — falha inesperada dentro do ai_service (não um GeminiError tratado)
    reader = _FakeReader([_frame_bytes(FrameKind.UUID, UUID_BYTES)])
    writer = _make_writer()
    backend = _make_backend({"zabbixHost": "srv-01"})
    ai_service = _make_ai_service()
    ai_service.narrate.side_effect = RuntimeError("erro totalmente inesperado")

    # Act — última linha de defesa: nunca deixa exceção genérica escapar
    await handle_connection(reader, writer, backend, ai_service, listen_timeout_seconds=5)

    # Assert
    backend.update_call_status.assert_called_once_with(UUID_TEXTO, "FALHA")
    writer.close.assert_called_once()


# --- teto defensivo do buffer de resposta do atendente ----------------------------


async def test_listen_for_response_respeita_teto_de_buffer(mocker):
    # Arrange — gera frames de áudio suficientes para passar do teto defensivo
    # sem precisar de ~4 minutos reais de dados: reduz o teto via monkeypatch.
    mocker.patch.object(zabbix_alert_flow, "_MAX_RESPONSE_BUFFER_BYTES", 100)
    frames = [_frame_bytes(FrameKind.AUDIO, b"\x00" * 60) for _ in range(5)]
    frames.append(_frame_bytes(FrameKind.HANGUP))
    reader = _FakeReader(frames)

    # Act
    resultado = await zabbix_alert_flow._listen_for_response(reader, timeout_seconds=5)

    # Assert — parou de acumular antes do 2º frame completar o buffer
    assert len(resultado) <= 100


async def test_listen_for_response_para_no_timeout_sem_hangup():
    # Arrange — nenhum HANGUP chega, só o timeout deve interromper a escuta
    reader = MagicMock()

    async def _nunca_retorna_frame(n):
        await asyncio.sleep(999)

    reader.readexactly = _nunca_retorna_frame

    # Act
    resultado = await zabbix_alert_flow._listen_for_response(reader, timeout_seconds=0.05)

    # Assert — timeout é esperado, não deve levantar exceção
    assert resultado == b""


async def test_listen_for_response_acumula_multiplos_frames_de_audio():
    # Arrange
    frames = [
        _frame_bytes(FrameKind.AUDIO, b"\x01\x02"),
        _frame_bytes(FrameKind.AUDIO, b"\x03\x04"),
        _frame_bytes(FrameKind.HANGUP),
    ]
    reader = _FakeReader(frames)

    # Act
    resultado = await zabbix_alert_flow._listen_for_response(reader, timeout_seconds=5)

    # Assert
    assert resultado == b"\x01\x02\x03\x04"
