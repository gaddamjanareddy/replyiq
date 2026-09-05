> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Product Owner

# 15. Implementation Roadmap

This document defines the complete implementation roadmap for ReplyIQ, starting from actual current repository state. It tracks milestone completion, dependencies, sequencing, and remaining work.

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


## 1. Milestone Overview

| # | Milestone | Status | Progress | Dependencies |
|---|-----------|--------|----------|--------------|
| 1 | Infrastructure | COMPLETE | 100% | None |
| 2 | Database | COMPLETE | 100% | M1 |
| 3 | Authentication | COMPLETE | 100% | M1, M2 |
| 4 | Business Onboarding | IN PROGRESS | 75% | M1, M2, M3 |
| 5 | Knowledge Engine | NOT STARTED | 0% | M4 |
| 6 | AI Receptionist | NOT STARTED | 0% | M5 |
| 7 | Widget | NOT STARTED | 0% | M6 |
| 8 | Production | NOT STARTED | 0% | None (parallel) |

---

## 2. Completed Milestones

### Milestone 1: Infrastructure [100% COMPLETE]

| Feature | Status | Notes |
|---------|--------|-------|
| Turborepo monorepo | Done | `apps/api`, `apps/web`, `packages/shared` |
| NestJS + Fastify | Done | `@nestjs/platform-fastify` |
| Prisma + PostgreSQL | Done | Schema defined, client generated |
| Docker Compose | Done | PostgreSQL service configured |
| Environment validation | Done | `@nestjs/config` with Joi validation |
| Structured logging | Done | Pino logger configured |
| Security middleware | Done | Helmet, CORS, rate limiting |
| Health check endpoint | Done | `/health` returns status |

### Milestone 2: Database [100% COMPLETE]

| Model | Status | Fields |
|-------|--------|--------|
| Organization | Done | id, name, status, createdAt, updatedAt, deletedAt |
| User | Done | id, organizationId, name, email, passwordHash, role, status, createdAt, updatedAt, deletedAt |
| Business | Done | id, organizationId, name, industry, description, websiteUrl, onboardingStatus, status, createdAt, updatedAt, deletedAt |
| BusinessDomain | Done | id, businessId, domain, isPrimary, status, verifiedAt, verificationToken, verificationMethod, createdAt, updatedAt, deletedAt |
| Session | Done | id, userId, refreshTokenHash, expiresAt, lastUsedAt, revokedAt, ipAddress, userAgent, createdAt, updatedAt |
| OnboardingProgress | Done | id, businessId, profileCompleted, firstDomainAdded, firstDomainVerified, onboardingCompleted, createdAt, updatedAt |

| Feature | Status |
|---------|--------|
| All enums (UserRole, BusinessStatus, DomainStatus) | Done |
| Migrations | Done |
| Seed script | Done |
| Indexes on foreign keys | Done |

### Milestone 3: Authentication [100% COMPLETE]

| Feature | Status | Endpoint |
|---------|--------|----------|
| Registration (workspace) | Done | POST /auth/register |
| Login | Done | POST /auth/login |
| Token refresh with rotation | Done | POST /auth/refresh |
| Logout | Done | POST /auth/logout |
| Get current user | Done | GET /auth/me |
| JWT dual secret signing | Done | Access + Refresh secrets |
| Session management | Done | Refresh tokens stored in DB |
| Password hashing (argon2) | Done | Memory-hard, GPU-resistant |

---

## 3. Current Milestone

### Milestone 4: Business Onboarding [75% IN PROGRESS]

#### Phase 4A: Core Onboarding [COMPLETE]

| Feature | Status | Details |
|---------|--------|---------|
| Business CRUD | Done | Create, read, update, delete businesses |
| Domain management | Done | Add, list, remove domains per business |
| Domain verification (DNS TXT) | Done | Automated DNS TXT record verification at `_replyiq-verification.{domain}` |
| Domain verification (HTML file) | Done | Fixed-path verification file fetch (`/replyiq-verification.html (legacy; the meta tag is now the primary placement)`); `<meta>` variant NOT implemented â€” see SPEC-RECONCILIATION-REPORT.md D-01 |
| Onboarding wizard | Done | Multi-step form on frontend |
| Dashboard | Done | Business listing and status display |
| Frontend-backend integration | Done | API calls from React to NestJS |

