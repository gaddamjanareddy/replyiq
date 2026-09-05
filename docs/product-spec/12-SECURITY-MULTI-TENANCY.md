# 12. Security and Multi-Tenancy

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Tech Lead

---

> ### Revision notice — 2026-09-05
>
> Domain verification changed substantially in this revision. Where anything
> below describes verification mechanics, **`16-DOMAIN-VERIFICATION-AND-TEST-MODE.md`
> is authoritative** and this document is a secondary account.
>
> What changed, in short:
> - The website method checks a homepage `<meta name="replyiq-verification">`
>   tag first, with `/.well-known/replyiq-verification.txt` and the legacy
>   `/replyiq-verification.html (legacy; the meta tag is now the primary placement)` accepted as equivalent alternatives (D-01R).
> - The DNS record is `_replyiq-verification.{domain}`; `_replyiq-verification.{domain}`
>   is still accepted but never shown.
> - Verification has **three** outcomes, not two: verified, *not found yet*
>   (pending, retryable, normal), and *found but does not match* (mismatch).
> - A third method, **`SANDBOX`**, verifies IANA-reserved test domains instantly
>   in every environment including production, and is refused for any real
>   domain (D-04R).
> - Deleting the last verified domain is **allowed with explicit
>   acknowledgement** rather than blocked (D-06R).
>
> Full rationale: `../CHANGES-2026-09-05.md`.


## 1. Authentication System Design

ReplyIQ uses a dual JWT authentication system with database-backed sessions. Authentication is handled through the `AuthModule`, which coordinates password verification, token issuance, and session management.

### Authentication Flow

1. User submits email and password
2. `AuthService.validateUser` hashes the provided password with argon2 and compares against the stored hash
3. On success, `AuthService.login` issues an access token (15m) and a refresh token (30d)
4. The refresh token hash is stored in the `Session` table and rotated on each refresh
5. On logout, the session is revoked by setting `revokedAt = now()` (the row is retained for audit; it is NOT deleted)

### Endpoints

| Endpoint | Method | Rate Limit | Purpose |
|---|---|---|---|
| `/api/v1/auth/register` | POST | 10 req / 60s | Create new account |
| `/api/v1/auth/login` | POST | 10 req / 60s | Authenticate and issue tokens |
| `/api/v1/auth/refresh` | POST | 10 req / 60s | Rotate refresh token, issue new access token |
| `/api/v1/auth/logout` | POST | None | Revoke session |

---

## 2. Password Hashing

Passwords are hashed using **argon2** (memory-hard, GPU-resistant) via the `argon2` npm package.

**Parameters:** Default argon2 configuration (no custom parameters set).

**Password Complexity Requirements:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Validation:** Enforced at the DTO level via `class-validator` decorators on `RegisterDto`.

**Note:** The same argon2 function is used for hashing refresh tokens before storage in the `Session` table.

**Gap:** Default argon2 parameters are not tuned for the production server's memory/CPU profile. Should be benchmarked and configured explicitly (memory cost, time cost, parallelism).

---

## 3. JWT System

### Access Token

| Property | Value |
|---|---|
| Algorithm | HS256 |
| TTL | 15 minutes |
| Secret | `JWT_SECRET` environment variable |
| Payload | `sub` (user ID), `email`, `organizationId`, `role`, `sessionId` |

### Refresh Token

| Property | Value |
|---|---|
| Algorithm | HS256 |
| TTL | 30 days |
| Secret | `JWT_REFRESH_SECRET` environment variable |
| Payload | `sub` (user ID), `sessionId` |

### Design Decisions

- **Separate secrets** for access and refresh tokens prevent a compromised access token secret from enabling refresh token forgery.
- **Minimal refresh token payload** limits exposure if the token is intercepted.
- **Session ID in both tokens** enables server-side session revocation.

### Gap

Tokens are signed with HS256 (symmetric). For a microservice architecture or third-party verification, RS256 (asymmetric) would be preferable. Current monolithic deployment makes HS256 acceptable.

---

## 4. Refresh Tokens and Session Management

### Session Model

```
Session {
  id: UUID (primary key)
  userId: UUID (FK to User)
  refreshTokenHash: string (argon2 hash)
  expiresAt: DateTime
  createdAt: DateTime
  ip: string (nullable, NOT populated)
  userAgent: string (nullable, NOT populated)
}
```

