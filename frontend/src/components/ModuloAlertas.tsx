import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import type { AlertCall, AlertContact, Operation, PageResponse } from '../api/types'
import { AuthedAudio } from './AuthedAudio'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertTriangle,
  Send,
  Plus,
  Volume2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
} from 'lucide-react'

const CALL_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'outline'> = {
  ATENDIDA: 'success',
  CONCLUIDA: 'success',
  NAO_ATENDIDA: 'warning',
  FALHA: 'destructive',
  PENDENTE: 'info',
}

const SEVERITY_VARIANT: Record<string, 'destructive' | 'warning' | 'info' | 'outline'> = {
  Disaster: 'destructive',
  High: 'destructive',
  Average: 'warning',
  Warning: 'info',
  Information: 'outline',
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const EMPTY_CONTACT: Partial<AlertContact> = {
  name: '',
  phoneNumber: '',
  isActive: true,
  priorityOrder: 1,
}

interface AlertStats {
  totalAlerts: number
  answered: number
  notAnswered: number
  failed: number
  telegramSent: number
  answeredRatePct: number
  telegramSuccessRatePct: number
}

function AlertAudioPlayer({ alertId }: { alertId: number }) {
  const [show, setShow] = useState(false)
  if (!show) {
    return (
      <button
        className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        onClick={() => setShow(true)}
        title="Ouvir áudio gravado"
      >
        <Volume2 className="h-4 w-4" />
      </button>
    )
  }
  return <AuthedAudio path={`/alert-calls/${alertId}/audio`} />
}

function TelegramMessageModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-bold text-foreground">Mensagem Telegram</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs font-mono whitespace-pre-wrap leading-relaxed">
          {message}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ModuloAlertas() {
  const [tab, setTab] = useState<'alerts' | 'contacts'>('alerts')
  const [alerts, setAlerts] = useState<AlertCall[]>([])
  const [contacts, setContacts] = useState<AlertContact[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

  // Pagination & Filters
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Contact Modal
  const [showModal, setShowModal] = useState(false)
  const [editContact, setEditContact] = useState<Partial<AlertContact>>(EMPTY_CONTACT)
  const [telegramMsg, setTelegramMsg] = useState<string | null>(null)

  const loadStats = (p: typeof period) => {
    api.get<AlertStats>(`/stats/alerts?period=${p}`).then((r) => setStats(r.data))
  }

  const loadAlerts = (p = 0) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), size: '20' })
    if (filterSeverity) params.set('severity', filterSeverity)
    if (filterStatus) params.set('status', filterStatus)
    api
      .get<PageResponse<AlertCall>>(`/alert-calls?${params}`)
      .then((r) => {
        setAlerts(r.data.content ?? [])
        setTotalPages(r.data.totalPages ?? 1)
        setPage(r.data.number ?? 0)
      })
      .finally(() => setLoading(false))
  }

  const loadContacts = () => {
    setLoading(true)
    api
      .get<AlertContact[]>('/alert-contacts')
      .then((r) => setContacts(r.data ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStats(period)
    api.get<Operation[]>('/operations?activeOnly=true').then((r) => setOperations(r.data ?? []))
  }, [])

  useEffect(() => {
    if (tab === 'alerts') loadAlerts(0)
    else loadContacts()
  }, [tab, filterSeverity, filterStatus])

  const openCreate = () => {
    setEditContact({ ...EMPTY_CONTACT, priorityOrder: contacts.length + 1 })
    setShowModal(true)
  }

  const openEdit = (c: AlertContact) => {
    setEditContact({ ...c })
    setShowModal(true)
  }

  const saveContact = async () => {
    if (!editContact.name || !editContact.phoneNumber) {
      alert('Nome e Telefone são obrigatórios.')
      return
    }
    try {
      if (editContact.id) {
        await api.put(`/alert-contacts/${editContact.id}`, editContact)
      } else {
        await api.post('/alert-contacts', editContact)
      }
      setShowModal(false)
      loadContacts()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao salvar contato.'))
    }
  }

  const deleteContact = async (id: number) => {
    if (!confirm('Deseja excluir este contato de plantão?')) return
    try {
      await api.delete(`/alert-contacts/${id}`)
      loadContacts()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao excluir contato.'))
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Central de Alertas Zabbix & Plantão
          </h1>
          <p className="text-xs text-muted-foreground">
            Escalonamento de incidentes críticos com discagem automática SIP e notificações via Telegram
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border/60">
            <button
              onClick={() => setTab('alerts')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'alerts'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Histórico de Incidentes
            </button>
            <button
              onClick={() => setTab('contacts')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'contacts'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Contatos de Plantão
            </button>
          </div>
          {tab === 'contacts' && (
            <Button onClick={openCreate} className="font-semibold shadow-xs">
              <Plus className="h-4 w-4 mr-1" />
              Novo Contato
            </Button>
          )}
        </div>
      </div>

      {/* ── KPIs Bar ── */}
      {stats && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Métricas do Período
            </span>
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
              {(['today', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p)
                    loadStats(p)
                  }}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    period === p
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p === 'today' ? 'Hoje' : p === 'week' ? 'Esta Semana' : 'Este Mês'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="shadow-xs border-border/70">
              <CardContent className="p-3.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total Incidentes</span>
                <div className="text-xl font-bold text-foreground mt-0.5">{stats.totalAlerts}</div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/70">
              <CardContent className="p-3.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Atendidas</span>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {stats.answered}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/70">
              <CardContent className="p-3.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Não Atendidas</span>
                <div className="text-xl font-bold text-amber-500 mt-0.5">{stats.notAnswered}</div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/70">
              <CardContent className="p-3.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Falhas Discagem</span>
                <div className="text-xl font-bold text-rose-500 mt-0.5">{stats.failed}</div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/70">
              <CardContent className="p-3.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Taxa Atendimento</span>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {stats.answeredRatePct}%
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/70">
              <CardContent className="p-3.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Telegram OK</span>
                <div className="text-xl font-bold text-blue-500 mt-0.5">{stats.telegramSuccessRatePct}%</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Content: Alerts Tab ── */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              className="h-8 rounded-lg border border-border/70 bg-card px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="">Todas as Severidades</option>
              <option value="Disaster">Disaster</option>
              <option value="High">High</option>
              <option value="Average">Average</option>
              <option value="Warning">Warning</option>
            </select>

            <select
              className="h-8 rounded-lg border border-border/70 bg-card px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos os Status</option>
              <option value="ATENDIDA">Atendida</option>
              <option value="NAO_ATENDIDA">Não Atendida</option>
              <option value="FALHA">Falha</option>
              <option value="PENDENTE">Pendente</option>
            </select>
          </div>

          <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Carregando histórico de alertas...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                    <tr>
                      <th className="py-3 px-4">Data / Hora</th>
                      <th className="py-3 px-4">Telefone Plantão</th>
                      <th className="py-3 px-4">Host / Servidor</th>
                      <th className="py-3 px-4">Severidade</th>
                      <th className="py-3 px-4">Status Discagem</th>
                      <th className="py-3 px-4">Duração</th>
                      <th className="py-3 px-4 text-center">Áudio</th>
                      <th className="py-3 px-4 text-center">Telegram</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {alerts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-muted-foreground">
                          Nenhum alerta registrado.
                        </td>
                      </tr>
                    ) : (
                      alerts.map((a) => (
                        <tr key={a.id} className="hover:bg-muted/25 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                            {formatDate(a.callDate)}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-foreground">{a.phoneNumber}</td>
                          <td className="py-3 px-4 font-medium text-foreground">{a.zabbixHost ?? '—'}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={SEVERITY_VARIANT[a.zabbixSeverity ?? ''] ?? 'outline'}
                              className="text-[10px] py-0 font-bold"
                            >
                              {a.zabbixSeverity ?? 'HIGH'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={CALL_STATUS_VARIANT[a.callStatus] ?? 'outline'}
                              className="text-[10px] py-0"
                            >
                              {a.callStatus}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">{a.callDurationSecs}s</td>
                          <td className="py-3 px-4 text-center">
                            <AlertAudioPlayer alertId={a.id} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            {a.telegramMessageContent ? (
                              <button
                                onClick={() => setTelegramMsg(a.telegramMessageContent ?? '')}
                                className="text-blue-500 hover:text-blue-600 cursor-pointer p-1"
                                title="Ver mensagem enviada ao Telegram"
                              >
                                <MessageSquare className="h-4 w-4 mx-auto" />
                              </button>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between p-3 border-t border-border/60 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages || 1}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={page === 0}
                  onClick={() => loadAlerts(page - 1)}
                  className="h-8"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={page >= totalPages - 1}
                  onClick={() => loadAlerts(page + 1)}
                  className="h-8"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Content: Contacts Tab ── */}
      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Carregando contatos de plantão...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                    <tr>
                      <th className="py-3 px-4 w-24">Prioridade</th>
                      <th className="py-3 px-4">Nome do Plantonista</th>
                      <th className="py-3 px-4">Telefone</th>
                      <th className="py-3 px-4">Operação Vinculada</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          Nenhum contato cadastrado na escala.
                        </td>
                      </tr>
                    ) : (
                      contacts
                        .sort((a, b) => a.priorityOrder - b.priorityOrder)
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-muted/25 transition-colors">
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="font-mono text-xs font-bold py-0">
                                #{c.priorityOrder}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 font-semibold text-foreground">{c.name}</td>
                            <td className="py-3 px-4 font-mono text-foreground">{c.phoneNumber}</td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {c.operationId
                                ? operations.find((o) => o.id === c.operationId)?.name || `ID ${c.operationId}`
                                : 'Global / Todas'}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={c.isActive ? 'success' : 'destructive'} className="text-[10px] py-0">
                                {c.isActive ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEdit(c)}
                                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                                >
                                  Editar
                                </button>
                                <span className="text-border">·</span>
                                <button
                                  onClick={() => deleteContact(c.id)}
                                  className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Contato */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  {editContact.id ? 'Editar Contato' : 'Novo Contato de Plantão'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <Label>Nome Completo *</Label>
                <Input
                  autoFocus
                  placeholder="ex: João da Silva"
                  value={editContact.name ?? ''}
                  onChange={(e) => setEditContact((c) => ({ ...c, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Telefone com DDD / DDI *</Label>
                <Input
                  placeholder="ex: +5511999999999"
                  value={editContact.phoneNumber ?? ''}
                  onChange={(e) => setEditContact((c) => ({ ...c, phoneNumber: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Operação Específica</Label>
                <select
                  className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editContact.operationId ?? ''}
                  onChange={(e) =>
                    setEditContact((c) => ({
                      ...c,
                      operationId: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                >
                  <option value="">Global / Todas as Operações</option>
                  {operations.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Ordem na Fila</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editContact.priorityOrder ?? 1}
                    onChange={(e) => setEditContact((c) => ({ ...c, priorityOrder: +e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Status</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={editContact.isActive ? 'true' : 'false'}
                    onChange={(e) => setEditContact((c) => ({ ...c, isActive: e.target.value === 'true' }))}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={saveContact} className="font-semibold">
                {editContact.id ? 'Salvar Alterações' : 'Criar Contato'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Telegram Message */}
      {telegramMsg && <TelegramMessageModal message={telegramMsg} onClose={() => setTelegramMsg(null)} />}
    </div>
  )
}
