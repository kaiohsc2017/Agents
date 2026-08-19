# Matriz de Conectividade e Regras de Firewall — AgentIA

> **Classificação:** Documento Técnico Operacional / Cybersegurança & Redes  
> **Versão do Sistema:** AgentIA v3.2 (Ambiente Corporativo)  
> **Rede Interna Docker:** `agentia_agentia-net` (`172.16.9.0/24`)  
> **Sistemas Operacionais Alvo:** Ubuntu 22.04/24.04 LTS e Oracle Linux 9 (UEK/RHEL)

---

## 1. Visão Geral de Tráfego e Topologia de Rede

O **AgentIA** opera sob arquitetura de isolamento perimetral em containers Docker orquestrados. Todo o tráfego HTTP/HTTPS e WebSockets de borda é centralizado pelo **Caddy 2** (Reverse Proxy com TLS automático ACME), enquanto o tráfego de sinalização SIP e fluxo de mídia de áudio RTP é processado diretamente pelo **Asterisk 21 LTS** e pelo container de segurança **Fail2ban + nftables/UFW**.

```
                           ┌─────────────────────────────────────────────────────────────┐
                           │                         INTERNET                            │
                           └──────┬───────────────────────┬───────────────────────┬──────┘
                                  │ 80/443 (HTTP/HTTPS)   │ 5062 (SIP)            │ 16501-17000 (RTP)
                                  ▼                       ▼                       ▼
┌─────────────────────────────────┼───────────────────────┼───────────────────────┼──────────────────┐
│ HOST / BORDAS DE REDE           │                       │                       │                  │
│                                 ▼                       ▼                       ▼                  │
│                      ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐       │
│                      │    Caddy 2 Proxy    │ │  Asterisk 21 PBX    │ │  Fail2ban/nftables  │       │
│                      │ (TLS / HTTP / WSS)  │ │ (SIP / RTP / AMI)   │ │  (Security Agent)   │       │
│                      └──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘       │
│                                 │                       │                       │                  │
│ ── REDE DOCKER INTERNA (172.16.9.0/24) ─────────────────┼───────────────────────┼───────────────── │
│                                 │                       │                       │                  │
│       ┌─────────────────────────┼───────────────────────┼───────────────────────┴──────────┐       │
│       │                         │                       │                                  │       │
│       ▼                         ▼                       ▼                                  ▼       │
│ ┌──────────────┐         ┌──────────────┐        ┌──────────────┐                   ┌────────────┐ │
│ │   Frontend   │         │   Backend    │        │  Agents API  │                   │ PostgreSQL │ │
│ │ (React/Nginx)│         │(Spring Boot) │        │  (FastAPI)   │                   │ (pgvector) │ │
│ │ 172.16.9.15  │         │ 172.16.9.14  │        │ 172.16.9.16  │                   │172.16.9.11 │ │
│ └──────────────┘         └──────┬───────┘        └──────┬───────┘                   └─────▲──────┘ │
│                                 │                       │                                 │        │
│                                 ├───────────────────────┴─────────────────────────────────┘        │
│                                 ▼                                                                  │
│                          ┌──────────────┐                                                          │
│                          │Docker-Helper │ (172.16.9.13 - docker.sock isolado)                      │
│                          └──────────────┘                                                          │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Matriz de Conectividade Inbound (Entrada na Plataforma)

Esta seção define as portas e protocolos que **devem ser liberados nos firewalls perimetrais, Security Groups (AWS/OCI/Azure) e firewalls locais** (UFW/Firewalld) para o correto funcionamento do AgentIA.

| # | Origem | Porta / Protocolo | Destino (Host/Container) | Serviço / Aplicação | Justificativa Técnica | Obrigatório? |
|---|---|---|---|---|---|---|
| **IN-01** | Internet / Clientes Web | `80/tcp` | Host → Caddy 2 Proxy | HTTP (Redirecionamento / ACME) | Desafio HTTP-01 do Let's Encrypt / ZeroSSL para emissão automática de certificados TLS e redirecionamento para HTTPS. | **Sim** |
| **IN-02** | Internet / Navegadores | `443/tcp` | Host → Caddy 2 Proxy | HTTPS (TLS 1.3 / HTTP/2) | Acesso ao Dashboard Web, API REST, WebSocket STOMP e WebRTC Signaling WSS. | **Sim** |
| **IN-03** | Internet / Navegadores | `443/udp` | Host → Caddy 2 Proxy | HTTP/3 (QUIC) | Otimização de transporte HTTP/3 de alta velocidade e baixa latência para clientes web modernos. | Opcional (Recomendado) |
| **IN-04** | Operadora de Telefonia / SBC / PBX IP | `5062/udp` | Host → `agentia-asterisk:5060` | Sinalização PJSIP | Recepção de chamadas telefônicas reais, registro de ramais SIP e interconexão de tronco IP. | **Sim** |
| **IN-05** | Operadora de Telefonia / SBC / PBX IP | `5062/tcp` | Host → `agentia-asterisk:5060` | Sinalização PJSIP (TCP) | Sinalização SIP sobre TCP para operadoras que utilizam pacotes grandes ou SIP fragmentation. | **Sim** |
| **IN-06** | Operadoras de Telefonia / Softphones | `16501-17000/udp` | Host → `agentia-asterisk` | Mídia RTP (Áudio G.711 / Opus) | Transporte de pacotes de áudio bidirecional em tempo real (voz). Sem essa liberação ocorre problema de áudio mudo (*one-way audio*). | **Sim** |
| **IN-07** | Clientes WebRTC (Navegadores atrás de NAT) | `3478/udp`, `3478/tcp` | Host (`coturn`) | STUN / TURN Relay | Resolução de travessia de NAT para softphone integrado via navegador. | Condicional (Se CoTURN ativo) |
| **IN-08** | Clientes WebRTC (TLS Relay) | `5349/tcp`, `5349/udp` | Host (`coturn`) | TURNS (TURN sobre TLS) | Relay seguro de WebRTC para redes corporativas restritivas com bloqueio de UDP. | Condicional (Se CoTURN ativo) |
| **IN-09** | Relay de Mídia WebRTC | `49152-49652/udp` | Host (`coturn`) | Mídia TURN Relay | Mídia retransmitida quando o cliente não consegue conexão direta P2P/STUN. | Condicional (Se CoTURN ativo) |
| **IN-10** | Administradores / DevOps | `22/tcp` | Host Linux | SSH Seguro (OpenSSH) | Acesso administrativo seguro via chave pública Ed25519/RSA. | **Sim** (Restrito a IPs da equipe) |

> [!CAUTION]
> **Portas que NUNCA devem ser expostas externamente na Internet:**
> - `5432/tcp` ou `5435/tcp` (PostgreSQL): Vinculado estritamente a `127.0.0.1` no host para manutenção local e dentro da rede Docker.
> - `5038/tcp` (Asterisk AMI): Exposto apenas para a rede Docker interna `172.16.9.0/24`.
> - `8090/tcp` (Docker-Helper API): Acesso restrito a `172.16.9.13` com autenticação `X-Internal-Key`.
> - `8080/tcp` (Spring Boot API crua): Acesso apenas via proxy reverso Caddy.
> - `8000/tcp` (Agents FastAPI crua): Acesso apenas via proxy reverso Caddy.

---

## 3. Matriz de Conectividade Outbound (Saída da Plataforma para a Internet)

Esta tabela mapeia todos os destinos externos que os containers do AgentIA acessam para executar suas funções de Inteligência Artificial, integrações, monitoramento e atualizações.

| # | Serviço Destino | Domínio / Host | Porta / Protocolo | Container de Origem | Finalidade / Justificativa |
|---|---|---|---|---|---|
| **OUT-01** | **Google Gemini API** | `generativelanguage.googleapis.com` | `443/tcp` (HTTPS) | `agentia-backend`, `agentia-agents-api` | Motor primário de IA: LLM Gemini 2.5 Flash, transcrição STT, síntese de voz TTS, Function Calling. |
| **OUT-02** | **Google AI Portal** | `ai.google.dev` | `443/tcp` (HTTPS) | `agentia-backend` | Scheduler de sincronização de tabela de preços e precificação por token de IA. |
| **OUT-03** | **Anthropic Claude API** | `api.anthropic.com` | `443/tcp` (HTTPS) | `agentia-backend`, `agentia-agents-api` | Provedor alternativo de IA (Claude 3.5 Sonnet / Haiku) para automações e processamento de linguagem natural. |
| **OUT-04** | **OpenAI API** | `api.openai.com` | `443/tcp` (HTTPS) | `agentia-backend`, `agentia-agents-api` | Provedor alternativo de IA (GPT-4o, GPT-4o-mini, Whisper) e embeddings vetoriais. |
| **OUT-05** | **xAI Grok API** | `api.x.ai` | `443/tcp` (HTTPS) | `agentia-backend`, `agentia-agents-api` | Provedor de inteligência artificial Grok. |
| **OUT-06** | **Perplexity AI** | `api.perplexity.ai` | `443/tcp` (HTTPS) | `agentia-backend`, `agentia-agents-api` | Pesquisa e enriquecimento factual em tempo real para agentes autônomos. |
| **OUT-07** | **ElevenLabs Voice AI** | `api.elevenlabs.io` | `443/tcp` (HTTPS) | `agentia-backend` | Síntese de voz neural ultra-realista de baixa latência para telefonia. |
| **OUT-08** | **Atlassian Jira Cloud** | `*.atlassian.net` (específico do cliente) | `443/tcp` (HTTPS) | `agentia-backend` | Módulo 1: Criação e consulta automática de chamados Jira via URA Inteligente. |
| **OUT-09** | **Zabbix API** | `zabbix.*` (configurado em `.env`) | `80/tcp`, `443/tcp` | `agentia-backend` | Módulo 3: Polling de incidentes e triggers de monitoramento de infraestrutura. |
| **OUT-10** | **Telegram Bot API** | `api.telegram.org` | `443/tcp` (HTTPS) | `agentia-backend`, `agentia-agents-api` | Envio de alertas de incidentes críticos, notificações de execução de agentes e resumos operacionais. |
| **OUT-11** | **Let's Encrypt / ZeroSSL** | `acme-v02.api.letsencrypt.org`, `acme.zerossl.com` | `443/tcp` (HTTPS) | `agentia-caddy` / Caddy | Negociação e emissão automatizada de certificados TLS via protocolo ACME. |
| **OUT-12** | **Active Directory / LDAPS** | Host corporativo (`AD_LDAP_HOST`) | `636/tcp` (LDAPS) ou `389/tcp` | `agentia-backend` | Autenticação unificada de operadores e sincronização de grupos de acesso corporativos. |
| **OUT-13** | **Webhooks de Agentes** | URLs definidas nos agentes (`notify_webhook_url`) | `80/tcp`, `443/tcp` | `agentia-agents-api` | Notificação de conclusão de tarefas automatizadas para sistemas externos do cliente. *(SSO/SSRF protegido)* |
| **OUT-14** | **Google Public STUN** | `stun.l.google.com` | `19302/udp` | Navegadores dos Usuários | Descoberta de IP público para ICE Candidate no softphone WebRTC. |

---

## 4. Endereçamento e Comunicação Interna (Rede Docker `172.16.9.0/24`)

| IP Interno | Container / Serviço | Portas Internas | Comunica com | Finalidade Técnica |
|---|---|---|---|---|
| `172.16.9.11` | `agentia-postgres` | `5432/tcp` | `backend`, `agents-backend` | Persistência relacional, migrações Flyway e armazenamento vetorial (`pgvector`). |
| `172.16.9.12` | `agentia-asterisk` | `5038/tcp` (AMI), `5060/udp`, `8088/tcp` (HTTP/WS) | `backend`, `caddy` | Controle de chamadas via AMI, WebSockets WebRTC e canal de sinalização. |
| `172.16.9.13` | `agentia-docker-helper` | `8090/tcp` | `backend` | API segura para reinicialização e reload de containers autorizados (protegido por chave). |
| `172.16.9.14` | `agentia-backend` | `8080/tcp` | `postgres`, `asterisk`, `docker-helper`, `agents-backend` | Core da aplicação Spring Boot (negócio, agendamentos, telefonia, auth, auditoria). |
| `172.16.9.15` | `agentia-frontend` | `80/tcp` | `caddy` | Entrega dos ativos estáticos compilados do React SPA (Nginx interno). |
| `172.16.9.16` | `agentia-agents-api` | `8000/tcp` | `postgres`, `caddy`, `backend` | Motor FastAPI de orquestração de agentes autônomos (SSH, DB, Web, Logs, Scheduler). |
| Host (`127.0.0.1`) | `agentia-security` | Socket Unix `/var/run/fail2ban` | Host Kernel (nftables) | Inspeção em tempo real dos logs de segurança do Asterisk e bloqueio ativo de IPs agressores. |

---

## 5. Regras de Firewall para Aplicação Imediata

### 5.1. Implementação no Ubuntu Linux (`ufw`)

```bash
# Habilitar logging e política restritiva padrão
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Portas de Gestão e Web
sudo ufw allow 22/tcp comment 'SSH Administrativo'
sudo ufw allow 80/tcp comment 'Caddy HTTP ACME'
sudo ufw allow 443/tcp comment 'Caddy HTTPS'
sudo ufw allow 443/udp comment 'Caddy HTTP3 QUIC'

