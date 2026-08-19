# Documentação Completa das APIs — AgentIA

> **Classificação:** Especificação OpenAPI / REST & WebSocket Developer Reference  
> **Versão da API:** v1 (Core Telecom) & v1 (Agents Engine)  
> **Autenticação:** JWT Bearer Token, Streaming Token (`scope=stream`), Chave Interna (`X-Internal-Key`)

---

## 1. Visão Geral de Autenticação e Headers

Todas as requisições às APIs públicas do AgentIA requerem autenticação, exceto os endpoints de saúde e login.

### Headers de Autenticação Padrão:

```http
Authorization: Bearer <seu_jwt_token_aqui>
Content-Type: application/json
Accept: application/json
```

### Para APIs Internas (ex: Docker-Helper / Scripts de Manutenção):

```http
X-Internal-Key: <chave_definida_em_INTERNAL_API_KEY>
```

---

## 2. API de Autenticação e Sessão (Telecom Core)

### 2.1. Login de Usuário
- **Endpoint:** `POST /api/v1/auth/login`
- **Autenticação:** Pública
- **Descrição:** Autentica um usuário local ou via Active Directory, retornando o token de acesso JWT e as permissões.

#### Request Body:
```json
{
  "username": "admin",
  "password": "SuaSenhaForte123!"
}
```

#### Response (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "admin",
  "role": "ADMIN",
  "requiresTotp": false,
  "perms": {
    "telecom.dashboard": "r",
    "telecom.modulo2": "rw",
    "telecom.modulo3": "rw",
    "telecom.users": "rw",
    "telecom.settings": "rw",
    "agents.agents": "rw"
  },
  "businessUnits": [1, 2, 3]
}
```

---

## 3. APIs de Telecomunicações & Conectividade (Módulo 2)

### 3.1. Listar Resultados dos Testes de Conectividade
- **Endpoint:** `GET /api/v1/connectivity/results`
- **Autenticação:** Bearer Token (Permissão: `telecom.modulo2` -> `r`)
- **Query Params:**
  - `page` (int, default: 0)
  - `size` (int, default: 20)
  - `status` (string, opcional: `SUCESSO`, `FALHA`, `OCUPADO`, `SEM_RESPOSTA`, `TIMEOUT`)
  - `businessUnitId` (int, opcional)

#### Exemplo cURL:
```bash
curl -s -X GET "https://agentia.voiphash.com.br/api/v1/connectivity/results?page=0&size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### Response (200 OK):
```json
{
  "content": [
    {
      "id": 1042,
      "numero": "08007771234",
      "tipo": "0800",
      "status": "SUCESSO",
      "operadora": "Claro",
      "executedAt": "2026-08-19T01:15:00Z",
      "durationSeconds": 14,
      "ringTimeSeconds": 4,
      "recordingPath": "/var/spool/asterisk/monitor/20260819_08007771234.wav",
      "hasAudio": true,
      "businessUnitId": 1
    }
  ],
  "totalPages": 15,
  "totalElements": 142,
  "size": 10,
  "number": 0
}
```

### 3.2. Disparar Teste Manual de Linha / 0800
- **Endpoint:** `POST /api/v1/connectivity/test`
- **Autenticação:** Bearer Token (Permissão: `telecom.modulo2` -> `rw`)

#### Request Body:
```json
{
  "numero": "08007771234",
  "tipo": "0800",
  "businessUnitId": 1
}
```

#### Response (200 OK):
```json
{
  "testId": 1043,
  "status": "INICIADO",
  "message": "Chamada originada no PBX com sucesso. Acompanhe pelo WebSocket."
}
```

---

## 4. APIs de Cadastros Principais (Master Data)

### 4.1. Gerenciamento de Linhas Telefônicas
- **Listar Linhas:** `GET /api/v1/linhas`
- **Criar Linha:** `POST /api/v1/linhas`
- **Atualizar Linha:** `PUT /api/v1/linhas/{id}`
- **Deletar Linha:** `DELETE /api/v1/linhas/{id}`

#### Request Body (Criar Linha):
```json
{
  "numero": "1133334444",
  "descricao": "Linha Principal Recepção SP",
  "operadoraId": 2,
  "clientId": 5,
  "businessUnitId": 1,
  "ativo": true
}
```

