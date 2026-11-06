import React, { useMemo, useState } from 'react';
import {
  DentalOrder,
  MaterialPriceConfig,
  ClinicMaterialPriceRow,
  LabProfileConfig,
  ClinicPartner,
} from '../types/dental';
import {
  MATERIAL_SHEET_FORM_LABELS,
  MaterialSheetFormLabel,
  categoryForSheetForm,
  groupMaterialPricesForSheet,
  materialSheetItemName,
  suggestedRetailFromUnitPrice,
  clinicHasCustomMaterialPrices,
  clinicMaterialPriceKey,
  listClinicsWithCustomMaterialPrices,
  materialConfigsFromClinicRows,
} from '../utils/financeUtils';
import { ClinicsView } from './ClinicsView';
import { FdiChartView } from './FdiChartView';
import { MaterialsCatalogView } from './MaterialsCatalogView';
import { WarrantyLookupView } from './WarrantyLookupView';
import { SaleCommissionsView } from './SaleCommissionsView';
import { UserManagementView } from './UserManagementView';
import { PayrollView } from './PayrollView';
import {
  Building2,
  Stethoscope,
  Layers,
  ShieldCheck,
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Users,
  Percent,
  BadgeDollarSign,
  Plus,
  Trash2,
} from 'lucide-react';

export type SettingsSubTab = 'clinics' | 'fdichart' | 'materials' | 'warranty' | 'profile' | 'users' | 'commissions' | 'payroll';


