import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  MessageSquare,
  Paperclip,
  Play,
  RotateCcw,
  Send,
  Upload,
} from 'lucide-react';
import { apiFetch, uploadAttachment } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import { TaskAssignment, TaskFilterBucket, TaskWorkflowState } from '../types';
import { TaskStateLabel } from './StatusBadge';

interface MyTasksViewProps {
  onRefreshNotifications: () => void;
}

export function MyTasksView({ onRefreshNotifications }: MyTasksViewProps) {
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [filter, setFilter] = useState<TaskFilterBucket>(TaskFilterBucket.ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  // Per-task local form drafts
  const [progressDrafts, setProgressDrafts] = useState<Record<number, number>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [submissionNotes, setSubmissionNotes] = useState<Record<number, string>>({});
  const [submissionLinks, setSubmissionLinks] = useState<Record<number, string>>({});
  const [attachments, setAttachments] = useState<
    Record<number, { attachmentName: string; attachmentUrl: string }>
  >({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [expandedSubmitId, setExpandedSubmitId] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await apiFetch<{ tasks: TaskAssignment[] }>('/api/tasks?scope=mine');
      setTasks(res.tasks);
      setProgressDrafts((prev) => {
        const next = { ...prev };
        for (const t of res.tasks) {
          if (next[t.id] === undefined) {
            next[t.id] = t.progressPercent;
          }
        }
        return next;
      });
      setSubmissionNotes((prev) => {
        const next = { ...prev };
        for (const t of res.tasks) {
          if (next[t.id] === undefined && t.submissionNotes) {
            next[t.id] = t.submissionNotes;
          }
        }
        return next;
      });
      setSubmissionLinks((prev) => {
        const next = { ...prev };
        for (const t of res.tasks) {
          if (next[t.id] === undefined && t.submissionLink) {
            next[t.id] = t.submissionLink;
          }
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load assigned tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleTaskAction = async (taskId: number, action: 'accept' | 'start') => {
    setBusyTaskId(taskId);
    setError(null);
    try {
      await apiFetch(`/api/tasks/${taskId}/${action}`, { method: 'POST' });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleUpdateProgress = async (taskId: number) => {
    const val = progressDrafts[taskId] ?? 0;
    setBusyTaskId(taskId);
    setError(null);
    try {
      await apiFetch(`/api/tasks/${taskId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ progressPercent: val }),
      });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update progress.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleAddComment = async (taskId: number) => {
    const message = (commentDrafts[taskId] || '').trim();
    if (!message) return;
    setBusyTaskId(taskId);
    setError(null);
    try {
      await apiFetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      setCommentDrafts((prev) => ({ ...prev, [taskId]: '' }));
      await loadTasks();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleFileChange = async (taskId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(taskId);
    setError(null);
    try {
      const uploaded = await uploadAttachment(file);
      setAttachments((prev) => ({ ...prev, [taskId]: uploaded }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploadingId(null);
    }
  };

  const handleSubmitWork = async (taskId: number) => {
    setBusyTaskId(taskId);
    setError(null);
    try {
      const att = attachments[taskId];
      await apiFetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          submissionNotes: submissionNotes[taskId] || '',
          submissionLink: submissionLinks[taskId] || '',
          attachmentName: att?.attachmentName ?? null,
          attachmentUrl: att?.attachmentUrl ?? null,
        }),
      });
      setExpandedSubmitId(null);
      await loadTasks();
      onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit work.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const filtered = tasks.filter((t) =>
    filter === TaskFilterBucket.ALL ? true : t.bucket === filter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My Tasks</h2>
          <p className="mt-1 text-sm text-slate-600">
            Accept assigned work, track completion progress, communicate with your manager, and
            submit deliverables.
          </p>
        </div>

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
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          Loading your tasks...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <div className="text-sm font-medium text-slate-900">No tasks in {filter}</div>
          <p className="mt-1 text-xs text-slate-500">
            Tasks assigned to you by your Department Head or Team Lead will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((task) => {
            const isWorking =
              task.state === TaskWorkflowState.IN_PROGRESS ||
              task.state === TaskWorkflowState.REWORK_REQUESTED;
            const currentDraft = progressDrafts[task.id] ?? task.progressPercent;
            const uploaded = attachments[task.id];

            return (
              <article
                key={task.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
              >
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{task.projectName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{task.priority} priority</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">Due {formatDate(task.dueDate)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Assigned by {task.assignedByName}</span>
                    </div>
                    {task.description && (
                      <p className="mt-3 text-sm text-slate-700 leading-relaxed max-w-3xl">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 shrink-0">
                    <TaskStateLabel state={task.state} />
                    <div className="flex items-center gap-2">
                      <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-700 transition-all"
                          style={{ width: `${task.progressPercent}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-medium text-slate-700 tabular-nums">
                        {task.progressPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rework Feedback Banner */}
                {task.state === TaskWorkflowState.REWORK_REQUESTED && task.reworkFeedback && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Manager Feedback · Rework Requested</span>
                    </div>
                    <p className="mt-1.5 text-xs text-amber-900 leading-relaxed">
                      {task.reworkFeedback}
                    </p>
                  </div>
                )}

                {/* Pending Actions: Accept -> Start task */}
                {task.state === TaskWorkflowState.ASSIGNED && (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500">
                      Accept this assignment to confirm you have received it.
                    </span>
                    <button
                      type="button"
                      disabled={busyTaskId === task.id}
                      onClick={() => handleTaskAction(task.id, 'accept')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Accept</span>
                    </button>
                  </div>
                )}

                {task.state === TaskWorkflowState.ACCEPTED && (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500">
                      Task accepted. Select Start task when you begin working.
                    </span>
                    <button
                      type="button"
                      disabled={busyTaskId === task.id}
                      onClick={() => handleTaskAction(task.id, 'start')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Start task</span>
                    </button>
                  </div>
                )}

                {/* Active Work Controls: Progress + Submit Work */}
                {isWorking && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label
                          htmlFor={`progress-${task.id}`}
                          className="text-xs font-medium text-slate-700"
                        >
                          Completion %
                        </label>
                        <input
                          id={`progress-${task.id}`}
                          type="number"
                          min={0}
                          max={100}
                          value={currentDraft}
                          onChange={(e) =>
                            setProgressDrafts((prev) => ({
                              ...prev,
                              [task.id]: Math.max(0, Math.min(100, Number(e.target.value))),
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={busyTaskId === task.id}
                          onClick={() => handleUpdateProgress(task.id)}
                          className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap"
                        >
                          Update
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSubmitId((prev) => (prev === task.id ? null : task.id))
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors self-start whitespace-nowrap"
                      >
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {expandedSubmitId === task.id
                            ? 'Hide submission form'
                            : task.state === TaskWorkflowState.REWORK_REQUESTED
                              ? 'Resubmit work'
                              : 'Prepare work submission'}
                        </span>
                      </button>
                    </div>

                    {expandedSubmitId === task.id && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                        <div className="text-xs font-semibold text-slate-900">
                          Submit Task Deliverables
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Submission details
                          </label>
                          <textarea
                            rows={3}
                            value={submissionNotes[task.id] ?? ''}
                            onChange={(e) =>
                              setSubmissionNotes((prev) => ({ ...prev, [task.id]: e.target.value }))
                            }
                            placeholder="Summarize what you completed and any verification notes..."
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Work link (URL)
                            </label>
                            <input
                              type="url"
                              value={submissionLinks[task.id] ?? ''}
                              onChange={(e) =>
                                setSubmissionLinks((prev) => ({
                                  ...prev,
                                  [task.id]: e.target.value,
                                }))
                              }
                              placeholder="https://..."
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Attachment (optional, max 5 MB)
                            </label>
                            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50">
                              <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {uploadingId === task.id
                                  ? 'Uploading...'
                                  : uploaded?.attachmentName ||
                                    task.attachmentName ||
                                    'Choose file'}
                              </span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => handleFileChange(task.id, e)}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={busyTaskId === task.id || uploadingId === task.id}
                            onClick={() => handleSubmitWork(task.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
                          >
                            <span>Submit work</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Submitted / Completed Summary */}
                {(task.state === TaskWorkflowState.SUBMITTED ||
                  task.state === TaskWorkflowState.COMPLETED) && (
                  <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                    <div className="font-medium text-slate-900">Submitted Deliverable</div>
                    {task.submissionNotes && (
                      <p className="text-slate-600 leading-relaxed">{task.submissionNotes}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4">
                      {task.submissionLink && (
                        <a
                          href={task.submissionLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                        >
                          <span>Open work link</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                      {task.attachmentUrl && (
                        <a
                          href={task.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                        >
                          <Paperclip className="w-3 h-3" aria-hidden="true" />
                          <span>{task.attachmentName || 'Download attachment'}</span>
                        </a>
                      )}
                    </div>
                    {task.state === TaskWorkflowState.COMPLETED && task.reworkFeedback && (
                      <div className="pt-1 text-emerald-800">
                        Manager review note: {task.reworkFeedback}
                      </div>
                    )}
                  </div>
                )}

                {/* Comments Thread */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>Comments ({task.comments.length})</span>
                  </div>

                  {task.comments.length > 0 && (
                    <div className="space-y-2.5">
                      {task.comments.map((c) => (
                        <div key={c.id} className="text-xs bg-slate-50 rounded-lg px-3.5 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">
                              {c.authorName}{' '}
                              <span className="font-normal text-slate-500">· {c.authorRole}</span>
                            </span>
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              {formatDate(c.createdAt)} {formatTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-slate-700">{c.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {task.state !== TaskWorkflowState.COMPLETED && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentDrafts[task.id] ?? ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddComment(task.id);
                          }
                        }}
                        placeholder="Write a comment to your manager..."
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={busyTaskId === task.id || !(commentDrafts[task.id] || '').trim()}
                        onClick={() => handleAddComment(task.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Send</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
