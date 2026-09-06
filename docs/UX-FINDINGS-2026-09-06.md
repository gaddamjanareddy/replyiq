# UX findings — 2026-09-06

Found by the owner driving the deployed product through registration and the
first two steps of domain verification. Each item below was then checked
against the code, so this records what is actually wrong rather than what it
looked like from the outside.

Not yet implemented. Ordered by what should be fixed first.

---

## 1. ~~There is no password reset. At all.~~ — **DONE (2026-09-06)**

Built: request → emailed single-use token → set new password, with expiry,
session revocation on completion, and no account-enumeration leak. Three
transports (`log`, `resend`, `smtp`) because the cheapest option depends on
whether the operator has a sending domain — `smtp` needs none, so a plain
mailbox with an app password serves real users today. 9 integration tests.

Still inert in production until an operator sets `EMAIL_TRANSPORT`; the
endpoint declines honestly rather than promising an email it cannot send.

Original finding follows.

---

Reported as a question ("is there a forgot password option?"). There is not:

```
grep -rn "forgot|reset-password|resetPassword" apps/api/src  -> no matches
grep -rni "forgot" apps/web/src                              -> no matches
```

Neither the API nor the dashboard has any recovery path. **Anyone who forgets
their password is permanently locked out of their business**, with no
self-service route back in and no operator tooling to help them. For a product
whose users are small-business owners logging in occasionally, this is not a
missing nicety — it is a guaranteed support incident and a plausible reason to
lose an account entirely.

This is the only finding here that can lose a customer outright, which is why
it is first despite being the least visible.

**Work:** token-based reset (request → emailed single-use token → set new
password), token expiry and single-use enforcement, rate limiting on the
request endpoint, and the same "don't reveal whether the address exists"
discipline the verification path already applies. Needs an email sender, which
the product does not yet have — so this pulls in transactional email as a
dependency.

---

## 2. ~~Validation errors never reach the field~~ — **DONE (2026-09-06)**

Fixed across the whole chain. The ValidationPipe now emits a `fields` map of
constraint NAMES (`maxLength`, `isEmail`) — not sentences — so the copy
contract holds and no backend prose reaches the screen. The filter forwards
it, the client maps each constraint to reviewed copy, and register and
business-profile attach it to the input. Errors clear as each field is edited.

Also ordered by severity: a five-character password comes back as
["matches", "minLength"] in decorator order, so arrival order told the user to
add a symbol when the real problem was length.

Verified in the browser against the real API. 24 new tests.

Original finding follows.

---

Reported as: *"we are showing we will highlight the field which you entered
wrong but we not highlighting the field, it is showing only in the network
error 422."*

Confirmed. The API returns a correct 422 with class-validator's messages, but
the chain drops them:

- `global-exception.filter.ts` passes `message` through as a **string array**
  (`["industry must be shorter than or equal to 100 characters"]`) — the field
  name is embedded in prose, not exposed as a structured field.
- `apps/web/src/api/client.ts` has no 422 handling and no field-error mapping,
  so nothing can attach an error to an input.
- `Input` already supports `error` and wires it to `aria-describedby` — the
  component was built for this. Nothing is feeding it.

So the UI silently discards a validation failure the user can only find in
devtools. That reads as "the button doesn't work".

**Work:** give the `ValidationPipe` an `exceptionFactory` that emits structured
`{ field, messages[] }`, extend the client to parse 422 into a field-error map,
and surface it through the existing `Input error` prop. The reviewed-copy
contract still applies: map to reviewed copy per field rather than rendering
backend prose, which also fixes the second half of the complaint — the raw
message names the field in a way only a developer would parse.

---

## 3. ~~`industry` is capped at 100 characters~~ — **PARTLY DONE (2026-09-06)**

The field now has `maxLength` plus a live character counter that appears as the
limit approaches, and a hint saying it wants a short label rather than a
description. So the cap is visible while typing instead of discovered on
submit.

Still open: making the field say what it wants structurally — a combobox of
common industries with free-text fallback.

Original finding follows.

---

Reported as the description limit being too small. The actual limits:

