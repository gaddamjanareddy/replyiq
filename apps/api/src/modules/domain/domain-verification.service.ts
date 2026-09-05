import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ConfigService } from '@nestjs/config';
import { resolveTxt } from 'node:dns/promises';
import {
  DnsResolutionError,
  SsrfViolationError,
  assertSafeHop,
  resolvePinnedAddress,
} from '../../common/security/ssrf-guard.js';

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

/** The server responded, but not with a usable status. Distinguished from a
 *  connection failure because it proves the scheme works. */
class HttpStatusError extends Error {
  constructor(public readonly status: number) {
    super(`unexpected status ${status}`);
    this.name = 'HttpStatusError';
  }
}

export const META_TAG_NAME = 'replyiq-verification';
export const WELL_KNOWN_PATH = '/.well-known/replyiq-verification.txt';
export const LEGACY_FILE_PATH = '/replyiq-verification.html';

@Injectable()
export class DomainVerificationService {
  private readonly logger = new Logger(DomainVerificationService.name);

  constructor(private readonly configService: ConfigService) {}

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
   * One guarded fetch. Returns the body, or null for any reason the caller
   * should treat as "this placement is not here" - including policy refusals,
   * which are logged but never distinguished to the caller.
   */
  private async tryFetch(
    domain: string,
    path: string,
    controller: AbortController,
    session: SchemeSession,
  ): Promise<string | null> {
    // HTTPS first. The original implementation fetched http:// only, which is a
    // downgrade by default: it invites a network attacker to answer for an
    // otherwise HTTPS-only site, and fails outright on sites that reject
    // plaintext. HTTP remains as a fallback for sites that have no TLS at all.
    const schemes: readonly Scheme[] =
      session.preferred !== null ? [session.preferred] : ['https', 'http'];

    for (const scheme of schemes) {
      try {
        const body = await this.fetchWithSsrfProtection(
          new URL(`${scheme}://${domain}${path}`),
          controller,
        );
        session.preferred = scheme;
        return body;
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
          // this particular path. Remember the scheme so the remaining
          // placements are not probed over the other one as well.
          session.preferred = scheme;
          this.logger.debug(`${scheme}://${domain}${path} returned ${error.status}`);
          return null;
        }
        if (controller.signal.aborted) return null; // Budget exhausted.
        // Connection or TLS failure: fall through and try the next scheme.
        this.logger.debug(
          `${scheme}://${domain}${path} unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return null;
  }

  /**
   * Hardened outbound fetch of one URL.
   *
   * Per hop: validate scheme/port/host, resolve DNS and require every returned
   * address to be public, then dial the validated IP directly while sending the
   * real hostname in the Host header. Because the connection is pinned to an
   * already-validated address there is no second resolution, and therefore no
   * DNS-rebinding window. Redirects are followed manually with a hard hop cap
   * and each target revalidated from scratch, so an open redirect on a public
   * site cannot be used to reach an internal one. The body is streamed with a
   * strict size cap.
   */
  private async fetchWithSsrfProtection(
    initialUrl: URL,
    controller: AbortController,
  ): Promise<string> {
    const fixtureOrigin = this.getTestFixtureOrigin();

    let current = initialUrl;
    for (let hop = 0; ; hop++) {
      // Runs on every hop regardless of the fixture override, so hostname,
      // scheme, port and redirect revalidation are exercised for real.
      const port = assertSafeHop(current);
      const hostHeader = current.host;

      let dialUrl: URL;
      if (fixtureOrigin !== null) {
        // Test-only fixture injection (FR-TEST-13). Integration tests need to
        // drive the genuine meta parser, fallback ordering, redirect handling
        // and body cap - which means a real HTTP round trip to a local server.
        // A loopback address can never survive resolvePinnedAddress (correctly),
        // so the *dial target* is substituted while everything else stays live.
        // Gated on NODE_ENV === 'test' AND an explicit variable, and read once
        // per operation so no request input can reach it.
        dialUrl = new URL(`${current.pathname}${current.search}`, fixtureOrigin);
      } else {
        const pinned = await resolvePinnedAddress(
          current.hostname.toLowerCase().replace(/\.$/, ''),
        );
        dialUrl = new URL(current.toString());
        dialUrl.hostname = pinned.isIpv6 ? `[${pinned.address}]` : pinned.address;
        if (dialUrl.port === '') dialUrl.port = String(port);
      }

      const response: Response = await fetch(dialUrl, {
        headers: { host: hostHeader, accept: 'text/html,text/plain,*/*' },
        redirect: 'manual',
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location || hop >= MAX_REDIRECTS) {
          throw new Error(`redirect chain exhausted or missing Location at hop ${hop}`);
        }
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new HttpStatusError(response.status);
      }
      return await this.readBodyCapped(response);
    }
  }

  /**
   * The local fixture origin, or null.
   *
   * Returns null unless `NODE_ENV === 'test'`, so the override is inert in
   * development and production no matter how the variable is set. The value is
   * parsed rather than interpolated, so a malformed setting disables the
   * override instead of producing a surprising dial target.
   */
  private getTestFixtureOrigin(): URL | null {
    if (process.env.NODE_ENV !== 'test') return null;
    const raw = this.configService.get<string>('DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE');
    if (!raw) return null;
    try {
      return new URL(raw);
    } catch {
      this.logger.warn(`Ignoring malformed DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE: ${raw}`);
      return null;
    }
  }

  private async readBodyCapped(response: Response): Promise<string> {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error(`response body exceeds ${MAX_BODY_BYTES} byte limit`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
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
