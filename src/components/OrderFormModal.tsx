import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DentalOrder, MaterialPriceConfig, ClinicMaterialPriceRow } from '../types/dental';
import { FdiTeethPicker } from './FdiTeethPicker';
import { extractWarrantyYears } from '../utils/csvParser';
import { parseTeethNotation } from '../utils/fdiTeeth';
import {
  getUnitPriceForMaterial,
  resolveMaterialPricesForClinic,
} from '../utils/financeUtils';
import { explainOrderAmountSuggestion } from '../utils/orderPriceTransparency';
import { formatSaveError, formSnapshot, reuseOrCreateStableId } from '../utils/reliableSave';
import { useNotify } from './AppNotifications';
import { X, Save, Sparkles, Building2, User, Phone, Calendar, ShieldCheck, FileText } from 'lucide-react';

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: Partial<DentalOrder>) => void | Promise<void>;
  initialOrder?: DentalOrder | null;
  clinicOptions: { name: string; address: string }[];
  materialPrices?: MaterialPriceConfig[];
  clinicMaterialPrices?: ClinicMaterialPriceRow[];
}

const FALLBACK_MATERIALS = [
  'Full Zirconia',
  'Full UNC',
  'Full DD Bio Cao Cấp',
  'Full Cercon HT',
  'Cùi giả',
];


const COMMON_WARRANTIES = [
  '1 năm',
  '2 năm',
  '3 năm',
  '5 năm',
  '7 năm',
  '10 năm',
  '15 năm',
  '20 năm',
  '26 năm',
  '50 năm',
  'Trọn đời',
];

