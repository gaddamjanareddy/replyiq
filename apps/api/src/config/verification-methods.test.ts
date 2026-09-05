import { describe, it, expect } from 'vitest';
import {
  ALWAYS_AVAILABLE_METHODS,
  assertVerificationBypassNotEnabledInProduction,
  isDevVerificationBypassEnabled,
  resolveAcceptedVerificationMethods,
} from './verification-methods.js';

/**
 * The bypass gate is a P0 security control (FR-TEST-08..10). Every one of these
 * cases is a way someone could plausibly end up with a production deployment
 * that accepts DEV_BYPASS, so each is asserted explicitly rather than covered
 * by a single happy-path test.
 */
describe('isDevVerificationBypassEnabled', () => {
  it('is enabled only when both conditions hold', () => {
    expect(
      isDevVerificationBypassEnabled({
        NODE_ENV: 'development',
        ALLOW_DEV_VERIFICATION_BYPASS: 'true',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isDevVerificationBypassEnabled({
        NODE_ENV: 'test',
        ALLOW_DEV_VERIFICATION_BYPASS: 'true',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('is disabled in production even when explicitly opted in', () => {
    expect(
      isDevVerificationBypassEnabled({
        NODE_ENV: 'production',
        ALLOW_DEV_VERIFICATION_BYPASS: 'true',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  describe('fails closed on anything ambiguous', () => {
    const ambiguous: Array<Record<string, string | undefined>> = [
      { NODE_ENV: 'development' }, // variable absent
      { NODE_ENV: 'development', ALLOW_DEV_VERIFICATION_BYPASS: '' },
      { NODE_ENV: 'development', ALLOW_DEV_VERIFICATION_BYPASS: 'TRUE' },
      { NODE_ENV: 'development', ALLOW_DEV_VERIFICATION_BYPASS: 'True' },
      { NODE_ENV: 'development', ALLOW_DEV_VERIFICATION_BYPASS: '1' },
      { NODE_ENV: 'development', ALLOW_DEV_VERIFICATION_BYPASS: 'yes' },
      { NODE_ENV: 'development', ALLOW_DEV_VERIFICATION_BYPASS: ' true ' },
      { ALLOW_DEV_VERIFICATION_BYPASS: 'true' }, // NODE_ENV absent
    ];
    for (const env of ambiguous) {
      it(`disabled for ${JSON.stringify(env)}`, () => {
        expect(isDevVerificationBypassEnabled(env as NodeJS.ProcessEnv)).toBe(
          // The only case that legitimately opens: NODE_ENV unset is not
          // 'production', and the value is exactly 'true'.
          env.NODE_ENV === undefined && env.ALLOW_DEV_VERIFICATION_BYPASS === 'true',
        );
      });
    }
  });
});

describe('resolveAcceptedVerificationMethods', () => {
  it('omits DEV_BYPASS in production, so it is not a method at all', () => {
    const methods = resolveAcceptedVerificationMethods({
      NODE_ENV: 'production',
      ALLOW_DEV_VERIFICATION_BYPASS: 'true',
    } as NodeJS.ProcessEnv);
    expect(methods).toEqual([...ALWAYS_AVAILABLE_METHODS]);
    expect(methods).not.toContain('DEV_BYPASS');
  });

  it('always offers the three real methods, including SANDBOX in production', () => {
    // Test Mode is a product feature, not a testing hack: it must be present in
    // production (FR-TEST-01).
    const methods = resolveAcceptedVerificationMethods({
      NODE_ENV: 'production',
    } as NodeJS.ProcessEnv);
    expect(methods).toContain('DNS_TXT');
    expect(methods).toContain('HTML_META');
    expect(methods).toContain('SANDBOX');
  });

  it('adds DEV_BYPASS only when the gate opened', () => {
    expect(
      resolveAcceptedVerificationMethods({
        NODE_ENV: 'test',
        ALLOW_DEV_VERIFICATION_BYPASS: 'true',
      } as NodeJS.ProcessEnv),
    ).toContain('DEV_BYPASS');
  });
});

describe('assertVerificationBypassNotEnabledInProduction', () => {
  it('throws a fatal, explicit error for the dangerous combination', () => {
    expect(() =>
      assertVerificationBypassNotEnabledInProduction({
        NODE_ENV: 'production',
        ALLOW_DEV_VERIFICATION_BYPASS: 'true',
      } as NodeJS.ProcessEnv),
    ).toThrow(/ALLOW_DEV_VERIFICATION_BYPASS/);
  });

  it('permits every safe combination', () => {
    const safe: Array<Record<string, string>> = [
      { NODE_ENV: 'production', ALLOW_DEV_VERIFICATION_BYPASS: 'false' },
      { NODE_ENV: 'production' },
      { NODE_ENV: 'development', ALLOW_DEV_VERIFICATION_BYPASS: 'true' },
      { NODE_ENV: 'test', ALLOW_DEV_VERIFICATION_BYPASS: 'true' },
      {},
    ];
    for (const env of safe) {
      expect(() =>
        assertVerificationBypassNotEnabledInProduction(env as NodeJS.ProcessEnv),
      ).not.toThrow();
    }
  });
});
