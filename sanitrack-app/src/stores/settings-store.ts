import { create } from 'zustand';

export interface ThresholdBound {
  value: number;
  label: string;
}

export interface ThresholdConfig {
  key: string;
  name: string;
  unit: string;
  bounds: ThresholdBound[];
}

const defaultThresholds: ThresholdConfig[] = [
  { key: 'tc', name: 'Cholestérol total', unit: 'mmol/L', bounds: [
    { value: 5.2, label: 'Désirable' },
    { value: 6.2, label: 'Élevé' },
  ]},
  { key: 'hdl', name: 'Bon cholestérol (HDL)', unit: 'mmol/L', bounds: [
    { value: 1.0, label: 'Bas' },
    { value: 1.55, label: 'Optimal' },
  ]},
  { key: 'tg', name: 'Triglycérides', unit: 'mmol/L', bounds: [
    { value: 1.7, label: 'Normal' },
    { value: 2.3, label: 'Élevé' },
  ]},
  { key: 'ldl', name: 'Mauvais cholestérol (LDL)', unit: 'mmol/L', bounds: [
    { value: 2.6, label: 'Optimal' },
    { value: 3.4, label: 'Élevé' },
    { value: 4.1, label: 'Très élevé' },
  ]},
  { key: 'tcHdlRatio', name: 'Rapport TC/HDL', unit: 'rapport', bounds: [
    { value: 3.5, label: 'Risque faible' },
    { value: 5, label: 'Risque élevé' },
  ]},
  { key: 'glucose', name: 'Glucose', unit: 'mmol/L', bounds: [
    { value: 5.6, label: 'Normal' },
    { value: 7.0, label: 'Diabétique' },
  ]},
  { key: 'bmi', name: 'IMC', unit: 'kg/m²', bounds: [
    { value: 18.5, label: 'Insuffisance pondérale' },
    { value: 25, label: 'Normal' },
    { value: 30, label: 'Surpoids' },
    { value: 35, label: 'Obésité classe I' },
    { value: 40, label: 'Obésité classe II' },
  ]},
  { key: 'systolic', name: 'Pression systolique', unit: 'mmHg', bounds: [
    { value: 120, label: 'Optimal' },
    { value: 130, label: 'Normal' },
    { value: 140, label: 'Normal élevé' },
    { value: 160, label: 'HTA stade 1' },
    { value: 180, label: 'HTA stade 2' },
  ]},
  { key: 'diastolic', name: 'Pression diastolique', unit: 'mmHg', bounds: [
    { value: 80, label: 'Optimal' },
    { value: 85, label: 'Normal' },
    { value: 90, label: 'Normal élevé' },
    { value: 100, label: 'HTA stade 1' },
    { value: 110, label: 'HTA stade 2' },
  ]},
  { key: 'pulse', name: 'Pouls', unit: 'bpm', bounds: [
    { value: 60, label: 'Normal' },
    { value: 100, label: 'Tachycardie' },
  ]},
  { key: 'sleepTotal', name: 'Sommeil total', unit: 'min', bounds: [
    { value: 360, label: 'En dessous' },
    { value: 420, label: 'Recommandé min' },
    { value: 540, label: 'Recommandé max' },
    { value: 600, label: 'Excessif' },
  ]},
  { key: 'sleepDeep', name: 'Sommeil profond', unit: 'min', bounds: [
    { value: 60, label: 'Insuffisant' },
    { value: 120, label: 'Adéquat' },
  ]},
  { key: 'sleepRem', name: 'Sommeil paradoxal', unit: 'min', bounds: [
    { value: 60, label: 'Insuffisant' },
    { value: 120, label: 'Adéquat' },
  ]},
];

export type Sex = 'male' | 'female' | 'unspecified';

export type Lifestyle = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'intensely_active';

