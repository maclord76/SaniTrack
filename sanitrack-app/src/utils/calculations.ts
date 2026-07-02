export function calculateBMI(mass: number, heightCm: number): number {
  if (heightCm <= 0) {
    throw new Error('La taille doit être supérieure à zéro');
  }
  const heightM = heightCm / 100;
  return mass / (heightM * heightM);
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Insuffisance pondérale';
  if (bmi < 25) return 'Corpulence normale';
  if (bmi < 30) return 'Surpoids';
  if (bmi < 35) return 'Obésité classe I';
  if (bmi < 40) return 'Obésité classe II';
  return 'Obésité classe III';
}

export function calculateAveragePace(distanceKm: number, durationSeconds: number): number {
  if (distanceKm <= 0) {
    throw new Error('La distance doit être supérieure à zéro');
  }
  return durationSeconds / 60 / distanceKm;
}

export function calculateAverageSpeed(distanceKm: number, durationSeconds: number): number {
  if (durationSeconds <= 0) {
    throw new Error('La durée doit être supérieure à zéro');
  }
  return distanceKm / (durationSeconds / 3600);
}

export function calculateCalculatedLDL(tc: number, hdl: number, tg: number): number {
  return tc - hdl - tg / 2.2;
}

export function calculateSleepDebt(totalSleepMinutes: number, targetHours: number): number {
  const targetMinutes = targetHours * 60;
  return totalSleepMinutes - targetMinutes;
}

export interface SleepPhasesPercentages {
  deep: number;
  light: number;
  rem: number;
}

export function calculateSleepPhasesPercentages(
  total: number,
  deep: number,
  light: number,
  rem: number,
): SleepPhasesPercentages {
  if (total <= 0) {
    return { deep: 0, light: 0, rem: 0 };
  }
  return {
    deep: (deep / total) * 100,
    light: (light / total) * 100,
    rem: (rem / total) * 100,
  };
}

export interface MacroPercentages {
  proteins: number;
  lipids: number;
  carbs: number;
}

export function calculateMacroPercentages(
  calories: number,
  proteins: number,
  lipids: number,
  carbs: number,
): MacroPercentages {
  if (calories <= 0) {
    return { proteins: 0, lipids: 0, carbs: 0 };
  }
  const proteinCalories = proteins * 4;
  const lipidCalories = lipids * 9;
  const carbCalories = carbs * 4;
  const totalMacroCalories = proteinCalories + lipidCalories + carbCalories;

  if (totalMacroCalories <= 0) {
    return { proteins: 0, lipids: 0, carbs: 0 };
  }

  return {
    proteins: (proteinCalories / totalMacroCalories) * 100,
    lipids: (lipidCalories / totalMacroCalories) * 100,
    carbs: (carbCalories / totalMacroCalories) * 100,
  };
}

export function calculateMovingAverage(data: number[], window: number): number[] {
  if (window <= 0) {
    throw new Error('La fenêtre doit être supérieure à zéro');
  }
  if (data.length < window) {
    return [];
  }
  const result: number[] = [];
  for (let i = window - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < window; j++) {
      sum += data[i - j];
    }
    result.push(sum / window);
  }
  return result;
}