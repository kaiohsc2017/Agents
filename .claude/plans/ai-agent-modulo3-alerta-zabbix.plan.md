# Plan: Serviço ai-agent — Módulo 3 (Alerta Zabbix por voz)

**Source**: pedido direto do usuário (sem PRD formal)
**Escopo**: apenas o fluxo de voz do Módulo 3 (ZabbixAlertFlow). Módulo 1 (URA multi-instância)
fica **fora do sistema AgentIA por decisão do usuário** — parte deste plano é podar o código morto
de Módulo 1 que ainda restava no dialplan.
**Complexidade**: Média-Alta (serviço novo do zero, mas toda a orquestração do lado Java já existe
e funciona — `AlertService`/`AmiOriginateService`/`AlertController` já esperam por este serviço)

## Resumo

O backend Java **já está pronto para o Módulo 3** — `AlertService.triggerAlert()` já cria o
`AlertCall`, já origina a chamada via AMI (`AmiOriginateService.originateAlertCall`), e o
`AlertController` já expõe `GET /alert-calls/by-uuid/{uuid}` (o agente lê o incidente) e
`PATCH /alert-calls/by-uuid/{uuid}` (o agente atualiza o status ao terminar). O dialplan
(`asteriskia-alert`) já está com `AudioSocket(${MY_UUID},ai-agent:9092)` ativo. **O único elo
faltando é o serviço Python que atende essa porta AudioSocket, faz STT→LLM→TTS via Gemini, e
fala o conteúdo do incidente para quem atende a ligação.**

## Achado que muda o ponto de partida deste plano

A correção G1/G2 da auditoria de 19/08 (que devia ter desativado o Módulo 1 e removido as
chamadas CURL mortas do dialplan) **foi aplicada no arquivo errado** — editou
`asterisk/config/extensions.conf` (gerado em runtime) em vez de `extensions.conf.template`
(o arquivo versionado que realmente determina o dialplan após qualquer rebuild). Confirmado
agora: o template ainda tem todos os 9 `AudioSocket(...,ai-agent:9092)` ativos, incluindo os do
Módulo 1 (ramal 1000, 1001, faixa `_2XXX`) e as 7 chamadas CURL mortas para endpoints de Call
Center inexistentes. Isso será corrigido como parte da Fase 1 deste plano (não como item avulso),
porque remover o Módulo 1 do dialplan é exatamente o que a decisão "não teremos Módulo 1" exige.

## Patterns to Mirror

| Categoria | Fonte | Padrão |
|---|---|---|
| Header interno | `docker-helper/main.py:22`, `InternalKeyFilter.java` | `X-Internal-Key: ${INTERNAL_API_KEY}` para toda chamada Python→Java |
| Chave de API nunca em query string | `agents-platform/backend/notifier.py`, correção B2/A5 da auditoria | Header, nunca URL; erro genérico ao logar, nunca `e.getMessage()` bruto se puder conter segredo |
| Guard de SSRF | `agents-platform/backend/ssrf_guard.py` (extraído nesta sessão) | Reusar se o serviço precisar validar qualquer URL configurável — aqui não deveria precisar, pois a URL do backend é fixa via env, nunca dado de entrada |
| Cache de config com TTL | Documentado no CLAUDE.md (`ai-agent/src/config.py` do projeto irmão) — reescrever aqui do zero | Ler `.env` a cada N segundos (TTL 60s) em vez de exigir restart a cada mudança de config |
| Sanitização de campo AMI | `AmiOriginateService.sanitizeAmiField` | Mesma disciplina de nunca deixar `\r\n` quebrar um protocolo de linha (aplicável ao parse do frame AudioSocket) |
| Fail-closed em segredo ausente | `main.py` (`BACKEND_JWT_SECRET`), `executors/common.py` (`SSH_KNOWN_HOSTS_FILE`) | Se `GEMINI_API_KEY`/`INTERNAL_API_KEY` ausentes no boot, falhar imediatamente com log claro — nunca degradar silenciosamente |
| Erro genérico ao cliente / detalhe só no log | `llm.py`, `servers.py`, `flows.py` (pós-correção A5) | Nunca propagar exceção crua de volta a um canal externo — aqui não há "cliente HTTP" pro usuário final, mas o princípio vale para o retorno ao AMI/PATCH de status |

