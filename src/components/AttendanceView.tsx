import React, { useCallback, useEffect, useState } from 'react';
import { Coffee, Play, Search, Square } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDate, formatTime, formatWorkedHours } from '../lib/format';
import { AttendanceRecord, AttendanceStatus, Department, UserProfile, UserRole } from '../types';
import { InlineStatus } from './StatusBadge';

interface AttendanceViewProps {
  user: UserProfile;
}

export function AttendanceView({ user }: AttendanceViewProps) {
  const isHR = user.role === UserRole.HR;
  const [scope, setScope] = useState<'org' | 'self'>(isHR ? 'org' : 'self');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selfToday, setSelfToday] = useState<AttendanceRecord | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Present' | 'Late'>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, selfRes] = await Promise.all([
        apiFetch<{ records: AttendanceRecord[] }>(`/api/attendance?scope=${scope}`),
        apiFetch<{ records: AttendanceRecord[] }>('/api/attendance?scope=self'),
      ]);
      setRecords(attRes.records);
      const today = new Date().toISOString().slice(0, 10);
      setSelfToday(selfRes.records.find((r) => r.date === today) ?? null);

      if (isHR) {
        const deptRes = await apiFetch<{ departments: Department[] }>('/api/departments');
        setDepartments(deptRes.departments);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, [scope, isHR]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleAction = async (endpoint: 'clock-in' | 'break-start' | 'break-end' | 'clock-out') => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/attendance/${endpoint}`, { method: 'POST' });
      await loadAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attendance action failed.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = records.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (deptFilter !== 'All' && (r.departmentName || 'General') !== deptFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !r.employeeName.toLowerCase().includes(q) &&
        !r.employeeCode.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Scope Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {isHR && scope === 'org' ? 'Organization Attendance' : 'My Attendance'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {isHR && scope === 'org'
              ? 'Monitor daily clock-ins, breaks, and attendance status across departments.'
              : 'Record your daily clock-in, breaks, clock-out, and review your attendance history.'}
          </p>
        </div>

        {isHR && (
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setScope('org')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                scope === 'org'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Organization Log
            </button>
            <button
              type="button"
              onClick={() => setScope('self')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                scope === 'self'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Attendance
            </button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Personal Today Attendance Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500">
            Today · {formatDate(new Date().toISOString().slice(0, 10))}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {!selfToday
              ? 'Not clocked in yet'
              : selfToday.clockOut
                ? `Clocked out at ${formatTime(selfToday.clockOut)}`
                : selfToday.breakStartedAt
                  ? `Clocked in at ${formatTime(selfToday.clockIn)} · On break`
                  : `Clocked in at ${formatTime(selfToday.clockIn)}`}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!selfToday && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAction('clock-in')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clock in</span>
            </button>
          )}
          {selfToday && !selfToday.clockOut && !selfToday.breakStartedAt && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAction('break-start')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              <Coffee className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Start break</span>
            </button>
          )}
          {selfToday && !selfToday.clockOut && selfToday.breakStartedAt && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAction('break-end')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              <Coffee className="w-3.5 h-3.5" aria-hidden="true" />
              <span>End break</span>
            </button>
          )}
          {selfToday && !selfToday.clockOut && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAction('clock-out')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clock out</span>
            </button>
          )}
        </div>
      </section>

      {/* Filters & History Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(['All', 'Present', 'Late'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {isHR && scope === 'org' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                aria-label="Filter by department"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="All">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee..."
                  className="w-full sm:w-52 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Date</th>
                {isHR && scope === 'org' && <th className="py-3 px-4">Employee</th>}
                {isHR && scope === 'org' && <th className="py-3 px-4">Department</th>}
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4 text-right">Break</th>
                <th className="py-3 px-4 text-right">Worked</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={isHR && scope === 'org' ? 8 : 6} className="py-8 text-center text-slate-500">
                    Loading attendance records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isHR && scope === 'org' ? 8 : 6} className="py-8 text-center text-slate-500">
                    No attendance records match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      {formatDate(rec.date)}
                    </td>
                    {isHR && scope === 'org' && (
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{rec.employeeName}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {rec.employeeCode}
                        </div>
                      </td>
                    )}
                    {isHR && scope === 'org' && (
                      <td className="py-3 px-4 text-slate-600">{rec.departmentName || '—'}</td>
                    )}
                    <td className="py-3 px-4 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {formatTime(rec.clockIn)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {rec.clockOut ? formatTime(rec.clockOut) : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums text-right whitespace-nowrap">
                      {rec.breakMinutes}m
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-900 tabular-nums text-right whitespace-nowrap">
                      {formatWorkedHours(rec.clockIn, rec.clockOut, rec.breakMinutes)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <InlineStatus
                        label={rec.status}
                        tone={rec.status === AttendanceStatus.PRESENT ? 'green' : 'amber'}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
