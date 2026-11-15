import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  CheckCheck,
  Clock,
  ExternalLink,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import { getInitials } from '../lib/format';
import { AppNotification, UserProfile, UserRole } from '../types';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';

export type ModuleKey =
  | 'dashboard'
  | 'my-tasks'
  | 'projects-tasks'
  | 'meetings'
  | 'attendance'
  | 'leave'
  | 'employees'
  | 'departments'
  | 'holidays'
  | 'profile'
  | 'salary-slips';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function getNavItemsForRole(role: UserRole): NavItem[] {
  if (role === UserRole.HR) {
    return [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'employees', label: 'Employees', icon: Users },
      { key: 'departments', label: 'Departments', icon: Building2 },
      { key: 'attendance', label: 'Attendance', icon: Clock },
      { key: 'leave', label: 'Leave', icon: CalendarClock },
      { key: 'holidays', label: 'Holidays', icon: Calendar },
      { key: 'profile', label: 'My Profile', icon: User },
      { key: 'salary-slips', label: 'Salary Slips', icon: FileText },
    ];
  }

  if (role === UserRole.DEPARTMENT_HEAD || role === UserRole.TEAM_LEAD) {
    return [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'projects-tasks', label: 'Projects & Tasks', icon: FolderKanban },
      { key: 'meetings', label: 'Department Meetings', icon: Video },
      { key: 'my-tasks', label: 'My Tasks', icon: Briefcase },
      { key: 'attendance', label: 'Attendance', icon: Clock },
      { key: 'leave', label: 'Leave', icon: CalendarClock },
      { key: 'holidays', label: 'Holidays', icon: Calendar },
      { key: 'profile', label: 'My Profile', icon: User },
      { key: 'salary-slips', label: 'Salary Slips', icon: FileText },
    ];
  }

  return [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'my-tasks', label: 'My Tasks', icon: Briefcase },
    { key: 'attendance', label: 'Attendance', icon: Clock },
    { key: 'leave', label: 'Leave', icon: CalendarClock },
    { key: 'meetings', label: 'Meetings', icon: Video },
    { key: 'holidays', label: 'Holidays', icon: Calendar },
    { key: 'profile', label: 'My Profile', icon: User },
    { key: 'salary-slips', label: 'Salary Slips', icon: FileText },
  ];
}

interface LayoutProps {
  user: UserProfile;
  activeModule: ModuleKey;
  onSelectModule: (mod: ModuleKey) => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: number) => void;
  onMarkAllRead: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function Layout({
  user,
  activeModule,
  onSelectModule,
  notifications,
  onMarkNotificationRead,
  onMarkAllRead,
  onLogout,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const navItems = getNavItemsForRole(user.role);
  const activeNav = navItems.find((n) => n.key === activeModule) ?? navItems[0];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSelectNav = (key: ModuleKey) => {
    onSelectModule(key);
    setMobileMenuOpen(false);
  };

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      onMarkNotificationRead(n.id);
    }
    const target = n.linkModule as ModuleKey;
    if (navItems.some((item) => item.key === target)) {
      onSelectModule(target);
    }
    setNotifOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-14 px-5 flex items-center gap-2.5 border-b border-slate-200 shrink-0">
        <div className="w-7 h-7 rounded-md bg-blue-700 text-white flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" aria-hidden="true" />
        </div>
        <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
          VEMS
        </span>
      </div>

      <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeModule;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectNav(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 space-y-3 text-xs text-slate-600 shrink-0">
        <PWAInstallButton variant="sidebar" />
        <div>
          <div className="font-semibold text-slate-900 truncate">{user.name}</div>
          <div className="mt-0.5 text-slate-500 truncate">
            {user.role}
            {user.departmentName ? ` · ${user.departmentName}` : ''}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3.5 p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">VEMS</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">{activeNav.label}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton variant="topbar" />
            </div>
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((p) => !p);
                  setProfileMenuOpen(false);
                }}
                aria-label={`Notifications (${unreadCount} unread)`}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded bg-blue-700 text-white text-[10px] font-semibold tabular-nums flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">
                      Notifications ({unreadCount} unread)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllRead}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                      >
                        <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-500">
                        You are caught up. No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 text-left transition-colors ${
                            n.isRead ? 'bg-white' : 'bg-blue-50/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(n)}
                            className="w-full text-left focus-visible:outline-none"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {n.title}
                              </span>
                              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                {n.category}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                              {n.message}
                            </p>
                          </button>
                          {n.actionUrl && (
                            <a
                              href={n.actionUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                            >
                              <span>Open meeting link</span>
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Initials Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((p) => !p);
                  setNotifOpen(false);
                }}
                aria-label="Account menu"
                className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-2 text-xs font-semibold text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap"
              >
                <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-center">
                  {getInitials(user.name)}
                </span>
                <span className="hidden sm:inline max-w-[140px] truncate">{user.name}</span>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-900 truncate">{user.name}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {user.role} · {user.employeeCode}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectModule('profile');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      <span>My Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
      <OfflineIndicator />
    </div>
  );
}
