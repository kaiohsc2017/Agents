import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useAuthSession } from '../hooks/useAuthSession'
import type { BusinessUnit, Linha, Operadora, Operation } from '../api/types'
import ImportModal, { triggerDownload } from './shared/ImportModal'
import LinhasModal, { EMPTY_LINHA_FORM, type LinhaPayload } from './LinhasModal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, Plus, Search, Download, Upload } from 'lucide-react'

const EMPTY_FORM: LinhaPayload = EMPTY_LINHA_FORM

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
        <LinhasModal
          editId={editId}
          form={form}
          setForm={setForm}
          selectedBuIds={selectedBuIds}
          setSelectedBuIds={setSelectedBuIds}
          buOptions={buOptions}
          operationOptions={operationOptions}
          operadoraSelectOptions={operadoraSelectOptions}
          saving={saving}
          onSave={save}
          onClose={() => setShowModal(false)}
        />
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
