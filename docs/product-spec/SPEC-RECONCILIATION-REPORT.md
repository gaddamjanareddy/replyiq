# ReplyIQ — Specification Reconciliation Report

> **Status:** Final
> **Date:** 2026-08-23
> **Scope:** Reconciliation of external spec-review documents (`InstructionsToOPC/01-SPEC-REVIEW.md`, `InstructionsToOPC/02-RECOMMENDED-CORRECTIONS.md`) against the actual codebase and the authoritative specification (`00-MASTER-INDEX.md` … `15-ROADMAP.md`).
> **Constraint honored:** Documentation-only. No application source code was modified.

---

## 1. Executive Summary

This reconciliation audited **20 externally recommended changes** against direct inspection of the backend (`apps/api/src`), database schema (`packages/database/prisma/schema.prisma`), frontend (`apps/web/src`), and configuration files.

**Outcome totals:**

| Decision | Count |
|---|---|
| ACCEPT (adopted into specs as implemented or planned) | 6 |
| MODIFY (adopted with changes) | 3 |
| REJECT (recommendation did not match code reality or was wrong) | 3 |
| ALREADY IMPLEMENTED / ALREADY ACCURATE | 5 |
| IMPLEMENTATION GAP (real gap confirmed; spec/roadmap entries added) | 3 |

**Headline findings:**

1. The HTML domain-verification contradiction resolves cleanly: the code implements the **fixed-path verification-file** variant (`GET http://{domain}/replyiq-verification.html`, body must equal `replyiq-verify:{token}` exactly). The `<meta>` head-tag variant is **not implemented** and is marked [PROPOSED] pending product approval.
2. `IMPLEMENTATION-AUDIT.md` incorrectly claimed RBAC and organization-guard enforcement were "RESOLVED." Code proves both guard classes exist but are **never applied to any controller** (`OrganizationGuard.canActivate` unconditionally returns `true`). The audit has been corrected; enforcement remains a CRITICAL open gap.
3. Refresh-token lifetime is resolved by code evidence: `REFRESH_TOKEN_TTL` defaults to **30 days** in `env.validation.ts`. All "7 days" references across docs 07, 09, 13 were drift and have been corrected.
4. Newly discovered and documented: because `business_domains.domain` has a global UNIQUE constraint including soft-deleted rows, **soft-deleting a domain permanently blocks re-registration of that name** platform-wide. Requires an architecture/product decision (§8, D-02).
5. No DEV_BYPASS mechanism exists anywhere in code or configuration. Evaluation criteria documented in §8 (D-04) with recommendation **not** to implement it.

---

## 2. Scope and Methodology

**Inputs reviewed:**

- `InstructionsToOPC/01-SPEC-REVIEW.md` (external spec review)
- `InstructionsToOPC/02-RECOMMENDED-CORRECTIONS.md` (proposed literal replacements)
- All 16 authoritative documents under `docs/product-spec/`

**Code inspected (implementation baseline):**

| Layer | Files |
|---|---|
| Database truth | `packages/database/prisma/schema.prisma` |
| Domain module | `domain.service.ts`, `domain-verification.service.ts`, `domain.controller.ts`, DTOs |
| Auth module | `auth.service.ts`, `workspace-provisioning.service.ts`, `auth.controller.ts`, guards (`jwt-auth`, `roles`, `organization`) |
| Onboarding/Business | `onboarding.service.ts`, `business.service.ts`, controllers, DTOs |
| Security infra | `session.service.ts`, `token.service.ts`, `global-exception.filter.ts` |
| Config | `configuration.ts`, `env.validation.ts`, `.env.example`, root `package.json` |
| Frontend | `api/client.ts`, `pages/DomainsPage.tsx`, layout components, stores |

**Method:** For each recommendation the actual code path was read before any documentation edit. Where evidence was unambiguous, docs were corrected to match code. Where a change requires a product/architecture choice, the item is recorded in §8 instead of silently decided.

