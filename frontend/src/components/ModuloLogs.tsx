import { useEffect, useRef, useState, useCallback } from 'react'
import api from '../api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Terminal,
  Play,
  Pause,
  RefreshCw,
  Search,
  Radio,
  Clock,
  RadioTower,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LogEntry {
  ts: string
  service?: string
  level: string
  category?: string
  msg: string
  raw?: string
  _id?: number
}

let _logIdSeq = 0
function withLogId(entry: LogEntry): LogEntry {
  return { ...entry, _id: _logIdSeq++ }
}

interface AsteriskEndpoint {
  name: string
  status: string
}
interface AsteriskTrunk {
  name: string
  status: string
}
interface AsteriskStatus {
  ok: boolean
  uptime?: string
  version?: string
  channels?: number
  endpoints?: AsteriskEndpoint[]
  trunk?: AsteriskTrunk
  error?: string
}

type DockerService = 'backend' | 'asterisk' | 'ai-agent' | 'scheduler' | 'frontend' | 'postgres'
type AstCategory = 'REGISTER' | 'CALL' | 'PJSIP' | 'DTLS' | 'AMI' | 'ERROR' | 'WARN'
type ActiveTab = 'docker' | 'asterisk'

// ─── Constantes ───────────────────────────────────────────────────────────────

const DOCKER_SERVICES: DockerService[] = ['backend', 'asterisk', 'ai-agent', 'scheduler', 'frontend', 'postgres']
const AST_CATEGORIES: AstCategory[] = ['REGISTER', 'CALL', 'PJSIP', 'DTLS', 'AMI', 'ERROR', 'WARN']

const LEVEL_BADGE_VARIANTS: Record<string, 'destructive' | 'warning' | 'info' | 'default' | 'success' | 'outline'> = {
  ERROR: 'destructive',
  WARN: 'warning',
  WARNING: 'warning',
  INFO: 'info',
  DEBUG: 'outline',
  REGISTER: 'info',
  CALL: 'success',
  PJSIP: 'info',
  DTLS: 'destructive',
  AMI: 'outline',
}

const fmtTs = (ts: string) => (ts.length > 10 ? ts.slice(11, 19) : ts)

