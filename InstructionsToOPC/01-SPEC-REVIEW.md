# ReplyIQ — Onboarding / Domain Management / Domain Verification
## Specification Review

> Scope: verification and correction of the six uploaded documents (`01-PRODUCT-REQUIREMENTS`, `02-PRODUCT-FLOWS`, `03-UI-UX-SPECIFICATION`, `09-API-SPECIFICATION`, `12-SECURITY-MULTI-TENANCY`, `14-QA-ACCEPTANCE-DOD`), focused primarily on Business Onboarding, Domain Management, and Domain Verification.
> Companion document: `02-RECOMMENDED-CORRECTIONS.md` contains the literal replacement text to paste into each source file.

---

## A. Executive Verdict

**Not yet strong enough to hand to an implementer as-is.** The narrative flows read as if the feature is finished and internally consistent, but the six documents disagree with each other on several load-bearing facts — including the actual mechanics of HTML domain verification, whether domain deletion is soft or hard, whether refresh tokens live 7 or 30 days, and what the responsive breakpoints are. Any one of these, taken as written by an implementer working from a single doc, produces a different system than a colleague working from another doc.

**Quality score: 5/10** — the documents are unusually detailed and well-organized (a real strength: ASCII sequence diagrams, exact Tailwind classes, exact field-level validation), which is why the contradictions are so fixable. But "detailed and self-contradictory" is worse than "sparse and consistent" as an implementation contract, because it invites silent, undetected divergence between frontend and backend implementers who each pick a different one of the two conflicting truths.

**Biggest risks, in order:**

