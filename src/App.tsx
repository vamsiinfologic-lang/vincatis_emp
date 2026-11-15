import { useCallback, useEffect, useState } from 'react';
import { AttendanceView } from './components/AttendanceView';
import { DashboardView } from './components/DashboardView';
import { DepartmentsView } from './components/DepartmentsView';
import { EmployeesView } from './components/EmployeesView';
import { HolidaysView } from './components/HolidaysView';
import { getNavItemsForRole, Layout, ModuleKey } from './components/Layout';
import { LeaveView } from './components/LeaveView';
import { LoginPage } from './components/LoginPage';
import { MeetingsView } from './components/MeetingsView';
import { MyTasksView } from './components/MyTasksView';
import { ProfileView } from './components/ProfileView';
import { ProjectsTasksView } from './components/ProjectsTasksView';
import { SalarySlipsView } from './components/SalarySlipsView';
import { apiFetch, setAuthToken } from './lib/api';
import { AppNotification, UserProfile, UserRole } from './types';

const VALID_SHORTCUT_MODULES: ModuleKey[] = [
  'dashboard',
  'my-tasks',
  'projects-tasks',
  'meetings',
  'attendance',
  'leave',
  'employees',
  'departments',
  'holidays',
  'profile',
  'salary-slips',
];

function getInitialModule(): ModuleKey {
  try {
    const param = new URLSearchParams(window.location.search).get('module') as ModuleKey | null;
    if (param && VALID_SHORTCUT_MODULES.includes(param)) return param;
  } catch {
    // ignore
  }
  return 'dashboard';
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleKey>(getInitialModule);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiFetch<{ notifications: AppNotification[] }>('/api/notifications');
      setNotifications(res.notifications);
    } catch {
      // ignore if logged out
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<{ user: UserProfile }>('/api/auth/me');
        if (active) {
          setUser(res.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 20000);
    return () => window.clearInterval(timer);
  }, [user, loadNotifications]);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setActiveModule('dashboard');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setActiveModule('dashboard');
  };

  const handleMarkNotificationRead = async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
    } catch {
      // ignore
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Loading VEMS workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Ensure activeModule is permitted for current role
  const allowedKeys = getNavItemsForRole(user.role).map((item) => item.key);
  const currentModule: ModuleKey = allowedKeys.includes(activeModule)
    ? activeModule
    : 'dashboard';

  const renderModule = () => {
    switch (currentModule) {
      case 'dashboard':
        return (
          <DashboardView
            user={user}
            onNavigate={setActiveModule}
            onRefreshNotifications={loadNotifications}
          />
        );
      case 'my-tasks':
        return <MyTasksView onRefreshNotifications={loadNotifications} />;
      case 'projects-tasks':
        if (
          user.role === UserRole.DEPARTMENT_HEAD ||
          user.role === UserRole.TEAM_LEAD
        ) {
          return (
            <ProjectsTasksView
              user={user}
              onRefreshNotifications={loadNotifications}
            />
          );
        }
        return null;
      case 'meetings':
        return (
          <MeetingsView user={user} onRefreshNotifications={loadNotifications} />
        );
      case 'attendance':
        return <AttendanceView user={user} />;
      case 'leave':
        return (
          <LeaveView user={user} onRefreshNotifications={loadNotifications} />
        );
      case 'employees':
        return user.role === UserRole.HR ? <EmployeesView /> : null;
      case 'departments':
        return user.role === UserRole.HR ? <DepartmentsView /> : null;
      case 'holidays':
        return (
          <HolidaysView user={user} onRefreshNotifications={loadNotifications} />
        );
      case 'profile':
        return (
          <ProfileView
            user={user}
            onUserUpdated={setUser}
            onRefreshNotifications={loadNotifications}
          />
        );
      case 'salary-slips':
        return <SalarySlipsView user={user} />;
      default:
        return null;
    }
  };

  return (
    <Layout
      user={user}
      activeModule={currentModule}
      onSelectModule={setActiveModule}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onMarkAllRead={handleMarkAllRead}
      onLogout={handleLogout}
    >
      {renderModule()}
    </Layout>
  );
}
