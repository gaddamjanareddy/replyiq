/**
 * Deciding whether what a visitor typed is a way to reach them.
 *
 * ── Why one field and not two ─────────────────────────────────────────────
 * The widget asks for "phone or email" in a single box. A form with an email
 * field, a phone field and a radio button to say which you meant is a form,
 * and a form is where somebody who was already halfway out of the door
 * leaves. One box, and the server works out which it got.
 *
 * That puts the whole burden here, and the two failure directions are not
 * equal:
 *
 *   * Rejecting a real contact detail costs the business a customer, and the
 *     visitor will not try again.
 *   * Accepting junk costs the owner ten seconds of annoyance.
 *
 * So this is deliberately permissive about FORMAT and strict only about
 * whether a human could plausibly act on it. It is not an attempt to prove the
 * address exists or the number rings — nothing short of sending to it can do
 * that, and guessing more aggressively only loses real leads.
 */

export type ContactKind = 'EMAIL' | 'PHONE';

export interface ClassifiedContact {
  kind: ContactKind;
  /** Exactly what was typed, trimmed and length-capped. */
  value: string;
}

/** Matches the column width. Anything longer is not a contact detail. */
export const MAX_CONTACT_LENGTH = 200;
export const MAX_NAME_LENGTH = 120;
export const MAX_MESSAGE_LENGTH = 1000;

/**
 * The shortest and longest number a person could be reached on.
 *
 * 15 is the E.164 maximum, so anything longer is not a telephone number
 * anywhere on earth. 7 is the shortest real subscriber number still in use
 * (some national short formats), and going lower starts accepting years,
 * prices and PIN codes typed by someone who misread the question.
 */
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

/** Characters people genuinely type in phone numbers: +91 (98) 765-43.210 */
const PHONE_PUNCTUATION = /[\s()\-.]/g;

/**
 * Which of the two it is, or null if a person could not act on it.
 *
 * An `@` anywhere commits the input to being judged as an email. Without that,
 * a typo like `name@gmail` would fall through to the phone branch, be found to
 * contain letters, and be refused with a message about phone numbers — telling
 * someone their email address is a bad phone number is how a form loses a
 * lead it had already won.
 */
export function classifyContact(raw: string): ClassifiedContact | null {
  const value = raw.trim().slice(0, MAX_CONTACT_LENGTH);
  if (value.length === 0) return null;

  if (value.includes('@')) {
    return isPlausibleEmail(value) ? { kind: 'EMAIL', value } : null;
  }

  const digits = value.replace(PHONE_PUNCTUATION, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) return null;

  return { kind: 'PHONE', value };
}

/**
 * Plausible, not valid.
 *
 * Full RFC 5322 is famously unimplementable in a regular expression and
 * pointless here: the question is not whether the string is a legal address
 * but whether a person could type it into a mail client. One `@`, something
 * either side, a dot in the domain, no whitespace.
 *
 * Addresses with no dot in the domain (`root@localhost`) are refused. They are
 * legal and no customer of an Indian dental clinic has one, whereas `foo@gmail`
 * — a real and common typo — looks identical to the check.
 */
function isPlausibleEmail(value: string): boolean {
  if (/\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!domain.includes('.')) return false;
  // A trailing or leading dot in the domain, or a doubled one, is a typo
  // rather than a domain.
  if (/^\.|\.$|\.\./.test(domain)) return false;
  // The last label has to look like a TLD.
  const tld = domain.split('.').pop() ?? '';
  return /^[a-z]{2,}$/i.test(tld);
}

/** Trim and cap a name, treating blank as absent. */
export function cleanOptionalText(raw: string | undefined, max: number): string | null {
  const value = raw?.trim().slice(0, max);
  return value && value.length > 0 ? value : null;
}
