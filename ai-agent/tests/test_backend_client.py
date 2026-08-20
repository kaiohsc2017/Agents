"""Testes de backend_client.py — cliente HTTP do backend Java.

Mocka aiohttp.ClientSession por inteiro (nunca abre socket real) — os testes
validam contrato (status HTTP → retorno) e a disciplina de nunca propagar
exceção crua do aiohttp.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import aiohttp

from services.backend_client import BackendClient


def _make_client() -> BackendClient:
    return BackendClient(
        base_url="http://backend:8080/",
        internal_api_key="chave-interna-teste",
        timeout_seconds=5,
    )


class _FakeResponse:
    """Substitui o objeto de resposta do aiohttp usado como async context manager."""

    def __init__(self, status: int, json_body: dict | None = None) -> None:
        self.status = status
        self._json_body = json_body or {}

    async def json(self):
        return self._json_body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False


# --- get_alert_by_uuid --------------------------------------------------------


async def test_get_alert_by_uuid_retorna_json_em_200(mocker):
    # Arrange
    client = _make_client()
    resp = _FakeResponse(status=200, json_body={"zabbixHost": "host1"})
    session_mock = MagicMock()
    session_mock.get.return_value = resp
    session_mock.__aenter__ = AsyncMock(return_value=session_mock)
    session_mock.__aexit__ = AsyncMock(return_value=False)
    mocker.patch("aiohttp.ClientSession", return_value=session_mock)

    # Act
    resultado = await client.get_alert_by_uuid("uuid-123")

    # Assert
    assert resultado == {"zabbixHost": "host1"}
    session_mock.get.assert_called_once()
    _, kwargs = session_mock.get.call_args
    assert kwargs["headers"] == {"X-Internal-Key": "chave-interna-teste"}


async def test_get_alert_by_uuid_monta_url_sem_barra_duplicada():
    # Arrange — base_url termina com "/", garante que a URL final não duplica
    client = _make_client()

    # Assert (comportamento interno já validado indiretamente pelo teste acima,
    # mas fixamos explicitamente a invariante do construtor aqui)
    assert client._base_url == "http://backend:8080"


async def test_get_alert_by_uuid_retorna_none_em_status_inesperado(mocker):
    # Arrange
    client = _make_client()
    resp = _FakeResponse(status=404)
    session_mock = MagicMock()
    session_mock.get.return_value = resp
    session_mock.__aenter__ = AsyncMock(return_value=session_mock)
    session_mock.__aexit__ = AsyncMock(return_value=False)
    mocker.patch("aiohttp.ClientSession", return_value=session_mock)

    # Act
    resultado = await client.get_alert_by_uuid("uuid-404")

    # Assert
    assert resultado is None


async def test_get_alert_by_uuid_retorna_none_em_erro_de_conexao(mocker):
    # Arrange — simula backend indisponível (ClientError nunca deve escapar)
    client = _make_client()
    mocker.patch(
        "aiohttp.ClientSession",
        side_effect=aiohttp.ClientConnectionError("conexão recusada"),
    )

    # Act
    resultado = await client.get_alert_by_uuid("uuid-off")

    # Assert
    assert resultado is None


# --- update_call_status --------------------------------------------------------


async def test_update_call_status_retorna_true_em_204(mocker):
    # Arrange
    client = _make_client()
    resp = _FakeResponse(status=204)
    session_mock = MagicMock()
    session_mock.patch.return_value = resp
    session_mock.__aenter__ = AsyncMock(return_value=session_mock)
    session_mock.__aexit__ = AsyncMock(return_value=False)
    mocker.patch("aiohttp.ClientSession", return_value=session_mock)

    # Act
    resultado = await client.update_call_status("uuid-123", "ATENDIDA")

    # Assert
    assert resultado is True
    _, kwargs = session_mock.patch.call_args
    assert kwargs["json"] == {"callStatus": "ATENDIDA"}
    assert kwargs["headers"] == {"X-Internal-Key": "chave-interna-teste"}


async def test_update_call_status_retorna_true_em_200(mocker):
    # Arrange
    client = _make_client()
    resp = _FakeResponse(status=200)
    session_mock = MagicMock()
    session_mock.patch.return_value = resp
    session_mock.__aenter__ = AsyncMock(return_value=session_mock)
    session_mock.__aexit__ = AsyncMock(return_value=False)
    mocker.patch("aiohttp.ClientSession", return_value=session_mock)

    # Act
    resultado = await client.update_call_status("uuid-123", "FALHA")

    # Assert
    assert resultado is True


async def test_update_call_status_retorna_false_em_status_inesperado(mocker):
    # Arrange
    client = _make_client()
    resp = _FakeResponse(status=500)
    session_mock = MagicMock()
    session_mock.patch.return_value = resp
    session_mock.__aenter__ = AsyncMock(return_value=session_mock)
    session_mock.__aexit__ = AsyncMock(return_value=False)
    mocker.patch("aiohttp.ClientSession", return_value=session_mock)

    # Act
    resultado = await client.update_call_status("uuid-123", "ATENDIDA")

    # Assert
    assert resultado is False


async def test_update_call_status_retorna_false_em_timeout(mocker):
    # Arrange — timeout é subtipo de aiohttp.ClientError (via asyncio.TimeoutError
    # não é capturado, mas aiohttp levanta ServerTimeoutError como ClientError)
    client = _make_client()
    mocker.patch(
        "aiohttp.ClientSession",
        side_effect=aiohttp.ServerTimeoutError("timeout"),
    )

    # Act
    resultado = await client.update_call_status("uuid-timeout", "ATENDIDA")

    # Assert
    assert resultado is False
