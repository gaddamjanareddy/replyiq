# 09 - API Specification

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Tech Lead

## Overview

This document is the authoritative API contract for ReplyIQ. It specifies every implemented and planned REST endpoint, request/response schemas, validation rules, authentication requirements, error handling, and rate limiting.

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


## 1. API Conventions

### 1.1 Base URL

```
http://localhost:3000
```

### 1.2 Versioning

All endpoints are served under a global prefix:

```
/api/v1/<resource>
```

Versioning is enforced at the URL path level. Breaking changes introduce a new version segment (`/api/v2`). Non-breaking additions (new optional fields, new endpoints) are added to the current version.

### 1.3 Authentication

Protected endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

The `JwtAuthGuard` extracts and validates the token, then attaches the decoded payload to `request.user`. Missing, expired, or invalid tokens produce a `401 Unauthorized` response.

Public endpoints omit authentication entirely.

### 1.4 Content Type

All request and response bodies use `application/json`. Requests without the correct `Content-Type` header return `415 Unsupported Media Type`.

### 1.5 HTTP Methods

| Method | Semantics |
|---|---|
| `GET` | Read resource(s). Idempotent. No request body. |
| `POST` | Create resource or invoke action. |
| `PATCH` | Partial update. Only supplied fields are modified. |
| `DELETE` | Remove resource. |

### 1.6 Response Envelope

All success responses from authenticated endpoints follow a standard envelope:

```json
{
  "success": true,
  "message": "Human-readable description",
  "data": { ... }
}
```

The `health` endpoint is an exception and returns a flat object.

### 1.7 Error Response Format

All error responses follow this shape:

