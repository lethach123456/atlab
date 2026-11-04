import React, { useState, useMemo, useEffect } from 'react';
import { DentalOrder, ClinicSummary, ClinicPartner } from '../types/dental';
import {
  formatVND,
  sortMonthYearsDesc,
  getPreviousMonthYear,
} from '../utils/financeUtils';
import { Search, ArrowRight, FileDown, Plus, Calendar } from 'lucide-react';

interface ClinicsViewProps {
  orders: DentalOrder[];
  readOnly?: boolean;
  partners: ClinicPartner[];
  onAddPartner: (partner: ClinicPartner) => Promise<void>;
  onSelectClinicFilter: (clinicName: string, monthYear?: string) => void;
  onExportClinicInvoice?: (clinicOrders: DentalOrder[], clinicName: string, monthYear?: string) => void;
}

export const ClinicsView: React.FC<ClinicsViewProps> = ({
  orders,
  readOnly = false,
  partners,
  onAddPartner,
  onSelectClinicFilter,
  onExportClinicInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

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
    if (
      selectedMonth !== 'ALL' &&
      availableMonths.length > 0 &&
      !availableMonths.includes(selectedMonth)
    ) {
      setSelectedMonth(latestMonth);
    }
  }, [availableMonths, latestMonth, selectedMonth]);

  const knownClinicMeta = useMemo(() => {
    const meta = new Map<string, { address: string; phone: string; hasAnyOrder: boolean }>();
    orders.forEach((o) => {
      const name = o.clinicName?.trim();
      if (!name) return;
      const cur = meta.get(name) || { address: '', phone: '', hasAnyOrder: false };
      cur.hasAnyOrder = true;
      if (o.clinicAddress?.trim() && (!cur.address || cur.address === 'Đà Nẵng')) {
        cur.address = o.clinicAddress.trim();
      }
      if (o.phone?.trim() && !cur.phone) {
        cur.phone = o.phone.trim();
      }
      meta.set(name, cur);
    });
    partners.forEach((p) => {
      const name = p.name?.trim();
      if (!name) return;
      const cur = meta.get(name) || { address: '', phone: '', hasAnyOrder: false };
      meta.set(name, {
        address: p.address?.trim() || cur.address || '',
        phone: p.phone?.trim() || cur.phone || '',
        hasAnyOrder: cur.hasAnyOrder,
      });
    });
    return meta;
  }, [orders, partners]);

  const periodOrders = useMemo(() => {
    if (selectedMonth === 'ALL') return orders;
    return orders.filter((o) => o.monthYear === selectedMonth);
  }, [orders, selectedMonth]);

  const clinicSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        address: string;
        phones: Set<string>;
        totalOrders: number;
        totalTeeth: number;
        totalRevenue: number;
        materials: Map<string, number>;
        lastOrderDate: string;
        orders: DentalOrder[];
      }
    >();

    periodOrders.forEach((o) => {
      const name = o.clinicName?.trim() || 'Nha Khoa Khác';
      const meta = knownClinicMeta.get(name);
      if (!map.has(name)) {
        map.set(name, {
          name,
          address: o.clinicAddress?.trim() || meta?.address || 'Đà Nẵng',
          phones: new Set<string>(meta?.phone ? [meta.phone] : []),
          totalOrders: 0,
          totalTeeth: 0,
          totalRevenue: 0,
          materials: new Map<string, number>(),
          lastOrderDate: o.orderDate || '',
          orders: [],
        });
      }

      const item = map.get(name)!;
      item.totalOrders += 1;
      item.totalTeeth += o.teethCount ?? 1;
      item.totalRevenue += o.totalAmount || 0;
      item.orders.push(o);
      if (o.phone) item.phones.add(o.phone);
      if (o.clinicAddress && (!item.address || item.address === 'Đà Nẵng')) {
        item.address = o.clinicAddress;
      }
      const mat = o.material || 'Zirconia';
      item.materials.set(mat, (item.materials.get(mat) || 0) + 1);
    });

    for (const partner of partners) {
      const existing = map.get(partner.name);
      const meta = knownClinicMeta.get(partner.name);
      // Include partner in map if it has orders in this selectedMonth,
      // or if viewing ALL months, or if it's a newly added partner with 0 orders in any month.
      if (existing || selectedMonth === 'ALL' || !meta?.hasAnyOrder) {
        map.set(partner.name, {
          name: partner.name,
          address: partner.address || existing?.address || meta?.address || '',
          phones: new Set(
            partner.phone
              ? [partner.phone]
              : existing
              ? Array.from(existing.phones)
              : meta?.phone
              ? [meta.phone]
              : []
          ),
          totalOrders: existing?.totalOrders ?? 0,
          totalTeeth: existing?.totalTeeth ?? 0,
          totalRevenue: existing?.totalRevenue ?? 0,
          materials: existing?.materials ?? new Map(),
          lastOrderDate: existing?.lastOrderDate ?? '',
          orders: existing?.orders ?? [],
        });
      }
    }

    const result: (ClinicSummary & { orders: DentalOrder[] })[] = [];
    map.forEach((item) => {
      let topMat = 'Zirconia';
      let maxCount = 0;
      item.materials.forEach((count, mat) => {
        if (count > maxCount) {
          maxCount = count;
          topMat = mat;
        }
      });

      result.push({
        name: item.name,
        address: item.address,
        phone: Array.from(item.phones)[0] || '',
        totalOrders: item.totalOrders,
        totalTeeth: item.totalTeeth,
        totalRevenue: item.totalRevenue,
        topMaterial: topMat,
        lastOrderDate: item.lastOrderDate,
        orders: item.orders,
      });
    });

    return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [periodOrders, partners, knownClinicMeta, selectedMonth]);

  const filteredClinics = clinicSummaries.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      c.address.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.topMaterial.toLowerCase().includes(term)
    );
  });

  const periodTotals = useMemo(() => {
    return filteredClinics.reduce(
      (acc, c) => {
        acc.orders += c.totalOrders;
        acc.teeth += c.totalTeeth;
        acc.revenue += c.totalRevenue;
        return acc;
      },
      { orders: 0, teeth: 0, revenue: 0 }
    );
  }, [filteredClinics]);

  const submitPartner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') ?? '').trim();
    if (!name) {
      setError('Nhập tên nha khoa.');
      return;
    }
    if (
      Array.from(knownClinicMeta.keys()).some(
        (existingName) =>
          existingName
            .replace(/\s+/g, ' ')
            .localeCompare(name.replace(/\s+/g, ' '), 'vi', { sensitivity: 'accent' }) === 0
      )
    ) {
      setError('Nha khoa này đã có trong danh sách.');
      return;
    }
    try {
      await onAddPartner({
        name,
        address: String(fields.get('address') ?? '').trim(),
        phone: String(fields.get('phone') ?? '').trim(),
      });
      setSearchTerm('');
      setAdding(false);
    } catch {
      setError('Không lưu được đối tác trên trình duyệt.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold">
            Đối tác Nha khoa ({filteredClinics.length})
          </h2>
          <div className="relative">
            <Calendar
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-teal-600 dark:text-teal-400"
              aria-hidden="true"
            />
            <select
              aria-label="Lọc theo tháng"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-slate-50/80 py-1.5 pl-8 pr-4 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
            </select>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Tổng: <strong className="font-mono text-slate-800 dark:text-slate-200">{periodTotals.orders}</strong> ca ·{' '}
            <strong className="font-mono text-slate-800 dark:text-slate-200">{periodTotals.teeth}</strong> răng ·{' '}
            <strong className="font-mono text-teal-700 dark:text-teal-300">{formatVND(periodTotals.revenue)}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              aria-label="Tìm đối tác"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm nha khoa, địa chỉ, SĐT…"
              className="rounded-lg border border-slate-300 bg-transparent py-2 pl-8 pr-2 text-xs focus:ring-2 focus:ring-teal-500 dark:border-slate-700"
            />
          </label>
          {!readOnly && (
            <button
              type="button"
              aria-expanded={adding}
              onClick={() => {
                setError('');
                setAdding(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800"
            >
              <Plus className="size-4" aria-hidden="true" /> Thêm đối tác
            </button>
          )}
        </div>
      </div>

      {!readOnly && adding && (
        <form
          onSubmit={submitPartner}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: 'name', label: 'Tên nha khoa', max: 250, type: 'text' },
              { name: 'address', label: 'Địa chỉ', max: 300, type: 'text' },
              { name: 'phone', label: 'Số điện thoại', max: 50, type: 'tel' },
            ].map(({ name, label, max, type }) => (
              <label key={name} className="grid gap-1 text-xs font-medium">
                {label}
                <input
                  name={name}
                  type={type}
                  required={name === 'name'}
                  autoFocus={name === 'name'}
                  maxLength={max}
                  className="rounded-lg border border-slate-300 bg-transparent p-2 focus:ring-2 focus:ring-teal-500 dark:border-slate-700"
                />
              </label>
            ))}
          </div>
          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex gap-2 text-xs font-bold">
            <button type="submit" className="rounded-lg bg-teal-700 px-3 py-2 text-white">
              Lưu đối tác
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              {['Nha khoa', 'Địa chỉ', 'Số điện thoại', 'Số ca', 'Số răng', 'Doanh thu', 'Thao tác'].map((label) => (
                <th key={label} scope="col" className="whitespace-nowrap px-3 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredClinics.map((clinic) => (
              <tr key={clinic.name}>
                <th scope="row" className="px-3 py-2 font-bold">
                  {clinic.name}
                </th>
                <td className="px-3 py-2">{clinic.address || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2">{clinic.phone || '—'}</td>
                <td className="px-3 py-2">{clinic.totalOrders}</td>
                <td className="px-3 py-2">{clinic.totalTeeth}</td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold">
                  {formatVND(clinic.totalRevenue)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 whitespace-nowrap font-bold text-teal-700 dark:text-teal-300">
                    {onExportClinicInvoice && clinic.orders.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onExportClinicInvoice(
                            clinic.orders,
                            clinic.name,
                            selectedMonth === 'ALL' ? '' : selectedMonth
                          )
                        }
                        className="inline-flex items-center gap-1 rounded px-2 py-1.5 hover:bg-teal-500/10"
                      >
                        <FileDown className="size-3.5" aria-hidden="true" /> PDF
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectClinicFilter(clinic.name, selectedMonth)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1.5 hover:bg-teal-500/10"
                    >
                      Doanh thu <ArrowRight className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredClinics.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Không tìm thấy đối tác trong kỳ đã chọn.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