| Field | Limit |
|---|---|
| `name` | 200 |
| `industry` | **100** |
| `description` | 2000 |
| (contact) | 500 |

`description` is already generous. The field that rejected the input was
**`industry`**, and the real problem is not the number — it is that a free-text
box labelled "Industry" invites a business owner to describe their business,
because that is what the word means to them. They then hit a limit that makes
no sense for what they thought they were answering.

**Work:** raising the cap treats the symptom. Better is to make the field say
what it wants — a combobox of common industries with free-text fallback, and
a character counter on any field that has a limit so the ceiling is visible
before it is hit, not after. Revisit the 100 only once the field's purpose is
unambiguous.

---

## 4. ~~No show/hide password toggle~~ — **DONE (2026-09-06)**

`PasswordInput` with a reveal toggle on login, register and reset. It is a
`type="button"` — a bare button in a form submits it — and its accessible name
changes with state.

Original finding follows.

---

Confirmed: `LoginPage.tsx:76` and `RegisterPage.tsx:108` are plain
`type="password"` with no reveal control.

This costs most at **registration**, where someone is inventing a password
against complexity rules they cannot see themselves satisfying. Failing that
silently is a real drop-off point.

**Work:** a reveal toggle inside the field. Must be a `<button type="button">`
(a bare button in a form submits it), labelled, and it must announce state to
screen readers rather than only swapping an icon.

---

## 5. ~~The visual design is still ordinary~~ — **DARK THEME DONE (2026-09-06)**

A full dark theme now ships, built by redefining what the existing tokens MEAN
per theme rather than adding `dark:` variants to 290-odd call sites — so a
component written tomorrow cannot forget to support it. Light / System / Dark,
`system` tracking the OS live, and an inline pre-paint script so a dark-mode
user never gets a white flash on load.

Three things measured rather than eyeballed:

- Every text/background pair clears WCAG AA in **both** themes (page text 17.3:1
  dark, muted text 4.96:1 dark, links 8.59:1 dark).
- Lightening the accent ramp for dark was tried and **reverted**: it dropped the
  primary button to ~2.4:1 white-on-blue, worse than the light theme. Accents
  move up the ramp when used as text, not as fills. Now 5.03:1.
- Placeholders were 2.6:1 in both themes — a pre-existing AA failure, now 4.84:1.

A 200ms colour crossfade on `body` was also tried and reverted: Chromium
freezes a transitioned property at its old computed value when the value comes
from a custom property, so the body stayed light while everything else went
dark.

Still open: the page-level density/hierarchy pass, and motion inside the pages
rather than only in the shell.

Original finding follows.

---

Reported as: the UI has not changed; wants a dark theme, a premium feel, real
animation, while staying easy for non-technical owners.

Partly fair, and worth being precise about what exists. There **is** a design
system — brand and ink `oklch` ramps, elevation, easing curves, seven
animations, skeletons, a reduced-motion block — and the app shell now uses it.
What does not exist:

- **No dark theme.** The palette is single-mode. Every token, and every
  hard-coded `bg-white` in the pages, would need to become theme-aware.
- **Animation is applied thinly.** Defined and used in the shell; the pages
  themselves mostly do not move.
- **The pages are conventional.** Cards on a light grey ground. Correct,
  legible, unremarkable.

**Work:** this is a design project, not a styling pass. It splits into (a)
tokens → semantic theme-aware variables plus a theme toggle honouring
`prefers-color-scheme`, (b) a considered pass over each page's hierarchy and
density, and (c) motion that carries meaning — state transitions, progress,
success — rather than decoration.

Worth stating plainly: **"premium with crazy animations" and "easy to
understand for small-business owners" pull against each other.** The current
copy and flow are unusually good at the second. The design should get more
confident without spending the clarity that has already been built — where they
conflict, the owner finishing setup wins.

---

## Suggested order

1. **Password reset** — the only one that loses accounts.
2. **Field-level validation errors** — cheap, and currently makes forms feel broken.
3. **Password reveal** + **industry field** — small, same area of the product.
4. **Dark theme and the design pass** — largest, best done as its own piece of work with the receptionist widget, so the new surface is designed once rather than restyled twice.
