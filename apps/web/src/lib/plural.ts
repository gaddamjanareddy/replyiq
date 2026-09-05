/**
 * Count formatting.
 *
 * "1 answers" is the kind of detail that makes a product feel unfinished, and
 * it appears the moment any count can be one. Centralised so the next count
 * added does not reintroduce it.
 */

/**
 * Format a count with its noun, pluralised.
 *
 * Pass `plural` explicitly for anything that is not a simple `+s` ("category"
 * → "categories"), since guessing English plurals from spelling is wrong often
 * enough to not be worth attempting.
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}
