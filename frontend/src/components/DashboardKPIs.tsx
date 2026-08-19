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

export function DashboardKPIs() {
  const [stats, setStats] = useState<ConnectivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

  const load = (p: 'today' | 'week' | 'month') => {
    setLoading(true)
    api
      .get<ConnectivityStats>(`/stats/connectivity?period=${p}`)
      .then((r) => setStats(r.data))
      .catch((err) => console.error('Erro ao carregar KPIs de conectividade:', err))
      .finally(() => setLoading(false))
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
    </div>
  )
}
