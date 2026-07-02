import { HealthZone } from '../models/types';
import type {
  BloodAnalysis,
  BloodPressure,
  WeightBMI,
  Sleep,
} from '../models/types';

export { HealthZone };

export interface Threshold {
  min: number;
  max: number;
  zone: HealthZone;
  label: string;
  description: string;
  color: string;
}

export interface EvaluationResult {
  zone: HealthZone;
  label: string;
  description: string;
  color: string;
  value: number;
}

export type BloodAnalysisField = 'tc' | 'hdl' | 'tg' | 'ldl' | 'tcHdlRatio' | 'glucose';

const cholesterolThresholds: Threshold[] = [
  { min: 0, max: 5.2, zone: HealthZone.Normal, label: 'Désirable', description: 'Cholestérol total dans la plage souhaitable', color: '#22c55e' },
  { min: 5.2, max: 6.2, zone: HealthZone.Borderline, label: 'Limite élevé', description: 'Cholestérol total légèrement au-dessus de la plage souhaitable', color: '#f59e0b' },
  { min: 6.2, max: Infinity, zone: HealthZone.Elevated, label: 'Élevé', description: 'Cholestérol total au-dessus de la plage recommandée', color: '#ef4444' },
];

const hdlThresholds: Threshold[] = [
  { min: 1.55, max: Infinity, zone: HealthZone.Normal, label: 'Optimal', description: 'Cholestérol HDL à un niveau optimal', color: '#22c55e' },
  { min: 1.0, max: 1.55, zone: HealthZone.Borderline, label: 'Bas', description: 'Cholestérol HDL en dessous du niveau optimal', color: '#f59e0b' },
  { min: 0, max: 1.0, zone: HealthZone.Elevated, label: 'Très bas', description: 'Cholestérol HDL nettement en dessous du niveau optimal', color: '#ef4444' },
];

const ldlThresholds: Threshold[] = [
  { min: 0, max: 2.6, zone: HealthZone.Normal, label: 'Optimal', description: 'Cholestérol LDL à un niveau optimal', color: '#22c55e' },
  { min: 2.6, max: 3.4, zone: HealthZone.Borderline, label: 'Proche de l\'optimal', description: 'Cholestérol LDL légèrement au-dessus du niveau optimal', color: '#f59e0b' },
  { min: 3.4, max: 4.1, zone: HealthZone.Elevated, label: 'Élevé', description: 'Cholestérol LDL au-dessus de la plage recommandée', color: '#ef4444' },
  { min: 4.1, max: Infinity, zone: HealthZone.Critical, label: 'Très élevé', description: 'Cholestérol LDL à un niveau critique', color: '#991b1b' },
];

const triglycerideThresholds: Threshold[] = [
  { min: 0, max: 1.7, zone: HealthZone.Normal, label: 'Normal', description: 'Triglycérides dans la plage normale', color: '#22c55e' },
  { min: 1.7, max: 2.3, zone: HealthZone.Borderline, label: 'Limite élevé', description: 'Triglycérides légèrement au-dessus de la normale', color: '#f59e0b' },
  { min: 2.3, max: Infinity, zone: HealthZone.Elevated, label: 'Élevé', description: 'Triglycérides au-dessus de la plage recommandée', color: '#ef4444' },
];

const tcHdlRatioThresholds: Threshold[] = [
  { min: 0, max: 3.5, zone: HealthZone.Normal, label: 'Risque faible', description: 'Le rapport CT/HDL indique un risque cardiovasculaire faible', color: '#22c55e' },
  { min: 3.5, max: 5, zone: HealthZone.Borderline, label: 'Risque modéré', description: 'Le rapport CT/HDL indique un risque cardiovasculaire modéré', color: '#f59e0b' },
  { min: 5, max: Infinity, zone: HealthZone.Elevated, label: 'Risque élevé', description: 'Le rapport CT/HDL indique un risque cardiovasculaire élevé', color: '#ef4444' },
];

