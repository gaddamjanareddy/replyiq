# ReplyIQ - Product Requirements (Goal Document)

> Defines what ReplyIQ is, who it serves, what it must do, and the quality bar every
> release is measured against. This is the **goal document**: when any other
> specification disagrees with this one about *intent*, this one wins.

> **Status:** Approved
> **Last Updated:** 2026-09-05
> **Owner:** Product Owner
> **Supersedes:** the 2026-08-17 draft. Changes in this revision are recorded in
> `docs/CHANGES-2026-09-05.md`.

---

## 1. Product Vision

ReplyIQ is an AI-powered business receptionist platform that enables companies to deploy conversational AI agents across their digital channels. The platform handles lead qualification, appointment scheduling, and customer support autonomously.

ReplyIQ gives every business -- regardless of size -- a 24/7 digital employee that greets visitors, qualifies leads, answers questions from a company knowledge base, and books appointments, operating across web widgets, email, and messaging channels.

---

## 1a. Product Goals

Every goal below is falsifiable. A release either meets it or does not.

| # | Goal | How we know we hit it |
|---|------|-----------------------|
| **G1** | **A business owner can go from "never heard of us" to "AI receptionist answering on my site" without help.** | Median self-serve time from registration to first verified domain < 10 minutes, with zero support contacts. |
| **G2** | **Nobody is ever blocked by something they cannot control.** Every wall in the product has a door: a DNS record that has not propagated, a site you cannot edit, a domain you do not own yet — none of these strand a user. | Every terminal-looking state in the funnel has a documented alternative path, verified by the flow inventory in `17-END-TO-END-FLOW.md`. |
| **G3** | **The product can be exercised end-to-end, by anyone, without owning a domain — and without weakening the real thing by one line.** | Test Mode (§8 FR-TEST) is usable in production; the live verification path has zero conditional branches that a request can influence. |
| **G4** | **A user never reads a machine's words.** Every message a person sees was written for a person. | Error-copy contract test passes: every backend `code` maps to reviewed human copy; no raw backend `message` is ever rendered. |
| **G5** | **Tenant isolation is a proven property, not a habit.** | Every organization-scoped endpoint has an automated cross-tenant test; guards enforce at the perimeter, services enforce again in depth. |
| **G6** | **Destructive actions are always deliberate, never surprising, and never permanent by accident.** | Every destructive action requires typed or explicit confirmation, is soft-deleted, and is audited. |
| **G7** | **The system tells the truth about its own state.** A business that cannot serve traffic says so, loudly, where the owner will see it. | Dashboard surfaces `INACTIVE` / `TEST` service states within one page load of the condition arising. |

### Anti-goals

These are things we deliberately will **not** do, listed here because each is a tempting shortcut:

- **We will not add a "skip verification" button.** Test Mode is a real, bounded capability with its own rules — not an escape hatch bolted onto the live path.
- **We will not let a convenience flag exist in production.** Any developer-only affordance fails closed and refuses to boot if it is misconfigured for production.
- **We will not show a user a stack trace, an enum name, a status code, or the word "challenge".**
- **We will not treat "the docs say so" as evidence.** Status labels in this document are backed by code or they are wrong.

---

## 1b. Design Principles

The rules the product is built to. These resolve arguments that requirements alone cannot.

1. **Two doors, always.** Every gate offers at least two ways through it, aimed at different people. Domain verification offers DNS (for whoever controls the domain) and a homepage snippet (for whoever controls the site) — plus Test Mode (for whoever controls neither, yet).
2. **Fail closed, explain openly.** Security decisions default to "no". User-facing explanations default to "here's exactly what to do next".
3. **The token never changes.** A user who walks away mid-setup and comes back three days later sees the identical instructions. Nothing about setup is a moving target.
4. **State lives on the server.** Refresh, new device, new session — the wizard resumes exactly where the server says it is. There is no losable local progress.
5. **Distinguish "not yet" from "wrong".** "We haven't found it yet" and "we found something that doesn't match" are different problems with different fixes, and are never collapsed into one message.
6. **Sandbox is visible, never silent.** Anything verified in Test Mode is labelled as such in every surface where it appears — UI, API, logs, analytics. Test data is never mistakable for real data.
7. **Confirm the irreversible, audit the sensitive.** Deleting a verified domain and using a developer bypass are both events someone will need to explain later. Both are recorded.

---

## 2. Problem Being Solved

Small and midsize businesses (SMBs) lose revenue and waste staff time because they cannot respond to website visitors and inbound inquiries around the clock. The core problems:

| Problem | Impact |
|---------|--------|
| **Missed after-hours inquiries** | Leads go cold; visitors leave without engaging |
| **Slow first-response times** | Prospects choose competitors who respond faster |
| **Repetitive qualification questions** | Staff spend hours daily asking the same intake questions |
| **No-shows on appointments** | Manual scheduling is error-prone and lacks follow-up |
| **Knowledge inconsistency** | Different staff give different answers to the same questions |
| **Hiring cost** | A full-time receptionist costs $35K-$50K/year; a fractional answering service costs $300-$1,000/month with limited capability |

The result: lost leads, wasted payroll, and a poor customer experience that SMBs cannot afford but also cannot ignore.

---

## 3. Target Businesses

### Primary Segments

| Segment | Description | Pain Point |
|---------|-------------|------------|
| **Service businesses** | HVAC, plumbing, legal, medical, real estate, home services | After-hours calls go to voicemail; staff overwhelmed during peak hours |
| **B2B companies** | SaaS, professional services, consultants | Website visitors bounce without scheduling a demo or call |
| **Agencies and consultancies** | Marketing, design, development agencies | Prospects need qualification before a sales call is worth scheduling |
| **Multi-location businesses** | Franchises, regional chains | Need consistent reception across all locations |

### Secondary Segments

| Segment | Description |
|---------|-------------|
| **E-commerce** | Post-purchase support, product questions, returns guidance |
| **Healthcare** | Appointment scheduling, insurance questions, intake |
| **Education** | Enrollment inquiries, course information, scheduling |

