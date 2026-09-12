import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface ReferenceLineConfig {
  value: number;
  label: string;
  color: string;
  strokeDasharray?: string;
}

interface ChartSeries {
  dataKey: string;
  color?: string;
  label: string;
}

interface TrendChartProps {
  data: Record<string, unknown>[];
  dataKey?: string;
  xKey: string;
  color?: string;
  label?: string;
  unit?: string;
  showAverage?: boolean;
  showRegression?: boolean;
  referenceLines?: ReferenceLineConfig[];
  series?: ChartSeries[];
  valueFormatter?: (value: number) => string;
  yTickFormatter?: (value: number) => string;
  isAnimationActive?: boolean;
  className?: string;
}

function formatTick(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTooltipDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function MovingAverageLine({
  data,
  dataKey,
  xKey,
  color,
  isAnimationActive,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  xKey: string;
  color: string;
  isAnimationActive: boolean;
}) {
  const validCount = data.filter((item) => item[dataKey] !== null && Number.isFinite(Number(item[dataKey]))).length;
  const windowSize = Math.min(5, validCount);
  if (windowSize < 3) return null;

  const movingAvgData = data.map((_, idx) => {
    if (data[idx][dataKey] === null || !Number.isFinite(Number(data[idx][dataKey]))) {
      return { [xKey]: data[idx][xKey], avg: null };
    }
    const slice = data.slice(0, idx + 1)
      .filter((item) => item[dataKey] !== null && Number.isFinite(Number(item[dataKey])))
      .slice(-windowSize);
    const avg = slice.reduce((sum, d) => sum + Number(d[dataKey]), 0) / slice.length;
    return { [xKey]: data[idx][xKey], avg };
  });

  return (
    <Line
      data={movingAvgData}
      dataKey="avg"
      stroke={color}
      strokeDasharray="4 4"
      strokeWidth={1.5}
      dot={false}
      name="Moyenne mob."
      isAnimationActive={isAnimationActive}
    />
  );
}

const REGRESSION_KEY = '__reg__';

function CustomTooltip({
  active,
  payload,
  label: tooltipLabel,
  unit,
  valueFormatter,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string | number;
  unit?: string;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const dateLabel = typeof tooltipLabel === 'number'
    ? formatTooltipDate(tooltipLabel)
    : tooltipLabel;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">{dateLabel}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {entry.name}: {typeof entry.value === 'number' && valueFormatter
            ? valueFormatter(entry.value)
            : typeof entry.value === 'number'
              ? entry.value.toFixed ? entry.value.toFixed(2).replace(/\.?0+$/, '') : entry.value
              : entry.value}
          {unit && !valueFormatter && <span className="ml-0.5 text-xs">{unit}</span>}
        </p>
      ))}
    </div>
  );
}

function TrendChart({
  data,
  dataKey,
  xKey,
  color = '#6366f1',
  label,
  unit,
  showAverage = false,
  showRegression = false,
  referenceLines,
  series,
  valueFormatter,
  yTickFormatter,
  isAnimationActive = true,
  className = 'h-64 w-full',
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Aucune donnée disponible
      </div>
    );
  }

  const isTimeAxis = data.length > 0 && typeof data[0][xKey] === 'number';
  const chartSeries = series ?? (dataKey ? [{ dataKey, color, label: label ?? '' }] : []);

  const regressionEnabled = showRegression && !series && dataKey;
  const chartData = useMemo(() => {
    if (!regressionEnabled) return data;

    const valid = data.flatMap((item, index) => {
      const raw = item[dataKey as string];
      return raw !== null && Number.isFinite(Number(raw)) ? [{ index, value: Number(raw) }] : [];
    });
    const n = valid.length;
    if (n < 3) return data;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (const point of valid) {
      sumX += point.index;
      sumY += point.value;
      sumXY += point.index * point.value;
      sumXX += point.index * point.index;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return data.map((d, i) => ({
      ...d,
      [REGRESSION_KEY]: d[dataKey as string] === null ? null : slope * i + intercept,
    }));
  }, [data, dataKey, regressionEnabled]);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            className="dark:stroke-slate-700"
          />
          <XAxis
            dataKey={xKey}
            type={isTimeAxis ? 'number' : 'category'}
            scale={isTimeAxis ? 'time' : undefined}
            domain={isTimeAxis ? ['dataMin', 'dataMax'] : undefined}
            tickFormatter={isTimeAxis ? formatTick : undefined}
            tick={{ fontSize: 12 }}
            tickLine={false}
            minTickGap={40}
            axisLine={{ stroke: '#e2e8f0' }}
            className="dark:stroke-slate-600 [&_.recharts-text]:fill-slate-500 dark:[&_.recharts-text]:fill-slate-400"
          />
          <YAxis
            tickFormatter={yTickFormatter}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            className="dark:stroke-slate-600 [&_.recharts-text]:fill-slate-500 dark:[&_.recharts-text]:fill-slate-400"
          />
          <Tooltip
            content={<CustomTooltip unit={unit} valueFormatter={valueFormatter} />}
          />
          {referenceLines?.map((ref, idx) => (
            <ReferenceLine
              key={idx}
              y={ref.value}
              stroke={ref.color}
              strokeDasharray={ref.strokeDasharray ?? '6 3'}
              strokeWidth={1}
              label={{
                value: ref.label,
                position: 'insideTopRight',
                fill: ref.color,
                fontSize: 10,
              }}
            />
          ))}
          {chartSeries.map((s, idx) => (
            <Line
              key={idx}
              type={isTimeAxis ? 'monotone' : 'monotone'}
              dataKey={s.dataKey}
              stroke={s.color ?? '#6366f1'}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color ?? '#6366f1' }}
              activeDot={{ r: 5 }}
              name={s.label}
              isAnimationActive={isAnimationActive}
            />
          ))}
          {showAverage && !series && dataKey && (
            <MovingAverageLine data={data} dataKey={dataKey} xKey={xKey} color={color} isAnimationActive={isAnimationActive} />
          )}
          {showRegression && !series && dataKey && (
            <Line
              dataKey={REGRESSION_KEY}
              stroke={color}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              dot={false}
              name="Régression"
              isAnimationActive={isAnimationActive}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { TrendChart, type TrendChartProps, type ReferenceLineConfig, type ChartSeries };
