import { Injectable, Logger } from '@nestjs/common';
import { resolveTxt } from 'node:dns/promises';
import { DnsResolutionError, SsrfViolationError } from '../../common/security/ssrf-guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value import required for DI metadata
import { SafeHttpService } from '../../common/security/safe-http.service.js';
import { HttpStatusError } from '../../common/security/safe-http.service.js';

/**
 * The three outcomes of a live verification attempt.
 *
 * MISMATCH and PENDING are deliberately distinct (FR-DOM-10). They have
 * different causes and different fixes: a mismatch means the user published
 * something and it does not match - almost always a copy-paste that gained a
 * space or lost a character, fixable right now. Pending means we found nothing
 * yet, which during DNS propagation is not a problem at all. Collapsing them
 * into one "failed" sends half the users hunting for a typo that does not exist
 * and tells the other half to "wait" when waiting will never help.
 */
export enum VerificationOutcome {
  VERIFIED = 'VERIFIED',
  MISMATCH = 'MISMATCH',
  PENDING = 'PENDING',
}

/** @deprecated Use {@link VerificationOutcome}. Kept so existing imports and
 *  their `FAILED` member keep compiling; FAILED maps to MISMATCH. */
export const VerificationStatus = {
  VERIFIED: VerificationOutcome.VERIFIED,
  FAILED: VerificationOutcome.MISMATCH,
  PENDING: VerificationOutcome.PENDING,
} as const;

/** Total wall-clock budget for a website verification, across every attempt. */
const FETCH_BUDGET_MS = 8_000;
const MAX_REDIRECTS = 3;
/** Homepages are routinely a few hundred KB; 64 KB truncated real pages before
 *  the meta tag was reached when it sat late in a large <head>. */
const MAX_BODY_BYTES = 512 * 1024;

/** Canonical DNS challenge name. */
const DNS_RECORD_PREFIX = '_replyiq-verification';
/** Historical name published by earlier builds. Accepted, never advertised. */
const LEGACY_DNS_RECORD_PREFIX = '_replyiq-challenge';

/** Which scheme answered first, remembered across the placements of one
 *  verification attempt so a site is not probed over both. */
type Scheme = 'https' | 'http';
interface SchemeSession {
  preferred: Scheme | null;
}

export const META_TAG_NAME = 'replyiq-verification';
export const WELL_KNOWN_PATH = '/.well-known/replyiq-verification.txt';
export const LEGACY_FILE_PATH = '/replyiq-verification.html';

@Injectable()
export class DomainVerificationService {
  private readonly logger = new Logger(DomainVerificationService.name);