## Arquitetura

```
Zabbix dispara incidente crítico
        │
ZabbixPollingService.java (já existe)
        │
AlertService.triggerAlert() (já existe)
        │
AmiOriginateService.originateAlertCall() (já existe) ──AMI Originate──▶ Asterisk
                                                                          │
                                                        dialplan [asteriskia-alert]
                                                                          │
                                                        AudioSocket(UUID, ai-agent:9092)
                                                                          │
                                              ╔═══════════════════════════▼═══════════════════════════╗
                                              ║  NOVO: ai-agent (Python asyncio, container dedicado)   ║
                                              ║                                                        ║
                                              ║  1. Aceita conexão AudioSocket, lê UUID do frame        ║
                                              ║  2. GET /api/v1/alert-calls/by-uuid/{uuid} (backend)    ║
                                              ║     → incidente, severidade, host                       ║
                                              ║  3. Monta texto do incidente → Gemini TTS → fala        ║
                                              ║  4. (Opcional) STT da resposta do atendente (reconhece  ║
                                              ║     "reconhecido"/"escalar") → LLM decide follow-up      ║
                                              ║  5. PATCH /api/v1/alert-calls/by-uuid/{uuid}            ║
                                              ║     → status final (ATENDIDA/RECONHECIDA/etc.)          ║
                                              ╚════════════════════════════════════════════════════════╝
```

## Files to Change

| File | Ação | Por quê |
|---|---|---|
| `asterisk/config/extensions.conf.template` | UPDATE | Remover Módulo 1 (ramal 1000/1001 URA, faixa `_2XXX`, contextos `[asteriskia-jira]`) e as 7 chamadas CURL mortas de Call Center — manter só `[asteriskia-alert]` com AudioSocket ativo e os contextos de Módulo 2 (`asteriskia-test`) e ramais internos legítimos |
| `docker-compose.yml` | UPDATE | Novo serviço `ai-agent` (container `agentia-ai-agent`, IP `172.16.9.17`, sem porta publicada ao host — só rede interna) |
| `.env.example` | UPDATE | Reativar `AUDIOSOCKET_HOST=ai-agent`/`AUDIOSOCKET_PORT=9092` (hoje comentadas como "não utilizado"); confirmar `GEMINI_API_KEY`/`GEMINI_MODEL_STT`/`GEMINI_MODEL_LLM`/`GEMINI_MODEL_TTS` já presentes |
| `ai-agent/Dockerfile` | CREATE | Imagem Python 3.12-slim, usuário não-root (mesmo padrão GID 1500 já usado por backend/agents-api) |
| `ai-agent/requirements.txt` | CREATE | `google-genai`, `aiohttp` (chamadas ao backend) |
| `ai-agent/src/main.py` | CREATE | Servidor AudioSocket asyncio — accept loop, roteamento por UUID |
| `ai-agent/src/config.py` | CREATE | Leitura de `.env`/environ com cache TTL 60s |
| `ai-agent/src/protocol.py` | CREATE | Frame AudioSocket: header 3 bytes (tipo+comprimento) + payload PCM 8kHz/16bit/mono |
| `ai-agent/src/flows/zabbix_alert_flow.py` | CREATE | Único flow — narra incidente, escuta confirmação, atualiza status |
| `ai-agent/src/services/ai_service.py` | CREATE | Orquestra STT→LLM→TTS |
| `ai-agent/src/services/gemini_service.py` | CREATE | SDK `google-genai` — STT/LLM/TTS, streaming |
| `ai-agent/src/services/backend_client.py` | CREATE | HTTP client para `GET`/`PATCH /alert-calls/by-uuid/{uuid}` com header `X-Internal-Key` |
| `backend/src/main/resources/application.properties` | Nenhuma mudança esperada | Endpoints já existem; só confirmar `app.internal-api-key` já injetado (confirmado — já existe) |
| `docs/ARQUITETURA.md`, `docs/MANUAL_DO_USUARIO.md`, `docs/REFERENCIA_TECNICA.md` | UPDATE | Reverter a nota "Módulo 3 não disponível nesta instalação" (adicionada na auditoria de 20/08) para "operacional", e deixar explícito que Módulo 1 não faz parte do escopo do AgentIA (não é "temporariamente indisponível" — é decisão de produto) |

