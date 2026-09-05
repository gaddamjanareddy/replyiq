/**
 * The set of verification methods this process will accept, decided once at
 * boot.
 *
 * ── Why this module exists ────────────────────────────────────────────────
 * `DEV_BYPASS` must be, in production, *indistinguishable from a typo*. The
 * obvious implementation - accept it in the DTO, then reject it later with a
 * carefully hand-crafted error that mimics a validation failure - is a thing
 * that can be got subtly wrong (a different message, a different status, a
 * different field order) and whose correctness must be re-verified after every
 * refactor.
 *
 * Instead, the gate decides *what the enum is*. In production `DEV_BYPASS` is
 * not "a method that gets rejected"; it is not a method at all, and it is
 * refused by the same ValidationPipe, on the same line, with the same body, as
 * `HAMSTER`. Indistinguishability is structural rather than maintained.
 *
 * ── Fail-closed ───────────────────────────────────────────────────────────
 * Both conditions must hold, and anything ambiguous (missing variable,
 * unexpected value, wrong case) resolves to "disabled".
 *
 * ── Fail-loud ─────────────────────────────────────────────────────────────
 * A production build configured with the bypass enabled refuses to boot
 * (`assertVerificationBypassNotEnabledInProduction`). A silent misconfiguration
 * that quietly weakens verification forever is the exact failure this whole
 * design is built to prevent, so it is made impossible to deploy instead of
 * merely unlikely.
 */

/** Methods that always exist, in every environment. */
export const ALWAYS_AVAILABLE_METHODS = ['DNS_TXT', 'HTML_META', 'SANDBOX'] as const;

/** The non-production-only method. */
export const DEV_BYPASS_METHOD = 'DEV_BYPASS' as const;

export type VerificationMethodInput =
  | (typeof ALWAYS_AVAILABLE_METHODS)[number]
  | typeof DEV_BYPASS_METHOD;

/**
 * Evaluate the gate. Exported (rather than inlined) so tests can drive it with
 * a synthetic environment instead of mutating the real one.
 */
export function isDevVerificationBypassEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === 'production') return false;
  return env.ALLOW_DEV_VERIFICATION_BYPASS === 'true';
}

/**
 * Boot guard. Throws when a production-configured process has the bypass
 * switched on, so the deployment fails visibly rather than running with a
 * weakened verification path.
 */
export function assertVerificationBypassNotEnabledInProduction(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV === 'production' && env.ALLOW_DEV_VERIFICATION_BYPASS === 'true') {
    throw new Error(
      'FATAL: ALLOW_DEV_VERIFICATION_BYPASS=true is set with NODE_ENV=production. ' +
        'The development verification bypass must never be enabled on a production ' +
        'deployment. Unset ALLOW_DEV_VERIFICATION_BYPASS or correct NODE_ENV.',
    );
  }
}

export function resolveAcceptedVerificationMethods(
  env: NodeJS.ProcessEnv = process.env,
): readonly VerificationMethodInput[] {
  return isDevVerificationBypassEnabled(env)
    ? [...ALWAYS_AVAILABLE_METHODS, DEV_BYPASS_METHOD]
    : [...ALWAYS_AVAILABLE_METHODS];
}

/**
 * The accepted set for this process, frozen at module load.
 *
 * Module load happens once, before any request is served, so no request can
 * influence it. This constant is what the request DTO validates against.
 */
export const ACCEPTED_VERIFICATION_METHODS: readonly VerificationMethodInput[] =
  Object.freeze(resolveAcceptedVerificationMethods());

/** Convenience for the service layer; same boot-time answer, no re-read. */
export const DEV_VERIFICATION_BYPASS_ENABLED: boolean =
  ACCEPTED_VERIFICATION_METHODS.includes(DEV_BYPASS_METHOD);
