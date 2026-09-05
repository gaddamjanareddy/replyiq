> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Product Owner

# 14. Quality Assurance, Acceptance Criteria & Definition of Done

This document defines how we know the product is correct, the testing strategy, acceptance criteria per milestone, release gates, and the definition of done for every feature.

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


## 1. Current State

| Metric | Value |
|--------|-------|
| Test files | 0 across entire repository |
| Testing framework | Not configured |
| Test scripts in package.json | None |
| CI test step | Not configured |
| Coverage tooling | Not installed |

The testing infrastructure is built from scratch. There is no legacy test debt because no tests exist yet.

---

## 2. Testing Strategy

### 2.1 Framework Selection

| Layer | Tool | Rationale |
|-------|------|-----------|
| Unit tests | Vitest | Native ESM support, fast, compatible with TypeScript, co-location pattern |
| Integration tests | Vitest + supertest | HTTP endpoint testing with real Express/Fastify handlers |
| E2E tests | Playwright | Cross-browser, auto-wait, network interception, screenshot comparison |
| API tests | supertest + Vitest | Automated endpoint validation for all 15 API endpoints |
| AI evaluation | Custom eval harness | Response quality, relevance, hallucination detection |
| Coverage | c8 (V8 provider) | Line, branch, function coverage reporting |

### 2.2 Test Organization

```
apps/api/src/
  services/
    business.service.ts
    business.service.test.ts        # Unit test co-located
  modules/
    business/
      business.controller.ts
      business.integration.test.ts  # Integration test co-located
      business.e2e.test.ts          # E2E test co-located

apps/web/src/
  components/
    Button.tsx
    Button.test.tsx                 # Component test co-located
  pages/
    Dashboard.tsx
    Dashboard.test.tsx

tests/
  e2e/
    auth.spec.ts                    # Playwright E2E
    onboarding.spec.ts
    dashboard.spec.ts
  api/
    endpoints.test.ts               # API endpoint sweep
  performance/
    load.test.ts                    # Performance benchmarks
  security/
    security.test.ts                # Security validation
```

### 2.3 Test Naming Convention

- Unit: `<unit-name>.test.ts`
- Integration: `<unit-name>.integration.test.ts`
- E2E: `<feature-name>.spec.ts`
- API: `<feature>.api.test.ts`
- Security: `<area>.security.test.ts`
- Performance: `<area>.perf.test.ts`

### 2.4 Coverage Targets

| Metric | Minimum | Target |
|--------|---------|--------|
| Line coverage | 60% | 80% |
| Branch coverage | 50% | 70% |
| Function coverage | 60% | 80% |
| Critical path coverage | 100% | 100% |

Critical paths that must always have 100% coverage:
- Authentication (login, register, refresh, logout)
- Token validation
- Multi-tenant isolation (organization scoping)
- Password hashing and verification
- Business domain verification

---

## 3. Test Types

### 3.1 Unit Tests

**Scope:** Individual functions, methods, and classes in isolation.

**What to test:**

| Area | Examples |
|------|----------|
| Service methods | `BusinessService.create()`, `BusinessService.findAll()` |
| Utility functions | `generateSlug()`, `formatDate()`, `validateEmail()` |
| DTO validation | `CreateBusinessDto` accepts valid input, rejects invalid |
| Component rendering | `<Button />` renders with correct text, handles click |
| Helpers | `hashPassword()`, `comparePassword()`, `generateToken()` |
| Validators | All class-validator decorators on DTOs |

**Patterns:**
- Mock all external dependencies (database, external APIs, LLM)
- Use `vi.fn()` for function mocks, `vi.mock()` for module mocks
- Test both happy path and error paths
- Assert exact return values and error messages
- One assertion per concept where practical

**Example:**
```typescript
// business.service.test.ts
describe('BusinessService', () => {
  describe('create', () => {
    it('should create a business with valid data', async () => { ... });
    it('should throw ConflictException if slug already exists', async () => { ... });
    it('should throw BadRequestException if domain is not ACTIVE', async () => { ... });
    it('should generate slug from name when not provided', async () => { ... });
  });

  describe('findByOrganization', () => {
    it('should return only businesses belonging to the organization', async () => { ... });
    it('should return empty array when no businesses exist', async () => { ... });
    it('should not return businesses from other organizations', async () => { ... });
  });
});
```

