# ReplyIQ Product Specification -- Master Index

> **Status:** Draft
> **Last Updated:** 2026-08-18
> **Owner:** Product & Engineering

---

**Product Specification Version:** 1.0
**Date:** 2026-08-18

---

## 1. Purpose

This document is the single navigation and governance document for the entire ReplyIQ product specification. It defines what each document covers, how they relate to each other, which documents take precedence in conflicts, and how the specification set is maintained over time.

No other document in the product spec serves as an index or entry point. Start here.

---

## 2. Authoritative Documentation Location

The authoritative product specification lives at:

```
docs/product-spec/
```

This directory contains 18 numbered documents (00 through 17). This is the only product specification. There is no competing documentation system.

### 2.1 Why This Directory Exists

The repository previously contained a planned 53-document structure scattered across `docs/product/`, `docs/flows/`, `docs/ui-ux/`, `docs/architecture/`, `docs/api/`, `docs/database/`, `docs/security/`, `docs/infrastructure/`, `docs/qa/`, `docs/roadmap/`, and `docs/decisions/`. That 53-document structure was never fully authored and is superseded by this consolidated 16-document specification.

### 2.2 What Is NOT Authoritative

The following locations contain legacy and source material. They are NOT the primary source of truth:

```
docs/product/              LEGACY -- source material
docs/flows/                LEGACY -- source material
docs/ui-ux/                LEGACY -- source material
docs/architecture/         LEGACY -- source material
docs/api/                  LEGACY -- source material
docs/database/             LEGACY -- source material
docs/security/             LEGACY -- source material
docs/infrastructure/       LEGACY -- source material
docs/qa/                   LEGACY -- source material
docs/roadmap/              LEGACY -- source material
docs/decisions/            LEGACY -- source material
docs/devops/               LEGACY -- source material
docs/system-design/        LEGACY -- source material
docs/ai/                   LEGACY -- source material
```

These directories may still contain files. They are preserved for historical reference. Do not treat them as implementation authority.

---

## 3. Legacy Documentation

### 3.1 Legacy Document Classification

The existing legacy documentation under `docs/` falls into three categories:

#### A. Source Material (Used to Create This Specification)

These documents were the primary inputs that were consolidated into the 16-document product-spec:

| Legacy Location | Consolidated Into | Notes |
|-----------------|-------------------|-------|
| `docs/API_STATUS.md` | 09-API-SPECIFICATION.md | Endpoint inventory and status |
| `docs/AUTHENTICATION.md` | 12-SECURITY-MULTI-TENANCY.md | Auth system design |
| `docs/DATABASE.md` | 08-DATABASE-SPECIFICATION.md | Schema and model reference |
| `docs/DECISIONS.md` | Captured in individual spec documents | Architecture decision rationale |
| `docs/PROJECT_STATUS.md` | 05-TECHNICAL-ARCHITECTURE.md, 15-ROADMAP.md | System state and progress |
| `docs/ROADMAP.md` | 15-ROADMAP.md | Implementation sequencing |
| `docs/product-design/BUSINESS_ONBOARDING.md` | 02-PRODUCT-FLOWS.md, 03-UI-UX-SPECIFICATION.md | Onboarding flow and UI |
| `docs/product-discovery/ReplyIQ_PRD_v1.0.docx` | 01-PRODUCT-REQUIREMENTS.md | Product requirements |
| `docs/product-discovery/ReplyIQ_Product_Discovery_v0.1.docx` | Historical reference only | Earlier discovery work |

#### B. Legacy Documentation (Will Eventually Be Replaced)

These documents described the intended 53-document structure. The structure was never fully authored. The product-spec documents replace them entirely:

| Legacy Location | Replaced By |
|-----------------|-------------|
| `docs/00-DOCUMENTATION-INDEX.md` | `docs/product-spec/00-MASTER-INDEX.md` (this file) |
| `docs/DOCUMENTATION-AUDIT.md` | Superseded -- audit findings are resolved within spec documents |
| `docs/NEXT_STEPS.md` | 15-ROADMAP.md |

#### C. Historical / Archived Material

These documents should be preserved but should not influence implementation unless explicitly referenced:

| Legacy Location | Why Preserved |
|-----------------|---------------|
| `docs/milestone-4a-findings.md` | Historical QA findings. Useful for regression context. |
| `docs/decisions/OPEN-DECISIONS-RESOLVED.md` | Record of past decision resolution. |
| `docs/product-discovery/*.docx` | Binary originals. Not version-control-friendly but preserved as source of truth for original intent. |

