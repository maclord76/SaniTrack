import { describe, expect, it } from 'vitest';
import { createBloodAnalysisFormSchema } from '../validators/form-schemas';
import {
  convertBloodAnalysisValue,
  convertBloodAnalysisValueForDisplay,
  convertBloodAnalysisValueForStorage,
} from '../utils/blood-analysis-units';

describe('blood analysis unit conversions', () => {
  it('converts cholesterol markers from mmol/L to mg/dL', () => {
    expect(convertBloodAnalysisValueForDisplay('tc', 5.2, 'mg/dL')).toBe(201.08);
    expect(convertBloodAnalysisValueForDisplay('hdl', 1.55, 'mg/dL')).toBe(59.94);
    expect(convertBloodAnalysisValueForDisplay('ldl', 2.6, 'mg/dL')).toBe(100.54);
  });

  it('uses the specific factors for triglycerides and glucose', () => {
    expect(convertBloodAnalysisValueForDisplay('tg', 1.7, 'mg/dL')).toBe(150.57);
    expect(convertBloodAnalysisValueForDisplay('glucose', 5.6, 'mg/dL')).toBe(100.9);
  });

  it('converts mg/dL input back to mmol/L for storage', () => {
    expect(convertBloodAnalysisValueForStorage('tc', 200, 'mg/dL')).toBeCloseTo(5.172, 3);
    expect(convertBloodAnalysisValueForStorage('tg', 150, 'mg/dL')).toBeCloseTo(1.6936, 4);
    expect(convertBloodAnalysisValueForStorage('glucose', 100, 'mg/dL')).toBeCloseTo(5.5499, 4);
  });

  it('does not convert the TC/HDL ratio', () => {
    expect(convertBloodAnalysisValue('tcHdlRatio', 3.5, 'mmol/L', 'mg/dL')).toBe(3.5);
  });
});

describe('blood analysis form validation by input unit', () => {
  const validBase = {
    date: '2026-07-20',
    tc: 200,
    hdl: 60,
    tg: 150,
    ldl: 100,
    tcHdlRatio: 3.3,
    glucose: 100,
  };

  it('accepts conventional mg/dL values', () => {
    expect(createBloodAnalysisFormSchema('mg/dL').safeParse(validBase).success).toBe(true);
  });

  it('keeps mmol/L maximums when that unit is selected', () => {
    const validMmolValues = {
      date: '2026-07-20',
      tc: 5,
      hdl: 1.5,
      tg: 1.7,
      ldl: 2.6,
      tcHdlRatio: 3.3,
      glucose: 5.6,
    };
    const schema = createBloodAnalysisFormSchema('mmol/L');

    expect(schema.safeParse(validMmolValues).success).toBe(true);
    expect(schema.safeParse({ ...validMmolValues, tc: 16 }).success).toBe(false);
  });
});
