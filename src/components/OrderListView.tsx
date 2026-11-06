import { MonthFilter } from './MonthFilter';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { QuickOrderEntry, QuickOrderField } from './QuickOrderEntry';
import { DentalOrder, MaterialPriceConfig, ClinicMaterialPriceRow, ClinicPartner } from '../types/dental';
import { extractWarrantyYears } from '../utils/csvParser';
import { formatSaveError } from '../utils/reliableSave';
import { useNotify } from './AppNotifications';
import { getClinicOptions } from '../utils/clinicPartners';
import { resolveOrderInvoiceExportScope } from '../utils/orderInvoiceExport';
import {
  formatVND,
  sortMonthYearsDesc,
  getPreviousMonthYear,
} from '../utils/financeUtils';
import { DateCellEditor } from './DateTextInput';
import { formatMonthYear, normalizeDdMmYyyy, parseDdMmYyyy } from '../utils/dateOnly';
import {
  Search,
  FileDown,
  Plus,
  ShieldCheck,
  Printer,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  RotateCcw,
  CheckSquare,
  Square,
  Activity,
  DollarSign,
  Layers,
  Calendar,
  Edit3,
  Copy,
  MoreVertical,
} from 'lucide-react';

type SortField = 'id' | 'createdAt' | 'orderDate' | 'warrantyCode' | 'patientName' | 'clinicName' | 'teethCount' | 'totalAmount';
type EditableField = Exclude<SortField, 'id' | 'createdAt'> | 'teeth' | 'phone' | 'warrantyPeriod' | 'material' | 'notes';

const orderColumns: { field: QuickOrderField; label: string; sort?: SortField; widthPct: number }[] = [
  { field: 'warrantyCode', label: 'Mã BH', sort: 'warrantyCode', widthPct: 7 },
  { field: 'patientName', label: 'KH', sort: 'patientName', widthPct: 11 },
  { field: 'clinicName', label: 'Nha khoa', sort: 'clinicName', widthPct: 12 },
  { field: 'orderDate', label: 'Ngày', sort: 'orderDate', widthPct: 8 },
  { field: 'teeth', label: 'Vị trí răng', widthPct: 8 },
  { field: 'teethCount', label: 'SL', sort: 'teethCount', widthPct: 4 },
  { field: 'warrantyPeriod', label: 'Thời gian BH', widthPct: 8 },
  { field: 'material', label: 'Dòng sứ', widthPct: 9 },
  { field: 'totalAmount', label: 'Thành tiền', sort: 'totalAmount', widthPct: 8 },
  { field: 'notes', label: 'Ghi chú', widthPct: 10 },
];
/** Checkbox + data cols + actions = 100%. Locks layout under table-fixed so inline inputs cannot widen columns. */
const orderTableColPercents = [3, ...orderColumns.map((column) => column.widthPct), 12];

const fieldMaxLengths: Partial<Record<EditableField, number>> = {
  warrantyCode: 64,
  patientName: 200,
  phone: 50,
  teeth: 200,
  warrantyPeriod: 64,
  notes: 1000,
};

interface OrderListViewProps {
  orders: DentalOrder[];
  createdOrder?: Pick<DentalOrder, 'id' | 'monthYear'> | null;
  readOnly?: boolean;
  clinicNames: string[];
  clinicPartners: ClinicPartner[];
  materialPrices: MaterialPriceConfig[];
  clinicMaterialPrices?: ClinicMaterialPriceRow[];
  onViewWarranty: (order: DentalOrder) => void;
  onPrintTicket: (order: DentalOrder) => void;
  onEditOrder: (order: DentalOrder) => void;
  onUpdateOrder: (updated: DentalOrder) => void | Promise<void>;
  onDeleteOrder: (id: string) => void;
  onDuplicateOrder?: (order: DentalOrder) => void | Promise<void>;
  onNewOrder: () => void;
  onQuickAdd: (data: Partial<DentalOrder>) => Promise<DentalOrder>;
  onExportInvoicePdf: (orders: DentalOrder[], clinicName: string, monthYear: string) => void;
}