### Business Characteristics

- 1-200 employees
- At least one active website or digital channel
- Currently handling (or dropping) inbound customer inquiries
- Budget of $50-$500/month for a receptionist/qualification tool
- No dedicated AI/ML team (need turnkey solution)

---

## 4. Target Users / Personas

### Persona 1: Business Owner

| Attribute | Detail |
|-----------|--------|
| **Role** | Owner, founder, or general manager |
| **Goal** | Stop losing leads; get more appointments booked without hiring |
| **Technical skill** | Low to medium; comfortable with web apps, not CLI |
| **Key decision** | "Does this replace or reduce my receptionist cost?" |
| **Success metric** | More qualified leads per week, fewer missed inquiries |

**Needs:**
- Quick setup (minutes, not days)
- Visible proof the AI is handling conversations
- Control over what the AI says and does
- Simple pricing with no surprises

### Persona 2: Team Manager

| Attribute | Detail |
|-----------|--------|
| **Role** | Office manager, marketing manager, operations lead |
| **Goal** | Configure and monitor the AI agent; manage team access |
| **Technical skill** | Medium; comfortable with SaaS admin panels |
| **Key decision** | "Can I customize the knowledge base and see what's working?" |
| **Success metric** | AI handles >70% of inquiries without human handoff |

**Needs:**
- Knowledge base management (upload docs, edit FAQs)
- Conversation review and analytics
- Team member invitations and role management
- Ability to intervene and take over live conversations

### Persona 3: AI Configuration Agent

| Attribute | Detail |
|-----------|--------|
| **Role** | Technical implementer (developer, IT admin, consultant) who sets up the platform for a business |
| **Goal** | Configure the AI receptionist correctly; integrate it into the client's existing workflow |
| **Technical skill** | High; comfortable with APIs, embed scripts, DNS configuration |
| **Key decision** | "Can I automate setup and integrate this with our CRM?" |
| **Success metric** | Widget deployed, knowledge base populated, conversations flowing within one session |

**Needs:**
- API access and documentation
- Embed script generation
- Domain verification with clear instructions
- Webhook or integration options for CRM handoff

---

## 5. Core Value Proposition

**For SMBs:** Replace missed calls and slow responses with an AI employee that works 24/7, qualifies every lead, and books appointments directly into your calendar -- for a fraction of the cost of a human receptionist.

**Measurable value:**
- 24/7 instant response to every visitor (vs. 8-12 hour average for SMBs)
- Zero missed leads during off-hours
- 100% consistent brand voice and knowledge delivery
- Setup in under 30 minutes (vs. weeks to hire/train a receptionist)

---

## 6. Product Capabilities (High-Level)

| Capability | Description | Status |
|------------|-------------|--------|
| **Workspace Management** | Multi-tenant organization with user roles and team management | [PARTIALLY IMPLEMENTED] |
| **Business Onboarding** | Guided wizard: profile, domain verification, completion | [IMPLEMENTED] |
| **Domain Ownership & Test Mode** | DNS, website-snippet and reserved-test-domain verification, with per-org rate limits, SSRF hardening and audit logging | [IMPLEMENTED] |
| **Knowledge Engine** | Ingest documents, URLs, and FAQs into a searchable knowledge base | [PLANNED] |
| **AI Receptionist** | Conversational AI that greets visitors, answers questions, qualifies leads | [PLANNED] |
| **Appointment Scheduling** | AI books appointments into integrated calendars | [PLANNED] |
| **Lead Capture** | Extracts contact information and qualification data from conversations | [PLANNED] |
| **Human Handoff** | Transfers live conversations to human agents when needed | [PLANNED] |
| **Embeddable Widget** | Drop-in chat widget for any website | [PLANNED] |
| **Analytics Dashboard** | Conversation volume, lead quality, response times, AI performance | [PLANNED] |
| **Multi-Channel Support** | Web widget, email, and messaging platform integration | [PROPOSED] |

---

## 7. Feature Requirements (Organized by Milestone)

### Milestone 1: Infrastructure [IMPLEMENTED]

| Feature | Requirement | Status |
|---------|-------------|--------|
| Turborepo monorepo | pnpm workspaces with shared config package | [IMPLEMENTED] |
| API framework | NestJS 11 + Fastify 5 with global pipes, guards, filters | [IMPLEMENTED] |
| ORM + database | Prisma 6.6 + PostgreSQL 17 with Docker Compose | [IMPLEMENTED] |
| Environment validation | Zod-based env config with fail-fast on startup | [IMPLEMENTED] |
| Structured logging | Pino via nestjs-pino with pino-pretty in development | [IMPLEMENTED] |
| Security middleware | Helmet, CORS, compression, rate limiting scaffold | [IMPLEMENTED] |
| Shared config package | ESLint, Prettier, Tailwind, TSConfig presets | [IMPLEMENTED] |

### Milestone 2: Database [IMPLEMENTED]

| Feature | Requirement | Status |
|---------|-------------|--------|
| Organization model | Multi-tenant root; status lifecycle (ACTIVE, SUSPENDED, ARCHIVED) | [IMPLEMENTED] |
| User model | Roles (OWNER, ADMIN, MANAGER — schema truth; see FR-TAM-07); status lifecycle; soft delete | [IMPLEMENTED] |
| Business model | Linked to Organization; onboarding status tracking | [IMPLEMENTED] |
| BusinessDomain model | Domain ownership with verification tokens and methods | [IMPLEMENTED] |
| Session model | Refresh token hash, expiry, revocation, device metadata | [IMPLEMENTED] |
| OnboardingProgress model | Step-by-step completion tracking per business | [IMPLEMENTED] |
| Seed script | Dev data with test organization, user, business, domain | [IMPLEMENTED] |
| Migrations | 3 applied migrations covering all models | [IMPLEMENTED] |

### Milestone 3: Authentication [IMPLEMENTED]