**Onboarding wizard steps:**
1. Business information (name, industry, description, website)
2. Domain setup (add primary domain)
3. Domain verification (DNS or HTML meta method)
4. Completion and redirect to dashboard

**Dashboard features:**
- Business listing with status badges
- Domain status indicators (verified, pending, failed)
- Quick actions (edit, manage domains, view details)
- Empty state when no businesses exist

#### Phase 4B: Team Management [NOT STARTED]

| Feature | Status | Priority |
|---------|--------|----------|
| User invitation system | Not started | High |
| Team member list | Not started | High |
| Role management (Owner, Admin, Member) | Not started | Medium |
| Remove team member | Not started | Medium |
| Transfer ownership | Not started | Low |
| Business logo upload | Not started | Low |

**Phase 4B acceptance criteria:**
- Owner can invite users by email
- Invited users receive email with join link
- Invited users create account or link to existing account
- Team members can be assigned roles (Admin, Member)
- Admin can manage team (add/remove members)
- Member has read-only access to business data
- Owner can transfer ownership to another member
- Business logo can be uploaded and displayed

**Phase 4B estimated effort:** 2-3 weeks

---

## 4. Remaining Milestones

### Milestone 5: Knowledge Engine [NOT STARTED - 0%]

**Depends on:** Milestone 4 (Business must be ACTIVE)

**Estimated effort:** 4-6 weeks

| Feature | Status | Priority | Description |
|---------|--------|----------|-------------|
| Knowledge source models | Not started | High | Prisma models for documents, URLs, FAQs |
| Document upload | Not started | High | File upload with progress indicator |
| Document parsing | Not started | High | PDF, DOCX, TXT extraction |
| URL scraping | Not started | High | Fetch and extract content from URLs |
| FAQ management | Not started | High | CRUD for frequently asked questions |
| Text chunking | Not started | High | Split documents into embeddable chunks |
| Embedding generation | Not started | High | OpenAI embeddings API integration |
| Vector storage | Not started | High | Store embeddings (pgvector or Pinecone) |
| Semantic search API | Not started | High | Search knowledge base by meaning |
| Knowledge management UI | Not started | Medium | View, manage, delete knowledge sources |
| Ingestion pipeline | Not started | High | End-to-end document processing |
| Source status tracking | Not started | Medium | Processing, ready, failed states |
| Content preview | Not started | Low | Preview parsed content before saving |
| Bulk operations | Not started | Low | Upload multiple files at once |

**Technical prerequisites:**
- Vector database setup (pgvector extension or external service)
- File storage solution (local filesystem or S3)
- Background job processing (Bull/BullMQ or similar)
- OpenAI API key for embeddings

**Architecture decisions needed:**
- Vector storage: pgvector (simpler, single DB) vs Pinecone (scalable, managed)
- File storage: local filesystem vs S3-compatible storage
- Job queue: in-process vs Redis-backed

### Milestone 6: AI Receptionist [NOT STARTED - 0%]

**Depends on:** Milestone 5 (needs knowledge base for grounding)

**Estimated effort:** 4-6 weeks

| Feature | Status | Priority | Description |
|---------|--------|----------|-------------|
| LLM integration | Not started | High | OpenAI API client setup |
| System prompt configuration | Not started | High | Customizable per business |
| Context window management | Not started | High | Conversation history management |
| Knowledge retrieval | Not started | High | RAG pipeline for grounded responses |
| Lead qualification | Not started | High | Structured data extraction from conversation |
| Appointment scheduling | Not started | Medium | Calendar integration or booking flow |
| Human handoff | Not started | High | Transfer to human agent when needed |
| Conversation history | Not started | High | Store and retrieve past conversations |
| AI quality monitoring | Not started | Medium | Track response quality metrics |
| Multi-turn conversation | Not started | High | Maintain context across messages |
| Fallback responses | Not started | Medium | Helpful responses when knowledge is insufficient |
| Streaming responses | Not started | Medium | Stream AI responses for better UX |
| Conversation metadata | Not started | Low | Tags, categories, sentiment |

**Technical prerequisites:**
- OpenAI API key (or alternative LLM provider)
- Streaming support infrastructure
- Conversation storage schema (already defined in M2)
- Knowledge base populated (from M5)

