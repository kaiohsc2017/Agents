# =============================================================
# Dockerfile — ai-agent (Módulo 3: Alerta Zabbix por voz)
# Servidor AudioSocket asyncio (Python 3.12) + Gemini STT/LLM/TTS.
# =============================================================

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

# Não-root desde o início (mesmo padrão GID 1500 / grupo "asteriskia-app" já
# usado por backend/agents-backend neste repo — ver docker-compose.yml e
# CLAUDE.md). Este serviço não precisa ler nenhum caminho do host além das
# variáveis de ambiente injetadas pelo compose, então não há bind mount a
# ajustar de permissão — o GID compartilhado é mantido só por consistência
# operacional (mesmo UID/GID scheme dos outros containers Python/Java).
RUN groupadd -g 1500 asteriskia-app 2>/dev/null || true && \
    useradd -u 1502 -g asteriskia-app -M -s /usr/sbin/nologin aiagent && \
    chown -R aiagent:asteriskia-app /app

USER aiagent

EXPOSE 9092

WORKDIR /app/src
CMD ["python", "main.py"]