---

## 3. Classification Summary

| # | Recommendation (abridged) | Decision |
|---|---|---|
| REC-01 | Random verification token, never derived from DB ID | ALREADY IMPLEMENTED |
| REC-02 | Standardize DNS record name `_replyiq-challenge.{domain}` | ACCEPT |
| REC-03 | Resolve HTML verification dual-mechanism contradiction | MODIFY |
| REC-04 | Token stability across retries | ALREADY IMPLEMENTED |
| REC-05 | Global domain uniqueness across organizations | ALREADY IMPLEMENTED (+ side effect documented) |
| REC-06 | Domain deletion semantics (soft vs hard) | ACCEPT (soft delete) |
| REC-07 | Guard against deleting last verified domain post-completion | MODIFY (documented + flagged) |
| REC-08 | Refresh token lifetime 7d vs 30d | REJECT premise; ACCEPT correction to 30d |
| REC-09 | Register response envelope consistency | MODIFY |
| REC-10 | Stable API error codes + UI translation layer | ACCEPT ([PROPOSED] spec addition) |
| REC-11 | Replace technical user-facing verification copy | ACCEPT ([PROPOSED] target copy) |
| REC-12 | SSRF protections for outbound HTML fetch | ACCEPT ([PLANNED], production-blocking) |
| REC-13 | Rate limiting on domain verify endpoint | ACCEPT (roadmap) |
| REC-14 | Wire RolesGuard/OrganizationGuard ("already done" per audit) | IMPLEMENTATION GAP (audit claim corrected) |
| REC-15 | Role enum values MEMBER/VIEWER in doc 12 | REJECT (schema truth: OWNER/ADMIN/MANAGER) |
| REC-16 | Onboarding ordering, resume, gating errors | ALREADY IMPLEMENTED (docs verified accurate) |
| REC-17 | Business status → ACTIVE on completion | IMPLEMENTATION GAP (FR-BIZ-03 reclassified [PLANNED]) |
| REC-18 | DEV_BYPASS dev/test verification bypass | REJECT (recommendation: do not implement) |
| REC-19 | Sidebar breakpoint 768 vs 1024 | REJECT (deliberately resolved at 1024px previously) |
| REC-20 | Test coverage claims (0 tests) | ALREADY ACCURATE |

---

## 4. Detailed Reconciliation Decisions

Each entry follows: REVIEW RECOMMENDATION → ACTUAL CODE STATE → FINAL DECISION → DOCUMENTATION CHANGE → IMPLEMENTATION IMPACT.

### REC-01 — Random verification tokens

**REVIEW RECOMMENDATION:** Tokens must come from a CSPRNG at creation time and never be derived from the domain's database ID.

**ACTUAL CODE STATE:** `DomainVerificationService.generateToken()` returns `` `replyiq-verify-${crypto.randomUUID()}` `` (Node crypto UUIDv4), called once in `DomainService.create()`. Tokens are never exposed in list/get responses.

**FINAL DECISION:** ALREADY IMPLEMENTED.

**DOCUMENTATION CHANGE:** Doc 01 FR-DOM-02 states exact format and immutability; doc 07 §6.5 method table matches signatures.

**IMPLEMENTATION IMPACT:** None.

### REC-02 — DNS record name

**REVIEW RECOMMENDATION:** Unify on one DNS record name (`_replyiq-challenge` vs `_replyiq-verification` conflict).

**ACTUAL CODE STATE:** `getDnsTxtRecordName(domain)` returns `` `_replyiq-challenge.${domain}` ``; TXT value must equal the token exactly.

**FINAL DECISION:** ACCEPT — all documents standardize on `_replyiq-challenge.{domain}`.

**DOCUMENTATION CHANGE:** Docs 01, 09, 14, 15 corrected; no `_replyiq-verification` DNS references remain (verified §11).

