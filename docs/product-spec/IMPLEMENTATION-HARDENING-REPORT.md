# IMPLEMENTATION HARDENING REPORT

**Date:** 2026-08-24
**Scope:** Approved decisions D-01 … D-07 from `SPEC-RECONCILIATION-REPORT.md` (roadmap R1–R12), implemented end-to-end across spec, backend, frontend, database, and tests.
**Rule followed:** every result below comes from an actually executed command. No claim of "PASS" without a recorded run.

---

## 1. Executive Summary

All seven approved decisions are implemented and verified:

| Decision | Summary | Status |
|---|---|---|
| D-01 | Fixed-file domain verification only (`replyiq-verify:{token}`), shipped together with SSRF hardening | **IMPLEMENTED** |
| D-02 | Domain uniqueness applies to ACTIVE rows only, via a hand-maintained partial unique index | **IMPLEMENTED** (migration applied) |
| D-03 | Register response keeps its flat envelope (breaking unification deferred) | **CONFIRMED AS CONTRACT** |
| D-04 | No DEV_BYPASS anywhere; test-only fetch override gated on `NODE_ENV === 'test'` | **IMPLEMENTED** |
| D-05 | COMPLETE ⇒ business `status=ACTIVE` atomically inside ONE Prisma transaction | **IMPLEMENTED** |
| D-06 | Completed businesses cannot lose their last live VERIFIED domain (concurrency-safe, stable code) | **IMPLEMENTED** |
| D-07 | OWNER/ADMIN/MANAGER matrix enforced server-side on all mutating endpoints | **IMPLEMENTED** |

Validation gates at time of writing:

- `pnpm turbo run lint typecheck build test` → **Tasks: 29 successful, 29 total**
- API unit tests → **55 passed (55)** across 3 files
- API integration tests (isolated DB) → **9 passed (9)**, verified idempotent over 3 consecutive runs
- Web unit tests → **11 passed (11)**
- `prisma validate` → valid; `prisma migrate status` → "Database schema is up to date!" (4 migrations)

---

## 2. Backend Implementation

### 2.1 SSRF Hardening for Verification Fetches (D-01, R1)

New module: `apps/api/src/common/security/ssrf-guard.ts`

- Blocked IPv4 ranges (long-arithmetic CIDR check): loopback `127/8`, RFC1918, CGNAT `100.64/10`, link-local `169.254/16` (cloud metadata included), benchmarking `198.18/15`, TEST-NET-1/2/3, multicast, reserved `0/8`, broadcast.
- Full IPv6 handling: expansion with dotted-quad tail normalization (`::ffff:8.8.8.8`), ULA `fc00::/7`, link-local `fe80::/10`, multicast `ff00::/8`, discard-only `100::/64`, documentation `2001:db8::/32`, IPv4-mapped `::ffff:0:0/96` with embedded-v4 validation, 6to4 `2002::/16` with embedded-v4 validation, Teredo blocked outright.
- `assertPublicHostname`: rejects IP literals, `localhost`, malformed names, oversized names (>253).
- `resolvePinnedAddress`: resolves A + AAAA concurrently; **every** returned record must be public (a single private answer aborts); prefers IPv4; total DNS failure raises retryable `DnsResolutionError`.
- `assertSafeHop`: http/https only, ports 80/443 only, no userinfo, no IP-literal hosts — applied to every redirect hop.

`DomainVerificationService` rewritten:

- Total budget 5 s (`AbortController`), max 3 manual redirects (each hop fully revalidated against DNS rebinding by dialing the pinned validated IP while sending the real `Host` header).
- Response body streamed and capped at 64 KiB.
- Fixed-path file semantics: success requires body == `replyiq-verify:{token}` exactly (trimmed). No `<meta>` support (R7 rejected).
- Failure mapping per contract: SSRF violation → `DOMAIN_VERIFICATION_FAILED` (+ server warn log); DNS/network errors → stays `PENDING` (retryable).
- The only fetch-host override is `DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE`, hard-gated on `NODE_ENV === 'test'` (D-04: no bypass exists outside tests).

