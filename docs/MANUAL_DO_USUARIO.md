# Manual do Usuário — Plataforma AgentIA

> **Classificação:** Guia Operacional do Usuário & Manual de Instruções  
> **Versão da Plataforma:** AgentIA v3.2  
> **Público-Alvo:** Operadores de Telecom, Administradores de Redes, Engenheiros de DevOps e Suporte

---

## 1. Acesso ao Sistema e Autenticação

### 1.1. Tela de Login

A interface de login do AgentIA oferece suporte tanto a contas locais com hash **Argon2id** quanto a credenciais corporativas integradas ao **Active Directory / LDAPS**.

```
┌─────────────────────────────────────────────────────────────┐
│                          AgentIA                            │
│                 Plataforma VoIP + Inteligência IA           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Usuário:  [ admin                                   ] │  │
│  │ Senha:    [ •••••••••••••••••••••                   ] │  │
│  │                                                       │  │
│  │ [x] Lembrar meu acesso                                │  │
│  │                                                       │  │
│  │                 [   ENTRAR NO SISTEMA   ]             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Status: Conexão Segura TLS 1.3 · v3.2                     │
└─────────────────────────────────────────────────────────────┘
```

#### Opções e Campos da Tela:
1. **Campo Usuário:** Digite seu nome de usuário local cadastrado ou o seu login corporativo de rede (ex: `joao.silva` ou `svc_telecom`).
2. **Campo Senha:** Senha de acesso com proteção de máscara.
3. **Autenticação em Dois Fatores (TOTP / 2FA):** Caso a sua conta ou o grupo de acesso exija 2FA, um modal será exibido solicitando o código de 6 dígitos gerado no aplicativo autenticador (Google Authenticator, Microsoft Authenticator).

---

## 2. Navegação Geral e Estrutura do Menu Lateral

O menu lateral (*Sidebar*) organiza as funcionalidades em blocos lógicos, exibindo apenas as opções permitidas pelo Grupo de Acesso do seu usuário:

```
┌──────────────────────────────┐
│ [A★] AgentIA  v3.2           │
├──────────────────────────────┤
│ GERAL                        │
│  [📊] Dashboard              │
│                              │
│ MÓDULOS                      │
│  [📞] Conectividade          │
│  [⚠️] Monitoramento (Zabbix) │
│  [🤖] Agentes ▼              │
│       ├ Dashboard            │
│       ├ Agentes              │
│       ├ Servidores           │
│       ├ Base Conhecimento    │
│       ├ Logs                 │
│       ├ Alertas              │
│       ├ Secrets Vault        │
│       └ Config. IA           │
│                              │
│ CADASTROS                    │
│  [👥] Usuários               │
│  [🏢] Operadora              │
│  [🔌] Linhas                 │
│  [☎️] 0800                   │
│                              │
│ SISTEMA                      │
│  [⚙️] Configurações          │
│  [💻] Logs do Sistema        │
│  [🔑] Grupos de Acesso (RBAC)│
│  [📋] Auditoria              │
│  [🏷️] Release Notes          │
├──────────────────────────────┤
│ 👤 Operador: admin [Sair]    │
└──────────────────────────────┘
```

---

## 3. Telas do Sistema — Descrição Detalhada e Exemplos de Uso

---

### 3.1. Tela: Dashboard Telecom (`telecom.dashboard`)

O **Dashboard Principal** apresenta uma visão panorâmica e em tempo real da saúde da infraestrutura de telecomunicações.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  [ Taxa de Sucesso ]      [ Total de Testes ]      [ Falhas / Timeout ]      [ Status PBX ]│
│      98.4%                    1,420                      22                   Online (OK) │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ GRÁFICO: Volume de Testes por Hora                  │ GRÁFICO: Distribuição de Status     │
│ 50│     ╭──╮                                        │     ██████ SUCESSO (88%)            │
│ 25│  ╭──╯  ╰──╮                                     │     ██     OCUPADO (7%)             │
│  0└──┴────────┴────                                 │     █      SEM RESPOSTA (5%)        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ PADRÃO SEMANAL DE CONECTIVIDADE (HEATMAP: HORA × DIA)                                    │
│ Seg [■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■]             │
│ Ter [■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■]             │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ÚLTIMAS CHAMADAS E TESTES REALIZADOS (STREAMING TEMPO REAL)                              │
│ Data/Hora         │ Número       │ Tipo │ Operadora │ Status   │ Duração │ Áudio        │
│ 19/08 01:15:00    │ 08007771234  │ 0800 │ Claro     │ SUCESSO  │ 14s     │ [ ▶ Ouvir ]  │
│ 19/08 01:10:22    │ 1133334444   │ FIXO │ Vivo      │ SUCESSO  │ 08s     │ [ ▶ Ouvir ]  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Elementos da Tela:
1. **Cards de KPIs no Topo:**
   - **Taxa de Sucesso:** Percentual de testes atendidos com êxito sobre o total de tentativas.
   - **Total de Testes:** Quantidade consolidada de discagens executadas no período selecionado.
   - **Falhas / Timeout:** Quantidade de testes que resultaram em erro de operadora ou sem tom de resposta.
   - **Status PBX:** Indicação de conectividade entre o backend e o motor Asterisk via AMI.
