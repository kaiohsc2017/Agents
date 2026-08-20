# Auditoria de Infraestrutura — AgentIA (20/08/2026)

Escopo: `docker-compose.yml`, Dockerfiles, `.env.example`, configs Asterisk (`pjsip.conf.template`,
`extensions.conf`, `rtp.conf`, `http.conf`), estado real dos containers (`docker ps`/`docker inspect`),
Caddyfile real vs repositório, varredura de segredos. Somente leitura — nenhum arquivo alterado.

Auditoria anterior: `docs/AUDITORIA-2026-08-19.md` (RBAC, dialplan morto — já corrigidos/documentados).
Os itens E1/E2/E3 dela foram apenas **reconfirmados** abaixo, sem repetir a descrição.

---

## Reconfirmação dos itens de decisão (E1/E2/E3) — ainda procedem

- **E1** — confirmado via `cmp`/`diff`: `/opt/AgentIA/Caddyfile` (9770 bytes) diverge do
  `/opt/AsteriskIA/Caddyfile` real a partir da linha 22 — o bloco `app.voiphash.com.br` no repo
  do AsteriskIA está **inteiramente comentado** ("DESATIVADO"), enquanto o do AgentIA está ativo.
  `docker ps` confirma `asteriskia-caddy` é quem publica `0.0.0.0:80`/`0.0.0.0:443` — o compose do
  AgentIA não tem serviço `caddy`. Editar `/opt/AgentIA/Caddyfile` continua sem efeito algum.
- **E2** — confirmado: `docker ps` lista simultaneamente as stacks `agentia-*` (8), `voipia-*` (10),
  `echweb-*` (4, com `mssql/server:2022`) e `asteriskia-caddy`, todas `healthy`, todas há 58 minutos
  (boot conjunto do host). Dois Asterisk (`agentia-asterisk` em 5062, `voipia-asterisk` em 5061),
  dois Postgres (`5435`/`5434`, ambos só em `127.0.0.1`).
- **E3** — confirmado: `docker-helper/Dockerfile` monta `/var/run/docker.sock` e roda como root
  (sem `USER`); `asterisk/Dockerfile` compila um binário `asterisk` mas o container roda o
  entrypoint como root (sem `USER asterisk` no runtime final apesar de criar o usuário `asterisk`);
  `security/Dockerfile` não define `USER` (root), com `network_mode: host` + `NET_ADMIN`/`NET_RAW`.

---

## Achados NOVOS

### 🔴 CRITICAL — Faixa de porta RTP configurada dentro do Asterisk não bate com a faixa publicada no host (áudio quebrado para tráfego externo)

- `asterisk/config/rtp.conf:5-6` — `rtpstart = 16000` / `rtpend = 16500` (confirmado também
  dentro do container real: `docker exec agentia-asterisk cat /etc/asterisk/rtp.conf`).
- `docker-compose.yml:94` — só publica `"16501-17000:16501-17000/udp"`.
- `docker port agentia-asterisk` confirma: **nenhuma** porta em 16000-16500/udp está mapeada
  para o host (`docker inspect` mostra as 501 portas de 16000-16500 com `HostPort: null`); só
  16501-17000 têm bind real em `0.0.0.0`.
- Como o Asterisk sempre negocia RTP dentro do range configurado em `rtp.conf` (16000-16500), e
  o Docker só encaminha tráfego UDP de entrada para as portas efetivamente publicadas
  (16501-17000), **todo pacote RTP de retorno endereçado a uma porta escolhida pelo Asterisk
  nunca chega ao container** — qualquer chamada com mídia vinda de fora do host Docker (tronco
  SIP real, softphone WebRTC via internet, ramal físico) fica sem áudio (one-way ou mudo total),
  mesmo com sinalização SIP funcionando perfeitamente. Isso explica de forma plausível qualquer
  relato futuro de "liga mas não tem áudio" nesta stack — é um bug de infraestrutura, não de
  aplicação.