### 3.2 Integration Tests

**Scope:** Multiple units working together, real database operations, real HTTP requests.

**What to test:**

| Area | Scenarios |
|------|-----------|
| API endpoint testing | Full request/response cycle for each endpoint |
| Database operations | Create, read, update, delete with Prisma |
| Auth flow testing | Register -> Login -> Access protected -> Refresh -> Logout |
| Multi-tenant isolation | User A cannot see User B's data through any endpoint |
| Domain verification | DNS TXT lookup (`_replyiq-verification.{domain}`), HTML verification-file flow (`/replyiq-verification.html (legacy; the meta tag is now the primary placement)` body == `replyiq-verify:{token}`); token stability across retries; 409 on duplicate domain (including soft-deleted names) |

**Patterns:**
- Use real PostgreSQL test database (separate from dev)
- Run migrations before test suite
- Seed minimal test data
- Clean up after each test (or use transactions with rollback)
- Use `beforeAll` / `afterAll` for setup/teardown

**Setup:**
```typescript
// test-setup.ts
beforeAll(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE "Business" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`;
  // Seed test data
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

**Example:**
```typescript
// business.integration.test.ts
describe('Business API Integration', () => {
  let authToken: string;
  let organizationId: string;

  beforeAll(async () => {
    // Register, login, capture token
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'Password123!', workspace: 'test-org' });
    authToken = registerResponse.body.accessToken;
    organizationId = registerResponse.body.user.organizationId;
  });

  it('POST /businesses should create a business', async () => {
    const response = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Business', industry: 'Technology' });
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });

  it('GET /businesses should return only org businesses', async () => {
    const response = await request(app)
      .get('/businesses')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
    expect(response.body.every(b => b.organizationId === organizationId)).toBe(true);
  });

  it('GET /businesses should reject unauthenticated requests', async () => {
    const response = await request(app).get('/businesses');
    expect(response.status).toBe(401);
  });
});
```

### 3.3 E2E Tests

**Scope:** Full user workflows through the browser, simulating real user behavior.

**Test matrix:**

| Flow | Steps | Success Criteria |
|------|-------|-----------------|
| Registration | Fill form -> Submit -> Redirect to login | User created, email stored, redirect occurs |
| Login | Enter credentials -> Submit -> Redirect to dashboard | Token set, user data loaded, dashboard renders |
| Onboarding wizard | Step 1 (business info) -> Step 2 (domains) -> Step 3 (verify) -> Complete | Business created, domains added, verification attempted |
| Domain management | Add domain -> Verify domain -> Remove domain | Domain created, verification status updates, domain removed |
| Dashboard navigation | Click nav items -> Verify page loads | All routes render, data loads, no errors |
| Token refresh | Wait for token expiry -> Perform action -> Auto-refresh | Silent refresh, no interruption, action succeeds |

**Browser coverage:**
- Chromium (primary)
- Firefox
- WebKit (Safari)

**Viewports:**
- 375x812 (iPhone)
- 768x1024 (iPad)
- 1440x900 (Desktop)
- 2560x1440 (Large desktop)

**Example:**
```typescript
// auth.spec.ts
test('complete login flow', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  await page.fill('[data-testid="password-input"]', 'Password123!');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
  expect(await page.locator('[data-testid="user-menu"]').textContent()).toContain('test@example.com');
});
```

### 3.4 API Tests

**Scope:** All 15 API endpoints validated automatically.

**Endpoint test matrix:**

