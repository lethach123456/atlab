import React, { useState, useEffect, useMemo } from 'react';
import {
  DentalOrder,
  MaterialPriceConfig,
  DebtPaymentRecord,
  ClinicDebtRecord,
  ClinicPartner,
  CashflowTransaction,
  DeliveryRecord,
  LabProfileConfig,
} from './types/dental';
import {
  saveOrders,
  createOrder,
  getClinicPartners,
  updateOrder,
  deleteOrder,
  saveMaterialPrices,
  saveClinicDebts,
  saveDebtPayments,
  saveDeliveries,
  saveCashflows,
  saveLabProfile,
} from './services/storage';
import {
  getUnitPriceForMaterial,
  extractMonthYear,
  sortMonthYearsDesc,
  getPreviousMonthYear,
} from './utils/financeUtils';
import { Header, NavTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { RevenueView } from './components/RevenueView';
import { OrderListView } from './components/OrderListView';
import { DebtManagementView } from './components/DebtManagementView';
import { CashflowView } from './components/CashflowView';
import { DeliveryManagementView } from './components/DeliveryManagementView';
import { PayrollView } from './components/PayrollView';
import { SettingsView, SettingsSubTab } from './components/SettingsView';
import { WarrantyCardModal } from './components/WarrantyCardModal';
import { LabTicketModal } from './components/LabTicketModal';
import { OrderFormModal } from './components/OrderFormModal';
import { InvoicePdfModal } from './components/InvoicePdfModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import type { UserProfile } from './types/user';
import { AuthGate } from './components/AuthGate';
import type { SaleCommission } from './types/commission';
import {
  saveCommission,
  saveCommissions,
  deleteCommission,
  deleteCommissions,
  subscribeCommissions,
} from './services/commissions';
import type { EmployeePayroll } from './types/payroll';
import { subscribePayrolls, savePayrollRecord, deletePayrollRecord } from './services/payrolls';
import { accountError, createAccount, subscribeUsers, updateAccount } from './services/userAccounts';
import { commitWorkspaceChanges, saveWorkspaceRecord, deleteWorkspaceRecord, subscribeWorkspaceData, WorkspaceChange } from './services/workspaceData';

export default function App() {
  return <AuthGate>{(profile) => <Workspace key={profile.uid} profile={profile} />}</AuthGate>;
}

function changedFields<T extends object>(before: T, after: T) {
  return Object.fromEntries((Object.keys(after) as (keyof T)[])
    .filter((key) => !Object.is(before[key], after[key]))
    .map((key) => [key, after[key]]));
}

function loadNavigationSession(key: string, isAdmin: boolean): { activeTab: NavTab; settingsSubTab: SettingsSubTab } {
  const fallback = { activeTab: 'dashboard' as NavTab, settingsSubTab: 'clinics' as SettingsSubTab };
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    const tabs: NavTab[] = ['dashboard', 'revenue', 'orders', 'debt', 'cashflow', 'delivery', 'payroll', 'settings'];
    const subTabs: SettingsSubTab[] = ['clinics', 'fdichart', 'materials', 'warranty', 'profile', 'users', 'commissions', 'payroll'];
    const restrictedSubTab = !isAdmin && (saved?.settingsSubTab === 'users' || saved?.settingsSubTab === 'commissions' || saved?.settingsSubTab === 'payroll');
    const restrictedMainTab = !isAdmin && saved?.activeTab === 'payroll';
    return {
      activeTab: tabs.includes(saved?.activeTab) && !restrictedMainTab ? saved.activeTab : fallback.activeTab,
      settingsSubTab: subTabs.includes(saved?.settingsSubTab) && !restrictedSubTab ? saved.settingsSubTab : fallback.settingsSubTab,
    };
  } catch {
    return fallback;
  }
}

