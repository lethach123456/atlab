import { MonthFilter } from './MonthFilter';
import React, { useState, useMemo, useEffect } from 'react';
import { DentalOrder } from '../types/dental';
import {
  formatVND,
  sortMonthYearsDesc,
  getPreviousMonthYear,
} from '../utils/financeUtils';
import {
  DollarSign,
  Calendar,
  FileDown,
  Search,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Edit3,
  Check,
} from 'lucide-react';

interface RevenueViewProps {
  orders: DentalOrder[];
  readOnly?: boolean;
  initialMonth?: string;
  initialClinic?: string;
  onUpdateOrder: (updated: DentalOrder) => void;
  onExportInvoicePdf: (orders: DentalOrder[], clinicName: string, monthYear: string) => void;
  onViewWarranty: (order: DentalOrder) => void;
}

export const RevenueView: React.FC<RevenueViewProps> = ({
  orders,
  readOnly = false,
  initialMonth,
  initialClinic,
  onUpdateOrder,
  onExportInvoicePdf,
  onViewWarranty,
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

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || latestMonth);
  const [selectedClinic, setSelectedClinic] = useState<string>(initialClinic || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingTotalId, setEditingTotalId] = useState<string | null>(null);
  const [tempTotalAmount, setTempTotalAmount] = useState<string>('0');

  useEffect(() => {
    if (initialMonth !== undefined && initialMonth !== '') {
      setSelectedMonth(initialMonth);
    }
    if (initialClinic !== undefined) {
      setSelectedClinic(initialClinic);
    }
  }, [initialMonth, initialClinic]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return orders.filter((o) => {
      if (selectedMonth && selectedMonth !== 'ALL' && o.monthYear !== selectedMonth) {
        return false;
      }
      if (selectedClinic && o.clinicName !== selectedClinic) {
        return false;
      }
      if (q) {
        const matchCode = o.warrantyCode?.toLowerCase().includes(q);
        const matchPatient = o.patientName?.toLowerCase().includes(q);
        const matchClinic = o.clinicName?.toLowerCase().includes(q);
        const matchMat = o.material?.toLowerCase().includes(q);
        const matchTeeth = o.teeth?.toLowerCase().includes(q);
        if (!matchCode && !matchPatient && !matchClinic && !matchMat && !matchTeeth) {
          return false;
        }
      }
      return true;
    });
  }, [orders, selectedMonth, selectedClinic, searchQuery]);

  const prevMonthKey =
    selectedMonth && selectedMonth !== 'ALL' ? getPreviousMonthYear(selectedMonth) : '';

  const prevMonthOrders = useMemo(() => {
    if (!prevMonthKey) return [];
    return orders.filter((o) => {
      if (o.monthYear !== prevMonthKey) return false;
      if (selectedClinic && o.clinicName !== selectedClinic) return false;
      return true;
    });
  }, [orders, prevMonthKey, selectedClinic]);

  const currentRevenue = filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const currentTeeth = filteredOrders.reduce((s, o) => s + (o.teethCount ?? 0), 0);
  const prevRevenue = prevMonthOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const prevTeeth = prevMonthOrders.reduce((s, o) => s + (o.teethCount ?? 0), 0);

  const growthPct =
    prevRevenue > 0
      ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100)
      : 0;

  const clinicSummaryInMonth = useMemo(() => {
    const monthOrders =
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

    monthOrders.forEach((o) => {
      const name = o.clinicName?.trim() || 'Nha Khoa Đối Tác';
      if (!map.has(name)) {
        map.set(name, {
          clinicName: name,
          address: o.clinicAddress || 'Đà Nẵng',
          orderCount: 0,
          teethCount: 0,
          revenue: 0,
          orders: [],
        });
      }
      const item = map.get(name)!;
      item.orderCount += 1;
      item.teethCount += o.teethCount ?? 0;
      item.revenue += o.totalAmount || 0;
      item.orders.push(o);
    });

    return Array.from(map.values()).sort(
      (a, b) => b.revenue - a.revenue || b.teethCount - a.teethCount
    );
  }, [orders, selectedMonth]);

  const materialSummaryInMonth = useMemo(() => {
    const monthOrders =
      selectedMonth === 'ALL'
        ? orders
        : orders.filter((o) => o.monthYear === selectedMonth);

    const map = new Map<
      string,
      {
        materialName: string;
        orderCount: number;
        teethCount: number;
        revenue: number;
      }
    >();

    monthOrders.forEach((o) => {
      const mat = o.material?.trim() || 'Khác';
      if (!map.has(mat)) {
        map.set(mat, {
          materialName: mat,
          orderCount: 0,
          teethCount: 0,
          revenue: 0,
        });
      }
      const item = map.get(mat)!;
      item.orderCount += 1;
      item.teethCount += o.teethCount ?? 0;
      item.revenue += o.totalAmount || 0;
    });

    return Array.from(map.values()).sort(
      (a, b) => b.teethCount - a.teethCount || b.orderCount - a.orderCount
    );
  }, [orders, selectedMonth]);

  const handleSaveTotalAmount = (order: DentalOrder, rawValue?: string) => {
    const str = rawValue !== undefined ? rawValue : tempTotalAmount;
    const numeric = Math.max(0, Number(String(str).replace(/[^0-9]/g, '')) || 0);
    onUpdateOrder({
      ...order,
      totalAmount: numeric,
    });
    setEditingTotalId(null);
  };

  return (
    <div className="space-y-4">
      {/* Compact Spatial Toolbar: Month Option Select + Material Filter + Export PDF */}
      <div className="bento-card month-toolbar sm:px-4 sm:py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:block relative">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <MonthFilter
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-8 pr-4 py-1.5 text-xs font-mono font-bold bg-white/90 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
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
            </MonthFilter>
          </div>

        </div>

        <button
          onClick={() =>
            onExportInvoicePdf(
              filteredOrders,
              selectedClinic,
              selectedMonth === 'ALL' ? '' : selectedMonth
            )
          }
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] transition-all cursor-pointer"
        >
          <FileDown className="w-3.5 h-3.5" />
          Xuất HĐ PDF
        </button>
      </div>

      {/* Deep Dark-Jewel 3-Metric Strip */}
      <div className="dashboard-kpis grid min-w-0 grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Card 1: Current Revenue */}
        <div className="p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Doanh Thu {selectedMonth === 'ALL' ? 'Toàn Kỳ' : `T.${selectedMonth}`}
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {formatVND(currentRevenue)}
            </div>
            <span className="text-[11px] text-slate-300/80 font-mono mt-1 block">
              {filteredOrders.length} ca · {currentTeeth} răng
            </span>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 text-sky-300 flex items-center justify-center shrink-0 relative">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Previous Period Comparison */}
        <div className="p-5 rounded-2xl flex flex-wrap items-center justify-between gap-1 sm:flex-nowrap sm:gap-0 relative overflow-hidden group bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border border-teal-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Kỳ Trước ({prevMonthKey || '—'})
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {prevMonthKey ? formatVND(prevRevenue) : '—'}
            </div>
            <span className="text-[11px] text-slate-300/80 font-mono mt-1 block">
              {prevMonthKey ? `${prevMonthOrders.length} ca · ${prevTeeth} răng` : 'Tất cả các kỳ'}
            </span>
          </div>
          {prevMonthKey && (
            <span
              className={`font-mono text-xs font-bold flex max-sm:self-start items-center gap-1 px-2.5 py-1 rounded-lg border relative ${
                currentRevenue >= prevRevenue
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25'
                  : 'bg-amber-500/15 text-amber-300 border-amber-400/25'
              }`}
            >
              {currentRevenue >= prevRevenue ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`}
            </span>
          )}
        </div>

        {/* Card 3: Active Clinic & PDF Invoice */}
        <div className="max-sm:col-span-2 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white border border-violet-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-violet-500/15 blur-2xl pointer-events-none" />
          <div className="relative min-w-0 pr-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Nha Khoa & Dòng Sứ
            </span>
            <div className="font-display text-base sm:text-lg font-bold text-white mt-1 truncate max-w-[210px]">
              {selectedClinic || `${clinicSummaryInMonth.length} NK · ${materialSummaryInMonth.length} dòng sứ`}
            </div>
            <span className="text-[11px] text-violet-300/90 font-mono mt-1 block">
              Thành tiền tự nhập trực tiếp
            </span>
          </div>
          <button
            onClick={() =>
              onExportInvoicePdf(
                filteredOrders,
                selectedClinic,
                selectedMonth === 'ALL' ? '' : selectedMonth
              )
            }
            className="flex items-center gap-1.5 px-2 py-2 sm:px-3.5 bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white font-bold text-xs rounded-xl cursor-pointer shrink-0 transition-all relative"
          >
            <FileDown className="w-3.5 h-3.5 text-sky-300" />
            In Bảng Kê PDF
          </button>
        </div>
      </div>

      {/* Summary Grid: Clinic Summary + Ceramic Line (Dòng Sứ) Summary */}
      {!selectedClinic && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Clinic Summary */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                Tổng Hợp Theo Nha Khoa ({clinicSummaryInMonth.length} ĐV)
              </h3>
            </div>

            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Nha Khoa</th>
                    <th className="py-2.5 px-2 text-center">Số Ca</th>
                    <th className="py-2.5 px-2 text-center">SL Răng</th>
                    <th className="py-2.5 px-3 text-right">Thành Tiền</th>
                    <th className="py-2.5 px-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {clinicSummaryInMonth.map((c, idx) => (
                    <tr
                      key={c.clinicName}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                        <button
                          onClick={() => setSelectedClinic(c.clinicName)}
                          className="hover:text-teal-500 hover:underline text-left cursor-pointer"
                        >
                          {c.clinicName}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600 dark:text-slate-400">
                        {c.orderCount}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {c.teethCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-extrabold text-teal-700 dark:text-teal-400">
                        {formatVND(c.revenue)}
                      </td>
                      <td className="py-2 px-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedClinic(c.clinicName)}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                        >
                          Lọc
                        </button>
                        <button
                          onClick={() =>
                            onExportInvoicePdf(
                              c.orders,
                              c.clinicName,
                              selectedMonth === 'ALL' ? '' : selectedMonth
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-white dark:text-slate-950 bg-teal-600 dark:bg-teal-400 rounded cursor-pointer"
                        >
                          <FileDown className="w-3 h-3" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ceramic Lines (Dòng Sứ) Summary */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                Thống Kê Theo Dòng Sứ ({materialSummaryInMonth.length} dòng)
              </h3>
            </div>

            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Dòng Sứ</th>
                    <th className="py-2.5 px-2 text-center">Số Ca</th>
                    <th className="py-2.5 px-2 text-center">SL Răng</th>
                    <th className="py-2.5 px-3 text-right">Thành Tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {materialSummaryInMonth.map((m) => (
                    <tr
                      key={m.materialName}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                        {m.materialName}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600 dark:text-slate-400">
                        {m.orderCount}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-teal-700 dark:text-teal-400">
                        {m.teethCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                        {formatVND(m.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Table 2: Detailed Revenue Orders with Direct Manual Thành Tiền Input */}
      <div className="bento-card rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
              Bảng Doanh Thu Chi Tiết ({filteredOrders.length} ca · {currentTeeth} răng)
            </h3>
            {selectedClinic && (
              <button
                onClick={() => setSelectedClinic('')}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded cursor-pointer"
              >
                {selectedClinic} ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm khách hàng, nha khoa, dòng sứ..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>
            <span className="font-mono text-sm font-extrabold text-teal-700 dark:text-teal-400">
              Tổng: {formatVND(currentRevenue)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-2.5 text-center">#</th>
                <th className="py-2.5 px-3">Ngày</th>
                <th className="py-2.5 px-3">Nha Khoa</th>
                <th className="py-2.5 px-3">Khách Hàng</th>
                <th className="py-2.5 px-3">Vị Trí Răng</th>
                <th className="py-2.5 px-2 text-center">Số Lượng ({currentTeeth})</th>
                <th className="py-2.5 px-3">Dòng Sứ</th>
                <th className="py-2.5 px-4 text-right">
                  Thành Tiền (Tự nhập: {formatVND(currentRevenue)})
                </th>
                <th className="py-2.5 px-3">Ghi Chú</th>
                <th className="py-2.5 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredOrders.map((order, idx) => (
                <tr
                  key={order.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="py-2 px-2.5 text-center font-mono text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                    {order.orderDate}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                    <button
                      onClick={() => setSelectedClinic(order.clinicName)}
                      className="hover:text-teal-500 hover:underline text-left cursor-pointer"
                    >
                      {order.clinicName}
                    </button>
                  </td>
                  <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                    {order.patientName}
                  </td>
                  <td
                    className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 max-w-[160px] truncate"
                    title={order.teeth}
                  >
                    {order.teeth || '—'}
                  </td>
                  <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                    {order.teethCount ?? 0}
                  </td>
                  <td className="py-2 px-3 font-medium text-teal-700 dark:text-teal-300">
                    {order.material}
                  </td>
                  <td className="py-2 px-4 text-right font-mono whitespace-nowrap">
                    {readOnly ? (
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatVND(order.totalAmount || 0)}
                      </span>
                    ) : editingTotalId === order.id ? (
                      <div className="inline-flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step={10000}
                          min={0}
                          autoFocus
                          value={tempTotalAmount}
                          onChange={(e) => setTempTotalAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveTotalAmount(order);
                            } else if (e.key === 'Escape') {
                              setEditingTotalId(null);
                            }
                          }}
                          onBlur={() => handleSaveTotalAmount(order)}
                          className="w-32 px-2 py-1 text-xs font-mono font-bold border border-teal-500 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-right focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSaveTotalAmount(order);
                          }}
                          className="p-1 bg-teal-600 text-white rounded cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTotalId(order.id);
                          setTempTotalAmount(String(order.totalAmount || 0));
                        }}
                        title="Nhấn để tự nhập Thành Tiền"
                        className="inline-flex items-center justify-end gap-1.5 px-2 py-1 rounded border border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-500/5 transition-colors cursor-pointer group"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatVND(order.totalAmount || 0)}
                        </span>
                        <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-teal-500" />
                      </button>
                    )}
                  </td>
                  <td
                    className="py-2 px-3 text-slate-500 dark:text-slate-400 max-w-[160px] truncate"
                    title={order.notes}
                  >
                    {order.notes || '—'}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() =>
                          onExportInvoicePdf([order], order.clinicName, order.monthYear)
                        }
                        title="Hóa Đơn PDF"
                        className="p-1 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 rounded cursor-pointer"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onViewWarranty(order)}
                        title="Thẻ Bảo Hành"
                        className="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
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