interface SettingsViewProps {
  initialSubTab?: SettingsSubTab;
  readOnly?: boolean;
  onSubTabChange?: (subTab: SettingsSubTab) => void;
  payroll?: React.ComponentProps<typeof PayrollView>;
  commissions?: React.ComponentProps<typeof SaleCommissionsView>;
  userManagement?: React.ComponentProps<typeof UserManagementView>;
  orders: DentalOrder[];
  clinicPartners: ClinicPartner[];
  onAddClinicPartner: (partner: ClinicPartner) => Promise<void>;
  onUpdateClinicPartner: (originalName: string, partner: ClinicPartner) => Promise<void>;
  onDeleteClinicPartner: (clinicName: string) => Promise<void>;
  materialPrices: MaterialPriceConfig[];
  clinicMaterialPrices: ClinicMaterialPriceRow[];
  labProfile: LabProfileConfig;
  warrantyLookupCode?: string;
  onUpdateMaterialPrices: (
    newPrices: MaterialPriceConfig[],
    applyToExistingOrders: boolean
  ) => void;
  onUpdateClinicMaterialPrices: (
    clinicName: string,
    newPrices: MaterialPriceConfig[],
    applyToExistingOrders: boolean
  ) => void;
  onDeleteClinicMaterialPrices: (clinicName: string) => void;
  onUpdateLabProfile: (profile: LabProfileConfig) => void;
  onSelectClinicForRevenue: (clinicName: string, monthYear?: string) => void;
  onExportClinicInvoice: (clinicOrders: DentalOrder[], clinicName: string, monthYear?: string) => void;
  onStartOrderWithTeeth: (teethText: string) => void;
  onViewFullCertificate: (order: DentalOrder) => void;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialSubTab = 'clinics',
  readOnly = false,
  onSubTabChange,
  payroll,
  userManagement,
  commissions,
  orders,
  clinicPartners,
  onAddClinicPartner,
  onUpdateClinicPartner,
  onDeleteClinicPartner,
  materialPrices,
  clinicMaterialPrices,
  labProfile,
  warrantyLookupCode = '',
  onUpdateMaterialPrices,
  onUpdateClinicMaterialPrices,
  onDeleteClinicMaterialPrices,
  onUpdateLabProfile,
  onSelectClinicForRevenue,
  onExportClinicInvoice,
  onStartOrderWithTeeth,
  onViewFullCertificate,
  onResetAllData,
}) => {
  const [selectedSubTab, setSubTab] = useState<SettingsSubTab>(initialSubTab);
  const restricted =
    (selectedSubTab === 'users' && !userManagement) ||
    (selectedSubTab === 'commissions' && !commissions) ||
    (selectedSubTab === 'payroll' && !payroll);
  const subTab = restricted ? 'clinics' : selectedSubTab;
  const emptyBrandDraft = {
    brand: '',
    origin: '',
    strengthMpa: '1200',
    defaultWarranty: '15 năm',
  };

  const [localPrices, setLocalPrices] = useState<MaterialPriceConfig[]>(materialPrices);
  const [localProfile, setLocalProfile] = useState<LabProfileConfig>(labProfile);
  const [savedNotice, setSavedNotice] = useState<string>('');
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [brandDraft, setBrandDraft] = useState(emptyBrandDraft);
  const [materialError, setMaterialError] = useState('');
  const [deleteBrandKey, setDeleteBrandKey] = useState<string | null>(null);
  const [deleteExtraId, setDeleteExtraId] = useState<string | null>(null);
  const [priceScope, setPriceScope] = useState<'shared' | 'clinic'>('shared');
  const [selectedClinicName, setSelectedClinicName] = useState('');
  const [removeClinicTableConfirm, setRemoveClinicTableConfirm] = useState(false);

  const activePartners = useMemo(
    () =>
      clinicPartners
        .filter((partner) => !partner.archived)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [clinicPartners]
  );

  const clinicsWithCustom = useMemo(
    () => listClinicsWithCustomMaterialPrices(clinicMaterialPrices),
    [clinicMaterialPrices]
  );

  React.useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  React.useEffect(() => {
    if (priceScope === 'shared') {
      setLocalPrices(materialPrices);
      return;
    }
    if (!selectedClinicName) {
      setLocalPrices([]);
      return;
    }
    if (clinicHasCustomMaterialPrices(selectedClinicName, clinicMaterialPrices)) {
      const key = clinicMaterialPriceKey(selectedClinicName);
      setLocalPrices(
        materialConfigsFromClinicRows(
          clinicMaterialPrices.filter((row) => row.clinicKey === key)
        )
      );
    } else {
      // Chưa có bảng riêng: hiện bản sao bảng chung để tạo / chỉnh trước khi lưu.
      setLocalPrices(materialPrices.map((item) => ({ ...item })));
    }
  }, [materialPrices, clinicMaterialPrices, priceScope, selectedClinicName]);

  const sheetView = useMemo(() => groupMaterialPricesForSheet(localPrices), [localPrices]);
  const materialsReadOnly =
    readOnly ||
    (priceScope === 'clinic' && (!selectedClinicName || !clinicHasCustomMaterialPrices(selectedClinicName, clinicMaterialPrices)));

  const makeMaterialId = (name: string, existing: MaterialPriceConfig[] = localPrices) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80);
    const base = `mat_${slug || 'vat_lieu'}`;
    if (!existing.some((item) => item.id === base)) return base;
    return `${base}_${Date.now().toString(36)}`.slice(0, 128);
  };

  const beginAddBrandForm = () => {
    if (priceScope === 'clinic' && !clinicHasCustomMaterialPrices(selectedClinicName, clinicMaterialPrices)) {
      setMaterialError('Hãy tạo bảng giá riêng cho nha khoa trước khi thêm dòng sứ.');
      return;
    }
    setMaterialError('');
    setDeleteBrandKey(null);
    setDeleteExtraId(null);
    setSavedNotice('');
    setBrandDraft(emptyBrandDraft);
    setMaterialFormOpen(true);
  };

  const clinicCustomActive =
    priceScope === 'clinic' &&
    !!selectedClinicName &&
    clinicHasCustomMaterialPrices(selectedClinicName, clinicMaterialPrices);

  const handleSavePrices = (applyToAllOrders: boolean) => {
    if (priceScope === 'clinic') {
      if (!selectedClinicName) {
        setMaterialError('Vui lòng chọn nha khoa để lưu bảng giá riêng.');
        return;
      }
      onUpdateClinicMaterialPrices(selectedClinicName, localPrices, applyToAllOrders);
      setSavedNotice(
        applyToAllOrders
          ? `Đã lưu bảng giá riêng cho ${selectedClinicName} và cập nhật đơn của nha khoa này!`
          : `Đã lưu bảng giá riêng cho ${selectedClinicName}!`
      );
    } else {
      onUpdateMaterialPrices(localPrices, applyToAllOrders);
      setSavedNotice(
        applyToAllOrders
          ? 'Đã lưu bảng giá chung và cập nhật lại đơn (ưu tiên bảng riêng nếu có)!'
          : 'Đã lưu bảng giá chung (dòng sứ & đơn giá)!'
      );
    }
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const commitPrices = (nextPrices: MaterialPriceConfig[], notice: string) => {
    setLocalPrices(nextPrices);
    if (priceScope === 'clinic') {
      if (!selectedClinicName) {
        setMaterialError('Vui lòng chọn nha khoa trước.');
        return;
      }
      onUpdateClinicMaterialPrices(selectedClinicName, nextPrices, false);
    } else {
      onUpdateMaterialPrices(nextPrices, false);
    }
    setSavedNotice(notice);
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const handleCreateClinicTable = () => {
    if (readOnly || !selectedClinicName) return;
    const seeded = materialPrices.map((item) => ({ ...item }));
    setLocalPrices(seeded);
    onUpdateClinicMaterialPrices(selectedClinicName, seeded, false);
    setSavedNotice(`Đã tạo bảng giá riêng cho ${selectedClinicName} (sao chép từ bảng chung).`);
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const handleRemoveClinicTable = () => {
    if (readOnly || !selectedClinicName) return;
    onDeleteClinicMaterialPrices(selectedClinicName);
    setRemoveClinicTableConfirm(false);
    setLocalPrices(materialPrices.map((item) => ({ ...item })));
    setSavedNotice(`Đã gỡ bảng giá riêng của ${selectedClinicName}. Đơn mới sẽ dùng bảng giá chung.`);
    setTimeout(() => setSavedNotice(''), 3500);
  };

  const handleSheetCellPrice = (
    brandKey: string,
    form: MaterialSheetFormLabel,
    value: number
  ) => {
    if (materialsReadOnly || !Number.isFinite(value) || value < 0) return;
    setLocalPrices((prev) => {
      const view = groupMaterialPricesForSheet(prev);
      const row = view.brandRows.find((item) => item.brandKey === brandKey);
      if (!row) return prev;
      const existing = row.byForm[form];
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                unitPrice: value,
                retailSuggestedPrice: suggestedRetailFromUnitPrice(value),
              }
            : item
        );
      }
      const name = materialSheetItemName(form, row.brand);
      const nextItem: MaterialPriceConfig = {
        id: makeMaterialId(name, prev),
        materialKey: name.toLowerCase(),
        name,
        category: categoryForSheetForm(form),
        origin: row.origin,
        strengthMpa: row.strengthMpa,
        defaultWarranty: row.defaultWarranty || '15 năm',
        unitPrice: value,
        retailSuggestedPrice: suggestedRetailFromUnitPrice(value),
      };
      return [...prev, nextItem];
    });
  };

  const handleBrandOriginChange = (brandKey: string, origin: string) => {
    if (materialsReadOnly) return;
    setLocalPrices((prev) => {
      const view = groupMaterialPricesForSheet(prev);
      const row = view.brandRows.find((item) => item.brandKey === brandKey);
      if (!row) return prev;
      const idSet = new Set(row.configIds);
      return prev.map((item) => (idSet.has(item.id) ? { ...item, origin } : item));
    });
  };

  const handleBrandRename = (brandKey: string, nextBrandRaw: string) => {
    if (materialsReadOnly) return;
    const nextBrand = nextBrandRaw.trim();
    if (!nextBrand) return;
    setLocalPrices((prev) => {
      const view = groupMaterialPricesForSheet(prev);
      const row = view.brandRows.find((item) => item.brandKey === brandKey);
      if (!row) return prev;
      if (nextBrand === row.brand) return prev;
      const nextKey = nextBrand.toLowerCase();
      if (view.brandRows.some((item) => item.brandKey === nextKey)) {
        setMaterialError('Tên dòng sứ đã tồn tại trong bảng.');
        return prev;
      }
      setMaterialError('');
      const idSet = new Set(row.configIds);
      return prev.map((item) => {
        if (!idSet.has(item.id)) return item;
        let formLabel: MaterialSheetFormLabel | null = null;
        for (const form of MATERIAL_SHEET_FORM_LABELS) {
          if (row.byForm[form]?.id === item.id) {
            formLabel = form;
            break;
          }
        }
        if (!formLabel) return item;
        const name = materialSheetItemName(formLabel, nextBrand);
        return {
          ...item,
          name,
          materialKey: name.toLowerCase(),
          category: categoryForSheetForm(formLabel),
        };
      });
    });
  };

  const handleSubmitBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (materialsReadOnly) return;
    const brand = brandDraft.brand.trim();
    if (!brand) {
      setMaterialError('Vui lòng nhập tên dòng sứ.');
      return;
    }
    const strengthMpa = Number(brandDraft.strengthMpa);
    if (!Number.isFinite(strengthMpa) || strengthMpa < 0) {
      setMaterialError('Độ cứng (MPa) không hợp lệ.');
      return;
    }
    const brandKey = brand.toLowerCase();
    if (sheetView.brandRows.some((item) => item.brandKey === brandKey)) {
      setMaterialError('Tên dòng sứ đã tồn tại trong bảng.');
      return;
    }
    const origin = brandDraft.origin.trim();
    const defaultWarranty = brandDraft.defaultWarranty.trim() || '15 năm';
    let working = [...localPrices];
    const created: MaterialPriceConfig[] = MATERIAL_SHEET_FORM_LABELS.map((form) => {
      const name = materialSheetItemName(form, brand);
      const item: MaterialPriceConfig = {
        id: makeMaterialId(name, working),
        materialKey: name.toLowerCase(),
        name,
        category: categoryForSheetForm(form),
        origin,
        strengthMpa,
        defaultWarranty,
        unitPrice: 0,
        retailSuggestedPrice: 0,
      };
      working = [...working, item];
      return item;
    });
    commitPrices([...localPrices, ...created], 'Đã thêm dòng sứ mới (5 cột giá = 0).');
    setMaterialFormOpen(false);
    setBrandDraft(emptyBrandDraft);
    setMaterialError('');
  };

  const handleDeleteBrand = () => {
    if (materialsReadOnly || !deleteBrandKey) return;
    const row = sheetView.brandRows.find((item) => item.brandKey === deleteBrandKey);
    if (!row) {
      setDeleteBrandKey(null);
      return;
    }
    const idSet = new Set(row.configIds);
    const nextPrices = localPrices.filter((item) => !idSet.has(item.id));
    commitPrices(nextPrices, `Đã xóa dòng sứ ${row.brand} (cả 5 loại giá).`);
    setDeleteBrandKey(null);
    setMaterialFormOpen(false);
  };

  const handleExtraPriceChange = (id: string, value: number) => {
    if (materialsReadOnly || !Number.isFinite(value) || value < 0) return;
    setLocalPrices((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              unitPrice: value,
              retailSuggestedPrice: suggestedRetailFromUnitPrice(value),
            }
          : item
      )
    );
  };

  const handleDeleteExtra = () => {
    if (materialsReadOnly || !deleteExtraId) return;
    const nextPrices = localPrices.filter((item) => item.id !== deleteExtraId);
    commitPrices(nextPrices, 'Đã xóa dòng phụ khỏi danh mục!');
    setDeleteExtraId(null);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateLabProfile(localProfile);
    setSavedNotice('Đã lưu cấu hình Labo & Hóa đơn PDF!');
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const subTabs = [
    { id: 'clinics' as SettingsSubTab, label: 'Đối Tác Nha Khoa', icon: Building2 },
    { id: 'fdichart' as SettingsSubTab, label: 'Sơ Đồ Răng', icon: Stethoscope },
    { id: 'materials' as SettingsSubTab, label: 'Vật Liệu Sứ', icon: Layers },
    { id: 'warranty' as SettingsSubTab, label: 'Tra Cứu Bảo Hành', icon: ShieldCheck },
    { id: 'profile' as SettingsSubTab, label: 'Cấu Hình Labo', icon: Settings },
    ...(payroll ? [{ id: 'payroll' as SettingsSubTab, label: 'Bảng lương nhân viên', icon: BadgeDollarSign }] : []),
    ...(commissions ? [{ id: 'commissions' as SettingsSubTab, label: 'Hoa hồng sale', icon: Percent }] : []),
    ...(userManagement ? [{ id: 'users' as SettingsSubTab, label: 'Người dùng', icon: Users }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Compact Sub-navigation Bar */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSubTab(t.id);
                  onSubTabChange?.(t.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-teal-500 text-white dark:text-slate-950 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    active ? 'text-teal-400 dark:text-slate-950' : 'text-slate-400'
                  }`}
                />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {savedNotice && (
          <div className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}
      </div>

      {subTab === 'payroll' && payroll && <PayrollView {...payroll} />}

      {subTab === 'commissions' && commissions && <SaleCommissionsView {...commissions} />}

      {subTab === 'users' && userManagement && <UserManagementView {...userManagement} />}

      {subTab === 'clinics' && (
        <ClinicsView
          orders={orders}
          readOnly={readOnly}
          partners={clinicPartners}
          onAddPartner={onAddClinicPartner}
          onUpdatePartner={onUpdateClinicPartner}
          onDeletePartner={onDeleteClinicPartner}
          onSelectClinicFilter={onSelectClinicForRevenue}
          onExportClinicInvoice={onExportClinicInvoice}
        />
      )}

      {subTab === 'fdichart' && (
        <FdiChartView
          orders={orders}
          readOnly={readOnly}
          onStartOrderWithTeeth={onStartOrderWithTeeth}
        />
      )}

      {subTab === 'materials' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-teal-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {priceScope === 'shared' ? 'Bảng giá chung' : 'Bảng giá theo nha khoa'}
                      {' '}({sheetView.brandRows.length} dòng sứ)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {priceScope === 'shared'
                        ? 'Bảng mặc định cho mọi nha khoa chưa có bảng riêng. Đơn mới lấy giá theo nha khoa → bảng riêng nếu có, không thì bảng này.'
                        : 'Chọn nha khoa để tạo / chỉnh bảng giá riêng. Đơn của nha khoa đó sẽ ưu tiên bảng này.'}
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    {(priceScope === 'shared' || clinicCustomActive) && (
                      <>
                        <button
                          type="button"
                          onClick={beginAddBrandForm}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Thêm dòng sứ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePrices(false)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {priceScope === 'shared' ? 'Lưu bảng chung' : 'Lưu bảng riêng'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950/60">
                  <button
                    type="button"
                    onClick={() => {
                      setPriceScope('shared');
                      setMaterialError('');
                      setRemoveClinicTableConfirm(false);
                      setMaterialFormOpen(false);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer ${
                      priceScope === 'shared'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Bảng giá chung
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriceScope('clinic');
                      setMaterialError('');
                      setRemoveClinicTableConfirm(false);
                      setMaterialFormOpen(false);
                      if (!selectedClinicName && activePartners[0]) {
                        setSelectedClinicName(activePartners[0].name);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer ${
                      priceScope === 'clinic'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Bảng giá theo nha khoa
                  </button>
                </div>

                {priceScope === 'clinic' && (
                  <>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <span className="whitespace-nowrap">Nha khoa</span>
                      <select
                        value={selectedClinicName}
                        onChange={(e) => {
                          setSelectedClinicName(e.target.value);
                          setMaterialError('');
                          setRemoveClinicTableConfirm(false);
                          setMaterialFormOpen(false);
                          setDeleteBrandKey(null);
                        }}
                        className="min-h-9 min-w-[12rem] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 font-bold text-slate-900 dark:text-white"
                      >
                        <option value="">— Chọn nha khoa —</option>
                        {activePartners.map((partner) => {
                          const hasCustom = clinicHasCustomMaterialPrices(partner.name, clinicMaterialPrices);
                          return (
                            <option key={partner.id || partner.name} value={partner.name}>
                              {partner.name}{hasCustom ? ' · có bảng riêng' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    {clinicsWithCustom.length > 0 && (
                      <span className="text-[11px] text-slate-500">
                        Đang có bảng riêng: {clinicsWithCustom.join(', ')}
                      </span>
                    )}
                  </>
                )}
              </div>

              {priceScope === 'clinic' && selectedClinicName && !clinicCustomActive && !readOnly && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    <strong>{selectedClinicName}</strong> đang dùng <strong>bảng giá chung</strong>.
                    Tạo bảng riêng (sao chép từ bảng chung) rồi chỉnh giá áp dụng cho nha khoa này.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateClinicTable}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-700 hover:bg-amber-600 text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tạo bảng giá riêng
                  </button>
                </div>
              )}

              {priceScope === 'clinic' && clinicCustomActive && !readOnly && (
                <div className="flex flex-wrap items-center gap-2">
                  {!removeClinicTableConfirm ? (
                    <button
                      type="button"
                      onClick={() => setRemoveClinicTableConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Gỡ bảng riêng (về bảng chung)
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-rose-700 dark:text-rose-300">
                        Xóa toàn bộ bảng giá riêng của {selectedClinicName}?
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveClinicTable}
                        className="px-3 py-1.5 font-bold rounded-lg bg-rose-700 text-white hover:bg-rose-800 cursor-pointer"
                      >
                        Xác nhận gỡ
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveClinicTableConfirm(false)}
                        className="px-3 py-1.5 font-bold rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!materialsReadOnly && materialFormOpen && (
              <form
                onSubmit={handleSubmitBrand}
                className="px-4 py-4 border-b border-teal-100 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20 space-y-3"
                aria-label="Thêm dòng sứ"
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Thêm dòng sứ mới
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tạo 1 hàng trên bảng với 5 cột giá (mặc định 0). Điền giá trực tiếp trên bảng sau khi thêm.
                </p>
                {materialError && (
                  <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {materialError}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                  <label className="grid gap-1 font-medium text-slate-600 dark:text-slate-300">
                    Dòng sứ *
                    <input
                      required
                      maxLength={150}
                      value={brandDraft.brand}
                      onChange={(e) => setBrandDraft({ ...brandDraft, brand: e.target.value })}
                      placeholder="VD: Cercon HT"
                      className="min-h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                  <label className="grid gap-1 font-medium text-slate-600 dark:text-slate-300">
                    Xuất xứ
                    <input
                      maxLength={150}
                      value={brandDraft.origin}
                      onChange={(e) => setBrandDraft({ ...brandDraft, origin: e.target.value })}
                      placeholder="VD: Đức"
                      className="min-h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                  <label className="grid gap-1 font-medium text-slate-600 dark:text-slate-300">
                    Bảo hành mặc định
                    <input
                      maxLength={64}
                      value={brandDraft.defaultWarranty}
                      onChange={(e) => setBrandDraft({ ...brandDraft, defaultWarranty: e.target.value })}
                      className="min-h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                  <label className="grid gap-1 font-medium text-slate-600 dark:text-slate-300">
                    Độ cứng (MPa)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={brandDraft.strengthMpa}
                      onChange={(e) => setBrandDraft({ ...brandDraft, strengthMpa: e.target.value })}
                      className="min-h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                </div>
                <div className="flex gap-2 text-xs font-bold">
                  <button
                    type="submit"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-white hover:bg-teal-800 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Thêm vào bảng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMaterialFormOpen(false);
                      setMaterialError('');
                    }}
                    className="min-h-10 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}

            {!materialsReadOnly && deleteBrandKey && (
              <div
                role="group"
                aria-label="Xác nhận xóa dòng sứ"
                className="px-4 py-4 border-b border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 space-y-2"
              >
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Xóa dòng sứ{' '}
                  {sheetView.brandRows.find((item) => item.brandKey === deleteBrandKey)?.brand || ''}?
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Sẽ gỡ cả 5 loại giá (Sườn / Full / Veneer / Sườn implant / Full implant) khỏi danh mục. Đơn đã tạo vẫn giữ tên vật liệu cũ.
                </p>
                <div className="flex gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={handleDeleteBrand}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 text-white hover:bg-rose-800 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa dòng sứ
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteBrandKey(null)}
                    className="min-h-10 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {!materialsReadOnly && deleteExtraId && (
              <div
                role="group"
                aria-label="Xác nhận xóa dòng phụ"
                className="px-4 py-4 border-b border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 space-y-2"
              >
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Xóa {localPrices.find((item) => item.id === deleteExtraId)?.name || ''}?
                </p>
                <div className="flex gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={handleDeleteExtra}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 text-white hover:bg-rose-800 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteExtraId(null)}
                    className="min-h-10 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {materialError && !materialFormOpen && (
              <p role="alert" className="px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 border-b border-rose-100 dark:border-rose-900">
                {materialError}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 sticky left-0 bg-slate-50 dark:bg-slate-950/95 z-10">Dòng sứ</th>
                    <th className="py-2.5 px-3">Xuất xứ</th>
                    {MATERIAL_SHEET_FORM_LABELS.map((form) => (
                      <th key={form} className="py-2.5 px-2 text-right whitespace-nowrap">
                        {form}
                      </th>
                    ))}
                    {!materialsReadOnly && <th className="py-2.5 px-3 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {sheetView.brandRows.map((row) => (
                    <tr
                      key={row.brandKey}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-1.5 px-3 sticky left-0 bg-white dark:bg-slate-900 z-10">
                        {materialsReadOnly ? (
                          <span className="font-bold text-slate-900 dark:text-white">{row.brand}</span>
                        ) : (
                          <input
                            key={`${row.brandKey}-brand`}
                            defaultValue={row.brand}
                            onBlur={(e) => handleBrandRename(row.brandKey, e.target.value)}
                            className="w-36 min-h-9 px-2 py-1 font-bold text-slate-900 dark:text-white bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-teal-500 rounded-md"
                            aria-label={`Dòng sứ ${row.brand}`}
                          />
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        {materialsReadOnly ? (
                          <span className="text-slate-500">{row.origin}</span>
                        ) : (
                          <input
                            value={row.origin}
                            onChange={(e) => handleBrandOriginChange(row.brandKey, e.target.value)}
                            className="w-24 min-h-9 px-2 py-1 text-slate-600 dark:text-slate-300 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-teal-500 rounded-md"
                            aria-label={`Xuất xứ ${row.brand}`}
                          />
                        )}
                      </td>
                      {MATERIAL_SHEET_FORM_LABELS.map((form) => {
                        const cell = row.byForm[form];
                        return (
                          <td key={form} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              step={1000}
                              min={0}
                              disabled={materialsReadOnly}
                              value={cell?.unitPrice ?? ''}
                              placeholder="—"
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') return;
                                handleSheetCellPrice(row.brandKey, form, Number(raw));
                              }}
                              className="w-[5.5rem] px-1.5 py-1 text-right font-mono font-bold text-teal-800 dark:text-teal-300 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-2 focus:ring-teal-500 disabled:opacity-70"
                              aria-label={`${form} ${row.brand}`}
                            />
                          </td>
                        );
                      })}
                      {!materialsReadOnly && (
                        <td className="py-1.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteBrandKey(row.brandKey);
                              setDeleteExtraId(null);
                              setMaterialFormOpen(false);
                              setSavedNotice('');
                            }}
                            aria-label={`Xóa ${row.brand}`}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-500/10 cursor-pointer dark:text-rose-300 font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {sheetView.brandRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={materialsReadOnly ? 7 : 8}
                        className="px-4 py-6 text-center text-slate-500"
                      >
                        Chưa có dòng sứ nào. Bấm &quot;Thêm dòng sứ&quot; để tạo danh mục.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {sheetView.extras.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-800">
                <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-950/40">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Dòng phụ (không theo sheet) — ví dụ Cùi giả
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[11px]">
                      <tr>
                        <th className="py-2 px-4">Dòng sứ</th>
                        <th className="py-2 px-4">Xuất xứ</th>
                        <th className="py-2 px-4 text-right">Đơn giá (VNĐ)</th>
                        {!materialsReadOnly && <th className="py-2 px-4 text-right">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {sheetView.extras.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-4 font-bold text-slate-900 dark:text-white">{item.name}</td>
                          <td className="py-2 px-4 text-slate-500">{item.origin}</td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              step={10000}
                              min={0}
                              disabled={materialsReadOnly}
                              value={item.unitPrice}
                              onChange={(e) => handleExtraPriceChange(item.id, Number(e.target.value))}
                              className="w-28 px-2 py-1 text-right font-mono font-bold text-teal-800 dark:text-teal-300 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-2 focus:ring-teal-500 disabled:opacity-70"
                            />
                          </td>
                          {!materialsReadOnly && (
                            <td className="py-2 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteExtraId(item.id);
                                  setDeleteBrandKey(null);
                                  setMaterialFormOpen(false);
                                }}
                                aria-label={`Xóa ${item.name}`}
                                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-500/10 cursor-pointer dark:text-rose-300 font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Xóa
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <MaterialsCatalogView />
        </div>
      )}

      {subTab === 'warranty' && (
        <WarrantyLookupView
          orders={orders}
          initialCode={warrantyLookupCode}
          onViewFullCertificate={onViewFullCertificate}
        />
      )}

      {subTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4 text-xs"
          >
            <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Thông Tin Labo & Tài Khoản Ngân Hàng Trên Hóa Đơn PDF
              </h3>
            </div>

            <fieldset disabled={readOnly} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 disabled:opacity-75">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Tên Labo
                </label>
                <input
                  type="text"
                  value={localProfile.labName}
                  onChange={(e) =>
                    setLocalProfile({ ...localProfile, labName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Giám Đốc Kỹ Thuật
                </label>
                <input
                  type="text"
                  value={localProfile.directorName}
                  onChange={(e) =>
                    setLocalProfile({ ...localProfile, directorName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Hotline
                </label>
                <input
                  type="text"
                  value={localProfile.hotline}
                  onChange={(e) =>
                    setLocalProfile({ ...localProfile, hotline: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Địa Chỉ
                </label>
                <input
                  type="text"
                  value={localProfile.address}
                  onChange={(e) =>
                    setLocalProfile({ ...localProfile, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Ngân Hàng
                </label>
                <input
                  type="text"
                  value={localProfile.bankName}
                  onChange={(e) =>
                    setLocalProfile({ ...localProfile, bankName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Số Tài Khoản
                </label>
                <input
                  type="text"
                  value={localProfile.bankAccountNumber}
                  onChange={(e) =>
                    setLocalProfile({
                      ...localProfile,
                      bankAccountNumber: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Chủ Tài Khoản
                </label>
                <input
                  type="text"
                  value={localProfile.bankAccountHolder}
                  onChange={(e) =>
                    setLocalProfile({
                      ...localProfile,
                      bankAccountHolder: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </fieldset>

            {!readOnly && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Lưu Cấu Hình
                </button>
              </div>
            )}
          </form>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Dữ liệu hệ thống ({orders.length.toLocaleString()} ca)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tải lại đơn hàng, bảng giá, công nợ và thu chi đã lưu trên hệ thống.
              </p>
            </div>

            <button
              type="button"
              onClick={onResetAllData}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tải lại dữ liệu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
