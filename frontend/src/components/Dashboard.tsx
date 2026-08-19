import { useEffect, useState, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  PhoneCall, CheckCircle2, AlertTriangle, Radio,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import api from '../api/client';
import { connectWebSocket, subscribe } from '../api/websocket';
import type { TestResult, AlertCall, PageResponse } from '../api/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  SUCESSO: '#34c759', FALHA: '#ff6b6b', OCUPADO: '#ff9f0a',
  SEM_RESPOSTA: '#94a3b8', TIMEOUT: '#9f7aea', INVALIDO: '#ff6b6b',
  INDISPONIVEL: '#a0aec0', RECUSADO: '#ff6b6b',
};
const PIE_COLORS = ['#34c759', '#ff6b6b', '#ff9f0a', '#9f7aea', '#94a3b8'];
const ALERT_STATUS_COLOR: Record<string, string> = {
  CONCLUIDA: '#34c759', PENDENTE: '#ff9f0a', FALHA: '#ff6b6b', ERRO: '#ff6b6b',
};
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function fmt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Heatmap (resultados por hora × dia-da-semana) ─────────────────────────

interface HeatCell { count: number; success: number }

function buildHeatmap(results: TestResult[]): HeatCell[][] {
  const grid: HeatCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ count: 0, success: 0 }))
  );
  results.forEach(r => {
    const d = new Date(r.executedAt);
    const day = d.getDay();
    const hour = d.getHours();
    grid[day][hour].count++;
    if (r.status === 'SUCESSO') grid[day][hour].success++;
  });
  return grid;
}

function heatColor(cell: HeatCell): string {
  if (cell.count === 0) return 'rgba(255,255,255,0.03)';
  const rate = cell.success / cell.count;
  if (rate >= 0.9) return 'rgba(52,199,89,0.55)';
  if (rate >= 0.7) return 'rgba(52,199,89,0.3)';
  if (rate >= 0.5) return 'rgba(255,159,10,0.45)';
  return 'rgba(255,107,107,0.55)';
}