| Feature | Requirement | Status |
|---------|-------------|--------|
| Workspace registration | Atomic creation of Org + Business + User + Session | [IMPLEMENTED] |
| Login | Email/password with generic error messages | [IMPLEMENTED] |
| Token pair | Access (15m) + Refresh (30d) dual-JWT system | [IMPLEMENTED] |
| Refresh rotation | New hash stored on every refresh; old token invalidated | [IMPLEMENTED] |
| Logout | Session revocation via JWT session ID | [IMPLEMENTED] |
| /me endpoint | Fresh user data from DB (not JWT payload) | [IMPLEMENTED] |
| Password hashing | argon2 for passwords and refresh tokens | [IMPLEMENTED] |
| Rate limiting | Login rate limiting | [IMPLEMENTED] |
| Password change | Endpoint requiring current password | [PLANNED] |
| Password reset | Email-based reset flow | [PLANNED] |
| Email verification | Token-based email confirmation | [PLANNED] |

### Milestone 4: Business Onboarding [PARTIALLY IMPLEMENTED]

| Feature | Requirement | Status |
|---------|-------------|--------|
| Business profile CRUD | Get/update business name, industry, description, website URL | [IMPLEMENTED] |
| Domain management | Add, list, and remove domains per business | [IMPLEMENTED] |
| Domain verification (DNS TXT) | Server-side TXT lookup at `_replyiq-verification.{domain}`, legacy `_replyiq-challenge.{domain}` accepted | [IMPLEMENTED] |
| Domain verification (website) | Homepage `<meta name="replyiq-verification">`, with `/.well-known/replyiq-verification.txt` and `/replyiq-verification.html` as equivalent alternatives | [IMPLEMENTED] |
| Test Mode verification (SANDBOX) | Instant verification for IANA-reserved test domains only; available in production; grants no authority over any real name | [IMPLEMENTED] |
| Developer bypass (DEV_BYPASS) | Fail-closed, boot-resolved, audited, non-production-only; refuses to boot if enabled with `NODE_ENV=production` | [IMPLEMENTED] |
| SSRF hardening | Hostname validation, DNS resolution with reserved-range rejection, IP pinning, per-hop redirect revalidation, body cap | [IMPLEMENTED] |
| Per-organization rate limiting | Domain add and verify throttled per organization, not per IP alone | [IMPLEMENTED] |
| Audit logging | Append-only log of domain and onboarding lifecycle events | [IMPLEMENTED] |
| Stable error codes + copy layer | Every error carries a machine-readable `code`; the UI renders reviewed human copy and never a backend string | [IMPLEMENTED] |
| Verification instructions | API returns copy-paste instructions per method, identical on every retry | [IMPLEMENTED] |
| Onboarding progress tracking | Per-step boolean tracking with timestamps; server-owned, resume-safe | [IMPLEMENTED] |
| Onboarding wizard UI | 4-step wizard: profile, domain, verification, complete — with back-navigation into completed steps | [IMPLEMENTED] |
| Dashboard page | Onboarding checklist, service-mode banner, quick links | [IMPLEMENTED] |
| Business settings page | Form for editing business profile | [IMPLEMENTED] |
| Domains page | Domain list with live/test badges, verification panel, typed delete confirmation | [IMPLEMENTED] |
| Mobile-responsive sidebar | Auto-close on navigation; responsive layout at the 1024px breakpoint | [IMPLEMENTED] |
| Unit + integration tests | Verification matrix, SSRF guard, sandbox eligibility, guards, error contract, tenant isolation | [IMPLEMENTED] |
| Team member invitations | Send invitation by email with role assignment | [PLANNED] |
| Invitation accept/decline | Token-based invitation flow | [PLANNED] |
| Team page | UI for listing and managing team members | [PLANNED] |
| Business logo upload | Image upload and storage for business logo | [PLANNED] |
| httpOnly cookie session transport | Move tokens off localStorage (NFR-SEC-09) | [PLANNED] |

### Milestone 5: Knowledge Engine [PLANNED]

| Feature | Requirement |
|---------|-------------|
| Document upload | Accept PDF, DOCX, TXT, MD files; parse and extract text |
| URL scraping | Fetch and parse content from provided URLs |
| FAQ management | Create, edit, delete structured Q&A pairs |
| Knowledge chunking | Split content into optimal chunks for embedding |
| Vector embedding | Generate embeddings using an embedding model |
| Vector storage | Store and index embeddings for similarity search |
| Knowledge search API | Semantic search across the knowledge base |
| Knowledge management UI | Dashboard for managing all knowledge sources |

### Milestone 6: AI Receptionist [PLANNED]

| Feature | Requirement |
|---------|-------------|
| LLM integration | Connect to a large language model for response generation |
| System prompt configuration | Business-specific prompt templates |
| Conversation engine | Turn-by-turn conversation management with context |
| Context management | Maintain conversation history within a session |
| Lead qualification | Extract and score leads from conversation data |
| Appointment scheduling | Check availability and book appointments |
| Human handoff | Transfer conversation to a live agent when triggered |
| Conversation history | Store and display full conversation logs |
| AI response quality monitoring | Track accuracy, helpfulness, and escalation rates |
| Multi-channel support | Operate across web, email, and messaging platforms |

### Milestone 7: Widget [PLANNED]

| Feature | Requirement |
|---------|-------------|
| Chat UI | Clean, responsive chat interface |
| Real-time messaging | WebSocket-based message delivery |
| Visitor identification | Capture visitor email/name during conversation |
| Widget customization | Configurable colors, position, greeting text |
| Embed script | One-line JavaScript snippet for any website |
| Mobile responsive | Full functionality on mobile devices |
| Widget analytics | Usage stats per domain and time period |

### Milestone 8: Production [PLANNED]

| Feature | Requirement |
|---------|-------------|
| API Dockerfile | Multi-stage Docker build for production |
| CI/CD pipeline | GitHub Actions for build, test, deploy |
| API documentation | Swagger/OpenAPI auto-generated docs |
| Error tracking | Sentry or equivalent integration |
| Monitoring | Health checks, metrics, alerting |
| Database pooling | Connection pool management |
| Load testing | Performance benchmarks under expected load |
| Security audit | Penetration testing and vulnerability assessment |
| Backup strategy | Automated database backups with recovery plan |

