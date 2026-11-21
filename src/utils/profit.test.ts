import assert from 'node:assert/strict';
import test from 'node:test';
import type { CashflowTransaction, ClinicDebtRecord, DebtPaymentRecord } from '../types/dental';
import { calculateMonthlyProfit, PROFIT_EXPENSE_CATEGORIES, monthYearFromCollectedDate, paymentCollectedMonthYear, type ProfitSources } from './profit';

const month = '11/2026';
function expense(id: string, category: string, amount: number, monthYear = month): CashflowTransaction {
  return { id, type: 'expense', category, amount, monthYear, title: id, date: '', paymentMethod: '', createdAt: 1 };
}
function sources(cashflows: CashflowTransaction[], debtPayments: DebtPaymentRecord[] = [], clinicDebts: ClinicDebtRecord[] = []): ProfitSources {
  return { orders: [], clinicDebts, discountRates: new Map(), cashflows, deliveries: [], payrolls: [], commissions: [], users: [], debtPayments };
}

function payment(id: string, monthYear: string, amount: number, paymentDate: string): DebtPaymentRecord {
  return { id, clinicName: 'Lăng Cô', amount, paymentDate, monthYear, method: 'transfer', createdAt: 1 };
}

test('monthly fixed cost edits replace their ledger totals once and preserve the cashflow detail', () => {
  const input = sources([
    expense('rent', PROFIT_EXPENSE_CATEGORIES.rent, 6_000_000),
    expense('legacy-rent', 'Mặt bằng', 1_000_000),
    expense('electricity', 'Tiền điện', 500_000),
    expense('water', 'Tiền nước', 100_000),
    expense('supplies', 'Vật tư', 2_000_000),
    expense('cf_profit_extra', PROFIT_EXPENSE_CATEGORIES.extra, 350_001),
  ]);
  const original = calculateMonthlyProfit(month, input);
  assert.equal(original.rentExpense, 7_000_000);
  assert.equal(original.utilitiesExpense, 600_000);
  assert.equal(original.expenses, 9_950_001);
  input.fixedExpenses = [
    { id: 'rent', monthYear: month, kind: 'rent', amount: 5_500_000 },
    { id: 'utilities', monthYear: month, kind: 'utilities', amount: 748_123 },
  ];
  const edited = calculateMonthlyProfit(month, input);
  assert.equal(edited.rentInCashflow, 7_000_000);
  assert.equal(edited.rentExpense, 5_500_000);
  assert.equal(edited.utilitiesExpense, 748_123);
  assert.equal(edited.operatingExpenses, 2_000_000);
  assert.equal(edited.extraExpense, 350_001);
  assert.equal(edited.expenses, 8_598_124);
  assert.equal(edited.profit, -8_598_124);
  assert.equal(edited.expenseRows.length, 6);
  assert.equal(input.cashflows[0].amount, 6_000_000);
});

test('explicit zero is retained and monthly fixed cost edits do not leak into another month', () => {
  const input = sources([
    expense('november', PROFIT_EXPENSE_CATEGORIES.rent, 6_000_000),
    expense('october', PROFIT_EXPENSE_CATEGORIES.rent, 8_000_000, '10/2026'),
  ]);
  input.fixedExpenses = [{ id: 'rent', monthYear: month, kind: 'rent', amount: 0 }];
  assert.equal(calculateMonthlyProfit(month, input).rentExpense, 0);
  assert.equal(calculateMonthlyProfit('10/2026', input).rentExpense, 8_000_000);
});

test('extra rows are individually counted and salary and shipping cash payments are not added twice', () => {
  const input = sources([
    expense('salary', 'Lương kỹ thuật viên', 4_000_000),
    expense('shipping', 'Chi phí giao vận', 100_000),
    expense('cf_profit_one', PROFIT_EXPENSE_CATEGORIES.extra, 12_345),
    expense('cf_profit_two', PROFIT_EXPENSE_CATEGORIES.extra, 67_890),
  ]);
  input.deliveries = [
    { id: 'lab', monthYear: month, shippingFee: 60_000, payer: '', warrantyCode: '', patientName: '', clinicName: '', clinicAddress: '', deliveryDate: '', direction: '', courierName: '', status: '', createdAt: 1 },
    { id: 'clinic', monthYear: month, shippingFee: 200_000, payer: 'clinic', warrantyCode: '', patientName: '', clinicName: '', clinicAddress: '', deliveryDate: '', direction: '', courierName: '', status: '', createdAt: 1 },
  ];
  const report = calculateMonthlyProfit(month, input);
  assert.equal(report.extraRows.length, 2);
  assert.equal(report.extraExpense, 80_235);
  assert.equal(report.deliveryExpense, 100_000);
  assert.equal(report.assumedLabDelivery, 60_000);
  assert.equal(report.expenses, 4_180_235);
});

