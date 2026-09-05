import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import {
  DomainVerificationService,
  VerificationOutcome,
  WELL_KNOWN_PATH,
  LEGACY_FILE_PATH,
} from './domain-verification.service.js';

/**
 * Exercises the REAL website-verification path - genuine HTTP round trips, the
 * genuine meta parser, the genuine fallback ordering, redirect handling and
 * body cap - against a local fixture server (FR-TEST-13).
 *
 * The alternative would be mocking `fetch`, which tests the mock rather than
 * the code. The only thing substituted here is the dial target, because a
 * loopback address can never survive the SSRF guard (correctly so). The guard
 * itself is covered exhaustively in common/security/ssrf-guard.test.ts, and
 * `assertSafeHop` still runs on every logical hop in this suite.
 *
 * The logical hostname is `fixture.example.test` - an IANA-reserved name, so
 * nothing here can ever reach the public internet even if the override breaks.
 */

const TOKEN = 'replyiq-verify-aaaa1111-bbbb-2222-cccc-333344445555';
const HOST = 'fixture.example.test';

/** Route table the fixture server serves; each test rewires it. */
let routes: Record<string, (res: ServerResponse) => void> = {};
let server: Server;
let service: DomainVerificationService;

function html(body: string): (res: ServerResponse) => void {
  return (res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  };
}

function text(body: string): (res: ServerResponse) => void {
  return (res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(body);
  };
}

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const handler = routes[path];
    if (!handler) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    handler(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;
  // NODE_ENV is already 'test' via vitest.setup.ts; the override is inert
  // otherwise, which is asserted at the bottom of this file.
  const config = new ConfigService({
    DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE: `http://127.0.0.1:${port}`,
  });
  service = new DomainVerificationService(config);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('website verification: meta tag on the homepage', () => {
  it('verifies when the tag carries the token', async () => {
    routes = { '/': html(`<head><meta name="replyiq-verification" content="${TOKEN}"></head>`) };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.VERIFIED,
    );
  });

  it('reports MISMATCH when the tag is present but wrong', async () => {
    // The user has clearly published something, so "wait a few minutes" would
    // send them away to do nothing. They need to re-copy the value.
    routes = { '/': html('<head><meta name="replyiq-verification" content="wrong"></head>') };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.MISMATCH,
    );
  });

  it('finds the tag late in a large page, past the old 64 KB cap', async () => {
    const filler = '<!-- padding -->'.repeat(8000); // ~128 KB
    routes = {
      '/': html(`<head>${filler}<meta name="replyiq-verification" content="${TOKEN}"></head>`),
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.VERIFIED,
    );
  });
});

describe('website verification: file placements', () => {
  it('falls back to /.well-known when the homepage has no tag', async () => {
    routes = { '/': html('<head><title>no tag</title></head>'), [WELL_KNOWN_PATH]: text(TOKEN) };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.VERIFIED,
    );
  });

  it('accepts the legacy HTML file with the historical body format', async () => {
    routes = {
      '/': html('<head></head>'),
      [LEGACY_FILE_PATH]: text(`replyiq-verify:${TOKEN}`),
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.VERIFIED,
    );
  });

  it('accepts the legacy path holding a bare token', async () => {
    routes = { '/': html('<head></head>'), [LEGACY_FILE_PATH]: text(`  ${TOKEN}\n`) };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.VERIFIED,
    );
  });

  it('reports MISMATCH when a file holds another workspace token', async () => {
    routes = {
      '/': html('<head></head>'),
      [WELL_KNOWN_PATH]: text('replyiq-verify-somebody-elses-token'),
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.MISMATCH,
    );
  });
});

describe('website verification: nothing published', () => {
  it('reports PENDING when the site is reachable but bare', async () => {
    routes = { '/': html('<html><body>Welcome</body></html>') };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.PENDING,
    );
  });

  it('reports PENDING when every path 404s', async () => {
    routes = {};
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.PENDING,
    );
  });

  it('reports PENDING for a 500, which is the site’s problem and not a typo', async () => {
    routes = {
      '/': (res) => {
        res.writeHead(500);
        res.end('boom');
      },
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.PENDING,
    );
  });

  it('reports PENDING for an oversized body rather than buffering it', async () => {
    routes = {
      '/': (res) => {
        res.writeHead(200, { 'content-type': 'text/html' });
        // 1 MB with no tag: must hit the 512 KB cap and abort the read.
        res.end('x'.repeat(1024 * 1024));
      },
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.PENDING,
    );
  }, 20_000);
});

describe('website verification: redirects', () => {
  it('follows a redirect within the hop budget', async () => {
    routes = {
      '/': (res) => {
        res.writeHead(302, { location: `http://${HOST}/real-home` });
        res.end();
      },
      '/real-home': html(`<meta name="replyiq-verification" content="${TOKEN}">`),
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.VERIFIED,
    );
  });

  it('gives up on a redirect loop instead of following it forever', async () => {
    routes = {
      '/': (res) => {
        res.writeHead(302, { location: `http://${HOST}/` });
        res.end();
      },
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.PENDING,
    );
  }, 20_000);

  it('refuses a redirect that leaves the allowed scheme or port', async () => {
    // assertSafeHop runs on every logical hop even under the fixture override,
    // so an open redirect cannot be used to reach an internal service.
    routes = {
      '/': (res) => {
        res.writeHead(302, { location: 'http://internal.service.test:8080/admin' });
        res.end();
      },
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.PENDING,
    );
  });

  it('refuses a redirect to a non-http scheme', async () => {
    routes = {
      '/': (res) => {
        res.writeHead(302, { location: 'file:///etc/passwd' });
        res.end();
      },
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.PENDING,
    );
  });

  it('refuses a redirect to a raw IP literal', async () => {
    routes = {
      '/': (res) => {
        res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
      },
    };
    await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
      VerificationOutcome.PENDING,
    );
  });
});

describe('the fixture override is inert outside NODE_ENV=test', () => {
  it('is ignored in production, so no configuration can redirect a real fetch', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      routes = { '/': html(`<meta name="replyiq-verification" content="${TOKEN}">`) };
      // With the override inert, `fixture.example.test` is resolved for real.
      // It is an IANA-reserved name that cannot resolve, so the outcome is
      // PENDING - proving the fixture server was never contacted.
      await expect(service.verifyHtmlMeta(HOST, TOKEN)).resolves.toBe(
        VerificationOutcome.PENDING,
      );
    } finally {
      process.env.NODE_ENV = original;
    }
  }, 20_000);
});