**Architecture decisions needed:**
- LLM provider: OpenAI vs Anthropic vs self-hosted
- Streaming: SSE vs WebSocket vs polling
- Prompt management: static vs dynamic template system
- Rate limiting: per-business, per-conversation, global

### Milestone 7: Widget [NOT STARTED - 0%]

**Depends on:** Milestone 6 (needs AI conversation engine)

**Estimated effort:** 4-6 weeks

| Feature | Status | Priority | Description |
|---------|--------|----------|-------------|
| Widget scaffold | Not started | High | Vite + React standalone build |
| Chat UI | Not started | High | Message list, input, send button |
| Real-time messaging | Not started | High | Bidirectional communication |
| Visitor identification | Not started | Medium | Optional email/name capture |
| Widget customization | Not started | Medium | Colors, position, size, welcome message |
| Embed script generation | Not started | High | Copy-paste script tag |
| Mobile responsive | Not started | High | Full functionality on mobile |
| Widget analytics | Not started | Medium | Track conversations, engagement |
| Offline handling | Not started | Medium | Graceful degradation |
| Style isolation | Not started | High | Shadow DOM or iframe isolation |
| Widget configuration panel | Not started | Low | Admin UI for customization |
| File/image upload | Not started | Low | Visitors can send images |
| Widget pre-chat survey | Not started | Low | Collect info before conversation |

**Technical prerequisites:**
- AI conversation engine running (from M6)
- WebSocket or HTTP streaming infrastructure
- Widget hosting (CDN or static hosting)
- Embed script delivery mechanism

**Architecture decisions needed:**
- Rendering: Shadow DOM vs iframe vs isolated styles
- Communication: WebSocket vs SSE vs HTTP polling
- Hosting: CDN (Cloudflare) vs static hosting vs self-hosted
- Build: Single bundle vs multiple chunks

### Milestone 8: Production [NOT STARTED - 0%]

**Can run in parallel with M5-M7** (infrastructure and tooling work)

**Estimated effort:** 3-4 weeks

| Feature | Status | Priority | Description |
|---------|--------|----------|-------------|
| API Dockerfile | Not started | High | Multi-stage production build |
| Production configuration | Not started | High | Environment-specific config |
| CI/CD pipeline | Not started | High | Automated test + deploy |
| Swagger/OpenAPI | Not started | Medium | API documentation endpoint |
| Error tracking | Not started | High | Sentry or equivalent |
| Monitoring | Not started | High | Metrics, dashboards, alerts |
| Connection pooling | Not started | High | PgBouncer or Prisma pool |
| Load testing | Not started | Medium | Validate at expected capacity |
| Security audit | Not started | High | Vulnerability scanning |
| Domain + SSL | Not started | High | Custom domain with TLS |
| Backup strategy | Not started | High | Automated backups + restore test |
| Log aggregation | Not started | Medium | Centralized logging |
| Rate limiting (production) | Not started | High | Redis-backed rate limiting |
| CORS (production) | Not started | High | Restrict to known origins |

**Technical prerequisites:**
- Cloud hosting provider selected (AWS, GCP, Railway, Render)
- Domain purchased and DNS configured
- CI/CD platform selected (GitHub Actions, GitLab CI)
- Error tracking service selected (Sentry)
- Monitoring service selected (Grafana, Datadog)

### Reconciliation Backlog (2026-08 spec/code reconciliation)

Derived from SPEC-RECONCILIATION-REPORT.md. Ordered by recommended implementation sequence.

