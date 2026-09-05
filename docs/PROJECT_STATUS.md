# ReplyIQ - Project Status

> Single source of truth for the current state of the project.

**Last Updated:** 2026-07-23

---

## Project Vision

ReplyIQ is an AI-powered business receptionist platform that enables companies to deploy conversational AI agents across their digital channels. The platform handles lead qualification, appointment scheduling, and customer support autonomously.

## Product Goal

Provide businesses with an AI employee that can greet website visitors, qualify leads, answer questions using company knowledge, and book appointments -- operating 24/7 across web widgets, email, and messaging channels.

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo 2.3, pnpm 11.13 |
| API Runtime | Node.js |
| API Framework | NestJS 11, Fastify 5 |
| Auth | Passport (JWT strategy), argon2 |
| Validation | class-validator + class-transformer, Zod (env) |
| ORM | Prisma 6.6 |
| Database | PostgreSQL 17 |
| Logging | nestjs-pino, pino-pretty |
| Security | @fastify/helmet, @fastify/cors, @fastify/compress, @nestjs/throttler |
| Frontend | React 19, Vite 6, TypeScript 5.7, React Router v7, Zustand, TanStack Query v5, TailwindCSS v4 |
| Shared Config | @replyiq/config (ESLint, Prettier, Tailwind, TSConfig) |

## Monorepo Structure

```
replyiq/
├── apps/
│   ├── api/          # NestJS REST API (Fastify)
│   ├── web/          # React 19 SPA (Vite)
│   └── widget/       # Embeddable chat widget (scaffold)
├── packages/
│   ├── database/     # Prisma schema, migrations, seed, client
│   ├── types/        # Shared TypeScript types (empty)
│   ├── utils/        # Shared utility functions (empty)
│   ├── ui/           # Shared UI components (empty)
│   ├── core/         # Shared business logic (empty)
│   ├── ai-sdk/       # AI integration abstraction (empty)
│   └── config/       # ESLint, Prettier, Tailwind, TSConfig presets
├── docs/             # Project documentation
└── docker-compose.yml
```

## Current Architecture

### API Layer (`apps/api`)

The API follows a modular architecture within NestJS:

```
src/
├── main.ts                         # Bootstrap (Fastify, Helmet, CORS, Pipes)
├── app.module.ts                   # Root module
├── config/                         # Environment validation (Zod), configuration
├── common/
│   ├── constants/                  # App constants
│   ├── decorators/                 # Custom decorators (empty)
│   ├── filters/                    # Global exception filter
│   ├── interceptors/               # Interceptors (empty)
│   ├── pipes/                      # Pipes (empty)
│   ├── security/                   # PasswordService, TokenService
│   └── types/                      # JwtPayload, RefreshTokenPayload
├── infrastructure/
│   └── security/
│       ├── security.module.ts      # JwtModule + PasswordService + TokenService
│       └── session/                # SessionService, SessionModule
├── shared/
│   └── database/                   # DatabaseModule (global Prisma client)
├── application/                    # Application layer (empty)
└── modules/
    ├── auth/                       # Auth module (register, login, refresh)
    ├── health/                     # Health check endpoint
    ├── identity/                   # Identity module (empty)
    ├── users/                      # Users module (empty)
    ├── business/                   # Business CRUD (update profile)
    ├── domain/                     # Domain management (add, verify, instructions)
    └── onboarding/                 # Onboarding progress tracking
```

All API routes are prefixed with `/api/v1`.

### Frontend Layer (`apps/web`)

React 19 SPA with:
- React Router v7 for client-side routing
- Zustand for client state management (auth, UI)
- TanStack Query v5 for server state with React Query hooks
- TailwindCSS v4 for styling
- Login page with Tailwind styles
- AppLayout with sidebar navigation
- Protected route wrapper
- UI components (Button, Input, Card, Modal, Badge)
- Dashboard with real API data, progress tracking, quick links
- Onboarding wizard (4-step: profile, domain, verification, complete)
- Business settings page with form editing
- Domains page with add, verify, and instructions modal
- API client with auth token refresh
- React Query hooks for all endpoints
- Loading states (skeleton loaders) on all pages
- Error handling with user-facing messages
- Backend session revocation on logout
- Mobile-responsive sidebar with auto-close on navigation

