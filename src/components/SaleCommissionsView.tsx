import React, { useState, useMemo } from 'react';
import { Pencil, Plus, Percent, Trash2, Search } from 'lucide-react';
import type { CommissionInput, SaleCommission } from '../types/commission';
import type { UserProfile } from '../types/user';
import type { DentalOrder } from '../types/dental';
import { formatVND } from '../utils/financeUtils';

interface SaleCommissionsViewProps {
  records: SaleCommission[];
  sales: UserProfile[];
  clinicNames: string[];
  orders?: DentalOrder[];
  loading: boolean;
  loadError: string;
  onBulkSave: (saleId: string, clinicNames: string[], ratePercent: number) => Promise<{ created: number; skipped: number }>;
  onSave: (input: CommissionInput, existingId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteMany?: (ids: string[]) => Promise<void>;
}

const normalizeClinicKey = (name: string) =>
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

export function SaleCommissionsView({
  records,
  sales,
  clinicNames,
  orders = [],
  loading,
  loadError,
  onSave,
  onBulkSave,
  onDelete,
  onDeleteMany,
}: SaleCommissionsViewProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SaleCommission | null>(null);
  const [saleId, setSaleId] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);
  const [clinicSearch, setClinicSearch] = useState('');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Table filtering & deletion state
  const [filterSaleId, setFilterSaleId] = useState<string>('ALL');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [onlyClinicsWithRevenue, setOnlyClinicsWithRevenue] = useState<boolean>(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Compute total revenue per normalized clinic name from orders
  const clinicRevenueMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (!o.clinicName) continue;
      const key = normalizeClinicKey(o.clinicName);
      map.set(key, (map.get(key) || 0) + (o.totalAmount || 0));
    }
    return map;
  }, [orders]);

  const getClinicRevenue = (name: string) =>
    clinicRevenueMap.get(normalizeClinicKey(name)) || 0;

  function startEdit(record: SaleCommission | null) {
    setEditing(record);
    setSaleId(record?.saleId ?? '');
    setClinicName(record?.clinicName ?? '');
    setSelectedClinics([]);
    setClinicSearch('');
    setRate(record ? String(record.ratePercent) : '');
    setError('');
    setNotice('');
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = rate.trim().replace(',', '.');
    const percentage = Number(normalized);
    if (!saleId || (editing ? !clinicName : selectedClinics.length === 0) || !/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized) || percentage > 100) {
      setError('Chọn sale, nha khoa và nhập tỷ lệ từ 0 đến 100%, tối đa 2 chữ số thập phân.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await onSave({ saleId, clinicName, ratePercent: percentage }, editing.id);
        setNotice('Đã lưu cấu hình hoa hồng.');
      } else {
        const result = await onBulkSave(saleId, selectedClinics, percentage);
        setNotice(`Đã thêm hoa hồng cho ${result.created} nha khoa.${result.skipped ? ` Có ${result.skipped} nha khoa đã được cấu hình.` : ''}`);
      }
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa lưu được hoa hồng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteOne(record: SaleCommission) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onDelete(record.id);
      setConfirmDeleteId(null);
      setSelectedRowIds((prev) => prev.filter((id) => id !== record.id));
      setNotice(`Đã xóa cấu hình hoa hồng nha khoa ${record.clinicName}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xóa được cấu hình hoa hồng.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedRowIds.length === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (onDeleteMany) {
        await onDeleteMany(selectedRowIds);
      } else {
        for (const id of selectedRowIds) {
          await onDelete(id);
        }
      }
      const count = selectedRowIds.length;
      setSelectedRowIds([]);
      setConfirmBulkDelete(false);
      setNotice(`Đã xóa ${count} cấu hình hoa hồng.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xóa được các mục đã chọn.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800';
  const normalizedName = (name: string) => name.trim().normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ');
  const configuredClinics = new Set(records.filter((record) => record.saleId === saleId).map(({ clinicName }) => normalizedName(clinicName)));

  // Only show clinics that have revenue > 0 when picking for Sale (unless orders is empty)
  const activeClinicPool = useMemo(() => {
    if (orders.length === 0 || !onlyClinicsWithRevenue) return clinicNames;
    return clinicNames.filter((name) => getClinicRevenue(name) > 0);
  }, [clinicNames, orders.length, onlyClinicsWithRevenue, clinicRevenueMap]);

  const eligibleClinics = activeClinicPool.filter((name) => !configuredClinics.has(normalizedName(name)));
  const visibleClinics = activeClinicPool.filter((name) => name.toLocaleLowerCase('vi').includes(clinicSearch.trim().toLocaleLowerCase('vi')));
  const allSelected = eligibleClinics.length > 0 && eligibleClinics.every((name) => selectedClinics.includes(name));
  const activeSales = sales.filter((sale) => sale.role === 'sale' && sale.active);

  const filteredRecords = useMemo(() => {
    const q = tableSearch.trim().toLocaleLowerCase('vi');
    return records.filter((r) => {
      if (filterSaleId !== 'ALL' && r.saleId !== filterSaleId) return false;
      if (onlyClinicsWithRevenue && orders.length > 0 && getClinicRevenue(r.clinicName) <= 0) {
        return false;
      }
      if (q) {
        const sale = sales.find(({ uid }) => uid === r.saleId);
        const matchClinic = r.clinicName.toLocaleLowerCase('vi').includes(q);
        const matchSale =
          (sale?.displayName || '').toLocaleLowerCase('vi').includes(q) ||
          (sale?.email || '').toLocaleLowerCase('vi').includes(q);
        if (!matchClinic && !matchSale) return false;
      }
      return true;
    });
  }, [records, filterSaleId, tableSearch, sales, onlyClinicsWithRevenue, orders.length, clinicRevenueMap]);

  const allTableRowsSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((r) => selectedRowIds.includes(r.id));

  return (
    <section aria-labelledby="commissions-title" className="space-y-4">
      <div className="bento-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <h2 id="commissions-title" className="flex items-center gap-2 text-lg font-bold">
            <Percent className="size-5 text-teal-700 dark:text-teal-300" aria-hidden="true" /> Hoa hồng sale
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Chọn nha khoa phụ trách và tỷ lệ hoa hồng riêng cho từng sale.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedRowIds.length > 0 && (
            confirmBulkDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDeleteSelected}
                  className="flex min-h-10 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60"
                >
                  <Trash2 className="size-3.5" />
                  Xác nhận xóa ({selectedRowIds.length})
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmBulkDelete(false)}
                  className="min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmBulkDelete(true)}
                className="flex min-h-10 items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3.5 text-xs font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-100 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
                Xóa đã chọn ({selectedRowIds.length})
              </button>
            )
          )}
          <button type="button" disabled={busy || loading || Boolean(loadError)} onClick={() => startEdit(null)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer">
            <Plus className="size-4" aria-hidden="true" /> Thêm hoa hồng
          </button>
        </div>
      </div>

      {(loadError || error) && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error || loadError}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {open && (
        <form onSubmit={submit} aria-busy={busy} className="bento-card space-y-4 rounded-2xl p-4">
          <h3 className="text-sm font-bold">{editing ? 'Sửa tỷ lệ hoa hồng' : 'Cấu hình hoa hồng'}</h3>
          <div className={`grid gap-4 ${editing ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <label className="grid content-start gap-1.5 text-sm font-medium">
              Sale
              <select value={saleId} onChange={(event) => { setSaleId(event.target.value); setSelectedClinics([]); setError(''); }} required disabled={busy || Boolean(editing)} className={inputClass}>
                <option value="">Chọn sale</option>
                {editing && !activeSales.some(({ uid }) => uid === editing.saleId) && (
                  <option value={editing.saleId}>{sales.find(({ uid }) => uid === editing.saleId)?.displayName || 'Sale đã ngừng hoạt động'}</option>
                )}
                {activeSales.map((sale) => <option key={sale.uid} value={sale.uid}>{sale.displayName} ({sale.email})</option>)}
              </select>
            </label>
            {editing && (
              <label className="grid content-start gap-1.5 text-sm font-medium">
                Nha khoa phụ trách
                <input value={clinicName} disabled className={inputClass} />
              </label>
            )}
            <label className="grid content-start gap-1.5 text-sm font-medium">
              Hoa hồng (%)
              <input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" placeholder="Ví dụ 5 hoặc 7,5" required disabled={busy} className={inputClass} />
            </label>
          </div>
          {!editing && (
            <fieldset disabled={busy || !saleId} className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 disabled:opacity-60">
              <legend className="px-1 text-sm font-semibold">Nha khoa phụ trách (Có doanh số)</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={allSelected} disabled={eligibleClinics.length === 0}
                    onChange={(event) => setSelectedClinics(event.target.checked ? eligibleClinics : [])}
                    className="size-4 accent-teal-700" />
                  Chọn tất cả ({eligibleClinics.length})
                </label>
                <span className="text-xs text-slate-500" role="status">Đã chọn {selectedClinics.length} nha khoa</span>
              </div>
              <input aria-label="Tìm nha khoa" value={clinicSearch} onChange={(event) => setClinicSearch(event.target.value)}
                placeholder="Tìm nha khoa…" className={inputClass} />
              <div className="grid max-h-64 gap-x-4 overflow-y-auto sm:grid-cols-2">
                {visibleClinics.map((name) => {
                  const configured = configuredClinics.has(normalizedName(name));
                  const rev = getClinicRevenue(name);
                  return (
                    <label key={name} className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm has-disabled:cursor-default has-disabled:text-slate-400 pr-2">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedClinics.includes(name)} disabled={configured}
                          onChange={(event) => setSelectedClinics((selected) => event.target.checked
                            ? [...selected, name]
                            : selected.filter((clinic) => clinic !== name))}
                          className="size-4 shrink-0 accent-teal-700" />
                        <span>{name}{configured && <span className="ml-1 text-xs">(Đã cấu hình)</span>}</span>
                      </span>
                      {rev > 0 && (
                        <span className="font-mono text-xs text-teal-700 dark:text-teal-400">
                          {formatVND(rev)}
                        </span>
                      )}
                    </label>
                  );
                })}
                {visibleClinics.length === 0 && <p className="py-3 text-sm text-slate-500">Không tìm thấy nha khoa.</p>}
              </div>
            </fieldset>
          )}
          {!editing && activeSales.length === 0 && <p className="text-sm text-slate-500">Thêm hoặc kích hoạt tài khoản sale trong mục Người dùng.</p>}
          <div className="flex gap-2 text-sm font-semibold">
            <button type="submit" disabled={busy || (!editing && activeSales.length === 0)} className="min-h-11 rounded-lg bg-teal-700 px-4 text-white disabled:opacity-60 cursor-pointer">{busy ? 'Đang lưu…' : 'Lưu hoa hồng'}</button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(''); }} className="min-h-11 rounded-lg border border-slate-300 px-4 dark:border-slate-700 cursor-pointer">Hủy</button>
          </div>
        </form>
      )}

      {/* Filter bar for configured commissions */}
      {records.length > 0 && (
        <div className="bento-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterSaleId}
              onChange={(e) => {
                setFilterSaleId(e.target.value);
                setSelectedRowIds([]);
                setConfirmBulkDelete(false);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold"
            >
              <option value="ALL">Tất cả Sale ({records.length} cấu hình)</option>
              {sales
                .filter((s) => s.role === 'sale')
                .map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {s.displayName} ({records.filter((r) => r.saleId === s.uid).length} NK)
                  </option>
                ))}
            </select>

            <div className="relative">
              <Search className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Tìm nha khoa hoặc sale..."
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
              />
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyClinicsWithRevenue}
                onChange={(e) => {
                  setOnlyClinicsWithRevenue(e.target.checked);
                  setSelectedRowIds([]);
                }}
                className="size-4 accent-teal-700 cursor-pointer"
              />
              <span>Chỉ hiện nha khoa có số (&gt; 0 ₫)</span>
            </label>
          </div>

          <span className="text-xs text-slate-500">
            Hiển thị <strong>{filteredRecords.length}</strong> / {records.length} nha khoa
          </span>
        </div>
      )}

      <div className="bento-card overflow-x-auto rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả cấu hình đang hiển thị"
                  checked={allTableRowsSelected}
                  disabled={filteredRecords.length === 0 || busy}
                  onChange={(e) => {
                    setConfirmBulkDelete(false);
                    if (e.target.checked) {
                      setSelectedRowIds(filteredRecords.map((r) => r.id));
                    } else {
                      setSelectedRowIds([]);
                    }
                  }}
                  className="size-4 accent-teal-700 cursor-pointer"
                />
              </th>
              {['Sale', 'Nha khoa phụ trách', 'Hoa hồng (%)', 'Thao tác'].map((title) => (
                <th key={title} scope="col" className="whitespace-nowrap px-4 py-3">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRecords.map((record) => {
              const sale = sales.find(({ uid }) => uid === record.saleId);
              const isRowSelected = selectedRowIds.includes(record.id);
              return (
                <tr key={record.id} className={isRowSelected ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Chọn cấu hình ${record.clinicName}`}
                      checked={isRowSelected}
                      disabled={busy}
                      onChange={(e) => {
                        setConfirmBulkDelete(false);
                        setSelectedRowIds((prev) =>
                          e.target.checked
                            ? [...prev, record.id]
                            : prev.filter((id) => id !== record.id)
                        );
                      }}
                      className="size-4 accent-teal-700 cursor-pointer"
                    />
                  </td>
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {sale?.displayName || 'Tài khoản sale'}
                    <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">{sale?.email}</span>
                  </th>
                  <td className="px-4 py-3">{record.clinicName}</td>
                  <td className="px-4 py-3 font-semibold">{record.ratePercent.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy || loading}
                        onClick={() => startEdit(record)}
                        aria-label={`Sửa hoa hồng ${sale?.displayName || 'sale'} tại ${record.clinicName}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" /> Sửa
                      </button>

                      {confirmDeleteId === record.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDeleteOne(record)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
                          >
                            Xác nhận xóa
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmDeleteId(null)}
                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 text-xs font-semibold cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || loading}
                          onClick={() => setConfirmDeleteId(record.id)}
                          aria-label={`Xóa hoa hồng ${sale?.displayName || 'sale'} tại ${record.clinicName}`}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 disabled:opacity-60 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" /> Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {loading ? 'Đang tải hoa hồng…' : loadError ? 'Chưa tải được dữ liệu.' : 'Chưa có cấu hình hoa hồng.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

