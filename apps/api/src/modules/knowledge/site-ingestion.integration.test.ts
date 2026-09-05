import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@replyiq/database';
import type { PrismaClient } from '@replyiq/database';
import { SafeHttpService } from '../../common/security/safe-http.service.js';
import { SiteIngestionService } from './site-ingestion.service.js';

/**
 * Drives the real crawler against a local fixture site: real HTTP round trips,
 * the real SSRF-guarded client, the real extractor, the real database writes.
 *
 * The only substitution is the dial target (FR-TEST-13), because a loopback
 * address can never survive the SSRF guard - correctly. Everything else,
 * including per-hop validation, redirect handling and the body cap, is live.
 */

const HOST = 'fixture-site.example.test';

let routes: Record<string, (res: ServerResponse) => void> = {};
let server: Server;
let ingestion: SiteIngestionService;

function html(body: string): (res: ServerResponse) => void {
  return (res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><title>Harbour Dental</title></head><body>${body}</body></html>`);
  };
}

interface Ctx {
  organizationId: string;
  businessId: string;
  domainId: string;
}

async function provision(): Promise<Ctx> {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({ data: { name: `HARDEN-ORG-${suffix}` } });
  const business = await prisma.business.create({
    data: { organizationId: organization.id, name: `Harden Biz ${suffix}` },
  });
  const domain = await prisma.businessDomain.create({
    data: {
      businessId: business.id,
      domain: HOST,
      status: 'VERIFIED',
      verifiedAt: new Date(),
      verificationMethod: 'DNS_TXT',
      // Forced false so the LIVE crawl path is the one under test; the fixture
      // override is what actually keeps the traffic local.
      isSandbox: false,
      verificationToken: 'replyiq-verify-fixture',
    },
  });
  return { organizationId: organization.id, businessId: business.id, domainId: domain.id };
}

async function cleanup(organizationId: string) {
  const businesses = await prisma.business.findMany({ where: { organizationId }, select: { id: true } });
  const ids = businesses.map((b) => b.id);
  await prisma.knowledgeItem.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.knowledgeSource.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.businessDomain.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { organizationId } });
  await prisma.business.deleteMany({ where: { id: { in: ids } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
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
  const config = new ConfigService({
    DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE: `http://127.0.0.1:${port}`,
  });
  ingestion = new SiteIngestionService(prisma as PrismaClient, new SafeHttpService(config));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  routes = {};
});

