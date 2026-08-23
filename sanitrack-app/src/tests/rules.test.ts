import { describe, it, expect } from 'vitest';
import { evaluateField, evaluateBloodAnalysis, evaluateBloodPressure, evaluateBMI, evaluateSleep, HealthZone } from '../engine/rules';
import type { BloodAnalysis, BloodPressure, WeightBMI, Sleep } from '../models/types';

const makeBloodAnalysis = (overrides: Partial<BloodAnalysis> = {}): BloodAnalysis => ({
  id: 'test-id',
  date: '2026-01-01T00:00:00Z',
  tc: 5.0,
  hdl: 1.5,
  tg: 1.5,
  ldl: 2.8,
  tcHdlRatio: 3.33,
  glucose: 5.0,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeBloodPressure = (overrides: Partial<BloodPressure> = {}): BloodPressure => ({
  id: 'test-id',
  date: '2026-01-01T00:00:00Z',
  systolic: 120,
  diastolic: 80,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeWeightBMI = (overrides: Partial<WeightBMI> = {}): WeightBMI => ({
  id: 'test-id',
  date: '2026-01-01T00:00:00Z',
  mass: 70,
  height: 175,
  bmi: 22.86,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeSleep = (overrides: Partial<Sleep> = {}): Sleep => ({
  id: 'test-id',
  date: '2026-01-01T00:00:00Z',
  totalSleep: 480,
  deepSleep: 96,
  lightSleep: 288,
  remSleep: 96,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('evaluateField - cholesterol (tc)', () => {
  it('returns Normal for desirable cholesterol', () => {
    const result = evaluateField('tc', 4.5);
    expect(result.zone).toBe(HealthZone.Normal);
    expect(result.label).toBe('Désirable');
  });

  it('returns Borderline for borderline high cholesterol', () => {
    const result = evaluateField('tc', 5.5);
    expect(result.zone).toBe(HealthZone.Borderline);
    expect(result.label).toBe('Limite élevé');
  });

  it('returns Elevated for high cholesterol', () => {
    const result = evaluateField('tc', 6.5);
    expect(result.zone).toBe(HealthZone.Elevated);
    expect(result.label).toBe('Élevé');
  });

  it('returns Normal at exact boundary 5.2', () => {
    const result = evaluateField('tc', 5.2);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Borderline at exact boundary 6.2', () => {
    const result = evaluateField('tc', 6.2);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Normal for zero cholesterol', () => {
    const result = evaluateField('tc', 0);
    expect(result.zone).toBe(HealthZone.Normal);
  });
});

describe('evaluateField - HDL', () => {
  it('returns Normal for optimal HDL', () => {
    const result = evaluateField('hdl', 1.8);
    expect(result.zone).toBe(HealthZone.Normal);
    expect(result.label).toBe('Optimal');
  });

  it('returns Borderline for low HDL', () => {
    const result = evaluateField('hdl', 1.2);
    expect(result.zone).toBe(HealthZone.Borderline);
    expect(result.label).toBe('Bas');
  });

  it('returns Elevated for very low HDL', () => {
    const result = evaluateField('hdl', 0.7);
    expect(result.zone).toBe(HealthZone.Elevated);
    expect(result.label).toBe('Très bas');
  });

  it('returns Borderline at exact boundary 1.0', () => {
    const result = evaluateField('hdl', 1.0);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Normal at exact boundary 1.55', () => {
    const result = evaluateField('hdl', 1.55);
    expect(result.zone).toBe(HealthZone.Normal);
  });
});

describe('evaluateField - LDL', () => {
  it('returns Normal for optimal LDL', () => {
    const result = evaluateField('ldl', 2.0);
    expect(result.zone).toBe(HealthZone.Normal);
  });

  it('returns Borderline for near optimal LDL', () => {
    const result = evaluateField('ldl', 3.0);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated for high LDL', () => {
    const result = evaluateField('ldl', 3.8);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Critical for very high LDL', () => {
    const result = evaluateField('ldl', 4.5);
    expect(result.zone).toBe(HealthZone.Critical);
  });

  it('returns Borderline at exact boundary 2.6', () => {
    const result = evaluateField('ldl', 2.6);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated at exact boundary 3.4', () => {
    const result = evaluateField('ldl', 3.4);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Critical at exact boundary 4.1', () => {
    const result = evaluateField('ldl', 4.1);
    expect(result.zone).toBe(HealthZone.Critical);
  });
});

describe('evaluateField - triglycerides (tg)', () => {
  it('returns Normal for normal TG', () => {
    const result = evaluateField('tg', 1.2);
    expect(result.zone).toBe(HealthZone.Normal);
  });

  it('returns Borderline for borderline high TG', () => {
    const result = evaluateField('tg', 2.0);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated for high TG', () => {
    const result = evaluateField('tg', 2.5);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Borderline at exact boundary 1.7', () => {
    const result = evaluateField('tg', 1.7);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated at exact boundary 2.3', () => {
    const result = evaluateField('tg', 2.3);
    expect(result.zone).toBe(HealthZone.Elevated);
  });
});

describe('evaluateField - glucose', () => {
  it('returns Normal for normal glucose', () => {
    const result = evaluateField('glucose', 5.0);
    expect(result.zone).toBe(HealthZone.Normal);
  });

  it('returns Borderline for impaired fasting glucose', () => {
    const result = evaluateField('glucose', 6.0);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated for diabetic range glucose', () => {
    const result = evaluateField('glucose', 8.0);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Borderline at exact boundary 5.6', () => {
    const result = evaluateField('glucose', 5.6);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated at exact boundary 7.0', () => {
    const result = evaluateField('glucose', 7.0);
    expect(result.zone).toBe(HealthZone.Elevated);
  });
});

describe('evaluateField - BMI', () => {
  it('returns Elevated for underweight BMI', () => {
    const result = evaluateField('bmi', 17);
    expect(result.zone).toBe(HealthZone.Elevated);
    expect(result.label).toBe('Insuffisance pondérale');
  });

  it('returns Normal for normal BMI', () => {
    const result = evaluateField('bmi', 22);
    expect(result.zone).toBe(HealthZone.Normal);
  });

  it('returns Borderline for overweight BMI', () => {
    const result = evaluateField('bmi', 27);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated for obese class I BMI', () => {
    const result = evaluateField('bmi', 32);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Critical for obese class III BMI', () => {
    const result = evaluateField('bmi', 45);
    expect(result.zone).toBe(HealthZone.Critical);
  });

  it('returns Normal at exact boundary 18.5', () => {
    const result = evaluateField('bmi', 18.5);
    expect(result.zone).toBe(HealthZone.Normal);
  });

  it('returns Borderline at exact boundary 25', () => {
    const result = evaluateField('bmi', 25);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated at exact boundary 30', () => {
    const result = evaluateField('bmi', 30);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Elevated at exact boundary 35', () => {
    const result = evaluateField('bmi', 35);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Critical at exact boundary 40', () => {
    const result = evaluateField('bmi', 40);
    expect(result.zone).toBe(HealthZone.Critical);
  });
});

describe('evaluateBloodPressure', () => {
  it('evaluates optimal blood pressure', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 110, diastolic: 70 }));
    expect(result.systolic.zone).toBe(HealthZone.Normal);
    expect(result.diastolic.zone).toBe(HealthZone.Normal);
    expect(result.combinedZone).toBe(HealthZone.Normal);
  });

  it('evaluates high normal blood pressure', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 135, diastolic: 88 }));
    expect(result.systolic.zone).toBe(HealthZone.Borderline);
    expect(result.diastolic.zone).toBe(HealthZone.Borderline);
    expect(result.combinedZone).toBe(HealthZone.Borderline);
  });

  it('evaluates hypertensive blood pressure', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 150, diastolic: 95 }));
    expect(result.systolic.zone).toBe(HealthZone.Elevated);
    expect(result.diastolic.zone).toBe(HealthZone.Elevated);
    expect(result.combinedZone).toBe(HealthZone.Elevated);
  });

  it('evaluates critical blood pressure', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 190, diastolic: 115 }));
    expect(result.systolic.zone).toBe(HealthZone.Critical);
    expect(result.diastolic.zone).toBe(HealthZone.Critical);
    expect(result.combinedZone).toBe(HealthZone.Critical);
  });

  it('combined zone takes worst of systolic/diastolic', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 110, diastolic: 95 }));
    expect(result.systolic.zone).toBe(HealthZone.Normal);
    expect(result.diastolic.zone).toBe(HealthZone.Elevated);
    expect(result.combinedZone).toBe(HealthZone.Elevated);
  });

  it('evaluates systolic boundary 120', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 120, diastolic: 80 }));
    expect(result.systolic.label).toBe('Normal');
  });

  it('evaluates systolic boundary 130', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 130, diastolic: 80 }));
    expect(result.systolic.zone).toBe(HealthZone.Borderline);
  });

  it('evaluates diastolic boundary 80', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 110, diastolic: 80 }));
    expect(result.diastolic.label).toBe('Normal');
  });

  it('evaluates diastolic boundary 85', () => {
    const result = evaluateBloodPressure(makeBloodPressure({ systolic: 110, diastolic: 85 }));
    expect(result.diastolic.zone).toBe(HealthZone.Borderline);
  });
});