**IMPLEMENTATION IMPACT:** None.

### REC-03 — HTML verification mechanism contradiction

**REVIEW RECOMMENDATION:** Pick ONE mechanism: fixed-path file OR `<meta>` head tag; update all documents.

**ACTUAL CODE STATE:** `verifyHtmlMeta()` fetches `http://{domain}/replyiq-verification.html` (5s AbortController timeout) and requires `body.trim() === 'replyiq-verify:{token}'`. It never parses HTML or reads meta tags. Enum value named `HTML_META` for historical reasons.

**FINAL DECISION:** MODIFY — implemented fixed-path file mechanism is authoritative everywhere; `<meta>` variant reclassified [PROPOSED], adoptable only via Decision D-01 (§8).

**DOCUMENTATION CHANGE:** Docs 01 (FR-DOM-04), 03 (labels/instructions panel), 09 (§5.11, §5.13 rewritten examples), 07 (§6.5), 14, 15 updated with explicit not-implemented/proposed notes.

**IMPLEMENTATION IMPACT:** If D-01 later approves the meta-tag variant: additive second check + UI copy. Until then none.

### REC-04 — Token stability across retries

**REVIEW RECOMMENDATION:** Never regenerate tokens on failed attempts; allow unlimited retries.

**ACTUAL CODE STATE:** `verify()` never writes `verificationToken`; FAILED → 400 unchanged token; unreachable challenge → HTTP 200 `success:true` pending message, unchanged token; re-verifying VERIFIED → 400. No retry counter, no expiry.

**FINAL DECISION:** ALREADY IMPLEMENTED.

**DOCUMENTATION CHANGE:** Doc 09 §5.11 outcome table added (200-pending / 400-failed / 400-already-verified / 200-success).

**IMPLEMENTATION IMPACT:** None.

### REC-05 — Global domain uniqueness

**REVIEW RECOMMENDATION:** Domain names unique globally across organizations to prevent cross-tenant spoofing.

**ACTUAL CODE STATE:** Schema `@@unique([domain])` on `BusinessDomain` (includes soft-deleted rows); `create()` pre-checks and throws `ConflictException("Domain already registered")`.

**FINAL DECISION:** ALREADY IMPLEMENTED — plus newly discovered side effect: soft delete + global index means a deleted name can never be re-registered by anyone (409 forever). Documented as Decision D-02 (§8).

**DOCUMENTATION CHANGE:** Doc 01 FR-DOM-01; doc 09 §5.12 known-limitation paragraph; new doc 08 §9.3.1 with three resolution options; doc 14 test matrix.

**IMPLEMENTATION IMPACT:** Resolution needs partial unique index migration, hard delete, or acceptance of permanent claiming (D-02).

### REC-06 — Domain deletion semantics

**REVIEW RECOMMENDATION:** Resolve soft-delete vs hard-delete contradiction; recommend soft delete.

**ACTUAL CODE STATE:** `remove()` sets `deletedAt = new Date()`; all reads filter `deletedAt: null`.

**FINAL DECISION:** ACCEPT — soft delete specified; hard-delete text removed.

**DOCUMENTATION CHANGE:** Doc 09 §5.12 ("soft delete", message `"Domain deleted successfully"`); doc 01 FR-DOM-09 [PLANNED]→[IMPLEMENTED]; doc 03 §6.5 annotated.

**IMPLEMENTATION IMPACT:** None in code; see D-02 for naming consequence.

### REC-07 — Deleting last verified domain post-completion

**REVIEW RECOMMENDATION:** Prevent deleting the only verified domain after onboarding completion.

**ACTUAL CODE STATE:** No such guard exists; a COMPLETED business can delete its only verified domain with no status change.

**FINAL DECISION:** MODIFY — current behavior documented truthfully; flagged as product decision (grouped with D-02/D-08 backlog).

**DOCUMENTATION CHANGE:** Report §7 gap entry; roadmap R6 grouping.

