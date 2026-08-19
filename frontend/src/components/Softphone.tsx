import { useEffect, useRef, useState } from 'react'
import { useSipPhone } from '../hooks/useSipPhone'
import { publishCallState, subscribeCallAction, type CallStatus } from '../lib/callBridge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Delete,
  X,
} from 'lucide-react'

const toBridgeStatus = (callState: string): CallStatus => {
  if (callState === 'active') return 'active'
  if (callState === 'calling' || callState === 'incoming') return 'ringing'
  return 'idle'
}

export default function Softphone() {
  const {
    extension,
    regState,
    callState,
    muted,
    duration,
    dialInput,
    setDialInput,
    logLines,
    remoteAudioRef,
    dial,
    answer,
    hangup,
    toggleMute,
    pressKey,
  } = useSipPhone()
  const [open, setOpen] = useState(false)
  const lastDialTarget = useRef('')

  useEffect(() => {
    publishCallState({
      status: toBridgeStatus(callState),
      remote: lastDialTarget.current,
      durationSeconds: duration,
      muted,
    })
  }, [callState, duration, muted])

  useEffect(() => {
    return subscribeCallAction((action) => {
      switch (action.action) {
        case 'answer':
          answer()
          break
        case 'hangup':
        case 'reject':
          hangup()
          break
        case 'dial':
          if (action.payload) {
            lastDialTarget.current = action.payload
            void dial(action.payload)
          }
          break
        case 'mute':
          if (!muted) toggleMute()
          break
        case 'unmute':
          if (muted) toggleMute()
          break
      }
    })
  }, [answer, dial, hangup, muted, toggleMute])

  const handleDial = (target?: string) => {
    const dst = target ?? dialInput
    if (!dst.trim()) return
    lastDialTarget.current = dst
    void dial(dst)
  }

  const regVariant: 'default' | 'outline' | 'destructive' | 'secondary' =
    regState === 'registered' ? 'default' : regState === 'failed' ? 'destructive' : 'outline'

  const regLabel: Record<string, string> = {
    registered: 'Registrado',
    registering: 'Registrando...',
    unregistered: 'Offline',
    failed: 'Erro de Registro',
    'no-extension': 'Sem Ramal',
  }

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay />

      {/* Floating Trigger Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg transition-all duration-200 border cursor-pointer ${
          callState !== 'idle'
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 animate-pulse'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary/20'
        }`}
      >
        <Phone className="h-4 w-4" />
        <span className="text-xs font-semibold">
          {callState === 'active'
            ? `Em chamada (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')})`
            : callState === 'calling'
            ? 'Chamando...'
            : callState === 'incoming'
            ? 'Recebendo chamada...'
            : 'Softphone'}
        </span>
      </button>

      {/* Softphone Dialog / Card */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                <Phone className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-none">Softphone WebRTC</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Ramal {extension || 'N/A'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={regVariant} className="text-[9px] py-0 px-1.5 h-4">
                {regLabel[regState] || regState}
              </Badge>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {/* Status & Timer */}
            {callState !== 'idle' && (
              <div className="text-center py-2 px-3 rounded-xl bg-muted/40 border border-border/50">
                <p className="text-xs font-medium text-muted-foreground capitalize">
                  {callState === 'calling' && 'Discando...'}
                  {callState === 'incoming' && 'Chamada Recebida'}
                  {callState === 'active' && 'Chamada em Andamento'}
                  {callState === 'ended' && 'Chamada Encerrada'}
                </p>
                {callState === 'active' && (
                  <p className="text-lg font-bold font-mono tracking-wider mt-0.5 text-foreground">
                    {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                  </p>
                )}
              </div>
            )}

            {/* Dial Input */}
            <div className="space-y-1">
              <Input
                type="text"
                placeholder="Digitar número..."
                value={dialInput}
                onChange={(e) => setDialInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDial()}
                className="h-10 text-center font-mono text-base tracking-widest font-semibold"
                disabled={callState === 'active' || callState === 'calling'}
              />
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => pressKey(key)}
                  className="h-10 font-bold text-sm hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                >
                  {key}
                </Button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2 pt-1">
              {callState === 'idle' && (
                <Button
                  onClick={() => handleDial()}
                  disabled={!dialInput.trim() || regState !== 'registered'}
                  className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  Chamar
                </Button>
              )}

              {callState === 'incoming' && (
                <>
                  <Button
                    onClick={answer}
                    className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    Atender
                  </Button>
                  <Button
                    onClick={hangup}
                    variant="destructive"
                    className="flex-1 h-9 font-semibold text-xs gap-1.5"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    Recusar
                  </Button>
                </>
              )}

              {(callState === 'active' || callState === 'calling') && (
                <>
                  <Button
                    onClick={hangup}
                    variant="destructive"
                    className="flex-1 h-9 font-semibold text-xs gap-1.5"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    Desligar
                  </Button>
                  <Button
                    variant={muted ? 'destructive' : 'outline'}
                    onClick={toggleMute}
                    className="h-9 px-3 text-xs"
                  >
                    {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </Button>
                </>
              )}

              {dialInput && callState === 'idle' && (
                <Button
                  variant="outline"
                  onClick={() => setDialInput('')}
                  className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Delete className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Logs Area */}
            {logLines.length > 0 && (
              <div className="mt-2 max-h-16 overflow-y-auto p-2 rounded-lg bg-muted/20 border border-border/40 font-mono text-[10px] text-muted-foreground space-y-0.5">
                {logLines.map((l, i) => (
                  <div key={i} className="truncate">
                    {l}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
