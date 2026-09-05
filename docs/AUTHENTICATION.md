# ReplyIQ - Authentication

> Complete documentation of the authentication system, flows, and security considerations.

**Last Updated:** 2026-07-21

---

## Overview

ReplyIQ uses a dual-JWT authentication system with database-backed sessions. Access tokens are short-lived (15 minutes) for API authorization. Refresh tokens are long-lived (30 days) for session persistence. Refresh token rotation is enforced on every refresh.

---

## JWT

### Access Token

- **Signing secret:** `JWT_SECRET`
- **Default TTL:** 15 minutes
- **Algorithm:** HS256 (default)
- **Payload:**

```typescript
interface JwtPayload {
  sub: string;           // User ID
  email: string;         // User email
  organizationId: string; // Organization ID
  role: UserRole;        // OWNER | ADMIN | MANAGER
  sessionId: string;     // Session UUID (for DB lookup)
}
```

### Refresh Token

- **Signing secret:** `JWT_REFRESH_SECRET`
- **Default TTL:** 30 days
- **Algorithm:** HS256 (default)
- **Payload:**

```typescript
interface RefreshTokenPayload {
  sub: string;       // User ID
  sessionId: string; // Session UUID (for DB lookup)
}
```

### Key Properties

| Property | Access Token | Refresh Token |
|---|---|---|
| Secret | `JWT_SECRET` | `JWT_REFRESH_SECRET` |
| TTL | 15m | 30d |
| Contains | Full user context | Minimal (sub + session) |
| Verified by | Passport JWT strategy | `TokenService.verifyRefreshToken()` |
| Hashed in DB | No | Yes (argon2) |

---

## Refresh Tokens

Refresh tokens serve two purposes:

1. **Obtain new access tokens** without re-authentication
2. **Detect token theft** via hash rotation

### Rotation Flow

On every `/auth/refresh` call:
1. Verify the refresh token JWT signature
2. Look up the session in DB by `sessionId`
3. Compare the provided refresh token against the stored hash (argon2)
4. Generate new access + refresh token pair
5. Hash the new refresh token
6. Update the session record with the new hash
7. Return new tokens to the client

If the old token is reused after rotation, the hash comparison will fail because the session now stores the new hash.

---

## Sessions

Sessions are stored in the `sessions` table.

### Session Lifecycle

```
Created (login/register)
    ↓
Active (refresh updates lastUsedAt)
    ↓
Rotated (refresh generates new hash)
    ↓
Expired (expiresAt passes)  OR  Revoked (POST /auth/logout)
```

### Session Fields

| Field | Purpose |
|---|---|
| `id` | Session UUID (embedded in JWT) |
| `userId` | Owner of the session |
| `refreshTokenHash` | argon2 hash of current refresh token |
| `expiresAt` | When the session expires |
| `lastUsedAt` | Updated on each refresh |
| `revokedAt` | Set when session is revoked |
| `ipAddress` | Client IP (not yet populated) |
| `userAgent` | Client user agent (not yet populated) |

### Session Cleanup

**Status:** Not implemented. Expired sessions accumulate in the database.

---

## Password Hashing

**Algorithm:** argon2 (winner of the Password Hashing Competition)

**Implementation:** `PasswordService` in `apps/api/src/common/security/password.service.ts`

```typescript
class PasswordService {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
```

### Usage

| Purpose | Hashed With |
|---|---|
| User passwords | argon2 |
| Refresh tokens | argon2 |

argon2 is memory-hard and resistant to GPU-based brute-force attacks.

---

## Registration Flow

```
Client                          API
  │                               │
  │  POST /auth/register          │
  │  { businessName, ownerName,   │
  │    email, password }          │
  │──────────────────────────────>│
  │                               │
  │                    ┌──────────┤
  │                    │ $transaction:
  │                    │  1. Create Organization
  │                    │  2. Create Business
  │                    │  3. Hash password
  │                    │  4. Create User (OWNER)
  │                    │  5. Generate tokens
  │                    │  6. Create Session
  │                    └──────────┤
  │                               │
  │  201 Created                  │
  │  { session, user, business,   │
  │    organization }             │
  │<──────────────────────────────│
```

