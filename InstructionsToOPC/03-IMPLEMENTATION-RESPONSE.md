# Response to the Specification Review

> Point-by-point disposition of `01-SPEC-REVIEW.md` and
> `02-RECOMMENDED-CORRECTIONS.md`, with where each landed.
> **Date:** 2026-09-05 · **Full detail:** `docs/CHANGES-2026-09-05.md`

---

## Summary

The review was right about almost everything, and right in a way that mattered:
its central claim — that "detailed and self-contradictory is worse than sparse
and consistent" — was correct, and every contradiction it identified was real.

Of 7 critical issues (B1–B7), 10 high-priority (C1–C10), 8 medium/low (D1–D8),
13 contradictions (X1–X13), 10 missing requirements (F1–F10), and 8 security
findings (H1–H8): **all are now resolved, implemented, or explicitly and
reasonedly declined.** Four are declined; each is explained below rather than
quietly dropped.

The review's most valuable contribution was **B5 / F1** — the observation that
no dev/test verification path existed. It was framed as a testing problem. It is
bigger than that: it was a **product** gap, because a business owner who does
not yet control a domain could not reach the end of the funnel at all. That
reframing produced Test Mode, which is now a shipped, production-available
feature rather than a test hook.

---

## Critical issues (B1–B7)

| # | Issue | Disposition |
|---|---|---|
| B1 | HTML verification specified two ways | **Resolved, both.** One method (`HTML_META`) checks the homepage `<meta>` tag first, then `/.well-known/replyiq-verification.txt`, then the legacy `/replyiq-verification.html`. The review's instinct (meta tag, because non-technical users can paste it) was right; but the two mechanisms are not mutually exclusive, and offering all three under one method costs one extra request on the miss path while covering every kind of hosting. Nothing anyone already published breaks. |
| B2 | DNS record name conflict | **Resolved as recommended.** `_replyiq-verification.{domain}` is canonical and the only name ever shown. `_replyiq-challenge.{domain}` is still accepted so no already-published record breaks. |
| B3 | Token identity/format | **Already correct, now documented.** `replyiq-verify-{UUIDv4}` from a CSPRNG, generated once, never derived from any identifier, never rotated. Never returned in list or detail responses. |
| B4 | Soft vs hard delete | **Resolved: soft.** With a partial unique index over active rows, so a freed name is re-registrable. |
| B5 | No dev/test verification path | **Resolved, and expanded.** Two mechanisms: `SANDBOX` (a product feature, available in production, for IANA-reserved names nobody can own) and `DEV_BYPASS` (CI only, fail-closed, boot-guarded, audited). See §Test Mode below. |
| B6 | No user-facing error copy | **Resolved, and enforced.** A copy table keyed by stable code, plus a contract test that fails the build if the API can emit a code the client has no words for. Additional tests assert no entry contains jargon, a status code, or its own error code. |
| B7 | Domain uniqueness scope ambiguous | **Resolved: global**, over active rows, enforced by a database partial unique index rather than an application check alone. Conflicts return a non-disclosing message. |

---

## Contradictions (X1–X13)