### Token Rotation

On each `/api/v1/auth/refresh` call:
1. The incoming refresh token is verified against the JWT
2. The `sessionId` from the token is used to look up the session
3. The incoming token hash is compared against the stored `refreshTokenHash`
4. If valid, a new refresh token is issued and the old one is replaced (hash rotation)
5. A new access token is issued

### Session Revocation

- On logout, the session's `revokedAt` is set (soft revocation; the row remains in the database and refresh attempts against it fail with "Session has been revoked")
- Subsequent refresh attempts with the rotated token will fail because the session no longer exists

### Known Gaps

1. **IP and userAgent fields exist in the schema but are never populated.** Sessions are not bound to the originating client.
2. **No session cleanup.** Expired sessions accumulate in the database indefinitely.
3. **No concurrent session limit.** A user can have unlimited active sessions.
4. **No session invalidation on password change.** Changing a password does not revoke existing sessions.

---

## 5. Security Headers

Implemented via `@fastify/helmet`:

- **Content-Security-Policy (CSP):** Default policy applied
- **Strict-Transport-Security (HSTS):** Enforces HTTPS
- **X-Content-Type-Options:** `nosniff`
- **X-Frame-Options:** `DENY`
- **X-XSS-Protection:** Enabled (legacy browsers)
- **Referrer-Policy:** Default
- **Permissions-Policy:** Default

`@fastify/compress` is also enabled for response compression.

**Gap:** CSP policy is not customized for the widget embed scenario. If the widget is embedded in customer sites, the CSP may need `frame-src` or `connect-src` directives configured per-deployment.

---

## 6. CORS Configuration

| Property | Value |
|---|---|
| Origins | Explicit list via `CORS_ORIGINS` env var |
| Credentials | Enabled |
| Methods | Configured explicitly |
| Wildcard | NOT used |

**Implementation:** `@fastify/cors` with `origin` set to the parsed `CORS_ORIGINS` value.

**Gap:** No dynamic origin validation based on organization configuration. All deployments share the same CORS origin list.

---

## 7. CSRF Protection

**Status: NOT IMPLEMENTED.**

Current authentication relies on Bearer tokens in the `Authorization` header. The frontend stores tokens in `localStorage`.

### Risk Assessment

- **localStorage + Bearer tokens:** Vulnerable to XSS. If an attacker injects script, they can read `localStorage` and exfiltrate tokens.
- **No CSRF middleware:** If tokens were moved to cookies, the application would be vulnerable to CSRF without additional protections.

### Required Actions

1. Either move tokens to `httpOnly` cookies and add CSRF token validation, or
2. Accept the XSS risk from localStorage and harden XSS prevention comprehensively

**Recommendation:** Implement `httpOnly` cookies for refresh tokens with `SameSite=Strict` and a CSRF token pattern for state-changing requests.

---

## 8. XSS Prevention

### Current Protections

- `@fastify/helmet` sets `X-XSS-Protection` header
- Helmet's CSP is active (default policy)
- Backend uses `class-validator` for input validation

### Gaps

- **No DOMPurify or equivalent** for sanitizing rendered content on the frontend
- **Widget renders user-controlled content** (business names, domain names) without explicit sanitization
- **No `httpOnly` cookies** means token theft is trivial via XSS
- **localStorage is accessible** to any JavaScript on the page

### Required Actions

1. Sanitize all user-generated content rendered in the widget
2. Implement CSP nonce-based script loading
3. Move tokens to `httpOnly` cookies
4. Add frontend XSS audits

---

## 9. Rate Limiting

### Current Implementation

`@nestjs/throttler` is applied at the module level to `AuthModule`:

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/v1/auth/register` | 10 requests | 60 seconds |
| `POST /api/v1/auth/login` | 10 requests | 60 seconds |
| `POST /api/v1/auth/refresh` | 10 requests | 60 seconds |

### Gaps

1. **Only 3 of 15 endpoints are rate-limited.** All business/onboarding/widget endpoints are unprotected.
2. **10 requests per 60 seconds is too permissive for login.** Brute force is feasible.
3. **No IP-based rate limiting.** A single attacker can distribute requests across accounts.
4. **No progressive delay or lockout.** Repeated failures have no escalating consequences.
5. **Throttler uses in-memory storage by default.** Rate limit state does not survive restarts and is not shared across instances.

### Required Rate Limits for Production

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/v1/auth/login` | 5 requests | 15 minutes |
| `POST /api/v1/auth/register` | 10 requests | 1 hour |
| `POST /api/v1/auth/refresh` | 20 requests | 15 minutes |
| All other POST/PUT/DELETE | 30 requests | 60 seconds |
| Widget API (unauthenticated) | 60 requests | 60 seconds per domain |

