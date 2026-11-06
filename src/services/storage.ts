import {
  DentalOrder,
  MaterialPriceConfig,
  DebtPaymentRecord,
  ClinicDebtRecord,
  ClinicPartner,
  CashflowTransaction,
  DeliveryRecord,
  LabProfileConfig,
} from '../types/dental';
import {
  DEFAULT_MATERIAL_PRICES,
  DEFAULT_LAB_PROFILE,
  MATERIAL_PRICES_SEED_VERSION,
  seedMaterialPricesFromDefaults,
  extractMonthYear,
} from '../utils/financeUtils';

const CLINIC_PARTNERS_KEY = 'at_dental_lab_clinic_partners_v1';

export function getClinicPartners(): ClinicPartner[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CLINIC_PARTNERS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveClinicPartners(partners: ClinicPartner[]): void {
  localStorage.setItem(CLINIC_PARTNERS_KEY, JSON.stringify(partners));
}

const ORDERS_KEY = 'at_dental_lab_orders_v7';
const PRICES_KEY = 'at_dental_lab_prices_v7';
const PAYMENTS_KEY = 'at_dental_lab_payments_v7';
const CLINIC_DEBTS_KEY = 'at_dental_lab_clinic_debts_v7';
const CASHFLOW_KEY = 'at_dental_lab_cashflow_v7';
const DELIVERIES_KEY = 'at_dental_lab_deliveries_v7';
const LAB_PROFILE_KEY = 'at_dental_lab_profile_v1';

const LEGACY_KEYS = [
  'at_dental_lab_orders_v1',
  'at_dental_lab_orders_v2',
  'at_dental_lab_orders_v3',
  'at_dental_lab_orders_v4',
  'at_dental_lab_orders_v5',
  'at_dental_lab_orders_v6',
  'at_dental_lab_prices_v1',
  'at_dental_lab_prices_v5',
  'at_dental_lab_prices_v6',
  'at_dental_lab_payments_v1',
  'at_dental_lab_payments_v5',
  'at_dental_lab_payments_v6',
  'at_dental_lab_clinic_debts_v6',
  'at_dental_lab_cashflow_v1',
  'at_dental_lab_cashflow_v5',
  'at_dental_lab_cashflow_v6',
  'at_dental_lab_deliveries_v1',
  'at_dental_lab_deliveries_v5',
  'at_dental_lab_deliveries_v6',
];

function purgeLegacyLocalStorage() {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

export async function fetchOriginalData(): Promise<DentalOrder[]> {
  return [];
}

export async function getOrders(): Promise<DentalOrder[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOrders(orders: DentalOrder[]): void {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('LocalStorage save error:', e);
  }
}

export function createOrder(
  data: Partial<DentalOrder>,
  existingOrders: DentalOrder[],
  _priceConfigs: MaterialPriceConfig[] = DEFAULT_MATERIAL_PRICES,
  options: { persistLocal?: boolean } = {}
): { newOrder: DentalOrder; updatedOrders: DentalOrder[] } {
  const teethCount = data.teethCount !== undefined ? Number(data.teethCount) : 1;
  const material = data.material || 'Full zirco razor';
  const unitPrice = data.unitPrice !== undefined ? Math.max(0, Number(data.unitPrice) || 0) : 0;
  const totalAmount =
    data.totalAmount !== undefined ? Math.max(0, Number(data.totalAmount) || 0) : 0;
  const orderDate = data.orderDate || '29/10/2026';
  const monthYear = data.monthYear || extractMonthYear(orderDate);
  const stableId =
    (data.id && /^[a-zA-Z0-9_-]{1,128}$/.test(data.id) && data.id) ||
    `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newOrder: DentalOrder = {
    id: stableId,
    warrantyCode: data.warrantyCode || `AT${Math.floor(10000 + Math.random() * 90000)}`,
    patientName: data.patientName || 'Khách Hàng',
    phone: data.phone || '',
    clinicName: data.clinicName || 'Nha Khoa Đối Tác',
    clinicAddress: data.clinicAddress ?? 'Đà Nẵng',
    material,
    warrantyPeriod: data.warrantyPeriod || '15 năm',
    warrantyYears: data.warrantyYears || 15,
    orderDate,
    monthYear,
    teeth: data.teeth || '1 răng',
    teethCount,
    toothForm: data.toothForm ?? 'Form tự nhiên',
    unitPrice,
    totalAmount,
    notes: data.notes || '',
    status: data.status ?? 'completed',
    paymentStatus: data.paymentStatus || 'unpaid',
    createdAt: Date.now(),
  };

  const updatedOrders = [newOrder, ...existingOrders];
  if (options.persistLocal !== false) {
    saveOrders(updatedOrders);
  }
  return { newOrder, updatedOrders };
}

export function updateOrder(
  updated: DentalOrder,
  existingOrders: DentalOrder[]
): DentalOrder[] {
  const withMonth: DentalOrder = {
    ...updated,
    monthYear: updated.monthYear || extractMonthYear(updated.orderDate),
    unitPrice: updated.unitPrice !== undefined ? Math.max(0, Number(updated.unitPrice) || 0) : 0,
    totalAmount:
      updated.totalAmount !== undefined ? Math.max(0, Number(updated.totalAmount) || 0) : 0,
  };
  const list = existingOrders.map((o) => (o.id === withMonth.id ? withMonth : o));
  saveOrders(list);
  return list;
}

export function deleteOrder(id: string, existingOrders: DentalOrder[]): DentalOrder[] {
  const list = existingOrders.filter((o) => o.id !== id);
  saveOrders(list);
  return list;
}

/**
 * Material Price Configs
 */
const PRICES_SEED_KEY = 'at_dental_lab_prices_seed_version';

export function getMaterialPrices(): MaterialPriceConfig[] {
  try {
    const cached = localStorage.getItem(PRICES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (localStorage.getItem(PRICES_SEED_KEY) === MATERIAL_PRICES_SEED_VERSION) {
          return parsed;
        }
        const { next } = seedMaterialPricesFromDefaults(parsed);
        saveMaterialPrices(next);
        return next;
      }
    }
  } catch (e) {
    console.warn(e);
  }
  saveMaterialPrices(DEFAULT_MATERIAL_PRICES);
  return DEFAULT_MATERIAL_PRICES;
}

export function saveMaterialPrices(prices: MaterialPriceConfig[]): void {
  try {
    localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
    localStorage.setItem(PRICES_SEED_KEY, MATERIAL_PRICES_SEED_VERSION);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Clinic Debts Table (Bảng Công Nợ Nha Khoa T10/2026)
 */
export function getClinicDebts(): ClinicDebtRecord[] {
  purgeLegacyLocalStorage();
  try {
    const cached = localStorage.getItem(CLINIC_DEBTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }
  const seeded: ClinicDebtRecord[] = [];
  saveClinicDebts(seeded);
  return seeded;
}

export function saveClinicDebts(debts: ClinicDebtRecord[]): void {
  try {
    localStorage.setItem(CLINIC_DEBTS_KEY, JSON.stringify(debts));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Debt Payments
 */
export function getDebtPayments(orders: DentalOrder[]): DebtPaymentRecord[] {
  try {
    const cached = localStorage.getItem(PAYMENTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }
  const seeded: DebtPaymentRecord[] = [];
  saveDebtPayments(seeded);
  return seeded;
}

export function saveDebtPayments(payments: DebtPaymentRecord[]): void {
  try {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Deliveries
 */
export function getDeliveries(orders: DentalOrder[]): DeliveryRecord[] {
  try {
    const cached = localStorage.getItem(DELIVERIES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }
  const seeded: DeliveryRecord[] = [];
  saveDeliveries(seeded);
  return seeded;
}

export function saveDeliveries(deliveries: DeliveryRecord[]): void {
  try {
    localStorage.setItem(DELIVERIES_KEY, JSON.stringify(deliveries));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Cashflow (Thu - Chi)
 */
export function getCashflows(
  orders: DentalOrder[],
  payments: DebtPaymentRecord[],
  deliveries: DeliveryRecord[]
): CashflowTransaction[] {
  try {
    const cached = localStorage.getItem(CASHFLOW_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }
  const seeded: CashflowTransaction[] = [];
  saveCashflows(seeded);
  return seeded;
}

export function saveCashflows(txs: CashflowTransaction[]): void {
  try {
    localStorage.setItem(CASHFLOW_KEY, JSON.stringify(txs));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Lab Profile
 */
export function getLabProfile(): LabProfileConfig {
  try {
    const cached = localStorage.getItem(LAB_PROFILE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.warn(e);
  }
  return DEFAULT_LAB_PROFILE;
}

export function saveLabProfile(profile: LabProfileConfig): void {
  try {
    localStorage.setItem(LAB_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Reset back to original dataset
 */
export async function resetDatabase(): Promise<{
  orders: DentalOrder[];
  prices: MaterialPriceConfig[];
  clinicDebts: ClinicDebtRecord[];
  payments: DebtPaymentRecord[];
  deliveries: DeliveryRecord[];
  cashflows: CashflowTransaction[];
}> {
  localStorage.removeItem(ORDERS_KEY);
  localStorage.removeItem(PRICES_KEY);
  localStorage.removeItem(CLINIC_DEBTS_KEY);
  localStorage.removeItem(PAYMENTS_KEY);
  localStorage.removeItem(CASHFLOW_KEY);
  localStorage.removeItem(DELIVERIES_KEY);

  const orders = await fetchOriginalData();
  saveOrders(orders);
  const prices = DEFAULT_MATERIAL_PRICES;
  saveMaterialPrices(prices);
  const clinicDebts: ClinicDebtRecord[] = [];
  saveClinicDebts(clinicDebts);
  const deliveries: DeliveryRecord[] = [];
  saveDeliveries(deliveries);
  const payments: DebtPaymentRecord[] = [];
  saveDebtPayments(payments);
  const cashflows: CashflowTransaction[] = [];
  saveCashflows(cashflows);

  return { orders, prices, clinicDebts, payments, deliveries, cashflows };
}

/**
 * Export orders to CSV file download
 */
export function exportToCSV(orders: DentalOrder[], filename = 'AT_DENTAL_LAB_EXPORT.csv') {
  const headers = [
    'Mã thẻ bảo hành',
    'Tên bệnh nhân',
    'Số điện thoại',
    'Nha khoa đối tác',
    'Địa chỉ nha khoa',
    'Vật liệu phục hình',
    'Thời hạn bảo hành',
    'Ngày lắp đặt',
    'Tháng/Năm',
    'Vị trí răng',
    'Số lượng răng',
    'Đơn giá (VNĐ)',
    'Thành tiền (VNĐ)',
    'Dáng răng',
    'Ghi chú',
  ];

  const rows = orders.map((o) => [
    `"${(o.warrantyCode || '').replace(/"/g, '""')}"`,
    `"${(o.patientName || '').replace(/"/g, '""')}"`,
    `"${(o.phone || '').replace(/"/g, '""')}"`,
    `"${(o.clinicName || '').replace(/"/g, '""')}"`,
    `"${(o.clinicAddress || '').replace(/"/g, '""')}"`,
    `"${(o.material || '').replace(/"/g, '""')}"`,
    `"${(o.warrantyPeriod || '').replace(/"/g, '""')}"`,
    `"${(o.orderDate || '').replace(/"/g, '""')}"`,
    `"${(o.monthYear || '').replace(/"/g, '""')}"`,
    `"${(o.teeth || '').replace(/"/g, '""')}"`,
    o.teethCount,
    o.unitPrice,
    o.totalAmount,
    `"${(o.toothForm || '').replace(/"/g, '""')}"`,
    `"${(o.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
