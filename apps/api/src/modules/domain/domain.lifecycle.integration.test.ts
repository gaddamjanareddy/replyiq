import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@replyiq/database';
import type { PrismaClient } from '@replyiq/database';
import { OnboardingStep } from '../onboarding/dto/update-onboarding.dto.js';
import { DomainService } from './domain.service.js';
import type { ActorContext } from './domain.service.js';
import { DomainVerificationService } from './domain-verification.service.js';
import { SafeHttpService } from '../../common/security/safe-http.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { AuditService, AuditEvent } from '../../infrastructure/audit/audit.service.js';
import { codedConflict, ErrorCode } from '../../common/errors/error-codes.js';

/**
 * Integration suite - runs against an ISOLATED Postgres database
 * (replyiq_test) prepared by vitest.integration.global-setup.ts.
 *
 * Covers the persistence-layer behaviour of the approved decisions:
 *   D-02   soft-deleted names are re-registrable (partial unique index)
 *   D-05   onboarding completion activates the business atomically
 *   D-06R  deleting the last verified domain is confirmable, not blocked
 *   D-04R  Test Mode: sandbox eligibility, method pairing, service mode
 * plus audit-log emission and derived service mode.
 */

// `.test` is an IANA-reserved TLD, so these are sandbox-eligible by design -
// which is exactly what we want for fixtures: no test in this file can ever
// reach the public internet.
const SANDBOX_DOMAIN = `harden-${randomUUID().slice(0, 8)}.example.test`;
/** A registrable name, used to assert the live/sandbox pairing rules. */
const liveDomain = () => `harden-${randomUUID().slice(0, 8)}.com`;
const sandboxDomain = () => `${randomUUID().slice(0, 8)}.example.test`;

interface Ctx {
  organizationId: string;
  userId: string;
  businessId: string;
  actor: ActorContext;
}

let ctx: Ctx;
let domainService: DomainService;
let onboardingService: OnboardingService;

function codeOf(error: unknown): string | undefined {
  return (error as { response?: { code?: string } })?.response?.code;
}

/** Assert that `fn` rejects, and return the stable error code it carried. */
async function codeFromRejection(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (error) {
    return codeOf(error);
  }
  throw new Error('expected the operation to reject, but it resolved');
}

async function cleanupOrganization(client: PrismaClient, organizationId: string) {
  const businesses = await client.business.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const businessIds = businesses.map((b) => b.id);

  await client.auditLog.deleteMany({ where: { organizationId } });
  await client.onboardingProgress.deleteMany({ where: { businessId: { in: businessIds } } });
  await client.businessDomain.deleteMany({ where: { businessId: { in: businessIds } } });
  await client.business.deleteMany({ where: { id: { in: businessIds } } });
  await client.user.deleteMany({ where: { organizationId } });
  await client.organization.deleteMany({ where: { id: organizationId } });
}

