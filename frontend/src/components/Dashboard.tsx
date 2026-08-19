import { useEffect, useState, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Radio,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import api from '../api/client'
import { connectWebSocket, subscribe } from '../api/websocket'
import type { TestResult, AlertCall, PageResponse } from '../api/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  SUCESSO: '#10b981',
  FALHA: '#ef4444',
  OCUPADO: '#f59e0b',
  SEM_RESPOSTA: '#64748b',
  TIMEOUT: '#8b5cf6',
  INVALIDO: '#ef4444',
  INDISPONIVEL: '#94a3b8',
  RECUSADO: '#ef4444',
}
const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#64748b']

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function fmt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Heatmap Component ──────────────────────────────────────────────────────

interface HeatCell {
  count: number
  success: number
}

function buildHeatmap(results: TestResult[]): HeatCell[][] {
  const grid: HeatCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ count: 0, success: 0 }))
  )
  results.forEach((r) => {
    const d = new Date(r.executedAt)
    const day = d.getDay()
    const hour = d.getHours()
    grid[day][hour].count++
    if (r.status === 'SUCESSO') grid[day][hour].success++
  })
  return grid
}

function heatColor(cell: HeatCell): string {
  if (cell.count === 0) return 'rgba(128,128,128,0.06)'
  const rate = cell.success / cell.count
  if (rate >= 0.9) return 'rgba(16,185,129,0.7)'
  if (rate >= 0.7) return 'rgba(16,185,129,0.4)'
  if (rate >= 0.5) return 'rgba(245,158,11,0.5)'
  return 'rgba(239,68,68,0.7)'
}