### 2.2 Stable Error Codes (R2)

New module: `apps/api/src/common/errors/error-codes.ts`

- `ErrorCode` enum: AUTH_INVALID_CREDENTIALS, AUTH_UNAUTHENTICATED, AUTH_REFRESH_INVALID, AUTH_EMAIL_TAKEN, AUTHZ_FORBIDDEN, RESOURCE_NOT_FOUND, VALIDATION_FAILED, RATE_LIMITED, DOMAIN_NOT_FOUND, DOMAIN_ALREADY_REGISTERED, DOMAIN_ALREADY_VERIFIED, DOMAIN_VERIFICATION_FAILED, DOMAIN_LAST_VERIFIED, ONBOARDING_STEP_OUT_OF_ORDER, ONBOARDING_ALREADY_COMPLETED, ONBOARDING_NO_DOMAIN, ONBOARDING_NO_VERIFIED_DOMAIN.
- `InfoCode.DOMAIN_VERIFICATION_PENDING` for success envelopes where verification is still pending.
- Typed factories `codedBadRequest/Unauthorized/Forbidden/NotFound/Conflict(code, message)` producing `{ code, message }` bodies.

`GlobalExceptionFilter` emits an optional top-level `code`; bare exceptions get stable defaults: 401→AUTH_UNAUTHENTICATED, 403→AUTHZ_FORBIDDEN, 404→RESOURCE_NOT_FOUND, 429→RATE_LIMITED (ThrottlerException included), 400/422→VALIDATION_FAILED. Unexpected errors remain fully opaque (500 generic message, no `code`, no internals).

Throw sites migrated: `auth.service.ts` (login ×2, refresh path ×7, logout ×2), `workspace-provisioning.service.ts` (AUTH_EMAIL_TAKEN), `business.service.ts` (RESOURCE_NOT_FOUND ×4).

### 2.3 RBAC Wiring (D-07, R3)

- All resource controllers (`business`, `onboarding`, `domains`) use `@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)`.
- `@Roles('OWNER', 'ADMIN')` on every mutating endpoint: business PATCH, all onboarding step PATCHes, domain create/verify/delete.
- Read endpoints available to any authenticated role. Auth endpoints untouched/public.
- Matrix documented in 12 §10 BEFORE wiring (per process rule); coverage asserted by unit test.

### 2.4 Real Tenant Guard (R4)

`organization.guard.ts` replaced: loads the target business's `organizationId` via Prisma, compares against the JWT claim, coded 403 (`AUTHZ_FORBIDDEN`) on mismatch or malformed UUID route params. Service-level `ensureAccess` checks remain as defense in depth (documented in 12 §11).

### 2.5 Verify-Endpoint Rate Limiting (R5)

- New env var `VERIFICATION_RATE_LIMIT_MAX` (default `5`) added to `configuration.ts` + zod `env.validation.ts`.
- `POST .../domains/:id/verify`: `@UseGuards(ThrottlerGuard)` + `@Throttle({ default: { limit: <env>, ttl: RATE_LIMIT_TTL(s) * 1000 } })`. Exceeding yields 429 → RATE_LIMITED via the filter's default map.

### 2.6 Domain Lifecycle (D-02, D-06) & Onboarding Activation (D-05)

`domain.service.ts`:

- create(): active-row pre-check + duck-typed P2002 catch → DOMAIN_ALREADY_REGISTERED.
- verify(): pending → 200 envelope carrying `code: DOMAIN_VERIFICATION_PENDING`; ALREADY_VERIFIED / VERIFICATION_FAILED → coded 400; unknown token → DOMAIN_NOT_FOUND.
- remove(): single `$transaction` that first takes `SELECT ... FROM businesses WHERE id = ${businessId}::uuid FOR UPDATE`, then blocks deletion when `onboardingStatus = 'COMPLETED'` AND this is a VERIFIED row AND zero other live VERIFIED rows exist → DOMAIN_LAST_VERIFIED. Archival/soft-delete of non-guarded rows unaffected.
- Progress upsert (`firstDomainVerified`) fires from verify() only — deliberately NOT from create() (an auto-flag on create was introduced during development and reverted to preserve specified behavior).

