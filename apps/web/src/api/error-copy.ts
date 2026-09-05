/**
 * The single place where a machine-readable error `code` becomes words a person
 * reads (NFR-USE-05, Goal G4).
 *
 * The backend's `message` field is developer-facing and is NEVER rendered. It
 * exists for logs. Everything here was written for the person who hit the
 * problem, and follows four rules:
 *
 *   1. Say what happened, in their words - never "challenge record",
 *      "enum", "token", "422".
 *   2. Name the likely cause when there is one. "Usually a copy-paste that
 *      picked up a space" turns a dead end into a two-second fix.
 *   3. End with something they can do.
 *   4. Never blame them for our problems, and never claim they did something
 *      wrong when we simply have not found it yet.
 *
 * An unknown code falls back to the generic message rather than leaking
 * whatever the backend said - so a new backend code is a missing-copy bug, not
 * a jargon leak. `error-copy.test.ts` asserts every shipped code has an entry.
 */

export interface ErrorCopy {
  /** One line, shown as the banner headline. */
  title: string;
  /** Optional second line: the likely cause, or what to expect. */
  detail?: string;
  /** Label for the action that resolves it, when one exists. */
  action?: string;
  /** Whether retrying the same operation could plausibly succeed. */
  retryable: boolean;
  /** Visual weight. `info` is used for states that are not problems at all. */
  tone: 'info' | 'warning' | 'error';
}

