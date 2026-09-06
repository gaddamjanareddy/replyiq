import { describe, expect, it } from 'vitest';
import type { ValidationError } from '@nestjs/common';
import {
  buildValidationException,
  collectMessages,
  flattenValidationErrors,
} from './validation-exception.js';

/**
 * The chain these guard: a 422 must arrive at the browser carrying which field
 * failed, not just prose. Before this existed the field name was only readable
 * as English inside a sentence, so the dashboard could not attach it to an
 * input and dropped it — a rejected form looked like a dead button.
 */

const error = (
  property: string,
  constraints?: Record<string, string>,
  children?: ValidationError[],
): ValidationError => ({ property, constraints, children }) as ValidationError;

describe('flattenValidationErrors', () => {
  it('maps a field to the constraint names it failed, not to prose', () => {
    // Constraint names are stable identifiers the dashboard turns into
    // reviewed copy. Shipping the sentence would put backend prose on screen,
    // which the copy contract forbids.
    const fields = flattenValidationErrors([
      error('industry', { maxLength: 'industry must be shorter than or equal to 100 characters' }),
    ]);
    expect(fields).toEqual({ industry: ['maxLength'] });
  });

  it('keeps every constraint a field failed', () => {
    // A password can be too short AND missing a symbol. Showing one and hiding
    // the other sends the user round the loop twice.
    const fields = flattenValidationErrors([
      error('password', { minLength: 'too short', matches: 'needs a symbol' }),
    ]);
    expect(fields.password).toEqual(['minLength', 'matches']);
  });

  it('reports nested fields by their full path', () => {
    // A bare leaf name would collide the moment two nested objects share one.
    const fields = flattenValidationErrors([
      error('address', undefined, [error('postcode', { isNotEmpty: 'postcode is required' })]),
    ]);
    expect(fields).toEqual({ 'address.postcode': ['isNotEmpty'] });
  });

  it('handles array items', () => {
    const fields = flattenValidationErrors([
      error('items', undefined, [error('0', undefined, [error('qty', { min: 'qty must be ≥ 1' })])]),
    ]);
    expect(fields).toEqual({ 'items.0.qty': ['min'] });
  });

  it('reports several failing fields at once', () => {
    // The user should see everything wrong in one pass, not one per submit.
    const fields = flattenValidationErrors([
      error('email', { isEmail: 'not an email' }),
      error('name', { isNotEmpty: 'name is required' }),
    ]);
    expect(Object.keys(fields).sort()).toEqual(['email', 'name']);
  });

  it('ignores a branch that carries no constraints of its own', () => {
    expect(flattenValidationErrors([error('address', undefined, [])])).toEqual({});
  });
});

describe('buildValidationException', () => {
  it('carries the field map, the flat messages, and a stable code', () => {
    const body = buildValidationException([
      error('industry', { maxLength: 'industry is too long' }),
      error('email', { isEmail: 'not an email' }),
    ]).getResponse() as { code: string; message: string[]; fields: Record<string, string[]> };

    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields).toEqual({
      industry: ['maxLength'],
      email: ['isEmail'],
    });
    // Kept deliberately: `message` is already part of the published response
    // shape, so removing it would break any client reading it.
    expect(body.message).toEqual(['industry is too long', 'not an email']);
  });

  it('is a 422', () => {
    // 422 distinguishes field validation from a business-rule refusal, which
    // stays 400 so the two can be told apart.
    expect(buildValidationException([error('a', { x: 'y' })]).getStatus()).toBe(422);
  });
});

describe('collectMessages', () => {
  it('gathers prose from nested errors in order', () => {
    // `message` keeps class-validator's sentences for API consumers already
    // reading it; only `fields` switched to constraint names.
    expect(
      collectMessages([
        error('email', { isEmail: 'not an email' }),
        error('address', undefined, [error('postcode', { isNotEmpty: 'postcode is required' })]),
      ]),
    ).toEqual(['not an email', 'postcode is required']);
  });
});
