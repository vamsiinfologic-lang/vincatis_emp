import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Edit3, Plus, Search, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDate } from '../lib/format';
import {
  Department,
  EmployeePerformanceSummary,
  EmployeeStatus,
  UserProfile,
  UserRole,
} from '../types';
import { InlineStatus } from './StatusBadge';

export function EmployeesView() {
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add / Edit Modal
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [status, setStatus] = useState<EmployeeStatus>(EmployeeStatus.ACTIVE);
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  // Performance Summary Modal
  const [perfSummary, setPerfSummary] = useState<EmployeePerformanceSummary | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        apiFetch<{ employees: UserProfile[] }>('/api/employees'),
        apiFetch<{ departments: Department[] }>('/api/departments'),
      ]);
      setEmployees(empRes.employees);
      setDepartments(deptRes.departments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load employees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    setName('');
    setEmail('');
    setTemporaryPassword('');
    setDesignation('');
    setPhone('');
    setDepartmentId(departments[0]?.id ?? '');
    setRole(UserRole.EMPLOYEE);
    setStatus(EmployeeStatus.ACTIVE);
    setJoiningDate(new Date().toISOString().slice(0, 10));
  };

  const openEditModal = (emp: UserProfile) => {
    setModalMode('edit');
    setEditingId(emp.id);
    setName(emp.name);
    setEmail(emp.email);
    setTemporaryPassword('');
    setDesignation(emp.designation);
    setPhone(emp.phone);
    setDepartmentId(emp.departmentId ?? '');
    setRole(emp.role);
    setStatus(emp.status);
    setJoiningDate(emp.joiningDate);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (modalMode === 'add') {
        await apiFetch('/api/employees', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            temporaryPassword,
            designation,
            phone,
            departmentId: departmentId === '' ? null : Number(departmentId),
            role,
            joiningDate,
          }),
        });
      } else if (modalMode === 'edit' && editingId) {
        await apiFetch(`/api/employees/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            designation,
            phone,
            departmentId: departmentId === '' ? null : Number(departmentId),
            role,
            status,
            ...(temporaryPassword.trim() ? { newPassword: temporaryPassword } : {}),
          }),
        });
      }
      setModalMode(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save employee.');
    } finally {
      setSaving(false);
    }
  };

  const openPerformance = async (empId: number) => {
    setPerfLoading(true);
    setPerfSummary(null);
    try {
      const res = await apiFetch<{ performance: EmployeePerformanceSummary }>(
        `/api/employees/${empId}/performance`
      );
      setPerfSummary(res.performance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load performance summary.');
    } finally {
      setPerfLoading(false);
    }
  };

  const filtered = employees.filter((emp) => {
    if (deptFilter !== 'All' && String(emp.departmentId ?? '') !== deptFilter) return false;
    if (roleFilter !== 'All' && emp.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !emp.name.toLowerCase().includes(q) &&
        !emp.email.toLowerCase().includes(q) &&
        !emp.employeeCode.toLowerCase().includes(q) &&
        !emp.designation.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Employees</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add employees with work email and temporary password, update records and departments,
            and review performance summaries.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors self-start whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add employee</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, email, or title..."
              className="w-full md:w-72 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              aria-label="Filter by department"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="All">All Roles</option>
              {Object.values(UserRole).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Joining Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading employee directory...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No employees match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {emp.employeeCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{emp.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {emp.designation} · {emp.email}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{emp.departmentName || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{emp.role}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDate(emp.joiningDate)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <InlineStatus
                        label={emp.status}
                        tone={
                          emp.status === EmployeeStatus.ACTIVE
                            ? 'green'
                            : emp.status === EmployeeStatus.ON_LEAVE
                              ? 'amber'
                              : 'red'
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openPerformance(emp.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <BarChart3 className="w-3 h-3 text-slate-500" aria-hidden="true" />
                          <span>Performance</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(emp)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="w-3 h-3 text-slate-500" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add / Edit Employee Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {modalMode === 'add' ? 'Add Employee' : 'Edit Employee Record'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Taylor"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Work email
                  </label>
                  <input
                    type="email"
                    required
                    disabled={modalMode === 'edit'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan.taylor@vems.work"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {modalMode === 'add' ? 'Temporary password' : 'Reset password (optional)'}
                  </label>
                  <input
                    type="password"
                    required={modalMode === 'add'}
                    minLength={6}
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    placeholder={modalMode === 'add' ? 'Min 6 characters' : 'Leave blank to keep'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Product Designer"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) =>
                      setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {Object.values(UserRole).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (415) 555-0100"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {modalMode === 'add' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Joining date
                    </label>
                    <input
                      type="date"
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      {Object.values(EmployeeStatus).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                  {saving ? 'Saving...' : modalMode === 'add' ? 'Create employee' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Performance Summary Modal */}
      {(perfLoading || perfSummary) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Employee Performance Summary
                </h3>
                {perfSummary && (
                  <p className="mt-1 text-xs text-slate-500">
                    {perfSummary.employee.name} · {perfSummary.employee.employeeCode} ·{' '}
                    {perfSummary.employee.departmentName || 'Unassigned'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPerfSummary(null);
                  setPerfLoading(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {perfLoading ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Computing employee metrics...
              </div>
            ) : (
              perfSummary && (
                <div className="mt-5 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="border border-slate-200 rounded-lg p-3.5">
                      <div className="text-[11px] text-slate-500">Tasks Finished</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                        {perfSummary.tasksFinished} / {perfSummary.tasksTotal}
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3.5">
                      <div className="text-[11px] text-slate-500">Avg Completion</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                        {perfSummary.avgCompletion}%
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3.5">
                      <div className="text-[11px] text-slate-500">Rework Requests</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                        {perfSummary.reworkCount}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">Task Breakdown</div>
                      <div className="mt-2 space-y-1 text-slate-600 tabular-nums">
                        <div>Pending: {perfSummary.tasksPending}</div>
                        <div>Ongoing: {perfSummary.tasksOngoing}</div>
                        <div>Finished: {perfSummary.tasksFinished}</div>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Attendance &amp; Leave</div>
                      <div className="mt-2 space-y-1 text-slate-600 tabular-nums">
                        <div>Present days: {perfSummary.presentDays}</div>
                        <div>Late days: {perfSummary.lateDays}</div>
                        <div>Approved leave days: {perfSummary.approvedLeaveDays}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
