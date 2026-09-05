-- Approved decision D-02: business_domains.domain uniqueness applies to
-- ACTIVE rows only, so soft-deleted domain names become re-registrable.
--
-- This is a deliberate hand-maintained migration: Prisma DSL cannot express
-- partial indexes. Do NOT replace this with a full-table unique constraint
-- (e.g. a regenerated @@unique([domain]) on the Prisma model) - that would
-- silently re-block re-registration of deleted names.
--
-- Forward safety: the previous global unique index guarantees at most one row
-- per domain (active or deleted), so the partial index below can never fail
-- creation. No data is modified or removed.

DROP INDEX IF EXISTS "business_domains_domain_key";

CREATE UNIQUE INDEX "business_domains_domain_active_key"
  ON "business_domains"("domain")
  WHERE "deletedAt" IS NULL;