export const OrderListView: React.FC<OrderListViewProps> = ({
  orders,
  createdOrder,
  readOnly = false,
  clinicNames,
  clinicPartners,
  materialPrices,
  clinicMaterialPrices = [],
  onViewWarranty,
  onPrintTicket,
  onEditOrder,
  onUpdateOrder,
  onDeleteOrder,
  onDuplicateOrder,
  onNewOrder,
  onQuickAdd,
  onExportInvoicePdf,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const clinicAddresses = useMemo(() => new Map(
    getClinicOptions(orders, clinicPartners).map(({ name, address }) => [name, address])
  ), [orders, clinicPartners]);
  const [search, setSearch] = useState('');

  const [sortField, setSortField] = useState<SortField | 'default'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditableField } | null>(null);
  const { notify, confirm } = useNotify();
  const [editError, setEditError] = useState('');
  const [cellSaving, setCellSaving] = useState(false);
  const cellSavingRef = useRef(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<{ orderId: string; x: number; y: number } | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState('');
  const [fillRange, setFillRange] = useState<{ field: EditableField; start: number; end: number } | null>(null);
  const fillDrag = useRef<{ pointerId: number; field: EditableField; source: DentalOrder; start: number; end: number; value: string } | null>(null);

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

  useEffect(() => {
    if (!createdOrder) return;
    setSelectedMonth(createdOrder.monthYear);
    setSearch('');
    setSortField('createdAt');
    setSortOrder('desc');
    setPage(1);
  }, [createdOrder?.id, createdOrder?.monthYear]);

  const catalogMaterialNames = useMemo(
    () => [...new Set(materialPrices.map(({ name }) => name.trim()).filter(Boolean))],
    [materialPrices]
  );

  const periodMaterialCount = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (selectedMonth !== 'ALL' && o.monthYear !== selectedMonth) return;
      if (o.material?.trim()) set.add(o.material.trim());
    });
    return set.size;
  }, [orders, selectedMonth]);

  const filteredOrders = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    return orders.filter((o) => {
      if (selectedMonth !== 'ALL' && o.monthYear !== selectedMonth) return false;
      if (searchLower) {
        const matchCode = o.warrantyCode?.toLowerCase().includes(searchLower);
        const matchPatient = o.patientName?.toLowerCase().includes(searchLower);
        const matchPhone = o.phone?.toLowerCase().includes(searchLower);
        const matchClinic = o.clinicName?.toLowerCase().includes(searchLower);
        const matchTeeth = o.teeth?.toLowerCase().includes(searchLower);
        const matchMat = o.material?.toLowerCase().includes(searchLower);
        const matchNotes = o.notes?.toLowerCase().includes(searchLower);
        if (
          !matchCode &&
          !matchPatient &&
          !matchPhone &&
          !matchClinic &&
          !matchTeeth &&
          !matchMat &&
          !matchNotes
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, search, selectedMonth]);

  const sortedOrders = useMemo(() => {
    if (sortField === 'default') {
      return filteredOrders;
    }
    return [...filteredOrders].sort((a, b) => {
      let comp = 0;
      if (sortField === 'createdAt') {
        comp = (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
      } else if (sortField === 'id') {
        comp = a.id.localeCompare(b.id, 'en', { numeric: true });
      } else if (sortField === 'orderDate') {
        const toVal = (dStr: string) => {
          const parts = (dStr || '').split(/[\/-]/);
          if (parts.length >= 3) {
            return (
              parseInt(parts[2], 10) * 10000 +
              parseInt(parts[1], 10) * 100 +
              parseInt(parts[0], 10)
            );
          }
          return 0;
        };
        comp = toVal(a.orderDate) - toVal(b.orderDate);
      } else if (sortField === 'teethCount') {
        comp = (a.teethCount ?? 0) - (b.teethCount ?? 0);
      } else if (sortField === 'totalAmount') {
        comp = (a.totalAmount || 0) - (b.totalAmount || 0);
      } else {
        const valA = (a[sortField] || '').toLowerCase();
        const valB = (b[sortField] || '').toLowerCase();
        comp = valA.localeCompare(valB, 'vi');
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [filteredOrders, sortField, sortOrder]);

  const totalItems = sortedOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const currentOrders = sortedOrders.slice(startIndex, startIndex + pageSize);

  const toggleSort = (field: Exclude<typeof sortField, 'default'>) => {
    setPage(1);
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setSortField('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  const handleSelectAllOnPage = () => {
    const pageIds = currentOrders.map((o) => o.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleExportInvoicePdf = () => {
    const scope = resolveOrderInvoiceExportScope({
      allOrders: orders,
      filteredOrders,
      selectedIds,
      selectedMonth,
    });
    if (scope.orders.length === 0) {
      setExportNotice('Không có đơn hàng để xuất hóa đơn PDF.');
      window.setTimeout(() => setExportNotice(''), 2500);
      return;
    }
    setExportNotice('');
    onExportInvoicePdf(scope.orders, scope.clinicName, scope.monthYear);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => onDeleteOrder(id));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  };

  const saveCell = async (order: DentalOrder, field: EditableField, raw: string, leaving: boolean) => {
    const value = raw.trim();
    const finish = () => {
      setEditingCell(null);
      setEditError('');
      setCellSaving(false);
      cellSavingRef.current = false;
    };
    const reject = (message: string) => {
      setEditError(message);
      setCellSaving(false);
      cellSavingRef.current = false;
      if (leaving) setEditingCell(null);
    };

    const original = String(order[field] ?? '');
    if (raw === original || value === original) {
      finish();
      return;
    }
    if (cellSavingRef.current) return;

    let changes: Partial<DentalOrder>;
    switch (field) {
      case 'orderDate': {
        const normalized = normalizeDdMmYyyy(value);
        if (!normalized) return reject('Nhập ngày theo định dạng DD/MM/YYYY.');
        const parsed = parseDdMmYyyy(normalized)!;
        changes = { orderDate: normalized, monthYear: formatMonthYear(parsed) };
        break;
      }
      case 'teethCount': {
        const count = Number(value);
        if (!/^\d+$/.test(value) || count < 0 || count > 64) {
          return reject('Số lượng phải là số nguyên từ 0 đến 64.');
        }
        changes = { teethCount: count };
        break;
      }
      case 'totalAmount': {
        const amount = Number(value.replace(/\./g, ''));
        if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(value) || !Number.isSafeInteger(amount)) {
          return reject('Thành tiền phải là số nguyên không âm, ví dụ 1.250.000.');
        }
        changes = { totalAmount: amount };
        break;
      }
      case 'warrantyPeriod': {
        const match = /^(\d{1,3})(?:\s*năm)?$/i.exec(value);
        if (!(match && Number(match[1]) >= 1 && Number(match[1]) <= 100) &&
            !/^(trọn đời|vĩnh viễn)$/i.test(value)) {
          return reject('Nhập thời hạn từ 1 đến 100 năm, hoặc “Trọn đời”.');
        }
        const warrantyPeriod = match ? `${Number(match[1])} năm` : value;
        changes = { warrantyPeriod, warrantyYears: extractWarrantyYears(warrantyPeriod) };
        break;
      }
      case 'clinicName': {
        changes = {
          clinicName: value,
          clinicAddress: clinicAddresses.get(value) ?? '',
        };
        break;
      }
      default:
        if (!value && field === 'patientName') return reject('Nhập tên khách hàng.');
        changes = { [field]: value };
    }

    cellSavingRef.current = true;
    setCellSaving(true);
    setEditError('');
    try {
      await onUpdateOrder({ ...order, ...changes });
      finish();
    } catch (cause) {
      const message = formatSaveError(cause);
      setEditError(message);
      notify({ tone: 'error', title: 'Chưa lưu ô đơn hàng', message, persist: true });
      setCellSaving(false);
      cellSavingRef.current = false;
      // Keep editor open so the draft value is preserved for retry.
      if (leaving) setEditingCell({ id: order.id, field });
    }
  };

  const startFill = (event: React.PointerEvent<HTMLButtonElement>, order: DentalOrder, field: EditableField) => {
    event.preventDefault();
    const start = currentOrders.findIndex((item) => item.id === order.id);
    if (start < 0) return;
    fillDrag.current = { pointerId: event.pointerId, field, source: order, start, end: start, value: String(order[field] ?? '') };
    event.currentTarget.setPointerCapture(event.pointerId);
    setFillRange({ field, start, end: start });
  };

  const moveFill = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = fillDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLTableRowElement>('tr[data-order-id]');
    const targetId = row?.dataset.orderId;
    const end = targetId ? currentOrders.findIndex((item) => item.id === targetId) : -1;
    if (end >= 0 && end !== drag.end) {
      drag.end = end;
      setFillRange({ field: drag.field, start: drag.start, end });
    }
  };

  const finishFill = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = fillDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { start, end, field, source, value } = drag;
    fillDrag.current = null;
    setFillRange(null);
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    if (low === high) return;
    void (async () => {
      for (let index = low; index <= high; index += 1) {
        if (index !== start) await saveCell(currentOrders[index], field, value, false);
      }
    })();
  };

  const renderCellEditor = (order: DentalOrder, field: EditableField, label: string, secondary = false) => {
    const raw = String(order[field] ?? '');
    const display = field === 'totalAmount' ? formatVND(order.totalAmount || 0) : raw || '—';
    const emphasized = field === 'warrantyCode' || field === 'patientName';
    if (readOnly) {
      return (
        <span
          title={raw || undefined}
          className={`box-border block h-7 w-full min-w-0 max-w-full truncate px-1.5 py-0 leading-7 ${emphasized ? 'font-bold' : ''} ${secondary ? 'text-[10px] leading-7 text-slate-500 dark:text-slate-400' : ''}`}
        >
          {display}
        </span>
      );
    }
    if (field === 'clinicName' || field === 'material') {
      const options = field === 'clinicName' ? clinicNames : catalogMaterialNames;
      return (
        <select
          aria-label={label}
          value={raw}
          title={raw || `Chọn ${label.toLowerCase()}`}
          disabled={cellSaving}
          onChange={(event) => { void saveCell(order, field, event.currentTarget.value, false); }}
          className="box-border h-7 w-full min-w-0 max-w-full cursor-pointer truncate rounded border border-slate-200 bg-white px-1.5 py-0 text-[inherit] leading-none hover:border-teal-500 focus-visible:outline-2 focus-visible:outline-teal-500 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
        >
          {!options.includes(raw) && (
            <option value={raw} disabled>{raw || `Chọn ${label.toLowerCase()}`}</option>
          )}
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }

    const isEditing = editingCell?.id === order.id && editingCell.field === field;

    if (isEditing) {
      if (field === 'orderDate') {
        return (
          <DateCellEditor
            initialValue={raw}
            label={label}
            disabled={cellSaving}
            invalid={Boolean(editError)}
            describedBy={editError ? 'order-cell-error' : undefined}
            onDraftChange={() => setEditError('')}
            onCancel={() => {
              if (cellSavingRef.current) return;
              setEditingCell(null);
              setEditError('');
            }}
            onCommit={(value, leaving) => { void saveCell(order, field, value, leaving); }}
          />
        );
      }
      return (
        <input
          autoFocus
          size={1}
          aria-label={label}
          aria-invalid={Boolean(editError)}
          aria-describedby={editError ? 'order-cell-error' : undefined}
          defaultValue={raw}
          maxLength={fieldMaxLengths[field]}
          inputMode={field === 'teethCount' || field === 'totalAmount' ? 'numeric' : undefined}
          onChange={() => setEditError('')}
          disabled={cellSaving}
          onBlur={(event) => { void saveCell(order, field, event.currentTarget.value, true); }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              void saveCell(order, field, event.currentTarget.value, false);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              if (cellSavingRef.current) return;
              setEditingCell(null);
              setEditError('');
            }
          }}
          className={`box-border h-7 w-full min-w-0 max-w-full rounded border border-teal-500 bg-white px-1.5 py-0 text-slate-900 leading-none focus:ring-2 focus:ring-teal-500/40 focus:ring-inset dark:bg-slate-900 dark:text-white ${emphasized ? 'font-bold' : ''}`}
        />
      );
    }

    return (
      <button
        type="button"
        title={raw || `Sửa ${label}`}
        aria-label={`Sửa ${label}${raw ? `: ${display}` : ''}`}
        onClick={() => {
          setEditingCell({ id: order.id, field });
          setEditError('');
        }}
        className={`group flex h-7 w-full min-w-0 max-w-full items-center gap-1 rounded border border-transparent px-1.5 py-0 text-left leading-none hover:border-teal-500 hover:bg-teal-500/10 focus-visible:outline-2 focus-visible:outline-teal-500 ${secondary ? 'text-[10px] text-slate-500 dark:text-slate-400' : ''}`}
      >
        <span className={`min-w-0 flex-1 truncate ${emphasized ? 'font-bold' : ''}`}>{display}</span>
        <Edit3 aria-hidden="true" className="size-3 shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    );
  };

  const orderSummary = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const totalTeeth = filteredOrders.reduce((s, o) => s + (o.teethCount ?? 0), 0);
    const activeClinics = new Set(
      filteredOrders.map((o) => o.clinicName?.trim()).filter(Boolean)
    ).size;
    return { totalRevenue, totalTeeth, activeClinics };
  }, [filteredOrders]);


  const closeRowMenu = () => setRowMenu(null);

  useEffect(() => {
    if (!rowMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRowMenu();
    };
    const onPointer = (event: MouseEvent | PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rowMenuRef.current?.contains(target)) return;
      closeRowMenu();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [rowMenu]);

  const openRowMenuAt = (orderId: string, clientX: number, clientY: number) => {
    if (readOnly) return;
    const pad = 8;
    const menuW = 200;
    const menuH = 140;
    const x = Math.min(clientX, window.innerWidth - menuW - pad);
    const y = Math.min(clientY, window.innerHeight - menuH - pad);
    setRowMenu({ orderId: orderId, x: Math.max(pad, x), y: Math.max(pad, y) });
  };

  const menuOrder = rowMenu ? orders.find((item) => item.id === rowMenu.orderId) : null;

  const runDuplicate = async (order: DentalOrder) => {
    if (!onDuplicateOrder || readOnly || duplicatingId) return;
    setDuplicatingId(order.id);
    closeRowMenu();
    try {
      await onDuplicateOrder(order);
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Compact Spatial Top Bar: Month Select and New Order Action */}
      <div className="bento-card month-toolbar sm:px-4 sm:py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:block relative">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <MonthFilter
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-4 py-1.5 text-xs font-mono font-bold bg-white/90 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
            >
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
              <option value="ALL">Tất cả các tháng (Toàn kỳ)</option>
            </MonthFilter>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && selectedIds.size > 0 && (
            <>
              {confirmBulkDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleBulkDelete}
                    className="px-2.5 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-xl cursor-pointer"
                  >
                    Xác nhận xóa ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => setConfirmBulkDelete(false)}
                    className="px-2 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-500/10 rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa ({selectedIds.size})
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleExportInvoicePdf}
            title="Xuất hóa đơn PDF"
            aria-label="Xuất hóa đơn PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            HĐ PDF
          </button>

          {!readOnly && (
            <button
              onClick={onNewOrder}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm đơn
            </button>
          )}
        </div>
      </div>

      {exportNotice ? (
        <p role="status" className="text-xs font-medium text-amber-700 dark:text-amber-300 px-1">
          {exportNotice}
        </p>
      ) : null}

      {/* 4 Deep Dark-Jewel KPI Cards for Orders */}
      <div className="dashboard-kpis grid min-w-0 grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Tổng Số Ca Chế Tác
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {totalItems.toLocaleString()}{' '}
              <span className="text-xs font-bold text-sky-300 uppercase">Ca</span>
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 text-sky-300 flex items-center justify-center shrink-0 relative">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border border-teal-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Tổng Sản Lượng Răng
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {orderSummary.totalTeeth.toLocaleString()}{' '}
              <span className="text-xs font-bold text-teal-300 uppercase">Răng</span>
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/25 text-teal-300 flex items-center justify-center shrink-0 relative">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 text-white border border-amber-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Nha Khoa & Dòng Sứ
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {orderSummary.activeClinics}{' '}
              <span className="text-xs font-bold text-amber-300 uppercase">NK</span> ·{' '}
              {periodMaterialCount}{' '}
              <span className="text-xs font-bold text-amber-300 uppercase">Sứ</span>
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300 flex items-center justify-center shrink-0 relative">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white border border-violet-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-violet-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block">
              Thành Tiền (Tự Nhập)
            </span>
            <div className="font-display text-2xl font-bold font-mono text-white mt-1">
              {formatVND(orderSummary.totalRevenue)}
            </div>
          </div>
          <div className="dashboard-kpi-icon w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-300 flex items-center justify-center shrink-0 relative">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Wide High-Density Table with General Search & Direct Inline Thành Tiền Input */}
      <div className="bento-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
              Danh Sách Khách Hàng & Đơn Chế Tác ({totalItems.toLocaleString()} ca · {orderSummary.totalTeeth.toLocaleString()} răng)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Sắp xếp đơn hàng theo"
              value={sortField}
              onChange={(event) => {
                setSortField(event.target.value as SortField | 'default');
                if (event.target.value === 'createdAt') setSortOrder('desc');
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="createdAt">Theo lúc thêm đơn</option>
              <option value="id">Theo ID</option>
              <option value="warrantyCode">Theo mã BH</option>
              <option value="patientName">Theo khách hàng</option>
              <option value="clinicName">Theo nha khoa</option>
              <option value="orderDate">Theo ngày</option>
              <option value="teethCount">Theo số lượng</option>
              <option value="totalAmount">Theo thành tiền</option>
              <option value="default">Thứ tự hiện tại</option>
            </select>
            {sortField !== 'default' && (
              <button type="button" onClick={() => { setSortOrder((value) => value === 'asc' ? 'desc' : 'asc'); setPage(1); }}
                aria-label={`Đang sắp xếp ${sortOrder === 'asc' ? 'tăng' : 'giảm'} dần. Bấm để đổi chiều`}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <ArrowUpDown aria-hidden="true" className="size-3.5" />
                {sortField === 'createdAt' ? (sortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước') : (sortOrder === 'asc' ? 'Tăng dần' : 'Giảm dần')}
              </button>
            )}
            <div className="relative w-64 sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm mã BH, bệnh nhân, nha khoa, dòng sứ, răng..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            {(search || sortField !== 'createdAt' || sortOrder !== 'desc') && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-600 dark:text-sky-400 font-bold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Mặc định
              </button>
            )}
          </div>
        </div>
        {cellSaving && !editError && (
          <div role="status" className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
            Đang lưu…
          </div>
        )}
        {editError && (
          <p id="order-cell-error" role="alert" className="px-4 pb-2 text-xs text-rose-700 dark:text-rose-300">
            {editError}
          </p>
        )}
        <div ref={tableScrollRef} className="overflow-x-auto" onPointerMove={moveFill} onPointerUp={finishFill} onPointerCancel={finishFill}>
          <table ref={tableRef} className="orders-table w-full min-w-[1180px] table-fixed text-left text-xs">
            <colgroup>
              {orderTableColPercents.map((widthPct, index) => (
                <col key={index} style={{ width: `${widthPct}%` }} />
              ))}
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-2.5 text-center">
                  <button
                    onClick={handleSelectAllOnPage}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    {currentOrders.length > 0 &&
                    currentOrders.every((o) => selectedIds.has(o.id)) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>
                {orderColumns.map(({ field, label, sort }) => (
                  <th
                    key={field}
                    scope="col"
                    aria-sort={sort && sortField === sort ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`overflow-hidden truncate whitespace-nowrap px-2 py-2.5 ${field === 'warrantyCode' || field === 'patientName' ? 'font-bold' : ''}`}
                  >
                    {sort ? (
                      <button type="button" onClick={() => toggleSort(sort)} className="flex items-center gap-1 rounded uppercase focus-visible:outline-2 focus-visible:outline-teal-500">
                        {label}
                        <ArrowUpDown aria-hidden="true" className="size-3 opacity-50" />
                      </button>
                    ) : label}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {currentOrders.map((order) => {
                const isChecked = selectedIds.has(order.id);
                // Soft cue for orders entered in the last hour (createdAt is epoch ms)
                const isRecent =
                  Number(order.createdAt) > 0 &&
                  Date.now() - Number(order.createdAt) < 60 * 60 * 1000;
                return (
                  <tr
                    key={order.id}
                    data-order-id={order.id}
                    onContextMenu={(event) => {
                      const target = event.target;
                      if (target instanceof HTMLElement) {
                        const tag = target.closest('input, textarea, select, button, a, [contenteditable="true"]');
                        if (tag) return;
                      }
                      if (readOnly) return;
                      event.preventDefault();
                      openRowMenuAt(order.id, event.clientX, event.clientY);
                    }}
                    className={`group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      isChecked
                        ? 'bg-teal-500/10'
                        : isRecent
                          ? 'bg-slate-100/90 dark:bg-slate-700/40 shadow-[inset_3px_0_0_0_rgba(148,163,184,0.7)] dark:shadow-[inset_3px_0_0_0_rgba(100,116,139,0.7)]'
                          : ''
                    }`}
                  >
                    <td className="py-2 px-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectOne(order.id)}
                        className="rounded text-teal-600 cursor-pointer"
                      />
                    </td>
                    {orderColumns.map(({ field, label }) => (
                      <td key={field} className={`min-w-0 overflow-hidden px-1 py-1 text-slate-700 dark:text-slate-200 ${fillRange?.field === field && currentOrders.findIndex((item) => item.id === order.id) >= Math.min(fillRange.start, fillRange.end) && currentOrders.findIndex((item) => item.id === order.id) <= Math.max(fillRange.start, fillRange.end) ? 'bg-teal-100/70 dark:bg-teal-900/30' : ''}`}>
                        <div className="group/fill relative min-w-0 max-w-full">
                          {renderCellEditor(order, field, label)}
                          {!readOnly && !(editingCell?.id === order.id && editingCell.field === field) && <button type="button" aria-label={`Kéo để sao chép ${label}`} title="Kéo để sao chép xuống" onPointerDown={(event) => startFill(event, order, field)} className="pointer-events-none absolute bottom-0 right-0 z-10 size-3 cursor-crosshair touch-none rounded-sm border border-white bg-teal-600 opacity-0 shadow-sm group-hover/fill:pointer-events-auto group-hover/fill:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100" />}
                        </div>
                        {field === 'patientName' && (order.phone || editingCell?.field === 'phone' && editingCell.id === order.id) &&
                          renderCellEditor(order, 'phone', 'Số điện thoại', true)}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {!readOnly && (
                          <button
                            type="button"
                            title="Thêm thao tác"
                            aria-label="Thêm thao tác dòng"
                            aria-haspopup="menu"
                            aria-expanded={rowMenu?.orderId === order.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              const rect = event.currentTarget.getBoundingClientRect();
                              openRowMenuAt(order.id, rect.left, rect.bottom + 4);
                            }}
                            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onViewWarranty(order)}
                          title="Thẻ Bảo Hành"
                          className="p-1 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 rounded cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onPrintTicket(order)}
                          title="Phiếu Labo"
                          className="p-1 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 rounded cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {!readOnly && (
                          <>
                            <button
                              onClick={() => onEditOrder(order)}
                              title="Sửa"
                              className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteId === order.id ? (
                              <button
                                onClick={() => {
                                  onDeleteOrder(order.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded cursor-pointer"
                              >
                                Xóa?
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(order.id)}
                                title="Xóa"
                                className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Compact Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-semibold"
            >
              <option value={25}>25 / trang</option>
              <option value={50}>50 / trang</option>
              <option value={100}>100 / trang</option>
              <option value={200}>200 / trang</option>
            </select>
            <span className="font-mono">
              {totalItems > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + pageSize, totalItems)} / {totalItems}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2.5 font-mono font-bold text-slate-800 dark:text-white">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {rowMenu && menuOrder && !readOnly && (
        <div
          ref={rowMenuRef}
          role="menu"
          aria-label="Thao tác dòng đơn hàng"
          className="fixed z-[90] min-w-[11.5rem] overflow-hidden rounded-[10px] border border-slate-200 bg-white py-1 text-sm shadow-[0_12px_32px_-12px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900"
          style={{ left: rowMenu.x, top: rowMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(duplicatingId)}
            onClick={() => { void runDuplicate(menuOrder); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {duplicatingId === menuOrder.id ? 'Đang nhân đôi…' : 'Nhân đôi dòng'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { closeRowMenu(); onEditOrder(menuOrder); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Sửa đơn
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void (async () => {
                closeRowMenu();
                const ok = await confirm({
                  title: 'Xóa đơn hàng?',
                  message: `Xóa đơn ${menuOrder.warrantyCode || ''} — ${menuOrder.patientName || ''}? Thao tác không hoàn tác từ đây.`,
                  confirmLabel: 'Xóa',
                  cancelLabel: 'Hủy',
                  danger: true,
                });
                if (ok) onDeleteOrder(menuOrder.id);
              })();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Xóa dòng
          </button>
        </div>
      )}
      {!readOnly && (
        <QuickOrderEntry columns={orderColumns} materials={catalogMaterialNames}
          tableRef={tableRef} tableScrollRef={tableScrollRef}
          materialPrices={materialPrices}
          clinicMaterialPrices={clinicMaterialPrices}
          clinics={clinicNames.map((name) => ({
            name,
            address: clinicAddresses.get(name) ?? '',
          }))}
          onAdd={async (data) => {
            const created = await onQuickAdd(data);
            setSelectedMonth(created.monthYear);
            setSearch('');
            setSortField('createdAt');
            setSortOrder('desc');
            setPage(1);
            return created;
          }} />
      )}
    </div>
  );
};
