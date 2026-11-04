import React, { useState } from 'react';
import {
  DentalOrder,
  MaterialPriceConfig,
  LabProfileConfig,
  ClinicPartner,
} from '../types/dental';
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
  materialPrices: MaterialPriceConfig[];
  labProfile: LabProfileConfig;
  warrantyLookupCode?: string;
  onUpdateMaterialPrices: (
    newPrices: MaterialPriceConfig[],
    applyToExistingOrders: boolean
  ) => void;
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
  materialPrices,
  labProfile,
  warrantyLookupCode = '',
  onUpdateMaterialPrices,
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
  const [localPrices, setLocalPrices] = useState<MaterialPriceConfig[]>(materialPrices);
  const [localProfile, setLocalProfile] = useState<LabProfileConfig>(labProfile);
  const [savedNotice, setSavedNotice] = useState<string>('');

  React.useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  React.useEffect(() => {
    setLocalPrices(materialPrices);
  }, [materialPrices]);

  const handlePriceInputChange = (id: string, value: number) => {
    setLocalPrices((prev) =>
      prev.map((p) => (p.id === id ? { ...p, unitPrice: value } : p))
    );
  };

  const handleSavePrices = (applyToAllOrders: boolean) => {
    onUpdateMaterialPrices(localPrices, applyToAllOrders);
    setSavedNotice(
      applyToAllOrders
        ? 'Đã lưu bảng giá và cập nhật lại toàn bộ đơn hàng!'
        : 'Đã lưu danh mục dòng sứ & đơn giá tham khảo!'
    );
    setTimeout(() => setSavedNotice(''), 3000);
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
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-teal-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Danh Mục Dòng Sứ & Bảng Giá Tham Khảo ({localPrices.length} dòng sứ)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Thành tiền của từng đơn trong bảng Doanh thu & Đơn hàng được tự nhập trực tiếp (không tự động lấy từ bảng giá).
                  </p>
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSavePrices(false)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Lưu Danh Mục Giá
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Dòng Sứ</th>
                    <th className="py-2.5 px-4">Phân Khúc</th>
                    <th className="py-2.5 px-4">Xuất Xứ</th>
                    <th className="py-2.5 px-3">Độ Cứng</th>
                    <th className="py-2.5 px-3">Bảo Hành</th>
                    <th className="py-2.5 px-4 text-right">Đơn Giá Tham Khảo (VNĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {localPrices.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2 px-4 font-bold text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="py-2 px-4 text-slate-600 dark:text-slate-400">
                        {item.category}
                      </td>
                      <td className="py-2 px-4 text-slate-500">{item.origin}</td>
                      <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                        {item.strengthMpa} MPa
                      </td>
                      <td className="py-2 px-3 font-semibold text-amber-700 dark:text-amber-400">
                        {item.defaultWarranty}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            step={10000}
                            disabled={readOnly}
                            value={item.unitPrice}
                            onChange={(e) =>
                              handlePriceInputChange(item.id, Number(e.target.value))
                            }
                            className="w-28 px-2 py-1 text-right font-mono font-bold text-teal-800 dark:text-teal-300 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-2 focus:ring-teal-500 disabled:opacity-70"
                          />
                          <span className="text-slate-400 font-mono">₫</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
