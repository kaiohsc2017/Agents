"""Testes de main.py — bootstrap do servidor asyncio e fail-closed no boot."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

import main
from config import ConfigError


def test_main_encerra_com_exit_1_em_erro_de_configuracao(mocker):
    # Arrange
    mocker.patch("main.load_settings", side_effect=ConfigError("segredo ausente"))
    # Em produção sys.exit(1) levanta SystemExit de verdade, interrompendo a
    # função antes de qualquer uso de `settings` — replicamos esse
    # comportamento real (side_effect) em vez de um mock inerte, senão o teste
    # seguiria para o bloco de asyncio.run com `settings` indefinida.
    exit_mock = mocker.patch("main.sys.exit", side_effect=SystemExit(1))
    run_mock = mocker.patch("main.asyncio.run")

    # Act / Assert
    with pytest.raises(SystemExit):
        main.main()

    exit_mock.assert_called_once_with(1)
    run_mock.assert_not_called()


def test_main_chama_asyncio_run_quando_config_valida(mocker):
    # Arrange
    settings = MagicMock()
    mocker.patch("main.load_settings", return_value=settings)
    run_mock = mocker.patch("main.asyncio.run")

    # Act
    main.main()

    # Assert
    run_mock.assert_called_once()


def test_main_trata_keyboard_interrupt_sem_propagar(mocker):
    # Arrange
    settings = MagicMock()
    mocker.patch("main.load_settings", return_value=settings)
    mocker.patch("main.asyncio.run", side_effect=KeyboardInterrupt())

    # Act / Assert — nunca deve propagar KeyboardInterrupt (encerramento normal)
    main.main()


async def test_serve_registra_servidor_e_delega_conexao_ao_flow(mocker):
    # Arrange
    settings = MagicMock()
    settings.backend_url = "http://backend:8080"
    settings.internal_api_key = "chave-teste"
    settings.backend_timeout_seconds = 5
    settings.gemini_api_key = "chave-gemini"
    settings.gemini_model_stt = "stt"
    settings.gemini_model_llm = "llm"
    settings.gemini_model_tts = "tts"
    settings.audiosocket_host = "0.0.0.0"
    settings.audiosocket_port = 9092
    settings.listen_timeout_seconds = 6

    mocker.patch("main.BackendClient")
    mocker.patch("main.GeminiService")
    handle_connection_mock = mocker.patch("main.handle_connection", new=AsyncMock())

    fake_server = MagicMock()
    fake_server.sockets = []
    fake_server.serve_forever = AsyncMock()
    fake_server.__aenter__ = AsyncMock(return_value=fake_server)
    fake_server.__aexit__ = AsyncMock(return_value=False)

    captured_client_cb = {}

    async def _start_server(client_connected_cb, host, port):
        captured_client_cb["cb"] = client_connected_cb
        return fake_server

    mocker.patch("main.asyncio.start_server", side_effect=_start_server)

    # Act
    await main._serve(settings)

    # Assert — o callback registrado no start_server delega ao flow do Módulo 3
    reader = MagicMock()
    writer = MagicMock()
    writer.get_extra_info.return_value = ("127.0.0.1", 12345)
    await captured_client_cb["cb"](reader, writer)
    handle_connection_mock.assert_called_once()
    fake_server.serve_forever.assert_called_once()