---

## 10. RBAC (Role-Based Access Control)

### Current State

Roles are stored in the JWT payload (`role` field) and in the `User` table. The `JwtAuthGuard` validates token authenticity but **does not enforce role-based authorization.**

### Available Roles (from schema)

The `UserRole` enum in `packages/database/prisma/schema.prisma` defines exactly three roles:

- `OWNER`
- `ADMIN`
- `MANAGER`

(Earlier revisions of this spec listed MEMBER/VIEWER; those values do not exist in the schema.)

### Enforcement

**Status: IMPLEMENTED (hardening loop 2026-08-24, per D-07).** `RolesGuard` + `@Roles()` are wired on all resource controllers; every mutating business endpoint (business PATCH, onboarding steps, domain create/verify/delete) requires `OWNER` or `ADMIN`. Read endpoints remain available to any authenticated role. The permissions matrix in §10 is enforced server-side only.

`RolesGuard` (`apps/api/src/modules/auth/guards/roles.guard.ts`) reads the JWT `role` claim and compares it against route-level `@Roles()` metadata via Reflector. Coverage is verified by unit tests (`roles.guard.test.ts`).

### Required Implementation

1. Create a `RolesGuard` that reads the `role` from the JWT and compares against route-level `@Roles()` decorators
2. Define role permissions matrix - **APPROVED (D-07)**, remapped to the actual `UserRole` enum (OWNER/ADMIN/MANAGER only; MEMBER/VIEWER do not exist in schema):

| Resource / Action | OWNER | ADMIN | MANAGER |
|---|---|---|---|
| Business profile (read) | Yes | Yes | Yes |
| Business profile (update) | Yes | Yes | No |
| Domains (read/list/instructions) | Yes | Yes | Yes |
| Domains (create/verify/delete) | Yes | Yes | No |
| Onboarding progress (read) | Yes | Yes | Yes |
| Onboarding steps (advance/complete) | Yes | Yes | No |
| Own session (refresh/logout/me) | Yes | Yes | Yes |
| Users (invite/remove/role mgmt) | Planned M5+ | Planned M5+ | No |

Enforcement is server-side only (`RolesGuard` + `@Roles()` on every protected endpoint); frontend route hiding is never a control.

3. Apply `@Roles()` decorators to all controller methods
4. Integrate `RolesGuard` into the NestJS guard pipeline

> Reconciliation note: steps 1 and 4 are half-done in code â€” the guard class exists but is unwired. The permissions matrix above must be remapped to the actual OWNER/ADMIN/MANAGER enum before wiring; MEMBER/VIEWER columns are aspirational only.

---

## 11. Organization Isolation (Multi-Tenancy)

### Tenant Boundary

The **Organization** is the primary tenant boundary. Every user belongs to exactly one organization. Every business, domain, and onboarding record belongs to an organization.

### Schema Relationships

```
Organization
  â””â”€â”€ User (organizationId)
  â””â”€â”€ Business (organizationId)
        â””â”€â”€ BusinessDomain (businessId)
        â””â”€â”€ OnboardingProgress (businessId)
```

### Enforcement Mechanism

- **JWT carries `organizationId`**: Set during login from the user's `organizationId` field
- **JwtAuthGuard validates access**: Ensures the token is valid and not expired
- **Service-level filtering**: All service methods accept `organizationId` as a parameter and include it in database queries

### Critical Gap

**Status: RESOLVED (hardening loop 2026-08-24).** The former stub `OrganizationGuard` has been replaced with a real tenant guard: it loads the business's `organizationId` from the database (via Prisma) and compares it against the JWT claim, rejecting mismatches with a coded 403 (`AUTHZ_FORBIDDEN`). It is applied to all resource controllers (`business`, `onboarding`, `domains`), and the service-level `ensureAccess` pattern remains as defense in depth. Malformed UUID route parameters are rejected before any query runs.

