import { MonthFilter } from './MonthFilter';
import React, { useState, useMemo } from 'react';
import { DentalOrder, DebtPaymentRecord, ClinicDebtRecord } from '../types/dental';
import {
  formatVND,
  sortMonthYearsDesc,
  extractMonthYear,
  getPreviousMonthYear,
} from '../utils/financeUtils';
import {
  CreditCard,
  Calendar,
  Plus,
  FileDown,
  Search,
  Trash2,
  X,
  Wallet,
  Building2,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Check,
} from 'lucide-react';

interface DebtManagementViewProps {
  orders: DentalOrder[];
  readOnly?: boolean;
  clinicDebts: ClinicDebtRecord[];
  payments: DebtPaymentRecord[];
  onUpdateClinicDebts: (nextDebts: ClinicDebtRecord[]) => void;
  onAddPayment: (payment: Omit<DebtPaymentRecord, 'id' | 'createdAt'>) => void;
  onDeletePayment: (id: string) => void;
  onExportStatementPdf: (
    orders: DentalOrder[],
    clinicName: string,
    monthYear: string,
    paidAmount: number,
    previousMonthDebt?: number
  ) => void;
}

const monthValue = (month: string) => {
  const [m, y] = month.split('/').map(Number);
  return y * 12 + m;
};

