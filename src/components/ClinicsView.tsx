import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DentalOrder, ClinicSummary, ClinicPartner } from '../types/dental';
import { formatVND, sortMonthYearsDesc, getPreviousMonthYear } from '../utils/financeUtils';
import { normalizeClinicName } from '../utils/debtLedger';
import { buildClinicPartnerIndex } from '../utils/clinicPartners';
import { Search, ArrowRight, FileDown, Plus, Calendar, Pencil, Trash2, Loader2 } from 'lucide-react';

interface ClinicsViewProps {
  orders: DentalOrder[];
  readOnly?: boolean;
  partners: ClinicPartner[];
  onAddPartner: (partner: ClinicPartner) => Promise<void>;
  onUpdatePartner: (originalName: string, partner: ClinicPartner) => Promise<void>;
  onDeletePartner: (clinicName: string) => Promise<void>;
  onSelectClinicFilter: (clinicName: string, monthYear?: string) => void;
  onExportClinicInvoice?: (clinicOrders: DentalOrder[], clinicName: string, monthYear?: string) => void;
}

type ClinicRow = ClinicSummary & { orders: DentalOrder[]; discountPercent: number };
const emptyDraft = { name: '', address: '', phone: '', discountPercent: '0' };
const saveError = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export const ClinicsView: React.FC<ClinicsViewProps> = ({
  orders, readOnly = false, partners, onAddPartner, onUpdatePartner, onDeletePartner,
  onSelectClinicFilter, onExportClinicInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [originalName, setOriginalName] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState('');
  const [discountError, setDiscountError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const availableMonths = useMemo(() => sortMonthYearsDesc(
    Array.from(new Set(orders.map((order) => order.monthYear).filter(Boolean)))
  ), [orders]);
  const latestMonth = availableMonths.find((m) => m === '11/2026') || availableMonths[0] || '11/2026';
  const prevMonthOfLatest = getPreviousMonthYear(latestMonth);
  const [selectedMonth, setSelectedMonth] = useState(latestMonth);

  useEffect(() => {
    if (selectedMonth !== 'ALL' && availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(latestMonth);
    }
  }, [availableMonths, latestMonth, selectedMonth]);

  useEffect(() => {
    if (formOpen) nameInputRef.current?.focus();
  }, [formOpen, originalName]);

  const partnerByAlias = useMemo(() => buildClinicPartnerIndex(partners), [partners]);

  const knownClinicMeta = useMemo(() => {
    const meta = new Map<string, {
      name: string; address: string; phone: string; hasAnyOrder: boolean;
      discountPercent: number; partner?: ClinicPartner;
    }>();
    for (const order of orders) {
      const sourceName = order.clinicName?.trim();
      if (!sourceName) continue;
      const partner = partnerByAlias.get(normalizeClinicName(sourceName));
      if (partner?.archived) continue;
      const name = partner?.name || sourceName;
      const key = normalizeClinicName(name);
      const current = meta.get(key) || {
        name, address: '', phone: '', hasAnyOrder: false, discountPercent: 0,
      };
      current.hasAnyOrder = true;
      if (order.clinicAddress?.trim() && (!current.address || current.address === 'Đà Nẵng')) {
        current.address = order.clinicAddress.trim();
      }
      if (order.phone?.trim() && !current.phone) current.phone = order.phone.trim();
      meta.set(key, current);
    }
    for (const partner of new Set(partnerByAlias.values())) {
      if (partner.archived) continue;
      const key = normalizeClinicName(partner.name);
      if (!key) continue;
      meta.set(key, {
        name: partner.name,
        address: partner.address?.trim() || '',
        phone: partner.phone?.trim() || '',
        hasAnyOrder: meta.get(key)?.hasAnyOrder || false,
        discountPercent: partner.discountPercent ?? 0,
        partner,
      });
    }
    return meta;
  }, [orders, partnerByAlias]);

  const periodOrders = useMemo(() => selectedMonth === 'ALL'
    ? orders : orders.filter((order) => order.monthYear === selectedMonth), [orders, selectedMonth]);

  const clinicSummaries = useMemo(() => {
    const map = new Map<string, ClinicRow & { materials: Map<string, number> }>();
    const addClinic = (key: string, name: string) => {
      const meta = knownClinicMeta.get(key);
      const row = {
        name: meta?.name || name, address: meta?.address || '', phone: meta?.phone || '',
        discountPercent: meta?.discountPercent ?? 0,
        totalOrders: 0, totalTeeth: 0, totalRevenue: 0, topMaterial: '',
        lastOrderDate: '', orders: [] as DentalOrder[], materials: new Map<string, number>(),
      };
      map.set(key, row);
      return row;
    };
    for (const order of periodOrders) {
      const sourceName = order.clinicName?.trim() || 'Nha Khoa Khác';
      const partner = partnerByAlias.get(normalizeClinicName(sourceName));
      if (partner?.archived) continue;
      const name = partner?.name || sourceName;
      const key = normalizeClinicName(name);
      const item = map.get(key) || addClinic(key, name);
      item.totalOrders++;
      item.totalTeeth += order.teethCount ?? 1;
      item.totalRevenue += order.totalAmount || 0;
      item.orders.push(order);
      item.lastOrderDate ||= order.orderDate || '';
      const material = order.material || 'Zirconia';
      item.materials.set(material, (item.materials.get(material) || 0) + 1);
    }
    for (const [key, meta] of knownClinicMeta) {
      if (meta.partner && !map.has(key) && (selectedMonth === 'ALL' || !meta.hasAnyOrder)) {
        addClinic(key, meta.name);
      }
    }
    return Array.from(map.values(), ({ materials, ...row }) => {
      let topMaterial = 'Zirconia';
      let maxCount = 0;
      for (const [material, count] of materials) {
        if (count > maxCount) { maxCount = count; topMaterial = material; }
      }
      return { ...row, topMaterial };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue || a.name.localeCompare(b.name, 'vi'));
  }, [periodOrders, partnerByAlias, knownClinicMeta, selectedMonth]);

  const filteredClinics = useMemo(() => {
    const term = searchTerm.toLocaleLowerCase('vi').trim();
    return clinicSummaries.filter((clinic) => !term ||
      [clinic.name, clinic.address, clinic.phone, clinic.topMaterial]
        .some((value) => value.toLocaleLowerCase('vi').includes(term)));
  }, [clinicSummaries, searchTerm]);

  const periodTotals = useMemo(() => filteredClinics.reduce((acc, clinic) => ({
    orders: acc.orders + clinic.totalOrders,
    teeth: acc.teeth + clinic.totalTeeth,
    revenue: acc.revenue + clinic.totalRevenue,
  }), { orders: 0, teeth: 0, revenue: 0 }), [filteredClinics]);

  const beginForm = (clinic?: ClinicRow) => {
    if (pending.current) return;
    setOriginalName(clinic?.name ?? null);
    setDraft(clinic ? {
      name: clinic.name, address: clinic.address, phone: clinic.phone,
      discountPercent: String(clinic.discountPercent),
    } : { ...emptyDraft });
    setError(''); setDiscountError(''); setNotice(''); setDeleteTarget(null); setDeleteError('');
    setFormOpen(true);
    formRef.current?.scrollIntoView({ block: 'nearest' });
    nameInputRef.current?.focus();
  };

  const validateDiscount = () => {
    const value = draft.discountPercent.trim() === '' ? 0 : Number(draft.discountPercent);
    const valid = Number.isFinite(value) && value >= 0 && value <= 100 &&
      Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
    setDiscountError(valid ? '' : 'Nhập chiết khấu từ 0 đến 100%, tối đa 2 số thập phân.');
    return valid ? Math.round(value * 100) / 100 : null;
  };

  const submitPartner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || pending.current) return;
    const name = draft.name.trim().normalize('NFC').replace(/\s+/g, ' ');
    if (!name) { setError('Nhập tên nha khoa.'); nameInputRef.current?.focus(); return; }
    const key = normalizeClinicName(name);
    const originalKey = originalName ? normalizeClinicName(originalName) : '';
    const originalPartner = originalName ? partnerByAlias.get(originalKey) : undefined;
    const candidatePartner = partnerByAlias.get(key);
    const isOriginalAlias = !!originalName && (key === originalKey ||
      (originalPartner !== undefined && candidatePartner === originalPartner));
    if (!isOriginalAlias && (knownClinicMeta.has(key) || (candidatePartner && !candidatePartner.archived))) {
      setError('Nha khoa này đã có trong danh sách.'); nameInputRef.current?.focus(); return;
    }
    const discountPercent = validateDiscount();
    if (discountPercent === null) return;
    pending.current = true; setSaving(true); setError('');
    try {
      const nextPartner: ClinicPartner = {
        name, address: draft.address.trim(), phone: draft.phone.trim(), discountPercent,
      };
      if (originalName) await onUpdatePartner(originalName, nextPartner);
      else await onAddPartner(nextPartner);
      setFormOpen(false); setSearchTerm('');
      setNotice(originalName ? 'Đã cập nhật đối tác.' : 'Đã thêm đối tác.');
    } catch (cause) {
      setError(saveError(cause, 'Không lưu được đối tác lên Firestore. Vui lòng thử lại.'));
    } finally { pending.current = false; setSaving(false); }
  };

  const deletePartner = async () => {
    if (readOnly || !deleteTarget || pending.current) return;
    pending.current = true; setSaving(true); setDeleteError('');
    try {
      await onDeletePartner(deleteTarget);
      if (originalName === deleteTarget) setFormOpen(false);
      setDeleteTarget(null); setNotice('Đã xóa đối tác khỏi danh sách.');
    } catch (cause) {
      setDeleteError(saveError(cause, 'Không xóa được đối tác trên Firestore. Vui lòng thử lại.'));
    } finally { pending.current = false; setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold">Đối tác Nha khoa ({filteredClinics.length})</h2>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <select aria-label="Lọc theo tháng" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="min-h-11 cursor-pointer rounded-lg border border-slate-300 bg-slate-50/80 py-1.5 pl-8 pr-4 font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              {availableMonths.map((month) => <option key={month} value={month}>Kỳ Tháng {month}{month === latestMonth ? ' (Tháng này)' : month === prevMonthOfLatest ? ' (Tháng trước)' : ''}</option>)}
              <option value="ALL">Tất cả các tháng (Toàn kỳ)</option>
            </select>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Tổng: <strong className="font-mono text-slate-800 dark:text-slate-200">{periodTotals.orders}</strong> ca ·{' '}
            <strong className="font-mono text-slate-800 dark:text-slate-200">{periodTotals.teeth}</strong> răng ·{' '}
            <strong className="font-mono text-teal-700 dark:text-teal-300">{formatVND(periodTotals.revenue)}</strong>
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input aria-label="Tìm đối tác" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm nha khoa, địa chỉ, SĐT…"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-transparent py-2 pl-8 pr-2 text-sm focus:ring-2 focus:ring-teal-500 sm:text-xs dark:border-slate-700" />
          </label>
          {!readOnly && <button type="button" aria-expanded={formOpen && !originalName} disabled={saving} onClick={() => beginForm()}
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">
            <Plus className="size-4" aria-hidden="true" /> Thêm đối tác
          </button>}
        </div>
      </div>
      {notice && <p role="status" className="text-xs font-medium text-teal-700 dark:text-teal-300">{notice}</p>}
      {!readOnly && formOpen && (
        <form ref={formRef} onSubmit={submitPartner} aria-label={originalName ? `Sửa đối tác ${originalName}` : 'Thêm đối tác nha khoa'}
          className="space-y-3 rounded-xl border border-teal-200 bg-white p-4 dark:border-teal-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold">{originalName ? `Sửa đối tác · ${originalName}` : 'Thêm đối tác nha khoa'}</h3>
          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 disabled:opacity-70">
            <label className="grid gap-1 text-xs font-medium">Tên nha khoa *
              <input ref={nameInputRef} name="name" required maxLength={250} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="min-h-11 rounded-lg border border-slate-300 bg-transparent p-2 text-base focus:ring-2 focus:ring-teal-500 sm:text-sm dark:border-slate-700" />
            </label>
            <label className="grid gap-1 text-xs font-medium">Địa chỉ
              <input name="address" maxLength={300} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                className="min-h-11 rounded-lg border border-slate-300 bg-transparent p-2 text-base focus:ring-2 focus:ring-teal-500 sm:text-sm dark:border-slate-700" />
            </label>
            <label className="grid gap-1 text-xs font-medium">Số điện thoại
              <input name="phone" type="tel" maxLength={50} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                className="min-h-11 rounded-lg border border-slate-300 bg-transparent p-2 text-base focus:ring-2 focus:ring-teal-500 sm:text-sm dark:border-slate-700" />
            </label>
            <label className="grid gap-1 text-xs font-medium">Chiết khấu nha khoa (%)
              <input name="discountPercent" type="number" min={0} max={100} step={0.01} inputMode="decimal" value={draft.discountPercent}
                aria-invalid={!!discountError} aria-describedby={discountError ? 'clinic-discount-error' : undefined}
                onChange={(event) => { setDraft({ ...draft, discountPercent: event.target.value }); setDiscountError(''); }} onBlur={validateDiscount}
                className="min-h-11 rounded-lg border border-slate-300 bg-transparent p-2 text-base focus:ring-2 focus:ring-teal-500 sm:text-sm dark:border-slate-700" />
              {discountError && <span id="clinic-discount-error" role="alert" className="text-rose-600 dark:text-rose-400">{discountError}</span>}
            </label>
          </fieldset>
          <div className="flex gap-2 text-xs font-bold">
            <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-white hover:bg-teal-800 disabled:opacity-50">
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{saving ? 'Đang lưu…' : originalName ? 'Lưu thay đổi' : 'Lưu đối tác'}
            </button>
            <button type="button" disabled={saving} onClick={() => setFormOpen(false)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700">Hủy</button>
          </div>
        </form>
      )}
      {!readOnly && deleteTarget && (
        <div role="group" aria-label={`Xác nhận xóa ${deleteTarget}`} className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
          <p className="text-sm font-bold">Xóa đối tác {deleteTarget}?</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">Đối tác sẽ được ẩn khỏi danh sách. Đơn hàng, doanh thu và công nợ đã có vẫn được giữ lại.</p>
          {deleteError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{deleteError}</p>}
          <div className="flex gap-2 text-xs font-bold">
            <button type="button" disabled={saving} onClick={() => void deletePartner()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 text-white hover:bg-rose-800 disabled:opacity-50">
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{saving ? 'Đang xóa…' : 'Xóa đối tác'}
            </button>
            <button type="button" disabled={saving} onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700">Hủy</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-950"><tr>
            {['Nha khoa', 'Địa chỉ', 'Số điện thoại', 'Chiết khấu', 'Số ca', 'Số răng', 'Doanh thu', 'Thao tác'].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredClinics.map((clinic) => <tr key={normalizeClinicName(clinic.name)}>
              <th scope="row" className="px-3 py-2 font-bold">{clinic.name}</th>
              <td className="max-w-xs px-3 py-2">{clinic.address || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2">{clinic.phone || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-teal-700 dark:text-teal-300">{clinic.discountPercent.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%</td>
              <td className="px-3 py-2">{clinic.totalOrders}</td>
              <td className="px-3 py-2">{clinic.totalTeeth}</td>
              <td className="whitespace-nowrap px-3 py-2 font-semibold">{formatVND(clinic.totalRevenue)}</td>
              <td className="px-3 py-2"><div className="flex items-center gap-1.5 whitespace-nowrap font-bold text-teal-700 dark:text-teal-300">
                {!readOnly && <>
                  <button type="button" disabled={saving} onClick={() => beginForm(clinic)} aria-label={`Sửa ${clinic.name}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-teal-500/10 disabled:opacity-50"><Pencil className="size-3.5" aria-hidden="true" /> Sửa</button>
                  <button type="button" disabled={saving} onClick={() => { setDeleteTarget(clinic.name); setDeleteError(''); setNotice(''); }} aria-label={`Xóa ${clinic.name}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-300"><Trash2 className="size-3.5" aria-hidden="true" /> Xóa</button>
                </>}
                {onExportClinicInvoice && clinic.orders.length > 0 && <button type="button" onClick={() => onExportClinicInvoice(clinic.orders, clinic.name, selectedMonth === 'ALL' ? '' : selectedMonth)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-teal-500/10"><FileDown className="size-3.5" aria-hidden="true" /> PDF</button>}
                <button type="button" onClick={() => onSelectClinicFilter(clinic.name, selectedMonth)} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-teal-500/10">Doanh thu <ArrowRight className="size-3.5" aria-hidden="true" /></button>
              </div></td>
            </tr>)}
            {filteredClinics.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Không tìm thấy đối tác trong kỳ đã chọn.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
