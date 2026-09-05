import { Inject, Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { PrismaClient } from '@replyiq/database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { SafeHttpService } from '../../common/security/safe-http.service.js';
import { DnsResolutionError, SsrfViolationError } from '../../common/security/ssrf-guard.js';
import { HttpStatusError } from '../../common/security/safe-http.service.js';
import { extractPage } from './html-extract.js';

/**
 * Reads a business's own verified website and turns it into knowledge.
 *
 * This is the product wedge (18-DIFFERENTIATION.md, D1). Every competitor's
 * onboarding says "now upload some documents", which is the step where trials
 * die - the owner has never written their FAQs down and quietly closes the tab.
 * Because we made them prove domain ownership, we can legitimately read the
 * site and have the receptionist know their services and hours before they have
 * done anything.
 *
 * ── Entitlement ───────────────────────────────────────────────────────────
 * We crawl ONLY domains this business has verified, and only same-origin URLs
 * within them. That is the whole basis for doing this at all: a competitor with
 * a URL someone typed into a box has no such claim.
 *
 * ── Politeness and safety ─────────────────────────────────────────────────
 * Bounded pages, bounded time, bounded body size, one request at a time, and
 * every fetch through the same SSRF guard the verification path uses.
 */

/** Enough to cover a small-business site's substantive pages. */
const MAX_PAGES = 12;
/** Total wall-clock budget for one ingestion run. */
const RUN_BUDGET_MS = 60_000;
/** Per-page body cap. Marketing pages are heavy; knowledge is not. */
const MAX_PAGE_BYTES = 512 * 1024;
/** Gap between requests. We are a guest on someone's server. */
const POLITENESS_DELAY_MS = 250;

export interface IngestionOutcome {
  pagesFetched: number;
  itemsCreated: number;
  failures: number;
}

@Injectable()
export class SiteIngestionService {
  private readonly logger = new Logger(SiteIngestionService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly http: SafeHttpService,
  ) {}

  /**
   * Crawl `domain` and write what it says into the knowledge base.
   *
   * Intended to be called in the background; it resolves rather than throwing
   * so a caller that does not await it cannot produce an unhandled rejection.
   * Progress is visible through KnowledgeSource.status, which the UI polls.
   */
  async ingestDomain(
    businessId: string,
    domainId: string,
    hostname: string,
  ): Promise<IngestionOutcome> {
    const outcome: IngestionOutcome = { pagesFetched: 0, itemsCreated: 0, failures: 0 };
    const controller = new AbortController();
    const budget = setTimeout(() => controller.abort(), RUN_BUDGET_MS);

    try {
      const start = new URL(`https://${hostname}/`);
      const queue: string[] = [start.toString()];
      const seen = new Set<string>([normalizeUrl(start.toString())]);

      while (queue.length > 0 && outcome.pagesFetched < MAX_PAGES) {
        if (controller.signal.aborted) break;
        const next = queue.shift();
        if (!next) break;

        const result = await this.ingestPage(
          businessId,
          domainId,
          new URL(next),
          controller.signal,
        );

        if (result === null) {
          outcome.failures += 1;
        } else {
          outcome.pagesFetched += 1;
          outcome.itemsCreated += result.itemsCreated;
          // Breadth-first: a small site's most useful pages are almost always
          // one click from the homepage.
          for (const link of result.links) {
            const key = normalizeUrl(link);
            if (seen.has(key)) continue;
            seen.add(key);
            if (seen.size <= MAX_PAGES * 3) queue.push(link);
          }
        }

        await delay(POLITENESS_DELAY_MS, controller.signal);
      }
    } catch (error) {
      this.logger.warn(
        `Ingestion run failed for ${hostname}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      clearTimeout(budget);
    }

    this.logger.log(
      `Ingested ${hostname}: ${outcome.pagesFetched} pages, ${outcome.itemsCreated} items, ${outcome.failures} failures`,
    );
    return outcome;
  }

  /** Fetch and store one page. Returns null when the page could not be used. */
  private async ingestPage(
    businessId: string,
    domainId: string,
    url: URL,
    signal: AbortSignal,
  ): Promise<{ itemsCreated: number; links: string[] } | null> {
    // Record the attempt first, so a page that fails is still visible to the
    // owner with a reason rather than silently missing.
    const source = await this.prisma.knowledgeSource.upsert({
      where: { businessId_url: { businessId, url: url.toString() } },
      create: {
        businessId,
        domainId,
        type: 'SITE_PAGE',
        status: 'FETCHING',
        url: url.toString(),
      },
      update: { status: 'FETCHING', failureReason: null, deletedAt: null },
    });

    let html: string;
    try {
      const response = await this.http.fetchText(url, {
        signal,
        maxBytes: MAX_PAGE_BYTES,
        accept: 'text/html,application/xhtml+xml',
      });
      // A PDF or image behind an HTML-looking URL is not a parse failure, it is
      // simply not a page. Say so plainly rather than storing gibberish.
      if (response.contentType && !/text\/html|application\/xhtml/i.test(response.contentType)) {
        await this.markFailed(source.id, 'This address is not a web page.');
        return null;
      }
      html = response.body;
    } catch (error) {
      // The owner sees describeFailure()'s plain-English version; the real
      // reason belongs in the log, where an operator can actually act on it.
      this.logger.warn(
        `Fetch failed for ${url.toString()}: ${
          error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        }`,
      );
      await this.markFailed(source.id, this.describeFailure(error));
      return null;
    }

    const page = extractPage(html, url);
    if (page.sections.length === 0) {
      await this.markFailed(source.id, 'We could not find any readable text on this page.');
      return null;
    }

    const itemsCreated = await this.replaceItems(businessId, source.id, page.sections);

    await this.prisma.knowledgeSource.update({
      where: { id: source.id },
      data: {
        status: 'READY',
        title: page.title ?? url.pathname,
        lastFetchedAt: new Date(),
        failureReason: null,
      },
    });

    return { itemsCreated, links: page.links };
  }

  /**
   * Replace a source's generated items, preserving anything the owner edited.
   *
   * A re-crawl overwriting a human correction would silently undo their work,
   * which is the fastest way to lose trust in the whole feature. Edited items
   * survive; only machine-generated ones are refreshed.
   */
  private async replaceItems(
    businessId: string,
    sourceId: string,
    sections: Array<{ heading: string | null; content: string }>,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.knowledgeItem.deleteMany({ where: { sourceId, isEdited: false } });

      const edited = await tx.knowledgeItem.count({
        where: { sourceId, isEdited: true, deletedAt: null },
      });

      await tx.knowledgeItem.createMany({
        data: sections.map((section, index) => ({
          businessId,
          sourceId,
          question: section.heading,
          content: section.content,
          position: edited + index,
        })),
      });

      return sections.length;
    });
  }

  private async markFailed(sourceId: string, reason: string): Promise<void> {
    await this.prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: 'FAILED', failureReason: reason, lastFetchedAt: new Date() },
    });
  }

  /**
   * Turn a fetch failure into something the owner can act on.
   *
   * Deliberately vague about network specifics for the same reason the
   * verification path is: the reason a host did not respond is not the
   * requester's business. But unlike verification, the requester here owns the
   * site, so a plain "we couldn't load it" is both safe and genuinely useful.
   */
  private describeFailure(error: unknown): string {
    if (error instanceof SsrfViolationError || error instanceof DnsResolutionError) {
      return 'We could not reach this address from the public internet.';
    }
    if (error instanceof HttpStatusError) {
      return error.status === 404
        ? 'This page was not found.'
        : `Your site returned an error (${error.status}) for this page.`;
    }
    if (error instanceof Error && /byte limit/.test(error.message)) {
      return 'This page was too large for us to read.';
    }
    return 'We could not load this page.';
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').toLowerCase();
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
