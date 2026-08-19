import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useAuthSession } from '../hooks/useAuthSession'
import type { Operadora } from '../api/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Plus, Search, X } from 'lucide-react'

interface OperadoraPayload {
  nome: string
  isActive: boolean
}

const EMPTY_FORM: OperadoraPayload = { nome: '', isActive: true }

export default function Operadoras() {
  const { hasWrite: sessionHasWrite } = useAuthSession()
  const hasWrite = sessionHasWrite('telecom.operadoras')

  const [items, setItems] = useState<Operadora[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<OperadoraPayload>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .get<Operadora[]>('/operadoras')
      .then((r) => setItems(r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  const openEdit = (item: Operadora) => {
    setEditId(item.id)
    setForm({ nome: item.nome, isActive: item.isActive })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await api.put(`/operadoras/${editId}`, form)
      } else {
        await api.post('/operadoras', form)
      }
      setShowModal(false)
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: Operadora) => {
    try {
      await api.put(`/operadoras/${item.id}`, { nome: item.nome, isActive: !item.isActive })
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao alterar status.'))
    }
  }

  const remove = async (item: Operadora) => {
    if (!confirm(`Remover a operadora "${item.nome}"? Esta ação não pode ser desfeita.`)) return
    try {
      await api.delete(`/operadoras/${item.id}`)
      load()
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao remover — verifique se ela não está em uso por algum número 0800 ou linha.'))
    }
  }

  const filteredItems = items.filter((i) => i.nome.toLowerCase().includes(search.toLowerCase()))
  const activeCount = items.filter((i) => i.isActive).length

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Operadoras de Telecom
          </h1>
          <p className="text-xs text-muted-foreground">
            Cadastro de provedores de telefonia para roteamento SIP e entroncamentos
          </p>
        </div>
        {hasWrite && (
          <Button onClick={openCreate} className="font-semibold shadow-xs">
            <Plus className="h-4 w-4 mr-1" />
            Nova Operadora
          </Button>
        )}
      </div>

      {/* ── Quick Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Operadoras Ativas
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total de Operadoras
              </span>
              <div className="text-2xl font-bold text-foreground">{items.length}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar operadora por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 border border-border/70 rounded-lg bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <span className="text-xs text-muted-foreground self-end sm:self-center font-medium">
          Exibindo {filteredItems.length} de {items.length} operadoras
        </span>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Carregando operadoras...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-3 px-4 w-20">#</th>
                  <th className="py-3 px-4">Nome da Operadora</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  {hasWrite && <th className="py-3 px-4 w-36 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={hasWrite ? 4 : 3} className="py-10 text-center text-muted-foreground">
                      Nenhuma operadora encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground">{item.id}</td>
                      <td className="py-3 px-4 font-semibold text-foreground">{item.nome}</td>
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

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  {editId ? 'Editar Operadora' : 'Nova Operadora'}
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
              <div className="space-y-1">
                <Label>Nome da Operadora *</Label>
                <Input
                  autoFocus
                  placeholder="ex: Vivo, Claro, Embratel, Algar..."
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
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
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || !form.nome.trim()} className="font-semibold">
                {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Operadora'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
