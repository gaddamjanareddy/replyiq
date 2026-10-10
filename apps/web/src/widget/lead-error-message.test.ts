/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { leadErrorMessage } from './index';

/**
 * The only error a visitor to a customer's website can ever see. Two rules:
 * it is reviewed copy chosen by code (never the server's prose), and it reads
 * as written for a customer rather than for an operator.
 */
describe('leadErrorMessage', () => {
  it('explains an unusable contact detail with an example', () => {
    const message = leadErrorMessage(400, 'LEAD_CONTACT_UNUSABLE');
    expect(message).toContain('phone number');
    expect(message).toContain('email');
  });

  it('says to wait when rate limited', () => {
    expect(leadErrorMessage(429, undefined)).toMatch(/try again later/i);
  });

  it('falls back to safe copy for a code it has never seen', () => {
    // A new server-side code must not produce a blank message, and must not
    // tempt anyone into rendering the server's own text instead.
    expect(leadErrorMessage(400, 'SOME_FUTURE_CODE')).toMatch(/try again/i);
    expect(leadErrorMessage(500, undefined)).toMatch(/try again/i);
  });

  it('never mentions a status code, an enum or the word error', () => {
    for (const [status, code] of [
      [400, 'LEAD_CONTACT_UNUSABLE'],
      [429, undefined],
      [500, undefined],
      [503, 'INTERNAL_ERROR'],
    ] as const) {
      const message = leadErrorMessage(status, code);
      expect(message).not.toMatch(/\d{3}/);
      expect(message).not.toMatch(/_/);
      expect(message.toLowerCase()).not.toContain('error');
    }
  });
});
