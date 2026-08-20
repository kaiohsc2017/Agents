# Auditoria Completa AgentIA — 20/08/2026

Auditoria de segurança e qualidade (padrão OWASP Top 10 + CWE, critério SonarQube) em todas as
camadas do sistema: backend Java, FastAPI de Agentes, frontend React, banco de dados (schema +
relação tela↔tabela) e infraestrutura Docker/Asterisk. Executada por 5 agentes especialistas em
paralelo, cada um com leitura completa da sua camada. Nenhum arquivo foi alterado nesta sessão —
é o inventário para tratamento após aprovação. Complementa (não repete) `docs/AUDITORIA-2026-08-19.md`,
cujos achados já foram corrigidos.

| | |
|---|---|
| Escopo | Backend Java (176 arq.) · FastAPI Agentes (28 módulos) · Frontend (68 arq. TS/TSX) · 96 migrations Flyway · Docker/Asterisk |
| Placar | **5 CRÍTICOS** · 9 altos · 15 médios · 10 baixos |
| Método | Leitura dirigida por 5 agentes especialistas (security-reviewer, react-reviewer, database-reviewer) + verificação em produção onde possível (dialplan reload, docker inspect, npm audit) |

---

## 🔴 CRÍTICOS — ação imediata

### CR1 — Chaves de API de IA vazando sem autenticação nenhuma
**Arquivo:** `backend/src/main/java/com/asteriskia/config/SecurityConfig.java` (bloco `permitAll()`)

`/api/v1/ai/providers/*/key-internal` e `/api/v1/ai/chain/active` estão na lista de rotas
públicas (`permitAll()`, sem JWT). Qualquer pessoa na internet com a URL consegue ler a chave de
API do provedor de IA configurado (Gemini/OpenAI/Anthropic) sem nenhuma credencial.
**Correção:** remover essas duas rotas do `permitAll()` e aplicar `hasAuthority("ROLE_INTERNAL")`
(se forem chamadas só pelo `ai-agent`/serviço interno) ou RBAC granular `telecom.settings`. Após
a correção, **rotacionar imediatamente** toda chave de provedor de IA cadastrada no sistema.

### CR2 — SSRF sem nenhuma proteção em agente `web_monitor` (FastAPI)
**Arquivo:** `agents-platform/backend/executors/web_executor.py:57-115`

URL de monitoramento web é campo livre editável por qualquer usuário com `PERM_WRITE_agents.agents`
(não exige ADMIN). A requisição (`aiohttp`) não passa pelo guard de SSRF que já existe em
`notifier.py` — aceita `http://172.16.7.11:5432/` ou `http://169.254.169.254/latest/meta-data/`,
e a resposta (status/corpo) é refletida de volta no relatório de execução, visível a qualquer
usuário autenticado (agravado pelo CR3 abaixo).
**Correção:** extrair o guard `_is_safe_public_url` de `notifier.py` para um módulo compartilhado
e aplicá-lo em cada `check["url"]` antes do `session.get(...)`.

### CR3 — Listagem de execuções vaza saída de comando/SQL a qualquer usuário autenticado
**Arquivo:** `agents-platform/backend/routers/executions.py` (`GET /api/executions/`)

O detalhe de execução (`GET /{id}`) e os logs (`GET /{id}/logs`) são corretamente restritos a
ADMIN — mas a **listagem** (`GET /api/executions/`, `dashboard_summary`, `dashboard_period`,
`list_alerts`) não tem nenhum `Depends` de permissão e retorna `report_json` completo, incluindo
saída truncada de comandos SSH e queries SQL de qualquer servidor cadastrado por qualquer agente.
Contorna por completo a intenção documentada no próprio cabeçalho do arquivo.
**Correção:** aplicar `Depends(require_admin)` (ou `require_permission("agents.reports","read")`)
nessas 4 rotas, ou remover `report_json` da projeção da listagem.

### CR4 — CPF/CNPJ de todos os clientes exposto sem controle de acesso
**Combinação de achados:** `backend/.../ClientController.java` (RBAC — corrigido na sessão
anterior, mas `document VARCHAR(20)` sem `CHECK` nem mascaramento) + ausência histórica de
proteção de PII em `clients.document` (`V1__init_schema.sql:103`).

Mesmo após a correção de RBAC da auditoria anterior, o campo `document` (CPF/CNPJ) trafega em
claro na resposta de `GET /clients` para qualquer usuário com `PERM_READ_telecom.masterdata` —
sem mascaramento, sem `CHECK` de formato. Esta é a combinação de maior exposição de dado pessoal
encontrada no sistema.
**Correção:** mascarar o campo na resposta para perfis sem permissão elevada (ex: exibir só os
3 últimos dígitos) e adicionar `CHECK` de formato na coluna.

### CR5 — RTP não roteável para tráfego externo (produção)
**Arquivo:** `asterisk/config/rtp.conf:5-6` vs `docker-compose.yml:94`

