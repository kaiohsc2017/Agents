import { useEffect, useRef, useState } from 'react';
import { Terminal, X, ArrowDown, Copy, Check, RefreshCw } from 'lucide-react';
import agentsApi from './agentsClient';
import type { LogEntry } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AgentLogModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-rose-400',
};

export function AgentLogModal({ agentId, agentName, onClose }: AgentLogModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 1. Carga inicial dos logs recentes
    agentsApi
      .get<LogEntry[]>(`/api/agents/${agentId}/logs?limit=300`)
      .then(({ data }) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));

    // 2. Conexão WebSocket para streaming em tempo real
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/agents/ws/logs/${agentId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data);
          if (entry && entry.message) {
            setLogs((prev) => [...prev, entry]);
          }
        } catch {
          // ignore parse error
        }
      };

      ws.onerror = () => {
        // ws error fallback
      };
    } catch {
      // ignore
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [agentId]);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const copyLogs = () => {
    const text = logs.map((l) => `[${l.ts}] [${l.level.toUpperCase()}] ${l.server ? `[${l.server}] ` : ''}${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-4xl h-[80vh] rounded-xl border border-border bg-slate-950 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">Console de Logs — {agentName}</h2>
            <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-300">
              Streaming Realtime
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-xs h-7 gap-1 border-slate-700 ${autoScroll ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'}`}
            >
              <ArrowDown className="h-3 w-3" />
              Auto-scroll
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={copyLogs}
              className="text-xs h-7 gap-1 border-slate-700 text-slate-300 hover:text-white"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 bg-slate-950 select-text">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500 gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Carregando logs do agente...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              Nenhum log registrado para este agente.
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
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
