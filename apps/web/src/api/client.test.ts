import { describe, it, expect, afterEach } from 'vitest';
import { apiRequest, getErrorCode, getErrorCopy, getErrorMessage, isRetryable } from './client';
import { ERROR_COPY, FALLBACK_COPY } from './error-copy';

const coded = (code: string, message = 'raw backend prose that must never render') => ({
  statusCode: 400,
  code,
  message,
  timestamp: new Date().toISOString(),
});

describe('stable error-code translation (Goal G4 / NFR-USE-05)', () => {
  it('extracts the code when present', () => {
    expect(getErrorCode(coded('DOMAIN_VERIFICATION_MISMATCH'))).toBe(
      'DOMAIN_VERIFICATION_MISMATCH',
    );
  });

  it('returns undefined for code-less errors', () => {
    expect(getErrorCode({ statusCode: 500, message: 'kaboom' })).toBeUndefined();
    expect(getErrorCode(new Error('x'))).toBeUndefined();
    expect(getErrorCode(undefined)).toBeUndefined();
  });

  it.each([
    ['AUTH_INVALID_CREDENTIALS', "doesn't match our records"],
    ['DOMAIN_ALREADY_REGISTERED', 'already connected'],
    ['DOMAIN_VERIFICATION_PENDING', "haven't found your verification"],
    ['DOMAIN_VERIFICATION_MISMATCH', "doesn't match"],
    ['DOMAIN_SANDBOX_NOT_ELIGIBLE', 'test domains'],
    ['DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED', 'only verified website'],
    ['RATE_LIMITED', 'a little fast'],
  ])('maps %s to human copy', (code, fragment) => {
    expect(getErrorMessage(coded(code))).toContain(fragment);
  });

  it('NEVER renders raw backend prose, whatever the backend said', () => {
    const msg = getErrorMessage(
      coded(
        'DOMAIN_ALREADY_REGISTERED',
        'Prisma P2002 Unique constraint failed on business_domains_domain_active_key',
      ),
    );
    for (const leak of ['Prisma', 'P2002', 'constraint', 'business_domains']) {
      expect(msg).not.toContain(leak);
    }
  });

  it('falls back to generic copy rather than leaking an unknown body', () => {
    expect(getErrorCopy(coded('TOTALLY_UNKNOWN_CODE'))).toBe(FALLBACK_COPY);
    // A framework error with no code must not leak its message either.
    const frameworkError = {
      statusCode: 400,
      message: 'Body cannot be empty when content-type is set to application/json',
    };
    expect(getErrorMessage(frameworkError)).not.toContain('content-type');
    expect(getErrorCopy(frameworkError)).toBe(FALLBACK_COPY);
  });

  it('gives a connection-specific hint when the request never left the browser', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toContain('internet connection');
  });

  it('translates session expiry consistently', () => {
    expect(getErrorCopy(new Error('Session expired')).title).toContain('signed out');
  });

  it('reports retryability so callers can label the button correctly', () => {
    expect(isRetryable(coded('DOMAIN_VERIFICATION_PENDING'))).toBe(true);
    expect(isRetryable(coded('DOMAIN_ALREADY_REGISTERED'))).toBe(false);
  });
});

describe('copy quality rules', () => {
  const entries = Object.entries(ERROR_COPY);

  it.each(entries)('%s reads as something a person wrote', (code, copy) => {
    const text = `${copy.title} ${copy.detail ?? ''}`;
    // No jargon that leaked from the backend into the words a user reads.
    for (const jargon of [
      'challenge record',
      'enum',
      'null',
      'undefined',
      'DTO',
      '422',
      '409',
      'Prisma',
      code, // the code itself must never appear in its own copy
    ]) {
      expect(text.toLowerCase()).not.toContain(jargon.toLowerCase());
    }
  });

  it.each(entries)('%s ends its headline as a sentence', (_code, copy) => {
    expect(copy.title.trim()).toMatch(/[.!?]$/);
  });

  it.each(entries)('%s uses a defined tone', (_code, copy) => {
    expect(['info', 'warning', 'error']).toContain(copy.tone);
  });
});

describe('request headers', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function captureHeaders(): { get: () => Record<string, string> } {
    let captured: Record<string, string> = {};
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      captured = (init.headers ?? {}) as Record<string, string>;
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, message: 'ok', data: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }) as typeof fetch;
    return { get: () => captured };
  }

  it('does NOT set Content-Type on a bodyless request', async () => {
    // Regression: the client set Content-Type on every request. Fastify rejects
    // `application/json` with an empty body ("Body cannot be empty when
    // content-type is set"), so every DELETE failed before reaching its route -
    // domain removal was broken from the UI while service-level tests passed.
    const headers = captureHeaders();
    await apiRequest('/api/v1/thing', { method: 'DELETE' });
    expect(headers.get()['Content-Type']).toBeUndefined();
  });

  it('sets Content-Type when a body is present', async () => {
    const headers = captureHeaders();
    await apiRequest('/api/v1/thing', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(headers.get()['Content-Type']).toBe('application/json');
  });
});
