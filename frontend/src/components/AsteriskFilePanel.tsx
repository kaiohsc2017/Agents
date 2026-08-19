import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Save, RotateCcw, RefreshCw, Info, CheckCircle2, AlertCircle } from 'lucide-react'

interface AsteriskFilePanelProps {
  panelId: string
  icon?: React.ReactNode | string
  title: string
  description?: React.ReactNode
  hint?: React.ReactNode
  value: string
  original: string
  saving: boolean
  isLoading?: boolean
  reloadStatus?: string
  reloadLabel?: string
  saveLabel?: string
  open?: boolean
  minRows?: number
  onToggle?: () => void
  onChange: (v: string) => void
  onDiscard?: () => void
  onSave: () => void
}

export function AsteriskFilePanel({
  panelId,
  icon,
  title,
  description,
  hint,
  value,
  original,
  saving,
  isLoading = false,
  reloadStatus = '',
  reloadLabel = 'Módulo',
  saveLabel = 'Salvar e Recarregar Asterisk',
  open: controlledOpen,
  minRows = 12,
  onToggle: controlledToggle,
  onChange,
  onDiscard,
  onSave,
}: AsteriskFilePanelProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen

  const handleToggle = () => {
    if (controlledToggle) {
      controlledToggle()
    } else {
      setInternalOpen((v) => !v)
    }
  }

  const handleDiscard = () => {
    if (onDiscard) {
      onDiscard()
    } else {
      onChange(original)
    }
  }

  const changed = value !== original

  return (
    <Card className="border-border/70 shadow-xs overflow-hidden transition-all duration-200">
      {/* Cabeçalho */}
      <div
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/40 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shadow-2xs shrink-0">
            {typeof icon === 'string' ? icon : (icon ?? '📄')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground tracking-tight">{title}</span>
              {changed && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] py-0 h-4">
                  ● alterado
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] py-0 h-4 font-mono text-muted-foreground">
                asterisk
              </Badge>
            </div>
            {description && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {description}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
          )}
        </div>
      </div>

      {isOpen && (
        <CardContent className="p-4 pt-0 border-t border-border/50 bg-card/40 space-y-4">
          {/* Hint informacional */}
          {hint && (
            <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary leading-relaxed">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div>{hint}</div>
            </div>
          )}

          {/* Área de edição */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span>Carregando arquivo de configuração...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                key={panelId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                rows={Math.max(minRows, (value || '').split('\n').length + 2)}
                className="w-full font-mono text-xs leading-relaxed p-3.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-muted-foreground shadow-2xs resize-y"
                placeholder="; Configuração Asterisk..."
              />
            </div>
          )}

          {/* Rodapé / Ações */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/50">
            <div>
              {reloadStatus && (
                <div className="flex items-center gap-1.5 text-xs">
                  {reloadStatus === 'ok' ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {reloadLabel} recarregado com sucesso
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Reload {reloadLabel}: {reloadStatus}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={!changed || saving}
                className="text-xs h-8"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Descartar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onSave}
                disabled={saving || !(value || '').trim()}
                className="text-xs h-8 font-semibold shadow-xs"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {saveLabel}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
export default AsteriskFilePanel
