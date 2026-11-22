import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Coins,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Minus,
  Moon,
  Receipt,
  Sun,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { DemoDailyRevenueChart, DemoMonthlyRevenueChart } from './DemoDashboardCharts';
import { buildDailyMetrics, getCurrentMonthYear } from '../utils/dashboardMetrics';
import { buildDemoDashboardModel, type DemoDashboardKpi, type MetricDelta } from '../utils/demoDashboard';
import { formatCompactVND, formatVND } from '../utils/financeUtils';
import { displayMaterialName } from '../utils/materialDisplayName';
import type { ProfitSources } from '../utils/profit';

interface DemoDashboardPageProps {
  sources: ProfitSources;
  isAdmin: boolean;
  isDark: boolean;
  userName?: string;
  onToggleTheme: () => void;
  onSignOut: () => void;
}

const kpiIcons = {
  revenue: TrendingUp,
  orders: Receipt,
  remainingDebt: CreditCard,
  collectedDebt: Wallet,
  netProfit: Coins,
};

function formatDelta(delta: MetricDelta, isCount = false): string {
  if (delta.direction === 'flat') return 'Không đổi so với tháng trước';
  const amount = isCount
    ? `${delta.amount > 0 ? '+' : ''}${delta.amount.toLocaleString('vi-VN')} đơn`
    : `${delta.amount > 0 ? '+' : '−'}${formatCompactVND(Math.abs(delta.amount))}`;
  if (delta.percent === null) return `${amount} · mới phát sinh`;
  const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 }).format(Math.abs(delta.percent));
  return `${amount} · ${delta.percent > 0 ? '+' : '−'}${percent}`;
}

function trendTone(kpi: DemoDashboardKpi): 'good' | 'bad' | 'flat' {
  if (kpi.delta.direction === 'flat') return 'flat';
  const improved = kpi.invertTrend ? kpi.delta.direction === 'down' : kpi.delta.direction === 'up';
  return improved ? 'good' : 'bad';
}

function KpiCard({ kpi, hidden }: { kpi: DemoDashboardKpi; hidden?: boolean }) {
  const Icon = kpiIcons[kpi.key];
  const tone = trendTone(kpi);
  const isCount = kpi.key === 'orders';
  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{kpi.label}</p>
          {hidden ? (
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">Chỉ quản trị viên được xem số này.</p>
          ) : (
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-[1.7rem]">
              {isCount ? kpi.current.toLocaleString('vi-VN') : formatVND(kpi.current)}
            </p>
          )}
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-blue-600/10 text-blue-700 dark:bg-blue-500/15 dark:text-sky-300">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
      {!hidden && (
        <p className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
          tone === 'good' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : tone === 'bad' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
        }`}>
          {tone === 'good' ? <ArrowUpRight className="size-3.5" aria-hidden="true" />
            : tone === 'bad' ? <ArrowDownRight className="size-3.5" aria-hidden="true" />
              : <Minus className="size-3.5" aria-hidden="true" />}
          {formatDelta(kpi.delta, isCount)}
        </p>
      )}
    </article>
  );
}

export function DemoDashboardPage({
  sources, isAdmin, isDark, userName, onToggleTheme, onSignOut,
}: DemoDashboardPageProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthYear());
  const model = useMemo(() => buildDemoDashboardModel(selectedMonth, sources), [selectedMonth, sources]);
  const daily = useMemo(() => buildDailyMetrics(sources.orders, selectedMonth), [sources.orders, selectedMonth]);
  const months = model.months.includes(selectedMonth) ? model.months : [selectedMonth, ...model.months];
  const maxClinic = Math.max(...model.topClinics.map((row) => row.grossRevenue), 1);

  return (
    <div className="min-h-screen" data-atlab-demo="dashboard">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/75 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20">
              <LayoutDashboard aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                Bảng điều khiển demo ATLab
              </h1>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                Bản xem thử chỉ đọc · {userName || 'Tài khoản đã đăng nhập'}
              </p>
            </div>
          </div>
          <label className="relative flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <CalendarDays aria-hidden="true" className="size-4 text-blue-600 dark:text-sky-400" />
            <span className="sr-only">Chọn tháng</span>
            <select
              aria-label="Chọn tháng báo cáo"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="min-w-[7.5rem] cursor-pointer bg-transparent py-2 pr-1 outline-none"
            >
              {months.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onToggleTheme}
            className="grid size-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label={isDark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}>
            {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={onSignOut}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <LogOut aria-hidden="true" className="size-4" /> Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {model.kpis.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} hidden={kpi.key === 'netProfit' && !isAdmin} />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70 sm:p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">Doanh thu theo ngày</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Tháng {selectedMonth}</p>
              </div>
              <p className="text-xs font-semibold tabular-nums text-blue-700 dark:text-sky-300">{formatVND(model.currentReport.grossRevenue)}</p>
            </div>
            <DemoDailyRevenueChart data={daily} monthYear={selectedMonth} />
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70 sm:p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">Doanh thu 12 tháng</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Kết thúc ở {selectedMonth}</p>
              </div>
            </div>
            <DemoMonthlyRevenueChart data={model.trailingMonths} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70 sm:p-5 xl:col-span-2">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">Top nha khoa theo doanh thu</h2>
            <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">Tháng {selectedMonth}</p>
            {model.topClinics.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                Chưa có doanh thu nha khoa trong tháng này.
              </p>
            ) : (
              <ul className="space-y-3">
                {model.topClinics.map((clinic, index) => (
                  <li key={`${clinic.clinicName}-${index}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                        <span className="mr-2 font-mono text-[11px] text-slate-400">{index + 1}</span>
                        {clinic.clinicName}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">{formatVND(clinic.grossRevenue)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                        style={{ width: `${Math.max(4, (clinic.grossRevenue / maxClinic) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {clinic.orderCount} đơn · {clinic.teethCount} răng
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70 sm:p-5 xl:col-span-3">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">Đơn hàng gần đây</h2>
            <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">Sắp xếp theo lúc thêm đơn, mới nhất trước</p>
            {model.recentOrders.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                Chưa có đơn hàng trong tháng này.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <thead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="pb-2 pr-3">Mã BH</th>
                      <th className="pb-2 pr-3">Khách hàng</th>
                      <th className="pb-2 pr-3">Nha khoa</th>
                      <th className="pb-2 pr-3">Vật liệu</th>
                      <th className="pb-2 pr-3">Ngày</th>
                      <th className="pb-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {model.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="py-2.5 pr-3 font-mono font-semibold text-blue-700 dark:text-sky-300">{order.warrantyCode || '—'}</td>
                        <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-white">{order.patientName || '—'}</td>
                        <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{order.clinicName || '—'}</td>
                        <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{displayMaterialName(order.material) || '—'}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{order.orderDate || '—'}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{formatVND(order.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
