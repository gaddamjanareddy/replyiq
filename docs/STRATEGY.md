# ReplyIQ — strategy

**Last updated:** 2026-10-10
**Status:** Current. This is the highest-level document in the repo.

When any other document disagrees with this one about *what we are trying to
achieve or in what order*, this one wins. `01-PRODUCT-REQUIREMENTS.md` still
owns the detailed functional requirements and the quality bar; it predates
most of the implementation and its §1 vision is aspirational where this is
decided.

Read `CLAUDE.md` first for the rules that are load-bearing in the code, and
`PROJECT_STATUS.md` for what is actually built today.

---

## 1. The goal, in one sentence

**Turn website visitors that a small business would otherwise have lost into
either an informed customer or a contactable lead — and let the owner see that
it happened.**

Everything below is downstream of that sentence. Two halves matter equally:

- *"informed customer or contactable lead"* — the conversation must **end in
  something**, not merely in a reply.
- *"let the owner see that it happened"* — an outcome the owner cannot see is
  an outcome they will not pay for a second month.

### What we are not trying to achieve

Not "an AI chatbot for your website". That is a category with dozens of funded
competitors and no defensible position in it at our size. We are not competing
on model quality, integrations, or a flow builder.

---

## 2. Who it is for

**One business, one website, one owner who answers their own phone.** India
first (see `PROJECT_STATUS.md` for why), 1–20 people, a website that already
exists and already says most of what a customer needs to know.

The sharpest version of the customer: *a dental clinic, a coaching centre, a
plumber, a boutique studio — somebody whose website gets 30 visitors a day and
whose WhatsApp gets 3 of them, and who does not know what the other 27 wanted.*

That person does not want a chatbot. They want the 27.

### The two things they will not do

Both of these kill competitors' trials, and the product is shaped around them:

1. **They will not write a knowledge base.** "Now upload your documents" is
   where the tab gets closed. So we read their website.
2. **They will not babysit it.** If it needs weekly configuration it gets
   turned off. So the only weekly task we ever give them is *answer this one
   question your customers keep asking*, and it takes one click.

---

## 3. The approach

### 3.1 The wedge: we know the website is theirs

Every business proves it controls its domain before anything else happens.
That gate exists for security, and it also hands us something nobody who asks
you to *paste a URL* has: an auditable claim that this site belongs to this
business. That is what entitles us to read the site, and reading the site is
what removes step 1 above.

### 3.2 The spine: it never invents

Every answer is something the owner published, returned as they wrote it, or
an honest "I don't know". This is a product decision competitors avoid because
it makes a demo look worse, and it is the reason deployments survive past a
fortnight: a confident wrong answer about price or opening hours is a dispute
with a real customer, and the owner hears about it from them, not from us.

Mechanically this is the three-rung retrieval ladder in `CLAUDE.md` rule 1.
Strategically it is the only claim we make that a wrapper product structurally
cannot copy without rebuilding their demo to look worse.

### 3.3 The keystone: honesty that still converts

"I don't know" is where the current product **stops**, and that is the single
biggest hole in it. The visitor asked a question, got an honest non-answer, and
left. The owner never learns they existed.

So the non-answer is not the end of the conversation — it is the **handover**:

> *"I don't want to guess about that. Leave me your number and
> \<business\> will come back to you."*

This turns the product's most honest moment into its most commercially
valuable one, and it is why the honesty rule is an asset rather than a
limitation. A wrapper product guesses, the visitor leaves satisfied and
misinformed, and the owner gets nothing. We decline to guess and the owner gets
a phone number.

### 3.4 The loop: every conversation makes it better or makes money

| The conversation ended | What the owner gets |
|---|---|
| Answered confidently | Nothing to do. Invisible, which is correct. |
| Answered with a hedge | A nudge: say this more clearly. |
| "I don't know" + contact captured | **A lead.** |
| "I don't know", nothing captured | A gap, counted. One click to answer forever. |

There is no fifth outcome, and none of the four is a dead end. That is the
whole design.

---

## 4. The value ladder

