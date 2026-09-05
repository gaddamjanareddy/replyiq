/**
 * Loading placeholders shaped like the content they replace.
 *
 * A skeleton that matches the eventual layout prevents the page from jumping
 * when data lands - which is both jarring and a real source of mis-clicks.
 * `aria-hidden` keeps the noise away from screen readers, which get the
 * accompanying status text instead.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  // `skeleton` is a travelling highlight (see index.css). A pulsing block
  // reads as "something is broken"; a sweep reads as "content is coming".
  return <div className={`skeleton rounded ${className}`} aria-hidden="true" />;
}

/** Ragged widths so the placeholder reads as text rather than a loading bar. */
const ROW_WIDTHS = ['w-full', 'w-11/12', 'w-3/4', 'w-5/6'];

export function CardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-ink-200 bg-white p-5 shadow-card">
      <Skeleton className="mb-3 h-5 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`mb-2 h-4 ${ROW_WIDTHS[i % ROW_WIDTHS.length]}`} />
      ))}
    </div>
  );
}

export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="space-y-4">
      <span className="sr-only" role="status">{label}</span>
      <CardSkeleton rows={2} />
      <CardSkeleton rows={3} />
    </div>
  );
}
