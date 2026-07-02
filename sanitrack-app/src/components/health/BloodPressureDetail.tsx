import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange, BloodPressure } from '../../models/types';
import { useBloodPressureStore } from '../../stores/blood-pressure-store';
import { evaluateBloodPressure, evaluateField, type BloodPressureEvaluation } from '../../engine/rules';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TrendChart, type ReferenceLineConfig } from '../ui/TrendChart';
import { PeriodSelector, type Period } from '../ui/PeriodSelector';
import { HealthIndicator } from '../ui/HealthIndicator';
import { EmptyState } from '../ui/EmptyState';
import { BloodPressureForm } from './BloodPressureForm';

type BloodPressureFormData = Omit<BloodPressure, 'id' | 'createdAt'>;

const systolicRefLines: ReferenceLineConfig[] = [
  { value: 120, label: 'Normal', color: '#22c55e' },
  { value: 130, label: 'Élevé', color: '#f59e0b' },
  { value: 140, label: 'HTA stade 1', color: '#ef4444' },
  { value: 180, label: 'HTA stade 3', color: '#991b1b' },
];

const diastolicRefLines: ReferenceLineConfig[] = [
  { value: 80, label: 'Normal', color: '#22c55e' },
  { value: 85, label: 'Élevé', color: '#f59e0b' },
  { value: 90, label: 'HTA stade 1', color: '#ef4444' },
  { value: 110, label: 'HTA stade 3', color: '#991b1b' },
];

