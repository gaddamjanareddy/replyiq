# ReplyIQ - Architectural Decisions

> Record of every architectural and technical decision. Each decision is immutable once accepted.

**Last Updated:** 2026-07-22

---

## ADR-001: Turborepo Monorepo

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
ReplyIQ has multiple apps (API, web, widget) and shared packages (database, types, utils, ui, config). A monorepo simplifies dependency management, shared configuration, and atomic commits across packages.

**Decision:**
Use Turborepo with pnpm workspaces as the monorepo tool.

**Reason:**
- Native pnpm workspace support
- Incremental builds and caching
- Task orchestration (build depends on ^build)
- Minimal configuration overhead

**Alternatives Considered:**
- Nx: Heavier, more opinionated, steeper learning curve
- Lerna: Deprecated in favor of Nx, less active maintenance
- Manual pnpm workspaces without build orchestration: No caching or parallel builds

**Consequences:**
- All packages must follow `@replyiq/` namespace convention
- Build order is managed by `turbo.json` task graph
- Dev scripts use `turbo dev` for parallel execution

---

## ADR-002: NestJS + Fastify

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need a backend framework that supports TypeScript, dependency injection, modular architecture, and high throughput.

**Decision:**
Use NestJS with Fastify adapter instead of Express.

**Reason:**
- NestJS provides structured modular architecture (modules, controllers, services, guards)
- Fastify offers significantly higher throughput than Express
- Native TypeScript support with decorators
- Built-in support for validation pipes, interceptors, filters
- Passport integration via `@nestjs/passport`

**Alternatives Considered:**
- Express (vanilla or with tRPC): Less structure, no DI, more boilerplate for large apps
- Fastify (standalone): Lacks NestJS's modular organization
- Hapi: Less TypeScript-first, smaller ecosystem

**Consequences:**
- Must use `@nestjs/platform-fastify` instead of default Express
- Fastify-specific APIs (reply instead of response)
- Helmet and CORS use Fastify-native packages

---

## ADR-003: Prisma ORM

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need a TypeScript-first ORM for PostgreSQL with type safety, migrations, and good developer experience.

**Decision:**
Use Prisma as the ORM.

**Reason:**
- Full type safety with auto-generated types
- Schema-first approach with visual documentation
- Built-in migration system
- Prisma Studio for database inspection
- Strong TypeScript inference in queries

**Alternatives Considered:**
- TypeORM: Decorator-based, less type safety, migration issues
- Drizzle: SQL-like API, less mature ecosystem, fewer conventions
- Knex.js (query builder): Not a full ORM, more manual work

**Consequences:**
- Schema is the source of truth (not code models)
- Generated client must be built before API can compile
- `prisma generate` runs as prebuild step in `@replyiq/database`
- Cannot use raw SQL patterns easily; must use Prisma query API

---

## ADR-004: PostgreSQL

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need a relational database that supports complex queries, JSON fields, full-text search, and can scale to production.

**Decision:**
Use PostgreSQL 17 as the database.

**Reason:**
- Mature, battle-tested relational database
- Excellent JSON/JSONB support for flexible schemas
- Full-text search capabilities (useful for knowledge engine later)
- UUID support native
- Strong Prisma support

**Alternatives Considered:**
- MySQL: Less feature-rich, no native JSON query support at same level
- SQLite: Not suitable for production multi-user workloads
- MongoDB: Document database, loses relational integrity for multi-tenant model

**Consequences:**
- Must have PostgreSQL available in dev (Docker Compose) and production
- UUID primary keys throughout (not auto-increment integers)
- All string fields have explicit VARCHAR length limits in schema

---

## ADR-005: Multi-Tenant Organization Model

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
ReplyIQ serves multiple businesses. Need to isolate data between tenants while allowing a single organization to own multiple businesses.

**Decision:**
Use Organization as the top-level tenant boundary. Organization has many Users and many Businesses.

**Reason:**
- A single company (Organization) may have multiple brands or divisions (Businesses)
- Users belong to an Organization and can manage any Business within it
- Data isolation is enforced by `organizationId` foreign keys
- Scales to multi-brand enterprises

**Alternatives Considered:**
- Business as tenant root: Simpler, but prevents multi-brand organizations
- Flat model without Organization: No user sharing across businesses
- Schema-per-tenant: Overengineered for current scale, complex migrations

