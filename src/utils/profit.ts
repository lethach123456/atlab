import type { CashflowTransaction, ClinicDebtRecord, DebtPaymentRecord, DeliveryRecord, DentalOrder } from '../types/dental';
import type { EmployeePayroll } from '../types/payroll';
import type { SaleCommission } from '../types/commission';
import type { UserProfile } from '../types/user';
import { calculateDebtRows, DEBT_START_MONTH, debtMonthValue, normalizeClinicName } from './debtLedger';
import { buildMonthlyPayroll } from './payrollReport';

export const PAYROLL_EXPENSE_CATEGORY = 'Lương kỹ thuật viên';
export const DELIVERY_EXPENSE_CATEGORY = 'Chi phí giao vận';
export const PROFIT_EXPENSE_CATEGORIES = {
  rent: 'Chi phí mặt bằng',
  utilities: 'Điện nước',
  extra: 'Chi phí khác (lợi nhuận)',
} as const;
export type ProfitExpenseKind = keyof typeof PROFIT_EXPENSE_CATEGORIES;

export interface ProfitExpenseInput {
  monthYear: string;
  kind: ProfitExpenseKind;
  title: string;
  amount: number;
}

export interface ProfitFixedExpense {
  id: string;
  monthYear: string;
  kind: 'rent' | 'utilities';
  amount: number;
  updatedAt?: number;
}

export type ProfitFixedExpenseInput = Pick<ProfitFixedExpense, 'monthYear' | 'kind' | 'amount'>;

export interface ProfitSources {
  orders: DentalOrder[];
  clinicDebts: ClinicDebtRecord[];
  discountRates: ReadonlyMap<string, number>;
  cashflows: CashflowTransaction[];
  deliveries: DeliveryRecord[];
  payrolls: EmployeePayroll[];
  commissions: SaleCommission[];
  users: UserProfile[];
  fixedExpenses?: ProfitFixedExpense[];
  debtPayments?: DebtPaymentRecord[];
}


const collectedAmount = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

/** Month a debt payment counts toward net profit: the kỳ công nợ, not the payment date. */
export function paymentCollectedMonthYear(
  payment: Pick<DebtPaymentRecord, 'paymentDate' | 'monthYear'>,
): string | null {
  return debtMonthValue(payment.monthYear) !== null ? payment.monthYear : null;
}

function paymentDateSortValue(dateStr: string | undefined): number {
  const parts = String(dateStr ?? '').trim().split(/[/.\-]/);
  if (parts.length < 3) return Number.MAX_SAFE_INTEGER;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return Number.MAX_SAFE_INTEGER;
  return year * 10000 + month * 100 + day;
}

/** debtPayments for a kỳ (or every kỳ from DEBT_START_MONTH), optionally one clinic.
 * Excludes clinicDebts.paidAmount, cashflow income, and carried credit.
 */
export function collectedDebtPaymentsForScope(
  payments: readonly DebtPaymentRecord[] | undefined,
  options: { monthYear?: string; clinicName?: string } = {},
): DebtPaymentRecord[] {
  const monthYear = options.monthYear || '';
  const clinicKey = options.clinicName ? normalizeClinicName(options.clinicName) : '';
  const start = debtMonthValue(DEBT_START_MONTH)!;
  return (payments ?? []).filter((payment) => {
    const period = paymentCollectedMonthYear(payment);
    if (!period) return false;
    const value = debtMonthValue(period);
    if (value === null || value < start) return false;
    if (monthYear && period !== monthYear) return false;
    if (clinicKey && normalizeClinicName(payment.clinicName) !== clinicKey) return false;
    return true;
  }).sort((a, b) =>
    paymentDateSortValue(a.paymentDate) - paymentDateSortValue(b.paymentDate)
    || a.clinicName.localeCompare(b.clinicName, 'vi')
    || a.id.localeCompare(b.id)
  );
}

export function collectedDebtAmountForScope(
  payments: readonly DebtPaymentRecord[] | undefined,
  options: { monthYear?: string; clinicName?: string } = {},
): number {
  return collectedDebtPaymentsForScope(payments, options)
    .reduce((sum, payment) => sum + collectedAmount(payment.amount), 0);
}

export function isManualProfitExpense(row: CashflowTransaction): boolean {
  return row.type === 'expense' && row.id.startsWith('cf_profit_') &&
    Object.values(PROFIT_EXPENSE_CATEGORIES).some((category) => category === row.category);
}

interface ClinicSalesRow {
  clinicName: string;
  orderCount: number;
  teethCount: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
}

function calculateClinicSales(month: string, orders: DentalOrder[], debts: ClinicDebtRecord[], rates: ReadonlyMap<string, number>) {
  const periodDebts = debts.filter((debt) => debt.monthYear === month);
  const openingStatement = month === DEBT_START_MONTH && periodDebts.some((row) => row.openingSnapshot);
  const byClinic = new Map<string, ClinicSalesRow>();
  const getRow = (name: string) => {
    const key = normalizeClinicName(name);
    let row = byClinic.get(key);
    if (!row) {
      row = { clinicName: name.trim() || 'Chưa ghi nha khoa', orderCount: 0, teethCount: 0, grossRevenue: 0, discountAmount: 0, netRevenue: 0 };
      byClinic.set(key, row);
    }
    return row;
  };

  for (const order of orders) {
    const row = getRow(order.clinicName || '');
    row.orderCount += 1;
    row.teethCount += order.teethCount || 0;
    if (!openingStatement) row.grossRevenue += Math.round(order.totalAmount || 0);
  }
  // The September statement supersedes order amounts but order counts are still available.
  for (const debt of calculateDebtRows(orders, periodDebts, [], month, rates)) {
    if (openingStatement && !debt.openingSnapshot) continue;
    const row = getRow(debt.clinicName);
    if (openingStatement) row.grossRevenue = debt.currentMonthDebt;
    row.discountAmount = debt.discountAmount;
  }

  return Array.from(byClinic.values(), (row) => ({
    ...row, netRevenue: row.grossRevenue - row.discountAmount,
  })).filter((row) => row.orderCount || row.grossRevenue || row.discountAmount)
    .sort((a, b) => b.grossRevenue - a.grossRevenue || a.clinicName.localeCompare(b.clinicName, 'vi'));
}

