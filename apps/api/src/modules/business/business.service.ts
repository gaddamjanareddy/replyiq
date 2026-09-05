import { Injectable, Inject } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PrismaClient } from '@replyiq/database';
import type { Business, OnboardingStatus } from '@replyiq/database';
import type { UpdateBusinessDto } from './dto/update-business.dto.js';
import { ErrorCode, codedNotFound } from '../../common/errors/error-codes.js';
import { computeServiceMode } from '../../common/business/service-mode.js';
import type { ServiceMode } from '../../common/business/service-mode.js';

export interface BusinessResponse {
  success: boolean;
  message: string;
  data: {
    business: {
      id: string;
      organizationId: string;
      name: string;
      industry: string | null;
      description: string | null;
      websiteUrl: string | null;
      onboardingStatus: OnboardingStatus;
      status: string;
      /**
       * Current ability to serve traffic, derived from domain rows on every
       * read (FR-BIZ-07): LIVE (a real verified domain), TEST (only sandbox
       * domains verified), INACTIVE (none). Never stored, so it cannot drift.
       */
      serviceMode: ServiceMode;
      createdAt: Date;
      updatedAt: Date;
    };
  };
}

@Injectable()
export class BusinessService {
  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  async findById(businessId: string, organizationId: string): Promise<BusinessResponse> {
    const business = await this.requireOwnBusiness(businessId, organizationId);
    return this.respond(business);
  }

  async update(
    businessId: string,
    organizationId: string,
    dto: UpdateBusinessDto,
  ): Promise<BusinessResponse> {
    await this.requireOwnBusiness(businessId, organizationId);

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.industry !== undefined && { industry: dto.industry }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
      },
    });

    return this.respond(updated, 'Business updated successfully');
  }

  /**
   * Defence in depth behind OrganizationGuard. A business in another
   * organization returns exactly what a non-existent business returns, so
   * probing cannot tell the two apart (NFR-SEC-18).
   */
  private async requireOwnBusiness(id: string, organizationId: string): Promise<Business> {
    const business = await this.prisma.business.findFirst({ where: { id, deletedAt: null } });
    if (!business || business.organizationId !== organizationId) {
      throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'Business not found');
    }
    return business;
  }

  private async respond(
    business: Business,
    message = 'Business retrieved successfully',
  ): Promise<BusinessResponse> {
    const verified = await this.prisma.businessDomain.findMany({
      where: { businessId: business.id, status: 'VERIFIED', deletedAt: null },
      select: { isSandbox: true },
    });

    return {
      success: true,
      message,
      data: {
        business: {
          id: business.id,
          organizationId: business.organizationId,
          name: business.name,
          industry: business.industry,
          description: business.description,
          websiteUrl: business.websiteUrl,
          onboardingStatus: business.onboardingStatus,
          status: business.status,
          serviceMode: computeServiceMode(verified),
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
        },
      },
    };
  }
}
