import { useEffect, useState, useRef } from 'react';
import { Terminal, Download, RefreshCw, Bot, PlayCircle, Copy, Check } from 'lucide-react';
import agentsApi from './agentsClient';
import type { Agent, Execution, LogEntry, PaginatedResponse } from './types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-rose-400',
};

export default function AgentsLogs() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [execs, setExecs] = useState<Execution[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selAgent, setSelAgent] = useState('');
  const [selExec, setSelExec] = useState('');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingExecs, setLoadingExecs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    agentsApi
      .get<PaginatedResponse<Agent> | Agent[]>('/api/agents/?limit=200')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.items;
        setAgents(list);
        if (list.length > 0) {
          setSelAgent(list[0].id);
        }
      })
      .catch(() => setAgents([]))
      .finally(() => setLoadingAgents(false));
  }, []);

  useEffect(() => {
    if (!selAgent) return;
    setExecs([]);
    setLogs([]);
    setSelExec('');
    setLoadingExecs(true);

    agentsApi
      .get<PaginatedResponse<Execution> | Execution[]>(`/api/executions/?agent_id=${selAgent}&limit=50`)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.items;
        setExecs(list);
        if (list.length > 0) {
          setSelExec(list[0].id);
        }
      })
      .catch(() => setExecs([]))
      .finally(() => setLoadingExecs(false));
  }, [selAgent]);

  useEffect(() => {
    if (!selExec) return;
    setLogs([]);
    setLoadingLogs(true);

    agentsApi
      .get<LogEntry[]>(`/api/executions/${selExec}/logs?limit=500`)
      .then(({ data }) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false));
  }, [selExec]);

  const copyLogs = () => {
    const text = logs
      .map((l) => `[${l.ts}] [${l.level.toUpperCase()}] ${l.server ? `[${l.server}] ` : ''}${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLogs = () => {
    const text = logs
      .map((l) => `[${l.ts}] [${l.level.toUpperCase()}] ${l.server ? `[${l.server}] ` : ''}${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-agent-${selAgent}-exec-${selExec}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Logs de Execução</h1>
            <Badge variant="outline" className="text-xs font-mono">
              Terminal
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Console detalhado de inspeção de logs, stdout/stderr de comandos e diagnósticos de IA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyLogs}
            disabled={logs.length === 0}
            className="h-9 gap-1.5 font-medium"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado' : 'Copiar Logs'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={downloadLogs}
            disabled={logs.length === 0}
            className="h-9 gap-1.5 font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar .txt
          </Button>
        </div>
      </div>

      {/* Selectors Bar */}
      <Card className="shadow-xs border-border/70 bg-card/60">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-primary" />
              Agente Autônomo
            </label>
            <select
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={selAgent}
              onChange={(e) => setSelAgent(e.target.value)}
              disabled={loadingAgents}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <PlayCircle className="h-3.5 w-3.5 text-primary" />
              Execução Registrada
            </label>
            <select
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={selExec}
              onChange={(e) => setSelExec(e.target.value)}
              disabled={loadingExecs || execs.length === 0}
            >
              {execs.length === 0 ? (
                <option value="">Nenhuma execução para este agente</option>
              ) : (
                execs.map((e) => (
                  <option key={e.id} value={e.id}>
                    {new Date(e.started_at).toLocaleString('pt-BR')} — {e.status.toUpperCase()} ({e.passed_checks ?? 0}/{e.total_checks ?? 0} OK)
                  </option>
                ))
              )}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Terminal View */}
      <div className="flex flex-col h-[550px] rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl overflow-hidden font-mono">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-300 font-semibold">Console de Execução</span>
            {selExec && (
              <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-400">
                ID: {selExec.substring(0, 8)}
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-slate-500">{logs.length} linhas de log</span>
        </div>

        {/* Terminal Output */}
        <div className="flex-1 p-4 overflow-y-auto space-y-1 text-xs select-text">
          {loadingLogs ? (
            <div className="flex items-center justify-center h-full text-slate-500 gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Carregando logs da execução...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              Nenhum log encontrado para esta execução.
            </div>
          ) : (
            logs.map((log, i) => {
              const colorClass = LEVEL_COLORS[log.level] ?? 'text-slate-300';
              return (
                <div key={i} className="flex items-start gap-2 leading-relaxed hover:bg-slate-900/50 px-1 rounded">
                  <span className="text-slate-500 shrink-0 select-none">
                    {new Date(log.ts).toLocaleTimeString('pt-BR')}
                  </span>
                  <span className={`uppercase text-[10px] font-bold px-1 rounded bg-slate-900 shrink-0 ${colorClass}`}>
                    {log.level}
                  </span>
                  {log.server && (
                    <span className="text-cyan-400 shrink-0">[{log.server}]</span>
                  )}
                  <span className="text-slate-200 break-all whitespace-pre-wrap">{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
