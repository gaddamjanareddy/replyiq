import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@replyiq/database';
import type { PrismaClient } from '@replyiq/database';
import { EmailService, type EmailMessage } from '../../infrastructure/email/email.service.js';
import { ReceptionistService } from './receptionist.service.js';
import { LeadService } from './lead.service.js';
import { AuditService } from '../../infrastructure/audit/audit.service.js';

/**
 * Lead capture against a real database.
 *
 * The things worth proving here are not the happy path — they are the
 * guarantees that are invisible when they hold and expensive when they break:
 * the origin gate on a PUBLIC WRITE endpoint, test leads being flagged rather
 * than counted, cross-tenant isolation on the owner's routes, and the owner
 * actually being told.
 */

const LIVE_ORIGIN = 'https://harbour-leads.example.com';
const SANDBOX_ORIGIN = 'https://sandbox-leads.test';

/**
 * Captures what would have been sent, so delivery can be asserted on.
 *
 * `waitForSend` exists because the notification is fire-and-forget AND does
 * its own database round trip to find the recipients. A single `setImmediate`
 * after capture is not enough — it was tried, and both email assertions failed
 * against an empty array while the product was working perfectly. A fixed
 * sleep would have papered over that and been flaky on a slow machine, so this
 * waits for the actual event with a bounded timeout.
 */
class CapturingEmailService extends EmailService {
  readonly sent: EmailMessage[] = [];
  private waiters: Array<() => void> = [];

  override send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    const waiting = this.waiters;
    this.waiters = [];
    for (const resolve of waiting) resolve();
    return Promise.resolve();
  }

  async waitForSend(timeoutMs = 5_000): Promise<void> {
    if (this.sent.length > 0) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('no email was sent within the timeout')),
        timeoutMs,
      );
      this.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

/**
 * The first lead, or a failed test.
 *
 * `leads[0]!` is what this replaces: the lint rule against non-null
 * assertions is on for a reason, and a helper that fails the test with a
 * useful message beats an assertion that fails with `cannot read id of
 * undefined` three lines later.
 */
function first<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error('expected at least one row');
  return row;
}

let leads: LeadService;
let email: CapturingEmailService;
let organizationId: string;
let businessId: string;
let sandboxBusinessId: string;
let otherBusinessId: string;
let otherOrganizationId: string;