| Endpoint | Method | Tests |
|----------|--------|-------|
| /auth/register | POST | Valid register, duplicate email, invalid input, missing fields |
| /auth/login | POST | Valid login, wrong password, non-existent user, missing fields |
| /auth/refresh | POST | Valid refresh, expired refresh token, revoked token |
| /auth/logout | POST | Valid logout, refresh token revoked after logout |
| /auth/me | GET | Returns current user, rejects unauthenticated |
| /businesses | GET | Lists user businesses, empty list, organization scoped |
| /businesses | POST | Creates business, validates input, generates slug |
| /businesses/:id | GET | Returns business, 404 for non-existent, 403 for wrong org |
| /businesses/:id | PATCH | Updates business, validates input |
| /businesses/:id | DELETE | Soft deletes business |
| /businesses/:id/domains | GET | Lists domains for business |
| /businesses/:id/domains | POST | Adds domain, validates format |
| /businesses/:id/domains/:domainId | DELETE | Removes domain |
| /businesses/:id/domains/:domainId/verify | POST | Triggers verification, returns status |
| /health | GET | Returns healthy status |

**Validation for each endpoint:**
- Correct status codes for success (2xx)
- Correct status codes for client errors (4xx)
- Correct status codes for server errors (5xx)
- Response body schema matches DTO
- Response headers correct
- Rate limiting enforced where applicable
- CORS headers present

### 3.5 Responsive Testing

**Breakpoints:**

| Tier | Viewport | Target |
|------|----------|--------|
| Mobile | < 1024px | Phones, small tablets |
| Tablet | 1024px - 1440px | iPads, small laptops |
| Desktop | > 1440px | Standard monitors, large displays |

**What to validate per breakpoint:**
- Layout does not overflow or cause horizontal scroll
- Touch targets are at least 44x44px on mobile
- Navigation collapses to hamburger on mobile
- Forms are usable and inputs are properly sized
- Tables switch to card layout on mobile
- Modals are full-screen on mobile
- Typography scales appropriately
- Images are properly sized and do not distort

**Test approach:**
- Playwright viewport resizing for automated checks
- Manual spot-check for visual regression
- Automated screenshot comparison at each breakpoint

### 3.6 Accessibility Testing

**Standards:** WCAG 2.1 AA compliance.

| Check | Tool/Method | Target |
|-------|-------------|--------|
| Keyboard navigation | Manual + Playwright | All interactive elements reachable via Tab |
| Focus management | Manual | Focus moves logically, visible focus ring |
| Screen reader | Manual with NVDA/VoiceOver | All content announced correctly |
| Color contrast | axe-core automated | 4.5:1 for text, 3:1 for large text |
| ARIA attributes | axe-core + manual | Correct roles, labels, states |
| Form labels | axe-core | All inputs have associated labels |
| Error announcements | Manual | Errors announced to screen readers |
| Skip navigation | Manual | Skip link present and functional |
| Image alt text | axe-core | All images have descriptive alt text |
| Heading hierarchy | axe-core | Logical heading structure (h1 -> h2 -> h3) |

**Automated integration:**
```typescript
// accessibility.test.ts
import axe from 'axe-core';

test('dashboard has no accessibility violations', async ({ page }) => {
  await page.goto('/dashboard');
  const results = await page.evaluate(() => axe.run());
  expect(results.violations).toHaveLength(0);
});
```

### 3.7 Security Testing

| Category | Tests |
|----------|-------|
| Authentication bypass | Attempt access to protected routes without token |
| Token manipulation | Tamper with JWT payload, verify rejection |
| Authorization checks | User A cannot access User B's resources |
| Multi-tenant isolation | Complete data isolation between organizations |
| Input validation | SQL injection, XSS payloads in all input fields |
| Rate limiting | Brute force login attempts, verify lockout/blocking |
| CORS | Verify only allowed origins can make requests |
| Password security | Verify argon2 hashing, minimum complexity enforced |
| Refresh token rotation | Verify old refresh token is invalidated after rotation |
| Session management | Verify sessions are properly terminated on logout |
| Secret exposure | Verify no secrets in logs, responses, or client bundle |

