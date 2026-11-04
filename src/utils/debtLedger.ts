import type { ClinicDebtRecord, DebtPaymentRecord, DentalOrder } from '../types/dental';

export const DEBT_START_MONTH = '09/2026';

export function debtMonthValue(monthYear: string): number | null {
  const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(monthYear || '');
  return match ? Number(match[2]) * 12 + Number(match[1]) - 1 : null;
}

export function normalizeClinicName(name: string): string {
  return (name || '')
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replace(/^nha\s+khoa\s+/i, '')
    .replace(/thuỷ/g, 'thủy')
    .replace(/hoà/g, 'hòa')
    .replace(/quý/g, 'quí')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');
}

const amount = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
const start = debtMonthValue(DEBT_START_MONTH)!;

function rowId(key: string, monthYear: string): string {
  const slug = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 55) || 'clinic';
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return `debt_${monthYear.replace('/', '_')}_${slug}_${(hash >>> 0).toString(36)}`;
}

interface MonthlyActivity {
  orders: DentalOrder[];
  payments: DebtPaymentRecord[];
  record?: ClinicDebtRecord;
}

export interface ClinicDebtRow {
  id: string;
  clinicName: string;
  monthYear: string;
  oldDebt: number;
  currentMonthDebt: number;
  autoOrderDebt: number;
  manualCurrentDebt: number;
  discountAmount: number;
  openingAdjustment: number;
  openingSnapshot: boolean;
  totalDebt: number;
  paidFromPayments: number;
  paidFromRecords: number;
  carriedCredit: number;
  paidAmount: number;
  remainingDebt: number;
  /** Signed closing balance preserves advances for later months. */
  balance: number;
  orderIndex: number;
  notes: string;
  updatedAt: number;
  orders: DentalOrder[];
  monthlyBreakdown: {
    monthYear: string;
    shortLabel: string;
    revenue: number;
    orderCount: number;
    teethCount: number;
  }[];
}

/** Revisions of one clinic/month are snapshots, never separate debts to add together. */
function preferRecord(candidate: ClinicDebtRecord, existing: ClinicDebtRecord): boolean {
  if ((candidate.updatedAt || 0) !== (existing.updatedAt || 0)) {
    return (candidate.updatedAt || 0) > (existing.updatedAt || 0);
  }
  if (candidate.orderIndex !== existing.orderIndex) return candidate.orderIndex < existing.orderIndex;
  return candidate.id < existing.id;
}

/** Each closing balance rolls forward once. An imported opening statement replaces
 * order-derived charges for its entire period. Discounts apply to new order revenue only.
 */
