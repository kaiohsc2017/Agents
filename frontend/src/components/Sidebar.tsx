import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, PhoneCall, AlertTriangle, Bot, UsersRound,
  Settings, Terminal, KeyRound, ClipboardList,
  LogOut, BookOpen, Tag, Phone, Cable, Building2,
  Server, Bell, ChevronDown, ChevronRight,
} from 'lucide-react';
import { canRead } from '../api/client';
import { RELEASES } from '../data/releases';

const CURRENT_VERSION = RELEASES[RELEASES.length - 1].version;

type Page = 'dashboard' | 'modulo2' | 'modulo3' | 'users' | 'operadoras' | 'cadastro0800' | 'linhas' | 'settings' | 'audit' | 'logs' | 'agents' | 'accessGroups' | 'release'
  | 'agDashboard' | 'agAgents' | 'agServers' | 'agKnowledge' | 'agLogs' | 'agAlerts' | 'agSecrets' | 'agLlm' | 'agFlows';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  username: string;
  role: 'ADMIN' | 'USER';
  perms: Record<string, string>;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  agentsAlertCount: number;
}

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

interface NavLeaf {
  page: Page;
  icon: IconType;
  label: string;
  section: string;
  resource?: string;
  adminOnly?: boolean;
  badgeCount?: number;
}

interface NavParent {
  label: string;
  icon: IconType;
  section: string;
  children: NavLeaf[];
  linkResource?: string;
}

type NavEntry = NavLeaf | NavParent;

function isParent(entry: NavEntry): entry is NavParent {
  return 'children' in entry;
}

