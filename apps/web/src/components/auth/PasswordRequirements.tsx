/**
 * Live password requirements.
 *
 * The server enforces 12+ characters with upper, lower, digit and symbol
 * (FR-AUTH-08). Showing that only as a rejection after submit is the worst
 * possible time to say it: the user has already committed to a password and
 * now has to guess which of five rules they broke. Listing the rules and
 * ticking them off as they type turns a rejection into a checklist.
 *
 * Nothing here is enforcement - the DTO remains the authority. This is purely
 * about telling someone the rules before they need them.
 */

export interface PasswordRule {
  label: string;
  met: boolean;
}

export function evaluatePassword(password: string): PasswordRule[] {
  return [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'An uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', met: /[a-z]/.test(password) },
    { label: 'A number', met: /\d/.test(password) },
    { label: 'A symbol (like ! or ?)', met: /[^a-zA-Z0-9]/.test(password) },
  ];
}

export function isPasswordAcceptable(password: string): boolean {
  return evaluatePassword(password).every((rule) => rule.met);
}

export function PasswordRequirements({ password }: { password: string }) {
  const rules = evaluatePassword(password);
  const metCount = rules.filter((r) => r.met).length;

  return (
    <div className="mt-2">
      <ul className="space-y-1">
        {rules.map((rule) => (
          <li key={rule.label} className="flex items-center gap-2 text-xs">
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
                rule.met ? 'bg-emerald-100 text-emerald-600' : 'bg-ink-100 text-ink-400'
              }`}
              aria-hidden="true"
            >
              {rule.met ? (
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <span className="h-1 w-1 rounded-full bg-current" />
              )}
            </span>
            <span className={rule.met ? 'text-ink-500' : 'text-ink-600'}>{rule.label}</span>
          </li>
        ))}
      </ul>
      {/* One polite announcement of overall progress, rather than five separate
          ones firing on every keystroke. */}
      <span className="sr-only" role="status" aria-live="polite">
        {`${metCount} of ${rules.length} password requirements met`}
      </span>
    </div>
  );
}
