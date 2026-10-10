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

620 tests: 347 API unit, 198 web, 78 integration against a real database.
The gate (`npx turbo typecheck lint build test`) is green at 29/29, and the
integration suite has been run.

## What does not exist yet

- **Billing.** Nothing. Decided but unbuilt — see below.
- **Conversation transcripts.** Questions are logged individually.
- **A trend over time.** The numbers are 30-day totals with nothing to compare
  them against, so "is this getting better?" is unanswerable.
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

## ⚠️ Production is down (2026-10-10)

`https://replyiq-api.onrender.com` accepts a TCP connection and never
responds — three attempts at 90s, 120s and 280s. The static web service is
fine, because it needs nothing.

**Most likely the free Postgres has expired.** It was created in early
September with a 30-day life, which lands exactly here, and the API's start
command is:

```
(cd packages/database && npx prisma migrate deploy) && node apps/api/dist/src/main.js
```

If `migrate deploy` cannot reach the database it exits non-zero, the `&&`
short-circuits, and the process never starts. That matches the symptom
precisely: Render's router answers, nothing behind it does.

**Ruled out:** the deployed commit. The same build boots locally in ~8s
against a local Postgres with every route mapped, including the new ones, and
the whole gate plus 70 integration tests pass.

**To fix** — this costs money, so it is the owner's call: upgrade the database
in the Render dashboard. There is a 14-day grace period from expiry during
which upgrading **keeps the data**; after that Render deletes it, and there
are no backups on the free plan. If the data is already gone, `scripts/
backup-db.sh` exists for next time and the schema rebuilds itself from the
migrations on first boot.

Check the Render logs for the API service to confirm before paying — if the
tail shows `P1001: Can't reach database server`, that is this.

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
