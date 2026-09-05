# ReplyIQ - AI Knowledge Receptionist

> Defines the AI-powered knowledge engine and conversational receptionist architecture. This document covers knowledge ingestion, retrieval-augmented generation (RAG), the AI receptionist system, conversation management, lead capture, and human handoff flows.

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Tech Lead

---

## 1. Current State

**No AI or knowledge engine code exists in the codebase.** This document describes the complete planned architecture for the AI Knowledge Receptionist feature, scheduled across Milestones 5 and 6.

| Component | Status | Target Milestone |
|-----------|--------|------------------|
| Knowledge ingestion pipeline | Not started | Milestone 5 |
| Vector storage and embeddings | Not started | Milestone 5 |
| Knowledge retrieval (RAG) | Not started | Milestone 5 |
| AI receptionist (LLM integration) | Not started | Milestone 6 |
| Conversation management | Not started | Milestone 6 |
| Lead capture via AI | Not started | Milestone 6 |
| Human handoff | Not started | Milestone 6 |
| AI configuration per business | Not started | Milestone 6 |

---

## 2. Architecture Overview

The AI Knowledge Receptionist is composed of two major subsystems:

```
[PLANNED] Knowledge Engine (Milestone 5)           [PLANNED] AI Receptionist (Milestone 6)
┌─────────────────────────────────────┐             ┌──────────────────────────────────────┐
│                                     │             │                                      │
│  Knowledge Sources                  │             │  LLM Provider Abstraction            │
│  ├── FAQ entries                    │             │  ├── OpenAI                          │
│  ├── Documents (PDF, DOCX, TXT, MD) │             │  ├── Anthropic                       │
│  └── Web URLs                       │             │  ├── Google Gemini                   │
│                                     │             │  └── Local / self-hosted             │
│  Ingestion Pipeline                 │             │                                      │
│  ├── Document parsing               │             │  Prompt Architecture                  │
│  ├── Content extraction             │             │  ├── System prompt per business       │
│  ├── Text cleaning                  │             │  ├── Knowledge context injection      │
│  ├── Chunking                       │             │  ├── Conversation history             │
│  ├── Metadata extraction            │             │  └── Behavioral rules                 │
│  └── Embeddings generation          │             │                                      │
│                                     │             │  Conversation Manager                 │
│  Vector Storage                     │             │  ├── Session state                    │
│  ├── pgvector extension             │             │  ├── Intent detection                 │
│  └── Embedding vectors + metadata   │             │  ├── Lead qualification logic         │
│                                     │             │  ├── Appointment scheduling trigger   │
│  Knowledge Search API               │             │  ├── Human handoff decision           │
│  ├── Semantic search (vector)       │             │  └── Fallback behavior                │
│  ├── Keyword search (full-text)     │             │                                      │
│  └── Hybrid ranking                 │             │  Output Channels                     │
│                                     │             │  └── Web widget (MVP)                 │
└─────────────────────────────────────┘             └──────────────────────────────────────┘
```

---

## 3. Milestone 5 -- Knowledge Engine

[PLANNED] All content in this section is planned for Milestone 5.

### 3.1 Knowledge Sources

[PLANNED] Businesses will provide knowledge through three source types:

| Source Type | Description | Format |
|-------------|-------------|--------|
| **FAQ** | Structured question-and-answer pairs created in the dashboard | JSON (question + answer + tags) |
| **Documents** | Uploaded files containing business knowledge | PDF, DOCX, TXT, MD |
| **URLs** | Web pages to scrape and index | HTTP/HTTPS URLs |

### 3.2 Knowledge Ingestion Pipeline

[PLANNED] The ingestion pipeline transforms raw knowledge sources into searchable vector embeddings.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Source      │────>│   Parse &    │────>│   Chunk &    │────>│  Embed &     │
│   Intake      │     │   Extract    │     │   Clean      │     │  Store       │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                           │                     │                     │
                     File type routing      Chunking strategy    Vector DB write
                     Content extraction     Overlap config       Metadata indexing
                     Metadata capture       Size limits          Embedding storage
