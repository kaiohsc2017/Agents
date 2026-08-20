"""protocol.py — Framing do protocolo AudioSocket do Asterisk (app_audiosocket).

Especificação confirmada via código-fonte oficial do Asterisk
(res/res_audiosocket.c, apps/app_audiosocket.c — branch master, 2026-08):

    Header (3 bytes):
        byte 0     = "kind" (tipo do frame)
        bytes 1-2  = comprimento do payload, big-endian (uint16)
    Payload: `comprimento` bytes, conteúdo depende do "kind".

Tipos de frame ("kind"):
    0x00 = HANGUP  — Asterisk avisa que a chamada foi encerrada (sem payload)
    0x01 = UUID    — primeiro frame da conexão, payload = 16 bytes do UUID
    0x03 = DTMF    — 1 byte com o dígito pressionado
    0x10 = AUDIO   — payload = PCM signed-linear 16-bit mono, 8kHz (slin8)
    0xff = ERROR   — erro de protocolo

Áudio de volta ao Asterisk deve ser enviado em frames de até 320 bytes
(20ms de slin8: 8000 amostras/s × 2 bytes × 0,02s = 320 bytes) — mesmo
tamanho de frame já documentado no CLAUDE.md do projeto.
"""

from __future__ import annotations

import asyncio
import logging
import struct
from dataclasses import dataclass
from enum import IntEnum

logger = logging.getLogger("ai-agent.protocol")

_HEADER_STRUCT = struct.Struct(">BH")  # kind (1 byte) + length (uint16 big-endian)
_HEADER_SIZE = _HEADER_STRUCT.size

# Tamanho de frame de áudio de saída: 20ms de PCM 8kHz/16bit/mono.
AUDIO_FRAME_BYTES = 320
# Limite defensivo contra payload malformado/hostil (o maior payload legítimo
# é UUID=16 bytes; áudio nunca chega tão grande num único frame na prática,
# mas o cabeçalho permite até 65535 — sanitizamos para nunca alocar demais).
MAX_PAYLOAD_BYTES = 8192


class FrameKind(IntEnum):
    HANGUP = 0x00
    UUID = 0x01
    DTMF = 0x03
    AUDIO = 0x10
    ERROR = 0xFF


class ProtocolError(RuntimeError):
    """Frame AudioSocket malformado ou payload fora do limite aceito."""


@dataclass(frozen=True)
class Frame:
    kind: int
    payload: bytes


async def read_frame(reader: asyncio.StreamReader) -> Frame | None:
    """Lê um frame completo do socket. Retorna None em EOF limpo (conexão encerrada)."""
    header = await reader.readexactly(_HEADER_SIZE)
    kind, length = _HEADER_STRUCT.unpack(header)
    # Sanitização defensiva — nunca confiar no comprimento declarado sem limite
    # (mesmo espírito da sanitização de campo AMI já usada no projeto).
    if length > MAX_PAYLOAD_BYTES:
        raise ProtocolError(
            f"Payload declarado ({length} bytes) excede o limite aceito "
            f"({MAX_PAYLOAD_BYTES}) — frame kind=0x{kind:02x} descartado."
        )
    payload = await reader.readexactly(length) if length > 0 else b""
    return Frame(kind=kind, payload=payload)


def parse_uuid_payload(payload: bytes) -> str:
    """Converte os 16 bytes crus do frame UUID no formato textual padrão."""
    if len(payload) != 16:
        raise ProtocolError(f"Payload de UUID com tamanho inesperado: {len(payload)} bytes")
    hex_str = payload.hex()
    return (
        f"{hex_str[0:8]}-{hex_str[8:12]}-{hex_str[12:16]}-"
        f"{hex_str[16:20]}-{hex_str[20:32]}"
    )


def encode_hangup_frame() -> bytes:
    return _HEADER_STRUCT.pack(FrameKind.HANGUP, 0)


async def write_audio(writer: asyncio.StreamWriter, pcm: bytes) -> None:
    """Escreve PCM slin8 de volta ao Asterisk, fatiado em frames de 320 bytes.

    Preenche o último frame com silêncio (zero) se não for múltiplo exato do
    tamanho de frame — nunca envia um frame de áudio com tamanho diferente do
    esperado pelo protocolo.
    """
    offset = 0
    total = len(pcm)
    while offset < total:
        chunk = pcm[offset : offset + AUDIO_FRAME_BYTES]
        if len(chunk) < AUDIO_FRAME_BYTES:
            chunk = chunk + b"\x00" * (AUDIO_FRAME_BYTES - len(chunk))
        header = _HEADER_STRUCT.pack(FrameKind.AUDIO, len(chunk))
        writer.write(header + chunk)
        offset += AUDIO_FRAME_BYTES
    await writer.drain()
