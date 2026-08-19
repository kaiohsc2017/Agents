import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useAuthSession } from '../hooks/useAuthSession'
import type { BusinessUnit, Linha, Operadora, Operation } from '../api/types'
import ImportModal, { triggerDownload } from './shared/ImportModal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Phone, Plus, Search, Download, Upload, X } from 'lucide-react'

interface LinhaPayload {
  operadora: { id: number } | null
  operation: { id: number } | null
  chave: string
  ipOperadora: string
  ipAutoglass: string
  observacao: string
  isActive: boolean
}

const EMPTY_FORM: LinhaPayload = {
  operadora: null,
  operation: null,
  chave: '',
  ipOperadora: '',
  ipAutoglass: '',
  observacao: '',
  isActive: true,
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

export default function Linhas() {
  const { hasWrite: sessionHasWrite } = useAuthSession()
  const hasWrite = sessionHasWrite('telecom.linhas')

  const [items, setItems] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [buOptions, setBuOptions] = useState<BusinessUnit[]>([])
  const [operationOptions, setOperationOptions] = useState<Operation[]>([])
  const [operadoraOptions, setOperadoraOptions] = useState<Operadora[]>([])
  const [filterBu, setFilterBu] = useState('')
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<LinhaPayload>({ ...EMPTY_FORM })
  const [selectedBuIds, setSelectedBuIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false)
  const [operadoraFallback, setOperadoraFallback] = useState<Operadora | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .get<Linha[]>('/linhas')
      .then((r) => setItems(r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    Promise.all([
      api.get<BusinessUnit[]>('/business-units?active=true'),
      api.get<Operation[]>('/operations?active=true'),
      api.get<Operadora[]>('/operadoras?active=true'),
    ])
      .then(([b, o, op]) => {
        setBuOptions(b.data ?? [])
        setOperationOptions(o.data ?? [])
        setOperadoraOptions(op.data ?? [])
      })
      .catch((err) => console.error('Erro ao carregar dados mestres para Linhas:', err))
  }, [])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...EMPTY_FORM })
    setSelectedBuIds([])
    setOperadoraFallback(null)
    setShowModal(true)
  }

  const openEdit = (item: Linha) => {
    setEditId(item.id)
    setForm({
      operadora: item.operadora ? { id: item.operadora.id } : null,
      operation: item.operation ? { id: item.operation.id } : null,
      chave: item.chave ?? '',
      ipOperadora: item.ipOperadora ?? '',
      ipAutoglass: item.ipAutoglass ?? '',
      observacao: item.observacao ?? '',
      isActive: item.isActive,
    })
    setSelectedBuIds(item.businessUnits?.map((b) => b.id) ?? [])
    if (item.operadora && !operadoraOptions.some((o) => o.id === item.operadora.id)) {
      setOperadoraFallback({ id: item.operadora.id, nome: item.operadora.nome ?? `ID ${item.operadora.id}`, isActive: false })
    } else {
      setOperadoraFallback(null)
    }
    setShowModal(true)
  }

  const save = async () => {
    if (!form.operadora) return
    setSaving(true)
    try {
      let id = editId
      if (id) {
        await api.put(`/linhas/${id}`, form)
      } else {
        const res = await api.post<Linha>('/linhas', form)
        id = res.data.id
      }
      await api.put(`/linhas/${id}/business-units`, selectedBuIds)
      setShowModal(false)
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: Linha) => {
    try {
      await api.put(`/linhas/${item.id}`, {
        operadora: item.operadora ? { id: item.operadora.id } : null,
        operation: item.operation ? { id: item.operation.id } : null,
        chave: item.chave ?? '',
        ipOperadora: item.ipOperadora ?? '',
        ipAutoglass: item.ipAutoglass ?? '',
        observacao: item.observacao ?? '',
        isActive: !item.isActive,
      })
      await api.put(`/linhas/${item.id}/business-units`, item.businessUnits?.map((bu) => bu.id) ?? [])
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao alterar status.'))
    }
  }

  const remove = async (item: Linha) => {
    if (!confirm(`Remover a linha com chave "${item.chave || item.id}"? Esta ação não pode ser desfeita.`)) return
    try {
      await api.delete(`/linhas/${item.id}`)
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao remover.'))
    }
  }

  const handleExport = async () => {
    try {
      const res = await api.get('/linhas/export', { responseType: 'blob' })
      triggerDownload(res.data, `linhas_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      alert('Erro ao exportar.')
    }
  }

  const filteredItems = items
    .filter((item) => (!filterBu ? true : item.businessUnits?.some((bu) => String(bu.id) === filterBu)))
    .filter(
      (item) =>
        (item.chave ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (item.operadora?.nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (item.ipOperadora ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (item.operation?.name ?? '').toLowerCase().includes(search.toLowerCase())
    )

  const activeCount = filteredItems.filter((i) => i.isActive).length

  const operadoraSelectOptions = [
    ...operadoraOptions,
    ...(operadoraFallback && !operadoraOptions.some((o) => o.id === operadoraFallback.id) ? [operadoraFallback] : []),
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Linhas & Troncos SIP
          </h1>
          <p className="text-xs text-muted-foreground">
            Entroncamentos e endereços IP de roteamento entre operadoras e central telefônica
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
              Nova Linha
            </Button>
          )}
        </div>
      </div>

      {/* ── Quick Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Linhas Ativas
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Phone className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total de Linhas
              </span>
              <div className="text-2xl font-bold text-foreground">{items.length}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Phone className="h-5 w-5" />
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
              placeholder="Buscar por chave, operadora ou IP..."
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
          Exibindo {filteredItems.length} de {items.length} linhas
        </span>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Carregando linhas telefônicas...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-3 px-4 w-16">#</th>
                  <th className="py-3 px-4">Operadora</th>
                  <th className="py-3 px-4">Operação</th>
                  <th className="py-3 px-4">Chave</th>
                  <th className="py-3 px-4">IP Operadora</th>
                  <th className="py-3 px-4">IP Autoglass</th>
                  <th className="py-3 px-4">Unidades (BU)</th>
                  <th className="py-3 px-4">Status</th>
                  {hasWrite && <th className="py-3 px-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={hasWrite ? 9 : 8} className="py-10 text-center text-muted-foreground">
                      Nenhuma linha cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground">{item.id}</td>
                      <td className="py-3 px-4 font-semibold text-foreground">{item.operadora?.nome ?? '—'}</td>
                      <td className="py-3 px-4 text-foreground">{item.operation?.name ?? '—'}</td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{item.chave || '—'}</td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{item.ipOperadora || '—'}</td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{item.ipAutoglass || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                        {(item.businessUnits ?? []).length === 0
                          ? '—'
                          : (item.businessUnits ?? []).map((b) => b.name).join(', ')}
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

      {/* Modal Criar / Editar */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{editId ? 'Editar Linha' : 'Nova Linha'}</h2>
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
                  <Label>Operadora *</Label>
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
                  <Label>Operação</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.operation?.id ?? 0}
                    onChange={(e) => {
                      const id = +e.target.value
                      setForm((f) => ({ ...f, operation: id ? { id } : null }))
                    }}
                  >
                    <option value={0}>Nenhuma / Geral</option>
                    {operationOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Chave da Linha</Label>
                <Input
                  placeholder="Identificador ou número"
                  value={form.chave}
                  onChange={(e) => setForm((f) => ({ ...f, chave: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>IP da Operadora</Label>
                  <Input
                    placeholder="ex: 200.x.x.x"
                    value={form.ipOperadora}
                    onChange={(e) => setForm((f) => ({ ...f, ipOperadora: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label>IP Local / PBX</Label>
                  <Input
                    placeholder="ex: 192.168.x.x"
                    value={form.ipAutoglass}
                    onChange={(e) => setForm((f) => ({ ...f, ipAutoglass: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Observações</Label>
                <Input
                  placeholder="Informações adicionais"
                  value={form.observacao}
                  onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                />
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

              <div className="space-y-1.5">
                <Label>Unidades de Negócio (opcional)</Label>
                <MultiSelectChecklist
                  options={buOptions}
                  selectedIds={selectedBuIds}
                  onChange={setSelectedBuIds}
                  emptyMessage="Nenhuma BU cadastrada."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || !form.operadora} className="font-semibold">
                {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Linha'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportModal
          title="Importar Linhas em Lote"
          importUrl="/linhas/import"
          templateUrl="/linhas/import-template"
          templateFilename="modelo-linhas.xlsx"
          instructions={[
            'Utilize a planilha modelo como base para preenchimento.',
            'Os campos Operadora, Tronco SIP e DDR Inicial são obrigatórios.',
            'Linhas já cadastradas serão atualizadas.',
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
