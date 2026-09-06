# ReplyIQ — start here

An AI receptionist for small businesses. A business proves it owns a website,
we read that website into a knowledge base, and a widget on their site answers
visitors' questions **using only what they published**.

This file is the entry point for anyone — human or AI — picking the project up.
Read it before changing anything; several rules below look like preferences and
are actually load-bearing.

---

## Run it

```bash
pnpm install
docker compose up -d postgres              # required for the app and integration tests
cd packages/database && npx prisma migrate deploy && npx prisma generate
pnpm dev                                   # api :3000, web :5173
```

| Command | Notes |
|---|---|
| `npx turbo typecheck lint build test` | The gate. Everything must pass. |
| `npx vitest run --config vitest.integration.config.ts` | In `apps/api`. Needs Postgres. |

**Windows gotcha:** `prisma generate` fails with `EPERM ... query_engine-windows.dll.node`
if the API dev server is running — it holds the DLL open. Stop the dev server,
then build. This looks like a broken build and is not one.

---

## The rules that are load-bearing

Break any of these and the product stops being the thing it is.

**1. The receptionist never invents.**
Every answer is a passage the owner published, returned verbatim, or an honest
"I don't know". A confidently wrong answer costs a real business a real
customer, and the owner hears about it from them rather than from us. This is
also the differentiator — see `docs/product-spec/18-DIFFERENTIATION.md`.

Retrieval is a three-rung ladder in `receptionist.service.ts`: all terms
(confident) → any term (hedged) → previous question folded in (hedged). Anything
below the top rung is *always* offered with a hedge, however high it scored.
Never fold context into the primary query — it lets a stale question hijack a
clear one, and there are tests that fail if you try.

**2. Backend prose never reaches the screen.**
The API returns stable codes; `apps/web/src/api/error-copy.ts` maps them to
reviewed copy. A test fails if you add an `ErrorCode` without copy. Field
validation follows the same rule: 422 responses carry constraint *names*
(`maxLength`), not sentences.

**3. The public widget endpoint is guarded by verified domains, not by a secret.**
`/api/v1/receptionist/*` is unauthenticated. The `Origin` header is checked
against domains the business proved it controls. Origin cannot be forged by
page JavaScript — which is the attack that matters — and is trivially forged by
curl, so it is never treated as a secret. Nothing confidential belongs in a
knowledge base.
CORS is `*` on those routes *because* CORS is not the boundary there.

**4. Test Mode is a real mode, not a flag.**
A business whose verified domains are all IANA-reserved test namespaces is
`TEST`: the widget says so to the visitor, and `localhost` origins are accepted.
A `LIVE` business never accepts localhost. See
`docs/product-spec/16-DOMAIN-VERIFICATION-AND-TEST-MODE.md`.

**5. Dark theme works by redefining tokens, not by `dark:` variants.**
`index.css` overrides the `--color-*` variables under `[data-theme='dark']`, so
every component follows automatically and a new one cannot forget. Two traps,
both already paid for:
- Solid fills that carry white text use `--color-brand-fill*`, which barely
  moves between themes. The numbered ramp is role-preserving, not
  lightness-ordered — lightening `brand-600` for dark broke button contrast.
- Do **not** put a CSS transition on `body`'s colour. Chromium freezes a
  transitioned property when its value comes from a custom property, and the
  page stays light while everything else goes dark.

**6. Never send `Content-Type` on a request with no body.**
Fastify rejects it before the route runs. `apps/web/src/api/client.ts` only sets
it when there is a body, with a regression test. A server-side workaround was
tried and reverted.

**7. Visitor questions are other people's data.**
`receptionist_questions` stores the question, the confidence, and an ephemeral
per-visit key. No IP, no user agent, no cookie, nothing identifying. Keep it
that way.

---

## Where the truth lives

| Question | File |
|---|---|
| What is built, what is next | `docs/PROJECT_STATUS.md` |
| Why a thing is the way it is | The commit message. They are detailed on purpose. |
| Product goals and requirements | `docs/product-spec/01-PRODUCT-REQUIREMENTS.md` |
| Domain verification + Test Mode | `docs/product-spec/16-…md` |
| What makes this different | `docs/product-spec/18-DIFFERENTIATION.md` |
| Known UX debt | `docs/UX-FINDINGS-2026-09-06.md` |
| Deploying | `docs/DEPLOYMENT.md` |

Older files under `docs/product-spec/` are **specifications written before
implementation**. Where a spec and the code disagree, the code and its commit
message are the truth — `11-WIDGET-SPECIFICATION.md` in particular predates the
widget that actually shipped.

---

## How this codebase expects to be worked on

- **Verify by driving the real thing.** Almost every serious bug found here
  passed typecheck, lint and tests first: HTTPS verification silently broken for
  every site, the session key dropped so nothing was logged, a 200 response that
  rendered nothing, a `<datalist>` that never rendered. Run it and look.
- **Mutation-test anything subtle.** If a test guards a real property, break the
  property and confirm the test fails. Several here were verified that way.
- **Comments explain why, not what.** Especially where something looks wrong and
  is deliberate.
- **The gate is not optional.** `typecheck lint build test`, plus the integration
  suite when touching persistence, the receptionist, or verification.
