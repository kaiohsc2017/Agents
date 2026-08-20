import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useAuthSession } from '../hooks/useAuthSession'
import type { AccessGroup } from '../api/types'
import type { AppUser, BusinessUnitOption, CreateForm, EditForm, TotpSetup } from './userModalTypes'
import { EMPTY_CREATE, maxAccessDate } from './userModalTypes'
import { CreateUserModal } from './CreateUserModal'
import { EditUserModal } from './EditUserModal'
import { TotpModal } from './TotpModal'
import AdSyncTab from './AdSyncTab'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users as UsersIcon, ShieldCheck, Plus, Search, Eye, EyeOff, KeyRound, Building2 } from 'lucide-react'

export default function Users() {
  const { hasWrite: sessionHasWrite } = useAuthSession()
  const hasWrite = sessionHasWrite('telecom.users')

  const [activeTab, setActiveTab] = useState<'local' | 'ad'>('local')
  const [users, setUsers] = useState<AppUser[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([])
  const [accessGroups, setAccessGroups] = useState<AccessGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE)
  const [editForm, setEditForm] = useState<EditForm>({
    displayName: '',
    password: '',
    isActive: true,
    role: 'USER',
    accessGroupId: null,
    businessUnitIds: [],
    accessExpiresAt: maxAccessDate(),
    accessIndeterminate: false,
  })
  const [saving, setSaving] = useState(false)
  const [revealedPass, setRevealedPass] = useState<number | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, string>>({})

  const handleToggleReveal = (userId: number) => {
    if (revealedPass === userId) {
      setRevealedPass(null)
      setRevealedPasswords((prev) => {
        const { [userId]: _removed, ...rest } = prev
        return rest
      })
      return
    }
    setRevealedPass(userId)
    if (!(userId in revealedPasswords)) {
      api
        .get<{ extensionPassword: string }>(`/users/${userId}/extension-password`)
        .then((r) => setRevealedPasswords((prev) => ({ ...prev, [userId]: r.data?.extensionPassword ?? '' })))
        .catch(() => setRevealedPasswords((prev) => ({ ...prev, [userId]: '(erro ao buscar)' })))
    }
  }

  const [totpUser, setTotpUser] = useState<AppUser | null>(null)
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null)
  const [totpStatus, setTotpStatus] = useState<boolean>(false)
  const [totpCode, setTotpCode] = useState('')
  const [totpStep, setTotpStep] = useState<'status' | 'setup' | 'confirm' | 'disable'>('status')
  const [totpMsg, setTotpMsg] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .get<AppUser[]>('/users')
      .then((r) => setUsers(r.data ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api
      .get<BusinessUnitOption[]>('/business-units')
      .then((r) => setBusinessUnits(r.data ?? []))
      .catch(() => setBusinessUnits([]))
    api
      .get<AccessGroup[]>('/access-groups')
      .then((r) => setAccessGroups(r.data ?? []))
      .catch(() => setAccessGroups([]))
  }, [])

  const handleCreate = async () => {
    if (!createForm.username.trim()) {
      alert('Informe o username.')
      return
    }
    if (!createForm.password.trim() || createForm.password.length < 6) {
      alert('Senha deve ter ao menos 6 caracteres.')
      return
    }
    if (!createForm.displayName.trim()) {
      alert('Informe o nome de exibição.')
      return
    }
    if (createForm.businessUnitIds.length === 0) {
      alert('Selecione ao menos uma Unidade de Negócio (BU).')
      return
    }
    if (!createForm.accessIndeterminate && !createForm.accessExpiresAt) {
      alert('Informe a data de expiração do acesso ou marque acesso indeterminado.')
      return
    }
    setSaving(true)
    try {
      await api.post('/users', {
        ...createForm,
        accessExpiresAt: createForm.accessIndeterminate ? null : createForm.accessExpiresAt,
      })
      setShowCreate(false)
      setCreateForm(EMPTY_CREATE)
      load()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao criar usuário.'))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (u: AppUser) => {
    setEditUser(u)
    setEditForm({
      displayName: u.displayName,
      password: '',
      isActive: u.isActive,
      role: u.role,
      accessGroupId: null,
      businessUnitIds: u.businessUnitIds ?? [],
      accessExpiresAt: u.accessExpiresAt ?? maxAccessDate(),
      accessIndeterminate: u.accessIndeterminate,
    })
  }

  const handleEdit = async () => {
    if (!editUser) return
    if (!editForm.displayName.trim()) {
      alert('Informe o nome de exibição.')
      return
    }
    if (editForm.businessUnitIds.length === 0) {
      alert('Selecione ao menos uma Unidade de Negócio (BU).')
      return
    }
    if (!editForm.accessIndeterminate && !editForm.accessExpiresAt) {
      alert('Informe a data de expiração do acesso ou marque acesso indeterminado.')
      return
    }
    setSaving(true)
    try {
      await api.put(`/users/${editUser.id}`, {
        displayName: editForm.displayName,
        password: editForm.password.trim() || undefined,
        isActive: editForm.isActive,
        role: editForm.role,
        accessGroupId: editForm.accessGroupId,
        businessUnitIds: editForm.businessUnitIds,
        accessExpiresAt: editForm.accessIndeterminate ? null : editForm.accessExpiresAt,
        accessIndeterminate: editForm.accessIndeterminate,
      })
      setEditUser(null)
      load()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao salvar alterações.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (u: AppUser) => {
    if (!confirm(`Deseja realmente desativar o usuário "${u.username}"?`)) return
    try {
      await api.delete(`/users/${u.id}`)
      load()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao desativar usuário.'))
    }
  }

  const openTotp = async (u: AppUser) => {
    setTotpUser(u)
    setTotpMsg('')
    setTotpCode('')
    setTotpSetup(null)
    setTotpStep('status')
    setTotpLoading(true)
    try {
      const res = await api.get<{ enabled: boolean }>(`/totp/status?username=${encodeURIComponent(u.username)}`)
      setTotpStatus(res.data.enabled)
    } catch {
      setTotpStatus(false)
    } finally {
      setTotpLoading(false)
    }
  }

  const startTotpSetup = async () => {
    if (!totpUser) return
    setTotpLoading(true)
    setTotpMsg('')
    try {
      const res = await api.post<TotpSetup>('/totp/setup', { username: totpUser.username })
      setTotpSetup(res.data)
      setTotpStep('setup')
    } catch (e) {
      setTotpMsg(getErrorMessage(e, 'Erro ao gerar QR code.'))
    } finally {
      setTotpLoading(false)
    }
  }

  const confirmTotpEnable = async () => {
    if (!totpUser) return
    const code = totpCode.replace(/\s/g, '')
    if (code.length !== 6) {
      setTotpMsg('Digite os 6 dígitos do autenticador.')
      return
    }
    setTotpLoading(true)
    setTotpMsg('')
    try {
      await api.post('/totp/enable', { username: totpUser.username, code })
      setTotpStatus(true)
      setTotpStep('status')
      setTotpMsg('2FA ativado com sucesso!')
      setTotpCode('')
      load()
    } catch {
      setTotpMsg('Código inválido. Verifique o app e tente novamente.')
    } finally {
      setTotpLoading(false)
    }
  }

  const handleResetTotp = async (u: AppUser) => {
    if (!confirm(`Resetar o 2FA de "${u.username}"? O usuário precisará reconfigurar no próximo login.`)) return
    try {
      await api.post(`/totp/reset?username=${encodeURIComponent(u.username)}`, {})
      load()
      alert('2FA resetado com sucesso.')
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao resetar 2FA.'))
    }
  }

  const confirmTotpDisable = async () => {
    if (!totpUser) return
    const code = totpCode.replace(/\s/g, '')
    if (code.length !== 6) {
      setTotpMsg('Digite os 6 dígitos para confirmar a desativação.')
      return
    }
    setTotpLoading(true)
    setTotpMsg('')
    try {
      await api.post('/totp/disable', { username: totpUser.username, code })
      setTotpStatus(false)
      setTotpStep('status')
      setTotpMsg('2FA desativado.')
      setTotpCode('')
    } catch {
      setTotpMsg('Código inválido. Não foi possível desativar o 2FA.')
    } finally {
      setTotpLoading(false)
    }
  }

  const closeTotpModal = () => {
    setTotpUser(null)
    setTotpSetup(null)
    setTotpCode('')
    setTotpMsg('')
    setTotpStep('status')
  }

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      String(u.extension).includes(search)
  )

  const activeCount = users.filter((u) => u.isActive).length

  return (
    <div className="space-y-6">
      {/* ── Page Header (Padrão ReportECH) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-xs text-muted-foreground">
            Controle de acessos, ramais SIP WebRTC vinculados e políticas de segurança
          </p>
        </div>
        {activeTab === 'local' && hasWrite && (
          <Button
            onClick={() => {
              setCreateForm(EMPTY_CREATE)
              setShowCreate(true)
            }}
            className="font-semibold shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Usuário
          </Button>
        )}
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('local')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'local'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UsersIcon className="h-4 w-4" />
          Usuários Locais & WebRTC
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ad')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'ad'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Sincronização Active Directory (LDAP)
        </button>
      </div>

      {activeTab === 'ad' ? (
        <AdSyncTab />
      ) : (
        <>
          {/* ── Quick Stats Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Usuários Ativos
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UsersIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Cadastrado
              </span>
              <div className="text-2xl font-bold text-foreground">{users.length}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Ramais WebRTC
              </span>
              <div className="text-xs text-muted-foreground leading-snug">
                Faixa padrão <code className="font-mono font-bold text-foreground">9001–9010</code> criada
                automaticamente.
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <KeyRound className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por login, nome ou ramal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 border border-border/70 rounded-lg bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <span className="text-xs text-muted-foreground self-end sm:self-center font-medium">
          Exibindo {filteredUsers.length} de {users.length} usuários
        </span>
      </div>

      {/* ── Data Table Container (Padrão ReportECH) ── */}
      <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Carregando usuários cadastrados...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Nome de Exibição</th>
                  <th className="py-3 px-4">Ramal SIP</th>
                  <th className="py-3 px-4">Senha Ramal</th>
                  <th className="py-3 px-4">Perfil / Grupo</th>
                  <th className="py-3 px-4">Unidades (BU)</th>
                  <th className="py-3 px-4">Expiração</th>
                  <th className="py-3 px-4">2FA</th>
                  <th className="py-3 px-4">Status</th>
                  {hasWrite && <th className="py-3 px-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={hasWrite ? 11 : 10} className="py-10 text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/25 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground">{u.id}</td>
                      <td className="py-3 px-4 font-semibold text-foreground font-mono">{u.username}</td>
                      <td className="py-3 px-4 text-foreground font-medium">{u.displayName}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="font-mono text-[11px] py-0 px-2 font-bold">
                          📞 {u.extension}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                          <span>{revealedPass === u.id ? revealedPasswords[u.id] ?? '...' : '••••••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleReveal(u.id)}
                            className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                            title={revealedPass === u.id ? 'Ocultar' : 'Revelar senha'}
                          >
                            {revealedPass === u.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[10px] py-0">
                          {u.role === 'ADMIN' ? '🛡 Admin' : '👤 User'}
                        </Badge>
                        {u.accessGroupName && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                            {u.accessGroupName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                        {(u.businessUnitIds ?? []).length === 0
                          ? '—'
                          : (u.businessUnitIds ?? [])
                              .map((id) => businessUnits.find((b) => b.id === id)?.name ?? `#${id}`)
                              .join(', ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {u.accessIndeterminate ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Indeterminado</span>
                        ) : (
                          u.accessExpiresAt ?? '—'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={u.totpEnabled ? 'success' : 'outline'}
                          className="cursor-pointer text-[10px] py-0"
                          onClick={() => openTotp(u)}
                          title="Gerenciar 2FA"
                        >
                          {u.totpEnabled ? '🛡️ Ativo' : '🔓 Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={u.isActive ? 'success' : 'destructive'} className="text-[10px] py-0">
                          {u.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      {hasWrite && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEdit(u)}
                              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                            >
                              Editar
                            </button>
                            <span className="text-border">·</span>
                            <button
                              onClick={() => openTotp(u)}
                              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              2FA
                            </button>
                            {u.totpEnabled && (
                              <>
                                <span className="text-border">·</span>
                                <button
                                  onClick={() => handleResetTotp(u)}
                                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                                >
                                  Reset
                                </button>
                              </>
                            )}
                            {u.isActive && (
                              <>
                                <span className="text-border">·</span>
                                <button
                                  onClick={() => handleDeactivate(u)}
                                  className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
                                >
                                  Desativar
                                </button>
                              </>
                            )}
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
      </>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          form={createForm}
          setForm={setCreateForm}
          businessUnits={businessUnits}
          accessGroups={accessGroups}
          saving={saving}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          form={editForm}
          setForm={setEditForm}
          businessUnits={businessUnits}
          accessGroups={accessGroups}
          saving={saving}
          onClose={() => setEditUser(null)}
          onSave={handleEdit}
        />
      )}

      {totpUser && (
        <TotpModal
          user={totpUser}
          status={totpStatus}
          step={totpStep}
          setup={totpSetup}
          code={totpCode}
          setCode={setTotpCode}
          msg={totpMsg}
          loading={totpLoading}
          onClose={closeTotpModal}
          onStartSetup={startTotpSetup}
          onGoToDisableStep={() => {
            setTotpStep('disable')
            setTotpCode('')
            setTotpMsg('')
          }}
          onBackToStatus={() => {
            setTotpStep('status')
            setTotpMsg('')
          }}
          onConfirmEnable={confirmTotpEnable}
          onConfirmDisable={confirmTotpDisable}
        />
      )}
    </div>
  )
}
