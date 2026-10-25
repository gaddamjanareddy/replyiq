/**
 * Is the receptionist getting better, or does it only look that way?
 *
 * ── Why a trend at all ────────────────────────────────────────────────────
 * The dashboard reported 30-day totals with nothing to compare them against,
 * so the one question an owner actually has — "is this working better than it
 * was?" — was unanswerable. Totals also quietly reward doing nothing: they
 * keep going up whether or not the owner ever fixed a gap.
 *
 * ── Why the rate, and not the counts ──────────────────────────────────────
 * "Could not answer: 4, down from 9" sounds like progress and frequently
 * isn't — if traffic halved, the receptionist failed just as often per
 * visitor. The only figure that survives a change in traffic is the share of
 * questions it answered, so that is what carries the verdict. The counts are
 * still reported, never replaced by a percentage, because a rate without its
 * denominator is a claim the owner cannot check.
 *
 * Volume gets no verdict at all. More visitors asking is not better or worse
 * receptionist behaviour, it is a different amount of weather, and colouring
 * it green would be telling the owner something we do not know.
 */

/** One window's worth of counts. */
export interface TrendWindow {
  asked: number;
  /** Includes hedged answers: the visitor still got the owner's own words. */
  answered: number;
  unanswered: number;
}

/**
 * A code, not a sentence. The web layer owns the wording — see
 * `apps/web/src/api/error-copy.ts` for the same contract on errors.
 */
export type TrendDirection =
  /** Answered a meaningfully larger share of questions than last time. */
  | 'BETTER'
  /** Answered a meaningfully smaller share. */
  | 'WORSE'
  /** Both windows have traffic, and the difference is inside the noise. */
  | 'STEADY'
  /** One of the windows is empty, so there is nothing to compare. */
  | 'NO_COMPARISON';

export interface Trend {
  direction: TrendDirection;
  /** Whole percent of questions answered, or null when nothing was asked. */
  rate: number | null;
  previousRate: number | null;
  current: TrendWindow;
  previous: TrendWindow;
  /** How many days each window covers, so the UI need not guess the wording. */
  days: number;
}

/**
 * Decide whether the change is real.
 *
 * ── The noise floor, and why it is not a fixed sample size ────────────────
 * The tempting rule is "hide the trend under N questions". Any N is wrong:
 * set it high and almost no small business ever sees a trend, set it low and
 * a single flipped question reads as a movement.
 *
 * So the floor is derived from the data instead. In a window of `n`
 * questions, one question is worth `100 / n` percentage points — that is the
 * finest distinction the window can make. A change smaller than that could
 * have been produced by one visitor phrasing something differently, so we
 * refuse to call it. The threshold therefore comes from the SMALLER of the
 * two windows, which is the one that limits what we can know.
 *
 * Consequences, all intended: four questions need a 25-point swing before we
 * say anything; fifty need two. A busy month earns a sensitive measurement
 * and a quiet one does not.
 */
export function computeTrend(current: TrendWindow, previous: TrendWindow, days: number): Trend {
  const rate = answeredRate(current);
  const previousRate = answeredRate(previous);

  return {
    direction: direction(current, previous, rate, previousRate),
    rate,
    previousRate,
    current,
    previous,
    days,
  };
}

function direction(
  current: TrendWindow,
  previous: TrendWindow,
  rate: number | null,
  previousRate: number | null,
): TrendDirection {
  // A brand-new business has an empty previous window. "Up from nothing" is
  // not an improvement, it is a launch, and rendering it as +100% would be
  // the first number the product ever showed them and a lie.
  if (rate === null || previousRate === null) return 'NO_COMPARISON';

  const resolution = 100 / Math.min(current.asked, previous.asked);
  const change = rate - previousRate;

  if (Math.abs(change) <= resolution) return 'STEADY';
  return change > 0 ? 'BETTER' : 'WORSE';
}

/**
 * Rounded to whole percent on purpose. "87.4%" implies we measured something
 * to a tenth of a percent out of thirty questions.
 */
function answeredRate(window: TrendWindow): number | null {
  if (window.asked === 0) return null;
  return Math.round((window.answered / window.asked) * 100);
}
