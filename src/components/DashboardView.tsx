import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Coffee,
  ExternalLink,
  FolderKanban,
  Play,
  Square,
  Video,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  computeDaysInclusive,
  formatDate,
  formatTime,
  formatWorkedHours,
} from '../lib/format';
import {
  AttendanceRecord,
  AttendanceStatus,
  CompanyHoliday,
  DepartmentMeeting,
  LeaveRequest,
  TaskAssignment,
  TaskWorkflowState,
  UserProfile,
  UserRole,
} from '../types';
import { ModuleKey } from './Layout';
import { InlineStatus, TaskStateLabel } from './StatusBadge';

interface DashboardData {
  todayAttendance: AttendanceRecord | null;
  upcomingHolidays: CompanyHoliday[];
  upcomingMeetings: DepartmentMeeting[];
  myTasks: TaskAssignment[];
  myLeave: LeaveRequest[];
  hrSummary: {
    totalEmployees: number;
    totalDepartments: number;
    presentToday: number;
    lateToday: number;
    pendingLeavesCount: number;
    pendingLeaves: LeaveRequest[];
  } | null;
  managerSummary: {
    teamMembersCount: number;
    pendingCount: number;
    ongoingCount: number;
    finishedCount: number;
    awaitingReviewTasks: TaskAssignment[];
  } | null;
}

interface DashboardViewProps {
  user: UserProfile;
  onNavigate: (mod: ModuleKey) => void;
  onRefreshNotifications: () => void;
}