**IMPLEMENTATION IMPACT:** If approved: pre-delete check in `DomainService.remove()` (409/422 when last active VERIFIED domain of COMPLETED business).

### REC-08 — Refresh token lifetime

**REVIEW RECOMMENDATION:** Resolve 7d vs 30d disagreement authoritatively.

**ACTUAL CODE STATE:** `env.validation.ts`: `REFRESH_TOKEN_TTL` default `'30d'` (Zod-enforced); `configuration.ts` fallback `'30d'`. Rotation replaces the argon2 hash on the existing Session row — no revoke-and-recreate.

**FINAL DECISION:** REJECT the 7-day premise; ACCEPT correcting residual "7 days" drift to 30 days.

**DOCUMENTATION CHANGE:** Doc 09 refresh lifetime paragraph rewritten (also clarifies rotation = hash replacement, row retained); doc 07 two occurrences; doc 13 env table (`REFRESH_TOKEN_TTL` 7d→30d; also `RATE_LIMIT_MAX` default 100→10; noted root `.env.example` documents only DATABASE_URL today).

**IMPLEMENTATION IMPACT:** None.

### REC-09 — Register response envelope

**REVIEW RECOMMENDATION:** Return the standard `{ success, message, data }` envelope from register.

**ACTUAL CODE STATE:** Register returns flat `{ session: { accessToken, refreshToken, expiresIn }, user, business, organization }` (201). Login/refresh/me use the standard envelope. Web `RegisterPage` consumes the flat shape.

**FINAL DECISION:** MODIFY — flat shape documented as current contract with explicit note that unification is [PROPOSED]/breaking (D-03).

**DOCUMENTATION CHANGE:** Note in doc 09 §5.2; doc 06 §12 auth-pages note; roadmap R11.

**IMPLEMENTATION IMPACT:** If approved: coordinated service + web parsing change.

### REC-10 — Stable machine-readable error codes

**REVIEW RECOMMENDATION:** Add stable error-code registry so clients translate errors without parsing prose.

**ACTUAL CODE STATE:** `GlobalExceptionFilter` emits `{ statusCode, message, timestamp }` only; no `code` field anywhere.

**FINAL DECISION:** ACCEPT as [PROPOSED] spec addition (backend work required; documentation-first this phase).

**DOCUMENTATION CHANGE:** Doc 09 §5.11 known-gap note; doc 03 §6.3 proposed translation layer (blocked on backend registry); doc 06 §12 same; roadmap R2.

**IMPLEMENTATION IMPACT:** Backend: add `code` to filter payloads + per-site codes; frontend: mapping module. P1.

### REC-11 — User-facing verification copy

**REVIEW RECOMMENDATION:** Stop surfacing jargon like "challenge record" to users; define friendly copy.

**ACTUAL CODE STATE:** API strings verbatim: `"Verification pending — challenge record not yet reachable. Retry shortly."`, `"Verification failed. Ensure the challenge record is published correctly."` Frontend renders these as-is via `getErrorMessage()`.

**FINAL DECISION:** ACCEPT into docs as [PROPOSED] target copy; current strings documented as actual behavior.

**DOCUMENTATION CHANGE:** Doc 03 pending banners now quote the actual API strings and carry [PROPOSED] friendly copy ("We couldn't see your verification file yet. Double-check it's published at the address shown above, then try again in a few minutes.") gated on REC-10.

**IMPLEMENTATION IMPACT:** Copy change lands naturally with the error-code work; standalone copy-only patch possible but would diverge from API messages.

### REC-12 — SSRF protections for outbound HTML fetch

**REVIEW RECOMMENDATION:** The verifier fetches user-influenced URLs server-side; require private/loopback/link-local IP blocking, redirect control, response-size limits, timeout, rate limiting.

