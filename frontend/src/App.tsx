import { useState, useEffect, Component, type ReactNode, lazy, Suspense } from 'react'
import Login from './components/Login'
import AppLayout, { type Page } from './components/AppLayout'
import ModuloLogs from './components/ModuloLogs'
import { revokeSession } from './api/client'
import agentsApi from './components/agents/agentsClient'
import { authSessionFromToken } from './hooks/useAuthSession'
import { ThemeProvider } from './theme/theme-context'

// ─── Lazy imports — cada módulo vira um chunk separado ───────────────────────
const Dashboard           = lazy(() => import('./components/Dashboard'))
const ModuloConectividade = lazy(() => import('./components/ModuloConectividade'))
const ModuloAlertas       = lazy(() => import('./components/ModuloAlertas'))
const AudioQosView        = lazy(() => import('./components/AudioQosView'))
const Softphone           = lazy(() => import('./components/Softphone'))
const Users               = lazy(() => import('./components/Users'))
const Operadoras          = lazy(() => import('./components/Operadoras'))
const Cadastro0800        = lazy(() => import('./components/Cadastro0800'))
const Linhas              = lazy(() => import('./components/Linhas'))
const Settings            = lazy(() => import('./components/Settings'))
const Auditoria           = lazy(() => import('./components/Auditoria'))
const AccessGroups        = lazy(() => import('./components/AccessGroups'))
const Release             = lazy(() => import('./components/Release'))

// ─── Componentes Nativos da Plataforma de Agentes IA ────────────────────────
const AgentsDashboard     = lazy(() => import('./components/agents/AgentsDashboard'))
const AgentsList          = lazy(() => import('./components/agents/AgentsList'))
const AgentsServers       = lazy(() => import('./components/agents/AgentsServers'))
const AgentsKnowledge     = lazy(() => import('./components/agents/AgentsKnowledge'))
const AgentsLogs          = lazy(() => import('./components/agents/AgentsLogs'))
const AgentsAlerts        = lazy(() => import('./components/agents/AgentsAlerts'))
const AgentsSecrets       = lazy(() => import('./components/agents/AgentsSecrets'))
const AgentsLlmSettings   = lazy(() => import('./components/agents/AgentsLlmSettings'))
const AgentsFlows         = lazy(() => import('./components/agents/AgentsFlows').then(m => ({ default: m.AgentsFlows })))

// ─── ErrorBoundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background text-foreground p-6">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold tracking-tight">Erro inesperado na aplicação</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {(this.state.error as Error).message}
          </p>
          <button
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all cursor-pointer"
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          >
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Spinner de carregamento de página ────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px] h-full gap-3 text-muted-foreground text-sm">
      <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span>Carregando interface...</span>
    </div>
  )
}

// ─── App Resource Mappings ──────────────────────────────────────────────────

const PAGE_RESOURCE: Partial<Record<Page, string>> = {
  dashboard:    'telecom.dashboard',
  modulo2:      'telecom.modulo2',
  modulo3:      'telecom.modulo3',
  audioQos:     'telecom.qos',
  users:        'telecom.users',
  operadoras:   'telecom.operadoras',
  cadastro0800: 'telecom.0800',
  linhas:       'telecom.linhas',
  settings:     'telecom.settings',
  logs:         'telecom.logs',
  audit:        'telecom.audit',
  release:      'telecom.release',
  agents:       'telecom.agents_link',
  agDashboard:  'agents.dashboard',
  agAgents:     'agents.agents',
  agServers:    'agents.servers',
  agKnowledge:  'agents.knowledge',
  agLogs:       'agents.logs',
  agAlerts:     'agents.reports',
  agSecrets:    'agents.secrets',
  agLlm:        'agents.llm',
  agFlows:      'agents.flows',
}

const LINK_RESOURCE: Partial<Record<Page, string>> = {
  agDashboard: 'telecom.agents_link', agAgents: 'telecom.agents_link', agServers: 'telecom.agents_link',
  agKnowledge: 'telecom.agents_link', agLogs: 'telecom.agents_link', agAlerts: 'telecom.agents_link',
  agSecrets: 'telecom.agents_link', agLlm: 'telecom.agents_link', agFlows: 'telecom.agents_link',
}

const AGENTS_SUBPAGES: Page[] = ['agDashboard', 'agAgents', 'agServers', 'agKnowledge', 'agLogs', 'agAlerts', 'agSecrets', 'agLlm', 'agFlows']

/**
 * Migração one-shot das chaves legadas 'voipia_token'/'voipia_user' para as
 * chaves canônicas 'agentia_token'/'agentia_user' — preserva sessões já
 * abertas no momento do deploy desta unificação (D1). Roda uma única vez no
 * boot do módulo, antes de qualquer leitura de estado do React.
 */
