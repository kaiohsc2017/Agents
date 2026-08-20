"""ssrf_guard.py — guard compartilhado contra SSRF (Server-Side Request Forgery).

Extraído de notifier.py (achado de segurança original: notify_webhook_url é
campo livre, editável por qualquer usuário com PERM_WRITE_agents.agents — sem
esta checagem, alguém aponta pra 172.16.7.11:5432 ou 169.254.169.254 e força o
container a fazer a requisição). Reusado também por executors/web_executor.py
(campo checks[].url, mesma classe de risco).

Resolve o host e bloqueia qualquer IP privado/loopback/link-local/reservado/
multicast antes de permitir a requisição real.
"""
import asyncio
import ipaddress
import socket
from urllib.parse import urlparse


async def is_safe_public_url(url: str) -> bool:
    """Retorna True só se a URL resolver para um host público de verdade.

    Bloqueia esquema diferente de http/https, host ausente, e qualquer IP
    (IPv4 ou IPv6) privado/loopback/link-local/reservado/multicast resolvido
    via DNS — nunca confia em validação sintática da string da URL sozinha.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        infos = await asyncio.to_thread(socket.getaddrinfo, parsed.hostname, None)
        for family, _, _, _, sockaddr in infos:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:
        return False
