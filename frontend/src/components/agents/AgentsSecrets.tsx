import { useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw, Bot, Clock, Info } from 'lucide-react';
import agentsApi, { getErrorMessage } from './agentsClient';
import type { Agent, AgentSecret, PaginatedResponse } from './types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function AgentsSecrets({ canWrite = true }: { canWrite?: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selAgent, setSelAgent] = useState('');
  const [secrets, setSecrets] = useState<AgentSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ key: '', value: '' });
  const [flashMsg, setFlashMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setFlashMsg({ type, text });
    setTimeout(() => setFlashMsg(null), 4000);
  };

  useEffect(() => {
    agentsApi
      .get<PaginatedResponse<Agent> | Agent[]>('/api/agents/?limit=200')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.items;
        setAgents(list);
        if (list.length > 0) {
          selectAgent(list[0].id);
        }
      })
      .catch(() => setAgents([]));
  }, []);

  const loadSecrets = (agentId: string) => {
    if (!agentId) return;
    setLoading(true);
    agentsApi
      .get<AgentSecret[]>(`/api/system/agents/${agentId}/secrets`)
      .then(({ data }) => setSecrets(Array.isArray(data) ? data : []))
      .catch((err) => notify(getErrorMessage(err, 'Erro ao carregar secrets do agente.'), 'error'))
      .finally(() => setLoading(false));
  };

  const selectAgent = (agentId: string) => {
    setSelAgent(agentId);
    setSecrets([]);
    setForm({ key: '', value: '' });
    loadSecrets(agentId);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key || !form.value) {
      notify('Preencha o nome da chave e o valor do segredo.', 'error');
      return;
    }

    agentsApi
      .post(`/api/system/agents/${selAgent}/secrets`, form)
      .then(() => {
        notify(`Secret "${form.key}" salvo com sucesso!`);
        setForm({ key: '', value: '' });
        loadSecrets(selAgent);
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao salvar secret.'), 'error'));
  };

  const handleDelete = (secretKey: string) => {
    if (!window.confirm(`Remover o secret "${secretKey}"?`)) return;
    agentsApi
      .delete(`/api/system/agents/${selAgent}/secrets/${encodeURIComponent(secretKey)}`)
      .then(() => {
        notify('Secret removido com sucesso!');
        loadSecrets(selAgent);
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao remover secret.'), 'error'));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Secrets Vault (Agentes)</h1>
            <Badge variant="outline" className="text-xs font-mono">
              Segurança
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Armazenamento seguro de credenciais, tokens e senhas referenciados dinamicamente por agentes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSecrets(selAgent)}
            disabled={loading || !selAgent}
            className="h-9 gap-1.5 font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
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

      {/* Info Card */}
      <Card className="border-border/60 bg-muted/10">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-foreground">Como utilizar Secrets nos Comandos?</p>
            <p className="text-muted-foreground leading-relaxed">
              Secrets são variáveis de ambiente criptografadas e restritas por agente. Utilize a sintaxe{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary font-semibold">{'{{NOME_DA_CHAVE}}'}</code>{' '}
              nos comandos de terminal ou queries SQL para que o valor seja injetado de forma segura no momento da execução.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Agent Selector Card */}
      <Card className="shadow-xs border-border/70 bg-card/60">
        <CardContent className="p-4">
          <div className="space-y-1.5 max-w-md">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-primary" />
              Selecione o Agente Alvo
            </Label>
            <select
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={selAgent}
              onChange={(e) => selectAgent(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Add Secret Form */}
      {selAgent && canWrite && (
        <Card className="shadow-xs border-border/70">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Novo Secret para o Agente
            </CardTitle>
            <CardDescription className="text-xs">
              Cadastre um par de chave e valor confidencial
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da Chave (Identificador Maiúsculo)</Label>
                  <Input
                    required
                    placeholder="Ex: DB_PASSWORD ou API_KEY"
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase().trim() })}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Confidencial</Label>
                  <Input
                    required
                    type="password"
                    placeholder="••••••••••••"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" className="font-semibold gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Salvar Secret
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Secrets Table */}
      {selAgent && (
        <Card className="shadow-xs border-border/70 overflow-hidden">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-semibold">Secrets Cadastrados</CardTitle>
            <CardDescription className="text-xs">
              Lista de variáveis sensíveis atribuídas ao agente selecionado
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-xs">Chave</TableHead>
                  <TableHead className="font-semibold text-xs">Valor</TableHead>
                  <TableHead className="font-semibold text-xs">Cadastrado em</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Carregando segredos...
                    </TableCell>
                  </TableRow>
                ) : secrets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-sm text-muted-foreground">
                      Nenhum secret cadastrado para este agente.
                    </TableCell>
                  </TableRow>
                ) : (
                  secrets.map((s) => (
                    <TableRow key={s.id ?? s.key} className="hover:bg-muted/30">
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs py-0.5">
                          {`{{${s.key}}}`}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground">
                        ••••••••••••
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(s.created_at).toLocaleString('pt-BR')}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        {canWrite && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleDelete(s.key)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