**Test patterns:**
```typescript
// security.test.ts
describe('Security', () => {
  it('should reject requests without authentication', async () => {
    const response = await request(app).get('/businesses');
    expect(response.status).toBe(401);
  });

  it('should reject tampered JWT tokens', async () => {
    const response = await request(app)
      .get('/businesses')
      .set('Authorization', 'Bearer tampered.token.here');
    expect(response.status).toBe(401);
  });

  it('should prevent cross-tenant data access', async () => {
    // Create business as User A
    // Attempt to access as User B
    // Should return 403 or 404
  });

  it('should rate limit login attempts', async () => {
    for (let i = 0; i < 6; i++) {
      await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'wrong'
      });
    }
    const response = await request(app).post('/auth/login').send({
      email: 'test@example.com',
      password: 'wrong'
    });
    expect(response.status).toBe(429);
  });

  it('should sanitize XSS in input fields', async () => {
    const response = await request(app)
      .post('/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '<script>alert("xss")</script>' });
    expect(response.body.name).not.toContain('<script>');
  });
});
```

### 3.8 Performance Testing

| Metric | Target | Measurement |
|--------|--------|-------------|
| API response time (p50) | < 100ms | Load testing with autocannon |
| API response time (p99) | < 500ms | Load testing with autocannon |
| Page load time (LCP) | < 2.5s | Lighthouse |
| First input delay | < 100ms | Lighthouse |
| Cumulative layout shift | < 0.1 | Lighthouse |
| Bundle size (initial) | < 200KB gzipped | webpack-bundle-analyzer |
| Time to interactive | < 3s on 3G | Lighthouse |
| Database query time | < 50ms per query | Prisma tracing |
| Widget load time | < 1s | Direct measurement |

**Load test scenarios:**
- 10 concurrent users browsing dashboard
- 50 concurrent users hitting API
- 100 concurrent users accessing widget
- Burst traffic: 200 requests in 10 seconds on /health

### 3.9 AI Evaluation

**Scope:** Quality of AI-generated responses from the receptionist.

| Metric | Target | Method |
|--------|--------|--------|
| Relevance score | > 0.8 | Cosine similarity between response and knowledge base |
| Factual accuracy | > 0.9 | Manual review of 100 sample conversations |
| Hallucination rate | < 5% | Automated detection + manual audit |
| Response time | < 3s | End-to-end measurement |
| Context coherence | > 0.85 | Multi-turn conversation quality |
| Lead qualification accuracy | > 0.85 | Compare AI classification to manual classification |
| Tone consistency | > 0.8 | Sentiment analysis across responses |
| Fallback rate | < 10% | Percentage of conversations that require human handoff |

**Test approach:**
- Curated dataset of 200+ common customer questions
- Automated relevance scoring using embeddings
- Manual review sessions for quality assurance
- A/B testing framework for prompt optimization
- Regression tests for known edge cases

---

## 4. Acceptance Criteria Per Milestone

### Milestone 1: Infrastructure [COMPLETE]

All infrastructure acceptance criteria have been met:
- Turborepo monorepo builds and runs
- NestJS + Fastify server starts and responds
- Prisma connects to PostgreSQL
- Docker Compose starts all services
- Environment validation rejects invalid config
- Logging outputs structured JSON
- Security middleware applied to all routes

### Milestone 2: Database [COMPLETE]

All database acceptance criteria have been met:
- All models exist in Prisma schema
- All migrations run cleanly
- Seed script populates test data
- Relationships are correct
- Enums are properly typed
- Indexes are present on frequently queried fields

### Milestone 3: Authentication [COMPLETE]

All authentication acceptance criteria have been met:
- Registration creates user with hashed password
- Login returns valid JWT tokens
- Access token expires and can be refreshed
- Refresh token rotation works correctly
- Logout invalidates refresh token
- /me returns current user data
- Passwords are never stored in plain text
- Dual secret signing works

### Milestone 4: Business Onboarding [75%]

**Phase 4A [COMPLETE]:**
- [x] Business CRUD operations work
- [x] Domain management (add, list, remove) works
- [x] Domain verification via DNS TXT records works
- [x] Domain verification via HTML verification file works (`HTML_META` = fetch of `/replyiq-verification.html (legacy; the meta tag is now the primary placement)`; body must equal `replyiq-verify:{token}`)
- [x] Onboarding wizard guides user through setup
- [x] Dashboard displays business data
- [x] Frontend-backend integration functional

