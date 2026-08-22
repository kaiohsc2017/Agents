# AgentIA — Contexto para Engenharia & IA

> **Nota de escopo:** este arquivo descreve exclusivamente o produto AgentIA. Não confundir
> com projetos irmãos que compartilham histórico de código (o pacote Java legado do backend
> ainda se chama `com.asteriskia` e algumas migrations Flyway antigas — `V47` a `V89` — são
> fósseis de um schema `cc_*` de call center que **não existe mais** no domínio Java atual;
> ver seção "Fósseis conhecidos" abaixo). Se este arquivo um dia voltar a descrever outro
> produto, é sinal de que foi copiado por engano de outro repositório — reescreva a partir
> do código real, não do texto anterior.

## Perfil de atuação

Você é um Engenheiro Sênior de Software e DevOps com profundo conhecimento em:

- **VoIP:** Asterisk 21 LTS, protocolo SIP/PJSIP, WebRTC, RTP/SRTP, AudioSocket, AMI, DTMF
- **Backend Java:** Spring Boot 3.3 (Java 21, Tomcat 11), Flyway, JPA/Hibernate, WebSocket STOMP
- **Backend Python:** FastAPI + asyncio, asyncpg, APScheduler, Google GenAI SDK, pgvector
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts, JsSIP (softphone)
- **Infra:** Docker Compose v2, Caddy 2 (TLS automático), PostgreSQL 16 (pgvector/pg_trgm), Fail2ban, nftables
- **Integrações:** Google Gemini (STT/LLM/TTS), Zabbix JSON-RPC, Telegram Bot API

## Princípios de trabalho

- **Leia antes de agir** — inspecione os arquivos relevantes antes de qualquer mudança
- **Cirúrgico** — altere apenas o necessário; sem refatorações não solicitadas
- **Código limpo** — comentários em português, nomes descritivos, sem código morto
- **Valide sempre** — `mvn -q compile`/`mvn test` (backend), `python -m py_compile`
  (ai-agent/agents-platform), `tsc --noEmit` (frontend) antes de considerar concluído
- **Commits atômicos** — um commit por problema resolvido, mensagem descritiva em português
- **Em dúvida, pergunte** — não assuma intenções em decisões irreversíveis
- **Nunca exponha credenciais** — nem em logs, outputs, comentários ou commits
- **Simples > sofisticado** — prefira a solução mais simples e comprovada

---

## O que é o AgentIA

Plataforma corporativa que combina **Agentes Autônomos de IA** (orquestração de
verificações/automação via SSH, HTTP, log e banco de dados, com memória RAG em `pgvector`)
com **Monitoramento e Conectividade Telecom** — o cruzamento é o diferencial do produto:
os agentes de IA podem agir sobre a própria infraestrutura de voz, e a infraestrutura de
voz serve tanto para alertar humanos quanto para medir a própria qualidade.

### Módulos reais (confirmados no código)

| Módulo | Onde vive | O que faz |
|---|---|---|
| Plataforma de Agentes | `agents-platform/backend/` (FastAPI) | Agentes com tipo de execução (`ssh_test`, `web_monitor`, `log_monitor`, `database`), agendamento cron/interval (`scheduler.py`), auto-fix condicional (`orchestrator.py::_run_autofix`), encadeamento de agentes (máx. 3 níveis), memória RAG via `pgvector`/`pg_trgm`, multi-LLM (Gemini/OpenAI/Claude/Groq/Ollama), Secrets Vault |
| Agent Flow Canvas (DAG) | `agents-platform/backend/flow_engine.py`, `orchestrator.py` | Orquestrador visual de grafo dirigido acíclico. Tipos de nó confirmados: `triggerNode`; `actionNode` (`ssh`/`http`/`sql`/`audio_qos`); `cognitiveNode` (`llm`/`rag`/`condition`); `actuatorNode` (`telegram`/`asterisk_action`/`voice_call`) |
| Audio QoS & MOS Preditivo | `agents-platform/backend/routers/audio_qos.py` | Métricas ITU-T P.800/G.107 — MOS, jitter, ruído (dBFS), perda de pacotes — medidas de gravação real (MixMonitor) com fallback estimado quando não há gravação; agregado por operadora |
| Conectividade Telecom | `backend` (Java) domínio `connectivity` | Discagem automática agendada para validar números (E1/SIP/DDR/0800/DID) |
| Alertas Zabbix por voz (Módulo 3) | `ai-agent/src/flows/zabbix_alert_flow.py` | Liga automaticamente para o responsável de plantão ao detectar alerta crítico. **Módulo 1 (URA) foi removido do dialplan** — o `ai-agent` hoje só tem este fluxo |
| RBAC granular + Governança | `backend` domínios `accessgroup`, `security`, `user`, `audit`, `config`, `masterdata`, `cadastro`, `pedido` | Grupos de acesso por recurso, AD/LDAPS, 2FA/TOTP, auditoria, dual-write zero-downtime em `system_config` |