**Key behaviors:**
- All operations in a single DB transaction (atomic)
- Email is checked for uniqueness (global, not per-org)
- Duplicate email returns 409 Conflict
- Password must meet complexity requirements (12+ chars, mixed case, number, special)
- User is always created with OWNER role
- Session is immediately active (tokens returned)

---

## Login Flow

```
Client                          API
  │                               │
  │  POST /auth/login             │
  │  { email, password }          │
  │──────────────────────────────>│
  │                               │
  │                    ┌──────────┤
  │                    │ 1. Find user by email
  │                    │ 2. Verify password (argon2)
  │                    │ 3. Generate tokens
  │                    │ 4. Create session in DB
  │                    └──────────┤
  │                               │
  │  200 OK                       │
  │  { success, data: {           │
  │    user, accessToken,         │
  │    refreshToken }}             │
  │<──────────────────────────────│
```

**Key behaviors:**
- Generic error message on failure ("Invalid email or password")
- No distinction between wrong email and wrong password
- Session is created with refresh token hash
- `expiresAt` calculated from `REFRESH_TOKEN_TTL` config

---

## Refresh Flow

```
Client                          API
  │                               │
  │  POST /auth/refresh           │
  │  { refreshToken }             │
  │──────────────────────────────>│
  │                               │
  │                    ┌──────────┤
  │                    │ 1. Verify JWT signature
  │                    │ 2. Find session by sessionId
  │                    │ 3. Check session not revoked
  │                    │ 4. Check session not expired
  │                    │ 5. Verify hash matches
  │                    │ 6. Find user by ID
  │                    │ 7. Generate new token pair
  │                    │ 8. Hash new refresh token
  │                    │ 9. Update session (rotate hash)
  │                    │ 10. Update lastUsedAt
  │                    └──────────┤
  │                               │
  │  200 OK                       │
  │  { success, data: {           │
  │    user, accessToken,         │
  │    refreshToken }}             │
  │<──────────────────────────────│
```

**Key behaviors:**
- Old refresh token is invalidated (hash replaced)
- New refresh token returned to client
- Session metadata updated (lastUsedAt)
- Multiple failure points return 401 with specific messages

---

## Logout Flow

**Status:** Working.

**Implementation:** `POST /auth/logout` with `JwtAuthGuard`. Extracts `sessionId` from the JWT access token and sets `revokedAt` on the session.

```
Client                          API
  │                               │
  │  POST /auth/logout            │
  │  Authorization: Bearer <JWT>  │
  │──────────────────────────────>│
  │                               │
  │                    ┌──────────┤
  │                    │ 1. JwtAuthGuard validates token
  │                    │ 2. JwtStrategy extracts payload
  │                    │ 3. Find session by JWT sessionId
  │                    │ 4. Check session exists
  │                    │ 5. Check not already revoked
  │                    │ 6. Set revokedAt = now()
  │                    └──────────┤
  │                               │
  │  200 OK                       │
  │  { success, message }         │
  │<──────────────────────────────│
```

**Key behaviors:**
- Requires valid access token (JwtAuthGuard)
- Extracts sessionId from JWT payload
- Returns 401 if session not found or already revoked
- Sets `revokedAt` timestamp on the session
- After revocation, refresh token will fail (session lookup returns revoked session)

**Future considerations:**
- Logout all sessions option
- Session listing before selective logout
- Accept refresh token in body to revoke without access token

---

## /me Flow

**Status:** Working.

**Implementation:** `GET /auth/me` with `JwtAuthGuard`. Extracts user ID from the JWT payload and queries the database for fresh user data. Does not return JWT internals (sessionId, etc.).

