import { apiFetch } from './client';

/**
 * Recent visits, each read as the conversation it was.
 *
 * ── What is deliberately absent ──────────────────────────────────────────
 * Whether the visitor went on to leave their phone number. It is the obvious
 * next line of the story and the server will not send it: a lead carries no
 * session key, precisely so that a name typed into the widget can never be
 * attached to the other questions someone asked on the way there. See
 * CLAUDE.md rule 7, and `ReceptionistService.conversations` for the longer
 * version.
 *
 * The session key is absent too. Nothing here needs it, and an opaque
 * per-visitor token on screen is an invitation to start treating it as a
 * handle for a person.
 */

export type Verdict = 'GOOD' | 'WRONG' | null;

export interface Turn {
  id: string;
  /** Visitor-authored. Render as text, never as markup. */
  question: string;
  confidence: 'answered' | 'unsure' | 'unknown';
  askedAt: string;
  verdict: Verdict;
  /**
   * What the visitor was shown, rebuilt by the server from the passage that
   * answered plus the fixed hedge and refusal strings. Not a recording: if
   * the owner has edited that passage since, this is the edited wording,
   * which is why the UI attributes it rather than quoting it.
   */
  answer: string;
  /** The passage it came from, or null once that has been deleted. */
  answeredWith: { id: string; question: string | null } | null;
}

export interface Conversation {
  id: string;
  startedAt: string;
  endedAt: string;
  /** True if any question in the visit went unanswered. */
  hasGap: boolean;
  turns: Turn[];
}

export async function getConversations(
  businessId: string,
): Promise<{ conversations: Conversation[] }> {
  return apiFetch(`/api/v1/businesses/${businessId}/receptionist/conversations`);
}

export async function rateAnswer(
  businessId: string,
  questionId: string,
  verdict: Verdict,
): Promise<void> {
  await apiFetch(`/api/v1/businesses/${businessId}/receptionist/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ verdict }),
  });
}