const glucoseThresholds: Threshold[] = [
  { min: 0, max: 5.6, zone: HealthZone.Normal, label: 'Normal', description: 'Glycémie à jeun dans la plage normale', color: '#22c55e' },
  { min: 5.6, max: 7.0, zone: HealthZone.Borderline, label: 'Hyperglycémie modérée à jeun', description: 'Glycémie à jeun au-dessus de la normale mais en dessous du seuil diabétique', color: '#f59e0b' },
  { min: 7.0, max: Infinity, zone: HealthZone.Elevated, label: 'Diabétique', description: 'Glycémie à jeun dans la plage diabétique', color: '#ef4444' },
];

const bmiThresholds: Threshold[] = [
  { min: 0, max: 18.5, zone: HealthZone.Elevated, label: 'Insuffisance pondérale', description: 'IMC en dessous de la plage de poids santé', color: '#f59e0b' },
  { min: 18.5, max: 25, zone: HealthZone.Normal, label: 'Corpulence normale', description: 'IMC dans la plage de poids santé', color: '#22c55e' },
  { min: 25, max: 30, zone: HealthZone.Borderline, label: 'Surpoids', description: 'IMC au-dessus de la plage de poids santé', color: '#f59e0b' },
  { min: 30, max: 35, zone: HealthZone.Elevated, label: 'Obésité classe I', description: 'IMC dans la plage d\'obésité classe I', color: '#ef4444' },
  { min: 35, max: 40, zone: HealthZone.Elevated, label: 'Obésité classe II', description: 'IMC dans la plage d\'obésité classe II', color: '#ef4444' },
  { min: 40, max: Infinity, zone: HealthZone.Critical, label: 'Obésité classe III', description: 'IMC dans la plage d\'obésité classe III', color: '#991b1b' },
];

const systolicThresholds: Threshold[] = [
  { min: 0, max: 120, zone: HealthZone.Normal, label: 'Optimal', description: 'Pression artérielle systolique dans la plage optimale', color: '#22c55e' },
  { min: 120, max: 130, zone: HealthZone.Normal, label: 'Normal', description: 'Pression artérielle systolique dans la plage normale', color: '#22c55e' },
  { min: 130, max: 140, zone: HealthZone.Borderline, label: 'Normal élevé', description: 'Pression artérielle systolique légèrement au-dessus de la normale', color: '#f59e0b' },
  { min: 140, max: 160, zone: HealthZone.Elevated, label: 'Hypertension stade 1', description: 'Pression artérielle systolique dans la plage d\'hypertension stade 1', color: '#ef4444' },
  { min: 160, max: 180, zone: HealthZone.Elevated, label: 'Hypertension stade 2', description: 'Pression artérielle systolique dans la plage d\'hypertension stade 2', color: '#ef4444' },
  { min: 180, max: Infinity, zone: HealthZone.Critical, label: 'Hypertension stade 3', description: 'Pression artérielle systolique dans la plage d\'hypertension stade 3', color: '#991b1b' },
];

const diastolicThresholds: Threshold[] = [
  { min: 0, max: 80, zone: HealthZone.Normal, label: 'Optimal', description: 'Pression artérielle diastolique dans la plage optimale', color: '#22c55e' },
  { min: 80, max: 85, zone: HealthZone.Normal, label: 'Normal', description: 'Pression artérielle diastolique dans la plage normale', color: '#22c55e' },
  { min: 85, max: 90, zone: HealthZone.Borderline, label: 'Normal élevé', description: 'Pression artérielle diastolique légèrement au-dessus de la normale', color: '#f59e0b' },
  { min: 90, max: 100, zone: HealthZone.Elevated, label: 'Hypertension stade 1', description: 'Pression artérielle diastolique dans la plage d\'hypertension stade 1', color: '#ef4444' },
  { min: 100, max: 110, zone: HealthZone.Elevated, label: 'Hypertension stade 2', description: 'Pression artérielle diastolique dans la plage d\'hypertension stade 2', color: '#ef4444' },
  { min: 110, max: Infinity, zone: HealthZone.Critical, label: 'Hypertension stade 3', description: 'Pression artérielle diastolique dans la plage d\'hypertension stade 3', color: '#991b1b' },
];

