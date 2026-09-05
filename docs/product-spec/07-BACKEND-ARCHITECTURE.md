# 07 - Backend Architecture

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Tech Lead

## Overview

ReplyIQ backend is a NestJS monolith built on Fastify. It exposes a versioned REST API under `/api/v1`, uses Prisma for database access, and enforces multi-tenancy through `organizationId` filtering on all domain queries.

---

> ### Revision notice — 2026-09-05
>
> The domain-verification internals described here changed substantially.
> `16-DOMAIN-VERIFICATION-AND-TEST-MODE.md` is authoritative for verification
> mechanics; see `../CHANGES-2026-09-05.md` §4 for the full list, including the
> new `SANDBOX` and `DEV_BYPASS` methods, per-organization rate limiting, and
> the audit log.


## 1. Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | NestJS 11 |
| HTTP Adapter | Fastify |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (access + refresh), Argon2 |
| Validation | class-validator + Zod (env) |
| Security | Helmet, CORS, Throttler |

---

## 2. Project Structure

```
apps/api/src/
├── main.ts                         # Bootstrap
├── app.module.ts                   # Root module
├── config/
│   ├── configuration.ts            # Config factory
│   └── env.validation.ts           # Zod schema
├── common/
│   ├── constants/app.constants.ts  # APP_NAME, APP_VERSION
│   ├── types/                      # JwtPayload, RefreshTokenPayload
│   ├── filters/                    # GlobalExceptionFilter
│   ├── security/                   # PasswordService, TokenService
│   ├── decorators/index.ts         # Empty
│   ├── interceptors/index.ts       # Empty
│   └── pipes/index.ts             # Empty
├── infrastructure/
│   └── security/
│       ├── security.module.ts      # JwtModule + services
│       └── session/
│           ├── session.module.ts
│           └── session.service.ts
├── shared/
│   └── database/
│       └── database.module.ts      # Global PRISMA_CLIENT
├── application/index.ts            # Empty
└── modules/
    ├── auth/
    ├── health/
    ├── identity/                   # Empty
    ├── users/                      # Empty
    ├── business/
    ├── domain/
    └── onboarding/
```

---

## 3. Bootstrap

`main.ts` performs the following startup sequence:

1. Create NestJS application with `FastifyAdapter`
2. Register global `ValidationPipe` with `whitelist`, `transform`, `forbidNonWhitelisted`
3. Register global `GlobalExceptionFilter`
4. Enable `Helmet` for HTTP security headers
5. Configure CORS from environment
6. Enable response compression
7. Set global prefix `/api/v1`
8. Start listening on configured port

---

## 4. Module Dependency Graph

```
AppModule (root)
├── ConfigModule              (global)
├── ThrottlerModule           (global)
├── LoggerModule              (global)
├── DatabaseModule            (global - PRISMA_CLIENT)
├── HealthModule
├── AuthModule
│   └── SecurityModule
│       ├── JwtModule.registerAsync
│       ├── PasswordService
│       ├── TokenService
│       └── SessionModule
│           └── SessionService
├── IdentityModule            (empty stub)
├── UsersModule               (empty stub)
├── BusinessModule
├── DomainModule
└── OnboardingModule
```

### Module Responsibilities

| Module | Purpose |
|---|---|
| AppModule | Root composition, global imports |
| DatabaseModule | Global Prisma client injection |
| SecurityModule | JWT configuration, password hashing, token generation |
| SessionModule | Refresh token session lifecycle |
| AuthModule | Registration, login, logout, token refresh, current user |
| HealthModule | Liveness/readiness probe |
| BusinessModule | Business CRUD |
| DomainModule | Domain registration, DNS/HTML verification |
| OnboardingModule | Onboarding progress tracking |
| IdentityModule | Stub for future identity features |
| UsersModule | Stub for future user management |

---

## 5. Controllers and Endpoints

### 5.1 HealthController

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Returns application health status |

