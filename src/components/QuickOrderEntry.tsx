import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, Plus, X } from 'lucide-react';
import { FdiTeethPicker } from './FdiTeethPicker';
import type { ClinicMaterialPriceRow, DentalOrder, MaterialPriceConfig } from '../types/dental';
import { extractWarrantyYears } from '../utils/csvParser';
import { parseTeethNotation } from '../utils/fdiTeeth';
import {
  getUnitPriceForMaterial,
  resolveMaterialPricesForClinic,
} from '../utils/financeUtils';
import { explainOrderAmountSuggestion } from '../utils/orderPriceTransparency';
import { formatSaveError, reuseOrCreateStableId } from '../utils/reliableSave';
import { useNotify } from './AppNotifications';
import { DateTextInput } from './DateTextInput';
import { normalizeDdMmYyyy, todayDdMmYyyy } from '../utils/dateOnly';

interface QuickOrderValues {
  warrantyCode: string;
  patientName: string;
  clinicName: string;
  orderDate: string;
  teeth: string;
  teethCount: string;
  warrantyPeriod: string;
  material: string;
  totalAmount: string;
  notes: string;
}

export type QuickOrderField = keyof QuickOrderValues;


function parseAmountInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed.replace(/\./g, ''));
  return Number.isFinite(n) ? n : 0;
}

interface QuickOrderEntryProps {
  columns: { field: QuickOrderField; label: string }[];
  tableRef: React.RefObject<HTMLTableElement | null>;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  clinics: { name: string; address: string }[];
  materials: string[];
  materialPrices?: MaterialPriceConfig[];
  clinicMaterialPrices?: ClinicMaterialPriceRow[];
  onAdd: (data: Partial<DentalOrder>) => Promise<DentalOrder>;
}

interface ColumnLayout {
  left: number;
  viewportWidth: number;
  tableWidth: number;
  widths: number[];
}

const todayDate = () => todayDdMmYyyy();


const warranties = ['1 năm', '2 năm', '3 năm', '5 năm', '7 năm', '10 năm', '15 năm', '20 năm', '26 năm', '50 năm', 'Trọn đời'];