**ACTUAL CODE STATE:** `verifyHtmlMeta()` has only the 5-second AbortController timeout. No IP-range validation, no redirect cap, no size limit, no per-endpoint throttle. URL scheme is fixed `http` (constructed server-side).

**FINAL DECISION:** ACCEPT as [PLANNED], **required before any production deployment**.

**DOCUMENTATION CHANGE:** Doc 12 §13 new subsection "Outbound Verification Fetches (SSRF Hardening)" with six-control status table; doc 07 §6.5 security note; doc 12 Appendix C debt row; roadmap R1.

**IMPLEMENTATION IMPACT:** Backend-only hardening in `DomainVerificationService` + throttler wiring. P0 within Milestone 8 production gate.

### REC-13 — Rate limiting on domain verify

**REVIEW RECOMMENDATION:** Rate-limit verification attempts per organization/domain to prevent abuse of outbound fetches.

**ACTUAL CODE STATE:** `ThrottlerGuard` applied only on register/login/refresh (10 req/60s/IP, env-configurable). Domain endpoints unthrottled.

**FINAL DECISION:** ACCEPT (roadmap R5); current coverage documented accurately in doc 09 §3.

**DOCUMENTATION CHANGE:** None beyond accuracy already present; backlog entry added.

**IMPLEMENTATION IMPACT:** Per-route throttler config or Redis-backed limiter (existing M8 item).

### REC-14 — RBAC / organization guard enforcement

**REVIEW RECOMMENDATION:** Docs should reflect reality of guard enforcement (audit claimed completion).

**ACTUAL CODE STATE:** `RolesGuard` (reflector-based) and `OrganizationGuard` exist under `apps/api/src/modules/auth/guards/`, but **no controller applies them** (`@UseGuards(RolesGuard|OrganizationGuard)` appears nowhere) and **no endpoint uses `@Roles()`**. `OrganizationGuard.canActivate` ends with unconditional `return true`. Effective model: `JwtAuthGuard` + service-level `ensureAccess` returning 404 cross-org. Role enum: OWNER/ADMIN/MANAGER.

**FINAL DECISION:** IMPLEMENTATION GAP — audit's "RESOLVED/FIXED" claims were wrong and have been corrected everywhere.

**DOCUMENTATION CHANGE:** `IMPLEMENTATION-AUDIT.md` summary/issues #2–#3/blockers/verdict corrected; doc 12 §10 roles fixed to schema values + guard notes; §11 stub note; doc 07 new §8.3.

**IMPLEMENTATION IMPACT:** Wiring = global pipeline/controllers + matrix remap to three real roles (roadmap R3/R4). P1.

### REC-15 — Role enum values

**REVIEW RECOMMENDATION:** Doc 12 listed MEMBER/VIEWER roles with a four-column permission matrix.

**ACTUAL CODE STATE:** Schema `UserRole` = OWNER | ADMIN | MANAGER only.

**FINAL DECISION:** REJECT MEMBER/VIEWER as nonexistent; matrix kept but annotated for remapping before wiring.

**DOCUMENTATION CHANGE:** Doc 12 §10 roles list replaced with schema truth + reconciliation note.

**IMPLEMENTATION IMPACT:** None until RBAC wiring (R3), then matrix redesign or enum extension decision (D-07).

### REC-16 — Onboarding sequencing/resume/errors

**REVIEW RECOMMENDATION:** Verify server-enforced ordering, resume support, consistent gating errors.

**ACTUAL CODE STATE:** `OnboardingService.updateStep` enforces PROFILE → FIRST_DOMAIN → DOMAIN_VERIFICATION → COMPLETE with exact errors `"Complete profile step first"`, `"Add a domain first"`, `"Verify a domain first"`; DOMAIN_VERIFICATION requires an actual VERIFIED non-deleted domain; COMPLETE requires `firstDomainVerified`; COMPLETED terminal (`400 "Onboarding is already completed"`). Transitions NOT_STARTED→IN_PROGRESS→DOMAIN_PENDING→COMPLETED match doc 02. Resume via GET progress `steps[]`.

