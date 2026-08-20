"""Testes de protocol.py — framing do protocolo AudioSocket."""

from __future__ import annotations

import asyncio
import struct

import pytest

import protocol
from protocol import (
    AUDIO_FRAME_BYTES,
    Frame,
    FrameKind,
    MAX_PAYLOAD_BYTES,
    ProtocolError,
    encode_hangup_frame,
    parse_uuid_payload,
    read_frame,
    write_audio,
)


class _FakeStreamReader:
    """Substitui asyncio.StreamReader — lê de um buffer de bytes em memória."""

    def __init__(self, data: bytes) -> None:
        self._data = data
        self._offset = 0

    async def readexactly(self, n: int) -> bytes:
        restante = len(self._data) - self._offset
        if restante < n:
            # Mesmo comportamento do asyncio real: EOF no meio do frame.
            chunk = self._data[self._offset :]
            self._offset = len(self._data)
            raise asyncio.IncompleteReadError(chunk, n)
        chunk = self._data[self._offset : self._offset + n]
        self._offset += n
        return chunk


class _FakeStreamWriter:
    """Substitui asyncio.StreamWriter — acumula os bytes escritos."""

    def __init__(self) -> None:
        self.written = bytearray()
        self.drain_calls = 0

    def write(self, data: bytes) -> None:
        self.written.extend(data)

    async def drain(self) -> None:
        self.drain_calls += 1


def _header(kind: int, length: int) -> bytes:
    return struct.pack(">BH", kind, length)


# --- read_frame -------------------------------------------------------------


async def test_read_frame_le_frame_audio_com_payload():
    # Arrange
    payload = b"\x01\x02" * 4
    dados = _header(FrameKind.AUDIO, len(payload)) + payload
    reader = _FakeStreamReader(dados)

    # Act
    frame = await read_frame(reader)

    # Assert
    assert frame.kind == FrameKind.AUDIO
    assert frame.payload == payload


async def test_read_frame_le_frame_sem_payload_hangup():
    # Arrange
    dados = _header(FrameKind.HANGUP, 0)
    reader = _FakeStreamReader(dados)

    # Act
    frame = await read_frame(reader)

    # Assert
    assert frame.kind == FrameKind.HANGUP
    assert frame.payload == b""


async def test_read_frame_rejeita_payload_acima_do_limite():
    # Arrange — declara um comprimento maior que MAX_PAYLOAD_BYTES no header,
    # sem precisar dos bytes reais do payload (a validação ocorre antes de ler).
    dados = _header(FrameKind.AUDIO, MAX_PAYLOAD_BYTES + 1)
    reader = _FakeStreamReader(dados)

    # Act / Assert
    with pytest.raises(ProtocolError, match="excede o limite"):
        await read_frame(reader)


async def test_read_frame_propaga_eof_no_meio_do_header():
    # Arrange — só 1 byte de um header de 3, conexão cai no meio
    reader = _FakeStreamReader(b"\x10")

    # Act / Assert
    with pytest.raises(asyncio.IncompleteReadError):
        await read_frame(reader)


async def test_read_frame_propaga_eof_no_meio_do_payload():
    # Arrange — header anuncia 10 bytes de payload, mas só 2 chegam
    dados = _header(FrameKind.AUDIO, 10) + b"\x00\x01"
    reader = _FakeStreamReader(dados)

    # Act / Assert
    with pytest.raises(asyncio.IncompleteReadError):
        await read_frame(reader)


# --- parse_uuid_payload ------------------------------------------------------


def test_parse_uuid_payload_formata_16_bytes_corretamente():
    # Arrange
    payload = bytes.fromhex("0123456789abcdef0123456789abcdef")

    # Act
    resultado = parse_uuid_payload(payload)

    # Assert
    assert resultado == "01234567-89ab-cdef-0123-456789abcdef"


def test_parse_uuid_payload_rejeita_tamanho_diferente_de_16_bytes():
    # Arrange
    payload = b"\x00" * 10

    # Act / Assert
    with pytest.raises(ProtocolError, match="tamanho inesperado"):
        parse_uuid_payload(payload)


# --- encode_hangup_frame ------------------------------------------------------


def test_encode_hangup_frame_gera_header_sem_payload():
    # Act
    frame_bytes = encode_hangup_frame()

    # Assert
    assert frame_bytes == struct.pack(">BH", FrameKind.HANGUP, 0)


# --- write_audio --------------------------------------------------------------


async def test_write_audio_fatiado_em_frames_de_tamanho_exato():
    # Arrange — exatamente 2 frames completos, sem sobra
    pcm = b"\xaa" * (AUDIO_FRAME_BYTES * 2)
    writer = _FakeStreamWriter()

    # Act
    await write_audio(writer, pcm)

    # Assert
    esperado = (
        struct.pack(">BH", FrameKind.AUDIO, AUDIO_FRAME_BYTES)
        + pcm[:AUDIO_FRAME_BYTES]
        + struct.pack(">BH", FrameKind.AUDIO, AUDIO_FRAME_BYTES)
        + pcm[AUDIO_FRAME_BYTES:]
    )
    assert bytes(writer.written) == esperado
    assert writer.drain_calls == 1


async def test_write_audio_preenche_ultimo_frame_incompleto_com_silencio():
    # Arrange — 50 bytes sobrando, menos que um frame inteiro (320 bytes)
    pcm = b"\xff" * 50
    writer = _FakeStreamWriter()

    # Act
    await write_audio(writer, pcm)

    # Assert
    header = struct.pack(">BH", FrameKind.AUDIO, AUDIO_FRAME_BYTES)
    payload_esperado = pcm + b"\x00" * (AUDIO_FRAME_BYTES - 50)
    assert bytes(writer.written) == header + payload_esperado
    assert len(writer.written) == protocol._HEADER_SIZE + AUDIO_FRAME_BYTES


async def test_write_audio_com_pcm_vazio_nao_escreve_nada():
    # Arrange
    writer = _FakeStreamWriter()

    # Act
    await write_audio(writer, b"")

    # Assert
    assert bytes(writer.written) == b""
    assert writer.drain_calls == 1