---

## 8. Functional Requirements

### Authentication and Account Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-AUTH-01 | Users can register a workspace (Org + Business + User) in a single action | P0 | [IMPLEMENTED] |
| FR-AUTH-02 | Users can log in with email and password | P0 | [IMPLEMENTED] |
| FR-AUTH-03 | Access tokens expire after 15 minutes; refresh tokens expire after 30 days | P0 | [IMPLEMENTED] |
| FR-AUTH-04 | Refresh token rotation invalidates the previous token on every refresh | P0 | [IMPLEMENTED] |
| FR-AUTH-05 | Logout revokes the current session server-side | P0 | [IMPLEMENTED] |
| FR-AUTH-06 | /me returns fresh user data from the database | P0 | [IMPLEMENTED] |
| FR-AUTH-07 | Duplicate email registration returns 409 Conflict | P0 | [IMPLEMENTED] |
| FR-AUTH-08 | Passwords must be 12+ characters with uppercase, lowercase, number, and special character | P0 | [IMPLEMENTED] |
| FR-AUTH-09 | Auth error messages do not reveal whether email or password was wrong | P0 | [IMPLEMENTED] |
| FR-AUTH-10 | Users can change their password (requires current password) | P1 | [PLANNED] |
| FR-AUTH-11 | Users can request a password reset via email | P1 | [PLANNED] |
| FR-AUTH-12 | Users must verify their email address before accessing the dashboard | P2 | [PLANNED] |

### Business Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-BIZ-01 | Users can view and edit their business profile (name, industry, description, website URL) | P0 | [IMPLEMENTED] |
| FR-BIZ-02 | Business starts in DRAFT status after registration | P0 | [IMPLEMENTED] |
| FR-BIZ-03 | Business transitions to ACTIVE when onboarding completes — APPROVED (D-05): activation happens atomically inside the same transaction that completes onboarding | P0 | [IMPLEMENTED] |
| FR-BIZ-04 | Business supports soft delete (deletedAt timestamp) | P1 | [IMPLEMENTED] |
| FR-BIZ-05 | Users can upload and change a business logo | P2 | [PLANNED] |
| FR-BIZ-06 | `Business.status` (DRAFT/ACTIVE/SUSPENDED/ARCHIVED) and `Business.onboardingStatus` (NOT_STARTED/IN_PROGRESS/DOMAIN_PENDING/COMPLETED) are independent fields. `status` reaches ACTIVE only when `onboardingStatus` reaches COMPLETED. No API response may show `status: ACTIVE` with `onboardingStatus != COMPLETED` | P0 | [IMPLEMENTED] |
| FR-BIZ-07 | Every business exposes a derived **service mode** — `LIVE` (has ≥1 active verified real domain), `TEST` (has active verified domains, all of them sandbox), or `INACTIVE` (no active verified domain). Service mode is computed from current domain state, never stored, and can therefore never drift | P0 | [IMPLEMENTED] |
| FR-BIZ-08 | Completing onboarding is a permanent historical milestone. Losing every verified domain afterwards moves service mode to `INACTIVE` but never reverts `onboardingCompleted` | P0 | [IMPLEMENTED] |

### Domain Verification

> The full mechanism specification — record formats, fetch rules, outcome
> matrix, sandbox eligibility, and the security argument for each — lives in
> **`16-DOMAIN-VERIFICATION-AND-TEST-MODE.md`**. This table states *what must be
> true*; that document states *how*.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-DOM-01 | Users can add one or more domains to their business. Domain names are globally unique across all businesses and organizations, enforced by a partial unique index over active (non-soft-deleted) rows; duplicates return 409 with a message that never reveals who holds the claim | P0 | [IMPLEMENTED] |
| FR-DOM-02 | Each domain gets a cryptographically random verification token (`replyiq-verify-{UUIDv4}`, CSPRNG) generated once at creation. The token is never derived from any other identifier and never changes — not across retries, not across method switches, not across days | P0 | [IMPLEMENTED] |
| FR-DOM-03 | **DNS method.** Users can verify by publishing a TXT record at `_replyiq-verification.{domain}` whose value equals the token. The legacy name `_replyiq-challenge.{domain}` is still accepted for backward compatibility but is never shown in instructions | P0 | [IMPLEMENTED] |
| FR-DOM-04 | **Website method.** Users can verify by adding `<meta name="replyiq-verification" content="{token}">` to their homepage `<head>`. As equivalent alternatives under the same method, a file at `/.well-known/replyiq-verification.txt` or `/replyiq-verification.html` containing the token is also accepted, so users on any kind of hosting have a route through | P0 | [IMPLEMENTED] |
| FR-DOM-05 | Verification instructions are retrievable per method, include copy buttons on every copyable value, and are byte-identical on every retry | P0 | [IMPLEMENTED] |
| FR-DOM-06 | Verification is synchronous and user-invoked. There is no background polling job. An unreachable record returns a *pending* outcome that is immediately retryable | P0 | [IMPLEMENTED] |
| FR-DOM-07 | The outbound website fetch is bounded: 8-second total budget, ≤3 redirect hops each re-validated, ≤512 KB response body, HTTPS attempted before HTTP | P0 | [IMPLEMENTED] |
| FR-DOM-08 | At least one verified domain (live **or** sandbox) is required to complete onboarding | P0 | [IMPLEMENTED] |
| FR-DOM-09 | Users can remove a domain. Removal is a soft delete (`deletedAt`), and the freed name becomes re-registrable | P0 | [IMPLEMENTED] |
| FR-DOM-10 | **Verification outcomes are distinguishable.** "Not found yet" (pending, normal during propagation), "found but does not match" (mismatch, almost always a copy-paste error), and "already verified" are three separate outcomes with three separate messages and three separate stable error codes | P0 | [IMPLEMENTED] |
| FR-DOM-11 | Deleting a domain always requires explicit confirmation in the UI. Deleting the **last verified domain** additionally requires an explicit acknowledgement parameter on the API call itself, so no accidental or scripted request can silently take a business offline | P0 | [IMPLEMENTED] |
| FR-DOM-12 | The outbound website fetch is SSRF-hardened: hostnames are validated, DNS is resolved and every returned address checked against private/loopback/link-local/reserved ranges, the connection is pinned to a validated address (closing DNS-rebinding), redirects are followed manually with per-hop revalidation, and no network-level failure detail is ever reflected to the client | P0 | [IMPLEMENTED] |
| FR-DOM-13 | Adding and verifying domains are rate-limited **per organization** (not per IP alone), so one tenant cannot use the platform as an outbound request amplifier | P0 | [IMPLEMENTED] |
| FR-DOM-14 | Editing a domain string is not supported by design. The path is delete-and-re-add, which forces re-verification of the new name | P1 | [IMPLEMENTED] |
| FR-DOM-15 | Domain verification events (created, verified, failed, deleted, bypass used) are written to an append-only audit log with actor, target, method, and timestamp. Audit failures never fail the user's request | P0 | [IMPLEMENTED] |
| FR-DOM-16 | The domain step pre-fills from the hostname of the business `websiteUrl` when one was entered. The two fields are independent afterwards; editing one never rewrites the other | P1 | [IMPLEMENTED] |