`onboarding.service.ts`: PROFILE / FIRST_DOMAIN / DOMAIN_VERIFICATION each transactional; COMPLETE runs one `$transaction` (row lock + flag check + live verified count ≥ 1 + progress.onboardingCompleted + business update `{ onboardingStatus: 'COMPLETED', status: 'ACTIVE' }`). Step-order and post-completion guards return the ONBOARDING_* codes.

Implementation note (recorded honestly): Prisma `$queryRaw` binds string params as TEXT, so uuid comparisons require explicit `${value}::uuid` casts; caught by the integration suite on first run and fixed in both services.

## 3. Database Changes (D-02, R6)

- New migration `packages/database/prisma/migrations/20260822000000_domain_partial_unique/migration.sql`:
  ```sql
  DROP INDEX IF EXISTS "business_domains_domain_key";
  CREATE UNIQUE INDEX "business_domains_domain_active_key"
    ON "business_domains"("domain")
    WHERE "deletedAt" IS NULL;
  ```
- `schema.prisma`: `@@unique([domain])` removed from `BusinessDomain`, with a comment explaining the replacement and warning against reintroducing it.
- Applied forward-only via `npx prisma migrate deploy` to BOTH `replyiq` (dev) and `replyiq_test` (integration). No resets, no destructive operations.
- Final state: `prisma validate` → valid; `migrate status` → 4 migrations found, "Database schema is up to date!".

## 4. Frontend Implementation

- `apps/web/src/api/client.ts`: `ApiError.code` surfaced; `getErrorCode()`; `getErrorMessage()` translates ONLY codes via `ERROR_CODE_COPY` (17 entries) — raw backend prose is never rendered; unknown/missing code → generic fallback; network failure and session-expiry have dedicated copy. Added `apiFetchWithMeta<T>()` returning `{ data, infoCode? }` (written to satisfy `exactOptionalPropertyTypes`).
- `api/business.ts`: verifyDomain returns `{ domain, pending }` derived from the envelope InfoCode.
- `DomainsPage.tsx`: delete-confirmation modal (with extra warning copy for VERIFIED domains), inline verification modal distinguishing "pending" results explicitly, copy buttons, responsive layout.
- `OnboardingPage.tsx`: back-navigation (clickable completed chips + Back button), state reset on step transitions, pending banner driven by the result flag rather than mutation state, CopyButtons, corrected instruction labels/copy ("HTML Verification File", publish-at-root wording).
- New shared component `components/ui/CopyButton.tsx`.

## 5. Tests (all counts are from executed runs)

Infrastructure:

- `apps/api/vitest.config.ts` (unit), `vitest.integration.config.ts` (integration, `fileParallelism: false`, 30 s timeout), `vitest.setup.ts` (forces NODE_ENV=test + DATABASE_URL → replyiq_test), `vitest.integration.global-setup.ts` (`prisma migrate deploy` + purge of any leftover `HARDEN-ORG-%` rows so runs are hermetic).
- Turbo `test` task added (`cache: false`); scripts `test`, `test:integration`, `test:watch` (api) and `test` (web).

Unit suites (55 passing):

- `ssrf-guard.test.ts` — 43 tests: IPv4/IPv6 range tables incl. mapped/6to4/doc ranges, hostname rejection cases, pinned resolution incl. mixed-record poisoning, safe-hop rules.
- `roles.guard.test.ts` — 6 tests covering the D-07 matrix behavior.
- `global-exception.filter.test.ts` — 6 tests asserting the stable-code contract incl. ThrottlerException→RATE_LIMITED and no-leak 500s.

Integration suite (`domain.lifecycle.integration.test.ts`, 9 passing, isolated DB):

