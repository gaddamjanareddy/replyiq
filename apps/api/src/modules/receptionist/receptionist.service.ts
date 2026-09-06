import { Inject, Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { Prisma, PrismaClient } from '@replyiq/database';
import { computeServiceMode } from '../../common/business/service-mode.js';
import { ErrorCode, codedForbidden, codedNotFound } from '../../common/errors/error-codes.js';
import {
  NO_KNOWLEDGE_TEXT,
  RetrievalAnswerEngine,
  type Answer,
  type AnswerEngine,
  type RetrievedPassage,
} from './answer-engine.js';
import { checkWidgetOrigin, type AllowedDomain } from './widget-origin.js';

/**
 * The public receptionist: the only part of the product a visitor ever meets.
 *
 * Everything here runs UNAUTHENTICATED, so each method assumes the caller is
 * hostile until the origin check says otherwise. The three rules:
 *
 *   1. Never answer for a business the origin has not proved it belongs to.
 *   2. Never answer real visitors on behalf of a business in Test Mode. That
 *      was recorded as a binding requirement when Test Mode was designed
 *      (16-DOMAIN-VERIFICATION-AND-TEST-MODE §6.5): a sandbox domain is not a
 *      real site, so anything reaching it is either the owner testing or
 *      someone poking at us.
 *   3. Never leak why a request was refused. A visitor gets one neutral
 *      message; the reason goes to the log where an operator can act on it.
 */

/** Guards what goes into the itemId column, which is a real uuid or nothing. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many passages retrieval hands the engine. */
const MAX_PASSAGES = 6;
/** Hard cap on a visitor's question. Long enough for a real one, short enough
 *  that the endpoint cannot be used to push work into the database. */
export const MAX_QUESTION_LENGTH = 500;

export interface AskResult extends Answer {
  /** Echoed so the widget can show a test-mode notice without a second call. */
  mode: 'LIVE' | 'TEST';
}

@Injectable()
export class ReceptionistService {
  private readonly logger = new Logger(ReceptionistService.name);
  private readonly engine: AnswerEngine = new RetrievalAnswerEngine();

  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  /**
   * Answer one visitor question.
   *
   * `origin` is the browser-set Origin header. See widget-origin.ts for what
   * that does and does not prove.
   */
  async ask(
    businessId: string,
    origin: string | undefined,
    question: string,
    sessionKey?: string,
    previousQuestion?: string,
    referer?: string,
  ): Promise<AskResult> {
    const { domains, mode } = await this.loadServingContext(businessId);

    // TEST mode businesses may be developed against from localhost; LIVE ones
    // never can. See widget-origin.ts.
    const decision = checkWidgetOrigin(origin, domains, {
      allowLocalhost: mode === 'TEST',
      referer,
    });

    if (!decision.allowed) {
      // One neutral refusal regardless of reason. Distinguishing "not verified"
      // from "no such business" would turn this into a directory of who uses
      // the product and on which domains.
      this.logger.warn(
        `Widget request refused for business ${businessId}: ${decision.reason} (origin: ${
          origin ?? 'none'
        })`,
      );
      throw codedForbidden(
        ErrorCode.WIDGET_ORIGIN_NOT_ALLOWED,
        'This receptionist is not available on this site.',
      );
    }

    // The session key is what marks this as real visitor traffic, so passing
    // it here is what makes the gap report exist at all. Dropping it fails
    // silently by design — the answer is still correct and nothing is logged —
    // which is exactly why this path is verified end to end rather than trusted.
    return this.answerFor(businessId, question, mode, sessionKey, previousQuestion);
  }

  /**
   * Retrieval and answering, shared by the public widget and the owner's
   * preview. Extracted so the two doors cannot drift: a preview that answers
   * differently from the live widget is worse than no preview.
   */
  private async answerFor(
    businessId: string,
    question: string,
    mode: 'LIVE' | 'TEST',
    sessionKey?: string,
    previousQuestion?: string,
  ): Promise<AskResult> {
    const trimmed = question.trim().slice(0, MAX_QUESTION_LENGTH);
    if (trimmed.length === 0) {
      return { mode, confidence: 'unknown', text: NO_KNOWLEDGE_TEXT, citations: [] };
    }

    const { passages, broadened } = await this.retrieve(businessId, trimmed, previousQuestion);

    // An empty knowledge base is the owner's problem to fix, and saying "I
    // don't know" would hide that behind what looks like a failed lookup.
    if (passages.length === 0) {
      const total = await this.prisma.knowledgeItem.count({
        where: { businessId, deletedAt: null },
      });
      if (total === 0) {
        return { mode, confidence: 'unknown', text: NO_KNOWLEDGE_TEXT, citations: [] };
      }
    }

    const answer = await this.engine.answer(trimmed, passages, { broadened });

    // Only real visitor traffic is recorded. An owner testing their own
    // wording in the dashboard would otherwise flood the gap report with
    // questions no customer ever asked, and the report is only useful if
    // everything in it came from outside.
    if (sessionKey) {
      void this.record(businessId, trimmed, answer.confidence, answer.citations[0]?.id, sessionKey);
    }

    return { ...answer, mode };
  }

  /**
   * Record a question, without ever making a visitor wait for it.
   *
   * Fire-and-forget and swallowing its own errors, deliberately. Analytics
   * must never delay an answer or turn a working reply into a failed request -
   * a visitor asking about opening hours should not see an error because a
   * write timed out.
   */
  private async record(
    businessId: string,
    question: string,
    confidence: string,
    itemId: string | undefined,
    sessionKey: string,
  ): Promise<void> {
    try {
      await this.prisma.receptionistQuestion.create({
        data: {
          businessId,
          question,
          confidence,
          // Only a real knowledge item id is stored; the engine's citation ids
          // are item ids, but a guard here keeps a future engine from writing
          // something that is not one.
          itemId: itemId && UUID_RE.test(itemId) ? itemId : null,
          sessionKey: sessionKey.slice(0, 64),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record a receptionist question: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Answer as the owner, from inside the dashboard.
   *
   * Deliberately skips the origin check and NOTHING else: the caller has
   * already proved who they are with a session and the organization guard, so
   * the browser-set Origin adds nothing. Retrieval, grounding, the relevance
   * floor and the refusal to invent are all identical — a preview that behaved
   * better than the real thing would be worse than no preview at all.
   */
  async preview(businessId: string, question: string): Promise<AskResult> {
    const { mode } = await this.loadServingContext(businessId);
    return this.answerFor(businessId, question, mode);
  }

  /**
   * The widget's own configuration: what it needs to render before anyone has
   * asked anything. Same origin rules as `ask`.
   */
  async config(
    businessId: string,
    origin: string | undefined,
    referer?: string,
  ): Promise<{ businessName: string; mode: 'LIVE' | 'TEST'; greeting: string }> {
    const { domains, mode, businessName } = await this.loadServingContext(businessId);
    const decision = checkWidgetOrigin(origin, domains, {
      allowLocalhost: mode === 'TEST',
      referer,
    });
    if (!decision.allowed) {
      throw codedForbidden(
        ErrorCode.WIDGET_ORIGIN_NOT_ALLOWED,
        'This receptionist is not available on this site.',
      );
    }
    return {
      businessName,
      mode,
      greeting: `Hi — I can answer questions about ${businessName}. What would you like to know?`,
    };
  }

  /**
   * What visitors have been asking, for the owner.
   *
   * Returns the gaps first and separately, because they are the only part
   * that is directly actionable: every unanswered question is one answer away
   * from being handled. A single undifferentiated list would bury them.
   */
  async insights(
    businessId: string,
    days = 30,
  ): Promise<{
    gaps: Array<{ question: string; askedAt: Date; timesAsked: number }>;
    recent: Array<{ question: string; confidence: string; askedAt: Date }>;
    totals: { asked: number; answered: number; unsure: number; unknown: number };
  }> {
    const since = new Date(Date.now() - days * 86_400_000);

    const [rows, grouped] = await Promise.all([
      this.prisma.receptionistQuestion.findMany({
        where: { businessId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { question: true, confidence: true, createdAt: true },
      }),
      this.prisma.receptionistQuestion.groupBy({
        by: ['confidence'],
        where: { businessId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    const count = (c: string) =>
      grouped.find((g) => g.confidence === c)?._count._all ?? 0;

    // Repeats are collapsed and counted: "asked nine times" is a far stronger
    // signal to the owner than the same line nine times over.
    const unanswered = await this.prisma.receptionistQuestion.groupBy({
      by: ['question'],
      where: { businessId, confidence: 'unknown', createdAt: { gte: since } },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { question: 'desc' } },
      take: 20,
    });

    return {
      gaps: unanswered.map((g) => ({
        question: g.question,
        askedAt: g._max.createdAt ?? since,
        timesAsked: g._count._all,
      })),
      recent: rows.map((r) => ({
        question: r.question,
        confidence: r.confidence,
        askedAt: r.createdAt,
      })),
      totals: {
        asked: grouped.reduce((n, g) => n + g._count._all, 0),
        answered: count('answered'),
        unsure: count('unsure'),
        unknown: count('unknown'),
      },
    };
  }

  /**
   * Load the business, the domains it may be served on, and its service mode.
   *
   * INACTIVE is refused with the same neutral error as a bad origin: a business
   * with no verified domain has nowhere legitimate to be embedded, so any
   * request claiming otherwise is already wrong.
   */
  private async loadServingContext(businessId: string): Promise<{
    businessName: string;
    domains: AllowedDomain[];
    mode: 'LIVE' | 'TEST';
  }> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: {
        name: true,
        domains: {
          where: { status: 'VERIFIED', deletedAt: null },
          select: { domain: true, isSandbox: true },
        },
      },
    });

    if (!business) {
      // Same shape of refusal as an origin failure, so probing business ids
      // cannot distinguish "does not exist" from "not allowed here".
      throw codedNotFound(
        ErrorCode.WIDGET_ORIGIN_NOT_ALLOWED,
        'This receptionist is not available on this site.',
      );
    }

    const mode = computeServiceMode(business.domains);
    if (mode === 'INACTIVE') {
      throw codedForbidden(
        ErrorCode.WIDGET_ORIGIN_NOT_ALLOWED,
        'This receptionist is not available on this site.',
      );
    }

    return { businessName: business.name, domains: business.domains, mode };
  }

  /**
   * Retrieval in two stages: precise first, broad only if that finds nothing.
   *
   * `plainto_tsquery` ANDs every term, which is far too strict for how people
   * actually ask. "When do you close on Saturday?" becomes `close & saturday`,
   * and an entry reading "open Monday to Friday... and Saturday mornings"
   * contains `saturday` but not `close` — so a question the business CAN
   * answer returned nothing at all. Found by asking it, not by reading it.
   *
   * Simply switching to OR fixes that and creates a worse problem: with OR,
   * one incidental word in common scores highly enough to look confident, so
   * the receptionist would answer "do you sell Saturday bicycles?" with the
   * opening hours. That is the invention this design exists to prevent.
   *
   * So: AND first, and only if it finds nothing, OR — with the result marked
   * `broadened` so the engine hedges rather than asserting. Precision when we
   * have it, an offered guess when we do not, and never a confident guess.
   */
  private async retrieve(
    businessId: string,
    query: string,
    previousQuestion?: string,
  ): Promise<{ passages: RetrievedPassage[]; broadened: boolean }> {
    const strict = await this.runRetrieval(businessId, query, false);
    if (strict.length > 0) return { passages: strict, broadened: false };

    const broad = await this.runRetrieval(businessId, query, true);
    if (broad.length > 0) return { passages: broad, broadened: true };

    /**
     * Last resort: read the question as a follow-up.
     *
     * "And on Sundays?" carries almost no searchable content on its own — the
     * subject lives in the question before it. Combining the two recovers the
     * dominant case in any real conversation, which is a short follow-up to
     * something already asked.
     *
     * Deliberately only reached when the question alone found NOTHING. Mixing
     * the previous question into every search would let stale context hijack a
     * clear new question: ask about hours, then about parking, and the parking
     * answer would be competing with hours terms for no reason.
     *
     * Always marked broadened, so a contextual hit is offered rather than
     * asserted. The receptionist guessed at what "and on Sundays" meant, and
     * the visitor should be able to see that it guessed.
     */
    const context = previousQuestion?.trim();
    if (!context) return { passages: [], broadened: false };

    const combined = `${context} ${query}`.slice(0, MAX_QUESTION_LENGTH * 2);
    const contextual = await this.runRetrieval(businessId, combined, true);
    return { passages: contextual, broadened: contextual.length > 0 };
  }

  /** One retrieval pass, scoped hard to one business. */
  private runRetrieval(
    businessId: string,
    query: string,
    broaden: boolean,
  ): Promise<RetrievedPassage[]> {
    /**
     * Both branches build the tsquery from `plainto_tsquery`, which parses the
     * visitor's text as WORDS rather than tsquery syntax — so no operator a
     * visitor types is ever interpreted. The broad branch then rewrites the
     * parsed query's `&` to `|`.
     *
     * Rewriting the already-parsed output rather than the raw input is what
     * keeps this safe: the visitor's text never reaches the query language,
     * and `plainto_tsquery` only ever emits `&` between lexemes, so there is
     * nothing else the replace could corrupt.
     */
    const tsquery = broaden
      ? Prisma.sql`replace(plainto_tsquery('english', ${query})::text, '&', '|')::tsquery`
      : Prisma.sql`plainto_tsquery('english', ${query})`;

    return this.prisma.$queryRaw<RetrievedPassage[]>`
      SELECT
        i."id",
        i."question",
        i."content",
        s."title" AS "sourceTitle",
        s."url"   AS "sourceUrl",
        ts_rank(
          setweight(to_tsvector('english', coalesce(i."question", '')), 'A') ||
          setweight(to_tsvector('english', coalesce(i."content",  '')), 'B'),
          ${tsquery}
        ) AS "rank"
      FROM "knowledge_items" i
      JOIN "knowledge_sources" s ON s."id" = i."sourceId"
      WHERE i."businessId" = ${businessId}::uuid
        AND i."deletedAt" IS NULL
        AND s."deletedAt" IS NULL
        AND (
          setweight(to_tsvector('english', coalesce(i."question", '')), 'A') ||
          setweight(to_tsvector('english', coalesce(i."content",  '')), 'B')
        ) @@ ${tsquery}
      ORDER BY "rank" DESC, i."position" ASC
      LIMIT ${MAX_PASSAGES}
    `;
  }
}