const pulseThresholds: Threshold[] = [
  { min: 0, max: 60, zone: HealthZone.Borderline, label: 'Bradycardie', description: 'Fréquence cardiaque au repos inférieure à 60 bpm', color: '#f59e0b' },
  { min: 60, max: 100, zone: HealthZone.Normal, label: 'Normal', description: 'Fréquence cardiaque au repos dans la plage normale', color: '#22c55e' },
  { min: 100, max: 150, zone: HealthZone.Elevated, label: 'Tachycardie', description: 'Fréquence cardiaque au repos supérieure à 100 bpm', color: '#ef4444' },
  { min: 150, max: Infinity, zone: HealthZone.Critical, label: 'Tachycardie sévère', description: 'Fréquence cardiaque au repos très élevée', color: '#991b1b' },
];

const sleepTotalThresholds: Threshold[] = [
  { min: 0, max: 360, zone: HealthZone.Critical, label: 'Sévèrement insuffisant', description: 'Moins de 6 heures de sommeil est sévèrement insuffisant', color: '#991b1b' },
  { min: 360, max: 420, zone: HealthZone.Borderline, label: 'En dessous de la recommandation', description: 'Entre 6 et 7 heures, en dessous de la plage recommandée', color: '#f59e0b' },
  { min: 420, max: 540, zone: HealthZone.Normal, label: 'Recommandé', description: 'Entre 7 et 9 heures, dans la plage recommandée', color: '#22c55e' },
  { min: 540, max: 600, zone: HealthZone.Borderline, label: 'Au-dessus de la recommandation', description: 'Entre 9 et 10 heures, au-dessus de la plage recommandée', color: '#f59e0b' },
  { min: 600, max: Infinity, zone: HealthZone.Elevated, label: 'Excessif', description: 'Plus de 10 heures de sommeil peut indiquer un problème', color: '#ef4444' },
];

const sleepDeepThresholds: Threshold[] = [
  { min: 0, max: 60, zone: HealthZone.Borderline, label: 'Sommeil profond insuffisant', description: 'Moins de 1 heure de sommeil profond est en dessous de la recommandation', color: '#f59e0b' },
  { min: 60, max: 120, zone: HealthZone.Normal, label: 'Sommeil profond adéquat', description: '1 à 2 heures de sommeil profond est dans la plage recommandée', color: '#22c55e' },
  { min: 120, max: Infinity, zone: HealthZone.Normal, label: 'Bon sommeil profond', description: 'Plus de 2 heures de sommeil profond est au-dessus de la moyenne', color: '#22c55e' },
];

const sleepRemThresholds: Threshold[] = [
  { min: 0, max: 60, zone: HealthZone.Borderline, label: 'Sommeil paradoxal insuffisant', description: 'Moins de 1 heure de sommeil paradoxal est en dessous de la recommandation', color: '#f59e0b' },
  { min: 60, max: 120, zone: HealthZone.Normal, label: 'Sommeil paradoxal adéquat', description: '1 à 2 heures de sommeil paradoxal est dans la plage recommandée', color: '#22c55e' },
  { min: 120, max: Infinity, zone: HealthZone.Normal, label: 'Bon sommeil paradoxal', description: 'Plus de 2 heures de sommeil paradoxal est au-dessus de la moyenne', color: '#22c55e' },
];

const sleepEfficiencyThresholds: Threshold[] = [
  { min: 0, max: 75, zone: HealthZone.Critical, label: 'Mauvaise efficacité', description: 'Moins de 75% indique une efficacité du sommeil insuffisante (possible insomnie)', color: '#991b1b' },
  { min: 75, max: 85, zone: HealthZone.Borderline, label: 'Efficacité acceptable', description: 'Entre 75% et 85%, l\'efficacité du sommeil est acceptable mais perfectible', color: '#f59e0b' },
  { min: 85, max: 101, zone: HealthZone.Normal, label: 'Bonne efficacité', description: '85% et plus indique une bonne efficacité du sommeil', color: '#22c55e' },
];

export const thresholdSets: Record<string, Threshold[]> = {
  tc: cholesterolThresholds,
  hdl: hdlThresholds,
  tg: triglycerideThresholds,
  ldl: ldlThresholds,
  tcHdlRatio: tcHdlRatioThresholds,
  glucose: glucoseThresholds,
  bmi: bmiThresholds,
  systolic: systolicThresholds,
  diastolic: diastolicThresholds,
  pulse: pulseThresholds,
  sleepTotal: sleepTotalThresholds,
  sleepDeep: sleepDeepThresholds,
  sleepRem: sleepRemThresholds,
  sleepEfficiency: sleepEfficiencyThresholds,
};

