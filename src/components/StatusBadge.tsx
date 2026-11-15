import { AlertCircle, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import { TaskWorkflowState } from '../types';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate';

const TONE_CLASSES: Record<Tone, string> = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  blue: 'text-blue-700',
  slate: 'text-slate-600',
};

export function InlineStatus({
  label,
  tone,
}: {
  label: string;
  tone: Tone;
}) {
  const icon =
    tone === 'green' ? (
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    ) : tone === 'red' ? (
      <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    ) : tone === 'amber' ? (
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    ) : (
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    );

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

export function TaskStateLabel({ state }: { state: TaskWorkflowState }) {
  switch (state) {
    case TaskWorkflowState.ASSIGNED:
      return <InlineStatus label="Pending · Awaiting acceptance" tone="slate" />;
    case TaskWorkflowState.ACCEPTED:
      return <InlineStatus label="Pending · Accepted" tone="blue" />;
    case TaskWorkflowState.IN_PROGRESS:
      return <InlineStatus label="Ongoing · In progress" tone="blue" />;
    case TaskWorkflowState.SUBMITTED:
      return <InlineStatus label="Ongoing · Submitted for review" tone="amber" />;
    case TaskWorkflowState.REWORK_REQUESTED:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-amber-700">
          <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Ongoing · Rework requested</span>
        </span>
      );
    case TaskWorkflowState.COMPLETED:
      return <InlineStatus label="Finished · Completed" tone="green" />;
  }
}