### 3.2 Rules for Legacy Documents

1. **Do not delete legacy documents yet.** They are preserved until the product-spec documents are approved and implementation is verified.
2. **Do not treat legacy documents as authoritative.** Once the corresponding product-spec document is approved, the product-spec document prevails.
3. **Do not modify legacy documents** unless correcting a factual error that could cause confusion.
4. **Cross-reference, don't copy.** If implementation work references a legacy document, add a note pointing to the corresponding product-spec document.

---

## 4. Document Inventory

The ReplyIQ product specification consists of 18 numbered documents (00 through 17). Each document has a single owner, a defined scope, and a defined relationship to other documents. Two unnumbered supporting artifacts (`SPEC-RECONCILIATION-REPORT.md` and `../CHANGES-2026-09-05.md`) are also tracked below; they do not change the authoritative set.

| # | File | Title | Purpose |
|---|------|-------|---------|
| 00 | `00-MASTER-INDEX.md` | Master Index | Navigation and governance for the entire specification. This document. |
| 01 | `01-PRODUCT-REQUIREMENTS.md` | Product Requirements | Defines **what** ReplyIQ is. Business goals, user personas, feature list, success metrics, and non-functional requirements. Authoritative source for product intent. |
| 02 | `02-PRODUCT-FLOWS.md` | Product Flows | Defines **how users interact** with ReplyIQ. End-to-end user journeys, step-by-step workflows, and state transitions for every major feature. |
| 03 | `03-UI-UX-SPECIFICATION.md` | UI/UX Specification | Defines **what the product looks and feels like**. Page layouts, component behavior, interaction patterns, responsive rules, and accessibility requirements. |
| 04 | `04-DESIGN-SYSTEM.md` | Design System | Defines the **reusable visual system**. Color tokens, typography, spacing, icons, and component library conventions. Referenced by 03 and 06. |
| 05 | `05-TECHNICAL-ARCHITECTURE.md` | Technical Architecture | Defines the **complete system architecture**. Service boundaries, deployment topology, data flow between services, and cross-cutting technical decisions. Authoritative source for system design. |
| 06 | `06-FRONTEND-ARCHITECTURE.md` | Frontend Architecture | Defines the **React application architecture**. App shell, routing, state management, component hierarchy, and build configuration for the web dashboard. |
| 07 | `07-BACKEND-ARCHITECTURE.md` | Backend Architecture | Defines the **NestJS API architecture**. Module structure, middleware pipeline, service decomposition, and application-layer patterns. |
| 08 | `08-DATABASE-SPECIFICATION.md` | Database Specification | Defines the **complete data model**. All tables, columns, types, relations, indexes, constraints, and migrations. Authoritative source for the data model. |
| 09 | `09-API-SPECIFICATION.md` | API Specification | Defines the **authoritative API contract**. Every endpoint, request/response schema, authentication requirements, error codes, and versioning strategy. |
| 10 | `10-AI-KNOWLEDGE-RECEPTIONIST.md` | AI Knowledge Receptionist | Defines the **AI product architecture** for the first AI Employee. Prompt design, knowledge base integration, conversation management, and quality controls. |
| 11 | `11-WIDGET-SPECIFICATION.md` | Widget Specification | Defines the **embeddable website widget**. Embed methods, initialization, communication protocol with host pages, and widget-specific UI/behavior. |
| 12 | `12-SECURITY-MULTI-TENANCY.md` | Security & Multi-Tenancy | Defines **production security requirements**. Authentication, authorization, data isolation, encryption, audit logging, and compliance. Authoritative source for security. |
| 13 | `13-INFRASTRUCTURE-DEVOPS.md` | Infrastructure & DevOps | Defines **how the product runs**. Infrastructure provisioning, CI/CD pipelines, monitoring, alerting, and operational procedures. |
| 14 | `14-QA-ACCEPTANCE-DOD.md` | QA & Acceptance / Definition of Done | Defines **how we know the product is correct**. Test strategy, acceptance criteria standards, quality gates, and release criteria. |
| 15 | `15-ROADMAP.md` | Roadmap | Defines the **implementation roadmap**. Phases, milestones, dependencies, and delivery timeline. |
| 16 | `16-DOMAIN-VERIFICATION-AND-TEST-MODE.md` | Domain Verification & Test Mode | Defines **how a business proves it owns a website**, and how the whole system can be exercised without owning one. Record formats, the outcome matrix, sandbox eligibility and its security argument, SSRF controls, error copy, and the test plan. Authoritative for every verification mechanism; supersedes any verification detail elsewhere. |
| 17 | `17-END-TO-END-FLOW.md` | End-to-End Flow | The complete user journey in **plain language**, readable start to finish in ten minutes. Written for anyone — no codebase knowledge assumed. Narrative companion to 16; where the two differ on mechanics, 16 wins. |
| — | `../CHANGES-2026-09-05.md` | Change Record (2026-09-05) | What changed in the 2026-09-05 revision, why, where it landed, and what verifies it. Includes the decisions superseded (D-01R, D-03R, D-04R, D-06R) and a requirement-to-test traceability matrix. Read this before `SPEC-RECONCILIATION-REPORT.md`, which it partially supersedes. |
| — | `SPEC-RECONCILIATION-REPORT.md` | Spec Reconciliation Report (2026-08) | **Partially superseded** by `../CHANGES-2026-09-05.md` (see its §6 for the decisions reversed). Point-in-time audit reconciling external spec-review recommendations against the actual codebase. Records per-recommendation decisions (ACCEPT / MODIFY / REJECT / ALREADY IMPLEMENTED / IMPLEMENTATION GAP), documentation changes made, and open decisions requiring approval. Supporting artifact; the numbered documents remain authoritative. |

