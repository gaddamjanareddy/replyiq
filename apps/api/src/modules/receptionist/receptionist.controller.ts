import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ReceptionistService } from './receptionist.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { AskDto } from './dto/ask.dto.js';

/**
 * The public receptionist API, called by the widget on a customer's website.
 *
 * Deliberately NOT behind JwtAuthGuard: there is no visitor account and never
 * will be. What replaces authentication is the browser-set Origin header
 * checked against the business's verified domains, plus rate limiting — see
 * widget-origin.ts for exactly what that does and does not prove.
 *
 * ── Why these routes get their own rate limit ─────────────────────────────
 * The global limit is 10 requests a minute, which is right for login and
 * password reset and far too tight here: a visitor in the middle of a
 * conversation asks several questions in a row, and being cut off mid-chat
 * looks like the product is broken. Found by driving the real endpoint - the
 * third question in a row returned 429.
 *
 * 30 a minute is generous for a person and still bounds a script, which is
 * the balance that matters for an endpoint anyone can call.
 */
@Controller('receptionist/:businessId')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class ReceptionistController {
  constructor(private readonly receptionist: ReceptionistService) {}

  /** What the widget needs to render before anyone has asked anything. */
  @Get('config')
  @UseGuards(ThrottlerGuard)
  config(@Param('businessId') businessId: string, @Headers('origin') origin?: string) {
    return this.receptionist.config(businessId, origin);
  }

  /**
   * Answer one question.
   *
   * POST rather than GET because the question is user content: a GET would put
   * it in the URL, and from there into access logs, proxy logs and referrer
   * headers — none of which should hold what a visitor typed.
   */
  @Post('ask')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  ask(
    @Param('businessId') businessId: string,
    @Body() dto: AskDto,
    @Headers('origin') origin?: string,
  ) {
    return this.receptionist.ask(
      businessId,
      origin,
      dto.question,
      dto.sessionKey,
      dto.previousQuestion,
    );
  }
}
