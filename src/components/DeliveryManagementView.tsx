import React, { useState, useMemo, useRef } from 'react';
import { DeliveryRecord, DentalOrder } from '../types/dental';
import { formatVND, extractMonthYear, sortMonthYearsDesc } from '../utils/financeUtils';
import {
  Truck,
  Plus,
  Search,
  Building2,
  Trash2,
  X,
  Edit3,
} from 'lucide-react';

interface DeliveryManagementViewProps {
  deliveries: DeliveryRecord[];
  readOnly?: boolean;
  orders: DentalOrder[];
  availableMonths: string[];
  onAddDelivery: (deliv: Omit<DeliveryRecord, 'id' | 'createdAt'>) => void;
  partnerClinics: { name: string; address: string }[];
  onUpdateDelivery: (id: string, changes: Partial<DeliveryRecord>) => Promise<void>;
  onDeleteDelivery: (id: string) => void;
}

type EditableDeliveryField = 'trackingCode' | 'deliveryDate' | 'warrantyCode' | 'patientName' |
  'clinicName' | 'clinicAddress' | 'direction' | 'courierName' | 'payer' | 'shippingFee' | 'notes' | 'status';

const deliveryChoices = {
  direction: [{ value: '', label: 'Không' }, { value: 'pickup', label: 'Nhận mẫu' }, { value: 'delivery', label: 'Giao răng' }, { value: 'both', label: 'Khứ hồi' }],
  payer: [{ value: '', label: 'Không' }, { value: 'lab', label: 'Labo' }, { value: 'clinic', label: 'Nha khoa' }],
  status: [{ value: '', label: 'Không' }, { value: 'pending', label: 'Chờ xử lý' }, { value: 'shipping', label: 'Đang giao' }, { value: 'delivered', label: 'Đã giao' }, { value: 'returned', label: 'Hoàn trả' }],
};

const deliveryMaxLengths: Partial<Record<EditableDeliveryField, number>> = {
  trackingCode: 150, warrantyCode: 64, patientName: 200, clinicAddress: 300, courierName: 150, notes: 500,
};

const COURIER_OPTIONS = [
  'Shipper Nội Bộ AT Lab',
  'GrabExpress Nội Thành ĐN',
  'Xe khách Chín Nghĩa (Tuyến Quảng Ngãi)',
  'Xe khách Trung Tín / ViettelPost (Quảng Bình)',
  'GrabExpress Liên Tỉnh / Xe tuyến',
  'Ahamove / Giao Hàng Nhanh',
];

