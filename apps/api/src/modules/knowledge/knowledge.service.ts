import { Inject, Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { PrismaClient } from '@replyiq/database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { SiteIngestionService } from './site-ingestion.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { AuditService } from '../../infrastructure/audit/audit.service.js';
import { AuditEvent } from '../../infrastructure/audit/audit.service.js';
import { ErrorCode, codedBadRequest, codedNotFound } from '../../common/errors/error-codes.js';
import type { ActorContext } from '../domain/domain.service.js';

export interface KnowledgeItemView {
  id: string;
  question: string | null;
  content: string;
  isEdited: boolean;
  position: number;
}

export interface KnowledgeSourceView {
  id: string;
  type: string;
  status: string;
  url: string | null;
  title: string | null;
  lastFetchedAt: Date | null;
  failureReason: string | null;
  items: KnowledgeItemView[];
}

export interface KnowledgeSummary {
  /** True while at least one source is still being fetched, so the UI polls. */
  isIngesting: boolean;
  sourceCount: number;
  itemCount: number;
  /** Sources that failed, so the owner can see what we couldn't read. */
  failedCount: number;
}

export interface SearchHit {
  id: string;
  question: string | null;
  content: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  rank: number;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly ingestion: SiteIngestionService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Read
  // ─────────────────────────────────────────────────────────────────────────

  async list(businessId: string, organizationId: string) {
    await this.ensureAccess(businessId, organizationId);

    const sources = await this.prisma.knowledgeSource.findMany({
      where: { businessId, deletedAt: null },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });

    const itemCount = sources.reduce((total, source) => total + source.items.length, 0);
    const summary: KnowledgeSummary = {
      isIngesting: sources.some((s) => s.status === 'PENDING' || s.status === 'FETCHING'),
      sourceCount: sources.length,
      itemCount,
      failedCount: sources.filter((s) => s.status === 'FAILED').length,
    };

    return {
      success: true,
      message: 'Knowledge retrieved successfully',
      data: {
        summary,
        sources: sources.map((source): KnowledgeSourceView => ({
          id: source.id,
          type: source.type,
          status: source.status,
          url: source.url,
          title: source.title,
          lastFetchedAt: source.lastFetchedAt,
          failureReason: source.failureReason,
          items: source.items.map((item) => ({
            id: item.id,
            question: item.question,
            content: item.content,
            isEdited: item.isEdited,
            position: item.position,
          })),
        })),
      },
    };
  }

  /**
   * Rank knowledge against a question.
   *
   * Postgres full-text rather than embeddings, deliberately. It is honest about
   * what it is - keyword matching with sensible stemming - it needs no vector
   * infrastructure or per-query API cost, and it proves the retrieval loop end
   * to end. When the AI layer lands it will rank *against* this, not replace
   * it: hybrid keyword + vector beats either alone, and this is the half that
   * never hallucinates a match.
   *
   * Weighted A/B so a hit in the heading outranks a hit in the body - a section
   * titled "Opening hours" is a better answer than one that mentions hours in
   * passing.
   */
  async search(
    businessId: string,
    organizationId: string,
    query: string,
  ): Promise<{ success: boolean; message: string; data: { hits: SearchHit[] } }> {
    await this.ensureAccess(businessId, organizationId);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return { success: true, message: 'No query', data: { hits: [] } };
    }

    // Parameterised by Prisma's tagged template - `trimmed` is never
    // interpolated into the SQL text. plainto_tsquery also treats the input as
    // words rather than tsquery syntax, so a user cannot inject operators.
    const hits = await this.prisma.$queryRaw<SearchHit[]>`
      SELECT
        i."id",
        i."question",
        i."content",
        s."title" AS "sourceTitle",
        s."url"   AS "sourceUrl",
        ts_rank(
          setweight(to_tsvector('english', coalesce(i."question", '')), 'A') ||
          setweight(to_tsvector('english', coalesce(i."content",  '')), 'B'),
          plainto_tsquery('english', ${trimmed})
        ) AS "rank"
      FROM "knowledge_items" i
      JOIN "knowledge_sources" s ON s."id" = i."sourceId"
      WHERE i."businessId" = ${businessId}::uuid
        AND i."deletedAt" IS NULL
        AND s."deletedAt" IS NULL
        AND (
          setweight(to_tsvector('english', coalesce(i."question", '')), 'A') ||
          setweight(to_tsvector('english', coalesce(i."content",  '')), 'B')
        ) @@ plainto_tsquery('english', ${trimmed})
      ORDER BY "rank" DESC, i."position" ASC
      LIMIT 10
    `;

    return { success: true, message: 'Search completed', data: { hits } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ingestion
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read the business's verified website into the knowledge base.
   *
   * Returns as soon as the crawl is scheduled. The work runs in the background
   * and progress is visible through each source's status, which the UI polls -
   * a request that blocked for a minute while we crawled twelve pages would
   * time out on most proxies and tell the user nothing while it did.
   *
   * Single-instance limitation, stated plainly: there is no job queue, so a
   * restart mid-crawl leaves sources stuck in FETCHING. Re-running ingestion
   * clears them. A durable queue is the Milestone 8 answer.
   */
  async startIngestion(businessId: string, actor: ActorContext) {
    await this.ensureAccess(businessId, actor.organizationId);

    const domain = await this.prisma.businessDomain.findFirst({
      where: { businessId, status: 'VERIFIED', deletedAt: null, isSandbox: false },
      orderBy: [{ isPrimary: 'desc' }, { verifiedAt: 'asc' }],
    });

    if (!domain) {
      // Distinguish "you have nothing verified" from "the only thing you have
      // verified is a test address" - they need different next actions.
      const sandboxOnly = await this.prisma.businessDomain.count({
        where: { businessId, status: 'VERIFIED', deletedAt: null, isSandbox: true },
      });
      throw codedBadRequest(
        sandboxOnly > 0
          ? ErrorCode.KNOWLEDGE_SANDBOX_DOMAIN
          : ErrorCode.KNOWLEDGE_NO_VERIFIED_DOMAIN,
        sandboxOnly > 0
          ? 'Test domains have no website to read'
          : 'A verified domain is required before reading a website',
      );
    }

    await this.audit.record({
      event: AuditEvent.KNOWLEDGE_INGESTION_STARTED,
      organizationId: actor.organizationId,
      userId: actor.userId,
      businessId,
      resourceType: 'BusinessDomain',
      resourceId: domain.id,
      metadata: { domain: domain.domain },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    // Fire and forget. `ingestDomain` resolves rather than throwing, so this
    // cannot become an unhandled rejection; the catch is belt and braces.
    void this.ingestion
      .ingestDomain(businessId, domain.id, domain.domain)
      .catch((error: unknown) => {
        this.logger.error(
          `Background ingestion crashed for ${domain.domain}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });

    return {
      success: true,
      message: 'Reading your website',
      data: { domain: domain.domain },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Owner-authored knowledge
  // ─────────────────────────────────────────────────────────────────────────

  async createFaq(
    businessId: string,
    actor: ActorContext,
    input: { question: string; answer: string },
  ) {
    await this.ensureAccess(businessId, actor.organizationId);

    // All hand-written answers live under one source, so the UI can show them
    // as a single "Written by you" group rather than one card per answer.
    const source = await this.prisma.knowledgeSource.upsert({
      where: { businessId_url: { businessId, url: FAQ_SOURCE_KEY } },
      create: {
        businessId,
        type: 'FAQ',
        status: 'READY',
        url: FAQ_SOURCE_KEY,
        title: 'Written by you',
      },
      update: { deletedAt: null, status: 'READY' },
    });

    const last = await this.prisma.knowledgeItem.findFirst({
      where: { sourceId: source.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const item = await this.prisma.knowledgeItem.create({
      data: {
        businessId,
        sourceId: source.id,
        question: input.question,
        content: input.answer,
        isEdited: true,
        position: (last?.position ?? -1) + 1,
      },
    });

    return {
      success: true,
      message: 'Answer added',
      data: { item: this.formatItem(item) },
    };
  }

  async updateItem(
    businessId: string,
    itemId: string,
    organizationId: string,
    input: { question?: string; content?: string },
  ) {
    await this.ensureAccess(businessId, organizationId);
    await this.requireItem(businessId, itemId);

    const updated = await this.prisma.knowledgeItem.update({
      where: { id: itemId },
      data: {
        ...(input.question !== undefined && { question: input.question }),
        ...(input.content !== undefined && { content: input.content }),
        // Marks it as human-authored so a future re-crawl leaves it alone.
        isEdited: true,
      },
    });

    return { success: true, message: 'Answer updated', data: { item: this.formatItem(updated) } };
  }

  async deleteItem(businessId: string, itemId: string, organizationId: string) {
    await this.ensureAccess(businessId, organizationId);
    await this.requireItem(businessId, itemId);

    await this.prisma.knowledgeItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    return { success: true, message: 'Answer removed', data: {} };
  }

  async deleteSource(businessId: string, sourceId: string, organizationId: string) {
    await this.ensureAccess(businessId, organizationId);

    const source = await this.prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source || source.deletedAt || source.businessId !== businessId) {
      throw codedNotFound(ErrorCode.KNOWLEDGE_NOT_FOUND, 'Knowledge source not found');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.knowledgeItem.updateMany({
        where: { sourceId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.knowledgeSource.update({ where: { id: sourceId }, data: { deletedAt: now } }),
    ]);

    return { success: true, message: 'Source removed', data: {} };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private formatItem(item: {
    id: string;
    question: string | null;
    content: string;
    isEdited: boolean;
    position: number;
  }): KnowledgeItemView {
    return {
      id: item.id,
      question: item.question,
      content: item.content,
      isEdited: item.isEdited,
      position: item.position,
    };
  }

  private async requireItem(businessId: string, itemId: string) {
    const item = await this.prisma.knowledgeItem.findUnique({ where: { id: itemId } });
    if (!item || item.deletedAt || item.businessId !== businessId) {
      throw codedNotFound(ErrorCode.KNOWLEDGE_NOT_FOUND, 'Knowledge item not found');
    }
    return item;
  }

  /** Defence in depth behind OrganizationGuard, matching the domain module. */
  private async ensureAccess(businessId: string, organizationId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { organizationId: true },
    });
    if (!business || business.organizationId !== organizationId) {
      throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'Business not found');
    }
  }
}

/**
 * Sentinel `url` for the single hand-written FAQ source.
 *
 * The unique index is on (businessId, url), and Postgres treats NULLs as
 * distinct - so a null url would allow unlimited duplicate FAQ sources. A
 * reserved non-URL string gives the upsert something to key on. It never
 * escapes the API: the response exposes `type`, not this value.
 */
const FAQ_SOURCE_KEY = 'internal:owner-authored';

export { FAQ_SOURCE_KEY };