### Test Mode and Verifiability

> This is Goal **G3** expressed as requirements. It exists because a product that
> cannot be exercised cannot be trusted — and because the alternative (an
> improvised bypass added later under deadline pressure) is the exact security
> failure we are pre-empting.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-TEST-01 | **Test Mode exists in every environment, production included.** A user who does not own a domain can still complete the entire onboarding funnel, see every screen, and reach a working end state | P0 | [IMPLEMENTED] |
| FR-TEST-02 | Test Mode is entered by adding a **reserved test domain** — a name from an IANA-reserved space that no person or company can ever own (`*.test`, `*.example`, `*.invalid`, `*.localhost`, `example.com/.net/.org`, `*.local`, `*.internal`) or the deployment's configured sandbox suffix. Such a domain verifies instantly via the `SANDBOX` method with no network check | P0 | [IMPLEMENTED] |
| FR-TEST-03 | **Test Mode grants no authority over anything real.** The `SANDBOX` method is rejected for any domain that is not reserved-test-eligible. It is structurally impossible to sandbox-verify a real domain, in any environment, with any credentials | P0 | [IMPLEMENTED] |
| FR-TEST-04 | Conversely, a reserved test domain cannot be verified through the live DNS or website methods. Each domain has exactly one legitimate route, decided by the name itself at creation time and immutable thereafter | P0 | [IMPLEMENTED] |
| FR-TEST-05 | Sandbox-verified domains are labelled `SANDBOX` in the API, badged "Test" in every UI surface, and roll up to a business service mode of `TEST`. A test business is never mistakable for a live one | P0 | [IMPLEMENTED] |
| FR-TEST-06 | A business in `TEST` mode sees a persistent, dismissible-only-by-fixing banner explaining that it is in test mode and what to do to go live | P0 | [IMPLEMENTED] |
| FR-TEST-07 | The live verification path (`DNS_TXT`, `HTML_META`) contains **no branch, flag, header, body field, query parameter, or JWT claim** that can cause it to return a positive result without a real network check. Test Mode is a separate method with its own eligibility rule, not a mode of the live methods | P0 | [IMPLEMENTED] |
| FR-TEST-08 | **`DEV_BYPASS`** — an unconditional verification shortcut for CI and local development — exists only when `NODE_ENV != production` **and** `ALLOW_DEV_VERIFICATION_BYPASS = true`, resolved once at process boot from environment variables alone | P0 | [IMPLEMENTED] |
| FR-TEST-09 | When the bypass is unavailable, `DEV_BYPASS` is rejected **by the same validation code path as any unrecognised method value**, producing a byte-identical response. Probing for the bypass is indistinguishable from a typo | P0 | [IMPLEMENTED] |
| FR-TEST-10 | A server configured with `NODE_ENV=production` **and** `ALLOW_DEV_VERIFICATION_BYPASS=true` refuses to start, with a fatal, explicit error. The misconfiguration cannot be deployed silently | P0 | [IMPLEMENTED] |
| FR-TEST-11 | `DEV_BYPASS` skips the network check only. Authentication, organization ownership, role, and rate-limit checks all apply unchanged | P0 | [IMPLEMENTED] |
| FR-TEST-12 | Every `DEV_BYPASS` use writes an audit record. This is the one audit event that shipped before general audit logging did | P0 | [IMPLEMENTED] |
| FR-TEST-13 | Integration tests can exercise the real HTML fetch path against a local fixture server via `DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE`, gated on `NODE_ENV=test`. This exercises the genuine parser and SSRF guard rather than mocking them away | P0 | [IMPLEMENTED] |

### Onboarding

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-ONB-01 | A multi-step wizard guides users through business setup | P0 | [IMPLEMENTED] |
| FR-ONB-02 | Onboarding progress is persisted across sessions | P0 | [IMPLEMENTED] |
| FR-ONB-03 | Dashboard shows onboarding checklist with completion status | P0 | [IMPLEMENTED] |
| FR-ONB-04 | Users can access onboarding from the dashboard at any time | P0 | [IMPLEMENTED] |
| FR-ONB-05 | Onboarding steps: (1) Profile, (2) Domain, (3) Verification, (4) Complete | P0 | [IMPLEMENTED] |
| FR-ONB-06 | Team invitation step is optional and does not block onboarding completion | P1 | [PLANNED] |