O Asterisk está configurado para usar RTP na faixa `16000-16500`, mas o `docker-compose.yml` só
publica `16501-17000:16501-17000/udp` no host. Confirmado ao vivo via `docker port`/`docker inspect`:
nenhuma porta 16000-16500 está mapeada. Qualquer chamada com origem externa ao host Docker (tronco
real, softphone remoto) fica muda (RTP não chega) mesmo com a sinalização SIP funcionando.
**Correção:** alinhar `rtp.conf` para `16501-17000` (faixa já publicada) — evita também colisão
com `voipia-asterisk`, que já ocupa `16000-16500` no mesmo host.

---

## 🟠 ALTOS

| # | Camada | Achado | Correção |
|---|---|---|---|
| A1 | Java | `/alert-calls/**`/`/alert-contacts/**` sem RBAC granular — caem em `anyRequest().authenticated()`, mesma classe de gap já corrigida em outras 37 rotas | Adicionar matcher `telecom.modulo3` em `SecurityConfig.java` |
| A2 | Java | `tempToken` de pré-2FA aceito como Bearer JWT comum — bypass parcial de 2FA | Emitir `tempToken` com claim/escopo distinto e validar explicitamente que rotas normais rejeitam esse escopo |
| A3 | Java | IDOR em `ClientController` — mutação por `{id}` (PUT/DELETE) não valida se o cliente pertence à BU do usuário, só a listagem filtra | Validar `BusinessUnitContext` também nos endpoints de mutação por id, devolvendo 404 (não 403) |
| A4 | Python | JWT middleware não exige claim `exp` — token forjado sem expiração seria aceito indefinidamente | `options={"require": ["exp"]}` no `jwt.decode` (HTTP e WS) |
| A5 | Python | `POST /api/flows/{id}/run` vaza `str(e)` cru na resposta HTTP | Log detalhado no servidor + mensagem genérica ao cliente (mesmo padrão já usado em `llm.py`) |
| A6 | Python | Segredo JWT com fallback hardcoded `"changeme_dev_secret"` se a env var não estiver setada | Falhar o boot (`raise RuntimeError`) se `BACKEND_JWT_SECRET` ausente/igual ao literal de dev |
| A7 | Frontend | `websocket-driver` (dependência transitiva) com vulnerabilidade CRITICAL conhecida (DoS via compressão) | `npm audit fix` / atualizar a lib que traz a dependência |
| A8 | Frontend | 5 telas administrativas (Settings, Users, ModuloAlertas, AISettingsPanel, AdSyncTab) sem gating client-side de escrita (`hasWrite`) — backend bloqueia certo, mas UX inconsistente | Aplicar `useAuthSession().hasWrite(...)` nessas telas, mesmo padrão já usado em Cadastro0800/Operadoras/Linhas |
| A9 | BD | Secret SIP (`cc_agents.secret`, `app_users.sip_secret`) armazenado em texto plano no banco, sem criptografia em repouso | Cifrar com `pgcrypto`/chave de aplicação, ou restringir leitura da coluna por `REVOKE` |

---

## 🟡 MÉDIOS

| # | Camada | Achado | Correção |
|---|---|---|---|
| M1 | Java | Log de `pwd_len` (comprimento da senha) em toda tentativa de login, nível INFO sempre ativo | Remover `pwd_len` do log ou rebaixar para DEBUG |
| M2 | Java | `unban`/`removeWhitelist` não validam IP antes de repassar ao `ProcessBuilder` (sem RCE, mas inconsistente com `ban`/`addWhitelist`) | Aplicar `isValidIp()` nos 2 endpoints |
| M3 | Java | `AlertController.getAudio` sem `getCanonicalPath()` — defesa em profundidade ausente contra path traversal futuro | Normalizar e validar que o caminho resolvido está dentro de `audioStoragePath` |
| M4 | Python | `agent_secrets.value` em texto puro no banco (debt já documentado no schema) | Cifrar com Fernet/AES-GCM antes de persistir |
| M5 | Python | Nós `condition`/`rag` do Flow Canvas continuam fabricando resultado fixo (mesma classe do achado A1 já corrigido para os outros 6 nós) | Aplicar `NotImplementedError` explícito ou implementar de verdade (nunca `eval()` cru para condição) |
| M6 | Python | `created_by='admin'` hardcoded na criação de fluxo, quebra rastreabilidade de autoria | Usar `request.state.user` real |
| M7 | Python | Upload de "PDF" valida só extensão, não magic bytes — vetor de prompt injection indireto via base de conhecimento | Validar `data[:5] == b"%PDF-"` antes de extrair |
| M8 | Frontend | `xlsx`/`postcss`/`vite` com vulnerabilidades conhecidas (HIGH) em dependências | Migrar `xlsx` para build oficial SheetJS; `npm audit fix` nos demais |
| M9 | Frontend | 8 arquivos ainda acima de 500 linhas mesmo após a divisão anterior (ModuloConectividade, AISettingsPanel, Cadastro0800, ModuloAlertas, Users, Dashboard, Linhas, FlowCanvas) | Continuar extração de modais/sub-componentes |
| M10 | Frontend | Tipos `any` em `agents/types.ts` (`input_payload`/`output_payload`) e `FlowCanvas.tsx` (`subType as any`) | Tipar como `Record<string, unknown>` / usar union types já existentes |
| M11 | BD | `CHECK` de enum-like aplicado de forma inconsistente entre migrations (ex: `agents.auth_type` sem CHECK) | Padronizar CHECK em colunas de domínio fechado |
| M12 | BD | Maioria das FKs sem `ON DELETE` explícito — decisão implícita nunca documentada | Documentar convenção (RESTRICT + soft-delete) no topo de migration |
| M13 | BD | Falta de índices compostos `business_unit_id + data` nas tabelas de maior volume (`cc_interactions`, `cc_chat_sessions`) | Criar índices compostos |
| M14 | BD | `GET /users` sem paginação (`findAll()` puro) — cresce sem limite | Adicionar paginação, mesmo padrão já usado em `test-results` |
| M15 | Infra | `.env.example` com cabeçalho "VoipIA" e seções sem efeito nesta stack (`JIRA_*`, `CALLCENTER_*`, `AUDIOSOCKET_*`) — confunde provisionamento | Passar a limpo, removendo seções não aplicáveis ao AgentIA |