```json
{
  "statusCode": 400,
  "code": "STABLE_MACHINE_READABLE_CODE",
  "message": "Error description or array of validation errors",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

The `message` field is a string for most errors. For validation errors from the global `ValidationPipe`, it is an array of strings (one per violated constraint). The `code` field is the stable machine-readable contract; clients MUST branch on `code` and MUST NOT parse `message` prose.

#### Error Code Registry

Codes are additive-only: never renamed, only appended.

| Code | HTTP | Meaning |
|---|---|---|
| AUTH_INVALID_CREDENTIALS | 401 | Login failed: wrong email or password |
| AUTH_UNAUTHENTICATED | 401 | Missing/expired access token, or session no longer valid |
| AUTH_REFRESH_INVALID | 401 | Refresh token rejected; user must re-authenticate |
| AUTH_EMAIL_TAKEN | 409 | Registration email already in use |
| AUTHZ_FORBIDDEN | 403 | Authenticated but role/tenant denies this action |
| RESOURCE_NOT_FOUND | 404 | Business/resource does not exist (or is not visible) |
| VALIDATION_FAILED | 400/422 | Request body/query failed validation (`message` may be an array) |
| RATE_LIMITED | 429 | Too many requests; retry later |
| DOMAIN_NOT_FOUND | 404 | Domain id unknown to this business, or soft-deleted |
| DOMAIN_ALREADY_REGISTERED | 409 | An ACTIVE domain with this name exists (any organization) |
| DOMAIN_ALREADY_VERIFIED | 400 | Domain already in VERIFIED state; re-verification denied |
| DOMAIN_VERIFICATION_FAILED | 400 | Challenge reachable but token mismatch (or SSRF-blocked target) |
| DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED | 409 | D-06: cannot delete the last active VERIFIED domain of a COMPLETED business |
| ONBOARDING_STEP_OUT_OF_ORDER | 400 | Prerequisite onboarding step not completed |
| ONBOARDING_ALREADY_COMPLETED | 400 | Onboarding terminal state; no further step changes |
| ONBOARDING_NO_DOMAIN | 400 | FIRST_DOMAIN prerequisite missing |
| ONBOARDING_NO_VERIFIED_DOMAIN | 400 | No live VERIFIED domain at verification/completion time |

Success responses may carry an informational top-level `code` alongside `success:true`: currently `DOMAIN_VERIFICATION_PENDING` (200) signals the challenge was not reachable yet - retry shortly. This is NOT an error.

---

## 2. HTTP Status Codes

| Code | Meaning | When Used |
|---|---|---|
| `200` | OK | Successful read or update |
| `201` | Created | Successful resource creation |
| `400` | Bad Request | Malformed request body or missing required fields |
| `401` | Unauthorized | Missing, invalid, or expired authentication token |
| `403` | Forbidden | Authenticated but not permitted to access the resource |
| `404` | Not Found | Resource does not exist or is not accessible by the caller |
| `409` | Conflict | Resource already exists (e.g., duplicate email) |
| `415` | Unsupported Media Type | Request body is not JSON |
| `422` | Unprocessable Entity | Validation failure from `ValidationPipe` |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unhandled server exception |

### Exception Mapping

| NestJS Exception | HTTP Status |
|---|---|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `ValidationException` | 422 |
| `ThrottlerException` | 429 |
| Unhandled | 500 |

---

## 3. Rate Limiting

Rate limiting is enforced by `ThrottlerGuard` on the following endpoints:

| Endpoint | Window | Max Requests | Key |
|---|---|---|---|
| `POST /api/v1/auth/register` | 60 seconds | 10 | Client IP |
| `POST /api/v1/auth/login` | 60 seconds | 10 | Client IP |
| `POST /api/v1/auth/refresh` | 60 seconds | 10 | Client IP |

All other endpoints are not throttled.

**Rate limit exceeded response:**

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

---

## 4. Validation Rules

### Global ValidationPipe

The API registers a global `ValidationPipe` with the following configuration:

- `whitelist: true` -- Unknown properties are stripped from incoming DTOs
- `transform: true` -- Payloads are auto-transformed to DTO class instances
- `forbidNonWhitelisted: true` -- Requests containing undeclared fields are rejected with `422`

### Password Complexity (Registration)

| Rule | Constraint |
|---|---|
| Minimum length | 12 characters |
| Maximum length | 128 characters |
| Uppercase letter | At least one (`A-Z`) |
| Lowercase letter | At least one (`a-z`) |
| Digit | At least one (`0-9`) |
| Special character | At least one (non-alphanumeric) |

### Domain Name Validation

Domain strings are validated against a regex pattern that enforces valid hostname format (e.g., `example.com`, `sub.example.co.uk`). The pattern rejects protocol prefixes, paths, ports, and special characters.

---

## 5. Implemented Endpoints (15)

---

### 5.1 Health Check

```
GET /api/v1/health
```

**Authentication:** None

**Description:** Returns application liveness status. Used by orchestrators and load balancers.

**Response -- 200 OK:**

```json
{
  "status": "ok",
  "service": "replyiq-api",
  "version": "0.1.0"
}
```

**Error Responses:** None under normal operation. Returns `500` if the application is in a degraded state.

---

### 5.2 Register

```
POST /api/v1/auth/register
```

**Authentication:** None (rate-limited: 10 requests per 60s per IP)

**Description:** Creates a new workspace. Transactionally provisions an Organization, Business, and owner User, then returns a session token pair.

**Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `businessName` | string | Yes | Min 2, max 200 characters |
| `ownerName` | string | Yes | Min 2, max 150 characters |
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | 12--128 characters, complexity rules (see Section 4) |

**Example Request:**

```json
{
  "businessName": "Acme Corp",
  "ownerName": "Jane Smith",
  "email": "jane@acme.com",
  "password": "S3cur3P@ssw0rd!"
}
```

**Response -- 201 Created:**

```json
{
  "session": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  },
  "user": {
    "id": "clx1234567890",
    "name": "Jane Smith",
    "email": "jane@acme.com",
    "role": "OWNER"
  },
  "business": {
    "id": "clx0987654321",
    "name": "Acme Corp"
  },
  "organization": {
    "id": "clx1122334455",
    "name": "Acme Corp"
  }
}
```

**Note (APPROVED D-03):** The register response intentionally uses a flat `session/user/business/organization` shape and does not use the standard `success/message/data` envelope of Section 1.6. Unification is DEFERRED; this flat shape is the contract and the web client consumes it as-is.

**Error Response -- 409 Conflict:**

```json
{
  "statusCode": 409,
  "message": "Email already in use",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

**Error Response -- 429 Too Many Requests:**

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

---

### 5.3 Login

```
POST /api/v1/auth/login
```

**Authentication:** None (rate-limited: 10 requests per 60s per IP)

**Description:** Authenticates a user by email and password. Creates a new session and returns a token pair.

**Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | 1--128 characters |

**Example Request:**

```json
{
  "email": "jane@acme.com",
  "password": "S3cur3P@ssw0rd!"
}
```

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "clx1234567890",
      "name": "Jane Smith",
      "email": "jane@acme.com",
      "role": "OWNER",
      "organizationId": "clx1122334455",
      "businessId": "clx0987654321"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Response -- 401 Unauthorized:**

```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

---

### 5.4 Refresh Token

```
POST /api/v1/auth/refresh
```

**Authentication:** None (rate-limited: 10 requests per 60s per IP). Requires a valid, non-revoked refresh token in the request body.

**Description:** Exchanges a refresh token for a new access/refresh token pair. The old refresh token is invalidated (single-use rotation).

**Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `refreshToken` | string | Yes | Non-empty valid JWT |

**Example Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "id": "clx1234567890",
      "name": "Jane Smith",
      "email": "jane@acme.com",
      "role": "OWNER",
      "organizationId": "clx1122334455",
      "businessId": "clx0987654321"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Response -- 401 Unauthorized:**

```json
{
  "statusCode": 401,
  "message": "Invalid or expired refresh token",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

---

### 5.5 Logout

```
POST /api/v1/auth/logout
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Revokes the current session. The refresh token is invalidated and cannot be used again.

**Request Body:** Empty

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Response -- 401 Unauthorized:**

```json
{
  "statusCode": 401,
  "message": "Session not found",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

---

### 5.6 Get Current User

```
GET /api/v1/auth/me
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Returns the authenticated user's profile information.

**Request Body:** None

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "clx1234567890",
      "name": "Jane Smith",
      "email": "jane@acme.com",
      "role": "OWNER",
      "organizationId": "clx1122334455",
      "businessId": "clx0987654321"
    }
  }
}
```

**Error Response -- 401 Unauthorized:**

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

---

### 5.7 Get Business

```
GET /api/v1/businesses/:businessId
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Returns a business record by ID. The request must originate from a user within the same organization that owns the business.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Business retrieved successfully",
  "data": {
    "business": {
      "id": "clx0987654321",
      "organizationId": "clx1122334455",
      "name": "Acme Corp",
      "industry": "Technology",
      "description": "Enterprise software company",
      "websiteUrl": "https://acme.com",
      "onboardingStatus": "IN_PROGRESS",
      "status": "DRAFT",
      "createdAt": "2026-08-17T12:00:00.000Z",
      "updatedAt": "2026-08-17T12:00:00.000Z"
    }
  }
}
```

---

### 5.8 Update Business

```
PATCH /api/v1/businesses/:businessId
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Partially updates a business record. Only supplied fields are modified; omitted fields remain unchanged.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |

**Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | No | Min 2, max 200 characters |
| `industry` | string | No | Max 100 characters |
| `description` | string | No | Max 2000 characters |
| `websiteUrl` | string | No | Valid URL format, max 500 characters |

**Example Request:**

```json
{
  "name": "Acme Corporation",
  "industry": "SaaS"
}
```

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Business updated successfully",
  "data": {
    "business": {
      "id": "clx0987654321",
      "organizationId": "clx1122334455",
      "name": "Acme Corporation",
      "industry": "SaaS",
      "description": "Enterprise software company",
      "websiteUrl": "https://acme.com",
      "onboardingStatus": "IN_PROGRESS",
      "status": "DRAFT",
      "createdAt": "2026-08-17T12:00:00.000Z",
      "updatedAt": "2026-08-17T13:30:00.000Z"
    }
  }
}
```

---

### 5.9 List Domains

```
GET /api/v1/businesses/:businessId/domains
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Returns all domains registered under the specified business.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Domains retrieved successfully",
  "data": {
    "domains": [
      {
        "id": "clx5566778899",
        "businessId": "clx0987654321",
        "domain": "acme.com",
        "isPrimary": true,
        "status": "VERIFIED",
        "verifiedAt": "2026-08-17T12:30:00.000Z",
        "verificationMethod": "DNS_TXT",
        "createdAt": "2026-08-17T12:15:00.000Z"
      }
    ]
  }
}
```

---

### 5.10 Create Domain

```
POST /api/v1/businesses/:businessId/domains
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Registers a new domain under the specified business. The domain starts in `PENDING` status and must be verified before use.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |

**Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `domain` | string | Yes | Regex-validated hostname (e.g., `example.com`) |
| `isPrimary` | boolean | No | Defaults to `false` |

**Example Request:**

```json
{
  "domain": "acme.com",
  "isPrimary": true
}
```

**Response -- 201 Created:**

```json
{
  "success": true,
  "message": "Domain created successfully",
  "data": {
    "domain": {
      "id": "clx5566778899",
      "businessId": "clx0987654321",
      "domain": "acme.com",
      "isPrimary": true,
      "status": "PENDING",
      "verifiedAt": null,
      "verificationMethod": null,
      "createdAt": "2026-08-17T12:15:00.000Z"
    }
  }
}
```

---

### 5.11 Verify Domain

```
POST /api/v1/businesses/:businessId/domains/:domainId/verify
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Triggers domain ownership verification using the specified method. For `DNS_TXT`, checks for a TXT record at `_replyiq-verification.{domain}` whose value equals the domain's verification token. For `HTML_META`, fetches `http://{domain}/replyiq-verification.html (legacy; the meta tag is now the primary placement)` and requires the response body to equal `replyiq-verify:{verificationToken}` exactly. The verification token is generated once at domain creation (`replyiq-verify-{UUIDv4}`) and never changes across retries.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |
| `domainId` | string | Domain unique identifier |

**Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `method` | enum | Yes | `"DNS_TXT"` or `"HTML_META"` |

**Example Request:**

```json
{
  "method": "DNS_TXT"
}
```

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Domain verified successfully",
  "data": {
    "domain": {
      "id": "clx5566778899",
      "status": "VERIFIED",
      "verifiedAt": "2026-08-17T12:30:00.000Z",
      "verificationMethod": "DNS_TXT"
    }
  }
}
```

**Response semantics (as implemented):**

| Outcome | HTTP | Body |
|---|---|---|
| Token found and matches | `200` | `success: true`, `"Domain verified successfully"`, domain with `status: "VERIFIED"` |
| Challenge reachable but token mismatch | `400` | `message: "Verification failed. Ensure the challenge record is published correctly."` — status stays `PENDING`, token unchanged, retry allowed |
| Challenge not reachable (DNS NXDOMAIN, fetch error/timeout) | `200` | `success: true`, `message: "Verification pending — challenge record not yet reachable. Retry shortly."` — domain returned unchanged, retry allowed |
| Domain already `VERIFIED` | `400` | `message: "Domain is already verified"` |

**Note:** There is no retry counter and the verification token is never regenerated; users may retry indefinitely while the domain is unverified. On success the endpoint also marks `firstDomainVerified` in onboarding progress (upsert).

**Known gap [PROPOSED]:** the user-facing failure/pending copy above exposes internal jargon ("challenge record"). A stable machine-readable error code plus a UI-side human-friendly translation layer is proposed in Section 9 (Error Response Format) and tracked in 15-ROADMAP.md.

---

### 5.12 Delete Domain

```
DELETE /api/v1/businesses/:businessId/domains/:domainId
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Removes a domain from the business. This is a **soft delete**: the row's `deletedAt` timestamp is set and the row remains in the database. Soft-deleted domains are excluded from all list/verify operations.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |
| `domainId` | string | Domain unique identifier |

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Domain deleted successfully"
}
```

**Resolved (APPROVED D-02, hardening loop 2026-08-24):** uniqueness now applies to **ACTIVE rows only**, enforced by the partial unique index `business_domains_domain_active_key` (`WHERE "deletedAt" IS NULL`) added in migration `20260822000000_domain_partial_unique`. Soft-deleted domain names are re-registrable (history preserved); concurrent duplicate inserts are still rejected at the database level. The service layer pre-checks active rows for a friendlier error and maps `P2002` to the same stable code. See 08 §9.3.1 and 15-ROADMAP.md R6.

---

### 5.13 Get Verification Instructions

```
GET /api/v1/businesses/:businessId/domains/:domainId/verification-instructions
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Returns the verification instructions for a domain, including the specific record or HTML snippet the user must add. The response shape varies by verification method.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |
| `domainId` | string | Domain unique identifier |

**Query Parameters:**

| Parameter | Type | Required | Values |
|---|---|---|---|
| `method` | string | Yes | `"DNS_TXT"` or `"HTML_META"` |

**Response -- 200 OK (`DNS_TXT` method):**

```json
{
  "success": true,
  "message": "DNS TXT verification instructions",
  "data": {
    "method": "DNS_TXT",
    "recordName": "_replyiq-verification.acme.com",
    "recordValue": "replyiq-verify-3f9c2a1e-8b4d-4e6f-9a2b-1c5d7e8f0a3b"
  }
}
```

**Response -- 200 OK (`HTML_META` method):**

The implemented `HTML_META` mechanism is a fixed-path verification **file**, not a meta tag: the user publishes the content at `http://{domain}/replyiq-verification.html (legacy; the meta tag is now the primary placement)` and the verifier requires the response body to equal `htmlContent` exactly (whitespace-trimmed). The legacy `<meta name="replyiq-verification">` head-tag variant described in earlier revisions of this spec is **not implemented** and is classified [PROPOSED] pending product approval (see SPEC-RECONCILIATION-REPORT.md, D-01).

```json
{
  "success": true,
  "message": "HTML meta verification instructions",
  "data": {
    "method": "HTML_META",
    "htmlFileName": "replyiq-verification.html (legacy; the meta tag is now the primary placement)",
    "htmlContent": "replyiq-verify:replyiq-verify-3f9c2a1e-8b4d-4e6f-9a2b-1c5d7e8f0a3b"
  }
}
```

---

### 5.14 Get Onboarding Progress

```
GET /api/v1/businesses/:businessId/onboarding
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Returns the current onboarding status, a progress breakdown, and a list of onboarding steps with completion state.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Onboarding progress retrieved successfully",
  "data": {
    "onboardingStatus": "IN_PROGRESS",
    "progress": {
      "profileCompleted": true,
      "firstDomainAdded": true,
      "firstDomainVerified": false,
      "onboardingCompleted": false
    },
    "steps": [
      {
        "key": "PROFILE",
        "label": "Complete business profile",
        "completed": true
      },
      {
        "key": "FIRST_DOMAIN",
        "label": "Add your first domain",
        "completed": true
      },
      {
        "key": "DOMAIN_VERIFICATION",
        "label": "Verify domain ownership",
        "completed": false
      },
      {
        "key": "COMPLETE",
        "label": "Finish onboarding",
        "completed": false
      }
    ]
  }
}
```

---

### 5.15 Update Onboarding Step

```
PATCH /api/v1/businesses/:businessId/onboarding/steps
```

**Authentication:** Yes (`JwtAuthGuard`)

**Description:** Advances the onboarding to a specific step. The step value must be the next sequential step or the current step (idempotent). Skipping steps is not permitted.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `businessId` | string | Business unique identifier |

**Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `step` | enum | Yes | `"PROFILE"`, `"FIRST_DOMAIN"`, `"DOMAIN_VERIFICATION"`, `"COMPLETE"` |

**Example Request:**

```json
{
  "step": "DOMAIN_VERIFICATION"
}
```

**Response -- 200 OK:**

```json
{
  "success": true,
  "message": "Onboarding step updated successfully",
  "data": {
    "onboardingStatus": "IN_PROGRESS",
    "progress": {
      "profileCompleted": true,
      "firstDomainAdded": true,
      "firstDomainVerified": true,
      "onboardingCompleted": false
    },
    "steps": [
      {
        "key": "PROFILE",
        "label": "Complete business profile",
        "completed": true
      },
      {
        "key": "FIRST_DOMAIN",
        "label": "Add your first domain",
        "completed": true
      },
      {
        "key": "DOMAIN_VERIFICATION",
        "label": "Verify domain ownership",
        "completed": true
      },
      {
        "key": "COMPLETE",
        "label": "Finish onboarding",
        "completed": false
      }
    ]
  }
}
```

---

## 6. Planned Endpoints

The following endpoints are defined in the product specification but not yet implemented. They are listed here to establish the full contract scope for frontend consumption and future backend work.

### 6.1 Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/change-password` | Yes | Change password for authenticated user |
| `POST` | `/api/v1/auth/forgot-password` | No | Request a password reset email |
| `POST` | `/api/v1/auth/reset-password` | No | Reset password using a valid reset token |
| `POST` | `/api/v1/auth/verify-email` | No | Verify email address using a token from the verification email |

### 6.2 Business Management

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/businesses` | Yes | List all businesses for the authenticated user's organization |
| `DELETE` | `/api/v1/businesses/:businessId` | Yes | Soft-delete a business and cascade to related resources |

### 6.3 Team Invitations

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/businesses/:businessId/invitations` | Yes | Send a team invitation |
| `GET` | `/api/v1/businesses/:businessId/invitations` | Yes | List pending and past invitations |
| `DELETE` | `/api/v1/businesses/:businessId/invitations/:invitationId` | Yes | Revoke a pending invitation |
| `POST` | `/api/v1/businesses/:businessId/invitations/:invitationId/accept` | No (token) | Accept an invitation |
| `POST` | `/api/v1/businesses/:businessId/invitations/:invitationId/decline` | No (token) | Decline an invitation |

### 6.4 Knowledge Engine

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/businesses/:businessId/knowledge` | Yes | Upload or create a knowledge source |
| `GET` | `/api/v1/businesses/:businessId/knowledge` | Yes | List all knowledge sources |
| `GET` | `/api/v1/businesses/:businessId/knowledge/:knowledgeId` | Yes | Get a specific knowledge source |
| `PATCH` | `/api/v1/businesses/:businessId/knowledge/:knowledgeId` | Yes | Update a knowledge source |
| `DELETE` | `/api/v1/businesses/:businessId/knowledge/:knowledgeId` | Yes | Delete a knowledge source |

### 6.5 AI Conversations

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/businesses/:businessId/conversations` | Yes | Start a new AI conversation session |
| `GET` | `/api/v1/businesses/:businessId/conversations` | Yes | List conversation history |
| `GET` | `/api/v1/businesses/:businessId/conversations/:conversationId` | Yes | Get a specific conversation with messages |
| `POST` | `/api/v1/businesses/:businessId/conversations/:conversationId/messages` | Yes | Send a message and receive AI response |
| `DELETE` | `/api/v1/businesses/:businessId/conversations/:conversationId` | Yes | Delete a conversation |

### 6.6 Widget

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/businesses/:businessId/widget/config` | Yes | Get widget configuration |
| `PATCH` | `/api/v1/businesses/:businessId/widget/config` | Yes | Update widget configuration |
| `GET` | `/api/v1/widget/:businessId.js` | No | Serve the embeddable widget script |
| `POST` | `/api/v1/widget/:businessId/sessions` | No | Initialize a public widget session |
| `POST` | `/api/v1/widget/:businessId/sessions/:sessionId/messages` | No | Send a message through the public widget |

---

## 7. Token Structure

### Access Token Payload (JwtPayload)

```json
{
  "sub": "clx1234567890",
  "email": "jane@acme.com",
  "organizationId": "clx1122334455",
  "iat": 1723891200,
  "exp": 1723892100
}
```

| Field | Type | Description |
|---|---|---|
| `sub` | string | User ID |
| `email` | string | User email address |
| `organizationId` | string | Organization ID for tenant scoping |
| `iat` | number | Issued-at timestamp (seconds since epoch) |
| `exp` | number | Expiration timestamp (seconds since epoch) |

**Lifetime:** 15 minutes (default).

### Refresh Token Payload (RefreshTokenPayload)

```json
{
  "sub": "clx1234567890",
  "sessionId": "clx9988776655",
  "iat": 1723891200,
  "exp": 1724496000
}
```

| Field | Type | Description |
|---|---|---|
| `sub` | string | User ID |
| `sessionId` | string | Session ID (links to database record) |
| `iat` | number | Issued-at timestamp |
| `exp` | number | Expiration timestamp |

**Lifetime:** 30 days (default, `REFRESH_TOKEN_TTL`, e.g. `"30d"`; validated by Zod in `apps/api/src/config/env.validation.ts`). Single-use: rotation on refresh invalidates the previous token by replacing its stored hash (the session row is retained and `revokedAt` remains null).

---

## 8. Multi-Tenancy

All domain-specific queries are scoped by `organizationId`, extracted from the authenticated user's JWT. The API enforces the following invariant:

> A user may only access resources belonging to their own organization.

If a request targets a `businessId` that does not belong to the caller's `organizationId`, the API returns `404 Not Found` (not `403 Forbidden`) to prevent information disclosure.

---

## 9. Request Size Limits

| Resource | Maximum Size |
|---|---|
| JSON request body (all endpoints) | 1 MB |
| Password field | 128 characters |
| Business name | 200 characters |
| Business description | 2,000 characters |
| Domain string | 500 characters |

Requests exceeding the body size limit return `413 Payload Too Large`.

---

## 10. CORS Configuration

CORS is configured via the `CORS_ORIGINS` environment variable. When unset, CORS is disabled (browsers block cross-origin requests). When configured, only the specified origins are permitted.

**Allowed headers on preflight:**

```
Content-Type, Authorization, X-Requested-With
```

**Allowed methods:**

```
GET, POST, PATCH, DELETE, OPTIONS
```

---

## 11. Environment Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `JWT_SECRET` | Yes | -- | Signing key for JWTs (HS256) |
| `JWT_EXPIRATION` | Yes | -- | Access token lifetime (e.g., `15m`) |
| `PORT` | No | `3000` | Server listen port |
| `CORS_ORIGINS` | No | -- | Comma-separated allowed origins |
| `NODE_ENV` | No | `development` | Environment identifier |
| `LOG_LEVEL` | No | `info` | Logging verbosity |
| `THROTTLE_TTL` | No | `60000` | Rate limit window in milliseconds |
| `THROTTLE_LIMIT` | No | `10` | Rate limit max requests per window |
| `REFRESH_TOKEN_SECRET` | No | -- | Separate signing key for refresh tokens |

---

## Addendum — Domain & Onboarding Contract (2026-09-05)

> Supersedes any earlier section of this document that disagrees.
> Behaviour is specified in `16-DOMAIN-VERIFICATION-AND-TEST-MODE.md`; this is
> the wire format.

### A.1 Error shape

Every error carries a stable `code`. Clients switch on `code` and never parse
`message` — `message` is developer-facing and exists for logs.

```json
{
  "statusCode": 400,
  "code": "DOMAIN_VERIFICATION_MISMATCH",
  "message": "Verification record found but its value did not match",
  "timestamp": "2026-09-05T12:00:00.000Z"
}
```

A 500 now carries `code: "INTERNAL_ERROR"`. The `message` for an unhandled
failure is always the literal string `"Internal server error"` — no exception
detail is ever serialised.

### A.2 `POST /auth/register`

Now uses the standard envelope (D-03R). Previously a bare object.

```json
{
  "success": true,
  "message": "Workspace created successfully",
  "data": {
    "session": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 },
    "user": { "id": "...", "name": "...", "email": "...", "role": "OWNER" },
    "business": { "id": "...", "name": "..." },
    "organization": { "id": "...", "name": "..." }
  }
}
```

### A.3 Domain object

```jsonc
{
  "id": "…", "businessId": "…", "domain": "acme.com",
  "isPrimary": true,
  "status": "PENDING",          // PENDING | VERIFIED | DISABLED
  "isSandbox": false,           // reserved test domain — never serves live traffic
  "verifiedAt": null,
  "verificationMethod": null,   // DNS_TXT | HTML_META | SANDBOX | DEV_BYPASS
  "lastCheckedAt": "2026-09-05T12:00:00.000Z",
  "createdAt": "…"
}
```

`verificationToken` is **never** included here. It is returned only by the
instructions endpoint, to the organization that owns the domain.

### A.4 `POST /businesses/:businessId/domains/:domainId/verify`

Request: `{ "method": "DNS_TXT" | "HTML_META" | "SANDBOX" }`.

`DEV_BYPASS` is a fourth accepted value **only** on a server started with
`NODE_ENV != production` and `ALLOW_DEV_VERIFICATION_BYPASS=true`. Elsewhere it
is not a member of the accepted set, so it is rejected by the same validation
path — and with the same 422 body — as any unrecognised string. Probing for it
is indistinguishable from a typo.

Rate limit: **20 per organization per hour** (configurable).

**200 — verified**

```json
{ "success": true, "message": "Domain verified successfully",
  "data": { "domain": { "status": "VERIFIED", "verifiedAt": "…", "verificationMethod": "DNS_TXT" } } }
