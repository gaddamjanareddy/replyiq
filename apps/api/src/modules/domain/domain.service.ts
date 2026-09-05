import { Inject, Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PrismaClient } from '@replyiq/database';
import type { BusinessDomain, VerificationMethod } from '@replyiq/database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import {
  DomainVerificationService,
  VerificationOutcome,
} from './domain-verification.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { AuditService } from '../../infrastructure/audit/audit.service.js';
import { AuditEvent } from '../../infrastructure/audit/audit.service.js';
import type { CreateDomainDto } from './dto/create-domain.dto.js';
import type { VerifyDomainDto } from './dto/verify-domain.dto.js';
import {
  ErrorCode,
  InfoCode,
  codedBadRequest,
  codedConflict,
  codedNotFound,
} from '../../common/errors/error-codes.js';
import {
  describeSandboxEligibility,
  isSandboxDomain,
} from '../../common/security/sandbox-domains.js';
import { DEV_VERIFICATION_BYPASS_ENABLED } from '../../config/verification-methods.js';
import { computeServiceMode } from '../../common/business/service-mode.js';
import type { ServiceMode } from '../../common/business/service-mode.js';

/** Who is acting, for audit attribution. Never trusted for authorization. */
export interface ActorContext {
  userId: string;
  organizationId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface DomainView {
  id: string;
  businessId: string;
  domain: string;
  isPrimary: boolean;
  status: string;
  /** True for reserved test domains. Drives the "Test" badge and, from M7, the
   *  widget's refusal to serve live traffic. */
  isSandbox: boolean;
  verifiedAt: Date | null;
  verificationMethod: VerificationMethod | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
}

export interface DomainResponse {
  success: boolean;
  message: string;
  code?: string;
  data: { domain: DomainView };
}

export interface DomainListResponse {
  success: boolean;
  message: string;
  data: { domains: DomainView[] };
}

export type { ServiceMode };

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class DomainService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly verificationService: DomainVerificationService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Read
  // ─────────────────────────────────────────────────────────────────────────

