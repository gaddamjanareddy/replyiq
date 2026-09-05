# ReplyIQ - Roadmap

> Milestone-driven development plan. Each milestone builds on the previous.

**Last Updated:** 2026-07-22

---

## Milestone 1: Infrastructure

**Goal:** Establish a production-grade monorepo and development environment.

### Features
- [x] Turborepo monorepo with pnpm workspaces
- [x] NestJS + Fastify API scaffold
- [x] Prisma ORM + PostgreSQL
- [x] Docker Compose for local PostgreSQL
- [x] Environment validation with Zod
- [x] Structured logging (Pino)
- [x] Security middleware (Helmet, CORS, Compression)
- [x] Global validation pipe (class-validator)
- [x] Shared config package (ESLint, Prettier, TSConfig)
- [x] CI-ready scripts (build, lint, typecheck, clean)

**Status:** Complete
**Completion:** 100%

---

## Milestone 2: Database

**Goal:** Define the core data models that support multi-tenant business operations.

### Features
- [x] Organization model (multi-tenant root)
- [x] User model (with roles: OWNER, ADMIN, MANAGER)
- [x] Business model (linked to Organization)
- [x] BusinessDomain model (website verification)
- [x] Session model (refresh token storage)
- [x] Enums for all status fields
- [x] Proper indexes and foreign keys
- [x] Seed script with dev data
- [x] Three applied migrations

**Status:** Complete
**Completion:** 100%

---

## Milestone 3: Authentication

**Goal:** Complete auth lifecycle: register, login, refresh, logout, current user.

### Features
- [x] Workspace registration (Org + Business + User in transaction)
- [x] Login with email/password
- [x] Access token generation (15m TTL)
- [x] Refresh token generation (30d TTL)
- [x] Token rotation on refresh
- [x] JWT Passport strategy
- [x] JwtAuthGuard
- [x] Password hashing (argon2)
- [x] Session creation and rotation
- [x] Logout endpoint (session revocation)
- [x] /me endpoint (current user from JWT)
- [x] Login rate limiting
- [ ] Password change endpoint
- [ ] Password reset flow
- [ ] Email verification flow

**Status:** Complete
**Completion:** 100%

> **Note:** Rate limiting, password change, password reset, and email verification are deferred to future milestones. The core auth lifecycle (register, login, refresh, logout, /me) is complete.

---

## Milestone 4: Business Onboarding

**Goal:** Complete business setup flow after registration. End state: Business is `ACTIVE` and ready for Knowledge Ingestion.

**Architecture Document:** [BUSINESS_ONBOARDING.md](product-design/BUSINESS_ONBOARDING.md)

### Features

#### Phase 1: Backend Foundation
- [x] Add new fields to Business model (description, websiteUrl, onboardingStatus)
- [x] Create OnboardingStatus, VerificationMethod enums
- [ ] Create InvitationStatus enum
- [ ] Create Invitation model
- [x] Create OnboardingProgress model
- [x] Run Prisma migration
- [x] Create Business module (controller, service, DTOs)
- [x] Create Domain module (controller, service, DTOs)
- [x] Create DomainVerificationService (DNS TXT + HTML meta tag)
- [ ] Create Invitation module (controller, service, DTOs)
- [x] Create Onboarding module (controller, service, DTOs)

#### Phase 2: Frontend Foundation
- [x] Install React Router and Zustand
- [x] Create router configuration with protected routes
- [x] Create Zustand stores (auth, ui)
- [x] Create AppLayout with sidebar navigation
- [x] Create ProtectedRoute component
- [x] Create API client utilities
- [x] Refactor LoginPage to use router
- [x] Create DashboardPage

#### Phase 3: Onboarding Flow
- [x] Create OnboardingPage with multi-step wizard
- [ ] Create BusinessProfileStep component
- [ ] Create DomainVerificationStep component
- [ ] Create TeamSetupStep component
- [ ] Create OnboardingChecklist component
- [x] Create BusinessSettingsPage
- [x] Create DomainsPage
- [ ] Create TeamPage

