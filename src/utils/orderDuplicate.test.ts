import assert from 'node:assert/strict';
import test from 'node:test';
import type { DentalOrder } from '../types/dental';
import {
  assertDuplicateIdentityCleared,
  buildOrderDuplicateInput,
  todayOrderDate,
} from './orderDuplicate';

const source: DentalOrder = {
  id: 'order_src_1',
  warrantyCode: 'NS50205',
  patientName: 'Nguyễn A',
  phone: '0901',
  clinicName: 'Nha khoa Test',
  clinicAddress: 'Đà Nẵng',
  material: 'Full Zirconia',
  warrantyPeriod: '15 năm',
  warrantyYears: 15,
  orderDate: '01/01/2025',
  monthYear: '01/2025',
  teeth: '11-21',
  teethCount: 2,
  toothForm: 'Form tự nhiên',
  unitPrice: 390000,
  totalAmount: 780000,
  shippingFee: 50000,
  shade: 'A2',
  technician: 'Tech',
  notes: 'Ghi chú',
  status: 'completed',
  paymentStatus: 'paid',
  createdAt: 1,
};

test('todayOrderDate formats DD/MM/YYYY', () => {
  assert.equal(todayOrderDate(new Date(2026, 10, 7)), '07/11/2026');
});

test('buildOrderDuplicateInput preserves business fields and clears lifecycle', () => {
  const payload = buildOrderDuplicateInput(source, {
    id: 'order_dup_stable',
    now: new Date(2026, 10, 7),
  });
  assert.equal(payload.id, 'order_dup_stable');
  assert.equal(payload.warrantyCode, undefined);
  assert.equal(payload.patientName, 'Nguyễn A');
  assert.equal(payload.clinicName, 'Nha khoa Test');
  assert.equal(payload.material, 'Full Zirconia');
  assert.equal(payload.teethCount, 2);
  assert.equal(payload.totalAmount, 780000);
  assert.equal(payload.unitPrice, 390000);
  assert.equal(payload.notes, 'Ghi chú');
  assert.equal(payload.shade, 'A2');
  assert.equal(payload.orderDate, '07/11/2026');
  assert.equal(payload.monthYear, '11/2026');
  assert.equal(payload.status, '');
  assert.equal(payload.paymentStatus, 'unpaid');
  assert.equal('shippingFee' in payload, false);
  assertDuplicateIdentityCleared(source, payload);
});

test('assertDuplicateIdentityCleared rejects reused id', () => {
  assert.throws(() =>
    assertDuplicateIdentityCleared(source, { id: source.id, status: '', paymentStatus: 'unpaid' })
  );
});
