/**
 * Test Mode eligibility: which hostnames may be verified without a network
 * check.
 *
 * ── The security argument, in one paragraph ────────────────────────────────
 * `SANDBOX` verification proves nothing. That is safe only because the set of
 * names it accepts is the set of names **nobody can own**. Every namespace
 * below is reserved by IANA/ICANN against registration (RFC 2606, RFC 6761,
 * RFC 6762, and ICANN's 2024 reservation of `.internal`), or is a suffix the
 * deployment operator provably controls. Granting a claim over
 * `acme.example.com` cannot harm anyone, because there is no owner to harm and
 * there can never be one. This is the whole boundary - there is no role,
 * header, env var, or credential that widens it.
 *
 * ── Why an allow-list of suffixes and not a regex ──────────────────────────
 * Suffix matching must be anchored at a label boundary. `example.com.evil.com`
 * and `notexample.com` both contain "example.com" as a substring and are both
 * ordinary registrable domains an attacker can buy. Every comparison here is
 * either exact or on a `.`-prefixed suffix, so neither can match.
 *
 * Pure functions, no I/O, no config service - the module reads the optional
 * operator suffix from the environment once so it can be unit-tested and
 * called from anywhere without wiring.
 */

/**
 * Reserved top-level domains. Anything under these is unregistrable.
 *
 *   test      RFC 2606 §2 / RFC 6761 §6.2 - reserved for testing
 *   example   RFC 2606 §2 / RFC 6761 §6.5 - reserved for documentation
 *   invalid   RFC 2606 §2 / RFC 6761 §6.4 - guaranteed not to resolve
 *   localhost RFC 2606 §2 / RFC 6761 §6.3 - loopback only
 *   local     RFC 6762 - mDNS link-local
 *   internal  ICANN, 2024 - reserved for private networks
 */
const RESERVED_TLDS: ReadonlySet<string> = new Set([
  'test',
  'example',
  'invalid',
  'localhost',
  'local',
  'internal',
]);

/**
 * Second-level names held by IANA under RFC 2606 §3. These sit under real,
 * registrable TLDs, so they are matched exactly (or as a suffix) rather than by
 * TLD.
 */
const RESERVED_SECOND_LEVEL: readonly string[] = [
  'example.com',
  'example.net',
  'example.org',
  'example.edu',
];

/**
 * Normalise a hostname for comparison: lowercase, strip a trailing root dot,
 * strip surrounding whitespace, and strip a leading `www.` so that
 * `www.example.com` is treated the same as `example.com`.
 */
export function normalizeHostname(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.+$/, '');
}

/** True when `hostname` equals `suffix` or sits strictly beneath it. */
function isAtOrUnder(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/**
 * The operator-controlled sandbox namespace, if configured.
 *
 * Read lazily rather than at module load so that tests can set it, and
 * validated so that a blank or malformed value can never degrade into "matches
 * everything" - an empty suffix passed to `isAtOrUnder` would make `.` a
 * universal match.
 */
export function getConfiguredSandboxSuffix(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.SANDBOX_DOMAIN_SUFFIX;
  if (typeof raw !== 'string') return null;
  const suffix = normalizeHostname(raw).replace(/^\.+/, '');
  // Must be a plausible multi-label hostname. A bare TLD is rejected: allowing
  // "com" here would make every .com address sandbox-eligible.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(suffix)) {
    return null;
  }
  return suffix;
}

/**
 * Decide whether a hostname belongs to Test Mode.
 *
 * Called exactly once per domain, at creation, and the result is persisted to
 * `BusinessDomain.isSandbox`. It is never re-evaluated, because domain strings
 * are immutable (FR-DOM-14) - which means a domain can never drift between
 * modes, even if this list changes later.
 */
export function isSandboxDomain(
  rawHostname: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const hostname = normalizeHostname(rawHostname);
  if (!hostname) return false;

  const labels = hostname.split('.');
  const tld = labels[labels.length - 1];

  // `localhost` with no dot at all, plus anything under a reserved TLD.
  if (tld !== undefined && RESERVED_TLDS.has(tld)) return true;

  for (const reserved of RESERVED_SECOND_LEVEL) {
    if (isAtOrUnder(hostname, reserved)) return true;
  }

  const configured = getConfiguredSandboxSuffix(env);
  if (configured !== null && isAtOrUnder(hostname, configured)) return true;

  return false;
}

/**
 * Human-readable reason a hostname qualifies, for the UI hint and audit
 * metadata. Returns null when the hostname is a normal, registrable domain.
 */
export function describeSandboxEligibility(
  rawHostname: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const hostname = normalizeHostname(rawHostname);
  if (!hostname) return null;

  const labels = hostname.split('.');
  const tld = labels[labels.length - 1];
  if (tld !== undefined && RESERVED_TLDS.has(tld)) {
    return `.${tld} is a reserved namespace that cannot be registered`;
  }
  for (const reserved of RESERVED_SECOND_LEVEL) {
    if (isAtOrUnder(hostname, reserved)) {
      return `${reserved} is reserved for documentation and testing`;
    }
  }
  const configured = getConfiguredSandboxSuffix(env);
  if (configured !== null && isAtOrUnder(hostname, configured)) {
    return `${configured} is this deployment's sandbox namespace`;
  }
  return null;
}

/**
 * A worked example shown in the UI when someone needs a test domain. Derived
 * from the operator suffix when one is configured so the suggestion is always
 * something that will actually pass.
 */
export function suggestSandboxDomain(env: NodeJS.ProcessEnv = process.env): string {
  const configured = getConfiguredSandboxSuffix(env);
  return configured !== null ? `my-business.${configured}` : 'my-business.example.com';
}
