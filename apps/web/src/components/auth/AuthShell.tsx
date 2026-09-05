import type { ReactNode } from 'react';

/**
 * The frame shared by sign-in and sign-up.
 *
 * Extracted because the two pages had drifted apart in spacing and colour while
 * looking like they had not - the kind of difference nobody notices in review
 * and everybody feels. One frame means one answer.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 shadow-sm">
            <span className="text-lg font-bold text-white">RQ</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-1 text-sm text-ink-600">{subtitle}</p>
        </div>

        <div className="rounded-card border border-ink-200 bg-white p-6 shadow-card">{children}</div>

        <p className="mt-6 text-center text-sm text-ink-600">{footer}</p>
      </div>
    </div>
  );
}
