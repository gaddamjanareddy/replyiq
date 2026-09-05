# ReplyIQ — Domain Verification and Test Mode

> The complete specification for proving a business owns a website, and for
> exercising that system without owning one.

> **Status:** Approved
> **Last Updated:** 2026-09-05
> **Owner:** Product & Engineering
> **Authority:** This document is authoritative for every mechanism, record
> format, outcome, eligibility rule and security control in domain verification.
> Where `01-PRODUCT-REQUIREMENTS.md` states *what must be true*, this states
> *how*. Where `09-API-SPECIFICATION.md` shows request/response shapes, this
> defines the behaviour those shapes describe.

---

## 1. Why This Document Exists

Domain verification is the smallest feature in ReplyIQ with the largest blast
radius. It is:

- **The gate on onboarding.** Nothing downstream happens without it.
- **The trust boundary for the widget.** A verified domain is a claim that "this
  business speaks for this website". Getting it wrong means one tenant's AI
  answering on another tenant's site.
- **The only place the server makes an outbound request to an address a user
  chose.** That is textbook SSRF surface.
- **The step most likely to strand a new user**, because it depends on DNS
  propagation and site access — two things the product cannot control and the
  user often cannot either.

Earlier drafts of this specification contained two mutually exclusive
descriptions of the website method, two different DNS record names, and no way
to test any of it. This document resolves all of that and adds the missing half:
a way to exercise the whole system, in production, that gives away nothing.

---

## 2. The Shape of the Solution

There are **three ways to prove a domain**, plus **one developer affordance**.
They are separate methods with separate rules. None of them is a mode or a flag
on another.

| Method | Who it is for | Proof required | Where it works |
|---|---|---|---|
| `DNS_TXT` | Whoever controls the domain's DNS | A TXT record only the domain's operator can publish | Everywhere |
| `HTML_META` | Whoever controls the website's content | A snippet or file only the site's operator can publish | Everywhere |
| `SANDBOX` | Whoever controls **neither**, yet | None — but only for names nobody can ever own | Everywhere, **including production** |
| `DEV_BYPASS` | CI pipelines and local development | None | Non-production only, fails closed |

The insight that makes `SANDBOX` safe is not a permission check. It is that the
set of domains it accepts is the set of domains that **cannot be owned by
anyone**. Verifying `acme.example.com` grants a claim over a name IANA has
permanently reserved against registration. There is no victim, because there is
no owner and there can never be one.

That is why Test Mode can ship to production without a caveat, and why it is a
product feature rather than a testing hack.

---

## 3. The Verification Token

| Property | Value |
|---|---|
| Format | `replyiq-verify-{UUIDv4}` |
| Source | `crypto.randomUUID()` (CSPRNG) |
| Generated | Once, at domain creation |
| Mutable | Never — not on retry, not on method switch, not on failure |
| Derived from | Nothing. Not the domain ID, not the business ID, not the hostname |
| Exposed in | The verification-instructions endpoint only. Never in domain list or detail responses |

**Why immutable.** A user who adds a DNS record, waits for propagation, and
comes back the next day must find the record they published still being asked
for. Rotating a token on failure is the single most effective way to make a
verification flow unusable, and several well-known products have shipped that
bug.

**Why not the domain ID.** An identifier that appears in URLs is not a secret.
Reusing it as the challenge value leaks an internal identifier into a public DNS
zone and gives the challenge no entropy of its own. The real security still
rests on control of DNS or the site — but a challenge value should not be
guessable from data the requester already has.

---

## 4. Method: `DNS_TXT`

### 4.1 What the user does

Publish a TXT record:

```
Name:  _replyiq-verification.{domain}
Value: replyiq-verify-{token}
TTL:   whatever the provider defaults to
```

### 4.2 What the server does

1. Resolve TXT for `_replyiq-verification.{domain}`.
2. If that name does not resolve, resolve TXT for the legacy name
   `_replyiq-challenge.{domain}`.
