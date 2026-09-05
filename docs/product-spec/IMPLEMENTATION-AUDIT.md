# ReplyIQ Implementation Audit

> **Status:** Draft
> **Date:** 2026-08-18
> **Scope:** Full implementation-vs-specification audit
> **Specification Version:** 1.0 (docs/product-spec/)
> **Codebase:** apps/api, apps/web, packages/database, packages/types, packages/ui, packages/utils

---

## 1. Executive Summary

ReplyIQ has completed Milestones 1-3 (Infrastructure, Database, Authentication) and approximately 75% of Milestone 4 (Business Onboarding Phase 4A). The codebase contains 47 backend files (~3,500 LOC), 23 frontend files (~1,945 LOC), 6 Prisma models, 7 enums, 3 migrations, and 15 implemented API endpoints.

The specification describes an 8-milestone product requiring ~230 planned features. Currently, approximately 55 features are implemented, 8 are partially implemented, and ~167 are planned (Milestones 5-8).

**Critical findings (2026-08-19 hardening, corrected 2026-08 reconciliation):** RolesGuard and OrganizationGuard classes were **created but are NOT wired into any controller** (`@UseGuards(RolesGuard)` / `@Roles()` appear nowhere; OrganizationGuard's `canActivate` always returns `true`), so RBAC and guard-based tenant isolation remain **unenforced** — service-level checks are still the only isolation mechanism. Confirmed resolved: session IP/userAgent metadata captured on login/register, cross-tenant access returns 404 (not 403), ErrorBoundary added, mobile sidebar content shift fixed, request body size limit added (Fastify `bodyLimit` 100 KB). **Remaining:** localStorage token storage (CRITICAL, architectural decision deferred), 0 test coverage (HIGH). See SPEC-RECONCILIATION-REPORT.md for the full per-recommendation audit.

---

## 2. Current Product State

| Dimension | Status |
|-----------|--------|
| Backend API | 15 endpoints implemented and functional |
| Frontend SPA | 6 pages, 5 UI components, 2 stores, 9 hooks |
| Database | 6 models, 7 enums, 3 migrations, seed data |
| Authentication | Full lifecycle: register, login, refresh, logout, /me |
| Onboarding | Business profile, domain management, verification, wizard, dashboard |
| Testing | 0 test files, no framework configured |
| CI/CD | Lint + typecheck + build jobs (no test job) |
| Documentation | 16-document specification (Draft status) |
| Deployment | Local dev only (Docker Compose PostgreSQL) |

---

## 3. Implemented Features

### 3.1 Milestone 1: Infrastructure [100% COMPLETE]

| Feature | Spec Ref | Status |
|---------|----------|--------|
| Turborepo monorepo | 01/M1 | IMPLEMENTED |
| NestJS 11 + Fastify 5 | 01/M1 | IMPLEMENTED |
| Prisma 6.6 + PostgreSQL 17 | 01/M1 | IMPLEMENTED |
| Docker Compose (PostgreSQL) | 01/M1 | IMPLEMENTED |
| Zod env validation | 01/M1 | IMPLEMENTED |
| Pino structured logging | 01/M1 | IMPLEMENTED |
| Helmet, CORS, compression | 01/M1 | IMPLEMENTED |
| Rate limiting (ThrottlerGuard) | 01/M1 | IMPLEMENTED |
| Global exception filter | 01/M1 | IMPLEMENTED |
| Health check endpoint | 01/M1 | IMPLEMENTED |
| Shared config package | 01/M1 | IMPLEMENTED |

### 3.2 Milestone 2: Database [100% COMPLETE]

| Feature | Spec Ref | Status |
|---------|----------|--------|
| Organization model | 08/2.1 | IMPLEMENTED |
| User model | 08/2.2 | IMPLEMENTED |
| Business model | 08/2.3 | IMPLEMENTED |
| BusinessDomain model | 08/2.4 | IMPLEMENTED |
| Session model | 08/2.5 | IMPLEMENTED |
| OnboardingProgress model | 08/2.6 | IMPLEMENTED |
| 7 enums | 08/2 | IMPLEMENTED |
| 14 indexes | 08/3 | IMPLEMENTED |
| 3 migrations | 08/4 | IMPLEMENTED |
| Seed script | 08/5 | IMPLEMENTED |

### 3.3 Milestone 3: Authentication [95% COMPLETE]

| Feature | Spec Ref | Status |
|---------|----------|--------|
| Workspace registration | 01/FR-AUTH-01 | IMPLEMENTED |
| Email/password login | 01/FR-AUTH-02 | IMPLEMENTED |
| Dual JWT (access 15m / refresh 30d) | 01/FR-AUTH-03 | IMPLEMENTED |
| Refresh token rotation | 01/FR-AUTH-04 | IMPLEMENTED |
| Logout/session revocation | 01/FR-AUTH-05 | IMPLEMENTED |
| GET /auth/me | 01/FR-AUTH-06 | IMPLEMENTED |
| Argon2 password hashing | 01/FR-AUTH-07 | IMPLEMENTED |
| Login rate limiting | 01/FR-AUTH-08 | IMPLEMENTED |
| Generic error messages | 01/FR-AUTH-09 | IMPLEMENTED |
| Password change | 01/FR-AUTH-10 | PLANNED |
| Password reset | 01/FR-AUTH-11 | PLANNED |
| Email verification | 01/FR-AUTH-12 | PLANNED |

### 3.4 Milestone 4: Business Onboarding [75% COMPLETE]

| Feature | Spec Ref | Status |
|---------|----------|--------|
| Business profile CRUD | 01/FR-BIZ-01 | IMPLEMENTED |
| Business name/industry/description/website | 01/FR-BIZ-02 | IMPLEMENTED |
| Domain management (add/list/remove) | 01/FR-DOM-01 through FR-DOM-05 | IMPLEMENTED |
| Domain verification (DNS TXT) | 01/FR-DOM-06 | IMPLEMENTED |
| Domain verification (HTML meta) | 01/FR-DOM-07 | IMPLEMENTED |
| Verification instructions | 01/FR-DOM-08 | IMPLEMENTED |
| Onboarding progress tracking | 01/FR-ONB-01 | IMPLEMENTED |
| Onboarding wizard UI (4-step) | 01/FR-ONB-02 | IMPLEMENTED |
| Dashboard page | 01/FR-ONB-03 | IMPLEMENTED |
| Business settings page | 01/FR-ONB-04 | IMPLEMENTED |
| Domains page | 01/FR-ONB-05 | IMPLEMENTED |
| Team member invitations | 01/FR-TAM-01 | PLANNED |
| Invitation accept/decline | 01/FR-TAM-02 | PLANNED |
| Team page UI | 01/FR-TAM-03 | PLANNED |
| Business logo upload | 01/FR-BIZ-05 | PLANNED |
| Zod form validation (client-side) | 01 | PLANNED |
| Integration tests | 01 | PLANNED |

---

## 4. Partially Implemented Features

| Feature | What Exists | What Is Missing |
|---------|-------------|-----------------|
| Sidebar responsive behavior | Desktop always open, mobile toggle works | Mobile content shift bug (ml-64 applied at all widths) |
| Token refresh in API client | Singleton refresh dedup, retry on 401 | Login/Register bypass apiFetch (use raw fetch) |
| Soft delete | deletedAt column on 4 models | No Prisma middleware to auto-filter deletedAt |
| Session tracking | ipAddress/userAgent fields exist in schema | Never populated by createSession callers |
| Domain ownership | Tenant isolation checked in services | No OrganizationGuard middleware (spec 12/Section 5) |
| Rate limiting | ThrottlerGuard on 3 auth endpoints | Only 3 of 15 endpoints rate-limited (spec requires all) |
| Error handling | GlobalExceptionFilter catches all | No React Error Boundary in frontend |
| Form validation | HTML5 required + regex for domain | No Zod client-side validation (spec 01 requires it) |

---

## 5. Missing Features

### 5.1 Security (Critical Gaps from Spec 12)

| Feature | Spec Ref | Severity |
|---------|----------|----------|
| httpOnly cookie token storage | 12/3.1 | CRITICAL |
| RBAC enforcement (RolesGuard) | 12/Section 4 | CRITICAL |
| Organization guard middleware | 12/Section 5 | CRITICAL |
| CSRF protection | 12/Section 6 | HIGH |
| Account lockout | 12/Section 7 | HIGH |
| Audit logging | 12/Section 12 | HIGH |
| Session IP/userAgent binding | 12/Section 8 | MEDIUM |
| Session cleanup (expired) | 12/Section 8 | MEDIUM |
| Request body size limits | 12/Section 10 | LOW |
| Production argon2 tuning | 12/Section 2 | LOW |

### 5.2 Testing (Spec 14)

| Feature | Status |
|---------|--------|
| Vitest configuration | NOT STARTED |
| Unit tests | NOT STARTED |
| Integration tests | NOT STARTED |
| E2E tests (Playwright) | NOT STARTED |
| API tests (supertest) | NOT STARTED |
| Coverage tooling (c8) | NOT STARTED |
| CI test job | NOT STARTED |

### 5.3 Infrastructure (Spec 13)

| Feature | Status |
|---------|--------|
| API multi-stage Dockerfile | PLANNED |
| Web multi-stage Dockerfile | PLANNED |
| CI/CD pipeline (full) | PLANNED (lint/typecheck/build exist) |
| Swagger/OpenAPI docs | PLANNED |
| Sentry error tracking | PLANNED |
| Monitoring/alerting | PLANNED |
| Database connection pooling | PLANNED |
| Load testing | PLANNED |
| Domain + SSL | PLANNED |
| Backup strategy | PLANNED |

### 5.4 Planned Milestones (Not Started)

| Milestone | Features | Effort |
|-----------|----------|--------|
| M4B: Team Management | 6 features (invitations, roles, team UI) | 2-3 weeks |
| M5: Knowledge Engine | 15 features (upload, parsing, chunking, embedding, search) | 4-6 weeks |
| M6: AI Receptionist | 13 features (LLM, conversations, leads, handoff) | 4-6 weeks |
| M7: Widget | 13 features (chat UI, embed, real-time, customization) | 4-6 weeks |
| M8: Production | 14 features (Docker, CI/CD, monitoring, security audit) | 3-4 weeks |

---

## 6. Specification vs Code Matrix

| Area | Specification | Implementation | Status | Evidence | Gap |
|------|---------------|----------------|--------|----------|-----|
| **Auth - Registration** | POST /auth/register, workspace provisioning | Atomic transaction (Org+Business+User+Session) | IMPLEMENTED | workspace-provisioning.service.ts | None |
| **Auth - Login** | POST /auth/login, dual JWT, session creation | argon2 verify, session create, access+refresh | IMPLEMENTED | auth.service.ts:login | None |
| **Auth - Refresh** | POST /auth/refresh, single-use rotation | Hash verify, rotate, update lastUsedAt | IMPLEMENTED | auth.service.ts:refresh | None |
| **Auth - Logout** | POST /auth/logout, session revocation | Set revokedAt on session | IMPLEMENTED | auth.service.ts:logout | None |
| **Auth - /me** | GET /auth/me, current user | Find user by JWT sub | IMPLEMENTED | auth.service.ts:getCurrentUser | None |
| **Business - Get** | GET /businesses/:id, tenant-scoped | organizationId check, ForbiddenException | IMPLEMENTED | business.service.ts | None |
| **Business - Update** | PATCH /businesses/:id, tenant-scoped | Conditional spread update | IMPLEMENTED | business.service.ts | None |
| **Domain - List** | GET /businesses/:id/domains | tenant-scoped, soft-delete filter | IMPLEMENTED | domain.service.ts | None |
| **Domain - Add** | POST /businesses/:id/domains, regex validated | Domain regex, uniqueness, token generation | IMPLEMENTED | domain.service.ts | None |
| **Domain - Verify** | POST /businesses/:id/domains/:id/verify | DNS TXT + HTML meta verification | IMPLEMENTED | domain-verification.service.ts | None |
| **Domain - Delete** | DELETE /businesses/:id/domains/:id | Soft delete (set deletedAt) | IMPLEMENTED | domain.service.ts | None |
| **Domain - Instructions** | GET /businesses/:id/domains/:id/verification-instructions | Returns DNS/HTML instructions | IMPLEMENTED | domain.service.ts | None |
| **Onboarding - Get** | GET /businesses/:id/onboarding | Returns progress + steps array | IMPLEMENTED | onboarding.service.ts | None |
| **Onboarding - Update** | PATCH /businesses/:id/onboarding/steps | State machine with prerequisites | IMPLEMENTED | onboarding.service.ts | None |
| **Health** | GET /health, unauthenticated | Returns status/service/version | IMPLEMENTED | health.controller.ts | None |
| **DTO Validation** | class-validator decorators, whitelist | Global ValidationPipe + DTOs | IMPLEMENTED | All DTOs | None |
| **Password Complexity** | 12+ chars, upper/lower/digit/special | Regex in RegisterWorkspaceDto | IMPLEMENTED | register-workspace.dto.ts | None |
| **Rate Limiting** | 10 req/60s on auth endpoints | ThrottlerGuard on 3 auth endpoints | PARTIAL | auth.controller.ts | 12 of 15 endpoints unprotected |
| **RBAC** | RolesGuard + @Roles() | Not implemented | MISSING | -- | No roles enforcement |
| **Organization Guard** | OrganizationGuard middleware | Not implemented | MISSING | -- | Tenant check only in services |
| **Client Validation** | Zod schemas for forms | HTML5 + manual regex | PARTIAL | OnboardingPage.tsx, DomainsPage.tsx | No Zod on client |
| **Token Storage** | httpOnly cookies | localStorage | PARTIAL | auth.store.ts | Spec requires httpOnly cookies |
| **Error Boundary** | React Error Boundary | Not implemented | MISSING | -- | No boundary component |
| **Responsive** | Sidebar 768px+ visible | Hardcoded 1024px in 3 places | PARTIAL | AppLayout.tsx, ui.store.ts | Breakpoint mismatch with spec |
| **Modal Focus Trap** | Focus trap in Modal | Not implemented | MISSING | Modal.tsx | Focus can escape overlay |
| **Loading States** | Skeleton loaders | Implemented on Dashboard/Settings/Onboarding | IMPLEMENTED | Multiple pages | None |
| **Empty States** | Empty state components | Inline text ("No domains added yet") | PARTIAL | DomainsPage.tsx | No formal EmptyState component |
| **Tests** | Vitest + Playwright + supertest | 0 test files | MISSING | -- | Complete gap |
| **Seed Data** | Deterministic UUIDs, upsert | Implemented in seed.ts | IMPLEMENTED | seed.ts | None |

---

## 7. Broken / Incorrect Functionality

| # | Issue | Severity | Location | Evidence |
|---|-------|----------|----------|----------|
| 1 | **Mobile sidebar content shift** -- When sidebar is toggled on mobile, `ml-64` is applied at all widths (`lg:ml-64 ml-64`), pushing content off-screen | HIGH | AppLayout.tsx | Class `lg:ml-64 ml-64` should be `lg:ml-64` only |
| 2 | **Login/Register bypass apiFetch** -- Both pages use raw `fetch()` instead of `apiFetch()`, duplicating auth header logic and missing 401 refresh handling | MEDIUM | LoginPage.tsx, RegisterPage.tsx | Direct fetch calls instead of apiFetch |
| 3 | **ProtectedRoute redirect state unused** -- `ProtectedRoute` sets `location.state.from` but `LoginPage` never reads it; users always land on /dashboard after login | LOW | LoginPage.tsx, ProtectedRoute.tsx | No `state.from` consumption |
| 4 | **Delete button loading state shared** -- All delete buttons show loading state from a single mutation, not per-domain | LOW | DomainsPage.tsx | Single `isDeleting` state for all domains |
| 5 | **Modal.tsx unused** -- Modal component exists but DomainsPage implements its own inline VerifyModal | LOW | Modal.tsx, DomainsPage.tsx | Duplicate modal implementation |
| 6 | **Duplicate normalizeDomain()** -- Identical function in OnboardingPage.tsx:19 and DomainsPage.tsx:9 | LOW | Both pages | Should be extracted to shared utility |
| 7 | **Breakpoint constant duplicated** -- 1024px hardcoded in AppLayout.tsx, ui.store.ts, Sidebar.tsx | LOW | 3 files | Should be a shared constant |
| 8 | **verifyDomainMutation.isSuccess persists** -- State not reset after modal close/reopen | LOW | DomainsPage.tsx | No mutation reset on modal close |

---

## 8. UI/UX Issues

| # | Issue | Severity | Spec Ref | Location |
|---|-------|----------|----------|----------|
| 1 | **Mobile sidebar content shifts off-screen** -- ml-64 applied at all breakpoints when sidebar is open on mobile | HIGH | 03/Section 4 | AppLayout.tsx |
| 2 | **No error boundary** -- React crashes propagate to white screen | HIGH | 03/Section 6 | No ErrorBoundary component |
| 3 | **Modal has no focus trap** -- Keyboard focus can escape modal overlay | MEDIUM | 04/Modal spec | Modal.tsx |
| 4 | **No prefers-reduced-motion** -- No respect for user motion preferences | MEDIUM | 04/Accessibility | index.css |
| 5 | **No dark mode** -- No dark: classes, no theme configuration | LOW | 03 | No theme support |
| 6 | **No toast notifications** -- Design system specifies toasts (z-index 60) but none implemented | MEDIUM | 04/Section 7 | No Toast component |
| 7 | **No confirmation dialog for domain deletion** -- Destructive action without confirmation | MEDIUM | 04/Confirmation pattern | DomainsPage.tsx |
| 8 | **No empty state component** -- Inline text instead of structured empty states | LOW | 04/Empty State spec | No EmptyState component |
| 9 | **No Skeleton for DomainsPage add form** -- Only list items have skeletons | LOW | 03/Loading states | DomainsPage.tsx |
| 10 | **index.html missing meta tags** -- No favicon, no description, no OG tags | LOW | -- | index.html |

---

## 9. Responsive Issues

| # | Issue | Severity | Breakpoints Affected | Location |
|---|-------|----------|---------------------|----------|
| 1 | **Sidebar content shift on mobile** -- `ml-64` applied at all widths when sidebar open on mobile | HIGH | < 1024px | AppLayout.tsx: class should be `lg:ml-64` not `lg:ml-64 ml-64` |
| 2 | **Breakpoint 1024px vs spec 768px** -- Spec says sidebar visible at 768px+; code uses 1024px | MEDIUM | 768-1023px | AppLayout.tsx, ui.store.ts |
| 3 | **No responsive grids on DomainsPage** -- max-w-4xl but no grid breakpoints | LOW | All | DomainsPage.tsx |
| 4 | **No responsive grids on SettingsPage** -- max-w-2xl single column | LOW | All | BusinessSettingsPage.tsx |
| 5 | **Dashboard stats grid only responds at md** -- No xl/2xl optimizations | LOW | > 1280px | DashboardPage.tsx |

**Verified responsive behavior (manual testing needed):**
- Sidebar: Works at desktop (>1024px), toggle works on mobile, but content shifts
- Hamburger: Visible < 1024px, hidden >= 1024px -- correct
- Forms: Single column, centered, max-width constrained -- correct
- Dashboard grid: Single column -> 3 columns at md -- correct
- Login/Register: Centered card, responsive padding -- correct

---

## 10. API Issues

| # | Issue | Severity | Spec Ref | Location |
|---|-------|----------|----------|----------|
| 1 | **Rate limiting on only 3/15 endpoints** -- Spec 09 requires rate limiting on all protected endpoints; only auth endpoints have ThrottlerGuard | MEDIUM | 09/Section 3 | auth.controller.ts |
| 2 | **No request body size limit** -- Spec 09 requires 1MB max; no explicit limit configured | LOW | 09/Section 2 | main.ts |
| 3 | **Session ipAddress/userAgent never populated** -- createSession accepts optional params but callers never pass them | MEDIUM | 09/Section 3.3 | auth.service.ts |
| 4 | **Cross-tenant returns 403 not 404** -- Spec 09 says cross-tenant access returns 404 to prevent info disclosure; code returns ForbiddenException (403) | MEDIUM | 09/Section 2 | business.service.ts, domain.service.ts |
| 5 | **No Swagger/OpenAPI** -- Spec 13 requires Swagger docs at /api/docs | LOW | 13/Section 7 | Not configured |
| 6 | **Refresh token TTL not enforced in Session model** -- Session.expiresAt exists but refresh service checks JWT expiry not DB expiry | LOW | 09/Section 3.3 | auth.service.ts |

---

## 11. Database Issues

| # | Issue | Severity | Spec Ref | Location |
|---|-------|----------|----------|----------|
| 1 | **No Prisma middleware for soft delete** -- deletedAt column exists on 4 models but queries manually filter `deletedAt: null`; risk of accidental inclusion | MEDIUM | 08/Section 6 | All services |
| 2 | **verificationToken stored in plaintext** -- Should be hashed or use short-lived tokens | MEDIUM | 08/Section 2.4 | schema.prisma |
| 3 | **UserRole missing MEMBER/VIEWER** -- Only OWNER, ADMIN, MANAGER; team invitation (M4B) requires additional roles | MEDIUM | 08/Section 2.2 | schema.prisma |
| 4 | **argon2 in database package** -- Password hashing dependency in @replyiq/database instead of API layer | LOW | 08 | database/package.json |
| 5 | **No index on BusinessDomain.businessId + isPrimary** -- Query for isPrimary domain requires full scan | LOW | 08 | schema.prisma |
| 6 | **Shared packages empty** -- @replyiq/types, @replyiq/ui, @replyiq/utils are scaffolded but export nothing | LOW | 05/Section 3 | packages/types, ui, utils |
| 7 | **Global email uniqueness** -- User.email is globally unique; no compound unique on [organizationId, email] | LOW | 08/Section 2.2 | schema.prisma |

---

## 12. Security Issues

| # | Issue | Severity | Spec Ref | Location |
|---|-------|----------|----------|----------|
| 1 | **localStorage token storage** -- Access and refresh tokens stored in localStorage, vulnerable to XSS | CRITICAL | 12/Section 3.1 | auth.store.ts |
| 2 | **No RBAC enforcement** -- PARTIAL: RolesGuard + @Roles decorator classes exist but are not applied to any controller; role checks never execute | CRITICAL | 12/Section 4 | guards/roles.guard.ts, decorators/roles.decorator.ts |
| 3 | **No organization isolation middleware** -- PARTIAL: OrganizationGuard exists but is a stub (`canActivate` always true) and is unwired; service-level checks remain the only enforcement | CRITICAL | 12/Section 5 | guards/organization.guard.ts |
| 4 | **Only 3/15 endpoints rate-limited** -- Brute force possible on business/domain/onboarding endpoints | HIGH | 12/Section 9 | auth.controller.ts only |
| 5 | **No CSRF protection** -- No CSRF tokens or SameSite cookie attributes | HIGH | 12/Section 6 | Not configured |
| 6 | **No account lockout** -- Unlimited login attempts possible (only 10/60s rate limit) | HIGH | 12/Section 7 | Not implemented |
| 7 | **No audit logging** -- No record of who did what when | HIGH | 12/Section 12 | Not implemented |
| 8 | **verificationToken in plaintext** -- Stored unhashed in database | MEDIUM | 12 | schema.prisma |
| 9 | ~~**Session IP/userAgent not tracked**~~ -- RESOLVED: IP and user-agent captured on login/register | ~~MEDIUM~~ RESOLVED | 12/Section 8 | auth.service.ts, auth.controller.ts |
| 10 | **No session cleanup** -- Expired/revoked sessions never purged | MEDIUM | 12/Section 8 | Not implemented |
| 11 | **Default argon2 parameters** -- Using library defaults, not tuned for production | LOW | 12/Section 2 | password.service.ts |
| 12 | **JWT secrets in .env file** -- test-secret values, not production-strength | LOW | 12 | .env |

---

## 13. Documentation Drift

| # | Issue | Severity | Spec Ref | Location |
|---|-------|----------|----------|----------|
| 1 | **Spec 03 responsive breakpoint 768px vs code 1024px** -- Sidebar content shift bug FIXED (2026-08-19); breakpoint remains 1024px (deliberate: 256px sidebar crowds 768px) | LOW | 03/Section 5 | AppLayout.tsx |
| 2 | **Spec 09 refresh token lifetime 7 days vs 30 days** -- API spec says 7-day refresh tokens; code uses 30d default | MEDIUM | 09/Section 3.3 | env.validation.ts |
| 3 | **Spec 08 says 7 enums but Prisma has 7** -- Match (correct) | -- | 08 | -- |
| 4 | **Spec 02 says /business/:businessId but code uses /businesses/:businessId** -- Path prefix mismatch | LOW | 02/Appendix | Both are /businesses/ in code (spec also says /businesses/) |

---

## 14. Technical Debt

| # | Item | Severity | Impact |
|---|------|----------|--------|
| 1 | **0% test coverage** -- No tests exist anywhere in the repository | HIGH | No safety net for changes |
| 2 | **Duplicate normalizeDomain()** -- Copy-pasted in 2 files | LOW | Maintenance burden |
| 3 | **Breakpoint constant in 3 places** -- Not shared | LOW | Inconsistency risk |
| 4 | **Modal.tsx unused** -- Dead code | LOW | Confusion |
| 5 | **Workspace packages unused** -- types, ui, utils imported nowhere | LOW | Wasted build time |
| 6 | ~~**No React Error Boundary**~~ -- RESOLVED: ErrorBoundary wrapping App in main.tsx | ~~MEDIUM~~ RESOLVED | Poor UX |
| 7 | **Login/Register raw fetch** -- Duplicates apiFetch logic | MEDIUM | Maintenance burden |
| 8 | **No form validation library** -- Manual HTML5 + regex | MEDIUM | Inconsistent validation |
| 9 | **arg2 in database package** -- Misplaced dependency | LOW | Architectural concern |
| 10 | ~~**Session ipAddress/userAgent never set**~~ -- RESOLVED: Captured on login/register | ~~MEDIUM~~ RESOLVED | Unused data |
| 11 | ~~**Cross-tenant 403 vs 404**~~ -- RESOLVED: All tenant checks return NotFoundException | ~~MEDIUM~~ RESOLVED | Security concern |
| 12 | **No soft delete middleware** -- Manual filtering in every query | MEDIUM | Error-prone |
| 13 | **verifyDomainMutation.isSuccess not reset** -- Stale state | LOW | UX issue |
| 14 | **Delete button shared loading state** -- All buttons show loading | LOW | UX issue |

---

## 15. Manual Browser Verification Checklist

The following issues require manual browser testing to confirm current state:

### High Priority (Verify Before Next Sprint)

- [ ] **Sidebar mobile behavior:** Open sidebar on mobile (< 1024px), close it, resize to desktop, resize back to mobile -- does hamburger reappear?
- [ ] **Sidebar content shift:** On mobile, toggle sidebar open -- does content shift right or stay in place?
- [ ] **"Continue Setup" flow:** From dashboard, click "Complete Your Setup" -- does it load the correct onboarding step?
- [ ] **Domain persistence:** Add a domain during onboarding, navigate to domains page -- does the domain appear?
- [ ] **Domain duplicate error:** Try to add a domain that already exists -- does error message clearly show the existing domain?
- [ ] **Onboarding state after refresh:** Complete step 1, refresh page -- does the wizard resume at step 2?
- [ ] **Token refresh:** Wait 15+ minutes, perform an action -- does the token refresh silently work?
- [ ] **Logout everywhere:** Open two tabs, logout in one -- is the other tab also logged out on next action?

### Medium Priority (Verify Before Release)

- [ ] **Form validation:** Submit registration with short password (8 chars) -- is error shown?
- [ ] **Loading states:** Clear network cache, navigate between pages -- do skeletons appear?
- [ ] **Empty states:** Remove all domains, visit domains page -- is empty state shown?
- [ ] **Error states:** Disconnect network, try to save settings -- is error banner shown?
- [ ] **Modal escape key:** Open verify modal, press Escape -- does it close?
- [ ] **Modal backdrop click:** Open verify modal, click outside -- does it close?
- [ ] **Keyboard navigation:** Tab through all interactive elements -- is focus visible?
- [ ] **Responsive at 375px:** Load on iPhone SE size -- is everything usable?

### Low Priority (Nice to Have)

- [ ] **Browser zoom:** Zoom to 200% -- does layout remain usable?
- [ ] **Orientation change:** Rotate mobile device -- does layout adapt?
- [ ] **Long content:** Enter 500-char business description -- does it wrap correctly?
- [ ] **Concurrent sessions:** Login from two devices -- does both work independently?

---

## 16. Current Milestone

**Milestone 4: Business Onboarding -- Phase 4A Complete, Phase 4B Not Started**

Per spec 15-ROADMAP.md:

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 4A (Business CRUD, Domains, Verification, Wizard, Dashboard, Settings) | COMPLETE | 100% |
| Phase 4B (Team Invitations, Roles, Remove, Logo Upload) | NOT STARTED | 0% |

**Remaining M4B features:**
- User invitation system (email-based, token flow)
- Team member list page
- Role management (ADMIN/MANAGER/MEMBER/VIEWER)
- Remove team member (soft delete + session revoke)
- Transfer ownership
- Business logo upload

**M4B estimated effort:** 2-3 weeks

---

## 17. Recommended Implementation Order

### Phase A: Fix Critical/High Issues (1-2 days)

1. **Fix mobile sidebar content shift** (AppLayout.tsx -- change `lg:ml-64 ml-64` to `lg:ml-64`)
2. **Fix cross-tenant 403 to 404** (business.service.ts, domain.service.ts -- return NotFoundException instead of ForbiddenException)
3. **Fix session ipAddress/userAgent tracking** (auth.service.ts -- pass req.ip and req.headers to createSession)
4. **Add React Error Boundary** (wrap App component)

### Phase B: Complete M4B (2-3 weeks)

5. **Add MEMBER/VIEWER roles to UserRole enum** (schema.prisma + migration)
6. **Implement invitation system** (model, service, controller, UI)
7. **Implement team management page** (list, invite, remove, roles)
8. **Add logo upload** (S3 or local storage, business update endpoint)

### Phase C: Testing Foundation (1 week, can parallel with M4B)

9. **Configure Vitest** (packages/api, packages/web)
10. **Write auth integration tests** (all 5 auth endpoints)
11. **Write business/domain API tests** (all 10 business/domain/onboarding endpoints)
12. **Configure Playwright** (E2E for registration, login, onboarding flow)

### Phase D: Security Hardening (1 week, can parallel with M4B)

13. **Move tokens to httpOnly cookies** (auth.store.ts, apiFetch, auth.controller)
14. **Implement OrganizationGuard** (middleware for all tenant-scoped routes)
15. **Add rate limiting to all endpoints** (ThrottlerModule global or per-controller)
16. **Add RBAC enforcement** (RolesGuard, @Roles decorators)

### Phase E: Begin M5 (4-6 weeks, after M4B)

17. Knowledge source models + migration
18. Document upload + parsing pipeline
19. Knowledge management UI

---

## 18. Definition-of-Done Status

Per spec 14-QA-ACCEPTANCE-DOD.md:

### Code Quality

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Implementation complete per spec | PARTIAL | M1-M3 complete, M4A complete |
| TypeScript zero errors | PASS | CI typecheck job passes |
| ESLint zero warnings | PASS | CI lint job passes |
| Build succeeds | PASS | CI build job passes |
| No console.log in production | PASS | None found |
| No unlinked TODO/FIXME | PASS | None found |
| No hardcoded values | PASS | Config via env vars |
| Error handling on all operations | PARTIAL | Backend has GlobalExceptionFilter; frontend has no ErrorBoundary |
| Loading states on all async ops | PARTIAL | Dashboard/Settings/Onboarding have skeletons; DomainsPage partial |
| Empty states defined | PARTIAL | Inline text, no formal EmptyState component |

### Testing

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Unit tests | FAIL | 0 test files |
| Integration tests | FAIL | 0 test files |
| E2E tests | FAIL | 0 test files |
| Coverage threshold | FAIL | No coverage tooling |
| No skipped tests | PASS (N/A) | No tests to skip |

### UI/UX

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Responsive at all breakpoints | PARTIAL | Mobile sidebar bug; breakpoint mismatch |
| WCAG 2.1 AA accessibility | PARTIAL | Focus rings, ARIA labels present; no focus trap, no reduced-motion |
| Keyboard navigable | PARTIAL | Most elements focusable; modal has no focus trap |
| Error messages clear | PASS | Backend returns descriptive errors; frontend shows banners |
| Loading indicators | PARTIAL | Skeletons on some pages; no spinner on buttons consistently |

### Security

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Input validation (server) | PASS | class-validator on all DTOs |
| Authentication enforced | PASS | JwtAuthGuard on protected routes |
| Authorization enforced | FAIL | No RBAC, no organization guard |
| No secrets in code | PASS | .env gitignored |
| SQL injection prevention | PASS | Prisma parameterized queries |

### Regression

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Existing functionality intact | PASS | Manual testing suggests M1-M3 works |
| Tests pass | FAIL | No tests exist |
| Smoke test | FAIL | No smoke test defined |
| Cross-browser | NOT TESTED | No E2E framework configured |

---

## Executive Summary Quantified

| Category | Implemented | Partial | Missing/Planned | Broken |
|----------|-------------|---------|-----------------|--------|
| Product Requirements | 55 features | 8 features | 167 features | 0 |
| User Flows | 10 flows | 2 flows | 4 flows | 1 (sidebar) |
| UI/UX Components | 5/16 | 2/16 | 9/16 | 0 |
| API Endpoints | 15/15+ | 0 | 27+ | 1 (403 vs 404) |
| Database Models | 6/17 | 0 | 11 | 0 |
| Security Controls | 10/36 | 2/36 | 24/36 | 0 |
| Tests | 0 | 0 | All | N/A |
| Infrastructure | 9/31 | 0 | 22 | 0 |

---

## Final Verdict

### CURRENT STATE:
Milestones 1-3 complete, Milestone 4A complete. Backend has 15 working endpoints, frontend has 6 pages. Hardening phase (2026-08-19) created RolesGuard and OrganizationGuard classes but **did not wire them into any controller** — RBAC and guard-based tenant isolation remain unenforced (corrected 2026-08 reconciliation; see SPEC-RECONCILIATION-REPORT.md). Confirmed resolved: session IP/userAgent tracking, cross-tenant 404 fix, ErrorBoundary, mobile sidebar fix, request body size limit. 2 critical gaps remain (localStorage token storage — deferred as architectural decision; RBAC/tenant-guard enforcement unwired). 0 tests.

### NEXT IMPLEMENTATION TARGET:
Complete Milestone 4B (Team Management). Remaining blockers: localStorage token storage (CRITICAL, deferred), 0 test coverage (HIGH).

### BLOCKERS:
1. ~~Mobile sidebar content shift (HIGH)~~ -- FIXED 2026-08-19
2. No RBAC enforcement (CRITICAL) -- Classes created 2026-08-19 but NOT wired; still open (confirmed 2026-08 reconciliation)
3. No organization guard middleware (CRITICAL) -- Stub created 2026-08-19 (`canActivate` always true, unwired); still open
4. localStorage token storage (CRITICAL) -- Deferred; architectural decision requires httpOnly cookie migration

### HARDENING PHASE CHANGES (2026-08-19):
- `apps/api/src/modules/auth/decorators/roles.decorator.ts` — NEW: @Roles() decorator (unused on endpoints)
- `apps/api/src/modules/auth/guards/roles.guard.ts` — NEW: RolesGuard for RBAC (not applied to any controller)
- `apps/api/src/modules/auth/guards/organization.guard.ts` — NEW: OrganizationGuard (placeholder; always returns true)
- `apps/api/src/modules/auth/auth.controller.ts` — Captures IP/userAgent from request
- `apps/api/src/modules/auth/auth.service.ts` — Passes IP/userAgent to session creation
- `apps/api/src/modules/auth/workspace-provisioning.service.ts` — Captures IP/userAgent on registration
- `apps/api/src/modules/business/business.service.ts` — Cross-tenant returns 404 (was 403)
- `apps/api/src/modules/domain/domain.service.ts` — Cross-tenant returns 404 (was 403)
- `apps/api/src/modules/onboarding/onboarding.service.ts` — Cross-tenant returns 404 (was 403)
- `apps/api/src/main.ts` — Request body size limit (100KB)
- `apps/web/src/components/ErrorBoundary.tsx` — NEW: React error boundary
- `apps/web/src/main.tsx` — Wraps App with ErrorBoundary
- `apps/web/src/components/layout/AppLayout.tsx` — Fixed mobile sidebar content shift
- `apps/web/src/pages/LoginPage.tsx` — Redirect back after login (uses `from` state)

---

*This audit was produced by comparing the codebase against the 16-document product specification (docs/product-spec/). All findings are based on code inspection and specification comparison. Manual browser verification is required for items in Section 15.*