Remaining hardening options documented below (TenantScopeInterceptor, Prisma middleware / row-level security, full query audit) are future work and were not part of the approved D-01..D-07 scope.

### Required Implementation

1. Create an `OrganizationGuard` that extracts `organizationId` from the JWT and attaches it to the request context
2. Create a `TenantScopeInterceptor` that automatically injects `organizationId` into all Prisma queries
3. Use Prisma middleware or row-level security to enforce `organizationId` at the database layer
4. Audit every existing query for correct `organizationId` filtering

---

## 12. Business Isolation

Within an organization, businesses are isolated by `businessId`. This is a secondary isolation boundary.

### Enforcement

- `businessId` is present on `BusinessDomain` and `OnboardingProgress`
- Service methods filter by `businessId` when querying business-specific data
- The widget API uses domain lookup to resolve `businessId`

### Gap

Same as organization isolation: no middleware enforces `businessId` filtering. Service-level compliance must be verified per endpoint.

---

## 13. API Authorization

### Authenticated Endpoints

All `/api/*` endpoints except `/api/v1/auth/login`, `/api/v1/auth/register`, and `/api/v1/auth/refresh` require a valid JWT via `JwtAuthGuard`.

### Widget API

The widget API (`/api/widget/*`) uses domain-based resolution, not JWT authentication:

1. The widget sends the host page's domain
2. The API looks up the domain in `BusinessDomain`
3. Associated business and onboarding data are returned

### Gap

- **No API key authentication for the widget.** Any client can call the widget API by sending a valid domain string.
- **No request signing.** Widget requests are not signed or HMAC'd.
- **Domain spoofing risk.** An attacker can send arbitrary domain values to enumerate businesses.

### Required Implementation

1. Issue API keys per business for widget authentication
2. Validate the `Origin` header on widget requests against the registered domain
3. Implement request signing for widget-to-server communication

### Outbound Verification Fetches (SSRF Hardening) - APPROVED (D-01), P0

`DomainVerificationService.verifyHtmlMeta` fetches a URL derived from **user-controlled input** (`http://{domain}/replyiq-verification.html (legacy; the meta tag is now the primary placement)`). As implemented it has only a 5-second timeout; it performs **no SSRF protections**. Because the fetch is authenticated-user-triggered and the resolved target is server-side, this must be hardened before any production deployment:

| # | Control | Status |
|---|---|---|
| 1 | Scheme allowlist: `http`/`https` only (no `file:`, `gopher:`, etc.) | PARTIAL (URL is constructed server-side, scheme fixed to `http`) |
| 2 | DNS resolution pinned: resolve once, connect to the resolved IP; reject private ranges (`10/8`, `172.16/12`, `192.168/16`), loopback (`127/8`, `::1`), link-local (`169.254/16`, `fe80::/10`), and unique-local addresses | MISSING |
| 3 | Redirect handling: disable or cap redirects (â‰¤3), re-validating each hop's IP against control 2 | MISSING |
| 4 | Response size limit (e.g., â‰¤64 KB) â€” read then discard beyond the cap | MISSING |
| 5 | Timeout: â‰¤5 seconds total (AbortController) | IMPLEMENTED |
| 6 | Rate limiting per organization and per domain name on `POST .../verify` with `HTML_META` | MISSING |

These controls apply to any future outbound fetch features as well. Tracked as a single roadmap item in 15-ROADMAP.md.

---

## 14. Input Validation

### Backend Validation

- **Global ValidationPipe** configured with:
  - `whitelist: true` - strips unknown properties
  - `transform: true` - auto-transforms payloads to DTO types
  - `forbidNonWhitelisted: true` - throws errors on unknown properties
- **class-validator decorators** on all DTOs:
  - `IsString`, `IsEmail`, `IsUUID`, `IsOptional`
  - `MinLength`, `MaxLength`, `Matches` (regex for domain names)
  - `IsIn` for enum fields (role, status)

### Password Validation

Enforced in `RegisterDto`:
- `@MinLength(12)`
- `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/)`

### Gaps

