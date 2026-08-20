"""secrets_crypto.py — cifragem simétrica (Fernet) para agent_secrets.value.

Achado M4 da auditoria: agent_secrets.value era armazenado em texto puro no
banco (o próprio schema em database.py já admitia isso). Cifra o valor antes
de persistir (upsert_secret, routers/system.py) e decifra no momento de uso
pelo executor (orchestrator.py, ao montar agent["_secrets"]).

A chave vem de AGENT_SECRETS_ENCRYPTION_KEY (uma chave Fernet válida, 32 bytes
url-safe base64). Se a variável estiver ausente, a cifragem fica DESABILITADA
(fail-open deliberado, para não quebrar ambientes existentes que ainda não
configuraram a variável) — um aviso bem visível é logado no boot do módulo.

Valores cifrados são marcados com o prefixo ENC_PREFIX para que a leitura
distinga um valor cifrado de um valor legado gravado em texto puro antes desta
mudança (limitação conhecida, documentada abaixo — não há script de migração
de dados existentes nesta entrega, seria arriscado sem aprovação explícita).
"""
import logging
import os

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("asteriskia.secrets_crypto")

ENC_PREFIX = "enc:v1:"

_KEY = os.environ.get("AGENT_SECRETS_ENCRYPTION_KEY", "").strip()
_FERNET: Fernet | None = None

if _KEY:
    try:
        _FERNET = Fernet(_KEY.encode())
    except Exception as e:
        logger.error(
            "[secrets_crypto] AGENT_SECRETS_ENCRYPTION_KEY inválida (%s) — "
            "segredos de agente NÃO serão cifrados. Gere uma chave válida com "
            "Fernet.generate_key().", e,
        )
        _FERNET = None
else:
    logger.warning(
        "[secrets_crypto] AVISO DE SEGURANÇA: AGENT_SECRETS_ENCRYPTION_KEY não "
        "configurada — os segredos de agente (agent_secrets.value) estão "
        "sendo gravados EM TEXTO PURO no banco. Configure essa variável de "
        "ambiente (uma chave Fernet, gerada com "
        "`python -c \"from cryptography.fernet import Fernet; "
        "print(Fernet.generate_key().decode())\"`) para habilitar a cifragem."
    )


def is_encryption_enabled() -> bool:
    return _FERNET is not None


def encrypt_secret(value: str) -> str:
    """Cifra o valor antes de persistir. Sem chave configurada, devolve o
    valor original em texto puro (fail-open documentado acima)."""
    if _FERNET is None:
        return value
    token = _FERNET.encrypt(value.encode()).decode()
    return ENC_PREFIX + token


def decrypt_secret(stored_value: str) -> str:
    """Decifra um valor lido do banco. Reconhece tanto valores cifrados por
    esta versão (prefixo ENC_PREFIX) quanto valores legados em texto puro
    (gravados antes desta mudança, ou gravados com a cifragem desabilitada) —
    nesse segundo caso, devolve o valor como está, sem tentar decifrar."""
    if not stored_value.startswith(ENC_PREFIX):
        return stored_value
    if _FERNET is None:
        # Valor foi cifrado em algum momento em que a chave existia, mas agora
        # a chave sumiu do ambiente — não há como recuperar o texto original.
        logger.error(
            "[secrets_crypto] valor cifrado encontrado mas "
            "AGENT_SECRETS_ENCRYPTION_KEY não está configurada — não é "
            "possível decifrar."
        )
        return ""
    token = stored_value[len(ENC_PREFIX):]
    try:
        return _FERNET.decrypt(token.encode()).decode()
    except InvalidToken:
        logger.error("[secrets_crypto] token inválido/chave incorreta ao decifrar segredo.")
        return ""
