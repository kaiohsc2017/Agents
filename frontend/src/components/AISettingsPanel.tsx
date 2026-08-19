import React, { useEffect, useState, useCallback } from 'react'
import api from '../api/client'
import type { AiModelPricing, PricingFetchResult } from '../api/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  KeyRound,
  Coins,
  RefreshCw,
  CheckCircle2,
  Save,
  X,
  AlertTriangle,
  GripVertical,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProviderDef {
  id: string
  name: string
  capabilities: string[]
  hasKey: boolean
}

interface ModelInfo {
  id: string
  displayName: string
  description: string
  tags: string[]
  capabilities: string[]
}

interface ChainEntry {
  id?: number
  capability: string
  priority: number
  provider: string
  modelId: string
  isEnabled: boolean
}

type Capability = 'STT' | 'LLM' | 'TTS'

const CAPABILITIES: { id: Capability; icon: string; label: string; desc: string }[] = [
  { id: 'STT', icon: '🎙️', label: 'STT — Transcrição de Voz', desc: 'Converte áudio do chamador em texto' },
  { id: 'LLM', icon: '🧠', label: 'LLM — Raciocínio e Resposta', desc: 'Processa o texto e gera a resposta contextual' },
  { id: 'TTS', icon: '🔊', label: 'TTS — Síntese de Voz', desc: 'Converte a resposta em áudio de alta fidelidade' },
]