**FINAL DECISION:** ALREADY IMPLEMENTED — docs verified accurate.

**IMPLEMENTATION IMPACT:** None. (Nuance recorded here only: `firstDomainAdded` is set by the explicit FIRST_DOMAIN onboarding call, not automatically on domain creation.)

### REC-17 — Business ACTIVE transition

**REVIEW RECOMMENDATION:** Docs claim business becomes ACTIVE when onboarding completes.

**ACTUAL CODE STATE:** COMPLETE step sets only `onboardingStatus = COMPLETED`; `business.status` stays DRAFT forever (no write path to ACTIVE). Seed data sets ACTIVE directly.

**FINAL DECISION:** IMPLEMENTATION GAP — requirement kept (P0) but reclassified [PLANNED]; trigger needs approval (D-05).

**DOCUMENTATION CHANGE:** Doc 01 FR-BIZ-03 annotated + [PLANNED]; doc 08 §10.2 corrected; doc 09 examples changed `"status": "ACTIVE"` → `"DRAFT"`.

**IMPLEMENTATION IMPACT:** One-line write in COMPLETE step once approved.

### REC-18 — DEV_BYPASS evaluation

**REVIEW RECOMMENDATION:** Evaluate a fail-closed dev/test-only verification bypass (non-prod only, never request-controlled, never bypasses tenant auth, prod-safety test).

**ACTUAL CODE STATE:** No bypass exists anywhere (code/env/config grep). Verification always hits real DNS/HTTP.

**FINAL DECISION:** REJECT — recommendation is **not** to implement. E2E/staging can use a dedicated real subdomain; a bypass adds permanent prod-risk surface for marginal test convenience.

**Approval-gated criteria if revisited:** env-only bootstrap config; hard-disabled unless `NODE_ENV !== 'production'` AND explicit opt-in; startup crash if enabled in prod; never per-request; bypassed path still requires full JWT + tenant checks; dedicated test asserting prod startup failure.

**DOCUMENTATION CHANGE:** None in specs (no feature spec authored for a rejected feature); decision preserved here and as roadmap R9.

**IMPLEMENTATION IMPACT:** None.

### REC-19 — Sidebar breakpoint

**REVIEW RECOMMENDATION:** Reconcile 768px vs 1024px claims.

**ACTUAL CODE STATE:** `lg:hidden` overlay/hamburger, `lg:ml-64` shift, `window.innerWidth >= 1024` default-open — consistently 1024px; prior audit settled this deliberately.

**FINAL DECISION:** REJECT further change; docs 03/06 already state 1024px consistently.

**IMPLEMENTATION IMPACT:** None.

### REC-20 — Test coverage

**REVIEW RECOMMENDATION:** Confirm "0 tests" claims and planned stack accuracy.

**ACTUAL CODE STATE:** No test scripts or suites found in repo inspection; doc 14 states 0 tests with Vitest/supertest/Playwright planned.

**FINAL DECISION:** ALREADY ACCURATE.

**DOCUMENTATION CHANGE:** Only domain-verification scenario rows updated (REC-02/05 specifics).

**IMPLEMENTATION IMPACT:** Test implementation remains planned milestone work.

---

## 5. Documentation Changes Applied (by file)