**Consequences:**
- Every query that touches user data must filter by `organizationId`
- RBAC checks must verify user belongs to the same organization as the resource
- Registration always creates Organization + Business + Owner atomically

---

## ADR-006: Business-First Registration

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need an onboarding flow that gets businesses to value quickly. Registration should create everything needed to start using the platform.

**Decision:**
A single registration endpoint creates Organization, Business, Owner User, and Session in one database transaction.

**Reason:**
- Reduces onboarding friction (one form, one call)
- Guarantees data consistency (no orphaned records)
- User gets immediate access to their workspace
- Business name doubles as organization name (normalized)

**Alternatives Considered:**
- Multi-step registration: More fields collected upfront, but higher drop-off
- Separate org and business creation: Requires additional steps after signup
- Invite-only onboarding: Slower growth, requires admin flow first

**Consequences:**
- Organization name is derived from business name at registration
- Cannot create a User without an Organization
- Registration always assigns OWNER role
- Email uniqueness is global (not per-organization)

---

## ADR-007: JWT Dual-Secret System

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need separate signing secrets for access tokens and refresh tokens to limit damage from a compromised token.

**Decision:**
Use two separate JWT secrets: `JWT_SECRET` for access tokens and `JWT_REFRESH_SECRET` for refresh tokens.

**Reason:**
- If access token secret is leaked, refresh tokens remain secure
- Different TTLs require different token families
- Refresh tokens carry only `sub` and `sessionId` (minimal claims)
- Access tokens carry full context (email, org, role, session)

**Alternatives Considered:**
- Single secret: Simpler, but single point of compromise
- Opaque refresh tokens (no JWT): Requires full DB lookup on every refresh
- Symmetric HMAC with different keys: Same security, less standard than dual JWT secrets

**Consequences:**
- Both secrets must be configured in environment
- Refresh token verification uses the refresh-specific secret
- Access token payload includes: sub, email, organizationId, role, sessionId
- Refresh token payload includes: sub, sessionId only

---

## ADR-008: argon2 Password Hashing

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need a secure password hashing algorithm that is resistant to GPU-based attacks.

**Decision:**
Use argon2 for password hashing and refresh token hashing.

**Reason:**
- Winner of the Password Hashing Competition
- Memory-hard, resistant to GPU/ASIC attacks
- Recommended by OWASP
- Better security profile than bcrypt for modern hardware
- Default parameters are strong out of the box

**Alternatives Considered:**
- bcrypt: Widely used but not memory-hard, vulnerable to GPU attacks
- scrypt: Memory-hard but less audited than argon2
- PBKDF2: Not memory-hard, considered weak against modern attacks

**Consequences:**
- Requires native compilation (node-gyp) during install
- `argon2` listed as a build dependency in pnpm-workspace.yaml
- Refresh tokens are also hashed with argon2 (not just passwords)
- Hash comparison is CPU-intensive; rate limiting needed to prevent DoS

---

## ADR-009: DB-Backed Sessions

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need server-side session management to support token revocation, session tracking, and security auditing.

**Decision:**
Store sessions in the database with refresh token hash rotation.

**Reason:**
- Enables session revocation (logout, security incidents)
- Tracks session metadata (IP, user agent, last used)
- Refresh token rotation detects token theft (reuse detection possible)
- Expiry is enforced both in JWT and in DB

**Alternatives Considered:**
- Stateless JWT only (no DB sessions): Cannot revoke tokens, no session tracking
- Redis sessions: Adds infrastructure dependency, not needed at current scale
- Cookie-based sessions: Not suitable for SPA + API architecture

**Consequences:**
- Every refresh requires a DB lookup and update
- Expired sessions must be cleaned up periodically (cron job needed)
- Session table grows without cleanup mechanism (tech debt)
- `revokedAt` field exists; logout endpoint implemented (revokes session)

---

## ADR-010: Class-Validator DTOs

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need request validation that integrates with NestJS and provides clear error messages.

**Decision:**
Use class-validator decorators on DTO classes with NestJS `ValidationPipe`.

**Reason:**
- Native NestJS integration
- Decorator-based validation (declarative)
- Automatic transformation via class-transformer
- Whitelist mode strips unknown properties
- Transform mode auto-converts types