beforeAll(async () => {
  const receptionist = new ReceptionistService(prisma as PrismaClient);
  email = new CapturingEmailService(new ConfigService());
  leads = new LeadService(
    prisma as PrismaClient,
    receptionist,
    email,
    new ConfigService({ WEB_URL: 'https://app.example.com' }),
    new AuditService(prisma as PrismaClient),
  );

  const org = await prisma.organization.create({
    data: { name: `LEADS-ORG-${randomUUID().slice(0, 8)}` },
  });
  organizationId = org.id;

  await prisma.user.create({
    data: {
      organizationId,
      name: 'Owner',
      email: `owner-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  const business = await prisma.business.create({
    data: { organizationId, name: 'Harbour Dental' },
  });
  businessId = business.id;
  await prisma.businessDomain.create({
    data: {
      businessId,
      domain: 'harbour-leads.example.com',
      status: 'VERIFIED',
      isSandbox: false,
      verifiedAt: new Date(),
      verificationMethod: 'DNS_TXT',
      verificationToken: `replyiq-verify-${randomUUID()}`,
    },
  });

  // A second business in the same organization, verified only on a reserved
  // test namespace, so it is in TEST mode.
  const sandbox = await prisma.business.create({
    data: { organizationId, name: 'Sandbox Dental' },
  });
  sandboxBusinessId = sandbox.id;
  await prisma.businessDomain.create({
    data: {
      businessId: sandboxBusinessId,
      domain: 'sandbox-leads.test',
      status: 'VERIFIED',
      isSandbox: true,
      verifiedAt: new Date(),
      verificationMethod: 'SANDBOX',
      verificationToken: `replyiq-verify-${randomUUID()}`,
    },
  });

  // A business belonging to somebody else entirely.
  const otherOrg = await prisma.organization.create({
    data: { name: `LEADS-OTHER-${randomUUID().slice(0, 8)}` },
  });
  otherOrganizationId = otherOrg.id;
  const other = await prisma.business.create({
    data: { organizationId: otherOrganizationId, name: 'Someone Else Ltd' },
  });
  otherBusinessId = other.id;
});

afterEach(async () => {
  await prisma.receptionistLead.deleteMany({
    where: { businessId: { in: [businessId, sandboxBusinessId, otherBusinessId] } },
  });
  email.sent.length = 0;
});

afterAll(async () => {
  await prisma.businessDomain.deleteMany({
    where: { businessId: { in: [businessId, sandboxBusinessId] } },
  });
  await prisma.business.deleteMany({
    where: { id: { in: [businessId, sandboxBusinessId, otherBusinessId] } },
  });
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({
    where: { id: { in: [organizationId, otherOrganizationId] } },
  });
});

describe('capturing a lead from the widget', () => {
  it('stores what the visitor left, with the question that prompted it', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, {
      contact: '+91 98765 43210',
      name: 'Priya',
      question: 'do you do root canals on a Sunday',
    });

    const { leads: stored } = await leads.list(businessId);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      name: 'Priya',
      contact: '+91 98765 43210',
      contactKind: 'PHONE',
      question: 'do you do root canals on a Sunday',
      status: 'NEW',
      isTest: false,
    });
  });

  it('accepts an email just as readily, and says which it got', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, {
      contact: 'priya@gmail.com',
    });
    const { leads: stored } = await leads.list(businessId);
    expect(stored[0]?.contactKind).toBe('EMAIL');
    // The name is optional, and a lead without one is still a lead.
    expect(stored[0]?.name).toBeNull();
  });

  it('refuses something nobody could be reached on', async () => {
    await expect(
      leads.capture(businessId, LIVE_ORIGIN, undefined, { contact: 'no thanks' }),
    ).rejects.toMatchObject({ response: { code: 'LEAD_CONTACT_UNUSABLE' } });

    const { leads: stored } = await leads.list(businessId);
    expect(stored).toHaveLength(0);
  });
});

/**
 * This is a PUBLIC WRITE endpoint. Without the gate, anyone could fill a
 * stranger's enquiry list with abuse until they stopped using the product —
 * which is a worse outcome than the read endpoint leaking content that is
 * already published on the owner's own website.
 */
describe('the origin gate on a public write', () => {
  it('refuses a request with no origin at all', async () => {
    await expect(
      leads.capture(businessId, undefined, undefined, { contact: '9876543210' }),
    ).rejects.toMatchObject({ response: { code: 'WIDGET_ORIGIN_NOT_ALLOWED' } });
  });

  it('refuses a suffix-confusion lookalike', async () => {
    await expect(
      leads.capture(businessId, 'https://notharbour-leads.example.com', undefined, {
        contact: '9876543210',
      }),
    ).rejects.toMatchObject({ response: { code: 'WIDGET_ORIGIN_NOT_ALLOWED' } });
  });

  it('refuses localhost for a LIVE business', async () => {
    await expect(
      leads.capture(businessId, 'http://localhost:5173', undefined, { contact: '9876543210' }),
    ).rejects.toMatchObject({ response: { code: 'WIDGET_ORIGIN_NOT_ALLOWED' } });
  });

  it('accepts localhost for a business in Test Mode', async () => {
    await expect(
      leads.capture(sandboxBusinessId, 'http://localhost:5173', undefined, {
        contact: '9876543210',
      }),
    ).resolves.toEqual({ captured: true });
  });

  it('falls back to Referer when the browser sent no Origin', async () => {
    await expect(
      leads.capture(businessId, undefined, `${LIVE_ORIGIN}/prices`, {
        contact: '9876543210',
      }),
    ).resolves.toEqual({ captured: true });
  });
});

describe('test leads', () => {
  it('are kept but flagged, so a test is never counted as a customer', async () => {
    await leads.capture(sandboxBusinessId, SANDBOX_ORIGIN, undefined, {
      contact: '9876543210',
    });

    const { leads: stored } = await leads.list(sandboxBusinessId);
    expect(stored[0]?.isTest).toBe(true);
    // The dashboard number is the one that must not be inflated by the owner
    // trying their own widget.
    await expect(leads.newCount(sandboxBusinessId)).resolves.toBe(0);
  });

  /**
   * The headline count on the enquiries page and the one on the dashboard are
   * the same question and must give the same answer. They briefly did not.
   */
  it('excludes test leads from the headline count, agreeing with the dashboard', async () => {
    await leads.capture(sandboxBusinessId, SANDBOX_ORIGIN, undefined, { contact: '9876543210' });
    const { leads: stored, counts } = await leads.list(sandboxBusinessId);

    expect(stored).toHaveLength(1);
    // The row is in the list and behind the tab...
    expect(counts.new).toBe(1);
    // ...but nobody is actually waiting for a call.
    expect(counts.waiting).toBe(0);
    expect(counts.waiting).toBe(await leads.newCount(sandboxBusinessId));
  });

  it('counts a real lead in the dashboard number', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' });
    await expect(leads.newCount(businessId)).resolves.toBe(1);
  });

  it('stops counting one the owner has replied to', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' });
    const { leads: stored } = await leads.list(businessId);
    await leads.updateStatus(businessId, first(stored).id, 'CONTACTED');
    await expect(leads.newCount(businessId)).resolves.toBe(0);
  });
});

describe('tenant isolation on the owner routes', () => {
  it('does not return another business lead', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' });
    const { leads: stored } = await leads.list(otherBusinessId);
    expect(stored).toHaveLength(0);
  });

  /**
   * The guard on the route already checks the organization. This asserts the
   * second line of defence: the service scopes by businessId in the WHERE
   * clause, so a guessed lead id cannot be updated through another business's
   * route even if a guard were ever loosened.
   */
  it('refuses to update a lead belonging to another business', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' });
    const { leads: stored } = await leads.list(businessId);

    await expect(
      leads.updateStatus(otherBusinessId, first(stored).id, 'ARCHIVED'),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });

    const { leads: after } = await leads.list(businessId);
    expect(after[0]?.status).toBe('NEW');
  });
});

/**
 * The one hard delete in the product. Everything else is soft-deleted so a
 * mistake is recoverable; this row holds a stranger's phone number, and the
 * only reason to delete it is that nobody should be holding it any more.
 */
describe('erasing an enquiry', () => {
  const actor = { userId: '', organizationId: '' };

  beforeAll(async () => {
    const owner = await prisma.user.findFirstOrThrow({ where: { organizationId } });
    actor.userId = owner.id;
    actor.organizationId = organizationId;
  });

  it('really removes the row, not just a flag', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, {
      contact: '+91 98765 43210',
      name: 'Priya',
    });
    const { leads: stored } = await leads.list(businessId);
    const id = first(stored).id;

    await leads.deleteLead(businessId, id, actor);

    // Straight at the database, not through `list` — a soft delete would
    // still satisfy a check that only asked the service.
    const row = await prisma.receptionistLead.findUnique({ where: { id } });
    expect(row).toBeNull();
  });

  it('records that it happened without recording who it was', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, {
      contact: 'priya@gmail.com',
      name: 'Priya Sharma',
      question: 'do you do root canals on a Sunday',
    });
    const { leads: stored } = await leads.list(businessId);
    const id = first(stored).id;

    await leads.deleteLead(businessId, id, actor);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { event: 'lead.deleted', resourceId: id },
    });
    expect(entry.userId).toBe(actor.userId);
    expect(entry.businessId).toBe(businessId);

    /**
     * The audit row must not reinstate what the delete destroyed. An audit
     * trail holding the contact details would make the deletion a lie.
     */
    const serialised = JSON.stringify(entry);
    expect(serialised).not.toContain('priya@gmail.com');
    expect(serialised).not.toContain('Priya');
    expect(serialised).not.toContain('root canals');
  });

  it('refuses to delete a lead belonging to another business', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' });
    const { leads: stored } = await leads.list(businessId);
    const id = first(stored).id;

    await expect(leads.deleteLead(otherBusinessId, id, actor)).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
    });

    // Still there, which is the point of the check.
    expect(await prisma.receptionistLead.findUnique({ where: { id } })).not.toBeNull();
  });

  it('is idempotent enough to fail clearly on a second attempt', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' });
    const { leads: stored } = await leads.list(businessId);
    const id = first(stored).id;

    await leads.deleteLead(businessId, id, actor);
    await expect(leads.deleteLead(businessId, id, actor)).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
  });
});

describe('telling the owner', () => {
  it('emails them with the question attached', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, {
      contact: '+91 98765 43210',
      name: 'Priya',
      question: 'do you do root canals on a Sunday',
    });

    // Notification is fire-and-forget and queries the database for the
    // recipients, so the lead exists well before the mail does.
    await email.waitForSend();

    expect(email.sent).toHaveLength(1);
    const message = first(email.sent);
    expect(message.subject).toContain('Priya');
    expect(message.text).toContain('+91 98765 43210');
    // The question is the reason the email is worth opening: the owner can
    // ring back knowing what it is about.
    expect(message.text).toContain('root canals on a Sunday');
    expect(message.text).toContain('https://app.example.com/dashboard/leads');
  });

  /**
   * Regression. The body was assembled with `filter(Boolean)`, which dropped
   * the deliberate `''` separators along with the conditional lines, and the
   * email arrived as one dense block. Nothing failed, nothing logged, and the
   * code read correctly — it was found by looking at a real message.
   */
  it('keeps the paragraph breaks, so the email is readable', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, {
      contact: '9876543210',
      name: 'Priya',
      question: 'are you open on Sunday',
    });
    await email.waitForSend();

    const { text } = first(email.sent);
    expect(text).toContain('\n\n');
    // The contact block is separated from the prose above and the question
    // below it, which is the whole reason the blanks are there.
    expect(text).toMatch(/\n\nName: {4}Priya\nContact: 9876543210\n\n/);
  });

  it('marks a test lead as a test in the subject', async () => {
    await leads.capture(sandboxBusinessId, SANDBOX_ORIGIN, undefined, {
      contact: '9876543210',
    });
    await email.waitForSend();
    expect(first(email.sent).subject).toContain('[Test]');
  });

  it('records that the email actually went out', async () => {
    await leads.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' });
    await email.waitForSend();
    // The write happens after the send resolves.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const { leads: stored } = await leads.list(businessId);
    expect(first(stored).notifyStatus).toBe('SENT');
  });

  /**
   * The failure this column exists for. The visitor was told "they'll come
   * back to you"; if the email never sends and nothing records that, the
   * owner loses the enquiry and never learns why.
   */
  it('records a failure instead of hiding it', async () => {
    const failing = new (class extends CapturingEmailService {
      override send(): Promise<void> {
        return Promise.reject(new Error('SMTP is down'));
      }
    })(new ConfigService());

    const service = new LeadService(
      prisma as PrismaClient,
      new ReceptionistService(prisma as PrismaClient),
      failing,
      new ConfigService(),
      new AuditService(prisma as PrismaClient),
    );

    await service.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' });
    await new Promise((resolve) => setTimeout(resolve, 400));

    const { leads: stored } = await leads.list(businessId);
    expect(first(stored).notifyStatus).toBe('FAILED');
  });

  /**
   * The lead is already saved and the visitor has already been thanked. A
   * failing mail server must not turn that into an error the visitor sees and
   * does not retry.
   */
  it('still captures the lead when the email cannot be sent', async () => {
    const failing = new (class extends CapturingEmailService {
      override send(): Promise<void> {
        return Promise.reject(new Error('SMTP is down'));
      }
    })(new ConfigService());

    const service = new LeadService(
      prisma as PrismaClient,
      new ReceptionistService(prisma as PrismaClient),
      failing,
      new ConfigService(),
      new AuditService(prisma as PrismaClient),
    );

    await expect(
      service.capture(businessId, LIVE_ORIGIN, undefined, { contact: '9876543210' }),
    ).resolves.toEqual({ captured: true });

    const { leads: stored } = await leads.list(businessId);
    expect(stored).toHaveLength(1);
  });
});