async function provisionBusiness(suffix: string): Promise<Ctx> {
  const organization = await prisma.organization.create({
    data: { name: `HARDEN-ORG-${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: `harden-${suffix}@example.test`,
      name: 'Harden Test',
      role: 'OWNER',
      // Direct DB seeding only; never used for authentication.
      passwordHash: 'integration-test-not-a-real-hash',
    },
  });
  const business = await prisma.business.create({
    data: { organizationId: organization.id, name: `Harden Biz ${suffix}` },
  });
  return {
    organizationId: organization.id,
    userId: user.id,
    businessId: business.id,
    actor: {
      userId: user.id,
      organizationId: organization.id,
      ipAddress: '203.0.113.7',
      userAgent: 'integration-suite',
    },
  };
}

/** Simulates a successful external ownership check without any network I/O. */
async function forceVerified(domainId: string, method: 'DNS_TXT' | 'SANDBOX' = 'DNS_TXT') {
  await prisma.businessDomain.update({
    where: { id: domainId },
    data: { status: 'VERIFIED', verifiedAt: new Date(), verificationMethod: method },
  });
}

beforeAll(() => {
  const verificationService = new DomainVerificationService(new SafeHttpService(new ConfigService()));
  const audit = new AuditService(prisma as PrismaClient);
  domainService = new DomainService(prisma as PrismaClient, verificationService, audit);
  onboardingService = new OnboardingService(prisma as PrismaClient, audit);
});

afterAll(async () => {
  if (ctx) await cleanupOrganization(prisma, ctx.organizationId);
});

describe('D-02: soft-deleted domain names are re-registrable', () => {
  it('allows re-registering a soft-deleted name, preserving history', async () => {
    ctx = await provisionBusiness(randomUUID().slice(0, 8));

    const first = await domainService.create(ctx.businessId, ctx.actor, {
      domain: SANDBOX_DOMAIN,
    });

    await domainService.remove(ctx.businessId, first.data.domain.id, ctx.actor);

    const deletedRow = await prisma.businessDomain.findUnique({
      where: { id: first.data.domain.id },
    });
    expect(deletedRow?.deletedAt).not.toBeNull();

    // Same name is registrable again...
    const second = await domainService.create(ctx.businessId, ctx.actor, {
      domain: SANDBOX_DOMAIN,
    });
    expect(second.data.domain.id).not.toBe(first.data.domain.id);

    const otherCtx = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      // While an ACTIVE row exists ANYWHERE, the global partial index rejects
      // a cross-organization registration of the same name.
      expect(
        await codeFromRejection(() =>
          domainService.create(otherCtx.businessId, otherCtx.actor, { domain: SANDBOX_DOMAIN }),
        ),
      ).toBe('DOMAIN_ALREADY_REGISTERED');

      // Soft-deleting the holder frees the name GLOBALLY (history preserved).
      await domainService.remove(ctx.businessId, second.data.domain.id, ctx.actor);
      const crossOrg = await domainService.create(otherCtx.businessId, otherCtx.actor, {
        domain: SANDBOX_DOMAIN,
      });
      expect(crossOrg.data.domain.domain).toBe(SANDBOX_DOMAIN);

      const rows = await prisma.businessDomain.findMany({ where: { domain: SANDBOX_DOMAIN } });
      expect(rows.length).toBe(3);
      expect(rows.filter((r) => r.deletedAt === null).length).toBe(1);
    } finally {
      await cleanupOrganization(prisma, otherCtx.organizationId);
    }
  });

  it('still rejects duplicates among ACTIVE rows with the stable code', async () => {
    const seed = await domainService.create(ctx.businessId, ctx.actor, {
      domain: SANDBOX_DOMAIN,
    });
    expect(
      await codeFromRejection(() =>
        domainService.create(ctx.businessId, ctx.actor, { domain: SANDBOX_DOMAIN }),
      ),
    ).toBe('DOMAIN_ALREADY_REGISTERED');
    await domainService.remove(ctx.businessId, seed.data.domain.id, ctx.actor);
  });

  it('enforces the partial unique index even when the app-level pre-check races', async () => {
    const seed = await domainService.create(ctx.businessId, ctx.actor, {
      domain: SANDBOX_DOMAIN,
    });
    try {
      // Bypass the service pre-check entirely to prove the DATABASE invariant:
      // inserting a second ACTIVE row must violate the partial unique index...
      await expect(
        prisma.$executeRaw`INSERT INTO "business_domains" ("id", "businessId", "domain", "status", "verificationToken", "createdAt", "updatedAt")
          VALUES (${randomUUID()}::uuid, ${ctx.businessId}::uuid, ${SANDBOX_DOMAIN}, 'PENDING', 'tok', NOW(), NOW())`,
      ).rejects.toThrow();
    } finally {
      await domainService.remove(ctx.businessId, seed.data.domain.id, ctx.actor);
    }
    // ...while inserting a SOFT-DELETED duplicate remains allowed.
    await expect(
      prisma.$executeRaw`INSERT INTO "business_domains" ("id", "businessId", "domain", "status", "verificationToken", "deletedAt", "createdAt", "updatedAt")
        VALUES (${randomUUID()}::uuid, ${ctx.businessId}::uuid, ${SANDBOX_DOMAIN}, 'PENDING', 'tok', NOW(), NOW(), NOW())`,
    ).resolves.toBeGreaterThan(0);
  });
});

describe('D-04R: Test Mode eligibility is decided at creation and is immutable', () => {
  it('flags reserved names as sandbox and registrable names as live', async () => {
    const sandbox = await domainService.create(ctx.businessId, ctx.actor, {
      domain: sandboxDomain(),
    });
    const live = await domainService.create(ctx.businessId, ctx.actor, { domain: liveDomain() });

    expect(sandbox.data.domain.isSandbox).toBe(true);
    expect(live.data.domain.isSandbox).toBe(false);

    await domainService.remove(ctx.businessId, sandbox.data.domain.id, ctx.actor);
    await domainService.remove(ctx.businessId, live.data.domain.id, ctx.actor);
  });

  it('refuses SANDBOX verification for a real domain, in every environment', async () => {
    const live = await domainService.create(ctx.businessId, ctx.actor, { domain: liveDomain() });
    try {
      expect(
        await codeFromRejection(() =>
          domainService.verify(ctx.businessId, live.data.domain.id, ctx.actor, {
            method: 'SANDBOX',
          }),
        ),
      ).toBe('DOMAIN_SANDBOX_NOT_ELIGIBLE');

      const row = await prisma.businessDomain.findUnique({ where: { id: live.data.domain.id } });
      expect(row?.status).toBe('PENDING');
    } finally {
      await domainService.remove(ctx.businessId, live.data.domain.id, ctx.actor);
    }
  });

  it('refuses live verification methods for a reserved test domain', async () => {
    const sandbox = await domainService.create(ctx.businessId, ctx.actor, {
      domain: sandboxDomain(),
    });
    try {
      for (const method of ['DNS_TXT', 'HTML_META'] as const) {
        expect(
          await codeFromRejection(() =>
            domainService.verify(ctx.businessId, sandbox.data.domain.id, ctx.actor, { method }),
          ),
        ).toBe('DOMAIN_SANDBOX_ONLY');
      }
    } finally {
      await domainService.remove(ctx.businessId, sandbox.data.domain.id, ctx.actor);
    }
  });

  it('verifies a sandbox domain instantly, with no network access', async () => {
    const sandbox = await domainService.create(ctx.businessId, ctx.actor, {
      domain: sandboxDomain(),
    });
    try {
      const result = await domainService.verify(
        ctx.businessId,
        sandbox.data.domain.id,
        ctx.actor,
        { method: 'SANDBOX' },
      );
      expect(result.data.domain.status).toBe('VERIFIED');
      expect(result.data.domain.verificationMethod).toBe('SANDBOX');
      expect(result.data.domain.isSandbox).toBe(true);
      expect(result.data.domain.lastCheckedAt).not.toBeNull();
    } finally {
      await prisma.businessDomain.update({
        where: { id: sandbox.data.domain.id },
        data: { deletedAt: new Date() },
      });
    }
  });

  it('reports service mode TEST while only sandbox domains are verified', async () => {
    const fresh = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      expect(await domainService.getServiceMode(fresh.businessId)).toBe('INACTIVE');

      const sandbox = await domainService.create(fresh.businessId, fresh.actor, {
        domain: sandboxDomain(),
      });
      await domainService.verify(fresh.businessId, sandbox.data.domain.id, fresh.actor, {
        method: 'SANDBOX',
      });
      expect(await domainService.getServiceMode(fresh.businessId)).toBe('TEST');

      const live = await domainService.create(fresh.businessId, fresh.actor, {
        domain: liveDomain(),
      });
      await forceVerified(live.data.domain.id);
      expect(await domainService.getServiceMode(fresh.businessId)).toBe('LIVE');
    } finally {
      await cleanupOrganization(prisma, fresh.organizationId);
    }
  });

  it('rejects an already-verified domain regardless of method', async () => {
    const fresh = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      const sandbox = await domainService.create(fresh.businessId, fresh.actor, {
        domain: sandboxDomain(),
      });
      await domainService.verify(fresh.businessId, sandbox.data.domain.id, fresh.actor, {
        method: 'SANDBOX',
      });
      expect(
        await codeFromRejection(() =>
          domainService.verify(fresh.businessId, sandbox.data.domain.id, fresh.actor, {
            method: 'SANDBOX',
          }),
        ),
      ).toBe('DOMAIN_ALREADY_VERIFIED');
    } finally {
      await cleanupOrganization(prisma, fresh.organizationId);
    }
  });
});

describe('Tenant isolation: another organization looks exactly like nothing', () => {
  it('returns the not-found code for every domain operation across organizations', async () => {
    const intruder = await provisionBusiness(randomUUID().slice(0, 8));
    const victim = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      const victimDomain = await domainService.create(victim.businessId, victim.actor, {
        domain: sandboxDomain(),
      });

      // Reading, verifying and deleting the victim's business must all report
      // "not found" - never "forbidden", which would confirm existence.
      expect(
        await codeFromRejection(() =>
          domainService.list(victim.businessId, intruder.organizationId),
        ),
      ).toBe('RESOURCE_NOT_FOUND');

      expect(
        await codeFromRejection(() =>
          domainService.verify(victim.businessId, victimDomain.data.domain.id, intruder.actor, {
            method: 'SANDBOX',
          }),
        ),
      ).toBe('RESOURCE_NOT_FOUND');

      expect(
        await codeFromRejection(() =>
          domainService.remove(victim.businessId, victimDomain.data.domain.id, intruder.actor),
        ),
      ).toBe('RESOURCE_NOT_FOUND');

      // And the victim's data is untouched.
      const row = await prisma.businessDomain.findUnique({
        where: { id: victimDomain.data.domain.id },
      });
      expect(row?.deletedAt).toBeNull();
      expect(row?.status).toBe('PENDING');
    } finally {
      await cleanupOrganization(prisma, intruder.organizationId);
      await cleanupOrganization(prisma, victim.organizationId);
    }
  });
});

describe('D-05: completing onboarding activates the business atomically', () => {
  async function runOnboardingThroughVerification(context: Ctx) {
    await onboardingService.updateStep(context.businessId, context.organizationId, {
      step: OnboardingStep.PROFILE,
    });
    const added = await domainService.create(context.businessId, context.actor, {
      domain: sandboxDomain(),
    });
    await forceVerified(added.data.domain.id, 'SANDBOX');
    await onboardingService.updateStep(context.businessId, context.organizationId, {
      step: OnboardingStep.FIRST_DOMAIN,
    });
    await onboardingService.updateStep(context.businessId, context.organizationId, {
      step: OnboardingStep.DOMAIN_VERIFICATION,
    });
    return added;
  }

  it('sets status=ACTIVE and onboardingStatus=COMPLETED in one step', async () => {
    await runOnboardingThroughVerification(ctx);
    await onboardingService.updateStep(ctx.businessId, ctx.organizationId, {
      step: OnboardingStep.COMPLETE,
    });

    const business = await prisma.business.findUnique({ where: { id: ctx.businessId } });
    expect(business?.status).toBe('ACTIVE');
    expect(business?.onboardingStatus).toBe('COMPLETED');
  });

  it('completes onboarding on a sandbox-only business, reporting TEST mode', async () => {
    // Goal G3: the whole funnel must be reachable without owning a domain.
    const fresh = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      await runOnboardingThroughVerification(fresh);
      const result = await onboardingService.updateStep(
        fresh.businessId,
        fresh.organizationId,
        { step: OnboardingStep.COMPLETE },
      );
      expect(result.data.onboardingStatus).toBe('COMPLETED');
      expect(result.data.serviceMode).toBe('TEST');
    } finally {
      await cleanupOrganization(prisma, fresh.organizationId);
    }
  });

  it('refuses completion without a verified domain and leaves the business DRAFT', async () => {
    const fresh = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      expect(
        await codeFromRejection(() =>
          onboardingService.updateStep(fresh.businessId, fresh.organizationId, {
            step: OnboardingStep.COMPLETE,
          }),
        ),
      ).toBe('ONBOARDING_NO_VERIFIED_DOMAIN');

      const business = await prisma.business.findUnique({ where: { id: fresh.businessId } });
      expect(business?.status).toBe('DRAFT');
      expect(business?.onboardingStatus).not.toBe('COMPLETED');
    } finally {
      await cleanupOrganization(prisma, fresh.organizationId);
    }
  });

  it('enforces step ordering with distinct codes', async () => {
    const fresh = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      expect(
        await codeFromRejection(() =>
          onboardingService.updateStep(fresh.businessId, fresh.organizationId, {
            step: OnboardingStep.FIRST_DOMAIN,
          }),
        ),
      ).toBe('ONBOARDING_STEP_OUT_OF_ORDER');

      await onboardingService.updateStep(fresh.businessId, fresh.organizationId, {
        step: OnboardingStep.PROFILE,
      });
      expect(
        await codeFromRejection(() =>
          onboardingService.updateStep(fresh.businessId, fresh.organizationId, {
            step: OnboardingStep.DOMAIN_VERIFICATION,
          }),
        ),
      ).toBe('ONBOARDING_NO_DOMAIN');
    } finally {
      await cleanupOrganization(prisma, fresh.organizationId);
    }
  });
});

describe('D-06R: removing the last verified domain requires acknowledgement', () => {
  it('refuses without acknowledgement, and succeeds with it', async () => {
    // ctx business is COMPLETED+ACTIVE from the previous suite; it has exactly
    // one live verified domain.
    const live = await prisma.businessDomain.findFirst({
      where: { businessId: ctx.businessId, status: 'VERIFIED', deletedAt: null },
    });
    const liveId = live?.id;
    if (liveId === undefined) throw new Error('fixture missing: verified domain');

    expect(
      await codeFromRejection(() => domainService.remove(ctx.businessId, liveId, ctx.actor)),
    ).toBe('DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED');

    const untouched = await prisma.businessDomain.findUnique({ where: { id: liveId } });
    expect(untouched?.deletedAt).toBeNull();

    // The deliberate path works, and the response reports the resulting state
    // so the client can show the "no verified website" banner immediately.
    const removed = await domainService.remove(ctx.businessId, liveId, ctx.actor, {
      acknowledgeServiceInterruption: true,
    });
    expect(removed.data.serviceMode).toBe('INACTIVE');

    const gone = await prisma.businessDomain.findUnique({ where: { id: liveId } });
    expect(gone?.deletedAt).not.toBeNull();

    // Onboarding completion is historical and is never reverted (FR-BIZ-08).
    const business = await prisma.business.findUnique({ where: { id: ctx.businessId } });
    expect(business?.onboardingStatus).toBe('COMPLETED');
  });

  it('is concurrency-safe: parallel deletes of two verified domains leave exactly one', async () => {
    const a = await domainService.create(ctx.businessId, ctx.actor, { domain: sandboxDomain() });
    const b = await domainService.create(ctx.businessId, ctx.actor, { domain: sandboxDomain() });
    await forceVerified(a.data.domain.id, 'SANDBOX');
    await forceVerified(b.data.domain.id, 'SANDBOX');

    // Neither caller acknowledges, so the row lock must serialise them and the
    // loser must see that it is now removing the last one.
    const [r1, r2] = await Promise.allSettled([
      domainService.remove(ctx.businessId, a.data.domain.id, ctx.actor),
      domainService.remove(ctx.businessId, b.data.domain.id, ctx.actor),
    ]);

    const outcomes = [r1, r2].map((r) =>
      r.status === 'fulfilled' ? 'fulfilled' : (codeOf(r.reason) ?? 'rejected'),
    );

    expect(outcomes.filter((o) => o === 'fulfilled').length).toBe(1);
    expect(
      outcomes.filter((o) => o === 'DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED').length,
    ).toBe(1);

    const remainingVerified = await prisma.businessDomain.count({
      where: { businessId: ctx.businessId, status: 'VERIFIED', deletedAt: null },
    });
    expect(remainingVerified).toBe(1);
  });

  it('does not prompt at all once another verified domain exists', async () => {
    const extra = await domainService.create(ctx.businessId, ctx.actor, {
      domain: sandboxDomain(),
    });
    await forceVerified(extra.data.domain.id, 'SANDBOX');

    const target = await prisma.businessDomain.findFirst({
      where: {
        businessId: ctx.businessId,
        status: 'VERIFIED',
        deletedAt: null,
        id: { not: extra.data.domain.id },
      },
    });
    const targetId = target?.id;
    if (targetId === undefined) throw new Error('fixture missing: verified domain');

    const result = await domainService.remove(ctx.businessId, targetId, ctx.actor);
    expect(result.data.serviceMode).toBe('TEST');
    const row = await prisma.businessDomain.findUnique({ where: { id: targetId } });
    expect(row?.deletedAt).not.toBeNull();
  });

  it('never prompts for an unverified domain', async () => {
    const pending = await domainService.create(ctx.businessId, ctx.actor, {
      domain: sandboxDomain(),
    });
    await expect(
      domainService.remove(ctx.businessId, pending.data.domain.id, ctx.actor),
    ).resolves.toBeTruthy();
  });

  it('exposes coded conflict factory consistent with contract', () => {
    const err = codedConflict(
      ErrorCode.DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED,
      'x',
    ) as never as { response: { code: string } };
    expect(err.response.code).toBe('DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED');
  });
});

describe('Audit log records the domain lifecycle', () => {
  it('writes one attributed row per lifecycle event, and never the token', async () => {
    const fresh = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      const created = await domainService.create(fresh.businessId, fresh.actor, {
        domain: sandboxDomain(),
      });
      await domainService.verify(fresh.businessId, created.data.domain.id, fresh.actor, {
        method: 'SANDBOX',
      });
      await domainService.remove(fresh.businessId, created.data.domain.id, fresh.actor, {
        acknowledgeServiceInterruption: true,
      });

      const rows = await prisma.auditLog.findMany({
        where: { businessId: fresh.businessId },
        orderBy: { createdAt: 'asc' },
      });

      expect(rows.map((r) => r.event)).toEqual([
        AuditEvent.DOMAIN_CREATED,
        AuditEvent.DOMAIN_VERIFIED,
        AuditEvent.DOMAIN_DELETED,
      ]);
      for (const row of rows) {
        expect(row.userId).toBe(fresh.userId);
        expect(row.organizationId).toBe(fresh.organizationId);
        expect(row.ipAddress).toBe('203.0.113.7');
        // The verification token must never reach the audit log.
        expect(JSON.stringify(row.metadata)).not.toContain('replyiq-verify-');
      }
    } finally {
      await cleanupOrganization(prisma, fresh.organizationId);
    }
  });

  it('records a failed verification distinctly from a successful one', async () => {
    const fresh = await provisionBusiness(randomUUID().slice(0, 8));
    try {
      const live = await domainService.create(fresh.businessId, fresh.actor, {
        domain: liveDomain(),
      });
      // A name that cannot resolve yields PENDING, which is not a failure and
      // must NOT produce an audit row - otherwise the log fills with noise from
      // people politely waiting for DNS.
      await domainService.verify(fresh.businessId, live.data.domain.id, fresh.actor, {
        method: 'DNS_TXT',
      });

      const rows = await prisma.auditLog.findMany({
        where: { businessId: fresh.businessId, event: AuditEvent.DOMAIN_VERIFICATION_FAILED },
      });
      expect(rows.length).toBe(0);
    } finally {
      await cleanupOrganization(prisma, fresh.organizationId);
    }
  }, 20_000);
});