---

## 5. Cross-Document Responsibilities

Each document owns a specific type of information. Avoid duplicating requirements between documents.

| Document | Owns This Information | Does NOT Own |
|----------|----------------------|--------------|
| **01 - Product Requirements** | What the product must achieve. Business goals, personas, features, success metrics. | How it is implemented technically |
| **02 - Product Flows** | How users interact with the product. Step-by-step journeys, state transitions, happy/error paths. | Visual design, API contracts |
| **03 - UI/UX Specification** | What users see and how the product behaves visually/interactively. Page layouts, component states, interactions. | Reusable token system, technical implementation |
| **04 - Design System** | Reusable visual rules. Color tokens, typography scale, spacing system, component library conventions. | Page-specific layouts, product flows |
| **05 - Technical Architecture** | Overall system architecture. Service boundaries, deployment topology, cross-cutting decisions. | Module-level implementation details |
| **06 - Frontend Architecture** | React/frontend implementation. App shell, routing, state management, component hierarchy, build config. | Backend, database, API contracts |
| **07 - Backend Architecture** | NestJS/backend implementation. Module structure, middleware pipeline, service decomposition. | Frontend, database schema definitions |
| **08 - Database Specification** | Data model and persistence. Tables, columns, types, constraints, indexes, migrations. | API contracts, business logic |
| **09 - API Specification** | API contracts. Endpoints, request/response schemas, error codes, versioning. | Internal implementation, database schema |
| **10 - AI Knowledge Receptionist** | Knowledge and AI receptionist architecture. Prompt design, RAG pipeline, conversation management. | Widget UI, general backend patterns |
| **11 - Widget Specification** | Customer-facing widget. Embed methods, initialization, host-page communication, widget UI. | AI/receptionist internals, backend API |
| **12 - Security & Multi-Tenancy** | Security and tenant isolation. Auth, authorization, data isolation, encryption, compliance. | Implementation-specific module patterns |
| **13 - Infrastructure & DevOps** | Running, deploying, and operating the system. CI/CD, monitoring, provisioning, operational procedures. | Application code, feature behavior |
| **14 - QA & Acceptance / DoD** | Verification and completion criteria. Test strategy, acceptance criteria, quality gates, DoD. | Implementation details, feature scope |
| **15 - Roadmap** | Implementation sequencing and milestones. Phases, dependencies, delivery timeline, status tracking. | Feature specifications, technical details |

### 5.1 When Information Overlaps

If two documents seem to need the same information, ask: "Which document is authoritative for this type of information?" Reference the authoritative document rather than duplicating. If clarification is needed in both documents, add a short reference note in the non-authoritative document.

---

## 6. Document Status

All documents start in **Draft** status. Status is tracked at the top of each document using the following block:

```
> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** [role]
```

### Status Values

