import { useEffect, useState } from 'react'
import api from '../api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, Search, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: number
  createdAt: string
  username: string | null
  ipAddress: string | null
  action: string
  details: string | null
  success: boolean
  userAgent: string | null
}

interface PageResponse<T> {
  content: T[]
  totalPages: number
  number: number
  totalElements: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'outline'> = {
  LOGIN: 'success',
  LOGIN_FAILED: 'destructive',
  SETTINGS_CHANGE: 'warning',
  USER_CREATE: 'info',
  USER_UPDATE: 'info',
  USER_DELETE: 'destructive',
  EXPORT: 'outline',
  RATE_LIMIT_BLOCKED: 'destructive',
  TOTP_ENABLED: 'success',
  TOTP_DISABLED: 'warning',
  TOTP_VERIFY_FAILED: 'destructive',
}

const ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Login',
  LOGIN_FAILED: 'Falha no Login',
  SETTINGS_CHANGE: 'Config Alterada',
  USER_CREATE: 'Usuário Criado',
  USER_UPDATE: 'Usuário Atualizado',
  USER_DELETE: 'Usuário Removido',
  EXPORT: 'Exportação',
  RATE_LIMIT_BLOCKED: 'Rate Limit',
  TOTP_ENABLED: '2FA Ativado',
  TOTP_DISABLED: '2FA Desativado',
  TOTP_VERIFY_FAILED: 'Falha 2FA',
}

function formatDate(s: string) {
  const d = new Date(s)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function Auditoria() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)

  // Filtros
  const [filterUsername, setFilterUsername] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [actions, setActions] = useState<string[]>([])

  useEffect(() => {
    api
      .get<string[]>('/audit/actions')
      .then((r) => setActions(r.data))
      .catch((err) => console.error('Erro ao carregar ações de auditoria:', err))
  }, [])

  const load = (p = 0, username = filterUsername, action = filterAction, from = filterFrom, to = filterTo) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), size: '50' })
    if (username) params.set('username', username)
    if (action) params.set('action', action)
    if (from) params.set('dateFrom', from + ':00')
    if (to) params.set('dateTo', to + ':00')
    api
      .get<PageResponse<AuditLog>>(`/audit?${params}`)
      .then((r) => {
        setLogs(r.data.content ?? [])
        setTotalPages(r.data.totalPages)
        setPage(r.data.number)
        setTotalElements(r.data.totalElements)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleFilter = () => load(0)

  const clearFilters = () => {
    setFilterUsername('')
    setFilterAction('')
    setFilterFrom('')
    setFilterTo('')
    load(0, '', '', '', '')
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Auditoria & Rastreabilidade
          </h1>
          <p className="text-xs text-muted-foreground">
            Logs imutáveis de autenticação, transações administrativas e modificações de configuração
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(page)} className="font-semibold">
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Atualizar
        </Button>
      </div>

      {/* ── Quick Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total de Eventos
              </span>
              <div className="text-2xl font-bold text-foreground">{totalElements}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Página Atual
              </span>
              <div className="text-2xl font-bold text-foreground">
                {page + 1} / {totalPages || 1}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Itens por Página
              </span>
              <div className="text-2xl font-bold text-foreground">50</div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Filtros Aplicados
              </span>
              <div className="text-2xl font-bold text-primary">
                {[filterUsername, filterAction, filterFrom].filter(Boolean).length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl border border-border/70 bg-card shadow-xs">
        <div className="relative w-44">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por login..."
            value={filterUsername}
            onChange={(e) => setFilterUsername(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-border/70 rounded-lg bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <select
          className="h-8 rounded-lg border border-border/70 bg-background px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="">Todas as Ações</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a] ?? a}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="h-8 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground font-mono"
        />
        <span className="text-muted-foreground text-xs font-semibold">→</span>
        <input
          type="datetime-local"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="h-8 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground font-mono"
        />

        <Button size="xs" onClick={handleFilter} className="font-semibold h-8">
          <Filter className="h-3.5 w-3.5 mr-1" />
          Filtrar
        </Button>
        <Button variant="ghost" size="xs" onClick={clearFilters} className="h-8" aria-label="Limpar filtros">
          Limpar
        </Button>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Carregando eventos de auditoria...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-3 px-4 w-44">Data / Hora</th>
                  <th className="py-3 px-4 w-32">Usuário</th>
                  <th className="py-3 px-4 w-32">IP de Origem</th>
                  <th className="py-3 px-4 w-36">Ação Registrada</th>
                  <th className="py-3 px-4">Detalhes</th>
                  <th className="py-3 px-4 text-center w-24">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nenhum registro de auditoria encontrado para o período.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground font-mono">
                        {log.username ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">{log.ipAddress ?? '—'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={ACTION_VARIANT[log.action] ?? 'outline'} className="text-[10px] py-0">
                          {ACTION_LABEL[log.action] ?? log.action}
                        </Badge>
                      </td>
                      <td
                        className="py-3 px-4 text-muted-foreground max-w-md truncate"
                        title={log.details ?? undefined}
                      >
                        {log.details ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={log.success ? 'success' : 'destructive'} className="text-[10px] py-0 font-bold">
                          {log.success ? '✓ OK' : '✗ Falha'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border/60 bg-muted/20">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages || 1} ({totalElements} eventos registrados)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={page === 0}
              onClick={() => load(page - 1)}
              className="h-8"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={page >= totalPages - 1}
              onClick={() => load(page + 1)}
              className="h-8"
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