test('net profit uses payment date, not the debt period, and keeps accrual profit unchanged', () => {
  const input = sources(
    [expense('supplies', 'Vật tư', 2_000_000, '11/2026')],
    [payment('oct-debt-nov-cash', '10/2026', 8_000_000, '05/11/2026')],
  );
  const october = calculateMonthlyProfit('10/2026', input);
  const november = calculateMonthlyProfit('11/2026', input);
  assert.equal(october.collectedDebtAmount, 0);
  assert.equal(october.expenses, 0);
  assert.equal(october.netProfit, 0);
  assert.equal(october.profit, 0);
  assert.equal(november.collectedDebtAmount, 8_000_000);
  assert.equal(november.expenses, 2_000_000);
  assert.equal(november.netProfit, 6_000_000);
  assert.equal(november.profit, -2_000_000);
});

test('partial payments in the collection month are summed and not double-counted with cashflow or manual paidAmount', () => {
  const cashflows = [
    expense('supplies', 'Vật tư', 1_000_000),
    {
      id: 'cf_inc_pay_one',
      type: 'income' as const,
      category: 'Thu công nợ nha khoa',
      amount: 3_000_000,
      monthYear: '11/2026',
      title: 'Thu công nợ răng sứ - Lăng Cô (Kỳ 10/2026)',
      date: '05/11/2026',
      paymentMethod: 'transfer' as const,
      createdAt: 1,
    },
    {
      id: 'cf_inc_manual',
      type: 'income' as const,
      category: 'Thu công nợ nha khoa',
      amount: 9_000_000,
      monthYear: '11/2026',
      title: 'Thu tay',
      date: '06/11/2026',
      paymentMethod: 'cash' as const,
      createdAt: 1,
    },
  ];
  const debts: ClinicDebtRecord[] = [{
    id: 'debt_langco_10',
    clinicName: 'Lăng Cô',
    monthYear: '11/2026',
    oldDebt: 0,
    currentMonthDebt: 0,
    totalDebt: 0,
    paidAmount: 4_000_000,
    remainingDebt: 0,
    orderIndex: 1,
  }];
  const input = sources(cashflows, [
    payment('pay_one', '10/2026', 3_000_000, '05/11/2026'),
    payment('pay_two', '10/2026', 2_000_000, '20/11/2026'),
  ], debts);
  const report = calculateMonthlyProfit('11/2026', input);
  assert.equal(report.collectedDebtAmount, 5_000_000);
  assert.equal(report.expenses, 1_000_000);
  assert.equal(report.netProfit, 4_000_000);
  assert.equal(report.profit, -1_000_000);
});

test('invalid payment dates fall back to the payment kỳ and carried credit is ignored', () => {
  assert.equal(monthYearFromCollectedDate(''), null);
  assert.equal(monthYearFromCollectedDate('32/11/2026'), null);
  assert.equal(monthYearFromCollectedDate('05/11/2026'), '11/2026');
  assert.equal(paymentCollectedMonthYear({ paymentDate: '', monthYear: '10/2026' }), '10/2026');
  assert.equal(paymentCollectedMonthYear({ paymentDate: 'not-a-date', monthYear: '10/2026' }), '10/2026');
  const input = sources([], [
    payment('no-date', '10/2026', 1_500_000, ''),
    payment('bad-date', '10/2026', 500_000, '99/99/2026'),
  ]);
  assert.equal(calculateMonthlyProfit('10/2026', input).collectedDebtAmount, 2_000_000);
  assert.equal(calculateMonthlyProfit('11/2026', input).collectedDebtAmount, 0);
});
