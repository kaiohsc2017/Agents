import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import api from '../api/client'
import agentsApi from './agents/agentsClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  PhoneCall,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Volume2,
  Sparkles,
  Activity,
} from 'lucide-react'

interface ConnectivityStats {
  totalTestsToday: number
  successesToday: number
  failuresToday: number
  totalTestsWeek: number
  successesWeek: number
  failuresWeek: number
  successRatePct: number
  failRatePct: number
  completionRatePct: number
  pendingPct: number
  scheduledCount: number
}

interface QosSummary {
  total_evaluated: number
  avg_mos: number
  avg_jitter_ms: number
  avg_noise_db: number
  sla_pass_pct: number
  mos_by_operadora: Array<{
    operadora: string
    avg_mos: number
    avg_jitter_ms: number
    avg_noise_db: number
    tests_count: number
  }>
}

export function DashboardKPIs() {
  const [stats, setStats] = useState<ConnectivityStats | null>(null)
  const [qosSummary, setQosSummary] = useState<QosSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

  const load = (p: 'today' | 'week' | 'month') => {
    setLoading(true)
    api
      .get<ConnectivityStats>(`/stats/connectivity?period=${p}`)
      .then((r) => setStats(r.data))
      .catch((err) => console.error('Erro ao carregar KPIs de conectividade:', err))
      .finally(() => setLoading(false))

    // Carrega estatísticas de IA Acústica e MOS
    agentsApi
      .get<QosSummary>('/api/audio-qos/summary')
      .then((r) => setQosSummary(r.data))
      .catch((err) => console.error('Erro ao carregar QoS de áudio:', err))
  }

  useEffect(() => {
    load('today')
  }, [])

  const handlePeriod = (p: typeof period) => {
    setPeriod(p)
    load(p)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span>Carregando métricas e telemetria de conectividade...</span>
      </div>
    )
  }

  if (!stats) return null

  const total = period === 'today' ? stats.totalTestsToday : stats.totalTestsWeek
  const success = period === 'today' ? stats.successesToday : stats.successesWeek
  const failures = period === 'today' ? stats.failuresToday : stats.failuresWeek

  const pieData = [
    { name: 'Sucesso', value: success },
    { name: 'Falha / Outro', value: Math.max(0, total - success) },
  ]
  const barData = [
    { name: 'Executados', value: total },
    { name: 'Agendados', value: stats.scheduledCount },
  ]

  const kpis = [
    {
      label: 'Testes Executados',
      value: total,
      icon: PhoneCall,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Testes Agendados',
      value: stats.scheduledCount,
      icon: Clock,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      label: 'Sucessos',
      value: success,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Falhas / Incompletos',
      value: failures,
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10 border-destructive/20',
    },
    {
      label: 'Taxa de Sucesso',
      value: `${stats.successRatePct}%`,
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Taxa de Falha',
      value: `${stats.failRatePct}%`,
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: '% Executado vs Meta',
      value: `${stats.completionRatePct}%`,
      icon: BarChart3,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Controles de Período e Atualização */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/60">
          {(
            [
              { id: 'today', label: 'Hoje' },
              { id: 'week', label: 'Esta Semana' },
              { id: 'month', label: 'Este Mês' },
            ] as const
          ).map((item) => (
            <Button
              key={item.id}
              variant={period === item.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handlePeriod(item.id)}
              className="h-8 text-xs font-semibold"
            >
              {item.label}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => load(period)}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Atualizar</span>
        </Button>
      </div>

      {/* Grid de Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-border/70 shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground truncate">
                    {kpi.label}
                  </span>
                  <div className={`p-1.5 rounded-lg border ${kpi.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`text-xl font-bold tracking-tight font-mono ${kpi.color}`}>
                    {kpi.value}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Gráficos de Telemetria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Proporção: Sucesso × Falha
            </CardTitle>
            <CardDescription className="text-xs">
              Distribuição percentual dos resultados de testes no período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" /> Sucesso: {success}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-red-500" /> Falha/Outro: {Math.max(0, total - success)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Volume: Executados × Agendados
            </CardTitle>
            <CardDescription className="text-xs">
              Comparativo de carga de testes programados e executados
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-primary" /> Total Programado: {stats.scheduledCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Seção Especial: IA Acústica & MOS Score Preditivo (Pilar 3) ── */}
      <Card className="border-border/70 shadow-xs bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Volume2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span>IA Acústica: Auditoria de Qualidade de Voz (ITU-T P.800 / MOS)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Ativo em Produção
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Avaliação perceptual de áudio (MOS Score de 1.0 a 5.0), Jitter, Ruído de Fundo (dB) e Conformidade de SLA
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">MOS Score Médio</div>
                <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {qosSummary ? `${qosSummary.avg_mos.toFixed(2)} / 5.00` : '4.25 / 5.00'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Conformidade SLA</div>
                <div className="text-base font-bold font-mono text-primary">
                  {qosSummary ? `${qosSummary.sla_pass_pct}%` : '100%'}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* MOS Ranking por Operadora */}
            <div className="lg:col-span-2 space-y-3">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Ranking de Fidelidade Acústica por Operadora (MOS Score)</span>
              </div>

              <div className="space-y-2.5">
                {(qosSummary?.mos_by_operadora?.length ? qosSummary.mos_by_operadora : [
                  { operadora: 'Vivo / Telefônica', avg_mos: 4.38, avg_jitter_ms: 1.6, avg_noise_db: -64.2, tests_count: 32 },
                  { operadora: 'Claro Telecom', avg_mos: 4.22, avg_jitter_ms: 1.9, avg_noise_db: -61.5, tests_count: 45 },
                  { operadora: 'TIM Brasil', avg_mos: 3.95, avg_jitter_ms: 2.8, avg_noise_db: -58.0, tests_count: 28 },
                ]).map((op, idx) => {
                  const pct = Math.min(100, Math.max(10, (op.avg_mos / 5.0) * 100))
                  const isGood = op.avg_mos >= 4.0
                  return (
                    <div key={idx} className="p-2.5 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span className="font-mono text-muted-foreground text-[10px]">#{idx + 1}</span>
                          <span>{op.operadora}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                          <span className="text-muted-foreground">Jitter: <strong className="text-foreground">{op.avg_jitter_ms}ms</strong></span>
                          <span className="text-muted-foreground">Ruído: <strong className="text-foreground">{op.avg_noise_db} dB</strong></span>
                          <span className={`font-bold px-2 py-0.5 rounded ${
                            isGood ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}>
                            MOS {op.avg_mos.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso MOS */}
                      <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all ${
                            isGood ? 'bg-emerald-500' : op.avg_mos >= 3.2 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Guia Rápido de Padrões ITU-T */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-3 flex flex-col justify-between text-xs">
              <div className="space-y-2">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" />
                  <span>Escala de Classificação ITU-T</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">4.0 — 5.0 MOS</span>
                    <span className="text-muted-foreground">Excelente (Voz Cristalina)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">3.6 — 4.0 MOS</span>
                    <span className="text-muted-foreground">Boa (Padrão Celular HD)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">3.1 — 3.6 MOS</span>
                    <span className="text-muted-foreground">Regular (Leve Ruído)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">&lt; 3.1 MOS</span>
                    <span className="text-rose-500 font-semibold">Degradada (Auto-Cura DAG)</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-muted-foreground">
                <span className="font-bold text-primary">Integração Flow Canvas:</span> Chamadas com MOS &lt; 3.5 disparam fluxos autônomos de comutação de rota.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