### 5.2 AuthController

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/auth/register` | ThrottlerGuard | Register new workspace (business + owner) |
| `POST` | `/auth/login` | ThrottlerGuard | Authenticate and receive tokens |
| `POST` | `/auth/refresh` | ThrottlerGuard | Exchange refresh token for new pair |
| `POST` | `/auth/logout` | JwtAuthGuard | Revoke session |
| `GET` | `/auth/me` | JwtAuthGuard | Return current authenticated user |

### 5.3 BusinessController

All routes prefixed with `/business`.

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/business/:businessId` | JwtAuthGuard (class) | Get business by ID |
| `PATCH` | `/business/:businessId` | JwtAuthGuard (class) | Update business |

### 5.4 DomainController

All routes prefixed with `/domains`.

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/domains` | JwtAuthGuard | List domains for current organization |
| `POST` | `/domains` | JwtAuthGuard | Register new domain |
| `POST` | `/domains/:domainId/verify` | JwtAuthGuard | Verify domain ownership |
| `DELETE` | `/domains/:domainId` | JwtAuthGuard | Remove domain |
| `GET` | `/domains/:domainId/verification-instructions` | JwtAuthGuard | Get verification steps |

### 5.5 OnboardingController

All routes prefixed with `/onboarding`.

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/onboarding` | JwtAuthGuard | Get onboarding progress |
| `PATCH` | `/onboarding/steps` | JwtAuthGuard | Update onboarding step |

---

## 6. Services

### 6.1 AuthService

| Method | Description |
|---|---|
| `login(dto)` | Validate credentials, create session, return token pair |
| `refresh(dto)` | Validate refresh token, rotate session, return new pair |
| `logout(dto)` | Revoke session |
| `getCurrentUser(userId)` | Fetch user profile by ID |

### 6.2 WorkspaceProvisioningService

| Method | Description |
|---|---|
| `register(dto)` | Transactional creation: Business record + owner User + initial session |

All steps execute within a single Prisma transaction. On failure, no partial records persist.

### 6.3 BusinessService

| Method | Description |
|---|---|
| `findById(id)` | Get business by ID (with org ownership check) |
| `update(id, dto)` | Partial update of business fields |

### 6.4 DomainService