| # | Item | Priority | Status | Spec Ref |
|---|------|----------|--------|----------|
| R1 | SSRF hardening for HTML_META verification fetch (private-IP blocking, redirect cap, response-size limit) | P0 before production | APPROVED (D-01) - IMPLEMENTED (hardening loop 2026-08-24) | 12 Â§13 |
| R2 | Stable machine-readable error codes + UI error translation layer | P1 | APPROVED (D-06/D-07 depend on codes) - IMPLEMENTED (hardening loop 2026-08-24) | 09 Â§1.7, 03 Â§6.3 |
| R3 | Wire RolesGuard + `@Roles()` (remap matrix to OWNER/ADMIN/MANAGER) | P1 | APPROVED (D-07) - IMPLEMENTED (hardening loop 2026-08-24) | 12 Â§10 |
| R4 | Replace OrganizationGuard stub with real tenant guard (service-layer checks stay as defense in depth) | P1 | APPROVED - IMPLEMENTED (hardening loop 2026-08-24) | 12 Â§11 |
| R5 | Domain verify endpoint rate limiting (IP-based per existing throttler architecture; org/domain-level documented as future) | P1 | APPROVED - IMPLEMENTED (hardening loop 2026-08-24) | 12 Â§13 |
| R6 | Soft-deleted domain names block re-registration: partial unique index vs hard delete vs keep | P2 decision | RESOLVED - APPROVED D-02: partial unique index via hand-maintained migration | 08 Â§9.3.1 |
| R7 | Adopt or reject `<meta>` head-tag verification variant | P2 decision | RESOLVED - REJECTED by D-01 (fixed-file only, shipped with SSRF hardening) | 09 Â§5.13 |
| R8 | Business `status` activation trigger after onboarding completion | P2 decision | RESOLVED - APPROVED D-05: atomic activation inside COMPLETE transaction | 01 FR-BIZ-03 |
| R9 | DEV_BYPASS dev/test verification bypass | P2 decision | RESOLVED - REJECTED by D-04; staging/test-domain strategy documented in 14-QA Â§10 | report D-04 |
| R10 | Delete-domain confirmation dialog (frontend) | P2 | APPROVED - IMPLEMENTED (hardening loop 2026-08-24) | 03 Â§6.5 |
| R11 | Unify register response with standard success envelope (breaking) | P3 | DEFERRED by D-03 (flat shape is the contract) | 09 Â§5.2 |
| R12 | Env template cleanup: root `.env.example` documents only DATABASE_URL today | P3 | APPROVED - IMPLEMENTED (hardening loop 2026-08-24) | 13 §5.2 |

---

## 5. Dependencies

### Dependency Graph

```
M1 (Infrastructure)
 â””â”€â”€ M2 (Database)
      â””â”€â”€ M3 (Authentication)
           â””â”€â”€ M4 (Business Onboarding)
                â”œâ”€â”€ M5 (Knowledge Engine)
                â”‚    â””â”€â”€ M6 (AI Receptionist)
                â”‚         â””â”€â”€ M7 (Widget)
                â””â”€â”€ [M8 can start in parallel]
```

### Cross-Milestone Dependencies

| Feature | Depends On | Reason |
|---------|------------|--------|
| Business CRUD | Authentication | Needs authenticated user context |
| Domain verification | Business | Domain belongs to a business |
| Knowledge sources | Business | Knowledge is per-business |
| Document processing | Knowledge sources | Process content from sources |
| AI conversations | Knowledge base | Responses grounded in knowledge |
| Widget conversations | AI engine | Widget delegates to AI |
| Production deploy | All features | Deploy complete product |
| Error tracking | Production infrastructure | Needs deployed environment |
| Load testing | Production infrastructure | Needs deployed environment |

### Independent Work Streams

These can be developed in parallel:

1. **M5 (Knowledge Engine)** - Can start once M4 is complete
2. **M8 (Production)** - Infrastructure work can start immediately
3. **Phase 4B (Team Management)** - Can start after Phase 4A
4. **Testing infrastructure** - Can start at any time
5. **Documentation** - Can be written alongside any milestone

---

## 6. Feature Sequencing

### Recommended Development Order

**Immediate (Weeks 1-3): Complete Phase 4B**
1. User invitation system
2. Team member management
3. Role management
4. Business logo upload

**Short-term (Weeks 4-9): Milestone 5**
1. Knowledge source models
2. Document upload and parsing
3. URL scraping
4. FAQ management
5. Text chunking and embedding
6. Vector storage
7. Knowledge search API
8. Knowledge management UI

**Medium-term (Weeks 10-15): Milestone 6**
1. LLM integration
2. System prompt configuration
3. Conversation context management
4. Knowledge retrieval (RAG)
5. Lead qualification
6. Human handoff
7. Conversation history
8. AI quality monitoring

**Medium-term (Weeks 12-17): Milestone 7** (overlap with M6)
1. Widget scaffold
2. Chat UI
3. Real-time messaging
4. Widget customization
5. Embed script generation
6. Mobile responsive
7. Widget analytics