**Alternatives Considered:**
- Zod schemas: Used for env validation, but less NestJS-integrated for DTOs
- Joi: Less TypeScript-friendly, no decorator support
- Manual validation: Error-prone, no standardization

**Consequences:**
- Every request DTO must be a class with decorators
- `whitelist: true` strips unexpected fields
- `forbidNonWhitelisted: true` rejects requests with unknown fields
- `transform: true` auto-transforms payload to DTO instances

---

## ADR-011: Pino Structured Logging

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need structured logging that integrates with NestJS and supports JSON output in production.

**Decision:**
Use `nestjs-pino` with Pino as the logging backend.

**Reason:**
- Structured JSON logs in production
- Pretty-printed logs in development
- HTTP request/response logging built-in
- Minimal performance overhead (async logging)
- NestJS module integration via `LoggerModule`

**Alternatives Considered:**
- Winston: Heavier, more configuration needed
- NestJS built-in Logger: No structured output, no HTTP logging
- console.log: No structure, no levels, no production readiness

**Consequences:**
- All services should inject `Logger` from `nestjs-pino`
- Log levels controlled by environment
- Production logs are JSON (machine-parseable)
- Development logs are colorized and single-line

---

## ADR-012: Fastify-Native Security Middleware

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need security headers, CORS, and compression that work with Fastify.

**Decision:**
Use `@fastify/helmet`, `@fastify/cors`, and `@fastify/compress`.

**Reason:**
- Native Fastify plugins (better performance than Express middleware)
- Helmet sets security headers (CSP, HSTS, etc.)
- CORS configured at framework level with explicit allowed origins via `CORS_ORIGINS` env var
- Compression reduces response size

**Alternatives Considered:**
- Express middleware via Fastify adapter: Performance penalty
- Manual header setting: Error-prone, incomplete
- External API gateway: Adds infrastructure, overkill for current scale

**Consequences:**
- CORS configured with explicit origins from `CORS_ORIGINS` env var (default: `http://localhost:5173`)
- Helmet defaults are applied (no custom CSP yet)
- Compression is enabled for all responses

---

## ADR-013: Separate Access and Refresh Token TTLs

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Access tokens should be short-lived for security, refresh tokens long-lived for UX.

**Decision:**
Access tokens expire in 15 minutes, refresh tokens in 30 days. Both configurable via environment.

**Reason:**
- Short access tokens limit window of compromise
- Long refresh tokens avoid frequent re-login
- TTLs are configurable per environment
- DB sessions enforce expiry independently of JWT expiry

**Alternatives Considered:**
- Single long-lived token: High risk if compromised
- Single short-lived token: Poor UX, frequent re-authentication
- Sliding sessions: More complex, not needed at current scale

**Consequences:**
- Frontend must refresh tokens before 15m expiry
- Refresh flow must be reliable and fast
- Expired sessions accumulate in DB without cleanup
- `parseTtlToSeconds()` utility needed (currently duplicated)

---

## ADR-014: Global Prisma Client via NestJS Module

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need a single Prisma client instance shared across all NestJS modules.

**Decision:**
Create a global `DatabaseModule` that provides the Prisma client as `'PRISMA_CLIENT'` injection token.

**Reason:**
- Singleton Prisma client (prevents connection exhaustion)
- Global module means no per-module imports needed
- Consistent injection pattern (`@Inject('PRISMA_CLIENT')`)
- Prisma client is created in `@replyiq/database` package (shared with seed)

**Alternatives Considered:**
- Per-module Prisma instances: Connection pool exhaustion
- Request-scoped Prisma: Overhead of per-request instantiation
- Direct import without DI: Breaks NestJS patterns, harder to test

**Consequences:**
- All services must use `@Inject('PRISMA_CLIENT')` (not direct import)
- TypeScript requires `// eslint-disable-next-line` for value imports used in DI
- `PRISMA_CLIENT` token string must be consistent across all modules

---

## ADR-015: React 19 + Vite for Frontend

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need a modern frontend framework for the web dashboard.

**Decision:**
Use React 19 with Vite 6 and TypeScript.

**Reason:**
- React 19 with concurrent features
- Vite provides fast HMR and build
- TypeScript for type safety
- Large ecosystem for future component libraries
- Shared types via `@replyiq/types` package

