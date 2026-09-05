# Recommended Document Corrections — Literal Replacement Text

> Companion to `01-SPEC-REVIEW.md`. Each block below is ready to paste into the named document at the indicated location. Blocks marked **[NEW]** are additions; blocks marked **[REPLACE]** show old → new.

---

## 1. 01-PRODUCT-REQUIREMENTS.md

### 1.1 [REPLACE] FR-DOM table — correct status, add new rows

Replace the existing Domain Verification table with:

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-DOM-01 | Users can add one or more domains to their business | P0 | [IMPLEMENTED] |
| FR-DOM-02 | Each domain generates a unique, cryptographically random verification token, distinct from any other identifier (never the domain's own database ID) | P0 | [IMPLEMENTED] |
| FR-DOM-03 | Users can verify domain ownership via DNS TXT record | P0 | [IMPLEMENTED] |
| FR-DOM-04 | Users can verify domain ownership via an HTML `<meta>` tag on their homepage | P0 | [IMPLEMENTED] |
| FR-DOM-05 | System provides copy-paste instructions, including copy buttons, for both verification methods, and identical instructions on every retry (token never changes) | P0 | [IMPLEMENTED] |
| FR-DOM-06 | Domain verification completes within 60 seconds (DNS) | P0 | [IMPLEMENTED] |
| FR-DOM-07 | Domain verification completes within 10 seconds (HTML meta) | P0 | [IMPLEMENTED] |
| FR-DOM-08 | At least one verified domain is required to complete onboarding | P0 | [IMPLEMENTED] |
| FR-DOM-09 | Users can remove a domain from their business (soft delete) | P0 | [IMPLEMENTED] |
| FR-DOM-10 | Domain uniqueness is enforced globally across all organizations; a domain string may belong to at most one business at a time | P0 | [IMPLEMENTED] |
| FR-DOM-11 | Deleting a domain requires explicit user confirmation before the request is sent, regardless of the domain's verification status | P0 | [PLANNED] |
| FR-DOM-12 | If the domain satisfying `firstDomainVerified` is later deleted, `onboardingCompleted` is not reverted; the dashboard instead shows a persistent "no active verified domain" warning until a verified domain exists again | P1 | [PLANNED] |
| FR-DOM-13 | A non-production-only verification bypass exists for automated testing, is gated by a server-side environment check that cannot be influenced by any request parameter, and is rejected identically to an invalid method value on any production-configured deployment | P0 | [PLANNED] |
| FR-DOM-14 | Every domain and onboarding endpoint enforces organization-level isolation via a dedicated guard/interceptor (not service-level filtering alone) | P0 | [PLANNED] |

### 1.2 [REPLACE] FR-BIZ table — clarify status model

Add after FR-BIZ-05:

| FR-BIZ-06 | `Business.status` (DRAFT/ACTIVE/SUSPENDED/ARCHIVED) and `Business.onboardingStatus` (NOT_STARTED/IN_PROGRESS/DOMAIN_PENDING/COMPLETED) are independent fields; `status` transitions to ACTIVE only when `onboardingStatus` reaches COMPLETED, and API responses must never show `status: ACTIVE` while `onboardingStatus` is anything other than `COMPLETED` | P0 | [PLANNED] |

### 1.3 [REPLACE] Milestone 2 table row

Old:
```
| User model | Roles (OWNER, ADMIN, MANAGER); status lifecycle; soft delete | [IMPLEMENTED] |
```
New:
```
| User model | Roles (OWNER, ADMIN, MEMBER, VIEWER); status lifecycle; soft delete | [IMPLEMENTED] |
```

### 1.4 [REPLACE] FR-TAM-07

Old:
```
| FR-TAM-07 | Role-based access: OWNER manages billing/org; ADMIN manages users/settings; MANAGER manages business/knowledge | P1 | [PLANNED] |
```
New:
```
| FR-TAM-07 | Role-based access: OWNER manages billing/org; ADMIN manages users/settings; MEMBER manages business/domains/onboarding; VIEWER has read-only access — per the permissions matrix in 12-SECURITY-MULTI-TENANCY §10 | P1 | [PLANNED] |
```

### 1.5 [NEW] Interim authorization note — insert after FR-DOM-14

> **Interim MVP authorization decision:** Until `RolesGuard` (FR-TAM-07 dependency) ships, any authenticated member of the business's owning organization may perform all onboarding and domain actions, regardless of role. This is a deliberate, temporary decision — not a gap — and must be revisited when role enforcement ships.

---

## 2. 02-PRODUCT-FLOWS.md

### 2.1 [REPLACE] §7 Domain Verification — DNS TXT Verification block

Replace the entire "DNS TXT Verification" ASCII flow with:

```
User                                System
  |                                   |
  |--- Select DNS TXT method -------->|
  |                                   |
  |--- GET /verification-instructions |
  |    ?method=DNS_TXT -------------->|
  |                                   |
  |                                   |--- Look up domain's stored verificationToken
  |                                   |    (generated at domain-creation time,
  |                                   |     cryptographically random, never equal
  |                                   |     to the domain's own ID)
  |                                   |--- recordName: _replyiq-verification.{domain}
  |                                   |--- recordValue: replyiq-verify-{token}
  |                                   |
  |<-- Instructions:                  |
  |    Record Name:                   |
  |    _replyiq-verification.example.com |
  |    Record Value:                  |
  |    replyiq-verify-{token}         |
  |                                   |
  |--- User adds TXT record to DNS --|
  |    (via DNS provider)             |
  |                                   |
  |--- Click "Verify Domain" ------->|
  |                                   |
  |                                   |--- POST /domains/:id/verify
  |                                   |    { method: "DNS_TXT" }
  |                                   |
  |                                   |--- Server-side DNS lookup:
  |                                   |    resolveTxt(_replyiq-verification.{domain})
  |                                   |--- Compare TXT record value with token
  |                                   |
  |    [Match]                        |
  |                                   |--- Update domain status: VERIFIED
  |                                   |--- Set verifiedAt: now
  |                                   |--- Set verificationMethod: DNS_TXT
  |                                   |--- Update onboarding progress:
  |                                   |    firstDomainVerified: true
  |<-- 200: "Domain verified" --------|
  |                                   |
  |    [Record found, value mismatch] |
  |<-- 400: code=VERIFICATION_MISMATCH|
  |                                   |
  |    [DNS lookup fails - record     |
  |     not found / not propagated]   |
  |<-- 200: code=VERIFICATION_PENDING |
  |    (status remains PENDING)       |
  |--- User sees retry prompt ------->|
```

Same fix applies to §10's "Verify Domain (from Domains page)" narrative wherever it references DNS instructions.

### 2.2 [REPLACE] §7 HTML Meta Verification block

Replace entirely with:

```
User                                System
  |                                   |
  |--- Select HTML Meta Tag method -->|
  |                                   |
  |--- GET /verification-instructions |
  |    ?method=HTML_META ------------->|
  |                                   |
  |                                   |--- Look up domain's stored verificationToken
  |                                   |--- Return:
  |                                   |    htmlContent:
  |                                   |    <meta name="replyiq-verification"
  |                                   |     content="replyiq-verify-{token}" />
  |                                   |
  |<-- Instructions:                  |
  |    Add this tag inside the        |
  |    <head> section of your         |
  |    homepage:                      |
  |    <meta name="replyiq-verification" content="replyiq-verify-{token}" /> |
  |                                   |
  |--- User adds meta tag to their   |
  |    homepage's <head> ------------>|
  |                                   |
  |--- Click "Verify Domain" ------->|
  |                                   |
  |                                   |--- POST /domains/:id/verify
  |                                   |    { method: "HTML_META" }
  |                                   |
  |                                   |--- Resolve domain's public DNS; reject
  |                                   |    private/loopback/reserved IP ranges
  |                                   |--- Server-side HTTP fetch:
  |                                   |    GET https://{domain}/ (fallback to http://)
  |                                   |    (5 second timeout, redirects re-validated
  |                                   |     against the same IP rule, response
  |                                   |     size capped)
  |                                   |--- Parse HTML, look for
  |                                   |    <meta name="replyiq-verification">
  |                                   |--- Compare content attribute with token
  |                                   |
  |    [Match]                        |
  |<-- 200: "Domain verified" --------|
  |                                   |
  |    [Tag found, value mismatch]    |
  |<-- 400: code=VERIFICATION_MISMATCH|
  |                                   |
  |    [Tag not found / fetch fails / timeout] |
  |<-- 200: code=VERIFICATION_PENDING |
```

### 2.3 [REPLACE] §7 Edge Cases

Old bullets to replace:
```
- **Already verified domain:** Attempting to verify again returns 400 "Domain is already verified"
- **No verification token:** Returns 400 "No verification token available"
- **Verification timeout:** HTML meta fetch has a 5-second timeout; DNS resolution failures return PENDING
- **DNS propagation delay:** DNS can take up to 48 hours; user is advised to retry after a few minutes
- **Multiple verification attempts:** User can retry as many times as needed; the challenge token does not change
- **Cross-organization access:** Attempting to verify a domain belonging to another organization returns 403 "Access denied"
```
New:
```
- **Already verified domain:** Attempting to verify again returns 400, code=DOMAIN_ALREADY_VERIFIED
- **No verification token:** Not a reachable state in normal operation (token is always generated at domain creation); if it somehow occurs, returns 500, code=INTERNAL_ERROR, logged server-side for investigation — never shown to the user as "no token."
- **Verification timeout:** HTML meta fetch has a 5-second timeout, a capped response size, and rejects private/loopback/reserved target IPs before connecting (see 12-SECURITY-MULTI-TENANCY §14a). DNS resolution failures return PENDING.
- **DNS propagation delay:** DNS can take from a few minutes up to 48 hours; user is advised this is normal and to retry — instructions never change between attempts.
- **Multiple verification attempts:** User can retry as many times as needed; the verification token does not change between attempts, and repeated attempts are rate-limited per organization (see 12-SECURITY-MULTI-TENANCY §9).
- **Cross-organization access:** Attempting to verify a domain belonging to another organization returns 404 (not 403 — see 09-API-SPECIFICATION §8 information-disclosure rule), code=RESOURCE_NOT_FOUND.
- **Dev/test bypass:** See new §7a below. Never available outside non-production environments, regardless of any client-supplied parameter.
```

### 2.4 [NEW] §7a — Development / Test Verification (insert after §7)

```markdown
## 7a. Development / Test Verification (Non-Production Only)

**Purpose:** Allow automated tests (integration, E2E) and local development to exercise the full
onboarding flow without depending on real DNS propagation or a publicly reachable HTTP server.

**Availability:** Enabled only when BOTH are true, checked once at process startup (not per-request,
and never influenced by any request header, body field, or query parameter):
- `NODE_ENV !== 'production'`
- `ALLOW_DEV_VERIFICATION_BYPASS === 'true'` (a separate, explicit opt-in; the environment check
  alone is not sufficient, since `NODE_ENV` may be misconfigured as `development` in a near-prod
  staging environment that still holds real customer data)

**Mechanism:**
```
Test/Dev User                       System
  |                                   |
  |--- POST /domains/:id/verify ----->|
  |    { method: "DEV_BYPASS" }       |
  |                                   |
  |                                   |--- Check: NODE_ENV !== production
  |                                   |         AND ALLOW_DEV_VERIFICATION_BYPASS
  |                                   |
  |    [Guard fails, i.e. production] |
  |<-- 400: code=INVALID_METHOD ------|
  |    (identical response to any     |
  |     other unrecognized `method`   |
  |     value — no distinguishing     |
  |     error text or status code)    |
  |                                   |
  |    [Guard passes]                 |
  |                                   |--- Verify requester's org owns the domain
  |                                   |    (same authorization check as real methods —
  |                                   |     bypass skips the DNS/HTTP check ONLY,
  |                                   |     never skips ownership authorization)
  |                                   |--- Update domain status: VERIFIED
  |                                   |--- Set verificationMethod: DEV_BYPASS
  |                                   |--- Write audit log entry:
  |                                   |    { event: "dev_verification_bypass_used",
  |                                   |      userId, domainId, timestamp }
  |<-- 200: "Domain verified          |
  |    (development bypass)" ---------|
```

**Constraints:**
- Never weakens the real `DNS_TXT` / `HTML_META` verification paths — this is a fully separate
  `method` enum value with its own guard, not a flag on the existing methods.
- Fails **closed**, not open: any ambiguity in the environment check (missing env var, unexpected
  value) must resolve to "bypass unavailable."
- Domains verified via bypass are visibly tagged `verificationMethod: DEV_BYPASS` everywhere the
  method is displayed (Domains page status, API responses), so seed/test data is never mistaken
  for a real verification in any environment where it's visible at all.
- Must appear in the OpenAPI/Swagger schema only when the bypass is enabled at build/boot time, or
  be documented as present-but-inert — this is an implementation detail for OpenCode to decide, but
  the *behavioral* contract above (fails closed, audited, ownership-checked) is non-negotiable.

**QA requirement:** A dedicated acceptance test must assert that, when the server is started with
`NODE_ENV=production` (regardless of `ALLOW_DEV_VERIFICATION_BYPASS`), a `POST .../verify` request
with `method: "DEV_BYPASS"` returns the exact same response as an invalid enum value. See
14-QA-ACCEPTANCE-DOD.md, new Milestone 4 row.
```

### 2.5 [REPLACE] §1 Registration — response shape and validation status

Old:
```
  |<-- 201 Created:                   |
  |    { session, user, business,     |
  |      organization }               |
```
New:
```
  |<-- 201 Created:                   |
  |    { success: true,               |
  |      message: "Workspace created  |
  |       successfully",              |
  |      data: { session, user,       |
  |      business, organization } }   |
```

Old:
```
  |                                   |--- Validate input
  |                                   |    Missing/invalid field
  |<-- 400: Validation error ---------|
```
New:
```
  |                                   |--- Validate input
  |                                   |    Missing/invalid field
  |<-- 422: code=VALIDATION_FAILED ---|
```

### 2.6 [REPLACE] §10 Delete Domain

Old:
```
                                   |--- DELETE /businesses/:id/domains/:domainId
                                   |
                                   |--- Soft delete (set deletedAt: now)
                                   |--- Domain removed from future queries
```
(This is already correct in Flows — API spec §5.12 is the one to fix, per corrections §4.4 below. No change needed here beyond confirming this block is the source of truth.)

Old edge case:
```
- **Multiple domains:** All listed; ordered by isPrimary (desc), then createdAt (asc)
```
Add immediately after:
```
- **Domain uniqueness is global:** A domain string may belong to at most one business, across all
  organizations, at any time. Attempting to add a domain already claimed elsewhere — whether by
  another business in the same org or a different org entirely — returns 409 with a single generic
  message (see error-copy table below); the response never discloses which org owns it.
- **Deleting a verified domain that satisfies onboarding completion:** `onboardingCompleted` is not
  reverted. The dashboard instead shows a persistent warning ("No active verified domain") until a
  verified domain exists again for the business.
- **Deletion always requires confirmation** in the UI before the DELETE request is sent, regardless
  of the domain's status.
```

### 2.7 [NEW] Backward navigation — insert into §6 after "Step Ordering Constraints"

```markdown
### Editing a Completed Step

- The step list on the Onboarding page is clickable for any step that is either the active step or
  already completed (not for future, not-yet-reachable steps).
- Clicking a completed step re-renders that step's form, pre-filled with current data, without
  losing progress on later steps.
- Editing Step 0 (Profile) never affects `firstDomainAdded`/`firstDomainVerified`/`onboardingCompleted`.
- Editing Step 1 (Domain) to add an *additional* domain does not unset `firstDomainVerified` if a
  previously verified domain still exists; if the user wants to change which domain is verified,
  they must do so from the Domains page (delete + re-add + re-verify), not from within the wizard.
- The wizard's "current step" pointer (used to decide what auto-advances on next visit) is always
  the first *incomplete* step, unaffected by which step the user is currently viewing/editing.
```

---

## 3. 03-UI-UX-SPECIFICATION.md

### 3.1 [REPLACE] §5.4 Step 2: Verification — Method Selection

Old:
```
2. **HTML Meta Tag**
   - Same layout
   - Title: "HTML Meta Tag"
   - Subtitle: "Upload an HTML file to your website (fallback)"
```
New:
```
2. **HTML Meta Tag**
   - Same layout
   - Title: "HTML Meta Tag"
   - Subtitle: "Add a snippet to your website's homepage (fallback)"
```

### 3.2 [REPLACE] §5.4 Instructions Panel — For HTML Meta

Old:
```
For HTML Meta:
- Title: "HTML File Instructions"
- Description: references `/{htmlFileName}` path (inline code)
- Content: `block text-xs bg-white px-2 py-1 rounded border border-gray-200 font-mono whitespace-pre-wrap`
```
New:
```
For HTML Meta:
- Title: "Website Snippet Instructions"
- Description: "Add this tag inside the `<head>` section of your homepage:" (`text-xs text-gray-600`)
- Content: monospace code block, same styling as DNS record value —
  `block text-xs bg-white px-2 py-1 rounded border border-gray-200 mt-0.5 font-mono`
- Note: "If you're not sure how to edit your site's `<head>`, the DNS method above usually doesn't
  require any code changes." (`text-xs text-gray-500 mt-2`)
```

### 3.3 [REPLACE] Banner copy — Verification Pending

Every occurrence of:
```
"Verification pending -- the challenge record is not yet reachable. Make sure you have added the
 DNS record and try again in a few minutes."
```
Replace with:
```
"We haven't found your verification yet. This is normal right after adding a DNS record or website
 snippet — it can take a few minutes. Double-check you copied the full value, then try again."
```

(Applies to both the Onboarding Step 2 pending banner and the Verify Modal pending banner in §5.6.)

### 3.4 [NEW] Verification mismatch banner — add to §5.4 and §5.6 (currently absent; both docs only specify a "pending" banner, never a "found but wrong" banner)

```markdown
**Verification Mismatch Banner (conditional, new):**
- Shown when the backend returns code=VERIFICATION_MISMATCH (a record/tag was found, but its value
  doesn't match what's expected — usually a copy-paste error)
- `p-3 rounded-lg bg-red-50 border border-red-200`
- Text: "We found something, but it doesn't quite match what we're expecting. Double-check you
  copied the entire value with nothing extra or missing, then try again." (`text-sm text-red-700`)
- Distinguished from the yellow "still checking" banner, which means nothing was found yet at all.
```

### 3.5 [NEW] Delete confirmation — add to §5.6 Domains Page, after "Delete Domain" behavior

```markdown
**Delete Confirmation (new, required):**
- Clicking "Delete" on any domain (verified or pending) opens a confirmation modal before the
  DELETE request is sent — no destructive action fires immediately from a single click.
- Modal title: "Remove {domain}?"
- Body copy (verified domain): "Your AI receptionist will stop responding on this website once it's
  removed. You can add it back later, but you'll need to verify it again."
- Body copy (pending/unverified domain): "This will remove the domain and its pending verification.
  You can add it again anytime."
- Footer: Cancel (secondary) / Remove (danger), same button pattern as the Verify Modal.
```

### 3.6 [NEW] "No active verified domain" dashboard state — add to §5.3 Dashboard Page, after Empty States table

```markdown
**No Active Verified Domain Warning (conditional, new):**
- Shown when `onboardingStatus === COMPLETED` but the business currently has zero domains with
  `status === VERIFIED` (e.g., the previously-verifying domain was deleted).
- Distinct from the onboarding progress card (which only shows pre-completion) — this is a
  persistent warning banner at the top of the dashboard, `bg-yellow-50 border border-yellow-200`.
- Text: "Your AI receptionist doesn't have a verified website right now. Add and verify a domain to
  reactivate it." with a link to `/dashboard/domains`.
```

### 3.7 [REPLACE] §11.1 Breakpoints table

Old:
```
| Breakpoint     | Width     | Behavior                                      |
|----------------|-----------|-----------------------------------------------|
| Mobile         | < 768px   | Single column, sidebar hidden                 |
| Tablet         | 768-1023px| Single column, sidebar hidden                 |
| Desktop        | >= 1024px | Sidebar visible, multi-column where applicable|
```
This table is already correct — it is 14-QA-ACCEPTANCE-DOD.md §3.5 that must be changed to match it (see §6.1 below). No change needed here.

### 3.8 [NEW] "Check again" retry affordance — add to §5.4 Step 2, Action Button subsection

```markdown
**Retry Affordance:**
- After a "still checking" (pending) result, the primary button relabels from "Verify Domain" to
  "Check again" (same position, same styling) — communicating that this is an expected,
  ordinary retry action, not a failure requiring a different flow.
- No new instructions are shown on retry; the record name/value or snippet remain identical.
```

---

## 4. 09-API-SPECIFICATION.md

### 4.1 [REPLACE] §5.2 Register — Response

Old:
```json
{
  "session": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 },
  "user": { ... },
  "business": { ... },
  "organization": { ... }
}
```
New:
```json
{
  "success": true,
  "message": "Workspace created successfully",
  "data": {
    "session": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 },
    "user": { ... },
    "business": { ... },
    "organization": { ... }
  }
}
```

### 4.2 [REPLACE] §5.7/§5.8 Business object example

In both examples, change:
```json
"onboardingStatus": "IN_PROGRESS",
"status": "ACTIVE",
```
to:
```json
"onboardingStatus": "IN_PROGRESS",
"status": "DRAFT",
```
And add a note directly beneath both examples:
```
`status` becomes `"ACTIVE"` only once `onboardingStatus` reaches `"COMPLETED"`. The two fields must
never be shown or persisted in a combination implying completion of one without the other where a
dependency exists (see 01-PRODUCT-REQUIREMENTS FR-BIZ-06).
```

### 4.3 [REPLACE] §5.11 Verify Domain — add PENDING/FAILED examples

Add after the existing 200/VERIFIED example:

```json
// PENDING (record/tag not yet found — normal during propagation)
{
  "success": true,
  "message": "Verification pending",
  "data": {
    "domain": {
      "id": "clx5566778899",
      "status": "PENDING",
      "verifiedAt": null,
      "verificationMethod": null
    },
    "code": "VERIFICATION_PENDING"
  }
}
```

```json
// 400 — record/tag found but value mismatch
{
  "statusCode": 400,
  "code": "VERIFICATION_MISMATCH",
  "message": "Verification record found but value did not match",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

Also add to the `method` enum documentation:
```
`method` accepts `"DNS_TXT"` or `"HTML_META"` in all environments. A third value, `"DEV_BYPASS"`,
is accepted only when the server was started with NODE_ENV != production AND
ALLOW_DEV_VERIFICATION_BYPASS=true; in any other environment it is rejected identically to an
unrecognized enum value (400, code=INVALID_METHOD), with no distinguishing response.
```

### 4.4 [REPLACE] §5.13 Verification Instructions examples

Old (`DNS_TXT`):
```json
{
  "data": {
    "recordName": "_replyiq-verification.acme.com",
    "recordValue": "replyiq-verify=clx5566778899",
    "htmlFileName": null,
    "htmlContent": null
  }
}
```
New:
```json
{
  "success": true,
  "message": "Verification instructions retrieved successfully",
  "data": {
    "recordName": "_replyiq-verification.acme.com",
    "recordValue": "replyiq-verify-a1b2c3d4e5f6...",
    "htmlContent": null
  }
}
```

Old (`HTML_META`):
```json
{
  "data": {
    "recordName": null,
    "recordValue": null,
    "htmlFileName": null,
    "htmlContent": "<meta name=\"replyiq-verification\" content=\"clx5566778899\" />"
  }
}
```
New:
```json
{
  "success": true,
  "message": "Verification instructions retrieved successfully",
  "data": {
    "recordName": null,
    "recordValue": null,
    "htmlContent": "<meta name=\"replyiq-verification\" content=\"replyiq-verify-a1b2c3d4e5f6...\" />"
  }
}
```
Note: `htmlFileName` is removed from the schema entirely (it belonged to the discarded file-upload
mechanism). The token value (`a1b2c3d4e5f6...`) is a stored, random `verificationToken` — never the
domain's own `id`.

### 4.5 [REPLACE] §5.12 Delete Domain

Old:
```
**Description:** Removes a domain from the business. This is a hard delete.
```
New:
```
**Description:** Removes a domain from the business. This is a soft delete — the record's
`deletedAt` is set and it is excluded from all future queries, consistent with the Business
soft-delete pattern (FR-BIZ-04). A soft-deleted domain string may be re-added later; global
uniqueness (FR-DOM-10) is checked only against active (non-deleted) domains.
```

### 4.6 [REPLACE] §7 Refresh Token — Lifetime

Old:
```
**Lifetime:** 7 days (default). Single-use: rotation on refresh invalidates the previous token.
```
New:
```
**Lifetime:** 30 days (default). Single-use: rotation on refresh invalidates the previous token.
```

### 4.7 [NEW] Error code field — add to §1.7 Error Response Format

Old:
```json
{
  "statusCode": 400,
  "message": "Error description or array of validation errors",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```
New:
```json
{
  "statusCode": 400,
  "code": "STABLE_MACHINE_READABLE_CODE",
  "message": "Error description or array of validation errors",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```
Add: "`code` is a stable, documented identifier the frontend uses to select user-facing copy from a
maintained translation table (see 03-UI-UX-SPECIFICATION §10a). `message` remains a
developer-oriented string for logs and is never displayed to end users directly for
authenticated-app errors (auth-page generic messages such as 'Invalid email or password' are the
one deliberate exception, since that string is already user-appropriate)."

### 4.8 [REPLACE] §2 Exception Mapping

Old:
```
| `ValidationException` | 422 |
```
Confirm this stays 422, and add a note: "DTO/field validation failures (missing/malformed fields)
always return 422 with `code: VALIDATION_FAILED`. Business-rule failures that are not field
validation (e.g., 'complete the profile step first') remain 400."

### 4.9 [NEW] §3 Rate Limiting — add rows

Add to the table:
```
| POST /api/v1/businesses/:id/domains | 60 minutes | 10 | Organization |
| POST /api/v1/businesses/:id/domains/:domainId/verify | 60 minutes | 20 | Organization |
```

---

## 5. 12-SECURITY-MULTI-TENANCY.md

### 5.1 [REPLACE] §4 Session Revocation

Old:
```
### Session Revocation

- On logout, the session record is deleted from the database
- Subsequent refresh attempts with the rotated token will fail because the session no longer exists
```
New:
```
### Session Revocation

- On logout, the session record's `revokedAt` is set to the current time (soft revoke) — the row is
  not deleted, preserving it for audit and enabling idempotent "already logged out" responses.
- Subsequent refresh attempts against a revoked session fail with 401, code=SESSION_REVOKED.
- A scheduled cleanup job (see §4 Known Gaps, "No session cleanup") should periodically purge
  sessions that are both revoked and past a retention window (e.g., 90 days), not sessions in
  general — expired-but-unrevoked sessions may still hold forensic value up to that window.
```

### 5.2 [NEW] §9 Required Rate Limits — add rows

Add to the "Required Rate Limits for Production" table:
```
| POST /api/v1/businesses/:id/domains | 10 requests | 60 minutes, per organization |
| POST /api/v1/businesses/:id/domains/:domainId/verify | 20 requests | 60 minutes, per organization |
```

### 5.3 [NEW] §11 Organization Isolation — Required Implementation, add item

Add to the numbered list:
```
5. Treat every onboarding and domain endpoint (`/businesses/:id`, `/businesses/:id/onboarding*`,
   `/businesses/:id/domains*`) as a mandatory, named target for the `OrganizationGuard` —
   these are the highest-value targets for the primary onboarding/domain product surface and
   must not be deferred as part of the general "audit every query" cleanup.
```

### 5.4 [NEW] §13a — Development / Test Verification Bypass: Security Constraints (insert after §13 API Authorization)

```markdown
## 13a. Development / Test Verification Bypass — Security Constraints

A `DEV_BYPASS` verification method exists solely to unblock automated testing of the onboarding
flow (see 02-PRODUCT-FLOWS §7a for the user-facing flow). Its security constraints:

1. **Fail closed.** The guard is `NODE_ENV !== 'production' AND ALLOW_DEV_VERIFICATION_BYPASS ===
   'true'`, evaluated once at process boot from environment variables only. No request header,
   body field, query parameter, or JWT claim may influence this decision.
2. **No distinguishing response in production.** When the guard fails, the endpoint must respond
   exactly as it would to any other unrecognized `method` value — same status code, same `code`,
   same message shape — so that probing for the bypass's existence is indistinguishable from
   probing for typos.
3. **Ownership authorization is never skipped.** The bypass replaces only the DNS/HTTP check; the
   existing "does this user's organization own this domain" authorization check still applies in
   full. The bypass is a shortcut around network verification, not around access control.
4. **Always audited.** Every successful use writes an audit log entry (`dev_verification_bypass_used`,
   userId, domainId, timestamp) — this is the one audit event that should exist even before general
   audit logging (§17) ships, given its security sensitivity.
5. **Visibly tagged.** Any domain verified this way is stored and displayed with
   `verificationMethod: DEV_BYPASS`, never conflated with `DNS_TXT`/`HTML_META` in any UI, log, or
   analytics surface.
6. **QA gate, not just a code review item.** A standing acceptance test must run against a
   prod-configured build and assert the bypass is unavailable (see
   14-QA-ACCEPTANCE-DOD.md, new Milestone 4 acceptance row).
```

### 5.5 [NEW] §14 Input Validation — SSRF guardrails (insert as new subsection)

```markdown
### 14a. SSRF Prevention for HTML Verification

The HTML verification method performs a server-initiated HTTP fetch to a user-supplied domain
(`GET https://{domain}/`, falling back to `http://`). Because the target is attacker-influenced
(any authenticated user can enter any domain string), this fetch must:

1. Resolve DNS for `{domain}` before connecting, and reject the request (return
   `VERIFICATION_PENDING`, not an error that reveals the reason) if any resolved address falls in
   a private, loopback, link-local, or otherwise reserved IP range (RFC 1918, RFC 4193,
   169.254.0.0/16, 127.0.0.0/8, etc.).
2. Disable automatic redirect-following, or re-apply the same IP check to the target of every
   redirect hop before following it.
3. Enforce the existing 5-second timeout and add a response body size cap (e.g., 1 MB) to prevent
   resource exhaustion from a slow-loris or oversized response.
4. Never reflect the underlying fetch error (DNS failure, connection refused, TLS error, timeout)
   to the client — all such outcomes collapse to the same `VERIFICATION_PENDING` result the client
   already sees for "not found yet," so no information about the target's network topology leaks
   back to the requester.
```

### 5.6 [REPLACE] §10 RBAC — no content change, add cross-reference note

Add beneath the existing permissions matrix:
```
> This role list (`OWNER, ADMIN, MEMBER, VIEWER`) is the single source of truth for the platform.
> 01-PRODUCT-REQUIREMENTS.md and 02-PRODUCT-FLOWS.md must match it exactly.
```

---

## 6. 14-QA-ACCEPTANCE-DOD.md

### 6.1 [REPLACE] §3.5 Responsive Testing — Breakpoints table

Old:
```
| Tier | Viewport | Target |
|------|----------|--------|
| Mobile | < 1024px | Phones, small tablets |
| Tablet | 1024px - 1440px | iPads, small laptops |
| Desktop | > 1440px | Standard monitors, large displays |
```
New:
```
| Tier | Viewport | Target |
|------|----------|--------|
| Mobile | < 768px | Phones |
| Tablet | 768px - 1023px | iPads, small laptops (sidebar still hidden, hamburger menu) |
| Desktop | >= 1024px | Standard monitors, large displays (sidebar always visible) |
```
Note: matches 03-UI-UX-SPECIFICATION.md §11.1 exactly, and the actual `lg:` (1024px) Tailwind
breakpoint used throughout the Sidebar/AppLayout implementation. The existing Playwright viewport
list (375x812, 768x1024, 1440x900, 2560x1440) already exercises this correctly and needs no change.

### 6.2 [NEW] §3.3 E2E Test Matrix — add rows

Add to the existing table:

| Flow | Steps | Success Criteria |
|------|-------|-----------------|
| Onboarding resume — refresh | Complete Step 0 -> refresh browser mid-Step-1 | Wizard resumes at Step 1 with Step 0 data intact |
| Onboarding resume — new session | Complete Steps 0-1 -> log out -> log back in | Wizard resumes at Step 2 |
| Onboarding — direct nav after completion | Complete all steps -> navigate to /onboarding directly | Shows "Onboarding Complete" state, does not restart wizard |
| Onboarding — edit completed step | Complete Step 0 -> click Step 0 in step list -> change industry -> save | Step 0 updates; Steps 1-3 progress unaffected |
| Domain deletion — confirmation required | Click Delete on a verified domain | Confirmation modal appears; canceling leaves domain intact; confirming deletes it |
| Domain deletion — post-completion warning | Complete onboarding -> delete the only verified domain | onboardingCompleted remains true; dashboard shows "no active verified domain" warning |
| Cross-tenant domain claim | Org A verifies example.com -> Org B attempts to add example.com | Org B receives 409 with generic message; response does not reveal Org A's identity |
| Dev-bypass rejected in production | Start server with NODE_ENV=production -> POST verify with method=DEV_BYPASS | Response identical (status, code, message) to an unrecognized method value |
| SSRF guard | Add a domain resolving to a private/loopback IP -> attempt HTML_META verification | Request rejected before any outbound fetch; result is VERIFICATION_PENDING, no internal detail leaked |
| Verification instruction stability | Request DNS instructions twice for the same pending domain | recordName and recordValue identical both times |
| Error-copy contract | Trigger every documented error `code` in the app | Every one resolves to defined user-facing copy from the translation table; no raw backend `message` string is ever rendered in the UI |

### 6.3 [NEW] §4 Milestone 4 Acceptance Criteria — add to Phase 4A

Add:
```
- [ ] Organization-scoping is enforced (not just implemented at the service layer) on every
      onboarding and domain endpoint, verified by an automated cross-tenant-access test per endpoint
- [ ] Domain deletion always requires UI confirmation before the request is sent
- [ ] Deleting the only verified domain after onboarding completion does not revert
      `onboardingCompleted`, and surfaces the "no active verified domain" dashboard warning
- [ ] The DEV_BYPASS verification method is provably unavailable when NODE_ENV=production, verified
      by an automated test run against a prod-configured build
- [ ] Every documented backend error `code` for onboarding/domain flows maps to defined,
      non-technical user-facing copy; no raw backend `message` string reaches the UI
```

---

## 7. User-Facing Error Copy — Master Translation Table

> New reference table, to live in 03-UI-UX-SPECIFICATION.md as a new §10a "Error Copy Reference,"
> keyed by the `code` field added to the API error shape (Section 4.7 above). This is the
> authoritative mapping every raw backend string must resolve through before reaching a user.

| `code` | Raw backend reality | User-facing message | Explanation shown | Suggested action | Retry available? |
|---|---|---|---|---|---|
| `VALIDATION_FAILED` | 422 array of field errors | "Some details need a second look." | Field-level messages shown inline under each input (e.g., "Enter a domain like example.com") | Fix highlighted fields | Yes, immediately |
| `DOMAIN_ALREADY_REGISTERED` | 409 "Domain already registered" | "That domain is already set up somewhere." | "This domain is already connected to an account. If this is your website and you believe this is a mistake, contact support." | Try a different domain, or contact support | No (until domain changed) |
| `DOMAIN_ALREADY_VERIFIED` | 400 "Domain is already verified" | "This domain is already verified." | "Nothing more to do here." | Continue to next step | N/A |
| `VERIFICATION_PENDING` | 200 (PENDING) / DNS or fetch not found | "We haven't found your verification yet." | "This is normal right after adding a DNS record or website snippet — it can take a few minutes." | Check again | Yes |
| `VERIFICATION_MISMATCH` | 400, record/tag found but wrong value | "We found something, but it doesn't match." | "Double-check you copied the entire value, with nothing extra or missing." | Re-copy and try again | Yes |
| `ONBOARDING_STEP_OUT_OF_ORDER` | 400 "Complete profile step first" / "Add a domain first" / "Verify a domain first" | "Let's finish the step before this one first." | Names the specific missing prerequisite in plain language, e.g., "Add a website domain before verifying it." | Return to the earlier step (wizard auto-navigates there) | N/A |
| `ONBOARDING_ALREADY_COMPLETE` | 400 "Onboarding is already completed" | "You're all set — setup is already complete." | — | Go to Dashboard | N/A |
| `RESOURCE_NOT_FOUND` | 404 "Business not found" / cross-org 404 | "We couldn't find that." | "This may have been moved or removed, or you may not have access." | Go back to Dashboard | N/A |
| `SESSION_REVOKED` / `SESSION_EXPIRED` | 401 various | "You've been signed out." | "For your security, please sign in again." | Sign in | N/A (redirect to login) |
| `INVALID_CREDENTIALS` | 401 "Invalid email or password" | "That email or password doesn't match our records." | (kept deliberately generic — see security note below) | Try again, or reset your password | Yes |
| `RATE_LIMITED` | 429 | "You're doing that a little too fast." | "Please wait a moment before trying again." | Wait and retry | Yes, after a short wait |
| `INVALID_METHOD` (incl. rejected DEV_BYPASS) | 400 | "That verification method isn't available." | — | Choose DNS or website snippet instead | N/A |
| `INTERNAL_ERROR` | 500 (any unhandled failure) | "Something went wrong on our end." | "This isn't something you did. Please try again in a moment." | Retry; contact support if it keeps happening | Yes |
| `NETWORK_ERROR` (client-side, no response) | Frontend fetch failure | "We couldn't reach ReplyIQ." | "Check your internet connection and try again." | Retry | Yes |

**Security note on `INVALID_CREDENTIALS`:** this is the one place a generic, non-specific message is
*already correct* and must stay that way (per FR-AUTH-09 / NFR-SEC-08) — the goal here is not to add
detail, only to confirm the existing generic string is deliberate and documented, not an oversight
like the others in this table.
