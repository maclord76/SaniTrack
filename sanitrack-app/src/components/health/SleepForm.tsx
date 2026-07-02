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
  totalSleepH: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(24),
  totalSleepM: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(59),
  deepSleepH: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(24),
  deepSleepM: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(59),
  lightSleepH: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(24),
  lightSleepM: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(59),
  remSleepH: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(24),
  remSleepM: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(59),
  efficiency: z.union([z.number().min(0, "L'efficacité doit être non négative").max(100, "L'efficacité ne peut pas dépasser 100%"), z.nan()]).optional(),
});

type SchemaInput = z.infer<typeof sleepTimeSchema>;

function minutesToHm(totalMinutes: number): { h: number; m: number } {
  if (totalMinutes <= 0) return { h: 0, m: 0 };
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

function hmToMinutes(h: number, m: number): number {
  return (h || 0) * 60 + (m || 0);
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
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
  const totalInit = minutesToHm(initialData?.totalSleep ?? 0);
  const deepInit = minutesToHm(initialData?.deepSleep ?? 0);
  const lightInit = minutesToHm(initialData?.lightSleep ?? 0);
  const remInit = minutesToHm(initialData?.remSleep ?? 0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SchemaInput>({
    resolver: zodResolver(sleepTimeSchema),
    defaultValues: {
      date: toDateInputValue(initialData?.date),
      totalSleepH: totalInit.h,
      totalSleepM: totalInit.m,
      deepSleepH: deepInit.h,
      deepSleepM: deepInit.m,
      lightSleepH: lightInit.h,
      lightSleepM: lightInit.m,
      remSleepH: remInit.h,
      remSleepM: remInit.m,
      efficiency: initialData?.efficiency ?? undefined,
    },
  });

  const totalH = watch('totalSleepH') || 0;
  const totalM = watch('totalSleepM') || 0;
  const deepH = watch('deepSleepH') || 0;
  const deepM = watch('deepSleepM') || 0;
  const lightH = watch('lightSleepH') || 0;
  const lightM = watch('lightSleepM') || 0;
  const remH = watch('remSleepH') || 0;
  const remM = watch('remSleepM') || 0;

  const totalMinutes = hmToMinutes(totalH, totalM);
  const deepMinutes = hmToMinutes(deepH, deepM);
  const lightMinutes = hmToMinutes(lightH, lightM);
  const remMinutes = hmToMinutes(remH, remM);

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
      totalSleep: hmToMinutes(data.totalSleepH, data.totalSleepM),
      deepSleep: hmToMinutes(data.deepSleepH, data.deepSleepM),
      lightSleep: hmToMinutes(data.lightSleepH, data.lightSleepM),
      remSleep: hmToMinutes(data.remSleepH, data.remSleepM),
      efficiency: effValue,
    });
  };

  const numProps = (field: keyof SchemaInput) => ({
    type: 'number' as const,
    min: 0,
    ...register(field, { valueAsNumber: true }),
  });

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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sommeil total {totalMinutes > 0 ? `(${formatMinutes(totalMinutes)})` : ''}
          </label>
          <div className="flex items-center gap-2">
            <input
              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="h"
              {...numProps('totalSleepH')}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">h</span>
            <input
              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="min"
              {...numProps('totalSleepM')}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">min</span>
          </div>
          {errors.totalSleepH && <p className="text-xs text-red-600 dark:text-red-400">{errors.totalSleepH.message}</p>}
          {errors.totalSleepM && <p className="text-xs text-red-600 dark:text-red-400">{errors.totalSleepM.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sommeil profond {deepMinutes > 0 ? `(${formatMinutes(deepMinutes)})` : ''}
          </label>
          <div className="flex items-center gap-2">
            <input
              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="h"
              {...numProps('deepSleepH')}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">h</span>
            <input
              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="min"
              {...numProps('deepSleepM')}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">min</span>
          </div>
          {errors.deepSleepH && <p className="text-xs text-red-600 dark:text-red-400">{errors.deepSleepH.message}</p>}
          {errors.deepSleepM && <p className="text-xs text-red-600 dark:text-red-400">{errors.deepSleepM.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sommeil léger {lightMinutes > 0 ? `(${formatMinutes(lightMinutes)})` : ''}
          </label>
          <div className="flex items-center gap-2">
            <input
              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="h"
              {...numProps('lightSleepH')}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">h</span>
            <input
              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="min"
              {...numProps('lightSleepM')}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">min</span>
          </div>
          {errors.lightSleepH && <p className="text-xs text-red-600 dark:text-red-400">{errors.lightSleepH.message}</p>}
          {errors.lightSleepM && <p className="text-xs text-red-600 dark:text-red-400">{errors.lightSleepM.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sommeil paradoxal {remMinutes > 0 ? `(${formatMinutes(remMinutes)})` : ''}
          </label>
          <div className="flex items-center gap-2">
            <input
              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="h"
              {...numProps('remSleepH')}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">h</span>
            <input
              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="min"
              {...numProps('remSleepM')}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">min</span>
          </div>
          {errors.remSleepH && <p className="text-xs text-red-600 dark:text-red-400">{errors.remSleepH.message}</p>}
          {errors.remSleepM && <p className="text-xs text-red-600 dark:text-red-400">{errors.remSleepM.message}</p>}
        </div>
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