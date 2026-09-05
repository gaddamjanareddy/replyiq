# ReplyIQ - Technical Architecture

> Defines the system architecture, monorepo structure, application internals, data flow, and deployment model. Clearly separates CURRENT implementation from PLANNED architecture.

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Tech Lead

---

## 1. System Overview

```
+-------------------------------------------------------------------+
|                          CLIENTS                                   |
|                                                                    |
|   +-----------+   +--------------+   +----------------------+      |
|   |  Web App  |   |  Widget      |   | Future: Email/Slack  |      |
|   |  (SPA)    |   |  (Embedded)  |   |                      |      |
|   +-----+-----+   +------+-------+   +----------+-----------+      |
|         |                |                     |                   |
+---------+----------------+---------------------+-------------------+
          |                |                     |
          v                v                     v
+-------------------------------------------------------------------+
|                   API GATEWAY (NestJS + Fastify)                   |
|                   Port 3000 | Prefix: /api/v1                     |
|                                                                    |
|  +---------+ +----------+ +----------+ +-----------+ +---------+  |
|  |  Auth   | | Business | |  Domain  | |Onboarding | | Health  |  |
|  |  Module | |  Module  | |  Module  | |  Module   | | Module  |  |
|  +----+----+ +----+-----+ +----+-----+ +-----+-----+ +---------+  |
|       |           |             |             |                   |
|  +----+-----------+-------------+-------------+-----------------+ |
|  |                  Infrastructure Layer                         | |
|  |  Security Module (JWT, Sessions, Password Hashing)            | |
|  |  Database Module (Prisma - Global)                            | |
|  +----------------------------+----------------------------------+ |
+-------------------------------+------------------------------------+
                                |
                                v
+-------------------------------------------------------------------+
|                     PostgreSQL 17                                   |
|                     Docker Compose                                  |
|                                                                    |
|  organizations | users | businesses | business_domains |           |
|  sessions | onboarding_progress                                     |
+-------------------------------------------------------------------+
```

---

## 2. Monorepo Architecture

### 2.1 Toolchain

| Tool | Version | Purpose |
|------|---------|---------|
| **pnpm** | 11.13.0 | Package manager with workspace support |
| **Turborepo** | 2.3.3 | Task orchestration, caching, dependency-aware builds |
| **TypeScript** | 5.7.3 | Shared across all workspaces |
| **ESLint** | 9.17.0 | Linting (flat config via `@replyiq/config`) |
| **Prettier** | 3.4.2 | Formatting (shared preset via `@replyiq/config`) |

### 2.2 Workspace Structure

```
replyiq/
├── apps/
│   ├── api/              @replyiq/api       - NestJS REST API
│   ├── web/              @replyiq/web       - React SPA dashboard
│   └── widget/           @replyiq/widget    - Embeddable chat widget (scaffolded)
├── packages/
│   ├── ai-sdk/           @replyiq/ai-sdk    - AI provider integration (scaffolded)
│   ├── config/           @replyiq/config    - ESLint, Prettier, Tailwind, TSConfig presets
│   ├── core/             @replyiq/core      - Shared business logic (scaffolded)
│   ├── database/         @replyiq/database  - Prisma schema, client, migrations
│   ├── types/            @replyiq/types     - Shared TypeScript types (empty)
│   ├── ui/               @replyiq/ui        - Shared UI components (empty)
│   └── utils/            @replyiq/utils     - Shared utilities (empty)
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.node.json
└── tsconfig.react.json
```

### 2.3 Turborepo Task Pipeline

```
build     -> dependsOn: [^build]    -> outputs: dist/**
dev       -> cache: false            -> persistent: true
lint      -> dependsOn: [^build]
typecheck -> dependsOn: [^build]
clean     -> cache: false
```

Tasks respect topological order: `packages/*` build before `apps/*`. The `^build` dependency ensures upstream packages are compiled before downstream consumers.

### 2.4 Package Namespace