1. **HTML verification is specified as two mutually exclusive mechanisms** (upload a file at a fixed path vs. embed a meta tag in `<head>`) across different documents. Whichever one OpenCode's frontend agent reads first is the one that ships; the backend agent may build the other. This alone can produce a shippable-looking but non-functional verification method.
2. **No dev/test verification bypass exists anywhere in the spec**, despite the product depending on DNS propagation and live HTTP fetches that cannot be exercised in CI or on `localhost`. Without this, either the test suite required by the QA doc cannot be written, or someone improvises an unreviewed bypass later under time pressure — which is exactly the security hazard the task is trying to pre-empt.
3. **Domain uniqueness scope and delete semantics are ambiguous** in a way that has real security consequences (a business could plausibly "steal" another org's domain claim, or lose a verified domain permanently with no confirmation and no way back).
4. **No user-facing error copy exists.** Every error the backend actually returns today ("challenge record is not yet reachable," "Domain already registered," generic 500s) is backend-shaped, not owner-shaped. This is explicitly called out as unacceptable in the brief and is currently the default behavior across all six documents.
5. **Authorization is documented as unenforced** (no RBAC guard, no organization-scoping guard) while the onboarding/domain flows assume "any authenticated org member can do anything." This is fine to ship as an interim decision, but it must be an explicit, written decision — not an implicit gap discovered by an implementer mid-build.

None of these require inventing new product direction. They require picking one of two things the documents already say, and saying it everywhere.

---

## B. Critical Issues (must fix before implementation)

| # | Issue | Why it blocks implementation |
|---|---|---|
| B1 | HTML verification method is specified as file-upload (Flows, UI/UX) **and** meta-tag (API spec) — different fetch target, different content format, different instructions copy. | Backend and frontend cannot be built from different documents and interoperate. This is the single highest-risk item in the whole spec. |
| B2 | DNS TXT record name differs: `_replyiq-challenge.{domain}` (Flows) vs `_replyiq-verification.{domain}` (API spec). | Same class of problem as B1 — whichever value ships in the UI instructions must exactly match what the backend resolver queries. |
| B3 | The verification token value is a separate random secret in Flows (`replyiq-verify-{uuid}`) but is literally the domain's own database ID in the API spec example (`replyiq-verify=clx5566778899`). | If the "token" is a guessable/enumerable internal ID rather than a random secret, the verification instructions leak an internal identifier, and the anti-forgery value carries no real entropy of its own (the actual security still rests on DNS/HTTP control, but reusing a public-ish ID as the "secret" is bad practice and must be a deliberate, not accidental, choice). |
| B4 | Domain deletion is "soft" everywhere except the API spec, which explicitly says "hard delete." | Determines whether Prisma schema needs `deletedAt` on `BusinessDomain`, whether a deleted domain can be safely re-added, and whether onboarding history/audit is preserved. Backend engineers will implement literally what the API doc says. |
| B5 | No development/test verification bypass is specified anywhere, despite QA doc requiring integration and E2E tests of DNS TXT and HTML verification flows that are structurally impossible to exercise for real in CI/localhost. | Without an approved mechanism, this gets solved ad hoc later — which is precisely the "weakened production verification" risk the brief asks to avoid. |
| B6 | Zero user-facing error copy exists for onboarding/domain failure states; the only strings on record are raw backend messages (the exact strings the brief calls out as unacceptable already appear verbatim in the UI/UX and Flows docs, e.g. "the challenge record is not yet reachable"). | This is a stated hard requirement of the review and currently fails outright. |
| B7 | Domain uniqueness scope is contradictory: Flows says uniqueness is checked "(global)"; the QA doc's edge-case table says adding the same domain to a different business/org should be "Allow (different orgs)." | These are opposite security postures. Global uniqueness is required for widget routing (a domain can only resolve to one business) and to prevent domain-hijack scenarios; per-org uniqueness would allow two unrelated businesses to both claim `acme.com`. This must be resolved, not left to whichever engineer reads which doc. |

---

## C. High-Priority Issues (should fix before implementation)

| # | Issue |
|---|---|
| C1 | Refresh token TTL: 30 days (Product Requirements FR-AUTH-03, Flows, Security doc) vs 7 days (API spec §7). Affects session UX and any test asserting expiry. |
| C2 | Business `status` model is contradictory: FR-BIZ-02/03 say Business starts `DRAFT` and becomes `ACTIVE` only when onboarding completes, but the API spec's own example response shows `status: "ACTIVE"` on a business whose `onboardingStatus` is still `"IN_PROGRESS"`. |
| C3 | Register endpoint response breaks the standard `{success, message, data}` envelope used by every other authenticated endpoint (Login, Refresh, Me, Business, Domain, Onboarding). Frontend must special-case it, silently, forever, unless fixed. |
| C4 | Responsive breakpoints conflict: UI/UX spec (Mobile <768px / Tablet 768–1023px / Desktop ≥1024px, matching the actual `lg:` Tailwind prefix used in the Sidebar/AppLayout spec) vs QA doc (Mobile <1024px / Tablet 1024–1440px / Desktop >1440px). QA's own Playwright viewport list (375, 768, 1440, 2560) is actually consistent with the UI/UX doc, only the prose table in the QA doc is wrong. |
| C5 | Validation-error status code: Flows shows registration validation failures as `400`; API spec's own Exception Mapping table (§2) says the global `ValidationPipe` throws `ValidationException` → `422`. |
| C6 | Session revocation mechanism: Security doc §4 says logout "deletes the session record"; Flows' Session Lifecycle appendix and its own error table describe a `revokedAt` timestamp and a distinct "session already revoked" (idempotent, not-found) state, which requires the row to still exist. |
| C7 | No confirmation step before deleting a domain, even a verified one that may be the domain gating `onboardingCompleted` and/or the only domain the (future) widget is allowed to serve on. UI/UX doc explicitly flags this as a "recommended future addition" rather than a requirement — it should be a requirement given the destructive, hard-to-recover blast radius. |
| C8 | Role taxonomy is inconsistent three ways: `OWNER/ADMIN/MANAGER` (Product Requirements, Milestone 2 + FR-TAM-07) vs `OWNER/ADMIN/MEMBER/VIEWER` (Security doc RBAC matrix, which is the table that actually governs who may manage Domains/Onboarding) vs `ADMIN/MEMBER/VIEWER` (Flows, Team Management invite flow). This isn't cosmetic — the Security doc's permission matrix is the authoritative source for "who can touch Domains/Onboarding," and it uses roles that don't exist in the Product Requirements' data model. |
| C9 | No policy exists for what happens to `firstDomainVerified` / `onboardingCompleted` / widget availability if the business later deletes its only verified domain. Flows' edge-case note ("onboarding may need re-verification") is not implementable as written — it doesn't say whether onboarding is retroactively marked incomplete, whether the widget stops responding, or whether nothing happens at all. |
| C10 | No spec exists for backward navigation inside the onboarding wizard (re-opening a completed step to edit it) beyond "steps must be completed in order" (forward-only enforcement). The step list UI shows completed/active/pending states but never says whether completed step cards are clickable. |

---

## D. Medium / Low Issues

- **D1.** Domain "already registered" error (409) does not distinguish "you already have this domain" from "someone else already claimed it" — the latter risks a mild enumeration/confirmation leak to a party attempting to claim a domain they don't control. Recommend a uniform, non-confirming message (see error-copy table in Section F/K).
- **D2.** No documented way to *edit* a domain string once added (e.g., fix a typo) — only delete-and-re-add. Should be an explicit "not supported by design" statement rather than a silent gap, so OpenCode doesn't build it accidentally or skip it accidentally.
- **D3.** No documented relationship between `Business.websiteUrl` (free text, optional, no ownership proof) and `BusinessDomain` (verified, ownership-proven). Nothing pre-fills the domain step from the website URL entered in the profile step, which is an obvious usability win for a wizard collecting both.
- **D4.** Onboarding Step 0 does two sequential mutations (`PATCH /businesses/:id` then `PATCH /onboarding/steps`) with no stated behavior if the first succeeds and the second fails (e.g., network drop mid-step). Not a correctness bug (the operation is safely retryable) but untested/unstated.
- **D5.** `NFR-SEC-09` ("tokens moved from localStorage to httpOnly cookies before production") is `[PLANNED]` in Product Requirements while the Security doc treats it as a "Critical — must complete before launch" checklist item; both are directionally aligned but should reference each other so a reader doesn't have to reconcile priority language across docs.
- **D6.** Onboarding wizard has no explicit "leave without saving" warning despite each step auto-saving on submit (arguably low-risk, since data is server-persisted per step, but should be stated rather than assumed).
- **D7.** DNS propagation copy says "up to 48 hours" but `NFR-PERF-05`/FR-DOM-06 promise verification "completes within 60 seconds," which is true only for the *verification check itself*, not for how long a user might have to wait after adding a DNS record before that check can succeed. Both are technically correct but juxtaposed without a bridging sentence, which reads as contradictory to a non-technical business owner and needs the copy in Section G/K to actually resolve this in plain language.
- **D8.** Milestone 4 "Zod form validation" and "Integration tests" are listed `[PLANNED]` for onboarding even though the same table calls the onboarding wizard itself `[IMPLEMENTED]` — implies the currently-shipped forms have no shared client-side validation schema and no test coverage, which the QA doc's own coverage targets (100% on "business domain verification" critical paths) directly contradict. Worth a one-line reconciling note.

---

## E. Contradiction Report

| ID | Documents | Contradiction | Recommended Resolution |
|---|---|---|---|
| X1 | Flows §7, UI/UX §5.4/5.6, API §5.13 | HTML verification: file-at-fixed-path (`/replyiq-verification.html`) vs. `<meta>` tag content. Even the UI/UX doc contradicts itself: the radio button is labeled "HTML Meta Tag" but its subtitle says "Upload an HTML file." | Standardize on **meta tag** (matches FR-DOM-04's own name, "HTML meta tag (fallback)," and requires no file hosting/FTP access — just pasting a snippet into a CMS's `<head>` field, which is what most non-technical business owners can actually do). Fix Flows §7 and the UI/UX radio subtitle; keep API spec's meta-tag mechanism as canonical. |
| X2 | Flows §7 | Flows §7 | DNS record name `_replyiq-challenge.{domain}` vs API §5.13 `_replyiq-verification.{domain}` | Standardize on **`_replyiq-verification.{domain}`** (clearer to a non-technical reader than "challenge," and matches the meta tag's `name="replyiq-verification"` attribute chosen in X1 for naming consistency). Update Flows §7 and all UI copy. |
| X3 | Flows §7 (`replyiq-verify-{uuid}`) vs API §5.13 (`replyiq-verify=clx5566778899`, i.e., the domain's own ID) | Verification token identity and format | The token must be a **separate, cryptographically random value** (e.g., 32 hex chars), generated at domain-creation time, stored on `BusinessDomain.verificationToken`, and never equal to the domain's own database ID. Format: `replyiq-verify-{32-hex-token}` for both DNS value and meta content, so copy-paste instructions are identical text in both methods. |
| X4 | Flows §10 ("soft delete... removed from future queries") + Product FR-BIZ-04 pattern vs API §5.12 ("This is a hard delete") | Delete Domain semantics | **Soft delete** (`deletedAt` timestamp), consistent with Business's own soft-delete pattern, auditability, and the ability to safely re-add a domain later without losing verification history. Fix API §5.12. |
| X5 | Flows §10 ("Check domain uniqueness (global)") vs QA §7 edge case ("Add same domain to different businesses → Allow (different orgs)") | Domain uniqueness scope | **Global** uniqueness across all organizations. A domain can only ever belong to one business at a time (required for the widget to unambiguously route a visiting domain to exactly one business, and to prevent domain-squatting between tenants). Fix the QA edge-case row to instead read: "Add domain already verified by another org → 409, generic non-confirming message." |
| X6 | Product Requirements FR-AUTH-03 + Flows §3 + Security doc §3 ("30 days") vs API spec §7 ("Lifetime: 7 days") | Refresh token TTL | **30 days** (majority source, and the value actually referenced by the Session model's `expiresAt` semantics). Fix API spec §7. |
| X7 | Product Requirements FR-BIZ-02/03 (Business: DRAFT → ACTIVE only after onboarding) vs API spec §5.7/5.8 example (`status: "ACTIVE"` shown while `onboardingStatus: "IN_PROGRESS"`) | When does `Business.status` become ACTIVE? | Keep `status` and `onboardingStatus` as **two independent fields**: `onboardingStatus` tracks wizard progress (`NOT_STARTED → ... → COMPLETED`); `status` tracks the business lifecycle (`DRAFT → ACTIVE → SUSPENDED → ARCHIVED`) and transitions to `ACTIVE` only when `onboardingStatus` reaches `COMPLETED` (per FR-BIZ-03). Fix the API spec's example payloads so `status` and `onboardingStatus` are never shown as contradictory in the same object during onboarding. |
| X8 | API spec §5.2 (Register) response is a bare object vs every other endpoint's `{success, message, data}` envelope | Response envelope consistency | Wrap Register's response in the standard envelope: `{ success: true, message: "...", data: { session, user, business, organization } }`. Update Flows §1 example accordingly. |
| X9 | UI/UX §11.1 (Mobile <768 / Tablet 768–1023 / Desktop ≥1024) vs QA §3.5 (Mobile <1024 / Tablet 1024–1440 / Desktop >1440) | Responsive breakpoint definitions | Adopt the **UI/UX doc's** breakpoints (768/1024), since they match the actual `lg:` Tailwind prefix already used throughout the component spec (Sidebar, AppLayout). Fix QA §3.5's prose table; its Playwright viewport list is already correct and needs no change. |
| X10 | Flows §1 error example ("400: Validation error") vs API spec §2 Exception Mapping (`ValidationException → 422`) | Status code for DTO validation failures | **422**, per the API spec's own authoritative Exception Mapping table (this is also what NestJS's `ValidationPipe` naturally produces when configured as documented). Fix Flows §1 and any other doc showing "400" for a field-validation failure specifically (400 remains correct for non-DTO business-rule errors, e.g., "complete profile step first"). |
| X11 | Security doc §4 ("session record is deleted from the database" on logout) vs Flows §4/Appendix ("revokedAt set", "Session already revoked" as a distinct idempotent response) | Logout: hard delete vs soft revoke | **Soft revoke** (`revokedAt` timestamp), consistent with the Flows doc's own idempotent-logout behavior and with the Security doc's separate recommendation to eventually add audit logging (a hard-deleted session leaves no forensic trail). Fix Security doc §4. Pair with a documented session-cleanup cron for old *revoked* rows (already listed as a gap in Security doc §4, "No session cleanup"). |
| X12 | Product Requirements (Milestone 2, FR-TAM-07: `OWNER, ADMIN, MANAGER`) vs Security doc §10 RBAC matrix (`OWNER, ADMIN, MEMBER, VIEWER`) vs Flows §11 invite flow (`ADMIN, MEMBER, VIEWER`) | Role taxonomy | Adopt **`OWNER, ADMIN, MEMBER, VIEWER`** (Security doc's set — it's the one with an actual permissions matrix already mapped against Domains/Onboarding/Businesses, which is the thing this review needs to be authoritative). Fix Product Requirements Milestone 2 table and FR-TAM-07. |
| X13 | Product Requirements FR-DOM-09 (`[PLANNED]`, P1: "Users can remove a domain") vs Milestone 4 feature table ("Domain management: Add, list, and remove... [IMPLEMENTED]") vs QA §4 Phase 4A ("[x] Domain management (add, list, remove) works") vs Flows/UI/API (delete fully specified and always-present in the UI) | Is domain removal implemented or planned? | **Implemented** — this is a stale status flag, not a real product ambiguity. Fix FR-DOM-09's status to `[IMPLEMENTED]` and drop it from the "P1 planned" framing (it can stay as a requirement row, just correctly tagged). |

---

## F. Missing Requirements

Necessary for a complete, implementable onboarding/domain-verification product but currently absent from all six documents:

1. **Development/test verification bypass mechanism** (fully specified in Section K, Security doc additions, and QA doc additions below). Currently unsupported anywhere, yet the QA doc requires integration/E2E coverage of exactly the flows this would unblock.
2. **User-facing error copy** for every documented failure state in onboarding/domain flows (table provided in Section K). Currently every documented error string is a raw backend message.
3. **Confirmation dialog before destructive domain actions** (delete, especially of a verified domain), promoted from "future addition" to a hard requirement.
4. **Policy for a verified domain being deleted post-onboarding-completion** — what happens to `onboardingCompleted`, and what the dashboard/business shows if zero verified domains remain (a "no active verified domain" warning state, separate from the onboarding gate itself, since onboarding is a one-time historical milestone and shouldn't silently un-complete).
5. **Backward navigation / re-editing spec for the onboarding wizard** — whether completed step cards in the step list are clickable, whether editing a completed step can invalidate a later one (e.g., can a user go back and add a second domain, or change which domain is "primary," mid-wizard), and what "Edit" from the Domains page looks like once out of onboarding.
6. **Relationship between `websiteUrl` (profile step) and domain (domain step)** — at minimum, pre-fill the domain input from the hostname of `websiteUrl` if present, and state explicitly that the two fields are independent and unsynced afterward (editing one never touches the other).
7. **A "which domain is primary" story for onboarding when multiple domains exist** — `BusinessDomain.isPrimary` exists in the schema and API, but the onboarding wizard's Step 1 "existing domains" list only shows a selection UI with no explicit rule for what "primary" means for a business with several verified domains (does the widget serve on all verified domains, or only the primary one?). This affects `FR-WDG-06` directly and must be resolved before Milestone 7 work begins, but the decision belongs in this document set.
8. **Explicit statement that domain string edits are unsupported** (delete-and-re-add is the only path), so it isn't silently built or silently skipped by different implementers.
9. **Rate limiting on the Add Domain and Verify Domain endpoints.** The Security doc explicitly flags "only 3 of 15 endpoints are rate-limited" and separately lists "Widget spoofing... HIGH" and abuse risks, but never proposes concrete limits for domain-add/verify specifically, even though repeated verify attempts are a plausible DNS-amplification / probing vector (an attacker-controlled account could use the verify endpoint to make the server issue arbitrary outbound HTTP GETs to attacker-chosen hosts under the HTML method — see H3 below).
10. **Explicit SSRF guardrails on the HTML verification fetch.** The server performs `GET http://{domain}/...` based on user-supplied input. Nothing in any document constrains this to public, non-internal hosts (see H3).

---

## G. User Experience Improvements — end-to-end, from a business owner's perspective

This describes the **target** experience after the corrections in this review are applied. It does not introduce new product surfaces; it fills in gaps and resolves the contradictions above.

1. **Registration → Onboarding.** Owner registers with business name, their name, email, password. They land directly on `/onboarding`, no separate confirmation step, no email verification gate (email verification remains a `[PLANNED]`, non-blocking, post-MVP addition — this should stay explicit so it isn't accidentally treated as a blocker).
2. **Step 1 — Tell us about your business.** Industry, description, website URL — all optional, framed as "the more you tell us, the better your AI receptionist will sound," not as red-tape. If a website URL is entered, the next step's domain field is pre-filled with its hostname, saving a redundant type.
3. **Step 2 — Add your website domain.** One field. Plain-language framing: *"This is the website your AI receptionist will work on. We just need to confirm you own it — takes about a minute."* Existing domains (if any) are listed and selectable, each tagged Verified/Pending.
4. **Step 3 — Prove you own it.** Two options, explained in plain language, not jargon:
   - *"Add a line to your domain's DNS settings"* (recommended, no file access needed, but requires a login to wherever the domain was purchased — GoDaddy, Namecheap, Cloudflare, etc.). Instructions come with **copy buttons** on both the record name and value, and a plain-language note: *"This usually takes a few minutes to a few hours to take effect. If verification doesn't succeed right away, that's normal — just try again in a bit."*
   - *"Add a snippet to your website's homepage"* (if you can edit your site's code/template, this is often faster). One snippet, one copy button, with a one-line note on where it goes (`<head>` section).
   - Both methods produce the exact same instructions every time verification is retried (the token doesn't change), so a business owner who steps away and comes back isn't given new, confusing instructions.
5. **Verification result.** Three outcomes, each with a friendly explanation and a clear next action:
   - **Verified** → green confirmation, auto-advance to the completion step.
   - **Still checking / not found yet** → yellow, reassuring, non-technical: *"We haven't found your verification yet. This is normal right after adding a DNS record — it can take a little while to take effect. You can try again anytime; you don't need to do anything else."* A visible **"Check again"** button, no page reload needed.
   - **Something's wrong** (e.g., record value doesn't match, which usually means a copy-paste error) → orange/red, specific and actionable: *"We found a record, but it doesn't quite match what we're expecting. Double check you copied the whole value with nothing extra, then try again."*
6. **Completion.** Confirms both profile and domain are done, and previews what's next (knowledge base), so the owner understands this isn't the end of setup, just the end of the required part.
7. **Afterward (Domains page).** Owner can add more domains, see status, retry verification, and delete a domain — deletion of a *verified* domain always requires a typed or clicked confirmation ("Type the domain to confirm" or a simple "Are you sure?" modal), because it can silently disable the widget on that domain and (per F4) may affect onboarding-completion display state.
8. **If they leave and come back** (refresh, close the tab, log in on another device) — the wizard always resumes exactly where progress data says they left off; there is no local-only, losable state. A business owner never has to redo a step they already completed unless they choose to go back and edit it.

---

## H. Security Review

1. **H1 — RBAC is documented but unenforced (Security doc §10), and no document says what interim policy applies to onboarding/domain endpoints in the meantime.** Recommendation: state explicitly, as an interim MVP decision, that *any* authenticated member of the owning organization may perform all onboarding/domain actions (i.e., treat MEMBER and VIEWER as equivalent to ADMIN for these specific routes until `RolesGuard` ships), rather than leaving this as an accidental gap. This makes the current behavior a documented decision instead of a silent hole.
2. **H2 — Organization-scoping is service-level only, with "a single missed filter... exposes cross-tenant data" called out as a known critical gap (Security doc §11).** For the primary review area specifically: every onboarding and domain endpoint (`GET/PATCH /businesses/:id`, all `/domains` routes, all `/onboarding` routes) must be listed as **mandatory** targets for the recommended `OrganizationGuard`/`TenantScopeInterceptor`, not just implied by the general gap. Add this explicitly to the QA doc's Milestone 4 acceptance criteria (currently absent — Milestone 4's acceptance list has no cross-tenant isolation test for domains/onboarding specifically, only a generic one under Section 3.7).
3. **H3 — SSRF risk in HTML verification.** The server fetches a URL derived from user-supplied domain input (`GET http://{domain}/...`). Nothing in any document restricts this to public internet hosts. A malicious or compromised account could add a domain resolving to an internal/private IP (`169.254.169.254`, `localhost`, an internal service) to probe internal infrastructure via the verification fetch. **Required addition:** the verification fetch must (a) resolve DNS first and reject private/loopback/link-local/reserved IP ranges before connecting, (b) disable HTTP redirects or re-validate the target of each redirect against the same rule, (c) enforce the existing 5-second timeout and a small response-size cap, and (d) never reflect fetch errors verbatim to the client (ties into F2/K).
4. **H4 — Domain-add/verify abuse surface has no rate limit**, unlike auth endpoints (Security doc §9 explicitly flags "only 3 of 15 endpoints are rate-limited"). Repeated `POST /domains/:id/verify` calls are a way to make the server issue repeated outbound requests to an attacker-chosen host (amplification / internal probing surface, compounding H3). **Required addition:** rate limit `POST .../domains` and `POST .../domains/:id/verify` per organization (not just per IP), e.g., 10 adds/hour and 20 verify-attempts/hour per org, returning the same generic 429 pattern already used for auth endpoints.
5. **H5 — Domain-conflict error risks light enumeration** (D1 above) — resolved via the generic message in Section K, not by naming which org owns the domain.
6. **H6 — Verification token entropy** (X3): the token must be generated with a CSPRNG, not derived from or equal to any other identifier (domain's own ID, business ID, etc.), and must not be predictable from data already visible to the requester (e.g., not a hash of the domain string alone, which anyone could compute).
7. **H7 — Dev-only bypass isolation** (full spec in Section K): the interim MVP decision in H1 plus this bypass together mean the *actual* residual risk to evaluate is "can a dev-bypass request ever succeed against a production deployment." The guard must be a **server-side environment check that cannot be influenced by any request header, body field, or query parameter** — i.e., not `if (req.body.devMode)`, but `if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_VERIFICATION_BYPASS === 'true')`, evaluated once at boot, not per-request. This must be listed as a P0 QA gate: **"attempt to use the dev-bypass verification method against a prod-configured server → must be rejected exactly like an unknown enum value, with no distinguishing error message."**
8. **H8 — Audit logging is "not implemented" globally (Security doc §17), but domain verification (ownership claims) and any dev-bypass usage are exactly the class of event that should be first in line once audit logging exists.** Recommend flagging both explicitly as priority audit-log targets in Security doc §17, ahead of the generic "data mutations" bucket.

---

## I. API Contract Review

| Area | Issue | Fix |
|---|---|---|
| Register (`POST /auth/register`) | Response is not enveloped, breaking the documented convention. | Wrap in `{success, message, data}` (X8). |
| Verify Domain (`POST /domains/:id/verify`) | `method` enum currently only `DNS_TXT` / `HTML_META`. No provision for a dev-bypass value, and no explicit 400 response schema shown for the "record found but doesn't match" case vs "record not found" case — both currently described only in prose. | Add explicit response examples for `PENDING` and `FAILED` outcomes (not just the happy-path `VERIFIED` example currently shown), and document the dev-only method value per Section K (rejected outside non-prod). |
| Verification Instructions (`GET .../verification-instructions`) | Example response for `DNS_TXT` still uses the old record name and format (`_replyiq-verification.acme.com` / `replyiq-verify=clx...`), which itself doesn't match the Flows doc's `_replyiq-challenge` / `replyiq-verify-{uuid}` — this is the same contradiction as X2/X3, restated at the API layer. Also: the `HTML_META` example never populates `htmlFileName`, which is dead schema surface if the mechanism is truly meta-tag-based (X1). | Fix values per X1–X3's resolution; remove `htmlFileName`/`recordName`/`recordValue` cross-contamination between the two method shapes, or clearly document them as always-null-for-the-other-method (current behavior, just needs to be stated as intentional, not left ambiguous). |
| Delete Domain (`DELETE /domains/:domainId`) | States "hard delete," contradicting Flows/product pattern. | Change to soft delete; response should probably note `deletedAt` in a 200 body for consistency with other resources, though a 204/200-with-message is also acceptable if documented. |
| Business object (`GET/PATCH /businesses/:id`) | Example shows `status: "ACTIVE"` concurrently with `onboardingStatus: "IN_PROGRESS"`, contradicting FR-BIZ-02/03. | Fix per X7. |
| Onboarding Steps (`PATCH /onboarding/steps`) | Well-specified and internally consistent — no changes needed beyond the shared error-status fix (X10) and the addition of a machine-readable error `code` field (see below). | — |
| Global error shape | `{statusCode, message, timestamp}` has no stable machine-readable `code`, forcing the frontend to pattern-match on `message` strings to decide what user-facing copy to show — which is fragile and actively works against the "no raw backend errors shown to users" requirement (K below), since the frontend needs *some* reliable key to look up friendly copy by. | Add a stable `code` field (e.g., `"DOMAIN_ALREADY_REGISTERED"`, `"VERIFICATION_PENDING"`, `"ONBOARDING_STEP_OUT_OF_ORDER"`) to every error response. This is the single highest-leverage API change in this review — every other translation-table fix in Section K depends on the frontend having something stable to switch on. |
| Rate limiting | Only auth endpoints listed (§3). No entries for domain add/verify. | Add per H4. |
| Missing endpoint | No endpoint to fetch verification status without re-triggering a live check (currently `GET .../verification-instructions` returns instructions, not current status; status is only visible via `GET .../domains` list). This is fine functionally but should be called out as intentional so a `GET .../domains/:id/verify-status` isn't built redundantly. | Document as an explicit non-requirement. |

---

## J. QA / Acceptance Review

Missing or under-specified test scenarios for the primary review area, beyond what Section 3.4's endpoint table and Section 7's edge-case table already cover:

- **Onboarding resume matrix**: refresh mid-step, close-tab-and-return, log in on a second device mid-onboarding, direct navigation to `/onboarding` after completion (must show the Completed state, not restart the wizard) — none of these are explicit rows in the QA doc's E2E test matrix today (only "Onboarding wizard" as a single happy-path row).
- **Back-navigation / edit-a-completed-step** — cannot be tested until Missing Requirement F5 is resolved; add once resolved.
- **Domain deletion confirmation** — must be added as an explicit QA row once C7/F3 is adopted ("delete without confirming → blocked/no-op; confirm → deleted").
- **Cross-tenant domain claim attempt** — "User in Org A attempts to add a domain already verified by Org B → 409 generic message, no confirmation of which org owns it" (ties to X5/H5); not present in the current edge-case table.
- **Dev-bypass rejection in prod-configured test run** — required as a P0 gate per H7; currently cannot exist because the bypass itself doesn't exist yet in the spec.
- **SSRF guard test** — "Add domain resolving to a private/loopback IP, attempt HTML verification → request is rejected before any outbound fetch is made" (ties to H3); not present today.
- **Verification-instructions consistency test** — "Request instructions twice for the same pending domain → identical record name/value returned both times" (ties to the 'multiple verification attempts... token does not change' behavior already documented in Flows §7, but never asserted as a testable contract).
- **Error-copy contract test** — "Every documented backend error `code` maps to a defined user-facing string in the frontend copy table; no error surfaces raw backend `message` text in the UI" — this is the single test that would have caught the current gap (Section F2/K) and should be a standing regression test, not a one-time check.
- **Responsive breakpoint test alignment** — QA's own viewport list (375/768/1440/2560) is fine; only the prose description needs to match the corrected 768/1024 breakpoints (X9), so the *existing* Playwright tests remain valid — this is a documentation fix, not a new test.
- **Onboarding-status recompute on domain deletion** — test for whatever policy is adopted per F4 (e.g., "delete the only verified domain post-completion → onboardingCompleted remains true; dashboard shows a 'no active verified domain' warning banner").

---

## K. Recommended Document Changes (summary — literal text in the companion corrections file)

### 01-PRODUCT-REQUIREMENTS.md
- **Add:** FR-DOM-10 through FR-DOM-14 covering global uniqueness, soft delete, confirmation-before-delete, dev-only bypass constraints, and the domain-deletion-after-completion policy.
- **Correct:** FR-DOM-09 status to `[IMPLEMENTED]`. FR-AUTH-03 stays 30 days (already correct; API spec is the one to fix). Milestone 2/FR-TAM-07 role list → `OWNER, ADMIN, MEMBER, VIEWER`.
- **Add:** FR-BIZ-06/07 clarifying the two-field status model (X7) explicitly, so it's not just implied by an example payload.
- **Clarify:** Section 6/Appendix status table — Zod validation and integration tests remain `[PLANNED]` for Milestone 4, but flag this as a real coverage gap against the 100%-critical-path target in the QA doc (D8), not a benign omission.

### 02-PRODUCT-FLOWS.md
- **Rewrite** the entire §7 Domain Verification section's DNS/HTML mechanics per X1–X3 (record name, token format, meta-tag mechanism instead of file mechanism).
- **Fix** §1 Register example (envelope, per X8) and its validation-error status code (422, per X10).
- **Fix** §10 Delete Domain (soft delete language, per X4) and its uniqueness note (global, explicit, per X5).
- **Add** a Back-Navigation subsection to §6 (per F5) and a Domain-Deleted-After-Completion subsection (per F4).
- **Add** a new §7a: Development/Test Verification (full flow, per Section below).

### 03-UI-UX-SPECIFICATION.md
- **Fix** the "HTML Meta Tag" radio's subtitle (currently says "Upload an HTML file," should describe pasting a snippet) and the Instructions Panel copy for that method, per X1.
- **Replace** all raw-backend-string banner copy (`"the challenge record is not yet reachable"`, etc.) with the friendly copy table in the corrections file.
- **Add** a delete-confirmation modal spec for the Domains page (per C7).
- **Fix** §11.1 breakpoint table (per X9).
- **Add** a "Check again" / re-verify affordance description distinct from the initial "Verify Domain" button, since retry is a first-class, expected action, not an edge case.
- **Add** a spec for the dashboard's "no active verified domain" warning state (per F4), separate from the onboarding progress card.

### 09-API-SPECIFICATION.md
- **Fix** §5.2 envelope (X8), §5.12 delete semantics (X4), §5.13 record name/value examples (X1–X3), §7 refresh TTL (X6), §5.7/5.8 business status example (X7).
- **Add** an error `code` field to the global error shape (Section I) and a table of stable codes for every documented error.
- **Add** rate-limit rows for domain add/verify (H4).
- **Add** the dev-bypass method value and its guard behavior to §5.11 (H7), explicitly documenting that it 404s/400s identically to an unknown enum value on any non-dev environment.

### 12-SECURITY-MULTI-TENANCY.md
- **Fix** §4 session revocation to soft-revoke (`revokedAt`), per X11.
- **Fix** §10 RBAC role list to be the single source of truth referenced elsewhere (X12) — this doc's list is correct; other docs should match it, not the reverse.
- **Add** a new §13a: Development/Test Verification Bypass — Security Constraints (full text in corrections file), covering H7 exactly.
- **Add** SSRF guardrails for the HTML verification fetch to §14 Input Validation (H3).
- **Add** domain add/verify to the Required Rate Limits table in §9 (H4).
- **Add** "Verify Domains (`OrganizationGuard` mandatory target)" explicitly to §11's Required Implementation list, since it's currently only implied by the general gap (H2).

### 14-QA-ACCEPTANCE-DOD.md
- **Fix** §3.5 breakpoint prose table (X9).
- **Add** the onboarding-resume matrix, back-navigation, delete-confirmation, cross-tenant domain-claim, dev-bypass-rejection, SSRF-guard, and error-copy-contract test rows described in Section J.
- **Add** an explicit acceptance criterion under Milestone 4 for organization-scoping on every onboarding/domain endpoint (H2), not just the generic multi-tenant-isolation line in §3.7.
- **Update** Phase 4A checklist: domain removal is already implemented (confirms X13); no change needed to the checklist itself, just make sure Product Requirements' FR-DOM-09 is corrected to match it.

---

## L. Final Target Specification (concise summary)

After the corrections above, the onboarding/domain-management experience behaves as follows:

A business owner registers and is dropped into a 4-step wizard (**Profile → Domain → Verification → Complete**) that always resumes at the first incomplete step, regardless of refresh, device, or elapsed time, and never lets them skip ahead. Profile fields are optional; the domain step accepts one hostname at a time, pre-filled from the website URL if one was entered, checked for **global** uniqueness across all organizations, and rejected with a generic, non-confirming message if it's already claimed by anyone (including a different domain within the same org, or another org entirely). Verification offers two plain-language methods — a DNS record or a homepage snippet — both driven by the same never-changing, cryptographically random token, with copy-paste instructions and buttons, a friendly "still checking, that's normal" state for propagation delay, a **"Check again"** retry that never requires new instructions, and specific, non-jargon guidance when a record is found but doesn't match. A verified domain can always be deleted from the Domains page, but doing so **always requires confirmation**, is a **soft delete**, and — if it was the domain satisfying onboarding completion — leaves the onboarding milestone intact (it's historical) while surfacing a separate, clear "no active verified domain" warning wherever the business's live status is shown. Every error a business owner can see is translated from a stable backend error `code` into supportive, actionable language; no backend string ever reaches the screen unmediated. In non-production environments only, engineers can mark a domain verified through a distinct, environment-gated mechanism that is provably inert (fails closed, not open) the moment `NODE_ENV=production`, is fully covered by an explicit QA gate proving it cannot be triggered in a prod-configured build, and is logged whenever used. Every onboarding/domain endpoint is a mandatory target of the (currently unenforced but explicitly scoped) organization-isolation guard, so that cross-tenant access — accidentally exposing one business's domains, tokens, or profile to another — is a tested, gated impossibility rather than an assumption resting on every service method remembering to filter correctly.
