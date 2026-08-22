# AgentIA — Frontend SPA

Interface Web unificada em Single Page Application (SPA) para a plataforma corporativa **AgentIA**, integrando telemetria de telefonia/conectividade, monitoramento de alarmes, softphone WebRTC e a suíte nativa de orquestração de Agentes Autônomos de IA e Agent Flow Canvas (DAG).

---

## 🛠️ Stack Tecnológica

- **Framework:** React 19
- **Linguagem:** TypeScript 5.x (`strict: true`)
- **Build Tool:** Vite 6
- **Estilização:** Tailwind CSS v3 + Radix UI / shadcn/ui + Geist Typography
- **Gráficos & Visualização:** Recharts
- **Telefonia WebRTC:** JsSIP (SIP over WebSocket WSS)
- **Comunicação em Tempo Real:** WebSockets (FastAPI streaming & Spring Boot STOMP)
- **Ícones:** Lucide React

---

## 📁 Estrutura de Diretórios

```text
frontend/src/
├── api/              # Clientes de API REST, interceptors de autenticação JWT e refresh token
├── components/       # Componentes reutilizáveis de interface
│   ├── agents/       # Telas e módulos nativos da Plataforma de Agentes IA & Flow Canvas
│   ├── common/       # Header, Sidebar, Modal, Badge, Button, Input, Table
│   ├── softphone/    # Interface WebRTC de softphone para discagem e teste de áudio
│   ├── telecom/      # Dashboards de conectividade, cadastros e monitoramento
│   └── ui/           # Primitivos visuais shadcn/ui (dialog, dropdown, card, etc.)
├── contexts/         # Contextos React (AuthContext, ThemeContext, WebRtcContext)
├── data/             # Estruturas estáticas, releases notes e catálogo de permissões
├── hooks/            # Custom hooks React
├── services/         # Camada de serviços e integração de WebSockets
└── types/            # Definições de tipos TypeScript
```

---

## 🚀 Scripts de Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento local
npm run dev

# Validação estrita de tipos TypeScript (SDLC Gate)
npx tsc --noEmit

# Build de produção otimizado
npm run build

# Executar linter
npm run lint
```

---

## 🔒 Segurança e Integração

- **Autenticação:** JWT Bearer Token com expiração e refresh token transparente.
- **Autorização (RBAC):** Controle estrito de visibilidade e ações por `resource_key` (`telecom.*`, `agents.*`).
- **CSP & Headers:** Homologado com Content Security Policy restritiva gerenciada pelo Caddy 2 e Nginx.
