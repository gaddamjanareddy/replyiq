import { Inject, Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { PrismaClient } from '@replyiq/database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ConfigService } from '@nestjs/config';
import { ErrorCode, codedBadRequest, codedNotFound } from '../../common/errors/error-codes.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { EmailService } from '../../infrastructure/email/email.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ReceptionistService } from './receptionist.service.js';
import {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  classifyContact,
  cleanOptionalText,
} from './lead-capture.js';
import { MAX_QUESTION_LENGTH } from './receptionist.service.js';
import type { LeadStatusValue } from './dto/update-lead.dto.js';

/**
 * Leads: the commercial half of the honesty rule.
 *
 * The receptionist's best feature is that it says "I don't know" instead of
 * inventing. On its own that also ended the conversation — the visitor left and
 * the owner never learned they existed, which from behind the counter looks
 * identical to the product failing. So the non-answer hands over: leave a
 * number, and the business comes back to you.
 *
 * ── The one place the product holds a stranger's personal data ────────────
 * Everything else about visitors is deliberately anonymous (`CLAUDE.md` rule
 * 7). This is the exception and it is a narrow, explicit one:
 *
 *   * The visitor was asked, was told what for, and typed it anyway. There is
 *     no inference, no enrichment and no collection they did not see.
 *   * Nothing is stored beyond what they typed. No IP, no user agent, no
 *     cookie, and — importantly — no session key, so a lead cannot be joined
 *     to the anonymous question log. See `capture-lead.dto.ts`.
 *   * It belongs to the business, cascades away with it, and is not used by
 *     us for anything.
 *
 * A future feature that wants to "enrich" a lead or tie it back to a browsing
 * session is the thing this comment exists to stop.
 */

/** A lead as the owner's dashboard sees it. */
export interface LeadView {
  id: string;
  name: string | null;
  contact: string;
  contactKind: 'EMAIL' | 'PHONE';
  question: string | null;
  message: string | null;
  isTest: boolean;
  status: LeadStatusValue;
  createdAt: Date;
}

