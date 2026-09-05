# ReplyIQ — The Whole Flow, in Simple Steps

> What actually happens, from "never heard of ReplyIQ" to "my AI receptionist is
> live", written to be read start to finish in ten minutes.

> **Status:** Approved
> **Last Updated:** 2026-09-05
> **Audience:** Everyone. No prior knowledge of the codebase assumed.
> **Companion:** `16-DOMAIN-VERIFICATION-AND-TEST-MODE.md` has the precise
> mechanics; this has the story.

---

## The one-paragraph version

You sign up. You tell us a little about your business. You tell us your website
address. You prove the website is yours — by adding a small DNS record, or by
pasting a snippet into your homepage, or (if you don't have a domain yet) by
using a reserved test address that verifies instantly. Setup is then complete,
and your dashboard shows whether you are **live**, in **test mode**, or
**offline**. Nothing you do can get you stuck: every step has a second route,
and every state has a way out.

---

## Part 1 — Signing up

### Step 1. Create your workspace

You give four things: business name, your name, email, password.

The password rules (12+ characters, upper, lower, a number, a symbol) are shown
as a **live checklist** that ticks off as you type — so you learn the rules
before you're rejected by them, not after.

**What happens behind the scenes:** one database transaction creates four
things together — an Organization (your company), a Business (the thing the
receptionist works for), a User (you, as OWNER), and a Session. Either all four
exist or none do. There is no half-created account.

You get two tokens: a short-lived access token (15 minutes) and a long-lived
refresh token (30 days). You land straight on the setup wizard — no email
confirmation gate, no waiting.

**If something goes wrong:** the email is already taken → you're told plainly
and offered the sign-in page.

---

## Part 2 — Setup, in four steps

The wizard shows all four steps at once, so you can see how much is left. Your
progress lives on our server, not in your browser — **close the tab, come back
next week, or sign in on your phone, and you resume exactly where you were.**

### Step 2. Tell us about your business

Three optional fields: what you do, anything else worth knowing, and your
website address.

All optional. The framing is honest: the more you say, the more your
receptionist sounds like you. Skip it entirely if you like.

*Small kindness:* if you enter a website here, the next step's field is
pre-filled with it. You never type your domain twice.

### Step 3. Tell us your website

One field. Paste whatever your browser shows you — `https://www.acme.com/pricing`
— and we reduce it to `acme.com` for you. Rejecting that on a technicality
would be a wall with no purpose.

If you get it wrong, we say **what** is wrong, not just "invalid":

| You typed | We say |
|---|---|
| `acme` | "Add the ending too — did you mean acme.com?" |
| `acme test.com` | "Web addresses can't contain spaces" |
| `acme_test.com` | "Web addresses can't contain underscores" |
| `acme.123` | "The ending should be letters, like .com or .co.uk" |

**Don't have a domain yet?** There's an expandable note that says so, and tells
you to enter something like `my-business.example.com`. More on that in Part 3.

**If someone already claimed that domain:** you get a clear message and no
detail about who. We never confirm which account holds a domain — that would
help someone probing for it.

### Step 4. Prove the website is yours

This is the only step that involves anything technical, and it offers **two
routes aimed at two different people**. You only need one.

#### Route A — Add a DNS record *(best if you can sign in wherever you bought the domain)*

We show you two values, each with a copy button:

```
Record name:  _replyiq-verification.acme.com
Record value: replyiq-verify-8f14e45f-ceea-467a-9a1b-2c3d4e5f6071
```

You add a TXT record with those in GoDaddy / Cloudflare / Namecheap / wherever.
Click **Verify domain**. We look it up.

We also tell you the truth about timing: DNS usually takes minutes, occasionally
up to a day, and *that's normal*.

#### Route B — Paste a snippet into your website *(best if you can edit your site)*

We show you one line, with a copy button:

```html
<meta name="replyiq-verification" content="replyiq-verify-8f14e45f-...">
```

It goes in your homepage's `<head>`. Most site builders have a box for this
called "header code", "custom head" or "site-wide scripts". It's invisible to
visitors, and it works immediately.

*Can't edit your homepage?* A collapsed link reveals a third option: upload a
plain text file to `/.well-known/replyiq-verification.txt`. Same method, same
token — we check all three placements.

#### What you can be told

There are only three outcomes, and they are deliberately kept apart:

| Result | Colour | What it means | What you do |
|---|---|---|---|
| **Verified** | Green | Done | Continue |
| **We haven't found it yet** | Amber | Completely normal — DNS is still spreading | Press **Check again**, whenever |
| **We found something, but it doesn't match** | Red | You published something, and it's not quite right — almost always a copy-paste that gained a space | Copy the value again and retry |

That middle/last distinction is the single most important thing on this screen.
Merging them into one "verification failed" would send half of users hunting for
a typo that doesn't exist, and tell the other half to "wait" when waiting will
never help.

**Two promises:**
- After a "not found yet", the button relabels from *Verify domain* to
  **Check again** — because retrying is expected, not a second attempt at
  something that failed.
- **The instructions never change.** Walk away for three days and come back:
  same record, same value, same snippet. Nothing about setup is a moving target.

### Step 5. Finish

A confirmation, a preview of what comes next (teaching your receptionist about
your business), and a **Finish setup** button.

At that moment, in one transaction: onboarding is marked complete and your
business becomes ACTIVE. Both, or neither.

---

## Part 3 — "But I don't have a domain yet"

This is the wall that quietly loses people, so it has a door.

### Test mode

Enter something like **`my-business.example.com`**. As soon as you type it, a
purple note appears: *"That's a test address."*

Addresses ending in `.example.com`, `.test`, `.invalid`, `.localhost`, `.local`
or `.internal` are reserved by the internet's standards bodies. **Nobody can
own them — not you, not us, not anyone.** So there's no website for us to
check, and they verify instantly.

You then walk through the entire product — every screen, every state, the real
dashboard — and swap in your real website whenever you're ready.

### Why this is safe

Because the rule isn't "trust the user". The rule is *"this name cannot belong
to anybody"*:

- You **cannot** test-verify `google.com`, or any real domain. Not with any
  account, any role, any setting, in any environment. The attempt is refused.
- Conversely, a test address **cannot** go through the DNS or snippet routes —
  it has no real website, so there's nothing to check.
- Test-verified websites are labelled **Test domain** everywhere they appear,
  and your business shows a persistent **Test mode** banner.
- When the chat widget ships, it will refuse to serve real visitors on a test
  address.

Real verification is untouched by any of this. It's a separate route with its
own rules, not a switch on the real one.

---

## Part 4 — Living with it

### Your dashboard tells you the truth

Three states, always visible:

| State | What it means |
|---|---|
| **Live** | You have a verified real website. Everything works. |
| **Test mode** | The only website you've verified is a test address. Purple banner: *"Your receptionist isn't answering real visitors yet."* |
| **Offline** | You have no verified website at all. Amber banner: *"Your AI receptionist is offline."* |

That last one matters. If you finish setup and later remove your only verified
website, you're **offline** — and the dashboard says so, loudly, instead of
still showing a cheerful "setup complete" for a receptionist that can't answer
anyone.

Finishing setup stays finished, though. It's a historical fact, and removing a
domain doesn't undo your history — it just changes your present.

### Adding more websites

The Websites page: add, verify, remove. Same two routes, same copy buttons.
Each row shows its status, when it was last checked, and how it was verified.

### Removing a website

Two levels, matched to the consequences:

1. **An ordinary website** → a simple "Remove?" confirmation.
2. **Your only verified website** → we stop you, explain that this takes your
   receptionist offline, and ask you to **type the domain name** to confirm.
   That's the only pattern that reliably interrupts an autopilot click.

The second check also lives on the API itself, not just in the dialog — so a
script, a stale app, or a stray `curl` can't silently take you offline either.

### Changing a website address

Not supported, on purpose. A domain is a claim of ownership, and letting you
edit the string would let you edit the claim. Remove it and add the new one —
which forces a fresh proof, which is the whole point.

---

## Part 5 — What we won't show you

Every message in this product was written for a person. No stack traces, no
status codes, no field names, no "challenge record not reachable".

Behind the scenes the API returns a stable code like
`DOMAIN_VERIFICATION_MISMATCH`, and the app looks up reviewed copy for it. There
is an automated test that fails the build if the API can produce a code the app
has no words for — so "Something went wrong" can't quietly become the answer to
everything.

---

## Part 6 — What we protect, and how

Written plainly, because you should be able to check our claims.

| Concern | What we do |
|---|---|
| **Someone claiming a domain they don't own** | You must control the DNS or the website. Test mode only accepts names nobody can own. |
| **Someone seeing another company's data** | Every request is checked against your organization at the edge and again in the service. Another company's data returns exactly what non-existent data returns — you can't even tell it's there. |
| **Using us to attack someone else** | When we fetch your homepage, we resolve the address first and refuse anything private or internal, pin the connection so it can't be switched mid-request, re-check every redirect, cap the response size, and never tell you *why* a fetch failed. |
| **Hammering the verify button** | Limits are per company, not per internet connection — because the company is the thing that could abuse it, and an IP is trivially changed. |
| **A developer shortcut leaking into production** | The developer bypass isn't a check that could be got wrong; in production it simply *isn't a valid option*, refused by the same code as a typo. And a production server configured with it enabled **refuses to start**. |
| **Not knowing who did what** | Every website added, verified, or removed is recorded with who, when, and how. |
| **Losing something by accident** | Removals are soft — the record is kept — and every destructive action is confirmed first. |

---

## Appendix — The whole thing on one page

```
  SIGN UP
     │  business name, your name, email, password (live rules checklist)
     │  → Organization + Business + User + Session, all or nothing
     ▼
  STEP 1  About your business          (all optional)
     │
     ▼
  STEP 2  Your website                 (pre-filled from step 1)
     │      "acme.com"                    → real domain
     │      "my-business.example.com"     → test address
     ▼
  STEP 3  Prove it's yours
     │
     ├─ real domain ──┬─ DNS record        _replyiq-verification.acme.com
     │                └─ website snippet   <meta name="replyiq-verification" …>
     │                                     (or /.well-known/…txt)
     │        ┌──────────────┬──────────────────┬─────────────────┐
     │     Verified      Not found yet      Doesn't match
     │        │          "that's normal,    "re-copy the value"
     │        │           check again"              │
     │        │              └──── retry ───────────┘
     │        ▼
     └─ test address ── verifies instantly, labelled "Test domain"
              │
              ▼
  STEP 4  Finish  →  onboarding COMPLETE + business ACTIVE (one transaction)
              │
              ▼
  DASHBOARD
     ├─ LIVE      verified real website — working
     ├─ TEST      only test addresses   — "not answering real visitors yet"
     └─ INACTIVE  no verified website   — "your receptionist is offline"
```

---

## Where to go next

| Question | Document |
|---|---|
| What are we trying to build, and why? | `01-PRODUCT-REQUIREMENTS.md` |
| Exactly how does verification work? | `16-DOMAIN-VERIFICATION-AND-TEST-MODE.md` |
| What do the API calls look like? | `09-API-SPECIFICATION.md` |
| What changed in this revision, and why? | `docs/CHANGES-2026-09-05.md` |
| What's tested, and what blocks release? | `14-QA-ACCEPTANCE-DOD.md` |
