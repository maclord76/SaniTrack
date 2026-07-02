import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange, WeightBMI } from '../../models/types';
import { useWeightBMIStore } from '../../stores/weight-bmi-store';
import { useSettingsStore } from '../../stores/settings-store';
import { evaluateBMI, evaluateField, type BMIEvaluation } from '../../engine/rules';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TrendChart, type ReferenceLineConfig } from '../ui/TrendChart';
import { PeriodSelector, type Period } from '../ui/PeriodSelector';
import { HealthIndicator } from '../ui/HealthIndicator';
import { EmptyState } from '../ui/EmptyState';
import { WeightBMIForm } from './WeightBMIForm';

type WeightBMIFormData = Omit<WeightBMI, 'id' | 'createdAt'>;

const bmiThresholds = [
  { bmi: 18.5, label: 'Insuffisance pondérale', color: '#3b82f6' },
  { bmi: 25, label: 'Normal', color: '#22c55e' },
  { bmi: 30, label: 'Surpoids', color: '#f59e0b' },
  { bmi: 35, label: 'Obésité I', color: '#ef4444' },
  { bmi: 40, label: 'Obésité II+', color: '#991b1b' },
];

function buildWeightRefLines(heightCm: number): ReferenceLineConfig[] {
  if (heightCm <= 0) return [];
  const heightM = heightCm / 100;
  return bmiThresholds.map(({ bmi, label, color }) => {
    const weightKg = Math.round(bmi * heightM * heightM * 10) / 10;
    return {
      value: weightKg,
      label: `${label} (${bmi} → ${weightKg} kg)`,
      color,
      strokeDasharray: '4 2',
    };
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const PAGE_SIZES = [10, 20, 50, 100, 0] as const;
type PageSize = typeof PAGE_SIZES[number];

const pageSizeLabels: Record<PageSize, string> = {
  10: '10',
  20: '20',
  50: '50',
  100: '100',
  0: 'Tout',
};

export function WeightBMIDetail() {
  const store = useWeightBMIStore();
  const { records, loading, actions } = store;
  const settings = useSettingsStore();
  const defaultHeight = settings.height;
  const [heightInput, setHeightInput] = useState(String(settings.height));
  const [period, setPeriod] = useState<Period>('week');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return { start: start.toISOString(), end: now.toISOString() };
  });
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WeightBMI | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    actions.fetchAll();
    settings.actions.loadSettings();
  }, [actions, settings.actions]);

  useEffect(() => {
    setHeightInput(String(settings.height));
  }, [settings.height]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const d = new Date(r.date).getTime();
      return d >= new Date(dateRange.start).getTime() && d <= new Date(dateRange.end).getTime();
    });
  }, [records, dateRange]);

  const evaluations = useMemo(() => {
    const map = new Map<string, BMIEvaluation>();
    for (const r of filteredRecords) {
      map.set(r.id, evaluateBMI(r));
    }
    return map;
  }, [filteredRecords]);

  const weightChartData = useMemo(() => {
    return [...filteredRecords].reverse().map((r) => ({
      date: new Date(r.date).getTime(),
      mass: r.mass,
    }));
  }, [filteredRecords]);

  const handlePeriodChange = useCallback((p: Period, dr: DateRange) => {
    setPeriod(p);
    setDateRange(dr);
    setCurrentPage(1);
  }, []);

  const handleAdd = useCallback(async (data: WeightBMIFormData) => {
    setFormLoading(true);
    setAddError(null);
    try {
      await actions.addRecord({
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      });
      setShowForm(false);
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setFormLoading(false);
    }
  }, [actions]);

  const handleUpdate = useCallback(async (data: WeightBMIFormData) => {
    if (!editingRecord) return;
    setFormLoading(true);
    setAddError(null);
    try {
      await actions.updateRecord(editingRecord.id, {
        ...data,
        createdAt: editingRecord.createdAt,
      });
      setEditingRecord(null);
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setFormLoading(false);
    }
  }, [actions, editingRecord]);

  const handleDelete = useCallback(async (id: string) => {
    await actions.deleteRecord(id);
    setDeleteConfirmId(null);
  }, [actions]);

  const paginatedRecords = useMemo(() => {
    if (pageSize === 0) return filteredRecords;
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, pageSize, currentPage]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  }, [filteredRecords.length, pageSize]);

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="h-8 w-8 animate-spin text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Poids / IMC</h2>
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Taille :</label>
          <span className="inline-flex items-center w-20 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
            {heightInput || '\u2014'}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">cm</span>
        </div>
        <EmptyState message="Aucun enregistrement de poids" description="Ajoutez votre première entrée de poids pour commencer le suivi." />
        <Modal isOpen={showForm} onClose={() => { setShowForm(false); setAddError(null); }} title="Ajouter une entrée de poids">
          {addError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
            </div>
          )}
          <WeightBMIForm onSubmit={handleAdd} onCancel={() => { setShowForm(false); setAddError(null); }} loading={formLoading} defaultHeight={defaultHeight} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Poids / IMC</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Taille :</label>
            <span className="inline-flex items-center w-20 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
              {heightInput || '\u2014'}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">cm</span>
          </div>
          <PeriodSelector value={period} dateRange={dateRange} onChange={handlePeriodChange} />
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <>
          <Card title="Moyennes de la période">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => {
                const nonZeroMass = filteredRecords.filter((r) => r.mass > 0);
                const avgMass = nonZeroMass.length > 0
                  ? Math.round((nonZeroMass.reduce((s, r) => s + r.mass, 0) / nonZeroMass.length) * 10) / 10
                  : 0;
                const nonZeroBmi = filteredRecords.filter((r) => r.bmi > 0);
                const avgBmi = nonZeroBmi.length > 0
                  ? Math.round((nonZeroBmi.reduce((s, r) => s + r.bmi, 0) / nonZeroBmi.length) * 10) / 10
                  : 0;
                const bmiResult = evaluateField('bmi', avgBmi);
                return (
                  <>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                      <p className="text-sm text-slate-500 dark:text-slate-400">Poids (moy.)</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{avgMass} kg</p>
                    </div>
                    <HealthIndicator
                      zone={bmiResult.zone}
                      label="IMC (moy.)"
                      value={avgBmi}
                      unit="kg/m²"
                      zoneLabel={bmiResult.label}
                    />
                  </>
                );
              })()}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Moyennes calculées sur {filteredRecords.length} enregistrement{filteredRecords.length > 1 ? 's' : ''} de la période sélectionnée.
            </p>
          </Card>

          <Card title="Graphiques de tendance">
            {defaultHeight > 0 ? (
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Poids (kg) avec repères IMC OMS (taille : {defaultHeight} cm)</h4>
                <TrendChart data={weightChartData} dataKey="mass" xKey="date" color="#6366f1" label="Poids" unit="kg" showAverage referenceLines={buildWeightRefLines(defaultHeight)} />
              </div>
            ) : (
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Poids (kg)</h4>
                <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">Entrez votre taille (en cm) ci-dessus pour afficher les repères IMC OMS sur le graphique.</p>
                <TrendChart data={weightChartData} dataKey="mass" xKey="date" color="#6366f1" label="Poids" unit="kg" showAverage />
              </div>
            )}
          </Card>

          <Card title="Enregistrements">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Par page :</span>
                <select
                  title="Nombre d'éléments par page"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setCurrentPage(1); }}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{pageSizeLabels[s]}</option>
                  ))}
                </select>
              </div>
              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    Précédent
                  </Button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {currentPage} / {totalPages}
                  </span>
                  <Button variant="secondary" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    Suivant
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400 w-12">Modifier</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Date</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Poids (kg)</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Taille (cm)</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">IMC</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Catégorie</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400 w-12">Supprimer</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => {
                    const eval_ = evaluations.get(record.id);
                    return (
                      <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <Button variant="secondary" size="sm" onClick={() => setEditingRecord(record)}>
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{record.mass}</td>
                        <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{record.height}</td>
                        <td className={`px-4 py-3 text-center font-semibold${eval_ ? ' dynamic-color-cell' : ''}`} data-color={eval_?.bmi.color}>
                          <span className={eval_ ? 'dynamic-color' : ''} data-color={eval_?.bmi.color}>{record.bmi.toFixed(1)}</span>
                        </td>
                        <td className={`px-4 py-3 text-center${eval_ ? ' dynamic-badge-cell' : ''}`} data-badge-bg={eval_?.bmi.color} data-badge-color={eval_?.bmi.color}>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium${eval_ ? ' dynamic-badge' : ''}`}
                            data-badge-bg={eval_?.bmi.color} data-badge-color={eval_?.bmi.color}
                          >
                            {eval_?.bmi.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <Button variant="danger" size="sm" onClick={() => setDeleteConfirmId(record.id)}>
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <EmptyState message="Aucun enregistrement pour la période sélectionnée" description="Essayez de changer la période ou ajoutez un nouvel enregistrement." />
      )}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setAddError(null); }} title="Ajouter une entrée de poids">
        {addError && showForm && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
          </div>
        )}
        <WeightBMIForm onSubmit={handleAdd} onCancel={() => { setShowForm(false); setAddError(null); }} loading={formLoading} defaultHeight={defaultHeight} />
      </Modal>

      <Modal isOpen={editingRecord !== null} onClose={() => { setEditingRecord(null); setAddError(null); }} title="Modifier l'entrée de poids">
        {addError && editingRecord !== null && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
          </div>
        )}
        {editingRecord && (
          <WeightBMIForm initialData={editingRecord} onSubmit={handleUpdate} onCancel={() => { setEditingRecord(null); setAddError(null); }} loading={formLoading} defaultHeight={defaultHeight} />
        )}
      </Modal>

      <Modal isOpen={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Êtes-vous sûr de vouloir supprimer cet enregistrement de poids ? Cette action est irréversible.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}