2. **Heatmap Semanal (Hora × Dia):**
   - Matriz colorimétrica onde o tom verde representa 90%+ de disponibilidade e tons avermelhados indicam degradações de rota de telefonia.
3. **Player de Áudio Integrado:**
   - Clique em **[ ▶ Ouvir ]** para escutar a gravação de áudio da chamada gravada pelo PBX diretamente no navegador.

---

### 3.2. Tela: Módulo de Conectividade (`telecom.modulo2`)

Responsável pela gestão e execução de testes automáticos e manuais em números telefônicos e 0800.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ CONECTIVIDADE TELECOM                                           [ + Novo Teste Manual ]  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Filtros: [ Status: Todos ▼ ] [ Tipo: Todos ▼ ] [ BU: Todas ▼ ] [ Buscar Número: ______ ] │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ID   │ Número       │ Tipo │ Operadora │ Unidade (BU) │ Executado em   │ Status   │ Ações│
│ 1042 │ 08007771234  │ 0800 │ Claro     │ Vendas SP    │ 19/08 01:15:00 │ SUCESSO  │ [👁️] │
│ 1041 │ 11988887777  │ FIXO │ TIM       │ Suporte BR   │ 19/08 01:00:12 │ OCUPADO  │ [👁️] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Exemplo Prático de Uso:
1. **Disparo de Teste Manual:**
   - Clique no botão azul **[ + Novo Teste Manual ]**.
   - No modal que se abre, insira o número telefônico desejado (ex: `08007771234`).
   - Selecione a Unidade de Negócio responsável.
   - Clique em **Disparar**.
   - O sistema acionará o PBX Asterisk via tronco SIP em tempo real. O status mudará imediatamente para `DISCANDO`, depois `RINGING` e finalmente `SUCESSO` (se atendido) ou `OCUPADO`/`SEM RESPOSTA`.

---

### 3.3. Tela: Monitoramento e Alertas Zabbix (`telecom.modulo3`)

Exibe a esteira de incidentes críticos de infraestrutura capturados via integração Zabbix.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ALERTAS DE INFRAESTRUTURA & PLANTÃO                                                      │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Host / Servidor    │ Incidente / Trigger               │ Severidade │ Ligação  │ Ações   │
│ srv-db-prod-01     │ High CPU utilization (> 95%)      │ HIGH       │ CONCLUÍDA│ [Rechamar]│
│ srv-k8s-worker-03  │ Disk space is critical (< 5%)     │ DISASTER   │ DISCANDO │ [Ver Log]│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Funcionalidades:
- **Discagem Automática:** Ao detectar um incidente com severidade `>= High`, o sistema localiza o plantonista e realiza uma chamada de voz com sintetização IA da causa raiz.
- **Botão Rechamar:** Permite forçar uma nova chamada manual para a equipe caso o incidente persista sem reconhecimento (*ACK*).

---

### 3.4. Plataforma Nativa de Agentes IA (8 Visões Especializadas)

A plataforma de Agentes Autônomos está **nativamente integrada** à interface principal do AgentIA com o padrão visual corporativo ReportECH:

1. 📊 **Dashboard de Agentes:** Visão consolidada de KPIs operacionais (robôs ativos, execuções com sucesso, falhas, alertas), gráfico de taxa de sucesso por agente e tabela de execuções recentes.
2. 🤖 **Agentes Autônomos:** Criação e gestão de robôs inteligentes com suporte a múltiplos tipos:
   - **`ssh_test`:** Executa comandos e diagnósticos remotos via SSH com auxílio de IA.
   - **`web_monitor`:** Valida integridade e tempo de resposta de endpoints HTTP/HTTPS.
   - **`log_monitor`:** Monitora arquivos de log em busca de padrões anômalos.
   - **`database`:** Executa validações de integridade em bancos SQL.
