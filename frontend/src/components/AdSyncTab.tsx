import { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import { useAuthSession } from '../hooks/useAuthSession'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  RefreshCw,
  Search,
  Trash2,
  Plus,
  UsersRound,
  AlertTriangle,
  X,
  Building2,
  Mail,
  Phone,
  Briefcase,
  IdCard,
  Calendar,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface SyncStatus {
  status: string
  startedAt: string | null
  finishedAt: string | null
  usersSynced: number
  errorMessage: string | null
}

interface AccessGroupOption {
  id: number
  name: string
}

interface GroupMapping {
  id: number
  adGroupName: string
  accessGroupId: number
  accessGroupName: string
}

interface AdUserLookup {
  samAccountName: string
  displayName: string | null
  department: string | null
  office: string | null
  title: string | null
  email: string | null
  telephoneNumber: string | null
  employeeId: string | null
  lastSyncedAt: string | null
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AdSyncTab() {
  const { hasWrite: sessionHasWrite } = useAuthSession()
  const hasWrite = sessionHasWrite('telecom.users')

  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const [query, setQuery] = useState('')
  const [lookupResult, setLookupResult] = useState<AdUserLookup | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)

  const [mappings, setMappings] = useState<GroupMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(true)
  const [accessGroups, setAccessGroups] = useState<AccessGroupOption[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [newAdGroupName, setNewAdGroupName] = useState('')
  const [newAccessGroupId, setNewAccessGroupId] = useState<number | ''>('')
  const [modalError, setModalError] = useState('')
  const [modalSaving, setModalSaving] = useState(false)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const lookupSeqRef = useRef(0)

  const loadStatus = async () => {
    setStatusLoading(true)
    try {
      const res = await api.get<SyncStatus>('/ad/sync-status')
      if (mountedRef.current) setStatus(res.data)
    } catch {
      if (mountedRef.current) setStatus(null)
    } finally {
      if (mountedRef.current) setStatusLoading(false)
    }
  }

  const loadMappings = async () => {
    setMappingsLoading(true)
    try {
      const res = await api.get<GroupMapping[]>('/ad/group-mappings')
      if (mountedRef.current) setMappings(res.data)
    } catch {
      if (mountedRef.current) setMappings([])
    } finally {
      if (mountedRef.current) setMappingsLoading(false)
    }
  }

  const loadAccessGroups = async () => {
    try {
      const res = await api.get<AccessGroupOption[]>('/access-groups')
      if (mountedRef.current) setAccessGroups(res.data)
    } catch {
      if (mountedRef.current) setAccessGroups([])
    }
  }

  useEffect(() => {
    loadStatus()
    loadMappings()
    loadAccessGroups()
  }, [])

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const res = await api.post<SyncStatus>('/ad/sync')
      if (mountedRef.current) setStatus(res.data)
    } catch {
      alert('Erro ao disparar a sincronização. Verifique a configuração de AD.')
    } finally {
      if (mountedRef.current) setSyncing(false)
    }
  }

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    const seq = ++lookupSeqRef.current
    setLookupLoading(true)
    setLookupError('')
    setLookupResult(null)
    try {
      const res = await api.get<AdUserLookup>('/ad/users', { params: { query: query.trim() } })
      if (seq === lookupSeqRef.current && mountedRef.current) setLookupResult(res.data)
    } catch {
      if (seq === lookupSeqRef.current && mountedRef.current) {
        setLookupError('Usuário não encontrado no espelho local. Rode a sincronização se o usuário for recente.')
      }
    } finally {
      if (seq === lookupSeqRef.current && mountedRef.current) setLookupLoading(false)
    }
  }

  const openModal = async () => {
    setNewAdGroupName('')
    setModalError('')
    setModalOpen(true)
    await loadAccessGroups()
    if (mountedRef.current) setNewAccessGroupId(prev => (prev !== '' ? prev : accessGroups[0]?.id ?? ''))
  }

  const handleCreateMapping = async () => {
    if (!newAdGroupName.trim() || newAccessGroupId === '') {
      setModalError('Preencha o nome do grupo AD e selecione um grupo de acesso.')
      return
    }
    setModalSaving(true)
    setModalError('')
    try {
      await api.post('/ad/group-mappings', {
        adGroupName: newAdGroupName.trim(),
        accessGroupId: newAccessGroupId,
      })
      setModalOpen(false)
      await loadMappings()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Erro ao criar mapeamento.'
      setModalError(message)
    } finally {
      setModalSaving(false)
    }
  }

  const handleDeleteMapping = async (mapping: GroupMapping) => {
    if (!confirm(`Remover o mapeamento do grupo AD "${mapping.adGroupName}"?`)) return
    try {
      await api.delete(`/ad/group-mappings/${mapping.id}`)
      await loadMappings()
    } catch {
      alert('Erro ao remover mapeamento.')
    }
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Status da sincronização */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">Sincronização com o Active Directory</span>
              {status && status.status !== 'NEVER_RUN' && (
                <Badge variant="outline" className="text-[10px] py-0 h-4 bg-primary/10 text-primary border-primary/20">
                  {status.status}
                </Badge>
              )}
            </div>
            {statusLoading ? (
              <p className="text-xs text-muted-foreground">Carregando status de sincronização...</p>
            ) : status ? (
              <div className="text-xs text-muted-foreground space-y-1">
                {status.status === 'NEVER_RUN' ? (
                  <span>Nenhuma sincronização foi realizada ainda.</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      Última execução: <strong className="text-foreground">{status.status}</strong>
                    </span>
                    {status.startedAt && (
                      <span>• iniciada em {new Date(status.startedAt).toLocaleString('pt-BR')}</span>
                    )}
                    <span>• <strong className="text-foreground">{status.usersSynced}</strong> usuário(s) sincronizado(s)</span>
                  </div>
                )}
                {status.errorMessage && (
                  <div className="flex items-center gap-1.5 text-rose-500 font-medium mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{status.errorMessage}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Não foi possível carregar o status.</p>
            )}
          </div>

          {hasWrite && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSyncNow}
              disabled={syncing}
              className="text-xs h-8 font-semibold shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Busca de usuário AD */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm font-semibold">Consultar Usuário no Espelho Local</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Verifique como as propriedades do colaborador foram indexadas pelo sincronizador.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <form onSubmit={handleLookup} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="sAMAccountName (ex: joao.silva)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={lookupLoading || !query.trim()}
              className="text-xs h-9"
            >
              {lookupLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Search className="h-3.5 w-3.5 mr-1" />}
              Buscar
            </Button>
          </form>

          {lookupError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{lookupError}</span>
            </div>
          )}

          {lookupResult && (
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <UsersRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate"><strong>Nome:</strong> {lookupResult.displayName ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate"><strong>Depto:</strong> {lookupResult.department ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate"><strong>Cargo:</strong> {lookupResult.title ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate"><strong>E-mail:</strong> {lookupResult.email ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate"><strong>Telefone:</strong> {lookupResult.telephoneNumber ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate"><strong>Matrícula:</strong> {lookupResult.employeeId ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2 md:col-span-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>
                  Última sincronização: {lookupResult.lastSyncedAt ? new Date(lookupResult.lastSyncedAt).toLocaleString('pt-BR') : '—'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mapeamento de grupos AD → grupo de acesso */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Mapeamento de Grupos AD → Grupo de Acesso</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Use o DN completo do grupo (ex: <code className="font-mono bg-muted px-1 py-0.5 rounded text-[11px]">CN=Suporte,OU=Grupos,DC=empresa,DC=local</code>).
            </CardDescription>
          </div>
          {hasWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={openModal}
              className="text-xs h-8 shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Mapeamento
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {mappingsLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              Carregando mapeamentos...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground text-left">
                    <th className="px-4 py-2.5 font-medium">Grupo Active Directory (DN)</th>
                    <th className="px-4 py-2.5 font-medium">Grupo de Acesso (RBAC)</th>
                    {hasWrite && <th className="px-4 py-2.5 w-16 text-right font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {mappings.length === 0 ? (
                    <tr>
                      <td colSpan={hasWrite ? 3 : 2} className="px-4 py-6 text-center text-muted-foreground text-xs">
                        Nenhum mapeamento cadastrado — novos usuários AD recebem o grupo padrão configurado.
                      </td>
                    </tr>
                  ) : (
                    mappings.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-foreground">{m.adGroupName}</td>
                        <td className="px-4 py-2.5 font-medium">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px]">
                            {m.accessGroupName}
                          </Badge>
                        </td>
                        {hasWrite && (
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMapping(m)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                              title="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Novo Mapeamento */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-border/70 bg-card/60">
              <h3 className="font-semibold text-sm text-foreground">Novo Mapeamento de Grupo AD</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Nome do Grupo AD (DN completo)</label>
                <Input
                  autoFocus
                  placeholder="CN=Suporte,OU=Grupos,DC=empresa,DC=local"
                  value={newAdGroupName}
                  onChange={(e) => setNewAdGroupName(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Grupo de Acesso</label>
                <select
                  value={newAccessGroupId}
                  onChange={(e) => setNewAccessGroupId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">Selecione um grupo...</option>
                  {accessGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {modalError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-3 bg-muted/30 border-t border-border/70">
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
                onClick={handleCreateMapping}
                disabled={modalSaving || !hasWrite}
                className="text-xs h-8 font-semibold"
              >
                {modalSaving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Mapeamento'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdSyncTab
