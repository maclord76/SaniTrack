import { type SelectHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import type { UseFormRegisterReturn } from 'react-hook-form';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  registration?: UseFormRegisterReturn;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, registration, className, id, ...props }, ref) => {
    const selectId = id || registration?.name;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
            'dark:bg-slate-800 dark:text-slate-100',
            error
              ? 'border-red-500 dark:border-red-400'
              : 'border-slate-300 dark:border-slate-600',
            className,
          )}
          {...registration}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';

export { Select, type SelectProps, type SelectOption };