3. For each returned record independently, join its character-string chunks
   (DNS splits strings over 255 bytes), strip surrounding quotes and whitespace,
   and compare to the token.
4. Additionally compare the concatenation of all chunks across all records, to
   tolerate providers that split a value across records.

**Why per-record and not one big join.** A name can legitimately hold several
TXT records — during a provider migration, for example. Concatenating all of
them and comparing once means a correctly published record fails whenever a
second unrelated record exists. The original implementation had this bug.

### 4.3 Legacy name

`_replyiq-challenge.{domain}` is accepted and never shown. It exists because an
earlier build instructed users to publish it. Instructions always show
`_replyiq-verification`, which matches the meta tag's attribute name so the two
methods read as one system.

### 4.4 Outcomes

| Condition | Outcome | Code |
|---|---|---|
| A record matches the token | VERIFIED | — |
| Name resolves, no record matches | MISMATCH (400) | `DOMAIN_VERIFICATION_MISMATCH` |
| Name does not resolve (NXDOMAIN, SERVFAIL, timeout) | PENDING (200) | `DOMAIN_VERIFICATION_PENDING` |

---

## 5. Method: `HTML_META`

### 5.1 What the user does

Any **one** of these. They are equivalent — the first one found wins.

| Placement | Content |
|---|---|
| Homepage `<head>` | `<meta name="replyiq-verification" content="replyiq-verify-{token}">` |
| `/.well-known/replyiq-verification.txt` | The token, alone, as the file body |
| `/replyiq-verification.html` | The token, alone, as the file body (legacy `replyiq-verify:{token}` also accepted) |