**Phase 4B [NOT STARTED]:**
- [ ] User invitation system sends invitations
- [ ] Team members can be added to organization
- [ ] Business logo upload works
- [ ] Team member roles are enforced

### Milestone 5: Knowledge Engine [NOT STARTED]

Acceptance criteria when complete:
- [ ] Knowledge sources can be created, updated, deleted
- [ ] Documents (PDF, DOCX, TXT) upload and parse correctly
- [ ] URLs are scraped and content extracted
- [ ] FAQ entries are stored and retrievable
- [ ] Text is chunked into appropriate segments (500-1000 tokens)
- [ ] Embeddings are generated and stored in vector database
- [ ] Semantic search returns relevant results
- [ ] Knowledge management UI displays all sources
- [ ] Search API returns ranked results with scores
- [ ] Ingestion pipeline processes documents end-to-end
- [ ] Large documents (>10MB) are handled gracefully
- [ ] Duplicate content is detected and handled

### Milestone 6: AI Receptionist [NOT STARTED]

Acceptance criteria when complete:
- [ ] LLM integration produces coherent responses
- [ ] System prompt configuration is customizable per business
- [ ] Conversation context is maintained across turns
- [ ] Lead qualification asks relevant questions
- [ ] Appointment scheduling flow works end-to-end
- [ ] Human handoff triggers correctly
- [ ] Conversation history is stored and retrievable
- [ ] AI quality monitoring tracks response metrics
- [ ] Responses are grounded in knowledge base (no hallucination)
- [ ] Multi-language support works (if applicable)
- [ ] Fallback responses are helpful when knowledge is insufficient
- [ ] Response time is under 3 seconds

### Milestone 7: Widget [NOT STARTED]

Acceptance criteria when complete:
- [ ] Widget loads on external websites via embed script
- [ ] Chat UI is functional and responsive
- [ ] Real-time messaging works between visitor and AI
- [ ] Visitor can be identified (optional)
- [ ] Widget appearance is customizable (colors, position, size)
- [ ] Embed script is generated and copyable
- [ ] Widget works on mobile devices
- [ ] Widget analytics track conversations and interactions
- [ ] Widget does not conflict with host page styles
- [ ] Widget loads in under 1 second
- [ ] Widget handles network failures gracefully
- [ ] Widget supports HTTPS

### Milestone 8: Production [NOT STARTED]

Acceptance criteria when complete:
- [ ] API builds and runs in Docker container
- [ ] Production configuration is validated
- [ ] CI/CD pipeline runs tests and deploys
- [ ] Swagger/OpenAPI documentation is accessible
- [ ] Error tracking captures all unhandled errors
- [ ] Monitoring dashboards show key metrics
- [ ] Connection pooling is configured
- [ ] Load testing passes at target capacity
- [ ] Security audit finds no critical vulnerabilities
- [ ] Custom domain and SSL are configured
- [ ] Backup strategy is implemented and tested
- [ ] Health check endpoint returns detailed status

---

## 5. Release Gates

### Gate 1: Milestone Completion
Before a milestone is marked complete:
1. All acceptance criteria for that milestone are met
2. All tests for that milestone are passing
3. No P0 or P1 bugs remain open
4. Code review completed for all changes
5. Documentation updated

### Gate 2: Integration
Before merging milestone branch into main:
1. All existing tests still pass (no regression)
2. New tests cover new functionality
3. TypeCheck passes with zero errors
4. Lint passes with zero warnings
5. Build succeeds
6. Manual smoke test of affected flows

### Gate 3: Release
Before any production deployment:
1. All milestones in scope are complete
2. E2E test suite passes on all browsers
3. Performance benchmarks meet targets
4. Security scan finds no critical/high vulnerabilities
5. Accessibility audit passes
6. Load test passes at expected capacity
7. Rollback procedure documented and tested
8. Monitoring and alerting configured

