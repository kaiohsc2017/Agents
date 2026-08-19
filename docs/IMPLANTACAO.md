# Guia Completo de Implantação e Provisionamento — AgentIA

> **Classificação:** Procedimento Operacional Padrão (SOP / Runbook DevOps)  
> **Sistemas Operacionais Suportados:** Ubuntu Linux 22.04/24.04 LTS e Oracle Linux 9 (UEK/RHEL)  
> **Versão do Sistema:** AgentIA v3.2  
> **Diretório Padrão de Instalação:** `/opt/AgentIA`

---

## 1. Requisitos Mínimos e Dimensionamento de Hardware

| Perfil de Uso | CPUs Virtuais (vCPU) | Memória RAM | Armazenamento (SSD/NVMe) | Recomendação de Ambiente |
|---|---|---|---|---|
| **Piloto / Homologação** | 2 vCPUs | 4 GB | 40 GB SSD | Testes de desenvolvimento e validação. |
| **Produção Padrão** | 4 vCPUs | 8 GB | 80 GB NVMe | Até 30 chamadas simultâneas + 10 agentes ativos. |
| **Alta Carga / Enterprise** | 8 vCPUs | 16 GB | 200 GB NVMe | Mais de 100 chamadas simultâneas + RAG vetorial pesado. |

---

## 2. Passo a Passo: Implantação no Ubuntu 22.04 / 24.04 LTS

### Passo 2.1. Atualização do Sistema Operacional e Pacotes Básicos

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git unzip htop ufw fail2ban jq ca-certificates gnupg lsb-release
```

### Passo 2.2. Instalação Oficial do Docker Engine e Compose v2

```bash
# Adicionar chave GPG oficial da Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Configurar repositório estável
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker CE
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Habilitar e iniciar serviço
sudo systemctl enable --now docker
```

### Passo 2.3. Otimização de Kernel (Sysctl para VoIP e Concorrência)

Adicione as configurações no arquivo `/etc/sysctl.d/99-agentia-voip.conf`:

```ini
# Aumentar buffers de socket para áudio RTP sem descarte
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 262144
net.core.wmem_default = 262144

# Aumentar tabela de conexões e arquivos abertos
fs.file-max = 2097152
net.ipv4.ip_local_port_range = 1024 65535
```

Aplique as mudanças:
```bash
sudo sysctl --system
```

### Passo 2.4. Configuração de Firewall (`ufw`)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP ACME'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 443/udp comment 'HTTP3 QUIC'
sudo ufw allow 5062/udp comment 'Asterisk SIP'
sudo ufw allow 5062/tcp comment 'Asterisk SIP TCP'
sudo ufw allow 16501:17000/udp comment 'Asterisk RTP'
sudo ufw enable
```

---

## 3. Passo a Passo: Implantação no Oracle Linux 9 (UEK / RHEL)

### Passo 3.1. Preparação do Sistema e Remoção de Pacotes Conflitantes

No Oracle Linux 9, o pacote `podman` / `buildah` pode conflitar com o Docker oficial. Remova-os antes de prosseguir:

```bash
sudo dnf update -y
sudo dnf remove -y podman buildah runc containerd || true
sudo dnf install -y yum-utils git wget curl htop jq firewalld tar
```

### Passo 3.2. Instalação do Docker CE Oficial (Repositório CentOS/RHEL 9)

```bash
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
```

### Passo 3.3. Configuração do SELinux para Bind Mounts Docker

Para garantir que os containers possam ler/gravar diretórios compartilhados (`/opt/AgentIA/env`, `/opt/AgentIA/asterisk/config`, etc.) sem travamentos de *Permission Denied*:

```bash
# Colocar em modo Permissive no runtime e persistir
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing/SELINUX=permissive/' /etc/selinux/config
```

### Passo 3.4. Configuração do Firewall (`firewalld`)

```bash
sudo systemctl enable --now firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=443/udp
sudo firewall-cmd --permanent --add-port=5062/udp
sudo firewall-cmd --permanent --add-port=5062/tcp
sudo firewall-cmd --permanent --add-port=16501-17000/udp
sudo firewall-cmd --reload
```