describe('crawling a verified site', () => {
  it('reads the homepage and follows same-origin links', async () => {
    routes = {
      '/': html(`
        <h1>Harbour Dental</h1>
        <p>We have looked after families on the harbour front since 2004, and we are still here.</p>
        <a href="/opening-hours">Opening hours</a>
        <a href="/prices">Prices</a>
        <a href="https://somewhere-else.example.test/x">Not ours</a>
      `),
      '/opening-hours': html(`
        <h2>Opening hours</h2>
        <p>Monday to Friday, nine in the morning until five in the afternoon. Saturday mornings by appointment.</p>
      `),
      '/prices': html(`
        <h2>What we charge</h2>
        <p>A check-up is thirty-five pounds. Hygienist appointments are fifty pounds for half an hour.</p>
      `),
    };

    const ctx = await provision();
    try {
      const outcome = await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);

      expect(outcome.pagesFetched).toBe(3);
      expect(outcome.failures).toBe(0);

      const sources = await prisma.knowledgeSource.findMany({
        where: { businessId: ctx.businessId },
        include: { items: true },
      });
      expect(sources).toHaveLength(3);
      expect(sources.every((s) => s.status === 'READY')).toBe(true);
      // The off-origin link must never have been followed: the entitlement to
      // crawl comes from THIS business proving it controls THIS domain.
      expect(sources.some((s) => s.url?.includes('somewhere-else'))).toBe(false);

      const hours = sources.find((s) => s.url?.endsWith('/opening-hours'));
      expect(hours?.items[0]?.question).toBe('Opening hours');
      expect(hours?.items[0]?.content).toContain('nine in the morning');
    } finally {
      await cleanup(ctx.organizationId);
    }
  });

  it('records a page it could not read, with a reason the owner can act on', async () => {
    routes = {
      '/': html('<h1>Home</h1><p>Welcome to the practice on the harbour front, established 2004.</p><a href="/gone">Gone</a>'),
      // /gone is deliberately absent -> 404
    };

    const ctx = await provision();
    try {
      const outcome = await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);
      expect(outcome.pagesFetched).toBe(1);
      expect(outcome.failures).toBe(1);

      const failed = await prisma.knowledgeSource.findFirst({
        where: { businessId: ctx.businessId, status: 'FAILED' },
      });
      expect(failed?.url).toContain('/gone');
      expect(failed?.failureReason).toBe('This page was not found.');
      // Owner-facing wording only - no status codes, no fetch internals.
      expect(failed?.failureReason).not.toMatch(/\d{3}|fetch|ECONN/i);
    } finally {
      await cleanup(ctx.organizationId);
    }
  });

  it('never overwrites an answer the owner has edited', async () => {
    routes = {
      '/': html('<h2>Opening hours</h2><p>The original text that was scraped from the website first time.</p>'),
    };

    const ctx = await provision();
    try {
      await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);

      const item = await prisma.knowledgeItem.findFirstOrThrow({
        where: { businessId: ctx.businessId },
      });
      await prisma.knowledgeItem.update({
        where: { id: item.id },
        data: { content: 'Corrected by the owner', isEdited: true },
      });

      // The site changed since the first read.
      routes['/'] = html('<h2>Opening hours</h2><p>Completely different text on the website the second time around.</p>');
      await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);

      const survived = await prisma.knowledgeItem.findUnique({ where: { id: item.id } });
      // Silently undoing someone's correction is the fastest way to lose their
      // trust in the whole feature.
      expect(survived?.content).toBe('Corrected by the owner');

      const all = await prisma.knowledgeItem.findMany({ where: { businessId: ctx.businessId } });
      expect(all.some((i) => i.content.includes('second time around'))).toBe(true);
    } finally {
      await cleanup(ctx.organizationId);
    }
  });

  it('re-reading updates a page in place rather than duplicating it', async () => {
    routes = { '/': html('<h2>About</h2><p>The first version of our about page, with enough text to count.</p>') };

    const ctx = await provision();
    try {
      await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);
      await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);
      await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);

      const sources = await prisma.knowledgeSource.findMany({
        where: { businessId: ctx.businessId },
      });
      expect(sources).toHaveLength(1);

      const items = await prisma.knowledgeItem.findMany({
        where: { businessId: ctx.businessId, deletedAt: null },
      });
      expect(items).toHaveLength(1);
    } finally {
      await cleanup(ctx.organizationId);
    }
  });

  it('stops at the page cap however many links the site has', async () => {
    const links = Array.from({ length: 40 }, (_, i) => `<a href="/p${i}">Page ${i}</a>`).join('');
    routes = { '/': html(`<h1>Index</h1><p>A page of links to many other pages on this site.</p>${links}`) };
    for (let i = 0; i < 40; i++) {
      routes[`/p${i}`] = html(`<h2>Page ${i}</h2><p>Some genuinely substantial content on page number ${i} here.</p>`);
    }

    const ctx = await provision();
    try {
      const outcome = await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);
      // Bounded for the site owner's sake as much as ours.
      expect(outcome.pagesFetched).toBeLessThanOrEqual(12);
    } finally {
      await cleanup(ctx.organizationId);
    }
  }, 60_000);

  it('reports a page with no readable text instead of storing nothing silently', async () => {
    routes = { '/': html('<nav><a href="/">Home</a></nav><footer>Copyright</footer>') };

    const ctx = await provision();
    try {
      await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);
      const source = await prisma.knowledgeSource.findFirstOrThrow({
        where: { businessId: ctx.businessId },
      });
      expect(source.status).toBe('FAILED');
      expect(source.failureReason).toContain('readable text');
    } finally {
      await cleanup(ctx.organizationId);
    }
  });

  it('refuses a response that is not a web page', async () => {
    routes = {
      '/': (res) => {
        res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end('%PDF-1.4 not actually html');
      },
    };

    const ctx = await provision();
    try {
      await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);
      const source = await prisma.knowledgeSource.findFirstOrThrow({
        where: { businessId: ctx.businessId },
      });
      expect(source.status).toBe('FAILED');
      expect(source.failureReason).toBe('This address is not a web page.');
    } finally {
      await cleanup(ctx.organizationId);
    }
  });
});

describe('search over ingested knowledge', () => {
  it('ranks a heading match above a passing mention', async () => {
    routes = {
      '/': html(`
        <h2>Opening hours</h2>
        <p>We are open Monday to Friday from nine until five, and Saturday mornings.</p>
      `),
      '/about': html(`
        <h2>About the practice</h2>
        <p>A family practice since 2004. Our opening hours are listed on the hours page somewhere.</p>
      `),
    };
    routes['/'] = html(`
      <h2>Opening hours</h2>
      <p>We are open Monday to Friday from nine until five, and Saturday mornings.</p>
      <a href="/about">About</a>
    `);

    const ctx = await provision();
    try {
      await ingestion.ingestDomain(ctx.businessId, ctx.domainId, HOST);

      // The same full-text expression the service uses.
      const hits = await prisma.$queryRaw<Array<{ question: string | null; rank: number }>>`
        SELECT i."question",
               ts_rank(
                 setweight(to_tsvector('english', coalesce(i."question", '')), 'A') ||
                 setweight(to_tsvector('english', coalesce(i."content",  '')), 'B'),
                 plainto_tsquery('english', 'opening hours')
               ) AS "rank"
        FROM "knowledge_items" i
        WHERE i."businessId" = ${ctx.businessId}::uuid
          AND (
            setweight(to_tsvector('english', coalesce(i."question", '')), 'A') ||
            setweight(to_tsvector('english', coalesce(i."content",  '')), 'B')
          ) @@ plainto_tsquery('english', 'opening hours')
        ORDER BY "rank" DESC
      `;

      expect(hits.length).toBeGreaterThan(0);
      // A section titled "Opening hours" beats one that merely mentions them.
      expect(hits[0]?.question).toBe('Opening hours');
    } finally {
      await cleanup(ctx.organizationId);
    }
  });
});
