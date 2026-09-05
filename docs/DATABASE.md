# ReplyIQ - Database

> Complete documentation of the Prisma schema, models, relationships, and migrations.

**Last Updated:** 2026-07-22

---

## Connection

```
DATABASE_URL="postgresql://replyiq:replyiq_dev_password@localhost:5432/replyiq?schema=public"
```

Provider: PostgreSQL 17 (via Docker Compose)

---

## Enums

### OrganizationStatus
| Value | Description |
|---|---|
| ACTIVE | Normal operating state |
| SUSPENDED | Temporarily suspended (payment, violation) |
| ARCHIVED | Permanently deactivated |

### BusinessStatus
| Value | Description |
|---|---|
| DRAFT | Newly created, not yet active |
| ACTIVE | Normal operating state |
| SUSPENDED | Temporarily suspended |
| ARCHIVED | Permanently deactivated |

### UserRole
| Value | Description |
|---|---|
| OWNER | Full access, can manage billing and delete org |
| ADMIN | Can manage users, settings, and all businesses |
| MANAGER | Can manage assigned businesses and knowledge base |

### UserStatus
| Value | Description |
|---|---|
| ACTIVE | Normal operating state |
| INVITED | Pending invitation acceptance |
| DISABLED | Account disabled by admin |

### BusinessDomainStatus
| Value | Description |
|---|---|
| PENDING | Domain added, awaiting verification |
| VERIFIED | Domain ownership confirmed |
| DISABLED | Domain removed from use |

### OnboardingStatus
| Value | Description |
|---|---|
| NOT_STARTED | Just registered, no profile completed |
| IN_PROGRESS | Profile partially completed |
| DOMAIN_PENDING | Profile done, awaiting domain verification |
| COMPLETED | All required steps done (→ ACTIVE status) |

### VerificationMethod
| Value | Description |
|---|---|
| DNS_TXT | DNS TXT record verification (recommended) |
| HTML_META | HTML meta tag verification (fallback) |

### InvitationStatus (Planned - Milestone 4)
| Value | Description |
|---|---|
| PENDING | Invite sent, not yet acted on |
| ACCEPTED | Invitee accepted and joined |
| DECLINED | Invitee declined |
| EXPIRED | Token expired (7 days) |

---

## Models

### Organization

The top-level tenant boundary. Every resource belongs to an Organization.

```
Organization
├── id            UUID (PK)
├── name          VARCHAR(150)
├── status        OrganizationStatus (default: ACTIVE)
├── createdAt     DateTime (default: now)
├── updatedAt     DateTime (auto)
├── deletedAt     DateTime? (soft delete)
│
├── users         User[]
└── businesses    Business[]
```

**Indexes:**
- `organizations_status_idx` on `status`

**Table name:** `organizations`

---

### User

A user belongs to one Organization. Users authenticate and are assigned roles.

```
User
├── id             UUID (PK)
├── organizationId UUID (FK → Organization.id, Restrict delete)
├── name           VARCHAR(150)
├── email          VARCHAR(320) (UNIQUE)
├── passwordHash   VARCHAR(255)
├── role           UserRole (default: MANAGER)
├── status         UserStatus (default: ACTIVE)
├── createdAt      DateTime (default: now)
├── updatedAt      DateTime (auto)
├── deletedAt      DateTime? (soft delete)
│
├── organization   Organization
└── sessions       Session[]
```

**Indexes:**
- `users_organizationId_idx` on `organizationId`
- `users_status_idx` on `status`
- `users_email_key` UNIQUE on `email`

**Table name:** `users`

---

### Business

A business belongs to an Organization. Represents a brand, product, or division.

```
Business
├── id                UUID (PK)
├── organizationId    UUID (FK → Organization.id, Restrict delete)
├── name              VARCHAR(200)
├── industry          VARCHAR(100)? (nullable)
├── description       TEXT? (nullable)
├── websiteUrl        VARCHAR(500)? (nullable)
├── onboardingStatus  OnboardingStatus (default: NOT_STARTED)
├── status            BusinessStatus (default: DRAFT)
├── createdAt         DateTime (default: now)
├── updatedAt         DateTime (auto)
├── deletedAt         DateTime? (soft delete)
│
├── organization      Organization
├── domains           BusinessDomain[]
├── invitations       Invitation[] [Planned - Milestone 4]
└── onboardingProgress OnboardingProgress?
```

