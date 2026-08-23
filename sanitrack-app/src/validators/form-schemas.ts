import { z } from 'zod';
import {
  convertBloodAnalysisValueForDisplay,
  type BloodAnalysisConcentrationField,
  type BloodAnalysisUnit,
} from '../utils/blood-analysis-units';

const optionalTimeFormSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Le format doit être hh:mm').or(z.literal('')).optional();

const bloodAnalysisMaximums: Record<BloodAnalysisConcentrationField, number> = {
  tc: 15,
  hdl: 5,
  tg: 20,
  ldl: 12,
  glucose: 40,
};

function bloodAnalysisValueSchema(field: BloodAnalysisConcentrationField, unit: BloodAnalysisUnit) {
  const maximum = convertBloodAnalysisValueForDisplay(field, bloodAnalysisMaximums[field], unit);
  return z.number({ required_error: 'Requis' })
    .min(0, 'Doit être positif')
    .max(maximum, `Maximum ${maximum} ${unit}`)
    .default(0);
}

export function createBloodAnalysisFormSchema(unit: BloodAnalysisUnit) {
  return z.object({
    date: z.string().min(1, 'La date est requise'),
    tc: bloodAnalysisValueSchema('tc', unit),
    hdl: bloodAnalysisValueSchema('hdl', unit),
    tg: bloodAnalysisValueSchema('tg', unit),
    ldl: bloodAnalysisValueSchema('ldl', unit),
    tcHdlRatio: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').max(25, 'Maximum 25').default(0),
    glucose: bloodAnalysisValueSchema('glucose', unit),
  });
}

export const bloodAnalysisFormSchema = createBloodAnalysisFormSchema('mmol/L');

export const physicalActivityFormSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  distance: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  duration: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  totalCalories: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  averagePace: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  averageSpeed: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  averageCadence: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  averageStepLength: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  steps: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').int('Doit être un entier').default(0),
  averageHeartRate: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  aerobicTrainingStress: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  anaerobicTrainingStress: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
});

export const weightBMIFormSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  mass: z.number({ required_error: 'Requis' }).min(1, 'Le poids doit être supérieur à 0').max(500, 'Maximum 500 kg'),
  height: z.number({ required_error: 'Requis' }).min(30, 'La taille doit être supérieure à 30 cm').max(300, 'Maximum 300 cm'),
  bmi: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
});

export const sleepFormSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  bedTime: optionalTimeFormSchema,
  wakeTime: optionalTimeFormSchema,
  totalSleep: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').int('Doit être un entier').default(0),
  deepSleep: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').int('Doit être un entier').default(0),
  lightSleep: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').int('Doit être un entier').default(0),
  remSleep: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').int('Doit être un entier').default(0),
});

export const bloodPressureFormSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  systolic: z.number({ required_error: 'Requis' }).min(40, 'Minimum 40 mmHg').max(300, 'Maximum 300 mmHg'),
  diastolic: z.number({ required_error: 'Requis' }).min(20, 'Minimum 20 mmHg').max(200, 'Maximum 200 mmHg'),
  pulse: z.number().min(0, 'Doit être positif').max(250, 'Maximum 250 bpm').default(0),
});

export const nutritionFoodFormSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  quantity: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  unit: z.string().min(1, "L'unité est requise"),
  barcode: z.string().optional(),
  calories: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  proteins: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  lipids: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  carbs: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
  fibers: z.number({ required_error: 'Requis' }).min(0, 'Doit être positif').default(0),
});

export const nutritionEntryFormSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  foods: z.array(nutritionFoodFormSchema).min(1, 'Au moins un aliment est requis'),
  totalCalories: z.number().min(0).default(0),
  totalProteins: z.number().min(0).default(0),
  totalLipids: z.number().min(0).default(0),
  totalCarbs: z.number().min(0).default(0),
  totalFibers: z.number().min(0).default(0),
});