**Why three placements under one method.** The user's problem is "prove you
control this site", and the answer differs by hosting. A CMS user has a "header
scripts" box and no filesystem. A static-site user has a filesystem and no
header box. A user on a locked-down platform may have only `/.well-known/`.
Splitting these into three methods would force the user to diagnose their own
hosting before choosing; offering them as one method with three routes lets them
use whichever they can reach. This mirrors how the category leader
([Google Search Console](https://developers.google.com/search/docs/monitoring-debugging/verifying-your-site))
solves the same problem, minus the requirement to download a per-user file.

### 5.2 What the server does

Under a single 8-second budget for the whole operation:

1. Validate the hostname (§7.1). Reject IP literals and non-public names before
   any network activity.
2. Resolve A and AAAA. Every returned address must be public (§7.2). Pin the
   connection to one validated address.
3. `GET https://{domain}/` with the real `Host` header. On connection failure,
   retry once over `http://`.
4. Read at most 512 KB. Scan for a `<meta>` whose `name` is
   `replyiq-verification` (case-insensitive, attribute-order-agnostic,
   quote-style-agnostic).
5. If no such meta exists, `GET /.well-known/replyiq-verification.txt`, then
   `GET /replyiq-verification.html`. Each is subject to the same hop rules.
6. Compare the extracted value to the token.

### 5.3 Why HTTPS first

The original implementation fetched `http://` only. That is a downgrade by
default: it invites a network attacker to answer on behalf of a site that is
otherwise HTTPS-only, and it fails outright on sites that reject plaintext.
HTTPS-first with an HTTP fallback is strictly safer and strictly more
compatible. Certificate validation is left at Node's default (enforced) — an
invalid certificate means we do not trust the response.

### 5.4 Outcomes

| Condition | Outcome | Code |
|---|---|---|
| A placement contains the token | VERIFIED | — |
| A placement exists but holds a different value | MISMATCH (400) | `DOMAIN_VERIFICATION_MISMATCH` |
| Nothing found; site reachable | PENDING (200) | `DOMAIN_VERIFICATION_PENDING` |
| Site unreachable, times out, TLS fails, returns 5xx | PENDING (200) | `DOMAIN_VERIFICATION_PENDING` |
| SSRF policy refusal after DNS resolution | PENDING (200) | `DOMAIN_VERIFICATION_PENDING` |

The last row is deliberate. Telling a caller "your domain resolves to a private
address" confirms the existence and network position of an internal host. It
collapses into the same "not found yet" the caller already sees, and the real
reason is logged server-side.

The row above it is also deliberate: a 5xx or a timeout is the site's problem,
not the user's mistake, and calling it a failure would send the user hunting for
a typo that is not there.

---

## 6. Method: `SANDBOX` — Test Mode

### 6.1 The user-facing story

> "I want to see how this works before I involve my web developer."
> "I'm evaluating you and I'm not putting a DNS record in for a trial."
> "I'm building the integration and the real domain isn't provisioned yet."

All three get the same answer: add a test domain, click verify, done in two
seconds. Everything downstream — the wizard, the dashboard, later the widget
preview — behaves exactly as it will in production, because it *is* production.
The only difference is a "Test" badge and a banner telling them how to go live.

This is the [Stripe test-mode](https://docs.stripe.com/test-mode) pattern applied
to domain ownership: a real, first-class, permanently available parallel path
with visibly different identifiers, rather than a special build or a support
request.

### 6.2 Eligibility — the entire security argument

A domain is sandbox-eligible if and only if it falls in a namespace that
**cannot be registered by anyone**:

| Namespace | Reserved by | Note |
|---|---|---|
| `*.test` | RFC 2606 / RFC 6761 | Reserved for testing, permanently |
| `*.example` | RFC 2606 / RFC 6761 | Reserved for documentation |
| `*.invalid` | RFC 2606 / RFC 6761 | Guaranteed never to resolve |
| `*.localhost`, `localhost` | RFC 2606 / RFC 6761 | Loopback only |
| `example.com`, `example.net`, `example.org`, `example.edu` (and subdomains) | RFC 2606, held by IANA | Cannot be transferred |
| `*.local` | RFC 6762 | mDNS link-local |
| `*.internal` | ICANN, 2024 | Reserved for private networks |
| `*.{SANDBOX_DOMAIN_SUFFIX}` | The deployment operator | Optional; must be a name the operator provably controls |

Consequences that follow directly from this rule:

1. **`SANDBOX` on a non-eligible domain is refused** with
   `DOMAIN_SANDBOX_NOT_ELIGIBLE` (400). There is no credential, role, header or
   environment that changes this. `google.com` cannot be sandbox-verified by
   anyone, anywhere, ever.
2. **`DNS_TXT` and `HTML_META` on an eligible domain are refused** with
   `DOMAIN_SANDBOX_ONLY` (400). Reserved names cannot resolve publicly, so a
   live attempt could only ever hit a private address — which the SSRF guard
   would refuse anyway. Refusing early turns a confusing dead end into a
   one-sentence instruction.
3. **Eligibility is decided once, at creation**, from the hostname alone, and
   stored as `BusinessDomain.isSandbox`. It is immutable, because the hostname is
   immutable (FR-DOM-14: domains are not editable). A domain cannot drift
   between modes.

### 6.3 What sandbox verification does *not* skip

Identical to a live verification in every respect except the network check:

- JWT authentication
- Organization ownership of the business
- Role authorization
- Global domain uniqueness
- Per-organization rate limits
- Audit logging

### 6.4 Business service mode

Derived, never stored, computed from current domain rows:

| Mode | Condition | What the user sees |
|---|---|---|
| `LIVE` | ≥1 active VERIFIED domain that is not sandbox | Normal dashboard |
| `TEST` | ≥1 active VERIFIED domain, all of them sandbox | Persistent amber "You're in test mode" banner with a link to add a real domain |
| `INACTIVE` | 0 active VERIFIED domains | Persistent amber "Your AI receptionist has no verified website" banner |

**Why derived and not stored.** A stored flag has to be updated on domain
create, verify, delete, and soft-delete, and on any future bulk operation. Each
of those is a chance to drift. A computed value cannot be wrong.

**Onboarding completes in TEST mode.** Blocking it would defeat the entire
purpose — the user could not see the end of the funnel. `onboardingCompleted` is
a historical fact and is never reverted (FR-BIZ-08); service mode carries the
current truth.

### 6.5 The widget contract (forward requirement for Milestone 7)

> **Binding on M7:** the widget serving layer MUST refuse to serve on a domain
> where `isSandbox = true` outside an explicit preview context, and MUST include
> a visible test-mode indicator when it does. `isSandbox` is the enforcement
> point that keeps Test Mode from becoming a way to run a free production
> widget. This is recorded here, in the specification the widget team will read,
> rather than being discovered later.

---

## 7. Security Controls

### 7.1 Hostname validation (before any network activity)

Rejected outright:

- IP literals, v4 or v6, bracketed or bare
- Hostnames failing the public-DNS-name pattern (length, label rules, must contain a dot)
- URLs carrying userinfo credentials
- Any scheme other than `http`/`https`
- Any port other than the scheme default

### 7.2 Address validation (after DNS resolution)

**Every** A and AAAA record must be public. One private address anywhere in the
answer fails the whole attempt — not "pick a public one", because an attacker
controlling the zone can return both.

Blocked IPv4: `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`,
`192.0.0/24`, `192.0.2/24`, `192.88.99/24`, `192.168/16`, `198.18/15`,
`198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`.

Blocked IPv6: `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `100::/64`,
`2001:db8::/32`, Teredo `2001::/32`; IPv4-mapped and 6to4 addresses are unwrapped
and their embedded IPv4 validated.

### 7.3 DNS rebinding

The connection is dialled against the **already-validated IP address**, with the
real hostname in the `Host` header. There is no window between validation and
connection in which a second resolution could return a different answer, because
there is no second resolution.

### 7.4 Redirects

Followed manually, never automatically. Maximum 3 hops. Every hop is
re-validated from scratch — scheme, port, hostname, DNS, address ranges. An open
redirect on a legitimately public site cannot be used to reach an internal one.

### 7.5 Resource limits

| Limit | Value |
|---|---|
| Total operation budget | 8 s |
| Response body | 512 KB, enforced while streaming |
| Redirect hops | 3 |

### 7.6 Rate limits (per organization)

| Endpoint | Limit | Window |
|---|---|---|
| `POST .../domains` | 10 | 60 min |
| `POST .../domains/:id/verify` | 20 | 60 min |

Keyed on the authenticated organization, falling back to IP for unauthenticated
callers. Per-IP alone is the wrong boundary here: the abuse being prevented is
one tenant using the verify endpoint as an outbound request generator, and that
tenant can trivially change IP.

### 7.7 Information disclosure

| Situation | Response |
|---|---|
| Domain claimed by another organization | 409, generic. Never names the holder |
| Business belongs to another organization | Same response as "does not exist" |
| Outbound fetch failed for a network reason | `DOMAIN_VERIFICATION_PENDING`. Reason logged, never returned |
| `DEV_BYPASS` submitted in production | Byte-identical to an unrecognised method value |

---

## 8. `DEV_BYPASS` — the developer affordance

### 8.1 Why it exists at all

CI must be able to drive the full onboarding flow. The alternative — a real
staging subdomain with a real DNS record — was the previous recommendation and it
fails in three ways: it cannot run offline, it cannot run on a contributor's
laptop, and it makes every CI job depend on a DNS zone that one person can
break. Test Mode (§6) covers most of this, but CI also needs to assert behaviour
on *non-reserved* domain names, which `SANDBOX` correctly refuses.

So the bypass exists, and it is built to be inert.

### 8.2 The gate

```
enabled = (NODE_ENV !== 'production') AND (ALLOW_DEV_VERIFICATION_BYPASS === 'true')
```

Resolved **once at process boot**, from environment variables only. Not
per-request. Not influenced by any header, body field, query parameter, cookie,
or JWT claim. A missing or malformed variable resolves to disabled.

### 8.3 Indistinguishability, by construction

The accepted-method set is built from the boot-time gate and used as the
validation constraint on the request DTO. In production, `DEV_BYPASS` is
therefore not "a method that gets rejected by a check" — it is **not a method
at all**, and it is rejected by the same validation pipe, on the same line of
code, with the same 422 body, as `HAMSTER`.

This matters because the alternative — a runtime `if` that carefully mimics the
validation error — is a thing that can be got subtly wrong, and whose
correctness has to be re-verified after every refactor. Making the two paths the
*same* path removes the possibility.

### 8.4 Refusal to boot

If `NODE_ENV=production` and `ALLOW_DEV_VERIFICATION_BYPASS=true`, the process
exits at startup with an explicit fatal error. The misconfiguration is loud, at
deploy time, instead of silent forever.

### 8.5 What it does not skip

Authentication, organization ownership, role, uniqueness, rate limits, audit
logging. It replaces the network check and nothing else.

### 8.6 Marking

Domains verified this way store `verificationMethod: DEV_BYPASS` and are
displayed as such. Test fixtures are never mistakable for real verifications in
any environment where they are visible at all.

---

## 9. Complete Outcome Matrix

Every reachable outcome of `POST /domains/:id/verify`.

| # | Precondition | `method` | Result | HTTP | Code |
|---|---|---|---|---|---|
| 1 | Live domain, record correct | `DNS_TXT` | Verified | 200 | — |
| 2 | Live domain, record present, value wrong | `DNS_TXT` | Mismatch | 400 | `DOMAIN_VERIFICATION_MISMATCH` |
| 3 | Live domain, record absent | `DNS_TXT` | Pending | 200 | `DOMAIN_VERIFICATION_PENDING` |
| 4 | Live domain, snippet or file correct | `HTML_META` | Verified | 200 | — |
| 5 | Live domain, snippet present, value wrong | `HTML_META` | Mismatch | 400 | `DOMAIN_VERIFICATION_MISMATCH` |
| 6 | Live domain, nothing published | `HTML_META` | Pending | 200 | `DOMAIN_VERIFICATION_PENDING` |
| 7 | Live domain, site unreachable / 5xx / TLS error | `HTML_META` | Pending | 200 | `DOMAIN_VERIFICATION_PENDING` |
| 8 | Live domain resolving to a private address | `HTML_META` | Pending | 200 | `DOMAIN_VERIFICATION_PENDING` |
| 9 | Sandbox-eligible domain | `SANDBOX` | Verified | 200 | — |
| 10 | Non-eligible domain | `SANDBOX` | Refused | 400 | `DOMAIN_SANDBOX_NOT_ELIGIBLE` |
| 11 | Sandbox-eligible domain | `DNS_TXT` / `HTML_META` | Refused | 400 | `DOMAIN_SANDBOX_ONLY` |
| 12 | Any domain, bypass enabled | `DEV_BYPASS` | Verified | 200 | — |
| 13 | Any domain, bypass disabled | `DEV_BYPASS` | Rejected as unknown value | 422 | `VALIDATION_FAILED` |
| 14 | Domain already VERIFIED | any | Refused | 400 | `DOMAIN_ALREADY_VERIFIED` |
| 15 | Domain belongs to another organization | any | Not found | 403/404 | `AUTHZ_FORBIDDEN` / `RESOURCE_NOT_FOUND` |
| 16 | Domain soft-deleted | any | Not found | 404 | `DOMAIN_NOT_FOUND` |
| 17 | Over the per-org limit | any | Throttled | 429 | `RATE_LIMITED` |
| 18 | Caller lacks OWNER/ADMIN | any | Forbidden | 403 | `AUTHZ_FORBIDDEN` |

---

## 10. User-Facing Copy

The authoritative mapping from stable code to the words a person reads. No
backend string is ever rendered.

| Code | Headline | Explanation | Action |
|---|---|---|---|
| `DOMAIN_VERIFICATION_PENDING` | We haven't found your verification yet. | This is normal right after adding a DNS record or a snippet — it can take a few minutes, occasionally longer. | Check again |
| `DOMAIN_VERIFICATION_MISMATCH` | We found something, but it doesn't match. | Usually a copy-paste that picked up an extra space or dropped a character. | Re-copy the value and try again |
| `DOMAIN_ALREADY_VERIFIED` | This domain is already verified. | Nothing more to do here. | Continue |
| `DOMAIN_ALREADY_REGISTERED` | That domain is already connected to an account. | If it's your website and this looks wrong, contact support and we'll sort it out. | Try a different domain |
| `DOMAIN_SANDBOX_NOT_ELIGIBLE` | Test verification only works on test domains. | Real domains need a DNS record or a snippet on the site — that's what proves you own them. | Choose DNS or website snippet |
| `DOMAIN_SANDBOX_ONLY` | This is a test domain, so it verifies instantly. | Test domains aren't real websites, so there's nothing to check — just switch to test verification. | Use test verification |
| `DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED` | This is your only verified website. | Removing it will take your AI receptionist offline until you verify another one. | Confirm to continue |
| `DOMAIN_NOT_FOUND` / `RESOURCE_NOT_FOUND` | We couldn't find that. | It may have been removed, or you may not have access. | Back to dashboard |
| `RATE_LIMITED` | You're going a little fast for us. | Give it a minute and try again. | Wait, then retry |
| `AUTHZ_FORBIDDEN` | You don't have permission to do that. | Ask an owner or admin on your team. | — |
| `VALIDATION_FAILED` | Some details need a second look. | Field-level messages appear under the relevant inputs. | Fix and resubmit |
| `INTERNAL_ERROR` | Something went wrong on our end. | This isn't something you did. | Try again shortly |
| *(no response)* | We couldn't reach ReplyIQ. | Check your internet connection. | Retry |

**Copy rules.** Second person. No jargon — no "challenge", "record not
reachable", "enum", "token" (say "value"), or status codes. Name the likely
cause when there is one. Always end with something the user can do.

---

## 11. Test Plan

### 11.1 Unit

| Area | Cases |
|---|---|
| Sandbox eligibility | Each reserved namespace accepted; each real-world lookalike rejected (`example.com.evil.com`, `notexample.com`, `test.com`, `mytest`, `example.co`); case and trailing-dot normalisation; configured suffix honoured; empty suffix does not match everything |
| DNS parsing | Single record; chunked record; multiple records where one matches; quoted values; whitespace; no match; legacy record name |
| Meta parsing | Attribute orders; single/double/unquoted; uppercase tags; multiple metas; meta in body; absent; present-but-wrong |
| SSRF guard | Every blocked IPv4 range; every blocked IPv6 form; IPv4-mapped and 6to4 unwrapping; IP literals; bad schemes; non-default ports; userinfo; mixed public/private answer sets |
| Method gate | Accepted-method set with bypass on and off; production + bypass = boot refusal |
| Error contract | Every `ErrorCode` has copy; no copy key without a code |

### 11.2 Integration (real database)

| Area | Cases |
|---|---|
| Lifecycle | Add → verify → complete onboarding, for DNS, website, and sandbox |
| Uniqueness | Duplicate across orgs → 409; soft-delete then re-add succeeds |
| Concurrency | Two simultaneous deletes of the last two verified domains cannot leave zero |
| Tenant isolation | Every domain and onboarding endpoint, cross-org → not-found-shaped |
| Ordering | Every out-of-order onboarding step → correct code |
| Confirmation | Deleting last verified domain without acknowledgement → 409; with → 200 |
| Instruction stability | Two instruction fetches return identical values |
| Website fetch | Against a local fixture server: meta hit, well-known hit, legacy file hit, mismatch, 404, 500, oversized body, redirect chain, too many redirects |
| Audit | Every lifecycle event produces exactly one record with the right actor |

### 11.3 Acceptance gates (block release)

- [ ] `DEV_BYPASS` against a `NODE_ENV=production` build is rejected identically to an unknown value
- [ ] `NODE_ENV=production` + `ALLOW_DEV_VERIFICATION_BYPASS=true` fails to boot
- [ ] `SANDBOX` against a real domain is refused in every environment
- [ ] A domain resolving to a private address is refused before any outbound connection
- [ ] Every documented `code` resolves to reviewed copy; no backend string reaches the UI
- [ ] Every organization-scoped endpoint has a passing cross-tenant test
- [ ] Onboarding can be completed end-to-end with only a test domain

---

## 12. Configuration

| Variable | Default | Effect |
|---|---|---|
| `ALLOW_DEV_VERIFICATION_BYPASS` | `false` | Enables `DEV_BYPASS` when `NODE_ENV != production`. Fatal at boot if `true` in production |
| `SANDBOX_DOMAIN_SUFFIX` | *(empty)* | Additional operator-controlled sandbox namespace, e.g. `sandbox.replyiq.app`. Empty means reserved namespaces only |
| `DOMAIN_VERIFY_RATE_LIMIT_MAX` | `20` | Verify attempts per organization per window |
| `DOMAIN_ADD_RATE_LIMIT_MAX` | `10` | Domain additions per organization per window |
| `DOMAIN_RATE_LIMIT_TTL` | `3600` | Window, seconds |
| `DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE` | *(empty)* | Test-only fixture host. Ignored unless `NODE_ENV=test` |

---

## 13. Decisions Recorded, and What They Supersede

| ID | Decision | Supersedes |
|---|---|---|
| **D-01R** | The website method checks the homepage meta tag **first**, with the well-known file and legacy HTML file as equivalent alternatives under the same method. | D-01, which chose file-only and rejected the meta tag. The rejection was made on the grounds that the file mechanism was what the code did — a description of the present, not a product decision. The meta tag is what non-technical users can actually place, and offering all three costs one extra request on the miss path. |
| **D-02** | Uniqueness over active rows via a partial unique index. | Unchanged, reaffirmed. |
| **D-04R** | Test Mode (`SANDBOX`) ships in production; `DEV_BYPASS` ships for non-production, fail-closed and boot-guarded. | D-04, which rejected any bypass on the grounds that a real staging subdomain suffices. It does not: it cannot run offline and it makes CI depend on a shared DNS zone. More importantly, D-04 left the product with no path for a user who does not own a domain, which is a product gap, not a testing one. |
| **D-05** | Business activation is atomic with onboarding completion. | Unchanged, now implemented. |
| **D-06R** | Deleting the last verified domain is **allowed with explicit acknowledgement**, not blocked. | D-06, which blocked it outright. Blocking strands anyone who verified the wrong domain, and a hard "no" on the user's own data is a worse answer than a clear, deliberate "are you sure". The acknowledgement is required on the API call, so the safety survives outside the UI. |
| **D-07R** | Roles remain `OWNER, ADMIN, MANAGER` — schema truth. | The `MEMBER/VIEWER` taxonomy proposed in external review, which names roles the data model does not have. |

---

## 14. Related Documents

| Document | Relationship |
|---|---|
| `01-PRODUCT-REQUIREMENTS.md` | Goals G2/G3, FR-DOM-\*, FR-TEST-\*, FR-BIZ-06..08 |
| `17-END-TO-END-FLOW.md` | The same system described in plain steps, for humans |
| `09-API-SPECIFICATION.md` | Wire formats for the endpoints described here |
| `12-SECURITY-MULTI-TENANCY.md` | Platform-wide security posture; §7 here is its domain-verification chapter |
| `14-QA-ACCEPTANCE-DOD.md` | Where §11 becomes the release checklist |
| `docs/CHANGES-2026-09-05.md` | What changed, why, and where it landed |
