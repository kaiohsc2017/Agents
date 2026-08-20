import { useState, useMemo, type ReactNode } from 'react'
import {
  LayoutDashboard,
  PhoneCall,
  AlertTriangle,
  Bot,
  UsersRound,
  Settings,
  Terminal,
  KeyRound,
  ClipboardList,
  LogOut,
  Tag,
  Phone,
  Cable,
  Building2,
  Server,
  Bell,
  ChevronDown,
  ChevronRight,
  Search,
  Menu,
  X,
  Radio,
  BookOpen,
  PhoneForwarded,
  GitFork,
  Volume2,
} from 'lucide-react'
import { canRead } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/theme/ThemeToggle'
import { RELEASES } from '@/data/releases'

const CURRENT_VERSION = RELEASES[RELEASES.length - 1].version

export type Page =
  | 'dashboard'
  | 'modulo2'
  | 'modulo3'
  | 'audioQos'
  | 'users'
  | 'operadoras'
  | 'cadastro0800'
  | 'linhas'
  | 'settings'
  | 'audit'
  | 'logs'
  | 'agents'
  | 'accessGroups'
  | 'release'
  | 'agDashboard'
  | 'agAgents'
  | 'agServers'
  | 'agKnowledge'
  | 'agLogs'
  | 'agAlerts'
  | 'agSecrets'
  | 'agLlm'
  | 'agFlows'

interface AppLayoutProps {
  children: ReactNode
  currentPage: Page
  onNavigate: (page: Page) => void
  username: string
  role: 'ADMIN' | 'USER'
  perms: Record<string, string>
  onLogout: () => void
  agentsAlertCount?: number
  onToggleSoftphone?: () => void
}

interface NavLeaf {
  page: Page
  icon: React.ComponentType<{ className?: string }>
  label: string
  resource?: string
  adminOnly?: boolean
  badge?: string
}

interface NavGroup {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavLeaf[]
  linkResource?: string
}

