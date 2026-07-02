import { describe, it, expect } from 'vitest';
import {
  calculateBMI,
  getBMICategory,
  calculateAveragePace,
  calculateAverageSpeed,
  calculateCalculatedLDL,
  calculateSleepDebt,
  calculateSleepPhasesPercentages,
  calculateMacroPercentages,
  calculateMovingAverage,
} from '../utils/calculations';

describe('calculateBMI', () => {
  it('calculates BMI for normal values', () => {
    expect(calculateBMI(70, 175)).toBeCloseTo(22.857, 3);
  });

  it('calculates BMI for underweight person', () => {
    expect(calculateBMI(45, 170)).toBeCloseTo(15.57, 2);
  });

  it('calculates BMI for obese person', () => {
    expect(calculateBMI(110, 170)).toBeCloseTo(38.06, 2);
  });

  it('throws error for zero height', () => {
    expect(() => calculateBMI(70, 0)).toThrow('Height must be greater than zero');
  });

  it('throws error for negative height', () => {
    expect(() => calculateBMI(70, -10)).toThrow('Height must be greater than zero');
  });
});

describe('getBMICategory', () => {
  it('returns Underweight for BMI < 18.5', () => {
    expect(getBMICategory(17)).toBe('Underweight');
  });

  it('returns Underweight at BMI 18.4', () => {
    expect(getBMICategory(18.4)).toBe('Underweight');
  });

  it('returns Normal weight for BMI 18.5', () => {
    expect(getBMICategory(18.5)).toBe('Normal weight');
  });

  it('returns Normal weight for BMI 24.9', () => {
    expect(getBMICategory(24.9)).toBe('Normal weight');
  });

  it('returns Overweight for BMI 25', () => {
    expect(getBMICategory(25)).toBe('Overweight');
  });

  it('returns Overweight for BMI 29.9', () => {
    expect(getBMICategory(29.9)).toBe('Overweight');
  });

  it('returns Obese class I for BMI 30', () => {
    expect(getBMICategory(30)).toBe('Obese class I');
  });

  it('returns Obese class I for BMI 34.9', () => {
    expect(getBMICategory(34.9)).toBe('Obese class I');
  });

  it('returns Obese class II for BMI 35', () => {
    expect(getBMICategory(35)).toBe('Obese class II');
  });

  it('returns Obese class II for BMI 39.9', () => {
    expect(getBMICategory(39.9)).toBe('Obese class II');
  });

  it('returns Obese class III for BMI 40', () => {
    expect(getBMICategory(40)).toBe('Obese class III');
  });

  it('returns Obese class III for BMI 50', () => {
    expect(getBMICategory(50)).toBe('Obese class III');
  });
});

describe('calculateAveragePace', () => {
  it('calculates pace for 10km in 3600s (1 hour)', () => {
    expect(calculateAveragePace(10, 3600)).toBeCloseTo(6, 1);
  });

  it('calculates pace for 5km in 1500s (25 min)', () => {
    expect(calculateAveragePace(5, 1500)).toBeCloseTo(5, 1);
  });

  it('calculates pace for 42.195km marathon', () => {
    const pace = calculateAveragePace(42.195, 14400);
    expect(pace).toBeCloseTo(5.68, 1);
  });

  it('throws error for zero distance', () => {
    expect(() => calculateAveragePace(0, 3600)).toThrow('Distance must be greater than zero');
  });

  it('throws error for negative distance', () => {
    expect(() => calculateAveragePace(-5, 3600)).toThrow('Distance must be greater than zero');
  });
});

describe('calculateAverageSpeed', () => {
  it('calculates speed for 10km in 1 hour', () => {
    expect(calculateAverageSpeed(10, 3600)).toBeCloseTo(10, 1);
  });

  it('calculates speed for 5km in 25 min', () => {
    expect(calculateAverageSpeed(5, 1500)).toBeCloseTo(12, 1);
  });

  it('throws error for zero duration', () => {
    expect(() => calculateAverageSpeed(10, 0)).toThrow('Duration must be greater than zero');
  });

  it('throws error for negative duration', () => {
    expect(() => calculateAverageSpeed(10, -100)).toThrow('Duration must be greater than zero');
  });
});

describe('calculateCalculatedLDL', () => {
  it('calculates LDL using Friedewald formula', () => {
    expect(calculateCalculatedLDL(5.0, 1.5, 1.5)).toBeCloseTo(2.818, 2);
  });

  it('calculates LDL for normal values', () => {
    const result = calculateCalculatedLDL(4.5, 1.2, 1.0);
    expect(result).toBeCloseTo(2.845, 2);
  });

  it('calculates LDL at boundary thresholds', () => {
    const result = calculateCalculatedLDL(5.2, 1.0, 1.7);
    expect(result).toBeCloseTo(3.427, 2);
  });

  it('handles zero triglycerides', () => {
    expect(calculateCalculatedLDL(4.0, 1.0, 0)).toBeCloseTo(3.0, 1);
  });

  it('handles high triglycerides', () => {
    const result = calculateCalculatedLDL(6.0, 1.0, 4.4);
    expect(result).toBeCloseTo(3.0, 1);
  });
});