All packages use the `@replyiq/*` namespace. Internal dependencies use `workspace:*` protocol:

```json
"@replyiq/database": "workspace:*"
"@replyiq/types": "workspace:*"
```

### 2.5 Build Allowlist

The `pnpm-workspace.yaml` explicitly allows native builds for:

- `@prisma/client`, `@prisma/engines` -- Prisma engine binaries
- `@swc/core` -- SWC native compiler
- `argon2` -- Password hashing (Rust native)
- `esbuild` -- JavaScript bundler
- `prisma` -- Prisma CLI

---

## 3. Applications

### 3.1 `@replyiq/api` -- REST API

**Status:** CURRENT

| Property | Value |
|----------|-------|
| Framework | NestJS 11.1.28 |
| HTTP Server | Fastify 5.10.0 (via `@nestjs/platform-fastify`) |
| Port | 3000 |
| API Prefix | `/api/v1` |
| Module System | ESM (`"type": "module"`) |
| Compiler | SWC (`@swc/core`) |

#### Directory Layout

```
apps/api/src/
├── main.ts                    Bootstrap + Fastify adapter setup
├── app.module.ts              Root module composition
├── config/
│   ├── configuration.ts       Config factory (process.env)
│   └── env.validation.ts      Zod schema for env validation
├── common/
│   ├── constants/             Application constants
│   ├── decorators/            Custom NestJS decorators
│   ├── filters/               Exception filters (GlobalExceptionFilter)
│   ├── interceptors/          Request/response interceptors
│   ├── pipes/                 Custom validation pipes
│   ├── security/              Security utility services
│   └── types/                 Shared API types
├── infrastructure/
│   └── security/
│       ├── security.module.ts         Auth infrastructure
│       └── session/
│           └── session.module.ts      Session management
├── shared/
│   └── database/
│       └── database.module.ts         Global Prisma module
└── modules/
    ├── health/                Health check endpoints
    ├── auth/                  Authentication (login, register, refresh)
    ├── identity/              Identity management (stub)
    ├── users/                 User CRUD (stub)
    ├── business/              Business CRUD + management
    ├── domain/                Domain verification
    └── onboarding/            Onboarding wizard state machine
```

#### Layer Architecture

The API follows a layered architecture within `apps/api/src/`:

| Layer | Directory | Purpose |
|-------|-----------|---------|
| **Common** | `common/` | Filters, pipes, decorators, types, constants, security services -- shared across all modules |
| **Infrastructure** | `infrastructure/` | Security modules (JWT strategy, session management) |
| **Shared** | `shared/` | Database module (global Prisma client injection) |
| **Application** | `application/` | Reserved for application services and DTOs (empty, planned) |
| **Modules** | `modules/` | Feature modules with controllers, services, and domain logic |

#### Module Status

| Module | Status | Description |
|--------|--------|-------------|
| Health | Implemented | Liveness/readiness probes |
| Auth | Implemented | Register, login, refresh, logout |
| Business | Implemented | CRUD, ownership scoping |
| Domain | Implemented | Domain verification (DNS TXT, HTML meta) |
| Onboarding | Implemented | Step-by-step onboarding wizard |
| Identity | Stub | Empty module placeholder |
| Users | Stub | Empty module placeholder |

#### Security Stack

| Layer | Implementation |
|-------|----------------|
| **Transport** | `@fastify/helmet` -- Security headers |
| **Compression** | `@fastify/compress` -- Gzip/Brotli |
| **CORS** | `@fastify/cors` -- Configurable origins via `CORS_ORIGINS` env |
| **Rate Limiting** | `@nestjs/throttler` -- Applied globally, configurable TTL + limit |
| **Password Hashing** | `argon2` -- Argon2id algorithm |
| **JWT** | `@nestjs/jwt` + `passport-jwt` -- Dual token strategy |
| **Validation** | `class-validator` + `class-transformer` -- Global `ValidationPipe` with whitelist + transform + forbidNonWhitelisted |
| **Env Validation** | `zod` -- Schema-validated environment variables at startup |
| **Logging** | `nestjs-pino` -- Structured JSON logs (pino-pretty in dev) |
| **Exception Handling** | `GlobalExceptionFilter` -- Unified error responses |

