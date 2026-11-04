import assert from 'node:assert/strict';
import test from 'node:test';
import type { CashflowTransaction } from '../types/dental';
import { calculateMonthlyProfit, PROFIT_EXPENSE_CATEGORIES, type ProfitSources } from './profit';

const month = '11/2026';
function expense(id: string, category: string, amount: number, monthYear = month): CashflowTransaction {
  return { id, type: 'expense', category, amount, monthYear, title: id, date: '', paymentMethod: '', createdAt: 1 };
}
function sources(cashflows: CashflowTransaction[]): ProfitSources {
  return { orders: [], clinicDebts: [], discountRates: new Map(), cashflows, deliveries: [], payrolls: [], commissions: [], users: [] };
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