  constructor(private readonly http: SafeHttpService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Token and instruction values
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * CSPRNG token, generated once per domain and never regenerated (FR-DOM-02).
   * Never derived from the domain's own id: an identifier that appears in URLs
   * is not a secret, and reusing it would publish an internal id into a public
   * DNS zone while giving the challenge no entropy of its own.
   */
  generateToken(): string {
    return `replyiq-verify-${crypto.randomUUID()}`;
  }

  /** The record name shown in instructions. */
  getDnsTxtRecordName(domain: string): string {
    return `${DNS_RECORD_PREFIX}.${domain}`;
  }

  getLegacyDnsTxtRecordName(domain: string): string {
    return `${LEGACY_DNS_RECORD_PREFIX}.${domain}`;
  }

  /** The snippet the user pastes into their homepage `<head>`. */
  getHtmlMetaTag(token: string): string {
    return `<meta name="${META_TAG_NAME}" content="${token}">`;
  }

  getWellKnownPath(): string {
    return WELL_KNOWN_PATH;
  }

  /** @deprecated Legacy fallback placement; still accepted on verification. */
  getHtmlMetaFileName(): string {
    return LEGACY_FILE_PATH.replace(/^\//, '');
  }

  /** @deprecated Legacy file body format; the bare token is now preferred. */
  getHtmlMetaContent(token: string): string {
    return `replyiq-verify:${token}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DNS TXT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Look for the challenge TXT record, canonical name first then legacy.
   *
   * Returns MISMATCH only when the name resolved and none of its records
   * matched - i.e. the user published something and it is wrong. An
   * unresolvable name is PENDING, because that is the normal state during
   * propagation.
   */
  async verifyDnsTxt(domain: string, expectedToken: string): Promise<VerificationOutcome> {
    for (const recordName of [
      this.getDnsTxtRecordName(domain),
      this.getLegacyDnsTxtRecordName(domain),
    ]) {
      let records: string[][];
      try {
        records = await resolveTxt(recordName);
      } catch {
        // NXDOMAIN / SERVFAIL / timeout: nothing published here yet.
        continue;
      }
      if (records.length === 0) continue;

      if (matchesTxtRecords(records, expectedToken)) {
        return VerificationOutcome.VERIFIED;
      }
      // The name exists and holds records, but none match.
      this.logger.debug(`TXT record present at ${recordName} but value did not match`);
      return VerificationOutcome.MISMATCH;
    }

    return VerificationOutcome.PENDING;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Website (meta tag, well-known file, legacy file)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check the three equivalent website placements in order of how likely the
   * user is to have used them, under one shared time budget.
   *
   *   1. `<meta name="replyiq-verification">` on the homepage
   *   2. `/.well-known/replyiq-verification.txt`
   *   3. `/replyiq-verification.html` (legacy)
   *
   * Any single hit verifies. A placement that exists but holds the wrong value
   * short-circuits to MISMATCH - once we know the user published *something*,
   * telling them to "wait a few minutes" would be actively misleading.
   *
   * Every network-level failure - unreachable host, TLS error, 5xx, timeout, or
   * an SSRF policy refusal - collapses to PENDING. Reporting the real reason
   * would tell a caller whether a name resolves to a private address, which is
   * exactly the internal-topology disclosure the SSRF guard exists to prevent.
   */
  async verifyHtmlMeta(domain: string, expectedToken: string): Promise<VerificationOutcome> {
    const controller = new AbortController();
    const budget = setTimeout(() => controller.abort(), FETCH_BUDGET_MS);
    // Once one scheme has answered, stop retrying the other for every
    // subsequent path. Without this a plaintext-only site costs three wasted
    // HTTPS handshakes before the fallbacks are even reached, which can burn
    // the whole budget on a slow connection.
    const session: SchemeSession = { preferred: null };

    try {
      // 1. Homepage meta tag.
      const homepage = await this.tryFetch(domain, '/', controller, session);
      if (homepage !== null) {
        const content = extractMetaContent(homepage, META_TAG_NAME);
        if (content !== null) {
          return content === expectedToken
            ? VerificationOutcome.VERIFIED
            : VerificationOutcome.MISMATCH;
        }
      }

      // 2/3. File placements. A file that exists but holds the wrong value is a
      // mismatch for the same reason the meta tag is.
      for (const path of [WELL_KNOWN_PATH, LEGACY_FILE_PATH]) {
        const body = await this.tryFetch(domain, path, controller, session);
        if (body === null) continue;
        const value = body.trim();
        if (value === expectedToken || value === this.getHtmlMetaContent(expectedToken)) {
          return VerificationOutcome.VERIFIED;
        }
        if (value.length > 0 && value.includes('replyiq-verify')) {
          return VerificationOutcome.MISMATCH;
        }
      }

      return VerificationOutcome.PENDING;
    } finally {
      clearTimeout(budget);
    }
  }

  /**
   * One guarded fetch, delegated to SafeHttpService.
   *
   * Returns the body, or null for any reason the caller should treat as "this
   * placement is not here" - including policy refusals, which are logged but
   * never distinguished to the caller.
   */
  private async tryFetch(
    domain: string,
    path: string,
    controller: AbortController,
    session: SchemeSession,
  ): Promise<string | null> {
    // HTTPS first. Fetching http:// only is a downgrade by default: it invites
    // a network attacker to answer for an otherwise HTTPS-only site, and fails
    // outright on sites that reject plaintext.
    const schemes: readonly Scheme[] =
      session.preferred !== null ? [session.preferred] : ['https', 'http'];

    for (const scheme of schemes) {
      try {
        const result = await this.http.fetchText(new URL(`${scheme}://${domain}${path}`), {
          signal: controller.signal,
          maxBytes: MAX_BODY_BYTES,
          maxRedirects: MAX_REDIRECTS,
        });
        session.preferred = scheme;
        return result.body;
      } catch (error) {
        if (error instanceof SsrfViolationError) {
          // Policy refusal. Never retried over another scheme, and never
          // distinguished to the caller - see verifyHtmlMeta's contract.
          this.logger.warn(
            `SSRF protection blocked verification fetch for ${domain}${path}: ${error.reason}`,
          );
          return null;
        }
        if (error instanceof DnsResolutionError) {
          this.logger.debug(`DNS resolution failed for ${domain}`);
          return null;
        }
        if (error instanceof HttpStatusError) {
          // The server answered, so this scheme works - it just does not host
          // this particular path. Remember it so the remaining placements are
          // not probed over the other scheme as well.
          session.preferred = scheme;
          this.logger.debug(`${scheme}://${domain}${path} returned ${error.status}`);
          return null;
        }
        if (controller.signal.aborted) return null; // Budget exhausted.
        this.logger.debug(
          `${scheme}://${domain}${path} unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Pure parsing helpers - exported for direct unit testing
// ───────────────────────────────────────────────────────────────────────────

/**
 * Compare TXT answers to the expected token.
 *
 * DNS splits strings longer than 255 bytes into chunks, so each record's chunks
 * are joined. Records are then compared **individually** - the previous
 * implementation joined every chunk of every record into one string, which made
 * a correctly published record fail whenever a second unrelated TXT record
 * existed at the same name (routine during a DNS provider migration). The
 * all-records join is still checked afterwards, to tolerate providers that
 * split one value across separate records.
 */
export function matchesTxtRecords(records: string[][], expectedToken: string): boolean {
  const normalize = (value: string): string => value.trim().replace(/^"|"$/g, '').trim();
  const expected = normalize(expectedToken);

  for (const record of records) {
    if (normalize(record.join('')) === expected) return true;
  }
  return normalize(records.flat().join('')) === expected;
}

/**
 * Pull the `content` of `<meta name="{name}" ...>` out of an HTML document.
 *
 * Written against real-world HTML rather than a strict grammar: attribute order
 * varies, quoting varies (double, single, or none), tag and attribute case
 * varies, and minifiers remove whitespace. A full HTML parser would be more
 * correct in the abstract but adds a dependency and an attack surface to read
 * one attribute.
 *
 * Returns null when no such meta tag exists (so the caller can fall through to
 * the file placements), and the raw content when one does - including an empty
 * string, which is a mismatch rather than an absence.
 */
export function extractMetaContent(html: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const metaTag = new RegExp('<meta\\b[^>]*>', 'gi');
  // Each alternative is self-anchoring, so `name="replyiq-verification-old"`
  // cannot match `replyiq-verification`. The quoted forms are anchored by their
  // own closing quote; only the unquoted form needs a trailing lookahead - and
  // requiring one after a quoted value would reject minified markup such as
  // `name="x"content="y"`, which browsers accept and minifiers emit.
  const nameAttr = new RegExp(
    `\\bname\\s*=\\s*(?:"${escapedName}"|'${escapedName}'|${escapedName}(?=[\\s/>]))`,
    'i',
  );
  const contentAttr = /\bcontent\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

  for (const match of html.matchAll(metaTag)) {
    const tag = match[0];
    if (!nameAttr.test(tag)) continue;
    const content = contentAttr.exec(tag);
    if (!content) continue;
    return content[2] ?? content[3] ?? content[4] ?? '';
  }
  return null;
}

// Re-export for consumers that want to distinguish failure classes in tests.
export { DnsResolutionError, SsrfViolationError };
