import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Calendar, Plus } from 'lucide-react';
import type { CashflowTransaction } from '../types/dental';
import { MonthFilter } from './MonthFilter';
import { getCurrentMonthYear } from '../utils/dashboardMetrics';
import { debtMonthValue } from '../utils/debtLedger';
import { formatVND, sortMonthYearsDesc } from '../utils/financeUtils';
import { calculateMonthlyProfit, type ProfitExpenseKind, type ProfitSources } from '../utils/profit';

interface ProfitViewProps {
  sources: ProfitSources;
  loading: boolean;
  loadError: string;
  onOpenDelivery: (month: string) => void;
  onAddExpense: (expense: { monthYear: string; kind: ProfitExpenseKind; title: string; amount: number }) => Promise<void>;
  onDeleteExtra: (id: string) => Promise<void>;
}

const tables = [
  ['summary', 'Bảng lợi nhuận'],
  ['payroll', 'Bảng lương'],
  ['expenses', 'Bảng chi'],
  ['discounts', 'Chiết khấu'],
  ['sales', 'Doanh số nha khoa'],
  ['delivery', 'Giao vận'],
] as const;
type TableId = typeof tables[number][0];

const formatPercent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 });
const panelClass = 'bento-card min-w-0 rounded-2xl p-4';
const fieldClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:text-sm';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50';
const muted = 'text-xs leading-relaxed text-slate-600 dark:text-slate-300';
const money = (value: number) => <span className="whitespace-nowrap font-mono tabular-nums">{formatVND(value)}</span>;