1. **No request body size limits** beyond framework defaults
2. **No validation on query parameters** in many endpoints
3. **No file upload validation** (not currently applicable but should be considered)
4. **Domain regex validation** exists but may not reject all malicious patterns

---

## 15. Secrets Management

### Required Environment Variables

| Variable | Purpose | Sensitivity |
|---|---|---|
| `JWT_SECRET` | Access token signing | Critical |
| `JWT_REFRESH_SECRET` | Refresh token signing | Critical |
| `DATABASE_URL` | PostgreSQL connection string | Critical |
| `CORS_ORIGINS` | Allowed CORS origins | Medium |
| `PORT` | Server port | Low |

### Current State

Secrets are loaded from environment variables via `@nestjs/config`. No `.env` file is committed to the repository.

### Gaps

1. **No secrets rotation policy.** JWT secrets are never rotated.
2. **No secrets vault integration** (e.g., AWS Secrets Manager, HashiCorp Vault)
3. **No audit of which secrets are deployed where**
4. **argon2 uses default parameters** which are not explicitly configured

### Required Implementation

1. Document all required secrets and their formats
2. Implement JWT secret rotation with token validation against multiple secrets
3. Integrate with a secrets manager for production deployments
4. Never log or expose secrets in error messages

---

## 16. Encryption

### In Transit

- HTTPS enforced via HSTS header (Helmet)
- TLS termination expected at the load balancer/reverse proxy level

### At Rest

- **Passwords:** Hashed with argon2 (one-way)
- **Refresh tokens:** Hashed with argon2 (one-way)
- **Database:** No application-level encryption beyond password/token hashing
- **No field-level encryption** for sensitive business data

### Gaps

1. **No application-level encryption for sensitive fields** (e.g., API keys, configuration secrets)
2. **Database backups may contain unencrypted sensitive data**
3. **No key management** for application-level encryption

---

## 17. Audit Logging

**Status: NOT IMPLEMENTED.**

No audit trail exists for:
- Authentication events (login, logout, failed attempts)
- Authorization changes (role updates, user removal)
- Data mutations (create, update, delete)
- Configuration changes

### Required Implementation

1. Create an `AuditLog` model in the database
2. Log all authentication events with: timestamp, userId, action, IP, userAgent, result
3. Log all role changes and user management actions
4. Log data mutations on sensitive resources
5. Retention policy: 90 days minimum
6. Immutable audit log (append-only)

---

## 18. Data Privacy

### Data Collected

| Data Type | Storage | Purpose |
|---|---|---|
| Email | User table | Authentication, communication |
| Password hash | User table | Authentication |
| Organization name | Organization table | Tenant identification |
| Business details | Business table | Service delivery |
| Domain names | BusinessDomain table | Widget resolution |
| Onboarding responses | OnboardingProgress table | Service delivery |
| Session metadata | Session table | Authentication |

### Gaps

1. **No data retention policy** - data is kept indefinitely
2. **No user data export** (GDPR right to portability)
3. **No account deletion flow** (GDPR right to erasure)
4. **No privacy policy integration**
5. **Session IP/userAgent not collected** - reduces forensic capability

---

## 19. Threat Model

### Primary Threats

| Threat | Current Mitigation | Residual Risk |
|---|---|---|
| Brute force login | Basic throttler (10/60s) | HIGH - insufficient |
| Credential stuffing | Generic error messages | MEDIUM |
| XSS token theft | Helmet headers, no httpOnly | HIGH - localStorage exposed |
| CSRF | Bearer token pattern | LOW - not cookie-based |
| Cross-tenant data leak | Service-level filtering only | HIGH - no enforcement layer |
| Session hijacking | argon2 token hashing | MEDIUM - no IP binding |
| API enumeration | Rate limiting (partial) | MEDIUM |
| Widget spoofing | None | HIGH - no API key auth |
| Privilege escalation | None (no RBAC enforcement) | HIGH |
| Data exfiltration | No audit logging | HIGH - undetected |
| Supply chain attack | Standard npm security | MEDIUM |

### Attack Vectors

1. **XSS via widget embed** -> steal localStorage tokens -> impersonate user
2. **Brute force login** -> account compromise -> cross-tenant access
3. **Missing RBAC** -> low-privilege user accesses admin endpoints
4. **Widget API abuse** -> enumerate all businesses by domain
5. **Session accumulation** -> resource exhaustion / database bloat
6. **Missing audit** -> undetected breach

