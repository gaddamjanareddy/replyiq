/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { resolveApiBase } from './index';

/**
 * The widget is pasted into someone else's HTML, so getting this wrong means
 * every request goes to the wrong host and the only symptom the customer sees
 * is a chat that never answers.
 */

describe('resolveApiBase', () => {
  it('prefers an explicit data-api-url', () => {
    // Self-hosted and staging deployments cannot be guessed, so an explicit
    // value always wins over the convention below.
    expect(resolveApiBase('https://replyiq-web.onrender.com/widget.js', 'https://api.acme.test')).toBe(
      'https://api.acme.test',
    );
  });

  it('derives the API host from where the script was served', () => {
    expect(resolveApiBase('https://replyiq-web.onrender.com/widget.js', undefined)).toBe(
      'https://replyiq-api.onrender.com',
    );
  });

  it('keeps a same-origin deployment on its own origin', () => {
    // No `replyiq-web` in the host means nothing to swap - the API is assumed
    // to be served alongside.
    expect(resolveApiBase('https://acme.test/widget.js', undefined)).toBe('https://acme.test');
  });

  it('strips trailing slashes so paths are not doubled', () => {
    // `${base}/api/v1/...` with a trailing slash produces `//api/v1`, which
    // some proxies redirect and others 404.
    expect(resolveApiBase(undefined, 'https://api.acme.test/')).toBe('https://api.acme.test');
    expect(resolveApiBase(undefined, 'https://api.acme.test///')).toBe('https://api.acme.test');
  });

  it('falls back to a relative base when there is no script src', () => {
    expect(resolveApiBase(undefined, undefined)).toBe('');
  });

  it('ignores the path and query of the script url', () => {
    expect(resolveApiBase('https://replyiq-web.onrender.com/assets/widget.js?v=2', undefined)).toBe(
      'https://replyiq-api.onrender.com',
    );
  });
});
