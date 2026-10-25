import { describe, expect, it } from 'vitest';
import { computeTrend, type TrendWindow } from './trend.js';

/** asked, answered — unanswered is whatever is left. */
const w = (asked: number, answered: number): TrendWindow => ({
  asked,
  answered,
  unanswered: asked - answered,
});

const trend = (current: TrendWindow, previous: TrendWindow) => computeTrend(current, previous, 30);

describe('computeTrend', () => {
  it('reports the answered rate for both windows', () => {
    const t = trend(w(40, 36), w(40, 30));
    expect(t.rate).toBe(90);
    expect(t.previousRate).toBe(75);
    expect(t.direction).toBe('BETTER');
  });

  it('keeps the counts alongside the rates', () => {
    // A rate without its denominator is a claim the owner cannot check.
    const t = trend(w(40, 36), w(20, 15));
    expect(t.current).toEqual({ asked: 40, answered: 36, unanswered: 4 });
    expect(t.previous).toEqual({ asked: 20, answered: 15, unanswered: 5 });
    expect(t.days).toBe(30);
  });

  it('calls a real drop in the answered share WORSE', () => {
    expect(trend(w(40, 20), w(40, 36)).direction).toBe('WORSE');
  });

  it('refuses to compare against an empty previous window', () => {
    // A brand-new business. Going from nothing to something is a launch, not
    // an improvement, and +100% would be the first number we ever showed them.
    const t = trend(w(12, 10), w(0, 0));
    expect(t.direction).toBe('NO_COMPARISON');
    expect(t.previousRate).toBeNull();
    expect(t.rate).toBe(83);
  });

  it('refuses to compare when nothing was asked this window either', () => {
    const t = trend(w(0, 0), w(0, 0));
    expect(t.direction).toBe('NO_COMPARISON');
    expect(t.rate).toBeNull();
  });

  it('does not call a trend that one flipped question could explain', () => {
    // Ten questions resolve to ten percentage points, so a ten-point move is
    // exactly one visitor's worth and we say nothing. 8/10 → 18/20.
    expect(trend(w(20, 18), w(10, 8)).direction).toBe('STEADY');
  });

  it('calls the same move once there is enough traffic to see it', () => {
    // 80 → 90 again, but now the smaller window holds fifty questions, where
    // one is worth two points. The difference is the sample, not the numbers.
    expect(trend(w(100, 90), w(50, 40)).direction).toBe('BETTER');
  });

  it('still calls a collapse on tiny numbers', () => {
    // Four questions need a 25-point swing. 100% → 50% is twice that: the
    // noise floor scales, it does not silence everything small.
    expect(trend(w(4, 2), w(4, 4)).direction).toBe('WORSE');
  });

  it('is STEADY when nothing moved at all', () => {
    expect(trend(w(30, 24), w(30, 24)).direction).toBe('STEADY');
  });

  it('counts hedged answers as answered, matching the dashboard', () => {
    // `answered` is passed in already including `unsure`; the only failure is
    // `unknown`. This guards the meaning, not the arithmetic.
    const t = trend(w(10, 10), w(10, 10));
    expect(t.rate).toBe(100);
    expect(t.current.unanswered).toBe(0);
  });

  it('rounds the rate to whole percent', () => {
    // 2/3 is not 66.666% of anything we measured.
    expect(trend(w(3, 2), w(3, 2)).rate).toBe(67);
  });
});