| Status | Meaning |
|--------|---------|
| **Draft** | In initial authoring. Not yet reviewed. May be incomplete or contain placeholder content. |
| **In Review** | Complete draft submitted for review. Awaiting feedback from owner and stakeholders. |
| **Approved** | Reviewed and approved. Authoritative for implementation decisions. |
| **Superseded** | Replaced by a newer version. Kept for reference only. Do not use for implementation decisions. |
| **Deprecated** | No longer applicable. The scope it covers has been removed or merged elsewhere. |

---

## 7. Authority Hierarchy

When two documents conflict, the following hierarchy determines which document wins. The rule is simple: **the more specific document overrides the more general document on the topic it owns**, except that product requirements (01) override everything when the conflict is about product intent.

### 7.1 Primary Authority Documents

These five documents are authoritative on their respective topics. When a conflict arises within their domain, their definition prevails.

| Document | Authority Domain |
|----------|-----------------|
| **01 - Product Requirements** | All product intent. What features exist, who they are for, and what success looks like. Overrides all other documents when the conflict is about "what should exist." |
| **08 - Database Specification** | Data model. Table structure, column definitions, relationships, and constraints. Overrides all other documents when the conflict is about schema. |
| **09 - API Specification** | API contract. Endpoint definitions, request/response shapes, and error handling. Overrides all other documents when the conflict is about API behavior. |
| **05 - Technical Architecture** | System design. Service boundaries, deployment topology, and cross-cutting technical decisions. Overrides all other documents when the conflict is about system-level architecture. |
| **12 - Security & Multi-Tenancy** | Security requirements. Authentication, authorization, data isolation, and compliance. Overrides all other documents when the conflict is about security posture. |

### 7.2 Full Override Rules

1. **01 (Product Requirements) wins over all** when the conflict is about product intent -- whether a feature should exist, who it is for, or what behavior is expected from the user's perspective.
2. **12 (Security) wins over 05, 08, 09** when the conflict is about authentication, authorization, data isolation, or compliance. Security constraints are non-negotiable.
3. **05 (Technical Architecture) wins over 06, 07** when the conflict is about service boundaries, deployment, or cross-cutting infrastructure decisions.
4. **08 (Database Specification) wins over 07, 09** when the conflict is about the data model, column names, types, or constraints.
5. **09 (API Specification) wins over 06, 07** when the conflict is about endpoint definitions, request/response schemas, or error codes.
6. **When two documents at the same level conflict**, escalate to the project lead and update the losing document or add a clarification to this index.

### 7.3 Clarification: "What Should Exist" vs "What Does Exist"

- "What should exist" is defined by **01 - Product Requirements**. It describes desired behavior, feature scope, and acceptance criteria.
- "What does exist" is defined by implementation code, **08 - Database Specification**, and **09 - API Specification**. It describes the current state.

When a document describes current state that conflicts with 01's desired state, the implementation gap is logged as a task against the roadmap (15), and 01 remains authoritative for intent.

---

## 8. Cross-Reference Map

Each document references other documents explicitly. The following map shows the primary reference relationships. An arrow means "references and must be consistent with."

