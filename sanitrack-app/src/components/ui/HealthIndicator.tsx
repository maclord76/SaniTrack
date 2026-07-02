import { HealthZone } from '@/models/types';
import { clsx } from 'clsx';

interface HealthIndicatorProps {
  zone: HealthZone;
  label: string;
  value: string | number;
  unit?: string;
  zoneLabel?: string;
}

const zoneConfig: Record<HealthZone, { bg: string; text: string; border: string; icon: string; label: string }> = {
  [HealthZone.Normal]: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
    icon: '✓',
    label: 'Normal',
  },
  [HealthZone.Borderline]: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    icon: '⚠',
    label: 'Limite',
  },
  [HealthZone.Elevated]: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-700',
    icon: '▲',
    label: 'Élevé',
  },
  [HealthZone.Critical]: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    icon: '✕',
    label: 'Critique',
  },
};

function HealthIndicator({ zone, label, value, unit, zoneLabel }: HealthIndicatorProps) {
  const config = zoneConfig[zone];
  const displayLabel = zoneLabel ?? config.label;

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-3 rounded-xl border px-4 py-3',
        config.bg,
        config.border,
      )}
    >
      <span className={clsx('flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold', config.bg, config.text)}>
        {config.icon}
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </span>
        <span className={clsx('text-lg font-semibold', config.text)}>
          {value}
          {unit && <span className="ml-1 text-xs font-normal">{unit}</span>}
        </span>
      </div>
      <span
        className={clsx(
          'ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold',
          config.bg,
          config.text,
        )}
      >
        {displayLabel}
      </span>
    </div>
  );
}

export { HealthIndicator, type HealthIndicatorProps };