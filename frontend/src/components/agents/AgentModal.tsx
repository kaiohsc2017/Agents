import { useState } from 'react';
import { X, Plus, Trash2, Bot, Terminal, Clock, Bell, Check } from 'lucide-react';
import type { Agent, AgentCheck, AgentFormData, ServerEntry } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

const EMPTY_FORM: AgentFormData = {
  name: '',
  description: '',
  type: 'ssh_test',
  skill: '',
  server_ids: [],
  target_urls: [],
  rules: { checks: [], use_ai_on_failure: true },
  schedule: { type: 'interval', value: '5m', active: true },
  notify_telegram: false,
  telegram_chat: '',
  notify_email: false,
  notify_email_to: '',
  notify_webhook: false,
  notify_webhook_url: '',
};

const EMPTY_CHECK: AgentCheck = { name: '', cmd: '', expect: '', fix_hint: '' };

interface AgentModalProps {
  agent: Agent | null;
  servers: ServerEntry[];
  onSave: (data: AgentFormData) => void;
  onClose: () => void;
}

type FormTab = 'geral' | 'regras' | 'agendamento' | 'notificacoes';

export function AgentModal({ agent, servers, onSave, onClose }: AgentModalProps) {
  const [form, setForm] = useState<AgentFormData>(agent ? { ...EMPTY_FORM, ...agent } : EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<FormTab>('geral');
  const [chk, setChk] = useState<AgentCheck>(EMPTY_CHECK);
  const [urlVal, setUrlVal] = useState('');

  const setF = <K extends keyof AgentFormData>(k: K, v: AgentFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setSch = (k: keyof AgentFormData['schedule'], v: unknown) =>
    setForm((f) => ({ ...f, schedule: { ...f.schedule, [k]: v } }));

  const addCheck = () => {
    if (!chk.cmd) return;
    setF('rules', { ...form.rules, checks: [...(form.rules.checks ?? []), chk] });
    setChk(EMPTY_CHECK);
  };

  const delCheck = (i: number) => {
    const checks = [...(form.rules.checks ?? [])];
    checks.splice(i, 1);
    setF('rules', { ...form.rules, checks });
  };

  const addUrl = () => {
    if (!urlVal) return;
    setF('target_urls', [...(form.target_urls ?? []), urlVal]);
    setUrlVal('');
  };

  const delUrl = (i: number) => {
    const urls = [...(form.target_urls ?? [])];
    urls.splice(i, 1);
    setF('target_urls', urls);
  };

  const toggleServer = (id: string) => {
    const cur = form.server_ids ?? [];
    setF('server_ids', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border bg-card text-foreground shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {agent ? 'Editar Agente Autônomo' : 'Novo Agente Autônomo'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Configuração de tarefas, diagnósticos e automações inteligentes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border px-6 gap-2 bg-muted/10 pt-2">
          {(
            [
              { id: 'geral', label: 'Geral & Tipo', icon: Bot },
              { id: 'regras', label: 'Regras & Comandos', icon: Terminal },
              { id: 'agendamento', label: 'Agendamento', icon: Clock },
              { id: 'notificacoes', label: 'Notificações', icon: Bell },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                  activeTab === t.id
                    ? 'border-primary text-primary bg-card'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ABA 1: GERAL */}
          {activeTab === 'geral' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Agente *</Label>
                  <Input
                    required
                    placeholder="Ex: Monitor de Disco VPS"
                    value={form.name}
                    onChange={(e) => setF('name', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de Agente</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.type}
                    onChange={(e) => setF('type', e.target.value as AgentFormData['type'])}
                  >
                    <option value="ssh_test">SSH Test (Comandos Linux via SSH)</option>
                    <option value="web_monitor">Web Monitor (HTTP/HTTPS Endpoint)</option>
                    <option value="log_monitor">Log Monitor (Varredura de Logs)</option>
                    <option value="database">Database (Consultas e Validações SQL)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Descrição Operacional</Label>
                <Input
                  placeholder="Finalidade do agente, impacto em telecom ou infraestrutura"
                  value={form.description ?? ''}
                  onChange={(e) => setF('description', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Skill / Especialidade IA</Label>
                <Input
                  placeholder="Ex: sysadmin, dba, telecom, network"
                  value={form.skill ?? ''}
                  onChange={(e) => setF('skill', e.target.value)}
                />
              </div>

              {/* Servidores Vinculados (para SSH Test) */}
              {form.type === 'ssh_test' && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs font-semibold">Servidores SSH Alvo</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {servers.length === 0 ? (
                      <p className="text-xs text-muted-foreground col-span-3">Nenhum servidor SSH cadastrado.</p>
                    ) : (
                      servers.map((s) => {
                        const checked = (form.server_ids ?? []).includes(s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => toggleServer(s.id)}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                              checked
                                ? 'border-primary bg-primary/10 text-foreground font-medium'
                                : 'border-border/60 hover:bg-muted/30 text-muted-foreground'
                            }`}
                          >
                            <span className="truncate">{s.name} ({s.host})</span>
                            {checked && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* URLs Alvo (para Web Monitor) */}
              {form.type === 'web_monitor' && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs font-semibold">URLs de Monitoramento</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://exemplo.com/api/health"
                      value={urlVal}
                      onChange={(e) => setUrlVal(e.target.value)}
                      className="text-xs"
                    />
                    <Button type="button" size="sm" onClick={addUrl} className="shrink-0 gap-1 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-1 mt-2">
                    {(form.target_urls ?? []).map((url, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/40 text-xs border border-border/40">
                        <span className="font-mono">{url}</span>
                        <Button type="button" size="xs" variant="ghost" onClick={() => delUrl(i)} className="text-destructive h-6 w-6 p-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: REGRAS */}
          {activeTab === 'regras' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Comandos & Verificações</h3>
                  <p className="text-[11px] text-muted-foreground">Regras de validação executadas sequencialmente pelo agente</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.rules?.use_ai_on_failure ?? false}
                      onChange={(e) => setF('rules', { ...form.rules, use_ai_on_failure: e.target.checked })}
                      className="rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="font-medium text-xs">Acionar IA em caso de falha</span>
                  </label>
                </div>
              </div>

              {/* Checks cadastrados */}
              <div className="space-y-2">
                {(form.rules?.checks ?? []).map((c, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{c.name || `Check #${i + 1}`}</span>
                      <Button type="button" size="xs" variant="ghost" onClick={() => delCheck(i)} className="text-destructive h-6 w-6 p-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="font-mono text-emerald-600 dark:text-emerald-400 bg-background/80 p-1.5 rounded border border-border/40">
                      $ {c.cmd}
                    </div>
                    {c.expect && <p className="text-muted-foreground text-[11px]">Expectativa: <code className="text-foreground">{c.expect}</code></p>}
                    {c.fix_hint && <p className="text-amber-600 dark:text-amber-400 text-[11px]">Dica IA: {c.fix_hint}</p>}
                  </div>
                ))}
              </div>

              {/* Adicionar novo check */}
              <Card className="border-border/60 bg-muted/5">
                <CardContent className="p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold text-foreground">Novo Check</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Nome do check (ex: Checar RAM)"
                      value={chk.name ?? ''}
                      onChange={(e) => setChk({ ...chk, name: e.target.value })}
                      className="text-xs"
                    />
                    <Input
                      placeholder="Comando (ex: free -m | grep Mem)"
                      value={chk.cmd}
                      onChange={(e) => setChk({ ...chk, cmd: e.target.value })}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Expectativa regex / string esperada"
                      value={chk.expect ?? ''}
                      onChange={(e) => setChk({ ...chk, expect: e.target.value })}
                      className="text-xs"
                    />
                    <Input
                      placeholder="Dica de correção / sugestão para IA"
                      value={chk.fix_hint ?? ''}
                      onChange={(e) => setChk({ ...chk, fix_hint: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <Button type="button" size="xs" onClick={addCheck} className="gap-1 font-semibold text-xs mt-1">
                    <Plus className="h-3 w-3" /> Incluir Check
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ABA 3: AGENDAMENTO */}
          {activeTab === 'agendamento' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Frequência de Execução</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.schedule.type}
                    onChange={(e) => setSch('type', e.target.value)}
                  >
                    <option value="interval">Intervalo Contínuo (ex: 5m, 1h)</option>
                    <option value="cron">Expressão Cron (ex: 0 */2 * * *)</option>
                    <option value="always">Execução Contínua Daemon</option>
                    <option value="once">Manual / Apenas sob demanda</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Valor do Agendamento</Label>
                  <Input
                    placeholder="Ex: 5m ou 0 */2 * * *"
                    value={form.schedule.value ?? ''}
                    onChange={(e) => setSch('value', e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/20 border border-border/60">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.schedule.active ?? true}
                    onChange={(e) => setSch('active', e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="font-medium">Agendador Ativo (execução automática habilitada)</span>
                </label>
              </div>
            </div>
          )}

          {/* ABA 4: NOTIFICAÇÕES */}
          {activeTab === 'notificacoes' && (
            <div className="space-y-4">
              <div className="space-y-3 p-3.5 rounded-lg border border-border/60 bg-muted/10">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.notify_telegram ?? false}
                    onChange={(e) => setF('notify_telegram', e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  Notificar via Telegram em caso de falha
                </label>
                {form.notify_telegram && (
                  <Input
                    placeholder="Telegram Chat ID (deixe vazio para usar o padrão)"
                    value={form.telegram_chat ?? ''}
                    onChange={(e) => setF('telegram_chat', e.target.value)}
                    className="text-xs"
                  />
                )}
              </div>

              <div className="space-y-3 p-3.5 rounded-lg border border-border/60 bg-muted/10">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.notify_email ?? false}
                    onChange={(e) => setF('notify_email', e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  Notificar via E-mail Corporativo
                </label>
                {form.notify_email && (
                  <Input
                    placeholder="destinatario@empresa.com.br"
                    value={form.notify_email_to ?? ''}
                    onChange={(e) => setF('notify_email_to', e.target.value)}
                    className="text-xs"
                  />
                )}
              </div>

              <div className="space-y-3 p-3.5 rounded-lg border border-border/60 bg-muted/10">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.notify_webhook ?? false}
                    onChange={(e) => setF('notify_webhook', e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  Disparar Webhook HTTP POST
                </label>
                {form.notify_webhook && (
                  <Input
                    placeholder="https://api.empresa.com/webhook/alerts"
                    value={form.notify_webhook_url ?? ''}
                    onChange={(e) => setF('notify_webhook_url', e.target.value)}
                    className="text-xs"
                  />
                )}
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="font-semibold">
              Salvar Agente
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
