import assert from 'node:assert/strict';
import test from 'node:test';
import type { DebtPaymentRecord, DentalOrder } from '../types/dental';
import {
  buildDemoDashboardModel,
  listTrailingMonthYears,
  metricDelta,
  remainingDebtForMonth,
} from './demoDashboard';
import type { ProfitSources } from './profit';

const order = (overrides: Partial<DentalOrder> & { id: string; monthYear: string; createdAt: number }): DentalOrder => ({
  warrantyCode: overrides.id,
  patientName: 'An',
  phone: '',
  clinicName: 'Lăng Cô',
  clinicAddress: '',
  material: 'Zirconia',
  warrantyPeriod: '15 năm',
  warrantyYears: 15,
  orderDate: `15/${overrides.monthYear}`,
  teeth: '11',
  teethCount: 1,
  toothForm: '',
  unitPrice: 1_000_000,
  totalAmount: 1_000_000,
  status: '',
  ...overrides,
});

const payment = (overrides: Partial<DebtPaymentRecord> & { id: string }): DebtPaymentRecord => ({
  clinicName: 'Lăng Cô',
  amount: 400_000,
  paymentDate: '20/11/2026',
  monthYear: '11/2026',
  method: 'transfer',
  notes: '',
  createdAt: 1,
  ...overrides,
});

function sources(partial: Partial<ProfitSources> = {}): ProfitSources {
  return {
    orders: [],
    clinicDebts: [],
    discountRates: new Map(),
    cashflows: [],
    deliveries: [],
    payrolls: [],
    commissions: [],
    users: [],
    fixedExpenses: [],
    debtPayments: [],
    ...partial,
  };
}

test('metricDelta and trailing 12 months are stable', () => {
  assert.deepEqual(metricDelta(120, 100), {
    current: 120, previous: 100, amount: 20, percent: 0.2, direction: 'up',
  });
  assert.equal(metricDelta(0, 0).percent, 0);
  assert.equal(metricDelta(50, 0).percent, null);
  assert.deepEqual(listTrailingMonthYears('03/2026'), [
    '04/2025', '05/2025', '06/2025', '07/2025', '08/2025', '09/2025',
    '10/2025', '11/2025', '12/2025', '01/2026', '02/2026', '03/2026',
  ]);
});

test('buildDemoDashboardModel uses profit, debt, collected-by-period, and createdAt desc', () => {
  const data = sources({
    orders: [
      order({ id: 'old', monthYear: '11/2026', createdAt: 10, totalAmount: 2_000_000, unitPrice: 2_000_000 }),
      order({ id: 'new', monthYear: '11/2026', createdAt: 30, totalAmount: 3_000_000, unitPrice: 3_000_000, clinicName: 'Tâm An' }),
      order({ id: 'oct', monthYear: '10/2026', createdAt: 5, totalAmount: 1_000_000, clinicName: 'Tâm An' }),
    ],
    debtPayments: [
      payment({ id: 'p1', amount: 400_000, monthYear: '11/2026', paymentDate: '02/12/2026' }),
    ],
  });
  const model = buildDemoDashboardModel('11/2026', data);
  assert.equal(model.previousMonth, '10/2026');
  assert.equal(model.currentReport.grossRevenue, 5_000_000);
  assert.equal(model.previousReport.grossRevenue, 1_000_000);
  assert.equal(model.orderCount, 2);
  assert.equal(model.previousOrderCount, 1);
  assert.equal(model.currentReport.collectedDebtAmount, 400_000);
  assert.deepEqual(model.recentOrders.map((row) => row.id), ['new', 'old']);
  assert.equal(model.topClinics[0].clinicName, 'Tâm An');
  assert.equal(model.kpis[0].label, 'Doanh thu');
  assert.equal(model.kpis[3].current, 400_000);
  assert.equal(model.trailingMonths.length, 12);
  assert.equal(model.trailingMonths.at(-1)?.monthYear, '11/2026');
  assert.equal(model.trailingMonths.at(-1)?.revenue, 5_000_000);

  const remaining = remainingDebtForMonth('11/2026', data.orders, [], data.debtPayments ?? [], new Map());
  assert.equal(model.remainingDebt, remaining);
  assert.ok(remaining >= 0);
});