### Gate 4: Launch
Before public launch:
1. All Gate 3 criteria met
2. AI evaluation scores meet targets
3. Widget tested on 5+ real websites
4. Documentation complete for all features
5. Support runbook prepared
6. DNS and SSL configured
7. Backup and restore tested
8. Load test at 2x expected capacity

---

## 6. Definition of Done

Every feature, bug fix, or change must satisfy ALL of the following before being considered complete:

### Code Quality
- [ ] Implementation complete per specification
- [ ] TypeScript passes with zero type errors (`tsc --noEmit`)
- [ ] Lint passes with zero errors and zero warnings (`eslint .`)
- [ ] Build succeeds (`turbo build`)
- [ ] No `console.log` statements in production code
- [ ] No `TODO` comments without linked issue
- [ ] No hardcoded values that should be configurable
- [ ] Error handling implemented for all failure paths
- [ ] Loading states implemented for all async operations
- [ ] Empty states implemented for all list/data views

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests written (if API endpoint involved)
- [ ] E2E tests written (if user-facing flow)
- [ ] Test coverage meets minimum threshold
- [ ] No skipped tests without documented reason

### UI/UX
- [ ] Responsive validated at mobile, tablet, and desktop breakpoints
- [ ] Accessibility passes automated check (axe-core)
- [ ] Keyboard navigation works for all interactive elements
- [ ] Error messages are user-friendly and actionable
- [ ] Loading indicators are present and informative

### Documentation
- [ ] API documentation updated (if endpoint changed)
- [ ] Product spec updated (if behavior changed)
- [ ] Code comments added for complex logic
- [ ] README updated (if setup steps changed)

### Security
- [ ] Input validation on all user inputs
- [ ] Authentication required where appropriate
- [ ] Authorization enforced (user can only access own data)
- [ ] No secrets in code or logs
- [ ] SQL injection prevention (Prisma parameterized queries)

### Regression
- [ ] Existing functionality not broken
- [ ] All existing tests still pass
- [ ] Manual smoke test of related flows
- [ ] Cross-browser check (if UI change)

### Commit
- [ ] Meaningful commit message
- [ ] Single responsibility per commit
- [ ] No merge conflicts
- [ ] Branch is up to date with main

---

## 7. Edge Cases

### Known Edge Cases to Test

| Category | Edge Case | Expected Behavior |
|----------|-----------|-------------------|
| Auth | Login with expired refresh token | Return 401, require re-login |
| Auth | Login with revoked refresh token | Return 401, require re-login |
| Auth | Concurrent refresh token requests | Only one succeeds, others fail |
| Auth | Register with existing email | Return 409 Conflict |
| Business | Create business with duplicate slug | Auto-slugify with suffix |
| Business | Create business with very long name | Truncate slug, store full name |
| Business | Delete business with active domains | Soft delete, cascade properly |
| Domain | Verify domain that doesn't exist | Return appropriate error |
| Domain | Verify domain with multiple TXT records | Match the correct one |
| Domain | Add duplicate domain to same business | Return 409 Conflict |
| Domain | Add same domain to different businesses | Allow (different orgs) |
| Knowledge | Upload file larger than limit | Return 413 with clear message |
| Knowledge | Upload unsupported file type | Return 400 with supported types |
| Knowledge | Search with empty query | Return empty results |
| Knowledge | Search with no matching results | Return empty results with suggestion |
| AI | Conversation exceeds context limit | Truncate oldest messages, maintain summary |
| AI | User sends very long message | Handle gracefully, respond appropriately |
| Widget | Load on page with Content Security Policy | Handle CSP restrictions |
| Widget | Load on HTTP page (non-HTTPS) | Warn or degrade gracefully |
| General | Network disconnection | Show offline state, retry logic |
| General | Server returns 500 | Show user-friendly error, log details |
| General | Rapid button clicks | Debounce/throttle, prevent duplicates |
| General | Form submission with empty fields | Client-side validation prevents submission |
| General | Browser back/forward navigation | Correct state restoration |

---

