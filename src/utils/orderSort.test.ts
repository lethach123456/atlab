import assert from 'node:assert/strict';
import test from 'node:test';
import type { DentalOrder } from '../types/dental';
import {
  compareDentalOrders,
  DEFAULT_ORDER_SORT_DIRECTION,
  DEFAULT_ORDER_SORT_FIELD,
  sortDentalOrders,
} from './orderSort';

const order = (overrides: Partial<DentalOrder> & { id: string }): DentalOrder => ({
  clinicName: 'Lăng Cô',
  monthYear: '11/2026',
  totalAmount: 1_000_000,
  warrantyCode: overrides.id,
  patientName: 'An',
  phone: '',
  clinicAddress: '',
  material: 'Zirconia',
  warrantyPeriod: '15 năm',
  warrantyYears: 15,
  orderDate: '01/11/2026',
  teeth: '11',
  teethCount: 1,
  toothForm: '',
  unitPrice: 1_000_000,
  status: '',
  createdAt: 100,
  ...overrides,
});

test('default sort is createdAt desc with numeric id as tie-breaker', () => {
  assert.equal(DEFAULT_ORDER_SORT_FIELD, 'createdAt');
  assert.equal(DEFAULT_ORDER_SORT_DIRECTION, 'desc');

  const older = order({ id: 'b', createdAt: 10 });
  const newer = order({ id: 'a', createdAt: 20 });
  const sameNewerId = order({ id: 'order_2', createdAt: 20 });
  const sameOlderId = order({ id: 'order_10', createdAt: 20 });
  const sorted = sortDentalOrders([older, sameOlderId, sameNewerId, newer]);
  assert.deepEqual(sorted.map((row) => row.id), ['order_10', 'order_2', 'a', 'b']);
  assert.ok(compareDentalOrders(newer, older) < 0);
  assert.ok(compareDentalOrders(sameOlderId, sameNewerId) < 0);
});

test('direction also flips the id tie-breaker, and input is not mutated', () => {
  const first = order({ id: 'order_2', createdAt: 20 });
  const second = order({ id: 'order_10', createdAt: 20 });
  const input = [first, second];
  const asc = sortDentalOrders(input, 'createdAt', 'asc');
  assert.deepEqual(asc.map((row) => row.id), ['order_2', 'order_10']);
  assert.deepEqual(input.map((row) => row.id), ['order_2', 'order_10']);
  const desc = sortDentalOrders(input, 'createdAt', 'desc');
  assert.deepEqual(desc.map((row) => row.id), ['order_10', 'order_2']);
});

test('orderDate, amount, teeth, and Vietnamese name fields match the Orders screen rules', () => {
  const late = order({ id: 'late', orderDate: '15/11/2026', createdAt: 1 });
  const early = order({ id: 'early', orderDate: '02/11/2026', createdAt: 9 });
  assert.deepEqual(sortDentalOrders([late, early], 'orderDate', 'desc').map((row) => row.id), ['late', 'early']);

  const cheap = order({ id: 'cheap', totalAmount: 100, teethCount: 8 });
  const pricey = order({ id: 'pricey', totalAmount: 500, teethCount: 2 });
  assert.deepEqual(sortDentalOrders([cheap, pricey], 'totalAmount', 'desc').map((row) => row.id), ['pricey', 'cheap']);
  assert.deepEqual(sortDentalOrders([cheap, pricey], 'teethCount', 'desc').map((row) => row.id), ['cheap', 'pricey']);

  const a = order({ id: '1', patientName: 'Ấn', clinicName: 'Tâm An', warrantyCode: 'BH-2' });
  const b = order({ id: '2', patientName: 'An', clinicName: 'Lăng Cô', warrantyCode: 'BH-10' });
  assert.deepEqual(sortDentalOrders([a, b], 'patientName', 'asc').map((row) => row.id), ['2', '1']);
  assert.deepEqual(sortDentalOrders([a, b], 'clinicName', 'asc').map((row) => row.id), ['2', '1']);
  assert.deepEqual(sortDentalOrders([a, b], 'warrantyCode', 'asc').map((row) => row.id), ['2', '1']);
  assert.deepEqual(sortDentalOrders([a, b], 'id', 'asc').map((row) => row.id), ['1', '2']);
});
