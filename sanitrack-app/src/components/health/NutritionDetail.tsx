import { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { DateRange, NutritionEntry, MealType } from '../../models/types';
import { useNutritionStore } from '../../stores/nutrition-store';
import { useSettingsStore } from '../../stores/settings-store';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PeriodSelector, type Period } from '../ui/PeriodSelector';
import { EmptyState } from '../ui/EmptyState';
import { NutritionForm } from './NutritionForm';

type NutritionFormData = Omit<NutritionEntry, 'id' | 'createdAt'>;

const PAGE_SIZES = [10, 20, 50, 100, 0] as const;
type PageSize = (typeof PAGE_SIZES)[number];
const pageSizeLabels: Record<PageSize, string> = { 10: '10', 20: '20', 50: '50', 100: '100', 0: 'Tout' };

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};

const mealTypeColors: Record<MealType, string> = {
  breakfast: '#f59e0b',
  lunch: '#22c55e',
  dinner: '#6366f1',
  snack: '#3b82f6',
};

const macroColors: Record<string, string> = {
  protéines: '#ef4444',
  lipides: '#f59e0b',
  glucides: '#3b82f6',
  fibres: '#22c55e',
};

export function NutritionDetail() {
  const store = useNutritionStore();
  const { records, loading, actions } = store;
  const { besoins, actions: settingsActions } = useSettingsStore();
  const [period, setPeriod] = useState<Period>('week');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return { start: start.toISOString(), end: now.toISOString() };
  });
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<NutritionEntry | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    actions.fetchAll();
  }, [actions]);

  useEffect(() => {
    settingsActions.loadSettings();
  }, [settingsActions]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const d = new Date(r.date).getTime();
      return d >= new Date(dateRange.start).getTime() && d <= new Date(dateRange.end).getTime();
    });
  }, [records, dateRange]);

  const dailyCalories = useMemo(() => {
    const map = new Map<number, { date: number; breakfast: number; lunch: number; snack: number; dinner: number }>();
    for (const r of filteredRecords) {
      const ts = new Date(r.date).getTime();
      const dayTs = new Date(new Date(ts).setHours(0, 0, 0, 0)).getTime();
      const existing = map.get(dayTs);
      if (existing) {
        existing[r.mealType] += r.totalCalories;
      } else {
        map.set(dayTs, { date: dayTs, breakfast: 0, lunch: 0, snack: 0, dinner: 0, [r.mealType]: r.totalCalories });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date - b.date);
  }, [filteredRecords]);

  const macroTotals = useMemo(() => {
    const withCalories = filteredRecords.filter((r) => r.totalCalories > 0);
    const totals = withCalories.reduce(
      (acc, r) => ({
        proteins: acc.proteins + r.totalProteins,
        lipids: acc.lipids + r.totalLipids,
        carbs: acc.carbs + r.totalCarbs,
        fibers: acc.fibers + r.totalFibers,
      }),
      { proteins: 0, lipids: 0, carbs: 0, fibers: 0 },
    );
    return { ...totals, count: withCalories.length };
  }, [filteredRecords]);

  const macroPieData = useMemo(() => {
    return [
      { name: 'Protéines', value: Math.round(macroTotals.proteins) },
      { name: 'Lipides', value: Math.round(macroTotals.lipids) },
      { name: 'Glucides', value: Math.round(macroTotals.carbs) },
      { name: 'Fibres', value: Math.round(macroTotals.fibers) },
    ].filter((d) => d.value > 0);
  }, [macroTotals]);

  const paginatedRecords = useMemo(() => {
    if (pageSize === 0) return filteredRecords;
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, pageSize, currentPage]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  }, [filteredRecords.length, pageSize]);

  const handlePeriodChange = useCallback((p: Period, dr: DateRange) => {
    setPeriod(p);
    setDateRange(dr);
    setCurrentPage(1);
  }, []);

  const handleAdd = useCallback(async (data: NutritionFormData) => {
    setFormLoading(true);
    try {
      await actions.addRecord({
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      });
      setShowForm(false);
    } finally {
      setFormLoading(false);
    }
  }, [actions]);

  const handleUpdate = useCallback(async (data: NutritionFormData) => {
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Nutrition</h2>
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
        <EmptyState message="Aucun enregistrement nutritionnel" description="Ajoutez votre premier repas pour commencer le suivi." />
        <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Ajouter une entrée nutritionnelle">
          <NutritionForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} loading={formLoading} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Nutrition</h2>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} dateRange={dateRange} onChange={handlePeriodChange} />
          <Button onClick={() => setShowForm(true)}>+ Ajouter</Button>
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Répartition des macronutriments">
              {macroPieData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={macroPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {macroPieData.map((entry) => {
                          const colorKey = entry.name.toLowerCase() as keyof typeof macroColors;
                          return <Cell key={entry.name} fill={macroColors[colorKey] ?? '#9ca3af'} />;
                        })}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const total = macroPieData.reduce((s, d) => s + d.value, 0);
                          return (
                            <div className="custom-tooltip">
                              {payload.map((entry, index) => {
                                const pct = total > 0 ? Math.round((entry.value as number / total) * 100) : 0;
                                return (
                                  <p key={index}>
                                    <span className="dynamic-color" data-color={entry.color}>{entry.name}</span> : {pct}%
                                  </p>
                                );
                              })}
                            </div>
                          );
                        }}
                      />
                      <Legend
                        formatter={(value: string) => <span className="text-sm text-slate-700 dark:text-slate-300">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  Aucune donnée disponible
                </div>
              )}
            </Card>

            <Card title="Calories par jour">
              {dailyCalories.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyCalories} stackOffset="sign">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        unit=" kcal"
                      />
                      <Tooltip
                        labelFormatter={(ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                        formatter={(value: number, name: string) => [`${Math.round(value)} kcal`, mealTypeLabels[name as MealType] ?? name]}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const total = payload.reduce((sum, entry) => sum + (entry.value as number), 0);
                          return (
                            <div className="custom-tooltip">
                              <p className="tooltip-label">
                                {typeof label === 'number' ? new Date(label).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : label}
                              </p>
                              {payload.map((entry, index) => (
                                <p key={index} className="dynamic-color" data-color={entry.color}>
                                  {mealTypeLabels[entry.name as MealType] ?? entry.name} : {Math.round(entry.value as number)} kcal
                                </p>
                              ))}
                              <hr />
                              <p className="tooltip-total">
                                Total : {Math.round(total)} kcal
                              </p>
                            </div>
                          );
                        }}
                      />
                      {besoins !== null && besoins > 0 ? (
                        <ReferenceLine y={besoins} stroke="#f97316" strokeDasharray="6 3" strokeWidth={2} label={{ value: `${besoins} kcal`, position: 'right', fontSize: 11, fill: '#f97316' }} />
                      ) : null}
                      <Bar dataKey="breakfast" stackId="cal" fill={mealTypeColors.breakfast} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="lunch" stackId="cal" fill={mealTypeColors.lunch} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="snack" stackId="cal" fill={mealTypeColors.snack} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="dinner" stackId="cal" fill={mealTypeColors.dinner} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  Aucune donnée disponible
                </div>
              )}
            </Card>
          </div>

          <Card title="Enregistrements">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Par page :</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setCurrentPage(1); }}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  aria-label="Nombre d'éléments par page"
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
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400 w-12">Modifier</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Date</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Repas</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Calories</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Protéines</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Lipides</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Glucides</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Fibres</th>
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
                      <td className="px-4 py-3 text-center font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium dynamic-badge"
                            data-badge-bg={mealTypeColors[record.mealType]}
                          >
                            {mealTypeLabels[record.mealType]}
                          </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{Math.round(record.totalCalories)} kcal</td>
                      <td className="px-4 py-3 text-center text-red-600 dark:text-red-400">{Math.round(record.totalProteins)}g</td>
                      <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">{Math.round(record.totalLipids)}g</td>
                      <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">{Math.round(record.totalCarbs)}g</td>
                      <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{Math.round(record.totalFibers)}g</td>
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

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Ajouter une entrée nutritionnelle">
        <NutritionForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} loading={formLoading} />
      </Modal>

      <Modal isOpen={editingRecord !== null} onClose={() => { setEditingRecord(null); setAddError(null); }} title="Modifier l'entrée nutritionnelle">
        {editingRecord && (
          <NutritionForm initialData={editingRecord} onSubmit={handleUpdate} onCancel={() => { setEditingRecord(null); setAddError(null); }} loading={formLoading} />
        )}
        {addError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{addError}</p>}
      </Modal>

      <Modal isOpen={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Êtes-vous sûr de vouloir supprimer cette entrée nutritionnelle ? Cette action est irréversible.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}