function HeatmapGrid({ results }: { results: TestResult[] }) {
  const grid = buildHeatmap(results)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <Card className="shadow-xs border-border/70">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-semibold">Padrão Semanal de Conectividade</CardTitle>
          <CardDescription className="text-xs">Taxa de sucesso mapeada por hora e dia da semana</CardDescription>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-emerald-500/80 inline-block" /> &gt;90% Sucesso</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-amber-500/80 inline-block" /> 50-89%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-red-500/80 inline-block" /> &lt;50% Falhas</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto pb-4 pt-1">
        <div className="min-w-[540px]">
          <div className="flex ml-9 mb-1.5">
            {hours
              .filter((h) => h % 3 === 0)
              .map((h) => (
                <div
                  key={h}
                  className="text-[10px] text-muted-foreground font-mono"
                  style={{ width: `${(3 / 24) * 100}%` }}
                >
                  {String(h).padStart(2, '0')}h
                </div>
              ))}
          </div>
          {DAYS_PT.map((dayName, dayIdx) => (
            <div key={dayName} className="flex items-center mb-1">
              <span className="w-8 text-[11px] font-medium text-muted-foreground text-right mr-2">{dayName}</span>
              <div className="flex flex-1 gap-1">
                {hours.map((h) => {
                  const cell = grid[dayIdx][h]
                  const rate = cell.count > 0 ? Math.round((cell.success / cell.count) * 100) : null
                  return (
                    <div
                      key={h}
                      title={
                        cell.count === 0
                          ? `${dayName} ${h}h: sem testes`
                          : `${dayName} ${h}h: ${cell.count} testes (${rate}% sucesso)`
                      }
                      className="flex-1 h-4 rounded-xs transition-all hover:ring-2 hover:ring-ring cursor-pointer"
                      style={{ background: heatColor(cell) }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── KPI Card (ReportECH Style) ─────────────────────────────────────────────

interface KpiCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  badge: string
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
  trendIcon?: LucideIcon
}

function KpiCard({ icon: Icon, value, label, badge, badgeVariant = 'default' }: KpiCardProps) {
  return (
    <Card className="shadow-xs border-border/70 hover:border-primary/40 transition-all">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
          <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
          <div className="pt-0.5">
            <Badge variant={badgeVariant} className="text-[10px] py-0 px-1.5 h-4 font-mono font-medium">
              {badge}
            </Badge>
          </div>
        </div>
        <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

type ActivityTab = 'tests' | 'alerts'

interface TrunkStatus {
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN'
  rttMs: number
  checkedAt: string
}

export default function Dashboard() {
  const [results, setResults] = useState<TestResult[]>([])
  const [alerts, setAlerts] = useState<AlertCall[]>([])
  const [loading, setLoading] = useState(true)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [trunkStatus, setTrunkStatus] = useState<TrunkStatus | null>(null)
  const [activityTab, setActivityTab] = useState<ActivityTab>('tests')

  const fetchTrunkStatus = useCallback(async () => {
    try {
      const res = await api.get<TrunkStatus>('/stats/trunk-status')
      setTrunkStatus(res.data)
    } catch {
      setTrunkStatus({ status: 'UNKNOWN', rttMs: -1, checkedAt: new Date().toISOString() })
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([
        api.get<PageResponse<TestResult>>('/test-results?page=0&size=200'),
        api.get<PageResponse<AlertCall>>('/alert-calls?page=0&size=20'),
      ])
      setResults(r.data.content ?? [])
      setAlerts(a.data.content ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    fetchTrunkStatus()

    const ws = connectWebSocket(() => setWsStatus('live'))
    ws.onDisconnect = () => setWsStatus('offline')

    const trunkInterval = setInterval(fetchTrunkStatus, 60_000)

    const unsubResults = subscribe<TestResult>('/topic/test-results', (newResult) => {
      setResults((prev) => [newResult, ...prev].slice(0, 200))
    })
    const unsubAlerts = subscribe<AlertCall>('/topic/alerts', (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev].slice(0, 20))
    })

    return () => {
      unsubResults()
      unsubAlerts()
      clearInterval(trunkInterval)
    }
  }, [loadData, fetchTrunkStatus])

  // KPIs
  const today = new Date().toDateString()
  const resultsToday = results.filter((r) => new Date(r.executedAt).toDateString() === today)
  const successToday = resultsToday.filter((r) => r.status === 'SUCESSO').length
  const successRate = resultsToday.length > 0 ? Math.round((successToday / resultsToday.length) * 100) : 0
  const activeAlerts = alerts.filter((a) => a.callStatus === 'PENDENTE').length
  const alertsToday = alerts.filter((a) => new Date(a.callDate).toDateString() === today).length

  // Chart data
  const hourlyMap: Record<string, { hora: string; SUCESSO: number; FALHA: number; OUTROS: number }> = {}
  results.slice(0, 200).forEach((r) => {
    const key = fmtHour(r.executedAt)
    if (!hourlyMap[key]) hourlyMap[key] = { hora: key, SUCESSO: 0, FALHA: 0, OUTROS: 0 }
    if (r.status === 'SUCESSO') hourlyMap[key].SUCESSO++
    else if (r.status === 'FALHA') hourlyMap[key].FALHA++
    else hourlyMap[key].OUTROS++
  })
  const areaData = Object.values(hourlyMap).slice(-16)

  const statusCounts: Record<string, number> = {}
  results.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
  })
  const pieData = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  const CustomTooltip = ({ active, payload, label }: Partial<TooltipContentProps<ValueType, NameType>>) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-border/80 bg-card p-3 shadow-md text-xs">
        <p className="text-muted-foreground font-medium mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="flex items-center gap-2 py-0.5" style={{ color: p.color }}>
            <span className="font-medium">{p.name}:</span>
            <span className="font-bold">{p.value}</span>
          </p>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-3 text-muted-foreground text-sm">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Carregando dashboard operacional...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header da Página ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard Operacional</h1>
          <p className="text-xs text-muted-foreground">
            Monitoramento de conectividade SIP, volume de testes e esteira de alertas
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge
            variant={wsStatus === 'live' ? 'success' : 'outline'}
            className="flex items-center gap-1.5 py-1 px-2.5 font-medium"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                wsStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {wsStatus === 'live' ? 'WebSocket Ativo' : 'Reconectando...'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true)
              loadData()
              fetchTrunkStatus()
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── KPIs Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={PhoneCall}
          value={resultsToday.length}
          label="Testes Hoje"
          badge={`${results.length} total histórico`}
          badgeVariant="info"
        />
        <KpiCard
          icon={CheckCircle2}
          value={`${successRate}%`}
          label="Taxa de Sucesso"
          badge={`${successToday} atendidos com êxito`}
          badgeVariant={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'destructive'}
          trendIcon={TrendingUp}
        />
        <KpiCard
          icon={AlertTriangle}
          value={activeAlerts}
          label="Alertas Pendentes"
          badge={`${alertsToday} hoje`}
          badgeVariant={activeAlerts === 0 ? 'success' : 'destructive'}
        />
        <KpiCard
          icon={Radio}
          value={
            trunkStatus?.status === 'ONLINE'
              ? `Online (${trunkStatus.rttMs >= 0 ? `${trunkStatus.rttMs}ms` : 'ok'})`
              : trunkStatus?.status === 'OFFLINE'
              ? 'Offline'
              : 'Checando...'
          }
          label="Tronco SIP PBX"
          badge={trunkStatus?.checkedAt ? fmt(trunkStatus.checkedAt) : 'Sem dados'}
          badgeVariant={
            trunkStatus?.status === 'ONLINE'
              ? trunkStatus.rttMs > 200
                ? 'warning'
                : 'success'
              : trunkStatus?.status === 'OFFLINE'
              ? 'destructive'
              : 'outline'
          }
        />
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gráfico de Área: Volume de Testes */}
        <Card className="lg:col-span-2 shadow-xs border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Volume de Testes por Hora</CardTitle>
            <CardDescription className="text-xs">Distribuição temporal de discagens realizadas</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            {areaData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Sem dados de testes no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSucesso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gFalha" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border) / 0.5)" />
                  <XAxis dataKey="hora" tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }} />
                  <Area
                    type="monotone"
                    dataKey="SUCESSO"
                    name="Sucesso"
                    stroke="#10b981"
                    fill="url(#gSucesso)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="FALHA"
                    name="Falha"
                    stroke="#ef4444"
                    fill="url(#gFalha)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gráfico Donut: Distribuição por Status */}
        <Card className="shadow-xs border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Status dos Testes</CardTitle>
            <CardDescription className="text-xs">Distribuição proporcional de resultados</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Sem resultados registrados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={STATUS_COLORS[entry.name] ?? PIE_COLORS[idx % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Heatmap Semanal ── */}
      <HeatmapGrid results={results} />

      {/* ── Tabela de Atividade Recente (Padrão ReportECH) ── */}
      <Card className="shadow-xs border-border/70">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">Atividades em Tempo Real</CardTitle>
            <CardDescription className="text-xs">Últimos eventos registrados pelo PBX e Zabbix</CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
            <button
              onClick={() => setActivityTab('tests')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activityTab === 'tests'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Testes de Voz ({results.length})
            </button>
            <button
              onClick={() => setActivityTab('alerts')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activityTab === 'alerts'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Alertas Zabbix ({alerts.length})
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {activityTab === 'tests' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-y border-border/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Data/Hora</th>
                    <th className="py-2.5 px-4">Telefone</th>
                    <th className="py-2.5 px-4">Unidade (BU)</th>
                    <th className="py-2.5 px-4">Cliente / Operação</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Código SIP</th>
                    <th className="py-2.5 px-4">Ordem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {results.slice(0, 10).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">{fmt(r.executedAt)}</td>
                      <td className="py-2.5 px-4 font-semibold text-foreground">{r.numberTest?.phoneNumber ?? '—'}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px] py-0">
                          {r.numberTest?.businessUnit?.name ?? 'Geral'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {r.numberTest?.client?.name ?? r.numberTest?.operation?.name ?? '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={
                            r.status === 'SUCESSO'
                              ? 'success'
                              : r.status === 'OCUPADO'
                              ? 'warning'
                              : 'destructive'
                          }
                          className="text-[10px] py-0"
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {r.sipResponseCode ? `${r.sipResponseCode} ${r.sipResponseReason ?? ''}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">#{r.executionOrder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-y border-border/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Data/Hora</th>
                    <th className="py-2.5 px-4">Telefone</th>
                    <th className="py-2.5 px-4">Host / Servidor</th>
                    <th className="py-2.5 px-4">Incidente Zabbix</th>
                    <th className="py-2.5 px-4">Severidade</th>
                    <th className="py-2.5 px-4">Status Discagem</th>
                    <th className="py-2.5 px-4">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {alerts.slice(0, 10).map((a) => (
                    <tr key={a.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">{fmt(a.callDate)}</td>
                      <td className="py-2.5 px-4 font-semibold text-foreground">{a.phoneNumber}</td>
                      <td className="py-2.5 px-4 text-foreground font-medium">{a.zabbixHost ?? '—'}</td>
                      <td className="py-2.5 px-4 text-muted-foreground truncate max-w-xs">{a.zabbixIncidentSummary ?? '—'}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="destructive" className="text-[10px] py-0">
                          {a.zabbixSeverity ?? 'HIGH'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={a.callStatus === 'CONCLUIDA' ? 'success' : 'warning'}
                          className="text-[10px] py-0"
                        >
                          {a.callStatus}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">{a.callDurationSecs}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
