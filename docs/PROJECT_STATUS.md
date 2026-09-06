# ReplyIQ — project status

**Last updated:** 2026-09-06

The current state of the product: what works, what does not exist yet, what has
been decided, and the operational facts that are not visible in the code.

Read `CLAUDE.md` at the repo root first — it carries the rules that are
load-bearing.

---

## What works today

The whole loop runs end to end, verified in a browser rather than only in tests.

1. **Sign up and onboard** — workspace provisioning, business profile.
2. **Verify a website** — DNS TXT, an HTML snippet, or Test Mode against an
   IANA-reserved namespace. Website verification works over real HTTPS.
3. **Knowledge** — the verified site is crawled into an editable knowledge base,
   or the owner writes answers by hand. Postgres full-text search over both.
4. **The receptionist answers** — a 3.7kB embeddable widget, Shadow-DOM
   isolated, grounded in the owner's own words, hedging when unsure and
   admitting ignorance when it does not know.
5. **The owner sees the gaps** — every visitor question is recorded with its
   confidence; unanswered ones are surfaced as work, with repeats counted.

**Password reset** exists (token, single-use, 30-minute expiry, revokes every
session). **Dark theme**, field-level validation errors, and a bento dashboard
are in. Contrast was measured, not eyeballed: every text/background pair clears
WCAG AA in both themes.

~535 tests: ~295 API unit, ~188 web, ~52 integration against a real database.

## What does not exist yet

- **Billing.** Nothing. Decided but unbuilt — see below.
- **A public landing page.** There is no marketing site and no demo to send
  anyone. This is the next build.
- **An LLM.** The answer engine is retrieval-only behind an `AnswerEngine`
  interface. This is a deliberate choice, not a gap: it costs nothing per
  conversation and cannot hallucinate. A model would improve phrasing, not
  truth, and would receive the same passages.
- **Appointment booking, email/SMS channels, team seats.** All in the older
  specs, none built.
- **Conversation transcripts.** Questions are logged individually; there is no
  threaded view.

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

1. Public landing page with a live demo of the receptionist answering questions
   about ReplyIQ itself. For this product the demo is the pitch.
2. Razorpay billing against test mode.
3. Remaining polish: hierarchy pass is done, page-level motion is thin.

Known debt is tracked in `UX-FINDINGS-2026-09-06.md` — all five original
findings are closed.
