import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDate } from '../lib/format';
import { CompanyHoliday, UserProfile, UserRole } from '../types';

interface HolidaysViewProps {
  user: UserProfile;
  onRefreshNotifications: () => void;
}

export function HolidaysView({ user, onRefreshNotifications }: HolidaysViewProps) {
  const isHR = user.role === UserRole.HR;
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [holidayDate, setHolidayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ holidays: CompanyHoliday[] }>('/api/holidays');
      setHolidays(res.holidays);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load holidays.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/holidays', {
        method: 'POST',
        body: JSON.stringify({ name, holidayDate, description }),
      });
      setModalOpen(false);
      setName('');
      setDescription('');
      await loadHolidays();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish holiday.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/holidays/${id}`, { method: 'DELETE' });
      await loadHolidays();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete holiday.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Company Holidays</h2>
          <p className="mt-1 text-sm text-slate-600">
            {isHR
              ? 'Publish official company holidays and notify everyone in the workspace.'
              : 'Published company holidays across all departments.'}
          </p>
        </div>

        {isHR && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors self-start whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add holiday</span>
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading company holidays...</div>
        ) : holidays.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-sm font-medium text-slate-900">No holidays published yet</div>
            <p className="mt-1 text-xs text-slate-500">
              Holidays published by HR will appear here for the entire organization.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {holidays.map((h) => (
              <div
                key={h.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{h.name}</div>
                    {h.description && (
                      <p className="mt-0.5 text-xs text-slate-600">{h.description}</p>
                    )}
                    <div className="mt-1 text-[11px] text-slate-400">
                      Published by {h.publishedByName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-mono text-xs font-medium text-slate-800 tabular-nums">
                    {formatDate(h.holidayDate)}
                  </span>
                  {isHR && (
                    <button
                      type="button"
                      onClick={() => handleDelete(h.id)}
                      aria-label={`Remove ${h.name}`}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Publish Company Holiday</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublish} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Holiday name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. New Year's Day"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Company-wide observance details..."
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
                  {saving ? 'Publishing...' : 'Publish holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
