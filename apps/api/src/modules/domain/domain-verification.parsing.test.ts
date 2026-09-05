import { describe, it, expect } from 'vitest';
import { extractMetaContent, matchesTxtRecords } from './domain-verification.service.js';

const TOKEN = 'replyiq-verify-1f2e3d4c-5b6a-7988-9a0b-c1d2e3f4a5b6';

describe('matchesTxtRecords', () => {
  it('matches a plain single record', () => {
    expect(matchesTxtRecords([[TOKEN]], TOKEN)).toBe(true);
  });

  it('matches a record split into chunks by DNS 255-byte limits', () => {
    const chunks = [TOKEN.slice(0, 20), TOKEN.slice(20)];
    expect(matchesTxtRecords([chunks], TOKEN)).toBe(true);
  });

  it('matches when the correct record sits alongside unrelated ones', () => {
    // The previous implementation joined every chunk of every record into one
    // string before comparing, so a correctly published record failed whenever
    // any second TXT record existed at the same name - routine during a DNS
    // provider migration. This is the regression test for that bug.
    const records = [['v=spf1 include:_spf.example.com ~all'], [TOKEN], ['some-other-proof=xyz']];
    expect(matchesTxtRecords(records, TOKEN)).toBe(true);
  });

  it('still matches a value a provider split across separate records', () => {
    expect(matchesTxtRecords([[TOKEN.slice(0, 15)], [TOKEN.slice(15)]], TOKEN)).toBe(true);
  });

  it('tolerates surrounding quotes and whitespace', () => {
    expect(matchesTxtRecords([[`  "${TOKEN}"  `]], TOKEN)).toBe(true);
  });

  it('rejects a near-miss', () => {
    expect(matchesTxtRecords([[`${TOKEN}x`]], TOKEN)).toBe(false);
    expect(matchesTxtRecords([[TOKEN.slice(0, -1)]], TOKEN)).toBe(false);
    expect(matchesTxtRecords([['replyiq-verify-something-else']], TOKEN)).toBe(false);
  });

  it('rejects an empty answer', () => {
    expect(matchesTxtRecords([], TOKEN)).toBe(false);
    expect(matchesTxtRecords([[]], TOKEN)).toBe(false);
  });
});

describe('extractMetaContent', () => {
  const NAME = 'replyiq-verification';

  it('finds the tag in a realistic document', () => {
    const html = `<!doctype html><html><head>
      <meta charset="utf-8">
      <title>Acme</title>
      <meta name="${NAME}" content="${TOKEN}">
      <meta name="description" content="We do things">
    </head><body>hi</body></html>`;
    expect(extractMetaContent(html, NAME)).toBe(TOKEN);
  });

  describe('tolerates real-world markup variation', () => {
    const variants: Array<[string, string]> = [
      ['double quotes', `<meta name="${NAME}" content="${TOKEN}">`],
      ['single quotes', `<meta name='${NAME}' content='${TOKEN}'>`],
      ['unquoted', `<meta name=${NAME} content=${TOKEN}>`],
      ['reversed attribute order', `<meta content="${TOKEN}" name="${NAME}">`],
      ['uppercase tag and attributes', `<META NAME="${NAME}" CONTENT="${TOKEN}">`],
      ['mixed case name', `<meta name="RePlyIQ-Verification" content="${TOKEN}">`],
      ['self-closing', `<meta name="${NAME}" content="${TOKEN}" />`],
      ['extra attributes', `<meta data-x="1" name="${NAME}" id="v" content="${TOKEN}">`],
      ['minified, no spaces around =', `<meta name="${NAME}"content="${TOKEN}">`],
      ['newlines inside the tag', `<meta\n  name="${NAME}"\n  content="${TOKEN}"\n>`],
    ];
    for (const [label, tag] of variants) {
      it(label, () => {
        expect(extractMetaContent(`<head>${tag}</head>`, NAME)).toBe(TOKEN);
      });
    }
  });

  it('finds the tag even if a CMS injected it into the body', () => {
    expect(extractMetaContent(`<body><p>hi</p><meta name="${NAME}" content="${TOKEN}"></body>`, NAME))
      .toBe(TOKEN);
  });

  it('returns null when no such tag exists, so the caller can try the file placements', () => {
    expect(extractMetaContent('<head><meta name="description" content="x"></head>', NAME))
      .toBeNull();
    expect(extractMetaContent('', NAME)).toBeNull();
    expect(extractMetaContent('<html><body>plain text</body></html>', NAME)).toBeNull();
  });

  it('does not match a different name that merely shares a prefix', () => {
    // "replyiq-verification-old" must not satisfy "replyiq-verification".
    const html = `<meta name="${NAME}-old" content="${TOKEN}">`;
    expect(extractMetaContent(html, NAME)).toBeNull();
  });

  it('returns the wrong value rather than null, so a mismatch is distinguishable', () => {
    // This is what makes MISMATCH possible: the tag is present, so telling the
    // user to "wait a few minutes" would be actively misleading.
    const html = `<meta name="${NAME}" content="replyiq-verify-wrong">`;
    expect(extractMetaContent(html, NAME)).toBe('replyiq-verify-wrong');
  });

  it('treats an empty content attribute as present-but-wrong, not absent', () => {
    expect(extractMetaContent(`<meta name="${NAME}" content="">`, NAME)).toBe('');
  });

  it('picks the first matching tag when a page has duplicates', () => {
    const html = `<meta name="${NAME}" content="first"><meta name="${NAME}" content="second">`;
    expect(extractMetaContent(html, NAME)).toBe('first');
  });

  it('is not confused by the token appearing in ordinary page text', () => {
    const html = `<body>Our verification code is ${TOKEN}</body>`;
    expect(extractMetaContent(html, NAME)).toBeNull();
  });
});