### Widget Layer (`apps/widget`)

Empty scaffold. No implementation.

## Database Models

### Organization
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR(150) | |
| status | OrganizationStatus | ACTIVE, SUSPENDED, ARCHIVED |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

### User
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | FK to Organization |
| name | VARCHAR(150) | |
| email | VARCHAR(320) | Unique |
| passwordHash | VARCHAR(255) | argon2 |
| role | UserRole | OWNER, ADMIN, MANAGER |
| status | UserStatus | ACTIVE, INVITED, DISABLED |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

### Business
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organizationId | UUID | FK to Organization |
| name | VARCHAR(200) | |
| industry | VARCHAR(100)? | Nullable |
| description | TEXT? | Nullable |
| websiteUrl | VARCHAR(500)? | Nullable |
| onboardingStatus | OnboardingStatus | NOT_STARTED, IN_PROGRESS, DOMAIN_PENDING, COMPLETED |
| status | BusinessStatus | DRAFT, ACTIVE, SUSPENDED, ARCHIVED |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

### BusinessDomain
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| businessId | UUID | FK to Business |
| domain | VARCHAR(255) | Unique |
| isPrimary | Boolean | Default false |
| status | BusinessDomainStatus | PENDING, VERIFIED, DISABLED |
| verifiedAt | DateTime? | |
| verificationToken | VARCHAR(255)? | |
| verificationMethod | VerificationMethod? | DNS_TXT, HTML_META |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

### OnboardingProgress
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| businessId | UUID | FK to Business (UNIQUE) |
| profileCompleted | Boolean | Default false |
| profileCompletedAt | DateTime? | |
| firstDomainAdded | Boolean | Default false |
| firstDomainAddedAt | DateTime? | |
| firstDomainVerified | Boolean | Default false |
| firstDomainVerifiedAt | DateTime? | |
| onboardingCompleted | Boolean | Default false |
| onboardingCompletedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Session
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| userId | UUID | FK to User (CASCADE delete) |
| refreshTokenHash | VARCHAR(255) | argon2 hash |
| expiresAt | DateTime | |
| lastUsedAt | DateTime? | |
| revokedAt | DateTime? | |
| ipAddress | VARCHAR(45)? | IPv6 max length |
| userAgent | VARCHAR(512)? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

## Authentication Status

| Capability | Status |
|---|---|
| Registration (workspace) | Working |
| Login | Working |
| Refresh Token (rotation) | Working |
| Logout | Working |
| Current User (/me) | Working |
| JWT (dual secret) | Working |
| Session Management (create, rotate, lastUsed, revoke) | Working |
| Session Revocation | Working |
| Password Hashing (argon2) | Working |
| Rate Limiting | Working |
| Password Change | Not implemented |
| Password Reset | Not implemented |
| Email Verification | Not implemented |

## Infrastructure Status

| Component | Status |
|---|---|
| Docker Compose (PostgreSQL 17) | Working |
| Prisma Migrations (3 applied) | Working |
| Seed Script | Working |
| Env Validation (Zod) | Working |
| Global Exception Filter | Working |
| Pino Logger | Working |
| Helmet | Working |
| CORS | Working (explicit origins via CORS_ORIGINS env var) |
| Compression | Working |
| CI/CD Pipeline | Not implemented |
| Dockerfile (API) | Not implemented |
| Swagger/OpenAPI | Not implemented |

## Current Completed Milestones

1. **Milestone 1: Infrastructure** -- Turborepo monorepo, NestJS + Fastify, Prisma + PostgreSQL, Docker Compose, env validation, logging, security middleware
2. **Milestone 2: Database** -- 5 models (Organization, User, Business, BusinessDomain, Session), 2 migrations, seed script
3. **Milestone 3: Authentication (Complete)** -- Registration, Login, Refresh Token rotation, Logout, Current User (/me), JWT strategy, session CRUD, password hashing
4. **Milestone 4A: Business Onboarding (Complete + Stabilized)** -- Business CRUD, domain management, domain verification (DNS TXT + HTML meta), onboarding wizard, dashboard, full frontend-backend integration. Stabilization sprint (2026-07-26) fixed responsive sidebar state, form re-sync bug, and validated full regression. See `docs/milestone-4a-findings.md`.