export interface CaptureLeadInput {
  contact: string;
  name?: string;
  question?: string;
  message?: string;
}

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly receptionist: ReceptionistService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * A visitor leaving their details, from the widget on the business's site.
   *
   * Unauthenticated, so it goes through the same origin gate as `ask` — which
   * matters more here than there. Without it, this endpoint would let anyone
   * write arbitrary text into a stranger's dashboard, and a dashboard full of
   * abuse is a product the owner turns off.
   */
  async capture(
    businessId: string,
    origin: string | undefined,
    referer: string | undefined,
    input: CaptureLeadInput,
  ): Promise<{ captured: true }> {
    const { mode, businessName } = await this.receptionist.authorizeWidget(
      businessId,
      origin,
      referer,
    );

    const contact = classifyContact(input.contact);
    if (!contact) {
      // The only validation error in the product a stranger ever sees. It is a
      // 400 with a code, and the widget shows reviewed copy for it — the one
      // thing that must not happen is the visitor being told nothing and
      // assuming it worked.
      throw codedBadRequest(
        ErrorCode.LEAD_CONTACT_UNUSABLE,
        'That does not look like a phone number or an email address.',
      );
    }

    const lead = await this.prisma.receptionistLead.create({
      data: {
        businessId,
        contact: contact.value,
        contactKind: contact.kind,
        name: cleanOptionalText(input.name, MAX_NAME_LENGTH),
        question: cleanOptionalText(input.question, MAX_QUESTION_LENGTH),
        message: cleanOptionalText(input.message, MAX_MESSAGE_LENGTH),
        // A lead captured against a sandbox domain is the owner testing. It is
        // kept — seeing it arrive is how they learn the feature works — and
        // flagged, because a test lead counted as real would corrupt the only
        // number in the product that matters.
        isTest: mode === 'TEST',
      },
      select: { id: true, createdAt: true },
    });

    // Awaited only for the row above. The notification is fire-and-forget: a
    // visitor must never wait on an SMTP handshake, and a mail failure must
    // never turn a captured lead into an error the visitor sees and does not
    // retry.
    void this.notifyOwner(businessId, businessName, {
      name: cleanOptionalText(input.name, MAX_NAME_LENGTH),
      contact: contact.value,
      question: cleanOptionalText(input.question, MAX_QUESTION_LENGTH),
      message: cleanOptionalText(input.message, MAX_MESSAGE_LENGTH),
      isTest: mode === 'TEST',
    });

    this.logger.log(`Lead captured for business ${businessId} (${lead.id}, test=${mode === 'TEST'})`);
    return { captured: true };
  }

  /** The owner's list. Authorized by the organization guard on the route. */
  async list(businessId: string): Promise<{
    leads: LeadView[];
    counts: { new: number; contacted: number; archived: number; waiting: number };
  }> {
    const [rows, grouped] = await Promise.all([
      this.prisma.receptionistLead.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        // A small business will never have more than this worth scrolling, and
        // an unbounded query on a public-write table is an outage waiting for
        // a spam run.
        take: 200,
        select: {
          id: true,
          name: true,
          contact: true,
          contactKind: true,
          question: true,
          message: true,
          isTest: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.receptionistLead.groupBy({
        by: ['status'],
        where: { businessId },
        _count: { _all: true },
      }),
    ]);

    const count = (status: LeadStatusValue) =>
      grouped.find((g) => g.status === status)?._count._all ?? 0;

    return {
      leads: rows,
      counts: {
        // The three tab counts are totals, because they say how many rows are
        // behind each filter and the rows themselves include test leads.
        new: count('NEW'),
        contacted: count('CONTACTED'),
        archived: count('ARCHIVED'),
        /**
         * The headline "N waiting", which is a different question: how many
         * real people are expecting a call.
         *
         * It must agree with the dashboard, and briefly did not — the page
         * announced "9 waiting" in a celebratory green badge while the
         * dashboard showed nothing, because one counted test leads and the
         * other did not. Two screens disagreeing about one number is worse
         * than either number being wrong, so both now come from this
         * definition. Found by looking at the two pages, not at the code.
         */
        waiting: await this.newCount(businessId),
      },
    };
  }

  /**
   * How many leads still need a call.
   *
   * Separate from `list` because the dashboard needs the number without the
   * personal data — a count can be rendered on a page that has no business
   * holding someone's phone number.
   */
  async newCount(businessId: string): Promise<number> {
    return this.prisma.receptionistLead.count({
      where: { businessId, status: 'NEW', isTest: false },
    });
  }

  /**
   * Mark a lead as dealt with.
   *
   * Scoped by businessId in the WHERE clause as well as by the route guard.
   * Defence in depth is the house rule for anything organization-scoped, and
   * it is what stops a guessed lead id from one business being updated through
   * another's route.
   */
  async updateStatus(
    businessId: string,
    leadId: string,
    status: LeadStatusValue,
  ): Promise<{ id: string; status: LeadStatusValue }> {
    const updated = await this.prisma.receptionistLead.updateMany({
      where: { id: leadId, businessId },
      data: { status },
    });

    if (updated.count === 0) {
      throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'That enquiry no longer exists.');
    }

    return { id: leadId, status };
  }

  /**
   * Tell the owner somebody is waiting.
   *
   * This is the feature, not a nicety. A lead sitting unseen in a dashboard
   * nobody opened is the same as no lead: whoever asked has already rung
   * somebody else by tomorrow. The email carries the question too, so the
   * owner can call back knowing what it is about.
   *
   * Every failure is swallowed. The lead is already saved, the visitor has
   * already been thanked, and there is nothing useful to do with the error
   * except record it where an operator can see it.
   */
  private async notifyOwner(
    businessId: string,
    businessName: string,
    lead: {
      name: string | null;
      contact: string;
      question: string | null;
      message: string | null;
      isTest: boolean;
    },
  ): Promise<void> {
    try {
      const recipients = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          organization: {
            businesses: { some: { id: businessId, deletedAt: null } },
          },
        },
        select: { email: true },
        // Everyone in the organization who can act on it. A two-person
        // business where only one of them gets told is a lead that waits for
        // somebody's holiday to end.
        take: 10,
      });

      if (recipients.length === 0) {
        this.logger.warn(`Lead captured for business ${businessId} with nobody to notify.`);
        return;
      }

      const webUrl = (this.config.get<string>('WEB_URL') ?? '').replace(/\/+$/, '');
      const subject = lead.isTest
        ? `[Test] New enquiry from your website`
        : `New enquiry from your website — ${lead.name ?? lead.contact}`;

      /**
       * `undefined` marks a line that might not apply; `''` is a deliberate
       * blank. They are filtered differently on purpose: a `filter(Boolean)`
       * over both was tried, and it silently ate every paragraph break, so the
       * email arrived as one dense unreadable block. Found by reading a real
       * one out of the log transport — the code looked right.
       */
      const lines: Array<string | undefined> = [
        lead.isTest
          ? 'This is a TEST enquiry, captured while your receptionist was in test mode. It is not a real customer.'
          : 'Someone asked your receptionist something it could not answer, and left their details.',
        '',
        `Name:    ${lead.name ?? '(not given)'}`,
        `Contact: ${lead.contact}`,
        '',
        lead.question
          ? `They asked:\n  "${lead.question}"`
          : 'They did not leave a question.',
      ];
      if (lead.message) lines.push('', `They added:\n  "${lead.message}"`);
      lines.push(
        '',
        // Two calls to action in the order they matter: ring the person, then
        // write the answer so the next one never has to ask.
        'Call or write to them first — they were asking just now.',
        webUrl ? `Your enquiries: ${webUrl}/dashboard/leads` : undefined,
        lead.question && webUrl
          ? `Answer this once and the receptionist will handle it next time: ${webUrl}/dashboard/knowledge`
          : undefined,
        '',
        `— ReplyIQ, for ${businessName}`,
      );

      const text = lines.filter((line) => line !== undefined).join('\n');

      await Promise.all(recipients.map((r) => this.email.send({ to: r.email, subject, text })));
    } catch (error) {
      this.logger.warn(
        `Could not notify the owner of a new lead: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
