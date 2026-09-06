import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ReceptionistService } from './receptionist.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { AskDto } from './dto/ask.dto.js';
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
  constructor(private readonly receptionist: ReceptionistService) {}

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
}
