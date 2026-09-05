# Product Flows

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Product Owner

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


## Table of Contents

1. [Registration](#1-registration)
2. [Login](#2-login)
3. [Token Refresh](#3-token-refresh)
4. [Logout](#4-logout)
5. [Route Protection](#5-route-protection)
6. [Business Onboarding](#6-business-onboarding)
7. [Domain Verification](#7-domain-verification)
8. [Dashboard](#8-dashboard)
9. [Business Settings](#9-business-settings)
10. [Domains Management](#10-domains-management)
11. [Team Management (Planned)](#11-team-management-planned-milestone-4b)
12. [Knowledge Ingestion (Planned)](#12-knowledge-ingestion-planned-milestone-5)
13. [AI Receptionist (Planned)](#13-ai-receptionist-planned-milestone-6)
14. [Widget (Planned)](#14-widget-planned-milestone-7)

---

## 1. Registration

**Entry point:** `/register`
**API endpoint:** `POST /api/v1/auth/register`
**Authentication:** None (public)

### Happy Path

```
User                                System
  |                                   |
  |--- Navigate to /register -------->|
  |                                   |
  |<-- Render registration form ------|
  |                                   |
  |--- Fill form:                     |
  |    businessName                   |
  |    ownerName                      |
  |    email                          |
  |    password (12+ chars,           |
  |      uppercase, lowercase,        |
  |      number, special char)        |
  |                                   |
  |--- Submit form ------------------>|
  |                                   |
  |                                   |--- Validate input fields
  |                                   |    - businessName: 2-200 chars, trimmed
  |                                   |    - ownerName: 2-150 chars, trimmed
  |                                   |    - email: valid format, lowercased
  |                                   |    - password: regex validation
  |                                   |
  |                                   |--- Hash password (argon2)
  |                                   |--- Create Organization (name: normalized businessName)
  |                                   |--- Create Business (name, orgId, onboardingStatus: NOT_STARTED)
  |                                   |--- Create OnboardingProgress (all false)
  |                                   |--- Create User (role: OWNER, orgId, email, passwordHash)
  |                                   |--- Generate sessionId (crypto UUID)
  |                                   |--- Generate accessToken (JWT, 15min TTL)
  |                                   |--- Generate refreshToken (JWT, 30d TTL)
  |                                   |--- Hash refreshToken
  |                                   |--- Create Session (sessionId, userId, refreshTokenHash, expiresAt)
  |                                   |    All above in a single Prisma transaction
  |                                   |
  |<-- 201 Created:                   |
  |    { session, user, business,     |
  |      organization }               |
  |                                   |
  |--- Store tokens in localStorage --|
  |    (accessToken, refreshToken)    |
  |--- Store user + ids in authStore  |
  |--- Navigate to /onboarding ------->|
```

### Error Flows

```
User                                System
  |                                   |
  |--- Submit form ------------------>|
  |                                   |--- Validate input
  |                                   |    Missing/invalid field
  |<-- 400: Validation error ---------|
  |--- Display field errors ----------|

  |                                   |
  |--- Submit form ------------------>|
  |                                   |--- Email unique constraint violation
  |                                   |    (Prisma P2002 error)
  |<-- 409: "Email already in use" ---|
  |--- Display error banner ----------|

  |                                   |
  |--- Submit form ------------------>|
  |                                   |--- Unexpected server error
  |<-- 500: Generic error ------------|
  |--- Display:                       |
  |    "An error occurred.            |
  |     Please try again."           |
```

### Validation Rules

| Field         | Type   | Min Length | Max Length | Pattern/Notes                                   |
|---------------|--------|------------|------------|-------------------------------------------------|
| businessName  | string | 2          | 200        | Trimmed, internal whitespace collapsed to single |
| ownerName     | string | 2          | 150        | Trimmed, internal whitespace collapsed to single |
| email         | string | -          | -          | Valid email format, lowercased, trimmed           |
| password      | string | 12         | 128        | `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{12,}$` |

### Side Effects

- Organization created with `name` from `businessName`
- Business created with `onboardingStatus: NOT_STARTED`
- OnboardingProgress record created (all flags false)
- User created with `role: OWNER`
- Session created with refreshTokenHash and expiresAt
- Rate limiting applied (ThrottlerGuard)

---

## 2. Login

**Entry point:** `/login`
**API endpoint:** `POST /api/v1/auth/login`
**Authentication:** None (public)

### Happy Path

```
User                                System
  |                                   |
  |--- Navigate to /login ------------>|
  |                                   |
  |<-- Render login form -------------|
  |                                   |
  |--- Fill form:                     |
  |    email                          |
  |    password                       |
  |                                   |
  |--- Submit form ------------------>|
  |                                   |
  |                                   |--- Validate input
  |                                   |--- Find user by email (lowercased)
  |                                   |--- Verify password (argon2)
  |                                   |--- Generate sessionId
  |                                   |--- Generate accessToken (JWT, 15min)
  |                                   |--- Generate refreshToken (JWT, 30d)
  |                                   |--- Hash refreshToken
  |                                   |--- Create Session record
  |                                   |--- Look up business by orgId
  |                                   |
  |<-- 200 OK:                        |
  |    { data: { user,                |
  |      accessToken, refreshToken }} |
  |                                   |
  |--- Store tokens in localStorage --|
  |--- Store user in authStore -------|
  |--- Navigate to /dashboard -------->|
```

### Error Flows

```
User                                System
  |                                   |
  |--- Submit form ------------------>|
  |                                   |--- User not found OR password invalid
  |<-- 401: "Invalid email or        |
  |    password" (generic message) ---|
  |--- Display error banner ----------|
  |    (same message for both cases   |
  |     to prevent user enumeration)  |

  |                                   |
  |--- Submit form ------------------>|
  |                                   |--- Unexpected error
  |<-- 500: Generic error ------------|
  |--- Display:                       |
  |    "An error occurred.            |
  |     Please try again."           |
```

### Security Notes

- Generic error message "Invalid email or password" used for both non-existent email and incorrect password to prevent user enumeration
- Rate limiting applied (ThrottlerGuard)
- Email is lowercased and trimmed before lookup

---

## 3. Token Refresh

**API endpoint:** `POST /api/v1/auth/refresh`
**Authentication:** None (uses refreshToken)

### Happy Path

```
Frontend                            System
  |                                   |
  |--- Detect 401 response OR -------|
  |    approaching token expiry       |
  |                                   |
  |--- POST /auth/refresh ----------->
  |    { refreshToken } ------------->|
  |                                   |
  |                                   |--- Verify refreshToken JWT signature
  |                                   |--- Find session by sessionId
  |                                   |--- Check session not revoked (revokedAt is null)
  |                                   |--- Check session not expired (expiresAt > now)
  |                                   |--- Verify refreshToken hash matches stored hash
  |                                   |--- Look up user by userId
  |                                   |--- Generate new accessToken (JWT, 15min)
  |                                   |--- Generate new refreshToken (JWT, 30d)
  |                                   |--- Hash new refreshToken
  |                                   |--- Update session: replace refreshTokenHash
  |                                   |--- Update session: updateLastUsed timestamp
  |                                   |
  |<-- 200 OK:                        |
  |    { data: { user,                |
  |      accessToken, refreshToken }} |
  |                                   |
  |--- Store new tokens -------------|
  |--- Update authStore -------------|
  |--- Retry original request ------->|
```

### Error Flows

```
Frontend                            System
  |                                   |
  |--- POST /auth/refresh ----------->
  |    { refreshToken } ------------->|
  |                                   |--- JWT verification fails
  |<-- 401: "Invalid or expired      |
  |    refresh token" ----------------|

  |                                   |
  |--- POST /auth/refresh ----------->
  |    { refreshToken } ------------->|
  |                                   |--- Session not found
  |<-- 401: "Session not found" ------|

  |                                   |
  |--- POST /auth/refresh ----------->
  |    { refreshToken } ------------->|
  |                                   |--- Session revoked (revokedAt set)
  |<-- 401: "Session has been        |
  |    revoked" ----------------------|

  |                                   |
  |--- POST /auth/refresh ----------->
  |    { refreshToken } ------------->|
  |                                   |--- Session expired (expiresAt < now)
  |<-- 401: "Session has expired" ----|

  |                                   |
  |--- POST /auth/refresh ----------->
  |    { refreshToken } ------------->|
  |                                   |--- Token hash mismatch
  |<-- 401: "Invalid refresh token" --|
  |                                   |
  |--- All 401 cases: ---------------|
  |    Clear tokens from localStorage |
  |    Clear authStore ---------------|
  |    Redirect to /login ------------>|
```

### Token Lifetimes

| Token        | Default TTL | Notes                                    |
|--------------|-------------|------------------------------------------|
| accessToken  | 15 minutes  | Short-lived, used in Authorization header|
| refreshToken | 30 days     | Long-lived, stored in localStorage       |

---

## 4. Logout

**Entry point:** User action (button, navigation)
**API endpoint:** `POST /api/v1/auth/logout`
**Authentication:** Bearer token required (access token)

### Happy Path

```
User                                System
  |                                   |
  |--- Click "Logout" --------------->|
  |                                   |
  |--- POST /auth/logout             |
  |    Headers: Authorization:       |
  |    Bearer {accessToken} -------->|
  |                                   |
  |                                   |--- JwtAuthGuard: verify accessToken
  |                                   |--- Extract sessionId from JWT payload
  |                                   |--- Find session by sessionId
  |                                   |--- Check session not already revoked
  |                                   |--- Set revokedAt = now on session
  |                                   |
  |<-- 200 OK:                        |
  |    { success: true,               |
  |      message: "Logged out         |
  |      successfully" }              |
  |                                   |
  |--- Clear accessToken from -------|
  |    localStorage                   |
  |--- Clear refreshToken from ------|
  |    localStorage                   |
  |--- Clear authStore ---------------|
  |--- Navigate to /login ------------>|
```

### Error Flows

```
User                                System
  |                                   |
  |--- POST /auth/logout ------------>|
  |                                   |--- Session not found
  |<-- 401: "Session not found" ------|
  |--- Clear tokens anyway ---------->|
  |--- Navigate to /login ------------>|

  |                                   |
  |--- POST /auth/logout ------------>|
  |                                   |--- Session already revoked
  |<-- 401: "Session already revoked"|
  |--- Treat as success --------------|
  |--- Clear tokens anyway ---------->|
  |--- Navigate to /login ------------>|
```

### Notes

- Frontend always clears local state and redirects to `/login` regardless of API response
- Expired access tokens are handled by the JWT guard; if the access token is already expired, the logout request still proceeds by clearing local state

---

## 5. Route Protection

**Component:** `ProtectedRoute`
**Location:** `apps/web/src/components/auth/ProtectedRoute.tsx`

### Flow

```
User                                Frontend
  |                                   |
  |--- Navigate to protected route -->|
  |    (e.g., /dashboard)            |
  |                                   |
  |                                   |--- Check authStore.isAuthenticated
  |                                   |
  |    [if NOT authenticated]         |
  |                                   |
  |<-- Redirect to /login -----------|
  |    state: { from: originalPath } |
  |                                   |
  |    [if authenticated]             |
  |                                   |
  |<-- Render child route via Outlet |
```

### Notes

- `isAuthenticated` is derived from the presence of tokens and user data in the Zustand auth store
- The `from` state is preserved so login can redirect back to the originally requested page (though current login implementation always goes to `/dashboard`)
- Unauthenticated users accessing any protected route are silently redirected to `/login`

---

## 6. Business Onboarding

**Entry point:** `/onboarding` (redirected after registration)
**API endpoints:**
- `GET /api/v1/businesses/:businessId/onboarding` (progress)
- `PATCH /api/v1/businesses/:businessId/onboarding/steps` (advance step)
- `PATCH /api/v1/businesses/:businessId` (update business profile)
- `POST /api/v1/businesses/:businessId/domains` (add domain)
- `POST /api/v1/businesses/:businessId/domains/:domainId/verify` (verify domain)
- `GET /api/v1/businesses/:businessId/domains/:domainId/verification-instructions`

**Authentication:** Bearer token required

### Onboarding Status Machine

```
NOT_STARTED --> IN_PROGRESS --> DOMAIN_PENDING --> COMPLETED
```

### Onboarding Progress Flags

| Flag                 | Set When                |
|----------------------|-------------------------|
| profileCompleted     | Step 0 (PROFILE) done   |
| firstDomainAdded     | Step 1 (FIRST_DOMAIN) done |
| firstDomainVerified  | Step 2 (DOMAIN_VERIFICATION) done |
| onboardingCompleted  | Step 3 (COMPLETE) done  |

### Step 0: Business Profile

```
User                                System
  |                                   |
  |--- Navigate to /onboarding ------>|
  |                                   |--- GET /businesses/:id/onboarding
  |                                   |    (check auth, get progress)
  |                                   |
  |<-- Render Step 0: Profile --------|
  |    (first incomplete step)        |
  |                                   |
  |--- Fill form:                     |
  |    industry                       |
  |    description                    |
  |    websiteUrl                     |
  |                                   |
  |--- Click "Save & Continue" ------>|
  |                                   |
  |                                   |--- PATCH /businesses/:id
  |                                   |    { industry, description, websiteUrl }
  |                                   |--- PATCH /onboarding/steps
  |                                   |    { step: "PROFILE" }
  |                                   |
  |                                   |--- Upsert OnboardingProgress
  |                                   |    profileCompleted: true
  |                                   |--- If status was NOT_STARTED:
  |                                   |    Update to IN_PROGRESS
  |                                   |
  |<-- Updated progress --------------|
  |--- Advance to Step 1 ------------>|
```

### Step 1: Add Domain

```
User                                System
  |                                   |
  |<-- Render Step 1: Add Domain -----|
  |    (shows existing domains        |
  |     if any)                       |
  |                                   |
  |--- Enter domain: example.com ---->|
  |                                   |
  |    Client-side normalization:     |
  |    - Trim whitespace              |
  |    - Lowercase                    |
  |    - Strip https:// and http://   |
  |    - Strip www.                   |
  |    - Strip trailing slashes       |
  |                                   |
  |    Client-side validation:        |
  |    - Regex: domain format         |
  |                                   |
  |--- Click "Add Domain" ----------->|
  |                                   |
  |                                   |--- POST /businesses/:id/domains
  |                                   |    { domain: "example.com" }
  |                                   |
  |                                   |--- Check domain uniqueness
  |                                   |--- Generate verificationToken
  |                                   |    (replyiq-verify-{uuid})
  |                                   |--- Create BusinessDomain record
  |                                   |    status: PENDING
  |                                   |
  |<-- Domain created ----------------|
  |                                   |
  |--- Click "Add Domain" onboarding |
  |    step ------------------------->|
  |                                   |
  |                                   |--- PATCH /onboarding/steps
  |                                   |    { step: "FIRST_DOMAIN" }
  |                                   |
  |                                   |--- Update progress:
  |                                   |    firstDomainAdded: true
  |                                   |--- Update business:
  |                                   |    onboardingStatus: DOMAIN_PENDING
  |                                   |
  |<-- Updated progress --------------|
  |--- Advance to Step 2 ------------>|
```

### Step 2: Domain Verification

See [Domain Verification](#7-domain-verification) for the complete verification flow.

```
User                                System
  |                                   |
  |<-- Render Step 2: Verify Domain --|
  |                                   |
  |    [If domain already verified]   |
  |<-- Show "Domain is already       |
  |    verified" banner --------------|
  |<-- Render "Continue" button ----->|
  |                                   |
  |    [If domain NOT verified]       |
  |    Show verification method       |
  |    selection (DNS_TXT / HTML_META)|
  |    Show instructions              |
  |    Show "Verify Domain" button    |
  |                                   |
  |--- Complete verification -------->|
  |--- Click "Continue" ------------->|
  |                                   |
  |                                   |--- PATCH /onboarding/steps
  |                                   |    { step: "DOMAIN_VERIFICATION" }
  |                                   |
  |                                   |--- Requires verified domain to exist
  |                                   |--- Update progress:
  |                                   |    firstDomainVerified: true
  |                                   |
  |<-- Updated progress --------------|
  |--- Advance to Step 3 ------------>|
```

### Step 3: Complete Onboarding

```
User                                System
  |                                   |
  |<-- Render Step 3: Complete -------|
  |    "Ready for Knowledge          |
  |     Ingestion"                   |
  |    "Your business profile is     |
  |     complete and your domain     |
  |     is verified."                |
  |                                   |
  |--- Click "Complete Onboarding" -->|
  |                                   |
  |                                   |--- PATCH /onboarding/steps
  |                                   |    { step: "COMPLETE" }
  |                                   |
  |                                   |--- Requires firstDomainVerified
  |                                   |--- Update progress:
  |                                   |    onboardingCompleted: true
  |                                   |--- Update business:
  |                                   |    onboardingStatus: COMPLETED
  |                                   |
  |<-- Updated progress --------------|
  |                                   |
  |--- Page re-renders with ---------|
  |    onboardingStatus === COMPLETED |
  |<-- Show "Onboarding Complete" ---|
  |    "Go to Dashboard" button       |
  |                                   |
  |--- Click "Go to Dashboard" ----->|
  |--- Navigate to /dashboard ------->|
```

### Onboarding Page Behavior

| onboardingStatus  | Page Behavior                                      |
|-------------------|----------------------------------------------------|
| NOT_STARTED       | Shows Step 0 (Profile) as active                   |
| IN_PROGRESS       | Shows first incomplete step as active               |
| DOMAIN_PENDING    | Shows verification step or next incomplete step     |
| COMPLETED         | Shows "Onboarding Complete" with "Go to Dashboard" |

### Progress Bar

The onboarding page displays a progress bar with 4 segments:
- Green: completed steps
- Blue: currently active step
- Gray: future steps

Each step also appears as a numbered list item below the progress bar with the same color coding.

### Step Ordering Constraints

Steps MUST be completed in order. The system enforces:

1. `FIRST_DOMAIN` requires `profileCompleted === true`
2. `DOMAIN_VERIFICATION` requires `firstDomainAdded === true` AND a verified domain exists
3. `COMPLETE` requires `firstDomainVerified === true`

Attempting to skip a step returns 400 Bad Request.

### Error Flows

```
User                                System
  |                                   |
  |--- Submit profile form --------->|
  |                                   |--- Business not found
  |<-- 404: "Business not found" ----|

  |                                   |
  |--- Add domain step -------------->|
  |                                   |--- Profile not completed
  |<-- 400: "Complete profile        |
  |    step first" -------------------|

  |                                   |
  |--- Verify domain step ----------->|
  |                                   |--- No domain added yet
  |<-- 400: "Add a domain first" ----|

  |                                   |
  |--- Complete step ---------------->|
  |                                   |--- No verified domain
  |<-- 400: "Verify a domain first" --|

  |                                   |
  |--- Any step --------------------->
  |                                   |--- Onboarding already completed
  |<-- 400: "Onboarding is already   |
  |    completed" --------------------|

  |                                   |
  |--- Any request ------------------>|
  |                                   |--- User's orgId doesn't match
  |                                   |    business's orgId
  |<-- 403: "Access denied" ---------|

  |                                   |
  |--- Any request ------------------>|
  |                                   |--- Business not found
  |<-- 404: "Business not found" ----|
```

---

## 7. Domain Verification

**API endpoints:**
- `POST /api/v1/businesses/:businessId/domains/:domainId/verify`
- `GET /api/v1/businesses/:businessId/domains/:domainId/verification-instructions`

**Authentication:** Bearer token required

### DNS TXT Verification

```
User                                System
  |                                   |
  |--- Select DNS TXT method -------->|
  |                                   |
  |--- GET /verification-instructions |
  |    ?method=DNS_TXT -------------->|
  |                                   |
  |                                   |--- Generate recordName:
  |                                   |    _replyiq-verification.{domain}
  |                                   |--- Return recordValue:
  |                                   |    (verificationToken)
  |                                   |
  |<-- Instructions:                  |
  |    Record Name:                   |
  |    _replyiq-verification.example.com |
  |    Record Value:                  |
  |    replyiq-verify-{uuid}         |
  |                                   |
  |--- User adds TXT record to DNS --|
  |    (via DNS provider)             |
  |                                   |
  |--- Click "Verify Domain" ------->|
  |                                   |
  |                                   |--- POST /domains/:id/verify
  |                                   |    { method: "DNS_TXT" }
  |                                   |
  |                                   |--- Server-side DNS lookup:
  |                                   |    resolveTxt(_replyiq-verification.{domain})
  |                                   |--- Compare TXT record value with token
  |                                   |
  |    [Match]                        |
  |                                   |--- Update domain status: VERIFIED
  |                                   |--- Set verifiedAt: now
  |                                   |--- Set verificationMethod: DNS_TXT
  |                                   |--- Update onboarding progress:
  |                                   |    firstDomainVerified: true
  |<-- 200: "Domain verified" --------|
  |                                   |
  |    [No match]                     |
  |<-- 400: "Verification failed..." |
  |                                   |
  |    [DNS lookup fails - record     |
  |     not found / not propagated]   |
  |<-- 200: "Verification pending" --|
  |    (PENDING status)               |
  |--- User sees retry prompt ------->|
```

### HTML Meta Verification

```
User                                System
  |                                   |
  |--- Select HTML META method ------>|
  |                                   |
  |--- GET /verification-instructions |
  |    ?method=HTML_META ------------->|
  |                                   |
  |                                   |--- Return:
  |                                   |    htmlFileName: replyiq-verification.html (legacy; the meta tag is now the primary placement)
  |                                   |    htmlContent: replyiq-verify:{token}
  |                                   |
  |<-- Instructions:                  |
  |    Create file at                 |
  |    /replyiq-verification.html (legacy; the meta tag is now the primary placement)     |
  |    with content:                  |
  |    replyiq-verify:{token}        |
  |                                   |
  |--- User creates HTML file ------->|
  |    on their website               |
  |                                   |
  |--- Click "Verify Domain" ------->|
  |                                   |
  |                                   |--- POST /domains/:id/verify
  |                                   |    { method: "HTML_META" }
  |                                   |
  |                                   |--- Server-side HTTP fetch:
  |                                   |    GET http://{domain}/replyiq-verification.html (legacy; the meta tag is now the primary placement)
  |                                   |    (5 second timeout)
  |                                   |--- Compare body with expected content
  |                                   |
  |    [Match]                        |
  |<-- 200: "Domain verified" --------|
  |                                   |
  |    [No match or fetch fails]      |
  |<-- 200: "Verification pending" --|
  |    or 400: "Verification failed"  |
```

### Verification Status Codes

| Status   | Meaning                                           |
|----------|---------------------------------------------------|
| VERIFIED | Challenge record found and matches token           |
| FAILED   | Record found but value does not match token        |
| PENDING  | Record not found / DNS not propagated / fetch timeout |

### Edge Cases

- **Already verified domain:** Attempting to verify again returns 400 "Domain is already verified"
- **No verification token:** Returns 400 "No verification token available"
- **Verification timeout:** HTML meta fetch has a 5-second timeout; DNS resolution failures return PENDING
- **DNS propagation delay:** DNS can take up to 48 hours; user is advised to retry after a few minutes
- **Multiple verification attempts:** User can retry as many times as needed; the challenge token does not change
- **Cross-organization access:** Attempting to verify a domain belonging to another organization returns 403 "Access denied"

---

## 8. Dashboard

**Entry point:** `/dashboard` (redirected after login)
**Authentication:** Bearer token required

### Happy Path

```
User                                System
  |                                   |
  |--- Navigate to /dashboard ------->|
  |                                   |
  |                                   |--- GET /businesses/:id (load business)
  |                                   |--- GET /businesses/:id/onboarding (progress)
  |                                   |
  |<-- Render dashboard --------------|
  |                                   |
  |    Content displayed:             |
  |    - Welcome message with user    |
  |      name                         |
  |    - Onboarding status badge      |
  |      (color-coded)                |
  |    - Status message:              |
  |      COMPLETED:                   |
  |        "Your business is set up   |
  |         and ready for knowledge   |
  |         ingestion."               |
  |      NOT COMPLETED:               |
  |        "Complete your business    |
  |         setup to get started      |
  |         with your AI Receptionist."|
  |    - "Continue Setup" button      |
  |      (if not completed)           |
  |    - Setup Progress card          |
  |      (if not completed)           |
  |      - Progress bar with %        |
  |      - Step list with checkmarks  |
  |    - Business info cards:         |
  |      - Business name + industry   |
  |      - Website URL (or "Not set") |
  |      - Quick Links:               |
  |        - Business Settings        |
  |        - Manage Domains           |
```

### Empty States

| Condition              | Dashboard Shows                                     |
|------------------------|-----------------------------------------------------|
| No business data       | Loading skeleton (animated placeholders)            |
| No websiteUrl set      | "Not set" in Website card                           |
| No industry set        | Industry field hidden from Business card            |
| Onboarding incomplete  | "Continue Setup" button + progress card              |
| Onboarding complete    | Ready message, no progress card                      |

### Status Badge Variants

| onboardingStatus  | Badge Label       | Badge Color |
|-------------------|-------------------|-------------|
| NOT_STARTED       | Not Started        | Gray        |
| IN_PROGRESS       | In Progress        | Blue        |
| DOMAIN_PENDING    | Domain Pending     | Yellow      |
| COMPLETED         | Complete           | Green       |

---

## 9. Business Settings

**Entry point:** `/dashboard/settings`
**API endpoint:** `PATCH /api/v1/businesses/:businessId`
**Authentication:** Bearer token required

### Happy Path

```
User                                System
  |                                   |
  |--- Navigate to /dashboard/settings >|
  |                                   |
  |                                   |--- GET /businesses/:id
  |                                   |
  |<-- Render settings form ----------|
  |    Fields:                        |
  |    - Business Name (required)     |
  |    - Industry                     |
  |    - Description                  |
  |    - Website URL                  |
  |                                   |
  |--- Edit fields ------------------>|
  |                                   |
  |--- Click "Save Changes" --------->|
  |                                   |
  |                                   |--- PATCH /businesses/:id
  |                                   |    { name, industry, description, websiteUrl }
  |                                   |
  |<-- 200 OK: Business updated ------|
  |                                   |
  |--- Show success banner ---------->|
  |    "Settings saved successfully." |
```

### Error Flows

```
User                                System
  |                                   |
  |--- Click "Save Changes" --------->|
  |                                   |--- Validation error or server error
  |<-- Error response ----------------|
  |--- Display error banner ---------|
```

### Loading State

- While business data loads, a skeleton placeholder is displayed
- The form is populated once data arrives (synced via useEffect with a ref guard)
- The "Save Changes" button shows a loading spinner during submission

---

## 10. Domains Management

**Entry point:** `/dashboard/domains`
**API endpoints:**
- `GET /api/v1/businesses/:businessId/domains` (list)
- `POST /api/v1/businesses/:businessId/domains` (create)
- `POST /api/v1/businesses/:businessId/domains/:domainId/verify` (verify)
- `GET /api/v1/businesses/:businessId/domains/:domainId/verification-instructions`
- `DELETE /api/v1/businesses/:businessId/domains/:domainId` (soft delete)

**Authentication:** Bearer token required

### List Domains

```
User                                System
  |                                   |
  |--- Navigate to /dashboard/domains >|
  |                                   |
  |                                   |--- GET /businesses/:id/domains
  |                                   |
  |<-- Render domains list -----------|
  |                                   |
  |    [if no domains]                |
  |<-- "No domains added yet." ------|
  |                                   |
  |    [if domains exist]             |
  |    For each domain:               |
  |    - Domain name                  |
  |    - Status: Verified (green)     |
  |            or Pending (yellow)    |
  |    - Verify button (if pending)   |
  |    - Delete button (always)       |
```

### Add Domain

```
User                                System
  |                                   |
  |--- Enter domain in input -------->|
  |                                   |
  |    Client-side validation:        |
  |    - Trim + lowercase             |
  |    - Strip protocol + www         |
  |    - Regex validation             |
  |                                   |
  |--- Click "Add Domain" ----------->|
  |                                   |
  |                                   |--- POST /businesses/:id/domains
  |                                   |    { domain: "example.com" }
  |                                   |
  |                                   |--- Check domain uniqueness (global)
  |                                   |--- Generate verificationToken
  |                                   |--- Create BusinessDomain (PENDING)
  |                                   |
  |<-- Domain created ----------------|
  |--- Input cleared ---------------->|
  |--- Domain appears in list -------->|
```

### Add Domain Errors

```
User                                System
  |                                   |
  |--- Submit invalid domain -------->|
  |    (client-side validation)       |
  |<-- Field error: "Please enter    |
  |    a valid domain name" ----------|

  |                                   |
  |--- Submit domain already in use ->|
  |                                   |--- Conflict (unique constraint)
  |<-- 409: "Domain already          |
  |    registered" -------------------|
  |--- Display error banner ---------|
```

### Verify Domain (from Domains page)

```
User                                System
  |                                   |
  |--- Click "Verify" on a pending   |
  |    domain ----------------------->|
  |                                   |
  |<-- Open VerifyModal -------------|
  |    - Method selection radio       |
  |    - Instructions panel           |
  |    - Verify button                |
  |    - Cancel button                |
  |                                   |
  |--- Select method (DNS_TXT or     |
  |    HTML_META) -------------------->|
  |                                   |
  |--- GET /verification-instructions |
  |    ?method={selected} ----------->|
  |                                   |
  |<-- Show instructions ------------>|
  |                                   |
  |--- Follow instructions           |
  |    (add DNS record or create file)|
  |                                   |
  |--- Click "Verify" --------------->|
  |                                   |
  |                                   |--- POST /domains/:id/verify
  |                                   |    { method }
  |                                   |
  |    [if verified]                  |
  |<-- Modal closes ---------------->|
  |--- Domain status updates to      |
  |    "Verified" in list ------------>|
  |                                   |
  |    [if pending/not propagated]    |
  |<-- Show yellow banner:           |
  |    "Verification pending..." ---->|
  |--- User can retry later -------->|
  |                                   |
  |    [if failed]                    |
  |<-- Show error in modal ---------->|
```

### Delete Domain

```
User                                System
  |                                   |
  |--- Click "Delete" on a domain -->|
  |                                   |
  |                                   |--- DELETE /businesses/:id/domains/:domainId
  |                                   |
  |                                   |--- Soft delete (set deletedAt: now)
  |                                   |--- Domain removed from future queries
  |                                   |
  |<-- Domain removed from list ----->|
```

### Edge Cases

- **Delete verified domain:** Allowed; domain is soft-deleted and no longer listed
- **Delete last domain during onboarding:** Domain still deleted; onboarding may need re-verification
- **Add domain while verify modal is open for another domain:** Modal state preserved; new domain can be selected
- **Multiple domains:** All listed; ordered by isPrimary (desc), then createdAt (asc)
- **Cross-business access:** Domain operations are scoped to the business; access denied if business belongs to different organization

---

## 11. Team Management (Planned, Milestone 4B)

> **Status:** Not implemented

### Planned Flows

#### Invite Team Member

```
Owner                               System
  |                                   |
  |--- Navigate to Team page -------->|
  |                                   |
  |--- Click "Invite Member" ------->|
  |                                   |
  |--- Enter email and role --------->|
  |    (ADMIN, MEMBER, VIEWER)        |
  |                                   |
  |--- Submit invitation ------------>|
  |                                   |
  |                                   |--- Create Invitation record
  |                                   |--- Generate invitation token
  |                                   |--- Send invitation email
  |                                   |
  |<-- "Invitation sent" ------------|
```

#### Accept Invitation

```
Invitee                             System
  |                                   |
  |--- Click link in email ---------->|
  |                                   |
  |--- Navigate to /invite/:token --->|
  |                                   |
  |                                   |--- Validate token
  |                                   |--- Check expiry
  |                                   |
  |    [if new user]                  |
  |--- Create account form ---------->|
  |                                   |--- Create User record
  |                                   |--- Add to organization
  |                                   |
  |    [if existing user]             |
  |--- Confirm acceptance ----------->|
  |                                   |--- Add to organization
  |                                   |--- Mark invitation accepted
  |                                   |
  |<-- Redirect to dashboard -------->|
```

#### Decline Invitation

```
Invitee                             System
  |                                   |
  |--- Click "Decline" ------------->|
  |                                   |
  |                                   |--- Mark invitation declined
  |                                   |
  |<-- "Invitation declined" --------|
```

#### Manage Roles

```
Owner                               System
  |                                   |
  |--- Navigate to Team page -------->|
  |                                   |
  |--- View member list ------------->|
  |                                   |
  |--- Change member role ----------->|
  |    (ADMIN, MEMBER, VIEWER)        |
  |                                   |
  |                                   |--- Update UserRole
  |<-- Role updated ---------------->|
```

#### Remove Member

```
Owner                               System
  |                                   |
  |--- Click "Remove" on member ---->|
  |                                   |
  |--- Confirm removal -------------->|
  |                                   |
  |                                   |--- Soft delete user membership
  |                                   |--- Revoke all active sessions
  |                                   |
  |<-- Member removed from list ---->|
```

### Empty States

| Condition                | UI Shows                                    |
|--------------------------|---------------------------------------------|
| No team members          | "No team members yet. Invite someone."      |
| No pending invitations   | No pending invitations section              |
| Owner viewing self       | Role badge shows "Owner", no remove option  |

---

## 12. Knowledge Ingestion (Planned, Milestone 5)

> **Status:** Not implemented

### Planned Flows

#### Upload Documents

```
User                                System
  |                                   |
  |--- Navigate to Knowledge page --->|
  |                                   |
  |--- Click "Upload Document" ----->|
  |                                   |
  |--- Select file(s) from disk ---->|
  |    Supported: PDF, DOCX, TXT,    |
  |    Markdown                       |
  |                                   |
  |--- Click "Upload" -------------->|
  |                                   |
  |                                   |--- Validate file types and sizes
  |                                   |--- Store files (S3 / local storage)
  |                                   |--- Queue for text extraction
  |                                   |--- Create KnowledgeSource records
  |                                   |
  |<-- Upload progress -------------->|
  |<-- "Documents uploaded" ---------|
  |                                   |
  |                                   |--- Background: extract text
  |                                   |--- Background: chunk content
  |                                   |--- Background: generate embeddings
  |                                   |--- Background: store in vector DB
```

#### Add URLs for Scraping

```
User                                System
  |                                   |
  |--- Click "Add URL" ------------->|
  |                                   |
  |--- Enter URL -------------------->|
  |    (https://example.com/page)     |
  |                                   |
  |--- Click "Add" ----------------->|
  |                                   |
  |                                   |--- Validate URL format
  |                                   |--- Create KnowledgeSource (URL type)
  |                                   |--- Queue for scraping
  |                                   |
  |<-- "URL added, scraping..." ---->|
  |                                   |
  |                                   |--- Background: fetch page content
  |                                   |--- Background: extract text
  |                                   |--- Background: chunk + embed + store
```

#### Create FAQ Entries

```
User                                System
  |                                   |
  |--- Click "Add FAQ" ------------->|
  |                                   |
  |--- Enter question --------------->|
  |--- Enter answer ----------------->|
  |                                   |
  |--- Click "Save" ---------------->|
  |                                   |
  |                                   |--- Create FAQ record
  |                                   |--- Generate embeddings
  |                                   |
  |<-- FAQ saved -------------------->|
```

#### Manage Knowledge Sources

```
User                                System
  |                                   |
  |--- View knowledge sources list -->|
  |    For each source:               |
  |    - Name / URL / FAQ title       |
  |    - Type (Document, URL, FAQ)    |
  |    - Status (Processing, Ready,   |
  |      Failed)                      |
  |    - Last updated                 |
  |    - Actions: Edit, Delete        |
  |                                   |
  |--- Click "Delete" on source ---->|
  |                                   |
  |--- Confirm deletion ------------->|
  |                                   |
  |                                   |--- Remove source
  |                                   |--- Remove associated embeddings
  |<-- Source removed from list ---->|
```

### Empty States

| Condition             | UI Shows                                        |
|-----------------------|-------------------------------------------------|
| No knowledge sources  | "No knowledge sources yet. Upload documents, add URLs, or create FAQs to get started." |
| Processing            | "Processing... This may take a few minutes."     |
| Failed                | "Processing failed. Click to retry."             |

---

## 13. AI Receptionist (Planned, Milestone 6)

> **Status:** Not implemented

### Planned Flows

#### Configure AI Behavior

```
User                                System
  |                                   |
  |--- Navigate to AI Settings ----->|
  |                                   |
  |--- Configure:                    |
  |    - System prompt               |
  |    - Tone (formal, casual, etc.) |
  |    - Response length preference  |
  |    - Business hours              |
  |    - Fallback message            |
  |                                   |
  |--- Click "Save" ---------------->|
  |                                   |
  |                                   |--- Validate configuration
  |                                   |--- Store AI config
  |<-- "Settings saved" ------------>|
```

#### Conversation Management

```
Visitor                             AI Receptionist
  |                                   |
  |--- Send message --------------->|
  |                                   |
  |                                   |--- Receive message
  |                                   |--- Retrieve relevant knowledge
  |                                   |--- Generate response
  |                                   |--- Log conversation
  |                                   |
  |<-- AI response ---------------->|
  |                                   |
  |--- Continue conversation ------>|
  |                                   |
  |    [if outside business hours]   |
  |<-- "We're currently offline.    |
  |     Leave your details and      |
  |     we'll get back to you." --->|
```

#### Lead Capture

```
Visitor                             AI Receptionist
  |                                   |
  |--- Conversation in progress ---->|
  |                                   |
  |    [AI detects potential lead]    |
  |<-- "I'd love to connect you     |
  |     with our team. Could I get  |
  |     your name and email?" ----->|
  |                                   |
  |--- Provide contact info -------->|
  |                                   |
  |                                   |--- Store lead in CRM/leads table
  |                                   |--- Notify team (email/webhook)
  |<-- "Thanks! We'll be in touch" >|
```

#### Human Handoff

```
Visitor                             AI              Agent
  |                                   |               |
  |--- Request to speak to human --->|               |
  |                                   |               |
  |                                   |--- Check agent|
  |                                   |    availability|
  |                                   |               |
  |    [if agent available]           |               |
  |<-- "Connecting you to a team  ---|               |
  |     member..."                   |               |
  |                                   |--- Route to   |
  |                                   |    agent ---->|
  |                                   |               |
  |<------------------------------------------- Agent joins
  |                                   |               |
  |    [if no agent available]        |               |
  |<-- "All agents are busy. Leave  --|               |
  |     your details and we'll      --|               |
  |     connect you shortly."        --|               |
```

---

## 14. Widget (Planned, Milestone 7)

> **Status:** Not implemented

### Planned Flows

#### Install Widget

```
User                                System
  |                                   |
  |--- Navigate to Widget page ----->|
  |                                   |
  |<-- Display embed code:           |
  |    <script src="..."></script>   |
  |    + configuration options       |
  |                                   |
  |--- Copy embed code ------------>|
  |                                   |
  |--- Paste into website <head> --->|
  |                                   |
  |                                   |--- Widget initializes on page load
  |                                   |--- Verifies domain ownership
  |                                   |--- Loads widget configuration
```

#### Visitor Chat Experience

```
Visitor                             Widget          AI Receptionist
  |                                   |               |
  |--- Click chat bubble ----------->|               |
  |                                   |               |
  |<-- Widget opens with ----------->|               |
  |    welcome message                |               |
  |                                   |               |
  |--- Type message ---------------->|               |
  |                                   |               |
  |                                   |--- Send to -->|
  |                                   |    API        |
  |                                   |               |
  |                                   |<-- Response --|
  |                                   |               |
  |<-- Display AI response ---------|               |
  |                                   |               |
  |--- Continue conversation ------->|               |
  |                                   |               |
  |    [after conversation ends]      |               |
  |<-- Widget shows closure message >|               |
  |    + feedback rating             |               |
```

#### Widget Configuration

```
User                                System
  |                                   |
  |--- Configure widget: ------------>|
  |    - Position (left/right)       |
  |    - Color theme                 |
  |    - Welcome message             |
  |    - Business hours behavior     |
  |    - Pre-chat form fields        |
  |                                   |
  |--- Click "Save" ---------------->|
  |                                   |
  |                                   |--- Store configuration
  |<-- Widget updates in real-time ->|
```

### Widget States

| State     | Description                                      |
|-----------|--------------------------------------------------|
| Idle      | Chat bubble visible, widget collapsed            |
| Open      | Widget expanded, showing conversation            |
| Offline   | Outside business hours, showing contact form     |
| Loading   | Widget initializing, showing spinner             |
| Error     | Failed to load, showing retry button             |

---

## Appendix: API Endpoint Reference

### Auth Endpoints

| Method | Endpoint                     | Auth Required | Description              |
|--------|------------------------------|---------------|--------------------------|
| POST   | /api/v1/auth/register        | No            | Register new workspace   |
| POST   | /api/v1/auth/login           | No            | Login                    |
| POST   | /api/v1/auth/refresh         | No            | Refresh access token     |
| POST   | /api/v1/auth/logout          | Yes           | Logout (revoke session)  |
| GET    | /api/v1/auth/me              | Yes           | Get current user         |

### Business Endpoints

| Method | Endpoint                                  | Auth Required | Description               |
|--------|-------------------------------------------|---------------|---------------------------|
| GET    | /api/v1/businesses/:id                    | Yes           | Get business details      |
| PATCH  | /api/v1/businesses/:id                    | Yes           | Update business           |
| GET    | /api/v1/businesses/:id/onboarding         | Yes           | Get onboarding progress   |
| PATCH  | /api/v1/businesses/:id/onboarding/steps   | Yes           | Advance onboarding step   |

### Domain Endpoints

| Method | Endpoint                                              | Auth Required | Description                    |
|--------|-------------------------------------------------------|---------------|--------------------------------|
| GET    | /api/v1/businesses/:id/domains                        | Yes           | List domains                   |
| POST   | /api/v1/businesses/:id/domains                        | Yes           | Add domain                     |
| DELETE | /api/v1/businesses/:id/domains/:domainId              | Yes           | Delete domain (soft)           |
| POST   | /api/v1/businesses/:id/domains/:domainId/verify       | Yes           | Verify domain ownership        |
| GET    | /api/v1/businesses/:id/domains/:domainId/verification-instructions | Yes | Get verification instructions |

---

## Appendix: Session Lifecycle

```
Created (register/login)
  |
  v
Active (accessToken valid, refreshToken valid)
  |
  |--- accessToken expires (15min)
  |      |
  |      v
  |    Refresh (POST /auth/refresh)
  |      |
  |      v
  |    New tokens issued, old refresh token invalidated
  |      |
  |      v
  |    Active (new tokens)
  |
  |--- refreshToken expires (30d)
  |      |
  |      v
  |    Expired session (all requests fail with 401)
  |      |
  |      v
  |    User must re-login
  |
  |--- User clicks Logout
  |      |
  |      v
  |    Revoked (revokedAt set)
  |      |
  |      v
  |    All refresh attempts fail with 401
  |
  |--- Multiple concurrent sessions
  |      |
  |      v
  |    Each session has unique sessionId
  |    Logging out one does not affect others
```

---

## Appendix: Error Response Format

All API errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Error type"
}
```

Frontend extracts error messages using `getErrorMessage()` utility and displays them in red error banners with the class `bg-red-50 border border-red-200 text-red-700`.
