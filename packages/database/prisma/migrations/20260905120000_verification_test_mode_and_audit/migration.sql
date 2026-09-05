-- Domain verification Test Mode + audit logging.
--
-- Adds:
--   1. SANDBOX / DEV_BYPASS members to the VerificationMethod enum.
--   2. business_domains.isSandbox   - the Test Mode security boundary.
--   3. business_domains.lastCheckedAt - last verification attempt timestamp.
--   4. audit_logs                   - append-only security event record.
--
-- Backfill note: every pre-existing row was verified (or is pending) against a
-- real network check, so isSandbox defaults to false for all of them, which is
-- correct. No existing row can have been sandbox-verified because the method
-- did not exist.

-- 1. Enum members. Postgres requires these outside a transaction block in some
--    versions; ADD VALUE IF NOT EXISTS is idempotent and safe to re-run.
ALTER TYPE "VerificationMethod" ADD VALUE IF NOT EXISTS 'SANDBOX';
ALTER TYPE "VerificationMethod" ADD VALUE IF NOT EXISTS 'DEV_BYPASS';

-- 2/3. New columns on business_domains.
ALTER TABLE "business_domains"
  ADD COLUMN IF NOT EXISTS "isSandbox" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastCheckedAt" TIMESTAMP(3);

-- Hot path for "does this business have an active verified domain?", which the
-- derived service mode (LIVE / TEST / INACTIVE) evaluates on every dashboard load.
CREATE INDEX IF NOT EXISTS "business_domains_businessId_status_deletedAt_idx"
  ON "business_domains"("businessId", "status", "deletedAt");

-- 4. Audit log.
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"             UUID         NOT NULL,
  "organizationId" UUID,
  "userId"         UUID,
  "businessId"     UUID,
  "event"          VARCHAR(100) NOT NULL,
  "resourceType"   VARCHAR(50),
  "resourceId"     UUID,
  "metadata"       JSONB,
  "ipAddress"      VARCHAR(45),
  "userAgent"      VARCHAR(512),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- No foreign keys by design: an audit row must survive deletion of the actor or
-- the resource it describes. Referential integrity would defeat the purpose.
CREATE INDEX IF NOT EXISTS "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_businessId_createdAt_idx"     ON "audit_logs"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_event_createdAt_idx"          ON "audit_logs"("event", "createdAt");