```
01 (Product Requirements)
 ├──> 02 (Product Flows)         -- Features in 01 are realized as flows in 02
 ├──> 05 (Technical Architecture) -- Non-functional requirements constrain architecture
 ├──> 12 (Security)               -- Security requirements from 01 feed into 12
 └──> 15 (Roadmap)                -- Features in 01 are sequenced in 15

02 (Product Flows)
 ├──> 01 (Product Requirements)   -- Flows implement requirements
 ├──> 03 (UI/UX Specification)    -- Flows are realized as UI screens/interactions
 └──> 09 (API Specification)      -- Flows consume API endpoints

03 (UI/UX Specification)
 ├──> 02 (Product Flows)          -- UI implements user flows
 ├──> 04 (Design System)          -- UI uses design system tokens/components
 ├──> 06 (Frontend Architecture)  -- UI is implemented by frontend code
 └──> 11 (Widget Specification)   -- Widget-specific UI is defined in 11

04 (Design System)
 └──> (standalone, referenced by 03 and 06)

05 (Technical Architecture)
 ├──> 06 (Frontend Architecture)  -- Frontend is a subsystem of 05
 ├──> 07 (Backend Architecture)   -- Backend is a subsystem of 05
 ├──> 08 (Database Specification) -- Data layer is a subsystem of 05
 ├──> 12 (Security)               -- Security architecture is part of 05
 └──> 13 (Infrastructure & DevOps) -- Deployment is part of 05

06 (Frontend Architecture)
 ├──> 04 (Design System)          -- Uses design system
 ├──> 05 (Technical Architecture) -- Constrained by system architecture
 ├──> 07 (Backend Architecture)   -- Communicates with backend
 ├──> 09 (API Specification)      -- Consumes API contract
 └──> 11 (Widget Specification)   -- Widget is a frontend artifact

07 (Backend Architecture)
 ├──> 05 (Technical Architecture) -- Constrained by system architecture
 ├──> 08 (Database Specification) -- Accesses data model
 ├──> 09 (API Specification)      -- Implements API contract
 └──> 12 (Security)               -- Enforces security requirements

08 (Database Specification)
 ├──> 05 (Technical Architecture) -- Data layer as defined by system architecture
 └──> 12 (Security)               -- Data isolation and encryption requirements

09 (API Specification)
 ├──> 07 (Backend Architecture)   -- Endpoints implemented by backend
 ├──> 08 (Database Specification) -- Request/response shaped by data model
 └──> 12 (Security)               -- Authentication/authorization on endpoints

10 (AI Knowledge Receptionist)
 ├──> 01 (Product Requirements)   -- AI feature scope from requirements
 ├──> 07 (Backend Architecture)   -- AI services are backend modules
 ├──> 05 (Technical Architecture) -- AI infrastructure within system design
 └──> 12 (Security)               -- Data handling for AI conversations

11 (Widget Specification)
 ├──> 03 (UI/UX Specification)    -- Widget UI follows UX patterns
 ├──> 06 (Frontend Architecture)  -- Widget is a frontend build artifact
 └──> 09 (API Specification)      -- Widget communicates with API

12 (Security & Multi-Tenancy)
 └──> 05 (Technical Architecture) -- Security architecture within system design

13 (Infrastructure & DevOps)
 ├──> 05 (Technical Architecture) -- Deploys the architecture defined in 05
 └──> 12 (Security)               -- Infrastructure enforces security requirements

14 (QA & Acceptance / DoD)
 ├──> 01 (Product Requirements)   -- Acceptance criteria trace to requirements
 ├──> 09 (API Specification)      -- API tests validate contract
 └──> 12 (Security)               -- Security tests validate isolation

15 (Roadmap)
 ├──> 01 (Product Requirements)   -- Roadmap sequences requirements
 └──> (all documents)             -- Roadmap references implementation status
```

---

## 9. Current vs Planned Distinction

Documents distinguish between what exists today and what is planned for the future.

### 9.1 Implementation Status Tags

Every feature and section in the specification uses one of four status tags:

| Tag | Meaning |
|-----|---------|
| **[IMPLEMENTED]** | Currently implemented and verified in the repository. Code exists and works. |
| **[PARTIALLY IMPLEMENTED]** | Some functionality exists but is incomplete. Implementation is in progress or a subset is done. |
| **[PLANNED]** | Required by the intended product but not implemented yet. Approved for implementation. |
| **[PROPOSED]** | Potential future capability that has not been approved. Subject to review and approval. |

### 9.2 Rules

1. **No planned feature should be presented as implemented.** Use the correct tag.
2. **Implementation sections** in each document use the tags above to distinguish what is already built from what is designed but not yet implemented.
3. **Planned content** must reference a roadmap phase (document 15) to anchor it in time.
4. **Implemented content** must match the actual codebase. If it does not, the document is out of date and must be updated before being referenced for implementation decisions.
5. **Proposed content** must not be treated as approved. It requires explicit approval before implementation.
6. When reviewing a document, always check whether a section describes current state or planned state. Planned state is subject to change; current state is a fact.

### 9.3 Format Convention

Each implementation-relevant section should use:

```
**Current:** [description of what exists in code today]

**Planned:** [description of what is designed but not yet implemented -- see 15-ROADMAP.md Phase X]
```

Or use inline tags:

```
[IMPLEMENTED] Feature X does Y.
[PLANNED] Feature Z will do W. -- see 15-ROADMAP.md Phase 3
[PROPOSED] Future capability V. -- not yet approved
```

---

## 10. Documentation Workflow

The documentation follows a strict lifecycle from source material through implementation.

### 10.1 Specification Lifecycle

```
Existing repository + legacy documentation
        |
        v
16-document product specification (this set)
        |
        v
External Claude review
        |
        v
Accepted recommendations
        |
        v
Final approved product specification
        |
        v
OpenCode implementation
        |
        v
Verification
        |
        v
Documentation update
        |
        v
Regression validation
```