---

## 4. Clonagem do Repositório e Configuração de Ambiente

### Passo 4.1. Clonagem e Permissões de Diretório

```bash
sudo mkdir -p /opt/AgentIA
sudo chown -R $USER:$USER /opt/AgentIA
git clone https://github.com/kaiohsc2017/Agents.git /opt/AgentIA
cd /opt/AgentIA
```

### Passo 4.2. Configuração do Arquivo de Variáveis de Ambiente (`env/.env`)

```bash
mkdir -p env
cp .env.example env/.env
chmod 600 env/.env
```

Edite o arquivo `env/.env` com seus dados reais:

```ini
# Configurações do Banco de Dados
POSTGRES_DB=agentia
POSTGRES_USER=agentia
POSTGRES_PASSWORD=DefinaUmaSenhaExtremamenteForteETourada123!

# Segurança e JWT
BACKEND_JWT_SECRET=GereUmSegredoBase64DePeloMenos256BitsAqui==
INTERNAL_API_KEY=ChaveInternaUltraSeguraDockerHelper

# Administrador Inicial
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SuaSenhaForteAdmin2026!

# URLs e Domínios
VITE_API_URL=https://agentia.suaempresa.com.br/api/v1
VITE_ASTERISK_WS=wss://agentia.suaempresa.com.br/asterisk-ws
BACKEND_ALLOWED_ORIGINS=https://agentia.suaempresa.com.br

# Chaves de Inteligência Artificial
GEMINI_API_KEY=AIzaSy...
```

---

## 5. Inicialização e Subida dos Serviços

```bash
cd /opt/AgentIA

# 1. Realizar o build completo de todos os containers
docker compose build --no-cache

# 2. Iniciar todos os serviços em background
docker compose up -d

# 3. Validar o status de saúde dos containers
docker compose ps
```

Todos os 6 containers principais devem exibir o status `healthy` ou `running`:
- `agentia-postgres` (Porta 5435)
- `agentia-asterisk` (Portas 5062, 16501-17000)
- `agentia-docker-helper` (Porta 8090)
- `agentia-backend` (Porta 8080)
- `agentia-frontend` (Porta 80)
- `agentia-agents-api` (Porta 8000)
- `agentia-security` (Fail2ban ativo)

---

## 6. Verificação e Testes de Validação (Smoke Tests)

```bash
# Validar endpoint de saúde do backend Spring Boot
curl -s http://localhost:8080/actuator/health | jq .

# Validar endpoint de saúde da API de Agentes FastAPI
curl -s http://localhost:8000/api/system/health | jq .

# Validar funcionamento do PBX Asterisk
docker compose exec asterisk asterisk -rx "core show uptime"
docker compose exec asterisk asterisk -rx "pjsip show endpoints"
```

---

## 7. Troubleshooting e Resolução de Problemas Comuns

| Sintoma Observado | Causa Mais Provável | Procedimento de Correção |
|---|---|---|
| **Erro 502 Bad Gateway no Caddy** | Container `agentia-frontend` ou `agentia-backend` ainda subindo. | Verifique logs: `docker compose logs -f backend`. Aguarde as migrações Flyway finalizarem. |
| **Áudio mudo na chamada (One-Way Audio)** | Range de portas RTP `16501-17000/udp` bloqueado no firewall de borda ou NAT. | Libere o range UDP no Security Group do provedor em nuvem e valide `SIP_PUBLIC_IP` no `.env`. |
| **Erro de conexão ao banco de dados** | Senha do PostgreSQL divergente ou volume com dados antigos. | Verifique `POSTGRES_PASSWORD` no `env/.env` e compare com `SPRING_DATASOURCE_PASSWORD`. |
| **Softphone WebRTC não registra (403/408)** | Certificado SSL ausente ou chave WSS rejeitada. | Confirme que o acesso web é feito via HTTPS válido com certificado ativo pelo Caddy. |