The product is built in four rungs. Each one is worth money on its own, and
each one makes the next one worth more. This replaces the old
milestone numbering, which tracked engineering order rather than value.

| Rung | The product | Status |
|---|---|---|
| **V1 — It answers** | Verified site becomes a knowledge base; a widget answers visitors in the owner's own words and admits ignorance. | **Built.** |
| **V2 — It captures** | Every honest non-answer, and every clear buying signal, becomes a lead the owner can call. Owner is notified. | **Built.** Capture, owner email, delivery outcome recorded, and deletion on request. |
| **V3 — It improves** | Unanswered questions are clustered and answerable in one click. The knowledge base grows from real demand instead of imagination. | **Built.** Clustered, answered in place, and the gap clears. |
| **V4 — It proves** | The owner opens the dashboard and sees outcomes, not activity: enquiries captured, questions answered, what people keep asking — and whether that is better than last month. | Built for the dashboard. Missing: conversation transcripts, and any view longer than two windows. |

**V2 is the keystone.** Without it the product is a better-behaved version of
a commodity, and the honesty rule reads as a weakness. With it, the honesty
rule *is* the lead-generation mechanism.

All four rungs now stand. What is left before a paying customer is not a
rung: email that reaches somebody other than us, the legal pages, and a
price.

### Explicitly after the ladder, not before

- **Billing** — decided (India, per verified website, flat monthly) and
  deliberately unbuilt until the product is worth charging for. Test-mode
  integration only; live keys only when there is a customer.
- **An LLM.** The answer engine is retrieval-only behind an `AnswerEngine`
  interface. A model would improve phrasing, not truth, and would receive the
  same passages. It costs money per conversation and can hallucinate; both are
  strategic negatives here, not neutral trade-offs. The seam exists so this is
  a decision we can revisit, not a wall.
- **WhatsApp.** The right second channel for India, and genuinely valuable —
  but it is a channel for a product that already works, and it carries a
  business-verification process we should not enter mid-build.
- **Appointment booking.** Only after V2 proves owners act on captured leads.
  Booking is a promise about availability we cannot keep from a website crawl.

### Never

| Not building | Why |
|---|---|
| A visual conversation-flow builder | The market's most-used feature is also its most-abandoned. Drawing a flowchart is the thing they bought AI to avoid. |
| A general chatbot platform | Purpose-built for reception beats configurable-for-anything at this size. |
| Our own model | We ground and configure. We do not train. |
| A "skip verification" button | Test Mode is a real bounded mode with its own rules, not an escape hatch on the live path. |

---

## 5. How we will know it worked

One north-star, measured per business per week:

> **Resolved conversations** — a visitor conversation that ended in a confident
> answer *or* a captured lead.

Activity metrics (visits, messages, sessions) are deliberately not the
north-star: they go up when the product is confusing.

| What | Measure | Target |
|---|---|---|
| Onboarding works | Businesses with a non-empty knowledge base 10 minutes after signup | > 80% |
| Onboarding works | Median signup → first answerable question | < 10 min |
| It doesn't invent | Answers the owner marks wrong | < 3% of answered |
| It converts | Non-answers that end in a captured contact | > 15% |
| It compounds | Owners who answer a gap in a given week | > 40% of active |
| It retains | Knowledge base still growing at week 8 | Positive |

If "it converts" is near zero, V2 was built wrong and the product has no
commercial engine — that is the number to watch first.

---

## 6. The things to be honest about

- **Nobody is paying yet.** Every number in §5 is a target, not a measurement.
  The product has been driven end to end by its builders and by nobody else.
- **Retrieval-only has a ceiling.** It answers what the owner published, in the
  words they published. A visitor who phrases a question in a way the website
  never did gets a hedge or a gap. The gap loop is the mitigation, and whether
  it is enough is an open empirical question.
- **The free Postgres on Render expires and has no backups.** This is the
  largest operational risk in the project and it is not a product problem.
  See `PROJECT_STATUS.md`.
- **Verification is a real barrier.** It is also the wedge. Some share of
  interested owners cannot add a DNS record or edit their site; Test Mode lets
  them see the product but not run it. That trade is deliberate and it costs us
  signups.
