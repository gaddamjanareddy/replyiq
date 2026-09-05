# 13. Infrastructure & DevOps

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Tech Lead

This document describes the infrastructure, tooling, and operational procedures for ReplyIQ. It covers local development, build pipelines, deployment strategy, and planned production infrastructure.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Local Development](#2-local-development)
3. [Docker Configuration](#3-docker-configuration)
4. [PostgreSQL](#4-postgresql)
5. [Environment Variables](#5-environment-variables)
6. [Build System](#6-build-system)
7. [Scripts Reference](#7-scripts-reference)
8. [Database Migrations](#8-database-migrations)
9. [Logging](#9-logging)
10. [Health Checks](#10-health-checks)
11. [Secrets Management](#11-secrets-management)
12. [CI/CD Pipeline](#12-cicd-pipeline-planned)
13. [Deployment Strategy](#13-deployment-strategy-planned)
14. [API Documentation](#14-api-documentation-planned)
15. [Error Tracking](#15-error-tracking-planned)
16. [Monitoring and Alerting](#16-monitoring-and-alerting-planned)
17. [Database Connection Pooling](#17-database-connection-pooling-planned)
18. [Load Testing](#18-load-testing-planned)
19. [Security Audit](#19-security-audit-planned)
20. [Domain and HTTPS](#20-domain-and-https-planned)
21. [Backups](#21-backups-planned)
22. [Scaling](#22-scaling-planned)
23. [Rollbacks](#23-rollbacks-planned)

---

## 1. Architecture Overview

ReplyIQ is a monorepo managed by Turborepo with three applications and three shared packages.

```
replyiq/
  apps/
    api/          NestJS backend (REST API)
    web/          React + Vite dashboard
    widget/       React embeddable chat widget
  packages/
    database/     Prisma schema, migrations, seed
    shared/       Shared types and utilities
    ui/           Shared UI components
```

**Runtime dependencies per environment:**

| Component     | Local Development      | Production (Planned)              |
|---------------|------------------------|-----------------------------------|
| API           | Node.js on host        | Docker container (multi-stage)    |
| Web           | Vite dev server        | Static files behind CDN/reverse proxy |
| Widget        | Vite dev server        | Static files behind CDN/reverse proxy |
| PostgreSQL    | Docker container       | Managed database (e.g., Supabase, RDS) |

---

## 2. Local Development

### 2.1 Prerequisites

| Tool            | Version    | Purpose                        |
|-----------------|------------|--------------------------------|
| Node.js         | LTS        | JavaScript runtime             |
| pnpm            | 11.13      | Package manager                |
| Docker Desktop  | Latest     | PostgreSQL container           |

### 2.2 Setup Sequence

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Install dependencies
pnpm install

# 3. Run database migrations
cd packages/database && pnpm db:migrate

# 4. Seed the database
pnpm db:seed

# 5. Start all apps in dev mode
pnpm dev
```

The `pnpm dev` command uses Turborepo to start all three applications concurrently with hot reloading.

### 2.3 Development Ports

| Service    | Port   | URL                          |
|------------|--------|------------------------------|
| API        | 3000   | http://localhost:3000         |
| Web        | 5173   | http://localhost:5173         |
| Widget     | 5174   | http://localhost:5174         |
| PostgreSQL | 5432   | postgresql://localhost:5432   |

---

## 3. Docker Configuration

### 3.1 Current: PostgreSQL Only

The only Docker container in use is PostgreSQL for local development.

**docker-compose.yml:**

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:17
    container_name: replyiq-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: replyiq
      POSTGRES_PASSWORD: replyiq_dev_password
      POSTGRES_DB: replyiq
    volumes:
      - replyiq-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U replyiq"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  replyiq-postgres-data:
```

### 3.2 Planned: API Dockerfile (Milestone 8)

A multi-stage Dockerfile for the API application is planned.

```dockerfile
# Planned - Stage 1: Build
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @replyiq/database db:generate
RUN pnpm --filter @replyiq/api build

# Stage 2: Production
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 3.3 Planned: Web Dockerfile (Milestone 8)

```dockerfile
# Planned - Multi-stage build for static frontend
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @replyiq/web build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 4. PostgreSQL

### 4.1 Configuration

| Parameter       | Value                        |
|-----------------|------------------------------|
| Version         | 17                           |
| Host (local)    | localhost                    |
| Port            | 5432                         |
| Database        | replyiq                      |
| User            | replyiq                      |
| Password        | replyiq_dev_password         |

### 4.2 Connection String

```
postgresql://replyiq:replyiq_dev_password@localhost:5432/replyiq
```

### 4.3 Data Persistence

Local data is persisted via the Docker volume `replyiq-postgres-data`. To reset the database completely:

```bash
docker-compose down -v
docker-compose up -d
cd packages/database && pnpm db:migrate && pnpm db:seed
```

---

## 5. Environment Variables

### 5.1 Root Level

| Variable     | File     | Description                     | Example                                          |
|--------------|----------|---------------------------------|--------------------------------------------------|
| DATABASE_URL | .env     | PostgreSQL connection string    | postgresql://replyiq:replyiq_dev_password@localhost:5432/replyiq |

### 5.2 API (apps/api/.env.example)

| Variable          | Description                        | Default (dev)                              |
|-------------------|------------------------------------|--------------------------------------------|
| PORT              | API server port                    | 3000                                       |
| NODE_ENV          | Environment mode                   | development                                |
| DATABASE_URL      | PostgreSQL connection string       | postgresql://replyiq:replyiq_dev_password@localhost:5432/replyiq |
| JWT_SECRET        | Access token signing secret (required) | (must be set per environment)          |
| JWT_REFRESH_SECRET| Refresh token signing secret (required) | (must be set per environment)          |
| ACCESS_TOKEN_TTL  | Access token lifetime              | 15m                                        |
| REFRESH_TOKEN_TTL | Refresh token lifetime             | 30d                                        |
| CORS_ORIGINS      | Allowed CORS origins (comma-sep)   | http://localhost:5173                      |
| RATE_LIMIT_TTL    | Rate limit window (seconds)        | 60                                         |
| RATE_LIMIT_MAX    | Max requests per window            | 10                                         |

> Reconciliation note (2026-08): the repo-root `.env.example` currently documents **only** `DATABASE_URL`; the API variables above are enforced by Zod validation (`apps/api/src/config/env.validation.ts`) with these exact defaults. `RATE_LIMIT_MAX` default is 10, not 100 as previously documented. Templates for all variables are a planned cleanup.

### 5.3 Web (apps/web/.env.example)

| Variable       | Description              | Default               |
|----------------|--------------------------|-----------------------|
| VITE_API_URL   | Backend API base URL     | http://localhost:3000  |

### 5.4 Widget (apps/widget/.env.example)

| Variable       | Description              | Default               |
|----------------|--------------------------|-----------------------|
| VITE_API_URL   | Backend API base URL     | http://localhost:3000  |

### 5.5 Planned Additional Variables (Milestone 8)

| Variable          | Description                          | Environment   |
|-------------------|--------------------------------------|---------------|
| SENTRY_DSN        | Sentry error tracking endpoint       | Staging/Prod  |
| SMTP_HOST         | Email server host                     | Staging/Prod  |
| SMTP_PORT         | Email server port                     | Staging/Prod  |
| SMTP_USER         | Email server username                 | Staging/Prod  |
| SMTP_PASS         | Email server password                 | Staging/Prod  |
| REDIS_URL         | Redis connection (rate limiting, queue) | Staging/Prod |
| WEBHOOK_SECRET    | Third-party webhook signing secret   | Staging/Prod  |
| DATABASE_POOL_MIN | Min connection pool size              | Staging/Prod  |
| DATABASE_POOL_MAX | Max connection pool size              | Staging/Prod  |

---

## 6. Build System

### 6.1 Turborepo

All builds, dev scripts, linting, and type checking are orchestrated through Turborepo. Package dependencies define build order via the `^build` pipeline configuration.

**turbo.json pipeline (key tasks):**

| Task        | Command                      | Dependencies | Description                          |
|-------------|------------------------------|--------------|--------------------------------------|
| build       | Resolves per package         | ^build       | Build all packages and apps in order |
| dev         | Resolves per package         | None         | Start dev servers concurrently       |
| lint        | Resolves per package         | None         | Run ESLint across all packages       |
| typecheck   | Resolves per package         | None         | Run TypeScript type checking         |

### 6.2 Build Commands per Application

| Application | Build Tool       | Compiler | Output                     |
|-------------|------------------|----------|----------------------------|
| API         | NestJS CLI       | SWC      | apps/api/dist/             |
| Web         | tsc + Vite       | tsc + esbuild | apps/web/dist/         |
| Widget      | tsc              | tsc      | apps/widget/dist/          |
| Database    | Prisma CLI       | --       | Generated client           |
| Shared      | tsc              | tsc      | packages/shared/dist/      |
| UI          | tsc              | tsc      | packages/ui/dist/          |

### 6.3 Build Order

```
packages/shared  ─┐
packages/ui      ─┤──> packages/database ──> apps/api
                   │                         apps/web
                   │                         apps/widget
```

Turborepo resolves this automatically based on `dependencies` and `devDependencies` in each `package.json`.

---

## 7. Scripts Reference

### 7.1 Root

| Script       | Command                  | Description                              |
|--------------|--------------------------|------------------------------------------|
| dev          | turbo dev                | Start all apps in dev mode               |
| build        | turbo build              | Build all packages and apps              |
| lint         | turbo lint               | Lint all packages                        |
| format       | prettier --write .       | Format all files                         |
| typecheck    | turbo typecheck          | Type check all packages                  |
| clean        | turbo clean              | Remove build artifacts                   |

### 7.2 API (apps/api)

| Script    | Command                 | Description                    |
|-----------|-------------------------|--------------------------------|
| dev       | nest start --watch      | Start API with hot reload      |
| build     | nest build              | Production build via SWC       |
| lint      | eslint .                | Lint API source                |
| typecheck | tsc --noEmit            | Type check without emitting    |

### 7.3 Web (apps/web)

| Script    | Command                              | Description                    |
|-----------|--------------------------------------|--------------------------------|
| dev       | vite                                 | Start Vite dev server          |
| build     | tsc -b && vite build                 | Type check then bundle         |
| lint      | eslint .                             | Lint web source                |
| typecheck | tsc --noEmit                         | Type check without emitting    |

### 7.4 Widget (apps/widget)

| Script    | Command                 | Description                    |
|-----------|-------------------------|--------------------------------|
| dev       | vite                    | Start Vite dev server          |
| build     | tsc -b                  | TypeScript compilation only    |
| lint      | eslint .                | Lint widget source             |
| typecheck | tsc --noEmit            | Type check without emitting    |

### 7.5 Database (packages/database)

| Script      | Command              | Description                              |
|-------------|----------------------|------------------------------------------|
| db:migrate  | prisma migrate dev   | Create and apply migrations (dev)        |
| db:push     | prisma db push       | Push schema changes without migration    |
| db:generate | prisma generate      | Generate Prisma client                   |
| db:seed     | prisma db seed       | Run seed script                          |
| db:studio   | prisma studio        | Open Prisma Studio GUI                   |
| db:reset    | prisma migrate reset | Reset database and reapply migrations    |

---

## 8. Database Migrations

### 8.1 Workflow

1. Modify `packages/database/prisma/schema.prisma`
2. Run `pnpm db:migrate` to generate and apply a timestamped migration
3. Run `pnpm db:seed` if seed data changes are needed
4. Commit the migration folder to version control

### 8.2 Migration File Structure

```
packages/database/prisma/
  schema.prisma
  migrations/
    20260817_000000_init/
      migration.sql
    20260817_000001_add_widget_config/
      migration.sql
```

### 8.3 Best Practices

- Always use `migrate dev` in development, never `db push` for schema changes that need to persist
- Each migration file must be idempotent-safe
- Never edit an already-applied migration; create a new one instead
- Test migrations against a clean database before committing

---

## 9. Logging

### 9.1 Current: Pino (NestJS)

The API uses Pino via `nestjs-pino` for structured JSON logging.

| Level     | Usage                                    |
|-----------|------------------------------------------|
| error     | Unhandled exceptions, system failures    |
| warn      | Degraded functionality, retryable errors |
| info      | Request lifecycle, job completion        |
| debug     | Detailed operational data                |
| trace     | Fine-grained execution flow              |

### 9.2 Log Format

All logs are output as structured JSON in production, and pretty-printed in development.

```json
{
  "level": "info",
  "time": "2026-08-17T12:00:00.000Z",
  "context": "ConversationsController",
  "message": "Conversation created",
  "conversationId": "abc-123",
  "tenantId": "tenant-456"
}
```

### 9.3 Log Redaction

Sensitive fields are automatically redacted from logs:

- `password`
- `jwt_secret`
- `Authorization` header
- `cookie` header

---

## 10. Health Checks

### 10.1 Current: PostgreSQL

The Docker Compose configuration includes a PostgreSQL health check:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U replyiq"]
  interval: 5s
  timeout: 5s
  retries: 5
```

### 10.2 Planned: API Health Endpoints (Milestone 8)

| Endpoint               | Method | Description                          |
|------------------------|--------|--------------------------------------|
| /health               | GET    | Liveness check (always 200)          |
| /health/ready         | GET    | Readiness check (DB + dependencies)  |
| /health/startup       | GET    | Startup check (migrations complete)  |

Planned response format:

```json
{
  "status": "healthy",
  "timestamp": "2026-08-17T12:00:00.000Z",
  "checks": {
    "database": { "status": "up", "latency": 2 },
    "memory": { "status": "ok", "used": "45MB" }
  }
}
```

---

## 11. Secrets Management

### 11.1 Current: Local Development

Secrets are managed via `.env` files which are gitignored.

| Secret              | Where Stored         | Rotation Policy        |
|---------------------|----------------------|------------------------|
| DATABASE_URL        | Root .env             | On credential change   |
| JWT_SECRET          | apps/api/.env         | Every 90 days          |
| JWT_REFRESH_SECRET  | apps/api/.env         | Every 90 days          |

### 11.2 Planned: Production (Milestone 8)

| Strategy             | Tool                           | Usage                    |
|----------------------|--------------------------------|--------------------------|
| Environment secrets  | GitHub Actions Secrets         | CI/CD pipeline           |
| Runtime secrets      | Platform secret management     | API and service config   |
| Database credentials | Managed database provider      | Connection strings       |
| API keys             | Encrypted environment vars     | Third-party integrations |

### 11.3 Rules

- Never commit `.env` files or secrets to version control
- Use different secrets for development, staging, and production
- Rotate secrets on a regular schedule or after any suspected breach
- Use short-lived tokens where possible (e.g., JWT with TTL)

---

## 12. CI/CD Pipeline (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 12.1 Pipeline Overview (GitHub Actions)

```
Push to main
  |
  v
Lint + Type Check
  |
  v
Unit Tests
  |
  v
Build All Packages
  |
  v
Integration Tests
  |
  v
Build Docker Images
  |
  v
Deploy to Staging
  |
  v (manual approval)
Deploy to Production
```

### 12.2 Planned Workflow Files

| File                          | Trigger              | Description                    |
|-------------------------------|----------------------|--------------------------------|
| .github/workflows/ci.yml     | Push, PR             | Lint, typecheck, test, build   |
| .github/workflows/deploy.yml | Push to main         | Deploy to staging/production   |
| .github/workflows/test.yml   | PR                   | Run full test suite            |

### 12.3 Planned Checks

| Check              | Tool           | Fail Action     |
|--------------------|----------------|-----------------|
| Lint               | ESLint         | Block merge     |
| Type Check         | TypeScript     | Block merge     |
| Unit Tests         | Jest/Vitest    | Block merge     |
| Integration Tests  | Jest/Vitest    | Block merge     |
| Build              | Turborepo      | Block merge     |
| Security Scan      | npm audit      | Block merge     |

---

## 13. Deployment Strategy (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 13.1 Target Architecture

| Component  | Hosting               | Strategy            |
|------------|-----------------------|---------------------|
| API        | Container platform    | Blue-green deploy   |
| Web        | Static hosting / CDN  | Atomic deploy       |
| Widget     | Static hosting / CDN  | Atomic deploy       |
| Database   | Managed PostgreSQL    | In-place migration  |

### 13.2 Deployment Environments

| Environment  | Purpose                 | Auto-deploy | Approval Required |
|--------------|-------------------------|-------------|-------------------|
| Development  | Active feature work     | Yes (branch) | No                |
| Staging      | Pre-production QA       | Yes (main)   | No                |
| Production   | Live users              | Yes (main)   | Yes               |

### 13.3 Deployment Process

1. Developer merges PR to `main`
2. CI pipeline runs lint, tests, build
3. Staging deployment triggers automatically
4. QA validates on staging
5. Manual approval gates production deployment
6. Production deployment with health check verification
7. Automatic rollback if health checks fail

---

## 14. API Documentation (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 14.1 Approach

- Swagger/OpenAPI spec auto-generated from NestJS decorators
- Available at `/api/docs` in non-production environments
- Exported as static JSON for client generation

### 14.2 Planned Endpoints

| Endpoint       | Description                                |
|----------------|--------------------------------------------|
| /api/docs      | Swagger UI                                 |
| /api/docs-json | Raw OpenAPI JSON spec                      |

---

## 15. Error Tracking (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 15.1 Sentry Integration

| Setting            | Value                              |
|--------------------|------------------------------------|
| DSN                | Configured via SENTRY_DSN env var  |
| Environment        | Matches NODE_ENV                   |
| Sample Rate        | 100% (errors), 20% (transactions) |
| Release Tracking   | Git commit SHA                     |
| Source Maps        | Uploaded during build              |

### 15.2 Error Classification

| Level     | Action                                      |
|-----------|---------------------------------------------|
| Fatal     | Immediate alert, automatic rollback trigger |
| Error     | Sentry notification, logged to monitoring   |
| Warning   | Logged, aggregated for review               |
| Info      | Not sent to Sentry                          |

---

## 16. Monitoring and Alerting (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 16.1 Metrics to Track

| Category     | Metrics                                              |
|--------------|------------------------------------------------------|
| API          | Request rate, latency (p50/p95/p99), error rate     |
| Database     | Connection count, query latency, slow queries        |
| System       | CPU usage, memory usage, disk usage                  |
| Business     | Active users, conversations, message volume          |

### 16.2 Planned Alert Thresholds

| Alert                         | Condition                     | Severity |
|-------------------------------|-------------------------------|----------|
| API error rate elevated       | > 5% over 5 minutes          | Warning  |
| API error rate critical       | > 15% over 5 minutes         | Critical |
| API latency high              | p95 > 2s over 5 minutes      | Warning  |
| Database connections exhausted| > 80% of pool                | Warning  |
| Database down                 | Health check fails 3x        | Critical |
| Memory usage high             | > 85% for 10 minutes         | Warning  |

---

## 17. Database Connection Pooling (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 17.1 Configuration

| Parameter     | Development | Production (Planned) |
|---------------|-------------|----------------------|
| Min pool size | 2           | 5                    |
| Max pool size | 10          | 20                   |
| Idle timeout  | 10s         | 300s                 |
| Connection    | Direct      | PgBouncer or Prisma Accelerate |

### 17.2 Connection String Parameters

Production connection strings will include pooling parameters:

```
postgresql://user:pass@host:5432/replyiq?pool_min=5&pool_max=20&pool_timeout=30
```

---

## 18. Load Testing (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 18.1 Tool

Artillery or k6 for HTTP load testing.

### 18.2 Planned Test Scenarios

| Scenario                  | Virtual Users | Duration | Target Endpoint      |
|---------------------------|---------------|----------|----------------------|
| Chat widget connect       | 100           | 5 min    | WebSocket /connect   |
| Send message              | 500           | 5 min    | POST /messages       |
| Conversation history      | 200           | 5 min    | GET /conversations   |
| Authentication flow       | 100           | 5 min    | POST /auth/login     |

### 18.3 Performance Targets

| Metric              | Target       |
|---------------------|--------------|
| API response time   | p95 < 500ms  |
| Widget message send | p95 < 300ms  |
| Concurrent users    | 500+         |
| Error rate          | < 1%         |

---

## 19. Security Audit (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 19.1 Audit Checklist

- [ ] Dependency vulnerability scan (`npm audit`)
- [ ] OWASP Top 10 review
- [ ] Authentication flow review
- [ ] Authorization and tenant isolation verification
- [ ] Input validation and sanitization audit
- [ ] SQL injection prevention (Prisma parameterization)
- [ ] XSS prevention (CSP headers, output encoding)
- [ ] CSRF protection verification
- [ ] Rate limiting effectiveness test
- [ ] Secrets management review

### 19.2 Tools

| Tool             | Purpose                           |
|------------------|-----------------------------------|
| npm audit        | Dependency vulnerabilities        |
| OWASP ZAP        | Dynamic application security test |
| Snyk             | Continuous vulnerability scanning |

---

## 20. Domain and HTTPS (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 20.1 Planned Domain Structure

| Subdomain               | Target                   |
|-------------------------|--------------------------|
| app.replyiq.com         | Web dashboard            |
| api.replyiq.com         | API server               |
| widget.replyiq.com      | Widget static files      |
| admin.replyiq.com       | Admin panel (future)     |

### 20.2 SSL/TLS

| Setting             | Value                          |
|---------------------|--------------------------------|
| Certificate         | Let's Encrypt (auto-renew)     |
| Protocol            | TLS 1.3                        |
| HSTS                | Enabled, max-age 31536000      |
| OCSP Stapling       | Enabled                        |

### 20.3 Reverse Proxy (Nginx - Planned)

```nginx
# Planned - API reverse proxy
server {
    listen 443 ssl http2;
    server_name api.replyiq.com;

    ssl_certificate     /etc/letsencrypt/live/api.replyiq.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.replyiq.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 21. Backups (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 21.1 Strategy

| Component     | Backup Method              | Frequency   | Retention  |
|---------------|----------------------------|-------------|------------|
| PostgreSQL    | pg_dump to encrypted storage | Daily       | 30 days    |
| PostgreSQL    | WAL archiving (continuous)  | Continuous  | 7 days     |
| Configuration | Git repository             | On commit   | Indefinite |
| Secrets       | Encrypted vault            | On change   | Indefinite |

### 21.2 Recovery Procedures

| Scenario                    | Procedure                                      | RTO       |
|-----------------------------|-------------------------------------------------|-----------|
| Accidental data deletion    | Restore from daily backup                       | < 1 hour  |
| Database corruption         | Restore from WAL + daily backup                 | < 2 hours |
| Full infrastructure failure | Rebuild from IaC + restore database backup      | < 4 hours |

---

## 22. Scaling (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 22.1 Vertical Scaling

| Resource     | Development | Staging | Production |
|--------------|-------------|---------|------------|
| API CPU      | 1 core      | 2 cores | 4 cores    |
| API Memory   | 512 MB      | 1 GB    | 2 GB       |
| DB CPU       | 1 core      | 2 cores | 4 cores    |
| DB Memory    | 1 GB        | 2 GB    | 8 GB       |

### 22.2 Horizontal Scaling (Future)

| Component  | Strategy                        | Trigger              |
|------------|---------------------------------|----------------------|
| API        | Add replicas behind load balancer | CPU > 70% sustained |
| Web/Widget | CDN caching                     | Traffic volume       |
| Database   | Read replicas                   | Read latency > 200ms |

### 22.3 Auto-Scaling Rules (Planned)

| Metric              | Scale Up Threshold | Scale Down Threshold |
|---------------------|--------------------|----------------------|
| CPU utilization     | > 70% for 5 min    | < 30% for 10 min    |
| Memory utilization  | > 80% for 5 min    | < 40% for 10 min    |
| Request queue depth | > 50 pending       | < 5 pending         |

---

## 23. Rollbacks (Planned)

**Status:** Not yet implemented. Planned for Milestone 8.

### 23.1 Application Rollback

| Strategy           | Trigger                          | Process                        |
|--------------------|----------------------------------|--------------------------------|
| Container rollback | Health check failure post-deploy | Revert to previous image tag   |
| Database rollback  | Migration failure                | `prisma migrate reset` + restore |
| Static asset CDN   | Broken frontend deploy           | Serve previous build version   |

### 23.2 Rollback Procedure

1. Detect failure via health checks or monitoring alerts
2. Pause new deployments
3. Identify last known good version
4. Revert API containers to previous image tag
5. Verify health checks pass on reverted version
6. If database migration was involved, restore from backup
7. Notify team and document incident

### 23.3 Rollback Time Objectives

| Metric            | Target  |
|-------------------|---------|
| Detection time    | < 2 min |
| Decision time     | < 5 min |
| Rollback execution| < 5 min |
| Verification      | < 5 min |
| **Total RTO**     | **< 17 min** |

---

## Appendix A: File Structure

```
replyiq/
  docker-compose.yml                  # PostgreSQL container
  .env                                # Root environment (DATABASE_URL)
  turbo.json                          # Turborepo pipeline config
  apps/
    api/
      .env.example                    # API environment template
      Dockerfile                      # (Planned) Multi-stage build
    web/
      .env.example                    # Web environment template
      Dockerfile                      # (Planned) Multi-stage build
      nginx.conf                      # (Planned) Reverse proxy config
    widget/
      .env.example                    # Widget environment template
  packages/
    database/
      prisma/
        schema.prisma                 # Database schema
        migrations/                   # Migration files
        seed.ts                       # Seed script
  docs/
    product-spec/
      13-INFRASTRUCTURE-DEVOPS.md     # This document
```

## Appendix B: Glossary

| Term           | Definition                                          |
|----------------|-----------------------------------------------------|
| RTO            | Recovery Time Objective - maximum acceptable downtime |
| RPO            | Recovery Point Objective - maximum acceptable data loss |
| Blue-green     | Deployment strategy with two identical environments |
| WAL            | Write-Ahead Log for PostgreSQL continuous archiving |
| HSTS           | HTTP Strict Transport Security                      |
| CDN            | Content Delivery Network                             |
