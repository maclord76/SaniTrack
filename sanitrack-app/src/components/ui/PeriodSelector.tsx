import { useState } from 'react';
import { clsx } from 'clsx';
import type { DateRange } from '@/models/types';
import { Modal } from './Modal';
import { Button } from './Button';

type Period = 'week' | 'month' | 'year' | 'all' | 'custom';

interface PeriodSelectorProps {
  value: Period;
  dateRange?: DateRange;
  onChange: (period: Period, dateRange: DateRange) => void;
}

function periodToDateRange(period: Period): DateRange {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  switch (period) {
    case 'week':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case 'year':
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'all':
      start = new Date(1970, 0, 1);
      break;
    default:
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }
  return { start: start.toISOString(), end };
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const periods: { key: Period; label: string }[] = [
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
  { key: 'all', label: 'Tout' },
  { key: 'custom', label: 'Personnalisé' },
];

function dateToInputValue(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function PeriodSelector({ value, dateRange, onChange }: PeriodSelectorProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(
    dateRange ? dateToInputValue(dateRange.start) : new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
  );
  const [customEnd, setCustomEnd] = useState(
    dateRange ? dateToInputValue(dateRange.end) : new Date().toISOString().slice(0, 10),
  );
  const [customError, setCustomError] = useState<string | null>(null);

  const handleClick = (period: Period) => {
    if (period === 'custom') {
      if (dateRange) {
        setCustomStart(dateToInputValue(dateRange.start));
        setCustomEnd(dateToInputValue(dateRange.end));
      }
      setCustomError(null);
      setShowCustomModal(true);
      return;
    }
    const dr = periodToDateRange(period);
    onChange(period, dr);
  };

  const handleCustomApply = () => {
    const start = new Date(customStart + 'T00:00:00');
    const end = new Date(customEnd + 'T23:59:59');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setCustomError('Dates invalides.');
      return;
    }
    if (start > end) {
      setCustomError('La date de début doit être antérieure à la date de fin.');
      return;
    }
    setCustomError(null);
    onChange('custom', { start: start.toISOString(), end: end.toISOString() });
    setShowCustomModal(false);
  };

  const currentRange = dateRange ?? (value !== 'custom' ? periodToDateRange(value) : undefined);

  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {periods.map((period) => (
          <button
            key={period.key}
            type="button"
            onClick={() => handleClick(period.key)}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              value === period.key
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {period.label}
          </button>
        ))}
      </div>
      {currentRange && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatDateShort(currentRange.start)} — {formatDateShort(currentRange.end)}
        </p>
      )}
      <Modal isOpen={showCustomModal} onClose={() => setShowCustomModal(false)} title="Période personnalisée">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="custom-start" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Date de début
              </label>
              <input
                id="custom-start"
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setCustomError(null); }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="custom-end" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Date de fin
              </label>
              <input
                id="custom-end"
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setCustomError(null); }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          {customError && (
            <p className="text-sm text-red-600 dark:text-red-400">{customError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCustomModal(false)}>Annuler</Button>
            <Button onClick={handleCustomApply}>Appliquer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export { PeriodSelector, type PeriodSelectorProps, type Period };