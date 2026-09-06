import { useState, useId } from 'react';

interface CopyButtonProps {
  value: string;
  /** Used in the accessible name: "Copy record value". */
  label?: string;
  className?: string;
}

async function writeToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Falls through to the manual path below.
  }
  // navigator.clipboard is unavailable on plain-HTTP origins, which is exactly
  // where a self-hosted evaluation runs. Rather than a dead button, select the
  // text so Ctrl+C works and say so.
  return false;
}

export function CopyButton({ value, label = 'value', className = '' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  const handleCopy = async () => {
    const ok = await writeToClipboard(value);
    setState(ok ? 'copied' : 'manual');
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className={`interactive inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink-300 bg-surface px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 ${className}`}
    >
      {state === 'copied' ? (
        <>
          <svg className="h-3.5 w-3.5 text-emerald-600 animate-pop" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied
        </>
      ) : state === 'manual' ? (
        'Press Ctrl+C'
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          Copy
        </>
      )}
      {/* Announce the result: a purely visual label change is invisible to a
          screen reader, and copying is exactly the moment a user needs to know
          it worked. */}
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'copied' ? `${label} copied` : state === 'manual' ? 'Select and press Ctrl+C' : ''}
      </span>
    </button>
  );
}

interface CopyFieldProps {
  label: string;
  value: string;
  /** Extra guidance under the value, e.g. "Some providers call this Host". */
  hint?: string;
  /** Wrap long values instead of scrolling. Right for a snippet, wrong for a token. */
  wrap?: boolean;
}

/**
 * A labelled, monospaced, one-click-copyable value.
 *
 * This is the single most important component in onboarding. Every failed
 * verification we can prevent is prevented here: the value is selectable, never
 * truncated with an ellipsis (which silently produces a wrong paste), and
 * carries its own copy button so nobody has to drag-select a 50-character
 * token in a text field.
 */
export function CopyField({ label, value, hint, wrap = false }: CopyFieldProps) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span id={id} className="text-xs font-medium uppercase tracking-wide text-ink-500">
          {label}
        </span>
        <CopyButton value={value} label={label.toLowerCase()} />
      </div>
      <code
        aria-labelledby={id}
        className={[
          'block rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-900 select-all',
          wrap ? 'whitespace-pre-wrap break-all' : 'overflow-x-auto whitespace-nowrap',
        ].join(' ')}
      >
        {value}
      </code>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
