import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { ThemeToggle } from '../ui/ThemeToggle';

/**
 * The frame around every signed-out page.
 *
 * Extracted when the FAQ arrived, before the second copy existed rather than
 * after — the same mistake `PageHeader` was created to undo inside the app.
 * Two public pages with headers that drift apart by a few pixels read as two
 * different websites, and the whole job of these pages is to make a stranger
 * believe this is a real product.
 *
 * The footer is the other reason. A public site needs its secondary links
 * somewhere, and somewhere means one place, or the FAQ is reachable from the
 * front page and nothing is reachable from the FAQ.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-fill to-brand-fill-deep shadow-raised">
            <span className="text-sm font-bold text-white">RQ</span>
          </div>
          <span className="text-title text-lg font-semibold text-ink-900">ReplyIQ</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="interactive rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-ink-700 hover:text-ink-900">
                Sign in
              </Link>
              <Link
                to="/register"
                className="interactive rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">{children}</main>

      <footer className="border-t border-ink-200 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 text-sm text-ink-500">
          <p>© {new Date().getFullYear()} ReplyIQ</p>
          <Link to="/faq" className="hover:text-ink-700">
            Questions
          </Link>
          <Link to="/login" className="hover:text-ink-700">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