- Este é exatamente o tipo de config residual herdada do template VoipIA (que usa 16000-16500 em
  produção, ver `CLAUDE.md` da AgentIA) sem ter sido ajustada quando o `docker-compose.yml` do
  AgentIA foi deliberadamente publicado em 16501-17000 (para não colidir com `voipia-asterisk`,
  que já usa 16000-16500 no mesmo host — confirmado em `docker ps`: `voipia-asterisk` publica
  `0.0.0.0:16000-16500->16000-16500/udp`).
- **Correção sugerida**: alinhar `asterisk/config/rtp.conf` para `rtpstart = 16501` /
  `rtpend = 17000` (bater com o range realmente publicado no `docker-compose.yml:94`), ou,
  inversamente, mudar a publicação do compose para 16000-16500 **desde que** se confirme que não
  colide com `voipia-asterisk` no mesmo host (hoje colide — os dois processos não podem publicar
  a mesma faixa UDP simultaneamente na mesma interface). Ajustar `rtp.conf` é a correção mais
  segura e não exige tocar no `voipia-asterisk`.

### 🟠 HIGH — `docker-helper` monta o próprio repositório com `ro`, mas nenhum outro serviço tem `ro` em montagens que só deveriam ler

- `docker-compose.yml:184-185` — `backend` monta `./security/config/jail.d` e
  `./security/config/filter.d` como `:ro` (correto). Mas `docker-compose.yml:88` — `asterisk`
  monta `./asterisk/config:/etc/asterisk` **sem `:ro`**, com escrita habilitada, apesar de o
  container Asterisk só ler esses arquivos no boot (`docker-entrypoint.sh` faz `envsubst` neles,
  então de fato precisa escrever — **não é um achado real, é comportamento esperado**, mantido
  aqui só para registrar que foi verificado).
- Achado real: `docker-compose.yml:186` — `agentia_asterisk_log:/var/log/asterisk:ro` no
  `backend` está correto (`ro`), mas o mesmo volume é montado **sem `:ro`** em `security`
  (`docker-compose.yml:311`, também `:ro` — na verdade correto também). Revisão linha a linha do
  compose não encontrou volume com permissão de escrita desnecessária além do padrão já
  documentado no `CLAUDE.md` (backend precisa escrever em `security/state`, `security/config`, o
  próprio `.env`). **Rebaixado**: sem achado real aqui após leitura completa — mantido no relatório
  só para deixar registrado que a checagem foi feita linha a linha (item 1 do pedido).

### 🟡 MEDIUM — `.env.example` ainda é o template do projeto-origem "VoipIA", com variáveis que não existem na stack AgentIA e sem as que existem

- Cabeçalho `.env.example:1-2` diz literalmente "VoipIA — Template de variáveis de ambiente" —
  confunde quem for provisionar o AgentIA do zero.
- Variáveis presentes no `.env.example` mas **sem efeito nesta stack** (não referenciadas em
  nenhum `environment:` do `docker-compose.yml` do AgentIA): `AST_ARI_USER`/`AST_ARI_PASSWORD`
  (linhas 21-22 — não há ARI/Call Center no AgentIA), `AST_OUTBOUND_TRUNK`/`AST_OUTBOUND_CONTEXT`
  (24-25), `AUDIOSOCKET_HOST`/`AUDIOSOCKET_PORT` (45-46 — aponta para `ai-agent`, serviço que não
  existe nesta stack, mesmo achado G1 da auditoria anterior, refletido aqui só no `.env.example`),
  `JIRA_*` (96-102), `CALLCENTER_*` (119-128), `INSIGHTS_*` (130-141), `AGENTS_LLM_*` (143-156 —
  na verdade **estas são usadas**, ver abaixo, falso alarme corrigido), `TURN_CREDENTIAL` (linha
  84, variável antiga que não existe mais no compose — o compose usa só `VITE_TURN_CREDENTIAL`
  como build-arg do frontend, não há serviço `coturn` no AgentIA).