#### Authentication Architecture

**Dual JWT Strategy:**

| Token | Lifetime | Purpose | Storage |
|-------|----------|---------|---------|
| Access Token | 15 minutes | API authorization | Memory (client-side) |
| Refresh Token | 30 days | Token renewal | DB-backed session |

**Session Management:**

- Refresh tokens are stored as argon2 hashes in the `sessions` table
- Each refresh token is single-use (rotation on every refresh)
- Session tracks `ipAddress`, `userAgent`, `lastUsedAt` for audit
- Sessions are revoked on logout; expired sessions are cleaned up

**Request Auth Flow:**

```
Client                    API                      Database
  |                        |                         |
  |-- POST /auth/login --->|                         |
  |                        |-- Verify credentials -->|
  |                        |<-- User record ---------|
  |                        |-- Hash password (argon2)|
  |                        |-- Generate access JWT   |
  |                        |-- Generate refresh JWT  |
  |                        |-- Store session hash -->|
  |<-- { access, refresh }-|                         |
  |                        |                         |
  |-- GET /resource        |                         |
  |   Authorization: Bearer|                         |
  |<-- 200 OK -------------|                         |
  |                        |                         |
  |-- POST /auth/refresh   |                         |
  |   { refreshToken }     |                         |
  |                        |-- Verify & rotate ----->|
  |                        |-- New session hash ---->|
  |<-- { access, refresh }-|                         |
```

### 3.2 `@replyiq/web` -- Dashboard SPA

**Status:** CURRENT

| Property | Value |
|----------|-------|
| Framework | React 19.0.0 |
| Build Tool | Vite 6.0.0 |
| Port | 5173 (dev) |
| Routing | react-router-dom 7.18.1 |
| State Management | Zustand 5.0.14 |
| Server State | TanStack React Query 5.101.4 |
| Styling | TailwindCSS 4.3.3 (via `@tailwindcss/vite`) |

#### API Proxy

During development, Vite proxies `/api` requests to the backend:

```typescript
// apps/web/vite.config.ts
proxy: {
  '/api': 'http://localhost:3000',
}
```

In production, a reverse proxy (nginx/Caddy) handles the same mapping.

#### Dependencies

```json
"@replyiq/types": "workspace:*",
"@replyiq/ui": "workspace:*",
"@replyiq/utils": "workspace:*"
```

### 3.3 `@replyiq/widget` -- Embeddable Widget

**Status:** SCAFFOLDED (empty)

| Property | Value |
|----------|-------|
| Framework | React (planned) |
| Build Tool | Vite (planned) |
| Purpose | Embeddable chat component for business websites |

The widget is scaffolded with a single `export {}` in `src/main.tsx`. Implementation is planned for Milestone 7.

---

## 4. Packages

### 4.1 `@replyiq/database` -- Prisma ORM

**Status:** CURRENT

| Property | Value |
|----------|-------|
| ORM | Prisma 6.6 |
| Database | PostgreSQL 17 |
| Migrations | 3 applied |

#### Schema: Models

| Model | Table | Primary Key | Soft Delete | Description |
|-------|-------|-------------|-------------|-------------|
| Organization | `organizations` | UUID | Yes | Multi-tenant root entity |
| User | `users` | UUID | Yes | Platform user (belongs to org) |
| Business | `businesses` | UUID | Yes | Business profile (belongs to org) |
| BusinessDomain | `business_domains` | UUID | Yes | Domain with verification |
| Session | `sessions` | UUID | No | DB-backed refresh token sessions |
| OnboardingProgress | `onboarding_progress` | UUID | No | Onboarding step tracking |