### Team Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-TAM-01 | Business owners can invite users by email with a role (ADMIN or MANAGER) | P1 | [PLANNED] |
| FR-TAM-02 | Invited users receive an invitation with an accept/decline option | P1 | [PLANNED] |
| FR-TAM-03 | Invitations expire after 7 days | P1 | [PLANNED] |
| FR-TAM-04 | Users can cancel pending invitations | P1 | [PLANNED] |
| FR-TAM-05 | Admins can change user roles | P1 | [PLANNED] |
| FR-TAM-06 | Admins can remove users from the business | P1 | [PLANNED] |
| FR-TAM-07 | Role-based access using the three roles that exist in the schema — OWNER, ADMIN, MANAGER. `RolesGuard` is wired and enforcing today: OWNER and ADMIN may mutate business profile, domains and onboarding; MANAGER has read access to those surfaces. The four-role `OWNER/ADMIN/MEMBER/VIEWER` taxonomy proposed in earlier review drafts is **rejected** — it names roles the data model does not have. Any expansion is a schema migration, not a documentation edit | P1 | [PARTIALLY IMPLEMENTED] |
| FR-TAM-08 | The permissions matrix in `12-SECURITY-MULTI-TENANCY.md` §10 is expressed in the three real roles and is the single source of truth for who may do what | P1 | [IMPLEMENTED] |

### Knowledge Engine

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-KNOW-01 | Users can upload documents (PDF, DOCX, TXT, MD) for knowledge ingestion | P0 | [PLANNED] |
| FR-KNOW-02 | Users can add URLs for automatic content scraping | P0 | [PLANNED] |
| FR-KNOW-03 | Users can create and manage FAQ entries (question + answer pairs) | P0 | [PLANNED] |
| FR-KNOW-04 | System chunks ingested content into optimal segments for retrieval | P0 | [PLANNED] |
| FR-KNOW-05 | System generates vector embeddings for all knowledge chunks | P0 | [PLANNED] |
| FR-KNOW-06 | System performs semantic search across the knowledge base | P0 | [PLANNED] |
| FR-KNOW-07 | Users can view, edit, and delete knowledge sources | P1 | [PLANNED] |
| FR-KNOW-08 | Knowledge base is scoped per business (not shared across tenants) | P0 | [PLANNED] |

### AI Receptionist

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-AI-01 | AI agent greets visitors with a configurable greeting message | P0 | [PLANNED] |
| FR-AI-02 | AI agent answers questions using the business knowledge base | P0 | [PLANNED] |
| FR-AI-03 | AI agent qualifies leads by collecting contact info and needs | P0 | [PLANNED] |
| FR-AI-04 | AI agent can book appointments (check availability and confirm) | P0 | [PLANNED] |
| FR-AI-05 | AI agent hands off to a human agent when requested or when confidence is low | P0 | [PLANNED] |
| FR-AI-06 | Each business can customize the system prompt for their AI agent | P1 | [PLANNED] |
| FR-AI-07 | Conversation context is maintained within a single session | P0 | [PLANNED] |
| FR-AI-08 | AI responses cite sources from the knowledge base when available | P1 | [PLANNED] |
| FR-AI-09 | AI agent operates 24/7 without degradation | P0 | [PLANNED] |
| FR-AI-10 | Conversation history is stored and reviewable by business users | P1 | [PLANNED] |

### Widget

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-WDG-01 | Embeddable chat widget via a single JavaScript snippet | P0 | [PLANNED] |
| FR-WDG-02 | Widget renders a chat interface on the business website | P0 | [PLANNED] |
| FR-WDG-03 | Widget communicates with the AI backend in real-time | P0 | [PLANNED] |
| FR-WDG-04 | Widget is customizable (colors, position, greeting) | P1 | [PLANNED] |
| FR-WDG-05 | Widget is mobile-responsive | P0 | [PLANNED] |
| FR-WDG-06 | Widget only loads on verified domains | P0 | [PLANNED] |
| FR-WDG-07 | Widget collects visitor identification (name, email) | P1 | [PLANNED] |

### Analytics and Monitoring

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-ANL-01 | Dashboard displays conversation volume (daily, weekly, monthly) | P1 | [PLANNED] |
| FR-ANL-02 | Dashboard displays lead capture metrics | P1 | [PLANNED] |
| FR-ANL-03 | Dashboard displays AI response accuracy and escalation rate | P2 | [PLANNED] |
| FR-ANL-04 | Dashboard displays appointment booking metrics | P1 | [PLANNED] |
| FR-ANL-05 | System logs all user actions for audit purposes | P2 | [PLANNED] |

---

## 9. Non-Functional Requirements

### Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-01 | API response time (p95) for standard CRUD operations | < 200ms |
| NFR-PERF-02 | AI first-response time for visitor conversations | < 3 seconds |
| NFR-PERF-03 | Widget initial load time | < 2 seconds |
| NFR-PERF-04 | Knowledge base search response time | < 500ms |
| NFR-PERF-05 | Domain verification completion time (DNS) | < 60 seconds |
| NFR-PERF-06 | Domain verification completion time (HTML meta) | < 10 seconds |

### Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SEC-01 | All API endpoints require JWT authentication (except public routes) | Enforced |
| NFR-SEC-02 | Passwords hashed with argon2 (memory-hard algorithm) | Enforced |
| NFR-SEC-03 | Refresh token rotation on every token refresh | Enforced |
| NFR-SEC-04 | CORS restricted to configured origins | Enforced |
| NFR-SEC-05 | Security headers via Helmet (CSP, HSTS, X-Frame-Options) | Enforced |
| NFR-SEC-06 | Rate limiting on authentication endpoints | Enforced |
| NFR-SEC-07 | All mutations scoped to the authenticated user's organization, at the guard perimeter **and** again in the service layer | Enforced |
| NFR-SEC-08 | Generic error messages on auth failures (no information leakage) | Enforced |
| NFR-SEC-09 | Tokens moved from localStorage to httpOnly cookies before production | [PLANNED] |
| NFR-SEC-10 | Account lockout after N consecutive failed login attempts | [PLANNED] |
| NFR-SEC-11 | Session IP and user-agent binding | [PLANNED] |
| NFR-SEC-12 | Audit logging for all state-changing operations | [PARTIALLY IMPLEMENTED] — domain and onboarding lifecycle covered |
| NFR-SEC-13 | Security audit and penetration testing before production launch | [PLANNED] |
| NFR-SEC-14 | Server-initiated outbound fetches to user-supplied hosts are SSRF-hardened and never reflect network failure detail to the caller | Enforced |
| NFR-SEC-15 | Non-production-only capabilities fail closed, are resolved once at boot from environment variables, and cannot be influenced by any request input | Enforced |
| NFR-SEC-16 | A production-configured server refuses to boot if any non-production-only capability is enabled | Enforced |
| NFR-SEC-17 | Abuse-sensitive endpoints are rate-limited per organization, not per IP alone, so tenancy is the abuse boundary | Enforced |
| NFR-SEC-18 | Resources belonging to another organization return the same response as resources that do not exist | Enforced |

### Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SCAL-01 | Support 100 concurrent businesses at launch | Design for |
| NFR-SCAL-02 | Support 1,000 concurrent businesses within 6 months of launch | Design for |
| NFR-SCAL-03 | Support 10,000 simultaneous widget conversations | Design for |
| NFR-SCAL-04 | Database connection pooling for production workloads | [PLANNED] |
| NFR-SCAL-05 | Horizontal scaling of API servers behind a load balancer | [PLANNED] |

### Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-REL-01 | API uptime | 99.9% (8.76 hours downtime/year) |
| NFR-REL-02 | Automated database backups | Daily |
| NFR-REL-03 | Point-in-time recovery capability | Within 24 hours |
| NFR-REL-04 | Health check endpoint for load balancer integration | [IMPLEMENTED] |
| NFR-REL-05 | Graceful error handling; no unhandled exceptions return 500 stack traces | [IMPLEMENTED] |

### Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-USE-01 | New user can complete onboarding in under 30 minutes | Design for |
| NFR-USE-02 | Widget setup requires only a single line of JavaScript | Design for |
| NFR-USE-03 | Dashboard is responsive and usable on mobile (<768px), tablet (768–1023px) and desktop (≥1024px) | Design for |
| NFR-USE-04 | All form inputs have client-side validation with clear, specific error messages | Enforced |
| NFR-USE-05 | No user-facing string is produced by the backend. Every message a person reads is selected client-side from a reviewed copy table keyed by a stable error `code` | Enforced |
| NFR-USE-06 | Every copyable value (DNS record name, record value, snippet) has a one-click copy control with visible confirmation | Enforced |
| NFR-USE-07 | Interactive controls are keyboard-reachable, have visible focus, and carry accessible names; status changes are announced to assistive technology | Enforced |
| NFR-USE-08 | A user can reach a working end state without owning a domain (Goal G3 / FR-TEST-01) | Enforced |

### Maintainability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-MAINT-01 | Monorepo with shared config for consistent code style across packages | [IMPLEMENTED] |
| NFR-MAINT-02 | Modular NestJS architecture (each feature is an independent module) | [IMPLEMENTED] |
| NFR-MAINT-03 | TypeScript strict mode across all packages | [IMPLEMENTED] |
| NFR-MAINT-04 | Test coverage above 80% for business logic before production | [PLANNED] |
| NFR-MAINT-05 | API documentation auto-generated from code (Swagger/OpenAPI) | [PLANNED] |

---

## 10. Product Boundaries

### What ReplyIQ Is

- A SaaS platform for deploying AI-powered receptionists for businesses
- A knowledge base management system feeding an AI agent
- An embeddable chat widget for websites
- A lead qualification and appointment scheduling tool
- A multi-tenant platform with organization-level isolation

### What ReplyIQ Is Not

- A general-purpose chatbot builder (it is purpose-built for business reception)
- A CRM (it captures leads but does not manage the full sales pipeline)
- A website builder or hosting platform
- A phone/voice AI system (web and text channels only in v1)
- A customer support ticketing system (conversations are real-time, not ticketed)

### System Boundaries

```
ReplyIQ Platform
┌──────────────────────────────────────────────────────────┐
│  Dashboard App (React SPA)                                │
│  - Business setup and configuration                       │
│  - Knowledge base management                              │
│  - Conversation review and analytics                      │
│  - Team management                                        │
└──────────────────────────┬───────────────────────────────┘
                           │ REST API
                           ▼
┌──────────────────────────────────────────────────────────┐
│  API Server (NestJS + Fastify)                            │
│  - Authentication and authorization                       │
│  - Business and domain management                         │
│  - Knowledge engine                                       │
│  - AI conversation orchestration                          │
│  - Widget configuration                                   │
└──────────┬───────────────────────┬───────────────────────┘
           │                       │
           ▼                       ▼
┌──────────────────┐   ┌──────────────────────────────┐
│  PostgreSQL DB    │   │  External Services            │
│  - Organizations  │   │  - LLM API (OpenAI/similar)   │
│  - Users          │   │  - Embedding API               │
│  - Businesses     │   │  - Vector DB (pgvector or      │
│  - Knowledge      │   │    external)                   │
│  - Conversations  │   │  - Email service (for          │
│  - Sessions       │   │    invitations, notifications) │
└──────────────────┘   └──────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│  Widget (Embeddable)                                      │
│  - Served from ReplyIQ CDN                                │
│  - Runs on business websites                              │
│  - Communicates with API via WebSocket/HTTP               │
└──────────────────────────────────────────────────────────┘
```

---

## 11. MVP Scope (What Ships First)

The MVP delivers the core loop: **a business sets up their AI receptionist, embeds the widget on their website, and the AI greets visitors, answers questions, and captures leads.**

### MVP Features

