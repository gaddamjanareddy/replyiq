# ReplyIQ - API Status

> Complete documentation of every API endpoint.

**Base URL:** `http://localhost:3000`
**Prefix:** `/api/v1`
**Last Updated:** 2026-07-23

---

## Implemented Endpoints

---

### GET /health

**Purpose:** Health check endpoint for monitoring and load balancers.

**Authentication Required:** No

**Request DTO:** None

**Response:**
```json
{
  "status": "ok",
  "service": "replyiq-api",
  "version": "0.1.0"
}
```

**Status:** Working

**Test Status:** Manual

**Future Improvements:**
- Add database connectivity check
- Add memory/disk usage stats
- Return proper HTTP status codes on failure

---

### POST /auth/register

**Purpose:** Register a new workspace. Creates Organization, Business, Owner User, and Session in a single database transaction.

**Authentication Required:** No

**Request DTO:** `RegisterWorkspaceDto`
```json
{
  "businessName": "Acme Corp",
  "ownerName": "John Doe",
  "email": "john@acme.com",
  "password": "SecureP@ss123"
}
```

| Field | Type | Constraints |
|---|---|---|
| businessName | string | 2-200 chars, trimmed, single-spaced |
| ownerName | string | 2-150 chars, trimmed, single-spaced |
| email | string | Valid email, lowercased |
| password | string | 12-128 chars, must contain uppercase, lowercase, number, special char |

**Response (201):**
```json
{
  "session": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900
  },
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@acme.com",
    "role": "OWNER"
  },
  "business": {
    "id": "uuid",
    "name": "Acme Corp"
  },
  "organization": {
    "id": "uuid",
    "name": "Acme Corp"
  }
}
```

**Error Response (409):**
```json
{
  "statusCode": 409,
  "message": "Email already in use",
  "timestamp": "2026-07-21T00:00:00.000Z"
}
```

**Status:** Working

**Test Status:** Manual

**Future Improvements:**
- Add rate limiting (10 registrations per IP per hour)
- Add email verification flow
- Return business domain info after verification setup

---

### POST /auth/login

**Purpose:** Authenticate user with email and password. Returns access and refresh tokens.

**Authentication Required:** No

**Request DTO:** `LoginDto`
```json
{
  "email": "john@acme.com",
  "password": "SecureP@ss123"
}
```

| Field | Type | Constraints |
|---|---|---|
| email | string | Valid email, lowercased |
| password | string | 1-128 chars |

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@acme.com",
      "role": "OWNER",
      "organizationId": "uuid",
      "businessId": "uuid"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "timestamp": "2026-07-21T00:00:00.000Z"
}
```

**Status:** Working

**Test Status:** Manual

**Future Improvements:**
- Add rate limiting (5 attempts per email per 15 minutes)
- Add account lockout after N failed attempts
- Add login audit logging

---

### POST /auth/refresh

**Purpose:** Rotate refresh token and issue new token pair. Validates session in DB, verifies hash, rotates, and returns new tokens.

**Authentication Required:** No (but requires valid refresh token)

**Request DTO:** `RefreshTokenDto`
```json
{
  "refreshToken": "eyJ..."
}
```

| Field | Type | Constraints |
|---|---|---|
| refreshToken | string | Valid JWT refresh token |

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@acme.com",
      "role": "OWNER",
      "organizationId": "uuid",
      "businessId": "uuid"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired refresh token",
  "timestamp": "2026-07-21T00:00:00.000Z"
}
```

**Status:** Working

**Test Status:** Manual

**Future Improvements:**
- Add reuse detection (if old refresh token is reused, revoke all sessions)
- Add IP/user-agent binding to sessions
- Return session metadata (device, last used)

---

### POST /auth/logout

**Purpose:** Revoke the current session. Invalidates the refresh token so it can no longer be used to obtain new access tokens.

**Authentication Required:** Yes (Bearer access token)

**Request DTO:** None (empty body)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Session not found",
  "timestamp": "2026-07-21T00:00:00.000Z"
}
```

**Status:** Working

**Test Status:** Manual

**Future Improvements:**
- Add "logout all sessions" option
- Accept refresh token in body to revoke a specific session without access token
- Return list of remaining active sessions

---

### GET /auth/me

**Purpose:** Get the currently authenticated user's profile. Returns fresh data from the database (not from the JWT payload).

**Authentication Required:** Yes (Bearer access token)

**Request DTO:** None

**Response (200):**
```json
{
  "success": true,
  "message": "Current user retrieved successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@acme.com",
      "role": "OWNER",
      "organizationId": "uuid",
      "businessId": "uuid"
    }
  }
}
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "timestamp": "2026-07-21T00:00:00.000Z"
}
```

**Status:** Working

**Test Status:** Manual

**Future Improvements:**
- None (endpoint is complete)

---

## Not Yet Implemented Endpoints

These endpoints are planned and documented in [ROADMAP.md](ROADMAP.md).

| Method | Route | Purpose | Milestone |
|---|---|---|---|
| POST | `/auth/change-password` | Change password (requires current password) | 3 |
| POST | `/auth/forgot-password` | Request password reset email | 3 |
| POST | `/auth/reset-password` | Reset password with token | 3 |
| POST | `/auth/verify-email` | Verify email with token | 3 |
| GET | `/users` | List users in organization | 4 |
| GET | `/users/:id` | Get user by ID | 4 |
| PATCH | `/users/:id` | Update user | 4 |
| DELETE | `/users/:id` | Soft-delete user | 4 |
| POST | `/users/invite` | Invite user to organization | 4 |
| GET | `/businesses` | List businesses in organization | 4 |
| GET | `/businesses/:id` | Get business by ID | 4 |
| PATCH | `/businesses/:id` | Update business | 4 |
| DELETE | `/businesses/:id` | Soft-delete business | 4 |
| POST | `/businesses/:id/domains` | Add domain to business | 4 |
| POST | `/businesses/:id/domains/:domainId/verify` | Verify domain | 4 |
| DELETE | `/businesses/:id/domains/:domainId` | Remove domain | 4 |
| GET | `/organizations/current` | Get current organization | 4 |
| PATCH | `/organizations/current` | Update organization settings | 4 |
| GET | `/sessions` | List active sessions | 3 |
| DELETE | `/sessions/:id` | Revoke specific session | 3 |

---

## Global Response Format

All responses follow a consistent error shape (from `GlobalExceptionFilter`):

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "timestamp": "2026-07-21T00:00:00.000Z"
}
```

Success responses vary by endpoint but consistently include `success`, `message`, and `data` fields for auth endpoints.

---

## Rate Limiting

**Status:** Not implemented

**Planned Policy:**
| Endpoint | Limit | Window |
|---|---|---|
| POST /auth/login | 5 attempts | 15 minutes per email |
| POST /auth/register | 10 attempts | 1 hour per IP |
| POST /auth/refresh | 30 attempts | 15 minutes per session |
| POST /auth/forgot-password | 3 attempts | 1 hour per email |

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <accessToken>
```

The `JwtAuthGuard` validates the token and attaches the `JwtPayload` to the request object.
