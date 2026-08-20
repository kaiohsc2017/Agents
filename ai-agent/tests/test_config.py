"""Testes de config.py — leitura de env e fail-closed em segredo ausente."""

from __future__ import annotations

import pytest

import config


_ENV_OBRIGATORIAS = {
    "GEMINI_API_KEY": "chave-gemini-teste",
    "INTERNAL_API_KEY": "chave-interna-teste",
}


def _limpar_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove todas as variáveis relevantes antes de cada teste (isolamento)."""
    for nome in (
        "GEMINI_API_KEY",
        "GEMINI_MODEL_STT",
        "GEMINI_MODEL_LLM",
        "GEMINI_MODEL_TTS",
        "INTERNAL_API_KEY",
        "BACKEND_URL",
        "AUDIOSOCKET_HOST",
        "AUDIOSOCKET_PORT",
        "LISTEN_TIMEOUT_SECONDS",
        "BACKEND_TIMEOUT_SECONDS",
    ):
        monkeypatch.delenv(nome, raising=False)


def test_load_settings_com_variaveis_obrigatorias_presentes(monkeypatch):
    # Arrange
    _limpar_env(monkeypatch)
    for nome, valor in _ENV_OBRIGATORIAS.items():
        monkeypatch.setenv(nome, valor)

    # Act
    settings = config.load_settings()

    # Assert — valores default aplicados quando a variável opcional está ausente
    assert settings.gemini_api_key == "chave-gemini-teste"
    assert settings.internal_api_key == "chave-interna-teste"
    assert settings.backend_url == "http://backend:8080"
    assert settings.audiosocket_port == 9092
    assert settings.listen_timeout_seconds == 6
    assert settings.backend_timeout_seconds == 5.0


def test_load_settings_falha_fail_closed_sem_gemini_api_key(monkeypatch):
    # Arrange — só a chave interna presente, GEMINI_API_KEY ausente
    _limpar_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_KEY", "chave-interna-teste")

    # Act / Assert
    with pytest.raises(config.ConfigError, match="GEMINI_API_KEY"):
        config.load_settings()


def test_load_settings_falha_fail_closed_sem_internal_api_key(monkeypatch):
    # Arrange
    _limpar_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "chave-gemini-teste")

    # Act / Assert
    with pytest.raises(config.ConfigError, match="INTERNAL_API_KEY"):
        config.load_settings()


def test_load_settings_falha_com_valor_vazio_apos_strip(monkeypatch):
    # Arrange — variável definida mas só com espaços, deve ser tratada como ausente
    _limpar_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "   ")
    monkeypatch.setenv("INTERNAL_API_KEY", "chave-interna-teste")

    # Act / Assert
    with pytest.raises(config.ConfigError):
        config.load_settings()


def test_load_settings_respeita_variaveis_opcionais_customizadas(monkeypatch):
    # Arrange
    _limpar_env(monkeypatch)
    for nome, valor in _ENV_OBRIGATORIAS.items():
        monkeypatch.setenv(nome, valor)
    monkeypatch.setenv("BACKEND_URL", "http://backend-customizado:9999")
    monkeypatch.setenv("AUDIOSOCKET_PORT", "12345")
    monkeypatch.setenv("LISTEN_TIMEOUT_SECONDS", "15")
    monkeypatch.setenv("BACKEND_TIMEOUT_SECONDS", "2.5")

    # Act
    settings = config.load_settings()

    # Assert
    assert settings.backend_url == "http://backend-customizado:9999"
    assert settings.audiosocket_port == 12345
    assert settings.listen_timeout_seconds == 15
    assert settings.backend_timeout_seconds == 2.5
