/**
 * Deciding whether a widget request is allowed to be answered.
 *
 * This is the first genuinely UNAUTHENTICATED surface in the product. The
 * widget runs on the business's own website, so there is no session, no token
 * and no user — anyone can POST to the endpoint. What stands in for
 * authentication is the browser-set `Origin` header checked against the
 * domains that business has proved it controls.
 *
 * ── What this is actually protecting ──────────────────────────────────────
 * The knowledge base. It contains everything the owner published about their
 * business, and without an origin check any competitor could point a script at
 * the endpoint and pull the lot, or embed someone else's receptionist on their
 * own site and burn their quota.
 *
 * ── What it is NOT ────────────────────────────────────────────────────────
 * `Origin` is set by the browser and cannot be forged BY PAGE JAVASCRIPT, which
 * is what makes it meaningful for the case that matters: a script on some other
 * website. It is trivially forged by curl or any server-side client, so this is
 * not a secret and must never be treated as one. It raises the cost of casual
 * abuse and scopes the browser-side attack surface; rate limiting and the fact
 * that the content is already public on the owner's own site cover the rest.
 * Anything genuinely confidential must not be in a knowledge base at all.
 */

/** Domains as stored: hostname plus whether it is a test-only namespace. */
export interface AllowedDomain {
  domain: string;
  isSandbox: boolean;
}

export type OriginDecision =
  | { allowed: true; matched: AllowedDomain }
  | { allowed: false; reason: 'missing' | 'malformed' | 'insecure' | 'not-verified' };

/**
 * Normalise a hostname for comparison.
 *
 * Lowercased and with the DNS root dot removed, so `Example.COM.` and
 * `example.com` are the same host — which they are, and treating them as
 * different would be a bypass rather than merely a bug.
 */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Is `origin` allowed to ask this business's receptionist?
 *
 * Matches the exact host and its subdomains: a business that verified
 * `example.com` is served on `shop.example.com` too, because that is plainly
 * the same business and requiring a separate verification per subdomain would
 * be a support burden with no security benefit.
 *
 * Suffix matching is done on a dot boundary. Comparing with `endsWith` alone
 * would let `notexample.com` match `example.com`, which is the classic
 * suffix-confusion bug and would hand the knowledge base to anyone who could
 * register a lookalike.
 */
export function checkWidgetOrigin(
  origin: string | undefined,
  allowed: readonly AllowedDomain[],
  options: { allowLocalhost?: boolean } = {},
): OriginDecision {
  if (!origin) return { allowed: false, reason: 'missing' };

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return { allowed: false, reason: 'malformed' };
  }

  const host = normalizeHost(url.hostname);
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

  /**
   * localhost is NOT a general exemption, and getting that wrong would undo
   * the whole check: if any page served from localhost could query any
   * business, an attacker just runs a local page and reads the knowledge base.
   *
   * So it is allowed only for a business in TEST mode — every verified domain
   * is a reserved test namespace, so there is no real business to expose.
   * A LIVE business is never reachable from localhost, which is exactly the
   * asymmetry Test Mode exists to provide.
   */
  if (isLocal) {
    return options.allowLocalhost
      ? { allowed: true, matched: { domain: host, isSandbox: true } }
      : { allowed: false, reason: 'not-verified' };
  }

  // http:// is refused for anything else. The widget carries the owner's
  // content and the visitor's questions; serving that over plaintext invites
  // anyone on the path to read and rewrite both.
  if (url.protocol !== 'https:') {
    return { allowed: false, reason: 'insecure' };
  }

  for (const candidate of allowed) {
    const domain = normalizeHost(candidate.domain);
    if (host === domain || host.endsWith(`.${domain}`)) {
      return { allowed: true, matched: candidate };
    }
  }

  return { allowed: false, reason: 'not-verified' };
}
