import { useEffect, useState } from 'react';
import {
  Bot,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  Terminal,
  Search,
  RefreshCw,
  Clock,
} from 'lucide-react';
import agentsApi, { getErrorMessage } from './agentsClient';
import { StatusBadge } from './StatusBadge';
import { AgentModal } from './AgentModal';
import { AgentLogModal } from './AgentLogModal';
import type { Agent, AgentFormData, PaginatedResponse, ServerEntry } from './types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const TYPE_CONFIG: Record<Agent['type'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'info' }> = {
  ssh_test:    { label: 'SSH Test', variant: 'outline' },
  web_monitor: { label: 'Web Monitor', variant: 'info' },
  log_monitor: { label: 'Log Monitor', variant: 'secondary' },
  database:    { label: 'Database SQL', variant: 'default' },
};

export default function AgentsList({ canWrite = true }: { canWrite?: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [logsAgent, setLogsAgent] = useState<{ id: string; name: string } | null>(null);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [flashMsg, setFlashMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setFlashMsg({ type, text });
    setTimeout(() => setFlashMsg(null), 4000);
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      agentsApi.get<PaginatedResponse<Agent> | Agent[]>('/api/agents/?limit=200'),
      agentsApi.get<PaginatedResponse<ServerEntry> | ServerEntry[]>('/api/servers/?limit=200'),
    ])
      .then(([agentsRes, serversRes]) => {
        setAgents(Array.isArray(agentsRes.data) ? agentsRes.data : agentsRes.data.items);
        setServers(Array.isArray(serversRes.data) ? serversRes.data : serversRes.data.items);
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao carregar agentes e servidores.'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = (data: AgentFormData) => {
    const req = editingAgent
      ? agentsApi.put<Agent>(`/api/agents/${editingAgent.id}`, data)
      : agentsApi.post<Agent>('/api/agents/', data);

    req
      .then(() => {
        notify(editingAgent ? 'Agente atualizado com sucesso!' : 'Agente criado com sucesso!');
        setShowModal(false);
        setEditingAgent(null);
        load();
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao salvar agente.'), 'error'));
  };

  const handleDelete = (agent: Agent) => {
    if (!window.confirm(`Deseja realmente remover o agente "${agent.name}"?`)) return;
    agentsApi
      .delete(`/api/agents/${agent.id}`)
      .then(() => {
        notify('Agente removido com sucesso!');
        setAgents((prev) => prev.filter((x) => x.id !== agent.id));
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao remover agente.'), 'error'));
  };

  const handleToggleStatus = (agent: Agent) => {
    const action = agent.status === 'paused' ? 'resume' : 'pause';
    agentsApi
      .post(`/api/agents/${agent.id}/${action}`, {})
      .then(() => {
        notify(action === 'resume' ? 'Agente retomado.' : 'Agente pausado.');
        load();
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao alterar status.'), 'error'));
  };

  const handleRunNow = (agent: Agent) => {
    setRunningIds((prev) => new Set(prev).add(agent.id));
    agentsApi
      .post(`/api/agents/${agent.id}/run`, {})
      .then(() => {
        notify(`Execução do agente "${agent.name}" iniciada.`);
        setTimeout(load, 1500);
      })
      .catch((err) => notify(getErrorMessage(err, 'Falha ao iniciar execução.'), 'error'))
      .finally(() => {
        setTimeout(() => {
          setRunningIds((prev) => {
            const next = new Set(prev);
            next.delete(agent.id);
            return next;
          });
        }, 3000);
      });
  };

  const filteredAgents = agents.filter((a) => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || a.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Agentes Autônomos</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {agents.length} Cadastrado{agents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de robôs inteligentes para monitoramento ativo, diagnósticos e auto-remediação
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="h-9 gap-1.5 font-medium cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => {
                setEditingAgent(null);
                setShowModal(true);
              }}
              className="h-9 gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Novo Agente
            </Button>
          )}
        </div>
      </div>

      {flashMsg && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium border flex items-center justify-between animate-in slide-in-from-top duration-200 ${
            flashMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          <span>{flashMsg.text}</span>
          <button onClick={() => setFlashMsg(null)} className="cursor-pointer font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Filters Card */}
      <Card className="shadow-xs border-border/70 bg-card/60">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição do agente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Todos os Tipos</option>
              <option value="ssh_test">SSH Test</option>
              <option value="web_monitor">Web Monitor</option>
              <option value="log_monitor">Log Monitor</option>
              <option value="database">Database SQL</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Agents Table */}
      <Card className="shadow-xs border-border/70 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-xs">Agente</TableHead>
                <TableHead className="font-semibold text-xs">Tipo</TableHead>
                <TableHead className="font-semibold text-xs">Status</TableHead>
                <TableHead className="font-semibold text-xs">Frequência</TableHead>
                <TableHead className="font-semibold text-xs">Última Execução</TableHead>
                <TableHead className="font-semibold text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Carregando agentes cadastrados...
                  </TableCell>
                </TableRow>
              ) : filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    Nenhum agente encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map((agent) => {
                  const typeCfg = TYPE_CONFIG[agent.type] ?? { label: agent.type, variant: 'outline' };
                  const isRunningNow = runningIds.has(agent.id);

                  return (
                    <TableRow key={agent.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                            {agent.name}
                          </div>
                          {agent.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{agent.description}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant={typeCfg.variant} className="text-[10px] font-mono">
                          {typeCfg.label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={agent.status} />
                      </TableCell>

                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {agent.schedule?.type === 'interval' && `A cada ${agent.schedule.value || '5m'}`}
                        {agent.schedule?.type === 'cron' && `Cron: ${agent.schedule.value}`}
                        {agent.schedule?.type === 'always' && 'Daemon Contínuo'}
                        {agent.schedule?.type === 'once' && 'Sob demanda'}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {agent.last_run ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(agent.last_run).toLocaleString('pt-BR')}
                          </span>
                        ) : (
                          'Nunca executado'
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="xs"
                            variant="outline"
                            title="Executar Agora"
                            onClick={() => handleRunNow(agent)}
                            disabled={isRunningNow || agent.status === 'paused'}
                            className="h-7 w-7 p-0 cursor-pointer text-emerald-600 hover:text-emerald-700"
                          >
                            <Play className={`h-3 w-3 ${isRunningNow ? 'animate-spin' : ''}`} />
                          </Button>

                          <Button
                            size="xs"
                            variant="outline"
                            title={agent.status === 'paused' ? 'Retomar' : 'Pausar'}
                            onClick={() => handleToggleStatus(agent)}
                            className="h-7 w-7 p-0 cursor-pointer"
                          >
                            <Pause className="h-3 w-3" />
                          </Button>

                          <Button
                            size="xs"
                            variant="outline"
                            title="Ver Logs"
                            onClick={() => setLogsAgent({ id: agent.id, name: agent.name })}
                            className="h-7 w-7 p-0 cursor-pointer text-blue-500 hover:text-blue-600"
                          >
                            <Terminal className="h-3 w-3" />
                          </Button>

                          {canWrite && (
                            <>
                              <Button
                                size="xs"
                                variant="outline"
                                title="Editar"
                                onClick={() => {
                                  setEditingAgent(agent);
                                  setShowModal(true);
                                }}
                                className="h-7 w-7 p-0 cursor-pointer"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>

                              <Button
                                size="xs"
                                variant="outline"
                                title="Remover"
                                onClick={() => handleDelete(agent)}
                                className="h-7 w-7 p-0 cursor-pointer text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Modal */}
      {showModal && (
        <AgentModal
          agent={editingAgent}
          servers={servers}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingAgent(null);
          }}
        />
      )}

      {/* Log Console Modal */}
      {logsAgent && (
        <AgentLogModal
          agentId={logsAgent.id}
          agentName={logsAgent.name}
          onClose={() => setLogsAgent(null)}
        />
      )}
    </div>
  );
}