#### Schema: Enums

| Enum | Values |
|------|--------|
| `OrganizationStatus` | ACTIVE, SUSPENDED, ARCHIVED |
| `BusinessStatus` | DRAFT, ACTIVE, SUSPENDED, ARCHIVED |
| `UserRole` | OWNER, ADMIN, MANAGER |
| `UserStatus` | ACTIVE, INVITED, DISABLED |
| `BusinessDomainStatus` | PENDING, VERIFIED, DISABLED |
| `OnboardingStatus` | NOT_STARTED, IN_PROGRESS, DOMAIN_PENDING, COMPLETED |
| `VerificationMethod` | DNS_TXT, HTML_META |

#### Key Relationships

```
Organization 1--N User
Organization 1--N Business
Business 1--N BusinessDomain
Business 1--1 OnboardingProgress
User 1--N Session
```

#### Indexes

- `organizations`: `[status]`
- `users`: `[organizationId]`, `[status]`, unique `[email]`
- `businesses`: `[organizationId]`, `[status]`, `[onboardingStatus]`
- `business_domains`: `[businessId]`, `[status]`, unique `[domain]`
- `sessions`: `[userId]`, `[expiresAt]`
- `onboarding_progress`: unique `[businessId]`

### 4.2 `@replyiq/config` -- Shared Configuration

**Status:** CURRENT

Exports:

| Export | Purpose |
|--------|---------|
| `@replyiq/config/eslint` | Shared ESLint flat config |
| `@replyiq/config/prettier` | Shared Prettier config |
| `@replyiq/config/tailwind` | Shared TailwindCSS config |
| `@replyiq/config/tsconfig.base` | Base TypeScript config |
| `@replyiq/config/tsconfig.node` | Node.js TypeScript config |
| `@replyiq/config/tsconfig.react` | React TypeScript config |

### 4.3 `@replyiq/ai-sdk` -- AI Integration

**Status:** SCAFFOLDED

Package directory exists with `package.json` and build tooling. Depends on `@replyiq/types`. Implementation planned for Milestone 5.

### 4.4 `@replyiq/core` -- Shared Business Logic

**Status:** SCAFFOLDED

Package directory exists with `package.json` and build tooling. Depends on `@replyiq/types`. Reserved for domain logic shared between API and widget.

### 4.5 `@replyiq/types` -- Shared Types

**Status:** EMPTY PLACEHOLDER

Reserved for TypeScript interfaces and enums shared across packages.

### 4.6 `@replyiq/ui` -- Shared UI Components

**Status:** EMPTY PLACEHOLDER

Reserved for shared React components used by both `web` and `widget`.

### 4.7 `@replyiq/utils` -- Shared Utilities

**Status:** EMPTY PLACEHOLDER

Reserved for shared pure functions and helpers.

---

## 5. Data Flow

### 5.1 Registration Flow

```
User (Browser)       Web App (React)         API (NestJS)          Database
      |                    |                     |                     |
      |-- Fill form ------>|                     |                     |
      |                    |-- POST /api/v1/auth |                     |
      |                    |   /register         |                     |
      |                    |-- { email, password,|                     |
      |                    |    name, orgName }  |                     |
      |                    |                     |-- Validate DTO      |
      |                    |                     |-- Create Org ------>|
      |                    |                     |-- Hash password     |
      |                    |                     |-- Create User ----->|
      |                    |                     |-- Create Session -->|
      |                    |<-- { access, refresh}|                     |
      |<-- Set tokens ----|                     |                     |
      |                    |                     |                     |
      |                    |-- POST /api/v1/     |                     |
      |                    |   onboarding/init   |                     |
      |                    |                     |-- Create Progress ->|
      |                    |<-- Onboarding state-|                     |
```

### 5.2 Domain Verification Flow

