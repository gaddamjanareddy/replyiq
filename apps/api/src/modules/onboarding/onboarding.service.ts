import { Inject, Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PrismaClient } from '@replyiq/database';
import type { OnboardingStatus } from '@replyiq/database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { AuditService } from '../../infrastructure/audit/audit.service.js';
import { AuditEvent } from '../../infrastructure/audit/audit.service.js';
import type { UpdateOnboardingDto, OnboardingStep } from './dto/update-onboarding.dto.js';
import {
  ErrorCode,
  codedBadRequest,
  codedNotFound,
} from '../../common/errors/error-codes.js';
import { computeServiceMode } from '../../common/business/service-mode.js';
import type { ServiceMode } from '../../common/business/service-mode.js';

export interface OnboardingProgressResponse {
  success: boolean;
  message: string;
  data: {
    onboardingStatus: OnboardingStatus;
    progress: {
      profileCompleted: boolean;
      firstDomainAdded: boolean;
      firstDomainVerified: boolean;
      onboardingCompleted: boolean;
    } | null;
    steps: {
      key: OnboardingStep;
      label: string;
      completed: boolean;
    }[];
    /**
     * Current ability to serve traffic (FR-BIZ-07). Included here so the wizard
     * and dashboard can show the test-mode / no-verified-domain banner from the
     * same request that drives the step list, without a second round trip.
     */
    serviceMode: ServiceMode;
  };
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async getProgress(businessId: string, organizationId: string): Promise<OnboardingProgressResponse> {
    await this.ensureAccess(businessId, organizationId);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { onboardingStatus: true },
    });
    if (!business) throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'Business not found');

    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { businessId },
    });

    const verifiedDomains = await this.prisma.businessDomain.findMany({
      where: { businessId, status: 'VERIFIED', deletedAt: null },
      select: { isSandbox: true },
    });

    return {
      success: true,
      message: 'Onboarding progress retrieved',
      data: {
        onboardingStatus: business.onboardingStatus,
        progress: progress
          ? {
              profileCompleted: progress.profileCompleted,
              firstDomainAdded: progress.firstDomainAdded,
              firstDomainVerified: progress.firstDomainVerified,
              onboardingCompleted: progress.onboardingCompleted,
            }
          : null,
        steps: this.buildSteps(progress),
        serviceMode: computeServiceMode(verifiedDomains),
      },
    };
  }

  async updateStep(
    businessId: string,
    organizationId: string,
    dto: UpdateOnboardingDto,
    actor?: { userId: string; ipAddress?: string | null; userAgent?: string | null },
  ): Promise<OnboardingProgressResponse> {
    await this.ensureAccess(businessId, organizationId);

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'Business not found');
    if (business.onboardingStatus === 'COMPLETED') {
      throw codedBadRequest(
        ErrorCode.ONBOARDING_ALREADY_COMPLETED,
        'Onboarding is already completed',
      );
    }

    const now = new Date();
    let completedNow = false;

    switch (dto.step) {
      case 'PROFILE': {
        await this.prisma.$transaction(async (tx) => {
          await tx.onboardingProgress.upsert({
            where: { businessId },
            create: { businessId, profileCompleted: true, profileCompletedAt: now },
            update: { profileCompleted: true, profileCompletedAt: now },
          });
          if (business.onboardingStatus === 'NOT_STARTED') {
            await tx.business.update({
              where: { id: businessId },
              data: { onboardingStatus: 'IN_PROGRESS' },
            });
          }
        });
        break;
      }
      case 'FIRST_DOMAIN': {
        await this.prisma.$transaction(async (tx) => {
          const existing = await tx.onboardingProgress.findUnique({ where: { businessId } });
          if (!existing?.profileCompleted) {
            throw codedBadRequest(
              ErrorCode.ONBOARDING_STEP_OUT_OF_ORDER,
              'Complete profile step first',
            );
          }
          await tx.onboardingProgress.update({
            where: { businessId },
            data: { firstDomainAdded: true, firstDomainAddedAt: now },
          });
          await tx.business.update({
            where: { id: businessId },
            data: { onboardingStatus: 'DOMAIN_PENDING' },
          });
        });
        break;
      }
      case 'DOMAIN_VERIFICATION': {
        await this.prisma.$transaction(async (tx) => {
          const prog = await tx.onboardingProgress.findUnique({ where: { businessId } });
          if (!prog?.firstDomainAdded) {
            throw codedBadRequest(ErrorCode.ONBOARDING_NO_DOMAIN, 'Add a domain first');
          }
          const verifiedDomain = await tx.businessDomain.findFirst({
            where: { businessId, status: 'VERIFIED', deletedAt: null },
          });
          if (!verifiedDomain) {
            throw codedBadRequest(
              ErrorCode.ONBOARDING_NO_VERIFIED_DOMAIN,
              'No verified domain found',
            );
          }
          await tx.onboardingProgress.update({
            where: { businessId },
            data: { firstDomainVerified: true, firstDomainVerifiedAt: now },
          });
        });
        break;
      }
      case 'COMPLETE': {
        // Approved decision D-05: completion and business activation are one
        // atomic unit. The parent-business row lock serializes against
        // concurrent domain deletions (D-06), so a verified domain cannot be
        // removed between our count and the activation commit.
        await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "businesses" WHERE "id" = ${businessId}::uuid FOR UPDATE`;

          const prog = await tx.onboardingProgress.findUnique({ where: { businessId } });
          if (!prog?.firstDomainVerified) {
            throw codedBadRequest(
              ErrorCode.ONBOARDING_NO_VERIFIED_DOMAIN,
              'Verify a domain before completing onboarding',
            );
          }
          const verifiedCount = await tx.businessDomain.count({
            where: { businessId, status: 'VERIFIED', deletedAt: null },
          });
          if (verifiedCount < 1) {
            throw codedBadRequest(
              ErrorCode.ONBOARDING_NO_VERIFIED_DOMAIN,
              'Verify a domain before completing onboarding',
            );
          }

          await tx.onboardingProgress.update({
            where: { businessId },
            data: { onboardingCompleted: true, onboardingCompletedAt: now },
          });

          await tx.business.update({
            where: { id: businessId },
            data: { onboardingStatus: 'COMPLETED', status: 'ACTIVE' },
          });
        });
        completedNow = true;
        break;
      }
    }

    if (completedNow) {
      await this.audit.record({
        event: AuditEvent.ONBOARDING_COMPLETED,
        organizationId,
        userId: actor?.userId ?? null,
        businessId,
        resourceType: 'Business',
        resourceId: businessId,
        ipAddress: actor?.ipAddress,
        userAgent: actor?.userAgent,
      });
    }

    return this.getProgress(businessId, organizationId);
  }

  private buildSteps(progress: {
    profileCompleted: boolean;
    firstDomainAdded: boolean;
    firstDomainVerified: boolean;
    onboardingCompleted: boolean;
  } | null) {
    const profileDone = progress?.profileCompleted ?? false;
    const domainAdded = progress?.firstDomainAdded ?? false;
    const domainVerified = progress?.firstDomainVerified ?? false;
    const completed = progress?.onboardingCompleted ?? false;

    return [
      { key: 'PROFILE' as OnboardingStep, label: 'Business Profile', completed: profileDone },
      { key: 'FIRST_DOMAIN' as OnboardingStep, label: 'Add Domain', completed: domainAdded },
      { key: 'DOMAIN_VERIFICATION' as OnboardingStep, label: 'Verify Domain', completed: domainVerified },
      { key: 'COMPLETE' as OnboardingStep, label: 'Complete Onboarding', completed },
    ];
  }

  private async ensureAccess(businessId: string, organizationId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { organizationId: true },
    });
    if (!business) throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'Business not found');
    if (business.organizationId !== organizationId) {
      throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'Business not found');
    }
  }
}
