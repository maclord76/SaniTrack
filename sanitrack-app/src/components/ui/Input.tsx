import { type InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import type { UseFormRegisterReturn } from 'react-hook-form';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  registration?: UseFormRegisterReturn;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, registration, className, type = 'text', id, disabled, ...props }, ref) => {
    const inputId = id || registration?.name;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          className={clsx(
            'w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
            'dark:bg-slate-800 dark:text-slate-100',
            error
              ? 'border-red-500 dark:border-red-400'
              : 'border-slate-300 dark:border-slate-600',
            disabled && 'cursor-not-allowed opacity-60 bg-slate-100 dark:bg-slate-700',
            className,
          )}
          {...registration}
          {...props}
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input, type InputProps };