export function DashboardView({
  user,
  onNavigate,
  onRefreshNotifications,
}: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await apiFetch<DashboardData>('/api/dashboard');
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleAttendanceAction = async (
    endpoint: 'clock-in' | 'break-start' | 'break-end' | 'clock-out'
  ) => {
    setActionBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/attendance/${endpoint}`, { method: 'POST' });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attendance action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleQuickLeaveDecision = async (leaveId: number, decision: 'Approved' | 'Rejected') => {
    setActionBusy(true);
    try {
      await apiFetch(`/api/leave/${leaveId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      await loadDashboard();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to review leave request.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-56 rounded-xl bg-white border border-slate-200 animate-pulse lg:col-span-2" />
          <div className="h-56 rounded-xl bg-white border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
        {error || 'Dashboard data unavailable.'}
      </div>
    );
  }

  const att = data.todayAttendance;
  const isManager =
    user.role === UserRole.DEPARTMENT_HEAD || user.role === UserRole.TEAM_LEAD;
  const isHR = user.role === UserRole.HR;
  const activeTasks = data.myTasks.filter((t) => t.state !== TaskWorkflowState.COMPLETED);

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Welcome back, {user.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {user.designation}
            {user.departmentName ? ` · ${user.departmentName}` : ''} ·{' '}
            <span className="font-mono text-xs">{user.employeeCode}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isManager && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('projects-tasks')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
              >
                <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Assign task</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('meetings')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <Video className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>Schedule meeting</span>
              </button>
            </>
          )}
          {isHR && (
            <button
              type="button"
              onClick={() => onNavigate('employees')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <span>Manage employees</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
        >
          {error}
        </div>
      )}

      {/* HR Summary Strip */}
      {isHR && data.hrSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Active Employees</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {data.hrSummary.totalEmployees}
            </div>
            <div className="mt-1 text-xs text-slate-500">Across organization</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Departments</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {data.hrSummary.totalDepartments}
            </div>
            <div className="mt-1 text-xs text-slate-500">Configured units</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Clocked In Today</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {data.hrSummary.presentToday + data.hrSummary.lateToday}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              {data.hrSummary.presentToday} Present · {data.hrSummary.lateToday} Late
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Pending Leave</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {data.hrSummary.pendingLeavesCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">Awaiting HR review</div>
          </div>
        </div>
      )}

      {/* Manager Summary Strip */}
      {isManager && data.managerSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Team Members</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {data.managerSummary.teamMembersCount}
            </div>
            <div className="mt-1 text-xs text-slate-500 truncate">
              {user.departmentName || 'Department'}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Pending Tasks</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {data.managerSummary.pendingCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">Not started or awaiting accept</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Ongoing Tasks</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {data.managerSummary.ongoingCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">In progress or submitted</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">Finished Tasks</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {data.managerSummary.finishedCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">Reviewed and complete</div>
          </div>
        </div>
      )}

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Attendance Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Daily Attendance · {formatDate(new Date().toISOString().slice(0, 10))}</span>
                </div>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {!att
                    ? 'You have not clocked in yet today'
                    : att.clockOut
                      ? 'Workday completed'
                      : att.breakStartedAt
                        ? 'Currently on break'
                        : 'Currently clocked in'}
                </h3>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {!att && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleAttendanceAction('clock-in')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Clock in</span>
                  </button>
                )}

                {att && !att.clockOut && !att.breakStartedAt && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleAttendanceAction('break-start')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    <Coffee className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>Start break</span>
                  </button>
                )}

                {att && !att.clockOut && att.breakStartedAt && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleAttendanceAction('break-end')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    <Coffee className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>End break</span>
                  </button>
                )}

                {att && !att.clockOut && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleAttendanceAction('clock-out')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    <Square className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Clock out</span>
                  </button>
                )}
              </div>
            </div>

            {att && (
              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-slate-500">Clock in</div>
                  <div className="mt-1 font-mono font-medium text-slate-900 tabular-nums">
                    {formatTime(att.clockIn)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Break duration</div>
                  <div className="mt-1 font-mono font-medium text-slate-900 tabular-nums">
                    {att.breakMinutes} min
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Clock out</div>
                  <div className="mt-1 font-mono font-medium text-slate-900 tabular-nums">
                    {att.clockOut ? formatTime(att.clockOut) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Status &amp; Total</div>
                  <div className="mt-1 flex items-center gap-2">
                    <InlineStatus
                      label={att.status}
                      tone={att.status === AttendanceStatus.PRESENT ? 'green' : 'amber'}
                    />
                    {att.clockOut && (
                      <span className="font-mono text-slate-600 tabular-nums">
                        ({formatWorkedHours(att.clockIn, att.clockOut, att.breakMinutes)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* HR Pending Leave Queue */}
          {isHR && data.hrSummary && (
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Pending Leave Approvals
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Review employee time-off requests across all departments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('leave')}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  Open Leave Admin →
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {data.hrSummary.pendingLeaves.length === 0 ? (
                  <p className="py-6 text-xs text-slate-500 text-center">
                    No pending leave requests right now.
                  </p>
                ) : (
                  data.hrSummary.pendingLeaves.map((lr) => (
                    <div
                      key={lr.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">
                          {lr.employeeName}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            · {lr.departmentName || 'General'} · {lr.leaveType}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600 tabular-nums">
                          {formatDate(lr.startDate)} – {formatDate(lr.endDate)} (
                          {computeDaysInclusive(lr.startDate, lr.endDate)} day
                          {computeDaysInclusive(lr.startDate, lr.endDate) > 1 ? 's' : ''})
                          {lr.reason ? ` · "${lr.reason}"` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleQuickLeaveDecision(lr.id, 'Approved')}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleQuickLeaveDecision(lr.id, 'Rejected')}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Manager Submissions Awaiting Review */}
          {isManager && data.managerSummary && (
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Submissions Awaiting Review
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Submitted tasks ready for completion or rework feedback.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('projects-tasks')}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  Open Projects &amp; Tasks →
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {data.managerSummary.awaitingReviewTasks.length === 0 ? (
                  <p className="py-6 text-xs text-slate-500 text-center">
                    No submitted tasks waiting for your review.
                  </p>
                ) : (
                  data.managerSummary.awaitingReviewTasks.map((t) => (
                    <div
                      key={t.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{t.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {t.assigneeName} · {t.projectName} · Submitted{' '}
                          {t.submittedAt ? formatDate(t.submittedAt) : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('projects-tasks')}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        Review work
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* My Active Tasks (Employee & Manager) */}
          {!isHR && (
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">My Active Tasks</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pending acceptance, in-progress assignments, and rework items.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('my-tasks')}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  View all tasks →
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {activeTasks.length === 0 ? (
                  <p className="py-6 text-xs text-slate-500 text-center">
                    You have no pending or ongoing tasks assigned.
                  </p>
                ) : (
                  activeTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {task.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{task.projectName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{task.priority} priority</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Due {formatDate(task.dueDate)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <TaskStateLabel state={task.state} />
                        <span className="font-mono text-xs text-slate-600 tabular-nums">
                          {task.progressPercent}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Meetings & Holidays */}
        <div className="space-y-6">
          {/* Upcoming Meetings */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-900">Upcoming Meetings</h3>
              </div>
              {!isHR && (
                <button
                  type="button"
                  onClick={() => onNavigate('meetings')}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  All meetings
                </button>
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {data.upcomingMeetings.length === 0 ? (
                <p className="py-4 text-xs text-slate-500">No upcoming meetings scheduled.</p>
              ) : (
                data.upcomingMeetings.map((m) => (
                  <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="text-xs font-semibold text-slate-900">{m.title}</div>
                    <div className="mt-1 text-xs text-slate-500 tabular-nums">
                      {formatDate(m.meetingDate)} · {formatTime(m.meetingTime)} ·{' '}
                      {m.durationMinutes} min · {m.platform}
                    </div>
                    <a
                      href={m.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                    >
                      <span>Join meeting</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Published Holidays */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-900">Published Holidays</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('holidays')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                View all
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {data.upcomingHolidays.length === 0 ? (
                <p className="py-4 text-xs text-slate-500">No upcoming holidays published.</p>
              ) : (
                data.upcomingHolidays.map((h) => (
                  <div key={h.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{h.name}</div>
                      {h.description && (
                        <div className="mt-0.5 text-[11px] text-slate-500">{h.description}</div>
                      )}
                    </div>
                    <span className="font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDate(h.holidayDate)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
