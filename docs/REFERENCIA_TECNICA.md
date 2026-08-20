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
| **Frontend SPA** | React + TypeScript | `19.x` + Vite 6 | Interface web moderna, dashboards analíticos, gestão de cadastros e softphone SIP WebRTC. |
| **Softphone WebRTC** | JsSIP | `3.10.x` | Cliente SIP puro via WebSocket em navegador com suporte a áudio bidirecional Opus/PCMU. |
| **Proxy Reverso & TLS** | Caddy Server | `2.8.x` | Roteamento HTTPS de alta performance, HTTP/3 (QUIC), terminação TLS automática via ACME. |
| **Banco de Dados** | PostgreSQL + pgvector | `16.x` | Banco relacional ACID com extensões vetoriais para base de conhecimento de IA. |
| **Migrações de Banco** | Flyway Community | `10.x` | Controle de versão de schema de banco de dados (`V1` até `V89`). |
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
| **Dashboard Telecom** | `telecom.dashboard` | `r` (Leitura) | `StatsController` | `test_results`, `alert_calls` |
| **Conectividade (Módulo 2)** | `telecom.modulo2` | `r` (Ver), `rw` (Disparar) | `ConnectivityController` | `test_results`, `linhas`, `numeros_0800` |
| **Monitoramento (Módulo 3)** | `telecom.modulo3` | `r` (Ver), `rw` (Gerenciar) | `AlertController` | `alert_calls`, `alert_contacts` |
| **Cadastros → Usuários** | `telecom.users` | `r` (Listar), `rw` (Criar/Editar) | `UserController` | `app_users`, `user_business_units` |
| **Cadastros → Operadora** | `telecom.operadoras` | `r` (Listar), `rw` (Criar/Editar) | `OperadoraController` | `operadoras` |
| **Cadastros → Linhas** | `telecom.linhas` | `r` (Listar), `rw` (Criar/Editar) | `LinhaController` | `linhas`, `clients`, `business_units` |
| **Cadastros → 0800** | `telecom.0800` | `r` (Listar), `rw` (Criar/Editar) | `Numero0800Controller` | `numeros_0800`, `clients`, `business_units` |
| **Sistema → Configurações** | `telecom.settings` | `r` (Ver), `rw` (Alterar) | `SettingsController`, `AsteriskConfigController` | `system_config`, `settings_history` |
| **Sistema → Logs** | `telecom.logs` | `r` (Visualizar Logs) | `LogsController` | N/A (Stream de logs via `agentia-docker-helper`) |
| **Sistema → Grupos de Acesso** | *Exclusivo ADMIN* | `rw` (Total) | `AccessGroupController` | `access_groups`, `access_group_permissions` |
| **Sistema → Auditoria** | `telecom.audit` | `r` (Consultar) | `AuditController` | `audit_logs` |
| **Sistema → Release Notes** | `telecom.release` | `r` (Livre) | N/A (Frontend estático) | N/A |
| **Agentes → Dashboard** | `agents.dashboard` | `r` (Ver métricas) | `routers/reports.py` | `executions`, `agents` |
| **Agentes → Agentes** | `agents.agents` | `r` (Listar), `rw` (Criar/Executar) | `routers/agents.py`, `routers/executions.py` | `agents`, `executions` |
| **Agentes → Servidores** | `agents.servers` | `r` (Listar), `rw` (Gerenciar) | `routers/servers.py` | `servers` |
| **Agentes → Base Conhecimento**| `agents.knowledge` | `r` (Listar), `rw` (Upload/Embed) | `routers/knowledge.py` | `knowledge_docs`, `agent_memory` |
| **Agentes → Logs** | `agents.logs` | `r` (Visualizar) | `routers/executions.py` | `execution_logs` |
| **Agentes → Alertas** | `agents.reports` | `r` (Visualizar Alertas) | `routers/reports.py` | `alerts`, `executions` |
| **Agentes → Secrets Vault** | `agents.secrets` | `r` (Listar chaves), `rw` (Salvar) | `routers/system.py` | `agent_secrets` |
| **Agentes → Config. IA** | `agents.llm` | `r` (Ver), `rw` (Alterar) | `routers/llm_config.py` | `system_config` |
| **Agentes → Flow Canvas (DAG)** | `agents.flows` | `r` (Listar), `rw` (Criar/Executar) | `routers/flows.py`, `flow_engine.py` | `agent_flows`, `flow_executions`, `flow_execution_steps` |
| **Telecom → Audio QoS (IA)** | `telecom.qos` | `r` (Ver métricas), `rw` (Analisar) | `routers/audio_qos.py`, `audio_qos.py` | `audio_qos_metrics`, `test_results` |

