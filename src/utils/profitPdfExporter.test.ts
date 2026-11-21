import assert from 'node:assert/strict';
import test from 'node:test';
import type { CashflowTransaction, DebtPaymentRecord } from '../types/dental';
import { buildProfitPdfSections } from './profitPdfExporter';
import { calculateMonthlyProfit, PROFIT_EXPENSE_CATEGORIES, type ProfitSources } from './profit';

const month = '10/2026';
function payment(id: string, monthYear: string, amount: number, paymentDate: string, clinicName = 'Lăng Cô'): DebtPaymentRecord {
  return { id, clinicName, amount, paymentDate, monthYear, method: 'transfer', notes: 'UNC 123', createdAt: 1 };
}
function sources(debtPayments: DebtPaymentRecord[]): ProfitSources {
  const cashflows: CashflowTransaction[] = [
    { id: 'exp', type: 'expense', category: 'Vật tư', amount: 1_000_000, monthYear: month, title: 'Vật tư', date: '', paymentMethod: '', createdAt: 1 },
    { id: 'cf_inc_pay', type: 'income', category: 'Thu công nợ nha khoa', amount: 8_000_000, monthYear: month, title: 'Thu quỹ', date: '05/11/2026', paymentMethod: 'transfer', createdAt: 1 },
  ];
  return { orders: [], clinicDebts: [], discountRates: new Map(), cashflows, deliveries: [], payrolls: [], commissions: [], users: [], debtPayments };
}

test('profit PDF lists each collected debt payment after the profit table, and the total matches Tiền đã thu công nợ', () => {
  const payments = [
    payment('one', '10/2026', 3_000_000, '05/11/2026'),
    payment('two', '10/2026', 2_000_000, '08/11/2026', 'Top Dental'),
    payment('nov', '11/2026', 9_000_000, '01/11/2026'),
  ];
  const report = calculateMonthlyProfit(month, sources(payments));
  const sections = buildProfitPdfSections(report);
  assert.equal(sections[0].title, '1. BẢNG LỢI NHUẬN');
  assert.equal(sections[1].title, '2. DANH SÁCH CÔNG NỢ ĐÃ THU');
  const table = sections[1].tables[0];
  assert.deepEqual(table.columns.map((column) => column.label), [
    'STT', 'Ngày thu', 'Nha khoa', 'Kỳ công nợ', 'Số tiền (đ)', 'Hình thức', 'Ghi chú',
  ]);
  assert.equal(table.rows.length, 2);
  assert.deepEqual(table.rows[0].cells, ['1', '05/11/2026', 'Lăng Cô', '10/2026', '3.000.000 ₫', 'Chuyển khoản', 'UNC 123']);
  assert.deepEqual(table.rows[1].cells, ['2', '08/11/2026', 'Top Dental', '10/2026', '2.000.000 ₫', 'Chuyển khoản', 'UNC 123']);
  assert.equal(table.total?.value, '5.000.000 ₫');
  const profitLabels = sections[0].tables[0].rows.map((row) => row.cells[0]);
  assert.ok(profitLabels.includes('Tiền đã thu công nợ'));
  const collectedRow = sections[0].tables[0].rows.find((row) => row.cells[0] === 'Tiền đã thu công nợ');
  assert.equal(collectedRow?.cells[1], table.total?.value);
  assert.equal(report.collectedDebtAmount, 5_000_000);
  assert.equal(sections[2].title, '3. BẢNG LƯƠNG TỔNG HỢP');
});