#### Phase 4: Integration & Polish
- [x] Connect frontend forms to API endpoints
- [x] Add loading states and error handling
- [ ] Add form validation (Zod schemas)
- [ ] Test domain verification flow end-to-end
- [ ] Test onboarding completion flow end-to-end
- [x] Update seed script with onboarding data
- [ ] Write integration tests

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/businesses/:businessId` | Get business details |
| PATCH | `/businesses/:businessId` | Update business profile |
| GET | `/businesses/:businessId/domains` | List domains |
| POST | `/businesses/:businessId/domains` | Add domain |
| POST | `/businesses/:businessId/domains/:domainId/verify` | Trigger verification |
| GET | `/businesses/:businessId/domains/:domainId/verification-instructions` | Get DNS/meta instructions |
| GET | `/businesses/:businessId/onboarding` | Get onboarding status |
| PATCH | `/businesses/:businessId/onboarding/steps` | Update onboarding step |

> **Note:** Invitation endpoints (POST/DELETE invitations, POST accept/decline) are deferred to Milestone 4B.

### Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/dashboard` | Main dashboard with onboarding checklist |
| Onboarding | `/onboarding` | Guided onboarding wizard |
| Business Settings | `/dashboard/settings` | Edit business profile |
| Domains | `/dashboard/domains` | Manage and verify domains |
| Team | `/dashboard/team` | Manage team members |

### Estimated Timeline

| Sub-Milestone | Deliverable | Estimated |
|---------------|-------------|-----------|
| 4a | Backend APIs complete + migration applied | Day 4 |
| 4b | Frontend shell with routing and stores | Day 6 |
| 4c | Onboarding wizard functional | Day 10 |
| 4d | Full integration tested | Day 14 |

**Status:** 4A Complete (4B Pending)
**Completion:** 75%

---

## Milestone 5: Knowledge Engine

**Goal:** Enable businesses to build a knowledge base that the AI agent uses for responses.

### Features
- [ ] Knowledge source models (FAQ, documents, URLs)
- [ ] Document upload and parsing
- [ ] URL scraping and indexing
- [ ] FAQ creation and management
- [ ] Knowledge chunking and embedding
- [ ] Vector storage integration
- [ ] Knowledge search API
- [ ] Knowledge management UI

**Status:** Not Started
**Completion:** 0%

---

## Milestone 6: AI Receptionist

**Goal:** Build the AI agent that converses with website visitors using the knowledge base.

### Features
- [ ] AI conversation engine (LLM integration)
- [ ] System prompt configuration per business
- [ ] Conversation context management
- [ ] Lead qualification logic
- [ ] Appointment scheduling integration
- [ ] Handoff to human agent flow
- [ ] Conversation history and analytics
- [ ] AI response quality monitoring
- [ ] Multi-channel support (web, email, messaging)

**Status:** Not Started
**Completion:** 0%

---

## Milestone 7: Widget

**Goal:** Build an embeddable chat widget for business websites.

### Features
- [ ] Widget scaffold (Vite + React)
- [ ] Chat UI components
- [ ] Real-time messaging (WebSocket)
- [ ] Visitor identification
- [ ] Widget customization (colors, position, greeting)
- [ ] Widget embed script generation
- [ ] Mobile responsive design
- [ ] Widget analytics

**Status:** Not Started
**Completion:** 0%

---

## Milestone 8: Production

**Goal:** Prepare for production deployment.

### Features
- [ ] API Dockerfile (multi-stage build)
- [ ] Production environment configuration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Error tracking integration (Sentry)
- [ ] Monitoring and health checks
- [ ] Database connection pooling
- [ ] Load testing
- [ ] Security audit
- [ ] Domain and SSL configuration
- [ ] Backup strategy

**Status:** Not Started
**Completion:** 0%

---

## Summary

| Milestone | Status | Completion |
|---|---|---|
| 1. Infrastructure | Complete | 100% |
| 2. Database | Complete | 100% |
| 3. Authentication | Complete | 100% |
| 4. Business Onboarding | 4A Complete | 75% |
| 5. Knowledge Engine | Not Started | 0% |
| 6. AI Receptionist | Not Started | 0% |
| 7. Widget | Not Started | 0% |
| 8. Production | Not Started | 0% |
| **Overall** | | **~48%** |
