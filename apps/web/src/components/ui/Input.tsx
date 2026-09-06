import { type InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Field-level error. Rendered under the input and linked via aria-describedby. */
  error?: string | undefined;
  /** Persistent guidance shown when there is no error. */
  hint?: string | undefined;
  /**
   * Show a live character count against `maxLength`.
   *
   * A limit the user cannot see is a limit they discover by being rejected —
   * which is exactly how someone ends up typing a paragraph into a field
   * capped at 100 and only finding out on submit.
   */
  showCount?: boolean;
  /**
   * Offer a set of likely values while still accepting anything typed.
   *
   * A native `<datalist>` rather than a bespoke dropdown, deliberately. It is
   * keyboard-accessible and screen-reader-announced with no code of ours, it
   * never traps focus, and it degrades to a plain text field if anything goes
   * wrong. A hand-rolled combobox looks more designed and is one of the
   * easiest components in the world to get wrong for anyone not using a mouse.
   *
   * The point is to tell the user what SHAPE of answer is wanted — a short
   * label, not a paragraph — which suggestions do just by existing.
   */
  suggestions?: readonly string[];
}

/**
 * A text input that is accessible by construction rather than by convention:
 * the label is always associated, and the error and hint are wired through
 * aria-describedby so a screen-reader user hears the problem rather than
 * discovering the field is simply "invalid".
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, showCount, suggestions, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const listId = `${inputId}-options`;

    const max = typeof props.maxLength === 'number' ? props.maxLength : undefined;
    const used = typeof props.value === 'string' ? props.value.length : 0;
    // Only worth showing as the limit comes into view; a counter sitting at
    // 3/100 from the first keystroke is noise.
    const counterVisible = showCount && max !== undefined && used > max * 0.6;

    return (
      <div className="w-full">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={inputId} className="block text-sm font-medium text-ink-700">
              {label}
            </label>
          )}
          {counterVisible && (
            <span
              className={`text-xs tabular-nums ${
                used >= (max ?? 0) ? 'font-medium text-amber-700' : 'text-ink-500'
              }`}
              // Announced politely rather than on every keystroke, which would
              // make a screen reader unusable while typing.
              aria-live="polite"
              aria-atomic="true"
            >
              {used}/{max}
            </span>
          )}
        </div>
        <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            list={suggestions && suggestions.length > 0 ? listId : undefined}
            className={[
              'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink-900',
              'placeholder:text-ink-500 transition-colors',
              'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
              error
                ? 'border-red-400 focus-visible:outline-red-500'
                : 'border-ink-300 hover:border-ink-400',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
          {...props}
        />
        {suggestions && suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        )}
        {error ? (
          // aria-live so a validation message that appears after the fact is
          // announced, not silently painted.
          <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1.5 text-sm text-ink-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
