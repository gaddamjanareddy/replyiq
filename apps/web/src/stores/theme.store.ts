import { create } from 'zustand';

/**
 * Light, dark, or follow the operating system.
 *
 * "System" is the default and a real third state, not a synonym for light.
 * Someone whose laptop switches at sunset expects this to switch with it; a
 * product that picks once and ignores the OS is the thing people complain
 * about.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** What is actually on screen once `system` has been resolved. */
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'replyiq.theme';

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return choice;
}

/** Read the stored choice, tolerating a blocked or empty localStorage. */
export function readStoredChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Private mode, or site data blocked. Following the OS is a fine default.
  }
  return 'system';
}

/**
 * Apply a theme to the document.
 *
 * `data-theme` is only stamped for an explicit choice. Left absent, the CSS
 * falls through to the light values, and `system` is handled by resolving it
 * here - which keeps one mechanism instead of two disagreeing ones.
 */
export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice);
  const root = document.documentElement;
  if (resolved === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  return resolved;
}

interface ThemeState {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
  /** Called when the OS preference changes while the choice is `system`. */
  syncWithSystem: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  choice: readStoredChoice(),
  resolved: resolveTheme(readStoredChoice()),

  setChoice: (choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Not being able to remember the choice is a small loss; failing to
      // apply it would be a visible one. Carry on either way.
    }
    set({ choice, resolved: applyTheme(choice) });
  },

  syncWithSystem: () => {
    if (get().choice !== 'system') return;
    set({ resolved: applyTheme('system') });
  },
}));