```

**200 — not found yet.** Not an error: this is the normal state during DNS
propagation, and the client renders a reassuring retry affordance.

```json
{ "success": true, "code": "DOMAIN_VERIFICATION_PENDING",
  "message": "Verification not found yet",
  "data": { "domain": { "status": "PENDING", "lastCheckedAt": "…" } } }
```

**400 — found but does not match**, `code: DOMAIN_VERIFICATION_MISMATCH`.

Other outcomes: `DOMAIN_ALREADY_VERIFIED` (400), `DOMAIN_SANDBOX_NOT_ELIGIBLE`
(400 — `SANDBOX` on a real domain), `DOMAIN_SANDBOX_ONLY` (400 — a live method
on a reserved test domain), `DOMAIN_NOT_FOUND` (404), `RATE_LIMITED` (429),
`AUTHZ_FORBIDDEN` (403). The complete 18-row matrix is in `16-…` §9.

### A.5 `GET …/domains/:domainId/verification-instructions?method=`

`htmlFileName` is **removed**. It belonged to the discarded file-only
mechanism.

```jsonc
// method=DNS_TXT
{ "success": true, "message": "DNS verification instructions",
  "data": { "method": "DNS_TXT", "isSandbox": false,
            "recordName": "_replyiq-verification.acme.com",
            "recordValue": "replyiq-verify-8f14e45f-…",
            "metaTag": null, "wellKnownPath": null, "wellKnownContent": null } }

