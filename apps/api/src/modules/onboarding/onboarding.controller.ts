import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { OnboardingService } from './onboarding.service.js';
import type { OnboardingProgressResponse } from './onboarding.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { UpdateOnboardingDto } from './dto/update-onboarding.dto.js';
 
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
 
import { OrganizationGuard } from '../auth/guards/organization.guard.js';
 
import { RolesGuard } from '../auth/guards/roles.guard.js';
 
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';

@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@Controller('businesses/:businessId/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  getProgress(
    @Param('businessId') businessId: string,
    @Request() req: { user: JwtPayload },
  ): Promise<OnboardingProgressResponse> {
    return this.onboardingService.getProgress(businessId, req.user.organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('steps')
  updateStep(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateOnboardingDto,
    @Request()
    req: { user: JwtPayload; ip?: string; headers?: Record<string, string | string[] | undefined> },
  ): Promise<OnboardingProgressResponse> {
    const ua = req.headers?.['user-agent'];
    return this.onboardingService.updateStep(businessId, req.user.organizationId, dto, {
      userId: req.user.sub,
      ipAddress: req.ip ?? null,
      userAgent: Array.isArray(ua) ? (ua[0] ?? null) : (ua ?? null),
    });
  }
}
