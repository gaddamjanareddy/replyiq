import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Announced while `loading`, replacing the label for assistive tech. */
  loadingLabel?: string;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  secondary:
    'bg-white text-ink-800 border border-ink-300 hover:bg-ink-50 active:bg-ink-100 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200',
};

const sizeStyles: Record<ButtonSize, string> = {
  // min-h values keep every control at or above the 44px comfortable touch
  // target on mobile, where these are tapped rather than clicked.
  sm: 'px-3 py-1.5 text-sm gap-1.5 min-h-8',
  md: 'px-4 py-2 text-sm gap-2 min-h-9.5',
  lg: 'px-5 py-2.5 text-base gap-2 min-h-11',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingLabel,
      fullWidth = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      // Tells assistive tech the control is working rather than broken; without
      // it a spinner is invisible to a screen reader.
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center rounded-lg font-medium',
        'transition-colors duration-150',
        'disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  ),
);

Button.displayName = 'Button';