## 8. Test Execution

### Commands

```bash
# Unit tests (Vitest)
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests (Playwright)
pnpm test:e2e

# All tests
pnpm test

# Coverage report
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Full validation (typecheck + lint + build + test)
pnpm validate
```

### CI Pipeline Test Steps

1. Install dependencies
2. Run type checking
3. Run linting
4. Run unit tests with coverage
5. Run integration tests
6. Run build
7. Run E2E tests (on PR to main)
8. Upload coverage report
9. Fail if any step fails

### Local Development

- Unit tests run in watch mode during development
- Integration tests run on demand
- E2E tests run before commit (pre-push hook)
- Type checking runs on save (IDE integration)

---

## 9. Bug Severity Classification

| Severity | Definition | SLA |
|----------|------------|-----|
| P0 - Critical | Data loss, security breach, complete outage | Fix immediately |
| P1 - High | Major feature broken, no workaround | Fix within 24 hours |
| P2 - Medium | Feature broken but workaround exists | Fix within 1 week |
| P3 - Low | Minor issue, cosmetic, enhancement | Fix in next milestone |

---

## 10. Test Data Management

### Test Database
- Separate PostgreSQL instance for tests
- Reset before each test suite
- Seed with minimal required data
- Never use production data

### Test Users
- `test-1@example.com` - Regular user, has businesses
- `test-2@example.com` - Regular user, no businesses
- `admin@example.com` - Admin user
- All test passwords follow pattern: `TestPass123!`

### Test Businesses
- "Test Restaurant" - With verified domain
- "Test Tech Corp" - With unverified domain
- "Test Services" - No domains

### Domain Verification Test Strategy (APPROVED D-04)
There is NO dev/test bypass of domain verification (no `DEV_BYPASS` flag, header, param, or hidden endpoint will ever exist). Automated tests verify the HTML-file flow deterministically:

1. **Unit level**: SSRF validator, token format, and challenge-comparison logic are tested directly against in-process fixtures (no network).
2. **Integration level**: a local HTTP fixture server binds to `127.0.0.1` on an ephemeral port and serves `/replyiq-verification.html (legacy; the meta tag is now the primary placement)` with a known token; the test seeds a `BusinessDomain` row whose stored `verificationToken` equals that known token, then points the verification fetch at the fixture host via injectable config (`DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE`, test-only configuration injection - never a runtime API bypass). Negative cases (wrong token, missing file) run against the same fixture.
3. **Staging/manual level**: use a real controlled staging domain (e.g., `verify-test.replyiq.dev`) with the token published as DNS TXT / static file by ops.

This keeps tokens reproducible and tests hermetic without weakening production security.

---

## 11. Monitoring Test Health

### Metrics to Track
- Test pass rate (target: > 99%)
- Test execution time (target: unit < 30s, integration < 2min, e2e < 5min)
- Flaky test count (target: 0)
- Coverage trend (should not decrease)
- Time to feedback (target: < 10min for full suite)

### Flaky Test Policy
- Any test that fails intermittently is marked as flaky
- Flaky tests are quarantined within 48 hours
- Root cause must be identified and fixed
- Tests that cannot be made reliable are converted to integration tests or removed

---

## 12. Domain Verification & Test Mode — Acceptance Matrix (2026-09-05)

> Supersedes any earlier verification rows in §3, §4 and §7 where they disagree.
> The full test plan, including the reasoning behind each case, is
> `16-DOMAIN-VERIFICATION-AND-TEST-MODE.md` §11.

### 12.1 Release gates — these block a release

These are the cases where a regression is a security incident rather than a bug.
Each must pass before shipping.