- Variável usada pelo `docker-compose.yml` mas **ausente do `.env.example`**:
  `BACKEND_ALLOWED_ORIGINS` está documentada (linha 54, ok — falso alarme). Checagem completa:
  todas as variáveis referenciadas em `environment:` do compose (`POSTGRES_*`, `AST_AMI_*`,
  `AST_ARI_*` não usado por asterisk mas documentado à toa, `SIP_TRUNK_HOST`,
  `SIP_TRUNK_FROM_DOMAIN`, `SIP_DOMAIN`, `SIP_PUBLIC_IP`, `INTERNAL_API_KEY`, `RAMAL_*_PASSWORD`,
  `BACKEND_JWT_SECRET`, `BACKEND_ALLOWED_ORIGINS`, `ADMIN_USERNAME`/`ADMIN_PASSWORD`,
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, `ZABBIX_*`, `AGENTS_LLM_*`, `AGENTS_DB_*` — implícitas
  via `POSTGRES_*`) **estão** todas no `.env.example`. O problema é só o inverso: sobra de
  variáveis do template original que nunca se aplicam aqui, o que confunde um operador tentando
  saber "isso é necessário para o AgentIA ou não".
- **Correção sugerida**: podar do `.env.example` do AgentIA as seções `AST_ARI_*`,
  `AST_OUTBOUND_*`, `AUDIOSOCKET_*`, `JIRA_*`, `CALLCENTER_*`, `INSIGHTS_*`, `TURN_CREDENTIAL`
  (ou documentar explicitamente "não aplicável nesta stack, herdado do template VoipIA") — e
  trocar o cabeçalho de "VoipIA" para "AgentIA".

### 🟡 MEDIUM — Valor default de `VITE_SIP_PASSWORD` no `Dockerfile` do frontend é um segredo previsível, cacheado como `ENV` na imagem

- `frontend/Dockerfile:24-25` — `ARG VITE_SIP_PASSWORD=webrtc9001pass` /
  `ENV VITE_SIP_PASSWORD=$VITE_SIP_PASSWORD`. Mesmo valor default do `.env.example:77`
  (`VITE_SIP_PASSWORD=webrtc9001pass`) — é só um placeholder de exemplo, mas o `docker-compose.yml:208`
  usa `${VITE_SIP_PASSWORD:?defina VITE_SIP_PASSWORD em env/.env...}` que **falha o build** se a
  variável não estiver definida no `.env` real — ou seja, o default do Dockerfile nunca é
  realmente usado em produção (é só documentação/fallback para build manual fora do compose).
  Achado rebaixado a informativo: o guard `:?` no compose já neutraliza o risco prático.
- Ponto real que permanece: qualquer `ARG`/`ENV` de segredo (`VITE_SIP_PASSWORD`,
  `VITE_TURN_CREDENTIAL`) vira `ENV` na imagem Docker final (visível via
  `docker history --no-trunc agentia-frontend` e `docker inspect --format='{{.Config.Env}}'`),
  além de já estar em texto puro no bundle JS servido ao navegador — isso é uma característica
  inerente de qualquer variável `VITE_*` (client-side, sempre pública), não um bug específico
  deste Dockerfile. Mantido como MEDIUM só para registrar que a senha do ramal 9001 e a
  credencial TURN acabam sendo, por design, segredos "públicos" (visíveis a qualquer usuário do
  softphone via DevTools) — já é debito conhecido/aceito no projeto-irmão (VoipIA, ver CLAUDE.md,
  H1) mas não estava documentado explicitamente para o AgentIA.

### 🟢 LOW — Nome do grupo Unix diverge entre host e containers (GID bate, nome não)

- Host: `getent group asteriskia-app` → GID 1500. Containers `backend`/`agents-backend` criam o
  grupo com `groupadd -g 1500 voipia-app` (`backend/Dockerfile:51`,
  `agents-platform/backend/Dockerfile:12`) — nome `voipia-app`, não `asteriskia-app`.
  Funciona corretamente porque o Docker resolve permissão por **GID numérico**, não por nome
  (confirmado: `docker exec agentia-backend id` → `gid=1500(voipia-app)`, e
  `docker exec agentia-backend ls -la /opt/AgentIA/env` mostra o diretório do host com dono
  `voipia-app` do ponto de vista do container, mesmo sendo `asteriskia-app` no host — é o mesmo
  GID, só o `/etc/group` local diverge). **Sem impacto de segurança ou funcional** — puramente
  cosmético/confuso para quem for depurar permissão um dia. Sugestão: renomear para
  `asteriskia-app` nos dois Dockerfiles por clareza, sem necessidade real.

