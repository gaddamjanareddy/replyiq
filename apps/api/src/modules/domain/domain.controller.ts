import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { DomainService } from './domain.service.js';
import type { ActorContext, DomainResponse, DomainListResponse } from './domain.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { CreateDomainDto } from './dto/create-domain.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { VerifyDomainDto } from './dto/verify-domain.dto.js';
import type { VerificationMethodInput } from './dto/verify-domain.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizationGuard } from '../auth/guards/organization.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { OrgThrottlerGuard } from '../../common/guards/org-throttler.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';

/** Per-organization limits (FR-DOM-13). Window and caps are configurable so an
 *  operator can tighten them without a deploy. */
const RATE_WINDOW_MS = Number(process.env.DOMAIN_RATE_LIMIT_TTL ?? 3600) * 1000;
const ADD_LIMIT = Number(process.env.DOMAIN_ADD_RATE_LIMIT_MAX ?? 10);
const VERIFY_LIMIT = Number(process.env.DOMAIN_VERIFY_RATE_LIMIT_MAX ?? 20);

interface AuthedRequest {
  user: JwtPayload;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function actorFrom(req: AuthedRequest): ActorContext {
  const ua = req.headers?.['user-agent'];
  return {
    userId: req.user.sub,
    organizationId: req.user.organizationId,
    ipAddress: req.ip ?? null,
    userAgent: Array.isArray(ua) ? (ua[0] ?? null) : (ua ?? null),
  };
}

@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@Controller('businesses/:businessId/domains')
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Get()
  list(
    @Param('businessId') businessId: string,
    @Request() req: AuthedRequest,
  ): Promise<DomainListResponse> {
    return this.domainService.list(businessId, req.user.organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @UseGuards(OrgThrottlerGuard)
  @Throttle({ default: { limit: ADD_LIMIT, ttl: RATE_WINDOW_MS } })
  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateDomainDto,
    @Request() req: AuthedRequest,
  ): Promise<DomainResponse> {
    return this.domainService.create(businessId, actorFrom(req), dto);
  }

  /**
   * Throttled per organization rather than per IP: this route makes the server
   * issue an outbound request to a host the caller chose, so the tenant is the
   * correct abuse boundary.
   */
  @Roles('OWNER', 'ADMIN')
  @UseGuards(OrgThrottlerGuard)
  @Throttle({ default: { limit: VERIFY_LIMIT, ttl: RATE_WINDOW_MS } })
  // 200, not Nest's default 201: this reports the outcome of a check rather
  // than creating a resource, and a "pending" result creates nothing at all.
  @HttpCode(HttpStatus.OK)
  @Post(':domainId/verify')
  verify(
    @Param('businessId') businessId: string,
    @Param('domainId') domainId: string,
    @Body() dto: VerifyDomainDto,
    @Request() req: AuthedRequest,
  ): Promise<DomainResponse> {
    return this.domainService.verify(businessId, domainId, actorFrom(req), dto);
  }

  /**
   * `acknowledgeServiceInterruption` is required when this is the last verified
   * domain (FR-DOM-11). Enforcing it here rather than only in a confirmation
   * dialog means the safety survives a script, a stale client, or a curl.
   */
  @Roles('OWNER', 'ADMIN')
  @Delete(':domainId')
  remove(
    @Param('businessId') businessId: string,
    @Param('domainId') domainId: string,
    @Query('acknowledgeServiceInterruption') acknowledge: string | undefined,
    @Request() req: AuthedRequest,
  ) {
    return this.domainService.remove(businessId, domainId, actorFrom(req), {
      acknowledgeServiceInterruption: acknowledge === 'true',
    });
  }

  @Get(':domainId/verification-instructions')
  getVerificationInstructions(
    @Param('businessId') businessId: string,
    @Param('domainId') domainId: string,
    @Query('method') method: VerificationMethodInput,
    @Request() req: AuthedRequest,
  ) {
    return this.domainService.getVerificationInstructions(
      businessId,
      domainId,
      req.user.organizationId,
      { method: method ?? 'DNS_TXT' },
    );
  }
}
