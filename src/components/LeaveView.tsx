import React, { useCallback, useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { computeDaysInclusive, formatDate } from '../lib/format';
import { LeaveRequest, LeaveStatus, LeaveType, UserProfile, UserRole } from '../types';
import { InlineStatus } from './StatusBadge';

interface LeaveViewProps {
  user: UserProfile;
  onRefreshNotifications: () => void;
}

export function LeaveView({ user, onRefreshNotifications }: LeaveViewProps) {
  const isHR = user.role === UserRole.HR;
  const [scope, setScope] = useState<'org' | 'self'>(isHR ? 'org' : 'self');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | LeaveStatus>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New leave request form
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.ANNUAL);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // HR review note modal state
  const [reviewingItem, setReviewingItem] = useState<{
    request: LeaveRequest;
    decision: 'Approved' | 'Rejected';
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const loadLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ requests: LeaveRequest[] }>(`/api/leave?scope=${scope}`);
      setRequests(res.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadLeave();
  }, [loadLeave]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch('/api/leave', {
        method: 'POST',
        body: JSON.stringify({ leaveType, startDate, endDate, reason }),
      });
      setReason('');
      setSuccessMsg('Leave request submitted and marked Pending for HR review.');
      await loadLeave();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/leave/${reviewingItem.request.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision: reviewingItem.decision,
          reviewNote,
        }),
      });
      setReviewingItem(null);
      setReviewNote('');
      await loadLeave();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to review leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = requests.filter((r) =>
    statusFilter === 'All' ? true : r.status === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {isHR && scope === 'org' ? 'Leave Administration' : 'Leave Requests'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {isHR && scope === 'org'
              ? 'Inspect employee leave requests across the organization and approve or reject them.'
              : 'Apply for Annual, Sick, Personal, or Unpaid leave and track HR approval status.'}
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
              All Requests
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
              My Requests
            </button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {successMsg}
        </div>
      )}

      <div className={`grid grid-cols-1 ${scope === 'self' ? 'lg:grid-cols-3' : ''} gap-6 items-start`}>
        {/* Apply Form (when in self mode or non-HR) */}
        {scope === 'self' && (
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-slate-900">Apply for Leave</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Submitted requests are reviewed by HR.
            </p>

            <form onSubmit={handleSubmitLeave} className="mt-5 space-y-4">
              <div>
                <label htmlFor="leave-type" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Leave type
                </label>
                <select
                  id="leave-type"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {Object.values(LeaveType).map((lt) => (
                    <option key={lt} value={lt}>
                      {lt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="leave-start" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Start date
                  </label>
                  <input
                    id="leave-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (e.target.value > endDate) setEndDate(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="leave-end" className="block text-xs font-medium text-slate-700 mb-1.5">
                    End date
                  </label>
                  <input
                    id="leave-end"
                    type="date"
                    required
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="leave-reason" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Reason (optional)
                </label>
                <textarea
                  id="leave-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Share context for your leave request..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{submitting ? 'Submitting...' : 'Submit request'}</span>
              </button>
            </form>
          </section>
        )}

        {/* Requests List */}
        <section
          className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${
            scope === 'self' ? 'lg:col-span-2' : ''
          }`}
        >
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {scope === 'org' ? 'Organization Leave Requests' : 'Your requests'}
            </h3>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              {(['All', LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      statusFilter === tab
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading leave requests...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No leave requests found under this filter.
              </div>
            ) : (
              filtered.map((req) => {
                const days = computeDaysInclusive(req.startDate, req.endDate);
                return (
                  <div
                    key={req.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {scope === 'org' && (
                          <>
                            <span className="text-sm font-semibold text-slate-900">
                              {req.employeeName}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-600">
                              {req.departmentName || 'General'}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                          </>
                        )}
                        <span className="text-sm font-semibold text-slate-900">
                          {req.leaveType} Leave
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-600 tabular-nums">
                        {formatDate(req.startDate)} – {formatDate(req.endDate)} · {days} day
                        {days > 1 ? 's' : ''} · Submitted {formatDate(req.createdAt)}
                      </div>

                      {req.reason && (
                        <p className="mt-2 text-xs text-slate-700 leading-relaxed">{req.reason}</p>
                      )}

                      {req.reviewNote && (
                        <p className="mt-2 text-xs text-slate-500">
                          HR note ({req.reviewedByName}): {req.reviewNote}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <InlineStatus
                        label={req.status}
                        tone={
                          req.status === LeaveStatus.APPROVED
                            ? 'green'
                            : req.status === LeaveStatus.REJECTED
                              ? 'red'
                              : 'amber'
                        }
                      />

                      {isHR && scope === 'org' && req.status === LeaveStatus.PENDING && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingItem({ request: req, decision: 'Approved' });
                              setReviewNote('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingItem({ request: req, decision: 'Rejected' });
                              setReviewNote('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* HR Review Note Modal */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {reviewingItem.decision === 'Approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              {reviewingItem.request.employeeName} · {reviewingItem.request.leaveType} (
              {formatDate(reviewingItem.request.startDate)} –{' '}
              {formatDate(reviewingItem.request.endDate)})
            </p>

            <form onSubmit={handleConfirmReview} className="mt-4 space-y-4">
              <div>
                <label htmlFor="hr-review-note" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Review note (optional)
                </label>
                <textarea
                  id="hr-review-note"
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Add an optional note for the employee..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingItem(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-60 ${
                    reviewingItem.decision === 'Approved'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-red-700 hover:bg-red-800'
                  }`}
                >
                  {submitting ? 'Saving...' : `Confirm ${reviewingItem.decision}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
