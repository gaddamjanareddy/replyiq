/**
 * Client-side mirror of the server's domain rules.
 *
 * This exists for *immediacy*, not for enforcement: the server decides, always.
 * But telling someone "that isn't a domain" the moment they finish typing, and
 * "that's a test domain, it'll verify instantly" before they click anything, is
 * the difference between a form that feels alive and one that punishes you
 * after a round trip.
 *
 * Kept deliberately small and in step with:
 *   apps/api/src/modules/domain/dto/create-domain.dto.ts   (normalisation, pattern)
 *   apps/api/src/common/security/sandbox-domains.ts        (sandbox eligibility)
 */

const HOSTNAME_PATTERN =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

const RESERVED_TLDS = new Set(['test', 'example', 'invalid', 'localhost', 'local', 'internal']);
const RESERVED_SECOND_LEVEL = ['example.com', 'example.net', 'example.org', 'example.edu'];

/**
 * Turn whatever the user pasted into the hostname they meant.
 *
 * People paste what their browser shows them - `https://www.acme.com/pricing?x=1`
 * - and rejecting that on a technicality is a wall with no purpose. Mirrors
 * `normalizeDomainInput` on the server so both ends agree.
 */
export function normalizeDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
  value = value.replace(/^[^/@]*@/, ''); // userinfo
  value = value.split(/[/?#]/)[0] ?? ''; // path, query, fragment
  value = value.replace(/:\d+$/, ''); // port
  value = value.replace(/^www\./, '');
  value = value.replace(/\.+$/, ''); // trailing root dot
  return value;
}

export function isValidDomain(hostname: string): boolean {
  return hostname.length > 0 && hostname.length <= 253 && HOSTNAME_PATTERN.test(hostname);
}

/** True for IANA-reserved names that verify instantly in Test Mode. */
export function isSandboxDomain(hostname: string): boolean {
  const value = normalizeDomain(hostname);
  if (!value) return false;
  const labels = value.split('.');
  const tld = labels[labels.length - 1];
  if (tld !== undefined && RESERVED_TLDS.has(tld)) return true;
  return RESERVED_SECOND_LEVEL.some((r) => value === r || value.endsWith(`.${r}`));
}

/**
 * A specific, actionable message for an invalid entry - never just "invalid".
 * Each branch names what is actually wrong, because "Enter a valid domain" is
 * the least useful sentence in software.
 */
export function describeDomainProblem(raw: string): string | null {
  const value = normalizeDomain(raw);
  if (!value) return 'Enter your website address, like acme.com';
  if (value.length > 253) return "That's longer than a web address can be";
  if (!value.includes('.')) {
    return `Add the ending too — did you mean ${value}.com?`;
  }
  if (value.includes(' ')) return "Web addresses can't contain spaces";
  if (value.includes('_')) return "Web addresses can't contain underscores";
  if (/^-|-$|\.-|-\./.test(value)) return "Web addresses can't start or end a part with a hyphen";
  if (!/[a-z]{2,}$/.test(value)) return 'The ending should be letters, like .com or .co.uk';
  if (!HOSTNAME_PATTERN.test(value)) return 'That doesn’t look like a web address — try acme.com';
  return null;
}

/**
 * Pre-fill the domain field from the profile step's website URL (FR-DOM-16).
 * Returns an empty string when the URL is unusable, so the caller can simply
 * assign the result.
 */
export function hostnameFromWebsiteUrl(websiteUrl: string | null | undefined): string {
  if (!websiteUrl) return '';
  const hostname = normalizeDomain(websiteUrl);
  return isValidDomain(hostname) ? hostname : '';
}
