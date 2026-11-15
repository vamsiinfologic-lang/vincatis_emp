import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Building2, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import { UserProfile } from '../types';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'HR Workspace',
    name: 'Claire Bennett',
    role: 'HR',
    email: 'hr@vems.work',
    password: 'Vems@2026',
  },
  {
    label: 'Department Head',
    name: 'Marcus Vance',
    role: 'Department Head',
    email: 'head@vems.work',
    password: 'Vems@2026',
  },
  {
    label: 'Team Lead',
    name: 'Priya Nair',
    role: 'Team Lead',
    email: 'lead@vems.work',
    password: 'Vems@2026',
  },
  {
    label: 'Employee',
    name: 'Elena Rostova',
    role: 'Employee',
    email: 'employee@vems.work',
    password: 'Vems@2026',
  },
];

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setAuthToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Verify your email and password or contact HR.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left context panel */}
      <div className="lg:w-[46%] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 px-8 py-10 lg:px-14 lg:py-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight">VEMS</span>
          </div>

          <div className="mt-12 max-w-md">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 leading-tight">
              One workspace for people, attendance, and team delivery.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              VEMS connects HR, department heads, team leads, and employees in a unified,
              role-based workspace for daily operations.
            </p>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-8 space-y-6 max-w-md">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">HR Administration</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Set up departments and employee records, monitor attendance across the organization,
                review leave requests, and publish company holidays.
              </p>
            </div>
            <div className="border-t border-slate-100 pt-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Department Head &amp; Team Lead
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Assign tasks with priorities and due dates, review submitted work with feedback or
                rework requests, and schedule department meetings.
              </p>
            </div>
            <div className="border-t border-slate-100 pt-5">
              <h2 className="text-sm font-semibold text-slate-900">Employee Workspace</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Clock in and manage breaks, apply for leave, track and submit assigned tasks, join
                meetings, and view company holidays.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-slate-400">
          Need a password reset or role change? Contact HR or your system administrator.
        </p>
      </div>

      {/* Right sign-in panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Sign in to VEMS</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Enter your work email and password to open your role dashboard.
                </p>
              </div>
              <PWAInstallButton variant="card" />
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Work email
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@vems.work"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap"
              >
                <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                {!loading && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
              </button>
            </form>
          </div>

          {/* Demo Workspace Quick Fill */}
          <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900">Sample Workspace Accounts</h3>
              <span className="text-xs font-mono text-slate-500">Vems@2026</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Select a role below to fill credentials, then click Sign in.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickFill(acc.email, acc.password)}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    email === acc.email
                      ? 'border-blue-600 bg-blue-50/60'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900">{acc.label}</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {acc.name} · {acc.email}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <OfflineIndicator />
    </div>
  );
}
