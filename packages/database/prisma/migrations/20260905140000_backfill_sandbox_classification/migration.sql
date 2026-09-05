-- Backfill business_domains."isSandbox" for rows created before the classifier
-- existed.
--
-- The previous migration defaulted every existing row to false and claimed that
-- was correct because "the method did not exist". That reasoning was wrong. It
-- holds for how a row was *verified*, but isSandbox describes the HOSTNAME, not
-- the verification event - and a pre-existing row whose hostname sits in a
-- reserved namespace is a sandbox domain whether or not the concept existed
-- when it was inserted.
--
-- Two concrete consequences of leaving it false:
--   1. A PENDING reserved name (e.g. "example.com") would be offered the live
--      DNS / website methods, which can never succeed for a name IANA holds -
--      a guaranteed dead end for the user.
--   2. A VERIFIED reserved name would count toward LIVE service mode, and from
--      Milestone 7 would be allowed to serve a live widget on a name nobody
--      owns. isSandbox is the enforcement point for that refusal, so it has to
--      be true here.
--
-- Applied to every row regardless of status or soft-deletion: the
-- classification is a property of the string, so it is true uniformly. This
-- mirrors isSandboxDomain() in apps/api/src/common/security/sandbox-domains.ts;
-- the operator-configured SANDBOX_DOMAIN_SUFFIX is deliberately NOT applied,
-- because it is deployment-specific and may differ from the value in force when
-- these rows were written.

UPDATE "business_domains"
SET "isSandbox" = true
WHERE "isSandbox" = false
  AND (
    -- Reserved TLDs (RFC 2606 / 6761 / 6762, ICANN .internal), incl. the
    -- single-label form that an older, looser hostname pattern allowed.
    "domain" ~ '\.(test|example|invalid|localhost|local|internal)$'
    OR "domain" IN ('test', 'example', 'invalid', 'localhost', 'local', 'internal')
    -- Reserved second-level names held by IANA (RFC 2606 §3).
    OR "domain" IN ('example.com', 'example.net', 'example.org', 'example.edu')
    OR "domain" LIKE '%.example.com'
    OR "domain" LIKE '%.example.net'
    OR "domain" LIKE '%.example.org'
    OR "domain" LIKE '%.example.edu'
  );
