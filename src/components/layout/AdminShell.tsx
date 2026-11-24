import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  IndianRupee,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Navigation,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ADMIN_PAGES, ADMIN_SECTIONS, AdminSectionId, PAGE_BY_ID } from '../../config/pagesRegistry';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ROLE_MATRIX } from '../../lib/rbac';
import { cn, formatDateTime } from '../../lib/utils';

interface AdminShellProps {
  currentPageId: string;
  onNavigate: (pageId: string, selectedId?: string) => void;
  children: React.ReactNode;
}

const SECTION_ICONS: Record<AdminSectionId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  customers: Users,
  drivers: UserCheck,
  rides: Navigation,
  vehicles: Car,
  pricing: IndianRupee,
  finance: CircleDollarSign,
  marketing: Megaphone,
  support_security: ShieldAlert,
};

export const AdminShell: React.FC<AdminShellProps> = ({
  currentPageId,
  onNavigate,
  children,
}) => {
  const { user, roleId, logout } = useAuth();
  const {
    customers,
    drivers,
    rides,
    vehicles,
    supportTickets,
    payouts,
    loadingData,
    dataError,
    clearDataError,
    retrySync,
  } = useData();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<AdminSectionId, boolean>>({
    dashboard: true,
    customers: true,
    drivers: false,
    rides: true,
    vehicles: false,
    pricing: false,
    finance: false,
    marketing: false,
    support_security: false,
  });

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const activePage = PAGE_BY_ID[currentPageId] || ADMIN_PAGES[0];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleSection = (sec: AdminSectionId) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const selectPage = (pageId: string) => {
    const meta = PAGE_BY_ID[pageId];
    if (meta) {
      setExpandedSections((prev) => ({ ...prev, [meta.section]: true }));
    }
    onNavigate(pageId);
    setMobileMenuOpen(false);
  };

  // Live operational alerts for Notification Center (real Firestore records only)
  const liveAlerts = useMemo(() => {
    const alerts: {
      id: string;
      title: string;
      detail: string;
      severity: 'critical' | 'warning';
      targetPageId: string;
      selectedId?: string;
      time: string;
    }[] = [];

    for (const ticket of supportTickets) {
      if (ticket.isSos && ticket.status !== 'resolved') {
        alerts.push({
          id: `sos_${ticket.id}`,
          title: `SOS Alert · ${ticket.subject}`,
          detail: `Ride ${ticket.rideId || 'N/A'} · Status: ${ticket.status}`,
          severity: 'critical',
          targetPageId: 'support/sos',
          time: formatDateTime(ticket.createdAt),
        });
      }
    }

    for (const drv of drivers) {
      if (drv.applicationStatus === 'pending') {
        alerts.push({
          id: `drv_${drv.id}`,
          title: `Driver Onboarding Pending · ${drv.fullName}`,
          detail: `${drv.city} · ${drv.vehicleCategory.toUpperCase()}`,
          severity: 'warning',
          targetPageId: 'drivers/approve-reject',
          selectedId: drv.id,
          time: formatDateTime(drv.createdAt),
        });
      }
    }

    for (const pay of payouts) {
      if (pay.status === 'pending' || pay.status === 'processing') {
        alerts.push({
          id: `payout_${pay.id}`,
          title: `Driver Payout Pending Verification`,
          detail: `Driver ${pay.driverId} · ₹${pay.amount}`,
          severity: 'warning',
          targetPageId: 'finance/payouts',
          time: formatDateTime(pay.createdAt),
        });
      }
    }

    return alerts.slice(0, 12);
  }, [drivers, payouts, supportTickets]);

  // Global search across all 65 pages + live entities
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        pages: ADMIN_PAGES.slice(0, 8),
        customers: [] as typeof customers,
        drivers: [] as typeof drivers,
        rides: [] as typeof rides,
        vehicles: [] as typeof vehicles,
      };
    }

    return {
      pages: ADMIN_PAGES.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.sectionLabel.toLowerCase().includes(q) ||
          String(p.num) === q
      ).slice(0, 8),
      customers: customers
        .filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q)
        )
        .slice(0, 5),
      drivers: drivers
        .filter(
          (d) =>
            d.fullName.toLowerCase().includes(q) ||
            d.phone.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q)
        )
        .slice(0, 5),
      rides: rides
        .filter(
          (r) =>
            r.id.toLowerCase().includes(q) ||
            r.pickupAddress.toLowerCase().includes(q) ||
            r.dropAddress.toLowerCase().includes(q)
        )
        .slice(0, 5),
      vehicles: vehicles
        .filter(
          (v) =>
            v.plateNumber.toLowerCase().includes(q) ||
            v.model.toLowerCase().includes(q) ||
            v.id.toLowerCase().includes(q)
        )
        .slice(0, 5),
    };
  }, [customers, drivers, rides, searchQuery, vehicles]);

  const roleSpec = ROLE_MATRIX[roleId];

  const renderNavContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full bg-[#111111] text-white select-none">
      {/* Brand header */}
      <div className="h-14 px-3.5 border-b border-[#222222] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => selectPage('dashboard/main')}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-[#FFC928] text-[#111111] font-extrabold text-xs flex items-center justify-center shrink-0">
            SC
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-white truncate">SHINE CAB</div>
              <div className="text-[11px] text-[#9CA3AF] truncate">Operations Console</div>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSidebarCollapsed((c) => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex items-center justify-center w-7 h-7 rounded-md text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] transition-colors cursor-pointer shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Direct Always-Visible Sidebar Shortcut: API Keys & Integrations */}
      <div className="px-2.5 pt-2.5 pb-1 shrink-0">
        {collapsed ? (
          <button
            type="button"
            title="API Keys & Integrations"
            onClick={() => selectPage('security/api-keys')}
            className={cn(
              'w-full h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer',
              activePage.id === 'security/api-keys'
                ? 'bg-[#FFC928] text-[#111111]'
                : 'text-[#FFC928] bg-[#1A1A1A] hover:bg-[#262626]'
            )}
          >
            <KeyRound className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => selectPage('security/api-keys')}
            className={cn(
              'w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer border',
              activePage.id === 'security/api-keys'
                ? 'bg-[#FFC928] text-[#111111] border-[#E5B21E]'
                : 'bg-[#1A1A1A] text-white border-[#262626] hover:bg-[#222222]'
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <KeyRound className={cn('w-4 h-4 shrink-0', activePage.id === 'security/api-keys' ? 'text-[#111111]' : 'text-[#FFC928]')} />
              <span className="truncate">API Keys & Integrations</span>
            </span>
            <span className={cn('text-[10px] font-mono shrink-0', activePage.id === 'security/api-keys' ? 'text-[#111111]' : 'text-[#9CA3AF]')}>
              ENV
            </span>
          </button>
        )}
      </div>

      {/* 66-page navigation list */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1">
        {ADMIN_SECTIONS.map((sec) => {
          const Icon = SECTION_ICONS[sec.id];
          const secPages = ADMIN_PAGES.filter((p) => p.section === sec.id);
          const isSecActive = activePage.section === sec.id;
          const isExpanded = expandedSections[sec.id] || isSecActive;

          if (collapsed) {
            return (
              <button
                key={sec.id}
                type="button"
                title={`${sec.label} (${secPages.length} pages)`}
                onClick={() => {
                  setSidebarCollapsed(false);
                  setExpandedSections((prev) => ({ ...prev, [sec.id]: true }));
                  selectPage(secPages[0].id);
                }}
                className={cn(
                  'w-full h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer',
                  isSecActive
                    ? 'bg-[#FFC928] text-[#111111]'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-[#1E1E1E]'
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          }

          return (
            <div key={sec.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleSection(sec.id)}
                className={cn(
                  'w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer',
                  isSecActive
                    ? 'text-[#FFC928] bg-[#1A1A1A]'
                    : 'text-[#D1D5DB] hover:text-white hover:bg-[#1A1A1A]'
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{sec.label}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-[#6B7280] tabular-nums">
                    {secPages.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-[#6B7280] transition-transform duration-150',
                      isExpanded ? 'rotate-0' : '-rotate-90'
                    )}
                  />
                </span>
              </button>

              {isExpanded && (
                <div className="pl-3 space-y-0.5 border-l border-[#262626] ml-4 my-1">
                  {secPages.map((p) => {
                    const active = p.id === activePage.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPage(p.id)}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors cursor-pointer',
                          active
                            ? 'bg-[#FFC928] text-[#111111] font-semibold'
                            : 'text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A]'
                        )}
                      >
                        <span
                          className={cn(
                            'text-[10px] font-mono tabular-nums w-5 shrink-0',
                            active ? 'text-[#111111]' : 'text-[#6B7280]'
                          )}
                        >
                          {String(p.num).padStart(2, '0')}
                        </span>
                        <span className="truncate">{p.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom RBAC footer */}
      {!collapsed && (
        <div className="p-3.5 border-t border-[#222222] text-[11px] text-[#9CA3AF] space-y-1 shrink-0">
          <div className="flex items-center justify-between">
            <span className="truncate font-medium text-white">{roleSpec.label}</span>
            <span className="font-mono tabular-nums text-[#FFC928]">{ADMIN_PAGES.length} modules</span>
          </div>
          <div className="truncate text-[#6B7280]">{user?.email || 'Authenticated Session'}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#111111] flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 border-r border-[#222222] sticky top-0 h-screen transition-all duration-150',
          sidebarCollapsed ? 'w-[68px]' : 'w-[264px]'
        )}
      >
        {renderNavContent(sidebarCollapsed)}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3 right-3 z-20 p-1.5 rounded-md text-[#9CA3AF] hover:text-white bg-[#1F2937] cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
            {renderNavContent(false)}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-[#E5E7EB] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-md border border-[#E5E7EB] text-[#111111] hover:bg-[#F3F4F6] cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="min-w-0 flex items-center gap-2 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => selectPage('dashboard/main')}
                className="text-[#6B7280] hover:text-[#111111] hidden sm:inline truncate cursor-pointer"
              >
                SHINE CAB
              </button>
              <span className="text-[#D1D5DB] hidden sm:inline">/</span>
              <span className="text-[#6B7280] hidden sm:inline truncate">
                {activePage.sectionLabel}
              </span>
              <span className="text-[#D1D5DB] hidden sm:inline">/</span>
              <span className="font-semibold text-[#111111] truncate">{activePage.title}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] hover:bg-white hover:border-[#D1D5DB] text-xs text-[#4B5563] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-[#6B7280]" />
              <span className="hidden md:inline">Search pages or records...</span>
              <span className="md:hidden">Search</span>
              <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-[#E5E7EB] rounded text-[#6B7280]">
                Ctrl K
              </kbd>
            </button>

            {/* Quick Live Map Jump */}
            <button
              type="button"
              onClick={() => selectPage('rides/live-map')}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#FFC928] text-[#111111] border border-[#E5B21E] text-xs font-semibold hover:bg-[#F2BC1B] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              Live Map
            </button>

            {/* Notification Center */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((o) => !o);
                  setProfileMenuOpen(false);
                }}
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F7F8FA] text-[#111111] cursor-pointer transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {liveAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {liveAlerts.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F7F8FA]">
                    <span className="text-xs font-semibold text-[#111111]">
                      Operational Alerts ({liveAlerts.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs text-[#6B7280] hover:text-[#111111] cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#F3F4F6]">
                    {liveAlerts.length === 0 ? (
                      <div className="p-4 text-xs text-[#6B7280] text-center">
                        No pending SOS alerts, onboarding approvals, or unverified payouts.
                      </div>
                    ) : (
                      liveAlerts.map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => {
                            onNavigate(alert.targetPageId, alert.selectedId);
                            setNotificationsOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-[#F9FAFB] transition-colors cursor-pointer space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                'text-xs font-semibold truncate',
                                alert.severity === 'critical' ? 'text-[#DC2626]' : 'text-[#111111]'
                              )}
                            >
                              {alert.title}
                            </span>
                            <span className="text-[10px] text-[#6B7280] shrink-0">
                              {alert.time}
                            </span>
                          </div>
                          <div className="text-xs text-[#4B5563] truncate">{alert.detail}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((o) => !o);
                  setNotificationsOpen(false);
                }}
                className="inline-flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F7F8FA] cursor-pointer shrink-0 transition-colors"
              >
                {!avatarFailed ? (
                  <img
                    src="/src/assets/images/avatar_super_admin_1795250398095.jpg"
                    alt="Administrator avatar"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-6 h-6 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-[#FFC928] text-[#111111] text-xs font-bold flex items-center justify-center shrink-0">
                    {(user?.email || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden md:inline text-xs font-semibold text-[#111111] whitespace-nowrap">
                  {roleSpec.label}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5E7EB] space-y-0.5 bg-[#F7F8FA]">
                    <div className="text-xs font-semibold text-[#111111] truncate">
                      {user?.displayName || 'SHINE CAB Admin'}
                    </div>
                    <div className="text-xs text-[#4B5563] truncate">{user?.email}</div>
                    <div className="text-[11px] font-mono text-[#6B7280]">{roleId}</div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        selectPage('security/roles');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#111111] hover:bg-[#F3F4F6] cursor-pointer"
                    >
                      Roles & Permissions
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selectPage('security/api-keys');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#111111] hover:bg-[#F3F4F6] cursor-pointer"
                    >
                      API Keys & Integrations
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selectPage('security/settings-audit');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#111111] hover:bg-[#F3F4F6] cursor-pointer"
                    >
                      System Settings & Audit Logs
                    </button>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#DC2626] hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Non-blocking Data Warning */}
        {dataError && (
          <div className="mx-4 lg:mx-6 mt-4 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-[#DC2626] flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words">
              <strong>Data synchronization warning:</strong> {dataError}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={retrySync}
                className="px-2.5 py-1 rounded border border-red-300 bg-white text-[#DC2626] font-semibold hover:bg-red-100 cursor-pointer"
              >
                Retry Sync
              </button>
              <button
                type="button"
                onClick={clearDataError}
                className="px-2 py-1 rounded text-[#DC2626] hover:bg-red-100 cursor-pointer"
                aria-label="Dismiss warning"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Workspace Content */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto space-y-6">
          {/* In-canvas executive page header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <span>{activePage.sectionLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Module {String(activePage.num).padStart(2, '0')} of {ADMIN_PAGES.length}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
                {activePage.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#6B7280]">{activePage.subtitle}</p>
            </div>
          </div>

          {loadingData ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-8 text-sm text-[#6B7280]">
              Loading live SHINE CAB records...
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40"
          onClick={() => {
            setSearchOpen(false);
            setSearchQuery('');
          }}
        >
          <div
            className="w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E7EB]">
              <Search className="w-4 h-4 text-[#6B7280] shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Jump to any of ${ADMIN_PAGES.length} admin pages, or search customer, driver, ride, vehicle...`}
                className="flex-1 text-sm outline-none text-[#111111] placeholder-[#9CA3AF]"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                className="p-1 text-[#6B7280] hover:text-[#111111] cursor-pointer"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-[#F3F4F6] text-xs">
              <div className="p-3 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] px-2">
                  Admin Pages ({searchResults.pages.length})
                </div>
                {searchResults.pages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      selectPage(p.id);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-between cursor-pointer"
                  >
                    <span className="font-medium text-[#111111]">
                      {p.num}. {p.title}
                    </span>
                    <span className="text-[#6B7280]">{p.sectionLabel}</span>
                  </button>
                ))}
              </div>

              {searchResults.customers.length > 0 && (
                <div className="p-3 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] px-2">
                    Customers
                  </div>
                  {searchResults.customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onNavigate('customers/details', c.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-[#111111]">{c.fullName}</span>
                      <span className="font-mono text-[#6B7280]">{c.city}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.drivers.length > 0 && (
                <div className="p-3 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] px-2">
                    Drivers
                  </div>
                  {searchResults.drivers.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        onNavigate('drivers/details', d.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-[#111111]">{d.fullName}</span>
                      <span className="font-mono text-[#6B7280] uppercase">{d.vehicleCategory}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.rides.length > 0 && (
                <div className="p-3 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] px-2">
                    Rides
                  </div>
                  {searchResults.rides.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        onNavigate('rides/details', r.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-mono font-medium text-[#111111]">{r.id}</span>
                      <span className="text-[#6B7280] truncate max-w-xs">{r.pickupAddress}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.vehicles.length > 0 && (
                <div className="p-3 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] px-2">
                    Vehicles
                  </div>
                  {searchResults.vehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        const targetCatPage =
                          v.category === 'bike'
                            ? 'vehicles/bikes'
                            : v.category === 'auto'
                              ? 'vehicles/autos'
                              : 'vehicles/cabs';
                        onNavigate(targetCatPage);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-mono font-medium text-[#111111]">
                        {v.plateNumber}
                      </span>
                      <span className="text-[#6B7280]">{v.model}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
