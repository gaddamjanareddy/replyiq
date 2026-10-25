import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@replyiq/database';
import type { PrismaClient } from '@replyiq/database';
import { ReceptionistService } from './receptionist.service.js';
import { DELETED_PASSAGE_TEXT, DONT_KNOW_TEXT, HEDGE_TEXT } from './answer-engine.js';

/**
 * The receptionist against a real database.
 *
 * These cover the parts that cannot be checked without Postgres, and that are
 * subtle enough to regress silently: the retrieval ladder, the refusal to let
 * stale context hijack a clear question, and the fact that questions are
 * recorded at all.
 */

const ORIGIN = 'https://harbour-widget.example.com';

let service: ReceptionistService;
let organizationId: string;
let businessId: string;

beforeAll(async () => {
  service = new ReceptionistService(prisma as PrismaClient);

  const org = await prisma.organization.create({
    data: { name: `RECEPTION-ORG-${randomUUID().slice(0, 8)}` },
  });
  organizationId = org.id;

  const business = await prisma.business.create({
    data: { organizationId, name: 'Harbour Dental' },
  });
  businessId = business.id;

  // A real (non-sandbox) verified domain, so the business is LIVE and the
  // localhost exemption is off - the strict case.
  await prisma.businessDomain.create({
    data: {
      businessId,
      domain: 'harbour-widget.example.com',
      status: 'VERIFIED',
      isSandbox: false,
      verifiedAt: new Date(),
      verificationMethod: 'DNS_TXT',
      verificationToken: `replyiq-verify-${randomUUID()}`,
    },
  });

  const source = await prisma.knowledgeSource.create({
    data: {
      businessId,
      type: 'FAQ',
      status: 'READY',
      url: 'internal:owner-authored',
      title: 'Written by you',
    },
  });
  await prisma.knowledgeItem.createMany({
    data: [
      {
        businessId,
        sourceId: source.id,
        question: 'What are your opening hours?',
        content: 'We open Monday to Friday, 9am to 5:30pm.',
        position: 0,
      },
      {
        businessId,
        sourceId: source.id,
        question: 'Do you take NHS patients?',
        content: 'Yes, we have NHS availability for children.',
        position: 1,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.receptionistQuestion.deleteMany({ where: { businessId } });
  await prisma.knowledgeItem.deleteMany({ where: { businessId } });
  await prisma.knowledgeSource.deleteMany({ where: { businessId } });
  await prisma.businessDomain.deleteMany({ where: { businessId } });
  await prisma.business.deleteMany({ where: { id: businessId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
});

describe('the origin gate', () => {
  it('answers a verified origin', async () => {
    const answer = await service.ask(businessId, ORIGIN, 'what are your opening hours');
    expect(answer.confidence).toBe('answered');
    expect(answer.mode).toBe('LIVE');
  });

  it('refuses a suffix-confusion lookalike', async () => {
    await expect(
      service.ask(businessId, 'https://notharbour-widget.example.com', 'hours'),
    ).rejects.toMatchObject({ response: { code: 'WIDGET_ORIGIN_NOT_ALLOWED' } });
  });

  it('refuses localhost for a LIVE business', async () => {
    // The Test Mode asymmetry: only a sandbox-only business may be developed
    // against locally.
    await expect(
      service.ask(businessId, 'http://localhost:5173', 'hours'),
    ).rejects.toMatchObject({ response: { code: 'WIDGET_ORIGIN_NOT_ALLOWED' } });
  });
});

describe('the retrieval ladder', () => {
  it('answers confidently when every term matches', async () => {
    const answer = await service.ask(businessId, ORIGIN, 'what are your opening hours');
    expect(answer.confidence).toBe('answered');
  });

  it('hedges when it had to fall back to matching any term', async () => {
    // "close" appears nowhere in the entry, so an AND query finds nothing and
    // only the broadened pass can match on "saturday"-style overlap.
    const answer = await service.ask(businessId, ORIGIN, 'when do you close nhs');
    expect(answer.confidence).toBe('unsure');
  });

  it('admits ignorance for a question with nothing in common', async () => {
    const answer = await service.ask(businessId, ORIGIN, 'do you sell bicycles');
    expect(answer.confidence).toBe('unknown');
  });
});

describe('follow-up questions', () => {
  const FOLLOW_UP = 'and what about those';

  it('cannot answer a contentless follow-up on its own', async () => {
    const answer = await service.ask(businessId, ORIGIN, FOLLOW_UP);
    expect(answer.confidence).toBe('unknown');
  });

  it('recovers the subject from the previous question', async () => {
    const answer = await service.ask(
      businessId,
      ORIGIN,
      FOLLOW_UP,
      undefined,
      'when do you open',
    );
    expect(answer.text).toContain('Monday to Friday');
  });

  it('never presents a contextual guess as certain', async () => {
    // It guessed what "those" referred to. The visitor should be able to see
    // that it guessed.
    const answer = await service.ask(
      businessId,
      ORIGIN,
      FOLLOW_UP,
      undefined,
      'when do you open',
    );
    expect(answer.confidence).toBe('unsure');
  });

  it('follows the context it was given, not the last thing in the database', async () => {
    const answer = await service.ask(
      businessId,
      ORIGIN,
      FOLLOW_UP,
      undefined,
      'do you take NHS patients',
    );
    expect(answer.text).toContain('NHS');
  });

  it('does NOT let stale context hijack a clear question', async () => {
    // The whole reason context is a last resort rather than an ingredient:
    // a question that stands on its own must be answered on its own.
    const answer = await service.ask(
      businessId,
      ORIGIN,
      'do you take NHS patients',
      undefined,
      'what are your opening hours',
    );
    expect(answer.confidence).toBe('answered');
    expect(answer.text).toContain('NHS');
  });
});

describe('recording what was asked', () => {
  it('records a visitor question with its confidence', async () => {
    const sessionKey = `s${randomUUID().replace(/-/g, '')}`.slice(0, 40);
    await service.ask(businessId, ORIGIN, 'do you sell bicycles', sessionKey);

    // The write is fire-and-forget, so it may land just after the answer.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const rows = await prisma.receptionistQuestion.findMany({ where: { sessionKey } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.question).toBe('do you sell bicycles');
    expect(rows[0]?.confidence).toBe('unknown');
  });

  it('does not record the owner previewing their own wording', async () => {
    // A preview has no session key. Owner test questions in the gap report
    // would make it useless - the point is what real visitors asked.
    const before = await prisma.receptionistQuestion.count({ where: { businessId } });
    await service.preview(businessId, 'a question only the owner would type');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await prisma.receptionistQuestion.count({ where: { businessId } })).toBe(before);
  });

  it('surfaces unanswered questions as gaps, with repeats counted', async () => {
    const sessionKey = `g${randomUUID().replace(/-/g, '')}`.slice(0, 40);
    for (let i = 0; i < 2; i++) {
      await service.ask(businessId, ORIGIN, 'do you offer wedding catering', sessionKey);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));

    const insights = await service.insights(businessId);
    const gap = insights.gaps.find((g) => g.question === 'do you offer wedding catering');
    expect(gap?.timesAsked).toBe(2);
    expect(insights.totals.unknown).toBeGreaterThan(0);
  });
});

describe('what the widget is told before anyone asks', () => {
  it('offers the business own questions as a way in', async () => {
    const config = await service.config(businessId, ORIGIN);

    expect(config.businessName).toBe('Harbour Dental');
    // Both seeded items are real questions, so both are offered — and they
    // are the owner's own words, never generated.
    expect(config.suggestions).toContain('What are your opening hours?');
    expect(config.suggestions).toContain('Do you take NHS patients?');
    expect(config.suggestions.length).toBeLessThanOrEqual(3);
  });

  /**
   * A suggestion the receptionist cannot answer would be an invention we put
   * in the visitor's mouth — the worst kind, because they did not even choose
   * the words. Every suggestion must be answerable, so this asserts the round
   * trip rather than just the list.
   */
  it('suggests only questions it can actually answer', async () => {
    const config = await service.config(businessId, ORIGIN);
    for (const suggestion of config.suggestions) {
      const answer = await service.preview(businessId, suggestion);
      expect(answer.confidence).not.toBe('unknown');
    }
  });

  it('refuses to describe a business to an origin it has not verified', async () => {
    await expect(
      service.config(businessId, 'https://notharbour-widget.example.com'),
    ).rejects.toMatchObject({ response: { code: 'WIDGET_ORIGIN_NOT_ALLOWED' } });
  });
});

/**
 * The owner's verdict on an answer.
 *
 * This is the only way the product ever learns it got something wrong:
 * nothing automatic can tell, because the answer was the owner's own
 * published words returned faithfully, and whether they were the right words
 * for that question is a judgement only a person can make.
 */
describe('rating an answer', () => {
  const askAndFind = async (question: string) => {
    const sessionKey = `r${randomUUID().replace(/-/g, '')}`.slice(0, 40);
    await service.ask(businessId, ORIGIN, question, sessionKey);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const row = await prisma.receptionistQuestion.findFirstOrThrow({ where: { sessionKey } });
    return row;
  };

  it('shows the owner WHAT answered, so they are judging an answer not guessing', async () => {
    await askAndFind('what are your opening hours');

    const insights = await service.insights(businessId);
    const entry = insights.recent.find((r) => r.question === 'what are your opening hours');
    expect(entry?.answeredWith?.content).toBe('We open Monday to Friday, 9am to 5:30pm.');
    // Nobody has looked at it yet, which is not the same as it being fine.
    expect(entry?.verdict).toBeNull();
  });

  it('records a verdict and reports it in the summary', async () => {
    const row = await askAndFind('what are your opening hours');
    await service.rateAnswer(businessId, row.id, 'WRONG');

    const summary = await service.summary(businessId);
    expect(summary.markedWrong).toBeGreaterThan(0);
    // Both numbers, never just a percentage: "3% wrong" out of four reviewed
    // answers is noise dressed as a measurement.
    expect(summary.reviewed).toBeGreaterThanOrEqual(summary.markedWrong);
  });

  it('lets the owner undo a verdict', async () => {
    const row = await askAndFind('what are your opening hours');
    await service.rateAnswer(businessId, row.id, 'WRONG');
    await service.rateAnswer(businessId, row.id, null);

    const after = await prisma.receptionistQuestion.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.verdict).toBeNull();
  });

  /**
   * An unreviewed answer must never count as a good one. If it did, the
   * accuracy figure in STRATEGY.md §5 would improve every time somebody
   * ignored it, which is the opposite of a measurement.
   */
  it('does not count unreviewed answers as reviewed', async () => {
    const before = await service.summary(businessId);
    await askAndFind('what are your opening hours');
    const after = await service.summary(businessId);

    expect(after.asked).toBeGreaterThan(before.asked);
    expect(after.reviewed).toBe(before.reviewed);
  });

  it('refuses to rate a question belonging to another business', async () => {
    const row = await askAndFind('what are your opening hours');
    const otherOrg = await prisma.organization.create({
      data: { name: `RATE-OTHER-${randomUUID().slice(0, 8)}` },
    });
    const other = await prisma.business.create({
      data: { organizationId: otherOrg.id, name: 'Someone Else' },
    });

    await expect(service.rateAnswer(other.id, row.id, 'WRONG')).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
    });

    const untouched = await prisma.receptionistQuestion.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(untouched.verdict).toBeNull();

    await prisma.business.deleteMany({ where: { id: other.id } });
    await prisma.organization.deleteMany({ where: { id: otherOrg.id } });
  });
});

/**
 * The window arithmetic, against a real database.
 *
 * `computeTrend` is unit-tested; what cannot be is whether the two queries
 * actually select the two windows they claim to. An off-by-one here type
 * checks perfectly and produces a confident, wrong trend — the previous
 * window silently containing the current one makes every month look steady.
 *
 * Its own business, because these rows are backdated and would otherwise
 * show up in the summaries the tests above assert on.
 */
describe('the week-on-week comparison', () => {
  const DAY = 86_400_000;
  let trendBusinessId: string;
  let trendOrgId: string;

  /** Drop a recorded question `daysAgo` days into the past. */
  const record = async (confidence: string, daysAgo: number) => {
    await prisma.receptionistQuestion.create({
      data: {
        businessId: trendBusinessId,
        question: `seeded ${confidence} ${daysAgo}d`,
        confidence,
        sessionKey: `t${randomUUID().replace(/-/g, '')}`.slice(0, 40),
        createdAt: new Date(Date.now() - daysAgo * DAY),
      },
    });
  };

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `TREND-ORG-${randomUUID().slice(0, 8)}` },
    });
    trendOrgId = org.id;
    const business = await prisma.business.create({
      data: { organizationId: trendOrgId, name: 'Trend Dental' },
    });
    trendBusinessId = business.id;

    // This window: 8 of 10 answered.
    for (let i = 0; i < 8; i += 1) await record('answered', 5);
    for (let i = 0; i < 2; i += 1) await record('unknown', 5);

    // The window before: 5 of 10 answered.
    for (let i = 0; i < 5; i += 1) await record('answered', 40);
    for (let i = 0; i < 5; i += 1) await record('unknown', 40);

    // Older than both windows, and deliberately all failures. If the lower
    // bound is missing these land in "previous" and the product reports an
    // improvement the business did not earn.
    for (let i = 0; i < 20; i += 1) await record('unknown', 200);
  });

  afterAll(async () => {
    await prisma.receptionistQuestion.deleteMany({ where: { businessId: trendBusinessId } });
    await prisma.business.deleteMany({ where: { id: trendBusinessId } });
    await prisma.organization.deleteMany({ where: { id: trendOrgId } });
  });

  it('splits the two windows at the right boundary', async () => {
    const { trend } = await service.summary(trendBusinessId);

    expect(trend.current).toEqual({ asked: 10, answered: 8, unanswered: 2 });
    expect(trend.previous).toEqual({ asked: 10, answered: 5, unanswered: 5 });
    expect(trend.days).toBe(30);
  });

  it('ignores anything older than the previous window', async () => {
    // The twenty ancient failures are excluded, so `previous` is 50% and not
    // the 17% it would be if the lower bound were dropped.
    const { trend } = await service.summary(trendBusinessId);
    expect(trend.previousRate).toBe(50);
    expect(trend.rate).toBe(80);
  });

  it('reports the improvement the numbers support', async () => {
    // Thirty points on ten questions each way: comfortably past the noise
    // floor, which is ten points here.
    const { trend } = await service.summary(trendBusinessId);
    expect(trend.direction).toBe('BETTER');
  });

  it('reports the dashboard counts from the current window only', async () => {
    // The headline figures and the trend must not disagree about what "now"
    // means; they come from the same groupBy for exactly this reason.
    const summary = await service.summary(trendBusinessId);
    expect(summary.asked).toBe(10);
    expect(summary.answered).toBe(8);
    expect(summary.unanswered).toBe(2);
  });

  it('refuses to compare a business with no history', async () => {
    const org = await prisma.organization.create({
      data: { name: `TREND-NEW-${randomUUID().slice(0, 8)}` },
    });
    const fresh = await prisma.business.create({
      data: { organizationId: org.id, name: 'Opened Yesterday' },
    });

    const { trend } = await service.summary(fresh.id);
    expect(trend.direction).toBe('NO_COMPARISON');
    expect(trend.rate).toBeNull();

    await prisma.business.deleteMany({ where: { id: fresh.id } });
    await prisma.organization.deleteMany({ where: { id: org.id } });
  });

  it('honours a shorter window at both ends', async () => {
    // Seven days: the rows from five days ago are still in view, but the ones
    // from forty days ago are now outside the PREVIOUS window too — so there
    // is nothing to compare against rather than a trend borrowed from a month
    // that is no longer being asked about.
    const { trend } = await service.summary(trendBusinessId, 7);
    expect(trend.current.asked).toBe(10);
    expect(trend.previous.asked).toBe(0);
    expect(trend.direction).toBe('NO_COMPARISON');
    expect(trend.days).toBe(7);
  });
});

