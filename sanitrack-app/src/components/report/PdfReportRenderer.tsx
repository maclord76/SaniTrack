import { createRoot } from 'react-dom/client';
import { toCanvas } from 'html-to-image';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendChart } from '@/components/ui/TrendChart';
import { getStoredSettings } from '@/stores/settings-store';
import {
  chartsFor,
  indicatorsFor,
  reportSectionLabels,
  type ReportChartDefinition,
  type ReportData,
  type ReportIndicator,
  type ReportOptions,
  type ReportSection,
} from '@/utils/pdf-report';

const PAGE_WIDTH = 1123;
const PAGE_HEIGHT = 794;

interface PageModel {
  section: ReportSection;
  firstForSection: boolean;
  firstDocumentPage: boolean;
  indicators: ReportIndicator[];
  charts: ReportChartDefinition[];
}

function frenchDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function rgb(color: [number, number, number]): string {
  return `#${color.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function paleColor(color?: string): string {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return '#f8fafc';
  return `${color}0d`;
}

function buildPages(options: ReportOptions, data: ReportData): PageModel[] {
  const pages: PageModel[] = [];
  const settings = getStoredSettings();
  options.sections.forEach((section) => {
    const charts = chartsFor(section, data, { height: settings.height, nutritionTarget: settings.besoins });
    const indicators = indicatorsFor(section, data);
    const firstPageChartCount = 2;
    pages.push({
      section,
      firstForSection: true,
      firstDocumentPage: pages.length === 0,
      indicators,
      charts: charts.slice(0, firstPageChartCount),
    });
    for (let index = firstPageChartCount; index < charts.length; index += 4) {
      pages.push({
        section,
        firstForSection: false,
        firstDocumentPage: false,
        indicators: [],
        charts: charts.slice(index, index + 4),
      });
    }
  });
  return pages;
}

function chartData(chart: ReportChartDefinition): Record<string, unknown>[] {
  const rows = chart.dates.map((date, index) => {
    const row: Record<string, unknown> = {
      date: new Date(`${date.slice(0, 10)}T00:00:00`).getTime(),
    };
    chart.series.forEach((series, seriesIndex) => {
      const value = series.values[index];
      // Zero is a recorded activity measurement (notably the anaerobic baseline),
      // but a zero in a blood-analysis marker denotes an unfilled value.
      row[`value${seriesIndex}`] = Number.isFinite(value) && (!chart.zeroAsMissing || value !== 0) ? value : null;
    });
    return row;
  });

  const populatedRows = rows.filter((row) => chart.series.some((_, seriesIndex) => row[`value${seriesIndex}`] !== null));
  return populatedRows.sort((a, b) => Number(a.date) - Number(b.date));
}

function formatClockMinutes(value: number): string {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function IndicatorCard({ indicator }: { indicator: ReportIndicator }) {
  const color = indicator.color ?? '#4f46e5';
  return (
    <div
      className="flex min-h-[72px] flex-col justify-between rounded-xl border bg-slate-50 px-4 py-3"
      style={{ borderColor: color, backgroundColor: paleColor(color) }}
    >
      <div className="text-[12px] font-medium leading-tight text-slate-700">{indicator.label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-[18px] font-bold leading-none" style={{ color }}>
          {indicator.value}{indicator.unit ? <span className="ml-1 text-[11px] font-medium">{indicator.unit}</span> : null}
        </div>
        {indicator.status ? <div className="max-w-[42%] text-right text-[10px] leading-tight" style={{ color }}>{indicator.status}</div> : null}
      </div>
    </div>
  );
}

function ReportChart({ chart, compact, fullWidth, stacked }: { chart: ReportChartDefinition; compact: boolean; fullWidth: boolean; stacked: boolean }) {
  const data = chartData(chart);
  const singleSeries = chart.series.length === 1 ? chart.series[0] : undefined;
  const pieData = chart.series
    .map((series) => ({ name: series.label, value: series.values[0] ?? 0, color: rgb(series.color) }))
    .filter((entry) => entry.value > 0);
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-[14px] font-semibold text-slate-900">{chart.title}</h3>
        <span className="text-[10px] text-slate-500">{chart.unit}</span>
      </div>
      <div className={stacked ? 'h-[170px]' : compact ? 'h-[226px]' : 'h-[250px]'}>
        {chart.kind === 'pie' ? (
          pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="48%" innerRadius={48} outerRadius={86} paddingAngle={2} dataKey="value" isAnimationActive={false}>
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Legend formatter={(value) => <span className="text-[11px] text-slate-700">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex h-full items-center justify-center text-sm text-slate-500">Aucune donnée disponible</div>
        ) : chart.kind === 'stackedBar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 28, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              {chart.referenceLines?.map((line) => <ReferenceLine key={line.label} y={line.value} stroke={rgb(line.color)} strokeDasharray="6 3" label={{ value: line.label, position: 'insideTopRight', fill: rgb(line.color), fontSize: 10 }} />)}
              {chart.series.map((series, index) => <Bar key={series.label} dataKey={`value${index}`} stackId="cal" fill={rgb(series.color)} isAnimationActive={false} radius={index === chart.series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <TrendChart
            data={data}
            dataKey={singleSeries ? 'value0' : undefined}
            xKey="date"
            color={singleSeries ? rgb(singleSeries.color) : undefined}
            label={singleSeries?.label}
            unit={chart.unit}
            series={singleSeries ? undefined : chart.series.map((series, index) => ({ dataKey: `value${index}`, color: rgb(series.color), label: series.label }))}
            referenceLines={chart.referenceLines?.map((line) => ({ value: line.value, label: line.label, color: rgb(line.color) }))}
            showAverage={chart.showAverage}
            showRegression={chart.showRegression}
            valueFormatter={chart.clockValues ? formatClockMinutes : undefined}
            yTickFormatter={chart.clockValues ? formatClockMinutes : undefined}
            isAnimationActive={false}
            className="h-full w-full"
          />
        )}
      </div>
      {chart.kind !== 'pie' ? <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-600">
        {chart.series.map((series) => (
          <span key={series.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rgb(series.color) }} />
            {series.label}
          </span>
        ))}
      </div> : null}
    </div>
  );
}

function ReportPage({ page, options, pageNumber, pageCount }: { page: PageModel; options: ReportOptions; pageNumber: number; pageCount: number }) {
  const title = page.firstForSection
    ? reportSectionLabels[page.section]
    : `${reportSectionLabels[page.section]} - graphiques (suite)`;
  const compactCharts = page.firstForSection && page.indicators.length > 0;
  const stackCharts = page.section === 'bloodPressure' && page.charts.length === 2;
  return (
    <section
      data-pdf-page
      className="relative overflow-hidden bg-white text-slate-900"
      style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, padding: '28px 38px 34px', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}
    >
      {page.firstDocumentPage ? (
        <div className="-mx-[38px] -mt-7 mb-5 bg-indigo-600 px-[38px] py-5 text-white">
          <h1 className="text-[28px] font-bold leading-none">SaniTrack - Rapport de santé</h1>
          <p className="mt-2 text-[13px] text-indigo-100">Période du {frenchDate(options.startDate)} au {frenchDate(options.endDate)}</p>
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
        {page.firstForSection ? <span className="text-[11px] text-slate-500">Période : {frenchDate(options.startDate)} - {frenchDate(options.endDate)}</span> : null}
      </div>
      {page.firstDocumentPage ? <p className="mt-1 text-[10px] text-slate-500">Généré le {new Date().toLocaleDateString('fr-FR')} - Données conservées et traitées localement</p> : null}

      {page.indicators.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-2 text-[13px] font-semibold text-slate-900">Indicateurs sur la période</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {page.indicators.map((indicator) => <IndicatorCard key={indicator.label} indicator={indicator} />)}
          </div>
        </div>
      ) : null}

      <div className={`grid ${stackCharts ? 'grid-cols-1' : 'grid-cols-2'} gap-4 ${page.indicators.length > 0 ? 'mt-4' : 'mt-5'}`}>
        {page.charts.map((chart) => <ReportChart key={chart.title} chart={chart} compact={compactCharts} fullWidth={!stackCharts && (page.charts.length === 1 || chart.fullWidth === true)} stacked={stackCharts} />)}
      </div>

      <footer className="absolute bottom-3 left-[38px] right-[38px] flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] text-slate-500">
        <span>Ce rapport ne remplace pas un avis médical.</span>
        <span>Page {pageNumber} / {pageCount}</span>
      </footer>
    </section>
  );
}

function ReportPages({ options, data }: { options: ReportOptions; data: ReportData }) {
  const pages = buildPages(options, data);
  return (
    <div className="bg-slate-200">
      {pages.map((page, index) => (
        <ReportPage key={`${page.section}-${index}`} page={page} options={options} pageNumber={index + 1} pageCount={pages.length} />
      ))}
    </div>
  );
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export async function renderReportPagesToCanvases(options: ReportOptions, data: ReportData): Promise<HTMLCanvasElement[]> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${PAGE_WIDTH}px`,
    background: '#ffffff',
    zIndex: '-1',
  });
  document.body.appendChild(host);

  const rootElement = document.documentElement;
  const wasDark = rootElement.classList.contains('dark');
  rootElement.classList.remove('dark');
  const root = createRoot(host);
  try {
    root.render(<ReportPages options={options} data={data} />);
    await nextPaint();
    if (document.fonts?.ready) await document.fonts.ready;
    const pageElements = [...host.querySelectorAll<HTMLElement>('[data-pdf-page]')];
    return await Promise.all(pageElements.map((page) => toCanvas(page, {
      backgroundColor: '#ffffff',
      cacheBust: true,
      pixelRatio: 2,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    })));
  } finally {
    root.unmount();
    host.remove();
    if (wasDark) rootElement.classList.add('dark');
  }
}
