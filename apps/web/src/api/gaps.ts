import { apiFetch } from './client';

/**
 * The questions the receptionist could not answer, as a list of things to
 * write.
 *
 * Grouped by the server, not by exact string — "do you take cards" and "do
 * you take card" are one job. Every original phrasing is carried through and
 * shown, never summarised away: the owner is about to write one answer for
 * all of them and needs to see exactly what that covers.
 */

export interface GapCluster {
  /** The phrasing the most people typed. Always a real visitor's words. */
  question: string;
  phrasings: Array<{ question: string; timesAsked: number }>;
  timesAsked: number;
  askedAt: string;
}

export interface GapsResponse {
  clusters: GapCluster[];
  /**
   * Everyone who asked something it could not answer. Reported alongside the
   * cluster count so the grouping cannot make the problem look smaller than
   * it is.
   */
  totalAsked: number;
}

export async function getGaps(businessId: string): Promise<GapsResponse> {
  return apiFetch(`/api/v1/businesses/${businessId}/receptionist/gaps`);
}

/**
 * Write the answer and clear the gap, in one request.
 *
 * The two halves are not independently useful: an answer saved without
 * clearing the gap leaves the to-do list claiming work that is done, and a
 * gap cleared with no answer behind it is a lie.
 */
export async function answerGap(
  businessId: string,
  input: { question: string; answer: string; phrasings: string[] },
): Promise<{ itemId: string; resolved: number }> {
  return apiFetch(`/api/v1/businesses/${businessId}/receptionist/gaps/answer`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
