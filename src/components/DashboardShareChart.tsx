import React, { useState } from 'react';
import { buildShareSegments } from '../utils/dashboardMetrics';

const colors = ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#94a3b8'];

interface DashboardShareChartProps {
  title: string;
  basis: string;
  items: { name: string; value: number }[];
  formatValue: (value: number) => string;
  onSelect?: (name: string) => void;
}

export function DashboardShareChart({ title, basis, items, formatValue, onSelect }: DashboardShareChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const segments = buildShareSegments(items);
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const active = activeIndex === null ? undefined : segments[activeIndex];
  let offset = 0;

  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-slate-200/70 bg-white/90 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/90 sm:p-2">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h4 className="text-[10px] font-bold sm:text-xs text-slate-900 dark:text-white">{title}</h4>
        <span className="hidden text-[10px] text-slate-500 sm:inline dark:text-slate-400">{basis}</span>
      </div>
      {segments.length === 0 ? (
        <p className="flex min-h-10 items-center justify-center text-xs text-slate-500 dark:text-slate-400">Chưa có dữ liệu trong tháng.</p>
      ) : (
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="relative size-9 shrink-0 sm:size-14">
            <svg viewBox="0 0 100 100" role="img" aria-label={`${title}: ${segments.map(item => `${item.name} ${item.percent.toFixed(1)}%`).join(', ')}`} className="size-full -rotate-90">
              <circle cx="50" cy="50" r="38" fill="none" strokeWidth="12" className="stroke-slate-200 dark:stroke-slate-800" />
              {segments.map((segment, index) => {
                const start = offset;
                offset += segment.fraction;
                return <circle key={segment.name} cx="50" cy="50" r="38" fill="none" pathLength="1"
                  stroke={colors[index]} strokeWidth={activeIndex === index ? 15 : 12}
                  strokeDasharray={`${segment.fraction} ${1 - segment.fraction}`} strokeDashoffset={-start}
                  onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}>
                  <title>{segment.name}: {formatValue(segment.value)} ({segment.percent.toFixed(1)}%)</title>
                </circle>;
              })}
            </svg>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
              <span className="hidden max-w-full truncate text-[9px] sm:block text-slate-500 dark:text-slate-400">{active ? active.name : 'Tổng tháng'}</span>
              <span className="mt-0.5 max-w-full truncate text-[7px] font-bold tabular-nums sm:text-[9px] text-slate-900 dark:text-white">{active ? `${active.percent.toFixed(1)}%` : formatValue(total)}</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-0">
            {segments.map((segment, index) => (
              <li key={segment.name}>
                <button type="button" title={`${segment.name}: ${formatValue(segment.value)} (${segment.percent.toFixed(1)}%)`}
                  onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}
                  onClick={() => { setActiveIndex(index); if (segment.name !== 'Khác') onSelect?.(segment.name); }}
                  className="flex min-h-4 w-full min-w-0 items-center gap-1 rounded px-0.5 text-left text-[9px] sm:min-h-5 sm:text-[11px] hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-slate-800">
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{segment.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">{segment.percent.toFixed(1)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