```

#### 3.2.1 Document Upload and Parsing

[PLANNED]

| Format | Parser | Notes |
|--------|--------|-------|
| PDF | pdf-parse or pdfjs-dist | Extract text, preserve structure where possible |
| DOCX | mammoth or docx-parser | Convert to plain text, extract headings |
| TXT | Native read | Direct text ingestion |
| Markdown | marked or remark | Parse to structured text, preserve headings as metadata |

**Parser pipeline:**

1. Validate file type and size (max 10MB per file)
2. Route to format-specific parser
3. Extract raw text content
4. Extract structural metadata (headings, sections, page numbers)
5. Return structured document object

#### 3.2.2 URL Scraping and Indexing

[PLANNED]

1. Validate URL format and accessibility
2. Fetch page content using headless HTTP client
3. Extract main content (strip navigation, footers, scripts)
4. Handle relative links for crawl depth (configurable, default depth: 0 -- single page only)
5. Extract metadata (title, description, last modified)
6. Support re-scraping on configurable schedule (daily, weekly, manual)

**Rate limiting:** Maximum 1 request per second per domain to respect robots.txt and avoid overloading targets.

#### 3.2.3 FAQ Creation and Management

[PLANNED] FAQs are structured question-answer pairs managed through the dashboard.

```
FAQ Entry {
  id: UUID
  question: string          // The question text
  answer: string            // The answer text
  tags: string[]            // Categorization tags
  priority: number          // Higher priority = preferred in retrieval
  isActive: boolean         // Soft enable/disable
  organizationId: UUID      // Tenant scope
  businessId: UUID          // Business scope
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Dashboard operations:** Create, edit, delete, bulk import (CSV), bulk export, activate/deactivate.

#### 3.2.4 Content Extraction and Cleaning

[PLANNED] Before chunking, all content goes through a cleaning pipeline:

1. Strip HTML artifacts and special characters
2. Normalize whitespace (collapse multiple spaces, fix line breaks)
3. Remove boilerplate content (headers, footers, disclaimers if detected)
4. Normalize unicode characters
5. Detect and preserve language metadata
6. Remove duplicate paragraphs (deduplication)

#### 3.2.5 Chunking Strategy

[PLANNED] Documents are split into chunks optimized for embedding and retrieval.

| Parameter | Default | Description |
|-----------|---------|-------------|
| Chunk size | 512 tokens | Target size per chunk |
| Chunk overlap | 50 tokens | Overlap between consecutive chunks |
| Min chunk size | 100 tokens | Discard chunks smaller than this |
| Splitter | Recursive character | Splits by paragraphs, then sentences, then characters |

**Chunk metadata stored with each chunk:**

```
ChunkMetadata {
  sourceId: UUID             // Reference to parent (FAQ, document, URL)
  sourceType: enum           // 'faq' | 'document' | 'url'
  chunkIndex: number         // Position within source document
  heading: string            // Nearest heading (if available)
  pageNumber: number         // Page number (PDF only, if available)
  organizationId: UUID
  businessId: UUID
}
```

#### 3.2.6 Metadata Extraction

[PLANNED] Each ingested source produces metadata used for filtered retrieval:

| Metadata Field | Source | Usage |
|----------------|--------|-------|
| Source type | Ingestion pipeline | Filter by FAQ vs document vs URL |
| Document title | Parser / URL fetch | Display in citations |
| Content category | Auto-detected or user-assigned | Categorization |
| Language | Detection (langdetect or similar) | Language-specific retrieval |
| Ingestion timestamp | System | Freshness scoring |
| Content hash | Computed | Deduplication detection |

#### 3.2.7 Embeddings Generation

[PLANNED]

| Parameter | Default | Description |
|-----------|---------|-------------|
| Model | text-embedding-3-small (OpenAI) | Configurable per deployment |
| Dimensions | 1536 | Model-dependent |
| Batch size | 100 | Chunks per API call |
| Retry | 3 attempts with exponential backoff | Handle transient failures |

**Embedding provider abstraction:**

```
[PLANNED] EmbeddingProvider (interface)
├── OpenAIEmbeddingProvider       (text-embedding-3-small / text-embedding-3-large)
├── VoyageEmbeddingProvider       (voyage-3)
├── CohereEmbeddingProvider       (embed-english-v3.0)
└── LocalEmbeddingProvider        (sentence-transformers, for self-hosted)
```

The provider is configured at the organization level and applies to all knowledge within that organization.

#### 3.2.8 Vector Storage

[PLANNED] ReplyIQ will use **pgvector** (PostgreSQL extension) as the primary vector store.

**Why pgvector:**
- No additional infrastructure (already running PostgreSQL)
- ACID transactions with business data
- Simpler operations and backups
- Sufficient scale for SMB use case (millions of vectors, not billions)

**Schema for vector storage:**

```
[PLANNED] Table: knowledge_chunks
├── id: UUID (PK)
├── organizationId: UUID (FK -> organizations)
├── businessId: UUID (FK -> businesses)
├── sourceId: UUID (FK -> knowledge_sources)
├── sourceType: enum ('faq', 'document', 'url')
├── content: text                // The chunk text
├── embedding: vector(1536)      // pgvector column
├── chunkIndex: integer
├── heading: text (nullable)
├── pageNumber: integer (nullable)
├── tokenCount: integer
├── contentHash: text
├── isActive: boolean (default true)
├── createdAt: timestamp
├── updatedAt: timestamp

Index: knowledge_chunks_embedding_idx (HNSW, cosine distance)
Index: knowledge_chunks_org_business_idx (btree, for filtered queries)
Index: knowledge_chunks_source_idx (btree, for source management)
```

```
[PLANNED] Table: knowledge_sources
├── id: UUID (PK)
├── organizationId: UUID (FK -> organizations)
├── businessId: UUID (FK -> businesses)
├── type: enum ('faq', 'document', 'url')
├── title: text
├── rawContent: text (nullable)      // Original content for re-processing
├── fileUrl: text (nullable)         // Storage URL for uploaded files
├── externalUrl: text (nullable)     // Original URL for web sources
├── chunkCount: integer (default 0)
├── status: enum ('processing', 'ready', 'failed')
├── errorMessage: text (nullable)
├── lastIndexedAt: timestamp (nullable)
├── createdAt: timestamp
├── updatedAt: timestamp
├── deletedAt: timestamp (nullable)  // Soft delete
```

**HNSW index parameters:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| M | 16 | Connections per node; good balance of recall and speed |
| ef_construction | 64 | Build-time search width; higher = better graph quality |
| ef_search | 32 | Query-time search width; adjustable per query |

### 3.3 Knowledge Search API

[PLANNED] The knowledge search endpoint supports both semantic and keyword-based retrieval.

**Endpoint:** `POST /api/v1/knowledge/search`

**Request:**

```json
{
  "query": "What are your business hours?",
  "businessId": "uuid",
  "mode": "hybrid",
  "limit": 5,
  "minScore": 0.7,
  "filters": {
    "sourceType": ["faq", "document"]
  }
}
```

**Response:**

```json
{
  "results": [
    {
      "chunkId": "uuid",
      "content": "Our business hours are Monday-Friday 8am-6pm...",
      "score": 0.94,
      "source": {
        "id": "uuid",
        "type": "faq",
        "title": "Business Hours FAQ"
      },
      "heading": null,
      "relevanceFactors": {
        "semantic": 0.92,
        "keyword": 0.96,
        "combined": 0.94
      }
    }
  ],
  "queryTokens": 5,
  "searchTimeMs": 45
}
```

### 3.4 Retrieval Strategy

[PLANNED] ReplyIQ uses a hybrid retrieval approach combining semantic and keyword search.

#### 3.4.1 Semantic Search

1. Embed the incoming query using the same embedding model
2. Perform approximate nearest neighbor (ANN) search using pgvector HNSW index
3. Return top-K candidates ranked by cosine similarity

#### 3.4.2 Keyword Search

1. Apply full-text search (PostgreSQL `tsvector` / `ts_query`) against chunk content
2. Use trigram similarity for fuzzy matching
3. Apply BM25-style scoring

#### 3.4.3 Hybrid Ranking

1. Execute both semantic and keyword searches in parallel
2. Normalize scores to [0, 1] range
3. Combine using weighted average: `finalScore = (semanticWeight * semanticScore) + (keywordWeight * keywordScore)`
4. Default weights: semantic 0.6, keyword 0.4 (configurable per business)
5. Apply source priority boosting (FAQ entries can have priority weights)
6. Filter by minimum score threshold
7. Return top-N results

#### 3.4.4 Context Window Construction

[PLANNED] Retrieved chunks are assembled into a context window for the LLM:

1. Sort selected chunks by relevance score (descending)
2. Truncate to fit within token budget (configurable, default: 2000 tokens)
3. Prepend source attribution headers to each chunk
4. Add separator between chunks
5. Format as structured context block for prompt injection

```
[PLANNED] Context format:
---
Source: FAQ - Business Hours (priority: high)
Content: Our business hours are Monday-Friday 8am-6pm, Saturday 9am-1pm...
---
Source: Document - Company Policy.pdf (page 3)
Content: All appointments must be scheduled at least 24 hours in advance...
---
```

#### 3.4.5 Relevance Scoring

[PLANNED] Final response confidence is derived from:

| Factor | Weight | Description |
|--------|--------|-------------|
| Top chunk score | 0.4 | Best matching chunk similarity score |
| Average chunk score | 0.2 | Mean score across all retrieved chunks |
| Source diversity | 0.1 | Bonus for matches across multiple sources |
| FAQ priority | 0.1 | Boost for high-priority FAQ matches |
| Query clarity | 0.2 | Estimated query specificity |

**Confidence thresholds:**

| Range | Label | Behavior |
|-------|-------|----------|
| 0.85 - 1.00 | High | Answer directly with confidence |
| 0.60 - 0.84 | Medium | Answer with caveat ("Based on our information...") |
| 0.40 - 0.59 | Low | Attempt answer, offer to connect with human |
| 0.00 - 0.39 | No match | "I don't have that information. Let me connect you with someone who can help." |

#### 3.4.6 Source Attribution

[PLANNED] Every AI response includes source references:

```json
{
  "response": "Our business hours are Monday through Friday, 8am to 6pm.",
  "sources": [
    {
      "id": "uuid",
      "type": "faq",
      "title": "Business Hours FAQ",
      "chunkId": "uuid",
      "score": 0.94
    }
  ],
  "confidence": 0.94,
  "answerable": true
}
```

---

## 4. Milestone 6 -- AI Receptionist

[PLANNED] All content in this section is planned for Milestone 6.

### 4.1 LLM Integration

#### 4.1.1 Provider Abstraction

[PLANNED] ReplyIQ abstracts LLM providers behind a unified interface so businesses can choose their preferred provider.

```
[PLANNED] LLMProvider (interface)
├── sendMessage(messages, config) -> LLMResponse
├── estimateTokens(text) -> number
├── getModelInfo() -> ModelInfo

Implementations:
├── OpenAIProvider
│   ├── gpt-4o          (recommended)
│   ├── gpt-4o-mini     (cost-optimized)
│   └── gpt-4-turbo     (legacy)
├── AnthropicProvider
│   ├── claude-sonnet-4-20250514
│   └── claude-haiku-4-20250514
├── GoogleProvider
│   ├── gemini-2.0-flash
│   └── gemini-1.5-pro
└── LocalProvider
    └── llama-3.x        (self-hosted, Ollama or vLLM)
```

**Provider configuration per business:**

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "apiKey": "encrypted-key",
  "temperature": 0.7,
  "maxTokens": 1024,
  "systemPromptOverride": null,
  "fallbackProvider": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

#### 4.1.2 Model Abstraction

[PLANNED] The system does not depend on any single model's behavior. All model interactions go through:

1. **Message formatting** -- Normalized message format regardless of provider
2. **Token counting** -- Provider-specific token estimation
3. **Response parsing** -- Normalized response extraction (content, finish reason, usage)
4. **Streaming support** -- SSE streaming abstraction for real-time widget responses
5. **Function calling** -- Normalized tool/function call format (for future tool use)

### 4.2 Prompt Architecture

[PLANNED] The AI receptionist uses a structured prompt system with layered context.

#### 4.2.1 System Prompt (per business)

[PLANNED] Each business configures a base system prompt that defines the AI's identity and behavioral rules.

```
[PLANNED] System prompt structure:

Layer 1: Identity
  "You are {businessName}'s AI receptionist. Your name is {aiName}."

Layer 2: Role and capabilities
  "You help visitors by answering questions about {businessName}'s products/services,
   qualifying leads, and scheduling appointments."

Layer 3: Behavioral rules
  - Tone and personality guidelines
  - Topics to address
  - Topics to avoid
  - Escalation triggers
  - Required information to collect

Layer 4: Business-specific instructions
  - Custom rules per business
  - Industry-specific language
  - Compliance requirements

Layer 5: Knowledge context (dynamic)
  - Retrieved knowledge chunks injected here

Layer 6: Conversation context (dynamic)
  - Conversation history summary
  - Collected lead information
  - Current intent classification
```

#### 4.2.2 Business-Specific Knowledge Context

[PLANNED] Injected into the prompt dynamically per query:

```
---
RETRIEVED KNOWLEDGE:
{chunk_1}
{chunk_2}
{chunk_3}

BUSINESS INFORMATION:
Name: {businessName}
Industry: {industry}
Website: {websiteUrl}
Hours: {businessHours}
Location: {address}
Phone: {phone}
Services: {services}
---

IMPORTANT: Only use the information provided above to answer questions.
If you do not have information to answer a question, say so honestly
and offer to connect the visitor with a human team member.
```

#### 4.2.3 Conversation Context

[PLANNED] Maintained across the conversation lifetime:

```
CONVERSATION HISTORY:
{message_1}
{message_2}
...

COLLECTED INFORMATION:
Name: {name}
Email: {email}
Phone: {phone}
Intent: {intent}
Qualification Score: {score}

CURRENT TASK: {active_task}
```

### 4.3 AI Receptionist Behavior

[PLANNED] The AI receptionist follows a structured behavioral framework.

#### 4.3.1 Greeting

[PLANNED] On first contact, the AI sends a configurable greeting:

```
Default: "Hi there! I'm {aiName}, {businessName}'s virtual assistant.
         How can I help you today?"
```

**Greeting variants (configurable):**
- Standard greeting (above)
- Time-aware greeting ("Good morning!", "Good evening!")
- Returning visitor greeting ("Welcome back!")
- Custom greeting per page (widget can pass page context)

#### 4.3.2 Intent Detection

[PLANNED] Every visitor message is classified into one or more intents:

| Intent | Description | Example Phrases |
|--------|-------------|-----------------|
| `information_seeking` | Asking about business, services, hours, etc. | "What services do you offer?" |
| `appointment_request` | Wants to schedule or book | "I'd like to book an appointment" |
| `pricing_inquiry` | Asking about costs, plans, quotes | "How much does it cost?" |
| `support_request` | Existing customer needs help | "I have a problem with my order" |
| `complaint` | Dissatisfied visitor | "I'm not happy with..." |
| `human_request` | Wants to talk to a person | "Can I talk to someone?" |
| `general_greeting` | Casual hello | "Hi", "Hello" |
| `out_of_scope` | Not related to the business | "What's the weather?" |
| `lead_qualification` | Providing contact information | "My name is John..." |

**Intent detection mechanism:**
1. LLM-based classification using a structured output prompt
2. Confidence score per intent
3. Primary intent + secondary intents returned
4. Used to route conversation flow

#### 4.3.3 Conversation Flow Rules

[PLANNED]

```
1. GREET visitor (first message only)
2. CLASSIFY intent of visitor message
3. IF intent = information_seeking:
   a. RETRIEVE relevant knowledge
   b. GENERATE response from knowledge
   c. INCLUDE source attribution
4. IF intent = appointment_request:
   a. TRIGGER appointment scheduling flow
   b. COLLECT required fields (name, email, preferred time)
   c. CONFIRM and create booking
5. IF intent = pricing_inquiry:
   a. RETRIEVE pricing knowledge
   b. PROVIDE available information
   c. ESCALATE if pricing not in knowledge base
6. IF intent = human_request OR confidence < threshold:
   a. INITIATE human handoff flow
7. IF intent = lead_qualification:
   a. EXTRACT and STORE provided information
   b. UPDATE qualification score
8. IF intent = out_of_scope:
   a. POLITELY decline
   b. REDIRECT to business-relevant topics
9. IF lead qualification threshold met:
   a. CAPTURE lead
   b. NOTIFY business
```

#### 4.3.4 Appointment Scheduling Integration

[PLANNED] The AI receptionist integrates with the existing appointment scheduling system:

1. Visitor requests appointment
2. AI asks for required information (service type, preferred date/time, contact info)
3. AI checks availability via scheduling API
4. AI proposes available slots
5. Visitor selects slot
6. AI confirms booking
7. AI sends confirmation (email if available)
8. AI updates conversation context with booking details

**Scheduling providers (future):**
- Calendly integration
- Google Calendar API
- Microsoft Outlook / Exchange
- Custom booking system

#### 4.3.5 Fallback Behavior

[PLANNED] When the AI cannot handle a request:

| Scenario | Fallback Behavior |
|----------|-------------------|
| No knowledge found | "I don't have information about that. Let me connect you with our team." |
| LLM error / timeout | "I'm having a technical issue. Let me connect you with a team member." |
| Ambiguous query | "I want to make sure I understand correctly. Could you tell me more about what you're looking for?" |
| Out of scope | "I specialize in helping with {businessName}'s services. How can I assist you with those?" |
| Visitor explicitly asks for human | "Absolutely, let me connect you with someone right away." |
| Confidence below threshold for 3+ consecutive messages | Auto-escalate to human handoff |

#### 4.3.6 Human Handoff Flow

[PLANNED] The human handoff process:

```
1. TRIGGER identified (low confidence, explicit request, complex query)
2. INFORM visitor: "Let me connect you with a team member who can help."
3. CAPTURE handoff reason and full conversation context
4. NOTIFY available human agent via:
   a. Dashboard notification (real-time)
   b. Email notification
   c. SMS notification (future)
   d. Slack/webhook integration (future)
5. TRANSFER conversation context to human agent
6. AI enters "standby" mode:
   a. Can still respond to simple follow-ups
   b. Main handling passed to human
7. HUMAN AGENT joins conversation
8. AI provides context summary to human agent:
   - Visitor's stated needs
   - Information already collected
   - Knowledge retrieved
   - Suggested next steps
```

**Handoff trigger conditions:**

| Trigger | Threshold | Configurable |
|---------|-----------|--------------|
| Low confidence | Score < 0.40 for any response | Yes |
| Explicit request | Visitor says "talk to human" / "speak to someone" | No (always triggers) |
| Complex query | LLM detects query requires human judgment | Partially |
| Frustration detected | Sentiment analysis indicates frustration | Yes |
| Multiple failed attempts | 3+ consecutive low-confidence responses | Yes |
| Business hours match | If business prefers human during hours | Yes |

#### 4.3.7 Hallucination Prevention

[PLANNED] Multiple safeguards to prevent the AI from generating false information:

1. **Knowledge grounding:** AI is instructed to only use provided knowledge context. Explicit system prompt instruction: "Only answer based on the information provided. Do not make up information."

2. **No-knowledge fallback:** When no relevant knowledge is retrieved (score < 0.40), the AI says it doesn't know rather than guessing.

3. **Confidence signaling:** Every response includes a confidence score. Low-confidence responses include a caveat.

4. **Source attribution:** Every factual claim links back to a specific source chunk. The AI is prompted to cite sources.

5. **Strict prompt boundaries:** System prompt includes: "If you are not certain about an answer, say 'I'm not sure about that' rather than providing potentially incorrect information."

6. **Output validation:** Post-generation checks:
   - Verify any referenced entities exist in knowledge base
   - Check for contradictions with existing knowledge
   - Flag responses that contain specific numbers not found in knowledge

7. **Human escalation for critical domains:** Configurable domain-specific rules (e.g., medical, legal, financial) that auto-escalate to human regardless of confidence.

### 4.4 Conversation Management

[PLANNED] The conversation manager maintains state across the entire visitor interaction.

#### 4.4.1 Conversation Lifecycle

```
[PLANNED] Complete lifecycle:

1. VISITOR initiates chat (via widget on business website)
   └── Widget sends: visitorId (anonymous), businessId, pageUrl, referrer

2. AI GREETS visitor
   └── System generates greeting based on business config
   └── Conversation record created with status: active

3. VISITOR asks question
   └── Message stored in conversation history
   └── Intent classified

4. AI RETRIEVES relevant knowledge
   └── Query embedded
   └── Hybrid search executed
   └── Relevant chunks assembled

5. AI CONSTRUCTS context
   └── System prompt (business-specific)
   └── Knowledge context (retrieved chunks)
   └── Conversation history (recent messages)
   └── Lead data (if any collected)

6. AI GENERATES response
   └── LLM called with constructed context
   └── Response validated (hallucination checks)
   └── Sources attached

7. LEAD CAPTURED (if qualified)
   └── Contact information extracted
   └── Qualification score calculated
   └── Business notified

8. HUMAN HANDOFF (if needed)
   └── Context packaged and transferred
   └── AI standby mode activated
```

#### 4.4.2 Conversation State

```json
[PLANNED]
{
  "conversationId": "uuid",
  "visitorId": "uuid",
  "businessId": "uuid",
  "organizationId": "uuid",
  "status": "active | handed_off | closed",
  "startedAt": "timestamp",
  "lastActivityAt": "timestamp",
  "messageCount": 12,
  "currentIntent": "appointment_request",
  "confidence": 0.87,
  "leadData": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1-555-0123",
    "qualificationScore": 75,
    "qualified": true
  },
  "handoff": {
    "triggered": false,
    "reason": null,
    "assignedAgent": null
  },
  "context": {
    "pageUrl": "https://example.com/pricing",
    "referrer": "google.com",
    "visitCount": 2
  }
}
```

#### 4.4.3 Memory and History

[PLANNED]

| Memory Type | Scope | Storage | Duration |
|-------------|-------|---------|----------|
| Message history | Per conversation | PostgreSQL | Conversation lifetime + 30 days |
| Lead data | Per conversation | PostgreSQL | Permanent (until deleted) |
| Conversation summary | Per conversation | Generated and stored | Conversation lifetime |
| Visitor recognition | Cross-conversation | Cookie / fingerprint | 30 days |

**History management:**
- Full message history available for the current conversation
- For long conversations (>20 messages), older messages are summarized to fit context window
- Summary is regenerated every 10 messages
- Complete history always preserved in database for analytics

#### 4.4.4 Multi-Session Support

[PLANNED] A single visitor can have multiple conversations:

1. Returning visitor recognized via cookie/fingerprint
2. Previous conversation summary loaded
3. AI can reference previous interactions: "Welcome back! Last time we discussed..."
4. New conversation created but linked to visitor profile

### 4.5 Lead Capture

[PLANNED] The AI receptionist captures and qualifies leads during conversation.

#### 4.5.1 Information Collection

[PLANNED] The AI naturally collects lead information during conversation:

| Field | Collection Method | Required for Qualification |
|-------|-------------------|---------------------------|
| Name | Asked directly or extracted from introduction | Yes |
| Email | Asked directly or extracted from mention | Yes |
| Phone | Asked directly or extracted from mention | Recommended |
| Company | Asked during B2B conversations | Optional |
| Service interest | Determined from conversation intent | Yes |
| Budget range | Asked if relevant to business type | Optional |
| Timeline | Asked if relevant to business type | Optional |
| Pain points | Extracted from conversation | Optional |

**Extraction strategy:**
1. **Proactive collection:** AI asks for contact info naturally during conversation
2. **Passive extraction:** AI extracts info when visitor mentions it unprompted
3. **Confirmation:** AI confirms extracted info before storing: "Just to confirm, your email is john@example.com?"

#### 4.5.2 Qualification Scoring

[PLANNED] Each lead receives a score based on configurable criteria:

```
[PLANNED] Scoring model (configurable per business):

Base score: 0

+ 20 points  Has email address
+ 15 points  Has phone number
+ 10 points  Has company name
+ 15 points  Expressed specific service interest
+ 10 points  Has defined timeline
+ 10 points  Has stated budget
+ 10 points  Requested appointment/demo
+ 10 points  Fit with target industry (if configured)

Thresholds:
  0-30:   Cold lead
  31-60:  Warm lead
  61-80:  Hot lead
  81-100: Qualified lead (auto-notify)
```

#### 4.5.3 CRM Integration (Future)

[PLANNED] Future integration with CRM systems:

| CRM | Integration Method | Priority |
|-----|-------------------|----------|
| HubSpot | API v3 | High |
| Salesforce | REST API | High |
| Pipedrive | API v1 | Medium |
| Zoho CRM | API v2 | Medium |
| Custom CRM | Webhook / API | Configurable |

**Integration flow:**
1. Lead qualified (score >= threshold)
2. CRM payload constructed from lead data
3. CRM API called to create/update contact
4. Conversation summary attached as note
5. Deal/opportunity created (if applicable)
6. Sync status tracked for retry on failure

#### 4.5.4 Business Notification

[PLANNED] When a lead is captured or qualified:

| Notification Type | Channel | Trigger |
|-------------------|---------|---------|
| New conversation started | Dashboard (real-time) | Any new chat |
| Lead captured | Dashboard + Email | Contact info collected |
| Lead qualified | Dashboard + Email + SMS | Score >= 80 |
| Appointment booked | Dashboard + Email + Calendar | Booking confirmed |
| Human handoff requested | Dashboard + SMS + Email | Handoff triggered |

### 4.6 AI Configuration per Business

[PLANNED] Each business has independent AI configuration:

```json
[PLANNED]
{
  "businessId": "uuid",

  "aiPersona": {
    "name": "Alex",
    "greeting": "Hi! I'm Alex, Acme Corp's virtual assistant...",
    "tone": "professional_friendly",
    "personality": "Helpful, concise, and knowledgeable"
  },

  "llmConfig": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 1024,
    "systemPrompt": "You are Acme Corp's AI receptionist..."
  },

  "retrievalConfig": {
    "embeddingModel": "text-embedding-3-small",
    "semanticWeight": 0.6,
    "keywordWeight": 0.4,
    "maxChunks": 5,
    "minScore": 0.40,
    "contextTokenBudget": 2000
  },

  "behaviorConfig": {
    "allowAppointmentBooking": true,
    "allowLeadCapture": true,
    "humanHandoffEnabled": true,
    "confidenceThresholdForHandoff": 0.40,
    "maxAutoResponsesBeforeHandoff": 5,
    "operatingHours": {
      "timezone": "America/New_York",
      "schedule": { ... }
    },
    "afterHoursMessage": "Thanks for reaching out! Our team is currently away...",
    "language": "en"
  },

  "leadConfig": {
    "qualificationThreshold": 60,
    "scoringModel": { ... },
    "notifyOnLead": true,
    "notifyChannels": ["email", "dashboard"],
    "crmIntegration": null
  },

  "knowledgeConfig": {
    "sources": ["uuid1", "uuid2", "uuid3"],
    "lastIndexedAt": "timestamp",
    "autoRescrape": false,
    "rescrapeInterval": "weekly"
  }
}
```

### 4.7 Token and Cost Management

[PLANNED] ReplyIQ monitors and manages LLM token usage to control costs.

#### 4.7.1 Token Budget System

| Budget Type | Default | Description |
|-------------|---------|-------------|
| Per conversation | 10,000 tokens | Max tokens per single LLM call |
| Per day (business) | 100,000 tokens | Daily limit per business |
| Per month (business) | 2,000,000 tokens | Monthly limit per business |
| Context window | 2,000 tokens | Knowledge context budget |
| History budget | 1,000 tokens | Conversation history budget |

#### 4.7.2 Cost Tracking

[PLANNED] Per-business cost tracking:

```
[PLANNED] Table: ai_usage_logs
├── id: UUID (PK)
├── organizationId: UUID
├── businessId: UUID
├── conversationId: UUID
├── provider: string
├── model: string
├── inputTokens: integer
├── outputTokens: integer
├── estimatedCostUsd: decimal(10, 6)
├── latencyMs: integer
├── cacheHit: boolean
├── createdAt: timestamp
```

**Cost optimization strategies:**
1. **Prompt caching:** Cache repeated system prompts (provider-dependent)
2. **Response caching:** Cache responses to identical queries (hash-based)
3. **Chunk caching:** Cache embedding lookups for repeated queries
4. **Model tiering:** Use cheaper models (gpt-4o-mini) for simple queries, premium for complex
5. **Context compression:** Summarize long conversation histories instead of passing full history

#### 4.7.3 Usage Alerts

[PLANNED] Configurable alerts:

| Alert | Default Threshold | Action |
|-------|-------------------|--------|
| Daily limit approaching | 80% of daily budget | Email notification |
| Daily limit reached | 100% of daily budget | Switch to fallback model |
| Monthly limit approaching | 80% of monthly budget | Email notification |
| Monthly limit reached | 100% of monthly budget | AI disabled, widget shows fallback message |
| Unusual spike | 3x average daily usage | Email alert to admin |

### 4.8 AI Observability

[PLANNED] Full observability into AI behavior for debugging and improvement.

#### 4.8.1 Conversation Logging

[PLANNED] Every conversation is fully logged:

```
[PLANNED] Table: ai_conversation_logs
├── id: UUID (PK)
├── conversationId: UUID
├── messageId: UUID
├── role: enum ('user', 'assistant', 'system')
├── content: text
├── intent: string (nullable)
├── intentConfidence: float (nullable)
├── knowledgeChunksUsed: UUID[] (nullable)
├── retrievalScores: float[] (nullable)
├── confidence: float (nullable)
├── tokenCount: integer
├── latencyMs: integer
├── provider: string
├── model: string
├── handoffTriggered: boolean
├── handoffReason: string (nullable)
├── createdAt: timestamp
```

#### 4.8.2 Analytics Dashboard

[PLANNED] Real-time and historical analytics:

| Metric | Description |
|--------|-------------|
| Total conversations | Count per day/week/month |
| Average response confidence | Mean confidence score |
| Knowledge coverage | % of queries answered from knowledge base |
| Handoff rate | % of conversations escalated to human |
| Top unanswered queries | Most common queries without knowledge matches |
| Average conversation length | Messages per conversation |
| Lead conversion rate | % of conversations producing qualified leads |
| Appointment conversion rate | % of conversations resulting in bookings |
| Token usage | Per business, per day |
| Cost per conversation | Average LLM cost per conversation |
| Response latency | Average time to generate response |
| Satisfaction score | Post-conversation rating (future) |

#### 4.8.3 Debug Mode

[PLANNED] For business admins and support staff:

- View full conversation transcripts
- See retrieved knowledge chunks and scores
- View prompt sent to LLM (full context)
- See LLM raw response before post-processing
- View confidence calculation breakdown
- Replay conversation through the system
- A/B test different prompts or configurations

---

## 5. Database Schema Additions

[PLANNED] Additional tables and columns for the AI Knowledge Receptionist system.

### 5.1 New Tables

```
[PLANNED] Table: knowledge_sources
├── id: UUID (PK)
├── organizationId: UUID (FK)
├── businessId: UUID (FK)
├── type: enum ('faq', 'document', 'url')
├── title: text
├── content: text (raw content, nullable)
├── fileUrl: text (nullable, for documents)
├── externalUrl: text (nullable, for URLs)
├── chunkCount: integer (default 0)
├── status: enum ('processing', 'ready', 'failed')
├── errorMessage: text (nullable)
├── lastIndexedAt: timestamp (nullable)
├── createdAt: timestamp
├── updatedAt: timestamp
├── deletedAt: timestamp (nullable)

[PLANNED] Table: knowledge_chunks
├── id: UUID (PK)
├── organizationId: UUID (FK)
├── businessId: UUID (FK)
├── sourceId: UUID (FK -> knowledge_sources)
├── sourceType: enum ('faq', 'document', 'url')
├── content: text
├── embedding: vector(1536)
├── chunkIndex: integer
├── heading: text (nullable)
├── pageNumber: integer (nullable)
├── tokenCount: integer
├── contentHash: text
├── isActive: boolean (default true)
├── createdAt: timestamp
├── updatedAt: timestamp

[PLANNED] Table: ai_configurations
├── id: UUID (PK)
├── organizationId: UUID (FK)
├── businessId: UUID (FK, UNIQUE)
├── aiPersona: jsonb
├── llmConfig: jsonb
├── retrievalConfig: jsonb
├── behaviorConfig: jsonb
├── leadConfig: jsonb
├── createdAt: timestamp
├── updatedAt: timestamp

[PLANNED] Table: ai_conversations
├── id: UUID (PK)
├── organizationId: UUID (FK)
├── businessId: UUID (FK)
├── visitorId: UUID (FK)
├── status: enum ('active', 'handed_off', 'closed', 'expired')
├── startedAt: timestamp
├── lastActivityAt: timestamp
├── messageCount: integer (default 0)
├── currentIntent: text (nullable)
├── confidence: float (nullable)
├── leadData: jsonb (nullable)
├── handoffData: jsonb (nullable)
├── context: jsonb
├── createdAt: timestamp
├── updatedAt: timestamp

[PLANNED] Table: ai_messages
├── id: UUID (PK)
├── conversationId: UUID (FK)
├── role: enum ('user', 'assistant', 'system')
├── content: text
├── intent: text (nullable)
├── intentConfidence: float (nullable)
├── knowledgeChunksUsed: UUID[] (nullable)
├── retrievalScores: float[] (nullable)
├── confidence: float (nullable)
├── tokenCount: integer
├── latencyMs: integer
├── provider: string
├── model: string
├── createdAt: timestamp

[PLANNED] Table: ai_usage_logs
├── id: UUID (PK)
├── organizationId: UUID (FK)
├── businessId: UUID (FK)
├── conversationId: UUID (FK)
├── provider: string
├── model: string
├── inputTokens: integer
├── outputTokens: integer
├── estimatedCostUsd: decimal(10, 6)
├── latencyMs: integer
├── cacheHit: boolean (default false)
├── createdAt: timestamp

[PLANNED] Table: visitors
├── id: UUID (PK)
├── organizationId: UUID (FK)
├── fingerprint: text (nullable)
├── ipAddress: text (nullable)
├── userAgent: text (nullable)
├── firstSeenAt: timestamp
├── lastSeenAt: timestamp
├── conversationCount: integer (default 0)
├── metadata: jsonb (nullable)
├── createdAt: timestamp
├── updatedAt: timestamp
```

---

## 6. API Endpoints

[PLANNED] New API endpoints for the AI Knowledge Receptionist.

### 6.1 Knowledge Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/knowledge/sources` | List all knowledge sources for a business |
| POST | `/api/v1/knowledge/sources` | Create a new knowledge source |
| GET | `/api/v1/knowledge/sources/:id` | Get knowledge source details |
| PUT | `/api/v1/knowledge/sources/:id` | Update knowledge source |
| DELETE | `/api/v1/knowledge/sources/:id` | Soft delete knowledge source |
| POST | `/api/v1/knowledge/sources/:id/reindex` | Re-index a knowledge source |
| POST | `/api/v1/knowledge/upload` | Upload a document for ingestion |
| POST | `/api/v1/knowledge/scrape` | Add a URL for scraping |
| GET | `/api/v1/knowledge/faqs` | List FAQ entries |
| POST | `/api/v1/knowledge/faqs` | Create FAQ entry |
| PUT | `/api/v1/knowledge/faqs/:id` | Update FAQ entry |
| DELETE | `/api/v1/knowledge/faqs/:id` | Delete FAQ entry |
| POST | `/api/v1/knowledge/faqs/bulk-import` | Bulk import FAQs from CSV |
| POST | `/api/v1/knowledge/search` | Search knowledge base (RAG) |

### 6.2 AI Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/ai/config/:businessId` | Get AI configuration for a business |
| PUT | `/api/v1/ai/config/:businessId` | Update AI configuration |
| POST | `/api/v1/ai/config/:businessId/test` | Test AI configuration with sample query |

### 6.3 Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/ai/conversations` | List conversations for a business |
| GET | `/api/v1/ai/conversations/:id` | Get conversation details |
| GET | `/api/v1/ai/conversations/:id/messages` | Get messages for a conversation |
| POST | `/api/v1/ai/conversations/:id/handoff` | Manually trigger handoff |
| POST | `/api/v1/ai/conversations/:id/close` | Close a conversation |

### 6.4 Chat (Widget-facing)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chat/start` | Start a new chat session |
| POST | `/api/v1/chat/message` | Send a message and get AI response |
| GET | `/api/v1/chat/history/:conversationId` | Get conversation history |
| POST | `/api/v1/chat/end` | End a chat session |

### 6.5 Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/ai/analytics/overview` | Get AI performance overview |
| GET | `/api/v1/ai/analytics/conversations` | Get conversation analytics |
| GET | `/api/v1/ai/analytics/usage` | Get token usage and cost data |
| GET | `/api/v1/ai/analytics/knowledge-gaps` | Get top unanswered queries |

---

## 7. Privacy Considerations

[PLANNED] The AI Knowledge Receptionist must handle data with privacy in mind.

### 7.1 Data Handling

| Data Type | Storage | Retention | Encryption |
|-----------|---------|-----------|------------|
| Conversation messages | PostgreSQL | 90 days (configurable) | At rest (AES-256) |
| Visitor IP addresses | PostgreSQL | 30 days | At rest |
| Visitor fingerprints | PostgreSQL | 30 days | At rest |
| Lead contact info | PostgreSQL | Until deleted | At rest + in transit |
| Uploaded documents | Object storage | Until deleted | At rest + in transit |
| Embedding vectors | PostgreSQL | Source lifetime | At rest |
| LLM API logs | Provider-dependent | Per provider policy | Per provider |

### 7.2 Privacy Rules

1. **Data minimization:** Only collect information necessary for qualification and scheduling
2. **Purpose limitation:** Collected data used only for stated business purposes
3. **Right to deletion:** Visitors can request data deletion (GDPR/CCPA compliance)
4. **Consent:** Widget displays privacy notice on first interaction
5. **PII handling:** PII in conversations is flagged and can be redacted on request
6. **Data isolation:** Business data is completely isolated via `organizationId` scoping
7. **LLM data policy:** conversations sent to LLM providers are subject to provider data policies; option to use zero-retention endpoints where available
8. **Audit trail:** All data access is logged for compliance auditing

### 7.3 Compliance Target

| Regulation | Status | Notes |
|------------|--------|-------|
| GDPR | Planned | Data export, deletion, consent management |
| CCPA | Planned | Do-not-sell, deletion requests |
| SOC 2 | Future | Formal audit controls |

---

## 8. Security Considerations

[PLANNED]

1. **API key management:** LLM provider API keys encrypted at rest, never exposed in responses
2. **Prompt injection prevention:** Input sanitization before LLM calls; system prompt isolation
3. **Rate limiting:** Per-visitor and per-business rate limits on chat endpoints
4. **Content filtering:** Reject malicious or harmful content before LLM processing
5. **Access control:** AI configuration only accessible to business admins and owners
6. **Audit logging:** All AI interactions logged for security review
7. **Data encryption:** All data encrypted at rest (AES-256) and in transit (TLS 1.3)
8. **Visitor session management:** Session tokens expire after 24 hours of inactivity

---

## 9. Implementation Roadmap

### Milestone 5: Knowledge Engine

| Phase | Task | Effort | Dependencies |
|-------|------|--------|-------------|
| 5.1 | Database schema for knowledge sources and chunks | 1 day | Milestone 4 complete |
| 5.2 | Document parsing pipeline (PDF, DOCX, TXT, MD) | 3 days | 5.1 |
| 5.3 | URL scraping service | 2 days | 5.1 |
| 5.4 | FAQ CRUD (API + dashboard) | 2 days | 5.1 |
| 5.5 | Text chunking and cleaning pipeline | 2 days | 5.2 |
| 5.6 | Embedding generation service | 1 day | 5.5 |
| 5.7 | pgvector setup and index creation | 1 day | 5.1 |
| 5.8 | Knowledge search API (semantic) | 2 days | 5.6, 5.7 |
| 5.9 | Knowledge search API (hybrid) | 2 days | 5.8 |
| 5.10 | Knowledge management dashboard UI | 3 days | 5.2-5.4 |
| 5.11 | Ingestion pipeline orchestrator | 2 days | 5.2-5.6 |
| 5.12 | Testing and optimization | 2 days | 5.1-5.11 |
| **Total** | | **~23 days** | |

### Milestone 6: AI Receptionist

| Phase | Task | Effort | Dependencies |
|-------|------|--------|-------------|
| 6.1 | Database schema for conversations, messages, config | 1 day | Milestone 5 complete |
| 6.2 | LLM provider abstraction layer | 3 days | 6.1 |
| 6.3 | Prompt architecture and system prompt builder | 2 days | 6.2 |
| 6.4 | Conversation state manager | 3 days | 6.1 |
| 6.5 | Intent detection system | 2 days | 6.2 |
| 6.6 | AI receptionist core (generate, retrieve, respond) | 4 days | 6.2-6.5 |
| 6.7 | Lead capture and qualification scoring | 2 days | 6.6 |
| 6.8 | Human handoff flow | 2 days | 6.6 |
| 6.9 | Chat widget backend (WebSocket/SSE) | 3 days | 6.6 |
| 6.10 | Chat widget frontend (real-time) | 3 days | 6.9 |
| 6.11 | AI configuration dashboard | 2 days | 6.1 |
| 6.12 | Hallucination prevention and validation | 2 days | 6.6 |
| 6.13 | Token/cost management and usage tracking | 2 days | 6.6 |
| 6.14 | AI analytics dashboard | 2 days | 6.13 |
| 6.15 | Notification system (email, dashboard) | 2 days | 6.7, 6.8 |
| 6.16 | Testing, prompt tuning, and optimization | 3 days | 6.1-6.15 |
| **Total** | | **~38 days** | |

---

## 10. Future AI Capabilities

[PLANNED] Capabilities beyond Milestones 5-6, listed for architectural awareness.

| Capability | Description | Priority |
|------------|-------------|----------|
| **Multi-channel support** | Extend AI to email, SMS, WhatsApp, social media | High |
| **Voice AI** | Real-time voice conversations via WebRTC | High |
| **Proactive engagement** | AI initiates chat based on visitor behavior | Medium |
| **Sentiment analysis** | Real-time mood detection during conversation | Medium |
| **Language detection and multilingual** | Auto-detect visitor language, respond accordingly | Medium |
| **A/B testing framework** | Test different prompts, greetings, flows | Medium |
| **Custom training / fine-tuning** | Fine-tune models on business-specific data | Low |
| **Image understanding** | Process images sent by visitors (e.g., screenshots of issues) | Low |
| **Workflow automation** | Trigger business workflows based on conversation events | Medium |
| **Knowledge auto-discovery** | Automatically discover and index knowledge from website | Low |
| **Conversation analytics** | Deep analytics on conversation patterns and outcomes | Medium |
| **AI-assisted handoff summary** | Generate handoff summaries for human agents | High |
| **Appointment confirmation AI** | AI handles appointment confirmations and reminders | Medium |
| **Follow-up automation** | AI sends follow-up messages after conversation | Medium |
| **Multi-language support** | Simultaneous support for multiple languages | Low |
| **Agent copilot** | AI assists human agents during live conversations | Low |

---

## Appendix A: Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector database | pgvector (PostgreSQL extension) | No additional infrastructure; sufficient for SMB scale; ACID compliance |
| Embedding model | text-embedding-3-small (OpenAI) default | Good cost/performance ratio; configurable per business |
| LLM default | gpt-4o (OpenAI) | Best balance of quality, speed, and cost for receptionist use case |
| Chunking strategy | Recursive character splitting | Preserves document structure; handles edge cases better than fixed-size |
| Search approach | Hybrid (semantic + keyword) | Semantic for meaning matching; keyword for exact term matching |
| Real-time transport | Server-Sent Events (SSE) | Simpler than WebSocket for unidirectional server push; sufficient for chat |
| Conversation storage | PostgreSQL | Consistency with existing stack; no additional database needed |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **RAG** | Retrieval-Augmented Generation; pattern where LLM responses are grounded in retrieved knowledge |
| **Embedding** | Numerical vector representation of text for similarity search |
| **Chunk** | A segment of a document split for embedding and retrieval |
| **Context window** | The combined prompt (system + knowledge + history) sent to the LLM |
| **Hallucination** | LLM generating information not present in the provided knowledge |
| **Confidence score** | Numeric measure of how well the retrieved knowledge answers the query |
| **Qualification score** | Numeric measure of how likely a visitor is to become a customer |
| **pgvector** | PostgreSQL extension for vector similarity search |
| **HNSW** | Hierarchical Navigable Small World; algorithm for approximate nearest neighbor search |