## Tasks

### Fase 0 — Poda do Módulo 1 e do código morto de Call Center (pré-requisito)
- **Ação**: reescrever `extensions.conf.template` removendo os contextos/extensões do Módulo 1
  (URA — ramal `1000`/`1001` como URA legada, faixa `_2XXX`, contexto `[asteriskia-jira]` se
  existir separado) e as 7 chamadas CURL mortas de Call Center (`/internal/ura-routing`,
  `/internal/callcenter/**`) identificadas na auditoria G2. Manter intactos: Módulo 2
  (`asteriskia-test`), Módulo 3 (`asteriskia-alert`), ramais internos de teste/softphone
  (9001/9002/1001/1002 como ramais, não como URA).
- **Mirror**: nada a espelhar — é remoção pura, sem padrão de código a seguir.
- **Validar**: `docker exec agentia-asterisk asterisk -rx "dialplan reload"` sem erro de sintaxe;
  `grep -c "AudioSocket" extensions.conf.template` deve cair de 9 para 1 (só `asteriskia-alert`).

### Fase 1 — Esqueleto do serviço ai-agent
- **Ação**: criar `ai-agent/` com `Dockerfile`, `requirements.txt`, `src/main.py` (servidor
  AudioSocket que aceita conexão, lê o UUID do primeiro frame, e por ora só loga e responde —
  sem lógica de IA ainda) e `src/config.py` (leitura de env com TTL).
- **Mirror**: fail-closed em segredo ausente (`GEMINI_API_KEY`/`INTERNAL_API_KEY`), mesmo padrão
  de `main.py`/`executors/common.py` do agents-platform.
- **Validar**: `docker compose up -d --build ai-agent`; container fica healthy; uma ligação de
  teste ao contexto `asteriskia-alert` conecta e o log mostra o UUID recebido.

### Fase 2 — Protocolo AudioSocket
- **Ação**: `src/protocol.py` — implementar `read_frame`/`write_audio` conforme o protocolo
  documentado no CLAUDE.md (header 3 bytes tipo+comprimento, payload PCM). Fonte de referência:
  a especificação pública do `app_audiosocket` do Asterisk (mesma usada pelo projeto irmão) —
  pesquisar a implementação de referência antes de escrever (regra do projeto: GitHub code
  search primeiro).
- **Mirror**: sanitização defensiva ao ler o UUID do frame (nunca confiar em tamanho/formato sem
  validar, mesmo espírito da sanitização de campo AMI).
- **Validar**: teste de integração manual — originar uma chamada real via
  `asterisk -rx "channel originate Local/..."` e confirmar no log que o ai-agent recebe áudio.

### Fase 3 — Cliente do backend (`backend_client.py`)
- **Ação**: `GET /api/v1/alert-calls/by-uuid/{uuid}` e `PATCH /api/v1/alert-calls/by-uuid/{uuid}`
  via `aiohttp`, sempre com header `X-Internal-Key`, timeout curto (ex: 5s), sem repassar exceção
  crua a quem chama (log detalhado + retorno estruturado de erro).
- **Mirror**: mesmo padrão de erro genérico já adotado em `llm.py`/`flows.py` (correção A5).
- **Validar**: chamada real contra o backend rodando, confirmando 200 no GET e 204 no PATCH.

### Fase 4 — Gemini STT/LLM/TTS (`gemini_service.py`, `ai_service.py`)
- **Ação**: usar o SDK `google-genai` (não a lib legada `google-generativeai`) — confirmar
  versão/API atual antes de codar (regra do projeto: Context7/docs oficiais antes de implementar).
  `ai_service.py` orquestra: monta o texto do incidente (severidade/host/resumo) → chama TTS
  (`GEMINI_MODEL_TTS`) → escreve os frames de áudio de volta no socket. Opcionalmente: STT da
  resposta falada do atendente (`GEMINI_MODEL_STT`) + um LLM simples (`GEMINI_MODEL_LLM`) para
  classificar a resposta como "reconhecido"/"não reconhecido"/"silêncio" e decidir o status final.