export function QuickOrderEntry({
  columns, tableRef, tableScrollRef, clinics, materials,
  materialPrices = [], clinicMaterialPrices = [], onAdd,
}: QuickOrderEntryProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const teethInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [formFocused, setFormFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [layout, setLayout] = useState<ColumnLayout | null>(null);
  const entryScrollRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<QuickOrderValues>(() => ({
    warrantyCode: '', patientName: '', clinicName: '', orderDate: todayDate(),
    teeth: '', teethCount: '1', warrantyPeriod: '15 năm', material: materials[0] || '',
    totalAmount: '', notes: '',
  }));
  const [busy, setBusy] = useState(false);
  const { notify, confirm } = useNotify();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const saving = useRef(false);
  const amountManualRef = useRef(false);
  const createIdRef = useRef<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const lastSuggestionRef = useRef(0);
  const totalAmountRef = useRef(0);
  const expanded = hovered || pinned || formFocused || pickerOpen || busy;

  totalAmountRef.current = parseAmountInput(values.totalAmount);

  const catalogForClinic = useMemo(
    () => resolveMaterialPricesForClinic(values.clinicName, materialPrices, clinicMaterialPrices),
    [values.clinicName, materialPrices, clinicMaterialPrices],
  );

  const suggestedUnitPrice = useMemo(() => {
    if (!values.clinicName.trim() || !values.material.trim()) return 0;
    return getUnitPriceForMaterial(values.material, catalogForClinic);
  }, [values.clinicName, values.material, catalogForClinic]);

  const suggestedTotal = useMemo(() => {
    if (suggestedUnitPrice <= 0) return 0;
    const count = Math.max(0, Number(values.teethCount) || 0);
    return count * suggestedUnitPrice;
  }, [suggestedUnitPrice, values.teethCount]);

  const priceExplain = useMemo(
    () =>
      explainOrderAmountSuggestion({
        clinicName: values.clinicName,
        material: values.material,
        quantity: Number(values.teethCount) || 0,
        enteredAmount: parseAmountInput(values.totalAmount),
        sharedPrices: materialPrices,
        clinicRows: clinicMaterialPrices,
        sessionManual: amountManualRef.current,
      }),
    [
      values.clinicName,
      values.material,
      values.teethCount,
      values.totalAmount,
      materialPrices,
      clinicMaterialPrices,
      // amountManualRef is read inside; totalAmount/teethCount already trigger refresh
    ]
  );


  useEffect(() => {
    if (suggestedTotal <= 0) return;
    const current = totalAmountRef.current;
    const prev = lastSuggestionRef.current;
    if (current === suggestedTotal) {
      lastSuggestionRef.current = suggestedTotal;
      return;
    }
    if (current === 0 || current === prev) {
      amountManualRef.current = false;
      setValues((v) => ({ ...v, totalAmount: String(suggestedTotal) }));
      lastSuggestionRef.current = suggestedTotal;
      
    }
  }, [suggestedTotal]);


  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (pickerRef.current?.contains(target) || teethInputRef.current?.contains(target)) return;
      setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pickerOpen]);

  function hasUnsavedDraft() {
    return Boolean(
      values.warrantyCode.trim() ||
      values.patientName.trim() ||
      values.teeth.trim() ||
      values.notes.trim() ||
      (values.teethCount.trim() && values.teethCount.trim() !== '1')
    );
  }

  async function collapse() {
    if (busy) return;
    if (hasUnsavedDraft()) {
      const ok = await confirm({
        title: 'Thu gọn nhập nhanh?',
        message: 'Có nội dung chưa lưu. Thu gọn sẽ mất nội dung đang nhập.',
        confirmLabel: 'Thu gọn',
        cancelLabel: 'Tiếp tục',
        danger: true,
      });
      if (!ok) {
        setPinned(true);
        return;
      }
    }
    const restoreFocus = panelRef.current?.contains(document.activeElement);
    setHovered(false);
    setPinned(false);
    setFormFocused(false);
    setPickerOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useLayoutEffect(() => {
    const table = tableRef.current;
    const tableScroll = tableScrollRef.current;
    const entryScroll = entryScrollRef.current;
    if (!table || !tableScroll || !entryScroll) return;

    // Include the checkbox and action columns so every input follows its table cell.
    const headers = Array.from(table.tHead?.rows[0]?.cells || []);
    const measure = () => {
      const widths = headers.map((cell) => cell.getBoundingClientRect().width);
      const next = {
        left: tableScroll.getBoundingClientRect().left + tableScroll.clientLeft,
        viewportWidth: tableScroll.clientWidth,
        tableWidth: table.getBoundingClientRect().width,
        widths,
      };
      if (!next.viewportWidth || !next.tableWidth || widths.length !== columns.length + 2) return;
      setLayout((current) => current && current.left === next.left &&
        current.viewportWidth === next.viewportWidth && current.tableWidth === next.tableWidth &&
        current.widths.every((width, index) => width === widths[index]) ? current : next);
    };
    const syncEntry = () => {
      if (Math.abs(entryScroll.scrollLeft - tableScroll.scrollLeft) > 0.5) {
        entryScroll.scrollLeft = tableScroll.scrollLeft;
      }
    };
    const syncTable = () => {
      if (Math.abs(tableScroll.scrollLeft - entryScroll.scrollLeft) > 0.5) {
        tableScroll.scrollLeft = entryScroll.scrollLeft;
      }
    };

    const observer = new ResizeObserver(measure);
    [table, tableScroll, ...headers].forEach((element) => observer.observe(element));
    window.addEventListener('resize', measure);
    tableScroll.addEventListener('scroll', syncEntry, { passive: true });
    entryScroll.addEventListener('scroll', syncTable, { passive: true });
    measure();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      tableScroll.removeEventListener('scroll', syncEntry);
      entryScroll.removeEventListener('scroll', syncTable);
    };
  }, [tableRef, tableScrollRef, columns.length]);

  useLayoutEffect(() => {
    if (entryScrollRef.current && tableScrollRef.current) {
      entryScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  }, [layout, tableScrollRef]);

  function update(field: QuickOrderField, value: string) {
    setError('');
    setNotice('');
    if (field === 'totalAmount') {
      amountManualRef.current = true;
    }
    setValues((current) => {
      if (field === 'teeth') {
        const parsed = parseTeethNotation(value);
        return { ...current, teeth: value, teethCount: String(parsed.count || 1) };
      }
      return { ...current, [field]: value };
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const clinic = clinics.find(({ name }) => name === values.clinicName);
    const normalizedDate = normalizeDdMmYyyy(values.orderDate);
    if (!values.patientName.trim() || !clinic || !values.material) {
      setError('Nhập khách hàng, chọn nha khoa và dòng sứ.');
      return;
    }
    if (!normalizedDate) {
      setError('Nhập ngày hợp lệ theo định dạng DD/MM/YYYY.');
      return;
    }
    const count = Number(values.teethCount);
    if (!Number.isInteger(count) || !values.teethCount.trim() || count < 0 || count > 64) {
      setError('SL phải là số nguyên từ 0 đến 64.');
      return;
    }
    const rawAmount = values.totalAmount.trim() || '0';
    const amount = Number(rawAmount.replace(/\./g, ''));
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(rawAmount) || !Number.isSafeInteger(amount)) {
      setError('Thành tiền phải là số nguyên không âm, ví dụ 1.250.000.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      createIdRef.current = reuseOrCreateStableId('order', createIdRef.current);
      const created = await onAdd({
        id: createIdRef.current,
        warrantyCode: values.warrantyCode.trim(),
        patientName: values.patientName.trim(),
        clinicName: clinic.name,
        clinicAddress: clinic.address,
        orderDate: normalizedDate,
        monthYear: normalizedDate.slice(3, 5) + '/' + normalizedDate.slice(6, 10),
        teeth: values.teeth.trim(),
        teethCount: count,
        material: values.material,
        warrantyPeriod: values.warrantyPeriod,
        warrantyYears: extractWarrantyYears(values.warrantyPeriod),
        totalAmount: amount,
        unitPrice: suggestedUnitPrice > 0 ? suggestedUnitPrice : 0,
        toothForm: '',
        status: '',
        notes: values.notes.trim(),
      });
      createIdRef.current = null;
      const nextSuggested = suggestedUnitPrice > 0 ? suggestedUnitPrice : 0;
      amountManualRef.current = false;
      setValues((current) => ({
        ...current,
        warrantyCode: '',
        patientName: '',
        teeth: '',
        teethCount: '1',
        totalAmount: nextSuggested > 0 ? String(nextSuggested) : '',
        notes: '',
      }));
      lastSuggestionRef.current = nextSuggested;
      setPickerOpen(false);
      setNotice(`Đã lưu ${created.warrantyCode} — ${created.patientName}.`);
      notify({
        tone: 'success',
        title: 'Đã lưu đơn',
        message: `${created.warrantyCode} — ${created.patientName}`,
      });
      setFormFocused(true);
      requestAnimationFrame(() => codeInput.current?.focus());
    } catch (cause) {
      const message = formatSaveError(cause, 'Chưa lưu được đơn. Kiểm tra mạng rồi bấm Thử lại.');
      setError(message);
      notify({ tone: 'error', title: 'Chưa lưu đơn', message, persist: true });
      setPinned(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const inputClass = 'h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

  return (
    <section aria-label="Nhập nhanh đơn hàng" data-expanded={expanded} className="quick-order-dock no-print fixed inset-x-0 bottom-0 z-40"
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHovered(false); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !(event.target instanceof HTMLSelectElement)) {
          event.preventDefault();
          if (pickerOpen) setPickerOpen(false);
          else collapse();
        }
      }}>
      {
        <div ref={pickerRef} role="group" aria-label="Chọn vị trí răng FDI" aria-hidden={!pickerOpen} inert={!pickerOpen} data-open={pickerOpen} className="quick-teeth-picker absolute left-1/2 z-10 w-[min(96vw,40rem)] rounded-t-2xl border border-slate-200 bg-white p-2 shadow-[0_-12px_32px_rgba(15,23,42,0.20)] dark:border-slate-700 dark:bg-slate-900"
          style={{ bottom: 'calc(100% - 44px)' }}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-800 dark:text-white">Chọn vị trí răng</span>
            <button type="button" onClick={() => setPickerOpen(false)} aria-label="Đóng sơ đồ răng"
              className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-slate-200 dark:hover:bg-slate-800">
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="max-h-[min(65vh,32rem)] overflow-y-auto">
            <FdiTeethPicker compact selectedIds={parseTeethNotation(values.teeth).toothIds}
              onChange={(ids, formatted) => {
                setValues((current) => ({ ...current, teeth: ids.length ? formatted : '', teethCount: String(ids.length || 1) }));
                setError('');
                setNotice('');
              }} />
          </div>
        </div>
      }
      <div aria-hidden={expanded} inert={expanded} className={`flex h-11 items-end justify-center ${expanded ? 'invisible' : ''}`}>
        <button ref={triggerRef} type="button" aria-expanded={expanded} aria-controls={panelId}
          aria-label={expanded ? 'Thu gọn nhập nhanh' : 'Thêm nhanh đơn hàng'} disabled={busy}
          onClick={() => {
            setPinned(true);
            requestAnimationFrame(() => codeInput.current?.focus());
          }}
          className="flex h-11 items-center gap-2 rounded-t-xl border border-b-0 border-blue-400/50 bg-linear-to-r from-teal-700 to-sky-600 px-4 text-xs font-semibold text-white shadow-[0_-2px_12px_rgba(37,99,235,0.16)] hover:from-teal-600 hover:to-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-wait">
          <span className="flex size-5 items-center justify-center rounded-full bg-white/15"><Plus aria-hidden="true" className="size-3.5" /></span>
          <span>Thêm nhanh</span>
          <ChevronUp aria-hidden="true" className={`size-3.5 text-blue-100 transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div ref={panelRef} id={panelId} inert={!expanded} aria-hidden={!expanded}
        className="quick-order-panel border-t border-slate-200 bg-white/95 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/95"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        onFocusCapture={(event) => {
          setFormFocused(true);
          if (event.target !== teethInputRef.current) setPickerOpen(false);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFormFocused(false);
        }}>
        <div style={{ marginLeft: layout?.left, width: layout?.viewportWidth, visibility: layout ? undefined : 'hidden' }}>
          <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pr-1 text-xs" style={{ paddingLeft: (layout?.widths[0] || 0) + 4 }}>
            <h2 className="font-bold text-teal-700 dark:text-teal-300">Nhập nhanh</h2>
            {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
            {notice && <p role="status" className="text-emerald-700 dark:text-emerald-300">{notice}</p>}
            <button type="button" onClick={collapse} disabled={busy} aria-label="Thu gọn nhập nhanh" title="Thu gọn"
              className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-teal-500 disabled:cursor-wait disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-teal-300">
              <ChevronUp aria-hidden="true" className="size-3.5 rotate-180" />
            </button>
          </div>
          <form onSubmit={submit} aria-busy={busy}>
            <div ref={entryScrollRef} className="overflow-x-auto pb-1">
              <table role="presentation" className="table-fixed border-collapse text-left text-xs" style={{ width: layout?.tableWidth }}>
                <colgroup>
                  {layout?.widths.map((width, index) => <col key={index} style={{ width }} />)}
                </colgroup>
                <tbody>
                  <tr>
                    <td aria-hidden="true" />
                    {columns.map(({ field, label }) => (
                      <td key={field} className="px-1 align-bottom">
                        <label className="relative flex min-w-0 flex-col gap-1">
                          <span className="flex h-4 min-w-0 items-center gap-1">
                            <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
                            {field === 'totalAmount' ? (
                              <span
                                id="quick-order-amount-help"
                                title={priceExplain.compactHint || undefined}
                                className="min-w-0 flex-1 truncate text-right text-[9px] font-medium leading-none text-slate-500 dark:text-slate-400"
                              >
                                {priceExplain.compactHint || ' '}
                              </span>
                            ) : null}
                          </span>
                          {field === 'clinicName' ? (
                            <select aria-label="Nhập nhanh Nha khoa" value={values.clinicName} onChange={(event) => update(field, event.target.value)} required disabled={busy} className={inputClass}>
                              <option value="">Chọn nha khoa</option>
                              {clinics.map(({ name }) => <option key={name} value={name}>{name}</option>)}
                            </select>
                          ) : field === 'material' ? (
                            <select aria-label="Nhập nhanh Dòng sứ" value={values.material} onChange={(event) => update(field, event.target.value)} required disabled={busy} className={inputClass}>
                              <option value="">Chọn dòng sứ</option>
                              {materials.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                          ) : field === 'warrantyPeriod' ? (
                            <select aria-label="Nhập nhanh Thời gian BH" value={values.warrantyPeriod} onChange={(event) => update(field, event.target.value)} disabled={busy} className={inputClass}>
                              {warranties.map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                          ) : (
                            <>
                              {field === 'orderDate' ? (
                                <DateTextInput
                                  aria-label={`Nhập nhanh ${label}`}
                                  value={values.orderDate}
                                  onChange={(next) => update('orderDate', next)}
                                  required
                                  disabled={busy}
                                  placeholder="DD/MM/YYYY"
                                  inputClassName={inputClass}
                                />
                              ) : (
                              <input aria-label={`Nhập nhanh ${label}`} value={values[field]}
                                ref={field === 'warrantyCode' ? codeInput : field === 'teeth' ? teethInputRef : undefined}
                                onFocus={field === 'teeth' ? () => setPickerOpen(true) : undefined}
                                onClick={field === 'teeth' ? () => setPickerOpen(true) : undefined}
                                onChange={(event) => update(field, event.target.value)}
                                required={field === 'patientName' || field === 'teethCount'}
                                maxLength={field === 'warrantyCode' ? 64 : field === 'notes' ? 1000 : field === 'patientName' || field === 'teeth' ? 200 : undefined}
                                inputMode={field === 'totalAmount' || field === 'teethCount' ? 'numeric' : undefined}
                                placeholder={field === 'warrantyCode' ? 'Tự tạo' : field === 'totalAmount' ? '0' : ''}
                                aria-describedby={field === 'totalAmount' ? 'quick-order-amount-help' : undefined}
                                disabled={busy} className={inputClass} />
                              )}
                            </>
                          )}
                        </label>
                      </td>
                    ))}
                    <td className="px-3 align-bottom">
                      <button type="submit" disabled={busy} className="flex h-9 w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-teal-700 px-1 text-[11px] font-bold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-wait disabled:opacity-60">
                        <Plus aria-hidden="true" className="size-3.5 shrink-0" /> {busy ? 'Đang lưu…' : error ? 'Thử lại' : 'Thêm nhanh'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
