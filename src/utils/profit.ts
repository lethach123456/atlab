import type { CashflowTransaction, ClinicDebtRecord, DeliveryRecord, DentalOrder } from '../types/dental';
import type { EmployeePayroll } from '../types/payroll';
import type { SaleCommission } from '../types/commission';
import type { UserProfile } from '../types/user';
import { calculateDebtRows, DEBT_START_MONTH, normalizeClinicName } from './debtLedger';
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

export interface ProfitSources {
  orders: DentalOrder[];
  clinicDebts: ClinicDebtRecord[];
  discountRates: ReadonlyMap<string, number>;
  cashflows: CashflowTransaction[];
  deliveries: DeliveryRecord[];
  payrolls: EmployeePayroll[];
  commissions: SaleCommission[];
  users: UserProfile[];
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
  const rentExpense = takeCategories(PROFIT_EXPENSE_CATEGORIES.rent, 'Mặt bằng', 'Tiền thuê mặt bằng');
  const utilitiesExpense = takeCategories(PROFIT_EXPENSE_CATEGORIES.utilities, 'Điện nước & vận hành', 'Tiền điện', 'Tiền nước');
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
  return {
    grossRevenue, discounts, netRevenue, expenses, profit,
    margin: netRevenue > 0 ? profit / netRevenue : null,
    payrollExpense, savedPayroll, payrollInCashflow, payrollRows,
    deliveryExpense, labDelivery, deliveryInCashflow, assumedLabDelivery, clinicDelivery, deliveryRows,
    operatingExpenses, rentExpense, utilitiesExpense, extraExpense, otherExpenses,
    expenseRows, extraRows, manualExpenseRows, salesRows,
  };
}
