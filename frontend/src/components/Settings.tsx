import { useEffect, useState } from 'react'
import api from '../api/client'
import { AISettingsPanel } from './AISettingsPanel'
import { AsteriskFilePanel } from './AsteriskFilePanel'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sliders,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  ChevronDown,
  Terminal,
  Lock,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface SettingMeta {
  value: string
  isSecret: boolean
}

type Settings = Record<string, SettingMeta>

interface Section {
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

interface FieldDef {
  key: string
  label: string
  placeholder?: string
  hint?: string
  type?: 'text' | 'password' | 'number' | 'select'
  options?: { value: string; label: string }[]
  validate?: 'url'
  required?: boolean
}

interface HistoryEntry {
  id: number
  changedAt: string
  changedBy: string
  envKey: string
  oldValue: string | null
  newValue: string | null
  ipAddress: string | null
}

type Tab = 'config' | 'history'

const SECTIONS: Section[] = [
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

const MASK = '••••••••'

function validateField(field: FieldDef, value: string): string | null {
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

function collectErrors(keys: FieldDef[], edits: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of keys) {
    const err = validateField(field, edits[field.key] ?? '')
    if (err) errors[field.key] = err
  }
  return errors
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({})
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [applyingSection, setApplyingSection] = useState<string | null>(null)
  const [applyLog, setApplyLog] = useState('')
  const [applyingSectionLabel, setApplyingLabel] = useState('')
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['ai', 'jira', 'zabbix']))
  const [testingSection, setTestingSection] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'error'>>({})
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<Tab>('config')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // SIP Raw
  const [sipBlock, setSipBlock] = useState('')
  const [sipOriginal, setSipOriginal] = useState('')
  const [sipSaving, setSipSaving] = useState(false)
  const [sipReloadStatus, setSipReloadStatus] = useState('')
  const [astConfigLoading, setAstConfigLoading] = useState(true)