### 🟢 LOW — `http.conf` do Asterisk documenta TLS não habilitado, mas não é usado (Caddy termina TLS) — sem risco, comportamento intencional

- `asterisk/config/http.conf:11-12` comenta "produção... tlsenable=yes" mas isso nunca é feito —
  correto, pois o `pjsip.conf.template` já documenta que o Caddy termina TLS e repassa `ws://`
  puro internamente (rede Docker isolada, `172.16.9.0/24`, sem exposição direta da porta 8088 ao
  host — confirmado: `docker ps` mostra `8088/tcp` sem publicação `0.0.0.0`). Sem ação necessária.

---

## Verificações que não geraram achado (confirmadas corretas)

- **Segredos no repositório**: varredura com o padrão pedido
  (`AKIA...|BEGIN PRIVATE KEY|password=...|api_key=...`) em todo `/opt/AgentIA` (excluindo
  `node_modules`/`.git`/`target`) **não retornou nenhuma ocorrência real** — nem placeholder, nem
  segredo genuíno. O `.env.example` usa exclusivamente `changeme_*`/`your_*_here`, que não batem
  no padrão de regex por não terem 6+ caracteres "reais" entre aspas coladas a `password=`/`api_key=`
  no formato buscado (são atribuições `VAR=valor` sem aspas, formato `.env`, não código-fonte).
  `.env` real não está no escopo de leitura por instrução do usuário (nunca acessado além de
  `ls -la` para permissões).
- **`docker ps` vs `docker-compose.yml`**: todos os 6 serviços do compose do AgentIA
  (`postgres`, `asterisk`, `docker-helper`, `backend`, `frontend`, `agents-backend`, `security` —
  7 no total) estão de fato `Up`/`healthy`, nomes de container batem com `container_name:`
  declarado. Nenhuma divergência entre declarado e rodando.
- **`pjsip.conf.template`**: sem `allow_guest`/endpoint anônimo; `identify_by` explícito nos
  ramais WebRTC; tronco fechado por IP (`identify` + sem `outbound_auth`); nenhuma mudança nova
  além do que a auditoria de 19/08 já cobriu implicitamente (G3 do VoipIA, mesmo padrão aqui).
- **`extensions.conf`**: os 7 pontos de `CURL` para endpoints de call center inexistentes e os 6+
  pontos de `AudioSocket(...,ai-agent:9092)` já estão **comentados com anotação de auditoria**
  ("AUDITORIA 2026-08-19 (achado G1/G2, CRÍTICO)"), confirmando que a correção documentada na
  auditoria anterior foi de fato aplicada no arquivo real.
- **Dockerfiles — usuário non-root**: `backend` (UID 1501), `agents-backend` (UID 1503),
  `frontend` (nginx, `USER nginx` + `cap_add: NET_BIND_SERVICE`) rodam non-root. `asterisk`,
  `docker-helper`, `security` continuam root — já coberto pela reconfirmação E3 acima, com
  justificativa técnica válida (porta privilegiada / docker.sock / NET_ADMIN+host network).
- **Dockerfiles — imagens base**: `tomcat:11.0-jre21`, `python:3.12-slim`, `node:22-alpine`,
  `nginx:1.27-alpine`, `ubuntu:22.04`, `debian:bookworm-slim`, `pgvector/pgvector:pg16` — todas
  são tags correntes/suportadas, nenhuma versão obviamente descontinuada ou com CVE notório
  conhecido sem patch disponível (não foi feita varredura CVE binária, fora do escopo de leitura
  estática pedido).
- **Multi-stage build**: `backend` (maven→tomcat), `frontend` (node→nginx), `asterisk`
  (ubuntu-builder→ubuntu-runtime) todos descartam corretamente as ferramentas de build da imagem
  final — confirmado por inspeção do `Dockerfile`, sem `COPY --from=builder` de artefato de
  compilação supérfluo.
