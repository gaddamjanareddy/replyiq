/**
 * Turning a list of unanswered questions into a list of things to write.
 *
 * ── The problem with the raw list ─────────────────────────────────────────
 * Gaps were grouped by exact string, so "do you take cards" and "do you take
 * card" were two separate jobs. Twenty-seven rows that are really six things
 * is not a to-do list, it is a wall — and the owner answers the same question
 * twice before giving up on it.
 *
 * ── Why the threshold is high, and deliberately misses some ───────────────
 * The two failures are not equal and must not be traded off as if they were.
 *
 * A MISSED cluster costs the owner one extra row. They write the answer
 * twice, which is mildly annoying and entirely visible.
 *
 * A WRONG merge costs a customer. "How much is a filling" and "how much is a
 * crown" collapsed into one row means one answer gets written for both, and
 * from then on the receptionist confidently returns the owner's own words to
 * a question they do not answer. That is the exact failure this whole product
 * exists to prevent, arriving through the back door.
 *
 * So the threshold sits high enough that near-misses stay apart, and every
 * original phrasing is shown inside the cluster rather than summarised away.
 * The headline is always the one the most people actually typed — never a
 * generated "canonical" question, because a question nobody asked is an
 * invention even when it reads better than the ones they did.
 */

/** One exact-string gap, as the database groups them. */
export interface GapRow {
  question: string;
  timesAsked: number;
  askedAt: Date;
}

export interface GapCluster {
  /** The most-asked phrasing. Always something a real visitor typed. */
  question: string;
  /** Every phrasing in this cluster, most-asked first, including the above. */
  phrasings: Array<{ question: string; timesAsked: number }>;
  /** Everyone who asked any of them. */
  timesAsked: number;
  /** The most recent time any phrasing was asked. */
  askedAt: Date;
}

/**
 * Two questions join if this much of their combined vocabulary is shared.
 *
 * Jaccard, not an overlap coefficient. Overlap would score "how much is a
 * filling" against "how much is a filling for a child" as a perfect 1.0,
 * because one is a subset of the other — and those two can easily have
 * different answers. Jaccard charges for the extra word, which is the whole
 * point: the extra word is usually what makes it a different question.
 *
 * 0.6 was chosen against real phrasings. It merges "do you take card(s)" and
 * "what time do you open" with "what time do you open on saturday"; it
 * refuses "how much is a filling" against "how much is a crown" (0.33). It
 * also refuses "do you do emergencies" against "do you do emergency
 * appointments" (0.5) — a miss, accepted knowingly, because the alternative
 * is a threshold loose enough to merge the crown and the filling.
 */
export const SIMILARITY_THRESHOLD = 0.6;

/**
 * Words that carry no subject matter.
 *
 * Kept short on purpose. Every word removed here is a word that can no longer
 * tell two questions apart, so the list holds only words that are almost
 * never the thing being asked about. "Open", "cost" and "price" are not on
 * it and never should be.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'do', 'does',
  'did', 'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might',
  'have', 'has', 'had', 'i', 'you', 'your', 'yours', 'we', 'our', 'us', 'they',
  'them', 'it', 'its', 'me', 'my', 'to', 'of', 'in', 'on', 'at', 'for', 'with',
  'and', 'or', 'but', 'if', 'then', 'there', 'here', 'that', 'this', 'these',
  'those', 'so', 'as', 'by', 'from', 'about', 'any', 'some', 'please', 'hi',
  'hello', 'thanks', 'thank',
]);

/**
 * Group gaps that are the same question asked differently.
 *
 * Greedy rather than a proper clustering algorithm, and that is the right
 * trade: it is deterministic, it runs over at most a few dozen rows, and
 * every decision it makes can be explained to an owner looking at the result.
 * A k-means over embeddings would cluster better and nobody could say why two
 * questions ended up together.
 */
export function clusterGaps(rows: GapRow[]): GapCluster[] {
  // Most-asked first, so the headline of each cluster is the phrasing the
  // most people used. Ties fall back to the question text, so the output does
  // not depend on the order the database happened to return.
  const ordered = [...rows].sort(
    (a, b) => b.timesAsked - a.timesAsked || a.question.localeCompare(b.question),
  );

  const clusters: Array<{ tokens: Set<string>; cluster: GapCluster }> = [];

  for (const row of ordered) {
    const tokens = tokenize(row.question);
    const home = clusters.find((c) => similarity(c.tokens, tokens) >= SIMILARITY_THRESHOLD);

    if (home) {
      home.cluster.phrasings.push({ question: row.question, timesAsked: row.timesAsked });
      home.cluster.timesAsked += row.timesAsked;
      if (row.askedAt > home.cluster.askedAt) home.cluster.askedAt = row.askedAt;
      // The representative's tokens are NOT widened to include the new ones.
      // Growing the set as members join lets a cluster drift: A matches B,
      // B's words pull in C, and C has nothing to do with A.
      continue;
    }

    clusters.push({
      tokens,
      cluster: {
        question: row.question,
        phrasings: [{ question: row.question, timesAsked: row.timesAsked }],
        timesAsked: row.timesAsked,
        askedAt: row.askedAt,
      },
    });
  }

  // Busiest first: the thing the most people could not get an answer to is
  // the thing worth writing first.
  return clusters
    .map((c) => c.cluster)
    .sort((a, b) => b.timesAsked - a.timesAsked || b.askedAt.getTime() - a.askedAt.getTime());
}

/**
 * Jaccard: shared words over total distinct words.
 *
 * Two questions with no subject matter left after stopwords (someone typed
 * "do you?") score 0 against everything including each other. They are
 * already grouped by exact string upstream, and letting empty sets match
 * would put every such question in one meaningless pile.
 */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function tokenize(question: string): Set<string> {
  const words = question
    .toLowerCase()
    // Apostrophes vanish rather than splitting, so "don't" does not become
    // the two tokens "don" and "t".
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  return new Set(words.map(stem));
}

/**
 * Just enough stemming to survive English plurals.
 *
 * Without it "do you take card" and "do you take cards" share nothing, and
 * the clustering is useless on the single most common way the same question
 * gets typed twice. A real stemmer (Porter) would also fold "opening" into
 * "open", and would fold things that should not be folded — it is a larger
 * dependency making larger claims, and over-folding is the expensive
 * direction here.
 */
function stem(word: string): string {
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('ches'))) {
    return word.slice(0, -2);
  }
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}
