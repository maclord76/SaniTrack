import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  description?: string;
  className?: string;
}

function EmptyState({ icon, message, description, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-12', className)}>
      {icon && <div className="mb-4 text-slate-400 dark:text-slate-500">{icon}</div>}
      {!icon && (
        <svg
          className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5v-.427a2.25 2.25 0 0 0-2.25-2.25H6.25A2.25 2.25 0 0 0 4 7.073v.427m16.25 0v9.427a2.25 2.25 0 0 1-2.25 2.25H6.25A2.25 2.25 0 0 1 4 16.9V7.5m16.25 0H4"
          />
        </svg>
      )}
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{description}</p>
      )}
    </div>
  );
}

export { EmptyState, type EmptyStateProps };