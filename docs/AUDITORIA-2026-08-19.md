# Auditoria AgentIA — 19/08/2026

Registro de trabalho da auditoria das oito camadas da aplicação. Nenhum item foi corrigido:
este documento é a lista para tratamento após aprovação.

| | |
|---|---|
| Commit base | `fcd4414` |
| Escopo | 176 arquivos Java · 28 Python · 68 TS/TSX |
| Placar | 3 críticos · 7 altos · 7 médios · 3 baixos · 6 sem ação |
| Relatório consolidado | https://claude.ai/code/artifact/b9a536b7-cd1f-4224-b8be-e2eb9ceda7cb |

Método: leitura dirigida de código por camada, comparação entre superfícies que precisam estar
sincronizadas (catálogo de recursos, matchers de segurança, rotas do dialplan x endpoints
existentes) e prova em produção onde o comportamento podia ser verificado sem alterar dados.
Nenhum registro foi criado ou alterado. Não houve teste de interface em navegador nem de carga.

---


## Camada A — FastAPI de Agentes (agents-platform/backend)

### A1 [CRÍTICO — integridade funcional] Flow Canvas: 6 de 12 tipos de nó são simulação, com mensagem de sucesso fabricada
`flow_engine.py`. Os nós `ssh`, `http`, `sql`, `telegram`, `asterisk_action` e `voice_call` não
executam nada — devolvem texto afirmando sucesso:
- ssh (l.52-58): `stdout = "[SSH Exec Output]: Comando '<cmd>' executado com sucesso no endpoint."`, `exit_code = 0`
- http (l.60-65): status 200 fixo, body `{"status":"ok"}`, URL default `https://httpbin.org/get`
- sql (l.67-71): sempre `[{"id":1,"status":"ONLINE","latency_ms":12}]`
- telegram (l.130-135): `sent = True`, nenhuma mensagem enviada
- asterisk_action (l.137-143): `"Tronco de contingência ativado com sucesso via AMI."` — nenhuma ação AMI
- voice_call (l.145+): idem
Reais hoje: `llm` (ask_llm), `rag`, `condition` e `audio_qos` (ligado nesta sessão).
Impacto: o histórico de execução e os relatórios afirmam que ações críticas ocorreram
(comutação de tronco, alerta ao NOC, comando remoto) quando nada aconteceu. Um operador
confiando nisso deixa de agir num incidente real. Agravante: `docs/MANUAL_DO_USUARIO.md`
descreve a "Auto-Cura no Flow Canvas" como funcionalidade real ("dispara a comutação de tronco
no Asterisk automaticamente"), e `docs/ARQUITETURA.md` idem.
Tratamento: decidir por nó — implementar de verdade ou rotular explicitamente como simulação
na UI/execução/documentação. Não deixar o meio-termo atual.

### A2 [ALTO — autorização] 15 rotas do FastAPI sem nenhuma checagem de permissão
Só exigem JWT válido (qualquer usuário, inclusive USER sem permissão de Agentes):
- `routers/flows.py` — 8 rotas, incluindo `POST /`, `PUT /{id}`, `DELETE /{id}` e
  `POST /{id}/run` (dispara execução e consome LLM pago)
- `routers/reports.py` — 4 rotas
- `routers/audio_qos.py` — 3 rotas (inclui `POST /analyze`, que grava no banco)
Comparar com `agents.py`/`servers.py`/`knowledge.py`/`system.py`/`llm_config.py`, que usam
`require_permission`. O RBAC granular existe (`auth.py`) e simplesmente não foi aplicado nesses
três routers. Mitigação atual involuntária: como os nós de ação são simulados (A1), não há RCE —
mas há CRUD indevido, execução e custo de LLM por usuário sem permissão.
Tratamento: aplicar `require_permission("agents.flows"|"agents.reports"|"telecom.qos", ...)`
por rota, leitura x escrita.

### A3 [MÉDIO — cobertura de teste] Zero testes automatizados no agents-platform e no frontend
`find` retorna 0 arquivos de teste em `agents-platform/` (28 módulos Python) e em
`frontend/src` (68 arquivos TS/TSX). O backend Java tem 37 arquivos de teste / 263 casos.
Regra do projeto exige 80% de cobertura. Todo o motor DAG, o motor acústico e as SPAs estão
sem rede de proteção.

## Camada B — Segurança do FastAPI

### B1 [ALTO — MITM] SSH sem verificação de host key em produção
`executors/common.py:_build_ssh_kwargs` usa `known_hosts=_SSH_KNOWN_HOSTS or None`, e
`SSH_KNOWN_HOSTS_FILE` **não existe** no `.env`, no `.env.example` nem no `docker-compose.yml`.
Em asyncssh, `known_hosts=None` desliga a validação. Toda conexão dos agentes e o
`POST /servers/{id}/test` aceitam qualquer chave de host — um atacante em posição de rede
recebe a senha SSH ou usa a chave privada importada. O próprio código registra warning a cada
conexão, então isso é conhecido e nunca foi configurado.
Tratamento: popular `SSH_KNOWN_HOSTS_FILE` com os hosts legítimos e falhar fechado (recusar
conexão) quando o arquivo não existir, em vez de degradar silenciosamente.

### B2 [MÉDIO — vazamento de informação] `str(e)` devolvido ao cliente
`routers/servers.py:69` (teste SSH) e `routers/llm_config.py:93` retornam `{"ok": false,
"error": str(e)}` direto na resposta HTTP. Exceções de asyncssh/aiohttp carregam host, usuário,
porta e às vezes a URL completa com parâmetros. Mesma classe de achado já corrigida antes neste
projeto em `llm.py` (que hoje trata corretamente, com comentário explicando).
Tratamento: mensagem genérica ao cliente + detalhe apenas no log do servidor.

### B3 [POSITIVO — sem ação] Pontos que auditei e estão corretos
- Nenhuma query SQL montada por concatenação/f-string: tudo parametrizado ($1, $2) via asyncpg.
- Guard de SSRF em `notifier.py` presente e correto (bloqueia privado/loopback/link-local/
  reserved/multicast, `allow_redirects=False`).
- `llm.py` não vaza a API key (header `x-goog-api-key`, erro genérico ao usuário).

## Camada C — Backend Java (Spring Boot)

### C1 [CRÍTICO — autorização] ~37 rotas do backend Java sem checagem de permissão
`SecurityConfig` tem matcher próprio para 18 caminhos; a cadeia termina em
`anyRequest().authenticated()`. Nenhum dos controllers abaixo tem `@PreAuthorize`, logo
**qualquer usuário autenticado — inclusive um USER com a matriz `perm` vazia — tem acesso
total, leitura e escrita**:

| Controller | Rotas | Base | Risco concreto |
|---|---|---|---|
| ConnectivityController | `/number-tests`, `/test-results` | Módulo 2 | **Cadastrar número e agendar discagem automática** — uso do tronco SIP para ligar a números arbitrários (custo/toll fraud/assédio) |
| AdSyncController | 6 (`/ad/**`) | Active Directory | Disparar sync LDAP, consultar usuários do AD, criar/remover mapeamento de grupo → caminho indireto para conceder privilégio |
| ClientController | 7 | Cadastros | CRUD de clientes |
| OperationController | 6 | Cadastros | CRUD de operações |
| SegmentController | 4 | Cadastros | CRUD de segmentos |
| BusinessUnitController | 4 | Cadastros | CRUD de BUs — o próprio eixo do controle de acesso por BU |
| SystemConfigController | 3 | `/config` | Leitura/escrita de configuração |
| StatsController, ReportController, SuporteController | 6 | Dashboards/Jira | Leitura de indicadores; abertura de chamado real no Jira |

**Comprovado em produção** com JWT `role=USER`, `perm={}` (forjado com o segredo real, sem criar
usuário): `GET /clients`, `/operations`, `/segments`, `/business-units`, `/number-tests`,
`/config`, `/ad/sync-status`, `/ad/group-mappings` → **200**. `POST` em `/clients`,
`/operations`, `/segments`, `/number-tests` → **400** (erro de validação de payload), não 403 —
prova de que a autorização deixou passar e só o corpo da requisição barrou.
Mesma classe de falha já corrigida duas vezes neste projeto (`/api/v1/internal/**` na Fase 23,
`/callcenter/reports/schedules/**` em 2026-08-15): o padrão de "matcher explícito por rota" não
foi aplicado às rotas restantes.
Tratamento: matcher por rota em `SecurityConfig` com `PERM_READ_*`/`PERM_WRITE_*` no
`resource_key` correspondente (`telecom.modulo2`, `telecom.masterdata`/`clients`, `telecom.users`
para AD, etc.) — e criar os resource_keys que faltarem no catálogo.

### C2 [ALTO — RBAC] `telecom.security` e `telecom.docs` órfãos; catálogo x rotas desalinhados
`telecom.security` está no catálogo e protege `/api/v1/security/**`, mas **não existe item de
menu** que o use no frontend (nenhum `resource:` em AppLayout) — logo ninguém além de ADMIN
consegue enxergar/gerir Segurança & Firewall, e a permissão é inconcedível na prática pela UI.
Inverso do problema A2/C1: aqui a permissão existe e a tela não.
Além disso, 4 `resource_keys` seguem órfãos no banco (`financeiro.ura`, `telecom.docs`,
`telecom.masterdata`, `telecom.modulo1`) — serão apagados na próxima edição de qualquer grupo.
Tratamento: decidir por chave — remover do catálogo/banco ou ligar à tela correspondente.

### C3 [MÉDIO — escopo por BU] `SegmentController` não aplica escopo de BU
`ClientController` e `OperationController` usam `MasterDataScopeFilter` (6 referências cada);
`SegmentController` tem zero — lista `segRepo.findAll()` sem filtro. Cadastros de segmento de
todas as BUs ficam visíveis a qualquer usuário restrito.

### C4 [POSITIVO — sem ação] Verificado e correto no Java
- Nenhuma query montada por concatenação de entrada (JPA/`@Query` parametrizados).
- Nenhum segredo em log: os `log.*` que mencionam chave/token registram apenas o **nome** da
  chave e quem alterou, nunca o valor.
- `ReportCsvBuilder.esc()` previne injeção de fórmula em CSV (prefixa apóstrofo).
- `InternalKeyFilter` + matcher `/api/v1/internal/**` = `ROLE_INTERNAL` corretos.

## Camada D — Frontend (SPA Telecom + Agentes)

### D1 [ALTO — sessão] Duas chaves de token em paralelo: logout parcial e token defasado
`Login.tsx` grava o mesmo JWT em **quatro** chaves (`voipia_token`/`voipia_user` legadas +
`agentia_token`/`agentia_user`). A partir daí:
- `api/client.ts` **lê apenas** `voipia_token` (l.25) e, ao renovar a sessão, grava apenas
  `voipia_token` (l.73) — `agentia_token` fica congelado no token antigo.
- `App.tsx`, `Login.tsx`, `ModuloLogs.tsx` leem `agentia_token || voipia_token`, isto é,
  preferem justamente a chave defasada → a SPA pode operar com token expirado enquanto o axios
  usa o renovado (403 intermitente sem causa aparente).
- `client.ts:122-123` (revoke/logout do interceptor) remove **só** as chaves `voipia_*`,
  deixando um JWT válido em `agentia_token` no navegador depois do logout. `App.tsx` limpa as
  quatro, então o comportamento depende de qual caminho de logout foi usado.
Tratamento: uma única chave canônica, com migração da legada, e um único ponto de leitura/
escrita/limpeza.

### D2 [BAIXO — observabilidade] Erros silenciados
`App.tsx:178`, `ModuloConectividade.tsx:150` e `client.ts:104` usam `.catch(() => {})`. O do
`ModuloConectividade` é justamente o carregamento do Audio QoS por teste — se falhar, a linha
fica sem MOS e ninguém sabe por quê.

### D3 [POSITIVO — sem ação] Nenhum `innerHTML`/`dangerouslySetInnerHTML` em nenhuma das SPAs —
sem superfície de XSS por renderização de conteúdo do usuário.

## Camada E — Infraestrutura

### E1 [ALTO — operacional] O `Caddyfile` deste repositório NÃO é o que está em produção
`agentia.voiphash.com.br` é servido pelo container **`asteriskia-caddy`** (stack
`/opt/AsteriskIA`), que monta `/opt/AsteriskIA/Caddyfile`. O `docker-compose.yml` do AgentIA
**não tem serviço caddy**, e `/opt/AgentIA/Caddyfile` (9,7 KB, versionado, com CSP e headers)
está divergente do arquivo realmente carregado — confirmado por `cmp`.
Consequências: (a) editar o Caddyfile deste repo não produz efeito nenhum, e nada avisa;
(b) o TLS e o roteamento do domínio dependem de uma stack de outro projeto — um
`docker compose down` em `/opt/AsteriskIA` derruba o AgentIA junto; (c) a versão versionada
pode divergir silenciosamente da que atende o tráfego (já divergiu).
Boa notícia: o bloco em uso tem HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy` e CSP em
**enforcement** (não Report-Only), sem `unsafe-inline` em `script-src`.
Tratamento: decidir a topologia — Caddy próprio no compose do AgentIA, ou remover o Caddyfile
do repo e documentar que o proxy é externo (com o arquivo real sob controle de versão em algum
lugar). O estado atual (dois arquivos, um deles inerte) é armadilha garantida.

### E2 [MÉDIO — isolamento] Três stacks completas dividem o mesmo host e o mesmo domínio-base
O host roda simultaneamente `agentia-*` (7 containers), `voipia-*` (10, incluindo Postgres,
Asterisk e coturn próprios), `asteriskia-caddy` e `echweb-*` (4, com SQL Server). Nesta VPS de
2 vCPU / 3.8 GB já em swap, isso é contenção real de CPU/RAM/I-O e explica lentidão difusa.
Há ainda dois Asterisk ativos (`agentia-asterisk` publicando 5062, `voipia-asterisk` provavelmente
em 5060) e dois Postgres.
Tratamento: decisão de infraestrutura, não de código — desativar o que estiver obsoleto ou
separar em hosts. Registrado porque afeta diagnóstico de qualquer problema de performance.

### E3 [MÉDIO — hardening] `docker-helper` monta `docker.sock` e roda root
`/var/run/docker.sock` montado (l.121) equivale a root no host. É o mesmo débito já
documentado e justificado no projeto (de-rootizar não muda o risco real), mas continua sendo o
container de maior impacto em caso de comprometimento. `asterisk` e `security` também root
(portas privilegiadas / `NET_ADMIN` / `network_mode: host`).
Positivo: `backend`, `agents-api` e `frontend` rodam como usuário não-root; todos os 7 serviços
têm limites de memória/CPU; Postgres publicado apenas em `127.0.0.1:5435`.

## Camada F — Banco de dados

### F1 [BAIXO — performance] 12+ chaves estrangeiras sem índice
`number_tests(business_unit_id, client_id, operation_id, segment_id)`,
`numeros_0800(client_id, operadora_id)`, `linhas(operation_id, operadora_id)`,
`alert_contacts(operation_id)`, `alerts(execution_id)`,
`agents(on_failure_trigger_agent_id)`, `numero_0800_regenerados(operadora_id)`.
Toda consulta/JOIN por esses campos faz varredura sequencial, e `DELETE` no pai varre o filho.
Irrelevante no volume atual; degrada linearmente.

### F2 [POSITIVO — sem ação] 50 tabelas, nenhuma migration com `success=false`, e **nenhuma outra
coluna `numeric(4,2)`** — o overflow corrigido na V94 era o único caso desse tipo no schema.

## Camada G — Asterisk / dialplan

### G1 [CRÍTICO — funcionalidade ausente] Módulo 1 (URA/IA de voz) e Módulo 3 (Alertas Zabbix)
não têm o serviço que os executa nesta stack
O dialplan chama `AudioSocket(${MY_UUID},ai-agent:9092)` em **9 pontos** (ramais 1000, 1001,
faixa `_2XXX` das URAs, contextos `[asteriskia-jira]` e `[asteriskia-alert]`), mas:
- não existe serviço `ai-agent` no `docker-compose.yml` do AgentIA;
- o nome **não resolve** na rede do container Asterisk (verificado com `getent hosts`);
- o diretório `ai-agent/` não existe no repositório.
Qualquer ligação para a URA ou para o alerta de voz falha no `AudioSocket` — atende, grava e
morre sem interação. Ainda assim, `docs/MANUAL_DO_USUARIO.md` e `docs/ARQUITETURA.md` descrevem
os dois módulos como operacionais.
Tratamento: decidir se esses módulos fazem parte do AgentIA. Se sim, trazer o serviço `ai-agent`
para a stack; se não, remover contextos/ramais do dialplan e as seções correspondentes da
documentação. Hoje o sistema promete uma capacidade que não existe.

### G2 [ALTO — dialplan herdado] 5 endpoints internos chamados pelo dialplan não existem no backend
O dialplan invoca via CURL: `/internal/ura-routing`, `/internal/callcenter/recordings`,
`/internal/callcenter/queue-recording-config`, `/internal/callcenter/outbound-start` e
`/internal/callcenter/outbound-end`. O backend do AgentIA só implementa
`/internal/connectivity/**` (criado nesta sessão). Como o dialplan não trata erro de CURL, cada
chamada falha silenciosamente e o fluxo segue com variável vazia — exatamente o modo de falha
que já produziu o bug do `REC_CONFIG` no histórico do projeto.
Consequência prática: os contextos de fila (`_5XXX`), `[nps]` e a resolução multi-URA são código
morto que aparenta funcionar. O dialplan foi herdado do VoipIA sem poda.
Tratamento: remover do dialplan tudo que depende de módulo inexistente (Call Center/NPS/URA
multi-instância) ou reintroduzir os endpoints.

### G3 [POSITIVO — sem ação] AMI restrito por ACL (`deny 0.0.0.0/0` + permit apenas redes
privadas), nenhum `allow_guest`/SIP anônimo no `pjsip.conf.template`, RTP em faixa dedicada
(16501-17000), SIP publicado em 5062 (não 5060, evitando colisão com a stack vizinha).

## Camada H — Qualidade, código morto e coerência

### H1 [ALTO — credencial] Senha do softphone WebRTC é uma fórmula previsível
`UserController.java:275` — `GET /users/{id}/extension-password` devolve
`"webrtc" + extension + "pass"`. Qualquer pessoa que saiba o ramal deduz a senha SIP sem
consultar nada. Débito pré-existente já registrado no histórico do projeto e nunca resolvido.
Agravante nesta stack: `useSipPhone.ts` tenta primeiro
`GET /callcenter/agentes/me/sip-credentials`, que **retorna 404** (não existe nenhuma classe de
call center neste backend — 0 arquivos), então o softphone cai sempre no caminho legado
`VITE_SIP_PASSWORD`/fórmula.
Tratamento: secret aleatório por ramal, persistido e espelhado no `PsAuth`, com rotação.

### H2 [MÉDIO — superfície de abuso] Rate limiting cobre apenas 2 rotas
`RateLimitFilter.LIMITED_PATHS` = `{/auth/login, /auth/totp/verify}` (10 tentativas / bloqueio
de 5 min). Todo o resto da API — incluindo as 37 rotas sem RBAC do achado C1, o disparo de
execução de fluxo (A2) e o `POST /audio-qos/analyze` — não tem limite algum.

### H3 [BAIXO — organização] Três arquivos acima do limite de 800 linhas definido nas regras do
projeto: `ModuloConectividade.tsx` (932), `data/releases.ts` (815), `Settings.tsx` (805).

### H4 [MÉDIO — documentação divergente] A documentação descreve como operacionais recursos que
não existem nesta stack
Além de G1 (URA/Zabbix sem `ai-agent`) e A1 (nós de fluxo simulados):
`docs/REFERENCIA_TECNICA.md` e `MANUAL_DO_USUARIO.md` citam Call Center/softphone de agente,
enquanto o backend não tem uma única classe de call center e a rota de credencial SIP dá 404.
Tratamento: passar a documentação a limpo contra o que a stack realmente entrega.

### H5 [POSITIVO — sem ação] Nenhum TODO/FIXME pendente no código; nenhuma injeção SQL;
suíte Java com 263 casos verdes; CSP em enforcement; segredos fora do repositório
(`.gitignore` cobre `.env` e os `.conf` gerados — confirmado com `git ls-files`).
