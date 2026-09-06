/**
 * Deciding what the receptionist says.
 *
 * ── The product promise this enforces ─────────────────────────────────────
 * A receptionist that invents an answer is worse than no receptionist at all.
 * If it tells a caller "yes, we're open Sunday" and the shop is shut, the
 * business wears the consequence — and the owner finds out from an angry
 * customer, not from us. So the guarantee is: every answer is grounded in
 * something the owner actually published, and anything else is an honest
 * "I don't know, here's how to reach a human".
 *
 * That is also the differentiator (18-DIFFERENTIATION.md, D2). Competitors
 * demo well by answering everything; they fail in production for the same
 * reason.
 *
 * ── Why the engine is an interface ────────────────────────────────────────
 * The default responder needs no model at all: it retrieves the best-matching
 * owner-written answer and returns it verbatim. That is genuinely useful on
 * day one, costs nothing, and cannot hallucinate — a retrieved sentence is
 * either the owner's words or it is not returned.
 *
 * A language model improves phrasing, not truth. When one is plugged in it
 * receives the SAME retrieved passages and is bound to them, so the grounding
 * guarantee holds either way and swapping the engine cannot quietly weaken it.
 */

/** One retrieved passage, already scored by the search layer. */
export interface RetrievedPassage {
  id: string;
  question: string | null;
  content: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  /** Postgres ts_rank. Unbounded above, but in practice small. */
  rank: number;
}

export type AnswerConfidence = 'answered' | 'unsure' | 'unknown';

export interface Answer {
  confidence: AnswerConfidence;
  /** What the visitor sees. Always safe to display verbatim. */
  text: string;
  /** Passages the answer came from, for the "where did this come from" UI. */
  citations: Array<{ id: string; title: string | null; url: string | null }>;
}

/**
 * Any engine that turns a question plus retrieved passages into an answer.
 *
 * Deliberately takes the passages rather than fetching them, so retrieval and
 * grounding live in one place and an engine cannot go around them.
 */
export interface AnswerEngine {
  readonly name: string;
  answer(question: string, passages: RetrievedPassage[]): Promise<Answer>;
}

/**
 * Below this, a match is noise.
 *
 * Postgres `ts_rank` returns ~0.06 for a single weak term hit and climbs with
 * term frequency and weight. Anything at or under this floor is usually one
 * incidental word in common — the sort of match that produces a confidently
 * irrelevant answer, which is exactly the failure this whole design exists to
 * avoid. Tuned to prefer a false "I don't know" over a false answer.
 */
export const RELEVANCE_FLOOR = 0.05;

/** Above this, one passage is a clear winner rather than a guess. */
export const CONFIDENT_RANK = 0.1;

export const DONT_KNOW_TEXT =
  "I don't have an answer for that one. I'd rather say so than guess — please get in touch with the team directly and they'll help.";

/**
 * The default engine: return the owner's own words, or admit ignorance.
 *
 * No model, no key, no per-message cost, and no possibility of invention.
 */
export class RetrievalAnswerEngine implements AnswerEngine {
  readonly name = 'retrieval';

  answer(question: string, passages: RetrievedPassage[]): Promise<Answer> {
    const relevant = passages.filter((p) => p.rank > RELEVANCE_FLOOR);

    if (relevant.length === 0) {
      return Promise.resolve({
        confidence: 'unknown',
        text: DONT_KNOW_TEXT,
        citations: [],
      });
    }

    const [best, ...rest] = relevant;
    // `relevant` is non-empty, so `best` exists - narrowing for the compiler.
    if (!best) {
      return Promise.resolve({ confidence: 'unknown', text: DONT_KNOW_TEXT, citations: [] });
    }

    // A clear winner is answered plainly. A weak-but-present match is offered
    // with a hedge, because presenting a marginal hit in the same confident
    // voice as a strong one is how a visitor gets misled.
    const confident = best.rank >= CONFIDENT_RANK;
    const runnerUp = rest[0];
    const ambiguous = runnerUp !== undefined && best.rank - runnerUp.rank < 0.01;

    const text = confident && !ambiguous ? best.content : `${hedge(question)}\n\n${best.content}`;

    return Promise.resolve({
      confidence: confident && !ambiguous ? 'answered' : 'unsure',
      text,
      citations: relevant.slice(0, 3).map((p) => ({
        id: p.id,
        title: p.question ?? p.sourceTitle,
        url: p.sourceUrl,
      })),
    });
  }
}

/**
 * The hedge shown before a marginal match.
 *
 * Phrased as the receptionist being unsure, not as the visitor having asked
 * badly. "I'm not certain this is what you meant" invites a correction;
 * "your question was unclear" makes someone leave.
 */
function hedge(_question: string): string {
  return "I'm not certain this is exactly what you meant, but this may help:";
}

/**
 * What a business without any knowledge should say.
 *
 * Kept separate from `unknown` because the causes differ and so does the fix:
 * an empty knowledge base is the owner's to solve, and pretending it is a
 * failed lookup hides that from whoever is reading the logs.
 */
export const NO_KNOWLEDGE_TEXT =
  "I'm not set up to answer questions yet. Please contact the team directly and they'll be glad to help.";