// method=HTML_META
{ "success": true, "message": "Website verification instructions",
  "data": { "method": "HTML_META", "isSandbox": false,
            "recordName": null, "recordValue": null,
            "metaTag": "<meta name=\"replyiq-verification\" content=\"replyiq-verify-8f14e45f-…\">",
            "wellKnownPath": "/.well-known/replyiq-verification.txt",
            "wellKnownContent": "replyiq-verify-8f14e45f-…" } }

// a reserved test domain — the method parameter is ignored
{ "success": true, "message": "Test domain - no proof required",
  "data": { "method": "SANDBOX", "isSandbox": true,
            "sandboxReason": "example.com is reserved for documentation and testing",
            "recordName": null, "recordValue": null, "metaTag": null,
            "wellKnownPath": null, "wellKnownContent": null } }
```

Values are **byte-identical on every call** for the life of the domain, because
the token never changes.

### A.6 `DELETE …/domains/:domainId`

Query: `acknowledgeServiceInterruption=true` (optional).

Soft delete. When the target is the **last verified** domain and the flag is
absent, the request is refused with 409
`DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED` and nothing is modified. The check is
serialised by a row lock on the parent business, so two concurrent deletes
cannot both pass. Enforcing this on the API rather than only in a confirmation
dialog means the safety survives a script or a stale client.

```json
{ "success": true, "message": "Domain deleted successfully",
  "data": { "serviceMode": "INACTIVE" } }
```

`serviceMode` is returned so the client can show the resulting state without a
refetch race.

### A.7 `POST …/domains` — rate limit

**10 per organization per hour** (configurable). Duplicate names return 409
`DOMAIN_ALREADY_REGISTERED` with a message that never discloses which account
holds the claim.

### A.8 Business and onboarding objects

Both now carry a derived `serviceMode` of `LIVE`, `TEST` or `INACTIVE`,
computed from current domain rows on every read and never stored.
`status: "ACTIVE"` is never returned alongside an `onboardingStatus` other than
`"COMPLETED"`.

### A.9 Rate-limit summary

| Endpoint | Limit | Window | Keyed on |
|---|---|---|---|
| `POST /auth/register`, `/login`, `/refresh` | 10 | 60 s | IP |
| `POST …/domains` | 10 | 60 min | **Organization** |
| `POST …/domains/:id/verify` | 20 | 60 min | **Organization** |

The domain routes are keyed on the organization, not the IP: the abuse being
prevented is one tenant driving outbound requests, and that tenant can change
IP freely while a shared office NAT would otherwise penalise unrelated tenants.