**Parallel (Weeks 4-8): Milestone 8**
1. API Dockerfile
2. CI/CD pipeline
3. Error tracking
4. Monitoring
5. Production configuration
6. Security audit
7. Load testing

### Critical Path

The critical path is: **M4 -> M5 -> M6 -> M7**

Any delay on this path directly delays the launch.

---

## 7. Technical Prerequisites

### Per Milestone

| Milestone | Prerequisites |
|-----------|---------------|
| M4 Phase 4B | Email service (for invitations), File storage (for logos) |
| M5 | Vector database (pgvector or Pinecone), File storage (S3 or local), Background job queue |
| M6 | OpenAI API key, Streaming infrastructure, Conversation storage |
| M7 | CDN for widget hosting, WebSocket or SSE infrastructure, Domain for widget delivery |
| M8 | Cloud hosting provider, Domain + SSL, CI/CD platform, Error tracking service, Monitoring service |

### Infrastructure Decisions

| Decision | Options | Recommended | Rationale |
|----------|---------|-------------|-----------|
| Vector database | pgvector, Pinecone, Weaviate | pgvector | Single database, simpler ops |
| File storage | Local filesystem, S3, Cloudflare R2 | S3 | Industry standard, scalable |
| Job queue | In-process, BullMQ, Inngest | BullMQ | Redis-backed, reliable |
| LLM provider | OpenAI, Anthropic, self-hosted | OpenAI | Best ecosystem, reliable |
| Hosting | AWS, GCP, Railway, Render | Railway | Fast setup, good DX |
| CI/CD | GitHub Actions, GitLab CI | GitHub Actions | Native integration |
| Error tracking | Sentry, Bugsnag, Rollbar | Sentry | Free tier, widely used |
| Monitoring | Grafana, Datadog, New Relic | Grafana | Free, self-hostable |
| CDN | Cloudflare, Fastly, AWS CloudFront | Cloudflare | Free tier, global |

---

## 8. AI & Knowledge Milestones Detail

### Milestone 5: Knowledge Engine - Technical Approach

**Data Flow:**
```
Upload -> Parse -> Chunk -> Embed -> Store -> Search
                                    |
Content Types:                      v
- PDF                           Vector DB
- DOCX                         (pgvector)
- TXT
- URL scrape
- FAQ entries
```

**Embedding Strategy:**
- Model: text-embedding-3-small (OpenAI)
- Dimensions: 1536
- Chunk size: 500-1000 tokens
- Chunk overlap: 50-100 tokens
- Storage: pgvector extension on existing PostgreSQL

**Search Strategy:**
- Cosine similarity for semantic search
- Hybrid search: semantic + keyword (BM25)
- Top-K retrieval: 10 results
- Relevance threshold: 0.7 minimum similarity score
- Context window: Top 5 results for AI prompt

### Milestone 6: AI Receptionist - Technical Approach

**RAG Pipeline:**
```
User Message -> Embed Query -> Search Knowledge -> Build Context -> Generate Response
                                    |
                              +-----------+
                              | Knowledge |
                              |   Chunks  |
                              +-----------+
```

**Conversation Management:**
- Maximum context window: 8000 tokens
- History: Last 20 messages
- System prompt: Business-specific, customizable
- Temperature: 0.7 (balanced creativity/accuracy)
- Max tokens: 500 per response

**Lead Qualification:**
- Extract: name, email, phone, company, intent
- Validate: email format, phone format
- Store: structured lead data
- Trigger: handoff when qualified

**Human Handoff Triggers:**
- Explicit request ("talk to a human")
- Low confidence score (< 0.5)
- Sensitive topics (complaints, legal)
- Appointment scheduling required
- Custom triggers per business

---

## 9. Widget Milestones Detail

### Milestone 7: Widget - Technical Approach

**Architecture:**
```
Embed Script -> Widget Bundle -> Shadow DOM -> Chat UI
                |
                +-> WebSocket/SSE -> API -> AI Engine
```

**Widget Bundle:**
- Framework: React (same as web app)
- Build: Vite with library mode
- Output: Single JS file (< 50KB gzipped)
- Dependencies: Minimal (no heavy UI libraries)
- Styling: CSS-in-JS or Tailwind (isolated)

**Communication Protocol:**
- Initial connection: HTTP POST to create conversation
- Messages: WebSocket for real-time
- Fallback: HTTP polling if WebSocket fails
- Heartbeat: Every 30 seconds

