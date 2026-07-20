import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange, BloodAnalysis } from '../../models/types';
import { HealthZone } from '../../models/types';
import { useBloodAnalysisStore } from '../../stores/blood-analysis-store';
import { evaluateBloodAnalysis, evaluateField, type BloodAnalysisEvaluation } from '../../engine/rules';
import {
  convertBloodAnalysisValueForDisplay,
  getBloodAnalysisUnit,
  type BloodAnalysisUnit,
} from '../../utils/blood-analysis-units';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TrendChart, type ReferenceLineConfig } from '../ui/TrendChart';
import { PeriodSelector, type Period } from '../ui/PeriodSelector';
import { HealthIndicator } from '../ui/HealthIndicator';
import { EmptyState } from '../ui/EmptyState';
import { BloodAnalysisForm } from './BloodAnalysisForm';

type BloodAnalysisFormData = Omit<BloodAnalysis, 'id' | 'createdAt'>;

type BloodAnalysisField = 'tc' | 'hdl' | 'tg' | 'ldl' | 'tcHdlRatio' | 'glucose';
const fields: BloodAnalysisField[] = ['tc', 'hdl', 'tg', 'ldl', 'tcHdlRatio', 'glucose'];

function buildWhoReferenceLines(field: BloodAnalysisField, unit: BloodAnalysisUnit): ReferenceLineConfig[] {
  const lines: ReferenceLineConfig[] = [];
  const seen = new Set<number>();
  const thresholdMap: Record<string, { boundaries: { value: number; label: string; color: string }[] }> = {
    tc: { boundaries: [
      { value: 5.2, label: 'Désirable', color: '#22c55e' },
      { value: 6.2, label: 'Élevé', color: '#ef4444' },
    ]},
    hdl: { boundaries: [
      { value: 1.0, label: 'Bas', color: '#f59e0b' },
      { value: 1.55, label: 'Optimal', color: '#22c55e' },
    ]},
    tg: { boundaries: [
      { value: 1.7, label: 'Normal', color: '#22c55e' },
      { value: 2.3, label: 'Élevé', color: '#ef4444' },
    ]},
    ldl: { boundaries: [
      { value: 2.6, label: 'Optimal', color: '#22c55e' },
      { value: 3.4, label: 'Élevé', color: '#f59e0b' },
      { value: 4.1, label: 'Très élevé', color: '#ef4444' },
    ]},
    tcHdlRatio: { boundaries: [
      { value: 3.5, label: 'Risque faible', color: '#22c55e' },
      { value: 5, label: 'Risque élevé', color: '#ef4444' },
    ]},
    glucose: { boundaries: [
      { value: 5.6, label: 'Normal', color: '#22c55e' },
      { value: 7.0, label: 'Diabétique', color: '#ef4444' },
    ]},
  };
  const config = thresholdMap[field];
  if (config) {
    for (const b of config.boundaries) {
      if (!seen.has(b.value)) {
        seen.add(b.value);
        lines.push({
          value: convertBloodAnalysisValueForDisplay(field, b.value, unit),
          label: b.label,
          color: b.color,
        });
      }
    }
  }
  return lines;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const metricLabels: Record<string, string> = {
  tc: 'Cholestérol total',
  hdl: 'Bon cholestérol (HDL)',
  tg: 'Triglycérides',
  ldl: 'Mauvais cholestérol (LDL)',
  tcHdlRatio: 'Rapport TC/HDL',
  glucose: 'Glucose',
};

const metricIndications: Record<string, string> = {
  tc: 'Désirable',
  hdl: 'Bon cholestérol',
  tg: 'Mauvaises graisses',
  ldl: 'Mauvais cholestérol',
  tcHdlRatio: 'Risque cardio',
  glucose: 'Glycémie',
};

const metricColors: Record<string, string> = {
  tc: '#6366f1',
  hdl: '#22c55e',
  tg: '#f59e0b',
  ldl: '#ef4444',
  tcHdlRatio: '#8b5cf6',
  glucose: '#3b82f6',
};

const PAGE_SIZES = [10, 20, 50, 100, 0] as const;
type PageSize = typeof PAGE_SIZES[number];

const pageSizeLabels: Record<PageSize, string> = {
  10: '10',
  20: '20',
  50: '50',
  100: '100',
  0: 'Tout',
};

function BloodAnalysisUnitSelector({
  value,
  onChange,
}: {
  value: BloodAnalysisUnit;
  onChange: (unit: BloodAnalysisUnit) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
      <span className="whitespace-nowrap">Unité :</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as BloodAnalysisUnit)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        aria-label="Unité d'affichage des analyses sanguines"
      >
        <option value="mmol/L">mmol/L</option>
        <option value="mg/dL">mg/dL</option>
      </select>
    </label>
  );
}

