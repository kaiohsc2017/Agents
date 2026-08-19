import type { Dispatch, SetStateAction } from 'react'
import type { BusinessUnit, Client, NumberTestCreate, Operation, Segment } from '../api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, PhoneCall } from 'lucide-react'

interface TestModalProps {
  editId: number | null
  form: NumberTestCreate
  setForm: Dispatch<SetStateAction<NumberTestCreate>>
  bus: BusinessUnit[]
  clients: Client[]
  operations: Operation[]
  segments: Segment[]
  onClose: () => void
  onSave: () => void
}

export function TestModal({
  editId,
  form,
  setForm,
  bus,
  clients,
  operations,
  segments,
  onClose,
  onSave,
}: TestModalProps) {
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
            <PhoneCall className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {editId ? 'Editar Teste de Conectividade' : 'Novo Teste de Conectividade'}
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
          <div className="space-y-1">
            <Label>Número de Telefone *</Label>
            <Input
              type="tel"
              autoFocus
              placeholder="ex: +5511999999999 ou 0800..."
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Business Unit (BU) *</Label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.businessUnit.id}
                onChange={(e) => setForm((f) => ({ ...f, businessUnit: { id: +e.target.value } }))}
              >
                <option value={0}>Selecione...</option>
                {bus.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Segmento *</Label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.segment.id}
                onChange={(e) => setForm((f) => ({ ...f, segment: { id: +e.target.value } }))}
              >
                <option value={0}>Selecione...</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.client.id}
                onChange={(e) => setForm((f) => ({ ...f, client: { id: +e.target.value } }))}
              >
                <option value={0}>Selecione...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Operação *</Label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.operation.id}
                onChange={(e) => setForm((f) => ({ ...f, operation: { id: +e.target.value } }))}
              >
                <option value={0}>Selecione...</option>
                {operations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-border/50">
            <div className="space-y-1">
              <Label>Horário Início</Label>
              <Input
                type="time"
                value={form.startTime?.slice(0, 5)}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value + ':00' }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Intervalo (min)</Label>
              <Input
                type="number"
                min={1}
                value={form.intervalMinutes}
                onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: +e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Qtd. Testes</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: +e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave} className="font-semibold">
            {editId ? 'Salvar Alterações' : 'Criar Teste'}
          </Button>
        </div>
      </div>
    </div>
  )
}
