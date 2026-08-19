import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useAuthSession } from '../hooks/useAuthSession'
import type { BusinessUnit, Client, Numero0800, Operadora } from '../api/types'
import ImportModal, { triggerDownload } from './shared/ImportModal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneForwarded, Plus, Search, Download, Upload, X, Trash2 } from 'lucide-react'

const MAX_REGENERADOS = 5

interface RegeneradoForm {
  id?: number
  ordem: number
  numeroRegenerado: string
  vdn: string
  vetor: string
  operadoraId: number | null
}

interface Numero0800Payload {
  operadora: { id: number } | null
  numero: string
  client: { id: number } | null
  observacao: string
  isActive: boolean
  regenerados: Array<{
    id?: number
    ordem: number
    numeroRegenerado: string
    vdn: string
    vetor: string
    operadora: { id: number } | null
  }>
}

const EMPTY_REGENERADO = (ordem: number): RegeneradoForm => ({
  ordem,
  numeroRegenerado: '',
  vdn: '',
  vetor: '',
  operadoraId: null,
})

const EMPTY_FORM = {
  operadora: null as { id: number } | null,
  numero: '',
  client: null as { id: number } | null,
  observacao: '',
  isActive: true,
  regenerados: [] as RegeneradoForm[],
}

function MultiSelectChecklist({
  options,
  selectedIds,
  onChange,
  emptyMessage,
}: {
  options: BusinessUnit[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  emptyMessage: string
}) {
  const toggle = (id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id])
  }

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-border/60 rounded-lg bg-muted/20 max-h-36 overflow-y-auto">
      {options.map((opt) => {
        const selected = selectedIds.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              selected
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-background text-muted-foreground border border-border/80 hover:text-foreground'
            }`}
          >
            {opt.name}
          </button>
        )
      })}
    </div>
  )
}

function RegeneradoCard({
  index,
  value,
  operadoraOptions,
  onChangeText,
  onChangeOperadora,
  onRemove,
}: {
  index: number
  value: RegeneradoForm
  operadoraOptions: Operadora[]
  onChangeText: (field: 'numeroRegenerado' | 'vdn' | 'vetor', val: string) => void
  onChangeOperadora: (operadoraId: number | null) => void
  onRemove: () => void
}) {
  return (
    <div className="border border-border/70 rounded-xl p-3.5 bg-muted/20 space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] py-0">
            #{index + 1}
          </Badge>
          Regenerado {index + 1}
        </span>
        <Button variant="ghost" size="xs" onClick={onRemove} className="text-destructive hover:text-destructive h-7">
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Remover
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Número Regenerado</Label>
          <Input
            value={value.numeroRegenerado}
            onChange={(e) => onChangeText('numeroRegenerado', e.target.value)}
            placeholder="ex: 0800 ou número fixo"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Operadora</Label>
          <select
            className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={value.operadoraId ?? 0}
            onChange={(e) => {
              const id = +e.target.value
              onChangeOperadora(id ? id : null)
            }}
          >
            <option value={0}>Selecione...</option>
            {operadoraOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px]">VDN</Label>
          <Input value={value.vdn} onChange={(e) => onChangeText('vdn', e.target.value)} placeholder="ex: 5500" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Vetor</Label>
          <Input value={value.vetor} onChange={(e) => onChangeText('vetor', e.target.value)} placeholder="ex: 12" />
        </div>
      </div>
    </div>
  )
}

export default function Cadastro0800() {
  const { hasWrite: sessionHasWrite } = useAuthSession()
  const hasWrite = sessionHasWrite('telecom.0800')

  const [items, setItems] = useState<Numero0800[]>([])
  const [operadoraOptions, setOperadoraOptions] = useState<Operadora[]>([])
  const [clientOptions, setClientOptions] = useState<Client[]>([])
  const [buOptions, setBuOptions] = useState<BusinessUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBu, setFilterBu] = useState('')
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formBus, setFormBus] = useState<number[]>([])
  const [operadoraFallbacks, setOperadoraFallbacks] = useState<Operadora[]>([])
  const [saving, setSaving] = useState(false)

  const toRegeneradoForm = (item: Numero0800): RegeneradoForm[] =>
    [...(item.regenerados ?? [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((r, i) => ({
        id: r.id,
        ordem: r.ordem ?? i + 1,
        numeroRegenerado: r.numeroRegenerado ?? '',
        vdn: r.vdn ?? '',
        vetor: r.vetor ?? '',
        operadoraId: r.operadora?.id ?? null,
      }))

  const buildRegeneradosPayload = (list: RegeneradoForm[]) =>
    list.map((r, i) => ({
      id: r.id,
      ordem: i + 1,
      numeroRegenerado: r.numeroRegenerado,
      vdn: r.vdn,
      vetor: r.vetor,
      operadora: r.operadoraId ? { id: r.operadoraId } : null,
    }))

  const load = () => {
    setLoading(true)
    api
      .get<Numero0800[]>('/numeros-0800')
      .then((r) => setItems(r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.get<Operadora[]>('/operadoras?activeOnly=true').then((r) => setOperadoraOptions(r.data ?? []))
    api.get<Client[]>('/clients?activeOnly=true').then((r) => setClientOptions(r.data ?? []))
    api.get<BusinessUnit[]>('/business-units?activeOnly=true').then((r) => setBuOptions(r.data ?? []))
  }, [])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...EMPTY_FORM, regenerados: [] })
    setFormBus([])
    setOperadoraFallbacks([])
    setShowModal(true)
  }

  const openEdit = (item: Numero0800) => {
    setEditId(item.id)
    setForm({
      operadora: item.operadora ? { id: item.operadora.id } : null,
      numero: item.numero,
      client: item.client ? { id: item.client.id } : null,
      observacao: item.observacao ?? '',
      isActive: item.isActive,
      regenerados: toRegeneradoForm(item),
    })
    setFormBus(item.businessUnits?.map((b) => b.id) ?? [])
    setShowModal(true)
  }

  const save = async () => {
    if (!form.numero.trim()) return
    setSaving(true)
    const payload: Numero0800Payload = {
      operadora: form.operadora?.id ? { id: form.operadora.id } : null,
      numero: form.numero,
      client: form.client?.id ? { id: form.client.id } : null,
      observacao: form.observacao,
      isActive: form.isActive,
      regenerados: buildRegeneradosPayload(form.regenerados),
    }
    try {
      let id = editId
      if (id) {
        await api.put(`/numeros-0800/${id}`, payload)
      } else {
        const res = await api.post<Numero0800>('/numeros-0800', payload)
        id = res.data.id
      }
      await api.put(`/numeros-0800/${id}/business-units`, formBus)
      setShowModal(false)
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: Numero0800) => {
    try {
      await api.put(`/numeros-0800/${item.id}`, {
        operadora: item.operadora ? { id: item.operadora.id } : null,
        numero: item.numero,
        client: item.client ? { id: item.client.id } : null,
        observacao: item.observacao ?? '',
        isActive: !item.isActive,
        regenerados: buildRegeneradosPayload(toRegeneradoForm(item)),
      })
      await api.put(`/numeros-0800/${item.id}/business-units`, item.businessUnits?.map((bu) => bu.id) ?? [])
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao alterar status.'))
    }
  }

  const remove = async (item: Numero0800) => {
    if (!confirm(`Remover o número 0800 "${item.numero}"? Esta ação não pode ser desfeita.`)) return
    try {
      await api.delete(`/numeros-0800/${item.id}`)
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao remover.'))
    }
  }

  const handleExport = async () => {
    try {
      const res = await api.get('/numeros-0800/export', { responseType: 'blob' })
      triggerDownload(res.data, `numeros-0800_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      alert('Erro ao exportar.')
    }
  }

  const filteredItems = items
    .filter((item) => (!filterBu ? true : item.businessUnits?.some((bu) => String(bu.id) === filterBu)))
    .filter(
      (item) =>
        item.numero.toLowerCase().includes(search.toLowerCase()) ||
        (item.operadora?.nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (item.client?.name ?? '').toLowerCase().includes(search.toLowerCase())
    )

  const activeCount = filteredItems.filter((i) => i.isActive).length

  const operadoraSelectOptions = [
    ...operadoraOptions,
    ...operadoraFallbacks.filter((f) => !operadoraOptions.some((o) => o.id === f.id)),
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <PhoneForwarded className="h-5 w-5 text-primary" />
            Números 0800 & Regenerados
          </h1>
          <p className="text-xs text-muted-foreground">
            Central de números de discagem gratuita, roteamentos VDN e vetores Avaya CMS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="font-semibold">
            <Download className="h-3.5 w-3.5 mr-1" />
            Exportar
          </Button>
          {hasWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="font-semibold"
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Importar
            </Button>
          )}
          {hasWrite && (
            <Button onClick={openCreate} className="font-semibold shadow-xs">
              <Plus className="h-4 w-4 mr-1" />
              Novo 0800
            </Button>
          )}
        </div>
      </div>

      {/* ── Quick Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                0800 Ativos
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <PhoneForwarded className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Cadastrado
              </span>
              <div className="text-2xl font-bold text-foreground">{items.length}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <PhoneForwarded className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Regenerações
              </span>
              <div className="text-xs text-muted-foreground leading-snug">
                Até <strong className="text-foreground">5 níveis</strong> de transbordo VDN/Vetor por número.
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <PhoneForwarded className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por 0800, operadora ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 border border-border/70 rounded-lg bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <select
            className="h-9 rounded-lg border border-border/70 bg-card px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={filterBu}
            onChange={(e) => setFilterBu(e.target.value)}
          >
            <option value="">Todas as BUs</option>
            {buOptions.map((bu) => (
              <option key={bu.id} value={String(bu.id)}>
                {bu.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-muted-foreground self-end sm:self-center font-medium">
          Exibindo {filteredItems.length} de {items.length} números
        </span>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Carregando números 0800...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-3 px-4 w-16">#</th>
                  <th className="py-3 px-4">Operadora</th>
                  <th className="py-3 px-4">Número 0800</th>
                  <th className="py-3 px-4">Cliente Vinculado</th>
                  <th className="py-3 px-4">Unidades (BU)</th>
                  <th className="py-3 px-4 text-center">Regenerados</th>
                  <th className="py-3 px-4">Status</th>
                  {hasWrite && <th className="py-3 px-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={hasWrite ? 8 : 7} className="py-10 text-center text-muted-foreground">
                      Nenhum número 0800 encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground">{item.id}</td>
                      <td className="py-3 px-4 font-medium text-foreground">{item.operadora?.nome ?? '—'}</td>
                      <td className="py-3 px-4 font-bold font-mono text-foreground">{item.numero}</td>
                      <td className="py-3 px-4 text-muted-foreground">{item.client?.name ?? '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                        {(item.businessUnits ?? []).length === 0
                          ? '—'
                          : (item.businessUnits ?? []).map((b) => b.name).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={item.regenerados.length > 0 ? 'info' : 'outline'}
                          className="text-[10px] py-0"
                        >
                          {item.regenerados.length}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={item.isActive ? 'success' : 'destructive'} className="text-[10px] py-0">
                          {item.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      {hasWrite && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(item)}
                              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                            >
                              Editar
                            </button>
                            <span className="text-border">·</span>
                            <button
                              onClick={() => toggleActive(item)}
                              className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                            >
                              {item.isActive ? 'Pausar' : 'Ativar'}
                            </button>
                            <span className="text-border">·</span>
                            <button
                              onClick={() => remove(item)}
                              className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar / Editar 0800 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <PhoneForwarded className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  {editId ? 'Editar Número 0800' : 'Novo Número 0800'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Operadora Principal *</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.operadora?.id ?? 0}
                    onChange={(e) => {
                      const id = +e.target.value
                      setForm((f) => ({ ...f, operadora: id ? { id } : null }))
                    }}
                  >
                    <option value={0}>Selecione...</option>
                    {operadoraSelectOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Número 0800 *</Label>
                  <Input
                    placeholder="ex: 0800 123 4567"
                    value={form.numero}
                    onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cliente Vinculado</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.client?.id ?? 0}
                    onChange={(e) => {
                      const id = +e.target.value
                      setForm((f) => ({ ...f, client: id ? { id } : null }))
                    }}
                  >
                    <option value={0}>Nenhum / Geral</option>
                    {clientOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Status</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.isActive ? 'true' : 'false'}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === 'true' }))}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Observação</Label>
                <Input
                  placeholder="Notas adicionais sobre o contrato ou roteamento"
                  value={form.observacao}
                  onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Unidades de Negócio (BU)</Label>
                <MultiSelectChecklist
                  options={buOptions}
                  selectedIds={formBus}
                  onChange={setFormBus}
                  emptyMessage="Nenhuma BU disponível."
                />
              </div>

              {/* Regenerados Section */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Grupos de Regeneração (Avaya VDN/Vetor)</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Configure transbordos automáticos para este 0800 (máximo {MAX_REGENERADOS})
                    </p>
                  </div>
                  {form.regenerados.length < MAX_REGENERADOS && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          regenerados: [...f.regenerados, EMPTY_REGENERADO(f.regenerados.length + 1)],
                        }))
                      }
                      className="text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar Regenerado
                    </Button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {form.regenerados.map((reg, idx) => (
                    <RegeneradoCard
                      key={idx}
                      index={idx}
                      value={reg}
                      operadoraOptions={operadoraOptions}
                      onChangeText={(field, val) =>
                        setForm((f) => ({
                          ...f,
                          regenerados: f.regenerados.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
                        }))
                      }
                      onChangeOperadora={(opId) =>
                        setForm((f) => ({
                          ...f,
                          regenerados: f.regenerados.map((r, i) => (i === idx ? { ...r, operadoraId: opId } : r)),
                        }))
                      }
                      onRemove={() =>
                        setForm((f) => ({
                          ...f,
                          regenerados: f.regenerados.filter((_, i) => i !== idx),
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || !form.numero.trim()} className="font-semibold">
                {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Número 0800'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação */}
      {showImportModal && (
        <ImportModal
          title="Importar Números 0800"
          importUrl="/numeros-0800/import"
          templateUrl="/numeros-0800/import/template"
          templateFilename="template_numeros_0800.xlsx"
          instructions={[
            'Utilize a planilha modelo como base para preenchimento.',
            'Os campos Número 0800 e Destino são obrigatórios.',
            'Números já existentes terão seus dados atualizados.',
          ]}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false)
            load()
          }}
        />
      )}
    </div>
  )
}
