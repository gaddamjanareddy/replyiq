import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ErrorCode, InfoCode } from './error-codes.js';

const here = dirname(fileURLToPath(import.meta.url));
const COPY_FILE = resolve(here, '../../../../web/src/api/error-copy.ts');

/**
 * The contract test that makes Goal G4 enforceable rather than aspirational.
 *
 * Every code this API can emit must have reviewed, human copy on the client.
 * Adding a code without adding copy fails the build here, so the failure mode
 * is a red pipeline rather than a user meeting a bare "Something went wrong" -
 * or, worse, a raw backend string.
 *
 * It lives on the API side because the API owns the codes: whoever adds one is
 * editing this package, and this is the test they will see fail.
 *
 * Reading the client file as text rather than importing it keeps the two
 * packages independent at build time - this is a check, not a dependency.
 */
function clientCopySource(): string {
  return readFileSync(COPY_FILE, 'utf-8');
}

const allCodes = [...Object.values(ErrorCode), ...Object.values(InfoCode)];

describe('every API error code has user-facing copy', () => {
  const source = clientCopySource();

  it('found the client copy table (guards against a silently passing test)', () => {
    expect(source).toContain('export const ERROR_COPY');
    expect(source.length).toBeGreaterThan(500);
  });

  // Parse the table's keys once. A plain substring search would also match the
  // code inside a comment or another entry's prose, which would let a missing
  // entry pass.
  const declaredKeys = new Set(
    [...source.matchAll(/^ {2}([A-Z][A-Z0-9_]+):\s*\{/gm)].map((m) => m[1] as string),
  );

  it.each(allCodes)('%s has an entry in apps/web/src/api/error-copy.ts', (code) => {
    expect(
      declaredKeys.has(code),
      `The API can emit "${code}" but the client has no copy for it. ` +
        'Add an entry to apps/web/src/api/error-copy.ts before shipping the code.',
    ).toBe(true);
  });

  it('the client defines no copy for codes this API cannot emit', () => {
    // Catches copy left behind after a code is retired: dead strings drift out
    // of date and mislead whoever reads them next.
    // NETWORK_ERROR is client-only by design - the request never reached us.
    const orphans = [...declaredKeys].filter(
      (c) => c !== 'NETWORK_ERROR' && !allCodes.includes(c as never),
    );
    expect(orphans).toEqual([]);
  });
});

describe('code hygiene', () => {
  it('every enum member equals its own value, so the wire format is the name', () => {
    for (const [key, value] of Object.entries(ErrorCode)) expect(value).toBe(key);
    for (const [key, value] of Object.entries(InfoCode)) expect(value).toBe(key);
  });

  it('has no duplicate values across ErrorCode and InfoCode', () => {
    expect(new Set(allCodes).size).toBe(allCodes.length);
  });
});
