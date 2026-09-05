import { Inject, Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value import required for emitDecoratorMetadata DI
import { PrismaClient } from '@replyiq/database';

/**
 * Canonical audit event names. Dotted `resource.action`, past tense.
 *
 * Kept as a closed set so the log is queryable: an operator investigating "who
 * verified this domain" greps one string, not a family of near-synonyms that
 * accumulated over time.
 */
export const AuditEvent = {
  DOMAIN_CREATED: 'domain.created',
  DOMAIN_VERIFIED: 'domain.verified',
  DOMAIN_VERIFICATION_FAILED: 'domain.verification_failed',
  DOMAIN_DELETED: 'domain.deleted',
  /** Broken out from DOMAIN_VERIFIED: the one event that must be trivially
   *  auditable on its own, per FR-TEST-12. */
  DOMAIN_DEV_BYPASS_USED: 'domain.dev_bypass_used',
  ONBOARDING_COMPLETED: 'onboarding.completed',
} as const;

export type AuditEventName = (typeof AuditEvent)[keyof typeof AuditEvent];

export interface AuditEntry {
  event: AuditEventName;
  organizationId?: string | null;
  userId?: string | null;
  businessId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  /** Event detail. MUST NOT contain secrets - never the verification token. */
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  /**
   * Write an audit row.
   *
   * Deliberately never throws. An audit write failing must not fail a
   * verification the user legitimately completed - losing a log line is the
   * lesser harm, and the failure is still surfaced through the application
   * logger where alerting can see it. Callers therefore do not need (and should
   * not add) their own try/catch.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          event: entry.event,
          organizationId: entry.organizationId ?? null,
          userId: entry.userId ?? null,
          businessId: entry.businessId ?? null,
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          metadata: (entry.metadata ?? undefined) as never,
          ipAddress: entry.ipAddress ?? null,
          userAgent: truncate(entry.userAgent, 512),
        },
      });
    } catch (error) {
      this.logger.error(
        `Audit write failed for ${entry.event} (resource ${entry.resourceId ?? 'n/a'}): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}
