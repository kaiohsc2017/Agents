import type { BusinessUnit, Client, Operadora } from '../api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneForwarded, Plus, X, Trash2 } from 'lucide-react'

export const MAX_REGENERADOS = 5

export interface RegeneradoForm {
  id?: number
  ordem: number
  numeroRegenerado: string
  vdn: string
  vetor: string
  operadoraId: number | null
}

export interface Cadastro0800Form {
  operadora: { id: number } | null
  numero: string
  client: { id: number } | null
  observacao: string
  isActive: boolean
  regenerados: RegeneradoForm[]
}

export const EMPTY_REGENERADO = (ordem: number): RegeneradoForm => ({
  ordem,
  numeroRegenerado: '',
  vdn: '',
  vetor: '',
  operadoraId: null,
})

export const EMPTY_0800_FORM: Cadastro0800Form = {
  operadora: null,
  numero: '',
  client: null,
  observacao: '',
  isActive: true,
  regenerados: [],
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

interface Cadastro0800ModalProps {
  editId: number | null
  form: Cadastro0800Form
  setForm: React.Dispatch<React.SetStateAction<Cadastro0800Form>>
  formBus: number[]
  setFormBus: (ids: number[]) => void
  buOptions: BusinessUnit[]
  clientOptions: Client[]
  operadoraSelectOptions: Operadora[]
  operadoraOptions: Operadora[]
  saving: boolean
  onSave: () => void
  onClose: () => void
}

export default function Cadastro0800Modal({
  editId,
  form,
  setForm,
  formBus,
  setFormBus,
  buOptions,
  clientOptions,
  operadoraSelectOptions,
  operadoraOptions,
  saving,
  onSave,
  onClose,
}: Cadastro0800ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
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
            onClick={onClose}
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving || !form.numero.trim()} className="font-semibold">
            {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Número 0800'}
          </Button>
        </div>
      </div>
    </div>
  )
}
