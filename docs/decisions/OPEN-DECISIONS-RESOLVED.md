# Open Decisions -- Resolution Log

> Resolution of all 12 open decisions (OD-01 through OD-12) identified in the documentation audit. Each decision includes evidence, rationale, consequences, and affected documents.

**Resolved:** 2026-08-17
**Status:** Approved

---

## OD-01: React Hook Form

### Current State

README.md lists "React Hook Form" in the tech stack table. It is not installed in any package.json. No imports of `useForm`, `useController`, or any react-hook-form API exist anywhere in the codebase. All forms use plain React `useState` with controlled inputs.

### Evidence

- `apps/web/package.json`: No `react-hook-form` dependency in `dependencies` or `devDependencies`.
- `apps/web/src/pages/LoginPage.tsx`: Uses `useState` for email, password fields.
- `apps/web/src/pages/RegisterPage.tsx`: Uses `useState` for businessName, ownerName, email, password fields.
- `apps/web/src/pages/OnboardingPage.tsx`: Uses `useState` for profileForm, domainInput.
- `apps/web/src/pages/BusinessSettingsPage.tsx`: Uses `useState` for form object.
- Zero grep matches for `react-hook-form`, `useForm`, or `useController` across all source files.

### Decision

**B. Remove React Hook Form references and standardize on the current implementation.**

React Hook Form is not part of the stack. The current pattern (plain `useState` + controlled components + backend class-validator) is the standard.

### Rationale

- The current pattern works and is consistent across all 4 forms.
- Backend validation via class-validator DTOs provides the authoritative validation.
- Client-side validation can be added incrementally using Zod schemas (already a dependency) without introducing a new form library.
- Adding React Hook Form would be a new dependency with no clear benefit at the current product scale (4 forms, simple field counts).
- ADR-010 (Class-Validator DTOs) already establishes the validation strategy.

### Consequences

- README.md must remove "React Hook Form" from the tech stack table.
- The documentation index does not need updating (it never included React Hook Form as a decision point beyond the open decision).

### Required Future Work

- When client-side form validation becomes necessary, evaluate Zod + React Hook Form integration. For now, the backend validation is sufficient.
- Update `architecture/FRONTEND.md` when created to document the form pattern as `useState` controlled components.

### Documents Affected

- `README.md` (remove React Hook Form from tech stack)

---

## OD-02: pnpm Version

### Current State

README.md says "pnpm v9+". The `packageManager` field in `package.json` specifies `pnpm@11.13.0`. The lockfile version is `9.0` (which is the lockfile format version used by pnpm 9+, not the pnpm version itself). No `.npmrc`, `.tool-versions`, or engine constraints exist.

### Evidence

- `package.json` line 5: `"packageManager": "pnpm@11.13.0"`
- `pnpm-lock.yaml` line 1: `lockfileVersion: '9.0'` (format version, not pnpm version)
- README.md line 48: States "pnpm v9+"

### Decision

**pnpm 11.13.0 is the project standard.** The `packageManager` field in `package.json` is the single source of truth. README.md must be corrected.

### Rationale

- The `packageManager` field is enforced by corepack and is the authoritative source.
- pnpm 11.x has different behavior from pnpm 9.x (lockfile format, workspace protocol, etc.).
- The lockfile version `9.0` is the internal format version, not the pnpm version. This is a common source of confusion.
- Using pnpm 9 would risk lockfile incompatibility and different dependency resolution behavior.

### Consequences

- README.md must change "pnpm v9+" to "pnpm 11.13.0+".
- The `infrastructure/DEVELOPMENT-SETUP.md` (when created) must specify pnpm 11.13.0+ and recommend corepack enablement.

### Required Future Work

- None. The `packageManager` field handles version enforcement automatically via corepack.

### Documents Affected

- `README.md` (correct pnpm version)
- `infrastructure/DEVELOPMENT-SETUP.md` (when created, specify pnpm version)

---

## OD-03: parseTtlToSeconds

### Current State

The function is duplicated in two files with different fallback defaults:

- `auth.service.ts`: Fallback = `30 * 86400` (30 days). Used only for refresh token TTL.
- `workspace-provisioning.service.ts`: Fallback = `900` (15 minutes). Used for both access token TTL (15m) and refresh token TTL (30d).