**Indexes:**
- `businesses_organizationId_idx` on `organizationId`
- `businesses_status_idx` on `status`
- `businesses_onboardingStatus_idx` on `onboardingStatus`

**Table name:** `businesses`

---

### BusinessDomain

A domain belongs to a Business. Used for website verification and widget deployment.

```
BusinessDomain
├── id                  UUID (PK)
├── businessId          UUID (FK → Business.id, Restrict delete)
├── domain              VARCHAR(255) (UNIQUE)
├── isPrimary           Boolean (default: false)
├── status              BusinessDomainStatus (default: PENDING)
├── verifiedAt          DateTime?
├── verificationToken   VARCHAR(255)?
├── verificationMethod  VerificationMethod?
├── createdAt           DateTime (default: now)
├── updatedAt           DateTime (auto)
├── deletedAt           DateTime? (soft delete)
│
└── business            Business
```

**Indexes:**
- `business_domains_businessId_idx` on `businessId`
- `business_domains_status_idx` on `status`
- `business_domains_domain_key` UNIQUE on `domain`

**Table name:** `business_domains`

---

### Session

A session represents an active login. Stores the refresh token hash for rotation verification.

```
Session
├── id               UUID (PK)
├── userId           UUID (FK → User.id, Cascade delete)
├── refreshTokenHash VARCHAR(255)
├── expiresAt        DateTime
├── lastUsedAt       DateTime?
├── revokedAt        DateTime?
├── ipAddress        VARCHAR(45)? (IPv6 max length)
├── userAgent        VARCHAR(512)?
├── createdAt        DateTime (default: now)
├── updatedAt        DateTime (auto)
│
└── user             User
```

**Indexes:**
- `sessions_userId_idx` on `userId`
- `sessions_expiresAt_idx` on `expiresAt`

**Table name:** `sessions`

---

### Invitation (Planned - Milestone 4)

An invitation belongs to a Business and is created by a User. Used for team member onboarding.

```
Invitation
├── id              UUID (PK)
├── organizationId  UUID (FK → Organization.id, Restrict delete)
├── businessId      UUID (FK → Business.id, Cascade delete)
├── email           VARCHAR(320)
├── role            UserRole
├── status          InvitationStatus (default: PENDING)
├── invitedById     UUID (FK → User.id, Set null)
├── token           VARCHAR(255) (UNIQUE)
├── expiresAt       DateTime
├── acceptedAt      DateTime?
├── createdAt       DateTime (default: now)
├── updatedAt       DateTime (auto)
│
├── organization    Organization
├── business        Business
└── invitedBy       User?
```

**Indexes:**
- `invitations_businessId_idx` on `businessId`
- `invitations_organizationId_idx` on `organizationId`
- `invitations_token_key` UNIQUE on `token`
- `invitations_email_businessId_idx` on `email, businessId` (composite)

**Table name:** `invitations`

---

### OnboardingProgress

Tracks onboarding step completion for a Business. Created automatically during workspace registration.

```
OnboardingProgress
├── id                      UUID (PK)
├── businessId              UUID (FK → Business.id, Cascade delete) (UNIQUE)
├── profileCompleted        Boolean (default: false)
├── profileCompletedAt      DateTime?
├── firstDomainAdded        Boolean (default: false)
├── firstDomainAddedAt      DateTime?
├── firstDomainVerified     Boolean (default: false)
├── firstDomainVerifiedAt   DateTime?
├── onboardingCompleted     Boolean (default: false)
├── onboardingCompletedAt   DateTime?
├── createdAt               DateTime (default: now)
├── updatedAt               DateTime (auto)
│
└── business                Business
```

**Indexes:**
- `onboarding_progress_businessId_key` UNIQUE on `businessId`

**Table name:** `onboarding_progress`

---

## Relationships

```
Organization 1──* User
Organization 1──* Business
Business 1──* BusinessDomain
Business 1──* Invitation [Planned - Milestone 4]
Business 1──1 OnboardingProgress
User 1──* Session
User 1──* Invitation [Planned - Milestone 4] (invitedBy)
```

