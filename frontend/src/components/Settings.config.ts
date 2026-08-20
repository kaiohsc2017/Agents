// Tipos, catálogo estático de seções e validação de campos de Settings.tsx —
// extraído para reduzir o tamanho do arquivo principal (limite de 800 linhas).
// Extração pura: nenhuma lógica foi alterada, apenas movida.

export interface SettingMeta {
  value: string
  isSecret: boolean
}

export type Settings = Record<string, SettingMeta>

export interface Section {
  id: string
  icon: string
  title: string
  description: string
  keys: FieldDef[]
  testable?: boolean
  testKeys?: string[]
  requiredKeys?: string[]
  affectedServices: string[]
}

export interface FieldDef {
  key: string
  label: string
  placeholder?: string
  hint?: string
  type?: 'text' | 'password' | 'number' | 'select'
  options?: { value: string; label: string }[]
  validate?: 'url'
  required?: boolean
}

export interface HistoryEntry {
  id: number
  changedAt: string
  changedBy: string
  envKey: string
  oldValue: string | null
  newValue: string | null
  ipAddress: string | null
}

export type Tab = 'config' | 'history'

export const SECTIONS: Section[] = [
  {
    id: 'jira',
    icon: '🎫',
    title: 'Jira Cloud',
    description: 'Integração com Jira Cloud para abertura automatizada de chamados e incidentes operacionais.',
    testable: true,
    testKeys: ['JIRA_BASE_URL', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN'],
    requiredKeys: ['JIRA_BASE_URL', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'],
    affectedServices: ['backend'],
    keys: [
      {
        key: 'JIRA_BASE_URL',
        label: 'URL da Instância Jira',
        placeholder: 'https://empresa.atlassian.net',
        validate: 'url',
        required: true,
      },
      { key: 'JIRA_USER_EMAIL', label: 'E-mail do Usuário Jira', placeholder: 'usuario@empresa.com', required: true },
      {
        key: 'JIRA_API_TOKEN',
        label: 'API Token Jira',
        type: 'password',
        required: true,
        hint: 'Gere em https://id.atlassian.com/manage-profile/security/api-tokens',
      },
      {
        key: 'JIRA_PROJECT_KEY',
        label: 'Chave do Projeto',
        placeholder: 'SUP',
        required: true,
        hint: 'Sigla do projeto onde os chamados serão criados (ex: SUP, TI, PROJ).',
      },
      {
        key: 'JIRA_ISSUE_TYPE',
        label: 'Tipo de Issue',
        placeholder: 'Task',
        hint: 'Tipo de issue criado pela central (ex: Task, Bug, Support).',
      },
    ],
  },
  {
    id: 'zabbix',
    icon: '📡',
    title: 'Zabbix',
    description: 'Monitoração de infraestrutura e disparo de alertas telefônicos para incidentes de alta severidade.',
    testable: true,
    testKeys: ['ZABBIX_API_URL', 'ZABBIX_USER', 'ZABBIX_PASSWORD'],
    requiredKeys: ['ZABBIX_API_URL', 'ZABBIX_USER'],
    affectedServices: ['backend'],
    keys: [
      {
        key: 'ZABBIX_API_URL',
        label: 'URL da API JSON-RPC',
        placeholder: 'https://zabbix.empresa.com/api_jsonrpc.php',
        validate: 'url',
        required: true,
      },
      { key: 'ZABBIX_USER', label: 'Usuário Zabbix', placeholder: 'readonly_api_user', required: true },
      { key: 'ZABBIX_PASSWORD', label: 'Senha Zabbix', type: 'password' },
      {
        key: 'ZABBIX_MIN_SEVERITY',
        label: 'Severidade Mínima para Alertas',
        type: 'select',
        options: [
          { value: '2', label: '2 — Warning' },
          { value: '3', label: '3 — Average' },
          { value: '4', label: '4 — High (Recomendado)' },
          { value: '5', label: '5 — Disaster' },
        ],
      },
      { key: 'ZABBIX_POLL_INTERVAL_MINUTES', label: 'Intervalo de Polling (minutos)', type: 'number' },
    ],
  },
  {
    id: 'telegram',
    icon: '✈️',
    title: 'Telegram Bot',
    description: 'Notificações instantâneas via Telegram com resumo do incidente disparado pelo Zabbix.',
    testable: true,
    testKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
    affectedServices: ['backend'],
    keys: [
      {
        key: 'TELEGRAM_BOT_TOKEN',
        label: 'Bot Token',
        type: 'password',
        placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
      },
      { key: 'TELEGRAM_CHAT_ID', label: 'Chat ID / Grupo ID', placeholder: '-1001234567890' },
    ],
  },
  {
    id: 'security',
    icon: '🛡️',
    title: 'Segurança & JWT',
    description: 'Chaves criptográficas de autenticação e expiração de sessões corporativas.',
    affectedServices: ['backend'],
    keys: [
      {
        key: 'JWT_SECRET',
        label: 'Secret JWT',
        type: 'password',
        placeholder: 'min 64 chars',
        required: true,
      },
      { key: 'JWT_EXPIRATION_HOURS', label: 'Validade do Token (horas)', type: 'number', placeholder: '24' },
    ],
  },
  {
    id: 'smtp',
    icon: '✉️',
    title: 'E-mail Corporativo (SMTP)',
    description: 'Configuração de envio de e-mails para relatórios e alertas administrativos.',
    testable: true,
    testKeys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD_CREDENTIAL', 'SMTP_STARTTLS'],
    affectedServices: ['backend'],
    keys: [
      {
        key: 'EMAIL_ENABLED',
        label: 'Habilitar envio de e-mail',
        type: 'select',
        options: [
          { value: 'false', label: 'Desabilitado' },
          { value: 'true', label: 'Habilitado' },
        ],
      },
      { key: 'SMTP_HOST', label: 'Host SMTP', placeholder: 'smtp.empresa.com.br' },
      { key: 'SMTP_PORT', label: 'Porta', type: 'number', placeholder: '587' },
      { key: 'SMTP_USERNAME', label: 'Usuário SMTP', placeholder: 'relatorios@empresa.com.br' },
      { key: 'SMTP_PASSWORD_CREDENTIAL', label: 'Senha SMTP', type: 'password' },
      { key: 'SMTP_FROM_ADDRESS', label: 'Endereço de remetente', placeholder: 'relatorios@empresa.com.br' },
      {
        key: 'SMTP_STARTTLS',
        label: 'STARTTLS',
        type: 'select',
        options: [
          { value: 'true', label: 'Sim (recomendado)' },
          { value: 'false', label: 'Não' },
        ],
      },
    ],
  },
]

export const MASK = '••••••••'

export function validateField(field: FieldDef, value: string): string | null {
  if (field.required && (!value || value === MASK || value.trim() === '')) {
    return 'Campo obrigatório'
  }
  if (field.validate === 'url' && value && value !== MASK) {
    try {
      const u = new URL(value)
      if (!['http:', 'https:'].includes(u.protocol)) return 'URL deve começar com http:// ou https://'
    } catch {
      return 'URL inválida (ex: https://empresa.atlassian.net)'
    }
  }
  return null
}

export function collectErrors(keys: FieldDef[], edits: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of keys) {
    const err = validateField(field, edits[field.key] ?? '')
    if (err) errors[field.key] = err
  }
  return errors
}
