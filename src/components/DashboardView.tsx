import { MonthFilter } from './MonthFilter';
import React, { useState, useMemo, useLayoutEffect, useRef } from 'react';
import { buildDailyMetrics, getCurrentMonthYear } from '../utils/dashboardMetrics';
import { DashboardShareChart } from './DashboardShareChart';
import { DentalOrder, CashflowTransaction, DeliveryRecord } from '../types/dental';
import {
  formatVND,
  formatCompactVND,
  sortMonthYearsDesc,
  getPreviousMonthYear,
} from '../utils/financeUtils';
import {
  Activity,
  Building2,
  ShieldCheck,
  ArrowRight,
  Printer,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  FileDown,
  BarChart3,
  ChevronDown,
  Truck,
  Plus,
  Wallet,
} from 'lucide-react';

interface DashboardViewProps {
  orders: DentalOrder[];
  cashflows: CashflowTransaction[];
  deliveries: DeliveryRecord[];
  onNavigateToOrders: () => void;
  onNavigateToRevenue: (monthYear?: string, clinicName?: string) => void;
  onNavigateToDebt: () => void;
  onViewOrder: (order: DentalOrder) => void;
  onPrintTicket: (order: DentalOrder) => void;
  onExportInvoicePdf: (
    orders: DentalOrder[],
    clinicName: string,
    monthYear: string
  ) => void;
  onNewOrder: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  cashflows,
  deliveries,
  onNavigateToOrders,
  onNavigateToRevenue,
  onNavigateToDebt,
  onViewOrder,
  onPrintTicket,
  onExportInvoicePdf,
  onNewOrder,
}) => {
  const currentMonth = getCurrentMonthYear();
  const availableMonths = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    cashflows.forEach(item => { if (item.monthYear) set.add(item.monthYear); });
    deliveries.forEach(item => { if (item.monthYear) set.add(item.monthYear); });
    orders.forEach((o) => {
      if (o.monthYear) set.add(o.monthYear);
    });
    return sortMonthYearsDesc(Array.from(set));
  }, [orders, cashflows, deliveries, currentMonth]);

  const latestMonth = currentMonth;
  const prevMonthOfLatest = getPreviousMonthYear(latestMonth);

  const [selectedMonth, setSelectedMonth] = useState<string>(latestMonth);
  const [selectedClinicLens, setSelectedClinicLens] = useState<string>('');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'teeth' | 'orders'>(
    'teeth'
  );
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [recentFilter, setRecentFilter] = useState<'all' | 'large' | 'vip'>('all');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(780);

  useLayoutEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const measure = () => setChartWidth(Math.max(240, container.clientWidth - 8));
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    return () => observer.disconnect();
  }, []);

  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.monthYear !== selectedMonth) return false;
      if (selectedClinicLens && o.clinicName !== selectedClinicLens) return false;
      return true;
    });
  }, [orders, selectedMonth, selectedClinicLens]);

  const prevMonthKey = getPreviousMonthYear(selectedMonth);

  const prevPeriodOrders = useMemo(() => {
    if (!prevMonthKey) return [];
    return orders.filter((o) => {
      if (o.monthYear !== prevMonthKey) return false;
      if (selectedClinicLens && o.clinicName !== selectedClinicLens) return false;
      return true;
    });
  }, [orders, prevMonthKey, selectedClinicLens]);

  const periodRevenue = periodOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const prevRevenue = prevPeriodOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const revenueGrowthPct =
    prevRevenue > 0
      ? Math.round(((periodRevenue - prevRevenue) / prevRevenue) * 100)
      : 0;

  const periodTeeth = periodOrders.reduce((s, o) => s + (o.teethCount ?? 0), 0);
  const prevTeeth = prevPeriodOrders.reduce((s, o) => s + (o.teethCount ?? 0), 0);
  const teethGrowthPct =
    prevTeeth > 0 ? Math.round(((periodTeeth - prevTeeth) / prevTeeth) * 100) : 0;

  const avgOrderValue =
    periodOrders.length > 0 ? Math.round(periodRevenue / periodOrders.length) : 0;
  const avgTeethPerOrder =
    periodOrders.length > 0
      ? (periodTeeth / periodOrders.length).toFixed(1)
      : '0.0';

  const periodFinancials = useMemo(() => {
    const cfList = cashflows.filter((c) => c.monthYear === selectedMonth);
    const income = cfList
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + c.amount, 0);
    const expense = cfList
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + c.amount, 0);

    const delivList = deliveries.filter((d) => {
      if (d.monthYear !== selectedMonth) return false;
      if (selectedClinicLens && d.clinicName !== selectedClinicLens) return false;
      return true;
    });
    const shippingFee = delivList.reduce((s, d) => s + (d.shippingFee || 0), 0);

    return {
      income,
      expense,
      netCash: income - expense,
      shippingFee,
      tripCount: delivList.length,
    };
  }, [cashflows, deliveries, selectedMonth, selectedClinicLens]);

  const clinicRevenueMap = useMemo(() => {
    const baseOrders = periodOrders;

    const map = new Map<
      string,
      {
        clinicName: string;
        address: string;
        orderCount: number;
        teethCount: number;
        revenue: number;
        orders: DentalOrder[];
      }
    >();
    baseOrders.forEach((o) => {
      const c = o.clinicName?.trim() || 'Nha Khoa Đối Tác';
      if (!map.has(c)) {
        map.set(c, {
          clinicName: c,
          address: o.clinicAddress || 'Đà Nẵng',
          orderCount: 0,
          teethCount: 0,
          revenue: 0,
          orders: [],
        });
      }
      const item = map.get(c)!;
      item.orderCount += 1;
      item.teethCount += o.teethCount ?? 0;
      item.revenue += o.totalAmount || 0;
      item.orders.push(o);
    });
    return Array.from(map.values()).sort(
      (a, b) => b.teethCount - a.teethCount || b.revenue - a.revenue
    );
  }, [periodOrders]);

  const dailyChartData = useMemo(
    () => buildDailyMetrics(periodOrders, selectedMonth),
    [periodOrders, selectedMonth]
  );

  const svgChartCoords = useMemo(() => {
    const width = chartWidth;
    const height = width < 640 ? 290 : 300;
    const padX = width < 640 ? 40 : 56;
    const padY = 28;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    const n = dailyChartData.length;

    const getVal = (d: (typeof dailyChartData)[0]) =>
      chartMetric === 'revenue'
        ? d.revenue
        : chartMetric === 'teeth'
        ? d.teeth
        : d.orders;

    const maxVal = Math.max(...dailyChartData.map(getVal), 1);
    const hasValues = dailyChartData.some(item => getVal(item) > 0);

    const points = dailyChartData.map((d, i) => {
      const val = getVal(d);
      const x = n > 1 ? padX + (i / (n - 1)) * usableW : width / 2;
      const y = padY + usableH - (val / maxVal) * usableH;
      return { x, y, val, ...d };
    });

    let smoothPath = '';
    if (points.length > 0) {
      smoothPath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpx1 = p0.x + (p1.x - p0.x) * 0.45;
        const cpy1 = p0.y;
        const cpx2 = p0.x + (p1.x - p0.x) * 0.55;
        const cpy2 = p1.y;
        smoothPath += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(
          1
        )} ${cpy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }
    }

    const areaPath =
      points.length > 0
        ? `${smoothPath} L ${points[points.length - 1].x.toFixed(1)} ${
            height - padY
          } L ${points[0].x.toFixed(1)} ${height - padY} Z`
        : '';

    return { width, height, padX, padY, maxVal, hasValues, points, smoothPath, areaPath };
  }, [dailyChartData, chartMetric, chartWidth]);

  const materialStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; teeth: number; revenue: number }
    >();
    periodOrders.forEach((o) => {
      const m = o.material?.trim() || 'Chưa xác định';
      if (!map.has(m)) {
        map.set(m, { name: m, count: 0, teeth: 0, revenue: 0 });
      }
      const item = map.get(m)!;
      item.count += 1;
      item.teeth += o.teethCount ?? 0;
      item.revenue += o.totalAmount || 0;
    });

    return Array.from(map.values())
      .sort((a, b) => b.teeth - a.teeth || b.revenue - a.revenue);
  }, [periodOrders]);

  const materialBasis = periodTeeth > 0 ? 'teeth' : 'orders';
  const materialShares = materialStats.map(item => ({
    name: item.name, value: materialBasis === 'teeth' ? item.teeth : item.count,
  }));
  const clinicBasis = periodTeeth > 0 ? 'teeth' : 'orders';
  const clinicShares = clinicRevenueMap.map(item => ({
    name: item.clinicName,
    value: clinicBasis === 'teeth' ? item.teethCount : item.orderCount,
  }));
  const metricColor = chartMetric === 'revenue' ? '#2563eb' : chartMetric === 'teeth' ? '#0891b2' : '#d97706';
  const formatMetric = (value: number) => chartMetric === 'revenue' ? formatCompactVND(value) : value.toLocaleString('vi-VN');
  const activePoint = hoveredPointIdx === null ? undefined : svgChartCoords.points[hoveredPointIdx];

  const filteredRecentOrders = useMemo(() => {
    return periodOrders
      .filter((o) => {
        if (recentFilter === 'large') return (o.teethCount || 1) >= 5;
        if (recentFilter === 'vip') return (o.warrantyYears || 5) >= 10;
        return true;
      })
      .slice(0, 10);
  }, [periodOrders, recentFilter]);

  const clinicFilterButton = selectedClinicLens ? (
            <button
              onClick={() => setSelectedClinicLens('')}
              className="min-h-11 max-w-full break-words px-2.5 py-1 text-xs sm:min-h-0 sm:text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-500/20 cursor-pointer"
            >
              {selectedClinicLens} ×
            </button>
          ) : null;

  const invoiceButton = (
        <button
          aria-label={`Xuất hóa đơn PDF tháng ${selectedMonth}`}
          title="Xuất hóa đơn PDF"
          onClick={() =>
            onExportInvoicePdf(
              periodOrders,
              selectedClinicLens,
              selectedMonth
            )
          }
          className="flex size-11 shrink-0 items-center justify-center gap-1.5 sm:h-auto sm:w-auto sm:px-3.5 sm:py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] cursor-pointer"
        >
          <FileDown aria-hidden="true" className="size-4 sm:size-3.5" />
          <span className="hidden sm:inline">Xuất HĐ PDF</span>
        </button>
  );

  const metricButtons = (
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200/60 bg-slate-100/90 p-0.5 text-[10px] sm:gap-1 sm:rounded-xl sm:p-1 sm:text-[11px] dark:border-slate-800 dark:bg-slate-950/80">
      {([{ value: 'teeth', label: 'Số răng' }, { value: 'orders', label: 'Số ca' }, { value: 'revenue', label: 'Doanh thu' }] as const).map(metric => (
        <button key={metric.value} type="button" aria-pressed={chartMetric === metric.value} onClick={() => setChartMetric(metric.value)}
          className={`min-h-8 whitespace-nowrap rounded-md px-1.5 py-1 font-bold sm:min-h-0 sm:rounded-lg sm:px-3 sm:py-1.5 focus-visible:outline-2 focus-visible:outline-blue-500 ${chartMetric === metric.value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          {metric.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      {/* 1. Spatial Command Bar: Compact Month Select + PDF Invoice Export */}
      <div className="bento-card px-3 py-2.5 sm:px-4 rounded-2xl hidden items-start justify-between gap-3 sm:flex">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none">
          <div className="hidden sm:block relative min-w-0 w-full sm:w-auto">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <MonthFilter
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setHoveredPointIdx(null); }}
              aria-label="Tháng tổng quan"
              className="h-11 w-full min-w-0 pl-8 pr-3 sm:pr-4 sm:h-auto sm:py-1.5 bg-white/90 dark:bg-slate-950 text-slate-900 dark:text-white text-base sm:text-xs font-semibold rounded-xl border border-slate-200/90 dark:border-slate-800 focus-visible:outline-2 focus-visible:outline-blue-500 cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                  {m === latestMonth
                    ? ' · Hiện tại'
                    : m === prevMonthOfLatest
                    ? ' · Tháng trước'
                    : ''}
                </option>
              ))}
            </MonthFilter>
          </div>

          {clinicFilterButton}
        </div>

        {invoiceButton}
      </div>

      {/* 2. Four Futuristic Spatial Bento KPI Cards with Deep Dark-Jewel Gradient Backgrounds */}
      <div className="dashboard-kpis grid min-w-0 grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 2: Teeth Production */}
        <div className="p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border border-teal-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-teal-500/15 blur-2xl pointer-events-none group-hover:bg-teal-400/25 transition-all" />
          <div className="flex items-start justify-between relative">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
                Sản Lượng Chế Tác
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-2xl sm:text-[26px] font-bold text-white font-mono">
                  {periodTeeth.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                  Răng
                </span>
              </div>
            </div>
            <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="dashboard-kpi-footer mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] relative">
            <div className="flex items-center gap-1.5">
              {prevTeeth > 0 && (
                <span
                  className={`font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    teethGrowthPct >= 0
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-400/25'
                  }`}
                >
                  {teethGrowthPct >= 0 ? `+${teethGrowthPct}%` : `${teethGrowthPct}%`}
                </span>
              )}
              <span className="text-slate-300/80 font-mono">
                {periodOrders.length} ca ({avgTeethPerOrder} R/ca)
              </span>
            </div>

            <button
              onClick={onNavigateToOrders}
              className="font-bold text-teal-300 hover:text-teal-200 underline-offset-2 hover:underline cursor-pointer"
            >
              Đơn hàng →
            </button>
          </div>
        </div>

        {/* KPI 1: Revenue */}
        <div className="p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-500/15 blur-2xl pointer-events-none group-hover:bg-blue-400/25 transition-all" />
          <div className="flex items-start justify-between relative">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
                Doanh Thu {`T.${selectedMonth}`}
              </span>
              <div role="group" aria-label={`Doanh thu ${formatVND(periodRevenue)}`} title={formatVND(periodRevenue)} className="font-display text-xl sm:text-[26px] font-bold text-white font-mono mt-1 tracking-tight">
                <span aria-hidden="true" className="sm:hidden">{formatCompactVND(periodRevenue)}</span>
                <span aria-hidden="true" className="hidden sm:inline">{formatVND(periodRevenue)}</span>
              </div>
            </div>
            <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 text-sky-300 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="dashboard-kpi-footer mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs relative">
            <div className="flex items-center gap-1.5">
              {prevRevenue > 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                    revenueGrowthPct >= 0
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-400/25'
                  }`}
                >
                  {revenueGrowthPct >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {revenueGrowthPct >= 0 ? `+${revenueGrowthPct}%` : `${revenueGrowthPct}%`}
                </span>
              )}
              <span className="text-[11px] text-slate-300/80 font-mono">
                TB: {formatCompactVND(avgOrderValue)}/ca
              </span>
            </div>

            <button
              onClick={() =>
                onNavigateToRevenue(
                  selectedMonth,
                  selectedClinicLens
                )
              }
              className="text-[11px] font-bold text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline cursor-pointer"
            >
              Chi tiết →
            </button>
          </div>
        </div>

        {/* KPI 3: Partner Clinics */}
        <div className="p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 text-white border border-amber-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-500/15 blur-2xl pointer-events-none group-hover:bg-amber-400/25 transition-all" />
          <div className="flex items-start justify-between relative">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
                Nha Khoa Đối Tác
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-2xl sm:text-[26px] font-bold text-white font-mono">
                  {clinicRevenueMap.length}
                </span>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Đơn vị
                </span>
              </div>
            </div>
            <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="dashboard-kpi-footer mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] relative">
            <span className="text-slate-300/80 truncate max-w-[165px]">
              #1:{' '}
              <strong className="text-white font-bold">
                {clinicRevenueMap[0]?.clinicName || '—'}
              </strong>
            </span>
            <button
              onClick={onNavigateToDebt}
              className="font-bold text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline cursor-pointer shrink-0"
            >
              Công nợ →
            </button>
          </div>
        </div>

        {/* KPI 4: Cashflow & Logistics */}
        <div className="p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white border border-violet-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-violet-500/15 blur-2xl pointer-events-none group-hover:bg-violet-400/25 transition-all" />
          <div className="flex items-start justify-between relative">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
                Quỹ Ròng & Giao Vận
              </span>
              <div role="group" aria-label={`Quỹ ròng ${formatVND(periodFinancials.netCash)}`} title={formatVND(periodFinancials.netCash)} className="font-display text-xl sm:text-[26px] font-bold text-white font-mono mt-1">
                <span aria-hidden="true" className="sm:hidden">{formatCompactVND(periodFinancials.netCash)}</span>
                <span aria-hidden="true" className="hidden sm:inline">{formatVND(periodFinancials.netCash)}</span>
              </div>
            </div>
            <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-300 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="dashboard-kpi-footer mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] relative">
            <span className="text-slate-300/80 flex items-center gap-1 font-mono">
              <Truck className="w-3.5 h-3.5 text-violet-300" />
              Ship: {formatVND(periodFinancials.shippingFee)}
            </span>
            <span className="font-mono text-slate-300/90 font-semibold">
              {periodFinancials.tripCount} chuyến
            </span>
          </div>
        </div>
      </div>

      {/* Monthly growth with compact material and clinic shares. */}
      <section aria-label={`Tổng quan tháng ${selectedMonth}`} className="bento-card min-w-0 rounded-2xl p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 sm:flex-wrap sm:gap-3 border-b border-slate-200/60 pb-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-sky-400">
              <BarChart3 aria-hidden="true" className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">Quỹ đạo tăng trưởng trong tháng</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Theo ngày · Tháng {selectedMonth}</p>
            </div>
          </div>
          <div className="sm:hidden">{invoiceButton}</div>
          <div className="hidden sm:block">{metricButtons}</div>
        </div>
        {selectedClinicLens && <div className="pt-2 sm:hidden">{clinicFilterButton}</div>}
        <div className="min-w-0 pt-4">
          <div className="min-w-0">
            <div aria-live="polite" className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:gap-x-3 sm:px-1">
              <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-1 text-[10px] font-semibold whitespace-nowrap text-white dark:bg-slate-800 sm:px-2 sm:text-xs">{activePoint ? activePoint.date : `Tháng ${selectedMonth}`}</span>
              <div className="ml-auto sm:hidden">{metricButtons}</div>
              <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 sm:w-auto">
                <span className="font-semibold tabular-nums text-blue-600 dark:text-sky-400">{formatVND(activePoint ? activePoint.revenue : periodRevenue)}</span>
                <span className="text-slate-500 dark:text-slate-400">{activePoint ? activePoint.teeth : periodTeeth} răng · {activePoint ? activePoint.orders : periodOrders.length} ca</span>
              </div>
            </div>
            <div ref={chartContainerRef} className="relative mt-3 min-w-0 rounded-xl bg-slate-50/40 p-1 dark:bg-slate-950/20">
              <svg viewBox={`0 0 ${svgChartCoords.width} ${svgChartCoords.height}`} style={{ height: svgChartCoords.height }} className="w-full" aria-label={`Biểu đồ ${chartMetric === 'revenue' ? 'doanh thu' : chartMetric === 'teeth' ? 'số răng' : 'số ca'} theo ngày trong tháng ${selectedMonth}`}>
                <defs>
                  <linearGradient id="monthlyGrowthArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={metricColor} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={metricColor} stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                {[0, 0.5, 1].map(ratio => {
                  const y = svgChartCoords.padY + ratio * (svgChartCoords.height - svgChartCoords.padY * 2);
                  return <g key={ratio}>
                    <line x1={svgChartCoords.padX} x2={svgChartCoords.width - svgChartCoords.padX} y1={y} y2={y} stroke="currentColor" strokeDasharray="4 4" className="text-slate-200 dark:text-slate-800" />
                    {(svgChartCoords.hasValues || ratio === 1) && <text x={svgChartCoords.padX - 8} y={y + 3} textAnchor="end" className="fill-slate-500 text-[10px] dark:fill-slate-400">{formatMetric(svgChartCoords.maxVal * (1 - ratio))}</text>}
                  </g>;
                })}
                <path d={svgChartCoords.areaPath} fill="url(#monthlyGrowthArea)" />
                <path d={svgChartCoords.smoothPath} fill="none" stroke={metricColor} strokeWidth="2.5" strokeLinecap="round" />
                {svgChartCoords.points.map((point, index) => {
                  const isActive = hoveredPointIdx === index;
                  const showDay = index === 0 || Number(point.day) % 5 === 0 || index === svgChartCoords.points.length - 1;
                  return <g key={point.day} role="button" tabIndex={0}
                    aria-label={`Ngày ${point.date}: ${formatVND(point.revenue)}, ${point.teeth} răng, ${point.orders} ca`}
                    onMouseEnter={() => setHoveredPointIdx(index)} onMouseLeave={() => setHoveredPointIdx(null)}
                    onFocus={() => setHoveredPointIdx(index)} onBlur={() => setHoveredPointIdx(null)}
                    onClick={() => setHoveredPointIdx(index)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setHoveredPointIdx(index); } }}
                    className="cursor-pointer outline-none">
                    <rect x={point.x - (svgChartCoords.width - svgChartCoords.padX * 2) / Math.max(1, dailyChartData.length - 1) / 2} y={0} width={(svgChartCoords.width - svgChartCoords.padX * 2) / Math.max(1, dailyChartData.length - 1)} height={svgChartCoords.height} fill="transparent" />
                    {isActive && <line x1={point.x} x2={point.x} y1={svgChartCoords.padY} y2={svgChartCoords.height - svgChartCoords.padY} stroke={metricColor} strokeDasharray="3 3" opacity="0.5" />}
                    <circle cx={point.x} cy={point.y} r={isActive ? 5 : point.val > 0 ? 3 : 2} fill={isActive ? metricColor : 'white'} stroke={metricColor} strokeWidth={isActive ? 3 : 1.5} />
                    {isActive && <text x={point.x} y={point.y - 11} textAnchor="middle" className="fill-slate-900 text-[11px] font-bold dark:fill-white">{formatMetric(point.val)}</text>}
                    {showDay && <text x={point.x} y={svgChartCoords.height - 5} textAnchor="middle" className="fill-slate-500 text-[11px] dark:fill-slate-400">{point.day}</text>}
                  </g>;
                })}
              </svg>
              <aside className="absolute right-1.5 top-1.5 z-10 grid w-[44%] max-w-40 gap-1.5 sm:right-2 sm:top-2 sm:w-56 sm:max-w-none">
                <DashboardShareChart title="Tỉ trọng vật liệu sứ" basis={materialBasis === 'teeth' ? 'Theo số răng' : 'Theo số ca'}
                  items={materialShares} formatValue={value => `${value.toLocaleString('vi-VN')} ${materialBasis === 'teeth' ? 'răng' : 'ca'}`} />
                <DashboardShareChart title="Top nha khoa" basis={clinicBasis === 'teeth' ? 'Theo số răng' : 'Theo số ca'}
                  items={clinicShares} formatValue={value => `${value.toLocaleString('vi-VN')} ${clinicBasis === 'teeth' ? 'răng' : 'ca'}`}
                  onSelect={name => { setSelectedClinicLens(name); setHoveredPointIdx(null); }} />
              </aside>
            </div>
            <p className="mt-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">{periodOrders.length === 0 ? 'Chưa có đơn hàng trong tháng này.' : 'Chọn một điểm để xem số liệu trong ngày.'}</p>
          </div>

        </div>
      </section>

      {/* 5. Row 3: Live Production & Warranty Stream */}
      <div className="bento-card rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Ca phục hình tháng {selectedMonth} ({periodOrders.length})
            </h3>

            <div className="grid w-full grid-cols-3 gap-1 p-1 bg-slate-100/90 dark:bg-slate-950/80 rounded-xl text-[11px] border border-slate-200/60 dark:border-slate-800 sm:flex sm:w-auto [&_button]:min-h-11 sm:[&_button]:min-h-0">
              <button
                onClick={() => setRecentFilter('all')}
                className={`px-2.5 py-0.5 rounded-lg font-bold cursor-pointer ${
                  recentFilter === 'all'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setRecentFilter('large')}
                className={`px-2.5 py-0.5 rounded-lg font-bold cursor-pointer ${
                  recentFilter === 'large'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-sky-400 shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                Ca lớn (≥ 5 răng)
              </button>
              <button
                onClick={() => setRecentFilter('vip')}
                className={`px-2.5 py-0.5 rounded-lg font-bold cursor-pointer ${
                  recentFilter === 'vip'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                BH 10-15 năm
              </button>
            </div>
          </div>

          <button
            onClick={onNavigateToOrders}
            className="flex min-h-11 items-center gap-1 text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer sm:min-h-0"
          >
            Mở toàn bộ danh sách <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
          {filteredRecentOrders.map(order => (
            <details key={order.id} className="group px-3">
              <summary className="flex min-h-20 list-none cursor-pointer items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold text-slate-900 dark:text-white">{order.patientName || 'Chưa có tên khách hàng'}</span>
                  <span className="mt-1 block break-words text-xs text-slate-500 dark:text-slate-400"><strong className="font-semibold text-blue-600 dark:text-sky-400">{order.warrantyCode || '—'}</strong> · {order.clinicName || '—'}</span>
                </span>
                <span className="shrink-0 rounded-lg bg-cyan-50 px-2 py-1.5 text-xs font-bold tabular-nums text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300">{order.teethCount ?? 0} răng</span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950/50">
                <div className="min-w-0"><dt className="text-slate-500 dark:text-slate-400">Dòng sứ</dt><dd className="mt-1 break-words font-medium text-slate-900 dark:text-white">{order.material || '—'}</dd></div>
                <div className="min-w-0"><dt className="text-slate-500 dark:text-slate-400">Vị trí răng</dt><dd className="mt-1 break-words font-medium text-slate-900 dark:text-white">{order.teeth || '—'}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Ngày</dt><dd className="mt-1 font-medium text-slate-900 dark:text-white">{order.orderDate}</dd></div>
                <div className="min-w-0"><dt className="text-slate-500 dark:text-slate-400">Thành tiền</dt><dd className="mt-1 break-words font-bold tabular-nums text-blue-600 dark:text-sky-400">{formatVND(order.totalAmount)}</dd></div>
              </dl>
              <div className="grid grid-cols-3 gap-2 py-3">
                <button type="button" onClick={() => onViewOrder(order)} className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 text-xs font-medium text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-slate-700 dark:text-emerald-400"><ShieldCheck aria-hidden="true" className="size-4" />Bảo hành</button>
                <button type="button" onClick={() => onExportInvoicePdf([order], order.clinicName, order.monthYear)} className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 text-xs font-medium text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:text-sky-400"><FileDown aria-hidden="true" className="size-4" />Hóa đơn</button>
                <button type="button" onClick={() => onPrintTicket(order)} className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300"><Printer aria-hidden="true" className="size-4" />Phiếu</button>
              </div>
            </details>
          ))}
          {filteredRecentOrders.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-500">Không có ca phục hình phù hợp trong tháng.</p>}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/70 dark:border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Mã BH</th>
                <th className="py-2.5 px-4">Khách Hàng</th>
                <th className="py-2.5 px-4">Nha Khoa</th>
                <th className="py-2.5 px-4">Dòng Sứ</th>
                <th className="py-2.5 px-3">Vị Trí Răng</th>
                <th className="py-2.5 px-2 text-center">SL</th>
                <th className="py-2.5 px-4 text-right">Thành Tiền</th>
                <th className="py-2.5 px-3">Ngày</th>
                <th className="py-2.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/70">
              {filteredRecentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-blue-500/5 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-sky-400">
                    {order.warrantyCode}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                    {order.patientName}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                    {order.clinicName}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {order.material}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 truncate max-w-[140px]">
                    {order.teeth}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                    {order.teethCount}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatVND(order.totalAmount)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                    {order.orderDate}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onViewOrder(order)}
                        title="Xem & In Thẻ Bảo Hành"
                        className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          onExportInvoicePdf([order], order.clinicName, order.monthYear)
                        }
                        title="Xuất Hóa Đơn PDF"
                        className="p-1.5 text-blue-600 dark:text-sky-400 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onPrintTicket(order)}
                        title="In Phiếu Labo"
                        className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
