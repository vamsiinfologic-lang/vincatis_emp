import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  FolderPlus,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import {
  Department,
  Project,
  TaskAssignment,
  TaskFilterBucket,
  TaskPriority,
  TaskWorkflowState,
  UserProfile,
} from '../types';
import { TaskStateLabel } from './StatusBadge';

interface ProjectsTasksViewProps {
  user: UserProfile;
  onRefreshNotifications: () => void;
}

export function ProjectsTasksView({
  user,
  onRefreshNotifications,
}: ProjectsTasksViewProps) {
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [filter, setFilter] = useState<TaskFilterBucket>(TaskFilterBucket.ALL);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assign Task Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState<number>(user.departmentId ?? 0);
  const [projectId, setProjectId] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [description, setDescription] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // New Project Modal
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  // Review / Details Modal
  const [reviewTask, setReviewTask] = useState<TaskAssignment | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [commentText, setCommentText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, projRes, deptRes, empRes] = await Promise.all([
        apiFetch<{ tasks: TaskAssignment[] }>('/api/tasks?scope=team'),
        apiFetch<{ projects: Project[] }>('/api/projects'),
        apiFetch<{ departments: Department[] }>('/api/departments'),
        apiFetch<{ employees: UserProfile[] }>(
          `/api/employees${user.departmentId ? `?departmentId=${user.departmentId}` : ''}`
        ),
      ]);
      setTasks(tasksRes.tasks);
      setProjects(projRes.projects);
      setDepartments(deptRes.departments);
      setEmployees(empRes.employees);

      if (projRes.projects.length > 0 && projectId === 0) {
        setProjectId(projRes.projects[0].id);
      }
      if (!departmentId && deptRes.departments.length > 0) {
        setDepartmentId(user.departmentId ?? deptRes.departments[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load team tasks.');
    } finally {
      setLoading(false);
    }
  }, [user.departmentId, departmentId, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleEmployee = (empId: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployeeIds.length === 0) {
      setError('Select at least one employee to assign this task.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          departmentId,
          projectId,
          title,
          priority,
          dueDate,
          description,
          assigneeIds: selectedEmployeeIds,
        }),
      });
      setAssignModalOpen(false);
      setTitle('');
      setDescription('');
      setSelectedEmployeeIds([]);
      await loadData();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign task.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ id: number }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjName,
          departmentId: departmentId || user.departmentId,
          description: newProjDesc,
        }),
      });
      setProjectModalOpen(false);
      setNewProjName('');
      setNewProjDesc('');
      setProjectId(res.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewDecision = async (decision: 'complete' | 'rework') => {
    if (!reviewTask) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/tasks/${reviewTask.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          feedback: reviewFeedback,
        }),
      });
      setReviewTask(null);
      setReviewFeedback('');
      await loadData();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review action failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendManagerComment = async () => {
    if (!reviewTask || !commentText.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/tasks/${reviewTask.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message: commentText }),
      });
      setCommentText('');
      const refreshed = await apiFetch<{ tasks: TaskAssignment[] }>('/api/tasks?scope=team');
      setTasks(refreshed.tasks);
      const updated = refreshed.tasks.find((t) => t.id === reviewTask.id) ?? null;
      setReviewTask(updated);
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send comment.');
    } finally {
      setSaving(false);
    }
  };

  const deptProjects = projects.filter((p) => !departmentId || p.departmentId === departmentId);

  const filteredTasks = tasks.filter((t) => {
    if (filter !== TaskFilterBucket.ALL && t.bucket !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.assigneeName.toLowerCase().includes(q) &&
        !t.projectName.toLowerCase().includes(q)
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
          <h2 className="text-xl font-semibold text-slate-900">Projects &amp; Tasks</h2>
          <p className="mt-1 text-sm text-slate-600">
            Assign tasks to department employees, track progress across Pending, Ongoing, and
            Finished states, and review submitted work.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setProjectModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>New project</span>
          </button>
          <button
            type="button"
            onClick={() => setAssignModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Assign task</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {Object.values(TaskFilterBucket).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task, project, or assignee..."
            className="w-full sm:w-64 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Task Assignment Cards */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          Loading team assignments...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <div className="text-sm font-medium text-slate-900">No assignments match {filter}</div>
          <p className="mt-1 text-xs text-slate-500">
            Select Assign task to delegate work to members of your department.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const awaitingReview = task.state === TaskWorkflowState.SUBMITTED;
            return (
              <article
                key={task.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                    <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                      {task.priority}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {task.projectName} · Due{' '}
                    <span className="tabular-nums">{formatDate(task.dueDate)}</span>
                  </div>

                  {task.description && (
                    <p className="mt-2.5 text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-medium text-slate-900">{task.assigneeName}</span>
                      <span className="text-slate-500"> · {task.assigneeDesignation}</span>
                    </div>
                    <span className="font-mono font-medium text-slate-800 tabular-nums">
                      {task.progressPercent}%
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-700 transition-all"
                      style={{ width: `${task.progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <TaskStateLabel state={task.state} />

                    <button
                      type="button"
                      onClick={() => {
                        setReviewTask(task);
                        setReviewFeedback('');
                        setCommentText('');
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        awaitingReview
                          ? 'bg-blue-700 text-white hover:bg-blue-800'
                          : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {awaitingReview ? 'Review submission' : 'Inspect & comment'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Assign Task Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Assign Task</h3>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Project</label>
                  <select
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {deptProjects.length === 0 ? (
                      <option value={0}>No projects in department</option>
                    ) : (
                      deptProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Task title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Finalize Q4 API Rate Limiter Tests"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {Object.values(TaskPriority).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Due date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Requirements, deliverables, and acceptance expectations..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Select employees ({selectedEmployeeIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-slate-50"
                    >
                      <div>
                        <span className="font-medium text-slate-900">{emp.name}</span>
                        <span className="text-slate-500"> · {emp.designation}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.id)}
                        onChange={() => handleToggleEmployee(emp.id)}
                        className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || deptProjects.length === 0}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {projectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Create Project</h3>
              <button
                type="button"
                onClick={() => setProjectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Project name
                </label>
                <input
                  type="text"
                  required
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="e.g. Payroll Readiness Phase 1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? 'Creating...' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review / Inspect Modal */}
      {reviewTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 shadow-xl my-8 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{reviewTask.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Assigned to {reviewTask.assigneeName} · {reviewTask.projectName} · Due{' '}
                  {formatDate(reviewTask.dueDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewTask(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs border-y border-slate-100 py-3">
              <TaskStateLabel state={reviewTask.state} />
              <span className="font-mono font-medium text-slate-800 tabular-nums">
                Completion: {reviewTask.progressPercent}%
              </span>
            </div>

            {/* Submission details */}
            {(reviewTask.submissionNotes ||
              reviewTask.submissionLink ||
              reviewTask.attachmentUrl) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <div className="font-semibold text-slate-900">Employee Submission</div>
                {reviewTask.submissionNotes && (
                  <p className="text-slate-700 leading-relaxed">{reviewTask.submissionNotes}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  {reviewTask.submissionLink && (
                    <a
                      href={reviewTask.submissionLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                    >
                      <span>Open work link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {reviewTask.attachmentUrl && (
                    <a
                      href={reviewTask.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>{reviewTask.attachmentName || 'Download attachment'}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-900">
                Comments ({reviewTask.comments.length})
              </div>
              {reviewTask.comments.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {reviewTask.comments.map((c) => (
                    <div key={c.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{c.authorName}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {formatDate(c.createdAt)} {formatTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700">{c.message}</p>
                    </div>
                  ))}
                </div>
              )}
              {reviewTask.state !== TaskWorkflowState.COMPLETED && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment for the assignee..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={saving || !commentText.trim()}
                    onClick={handleSendManagerComment}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send</span>
                  </button>
                </div>
              )}
            </div>

            {/* Review Decision Controls */}
            {reviewTask.state === TaskWorkflowState.SUBMITTED && (
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Review feedback (required if requesting rework)
                  </label>
                  <textarea
                    rows={3}
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    placeholder="Share approval notes or specific changes needed for rework..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleReviewDecision('rework')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Request rework</span>
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleReviewDecision('complete')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Complete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