**Alternatives Considered:**
- Next.js: SSR not needed for dashboard SPA, adds complexity
- Remix: Server-first model doesn't fit SPA dashboard
- Vue/Svelte: Smaller ecosystem, less TypeScript-first

**Consequences:**
- No server-side rendering (SPA only)
- React Router v7 added for client-side routing (see ADR-021)
- Zustand added for state management, TanStack Query for server state (see ADR-021)
- Token storage in localStorage (XSS risk, needs httpOnly cookies)

---

## ADR-016: Inline Styles for Initial Frontend

**Date:** 2026-07-18
**Status:** Accepted (Temporary)

**Context:**
Initial login page was built without a CSS framework to validate the API integration first.

**Decision:**
Use inline styles for the login page. Extract to component library later.

**Reason:**
- Fastest path to a working login form
- Validates API integration without CSS framework setup
- Tailwind config already exists in `@replyiq/config`

**Alternatives Considered:**
- Tailwind CSS from start: Adds setup time, delays API validation
- CSS modules: Adds file overhead for single-page prototype
- Styled-components: Runtime overhead, unnecessary dependency

**Consequences:**
- Login page must be refactored to use Tailwind or component library
- Inline styles are not maintainable at scale
- No responsive design yet
- No theme/branding system yet

---

## ADR-017: Workspace-Level Registration Response

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Registration creates multiple resources (Org, Business, User, Session). The response should reflect all created entities.

**Decision:**
Registration response includes `session`, `user`, `business`, and `organization` objects.

**Reason:**
- Frontend needs all IDs immediately (org ID for API calls, user for display)
- Tokens are returned alongside entity data (no separate login call needed)
- Consistent with the "complete workspace" concept

**Alternatives Considered:**
- Return only tokens (like login): Forces additional API calls to get entity data
- Return only entities (no tokens): Forces separate login call
- Return a flat structure: Loses the entity hierarchy

**Consequences:**
- Response shape differs from login response (workspace vs session only)
- Frontend can immediately populate workspace context after registration
- Business name is normalized (trimmed, single-spaced)

---

## ADR-018: Application Layer Architecture

**Date:** 2026-07-18
**Status:** Accepted

**Context:**
Need a scalable folder structure within the NestJS app that separates concerns.

**Decision:**
Use a layered architecture within `apps/api/src/`:
- `common/` -- Shared utilities (filters, pipes, decorators, types, constants)
- `infrastructure/` -- Technical concerns (security modules, session management)
- `shared/` -- Cross-cutting concerns (database module)
- `application/` -- Application-level orchestration (empty, reserved)
- `modules/` -- Feature modules (auth, health, users, identity)

**Reason:**
- Clear separation of concerns
- `common/` contains reusable, framework-agnostic code
- `infrastructure/` isolates technical implementation details
- `modules/` groups related controllers, services, DTOs
- `application/` reserved for use cases that span multiple modules

**Alternatives Considered:**
- Flat module structure: No separation, files grow unwieldy
- Hexagonal architecture: Overengineered for current scale
- Feature-only folders: Mixes technical and business concerns

**Consequences:**
- New features go in `modules/`
- New shared utilities go in `common/`
- New technical integrations go in `infrastructure/`
- `application/` is empty and reserved for future cross-module orchestration

---

## ADR-019: Business Onboarding Architecture

**Date:** 2026-07-22
**Status:** Accepted

**Context:**
After registration, businesses need a guided setup flow to complete their profile, verify domain ownership, and optionally invite team members. The onboarding flow must be modular, testable, and track progress across sessions.

**Decision:**
Create dedicated modules for Business, Domain, Invitation, and Onboarding concerns. Onboarding state tracked via `onboardingStatus` enum on Business model, with optional `OnboardingProgress` model for analytics.

**Reason:**
- Clear separation of concerns (each module independently testable)
- OnboardingProgress provides audit trail without complicating Business queries
- OnboardingStatus enum enables simple state machine logic
- Optional model allows team to skip if analytics not needed initially

**Alternatives Considered:**
- Single onboarding module handling all concerns: Tight coupling, hard to test
- State machine library (XState): Overengineered for current complexity
- Status field only (no OnboardingProgress): Loses audit trail and analytics