describe('calculateSleepDebt', () => {
  it('returns positive value when sleeping more than target', () => {
    expect(calculateSleepDebt(540, 8)).toBe(60);
  });

  it('returns negative value when sleeping less than target', () => {
    expect(calculateSleepDebt(360, 8)).toBe(-120);
  });

  it('returns zero when sleeping exactly the target', () => {
    expect(calculateSleepDebt(480, 8)).toBe(0);
  });

  it('handles fractional target hours', () => {
    expect(calculateSleepDebt(480, 7.5)).toBe(30);
  });

  it('handles zero sleep', () => {
    expect(calculateSleepDebt(0, 8)).toBe(-480);
  });
});

describe('calculateSleepPhasesPercentages', () => {
  it('calculates percentages for balanced sleep', () => {
    const result = calculateSleepPhasesPercentages(480, 96, 288, 96);
    expect(result.deep).toBeCloseTo(20, 1);
    expect(result.light).toBeCloseTo(60, 1);
    expect(result.rem).toBeCloseTo(20, 1);
  });

  it('returns zeros for zero total', () => {
    const result = calculateSleepPhasesPercentages(0, 0, 0, 0);
    expect(result.deep).toBe(0);
    expect(result.light).toBe(0);
    expect(result.rem).toBe(0);
  });

  it('handles single dominant phase', () => {
    const result = calculateSleepPhasesPercentages(480, 480, 0, 0);
    expect(result.deep).toBeCloseTo(100, 1);
    expect(result.light).toBe(0);
    expect(result.rem).toBe(0);
  });

  it('calculates percentages for typical sleep pattern', () => {
    const result = calculateSleepPhasesPercentages(420, 84, 231, 105);
    expect(result.deep).toBeCloseTo(20, 0);
    expect(result.light).toBeCloseTo(55, 0);
    expect(result.rem).toBeCloseTo(25, 0);
  });
});

describe('calculateMacroPercentages', () => {
  it('calculates percentages for balanced macros', () => {
    const result = calculateMacroPercentages(2000, 50, 44, 250);
    const proteinCal = 50 * 4;
    const lipidCal = 44 * 9;
    const carbCal = 250 * 4;
    const total = proteinCal + lipidCal + carbCal;
    expect(result.proteins).toBeCloseTo((proteinCal / total) * 100, 1);
    expect(result.lipids).toBeCloseTo((lipidCal / total) * 100, 1);
    expect(result.carbs).toBeCloseTo((carbCal / total) * 100, 1);
  });

  it('returns zeros for zero calories', () => {
    const result = calculateMacroPercentages(0, 10, 10, 10);
    expect(result.proteins).toBe(0);
    expect(result.lipids).toBe(0);
    expect(result.carbs).toBe(0);
  });

  it('returns zeros for zero macros', () => {
    const result = calculateMacroPercentages(2000, 0, 0, 0);
    expect(result.proteins).toBe(0);
    expect(result.lipids).toBe(0);
    expect(result.carbs).toBe(0);
  });

  it('handles protein-only macros', () => {
    const result = calculateMacroPercentages(800, 200, 0, 0);
    expect(result.proteins).toBeCloseTo(100, 1);
    expect(result.lipids).toBe(0);
    expect(result.carbs).toBe(0);
  });

  it('sum of percentages is approximately 100', () => {
    const result = calculateMacroPercentages(2000, 100, 55, 275);
    const total = result.proteins + result.lipids + result.carbs;
    expect(total).toBeCloseTo(100, 0);
  });
});

describe('calculateMovingAverage', () => {
  it('calculates simple moving average with window 3', () => {
    const data = [1, 2, 3, 4, 5];
    const result = calculateMovingAverage(data, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(2, 10);
    expect(result[1]).toBeCloseTo(3, 10);
    expect(result[2]).toBeCloseTo(4, 10);
  });

  it('returns single value for window equal to data length', () => {
    const data = [2, 4, 6];
    const result = calculateMovingAverage(data, 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(4, 10);
  });

  it('returns empty array when data length is less than window', () => {
    const data = [1, 2];
    const result = calculateMovingAverage(data, 3);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty data', () => {
    const result = calculateMovingAverage([], 3);
    expect(result).toHaveLength(0);
  });

  it('throws error for zero window', () => {
    expect(() => calculateMovingAverage([1, 2, 3], 0)).toThrow('Window must be greater than zero');
  });

  it('throws error for negative window', () => {
    expect(() => calculateMovingAverage([1, 2, 3], -1)).toThrow('Window must be greater than zero');
  });

  it('calculates moving average with window 1', () => {
    const data = [10, 20, 30];
    const result = calculateMovingAverage(data, 1);
    expect(result).toEqual([10, 20, 30]);
  });

  it('calculates moving average with large window', () => {
    const data = [1, 3, 5, 7, 9];
    const result = calculateMovingAverage(data, 5);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(5, 10);
  });
});