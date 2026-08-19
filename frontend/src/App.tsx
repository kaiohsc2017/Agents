import { useState, useEffect, Component, type ReactNode, lazy, Suspense } from 'react'
import Login from './components/Login'
import AppLayout, { type Page } from './components/AppLayout'
import ModuloLogs from './components/ModuloLogs'
import { revokeSession } from './api/client'
import { authSessionFromToken } from './hooks/useAuthSession'
import { ThemeProvider } from './theme/theme-context'

// ─── Lazy imports — cada módulo vira um chunk separado ───────────────────────
const Dashboard           = lazy(() => import('./components/Dashboard'))
const ModuloConectividade = lazy(() => import('./components/ModuloConectividade'))
const ModuloAlertas       = lazy(() => import('./components/ModuloAlertas'))
const Softphone           = lazy(() => import('./components/Softphone'))
const Users               = lazy(() => import('./components/Users'))
const Operadoras          = lazy(() => import('./components/Operadoras'))
const Cadastro0800        = lazy(() => import('./components/Cadastro0800'))
const Linhas              = lazy(() => import('./components/Linhas'))
const Settings            = lazy(() => import('./components/Settings'))
const Auditoria           = lazy(() => import('./components/Auditoria'))
const AccessGroups        = lazy(() => import('./components/AccessGroups'))
const Release             = lazy(() => import('./components/Release'))
const AgentesPage         = lazy(() => import('./components/AgentesPage'))

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
}

const LINK_RESOURCE: Partial<Record<Page, string>> = {
  agDashboard: 'telecom.agents_link', agAgents: 'telecom.agents_link', agServers: 'telecom.agents_link',
  agKnowledge: 'telecom.agents_link', agLogs: 'telecom.agents_link', agAlerts: 'telecom.agents_link',
  agSecrets: 'telecom.agents_link', agLlm: 'telecom.agents_link',
}

const AGENTS_SUBPAGES: Page[] = ['agDashboard', 'agAgents', 'agServers', 'agKnowledge', 'agLogs', 'agAlerts', 'agSecrets', 'agLlm']

const AGENTS_PAGE_TO_TAB: Record<string, string> = {
  agDashboard: 'dashboard', agAgents: 'agents', agServers: 'servers', agKnowledge: 'knowledge',
  agLogs: 'logs', agAlerts: 'reports', agSecrets: 'secrets', agLlm: 'llm',
}
const AGENTS_TAB_TO_PAGE: Record<string, Page> = {
  dashboard: 'agDashboard', agents: 'agAgents', servers: 'agServers', knowledge: 'agKnowledge',
  logs: 'agLogs', reports: 'agAlerts', secrets: 'agSecrets', llm: 'agLlm',
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('agentia_token') || localStorage.getItem('voipia_token'))
  const [username, setUsername] = useState<string>(() => localStorage.getItem('agentia_user') || localStorage.getItem('voipia_user') || '')
  const [role, setRole] = useState<'ADMIN' | 'USER'>(() => authSessionFromToken(localStorage.getItem('agentia_token') || localStorage.getItem('voipia_token')).role)
  const [perms, setPerms] = useState<Record<string, string>>(() => authSessionFromToken(localStorage.getItem('agentia_token') || localStorage.getItem('voipia_token')).perms)
  const [showSoftphone, setShowSoftphone] = useState(false)

  const pageFromHash = (): Page => {
    const hash = window.location.hash.replace('#', '').trim() as Page
    const valid: Page[] = [
      'dashboard','modulo2','modulo3','users','operadoras','cadastro0800','linhas','settings','audit','logs','accessGroups','release','agents',
      ...AGENTS_SUBPAGES,
    ]
    if (!valid.includes(hash)) return 'dashboard'
    const session = authSessionFromToken(localStorage.getItem('agentia_token') || localStorage.getItem('voipia_token'))
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
    localStorage.removeItem('voipia_token')
    localStorage.removeItem('voipia_user')
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
                {AGENTS_SUBPAGES.includes(page) && (
                  <AgentesPage
                    tab={AGENTS_PAGE_TO_TAB[page] ?? 'dashboard'}
                    onTabChange={(t) => { const p = AGENTS_TAB_TO_PAGE[t]; if (p) navigateTo(p); }}
                    onAlertCount={setAgentsAlertCount}
                  />
                )}
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