function findThreshold(thresholds: Threshold[], value: number): Threshold {
  for (const t of thresholds) {
    if (value >= t.min && value < t.max) {
      return t;
    }
  }
  const last = thresholds[thresholds.length - 1];
  return last;
}

export function evaluateField(field: string, value: number): EvaluationResult {
  const thresholds = thresholdSets[field];
  if (!thresholds) {
    return {
      zone: HealthZone.Normal,
      label: 'Inconnu',
      description: `Aucun seuil défini pour le champ "${field}"`,
      color: '#9ca3af',
      value,
    };
  }
  if (value === 0) {
    return {
      zone: HealthZone.Normal,
      label: 'Non renseigné',
      description: 'Valeur non saisie',
      color: '#9ca3af',
      value,
    };
  }
  const t = findThreshold(thresholds, value);
  return { zone: t.zone, label: t.label, description: t.description, color: t.color, value };
}

export type BloodAnalysisEvaluation = Record<BloodAnalysisField, EvaluationResult>;

export function evaluateBloodAnalysis(record: BloodAnalysis): BloodAnalysisEvaluation {
  return {
    tc: evaluateField('tc', record.tc),
    hdl: evaluateField('hdl', record.hdl),
    tg: evaluateField('tg', record.tg),
    ldl: evaluateField('ldl', record.ldl),
    tcHdlRatio: evaluateField('tcHdlRatio', record.tcHdlRatio),
    glucose: evaluateField('glucose', record.glucose),
  };
}

export interface BloodPressureEvaluation {
  systolic: EvaluationResult;
  diastolic: EvaluationResult;
  pulse: EvaluationResult | null;
  combinedZone: HealthZone;
  combinedLabel: string;
  combinedDescription: string;
  combinedColor: string;
}

const zoneOrder: Record<HealthZone, number> = {
  [HealthZone.Normal]: 0,
  [HealthZone.Borderline]: 1,
  [HealthZone.Elevated]: 2,
  [HealthZone.Critical]: 3,
};

function worstZone(a: HealthZone, b: HealthZone): HealthZone {
  return zoneOrder[a] >= zoneOrder[b] ? a : b;
}

export function evaluateBloodPressure(record: BloodPressure): BloodPressureEvaluation {
  const systolic = evaluateField('systolic', record.systolic);
  const diastolic = evaluateField('diastolic', record.diastolic);
  const pulse = record.pulse ? evaluateField('pulse', record.pulse) : null;
  const combinedZone = worstZone(systolic.zone, diastolic.zone);

  const combinedThresholds = [...systolicThresholds, ...diastolicThresholds];
  const worstThreshold = combinedThresholds.find((t) => t.zone === combinedZone);

  return {
    systolic,
    diastolic,
    pulse,
    combinedZone,
    combinedLabel: worstThreshold?.label ?? systolic.label,
    combinedDescription: worstThreshold?.description ?? systolic.description,
    combinedColor: worstThreshold?.color ?? systolic.color,
  };
}

export interface BMIEvaluation {
  bmi: EvaluationResult;
}

export function evaluateBMI(record: WeightBMI): BMIEvaluation {
  return {
    bmi: evaluateField('bmi', record.bmi),
  };
}

export interface SleepEvaluation {
  totalSleep: EvaluationResult;
  deepSleep: EvaluationResult;
  remSleep: EvaluationResult;
  efficiency: EvaluationResult | null;
  overallZone: HealthZone;
}

export function evaluateSleep(record: Sleep): SleepEvaluation {
  const totalSleep = evaluateField('sleepTotal', record.totalSleep);
  const deepSleep = evaluateField('sleepDeep', record.deepSleep);
  const remSleep = evaluateField('sleepRem', record.remSleep);
  const efficiency = record.efficiency != null ? evaluateField('sleepEfficiency', record.efficiency) : null;

  const zones = [totalSleep.zone, deepSleep.zone, remSleep.zone];
  if (efficiency) zones.push(efficiency.zone);
  const overallZone = zones.reduce(worstZone);

  return {
    totalSleep,
    deepSleep,
    remSleep,
    efficiency,
    overallZone,
  };
}