| # | Gate | How it is proven |
|---|------|------------------|
| G-1 | `DEV_BYPASS` against a `NODE_ENV=production` build is rejected **identically** to an unrecognised method value — same status, same code, same body | `config/verification-methods.test.ts` (the accepted-method set omits it, so the ValidationPipe path is literally the same code) |
| G-2 | A server with `NODE_ENV=production` **and** `ALLOW_DEV_VERIFICATION_BYPASS=true` refuses to boot | `verification-methods.test.ts` + `main.ts` boot guard |
| G-3 | `SANDBOX` against a real domain is refused in **every** environment, with any role or credential | `sandbox-domains.test.ts`, `domain.lifecycle.integration.test.ts` |
| G-4 | A domain resolving to a private, loopback, link-local or reserved address is refused **before any outbound connection**, and the reason never reaches the client | `ssrf-guard.test.ts`, `domain-verification.fetch.test.ts` |
| G-5 | Every documented error `code` resolves to reviewed human copy; no backend `message` is ever rendered | `error-copy-contract.test.ts`, `client.test.ts` |
| G-6 | Every organization-scoped endpoint returns *not found* — never *forbidden* — for another tenant's resource | `domain.lifecycle.integration.test.ts` |
| G-7 | Onboarding can be completed end to end using only a reserved test domain | `domain.lifecycle.integration.test.ts` |
| G-8 | Deleting the last verified domain without acknowledgement is refused, including under concurrency | `domain.lifecycle.integration.test.ts` |

### 12.2 Edge cases covered

**Sandbox eligibility.** Every reserved namespace accepted. Every
suffix-confusion lookalike rejected: `example.com.evil.com`, `notexample.com`,
`test.com`, `localhost.com`, `internal.com`, `example.company`, `testing.io`.
Case and trailing-dot normalisation. Operator suffix honoured; a blank, `.`,
bare-TLD or malformed suffix ignored rather than matching everything.

**Bypass gate.** Enabled only for exactly `'true'` outside production. Disabled
for `'TRUE'`, `'True'`, `'1'`, `'yes'`, `' true '`, empty, and absent. Disabled
in production regardless.

**DNS parsing.** Single record; chunked record (255-byte splits); the correct
record alongside unrelated TXT records at the same name (regression — the old
implementation failed this); a value split across separate records; quoted and
whitespace-padded values; near-misses; empty answers; legacy record name.

**Meta parsing.** Ten markup variants — double, single and unquoted values;
reversed attribute order; uppercase tags; self-closing; extra attributes;
minified with no spaces; newlines inside the tag. Plus: tag injected into the
body; a prefix-sharing name (`replyiq-verification-old`) must **not** match;
present-but-empty content is a mismatch, not an absence; duplicates take the
first; the token appearing in ordinary page text is ignored.

**Website fetch (real HTTP against a local fixture).** Meta hit; `/.well-known`
fallback; legacy file in both body formats; mismatch; nothing published; every
path 404; 500; oversized body hitting the cap; redirect followed; redirect
loop; redirect to a disallowed port, a non-HTTP scheme, and a raw IP literal —
each refused. Plus: the test fixture override is proven inert when
`NODE_ENV !== 'test'`.

**Lifecycle.** Duplicate domain across organizations → 409, non-disclosing.
Soft-delete then re-add succeeds. Concurrent deletes of the last two verified
domains cannot leave zero. Already-verified re-verification refused. Every
out-of-order onboarding step returns its own distinct code. Service mode
transitions `INACTIVE → TEST → LIVE`. `onboardingCompleted` is never reverted.

**Audit.** One attributed row per lifecycle event, in order, with actor, IP and
user agent — and the verification token never present in the metadata. A
*pending* result writes **no** row, so the log does not fill with noise from
people politely waiting for DNS.

**Copy quality.** Every entry ends its headline as a sentence, uses a defined
tone, and contains none of: `challenge record`, `enum`, `null`, `undefined`,
`DTO`, a status code, `Prisma`, or its own error code.

### 12.3 Known coverage gaps

| Gap | Plan |
|---|---|
| Per-organization rate limits have no automated test | Add a supertest case asserting the 11th add and 21st verify in a window return 429 keyed on organization, not IP |
| No browser-level E2E | Playwright, per §3; the wizard and Domains page are the first two flows to cover |
| Integration suite requires PostgreSQL and was not executed in the authoring environment | `docker compose up -d postgres && cd apps/api && pnpm test:integration` |