```
User                  Web App              API                 DNS/Provider
  |                     |                   |                     |
  |-- Add domain ------>|                   |                     |
  |                     |-- POST /api/v1    |                     |
  |                     |   /domains        |                     |
  |                     |                   |-- Create record --->|
  |                     |                   |-- Generate token    |
  |                     |<-- { token, method|                     |
  |                     |                   |                     |
  |-- (DNS: add TXT) -->|                   |                     |
  |-- (or: add meta) -->|                   |                     |
  |                     |                   |                     |
  |-- Verify --------->|                   |                     |
  |                     |-- POST /api/v1    |                     |
  |                     |   /domains/:id/   |-- DNS lookup ------>|
  |                     |   verify          |   (or fetch HTML)   |
  |                     |<-- VERIFIED ------|<--- Confirmed ------|
```

### 5.3 Conversation Flow (Planned -- Milestone 6-7)

```
Visitor (Website)      Widget (React)       API (NestJS)          AI Engine
      |                    |                   |                     |
      |-- Open chat ------>|                   |                     |
      |                    |-- POST /api/v1    |                     |
      |                    |   /conversations  |                     |
      |                    |                   |-- Create session    |
      |                    |<-- sessionId -----|                     |
      |                    |                   |                     |
      |-- Type message --->|                   |                     |
      |                    |-- POST /api/v1    |                     |
      |                    |   /conversations/ |                     |
      |                    |   :id/messages    |                     |
      |                    |                   |-- Context retrieval  |
      |                    |                   |-- LLM inference --->|
      |                    |<-- AI response ---|<--- Response -------|
      |<-- Display -------|                   |                     |
```

---

## 6. Request Flow

### 6.1 API Request Lifecycle

Every HTTP request passes through this pipeline:

```
1. Client sends HTTP request
        |
2. Fastify receives on port 3000
        |
3. @fastify/helmet          -- Injects security headers
        |
4. @fastify/compress        -- Compresses response (gzip/brotli)
        |
5. @fastify/cors            -- Validates Origin header
        |
6. NestJS routing           -- Matches /api/v1/<module>/<path>
        |
7. @nestjs/throttler        -- Rate limit check (global config)
        |
8. Passport guard (if auth) -- Extracts + validates JWT
        |
9. ValidationPipe           -- Validates + transforms DTO (whitelist, forbidNonWhitelisted)
        |
10. Controller              -- Delegates to service
        |
11. Service                 -- Business logic
        |
12. PrismaService           -- Database query (via DatabaseModule)
        |
13. Response serialized     -- class-transformer serialization
        |
14. GlobalExceptionFilter   -- Catches unhandled errors, returns structured JSON
```

### 6.2 Error Response Format

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request",
  "timestamp": "2026-08-17T12:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

---

## 7. Deployment Architecture

### 7.1 Development Environment

```
+-------------------+     +-------------------+     +-------------------+
|  apps/web         |     |  apps/api         |     |  Docker           |
|  Vite dev server  |     |  NestJS --watch   |     |  PostgreSQL 17    |
|  :5173            |---->|  :3000            |---->|  :5432            |
|                   |proxy|                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
```

Local development runs three processes:

1. `pnpm dev` -- Turborepo runs `dev` tasks for `api` (nest start --watch) and `web` (vite)
2. `docker compose up -d` -- PostgreSQL 17 in a container
3. Vite proxy routes `/api` requests from port 5173 to port 3000

### 7.2 Production Environment (Planned)

```
+-------------------------------------------------------------------+
|                        Load Balancer / CDN                          |
|                    (Cloudflare / AWS ALB / nginx)                   |
+-------------------------------------------------------------------+
          |                              |
          v                              v
+-------------------+     +-------------------+
|  apps/web         |     |  apps/api         |
|  Static files     |     |  NestJS (Node.js) |
|  (dist/)          |     |  Port 3000        |
|  Served by: nginx |     |  Multiple replicas |
+-------------------+     +-------------------+
                                   |
                                   v
                         +-------------------+
                         |  PostgreSQL 17    |
                         |  (RDS / managed)  |
                         +-------------------+
```