**Delete behavior:**
- Organization → User: RESTRICT (cannot delete org with users)
- Organization → Business: RESTRICT (cannot delete org with businesses)
- Business → BusinessDomain: RESTRICT (cannot delete business with domains)
- Business → Invitation: CASCADE (deleting business removes invitations)
- Business → OnboardingProgress: CASCADE (deleting business removes progress)
- User → Session: CASCADE (deleting user removes all sessions)
- User → Invitation: SET NULL (deleting user keeps invitation record)

**Update behavior:**
- All foreign keys use CASCADE on update (UUID PKs don't change, but schema enforces consistency)

---

## Migrations

### 20260718190242_init

**Date:** 2026-07-18
**Description:** Initial schema creation.

Creates:
- 5 enums (OrganizationStatus, BusinessStatus, UserRole, UserStatus, BusinessDomainStatus)
- 4 tables (organizations, users, businesses, business_domains)
- All indexes and foreign keys
- Unique constraints on email and domain

### 20260718204629_add_sessions

**Date:** 2026-07-18
**Description:** Add session management for refresh tokens.

Creates:
- sessions table
- userId and expiresAt indexes
- Foreign key to users (CASCADE delete)

### 20260722120000_add_onboarding_support

**Date:** 2026-07-22
**Description:** Add onboarding support models and fields.

Creates:
- `OnboardingStatus`, `VerificationMethod` enums
- `onboarding_progress` table
- New fields on `businesses` table (description, websiteUrl, onboardingStatus)
- New field on `business_domains` table (verificationMethod)
- New indexes on `businesses` table

### Planned: Milestone 4 (Phase 4B)

**Date:** TBD
**Description:** Add invitation module, team management, and remaining onboarding features.

Will create:
- `InvitationStatus` enum
- `invitations` table
- `logoUrl` field on businesses table

### Migration Lock

Provider locked to `postgresql` in `migration_lock.toml`.

---

## Seed

**Script:** `packages/database/prisma/seed.ts`

Seeds the following dev data:

| Entity | ID | Name | Details |
|---|---|---|---|
| Organization | `00000000-0000-0000-0000-000000000001` | ReplyIQ Corp | Status: ACTIVE |
| User | `00000000-0000-0000-0000-000000000002` | Janardhan Reddy | email: jan@replyiq.com, role: OWNER |
| Business | `00000000-0000-0000-0000-000000000003` | ReplyIQ | industry: SaaS / AI, status: ACTIVE, onboardingStatus: COMPLETED |
| BusinessDomain | `00000000-0000-0000-0000-000000000004` | replyiq.com | isPrimary: true, status: VERIFIED, method: DNS_TXT |
| OnboardingProgress | (auto) | -- | All steps completed for ReplyIQ business |

**Seed password:** `Password@123` (argon2 hashed)

**Run seed:**
```bash
cd packages/database && pnpm db:seed
```

---

## Future Planned Models

These models are planned for upcoming milestones:

### Milestone 4 (Phase 4B): Business Onboarding (Remaining)
- `Invitation` -- Pending team invitations with token and expiry
- Business model gains: `logoUrl` field

### Milestone 5: Knowledge Engine
- `KnowledgeSource` -- Source metadata (type: faq, document, url)
- `KnowledgeDocument` -- Uploaded documents with parsing status
- `KnowledgeChunk` -- Chunked text with vector embeddings
- `KnowledgeFAQ` -- Structured FAQ entries

### Milestone 6: AI Receptionist
- `Conversation` -- Chat session between visitor and AI
- `Message` -- Individual messages in a conversation
- `AIAgent` -- Agent configuration per business
- `SystemPrompt` -- Customizable prompt templates
- `Lead` -- Qualified leads captured from conversations
- `Appointment` -- Scheduled appointments

### Milestone 7: Widget
- `WidgetConfig` -- Widget appearance and behavior settings
- `WidgetEmbed` -- Generated embed scripts per domain

### Milestone 8: Production
- `AuditLog` -- User action logging
- `Webhook` -- Outbound event notifications
- `ApiKey` -- API key management for integrations

---

## Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Create and apply migration
pnpm db:migrate

# Push schema without migration (prototyping)
pnpm db:push

# Run seed
pnpm db:seed

# Open Prisma Studio
pnpm db:studio

# Reset database (WARNING: destroys data)
pnpm db:reset
```

All commands run from `packages/database/`.
