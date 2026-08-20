import type { BusinessUnit, Operadora, Operation } from '../api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Phone, X } from 'lucide-react'

export interface LinhaPayload {
  operadora: { id: number } | null
  operation: { id: number } | null
  chave: string
  ipOperadora: string
  ipAutoglass: string
  observacao: string
  isActive: boolean
}

export const EMPTY_LINHA_FORM: LinhaPayload = {
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

interface LinhasModalProps {
  editId: number | null
  form: LinhaPayload
  setForm: React.Dispatch<React.SetStateAction<LinhaPayload>>
  selectedBuIds: number[]
  setSelectedBuIds: (ids: number[]) => void
  buOptions: BusinessUnit[]
  operationOptions: Operation[]
  operadoraSelectOptions: Operadora[]
  saving: boolean
  onSave: () => void
  onClose: () => void
}

export default function LinhasModal({
  editId,
  form,
  setForm,
  selectedBuIds,
  setSelectedBuIds,
  buOptions,
  operationOptions,
  operadoraSelectOptions,
  saving,
  onSave,
  onClose,
}: LinhasModalProps) {
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
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">{editId ? 'Editar Linha' : 'Nova Linha'}</h2>
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving || !form.operadora} className="font-semibold">
            {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Linha'}
          </Button>
        </div>
      </div>
    </div>
  )
}
