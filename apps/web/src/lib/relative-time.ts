/**
 * How long ago something happened, in words.
 *
 * Used for enquiries, where the age is the most important fact on the row. A
 * person who asked a question four minutes ago is still at their desk; the
 * same person two weeks later is gone. A date ("10 Oct 2026") makes the owner
 * do that arithmetic themselves, and at the top of a list sorted by time it is
 * the one thing they are actually reading.
 *
 * `Intl.RelativeTimeFormat` does the wording, so this is not a pile of English
 * plural rules — and the owner's own locale is honoured for free.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Switch to an absolute date past this point.
 *
 * "3 weeks ago" is less useful than the date once something stops being
 * actionable, and "11 months ago" is actively worse than "12 Nov 2025".
 */
const RELATIVE_LIMIT = 4 * WEEK;

export function relativeTime(value: string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const elapsed = now.getTime() - date.getTime();

  // A clock skew between the browser and the server can make a row that was
  // just written look like it is from the future. "in 2 seconds" on a list of
  // things that have already happened reads as a bug, so anything within a
  // minute either way is simply "just now".
  if (elapsed < MINUTE && elapsed > -MINUTE) return 'just now';

  if (elapsed >= RELATIVE_LIMIT || elapsed < 0) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  }

  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (elapsed < HOUR) return format.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return format.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < WEEK) return format.format(-Math.floor(elapsed / DAY), 'day');
  return format.format(-Math.floor(elapsed / WEEK), 'week');
}
