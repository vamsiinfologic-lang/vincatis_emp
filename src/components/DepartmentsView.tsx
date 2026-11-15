import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { Department, UserProfile } from '../types';

export function DepartmentsView() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [headId, setHeadId] = useState<number | ''>('');
  const [annualBudget, setAnnualBudget] = useState<string>('500000');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, empRes] = await Promise.all([
        apiFetch<{ departments: Department[] }>('/api/departments'),
        apiFetch<{ employees: UserProfile[] }>('/api/employees'),
      ]);
      setDepartments(deptRes.departments);
      setEmployees(empRes.employees);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load departments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setModalMode('add');
    setEditingId(null);
    setName('');
    setHeadId('');
    setAnnualBudget('500000');
  };

  const openEdit = (d: Department) => {
    setModalMode('edit');
    setEditingId(d.id);
    setName(d.name);
    setHeadId(d.headId ?? '');
    setAnnualBudget(String(d.annualBudget));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (modalMode === 'add') {
        await apiFetch('/api/departments', {
          method: 'POST',
          body: JSON.stringify({
            name,
            headId: headId === '' ? null : Number(headId),
            annualBudget: Number(annualBudget) || 0,
          }),
        });
      } else if (modalMode === 'edit' && editingId) {
        await apiFetch(`/api/departments/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            headId: headId === '' ? null : Number(headId),
            annualBudget: Number(annualBudget) || 0,
          }),
        });
      }
      setModalMode(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Departments</h2>
          <p className="mt-1 text-sm text-slate-600">
            Configure company departments, assign department heads, and manage annual budgets.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors self-start whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add department</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          Loading departments...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <article
              key={dept.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">{dept.name}</h3>
                  <button
                    type="button"
                    onClick={() => openEdit(dept)}
                    aria-label={`Edit ${dept.name}`}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Department Head:{' '}
                  <span className="font-medium text-slate-800">
                    {dept.headName || 'Not assigned'}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500">Active Employees</div>
                  <div className="mt-1 font-mono font-semibold text-slate-900 tabular-nums">
                    {dept.employeeCount}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Annual Budget</div>
                  <div className="mt-1 font-mono font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(dept.annualBudget)}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {modalMode === 'add' ? 'Add Department' : 'Edit Department'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Department name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Finance & Legal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Department head
                </label>
                <select
                  value={headId}
                  onChange={(e) => setHeadId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Select department head...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Annual budget (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  required
                  value={annualBudget}
                  onChange={(e) => setAnnualBudget(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : modalMode === 'add' ? 'Create department' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