- **Mirror**: chave de API sempre em header (nunca query string), erro do provedor nunca ecoado
  cru pro chamador — mesma disciplina de `llm.py`.
- **Validar**: chamada real ao Gemini com um texto de teste, confirmando áudio gerado audível
  (ouvir o resultado gravado pelo `MixMonitor` do dialplan).

### Fase 5 — `zabbix_alert_flow.py` (orquestração ponta a ponta)
- **Ação**: o flow único deste serviço — recebe a conexão AudioSocket, busca o incidente
  (Fase 3), narra por voz (Fase 4), escuta/classifica a resposta, faz o `PATCH` de status final,
  encerra a chamada.
- **Mirror**: mesma disciplina de nunca deixar uma exceção não tratada travar a conexão
  indefinidamente — sempre um `try/finally` fechando o socket e reportando status de falha se
  algo quebrar no meio.
- **Validar**: ligação real de ponta a ponta (Zabbix simulado → AlertService → AMI → Asterisk →
  ai-agent → Gemini → volta pro dialplan) confirmando `AlertCall.callStatus` atualizado no banco.

### Fase 6 — Deploy e documentação
- **Ação**: `docker-compose.yml` com o serviço novo; `.env.example` atualizado; documentação
  (`ARQUITETURA.md`/`MANUAL_DO_USUARIO.md`/`REFERENCIA_TECNICA.md`) corrigida para refletir Módulo
  3 operacional e Módulo 1 fora de escopo (não "indisponível temporariamente" — remover a
  ambiguidade).
- **Validar**: `docker compose ps` com `agentia-ai-agent` healthy; teste real de ligação de
  alerta.

## Validation

```bash
# Sintaxe do dialplan após a poda do Módulo 1
docker exec agentia-asterisk asterisk -rx "dialplan reload"

# Build e subida do novo serviço
docker compose up -d --build ai-agent
docker compose ps ai-agent

# Teste ponta a ponta (sem tráfego real de cliente — chamada originada localmente)
docker exec agentia-asterisk asterisk -rx "channel originate Local/s@asteriskia-alert application Wait 5"
docker compose logs ai-agent --tail 50
```

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Protocolo AudioSocket implementado incorretamente (framing errado) | Média | Pesquisar implementação de referência (GitHub) antes de codar; testar com ligação real cedo (Fase 2), não só no fim |
| Latência do Gemini TTS atrasar a resposta ao vivo na ligação | Média | Usar streaming (não esperar o áudio inteiro); definir timeout com fallback de mensagem gravada estática se o Gemini não responder a tempo |
| Reintroduzir os mesmos problemas de segurança das duas auditorias (chave em query string, erro cru vazando, SSRF) | Baixa (com os patterns já mapeados) | Seguir a tabela de "Patterns to Mirror"; passar pelo `ecc:security-reviewer` antes do deploy final, mesmo processo já usado nas correções anteriores |
| Poda do Módulo 1 quebrar algo que na verdade está em uso | Baixa | Confirmado por esta e pela auditoria anterior que não há tráfego real hoje; `dialplan reload` valida sintaxe antes de qualquer chamada real |
| `SIP_SECRET_ENCRYPTION_KEY`/`AGENT_SECRETS_ENCRYPTION_KEY` recém-configuradas não têm relação functional com este módulo | N/A | Sem impacto — módulos independentes |

## Acceptance
- [ ] Módulo 1 removido do `extensions.conf.template` (não só do arquivo runtime)
- [ ] Serviço `ai-agent` no ar, container healthy, sem porta publicada ao host
- [ ] Ligação de teste real narrando o incidente por voz e atualizando `AlertCall.callStatus`
- [ ] Nenhum achado novo de segurança (chave em query string, SSRF, erro cru) — revisado por
      `ecc:security-reviewer` antes do deploy final
- [ ] Documentação atualizada refletindo Módulo 3 operacional / Módulo 1 fora de escopo

---

**AGUARDANDO CONFIRMAÇÃO**: proceder com este plano? (sim / modificar / ajustar fase)
