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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { KnowledgeService } from './knowledge.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { CreateFaqDto, UpdateKnowledgeItemDto } from './dto/knowledge.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizationGuard } from '../auth/guards/organization.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { OrgThrottlerGuard } from '../../common/guards/org-throttler.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { ActorContext } from '../domain/domain.service.js';
import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';

/**
 * Ingestion is throttled per organization, hard.
 *
 * It fans one request out into a dozen outbound fetches against a third-party
 * server. That makes it the most abusable endpoint in the product, and the
 * politeness limit matters as much as the abuse limit - a business should not
 * be able to make us hammer their own site either.
 */
const INGEST_WINDOW_MS = Number(process.env.KNOWLEDGE_INGEST_TTL ?? 3600) * 1000;
const INGEST_LIMIT = Number(process.env.KNOWLEDGE_INGEST_MAX ?? 5);

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
@Controller('businesses/:businessId/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(@Param('businessId') businessId: string, @Request() req: AuthedRequest) {
    return this.knowledge.list(businessId, req.user.organizationId);
  }

  /** Proves the retrieval loop today, and is what the AI layer will rank against. */
  @Get('search')
  search(
    @Param('businessId') businessId: string,
    @Query('q') q: string | undefined,
    @Request() req: AuthedRequest,
  ) {
    return this.knowledge.search(businessId, req.user.organizationId, q ?? '');
  }

  @Roles('OWNER', 'ADMIN')
  @UseGuards(OrgThrottlerGuard)
  @Throttle({ default: { limit: INGEST_LIMIT, ttl: INGEST_WINDOW_MS } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('ingest')
  ingest(@Param('businessId') businessId: string, @Request() req: AuthedRequest) {
    // 202: the crawl is scheduled, not finished. The client polls GET / for
    // per-source status rather than holding a request open for a minute.
    return this.knowledge.startIngestion(businessId, actorFrom(req));
  }

  @Roles('OWNER', 'ADMIN')
  @Post('faqs')
  createFaq(
    @Param('businessId') businessId: string,
    @Body() dto: CreateFaqDto,
    @Request() req: AuthedRequest,
  ) {
    return this.knowledge.createFaq(businessId, actorFrom(req), {
      question: dto.question,
      answer: dto.answer,
    });
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('items/:itemId')
  updateItem(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateKnowledgeItemDto,
    @Request() req: AuthedRequest,
  ) {
    return this.knowledge.updateItem(businessId, itemId, req.user.organizationId, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete('items/:itemId')
  deleteItem(
    @Param('businessId') businessId: string,
    @Param('itemId') itemId: string,
    @Request() req: AuthedRequest,
  ) {
    return this.knowledge.deleteItem(businessId, itemId, req.user.organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete('sources/:sourceId')
  deleteSource(
    @Param('businessId') businessId: string,
    @Param('sourceId') sourceId: string,
    @Request() req: AuthedRequest,
  ) {
    return this.knowledge.deleteSource(businessId, sourceId, req.user.organizationId);
  }
}