### 10.2 Current Phase

The product specification is currently in the **Draft** phase, pending external Claude review. The workflow stages:

1. **Source material gathered** -- Legacy documentation and codebase analysis produced the initial drafts.
2. **16-document specification drafted** -- All documents exist and contain content. Status: Draft.
3. **External Claude review** -- NOT YET STARTED. A Claude review will evaluate completeness, consistency, and correctness.
4. **Recommendations accepted/rejected** -- Each recommendation is evaluated and either accepted (with changes) or rejected (with rationale).
5. **Specification approved** -- Documents marked as Approved after review is complete.
6. **Implementation begins** -- OpenCode uses the approved specification as the implementation contract.
7. **Verification** -- Code is tested against the specification.
8. **Documentation updated** -- Any implementation deviations update the specification.
9. **Regression validation** -- Confirming changes do not break existing functionality.

### 10.3 Specification as Implementation Contract

Once approved, the product-spec documents are the **implementation contract** for OpenCode. This means:

- OpenCode reads the specification before implementing any feature.
- OpenCode implements what the specification describes, not what it infers.
- If the specification is ambiguous, OpenCode flags the ambiguity rather than guessing.
- If the codebase contradicts the specification, OpenCode flags the contradiction.

---

## 11. Documentation Change Rules

### 11.1 How Requirements Are Changed

1. A change request is opened (issue, discussion, or direct request).
2. Identify which document owns the requirement (see Section 5).
3. If the change affects an authority document (Section 7.1), get approval from the relevant lead.
4. Update the document. Update the `Last Updated` date.
5. If the change affects cross-references, update Section 8 of this index.
6. If the change introduces a new conflict between documents, resolve it per Section 14.

### 11.2 How Architectural Decisions Are Recorded

- Architectural decisions are embedded within the owning document (05-TECHNICAL-ARCHITECTURE.md for system-level decisions, 07-BACKEND-ARCHITECTURE.md for backend decisions, etc.).
- Decisions include: context, options considered, the decision, rationale, and consequences.
- The master index tracks open decisions in Section 15.

### 11.3 How Implementation Changes Affect Documentation

When implementation changes:

1. Identify which specification documents are affected.
2. Update those documents to reflect the new implementation.
3. Update implementation status tags ([IMPLEMENTED], [PARTIALLY IMPLEMENTED], etc.).
4. Update the roadmap (15) if milestone progress changes.
5. Do not leave stale descriptions in the specification.

### 11.4 How Contradictions Are Handled

1. Identify the two contradictory statements.
2. Determine which document is authoritative for the topic (Section 7).
3. The authoritative document prevails.
4. Update the non-authoritative document to align.
5. If both documents are authoritative at the same level, escalate per Section 14.

### 11.5 How Current vs Planned Status Is Maintained

- Each document maintains status tags at the section level.
- Status tags are updated when implementation progresses.
- The roadmap (15) provides the master view of implementation status.
- Monthly reviews verify that status tags match the codebase.

### 11.6 How Documentation Drift Is Prevented

- Implementation must not proceed without a specification reference.
- After implementation, the specification must be updated.
- Status tags must be verified against the codebase during reviews.
- If drift is detected, it is logged and resolved before the next implementation cycle.

### 11.7 How Claude Review Recommendations Are Accepted/Rejected

1. Each recommendation is evaluated against the existing specification and codebase.
2. Accepted: The recommendation improves the specification. Document is updated. Rationale recorded.
3. Rejected: The recommendation does not apply, conflicts with product intent, or is not feasible. Rationale recorded in the document's change history or in Section 15 (Open Decisions).
4. Partially accepted: Part of the recommendation is adopted. The adopted part is implemented; the rest is rejected with rationale.

### 11.8 How OpenCode Should Use These Documents During Implementation

See Section 10.3 and Section 16 for detailed rules.

---

## 12. Who Can Change What

| Document Scope | Approved By |
|----------------|------------|
| Product intent (01) | Product Lead |
| System architecture (05) | Engineering Lead |
| Security requirements (12) | Security Lead + Engineering Lead |
| Data model (08) | Engineering Lead |
| API contract (09) | Engineering Lead |
| Any other document | Document Owner |

---

## 13. Documentation Lifecycle

### 13.1 Creation

1. A new product spec document is drafted by the assigned owner.
2. The document follows the standard header format (Status, Last Updated, Owner).
3. The document is added to this index with `Draft` status.
4. The cross-reference map in section 8 of this index is updated.

