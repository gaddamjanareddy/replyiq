import { useEffect, useRef, useCallback, useId, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Footer controls, right-aligned. */
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * A dialog that behaves like one.
 *
 * Beyond looking right, this does the three things a modal must do or it is
 * a trap for keyboard and screen-reader users:
 *
 *   1. Moves focus into the dialog on open, and returns it to whatever opened
 *      it on close - otherwise focus is left on a now-hidden button.
 *   2. Cycles Tab within the dialog, so you cannot tab into the page behind it
 *      and interact with content you cannot see.
 *   3. Announces itself via role="dialog" + aria-modal with a labelled title.
 *
 * Escape and backdrop clicks close it, because a dialog you cannot dismiss
 * with the keyboard is a dead end.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Focus the first control, or the panel itself if it has none.
    const target =
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
    target?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-ink-900/50 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={[
          'glass-strong glass-edge relative w-full shadow-overlay',
          // Full-width sheet on phones, centred card from `sm` up: a 400px-wide
          // dialog floating in the middle of a phone screen wastes the space
          // where the thumb actually is. The entrance matches that shape - it
          // rises from the bottom edge on mobile and scales in on desktop, so
          // in both cases it appears to come from where it visually lives.
          'animate-sheet-up sm:animate-scale-in',
          'rounded-t-2xl sm:rounded-card',
          'max-h-[90vh] overflow-y-auto',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        ].join(' ')}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-ink-200 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-title text-base font-semibold text-ink-900 break-words">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-ink-600">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
              aria-label="Close dialog"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-ink-200 bg-ink-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