# Portas de Telefonia SIP e RTP
sudo ufw allow 5062/udp comment 'Asterisk SIP UDP'
sudo ufw allow 5062/tcp comment 'Asterisk SIP TCP'
sudo ufw allow 16501:17000/udp comment 'Asterisk RTP Media Range'

# CoTURN WebRTC (se utilizado)
sudo ufw allow 3478/udp comment 'STUN/TURN UDP'
sudo ufw allow 3478/tcp comment 'STUN/TURN TCP'
sudo ufw allow 5349/tcp comment 'TURNS TLS'
sudo ufw allow 49152:49652/udp comment 'TURN Media Relay'

# Ativar Firewall
sudo ufw enable
sudo ufw status verbose
```

### 5.2. Implementação no Oracle Linux 9 / RHEL (`firewalld`)

```bash
# Garantir serviço ativo
sudo systemctl enable --now firewalld

# Liberar Serviços Padrão
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Liberar Portas Customizadas de Telefonia
sudo firewall-cmd --permanent --add-port=443/udp
sudo firewall-cmd --permanent --add-port=5062/udp
sudo firewall-cmd --permanent --add-port=5062/tcp
sudo firewall-cmd --permanent --add-port=16501-17000/udp

# Liberar Portas de STUN/TURN (se utilizado)
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=3478/tcp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --permanent --add-port=5349/udp
sudo firewall-cmd --permanent --add-port=49152-49652/udp

# Recarregar regras e validar
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

---

## 6. Procedimento de Teste e Validação da Conectividade

Para validar se todas as regras e rotas estão em pleno funcionamento a partir do servidor:

```bash
# 1. Teste de saída para APIs de IA
curl -Is https://generativelanguage.googleapis.com | head -n 1
curl -Is https://api.anthropic.com | head -n 1
curl -Is https://api.openai.com | head -n 1

# 2. Teste de saída para mensageria Telegram
curl -Is https://api.telegram.org | head -n 1

# 3. Teste de escuta nas portas locais do host
sudo ss -tulpn | grep -E '(80|443|5062|16501)'

# 4. Validar integridade da resolução DNS dos containers
docker compose exec backend ping -c 2 generativelanguage.googleapis.com
docker compose exec agents-backend ping -c 2 api.telegram.org
```