---

## 20. Production Security Checklist

### Critical (Must complete before launch)

- [ ] Move tokens to `httpOnly` cookies with `SameSite=Strict`
- [ ] Implement CSRF token validation for state-changing requests
- [ ] Add strict rate limiting: login 5/15min, register 10/hr
- [ ] Implement `RolesGuard` and `@Roles()` on all endpoints
- [ ] Create `OrganizationGuard` or middleware enforcing `organizationId`
- [ ] Audit all database queries for correct tenant filtering
- [ ] Add IP and userAgent to session creation
- [ ] Implement session cleanup cron (delete expired sessions)
- [ ] Add API key authentication for widget endpoints
- [ ] Validate `Origin` header on widget API requests
- [ ] Add request body size limits (`limit: '1mb'` or appropriate)

### High (Complete within 30 days of launch)

- [ ] Implement account lockout after 10 failed attempts
- [ ] Add password reset flow (email-based, time-limited token)
- [ ] Add email verification on registration
- [ ] Implement audit logging for authentication events
- [ ] Integrate secrets manager (remove hardcoded defaults)
- [ ] Configure argon2 parameters explicitly (benchmark for target hardware)
- [ ] Implement concurrent session limit (e.g., 5 per user)
- [ ] Invalidate sessions on password change
- [ ] Add CSP nonce-based script loading

### Medium (Complete within 90 days)

- [ ] Implement full audit logging for all data mutations
- [ ] Add GDPR data export and deletion endpoints
- [ ] Implement data retention policy
- [ ] Add field-level encryption for sensitive data
- [ ] Implement JWT secret rotation
- [ ] Add monitoring and alerting for security events
- [ ] Implement request signing for widget communication
- [ ] Add frontend DOMPurify for user-generated content

### Recommended

- [ ] Security audit by external party
- [ ] Penetration testing (web application + API)
- [ ] Vulnerability scanning in CI/CD pipeline
- [ ] Dependency audit automation (npm audit, Snyk)
- [ ] SOC 2 compliance assessment
- [ ] Bug bounty program

---

## Appendix A: Security Configuration Reference

### Helmet Configuration

```typescript
fastify.register(helmet, {
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});
```

### CORS Configuration

```typescript
fastify.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(','),
  credentials: true,
});
```

### Throttler Configuration

```typescript
ThrottlerModule.forRoot([{
  ttl: 60000,
  limit: 10,
}]),
```

### ValidationPipe Configuration

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
}));
```

---

## Appendix B: Incident Response

### Not Implemented

No incident response plan exists. The following should be documented:

1. **Detection:** How security events are identified (currently: not at all)
2. **Containment:** Steps to isolate a compromised account or system
3. **Eradication:** Steps to remove the threat
4. **Recovery:** Steps to restore normal operations
5. **Communication:** How affected users are notified
6. **Post-mortem:** Root cause analysis and prevention measures

---

## Appendix C: Security Debt Summary

| Gap | Severity | Effort to Fix | Status |
|---|---|---|---|
| localStorage token storage | Critical | Medium | Open |
| No RBAC enforcement (RolesGuard exists but unwired) | Critical | Medium | Open |
| No organization isolation middleware (OrganizationGuard is an always-true stub; service-level checks are the only enforcement) | Critical | High | Open |
| SSRF: unhardened outbound fetch in HTML_META domain verification | High | Medium | Open |
| Insufficient rate limiting (auth-only; no limit on domain verify) | High | Low | Open |
| No account lockout | High | Low | Open |
| No audit logging | High | Medium | Open |
| No password reset | High | Medium | Open |
| No email verification | High | Medium | Open |
| No CSRF protection | High | Medium | Open |
| No widget API authentication | High | Medium | Open |
| No session cleanup | Medium | Low | Open |
| ~~No IP/userAgent binding~~ Session metadata captured on login/register | Medium | Low | Resolved 2026-08 |
| ~~No request size limits~~ Fastify `bodyLimit` 100 KB set at bootstrap | Low | Low | Resolved 2026-08 |
| Default argon2 parameters | Low | Low | Open |
| No secrets rotation | Low | Medium | Open |
| No GDPR endpoints | Low | High | Open |