function Workspace({ profile }: { profile: UserProfile }) {
  const [orders, setOrders] = useState<DentalOrder[]>([]);
  const [materialPrices, setMaterialPrices] = useState<MaterialPriceConfig[]>([]);
  const [clinicDebts, setClinicDebts] = useState<ClinicDebtRecord[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPaymentRecord[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [cashflows, setCashflows] = useState<CashflowTransaction[]>([]);
  const [labProfile, setLabProfile] = useState<LabProfileConfig>({ labName: '', tagline: '', hotline: '', address: '', email: '', bankName: '', bankAccountNumber: '', bankAccountHolder: '', directorName: '' });
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [pendingWrites, setPendingWrites] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [commissions, setCommissions] = useState<SaleCommission[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [commissionsError, setCommissionsError] = useState('');
  const [payrolls, setPayrolls] = useState<EmployeePayroll[]>([]);
  const [payrollsLoading, setPayrollsLoading] = useState(true);
  const [payrollsError, setPayrollsError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const ownerId = profile.workspaceOwnerId;
  const isReadOnly = profile.role === 'viewer';

  function write(action: Promise<void>) {
    if (isReadOnly) return;
    setPendingWrites((count) => count + 1);
    setSyncError('');
    void action.catch((error) => {
      setSyncError(error.message);
      setRefresh((value) => value + 1);
    }).finally(() => setPendingWrites((count) => count - 1));
  }



  // Theme state (Light / 2026 Dark)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('at_dental_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('at_dental_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('at_dental_theme', 'light');
    }
  }, [isDark]);

  // Navigation state
  const navigationStorageKey = `at_dental_navigation:${ownerId}:${profile.uid}`;
  const [activeTab, setActiveTab] = useState<NavTab>(() => loadNavigationSession(navigationStorageKey, profile.role === 'admin').activeTab);
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>(() => loadNavigationSession(navigationStorageKey, profile.role === 'admin').settingsSubTab);

  useEffect(() => {
    try {
      localStorage.setItem(navigationStorageKey, JSON.stringify({ activeTab, settingsSubTab }));
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  }, [navigationStorageKey, activeTab, settingsSubTab]);

  useEffect(() => {
    if (profile.role !== 'admin') {
      if (settingsSubTab === 'users' || settingsSubTab === 'commissions' || settingsSubTab === 'payroll') {
        setSettingsSubTab('clinics');
      }
      if (activeTab === 'payroll') {
        setActiveTab('dashboard');
      }
    }
  }, [profile.role, settingsSubTab, activeTab]);

  // Cross-view filters
  const [revenueMonthFilter, setRevenueMonthFilter] = useState<string>('');
  const [revenueClinicFilter, setRevenueClinicFilter] = useState<string>('');
  const [warrantyLookupCode, setWarrantyLookupCode] = useState<string>('');

  // Modals state
  const [warrantyModalOrder, setWarrantyModalOrder] = useState<DentalOrder | null>(null);
  const [ticketModalOrder, setTicketModalOrder] = useState<DentalOrder | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<DentalOrder | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global keyboard shortcut Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // PDF Invoice Modal state
  const [invoiceModalData, setInvoiceModalData] = useState<{
    isOpen: boolean;
    orders: DentalOrder[];
    clinicName: string;
    monthYear: string;
    paidAmount: number;
    shippingFeeTotal: number;
    previousMonthDebt: number;
    previousMonthLabel: string;
  }>({
    isOpen: false,
    orders: [],
    clinicName: '',
    monthYear: '',
    paidAmount: 0,
    shippingFeeTotal: 0,
    previousMonthDebt: 0,
    previousMonthLabel: '',
  });

  useEffect(() => {
    setLoading(true);
    let importingPartners = false;
    return subscribeWorkspaceData(ownerId, (data) => {
      const migrationKey = 'at_dental_partners_migrated_' + ownerId;
      if (profile.uid === ownerId && !importingPartners && localStorage.getItem(migrationKey) !== 'done') {
        const localPartners = getClinicPartners().filter((partner) =>
          !data.partners.some((saved) => saved.name.trim().toLowerCase() === partner.name.trim().toLowerCase())
        );
        importingPartners = true;
        const migrate = async () => {
          for (const partner of localPartners) {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(partner.name.trim().toLowerCase()));
            const id = 'partner_' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
            await saveWorkspaceRecord('clinicPartners', id, partner, ownerId, true);
          }
          localStorage.setItem(migrationKey, 'done');
        };
        void migrate().catch(() => setSyncError('Chưa chuyển được đối tác đã lưu trên máy. Bấm tải lại dữ liệu để thử lại.'));
      }
      setOrders(data.orders);
      setMaterialPrices(data.prices);
      setClinicDebts(data.debts);
      setDebtPayments(data.payments);
      setDeliveries(data.deliveries);
      setCashflows(data.cashflows);
      setClinicPartners(data.partners);
      setLabProfile(data.profile);
      setLoading(false);
    }, (error) => setSyncError(error.message));
  }, [ownerId, profile.uid, refresh]);

  useEffect(() => {
    if (profile.role !== 'admin') {
      setUsers([]);
      return;
    }
    return subscribeUsers(ownerId, setUsers, () => setSyncError('Không đọc được danh sách tài khoản.'));
  }, [ownerId, profile.role]);

  useEffect(() => {
    setCommissions([]);
    if (profile.role !== 'admin') return;
    setCommissionsLoading(true);
    setCommissionsError('');
    return subscribeCommissions(ownerId, (records) => {
      setCommissions(records);
      setCommissionsLoading(false);
    }, () => {
      setCommissionsError('Không tải được cấu hình hoa hồng. Vui lòng tải lại trang.');
      setCommissionsLoading(false);
    });
  }, [ownerId, profile.role]);

  useEffect(() => {
    setPayrolls([]);
    if (profile.role !== 'admin') return;
    setPayrollsLoading(true);
    setPayrollsError('');
    return subscribePayrolls(ownerId, (records) => {
      setPayrolls(records);
      setPayrollsLoading(false);
    }, (msg) => {
      setPayrollsError(msg);
      setPayrollsLoading(false);
    });
  }, [ownerId, profile.role]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.monthYear) set.add(o.monthYear);
    });
    return sortMonthYearsDesc(Array.from(set));
  }, [orders]);

  const [clinicPartners, setClinicPartners] = useState<ClinicPartner[]>([]);

  const addClinicPartner = async (partner: ClinicPartner) => {
    if (isReadOnly) return;
    await saveWorkspaceRecord('clinicPartners', 'partner_' + crypto.randomUUID(), partner, ownerId, true);
  };

  const clinicOptions = useMemo(() => {
    const addresses = new Map<string, string>();
    for (const order of orders) {
      const name = order.clinicName?.trim();
      if (!name) continue;
      const address = order.clinicAddress?.trim() || '';
      const knownAddress = addresses.get(name);
      if (!knownAddress || (knownAddress === 'Đà Nẵng' && address)) {
        addresses.set(name, address || knownAddress || '');
      }
    }
    for (const partner of clinicPartners) {
      addresses.set(partner.name, partner.address.trim() || addresses.get(partner.name) || '');
    }
    return Array.from(addresses, ([name, address]) => ({ name, address }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [orders, clinicPartners]);

  const clinicNames = useMemo(() => clinicOptions.map(({ name }) => name), [clinicOptions]);

  const handleTabChange = (tab: NavTab, subTab?: SettingsSubTab) => {
    setActiveTab(tab);
    if (subTab) {
      setSettingsSubTab(subTab);
    }
  };

  // Order CRUD
  const handleSaveOrder = (orderData: Partial<DentalOrder>) => {
    if (isReadOnly) return;
    if (editingOrder && editingOrder.id) {
      const updated = {
        ...editingOrder,
        ...orderData,
      } as DentalOrder;
      if (updated.orderDate !== editingOrder.orderDate) {
        updated.monthYear = extractMonthYear(updated.orderDate);
      }
      const patch = changedFields(editingOrder, updated);
      const current = orders.find((order) => order.id === updated.id);
      if (!current) {
        setSyncError('Đơn hàng này đã bị xóa.');
        setEditingOrder(null);
        return;
      }
      const newList = updateOrder({ ...current, ...patch }, orders);
      setOrders(newList);
      if (Object.keys(patch).length) write(saveWorkspaceRecord('orders', updated.id, patch, ownerId));
    } else {
      const { newOrder, updatedOrders } = createOrder(
        orderData,
        orders,
        materialPrices
      );
      setOrders(updatedOrders);
      setWarrantyModalOrder(newOrder);
      write(saveWorkspaceRecord('orders', newOrder.id, newOrder, ownerId, true));

    }
    setEditingOrder(null);
  };

  const handleQuickAddOrder = async (data: Partial<DentalOrder>) => {
    if (isReadOnly) throw new Error('Tài khoản chỉ có quyền xem.');
    const { newOrder } = createOrder(data, orders, materialPrices);
    await saveWorkspaceRecord('orders', newOrder.id, newOrder, ownerId, true);
    setOrders((current) => current.some(({ id }) => id === newOrder.id) ? current : [newOrder, ...current]);
    return newOrder;
  };

  const handleUpdateOrderDirect = (updated: DentalOrder) => {
    if (isReadOnly) return;
    const current = orders.find((order) => order.id === updated.id);
    if (!current) return;
    const newList = updateOrder(updated, orders);
    setOrders(newList);
    const patch = changedFields(current, updated);
    if (Object.keys(patch).length) write(saveWorkspaceRecord('orders', updated.id, patch, ownerId));
  };

  const handleDeleteOrder = (id: string) => {
    if (isReadOnly) return;
    const newList = deleteOrder(id, orders);
    setOrders(newList);
    write(deleteWorkspaceRecord('orders', id, ownerId));
  };

  const handleOpenNewOrder = (presetTeeth?: string) => {
    if (isReadOnly) return;
    setEditingOrder(presetTeeth ? ({ teeth: presetTeeth } as any) : null);
    setIsFormOpen(true);
  };

  const handleEditOrder = (order: DentalOrder) => {
    if (isReadOnly) return;
    setEditingOrder(order);
    setIsFormOpen(true);
  };

  // Debt Payment CRUD
  const handleAddDebtPayment = (
    paymentData: Omit<DebtPaymentRecord, 'id' | 'createdAt'>
  ) => {
    if (isReadOnly) return;
    const newPayment: DebtPaymentRecord = {
      ...paymentData,
      id: `pay_${Date.now()}`,
      createdAt: Date.now(),
    };
    const nextPayments = [newPayment, ...debtPayments];
    setDebtPayments(nextPayments);
    saveDebtPayments(nextPayments);


    const newCf: CashflowTransaction = {
      id: `cf_inc_${newPayment.id}`,
      type: 'income',
      category: 'Thu công nợ nha khoa',
      title: `Thu công nợ răng sứ - ${newPayment.clinicName} (Kỳ ${newPayment.monthYear})`,
      amount: newPayment.amount,
      date: newPayment.paymentDate,
      monthYear: newPayment.monthYear,
      clinicName: newPayment.clinicName,
      paymentMethod: newPayment.method,
      notes: newPayment.notes,
      createdAt: Date.now(),
    };
    const nextCf = [newCf, ...cashflows];
    setCashflows(nextCf);
    saveCashflows(nextCf);
    write(commitWorkspaceChanges(ownerId, [
      { collection: 'debtPayments', id: newPayment.id, data: newPayment, isNew: true },
      { collection: 'cashflows', id: newCf.id, data: newCf, isNew: true },
    ]));

  };

  const handleDeleteDebtPayment = (id: string) => {
    if (isReadOnly) return;
    const next = debtPayments.filter((p) => p.id !== id);
    setDebtPayments(next);
    saveDebtPayments(next);
    const incomeId = 'cf_inc_' + id;
    setCashflows((items) => items.filter((item) => item.id !== incomeId));
    write(commitWorkspaceChanges(ownerId, [
      { collection: 'debtPayments', id },
      { collection: 'cashflows', id: incomeId },
    ]));

  };

  // Cashflow CRUD
  const handleAddCashflow = (
    txData: Omit<CashflowTransaction, 'id' | 'createdAt'>
  ) => {
    if (isReadOnly) return;
    const newTx: CashflowTransaction = {
      ...txData,
      id: `cf_${Date.now()}`,
      createdAt: Date.now(),
    };
    const next = [newTx, ...cashflows];
    setCashflows(next);
    saveCashflows(next);
    write(saveWorkspaceRecord('cashflows', newTx.id, newTx, ownerId, true));

  };

  const handleDeleteCashflow = (id: string) => {
    if (isReadOnly) return;
    const next = cashflows.filter((t) => t.id !== id);
    setCashflows(next);
    saveCashflows(next);
    write(deleteWorkspaceRecord('cashflows', id, ownerId));

  };

  // Delivery CRUD
  const handleAddDelivery = (
    delivData: Omit<DeliveryRecord, 'id' | 'createdAt'>
  ) => {
    if (isReadOnly) return;
    const newDeliv: DeliveryRecord = {
      ...delivData,
      id: `deliv_${Date.now()}`,
      createdAt: Date.now(),
    };
    const next = [newDeliv, ...deliveries];
    setDeliveries(next);
    saveDeliveries(next);
    write(saveWorkspaceRecord('deliveries', newDeliv.id, newDeliv, ownerId, true));

  };

  const handleUpdateDelivery = async (id: string, changes: Partial<DeliveryRecord>) => {
    if (isReadOnly) return;
    await saveWorkspaceRecord('deliveries', id, changes, ownerId);
    setDeliveries((current) => current.map((record) =>
      record.id === id ? { ...record, ...changes } : record
    ));
  };

  const handleDeleteDelivery = (id: string) => {
    if (isReadOnly) return;
    const next = deliveries.filter((d) => d.id !== id);
    setDeliveries(next);
    saveDeliveries(next);
    write(deleteWorkspaceRecord('deliveries', id, ownerId));

  };

  // Settings: Material Price Update
  const handleUpdateMaterialPrices = (
    newPrices: MaterialPriceConfig[],
    applyToExistingOrders: boolean
  ) => {
    if (isReadOnly) return;
    setMaterialPrices(newPrices);
    saveMaterialPrices(newPrices);
    const changes: WorkspaceChange[] = newPrices.map((price) => ({
      collection: 'materialPrices', id: price.id, data: price,
      isNew: !materialPrices.some((old) => old.id === price.id),
    }));

    if (applyToExistingOrders) {
      const recalculated = orders.map((o) => {
        const uPrice = getUnitPriceForMaterial(o.material, newPrices);
        return {
          ...o,
          unitPrice: uPrice,
          totalAmount: (o.teethCount || 1) * uPrice,
        };
      });
      setOrders(recalculated);
      saveOrders(recalculated);
      changes.push(...recalculated.map(({ id, unitPrice, totalAmount }) => ({
        collection: 'orders' as const, id, data: { unitPrice, totalAmount },
      })));
    }
    write(commitWorkspaceChanges(ownerId, changes));
  };

  const handleUpdateLabProfile = (profile: LabProfileConfig) => {
    if (isReadOnly) return;
    setLabProfile(profile);
    saveLabProfile(profile);
    write(saveWorkspaceRecord('settings', 'profile_' + ownerId, profile, ownerId));

  };

  const handleUpdateClinicDebts = (nextDebts: ClinicDebtRecord[]) => {
    if (isReadOnly) return;
    setClinicDebts(nextDebts);
    saveClinicDebts(nextDebts);
    write(commitWorkspaceChanges(ownerId, nextDebts
      .filter((debt) => JSON.stringify(debt) !== JSON.stringify(clinicDebts.find((old) => old.id === debt.id)))
      .map((debt) => ({ collection: 'clinicDebts', id: debt.id, data: debt, isNew: !clinicDebts.some((old) => old.id === debt.id) }))));
  };

  const handleResetData = () => {
    setSyncError('');
    setRefresh((value) => value + 1);
  };

  const handleOpenInvoicePdf = (
    targetOrders: DentalOrder[],
    clinicName: string,
    monthYear: string,
    explicitPaidAmount?: number,
    explicitPreviousDebt?: number
  ) => {
    const normalizeKey = (name: string) =>
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

    const mVal = (m: string) => {
      const [mm, yy] = m.split('/').map(Number);
      return (yy || 0) * 12 + (mm || 0);
    };

    const effectiveMonth =
      (monthYear && monthYear !== 'ALL' ? monthYear : targetOrders[0]?.monthYear) ||
      '11/2026';
    const prevMonth = getPreviousMonthYear(effectiveMonth);

    const matchClinic = (name: string) => {
      if (!clinicName) return true;
      return normalizeKey(name) === normalizeKey(clinicName);
    };

    const paid =
      explicitPaidAmount !== undefined
        ? explicitPaidAmount
        : debtPayments
            .filter((p) => {
              if (!matchClinic(p.clinicName || '')) return false;
              if (monthYear && monthYear !== 'ALL' && p.monthYear !== monthYear) return false;
              return true;
            })
            .reduce((s, p) => s + p.amount, 0);

    const shipFee = deliveries
      .filter((d) => {
        if (d.payer !== 'clinic') return false;
        if (!matchClinic(d.clinicName || '')) return false;
        if (monthYear && monthYear !== 'ALL' && d.monthYear !== monthYear) return false;
        return true;
      })
      .reduce((s, d) => s + d.shippingFee, 0);

    let previousMonthDebt = 0;
    if (explicitPreviousDebt !== undefined) {
      previousMonthDebt = Math.max(0, explicitPreviousDebt);
    } else {
      const baseline = '10/2026';
      const targetVal = mVal(effectiveMonth);
      const firstVal = mVal(baseline);
      const prevVal = mVal(prevMonth);
      const isCumulativeFromOct = prevVal >= firstVal;

      const baseRecords = clinicDebts.filter(
        (d) => d.monthYear === baseline && matchClinic(d.clinicName)
      );
      const targetRecords = clinicDebts.filter(
        (d) => d.monthYear === effectiveMonth && matchClinic(d.clinicName)
      );

      let baseOldDebt = 0;
      let manualPrevDebt = 0;
      let recordPaid = 0;

      if (targetRecords.length > 0) {
        baseOldDebt = targetRecords.reduce((s, r) => s + (r.oldDebt || 0), 0);
        manualPrevDebt = targetRecords.reduce((s, r) => s + (r.currentMonthDebt || 0), 0);
        recordPaid = targetRecords.reduce((s, r) => s + (r.paidAmount || 0), 0);
      } else if (targetVal >= firstVal) {
        baseOldDebt = baseRecords.reduce((s, r) => s + (r.oldDebt || 0), 0);
        manualPrevDebt = baseRecords.reduce((s, r) => s + (r.currentMonthDebt || 0), 0);
        recordPaid =
          targetVal === firstVal
            ? baseRecords.reduce((s, r) => s + (r.paidAmount || 0), 0)
            : 0;
      }

      const includedIds = new Set(targetOrders.map((o) => o.id));
      const prevOrdersRevenue = orders
        .filter((o) => {
          if (!o.clinicName || !o.monthYear) return false;
          if (includedIds.has(o.id)) return false;
          if (!matchClinic(o.clinicName)) return false;
          const v = mVal(o.monthYear);
          return isCumulativeFromOct
            ? v >= firstVal && v <= prevVal
            : o.monthYear === prevMonth;
        })
        .reduce((s, o) => s + (o.totalAmount || 0), 0);

      const prevPayments = debtPayments
        .filter((p) => {
          if (!p.clinicName || !p.monthYear) return false;
          if (!matchClinic(p.clinicName)) return false;
          const v = mVal(p.monthYear);
          return isCumulativeFromOct
            ? v >= firstVal && v <= prevVal
            : p.monthYear === prevMonth;
        })
        .reduce((s, p) => s + (p.amount || 0), 0);

      previousMonthDebt = Math.max(
        0,
        baseOldDebt + manualPrevDebt + prevOrdersRevenue - (recordPaid + prevPayments)
      );
    }

    setInvoiceModalData({
      isOpen: true,
      orders: targetOrders,
      clinicName,
      monthYear: effectiveMonth,
      paidAmount: paid,
      shippingFeeTotal: shipFee,
      previousMonthDebt,
      previousMonthLabel: prevMonth,
    });
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top 2026 Spatial Dock Header */}
      <Header
        activeTab={activeTab}
        isAdmin={profile.role === 'admin'}
        readOnly={isReadOnly}
        userName={profile.displayName || profile.email}
        onSignOut={() => { void signOut(auth); }}
        settingsSubTab={settingsSubTab}
        onTabChange={handleTabChange}
        onNewOrder={() => handleOpenNewOrder()}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
      />


      {(syncError || pendingWrites > 0 || loading) && <div className="px-4 pt-3 text-xs text-slate-500" role="status">
        {syncError ? <p role="alert" className="text-rose-600">{syncError} <button type="button" onClick={handleResetData} className="underline">Tải lại dữ liệu</button></p> : pendingWrites > 0 ? 'Đang lưu thay đổi…' : loading ? 'Đang kết nối dữ liệu…' : null}
      </div>}

      {/* Full-Width Workspace */}
      <main className="flex-1 w-full px-3 sm:px-5 lg:px-6 py-4">
        {loading ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-7 h-7 text-teal-500 animate-spin" />
            <p className="text-xs font-medium text-slate-500">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                orders={orders}
                cashflows={cashflows}
                deliveries={deliveries}
                onNavigateToOrders={() => setActiveTab('orders')}
                onNavigateToRevenue={(m, c) => {
                  if (m !== undefined) setRevenueMonthFilter(m);
                  if (c !== undefined) setRevenueClinicFilter(c);
                  setActiveTab('revenue');
                }}
                onNavigateToDebt={() => setActiveTab('debt')}
                onViewOrder={(order) => setWarrantyModalOrder(order)}
                onPrintTicket={(order) => setTicketModalOrder(order)}
                onExportInvoicePdf={(ords, clinic, month) =>
                  handleOpenInvoicePdf(ords, clinic, month)
                }
                onNewOrder={() => handleOpenNewOrder()}
              />
            )}

            {activeTab === 'revenue' && (
              <RevenueView
                orders={orders}
                readOnly={isReadOnly}
                initialMonth={revenueMonthFilter}
                initialClinic={revenueClinicFilter}
                onUpdateOrder={handleUpdateOrderDirect}
                onExportInvoicePdf={(ords, clinic, month) =>
                  handleOpenInvoicePdf(ords, clinic, month)
                }
                onViewWarranty={(order) => setWarrantyModalOrder(order)}
              />
            )}

            {activeTab === 'orders' && (
              <OrderListView
                orders={orders}
                readOnly={isReadOnly}
                clinicNames={clinicNames}
                clinicPartners={clinicPartners}
                materialPrices={materialPrices}
                onViewWarranty={(order) => setWarrantyModalOrder(order)}
                onPrintTicket={(order) => setTicketModalOrder(order)}
                onEditOrder={handleEditOrder}
                onUpdateOrder={handleUpdateOrderDirect}
                onDeleteOrder={handleDeleteOrder}
                onNewOrder={() => handleOpenNewOrder()}
                onQuickAdd={handleQuickAddOrder}
              />
            )}

            {activeTab === 'debt' && (
              <DebtManagementView
                orders={orders}
                readOnly={isReadOnly}
                clinicDebts={clinicDebts}
                payments={debtPayments}
                onUpdateClinicDebts={handleUpdateClinicDebts}
                onAddPayment={handleAddDebtPayment}
                onDeletePayment={handleDeleteDebtPayment}
                onExportStatementPdf={(ords, clinic, month, paid, prevDebt) =>
                  handleOpenInvoicePdf(ords, clinic, month, paid, prevDebt)
                }
              />
            )}

            {activeTab === 'cashflow' && (
              <CashflowView
                transactions={cashflows}
                readOnly={isReadOnly}
                availableMonths={availableMonths}
                onAddTransaction={handleAddCashflow}
                onDeleteTransaction={handleDeleteCashflow}
              />
            )}

            {activeTab === 'delivery' && (
              <DeliveryManagementView
                deliveries={deliveries}
                readOnly={isReadOnly}
                partnerClinics={clinicOptions}
                orders={orders}
                availableMonths={availableMonths}
                onAddDelivery={handleAddDelivery}
                onUpdateDelivery={handleUpdateDelivery}
                onDeleteDelivery={handleDeleteDelivery}
              />
            )}

            {activeTab === 'payroll' && profile.role === 'admin' && (
              <PayrollView
                records={payrolls}
                users={users}
                commissions={commissions}
                orders={orders}
                availableMonths={availableMonths}
                loading={payrollsLoading}
                loadError={payrollsError}
                onSave={(input, existingId) => savePayrollRecord(ownerId, input, existingId)}
                onDelete={(id) => deletePayrollRecord(id)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                initialSubTab={settingsSubTab}
                readOnly={isReadOnly}
                onSubTabChange={setSettingsSubTab}
                payroll={profile.role === 'admin' ? {
                  records: payrolls,
                  users,
                  commissions,
                  orders,
                  availableMonths,
                  loading: payrollsLoading,
                  loadError: payrollsError,
                  onSave: (input, existingId) => savePayrollRecord(ownerId, input, existingId),
                  onDelete: (id) => deletePayrollRecord(id),
                } : undefined}
                commissions={profile.role === 'admin' ? {
                  records: commissions,
                  sales: users,
                  clinicNames,
                  orders,
                  loading: commissionsLoading,
                  loadError: commissionsError,
                  onSave: (input, id) => saveCommission(ownerId, input, id),
                  onBulkSave: (saleId, names, rate) => saveCommissions(ownerId, saleId, names, rate),
                  onDelete: (id) => deleteCommission(id),
                  onDeleteMany: (ids) => deleteCommissions(ids),
                } : undefined}
                userManagement={profile.role === 'admin' ? {
                  users,
                  currentUserId: profile.uid,
                  onCreate: async (input) => {
                    try { await createAccount(profile, input); }
                    catch (error) { throw new Error(accountError(error)); }
                  },
                  onUpdate: async (uid, changes) => {
                    try { await updateAccount(uid, changes); }
                    catch (error) { throw new Error(accountError(error)); }
                  },
                } : undefined}
                clinicPartners={clinicPartners}
                onAddClinicPartner={addClinicPartner}
                orders={orders}
                materialPrices={materialPrices}
                labProfile={labProfile}
                warrantyLookupCode={warrantyLookupCode}
                onUpdateMaterialPrices={handleUpdateMaterialPrices}
                onUpdateLabProfile={handleUpdateLabProfile}
                onSelectClinicForRevenue={(clinicName, monthYear) => {
                  setRevenueClinicFilter(clinicName);
                  setRevenueMonthFilter(monthYear || 'ALL');
                  setActiveTab('revenue');
                }}
                onExportClinicInvoice={(clinicOrders, clinicName, monthYear) =>
                  handleOpenInvoicePdf(clinicOrders, clinicName, monthYear || '')
                }
                onStartOrderWithTeeth={(teethText) => handleOpenNewOrder(teethText)}
                onViewFullCertificate={(order) => setWarrantyModalOrder(order)}
                onResetAllData={handleResetData}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        orders={orders}
        onViewWarranty={(order) => setWarrantyModalOrder(order)}
        onPrintTicket={(order) => setTicketModalOrder(order)}
        onExportInvoicePdf={(ords, clinic, month) =>
          handleOpenInvoicePdf(ords, clinic, month)
        }
        onSelectClinicRevenue={(clinicName) => {
          setRevenueClinicFilter(clinicName);
          setRevenueMonthFilter('ALL');
          setActiveTab('revenue');
        }}
      />

      <WarrantyCardModal
        order={warrantyModalOrder}
        onClose={() => setWarrantyModalOrder(null)}
      />

      <LabTicketModal
        order={ticketModalOrder}
        onClose={() => setTicketModalOrder(null)}
      />

      <OrderFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingOrder(null);
        }}
        onSave={handleSaveOrder}
        initialOrder={editingOrder}
        clinicOptions={clinicOptions}
      />

      <InvoicePdfModal
        isOpen={invoiceModalData.isOpen}
        onClose={() =>
          setInvoiceModalData((prev) => ({ ...prev, isOpen: false }))
        }
        orders={invoiceModalData.orders}
        clinicName={invoiceModalData.clinicName}
        monthYear={invoiceModalData.monthYear}
        paidAmount={invoiceModalData.paidAmount}
        shippingFeeTotal={invoiceModalData.shippingFeeTotal}
        previousMonthDebt={invoiceModalData.previousMonthDebt}
        previousMonthLabel={invoiceModalData.previousMonthLabel}
        labProfile={labProfile}
      />
    </div>
  );
}