### 13.2 Review

1. The owner marks the document as `In Review`.
2. Relevant stakeholders review and provide feedback.
3. The owner incorporates feedback and resolves questions.

### 13.3 Approval

1. The owner marks the document as `Approved`.
2. Approved documents are authoritative for implementation decisions.
3. Approved documents must not be modified without a change request (see section 11).

### 13.4 Supersession

1. When a document is replaced by a newer version, the old version is marked `Superseded`.
2. Superseded documents are kept in the repository for reference but are not authoritative.
3. The new version inherits the same number and is tracked by date.

### 13.5 Deprecation

1. When a document's scope is no longer relevant, it is marked `Deprecated`.
2. Deprecated documents are not deleted. They are retained for historical reference.
3. A note is added to the deprecated document indicating where its scope moved.

---

## 14. Conflict Resolution

### 14.1 Precedence

When two documents conflict, apply the override rules in section 7.2. The more specific authority document on the topic wins.

### 14.2 Ambiguity

When the override rules do not clearly resolve a conflict (e.g., two documents at the same authority level disagree):

1. Log the conflict as an open decision in section 15.
2. Escalate to the project lead.
3. The project lead makes a binding decision.
4. Update the losing document to align with the decision.
5. Remove the conflict from section 15 and add the decision date.

### 14.3 Code vs Spec

When the codebase does not match the spec:

- If the spec is approved and the code is wrong, the code is a bug. Fix the code.
- If the spec is draft and the code represents a better solution, update the spec to match the code.
- If the spec is draft and the code is clearly wrong per product requirements (01), fix the code and leave the spec as-is.

---

## 15. Open Decisions

Track unresolved questions and pending decisions here. Each entry must have a decision owner and a target date.

| # | Question | Raised | Owner | Target Date | Status |
|---|----------|--------|-------|-------------|--------|
| OD-001 | What is the final pricing model for the AI Receptionist tier? | 2026-08-17 | Product Lead | TBD | Open |
| OD-002 | Should the widget support iframe sandboxing or shadow DOM isolation? | 2026-08-17 | Engineering Lead | TBD | Open |
| OD-003 | Which regions require data residency compliance in Phase 1? | 2026-08-17 | Security Lead | TBD | Open |
| OD-004 | What is the maximum concurrent conversation limit per tenant for the AI Receptionist? | 2026-08-17 | Engineering Lead | TBD | Open |
| OD-005 | Should the API support versioned URL paths (`/v1/`) or header-based versioning? | 2026-08-17 | Engineering Lead | TBD | Open |

---

## 16. Document Conventions

All product spec documents follow these conventions:

- **Headers:** Each document starts with a status block (Status, Last Updated, Owner), followed by a title and version.
- **Sections:** Numbered sections with clear headings. No unnamed sections.
- **References:** Cross-references use the format `see [XX-DOCUMENT-NAME.md](./XX-DOCUMENT-NAME.md)`.
- **Diagrams:** ASCII diagrams are preferred for inline diagrams. Mermaid is permitted for complex flows.
- **Tables:** Use tables for structured comparisons, not prose.
- **No emojis:** Technical documentation does not use emojis.
- **File naming:** All files use the format `NN-UPPER-KEBAB-CASE.md`.
- **Status tags:** Use `[IMPLEMENTED]`, `[PARTIALLY IMPLEMENTED]`, `[PLANNED]`, or `[PROPOSED]` for feature status.

---

## 17. How to Use This Specification

1. **New to the project?** Start with `01-PRODUCT-REQUIREMENTS.md` to understand what ReplyIQ is.
2. **Implementing a feature?** Start with `01` to find the requirement, then read `02` for the flow, `03` or `06`/`07` for the implementation details.
3. **Designing a new feature?** Start with `01`, then update `02`, `03`, `05`, `08`, and `09` as needed.
4. **Reviewing a PR?** Check that the code matches the relevant spec documents. If the spec is draft, treat the code as the source of truth and update the spec.
5. **Resolving a conflict?** Apply the authority hierarchy in section 7. If still ambiguous, escalate per section 14.
6. **Claude reviewing?** Follow the workflow in Section 10.2. Evaluate each document against the codebase and flag inconsistencies.

---

*This document is the canonical index for the ReplyIQ product specification. All other documents are referenced from here. If you are unsure where to start, start here.*