export const DeliveryManagementView: React.FC<DeliveryManagementViewProps> = ({
  deliveries,
  readOnly = false,
  orders,
  availableMonths,
  onAddDelivery,
  onUpdateDelivery,
  partnerClinics,
  onDeleteDelivery,
}) => {
  const latestMonth =
    availableMonths.find((m) => m === '11/2026') || availableMonths[0] || '11/2026';

  const [selectedMonth, setSelectedMonth] = useState<string>(latestMonth);
  const [selectedClinic, setSelectedClinic] = useState<string>('');
  const [selectedCourier, setSelectedCourier] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [editingCell, setEditingCell] = useState<{ id: string; field: EditableDeliveryField } | null>(null);
  const [draft, setDraft] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const [cellError, setCellError] = useState('');
  const saving = useRef(false);
  const cancelled = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formPatient, setFormPatient] = useState('');
  const [formClinic, setFormClinic] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formDate, setFormDate] = useState(`25/${latestMonth}`);
  const [formDirection, setFormDirection] =
    useState<DeliveryRecord['direction']>('delivery');
  const [formCourier, setFormCourier] = useState(COURIER_OPTIONS[0]);
  const [formFee, setFormFee] = useState<number>(30000);
  const [formPayer, setFormPayer] = useState<'lab' | 'clinic'>('lab');
  const [formNotes, setFormNotes] = useState('');

  const deliveryMonths = useMemo(() => sortMonthYearsDesc(Array.from(new Set([
    '11/2026', '10/2026', ...availableMonths, ...deliveries.map(({ monthYear }) => monthYear).filter(Boolean),
  ]))), [availableMonths, deliveries]);

  const courierOptions = useMemo(() => Array.from(new Set([
    ...COURIER_OPTIONS, ...deliveries.map(({ courierName }) => courierName).filter(Boolean),
  ])), [deliveries]);

  const clinicOptions = useMemo(() => {
    const set = new Set(partnerClinics.map(({ name }) => name));
    orders.forEach((o) => {
      if (o.clinicName?.trim()) set.add(o.clinicName.trim());
    });
    deliveries.forEach((d) => {
      if (d.clinicName?.trim()) set.add(d.clinicName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [orders, deliveries, partnerClinics]);

  const filteredDeliveries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return deliveries.filter((d) => {
      if (selectedMonth !== 'ALL' && d.monthYear !== selectedMonth) return false;
      if (selectedClinic && d.clinicName !== selectedClinic) return false;
      if (selectedCourier && d.courierName !== selectedCourier) return false;
      if (q) {
        const matchCode = d.warrantyCode.toLowerCase().includes(q);
        const matchPat = d.patientName.toLowerCase().includes(q);
        const matchClinic = d.clinicName.toLowerCase().includes(q);
        const matchNotes = (d.notes || '').toLowerCase().includes(q);
        const matchTrack = (d.trackingCode || '').toLowerCase().includes(q);
        if (!matchCode && !matchPat && !matchClinic && !matchTrack && !matchNotes) return false;
      }
      return true;
    });
  }, [deliveries, selectedMonth, selectedClinic, selectedCourier, searchQuery]);

  const deliveryStats = useMemo(() => {
    const totalFee = filteredDeliveries.reduce(
      (s, d) => s + (d.shippingFee || 0),
      0
    );
    const labPaidFee = filteredDeliveries
      .filter((d) => d.payer === 'lab')
      .reduce((s, d) => s + (d.shippingFee || 0), 0);
    const clinicPaidFee = filteredDeliveries
      .filter((d) => d.payer === 'clinic')
      .reduce((s, d) => s + (d.shippingFee || 0), 0);

    const courierMap = new Map<string, { trips: number; totalFee: number }>();
    filteredDeliveries.forEach((d) => {
      const c = d.courierName || 'Shipper Labo';
      if (!courierMap.has(c)) {
        courierMap.set(c, { trips: 0, totalFee: 0 });
      }
      const item = courierMap.get(c)!;
      item.trips += 1;
      item.totalFee += d.shippingFee || 0;
    });

    const clinicMap = new Map<string, { trips: number; totalFee: number }>();
    filteredDeliveries.forEach((d) => {
      const c = d.clinicName || 'Nha Khoa';
      if (!clinicMap.has(c)) {
        clinicMap.set(c, { trips: 0, totalFee: 0 });
      }
      const item = clinicMap.get(c)!;
      item.trips += 1;
      item.totalFee += d.shippingFee || 0;
    });

    return {
      totalFee,
      labPaidFee,
      clinicPaidFee,
      byCourier: Array.from(courierMap.entries()).sort(
        (a, b) => b[1].totalFee - a[1].totalFee
      ),
      byClinic: Array.from(clinicMap.entries()).sort(
        (a, b) => b[1].totalFee - a[1].totalFee
      ),
    };
  }, [filteredDeliveries]);

  const handleOpenAddModal = () => {
    setFormCode(`AT${Math.floor(10000 + Math.random() * 90000)}`);
    setFormPatient('');
    setFormClinic(clinicOptions[0] || 'Nha Khoa Tâm An');
    setFormAddress('211 Huỳnh Tấn Phát, Đà Nẵng');
    setFormDate(`26/${selectedMonth === 'ALL' ? latestMonth : selectedMonth}`);
    setFormDirection('delivery');
    setFormCourier(COURIER_OPTIONS[0]);
    setFormFee(30000);
    setFormPayer('lab');
    setFormNotes('Giao phục hình sứ');
    setModalOpen(true);
  };

  const handleCreateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClinic.trim()) return;

    onAddDelivery({
      warrantyCode: formCode.trim() || 'AT-SHIP',
      patientName: formPatient.trim() || 'Mẫu hàm Nha khoa',
      clinicName: formClinic.trim(),
      clinicAddress: formAddress.trim() || 'Đà Nẵng',
      deliveryDate: formDate.trim(),
      monthYear: extractMonthYear(formDate),
      direction: formDirection,
      courierName: formCourier,
      trackingCode: `GH${Math.floor(10000 + Math.random() * 89999)}`,
      shippingFee: Number(formFee) || 0,
      payer: formPayer,
      status: 'delivered',
      notes: formNotes.trim(),
    });
    setModalOpen(false);
  };

  const saveCell = async (record: DeliveryRecord, field: EditableDeliveryField, raw: string) => {
    if (saving.current || cancelled.current) return;
    const value = raw.trim();
    if (value === String(record[field] ?? '')) {
      setEditingCell(null);
      setCellError('');
      return;
    }
    let changes: Partial<DeliveryRecord> = { [field]: value };
    if (field === 'shippingFee') {
      const amount = Number(value.replace(/\./g, ''));
      if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(value) || !Number.isSafeInteger(amount)) {
        setCellError('Tiền ship phải là số nguyên không âm, ví dụ 23.500.');
        return;
      }
      changes = { shippingFee: amount };
    }
    if (field === 'deliveryDate' && value) {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
      const iso = match && `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      const date = iso ? new Date(iso) : new Date(NaN);
      if (!iso || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== iso) {
        setCellError('Nhập ngày hợp lệ theo định dạng DD/MM/YYYY.');
        return;
      }
      changes = { deliveryDate: iso.split('-').reverse().join('/'), monthYear: iso.slice(5, 7) + '/' + iso.slice(0, 4) };
    }
    if (field === 'clinicName') {
      const partner = partnerClinics.find(({ name }) => name === value);
      changes.clinicAddress = partner?.address || orders.find((order) =>
        order.clinicName.trim() === value && order.clinicAddress.trim()
      )?.clinicAddress || '';
    }
    saving.current = true;
    setSavingCell(true);
    setCellError('');
    try {
      await onUpdateDelivery(record.id, changes);
      setEditingCell(null);
    } catch (error) {
      setCellError(error instanceof Error ? error.message : 'Chưa lưu được thay đổi. Vui lòng thử lại.');
    } finally {
      saving.current = false;
      setSavingCell(false);
    }
  };

  const renderEditableCell = (record: DeliveryRecord, field: EditableDeliveryField, label: string, secondary = false) => {
    const options = field === 'clinicName'
      ? [{ value: '', label: 'Không' }, ...clinicOptions.map((name) => ({ value: name, label: name }))]
      : deliveryChoices[field as keyof typeof deliveryChoices];
    const value = String(record[field] ?? '');
    const display = field === 'shippingFee' ? formatVND(record.shippingFee) : options?.find((option) => option.value === value)?.label || value || '—';
    const isAmount = field === 'shippingFee';
    const statusTone = field === 'status' ? {
      '': '',
      pending: 'text-amber-700 dark:text-amber-400',
      shipping: 'text-blue-700 dark:text-blue-400',
      delivered: 'text-emerald-700 dark:text-emerald-400',
      returned: 'text-rose-700 dark:text-rose-400',
    }[record.status] || '' : '';
    const active = editingCell?.id === record.id && editingCell.field === field;
    if (readOnly) {
      return (
        <span
          title={value || undefined}
          className={`block w-full min-w-0 truncate px-1.5 ${secondary ? 'min-h-6 py-0.5 text-[11px]' : 'min-h-8 py-1'} ${isAmount ? 'text-right tabular-nums' : ''} ${field === 'status' ? 'font-medium' : ''} ${statusTone}`}
        >
          {display}
        </span>
      );
    }
    if (!active) {
      return (
        <button type="button" aria-label={`Sửa ${label}`} title={value || label}
          disabled={savingCell}
          onClick={() => {
            if (saving.current) return;
            cancelled.current = false;
            setEditingCell({ id: record.id, field });
            setDraft(value);
            setCellError('');
          }}
          className={`group flex w-full min-w-0 items-center gap-1 rounded-md border border-transparent px-1.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-teal-500 disabled:opacity-60 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 ${secondary ? 'min-h-6 py-0.5 text-[11px]' : 'min-h-8 py-1'} ${statusTone}`}>
          <span className={`min-w-0 flex-1 truncate ${isAmount ? 'text-right tabular-nums' : ''} ${field === 'status' ? 'font-medium' : ''}`}>{display}</span>
          {!['shippingFee', 'deliveryDate', 'direction', 'payer', 'status'].includes(field) && <Edit3 aria-hidden="true" className="size-3 shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />}
        </button>
      );
    }
    const inputClass = `w-full min-w-0 rounded-md border border-teal-500 bg-white px-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:bg-slate-900 dark:text-white ${secondary ? 'min-h-6 py-0.5 text-[11px]' : 'min-h-8 py-1'} ${isAmount ? 'text-right tabular-nums' : ''}`;
    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelled.current = true;
        setEditingCell(null);
        setCellError('');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void saveCell(record, field, event.currentTarget.value);
      }
    };
    return (
      <div>
        {options ? (
          <select autoFocus aria-label={label} disabled={savingCell} value={draft} className={inputClass}
            onChange={(event) => {
              setDraft(event.target.value);
              void saveCell(record, field, event.target.value);
            }}
            onKeyDown={onKeyDown} onBlur={(event) => { void saveCell(record, field, event.currentTarget.value); }}>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : (
          <input autoFocus aria-label={label} disabled={savingCell} value={draft}
            maxLength={deliveryMaxLengths[field]}
            aria-invalid={Boolean(cellError)} aria-describedby={cellError ? 'delivery-cell-error' : undefined}
            inputMode={field === 'shippingFee' ? 'numeric' : undefined}
            onChange={(event) => { setDraft(event.target.value); setCellError(''); }}
            onBlur={(event) => { void saveCell(record, field, event.currentTarget.value); }}
            onKeyDown={onKeyDown} className={inputClass} />
        )}
        {savingCell && <span role="status" className="text-xs text-slate-500">Đang lưu…</span>}
        {cellError && <p id="delivery-cell-error" role="alert" className="mt-1 max-w-64 whitespace-normal text-xs font-normal text-rose-600">{cellError}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Compact Single-Row Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white cursor-pointer"
          >
            {deliveryMonths.map((m) => (
              <option key={m} value={m}>
                Tháng {m}{m === latestMonth ? ' (Tháng này)' : ''}
              </option>
            ))}
            <option value="ALL">Tất cả tháng ({deliveries.length})</option>
          </select>

          <select
            value={selectedClinic}
            onChange={(e) => setSelectedClinic(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 cursor-pointer max-w-[200px]"
          >
            <option value="">Tất cả Nha khoa</option>
            {clinicOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedCourier}
            onChange={(e) => setSelectedCourier(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 cursor-pointer max-w-[200px]"
          >
            <option value="">Tất cả đơn vị vận chuyển</option>
            {courierOptions.map((c) => (
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
              placeholder="Mã vận đơn, bệnh nhân..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {!readOnly && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo Chuyến Ship
          </button>
        )}
      </div>

      {/* 4 Deep Dark-Jewel KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block relative">
            Tổng Tiền Giao Vận
          </span>
          <div className="font-display text-2xl font-bold font-mono text-white mt-1 relative">
            {formatVND(deliveryStats.totalFee)}
          </div>
          <span className="text-[11px] text-sky-300/90 font-mono mt-1 relative">
            {filteredDeliveries.length} chuyến
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border border-teal-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block relative">
            Labo Trả Phí
          </span>
          <div className="font-display text-2xl font-bold font-mono text-teal-300 mt-1 relative">
            {formatVND(deliveryStats.labPaidFee)}
          </div>
          <span className="text-[11px] text-slate-300/80 font-mono mt-1 relative">
            Chi phí vận hành Labo
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 text-white border border-amber-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block relative">
            Nha Khoa Chịu Phí
          </span>
          <div className="font-display text-2xl font-bold font-mono text-amber-300 mt-1 relative">
            {formatVND(deliveryStats.clinicPaidFee)}
          </div>
          <span className="text-[11px] text-slate-300/80 font-mono mt-1 relative">
            Đối tác thanh toán
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white border border-violet-500/25 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-violet-500/15 blur-2xl pointer-events-none" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300/85 block relative">
            Cước TB / Chuyến
          </span>
          <div className="font-display text-2xl font-bold font-mono text-white mt-1 relative">
            {formatVND(
              filteredDeliveries.length > 0
                ? Math.round(deliveryStats.totalFee / filteredDeliveries.length)
                : 0
            )}
          </div>
          <span className="text-[11px] text-violet-300/90 font-mono mt-1 relative">
            Bình quân cước giao nhận
          </span>
        </div>
      </div>

      {/* Full-width trips table, followed by compact summaries. */}
      <div className="min-w-0 space-y-4">
        <div className="min-w-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800 sm:px-4">
            <Truck aria-hidden="true" className="size-4 text-teal-600 dark:text-teal-400" />
            <h3 className="font-semibold text-xs text-slate-900 dark:text-white">
              Chuyến giao nhận
            </h3>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">{filteredDeliveries.length}</span>
          </div>

          <div role="region" aria-label="Danh sách giao vận" tabIndex={0} className="max-h-[65vh] overflow-auto overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-500">
            <table className="w-full min-w-[1200px] table-fixed text-left text-xs text-slate-700 dark:text-slate-200">
              <colgroup>
                {[9, 8, 13, 15, 7, 12, 6, 9, 9, 8, 4].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2.5">
                <tr>
                  <th scope="col">Vận đơn</th>
                  <th scope="col">Ngày</th>
                  <th scope="col">Mã BH / KH</th>
                  <th scope="col">Nha khoa</th>
                  <th scope="col">Chiều</th>
                  <th scope="col">Đơn vị ship</th>
                  <th scope="col">Trả phí</th>
                  <th scope="col" className="text-right">Tiền ship</th>
                  <th scope="col">Ghi chú</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredDeliveries.map((d) => (
                  <tr
                    key={d.id}
                    className="transition-colors odd:bg-white even:bg-slate-50/50 hover:bg-blue-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-950/30 dark:hover:bg-slate-800/70 [&_td]:px-1.5 [&_td]:py-1 [&_td]:align-middle"
                  >
                    <td className="font-mono text-[11px] font-semibold">
                      {renderEditableCell(d, 'trackingCode', 'Vận đơn')}
                    </td>
                    <td className="whitespace-nowrap text-[11px] tabular-nums">
                      {renderEditableCell(d, 'deliveryDate', 'Ngày')}
                    </td>
                    <td>
                      <div className="font-semibold text-teal-700 dark:text-teal-400">{renderEditableCell(d, 'warrantyCode', 'Mã BH')}</div>
                      {renderEditableCell(d, 'patientName', 'Bệnh nhân', true)}
                    </td>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{renderEditableCell(d, 'clinicName', 'Nha khoa')}</div>
                      <div className="text-slate-500 dark:text-slate-400">{renderEditableCell(d, 'clinicAddress', 'Địa chỉ', true)}</div>
                    </td>
                    <td>{renderEditableCell(d, 'direction', 'Chiều')}</td>
                    <td>{renderEditableCell(d, 'courierName', 'Đơn vị ship')}</td>
                    <td>{renderEditableCell(d, 'payer', 'Trả phí')}</td>
                    <td className="font-semibold">{renderEditableCell(d, 'shippingFee', 'Tiền ship')}</td>
                    <td>{renderEditableCell(d, 'notes', 'Ghi chú')}</td>
                    <td>{renderEditableCell(d, 'status', 'Trạng thái')}</td>
                    <td className="text-center">
                      {!readOnly && (
                        <button
                          onClick={() => onDeleteDelivery(d.id)}
                          disabled={savingCell}
                          aria-label="Xóa chuyến giao nhận"
                          className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-rose-500 disabled:opacity-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredDeliveries.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">Không có chuyến giao vận phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown by courier and clinic. */}
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
              Theo Đơn Vị Vận Chuyển
            </h3>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {deliveryStats.byCourier.map(([courier, info]) => (
                <div
                  key={courier}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {courier}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="text-slate-400 text-[11px]">{info.trips}c</span>
                    <span className="font-bold text-teal-700 dark:text-teal-400">
                      {formatVND(info.totalFee)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
              Theo Nha Khoa
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {deliveryStats.byClinic.slice(0, 7).map(([clinic, info]) => (
                <div
                  key={clinic}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {clinic}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="text-slate-400 text-[11px]">{info.trips}c</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatVND(info.totalFee)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Delivery Trip Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-sm">Tạo Chuyến Giao Vận</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Nha Khoa *
                  </label>
                  <select
                    value={formClinic}
                    onChange={(e) => setFormClinic(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {clinicOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Địa Chỉ
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Mã Đơn
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Bệnh Nhân / Gói Hàng
                  </label>
                  <input
                    type="text"
                    value={formPatient}
                    onChange={(e) => setFormPatient(e.target.value)}
                    placeholder="Tên bệnh nhân..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Đơn Vị Ship *
                  </label>
                  <select
                    value={formCourier}
                    onChange={(e) => setFormCourier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {courierOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Chiều Ship
                  </label>
                  <select
                    value={formDirection}
                    onChange={(e) =>
                      setFormDirection(e.target.value as DeliveryRecord['direction'])
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="delivery">Giao răng hoàn thiện</option>
                    <option value="pickup">Nhận mẫu hàm</option>
                    <option value="both">Khứ hồi</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Tiền Ship *
                  </label>
                  <input
                    type="number"
                    required
                    step={5000}
                    value={formFee}
                    onChange={(e) => setFormFee(Number(e.target.value))}
                    className="w-full px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold bg-white dark:bg-slate-950 text-teal-700 dark:text-teal-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Trả Phí
                  </label>
                  <select
                    value={formPayer}
                    onChange={(e) => setFormPayer(e.target.value as 'lab' | 'clinic')}
                    className="w-full px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="lab">Labo trả</option>
                    <option value="clinic">Nha khoa</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Ngày
                  </label>
                  <input
                    type="text"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
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
                  Lưu Chuyến
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