Adopted as recommended: **X2** (record name), **X3** (token), **X4** (soft
delete), **X5** (global uniqueness), **X6** (30-day refresh — the code was
already correct; the docs were wrong), **X7** (two independent status fields),
**X8** (register envelope — the previous decision deferred this to a "breaking
window"; since we control both sides, deferring only extended the papercut),
**X10** (422 for field validation), **X11** (soft revoke).

**X1 — adopted with a change.** Meta tag primary, file placements retained as
equivalent alternatives, rather than discarding them.

**X9 — declined.** The review recommends 768/1024 breakpoints. The
implementation already uses 1024 consistently (`lg:` throughout the sidebar and
layout), and a prior audit settled this deliberately. Changing the spec to
768 would have made the document wrong about working code.

**X12 — declined.** `OWNER/ADMIN/MEMBER/VIEWER` names roles the schema does not
have; it is `OWNER/ADMIN/MANAGER`. A permissions matrix expressed in
non-existent roles cannot be authoritative. Adopting the four-role taxonomy is a
schema migration, not a documentation edit, and should be decided on its merits
in Milestone 4B.

**X13 — resolved.** Domain removal is implemented; the stale flag is corrected.

---

## Test Mode — the answer to B5 / F1

The review proposed `DEV_BYPASS` with a fail-closed environment gate. That is
implemented, exactly as specified, plus two hardenings:

1. **Indistinguishability is structural, not maintained.** The review asks that
   `DEV_BYPASS` in production respond identically to an unknown enum value. The
   obvious implementation — accept it, then reject it with a hand-crafted error
   mimicking a validation failure — is a thing that can be got subtly wrong and
   must be re-verified after every refactor. Instead the boot gate decides
   *what the accepted set is*, and the DTO validates against it. In production
   `DEV_BYPASS` is not a method that gets rejected; it is not a method, and it
   is refused by the same ValidationPipe, on the same line, with the same body,
   as `HAMSTER`.
2. **A production server with the bypass enabled refuses to boot.** Failing
   closed is not enough on its own — a misconfiguration should be loud at deploy
   time, not silently correct forever.

Beyond that, `SANDBOX`: reserved test domains (`*.test`, `*.example`,
`example.com`, `*.invalid`, `*.localhost`, `*.local`, `*.internal`) verify
instantly **in production**. This is safe not because we trust the caller but
because those names cannot be registered by anyone — there is no owner to harm.
It cannot be used on a real domain, in any environment, with any credential.

---

## Security findings (H1–H8)

| # | Finding | Disposition |
|---|---|---|
| H1 | RBAC documented but unenforced | **Resolved.** `RolesGuard` and `OrganizationGuard` are wired on every business, domain and onboarding controller, expressed in the three roles that exist. |
| H2 | Organization scoping service-level only | **Resolved.** Guard at the perimeter, service check in depth. Cross-tenant access returns *not found*, not *forbidden*. Covered per-operation by integration tests. |
| H3 | SSRF in the website fetch | **Resolved, beyond the recommendation.** Hostname validation before any I/O; every resolved A/AAAA record checked against private, loopback, link-local and reserved ranges (one bad address fails the whole answer, since an attacker controlling the zone can return both); the connection **pinned to the validated address**, closing DNS rebinding rather than merely narrowing it; manual redirect following with per-hop revalidation; 512 KB body cap enforced while streaming; 8-second budget; no failure reason ever reflected. Additionally HTTPS is now attempted before HTTP — the previous plaintext-only fetch was a downgrade by default. |
| H4 | No rate limit on add/verify | **Resolved, keyed on the organization** rather than the IP, at the recommended 10/hr and 20/hr. Per-IP is the wrong boundary: the tenant controls its own IP, while a shared office NAT would penalise unrelated tenants. |
| H5 | Conflict message enumeration | **Resolved.** Uniform, non-confirming. |
| H6 | Token entropy | **Already correct.** |
| H7 | Bypass isolation | **Resolved** — see above. |
| H8 | Audit logging | **Resolved for this surface.** Append-only log of every domain and onboarding lifecycle event, with the bypass as its own distinct event. Writes never fail the user's request; the token is never recorded. |

---

## Missing requirements (F1–F10)

All ten addressed. F1 (test path) → Test Mode. F2 (error copy) → the copy
contract. F3 (delete confirmation) → two-level, with a typed confirmation for
the last verified domain **and** an acknowledgement enforced on the API so the
safety survives outside the UI. F4 (post-completion policy) → derived service
mode (`LIVE`/`TEST`/`INACTIVE`); completion is never reverted. F5 (back
navigation) → clickable step rail. F6 (websiteUrl → domain) → pre-filled once,
independent thereafter, and the settings field now says so. F7 (primary domain)
→ recorded as a binding forward requirement on the widget milestone. F8 (no
domain editing) → stated explicitly, with the reason. F9, F10 → see H4, H3.

---

## Where the review was superseded by better information

Three of its recommendations rested on assumptions that inspection disproved:

- **The 7-day refresh token** did not exist; the code has always used 30 days.
  The docs were wrong, not the implementation.
- **`OWNER/ADMIN/MEMBER/VIEWER`** does not exist in the schema.
- **The 768px breakpoint** contradicts working code.

And one of its findings was more serious than it appeared. B5 was written as a
testing concern. Treated as one, it would have produced a bypass and nothing
else. Treated as a product concern, it produced a feature that lets a prospect
evaluate the entire product without owning a domain — which is worth more than
the test convenience that prompted it.

---

## Bugs found while implementing, that the review did not identify

Included because a review is judged partly by what it misses:

| Bug | Impact |
|---|---|
| `resolveTxt` results joined across records before comparison | A correctly published TXT record failed whenever any second TXT record existed at the same name — routine during a DNS provider migration |
| Sign-out sent no `Authorization` header | Logout was rejected as unauthenticated, so the session was never revoked. "Sign out" only cleared the browser, and a stolen refresh token kept working for up to 30 days |
| Website fetch was `http://` only | A downgrade by default, and a hard failure on HTTPS-only sites |
| Hostname pattern allowed single-label strings | `com` was a valid domain and could take a global uniqueness claim on a bare TLD |
| The existing test-fixture hook could never work | It substituted a hostname that then had to survive the SSRF guard, which correctly rejects loopback |
| Seed addressed `businessDomain.upsert` by `domain` | Stopped being a unique input when the partial index replaced the full one |
| 64 KB response cap | Truncated real homepages before reaching a meta tag late in a large `<head>` |
| A 500 carried no error `code` | The client lost the one thing worth saying — that the user did not cause it. Found by the new contract test |

---

## What to read next

| For | Read |
|---|---|
| The goals and requirements | `docs/product-spec/01-PRODUCT-REQUIREMENTS.md` |
| Exactly how verification works | `docs/product-spec/16-DOMAIN-VERIFICATION-AND-TEST-MODE.md` |
| The flow in plain language | `docs/product-spec/17-END-TO-END-FLOW.md` |
| What changed and what verifies it | `docs/CHANGES-2026-09-05.md` |
| Release gates and edge cases | `docs/product-spec/14-QA-ACCEPTANCE-DOD.md` §12 |
