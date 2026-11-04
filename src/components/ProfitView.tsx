import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Calendar, Check, Download, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { CashflowTransaction, LabProfileConfig } from '../types/dental';
import { MonthFilter } from './MonthFilter';
import { ProfitPdfPreviewModal } from './ProfitPdfPreviewModal';
import { getCurrentMonthYear } from '../utils/dashboardMetrics';
import { debtMonthValue } from '../utils/debtLedger';
import { formatVND, sortMonthYearsDesc } from '../utils/financeUtils';
import { calculateMonthlyProfit, isManualProfitExpense, type MonthlyProfitReport, type ProfitExpenseKind, type ProfitSources } from '../utils/profit';

interface ProfitViewProps {
  sources: ProfitSources;
  loading: boolean;
  loadError: string;
  onOpenDelivery: (month: string) => void;
  onAddExpense: (expense: { monthYear: string; kind: ProfitExpenseKind; title: string; amount: number }) => Promise<void>;
  onDeleteExtra: (id: string) => Promise<void>;
  onUpdateFixedExpense: (expense: { monthYear: string; kind: 'rent' | 'utilities'; amount: number }) => Promise<void>;
  onUpdateExpense: (expense: { id: string; title: string; amount: number }) => Promise<void>;
  labProfile: LabProfileConfig;
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

export function ProfitView({ sources, loading, loadError, onOpenDelivery, onAddExpense, onDeleteExtra, onUpdateFixedExpense, onUpdateExpense, labProfile }: ProfitViewProps) {
  const currentMonth = getCurrentMonthYear();
  const [month, setMonth] = useState(currentMonth);
  const [table, setTable] = useState<TableId>('summary');
  const [preview, setPreview] = useState<{ monthYear: string; report: MonthlyProfitReport; labProfile: LabProfileConfig } | null>(null);
  const exporting = preview !== null;
  const [activeEdits, setActiveEdits] = useState<Set<string>>(new Set());
  const setEditStatus = useCallback((key: string, active: boolean) => {
    setActiveEdits((current) => {
      if (current.has(key) === active) return current;
      const next = new Set(current);
      if (active) next.add(key); else next.delete(key);
      return next;
    });
  }, []);
  const { orders, cashflows, deliveries, payrolls, clinicDebts, discountRates, users, commissions, fixedExpenses } = sources;
  const months = useMemo(() => {
    const values = new Set([currentMonth]);
    for (const rows of [orders, cashflows, deliveries, payrolls, clinicDebts, fixedExpenses ?? []]) {
      for (const row of rows) {
        if (debtMonthValue(row.monthYear) !== null) values.add(row.monthYear);
      }
    }
    return sortMonthYearsDesc([...values]);
  }, [currentMonth, orders, cashflows, deliveries, payrolls, clinicDebts, fixedExpenses]);
  const selectedMonth = months.includes(month) ? month : currentMonth;
  const report = useMemo(
    () => calculateMonthlyProfit(selectedMonth, { orders, cashflows, deliveries, payrolls, clinicDebts, discountRates, users, commissions, fixedExpenses }),
    [selectedMonth, orders, cashflows, deliveries, payrolls, clinicDebts, discountRates, users, commissions, fixedExpenses]
  );

  function exportReport() {
    if (exporting || activeEdits.size || loading || loadError) return;
    setPreview({ monthYear: selectedMonth, report, labProfile });
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="bento-card month-toolbar flex flex-wrap items-center justify-between gap-3 rounded-2xl sm:p-4">
        <h1 className="text-base font-bold">Lợi nhuận tháng {selectedMonth}</h1>
        <div className="relative hidden sm:block">
          <Calendar aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-blue-600 dark:text-sky-400" />
          <MonthFilter
            aria-label="Tháng lợi nhuận"
            value={selectedMonth}
            disabled={exporting || activeEdits.size > 0}
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
            disabled={activeEdits.size > 0 && table !== id}
            onClick={() => setTable(id)}
            className={`${buttonClass} ${table === id
              ? 'bg-blue-700 text-white'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={exportReport} disabled={exporting || loading || !!loadError || activeEdits.size > 0}
          className={`${buttonClass} bg-blue-700 text-white sm:ml-auto`}>
          <Download aria-hidden="true" className="size-4" />
          Xem trước và xuất PDF
        </button>
      </nav>
      {activeEdits.size > 0 && <p className={muted}>Lưu hoặc hủy dòng đang sửa trước khi xuất PDF.</p>}

      {loading ? (
        <p role="status" className={panelClass}>Đang tải bảng lương để tính lợi nhuận…</p>
      ) : loadError ? (
        <p role="alert" className={`${panelClass} text-sm text-rose-700 dark:text-rose-300`}>{loadError}</p>
      ) : (
        <>
          {table === 'summary' && (
            <div className="mx-auto min-w-0 max-w-4xl">
              <section aria-labelledby="profit-summary" className={panelClass}>
                <h2 id="profit-summary" className="mb-2 text-sm font-bold">Tổng kết tháng {selectedMonth}</h2>
                <dl className="divide-y divide-slate-200 text-sm dark:divide-slate-700">
                  <ReportLine label="Tổng doanh thu" value={report.grossRevenue} />
                  <ReportLine label="Tổng chiết khấu" value={-report.discounts} />
                  <ReportLine label="Doanh thu sau chiết khấu" value={report.netRevenue} bold />
                  <ReportLine label="Tổng lương" value={report.payrollExpense} />
                  <ReportLine label="Tổng chi từ bảng chi" value={report.operatingExpenses} />
                  <EditableCostLine key={`rent-${selectedMonth}`} id="rent" label="Chi phí mặt bằng" value={report.rentExpense}
                    disabled={exporting} onEditStatus={setEditStatus}
                    onSave={(amount) => onUpdateFixedExpense({ monthYear: selectedMonth, kind: 'rent', amount })} />
                  <EditableCostLine key={`utilities-${selectedMonth}`} id="utilities" label="Điện nước" value={report.utilitiesExpense}
                    disabled={exporting} onEditStatus={setEditStatus}
                    onSave={(amount) => onUpdateFixedExpense({ monthYear: selectedMonth, kind: 'utilities', amount })} />
                  <ReportLine label="Tổng giao vận" value={report.deliveryExpense} />
                  <ExtraExpenseLines key={selectedMonth} month={selectedMonth} rows={report.extraRows} total={report.extraExpense}
                    disabled={exporting} onAddExpense={onAddExpense} onUpdateExpense={onUpdateExpense}
                    onDeleteExtra={onDeleteExtra} onEditStatus={setEditStatus} />
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
                  Mặt bằng, điện nước lấy từ bảng chi khi chưa chỉnh sửa. Bấm số tiền để sửa cho tháng này. Lương và giao vận lấy số lớn hơn giữa bảng nghiệp vụ và phiếu chi cùng nhóm để tránh cộng trùng.
                </p>
              </section>
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
      {preview && <ProfitPdfPreviewModal {...preview} onClose={() => setPreview(null)} />}
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

type EditStatus = (key: string, active: boolean) => void;
const iconButtonClass = 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50';

function useEditStatus(id: string, active: boolean, onEditStatus: EditStatus) {
  useEffect(() => {
    onEditStatus(id, active);
    return () => onEditStatus(id, false);
  }, [id, active, onEditStatus]);
}

function EditableCostLine({ id, label, value, disabled, onSave, onEditStatus }: {
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  onSave: (amount: number) => Promise<void>;
  onEditStatus: EditStatus;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const cancelled = useRef(false);
  useEditStatus(id, editing || busy, onEditStatus);

  function begin() {
    setAmount(String(value));
    setError('');
    cancelled.current = false;
    setEditing(true);
  }

  function cancel() {
    if (lock.current) return;
    cancelled.current = true;
    setError('');
    setEditing(false);
  }

  async function save() {
    if (lock.current || cancelled.current) return;
    const next = Number(amount);
    if (!amount.trim() || !Number.isSafeInteger(next) || next < 0) {
      setError('Nhập số tiền nguyên từ 0 đồng.');
      return;
    }
    if (next === value) { setEditing(false); return; }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave(next);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được số tiền.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1">
      <dt>{label}</dt>
      <dd className="ml-auto min-w-0 max-w-full">
        {editing ? (
          <div className="flex max-w-full items-center gap-1" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) void save();
          }} onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); cancel(); }
            if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); void save(); }
          }}>
            <input autoFocus aria-label={label} type="number" inputMode="numeric" min="0" step="1" value={amount} disabled={busy}
              aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
              onFocus={(event) => event.target.select()} onChange={(event) => setAmount(event.target.value)}
              className={`${fieldClass} max-w-48 text-right font-mono`} />
            <button type="button" disabled={busy} aria-label={`Lưu ${label.toLowerCase()}`} className={`${iconButtonClass} text-blue-700 dark:text-sky-300`} onClick={() => void save()}>
              {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" className="size-4" />}
            </button>
            <button type="button" disabled={busy} aria-label="Hủy chỉnh sửa" className={`${iconButtonClass} text-slate-600 dark:text-slate-300`} onClick={cancel}>
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : (
          <button type="button" disabled={disabled} onClick={begin} aria-label={`Sửa ${label.toLowerCase()}, ${formatVND(value)}`}
            className={`${buttonClass} -mr-2 px-2 text-blue-700 hover:bg-blue-50 dark:text-sky-300 dark:hover:bg-slate-800`}>
            {money(value)} <Pencil aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </dd>
      {error && <dd id={`${id}-error`} role="alert" className="w-full text-right text-xs text-rose-700 dark:text-rose-300">{error}</dd>}
    </div>
  );
}

function ExtraExpenseLines({ month, rows, total, disabled, onAddExpense, onUpdateExpense, onDeleteExtra, onEditStatus }: {
  month: string;
  rows: CashflowTransaction[];
  total: number;
  disabled: boolean;
  onAddExpense: ProfitViewProps['onAddExpense'];
  onUpdateExpense: ProfitViewProps['onUpdateExpense'];
  onDeleteExtra: ProfitViewProps['onDeleteExtra'];
  onEditStatus: EditStatus;
}) {
  const [drafts, setDrafts] = useState<string[]>([]);
  const sequence = useRef(0);
  const removeDraft = (id: string) => setDrafts((current) => current.filter((value) => value !== id));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 py-1">
        <dt className="flex min-w-0 items-center gap-1 font-medium">
          Chi phí khác
          <button type="button" disabled={disabled} aria-label="Thêm dòng chi phí khác" title="Thêm dòng chi phí khác"
            className={`${iconButtonClass} text-blue-700 hover:bg-blue-50 dark:text-sky-300 dark:hover:bg-slate-800`}
            onClick={() => setDrafts((current) => [...current, `draft-${++sequence.current}`])}>
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </dt>
        <dd className="flex items-center">{money(total)}</dd>
      <dd className="col-span-2">
        {(rows.length > 0 || drafts.length > 0) && (
          <ul className="mb-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 px-2 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-950/40 sm:px-3">
            {rows.map((row) => (
              <ExtraExpenseRow key={row.id} id={row.id} row={row} disabled={disabled} onEditStatus={onEditStatus}
                onSave={(title, amount) => onUpdateExpense({ id: row.id, title, amount })}
                onDelete={isManualProfitExpense(row) ? () => onDeleteExtra(row.id) : undefined} />
            ))}
            {drafts.map((id) => (
              <ExtraExpenseRow key={id} id={id} disabled={disabled} onEditStatus={onEditStatus}
                onCancel={() => removeDraft(id)} onSave={async (title, amount) => {
                  await onAddExpense({ monthYear: month, kind: 'extra', title, amount });
                  removeDraft(id);
                }} />
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}

function ExtraExpenseRow({ id, row, disabled, onSave, onCancel, onDelete, onEditStatus }: {
  id: string;
  row?: CashflowTransaction;
  disabled: boolean;
  onSave: (title: string, amount: number) => Promise<void>;
  onCancel?: () => void;
  onDelete?: () => Promise<void>;
  onEditStatus: EditStatus;
}) {
  const [editing, setEditing] = useState(!row);
  const [title, setTitle] = useState(row?.title || '');
  const [amount, setAmount] = useState(row ? String(row.amount) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEditStatus(id, editing || busy || confirmDelete, onEditStatus);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const next = Number(amount);
    if (!title.trim() || !amount.trim() || !Number.isSafeInteger(next) || next <= 0) {
      setError('Nhập nội dung và số tiền nguyên lớn hơn 0.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave(title.trim(), next);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được khoản chi.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function cancel() {
    if (lock.current) return;
    setError('');
    if (row) setEditing(false); else onCancel?.();
  }

  async function remove() {
    if (lock.current || !onDelete) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await onDelete();
      setConfirmDelete(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xóa được khoản chi.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <li className="min-w-0 py-1.5">
      {editing ? (
        <form noValidate onSubmit={(event) => void submit(event)} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)_auto]"
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } }}>
          <input autoFocus aria-label="Nội dung chi phí khác" placeholder="Nội dung khoản chi" maxLength={250} value={title} disabled={busy}
            aria-invalid={!!error && !title.trim()} onChange={(event) => setTitle(event.target.value)}
            className={`${fieldClass} col-span-2 sm:col-span-1`} />
          <input aria-label="Số tiền chi phí khác" placeholder="Số tiền (đ)" type="number" inputMode="numeric" min="1" step="1" value={amount} disabled={busy}
            aria-invalid={!!error && (!amount.trim() || Number(amount) <= 0 || !Number.isSafeInteger(Number(amount)))}
            onChange={(event) => setAmount(event.target.value)} className={`${fieldClass} font-mono sm:text-right`} />
          <div className="flex items-center gap-1">
            <button type="submit" disabled={busy} aria-label="Lưu dòng chi phí" className={`${iconButtonClass} bg-blue-700 text-white`}>
              {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" className="size-4" />}
            </button>
            <button type="button" disabled={busy} aria-label="Hủy dòng đang sửa" className={`${iconButtonClass} text-slate-600 dark:text-slate-300`} onClick={cancel}>
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <button type="button" disabled={disabled || busy} className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-1 text-left hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:hover:bg-slate-800"
            aria-label={`Sửa chi phí ${row?.title}, ${formatVND(row?.amount || 0)}`} onClick={() => {
              setTitle(row?.title || ''); setAmount(String(row?.amount || 0)); setError(''); setEditing(true);
            }}>
            <span className="min-w-0 break-words">{row?.title}</span>
            <span className="ml-auto inline-flex items-center gap-2 text-blue-700 dark:text-sky-300">
              {money(row?.amount || 0)}<Pencil aria-hidden="true" className="size-3.5" />
            </span>
          </button>
          {onDelete && !confirmDelete && (
            <button type="button" disabled={disabled || busy} aria-label={`Xóa chi phí ${row?.title}`} onClick={() => setConfirmDelete(true)}
              className={`${iconButtonClass} text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-slate-800`}>
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          )}
          {confirmDelete && (
            <div className="flex w-full flex-wrap items-center justify-end gap-1">
              <span className="mr-auto text-xs text-slate-600 dark:text-slate-300">Xóa khoản chi này?</span>
              <button type="button" disabled={busy} onClick={() => void remove()} className={`${buttonClass} bg-rose-700 text-white`}>{busy ? 'Đang xóa…' : 'Xóa'}</button>
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className={buttonClass}>Hủy</button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    </li>
  );
}
