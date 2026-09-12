export type BloodAnalysisConcentrationField = 'tc' | 'hdl' | 'tg' | 'ldl' | 'glucose';
export type BloodAnalysisDisplayField = BloodAnalysisConcentrationField | 'tcHdlRatio';
export type BloodAnalysisUnit = 'mmol/L' | 'mg/dL';

export const bloodAnalysisConcentrationFields: BloodAnalysisConcentrationField[] = [
  'tc',
  'hdl',
  'tg',
  'ldl',
  'glucose',
];

// Conversion factors recommended for conventional mass/molar concentration
// conversions. Triglycerides and glucose have different molar masses from
// cholesterol, so a single factor cannot be used for every marker.
const mgDlPerMmolL: Record<BloodAnalysisConcentrationField, number> = {
  tc: 38.67,
  hdl: 38.67,
  tg: 88.57,
  ldl: 38.67,
  glucose: 18.0182,
};

export function convertBloodAnalysisValue(
  field: BloodAnalysisDisplayField,
  value: number,
  from: BloodAnalysisUnit,
  to: BloodAnalysisUnit,
): number {
  if (field === 'tcHdlRatio' || from === to) return value;

  const factor = mgDlPerMmolL[field];
  return from === 'mmol/L' ? value * factor : value / factor;
}

export function roundBloodAnalysisValue(value: number, decimals = 2): number {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

export function convertBloodAnalysisValueForDisplay(
  field: BloodAnalysisDisplayField,
  value: number,
  unit: BloodAnalysisUnit,
): number {
  return roundBloodAnalysisValue(convertBloodAnalysisValue(field, value, 'mmol/L', unit));
}

export function convertBloodAnalysisValueForStorage(
  field: BloodAnalysisDisplayField,
  value: number,
  inputUnit: BloodAnalysisUnit,
): number {
  return roundBloodAnalysisValue(convertBloodAnalysisValue(field, value, inputUnit, 'mmol/L'), 4);
}

export function getBloodAnalysisUnit(field: BloodAnalysisDisplayField, unit: BloodAnalysisUnit): string {
  return field === 'tcHdlRatio' ? 'rapport' : unit;
}
