import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  gradientBorder?: boolean;
  className?: string;
}

function Card({ title, subtitle, children, gradientBorder = false, className }: CardProps) {
  return (
    <div
      className={clsx(
        'h-full rounded-xl shadow-sm',
        gradientBorder
          ? 'bg-gradient-to-r from-health-normal via-health-warning to-health-danger p-[2px]'
          : '',
        className,
      )}
    >
      <div
        className={clsx(
          'h-full rounded-xl bg-white p-6 dark:bg-slate-800',
          gradientBorder ? '' : 'border border-slate-200 dark:border-slate-700',
        )}
      >
        {(title || subtitle) && (
          <div className="mb-4">
            {title && <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export { Card, type CardProps };
