import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { physicalActivityFormSchema } from '../../validators/form-schemas';
import type { PhysicalActivity } from '../../models/types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

type PhysicalActivityFormData = Omit<PhysicalActivity, 'id' | 'createdAt'>;

interface PhysicalActivityFormProps {
  initialData?: PhysicalActivity;
  onSubmit: (data: PhysicalActivityFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

type SchemaInput = {
  date: string;
  distance: number;
  duration: number;
  totalCalories: number;
  averagePace: number;
  averageSpeed: number;
  averageCadence: number;
  averageStepLength: number;
  steps: number;
  averageHeartRate: number;
  aerobicTrainingStress: number;
  anaerobicTrainingStress: number;
};

function secondsToHms(seconds: number): { hours: number; minutes: number; seconds: number } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return { hours: h, minutes: m, seconds: s };
}

function hmsToSeconds(hours: number, minutes: number, seconds: number): number {
  return hours * 3600 + minutes * 60 + seconds;
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

export function PhysicalActivityForm({ initialData, onSubmit, onCancel, loading = false }: PhysicalActivityFormProps) {
  const initialDuration = initialData?.duration ?? 0;
  const initialHms = secondsToHms(initialDuration);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SchemaInput>({
    resolver: zodResolver(physicalActivityFormSchema),
    defaultValues: {
      date: toDateInputValue(initialData?.date),
      distance: initialData?.distance ?? 0,
      duration: initialData?.duration ?? 0,
      totalCalories: initialData?.totalCalories ?? 0,
      averagePace: initialData?.averagePace ?? 0,
      averageSpeed: initialData?.averageSpeed ?? 0,
      averageCadence: initialData?.averageCadence ?? 0,
      averageStepLength: initialData?.averageStepLength ?? 0,
      steps: initialData?.steps ?? 0,
      averageHeartRate: initialData?.averageHeartRate ?? 0,
      aerobicTrainingStress: initialData?.aerobicTrainingStress ?? 0,
      anaerobicTrainingStress: initialData?.anaerobicTrainingStress ??0,
    },
  });

  const distance = watch('distance') || 0;
  const durationSeconds = watch('duration');

  const computedSpeed = useMemo(() => {
    const dur = durationSeconds || 0;
    if (dur <= 0) return 0;
    return Math.round((distance / (dur / 3600)) * 100) / 100;
  }, [distance, durationSeconds]);

  const computedPace = useMemo(() => {
    const dur = durationSeconds || 0;
    if (distance <= 0 || dur <= 0) return 0;
    return Math.round((dur / 60 / distance) * 100) / 100;
  }, [distance, durationSeconds]);

  useEffect(() => {
    if (computedSpeed > 0) {
      setValue('averageSpeed', computedSpeed);
    }
  }, [computedSpeed, setValue]);

  useEffect(() => {
    if (computedPace > 0) {
      setValue('averagePace', computedPace);
    }
  }, [computedPace, setValue]);

  const handleFormSubmit = (data: SchemaInput) => {
    onSubmit({
      date: toISODate(data.date),
      distance: data.distance,
      duration: data.duration,
      totalCalories: data.totalCalories,
      averagePace: data.averagePace,
      averageSpeed: data.averageSpeed,
      averageCadence: data.averageCadence,
      averageStepLength: data.averageStepLength,
      steps: data.steps,
      averageHeartRate: data.averageHeartRate,
      aerobicTrainingStress: data.aerobicTrainingStress,
      anaerobicTrainingStress: data.anaerobicTrainingStress,
    });
  };

  const numberInputProps = (field: keyof SchemaInput) => ({
    type: 'number' as const,
    step: '0.01',
    ...register(field, { valueAsNumber: true }),
  });

  const intNumberInputProps = (field: keyof SchemaInput) => ({
    type: 'number' as const,
    step: '1',
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

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Distance" error={errors.distance?.message} {...numberInputProps('distance')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">km</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Durée</label>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <input
                id="_dur_hour"
                type="number"
                step="1"
                min="0"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                placeholder="h"
                defaultValue={initialHms.hours}
                onChange={(e) => {
                  const h = Number(e.target.value) || 0;
                  const m = Number((document.getElementById('_dur_min') as HTMLInputElement)?.value) || 0;
                  const s = Number((document.getElementById('_dur_sec') as HTMLInputElement)?.value) || 0;
                  setValue('duration', hmsToSeconds(h, m, s), { shouldValidate: true });
                }}
              />
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">h</span>
            <div className="flex-1">
              <input
                id="_dur_min"
                type="number"
                step="1"
                min="0"
                max="59"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                placeholder="m"
                defaultValue={initialHms.minutes}
                onChange={(e) => {
                  const h = Number((document.getElementById('_dur_hour') as HTMLInputElement)?.value) || 0;
                  const m = Number(e.target.value) || 0;
                  const s = Number((document.getElementById('_dur_sec') as HTMLInputElement)?.value) || 0;
                  setValue('duration', hmsToSeconds(h, m, s), { shouldValidate: true });
                }}
              />
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">m</span>
            <div className="flex-1">
              <input
                id="_dur_sec"
                type="number"
                step="1"
                min="0"
                max="59"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                placeholder="s"
                defaultValue={initialHms.seconds}
                onChange={(e) => {
                  const h = Number((document.getElementById('_dur_hour') as HTMLInputElement)?.value) || 0;
                  const m = Number((document.getElementById('_dur_min') as HTMLInputElement)?.value) || 0;
                  const s = Number(e.target.value) || 0;
                  setValue('duration', hmsToSeconds(h, m, s), { shouldValidate: true });
                }}
              />
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">s</span>
          </div>
          {errors.duration?.message && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.duration.message}</p>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Calories totales" error={errors.totalCalories?.message} {...numberInputProps('totalCalories')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">kcal</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Fréquence cardiaque moyenne" error={errors.averageHeartRate?.message} {...intNumberInputProps('averageHeartRate')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">bpm</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Pas" error={errors.steps?.message} {...intNumberInputProps('steps')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">pas</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Cadence moyenne" error={errors.averageCadence?.message} {...intNumberInputProps('averageCadence')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">pas/min</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Longueur moyenne des pas" error={errors.averageStepLength?.message} {...numberInputProps('averageStepLength')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">cm</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Vitesse moyenne (auto)" error={errors.averageSpeed?.message} {...numberInputProps('averageSpeed')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">km/h</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Allure moyenne (auto)" error={errors.averagePace?.message} {...numberInputProps('averagePace')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">min/km</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Stress d'entraînement aérobie" error={errors.aerobicTrainingStress?.message} {...numberInputProps('aerobicTrainingStress')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6"></span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Stress d'entraînement anaérobie" error={errors.anaerobicTrainingStress?.message} {...numberInputProps('anaerobicTrainingStress')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6"></span>
        </div>
      </div>

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