/**
 * What to offer a visitor who has just opened the widget.
 *
 * ── The blank page is the problem ─────────────────────────────────────────
 * The panel used to open with a greeting and an empty box. That asks someone
 * who arrived for a completely different reason to stop, decide what they
 * want, and phrase it — and most people close the panel instead. It also
 * means the first question is a coin toss: if they happen to ask something
 * the business never published, their one impression of the product is "I
 * don't know".
 *
 * Offering three real questions fixes both. They come from the business's own
 * knowledge base, so the first answer is guaranteed to be a good one, and the
 * visitor learns what this thing is for by reading what it can do rather than
 * by being told.
 *
 * ── Why these are not generated ───────────────────────────────────────────
 * The obvious move is to have a model write three plausible questions. That
 * would break the rule the whole product rests on: a suggested question the
 * receptionist cannot answer is an invention, just at one remove, and it is
 * the worst possible one because WE put the words in the visitor's mouth.
 * Every suggestion here is the heading of something the owner published.
 */

/** Just enough of a knowledge item to choose with. */
export interface SuggestionCandidate {
  question: string | null;
}

/** Three fits one line on a phone and reads as a hint rather than a menu. */
export const MAX_SUGGESTIONS = 3;

/**
 * Long enough for "Do you take walk-in appointments?", short enough to stay
 * on one line in a 380px panel. Anything longer is a heading that was really
 * a sentence, and it wraps into a paragraph pretending to be a button.
 */
const MAX_SUGGESTION_LENGTH = 60;

/**
 * Pick the starter questions for a business.
 *
 * Real questions win over headings. "Do you take NHS patients?" invites a tap
 * in a way "Our Services" does not — one is a thing to ask, the other is a
 * filing label, and a crawled site is mostly filing labels. Order is
 * otherwise preserved, so an owner who arranges their FAQ deliberately gets
 * what they arranged.
 */
export function pickStarterQuestions(candidates: readonly SuggestionCandidate[]): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];
  const headings: string[] = [];

  for (const candidate of candidates) {
    const text = candidate.question?.trim();
    if (!text || text.length > MAX_SUGGESTION_LENGTH) continue;

    // Case-insensitive, because a crawl and a hand-written FAQ routinely
    // produce the same question with different capitalisation, and offering
    // it twice makes the business look careless.
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (text.endsWith('?')) questions.push(text);
    else headings.push(text);
  }

  return [...questions, ...headings].slice(0, MAX_SUGGESTIONS);
}