Both parse the same format: `^(\d+)([smhd])$`. The `@replyiq/utils` package is empty and available for shared code.

### Evidence

- `apps/api/src/modules/auth/auth.service.ts` lines 293-316: Fallback 30 days.
- `apps/api/src/modules/auth/workspace-provisioning.service.ts` lines 190-213: Fallback 900 seconds.
- `packages/utils/src/index.ts`: Empty (`export {};`).
- Both functions parse the identical regex pattern with identical switch cases.

### Decision

**Extract to `@replyiq/utils` as a shared utility with a required fallback parameter. Each caller provides its own default.**

```typescript
// packages/utils/src/ttl.ts
export function parseTtlToSeconds(ttl: string, fallbackSeconds: number): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackSeconds;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return fallbackSeconds;
  }
}
```

### Rationale

- The parsing logic is identical. Only the fallback differs.
- A shared utility eliminates the duplication (which the audit identified as tech debt in PROJECT_STATUS.md).
- The `fallbackSeconds` parameter preserves the existing behavior: auth.service.ts passes 2592000 (30d), workspace-provisioning.service.ts passes 900 (15m).
- ADR-013 (Separate Access and Refresh Token TTLs) already establishes that access = 15m, refresh = 30d. The fallback values align with these defaults.
- This is a pure refactoring -- no behavioral change.

### Consequences

- `@replyiq/utils` package gains its first utility function.
- Both services import from `@replyiq/utils` instead of having private methods.
- The behavioral difference is preserved (each service has its own fallback), but the logic is unified.
- The duplicate function in each service file is removed.

### Required Future Work

- Implement the extraction (create `packages/utils/src/ttl.ts`, update both services).
- This resolves the tech debt item listed in PROJECT_STATUS.md line 323.

### Documents Affected

- `decisions/ADR-023-TTL-PARSER.md` (new ADR to record this decision)
- `packages/utils/src/index.ts` (export the new utility)
- `apps/api/src/modules/auth/auth.service.ts` (import from shared util)
- `apps/api/src/modules/auth/workspace-provisioning.service.ts` (import from shared util)
- `docs/decisions/ADR-INDEX.md` (add ADR-023)

---

## OD-04: .env.example

### Current State

The root `.env.example` contains only `DATABASE_URL`. The API has a complete `apps/api/.env.example` with all 10 variables. The web has `apps/web/.env.example` with `VITE_API_URL`. The Zod validation schema validates 10 API variables. The root `.env` also only contains `DATABASE_URL`.

### Evidence

- Root `.env.example`: Only `DATABASE_URL`.
- `apps/api/.env.example`: Complete with all 10 variables.
- `apps/web/.env.example`: `VITE_API_URL=http://localhost:3000`.
- `apps/api/src/config/env.validation.ts`: Zod schema validates 10 variables (3 required, 7 with defaults).

### Decision

**Update the root `.env.example` to be the union of all required environment variables across all apps.** Each app's `.env.example` remains as a subset for app-specific development.

### Authoritative Environment Variable Specification

| Variable | Required | Default | Secret | Purpose |
|----------|----------|---------|--------|---------|
| `DATABASE_URL` | Yes | -- | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | -- | Yes | Access token signing secret |
| `JWT_REFRESH_SECRET` | Yes | -- | Yes | Refresh token signing secret |
| `PORT` | No | `3000` | No | API server port |
| `NODE_ENV` | No | `development` | No | Environment mode |
| `ACCESS_TOKEN_TTL` | No | `15m` | No | Access token expiry |
| `REFRESH_TOKEN_TTL` | No | `30d` | No | Refresh token expiry |
| `CORS_ORIGINS` | No | `http://localhost:5173` | No | Comma-separated allowed origins |
| `RATE_LIMIT_TTL` | No | `60` | No | Rate limit window (seconds) |
| `RATE_LIMIT_MAX` | No | `10` | No | Max requests per window |
| `VITE_API_URL` | No | `http://localhost:3000` | No | Frontend API base URL (web/widget) |

### Rationale

