import { MonthFilter } from './MonthFilter';
import React, { useState, useMemo } from 'react';
import { CashflowTransaction } from '../types/dental';
import { formatVND, extractMonthYear, sortMonthYearsDesc } from '../utils/financeUtils';
import { PAYROLL_EXPENSE_CATEGORY, DELIVERY_EXPENSE_CATEGORY, PROFIT_EXPENSE_CATEGORIES } from '../utils/profit';
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Plus,
  Trash2,
  X,
  Search,
} from 'lucide-react';

interface CashflowViewProps {
  transactions: CashflowTransaction[];
  readOnly?: boolean;
  availableMonths: string[];
  onAddTransaction: (tx: Omit<CashflowTransaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
}

const INCOME_CATEGORIES = [
  'Thu công nợ nha khoa',
  'Thu khách lẻ / Phục hình trực tiếp',
  'Thu thanh lý vật tư',
  'Khoản thu khác',
];

const EXPENSE_CATEGORIES = [
  'Mua phôi sứ & vật tư',
  PAYROLL_EXPENSE_CATEGORY,
  DELIVERY_EXPENSE_CATEGORY,
  PROFIT_EXPENSE_CATEGORIES.rent,
  PROFIT_EXPENSE_CATEGORIES.utilities,
  'Điện nước & vận hành',
  'Bảo trì máy CAD/CAM & lò nung',
  'Chi phí tiếp khách / CSKH Nha khoa',
  'Khoản chi khác',
  PROFIT_EXPENSE_CATEGORIES.extra,
];

export const CashflowView: React.FC<CashflowViewProps> = ({
  transactions,
  readOnly = false,
  availableMonths,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  const cashflowMonths = useMemo(() => sortMonthYearsDesc([
    ...new Set([...availableMonths, ...transactions.map((row) => row.monthYear).filter(Boolean)]),
  ]), [availableMonths, transactions]);
  const latestMonth = cashflowMonths.find((m) => m === '11/2026') || cashflowMonths[0] || '11/2026';

  const [selectedMonth, setSelectedMonth] = useState<string>(latestMonth);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txCategory, setTxCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState<number>(2000000);
  const [txDate, setTxDate] = useState(`15/${latestMonth}`);
  const [txMethod, setTxMethod] = useState<'transfer' | 'cash'>('transfer');
  const [txNotes, setTxNotes] = useState('');

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return transactions
      .filter((t) => {
        if (selectedMonth !== 'ALL' && t.monthYear !== selectedMonth) return false;
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (categoryFilter && t.category !== categoryFilter) return false;
        if (q) {
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchCat = t.category.toLowerCase().includes(q);
          const matchNote = (t.notes || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCat && !matchNote) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [transactions, selectedMonth, typeFilter, categoryFilter, searchQuery]);

  const periodSummary = useMemo(() => {
    const list =
      selectedMonth === 'ALL'
        ? transactions
        : transactions.filter((t) => t.monthYear === selectedMonth);

    const totalIncome = list
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = list
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    const expMap = new Map<string, number>();
    list
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        expMap.set(t.category, (expMap.get(t.category) || 0) + t.amount);
      });

    const expenseByCategory = Array.from(expMap.entries()).sort((a, b) => b[1] - a[1]);

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      expenseByCategory,
    };
  }, [transactions, selectedMonth]);

  const handleOpenModal = (defaultType: 'income' | 'expense') => {
    const targetMonth = selectedMonth === 'ALL' ? latestMonth : selectedMonth;
    setTxType(defaultType);
    setTxCategory(
      defaultType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
    );
    setTxTitle('');
    setTxAmount(defaultType === 'income' ? 5000000 : 2500000);
    setTxDate(`20/${targetMonth}`);
    setTxMethod('transfer');
    setTxNotes('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTitle.trim() || txAmount <= 0) return;

    onAddTransaction({
      type: txType,
      category: txCategory,
      title: txTitle.trim(),
      amount: Number(txAmount),
      date: txDate.trim(),
      monthYear: extractMonthYear(txDate),
      paymentMethod: txMethod,
      notes: txNotes.trim(),
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Compact Single-Row Filter & Action Bar */}
      <div className="sm:bg-white sm:dark:bg-slate-900 sm:p-3.5 sm:rounded-xl sm:border sm:border-slate-200/80 sm:dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <MonthFilter
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="hidden sm:block px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">Tất cả tháng</option>
            {cashflowMonths.map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </MonthFilter>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('income')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${
                typeFilter === 'income'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Thu
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('expense')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${
                typeFilter === 'expense'
                  ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Chi
            </button>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="">Tất cả hạng mục</option>
            {[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm diễn giải..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenModal('income')}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Phiếu Thu
            </button>
            <button
              onClick={() => handleOpenModal('expense')}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Phiếu Chi
            </button>
          </div>
        )}
      </div>

      {/* Deep Dark-Jewel Summary Strip */}
      <div className="dashboard-kpis grid min-w-0 grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border border-teal-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Tổng Thu
            </span>
            <div className="font-display text-2xl font-bold font-mono text-teal-300 mt-1">
              +{formatVND(periodSummary.totalIncome)}
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0 relative">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 text-white border border-amber-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Tổng Chi
            </span>
            <div className="font-display text-2xl font-bold font-mono text-amber-300 mt-1">
              -{formatVND(periodSummary.totalExpense)}
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300 flex items-center justify-center shrink-0 relative">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        <div className="max-sm:col-span-2 p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Quỹ Ròng (Thu - Chi)
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {formatVND(periodSummary.netProfit)}
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 text-sky-300 flex items-center justify-center shrink-0 relative">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content: Ledger Table (8 cols) + Expense Breakdown (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 bento-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Sổ Thu Chi ({filteredTransactions.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Ngày</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3">Hạng Mục</th>
                  <th className="py-2.5 px-3">Diễn Giải</th>
                  <th className="py-2.5 px-3">Hình Thức</th>
                  <th className="py-2.5 px-3 text-right">Số Tiền</th>
                  <th className="py-2.5 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {tx.type === 'income' ? (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          THU
                        </span>
                      ) : (
                        <span className="font-bold text-rose-700 dark:text-rose-400">
                          CHI
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {tx.category}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      <div>{tx.title}</div>
                      {tx.notes && (
                        <span className="text-[11px] font-normal text-slate-400 block">
                          {tx.notes}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {tx.paymentMethod === 'transfer' ? 'CK' : tx.paymentMethod === 'cash' ? 'Tiền mặt' : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-extrabold whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatVND(tx.amount)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {!readOnly && (
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3 self-start">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Cơ Cấu Chi Phí
            </span>
            <span className="text-xs font-mono text-slate-400">
              {selectedMonth === 'ALL' ? 'Toàn kỳ' : selectedMonth}
            </span>
          </div>
          <div className="space-y-2.5">
            {periodSummary.expenseByCategory.map(([cat, amount]) => {
              const pct =
                periodSummary.totalExpense > 0
                  ? Math.round((amount / periodSummary.totalExpense) * 100)
                  : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {cat}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatVND(amount)} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Income / Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 text-white">
              <h3 className="font-bold text-sm">
                {txType === 'income' ? 'Lập Phiếu Thu' : 'Lập Phiếu Chi'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTxType('income');
                    setTxCategory(INCOME_CATEGORIES[0]);
                  }}
                  className={`py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    txType === 'income'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Phiếu Thu (+)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('expense');
                    setTxCategory(EXPENSE_CATEGORIES[0]);
                  }}
                  className={`py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    txType === 'expense'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Phiếu Chi (-)
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Hạng Mục *
                </label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {(txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Diễn Giải *
                </label>
                <input
                  type="text"
                  required
                  value={txTitle}
                  onChange={(e) => setTxTitle(e.target.value)}
                  placeholder="Nội dung thu / chi..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
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
                    value={txAmount}
                    onChange={(e) => setTxAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Ngày Ghi Sổ *
                  </label>
                  <input
                    type="text"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg cursor-pointer"
                >
                  Lưu Phiếu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
