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
import { calculateDebtRows, normalizeClinicName, DEBT_START_MONTH, debtMonthValue } from './utils/debtLedger';
import { buildClinicPartnerIndex, createClinicNameResolver, getClinicOptions, prepareClinicPartnerChange } from './utils/clinicPartners';
import { Header, NavTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { RevenueView } from './components/RevenueView';
import { ProfitView } from './components/ProfitView';
import { PROFIT_EXPENSE_CATEGORIES, isManualProfitExpense, type ProfitExpenseInput, type ProfitFixedExpense, type ProfitFixedExpenseInput } from './utils/profit';
import { saveProfitFixedCost, subscribeProfitCosts } from './services/profitCosts';
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
    const tabs: NavTab[] = ['dashboard', 'revenue', 'orders', 'debt', 'cashflow', 'delivery', 'profit', 'payroll', 'settings'];
    const subTabs: SettingsSubTab[] = ['clinics', 'fdichart', 'materials', 'warranty', 'profile', 'users', 'commissions', 'payroll'];
    const restrictedSubTab = !isAdmin && (saved?.settingsSubTab === 'users' || saved?.settingsSubTab === 'commissions' || saved?.settingsSubTab === 'payroll');
    const restrictedMainTab = !isAdmin && (saved?.activeTab === 'payroll' || saved?.activeTab === 'profit');
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
  const [clinicPartners, setClinicPartners] = useState<ClinicPartner[]>([]);
  const [labProfile, setLabProfile] = useState<LabProfileConfig>({ labName: '', tagline: '', hotline: '', address: '', email: '', bankName: '', bankAccountNumber: '', bankAccountHolder: '', directorName: '' });
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [pendingWrites, setPendingWrites] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const clinicDiscountRates = useMemo(() => new Map(
    Array.from(buildClinicPartnerIndex(clinicPartners), ([key, partner]) => [key, partner.discountPercent ?? 0])
  ), [clinicPartners]);
  const [storedCommissions, setCommissions] = useState<SaleCommission[]>([]);
  const commissions = useMemo(() => {
    const resolveName = createClinicNameResolver(clinicPartners);
    return storedCommissions.map((record) => ({ ...record, clinicName: resolveName(record.clinicName) }));
  }, [storedCommissions, clinicPartners]);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [commissionsError, setCommissionsError] = useState('');
  const [payrolls, setPayrolls] = useState<EmployeePayroll[]>([]);
  const [payrollsLoading, setPayrollsLoading] = useState(true);
  const [payrollsError, setPayrollsError] = useState('');
  const [profitFixedExpenses, setProfitFixedExpenses] = useState<ProfitFixedExpense[]>([]);
  const [profitCostsLoading, setProfitCostsLoading] = useState(true);
  const [profitCostsError, setProfitCostsError] = useState('');
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
      if (activeTab === 'payroll' || activeTab === 'profit') {
        setActiveTab('dashboard');
      }
    }
  }, [profile.role, settingsSubTab, activeTab]);

  // Cross-view filters
  const [revenueMonthFilter, setRevenueMonthFilter] = useState<string>('');
  const [revenueClinicFilter, setRevenueClinicFilter] = useState<string>('');
  const [deliveryMonthFilter, setDeliveryMonthFilter] = useState<string>('');
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
    additionalCharges: number;
    discountAmount: number;
    openingAdjustment: number;
    orderSubtotal?: number;
    previousMonthLabel: string;
  }>({
    isOpen: false,
    orders: [],
    clinicName: '',
    monthYear: '',
    paidAmount: 0,
    shippingFeeTotal: 0,
    previousMonthDebt: 0,
    additionalCharges: 0,
    discountAmount: 0,
    openingAdjustment: 0,
    previousMonthLabel: '',
  });

  useEffect(() => {
    setLoading(true);
    let importingPartners = false;
    return subscribeWorkspaceData(ownerId, (data) => {
      const migrationKey = 'at_dental_partners_migrated_' + ownerId;
      if (profile.uid === ownerId && !importingPartners && localStorage.getItem(migrationKey) !== 'done') {
        const partnerIndex = buildClinicPartnerIndex(data.partners);
        const localPartners = getClinicPartners().filter((partner) =>
          !partnerIndex.has(normalizeClinicName(partner.name))
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
    setUsersLoading(true);
    setUsersError('');
    return subscribeUsers(ownerId, (records) => {
      setUsers(records);
      setUsersLoading(false);
    }, () => {
      const message = 'Không đọc được danh sách tài khoản.';
      setUsersError(message);
      setUsersLoading(false);
      setSyncError(message);
    });
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

  useEffect(() => {
    setProfitFixedExpenses([]);
    setProfitCostsError('');
    setProfitCostsLoading(profile.role === 'admin');
    if (profile.role !== 'admin') return;
    return subscribeProfitCosts(ownerId, (records) => {
      setProfitFixedExpenses(records);
      setProfitCostsLoading(false);
    }, (message) => {
      setProfitCostsError(message);
      setProfitCostsLoading(false);
    });
  }, [ownerId, profile.role]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.monthYear) set.add(o.monthYear);
    });
    return sortMonthYearsDesc(Array.from(set));
  }, [orders]);

  const persistClinicPartner = async (originalName: string | null, input: ClinicPartner, archived = false) => {
    if (isReadOnly) throw new Error('Tài khoản chỉ có quyền xem.');
    const { existing, identityKey, data } = prepareClinicPartnerChange(clinicPartners, orders, input, originalName, archived);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([ownerId, identityKey])));
    const id = existing?.id || 'partner_' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    setPendingWrites((count) => count + 1);
    try {
      await saveWorkspaceRecord('clinicPartners', id, data, ownerId, !existing?.id);
    } finally {
      setPendingWrites((count) => count - 1);
    }
  };

  const addClinicPartner = (partner: ClinicPartner) => persistClinicPartner(null, partner);
  const updateClinicPartner = (originalName: string, partner: ClinicPartner) => persistClinicPartner(originalName, partner);
  const deleteClinicPartner = (clinicName: string) => {
    const existing = buildClinicPartnerIndex(clinicPartners).get(normalizeClinicName(clinicName));
    return persistClinicPartner(clinicName, {
      name: existing?.name || clinicName,
      address: '',
      phone: '',
      discountPercent: 0,
    }, true);
  };

  const clinicOptions = useMemo(() => getClinicOptions(orders, clinicPartners), [orders, clinicPartners]);

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

  const handleAddProfitExpense = async ({ monthYear, kind, title, amount }: ProfitExpenseInput) => {
    if (profile.role !== 'admin') throw new Error('Chỉ quản trị viên được thêm chi phí.');
    const category = PROFIT_EXPENSE_CATEGORIES[kind];
    const cleanTitle = title.trim();
    if (!category || debtMonthValue(monthYear) === null || !cleanTitle || cleanTitle.length > 300 ||
        !Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Nhập nội dung và số tiền hợp lệ cho kỳ đã chọn.');
    }
    const id = `cf_profit_${crypto.randomUUID()}`;
    const transaction: CashflowTransaction = {
      id, type: 'expense', category, title: cleanTitle, amount, monthYear,
      date: '', paymentMethod: '', notes: '', createdAt: Date.now(),
    };
    await saveWorkspaceRecord('cashflows', id, transaction, ownerId, true);
  };

  const handleDeleteProfitExpense = async (id: string) => {
    if (profile.role !== 'admin' || !cashflows.some((row) => row.id === id &&
      (isManualProfitExpense(row) || (row.type === 'expense' && row.category === PROFIT_EXPENSE_CATEGORIES.extra)))) {
      throw new Error('Không tìm thấy khoản chi phí khác.');
    }
    await deleteWorkspaceRecord('cashflows', id, ownerId);
  };

  const handleUpdateProfitExpense = async ({ id, title, amount }: { id: string; title: string; amount: number }) => {
    const existing = cashflows.find((row) => row.id === id && row.type === 'expense' && row.category === PROFIT_EXPENSE_CATEGORIES.extra);
    if (profile.role !== 'admin' || !existing) throw new Error('Không tìm thấy khoản chi phí khác.');
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > 300 || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Nhập nội dung và số tiền nguyên lớn hơn 0.');
    }
    await saveWorkspaceRecord('cashflows', id, { title: cleanTitle, amount }, ownerId);
  };

  const handleUpdateProfitFixedExpense = async (input: ProfitFixedExpenseInput) => {
    if (profile.role !== 'admin') throw new Error('Chỉ quản trị viên được chỉnh sửa chi phí.');
    await saveProfitFixedCost(ownerId, input);
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
    monthYear: string
  ) => {
    const effectiveMonth = monthYear && monthYear !== 'ALL' ? monthYear : '';
    const matchClinic = (name: string) =>
      !clinicName || normalizeClinicName(name) === normalizeClinicName(clinicName);
    const monthValue = (month: string) => {
      const [m, y] = month.split('/').map(Number);
      return y * 12 + m;
    };

    let paidAmount = 0;
    let previousMonthDebt = 0;
    let additionalCharges = 0;
    let discountAmount = 0;
    let openingAdjustment = 0;
    let orderSubtotal: number | undefined;
    if (effectiveMonth) {
      const rows = calculateDebtRows(orders, clinicDebts, debtPayments, effectiveMonth, clinicDiscountRates)
        .filter((row) => matchClinic(row.clinicName));
      previousMonthDebt = rows.reduce((sum, row) => sum + row.oldDebt, 0);
      paidAmount = rows.reduce((sum, row) => sum + row.paidAmount, 0);
      discountAmount = rows.reduce((sum, row) => sum + row.discountAmount, 0);
      openingAdjustment = rows.reduce((sum, row) => sum + row.openingAdjustment, 0);
      additionalCharges = rows.reduce((sum, row) => sum + (row.openingSnapshot ? 0 : row.manualCurrentDebt), 0);
      if (effectiveMonth === DEBT_START_MONTH && clinicDebts.some((row) => row.openingSnapshot)) {
        orderSubtotal = rows.reduce((sum, row) => sum + row.currentMonthDebt, 0);
      }
    } else {
      // All-month invoices already include the order history. Count each month's
      // actual payments and manual charges once, without adding carried balances.
      const months = new Set([
        ...orders.map((row) => row.monthYear),
        ...clinicDebts.map((row) => row.monthYear),
        ...debtPayments.map((row) => row.monthYear),
      ]);
      for (const month of months) {
        if (!/^\d{2}\/\d{4}$/.test(month) || monthValue(month) < monthValue(DEBT_START_MONTH)) continue;
        const rows = calculateDebtRows(orders, clinicDebts, debtPayments, month, clinicDiscountRates)
          .filter((row) => matchClinic(row.clinicName));
        paidAmount += rows.reduce((sum, row) => sum + row.paidAmount - row.carriedCredit, 0);
        discountAmount += rows.reduce((sum, row) => sum + row.discountAmount, 0);
        openingAdjustment += rows.reduce((sum, row) => sum + row.openingAdjustment, 0);
        additionalCharges += rows.reduce((sum, row) => sum + (row.openingSnapshot ? 0 : row.manualCurrentDebt), 0);
        if (month === DEBT_START_MONTH && clinicDebts.some((row) => row.openingSnapshot)) {
          previousMonthDebt = rows.reduce((sum, row) => sum + row.oldDebt, 0);
          orderSubtotal = targetOrders
            .filter((order) => order.monthYear !== DEBT_START_MONTH)
            .reduce((sum, order) => sum + order.totalAmount, 0)
            + rows.reduce((sum, row) => sum + row.currentMonthDebt, 0);
        }
      }
    }

    const shippingFeeTotal = deliveries
      .filter((delivery) =>
        delivery.payer === 'clinic' &&
        matchClinic(delivery.clinicName || '') &&
        (!effectiveMonth || delivery.monthYear === effectiveMonth)
      )
      .reduce((sum, delivery) => sum + delivery.shippingFee, 0);

    setInvoiceModalData({
      isOpen: true,
      orders: targetOrders,
      clinicName,
      monthYear: effectiveMonth,
      paidAmount,
      shippingFeeTotal,
      previousMonthDebt,
      additionalCharges,
      discountAmount,
      openingAdjustment,
      orderSubtotal,
      previousMonthLabel: effectiveMonth ? getPreviousMonthYear(effectiveMonth) : '',
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
                discountRates={clinicDiscountRates}
                onUpdateClinicDebts={handleUpdateClinicDebts}
                onAddPayment={handleAddDebtPayment}
                onDeletePayment={handleDeleteDebtPayment}
                onExportStatementPdf={(ords, clinic, month) =>
                  handleOpenInvoicePdf(ords, clinic, month)
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
                initialMonth={deliveryMonthFilter}
                onAddDelivery={handleAddDelivery}
                onUpdateDelivery={handleUpdateDelivery}
                onDeleteDelivery={handleDeleteDelivery}
              />
            )}

            {activeTab === 'profit' && profile.role === 'admin' && (
              <ProfitView
                sources={{ orders, clinicDebts, discountRates: clinicDiscountRates, cashflows, deliveries, payrolls, commissions, users, fixedExpenses: profitFixedExpenses }}
                labProfile={labProfile}
                loading={payrollsLoading || commissionsLoading || usersLoading || profitCostsLoading}
                loadError={payrollsError || commissionsError || usersError || profitCostsError}
                onAddExpense={handleAddProfitExpense}
                onDeleteExtra={handleDeleteProfitExpense}
                onUpdateExpense={handleUpdateProfitExpense}
                onUpdateFixedExpense={handleUpdateProfitFixedExpense}
                onOpenDelivery={(month) => {
                  setDeliveryMonthFilter(month);
                  setActiveTab('delivery');
                }}
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
                onUpdateClinicPartner={updateClinicPartner}
                onDeleteClinicPartner={deleteClinicPartner}
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
        additionalCharges={invoiceModalData.additionalCharges}
        discountAmount={invoiceModalData.discountAmount}
        openingAdjustment={invoiceModalData.openingAdjustment}
        orderSubtotal={invoiceModalData.orderSubtotal}
        previousMonthLabel={invoiceModalData.previousMonthLabel}
        labProfile={labProfile}
      />
    </div>
  );
}