function HeatmapGrid({ results }: { results: TestResult[] }) {
  const grid = buildHeatmap(results);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span className="card-title">Padrão Semanal de Conectividade (Hora × Dia)</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Verde = alta taxa de sucesso · Vermelho = falhas
        </span>
      </div>
      <div className="card-body" style={{ padding: '12px 16px 16px', overflowX: 'auto' }}>
        <div style={{ minWidth: 540 }}>
          <div style={{ display: 'flex', marginLeft: 36, marginBottom: 4 }}>
            {hours.filter(h => h % 3 === 0).map(h => (
              <div key={h} style={{
                width: `${(3 / 24) * 100}%`, fontSize: '0.68rem',
                color: '#64748b', textAlign: 'left',
              }}>
                {String(h).padStart(2, '0')}h
              </div>
            ))}
          </div>
          {DAYS_PT.map((dayName, dayIdx) => (
            <div key={dayName} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ width: 34, fontSize: '0.72rem', color: '#64748b', textAlign: 'right', marginRight: 6 }}>
                {dayName}
              </span>
              <div style={{ display: 'flex', flex: 1, gap: 2 }}>
                {hours.map(h => {
                  const cell = grid[dayIdx][h];
                  const rate = cell.count > 0 ? Math.round((cell.success / cell.count) * 100) : null;
                  return (
                    <div
                      key={h}
                      title={cell.count === 0 ? `${dayName} ${h}h: sem testes` : `${dayName} ${h}h: ${cell.count} testes (${rate}% sucesso)`}
                      style={{
                        flex: 1, height: 16, borderRadius: 2,
                        background: heatColor(cell),
                        transition: 'opacity 0.15s',
                        cursor: cell.count > 0 ? 'pointer' : 'default',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ActivityTab = 'tests' | 'alerts';

interface TrunkStatus {
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  rttMs: number;
  checkedAt: string;
}

export default function Dashboard() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [alerts, setAlerts]   = useState<AlertCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [trunkStatus, setTrunkStatus] = useState<TrunkStatus | null>(null);
  const [activityTab, setActivityTab] = useState<ActivityTab>('tests');

  const fetchTrunkStatus = useCallback(async () => {
    try {
      const res = await api.get<TrunkStatus>('/stats/trunk-status');
      setTrunkStatus(res.data);
    } catch {
      setTrunkStatus({ status: 'UNKNOWN', rttMs: -1, checkedAt: new Date().toISOString() });
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([
        api.get<PageResponse<TestResult>>('/test-results?page=0&size=200'),
        api.get<PageResponse<AlertCall>>('/alert-calls?page=0&size=20'),
      ]);
      setResults(r.data.content ?? []);
      setAlerts(a.data.content ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetchTrunkStatus();

    const ws = connectWebSocket(() => setWsStatus('live'));
    ws.onDisconnect = () => setWsStatus('offline');

    const trunkInterval = setInterval(fetchTrunkStatus, 60_000);

    const unsubResults = subscribe<TestResult>('/topic/test-results', (newResult) => {
      setResults(prev => [newResult, ...prev].slice(0, 200));
    });
    const unsubAlerts = subscribe<AlertCall>('/topic/alerts', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev].slice(0, 20));
    });

    return () => { unsubResults(); unsubAlerts(); clearInterval(trunkInterval); };
  }, [loadData, fetchTrunkStatus]);

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const today = new Date().toDateString();
  const resultsToday = results.filter(r => new Date(r.executedAt).toDateString() === today);
  const successToday = resultsToday.filter(r => r.status === 'SUCESSO').length;
  const successRate  = resultsToday.length > 0
    ? Math.round((successToday / resultsToday.length) * 100) : 0;
  const activeAlerts  = alerts.filter(a => a.callStatus === 'PENDENTE').length;
  const alertsToday   = alerts.filter(a => new Date(a.callDate).toDateString() === today).length;

  // ─── Chart data ────────────────────────────────────────────────────────────
  const hourlyMap: Record<string, { hora: string; SUCESSO: number; FALHA: number; OUTROS: number }> = {};
  results.slice(0, 200).forEach(r => {
    const key = fmtHour(r.executedAt);
    if (!hourlyMap[key]) hourlyMap[key] = { hora: key, SUCESSO: 0, FALHA: 0, OUTROS: 0 };
    if (r.status === 'SUCESSO') hourlyMap[key].SUCESSO++;
    else if (r.status === 'FALHA') hourlyMap[key].FALHA++;
    else hourlyMap[key].OUTROS++;
  });
  const areaData = Object.values(hourlyMap).slice(-16);

  const statusCounts: Record<string, number> = {};
  results.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1; });
  const pieData = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 5);

  const CustomTooltip = ({ active, payload, label }: Partial<TooltipContentProps<ValueType, NameType>>) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 10, padding: '10px 14px', fontSize: '0.82rem',
      }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-state"><div className="spinner" />Carregando dashboard…</div>
  );

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dashboard Operacional</h1>
          <p className="page-subtitle">
            Visão em tempo real da conectividade SIP, testes automatizados e alertas
          </p>
        </div>
        <div className="header-actions">
          <span className={`badge ${wsStatus === 'live' ? 'badge-success' : 'badge-neutral'}`}>
            <span className="live-dot" />
            {wsStatus === 'live' ? 'WebSocket Ativo' : 'Reconectando…'}
          </span>
          <button className="btn btn-secondary" onClick={() => { setLoading(true); loadData(); fetchTrunkStatus(); }}>
            ↻ Atualizar
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="kpi-grid">
          <KpiCard
            icon={PhoneCall}
            value={resultsToday.length}
            label="Testes Hoje"
            badge={`${results.length} total`}
            badgeClass="badge-info"
          />
          <KpiCard
            icon={CheckCircle2}
            value={`${successRate}%`}
            label="Taxa de Sucesso"
            badge={`${successToday} com sucesso`}
            badgeClass={successRate >= 90 ? 'badge-success' : successRate >= 70 ? 'badge-warning' : 'badge-danger'}
          />
          <KpiCard
            icon={AlertTriangle}
            value={activeAlerts}
            label="Alertas Pendentes"
            badge={`${alertsToday} hoje`}
            badgeClass={activeAlerts === 0 ? 'badge-success' : 'badge-danger'}
          />
          <KpiCard
            icon={Radio}
            value={
              trunkStatus?.status === 'ONLINE'
                ? `Online (${trunkStatus.rttMs >= 0 ? `${trunkStatus.rttMs}ms` : 'ok'})`
                : trunkStatus?.status === 'OFFLINE'
                ? 'Offline'
                : 'Checando…'
            }
            label="Tronco SIP"
            badge={trunkStatus?.checkedAt ? fmt(trunkStatus.checkedAt) : 'Sem dados'}
            badgeClass={
              trunkStatus?.status === 'ONLINE'
                ? (trunkStatus.rttMs > 200 ? 'badge-warning' : 'badge-success')
                : trunkStatus?.status === 'OFFLINE'
                ? 'badge-danger'
                : 'badge-neutral'
            }
          />
        </div>

        {/* ── Gráficos: Linha temporal + Distribuição ──────────────────────── */}
        <div className="dashboard-grid-charts" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Área: Resultados por Hora */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Volume de Testes por Hora</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Últimas horas</span>
            </div>
            <div className="card-body" style={{ height: 260, padding: '10px 10px 0 0' }}>
              {areaData.length === 0 ? (
                <EmptyChart msg="Sem dados de testes no período" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSucesso" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34c759" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#34c759" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="gFalha" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="hora" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8 }} />
                    <Area type="monotone" dataKey="SUCESSO" name="Sucesso" stroke="#34c759" fill="url(#gSucesso)" strokeWidth={2} />
                    <Area type="monotone" dataKey="FALHA" name="Falha" stroke="#ff6b6b" fill="url(#gFalha)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Donut: Status dos Testes */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Status dos Testes</span>
            </div>
            <div className="card-body" style={{ height: 260 }}>
              {pieData.length === 0 ? (
                <EmptyChart msg="Sem resultados registrados" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="46%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_COLORS[entry.name] ?? PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '0.74rem' }}
                      formatter={(value: string) => (
                        <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* ── Heatmap ────────────────────────────────────────────────────── */}
        <HeatmapGrid results={results} />

        {/* ── Últimas Atividades (unificado com tabs) ────────────────────── */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className="card-title">
              Últimas Atividades
              {wsStatus === 'live' && (
                <span style={{ fontSize: '0.72rem', color: '#34c759', marginLeft: 10 }}>
                  ● ao vivo
                </span>
              )}
            </span>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { id: 'tests',  label: 'Testes',          count: results.length },
                { id: 'alerts', label: 'Alertas Zabbix',   count: alerts.length },
              ] as { id: ActivityTab; label: string; count: number }[]).map(tab => (
                <button
                  key={tab.id}
                  id={`dashboard-tab-${tab.id}`}
                  onClick={() => setActivityTab(tab.id)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, border: 'none',
                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    background: activityTab === tab.id
                      ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)',
                    color: activityTab === tab.id ? 'var(--clr-primary)' : 'var(--text-muted)',
                    outline: activityTab === tab.id ? '1px solid rgba(0,122,255,0.35)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  {tab.label}
                  <span style={{
                    marginLeft: 6, fontSize: '0.68rem', opacity: 0.7,
                    background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 10,
                  }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="card-body" style={{ padding: '0 20px 20px' }}>
            {/* Tab: Testes */}
            {activityTab === 'tests' && (
              <div className="recent-results-list">
                {results.length === 0 ? (
                  <p className="text-muted" style={{ textAlign: 'center', padding: 32 }}>
                    Aguardando primeiros resultados…
                  </p>
                ) : results.slice(0, 15).map(r => (
                  <div key={r.id} className="result-item">
                    <div className="result-status-dot"
                      style={{ background: STATUS_COLORS[r.status] ?? '#94a3b8' }} />
                    <span className="result-phone" style={{ minWidth: 120 }}>
                      {r.numberTest?.phoneNumber ?? `Teste #${r.numberTest?.id}`}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', flex: 1 }}>
                      {r.numberTest?.client?.name ?? ''}{r.numberTest?.businessUnit?.name ? ` · ${r.numberTest.businessUnit.name}` : ''}
                    </span>
                    <span className="badge" style={{
                      background: `${STATUS_COLORS[r.status] ?? '#94a3b8'}20`,
                      color: STATUS_COLORS[r.status] ?? '#94a3b8',
                      border: `1px solid ${STATUS_COLORS[r.status] ?? '#94a3b8'}40`,
                    }}>
                      {r.status}
                    </span>
                    {r.sipResponseCode && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>
                        SIP {r.sipResponseCode}
                      </span>
                    )}
                    <span className="result-time">{fmt(r.executedAt)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Alertas */}
            {activityTab === 'alerts' && (
              <div className="recent-results-list">
                {alerts.length === 0 ? (
                  <p className="text-muted" style={{ textAlign: 'center', padding: 32 }}>
                    Nenhum alerta Zabbix registrado
                  </p>
                ) : alerts.slice(0, 15).map(a => (
                  <div key={a.id} className="result-item">
                    <div className="result-status-dot"
                      style={{ background: ALERT_STATUS_COLOR[a.callStatus] ?? '#94a3b8' }} />
                    <span className="result-phone" style={{ minWidth: 130 }}>
                      {a.phoneNumber}
                    </span>
                    <span style={{
                      fontSize: '0.76rem', color: 'var(--text-muted)',
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {a.zabbixIncidentSummary ?? a.zabbixHost ?? ''}
                    </span>
                    <span className="badge" style={{
                      background: `${ALERT_STATUS_COLOR[a.callStatus] ?? '#94a3b8'}20`,
                      color: ALERT_STATUS_COLOR[a.callStatus] ?? '#94a3b8',
                      border: `1px solid ${ALERT_STATUS_COLOR[a.callStatus] ?? '#94a3b8'}40`,
                    }}>
                      {a.callStatus}
                    </span>
                    {a.telegramSentAt && (
                      <span title="Telegram enviado" style={{ fontSize: '0.85rem' }}>💬</span>
                    )}
                    <span className="result-time">{fmt(a.callDate)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, value, label, badge, badgeClass }: {
  icon: LucideIcon; value: string | number;
  label: string; badge: string; badgeClass: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-top">
        <span className="kpi-label">{label}</span>
        <div className={`kpi-icon ${badgeClass}`}><Icon size={16} strokeWidth={1.75} /></div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-badge ${badgeClass}`}>{badge}</div>
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <p className="text-muted" style={{ textAlign: 'center', padding: '40px 0' }}>
      {msg}
    </p>
  );
}
