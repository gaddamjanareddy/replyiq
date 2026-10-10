import { describe, expect, it } from 'vitest';
import { relativeTime } from './relative-time';

const now = new Date('2026-10-10T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('relativeTime', () => {
  it('calls anything within the last minute "just now"', () => {
    expect(relativeTime(ago(0), now)).toBe('just now');
    expect(relativeTime(ago(45_000), now)).toBe('just now');
  });

  /**
   * The browser clock and the database clock are not the same clock. A row
   * written a second ago can arrive stamped two seconds in the future, and
   * "in 2 seconds" on a list of things that have already happened reads as a
   * bug rather than as a clock skew.
   */
  it('calls a slightly future timestamp "just now" rather than counting forwards', () => {
    expect(relativeTime(new Date(now.getTime() + 30_000), now)).toBe('just now');
  });

  it('counts in minutes, hours, days and weeks', () => {
    expect(relativeTime(ago(5 * 60_000), now)).toMatch(/5 min/);
    expect(relativeTime(ago(3 * 3_600_000), now)).toMatch(/3 hour/);
    expect(relativeTime(ago(2 * 86_400_000), now)).toMatch(/2 day/);
    expect(relativeTime(ago(10 * 86_400_000), now)).toMatch(/week/);
  });

  it('switches to a date once the age stops being actionable', () => {
    const old = relativeTime(ago(60 * 86_400_000), now);
    expect(old).not.toMatch(/ago/);
    expect(old).toMatch(/2026/);
  });

  it('falls back to a date for anything meaningfully in the future', () => {
    const future = relativeTime(new Date('2027-01-01T00:00:00Z'), now);
    expect(future).toMatch(/2027/);
  });

  it('returns empty for an unparseable value rather than "Invalid Date"', () => {
    expect(relativeTime('not a date', now)).toBe('');
  });
});