export function calculateDebtRows(
  orders: DentalOrder[],
  clinicDebts: ClinicDebtRecord[],
  payments: DebtPaymentRecord[],
  targetMonth: string,
  discountRates: ReadonlyMap<string, number> = new Map()
): ClinicDebtRow[] {
  const target = debtMonthValue(targetMonth);
  if (target === null || target < start) return [];

  const hasOpeningSnapshot = clinicDebts.some((record) =>
    record.monthYear === DEBT_START_MONTH && record.openingSnapshot
  );
  const clinics = new Map<string, { name: string; months: Map<number, MonthlyActivity> }>();
  const activity = (name: string, monthYear: string) => {
    const key = normalizeClinicName(name);
    const month = debtMonthValue(monthYear);
    if (!key || month === null || month < start || month > target) return;
    let clinic = clinics.get(key);
    if (!clinic) {
      clinic = { name: name.trim().normalize('NFC'), months: new Map() };
      clinics.set(key, clinic);
    }
    let entry = clinic.months.get(month);
    if (!entry) {
      entry = { orders: [], payments: [] };
      clinic.months.set(month, entry);
    }
    return entry;
  };

  const orderIds = new Set<string>();
  for (const order of orders) {
    if (orderIds.has(order.id) || (hasOpeningSnapshot && order.monthYear === DEBT_START_MONTH)) continue;
    orderIds.add(order.id);
    activity(order.clinicName, order.monthYear)?.orders.push(order);
  }
  for (const record of clinicDebts) {
    const entry = activity(record.clinicName, record.monthYear);
    if (entry && (!entry.record || preferRecord(record, entry.record))) entry.record = record;
  }
  const paymentIds = new Set<string>();
  for (const payment of payments) {
    if (paymentIds.has(payment.id)) continue;
    paymentIds.add(payment.id);
    activity(payment.clinicName, payment.monthYear)?.payments.push(payment);
  }

  return Array.from(clinics, ([key, clinic]): ClinicDebtRow => {
    const rate = Math.min(100, amount((discountRates.get(key) ?? 0) * 100) / 100);
    const chargesFor = (entry?: MonthlyActivity) => {
      const snapshot = entry?.record?.openingSnapshot === true;
      const auto = (entry?.orders ?? []).reduce((sum, order) => sum + amount(order.totalAmount), 0);
      const manual = amount(entry?.record?.currentMonthDebt ?? 0);
      const discount = snapshot
        ? Math.min(manual, amount(entry?.record?.discountAmount ?? 0))
        : Math.round(auto * rate / 100);
      const adjustment = snapshot ? amount(entry?.record?.openingAdjustment ?? 0) : 0;
      return { auto, manual, discount, adjustment, snapshot };
    };
    let balance = 0;
    let latestRecord: ClinicDebtRecord | undefined;
    for (const [month, entry] of Array.from(clinic.months).sort(([a], [b]) => a - b)) {
      if (month === target) break;
      if (entry.record) latestRecord = entry.record;
      const { auto, manual, discount, adjustment, snapshot } = chargesFor(entry);
      balance += (snapshot ? amount(entry.record?.oldDebt ?? 0) : 0) + auto + manual - discount - adjustment
        - amount(entry.record?.paidAmount || 0)
        - entry.payments.reduce((sum, payment) => sum + amount(payment.amount), 0);
    }

    const current = clinic.months.get(target);
    const record = current?.record;
    const metadata = record || latestRecord;
    const currentOrders = current?.orders || [];
    const { auto: autoOrderDebt, manual: manualCurrentDebt, discount: discountAmount, adjustment: openingAdjustment, snapshot: openingSnapshot } = chargesFor(current);
    if (openingSnapshot) balance += amount(record?.oldDebt ?? 0);
    const oldDebt = Math.max(0, balance);
    const carriedCredit = Math.max(0, -balance);
    const currentMonthDebt = autoOrderDebt + manualCurrentDebt;
    const paidFromPayments = (current?.payments || []).reduce((sum, payment) => sum + amount(payment.amount), 0);
    const paidFromRecords = amount(record?.paidAmount || 0);
    const paidAmount = paidFromPayments + paidFromRecords + carriedCredit;
    const totalDebt = oldDebt + currentMonthDebt - discountAmount;
    const rawNote = (record?.notes || '').trim();

    return {
      id: record?.id || rowId(key, targetMonth),
      clinicName: metadata?.clinicName.trim().normalize('NFC') || clinic.name,
      monthYear: targetMonth,
      oldDebt,
      currentMonthDebt,
      autoOrderDebt,
      manualCurrentDebt,
      discountAmount,
      openingAdjustment,
      openingSnapshot,
      totalDebt,
      paidFromPayments,
      paidFromRecords,
      carriedCredit,
      paidAmount,
      remainingDebt: Math.max(0, totalDebt - paidAmount - openingAdjustment),
      balance: totalDebt - paidAmount - openingAdjustment,
      orderIndex: metadata?.orderIndex ?? 999,
      notes: /^công\s*nợ\s*nha\s*khoa/i.test(rawNote) ? '' : rawNote,
      updatedAt: metadata?.updatedAt || 0,
      orders: currentOrders,
      monthlyBreakdown: currentOrders.length ? [{
        monthYear: targetMonth,
        shortLabel: `T${Number(targetMonth.split('/')[0])}`,
        revenue: autoOrderDebt,
        orderCount: currentOrders.length,
        teethCount: currentOrders.reduce((sum, order) => sum + (order.teethCount || 0), 0),
      }] : [],
    };
  }).sort((a, b) => a.orderIndex - b.orderIndex || a.clinicName.localeCompare(b.clinicName, 'vi'));
}
