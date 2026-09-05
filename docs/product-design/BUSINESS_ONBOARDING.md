# Business Onboarding - Architecture & Product Design

> Complete architecture for Milestone 4: Business Onboarding.
> End-to-end flow from registration to "Ready for Knowledge Ingestion."

**Last Updated:** 2026-07-22
**Status:** Design Complete (Ready for Implementation)

---

## Table of Contents

1. [User Journey](#1-user-journey)
2. [Business Requirements](#2-business-requirements)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [Required APIs](#5-required-apis)
6. [Frontend Pages](#6-frontend-pages)
7. [Milestone Breakdown](#7-milestone-breakdown)
8. [Risks](#8-risks)
9. [Documentation Updates](#9-documentation-updates)

---

## 1. User Journey

### Overview

The onboarding journey begins immediately after registration (Milestone 3). A new user lands in their workspace with a `DRAFT` business and a guided flow that walks them through setup.

### Journey Map

```
Registration Complete
        │
        ▼
┌─────────────────────────┐
│  1. Welcome / Setup     │  User sees onboarding checklist
│     Wizard              │  First-time experience
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  2. Business Profile    │  Edit name, industry, description
│     Setup               │  Upload logo (optional)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  3. Domain              │  Add website domain(s)
│     Verification        │  Verify ownership (DNS TXT or HTML meta)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  4. Team Setup          │  Invite team members (optional)
│     (Optional)          │  Assign roles
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  5. Onboarding          │  All required steps complete
│     Complete            │  Status → ACTIVE
└───────────┬─────────────┘
            │
            ▼
    Ready for Knowledge
         Ingestion
```

### Step Details

| Step | Required | Description |
|------|----------|-------------|
| Welcome / Setup Wizard | Yes | First-time overlay guiding user through steps. Can be dismissed. |
| Business Profile | Yes | Name, industry, description. At least name is required. |
| Domain Verification | Yes (min 1) | At least one domain must be verified before onboarding completes. |
| Team Invitation | No | Can invite other users with ADMIN or MANAGER roles. |
| Onboarding Complete | Auto | Triggered when all required steps are done. Business status changes to `ACTIVE`. |

### Onboarding Checklist (Frontend)

The dashboard displays a checklist widget showing:

```
□ Complete your business profile
□ Verify your domain
○ Invite your team (optional)
✓ Setup complete
```

Progress is tracked via the `onboardingStatus` field on the Business model.

---

## 2. Business Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| BR-01 | User can edit business profile (name, industry, description) | P0 |
| BR-02 | User can add one or more domains to their business | P0 |
| BR-03 | Domain ownership is verified via DNS TXT record (recommended) | P0 |
| BR-04 | Domain ownership is verified via HTML meta tag (alternative) | P0 |
| BR-05 | System polls/checks DNS TXT record for verification | P0 |
| BR-06 | System checks HTML meta tag for verification | P0 |
| BR-07 | At least one verified domain is required to complete onboarding | P0 |
| BR-08 | Business status transitions from DRAFT to ACTIVE on completion | P0 |
| BR-09 | Onboarding wizard guides user through setup steps | P1 |
| BR-10 | User can invite team members via email | P1 |
| BR-11 | Invited users receive an invitation (email or in-app) | P1 |
| BR-12 | Invited users can accept/decline invitations | P1 |
| BR-13 | User can remove pending invitations | P2 |
| BR-14 | User can upload business logo | P2 |
| BR-15 | Onboarding progress is persisted across sessions | P0 |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | Domain verification completes within 60 seconds (DNS) | P0 |
| NFR-02 | Domain verification completes within 10 seconds (HTML meta) | P0 |
| NFR-03 | All mutations are scoped to the user's organization | P0 |
| NFR-04 | API follows existing NestJS module patterns | P0 |
| NFR-05 | Frontend uses React Router for navigation | P0 |
| NFR-06 | Frontend uses Zustand for client state management | P0 |
| NFR-07 | All endpoints require JWT authentication | P0 |

### Out of Scope (This Milestone)

- AI Receptionist activation
- Knowledge base ingestion
- Widget deployment
- Email sending (invitations are in-app only for now)
- Payment/billing integration
- Multi-language support

---

## 3. System Architecture

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ React Router│  │  Zustand    │  │  TanStack Query      │ │
│  │ (Routes)    │  │ (UI State)  │  │  (Server State)      │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP (JSON)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    API Layer (NestJS)                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Auth Guard (JWT)                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Onboarding   │  │  Business    │  │   Domain          │  │
│  │ Module       │  │  Module      │  │   Verification    │  │
│  │              │  │              │  │   Service         │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │  Invitation  │  │  Organization│                          │
│  │  Module      │  │  Module      │                          │
│  └──────────────┘  └──────────────┘                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Prisma     │  │  PostgreSQL  │  │   Redis (Future)  │  │
│  │   Client     │  │              │  │   (DNS Cache)     │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Module Structure (New Modules)

```
apps/api/src/
├── modules/
│   ├── auth/                    # Existing (Milestone 3)
│   ├── business/                # NEW - Business profile CRUD
│   │   ├── business.module.ts
│   │   ├── business.controller.ts
│   │   ├── business.service.ts
│   │   └── dto/
│   │       ├── update-business.dto.ts
│   │       └── business-response.dto.ts
│   ├── domain/                  # NEW - Domain management + verification
│   │   ├── domain.module.ts
│   │   ├── domain.controller.ts
│   │   ├── domain.service.ts
│   │   ├── domain-verification.service.ts
│   │   └── dto/
│   │       ├── add-domain.dto.ts
│   │       ├── verify-domain.dto.ts
│   │       └── domain-response.dto.ts
│   ├── invitation/              # NEW - Team invitations
│   │   ├── invitation.module.ts
│   │   ├── invitation.controller.ts
│   │   ├── invitation.service.ts
│   │   └── dto/
│   │       ├── create-invitation.dto.ts
│   │       └── invitation-response.dto.ts
│   ├── onboarding/              # NEW - Onboarding state machine
│   │   ├── onboarding.module.ts
│   │   ├── onboarding.controller.ts
│   │   ├── onboarding.service.ts
│   │   └── dto/
│   │       └── onboarding-status.dto.ts
│   ├── health/                  # Existing (Milestone 1)
│   ├── identity/                # Existing (empty)
│   └── users/                   # Existing (empty)
```

### Frontend Structure (New)

```
apps/web/src/
├── main.tsx                     # Entry point
├── App.tsx                      # Root component with Router
├── auth.ts                      # Existing auth utilities
├── router.tsx                   # NEW - React Router configuration
├── stores/                      # NEW - Zustand stores
│   ├── auth.store.ts            # Auth state (user, tokens)
│   ├── onboarding.store.ts      # Onboarding wizard state
│   └── ui.store.ts              # UI state (sidebar, modals)
├── pages/                       # NEW - Route pages
│   ├── LoginPage.tsx            # Refactored from App.tsx
│   ├── DashboardPage.tsx        # Main dashboard
│   ├── OnboardingPage.tsx       # Onboarding wizard
│   ├── BusinessSettingsPage.tsx # Business profile settings
│   ├── DomainsPage.tsx          # Domain management
│   └── TeamPage.tsx             # Team management
├── components/                  # NEW - Reusable components
│   ├── layout/
│   │   ├── AppLayout.tsx        # Dashboard layout with sidebar
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── onboarding/
│   │   ├── OnboardingChecklist.tsx
│   │   ├── BusinessProfileStep.tsx
│   │   ├── DomainVerificationStep.tsx
│   │   └── TeamSetupStep.tsx
│   └── ui/                      # Basic UI components
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Card.tsx
│       └── Modal.tsx
└── api/                         # NEW - API client utilities
    ├── client.ts                # Fetch wrapper with auth
    ├── business.ts              # Business API calls
    ├── domain.ts                # Domain API calls
    ├── invitation.ts            # Invitation API calls
    └── onboarding.ts            # Onboarding API calls
```

### Domain Verification Flow

```
User adds domain "example.com"
        │
        ▼
System creates BusinessDomain record
(status: PENDING, generates verificationToken)
        │
        ▼
System provides verification instructions:
  Option A: DNS TXT record
    - Record name: _replyiq-verification.example.com
    - Record value: replyiq-verify=<token>
  Option B: HTML meta tag
    - Add to homepage: <meta name="replyiq-verification" content="<token>">
        │
        ▼
User clicks "Verify" button
        │
        ▼
┌───────┴───────┐
│   DNS Check   │  System performs DNS lookup for TXT record
│   (Primary)   │  Checks for matching verification token
└───────┬───────┘
        │
        ▼ (if not found)
┌───────┴───────┐
│  HTML Meta    │  System fetches domain homepage
│   Check       │  Looks for <meta> tag with matching token
│ (Fallback)    │
└───────┬───────┘
        │
        ▼
┌───────┴───────┐
│   Verified!   │  Status: PENDING → VERIFIED
│               │  verifiedAt timestamp set
└───────────────┘
```

### DNS Verification Details

**Record Format:**
- Record Type: `TXT`
- Record Name: `_replyiq-verification.<domain>`
- Record Value: `replyiq-verification=<token>`

**Lookup Strategy:**
1. Use Node.js `dns.resolveTxt()` to query TXT records
2. Check for record at `_replyiq-verification.<domain>`
3. If found, validate the value matches `replyiq-verification=<token>`
4. If not found, fall back to HTML meta tag check

**HTML Meta Tag Verification Details:**

**Meta Tag Format:**
```html
<meta name="replyiq-verification" content="<token>">
```

**Lookup Strategy:**
1. Fetch `https://<domain>` (and `http://<domain>` as fallback)
2. Parse HTML response
3. Search for `<meta>` tag with `name="replyiq-verification"`
4. Validate content attribute matches the token

---

## 4. Database Design

> Proposed models only. No implementation until approved.

### Existing Models (Modified)

#### Business (Modified)

Add new fields to support onboarding state tracking:

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key (existing) |
| organizationId | UUID | FK to Organization (existing) |
| name | VARCHAR(200) | (existing) |
| industry | VARCHAR(100)? | (existing) |
| description | TEXT? | **NEW** - Business description/about |
| logoUrl | VARCHAR(500)? | **NEW** - URL to uploaded logo |
| websiteUrl | VARCHAR(500)? | **NEW** - Primary website URL |
| onboardingStatus | OnboardingStatus | **NEW** - Tracks onboarding progress |
| status | BusinessStatus | (existing) |
| createdAt | DateTime | (existing) |
| updatedAt | DateTime | (existing) |
| deletedAt | DateTime? | (existing) |

**New Enum: OnboardingStatus**

```
OnboardingStatus:
  - NOT_STARTED    # Just registered, no profile completed
  - IN_PROGRESS    # Profile partially completed
  - DOMAIN_PENDING # Profile done, awaiting domain verification
  - COMPLETED      # All required steps done (→ ACTIVE status)
```

#### BusinessDomain (No Changes)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key (existing) |
| businessId | UUID | FK to Business (existing) |
| domain | VARCHAR(255) | Unique (existing) |
| isPrimary | Boolean | (existing) |
| status | BusinessDomainStatus | (existing) |
| verifiedAt | DateTime? | (existing) |
| verificationToken | VARCHAR(255)? | (existing) |
| verificationMethod | VerificationMethod? | **NEW** - DNS or HTML_META |
| createdAt | DateTime | (existing) |
| updatedAt | DateTime | (existing) |
| deletedAt | DateTime? | (existing) |

**New Enum: VerificationMethod**

```
VerificationMethod:
  - DNS_TXT      # DNS TXT record verification
  - HTML_META    # HTML meta tag verification
```

### New Models

#### Invitation

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| organizationId | UUID | FK to Organization |
| businessId | UUID | FK to Business |
| email | VARCHAR(320) | Invitee email |
| role | UserRole | ADMIN or MANAGER |
| status | InvitationStatus | PENDING, ACCEPTED, DECLINED, EXPIRED |
| invitedById | UUID | FK to User (who sent invite) |
| token | VARCHAR(255) | Unique invite token |
| expiresAt | DateTime | Token expiry (7 days) |
| acceptedAt | DateTime? | When accepted |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**New Enum: InvitationStatus**

```
InvitationStatus:
  - PENDING    # Invite sent, not yet acted on
  - ACCEPTED   # Invitee accepted and joined
  - DECLINED   # Invitee declined
  - EXPIRED    # Token expired (7 days)
```

#### OnboardingProgress (Optional - for detailed tracking)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| businessId | UUID | FK to Business (unique) |
| profileCompleted | Boolean | Default false |
| profileCompletedAt | DateTime? | |
| firstDomainAdded | Boolean | Default false |
| firstDomainAddedAt | DateTime? | |
| firstDomainVerified | Boolean | Default false |
| firstDomainVerifiedAt | DateTime? | |
| teamInvited | Boolean | Default false |
| teamInvitedAt | DateTime? | |
| onboardingCompleted | Boolean | Default false |
| onboardingCompletedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

> **Design Note:** `OnboardingProgress` is optional. The same data can be derived from the `Business.onboardingStatus` field and the `BusinessDomain` records. Including it as a separate model provides:
> - Simpler queries for the onboarding checklist UI
> - Audit trail of when each step was completed
> - Analytics on onboarding funnel drop-off
>
> **Recommendation:** Include this model. The marginal storage cost is worth the query simplicity and analytics value.

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐
│ Organization │──────<│    User      │
│              │       │              │
│ id           │       │ id           │
│ name         │       │ organizationId│
│ status       │       │ name         │
└──────┬───────┘       │ email        │
       │               │ role         │
       │               └──────────────┘
       │
       │               ┌──────────────┐
       └──────────────<│   Business   │
                       │              │
                       │ id           │
                       │ organizationId│
                       │ name         │
                       │ industry     │
                       │ description  │  NEW
                       │ logoUrl      │  NEW
                       │ websiteUrl   │  NEW
                       │ onboardingStatus │  NEW
                       │ status       │
                       └──────┬───────┘
                              │
               ┌──────────────┼──────────────┐
               │              │              │
               ▼              ▼              ▼
       ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
       │BusinessDomain│ │ Invitation   │ │Onboarding    │
       │              │ │              │ │Progress      │
       │ id           │ │ id           │ │ id           │
       │ businessId   │ │ businessId   │ │ businessId   │
       │ domain       │ │ email        │ │ profileDone  │
       │ isPrimary    │ │ role         │ │ domainDone   │
       │ status       │ │ status       │ │ teamDone     │
       │ verifiedAt   │ │ invitedById  │ │ completedAt  │
       │ token        │ │ token        │ └──────────────┘
       │ method  NEW  │ │ expiresAt    │
       └──────────────┘ └──────────────┘
```

---

## 5. Required APIs

### Base URL

All endpoints prefixed with `/api/v1`.

### Business Profile

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/businesses/:businessId` | Get business details | Yes |
| PATCH | `/businesses/:businessId` | Update business profile | Yes |
| PATCH | `/businesses/:businessId/logo` | Upload business logo | Yes |

#### GET /businesses/:businessId

**Response:**
```json
{
  "success": true,
  "message": "Business retrieved successfully",
  "data": {
    "business": {
      "id": "uuid",
      "organizationId": "uuid",
      "name": "Acme Corp",
      "industry": "Technology",
      "description": "We build amazing things",
      "logoUrl": "https://storage.replyiq.com/logos/uuid.png",
      "websiteUrl": "https://acme.com",
      "onboardingStatus": "IN_PROGRESS",
      "status": "DRAFT",
      "createdAt": "2026-07-22T00:00:00Z",
      "updatedAt": "2026-07-22T00:00:00Z"
    }
  }
}
```

#### PATCH /businesses/:businessId

**Request:**
```json
{
  "name": "Acme Corp",
  "industry": "Technology",
  "description": "We build amazing things",
  "websiteUrl": "https://acme.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Business updated successfully",
  "data": {
    "business": { ... }
  }
}
```

### Domain Management

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/businesses/:businessId/domains` | List all domains | Yes |
| POST | `/businesses/:businessId/domains` | Add a domain | Yes |
| DELETE | `/businesses/:businessId/domains/:domainId` | Remove a domain | Yes |
| POST | `/businesses/:businessId/domains/:domainId/verify` | Trigger verification | Yes |
| GET | `/businesses/:businessId/domains/:domainId/verification-instructions` | Get DNS/meta instructions | Yes |

#### POST /businesses/:businessId/domains

**Request:**
```json
{
  "domain": "acme.com",
  "isPrimary": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Domain added successfully",
  "data": {
    "domain": {
      "id": "uuid",
      "domain": "acme.com",
      "isPrimary": true,
      "status": "PENDING",
      "verificationToken": "abc123...",
      "createdAt": "2026-07-22T00:00:00Z"
    }
  }
}
```

#### GET /businesses/:businessId/domains/:domainId/verification-instructions

**Response:**
```json
{
  "success": true,
  "message": "Verification instructions retrieved",
  "data": {
    "domain": "acme.com",
    "dns": {
      "recordType": "TXT",
      "recordName": "_replyiq-verification.acme.com",
      "recordValue": "replyiq-verification=abc123..."
    },
    "htmlMeta": {
      "tagName": "meta",
      "attributes": {
        "name": "replyiq-verification",
        "content": "abc123..."
      },
      "instructions": "Add this tag to the <head> section of your homepage"
    }
  }
}
```

#### POST /businesses/:businessId/domains/:domainId/verify

**Response (success):**
```json
{
  "success": true,
  "message": "Domain verified successfully",
  "data": {
    "domain": {
      "id": "uuid",
      "domain": "acme.com",
      "status": "VERIFIED",
      "verifiedAt": "2026-07-22T00:05:00Z",
      "verificationMethod": "DNS_TXT"
    }
  }
}
```

**Response (failure):**
```json
{
  "success": false,
  "message": "Domain verification failed",
  "error": {
    "code": "DOMAIN_VERIFICATION_FAILED",
    "details": "Could not find verification record. Please ensure the TXT record is propagated and try again."
  }
}
```

### Team Invitations

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/businesses/:businessId/invitations` | List invitations | Yes |
| POST | `/businesses/:businessId/invitations` | Send invitation | Yes |
| DELETE | `/businesses/:businessId/invitations/:invitationId` | Cancel invitation | Yes |
| POST | `/invitations/:token/accept` | Accept invitation | Yes |
| POST | `/invitations/:token/decline` | Decline invitation | Yes |

#### POST /businesses/:businessId/invitations

**Request:**
```json
{
  "email": "colleague@acme.com",
  "role": "MANAGER"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation sent successfully",
  "data": {
    "invitation": {
      "id": "uuid",
      "email": "colleague@acme.com",
      "role": "MANAGER",
      "status": "PENDING",
      "expiresAt": "2026-07-29T00:00:00Z",
      "createdAt": "2026-07-22T00:00:00Z"
    }
  }
}
```

### Onboarding Status

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/businesses/:businessId/onboarding` | Get onboarding status | Yes |
| POST | `/businesses/:businessId/onboarding/complete` | Mark onboarding complete | Yes |

#### GET /businesses/:businessId/onboarding

**Response:**
```json
{
  "success": true,
  "message": "Onboarding status retrieved",
  "data": {
    "onboardingStatus": "IN_PROGRESS",
    "steps": {
      "profileCompleted": true,
      "profileCompletedAt": "2026-07-22T00:01:00Z",
      "firstDomainAdded": true,
      "firstDomainAddedAt": "2026-07-22T00:02:00Z",
      "firstDomainVerified": false,
      "firstDomainVerifiedAt": null,
      "teamInvited": false,
      "teamInvitedAt": null
    },
    "completionPercentage": 33,
    "nextStep": "VERIFY_DOMAIN"
  }
}
```

#### POST /businesses/:businessId/onboarding/complete

**Response (success):**
```json
{
  "success": true,
  "message": "Onboarding completed successfully",
  "data": {
    "business": {
      "onboardingStatus": "COMPLETED",
      "status": "ACTIVE"
    }
  }
}
```

**Response (failure - missing requirements):**
```json
{
  "success": false,
  "message": "Cannot complete onboarding",
  "error": {
    "code": "ONBOARDING_INCOMPLETE",
    "details": {
      "missingSteps": ["VERIFY_DOMAIN"]
    }
  }
}
```

---

## 6. Frontend Pages

### Page Inventory

| Page | Route | Purpose | Auth Required |
|------|-------|---------|---------------|
| Login | `/login` | User login | No |
| Register | `/register` | User registration | No |
| Dashboard | `/dashboard` | Main dashboard with onboarding checklist | Yes |
| Onboarding | `/onboarding` | Guided onboarding wizard | Yes |
| Business Settings | `/dashboard/settings` | Edit business profile | Yes |
| Domains | `/dashboard/domains` | Manage and verify domains | Yes |
| Team | `/dashboard/team` | Manage team members | Yes |

### Route Configuration

```tsx
// router.tsx
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* Protected routes */}
  <Route element={<ProtectedRoute />}>
    <Route element={<AppLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard/settings" element={<BusinessSettingsPage />} />
      <Route path="/dashboard/domains" element={<DomainsPage />} />
      <Route path="/dashboard/team" element={<TeamPage />} />
    </Route>
  </Route>

  {/* Redirects */}
  <Route path="/" element={<Navigate to="/dashboard" />} />
  <Route path="*" element={<Navigate to="/dashboard" />} />
</Routes>
```

### Zustand Stores

#### Auth Store

```typescript
// stores/auth.store.ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  setUser: (user: User) => void;
}
```

#### Onboarding Store

```typescript
// stores/onboarding.store.ts
interface OnboardingState {
  currentStep: 'profile' | 'domain' | 'team' | 'complete';
  profileCompleted: boolean;
  domainVerified: boolean;
  teamInvited: boolean;
  completionPercentage: number;

  fetchStatus: (businessId: string) => Promise<void>;
  setStep: (step: string) => void;
  markProfileComplete: () => void;
  markDomainVerified: () => void;
  markTeamInvited: () => void;
}
```

#### UI Store

```typescript
// stores/ui.store.ts
interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;

  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}
```

### Page Descriptions

#### Dashboard Page (`/dashboard`)

- Shows onboarding checklist widget (if onboarding incomplete)
- Shows business summary (if onboarding complete)
- Quick actions: Edit Profile, Manage Domains, Invite Team
- Redirects to `/onboarding` if business status is `DRAFT`

#### Onboarding Page (`/onboarding`)

- Multi-step wizard with progress indicator
- Step 1: Business Profile (name, industry, description)
- Step 2: Domain Verification (add domain, get instructions, verify)
- Step 3: Team Setup (optional - invite members)
- Step 4: Completion confirmation
- Can be accessed from dashboard checklist or directly via URL

#### Business Settings Page (`/dashboard/settings`)

- Form to edit business name, industry, description
- Upload logo (future milestone)
- Save button with validation

#### Domains Page (`/dashboard/domains`)

- List of all domains with status badges (PENDING, VERIFIED, DISABLED)
- "Add Domain" button opens modal
- Each domain shows verification status and actions
- Verified domains show checkmark
- Pending domains show "Verify" button with instructions

#### Team Page (`/dashboard/team`)

- List of team members with roles
- List of pending invitations
- "Invite Member" button opens modal
- Each member shows role and status
- Actions: Change role, Remove member, Cancel invitation

---

## 7. Milestone Breakdown

### Milestone 4: Business Onboarding

**Goal:** Complete business setup flow after registration.
**End State:** Business is `ACTIVE` and ready for Knowledge Ingestion.

#### Phase 1: Backend Foundation (Estimated: 3-4 days)

| Task | Description | Depends On |
|------|-------------|------------|
| 1.1 | Add new fields to Business model (description, logoUrl, websiteUrl, onboardingStatus) | None |
| 1.2 | Create new enums (OnboardingStatus, VerificationMethod, InvitationStatus) | None |
| 1.3 | Create Invitation model | None |
| 1.4 | Create OnboardingProgress model | None |
| 1.5 | Run Prisma migration | 1.1-1.4 |
| 1.6 | Create Business module (controller, service, DTOs) | 1.5 |
| 1.7 | Create Domain module (controller, service, DTOs) | 1.5 |
| 1.8 | Create DomainVerificationService (DNS + HTML meta) | 1.7 |
| 1.9 | Create Invitation module (controller, service, DTOs) | 1.5 |
| 1.10 | Create Onboarding module (controller, service, DTOs) | 1.6, 1.7 |

#### Phase 2: Frontend Foundation (Estimated: 2-3 days)

| Task | Description | Depends On |
|------|-------------|------------|
| 2.1 | Install React Router and Zustand | None |
| 2.2 | Create router configuration | 2.1 |
| 2.3 | Create Zustand stores (auth, onboarding, ui) | 2.1 |
| 2.4 | Create AppLayout with sidebar | 2.2 |
| 2.5 | Create ProtectedRoute component | 2.3 |
| 2.6 | Create API client utilities | 2.3 |
| 2.7 | Refactor LoginPage to use router | 2.2 |
| 2.8 | Create DashboardPage | 2.4, 2.5 |

#### Phase 3: Onboarding Flow (Estimated: 3-4 days)

| Task | Description | Depends On |
|------|-------------|------------|
| 3.1 | Create OnboardingPage with wizard steps | 2.2, 2.3 |
| 3.2 | Create BusinessProfileStep component | 3.1 |
| 3.3 | Create DomainVerificationStep component | 3.1 |
| 3.4 | Create TeamSetupStep component | 3.1 |
| 3.5 | Create OnboardingChecklist component | 3.1 |
| 3.6 | Create BusinessSettingsPage | 2.8 |
| 3.7 | Create DomainsPage | 2.8 |
| 3.8 | Create TeamPage | 2.8 |

#### Phase 4: Integration & Polish (Estimated: 2-3 days)

| Task | Description | Depends On |
|------|-------------|------------|
| 4.1 | Connect frontend forms to API endpoints | 1.6-1.10, 3.1-3.8 |
| 4.2 | Add loading states and error handling | 4.1 |
| 4.3 | Add form validation (Zod schemas) | 4.1 |
| 4.4 | Test domain verification flow end-to-end | 4.1 |
| 4.5 | Test onboarding completion flow end-to-end | 4.1 |
| 4.6 | Update seed script with onboarding data | 4.1 |
| 4.7 | Write integration tests | 4.1 |

#### Estimated Total: 10-14 days

### Sub-Milestones

| Sub-Milestone | Deliverable | Estimated |
|---------------|-------------|-----------|
| 4a | Backend APIs complete + migration applied | Day 4 |
| 4b | Frontend shell with routing and stores | Day 6 |
| 4c | Onboarding wizard functional | Day 10 |
| 4d | Full integration tested | Day 14 |

---

## 8. Risks

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DNS propagation delays | Users wait longer for verification | High | Show clear instructions, allow retry, fallback to HTML meta |
| DNS resolver rate limiting | Verification fails under load | Medium | Cache DNS results, implement backoff, limit retry frequency |
| HTML meta tag parsing failures | Verification fails for some sites | Medium | Support multiple parsers, clear error messages |
| CORS issues fetching external domains | Cannot verify via HTML meta | High | Use server-side proxy for fetching, not client-side |
| Large DOM/HTML pages | Meta tag extraction slow | Low | Set timeouts, parse only `<head>` section |

### Product Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Users don't understand DNS setup | High drop-off at domain step | High | Provide clear copy-paste instructions, video tutorial |
| Users skip domain verification | Onboarding incomplete | Medium | Allow progress without verification, prompt later |
| Team invitation flow confusion | Users don't invite team | Low | Make it optional, simplify to email + role |

### Architecture Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| New models break existing seed | Seed script fails | Medium | Update seed before migration |
| Frontend state management complexity | Hard to maintain | Medium | Keep stores minimal, use server state for API data |
| Module coupling | Changes cascade across modules | Low | Define clear interfaces, use DTOs |

---

## 9. Documentation Updates

### Files to Create

| File | Purpose |
|------|---------|
| `docs/product-design/BUSINESS_ONBOARDING.md` | This document |
| `docs/api/ONBOARDING_API.md` | Detailed API reference (after implementation) |

### Files to Update

| File | Changes |
|------|---------|
| `docs/DECISIONS.md` | Add ADR-019 (Onboarding Architecture), ADR-020 (Domain Verification), ADR-021 (Frontend Foundation) |
| `docs/ROADMAP.md` | Expand Milestone 4 with detailed task list |
| `docs/PROJECT_STATUS.md` | Add onboarding context, update completion percentages |
| `docs/DATABASE.md` | Add new models and enums |
| `README.md` | Update tech stack (React Router, Zustand) |

### New ADRs to Add

#### ADR-019: Business Onboarding Architecture

**Decision:** Create dedicated modules for Business, Domain, Invitation, and Onboarding concerns. Onboarding state tracked via `onboardingStatus` enum on Business model, with optional `OnboardingProgress` model for analytics.

**Reason:**
- Clear separation of concerns
- Each module is independently testable
- OnboardingProgress provides audit trail without complicating Business queries

#### ADR-020: Domain Verification Strategy

**Decision:** Support DNS TXT record (recommended) and HTML meta tag (fallback) for domain verification. Server-side verification only (no client-side CORS issues).

**Reason:**
- DNS TXT is industry standard (Google, Microsoft use it)
- HTML meta tag is simpler for non-technical users
- Server-side avoids CORS and browser security restrictions
- Fallback approach maximizes success rate

#### ADR-021: Frontend Foundation

**Decision:** Install React Router for routing and Zustand for client state management. TanStack Query for server state (API data).

**Reason:**
- React Router is the standard for React SPAs
- Zustand is lightweight and already in tech stack (ADR-015)
- TanStack Query handles caching, loading states, and refetching
- Three libraries cover distinct concerns (routing, client state, server state)

---

## Appendix: Implementation Checklist

When beginning implementation, use this checklist:

### Backend

- [ ] Add new fields to Business model in Prisma schema
- [ ] Add OnboardingStatus enum
- [ ] Add VerificationMethod enum
- [ ] Add InvitationStatus enum
- [ ] Create Invitation model
- [ ] Create OnboardingProgress model
- [ ] Run `prisma migrate dev`
- [ ] Create BusinessModule
- [ ] Create BusinessService
- [ ] Create BusinessController
- [ ] Create business DTOs
- [ ] Create DomainModule
- [ ] Create DomainService
- [ ] Create DomainController
- [ ] Create DomainVerificationService
- [ ] Create domain DTOs
- [ ] Create InvitationModule
- [ ] Create InvitationService
- [ ] Create InvitationController
- [ ] Create invitation DTOs
- [ ] Create OnboardingModule
- [ ] Create OnboardingService
- [ ] Create OnboardingController
- [ ] Create onboarding DTOs
- [ ] Register new modules in AppModule
- [ ] Update seed script

### Frontend

- [ ] Install react-router-dom
- [ ] Install zustand
- [ ] Install @tanstack/react-query
- [ ] Create router.tsx
- [ ] Create stores (auth, onboarding, ui)
- [ ] Create AppLayout component
- [ ] Create Sidebar component
- [ ] Create ProtectedRoute component
- [ ] Create API client utilities
- [ ] Refactor LoginPage
- [ ] Create DashboardPage
- [ ] Create OnboardingPage
- [ ] Create BusinessProfileStep
- [ ] Create DomainVerificationStep
- [ ] Create TeamSetupStep
- [ ] Create OnboardingChecklist
- [ ] Create BusinessSettingsPage
- [ ] Create DomainsPage
- [ ] Create TeamPage

### Documentation

- [ ] Update DECISIONS.md (ADR-019, ADR-020, ADR-021)
- [ ] Update ROADMAP.md (Milestone 4 details)
- [ ] Update PROJECT_STATUS.md
- [ ] Update DATABASE.md
- [ ] Update README.md