const pulseRefLines: ReferenceLineConfig[] = [
  { value: 60, label: 'Normal', color: '#22c55e' },
  { value: 100, label: 'Tachycardie', color: '#ef4444' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const PAGE_SIZES = [10, 20, 50, 100, 0] as const;
type PageSize = typeof PAGE_SIZES[number];
const pageSizeLabels: Record<PageSize, string> = { 10: '10', 20: '20', 50: '50', 100: '100', 0: 'Tout' };

export function BloodPressureDetail() {
  const store = useBloodPressureStore();
  const { records, loading, actions } = store;
  const [period, setPeriod] = useState<Period>('week');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return { start: start.toISOString(), end: now.toISOString() };
  });
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BloodPressure | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    actions.fetchAll();
  }, [actions]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const d = new Date(r.date).getTime();
      return d >= new Date(dateRange.start).getTime() && d <= new Date(dateRange.end).getTime();
    });
  }, [records, dateRange]);

  const evaluations = useMemo(() => {
    const map = new Map<string, BloodPressureEvaluation>();
    for (const r of filteredRecords) {
      map.set(r.id, evaluateBloodPressure(r));
    }
    return map;
  }, [filteredRecords]);

  const chartData = useMemo(() => {
    return [...filteredRecords].reverse().map((r) => ({
      date: new Date(r.date).getTime(),
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse ?? 0,
    }));
  }, [filteredRecords]);

  const hasPulseData = useMemo(() => {
    return filteredRecords.some((r) => r.pulse && r.pulse > 0);
  }, [filteredRecords]);

  const handlePeriodChange = useCallback((p: Period, dr: DateRange) => {
    setPeriod(p);
    setDateRange(dr);
    setCurrentPage(1);
  }, []);

  const handleAdd = useCallback(async (data: BloodPressureFormData) => {
    setFormLoading(true);
    setAddError(null);
    try {
      await actions.addRecord({
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      } as BloodPressure);
      setShowForm(false);
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setFormLoading(false);
    }
  }, [actions]);

  const handleUpdate = useCallback(async (data: BloodPressureFormData) => {
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pression artérielle</h2>
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
        <EmptyState message="Aucun enregistrement de pression artérielle" description="Ajoutez votre première mesure pour commencer le suivi." />
        <Modal isOpen={showForm} onClose={() => { setShowForm(false); setAddError(null); }} title="Ajouter une pression artérielle">
          {addError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
            </div>
          )}
          <BloodPressureForm onSubmit={handleAdd} onCancel={() => { setShowForm(false); setAddError(null); }} loading={formLoading} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pression artérielle</h2>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} dateRange={dateRange} onChange={handlePeriodChange} />
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <>
          <Card title="Moyennes de la période">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                const nonZeroSys = filteredRecords.filter((r) => r.systolic > 0);
                const avgSystolic = nonZeroSys.length > 0
                  ? Math.round(nonZeroSys.reduce((s, r) => s + r.systolic, 0) / nonZeroSys.length)
                  : 0;
                const nonZeroDia = filteredRecords.filter((r) => r.diastolic > 0);
                const avgDiastolic = nonZeroDia.length > 0
                  ? Math.round(nonZeroDia.reduce((s, r) => s + r.diastolic, 0) / nonZeroDia.length)
                  : 0;
                const pulseRecords = filteredRecords.filter((r) => r.pulse && r.pulse > 0);
                const avgPulse = pulseRecords.length > 0
                  ? Math.round(pulseRecords.reduce((s, r) => s + (r.pulse ?? 0), 0) / pulseRecords.length)
                  : null;

                const systolicResult = evaluateField('systolic', avgSystolic);
                const diastolicResult = evaluateField('diastolic', avgDiastolic);

                return (
                  <>
                    <HealthIndicator
                      zone={systolicResult.zone}
                      label="Systolique (moy.)"
                      value={avgSystolic}
                      unit="mmHg"
                      zoneLabel={systolicResult.label}
                    />
                    <HealthIndicator
                      zone={diastolicResult.zone}
                      label="Diastolique (moy.)"
                      value={avgDiastolic}
                      unit="mmHg"
                      zoneLabel={diastolicResult.label}
                    />
                    {avgPulse !== null && (
                      <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Pouls (moy.)</span>
                          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {avgPulse}
                            <span className="ml-1 text-xs font-normal text-slate-400">bpm</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="mt-3 text-center">
              {(() => {
                const nonZeroSys = filteredRecords.filter((r) => r.systolic > 0);
                const avgSystolic = nonZeroSys.length > 0
                  ? Math.round(nonZeroSys.reduce((s, r) => s + r.systolic, 0) / nonZeroSys.length)
                  : 0;
                const nonZeroDia = filteredRecords.filter((r) => r.diastolic > 0);
                const avgDiastolic = nonZeroDia.length > 0
                  ? Math.round(nonZeroDia.reduce((s, r) => s + r.diastolic, 0) / nonZeroDia.length)
                  : 0;
                const combinedEval = evaluateBloodPressure({ id: '', date: '', systolic: avgSystolic, diastolic: avgDiastolic, createdAt: '' });
                return (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
                    data-color={combinedEval.combinedColor}
                    data-bg-color={combinedEval.combinedColor}
                  >
                    {combinedEval.combinedLabel}
                  </span>
                );
              })()}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Moyennes calculées sur {filteredRecords.length} enregistrement{filteredRecords.length > 1 ? 's' : ''} de la période sélectionnée.
            </p>
          </Card>

          <Card title="Graphiques de tendance">
            <TrendChart
              data={chartData}
              dataKey="systolic"
              xKey="date"
              color="#ef4444"
              label="Systolique"
              unit="mmHg"
              showAverage
              referenceLines={systolicRefLines}
            />
            <div className="mt-6">
              <TrendChart
                data={chartData}
                dataKey="diastolic"
                xKey="date"
                color="#3b82f6"
                label="Diastolique"
                unit="mmHg"
                showAverage
                referenceLines={diastolicRefLines}
              />
            </div>
            {hasPulseData && (
              <div className="mt-6">
                <TrendChart
                  data={chartData.filter((d) => d.pulse > 0)}
                  dataKey="pulse"
                  xKey="date"
                  color="#8b5cf6"
                  label="Pouls"
                  unit="bpm"
                  showAverage
                  referenceLines={pulseRefLines}
                />
              </div>
            )}
            <div className="mt-3 flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-500" />
                <span className="text-slate-600 dark:text-slate-400">Systolique</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-blue-500" />
                <span className="text-slate-600 dark:text-slate-400">Diastolique</span>
              </div>
              {hasPulseData && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-violet-500" />
                  <span className="text-slate-600 dark:text-slate-400">Pouls</span>
                </div>
              )}
            </div>
          </Card>

          <Card title="Enregistrements">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <label htmlFor="page-size-select" className="text-sm text-slate-600 dark:text-slate-400">Par page :</label>
                <select
                  id="page-size-select"
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
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400 w-12">Modifier</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Date</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Systolique</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Diastolique</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Pouls</th>
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
                        <td className="px-4 py-3 text-center font-semibold" data-color={eval_ ? eval_.systolic.color : undefined}>
                          <span className={eval_ ? 'dynamic-color' : ''}>{record.systolic}</span> <span className="text-xs font-normal text-slate-400">mmHg</span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold" data-color={eval_ ? eval_.diastolic.color : undefined}>
                          <span className={eval_ ? 'dynamic-color' : ''}>{record.diastolic}</span> <span className="text-xs font-normal text-slate-400">mmHg</span>
                        </td>
                        <td className="px-4 py-3 text-center" data-color={eval_?.pulse ? eval_.pulse.color : undefined}>
                          {record.pulse ? <><span className={eval_?.pulse ? 'dynamic-color' : ''}>{record.pulse}</span> <span className="text-xs font-normal text-slate-400">bpm</span></> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {eval_ && (
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                              data-color={eval_.combinedColor}
                              data-bg-color={eval_.combinedColor}
                            >
                              {eval_.combinedLabel}
                            </span>
                          )}
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

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setAddError(null); }} title="Ajouter une pression artérielle">
        {addError && showForm && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
          </div>
        )}
        <BloodPressureForm onSubmit={handleAdd} onCancel={() => { setShowForm(false); setAddError(null); }} loading={formLoading} />
      </Modal>

      <Modal isOpen={editingRecord !== null} onClose={() => { setEditingRecord(null); setAddError(null); }} title="Modifier la pression artérielle">
        {addError && editingRecord !== null && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
          </div>
        )}
        {editingRecord && (
          <BloodPressureForm initialData={editingRecord} onSubmit={handleUpdate} onCancel={() => { setEditingRecord(null); setAddError(null); }} loading={formLoading} />
        )}
      </Modal>

      <Modal isOpen={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Êtes-vous sûr de vouloir supprimer cet enregistrement de pression artérielle ? Cette action est irréversible.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}