export function AppLayout({
  children,
  currentPage,
  onNavigate,
  username,
  role,
  perms,
  onLogout,
  agentsAlertCount = 0,
  onToggleSoftphone,
}: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Control quais grupos estão expandidos
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    geral: true,
    telecom: true,
    agentes: true,
    cadastros: true,
    sistema: true,
  })

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const isLeafVisible = (leaf: NavLeaf) =>
    leaf.adminOnly ? role === 'ADMIN' : canRead(role, perms, leaf.resource!)

  const navSections = useMemo(() => {
    const rawGroups: NavGroup[] = [
      {
        id: 'telecom',
        label: 'Módulos Telecom',
        icon: Radio,
        items: [
          { page: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', resource: 'telecom.dashboard' },
          { page: 'modulo2', icon: PhoneCall, label: 'Conectividade', resource: 'telecom.modulo2' },
          { page: 'audioQos', icon: Volume2, label: 'Qualidade de Áudio (QoS)', resource: 'telecom.qos' },
          { page: 'modulo3', icon: AlertTriangle, label: 'Monitoramento Zabbix', resource: 'telecom.modulo3' },
        ],
      },
      {
        id: 'agentes',
        label: 'Plataforma de Agentes',
        icon: Bot,
        linkResource: 'telecom.agents_link',
        items: [
          { page: 'agDashboard', icon: LayoutDashboard, label: 'Dashboard Agentes', resource: 'agents.dashboard' },
          { page: 'agAgents', icon: Bot, label: 'Agentes Autônomos', resource: 'agents.agents' },
          { page: 'agServers', icon: Server, label: 'Servidores & Hosts', resource: 'agents.servers' },
          { page: 'agKnowledge', icon: BookOpen, label: 'Base de Conhecimento', resource: 'agents.knowledge' },
          { page: 'agLogs', icon: Terminal, label: 'Logs de Execução', resource: 'agents.logs' },
          {
            page: 'agAlerts',
            icon: Bell,
            label: 'Alertas IA',
            resource: 'agents.reports',
            badge: agentsAlertCount > 0 ? String(agentsAlertCount) : undefined,
          },
          { page: 'agSecrets', icon: KeyRound, label: 'Secrets Vault', resource: 'agents.secrets' },
          { page: 'agLlm', icon: Settings, label: 'Configurações IA', resource: 'agents.llm' },
          { page: 'agFlows', icon: GitFork, label: 'Flow Canvas (DAG)', resource: 'agents.flows' },
        ],
      },
      {
        id: 'cadastros',
        label: 'Cadastros',
        icon: UsersRound,
        items: [
          { page: 'users', icon: UsersRound, label: 'Usuários', resource: 'telecom.users' },
          { page: 'operadoras', icon: Building2, label: 'Operadoras', resource: 'telecom.operadoras' },
          { page: 'linhas', icon: Cable, label: 'Linhas E1/DDR', resource: 'telecom.linhas' },
          { page: 'cadastro0800', icon: Phone, label: '0800 & DID', resource: 'telecom.0800' },
        ],
      },
      {
        id: 'sistema',
        label: 'Sistema & Governança',
        icon: Settings,
        items: [
          { page: 'settings', icon: Settings, label: 'Configurações Globais', resource: 'telecom.settings' },
          { page: 'accessGroups', icon: KeyRound, label: 'Grupos de Acesso (RBAC)', adminOnly: true },
          { page: 'audit', icon: ClipboardList, label: 'Trilha de Auditoria', resource: 'telecom.audit' },
          { page: 'logs', icon: Terminal, label: 'Logs do Sistema', resource: 'telecom.logs' },
          { page: 'release', icon: Tag, label: 'Notas de Release', resource: 'telecom.release' },
        ],
      },
    ]

    return rawGroups
      .map((group) => {
        const hasParentPermission = group.linkResource ? canRead(role, perms, group.linkResource) : true
        if (!hasParentPermission) return null

        const visibleItems = group.items.filter(isLeafVisible)
        if (visibleItems.length === 0) return null

        // Filtro de busca na sidebar
        const filteredItems = searchQuery.trim()
          ? visibleItems.filter((i) => i.label.toLowerCase().includes(searchQuery.toLowerCase()))
          : visibleItems

        if (filteredItems.length === 0) return null

        return { ...group, items: filteredItems }
      })
      .filter((g): g is NavGroup => g !== null)
  }, [role, perms, agentsAlertCount, searchQuery])

  // Breadcrumbs text resolution
  const breadcrumbText = useMemo(() => {
    for (const group of navSections) {
      const match = group.items.find((item) => item.page === currentPage)
      if (match) return `${group.label} / ${match.label}`
    }
    return 'Painel Geral'
  }, [navSections, currentPage])

  const userInitials = (username || 'AD').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-background text-foreground flex antialiased">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Principal (Padrão ReportECH) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border/70 shadow-sm flex flex-col transition-all duration-200 ease-in-out md:static md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Topo da Sidebar: Branding & Logo */}
        <div className="h-16 px-4 border-b border-border/70 flex items-center justify-between bg-card/60">
          <div
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-3 group cursor-pointer"
          >
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold text-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 shadow-xs">
              A★
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-foreground">AgentIA</span>
                <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5 font-mono">
                  {CURRENT_VERSION}
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground truncate">Enterprise VoIP + IA</span>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input de Busca de Menus na Sidebar */}
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar recursos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8.5 pl-8 pr-3 bg-muted/40 border border-border/60 rounded-lg text-xs placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
            />
          </div>
        </div>

        {/* Links de Navegação da Sidebar */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {navSections.map((group) => {
            const GroupIcon = group.icon
            const isOpen = openGroups[group.id] ?? true

            return (
              <div key={group.id} className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between text-left group cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-2">
                      <GroupIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                        {group.label}
                      </span>
                    </div>
                    <span className="p-0.5 text-muted-foreground group-hover:text-foreground rounded transition-colors">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </div>

                {isOpen && (
                  <div className={`space-y-0.5 ${group.id !== 'telecom' ? 'pl-2 border-l border-border/50 ml-2' : ''}`}>
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = currentPage === item.page

                      return (
                        <button
                          key={item.page}
                          onClick={() => onNavigate(item.page)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.badge && (
                            <Badge
                              variant={isActive ? 'outline' : 'destructive'}
                              className="text-[9px] py-0 px-1.5 h-4 ml-1.5 font-mono font-bold"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rodapé da Sidebar: Usuário, ThemeToggle & Logout */}
        <div className="p-3 border-t border-border/70 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                {userInitials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">{username || 'Operador'}</span>
                <Badge variant={role === 'ADMIN' ? 'default' : 'secondary'} className="w-fit text-[9px] py-0 px-1 h-3.5">
                  {role}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full py-1.5 px-3 rounded-lg border border-destructive/30 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal à Direita */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header Superior (Padrão ReportECH) */}
        <header className="h-16 border-b border-border/70 bg-card/90 backdrop-blur-md px-4 md:px-6 flex items-center justify-between shrink-0 shadow-2xs z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 border border-border/60 rounded-lg hover:bg-accent text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
              aria-label="Alternar menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span
                onClick={() => onNavigate('dashboard')}
                className="hover:text-foreground transition-colors cursor-pointer font-medium"
              >
                AgentIA
              </span>
              <span>/</span>
              <span className="font-semibold text-foreground truncate max-w-[240px]">{breadcrumbText}</span>
            </div>
          </div>

          {/* Quick Actions no Header */}
          <div className="flex items-center gap-3">
            {/* Atalho Softphone WebRTC */}
            {onToggleSoftphone && (
              <button
                onClick={onToggleSoftphone}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-background/60 hover:bg-accent text-xs font-semibold text-foreground transition-all cursor-pointer shadow-2xs"
                title="Abrir Softphone WebRTC"
              >
                <PhoneForwarded className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                <span className="hidden md:inline">Softphone</span>
              </button>
            )}

            <div className="h-4 w-px bg-border/60 hidden sm:block" />

            {/* Notificações / Status */}
            <div className="relative">
              <button
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative cursor-pointer"
                title="Notificações do Sistema"
              >
                <Bell className="h-4 w-4" />
                {agentsAlertCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full ring-2 ring-card" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Canvas de Conteúdo da Página */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto bg-muted/10">
          <div className="max-w-[2200px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