All methods take `businessId` + `organizationId` and enforce tenant isolation via an internal `ensureAccess` check (business must exist, belong to the caller's organization, otherwise 404).

| Method | Description |
|---|---|
| `list(businessId, organizationId)` | List non-deleted domains for the business (primary first) |
| `create(businessId, organizationId, dto)` | Register new domain; enforces global uniqueness (409 on duplicate, including soft-deleted rows); generates verification token |
| `verify(businessId, domainId, organizationId, dto)` | Trigger verification (DNS TXT or HTML file). PENDING → 200 success message; mismatch → 400; success marks VERIFIED + updates onboarding progress |
| `getVerificationInstructions(businessId, domainId, organizationId, dto)` | Return per-method instructions (DNS record name/value or HTML file name/content) |
| `remove(businessId, domainId, organizationId)` | Soft delete (`deletedAt` set; row retained and still occupies the unique `domain` slot) |

### 6.5 DomainVerificationService

| Method | Description |
|---|---|
| `generateToken()` | Returns `replyiq-verify-{UUIDv4}` (cryptographically random, generated once per domain, never regenerated) |
| `getDnsTxtRecordName(domain)` | Returns `_replyiq-verification.{domain}` (canonical). `getLegacyDnsTxtRecordName(domain)` returns `_replyiq-challenge.{domain}`, still accepted on verification but never shown in instructions |
| `getHtmlMetaTag(token)` | Returns `<meta name="replyiq-verification" content="{token}">` — the primary placement |
| `getWellKnownPath()` | Returns `/.well-known/replyiq-verification.txt` |
| `getHtmlMetaFileName()` | Deprecated. Returns `replyiq-verification.html`, still accepted as a legacy placement |
| `getHtmlMetaContent(token)` | Returns `replyiq-verify:{token}` (expected exact file body) |
| `verifyDnsTxt(domain, token)` | `resolveTxt` lookup; record value must equal token exactly. Resolver failure → PENDING; reachable but mismatched → FAILED |
| `verifyHtmlMeta(domain, token)` | Under one 8-second budget: `GET https://{domain}/` (HTTP fallback), scan for `<meta name="replyiq-verification">`; if absent, try `/.well-known/replyiq-verification.txt` then `/replyiq-verification.html`. Any placement matching → VERIFIED; a placement present with a different value → MISMATCH; anything else, including every network-level failure and SSRF refusal → PENDING. See `16-DOMAIN-VERIFICATION-AND-TEST-MODE.md` §5 |
| `verifyDnsTxt(domain, token)` | Resolve TXT at the canonical then legacy name; each record compared individually, then jointly. Records present but non-matching → MISMATCH; unresolvable → PENDING |

**Security note:** `verifyHtmlMeta` performs no SSRF protections yet (no private/loopback IP blocking, no redirect cap, no response-size limit). Required hardening is specified in 12-SECURITY-MULTI-TENANCY.md §SSRF and tracked in 15-ROADMAP.md.

### 6.6 OnboardingService

| Method | Description |
|---|---|
| `getProgress(businessId, organizationId)` | Fetch current onboarding state incl. ordered steps array with completion flags |
| `updateStep(businessId, organizationId, step)` | Advance to PROFILE / FIRST_DOMAIN / DOMAIN_VERIFICATION / COMPLETE; server-enforced sequential gating with 400 errors ("Complete profile step first", "Add a domain first", "Verify a domain first") |

### 6.7 PasswordService (SecurityModule)

| Method | Description |
|---|---|
| `hash(password)` | Argon2 hash |
| `verify(password, hash)` | Argon2 verify |

### 6.8 TokenService (SecurityModule)

| Method | Description |
|---|---|
| `generateAccessToken(payload)` | Sign short-lived JWT |
| `generateRefreshToken(payload)` | Sign long-lived JWT |
| `verifyAccessToken(token)` | Verify and decode access token |
| `verifyRefreshToken(token)` | Verify and decode refresh token |

### 6.9 SessionService (SessionModule)

| Method | Description |
|---|---|
| `createSession(userId, organizationId)` | Create new session record |
| `findSessionById(sessionId)` | Lookup session |
| `rotateRefreshToken(sessionId)` | Invalidate old token, issue new one |
| `updateLastUsed(sessionId)` | Touch last-used timestamp |
| `revokeSession(sessionId)` | Soft-delete session |

---

## 7. DTOs

### 7.1 RegisterWorkspaceDto

| Field | Type | Validation | Required |
|---|---|---|---|
| `businessName` | string | Not empty | Yes |
| `ownerName` | string | Not empty | Yes |
| `email` | string | Valid email format | Yes |
| `password` | string | Min 12 chars, complexity (uppercase, lowercase, digit, special) | Yes |

### 7.2 LoginDto

| Field | Type | Validation | Required |
|---|---|---|---|
| `email` | string | Valid email format | Yes |
| `password` | string | Not empty | Yes |

### 7.3 RefreshTokenDto

| Field | Type | Validation | Required |
|---|---|---|---|
| `refreshToken` | string | Not empty | Yes |

### 7.4 UpdateBusinessDto

| Field | Type | Validation | Required |
|---|---|---|---|
| `name` | string | Not empty | No |
| `industry` | string | Not empty | No |
| `description` | string | Not empty | No |
| `websiteUrl` | string | Valid URL | No |

### 7.5 CreateDomainDto

| Field | Type | Validation | Required |
|---|---|---|---|
| `domain` | string | Regex validated (domain pattern) | Yes |
| `isPrimary` | boolean | - | No |

### 7.6 VerifyDomainDto

| Field | Type | Validation | Required |
|---|---|---|---|
| `method` | enum | `DNS_TXT` or `HTML_META` | Yes |

### 7.7 UpdateOnboardingDto

| Field | Type | Validation | Required |
|---|---|---|---|
| `step` | enum | `PROFILE`, `FIRST_DOMAIN`, `DOMAIN_VERIFICATION`, `COMPLETE` | Yes |

---

## 8. Guards

### 8.1 JwtAuthGuard

Extends Passport `AuthGuard('jwt')`.

- Applied to protected routes
- Extracts and validates access token from `Authorization: Bearer <token>` header
- Attaches decoded `JwtPayload` to `request.user`
- Returns 401 on missing/invalid/expired token

### 8.2 ThrottlerGuard

From `@nestjs/throttler`.

- Applied to auth endpoints only (`register`, `login`, `refresh`)
- Prevents brute-force attacks
- Default: 10 requests per 60-second window per IP
- Returns 429 on limit exceeded

### 8.3 RolesGuard and OrganizationGuard (created, NOT wired)

Both classes exist in `apps/api/src/modules/auth/guards/` but are **not applied to any controller** (`@UseGuards(RolesGuard | OrganizationGuard)` appears nowhere) and the `@Roles()` decorator is never used on an endpoint. `OrganizationGuard` is additionally a stub whose `canActivate` always returns `true`.

- Effective authorization model today: authentication via `JwtAuthGuard`; tenant isolation enforced inside service methods (`ensureAccess`-style checks returning 404 on cross-org access); no role enforcement anywhere.
- Wiring them into the pipeline is tracked in 12-SECURITY-MULTI-TENANCY.md §4–5 and 15-ROADMAP.md. Status: [PARTIALLY IMPLEMENTED].

---

## 9. Filters

### 9.1 GlobalExceptionFilter

Registered globally at bootstrap.

**Behavior:**

- Catches all unhandled exceptions
- Returns consistent JSON response:

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

- Maps known exceptions to appropriate status codes:
  - `NotFoundException` → 404
  - `UnauthorizedException` → 401
  - `ForbiddenException` → 403
  - `BadRequestException` → 400
  - `ConflictException` → 409
  - `ValidationException` → 422

---

## 10. Validation

Two validation layers operate independently:

### 10.1 Request Validation (Runtime)

- **Global ValidationPipe** with `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`
- Strips unknown properties from incoming DTOs
- Auto-transforms payloads to DTO class instances
- Rejects requests with undeclared fields

### 10.2 Environment Validation (Startup)

- **Zod schema** in `env.validation.ts`
- Validates 10 environment variables, 3 required
- Application fails to start on invalid config
- Prevents runtime crashes from missing configuration

---

## 11. Authentication and Authorization

### 11.1 Authentication Flow

```
Client                    API                       Database
  │                        │                          │
  ├─POST /auth/login──────>│                          │
  │                        ├─verify credentials──────>│
  │                        │<──user record────────────│
  │                        ├─create session──────────>│
  │                        │<──session record─────────│
  │                        ├─generate token pair       │
  │<─{accessToken,refresh}─┤                          │
  │                        │                          │
  ├─GET /business/:id─────>│                          │
  │  (Authorization: Bearer)                          │
  │                        ├─JwtAuthGuard validates    │
  │                        ├─extract userId            │
  │                        ├─query with org filter───>│
  │<─{data}────────────────┤<──results────────────────│
```

### 11.2 Token Structure

**Access Token (JwtPayload):**

```typescript
{
  sub: string;       // User ID
  email: string;
  organizationId: string;
  iat: number;
  exp: number;
}
```

**Refresh Token (RefreshTokenPayload):**

```typescript
{
  sub: string;       // User ID
  sessionId: string;
  iat: number;
  exp: number;
}
```

### 11.3 Token Lifecycle

1. Login → access token (15min) + refresh token (30d, `REFRESH_TOKEN_TTL`)
2. Each request with access token is validated via `JwtStrategy`
3. Refresh → rotate refresh token, issue new pair
4. Logout → revoke session in database
5. Refresh token single-use: rotation invalidates previous token

---

## 12. Multi-Tenancy

### 12.1 Model

All domain entities include an `organizationId` foreign key. Every service method that queries domain data filters by `organizationId` extracted from the authenticated user's JWT payload.

### 12.2 Enforcement

- `JwtStrategy.validate()` attaches `organizationId` from token to `request.user`
- Services accept `organizationId` as a parameter (never trust client-supplied values)
- Prisma queries always include `where: { organizationId }` for tenant-scoped tables
- Business ownership is verified by matching `user.organizationId` to the requested `businessId`

### 12.3 Tenant-Scoped Entities

| Entity | Relationship |
|---|---|
| Business | 1:1 with Organization |
| Domain | N:1 with Organization |
| User | N:1 with Organization |
| OnboardingProgress | 1:1 with Organization |
| Session | N:1 with User (user belongs to Organization) |

---

## 13. Rate Limiting

| Endpoint Group | Window | Max Requests |
|---|---|---|
| `POST /auth/register` | 60s | 10 |
| `POST /auth/login` | 60s | 10 |
| `POST /auth/refresh` | 60s | 10 |

All other endpoints are unprotected by throttling. Rate limit key is client IP address.

Response on limit exceeded:

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

---

## 14. Sessions

### 14.1 Storage

Sessions are persisted in the database (managed by Prisma). Each session tracks:

| Field | Purpose |
|---|---|
| `id` | Session identifier |
| `userId` | Owner |
| `refreshTokenHash` | Hashed refresh token |
| `lastUsedAt` | Last activity timestamp |
| `createdAt` | Session creation |
| `expiresAt` | Absolute expiration |

### 14.2 Lifecycle

1. **Create** — On successful login/registration
2. **Rotate** — On refresh: invalidate old token, issue new one
3. **Touch** — On each authenticated request: update `lastUsedAt`
4. **Revoke** — On explicit logout

---

## 15. Configuration

### 15.1 Configuration Factory

`configuration.ts` exports a factory function consumed by `ConfigModule.forRoot()`.

### 15.2 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Signing key for JWTs |
| `JWT_EXPIRATION` | Yes | Access token lifetime |
| `PORT` | No | Server port (default: 3000) |
| `CORS_ORIGINS` | No | Allowed origins |
| `NODE_ENV` | No | Environment identifier |
| `LOG_LEVEL` | No | Logging verbosity |
| `THROTTLE_TTL` | No | Rate limit window (ms) |
| `THROTTLE_LIMIT` | No | Rate limit max requests |
| `REFRESH_TOKEN_SECRET` | No | Separate signing key for refresh tokens |

### 15.3 Validation Strategy

- **Zod** validates env vars at startup (`env.validation.ts`)
- Application refuses to boot if required vars are missing
- `ConfigurationFactory` provides typed access throughout the application

---

## 16. Security

### 16.1 Password Hashing

- **Argon2** (via `PasswordService`)
- Minimum 12-character password requirement
- Complexity: uppercase, lowercase, digit, special character

### 16.2 JWT Security

- Access tokens: short-lived (15 min default)
- Refresh tokens: longer-lived (30 days default via `REFRESH_TOKEN_TTL`), single-use via rotation
- Tokens signed with `HS256` using `JWT_SECRET`
- Refresh token hash stored in database (never raw token)

### 16.3 HTTP Security

- **Helmet** middleware: sets security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- **CORS**: configurable allowed origins
- **Compression**: gzip/deflate for response bodies

### 16.4 Input Security

- `whitelist: true` strips undeclared properties
- `forbidNonWhitelisted: true` rejects requests with unknown fields
- Regex validation on domain inputs
- Parameterized Prisma queries prevent SQL injection

---

## 17. API Versioning

All endpoints are served under a global prefix:

```
/api/v1/<resource>
```

Set via `app.setGlobalPrefix('api/v1')` in `main.ts`.

Current resources:

```
/api/v1/health
/api/v1/auth/*
/api/v1/business/*
/api/v1/domains/*
/api/v1/onboarding/*
```

---

## 18. Error Handling

### 18.1 Global Exception Filter

All unhandled exceptions flow through `GlobalExceptionFilter`, which:

1. Logs the error with context
2. Maps exception type to HTTP status code
3. Returns uniform JSON response

### 18.2 Response Format

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

### 18.3 Exception Mapping

| Exception | Status Code |
|---|---|
| `ValidationException` | 422 |
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `ThrottlerException` | 429 |
| Unhandled | 500 |

---

## 19. Dependency Injection

NestJS modules declare providers and exports. Key injection tokens:

| Token | Source | Scope |
|---|---|---|
| `PRISMA_CLIENT` | DatabaseModule | Global |
| `JwtService` | SecurityModule (JwtModule) | SecurityModule |
| `PasswordService` | SecurityModule | SecurityModule |
| `TokenService` | SecurityModule | SecurityModule |
| `SessionService` | SessionModule | SessionModule |

All services are request-scoped or transient by default. Singleton scope is used for infrastructure services.

---

## 20. Empty Stubs

The following modules are declared but contain no controllers, services, or logic:

- **IdentityModule** — Reserved for future identity management features (SSO, OAuth providers)
- **UsersModule** — Reserved for future user management endpoints (list users, invite, roles)

These stubs are included in `AppModule` imports to maintain architectural consistency and signal intended expansion points.
