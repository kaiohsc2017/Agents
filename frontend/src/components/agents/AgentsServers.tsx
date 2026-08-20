import { useEffect, useRef, useState } from 'react';
import { Server, Plus, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle, Key, Lock, X } from 'lucide-react';
import agentsApi, { getErrorMessage } from './agentsClient';
import type { PaginatedResponse, ServerEntry, ServerTestResult } from './types';
import { Card, CardContent } from '@/components/ui/card';
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

const EMPTY_SERVER: Omit<ServerEntry, 'id'> = {
  name: '',
  host: '',
  port: 22,
  username: 'root',
  auth_type: 'password',
  password: '',
  ssh_key: '',
  tags: [],
};

export default function AgentsServers({ canWrite = true }: { canWrite?: boolean }) {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerEntry | null>(null);
  const [formData, setFormData] = useState<Omit<ServerEntry, 'id'>>(EMPTY_SERVER);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ServerTestResult>>({});
  const [tagInput, setTagInput] = useState('');
  const [flashMsg, setFlashMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const flashMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setFlashMsg({ type, text });
    if (flashMsgTimerRef.current) clearTimeout(flashMsgTimerRef.current);
    flashMsgTimerRef.current = setTimeout(() => {
      flashMsgTimerRef.current = null;
      setFlashMsg(null);
    }, 4000);
  };

  // Limpa o timer da mensagem flash ao desmontar, evitando setState em componente já desmontado.
  useEffect(() => {
    return () => {
      if (flashMsgTimerRef.current) clearTimeout(flashMsgTimerRef.current);
    };
  }, []);

  const load = () => {
    setLoading(true);
    agentsApi
      .get<PaginatedResponse<ServerEntry> | ServerEntry[]>('/api/servers/?limit=200')
      .then(({ data }) => setServers(Array.isArray(data) ? data : data.items))
      .catch((err) => notify(getErrorMessage(err, 'Erro ao carregar servidores SSH.'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingServer(null);
    setFormData(EMPTY_SERVER);
    setTagInput('');
    setShowModal(true);
  };

  const openEdit = (s: ServerEntry) => {
    setEditingServer(s);
    setFormData(s);
    setTagInput('');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.username) return;

    const req = editingServer
      ? agentsApi.put(`/api/servers/${editingServer.id}`, formData)
      : agentsApi.post('/api/servers/', formData);

    req
      .then(() => {
        notify(editingServer ? 'Servidor atualizado!' : 'Servidor adicionado!');
        setShowModal(false);
        setEditingServer(null);
        load();
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao salvar servidor.'), 'error'));
  };

  const handleDelete = (s: ServerEntry) => {
    if (!window.confirm(`Remover o servidor "${s.name}" (${s.host})?`)) return;
    agentsApi
      .delete(`/api/servers/${s.id}`)
      .then(() => {
        notify('Servidor removido com sucesso!');
        setServers((prev) => prev.filter((x) => x.id !== s.id));
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao remover servidor.'), 'error'));
  };

  const handleTestConnection = (s: ServerEntry) => {
    setTestingId(s.id);
    agentsApi
      .post<ServerTestResult>(`/api/servers/${s.id}/test`, {})
      .then(({ data }) => {
        setTestResults((prev) => ({ ...prev, [s.id]: data }));
        if (data.ok) notify(`Conexão com ${s.name} bem-sucedida!`);
        else notify(`Falha na conexão com ${s.name}: ${data.error || 'Timeout'}`, 'error');
      })
      .catch((err) => {
        setTestResults((prev) => ({
          ...prev,
          [s.id]: { ok: false, error: getErrorMessage(err, 'Erro de rede.') },
        }));
        notify(`Falha ao testar ${s.name}.`, 'error');
      })
      .finally(() => setTestingId(null));
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    if (!formData.tags.includes(tagInput.trim())) {
      setFormData((f) => ({ ...f, tags: [...f.tags, tagInput.trim()] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormData((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Servidores & Hosts SSH</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {servers.length} Servidor{servers.length !== 1 ? 'es' : ''}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Destinos gerenciados para execução remota de testes, monitoramento e comandos Linux
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 gap-1.5 font-medium">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {canWrite && (
            <Button size="sm" onClick={openCreate} className="h-9 gap-1.5 font-semibold">
              <Plus className="h-4 w-4" />
              Novo Servidor
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

      {/* Servers Table */}
      <Card className="shadow-xs border-border/70 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-xs">Nome do Servidor</TableHead>
                <TableHead className="font-semibold text-xs">Host & Porta</TableHead>
                <TableHead className="font-semibold text-xs">Usuário & Autenticação</TableHead>
                <TableHead className="font-semibold text-xs">Tags</TableHead>
                <TableHead className="font-semibold text-xs">Diagnóstico</TableHead>
                <TableHead className="font-semibold text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Carregando servidores SSH...
                  </TableCell>
                </TableRow>
              ) : servers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    Nenhum servidor cadastrado. Clique em "Novo Servidor" para adicionar.
                  </TableCell>
                </TableRow>
              ) : (
                servers.map((s) => {
                  const isTesting = testingId === s.id;
                  const res = testResults[s.id];

                  return (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <Server className="h-3.5 w-3.5 text-primary" />
                          {s.name}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {s.host}:{s.port}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono">{s.username}</span>
                          {s.auth_type === 'key' ? (
                            <Badge variant="outline" className="text-[10px] py-0 gap-1 font-mono">
                              <Key className="h-2.5 w-2.5" /> SSH Key
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] py-0 gap-1 font-mono">
                              <Lock className="h-2.5 w-2.5" /> Senha
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.tags && s.tags.length > 0 ? (
                            s.tags.map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px] py-0">
                                {t}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {res ? (
                          res.ok ? (
                            <Badge variant="success" className="text-[10px] py-0 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Online
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] py-0 gap-1" title={res.error}>
                              <XCircle className="h-3 w-3" /> Falha
                            </Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">Não testado</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleTestConnection(s)}
                            disabled={isTesting}
                            className="h-7 text-xs gap-1 font-medium"
                          >
                            <RefreshCw className={`h-3 w-3 ${isTesting ? 'animate-spin' : ''}`} />
                            {isTesting ? 'Testando...' : 'Testar Conexão'}
                          </Button>

                          {canWrite && (
                            <>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => openEdit(s)}
                                className="h-7 w-7 p-0"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>

                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleDelete(s)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
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

      {/* Add / Edit Server Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-lg rounded-2xl border border-border bg-card text-foreground shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold">
                  {editingServer ? 'Editar Servidor SSH' : 'Novo Servidor SSH'}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              <div className="space-y-1.5">
                <Label className="text-xs">Identificador / Nome *</Label>
                <Input
                  required
                  placeholder="Ex: Asterisk PBX Core"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Host / IP *</Label>
                  <Input
                    required
                    placeholder="192.168.1.100 ou vps.empresa.com"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Porta</Label>
                  <Input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || 22 })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Usuário SSH *</Label>
                  <Input
                    required
                    placeholder="root"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de Autenticação</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.auth_type}
                    onChange={(e) =>
                      setFormData({ ...formData, auth_type: e.target.value as ServerEntry['auth_type'] })
                    }
                  >
                    <option value="password">Senha</option>
                    <option value="key">Chave Privada SSH</option>
                  </select>
                </div>
              </div>

              {formData.auth_type === 'password' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Senha SSH</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password ?? ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Chave Privada SSH (OpenSSH / PEM)</Label>
                  <textarea
                    rows={4}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                    value={formData.ssh_key ?? ''}
                    onChange={(e) => setFormData({ ...formData, ssh_key: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              {/* Tags */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs">Tags / Marcadores</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: telecom, production, db"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    className="text-xs"
                  />
                  <Button type="button" size="sm" onClick={addTag} className="shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {formData.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 text-xs">
                      {t}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(t)} />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" className="font-semibold">
                  Salvar Servidor
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
