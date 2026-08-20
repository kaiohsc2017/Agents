"""backend_client.py — Cliente HTTP para o backend Java (endpoints do Módulo 3).

Consome `GET/PATCH /api/v1/alert-calls/by-uuid/{uuid}` (já existentes em
AlertController.java). Sempre autentica via header `X-Internal-Key` — nunca em
query string (regra do projeto: chave de API/segredo nunca na URL, ver
CLAUDE.md e a correção B2/A5 já aplicada em `notifier.py`/`llm.py`). Nenhuma
exceção crua do cliente HTTP é propagada ao chamador: erros são logados com
detalhe (sem vazar o valor da chave) e devolvidos como `None`/`False`, para o
flow decidir o que fazer sem travar a chamada telefônica em andamento.
"""

from __future__ import annotations

import logging
from typing import Any

import aiohttp

logger = logging.getLogger("ai-agent.backend_client")


class BackendClient:
    def __init__(self, base_url: str, internal_api_key: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"X-Internal-Key": internal_api_key}
        self._timeout = aiohttp.ClientTimeout(total=timeout_seconds)

    async def get_alert_by_uuid(self, uuid: str) -> dict[str, Any] | None:
        """Busca o incidente Zabbix associado ao UUID da chamada. None se não achar/erro."""
        url = f"{self._base_url}/api/v1/alert-calls/by-uuid/{uuid}"
        try:
            async with aiohttp.ClientSession(timeout=self._timeout) as session:
                async with session.get(url, headers=self._headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    logger.warning(
                        "GET alert-calls/by-uuid retornou status inesperado: %s (uuid=%s)",
                        resp.status,
                        uuid,
                    )
                    return None
        except aiohttp.ClientError as exc:
            # Nunca logar exc cru se puder conter a URL completa com segredo —
            # aqui a URL nunca tem segredo (vai só em header), mas mantemos a
            # disciplina de logar só a classe do erro, nunca a mensagem bruta
            # do provedor, para consistência com o restante do projeto.
            logger.error(
                "Falha ao consultar alert-calls/by-uuid (uuid=%s): %s",
                uuid,
                type(exc).__name__,
            )
            return None

    async def update_call_status(self, uuid: str, call_status: str) -> bool:
        """Atualiza o status final da chamada. Retorna True em sucesso (204)."""
        url = f"{self._base_url}/api/v1/alert-calls/by-uuid/{uuid}"
        try:
            async with aiohttp.ClientSession(timeout=self._timeout) as session:
                async with session.patch(
                    url, json={"callStatus": call_status}, headers=self._headers
                ) as resp:
                    if resp.status in (200, 204):
                        return True
                    logger.warning(
                        "PATCH alert-calls/by-uuid retornou status inesperado: %s (uuid=%s, status=%s)",
                        resp.status,
                        uuid,
                        call_status,
                    )
                    return False
        except aiohttp.ClientError as exc:
            logger.error(
                "Falha ao atualizar status da chamada (uuid=%s, status=%s): %s",
                uuid,
                call_status,
                type(exc).__name__,
            )
            return False
