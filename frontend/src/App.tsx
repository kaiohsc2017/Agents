import { useState, useEffect, Component, type ReactNode, lazy, Suspense } from 'react';
import './App.css';
import Login from './components/Login';
import Sidebar, { type Page } from './components/Sidebar';
import ModuloLogs from './components/ModuloLogs';
import { revokeSession } from './api/client';
import { authSessionFromToken } from './hooks/useAuthSession';

// ─── Lazy imports — cada módulo vira um chunk separado ───────────────────────
const Dashboard          = lazy(() => import('./components/Dashboard'));
const ModuloConectividade= lazy(() => import('./components/ModuloConectividade'));
const ModuloAlertas      = lazy(() => import('./components/ModuloAlertas'));
const Softphone          = lazy(() => import('./components/Softphone'));
const Users              = lazy(() => import('./components/Users'));
const Operadoras         = lazy(() => import('./components/Operadoras'));
const Cadastro0800       = lazy(() => import('./components/Cadastro0800'));
const Linhas             = lazy(() => import('./components/Linhas'));
const Settings           = lazy(() => import('./components/Settings'));
const Auditoria          = lazy(() => import('./components/Auditoria'));
const AccessGroups       = lazy(() => import('./components/AccessGroups'));
const Release            = lazy(() => import('./components/Release'));
const AgentesPage        = lazy(() => import('./components/AgentesPage'));

// ─── ErrorBoundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16,
          background: 'var(--bg-primary, #0f172a)', color: 'var(--text-primary, #e2e8f0)',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <h2 style={{ margin: 0 }}>Erro inesperado</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            {(this.state.error as Error).message}
          </p>
          <button
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#007aff', color: '#fff', cursor: 'pointer', fontSize: '0.875rem',
            }}
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Spinner de carregamento de página ────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 12, color: 'var(--text-muted)',
      fontSize: '0.9rem',
    }}>
      <div className="spinner" />
      Carregando…
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────

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
};

const LINK_RESOURCE: Partial<Record<Page, string>> = {
  agDashboard: 'telecom.agents_link', agAgents: 'telecom.agents_link', agServers: 'telecom.agents_link',
  agKnowledge: 'telecom.agents_link', agLogs: 'telecom.agents_link', agAlerts: 'telecom.agents_link',
  agSecrets: 'telecom.agents_link', agLlm: 'telecom.agents_link',
};

const AGENTS_SUBPAGES: Page[] = ['agDashboard', 'agAgents', 'agServers', 'agKnowledge', 'agLogs', 'agAlerts', 'agSecrets', 'agLlm'];

const AGENTS_PAGE_TO_TAB: Record<string, string> = {
  agDashboard: 'dashboard', agAgents: 'agents', agServers: 'servers', agKnowledge: 'knowledge',
  agLogs: 'logs', agAlerts: 'reports', agSecrets: 'secrets', agLlm: 'llm',
};
const AGENTS_TAB_TO_PAGE: Record<string, Page> = {
  dashboard: 'agDashboard', agents: 'agAgents', servers: 'agServers', knowledge: 'agKnowledge',
  logs: 'agLogs', reports: 'agAlerts', secrets: 'agSecrets', llm: 'agLlm',
};

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('voipia_token'));
  const [username, setUsername] = useState<string>(() => localStorage.getItem('voipia_user') ?? '');
  const [role, setRole] = useState<'ADMIN' | 'USER'>(() => authSessionFromToken(localStorage.getItem('voipia_token')).role);
  const [perms, setPerms] = useState<Record<string, string>>(() => authSessionFromToken(localStorage.getItem('voipia_token')).perms);
  const pageFromHash = (): Page => {
    const hash = window.location.hash.replace('#', '').trim() as Page;
    const valid: Page[] = [
      'dashboard','modulo2','modulo3','users','operadoras','cadastro0800','linhas','settings','audit','logs','accessGroups','release','agents',
      ...AGENTS_SUBPAGES,
    ];
    if (!valid.includes(hash)) return 'dashboard';
    const session = authSessionFromToken(localStorage.getItem('voipia_token'));
    if (hash === 'accessGroups') return session.role === 'ADMIN' ? hash : 'dashboard';
    if (hash === 'agents') return AGENTS_SUBPAGES.find(p => session.hasRead(PAGE_RESOURCE[p]!) && session.hasRead(LINK_RESOURCE[p]!)) ?? 'dashboard';
    const resource = PAGE_RESOURCE[hash];
    if (resource && !session.hasRead(resource)) return 'dashboard';
    const link = LINK_RESOURCE[hash];
    if (link && !session.hasRead(link)) return 'dashboard';
    return hash;
  };
  const [page, setPage] = useState<Page>(pageFromHash);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agentsAlertCount, setAgentsAlertCount] = useState(0);

  const navigateTo = (p: Page) => { setPage(p); window.location.hash = p; };

  // Escuta evento de logout forçado (token expirado / 401)
  useEffect(() => {
    const handleLogout = () => handleSignOut();
    window.addEventListener('voipia:logout', handleLogout);
    return () => window.removeEventListener('voipia:logout', handleLogout);
  }, []);

  // Sincroniza page com o hash da URL (botões voltar/avançar do browser)
  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const rawHash = window.location.hash.replace('#', '').trim();
    if (rawHash !== page) window.location.hash = page;
  }, [page]);

  const handleLogin = (t: string, user: string) => {
    setToken(t);
    setUsername(user);
    const session = authSessionFromToken(t);
    setRole(session.role);
    setPerms(session.perms);
    setPage(pageFromHash());
  };

  const handleSignOut = () => {
    localStorage.removeItem('voipia_token');
    localStorage.removeItem('voipia_user');
    revokeSession();
    setToken(null);
    setUsername('');
    setRole('USER');
    setPerms({});
  };

  // ---- Não autenticado: tela de login ----
  if (!token) {
    return (
      <ErrorBoundary>
        <Login onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  // ---- Autenticado: layout principal ----
  return (
    <ErrorBoundary>
      <div className="app-layout">
        <Sidebar
          currentPage={page}
          onNavigate={navigateTo}
          username={username}
          role={role}
          perms={perms}
          onLogout={handleSignOut}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          agentsAlertCount={agentsAlertCount}
        />

        <main className={`main-content${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
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
        </main>

        {/* Softphone WebRTC — flutuante em todas as páginas */}
        <Suspense fallback={null}>
          <ErrorBoundary><Softphone /></ErrorBoundary>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