**Customization Options:**
- Primary color
- Position (bottom-right, bottom-left)
- Size (small, medium, large)
- Welcome message
- Pre-chat survey fields
- Business logo
- Header text
- Offline message

---

## 10. Production Hardening

### Milestone 8: Production - Technical Approach

**Docker Setup:**
```dockerfile
# Multi-stage build
# Stage 1: Build
FROM node:20-alpine AS builder
# ... build NestJS API

# Stage 2: Production
FROM node:20-alpine AS runner
# ... minimal production image
```

**CI/CD Pipeline:**
```yaml
# GitHub Actions
jobs:
  test:
    - Type checking
    - Linting
    - Unit tests
    - Integration tests
    - Build
  
  deploy:
    - Build Docker image
    - Push to registry
    - Deploy to hosting
    - Health check
    - Notify
```

**Monitoring Stack:**
- Application metrics: Custom NestJS metrics module
- Infrastructure metrics: Host-level metrics
- Logs: Structured JSON -> aggregation service
- Errors: Sentry with source maps
- Uptime: Health check monitoring
- Alerts: Email + Slack notifications

**Security Checklist:**
- [ ] All secrets in environment variables
- [ ] HTTPS enforced
- [ ] CORS restricted to known origins
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma)
- [ ] XSS prevention (output encoding)
- [ ] CSRF protection
- [ ] Security headers (Helmet)
- [ ] Dependency vulnerability scanning
- [ ] Container scanning
- [ ] Penetration testing

**Backup Strategy:**
- Database: Automated daily backups, 30-day retention
- Files: S3 versioning enabled
- Configuration: Version controlled
- Recovery: Tested monthly
- RPO: 24 hours
- RTO: 4 hours

---

## 11. Launch Readiness

### Pre-Launch Checklist

**Infrastructure:**
- [ ] Production environment provisioned
- [ ] Domain configured with SSL
- [ ] CDN configured for static assets
- [ ] Database backups enabled
- [ ] Monitoring dashboards configured
- [ ] Alerting rules configured
- [ ] Log aggregation configured

**Application:**
- [ ] All milestones complete
- [ ] All tests passing
- [ ] Load testing passed
- [ ] Security audit passed
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met

**Documentation:**
- [ ] API documentation complete
- [ ] User documentation complete
- [ ] Admin documentation complete
- [ ] Deployment documentation complete
- [ ] Runbook for common issues

**Operations:**
- [ ] On-call rotation established
- [ ] Incident response process documented
- [ ] Rollback procedure tested
- [ ] Scaling procedure documented
- [ ] Cost monitoring configured

### Launch Criteria

| Criterion | Target | Current |
|-----------|--------|---------|
| All milestones complete | 8/8 | 3/8 |
| Test coverage | > 70% | 0% |
| P0/P1 bugs | 0 | Unknown |
| Load test capacity | 1000 concurrent | Not tested |
| Security scan | 0 critical/high | Not scanned |
| Accessibility | WCAG 2.1 AA | Not audited |
| Page load time | < 2.5s | Not measured |
| API response time | < 100ms p50 | Not measured |

---

## 12. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM API costs exceed budget | Medium | High | Implement token limits, cache common queries |
| Vector database performance | Low | Medium | Use pgvector (same DB), optimize indexes |
| Widget conflicts with host pages | High | Medium | Shadow DOM isolation, extensive testing |
| Multi-tenant data leakage | Low | Critical | Automated security tests, manual audits |
| Scope creep delays milestones | High | High | Strict adherence to spec, feature freeze |
| Key dependency becomes unavailable | Low | High | Abstract LLM provider, avoid vendor lock-in |
| Performance degrades at scale | Medium | High | Load testing early, connection pooling |

---

## 13. Success Metrics

### Technical Metrics (at launch)
- API uptime: 99.9%
- Average response time: < 100ms
- Widget load time: < 1s
- AI response time: < 3s
- Error rate: < 0.1%
- Test coverage: > 70%

### Product Metrics (30 days post-launch)
- Registration conversion: > 20%
- Onboarding completion: > 60%
- Knowledge sources added: > 3 per business
- Widget installs: > 10 per business
- AI conversations: > 100 per business
- Customer satisfaction: > 4.0/5.0

