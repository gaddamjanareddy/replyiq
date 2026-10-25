import { describe, expect, it } from 'vitest';
import { describeTrend, describeVolume, type Trend, type TrendDirection } from './trend-copy';

const trend = (
  direction: TrendDirection,
  rate: number | null,
  previousRate: number | null,
  asked = 40,
  previousAsked = 40,
  days = 30,
): Trend => ({
  direction,
  rate,
  previousRate,
  current: { asked, answered: 0, unanswered: 0 },
  previous: { asked: previousAsked, answered: 0, unanswered: 0 },
  days,
});

describe('describeTrend', () => {
  it('says what improved and what it was before', () => {
    expect(describeTrend(trend('BETTER', 90, 75))).toEqual({
      text: '90% — up from 75% last month',
      tone: 'good',
    });
  });

  it('reports a decline without treating it as a fault', () => {
    // `warn`, not `danger`. Red here is reserved for things that are broken.
    expect(describeTrend(trend('WORSE', 50, 90))).toEqual({
      text: '50% — down from 90% last month',
      tone: 'warn',
    });
  });

  it('says so plainly when nothing moved', () => {
    expect(describeTrend(trend('STEADY', 88, 86))).toEqual({
      text: '88% — about the same as last month',
      tone: 'neutral',
    });
  });

  it('renders nothing at all when there is nothing to compare', () => {
    // A brand-new business. Silence is the honest output; the tile falls back
    // to its plain caption.
    expect(describeTrend(trend('NO_COMPARISON', 83, null))).toEqual({
      text: null,
      tone: 'neutral',
    });
  });

  it('stays silent if a rate is missing even when the direction is not', () => {
    // Belt and braces: the copy must never interpolate "null%" if the server
    // and this file ever disagree about what an empty window looks like.
    expect(describeTrend(trend('BETTER', null, 75)).text).toBeNull();
  });

  it('adapts the wording to the window it was given', () => {
    expect(describeTrend(trend('BETTER', 90, 75, 40, 40, 7)).text).toContain('last week');
    expect(describeTrend(trend('BETTER', 90, 75, 40, 40, 14)).text).toContain(
      'the 14 days before',
    );
  });
});

describe('describeVolume', () => {
  it('reports both counts, with no verdict attached', () => {
    expect(describeVolume(trend('BETTER', 90, 75, 40, 25))).toBe(
      '40 asked, up from 25 last month',
    );
  });

  it('handles a quieter month the same way', () => {
    expect(describeVolume(trend('WORSE', 50, 90, 12, 25))).toBe(
      '12 asked, down from 25 last month',
    );
  });

  it('does not invent a comparison for a first month', () => {
    expect(describeVolume(trend('NO_COMPARISON', 83, null, 12, 0))).toBeNull();
  });

  it('says so when the number is identical', () => {
    expect(describeVolume(trend('STEADY', 90, 90, 25, 25))).toBe('25 asked, same as last month');
  });
});
