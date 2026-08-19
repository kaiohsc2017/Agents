import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, AlertTriangle, Bell, RefreshCw, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import agentsApi, { getErrorMessage } from './agentsClient';
import { StatusBadge } from './StatusBadge';
import type { DashboardSummary, PeriodRow } from './types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Period = 'day' | 'week' | 'month';

export default function AgentsDashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [pdata, setPdata] = useState<PeriodRow[]>([]);
  const [period, setPeriod] = useState<Period>('day');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = (p: Period = period) => {
    setLoading(true);
    setError('');
    Promise.all([
      agentsApi.get<DashboardSummary>('/api/executions/dashboard/summary'),
      agentsApi.get<PeriodRow[]>(`/api/executions/dashboard/period?period=${p}`),
    ])
      .then(([summaryRes, periodRes]) => {
        setData(summaryRes.data);
        setPdata(Array.isArray(periodRes.data) ? periodRes.data : []);
      })
      .catch((err) => setError(getErrorMessage(err, 'Erro ao carregar métricas de agentes.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const availabilityData = pdata.map((r) => ({
    name: r.agent_name,
    pct: r.total > 0 ? Math.round((r.ok / r.total) * 100) : 0,
    total: r.total,
    ok: r.ok,
    errors: r.errors,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard de Agentes IA</h1>
            <Badge variant="info" className="text-xs font-mono">
              Autônomos
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada da operação, saúde e execuções automatizadas em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load()}
            disabled={loading}
            className="h-9 gap-1.5 font-medium cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="xs" variant="outline" onClick={() => load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs border-border/70 hover:border-primary/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agentes Ativos</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {loading ? '...' : (data?.active_agents ?? 0)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Bot className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70 hover:border-primary/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Execuções OK (24h)</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {loading ? '...' : (data?.executions_24h?.ok ?? 0)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70 hover:border-primary/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Falhas / Erros (24h)</p>
              <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {loading ? '...' : (data?.executions_24h?.errors ?? 0)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70 hover:border-primary/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alertas Disparados</p>
              <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {loading ? '...' : (data?.alerts_24h ?? 0)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Bell className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taxa de Sucesso Chart */}
      <Card className="shadow-xs border-border/70">
        <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Taxa de Sucesso por Agente (%)</CardTitle>
            <CardDescription className="text-xs">
              Percentual de execuções com validação íntegra
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => changePeriod(p)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  period === p
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'day' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-4">
          {availabilityData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              Nenhuma execução registrada no período selecionado.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={availabilityData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="bg-popover text-popover-foreground border border-border p-2.5 rounded-lg shadow-md text-xs space-y-1">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-emerald-500 font-medium">Taxa de Sucesso: {item.pct}%</p>
                          <p className="text-muted-foreground">Total: {item.total} (OK: {item.ok} / Erro: {item.errors})</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {availabilityData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.pct >= 90 ? '#10b981' : entry.pct >= 70 ? '#f59e0b' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execuções Recentes Table */}
      <Card className="shadow-xs border-border/70 overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-semibold">Últimas Execuções de Agentes</CardTitle>
          <CardDescription className="text-xs">
            Registro cronológico das execuções autônomas mais recentes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-xs">Agente</TableHead>
                <TableHead className="font-semibold text-xs">Status</TableHead>
                <TableHead className="font-semibold text-xs">Checks Validados</TableHead>
                <TableHead className="font-semibold text-xs">Duração</TableHead>
                <TableHead className="font-semibold text-xs">Iniciado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Carregando histórico...
                  </TableCell>
                </TableRow>
              ) : !data?.recent_executions || data.recent_executions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                    Nenhuma execução registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                data.recent_executions.map((exec) => (
                  <TableRow key={exec.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-xs text-foreground flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      {exec.agent_name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={exec.status} />
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{exec.passed_checks ?? 0}</span>
                      <span className="text-muted-foreground"> / {exec.total_checks ?? 0} OK</span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {exec.duration_s !== undefined ? `${exec.duration_s.toFixed(2)}s` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground/70" />
                      {new Date(exec.started_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
