# ReplyIQ — project status

**Last updated:** 2026-10-10

The current state of the product: what works, what does not exist yet, what has
been decided, and the operational facts that are not visible in the code.

Read `CLAUDE.md` at the repo root first — it carries the rules that are
load-bearing — then `STRATEGY.md`, which is now the highest-level document and
says what we are trying to achieve and in what order.

---

## What works today

The whole loop runs end to end, verified in a browser rather than only in tests.

1. **Sign up and onboard** — workspace provisioning, business profile.
2. **Verify a website** — DNS TXT, an HTML snippet, or Test Mode against an
   IANA-reserved namespace. Website verification works over real HTTPS.
3. **Knowledge** — the verified site is crawled into an editable knowledge base,
   or the owner writes answers by hand. Postgres full-text search over both.
4. **The receptionist answers** — a 4.9kB embeddable widget, Shadow-DOM
   isolated, grounded in the owner's own words, hedging when unsure and
   admitting ignorance when it does not know.
5. **It captures the ones it cannot answer** — an honest "I don't know" offers
   to take the visitor's number. The lead is stored with the question attached
   and the owner is emailed, so they can ring back knowing what it is about.
   Test-mode leads are kept, labelled, and excluded from every count.
6. **The owner sees the gaps** — every visitor question is recorded with its
   confidence; unanswered ones are surfaced with repeats counted, and one click
   opens the add-answer dialog with the question already filled in.
7. **The owner judges the answers** — every answered question is shown with
   the knowledge item that produced it, and can be marked good or wrong.
   Marking one wrong links straight to that item to fix it. This is the only
   way the product ever learns it got something wrong, and the only input to
   the accuracy target in `STRATEGY.md` §5.
8. **A public front page** with the real widget answering on it, and link
   metadata and an image so the URL previews when it is shared.

**Password reset** exists (token, single-use, 30-minute expiry, revokes every
session). **Dark theme**, field-level validation errors, and a bento dashboard
are in. Contrast was measured, not eyeballed: every text/background pair clears
WCAG AA in both themes.

Visits are read as conversations, not as a list of questions: the turns in
order, what the visitor was shown including the hedge, and the passage each
answer came from. Not linked to enquiries, on purpose — see CLAUDE.md rule 7.

The dashboard answers "is this getting better?": each window of questions is
compared against the one immediately before it, and the comparison is withheld
whenever a single flipped question could explain it. See `trend.ts`.

670 tests: 358 API unit, 211 web, 101 integration against a real database.
The gate (`npx turbo typecheck lint build test`) is green at 29/29, and the
integration suite has been run.

## What does not exist yet

- **Billing.** Nothing. Decided but unbuilt — see below.
- **An LLM.** The answer engine is retrieval-only behind an `AnswerEngine`
  interface. This is a deliberate choice, not a gap: it costs nothing per
  conversation and cannot hallucinate. A model would improve phrasing, not
  truth, and would receive the same passages.
- **Appointment booking, email/SMS channels, team seats.** All in the older
  specs, none built.

## Decisions taken (2026-09-06)

| Decision | Choice | Why |
|---|---|---|
| Market | **India first** | Razorpay, ₹, Indian GST invoicing, no FEMA or multi-country VAT. International stays open. |
| Pricing model | **Per verified website, flat monthly** | Predictable for a small business, matches the unit the product is built on, and does not bill owners for honest "I don't know" answers. |
| Free tier | Undecided — leaning free-with-badge | Marginal cost per conversation is ~zero, so free installs are cheap distribution. |
| Payment provider | Pending — Razorpay expected | Follows from India-first. Build against test mode; live keys only when there is a customer. |
| Answer engine | Provider-agnostic, retrieval default | No API key, no per-conversation cost, no hallucination. Swappable later. |

Indicative pricing, not yet committed: free (1 site, ~50 conversations, badge),
~₹1,200/mo (1 site, 1,000 conversations), ~₹3,500/mo (5 sites, 5,000).
Competitors sit at $50–150/mo with a real per-message cost we do not have.

## ⚠️ Production is down — and the fix is prepared (2026-10-25)

Down since 2026-10-10. `replyiq-api.onrender.com` accepts a TCP connection and
never responds; the static web service is fine because it needs nothing.

**Cause:** Render's free Postgres is deleted 30 days after creation. The API's
start command runs `prisma migrate deploy` *before* `node main.js`, so a
database it cannot reach means the process never starts. Ruled out: the
deployed commit — the same build boots locally in ~8s with every route mapped.

**The fix is already in the repo.** The database moves to Neon's free plan,
which is permanent, needs no card, and does not delete data at a limit. The
schema now declares `directUrl`, `render.yaml` no longer provisions a managed
database, and the whole path has been rehearsed against an empty database —
all 11 migrations apply and all 13 tables build from scratch.

**What remains is ~5 minutes of dashboard work that only the account owner can
do:** create the Neon project and paste two connection strings into Render.
Step by step in `MIGRATE-TO-NEON.md`.

**The old data is gone.** Render deleted it and the free plan had no backups.
Nothing to migrate.

## Operational facts

- **Deployed on Render** from `gaddamjanareddy/replyiq`, branch
  `feat/domain-verification-test-mode`. Both services auto-deploy on push.
  - API: `https://replyiq-api.onrender.com`
  - Web: `https://replyiq-web.onrender.com`
- ⚠️ **The free Postgres expires 30 days after creation (early October 2026)**,
  with a 14-day grace period to upgrade while keeping data. After that Render
  deletes it. There are no backups on the free plan — `scripts/backup-db.sh`
  exists and should be run.
- **Email is live** via Resend (`EMAIL_TRANSPORT=resend`,
  `EMAIL_FROM=onboarding@resend.dev`). On the shared sender, Resend delivers
  **only to the account owner's address**; any other recipient gets a 403.
  Real customer email needs either a verified sending domain or
  `EMAIL_TRANSPORT=smtp`, which needs no domain and is already implemented.
- **Upstream PR** `smartfindshub/replyiq#1` is open and cannot be merged by the
  fork owner (read-only upstream). The fork's `main` is kept identical to the
  feature branch, so production is never behind.

## Next

1. **Razorpay billing against test mode.** Decided and unstarted. Needs an
   account the owner holds; no live keys and no real money until there is a
   customer.
2. **The production demo** — a business with `replyiq-web.onrender.com`
   verified and `VITE_DEMO_BUSINESS_ID` set in Render, or the front page's
   demo widget simply does not render.
3. **Week-on-week trends**, so the owner can see whether it is improving.

Known debt is tracked in `UX-FINDINGS-2026-09-06.md` — all five original
findings are closed.
