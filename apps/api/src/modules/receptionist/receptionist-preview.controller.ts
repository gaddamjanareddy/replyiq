import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';
import { Throttle } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ReceptionistService } from './receptionist.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { AskDto } from './dto/ask.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { UpdateLeadDto } from './dto/update-lead.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { RateAnswerDto } from './dto/rate-answer.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { LeadService } from './lead.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { AnswerGapDto } from './dto/answer-gap.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizationGuard } from '../auth/guards/organization.guard.js';

/**
 * "Try it" inside the dashboard, for the owner.
 *
 * A separate, AUTHENTICATED route rather than reusing the public one, because
 * the obvious shortcut is a trap: making the dashboard's own origin allowed on
 * the public endpoint would mean any page served from our origin could query
 * any business's knowledge base without a session. The public endpoint's whole
 * defence is that the caller must be on a domain the business verified, and
 * the dashboard never is.
 *
 * So the owner proves who they are the normal way - a session and the
 * organization guard - and gets the same answer engine over a different door.
 * Nothing about the grounding or the honesty changes; only the way the caller
 * is identified.
 */
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('businesses/:businessId/receptionist')
export class ReceptionistPreviewController {
  constructor(
    private readonly receptionist: ReceptionistService,
    private readonly leads: LeadService,
    private readonly knowledge: KnowledgeService,
  ) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  // Rate limited despite being authenticated: this runs a full-text query per
  // call, and an owner holding the enter key should not be able to lean on the
  // database.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async preview(@Param('businessId') businessId: string, @Body() dto: AskDto) {
    const answer = await this.receptionist.preview(businessId, dto.question);
    // Wrapped in the standard { success, message, data } envelope that every
    // dashboard endpoint uses and that the web client unwraps. Returning the
    // answer bare made the request succeed with a 200 and render nothing,
    // which is the worst kind of bug to be handed - no error anywhere.
    //
    // The PUBLIC widget endpoint deliberately stays unwrapped: it is consumed
    // by the embedded script, not by this client, and every byte there is paid
    // for by a stranger's browser.
    return { success: true, message: 'Preview answer', data: answer };
  }

  /** What visitors have been asking, and which questions went unanswered. */
  @Get('insights')
  async insights(@Param('businessId') businessId: string) {
    return {
      success: true,
      message: 'Receptionist insights',
      data: await this.receptionist.insights(businessId),
    };
  }

  /**
   * The unanswered questions, grouped into things to write.
   *
   * Separate from `insights`, whose gap list is grouped by exact string. See
   * `ReceptionistService.gaps`.
   */
  @Get('gaps')
  async gaps(@Param('businessId') businessId: string) {
    return {
      success: true,
      message: 'Unanswered questions',
      data: await this.receptionist.gaps(businessId),
    };
  }

  /**
   * Write the answer to a gap, and clear it.
   *
   * One request rather than two, because the two halves are not independently
   * useful: a knowledge item created without clearing the gap leaves the
   * owner's to-do list claiming work they just did, and a gap cleared without
   * the item would be a lie. If the write fails nothing is cleared, which is
   * the right way round — an uncleared gap is visible and fixable, a cleared
   * one with no answer behind it is neither.
   */
  @Post('gaps/answer')
  @HttpCode(HttpStatus.CREATED)
  async answerGap(
    @Param('businessId') businessId: string,
    @Body() dto: AnswerGapDto,
    @Request() req: { user: JwtPayload },
  ) {
    // `createFaq` returns the standard envelope, same as its own route does.
    const created = await this.knowledge.createFaq(
      businessId,
      { userId: req.user.sub, organizationId: req.user.organizationId },
      { question: dto.question, answer: dto.answer },
    );
    const itemId = created.data.item.id;

    const { resolved } = await this.receptionist.resolveGap(businessId, dto.phrasings, itemId);

    return {
      success: true,
      message: 'Answer saved',
      data: { itemId, resolved },
    };
  }

  /**
   * Recent visits, each read as the conversation it was.
   *
   * Carries no session key and no link to an enquiry — see
   * `ReceptionistService.conversations` for why the second of those is a
   * refusal rather than an omission.
   */
  @Get('conversations')
  async conversations(@Param('businessId') businessId: string) {
    return {
      success: true,
      message: 'Recent conversations',
      data: await this.receptionist.conversations(businessId),
    };
  }

  /**
   * The owner's verdict on one answer.
   *
   * The only way the product learns it got something wrong. Nothing automatic
   * can tell us — the answer was the owner's own published words, returned
   * faithfully; whether those words were the right ones for that question is
   * a judgement only they can make.
   */
  @Patch('questions/:questionId')
  async rateAnswer(
    @Param('businessId') businessId: string,
    @Param('questionId') questionId: string,
    @Body() dto: RateAnswerDto,
  ) {
    return {
      success: true,
      message: 'Answer rated',
      data: await this.receptionist.rateAnswer(businessId, questionId, dto.verdict ?? null),
    };
  }

  /**
   * Numbers for the dashboard: how the receptionist is doing, and how many
   * people are waiting for a reply. Deliberately carries no visitor text and
   * no contact details — see `ReceptionistService.summary`.
   */
  @Get('summary')
  async summary(@Param('businessId') businessId: string) {
    const [receptionist, leadsWaiting, undelivered] = await Promise.all([
      this.receptionist.summary(businessId),
      this.leads.newCount(businessId),
      this.leads.undeliveredCount(businessId),
    ]);
    return {
      success: true,
      message: 'Receptionist summary',
      data: { ...receptionist, leadsWaiting, undelivered },
    };
  }

  /**
   * The enquiries the receptionist captured.
   *
   * The only endpoint in the product that returns a third party's contact
   * details, so it sits behind the session and the organization guard with
   * nothing clever about it.
   */
  @Get('leads')
  async listLeads(@Param('businessId') businessId: string) {
    return {
      success: true,
      message: 'Captured enquiries',
      data: await this.leads.list(businessId),
    };
  }

  /**
   * Erase an enquiry.
   *
   * Hard delete, unlike everything else in the product — see
   * `LeadService.deleteLead` for why that is deliberate rather than an
   * oversight.
   */
  @Delete('leads/:leadId')
  async deleteLead(
    @Param('businessId') businessId: string,
    @Param('leadId') leadId: string,
    @Request() req: { user: JwtPayload },
  ) {
    return {
      success: true,
      message: 'Enquiry deleted',
      data: await this.leads.deleteLead(businessId, leadId, {
        userId: req.user.sub,
        organizationId: req.user.organizationId,
      }),
    };
  }

  /** Mark an enquiry as called back, or archive it. */
  @Patch('leads/:leadId')
  async updateLead(
    @Param('businessId') businessId: string,
    @Param('leadId') leadId: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return {
      success: true,
      message: 'Enquiry updated',
      data: await this.leads.updateStatus(businessId, leadId, dto.status),
    };
  }
}
