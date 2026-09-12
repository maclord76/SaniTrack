import { describe, expect, it } from 'vitest';
import { chartsFor, indicatorsFor, reportSectionLabels, type ReportData } from '@/utils/pdf-report';

describe('rapport PDF', () => {
  it('génère uniquement des graphiques pour chaque rubrique', () => {
    const empty: ReportData = { bloodAnalysis: [], physicalActivity: [], weightBMI: [], sleep: [], bloodPressure: [], nutrition: [] };
    expect(chartsFor('bloodAnalysis', empty).map((chart) => chart.title)).toEqual([
      'Cholestérol total (Désirable)',
      'Bon cholestérol (HDL) (Bon cholestérol)',
      'Triglycérides (Mauvaises graisses)',
      'Mauvais cholestérol (LDL) (Mauvais cholestérol)',
      'Rapport TC/HDL (Risque cardio)',
      'Glucose (Glycémie)',
    ]);
    expect(chartsFor('physicalActivity', empty).map((chart) => chart.title)).toEqual([
      'Distance (km)',
      'Vitesse moyenne (km/h)',
      'Calories (kcal)',
      "Stress d'entraînement",
    ]);
    expect(chartsFor('weightBMI', empty)[0].title).toContain('Poids (kg) avec repères IMC OMS');
    expect(chartsFor('nutrition', empty).map((chart) => chart.title)).toEqual(['Répartition des macronutriments', 'Calories par jour']);
    expect(chartsFor('sleep', empty)).toHaveLength(5);
    expect(chartsFor('bloodPressure', empty)).toHaveLength(3);
    expect(chartsFor('nutrition', empty).map((chart) => chart.kind)).toEqual(['pie', 'stackedBar']);
    const sleepCharts = chartsFor('sleep', empty);
    expect(sleepCharts[sleepCharts.length - 1]?.clockValues).toBe(true);
    expect(sleepCharts[sleepCharts.length - 1]?.fullWidth).toBe(true);
    expect(chartsFor('bloodPressure', empty).every((chart) => chart.showAverage)).toBe(true);
    expect(chartsFor('bloodAnalysis', empty).every((chart) => chart.zeroAsMissing)).toBe(true);
    expect(chartsFor('physicalActivity', empty).some((chart) => chart.zeroAsMissing)).toBe(false);
  });

  it('expose toutes les rubriques de santé exportables', () => {
    expect(Object.keys(reportSectionLabels)).toEqual([
      'bloodAnalysis',
      'physicalActivity',
      'weightBMI',
      'sleep',
      'bloodPressure',
      'nutrition',
    ]);
  });

  it('calcule les indicateurs de la période pour chaque rubrique', () => {
    const empty: ReportData = { bloodAnalysis: [], physicalActivity: [], weightBMI: [], sleep: [], bloodPressure: [], nutrition: [] };
    expect(indicatorsFor('bloodAnalysis', empty)).toHaveLength(6);
    expect(indicatorsFor('physicalActivity', empty)).toHaveLength(7);
    expect(indicatorsFor('weightBMI', empty)).toHaveLength(2);
    expect(indicatorsFor('bloodPressure', empty)).toHaveLength(3);
    expect(indicatorsFor('nutrition', empty)).toHaveLength(5);
  });

  it('calcule les heures moyennes autour de minuit comme la page Sommeil', () => {
    const data: ReportData = {
      bloodAnalysis: [], physicalActivity: [], weightBMI: [], bloodPressure: [], nutrition: [],
      sleep: [
        { id: '1', date: '2026-09-01', bedTime: '23:30', wakeTime: '06:30', totalSleep: 420, deepSleep: 90, lightSleep: 240, remSleep: 90, createdAt: '' },
        { id: '2', date: '2026-09-02', bedTime: '00:30', wakeTime: '07:30', totalSleep: 420, deepSleep: 90, lightSleep: 240, remSleep: 90, createdAt: '' },
      ],
    };
    const indicators = indicatorsFor('sleep', data);
    expect(indicators.find((item) => item.label === 'Heure moyenne du coucher')?.value).toBe('00:00');
    expect(indicators.find((item) => item.label === 'Heure moyenne du lever')?.value).toBe('07:00');
  });
});
