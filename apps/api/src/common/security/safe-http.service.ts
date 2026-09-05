import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ConfigService } from '@nestjs/config';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import {
  DnsResolutionError,
  SsrfViolationError,
  assertSafeHop,
  resolvePinnedAddress,
} from './ssrf-guard.js';

/**
 * The one way this application makes an outbound HTTP request to a host a user
 * chose.
 *
 * Shared by domain verification and knowledge ingestion, so there is exactly
 * one hardened implementation. Two places fetching attacker-influenced URLs
 * with two different guards is how SSRF bugs actually happen.
 *
 * ── Why node:http(s) rather than fetch ────────────────────────────────────
 * SSRF protection requires connecting to a pre-validated IP rather than
 * whatever DNS says at connect time. The obvious way to do that with `fetch` is
 * to rewrite the URL's hostname to the validated IP and put the real hostname
 * in the Host header.
 *
 * That is broken for HTTPS, and it shipped: TLS then validates the certificate
 * against the IP, which never matches, so every HTTPS request failed with
 * ERR_TLS_CERT_ALTNAME_INVALID. Because the verification path collapses all
 * network failures to "not found yet", it looked like a domain that simply
 * never verified - for every HTTPS site, which is to say all of them.
 *
 * The correct approach is to pin at the DNS layer: keep the real hostname in
 * the request (so SNI, certificate validation and the Host header are all
 * correct) and override `lookup` so the socket can only go to the address we
 * already validated. `node:http(s)` exposes that option; fetch does not.
 *
 * ── Why agent: false ──────────────────────────────────────────────────────
 * The global agent pools keep-alive sockets by host. A pooled socket would be
 * reused without consulting `lookup` at all, silently bypassing the pin. This
 * was observed directly while developing the fix: a request deliberately
 * pinned to 127.0.0.1 succeeded against the real host because it reused an
 * earlier connection. Every request therefore gets a fresh connection.
 */

/** The server answered, but not with a usable status. Distinguished from a
 *  connection failure because it proves the scheme works. */
export class HttpStatusError extends Error {
  constructor(public readonly status: number) {
    super(`unexpected status ${status}`);
    this.name = 'HttpStatusError';
  }
}

export interface SafeFetchOptions {
  /** Abort signal shared across a multi-request operation's total budget. */
  signal: AbortSignal;
  /** Hard cap on the response body. Oversized responses abort mid-stream. */
  maxBytes: number;
  /** Maximum redirect hops. Each target is revalidated from scratch. */
  maxRedirects?: number;
  accept?: string;
}

export interface SafeFetchResult {
  body: string;
  /** The URL actually served, after any redirects. */
  finalUrl: URL;
  contentType: string | null;
}

const DEFAULT_MAX_REDIRECTS = 3;
/** Per-connection ceiling, independent of the caller's overall budget. */
const SOCKET_TIMEOUT_MS = 10_000;

