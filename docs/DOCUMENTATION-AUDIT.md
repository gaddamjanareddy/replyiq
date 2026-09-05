# ReplyIQ - Documentation Audit

> Complete audit of the existing `docs/` directory. Inventory, overlap analysis, contradictions, missing areas, and recommended mapping to the new documentation structure.

**Audit Date:** 2026-08-17
**Auditor:** Automated codebase + documentation cross-reference

---

## Table of Contents

1. [Complete Inventory](#1-complete-inventory)
2. [Content Extraction](#2-content-extraction)
3. [Overlap Analysis](#3-overlap-analysis)
4. [Contradictions](#4-contradictions)
5. [Missing Documentation](#5-missing-documentation)
6. [Recommended Mapping](#6-recommended-mapping)
7. [Existing Implementation Reality](#7-existing-implementation-reality)

---

## 1. Complete Inventory

### Files in `docs/`

| # | File | Purpose | Status |
|---|------|---------|--------|
| 1 | `docs/API_STATUS.md` | Complete API endpoint reference with DTOs, responses, and planned endpoints | Partially accurate — missing 1 implemented endpoint; lists "not yet implemented" endpoints with some route discrepancies vs design doc |
| 2 | `docs/AUTHENTICATION.md` | Complete authentication system docs: JWT, sessions, flows, security | Accurate |
| 3 | `docs/DATABASE.md` | Prisma schema reference: models, enums, relationships, migrations, seed | Accurate |
| 4 | `docs/DECISIONS.md` | 22 Architecture Decision Records (ADR-001 through ADR-022) | Accurate |
| 5 | `docs/milestone-4a-findings.md` | Stabilization sprint findings: root causes, fixes, regression results | Accurate |
| 6 | `docs/NEXT_STEPS.md` | Immediate next tasks and future task list | Accurate (time-sensitive — will become stale) |
| 7 | `docs/PROJECT_STATUS.md` | Single source of truth for project state: tech stack, architecture, completion % | Partially accurate — missing 1 endpoint from table; completion percentages are estimates |
| 8 | `docs/ROADMAP.md` | Milestone-driven development plan with feature checklists | Accurate |
| 9 | `docs/product-design/BUSINESS_ONBOARDING.md` | End-to-end architecture and product design for Milestone 4 | Partially accurate — design doc predates implementation; some planned items not implemented |
| 10 | `docs/product-discovery/ReplyIQ_PRD_v1.0.docx` | Product Requirements Document (binary) | Cannot verify content (binary .docx) |
| 11 | `docs/product-discovery/ReplyIQ_Product_Discovery_v0.1.docx` | Product Discovery document (binary) | Cannot verify content (binary .docx) |

### Empty Placeholder Directories

| Directory | Purpose (Inferred) |
|-----------|-------------------|
| `docs/ai/` | AI-related documentation (reserved for Milestone 6) |
| `docs/api/` | API reference docs (planned per BUSINESS_ONBOARDING.md section 9) |
| `docs/database/` | Database-specific docs (currently covered by DATABASE.md at root) |
| `docs/devops/` | DevOps/CI/CD documentation (reserved for Milestone 8) |
| `docs/roadmap/` | Roadmap files (currently covered by ROADMAP.md at root) |
| `docs/system-design/` | System design documents (reserved) |

### Files Outside `docs/` with Documentation Value

| File | Purpose |
|------|---------|
| `README.md` | Project overview, tech stack, getting started |
| `packages/database/README.md` | Database package usage and models reference |

---

## 2. Content Extraction

### `docs/API_STATUS.md`

- **Important Decisions:** All API routes prefixed with `/api/v1`. Base URL `http://localhost:3000`. Global error response format via `GlobalExceptionFilter`.
- **Requirements:** All protected endpoints require Bearer token in Authorization header.
- **Architecture:** Modular controller structure across auth, health, business, domain, onboarding modules.
- **Flows:** Register (creates Org + Business + User + Session in transaction), Login (email/password), Refresh (token rotation), Logout (session revocation), /me (fresh DB lookup).
- **APIs:** 15 implemented endpoints documented (6 auth, 1 health, 2 business, 5 domain, 2 onboarding). 20 planned endpoints listed (auth extras, users, businesses CRUD, organizations, sessions).
- **Database:** Session model referenced for token storage.
- **Security:** Rate limiting planned but not implemented. Password complexity: 12+ chars.
- **Roadmap items:** Password change, password reset, email verification (Milestone 3 deferred). User/business/organization CRUD (Milestone 4).
- **Implementation status:** 6 endpoints marked "Working", 20 endpoints marked "Not Yet Implemented".

### `docs/AUTHENTICATION.md`

- **Important Decisions:** Dual-JWT system (access 15m, refresh 30d). Database-backed sessions with argon2 hash rotation. Generic error messages to prevent info leakage.
- **Architecture:** Passport JWT strategy. `JwtAuthGuard` for protected routes. `PasswordService` for argon2. `TokenService` for JWT. `SessionService` for DB operations.
- **Flows:** Registration (6-step transaction), Login (4-step), Refresh (10-step rotation), Logout (6-step revocation), /me (5-step lookup).
- **Security:** Comprehensive security measures table (9 implemented, 8 known gaps). Production requirements listed (7 items). CORS described as "too permissive" (outdated — now uses CORS_ORIGINS env var).
- **Configuration:** JWT_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL.
- **File Locations:** 13 files mapped with exact paths.

### `docs/DATABASE.md`

- **Database decisions:** PostgreSQL 17 via Docker. UUID primary keys. Soft delete pattern. Restrict delete on most foreign keys.
- **Models:** Organization, User, Business, BusinessDomain, Session, Invitation (planned), OnboardingProgress — 7 models documented.
- **Enums:** OrganizationStatus, BusinessStatus, UserRole, UserStatus, BusinessDomainStatus, OnboardingStatus, VerificationMethod, InvitationStatus (planned) — 8 enums documented.
- **Relationships:** 7 relationships documented with delete/update behavior.
- **Migrations:** 3 applied migrations documented. 1 planned (Milestone 4 — invitations).
- **Seed data:** 5 entities with exact IDs and values.
- **Future models:** KnowledgeSource, KnowledgeDocument, KnowledgeChunk, KnowledgeFAQ, Conversation, Message, AIAgent, SystemPrompt, Lead, Appointment, WidgetConfig, WidgetEmbed, AuditLog, Webhook, ApiKey — planned for Milestones 5-8.

### `docs/DECISIONS.md`

- **22 ADRs covering:**
  - ADR-001: Turborepo Monorepo
  - ADR-002: NestJS + Fastify
  - ADR-003: Prisma ORM
  - ADR-004: PostgreSQL
  - ADR-005: Multi-Tenant Organization Model
  - ADR-006: Business-First Registration
  - ADR-007: JWT Dual-Secret System
  - ADR-008: argon2 Password Hashing
  - ADR-009: DB-Backed Sessions
  - ADR-010: Class-Validator DTOs
  - ADR-011: Pino Structured Logging
  - ADR-012: Fastify-Native Security Middleware
  - ADR-013: Separate Access and Refresh Token TTLs
  - ADR-014: Global Prisma Client via NestJS Module
  - ADR-015: React 19 + Vite for Frontend
  - ADR-016: Inline Styles for Initial Frontend (Temporary)
  - ADR-017: Workspace-Level Registration Response
  - ADR-018: Application Layer Architecture
  - ADR-019: Business Onboarding Architecture
  - ADR-020: Domain Verification Strategy
  - ADR-021: Frontend Foundation
  - ADR-022: Frontend API Integration Pattern

### `docs/milestone-4a-findings.md`

- **Root causes evaluated:** 5 hypotheses (A-E), 1 confirmed (C — sidebar state), 4 refuted.
- **Fixes:** Responsive sidebar state (viewport listener), Form state re-sync bug (useRef guard).
- **Methodology:** Why A, B, D, E were refuted — evidence-based conclusions.
- **Definition of Done:** 13-item checklist, all passing.

### `docs/NEXT_STEPS.md`

- **Current milestone:** 4A Complete.
- **Next milestone:** 4B — Team Management & Polish (invitations, team management, logo upload).
- **Immediate task:** Design user invitation flow.
- **Future tasks:** 9 items (rate limiting, password change, CORS, parseTtlToSeconds, .env.example, logo upload, invitation emails, RBAC, Milestone 5).

### `docs/PROJECT_STATUS.md`

- **Project vision:** AI-powered business receptionist platform.
- **Tech stack:** 10 technology categories documented.
- **Monorepo structure:** apps (api, web, widget) + packages (database, types, utils, ui, core, ai-sdk, config).
- **API architecture:** Full folder structure of `apps/api/src/` with 15+ files.
- **Frontend architecture:** React Router, Zustand, TanStack Query, TailwindCSS, pages, components.
- **Database models:** 6 models with field-level detail.
- **Authentication status:** 12 capabilities (8 working, 4 not implemented).
- **Infrastructure status:** 12 components (9 working, 3 not implemented).
- **Milestone status:** 4 complete (1-4A), 1 in-progress (4B), 4 pending (5-8).
- **API endpoints:** 14 listed (actual: 15).
- **Environment variables:** 10 documented.
- **Technical debt:** 7 items.
- **Completion percentages:** Auth 100%, DB 45%, API 30%, Security 50%, Frontend 55%, Widget 0%, AI 0%, Testing 0%, DevOps 5%, Overall Backend ~35%.

### `docs/ROADMAP.md`

- **8 milestones:** Infrastructure (100%), Database (100%), Auth (100%), Business Onboarding (75%), Knowledge Engine (0%), AI Receptionist (0%), Widget (0%), Production (0%).
- **Milestone 4 detail:** 4 phases (Backend Foundation, Frontend Foundation, Onboarding Flow, Integration & Polish) with task-level checklists.
- **API endpoints for M4:** 8 endpoints listed.
- **Frontend pages for M4:** 5 pages listed.
- **Timeline estimates:** 4a-4d with day estimates.

### `docs/product-design/BUSINESS_ONBOARDING.md`

- **User journey:** 5-step flow (Welcome → Profile → Domain → Team → Complete).
- **Business requirements:** 15 functional (BR-01 to BR-15), 7 non-functional (NFR-01 to NFR-07).
- **System architecture:** Frontend (React Router + Zustand + TanStack Query) → API (NestJS modules) → Data (Prisma + PostgreSQL).
- **Domain verification:** DNS TXT (primary) + HTML meta tag (fallback) with detailed flow diagrams.
- **Database design:** Modified Business model, modified BusinessDomain, new Invitation, new OnboardingProgress.
- **APIs:** Business Profile (3 endpoints), Domain Management (5 endpoints), Team Invitations (5 endpoints), Onboarding Status (2 endpoints).
- **Frontend pages:** 7 pages with routes and descriptions.
- **Zustand stores:** Auth, Onboarding, UI store interfaces defined.
- **Milestone breakdown:** 4 phases, 4 sub-milestones, 10-14 day estimate.
- **Risks:** 5 technical, 3 product, 3 architecture risks.
- **Implementation checklist:** 30 backend items, 19 frontend items, 5 documentation items.

### `docs/product-discovery/ReplyIQ_PRD_v1.0.docx` and `docs/product-discovery/ReplyIQ_Product_Discovery_v0.1.docx`

- Binary .docx files. Cannot be parsed as text. Content is not auditable from the codebase.

### `packages/database/README.md`

- **Models listed:** Organization, User, Business, BusinessDomain — 4 models.
- **Enums listed:** OrganizationStatus, BusinessStatus, UserRole, UserStatus, BusinessDomainStatus — 5 enums.
- **Missing from README:** Session model, OnboardingProgress model, OnboardingStatus enum, VerificationMethod enum.

### `README.md` (root)

- **Tech stack:** Lists 10 technologies including "React Hook Form" and "pnpm v9+".
- **Getting started:** Prerequisites, install, dev, build, lint, format, clean commands.

---

## 3. Overlap Analysis

### High Overlap

| Document A | Document B | Overlapping Content |
|------------|------------|-------------------|
| `API_STATUS.md` | `PROJECT_STATUS.md` | API endpoint lists (14 vs 15 endpoints). Both list implemented and planned endpoints with routes and purposes. |
| `API_STATUS.md` | `AUTHENTICATION.md` | Auth endpoint details (register, login, refresh, logout, /me). API_STATUS has DTOs and response shapes; AUTHENTICATION has flow diagrams and security context. |
| `PROJECT_STATUS.md` | `ROADMAP.md` | Milestone status, completion percentages, feature checklists. Both track milestones 1-8 with status and % complete. |
| `PROJECT_STATUS.md` | `DATABASE.md` | Database model definitions. PROJECT_STATUS has simplified field tables; DATABASE has full schema with indexes and relationships. |
| `PROJECT_STATUS.md` | `BUSINESS_ONBOARDING.md` | Milestone 4 scope, API endpoints, frontend pages. PROJECT_STATUS tracks status; BUSINESS_ONBOARDING has full design. |
| `ROADMAP.md` | `BUSINESS_ONBOARDING.md` | Milestone 4 task breakdown, API endpoints, timeline. ROADMAP has checklist format; BUSINESS_ONBOARDING has full design with dependencies. |
| `DATABASE.md` | `BUSINESS_ONBOARDING.md` | Database models for onboarding. DATABASE has canonical schema; BUSINESS_ONBOARDING has proposed additions. |
| `DECISIONS.md` | `BUSINESS_ONBOARDING.md` | ADRs 019-022 appear in both — DECISIONS has the ADR records; BUSINESS_ONBOARDING has the design context. |
| `PROJECT_STATUS.md` | `NEXT_STEPS.md` | Next milestone, future tasks overlap. PROJECT_STATUS has broader context; NEXT_STEPS is action-oriented. |
| `README.md` | `PROJECT_STATUS.md` | Tech stack, monorepo structure. README is user-facing; PROJECT_STATUS is internal. |

### Moderate Overlap

| Document A | Document B | Overlapping Content |
|------------|------------|-------------------|
| `AUTHENTICATION.md` | `DECISIONS.md` | JWT dual-secret (ADR-007), argon2 (ADR-008), DB sessions (ADR-009). AUTHENTICATION has implementation detail; DECISIONS has rationale. |
| `DATABASE.md` | `DECISIONS.md` | PostgreSQL choice (ADR-004), Prisma choice (ADR-003), multi-tenant model (ADR-005). DATABASE has schema; DECISIONS has rationale. |
| `packages/database/README.md` | `DATABASE.md` | Model and enum lists. database/README is outdated (4 models, 5 enums); DATABASE.md is current (6+ models, 8 enums). |

### No Overlap

| Document | Unique Content |
|----------|---------------|
| `milestone-4a-findings.md` | Stabilization sprint root cause analysis — unique investigation methodology and fix details. |
| `NEXT_STEPS.md` | Immediate actionable tasks — operational focus not found elsewhere. |

---

## 4. Contradictions

### C1: Endpoint Count — PROJECT_STATUS.md vs Codebase

- **PROJECT_STATUS.md line 262-277:** Lists 14 implemented endpoints.
- **Codebase (domain.controller.ts:45):** Implements `DELETE /businesses/:businessId/domains/:domainId` — a 15th endpoint not in the PROJECT_STATUS table.
- **API_STATUS.md line 307-333:** Lists `DELETE /businesses/:id/domains/:domainId` as "Not Yet Implemented" under Milestone 4.
- **Contradiction:** The endpoint exists in code but is documented as not yet implemented in API_STATUS.md and missing from PROJECT_STATUS.md's working list.

### C2: Rate Limiting Scope — PROJECT_STATUS.md vs Implementation

- **PROJECT_STATUS.md line 216:** States `Rate Limiting | Working` (implying global coverage).
- **Implementation:** `ThrottlerGuard` applied only to 3 auth endpoints (`/auth/register`, `/auth/login`, `/auth/refresh`). The other 12 endpoints (business, domain, onboarding) have no throttling.
- **Contradiction:** "Working" is ambiguous — it works on 3/15 endpoints.

### C3: CORS Description — AUTHENTICATION.md vs Implementation

- **AUTHENTICATION.md line 341:** Lists CORS as `Enabled (too permissive)`.
- **Implementation (`main.ts:22-27`):** CORS uses `CORS_ORIGINS` env var, defaults to `http://localhost:5173`, parses comma-separated origins, and uses explicit origin (not wildcard).
- **PROJECT_STATUS.md line 232:** States `CORS | Working (explicit origins via CORS_ORIGINS env var)`.
- **Contradiction:** AUTHENTICATION.md says "too permissive" but the implementation uses explicit origins. PROJECT_STATUS.md is accurate; AUTHENTICATION.md is outdated.

### C4: React Hook Form — README.md vs Codebase

- **README.md line 39:** Lists "React Hook Form" in tech stack.
- **Codebase:** `react-hook-form` is not in any `package.json`. No imports of `useForm` or `useFormContext` exist anywhere. Forms use plain React controlled components.
- **Contradiction:** Documented technology is not installed or used.

### C5: pnpm Version — README.md vs package.json

- **README.md line 48:** States `pnpm v9+`.
- **package.json line 5:** `"packageManager": "pnpm@11.13.0"`.
- **PROJECT_STATUS.md line 21:** States `pnpm 11.13`.
- **Contradiction:** README.md says v9+; actual requirement is 11.13.0.

### C6: OnboardingProgress `teamInvited` Field — Design Doc vs Schema

- **BUSINESS_ONBOARDING.md lines 419-436:** Lists `teamInvited` (Boolean) and `teamInvitedAt` (DateTime?) on OnboardingProgress model.
- **Prisma schema (`schema.prisma:160-178`):** These fields do NOT exist.
- **DATABASE.md lines 262-287:** Correctly documents the model WITHOUT these fields.
- **Contradiction:** Design doc proposes fields that were deliberately omitted from the implementation.

### C7: `logoUrl` Field — Design Doc vs Schema

- **BUSINESS_ONBOARDING.md line 348:** Lists `logoUrl` as a proposed NEW field on Business model.
- **Prisma schema:** `logoUrl` does NOT exist.
- **DATABASE.md line 397:** Correctly states `logoUrl` is "Planned - Milestone 4B".
- **Not a hard contradiction** — design doc marks it as proposed, DATABASE.md marks it as planned. But the design doc presents it alongside already-implemented fields without clear status markers.

### C8: Onboarding Store — Design Doc vs Implementation

- **BUSINESS_ONBOARDING.md lines 810-827:** Plans an `onboarding.store.ts` Zustand store with `currentStep`, `profileCompleted`, `domainVerified`, `teamInvited`, etc.
- **Codebase:** `apps/web/src/stores/onboarding.store.ts` does NOT exist. Onboarding state is managed via TanStack Query hooks (server state) and component-local state.
- **Contradiction:** Designed store was never created. The onboarding works differently than designed.

### C9: `parseTtlToSeconds` Fallback Defaults — auth.service.ts vs workspace-provisioning.service.ts

- **auth.service.ts:293-314:** Fallback default on parse failure = `30 * 86400` (30 days = 2,592,000s).
- **workspace-provisioning.service.ts:190-204:** Fallback default on parse failure = `900` (15 minutes).
- **Contradiction:** Same function name, same logic, different fallback defaults. If TTL parsing fails, registration would set refresh token to 15 minutes while login would set it to 30 days.

### C10: Database Package README — Models Listed vs Actual

- **packages/database/README.md:** Lists 4 models (Organization, User, Business, BusinessDomain) and 5 enums.
- **Actual Prisma schema:** 6 models (+ Session, OnboardingProgress) and 8 enums (+ OnboardingStatus, VerificationMethod).
- **Contradiction:** `packages/database/README.md` is outdated and missing 2 models and 3 enums.

### C11: `.env.example` Completeness

- **`.env.example` line 1:** Contains only `DATABASE_URL`.
- **PROJECT_STATUS.md lines 308-319:** Documents 10 environment variables (DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, PORT, NODE_ENV, CORS_ORIGINS, RATE_LIMIT_TTL, RATE_LIMIT_MAX).
- **Contradiction:** `.env.example` is missing 9 of 10 required/optional variables.

### C12: Domain Endpoint Route Naming

- **API_STATUS.md lines 326-327:** Lists planned endpoints as `/businesses/:id/domains` and `/businesses/:id/domains/:domainId/verify`.
- **BUSINESS_ONBOARDING.md lines 553-561:** Lists endpoints as `/businesses/:businessId/domains` and `/businesses/:businessId/domains/:domainId/verify`.
- **ROADMAP.md lines 131-139:** Lists endpoints as `/businesses/:businessId/domains` (matching BUSINESS_ONBOARDING.md).
- **Actual implementation:** Uses `/businesses/:businessId/domains` (matching BUSINESS_ONBOARDING.md and ROADMAP.md).
- **Contradiction (minor):** API_STATUS.md uses `:id` param name while other docs use `:businessId`. The implementation uses `:businessId`.

---

## 5. Missing Documentation

### Critical Missing Areas

| Area | Why It's Needed |
|------|----------------|
| **API Reference (per-module)** | The empty `docs/api/` directory was planned to hold per-module API docs. Currently all API info is in a single monolithic `API_STATUS.md`. No OpenAPI/Swagger spec exists. |
| **Frontend Architecture** | No documentation of the React app structure, routing configuration, component hierarchy, store patterns, or API client implementation. Only scattered references in `PROJECT_STATUS.md` and `BUSINESS_ONBOARDING.md`. |
| **UI/UX Specifications** | No documentation of design system, component library, accessibility requirements, responsive breakpoints, or visual design language. The `docs/ui-ux/` directory doesn't exist. |
| **Infrastructure/DevOps** | No documentation of Docker Compose configuration, deployment strategy, CI/CD pipeline design, environment management, or production readiness checklist. The `docs/devops/` directory is empty. |
| **Security Documentation** | No standalone security doc. Security info is scattered across `AUTHENTICATION.md` (known gaps), `DECISIONS.md` (ADRs), and `PROJECT_STATUS.md` (status table). No threat model, no security policy, no OWASP checklist. |
| **Testing Strategy** | No documentation of testing approach, test structure, test frameworks, or coverage expectations. PROJECT_STATUS.md notes "Zero test files across entire repository." |
| **Developer Onboarding** | No guide for new developers to understand the codebase, architecture, conventions, or development workflow beyond the basic `README.md` setup commands. |
| **Changelog / Release Notes** | No changelog tracking what changed between milestones or versions. |

### Moderate Missing Areas

| Area | Why It's Needed |
|------|----------------|
| **Widget Documentation** | The `apps/widget` app is an empty scaffold with no design docs, architecture, or planned features beyond the ROADMAP.md bullet points. |
| **Knowledge Engine Design** | Milestone 5 has zero design documentation. ROADMAP.md lists features but no architecture, data model design, or API design. |
| **AI Receptionist Design** | Milestone 6 has zero design documentation. No LLM integration strategy, prompt engineering approach, or conversation flow design. |
| **Multi-tenant Data Isolation** | ADR-005 describes the model but there's no operational documentation of how `organizationId` filtering is enforced, middleware patterns, or audit procedures. |
| **Error Handling Conventions** | The GlobalExceptionFilter is referenced but no documentation of error codes, error response formats per module, or frontend error handling patterns. |
| **Environment Management** | No documentation of development vs staging vs production environments, configuration differences, or secrets management. |
| **Performance Considerations** | No documentation of expected load, response time targets, database query optimization patterns, or caching strategy. |

---

## 6. Recommended Mapping

### New Documentation Structure

```
docs/
├── 00-DOCUMENTATION-INDEX.md
├── product/
│   ├── VISION.md
│   ├── PRD.md
│   └── USER-JOURNEYS.md
├── flows/
│   ├── REGISTRATION.md
│   ├── LOGIN.md
│   ├── REFRESH.md
│   ├── ONBOARDING.md
│   └── DOMAIN-VERIFICATION.md
├── ui-ux/
│   ├── DESIGN-SYSTEM.md
│   ├── PAGE-SPECIFICATIONS.md
│   └── RESPONSIVE-BREAKPOINTS.md
├── architecture/
│   ├── OVERVIEW.md
│   ├── MONOREPO.md
│   ├── API-LAYER.md
│   ├── FRONTEND-LAYER.md
│   └── DATABASE-LAYER.md
├── api/
│   ├── AUTH.md
│   ├── BUSINESS.md
│   ├── DOMAIN.md
│   ├── ONBOARDING.md
│   └── OPENAPI.md
├── database/
│   ├── SCHEMA.md
│   ├── MODELS.md
│   ├── MIGRATIONS.md
│   └── SEED.md
├── security/
│   ├── AUTHENTICATION.md
│   ├── AUTHORIZATION.md
│   ├── THREAT-MODEL.md
│   └── PRODUCTION-REQUIREMENTS.md
├── infrastructure/
│   ├── DEVELOPMENT-SETUP.md
│   ├── DOCKER.md
│   ├── CI-CD.md
│   └── DEPLOYMENT.md
├── qa/
│   ├── TESTING-STRATEGY.md
│   └── REGRESSION-CHECKLIST.md
├── roadmap/
│   ├── ROADMAP.md
│   ├── CURRENT-STATUS.md
│   └── NEXT-STEPS.md
└── decisions/
    ├── ADR-INDEX.md
    └── ADR-*.md (individual files)
```

### Per-Document Mapping

| Existing Document | Recommended Action | Target Location | Rationale |
|-------------------|--------------------|-----------------|-----------|
| `docs/API_STATUS.md` | **SPLIT → REWRITE** | `api/AUTH.md`, `api/BUSINESS.md`, `api/DOMAIN.md`, `api/ONBOARDING.md` | Monolithic endpoint reference should be split by module. Current content is detailed and well-structured but needs updating (15 not 14 endpoints, route param naming fix). |
| `docs/AUTHENTICATION.md` | **REWRITE** | `security/AUTHENTICATION.md` + `flows/LOGIN.md`, `flows/REGISTRATION.md`, `flows/REFRESH.md` | Comprehensive but has outdated CORS claim (C3). Flow diagrams should be extracted to flows/. Security measures table should move to security/. |
| `docs/DATABASE.md` | **KEEP → MERGE** | `database/SCHEMA.md`, `database/MODELS.md`, `database/MIGRATIONS.md`, `database/SEED.md` | Accurate and well-structured. Split into focused files. Merge with `packages/database/README.md` (which is outdated). |
| `docs/DECISIONS.md` | **REWRITE** | `decisions/ADR-INDEX.md` + individual `decisions/ADR-*.md` files | Each ADR should be its own file for maintainability. Content is accurate but the single-file format doesn't scale. |
| `docs/milestone-4a-findings.md` | **ARCHIVE** | `qa/REGRESSION-CHECKLIST.md` (extract DoD) | Historical artifact. The Definition of Done checklist is reusable. Root cause analysis and fixes are valuable but time-bound to a specific sprint. |
| `docs/NEXT_STEPS.md** | **REWRITE** | `roadmap/NEXT-STEPS.md` | Content is accurate but time-sensitive. Should be reformatted as a living document with clear expiry. |
| `docs/PROJECT_STATUS.md` | **SPLIT → REWRITE** | `architecture/OVERVIEW.md`, `roadmap/CURRENT-STATUS.md`, `infrastructure/DEVELOPMENT-SETUP.md` | Monolithic status doc should be split. Architecture info → architecture/. Status tracking → roadmap/. Dev setup → infrastructure/. Fix endpoint count (C1) and rate limiting description (C2). |
| `docs/ROADMAP.md` | **KEEP** | `roadmap/ROADMAP.md` | Accurate, well-structured milestone plan. Minimal changes needed. |
| `docs/product-design/BUSINESS_ONBOARDING.md` | **MERGE → REWRITE** | `product/USER-JOURNEYS.md`, `flows/ONBOARDING.md`, `flows/DOMAIN-VERIFICATION.md`, `architecture/API-LAYER.md` | Comprehensive design doc but partially outdated (C6, C7, C8). Extract user journey to product/. Extract flows. Extract architecture decisions (already in DECISIONS.md as ADRs). Update to match implementation reality. |
| `docs/product-discovery/ReplyIQ_PRD_v1.0.docx` | **ARCHIVE** | `product/PRD.md` (convert to markdown) | Binary .docx is not version-control-friendly. Convert to markdown for the new system. |
| `docs/product-discovery/ReplyIQ_Product_Discovery_v0.1.docx` | **ARCHIVE** | `product/` (historical reference) | Earlier version of PRD. Archive as historical. |
| `README.md` (root) | **REWRITE** | Root `README.md` (updated) | Fix React Hook Form reference (C4), pnpm version (C5). Keep as project entry point. |
| `packages/database/README.md` | **REWRITE** | Merge into `database/SCHEMA.md` | Outdated (C10). Content is fully superseded by `docs/DATABASE.md`. |

### Mapping Summary

Note: `BUSINESS_ONBOARDING.md` is counted in both MERGE (content extracted into new files) and REWRITE (extracted content requires updating to match implementation reality). Total unique files = 13.

| Action | Count | Documents |
|--------|-------|-----------|
| **KEEP** | 1 | ROADMAP.md |
| **MERGE** | 2 | DATABASE.md (split + merge with packages/database/README.md), BUSINESS_ONBOARDING.md (extract into multiple new files) |
| **REWRITE** | 9 | API_STATUS.md, AUTHENTICATION.md, DECISIONS.md, PROJECT_STATUS.md, NEXT_STEPS.md, README.md, packages/database/README.md, plus BUSINESS_ONBOARDING.md (extracted content) |
| **ARCHIVE** | 3 | milestone-4a-findings.md, ReplyIQ_PRD_v1.0.docx, ReplyIQ_Product_Discovery_v0.1.docx |
| **Total (unique files)** | **13** | |

---

## 7. Existing Implementation Reality

### Documentation Says Implemented But Code Does NOT Support

| Document | Claim | Reality |
|----------|-------|---------|
| `API_STATUS.md:307-333` | `DELETE /businesses/:id/domains/:domainId` listed as "Not Yet Implemented" | **Implemented** in `domain.controller.ts:45` |
| `AUTHENTICATION.md:341` | CORS listed as "Enabled (too permissive)" | **Fixed** — CORS uses explicit origins via `CORS_ORIGINS` env var (`main.ts:22-27`) |
| `README.md:39` | "React Hook Form" in tech stack | **Not installed** — no `react-hook-form` in any `package.json`, no imports anywhere |
| `README.md:48` | "pnpm v9+" | **Wrong** — requires pnpm 11.13.0 per `packageManager` field in `package.json` |
| `packages/database/README.md` | Lists 4 models, 5 enums | **Outdated** — actual schema has 6 models and 8 enums |

### Code Exists But Documentation Does NOT Reflect

| Feature | Reality | Documented? |
|---------|---------|-------------|
| `DELETE /businesses/:businessId/domains/:domainId` endpoint | Implemented in `domain.controller.ts:45` | Missing from PROJECT_STATUS.md endpoint table. Listed as "Not Yet Implemented" in API_STATUS.md. |
| `ThrottlerGuard` on auth endpoints | Applied to `/auth/register`, `/auth/login`, `/auth/refresh` | PROJECT_STATUS.md says "Working" without scope limitation. API_STATUS.md has rate limiting as "Not implemented" (lines 352-363). |
| `RegisterPage.tsx` exists | Frontend has a registration page | Not listed in PROJECT_STATUS.md's frontend feature list or any docs. |

### Design Decisions Not Reflected in Code

| Designed (BUSINESS_ONBOARDING.md) | Reality |
|-----------------------------------|---------|
| `onboarding.store.ts` Zustand store | Never created. Onboarding state managed via TanStack Query + component state. |
| `teamInvited` / `teamInvitedAt` fields on OnboardingProgress | Not in Prisma schema. Deliberately deferred to Milestone 4B. |
| `logoUrl` field on Business model | Not in Prisma schema. Planned for Milestone 4B. |
| `TeamPage.tsx` frontend page | Does not exist. Planned for Milestone 4B. |
| `POST /businesses/:businessId/onboarding/complete` endpoint | Not implemented. Actual onboarding update uses `PATCH /businesses/:businessId/onboarding/steps`. |

### Inconsistencies Between Documentation and Code

| Area | Document Version | Code Reality |
|------|-----------------|--------------|
| `parseTtlToSeconds` defaults | Not documented (listed as tech debt in PROJECT_STATUS.md) | auth.service.ts defaults to 30d; workspace-provisioning.service.ts defaults to 15m — different behavior on parse failure |
| `.env.example` | Not documented as incomplete | Contains only `DATABASE_URL`; missing 9 other variables |
| OnboardingProgress model | DATABASE.md: no `teamInvited`. BUSINESS_ONBOARDING.md: has `teamInvited` | No `teamInvited` in schema |
| API route param naming | API_STATUS.md uses `:id`; BUSINESS_ONBOARDING.md uses `:businessId` | Implementation uses `:businessId` |

---

## Appendix: File Counts Summary

| Category | Count |
|----------|-------|
| Documentation files (`.md`) in `docs/` | 9 |
| Binary documents (`.docx`) in `docs/` | 2 |
| Empty placeholder directories in `docs/` | 6 |
| Documentation files outside `docs/` (with doc value) | 2 |
| **Total auditable documentation files** | **13** |

| Recommendation | Count | Note |
|----------------|-------|------|
| KEEP | 1 | ROADMAP.md |
| MERGE | 2 | DATABASE.md, BUSINESS_ONBOARDING.md |
| REWRITE | 9 | API_STATUS.md, AUTHENTICATION.md, DECISIONS.md, PROJECT_STATUS.md, NEXT_STEPS.md, README.md, packages/database/README.md, BUSINESS_ONBOARDING.md (extracted content) |
| ARCHIVE | 3 | milestone-4a-findings.md, ReplyIQ_PRD_v1.0.docx, ReplyIQ_Product_Discovery_v0.1.docx |
| **Total (unique files)** | **13** | BUSINESS_ONBOARDING.md counted in both MERGE and REWRITE |

| Contradiction | Severity |
|---------------|----------|
| C1: Missing endpoint from working list | Medium |
| C2: Rate limiting scope misleading | Medium |
| C3: CORS "too permissive" outdated | Low (already fixed) |
| C4: React Hook Form not installed | High (false documentation) |
| C5: pnpm version wrong | High (could cause setup failures) |
| C6: `teamInvited` field mismatch | Low (deliberate deferral) |
| C7: `logoUrl` field presentation | Low (proposed, not committed) |
| C8: Onboarding store never created | Medium (design vs reality) |
| C9: `parseTtlToSeconds` fallback mismatch | High (behavioral bug potential) |
| C10: Database README outdated | Medium (misleads contributors) |
| C11: `.env.example` incomplete | High (blocks new developers) |
| C12: Route param naming inconsistency | Low (cosmetic) |