const TAG_LABELS: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'outline' }> = {
  speed: { label: '⚡ Rápido', variant: 'success' },
  deep: { label: '🔍 Raciocínio Profundo', variant: 'info' },
  voice: { label: '🎤 Voz Expressiva', variant: 'info' },
  cost: { label: '💰 Econômico', variant: 'warning' },
  priv: { label: '🔒 Privado/Local', variant: 'outline' },
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface AISettingsPanelProps {
  open: boolean
  onToggle: () => void
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({ open, onToggle }) => {
  const [providers, setProviders] = useState<ProviderDef[]>([])
  const [chains, setChains] = useState<Record<Capability, ChainEntry[]>>({ STT: [], LLM: [], TTS: [] })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCap, setModalCap] = useState<Capability>('LLM')
  const [selProvider, setSelProvider] = useState<ProviderDef | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [selModel, setSelModel] = useState<ModelInfo | null>(null)

  // Key editing
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  // Preço de modelos (Custos IA)
  const [pricing, setPricing] = useState<AiModelPricing[]>([])
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [priceInInput, setPriceInInput] = useState('')
  const [priceOutInput, setPriceOutInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState<PricingFetchResult[] | null>(null)

  // ── Carregar ────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      const [provRes, chainRes, pricingRes] = await Promise.all([
        api.get<ProviderDef[]>('/ai/providers'),
        api.get<ChainEntry[]>('/ai/chain'),
        api.get<AiModelPricing[]>('/ai/model-pricing'),
      ])
      setProviders(provRes.data)
      const grouped: Record<Capability, ChainEntry[]> = { STT: [], LLM: [], TTS: [] }
      chainRes.data.forEach((e) => {
        const cap = e.capability as Capability
        if (grouped[cap]) grouped[cap].push(e)
      })
      setChains(grouped)
      setPricing(pricingRes.data)
    } catch {
      showToast('Erro ao carregar configuração de IA', 'error')
    }
  }, [])

  useEffect(() => {
    if (open) loadAll()
  }, [open, loadAll])

  // ── Salvar chains ───────────────────────────────────────────────────────────

  const saveChains = async () => {
    setSaving(true)
    try {
      await Promise.all(
        (['STT', 'LLM', 'TTS'] as Capability[]).map((cap) =>
          api.put(`/ai/chain/${cap}`, chains[cap].map((e) => ({ provider: e.provider, modelId: e.modelId })))
        )
      )
      showToast('Chains salvas com sucesso · ai-agent aplicará na próxima chamada', 'success')
    } catch {
      showToast('Erro ao salvar chains de IA', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── API Key ─────────────────────────────────────────────────────────────────

  const saveKey = async (providerId: string) => {
    if (!keyInput.trim()) return
    setSavingKey(true)
    try {
      await api.put(`/ai/providers/${providerId}/key`, { apiKey: keyInput.trim() })
      setEditingKey(null)
      setKeyInput('')
      await loadAll()
      showToast('Chave salva com sucesso · modelos desbloqueados', 'success')
    } catch {
      showToast('Erro ao salvar chave de API', 'error')
    } finally {
      setSavingKey(false)
    }
  }

  // ── Preço de modelos ────────────────────────────────────────────────────────

  const startEditPrice = (p: AiModelPricing) => {
    setEditingPrice(p.modelId)
    setPriceInInput(String(p.pricePerMillionInputUsd))
    setPriceOutInput(String(p.pricePerMillionOutputUsd))
  }

  const savePrice = async (modelId: string) => {
    const input = Number(priceInInput)
    const output = Number(priceOutInput)
    if (!Number.isFinite(input) || input < 0 || !Number.isFinite(output) || output < 0) {
      showToast('Preço inválido — use um número maior ou igual a zero', 'error')
      return
    }
    setSavingPrice(true)
    try {
      await api.put(`/ai/model-pricing/${modelId}`, {
        pricePerMillionInputUsd: input,
        pricePerMillionOutputUsd: output,
      })
      setEditingPrice(null)
      await loadAll()
      showToast('Preço atualizado manualmente', 'success')
    } catch {
      showToast('Erro ao salvar preço', 'error')
    } finally {
      setSavingPrice(false)
    }
  }

  const syncPricesNow = async () => {
    setSyncing(true)
    setSyncResults(null)
    try {
      const res = await api.post<PricingFetchResult[]>('/ai/model-pricing/sync-now', {})
      setSyncResults(res.data)
      await loadAll()
      const failures = res.data.filter((r) => !r.success).length
      if (failures > 0) {
        showToast(`Busca concluída com ${failures} falha(s) — preço anterior mantido`, 'error')
      } else {
        showToast('Preços atualizados com sucesso', 'success')
      }
    } catch {
      showToast('Erro ao sincronizar preços de IA', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // ── Modal ───────────────────────────────────────────────────────────────────

  const openAddModal = (cap: Capability) => {
    setModalCap(cap)
    setSelProvider(null)
    setSelModel(null)
    setModels([])
    setModalOpen(true)
  }

  const selectProvider = async (prov: ProviderDef) => {
    setSelProvider(prov)
    setSelModel(null)
    setModels([])
    setModelsLoading(true)
    try {
      const res = await api.get<ModelInfo[]>(`/ai/providers/${prov.id}/models?cap=${modalCap}`)
      setModels(res.data)
      if (res.data.length > 0) setSelModel(res.data[0])
    } catch {
      setModels([])
    } finally {
      setModelsLoading(false)
    }
  }

  const confirmAdd = () => {
    if (!selProvider || !selModel) return
    const current = chains[modalCap]
    setChains((prev) => ({
      ...prev,
      [modalCap]: [
        ...prev[modalCap],
        {
          capability: modalCap,
          priority: current.length + 1,
          provider: selProvider.id,
          modelId: selModel.id,
          isEnabled: true,
        },
      ],
    }))
    setModalOpen(false)
  }

  const removeEntry = (cap: Capability, idx: number) => {
    setChains((prev) => ({
      ...prev,
      [cap]: prev[cap].filter((_, i) => i !== idx).map((e, i) => ({ ...e, priority: i + 1 })),
    }))
  }

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? id

  return (
    <>
      <Card className="border-border/70 shadow-xs overflow-hidden transition-all duration-200">
        {/* Cabeçalho */}
        <div
          onClick={onToggle}
          className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/40 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-base shadow-2xs shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground tracking-tight">Inteligência Artificial</span>
                <Badge variant="outline" className="text-[10px] py-0 h-4 font-mono text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/5">
                  ai-agent
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Provedores e modelos para STT, LLM e TTS com fallback automático em cascata
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
            )}
          </div>
        </div>

        {open && (
          <CardContent className="p-5 pt-0 border-t border-border/50 bg-card/40 space-y-6">
            {/* ── Capability Chains ── */}
            <div className="space-y-6 pt-3">
              {CAPABILITIES.map((cap) => {
                const entries = chains[cap.id] ?? []
                return (
                  <div key={cap.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cap.icon}</span>
                      <span className="font-semibold text-xs text-foreground">{cap.label}</span>
                      <span className="text-xs text-muted-foreground">— {cap.desc}</span>
                    </div>

                    {/* Entradas da chain */}
                    <div className="space-y-2">
                      {entries.length === 0 ? (
                        <div className="p-3.5 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground bg-muted/20">
                          Nenhum provedor configurado para esta cadeia
                        </div>
                      ) : (
                        entries.map((entry, idx) => (
                          <div
                            key={`${entry.provider}-${entry.modelId}`}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              idx === 0
                                ? 'bg-primary/5 border-primary/25 shadow-2xs'
                                : 'bg-card border-border/70 hover:border-border'
                            }`}
                          >
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab" />
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 px-1.5 font-bold ${
                                idx === 0 ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'
                              }`}
                            >
                              {idx + 1}
                            </Badge>

                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-foreground">
                                {providerName(entry.provider)}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground truncate">
                                {entry.modelId}
                              </div>
                            </div>

                            <Badge
                              variant={idx === 0 ? 'default' : 'secondary'}
                              className="text-[10px] py-0 h-4"
                            >
                              {idx === 0 ? 'primário' : `fallback ${idx}`}
                            </Badge>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEntry(cap.id, idx)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                              title="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAddModal(cap.id)}
                      className="w-full text-xs h-8 border-dashed hover:border-primary/50 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar Provedor de Fallback ({cap.id})
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Salvar Chains */}
            <div className="flex justify-end pt-3 border-t border-border/50">
              <Button
                variant="default"
                size="sm"
                onClick={saveChains}
                disabled={saving}
                className="text-xs h-8 font-semibold shadow-xs"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Salvando Chains...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Salvar Chains de IA
                  </>
                )}
              </Button>
            </div>

            {/* ── API Keys ── */}
            <div className="space-y-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="font-semibold text-xs text-foreground">Chaves de API dos Provedores</span>
                <span className="text-xs text-muted-foreground">— necessária para descoberta de modelos</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {providers.map((prov) => (
                  <div
                    key={prov.id}
                    className="p-3 rounded-xl bg-card border border-border/70 flex flex-col gap-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">{prov.name}</span>
                      {prov.id === 'local' ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                          ✓ Local
                        </Badge>
                      ) : prov.hasKey ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                          ✓ Configurada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                          Sem chave
                        </Badge>
                      )}
                    </div>

                    {prov.id !== 'local' && (
                      editingKey === prov.id ? (
                        <div className="flex gap-1.5 pt-1">
                          <Input
                            type="password"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            placeholder="Cole a API key aqui..."
                            className="h-8 text-xs font-mono flex-1"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveKey(prov.id)}
                          />
                          <Button
                            size="sm"
                            onClick={() => saveKey(prov.id)}
                            disabled={savingKey}
                            className="h-8 text-xs px-2.5"
                          >
                            {savingKey ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Salvar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingKey(null); setKeyInput('') }}
                            className="h-8 text-xs px-2"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingKey(prov.id); setKeyInput('') }}
                            className="h-7 text-xs px-2.5"
                          >
                            {prov.hasKey ? 'Alterar Chave' : 'Configurar Chave'}
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Preço de Modelos ── */}
            <div className="space-y-3 pt-3 border-t border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-xs text-foreground">Tabela de Preços por Token (Custos IA)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Utilizado para precificar e monitorar chamadas em tempo real. Atualização diária automatizada.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={syncPricesNow}
                  disabled={syncing}
                  className="text-xs h-8 shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Atualizando...' : 'Atualizar Preços'}
                </Button>
              </div>

              <div className="divide-y divide-border/50 rounded-xl border border-border/70 overflow-hidden bg-card">
                {pricing.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhum modelo precificado cadastrado
                  </div>
                ) : (
                  pricing.map((p) => (
                    <div key={p.modelId} className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="min-w-[200px]">
                        <span className="font-mono font-medium text-foreground text-[11px]">{p.modelId}</span>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <Badge variant="outline" className="text-[9px] py-0 h-3.5">
                            {p.updatedBy === 'auto-fetch' ? '🤖 Automático' : `✍️ ${p.updatedBy ?? 'Manual'}`}
                          </Badge>
                          {p.updatedAt && (
                            <span>{new Date(p.updatedAt).toLocaleString('pt-BR')}</span>
                          )}
                        </div>
                      </div>

                      {editingPrice === p.modelId ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">In ($/1M):</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={priceInInput}
                              onChange={(e) => setPriceInInput(e.target.value)}
                              className="h-7 w-20 text-xs font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">Out ($/1M):</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={priceOutInput}
                              onChange={(e) => setPriceOutInput(e.target.value)}
                              className="h-7 w-20 text-xs font-mono"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => savePrice(p.modelId)}
                            disabled={savingPrice}
                            className="h-7 text-xs px-2"
                          >
                            {savingPrice ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'OK'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingPrice(null)}
                            className="h-7 text-xs px-2"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="font-mono text-xs">
                            In: <strong>${p.pricePerMillionInputUsd.toFixed(2)}</strong> / Out: <strong>${p.pricePerMillionOutputUsd.toFixed(2)}</strong>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditPrice(p)}
                            className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                          >
                            Editar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {syncResults && syncResults.some((r) => !r.success) && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {syncResults.filter((r) => !r.success).map((r) => `${r.modelId}: ${r.failureReason}`).join(' • ')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Modal: Selecionar Provedor + Modelo ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-border/70 bg-card/60">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Adicionar Provedor à Chain ({modalCap})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Passo 1 */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  1. Escolha o Provedor
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {providers
                    .filter((p) => p.capabilities.includes(modalCap))
                    .map((prov) => {
                      const disabled = !prov.hasKey && prov.id !== 'local'
                      const selected = selProvider?.id === prov.id
                      return (
                        <div
                          key={prov.id}
                          onClick={() => !disabled && selectProvider(prov)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            disabled
                              ? 'opacity-40 cursor-not-allowed border-border bg-muted/20'
                              : selected
                              ? 'border-primary bg-primary/5 shadow-2xs cursor-pointer'
                              : 'border-border/70 hover:border-primary/40 bg-card cursor-pointer'
                          }`}
                        >
                          <div className="font-semibold text-xs text-foreground">{prov.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {prov.capabilities.join(' • ')}
                          </div>
                          <div className="mt-2">
                            {prov.id === 'local' ? (
                              <Badge variant="outline" className="text-[9px] py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                ✓ Local
                              </Badge>
                            ) : prov.hasKey ? (
                              <Badge variant="outline" className="text-[9px] py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                ✓ Configurado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] py-0 bg-muted text-muted-foreground">
                                Sem chave
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Passo 2 */}
              {(selProvider || modelsLoading) && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                    2. Selecione o Modelo ({selProvider?.name})
                  </label>
                  <div className="border border-border/70 rounded-xl overflow-hidden divide-y divide-border/50 max-h-56 overflow-y-auto bg-card">
                    {modelsLoading ? (
                      <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                        Carregando modelos suportados...
                      </div>
                    ) : models.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Nenhum modelo retornado para {modalCap}
                      </div>
                    ) : (
                      models.map((model) => {
                        const isSelected = selModel?.id === model.id
                        return (
                          <div
                            key={model.id}
                            onClick={() => setSelModel(model)}
                            className={`p-3 cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/10' : 'hover:bg-muted/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs text-foreground">
                                {model.displayName || model.id}
                              </span>
                              <div className="flex gap-1">
                                {model.tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant={TAG_LABELS[tag]?.variant ?? 'secondary'}
                                    className="text-[9px] py-0 h-4"
                                  >
                                    {TAG_LABELS[tag]?.label ?? tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {model.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                {model.description}
                              </p>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-3.5 bg-muted/30 border-t border-border/70">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={confirmAdd}
                disabled={!selProvider || !selModel}
                className="text-xs h-8 font-semibold"
              >
                Adicionar à Chain
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl flex items-center gap-2 text-white ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </>
  )
}
export default AISettingsPanel