## Current In-Progress Milestone

- **Milestone 4B: Team Management & Polish** -- Not yet started
  - User invitation system
  - Team member management
  - Business logo upload
  - Additional profile fields

## Pending Milestones

5. Knowledge Engine
6. AI Receptionist
7. Widget
8. Production

## Current API Endpoints

| Method | Route | Purpose | Status |
|---|---|---|---|
| GET | `/api/v1/health` | Health check | Working |
| POST | `/api/v1/auth/register` | Register workspace | Working |
| POST | `/api/v1/auth/login` | Login | Working |
| POST | `/api/v1/auth/refresh` | Refresh tokens | Working |
| POST | `/api/v1/auth/logout` | Logout (revoke session) | Working |
| GET | `/api/v1/auth/me` | Get current user | Working |
| GET | `/api/v1/businesses/:businessId` | Get business details | Working |
| PATCH | `/api/v1/businesses/:businessId` | Update business profile | Working |
| GET | `/api/v1/businesses/:businessId/domains` | List domains | Working |
| POST | `/api/v1/businesses/:businessId/domains` | Add domain | Working |
| POST | `/api/v1/businesses/:businessId/domains/:domainId/verify` | Verify domain | Working |
| GET | `/api/v1/businesses/:businessId/domains/:domainId/verification-instructions` | Get verification instructions | Working |
| GET | `/api/v1/businesses/:businessId/onboarding` | Get onboarding progress | Working |
| PATCH | `/api/v1/businesses/:businessId/onboarding/steps` | Update onboarding step | Working |

## Development Environment

### Prerequisites
- Node.js (LTS)
- pnpm 11.13
- Docker Desktop (for PostgreSQL)

### Setup
```bash
# Start PostgreSQL
docker-compose up -d

# Install dependencies
pnpm install

# Run migrations
cd packages/database && pnpm db:migrate

# Seed database
pnpm db:seed

# Start API in dev mode
cd apps/api && pnpm dev

# Start web in dev mode
cd apps/web && pnpm dev
```

### Environment Variables
| Variable | Required | Default | Description |
|---|---|---|---|
| DATABASE_URL | Yes | -- | PostgreSQL connection string |
| JWT_SECRET | Yes | -- | Access token signing secret |
| JWT_REFRESH_SECRET | Yes | -- | Refresh token signing secret |
| ACCESS_TOKEN_TTL | No | 15m | Access token expiry |
| REFRESH_TOKEN_TTL | No | 30d | Refresh token expiry |
| PORT | No | 3000 | API server port |
| NODE_ENV | No | development | Environment |
| CORS_ORIGINS | No | http://localhost:5173 | Comma-separated allowed origins |
| RATE_LIMIT_TTL | No | 60 | Rate limit window in seconds |
| RATE_LIMIT_MAX | No | 10 | Max requests per window |

## Current Known Technical Debt

1. `parseTtlToSeconds()` duplicated in `auth.service.ts` and `workspace-provisioning.service.ts`
2. Tokens stored in `localStorage` on frontend (XSS risk)
3. Session `ipAddress`/`userAgent` fields wired but never populated
4. Soft delete columns exist but no Prisma middleware enforces filtering
5. Zero test files across entire repository
6. No RBAC enforcement beyond JWT payload
7. Placeholder packages (`types`, `utils`, `ui`, `core`, `ai-sdk`) export nothing

## Overall Completion

| Area | % |
|---|---|
| Auth (complete lifecycle) | 100% |
| Database (base models + onboarding) | 45% |
| API endpoints | 30% |
| Security infrastructure | 50% |
| Frontend (foundation, routing, layout, onboarding) | 55% |
| Widget | 0% |
| AI integration | 0% |
| Testing | 0% |
| DevOps / CI | 5% |
| **Overall Backend** | **~35%** |