3. 🖥️ **Servidores & Hosts SSH:** Cadastro seguro de servidores Linux com teste instantâneo de conectividade e status online/falha.
4. 📚 **Base de Conhecimento (RAG):** Upload e indexação semântica de manuais e SOPs em PDF via PostgreSQL `pgvector`, consultados pelos agentes durante diagnósticos.
5. 💻 **Console de Logs de Execução:** Terminal com streaming em tempo real via WebSocket, visualização colorida de níveis de log (INFO, SUCCESS, WARN, ERROR) e exportação `.txt`.
6. 🚨 **Central de Alertas:** Histórico detalhado de notificações disparadas automaticamente pelos agentes para Telegram, E-mail corporativo ou Webhook.
7. 🔑 **Secrets Vault:** Cofre seguro de credenciais por agente, permitindo utilizar senhas e tokens nos comandos com a sintaxe `{{NOME_DA_CHAVE}}`.
8. ⚙️ **Configurações de IA & LLMs:** Painel para alternar entre provedores de IA (Google Gemini, Anthropic Claude, OpenAI, Ollama), selecionar modelos e realizar testes de prompt ao vivo.
9. 🧩 **Agent Flow Canvas (DAG Swarm):** Estúdio visual interativo *drag-and-drop* no padrão ReportECH para criação e orquestração de fluxos multi-agente sem código.

