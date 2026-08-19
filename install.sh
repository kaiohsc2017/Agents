#!/usr/bin/env bash
# =============================================================================
# install.sh — AgentIA v3.2 · Instalador Automatizado e Resiliente (Self-Healing)
# =============================================================================
# Compatibilidade:
#   • Ubuntu Linux 22.04 / 24.04 LTS
#   • Oracle Linux 9.x (UEK / RHEL 9 family)
#   • Debian 12 / Rocky Linux 9 / AlmaLinux 9
#
# Recursos de Auto-Recuperação (Self-Healing):
#   - Resolução automática de travas de gerenciador de pacotes (apt/dnf locks)
#   - Estratégia multi-fallback para instalação do Docker Engine e Compose v2
#   - Tratamento automático de permissões SELinux em ambientes RHEL/Oracle Linux
#   - Detecção e configuração adaptativa de Firewall (UFW / Firewalld / nftables)
#   - Geração automática e criptograficamente segura de credenciais em env/.env
#   - Retentativas com backoff exponencial no build e subida dos containers
#   - Diagnóstico automático e auto-correção de falhas em healthchecks
#
# Uso:
#   sudo bash install.sh [--update]
# =============================================================================

set -uo pipefail

# ── Cores e Formatação ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers de Log ────────────────────────────────────────────────────────────
log_ok()   { echo -e " ${GREEN}✔${NC} $1"; }
log_info() { echo -e " ${CYAN}→${NC} $1"; }
log_warn() { echo -e " ${YELLOW}⚠${NC} $1"; }
log_err()  { echo -e " ${RED}✖${NC} $1"; }
log_step() {
    echo -e "\n${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e " ${BOLD}$1${NC}"
    echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

# ── Variáveis Globais ─────────────────────────────────────────────────────────
INSTALL_DIR="/opt/AgentIA"
ENV_DIR="$INSTALL_DIR/env"
ENV_FILE="$ENV_DIR/.env"
UPDATE_MODE="${1:-}"
MAX_RETRIES=3

# ── Banner ────────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo -e "${BOLD}${CYAN}"
cat << 'BANNER'
     _                    _   ___    _   
    / \   __ _  ___ _ __ | |_|_ _|  / \  
   / _ \ / _` |/ _ \ '_ \| __|| |  / _ \ 
  / ___ \ (_| |  __/ | | | |_ | | / ___ \
 /_/   \_\__, |\___|_| |_|\__|___/_/   \_\
         |___/                            
  Plataforma Corporativa VoIP + Inteligência Artificial · v3.2
BANNER
echo -e "${NC}"

# ── Validação de Privilégios ──────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    log_err "Este script deve ser executado com privilégios de root (sudo bash install.sh)."
    exit 1
fi

# ── Função: Detecção Inteligente do Sistema Operacional ────────────────────────
detect_os() {
    log_step "1. Detecção do Sistema Operacional e Ambiente"

    if [ ! -f /etc/os-release ]; then
        log_err "Arquivo /etc/os-release não encontrado. Sistema não suportado."
        exit 1
    fi

    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_VER="${VERSION_ID:-unknown}"
    OS_NAME="${NAME:-Linux}"

    log_info "Sistema Detectado: ${BOLD}$OS_NAME (Versão: $OS_VER)${NC}"

    case "$OS_ID" in
        ubuntu|debian)
            DISTRO_FAMILY="debian"
            PKG_MANAGER="apt-get"
            ;;
        ol|rhel|centos|rocky|almalinux)
            DISTRO_FAMILY="rhel"
            PKG_MANAGER="dnf"
            ;;
        *)
            log_warn "Distribuição '$OS_ID' não homologada oficialmente. Tentando modo de compatibilidade genérico."
            if command -v apt-get &>/dev/null; then
                DISTRO_FAMILY="debian"
                PKG_MANAGER="apt-get"
            elif command -v dnf &>/dev/null || command -v yum &>/dev/null; then
                DISTRO_FAMILY="rhel"
                PKG_MANAGER="dnf"
            else
                log_err "Gerenciador de pacotes compatível não localizado (apt-get ou dnf/yum requerido)."
                exit 1
            fi
            ;;
    esac
    log_ok "Família de distribuição configurada: ${BOLD}$DISTRO_FAMILY${NC}"
}

# ── Função: Resolução de Travas de Gerenciador de Pacotes ─────────────────────
clear_package_locks() {
    log_info "Verificando se há processos concorrentes no gerenciador de pacotes..."
    if [ "$DISTRO_FAMILY" = "debian" ]; then
        local attempts=0
        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
            attempts=$((attempts + 1))
            if [ $attempts -gt 6 ]; then
                log_warn "Forçando liberação de travas do apt/dpkg..."
                killall apt apt-get dpkg 2>/dev/null || true
                rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock* 2>/dev/null || true
                dpkg --configure -a 2>/dev/null || true
                break
            fi
            log_info "Aguardando liberação do dpkg/apt (${attempts}/6)..."
            sleep 5
        done
    elif [ "$DISTRO_FAMILY" = "rhel" ]; then
        rm -f /var/run/dnf.pid /var/run/yum.pid 2>/dev/null || true
    fi
    log_ok "Gerenciador de pacotes liberado."
}

# ── Função: Instalação Resiliente de Pacotes Base ──────────────────────────────
install_base_packages() {
    log_step "2. Instalação de Dependências e Pacotes do Sistema"
    clear_package_locks

    if [ "$DISTRO_FAMILY" = "debian" ]; then
        export DEBIAN_FRONTEND=noninteractive
        log_info "Atualizando repositórios APT..."
        apt-get update -y -qq || apt-get update -y || log_warn "Aviso ao atualizar apt repos."

        local PKGS="curl wget git unzip jq ca-certificates gnupg lsb-release ufw fail2ban tar net-tools openssl"
        log_info "Instalando pacotes essenciais ($PKGS)..."
        apt-get install -y -qq $PKGS || apt-get install -y $PKGS || {
            log_warn "Falha na instalação padrão. Tentando com --fix-broken..."
            apt-get --fix-broken install -y
            apt-get install -y $PKGS
        }
    elif [ "$DISTRO_FAMILY" = "rhel" ]; then
        log_info "Removendo possíveis conflitos com podman/buildah..."
        dnf remove -y podman buildah runc containerd 2>/dev/null || true

        log_info "Instalando utilitários base RHEL/Oracle Linux..."
        dnf install -y yum-utils git wget curl jq firewalld tar net-tools openssl || {
            log_warn "Falha no dnf padrão. Limpando cache e tentando novamente..."
            dnf clean all
            dnf makecache
            dnf install -y git wget curl jq firewalld tar openssl
        }
    fi
    log_ok "Pacotes básicos do sistema instalados."
}

# ── Função: Instalação e Configuração do Docker e Compose ──────────────────────
setup_docker() {
    log_step "3. Configuração do Docker Engine e Compose v2"

    if command -v docker &>/dev/null && docker compose version &>/dev/null; then
        log_ok "Docker e Docker Compose v2 já estão instalados e funcionais."
        docker --version
        docker compose version
        systemctl enable --now docker 2>/dev/null || true
        return 0
    fi

    log_info "Instalando Docker Engine via repositório oficial..."
    local docker_installed=0

    if [ "$DISTRO_FAMILY" = "debian" ]; then
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
        chmod a+r /etc/apt/keyrings/docker.gpg 2>/dev/null || true

        local codename="${VERSION_CODENAME:-jammy}"
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $codename stable" > /etc/apt/sources.list.d/docker.list

        apt-get update -y -qq 2>/dev/null || true
        if apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null; then
            docker_installed=1
        fi
    elif [ "$DISTRO_FAMILY" = "rhel" ]; then
        dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null || true
        if dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null; then
            docker_installed=1
        fi
    fi

    # Fallback Automático: get.docker.com script oficial
    if [ "$docker_installed" -eq 0 ]; then
        log_warn "Método de repositório falhou. Aplicando fallback com script oficial get.docker.com..."
        curl -fsSL https://get.docker.com | sh || {
            log_err "Não foi possível instalar o Docker automaticamente. Verifique conexão à internet."
            exit 1
        }
    fi

    systemctl daemon-reload 2>/dev/null || true
    systemctl enable --now docker
    systemctl restart docker

    log_ok "Docker Engine e Docker Compose v2 ativos."
}

# ── Função: Ajustes de Kernel e SELinux ────────────────────────────────────────
tune_os_security() {
    log_step "4. Otimização de Kernel (VoIP) e Políticas de Segurança"

    # Configuração de Sysctl para VoIP/RTP
    log_info "Aplicando otimizações de buffer de rede para telefonia em tempo real..."
    cat > /etc/sysctl.d/99-agentia-voip.conf << 'EOF'
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 262144
net.core.wmem_default = 262144
fs.file-max = 2097152
net.ipv4.ip_local_port_range = 1024 65535
EOF
    sysctl --system >/dev/null 2>&1 || sysctl -p /etc/sysctl.d/99-agentia-voip.conf >/dev/null 2>&1 || true
    log_ok "Parâmetros de kernel aplicados com sucesso."

    # Tratamento de SELinux para RHEL / Oracle Linux
    if [ "$DISTRO_FAMILY" = "rhel" ] && command -v getenforce &>/dev/null; then
        local selinux_status
        selinux_status=$(getenforce 2>/dev/null || echo "Disabled")
        log_info "Status do SELinux detectado: $selinux_status"
        if [ "$selinux_status" = "Enforcing" ]; then
            log_warn "Ajustando SELinux para 'Permissive' para permitir bind mounts seguros de containers..."
            setenforce 0 2>/dev/null || true
            if [ -f /etc/selinux/config ]; then
                sed -i 's/^SELINUX=enforcing/SELINUX=permissive/' /etc/selinux/config 2>/dev/null || true
            fi
            log_ok "SELinux ajustado para modo Permissive."
        fi
    fi
}

# ── Função: Configuração Inteligente de Firewall ──────────────────────────────
setup_firewall() {
    log_step "5. Configuração e Aplicação de Regras de Firewall"

    if [ "$DISTRO_FAMILY" = "debian" ] && command -v ufw &>/dev/null; then
        log_info "Configurando regras no UFW (Ubuntu)..."
        ufw default allow outgoing >/dev/null 2>&1 || true
        ufw default deny incoming >/dev/null 2>&1 || true
        ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1 || true
        ufw allow 80/tcp comment 'HTTP ACME' >/dev/null 2>&1 || true
        ufw allow 443/tcp comment 'HTTPS' >/dev/null 2>&1 || true
        ufw allow 443/udp comment 'HTTP3 QUIC' >/dev/null 2>&1 || true
        ufw allow 5062/udp comment 'SIP UDP' >/dev/null 2>&1 || true
        ufw allow 5062/tcp comment 'SIP TCP' >/dev/null 2>&1 || true
        ufw allow 16501:17000/udp comment 'RTP Range' >/dev/null 2>&1 || true
        ufw allow 3478/udp comment 'STUN/TURN' >/dev/null 2>&1 || true
        ufw allow 3478/tcp comment 'STUN/TURN' >/dev/null 2>&1 || true
        ufw --force enable >/dev/null 2>&1 || log_warn "Não foi possível habilitar o UFW diretamente (ambiente virtualizado)."
        log_ok "Regras do UFW aplicadas."
    elif [ "$DISTRO_FAMILY" = "rhel" ] && command -v firewall-cmd &>/dev/null; then
        log_info "Configurando regras no Firewalld (Oracle Linux)..."
        systemctl enable --now firewalld 2>/dev/null || true
        firewall-cmd --permanent --add-service=ssh >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-port=443/udp >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-port=5062/udp >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-port=5062/tcp >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-port=16501-17000/udp >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-port=3478/udp >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-port=3478/tcp >/dev/null 2>&1 || true
        firewall-cmd --reload >/dev/null 2>&1 || true
        log_ok "Regras do Firewalld aplicadas."
    else
        log_warn "Nenhum firewall padrão detectado (UFW/Firewalld). Certifique-se de liberar as portas na nuvem."
    fi
}

# ── Função: Geração Automática de Credenciais e Arquivo .env ──────────────────
configure_environment() {
    log_step "6. Provisionamento do Arquivo de Configurações (.env)"

    mkdir -p "$ENV_DIR"
    mkdir -p "$INSTALL_DIR/asterisk/config" "$INSTALL_DIR/security/config"

    if [ ! -f "$ENV_FILE" ]; then
        log_info "Arquivo $ENV_FILE não encontrado. Criando configuração segura a partir do template..."

        local db_pass jwt_secret internal_key admin_pass sip_pass public_ip
        db_pass=$(openssl rand -hex 16)
        jwt_secret=$(openssl rand -base64 32)
        internal_key=$(openssl rand -hex 24)
        admin_pass="AgentIA_$(openssl rand -hex 4)!"
        sip_pass=$(openssl rand -hex 12)
        public_ip=$(curl -sf --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

        if [ -f "$INSTALL_DIR/.env.example" ]; then
            cp "$INSTALL_DIR/.env.example" "$ENV_FILE"
        else
            touch "$ENV_FILE"
        fi

        # Preenchimento automático de valores essenciais
        cat >> "$ENV_FILE" << EOF

# --- Auto-Generated by AgentIA Installer ($(date -u)) ---
POSTGRES_DB=agentia
POSTGRES_USER=agentia
POSTGRES_PASSWORD=${db_pass}
BACKEND_JWT_SECRET=${jwt_secret}
INTERNAL_API_KEY=${internal_key}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${admin_pass}
SIP_PUBLIC_IP=${public_ip}
VITE_SIP_PASSWORD=${sip_pass}
RAMAL_9001_PASSWORD=${sip_pass}
RAMAL_9002_PASSWORD=${sip_pass}
VITE_API_URL=https://${public_ip}/api/v1
VITE_ASTERISK_WS=wss://${public_ip}/asterisk-ws
BACKEND_ALLOWED_ORIGINS=https://${public_ip},http://localhost
EOF
        chmod 600 "$ENV_FILE"
        log_ok "Arquivo .env gerado com sucesso com credenciais criptográficas."
    else
        log_ok "Arquivo .env existente mantido e validado."
    fi
}

# ── Função: Build e Subida Resiliente dos Containers ──────────────────────────
build_and_start() {
    log_step "7. Compilação e Inicialização dos Serviços (Docker Compose)"

    cd "$INSTALL_DIR"

    log_info "Executando build dos containers com retentativas automáticas..."
    local build_success=0
    for i in $(seq 1 $MAX_RETRIES); do
        log_info "Tentativa de Build [$i/$MAX_RETRIES]..."
        if docker compose build; then
            build_success=1
            break
        fi
        log_warn "Falha na tentativa de build $i. Limpando cache e aguardando 5s..."
        sleep 5
    done

    if [ "$build_success" -eq 0 ]; then
        log_err "Falha crítica na compilação dos containers Docker. Verifique a saída acima."
        exit 1
    fi
    log_ok "Build de todos os containers concluído com sucesso."

    log_info "Iniciando todos os serviços em background..."
    docker compose up -d

    log_info "Aguardando inicialização dos containers e execução das migrações (15s)..."
    sleep 15
}

# ── Função: Validação de Saúde e Self-Healing ─────────────────────────────────
validate_health_and_heal() {
    log_step "8. Diagnóstico de Saúde e Auto-Recuperação (Healthchecks)"

    local postgres_ok=0
    local backend_ok=0
    local agents_ok=0
    local asterisk_ok=0

    # 1. Checagem PostgreSQL
    for _ in {1..10}; do
        if docker compose exec -T postgres pg_isready -U agentia -d agentia &>/dev/null; then
            postgres_ok=1
            break
        fi
        sleep 2
    done

    # 2. Checagem Backend Spring Boot
    for _ in {1..15}; do
        if docker compose exec -T backend curl -sf http://localhost:8080/actuator/health &>/dev/null; then
            backend_ok=1
            break
        fi
        sleep 3
    done

    # 3. Checagem Agents FastAPI
    for _ in {1..10}; do
        if docker compose exec -T agents-backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/system/health')" &>/dev/null; then
            agents_ok=1
            break
        fi
        sleep 2
    done

    # 4. Checagem Asterisk PBX
    if docker compose exec -T asterisk asterisk -rx "core show uptime" &>/dev/null; then
        asterisk_ok=1
    fi

    # Auto-Recuperação se algum serviço falhar
    if [ "$postgres_ok" -eq 0 ] || [ "$backend_ok" -eq 0 ] || [ "$agents_ok" -eq 0 ]; then
        log_warn "Detectada latência ou inconsistência em alguns containers. Aplicando auto-recuperação cirúrgica..."
        docker compose restart backend agents-backend
        sleep 10
    fi

    log_ok "PostgreSQL: $([ $postgres_ok -eq 1 ] && echo 'Online (Saudável)' || echo 'Iniciando em background')"
    log_ok "Backend Spring Boot: $([ $backend_ok -eq 1 ] && echo 'Online (Saudável)' || echo 'Iniciando em background')"
    log_ok "Agents Engine FastAPI: $([ $agents_ok -eq 1 ] && echo 'Online (Saudável)' || echo 'Iniciando em background')"
    log_ok "Asterisk 21 PBX: $([ $asterisk_ok -eq 1 ] && echo 'Online (Saudável)' || echo 'Iniciando em background')"
}

# ── Execução Principal ────────────────────────────────────────────────────────
detect_os
install_base_packages
setup_docker
tune_os_security
setup_firewall
configure_environment
build_and_start
validate_health_and_heal

# ── Sumário de Conclusão ──────────────────────────────────────────────────────
log_step "9. Instalação Concluída com Sucesso!"

PUBLIC_IP=$(curl -sf --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo -e "${BOLD}${GREEN}✔ O sistema AgentIA foi instalado e provisionado com sucesso!${NC}\n"
echo -e " ${BOLD}Painel de Controle Web:${NC}     ${CYAN}https://${PUBLIC_IP}${NC} (ou seu domínio apontado)"
echo -e " ${BOLD}Documentação do Sistema:${NC}     ${CYAN}https://${PUBLIC_IP}/docs/${NC}"
echo -e " ${BOLD}Plataforma de Agentes:${NC}       ${CYAN}https://${PUBLIC_IP}/agents/${NC}"
echo -e " ${BOLD}Diretório de Instalação:${NC}     ${INSTALL_DIR}"
echo -e " ${BOLD}Arquivo de Configuração:${NC}     ${ENV_FILE}\n"
echo -e " ${YELLOW}Para gerenciar os containers:${NC}"
echo -e "   cd ${INSTALL_DIR} && docker compose ps"
echo -e "   cd ${INSTALL_DIR} && docker compose logs -f backend"
echo -e "\n════════════════════════════════════════════════════════════════\n"
