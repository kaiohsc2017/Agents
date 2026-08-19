# CONTEXT.md — AgentIA

Glossário da linguagem de domínio do projeto AgentIA. Objetivo: eliminar ambiguidade em termos operacionais, RBAC granular, escopo por BU, telemetria de conectividade e orquestração de agentes.

---

## 🤖 Plataforma de Agentes Autônomos

**Agente Autônomo**:
Entidade especialista de IA com tipo de execução definido (`ssh_test`, `web_monitor`, `log_monitor`, `database`), prompt/skill de atuação, agendamentos (interval/cron), políticas de notificação e regras de automação.
_Avoid_: bot genérico, script

**Memória RAG do Agente**:
Histórico persistente e individualizado de aprendizados, correções e preferências no PostgreSQL com busca vetorial e textual via `pg_trgm` / `pgvector`.
_Avoid_: cache temporário

**Execução (Execution)**:
Instância individual de execução de um agente com timestamp de início/fim, status (`success`, `partial`, `error`), telemetria de checks e log detalhado passo a passo.
_Avoid_: job avulso

**Vault de Segredos (Agent Secrets)**:
Armazenamento seguro de credenciais, chaves e senhas isoladas por agente no PostgreSQL.
_Avoid_: variáveis hardcoded

---

## 📞 Conectividade Telecom & Monitoramento

**Teste de Conectividade**:
Discagem automática agendada (`ConnectivityScheduler`) para validar que números telefônicos externos (E1, SIP, DDR, 0800, DID) estão alcançáveis e respondendo corretamente.
_Avoid_: healthcheck de número, ping de ramal

**Alerta Zabbix**:
Ligação automática disparada ao responsável de plantão quando o Zabbix reporta um incidente crítico de infraestrutura.
_Avoid_: notificação genérica

**Ramal SIP**:
Extensão SIP/PJSIP registrada no Asterisk para softphone dos operadores e geração de chamadas de teste.

---

## 👥 RBAC Granular (Grupos de Acesso)

**Grupo de Acesso**:
Conjunto nomeado de permissões de leitura/escrita por `resource_key` (`access_groups` + `access_group_permissions`), que atua como o mecanismo principal de autorização granular.
_Avoid_: perfil, papel, role

**Resource Key**:
Identificador fixo de um menu/recurso no catálogo de código (`ResourceCatalog.java`), ex: `telecom.settings`, `agents.agents`, `telecom.users`.
_Avoid_: permissão

**Claim `perm`**:
Claim do JWT com a matriz `{resource_key: "r"|"w"|"rw"}` resolvida do grupo do usuário no login/refresh/2FA.
_Avoid_: escopo do token

**Streaming Token**:
Token JWT de curta duração (60s, claim `scope=stream`) emitido exclusivamente para autenticar WebSocket/SSE.
_Avoid_: token de sessão, ws token

---

## 🏢 Controle de Acesso por BU (Business Unit)

**BU (Business Unit / Unidade de Negócio)**:
Escopo obrigatório de um usuário (`user_business_units`), carregado no JWT como authority `BU_<id>`. Define quais Cadastros e Testes de Conectividade o usuário enxerga. Administradores (`ROLE_ADMIN`) visualizam todos os dados.
_Avoid_: setor, filial

**Operação**:
Cadastro corporativo vinculado a Cliente e a uma BU.
_Avoid_: projeto

---

## 🛠️ Infraestrutura & Segurança

**Docker-Helper**:
Microserviço seguro de controle de containers com acesso restrito ao `docker.sock` via `X-Internal-Key`.
_Avoid_: docker proxy

**AudioSocket / WebRTC**:
Protocolos para streaming de áudio e telefonia no navegador do operador.