const COMMON_FORMS = [
  'Form tự nhiên',
  'Form răng thỏ nhẹ',
  'Form Celeb',
  'Form vuông thỏ',
  'Form Oval',
  'Dáng thỏ nhẹ',
  'Form răng thỏ',
];

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialOrder,
  clinicOptions,
  materialPrices = [],
  clinicMaterialPrices = [],
}) => {
  const [warrantyCode, setWarrantyCode] = useState('');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [material, setMaterial] = useState('Full Zirconia');
  const [warrantyPeriod, setWarrantyPeriod] = useState('15 năm');
  const [orderDate, setOrderDate] = useState('');
  const [teethText, setTeethText] = useState('11-21');
  const [teethCountInput, setTeethCountInput] = useState<number>(2);
  const [totalAmountInput, setTotalAmountInput] = useState<number>(0);
  const [selectedToothIds, setSelectedToothIds] = useState<number[]>([11, 21]);
  const [toothForm, setToothForm] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<DentalOrder['status']>('');
  const { notify } = useNotify();
  const [formError, setFormError] = useState('');
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'saved'>('idle');

  const lastSuggestionRef = useRef(0);
  const totalAmountRef = useRef(0);
  const hydrateGenRef = useRef(0);
  const skipAutofillGenRef = useRef(0);
  const pendingAmountRef = useRef(0);
  const amountManualRef = useRef(false);
  const [loadedDiffersFromSuggestion, setLoadedDiffersFromSuggestion] = useState(false);
  const savingRef = useRef(false);
  const createIdRef = useRef<string | null>(null);
  const baselineRef = useRef('');
  const savedNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  totalAmountRef.current = totalAmountInput;

  const currentSnapshot = () =>
    formSnapshot({
      warrantyCode,
      patientName,
      phone,
      clinicName,
      material,
      warrantyPeriod,
      orderDate,
      teethText,
      teethCountInput,
      totalAmountInput,
      toothForm,
      notes,
      status,
    });

  const isDirty = () => baselineRef.current !== '' && currentSnapshot() !== baselineRef.current;

  const catalogForClinic = useMemo(
    () => resolveMaterialPricesForClinic(clinicName, materialPrices, clinicMaterialPrices),
    [clinicName, materialPrices, clinicMaterialPrices]
  );

  const materialOptions = useMemo(() => {
    const names = catalogForClinic.length
      ? catalogForClinic.map((row) => row.name.trim()).filter(Boolean)
      : materialPrices.map((row) => row.name.trim()).filter(Boolean);
    const merged = names.length ? names : [...FALLBACK_MATERIALS];
    if (material && !merged.includes(material)) merged.unshift(material);
    return Array.from(new Set(merged));
  }, [catalogForClinic, materialPrices, material]);

  const suggestedUnitPrice = useMemo(() => {
    if (!clinicName.trim() || !material.trim()) return 0;
    return getUnitPriceForMaterial(material, catalogForClinic);
  }, [clinicName, material, catalogForClinic]);

  const suggestedTotal = useMemo(() => {
    if (suggestedUnitPrice <= 0) return 0;
    const count = Math.max(0, Number(teethCountInput) || 0);
    return count * suggestedUnitPrice;
  }, [suggestedUnitPrice, teethCountInput]);

  const priceExplain = useMemo(
    () =>
      explainOrderAmountSuggestion({
        clinicName,
        material,
        quantity: teethCountInput,
        enteredAmount: totalAmountInput,
        sharedPrices: materialPrices,
        clinicRows: clinicMaterialPrices,
        sessionManual: amountManualRef.current,
        loadedDiffersFromSuggestion,
      }),
    [
      clinicName,
      material,
      teethCountInput,
      totalAmountInput,
      materialPrices,
      clinicMaterialPrices,
      loadedDiffersFromSuggestion,
    ]
  );


  useEffect(() => {
    if (!isOpen) return;
    setFormError('');
    setSavePhase('idle');
    savingRef.current = false;
    lastSuggestionRef.current = 0;
if (savedNoticeTimerRef.current) {
      clearTimeout(savedNoticeTimerRef.current);
      savedNoticeTimerRef.current = null;
    }
    // Skip one autofill pass so we don't overwrite hydrated amount with a stale suggestion.
    const gen = hydrateGenRef.current + 1;
    hydrateGenRef.current = gen;
    skipAutofillGenRef.current = gen;

    let nextWarranty = '';
    let nextPatient = '';
    let nextPhone = '';
    let nextClinic = '';
    let nextMaterial = 'Full Zirconia';
    let nextWarrantyPeriod = '15 năm';
    let nextOrderDate = '';
    let nextTeeth = '11-21';
    let nextTeethCount = 2;
    let nextAmount = 0;
    let nextToothForm = '';
    let nextNotes = '';
    let nextStatus: DentalOrder['status'] = '';
    let nextToothIds = [11, 21];

    if (initialOrder?.id) {
      nextAmount = initialOrder.totalAmount || 0;
      pendingAmountRef.current = nextAmount;
      nextWarranty = initialOrder.warrantyCode || '';
      nextPatient = initialOrder.patientName || '';
      nextPhone = initialOrder.phone || '';
      nextClinic = initialOrder.clinicName || '';
      nextMaterial = initialOrder.material || 'Full Zirconia';
      nextWarrantyPeriod = initialOrder.warrantyPeriod || '15 năm';
      nextOrderDate = initialOrder.orderDate || '';
      nextTeeth = initialOrder.teeth || '';
      const parsed = parseTeethNotation(initialOrder.teeth);
      nextToothIds = parsed.toothIds;
      nextTeethCount =
        initialOrder.teethCount !== undefined ? initialOrder.teethCount : parsed.count || 1;
      nextToothForm = initialOrder.toothForm ?? '';
      nextNotes = initialOrder.notes || '';
      nextStatus = initialOrder.status ?? '';
      createIdRef.current = null;
    } else {
      pendingAmountRef.current = 0;
      nextWarranty = `AT${Math.floor(10000 + Math.random() * 90000)}`;
      nextMaterial = materialPrices[0]?.name || 'Full Zirconia';
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      nextOrderDate = `${dd}/${mm}/${yyyy}`;
      nextTeeth = initialOrder?.teeth ?? '11-21';
      const parsed = parseTeethNotation(nextTeeth);
      nextToothIds = parsed.toothIds;
      nextTeethCount = parsed.count;
      createIdRef.current = null;
    }

    setWarrantyCode(nextWarranty);
    setPatientName(nextPatient);
    setPhone(nextPhone);
    setClinicName(nextClinic);
    setMaterial(nextMaterial);
    setWarrantyPeriod(nextWarrantyPeriod);
    setOrderDate(nextOrderDate);
    setTeethText(nextTeeth);
    setSelectedToothIds(nextToothIds);
    setTeethCountInput(nextTeethCount);
    setTotalAmountInput(nextAmount);
    setToothForm(nextToothForm);
    setNotes(nextNotes);
    setStatus(nextStatus);

    amountManualRef.current = false;
    const hydrateCatalog = resolveMaterialPricesForClinic(
      nextClinic,
      materialPrices,
      clinicMaterialPrices
    );
    const hydrateUnit = getUnitPriceForMaterial(nextMaterial, hydrateCatalog);
    const hydrateSuggested = hydrateUnit > 0 ? nextTeethCount * hydrateUnit : 0;
    setLoadedDiffersFromSuggestion(
      Boolean(initialOrder?.id) && hydrateSuggested > 0 && nextAmount !== hydrateSuggested
    );

    baselineRef.current = formSnapshot({
      warrantyCode: nextWarranty,
      patientName: nextPatient,
      phone: nextPhone,
      clinicName: nextClinic,
      material: nextMaterial,
      warrantyPeriod: nextWarrantyPeriod,
      orderDate: nextOrderDate,
      teethText: nextTeeth,
      teethCountInput: nextTeethCount,
      totalAmountInput: nextAmount,
      toothForm: nextToothForm,
      notes: nextNotes,
      status: nextStatus,
    });
  }, [initialOrder, isOpen]); // materialPrices read only for new-order default name


  useEffect(() => {
    if (!isOpen) return;
    if (suggestedTotal <= 0) return;

    // First pass after hydrate: seed lastSuggestion from pending amount, never overwrite.
    if (skipAutofillGenRef.current === hydrateGenRef.current) {
      skipAutofillGenRef.current = -1;
      const pending = pendingAmountRef.current;
      if (pending === suggestedTotal) {
        lastSuggestionRef.current = suggestedTotal;
      } else {
        lastSuggestionRef.current = 0;
      }
      return;
    }

    const current = totalAmountRef.current;
    const prev = lastSuggestionRef.current;

    if (current === suggestedTotal) {
      lastSuggestionRef.current = suggestedTotal;
      return;
    }

    if (current === 0 || current === prev) {
      amountManualRef.current = false;
      setLoadedDiffersFromSuggestion(false);
      setTotalAmountInput(suggestedTotal);
      lastSuggestionRef.current = suggestedTotal;
      
      // Autofill is not user dirtiness — keep baseline in sync for amount only.
      try {
        const parsed = JSON.parse(baselineRef.current) as [string, string | number][];
        if (Array.isArray(parsed)) {
          baselineRef.current = JSON.stringify(
            parsed.map(([key, value]) => (key === 'totalAmountInput' ? [key, suggestedTotal] : [key, value]))
          );
        }
      } catch {
        // ignore
      }
    }
  }, [isOpen, suggestedTotal]);

  useEffect(() => {
    return () => {
      if (savedNoticeTimerRef.current) clearTimeout(savedNoticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (savingRef.current || isDirty()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isOpen, warrantyCode, patientName, phone, clinicName, material, warrantyPeriod, orderDate, teethText, teethCountInput, totalAmountInput, toothForm, notes, status]);

  if (!isOpen) return null;

  const requestClose = () => {
    if (savingRef.current) return;
    if (isDirty()) {
      const ok = window.confirm('Có thay đổi chưa lưu. Bạn có chắc muốn đóng và hủy?');
      if (!ok) return;
    }
    onClose();
  };

  const handleTeethChange = (ids: number[], formattedString: string) => {
    setSelectedToothIds(ids);
    setTeethText(formattedString);
    setTeethCountInput(ids.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (!patientName.trim()) {
      setFormError('Vui lòng nhập họ và tên khách hàng/bệnh nhân.');
      return;
    }

    const selectedClinic = clinicOptions.find(({ name }) => name === clinicName);
    const legacyClinic = initialOrder?.id && clinicName === initialOrder.clinicName;
    if (!selectedClinic && !legacyClinic) {
      setFormError('Vui lòng chọn nha khoa đối tác.');
      return;
    }
    const selectedWarranty = warrantyPeriod.trim() || '15 năm';
    const payload: Partial<DentalOrder> = {
      warrantyCode: warrantyCode.trim() || `AT${Date.now().toString().slice(-5)}`,
      patientName: patientName.trim(),
      phone: phone.trim(),
      clinicName,
      clinicAddress: selectedClinic ? selectedClinic.address : (legacyClinic && initialOrder?.clinicAddress) || '',
      material: material.trim() || materialOptions[0] || 'Full Zirconia',
      warrantyPeriod: selectedWarranty,
      warrantyYears: initialOrder?.warrantyPeriod === selectedWarranty
        ? initialOrder.warrantyYears
        : extractWarrantyYears(selectedWarranty),
      orderDate: orderDate.trim(),
      teeth: teethText.trim(),
      teethCount: Math.max(0, Number(teethCountInput) || 0),
      totalAmount: Math.max(0, Number(totalAmountInput) || 0),
      unitPrice: suggestedUnitPrice > 0 ? suggestedUnitPrice : (initialOrder?.unitPrice ?? 0),
      toothForm: toothForm.trim(),
      notes: notes.trim(),
      status: status,
    };
    if (!initialOrder?.id) {
      createIdRef.current = reuseOrCreateStableId('order', createIdRef.current);
      payload.id = createIdRef.current;
    }

    savingRef.current = true;
    setSavePhase('saving');
    setFormError('');
    try {
      await onSave(payload);
      baselineRef.current = currentSnapshot();
      setSavePhase('saved');
      if (savedNoticeTimerRef.current) clearTimeout(savedNoticeTimerRef.current);
      savedNoticeTimerRef.current = setTimeout(() => {
        savedNoticeTimerRef.current = null;
        onClose();
      }, 450);
    } catch (cause) {
      setSavePhase('idle');
      const message = formatSaveError(cause);
      setFormError(message);
      notify({ tone: 'error', title: 'Chưa lưu đơn hàng', message, persist: true });
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-3 backdrop-blur-xs sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          requestClose();
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="order-form-title" className="flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white sm:px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400" />
            <h2 id="order-form-title" className="font-bold text-base">
              {initialOrder?.id ? 'Cập nhật đơn phục hình' : 'Đơn mới'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Đóng đơn hàng"
            onClick={requestClose}
            disabled={savePhase === 'saving'}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {/* Section 1: Identifiers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="order-code" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Mã bảo hành *
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="order-code"
                    type="text"
                    required
                    value={warrantyCode}
                    onChange={(e) => setWarrantyCode(e.target.value)}
                    className="w-full min-h-11 pl-9 pr-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white"
                    placeholder="VD: NS50205, UC10560"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="order-patient" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Khách hàng *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="order-patient"
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full min-h-11 pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    placeholder="Họ và tên bệnh nhân"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="order-phone" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Số Điện Thoại
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="order-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full min-h-11 pl-9 pr-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    placeholder="09xx xxx xxx"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="order-clinic" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nha khoa đối tác *
                </label>
                <div className="relative">
                  <Building2 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <select
                    id="order-clinic"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-2 text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Chọn nha khoa</option>
                    {clinicName && !clinicOptions.some(({ name }) => name === clinicName) && (
                      <option value={clinicName}>{clinicName}</option>
                    )}
                    {clinicOptions.map(({ name }) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="order-material" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Dòng sứ
                </label>
                <select id="order-material"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full min-h-11 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium text-slate-900"
                >
                  {materialOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="order-warranty" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Thời Hạn Bảo Hành
                </label>
                <select id="order-warranty"
                  value={warrantyPeriod}
                  onChange={(e) => setWarrantyPeriod(e.target.value)}
                  className="w-full min-h-11 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-semibold text-amber-700"
                >
                  {!COMMON_WARRANTIES.includes(warrantyPeriod) && <option value={warrantyPeriod}>{warrantyPeriod}</option>}
                  {COMMON_WARRANTIES.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="order-date" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Ngày giao / lắp
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="order-date"
                    type="text"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full min-h-11 pl-9 pr-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    placeholder="VD: 15/04/2025"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Interactive FDI Dental Teeth Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Vị Trí Răng Thực Hiện (Click chọn trên sơ đồ hoặc nhập trực tiếp)
              </label>
              <FdiTeethPicker
                selectedIds={selectedToothIds}
                onChange={handleTeethChange}
              />

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="sm:col-span-1">
                  <label htmlFor="order-teeth" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Chuỗi ký hiệu răng:
                  </label>
                  <input id="order-teeth"
                    type="text"
                    value={teethText}
                    onChange={(e) => {
                      setTeethText(e.target.value);
                      const parsed = parseTeethNotation(e.target.value);
                      setSelectedToothIds(parsed.toothIds);
                      if (parsed.count > 0) {
                        setTeethCountInput(parsed.count);
                      }
                    }}
                    className="w-full min-h-11 px-2.5 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden"
                    placeholder="VD: 13-23, 34-45"
                  />
                </div>

                <div>
                  <label htmlFor="order-quantity" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Số lượng răng
                  </label>
                  <input id="order-quantity"
                    type="number"
                    min={0}
                    max={64}
                    value={teethCountInput}
                    onChange={(e) => setTeethCountInput(Number(e.target.value))}
                    className="w-full min-h-11 px-2.5 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <div className="mb-1 flex h-4 min-w-0 items-center gap-2">
                    <label htmlFor="order-amount" className="shrink-0 text-[11px] font-bold text-teal-700">
                      Thành tiền (VNĐ)
                    </label>
                    <span
                      id="order-amount-help"
                      title={priceExplain.compactHint || undefined}
                      className="min-w-0 flex-1 truncate text-right text-[10px] font-medium leading-none text-slate-500"
                    >
                      {priceExplain.compactHint || '\u00a0'}
                    </span>
                  </div>
                  <input id="order-amount"
                    type="number"
                    step={1}
                    min={0}
                    value={totalAmountInput}
                    onChange={(e) => {
                      amountManualRef.current = true;
                      setLoadedDiffersFromSuggestion(false);
                      setTotalAmountInput(Number(e.target.value));
                    }}
                    aria-describedby="order-amount-help"
                    className="w-full min-h-11 px-2.5 py-1.5 text-sm font-mono font-extrabold text-teal-800 bg-teal-50/50 border border-teal-400 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    placeholder="Nhập số tiền..."
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div role="alert" className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
                {formError}
              </div>
            )}

            {/* Section 5: Form, Status & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="order-shape" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Form răng
                </label>
                <select id="order-shape"
                  value={toothForm}
                  onChange={(e) => setToothForm(e.target.value)}
                  className="w-full min-h-11 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Không</option>
                  {toothForm && !COMMON_FORMS.includes(toothForm) && <option value={toothForm}>{toothForm}</option>}
                  {COMMON_FORMS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="order-status" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Trạng thái
                </label>
                <select id="order-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DentalOrder['status'])}
                  className="w-full min-h-11 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  <option value="">Không</option>
                  <option value="in_production">Đang chế tác</option>
                  <option value="completed">Đã hoàn thiện</option>
                  <option value="delivered">Đã bàn giao</option>
                  <option value="warranted">Đã kích hoạt bảo hành</option>
                  <option value="pending">Chờ xác nhận</option>
                </select>
              </div>

              <div>
                <label htmlFor="order-notes" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Ghi chú kỹ thuật
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input id="order-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-11 pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    placeholder="VD: Shade A2, Rìa cắn trong, Khớp cắn chuẩn"
                  />
                </div>
              </div>
            </div>
          </div>

          {(formError || savePhase === 'saved') && (
            <div
              role="status"
              className={`mx-4 mb-0 mt-2 rounded-lg px-3 py-2 text-sm sm:mx-6 ${
                formError
                  ? 'border border-rose-200 bg-rose-50 text-rose-800'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {formError || 'Đã lưu'}
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={requestClose}
              disabled={savePhase === 'saving'}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savePhase === 'saving' || savePhase === 'saved'}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors shadow-sm disabled:cursor-wait disabled:opacity-70"
            >
              <Save className="w-4 h-4" />
              {savePhase === 'saving' ? 'Đang lưu…' : formError ? 'Thử lại' : savePhase === 'saved' ? 'Đã lưu' : 'Lưu Đơn Phục Hình'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
