import { useId, useMemo, useState } from 'react';
import { formatCompactVND, formatVND } from '../utils/financeUtils';
import type { DailyMetric } from '../utils/dashboardMetrics';
import type { DemoMonthRevenue } from '../utils/demoDashboard';

interface DailyChartProps {
  data: DailyMetric[];
  monthYear: string;
}

interface MonthChartProps {
  data: DemoMonthRevenue[];
}

function yTicks(maxValue: number): number[] {
  const max = Math.max(maxValue, 1);
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.ceil(raw / magnitude) * magnitude;
  return [0, step, step * 2, step * 3, step * 4];
}

export function DemoDailyRevenueChart({ data, monthYear }: DailyChartProps) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const height = 240;
  const padX = 44;
  const padY = 22;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2 - 16;
  const chart = useMemo(() => {
    const max = Math.max(...data.map((row) => row.revenue), 0);
    const ticks = yTicks(max);
    const top = ticks[ticks.length - 1] || 1;
    const points = data.map((row, index) => {
      const x = padX + (data.length <= 1 ? innerW / 2 : (index / (data.length - 1)) * innerW);
      const y = padY + innerH - (row.revenue / top) * innerH;
      return { ...row, x, y };
    });
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const area = points.length
      ? `${line} L ${points[points.length - 1].x} ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`
      : '';
    return { points, line, area, ticks, top };
  }, [data, innerH, innerW, padX, padY]);
  const hovered = active !== null ? chart.points[active] : undefined;
  const labelEvery = data.length > 20 ? 5 : data.length > 10 ? 2 : 1;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full sm:h-64" role="img"
        aria-label={`Doanh thu theo ngày trong tháng ${monthYear}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {chart.ticks.map((tick) => {
          const y = padY + innerH - (tick / chart.top) * innerH;
          return (
            <g key={tick}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="3 5" />
              <text x={padX - 8} y={y + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-500" fontSize="9">
                {formatCompactVND(tick)}
              </text>
            </g>
          );
        })}
        {chart.area && <path d={chart.area} fill={`url(#${gradientId})`} />}
        {chart.line && <path d={chart.line} fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
        {chart.points.map((point, index) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r={hovered?.date === point.date ? 4.5 : 0}
              className="fill-white stroke-blue-600 dark:fill-slate-950" strokeWidth="2" />
            {index % labelEvery === 0 && (
              <text x={point.x} y={height - 4} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" fontSize="9">
                {point.day}
              </text>
            )}
            <rect x={point.x - innerW / Math.max(data.length, 1) / 2} y={padY} width={Math.max(innerW / Math.max(data.length, 1), 8)}
              height={innerH} fill="transparent"
              onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} />
          </g>
        ))}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
          <p className="font-semibold text-slate-900 dark:text-white">{hovered.date}</p>
          <p className="tabular-nums text-blue-700 dark:text-sky-300">{formatVND(hovered.revenue)} · {hovered.orders} đơn</p>
        </div>
      )}
    </div>
  );
}

export function DemoMonthlyRevenueChart({ data }: MonthChartProps) {
  const [active, setActive] = useState<string | null>(null);
  const width = 640;
  const height = 240;
  const padX = 44;
  const padY = 22;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2 - 16;
  const max = Math.max(...data.map((row) => row.revenue), 0);
  const ticks = yTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const gap = 6;
  const barW = data.length ? (innerW - gap * (data.length - 1)) / data.length : 0;
  const hovered = data.find((row) => row.monthYear === active);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full sm:h-64" role="img"
        aria-label="Doanh thu 12 tháng gần nhất">
        {ticks.map((tick) => {
          const y = padY + innerH - (tick / top) * innerH;
          return (
            <g key={tick}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="3 5" />
              <text x={padX - 8} y={y + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-500" fontSize="9">
                {formatCompactVND(tick)}
              </text>
            </g>
          );
        })}
        {data.map((row, index) => {
          const x = padX + index * (barW + gap);
          const barH = (row.revenue / top) * innerH;
          const y = padY + innerH - barH;
          const isActive = active === row.monthYear;
          return (
            <g key={row.monthYear} onMouseEnter={() => setActive(row.monthYear)} onMouseLeave={() => setActive(null)}>
              <rect x={x} y={padY} width={barW} height={innerH} fill="transparent" />
              <rect x={x} y={y} width={barW} height={Math.max(barH, row.revenue > 0 ? 2 : 0)} rx={6}
                className={isActive ? 'fill-blue-500' : 'fill-blue-600/80 dark:fill-blue-500/80'} />
              <text x={x + barW / 2} y={height - 4} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" fontSize="8">
                {row.shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
          <p className="font-semibold text-slate-900 dark:text-white">{hovered.monthYear}</p>
          <p className="tabular-nums text-blue-700 dark:text-sky-300">{formatVND(hovered.revenue)}</p>
        </div>
      )}
    </div>
  );
}
