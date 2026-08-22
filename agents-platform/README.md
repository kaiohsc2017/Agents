# Plataforma de Agentes Autônomos IA — AgentIA

Plataforma de agentes autônomos de Inteligência Artificial integrada nativamente ao ecossistema **AgentIA**.

---

## 🌐 Acesso Integrado

A interface dos Agentes agora é **100% nativa** dentro da SPA do AgentIA, adotando o design system corporativo do **AgentIA**:
```
https://agentia.voiphash.com.br/#agDashboard
```

Menus disponíveis diretamente na barra lateral:
- 📊 **Dashboard:** Métricas em tempo real, disponibilidade por período e execuções recentes.
- 🤖 **Agentes:** CRUD de robôs autônomos, disparos manuais, logs e agendamento.
- 🖥️ **Servidores:** Gestão de hosts SSH com teste de conectividade ao vivo.
- 📚 **Base de Conhecimento (RAG):** Upload de manuais/SOPs em PDF indexados via `pgvector`.
- 💻 **Logs:** Console terminal detalhado com streaming em tempo real via WebSocket.
- 🚨 **Alertas:** Registro de disparos e notificações para Telegram, E-mail e Webhooks.
- 🔑 **Secrets Vault:** Armazenamento seguro de senhas e tokens consumidos como `{{CHAVE}}`.
- ⚙️ **Configurações de IA:** Seleção de provedores (Gemini, Claude, OpenAI, Ollama) com teste de prompt.

---

## 🛠️ Stack & Arquitetura

| Camada | Tecnologia | Componente / Localização |
|---|---|---|
| **Frontend UI** | React 19 + TypeScript (`strict`) + Tailwind + shadcn/ui | `frontend/src/components/agents/` |
| **Backend API** | FastAPI + Python 3.12 (asyncpg, APScheduler, Google GenAI SDK) | `agents-platform/backend/` (`agentia-agents-api:8000`) |
| **Banco de Dados** | PostgreSQL 16 com `pgvector` e `pg_trgm` | `agentia-postgres:5432` (schema compartilhado) |
| **WebSockets** | WebSockets assíncronos (`/agents/ws/logs/{agent_id}`) | Nginx Proxy → FastAPI |

---

## 🤖 Tipos de Agente

- **`ssh_test`** — Conecta via SSH em servidores externos e executa verificações configuradas com auxílio de IA em caso de falhas.
- **`web_monitor`** — Monitora URLs HTTP/HTTPS com validação de status code, tempo de resposta e conteúdo de payloads JSON.
- **`log_monitor`** — Realiza varreduras inteligentes em arquivos de log de aplicações em busca de padrões anômalos.
- **`database`** — Executa queries PostgreSQL e valida limites operacionais (`expect_lt`, `expect_gt`, `expect_zero`).

---

## 🧠 Memória & RAG

Cada agente possui memória persistente no PostgreSQL com embeddings armazenados na tabela `knowledge_docs` (`pgvector`). Quando uma falha é detectada, o agente consulta a base de conhecimento e a memória de outros agentes antes de tomar decisões corretivas.

---

## 🔒 Variáveis de Ambiente & Autenticação

O backend de agentes valida autenticação JWT compartilhada com o backend Spring Boot (`BACKEND_JWT_SECRET`) e respeita as permissões do RBAC do usuário (`agents.*`).

As configurações de LLM e chaves de API são gerenciadas em tempo de execução via interface web ou no arquivo `env/.env`:
```env
AGENTS_LLM_PROVIDER=google        # google | anthropic | openai | minimax | openai_compat
AGENTS_LLM_MODEL=gemini-2.5-flash
AGENTS_LLM_ENABLED=true
AGENTS_LLM_GOOGLE_KEY=AIzaSy...
```
