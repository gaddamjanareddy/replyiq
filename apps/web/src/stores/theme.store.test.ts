/**
 * @vitest-environment happy-dom
 *
 * This file needs a DOM: the theme is applied by stamping an attribute on
 * <html> and remembered in localStorage, and neither exists under the default
 * `node` environment. Scoped per-file rather than switched globally so the
 * pure-logic suites keep their faster environment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readStoredChoice, resolveTheme } from './theme.store';

/**
 * The theme has three states and only two visual outcomes, which is exactly
 * where this kind of code goes wrong: `system` is a real choice, not a synonym
 * for light, and it has to keep tracking the OS after boot.
 */

function mockPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveTheme', () => {
  it('follows the OS when the choice is system', () => {
    mockPrefersDark(true);
    expect(resolveTheme('system')).toBe('dark');
    mockPrefersDark(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('ignores the OS when the choice is explicit', () => {
    // Someone who picked light on a dark-mode machine meant it.
    mockPrefersDark(true);
    expect(resolveTheme('light')).toBe('light');
    mockPrefersDark(false);
    expect(resolveTheme('dark')).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('stamps data-theme only for dark', () => {
    // Light is the absence of the attribute, so the CSS has one code path
    // rather than two that can disagree.
    mockPrefersDark(false);
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('resolves system before stamping', () => {
    mockPrefersDark(true);
    expect(applyTheme('system')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('readStoredChoice', () => {
  it('defaults to system when nothing is stored', () => {
    expect(readStoredChoice()).toBe('system');
  });

  it('reads a stored choice back', () => {
    localStorage.setItem('replyiq.theme', 'dark');
    expect(readStoredChoice()).toBe('dark');
  });

  it('falls back to system for a corrupt value', () => {
    // Never trust storage: another tab, an old version, or a user editing it.
    localStorage.setItem('replyiq.theme', 'neon');
    expect(readStoredChoice()).toBe('system');
  });

  it('survives storage throwing', () => {
    // Private mode and blocked site data make getItem throw outright.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredChoice()).toBe('system');
    spy.mockRestore();
  });
});
