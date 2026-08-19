import { useEffect, useState } from 'react'
import api from '../api/client'
import type { AccessGroup, AccessGroupPermission, AccessGroupRequest } from '../api/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, Plus, Search, X, Lock } from 'lucide-react'

const RESOURCE_CATALOG: { key: string; label: string; system: 'Telecom' | 'Agentes' }[] = [
  { key: 'telecom.dashboard', label: 'Dashboard Operacional', system: 'Telecom' },
  { key: 'telecom.modulo2', label: 'Conectividade SIP', system: 'Telecom' },
  { key: 'telecom.modulo3', label: 'Alertas & Zabbix', system: 'Telecom' },
  { key: 'telecom.agents_link', label: 'Agentes IA (Navegação)', system: 'Telecom' },
  { key: 'telecom.0800', label: 'Números 0800', system: 'Telecom' },
  { key: 'telecom.linhas', label: 'Linhas & Troncos', system: 'Telecom' },
  { key: 'telecom.operadoras', label: 'Operadoras', system: 'Telecom' },
  { key: 'telecom.users', label: 'Gestão de Usuários', system: 'Telecom' },
  { key: 'telecom.settings', label: 'Configurações do Sistema', system: 'Telecom' },
  { key: 'telecom.logs', label: 'Logs de Auditoria', system: 'Telecom' },
  { key: 'telecom.security', label: 'Segurança & Firewall', system: 'Telecom' },
  { key: 'telecom.audit', label: 'Auditoria de Acessos', system: 'Telecom' },
  { key: 'telecom.release', label: 'Notas de Release', system: 'Telecom' },
  { key: 'agents.dashboard', label: 'Dashboard Agentes', system: 'Agentes' },
  { key: 'agents.agents', label: 'Cadastro de Agentes', system: 'Agentes' },
  { key: 'agents.servers', label: 'Servidores SSH', system: 'Agentes' },
  { key: 'agents.knowledge', label: 'Base de Conhecimento (RAG)', system: 'Agentes' },
  { key: 'agents.logs', label: 'Logs de Execução IA', system: 'Agentes' },
  { key: 'agents.reports', label: 'Alertas & Relatórios IA', system: 'Agentes' },
  { key: 'agents.secrets', label: 'Chaves e Segredos', system: 'Agentes' },
  { key: 'agents.llm', label: 'Modelos LLM & Provedores', system: 'Agentes' },
]

type PermMap = Record<string, { canRead: boolean; canWrite: boolean }>

function emptyPermMap(): PermMap {
  const map: PermMap = {}
  RESOURCE_CATALOG.forEach((r) => {
    map[r.key] = { canRead: false, canWrite: false }
  })
  return map
}

function permsToMap(perms: AccessGroupPermission[]): PermMap {
  const map = emptyPermMap()
  perms.forEach((p) => {
    map[p.resourceKey] = { canRead: p.canRead, canWrite: p.canWrite }
  })
  return map
}

function mapToPerms(map: PermMap): AccessGroupPermission[] {
  return Object.entries(map).map(([resourceKey, v]) => ({
    resourceKey,
    canRead: v.canRead,
    canWrite: v.canWrite,
  }))
}

interface FormState {
  name: string
  description: string
  perms: PermMap
}

const EMPTY_FORM: FormState = { name: '', description: '', perms: emptyPermMap() }