export function ProfitView({ sources, loading, loadError, onOpenDelivery, onAddExpense, onDeleteExtra }: ProfitViewProps) {
  const currentMonth = getCurrentMonthYear();
  const [month, setMonth] = useState(currentMonth);
  const [table, setTable] = useState<TableId>('summary');
  const { orders, cashflows, deliveries, payrolls, clinicDebts, discountRates, users, commissions } = sources;
  const months = useMemo(() => {
    const values = new Set([currentMonth]);
    for (const rows of [orders, cashflows, deliveries, payrolls, clinicDebts]) {
      for (const row of rows) {
        if (debtMonthValue(row.monthYear) !== null) values.add(row.monthYear);
      }
    }
    return sortMonthYearsDesc([...values]);
  }, [currentMonth, orders, cashflows, deliveries, payrolls, clinicDebts]);
  const selectedMonth = months.includes(month) ? month : currentMonth;
  const report = useMemo(
    () => calculateMonthlyProfit(selectedMonth, { orders, cashflows, deliveries, payrolls, clinicDebts, discountRates, users, commissions }),
    [selectedMonth, orders, cashflows, deliveries, payrolls, clinicDebts, discountRates, users, commissions]
  );

  return (
    <div className="min-w-0 space-y-4">
      <div className="bento-card month-toolbar flex flex-wrap items-center justify-between gap-3 rounded-2xl sm:p-4">
        <h1 className="text-base font-bold">Lợi nhuận tháng {selectedMonth}</h1>
        <div className="relative hidden sm:block">
          <Calendar aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-blue-600 dark:text-sky-400" />
          <MonthFilter
            aria-label="Tháng lợi nhuận"
            value={selectedMonth}
            onChange={(event) => setMonth(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
          >
            {months.map((value) => <option key={value} value={value}>Tháng {value}</option>)}
          </MonthFilter>
        </div>
      </div>

      <nav aria-label="Các bảng lợi nhuận" className="bento-card flex flex-wrap gap-1.5 rounded-2xl p-2">
        {tables.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={table === id}
            onClick={() => setTable(id)}
            className={`${buttonClass} ${table === id
              ? 'bg-blue-700 text-white'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <p role="status" className={panelClass}>Đang tải bảng lương để tính lợi nhuận…</p>
      ) : loadError ? (
        <p role="alert" className={`${panelClass} text-sm text-rose-700 dark:text-rose-300`}>{loadError}</p>
      ) : (
        <>
          {table === 'summary' && (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <section aria-labelledby="profit-summary" className={panelClass}>
                <h2 id="profit-summary" className="mb-2 text-sm font-bold">Tổng kết tháng {selectedMonth}</h2>
                <dl className="divide-y divide-slate-200 text-sm dark:divide-slate-700">
                  <ReportLine label="Tổng doanh thu" value={report.grossRevenue} />
                  <ReportLine label="Tổng chiết khấu" value={-report.discounts} />
                  <ReportLine label="Doanh thu sau chiết khấu" value={report.netRevenue} bold />
                  <ReportLine label="Tổng lương" value={report.payrollExpense} />
                  <ReportLine label="Tổng chi từ bảng chi" value={report.operatingExpenses} />
                  <ReportLine label="Chi phí mặt bằng" value={report.rentExpense} />
                  <ReportLine label="Điện nước" value={report.utilitiesExpense} />
                  <ReportLine label="Tổng giao vận" value={report.deliveryExpense} />
                  <ReportLine label="Chi phí khác nhập thêm" value={report.extraExpense} />
                  <ReportLine label="Tổng chi phí" value={report.expenses} bold />
                </dl>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900 p-3 text-white">
                  <div>
                    <div className="font-bold">Lợi nhuận</div>
                    <div className="text-xs text-slate-300">
                      Biên lợi nhuận {report.margin === null ? '—' : formatPercent.format(report.margin)}
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${report.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {money(report.profit)}
                  </div>
                </div>
                <p className={`mt-3 ${muted}`}>
                  Mặt bằng và điện nước tự lấy từ phiếu chi theo tháng. Lương và giao vận lấy số lớn hơn giữa bảng nghiệp vụ và phiếu chi cùng nhóm để tránh cộng trùng.
                </p>
              </section>
              <ExpenseEntry
                key={selectedMonth}
                month={selectedMonth}
                manualRows={report.manualExpenseRows}
                onAddExpense={onAddExpense}
                onDeleteExtra={onDeleteExtra}
              />
            </div>
          )}

          {table === 'payroll' && (
            <ReportTable
              title="Bảng lương tổng hợp"
              columns={['Nhân sự', 'Lương cơ bản', 'Phụ cấp', 'Hoa hồng', 'Thưởng', 'Khấu trừ', 'Thực lĩnh']}
              rows={report.payrollRows.map((row) => ({
                id: row.id,
                cells: [row.employeeName, money(row.baseSalary), money(row.allowance), money(row.commissionAmount),
                  money(row.bonus), money(row.deduction), money(row.netSalary)],
              }))}
              total={report.savedPayroll}
              totalLabel="Tổng thực lĩnh"
              description={`Phiếu chi lương ${formatVND(report.payrollInCashflow)} · Tính vào lợi nhuận ${formatVND(report.payrollExpense)}`}
            />
          )}

          {table === 'expenses' && (
            <ReportTable
              title="Bảng chi"
              columns={['Nội dung', 'Danh mục', 'Ngày', 'Số tiền']}
              rows={report.expenseRows.map((row) => ({
                id: row.id,
                cells: [row.title, row.category, row.date || '—', money(row.amount)],
              }))}
              total={report.expenseRows.reduce((sum, row) => sum + row.amount, 0)}
              totalLabel="Tổng phiếu chi"
              description={`Chi phí từ bảng chi đưa vào dòng Tổng chi: ${formatVND(report.operatingExpenses)}. Lương, giao vận, mặt bằng, điện nước và chi phí nhập thêm có dòng riêng ở bảng lợi nhuận.`}
            />
          )}

          {table === 'discounts' && (
            <ReportTable
              title="Bảng chiết khấu"
              columns={['Nha khoa', 'Doanh số', 'Tỷ lệ thực tế', 'Tiền chiết khấu']}
              rows={report.salesRows.filter((row) => row.discountAmount > 0).map((row) => ({
                id: row.clinicName,
                cells: [row.clinicName, money(row.grossRevenue),
                  row.grossRevenue > 0 ? formatPercent.format(row.discountAmount / row.grossRevenue) : '—',
                  money(row.discountAmount)],
              }))}
              total={report.discounts}
              totalLabel="Tổng chiết khấu"
            />
          )}

          {table === 'sales' && (
            <ReportTable
              title="Doanh số theo nha khoa"
              columns={['Nha khoa', 'Số ca', 'Số răng', 'Doanh số', 'Chiết khấu', 'Doanh thu sau chiết khấu']}
              rows={report.salesRows.map((row) => ({
                id: row.clinicName,
                cells: [row.clinicName, row.orderCount, row.teethCount, money(row.grossRevenue),
                  money(row.discountAmount), money(row.netRevenue)],
              }))}
              total={report.netRevenue}
              totalLabel="Tổng doanh thu sau chiết khấu"
            />
          )}

          {table === 'delivery' && (
            <ReportTable
              title="Bảng giao vận"
              columns={['Nha khoa', 'Ngày', 'Bên trả', 'Ghi chú', 'Tiền giao vận']}
              rows={report.deliveryRows.map((row) => ({
                id: row.id,
                cells: [row.clinicName || '—', row.deliveryDate || '—',
                  row.payer === 'clinic' ? 'Nha khoa' : row.payer === 'lab' ? 'Labo' : 'Labo (mặc định)',
                  row.notes || '—', money(row.shippingFee)],
              }))}
              total={report.deliveryExpense}
              totalLabel="Tổng giao vận tính vào lợi nhuận"
              description={`Phí tính cho labo ${formatVND(report.labDelivery)} · Phiếu chi giao vận ${formatVND(report.deliveryInCashflow)}. Bên trả để trống tính cho labo (${formatVND(report.assumedLabDelivery)}). Nha khoa trả ${formatVND(report.clinicDelivery)}.`}
              action={<button type="button" onClick={() => onOpenDelivery(selectedMonth)} className={`${buttonClass} bg-blue-700 text-white`}>Mở giao vận</button>}
            />
          )}
        </>
      )}
    </div>
  );
}

function ReportLine({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 ${bold ? 'font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd>{money(value)}</dd>
    </div>
  );
}

function ReportTable({ title, columns, rows, total, totalLabel, description, action }: {
  title: string;
  columns: string[];
  rows: { id: string; cells: ReactNode[] }[];
  total: number;
  totalLabel: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section aria-label={title} className={panelClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          {description && <p className={`mt-1 ${muted}`}>{description}</p>}
        </div>
        {action}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700" tabIndex={0} role="region" aria-label={title}>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>{columns.map((label, index) => (
              <th scope="col" key={label} className={`whitespace-nowrap px-3 py-2.5 ${index === columns.length - 1 ? 'text-right' : ''}`}>{label}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {rows.length ? rows.map(({ id, cells }) => (
              <tr key={id}>
                {cells.map((cell, index) => index === 0
                  ? <th key={index} scope="row" className="whitespace-nowrap px-3 py-2 font-medium">{cell}</th>
                  : <td key={index} className={`px-3 py-2 ${index === cells.length - 1 ? 'text-right' : ''}`}>{cell}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={columns.length} className={`px-3 py-4 ${muted}`}>Chưa có dữ liệu tháng này.</td></tr>
            )}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th scope="row" colSpan={columns.length - 1} className="px-3 py-2.5">{totalLabel}</th>
              <td className="px-3 py-2.5 text-right">{money(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ExpenseEntry({ month, manualRows, onAddExpense, onDeleteExtra }: {
  month: string;
  manualRows: CashflowTransaction[];
  onAddExpense: ProfitViewProps['onAddExpense'];
  onDeleteExtra: ProfitViewProps['onDeleteExtra'];
}) {
  const [kind, setKind] = useState<ProfitExpenseKind>('extra');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const locked = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    const cleanTitle = title.trim();
    if (locked.current) return;
    if (!cleanTitle || !Number.isSafeInteger(value) || value <= 0) {
      setError('Nhập nội dung và số tiền nguyên lớn hơn 0.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onAddExpense({ monthYear: month, kind, title: cleanTitle, amount: value });
      setTitle('');
      setAmount('');
      setNotice('Đã lưu khoản chi.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được khoản chi.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onDeleteExtra(id);
      setConfirmId('');
      setNotice('Đã xóa khoản chi.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xóa được khoản chi.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="profit-entry" className={panelClass}>
      <h2 id="profit-entry" className="text-sm font-bold">Thêm khoản chi tháng {month}</h2>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold">
          Loại chi
          <select value={kind} disabled={busy} onChange={(event) => setKind(event.target.value as ProfitExpenseKind)} className={fieldClass}>
            <option value="extra">Chi phí khác</option>
            <option value="rent">Mặt bằng</option>
            <option value="utilities">Điện nước</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Số tiền (đ)
          <input type="number" min="1" step="1" inputMode="numeric" required value={amount} disabled={busy}
            onChange={(event) => setAmount(event.target.value)} className={fieldClass} />
        </label>
        <label className="grid gap-1 text-xs font-semibold sm:col-span-2">
          Nội dung
          <input required maxLength={250} value={title} disabled={busy}
            onChange={(event) => setTitle(event.target.value)} className={fieldClass} />
        </label>
        <button type="submit" disabled={busy} className={`${buttonClass} justify-self-start bg-blue-700 text-white`}>
          <Plus aria-hidden="true" className="size-4" />
          {busy ? 'Đang lưu…' : 'Thêm dòng chi'}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <h3 className="mb-1 mt-4 text-sm font-bold">Khoản chi thêm từ bảng lợi nhuận</h3>
      {manualRows.length ? (
        <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-700">
          {manualRows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
              <span className="min-w-0 break-words">
                {row.title}
                <span className={`block ${muted}`}>{row.category}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {money(row.amount)}
                {confirmId === row.id ? (
                  <>
                    <button type="button" disabled={busy} className={`${buttonClass} bg-rose-700 text-white`} onClick={() => void remove(row.id)}>
                      Xác nhận xóa
                    </button>
                    <button type="button" disabled={busy} className={buttonClass} onClick={() => setConfirmId('')}>Hủy</button>
                  </>
                ) : (
                  <button type="button" disabled={busy} className={`${buttonClass} text-rose-700 dark:text-rose-300`} aria-label={`Xóa khoản chi ${row.title}`} onClick={() => setConfirmId(row.id)}>
                    Xóa
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className={muted}>Chưa có khoản chi nào được thêm trong tháng này.</p>}
    </section>
  );
}