  // Rotas Raw
  const [rotasBlock, setRotasBlock] = useState('')
  const [rotasOriginal, setRotasOriginal] = useState('')
  const [rotasSaving, setRotasSaving] = useState(false)
  const [rotasReloadStatus, setRotasReloadStatus] = useState('')

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const load = async () => {
    try {
      const [res, sipRes, rotasRes] = await Promise.all([
        api.get<Settings>('/settings'),
        api.get<{ block: string }>('/asterisk-config/tronco'),
        api.get<{ block: string }>('/asterisk-config/rotas'),
      ])
      setSettings(res.data)
      const plain: Record<string, string> = {}
      for (const [k, v] of Object.entries(res.data)) plain[k] = v.value
      setEdits(plain)
      setSavedSnapshot(plain)
      setSipBlock(sipRes.data.block)
      setSipOriginal(sipRes.data.block)
      setRotasBlock(rotasRes.data.block)
      setRotasOriginal(rotasRes.data.block)
    } catch {
      // ignore
    } finally {
      setAstConfigLoading(false)
    }
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await api.get<HistoryEntry[]>('/settings/history?limit=100')
      setHistory(res.data)
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (activeTab === 'history') loadHistory()
  }, [activeTab])

  const handleChange = (key: string, value: string, field?: FieldDef) => {
    setEdits((prev) => ({ ...prev, [key]: value }))
    if (field) {
      const err = validateField(field, value)
      setFieldErrors((prev) => {
        const next = { ...prev }
        if (err) next[key] = err
        else delete next[key]
        return next
      })
    }
  }

  const sectionHasChanges = (section: Section): boolean =>
    section.keys.some((f) => edits[f.key] !== savedSnapshot[f.key])

  const validateSection = (section: Section): boolean => {
    const errors = collectErrors(section.keys, edits)
    setFieldErrors((prev) => ({ ...prev, ...errors }))
    return Object.keys(errors).length === 0
  }

  const sectionPayload = (section: Section): Record<string, string> => {
    const payload: Record<string, string> = {}
    section.keys.forEach((f) => {
      payload[f.key] = edits[f.key] ?? ''
    })
    return payload
  }

  const handleSaveSection = async (section: Section) => {
    if (!validateSection(section)) {
      alert('Corrija os campos destacados antes de salvar.')
      return
    }
    setSavingSection(section.id)
    try {
      await api.post('/settings', sectionPayload(section))
      setSavedSnapshot((prev) => ({ ...prev, ...sectionPayload(section) }))
      alert(`${section.title} salvo com sucesso!`)
    } catch {
      alert('Erro ao salvar configurações.')
    } finally {
      setSavingSection(null)
    }
  }

  const handleApplySection = async (section: Section) => {
    if (!validateSection(section)) {
      alert('Corrija os campos antes de aplicar.')
      return
    }
    const services = section.affectedServices.join(', ')
    if (
      !confirm(
        `Isso vai salvar "${section.title}" e reiniciar: ${services}.\n\nOs outros serviços não serão afetados. Continuar?`
      )
    )
      return

    setApplyingSection(section.id)
    setApplyingLabel(section.title)
    setApplyLog(`⏳ Salvando ${section.title}...\n`)

    try {
      await api.post('/settings', sectionPayload(section))
      setSavedSnapshot((prev) => ({ ...prev, ...sectionPayload(section) }))
      setApplyLog((prev) => prev + `✅ Configurações salvas.\n\n⏳ Reiniciando: ${services}...\n\n`)

      const startRes = await api.post<{ jobId: string }>('/settings/apply', {
        services: section.affectedServices,
      })
      const jobId = startRes.data.jobId
      setApplyLog((prev) => prev + `▶ Job ID: ${jobId}\n\n`)

      let lastLen = 0
      const poll = async (): Promise<void> => {
        const statusRes = await api.get<{ status: string; log: string }>(`/settings/apply/${jobId}`)
        const { status, log } = statusRes.data
        if (log.length > lastLen) {
          setApplyLog((prev) => prev + log.slice(lastLen))
          lastLen = log.length
        }
        if (status === 'running') {
          await new Promise((r) => setTimeout(r, 2000))
          return poll()
        }
      }
      await poll()
    } catch {
      setApplyLog((prev) => prev + '\n❌ Erro ao comunicar com o servidor.')
    } finally {
      setApplyingSection(null)
    }
  }

  const handleSaveSipRaw = async () => {
    if (!sipBlock.trim()) return
    setSipSaving(true)
    try {
      const res = await api.post<{ message: string; reloadStatus: string }>('/asterisk-config/tronco', {
        block: sipBlock,
      })
      setSipOriginal(sipBlock)
      setSipReloadStatus(res.data.reloadStatus ?? '')
      alert('Tronco SIP salvo e recarregado no Asterisk!')
    } catch {
      alert('Erro ao salvar Tronco SIP.')
    } finally {
      setSipSaving(false)
    }
  }

  const handleSaveRotas = async () => {
    if (!rotasBlock.trim()) return
    setRotasSaving(true)
    try {
      const res = await api.post<{ message: string; reloadStatus: string }>('/asterisk-config/rotas', {
        block: rotasBlock,
      })
      setRotasOriginal(rotasBlock)
      setRotasReloadStatus(res.data.reloadStatus ?? '')
      alert('Plano de discagem salvo e recarregado no Asterisk!')
    } catch {
      alert('Erro ao salvar plano de discagem.')
    } finally {
      setRotasSaving(false)
    }
  }

  const handleTest = async (section: Section) => {
    const keysToTest: Record<string, string> = {}
    ;(section.testKeys ?? []).forEach((k) => {
      keysToTest[k] = edits[k] ?? ''
    })
    setTestingSection((prev) => ({ ...prev, [section.id]: 'loading' }))
    setTestResults((prev) => ({ ...prev, [section.id]: '' }))
    try {
      const res = await api.post<{ ok: boolean; message: string }>(`/settings/test/${section.id}`, keysToTest)
      setTestingSection((prev) => ({ ...prev, [section.id]: res.data.ok ? 'ok' : 'error' }))
      setTestResults((prev) => ({ ...prev, [section.id]: res.data.message }))
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setTestingSection((prev) => ({ ...prev, [section.id]: 'error' }))
      setTestResults((prev) => ({ ...prev, [section.id]: err?.response?.data?.message ?? 'Falha ao testar conexão.' }))
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            Configurações & Parâmetros do Sistema
          </h1>
          <p className="text-xs text-muted-foreground">
            Gerenciamento de integrações externas, inteligência artificial e arquivos de discagem do PBX
          </p>
        </div>

        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'config'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Configurações
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Histórico de Alterações
          </button>
        </div>
      </div>

      {activeTab === 'config' ? (
        <div className="space-y-4">
          {/* Painel de IA */}
          <AISettingsPanel open={openSections.has('ai')} onToggle={() => toggleSection('ai')} />

          {/* Seções Modulares */}
          {SECTIONS.map((section) => {
            const open = openSections.has(section.id)
            const hasChanges = sectionHasChanges(section)
            const isSaving = savingSection === section.id
            const isApplying = applyingSection === section.id
            const testState = testingSection[section.id] ?? 'idle'
            const testMsg = testResults[section.id] ?? ''

            return (
              <Card key={section.id} className="shadow-xs border-border/70 overflow-hidden">
                <CardHeader
                  className="p-4 cursor-pointer hover:bg-muted/20 transition-colors flex flex-row items-center justify-between"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{section.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
                        <Badge variant="success" className="text-[10px] py-0 px-2 font-mono">
                          Zero Downtime
                        </Badge>
                        {hasChanges && (
                          <Badge variant="warning" className="text-[10px] py-0 px-2 font-mono">
                            ● modificado
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">{section.description}</CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-1">
                      {section.affectedServices.map((s) => (
                        <Badge key={s} variant="outline" className="text-[9px] py-0 font-mono">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>

                {open && (
                  <CardContent className="p-4 pt-2 border-t border-border/50 space-y-4 bg-muted/5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {section.keys.map((field) => {
                        const meta = settings[field.key]
                        const value = edits[field.key] ?? ''
                        const isSecret = meta?.isSecret || field.type === 'password'
                        const revealed = revealedKeys.has(field.key)
                        const fieldErr = fieldErrors[field.key]

                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">
                                {field.label} {field.required && <span className="text-destructive">*</span>}
                              </Label>
                              {isSecret && (
                                <Badge variant="outline" className="text-[9px] py-0 font-mono text-primary">
                                  <Lock className="h-2.5 w-2.5 mr-0.5" /> secreto
                                </Badge>
                              )}
                            </div>

                            <div className="relative flex items-center">
                              {field.type === 'select' ? (
                                <select
                                  className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                  value={value}
                                  onChange={(e) => handleChange(field.key, e.target.value, field)}
                                >
                                  {field.options?.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  type={isSecret && !revealed ? 'password' : field.type === 'number' ? 'number' : 'text'}
                                  placeholder={field.placeholder ?? (isSecret ? '••••••••' : '')}
                                  value={value}
                                  onChange={(e) => handleChange(field.key, e.target.value, field)}
                                  className={isSecret ? 'pr-9 font-mono' : ''}
                                />
                              )}

                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() => toggleReveal(field.key)}
                                  className="absolute right-2.5 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                                >
                                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                            {fieldErr && <p className="text-[11px] text-destructive">{fieldErr}</p>}
                            {field.hint && !fieldErr && (
                              <p className="text-[10px] text-muted-foreground">{field.hint}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Section Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/50">
                      <div>
                        {section.testable && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleTest(section)}
                              disabled={testState === 'loading'}
                              className="h-8 text-xs font-semibold"
                            >
                              {testState === 'loading' ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Testando...
                                </>
                              ) : (
                                'Testar Conexão'
                              )}
                            </Button>
                            {testMsg && (
                              <span
                                className={`text-xs font-medium ${
                                  testState === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                                }`}
                              >
                                {testMsg}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveSection(section)}
                          disabled={isSaving || isApplying || !hasChanges}
                          className="font-semibold text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Salvar (Efeito Imediato)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplySection(section)}
                          disabled={isSaving || isApplying}
                          className="font-semibold text-xs h-8"
                          title="Salva e reinicia os containers afetados se necessário"
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Salvar e Reiniciar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}

          {/* Asterisk File Panels */}
          <AsteriskFilePanel
            panelId="sip"
            icon="🔌"
            title="Tronco SIP (Operadora)"
            description={<>Configuração PJSIP do entroncamento telefônico com operadora de voz</>}
            hint={<>As alterações aplicadas recarregam o módulo res_pjsip sem derrubar o PBX.</>}
            value={sipBlock}
            original={sipOriginal}
            saving={sipSaving}
            isLoading={astConfigLoading}
            reloadStatus={sipReloadStatus}
            onSave={handleSaveSipRaw}
            onChange={setSipBlock}
          />

          <AsteriskFilePanel
            panelId="rotas"
            icon="📞"
            title="Plano de Discagem & Rotas de Saída"
            description={<>Configuração do plano de numeração e discagem (extensions.conf)</>}
            hint={<>As alterações aplicadas recarregam o dialplan com dialplan reload.</>}
            value={rotasBlock}
            original={rotasOriginal}
            saving={rotasSaving}
            isLoading={astConfigLoading}
            reloadStatus={rotasReloadStatus}
            onSave={handleSaveRotas}
            onChange={setRotasBlock}
          />
        </div>
      ) : (
        /* History Tab */
        <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
          {historyLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Carregando histórico de alterações...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4">Chave .ENV</th>
                    <th className="py-3 px-4">Valor Anterior</th>
                    <th className="py-3 px-4">Novo Valor</th>
                    <th className="py-3 px-4">IP Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        Nenhuma alteração registrada.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id} className="hover:bg-muted/25 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                          {new Date(h.changedAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">{h.changedBy}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-primary">{h.envKey}</td>
                        <td className="py-3 px-4 font-mono text-muted-foreground text-[11px] max-w-xs truncate">
                          {h.oldValue ?? '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground text-[11px] max-w-xs truncate font-medium">
                          {h.newValue ?? '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                          {h.ipAddress ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Apply Log */}
      {applyingSection && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  Reiniciando Serviços: {applyingSectionLabel}
                </h2>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-96 whitespace-pre-wrap leading-relaxed">
              {applyLog}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setApplyingSection(null)}>
                Fechar Janela
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
