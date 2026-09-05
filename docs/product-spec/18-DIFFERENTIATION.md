# ReplyIQ — What Makes This Different

> The AI chat widget market is crowded. This document says what we do that the
> others don't, and why it is defensible.

> **Status:** Approved
> **Last Updated:** 2026-09-05
> **Owner:** Product
> **Read with:** `01-PRODUCT-REQUIREMENTS.md` (goals) and `15-ROADMAP.md` (order)

---

## 1. The honest starting position

"AI chatbot for your website" is not a product idea. It is a category with
dozens of funded competitors — Intercom Fin, Tidio Lyro, Chatbase, Crisp,
Voiceflow, and a new one every week. Most of them are a wrapper around an LLM
with a document uploader and a chat bubble.

If ReplyIQ ships that, it competes on price and loses.

So the question is not "what features should we add" but **what can we do that
the wrapper products structurally cannot**.

---

## 2. The asset nobody else has

We already make every business **prove they own their website** before anything
else happens. Today that gate exists for security. But it hands us something the
competition does not have at signup:

> **A cryptographically-established, auditable claim that this business controls
> this website.**

Chatbase asks you to paste a URL. We *know* the URL is yours. That single
difference unlocks the three features below, and none of them are available to a
product that only has a URL someone typed in.

This is the strategic core of the product. Everything in §3 follows from it.

---

## 3. The three differentiators

### D1 — Your receptionist is ready before you've done anything

**The insight:** the moment a domain is verified, we are entitled — provably,
auditably — to read that site. So we do.

Every competitor's onboarding is *"now go and upload some documents."* That is
the step where trials die: the business owner does not have a knowledge base, has
never written their FAQs down, and quietly closes the tab.

Ours is: **verify → we read your site → your receptionist already knows your
services, hours, prices and contact details.** The owner's first experience is
correcting a receptionist that already works, not building one from nothing.

*Why it's defensible:* it requires domain verification to be a first-class,
trusted, audited part of onboarding — which is exactly the thing we spent this
engagement making production-grade. A competitor bolting on a crawler has no
basis to claim the site is the user's, which is a legal and abuse problem, not a
technical one.

*Status:* Milestone 5. This is the next thing to build.

### D2 — It says "I don't know" and means it

**The insight:** for a receptionist, a confident wrong answer is worse than no
answer. If a plumber's bot invents a call-out fee, that is a customer dispute.

Every answer is grounded in a specific retrieved source, and carries a
confidence. Below the threshold the receptionist does not guess — it says *"I'm
not certain, let me get someone to confirm"* and captures the lead. Answers cite
the page they came from, and the owner can see exactly which sentence produced
which answer.

*Why it's defensible:* it is a product decision competitors avoid because it
makes demos look worse. It makes *deployments* work better, and it is the single
biggest reason SMBs turn these things off after a fortnight.

*Status:* Milestone 6, but the grounding data model belongs in Milestone 5.

### D3 — The gap report

**The insight:** the most valuable data a receptionist produces is not the
conversations it handled. It is **the questions it couldn't answer.**

Every low-confidence or unanswered question is logged, clustered, and surfaced
as: *"11 people asked about weekend availability this week. You haven't told your
receptionist about that. Answer it once →"* — and one click turns it into
knowledge.

*Why it's defensible:* it converts the product from a cost into a compounding
asset, and it is a retention mechanism. The owner has a reason to log in weekly
that isn't guilt.

*Status:* Milestone 6.

---

## 4. What we deliberately do not build

| Not building | Why |
|---|---|
| A visual conversation-flow builder | The market's most-used feature is also its most-abandoned. SMBs don't want to draw flowcharts; that's why they wanted AI. |
| A general chatbot platform | Purpose-built for reception beats configurable-for-anything at this size. |
| Multi-channel at launch | Web first, done properly. Email and WhatsApp are Post-MVP. |
| Our own model | We configure and ground; we don't train. |

---

## 5. Why this ordering

The temptation is to build the AI first, because it's the exciting part. That
would be wrong. **D1 is the wedge, and D1 is a Milestone 5 feature.**

A receptionist with no knowledge is a demo. A knowledge base with no receptionist
is still useful (the owner can see what we understood about their business, and
correct it). So knowledge first is the order that produces something valuable at
every intermediate step — and it means the LLM, when it arrives, has something
real to be grounded in.

| Order | What | Why now |
|---|---|---|
| **1** | Knowledge engine + site ingestion (M5) | The wedge (D1). Valuable on its own. Prerequisite for everything else. |
| **2** | Grounded answering + confidence (M6) | Turns knowledge into the product. Delivers D2. |
| **3** | Widget (M7) | Delivery mechanism. Meaningless before 1 and 2. |
| **4** | Gap report (M6b) | Needs conversation volume to be worth anything. Delivers D3. |
| **5** | Password reset, cookie sessions, email | Launch blockers — needed before real customers, not before real *usage*. |

---

## 6. How we'll know it worked

| Differentiator | Measure | Target |
|---|---|---|
| D1 | Businesses with a non-empty knowledge base 10 minutes after signup | > 80% (industry norm for "upload your docs" onboarding is well under half) |
| D1 | Median time from signup to first answerable question | < 10 minutes |
| D2 | Answers marked wrong by the owner | < 3% of answered questions |
| D2 | Escalations that were correct to escalate (sampled) | > 90% |
| D3 | Owners who add knowledge from a gap-report prompt, weekly | > 40% of active businesses |
| D3 | Knowledge-base growth after week 1 | Still positive at week 8 |

---

## 7. The thing to be honest about

None of this exists yet. Today ReplyIQ is a very good signup and domain
verification flow attached to nothing. The differentiation above is a plan, not a
position, and it stays a plan until Milestone 5 ships.

The plan is worth writing down now precisely because it changes *what* Milestone
5 is: not "a document uploader", but "your verified site becomes your knowledge
base automatically". Those are different builds, and only one of them is a wedge.
