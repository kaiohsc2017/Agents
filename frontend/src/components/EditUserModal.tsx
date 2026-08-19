import type { Dispatch, SetStateAction } from 'react'
import type { AccessGroup } from '../api/types'
import type { AppUser, BusinessUnitOption, EditForm } from './userModalTypes'
import { MAX_ACCESS_DAYS, maxAccessDate, toggleBu } from './userModalTypes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, UserCheck } from 'lucide-react'

interface EditUserModalProps {
  user: AppUser
  form: EditForm
  setForm: Dispatch<SetStateAction<EditForm>>
  businessUnits: BusinessUnitOption[]
  accessGroups: AccessGroup[]
  saving: boolean
  onClose: () => void
  onSave: () => void
}

export function EditUserModal({
  user,
  form,
  setForm,
  businessUnits,
  accessGroups,
  saving,
  onClose,
  onSave,
}: EditUserModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Editar Usuário: {user.username}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center justify-between">
            <span>Ramal SIP WebRTC vinculado:</span>
            <span className="font-mono font-bold">📞 {user.extension} (Fixo)</span>
          </div>

          <div className="space-y-1">
            <Label>Nome de Exibição *</Label>
            <Input
              autoFocus
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label>Nova Senha (deixe em branco para manter a atual)</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Perfil Base</Label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="USER">👤 Usuário Padrão</option>
                <option value="ADMIN">🛡 Administrador</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Status da Conta</Label>
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
            <Label>Grupo de Acesso Customizado (RBAC)</Label>
            <select
              className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.accessGroupId ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  accessGroupId: e.target.value ? Number(e.target.value) : null,
                }))
              }
            >
              <option value="">— Usar Perfil Base —</option>
              {accessGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Unidades de Negócio (BU) *</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-border/60 rounded-lg bg-muted/20">
              {businessUnits.map((bu) => {
                const selected = form.businessUnitIds.includes(bu.id)
                return (
                  <button
                    key={bu.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, businessUnitIds: toggleBu(f.businessUnitIds, bu.id) }))}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      selected
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'bg-background text-muted-foreground border border-border/80 hover:text-foreground'
                    }`}
                  >
                    {bu.name}
                  </button>
                )
              })}
              {businessUnits.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma BU cadastrada.</span>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label>Validade do Acesso</Label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={form.accessIndeterminate}
                  onChange={(e) => setForm((f) => ({ ...f, accessIndeterminate: e.target.checked }))}
                  className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Tempo Indeterminado
              </label>
            </div>

            {!form.accessIndeterminate && (
              <div>
                <Input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  max={maxAccessDate()}
                  value={form.accessExpiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, accessExpiresAt: e.target.value }))}
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Prazo máximo permitido: {MAX_ACCESS_DAYS} dias ({maxAccessDate()}).
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving} className="font-semibold">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>
    </div>
  )
}
