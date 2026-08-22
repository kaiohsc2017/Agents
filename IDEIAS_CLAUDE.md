# Ideias de Produto — AgentIA

> Gerado em sessão Claude Code de 21/08/2026, a partir de leitura do código real do
> repositório (`docker-compose.yml`, `domain/` do backend Java `com.asteriskia`,
> `agents-platform/backend/`, `ai-agent/src/`, migrations Flyway, README.md, CONTEXT.md e
> `git log`) — não de documentação, que estava desatualizada neste diretório na época desta
> análise (ver nota no `CLAUDE.md`).

## Contexto

AgentIA é uma plataforma de **Agentes Autônomos de IA** (SSH/HTTP/log/DB, RAG via
`pgvector`, multi-LLM) com um **orquestrador visual DAG** (Agent Flow Canvas) e telefonia
Asterisk embutida para dois usos: alerta de incidente por voz (Módulo 3 — Zabbix) e
medição de qualidade de voz (Audio QoS / MOS preditivo ITU-T P.800). Não é um call center —
isso é o VoipIA, produto irmão com histórico de código compartilhado (daí o pacote Java
legado `com.asteriskia` e migrations fósseis `cc_*` sem uso).

O diferencial competitivo real do AgentIA é o cruzamento que nenhum concorrente tem:
**AIOps agêntico + canal de voz + medição de qualidade de voz**, tudo no mesmo produto.

---

## Tier 1 — o moat: voz + AIOps

### 1. `approvalNode` — gate humano no DAG (prioridade máxima)
Hoje `_run_autofix` (`agents-platform/backend/orchestrator.py:154`) dispara `fix_cmd` via
SSH **sem nenhuma aprovação** quando `auto_fix=true` numa regra. Não existe nada de
`approval`/`human` em `flow_engine.py`. Isso é o que impede a venda em ambiente crítico —
nenhuma empresa liga auto-remediação por SSH em produção sem um portão. Um nó que pausa o
DAG, pede aprovação (Telegram inline ou pela própria ligação de voz), com timeout e
escalonamento automático, transforma um recurso de risco em argumento de venda.
**Por que primeiro:** destrava a venda do que já existe hoje; sem isso, o auto-fix é um
passivo, não um ativo.

### 2. Plantão conversacional bidirecional com autorização por voz
O `actuatorNode` (`sub_type == "voice_call"`) e o `zabbix_alert_flow.py` já ligam e
**narram** o alerta. O salto: a IA liga, explica o incidente com contexto da memória RAG do
agente ("isso já ocorreu 3× este mês; nas 3 o que resolveu foi X"), e aceita comando
falado — "roda o runbook", "reinicia", "escala pro N2", "silencia por 2h". Todas as peças
já existem (`ssh_executor`, function calling do Gemini, AudioSocket); falta o portão: PIN
falado + confirmação dupla + trilha de auditoria do que foi autorizado por voz (depende do
#1 para o gate). É "PagerDuty que resolve o incidente enquanto você ainda está no
telefone" — nenhum concorrente de AIOps tem PBX, nenhum de telefonia tem agente autônomo.

### 3. Runbook que se escreve sozinho
Execuções e telemetria de checks já ficam persistidas (`executions`, `execution_logs`).
Minerar isso pra propor um DAG: *"esse alerta ocorreu 14×; nas 14 a sequência de ações foi
essa — quer virar um fluxo?"*. Fecha o ciclo incidente → padrão → automação, usando o Flow
Canvas como destino natural. Quanto mais o cliente usa a plataforma, mais valiosa ela fica.

---

## Tier 2 — Audio QoS como produto próprio

### 4. Laudo probatório de SLA por operadora
Já se mede MOS/jitter/ruído/perda **de gravação real** (`audio_qos.py::_measure`, agregado
`mos_by_operadora`). Falta o artefato comercial: laudo mensal por operadora com série
histórica, hash + timestamp de integridade e comparativo — o documento que a empresa leva
pra renegociar contrato ou abrir disputa com a operadora de telefonia. Vira justificativa
de compra pra área de Compras, não só ferramenta técnica.

### 5. Failover de rota por degradação preditiva
Hoje o teste roda agendado e reporta. O salto: detectar *tendência* de queda de MOS numa
rota antes da reclamação chegar e disparar o DAG com `asterisk_action` para trocar a rota
do tronco automaticamente. É a tese do produto (monitorar → agir) aplicada à própria voz.

### 6. Teste sintético de jornada de voz
Hoje o teste de conectividade só valida se o número atende. Diferencial: o agente
**navega a URA do destino** ("disca 1, fala 'segunda via'"), cronometra até o atendimento
humano e valida a jornada inteira. O motor de STT/TTS/AudioSocket continua no `ai-agent`
mesmo após a remoção do Módulo 1 do dialplan — reaproveitamento quase direto. É
"Datadog Synthetics para telefonia".

---

## Tier 3 — plataforma

- **Catálogo de agentes prontos** (SSL expirando, fila travada, backup, certificado SIP) —
  hoje o cliente começa de uma tela vazia; templates encurtam o tempo até o primeiro valor.
- **Teto de custo de IA por agente** — não há rastreio de custo/token em `llm.py` nem em
  `models.py`. Com agendamento cron + multi-LLM, um agente mal configurado gera fatura
  surpresa. Custo por execução + limite por agente é barato de fazer e evita o pior tipo
  de churn.
- **Modo "nada sai da sua rede"** — suporte a Ollama já existe; empacotar isso como oferta
  on-premise explícita abre banco/governo/saúde, onde mandar log de produção pra API de
  terceiro é veto imediato.

---

## Recomendação de ordem

**#1 (approvalNode) → #2 (plantão conversacional) → #4 (laudo de SLA)**. O #1 destrava o
que já existe; o #2 muda a categoria do produto; o #4 abre uma conversa comercial fora de
TI (Compras/Jurídico, não só Operações).