export const ERROR_COPY: Record<string, ErrorCopy> = {
  // ── Authentication ──────────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: {
    title: "That email or password doesn't match our records.",
    // Deliberately does not say which one was wrong (FR-AUTH-09): telling an
    // attacker "the password was wrong" confirms the account exists.
    detail: 'Check both and try again.',
    action: 'Try again',
    retryable: true,
    tone: 'error',
  },
  AUTH_UNAUTHENTICATED: {
    title: "You've been signed out.",
    detail: 'For your security, please sign in again.',
    action: 'Sign in',
    retryable: false,
    tone: 'warning',
  },
  AUTH_REFRESH_INVALID: {
    title: 'Your session is no longer valid.',
    detail: 'This happens after a long gap, or if you signed out on another device.',
    action: 'Sign in',
    retryable: false,
    tone: 'warning',
  },
  AUTH_EMAIL_TAKEN: {
    title: 'That email already has an account.',
    detail: 'Sign in instead, or use a different email address.',
    action: 'Sign in',
    retryable: false,
    tone: 'error',
  },

  // ── Authorization and lookup ────────────────────────────────────────────
  AUTHZ_FORBIDDEN: {
    title: "You don't have permission to do that.",
    detail: 'Ask an owner or admin on your team to make this change.',
    retryable: false,
    tone: 'error',
  },
  RESOURCE_NOT_FOUND: {
    title: "We couldn't find that.",
    detail: 'It may have been removed, or you may not have access to it.',
    action: 'Back to dashboard',
    retryable: false,
    tone: 'error',
  },

  // ── Request problems ────────────────────────────────────────────────────
  VALIDATION_FAILED: {
    title: 'Some details need a second look.',
    detail: "We've highlighted the fields that need changing.",
    retryable: true,
    tone: 'error',
  },
  RATE_LIMITED: {
    title: "You're going a little fast for us.",
    detail: 'Give it a minute, then try again.',
    action: 'Wait and retry',
    retryable: true,
    tone: 'warning',
  },

  // ── Domains ─────────────────────────────────────────────────────────────
  DOMAIN_NOT_FOUND: {
    title: "We couldn't find that domain.",
    detail: 'It may have been removed already.',
    retryable: false,
    tone: 'error',
  },
  DOMAIN_ALREADY_REGISTERED: {
    title: 'That domain is already connected to an account.',
    detail:
      "If it's your website and this looks wrong, contact support and we'll sort it out.",
    action: 'Try a different domain',
    retryable: false,
    tone: 'error',
  },
  DOMAIN_ALREADY_VERIFIED: {
    title: 'This domain is already verified.',
    detail: 'Nothing more to do here.',
    action: 'Continue',
    retryable: false,
    tone: 'info',
  },
  DOMAIN_VERIFICATION_PENDING: {
    title: "We haven't found your verification yet.",
    detail:
      'This is completely normal right after adding a DNS record or a snippet — it can take a few minutes, occasionally longer.',
    action: 'Check again',
    retryable: true,
    tone: 'warning',
  },
  DOMAIN_VERIFICATION_MISMATCH: {
    title: "We found something, but it doesn't match.",
    detail:
      'Almost always a copy-paste that picked up an extra space or dropped a character. Copy the value again using the button, then retry.',
    action: 'Try again',
    retryable: true,
    tone: 'error',
  },
  DOMAIN_SANDBOX_NOT_ELIGIBLE: {
    title: 'Test verification only works on test domains.',
    detail:
      "Real domains need a DNS record or a snippet on the site — that's what proves you own them.",
    action: 'Choose DNS or website',
    retryable: false,
    tone: 'error',
  },
  DOMAIN_SANDBOX_ONLY: {
    title: 'This is a test domain, so it verifies instantly.',
    detail: "Test domains aren't real websites, so there's nothing for us to check.",
    action: 'Use test verification',
    retryable: false,
    tone: 'info',
  },
  DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED: {
    title: 'This is your only verified website.',
    detail:
      'Removing it will take your AI receptionist offline until you verify another one.',
    action: 'Confirm removal',
    retryable: false,
    tone: 'warning',
  },

  // ── Onboarding ──────────────────────────────────────────────────────────
  ONBOARDING_STEP_OUT_OF_ORDER: {
    title: "Let's finish the step before this one first.",
    detail: "We've taken you back to it.",
    retryable: false,
    tone: 'warning',
  },
  ONBOARDING_ALREADY_COMPLETED: {
    title: "You're all set — setup is already complete.",
    action: 'Go to dashboard',
    retryable: false,
    tone: 'info',
  },
  ONBOARDING_NO_DOMAIN: {
    title: 'Add your website first.',
    detail: 'We need to know which website your receptionist will work on.',
    retryable: false,
    tone: 'warning',
  },
  ONBOARDING_NO_VERIFIED_DOMAIN: {
    title: 'Verify your website first.',
    detail: 'One verified website is all we need to finish setup.',
    retryable: false,
    tone: 'warning',
  },

  // ── Deprecated codes, retained so an older client never falls back to the
  //    generic message. The backend no longer emits either.
  DOMAIN_VERIFICATION_FAILED: {
    title: "We found something, but it doesn't match.",
    detail: 'Copy the value again using the button, then retry.',
    action: 'Try again',
    retryable: true,
    tone: 'error',
  },
  DOMAIN_LAST_VERIFIED: {
    title: 'This is your only verified website.',
    detail: 'Removing it will take your AI receptionist offline.',
    retryable: false,
    tone: 'warning',
  },

  // ── Catch-alls ──────────────────────────────────────────────────────────
  INTERNAL_ERROR: {
    title: 'Something went wrong on our end.',
    detail: "This isn't something you did. Please try again in a moment.",
    action: 'Try again',
    retryable: true,
    tone: 'error',
  },
  NETWORK_ERROR: {
    title: "We couldn't reach ReplyIQ.",
    detail: 'Check your internet connection and try again.',
    action: 'Try again',
    retryable: true,
    tone: 'error',
  },
};

export const FALLBACK_COPY: ErrorCopy = {
  title: 'Something went wrong.',
  detail: 'Please try again. If it keeps happening, contact support.',
  action: 'Try again',
  retryable: true,
  tone: 'error',
};

export function copyForCode(code: string | undefined): ErrorCopy {
  if (!code) return FALLBACK_COPY;
  return ERROR_COPY[code] ?? FALLBACK_COPY;
}
