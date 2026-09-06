import { useEffect } from 'react';
import { useThemeStore, type ThemeChoice } from '../../stores/theme.store';

/**
 * Light / System / Dark, as a segmented control.
 *
 * A single sun-moon button is smaller, and it is worse: it cannot express
 * "follow my system", so a user who wants that has no way to ask for it and
 * cannot tell whether the app is following them or has been pinned. Three
 * visible states remove the guessing.
 */

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: string }> = [
  {
    value: 'light',
    label: 'Light',
    icon: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
  },
  {
    value: 'system',
    label: 'System',
    icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
  },
];

export function ThemeToggle() {
  const choice = useThemeStore((s) => s.choice);
  const setChoice = useThemeStore((s) => s.setChoice);
  const syncWithSystem = useThemeStore((s) => s.syncWithSystem);

  // Follow the OS while the choice is `system`. Without this listener the app
  // resolves once at boot and then ignores a machine that switches at sunset,
  // which is precisely the case `system` exists to serve.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => syncWithSystem();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [syncWithSystem]);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-lg border border-ink-200 bg-ink-100 p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            // The visible label is an icon, so the name has to come from here.
            aria-label={option.label}
            title={option.label}
            onClick={() => setChoice(option.value)}
            className={`interactive rounded-md p-1.5 ${
              active
                ? 'bg-surface text-ink-900 shadow-card'
                : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.6"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