### 7.3 Docker (Planned)

Current Docker setup provides PostgreSQL only. Full application containerization planned for Milestone 8:

```yaml
# Planned: docker-compose.yml (production)
services:
  api:
    build: ./apps/api
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://...
    depends_on: [postgres]

  web:
    build: ./apps/web
    ports: ["80:80"]

  postgres:
    image: postgres:17
    # ... existing config
```

---

## 8. Scalability Strategy

### 8.1 Horizontal Scaling

| Component | Strategy |
|-----------|----------|
| **API (apps/api)** | Stateless NestJS processes behind a load balancer. No in-memory session state -- all sessions are DB-backed. Scale by adding replicas. |
| **Database** | PostgreSQL read replicas for read-heavy workloads. Connection pooling via Prisma's built-in pool. Consider PgBouncer at high concurrency. |
| **Widget** | Static asset served from CDN. No server-side rendering needed. |
| **Web App** | Static SPA served from CDN/object storage. |

### 8.2 Vertical Scaling

| Resource | Bottleneck | Mitigation |
|----------|-----------|------------|
| **DB connections** | Prisma connection pool exhaustion | Configure `connection_limit` in DATABASE_URL; use PgBouncer |
| **JWT validation** | CPU-bound crypto | Access tokens are stateless (no DB hit per request) |
| **Rate limiting** | Memory in single-instance | Use Redis-backed throttler for multi-instance (planned) |
| **AI inference** | External API latency | Async processing, response streaming, provider fallback |

### 8.3 Future Scaling Considerations

- **Message queue** (BullMQ/Redis) for async tasks: email sending, domain verification checks, AI inference queuing
- **Redis** for distributed rate limiting, session cache, pub/sub
- **Background workers** for batch operations (bulk domain verification, knowledge base ingestion)
- **CDN** for widget static assets and API response caching (public endpoints)

---

## 9. Reliability Strategy

### 9.1 Availability Targets

| Service | Target | Rationale |
|---------|--------|-----------|
| API | 99.9% uptime | Core platform -- downtime means businesses cannot manage their AI agents |
| Database | 99.95% | Managed PostgreSQL with automated backups |
| Widget | 99.95% | Served from CDN; must be available whenever visitor traffic exists |

### 9.2 Fault Tolerance

| Mechanism | Implementation |
|-----------|----------------|
| **Health checks** | `GET /api/v1/health` for liveness and readiness probes (Kubernetes/Docker) |
| **Graceful shutdown** | `app.enableShutdownHooks()` -- NestJS drains connections on SIGTERM |
| **Database resilience** | PostgreSQL `healthcheck` in Docker Compose with retry logic |
| **Error boundaries** | `GlobalExceptionFilter` prevents stack traces from leaking; returns structured errors |
| **Input validation** | `ValidationPipe` rejects malformed input before it reaches business logic |
| **Soft deletes** | 4 models use `deletedAt` for data recovery without permanent loss |

### 9.3 Data Integrity

| Concern | Solution |
|---------|----------|
| **Referential integrity** | Prisma relations with `onDelete: Restrict` (organizations, businesses, domains) prevent orphan deletion |
| **Cascading deletes** | `onDelete: Cascade` on sessions (user deletion removes all sessions) |
| **Unique constraints** | Unique on `email` (users) and `domain` (business_domains) prevent duplicates |
| **Index optimization** | Strategic indexes on foreign keys and frequently queried status columns |
| **Migration safety** | 3 sequential Prisma migrations; no destructive changes without rollback path |

### 9.4 Security Reliability

| Concern | Solution |
|---------|----------|
| **Token theft** | Refresh token rotation -- stolen token is invalidated on next use |
| **Credential stuffing** | Rate limiting on auth endpoints via `@nestjs/throttler` |
| **Injection attacks** | Prisma parameterized queries; ValidationPipe with whitelist |
| **XSS** | React auto-escaping; `@fastify/helmet` Content Security Policy headers |
| **CSRF** | Same-site cookies (planned); CORS origin validation |
| **Secrets** | Zod-validated env vars at startup; no secrets in source code |