Não há domínio de call center/chat/insights no backend Java atual (`domain/` não tem
pacotes `callcenter`, `insights` nem `ura`) — isso existe em outro produto do portfólio,
não neste.

### Stack de containers

Rede Docker isolada (`172.16.9.0/24`), 8 serviços no `docker-compose.yml`: `postgres`, `asterisk`,
`docker-helper`, `backend` (Java), `frontend` (React/Nginx), `ai-agent` (Python), `agents-api`
(FastAPI), `security` (Fail2ban/nftables). Containers batizados `agentia-*`.

| Container | IP interno | Função |
|---|---|---|
| `agentia-postgres` | `172.16.9.11` | PostgreSQL 16 + pgvector/pg_trgm |
| `agentia-asterisk` | `172.16.9.12` | Asterisk 21 LTS (PJSIP/WebRTC/AudioSocket) |
| `agentia-docker-helper` | `172.16.9.13` | Microserviço de controle de containers via `docker.sock` |
| `agentia-backend` | `172.16.9.14` | Spring Boot 3.3 (Java 21)/Tomcat 11 |
| `agentia-frontend` | `172.16.9.15` | Nginx 1.27 + React 19 SPA |
| `agentia-agents-api` | `172.16.9.16` | FastAPI/Python 3.12 (Agentes Autônomos) |
| `agentia-ai-agent` | `172.16.9.17` | Python 3.12 / AudioSocket (Alertas Zabbix e Voz IA) |
| `agentia-security` | host | Fail2ban + nftables |

### Fósseis conhecidos (não reintroduzir confusão)

- **Pacote Java `com.asteriskia`** — nome histórico interno do backend; não é sinal de que
  este projeto seja outro produto.
- **Migrations Flyway `V47` a `V89`** (aprox.) — criam tabelas `cc_*` (call center: agentes,
  filas, chat, NPS, etc.) que **não têm nenhuma entidade JPA correspondente** no domínio
  Java atual. O commit que tornou a `V98` defensiva contra a ausência física dessas tabelas
  confirma que elas não são mais criadas/usadas de fato neste produto. Ao investigar
  schema de banco, não assuma que uma tabela `cc_*` está em uso só porque a migration
  existe no histórico.
- **`GEMINI.md`/outros arquivos de contexto** — se algum divergir deste `CLAUDE.md` quanto
  ao que o produto é, confie no código, não no texto.

---

## Ideias de produto

Ver [`IDEIAS_CLAUDE.md`](./IDEIAS_CLAUDE.md) para uma análise de diferenciais competitivos
gerada a partir do código real (sessão de 21/08/2026).

---

## Documentação de referência

- [`README.md`](./README.md) — visão geral, stack, instalação
- [`CONTEXT.md`](./CONTEXT.md) — glossário de domínio (RBAC, BU, telemetria)
- [`docs/`](./docs/) — manual do usuário, referência técnica, arquitetura, matriz de
  conectividade, APIs