```
Client                          API
  │                               │
  │  GET /auth/me                 │
  │  Authorization: Bearer <JWT>  │
  │──────────────────────────────>│
  │                               │
  │                    ┌──────────┤
  │                    │ 1. JwtAuthGuard validates token
  │                    │ 2. JwtStrategy extracts payload
  │                    │ 3. Find user by payload.sub
  │                    │ 4. Check user not soft-deleted
  │                    │ 5. Return user profile
  │                    └──────────┤
  │                               │
  │  200 OK                       │
  │  { success, message,          │
  │    data: { user: {            │
  │      id, name, email,         │
  │      role, organizationId }}  │
  │<──────────────────────────────│
```

**Key behaviors:**
- Requires valid access token (JwtAuthGuard)
- Queries DB for fresh user data (not from JWT payload)
- Returns 401 if user not found or soft-deleted (`deletedAt !== null`)
- Generic "Unauthorized" error message (no information leakage)
- Response includes `organizationId` for frontend workspace context

---

## Security Considerations

### Current Security Measures

| Measure | Status |
|---|---|
| Password hashing (argon2) | Implemented |
| Dual JWT secrets | Implemented |
| Refresh token rotation | Implemented |
| Session DB validation | Implemented |
| Generic auth error messages | Implemented |
| Helmet security headers | Implemented |
| CORS configuration | Enabled (too permissive) |
| Request validation (DTOs) | Implemented |
| Password complexity rules | Implemented (12+ chars) |

### Known Security Gaps

| Gap | Risk | Priority |
|---|---|---|
| No login rate limiting | Brute-force attacks | High |
| CORS allows all origins | Cross-origin abuse | High |
| Tokens in localStorage | XSS token theft | Medium |
| No IP/user-agent binding | Session theft undetected | Medium |
| No session cleanup | DB bloat, stale sessions | Low |
| No account lockout | Persistent brute-force | Medium |
| No password reset flow | Account recovery impossible | Medium |
| No email verification | Email spoofing | Medium |

### Production Requirements

Before production deployment:
1. Restrict CORS to specific origins
2. Implement login rate limiting
3. Move tokens to httpOnly cookies or add CSRF protection
4. Add IP and user-agent binding to sessions
5. Implement session cleanup cron
6. Add audit logging for auth events
7. Implement account lockout after failed attempts

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | (required) | Access token signing secret |
| `JWT_REFRESH_SECRET` | (required) | Refresh token signing secret |
| `ACCESS_TOKEN_TTL` | `15m` | Access token expiry |
| `REFRESH_TOKEN_TTL` | `30d` | Refresh token expiry |

TTL format: `<number><unit>` where unit is `s` (seconds), `m` (minutes), `h` (hours), or `d` (days).

---

## File Locations

| File | Purpose |
|---|---|
| `apps/api/src/modules/auth/auth.controller.ts` | Auth route handlers |
| `apps/api/src/modules/auth/auth.service.ts` | Login and refresh logic |
| `apps/api/src/modules/auth/workspace-provisioning.service.ts` | Registration logic |
| `apps/api/src/modules/auth/jwt.strategy.ts` | Passport JWT strategy |
| `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` | Auth guard for protected routes |
| `apps/api/src/modules/auth/auth.module.ts` | Auth module configuration |
| `apps/api/src/modules/auth/dto/*.ts` | Request DTOs |
| `apps/api/src/common/security/password.service.ts` | argon2 hash/verify |
| `apps/api/src/common/security/token.service.ts` | JWT generation/verification |
| `apps/api/src/infrastructure/security/session/session.service.ts` | Session DB operations |
| `apps/api/src/infrastructure/security/security.module.ts` | Security module (JWT, password, session) |
| `apps/api/src/common/types/jwt-payload.interface.ts` | JWT payload type |
| `apps/api/src/common/types/refresh-token-payload.interface.ts` | Refresh token payload type |
