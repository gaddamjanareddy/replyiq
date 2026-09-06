import type { ReactNode } from 'react';

/**
 * The top of every page.
 *
 * Extracted because four pages had each grown their own version — same intent,
 * slightly different sizes, weights and spacing. Nobody notices that in review
 * and everybody feels it: an interface where the same thing is drawn four
 * slightly different ways reads as unfinished, even when every individual page
 * looks fine.
 *
 * The structure also fixes a real hierarchy problem. Previously the page title
 * and a card heading inside it were both `text-sm font-semibold text-ink-900`,
 * so the page had no clear first thing to read. Here the title is the largest
 * text on the page and everything else steps down from it.
 */
export function PageHeader({
  overline,
  title,
  subtitle,
  actions,
}: {
  /** Small caps label above the title, for orientation. */
  overline?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned slot for a count, badge or primary action. */
  actions?: ReactNode;
}) {
  return (
    <header className="animate-rise flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {overline && (
          <p className="text-overline text-xs font-semibold text-ink-500">{overline}</p>
        )}
        <h1 className="text-display mt-1 text-2xl font-semibold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-prose text-sm text-ink-600">{subtitle}</p>}
      </div>
      {/* Sits on the baseline of the title rather than the top of the block, so
          a badge beside a two-line subtitle does not float. */}
      {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
    </header>
  );
}
