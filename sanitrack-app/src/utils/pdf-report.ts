import { jsPDF } from 'jspdf';
import { db } from '@/db/database';
import { evaluateField } from '@/engine/rules';
import type {
  BloodAnalysis,
  BloodPressure,
  NutritionEntry,
  PhysicalActivity,
  Sleep,
  WeightBMI,
} from '@/models/types';

export type ReportSection =
  | 'bloodAnalysis'
  | 'physicalActivity'
  | 'weightBMI'
  | 'sleep'
  | 'bloodPressure'
  | 'nutrition';

export interface ReportOptions {
  sections: ReportSection[];
  startDate: string;
  endDate: string;
}

export interface ReportData {
  bloodAnalysis: BloodAnalysis[];
  physicalActivity: PhysicalActivity[];
  weightBMI: WeightBMI[];
  sleep: Sleep[];
  bloodPressure: BloodPressure[];
  nutrition: NutritionEntry[];
}

export const reportSectionLabels: Record<ReportSection, string> = {
  bloodAnalysis: 'Analyse sanguine',
  physicalActivity: 'Activité physique',
  weightBMI: 'Poids / IMC',
  sleep: 'Sommeil',
  bloodPressure: 'Pression artérielle',
  nutrition: 'Nutrition',
};

const emptyReportData = (): ReportData => ({
  bloodAnalysis: [],
  physicalActivity: [],
  weightBMI: [],
  sleep: [],
  bloodPressure: [],
  nutrition: [],
});

export async function loadReportData(options: ReportOptions): Promise<ReportData> {
  const data = emptyReportData();
  const tables = {
    bloodAnalysis: db.bloodAnalyses,
    physicalActivity: db.physicalActivities,
    weightBMI: db.weightBMI,
    sleep: db.sleep,
    bloodPressure: db.bloodPressure,
    nutrition: db.nutrition,
  };
  await Promise.all(
    options.sections.map(async (section) => {
      const table = tables[section];
      data[section] = await table.where('date').between(options.startDate, options.endDate, true, true).sortBy('date') as never;
    }),
  );
  return data;
}

function frenchDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export interface ReportChartSeries {
  label: string;
  color: [number, number, number];
  values: number[];
}

export interface ReportChartDefinition {
  title: string;
  unit: string;
  dates: string[];
  series: ReportChartSeries[];
  referenceLines?: Array<{ value: number; label: string; color: [number, number, number] }>;
  kind?: 'line' | 'pie' | 'stackedBar';
  showAverage?: boolean;
  showRegression?: boolean;
  clockValues?: boolean;
  fullWidth?: boolean;
  /** In blood analyses, a persisted zero denotes an unfilled marker. */
  zeroAsMissing?: boolean;
}

export interface ReportChartContext {
  height?: number;
  nutritionTarget?: number | null;
}

export interface ReportIndicator {
  label: string;
  value: string;
  unit?: string;
  status?: string;
  color?: string;
}

function average(values: number[], excludeZero = true): number {
  const valid = values.filter((value) => Number.isFinite(value) && (!excludeZero || value > 0));
  return valid.length === 0 ? 0 : valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatted(value: number, digits = 1): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function duration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  return `${Math.floor(totalMinutes / 60)} h ${String(totalMinutes % 60).padStart(2, '0')}`;
}

function sleepDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, '0')}`;
}

function averageClock(values: Array<string | undefined>): string | undefined {
  const minutes = values.flatMap((value) => {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return [];
    const [hours, mins] = value.split(':').map(Number);
    return [hours * 60 + mins];
  });
  if (minutes.length === 0) return undefined;
  const angleFactor = (2 * Math.PI) / 1440;
  const sin = minutes.reduce((sum, value) => sum + Math.sin(value * angleFactor), 0) / minutes.length;
  const cos = minutes.reduce((sum, value) => sum + Math.cos(value * angleFactor), 0) / minutes.length;
  const angle = Math.atan2(sin, cos);
  const avg = Math.round(angle < 0 ? (angle + 2 * Math.PI) / angleFactor : angle / angleFactor) % 1440;
  return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
}

function evaluatedIndicator(label: string, value: number, unit: string, field: string, digits = 1): ReportIndicator {
  const result = evaluateField(field, value);
  return { label, value: formatted(value, digits), unit, status: result.label, color: result.color };
}

function aggregateNutrition(entries: NutritionEntry[]) {
  const byDate = new Map<string, { calories: number; proteins: number; lipids: number; carbs: number; fibers: number }>();
  entries.forEach((entry) => {
    const current = byDate.get(entry.date) ?? { calories: 0, proteins: 0, lipids: 0, carbs: 0, fibers: 0 };
    current.calories += entry.totalCalories;
    current.proteins += entry.totalProteins;
    current.lipids += entry.totalLipids;
    current.carbs += entry.totalCarbs;
    current.fibers += entry.totalFibers;
    byDate.set(entry.date, current);
  });
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function indicatorsFor(section: ReportSection, data: ReportData): ReportIndicator[] {
  switch (section) {
    case 'bloodAnalysis': {
      const records = data.bloodAnalysis;
      return [
        evaluatedIndicator('Cholestérol total (moy.)', average(records.map((r) => r.tc)), 'mmol/L', 'tc', 2),
        evaluatedIndicator('Bon cholestérol HDL (moy.)', average(records.map((r) => r.hdl)), 'mmol/L', 'hdl', 2),
        evaluatedIndicator('Triglycérides (moy.)', average(records.map((r) => r.tg)), 'mmol/L', 'tg', 2),
        evaluatedIndicator('Mauvais cholestérol LDL (moy.)', average(records.map((r) => r.ldl)), 'mmol/L', 'ldl', 2),
        evaluatedIndicator('Rapport TC/HDL (moy.)', average(records.map((r) => r.tcHdlRatio)), 'rapport', 'tcHdlRatio', 2),
        evaluatedIndicator('Glucose (moy.)', average(records.map((r) => r.glucose)), 'mmol/L', 'glucose', 2),
      ];
    }
    case 'physicalActivity': {
      const records = data.physicalActivity;
      return [
        { label: 'Distance moyenne', value: formatted(average(records.map((r) => r.distance)), 2), unit: 'km' },
        { label: 'Durée moyenne', value: duration(average(records.map((r) => r.duration))) },
        { label: 'Calories moyennes', value: formatted(average(records.map((r) => r.totalCalories)), 0), unit: 'kcal' },
        { label: 'Vitesse moyenne', value: formatted(average(records.map((r) => r.averageSpeed))), unit: 'km/h' },
        { label: 'Fréquence cardiaque moy.', value: formatted(average(records.map((r) => r.averageHeartRate)), 0), unit: 'bpm' },
        { label: 'Stress aérobie moyen', value: formatted(average(records.map((r) => r.aerobicTrainingStress))) },
        { label: 'Stress anaérobie moyen', value: formatted(average(records.map((r) => r.anaerobicTrainingStress))) },
      ];
    }
    case 'weightBMI': {
      const records = data.weightBMI;
      const bmi = average(records.map((r) => r.bmi));
      return [
        { label: 'Poids moyen', value: formatted(average(records.map((r) => r.mass))), unit: 'kg' },
        evaluatedIndicator('IMC moyen', bmi, 'kg/m²', 'bmi'),
      ];
    }
    case 'sleep': {
      const records = data.sleep;
      const total = average(records.map((r) => r.totalSleep));
      const deep = average(records.map((r) => r.deepSleep));
      const rem = average(records.map((r) => r.remSleep));
      const efficiency = average(records.map((r) => r.efficiency ?? 0));
      const indicators: ReportIndicator[] = [
        { ...evaluatedIndicator('Sommeil total (moy.)', total, '', 'sleepTotal', 0), value: sleepDuration(total), unit: undefined },
        { ...evaluatedIndicator('Sommeil profond (moy.)', deep, '', 'sleepDeep', 0), value: sleepDuration(deep), unit: undefined },
        { ...evaluatedIndicator('Sommeil paradoxal (moy.)', rem, '', 'sleepRem', 0), value: sleepDuration(rem), unit: undefined },
        evaluatedIndicator('Efficacité moyenne', efficiency, '%', 'sleepEfficiency', 0),
      ];
      const bedTime = averageClock(records.map((r) => r.bedTime));
      const wakeTime = averageClock(records.map((r) => r.wakeTime));
      if (bedTime) indicators.push({ label: 'Heure moyenne du coucher', value: bedTime });
      if (wakeTime) indicators.push({ label: 'Heure moyenne du lever', value: wakeTime });
      return indicators;
    }
    case 'bloodPressure': {
      const records = data.bloodPressure;
      return [
        evaluatedIndicator('Systolique moyenne', average(records.map((r) => r.systolic)), 'mmHg', 'systolic', 0),
        evaluatedIndicator('Diastolique moyenne', average(records.map((r) => r.diastolic)), 'mmHg', 'diastolic', 0),
        evaluatedIndicator('Pouls moyen', average(records.map((r) => r.pulse ?? 0)), 'bpm', 'pulse', 0),
      ];
    }
    case 'nutrition': {
      const daily = aggregateNutrition(data.nutrition);
      return [
        { label: 'Calories moy. / jour', value: formatted(average(daily.map(([, value]) => value.calories))), unit: 'kcal' },
        { label: 'Protéines moy. / jour', value: formatted(average(daily.map(([, value]) => value.proteins))), unit: 'g' },
        { label: 'Lipides moy. / jour', value: formatted(average(daily.map(([, value]) => value.lipids))), unit: 'g' },
        { label: 'Glucides moy. / jour', value: formatted(average(daily.map(([, value]) => value.carbs))), unit: 'g' },
        { label: 'Fibres moy. / jour', value: formatted(average(daily.map(([, value]) => value.fibers))), unit: 'g' },
      ];
    }
  }
}

function clockMinutes(value: string | undefined, bedtime = false): number {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  const result = hours * 60 + minutes;
  return bedtime && result < 720 ? result + 1440 : result;
}

function aggregateNutritionByMeal(entries: NutritionEntry[]) {
  const byDate = new Map<string, Record<'breakfast' | 'lunch' | 'snack' | 'dinner', number>>();
  entries.forEach((entry) => {
    const current = byDate.get(entry.date) ?? { breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
    current[entry.mealType] += entry.totalCalories;
    byDate.set(entry.date, current);
  });
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function chartsFor(section: ReportSection, data: ReportData, context: ReportChartContext = {}): ReportChartDefinition[] {
  const indigo: [number, number, number] = [99, 102, 241];
  const emerald: [number, number, number] = [34, 197, 94];
  const amber: [number, number, number] = [245, 158, 11];
  const rose: [number, number, number] = [239, 68, 68];
  const blue: [number, number, number] = [59, 130, 246];
  const violet: [number, number, number] = [139, 92, 246];
  const purple: [number, number, number] = [168, 85, 247];
  switch (section) {
    case 'bloodAnalysis':
      return [
        { title: 'Cholestérol total (Désirable)', unit: 'mmol/L', dates: data.bloodAnalysis.map((r) => r.date), series: [{ label: 'Cholestérol total', color: indigo, values: data.bloodAnalysis.map((r) => r.tc) }], zeroAsMissing: true, showAverage: true, referenceLines: [{ value: 5.2, label: 'Désirable', color: emerald }, { value: 6.2, label: 'Élevé', color: rose }] },
        { title: 'Bon cholestérol (HDL) (Bon cholestérol)', unit: 'mmol/L', dates: data.bloodAnalysis.map((r) => r.date), series: [{ label: 'Bon cholestérol (HDL)', color: emerald, values: data.bloodAnalysis.map((r) => r.hdl) }], zeroAsMissing: true, showAverage: true, referenceLines: [{ value: 1, label: 'Bas', color: amber }, { value: 1.55, label: 'Optimal', color: emerald }] },
        { title: 'Triglycérides (Mauvaises graisses)', unit: 'mmol/L', dates: data.bloodAnalysis.map((r) => r.date), series: [{ label: 'Triglycérides', color: amber, values: data.bloodAnalysis.map((r) => r.tg) }], zeroAsMissing: true, showAverage: true, referenceLines: [{ value: 1.7, label: 'Normal', color: emerald }, { value: 2.3, label: 'Élevé', color: rose }] },
        { title: 'Mauvais cholestérol (LDL) (Mauvais cholestérol)', unit: 'mmol/L', dates: data.bloodAnalysis.map((r) => r.date), series: [{ label: 'Mauvais cholestérol (LDL)', color: rose, values: data.bloodAnalysis.map((r) => r.ldl) }], zeroAsMissing: true, showAverage: true, referenceLines: [{ value: 2.6, label: 'Optimal', color: emerald }, { value: 3.4, label: 'Élevé', color: amber }, { value: 4.1, label: 'Très élevé', color: rose }] },
        { title: 'Rapport TC/HDL (Risque cardio)', unit: 'rapport', dates: data.bloodAnalysis.map((r) => r.date), series: [{ label: 'Rapport TC/HDL', color: violet, values: data.bloodAnalysis.map((r) => r.tcHdlRatio) }], zeroAsMissing: true, showAverage: true, referenceLines: [{ value: 3.5, label: 'Risque faible', color: emerald }, { value: 5, label: 'Risque élevé', color: rose }] },
        { title: 'Glucose (Glycémie)', unit: 'mmol/L', dates: data.bloodAnalysis.map((r) => r.date), series: [{ label: 'Glucose', color: blue, values: data.bloodAnalysis.map((r) => r.glucose) }], zeroAsMissing: true, showAverage: true, referenceLines: [{ value: 5.6, label: 'Normal', color: emerald }, { value: 7, label: 'Diabétique', color: rose }] },
      ];
    case 'physicalActivity':
      return [
        { title: 'Distance (km)', unit: 'km', dates: data.physicalActivity.map((r) => r.date), series: [{ label: 'Distance', color: indigo, values: data.physicalActivity.map((r) => r.distance) }], showAverage: true },
        { title: 'Vitesse moyenne (km/h)', unit: 'km/h', dates: data.physicalActivity.map((r) => r.date), series: [{ label: 'Vitesse', color: emerald, values: data.physicalActivity.map((r) => r.averageSpeed) }], showAverage: true },
        { title: 'Calories (kcal)', unit: 'kcal', dates: data.physicalActivity.map((r) => r.date), series: [{ label: 'Calories', color: amber, values: data.physicalActivity.map((r) => r.totalCalories) }], showAverage: true },
        { title: "Stress d'entraînement", unit: '', dates: data.physicalActivity.map((r) => r.date), series: [
          { label: 'Aérobie', color: blue, values: data.physicalActivity.map((r) => r.aerobicTrainingStress) },
          { label: 'Anaérobie', color: purple, values: data.physicalActivity.map((r) => r.anaerobicTrainingStress) },
        ] },
      ];
    case 'weightBMI': {
      const height = context.height ?? 170;
      const heightM = height / 100;
      const bmiLines: Array<[number, string, [number, number, number]]> = [
        [18.5, 'Insuffisance pondérale', blue], [25, 'Normal', emerald], [30, 'Surpoids', amber],
        [35, 'Obésité I', rose], [40, 'Obésité II+', [153, 27, 27]],
      ];
      return [
        { title: height > 0 ? `Poids (kg) avec repères IMC OMS (taille : ${height} cm)` : 'Poids (kg)', unit: 'kg', dates: data.weightBMI.map((r) => r.date), series: [{ label: 'Poids', color: indigo, values: data.weightBMI.map((r) => r.mass) }], showAverage: true, referenceLines: height > 0 ? bmiLines.map(([bmi, label, color]) => {
          const weight = Math.round(bmi * heightM * heightM * 10) / 10;
          return { value: weight, label: `${label} (${bmi} → ${weight} kg)`, color };
        }) : undefined },
      ];
    }
    case 'sleep':
      return [
        { title: 'Sommeil total (min)', unit: 'min', dates: data.sleep.map((r) => r.date), series: [{ label: 'Sommeil total', color: indigo, values: data.sleep.map((r) => r.totalSleep) }], showAverage: true, showRegression: true },
        { title: 'Sommeil profond (%)', unit: '%', dates: data.sleep.map((r) => r.date), series: [{ label: 'Sommeil profond', color: violet, values: data.sleep.map((r) => r.totalSleep > 0 ? Math.round(r.deepSleep / r.totalSleep * 100) : 0) }], showAverage: true, showRegression: true },
        { title: 'Sommeil léger (%)', unit: '%', dates: data.sleep.map((r) => r.date), series: [{ label: 'Sommeil léger', color: emerald, values: data.sleep.map((r) => r.totalSleep > 0 ? Math.round(r.lightSleep / r.totalSleep * 100) : 0) }], showAverage: true, showRegression: true },
        { title: 'Sommeil paradoxal (%)', unit: '%', dates: data.sleep.map((r) => r.date), series: [{ label: 'Sommeil paradoxal', color: amber, values: data.sleep.map((r) => r.totalSleep > 0 ? Math.round(r.remSleep / r.totalSleep * 100) : 0) }], showAverage: true, showRegression: true },
        { title: 'Heures de coucher et de lever', unit: '', dates: data.sleep.map((r) => r.date), series: [
          { label: 'Coucher', color: [124, 58, 237], values: data.sleep.map((r) => clockMinutes(r.bedTime, true)) },
          { label: 'Lever', color: [8, 145, 178], values: data.sleep.map((r) => clockMinutes(r.wakeTime)) },
        ], clockValues: true, fullWidth: true },
      ];
    case 'bloodPressure':
      return [
        { title: 'Pression systolique', unit: 'mmHg', dates: data.bloodPressure.map((r) => r.date), series: [{ label: 'Systolique', color: rose, values: data.bloodPressure.map((r) => r.systolic) }], showAverage: true, referenceLines: [
          { value: 120, label: 'Normal', color: emerald }, { value: 130, label: 'Élevé', color: amber }, { value: 140, label: 'HTA stade 1', color: rose }, { value: 180, label: 'HTA stade 3', color: [153, 27, 27] },
        ] },
        { title: 'Pression diastolique', unit: 'mmHg', dates: data.bloodPressure.map((r) => r.date), series: [{ label: 'Diastolique', color: blue, values: data.bloodPressure.map((r) => r.diastolic) }], showAverage: true, referenceLines: [
          { value: 80, label: 'Normal', color: emerald }, { value: 85, label: 'Élevé', color: amber }, { value: 90, label: 'HTA stade 1', color: rose }, { value: 110, label: 'HTA stade 3', color: [153, 27, 27] },
        ] },
        { title: 'Pouls', unit: 'bpm', dates: data.bloodPressure.map((r) => r.date), series: [{ label: 'Pouls', color: violet, values: data.bloodPressure.map((r) => r.pulse ?? 0) }], showAverage: true, referenceLines: [
          { value: 60, label: 'Normal', color: emerald }, { value: 100, label: 'Tachycardie', color: rose },
        ] },
      ];
    case 'nutrition': {
      const daily = aggregateNutrition(data.nutrition);
      const dailyMeals = aggregateNutritionByMeal(data.nutrition);
      return [
        { title: 'Répartition des macronutriments', unit: '', kind: 'pie', dates: [], series: [
          { label: 'Protéines', color: rose, values: [daily.reduce((sum, [, value]) => sum + value.proteins, 0)] },
          { label: 'Lipides', color: amber, values: [daily.reduce((sum, [, value]) => sum + value.lipids, 0)] },
          { label: 'Glucides', color: blue, values: [daily.reduce((sum, [, value]) => sum + value.carbs, 0)] },
          { label: 'Fibres', color: emerald, values: [daily.reduce((sum, [, value]) => sum + value.fibers, 0)] },
        ] },
        { title: 'Calories par jour', unit: 'kcal', kind: 'stackedBar', dates: dailyMeals.map(([date]) => date), series: [
          { label: 'Petit-déjeuner', color: amber, values: dailyMeals.map(([, value]) => value.breakfast) },
          { label: 'Déjeuner', color: emerald, values: dailyMeals.map(([, value]) => value.lunch) },
          { label: 'Collation', color: blue, values: dailyMeals.map(([, value]) => value.snack) },
          { label: 'Dîner', color: indigo, values: dailyMeals.map(([, value]) => value.dinner) },
        ], referenceLines: context.nutritionTarget && context.nutritionTarget > 0 ? [{ value: context.nutritionTarget, label: `${context.nutritionTarget} kcal`, color: [249, 115, 22] }] : undefined },
      ];
    }
  }
}

function hexToRgb(hex: string | undefined): [number, number, number] {
  const fallback: [number, number, number] = [79, 70, 229];
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return fallback;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function drawIndicators(doc: jsPDF, indicators: ReportIndicator[], x: number, y: number, width: number): number {
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Indicateurs sur la période', x, y);
  if (indicators.length === 0) return y + 8;

  const columns = indicators.length === 6 ? 3 : 4;
  const gap = 3;
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const cardHeight = 17;
  indicators.forEach((indicator, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cardX = x + column * (cardWidth + gap);
    const cardY = y + 4 + row * (cardHeight + 3);
    const color = hexToRgb(indicator.color);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.35);
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(indicator.label, cardX + 3, cardY + 4.5, { maxWidth: cardWidth - 6 });
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${indicator.value}${indicator.unit ? ` ${indicator.unit}` : ''}`, cardX + 3, cardY + 11.5, { maxWidth: cardWidth - 6 });
    if (indicator.status) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(indicator.status, cardX + cardWidth - 3, cardY + 15, { align: 'right', maxWidth: cardWidth - 6 });
    }
  });
  return y + 8 + Math.ceil(indicators.length / columns) * (cardHeight + 3);
}