---

## 4. Estrutura e Mecânica do Banco de Dados

### 4.1. Migrações Flyway (Core Telecom & Governança)
As migrações SQL residem em `backend/src/main/resources/db/migration/`:
- `V1__init.sql` a `V14__agents_schema.sql`: Estrutura básica de usuários, papéis, testes e agentes.
- `V15__call_record_filters.sql` a `V26__user_business_units_access_control.sql`: RBAC granular, multitenancy por BU e auditoria.
- `V27` a `V90`: Configurações em runtime, sincronização Active Directory / LDAP e parâmetros de IA.
- `V91__create_agent_flows_tables.sql`: Tabelas do motor DAG `agent_flows`, `flow_executions` e `flow_execution_steps`.
- `V92__create_audio_qos_tables.sql`: Métricas de Audio QoS (MOS ITU-T P.800, Jitter, Ruído dB, Waveform e Laudo IA).

### 4.2. Schema da Plataforma de Agentes, Motor DAG & IA Acústica
- `agents` & `agent_executions`: Cadastro e histórico de robôs de automação (SSH, SQL, HTTP, Logs).
- `agent_flows`: Definição de grafos direcionados acíclicos (DAG) em JSONB com nós visuais e conexões.
- `flow_executions` & `flow_execution_steps`: Telemetria de execução nó a nó com duração em ms, status e payload context.
- `audio_qos_metrics`: Telemetria acústica com nota MOS (1.0 a 5.0), Jitter (ms), Ruído (dBFS), Perda de Pacotes (%), Waveform (JSONB) e Parecer da IA.
- `knowledge_docs` & `agent_memory`: Documentos particionados com vetores de embedding para busca semântica RAG.
- `agent_secrets`: Armazenamento cifrado de senhas de banco, credenciais SSH e tokens de webhook.

### 4.3. Arquitetura de Configurações em Duas Camadas (Two-Tier Zero Downtime)
- **Camada de Bootstrap / Infraestrutura (`env/.env`):** Segredos do Docker, banco de dados e bind de rede (`POSTGRES_*`, `SIP_PUBLIC_IP`, `BACKEND_JWT_SECRET`).
- **Camada de Aplicação / Negócio (`system_config`):** Chaves dinâmicas com cache em memória (TTL 60s) e invalidação imediata via UI. Permite alterar credenciais Zabbix, Telegram, IA/LLMs, Active Directory, Jira e SMTP com **efeito imediato (Zero Downtime)**, sem reinicialização de containers.
- **Dual-Write Resiliente:** Ao salvar na interface web, o backend atualiza o banco de dados `system_config` (efeito em runtime) e persiste no arquivo `.env` (persistência após reboot).

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

### 5.3. Direcionamento da Análise Acústica e Escopo da Nota MOS (ITU-T P.800)
- **Origem do Sinal Analisado:** A análise acústica e o cálculo do MOS Score incidem estritamente sobre o **fluxo de áudio recebido (RX / Inbound Audio)** retornado pelo **número de destino que atendeu a chamada** (junto com o circuito de telecomunicação da operadora responsável pelo transporte).
- **O que a Nota MOS Reflete:**
  1. **Inteligibilidade da URA / Atendimento do Destino:** Mede a clareza da voz sintetizada ou humana emitida pelo número chamado.
  2. **Detecção de Linha Muda (*One-Way Audio*):** Identifica se a chamada completou com sinalização SIP 200 OK mas não entregou mídia RTP (silêncio superior a 80% do tempo de conversação).
  3. **Degradação de Rota da Operadora:** Detecta ruído de canal em dBFS, distorção espectral (*clipping*) e voz robótica decorrente de oscilações de jitter e perda de pacotes da operadora.
- **Caso de Uso Corporativo:** Permite aos gestores auditar com precisão a experiência auditiva que os clientes finais vivenciam ao discar para os números 0800 e centrais de atendimento da empresa.
