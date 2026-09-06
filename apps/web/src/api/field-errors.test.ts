import { describe, expect, it } from 'vitest';
import { copyForField, getFieldErrors, hasFieldErrors } from './field-errors';

/**
 * These guard the half of the 422 chain that lives in the browser. The API
 * sends constraint names; if this layer fails, the user is back to a form that
 * rejects them with no visible reason.
 */

describe('copyForField', () => {
  it('prefers field-specific copy over the generic constraint copy', () => {
    // The generic maxLength message cannot state the limit. This one can, and
    // stating it is the difference between "too long" and knowing what to do.
    expect(copyForField('industry', ['maxLength'])).toContain('under 100 characters');
  });

  it('falls back to constraint copy for a field with no specific entry', () => {
    expect(copyForField('somethingUnmapped', ['isNotEmpty'])).toBe('This one is required.');
  });

  it('resolves a nested path by its leaf name', () => {
    // `address.postcode` should still find `postcode`-shaped copy.
    expect(copyForField('address.email', ['isEmail'])).toContain('you@company.com');
  });

  it('mentions the most fundamental failure first, not the first one sent', () => {
    // Observed against the real API: a five-character password comes back as
    // ["matches", "minLength"] in decorator order. Taking arrival order tells
    // the user to add a symbol when the password is less than half the
    // required length, so length has to win.
    expect(copyForField('password', ['matches', 'minLength'])).toBe(
      'Use at least 12 characters.',
    );
    expect(copyForField('password', ['minLength', 'matches'])).toBe(
      'Use at least 12 characters.',
    );
  });

  it('falls through to format copy once length is satisfied', () => {
    expect(copyForField('password', ['matches'])).toContain('uppercase');
  });

  it('requiredness outranks everything', () => {
    expect(copyForField('unmappedField', ['maxLength', 'isNotEmpty'])).toBe(
      'This one is required.',
    );
  });

  it('still returns something usable for an unknown constraint', () => {
    expect(copyForField('mystery', ['someFutureConstraint'])).toBe('Please check this one.');
  });

  it('never returns backend prose', () => {
    // The whole point of sending constraint names: if a sentence somehow
    // arrives, it must not be rendered.
    const copy = copyForField('industry', ['industry must be shorter than or equal to 100']);
    expect(copy).toBe('Please check this one.');
  });
});

describe('getFieldErrors', () => {
  it('maps every failing field to reviewed copy', () => {
    const errors = getFieldErrors({
      code: 'VALIDATION_FAILED',
      fields: { industry: ['maxLength'], email: ['isEmail'] },
    });
    expect(Object.keys(errors).sort()).toEqual(['email', 'industry']);
    expect(errors.industry).toContain('under 100 characters');
  });

  it.each([
    ['null', null],
    ['a string', 'boom'],
    ['an error with no fields', { code: 'AUTH_INVALID_CREDENTIALS' }],
    ['fields of the wrong type', { fields: 'nope' }],
  ])('returns an empty map for %s', (_label, input) => {
    // Callers spread the result unconditionally, so this must never throw.
    expect(getFieldErrors(input)).toEqual({});
  });

  it('skips entries whose constraints are not an array', () => {
    expect(getFieldErrors({ fields: { a: 'maxLength', b: ['isEmail'] } })).toEqual({
      b: expect.any(String),
    });
  });
});

describe('hasFieldErrors', () => {
  it('is true only when a field-level failure is present', () => {
    expect(hasFieldErrors({ fields: { email: ['isEmail'] } })).toBe(true);
    expect(hasFieldErrors({ code: 'AUTH_INVALID_CREDENTIALS' })).toBe(false);
    expect(hasFieldErrors(new TypeError('network'))).toBe(false);
  });
});