export function BloodAnalysisDetail() {
  const store = useBloodAnalysisStore();
  const { records, loading, actions } = store;
  const [period, setPeriod] = useState<Period>('week');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return { start: start.toISOString(), end: now.toISOString() };
  });
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BloodAnalysis | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [displayUnit, setDisplayUnit] = useState<BloodAnalysisUnit>('mmol/L');

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
    const map = new Map<string, BloodAnalysisEvaluation>();
    for (const r of filteredRecords) {
      map.set(r.id, evaluateBloodAnalysis(r));
    }
    return map;
  }, [filteredRecords]);

  const handlePeriodChange = useCallback((p: Period, dr: DateRange) => {
    setPeriod(p);
    setDateRange(dr);
    setCurrentPage(1);
  }, []);

  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = useCallback(async (data: BloodAnalysisFormData) => {
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

  const handleUpdate = useCallback(async (data: BloodAnalysisFormData) => {
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Analyse sanguine</h2>
          <div className="flex items-center gap-3">
            <BloodAnalysisUnitSelector value={displayUnit} onChange={setDisplayUnit} />
            <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
          </div>
        </div>
        <EmptyState message="Aucune analyse sanguine" description="Ajoutez votre première analyse sanguine pour commencer le suivi." />
        <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Ajouter une analyse sanguine">
          <BloodAnalysisForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} loading={formLoading} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Analyse sanguine</h2>
        <div className="flex flex-wrap items-center gap-3">
          <BloodAnalysisUnitSelector value={displayUnit} onChange={setDisplayUnit} />
          <PeriodSelector value={period} dateRange={dateRange} onChange={handlePeriodChange} />
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <>
          <Card title="Moyennes de la période">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                const avgValues: Record<string, number> = {};
                for (const field of fields) {
                  const nonZero = filteredRecords.filter((r) => r[field] > 0);
                  if (nonZero.length > 0) {
                    const sum = nonZero.reduce((acc, r) => acc + r[field], 0);
                    avgValues[field] = Math.round((sum / nonZero.length) * 100) / 100;
                  } else {
                    avgValues[field] = 0;
                  }
                }
                return fields.map((field) => {
                  const result = evaluateField(field, avgValues[field]);
                  const displayValue = convertBloodAnalysisValueForDisplay(field, avgValues[field], displayUnit);
                  return (
                    <HealthIndicator
                      key={field}
                      zone={result.zone}
                      label={`${metricLabels[field]} (moy.)`}
                      value={displayValue}
                      unit={getBloodAnalysisUnit(field, displayUnit)}
                      zoneLabel={result.label}
                    />
                  );
                });
              })()}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Moyennes calculées sur {filteredRecords.length} enregistrement{filteredRecords.length > 1 ? 's' : ''} de la période sélectionnée.
            </p>
          </Card>

          <Card title="Graphiques de tendance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fields.map((field) => {
                const chartData = [...filteredRecords].reverse().map((r) => ({
                  date: new Date(r.date).getTime(),
                  value: r[field] > 0
                    ? convertBloodAnalysisValueForDisplay(field, r[field], displayUnit)
                    : null,
                })).filter((d) => d.value !== null);
                if (chartData.length === 0) return null;
                return (
                  <div key={field}>
                    <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {metricLabels[field]} <span className="text-xs text-slate-400">({metricIndications[field]})</span> <span className="text-xs text-slate-400">({getBloodAnalysisUnit(field, displayUnit)})</span>
                    </h4>
                    <TrendChart
                      data={chartData}
                      dataKey="value"
                      xKey="date"
                      color={metricColors[field]}
                      label={metricLabels[field]}
                      unit={getBloodAnalysisUnit(field, displayUnit)}
                      showAverage
                      referenceLines={buildWhoReferenceLines(field, displayUnit)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Enregistrements">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Par page :</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setCurrentPage(1); }}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  aria-label="Nombre d'enregistrements par page"
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
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400 w-12">Modifier</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Date</th>
                    {fields.map((field) => (
                      <th key={field} className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">
                        {metricLabels[field]}
                      </th>
                    ))}
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
                        {fields.map((field) => {
                          const result = eval_?.[field];
                          const isNormal = result?.zone === HealthZone.Normal;
                          return (
                            <td key={field} className="px-4 py-3 text-center whitespace-nowrap">
                              <span
                                className={`${isNormal ? 'text-slate-900 dark:text-slate-100' : 'font-semibold'}${!isNormal && result?.color ? ' dynamic-color' : ''}`}
                                data-color={!isNormal && result?.color ? result.color : undefined}
                              >
                                {convertBloodAnalysisValueForDisplay(field, record[field], displayUnit)}
                                <span className="ml-1 text-xs text-slate-400"> {getBloodAnalysisUnit(field, displayUnit)}</span>
                              </span>
                              {result && (
                                <span className="ml-1 text-xs opacity-70">({result.label})</span>
                              )}
                            </td>
                          );
                        })}
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

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setAddError(null); }} title="Ajouter une analyse sanguine">
        {addError && showForm && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
          </div>
        )}
        <BloodAnalysisForm onSubmit={handleAdd} onCancel={() => { setShowForm(false); setAddError(null); }} loading={formLoading} />
      </Modal>

      <Modal isOpen={editingRecord !== null} onClose={() => { setEditingRecord(null); setAddError(null); }} title="Modifier l'analyse sanguine">
        {addError && editingRecord !== null && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
          </div>
        )}
        {editingRecord && (
          <BloodAnalysisForm initialData={editingRecord} onSubmit={handleUpdate} onCancel={() => { setEditingRecord(null); setAddError(null); }} loading={formLoading} />
        )}
      </Modal>

      <Modal isOpen={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Êtes-vous sûr de vouloir supprimer cet enregistrement d'analyse sanguine ? Cette action est irréversible.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