### 4.2. Gerenciamento de Números 0800
- **Listar 0800:** `GET /api/v1/cadastro0800`
- **Criar 0800:** `POST /api/v1/cadastro0800`
- **Atualizar 0800:** `PUT /api/v1/cadastro0800/{id}`
- **Deletar 0800:** `DELETE /api/v1/cadastro0800/{id}`

---

## 5. APIs da Plataforma de Agentes Autônomos (FastAPI)

### 5.1. Listar Agentes Cadastrados
- **Endpoint:** `GET /agents/api/agents`
- **Autenticação:** Bearer Token (Permissão: `agents.agents` -> `r`)

#### Response (200 OK):
```json
[
  {
    "id": 1,
    "name": "Agente Healthcheck Servidores",
    "type": "ssh",
    "description": "Verifica uso de disco e memória nos servidores de banco.",
    "schedule_cron": "0 */2 * * *",
    "is_active": true,
    "target_server_id": 3,
    "command": "df -h && free -m",
    "notify_telegram": true
  }
]
```

### 5.2. Executar Agente Manualmente
- **Endpoint:** `POST /agents/api/agents/{id}/execute`
- **Autenticação:** Bearer Token (Permissão: `agents.agents` -> `rw`)

#### Response (202 Accepted):
```json
{
  "execution_id": 89,
  "agent_id": 1,
  "status": "RUNNING",
  "started_at": "2026-08-19T01:20:00Z"
}
```

### 5.3. Consultar Status e Log de Execução
- **Endpoint:** `GET /agents/api/executions/{execution_id}`

#### Response (200 OK):
```json
{
  "id": 89,
  "agent_id": 1,
  "status": "SUCCESS",
  "duration_seconds": 3.42,
  "output": "Filesystem Size Used Avail Use%\n/dev/sda1 100G 34G 66G 34%\nMem: 32000 14500 17500",
  "completed_at": "2026-08-19T01:20:03Z",
  "error_message": null
}
```

---

## 6. APIs de Configurações e Infraestrutura (Docker-Helper)

### 6.1. Recarregar Configurações do Asterisk
- **Endpoint:** `POST /api/v1/settings/asterisk/reload`
- **Autenticação:** Bearer Token (Permissão: `telecom.settings` -> `rw`)

#### Response (200 OK):
```json
{
  "status": "SUCCESS",
  "message": "PJSIP e Dialplan do Asterisk recarregados com sucesso."
}
```

### 6.2. APIs de Configuração Dinâmica em Duas Camadas (Zero Downtime)

- **Listar Todas as Configurações com Categorias:** `GET /api/v1/config/all`
- **Consultar Valor por Chave:** `GET /api/v1/config/key/{key}`
- **Atualizar Chave com Efeito Imediato (Zero Downtime):** `PUT /api/v1/config/key/{key}`
  - **Payload:** `{"value": "novo_valor"}`
  - **Efeito:** Invalidação de cache em memória no Spring Boot + persistência em `system_config` + sincronização no `.env`.
- **Listar Categorias Disponíveis:** `GET /api/v1/config/categories`

### 6.3. Endpoint Interno do Docker-Helper
- **Endpoint:** `POST http://docker-helper:8090/container/restart`
- **Header:** `X-Internal-Key: <INTERNAL_API_KEY>`

#### Request Body:
```json
{
  "container_name": "agentia-backend"
}
```

#### Response (200 OK):
```json
{
  "status": "ok",
  "container": "agentia-backend",
  "action": "restart"
}
```

---

## 7. WebSocket STOMP em Tempo Real

- **Endpoint de Conexão:** `wss://agentia.voiphash.com.br/ws-telecom`
- **Autenticação:** Streaming Token na query string: `?token=<STREAMING_TOKEN>`

### Tópicos para Inscrição:
- `/topic/connectivity`: Eventos em tempo real de início, ring, atendimento e encerramento de testes de conectividade.
- `/topic/alerts`: Novos alertas de infraestrutura detectados pelo Zabbix.
- `/topic/agent-executions`: Notificações de progresso e encerramento de agentes autônomos.

#### Exemplo de Payload Recebido em `/topic/connectivity`:
```json
{
  "event": "TEST_COMPLETED",
  "testId": 1043,
  "numero": "08007771234",
  "status": "SUCESSO",
  "durationSeconds": 12,
  "ringTimeSeconds": 3
}
```
