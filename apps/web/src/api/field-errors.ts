/**
 * Turn a 422's `fields` map into reviewed copy the user can act on.
 *
 * The API sends constraint NAMES per field (`maxLength`, `isEmail`) rather
 * than sentences, for the same reason every other error carries a code: the
 * copy contract is that reviewed UI text is the only thing a user reads, and
 * backend prose never reaches the screen.
 *
 * That also fixes the complaint that produced this work. The raw message —
 * "industry must be shorter than or equal to 100 characters" — names the field
 * in a way only a developer parses, repeats the field name the label already
 * shows, and states a limit the user could not see before hitting it.
 */

export type FieldErrorMap = Record<string, string>;

/** Raw shape of the `fields` member on a 422 body. */
type RawFields = Record<string, string[]>;

/**
 * Copy for a constraint, used when a field has nothing more specific.
 *
 * Written to say what to DO. "must be shorter than or equal to 100
 * characters" describes the rule; "This is too long" describes the problem;
 * only "Shorten this" tells the user their next move.
 */
const CONSTRAINT_COPY: Record<string, string> = {
  isNotEmpty: 'This one is required.',
  isDefined: 'This one is required.',
  isString: 'Enter this as text.',
  isEmail: "That doesn't look like an email address.",
  isUrl: "That doesn't look like a web address.",
  minLength: 'This is a little too short.',
  maxLength: 'This is a little too long — try shortening it.',
  matches: "This isn't in the format we expect.",
  min: 'That number is too small.',
  max: 'That number is too large.',
  isEnum: 'Choose one of the options offered.',
  isUUID: "That doesn't look like a valid ID.",
  whitelistValidation: "We weren't expecting this field.",
};

/**
 * Copy for a specific field-and-constraint pair, where the generic version
 * would be unhelpful.
 *
 * Keyed `field.constraint`. Kept small on purpose: an entry earns its place by
 * telling the user something the generic copy cannot, usually the actual limit.
 */
const FIELD_COPY: Record<string, string> = {
  'industry.maxLength': 'Keep this under 100 characters — a short label like "Dental practice".',
  'description.maxLength': 'Keep this under 2000 characters.',
  'name.maxLength': 'Keep this under 200 characters.',
  'password.minLength': 'Use at least 12 characters.',
  'password.matches':
    'Add an uppercase letter, a lowercase letter, a number and a symbol.',
  'email.isEmail': 'Check for typos — it should look like you@company.com.',
  'domain.matches': 'Enter just the address, like example.com — no https:// and no path.',
};

const FALLBACK = 'Please check this one.';

/**
 * Which failure to mention first when a field breaks several rules.
 *
 * class-validator returns constraints in decorator order, which is not the
 * order a user should fix them in. A five-character password fails both
 * `matches` and `minLength`, and arrival order puts `matches` first — so the
 * user is told to add a symbol when the real problem is that the password is
 * less than half the required length.
 *
 * Presence first, then size, then format: each step only makes sense once the
 * previous one is satisfied.
 */
const CONSTRAINT_PRIORITY = [
  'isNotEmpty',
  'isDefined',
  'isString',
  'minLength',
  'min',
  'maxLength',
  'max',
  'isEmail',
  'isUrl',
  'isUUID',
  'isEnum',
  'matches',
];

function byPriority(constraints: readonly string[]): string[] {
  return [...constraints].sort((a, b) => {
    // Anything unranked sorts last but keeps its relative order.
    const rank = (c: string) => {
      const i = CONSTRAINT_PRIORITY.indexOf(c);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return rank(a) - rank(b);
  });
}

/**
 * The reviewed message for one field's failures.
 *
 * A field can fail several constraints at once; the first is used, because a
 * stack of messages under one input reads as shouting and the user can only
 * fix one thing at a time anyway.
 */
export function copyForField(field: string, constraints: readonly string[]): string {
  // The leaf name, so `address.postcode` still finds `postcode` copy.
  const leaf = field.split('.').pop() ?? field;
  const ordered = byPriority(constraints);

  for (const constraint of ordered) {
    const specific = FIELD_COPY[`${leaf}.${constraint}`];
    if (specific) return specific;
  }
  for (const constraint of ordered) {
    const generic = CONSTRAINT_COPY[constraint];
    if (generic) return generic;
  }
  return FALLBACK;
}

/**
 * Extract per-field copy from a thrown API error.
 *
 * Returns an empty object for anything that is not a field-validation failure,
 * so a caller can always spread the result without checking first.
 */
export function getFieldErrors(error: unknown): FieldErrorMap {
  if (typeof error !== 'object' || error === null || !('fields' in error)) return {};

  const raw = (error as { fields?: unknown }).fields;
  if (typeof raw !== 'object' || raw === null) return {};

  const out: FieldErrorMap = {};
  for (const [field, constraints] of Object.entries(raw as RawFields)) {
    if (!Array.isArray(constraints)) continue;
    out[field] = copyForField(
      field,
      constraints.filter((c): c is string => typeof c === 'string'),
    );
  }
  return out;
}

/** True when the error carries at least one field-level failure. */
export function hasFieldErrors(error: unknown): boolean {
  return Object.keys(getFieldErrors(error)).length > 0;
}
