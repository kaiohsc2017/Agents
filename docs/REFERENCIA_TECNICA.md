# Referência Técnica de Engenharia — AgentIA

> **Classificação:** Documentação Técnica de Arquitetura, Stack e Governança de Código  
> **Versão do Sistema:** AgentIA v3.2  
> **Linguagens Principais:** Java 21 LTS, Python 3.12, TypeScript 5.x, SQL (PostgreSQL 16)  
> **Metodologias:** Clean Architecture, Domain-Driven Design (DDD), 12-Factor App, Zero Trust Security

---

## 1. Stack Tecnológico Completo

| Camada / Domínio | Tecnologia / Framework | Versão | Função Principal no Sistema |
|---|---|---|---|
| **PBX & Sinalização de Voz** | Asterisk PBX | `21 LTS` | Gerenciamento de troncos SIP (PJSIP), canais RTP, softphone WebRTC e integração AMI. |
| **Backend Core (Telecom)** | Spring Boot | `3.3.x` (Java 21 LTS) | API REST principal, regras de negócio, agendamento de testes, segurança e persistência. |
| **Plataforma de Agentes IA** | FastAPI / AsyncIO | `0.111.x` (Python 3.12) | Orquestração de agentes autônomos (SSH, DB, Web, Logs), execução assíncrona e scheduler. |
| **Frontend SPA** | React + TypeScript | `18.3.x` + Vite 5 | Interface web moderna, dashboards analíticos, gestão de cadastros e softphone SIP WebRTC. |
| **Softphone WebRTC** | JsSIP | `3.10.x` | Cliente SIP puro via WebSocket em navegador com suporte a áudio bidirecional Opus/PCMU. |
| **Proxy Reverso & TLS** | Caddy Server | `2.8.x` | Roteamento HTTPS de alta performance, HTTP/3 (QUIC), terminação TLS automática via ACME. |
| **Banco de Dados** | PostgreSQL + pgvector | `16.x` | Banco relacional ACID com extensões vetoriais para base de conhecimento de IA. |
| **Migrações de Banco** | Flyway Community | `10.x` | Controle de versão de schema de banco de dados (`V1` até `V26+`). |
| **Segurança Perimetral** | Fail2ban + nftables | `1.0.x` | Prevenção ativa contra ataques de força bruta, SIP scans e tentativa de registro indevido. |
| **Containerização** | Docker Engine & Compose | `24.x+` / Compose v2 | Orquestração declarativa com isolamento de redes e limites de recursos de hardware. |

---

## 2. Metodologias e Padrões de Projeto Adotados

### 2.1. Clean Architecture & Domain-Driven Design (DDD)
A estrutura do backend em Java segue a separação estrita de responsabilidades:
- **Domain Layer:** Entidades e regras de negócio puras (ex: `Linha`, `Numero0800`, `TestResult`, `AlertCall`, `AccessGroup`), sem dependência de frameworks.
- **Application / Service Layer:** Casos de uso orquestrados (ex: `ConnectivityScheduler`, `ZabbixPollingService`, `TotpService`, `AdSyncService`).
- **Infrastructure Layer:** Adaptadores de comunicação externa, repositórios JPA/Dapper, clientes AMI e integração LDAP.
- **API / Web Layer:** Controladores REST (`@RestController`) com DTOs tipados e validação via Bean Validation (`@Valid`, `@NotNull`).

### 2.2. Princípio do Menor Privilégio & Zero Secrets
- Todas as variáveis sensíveis são injetadas estritamente em runtime através do arquivo `env/.env` (ignorado pelo Git).
- O backend e os agentes não possuem acesso root aos nós do host.
- O container `docker-helper` é o único que possui montagem do `/var/run/docker.sock`, expondo apenas operações previamente autorizadas e autenticadas por chave simétrica `INTERNAL_API_KEY`.

### 2.3. Dual-Emit JWT & RBAC Granular
O sistema rejeita modelos de autenticação puramente binários. A autorização é governada por três pilares em cada token JWT emitido:
1. **Identidade do Assunto (`sub`):** Username único do operador.
2. **Papel Base (`role`):** `ADMIN` (acesso irrestrito para governança) ou `USER` (sujeito à matriz de permissões).
3. **Claim de Permissões Granulares (`perm`):** Mapa serializado `{ "resource_key": "r" | "w" | "rw" }`.
4. **Claim de Escopo de BU (`bu`):** Lista de IDs das Unidades de Negócio que o usuário tem autorização para visualizar/editar.

---

## 3. Catálogo de Recursos de Sistema (`Resource Keys`) e Menus

A tabela abaixo documenta a correlação exata entre o menu da interface, a chave de recurso (`resource_key`), o nível de permissão exigido e os controladores/tabelas de backend correspondentes.

