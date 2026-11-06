/** Build create payload for «Nhân đôi dòng» — new identity, reset lifecycle. */

import type { DentalOrder } from '../types/dental';
import { extractMonthYear } from './financeUtils';

export function todayOrderDate(now = new Date()): string {
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Partial input for createOrder / saveWorkspaceRecord.
 * Preserves business fields; clears id/warranty/payment/fulfillment/shipping linkage.
 * Caller supplies a stable `id` for create + retry. Omit warrantyCode so createOrder mints one.
 */
export function buildOrderDuplicateInput(
  source: DentalOrder,
  options: { id: string; now?: Date }
): Partial<DentalOrder> {
  const now = options.now ?? new Date();
  const orderDate = todayOrderDate(now);
  return {
    id: options.id,
    // warrantyCode intentionally omitted → new code at create
    patientName: source.patientName || '',
    phone: source.phone || '',
    clinicName: source.clinicName || '',
    clinicAddress: source.clinicAddress || '',
    material: source.material || '',
    warrantyPeriod: source.warrantyPeriod || '15 năm',
    warrantyYears: source.warrantyYears || 15,
    orderDate,
    monthYear: extractMonthYear(orderDate),
    teeth: source.teeth || '',
    teethCount: source.teethCount ?? 0,
    toothForm: source.toothForm || '',
    unitPrice: source.unitPrice ?? 0,
    totalAmount: source.totalAmount ?? 0,
    notes: source.notes || '',
    shade: source.shade,
    technician: source.technician,
    status: '',
    paymentStatus: 'unpaid',
    // shippingFee omitted on purpose
  };
}

/** Assert duplicate payload does not carry source identity / paid lifecycle. */
export function assertDuplicateIdentityCleared(
  source: DentalOrder,
  payload: Partial<DentalOrder>
): void {
  if (payload.id && payload.id === source.id) {
    throw new Error('Duplicate must use a new order id');
  }
  if (payload.warrantyCode && payload.warrantyCode === source.warrantyCode) {
    throw new Error('Duplicate must not reuse warranty code');
  }
  if (payload.paymentStatus && payload.paymentStatus !== 'unpaid') {
    throw new Error('Duplicate must reset paymentStatus to unpaid');
  }
  if (payload.status === 'completed' || payload.status === 'delivered' || payload.status === 'warranted') {
    throw new Error('Duplicate must not copy fulfilled status');
  }
  if ('shippingFee' in payload && payload.shippingFee != null) {
    throw new Error('Duplicate must not copy shippingFee');
  }
}
