import Dexie, { type Table } from 'dexie';
import type {
  BloodAnalysis,
  PhysicalActivity,
  WeightBMI,
  Sleep,
  BloodPressure,
  NutritionEntry,
  CachedProduct,
  PollenAllergenScore,
} from '../models/types';

class SanitrackDatabase extends Dexie {
  bloodAnalyses!: Table<BloodAnalysis, string>;
  physicalActivities!: Table<PhysicalActivity, string>;
  weightBMI!: Table<WeightBMI, string>;
  sleep!: Table<Sleep, string>;
  bloodPressure!: Table<BloodPressure, string>;
  nutrition!: Table<NutritionEntry, string>;
  cachedProducts!: Table<CachedProduct, string>;
  pollenAllergenScores!: Table<PollenAllergenScore, string>;

  constructor() {
    super('sanitrack');

    this.version(1).stores({
      bloodAnalyses: 'id, date, createdAt',
      physicalActivities: 'id, date, createdAt',
      weightBMI: 'id, date, createdAt',
      sleep: 'id, date, createdAt',
      bloodPressure: 'id, date, createdAt',
      nutrition: 'id, date, mealType, createdAt, [date+mealType]',
    });

    this.version(2).stores({
      bloodAnalyses: 'id, date, createdAt',
      physicalActivities: 'id, date, createdAt',
      weightBMI: 'id, date, createdAt',
      sleep: 'id, date, createdAt',
      bloodPressure: 'id, date, createdAt',
      nutrition: 'id, date, mealType, createdAt, [date+mealType]',
      cachedProducts: 'barcode, name, cachedAt',
    });

    this.version(3).stores({
      bloodAnalyses: 'id, date, createdAt',
      physicalActivities: 'id, date, createdAt',
      weightBMI: 'id, date, createdAt',
      sleep: 'id, date, createdAt',
      bloodPressure: 'id, date, createdAt',
      nutrition: 'id, date, mealType, createdAt, [date+mealType]',
      cachedProducts: 'barcode, name, cachedAt',
      pollenAllergenScores: 'taxon, name, updatedAt',
    });

    this.version(4).stores({
      bloodAnalyses: 'id, date, createdAt',
      physicalActivities: 'id, date, createdAt',
      weightBMI: 'id, date, createdAt',
      sleep: 'id, date, createdAt',
      bloodPressure: 'id, date, createdAt',
      nutrition: 'id, date, mealType, createdAt, [date+mealType]',
      cachedProducts: 'barcode, name, cachedAt',
      pollenAllergenScores: 'taxon, name, updatedAt',
    });
  }
}

export const db = new SanitrackDatabase();
