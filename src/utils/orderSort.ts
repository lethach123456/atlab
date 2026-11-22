import type { DentalOrder } from '../types/dental';

export type OrderSortField =
  | 'id'
  | 'createdAt'
  | 'orderDate'
  | 'warrantyCode'
  | 'patientName'
  | 'clinicName'
  | 'teethCount'
  | 'totalAmount';

export type OrderSortDirection = 'asc' | 'desc';

export const DEFAULT_ORDER_SORT_FIELD: OrderSortField = 'createdAt';
export const DEFAULT_ORDER_SORT_DIRECTION: OrderSortDirection = 'desc';

function orderDateValue(dateStr: string): number {
  const parts = (dateStr || '').split(/[\/-]/);
  if (parts.length >= 3) {
    return (
      parseInt(parts[2], 10) * 10000 +
      parseInt(parts[1], 10) * 100 +
      parseInt(parts[0], 10)
    );
  }
  return 0;
}

function compareIds(a: string, b: string): number {
  return String(a || '').localeCompare(String(b || ''), 'en', { numeric: true });
}

/** Same rules as the Đơn hàng list, with a deterministic id tie-breaker. */
export function compareDentalOrders(
  a: DentalOrder,
  b: DentalOrder,
  field: OrderSortField = DEFAULT_ORDER_SORT_FIELD,
  direction: OrderSortDirection = DEFAULT_ORDER_SORT_DIRECTION,
): number {
  let comp = 0;
  if (field === 'createdAt') {
    comp = (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
  } else if (field === 'id') {
    comp = compareIds(a.id, b.id);
  } else if (field === 'orderDate') {
    comp = orderDateValue(a.orderDate) - orderDateValue(b.orderDate);
  } else if (field === 'teethCount') {
    comp = (a.teethCount ?? 0) - (b.teethCount ?? 0);
  } else if (field === 'totalAmount') {
    comp = (a.totalAmount || 0) - (b.totalAmount || 0);
  } else {
    const valA = (a[field] || '').toLowerCase();
    const valB = (b[field] || '').toLowerCase();
    comp = valA.localeCompare(valB, 'vi');
  }
  if (comp === 0 && field !== 'id') {
    comp = compareIds(a.id, b.id);
  }
  return direction === 'asc' ? comp : -comp;
}

export function sortDentalOrders<T extends DentalOrder>(
  orders: readonly T[],
  field: OrderSortField = DEFAULT_ORDER_SORT_FIELD,
  direction: OrderSortDirection = DEFAULT_ORDER_SORT_DIRECTION,
): T[] {
  return [...orders].sort((a, b) => compareDentalOrders(a, b, field, direction));
}
