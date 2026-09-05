import type { ReactNode } from 'react';
import type { ErrorCopy } from '../../api/error-copy';

export type BannerTone = 'info' | 'success' | 'warning' | 'error' | 'test';

interface BannerProps {
  tone: BannerTone;
  title: ReactNode;
  children?: ReactNode;
  /** Optional trailing control, e.g. a "Check again" button. */
  action?: ReactNode;
  className?: string | undefined;
  /**
   * Announce the banner when it appears. Use for results of an action the user
   * just took (a verification outcome); leave off for banners that are simply
   * part of the page, which would otherwise be read out on every render.
   */
  live?: boolean;
}

const toneStyles: Record<BannerTone, { wrap: string; icon: string; title: string; body: string }> = {
  info: {
    wrap: 'bg-brand-50 border-brand-200',
    icon: 'text-brand-600',
    title: 'text-brand-900',
    body: 'text-brand-800',
  },
  success: {
    wrap: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    body: 'text-emerald-800',
  },
  warning: {
    wrap: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-800',
  },
  error: {
    wrap: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    title: 'text-red-900',
    body: 'text-red-800',
  },
  test: {
    wrap: 'bg-violet-50 border-violet-200',
    icon: 'text-violet-600',
    title: 'text-violet-900',
    body: 'text-violet-800',
  },
};

const icons: Record<BannerTone, string> = {
  info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  success: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  error:
    'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  test: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c.251.023.501.05.75.082M9.75 3.104A24.301 24.301 0 0112 3c.76 0 1.51.037 2.25.104m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
};

/**
 * The one way this app tells a user something.
 *
 * Colour is never the only signal: every tone carries a distinct icon and its
 * own wording, so the meaning survives greyscale printing, low-contrast
 * displays, and the ~8% of men with colour vision deficiency.
 */
export function Banner({ tone, title, children, action, className = '', live }: BannerProps) {
  const styles = toneStyles[tone];
  return (
    <div
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      // Banners appear in response to something the user did, so they should
      // look like they arrived from somewhere rather than blinking into place -
      // that movement is what draws the eye without a jolt.
      className={`flex gap-3 rounded-lg border p-4 animate-rise ${styles.wrap} ${className}`}
    >
      <svg
        className={`h-5 w-5 shrink-0 mt-0.5 ${styles.icon}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.7"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icons[tone]} />
      </svg>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${styles.title}`}>{title}</p>
        {children && <div className={`mt-1 text-sm ${styles.body}`}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/**
 * Render an {@link ErrorCopy} entry. Guarantees the two halves - headline and
 * likely cause - always travel together, so no call site can accidentally show
 * the "what" without the "why".
 */
export function ErrorBanner({
  copy,
  action,
  className,
  live = true,
}: {
  copy: ErrorCopy;
  action?: ReactNode;
  className?: string | undefined;
  live?: boolean | undefined;
}) {
  return (
    <Banner tone={copy.tone} title={copy.title} action={action} className={className} live={live}>
      {copy.detail}
    </Banner>
  );
}