export const DebtManagementView: React.FC<DebtManagementViewProps> = ({
  orders,
  readOnly = false,
  clinicDebts,
  payments,
  onUpdateClinicDebts,
  onAddPayment,
  onDeletePayment,
  onExportStatementPdf,
}) => {
  const availableMonths = useMemo(() => {
    const set = new Set<string>(['10/2026', '11/2026']);
    clinicDebts.forEach((d) => {
      if (d.monthYear) set.add(d.monthYear);
    });
    orders.forEach((o) => {
      if (o.monthYear) set.add(o.monthYear);
    });
    return sortMonthYearsDesc(Array.from(set));
  }, [clinicDebts, orders]);

  const [selectedMonth, setSelectedMonth] = useState<string>('11/2026');
  const [searchClinic, setSearchClinic] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'owing' | 'settled'>('all');

  // Inline row editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editOldDebt, setEditOldDebt] = useState<number>(0);
  const [editCurrentDebt, setEditCurrentDebt] = useState<number>(0);
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);

  const [editNotes, setEditNotes] = useState<string>('');

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payClinic, setPayClinic] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState('28/10/2026');
  const [payMonthYear, setPayMonthYear] = useState('10/2026');
  const [payMethod, setPayMethod] = useState<'transfer' | 'cash'>('transfer');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const monthDebtRows = useMemo(() => {
    const baseline = '10/2026';
    const targetMonth = selectedMonth === 'ALL' ? (availableMonths[0] || '11/2026') : selectedMonth;
    const clinicKey = (name: string) =>
      name
        .trim()
        .normalize('NFC')
        .toLowerCase()
        .replace(/^nha\s+khoa\s+/i, '')
        .replace(/thuỷ/g, 'thủy')
        .replace(/hoà/g, 'hòa')
        .replace(/quý/g, 'quí')
        .replace(/\s*-\s*/g, '-')
        .replace(/\s+/g, ' ');

    const safeIdSlug = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 60) || 'clinic';

    const target = monthValue(targetMonth);
    const first = monthValue(baseline);
    const prevMonth = getPreviousMonthYear(targetMonth);
    const prevVal = monthValue(prevMonth);

    // Baseline records (10/2026) hold initial Nợ Cũ
    const baselineMap = new Map<string, ClinicDebtRecord>();
    for (const row of clinicDebts.filter((r) => r.monthYear === baseline)) {
      const baseK = clinicKey(row.clinicName);
      const finalKey = baselineMap.has(baseK) ? `${baseK}__${row.id}` : baseK;
      baselineMap.set(finalKey, row);
    }

    // Target month explicit records (if user edited a row in targetMonth)
    const targetRecordedMap = new Map<string, ClinicDebtRecord>();
    for (const row of clinicDebts.filter((r) => r.monthYear === targetMonth)) {
      const baseK = clinicKey(row.clinicName);
      // Match against baseline key if possible
      const matchedKey =
        Array.from(baselineMap.entries()).find(([, bRow]) => row.id.startsWith(bRow.id))?.[0] ||
        baseK;
      targetRecordedMap.set(matchedKey, row);
    }

    // Công Nợ Tháng Trước:
    // - Khi chọn 10/2026 -> lấy doanh thu tháng trước là 09/2026 (T09)
    // - Khi chọn 11/2026 -> lấy doanh thu tháng trước là 10/2026 (T10)
    // - Khi chọn các tháng tiếp theo (12/2026...) -> cộng dồn từ 10/2026 đến tháng trước (prevMonth)
    const isCumulativeFromOct = prevVal >= first;
    const ordersByClinic = new Map<string, DentalOrder[]>();
    const clinicDisplayNames = new Map<string, string>();

    for (const order of orders) {
      if (!order.clinicName?.trim() || !order.monthYear) continue;
      const mVal = monthValue(order.monthYear);
      const inRange = isCumulativeFromOct
        ? mVal >= first && mVal <= prevVal
        : order.monthYear === prevMonth;
      if (!inRange) continue;

      const key = clinicKey(order.clinicName);
      const group = ordersByClinic.get(key) ?? [];
      group.push(order);
      ordersByClinic.set(key, group);
      if (!clinicDisplayNames.has(key)) {
        clinicDisplayNames.set(key, order.clinicName.trim());
      }
    }

    const paidByClinic = new Map<string, number>();
    for (const payment of payments) {
      if (!payment.clinicName?.trim() || !payment.monthYear) continue;
      const mVal = monthValue(payment.monthYear);
      const inRange =
        target > first ? mVal >= first && mVal <= target : payment.monthYear === targetMonth;
      if (!inRange) continue;

      const key = clinicKey(payment.clinicName);
      paidByClinic.set(key, (paidByClinic.get(key) ?? 0) + payment.amount);
      if (!clinicDisplayNames.has(key)) {
        clinicDisplayNames.set(key, payment.clinicName.trim());
      }
    }

    const allKeys = new Set<string>([
      ...baselineMap.keys(),
      ...targetRecordedMap.keys(),
      ...ordersByClinic.keys(),
      ...paidByClinic.keys(),
    ]);

    const rows = Array.from(allKeys).map((key) => {
      const baseRow = baselineMap.get(key);
      const targetRow = targetRecordedMap.get(key);
      const clinicOrders = ordersByClinic.get(key) ?? [];

      // Group clinic orders by monthYear in chronological order (e.g. 10/2026 -> 11/2026)
      const byMonth = new Map<
        string,
        { monthYear: string; shortLabel: string; revenue: number; orderCount: number; teethCount: number }
      >();
      for (const o of clinicOrders) {
        const my = o.monthYear || targetMonth;
        if (!byMonth.has(my)) {
          const mm = my.split('/')[0] || my;
          byMonth.set(my, {
            monthYear: my,
            shortLabel: `T${parseInt(mm, 10) || mm}`,
            revenue: 0,
            orderCount: 0,
            teethCount: 0,
          });
        }
        const entry = byMonth.get(my)!;
        entry.revenue += o.totalAmount || 0;
        entry.orderCount += 1;
        entry.teethCount += o.teethCount ?? 0;
      }

      const monthlyBreakdown = Array.from(byMonth.values()).sort(
        (a, b) => monthValue(a.monthYear) - monthValue(b.monthYear)
      );

      const autoOrderDebt = monthlyBreakdown.reduce((sum, m) => sum + m.revenue, 0);
      const manualCurrentDebt =
        targetRow !== undefined
          ? targetRow.currentMonthDebt || 0
          : target === first
          ? baseRow?.currentMonthDebt || 0
          : 0;

      const oldDebt = targetRow?.oldDebt ?? baseRow?.oldDebt ?? 0;
      const currentMonthDebt = manualCurrentDebt + autoOrderDebt;
      const totalDebt = oldDebt + currentMonthDebt;

      const paidFromRecords =
        targetRow !== undefined
          ? targetRow.paidAmount || 0
          : target === first
          ? baseRow?.paidAmount || 0
          : 0;
      const paidFromPayments = paidByClinic.get(key) ?? 0;
      const paidAmount = paidFromRecords + paidFromPayments;

      const monthSuffix = targetMonth.replace('/', '_');
      const rowId =
        targetRow?.id ??
        (target === first && baseRow?.id
          ? baseRow.id
          : baseRow?.id
          ? `${baseRow.id}_${monthSuffix}`
          : `debt_${monthSuffix}_${safeIdSlug(key)}`);

      const rawNote = (targetRow?.notes ?? (target === first ? baseRow?.notes : '') ?? '').trim();
      const cleanNote = /^công\s*nợ\s*nha\s*khoa/i.test(rawNote) ? '' : rawNote;

      const currentMonthOrders = orders.filter(
        (o) => o.clinicName && clinicKey(o.clinicName) === key && o.monthYear === targetMonth
      );

      return {
        id: rowId,
        clinicName:
          targetRow?.clinicName ??
          baseRow?.clinicName ??
          clinicDisplayNames.get(key) ??
          clinicOrders[0]?.clinicName ??
          key,
        monthYear: targetMonth,
        oldDebt,
        currentMonthDebt,
        autoOrderDebt,
        paidFromPayments,
        monthlyBreakdown,
        totalDebt,
        paidAmount,
        remainingDebt: Math.max(0, totalDebt - paidAmount),
        orderIndex: targetRow?.orderIndex ?? baseRow?.orderIndex ?? 999,
        notes: cleanNote,
        updatedAt: targetRow?.updatedAt ?? baseRow?.updatedAt ?? 0,
        orders: currentMonthOrders,
      };
    });

    return rows.sort(
      (a, b) => a.orderIndex - b.orderIndex || a.clinicName.localeCompare(b.clinicName, 'vi')
    );
  }, [clinicDebts, payments, orders, selectedMonth, availableMonths]);

  const filteredDebtRows = useMemo(() => {
    return monthDebtRows.filter((item) => {
      if (searchClinic.trim()) {
        const q = searchClinic.toLowerCase().trim();
        if (!item.clinicName.toLowerCase().includes(q)) return false;
      }
      if (statusFilter === 'owing' && item.remainingDebt <= 0) return false;
      if (statusFilter === 'settled' && item.remainingDebt > 0) return false;
      return true;
    });
  }, [monthDebtRows, searchClinic, statusFilter]);

  const summaryTotals = useMemo(() => {
    const oldDebt = filteredDebtRows.reduce((s, c) => s + c.oldDebt, 0);
    const currentMonthDebt = filteredDebtRows.reduce((s, c) => s + c.currentMonthDebt, 0);
    const totalDebt = filteredDebtRows.reduce((s, c) => s + c.totalDebt, 0);
    const paid = filteredDebtRows.reduce((s, c) => s + c.paidAmount, 0);
    const remaining = filteredDebtRows.reduce((s, c) => s + c.remainingDebt, 0);
    const owingCount = filteredDebtRows.filter((c) => c.remainingDebt > 0).length;
    return { oldDebt, currentMonthDebt, totalDebt, paid, remaining, owingCount };
  }, [filteredDebtRows]);

  const allClinics = useMemo(() => {
    const set = new Set<string>();
    monthDebtRows.forEach((r) => set.add(r.clinicName));
    return Array.from(set);
  }, [monthDebtRows]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (selectedMonth !== 'ALL' && p.monthYear !== selectedMonth) return false;
      if (
        searchClinic.trim() &&
        !p.clinicName.toLowerCase().includes(searchClinic.toLowerCase().trim())
      ) {
        return false;
      }
      return true;
    });
  }, [payments, selectedMonth, searchClinic]);

  const startEditingRow = (row: (typeof monthDebtRows)[number]) => {
    setEditingRowId(row.id);
    setEditOldDebt(row.oldDebt);
    setEditCurrentDebt(row.currentMonthDebt);
    setEditPaidAmount(row.paidAmount);
    setEditNotes(row.notes || '');
  };

  const handleSaveRowEdit = (row: (typeof monthDebtRows)[number]) => {
    const targetMonth = selectedMonth === 'ALL' ? (availableMonths[0] || '11/2026') : selectedMonth;
    const oldDebt = Math.max(0, Number(editOldDebt) || 0);
    const enteredCurrentDebt = Math.max(0, Number(editCurrentDebt) || 0);
    const enteredPaidAmount = Math.max(0, Number(editPaidAmount) || 0);

    // Store only the manual portion above auto-calculated order revenue & payment records
    const manualCurrentDebt = Math.max(0, enteredCurrentDebt - (row.autoOrderDebt || 0));
    const manualPaidAmount = Math.max(0, enteredPaidAmount - (row.paidFromPayments || 0));
    const totalDebt = oldDebt + manualCurrentDebt + (row.autoOrderDebt || 0);
    const remainingDebt = Math.max(0, totalDebt - (manualPaidAmount + (row.paidFromPayments || 0)));

    const updatedRecord: ClinicDebtRecord = {
      id: row.id,
      clinicName: row.clinicName,
      monthYear: targetMonth,
      oldDebt,
      currentMonthDebt: manualCurrentDebt,
      totalDebt,
      paidAmount: manualPaidAmount,
      remainingDebt,
      orderIndex: row.orderIndex,
      notes: editNotes.trim(),
      updatedAt: Date.now(),
    };

    const exists = clinicDebts.some((d) => d.id === row.id);
    const nextList = exists
      ? clinicDebts.map((d) => (d.id === row.id ? updatedRecord : d))
      : [...clinicDebts, updatedRecord];

    onUpdateClinicDebts(nextList);
    setEditingRowId(null);
  };

  const openPaymentModalForClinic = (
    clinicName: string,
    suggestedAmount: number
  ) => {
    const targetMonth = selectedMonth === 'ALL' ? '10/2026' : selectedMonth;
    setPayClinic(clinicName);
    setPayAmount(suggestedAmount);
    setPayDate(`28/${targetMonth}`);
    setPayMonthYear(targetMonth);
    setPayMethod('transfer');
    setPayRef(`UNC${Math.floor(100000 + Math.random() * 900000)}`);
    setPayNotes(`Thanh toán công nợ kỳ ${targetMonth}`);
    setPaymentModalOpen(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payClinic.trim() || payAmount <= 0) return;
    onAddPayment({
      clinicName: payClinic.trim(),
      amount: Number(payAmount),
      paymentDate: payDate.trim() || `28/${payMonthYear}`,
      monthYear: payMonthYear || extractMonthYear(payDate),
      method: payMethod,
      referenceCode: payRef.trim(),
      notes: payNotes.trim(),
    });
    setPaymentModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Single-Row Spatial Control Bar */}
      <div className="bento-card month-toolbar sm:p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="hidden sm:block relative">
            <Calendar className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <MonthFilter
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setEditingRowId(null);
              }}
              className="pl-8 pr-3 py-1.5 text-xs font-bold bg-white/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Kỳ Tháng {m}
                  {m === '11/2026'
                    ? ' (Tháng này)'
                    : m === '10/2026'
                    ? ' (Tháng 10)'
                    : ''}
                </option>
              ))}
            </MonthFilter>
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchClinic}
              onChange={(e) => setSearchClinic(e.target.value)}
              placeholder="Tìm tên nha khoa..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-950/80 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tất cả ({monthDebtRows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('owing')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                statusFilter === 'owing'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Còn nợ
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('settled')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                statusFilter === 'settled'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Đã tất toán
            </button>
          </div>
        </div>

        {!readOnly && (
          <button
            onClick={() =>
              openPaymentModalForClinic(allClinics[0] || 'Tâm An', 5000000)
            }
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Thu nợ
          </button>
        )}
      </div>

      {/* 4 Deep Dark-Jewel KPI Cards */}
      <div className="dashboard-kpis grid min-w-0 grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Tổng Nợ Cũ
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {formatVND(summaryTotals.oldDebt)}
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 text-sky-300 flex items-center justify-center shrink-0 relative">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border border-teal-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Đã Thanh Toán (ĐÃ TT)
            </span>
            <div className="font-display text-2xl font-bold font-mono text-teal-300 mt-1">
              {formatVND(summaryTotals.paid)}
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0 relative">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 text-white border border-amber-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Tổng Còn Lại
            </span>
            <div className="font-display text-2xl font-bold font-mono text-amber-300 mt-1">
              {formatVND(summaryTotals.remaining)}
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300 flex items-center justify-center shrink-0 relative">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white border border-violet-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-violet-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Nha Khoa Còn Nợ
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {summaryTotals.owingCount} / {filteredDebtRows.length}{' '}
              <span className="text-xs font-bold text-violet-300 uppercase">NK</span>
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-300 flex items-center justify-center shrink-0 relative">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Debt Table + Payment History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bento-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Bảng Công Nợ Theo Nha Khoa ({filteredDebtRows.length})
            </h3>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              Dư nợ: {formatVND(summaryTotals.remaining)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Nha Khoa</th>
                  <th className="py-2.5 px-3 text-right">Nợ Cũ</th>
                  <th className="py-2.5 px-3 text-right">
                    Công Nợ Tháng Trước{' '}
                    <span className="text-blue-600 dark:text-blue-400">
                      (T{getPreviousMonthYear(selectedMonth === 'ALL' ? (availableMonths[0] || '11/2026') : selectedMonth).split('/')[0]})
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">Tổng Công Nợ</th>
                  <th className="py-2.5 px-3 text-right">ĐÃ TT</th>
                  <th className="py-2.5 px-3 text-right">Còn Lại</th>
                  <th className="py-2.5 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredDebtRows.map((item) => {
                  const isEditing = editingRowId === item.id;
                  const manualExtra = Math.max(0, item.currentMonthDebt - (item.autoOrderDebt || 0));
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        <div>{item.clinicName}</div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Ghi chú công nợ..."
                            className="mt-1 w-full max-w-[180px] px-2 py-0.5 text-[11px] font-normal border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                          />
                        ) : item.notes ? (
                          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Note: {item.notes}
                          </div>
                        ) : null}
                      </td>

                      {/* Nợ Cũ */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {isEditing ? (
                          <input
                            type="number"
                            step={50000}
                            value={editOldDebt}
                            onChange={(e) => setEditOldDebt(Number(e.target.value))}
                            className="w-28 px-2 py-1 text-right font-mono text-xs border border-blue-500 rounded bg-white dark:bg-slate-900"
                          />
                        ) : (
                          formatVND(item.oldDebt)
                        )}
                      </td>

                      {/* Công Nợ Tháng Này (Tự cộng dồn doanh thu T10, T11...) */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {isEditing ? (
                          <div className="inline-flex flex-col items-end gap-1">
                            <input
                              type="number"
                              step={50000}
                              value={editCurrentDebt}
                              onChange={(e) => setEditCurrentDebt(Number(e.target.value))}
                              className="w-28 px-2 py-1 text-right font-mono text-xs border border-blue-500 rounded bg-white dark:bg-slate-900"
                            />
                            {item.autoOrderDebt > 0 && (
                              <span className="text-[10px] font-sans text-blue-600 dark:text-blue-400">
                                Tự cộng từ đơn: {formatVND(item.autoOrderDebt)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span
                              className={
                                item.currentMonthDebt > 0
                                  ? 'text-blue-700 dark:text-blue-400 font-bold'
                                  : ''
                              }
                            >
                              {formatVND(item.currentMonthDebt)}
                            </span>
                            {(item.monthlyBreakdown.some((mb) => mb.revenue > 0) ||
                              manualExtra > 0) && (
                              <div className="mt-1 flex flex-col items-end gap-0.5 font-sans">
                                {item.monthlyBreakdown
                                  .filter((mb) => mb.revenue > 0)
                                  .map((mb, idx) => (
                                    <span
                                      key={mb.monthYear}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70"
                                    >
                                      {idx > 0 ? '+ ' : ''}DT {mb.shortLabel}:{' '}
                                      <strong className="font-mono">{formatVND(mb.revenue)}</strong>{' '}
                                      <span className="text-[9px] opacity-75">({mb.orderCount} ca)</span>
                                    </span>
                                  ))}
                                {manualExtra > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                    + Nhập thêm: <strong className="font-mono">{formatVND(manualExtra)}</strong>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Tổng Công Nợ */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {isEditing
                          ? formatVND((editOldDebt || 0) + (editCurrentDebt || 0))
                          : formatVND(item.totalDebt)}
                      </td>

                      {/* ĐÃ TT */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {isEditing ? (
                          <input
                            type="number"
                            step={50000}
                            value={editPaidAmount}
                            onChange={(e) => setEditPaidAmount(Number(e.target.value))}
                            className="w-28 px-2 py-1 text-right font-mono text-xs border border-emerald-500 rounded bg-white dark:bg-slate-900"
                          />
                        ) : (
                          formatVND(item.paidAmount)
                        )}
                      </td>

                      {/* Còn Lại */}
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold">
                        {isEditing ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {formatVND(
                              Math.max(
                                0,
                                (editOldDebt || 0) + (editCurrentDebt || 0) - (editPaidAmount || 0)
                              )
                            )}
                          </span>
                        ) : item.remainingDebt > 0 ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {formatVND(item.remainingDebt)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                            0 ₫
                          </span>
                        )}
                      </td>

                      {/* Thao Tác */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                        {!readOnly && (
                          <>
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveRowEdit(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-md cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  Lưu
                                </button>
                                <button
                                  onClick={() => setEditingRowId(null)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold text-[11px] rounded-md cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => startEditingRow(item)}
                                title="Sửa công nợ"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-[11px] rounded-md cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                Sửa
                              </button>
                            )}
                            {item.remainingDebt > 0 && !isEditing && (
                              <button
                                onClick={() =>
                                  openPaymentModalForClinic(item.clinicName, item.remainingDebt)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-md transition-colors cursor-pointer"
                              >
                                <Wallet className="w-3 h-3" />
                                Thu
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() =>
                            onExportStatementPdf(
                              item.orders,
                              item.clinicName,
                              selectedMonth,
                              item.paidAmount,
                              item.totalDebt
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-[11px] rounded-md transition-colors cursor-pointer"
                        >
                          <FileDown className="w-3 h-3 text-teal-400" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/90 dark:bg-slate-950/60 font-mono font-bold text-xs border-t border-slate-200 dark:border-slate-800">
                <tr>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 uppercase">
                    Tổng cộng
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                    {formatVND(summaryTotals.oldDebt)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                    {formatVND(summaryTotals.currentMonthDebt)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                    {formatVND(summaryTotals.totalDebt)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                    {formatVND(summaryTotals.paid)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-700 dark:text-amber-400">
                    {formatVND(summaryTotals.remaining)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Payment History Table */}
        <div className="lg:col-span-4 bento-card rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Lịch Sử Thu Nợ ({filteredPayments.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[600px] flex-1">
            {filteredPayments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Chưa có phiếu thu thanh toán nào.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[11px] sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Ngày</th>
                    <th className="py-2 px-3">Nha Khoa</th>
                    <th className="py-2 px-3 text-right">Số Tiền</th>
                    <th className="py-2 px-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {filteredPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {p.paymentDate}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900 dark:text-white truncate max-w-[110px]">
                          {p.clinicName}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Kỳ {p.monthYear}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        +{formatVND(p.amount)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {!readOnly && (
                          <button
                            onClick={() => onDeletePayment(p.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Record Debt Payment */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-sm">Phiếu Thu Công Nợ</h3>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Nha Khoa *
                </label>
                <select
                  value={payClinic}
                  onChange={(e) => setPayClinic(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {allClinics.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Số Tiền (VNĐ) *
                  </label>
                  <input
                    type="number"
                    required
                    step={50000}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Kỳ Công Nợ *
                  </label>
                  <select
                    value={payMonthYear}
                    onChange={(e) => setPayMonthYear(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Ngày Thu
                  </label>
                  <input
                    type="text"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Hình Thức
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as 'transfer' | 'cash')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Ghi Chú
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-3.5 py-1.5 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg cursor-pointer"
                >
                  Lưu Phiếu Thu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