---

## 10. Planned Architecture (Milestones 5-8)

### 10.1 Milestone 5: AI Provider Integration

| Component | Package | Description |
|-----------|---------|-------------|
| AI SDK | `packages/ai-sdk` | Provider abstraction (OpenAI, Anthropic, etc.) with streaming support |
| Prompt management | `packages/ai-sdk` | Template system for system prompts per business |
| Provider fallback | `packages/ai-sdk` | Automatic failover between AI providers |

### 10.2 Milestone 6: Knowledge Engine

| Component | Location | Description |
|-----------|----------|-------------|
| Document parser | `packages/core` or `apps/api` | Ingest PDF, DOCX, TXT, HTML files |
| Text chunker | `packages/core` | Split documents into embeddable chunks |
| Embedding service | `packages/ai-sdk` | Generate vector embeddings via AI provider |
| Vector storage | PostgreSQL + pgvector | Store and query embeddings |
| Retrieval engine | `packages/core` | RAG pipeline: query -> embed -> search -> context |

### 10.3 Milestone 7: AI Receptionist

| Component | Location | Description |
|-----------|----------|-------------|
| Conversation manager | `apps/api` module | Multi-turn conversation state management |
| Message handler | `apps/api` module | Process incoming messages, invoke AI, return responses |
| Channel adapters | `apps/api` | Email, Slack, SMS integration points |
| Widget (full) | `apps/widget` | React component with WebSocket/SSE for real-time chat |

### 10.4 Milestone 8: Production Hardening

| Component | Description |
|-----------|-------------|
| Docker multi-stage builds | Optimized production images for API and widget |
| CI/CD pipeline | GitHub Actions: lint, typecheck, test, build, deploy |
| Monitoring | Structured logging (pino) + metrics (Prometheus) + tracing (OpenTelemetry) |
| Rate limiting (distributed) | Redis-backed `@nestjs/throttler` for multi-instance deployments |
| Backup strategy | Automated PostgreSQL backups with point-in-time recovery |
| Environment management | Staging + production environment separation |

---

## 11. Technology Summary

### 11.1 Current Stack (Implemented)

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | >= 22 |
| **Language** | TypeScript | 5.7.3 |
| **Package Manager** | pnpm | 11.13.0 |
| **Build Orchestration** | Turborepo | 2.3.3 |
| **API Framework** | NestJS | 11.1.28 |
| **HTTP Server** | Fastify | 5.10.0 |
| **ORM** | Prisma | 6.6 |
| **Database** | PostgreSQL | 17 |
| **Frontend** | React | 19.0.0 |
| **Bundler** | Vite | 6.0.0 |
| **Styling** | TailwindCSS | 4.3.3 |
| **State** | Zustand | 5.0.14 |
| **Server State** | TanStack Query | 5.101.4 |
| **Routing** | React Router | 7.18.1 |
| **Password Hashing** | argon2 | 0.44.0 |
| **Validation** | class-validator | 0.14.1 |
| **Env Validation** | Zod | 3.24.0 |
| **Logging** | pino (via nestjs-pino) | 10.3.1 |

### 11.2 Planned Additions

| Technology | Purpose | Milestone |
|-----------|---------|-----------|
| pgvector | Vector similarity search for knowledge base | 6 |
| Redis | Caching, rate limiting, queues | 8 |
| BullMQ | Background job processing | 8 |
| WebSocket / SSE | Real-time widget communication | 7 |
| Docker multi-stage | Production containerization | 8 |
| GitHub Actions | CI/CD pipeline | 8 |
| OpenTelemetry | Distributed tracing | 8 |
| Prometheus | Metrics collection | 8 |