export const lifestyleOptions: { value: Lifestyle; label: string; coefficient: number }[] = [
  { value: 'sedentary', label: 'Sédentaire (pas ou peu d\'exercice)', coefficient: 1.2 },
  { value: 'lightly_active', label: 'Légèrement actif (exercices légers ou sport 1 à 3 fois par semaine)', coefficient: 1.375 },
  { value: 'moderately_active', label: 'Modérément actif (exercices modérés 3 à 5 fois par semaine)', coefficient: 1.55 },
  { value: 'very_active', label: 'Très actif (exercices soutenus 6 à 7 fois par semaine)', coefficient: 1.725 },
  { value: 'intensely_active', label: 'Intensément actif (exercices intenses et métier physique)', coefficient: 1.9 },
];

export function getLifestyleCoefficient(lifestyle: Lifestyle): number {
  const opt = lifestyleOptions.find((o) => o.value === lifestyle);
  return opt?.coefficient ?? 1.2;
}

export function getStoredSettings(): { height: number; weight: number; sex: Sex; age: number; lifestyle: Lifestyle; metabolismeBase: number | null; besoins: number | null; thresholds: ThresholdConfig[]; atmoLogin?: string; atmoPassword?: string; atmoLocation?: string } {
  const defaults = {
    height: localStorage.getItem('settings_height') ? Number(localStorage.getItem('settings_height')) : 170,
    weight: localStorage.getItem('settings_weight') ? Number(localStorage.getItem('settings_weight')) : 70,
    sex: (localStorage.getItem('settings_sex') as Sex | null) ?? 'unspecified',
    age: localStorage.getItem('settings_age') ? Number(localStorage.getItem('settings_age')) : 30,
    lifestyle: (localStorage.getItem('settings_lifestyle') as Lifestyle | null) ?? 'sedentary',
    metabolismeBase: localStorage.getItem('settings_metabolisme_base') ? Number(localStorage.getItem('settings_metabolisme_base')) : null,
    besoins: localStorage.getItem('settings_besoins') ? Number(localStorage.getItem('settings_besoins')) : null,
    thresholds: defaultThresholds,
    atmoLogin: localStorage.getItem('settings_atmo_login') ?? undefined,
    atmoPassword: localStorage.getItem('settings_atmo_password') ?? undefined,
    atmoLocation: localStorage.getItem('settings_atmo_location') ?? undefined,
  };
  try {
    const stored = localStorage.getItem('settings_thresholds');
    if (stored) {
      const parsed = JSON.parse(stored) as ThresholdConfig[];
      return { ...defaults, thresholds: parsed };
    }
  } catch {
    // ignore
  }
  return defaults;
}

export function calcHarrisBenedict(sex: Sex, weight: number, height: number, age: number): number | null {
  if (sex === 'male') {
    return Math.round(88.362 + 13.397 * weight + 4.799 * height - 5.677 * age);
  }
  if (sex === 'female') {
    return Math.round(447.593 + 9.247 * weight + 3.098 * height - 4.330 * age);
  }
  return null;
}

function saveThresholds(thresholds: ThresholdConfig[]) {
  localStorage.setItem('settings_thresholds', JSON.stringify(thresholds));
}

function saveHeight(height: number) {
  localStorage.setItem('settings_height', String(height));
}

function saveSex(sex: Sex) {
  localStorage.setItem('settings_sex', sex);
}

function saveAge(age: number) {
  localStorage.setItem('settings_age', String(age));
}

function saveWeight(weight: number) {
  localStorage.setItem('settings_weight', String(weight));
}

function saveLifestyle(lifestyle: Lifestyle) {
  localStorage.setItem('settings_lifestyle', lifestyle);
}

function saveMetabolismeBase(value: number | null) {
  if (value !== null) {
    localStorage.setItem('settings_metabolisme_base', String(value));
  } else {
    localStorage.removeItem('settings_metabolisme_base');
  }
}

function saveBesoins(value: number | null) {
  if (value !== null) {
    localStorage.setItem('settings_besoins', String(value));
  } else {
    localStorage.removeItem('settings_besoins');
  }
}