/**
 * Reading a visit back as the conversation it was.
 *
 * The grouping, the ordering and the reconstruction all need a real database:
 * `groupBy` ordered by an aggregate is the kind of query that typechecks and
 * then throws, and "most recent visits" is easy to write as "most recent
 * questions" without noticing until a busy conversation goes missing.
 */
describe('conversation transcripts', () => {
  let convBusinessId: string;
  let convOrgId: string;
  let itemId: string;

  /** One recorded question in a given visit, at a given age in minutes. */
  const turn = async (
    sessionKey: string,
    question: string,
    confidence: string,
    minutesAgo: number,
  ) => {
    await prisma.receptionistQuestion.create({
      data: {
        businessId: convBusinessId,
        question,
        confidence,
        sessionKey,
        itemId: confidence === 'unknown' ? null : itemId,
        createdAt: new Date(Date.now() - minutesAgo * 60_000),
      },
    });
  };

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `CONV-ORG-${randomUUID().slice(0, 8)}` },
    });
    convOrgId = org.id;
    const business = await prisma.business.create({
      data: { organizationId: convOrgId, name: 'Conversation Dental' },
    });
    convBusinessId = business.id;

    const source = await prisma.knowledgeSource.create({
      data: {
        businessId: convBusinessId,
        type: 'FAQ',
        status: 'READY',
        url: 'internal:owner-authored',
        title: 'Written by you',
      },
    });
    const item = await prisma.knowledgeItem.create({
      data: {
        businessId: convBusinessId,
        sourceId: source.id,
        question: 'What are your opening hours?',
        content: 'We open Monday to Friday, 9am to 5:30pm.',
        position: 0,
      },
    });
    itemId = item.id;

    // The older visit: one question, answered.
    await turn('visit-older', 'when do you open', 'answered', 600);

    // The newer visit: three questions, ending in a gap. Seeded out of order
    // so a missing `orderBy` on the turns shows up.
    await turn('visit-newer', 'do you do emergencies', 'unsure', 28);
    await turn('visit-newer', 'when do you open', 'answered', 30);
    await turn('visit-newer', 'do you take crypto', 'unknown', 26);
  });

  afterAll(async () => {
    await prisma.receptionistQuestion.deleteMany({ where: { businessId: convBusinessId } });
    await prisma.knowledgeItem.deleteMany({ where: { businessId: convBusinessId } });
    await prisma.knowledgeSource.deleteMany({ where: { businessId: convBusinessId } });
    await prisma.business.deleteMany({ where: { id: convBusinessId } });
    await prisma.organization.deleteMany({ where: { id: convOrgId } });
  });

  it('groups a visit into one conversation, newest visit first', async () => {
    const { conversations } = await service.conversations(convBusinessId);

    expect(conversations).toHaveLength(2);
    expect(conversations[0]?.turns).toHaveLength(3);
    expect(conversations[1]?.turns).toHaveLength(1);
  });

  it('reads the turns in the order they were asked', async () => {
    // The sequence is the whole reason this view exists. Seeded out of order
    // on purpose, so an unordered read cannot pass by luck.
    const { conversations } = await service.conversations(convBusinessId);
    expect(conversations[0]?.turns.map((t) => t.question)).toEqual([
      'when do you open',
      'do you do emergencies',
      'do you take crypto',
    ]);
  });

  it('rebuilds what the visitor was actually shown', async () => {
    const { conversations } = await service.conversations(convBusinessId);
    const turns = conversations[0]?.turns ?? [];

    // Answered: the owner's passage, verbatim and unadorned.
    expect(turns[0]?.answer).toBe('We open Monday to Friday, 9am to 5:30pm.');
    // Hedged: the same passage behind the hedge the visitor saw.
    expect(turns[1]?.answer).toBe(`${HEDGE_TEXT}\n\nWe open Monday to Friday, 9am to 5:30pm.`);
    // Unknown: the refusal, which depends on no stored content at all.
    expect(turns[2]?.answer).toBe(DONT_KNOW_TEXT);
  });

  it('names the passage each answer came from', async () => {
    const { conversations } = await service.conversations(convBusinessId);
    const turns = conversations[0]?.turns ?? [];
    expect(turns[0]?.answeredWith).toEqual({
      id: itemId,
      question: 'What are your opening hours?',
    });
    // A refusal came from nothing, and must not claim otherwise.
    expect(turns[2]?.answeredWith).toBeNull();
  });

  it('flags the visit that ran out of road', async () => {
    const { conversations } = await service.conversations(convBusinessId);
    expect(conversations[0]?.hasGap).toBe(true);
    expect(conversations[1]?.hasGap).toBe(false);
  });

  /**
   * CLAUDE.md rule 7. A lead carries no session key so that a name typed into
   * the widget can never be attached to the other questions asked on the way
   * there, and the session key itself is not published. This is the view that
   * would quietly undo both, so it is the view that has to be checked.
   */
  it('publishes neither the session key nor a link to an enquiry', async () => {
    const { conversations } = await service.conversations(convBusinessId);
    const serialised = JSON.stringify(conversations);

    expect(serialised).not.toContain('visit-newer');
    expect(serialised).not.toContain('visit-older');
    expect(serialised).not.toMatch(/sessionKey|leadId/i);
  });

  it('takes the most recent VISITS, not the most recent questions', async () => {
    // A chatty visit must not be truncated by the row limit. With a limit of
    // one, the whole of the newer visit survives and the older is dropped —
    // the other way round, a row-limited read would return part of each.
    const { conversations } = await service.conversations(convBusinessId, 30, 1);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.turns).toHaveLength(3);
  });

  it('says so when the passage behind an answer has been deleted', async () => {
    const org = await prisma.organization.create({
      data: { name: `CONV-DEL-${randomUUID().slice(0, 8)}` },
    });
    const business = await prisma.business.create({
      data: { organizationId: org.id, name: 'Deleted Passage Co' },
    });
    await prisma.receptionistQuestion.create({
      data: {
        businessId: business.id,
        question: 'when do you open',
        confidence: 'answered',
        sessionKey: 'visit-deleted',
        // Points at a passage that is not in this business's knowledge base,
        // which is what a deleted one looks like: nulled, never cascaded.
        itemId: randomUUID(),
      },
    });

    const { conversations } = await service.conversations(business.id);
    expect(conversations[0]?.turns[0]?.answer).toBe(DELETED_PASSAGE_TEXT);
    expect(conversations[0]?.turns[0]?.answeredWith).toBeNull();

    await prisma.receptionistQuestion.deleteMany({ where: { businessId: business.id } });
    await prisma.business.deleteMany({ where: { id: business.id } });
    await prisma.organization.deleteMany({ where: { id: org.id } });
  });

  it('returns nothing for a business nobody has spoken to', async () => {
    const org = await prisma.organization.create({
      data: { name: `CONV-NEW-${randomUUID().slice(0, 8)}` },
    });
    const business = await prisma.business.create({
      data: { organizationId: org.id, name: 'Nobody Called' },
    });

    const { conversations } = await service.conversations(business.id);
    expect(conversations).toEqual([]);

    await prisma.business.deleteMany({ where: { id: business.id } });
    await prisma.organization.deleteMany({ where: { id: org.id } });
  });

  it('returns the same order every time when timestamps tie', async () => {
    // Two visits that end at the same instant. Without a second sort key
    // Postgres may order them differently per call, which reshuffles the page
    // on refresh and makes the visit on the `take` boundary flicker in and
    // out. Seeded here because real traffic almost never ties, so nothing
    // else would catch a missing tiebreak.
    const at = new Date(Date.now() - 90 * 60_000);
    for (const key of ['tie-a', 'tie-b', 'tie-c']) {
      await prisma.receptionistQuestion.create({
        data: {
          businessId: convBusinessId,
          question: `tied ${key}`,
          confidence: 'answered',
          sessionKey: key,
          itemId,
          createdAt: at,
        },
      });
    }

    const once = await service.conversations(convBusinessId);
    const twice = await service.conversations(convBusinessId);
    expect(once.conversations.map((c) => c.id)).toEqual(twice.conversations.map((c) => c.id));

    await prisma.receptionistQuestion.deleteMany({
      where: { businessId: convBusinessId, sessionKey: { in: ['tie-a', 'tie-b', 'tie-c'] } },
    });
  });

  it('does not reach into another business’s visits', async () => {
    const { conversations } = await service.conversations(businessId);
    expect(JSON.stringify(conversations)).not.toContain('do you take crypto');
  });
});
