import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, ShieldCheck, ShieldAlert, KeyRound, QrCode } from 'lucide-react'
import type { AppUser, TotpSetup } from './userModalTypes'

type TotpStep = 'status' | 'setup' | 'confirm' | 'disable'

interface TotpModalProps {
  user: AppUser
  status: boolean
  step: TotpStep
  setup: TotpSetup | null
  code: string
  setCode: (v: string) => void
  msg: string
  loading: boolean
  onClose: () => void
  onStartSetup: () => void
  onGoToDisableStep: () => void
  onBackToStatus: () => void
  onConfirmEnable: () => void
  onConfirmDisable: () => void
}

export function TotpModal({
  user,
  status,
  step,
  setup,
  code,
  setCode,
  msg,
  loading,
  onClose,
  onStartSetup,
  onGoToDisableStep,
  onBackToStatus,
  onConfirmEnable,
  onConfirmDisable,
}: TotpModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">2FA — {user.username}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Processando 2FA...
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Status View ── */}
            {step === 'status' && (
              <div className="space-y-4 text-center">
                <div
                  className={`p-6 rounded-2xl border ${
                    status
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                      : 'bg-primary/5 border-primary/20 text-foreground'
                  }`}
                >
                  <div className="h-12 w-12 rounded-2xl bg-card mx-auto flex items-center justify-center shadow-xs mb-3">
                    {status ? (
                      <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ShieldAlert className="h-6 w-6 text-amber-500" />
                    )}
                  </div>
                  <div className="font-bold text-sm">{status ? '2FA Ativado' : '2FA Desativado'}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {status
                      ? 'Este usuário precisa do código de 6 dígitos no login.'
                      : 'O login deste usuário utiliza apenas senha.'}
                  </p>
                </div>

                {msg && (
                  <div className="p-2.5 rounded-lg text-xs bg-muted/40 border border-border/60 text-foreground">
                    {msg}
                  </div>
                )}

                <div className="pt-2">
                  {!status ? (
                    <Button onClick={onStartSetup} className="w-full font-semibold">
                      <QrCode className="h-4 w-4 mr-1.5" />
                      Configurar 2FA Agora
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={onGoToDisableStep} className="w-full">
                      Desativar Autenticação 2FA
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── Setup View: QR Code ── */}
            {step === 'setup' && setup && (
              <div className="space-y-4 text-center">
                <p className="text-xs text-muted-foreground text-left leading-relaxed">
                  Escaneie o QR Code abaixo com seu app autenticador e insira o código de 6 dígitos para validar.
                </p>

                <div className="p-3 bg-white rounded-xl inline-block shadow-xs border mx-auto">
                  <img src={setup.qrCodeUrl} alt="QR Code 2FA" className="w-44 h-44 mx-auto" />
                </div>

                <div className="p-2 rounded-lg bg-muted/40 border border-border/60 font-mono text-[11px] text-muted-foreground break-all">
                  Chave: <strong className="text-foreground">{setup.secret}</strong>
                </div>

                {msg && <div className="text-xs text-destructive">{msg}</div>}

                <div className="space-y-1 text-left">
                  <Label>Código do Autenticador</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="000 000"
                    maxLength={7}
                    className="text-center font-mono text-base tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={onBackToStatus} className="flex-1">
                    Voltar
                  </Button>
                  <Button onClick={onConfirmEnable} disabled={code.length < 6} className="flex-1 font-semibold">
                    Confirmar 2FA
                  </Button>
                </div>
              </div>
            )}

            {/* ── Disable View ── */}
            {step === 'disable' && (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  Atenção: Ao desativar o 2FA, a conta voltará a exigir apenas senha de login.
                </div>

                {msg && <div className="text-xs text-destructive">{msg}</div>}

                <div className="space-y-1 text-left">
                  <Label>Confirme com o código atual de 6 dígitos</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="000 000"
                    maxLength={7}
                    className="text-center font-mono text-base tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={onBackToStatus} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={onConfirmDisable}
                    disabled={code.length < 6}
                    className="flex-1 font-semibold"
                  >
                    Confirmar Desativação
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
