import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createBloodAnalysisFormSchema } from '../../validators/form-schemas';
import type { BloodAnalysis } from '../../models/types';
import {
  bloodAnalysisConcentrationFields,
  convertBloodAnalysisValue,
  convertBloodAnalysisValueForStorage,
  roundBloodAnalysisValue,
  type BloodAnalysisUnit,
} from '../../utils/blood-analysis-units';
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
  const [inputUnit, setInputUnit] = useState<BloodAnalysisUnit>('mmol/L');
  const schema = useMemo(() => createBloodAnalysisFormSchema(inputUnit), [inputUnit]);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<SchemaInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: toDateInputValue(initialData?.date),
      tc: initialData?.tc || undefined,
      hdl: initialData?.hdl || undefined,
      tg: initialData?.tg || undefined,
      ldl: initialData?.ldl || undefined,
      tcHdlRatio: initialData?.tcHdlRatio || undefined,
      glucose: initialData?.glucose || undefined,
    },
  });

  const handleFormSubmit = (data: SchemaInput) => {
    onSubmit({
      date: toISODate(data.date),
      tc: convertBloodAnalysisValueForStorage('tc', data.tc, inputUnit),
      hdl: convertBloodAnalysisValueForStorage('hdl', data.hdl, inputUnit),
      tg: convertBloodAnalysisValueForStorage('tg', data.tg, inputUnit),
      ldl: convertBloodAnalysisValueForStorage('ldl', data.ldl, inputUnit),
      tcHdlRatio: data.tcHdlRatio,
      glucose: convertBloodAnalysisValueForStorage('glucose', data.glucose, inputUnit),
    });
  };

  const handleUnitChange = (nextUnit: BloodAnalysisUnit) => {
    if (nextUnit === inputUnit) return;

    const values = getValues();
    for (const field of bloodAnalysisConcentrationFields) {
      const value = values[field];
      if (Number.isFinite(value)) {
        setValue(
          field,
          roundBloodAnalysisValue(convertBloodAnalysisValue(field, value, inputUnit, nextUnit), 4),
        );
      }
    }
    clearErrors();
    setInputUnit(nextUnit);
  };

  const numberInputProps = (field: keyof SchemaInput) => ({
    type: 'number' as const,
    step: '0.01',
    ...register(field, { setValueAs: (value) => value === '' ? undefined : Number(value) }),
  });

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Unité de saisie</legend>
        <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-800">
          {(['mmol/L', 'mg/dL'] as BloodAnalysisUnit[]).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => handleUnitChange(unit)}
              aria-pressed={inputUnit === unit}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                inputUnit === unit
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Les concentrations sont toujours enregistrées en mmol/L.
        </p>
      </fieldset>

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
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">{inputUnit}</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Cholestérol total (TC)" error={errors.tc?.message} {...numberInputProps('tc')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">{inputUnit}</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Mauvais cholestérol (LDL)" error={errors.ldl?.message} {...numberInputProps('ldl')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">{inputUnit}</span>
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
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">{inputUnit}</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Glucose" error={errors.glucose?.message} {...numberInputProps('glucose')} />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 pb-6">{inputUnit}</span>
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