---

## 🟢 BAIXOS

- **B1** (Java) — `catch (Exception e)` genérico mascarando causa raiz em módulos de segurança (`FailToBanClient`, `AsteriskAclService`) — logar stacktrace completo, não só `e.getMessage()`.
- **B2** (Java) — mensagem de erro de fail2ban (`e.getMessage()`) propagada em resposta JSON ao cliente ADMIN — baixo risco, mas inconsistente.
- **B3** (Python) — `_extract_pdf_text` engole exceção sem log, dificulta auditoria de quantos "PDFs" não eram PDFs de fato.
- **B4** (Python) — canal "web" de alerta sempre marcado `delivered=True` mesmo sem confirmação de entrega real.
- **B5** (Python) — `orchestrator.py:run_agent` com ~170 linhas e múltiplas responsabilidades — extrair `_run_autofix`/`_maybe_chain`/`_calc_status`.
- **B6** (Frontend) — 2 botões-ícone sem `aria-label` (`Auditoria.tsx`, `Cadastro0800.tsx`).
- **B7** (Frontend) — `revealedPasswords` (Users.tsx) mantém senha em estado React além do necessário — limpar ao ocultar.
- **B8** (Frontend) — ~10 `setTimeout` de UI sem cleanup em `useEffect` (no-op silencioso em React 18+, mas resíduo de boa prática).
- **B9** (Frontend) — `agentsClient.ts` lê chave morta `asteriskia_token`, nunca escrita — remover fallback.
- **B10** (Infra) — nome do grupo Unix diverge entre host (`asteriskia-app`) e containers (`voipia-app`), mesmo GID — cosmético.

---

## ✅ Confirmações positivas (sem achado)

- **Java**: nenhuma injeção SQL/JPQL/LDAP; JWT sem confusão de algoritmo (HS256 forçado); `ProcessBuilder` sempre com lista de argumentos; os 37 matchers RBAC da sessão anterior cobrem corretamente leitura vs. escrita.
- **Python**: 100% das queries parametrizadas via asyncpg; `log_executor.py` usa `shlex.quote()` corretamente; guard de SSRF de `notifier.py` correto (só ausente em `web_executor.py`, CR2); CORS restrito, sem segredo hardcoded real.
- **Frontend**: zero `dangerouslySetInnerHTML`/`innerHTML`; refresh token corretamente fora do localStorage; sem race condition em fetch; `key` estável em listas; hooks com cleanup correto (exceto B8).
- **Banco**: nenhuma SQL injection possível (100% parametrizado); precisão numérica correta em todo o schema exceto o caso já corrigido (V94); segredos não vazam via `.env.example` (só placeholders).
- **Infra**: nenhum segredo real encontrado em varredura ampla do repositório; dialplan recarrega sem erro de sintaxe após as correções da sessão anterior.

---

## Ordem de execução recomendada

1. **CR1, CR2, CR3, CR4** — vazamento de dado/credencial, tratar como incidente (rotacionar chaves de IA após corrigir CR1).
2. **CR5** — RTP, impacta produção diretamente (áudio mudo em chamada externa).
3. **A1–A9** — RBAC residual, bypass de 2FA, IDOR, hardening de segredo.
4. **M1–M15** — qualidade e defesa em profundidade.
5. **B1–B10** — polimento.

Nenhuma correção foi aplicada nesta etapa — aguardando sua aprovação para eu iniciar o mesmo
processo de correção em paralelo já usado na auditoria anterior.

---

## Status: CORRIGIDO em 20/08/2026

Todos os achados foram corrigidos, **exceto CR4** (CPF/CNPJ sem mascaramento — mantido
intencionalmente por decisão do usuário; a exposição do RBAC em si já havia sido fechada na
auditoria anterior). Compilação validada (Java/Maven, Python, TypeScript) sem erros. CR5 foi
validado ao vivo em produção (`module reload res_rtp_asterisk.so` confirmado com sucesso).
Migrations novas: V97 (pgcrypto + convenção de FK) e V98 (índices compostos de BU no Call Center).
