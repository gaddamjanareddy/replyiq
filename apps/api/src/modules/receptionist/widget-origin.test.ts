import { describe, expect, it } from 'vitest';
import { checkWidgetOrigin, normalizeHost, type AllowedDomain } from './widget-origin.js';

/**
 * The only thing standing between an unauthenticated endpoint and a business's
 * entire knowledge base. Every case here is a way that check has been got
 * wrong in real products.
 */

const verified: AllowedDomain[] = [
  { domain: 'example.com', isSandbox: false },
  { domain: 'harbourdental.example.test', isSandbox: true },
];

describe('accepting the sites that should be served', () => {
  it('allows the exact verified host', () => {
    const d = checkWidgetOrigin('https://example.com', verified);
    expect(d.allowed).toBe(true);
  });

  it('allows a subdomain of a verified host', () => {
    // Requiring separate verification per subdomain is a support burden with
    // no security benefit - it is plainly the same business.
    expect(checkWidgetOrigin('https://shop.example.com', verified).allowed).toBe(true);
    expect(checkWidgetOrigin('https://a.b.example.com', verified).allowed).toBe(true);
  });

  it('ignores case and a trailing root dot', () => {
    // `Example.COM.` and `example.com` are the same host. Treating them as
    // different would be a bypass, not merely a bug.
    expect(checkWidgetOrigin('https://EXAMPLE.com', verified).allowed).toBe(true);
    expect(checkWidgetOrigin('https://example.com.', verified).allowed).toBe(true);
  });

  it('reports which domain matched, so sandbox status can be acted on', () => {
    const d = checkWidgetOrigin('https://harbourdental.example.test', verified);
    expect(d.allowed && d.matched.isSandbox).toBe(true);
  });

  it('allows localhost ONLY for a business in test mode', () => {
    // Not a general exemption. If any localhost page could query any
    // business, an attacker just runs a local page and reads the knowledge
    // base - which would undo the entire check.
    expect(checkWidgetOrigin('http://localhost:5173', verified).allowed).toBe(false);
    expect(
      checkWidgetOrigin('http://localhost:5173', verified, { allowLocalhost: true }).allowed,
    ).toBe(true);
  });

  it('treats loopback addresses the same as localhost', () => {
    for (const origin of ['http://127.0.0.1:3000', 'http://[::1]:3000']) {
      expect(checkWidgetOrigin(origin, verified).allowed).toBe(false);
      expect(checkWidgetOrigin(origin, verified, { allowLocalhost: true }).allowed).toBe(true);
    }
  });
});

describe('refusing everything else', () => {
  it('refuses a suffix-confusion lookalike', () => {
    // The classic bug: `endsWith('example.com')` alone would hand the
    // knowledge base to anyone who registers `notexample.com`.
    const d = checkWidgetOrigin('https://notexample.com', verified);
    expect(d).toEqual({ allowed: false, reason: 'not-verified' });
  });

  it('refuses a lookalike that merely contains the domain', () => {
    expect(checkWidgetOrigin('https://example.com.evil.test', verified).allowed).toBe(false);
    expect(checkWidgetOrigin('https://evil-example.com', verified).allowed).toBe(false);
  });

  it('refuses an unrelated origin', () => {
    expect(checkWidgetOrigin('https://competitor.test', verified).allowed).toBe(false);
  });

  it('refuses a missing Origin header', () => {
    // A browser always sends one for a cross-origin POST. Its absence means
    // this is not the case the check was designed for.
    expect(checkWidgetOrigin(undefined, verified)).toEqual({ allowed: false, reason: 'missing' });
    expect(checkWidgetOrigin('', verified)).toEqual({ allowed: false, reason: 'missing' });
  });

  it('refuses a malformed Origin', () => {
    expect(checkWidgetOrigin('not a url', verified)).toEqual({
      allowed: false,
      reason: 'malformed',
    });
  });

  it('refuses plaintext http for a real site', () => {
    // The widget carries the owner's content and the visitor's questions.
    expect(checkWidgetOrigin('http://example.com', verified)).toEqual({
      allowed: false,
      reason: 'insecure',
    });
  });

  it('refuses non-web schemes', () => {
    expect(checkWidgetOrigin('file:///etc/passwd', verified).allowed).toBe(false);
    expect(checkWidgetOrigin('javascript:alert(1)', verified).allowed).toBe(false);
  });

  it('refuses everything when the business has verified nothing', () => {
    expect(checkWidgetOrigin('https://example.com', []).allowed).toBe(false);
  });
});

describe('normalizeHost', () => {
  it('lowercases and strips the root dot', () => {
    expect(normalizeHost('  Example.COM.  ')).toBe('example.com');
  });
});

describe('the Referer fallback', () => {
  // Browsers omit Origin on a same-origin GET. Requiring it refused the
  // widget's config request whenever the script and API share an origin,
  // which is a real deployment shape - found on the landing page, where the
  // POST worked and the GET silently 403'd.
  it('uses Referer when Origin is absent', () => {
    const d = checkWidgetOrigin(undefined, verified, {
      referer: 'https://shop.example.com/pricing?from=nav',
    });
    expect(d.allowed).toBe(true);
  });

  it('uses only the origin of the Referer, discarding the path', () => {
    // Which page asked is none of our business, and paths carry query strings
    // that may contain anything.
    expect(
      checkWidgetOrigin(undefined, verified, { referer: 'https://example.com/a/b/c?q=secret' })
        .allowed,
    ).toBe(true);
  });

  it('still refuses a Referer from an unverified site', () => {
    expect(
      checkWidgetOrigin(undefined, verified, { referer: 'https://competitor.test/page' }),
    ).toEqual({ allowed: false, reason: 'not-verified' });
  });

  it('still refuses a suffix-confusion lookalike via Referer', () => {
    expect(
      checkWidgetOrigin(undefined, verified, { referer: 'https://notexample.com/page' }).allowed,
    ).toBe(false);
  });

  it('prefers Origin when both are present', () => {
    // Origin is the stronger signal, so a mismatched Referer cannot widen it.
    expect(
      checkWidgetOrigin('https://competitor.test', verified, {
        referer: 'https://example.com/page',
      }).allowed,
    ).toBe(false);
  });

  it('refuses when neither header is present', () => {
    expect(checkWidgetOrigin(undefined, verified, { referer: undefined })).toEqual({
      allowed: false,
      reason: 'missing',
    });
  });

  it('refuses a malformed Referer', () => {
    expect(checkWidgetOrigin(undefined, verified, { referer: 'not a url' })).toEqual({
      allowed: false,
      reason: 'missing',
    });
  });
});
