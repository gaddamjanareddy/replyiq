import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@replyiq/database';
import type { PrismaClient } from '@replyiq/database';
import { ReceptionistService } from './receptionist.service.js';

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
