import type { DentalOrder } from '../types/dental';
import { normalizeClinicName } from './debtLedger';

export interface OrderInvoiceExportScope {
  orders: DentalOrder[];
  clinicName: string;
  monthYear: string;
}

/**
 * Scope for Orders → HĐ PDF:
 * - selected rows if any selection, else currently filtered rows
 * - single clinic → that recipient; multiple → "" (tổng hợp, existing invoice behavior)
 * - month from the list filter ("" when ALL)
 */
export function resolveOrderInvoiceExportScope(input: {
  allOrders: DentalOrder[];
  filteredOrders: DentalOrder[];
  selectedIds: Iterable<string>;
  selectedMonth: string;
}): OrderInvoiceExportScope {
  const selected = new Set(
    [...input.selectedIds].map((id) => String(id || '').trim()).filter(Boolean)
  );
  const orders =
    selected.size > 0
      ? input.allOrders.filter((order) => selected.has(order.id))
      : [...input.filteredOrders];

  const clinicKeys = new Map<string, string>();
  for (const order of orders) {
    const raw = (order.clinicName || '').trim();
    if (!raw) continue;
    const key = normalizeClinicName(raw);
    if (!clinicKeys.has(key)) clinicKeys.set(key, raw);
  }

  const clinicName = clinicKeys.size === 1 ? [...clinicKeys.values()][0] : '';
  const monthYear =
    input.selectedMonth && input.selectedMonth !== 'ALL' ? input.selectedMonth : '';

  return { orders, clinicName, monthYear };
}
