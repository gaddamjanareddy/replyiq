import type { ReactNode } from 'react';

/**
 * An empty list is an opportunity, not an error.
 *
 * "No domains added yet." tells a user what they already knew. This component
 * exists to make sure every empty surface instead says what the thing is for
 * and offers the action that fills it.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-600">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