#### 3.4.1. Como Usar o Agent Flow Canvas (Orquestrador Visual DAG)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [🧩] Agent Flow Canvas: "Auto-Remediação de Tronco 0800"         [ Salvar ] [ Testar ▶ ] │
├───────────────────────┬─────────────────────────────────────────────────┬────────────────┤
│ PALETA LATERAL        │ WORKSPACE INTERATIVO                            │ PROPRIEDADES   │
├───────────────────────┼─────────────────────────────────────────────────┼────────────────┤
│ ⚡ Gatilhos           │   ┌──────────────────┐                          │ Título do Nó:  │
│  [⏰] Cron / Horário  │   │ 📞 Falha no 0800 │ (Gatilho)                │ [Avaliação IA] │
│  [📞] Falha Telecom   │   └────────┬─────────┘                          │                │
│                       │            │                                    │ Modelo:        │
│ 🔍 Coletores          │            ▼                                    │ [Gemini 2.5]   │
│  [💻] Diagnóstico SSH │   ┌──────────────────┐                          │                │
│  [🗄️] Consulta SQL    │   │ 💻 Diagnóstico   │ (SSH Asterisk)           │ Prompt:        │
│                       │   └────────┬─────────┘                          │ [Decida rota..]│
│ 🧠 Cognição & Decisão │            │                                    │                │
│  [🤖] Raciocínio LLM  │            ▼                                    │ Variáveis:     │
│  [📚] Manuais RAG     │   ┌──────────────────┐                          │ {{node_ssh.out}}│
│                       │   │ 🤖 Raciocínio IA │ (Gemini Flash + SOP RAG) │                │
│ 🚀 Atuadores / Saída  │   └────────┬─────────┘                          │                │
│  [📲] Alerta Telegram │            │                                    │                │
│  [🔄] Failover PBX    │            ▼                                    │                │
│  [📞] Chamada de Voz  │   ┌──────────────────┐                          │                │
│                       │   │ 🔄 Comutar Rota  │ (Atuador Asterisk)       │                │
│                       │   └──────────────────┘                          │                │
└───────────────────────┴─────────────────────────────────────────────────┴────────────────┘
```

1. **Adicionar Blocos ao Canvas:** Clique em qualquer bloco na paleta esquerda para instanciar um novo nó no centro da tela.
2. **Conectar os Nós:** Arraste a bolinha de conexão da borda direita de um bloco até a borda esquerda do próximo bloco para criar uma dependência no DAG.
3. **Configurar Parâmetros:** Clique em qualquer nó para abrir o painel de propriedades na lateral direita, personalizando comandos Bash, modelos de IA, canais Telegram ou ramais de telefonia.
4. **Testar Imediatamente:** Clique em **Testar Fluxo ▶** para executar a automação de ponta a ponta e acompanhar a linha do tempo com a duração e payload de saída de cada nó.

---

### 3.5. Tela: Gestão de Usuários e Grupos de Acesso (RBAC)

Permite controle minucioso sobre quem pode visualizar e operar cada módulo.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ MATRIZ DE GRUPOS DE ACESSO (RBAC GRANULAR)                                               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Grupo: Operadores N1                                                                     │
│                                                                                          │
│ Recurso do Sistema        │ Sem Acesso │ Apenas Leitura (r) │ Leitura e Escrita (rw)     │
│ telecom.dashboard         │    ( )     │        (●)         │          ( )               │
│ telecom.modulo2 (Testes)  │    ( )     │        ( )         │          (●)               │
│ telecom.settings (Config) │    (●)     │        ( )         │          ( )               │
│ agents.secrets (Cofre)    │    (●)     │        ( )         │          ( )               │
│                                                                                          │
│                                                   [ SALVAR PERMISSÕES DO GRUPO ]         │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.6. Softphone WebRTC Integrado

Localizado no cabeçalho ou barra inferior da plataforma, permitindo que qualquer operador realize ou receba chamadas diretamente pelo navegador sem instalar softwares externos.

```
┌──────────────────────────────────────┐
│  [☎️] Softphone WebRTC               │
│  Ramal: 9001 · Status: Registrado    │
├──────────────────────────────────────┤
│  [  11988887777                    ] │
├──────────────────────────────────────┤
│    [ 1 ]      [ 2 ]      [ 3 ]       │
│    [ 4 ]      [ 5 ]      [ 6 ]       │
│    [ 7 ]      [ 8 ]      [ 9 ]       │
│    [ * ]      [ 0 ]      [ # ]       │
├──────────────────────────────────────┤
│    [ 📞 DISCAR ]     [ 🔴 DESLIGAR ] │
│    [ 🔇 MUDO ]       [ 🔊 ÁUDIO ]    │
└──────────────────────────────────────┘
```

---

### 3.7. Tela: Sistema & Governança (Zero Downtime)

Centraliza o gerenciamento de configurações da aplicação:
- **Salvar (Efeito Imediato):** Atualiza variáveis de integração (Zabbix, Telegram, Active Directory, SMTP, Jira) instantaneamente no banco de dados (`system_config`) com invalidação de cache e efeito em 0 segundos, sem reiniciar nenhum container.
- **Salvar e Reiniciar:** Aplica alterações de infraestrutura profunda que requerem recreação de containers via Docker-Helper.

---

### 3.8. IA Acústica: Auditoria de Áudio & MOS Score (Pilar 3)

O AgentIA audita a qualidade perceptual da voz (conforme a norma ITU-T P.800/G.107) em todos os testes e chamadas:
- **Origem do Sinal (O que é analisado):** A nota MOS é calculada com base no **áudio retornado pelo número de destino que atendeu a ligação** (fluxo RX) e no circuito da operadora que transportou essa chamada. Isso permite à empresa validar a exata experiência auditiva que o cliente tem ao ouvir a URA ou o atendente do 0800/linha testada.
- **Nota MOS (1.0 a 5.0):**
  - 🟢 **Excelente (MOS $\ge 4.15$):** Voz nítida e cristalina, sem ruído.
  - 🔵 **Boa (MOS $3.75 - 4.14$):** Padrão de chamada telefônica celular HD.
  - 🟡 **Regular (MOS $3.10 - 3.74$):** Leve chiado ou compressão de canal.
  - 🔴 **Degradada (MOS $< 3.10$):** Picotamento de áudio, ruído intenso ou linha muda.
- **Medição real x estimativa:** o sistema grava 8 segundos do áudio recebido em cada teste de conectividade e mede esse arquivo. Quando existe gravação, o laudo aparece como **"Medição real da gravação da chamada"**. Quando não existe (chamada não atendida, por exemplo), o valor é uma **estimativa** — exibida com o sinal `~` antes do número (ex.: `MOS ~2.15`) e identificada como tal no laudo. O cartão "Conformidade com SLA" mostra quantas das chamadas do período têm medição real.
- **Waveform & Espectrograma:** No histórico do teste ou na tela dedicada de QoS, clique no badge de MOS para inspecionar a onda sonora e o laudo explicativo da Inteligência Artificial.
- **Auto-Cura no Flow Canvas:** Se uma linha sofrer degradação acústica repetida, o gatilho `Degradação MOS` no Flow Canvas dispara a comutação de tronco no Asterisk automaticamente.

---

## 4. Guia Rápido de Solução de Dúvidas Operacionais

- **P: A nota de MOS analisa o meu número que ligou ou o número que atendeu a chamada?**  
  *R:* A nota MOS analisa o **áudio recebido do número de destino que atendeu** somado à qualidade de entrega da operadora. Se você cadastrou o seu próprio 0800, ela mede com precisão a qualidade com que a sua URA ou atendente é ouvido por quem liga.
- **P: Por que o teste de conectividade ficou com status `SEM_RESPOSTA`?**  
  *R:* O número chamado tocou até o tempo limite configurado (30 segundos) sem que ninguém atendesse ou caísse na caixa postal.
- **P: Por que não consigo ver o menu de Configurações ou Agentes?**  
  *R:* O seu usuário não possui a permissão `rw` ou `r` associada à chave correspondente no seu Grupo de Acesso. Solicite ao administrador da plataforma.
- **P: Como escutar o áudio de um teste antigo?**  
  *R:* Acesse o menu **Conectividade** ou **Qualidade de Áudio (QoS)**, filtre pelo número desejado e clique no ícone de visualização `[👁️]`. O histórico com o reprodutor de áudio e espectrograma será aberto.
- **P: As alterações no menu de Configurações derrubam as ligações em andamento?**  
  *R:* Não. O botão **Salvar (Efeito Imediato)** utiliza a arquitetura Two-Tier Zero Downtime, aplicando as novas configurações em memória sem reiniciar o Asterisk ou o backend.
