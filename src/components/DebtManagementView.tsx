import { MonthFilter } from './MonthFilter';
import React, { useState, useMemo } from 'react';
import { DentalOrder, DebtPaymentRecord, ClinicDebtRecord } from '../types/dental';
import {
  formatVND,
  sortMonthYearsDesc,
} from '../utils/financeUtils';
import { calculateDebtRows, DEBT_START_MONTH, debtMonthValue } from '../utils/debtLedger';
import { getCurrentMonthYear } from '../utils/dashboardMetrics';
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
  discountRates: ReadonlyMap<string, number>;
  onUpdateClinicDebts: (nextDebts: ClinicDebtRecord[]) => void;
  onAddPayment: (payment: Omit<DebtPaymentRecord, 'id' | 'createdAt'>) => void;
  onDeletePayment: (id: string) => void;
  onExportStatementPdf: (
    orders: DentalOrder[],
    clinicName: string,
    monthYear: string
  ) => void;
}

export const DebtManagementView: React.FC<DebtManagementViewProps> = ({
  orders,
  readOnly = false,
  clinicDebts,
  payments,
  discountRates,
  onUpdateClinicDebts,
  onAddPayment,
  onDeletePayment,
  onExportStatementPdf,
}) => {
  const availableMonths = useMemo(() => {
    const set = new Set<string>([DEBT_START_MONTH, getCurrentMonthYear()]);
    clinicDebts.forEach((d) => {
      if (d.monthYear) set.add(d.monthYear);
    });
    orders.forEach((o) => {
      if (o.monthYear) set.add(o.monthYear);
    });
    payments.forEach((payment) => {
      if (payment.monthYear) set.add(payment.monthYear);
    });
    return sortMonthYearsDesc(Array.from(set).filter((month) => {
      const value = debtMonthValue(month);
      return value !== null && value >= debtMonthValue(DEBT_START_MONTH)!;
    }));
  }, [clinicDebts, orders, payments]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthYear());
  const [searchClinic, setSearchClinic] = useState<string>('');

  // Inline row editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editCurrentDebt, setEditCurrentDebt] = useState<number>(0);
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);

  const [editNotes, setEditNotes] = useState<string>('');
  const [rowEditError, setRowEditError] = useState('');

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payClinic, setPayClinic] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState('');
  const [payMonthYear, setPayMonthYear] = useState(() => getCurrentMonthYear());
  const [payMethod, setPayMethod] = useState<'transfer' | 'cash'>('transfer');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const monthDebtRows = useMemo(
    () => calculateDebtRows(orders, clinicDebts, payments, selectedMonth, discountRates),
    [clinicDebts, payments, orders, selectedMonth, discountRates]
  );

  const filteredDebtRows = useMemo(() => {
    return monthDebtRows.filter((item) => {
      if (searchClinic.trim()) {
        const q = searchClinic.toLowerCase().trim();
        if (!item.clinicName.toLowerCase().includes(q)) return false;
      }
      if (item.remainingDebt <= 0) return false;
      return true;
    });
  }, [monthDebtRows, searchClinic]);

  const summaryTotals = useMemo(() => {
    const oldDebt = filteredDebtRows.reduce((s, c) => s + c.oldDebt, 0);
    const currentMonthDebt = filteredDebtRows.reduce((s, c) => s + c.currentMonthDebt, 0);
    const discount = filteredDebtRows.reduce((s, c) => s + c.discountAmount, 0);
    const totalDebt = filteredDebtRows.reduce((s, c) => s + c.totalDebt, 0);
    const paid = filteredDebtRows.reduce((s, c) => s + c.paidAmount, 0);
    const remaining = filteredDebtRows.reduce((s, c) => s + c.remainingDebt, 0);
    const owingCount = filteredDebtRows.filter((c) => c.remainingDebt > 0).length;
    return { oldDebt, currentMonthDebt, totalDebt, discount, paid, remaining, owingCount };
  }, [filteredDebtRows]);

  const allClinics = useMemo(() => {
    const set = new Set<string>();
    monthDebtRows.forEach((r) => { if (r.remainingDebt > 0) set.add(r.clinicName); });
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
    setRowEditError('');
    setEditingRowId(row.id);
    setEditCurrentDebt(row.currentMonthDebt);
    setEditPaidAmount(row.paidAmount);
    setEditNotes(row.notes || '');
  };

  const handleSaveRowEdit = (row: (typeof monthDebtRows)[number]) => {
    if (readOnly) return;
    if (!Number.isSafeInteger(editCurrentDebt) || !Number.isSafeInteger(editPaidAmount)) {
      setRowEditError('Vui lòng nhập số tiền nguyên hợp lệ.');
      return;
    }
    if (editCurrentDebt < Math.max(row.autoOrderDebt, row.discountAmount)) {
      setRowEditError('Phát sinh không được thấp hơn doanh thu tự tính hoặc khoản chiết khấu đã chốt.');
      return;
    }
    if (editPaidAmount < row.paidFromPayments + row.carriedCredit) {
      setRowEditError('Đã thanh toán gồm phiếu thu và dư có kỳ trước. Để giảm, hãy xóa phiếu thu tương ứng.');
      return;
    }
    const targetMonth = selectedMonth;
    const oldDebt = row.oldDebt;
    const enteredCurrentDebt = Math.max(0, Number(editCurrentDebt) || 0);
    const enteredPaidAmount = Math.max(0, Number(editPaidAmount) || 0);

    // Store only the manual portion above auto-calculated order revenue & payment records
    const manualCurrentDebt = Math.max(0, enteredCurrentDebt - (row.autoOrderDebt || 0));
    const manualPaidAmount = Math.max(0, enteredPaidAmount - row.paidFromPayments - row.carriedCredit);
    const totalDebt = oldDebt + manualCurrentDebt + row.autoOrderDebt - row.discountAmount;
    const remainingDebt = Math.max(0, totalDebt - row.openingAdjustment - (manualPaidAmount + row.paidFromPayments + row.carriedCredit));

    const updatedRecord: ClinicDebtRecord = {
      id: row.id,
      clinicName: row.clinicName,
      monthYear: targetMonth,
      oldDebt,
      ...(row.openingSnapshot ? {
        openingSnapshot: true,
        discountAmount: row.discountAmount,
        openingAdjustment: row.openingAdjustment,
      } : {}),
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
    setRowEditError('');
  };

  const openPaymentModalForClinic = (
    clinicName: string,
    suggestedAmount: number
  ) => {
    const targetMonth = selectedMonth;
    setPayClinic(clinicName);
    setPayAmount(suggestedAmount);
    setPayDate(new Date().toLocaleDateString('en-GB'));
    setPayMonthYear(targetMonth);
    setPayMethod('transfer');
    setPayRef(`UNC${Math.floor(100000 + Math.random() * 900000)}`);
    setPayNotes(`Thanh toán công nợ kỳ ${targetMonth}`);
    setPaymentModalOpen(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const month = debtMonthValue(payMonthYear);
    if (readOnly || !payClinic.trim() || !Number.isSafeInteger(payAmount) || payAmount <= 0 ||
      month === null || month < debtMonthValue(DEBT_START_MONTH)!) return;
    onAddPayment({
      clinicName: payClinic.trim(),
      amount: Number(payAmount),
      paymentDate: payDate.trim() || new Date().toLocaleDateString('en-GB'),
      monthYear: payMonthYear,
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
                setRowEditError('');
              }}
              className="pl-8 pr-3 py-1.5 text-xs font-bold bg-white/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Kỳ Tháng {m}
                  {m === getCurrentMonthYear() ? ' (Tháng này)' : ''}
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

        </div>

        {!readOnly && allClinics.length > 0 && (
          <button
            onClick={() =>
              openPaymentModalForClinic(allClinics[0], monthDebtRows.find((row) => row.clinicName === allClinics[0])?.remainingDebt ?? 0)
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
              <span className="block mt-1 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                Tính từ tháng {DEBT_START_MONTH} · Nợ cũ tự chuyển sau thanh toán
              </span>
            </h3>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              Dư nợ: {formatVND(summaryTotals.remaining)}
            </span>
          </div>

          {editingRowId && rowEditError && (
            <p role="alert" className="px-4 py-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40">
              {rowEditError}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Nha Khoa</th>
                  <th className="py-2.5 px-3 text-right">Nợ Cũ</th>
                  <th className="py-2.5 px-3 text-right">
                    Công Nợ Tháng Này{' '}
                    <span className="text-blue-600 dark:text-blue-400">
                      (T{selectedMonth.split('/')[0]})
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">Chiết khấu</th>
                  <th className="py-2.5 px-3 text-right">Tổng Công Nợ</th>
                  <th className="py-2.5 px-3 text-right">ĐÃ TT</th>
                  <th className="py-2.5 px-3 text-right">Còn Lại</th>
                  <th className="py-2.5 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredDebtRows.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-500">Không có nha khoa còn nợ.</td></tr>
                )}
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

                      {/* The opening balance always follows the previous month's payments. */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatVND(item.oldDebt)}
                        {isEditing && (
                          <div className="text-[10px] font-sans font-normal text-slate-500 mt-1">
                            Tự chuyển từ tháng trước
                          </div>
                        )}
                      </td>

                      {/* Current-period order revenue and manually added charges. */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {isEditing ? (
                          <div className="inline-flex flex-col items-end gap-1">
                            <input
                              type="number"
                              step={1}
                              min={item.autoOrderDebt}
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

                      <td className="py-2.5 px-3 text-right font-mono text-teal-700 dark:text-teal-300">
                        {item.discountAmount > 0 ? formatVND(item.discountAmount) : '—'}
                      </td>
                      {/* Tổng Công Nợ */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {isEditing
                          ? formatVND(item.oldDebt + (editCurrentDebt || 0) - item.discountAmount)
                          : formatVND(item.totalDebt)}
                      </td>

                      {/* ĐÃ TT */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {isEditing ? (
                          <input
                            type="number"
                            step={1}
                            min={item.paidFromPayments + item.carriedCredit}
                            value={editPaidAmount}
                            onChange={(e) => setEditPaidAmount(Number(e.target.value))}
                            className="w-28 px-2 py-1 text-right font-mono text-xs border border-emerald-500 rounded bg-white dark:bg-slate-900"
                          />
                        ) : (
                          <>
                            {formatVND(item.paidAmount)}
                            {item.carriedCredit > 0 && (
                              <div className="text-[10px] font-sans font-normal mt-1">
                                Gồm dư có kỳ trước: {formatVND(item.carriedCredit)}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Còn Lại */}
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold">
                        {isEditing ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {formatVND(
                              Math.max(
                                0,
                                item.oldDebt + (editCurrentDebt || 0) - item.discountAmount - item.openingAdjustment - (editPaidAmount || 0)
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
                              selectedMonth
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
                    {formatVND(summaryTotals.discount)}
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
                    min={1}
                    step={1}
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