function timestamp(date: string): number {
  return new Date(`${date.slice(0, 10)}T00:00:00`).getTime();
}

export function gapThreshold(periodStart: string, periodEnd: string): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const periodDays = Math.max(1, (timestamp(periodEnd) - timestamp(periodStart)) / oneDay);
  if (periodDays <= 14) return 2 * oneDay;
  if (periodDays <= 62) return 7 * oneDay;
  if (periodDays <= 400) return 45 * oneDay;
  if (periodDays <= 800) return 90 * oneDay;
  return 180 * oneDay;
}

function drawSmoothSegment(doc: jsPDF, points: Array<{ x: number; y: number }>): void {
  if (points.length < 2) return;
  doc.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const controlOffset = (current.x - previous.x) / 3;
    doc.curveTo(
      previous.x + controlOffset,
      previous.y,
      current.x - controlOffset,
      current.y,
      current.x,
      current.y,
    );
  }
  doc.stroke();
}

function drawChart(
  doc: jsPDF,
  chart: ReportChartDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
  periodStart: string,
  periodEnd: string,
): void {
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(chart.title, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(chart.unit, x + width, y, { align: 'right' });

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y + 3, width, height - 5, 1.5, 1.5, 'FD');

  const plot = { x: x + 13, y: y + 8, width: width - 16, height: height - 19 };
  const allValues = [
    ...chart.series.flatMap((series) => series.values).filter((value) => Number.isFinite(value) && value > 0),
    ...(chart.referenceLines?.map((line) => line.value) ?? []),
  ];
  if (allValues.length === 0) {
    doc.setFontSize(9);
    doc.text('Aucune donnée disponible', x + width / 2, y + height / 2, { align: 'center' });
    return;
  }

  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  const padding = max === min ? Math.max(Math.abs(max) * 0.1, 1) : (max - min) * 0.12;
  min = chart.referenceLines ? 0 : Math.max(0, min - padding);
  max += padding;
  const domainStart = timestamp(periodStart);
  const domainEnd = Math.max(timestamp(periodEnd), domainStart + 24 * 60 * 60 * 1000);
  const xForDate = (date: string) => plot.x + ((timestamp(date) - domainStart) / (domainEnd - domainStart)) * plot.width;
  const maxGap = gapThreshold(periodStart, periodEnd);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1.5], 0);
  for (let tick = 0; tick <= 4; tick += 1) {
    const tickY = plot.y + (plot.height * tick) / 4;
    doc.line(plot.x, tickY, plot.x + plot.width, tickY);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.text((max - ((max - min) * tick) / 4).toLocaleString('fr-FR', { maximumFractionDigits: 1 }), plot.x - 2, tickY + 1, { align: 'right' });
  }
  for (let tick = 0; tick <= 4; tick += 1) {
    const tickX = plot.x + (plot.width * tick) / 4;
    doc.line(tickX, plot.y, tickX, plot.y + plot.height);
  }
  doc.setLineDashPattern([], 0);

  chart.referenceLines?.forEach((line) => {
    if (line.value < min || line.value > max) return;
    const lineY = plot.y + plot.height - ((line.value - min) / (max - min)) * plot.height;
    doc.setDrawColor(...line.color);
    doc.setTextColor(...line.color);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(plot.x, lineY, plot.x + plot.width, lineY);
    doc.setFontSize(5.8);
    doc.text(line.label, plot.x + plot.width - 1, lineY - 1, { align: 'right' });
    doc.setLineDashPattern([], 0);
  });

  chart.series.forEach((series) => {
    doc.setDrawColor(...series.color);
    doc.setFillColor(...series.color);
    doc.setLineWidth(0.65);
    let segment: Array<{ x: number; y: number }> = [];
    let previousDate: string | null = null;
    const flushSegment = () => {
      drawSmoothSegment(doc, segment);
      segment = [];
    };
    series.values.forEach((value, index) => {
      if (!Number.isFinite(value) || value <= 0) {
        flushSegment();
        previousDate = null;
        return;
      }
      const pointX = xForDate(chart.dates[index]);
      const pointY = plot.y + plot.height - ((value - min) / (max - min)) * plot.height;
      if (previousDate && timestamp(chart.dates[index]) - timestamp(previousDate) > maxGap) {
        flushSegment();
      }
      segment.push({ x: pointX, y: pointY });
      previousDate = chart.dates[index];
    });
    flushSegment();
    series.values.forEach((value, index) => {
      if (!Number.isFinite(value) || value <= 0) return;
      const pointX = xForDate(chart.dates[index]);
      const pointY = plot.y + plot.height - ((value - min) / (max - min)) * plot.height;
      doc.circle(pointX, pointY, 0.85, 'F');
    });
  });

  const axisDates = [periodStart, new Date((domainStart + domainEnd) / 2).toISOString().slice(0, 10), periodEnd];
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  axisDates.forEach((date, index) => {
    const dateX = xForDate(date);
    doc.text(frenchDate(date), dateX, plot.y + plot.height + 4, { align: index === 0 ? 'left' : index === 2 ? 'right' : 'center' });
  });

  let legendX = x;
  chart.series.forEach((series) => {
    doc.setFillColor(...series.color);
    doc.circle(legendX + 1, y + height - 2, 1, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6.5);
    doc.text(series.label, legendX + 4, y + height - 1);
    legendX += doc.getTextWidth(series.label) + 10;
  });
}

