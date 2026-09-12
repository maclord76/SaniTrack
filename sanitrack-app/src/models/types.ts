export enum HealthZone {
  Normal = 'normal',
  Borderline = 'borderline',
  Elevated = 'elevated',
  Critical = 'critical',
}

export interface BloodAnalysis {
  id: string;
  date: string;
  tc: number;
  hdl: number;
  tg: number;
  ldl: number;
  tcHdlRatio: number;
  glucose: number;
  createdAt: string;
}

export interface PhysicalActivity {
  id: string;
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
  createdAt: string;
}

export interface WeightBMI {
  id: string;
  date: string;
  mass: number;
  height: number;
  bmi: number;
  createdAt: string;
}

export interface Sleep {
  id: string;
  date: string;
  bedTime?: string;
  wakeTime?: string;
  totalSleep: number;
  deepSleep: number;
  lightSleep: number;
  remSleep: number;
  efficiency?: number; // pourcentage 0-100
  createdAt: string;
}

export interface BloodPressure {
  id: string;
  date: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  createdAt: string;
}

export interface NutritionFood {
  name: string;
  quantity: number;
  unit: string;
  barcode?: string;
  calories: number;
  proteins: number;
  lipids: number;
  carbs: number;
  fibers: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionEntry {
  id: string;
  date: string;
  mealType: MealType;
  foods: NutritionFood[];
  totalCalories: number;
  totalProteins: number;
  totalLipids: number;
  totalCarbs: number;
  totalFibers: number;
  createdAt: string;
}

export interface CachedProduct {
  barcode: string;
  name: string;
  quantity: string;
  servingQuantity: string;
  calories: number;
  proteins: number;
  lipids: number;
  carbs: number;
  fibers: number;
  cachedAt: number;
}

export interface PollenAllergenScore {
  taxon: string;
  name: string;
  score: number;
  toleratedThreshold?: number | null;
  reactiveThreshold?: number | null;
  lastConcentration?: number | null;
  lastFeedback?: 'like' | 'dislike' | null;
  observations?: number;
  toleratedCount?: number;
  reactiveCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface SettingsData {
  height: number;
  weight: number;
  sex: 'male' | 'female' | 'unspecified';
  age: number;
  lifestyle: string;
  metabolismeBase: number | null;
  besoins: number | null;
  thresholds: Array<{
    key: string;
    name: string;
    unit: string;
    bounds: Array<{ value: number; label: string }>;
  }>;
  atmoLogin?: string;
  atmoPassword?: string;
  atmoLocation?: string;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  bloodAnalysis: BloodAnalysis[];
  physicalActivity: PhysicalActivity[];
  weightBMI: WeightBMI[];
  sleep: Sleep[];
  bloodPressure: BloodPressure[];
  nutrition: NutritionEntry[];
  pollenAllergenScores: PollenAllergenScore[];
  settings?: SettingsData;
}

export interface CiqualFood {
  Groupe: string;
  Nom: string;
  "Energie (kcal)": string;
  "Protéines (g)": string;
  "Glucides (g)": string;
  "Lipides (g)": string;
  "Sucres (g)": string;
  "Fibres (g)": string;
}
