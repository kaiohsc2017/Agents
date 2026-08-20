"""config.py — Configuração do serviço ai-agent (Módulo 3: Alerta Zabbix).

Lê a configuração a partir das variáveis de ambiente injetadas pelo
docker-compose (que por sua vez resolve `${VAR}` a partir de `/opt/AgentIA/.env`
no host). Diferente do projeto irmão (que monta o `.env` dentro do container e
precisa de um cache com TTL para reagir a mudanças sem restart), aqui as
variáveis já chegam prontas no ambiente do processo — reler `os.environ` tem
custo desprezível, então o "cache" é só uma proteção contra falha silenciosa:
falha rápido (fail-closed) se um segredo obrigatório estiver ausente no boot,
em vez de degradar silenciosamente em runtime.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

logger = logging.getLogger("ai-agent.config")


class ConfigError(RuntimeError):
    """Erro de configuração obrigatória ausente — sempre fail-closed."""


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model_stt: str
    gemini_model_llm: str
    gemini_model_tts: str
    internal_api_key: str
    backend_url: str
    audiosocket_host: str
    audiosocket_port: int
    # Tempo máximo (segundos) esperando a resposta falada do atendente.
    listen_timeout_seconds: int
    # Timeout (segundos) para cada chamada HTTP ao backend Java.
    backend_timeout_seconds: float


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(
            f"Variável de ambiente obrigatória ausente: {name} "
            "— o ai-agent não pode iniciar sem ela (fail-closed)."
        )
    return value


def load_settings() -> Settings:
    """Carrega e valida a configuração uma única vez no boot do processo.

    Nunca loga o valor de nenhum segredo — só o nome da variável em caso de
    erro, mesma disciplina já usada no restante do projeto (ver CLAUDE.md).
    """
    settings = Settings(
        gemini_api_key=_require("GEMINI_API_KEY"),
        gemini_model_stt=os.environ.get("GEMINI_MODEL_STT", "gemini-2.5-flash"),
        gemini_model_llm=os.environ.get("GEMINI_MODEL_LLM", "gemini-2.5-flash"),
        gemini_model_tts=os.environ.get(
            "GEMINI_MODEL_TTS", "gemini-2.5-flash-preview-tts"
        ),
        internal_api_key=_require("INTERNAL_API_KEY"),
        backend_url=os.environ.get("BACKEND_URL", "http://backend:8080"),
        audiosocket_host=os.environ.get("AUDIOSOCKET_HOST", "0.0.0.0"),
        audiosocket_port=int(os.environ.get("AUDIOSOCKET_PORT", "9092")),
        listen_timeout_seconds=int(os.environ.get("LISTEN_TIMEOUT_SECONDS", "6")),
        backend_timeout_seconds=float(os.environ.get("BACKEND_TIMEOUT_SECONDS", "5")),
    )
    logger.info(
        "Configuração carregada: backend_url=%s audiosocket_port=%s "
        "gemini_model_stt=%s gemini_model_llm=%s gemini_model_tts=%s",
        settings.backend_url,
        settings.audiosocket_port,
        settings.gemini_model_stt,
        settings.gemini_model_llm,
        settings.gemini_model_tts,
    )
    return settings
