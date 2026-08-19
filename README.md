# AgentIA

Plataforma corporativa de **Agentes Autônomos de Inteligência Artificial + Monitoramento e Conectividade Telecom**, integrando **Asterisk 21 LTS + FastAPI + Spring Boot 3.3 (Java 21) + React 19** em arquitetura conteinerizada de Alta Disponibilidade (HA).

---

## 📌 Visão Geral dos Módulos

| Módulo | Descrição |
|--------|-----------|
| 🤖 **Plataforma de Agentes Autônomos** | Orquestração de agentes autônomos de IA (SSH, Web, Logs, DB, RAG via pgvector/pg_trgm, Secrets Vault e Multi-Model LLM: Gemini, OpenAI, Claude, Groq). |
| 📞 **Conectividade Telecom** | Testes programados e periódicos de conectividade de números telefônicos (E1, SIP, DDR, 0800 e DID) com discagem ativa e telemetria. |
| 🚨 **Monitoramento & Alertas (Zabbix)** | Captura de alarmes críticos de infraestrutura via Zabbix API → disparo de ligação telefônica automatizada + notificação Telegram. |
| 👥 **Governança, RBAC & Cadastros** | Gestão de usuários, grupos de acesso granulares (RBAC por recurso), sincronização Active Directory (LDAPS), 2FA/TOTP, Trilha de Auditoria, Operadoras e Linhas. |

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 19 + TypeScript (`strict`) + Vite + Tailwind CSS + shadcn/ui + Recharts + Softphone WebRTC (JsSIP) |
| **Backend Core** | Spring Boot 3.3 (Java 21) — WAR no Apache Tomcat 11 + WebSocket STOMP + Flyway |
| **Agentes API** | FastAPI + Python 3.12 (asyncio, asyncpg, APScheduler, Google GenAI SDK) |
| **Telefonia / PBX** | Asterisk 21 LTS — chan_pjsip + app_audiosocket + WebRTC + AudioSocket |
| **Banco de Dados** | PostgreSQL 16 com extensões `pgvector`, `pg_trgm` e `uuid-ossp` |
| **Proxy Reverso & TLS** | Caddy 2 — TLS automático (Let's Encrypt / ZeroSSL) e Proxy WebSocket/HTTP |
| **Segurança / DevSecOps** | Fail2ban + nftables (Lockdown SIP) + Argon2id + JWT Seguro + Zero Secrets |
| **Infraestrutura** | Docker Compose v2 — 7 containers em rede isolada `172.16.7.0/24` |

---

## 📋 Requisitos de Sistema

- **Sistemas Operacionais Homologados:** Ubuntu 22.04/24.04 LTS ou Oracle Linux 9 (UEK/RHEL).
- **Docker:** Versão 24+ com plugin Docker Compose v2.
- **Hardware Mínimo Recomendado:** 4 vCPUs, 8 GB RAM, 40 GB SSD.
- **Rede:** Acesso de saída HTTPS para APIs de IA e portas SIP/RTP liberadas.

---

## 🚀 Instalação e Inicialização

```bash
# Clone o repositório
git clone https://github.com/kaiohsc2017/Agents.git /opt/AgentIA
cd /opt/AgentIA

# Configuração de variáveis de ambiente
cp env/.env.example env/.env
# Ajuste as chaves e credenciais no arquivo env/.env

# Inicialização dos containers
docker compose up -d --build
```

---

## 🌐 Mapeamento de Serviços e URLs

| Serviço | Rota / URL | Descrição |
|---------|------------|-----------|
| **Painel AgentIA** | `https://app.voiphash.com.br` | Interface SPA unificada com padrão ReportECH |
| **Plataforma de Agentes** | `https://app.voiphash.com.br/agents/` | Módulo embutido de gestão de agentes e execuções |
| **Documentação Técnica** | `docs/` | Guias de implantação, arquitetura, manual e APIs |

---

## 📦 Arquitetura de Containers

| Container | IP Interno | Função |
|-----------|------------|--------|
| `agentia-frontend` | `172.16.7.15` | Nginx 1.27 servindo React SPA + Proxy interno |
| `agentia-backend` | `172.16.7.14` | Spring Boot 3.3 (Java 21) / Tomcat 11 |
| `agentia-agents-api` | `172.16.7.16` | FastAPI / Python 3.12 (Agentes Autônomos) |
| `agentia-asterisk` | `172.16.7.12` | Asterisk 21 LTS (PJSIP / WebRTC / AudioSocket) |
| `agentia-docker-helper` | `172.16.7.17` | Microserviço seguro de controle de containers |
| `agentia-postgres` | `172.16.7.11` | PostgreSQL 16 + pgvector / pg_trgm |
| `agentia-security` | Host | Fail2ban + nftables (Lockdown de portas de voz) |

---

## 🔒 Variáveis de Ambiente Principais (`env/.env`)

| Variável | Descrição |
|----------|-----------|
| `SIP_PUBLIC_IP` | IP público do servidor (obrigatório para WebRTC e RTP) |
| `GEMINI_API_KEY` | Chave de API do Google AI Studio para os agentes |
| `BACKEND_JWT_SECRET` | Chave secreta de assinatura JWT compartilhada |
| `POSTGRES_PASSWORD` | Senha da base de dados PostgreSQL |
| `SIP_TRUNK_HOST` | IP ou FQDN do tronco SIP da operadora |
| `ZABBIX_API_URL` | URL de integração com a API do Zabbix |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram para alertas |

---

## 📚 Documentação Técnica Completa

Os documentos detalhados estão disponíveis no diretório [`docs/`](file:///opt/AgentIA/docs):
- [Manual do Usuário](file:///opt/AgentIA/docs/MANUAL_DO_USUARIO.md)
- [Referência Técnica](file:///opt/AgentIA/docs/REFERENCIA_TECNICA.md)
- [Arquitetura de Solução](file:///opt/AgentIA/docs/ARQUITETURA.md)
- [Matriz de Conectividade & Portas](file:///opt/AgentIA/docs/MATRIZ_DE_CONECTIVIDADE.md)
- [Documentação das APIs REST](file:///opt/AgentIA/docs/DOCUMENTACAO_DAS_APIS.md)
- [Guia de Implantação (Ubuntu & Oracle Linux 9)](file:///opt/AgentIA/docs/IMPLANTACAO.md)

