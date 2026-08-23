import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Sleep } from '../../models/types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

type SleepFormData = Omit<Sleep, 'id' | 'createdAt'>;

interface SleepFormProps {
  initialData?: Sleep;
  onSubmit: (data: SleepFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const sleepTimeSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  bedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Le format doit être hh:mm').or(z.literal('')).optional(),
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Le format doit être hh:mm').or(z.literal('')).optional(),
  totalSleepTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Le format doit être hh:mm').or(z.literal('')).optional(),
  deepSleepTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Le format doit être hh:mm').or(z.literal('')).optional(),
  lightSleepTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Le format doit être hh:mm').or(z.literal('')).optional(),
  remSleepTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Le format doit être hh:mm').or(z.literal('')).optional(),
  efficiency: z.union([z.number().min(0, "L'efficacité doit être non négative").max(100, "L'efficacité ne peut pas dépasser 100%"), z.nan()]).optional(),
});

type SchemaInput = z.infer<typeof sleepTimeSchema>;

function minutesToTimeValue(totalMinutes: number): string {
  if (totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(time: string | undefined): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toISODate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function toDateInputValue(dateStr: string | undefined): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function SleepForm({ initialData, onSubmit, onCancel, loading = false }: SleepFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SchemaInput>({
    resolver: zodResolver(sleepTimeSchema),
    defaultValues: {
      date: toDateInputValue(initialData?.date),
      bedTime: initialData?.bedTime ?? '',
      wakeTime: initialData?.wakeTime ?? '',
      totalSleepTime: minutesToTimeValue(initialData?.totalSleep ?? 0),
      deepSleepTime: minutesToTimeValue(initialData?.deepSleep ?? 0),
      lightSleepTime: minutesToTimeValue(initialData?.lightSleep ?? 0),
      remSleepTime: minutesToTimeValue(initialData?.remSleep ?? 0),
      efficiency: initialData?.efficiency ?? undefined,
    },
  });

  const totalMinutes = timeToMinutes(watch('totalSleepTime'));
  const deepMinutes = timeToMinutes(watch('deepSleepTime'));
  const lightMinutes = timeToMinutes(watch('lightSleepTime'));
  const remMinutes = timeToMinutes(watch('remSleepTime'));

  const percentages = useMemo(() => {
    if (totalMinutes <= 0) return { deep: 0, light: 0, rem: 0 };
    return {
      deep: Math.round((deepMinutes / totalMinutes) * 100),
      light: Math.round((lightMinutes / totalMinutes) * 100),
      rem: Math.round((remMinutes / totalMinutes) * 100),
    };
  }, [totalMinutes, deepMinutes, lightMinutes, remMinutes]);

  const handleFormSubmit = (data: SchemaInput) => {
    const effValue = typeof data.efficiency === 'number' && !isNaN(data.efficiency) ? data.efficiency : undefined;
    onSubmit({
      date: toISODate(data.date),
      bedTime: data.bedTime || undefined,
      wakeTime: data.wakeTime || undefined,
      totalSleep: timeToMinutes(data.totalSleepTime),
      deepSleep: timeToMinutes(data.deepSleepTime),
      lightSleep: timeToMinutes(data.lightSleepTime),
      remSleep: timeToMinutes(data.remSleepTime),
      efficiency: effValue,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Date"
          type="date"
          error={errors.date?.message}
          {...register('date')}
        />

        <Input
          label="Efficacité (%)"
          type="number"
          min={0}
          max={100}
          step={1}
          placeholder="Ex : 85"
          error={errors.efficiency?.message}
          {...register('efficiency', { valueAsNumber: true })}
        />

        <Input
          label="Heure de coucher"
          type="time"
          error={errors.bedTime?.message}
          {...register('bedTime')}
        />

        <Input
          label="Heure de lever"
          type="time"
          error={errors.wakeTime?.message}
          {...register('wakeTime')}
        />

        <Input
          label={`Sommeil total${totalMinutes > 0 ? ` (${totalMinutes} min)` : ''}`}
          type="time"
          error={errors.totalSleepTime?.message}
          {...register('totalSleepTime')}
        />

        <Input
          label={`Sommeil profond${deepMinutes > 0 ? ` (${deepMinutes} min)` : ''}`}
          type="time"
          error={errors.deepSleepTime?.message}
          {...register('deepSleepTime')}
        />

        <Input
          label={`Sommeil léger${lightMinutes > 0 ? ` (${lightMinutes} min)` : ''}`}
          type="time"
          error={errors.lightSleepTime?.message}
          {...register('lightSleepTime')}
        />

        <Input
          label={`Sommeil paradoxal${remMinutes > 0 ? ` (${remMinutes} min)` : ''}`}
          type="time"
          error={errors.remSleepTime?.message}
          {...register('remSleepTime')}
        />
      </div>

      {totalMinutes > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Répartition des phases de sommeil</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Sommeil profond</span>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{percentages.deep}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full" style={{ width: `${Math.min(percentages.deep, 100)}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Sommeil léger</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{percentages.light}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-emerald-600 dark:bg-emerald-400 h-2 rounded-full" style={{ width: `${Math.min(percentages.light, 100)}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Sommeil paradoxal</span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{percentages.rem}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-amber-600 dark:bg-amber-400 h-2 rounded-full" style={{ width: `${Math.min(percentages.rem, 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Mettre à jour' : 'Créer'}
        </Button>
      </div>
    </form>
  );
}