| Feature | Included | Notes |
|---------|----------|-------|
| User registration and authentication | Yes | [IMPLEMENTED] |
| Business onboarding (profile + domain verification) | Yes | [PARTIALLY IMPLEMENTED] |
| Knowledge base: document upload + FAQ | Yes | Minimum viable ingestion |
| Knowledge base: URL scraping | Yes | Basic content extraction |
| AI conversation engine | Yes | Single LLM provider |
| Lead capture (name + email extraction) | Yes | From conversation |
| Embeddable chat widget | Yes | Basic chat UI |
| Widget embed script generation | Yes | One-line snippet |
| Conversation history | Yes | Viewable in dashboard |
| Basic analytics | Yes | Conversation count, lead count |
| Human handoff | Yes | Basic escalation to configured email |

### MVP Does NOT Include

| Feature | Deferred To |
|---------|-------------|
| Appointment scheduling | Post-MVP |
| Multi-channel (email, messaging) | Post-MVP |
| Team management (invitations, roles) | Milestone 4B |
| Widget customization (colors, position) | Post-MVP |
| Advanced analytics | Post-MVP |
| API documentation | Milestone 8 |
| CI/CD pipeline | Milestone 8 |
| Multi-language support | Post-MVP |
| Payment/billing integration | Post-MVP |
| Mobile app | Post-MVP |

---

## 12. Future Scope (What Comes Later)

### Post-MVP (Near-Term)

| Feature | Description |
|---------|-------------|
| Appointment scheduling | Calendar integration (Google Calendar, Outlook) with availability checking |
| Team management | Full invitation flow, role management, team page |
| Widget customization | Configurable theme, position, greeting text |
| Multi-channel | Email inbox integration, SMS, WhatsApp |
| Advanced analytics | Conversion funnel, AI accuracy metrics, response time tracking |
| Conversation handoff | Real-time agent takeover via dashboard |

### Medium-Term

| Feature | Description |
|---------|-------------|
| CRM integration | Push leads to HubSpot, Salesforce, Pipedrive |
| Zapier/webhook integration | Connect to any workflow tool |
| Multi-language AI | Respond in the visitor's detected language |
| Custom AI persona | Fine-tune AI tone, style, and behavior per business |
| A/B testing | Test different greetings and qualification flows |
| Voice channel | Phone call handling via telephony integration |

### Long-Term

| Feature | Description |
|---------|-------------|
| White-label platform | Resell under your own brand |
| Marketplace | Third-party integrations and templates |
| Enterprise features | SSO, advanced RBAC, compliance certifications |
| Mobile app | Native iOS/Android for managing conversations on the go |

---

## 13. Explicitly Out-of-Scope Functionality

The following features will **not** be built into ReplyIQ, now or in the foreseeable future:

| Feature | Reason |
|---------|--------|
| General-purpose chatbot builder | ReplyIQ is purpose-built for business reception, not a platform for any chatbot use case |
| Full CRM functionality | Lead capture only; integration with existing CRMs is preferred over replacing them |
| Website builder | ReplyIQ provides a widget, not a website |
| Voice/phone AI (v1) | Web and text channels only; voice requires telephony infrastructure that is out of initial scope |
| Social media management | ReplyIQ handles inbound inquiries, not outbound social posting |
| Email marketing | ReplyIQ sends transactional emails (invitations, notifications), not marketing campaigns |
| Payment processing | No billing integration in v1; pricing is handled outside the platform |
| Multi-tenant data sharing | Each organization's data is fully isolated; no cross-tenant features |
| Real-time collaboration on conversations | One agent (AI or human) handles a conversation at a time |
| Custom model training | Users configure prompts and knowledge; they do not train or fine-tune models |

---

## 14. Success Criteria

### Launch Success (MVP)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first conversation | < 30 minutes from registration | Onboarding funnel analytics |
| AI first-response time | < 3 seconds | API latency monitoring |
| Knowledge base setup time | < 15 minutes for 10 FAQs | User testing |
| Widget embed success rate | > 95% on first attempt | Error tracking |
| Conversation completion rate | > 80% of visitors who start a conversation provide contact info | Lead capture analytics |

### Growth Success (6 Months Post-Launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Monthly active businesses | 100 | Platform analytics |
| Average conversations per business per week | 20+ | Conversation analytics |
| Lead capture rate | > 30% of conversations result in a captured lead | Lead analytics |
| Customer retention (monthly) | > 85% | Billing/churn tracking |
| Net Promoter Score (NPS) | > 40 | User surveys |
| AI accuracy (correct answers) | > 85% | Conversation review sampling |

### Business Success (12 Months Post-Launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Annual Recurring Revenue (ARR) | $100K+ | Billing |
| Businesses using appointment scheduling | > 50% of active businesses | Feature adoption |
| Average revenue per business (ARPU) | > $100/month | Billing |
| Support ticket volume | < 5% of active businesses filing tickets per month | Support system |
| Churn rate (monthly) | < 10% | Billing/churn tracking |

---

## Appendix: Implementation Status Summary

| Area | Completion | Notes |
|------|------------|-------|
| Infrastructure (M1) | 100% | Turborepo, NestJS, Prisma, Docker, logging, security middleware |
| Database (M2) | 100% | 7 models, 6 migrations, seed script |
| Authentication (M3) | 100% | Register, login, refresh, logout, /me, session revocation |
| Business Onboarding (M4A) | 100% | Profile, domains, three verification methods, Test Mode, wizard, dashboard, guards, audit log, error-code contract, test suite |
| Team Management (M4B) | 0% | Invitations, roles UI, logo upload — next milestone |
| Knowledge Engine (M5) | 0% | Not started |
| AI Receptionist (M6) | 0% | Not started |
| Widget (M7) | 0% | Scaffold exists; no implementation. Must honour `isSandbox` — a test domain never serves a live widget |
| Production (M8) | 15% | SSRF hardening, per-org rate limits and audit logging landed early; Docker/CI/observability pending |
| **Overall** | **~52%** | Onboarding surface is production-grade; AI and widget pending |

### Requirement Traceability

Every requirement introduced or changed in this revision is traceable to code and
to a test. See `docs/CHANGES-2026-09-05.md` §4 for the full matrix
(requirement → implementation file → test file).
