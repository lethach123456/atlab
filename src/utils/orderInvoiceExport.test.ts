import assert from 'node:assert/strict';
import test from 'node:test';
import type { DentalOrder } from '../types/dental';
import { resolveOrderInvoiceExportScope } from './orderInvoiceExport';

const order = (
  id: string,
  clinicName: string,
  monthYear = '11/2026',
  totalAmount = 1_000_000
): DentalOrder => ({
  id,
  clinicName,
  monthYear,
  totalAmount,
  warrantyCode: id,
  patientName: 'KH',
  phone: '',
  clinicAddress: '',
  material: 'Zirconia',
  warrantyPeriod: '15 năm',
  warrantyYears: 15,
  orderDate: `01/${monthYear}`,
  teeth: '11',
  teethCount: 1,
  toothForm: '',
  unitPrice: totalAmount,
  status: '',
  createdAt: 1,
});

test('uses selection when present, else filtered list', () => {
  const all = [order('a', 'Lăng Cô'), order('b', 'Tâm An'), order('c', 'Lăng Cô')];
  const filtered = [all[0], all[1]];
  const selected = resolveOrderInvoiceExportScope({
    allOrders: all,
    filteredOrders: filtered,
    selectedIds: ['a'],
    selectedMonth: '11/2026',
  });
  assert.deepEqual(selected.orders.map((o) => o.id), ['a']);
  assert.equal(selected.clinicName, 'Lăng Cô');
  assert.equal(selected.monthYear, '11/2026');

  const filteredOnly = resolveOrderInvoiceExportScope({
    allOrders: all,
    filteredOrders: filtered,
    selectedIds: [],
    selectedMonth: '11/2026',
  });
  assert.deepEqual(filteredOnly.orders.map((o) => o.id), ['a', 'b']);
  assert.equal(filteredOnly.clinicName, '');
});

test('single clinic across selection sets recipient; multi uses tổng hợp', () => {
  const all = [order('a', 'Lăng Cô'), order('b', 'Lăng Cô'), order('c', 'Tâm An')];
  const oneClinic = resolveOrderInvoiceExportScope({
    allOrders: all,
    filteredOrders: all,
    selectedIds: ['a', 'b'],
    selectedMonth: 'ALL',
  });
  assert.equal(oneClinic.clinicName, 'Lăng Cô');
  assert.equal(oneClinic.monthYear, '');

  const multi = resolveOrderInvoiceExportScope({
    allOrders: all,
    filteredOrders: all,
    selectedIds: ['a', 'c'],
    selectedMonth: '11/2026',
  });
  assert.equal(multi.clinicName, '');
  assert.equal(multi.monthYear, '11/2026');
});

test('empty selection and empty filter yields empty safe scope', () => {
  const scope = resolveOrderInvoiceExportScope({
    allOrders: [order('a', 'Lăng Cô')],
    filteredOrders: [],
    selectedIds: [],
    selectedMonth: '11/2026',
  });
  assert.equal(scope.orders.length, 0);
  assert.equal(scope.clinicName, '');
  assert.equal(scope.monthYear, '11/2026');
});

test('treats accent/spacing clinic variants as one recipient', () => {
  const all = [order('a', 'Lăng Cô'), order('b', '  LĂNG   CÔ  ')];
  const scope = resolveOrderInvoiceExportScope({
    allOrders: all,
    filteredOrders: all,
    selectedIds: ['a', 'b'],
    selectedMonth: '10/2026',
  });
  assert.equal(scope.orders.length, 2);
  assert.ok(scope.clinicName.length > 0);
});
