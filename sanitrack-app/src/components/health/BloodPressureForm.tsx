import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bloodPressureFormSchema } from '../../validators/form-schemas';
import type { BloodPressure } from '../../models/types';
import { evaluateBloodPressure } from '../../engine/rules';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

type BloodPressureFormData = Omit<BloodPressure, 'id' | 'createdAt'>;

interface BloodPressureFormProps {
  initialData?: BloodPressure;
  onSubmit: (data: BloodPressureFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

type SchemaInput = {
  date: string;
  systolic: number;
  diastolic: number;
  pulse: number;
};

const zoneStyles: Record<string, { color: string; bg: string }> = {
  normal: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
  borderline: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  elevated: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  critical: { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30' },
};

function classifyBp(systolic: number, diastolic: number): { label: string; color: string; bg: string } {
  const fakeRecord: BloodPressure = {
    id: '',
    date: new Date().toISOString(),
    systolic,
    diastolic,
    createdAt: new Date().toISOString(),
  };
  const eval_ = evaluateBloodPressure(fakeRecord);
  const styles = zoneStyles[eval_.combinedZone] ?? zoneStyles.elevated;
  return { label: eval_.combinedLabel, color: styles.color, bg: styles.bg };
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

export function BloodPressureForm({ initialData, onSubmit, onCancel, loading = false }: BloodPressureFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SchemaInput>({
    resolver: zodResolver(bloodPressureFormSchema),
    defaultValues: {
      date: toDateInputValue(initialData?.date),
      systolic: initialData?.systolic ?? 0,
      diastolic: initialData?.diastolic ?? 0,
      pulse: initialData?.pulse ?? 0,
    },
  });

  const systolic = watch('systolic') || 0;
  const diastolic = watch('diastolic') || 0;

  const classification = useMemo(() => {
    if (systolic <= 0 || diastolic <= 0) return null;
    return classifyBp(systolic, diastolic);
  }, [systolic, diastolic]);

  const handleFormSubmit = (data: SchemaInput) => {
    onSubmit({
      date: toISODate(data.date),
      systolic: data.systolic,
      diastolic: data.diastolic,
      ...(data.pulse ? { pulse: data.pulse } : {}),
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

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Systolique" error={errors.systolic?.message} type="number" step="1" {...register('systolic', { valueAsNumber: true })} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">mmHg</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Diastolique" error={errors.diastolic?.message} type="number" step="1" {...register('diastolic', { valueAsNumber: true })} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">mmHg</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Pouls" error={errors.pulse?.message} type="number" step="1" {...register('pulse', { valueAsNumber: true })} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">bpm</span>
        </div>
      </div>

      {classification && (
        <div className={`flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 ${classification.bg}`}>
          <span className="text-sm text-slate-600 dark:text-slate-400">Classification :</span>
          <span className={`text-sm font-semibold ${classification.color}`}>
            {classification.label}
          </span>
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