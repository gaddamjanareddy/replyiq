import { type InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Field-level error. Rendered under the input and linked via aria-describedby. */
  error?: string | undefined;
  /** Persistent guidance shown when there is no error. */
  hint?: string | undefined;
}

/**
 * A text input that is accessible by construction rather than by convention:
 * the label is always associated, and the error and hint are wired through
 * aria-describedby so a screen-reader user hears the problem rather than
 * discovering the field is simply "invalid".
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-ink-700 mb-1.5">
            {label}
          </label>
        )}
        <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={[
              'w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink-900',
              'placeholder:text-ink-400 transition-colors',
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