export default function AccessGroups() {
  const [groups, setGroups] = useState<AccessGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editGroup, setEditGroup] = useState<AccessGroup | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .get<AccessGroup[]>('/access-groups')
      .then((r) => setGroups(r.data ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setShowCreate(true)
  }

  const openEdit = (g: AccessGroup) => {
    setEditGroup(g)
    setForm({
      name: g.name,
      description: g.description ?? '',
      perms: permsToMap(g.permissions),
    })
  }

  const closeModal = () => {
    setShowCreate(false)
    setEditGroup(null)
  }

  const togglePerm = (resourceKey: string, field: 'canRead' | 'canWrite') => {
    setForm((f) => ({
      ...f,
      perms: {
        ...f.perms,
        [resourceKey]: {
          ...f.perms[resourceKey],
          [field]: !f.perms[resourceKey][field],
        },
      },
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Informe o nome do grupo.')
      return
    }
    const body: AccessGroupRequest = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      permissions: mapToPerms(form.perms),
    }
    setSaving(true)
    try {
      if (editGroup) {
        await api.put(`/access-groups/${editGroup.id}`, body)
      } else {
        await api.post('/access-groups', body)
      }
      closeModal()
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      alert(err?.response?.data?.message ?? 'Erro ao salvar grupo.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (g: AccessGroup) => {
    if (g.isSystem) {
      alert('Grupos de sistema não podem ser excluídos.')
      return
    }
    if (!confirm(`Excluir o grupo "${g.name}"? Usuários vinculados a ele precisam ser realocados antes.`)) return
    try {
      await api.delete(`/access-groups/${g.id}`)
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      alert(err?.response?.data?.message ?? 'Erro ao excluir grupo (verifique se algum usuário ainda está nele).')
    }
  }

  const countActive = (g: AccessGroup) => g.permissions.filter((p) => p.canRead || p.canWrite).length

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Grupos de Acesso (RBAC Granular)
          </h1>
          <p className="text-xs text-muted-foreground">
            Definição de privilégios de leitura e escrita por módulo para segregação de funções
          </p>
        </div>
        <Button onClick={openCreate} className="font-semibold shadow-xs">
          <Plus className="h-4 w-4 mr-1" />
          Novo Grupo
        </Button>
      </div>

      {/* ── Quick Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Grupos Configurados
              </span>
              <div className="text-2xl font-bold text-foreground">{groups.length}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Catálogo de Recursos
              </span>
              <div className="text-xs text-muted-foreground leading-snug">
                <strong className="text-foreground">{RESOURCE_CATALOG.length} menus</strong> auditados com controle
                individual de Read/Write.
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Lock className="h-5 w-5" />
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
            placeholder="Buscar por nome do grupo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 border border-border/70 rounded-lg bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <span className="text-xs text-muted-foreground self-end sm:self-center font-medium">
          Exibindo {filteredGroups.length} de {groups.length} grupos
        </span>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Carregando grupos de acesso...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Nome do Grupo</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4 w-32">Tipo</th>
                  <th className="py-3 px-4 w-40">Recursos c/ Acesso</th>
                  <th className="py-3 px-4 text-right w-32">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhum grupo de acesso encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((g) => (
                    <tr key={g.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{g.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{g.description || '—'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={g.isSystem ? 'warning' : 'outline'} className="text-[10px] py-0">
                          {g.isSystem ? '⚙ Sistema' : '✎ Customizado'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {countActive(g)} / {RESOURCE_CATALOG.length} menus
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(g)}
                            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                          >
                            Editar
                          </button>
                          {!g.isSystem && (
                            <>
                              <span className="text-border">·</span>
                              <button
                                onClick={() => handleDelete(g)}
                                className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
                              >
                                Excluir
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar / Editar */}
      {(showCreate || editGroup) && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  {editGroup ? `Editar Grupo: ${editGroup.name}` : 'Novo Grupo de Acesso'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <Label>Nome do Grupo *</Label>
                <Input
                  autoFocus
                  placeholder="ex: Operação Suporte N1"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={!!editGroup?.isSystem}
                />
              </div>

              <div className="space-y-1">
                <Label>Descrição</Label>
                <Input
                  placeholder="ex: Acesso operacional com restrição de configurações"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Permissões Detalhadas por Recurso</Label>
                <div className="border border-border/70 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60 sticky top-0 bg-card">
                      <tr>
                        <th className="py-2.5 px-3">Domínio</th>
                        <th className="py-2.5 px-3">Módulo / Menu</th>
                        <th className="py-2.5 px-3 text-center w-20">Leitura</th>
                        <th className="py-2.5 px-3 text-center w-20">Escrita</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {RESOURCE_CATALOG.map((r) => (
                        <tr key={r.key} className="hover:bg-muted/20">
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-[9px] py-0 font-mono">
                              {r.system}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">{r.label}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={form.perms[r.key]?.canRead ?? false}
                              onChange={() => togglePerm(r.key, 'canRead')}
                              className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={form.perms[r.key]?.canWrite ?? false}
                              onChange={() => togglePerm(r.key, 'canWrite')}
                              className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button variant="outline" onClick={closeModal} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="font-semibold">
                {saving ? 'Salvando...' : 'Salvar Permissões'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
