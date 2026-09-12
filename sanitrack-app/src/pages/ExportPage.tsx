import { useMemo, useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import {
  createReportPdf,
  loadReportData,
  reportSectionLabels,
  type ReportSection,
} from '@/utils/pdf-report';

const allSections = Object.keys(reportSectionLabels) as ReportSection[];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ExportPage() {
  const today = useMemo(() => isoDate(new Date()), []);
  const oneMonthAgo = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return isoDate(date);
  }, []);
  const [sections, setSections] = useState<ReportSection[]>(allSections);
  const [startDate, setStartDate] = useState(oneMonthAgo);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggleSection = (section: ReportSection) => {
    setSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
    setMessage(null);
  };

  const selectPeriod = (period: 'month' | 'year' | 'all') => {
    const end = new Date();
    const start = new Date();
    if (period === 'month') start.setMonth(start.getMonth() - 1);
    if (period === 'year') start.setFullYear(start.getFullYear() - 1);
    setStartDate(period === 'all' ? '2000-01-01' : isoDate(start));
    setEndDate(isoDate(end));
    setMessage(null);
  };

  const generate = async () => {
    if (sections.length === 0) {
      setMessage('Sélectionnez au moins une rubrique.');
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      setMessage('La date de début doit précéder ou correspondre à la date de fin.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const options = { sections, startDate, endDate };
      const data = await loadReportData(options);
      await createReportPdf(options, data);
      const count = sections.reduce((total, section) => total + data[section].length, 0);
      setMessage(`Rapport généré avec ${count} entrée${count > 1 ? 's' : ''}. Le téléchargement a démarré.`);
    } catch (error) {
      console.error(error);
      setMessage('Impossible de générer le rapport. Réessayez dans quelques instants.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Exporter un rapport PDF</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Composez un rapport à partir de vos données. La génération reste entièrement sur votre appareil.
        </p>
      </div>

      <Card title="1. Rubriques" subtitle="Choisissez les informations à inclure dans le rapport.">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setSections(allSections)}>Tout sélectionner</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSections([])}>Tout désélectionner</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {allSections.map((section) => (
            <label key={section} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
              <input
                type="checkbox"
                checked={sections.includes(section)}
                onChange={() => toggleSection(section)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{reportSectionLabels[section]}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="2. Période" subtitle="Les dates de début et de fin sont incluses.">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => selectPeriod('month')}>30 derniers jours</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => selectPeriod('year')}>12 derniers mois</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => selectPeriod('all')}>Toutes les données</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="report-start-date" type="date" label="Date de début" value={startDate} max={endDate || today} onChange={(event) => { setStartDate(event.target.value); setMessage(null); }} />
          <Input id="report-end-date" type="date" label="Date de fin" value={endDate} min={startDate} max={today} onChange={(event) => { setEndDate(event.target.value); setMessage(null); }} />
        </div>
      </Card>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{sections.length} rubrique{sections.length > 1 ? 's' : ''} sélectionnée{sections.length > 1 ? 's' : ''}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Format PDF A4 paysage, prêt à enregistrer ou imprimer.</p>
          </div>
          <Button type="button" size="lg" loading={loading} onClick={generate}>
            📄 Générer et télécharger
          </Button>
        </div>
        {message && (
          <p role="status" className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-200">{message}</p>
        )}
      </div>
    </div>
  );
}

export { ExportPage };