export default function ModuloLogs() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('docker')

  // Docker states
  const [dockerLogs, setDockerLogs] = useState<LogEntry[]>([])
  const [dockerLoading, setDockerLoading] = useState(false)
  const [dockerLive, setDockerLive] = useState(false)
  const [dockerSvcs, setDockerSvcs] = useState<Set<DockerService>>(new Set(['backend', 'asterisk']))
  const [dockerSearch, setDockerSearch] = useState('')
  const [dockerLines, setDockerLines] = useState(200)

  // Asterisk states
  const [astLogs, setAstLogs] = useState<LogEntry[]>([])
  const [astLoading, setAstLoading] = useState(false)
  const [astLive, setAstLive] = useState(false)
  const [astCats, setAstCats] = useState<Set<AstCategory>>(new Set(['CALL', 'REGISTER', 'ERROR', 'WARN']))
  const [astSearch, setAstSearch] = useState('')
  const [astLines, setAstLines] = useState(200)
  const [astStatus, setAstStatus] = useState<AsteriskStatus | null>(null)

  const dockerLogRef = useRef<HTMLDivElement>(null)
  const astLogRef = useRef<HTMLDivElement>(null)
  const sseRef = useRef<EventSource | null>(null)

  const toggleSet = <T,>(set: Set<T>, val: T): Set<T> => {
    const s = new Set(set)
    s.has(val) ? s.delete(val) : s.add(val)
    return s
  }

  // ─── Docker Logs Loader ───────────────────────────────────────────────────

  const loadDocker = useCallback(() => {
    setDockerLoading(true)
    const svcs = Array.from(dockerSvcs).join(',') || 'backend'
    const url = `/logs/docker?services=${svcs}&lines=${dockerLines}`
    api
      .get<{ entries: LogEntry[] }>(url)
      .then((r) => {
        setDockerLogs((r.data.entries ?? []).map(withLogId))
      })
      .catch(() => setDockerLogs([]))
      .finally(() => setDockerLoading(false))
  }, [dockerSvcs, dockerLines])

  // ─── Asterisk Logs Loader ─────────────────────────────────────────────────

  const loadAsterisk = useCallback(() => {
    setAstLoading(true)
    const cats = Array.from(astCats).join(',')
    api
      .get<{ entries: LogEntry[]; status?: AsteriskStatus }>(
        `/logs/asterisk?lines=${astLines}&categories=${cats}`
      )
      .then((r) => {
        setAstLogs((r.data.entries ?? []).map(withLogId))
        if (r.data.status) setAstStatus(r.data.status)
      })
      .catch(() => setAstLogs([]))
      .finally(() => setAstLoading(false))
  }, [astCats, astLines])

  const loadAstStatus = useCallback(() => {
    api
      .get<AsteriskStatus>('/logs/asterisk/status')
      .then((r) => setAstStatus(r.data))
      .catch(() => setAstStatus(null))
  }, [])

  useEffect(() => {
    if (activeTab === 'docker') loadDocker()
    else {
      loadAsterisk()
      loadAstStatus()
    }
  }, [activeTab, loadDocker, loadAsterisk, loadAstStatus])

  // ─── Live Streaming (SSE) ─────────────────────────────────────────────────

  const toggleDockerLive = () => {
    if (dockerLive) {
      sseRef.current?.close()
      sseRef.current = null
      setDockerLive(false)
    } else {
      const svcs = Array.from(dockerSvcs).join(',') || 'backend'
      const token = localStorage.getItem('agentia_token') || localStorage.getItem('voipia_token') || ''
      const url = `${api.defaults.baseURL}/logs/docker/stream?services=${svcs}&token=${encodeURIComponent(token)}`
      const sse = new EventSource(url)
      sse.onmessage = (e) => {
        try {
          const entry: LogEntry = JSON.parse(e.data)
          setDockerLogs((prev) => [...prev, withLogId(entry)].slice(-1000))
        } catch {
          // ignore
        }
      }
      sse.onerror = () => {
        sse.close()
        setDockerLive(false)
      }
      sseRef.current = sse
      setDockerLive(true)
    }
  }

  const toggleAstLive = () => {
    if (astLive) {
      sseRef.current?.close()
      sseRef.current = null
      setAstLive(false)
    } else {
      const token = localStorage.getItem('agentia_token') || localStorage.getItem('voipia_token') || ''
      const url = `${api.defaults.baseURL}/logs/asterisk/stream?token=${encodeURIComponent(token)}`
      const sse = new EventSource(url)
      sse.onmessage = (e) => {
        try {
          const entry: LogEntry = JSON.parse(e.data)
          setAstLogs((prev) => [...prev, withLogId(entry)].slice(-1000))
        } catch {
          // ignore
        }
      }
      sse.onerror = () => {
        sse.close()
        setAstLive(false)
      }
      sseRef.current = sse
      setAstLive(true)
    }
  }

  useEffect(() => {
    return () => {
      sseRef.current?.close()
    }
  }, [])

  const filteredDocker = dockerLogs.filter((e) =>
    dockerSearch ? e.msg.toLowerCase().includes(dockerSearch.toLowerCase()) : true
  )

  const filteredAst = astLogs.filter((e) =>
    astSearch ? e.msg.toLowerCase().includes(astSearch.toLowerCase()) : true
  )

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Central de Logs & Telemetria
          </h1>
          <p className="text-xs text-muted-foreground">
            Streaming em tempo real e análise histórica de containers Docker e eventos SIP Asterisk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border/60">
            <button
              onClick={() => {
                setActiveTab('docker')
                if (astLive) toggleAstLive()
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'docker'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Docker Stack
            </button>
            <button
              onClick={() => {
                setActiveTab('asterisk')
                if (dockerLive) toggleDockerLive()
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'asterisk'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Asterisk PBX
            </button>
          </div>
        </div>
      </div>

      {/* ── Asterisk Status Cards (quando na aba Asterisk) ── */}
      {activeTab === 'asterisk' && astStatus?.ok && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-xs border-border/70">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Tronco SIP Operadora
                </span>
                <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      astStatus.trunk?.status === 'Registered' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  {astStatus.trunk?.status ?? 'Online'}
                </div>
                <div className="text-[11px] text-muted-foreground">{astStatus.trunk?.name ?? 'PJSIP Trunk'}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Radio className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/70">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Canais Ativos
                </span>
                <div className="text-2xl font-bold text-foreground font-mono">{astStatus.channels ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Chamadas simultâneas</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <RadioTower className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/70">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Uptime do PBX
                </span>
                <div className="text-sm font-bold font-mono text-foreground">{astStatus.uptime ?? 'Ativo'}</div>
                <div className="text-[11px] text-muted-foreground truncate max-w-xs">{astStatus.version}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Main Terminal Card ── */}
      <Card className="shadow-xs border-border/70 overflow-hidden">
        {/* Toolbar Superior */}
        <div className="p-3 bg-muted/40 border-b border-border/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar mensagens de log..."
                value={activeTab === 'docker' ? dockerSearch : astSearch}
                onChange={(e) =>
                  activeTab === 'docker' ? setDockerSearch(e.target.value) : setAstSearch(e.target.value)
                }
                className="w-full pl-8 pr-3 py-1.5 border border-border/70 rounded-lg bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <select
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={activeTab === 'docker' ? dockerLines : astLines}
              onChange={(e) =>
                activeTab === 'docker'
                  ? setDockerLines(Number(e.target.value))
                  : setAstLines(Number(e.target.value))
              }
            >
              {[100, 200, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  Últimas {n} linhas
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={activeTab === 'docker' ? loadDocker : loadAsterisk}
              disabled={dockerLoading || astLoading}
              className="h-8"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Atualizar
            </Button>
            <Button
              variant={activeTab === 'docker' ? (dockerLive ? 'destructive' : 'default') : astLive ? 'destructive' : 'default'}
              size="xs"
              onClick={activeTab === 'docker' ? toggleDockerLive : toggleAstLive}
              className="h-8 font-semibold"
            >
              {activeTab === 'docker' ? (
                dockerLive ? (
                  <>
                    <Pause className="h-3.5 w-3.5 mr-1" /> Pausar Stream
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1" /> Ao Vivo (SSE)
                  </>
                )
              ) : astLive ? (
                <>
                  <Pause className="h-3.5 w-3.5 mr-1" /> Pausar Stream
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1" /> Ao Vivo (SSE)
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filtros de Tags */}
        <div className="p-2.5 bg-muted/20 border-b border-border/60 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground">Filtros:</span>
          {activeTab === 'docker'
            ? DOCKER_SERVICES.map((s) => (
                <button
                  key={s}
                  onClick={() => setDockerSvcs(toggleSet(dockerSvcs, s))}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-all ${
                    dockerSvcs.has(s)
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-background text-muted-foreground border border-border/80 hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))
            : AST_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setAstCats(toggleSet(astCats, c))}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-all ${
                    astCats.has(c)
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-background text-muted-foreground border border-border/80 hover:text-foreground'
                  }`}
                >
                  {c}
                </button>
              ))}
          <span className="text-[11px] text-muted-foreground ml-auto font-mono font-medium">
            {activeTab === 'docker' ? filteredDocker.length : filteredAst.length} linhas
          </span>
        </div>

        {/* Terminal Output */}
        <div
          ref={activeTab === 'docker' ? dockerLogRef : astLogRef}
          className="bg-slate-950 text-slate-100 p-4 font-mono text-[11px] leading-relaxed max-h-[500px] overflow-y-auto space-y-1 select-text"
        >
          {(activeTab === 'docker' ? filteredDocker : filteredAst).length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              {dockerLoading || astLoading ? 'Conectando ao stream de logs...' : 'Nenhum log encontrado no período.'}
            </div>
          ) : (
            (activeTab === 'docker' ? filteredDocker : filteredAst).map((e) => (
              <div key={e._id} className="flex items-start gap-2.5 hover:bg-slate-900/60 px-1.5 py-0.5 rounded">
                <span className="text-slate-500 shrink-0 select-none">{fmtTs(e.ts)}</span>
                <span className="shrink-0">
                  <Badge variant={LEVEL_BADGE_VARIANTS[e.level] ?? 'outline'} className="text-[9px] py-0 px-1 font-mono">
                    {e.service ?? e.level}
                  </Badge>
                </span>
                <span className="text-slate-200 break-all">{e.msg}</span>
              </div>
            ))
          )}
          {(dockerLive || astLive) && (
            <div className="flex items-center gap-1 text-emerald-400 text-xs animate-pulse pt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Recebendo eventos em tempo real...</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