describe('evaluateBloodAnalysis', () => {
  it('evaluates all fields', () => {
    const analysis = makeBloodAnalysis();
    const result = evaluateBloodAnalysis(analysis);
    expect(result.tc).toBeDefined();
    expect(result.hdl).toBeDefined();
    expect(result.tg).toBeDefined();
    expect(result.ldl).toBeDefined();
    expect(result.tcHdlRatio).toBeDefined();
    expect(result.glucose).toBeDefined();
  });

  it('evaluates normal analysis', () => {
    const result = evaluateBloodAnalysis(makeBloodAnalysis({
      tc: 4.5, hdl: 1.8, tg: 1.0, ldl: 2.0, tcHdlRatio: 2.5, glucose: 5.0,
    }));
    expect(result.tc.zone).toBe(HealthZone.Normal);
    expect(result.hdl.zone).toBe(HealthZone.Normal);
    expect(result.glucose.zone).toBe(HealthZone.Normal);
  });

  it('evaluates abnormal analysis', () => {
    const result = evaluateBloodAnalysis(makeBloodAnalysis({
      tc: 7.0, hdl: 0.8, tg: 2.5, ldl: 4.5, tcHdlRatio: 8.75, glucose: 8.0,
    }));
    expect(result.tc.zone).toBe(HealthZone.Elevated);
    expect(result.hdl.zone).toBe(HealthZone.Elevated);
    expect(result.tg.zone).toBe(HealthZone.Elevated);
    expect(result.ldl.zone).toBe(HealthZone.Critical);
    expect(result.glucose.zone).toBe(HealthZone.Elevated);
  });
});