  async list(businessId: string, organizationId: string): Promise<DomainListResponse> {
    await this.ensureAccess(businessId, organizationId);

    const domains = await this.prisma.businessDomain.findMany({
      where: { businessId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      success: true,
      message: 'Domains retrieved successfully',
      data: { domains: domains.map((d) => this.formatDomain(d)) },
    };
  }

  /**
   * The business's current ability to serve traffic. Used by the dashboard
   * banner and, from M7, by the widget config endpoint.
   */
  async getServiceMode(businessId: string): Promise<ServiceMode> {
    const verified = await this.prisma.businessDomain.findMany({
      where: { businessId, status: 'VERIFIED', deletedAt: null },
      select: { isSandbox: true },
    });
    return computeServiceMode(verified);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────────────────────────────────

  async create(
    businessId: string,
    actor: ActorContext,
    dto: CreateDomainDto,
  ): Promise<DomainResponse> {
    await this.ensureAccess(businessId, actor.organizationId);

    // Uniqueness applies to ACTIVE rows only (D-02). Soft-deleted names are
    // re-registrable; the partial unique index enforces the same invariant
    // under concurrency, so this pre-check is for the friendly error, not for
    // correctness.
    const existing = await this.prisma.businessDomain.findFirst({
      where: { domain: dto.domain, deletedAt: null },
    });
    if (existing) {
      throw codedConflict(
        ErrorCode.DOMAIN_ALREADY_REGISTERED,
        'Domain already registered',
      );
    }

    const verificationToken = this.verificationService.generateToken();
    // Decided once, from the hostname alone. Domain strings are immutable
    // (FR-DOM-14), so this can never need recomputing and a domain can never
    // drift between live and test mode.
    const sandbox = isSandboxDomain(dto.domain);

    let domain;
    try {
      domain = await this.prisma.businessDomain.create({
        data: {
          businessId,
          domain: dto.domain,
          isPrimary: dto.isPrimary ?? false,
          verificationToken,
          isSandbox: sandbox,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw codedConflict(
          ErrorCode.DOMAIN_ALREADY_REGISTERED,
          'Domain already registered',
        );
      }
      throw error;
    }

    await this.audit.record({
      event: AuditEvent.DOMAIN_CREATED,
      organizationId: actor.organizationId,
      userId: actor.userId,
      businessId,
      resourceType: 'BusinessDomain',
      resourceId: domain.id,
      // Never the token.
      metadata: { domain: domain.domain, isSandbox: sandbox },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return {
      success: true,
      message: 'Domain created successfully',
      data: { domain: this.formatDomain(domain) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Verify
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dispatch a verification attempt.
   *
   * Eligibility is checked before any work: a reserved test domain can only go
   * through SANDBOX, and a real domain can never go through it. That pairing is
   * the entire Test Mode security boundary - there is no role, header, claim or
   * environment that widens it, and the live methods contain no branch that a
   * request can steer (FR-TEST-03, FR-TEST-07).
   */
  async verify(
    businessId: string,
    domainId: string,
    actor: ActorContext,
    dto: VerifyDomainDto,
  ): Promise<DomainResponse> {
    const domain = await this.ensureAccessAndFindDomain(
      businessId,
      domainId,
      actor.organizationId,
    );

    if (domain.status === 'VERIFIED') {
      throw codedBadRequest(ErrorCode.DOMAIN_ALREADY_VERIFIED, 'Domain is already verified');
    }
    if (!domain.verificationToken) {
      // Unreachable in normal operation: the token is written at creation. If
      // it ever happens it is our bug, not the user's, so it surfaces as a
      // generic internal error rather than "no token available".
      throw codedNotFound(ErrorCode.DOMAIN_NOT_FOUND, 'Domain not found');
    }

    this.assertMethodEligible(domain, dto.method);

    const outcome = await this.runVerification(domain, dto.method);

    await this.prisma.businessDomain.update({
      where: { id: domainId },
      data: { lastCheckedAt: new Date() },
    });

    if (outcome === VerificationOutcome.MISMATCH) {
      await this.audit.record({
        event: AuditEvent.DOMAIN_VERIFICATION_FAILED,
        organizationId: actor.organizationId,
        userId: actor.userId,
        businessId,
        resourceType: 'BusinessDomain',
        resourceId: domainId,
        metadata: { domain: domain.domain, method: dto.method, outcome: 'MISMATCH' },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
      throw codedBadRequest(
        ErrorCode.DOMAIN_VERIFICATION_MISMATCH,
        'Verification record found but its value did not match',
      );
    }

    if (outcome === VerificationOutcome.PENDING) {
      // 200, not an error: nothing is wrong yet. This is the normal state while
      // DNS propagates, and the client renders a reassuring retry affordance.
      const refreshed = await this.prisma.businessDomain.findUniqueOrThrow({
        where: { id: domainId },
      });
      return {
        success: true,
        code: InfoCode.DOMAIN_VERIFICATION_PENDING,
        message: 'Verification not found yet',
        data: { domain: this.formatDomain(refreshed) },
      };
    }

    const updated = await this.prisma.businessDomain.update({
      where: { id: domainId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verificationMethod: dto.method as VerificationMethod,
      },
    });

    await this.updateOnboardingProgress(businessId, 'firstDomainVerified');

    await this.audit.record({
      event:
        dto.method === 'DEV_BYPASS'
          ? AuditEvent.DOMAIN_DEV_BYPASS_USED
          : AuditEvent.DOMAIN_VERIFIED,
      organizationId: actor.organizationId,
      userId: actor.userId,
      businessId,
      resourceType: 'BusinessDomain',
      resourceId: domainId,
      metadata: {
        domain: domain.domain,
        method: dto.method,
        isSandbox: domain.isSandbox,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return {
      success: true,
      message: 'Domain verified successfully',
      data: { domain: this.formatDomain(updated) },
    };
  }

  /**
   * Pair each domain with the one method that can legitimately prove it.
   *
   * DEV_BYPASS is exempt because it exists precisely to verify arbitrary names
   * in CI - and it can only be reached at all when the boot gate opened, since
   * outside that case the value is not a member of the request enum and the
   * ValidationPipe rejected it long before this method ran.
   */
  private assertMethodEligible(domain: BusinessDomain, method: string): void {
    if (method === 'DEV_BYPASS') return;

    if (method === 'SANDBOX' && !domain.isSandbox) {
      throw codedBadRequest(
        ErrorCode.DOMAIN_SANDBOX_NOT_ELIGIBLE,
        'Test verification is only available for reserved test domains',
      );
    }
    if (method !== 'SANDBOX' && domain.isSandbox) {
      throw codedBadRequest(
        ErrorCode.DOMAIN_SANDBOX_ONLY,
        'Reserved test domains are verified with the test method',
      );
    }
  }

  private async runVerification(
    domain: BusinessDomain,
    method: string,
  ): Promise<VerificationOutcome> {
    const token = domain.verificationToken as string;

    switch (method) {
      case 'DNS_TXT':
        return this.verificationService.verifyDnsTxt(domain.domain, token);
      case 'HTML_META':
        return this.verificationService.verifyHtmlMeta(domain.domain, token);
      case 'SANDBOX':
        // Eligibility was already proven from the hostname; there is nothing on
        // the network to check, because the name cannot exist on the network.
        return VerificationOutcome.VERIFIED;
      case 'DEV_BYPASS':
        // Defence in depth. Reaching here with the gate closed is impossible
        // (the value is not in the request enum), but an explicit assertion
        // means a future refactor that widens the enum cannot silently open the
        // bypass.
        return DEV_VERIFICATION_BYPASS_ENABLED
          ? VerificationOutcome.VERIFIED
          : VerificationOutcome.PENDING;
      default:
        return VerificationOutcome.PENDING;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Instructions
  // ─────────────────────────────────────────────────────────────────────────

  async getVerificationInstructions(
    businessId: string,
    domainId: string,
    organizationId: string,
    dto: VerifyDomainDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      method: string;
      isSandbox: boolean;
      sandboxReason?: string | null;
      recordName?: string | null;
      recordValue?: string | null;
      metaTag?: string | null;
      wellKnownPath?: string | null;
      wellKnownContent?: string | null;
    };
  }> {
    const domain = await this.ensureAccessAndFindDomain(businessId, domainId, organizationId);

    if (!domain.verificationToken) {
      throw codedNotFound(ErrorCode.DOMAIN_NOT_FOUND, 'Domain not found');
    }
    const token = domain.verificationToken;

    if (domain.isSandbox) {
      return {
        success: true,
        message: 'Test domain - no proof required',
        data: {
          method: 'SANDBOX',
          isSandbox: true,
          sandboxReason: describeSandboxEligibility(domain.domain),
          recordName: null,
          recordValue: null,
          metaTag: null,
          wellKnownPath: null,
          wellKnownContent: null,
        },
      };
    }

    if (dto.method === 'DNS_TXT') {
      return {
        success: true,
        message: 'DNS verification instructions',
        data: {
          method: 'DNS_TXT',
          isSandbox: false,
          // Identical on every retry, because the token never changes
          // (FR-DOM-05). A user who walks away and comes back finds the same
          // record they already published still being asked for.
          recordName: this.verificationService.getDnsTxtRecordName(domain.domain),
          recordValue: token,
          metaTag: null,
          wellKnownPath: null,
          wellKnownContent: null,
        },
      };
    }

    return {
      success: true,
      message: 'Website verification instructions',
      data: {
        method: 'HTML_META',
        isSandbox: false,
        recordName: null,
        recordValue: null,
        metaTag: this.verificationService.getHtmlMetaTag(token),
        wellKnownPath: this.verificationService.getWellKnownPath(),
        wellKnownContent: token,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Soft-delete a domain (D-02), with a deliberate stop before the destructive
   * case (D-06R).
   *
   * Removing the last verified domain takes the business offline, so it
   * requires `acknowledgeServiceInterruption`. That check lives on the API and
   * not only in a confirmation dialog, so the safety survives a script, a curl,
   * or a future client that forgets to ask. An earlier revision blocked the
   * action outright; that stranded anyone who had verified the wrong domain,
   * and a hard "no" on the user's own data is a worse answer than a clear
   * "are you sure".
   *
   * Concurrency: the transaction takes a row lock on the parent business
   * (`SELECT ... FOR UPDATE`) before counting, so two simultaneous deletes of
   * the last two verified domains cannot both observe a stale count and both
   * proceed. A naive check-then-delete would let both pass.
   */
  async remove(
    businessId: string,
    domainId: string,
    actor: ActorContext,
    options: { acknowledgeServiceInterruption?: boolean } = {},
  ): Promise<{ success: boolean; message: string; data: { serviceMode: ServiceMode } }> {
    await this.ensureAccess(businessId, actor.organizationId);
    const domain = await this.requireDomain(businessId, domainId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "businesses" WHERE "id" = ${businessId}::uuid FOR UPDATE`;

      if (domain.status === 'VERIFIED' && !options.acknowledgeServiceInterruption) {
        const otherVerified = await tx.businessDomain.count({
          where: { businessId, status: 'VERIFIED', deletedAt: null, id: { not: domainId } },
        });
        if (otherVerified === 0) {
          throw codedConflict(
            ErrorCode.DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED,
            'Removing the only verified domain requires explicit acknowledgement',
          );
        }
      }

      await tx.businessDomain.update({
        where: { id: domainId },
        data: { deletedAt: new Date() },
      });
    });

    await this.audit.record({
      event: AuditEvent.DOMAIN_DELETED,
      organizationId: actor.organizationId,
      userId: actor.userId,
      businessId,
      resourceType: 'BusinessDomain',
      resourceId: domainId,
      metadata: {
        domain: domain.domain,
        wasVerified: domain.status === 'VERIFIED',
        acknowledged: options.acknowledgeServiceInterruption === true,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    // Returning the resulting mode lets the client show the "no verified
    // website" banner immediately, rather than after a refetch race.
    return {
      success: true,
      message: 'Domain deleted successfully',
      data: { serviceMode: await this.getServiceMode(businessId) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Access helpers - defence in depth behind OrganizationGuard
  // ─────────────────────────────────────────────────────────────────────────

  private async ensureAccess(
    businessId: string,
    organizationId: string,
  ): Promise<{ onboardingStatus: string }> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { organizationId: true, onboardingStatus: true },
    });
    // Cross-organization access returns exactly what a non-existent business
    // returns, so probing cannot distinguish the two (NFR-SEC-18).
    if (!business) throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'Business not found');
    if (business.organizationId !== organizationId) {
      throw codedNotFound(ErrorCode.RESOURCE_NOT_FOUND, 'Business not found');
    }
    return { onboardingStatus: business.onboardingStatus };
  }

  private async requireDomain(businessId: string, domainId: string): Promise<BusinessDomain> {
    const domain = await this.prisma.businessDomain.findUnique({ where: { id: domainId } });
    if (!domain || domain.deletedAt || domain.businessId !== businessId) {
      throw codedNotFound(ErrorCode.DOMAIN_NOT_FOUND, 'Domain not found');
    }
    return domain;
  }

  private async ensureAccessAndFindDomain(
    businessId: string,
    domainId: string,
    organizationId: string,
  ): Promise<BusinessDomain> {
    await this.ensureAccess(businessId, organizationId);
    return this.requireDomain(businessId, domainId);
  }

  private async updateOnboardingProgress(
    businessId: string,
    step: 'firstDomainAdded' | 'firstDomainVerified',
  ): Promise<void> {
    const now = new Date();
    const data =
      step === 'firstDomainAdded'
        ? { firstDomainAdded: true, firstDomainAddedAt: now }
        : { firstDomainVerified: true, firstDomainVerifiedAt: now };

    await this.prisma.onboardingProgress.upsert({
      where: { businessId },
      create: { businessId, ...data },
      update: data,
    });
  }

  /** Note: `verificationToken` is never included. It is exposed only through
   *  the instructions endpoint, to the org that owns the domain. */
  private formatDomain(domain: BusinessDomain): DomainView {
    return {
      id: domain.id,
      businessId: domain.businessId,
      domain: domain.domain,
      isPrimary: domain.isPrimary,
      status: domain.status,
      isSandbox: domain.isSandbox,
      verifiedAt: domain.verifiedAt,
      verificationMethod: domain.verificationMethod,
      lastCheckedAt: domain.lastCheckedAt,
      createdAt: domain.createdAt,
    };
  }
}
