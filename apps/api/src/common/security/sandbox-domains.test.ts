import { describe, it, expect } from 'vitest';
import {
  describeSandboxEligibility,
  getConfiguredSandboxSuffix,
  isSandboxDomain,
  normalizeHostname,
  suggestSandboxDomain,
} from './sandbox-domains.js';

/**
 * These tests guard the entire Test Mode security boundary. `SANDBOX`
 * verification proves nothing, and is safe only because this function returns
 * true exclusively for names nobody can register. A false positive here is a
 * way to claim a real domain without owning it, so the "must reject" cases
 * matter more than the "must accept" ones.
 */
describe('isSandboxDomain', () => {
  describe('accepts reserved namespaces', () => {
    const accepted = [
      // RFC 2606 / RFC 6761 reserved TLDs
      'anything.test',
      'deep.nested.sub.test',
      'foo.example',
      'foo.invalid',
      'app.localhost',
      // RFC 6762 / ICANN private-use
      'printer.local',
      'db.internal',
      // RFC 2606 §3 reserved second-level names
      'example.com',
      'example.net',
      'example.org',
      'example.edu',
      'shop.example.com',
      'a.b.c.example.org',
    ];
    for (const hostname of accepted) {
      it(`accepts ${hostname}`, () => {
        expect(isSandboxDomain(hostname, {})).toBe(true);
      });
    }
  });

  describe('rejects everything registrable', () => {
    const rejected = [
      'google.com',
      'replyiq.com',
      'acme.co.uk',
      // Suffix-confusion attacks: each contains a reserved string but is an
      // ordinary domain an attacker can buy.
      'example.com.evil.com',
      'example.org.attacker.net',
      'notexample.com',
      'myexample.com',
      'example.company',
      'test.com',
      'localhost.com',
      'internal.com',
      'local.com',
      'testing.io',
      // Reserved words in the wrong position.
      'test.example-site.com',
      'invalid.co',
      '',
      '   ',
    ];
    for (const hostname of rejected) {
      it(`rejects ${JSON.stringify(hostname)}`, () => {
        expect(isSandboxDomain(hostname, {})).toBe(false);
      });
    }
  });

  it('normalises case and a trailing root dot before deciding', () => {
    expect(isSandboxDomain('EXAMPLE.COM', {})).toBe(true);
    expect(isSandboxDomain('Shop.Example.Com.', {})).toBe(true);
    expect(isSandboxDomain('  app.TEST  ', {})).toBe(true);
    expect(isSandboxDomain('GOOGLE.COM.', {})).toBe(false);
  });
});

describe('operator-configured sandbox suffix', () => {
  it('accepts names at or under the configured suffix', () => {
    const env = { SANDBOX_DOMAIN_SUFFIX: 'sandbox.replyiq.app' } as NodeJS.ProcessEnv;
    expect(isSandboxDomain('sandbox.replyiq.app', env)).toBe(true);
    expect(isSandboxDomain('acme.sandbox.replyiq.app', env)).toBe(true);
  });

  it('does not match a sibling that merely shares the string', () => {
    const env = { SANDBOX_DOMAIN_SUFFIX: 'sandbox.replyiq.app' } as NodeJS.ProcessEnv;
    expect(isSandboxDomain('sandbox.replyiq.app.evil.com', env)).toBe(false);
    expect(isSandboxDomain('notsandbox.replyiq.app', env)).toBe(false);
    expect(isSandboxDomain('replyiq.app', env)).toBe(false);
  });

  it('tolerates a leading dot and stray case in the configuration', () => {
    const env = { SANDBOX_DOMAIN_SUFFIX: '.Sandbox.ReplyIQ.App.' } as NodeJS.ProcessEnv;
    expect(getConfiguredSandboxSuffix(env)).toBe('sandbox.replyiq.app');
    expect(isSandboxDomain('acme.sandbox.replyiq.app', env)).toBe(true);
  });

  describe('refuses configurations that would widen the boundary', () => {
    // An empty suffix passed to a naive endsWith('.' + suffix) check makes '.'
    // a universal match, which would make every hostname sandbox-eligible.
    // A bare TLD would make every .com address eligible.
    const dangerous = ['', '   ', '.', 'com', 'app', '..', '-bad-.com', 'has space.com'];
    for (const value of dangerous) {
      it(`ignores SANDBOX_DOMAIN_SUFFIX=${JSON.stringify(value)}`, () => {
        const env = { SANDBOX_DOMAIN_SUFFIX: value } as NodeJS.ProcessEnv;
        expect(getConfiguredSandboxSuffix(env)).toBeNull();
        expect(isSandboxDomain('google.com', env)).toBe(false);
        expect(isSandboxDomain('anything.app', env)).toBe(false);
      });
    }
  });

  it('is absent when the variable is unset', () => {
    expect(getConfiguredSandboxSuffix({})).toBeNull();
  });
});

describe('describeSandboxEligibility', () => {
  it('explains why a reserved name qualifies', () => {
    expect(describeSandboxEligibility('acme.test', {})).toContain('.test');
    expect(describeSandboxEligibility('shop.example.com', {})).toContain('example.com');
    expect(
      describeSandboxEligibility('a.sandbox.replyiq.app', {
        SANDBOX_DOMAIN_SUFFIX: 'sandbox.replyiq.app',
      } as NodeJS.ProcessEnv),
    ).toContain('sandbox');
  });

  it('returns null for a real domain', () => {
    expect(describeSandboxEligibility('google.com', {})).toBeNull();
  });
});

describe('suggestSandboxDomain', () => {
  it('suggests a name that actually passes the classifier', () => {
    const plain = suggestSandboxDomain({});
    expect(isSandboxDomain(plain, {})).toBe(true);

    const env = { SANDBOX_DOMAIN_SUFFIX: 'sandbox.replyiq.app' } as NodeJS.ProcessEnv;
    const configured = suggestSandboxDomain(env);
    expect(isSandboxDomain(configured, env)).toBe(true);
  });
});

describe('normalizeHostname', () => {
  it('lowercases, trims and strips trailing root dots', () => {
    expect(normalizeHostname('  Example.COM..  ')).toBe('example.com');
  });
});
