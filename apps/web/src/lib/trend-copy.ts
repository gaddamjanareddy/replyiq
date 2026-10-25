/**
 * The wording for "is this getting better?".
 *
 * The API decides *whether* a change is real — the rule is in
 * `trend.ts` on the server, where it is tested — and sends back a code. This
 * file owns the sentence, the same split the product uses for errors (see
 * `../api/error-copy.ts`). Backend prose never reaches the screen.
 *
 * Two things this copy will not do:
 *
 * - It never shows a percentage without both counts beside it. "90%" out of
 *   ten questions is a different claim from the same figure out of four
 *   hundred, and the owner cannot tell which they are reading. The tile above
 *   this line always carries "34 of 38"; this line is the comparison only.
 *
 *   That is also why the line does not repeat the noun. It sits directly
 *   under a "QUESTIONS ANSWERED" label, so "Answering 89% — up from 69% last
 *   month" says "answered" twice and, at tile width, says the second half of
 *   it off the edge of the card.
 * - It never congratulates or scolds. The receptionist answered a larger
 *   share of questions; whether that is good news depends on things we cannot
 *   see, and a dashboard that cheers is a dashboard that gets ignored.
 */

export type TrendDirection = 'BETTER' | 'WORSE' | 'STEADY' | 'NO_COMPARISON';

export interface Trend {
  direction: TrendDirection;
  rate: number | null;
  previousRate: number | null;
  current: { asked: number; answered: number; unanswered: number };
  previous: { asked: number; answered: number; unanswered: number };
  days: number;
}

/**
 * `warn` rather than `danger` for a decline, deliberately.
 *
 * A worse month is something to look at, not a failure of the software, and
 * red is reserved here for things that are broken. Tinting a normal dip in
 * traffic the same colour as a dead integration teaches the owner to ignore
 * both.
 */
export type TrendTone = 'good' | 'warn' | 'neutral';

export interface TrendCopy {
  /** The comparison, or null when there is nothing honest to compare. */
  text: string | null;
  tone: TrendTone;
}

export function describeTrend(trend: Trend): TrendCopy {
  const { direction, rate, previousRate } = trend;

  if (direction === 'NO_COMPARISON' || rate === null || previousRate === null) {
    return { text: null, tone: 'neutral' };
  }

  const before = describeWindow(trend.days);

  if (direction === 'STEADY') {
    return { text: `${rate}% — about the same as ${before}`, tone: 'neutral' };
  }

  const word = direction === 'BETTER' ? 'up' : 'down';
  return {
    text: `${rate}% — ${word} from ${previousRate}% ${before}`,
    tone: direction === 'BETTER' ? 'good' : 'warn',
  };
}

/**
 * How many people asked, versus before. Reported as counts with no verdict
 * attached: more visitors asking is weather, not performance, and colouring
 * it would be claiming we know why it moved.
 */
export function describeVolume(trend: Trend): string | null {
  if (trend.previous.asked === 0) return null;
  const { asked } = trend.current;
  const was = trend.previous.asked;
  if (asked === was) return `${asked} asked, same as ${describeWindow(trend.days)}`;
  return `${asked} asked, ${asked > was ? 'up' : 'down'} from ${was} ${describeWindow(trend.days)}`;
}

/**
 * The window is a parameter, so the copy cannot quietly go on saying "last
 * month" if the dashboard ever asks for a fortnight.
 */
function describeWindow(days: number): string {
  if (days === 30) return 'last month';
  if (days === 7) return 'last week';
  return `the ${days} days before`;
}