describe('evaluateBMI', () => {
  it('evaluates normal BMI', () => {
    const result = evaluateBMI(makeWeightBMI({ bmi: 22 }));
    expect(result.bmi.zone).toBe(HealthZone.Normal);
  });

  it('evaluates overweight BMI', () => {
    const result = evaluateBMI(makeWeightBMI({ bmi: 27 }));
    expect(result.bmi.zone).toBe(HealthZone.Borderline);
  });

  it('evaluates underweight BMI', () => {
    const result = evaluateBMI(makeWeightBMI({ bmi: 17 }));
    expect(result.bmi.zone).toBe(HealthZone.Elevated);
  });

  it('evaluates obese BMI', () => {
    const result = evaluateBMI(makeWeightBMI({ bmi: 32 }));
    expect(result.bmi.zone).toBe(HealthZone.Elevated);
  });
});

describe('evaluateSleep', () => {
  it('evaluates normal sleep', () => {
    const result = evaluateSleep(makeSleep());
    expect(result.totalSleep.zone).toBe(HealthZone.Normal);
  });

  it('evaluates insufficient sleep', () => {
    const result = evaluateSleep(makeSleep({ totalSleep: 300, deepSleep: 30, remSleep: 30 }));
    expect(result.totalSleep.zone).toBe(HealthZone.Critical);
  });

  it('evaluates excessive sleep', () => {
    const result = evaluateSleep(makeSleep({ totalSleep: 660, deepSleep: 130, remSleep: 130 }));
    expect(result.totalSleep.zone).toBe(HealthZone.Elevated);
  });

  it('overall zone is worst of individual zones', () => {
    const result = evaluateSleep(makeSleep({ totalSleep: 480, deepSleep: 30, remSleep: 96 }));
    expect(result.deepSleep.zone).toBe(HealthZone.Borderline);
    expect(result.totalSleep.zone).toBe(HealthZone.Normal);
    expect(result.overallZone).toBe(HealthZone.Borderline);
  });
});

describe('evaluateField - unknown field', () => {
  it('returns unknown result for invalid field', () => {
    const result = evaluateField('unknownField', 5.0);
    expect(result.zone).toBe(HealthZone.Normal);
    expect(result.label).toBe('Inconnu');
  });
});

describe('evaluateField - tcHdlRatio', () => {
  it('returns Normal for low risk ratio', () => {
    const result = evaluateField('tcHdlRatio', 2.5);
    expect(result.zone).toBe(HealthZone.Normal);
  });

  it('returns Borderline for moderate risk ratio', () => {
    const result = evaluateField('tcHdlRatio', 4.0);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated for high risk ratio', () => {
    const result = evaluateField('tcHdlRatio', 6.0);
    expect(result.zone).toBe(HealthZone.Elevated);
  });

  it('returns Borderline at exact boundary 3.5', () => {
    const result = evaluateField('tcHdlRatio', 3.5);
    expect(result.zone).toBe(HealthZone.Borderline);
  });

  it('returns Elevated at exact boundary 5.0', () => {
    const result = evaluateField('tcHdlRatio', 5.0);
    expect(result.zone).toBe(HealthZone.Elevated);
  });
});