export function buildReportPdf(options: ReportOptions, data: ReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SaniTrack - Rapport de santé', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Période du ${frenchDate(options.startDate)} au ${frenchDate(options.endDate)}`, 14, 23);
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - Données conservées et traitées localement`, 14, 40);

  options.sections.forEach((section, index) => {
    if (index > 0) doc.addPage();
    const charts = chartsFor(section, data);
    const indicators = indicatorsFor(section, data);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(reportSectionLabels[section], 14, index === 0 ? 52 : 18);
    const top = drawIndicators(doc, indicators, 14, index === 0 ? 59 : 25, 269) + 2;
    if (section === 'bloodAnalysis' && charts.length > 2) {
      charts.slice(0, 2).forEach((chart, chartIndex) => {
        drawChart(doc, chart, 14 + chartIndex * 137, top, 130, 194 - top, options.startDate, options.endDate);
      });
      doc.addPage();
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`${reportSectionLabels[section]} - graphiques (suite)`, 14, 18);
      const remaining = charts.slice(2);
      const continuationTop = 28;
      const continuationRowGap = (194 - continuationTop) / 2;
      remaining.forEach((chart, chartIndex) => {
        const column = chartIndex % 2;
        const row = Math.floor(chartIndex / 2);
        drawChart(doc, chart, 14 + column * 137, continuationTop + row * continuationRowGap, 130, continuationRowGap - 5, options.startDate, options.endDate);
      });
      return;
    }

    const columns = charts.length > 2 ? 2 : 1;
    const chartWidth = columns === 2 ? 130 : 267;
    const availableHeight = 194 - top;
    const rows = Math.ceil(charts.length / columns);
    const rowGap = availableHeight / Math.max(rows, 1);
    const chartHeight = Math.max(34, rowGap - 3);
    charts.forEach((chart, chartIndex) => {
      const column = chartIndex % columns;
      const row = Math.floor(chartIndex / columns);
      drawChart(doc, chart, 14 + column * (269 / columns), top + row * rowGap, chartWidth, chartHeight, options.startDate, options.endDate);
    });
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 198, pageWidth - 14, 198);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('Ce rapport ne remplace pas un avis médical.', 14, 203);
    doc.text(`Page ${page} / ${pages}`, pageWidth - 14, 203, { align: 'right' });
  }

  return doc;
}

export async function createReportPdf(options: ReportOptions, data: ReportData): Promise<void> {
  const { renderReportPagesToCanvases } = await import('@/components/report/PdfReportRenderer');
  const canvases = await renderReportPagesToCanvases(options, data);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  canvases.forEach((canvas, index) => {
    if (index > 0) doc.addPage();
    doc.addImage(canvas, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  });
  doc.save(`sanitrack-rapport-${options.startDate}-${options.endDate}.pdf`);
}