- The root `.env.example` is the first file new developers see. It must contain everything needed to start.
- The API's `.env.example` is already complete but is in a subdirectory.
- Three variables are secrets (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`) and must never have real values in documentation.
- The Zod schema in `apps/api/src/config/env.validation.ts` is the runtime source of truth for validation.

### Consequences

- Root `.env.example` must be updated to include all 11 variables (10 API + 1 VITE_API_URL).
- The root `.env` should also be updated for developer convenience (currently only has DATABASE_URL, missing JWT secrets which are required).
- `infrastructure/DEVELOPMENT-SETUP.md` (when created) must reference this table.

### Required Future Work

- Update root `.env.example` and root `.env` with all variables.
- Document the secret vs non-secret classification in `infrastructure/DEVELOPMENT-SETUP.md`.

### Documents Affected

- `.env.example` (update with all variables)
- `.env` (add missing required variables for local dev)
- `infrastructure/DEVELOPMENT-SETUP.md` (when created, reference this spec)

---

## OD-05: API Endpoint Count

### Current State

PROJECT_STATUS.md lists 14 endpoints. The actual codebase implements 15 endpoints. The missing endpoint is `DELETE /businesses/:businessId/domains/:domainId`. API_STATUS.md lists this endpoint as "Not Yet Implemented" but it exists in `domain.controller.ts`.

### Evidence

- `apps/api/src/modules/domain/domain.controller.ts` line 45: `@Delete(':domainId')` handler `remove()`.
- `apps/web/src/api/business.ts`: Frontend calls this DELETE endpoint (confirmed by route in business.ts).
- PROJECT_STATUS.md lines 262-277: Lists 14 endpoints, missing the DELETE.
- API_STATUS.md lines 307-333: Lists DELETE as "Not Yet Implemented".

### Decision

**The authoritative endpoint count is 15.** PROJECT_STATUS.md and API_STATUS.md must be corrected to reflect this.

### Complete Authoritative Endpoint Inventory

| # | Method | Full Route | Auth | Controller | Status |
|---|--------|-----------|------|------------|--------|
| 1 | GET | `/api/v1/health` | No | health.controller.ts | Working |
| 2 | POST | `/api/v1/auth/register` | No | auth.controller.ts | Working |
| 3 | POST | `/api/v1/auth/login` | No | auth.controller.ts | Working |
| 4 | POST | `/api/v1/auth/refresh` | No | auth.controller.ts | Working |
| 5 | POST | `/api/v1/auth/logout` | Yes | auth.controller.ts | Working |
| 6 | GET | `/api/v1/auth/me` | Yes | auth.controller.ts | Working |
| 7 | GET | `/api/v1/businesses/:businessId` | Yes | business.controller.ts | Working |
| 8 | PATCH | `/api/v1/businesses/:businessId` | Yes | business.controller.ts | Working |
| 9 | GET | `/api/v1/businesses/:businessId/domains` | Yes | domain.controller.ts | Working |
| 10 | POST | `/api/v1/businesses/:businessId/domains` | Yes | domain.controller.ts | Working |
| 11 | POST | `/api/v1/businesses/:businessId/domains/:domainId/verify` | Yes | domain.controller.ts | Working |
| 12 | DELETE | `/api/v1/businesses/:businessId/domains/:domainId` | Yes | domain.controller.ts | Working |
| 13 | GET | `/api/v1/businesses/:businessId/domains/:domainId/verification-instructions` | Yes | domain.controller.ts | Working |
| 14 | GET | `/api/v1/businesses/:businessId/onboarding` | Yes | onboarding.controller.ts | Working |
| 15 | PATCH | `/api/v1/businesses/:businessId/onboarding/steps` | Yes | onboarding.controller.ts | Working |

### Rationale

- The endpoint exists in code, is used by the frontend, and is fully functional.
- Documenting it as "Not Yet Implemented" is factually incorrect and misleading.
- The project status and API documentation must reflect reality.

### Consequences

- PROJECT_STATUS.md endpoint table must be updated to 15 rows.
- API_STATUS.md must move the DELETE endpoint from "Not Yet Implemented" to "Implemented".
- `api/DOMAIN.md` (when created) must include this endpoint.

### Required Future Work

- None. This is a documentation correction.

### Documents Affected

- `docs/PROJECT_STATUS.md` (add missing endpoint to table)
- `docs/API_STATUS.md` (move endpoint to "Implemented" section)
- `api/DOMAIN.md` (when created, include this endpoint)

---

## OD-06: Rate Limiting Scope

### Current State

`ThrottlerModule` is configured globally with TTL=60s and limit=10 requests. However, `ThrottlerGuard` is applied only to 3 auth endpoints (`register`, `login`, `refresh`). The other 12 endpoints have no throttling. API_STATUS.md incorrectly says "Not implemented".

### Evidence

- `apps/api/src/app.module.ts` lines 23-30: `ThrottlerModule.forRootAsync` configured with TTL and limit from env vars.
- `apps/api/src/modules/auth/auth.controller.ts`: `@UseGuards(ThrottlerGuard)` on register (line 28), login (line 37), refresh (line 44).
- All other controllers: Only `JwtAuthGuard`, no `ThrottlerGuard`.
- `apps/api/src/config/configuration.ts` lines 16-19: `rateLimit.ttl` and `rateLimit.max` from env vars.
- API_STATUS.md line 354: "Status: Not implemented" (incorrect).

### Decision

**Document the current implementation accurately.** Rate limiting IS implemented on auth endpoints. The scope is intentionally limited to authentication endpoints at this stage.

### Intended Rate Limiting Policy

| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| POST /auth/register | 10 requests | 60 seconds (global) | Prevent mass registration |
| POST /auth/login | 10 requests | 60 seconds (global) | Prevent brute-force (production should be tighter) |
| POST /auth/refresh | 10 requests | 60 seconds (global) | Prevent token abuse |
| All other endpoints | No limit | -- | Authenticated endpoints are protected by JWT; rate limiting deferred to production |

### Production Enhancement (Future)

The current 10/60s global limit is adequate for development. Production should implement:
- Login: 5 attempts per 15 minutes per email (stricter)
- Register: 10 per hour per IP (stricter)
- Authenticated endpoints: Optional per-user limits

These are production hardening items, not current implementation.

### Rationale

- The infrastructure is in place (ThrottlerModule + env vars).
- Auth endpoints are the highest risk for abuse.
- Authenticated endpoints are protected by JWT validation, which has its own computational cost (argon2 verify on refresh).
- Adding throttling to all endpoints is a production hardening concern, not a current requirement.

### Consequences

- API_STATUS.md must be corrected from "Not implemented" to "Implemented on auth endpoints".
- `api/OVERVIEW.md` (when created) must document the rate limiting policy.
- `security/PRODUCTION-REQUIREMENTS.md` (when created) must list tighter auth limits as production requirements.

### Required Future Work

- Tighten auth endpoint limits for production (login: 5/15min, register: 10/hr).
- Consider adding `ThrottlerGuard` to authenticated endpoints in production.

### Documents Affected

- `docs/API_STATUS.md` (correct rate limiting status)
- `api/OVERVIEW.md` (when created, document rate limiting)
- `security/PRODUCTION-REQUIREMENTS.md` (when created, list production limits)

---

## OD-07: Onboarding Store

### Current State

`onboarding.store.ts` does not exist. The design doc (`BUSINESS_ONBOARDING.md`) planned a Zustand store. The implementation uses TanStack Query for server state and `useState` for local UI state. This pattern works correctly.

### Evidence

- `apps/web/src/stores/`: Only `auth.store.ts` and `ui.store.ts` exist.
- `apps/web/src/pages/OnboardingPage.tsx`: Uses `useBusiness`, `useOnboardingProgress`, `useUpdateOnboardingStep` (TanStack Query) for server state. Uses `useState` for `profileForm`, `domainInput`, `verifyMethod`, `selectedDomainId` (local UI state).
- `apps/web/src/pages/DashboardPage.tsx`: Uses `useOnboardingProgress` (TanStack Query).
- Milestone 4A stabilization (milestone-4a-findings.md): Confirmed React Query properly owns all server state. No state management bugs found.

### Decision

**The current implementation is correct. The onboarding store from the design doc was never needed.**

State ownership:
- **Server state** (business data, onboarding progress, domains): TanStack Query hooks.
- **Client-only UI state** (sidebar open/close, active modal): Zustand stores.
- **Transient form state** (current form inputs, validation errors): React `useState` in components.

### Rationale

- The Milestone 4A stabilization sprint validated this architecture (finding D in milestone-4a-findings.md).
- TanStack Query handles caching, background refetching, and stale data for server state.
- Zustand is reserved for truly client-only state that persists across components (auth tokens, sidebar state).
- Form state is transient and component-scoped; `useState` is the correct primitive.
- Adding a Zustand store for onboarding would duplicate server state and create synchronization issues.

### Consequences

- The design doc's `onboarding.store.ts` plan is abandoned.
- `architecture/FRONTEND.md` (when created) must document this three-tier state architecture.
- The `flows/ONBOARDING.md` (when created) must reference TanStack Query hooks, not a Zustand store.

### Required Future Work

- Document the state architecture pattern in `architecture/FRONTEND.md`.
- Apply the same pattern to future features (knowledge management, AI conversations).

### Documents Affected

- `architecture/FRONTEND.md` (when created, document state architecture)
- `flows/ONBOARDING.md` (when created, reference correct state management)
- `docs/product-design/BUSINESS_ONBOARDING.md` (mark onboarding store as abandoned)

---

## OD-08: Database README

### Current State

`packages/database/README.md` exists with setup instructions and model/enum tables. The model table lists 4 models (missing Session, OnboardingProgress). The enum table lists 5 enums (missing OnboardingStatus, VerificationMethod). The package exports all 6 models and 6 enums.

### Evidence

- `packages/database/README.md`: 4 models, 5 enums documented.
- `packages/database/src/index.ts`: Exports 6 models (Organization, User, Business, BusinessDomain, Session, OnboardingProgress) and 6 enums (OrganizationStatus, BusinessStatus, UserRole, UserStatus, BusinessDomainStatus, OnboardingStatus, VerificationMethod).

### Decision

**Keep `packages/database/README.md` as a short developer-focused package guide. Update it to include all models and enums.** The detailed schema documentation lives in `docs/database/` (SCHEMA.md, MODELS.md).

### Rationale

- The package README serves a different audience (developers importing `@replyiq/database`) than the docs/ database section (architects and new team members).
- Package README should cover: installation, commands, what is exported, quick usage example.
- Detailed schema documentation (fields, types, indexes, relationships) belongs in `docs/database/MODELS.md`.
- The package README and docs/ database section should not duplicate detailed schema information.

### Consequences

- `packages/database/README.md` must be updated to list all 6 models and 6 enums in the summary tables.
- No content should be removed -- just added to make the tables complete.

### Required Future Work

- Update the README model and enum tables.
- When `docs/database/MODELS.md` is created, the package README should reference it for details.

### Documents Affected

- `packages/database/README.md` (update model and enum tables)

---

## OD-09: CORS Documentation

### Current State

`AUTHENTICATION.md` line 341 lists CORS as "Enabled (too permissive)". The implementation in `main.ts` uses explicit origins via `CORS_ORIGINS` env var with `credentials: true`. The description "too permissive" is outdated.

### Evidence

- `apps/api/src/main.ts` lines 22-27: CORS uses `CORS_ORIGINS` env var, splits by comma, passes explicit origins (not wildcard), enables credentials.
- `apps/api/src/config/env.validation.ts` line 11: Default is `http://localhost:5173`.
- `AUTHENTICATION.md` line 341: `CORS | Enabled (too permissive)`.

### Decision

**Update CORS documentation to accurately describe the implementation.** The current implementation is correctly configured with explicit origins. The "too permissive" label is obsolete.

### Rationale

- The implementation uses explicit origins, not wildcards. This is secure by default.
- The `CORS_ORIGINS` env var allows configuration per environment.
- `credentials: true` is appropriate for the SPA + API architecture (allows Authorization header).
- The documentation should reflect what exists, not what existed before the CORS_ORIGINS fix.

### Consequences

- `AUTHENTICATION.md` must update the CORS line from "Enabled (too permissive)" to "Enabled (explicit origins via CORS_ORIGINS env var)".
- `security/AUTHENTICATION.md` (when created) must document the CORS configuration accurately.
- `security/PRODUCTION-REQUIREMENTS.md` (when created) must list CORS_ORIGINS configuration as a production setup step.

### Required Future Work

- None. The CORS implementation is correct.

### Documents Affected

- `docs/AUTHENTICATION.md` (update CORS status)
- `security/AUTHENTICATION.md` (when created, accurate CORS documentation)
- `security/PRODUCTION-REQUIREMENTS.md` (when created, CORS setup step)

---

## OD-10: teamInvited

### Current State

The design doc (`BUSINESS_ONBOARDING.md`) includes `teamInvited` (Boolean) and `teamInvitedAt` (DateTime?) on the `OnboardingProgress` model. These fields do NOT exist in the Prisma schema. The implementation was deliberately deferred to Milestone 4B (team management).

### Evidence

- `packages/database/prisma/schema.prisma` lines 160-178: OnboardingProgress model has no `teamInvited` or `teamInvitedAt` fields.
- `docs/product-design/BUSINESS_ONBOARDING.md` lines 431-432: Lists both fields.
- `docs/DATABASE.md` lines 262-287: Correctly documents the model WITHOUT these fields.
- Milestone 4B scope (ROADMAP.md, NEXT_STEPS.md): Team management is the next milestone.

### Decision

**`teamInvited` is a planned field for Milestone 4B, not an oversight.** The design doc should be updated to clearly mark it as "Planned - Milestone 4B" alongside `logoUrl`.

### Rationale

- Team invitations require the Invitation model and team management endpoints, which are Milestone 4B scope.
- Adding the field before the feature exists would create a column that is always false with no way to set it.
- The design doc's inclusion of the field was aspirational (designed for the complete onboarding flow), not a bug.
- DATABASE.md already correctly omits it from the current schema.

### Consequences

- `docs/product-design/BUSINESS_ONBOARDING.md` must add "Planned - Milestone 4B" markers to `teamInvited` and `teamInvitedAt`.
- `docs/DATABASE.md` already correctly documents the current schema (no change needed).
- When Milestone 4B begins, the field should be added to the schema as part of the Invitation feature.

### Required Future Work

- Add `teamInvited` and `teamInvitedAt` to OnboardingProgress schema during Milestone 4B.
- Add team management API endpoints and UI.

### Documents Affected

- `docs/product-design/BUSINESS_ONBOARDING.md` (add "Planned" markers)
- `database/MODELS.md` (when created, document current state without teamInvited)

---

## OD-11: logoUrl

### Current State

The design doc (`BUSINESS_ONBOARDING.md`) includes `logoUrl` as a "proposed NEW field" on the Business model. It does NOT exist in the Prisma schema. No logo upload UI exists. DATABASE.md correctly lists it as "Planned - Milestone 4B".

### Evidence

- `packages/database/prisma/schema.prisma` lines 97-118: Business model has no `logoUrl` field.
- `docs/product-design/BUSINESS_ONBOARDING.md` line 348: `logoUrl | VARCHAR(500)? | **NEW** - URL to uploaded logo`.
- `docs/DATABASE.md` line 397: "Business model gains: `logoUrl` field" (under Planned - Milestone 4B).
- `apps/web/src/pages/BusinessSettingsPage.tsx`: No file upload UI, no image handling.
- Grep for "logo" in source code: Zero matches (only in documentation).

### Decision

**`logoUrl` is planned for Milestone 4B, not implemented.** The design doc already marks it as "NEW" (proposed). DATABASE.md already marks it as "Planned - Milestone 4B". No change needed to the classification.

### Rationale

- Logo upload requires file storage infrastructure (S3 or local), which is not yet in place.
- Milestone 4B scope explicitly includes "Business logo upload".
- The design doc's "NEW" marker is sufficient to distinguish it from implemented fields.

### Consequences

- No documentation changes needed. The existing markers are accurate.
- `database/MODELS.md` (when created) must list `logoUrl` as "Planned - Milestone 4B".

### Required Future Work

- Implement file storage (S3 or local) during Milestone 4B.
- Add `logoUrl` field to Business model schema.
- Add logo upload endpoint and UI.

### Documents Affected

- `database/MODELS.md` (when created, mark logoUrl as planned)

---

## OD-12: Route Parameter Naming

### Current State

All implemented controllers use `:businessId` and `:domainId` as route parameters. The frontend API client also uses `businessId`. However, API_STATUS.md's "Not Yet Implemented" section uses `:id` for some endpoints, creating an inconsistency.

### Evidence

- `apps/api/src/modules/business/business.controller.ts`: Uses `:businessId` (lines 16, 24).
- `apps/api/src/modules/domain/domain.controller.ts`: Uses `:businessId` and `:domainId` (lines 14, 35, 38, 45, 48, 54, 57).
- `apps/api/src/modules/onboarding/onboarding.controller.ts`: Uses `:businessId` (lines 12, 18, 26).
- `apps/web/src/api/business.ts`: Uses `businessId` in URL paths.
- `docs/API_STATUS.md` lines 323-328: Uses `:id` for planned endpoints.

### Decision

**Standardize on `:resourceId` naming convention.** Use the full resource name as the parameter: `:businessId`, `:domainId`, `:userId`, `:organizationId`, `:invitationId`.

### Naming Convention

| Resource | Parameter Name | Example Route |
|----------|---------------|---------------|
| Business | `:businessId` | `/businesses/:businessId` |
| Domain | `:domainId` | `/businesses/:businessId/domains/:domainId` |
| User | `:userId` | `/users/:userId` |
| Organization | `:organizationId` | `/organizations/:organizationId` |
| Invitation | `:invitationId` | `/invitations/:invitationId` |
| Session | `:sessionId` | `/sessions/:sessionId` |

### Rationale

- The implemented endpoints already use this convention consistently.
- Full resource names are self-documenting in route definitions and Swagger specs.
- The `:id` convention is ambiguous when multiple resource types appear in nested routes.
- The frontend API client already uses `businessId`, confirming the convention works end-to-end.

### Consequences

- API_STATUS.md's "Not Yet Implemented" section must be updated to use `:businessId` instead of `:id`.
- Future endpoints (users, organizations, invitations) must follow the `:resourceId` convention.
- No code changes needed -- all implemented endpoints already follow this convention.

### Required Future Work

- Update API_STATUS.md planned endpoints to use `:businessId`.
- Document the convention in `api/OVERVIEW.md` (when created).

### Documents Affected

- `docs/API_STATUS.md` (update planned endpoint param names)
- `api/OVERVIEW.md` (when created, document naming convention)

---

## Summary Table

| ID | Decision | Status | Implementation Change Required |
|----|----------|--------|-------------------------------|
| OD-01 | Remove React Hook Form from docs; standardize on useState controlled components | Resolved | No (docs only) |
| OD-02 | pnpm 11.13.0 is the standard; correct README.md | Resolved | No (docs only) |
| OD-03 | Extract parseTtlToSeconds to @replyiq/utils with fallback parameter | Resolved | Yes (refactor, no behavioral change) |
| OD-04 | Update root .env.example with all 11 env vars | Resolved | Yes (.env.example + .env update) |
| OD-05 | Authoritative endpoint count is 15; correct PROJECT_STATUS.md and API_STATUS.md | Resolved | No (docs only) |
| OD-06 | Rate limiting is implemented on auth endpoints; document accurately | Resolved | No (docs only) |
| OD-07 | No onboarding Zustand store; TanStack Query + useState is the correct pattern | Resolved | No (docs only) |
| OD-08 | Keep database README as package guide; update model/enum tables | Resolved | Yes (update README tables) |
| OD-09 | CORS uses explicit origins; update "too permissive" documentation | Resolved | No (docs only) |
| OD-10 | teamInvited is planned for Milestone 4B; add markers to design doc | Resolved | No (docs only) |
| OD-11 | logoUrl is planned for Milestone 4B; existing markers are sufficient | Resolved | No (docs only) |
| OD-12 | Standardize on :resourceId naming; update API_STATUS.md planned endpoints | Resolved | No (docs only) |

**Summary:** 9 of 12 decisions require documentation changes only. 3 require implementation changes (OD-03, OD-04, OD-08) -- all are low-risk refactoring or config updates with no behavioral impact.
