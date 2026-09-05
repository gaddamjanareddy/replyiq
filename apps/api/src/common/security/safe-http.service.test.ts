import { createServer, type Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildPinnedRequestOptions, makePinnedLookup } from './safe-http.service.js';

/**
 * Regression tests for the SSRF address pin.
 *
 * These exist because the pin has been broken twice, both times silently:
 *
 *   1. Pinning by rewriting the URL hostname to the validated IP made TLS
 *      validate the certificate against an IP, so every HTTPS fetch failed with
 *      ERR_TLS_CERT_ALTNAME_INVALID. Verification reports all network failures
 *      identically, so this looked like "domain not verified yet" rather than a
 *      bug - for every HTTPS site.
 *
 *   2. Pinning via `lookup` while leaving the global agent in place let a
 *      pooled keep-alive socket be reused without `lookup` ever being called,
 *      so a request pinned to a dead address reached the real host anyway.
 *
 * Both failure modes look like success from the outside, which is exactly why
 * they need tests that assert the socket's actual destination.
 */

describe('makePinnedLookup', () => {
  // Node calls `lookup` with two different callback contracts depending on the
  // code path. Getting this wrong surfaces as an opaque ERR_INVALID_IP_ADDRESS
  // far from the cause, so both shapes are pinned down here.
  /** Invoke a pinned lookup and capture what it hands back to Node. */
  const resolveWith = (lookup: LookupFunction, hostname: string, all: boolean) => {
    let captured: { error: unknown; address: unknown; family: unknown } | null = null;
    lookup(hostname, { all }, (error, address, family) => {
      captured = { error, address, family };
    });
    if (captured === null) throw new Error('lookup did not call its callback');
    return captured as { error: unknown; address: unknown; family: unknown };
  };

  it('answers the all:true contract with an array of records', () => {
    const { error, address } = resolveWith(makePinnedLookup('203.0.113.7'), 'a.example', true);
    expect(error).toBeNull();
    expect(address).toEqual([{ address: '203.0.113.7', family: 4 }]);
  });

  it('answers the all:false contract with positional arguments', () => {
    const { error, address, family } = resolveWith(
      makePinnedLookup('203.0.113.7'),
      'a.example',
      false,
    );
    expect(error).toBeNull();
    expect(address).toBe('203.0.113.7');
    expect(family).toBe(4);
  });

  it('reports family 6 for an IPv6 address', () => {
    const { address } = resolveWith(makePinnedLookup('2001:db8::1'), 'a.example', true);
    expect(address).toEqual([{ address: '2001:db8::1', family: 6 }]);
  });

  it('ignores the hostname it is asked about', () => {
    // The whole point: whatever name the stack resolves, it gets our address.
    const { address } = resolveWith(
      makePinnedLookup('203.0.113.7'),
      'attacker-controlled.example',
      true,
    );
    expect(address).toEqual([{ address: '203.0.113.7', family: 4 }]);
  });
});

describe('the pin constrains the socket', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('reached the server');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /**
   * Issue a request using the service's OWN option builder, so these assertions
   * cover the shipped configuration rather than a copy of it.
   */
  const fetchPinned = (hostname: string, pinnedAddress: string) =>
    new Promise<{ status?: number; remote?: string }>((resolve, reject) => {
      const req = httpRequest(
        {
          ...buildPinnedRequestOptions({
            url: new URL(`http://${hostname}/`),
            hostname,
            port,
            dialHostname: hostname,
            pinnedAddress,
            secure: false,
          }),
          timeout: 5_000,
        },
        (res) => {
          const remote = res.socket.remoteAddress;
          res.resume();
          res.on('end', () => resolve({ status: res.statusCode, remote }));
        },
      );
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.end();
    });

  it('sends the request to the pinned address, not to DNS', async () => {
    // `localhost` would resolve on its own; the pin is what decides the socket.
    const result = await fetchPinned('localhost', '127.0.0.1');
    expect(result.status).toBe(200);
    expect(result.remote).toBe('127.0.0.1');
  });

  it('cannot reach a host when pinned to an address that is not listening', async () => {
    // If `lookup` were bypassed, DNS for `localhost` would land on the live
    // server and this would pass with a 200.
    await expect(fetchPinned('localhost', '127.0.0.2')).rejects.toThrow();
  });

  it('does not reuse a pooled socket across requests to the same host', async () => {
    // The exact bug that made a mis-pinned request succeed: request one warms a
    // keep-alive socket, request two is pinned somewhere dead. With connection
    // pooling the second reuses the first's socket and never calls `lookup`.
    const first = await fetchPinned('localhost', '127.0.0.1');
    expect(first.status).toBe(200);

    await expect(fetchPinned('localhost', '127.0.0.2')).rejects.toThrow();
  });
});

describe('buildPinnedRequestOptions', () => {
  const base = {
    url: new URL('https://shop.example.com/pricing?plan=pro'),
    hostname: 'shop.example.com',
    port: 443,
    dialHostname: 'shop.example.com',
    pinnedAddress: '203.0.113.7',
    secure: true,
  };

  it('keeps the real hostname so the certificate can validate', () => {
    // The shipped bug: dialling the IP made TLS check the certificate against
    // an address, which never matches, so every HTTPS fetch failed.
    const options = buildPinnedRequestOptions(base);
    expect(options.hostname).toBe('shop.example.com');
    expect(options.servername).toBe('shop.example.com');
    expect(options.headers.host).toBe('shop.example.com');
  });

  it('disables connection pooling so the pin cannot be bypassed', () => {
    // The second shipped bug: a pooled keep-alive socket is reused without
    // consulting `lookup`, so a mis-pinned request reaches the real host.
    expect(buildPinnedRequestOptions(base).agent).toBe(false);
  });

  it('pins the socket to the validated address', () => {
    const { lookup } = buildPinnedRequestOptions(base);
    let address: unknown;
    lookup('shop.example.com', { all: true }, (_error, resolved) => (address = resolved));
    expect(address).toEqual([{ address: '203.0.113.7', family: 4 }]);
  });

  it('carries the path and query through unchanged', () => {
    expect(buildPinnedRequestOptions(base).path).toBe('/pricing?plan=pro');
  });

  it('omits servername for plain HTTP', () => {
    const options = buildPinnedRequestOptions({ ...base, secure: false });
    expect(options).not.toHaveProperty('servername');
  });

  it('requests identity encoding so the body cap stays meaningful', () => {
    expect(buildPinnedRequestOptions(base).headers['accept-encoding']).toBe('identity');
  });
});
