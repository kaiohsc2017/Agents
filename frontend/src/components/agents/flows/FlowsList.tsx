import React, { useEffect, useState } from 'react';
import {
  GitFork, Plus, Play, Edit3, Trash2, CheckCircle2,
  Clock, AlertCircle, RefreshCw, Zap, ShieldCheck
} from 'lucide-react';
import type { AgentFlow } from '../types';
import agentsClient from '../agentsClient';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '../../ui/table';

interface FlowsListProps {
  onOpenCanvas: (flow: AgentFlow) => void;
  onOpenExecution: (execId: string) => void;
}

export const FlowsList: React.FC<FlowsListProps> = ({
  onOpenCanvas,
  onOpenExecution,
}) => {
  const [flows, setFlows] = useState<AgentFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await agentsClient.get('/flows/');
      setFlows(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar lista de fluxos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  const handleCreateNew = () => {
    const newFlow: AgentFlow = {
      id: '',
      name: 'Novo Fluxo de Automação',
      description: 'Orquestração visual multi-agente',
      is_active: true,
      trigger_type: 'manual',
      trigger_config: {},
      graph_data: {
        nodes: [
          {
            id: 'node_trigger_1',
            type: 'triggerNode',
            position: { x: 100, y: 150 },
            data: { label: 'Disparo Manual', subtext: 'Iniciado via interface' },
          },
          {
            id: 'node_action_1',
            type: 'actionNode',
            position: { x: 450, y: 150 },
            data: { label: 'Comando de Diagnóstico', subtext: 'Executa via SSH', cmd: 'uptime' },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'node_trigger_1', target: 'node_action_1', animated: true },
        ],
      },
      created_at: new Date().toISOString(),
    };
    onOpenCanvas(newFlow);
  };

  const handleRunNow = async (flowId: string) => {
    try {
      setRunningId(flowId);
      const res = await agentsClient.post(`/flows/${flowId}/run`, {
        trigger_source: 'flows_list_quick_run',
      });
      if (res.data?.execution_id) {
        onOpenExecution(res.data.execution_id);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Falha ao executar fluxo.');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (flowId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o fluxo "${name}"?`)) return;
    try {
      await agentsClient.delete(`/flows/${flowId}`);
      setFlows((prev) => prev.filter((f) => f.id !== flowId));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao excluir fluxo.');
    }
  };

  const activeCount = flows.filter((f) => f.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitFork className="h-5 w-5 text-primary" />
            Agent Flow Canvas
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Orquestrador visual Low-Code e colaboração Multi-Agente (DAG Swarm)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchFlows}
            className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Fluxo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total de Fluxos
            </span>
            <p className="text-2xl font-bold text-foreground mt-1">{flows.length}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <GitFork className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Fluxos Ativos
            </span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Auto-Remediação
            </span>
            <p className="text-sm font-semibold text-foreground mt-1">Self-Healing Ativo</p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">Nome do Fluxo</TableHead>
              <TableHead>Gatilho Principal</TableHead>
              <TableHead>Nós no DAG</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última Atualização</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && flows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-4 w-4 animate-spin" /> Carregando fluxos de automação...
                  </div>
                </TableCell>
              </TableRow>
            ) : flows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum fluxo cadastrado. Clique em <b>Novo Fluxo</b> para iniciar.
                </TableCell>
              </TableRow>
            ) : (
              flows.map((flow) => (
                <TableRow key={flow.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <div>
                      <span className="font-semibold text-foreground text-sm block">
                        {flow.name}
                      </span>
                      {flow.description && (
                        <span className="text-xs text-muted-foreground block truncate max-w-xs">
                          {flow.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      <Zap className="h-3 w-3 text-amber-500" />
                      {flow.trigger_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-foreground">
                      {flow.node_count || 0} blocos
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        flow.is_active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {flow.is_active ? 'Ativo' : 'Pausado'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {flow.updated_at ? new Date(flow.updated_at).toLocaleString('pt-BR') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleRunNow(flow.id)}
                        disabled={runningId === flow.id}
                        className="p-1.5 rounded-lg border border-border hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-muted-foreground"
                        title="Executar Agora ▶"
                      >
                        <Play className={`h-4 w-4 ${runningId === flow.id ? 'animate-spin' : ''}`} />
                      </button>

                      <button
                        onClick={async () => {
                          const res = await agentsClient.get(`/flows/${flow.id}`);
                          onOpenCanvas(res.data);
                        }}
                        className="p-1.5 rounded-lg border border-border hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                        title="Abrir no Canvas 🧩"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(flow.id, flow.name)}
                        className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                        title="Excluir Fluxo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
