/**
 * A business's current ability to serve traffic (FR-BIZ-07).
 *
 *   LIVE      at least one active verified domain that is a real, owned name
 *   TEST      active verified domains exist, but every one is a sandbox domain
 *   INACTIVE  no active verified domain at all
 *
 * Derived on every read from current domain rows, never stored. A stored flag
 * would need updating on domain create, verify, delete, soft-delete, and any
 * future bulk operation - five chances to drift. A computed value cannot be
 * wrong.
 *
 * `INACTIVE` is deliberately independent of `onboardingCompleted`: completing
 * onboarding is a permanent historical fact and is never reverted (FR-BIZ-08),
 * while service mode carries the current truth. A business that deletes its
 * only verified domain stays "onboarded" and becomes "inactive", and the
 * dashboard says so plainly rather than silently pretending nothing changed.
 */
export type ServiceMode = 'LIVE' | 'TEST' | 'INACTIVE';

export function computeServiceMode(
  activeVerifiedDomains: ReadonlyArray<{ isSandbox: boolean }>,
): ServiceMode {
  if (activeVerifiedDomains.length === 0) return 'INACTIVE';
  return activeVerifiedDomains.some((d) => !d.isSandbox) ? 'LIVE' : 'TEST';
}