| File | Changes |
|---|---|
| `00-MASTER-INDEX.md` | Inventory note (report = supporting artifact; authoritative set unchanged); report row added |
| `01-PRODUCT-REQUIREMENTS.md` | M4 table DNS/HTML wording; FR-BIZ-03 [PLANNED]+annotation; FR-DOM-01…09 rewritten |
| `02-PRODUCT-FLOWS.md` | Verified accurate; no edits required |
| `03-UI-UX-SPECIFICATION.md` | Method label + note; pending banners quote API strings + proposed copy ×2; §6.3 passthrough note + proposed layer; §6.5 annotations |
| `06-FRONTEND-ARCHITECTURE.md` | §12 rewritten (verbatim passthrough, flat register shape, single-flight refresh, proposed layer) |
| `07-BACKEND-ARCHITECTURE.md` | §6.4–6.6 real signatures/behavior + SSRF note; §8.3 created-NOT-wired; TTL 7d→30d ×2 |
| `08-DATABASE-SPECIFICATION.md` | Session rules corrected; §9.3.1 unique-vs-soft-delete options; §10.2 Business transition corrected |
| `09-API-SPECIFICATION.md` | §5.2 envelope note; §5.11 outcome table + jargon gap; §5.12 soft delete + limitation; §5.13 corrected payloads; refresh paragraph; example statuses DRAFT |
| `12-SECURITY-MULTI-TENANCY.md` | Logout wording ×2; §10 schema-truth roles + unwired guards; §11 stub note; §13 SSRF controls; Appendix C updated |
| `13-INFRASTRUCTURE-DEVOPS.md` | Env defaults corrected (30d; RATE_LIMIT_MAX 10) + template-gap note |
| `14-QA-ACCEPTANCE-DOD.md` | Verification scenarios updated; M4 checklist wording |
| `15-ROADMAP.md` | M4 corrections; new Reconciliation Backlog R1–R12 |
| `IMPLEMENTATION-AUDIT.md` | False RESOLVED/FIXED claims corrected throughout |

---

## 6. Contradictions Resolved

| Contradiction | Resolution |
|---|---|
| HTML verification: file vs `<meta>` tag | File at `/replyiq-verification.html`, body == `replyiq-verify:{token}`; meta variant [PROPOSED] |
| Soft vs hard delete of domains | Soft delete; naming side effect documented |
| Refresh token 7d vs 30d | 30d default via `REFRESH_TOKEN_TTL` |
| Logout deletes vs revokes session | Sets `revokedAt`; row retained |
| Rotation recreates vs updates session | Updates hash in place |
| Roles MEMBER/VIEWER vs MANAGER | Schema truth: OWNER/ADMIN/MANAGER |
| Guards "resolved" vs absent wiring | Not wired; audit corrected |
| Business ACTIVE on completion | Never happens in code; requirement [PLANNED] |
| DNS `_replyiq-challenge` vs `_replyiq-verification` | `_replyiq-challenge.{domain}` everywhere |
| Breakpoint 768 vs 1024 | 1024px (deliberate, previously settled) |

---

## 7. Implementation Gaps Confirmed

1. RBAC enforcement — RolesGuard/@Roles unused (CRITICAL)
2. Tenant-isolation middleware — OrganizationGuard stub; service-layer checks sole mechanism (CRITICAL)
3. SSRF hardening on HTML_META fetch (HIGH; production-blocking)
4. Error-code registry + UI translation layer
5. Rate-limiting coverage — auth-only; verify endpoint exposed
6. Business activation trigger after onboarding (status stuck DRAFT)
7. Domain delete confirmation dialog (frontend)
8. Soft-deleted name re-registration block (needs strategy)
9. Session cleanup jobs, audit logging (pre-existing documented gaps)

---

## 8. Decisions Requiring Approval (not guessed)

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D-01 | Adopt `<meta>` head-tag verification as additional method? | Add alongside file check / reject | Reject for MVP; file mechanism suffices |
| D-02 | Soft-deleted domains permanently claim names | Partial unique index / hard delete / keep documented | Partial index `WHERE deletedAt IS NULL` |
| D-03 | Unify register envelope with standard wrapper | Breaking change + web update / keep flat | Keep flat until next breaking window |
| D-04 | DEV_BYPASS dev/test verification | Implement fail-closed / do not implement | Do not implement; use real staging subdomain |
| D-05 | Business activation trigger post-onboarding | Set ACTIVE in COMPLETE step / later admin action | Set ACTIVE in COMPLETE step |
| D-06 | Deleting last verified domain of COMPLETED business | Block with error / allow + document | Block with clear error |
| D-07 | Permission matrix reduction to 3 roles (pre-RBAC wiring) | Map MANAGER to old MEMBER column / redesign | Redesign 3-role matrix during R3 |