const NAV_ITEMS: NavEntry[] = [
  { page: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard',          section: 'GERAL',     resource: 'telecom.dashboard'    },
  { page: 'modulo2',      icon: PhoneCall,       label: 'Conectividade',      section: 'MÓDULOS',   resource: 'telecom.modulo2'      },
  { page: 'modulo3',      icon: AlertTriangle,   label: 'Monitoramento',      section: 'MÓDULOS',   resource: 'telecom.modulo3'      },
  {
    label: 'Agentes', icon: Bot, section: 'MÓDULOS',
    linkResource: 'telecom.agents_link',
    children: [
      { page: 'agDashboard', icon: LayoutDashboard, label: 'Dashboard',            section: 'MÓDULOS', resource: 'agents.dashboard' },
      { page: 'agAgents',    icon: Bot,             label: 'Agentes',              section: 'MÓDULOS', resource: 'agents.agents'    },
      { page: 'agServers',   icon: Server,          label: 'Servidores',           section: 'MÓDULOS', resource: 'agents.servers'   },
      { page: 'agKnowledge', icon: BookOpen,        label: 'Base de Conhecimento', section: 'MÓDULOS', resource: 'agents.knowledge' },
      { page: 'agLogs',      icon: Terminal,        label: 'Logs',                 section: 'MÓDULOS', resource: 'agents.logs'      },
      { page: 'agAlerts',    icon: Bell,            label: 'Alertas',              section: 'MÓDULOS', resource: 'agents.reports'   },
      { page: 'agSecrets',   icon: KeyRound,        label: 'Secrets',              section: 'MÓDULOS', resource: 'agents.secrets'   },
      { page: 'agLlm',       icon: Settings,        label: 'Config. IA',           section: 'MÓDULOS', resource: 'agents.llm'       },
      { page: 'agFlows',     icon: ClipboardList,   label: 'Flow Canvas',          section: 'MÓDULOS', resource: 'agents.flows'     },
    ],
  },
  { page: 'users',        icon: UsersRound,      label: 'Usuários',           section: 'CADASTROS', resource: 'telecom.users'        },
  { page: 'operadoras',   icon: Building2,       label: 'Operadora',          section: 'CADASTROS', resource: 'telecom.operadoras'   },
  { page: 'linhas',       icon: Cable,           label: 'Linhas',             section: 'CADASTROS', resource: 'telecom.linhas'       },
  { page: 'cadastro0800', icon: Phone,           label: '0800',               section: 'CADASTROS', resource: 'telecom.0800'         },
  { page: 'settings',     icon: Settings,        label: 'Configurações',      section: 'SISTEMA',   resource: 'telecom.settings'     },
  { page: 'logs',         icon: Terminal,        label: 'Logs',               section: 'SISTEMA',   resource: 'telecom.logs'         },
  { page: 'accessGroups', icon: KeyRound,        label: 'Grupos de Acesso',   section: 'SISTEMA',   adminOnly: true                  },
  { page: 'audit',        icon: ClipboardList,   label: 'Auditoria',          section: 'SISTEMA',   resource: 'telecom.audit'        },
  { page: 'release',      icon: Tag,             label: 'Release',            section: 'SISTEMA',   resource: 'telecom.release'      },
];

type VisibleEntry = NavLeaf | (Omit<NavParent, 'children'> & { children: NavLeaf[] });

export default function Sidebar({ currentPage, onNavigate, username, role, perms, onLogout, collapsed, onToggleCollapse, agentsAlertCount }: SidebarProps) {
  let lastSection = '';
  const isLeafVisible = (leaf: NavLeaf) => leaf.adminOnly ? role === 'ADMIN' : canRead(role, perms, leaf.resource!);

  const visibleItems: VisibleEntry[] = NAV_ITEMS.map(item => {
    if (isParent(item)) {
      const hasLink = item.linkResource ? canRead(role, perms, item.linkResource) : true;
      const children = hasLink ? item.children.filter(isLeafVisible) : [];
      return children.length > 0 ? { ...item, children } : null;
    }
    return isLeafVisible(item) ? item : null;
  }).filter((entry): entry is VisibleEntry => entry !== null);

  // Submenus abertos manualmente pelo usuário. Auto-expande via useEffect (abaixo) quando a
  // navegação entra numa página filha — não via OR direto no isExpanded, para não brigar com
  // o toggle manual: OR'ar currentPage aqui faria o clique de colapsar não ter efeito nenhum
  // enquanto o usuário estivesse numa página filha (o chevron giraria, mas o submenu nunca
  // fecharia).
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const toggleParent = (label: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  useEffect(() => {
    const parent = NAV_ITEMS.find(item => isParent(item) && item.children.some(c => c.page === currentPage));
    if (parent) setExpandedParents(prev => new Set(prev).add(parent.label));
  }, [currentPage]);

  // Rola até o item ativo — com vários submenus abertos ao mesmo tempo (ex: Insights +
  // Financeiro + Agentes), a lista cresce mais que a altura da sidebar e o item ativo
  // pode acabar fora da área visível sem nenhuma pista de que precisa rolar até ele.
  // Depende de `expandedParents` (não só `currentPage`) porque o submenu do item ativo
  // pode só entrar no DOM depois que o efeito de auto-expansão acima roda.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const active = navRef.current?.querySelector('.nav-item.active, .nav-subitem.active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [currentPage, expandedParents]);

  // Expansão temporária ao passar o mouse — só entra em ação quando o menu
  // está no estado fixo "colapsado"; não altera o estado `collapsed` do App.tsx.
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const isEffectivelyCollapsed = collapsed && !hoverExpanded;

  return (
    <aside
      className={`sidebar${isEffectivelyCollapsed ? ' collapsed' : ''}`}
      onMouseEnter={() => { if (collapsed) setHoverExpanded(true); }}
      onMouseLeave={() => setHoverExpanded(false)}
    >

      {/* Logo — clique colapsa/expande o menu */}
      <div className="sidebar-logo" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
        <div className="logo-mark">
          <div className="logo-icon">A★</div>
          <span className="logo-text">AgentIA</span>
        </div>
        <div className="logo-version">{CURRENT_VERSION} — Painel de Controle</div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" ref={navRef}>
        {visibleItems.map(item => {
          const showSection = item.section !== lastSection;
          lastSection = item.section;

          if (isParent(item)) {
            const isExpanded = expandedParents.has(item.label);
            const submenuId = `nav-submenu-${item.label}`;
            const ParentIcon = item.icon;
            return (
              <div key={item.label}>
                {showSection && (
                  <div className="nav-section-label">{item.section}</div>
                )}
                <div
                  className="nav-item"
                  onClick={() => toggleParent(item.label)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-controls={submenuId}
                  title={isEffectivelyCollapsed ? item.label : undefined}
                  onKeyDown={e => e.key === 'Enter' && toggleParent(item.label)}
                >
                  <span className="nav-icon"><ParentIcon size={17} strokeWidth={1.75} /></span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                {isExpanded && (
                  <div className="nav-submenu" id={submenuId}>
                    {item.children.map(child => {
                      const ChildIcon = child.icon;
                      const badgeCount = child.page === 'agAlerts' ? agentsAlertCount : undefined;
                      return (
                        <div
                          key={child.page}
                          className={`nav-item nav-subitem ${currentPage === child.page ? 'active' : ''}`}
                          onClick={() => onNavigate(child.page)}
                          role="button"
                          tabIndex={0}
                          title={isEffectivelyCollapsed ? child.label : undefined}
                          onKeyDown={e => e.key === 'Enter' && onNavigate(child.page)}
                        >
                          <span className="nav-icon"><ChildIcon size={15} strokeWidth={1.75} /></span>
                          <span style={{ flex: 1 }}>{child.label}</span>
                          {!!badgeCount && (
                            <span style={{
                              background: 'var(--clr-danger, #dc2626)', color: '#fff',
                              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                            }}>
                              {badgeCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <div key={item.page}>
              {showSection && (
                <div className="nav-section-label">{item.section}</div>
              )}
              <div
                className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
                onClick={() => onNavigate(item.page)}
                role="button"
                tabIndex={0}
                title={isEffectivelyCollapsed ? item.label : undefined}
                onKeyDown={e => e.key === 'Enter' && onNavigate(item.page)}
              >
                <span className="nav-icon"><Icon size={17} strokeWidth={1.75} /></span>
                <span>{item.label}</span>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer: usuário + sair */}
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="user-name">{username}</div>
            <div className="user-role">{role === 'ADMIN' ? 'Administrador' : 'Usuário'}</div>
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout}>
          <LogOut size={15} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

export type { Page };