export function calculateMonthlyProfit(month: string, sources: ProfitSources) {
  const { orders, clinicDebts, discountRates, cashflows, deliveries, payrolls, commissions, users } = sources;
  const periodOrders = orders.filter((order) => order.monthYear === month);
  const salesRows = calculateClinicSales(month, periodOrders, clinicDebts, discountRates);
  const grossRevenue = salesRows.reduce((sum, row) => sum + row.grossRevenue, 0);
  const discounts = salesRows.reduce((sum, row) => sum + row.discountAmount, 0);
  const netRevenue = grossRevenue - discounts;

  const expenseRows = cashflows.filter((row) => row.monthYear === month && row.type === 'expense')
    .sort((a, b) => b.createdAt - a.createdAt);
  const extraRows = expenseRows.filter((row) => row.category === PROFIT_EXPENSE_CATEGORIES.extra);
  const manualExpenseRows = expenseRows.filter(isManualProfitExpense);
  const categories = new Map<string, number>();
  for (const row of expenseRows) {
    const category = row.category.trim() || 'Khoản chi khác';
    categories.set(category, (categories.get(category) ?? 0) + row.amount);
  }
  const takeCategories = (...names: string[]) => names.reduce((total, name) => {
    const amount = categories.get(name) ?? 0;
    categories.delete(name);
    return total + amount;
  }, 0);
  const rentInCashflow = takeCategories(PROFIT_EXPENSE_CATEGORIES.rent, 'Mặt bằng', 'Tiền thuê mặt bằng');
  const utilitiesInCashflow = takeCategories(PROFIT_EXPENSE_CATEGORIES.utilities, 'Điện nước & vận hành', 'Tiền điện', 'Tiền nước');
  const fixedExpenses = (sources.fixedExpenses ?? []).filter((row) => row.monthYear === month);
  const rentExpense = fixedExpenses.find((row) => row.kind === 'rent')?.amount ?? rentInCashflow;
  const utilitiesExpense = fixedExpenses.find((row) => row.kind === 'utilities')?.amount ?? utilitiesInCashflow;
  const extraExpense = takeCategories(PROFIT_EXPENSE_CATEGORIES.extra);
  const payrollInCashflow = takeCategories(PAYROLL_EXPENSE_CATEGORY);
  const deliveryInCashflow = takeCategories(DELIVERY_EXPENSE_CATEGORY);
  const otherExpenses = Array.from(categories, ([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'vi'));
  const operatingExpenses = otherExpenses.reduce((sum, row) => sum + row.amount, 0);

  const payrollRows = buildMonthlyPayroll(payrolls, periodOrders, commissions, month, users);
  const savedPayroll = payrollRows.reduce((sum, row) => sum + row.netSalary, 0);
  const deliveryRows = deliveries.filter((row) => row.monthYear === month);
  let assumedLabDelivery = 0;
  let labDelivery = 0;
  let clinicDelivery = 0;
  for (const row of deliveryRows) {
    if (row.payer === 'clinic') {
      clinicDelivery += row.shippingFee;
    } else {
      labDelivery += row.shippingFee;
      if (!row.payer) assumedLabDelivery += row.shippingFee;
    }
  }

  // A cash payment can also be represented in the payroll or delivery ledger.
  const payrollExpense = Math.max(savedPayroll, payrollInCashflow);
  const deliveryExpense = Math.max(labDelivery, deliveryInCashflow);
  const expenses = payrollExpense + deliveryExpense + operatingExpenses + rentExpense + utilitiesExpense + extraExpense;
  const profit = netRevenue - expenses;
  const collectedDebtPayments = collectedDebtPaymentsForScope(sources.debtPayments, { monthYear: month });
  const collectedDebtAmount = collectedDebtPayments.reduce(
    (sum, payment) => sum + collectedAmount(payment.amount),
    0,
  );
  const netProfit = collectedDebtAmount - expenses;
  return {
    grossRevenue, discounts, netRevenue, expenses, profit, collectedDebtAmount, netProfit, collectedDebtPayments,
    margin: netRevenue > 0 ? profit / netRevenue : null,
    payrollExpense, savedPayroll, payrollInCashflow, payrollRows,
    deliveryExpense, labDelivery, deliveryInCashflow, assumedLabDelivery, clinicDelivery, deliveryRows,
    operatingExpenses, rentExpense, utilitiesExpense, rentInCashflow, utilitiesInCashflow, extraExpense, otherExpenses,
    expenseRows, extraRows, manualExpenseRows, salesRows,
  };
}

export type MonthlyProfitReport = ReturnType<typeof calculateMonthlyProfit>;
