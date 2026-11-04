import React, { useState, useMemo } from 'react';
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
  PieChart,
  Truck,
  Plus,
  Wallet,
  Award,
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

const CHART_COLORS = [
  '#2563EB', // Electric Sapphire
  '#06B6D4', // Cyber Cyan
  '#10B981', // Emerald Jade
  '#F59E0B', // Solar Amber
  '#8B5CF6', // Quantum Violet
  '#EC4899', // Neon Rose
];

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
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.monthYear) set.add(o.monthYear);
    });
    return sortMonthYearsDesc(Array.from(set));
  }, [orders]);

  const latestMonth =
    availableMonths.find((m) => m === '11/2026') || availableMonths[0] || '11/2026';
  const prevMonthOfLatest = getPreviousMonthYear(latestMonth);

  const [selectedMonth, setSelectedMonth] = useState<string>(latestMonth);
  const [selectedClinicLens, setSelectedClinicLens] = useState<string>('');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'teeth' | 'orders'>(
    'revenue'
  );
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [hoveredMaterialIdx, setHoveredMaterialIdx] = useState<number | null>(null);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const [recentFilter, setRecentFilter] = useState<'all' | 'large' | 'vip'>('all');

  const clinicOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.clinicName?.trim()) set.add(o.clinicName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [orders]);

  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedMonth !== 'ALL' && o.monthYear !== selectedMonth) return false;
      if (selectedClinicLens && o.clinicName !== selectedClinicLens) return false;
      return true;
    });
  }, [orders, selectedMonth, selectedClinicLens]);

  const prevMonthKey =
    selectedMonth === 'ALL' ? '' : getPreviousMonthYear(selectedMonth);

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
    const cfList =
      selectedMonth === 'ALL'
        ? cashflows
        : cashflows.filter((c) => c.monthYear === selectedMonth);
    const income = cfList
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + c.amount, 0);
    const expense = cfList
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + c.amount, 0);

    const delivList = deliveries.filter((d) => {
      if (selectedMonth !== 'ALL' && d.monthYear !== selectedMonth) return false;
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
    const baseOrders =
      selectedMonth === 'ALL'
        ? orders
        : orders.filter((o) => o.monthYear === selectedMonth);

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
      (a, b) => b.revenue - a.revenue || b.teethCount - a.teethCount
    );
  }, [orders, selectedMonth]);

  const maxClinicRevenue = Math.max(
    ...clinicRevenueMap.map((c) => (c.revenue > 0 ? c.revenue : c.teethCount)),
    1
  );

  const monthlyChartData = useMemo(() => {
    const map = new Map<
      string,
      { month: string; revenue: number; orders: number; teeth: number }
    >();
    orders.forEach((o) => {
      if (selectedClinicLens && o.clinicName !== selectedClinicLens) return;
      const m = o.monthYear;
      if (!m) return;
      if (!map.has(m)) {
        map.set(m, { month: m, revenue: 0, orders: 0, teeth: 0 });
      }
      const entry = map.get(m)!;
      entry.revenue += o.totalAmount || 0;
      entry.orders += 1;
      entry.teeth += o.teethCount ?? 0;
    });
    const sorted = sortMonthYearsDesc(Array.from(map.keys()))
      .slice(0, 12)
      .reverse();
    return sorted.map((m) => map.get(m)!);
  }, [orders, selectedClinicLens]);

  const svgChartCoords = useMemo(() => {
    const width = 780;
    const height = 210;
    const padX = 34;
    const padY = 28;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    const n = monthlyChartData.length;

    const getVal = (d: (typeof monthlyChartData)[0]) =>
      chartMetric === 'revenue'
        ? d.revenue
        : chartMetric === 'teeth'
        ? d.teeth
        : d.orders;

    const maxVal = Math.max(...monthlyChartData.map(getVal), 1);

    const points = monthlyChartData.map((d, i) => {
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

    return { width, height, padY, points, smoothPath, areaPath };
  }, [monthlyChartData, chartMetric]);

  const materialStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; teeth: number; revenue: number }
    >();
    periodOrders.forEach((o) => {
      const m = o.material?.trim() || 'Full zirco razor';
      if (!map.has(m)) {
        map.set(m, { name: m, count: 0, teeth: 0, revenue: 0 });
      }
      const item = map.get(m)!;
      item.count += 1;
      item.teeth += o.teethCount ?? 0;
      item.revenue += o.totalAmount || 0;
    });

    return Array.from(map.values())
      .sort((a, b) => b.teeth - a.teeth || b.revenue - a.revenue)
      .slice(0, 6);
  }, [periodOrders]);

  const donutSegments = useMemo(() => {
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const totalRev = materialStats.reduce((s, m) => s + m.revenue, 0);
    const totalTeethStat = materialStats.reduce((s, m) => s + m.teeth, 0) || 1;
    let accumulatedPct = 0;

    return materialStats.map((m, idx) => {
      const pct = totalRev > 0 ? m.revenue / totalRev : m.teeth / totalTeethStat;
      const strokeDasharray = `${Math.max(0, pct * circumference - 2).toFixed(
        2
      )} ${circumference.toFixed(2)}`;
      const strokeDashoffset = -(accumulatedPct * circumference);
      accumulatedPct += pct;
      return {
        ...m,
        pct: Math.round(pct * 100),
        color: CHART_COLORS[idx % CHART_COLORS.length],
        strokeDasharray,
        strokeDashoffset,
        radius,
      };
    });
  }, [materialStats]);

  const activeDonutItem =
    hoveredMaterialIdx !== null && donutSegments[hoveredMaterialIdx]
      ? donutSegments[hoveredMaterialIdx]
      : null;

  const dailyChartData = useMemo(() => {
    const days = Array.from({ length: 31 }, (_, i) => ({
      day: String(i + 1).padStart(2, '0'),
      orders: 0,
      teeth: 0,
      revenue: 0,
    }));

    periodOrders.forEach((o) => {
      const parts = (o.orderDate || '').split(/[\/-]/);
      const dNum = parseInt(parts[0], 10);
      if (!isNaN(dNum) && dNum >= 1 && dNum <= 31) {
        days[dNum - 1].orders += 1;
        days[dNum - 1].teeth += o.teethCount ?? 0;
        days[dNum - 1].revenue += o.totalAmount || 0;
      }
    });
    return days;
  }, [periodOrders]);

  const maxDailyMetric = Math.max(
    ...dailyChartData.map((d) => (periodRevenue > 0 ? d.revenue : d.teeth)),
    1
  );
  const peakDay = useMemo(() => {
    return dailyChartData.reduce(
      (best, cur) =>
        (periodRevenue > 0 ? cur.revenue > best.revenue : cur.teeth > best.teeth)
          ? cur
          : best,
      dailyChartData[0]
    );
  }, [dailyChartData, periodRevenue]);

  const filteredRecentOrders = useMemo(() => {
    return periodOrders
      .filter((o) => {
        if (recentFilter === 'large') return (o.teethCount || 1) >= 5;
        if (recentFilter === 'vip') return (o.warrantyYears || 5) >= 10;
        return true;
      })
      .slice(0, 10);
  }, [periodOrders, recentFilter]);

  return (
    <div className="space-y-4">
      {/* 1. Spatial Command Bar: Compact Month Select + PDF Invoice Export */}
      <div className="bento-card px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-8 pr-4 py-1.5 bg-white/90 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono font-bold rounded-xl border border-slate-200/90 dark:border-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Tất cả các tháng (Toàn kỳ)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Kỳ Tháng {m}
                  {m === latestMonth
                    ? ' (Tháng này)'
                    : m === prevMonthOfLatest
                    ? ' (Tháng trước)'
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedClinicLens && (
            <button
              onClick={() => setSelectedClinicLens('')}
              className="px-2.5 py-1 text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-500/20 cursor-pointer"
            >
              {selectedClinicLens} ×
            </button>
          )}
        </div>

        <button
          onClick={() =>
            onExportInvoicePdf(
              periodOrders,
              selectedClinicLens,
              selectedMonth === 'ALL' ? '' : selectedMonth
            )
          }
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] transition-all cursor-pointer"
        >
          <FileDown className="w-3.5 h-3.5" />
          Xuất HĐ PDF
        </button>
      </div>

      {/* 2. Four Futuristic Spatial Bento KPI Cards with Deep Dark-Jewel Gradient Backgrounds */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Revenue */}
        <div className="p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-500/15 blur-2xl pointer-events-none group-hover:bg-blue-400/25 transition-all" />
          <div className="flex items-start justify-between relative">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
                Doanh Thu {selectedMonth === 'ALL' ? 'Lũy Kế' : `T.${selectedMonth}`}
              </span>
              <div className="font-display text-2xl sm:text-[26px] font-bold text-white font-mono mt-1 tracking-tight">
                {formatVND(periodRevenue)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 text-sky-300 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs relative">
            <div className="flex items-center gap-1.5">
              {selectedMonth !== 'ALL' && prevRevenue > 0 && (
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
                  selectedMonth === 'ALL' ? '' : selectedMonth,
                  selectedClinicLens
                )
              }
              className="text-[11px] font-bold text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline cursor-pointer"
            >
              Chi tiết →
            </button>
          </div>
        </div>

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
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] relative">
            <div className="flex items-center gap-1.5">
              {selectedMonth !== 'ALL' && prevTeeth > 0 && (
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
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] relative">
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
              <div className="font-display text-2xl sm:text-[26px] font-bold text-white font-mono mt-1">
                {formatVND(periodFinancials.netCash)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-300 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] relative">
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

      {/* 3. Row 1: 12-Month Futuristic Spline Chart (8 cols) + Material Share Ring (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bento-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-sky-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Quỹ Đạo Tăng Trưởng 12 Tháng
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-950/80 rounded-xl border border-slate-200/60 dark:border-slate-800 text-[11px]">
              <button
                onClick={() => setChartMetric('revenue')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  chartMetric === 'revenue'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Doanh thu
              </button>
              <button
                onClick={() => setChartMetric('teeth')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  chartMetric === 'teeth'
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Số răng
              </button>
              <button
                onClick={() => setChartMetric('orders')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  chartMetric === 'orders'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Số ca
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2.5 px-1 text-xs min-h-[28px]">
            {hoveredPointIdx !== null && svgChartCoords.points[hoveredPointIdx] ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono font-bold">
                  Tháng {svgChartCoords.points[hoveredPointIdx].month}
                </span>
                <span className="font-mono font-extrabold text-blue-600 dark:text-sky-400">
                  {formatVND(svgChartCoords.points[hoveredPointIdx].revenue)}
                </span>
                <span className="text-slate-500 font-mono">
                  {svgChartCoords.points[hoveredPointIdx].teeth} răng ·{' '}
                  {svgChartCoords.points[hoveredPointIdx].orders} ca
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">
                Nhấn vào điểm bất kỳ trên đồ thị để chuyển kỳ báo cáo
              </span>
            )}
          </div>

          <div className="pt-2 cyber-grid rounded-xl p-2 mt-1">
            <svg
              viewBox={`0 0 ${svgChartCoords.width} ${svgChartCoords.height}`}
              className="w-full h-52 overflow-visible"
            >
              <defs>
                <linearGradient id="futuristicArea" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={
                      chartMetric === 'revenue'
                        ? '#2563EB'
                        : chartMetric === 'teeth'
                        ? '#06B6D4'
                        : '#F59E0B'
                    }
                    stopOpacity="0.28"
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      chartMetric === 'revenue'
                        ? '#2563EB'
                        : chartMetric === 'teeth'
                        ? '#06B6D4'
                        : '#F59E0B'
                    }
                    stopOpacity="0.0"
                  />
                </linearGradient>
                <filter id="lineGlow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow
                    dx="0"
                    dy="4"
                    stdDeviation="4"
                    floodColor={
                      chartMetric === 'revenue'
                        ? '#2563EB'
                        : chartMetric === 'teeth'
                        ? '#06B6D4'
                        : '#F59E0B'
                    }
                    floodOpacity="0.35"
                  />
                </filter>
              </defs>

              {[0.2, 0.5, 0.8].map((ratio, idx) => (
                <line
                  key={idx}
                  x1={24}
                  x2={svgChartCoords.width - 24}
                  y1={
                    svgChartCoords.padY +
                    ratio * (svgChartCoords.height - svgChartCoords.padY * 2)
                  }
                  y2={
                    svgChartCoords.padY +
                    ratio * (svgChartCoords.height - svgChartCoords.padY * 2)
                  }
                  stroke="currentColor"
                  className="text-slate-200/70 dark:text-slate-800"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              ))}

              {svgChartCoords.areaPath && (
                <path d={svgChartCoords.areaPath} fill="url(#futuristicArea)" />
              )}

              {svgChartCoords.smoothPath && (
                <path
                  d={svgChartCoords.smoothPath}
                  fill="none"
                  filter="url(#lineGlow)"
                  stroke={
                    chartMetric === 'revenue'
                      ? '#2563EB'
                      : chartMetric === 'teeth'
                      ? '#06B6D4'
                      : '#F59E0B'
                  }
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}

              {svgChartCoords.points.map((pt, idx) => {
                const isCurrent = selectedMonth === pt.month;
                const isHovered = hoveredPointIdx === idx;
                const labelText =
                  chartMetric === 'revenue'
                    ? formatCompactVND(pt.revenue)
                    : chartMetric === 'teeth'
                    ? `${pt.teeth}R`
                    : `${pt.orders}ca`;

                return (
                  <g
                    key={pt.month}
                    onClick={() => setSelectedMonth(pt.month)}
                    onMouseEnter={() => setHoveredPointIdx(idx)}
                    onMouseLeave={() => setHoveredPointIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={pt.x - 26}
                      y={0}
                      width={52}
                      height={svgChartCoords.height}
                      fill="transparent"
                    />
                    {(isCurrent || isHovered) && (
                      <line
                        x1={pt.x}
                        x2={pt.x}
                        y1={pt.y}
                        y2={svgChartCoords.height - svgChartCoords.padY}
                        stroke={isCurrent ? '#F59E0B' : '#3B82F6'}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    )}
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-mono transition-all ${
                        isCurrent || isHovered
                          ? 'fill-slate-900 dark:fill-white font-extrabold'
                          : 'fill-slate-400'
                      }`}
                    >
                      {labelText}
                    </text>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isCurrent ? 6.5 : isHovered ? 5.5 : 3.5}
                      className={
                        isCurrent
                          ? 'fill-amber-500 stroke-white dark:stroke-slate-900 stroke-2'
                          : isHovered
                          ? 'fill-blue-600 stroke-white dark:stroke-slate-900 stroke-2'
                          : 'fill-white dark:fill-slate-900 stroke-blue-600 stroke-2'
                      }
                    />
                    <text
                      x={pt.x}
                      y={svgChartCoords.height - 5}
                      textAnchor="middle"
                      className={`text-[10px] font-mono ${
                        isCurrent
                          ? 'fill-blue-600 dark:fill-sky-400 font-extrabold'
                          : 'fill-slate-400 dark:fill-slate-500'
                      }`}
                    >
                      {pt.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* 4-Column Ceramic Material Share */}
        <div className="lg:col-span-4 bento-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <PieChart className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Tỷ Trọng Vật Liệu Sứ
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
              {periodTeeth} răng
            </span>
          </div>

          <div className="flex items-center justify-center py-2 relative">
            <svg viewBox="0 0 156 156" className="w-36 h-36 -rotate-90">
              <circle
                cx="78"
                cy="78"
                r="60"
                fill="none"
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="16"
              />
              {donutSegments.map((seg, idx) => (
                <circle
                  key={seg.name}
                  cx="78"
                  cy="78"
                  r={seg.radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={hoveredMaterialIdx === idx ? 20 : 16}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  onMouseEnter={() => setHoveredMaterialIdx(idx)}
                  onMouseLeave={() => setHoveredMaterialIdx(null)}
                  className="transition-all duration-200 cursor-pointer"
                />
              ))}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
              <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[92px]">
                {activeDonutItem ? activeDonutItem.name : 'Tổng doanh thu'}
              </span>
              <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                {activeDonutItem
                  ? `${activeDonutItem.pct}%`
                  : formatCompactVND(periodRevenue)}
              </span>
              {activeDonutItem && (
                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                  {activeDonutItem.teeth} răng
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            {donutSegments.map((seg, idx) => (
              <div
                key={seg.name}
                onMouseEnter={() => setHoveredMaterialIdx(idx)}
                onMouseLeave={() => setHoveredMaterialIdx(null)}
                className={`p-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                  hoveredMaterialIdx === idx
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]">
                      {seg.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                    <span className="text-slate-400">{seg.teeth}R</span>
                    <span className="font-bold text-slate-900 dark:text-white w-8 text-right">
                      {seg.pct}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Row 2: Daily Production Pulse (5 cols) + Partner Clinic Leaderboard (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bento-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
            <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Nhịp Độ Theo Ngày (01 → 31)
            </h3>
            {peakDay && peakDay.teeth > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-bold">
                Đỉnh: Ngày {peakDay.day} ({peakDay.teeth}R)
              </span>
            )}
          </div>

          <div className="pt-2 text-xs min-h-[24px] flex items-center justify-between">
            {hoveredDayIdx !== null && dailyChartData[hoveredDayIdx] ? (
              <div className="flex items-center gap-2 font-mono">
                <span className="font-bold text-slate-900 dark:text-white">
                  Ngày {dailyChartData[hoveredDayIdx].day}:
                </span>
                <span className="font-bold text-blue-600 dark:text-sky-400">
                  {formatVND(dailyChartData[hoveredDayIdx].revenue)}
                </span>
                <span className="text-slate-400">
                  ({dailyChartData[hoveredDayIdx].orders} ca ·{' '}
                  {dailyChartData[hoveredDayIdx].teeth} răng)
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">
                Rê chuột vào từng cột ngày để xem sản lượng
              </span>
            )}
          </div>

          <div className="pt-3 pb-1 cyber-grid rounded-xl p-2.5 mt-1">
            <div className="flex items-end gap-1 h-40">
              {dailyChartData.map((d, idx) => {
                const metricVal = periodRevenue > 0 ? d.revenue : d.teeth;
                const hPct =
                  metricVal > 0
                    ? Math.max(Math.round((metricVal / maxDailyMetric) * 100), 10)
                    : 4;
                const isPeak = peakDay && d.day === peakDay.day && metricVal > 0;
                return (
                  <div
                    key={d.day}
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onMouseLeave={() => setHoveredDayIdx(null)}
                    className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                  >
                    <div
                      className={`w-full rounded-t-xs transition-all ${
                        isPeak
                          ? 'bg-gradient-to-t from-amber-500 to-yellow-400'
                          : metricVal > 0
                          ? 'bg-gradient-to-t from-blue-600 to-cyan-400 group-hover:from-indigo-500 group-hover:to-sky-300'
                          : 'bg-slate-200/70 dark:bg-slate-800/80'
                      }`}
                      style={{ height: `${hPct}%` }}
                    />
                    {parseInt(d.day, 10) % 5 === 1 && (
                      <span className="text-[9px] font-mono text-slate-400 mt-1">
                        {d.day}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Partner Dental Clinic Leaderboard */}
        <div className="lg:col-span-7 bento-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Top Đối Tác Nha Khoa ({selectedMonth === 'ALL' ? 'Toàn Kỳ' : selectedMonth})
              </h3>
            </div>
            <button
              onClick={() =>
                onNavigateToRevenue(selectedMonth === 'ALL' ? '' : selectedMonth)
              }
              className="text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2 max-h-56 overflow-y-auto pr-1">
            {clinicRevenueMap.slice(0, 7).map((item, idx) => {
              const metricVal = item.revenue > 0 ? item.revenue : item.teethCount;
              const sharePct = Math.max(
                4,
                Math.round((metricVal / maxClinicRevenue) * 100)
              );
              const isSelected = selectedClinicLens === item.clinicName;
              return (
                <div
                  key={item.clinicName}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/40'
                      : 'bg-white/60 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-800/80 hover:border-blue-400/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-md font-mono font-bold text-[10px] flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-2xs'
                            : idx === 1
                            ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950'
                            : idx === 2
                            ? 'bg-gradient-to-br from-amber-700 to-amber-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <button
                        onClick={() =>
                          setSelectedClinicLens(
                            isSelected ? '' : item.clinicName
                          )
                        }
                        className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-sky-400 truncate text-left cursor-pointer"
                      >
                        {item.clinicName}
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[11px] font-mono text-slate-500">
                        {item.orderCount} ca ·{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {item.teethCount}R
                        </strong>
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white min-w-[92px] text-right">
                        {formatVND(item.revenue)}
                      </span>
                      <button
                        onClick={() =>
                          onExportInvoicePdf(
                            item.orders,
                            item.clinicName,
                            selectedMonth === 'ALL' ? '' : selectedMonth
                          )
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-900 dark:bg-slate-800 hover:bg-blue-600 text-white rounded-lg font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        <FileDown className="w-3 h-3 text-sky-400" />
                        PDF
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full ${
                        idx === 0
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-400'
                          : idx === 1
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-slate-400 dark:bg-slate-600'
                      }`}
                      style={{ width: `${sharePct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Row 3: Live Production & Warranty Stream */}
      <div className="bento-card rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Ca Phục Hình Trong Kỳ ({periodOrders.length})
            </h3>

            <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-950/80 rounded-xl text-[11px] border border-slate-200/60 dark:border-slate-800">
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
            className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
          >
            Mở toàn bộ danh sách <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
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
