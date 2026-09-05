import { describe, expect, it } from 'vitest';
import { hashToken } from './password-reset.service.js';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from './dto/password-policy.js';

describe('hashToken', () => {
  it('produces a 64-character hex digest', () => {
    // The column is VARCHAR(64); a longer digest would be silently truncated
    // by some drivers and turn every lookup into a miss.
    const hash = hashToken('some-token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic, so a link can be looked up by its hash', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('separates tokens that differ by one character', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });

  it('never returns the raw token', () => {
    // The whole point: a database leak must not yield usable links.
    const raw = 'a-very-secret-reset-token';
    expect(hashToken(raw)).not.toContain(raw);
  });
});

describe('password policy', () => {
  // Registration and reset share these. If they drift, a user can set a
  // password at reset that signup would have refused.
  const valid = 'Str0ng!Passphrase';

  it('accepts a password meeting every requirement', () => {
    expect(PASSWORD_PATTERN.test(valid)).toBe(true);
    expect(valid.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
  });

  it.each([
    ['no uppercase', 'str0ng!passphrase'],
    ['no lowercase', 'STR0NG!PASSPHRASE'],
    ['no digit', 'Strong!Passphrase'],
    ['no symbol', 'Str0ngPassphrase1'],
    ['too short', 'Sh0rt!1'],
  ])('rejects a password with %s', (_label, candidate) => {
    expect(PASSWORD_PATTERN.test(candidate)).toBe(false);
  });

  it('has a maximum, so a huge input cannot be used to burn CPU in the hasher', () => {
    expect(PASSWORD_MAX_LENGTH).toBeLessThanOrEqual(128);
  });
});
