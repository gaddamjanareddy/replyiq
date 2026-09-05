import { describe, it, expect } from 'vitest';
import {
  describeDomainProblem,
  hostnameFromWebsiteUrl,
  isSandboxDomain,
  isValidDomain,
  normalizeDomain,
} from './domain';

describe('normalizeDomain', () => {
  it.each([
    // What people actually paste, and what they meant.
    ['https://acme.com', 'acme.com'],
    ['http://acme.com', 'acme.com'],
    ['https://www.acme.com', 'acme.com'],
    ['WWW.ACME.COM', 'acme.com'],
    ['https://acme.com/pricing', 'acme.com'],
    ['https://acme.com/pricing?utm=x#top', 'acme.com'],
    ['acme.com:8443', 'acme.com'],
    ['https://user:pass@acme.com', 'acme.com'],
    ['  acme.com.  ', 'acme.com'],
    ['shop.acme.co.uk', 'shop.acme.co.uk'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it('leaves an already-clean hostname untouched', () => {
    expect(normalizeDomain('acme.com')).toBe('acme.com');
  });

  it('does not strip a www that is part of a longer label', () => {
    expect(normalizeDomain('wwwacme.com')).toBe('wwwacme.com');
  });
});

describe('isValidDomain', () => {
  it.each(['acme.com', 'shop.acme.co.uk', 'a.io', 'my-business.example.com', 'x1.test'])(
    'accepts %s',
    (value) => expect(isValidDomain(value)).toBe(true),
  );

  it.each([
    '',
    'acme',
    // Single-label strings are not domains a business can own. The original
    // pattern used `*` here and matched a bare TLD, which would have let
    // someone take a global uniqueness claim on the string "com".
    'com',
    'localhost',
    'acme..com',
    '-acme.com',
    'acme-.com',
    'acme.c',
    'acme.123',
    'ac me.com',
    'acme_test.com',
  ])('rejects %s', (value) => expect(isValidDomain(value)).toBe(false));

  it('rejects a hostname longer than DNS allows', () => {
    expect(isValidDomain(`${'a'.repeat(250)}.com`)).toBe(false);
  });
});

describe('isSandboxDomain (client-side mirror of the server rule)', () => {
  it.each([
    'my-business.example.com',
    'anything.test',
    'foo.invalid',
    'app.localhost',
    'printer.local',
    'db.internal',
    'example.org',
    'https://demo.example.com/',
  ])('recognises %s as a test address', (value) =>
    expect(isSandboxDomain(value)).toBe(true),
  );

  it.each([
    'acme.com',
    'example.com.evil.com',
    'notexample.com',
    'test.com',
    'localhost.com',
    'testing.io',
  ])('does not mistake %s for a test address', (value) =>
    expect(isSandboxDomain(value)).toBe(false),
  );
});

describe('describeDomainProblem', () => {
  it('says nothing when the entry is fine', () => {
    expect(describeDomainProblem('acme.com')).toBeNull();
    expect(describeDomainProblem('https://www.acme.com/x')).toBeNull();
  });

  it('names the actual problem instead of saying "invalid"', () => {
    // Each of these is a distinct mistake with a distinct fix, and telling
    // someone which one they made is the difference between a two-second
    // correction and a guessing game.
    expect(describeDomainProblem('')).toContain('acme.com');
    expect(describeDomainProblem('acme')).toContain('acme.com');
    expect(describeDomainProblem('acme test.com')).toContain('spaces');
    expect(describeDomainProblem('acme_test.com')).toContain('underscores');
    expect(describeDomainProblem('-acme.com')).toContain('hyphen');
    expect(describeDomainProblem('acme.123')).toContain('letters');
  });

  it('suggests the likely completion for a bare name', () => {
    expect(describeDomainProblem('acme')).toContain('acme.com');
  });
});

describe('hostnameFromWebsiteUrl', () => {
  it('extracts a usable hostname for pre-filling the domain step', () => {
    expect(hostnameFromWebsiteUrl('https://www.acme.com/about')).toBe('acme.com');
  });

  it('returns empty rather than a bad suggestion', () => {
    expect(hostnameFromWebsiteUrl(null)).toBe('');
    expect(hostnameFromWebsiteUrl(undefined)).toBe('');
    expect(hostnameFromWebsiteUrl('not a url')).toBe('');
    expect(hostnameFromWebsiteUrl('https://localhost:3000')).toBe('');
  });
});
