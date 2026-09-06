import { UnprocessableEntityException, type ValidationError } from '@nestjs/common';

/**
 * Turn class-validator's errors into something a form can actually use.
 *
 * The default 422 body carries messages as a flat array of prose:
 *
 *   ["industry must be shorter than or equal to 100 characters"]
 *
 * The field name is in there, but only as English inside a sentence. Nothing
 * downstream can reliably attach that to an input, so the dashboard dropped it
 * entirely and a validation failure showed up only in devtools - which reads to
 * the user as a button that does nothing.
 *
 * This adds a `fields` map alongside the existing array, so the client can put
 * each failure on the field it belongs to. The array is kept because it is
 * already part of the public response shape.
 *
 * ── Why `fields` carries constraint names, not sentences ──────────────────
 * The product's copy contract is that reviewed UI copy is the only thing a
 * user ever reads; backend prose is never rendered (see
 * apps/web/src/api/error-copy.ts). Shipping class-validator's English straight
 * to the browser would break that, and it is precisely the developer-shaped
 * wording that made the original report — "industry must be shorter than or
 * equal to 100 characters" names the field in a way only a developer parses.
 *
 * So `fields` maps a field path to the CONSTRAINT NAMES it failed
 * (`maxLength`, `isEmail`), which are stable identifiers exactly like the
 * error codes elsewhere in this API. The dashboard turns them into reviewed
 * copy. The prose stays in `message` for API consumers that already read it.
 */

/** Field path → the constraint names that field failed. */
export type FieldErrors = Record<string, string[]>;

/**
 * Flatten class-validator's tree into dotted paths.
 *
 * Errors nest for nested objects and arrays (`address.postcode`, `items.0.qty`),
 * and a form needs the whole path to find its input - a bare leaf name would
 * collide the moment two nested objects share a field name.
 */
export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): FieldErrors {
  const fields: FieldErrors = {};

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      // The keys, not the values: `maxLength` rather than the sentence. A
      // field can fail several constraints at once and the user should see
      // every reason in one pass, so all of them are kept.
      const constraintNames = Object.keys(error.constraints);
      fields[path] = [...(fields[path] ?? []), ...constraintNames];
    }

    if (error.children && error.children.length > 0) {
      for (const [childPath, childMessages] of Object.entries(
        flattenValidationErrors(error.children, path),
      )) {
        fields[childPath] = [...(fields[childPath] ?? []), ...childMessages];
      }
    }
  }

  return fields;
}

/**
 * The human-readable messages, flattened in the order the errors arrived.
 *
 * Separate from `fields` because the two now carry different things: this is
 * class-validator's prose, kept for API consumers already reading `message`.
 */
export function collectMessages(errors: readonly ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) messages.push(...Object.values(error.constraints));
    if (error.children?.length) messages.push(...collectMessages(error.children));
  }
  return messages;
}

/**
 * The exception the ValidationPipe throws.
 *
 * 422 rather than 400 so field-level validation is distinguishable from a
 * business-rule refusal ("complete the profile step first"), which stays 400.
 */
export function buildValidationException(
  errors: readonly ValidationError[],
): UnprocessableEntityException {
  const fields = flattenValidationErrors(errors);
  const message = collectMessages(errors);

  return new UnprocessableEntityException({
    code: 'VALIDATION_FAILED',
    // Retained because it is already part of the published response shape;
    // removing it would break any client reading `message`.
    message,
    fields,
  });
}
