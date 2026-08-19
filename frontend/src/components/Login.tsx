import { useState, type FormEvent } from 'react'
import api, { getErrorMessage } from '../api/client'
import type { LoginRequest, LoginResponse } from '../api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ThemeToggle } from '@/theme/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Lock, User, LogIn, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react'

interface LoginProps {
  onLogin: (token: string, username: string) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [form, setForm] = useState<LoginRequest>({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // --- 2FA state ---
  const [requiresTotp, setRequiresTotp] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpDisplayName, setTotpDisplayName] = useState('')

  // --- Oferta de MFA no primeiro login ---
  const [mfaStep, setMfaStep] = useState<'none' | 'offer' | 'setup'>('none')
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrCodeUrl: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaMsg, setMfaMsg] = useState('')

  const finishLogin = (token: string, firstLoginCompleted?: boolean) => {
    const cleanUser = form.username.trim()
    localStorage.setItem('voipia_token', token)
    localStorage.setItem('voipia_user', cleanUser)
    localStorage.setItem('agentia_token', token)
    localStorage.setItem('agentia_user', cleanUser)
    if (!firstLoginCompleted) {
      setMfaStep('offer')
      return
    }
    onLogin(token, cleanUser)
  }

  // --- Etapa 1: Login de Usuário ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const payload = {
      username: form.username.trim(),
      password: form.password,
    }
    try {
      const { data } = await api.post<
        LoginResponse & { requiresTotp?: boolean; tempToken?: string; displayName?: string }
      >('/auth/login', payload)

      if (data.requiresTotp && data.tempToken) {
        setTempToken(data.tempToken)
        setTotpDisplayName(data.displayName ?? payload.username)
        setRequiresTotp(true)
        return
      }

      finishLogin(data.token!, data.firstLoginCompleted)
    } catch (err) {
      const msg = getErrorMessage(err, 'Credenciais inválidas. Tente novamente.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // --- Etapa 2: Código TOTP ---
  const handleTotp = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post<{
        token: string
        extension: number
        displayName: string
        firstLoginCompleted?: boolean
      }>('/auth/totp/verify', {
        tempToken,
        code: totpCode.replace(/\s/g, ''),
      })
      finishLogin(data.token, data.firstLoginCompleted)
    } catch (err) {
      const msg = getErrorMessage(err, 'Código TOTP inválido ou expirado.')
      setError(msg)
      setTotpCode('')
    } finally {
      setLoading(false)
    }
  }

  const cancelTotp = () => {
    setRequiresTotp(false)
    setTempToken('')
    setTotpCode('')
    setError(null)
  }

  // --- MFA Onboarding ---
  const skipMfaOffer = async () => {
    try {
      await api.post('/auth/first-login-completed', {})
    } catch {
      // Ignora erro
    }
    const token = localStorage.getItem('agentia_token') || localStorage.getItem('voipia_token') || ''
    onLogin(token, form.username.trim())
  }

  const startMfaSetup = async () => {
    setLoading(true)
    try {
      const { data } = await api.post<{ secret: string; qrCodeUrl: string }>('/auth/totp/setup', {})
      setMfaSetupData(data)
      setMfaStep('setup')
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível iniciar a configuração do 2FA.'))
    } finally {
      setLoading(false)
    }
  }

  const confirmMfaSetup = async () => {
    if (!mfaCode) return
    setLoading(true)
    setMfaMsg('')
    try {
      await api.post('/auth/totp/confirm', { code: mfaCode.replace(/\s/g, '') })
      await api.post('/auth/first-login-completed', {})
      const token = localStorage.getItem('agentia_token') || localStorage.getItem('voipia_token') || ''
      onLogin(token, form.username.trim())
    } catch (err) {
      setMfaMsg(getErrorMessage(err, 'Código inválido. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-muted/20 relative overflow-hidden">
      {/* Background Decorative Elements (ReportECH UX) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md shadow-xl border-border/70 backdrop-blur-md bg-card/95 rounded-2xl relative z-10">
        <CardHeader className="space-y-3 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shadow-xs">
                A★
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg font-bold tracking-tight text-foreground">AgentIA</h1>
                  <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5 font-mono">
                    v3.2
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground font-medium">Enterprise Telecom + IA</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </div>

          <div className="pt-2 space-y-1">
            <CardTitle className="text-xl font-bold tracking-tight">
              {requiresTotp
                ? 'Verificação em 2 Etapas'
                : mfaStep === 'offer'
                ? 'Segurança da Conta'
                : mfaStep === 'setup'
                ? 'Configurar Autenticador'
                : 'Acessar Plataforma'}
            </CardTitle>
            <CardDescription className="text-xs">
              {requiresTotp
                ? `Insira o código de 6 dígitos gerado no app para ${totpDisplayName}.`
                : mfaStep === 'offer'
                ? 'Deseja habilitar autenticação de dois fatores (2FA) para maior proteção?'
                : mfaStep === 'setup'
                ? 'Escaneie o QR Code abaixo com seu app autenticador.'
                : 'Digite suas credenciais de acesso corporativo.'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ── Formulário Padrão de Login ── */}
          {!requiresTotp && mfaStep === 'none' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Usuário
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    required
                    placeholder="ex: admin"
                    className="pl-9 h-10"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="pl-9 pr-10 h-10"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-10 mt-2 font-semibold" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    Autenticando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Entrar no Sistema
                  </span>
                )}
              </Button>
            </form>
          )}

          {/* ── Etapa 2: TOTP 2FA ── */}
          {requiresTotp && (
            <form onSubmit={handleTotp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="totpCode" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Código de 6 dígitos
                </Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="totpCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    maxLength={7}
                    required
                    autoFocus
                    placeholder="000 000"
                    className="pl-9 h-11 text-center font-mono text-lg tracking-widest"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 font-semibold"
                disabled={loading || totpCode.replace(/\s/g, '').length < 6}
              >
                {loading ? 'Validando...' : 'Verificar e Entrar'}
              </Button>

              <Button type="button" variant="ghost" onClick={cancelTotp} className="w-full text-xs">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Voltar ao Login
              </Button>
            </form>
          )}

          {/* ── MFA Onboarding Offer ── */}
          {mfaStep === 'offer' && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground leading-relaxed">
                A autenticação em dois fatores adiciona uma camada essencial de proteção para sua conta corporativa.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={startMfaSetup} className="w-full" disabled={loading}>
                  Configurar 2FA Agora
                </Button>
                <Button variant="outline" onClick={skipMfaOffer} className="w-full">
                  Lembrar mais tarde
                </Button>
              </div>
            </div>
          )}

          {/* ── MFA Setup QR Code ── */}
          {mfaStep === 'setup' && mfaSetupData && (
            <div className="space-y-4 text-center">
              <div className="p-3 bg-white rounded-xl inline-block shadow-xs border">
                <img src={mfaSetupData.qrCodeUrl} alt="QR Code 2FA" className="w-44 h-44 mx-auto" />
              </div>
              <p className="text-[11px] font-mono text-muted-foreground break-all">
                Chave manual: <strong>{mfaSetupData.secret}</strong>
              </p>

              {mfaMsg && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{mfaMsg}</AlertDescription>
                </Alert>
              )}

              <Input
                type="text"
                placeholder="Código de 6 dígitos"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="text-center font-mono text-base tracking-widest h-10"
              />

              <div className="flex gap-2">
                <Button variant="outline" onClick={skipMfaOffer} className="flex-1">
                  Pular
                </Button>
                <Button onClick={confirmMfaSetup} className="flex-1" disabled={loading || mfaCode.length < 6}>
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
