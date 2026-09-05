# ReplyIQ

AI Employee Platform — building intelligent AI employees that work alongside your team.

## Overview

ReplyIQ is a platform for creating, deploying, and managing AI Employees. The first AI Employee is an AI Receptionist that handles customer interactions with human-like quality.

## Folder Structure

```
replyiq/
├── apps/
│   ├── api/          # Backend API (NestJS)
│   ├── web/          # Dashboard (React + Vite)
│   └── widget/       # Embeddable website widget
├── packages/
│   ├── ai-sdk/       # AI provider integrations
│   ├── config/       # Shared configuration (ESLint, Prettier, TSConfig)
│   ├── types/        # Shared TypeScript types
│   ├── ui/           # Shared UI component library
│   └── utils/        # Shared utilities
├── docs/             # Documentation
├── turbo.json        # Turborepo configuration
└── tsconfig.base.json
```

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Frontend     | React 19, Vite 6, TypeScript        |
| Routing      | React Router v7                     |
| Backend      | NestJS 11, Fastify 5, TypeScript    |
| Database     | PostgreSQL 17, Prisma 6             |
| Styling      | TailwindCSS v4                      |
| Client State | Zustand                             |
| Server State | TanStack Query v5                   |
| Forms        | Controlled components + `useState`  |
| Validation   | Zod, class-validator                |
| Monorepo     | Turborepo + pnpm                    |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) 11.13.0+ (enforced by the `packageManager` field via corepack)
- [Docker](https://www.docker.com/) for the local PostgreSQL instance

### Installation

```bash
pnpm install
cp .env.example .env          # every variable has a working local default
docker compose up -d postgres
pnpm --filter @replyiq/database exec prisma migrate deploy
pnpm --filter @replyiq/database exec prisma db seed
```

The seed creates a workspace with one live domain and one **test-mode** domain,
so the sandbox verification path is exercisable immediately.

### Development

```bash
# Start all apps in development mode
pnpm dev

# Start a specific app
pnpm --filter @replyiq/api dev
pnpm --filter @replyiq/web dev
pnpm --filter @replyiq/widget dev
```

### Build

```bash
# Build all packages and apps
pnpm build
```

### Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Format all files
pnpm format

# Check formatting
pnpm format:check

# Typecheck all packages
pnpm typecheck
```

### Testing

```bash
pnpm --filter @replyiq/api test              # unit — no database needed
pnpm --filter @replyiq/web test              # unit
pnpm --filter @replyiq/api test:integration  # needs PostgreSQL (see Installation)
```

The integration suite runs against an isolated `replyiq_test` database that it
migrates and purges itself; it never touches your development data.

### Trying it without a domain

You do not need to own a domain to walk through the whole product. Add a
website address ending in `.example.com`, `.test`, `.invalid` or `.localhost` —
these are reserved by IANA and cannot be registered by anyone — and it verifies
instantly in **test mode**, in any environment including production.

This is a real product feature, not a developer shortcut: `SANDBOX` verification
is refused for any real domain, everywhere, with any credentials. See
[`docs/product-spec/16-DOMAIN-VERIFICATION-AND-TEST-MODE.md`](docs/product-spec/16-DOMAIN-VERIFICATION-AND-TEST-MODE.md).

For CI, a separate `DEV_BYPASS` method verifies arbitrary domains. It is
gated on `NODE_ENV != production` **and** `ALLOW_DEV_VERIFICATION_BYPASS=true`,
resolved once at boot; in production it is not a valid method at all, and a
production server started with it enabled **refuses to boot**.

### Clean

```bash
# Remove all build artifacts and node_modules
pnpm clean
```

## Documentation

Start at [`docs/product-spec/00-MASTER-INDEX.md`](docs/product-spec/00-MASTER-INDEX.md).

| If you want | Read |
|---|---|
| The whole flow in plain language, in ten minutes | [`17-END-TO-END-FLOW.md`](docs/product-spec/17-END-TO-END-FLOW.md) |
| What we're building and why | [`01-PRODUCT-REQUIREMENTS.md`](docs/product-spec/01-PRODUCT-REQUIREMENTS.md) |
| How domain verification and test mode work | [`16-DOMAIN-VERIFICATION-AND-TEST-MODE.md`](docs/product-spec/16-DOMAIN-VERIFICATION-AND-TEST-MODE.md) |
| What changed most recently, and why | [`CHANGES-2026-09-05.md`](docs/CHANGES-2026-09-05.md) |

## License

Private — All rights reserved.
