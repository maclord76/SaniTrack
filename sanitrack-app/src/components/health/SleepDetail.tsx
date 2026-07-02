/* cSpell:ignore Recommandé dessous Excessif Moyennes période Sommeil profond Ajouter Ajoutez Supprimer Annuler Aucun enregistrement votre commencer suivi paradoxal */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import type { DateRange, Sleep } from '../../models/types';
import { useSleepStore } from '../../stores/sleep-store';
import { useSettingsStore } from '../../stores/settings-store';
import { evaluateField } from '../../engine/rules';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TrendChart } from '../ui/TrendChart';
import { PeriodSelector, type Period } from '../ui/PeriodSelector';
import { HealthIndicator } from '../ui/HealthIndicator';
import { EmptyState } from '../ui/EmptyState';
import { SleepForm } from './SleepForm';

type SleepFormData = Omit<Sleep, 'id' | 'createdAt'>;

const PAGE_SIZES = [10, 20, 50, 100, 0] as const;
type PageSize = typeof PAGE_SIZES[number];

const pageSizeLabels: Record<PageSize, string> = {
  10: '10',
  20: '20',
  50: '50',
  100: '100',
  0: 'Tout',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function computeAvg(records: Sleep[], field: 'totalSleep' | 'deepSleep' | 'remSleep'): number {
  const nonZero = records.filter((r) => r[field] > 0);
  if (nonZero.length === 0) return 0;
  return Math.round(nonZero.reduce((s, r) => s + r[field], 0) / nonZero.length);
}

function computeAvgEfficiency(records: Sleep[]): number | null {
  const withEff = records.filter((r) => r.efficiency != null && r.efficiency > 0);
  if (withEff.length === 0) return null;
  return Math.round(withEff.reduce((s, r) => s + (r.efficiency as number), 0) / withEff.length);
}

export function SleepDetail() {
  const store = useSleepStore();
  const { records, loading, actions } = store;
  const [period, setPeriod] = useState<Period>('week');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return { start: start.toISOString(), end: now.toISOString() };
  });
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Sleep | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const settings = useSettingsStore();
  const sleepTotalThresholds = settings.thresholds.find((t) => t.key === 'sleepTotal');
  const refMin = sleepTotalThresholds?.bounds.find((b) => b.label === 'Recommandé min')?.value ?? 420;
  const refMax = sleepTotalThresholds?.bounds.find((b) => b.label === 'Recommandé max')?.value ?? 540;
  const refLow = sleepTotalThresholds?.bounds.find((b) => b.label === 'En dessous')?.value ?? 360;
  const refHigh = sleepTotalThresholds?.bounds.find((b) => b.label === 'Excessif')?.value ?? 600;

  useEffect(() => {
    actions.fetchAll();
  }, [actions]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const d = new Date(r.date).getTime();
      return d >= new Date(dateRange.start).getTime() && d <= new Date(dateRange.end).getTime();
    });
  }, [records, dateRange]);

  const trendData = useMemo(() => {
    return [...filteredRecords].reverse().map((r) => {
      const total = r.totalSleep || 1;
      return {
        date: new Date(r.date).getTime(),
        totalSleep: r.totalSleep,
        deepSleep: r.deepSleep,
        lightSleep: r.lightSleep,
        remSleep: r.remSleep,
        deepPct: Math.round((r.deepSleep / total) * 100),
        lightPct: Math.round((r.lightSleep / total) * 100),
        remPct: Math.round((r.remSleep / total) * 100),
      };
    });
  }, [filteredRecords]);

  const stackedData = useMemo(() => {
    return [...filteredRecords].reverse().map((r) => ({
      date: formatDate(r.date),
      deep: r.deepSleep,
      light: r.lightSleep,
      rem: r.remSleep,
    }));
  }, [filteredRecords]);

  const yAxisMax = useMemo(() => {
    const maxData = Math.max(
      ...stackedData.map((d) => d.deep + d.light + d.rem),
      refHigh
    );
    return Math.ceil(maxData / 60) * 60;
  }, [stackedData, refHigh]);

  const handlePeriodChange = useCallback((p: Period, dr: DateRange) => {
    setPeriod(p);
    setDateRange(dr);
    setCurrentPage(1);
  }, []);

  const handleAdd = useCallback(async (data: SleepFormData) => {
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

  const handleUpdate = useCallback(async (data: SleepFormData) => {
    if (!editingRecord) return;
    setFormLoading(true);
    setAddError(null);
    try {
      await actions.updateRecord(editingRecord.id, { ...data, createdAt: editingRecord.createdAt });
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sommeil</h2>
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
        <EmptyState message="Aucun enregistrement de sommeil" description="Ajoutez votre premier enregistrement de sommeil pour commencer le suivi." />
        <Modal isOpen={showForm} onClose={() => { setShowForm(false); setAddError(null); }} title="Ajouter un enregistrement de sommeil">
          {addError && showForm && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
            </div>
          )}
          <SleepForm onSubmit={handleAdd} onCancel={() => { setShowForm(false); setAddError(null); }} loading={formLoading} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sommeil</h2>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} dateRange={dateRange} onChange={handlePeriodChange} />
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <>
          <Card title="Moyennes de la période">
            {(() => {
              const avgTotalSleep = computeAvg(filteredRecords, 'totalSleep');
              const avgDeepSleep = computeAvg(filteredRecords, 'deepSleep');
              const avgRemSleep = computeAvg(filteredRecords, 'remSleep');
              const avgEfficiency = computeAvgEfficiency(filteredRecords);
              const totalResult = evaluateField('sleepTotal', avgTotalSleep);
              const deepResult = evaluateField('sleepDeep', avgDeepSleep);
              const remResult = evaluateField('sleepRem', avgRemSleep);
              const effResult = avgEfficiency != null ? evaluateField('sleepEfficiency', avgEfficiency) : null;
              return (
                <>
                  <div className={`grid grid-cols-1 gap-3 ${effResult ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
                    <HealthIndicator
                      zone={totalResult.zone}
                      label="Sommeil total (moy.)"
                      value={formatMinutes(avgTotalSleep)}
                      zoneLabel={totalResult.label}
                    />
                    <HealthIndicator
                      zone={deepResult.zone}
                      label="Sommeil profond (moy.)"
                      value={formatMinutes(avgDeepSleep)}
                      zoneLabel={deepResult.label}
                    />
                    <HealthIndicator
                      zone={remResult.zone}
                      label="Sommeil paradoxal (moy.)"
                      value={formatMinutes(avgRemSleep)}
                      zoneLabel={remResult.label}
                    />
                    {effResult && (
                      <HealthIndicator
                        zone={effResult.zone}
                        label="Efficacité (moy.)"
                        value={`${avgEfficiency}%`}
                        zoneLabel={effResult.label}
                      />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Moyennes calculées sur {filteredRecords.length} enregistrement{filteredRecords.length > 1 ? 's' : ''} de la période sélectionnée.
                  </p>
                </>
              );
            })()}
          </Card>

          <Card title="Composition des phases de sommeil">
            <div className="h-64 w-full">
              {stackedData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      className="dark:[&_.recharts-text]:fill-slate-400 [&_.recharts-text]:fill-slate-500"
                    />
                    <YAxis
                      domain={[0, yAxisMax]}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      className="dark:[&_.recharts-text]:fill-slate-400 [&_.recharts-text]:fill-slate-500"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, #fff)',
                        border: '1px solid var(--tooltip-border, #e2e8f0)',
                        borderRadius: '0.75rem',
                        fontSize: '0.875rem',
                        color: 'var(--tooltip-color, #1e293b)',
                      }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = { deep: 'Profond', light: 'Léger', rem: 'Paradoxal' };
                        return [`${Math.round(value)} min`, labels[name] ?? name];
                      }}
                    />
                    <Bar dataKey="deep" stackId="sleep" fill="#6366f1" name="deep" />
                    <Bar dataKey="light" stackId="sleep" fill="#22c55e" name="light" />
                    <Bar dataKey="rem" stackId="sleep" fill="#f59e0b" name="rem" />
                    <ReferenceLine y={refLow} stroke="#6b7280" strokeWidth={2} strokeDasharray="4 3" label={{ value: 'Sévèrement insuffisant', position: 'insideLeft', fill: '#000000', fontSize: 11 }} />
                    <ReferenceLine y={refMin} stroke="#16a34a" strokeWidth={2.5} strokeDasharray="6 4" label={{ value: 'Recommandé min', position: 'insideLeft', fill: '#000000', fontSize: 11 }} />
                    <ReferenceLine y={refMax} stroke="#16a34a" strokeWidth={2.5} strokeDasharray="6 4" label={{ value: 'Recommandé max', position: 'insideLeft', fill: '#000000', fontSize: 11 }} />
                    <ReferenceLine y={refHigh} stroke="#6b7280" strokeWidth={2} strokeDasharray="4 3" label={{ value: 'Excessif', position: 'insideLeft', fill: '#000000', fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  Aucune donnée disponible
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-indigo-500" />
                <span className="text-slate-600 dark:text-slate-400">Profond</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
                <span className="text-slate-600 dark:text-slate-400">Léger</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-500" />
                <span className="text-slate-600 dark:text-slate-400">Paradoxal</span>
              </div>
            </div>
          </Card>

          <Card title="Graphiques de tendance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Sommeil total (min)</h4>
                <TrendChart data={trendData} dataKey="totalSleep" xKey="date" color="#6366f1" label="Sommeil total" unit="min" showAverage showRegression />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Sommeil profond (%)</h4>
                <TrendChart data={trendData} dataKey="deepPct" xKey="date" color="#8b5cf6" label="Sommeil profond" unit="%" showAverage showRegression />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Sommeil léger (%)</h4>
                <TrendChart data={trendData} dataKey="lightPct" xKey="date" color="#22c55e" label="Sommeil léger" unit="%" showAverage showRegression />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Sommeil paradoxal (%)</h4>
                <TrendChart data={trendData} dataKey="remPct" xKey="date" color="#f59e0b" label="Sommeil paradoxal" unit="%" showAverage showRegression />
              </div>
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
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Total</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Profond</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Profond %</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Léger</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Léger %</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Paradoxal</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Paradoxal %</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Efficacité</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400 w-12">Supprimer</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => {
                    const total = record.totalSleep || 1;
                    const deepPct = Math.round((record.deepSleep / total) * 100);
                    const lightPct = Math.round((record.lightSleep / total) * 100);
                    const remPct = Math.round((record.remSleep / total) * 100);
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
                        <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{formatMinutes(record.totalSleep)}</td>
                        <td className="px-4 py-3 text-center text-indigo-600 dark:text-indigo-400">{formatMinutes(record.deepSleep)}</td>
                        <td className="px-4 py-3 text-center text-indigo-600 dark:text-indigo-400">{deepPct}%</td>
                        <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{formatMinutes(record.lightSleep)}</td>
                        <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{lightPct}%</td>
                        <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">{formatMinutes(record.remSleep)}</td>
                        <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">{remPct}%</td>
                        <td className="px-4 py-3 text-center text-cyan-600 dark:text-cyan-400">
                          {record.efficiency != null ? `${record.efficiency}%` : '—'}
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

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setAddError(null); }} title="Ajouter un enregistrement de sommeil">
        {addError && showForm && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
          </div>
        )}
        <SleepForm onSubmit={handleAdd} onCancel={() => { setShowForm(false); setAddError(null); }} loading={formLoading} />
      </Modal>

      <Modal isOpen={editingRecord !== null} onClose={() => { setEditingRecord(null); setAddError(null); }} title="Modifier l'enregistrement de sommeil">
        {addError && editingRecord !== null && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{addError}</p>
          </div>
        )}
        {editingRecord && (
          <SleepForm initialData={editingRecord} onSubmit={handleUpdate} onCancel={() => { setEditingRecord(null); setAddError(null); }} loading={formLoading} />
        )}
      </Modal>

      <Modal isOpen={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Êtes-vous sûr de vouloir supprimer cet enregistrement de sommeil ? Cette action est irréversible.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}