@Injectable()
export class SafeHttpService {
  private readonly logger = new Logger(SafeHttpService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Fetch one URL under the full SSRF policy.
   *
   * Throws SsrfViolationError for a policy refusal, DnsResolutionError when the
   * name does not resolve, HttpStatusError for a non-OK response, and a plain
   * Error for connection or size failures. Callers decide how to collapse those
   * - the verification path deliberately reports them all identically so no
   * network topology leaks back to the requester.
   */
  async fetchText(url: URL, options: SafeFetchOptions): Promise<SafeFetchResult> {
    const fixtureOrigin = this.getTestFixtureOrigin();
    const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

    let current = url;
    for (let hop = 0; ; hop++) {
      // Runs on every hop regardless of the fixture override, so hostname,
      // scheme, port and redirect revalidation are always exercised for real.
      const port = assertSafeHop(current);

      const response = await this.requestOnce(current, port, fixtureOrigin, options);

      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        response.resume(); // Drain so the socket can close.
        const location = response.headers.location;
        if (!location || hop >= maxRedirects) {
          throw new Error(`redirect chain exhausted or missing Location at hop ${hop}`);
        }
        current = new URL(location, current);
        continue;
      }

      if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
        response.resume();
        throw new HttpStatusError(response.statusCode ?? 0);
      }

      return {
        body: await this.readBodyCapped(response, options.maxBytes),
        finalUrl: current,
        contentType: response.headers['content-type'] ?? null,
      };
    }
  }

  /** One connection, pinned to a pre-validated address. */
  private async requestOnce(
    url: URL,
    port: number,
    fixtureOrigin: URL | null,
    options: SafeFetchOptions,
  ): Promise<IncomingMessage> {
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

    // Test-only fixture injection (FR-TEST-13). Integration tests need a real
    // HTTP round trip to drive the genuine parser, redirect handling and body
    // cap; a loopback address can never survive resolvePinnedAddress
    // (correctly), so the whole target is substituted here. Gated on
    // NODE_ENV === 'test' inside getTestFixtureOrigin.
    const useFixture = fixtureOrigin !== null;
    const pinnedAddress = useFixture
      ? fixtureOrigin.hostname
      : (await resolvePinnedAddress(hostname)).address;

    const secure = !useFixture && url.protocol === 'https:';
    const requestFn = secure ? httpsRequest : httpRequest;

    const requestOptions = buildPinnedRequestOptions({
      url,
      hostname,
      port: useFixture ? Number(fixtureOrigin.port || 80) : port,
      dialHostname: useFixture ? fixtureOrigin.hostname : hostname,
      pinnedAddress,
      secure,
      accept: options.accept,
    });

    return new Promise<IncomingMessage>((resolve, reject) => {
      const req = requestFn(requestOptions, resolve);

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(new Error('socket timeout'));
      });

      if (options.signal.aborted) {
        req.destroy(new Error('aborted'));
      } else {
        options.signal.addEventListener('abort', () => req.destroy(new Error('aborted')), {
          once: true,
        });
      }

      req.end();
    });
  }

  private readBodyCapped(response: IncomingMessage, maxBytes: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          response.destroy();
          reject(new Error(`response body exceeds ${maxBytes} byte limit`));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
    });
  }

  /**
   * The local fixture origin, or null.
   *
   * Returns null unless `NODE_ENV === 'test'`, so the override is inert in
   * development and production however the variable is set. Parsed rather than
   * interpolated, so a malformed value disables the override instead of
   * producing a surprising dial target.
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
}

export interface PinnedRequestInput {
  /** The URL being fetched, used for the path and the Host header. */
  url: URL;
  /** The real, normalised hostname - what the certificate must match. */
  hostname: string;
  port: number;
  /** Where to dial. Differs from `hostname` only under the test fixture. */
  dialHostname: string;
  /** The address the socket is locked to. */
  pinnedAddress: string;
  secure: boolean;
  accept?: string;
}

/**
 * Build the request options for one pinned outbound fetch.
 *
 * Pure and exported so the two security properties that have silently broken
 * before - certificate validation against the real hostname, and no socket
 * reuse - are asserted directly against the code that ships, rather than
 * against a test's own copy of the same options.
 */
export function buildPinnedRequestOptions(input: PinnedRequestInput) {
  return {
    // The REAL hostname, so SNI and certificate validation are correct.
    hostname: input.dialHostname,
    ...(input.secure ? { servername: input.hostname } : {}),
    port: input.port,
    path: `${input.url.pathname}${input.url.search}`,
    method: 'GET' as const,
    headers: {
      // Always the real host, never the fixture's, so a test exercises the
      // same request the production path would send.
      host: input.url.host,
      accept: input.accept ?? 'text/html,text/plain,*/*',
      // Identity encoding keeps the body cap meaningful: a compressed body
      // could expand past the limit only after we had already accepted it.
      'accept-encoding': 'identity',
      'user-agent': 'ReplyIQ/1.0 (+https://replyiq.com/bot)',
    },
    // Pin the socket to the address already validated. Without this the stack
    // would resolve again at connect time, reopening the DNS-rebinding window
    // the guard exists to close.
    lookup: makePinnedLookup(input.pinnedAddress),
    // No connection pooling: a reused keep-alive socket would skip `lookup`
    // entirely and defeat the pin.
    agent: false as const,
    timeout: SOCKET_TIMEOUT_MS,
  };
}

/**
 * A DNS `lookup` that always answers with one pre-validated address.
 *
 * Node calls this with `all: true` on some paths and `all: false` on others,
 * and the callback shape differs between them - getting that wrong surfaces as
 * an opaque ERR_INVALID_IP_ADDRESS.
 */
export function makePinnedLookup(address: string): LookupFunction {
  const family = isIP(address) === 6 ? 6 : 4;
  return (_hostname, options, callback): void => {
    const wantsAll = typeof options === 'object' && options?.all === true;
    if (wantsAll) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

export { DnsResolutionError, SsrfViolationError };
