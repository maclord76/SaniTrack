import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { weightBMIFormSchema } from '../../validators/form-schemas';
import type { WeightBMI } from '../../models/types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

type WeightBMIFormData = Omit<WeightBMI, 'id' | 'createdAt'>;

interface WeightBMIFormProps {
  initialData?: WeightBMI;
  onSubmit: (data: WeightBMIFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  defaultHeight?: number;
}

type SchemaInput = {
  date: string;
  mass: number;
  height: number;
  bmi: number;
};

function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Insuffisance pondérale', color: 'text-blue-600 dark:text-blue-400' };
  if (bmi < 25) return { label: 'Normal', color: 'text-green-600 dark:text-green-400' };
  if (bmi < 30) return { label: 'Surpoids', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Obésité', color: 'text-red-600 dark:text-red-400' };
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

export function WeightBMIForm({ initialData, onSubmit, onCancel, loading = false, defaultHeight = 170 }: WeightBMIFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SchemaInput>({
    resolver: zodResolver(weightBMIFormSchema),
    defaultValues: {
      date: toDateInputValue(initialData?.date),
      mass: initialData?.mass || undefined,
      height: initialData?.height ?? defaultHeight,
      bmi: initialData?.bmi ?? 0,
    },
  });

  const mass = watch('mass') || 0;
  const height = watch('height') || 0;

  const computedBmi = useMemo(() => {
    if (height <= 0 || mass <= 0) return 0;
    const heightInM = height / 100;
    return Math.round((mass / (heightInM * heightInM)) * 10) / 10;
  }, [mass, height]);

  const bmiCategory = useMemo(() => {
    if (computedBmi <= 0) return null;
    return getBmiCategory(computedBmi);
  }, [computedBmi]);

  const massRaw = register('mass', { setValueAs: (value) => value === '' ? undefined : Number(value) });
  const heightRaw = register('height', { valueAsNumber: true });

  const handleMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    massRaw.onChange(e);
    const m = Number(e.target.value) || 0;
    const h = height / 100;
    if (h > 0 && m > 0) {
      setValue('bmi', Math.round((m / (h * h)) * 10) / 10, { shouldValidate: true });
    }
  };

  const handleFormSubmit = (data: SchemaInput) => {
    onSubmit({
      date: toISODate(data.date),
      mass: data.mass,
      height: data.height,
      bmi: data.bmi,
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
            <Input label="Poids (kg)" error={errors.mass?.message} type="number" step="0.1" {...massRaw} onChange={handleMassChange} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">kg</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Taille (cm)</label>
              <div className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {height > 0 ? `${height} cm` : '\u2014'}
              </div>
            </div>
            <input type="hidden" {...heightRaw} />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">IMC (calculé automatiquement)</label>
              <div className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {computedBmi > 0 ? `${computedBmi} kg/m²` : '\u2014'}
              </div>
            </div>
            <input type="hidden" {...register('bmi', { valueAsNumber: true })} />
          </div>
        </div>
      </div>

      {bmiCategory && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
          <span className="text-sm text-slate-600 dark:text-slate-400">Aperçu de l'IMC :</span>
          <span className={`text-sm font-semibold ${bmiCategory.color}`}>
            {computedBmi} — {bmiCategory.label}
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