**Consequences:**
- Four new modules (Business, Domain, Invitation, Onboarding)
- Business model gains 5 new fields
- Two new models (Invitation, OnboardingProgress)
- Three new enums (OnboardingStatus, VerificationMethod, InvitationStatus)
- OnboardingProgress is optional; can be added later if needed

---

## ADR-020: Domain Verification Strategy

**Date:** 2026-07-22
**Status:** Accepted

**Context:**
Businesses must prove domain ownership before the AI Receptionist can operate on their website. Need a verification method that works for both technical and non-technical users.

**Decision:**
Support DNS TXT record (recommended) and HTML meta tag (fallback) for domain verification. Server-side verification only.

**Reason:**
- DNS TXT is industry standard (Google, Microsoft, Vercel use it)
- HTML meta tag is simpler for non-technical users (copy-paste a tag)
- Server-side avoids CORS and browser security restrictions
- Fallback approach maximizes verification success rate
- Verification token is generated server-side and stored in BusinessDomain

**Alternatives Considered:**
- File upload verification: Requires server access, more complex
- CNAME record: More complex DNS setup, less common for verification
- JavaScript snippet: Requires page load, slower, more fragile
- Client-side fetch: CORS issues, unreliable

**Consequences:**
- DNS verification uses `dns.resolveTxt()` from Node.js
- HTML meta verification uses server-side HTTP fetch + HTML parsing
- `_replyiq-verification.<domain>` subdomain required for DNS method
- Verification token is 32-byte random hex string
- Both methods checked on each verification attempt (try DNS first, then HTML)
- Rate limiting needed to prevent DNS lookup abuse

---

## ADR-021: Frontend Foundation

**Date:** 2026-07-22
**Status:** Accepted

**Context:**
The frontend currently has no routing, no state management, and only a login page. Onboarding requires multiple pages, protected routes, and shared state.

**Decision:**
Install React Router for routing and Zustand for client state management. TanStack Query for server state (API data fetching).

**Reason:**
- React Router is the standard for React SPAs (declared in ADR-015 as needed)
- Zustand is already in tech stack (ADR-015), lightweight, no boilerplate
- TanStack Query handles caching, loading states, refetching, and error handling
- Three libraries cover distinct concerns (routing, client state, server state)
- No overlap or conflict between the three

**Alternatives Considered:**
- Next.js router: Adds SSR complexity not needed for SPA dashboard
- Redux/Zustand only for server state: Duplicates TanStack Query functionality
- React Context for state: No devtools, no persistence, performance issues
- SWR instead of TanStack Query: Less features, smaller ecosystem

**Consequences:**
- Three new dependencies: react-router-dom, zustand, @tanstack/react-query
- Auth store manages tokens and user state (replaces localStorage direct access)
- Onboarding store tracks wizard progress (client-side only)
- API client utility wraps fetch with auth headers and token refresh
- ProtectedRoute component checks auth state before rendering
- Router configuration in separate `router.tsx` file

---

## ADR-022: Frontend API Integration Pattern

**Date:** 2026-07-22
**Status:** Accepted

**Context:**
Frontend pages need to fetch data from the backend API, handle loading states, errors, and cache invalidation. Need a consistent pattern across all pages.

**Decision:**
Use React Query hooks with a centralized `apiFetch` client. Each domain (business, domains, onboarding) gets its own hook file.

**Reason:**
- React Query handles caching, background refetching, and stale data automatically
- `apiFetch` wraps fetch with auth headers and automatic token refresh on 401
- Hook files group related queries and mutations (e.g., `useBusiness`, `useDomains`)
- Cache invalidation on mutations ensures UI stays in sync
- Loading/error states are handled per-query, not per-page

**Alternatives Considered:**
- Direct fetch in components: Duplicates auth logic, no caching
- SWR: Less features, smaller ecosystem than React Query
- Redux for server state: Overkill, duplicates React Query functionality
- React Context for API state: No caching, no background refetch

**Consequences:**
- `api/client.ts` handles auth headers and 401→refresh→retry
- `hooks/useBusiness.ts` exports all query/mutation hooks
- Each page uses `useQuery` for reads and `useMutation` for writes
- Mutations invalidate related query keys on success
- All endpoints use `api/v1` prefix consistently
