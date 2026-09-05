import type { ReactNode } from 'react';
import type { ServiceMode } from '../../api/business';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'test';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  /** Small leading dot. Useful for status pills where colour alone is not enough. */
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-ink-100 text-ink-700 ring-ink-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-brand-50 text-brand-700 ring-brand-200',
  // Test Mode gets its own colour so it is never mistaken for a healthy live
  // state at a glance (FR-TEST-05). Violet reads as "different", not "broken".
  test: 'bg-violet-50 text-violet-700 ring-violet-200',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-ink-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-brand-500',
  test: 'bg-violet-500',
};

export function Badge({ variant = 'default', children, className = '', dot }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[variant]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Status label for a domain row.
 *
 * A sandbox domain that is verified is shown as "Test", not "Verified" - it is
 * verified in the database sense, but calling it "Verified" in the same words
 * as a real domain is exactly the conflation FR-TEST-05 forbids.
 */
export function domainStatusBadge(
  status: string,
  isSandbox = false,
): { variant: BadgeVariant; label: string } {
  if (status === 'VERIFIED') {
    return isSandbox
      ? { variant: 'test', label: 'Test domain' }
      : { variant: 'success', label: 'Verified' };
  }
  switch (status) {
    case 'PENDING':
      return { variant: 'warning', label: 'Awaiting verification' };
    case 'DISABLED':
      return { variant: 'danger', label: 'Disabled' };
    default:
      return { variant: 'default', label: status };
  }
}

export function onboardingStatusBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'COMPLETED':
      return { variant: 'success', label: 'Setup complete' };
    case 'IN_PROGRESS':
      return { variant: 'info', label: 'Setting up' };
    case 'DOMAIN_PENDING':
      return { variant: 'warning', label: 'Verifying website' };
    case 'NOT_STARTED':
      return { variant: 'default', label: 'Not started' };
    default:
      return { variant: 'default', label: status };
  }
}

/** The business's live/test/offline state, in the words a user would use. */
export function serviceModeBadge(mode: ServiceMode): { variant: BadgeVariant; label: string } {
  switch (mode) {
    case 'LIVE':
      return { variant: 'success', label: 'Live' };
    case 'TEST':
      return { variant: 'test', label: 'Test mode' };
    case 'INACTIVE':
      return { variant: 'warning', label: 'Offline' };
  }
}
