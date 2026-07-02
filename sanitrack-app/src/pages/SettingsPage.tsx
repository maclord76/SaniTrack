import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '@/components/ui';
import { Button } from '@/components/ui';
import { QRCode } from '@/components/ui/QRCode';
import { CitySearchModal } from '@/components/ui/CitySearchModal';
import { ThemeToggle } from '@/components/ui';
import { useThemeStore } from '@/stores/theme-store';
import { useSettingsStore, type ThresholdConfig, type Lifestyle, lifestyleOptions, getLifestyleCoefficient, calcHarrisBenedict } from '@/stores/settings-store';
import { useVisibilityStore, toggleableCategories } from '@/stores/visibility-store';
import { exportAllData, importAllData } from '@/db/export-import';
import type { ImportResult } from '@/db/export-import';
import { db } from '@/db/database';
import { decryptJsonPayload, encryptJsonPayload, isEncryptedExportPayload } from '@/utils/encryption';

function SettingsPage() {
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.actions.setTheme);
  const { hiddenCategories, setCategoryHidden } = useVisibilityStore();
  const settingsState = useSettingsStore();
  const { height, weight, sex, age, lifestyle, metabolismeBase, besoins, thresholds } = settingsState;
  const settingsActions = settingsState.actions;

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showServerImport, setShowServerImport] = useState(false);
  const [complementMode, setComplementMode] = useState(false);
  const [serverImporting, setServerImporting] = useState(false);
  const [serverUuidInput, setServerUuidInput] = useState('');
  const [serverKeywordInput, setServerKeywordInput] = useState('');
  const [serverImportResult, setServerImportResult] = useState<ImportResult | null>(null);
  const [serverImportError, setServerImportError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);

  const recordCategories: { key: keyof typeof recordCounts; label: string }[] = [
    { key: 'bloodAnalyses', label: 'Analyses sanguines' },
    { key: 'physicalActivities', label: 'Activités physiques' },
    { key: 'weightBMI', label: 'Poids / IMC' },
    { key: 'sleep', label: 'Sommeil' },
    { key: 'bloodPressure', label: 'Pression artérielle' },
    { key: 'nutrition', label: 'Nutrition' },
    { key: 'pollenAllergenScores', label: 'Allergènes polliniques' },
  ];
  const totalRecords = recordCategories.reduce(
    (sum, cat) => sum + (recordCounts[cat.key] ?? 0),
    0,
  );

  const [integrating, setIntegrating] = useState(false);
  const [integratedUuid, setIntegratedUuid] = useState<string | null>(null);
  const [integratedImportUrl, setIntegratedImportUrl] = useState<string | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  const [hasServerAccess, setHasServerAccess] = useState<boolean | null>(null);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const location = useLocation();

  useEffect(() => {
    const state = location.state as { importResult?: ImportResult; importError?: string } | null;
    if (state?.importResult) {
      setServerImportResult(state.importResult);
    } else if (state?.importError) {
      setServerImportError(state.importError);
    }
    if (state?.importResult || state?.importError) {
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [heightInput, setHeightInput] = useState(String(height));
  const [sexInput, setSexInput] = useState(sex);
  const [ageInput, setAgeInput] = useState(String(age));
  const [weightInput, setWeightInput] = useState(String(weight));
  const [loadingWeight, setLoadingWeight] = useState(true);
  const [lifestyleInput, setLifestyleInput] = useState<Lifestyle>(lifestyle);
  const [metabolismeBaseKcal, setMetabolismeBaseKcal] = useState<number | null>(metabolismeBase);
  const [besoinsKcal, setBesoinsKcal] = useState<number | null>(besoins);
  const [editingThresholdKey, setEditingThresholdKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ThresholdConfig | null>(null);

  const [atmoLoginInput, setAtmoLoginInput] = useState(settingsState.atmoLogin ?? '');
  const [atmoPasswordInput, setAtmoPasswordInput] = useState(settingsState.atmoPassword ?? '');
  const [atmoLocationInput, setAtmoLocationInput] = useState(settingsState.atmoLocation ?? '');
  const [showCitySearch, setShowCitySearch] = useState(false);

  useEffect(() => {
    settingsActions.loadSettings();
  }, [settingsActions]);

  useEffect(() => {
    async function loadRecentWeight() {
      try {
        const lastEntry = await db.weightBMI.orderBy('createdAt').last();
        if (lastEntry?.mass) {
          setWeightInput(String(lastEntry.mass));
          settingsActions.setWeight(lastEntry.mass);
        }
      } catch {
        // DB not available
      } finally {
        setLoadingWeight(false);
      }
    }
    loadRecentWeight();
  }, []);

  useEffect(() => {
    setHeightInput(String(height));
  }, [height]);

  useEffect(() => {
    setSexInput(sex);
  }, [sex]);

  useEffect(() => {
    setAgeInput(String(age));
  }, [age]);

  useEffect(() => {
    setWeightInput(String(weight));
  }, [weight]);

  useEffect(() => {
    setLifestyleInput(lifestyle);
  }, [lifestyle]);

  useEffect(() => {
    setMetabolismeBaseKcal(metabolismeBase);
  }, [metabolismeBase]);

  useEffect(() => {
    setBesoinsKcal(besoins);
  }, [besoins]);

  useEffect(() => {
    setAtmoLoginInput(settingsState.atmoLogin ?? '');
  }, [settingsState.atmoLogin]);

  useEffect(() => {
    setAtmoPasswordInput(settingsState.atmoPassword ?? '');
  }, [settingsState.atmoPassword]);

  useEffect(() => {
    setAtmoLocationInput(settingsState.atmoLocation ?? '');
  }, [settingsState.atmoLocation]);

  const refreshRecordCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const [
        bloodAnalyses,
        physicalActivities,
        weightBMI,
        sleepEntries,
        bloodPressure,
        nutrition,
        pollenAllergenScores,
      ] = await Promise.all([
        db.bloodAnalyses.count(),
        db.physicalActivities.count(),
        db.weightBMI.count(),
        db.sleep.count(),
        db.bloodPressure.count(),
        db.nutrition.count(),
        db.pollenAllergenScores.count(),
      ]);
      setRecordCounts({
        bloodAnalyses,
        physicalActivities,
        weightBMI,
        sleep: sleepEntries,
        bloodPressure,
        nutrition,
        pollenAllergenScores,
      });
    } catch (err) {
      console.error('Record count failed:', err);
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecordCounts();
  }, [refreshRecordCounts]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sanitrack-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleIntegrate = useCallback(async () => {
    const serverUrl = serverUrlInput.trim().replace(/\/+$/, '');
    const keyword = serverKeywordInput.trim();
    if (!serverUrl || !keyword) return;

    setIntegrating(true);
    setIntegratedUuid(null);
    setIntegratedImportUrl(null);
    setIntegrationError(null);
    try {
      const data = await exportAllData();
      const encryptedData = await encryptJsonPayload(data, keyword);
      const response = await fetch(`${serverUrl}/api/upload.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptedData),
      });
      const result = await response.json();
      if (!response.ok) {
        const msg = result.detail ? `${result.error} — ${result.detail}` : result.error;
        throw new Error(msg || `Erreur serveur (${response.status})`);
      }
      setIntegratedUuid(result.uuid);
      setIntegratedImportUrl(
        `${serverUrl}/#/import?uuid=${encodeURIComponent(result.uuid)}&server=${encodeURIComponent(serverUrl)}&key=${encodeURIComponent(keyword)}`,
      );
    } catch (err) {
      setIntegrationError((err as Error).message);
    } finally {
      setIntegrating(false);
    }
  }, [serverKeywordInput, serverUrlInput]);

  const handleImport = useCallback(async () => {
    if (!fileInputRef.current?.files?.length) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);

    const file = fileInputRef.current.files[0];
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await importAllData(data, { clearExisting: !complementMode });
      setImportResult(result);
      // Recharger les settings depuis localStorage après import
      settingsActions.loadSettings();
      // Mettre à jour le nombre d'enregistrements affiché
      refreshRecordCounts();
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [settingsActions, refreshRecordCounts]);

  const handleServerImport = useCallback(async () => {
    const uuid = serverUuidInput.trim();
    const keyword = serverKeywordInput.trim();
    if (!uuid) return;
    setServerImporting(true);
    setServerImportResult(null);
    setServerImportError(null);

    try {
      const response = await fetch(`${serverUrlInput}/api/upload.php?uuid=${encodeURIComponent(uuid)}`);
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `Erreur serveur (${response.status})`);
      }
      const data = await response.json();
      const importData = isEncryptedExportPayload(data)
        ? await decryptJsonPayload(data, keyword)
        : data;
      const result = await importAllData(importData, { clearExisting: !complementMode });
      setServerImportResult(result);
      // Recharger les settings depuis localStorage après import
      settingsActions.loadSettings();
      // Mettre à jour le nombre d'enregistrements affiché
      refreshRecordCounts();

      await fetch(`${serverUrlInput}/api/upload.php?uuid=${encodeURIComponent(uuid)}`, { method: 'DELETE' }).catch(() => {});
    } catch (err) {
      setServerImportError((err as Error).message);
    } finally {
      setServerImporting(false);
    }
  }, [complementMode, serverKeywordInput, serverUuidInput, serverUrlInput, settingsActions, refreshRecordCounts]);

  const verifyServerUrl = useCallback(async () => {
    const url = serverUrlInput.trim().replace(/\/+$/, '');
    if (!url) return;
    setVerifying(true);
    setVerifyError(null);
    setHasServerAccess(null);
    try {
      const response = await fetch(`${url}/api/upload.php`, { method: 'OPTIONS' });
      if (response.ok || response.status === 204) {
        setHasServerAccess(true);
      } else {
        throw new Error(`Réponse inattendue (${response.status})`);
      }
    } catch (err) {
      setHasServerAccess(false);
      setVerifyError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }, [serverUrlInput]);

  const handleClearData = useCallback(async () => {
    setClearing(true);
    try {
      const { db } = await import('@/db/database');
      await Promise.all([
        db.bloodAnalyses.clear(),
        db.physicalActivities.clear(),
        db.weightBMI.clear(),
        db.sleep.clear(),
        db.bloodPressure.clear(),
        db.nutrition.clear(),
        db.pollenAllergenScores.clear(),
      ]);
      setConfirmClear(false);
      window.location.reload();
    } catch (err) {
      console.error('Clear failed:', err);
    } finally {
      setClearing(false);
    }
  }, []);

  const handleSaveHeight = useCallback(() => {
    const val = Number(heightInput);
    if (val > 0 && val < 300) {
      settingsActions.setHeight(val);
    }
  }, [heightInput, settingsActions]);

  const handleSaveSex = useCallback(() => {
    settingsActions.setSex(sexInput);
  }, [sexInput, settingsActions]);

  const handleSaveAge = useCallback(() => {
    const val = Number(ageInput);
    if (val > 0 && val < 150) {
      settingsActions.setAge(val);
    }
  }, [ageInput, settingsActions]);

  const handleSaveWeight = useCallback(() => {
    const val = Number(weightInput);
    if (val > 0 && val < 500) {
      settingsActions.setWeight(val);
    }
  }, [weightInput, settingsActions]);

  const handleCalculateBesoins = useCallback(() => {
    const w = Number(weightInput);
    const h = Number(heightInput);
    const a = Number(ageInput);
    if (w > 0 && h > 0 && a > 0 && sexInput !== 'unspecified') {
      const bmr = calcHarrisBenedict(sexInput, w, h, a);
      if (bmr !== null) {
        const besoinsVal = Math.round(bmr * getLifestyleCoefficient(lifestyleInput));
        setMetabolismeBaseKcal(bmr);
        setBesoinsKcal(besoinsVal);
        settingsActions.setMetabolismeBase(bmr);
        settingsActions.setBesoins(besoinsVal);

      }
    }
  }, [weightInput, heightInput, ageInput, sexInput, lifestyleInput, settingsActions]);

  const handleStartEditingThreshold = useCallback((key: string) => {
    const config = thresholds.find((t) => t.key === key);
    if (config) {
      setEditingThresholdKey(key);
      setEditValues({ ...config, bounds: config.bounds.map((b) => ({ ...b })) });
    }
  }, [thresholds]);

  const handleSaveThreshold = useCallback(() => {
    if (editValues) {
      settingsActions.setThresholds(
        thresholds.map((t) => (t.key === editValues.key ? editValues : t)),
      );
      setEditingThresholdKey(null);
      setEditValues(null);
    }
  }, [editValues, thresholds, settingsActions]);

  const handleResetThresholds = useCallback(() => {
    settingsActions.resetThresholds();
    setEditingThresholdKey(null);
    setEditValues(null);
  }, [settingsActions]);

  const handleSaveAtmo = useCallback(() => {
    settingsActions.setAtmoLogin(atmoLoginInput);
    settingsActions.setAtmoPassword(atmoPasswordInput);
    settingsActions.setAtmoLocation(atmoLocationInput);
  }, [atmoLoginInput, atmoPasswordInput, atmoLocationInput, settingsActions]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Paramètres</h1>

      <Card title="Apparence" subtitle="Personnaliser le thème et l'affichage des catégories">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mode sombre pour cette session</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Change le thème pour la session en cours uniquement</p>
            </div>
            <ThemeToggle persist={false} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mode sombre au démarrage</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Définit le thème par défaut pour les prochaines sessions</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={currentTheme}
                onChange={(e) => {
                  localStorage.setItem('theme', e.target.value);
                  setTheme(e.target.value as 'light' | 'dark');
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Masquer des catégories
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Cochez les catégories que vous souhaitez masquer dans le menu de navigation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {toggleableCategories.map((cat) => (
                <label
                  key={cat.path}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50 cursor-pointer transition-all duration-200 select-none group"
                >
                  <input
                    type="checkbox"
                    checked={hiddenCategories[cat.path] || false}
                    onChange={(e) => setCategoryHidden(cat.path, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:checked:bg-indigo-600 dark:checked:border-indigo-600"
                  />
                  <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                    {cat.icon}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                    {cat.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Vous" subtitle="Valeurs par défaut utilisées dans les formulaires">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Taille (cm)
            </label>
            <input
              type="number"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              min="30"
              max="300"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Poids (kg)
            </label>
            <input
              type="number"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              min="1"
              max="500"
              step="0.1"
            />
          </div>
          <Button onClick={handleSaveHeight}>Taille</Button>
          <Button onClick={handleSaveWeight} disabled={loadingWeight}>Poids</Button>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sexe
            </label>
            <select
              value={sexInput}
              onChange={(e) => setSexInput(e.target.value as 'male' | 'female' | 'unspecified')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="unspecified">Non mentionné</option>
              <option value="male">Homme</option>
              <option value="female">Femme</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Âge
            </label>
            <input
              type="number"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              min="1"
              max="150"
            />
          </div>
          <Button onClick={handleSaveSex}>Sexe</Button>
          <Button onClick={handleSaveAge}>Âge</Button>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mode de vie
            </label>
            <select
              value={lifestyleInput}
              onChange={(e) => setLifestyleInput(e.target.value as Lifestyle)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {lifestyleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={() => settingsActions.setLifestyle(lifestyleInput)}>Enregistrer</Button>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Métabolisme de base (kcal/jour)
            </label>
            <div className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
              {metabolismeBaseKcal !== null ? metabolismeBaseKcal : '\u2014'}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Vos Besoins (kcal/jour)
            </label>
            <div className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
              {besoinsKcal !== null ? besoinsKcal : '\u2014'}
            </div>
          </div>
          <Button onClick={handleCalculateBesoins}>Calculer</Button>
        </div>
      </Card>

      <Card title="Seuils OMS" subtitle="Valeurs de référence utilisées pour les indicateurs de santé. Modifiez-les pour personnaliser les catégories.">
        <div className="space-y-4">
          {thresholds.map((config) => (
            <div key={config.key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{config.name}</span>
                  {config.unit && <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({config.unit})</span>}
                </div>
                {editingThresholdKey === config.key ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSaveThreshold}>Enregistrer</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setEditingThresholdKey(null); setEditValues(null); }}>Annuler</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => handleStartEditingThreshold(config.key)}>Modifier</Button>
                )}
              </div>
              {editingThresholdKey === config.key && editValues ? (
                <div className="space-y-2">
                  {editValues.bounds.map((bound, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="number"
                        value={bound.value}
                        onChange={(e) => {
                          const newBounds = [...editValues.bounds];
                          newBounds[idx] = { ...newBounds[idx], value: Number(e.target.value) };
                          setEditValues({ ...editValues, bounds: newBounds });
                        }}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        step="0.1"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{bound.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {config.bounds.map((bound, idx) => (
                    <span key={idx} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {bound.label} : {bound.value} {config.unit}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleResetThresholds}>Réinitialiser aux valeurs OMS</Button>
          </div>
        </div>
      </Card>

      <Card title="API Atmo France (Pollens)" subtitle="Identifiants et localisation pour accéder aux données polliniques via l'API Atmo France">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Login
            </label>
            <input
              type="text"
              value={atmoLoginInput}
              onChange={(e) => setAtmoLoginInput(e.target.value)}
              placeholder="Votre identifiant Atmo France"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={atmoPasswordInput}
              onChange={(e) => setAtmoPasswordInput(e.target.value)}
              placeholder="Mot de passe"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Code Insee
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={atmoLocationInput}
                onChange={(e) => setAtmoLocationInput(e.target.value)}
                placeholder="Ex: 75056 (Paris) ou 59350 (Lille)"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowCitySearch(true)}
                title="Rechercher une commune"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-400 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveAtmo}>Enregistrer</Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Les identifiants et la localisation sont stockés localement dans votre navigateur et envoyés au proxy PHP pour authentification auprès de l'API Atmo France.
            Vous devez posséder un compte sur{' '}
            <a href="https://admindata.atmo-france.org" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">
              admindata.atmo-france.org
            </a>.
            Le code INSEE de votre commune peut être trouvé sur insee.fr.
          </p>
        </div>
      </Card>

      <Card title="Export & Import via fichier JSON" subtitle="Télécharger ou importer vos données de santé depuis un fichier JSON">
        <div className="space-y-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Exporter</p>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exportation...' : 'Exporter en JSON'}
              </Button>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Importer</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="mb-2 block w-full text-sm text-slate-600 dark:text-slate-400
                  file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2
                  file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700
                  dark:file:bg-indigo-500 dark:hover:file:bg-indigo-600"
              />
              <div className="flex items-center gap-2">
                <Button onClick={handleImport} disabled={importing} variant="secondary">
                  {importing ? 'Importation...' : 'Importer les données'}
                </Button>
                <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={complementMode}
                    onChange={(e) => setComplementMode(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  Complément
                </label>
              </div>
            </div>
          </div>

          {importResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Importation réussie : {importResult.imported} enregistrements importés.
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {importError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Échec de l'importation : {importError}</p>
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Les données sont stockées localement dans votre navigateur (IndexedDB).
            L'export JSON permet de les télécharger. L'import JSON permet de les
            restaurer depuis un fichier (remplace les données actuelles).
          </p>
        </div>
      </Card>

      <Card title="Export & Import via un serveur Web SaniTrack 🄯" subtitle="Intégrer vos données sur le serveur ou les récupérer depuis celui-ci">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Url du serveur
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrlInput}
                onChange={(e) => { setServerUrlInput(e.target.value); setHasServerAccess(null); setVerifyError(null); }}
                placeholder="https://exemple.com"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <Button onClick={verifyServerUrl} disabled={verifying || !serverUrlInput.trim()}>
                {verifying ? 'Vérification...' : 'Vérifier'}
              </Button>
            </div>
            {verifyError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">Connexion impossible : {verifyError}</p>
            )}
            {hasServerAccess === true && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">Serveur accessible</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mot clé
            </label>
            <input
              type="password"
              value={serverKeywordInput}
              onChange={(e) => setServerKeywordInput(e.target.value)}
              placeholder="Mot clé de chiffrement"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {hasServerAccess === true && (
            <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleIntegrate} disabled={integrating || !serverKeywordInput.trim()} variant="orange">
              {integrating ? 'Intégration...' : 'Intégrer sur le serveur'}
            </Button>
            {!showServerImport ? (
              <Button onClick={() => setShowServerImport(true)} variant="orange">
                Importer à partir du serveur
              </Button>
            ) : null}
          </div>

          {showServerImport && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600 dark:text-amber-400">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Import unique via UUID
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Récupère les données depuis le serveur Web SaniTrack à l'aide d'un UUID.
                    Une fois l'import terminé, le fichier est <strong>supprimé définitivement</strong> du serveur.
                    Cochez "Complément" pour ajouter les données sans effacer les existantes.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  UUID du fichier
                </label>
                <input
                  type="text"
                  value={serverUuidInput}
                  onChange={(e) => setServerUuidInput(e.target.value)}
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="flex gap-2 items-center">
                <Button onClick={handleServerImport} disabled={serverImporting || !serverUuidInput.trim()}>
                  {serverImporting ? 'Importation...' : 'Importer'}
                </Button>
                <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={complementMode}
                    onChange={(e) => setComplementMode(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  Complément
                </label>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowServerImport(false);
                    setServerImportResult(null);
                    setServerImportError(null);
                    setServerUuidInput('');
                  }}
                  disabled={serverImporting}
                >
                  Annuler
                </Button>
              </div>

              {serverImportResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    Importation réussie : {serverImportResult.imported} enregistrements importés.
                  </p>
                  {serverImportResult.errors.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
                      {serverImportResult.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {serverImportError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">Échec de l'importation : {serverImportError}</p>
                </div>
              )}
            </div>
          )}

          {integratedUuid && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <QRCode value={integratedImportUrl ?? ''} size={96} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    Données sauvegardées sur le serveur pendant une semaine
                  </p>
                  <p className="mt-1 text-xs text-green-700 dark:text-green-400 break-all">
                    UUID : <span className="font-mono font-semibold">{integratedUuid}</span>
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-green-600 dark:text-green-500 break-all">
                {integratedImportUrl}
              </p>
            </div>
          )}

          {integrationError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Échec de l'intégration : {integrationError}
              </p>
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            "Intégrer sur le serveur" envoie vos données sur le serveur web via PHP (max 1 Mo)
            et retourne un UUID. "Importer à partir du serveur" utilise cet UUID pour
            récupérer les données (usage unique).
          </p>
            </>
          )}
        </div>
      </Card>

      <Card title="Version des données" subtitle="Version actuelle du schéma">
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Version du schéma : <span className="font-mono font-semibold">1</span>
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nombre d&apos;enregistrements
              </span>
              <span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                {countsLoading ? '…' : totalRecords}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {recordCategories.map((cat) => (
                <li key={cat.key} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>{cat.label}</span>
                  <span className="font-mono font-semibold">
                    {countsLoading ? '…' : (recordCounts[cat.key] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card title="Zone dangereuse" subtitle="Actions irréversibles">
        {!confirmClear ? (
          <Button onClick={() => setConfirmClear(true)} variant="danger">
            Effacer toutes les données
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Cela supprimera définitivement toutes vos données de santé. Êtes-vous sûr ?
            </p>
            <div className="flex gap-3">
              <Button onClick={handleClearData} variant="danger" disabled={clearing}>
                {clearing ? 'Suppression...' : 'Oui, effacer tout'}
              </Button>
              <Button onClick={() => setConfirmClear(false)} variant="secondary">
                Annuler
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CitySearchModal
        isOpen={showCitySearch}
        onClose={() => setShowCitySearch(false)}
        onSelect={(codeInsee) => {
          setAtmoLocationInput(codeInsee);
        }}
      />
    </div>
  );
}

export { SettingsPage };
