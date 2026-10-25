# Moving the database to Neon

**Why:** Render's free PostgreSQL is deleted 30 days after it is created, with
no backups. That is what took production down on 2026-10-10 — the database
expired, and because the API's start command runs `prisma migrate deploy`
*before* `node main.js`, a database it cannot reach means the service never
boots at all. A free tier with an expiry date is a scheduled outage.

[Neon's free plan](https://neon.com/pricing) is **permanent, not a trial**,
needs **no credit card**, and states plainly that reaching a limit does not
delete your data. 1 GB per project, 20 GB per account, 100 CU-hours a month.

Everything in the repo is already prepared. Your part is about five minutes.

---

## What you do

### 1. Create the database (≈2 min)

1. Sign up at **neon.com** — GitHub sign-in works, no card.
2. Create a project. **Choose the region nearest your Render service.** Render
   is currently in Oregon (`render.yaml`), so pick a US West region; a database
   in Singapore with an API in Oregon adds ~200 ms to every query.
3. Postgres 17, to match what the app ran on.

### 2. Copy two connection strings (≈1 min)

On the project dashboard, **Connect** gives you a connection string with a
toggle for **connection pooling**.

- **Pooled** (the host contains `-pooler`) → this is `DATABASE_URL`
- **Direct** (pooling toggled off) → this is `DIRECT_DATABASE_URL`

Both must end with `?sslmode=require`. Neon refuses plaintext connections.

> **Why two.** The app should use the pooler — serverless Postgres gives each
> connection real weight and Prisma opens several. `prisma migrate` must not:
> it takes session-level advisory locks that PgBouncer's transaction mode
> cannot carry, so a migration through the pooled URL fails, or half-applies,
> which is worse. The schema already declares `directUrl` for this.

### 3. Set them in Render (≈1 min)

**replyiq-api → Environment**, add both:

| Key | Value |
|---|---|
| `DATABASE_URL` | the **pooled** Neon string |
| `DIRECT_DATABASE_URL` | the **direct** Neon string |

If an old `DATABASE_URL` is there from the managed database, replace it.

### 4. Deploy

Trigger a deploy (or push anything). On boot the start command runs
`prisma migrate deploy`, which applies all 11 migrations to the empty Neon
database and creates the schema from scratch. Then the API starts.

Confirm:

```bash
curl https://replyiq-api.onrender.com/api/v1/health
```

Expect `{"status":"ok","service":"replyiq-api","version":"0.1.0"}`. The first
request after idle is slow twice over — Render's free instance cold-starts
(~50 s) and Neon resumes from zero (~1 s). That is normal and only affects the
first request.

### 5. Sign up again

**The old data is gone** — Render deleted it, and there were no backups. There
is nothing to migrate, which is the one upside: nothing to go wrong. Create
your account again, verify a domain, and the product is back.

---

## What was already changed for you

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | `directUrl` added to the datasource |
| `apps/api/src/config/env.validation.ts` | `DIRECT_DATABASE_URL` accepted (optional) |
| `render.yaml` | managed database removed; both URLs are now dashboard secrets |
| `.env.example`, local `.env` files | `DIRECT_DATABASE_URL` added, same value as `DATABASE_URL` |

Locally nothing changes: there is no pooler in front of a Docker Postgres, so
both variables hold the same string.

---

## Afterwards

- **Back it up.** `scripts/backup-db.sh` takes a URL; point it at the direct
  Neon string. Neon's free plan has point-in-time restore measured in hours,
  not days, so an occasional dump somewhere else is still worth having.
- **Watch the 100 CU-hours.** Compute scales to zero after ~5 minutes idle, so
  a product with little traffic uses very little. Running out suspends compute
  until the next month; it does **not** delete anything.
- **Render's free web service still sleeps** after 15 minutes. That is a
  separate problem from the database, and it is the thing that would have to
  change before voice or telephony — a phone call cannot wait 50 seconds for a
  cold start.
