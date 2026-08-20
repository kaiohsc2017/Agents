"""Testes de ai_service.py — orquestração STT → LLM → TTS."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from services.ai_service import AiService
from services.gemini_service import GeminiError


@pytest.fixture
def gemini_mock():
    return AsyncMock()


@pytest.fixture
def ai_service(gemini_mock):
    return AiService(gemini_mock)


# --- build_incident_narration --------------------------------------------------


def test_build_incident_narration_monta_texto_com_todos_os_campos(ai_service):
    # Arrange
    alert = {
        "zabbixHost": "srv-web-01",
        "zabbixIncidentSummary": "CPU acima de 90%",
        "zabbixSeverity": "4",
    }

    # Act
    texto = ai_service.build_incident_narration(alert)

    # Assert
    assert "srv-web-01" in texto
    assert "CPU acima de 90%" in texto
    assert "alta" in texto  # severidade 4 → label "alta"
    assert "reconhecido" in texto


def test_build_incident_narration_usa_fallback_para_campos_ausentes(ai_service):
    # Arrange — alerta sem nenhum campo preenchido
    alert = {}

    # Act
    texto = ai_service.build_incident_narration(alert)

    # Assert
    assert "host desconhecido" in texto
    assert "incidente sem descrição" in texto
    assert "não informada" in texto


def test_build_incident_narration_usa_severidade_crua_quando_fora_do_mapa(ai_service):
    # Arrange — severidade não mapeada (ex: valor inesperado do Zabbix)
    alert = {"zabbixSeverity": "99"}

    # Act
    texto = ai_service.build_incident_narration(alert)

    # Assert — mesmo fora do dicionário conhecido, nunca quebra: usa o valor cru
    assert "99" in texto


# --- narrate ---------------------------------------------------------------------


async def test_narrate_retorna_audio_em_sucesso(ai_service, gemini_mock):
    # Arrange
    gemini_mock.synthesize_speech.return_value = b"audio-pcm"

    # Act
    resultado = await ai_service.narrate("texto qualquer")

    # Assert
    assert resultado == b"audio-pcm"


async def test_narrate_retorna_none_quando_gemini_falha(ai_service, gemini_mock):
    # Arrange — cobre o caso real de cota esgotada (GeminiError genérico)
    gemini_mock.synthesize_speech.side_effect = GeminiError("Falha ao sintetizar fala")

    # Act
    resultado = await ai_service.narrate("texto qualquer")

    # Assert — nunca propaga a exceção, o chamador decide o fallback
    assert resultado is None


# --- interpret_operator_response --------------------------------------------------


async def test_interpret_operator_response_transcreve_e_classifica(ai_service, gemini_mock):
    # Arrange
    gemini_mock.transcribe.return_value = "reconhecido, vou tratar"
    gemini_mock.classify_response.return_value = "RECONHECIDO"

    # Act
    resultado = await ai_service.interpret_operator_response(b"\x00\x01" * 10)

    # Assert
    assert resultado == "RECONHECIDO"
    gemini_mock.transcribe.assert_called_once_with(b"\x00\x01" * 10)
    gemini_mock.classify_response.assert_called_once_with("reconhecido, vou tratar")


async def test_interpret_operator_response_retorna_silencio_quando_stt_falha(
    ai_service, gemini_mock
):
    # Arrange — STT indisponível (ex: cota do Gemini esgotada)
    gemini_mock.transcribe.side_effect = GeminiError("Falha ao transcrever áudio")

    # Act
    resultado = await ai_service.interpret_operator_response(b"\x00" * 10)

    # Assert — rótulo mais conservador, nunca propaga a exceção
    assert resultado == "SILENCIO"
    gemini_mock.classify_response.assert_not_called()
