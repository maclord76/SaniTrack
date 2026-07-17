import { db } from './database';
import type { Table } from 'dexie';
import {
  bloodAnalysisSchema,
  physicalActivitySchema,
  weightBMISchema,
  sleepSchema,
  bloodPressureSchema,
  nutritionEntrySchema,
  pollenAllergenScoreSchema,
} from '../validators';
import type {
  BloodAnalysis,
  PhysicalActivity,
  WeightBMI,
  Sleep,
  BloodPressure,
  NutritionEntry,
  PollenAllergenScore,
  ExportData,
  SettingsData,
} from '../models/types';

const SCHEMA_VERSION = '1';

function getSettingsFromLocalStorage(): SettingsData {
  return {
    height: localStorage.getItem('settings_height') ? Number(localStorage.getItem('settings_height')) : 170,
    weight: localStorage.getItem('settings_weight') ? Number(localStorage.getItem('settings_weight')) : 70,
    sex: (localStorage.getItem('settings_sex') as SettingsData['sex']) ?? 'unspecified',
    age: localStorage.getItem('settings_age') ? Number(localStorage.getItem('settings_age')) : 30,
    lifestyle: localStorage.getItem('settings_lifestyle') ?? 'sedentary',
    metabolismeBase: localStorage.getItem('settings_metabolisme_base') ? Number(localStorage.getItem('settings_metabolisme_base')) : null,
    besoins: localStorage.getItem('settings_besoins') ? Number(localStorage.getItem('settings_besoins')) : null,
    thresholds: (() => {
      try {
        const stored = localStorage.getItem('settings_thresholds');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })(),
    atmoLogin: localStorage.getItem('settings_atmo_login') ?? undefined,
    atmoPassword: localStorage.getItem('settings_atmo_password') ?? undefined,
    atmoLocation: localStorage.getItem('settings_atmo_location') ?? undefined,
  };
}

function restoreSettingsToLocalStorage(settings: SettingsData): void {
  localStorage.setItem('settings_height', String(settings.height));
  localStorage.setItem('settings_weight', String(settings.weight));
  localStorage.setItem('settings_sex', settings.sex);
  localStorage.setItem('settings_age', String(settings.age));
  localStorage.setItem('settings_lifestyle', settings.lifestyle);
  if (settings.metabolismeBase !== null) {
    localStorage.setItem('settings_metabolisme_base', String(settings.metabolismeBase));
  } else {
    localStorage.removeItem('settings_metabolisme_base');
  }
  if (settings.besoins !== null) {
    localStorage.setItem('settings_besoins', String(settings.besoins));
  } else {
    localStorage.removeItem('settings_besoins');
  }
  if (settings.thresholds && settings.thresholds.length > 0) {
    localStorage.setItem('settings_thresholds', JSON.stringify(settings.thresholds));
  }
  if (settings.atmoLogin !== undefined) {
    localStorage.setItem('settings_atmo_login', settings.atmoLogin);
  } else {
    localStorage.removeItem('settings_atmo_login');
  }
  if (settings.atmoPassword !== undefined) {
    localStorage.setItem('settings_atmo_password', settings.atmoPassword);
  } else {
    localStorage.removeItem('settings_atmo_password');
  }
  if (settings.atmoLocation !== undefined) {
    localStorage.setItem('settings_atmo_location', settings.atmoLocation);
  } else {
    localStorage.removeItem('settings_atmo_location');
  }
}

export async function exportAllData(): Promise<ExportData> {
  const [
    bloodAnalysis,
    physicalActivity,
    weightBMI,
    sleep,
    bloodPressure,
    nutrition,
    pollenAllergenScores,
  ] = await Promise.all([
    db.bloodAnalyses.toArray(),
    db.physicalActivities.toArray(),
    db.weightBMI.toArray(),
    db.sleep.toArray(),
    db.bloodPressure.toArray(),
    db.nutrition.toArray(),
    db.pollenAllergenScores.toArray(),
  ]);

  const settings = getSettingsFromLocalStorage();

  return {
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    bloodAnalysis,
    physicalActivity,
    weightBMI,
    sleep,
    bloodPressure,
    nutrition,
    pollenAllergenScores,
    settings,
  };
}

export interface ImportResult {
  imported: number;
  errors: string[];
}

interface ImportDataShape {
  version: string;
  exportedAt: string;
  bloodAnalysis: BloodAnalysis[];
  physicalActivity: PhysicalActivity[];
  weightBMI: WeightBMI[];
  sleep: Sleep[];
  bloodPressure: BloodPressure[];
  nutrition: NutritionEntry[];
  pollenAllergenScores?: PollenAllergenScore[];
  settings?: SettingsData;
}

const validators = {
  bloodAnalysis: bloodAnalysisSchema,
  physicalActivity: physicalActivitySchema,
  weightBMI: weightBMISchema,
  sleep: sleepSchema,
  bloodPressure: bloodPressureSchema,
  nutrition: nutritionEntrySchema,
  pollenAllergenScores: pollenAllergenScoreSchema,
} as const;

type ValidatorKey = keyof typeof validators;

function validateTableEntries<T>(
  key: ValidatorKey,
  entries: unknown[],
): { valid: T[]; errors: string[] } {
  const schema = validators[key];
  const valid: T[] = [];
  const errors: string[] = [];

  entries.forEach((entry, index) => {
    const result = schema.safeParse(entry);
    if (result.success) {
      valid.push(result.data as T);
    } else {
      const messages = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      errors.push(
        `${key}[${index}]: ${messages}`,
      );
    }
  });

  return { valid, errors };
}

function getEntryPrimaryKey(key: ValidatorKey, entry: unknown): string {
  if (key === 'pollenAllergenScores') {
    return (entry as PollenAllergenScore).taxon;
  }

  return (entry as { id: string }).id;
}

export async function importAllData(
  data: unknown,
  options: { clearExisting?: boolean } = {},
): Promise<ImportResult> {
  const { clearExisting = true } = options;
  const errors: string[] = [];

  if (
    typeof data !== 'object' ||
    data === null ||
    !('version' in data) ||
    typeof (data as ImportDataShape).version !== 'string'
  ) {
    return { imported: 0, errors: ['Invalid import data: missing or invalid version field'] };
  }

  const importData = data as ImportDataShape;

  if (importData.version !== SCHEMA_VERSION) {
    return {
      imported: 0,
      errors: [
        `Schema version mismatch: expected ${SCHEMA_VERSION}, got ${importData.version}`,
      ],
    };
  }

  const tableKeys = Object.keys(validators) as ValidatorKey[];
  type TableMap = {
    bloodAnalysis: BloodAnalysis[];
    physicalActivity: PhysicalActivity[];
    weightBMI: WeightBMI[];
    sleep: Sleep[];
    bloodPressure: BloodPressure[];
    nutrition: NutritionEntry[];
    pollenAllergenScores: PollenAllergenScore[];
  };

  const validatedData: Partial<TableMap> = {};

  for (const key of tableKeys) {
    const entries = importData[key] ?? (key === 'pollenAllergenScores' ? [] : undefined);
    if (!Array.isArray(entries)) {
      errors.push(`${key}: expected array, got ${typeof entries}`);
      continue;
    }

    const result = validateTableEntries(key, entries);
    validatedData[key] = result.valid as never;
    errors.push(...result.errors);
  }

  const tables: Record<ValidatorKey, Table<unknown, string>> = {
    bloodAnalysis: db.bloodAnalyses as unknown as Table<unknown, string>,
    physicalActivity: db.physicalActivities as unknown as Table<unknown, string>,
    weightBMI: db.weightBMI as unknown as Table<unknown, string>,
    sleep: db.sleep as unknown as Table<unknown, string>,
    bloodPressure: db.bloodPressure as unknown as Table<unknown, string>,
    nutrition: db.nutrition as unknown as Table<unknown, string>,
    pollenAllergenScores: db.pollenAllergenScores as unknown as Table<unknown, string>,
  };

  let imported = 0;

  await db.transaction(
    'rw',
    [
      db.bloodAnalyses,
      db.physicalActivities,
      db.weightBMI,
      db.sleep,
      db.bloodPressure,
      db.nutrition,
      db.pollenAllergenScores,
    ],
    async () => {
      if (clearExisting) {
        for (const key of tableKeys) {
          await tables[key].clear();
        }
      }

      for (const key of tableKeys) {
        const entries = validatedData[key];
        if (entries && entries.length > 0) {
          let entriesToAdd = entries as unknown[];

          if (!clearExisting) {
            const seenKeys = new Set<string>();
            const uniqueEntries = entriesToAdd.filter((entry) => {
              const primaryKey = getEntryPrimaryKey(key, entry);
              if (seenKeys.has(primaryKey)) return false;
              seenKeys.add(primaryKey);
              return true;
            });
            const existingEntries = await tables[key].bulkGet(
              uniqueEntries.map((entry) => getEntryPrimaryKey(key, entry)),
            );
            entriesToAdd = uniqueEntries.filter(
              (_entry, index) => existingEntries[index] === undefined,
            );
          }

          if (entriesToAdd.length > 0) {
            await tables[key].bulkAdd(entriesToAdd);
            imported += entriesToAdd.length;
          }
        }
      }
    }
  );

  // Restaurer les settings depuis localStorage
  if (importData.settings) {
    restoreSettingsToLocalStorage(importData.settings);
  }

  return { imported, errors };
}
