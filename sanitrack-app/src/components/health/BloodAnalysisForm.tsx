import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bloodAnalysisFormSchema } from '../../validators/form-schemas';
import type { BloodAnalysis } from '../../models/types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

type BloodAnalysisFormData = Omit<BloodAnalysis, 'id' | 'createdAt'>;

interface BloodAnalysisFormProps {
  initialData?: BloodAnalysis;
  onSubmit: (data: BloodAnalysisFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

type SchemaInput = {
  date: string;
  tc: number;
  hdl: number;
  tg: number;
  ldl: number;
  tcHdlRatio: number;
  glucose: number;
};

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

export function BloodAnalysisForm({ initialData, onSubmit, onCancel, loading = false }: BloodAnalysisFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SchemaInput>({
    resolver: zodResolver(bloodAnalysisFormSchema),
    defaultValues: {
      date: toDateInputValue(initialData?.date),
      tc: initialData?.tc ?? 0,
      hdl: initialData?.hdl ?? 0,
      tg: initialData?.tg ?? 0,
      ldl: initialData?.ldl ?? 0,
      tcHdlRatio: initialData?.tcHdlRatio ?? 0,
      glucose: initialData?.glucose ?? 0,
    },
  });

  const handleFormSubmit = (data: SchemaInput) => {
    onSubmit({
      date: toISODate(data.date),
      tc: data.tc,
      hdl: data.hdl,
      tg: data.tg,
      ldl: data.ldl,
      tcHdlRatio: data.tcHdlRatio,
      glucose: data.glucose,
    });
  };

  const numberInputProps = (field: keyof SchemaInput) => ({
    type: 'number' as const,
    step: '0.01',
    ...register(field, { valueAsNumber: true }),
  });

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Input
            label="Date"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Bon cholestérol (HDL)" error={errors.hdl?.message} {...numberInputProps('hdl')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">mmol/L</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Cholestérol total (TC)" error={errors.tc?.message} {...numberInputProps('tc')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">mmol/L</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Mauvais cholestérol (LDL)" error={errors.ldl?.message} {...numberInputProps('ldl')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">mmol/L</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Rapport TC/HDL" error={errors.tcHdlRatio?.message} {...numberInputProps('tcHdlRatio')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">rapport</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Triglycérides (TG)" error={errors.tg?.message} {...numberInputProps('tg')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">mmol/L</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Glucose" error={errors.glucose?.message} {...numberInputProps('glucose')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">mmol/L</span>
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