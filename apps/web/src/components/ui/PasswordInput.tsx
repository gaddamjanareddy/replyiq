import { type InputHTMLAttributes, forwardRef, useId, useState } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string | undefined;
  hint?: string | undefined;
}

/**
 * A password field you can choose to read.
 *
 * This costs most at registration, where someone is inventing a password
 * against complexity rules they cannot see themselves satisfying. Failing that
 * blind is a real drop-off point, and "show password" is the cheapest fix in
 * the product.
 *
 * Three details that are easy to get wrong:
 *
 *  - The toggle is `type="button"`. A bare `<button>` inside a form defaults to
 *    `type="submit"`, so revealing the password would submit the form.
 *  - It is a real button in the tab order with an accessible name that changes
 *    with state, not an icon that only sighted mouse users can operate.
 *  - Revealed state is never the default and resets with the component, so a
 *    password is not left on screen after navigation.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const [revealed, setRevealed] = useState(false);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={revealed ? 'text' : 'password'}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={[
              'w-full rounded-lg border bg-white py-2 pl-3 pr-11 text-sm text-ink-900',
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
          <button
            // Not a submit button. Without this, showing the password submits
            // the form - which on a login page is a genuinely confusing bug.
            type="button"
            onClick={() => setRevealed((v) => !v)}
            // The name changes with state so a screen-reader user knows what
            // pressing it will do, rather than hearing "button" twice.
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="interactive absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-ink-400 hover:text-ink-700"
            // Keeps the toggle out of the tab path between the field and the
            // submit button; it stays reachable, just not in the way.
            tabIndex={-1}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              {revealed ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              ) : (
                <>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </>
              )}
            </svg>
          </button>
        </div>
        {error ? (
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

PasswordInput.displayName = 'PasswordInput';
