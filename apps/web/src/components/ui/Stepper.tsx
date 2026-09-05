import type { ReactNode } from 'react';

export interface StepDescriptor {
  key: string;
  label: string;
  /** One line explaining what this step is for, shown on the active step. */
  summary?: string | undefined;
  completed: boolean;
}

interface StepperProps {
  steps: StepDescriptor[];
  /** Index currently being displayed. */
  current: number;
  /** Highest index the user is allowed to open (the first incomplete step). */
  furthestReachable: number;
  onSelect: (index: number) => void;
}

/**
 * The onboarding progress rail.
 *
 * Completed steps are clickable so a user can go back and change an answer
 * without losing later progress; steps ahead of the frontier are not, because
 * the server enforces ordering anyway and offering a control that will be
 * refused is a small lie. That distinction is expressed to assistive tech via
 * `aria-disabled` and `aria-current`, not just by colour.
 */
export function Stepper({ steps, current, furthestReachable, onSelect }: StepperProps) {
  return (
    <ol className="space-y-1.5" aria-label="Setup steps">
      {steps.map((step, index) => {
        const isCurrent = index === current;
        const reachable = index <= furthestReachable;
        const interactive = reachable && !isCurrent;

        return (
          <li key={step.key}>
            <button
              type="button"
              onClick={interactive ? () => onSelect(index) : undefined}
              disabled={!interactive}
              aria-current={isCurrent ? 'step' : undefined}
              className={[
                'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                isCurrent
                  ? 'border-brand-300 bg-brand-50'
                  : step.completed
                    ? 'border-ink-200 bg-white hover:border-brand-200 hover:bg-brand-50/40'
                    : 'border-ink-200 bg-white',
                interactive ? 'cursor-pointer' : 'cursor-default',
              ].join(' ')}
            >
              <StepMarker index={index} completed={step.completed} current={isCurrent} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${
                    isCurrent ? 'text-brand-900' : step.completed ? 'text-ink-900' : 'text-ink-500'
                  }`}
                >
                  {step.label}
                </span>
                {isCurrent && step.summary && (
                  <span className="mt-0.5 block text-xs text-brand-700">{step.summary}</span>
                )}
                {!isCurrent && step.completed && (
                  <span className="mt-0.5 block text-xs text-ink-500">Done — tap to review</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepMarker({
  index,
  completed,
  current,
}: {
  index: number;
  completed: boolean;
  current: boolean;
}): ReactNode {
  const base = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold';
  if (completed) {
    return (
      <span className={`${base} bg-emerald-100 text-emerald-700`} aria-hidden="true">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`${base} ${current ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500'}`}
      aria-hidden="true"
    >
      {index + 1}
    </span>
  );
}

/** Thin progress bar summarising the same state above the step list. */
export function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Setup progress"
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
    >
      <div
        className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
