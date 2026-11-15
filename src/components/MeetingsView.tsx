import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Clock, ExternalLink, Plus, Video, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import { Department, DepartmentMeeting, UserProfile, UserRole } from '../types';

interface MeetingsViewProps {
  user: UserProfile;
  onRefreshNotifications: () => void;
}

export function MeetingsView({ user, onRefreshNotifications }: MeetingsViewProps) {
  const canSchedule =
    user.role === UserRole.DEPARTMENT_HEAD ||
    user.role === UserRole.TEAM_LEAD ||
    user.role === UserRole.HR;

  const [meetings, setMeetings] = useState<DepartmentMeeting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [departmentId, setDepartmentId] = useState<number>(user.departmentId ?? 0);
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('Google Meet');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [description, setDescription] = useState('');

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, dRes] = await Promise.all([
        apiFetch<{ meetings: DepartmentMeeting[] }>('/api/meetings'),
        apiFetch<{ departments: Department[] }>('/api/departments'),
      ]);
      setMeetings(mRes.meetings);
      setDepartments(dRes.departments);
      if (!departmentId && dRes.departments.length > 0) {
        setDepartmentId(user.departmentId ?? dRes.departments[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load meetings.');
    } finally {
      setLoading(false);
    }
  }, [departmentId, user.departmentId]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          departmentId,
          title,
          platform,
          meetingLink,
          meetingDate,
          meetingTime,
          durationMinutes,
          description,
        }),
      });
      setModalOpen(false);
      setTitle('');
      setMeetingLink('');
      setDescription('');
      await loadMeetings();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to schedule meeting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {canSchedule ? 'Department Meetings' : 'Meetings'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {canSchedule
              ? 'Schedule department meetings and distribute meeting links directly to team notifications.'
              : 'Upcoming and scheduled meetings for your department.'}
          </p>
        </div>

        {canSchedule && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors self-start whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Schedule meeting</span>
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          Loading meetings...
        </div>
      ) : meetings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <div className="text-sm font-medium text-slate-900">No meetings scheduled</div>
          <p className="mt-1 text-xs text-slate-500">
            Scheduled department meetings and video links will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((m) => (
            <article
              key={m.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">{m.title}</h3>
                  <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                    {m.platform}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>{formatDate(m.meetingDate)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>
                      {formatTime(m.meetingTime)} ({m.durationMinutes} min)
                    </span>
                  </span>
                </div>

                {m.description && (
                  <p className="mt-3 text-xs text-slate-600 leading-relaxed">{m.description}</p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500 truncate">
                  {m.departmentName} · Host: {m.scheduledByName}
                </div>
                <a
                  href={m.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <Video className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Join meeting</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Schedule Department Meeting
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSchedule} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Google Meet">Google Meet</option>
                    <option value="Zoom">Zoom</option>
                    <option value="Microsoft Teams">Microsoft Teams</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Meeting title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sprint Planning & Architecture Review"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Meeting link
                </label>
                <input
                  type="url"
                  required
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Agenda items or preparation notes..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? 'Sending...' : 'Send meeting link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
