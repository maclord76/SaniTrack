import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange, PhysicalActivity } from '../../models/types';
import { usePhysicalActivityStore } from '../../stores/physical-activity-store';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TrendChart } from '../ui/TrendChart';
import { PeriodSelector, type Period } from '../ui/PeriodSelector';
import { EmptyState } from '../ui/EmptyState';
import { PhysicalActivityForm } from './PhysicalActivityForm';

type PhysicalActivityFormData = Omit<PhysicalActivity, 'id' | 'createdAt'>;

const PAGE_SIZES = [10, 20, 50, 100, 0] as const;
type PageSize = (typeof PAGE_SIZES)[number];
const pageSizeLabels: Record<PageSize, string> = { 10: '10', 20: '20', 50: '50', 100: '100', 0: 'Tout' };

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function avgExcludingZero(values: number[]): number {
  const nonZero = values.filter((v) => v !== 0);
  if (nonZero.length === 0) return 0;
  return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
}

export function PhysicalActivityDetail() {
  const store = usePhysicalActivityStore();
  const { records, loading, actions } = store;
  const [period, setPeriod] = useState<Period>('week');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return { start: start.toISOString(), end: now.toISOString() };
  });
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PhysicalActivity | null>(null);
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

  const periodAverages = useMemo(() => {
    if (filteredRecords.length === 0) return null;
    const avgDistance = avgExcludingZero(filteredRecords.map((r) => r.distance));
    const avgDuration = avgExcludingZero(filteredRecords.map((r) => r.duration));
    const avgCalories = avgExcludingZero(filteredRecords.map((r) => r.totalCalories));
    const avgSpeed = avgExcludingZero(filteredRecords.map((r) => r.averageSpeed));
    const avgHeartRate = avgExcludingZero(filteredRecords.map((r) => r.averageHeartRate));
    const avgAerobicStress = avgExcludingZero(filteredRecords.map((r) => r.aerobicTrainingStress));
    const avgAnaerobicStress = avgExcludingZero(filteredRecords.map((r) => r.anaerobicTrainingStress));
    return { avgDistance, avgDuration, avgCalories, avgSpeed, avgHeartRate, avgAerobicStress, avgAnaerobicStress };
  }, [filteredRecords]);

  const chartData = useMemo(() => {
    return [...filteredRecords].reverse().map((r) => ({
      date: new Date(r.date).getTime(),
      distance: r.distance,
      speed: r.averageSpeed,
      calories: r.totalCalories,
      aerobicStress: r.aerobicTrainingStress,
      anaerobicStress: r.anaerobicTrainingStress,
    }));
  }, [filteredRecords]);

  const handlePeriodChange = useCallback((p: Period, dr: DateRange) => {
    setPeriod(p);
    setDateRange(dr);
    setCurrentPage(1);
  }, []);

  const handleAdd = useCallback(async (data: PhysicalActivityFormData) => {
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

  const handleUpdate = useCallback(async (data: PhysicalActivityFormData) => {
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Activité physique</h2>
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
        <EmptyState message="Aucune activité physique" description="Ajoutez votre première activité pour commencer le suivi." />
        <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Ajouter une activité physique">
          <PhysicalActivityForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} loading={formLoading} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Activité physique</h2>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} dateRange={dateRange} onChange={handlePeriodChange} />
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <>
          {periodAverages && (
            <Card title="Moyennes de la période">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                <div className="text-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Distance</p>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{periodAverages.avgDistance.toFixed(2)} km</p>
                </div>
                <div className="text-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Durée</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatDuration(Math.round(periodAverages.avgDuration))}</p>
                </div>
                <div className="text-center rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Calories</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{Math.round(periodAverages.avgCalories)} kcal</p>
                </div>
                <div className="text-center rounded-xl bg-orange-50 dark:bg-orange-900/20 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Vitesse moyenne</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{periodAverages.avgSpeed.toFixed(1)} km/h</p>
                </div>
                <div className="text-center rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fréquence cardiaque</p>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{Math.round(periodAverages.avgHeartRate)} bpm</p>
                </div>
                <div className="text-center rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Stress aérobie</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{periodAverages.avgAerobicStress.toFixed(1)}</p>
                </div>
                <div className="text-center rounded-xl bg-purple-50 dark:bg-purple-900/20 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Stress anaérobie</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{periodAverages.avgAnaerobicStress.toFixed(1)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Moyennes calculées sur {filteredRecords.length} enregistrement{filteredRecords.length > 1 ? 's' : ''} de la période sélectionnée.
              </p>
            </Card>
          )}

          <Card title="Graphiques de tendance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Distance (km)</h4>
                <TrendChart data={chartData} dataKey="distance" xKey="date" color="#6366f1" label="Distance" unit="km" showAverage />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Vitesse moyenne (km/h)</h4>
                <TrendChart data={chartData} dataKey="speed" xKey="date" color="#22c55e" label="Vitesse" unit="km/h" showAverage />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Calories (kcal)</h4>
                <TrendChart data={chartData} dataKey="calories" xKey="date" color="#f59e0b" label="Calories" unit="kcal" showAverage />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Stress d'entraînement</h4>
                <TrendChart 
                  data={chartData} 
                  xKey="date" 
                  series={[
                    { dataKey: 'aerobicStress', color: '#3b82f6', label: 'Aérobie' },
                    { dataKey: 'anaerobicStress', color: '#a855f7', label: 'Anaérobie' },
                  ]}
                />
              </div>
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
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400 w-12">Modifier</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Date</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Distance</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Durée</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Vitesse</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Calories</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Fréquence cardiaque</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Stress aérobie</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Stress anaérobie</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400 w-12">Supprimer</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Button variant="secondary" size="sm" onClick={() => setEditingRecord(record)}>
                          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </Button>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{record.distance.toFixed(2)} km</td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{formatDuration(record.duration)}</td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{record.averageSpeed.toFixed(1)} km/h</td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{record.totalCalories} kcal</td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{record.averageHeartRate} bpm</td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{record.aerobicTrainingStress}</td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{record.anaerobicTrainingStress}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <EmptyState message="Aucun enregistrement pour la période sélectionnée" description="Essayez de changer la période ou ajoutez un nouvel enregistrement." />
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Ajouter une activité physique">
        {addError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{addError}</p>}
        <PhysicalActivityForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} loading={formLoading} />
      </Modal>

      <Modal isOpen={editingRecord !== null} onClose={() => setEditingRecord(null)} title="Modifier l'activité physique">
        {addError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{addError}</p>}
        {editingRecord && (
          <PhysicalActivityForm initialData={editingRecord} onSubmit={handleUpdate} onCancel={() => setEditingRecord(null)} loading={formLoading} />
        )}
      </Modal>

      <Modal isOpen={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Êtes-vous sûr de vouloir supprimer cet enregistrement d'activité ? Cette action est irréversible.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}