- D-02: soft-deleted names re-registrable (history preserved, exactly one ACTIVE row); cross-org attempt against an ACTIVE holder rejected (global index semantics — see §7 Deviations); duplicates among active rows carry the stable code; raw-insert proof that the PARTIAL INDEX itself enforces the invariant under pre-check races while soft-deleted inserts succeed.
- D-05: COMPLETE flips status to ACTIVE + COMPLETED atomically; refusal without a live verified domain leaves the business DRAFT.
- D-06: deleting the last verified domain rejected with DOMAIN_LAST_VERIFIED; `Promise.allSettled` race of two parallel deletes ends with exactly ONE fulfilled and one DOMAIN_LAST_VERIFIED, leaving one live verified row (proves the FOR UPDATE lock serializes); normal multi-domain deletion unaffected.

Web unit (`client.test.ts`, 11 passing): translation table, fallback for unknown/missing codes, network-error copy, session-expiry copy.

Notable debugging history (kept for honesty): initial IPv6 checks missed ULA `/^f[cd]/`, padded doc-range prefix must be `20010db8`, and 6to4 embeds IPv4 at byte offset 2 (not 1) — all caught by the unit suite and fixed.

## 6. Validation Gate (actual outputs)

```
pnpm turbo run lint typecheck build test
  Tasks:    29 successful, 29 total

pnpm run test:integration   (apps/api)
  Test Files  1 passed (1)
  Tests      9 passed (9)
  → run three consecutive times, identical result (hermetic)

prisma validate  → "The schema at prisma\schema.prisma is valid"
prisma migrate status → "Database schema is up to date!" (4 migrations)
```

Environment issues encountered and resolved during gating: Prisma query-engine DLL lock held by a running dev server (killed the processes; regenerate/build then succeeded) and UTF-8 BOMs accidentally written into `apps/web/package.json` and `turbo.json` by PowerShell tooling (stripped byte-wise; they broke Vite's PostCSS config loader).

## 7. Documented Semantics & Deviations

1. **Global active-uniqueness:** D-02's index is on `domain` alone, so uniqueness is GLOBAL across organizations while a row is ACTIVE. The integration suite originally assumed cross-org duplicates would be allowed; that expectation contradicted the approved schema and was corrected — cross-org registration succeeds only once the previous holder's row is soft-deleted.
2. **No progress side-effect on domain create:** creating a domain never mutates onboarding progress; only successful verification sets `firstDomainVerified` (spec-faithful; an early auto-flag experiment was reverted).
3. **Raw-SQL casts:** uuid comparisons in `$queryRaw` require `::uuid` casts (Prisma binds strings as TEXT).
4. **Out of scope, unchanged:** CSRF (12 §7) and Audit Logging (12 §17) remain NOT IMPLEMENTED; roadmap R11 remains DEFERRED by D-03; TenantScopeInterceptor/RLS ideas remain future work noted in 12 §11.

## 8. Spec Updates Made During Implementation

- 09 §5.13 region: known-limitation note replaced with the resolved D-02 semantics + migration name.
- 12 §10 Enforcement: NOT ENFORCED → IMPLEMENTED description; §11 Critical Gap → RESOLVED description (guard behavior + defense-in-depth note).
- 03 §6.5: delete-confirmation dialog marked IMPLEMENTED with behavior detail.
- 15-ROADMAP backlog: R1–R5, R10, R12 → APPROVED - IMPLEMENTED (hardening loop 2026-08-24); mojibake artifacts on the R12 row cleaned.
- Root `.env.example` (R12) rewritten as a complete template mirroring the zod env schema; `VERIFICATION_RATE_LIMIT_MAX` added to `apps/api/.env.example`.

## 9. Remaining Gaps / Next Milestone Recommendations

1. Re-run the app end-to-end manually (dev server was intentionally stopped during DLL-lock resolution; relaunch with `pnpm dev`).
2. CI wiring: add `test:integration` with a disposable Postgres service container (the global-setup already makes it self-healing/hermetic).
3. Expired/revoked session cleanup job (08 §9.x note), CSRF + audit logging (12 §7/§17) before public beta.
4. Consider `TenantScopeInterceptor`/Postgres RLS as belt-and-braces beyond guard + service checks.
5. Optional polish: e2e smoke (Playwright) over onboarding happy path to guard the wizard UX changes.