function migrateLegacySessionKeys(): void {
  const legacyToken = localStorage.getItem('voipia_token')
  if (!localStorage.getItem('agentia_token') && legacyToken) {
    localStorage.setItem('agentia_token', legacyToken)
    const legacyUser = localStorage.getItem('voipia_user')
    if (legacyUser) localStorage.setItem('agentia_user', legacyUser)
  }
  localStorage.removeItem('voipia_token')
  localStorage.removeItem('voipia_user')
}
migrateLegacySessionKeys()

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('agentia_token'))
  const [username, setUsername] = useState<string>(() => localStorage.getItem('agentia_user') || '')
  const [role, setRole] = useState<'ADMIN' | 'USER'>(() => authSessionFromToken(localStorage.getItem('agentia_token')).role)
  const [perms, setPerms] = useState<Record<string, string>>(() => authSessionFromToken(localStorage.getItem('agentia_token')).perms)
  const [showSoftphone, setShowSoftphone] = useState(false)

  const pageFromHash = (): Page => {
    const hash = window.location.hash.replace('#', '').trim() as Page
    const valid: Page[] = [
      'dashboard','modulo2','modulo3','audioQos','users','operadoras','cadastro0800','linhas','settings','audit','logs','accessGroups','release','agents',
      ...AGENTS_SUBPAGES,
    ]
    if (!valid.includes(hash)) return 'dashboard'
    const session = authSessionFromToken(localStorage.getItem('agentia_token'))
    if (hash === 'accessGroups') return session.role === 'ADMIN' ? hash : 'dashboard'
    if (hash === 'agents') return AGENTS_SUBPAGES.find(p => session.hasRead(PAGE_RESOURCE[p]!) && session.hasRead(LINK_RESOURCE[p]!)) ?? 'dashboard'
    const resource = PAGE_RESOURCE[hash]
    if (resource && !session.hasRead(resource)) return 'dashboard'
    const link = LINK_RESOURCE[hash]
    if (link && !session.hasRead(link)) return 'dashboard'
    return hash
  }

  const [page, setPage] = useState<Page>(pageFromHash)
  const [agentsAlertCount, setAgentsAlertCount] = useState(0)

  const navigateTo = (p: Page) => { setPage(p); window.location.hash = p; }

  // Escuta evento de logout forçado (token expirado / 401)
  useEffect(() => {
    const handleLogout = () => handleSignOut()
    window.addEventListener('voipia:logout', handleLogout)
    return () => window.removeEventListener('voipia:logout', handleLogout)
  }, [])

  // Sincroniza page com o hash da URL
  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const rawHash = window.location.hash.replace('#', '').trim()
    if (rawHash !== page) window.location.hash = page
  }, [page])

  // Polling de contagem de alertas da plataforma de agentes
  useEffect(() => {
    if (!token) return
    const fetchAlerts = () => {
      agentsApi
        .get<{ id: string }[]>('/api/executions/alerts?limit=50')
        .then(({ data }) => {
          if (Array.isArray(data)) setAgentsAlertCount(data.length)
        })
        .catch((error) => {
          console.error('Falha ao buscar contagem de alertas da plataforma de agentes:', error)
        })
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30_000)
    return () => clearInterval(interval)
  }, [token])

  const handleLogin = (t: string, user: string) => {
    setToken(t)
    setUsername(user)
    const session = authSessionFromToken(t)
    setRole(session.role)
    setPerms(session.perms)
    setPage(pageFromHash())
  }

  const handleSignOut = () => {
    localStorage.removeItem('agentia_token')
    localStorage.removeItem('agentia_user')
    revokeSession()
    setToken(null)
    setUsername('')
    setRole('USER')
    setPerms({})
  }

  return (
    <ThemeProvider>
      <ErrorBoundary>
        {!token ? (
          <Login onLogin={handleLogin} />
        ) : (
          <AppLayout
            currentPage={page}
            onNavigate={navigateTo}
            username={username}
            role={role}
            perms={perms}
            onLogout={handleSignOut}
            agentsAlertCount={agentsAlertCount}
            onToggleSoftphone={() => setShowSoftphone((v) => !v)}
          >
            <Suspense fallback={<PageLoader />}>
              <ErrorBoundary>
                {page === 'dashboard'    && <Dashboard />}
                {page === 'modulo2'      && <ModuloConectividade />}
                {page === 'audioQos'     && <AudioQosView />}
                {page === 'modulo3'      && <ModuloAlertas />}
                {page === 'users'        && <Users />}
                {page === 'operadoras'   && <Operadoras />}
                {page === 'cadastro0800' && <Cadastro0800 />}
                {page === 'linhas'       && <Linhas />}
                {page === 'settings'     && <Settings />}
                {page === 'audit'        && <Auditoria />}
                {page === 'logs'         && <ModuloLogs />}
                {page === 'accessGroups' && <AccessGroups />}
                {page === 'release'      && <Release />}

                {/* Plataforma de Agentes IA Nativa */}
                {page === 'agDashboard'  && <AgentsDashboard />}
                {page === 'agAgents'     && <AgentsList canWrite={authSessionFromToken(token).hasWrite('agents.agents')} />}
                {page === 'agServers'    && <AgentsServers canWrite={authSessionFromToken(token).hasWrite('agents.servers')} />}
                {page === 'agKnowledge'  && <AgentsKnowledge canWrite={authSessionFromToken(token).hasWrite('agents.knowledge')} />}
                {page === 'agLogs'       && <AgentsLogs />}
                {page === 'agAlerts'     && <AgentsAlerts />}
                {page === 'agSecrets'    && <AgentsSecrets canWrite={authSessionFromToken(token).hasWrite('agents.secrets')} />}
                {page === 'agLlm'        && <AgentsLlmSettings canWrite={authSessionFromToken(token).hasWrite('agents.llm')} />}
                {page === 'agFlows'      && <AgentsFlows />}
              </ErrorBoundary>
            </Suspense>

            {/* Softphone WebRTC Modal / Drawer */}
            {showSoftphone && (
              <Suspense fallback={null}>
                <ErrorBoundary>
                  <div className="fixed bottom-4 right-4 z-50 shadow-2xl rounded-2xl overflow-hidden border border-border bg-card">
                    <Softphone />
                  </div>
                </ErrorBoundary>
              </Suspense>
            )}
          </AppLayout>
        )}
      </ErrorBoundary>
    </ThemeProvider>
  )
}
