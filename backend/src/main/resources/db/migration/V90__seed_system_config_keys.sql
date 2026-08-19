-- =============================================================================
-- V90__seed_system_config_keys.sql — Carga e padronização de chaves no system_config
-- =============================================================================

INSERT INTO system_config (key, value, is_secret, description, updated_at, updated_by)
VALUES
    -- Zabbix
    ('ZABBIX_API_URL', 'https://zabbix.empresa.com/api_jsonrpc.php', false, 'URL da API JSON-RPC do Zabbix', NOW(), 'system'),
    ('ZABBIX_USER', 'readonly_api_user', false, 'Usuário de leitura da API Zabbix', NOW(), 'system'),
    ('ZABBIX_PASSWORD', '', true, 'Senha do usuário Zabbix', NOW(), 'system'),
    ('ZABBIX_MIN_SEVERITY', '4', false, 'Severidade mínima: 2=Warning 3=Average 4=High 5=Disaster', NOW(), 'system'),
    ('ZABBIX_POLL_INTERVAL_MINUTES', '5', false, 'Intervalo de polling em minutos', NOW(), 'system'),

    -- Telegram
    ('TELEGRAM_BOT_TOKEN', '', true, 'Token do bot Telegram (obtido via @BotFather)', NOW(), 'system'),
    ('TELEGRAM_CHAT_ID', '', false, 'Chat ID do canal/grupo de destino', NOW(), 'system'),

    -- Active Directory / LDAP
    ('AD_LDAP_ENABLED', 'false', false, 'Habilita autenticação e sync via Active Directory / LDAPS', NOW(), 'system'),
    ('AD_LDAP_HOST', '', false, 'Host / FQDN do servidor Active Directory Domain Controller', NOW(), 'system'),
    ('AD_LDAP_PORT', '636', false, 'Porta LDAP (636 para LDAPS com TLS, 389 para LDAP padrão)', NOW(), 'system'),
    ('AD_LDAP_USE_SSL', 'true', false, 'Usar conexão segura LDAPS com criptografia TLS', NOW(), 'system'),
    ('AD_LDAP_BASE_DN', '', false, 'Base DN de busca de usuários (ex: DC=empresa,DC=local)', NOW(), 'system'),
    ('AD_LDAP_BIND_DN', '', false, 'DN ou usuário de serviço para bind no AD (ex: svc_agentia@empresa.local)', NOW(), 'system'),
    ('AD_LDAP_BIND_PASSWORD', '', true, 'Senha da conta de serviço para bind no AD', NOW(), 'system'),
    ('AD_LDAP_LOCAL_FALLBACK', 'true', false, 'Permite login com credenciais locais caso o AD esteja inacessível', NOW(), 'system'),
    ('AD_LDAP_DEFAULT_ACCESS_GROUP_ID', '2', false, 'ID do grupo de acesso padrão atribuído a novos usuários do AD', NOW(), 'system'),

    -- E-mail Corporativo (SMTP)
    ('EMAIL_ENABLED', 'false', false, 'Habilita envio de e-mails para relatórios e alertas', NOW(), 'system'),
    ('SMTP_HOST', 'smtp.empresa.com.br', false, 'Host do servidor SMTP corporativo', NOW(), 'system'),
    ('SMTP_PORT', '587', false, 'Porta SMTP (587 STARTTLS, 465 SSL/TLS, 25)', NOW(), 'system'),
    ('SMTP_USERNAME', '', false, 'Usuário de autenticação SMTP', NOW(), 'system'),
    ('SMTP_PASSWORD_CREDENTIAL', '', true, 'Senha de autenticação SMTP', NOW(), 'system'),
    ('SMTP_FROM_ADDRESS', 'agentia@empresa.com.br', false, 'Endereço de e-mail do remetente', NOW(), 'system'),
    ('SMTP_STARTTLS', 'true', false, 'Habilita STARTTLS na conexão SMTP', NOW(), 'system'),

    -- Jira Cloud
    ('JIRA_BASE_URL', 'https://sua-empresa.atlassian.net', false, 'URL base da instância Jira Cloud', NOW(), 'system'),
    ('JIRA_USER_EMAIL', 'usuario@empresa.com', false, 'E-mail do usuário Jira para autenticação', NOW(), 'system'),
    ('JIRA_API_TOKEN', '', true, 'API Token Jira (gerado em id.atlassian.com)', NOW(), 'system'),
    ('JIRA_PROJECT_KEY', 'SUP', false, 'Chave do projeto Jira onde os chamados serão criados', NOW(), 'system'),
    ('JIRA_ISSUE_TYPE', 'Task', false, 'Tipo de issue criado pela central (Task, Bug, Support)', NOW(), 'system'),

    -- Telefonia Outbound Trunk & Context
    ('AST_OUTBOUND_TRUNK', 'tronco-sip', false, 'Nome do trunk no Asterisk pjsip.conf', NOW(), 'system'),
    ('AST_OUTBOUND_CONTEXT', 'discagem-sainte', false, 'Contexto de discagem de saída', NOW(), 'system'),
    ('SIP_TRUNK_HOST', '186.233.141.64', false, 'Host/IP da operadora SIP', NOW(), 'system'),
    ('SIP_TRUNK_FROM_DOMAIN', 'voiphash.com.br', false, 'From Domain SIP', NOW(), 'system'),
    ('SIP_TRUNK_USER', '', false, 'Usuário do tronco SIP (se aplicável)', NOW(), 'system'),
    ('SIP_TRUNK_PASSWORD', '', true, 'Senha do tronco SIP (se aplicável)', NOW(), 'system'),

    -- IA & Modelos Google Gemini
    ('GEMINI_API_KEY', '', true, 'Chave de API Google Gemini (aistudio.google.com)', NOW(), 'system'),
    ('GEMINI_MODEL_LLM', 'gemini-2.5-flash', false, 'Modelo para geração de texto e raciocínio de IA', NOW(), 'system'),
    ('GEMINI_MODEL_STT', 'gemini-2.5-flash', false, 'Modelo para transcrição de voz (Speech-to-Text)', NOW(), 'system'),
    ('GEMINI_MODEL_TTS', 'gemini-2.5-flash-preview-tts', false, 'Modelo para síntese de voz (Text-to-Speech)', NOW(), 'system')
ON CONFLICT (key) DO NOTHING;
