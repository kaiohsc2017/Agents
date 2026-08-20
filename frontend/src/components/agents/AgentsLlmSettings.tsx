import { useEffect, useRef, useState } from 'react';
import { Sparkles, Save, RefreshCw, Play, CheckCircle2, XCircle, Eye, EyeOff, Lock } from 'lucide-react';
import agentsApi, { getErrorMessage } from './agentsClient';
import type { LlmConfigForm, LlmProvider, LlmStatus, LlmTestResult } from './types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AgentsLlmSettings({ canWrite = true }: { canWrite?: boolean }) {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [form, setForm] = useState<LlmConfigForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
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

  const toggleReveal = (k: string) => {
    setRevealed((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      agentsApi.get<LlmStatus>('/api/llm/status'),
      agentsApi.get<{ providers: LlmProvider[] }>('/api/llm/providers'),
      agentsApi.get<{ values: LlmConfigForm }>(canWrite ? '/api/llm/config/full' : '/api/llm/config'),
    ])
      .then(([statusRes, providersRes, configRes]) => {
        setStatus(statusRes.data);
        setProviders(providersRes.data.providers || []);
        setForm(configRes.data.values || {});
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao carregar configurações de IA.'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [canWrite]);

  const setF = (k: string, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    agentsApi
      .post<{ ok: boolean; status: LlmStatus; detail?: string }>('/api/llm/config', form)
      .then(({ data }) => {
        if (data.ok) {
          notify('Configurações de IA salvas com sucesso!');
          setStatus(data.status);
        } else {
          notify(data.detail || 'Erro ao salvar configurações.', 'error');
        }
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao salvar.'), 'error'))
      .finally(() => setSaving(false));
  };

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    agentsApi
      .post<LlmTestResult>('/api/llm/test', {})
      .then(({ data }) => {
        setTestResult(data);
        if (data.ok) {
          notify('Teste de raciocínio de IA concluído com sucesso!');
        } else {
          notify(`Falha no teste: ${data.error || 'Erro desconhecido'}`, 'error');
        }
      })
      .catch((err) => {
        setTestResult({ ok: false, error: getErrorMessage(err, 'Falha na requisição de teste.') });
        notify('Erro ao testar provedor de IA.', 'error');
      })
      .finally(() => setTesting(false));
  };

  const currentProvider = providers.find((p) => form && p.id === (form['AGENTS_LLM_PROVIDER'] || status?.provider));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações de Modelos IA & LLMs</h1>
            <Badge variant="info" className="text-xs font-mono">
              Inteligência
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Provedores de inferência, chaves de API, orquestração e fallback para os agentes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 gap-1.5 font-medium">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !status?.ready}
            className="h-9 gap-1.5 font-medium"
          >
            <Play className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testando IA...' : 'Testar Prompt'}
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

      {/* Test Result Box */}
      {testResult && (
        <Card
          className={`border ${
            testResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-destructive/30 bg-destructive/5'
          }`}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-xs font-bold">
                {testResult.ok ? 'Teste de Raciocínio Concluído com Sucesso' : 'Falha na Inferência'}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono ml-auto">
                {testResult.provider} / {testResult.model}
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground bg-background/80 p-2.5 rounded-lg border border-border/40 whitespace-pre-wrap">
              {testResult.ok ? testResult.response : testResult.error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status Bar Card */}
      <Card className="shadow-xs border-border/70">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">Motor de IA / LLM</span>
                {status?.ready ? (
                  <Badge variant="success" className="text-[10px] gap-1 font-mono">
                    <CheckCircle2 className="h-3 w-3" /> Operacional
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] gap-1 font-mono">
                    <XCircle className="h-3 w-3" /> Desabilitado / Sem Chave
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Provedor Ativo: <strong className="text-foreground">{status?.provider || 'Nenhum'}</strong> | Modelo:{' '}
                <strong className="text-foreground">{status?.model || '—'}</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Form */}
      {form && (
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="shadow-xs border-border/70">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold">Provedor e Modelo Principal</CardTitle>
              <CardDescription className="text-xs">
                Selecione o provedor de IA utilizado para geração de diagnósticos e decisões automáticas
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Provedor LLM</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form['AGENTS_LLM_PROVIDER'] || 'google'}
                    onChange={(e) => setF('AGENTS_LLM_PROVIDER', e.target.value)}
                    disabled={!canWrite}
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label || p.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Modelo Ativo</Label>
                  <Input
                    placeholder="Ex: gemini-2.5-flash"
                    value={form['AGENTS_LLM_MODEL'] || ''}
                    onChange={(e) => setF('AGENTS_LLM_MODEL', e.target.value)}
                    className="font-mono text-xs"
                    disabled={!canWrite}
                  />
                  {currentProvider && currentProvider.models.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {currentProvider.models.map((m) => (
                        <button
                          type="button"
                          key={m}
                          onClick={() => setF('AGENTS_LLM_MODEL', m)}
                          className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Habilitar IA para Agentes</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form['AGENTS_LLM_ENABLED'] || 'false'}
                    onChange={(e) => setF('AGENTS_LLM_ENABLED', e.target.value)}
                    disabled={!canWrite}
                  >
                    <option value="true">Habilitado (Ativo)</option>
                    <option value="false">Desabilitado</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Keys Card */}
          <Card className="shadow-xs border-border/70">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold">Chaves de API dos Provedores</CardTitle>
              <CardDescription className="text-xs">
                Credenciais necessárias para autenticação com as APIs de cada fabricante
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Google Gemini */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Google Gemini API Key</Label>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      <Lock className="h-2.5 w-2.5 mr-0.5" /> Secreto
                    </Badge>
                  </div>
                  <div className="relative">
                    <Input
                      type={revealed['AGENTS_LLM_GOOGLE_KEY'] ? 'text' : 'password'}
                      placeholder="AIzaSy..."
                      value={form['AGENTS_LLM_GOOGLE_KEY'] || ''}
                      onChange={(e) => setF('AGENTS_LLM_GOOGLE_KEY', e.target.value)}
                      className="font-mono text-xs pr-9"
                      disabled={!canWrite}
                    />
                    <button
                      type="button"
                      onClick={() => toggleReveal('AGENTS_LLM_GOOGLE_KEY')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {revealed['AGENTS_LLM_GOOGLE_KEY'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Anthropic Claude */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Anthropic Claude API Key</Label>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      <Lock className="h-2.5 w-2.5 mr-0.5" /> Secreto
                    </Badge>
                  </div>
                  <div className="relative">
                    <Input
                      type={revealed['AGENTS_LLM_ANTHROPIC_KEY'] ? 'text' : 'password'}
                      placeholder="sk-ant-..."
                      value={form['AGENTS_LLM_ANTHROPIC_KEY'] || ''}
                      onChange={(e) => setF('AGENTS_LLM_ANTHROPIC_KEY', e.target.value)}
                      className="font-mono text-xs pr-9"
                      disabled={!canWrite}
                    />
                    <button
                      type="button"
                      onClick={() => toggleReveal('AGENTS_LLM_ANTHROPIC_KEY')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {revealed['AGENTS_LLM_ANTHROPIC_KEY'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* OpenAI */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">OpenAI API Key</Label>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      <Lock className="h-2.5 w-2.5 mr-0.5" /> Secreto
                    </Badge>
                  </div>
                  <div className="relative">
                    <Input
                      type={revealed['AGENTS_LLM_OPENAI_KEY'] ? 'text' : 'password'}
                      placeholder="sk-..."
                      value={form['AGENTS_LLM_OPENAI_KEY'] || ''}
                      onChange={(e) => setF('AGENTS_LLM_OPENAI_KEY', e.target.value)}
                      className="font-mono text-xs pr-9"
                      disabled={!canWrite}
                    />
                    <button
                      type="button"
                      onClick={() => toggleReveal('AGENTS_LLM_OPENAI_KEY')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {revealed['AGENTS_LLM_OPENAI_KEY'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Compat / Ollama URL */}
                <div className="space-y-1.5">
                  <Label className="text-xs">OpenAI Compatible Base URL (Ollama / LocalAI / Groq)</Label>
                  <Input
                    placeholder="http://localhost:11434/v1"
                    value={form['AGENTS_LLM_COMPAT_URL'] || ''}
                    onChange={(e) => setF('AGENTS_LLM_COMPAT_URL', e.target.value)}
                    className="font-mono text-xs"
                    disabled={!canWrite}
                  />
                </div>
              </div>

              {canWrite && (
                <div className="flex justify-end pt-4 border-t border-border/50">
                  <Button type="submit" disabled={saving} className="h-9 gap-1.5 font-semibold">
                    <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
                    Salvar Configurações de IA
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