| Menu / Tela (Frontend) | Resource Key | Permissões Suportadas | Controlador Backend | Tabelas no Banco de Dados |
|---|---|---|---|---|
| **Dashboard Telecom** | `telecom.dashboard` | `r` (Leitura) | `StatsController` | `tb_test_result`, `tb_alert_call` |
| **Conectividade (Módulo 2)** | `telecom.modulo2` | `r` (Ver), `rw` (Disparar) | `ConnectivityController` | `tb_test_result`, `tb_linha`, `tb_numero_0800` |
| **Monitoramento (Módulo 3)** | `telecom.modulo3` | `r` (Ver), `rw` (Gerenciar) | `AlertController` | `tb_alert_call`, `tb_alert_config` |
| **Cadastros → Usuários** | `telecom.users` | `r` (Listar), `rw` (Criar/Editar) | `UserController` | `tb_user`, `tb_user_business_units` |
| **Cadastros → Operadora** | `telecom.operadoras` | `r` (Listar), `rw` (Criar/Editar) | `OperadoraController` | `tb_operadora` |
| **Cadastros → Linhas** | `telecom.linhas` | `r` (Listar), `rw` (Criar/Editar) | `LinhaController` | `tb_linha`, `tb_client`, `tb_business_unit` |
| **Cadastros → 0800** | `telecom.0800` | `r` (Listar), `rw` (Criar/Editar) | `Numero0800Controller` | `tb_numero_0800`, `tb_client`, `tb_business_unit` |
| **Sistema → Configurações** | `telecom.settings` | `r` (Ver), `rw` (Alterar) | `SettingsController`, `AsteriskConfigController` | `tb_system_config`, `tb_settings_history` |
| **Sistema → Logs** | `telecom.logs` | `r` (Visualizar Logs) | `LogsController` | N/A (Stream de logs do Docker/Asterisk) |
| **Sistema → Grupos de Acesso** | *Exclusivo ADMIN* | `rw` (Total) | `AccessGroupController` | `tb_access_group`, `tb_access_group_permissions` |
| **Sistema → Auditoria** | `telecom.audit` | `r` (Consultar) | `AuditController` | `tb_audit_log` |
| **Sistema → Release Notes** | `telecom.release` | `r` (Livre) | N/A (Frontend estático) | N/A |
| **Agentes → Dashboard** | `agents.dashboard` | `r` (Ver métricas) | `routers/reports.py` | `agent_executions`, `agents` |
| **Agentes → Agentes** | `agents.agents` | `r` (Listar), `rw` (Criar/Executar) | `routers/agents.py`, `routers/executions.py` | `agents`, `agent_executions` |
| **Agentes → Servidores** | `agents.servers` | `r` (Listar), `rw` (Gerenciar) | `routers/servers.py` | `servers` |
| **Agentes → Base Conhecimento**| `agents.knowledge` | `r` (Listar), `rw` (Upload/Embed) | `routers/knowledge.py` | `knowledge_docs`, `knowledge_chunks` |
| **Agentes → Logs** | `agents.logs` | `r` (Visualizar) | `routers/executions.py` | `agent_execution_logs` |
| **Agentes → Alertas** | `agents.reports` | `r` (Visualizar Alertas) | `routers/reports.py` | `agent_executions` |
| **Agentes → Secrets Vault** | `agents.secrets` | `r` (Listar chaves), `rw` (Salvar) | `routers/system.py` | `secrets` (AES-256-GCM) |
| **Agentes → Config. IA** | `agents.llm` | `r` (Ver), `rw` (Alterar) | `routers/llm_config.py` | `llm_config` |

---

## 4. Estrutura e Mecânica do Banco de Dados

### 4.1. Migrações Flyway (Core Telecom)
As migrações SQL residem em `backend/src/main/resources/db/migration/`:
- `V1__init.sql`: Estrutura básica de usuários, papéis e tabelas operacionais.
- `V2__connectivity.sql` a `V14__audit_enhancements.sql`: Tabelas de resultados de testes, gravações de chamadas e histórico de configurações.
- `V15__access_groups_rbac.sql`: Implementação das tabelas de Grupos de Acesso e matriz de Resource Keys.
- `V26__business_units_multitenancy.sql`: Isolamento de dados por Business Unit e flags de acesso indeterminado retroativo.

### 4.2. Schema da Plataforma de Agentes
Gerenciado pelo script assíncrono `agents-platform/backend/migrate.py`:
- `agents`: Cadastro de robôs de automação (tipo: `ssh`, `database`, `web`, `log`), parâmetros e cron jobs.
- `agent_executions`: Histórico de execuções com status (`RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`), tempo de execução e saída.
- `knowledge_docs` & `knowledge_chunks`: Documentos particionados com vetores de embedding para busca semântica RAG.
- `secrets`: Armazenamento cifrado de senhas de banco, credenciais SSH e tokens de webhook.

---

## 5. Integrações de Mídia e Telefonia (Asterisk 21 LTS)

### 5.1. Protocolo PJSIP (`pjsip.conf`)
- Configuração modular através de templates dinâmicos processados pelo backend (`AsteriskConfigService`).
- Tipos de Transporte: `transport-udp` (5060 interno / 5062 externo) e `transport-wss` (8088 interno para WebRTC).
- Endpoints de Ramal:
  - `1001`, `1002`: Ramais SIP físicos / softphones de teste.
  - `9001`, `9002`: Ramais WebRTC vinculados ao softphone integrado do painel web.
  - `2000-2999`: Faixa dinâmica alocada para URAs inteligentes.

### 5.2. Asterisk Manager Interface (AMI)
- O backend Spring Boot conecta-se à porta `5038/tcp` do Asterisk através de conexão TCP persistente.
- Ações emitidas: `Originate` (disparo de chamadas de teste e alertas), `Hangup`, `CoreStatus`, `SIPpeers`.
- Eventos consumidos: `Newchannel`, `Newstate` (Up/Ringing), `HangupCause`, `VarSet`.