interface SettingsState {
  height: number;
  weight: number;
  sex: Sex;
  age: number;
  lifestyle: Lifestyle;
  metabolismeBase: number | null;
  besoins: number | null;
  thresholds: ThresholdConfig[];
  atmoLogin?: string;
  atmoPassword?: string;
  atmoLocation?: string;
}

interface SettingsActions {
  setHeight: (height: number) => void;
  setWeight: (weight: number) => void;
  setSex: (sex: Sex) => void;
  setAge: (age: number) => void;
  setLifestyle: (lifestyle: Lifestyle) => void;
  setMetabolismeBase: (value: number | null) => void;
  setBesoins: (value: number | null) => void;
  setThresholds: (thresholds: ThresholdConfig[]) => void;
  updateThresholdBound: (key: string, index: number, value: number) => void;
  resetThresholds: () => void;
  loadSettings: () => void;
  setAtmoLogin: (login: string) => void;
  setAtmoPassword: (password: string) => void;
  setAtmoLocation: (location: string) => void;
}

export type SettingsStore = SettingsState & { actions: SettingsActions };

const initialSettings = getStoredSettings();

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  height: initialSettings.height,
  weight: initialSettings.weight,
  sex: initialSettings.sex,
  age: initialSettings.age,
  lifestyle: initialSettings.lifestyle,
  metabolismeBase: initialSettings.metabolismeBase,
  besoins: initialSettings.besoins,
  thresholds: initialSettings.thresholds,
  atmoLogin: initialSettings.atmoLogin,
  atmoPassword: initialSettings.atmoPassword,
  atmoLocation: initialSettings.atmoLocation,

  actions: {
    setHeight: (height: number) => {
      set({ height });
      saveHeight(height);
    },

    setSex: (sex: Sex) => {
      set({ sex });
      saveSex(sex);
    },

    setAge: (age: number) => {
      set({ age });
      saveAge(age);
    },

    setWeight: (weight: number) => {
      set({ weight });
      saveWeight(weight);
    },

    setLifestyle: (lifestyle: Lifestyle) => {
      set({ lifestyle });
      saveLifestyle(lifestyle);
    },

    setMetabolismeBase: (value: number | null) => {
      set({ metabolismeBase: value });
      saveMetabolismeBase(value);
    },

    setBesoins: (value: number | null) => {
      set({ besoins: value });
      saveBesoins(value);
    },

    setThresholds: (thresholds: ThresholdConfig[]) => {
      set({ thresholds });
      saveThresholds(thresholds);
    },

    updateThresholdBound: (key: string, index: number, value: number) => {
      const thresholds = get().thresholds.map((t) => {
        if (t.key === key) {
          const bounds = [...t.bounds];
          bounds[index] = { ...bounds[index], value };
          return { ...t, bounds };
        }
        return t;
      });
      set({ thresholds });
      saveThresholds(thresholds);
    },

    resetThresholds: () => {
      set({ thresholds: defaultThresholds });
      saveThresholds(defaultThresholds);
    },

    loadSettings: () => {
      const stored = getStoredSettings();
      set({ height: stored.height, weight: stored.weight, sex: stored.sex, age: stored.age, lifestyle: stored.lifestyle, metabolismeBase: stored.metabolismeBase, besoins: stored.besoins, thresholds: stored.thresholds, atmoLogin: stored.atmoLogin, atmoPassword: stored.atmoPassword, atmoLocation: stored.atmoLocation });
    },

    setAtmoLogin: (login: string) => {
      set({ atmoLogin: login });
      localStorage.setItem('settings_atmo_login', login);
    },

    setAtmoPassword: (password: string) => {
      set({ atmoPassword: password });
      localStorage.setItem('settings_atmo_password', password);
    },

    setAtmoLocation: (location: string) => {
      set({ atmoLocation: location });
      localStorage.setItem('settings_atmo_location', location);
    },
  },
}));

export { defaultThresholds };