---

## 9. Implementation Status Labels (post-reconciliation truth)

| Area | Label |
|---|---|
| Auth lifecycle (register/login/refresh/logout/me), rotation, revocation | [IMPLEMENTED] |
| Domain CRUD + DNS/file verification + instructions + soft delete | [IMPLEMENTED] |
| Onboarding wizard + enforced sequencing + resume | [IMPLEMENTED] |
| Global domain uniqueness | [IMPLEMENTED] (side effect documented) |
| RBAC enforcement | [PARTIALLY IMPLEMENTED] (classes exist, unwired) |
| Tenant-isolation middleware | [PARTIALLY IMPLEMENTED] (stub only) |
| Error codes / translation layer | [PROPOSED] |
| Friendly verification copy | [PROPOSED] |
| `<meta>` verification variant | [PROPOSED] |
| SSRF hardening | [PLANNED] (production gate) |
| Verify-endpoint rate limiting | [PLANNED] |
| Business ACTIVE transition | [PLANNED] |
| Delete confirmation dialog | [PROPOSED] |
| Team/knowledge/AI/widget milestones | [PLANNED] |

---

## 10. Cross-Document Consistency Validation

Checks run against all documents after edits:

| Check | Result |
|---|---|
| No residual `_replyiq-verification` DNS references | PASS |
| No residual 7-day refresh references (docs 07/09/13) | PASS |
| No residual "hard delete" wording for domains (doc 09) | PASS |
| Meta-tag mentions limited to PROPOSED/not-implemented context | PASS |
| Status labels restricted to canonical four tags | PASS |
| Authoritative structure intact (numbered 00–15 unchanged; report is indexed supporting artifact only) | PASS |
| Cross-file pointers to SPEC-RECONCILIATION-REPORT.md resolve to this document | PASS |
| Code-referenced constants match repo (REFRESH_TOKEN_TTL 30d, RATE_LIMIT_MAX 10, bodyLimit 100KB, lg=1024px) | PASS |

*(Results re-verified mechanically after all edits; see final validation pass in the delivery summary.)*

---

## 11. Recommended Implementation Order

1. R1 — SSRF hardening (security, production-blocking)
2. R3/R4 — Wire RBAC + replace OrganizationGuard stub (with D-07 matrix redesign)
3. R2 — Error-code registry + UI translation layer (friendly copy lands with it)
4. R5 — Verify-endpoint rate limits
5. Decision batch D-02/D-05/D-06 → implement resulting one-liners/migrations
6. R6 — Unique-constraint strategy migration (after D-02)
7. R10 — Delete confirmation dialog
8. R11/R12 — Envelope unification + env template cleanup (next breaking window)
9. Resume milestone sequence (M4B team management) per 15-ROADMAP.md

---

## 12. Evidence Index

Key facts relied upon (all read directly during reconciliation): `domain-verification.service.ts` (token format, record name, fetch mechanics, timeout), `domain.service.ts` (uniqueness check, outcome branches, soft delete, ensureAccess), `onboarding.service.ts` (gating/errors/transitions), `workspace-provisioning.service.ts`/`auth.service.ts` (envelopes, rotation, revocation, TTLs), guards + controller greps (unwired status), `global-exception.filter.ts` (error shape), `configuration.ts`/`env.validation.ts` (defaults), `schema.prisma` (enums, constraints, revokedAt), `apps/web/src/api/client.ts` (passthrough, refresh), layout components (breakpoints), root `package.json`/`.env.example` (tests absent; env template state).

*End of report.*
