import type { ClinicDebtRecord, DebtPaymentRecord, DentalOrder } from '../types/dental';
import { calculateDebtRows } from './debtLedger';
import { getPreviousMonthYear, sortMonthYearsDesc } from './financeUtils';
import { getCurrentMonthYear } from './dashboardMetrics';
import { calculateMonthlyProfit, type MonthlyProfitReport, type ProfitSources } from './profit';
import { sortDentalOrders } from './orderSort';

export const DEMO_DASHBOARD_RECENT_LIMIT = 8;
export const DEMO_DASHBOARD_TOP_CLINICS = 6;

export interface MetricDelta {
  current: number;
  previous: number;
  amount: number;
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface DemoDashboardKpi {
  key: 'revenue' | 'orders' | 'remainingDebt' | 'collectedDebt' | 'netProfit';
  label: string;
  current: number;
  previous: number;
  delta: MetricDelta;
  invertTrend?: boolean;
}

export interface DemoMonthRevenue {
  monthYear: string;
  shortLabel: string;
  revenue: number;
}

export interface DemoDashboardModel {
  selectedMonth: string;
  previousMonth: string;
  months: string[];
  trailingMonths: DemoMonthRevenue[];
  currentReport: MonthlyProfitReport;
  previousReport: MonthlyProfitReport;
  kpis: DemoDashboardKpi[];
  remainingDebt: number;
  previousRemainingDebt: number;
  topClinics: MonthlyProfitReport['salesRows'];
  recentOrders: DentalOrder[];
  orderCount: number;
  previousOrderCount: number;
}

export function metricDelta(current: number, previous: number): MetricDelta {
  const amount = current - previous;
  const direction: MetricDelta['direction'] = amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat';
  const percent = previous === 0 ? (current === 0 ? 0 : null) : amount / Math.abs(previous);
  return { current, previous, amount, percent, direction };
}

export function listTrailingMonthYears(endMonth: string, count = 12): string[] {
  const months = [endMonth];
  let cursor = endMonth;
  for (let index = 1; index < count; index += 1) {
    cursor = getPreviousMonthYear(cursor);
    if (!cursor || cursor === months[0]) break;
    months.unshift(cursor);
  }
  return months;
}

export function listDemoDashboardMonths(
  orders: readonly DentalOrder[],
  now = new Date(),
): string[] {
  const set = new Set<string>([getCurrentMonthYear(now)]);
  for (const order of orders) {
    if (order.monthYear) set.add(order.monthYear);
  }
  return sortMonthYearsDesc([...set]);
}

export function remainingDebtForMonth(
  monthYear: string,
  orders: readonly DentalOrder[],
  clinicDebts: readonly ClinicDebtRecord[],
  payments: readonly DebtPaymentRecord[],
  discountRates: ReadonlyMap<string, number> = new Map(),
): number {
  return calculateDebtRows(
    [...orders],
    [...clinicDebts],
    [...payments],
    monthYear,
    discountRates,
  ).reduce((sum, row) => sum + row.remainingDebt, 0);
}

function kpi(
  key: DemoDashboardKpi['key'],
  label: string,
  current: number,
  previous: number,
  invertTrend = false,
): DemoDashboardKpi {
  return { key, label, current, previous, delta: metricDelta(current, previous), invertTrend };
}

function shortMonthLabel(monthYear: string): string {
  const [month, year] = monthYear.split('/');
  return year ? `T${Number(month)}/${year.slice(-2)}` : monthYear;
}

export function buildDemoDashboardModel(
  selectedMonth: string,
  sources: ProfitSources,
): DemoDashboardModel {
  const previousMonth = getPreviousMonthYear(selectedMonth);
  const currentReport = calculateMonthlyProfit(selectedMonth, sources);
  const previousReport = calculateMonthlyProfit(previousMonth, sources);
  const periodOrders = sources.orders.filter((order) => order.monthYear === selectedMonth);
  const previousOrders = sources.orders.filter((order) => order.monthYear === previousMonth);
  const remainingDebt = remainingDebtForMonth(
    selectedMonth, sources.orders, sources.clinicDebts, sources.debtPayments ?? [], sources.discountRates,
  );
  const previousRemainingDebt = remainingDebtForMonth(
    previousMonth, sources.orders, sources.clinicDebts, sources.debtPayments ?? [], sources.discountRates,
  );
  const trailingMonths = listTrailingMonthYears(selectedMonth).map((monthYear) => ({
    monthYear,
    shortLabel: shortMonthLabel(monthYear),
    revenue: monthYear === selectedMonth
      ? currentReport.grossRevenue
      : monthYear === previousMonth
        ? previousReport.grossRevenue
        : calculateMonthlyProfit(monthYear, sources).grossRevenue,
  }));

  return {
    selectedMonth,
    previousMonth,
    months: listDemoDashboardMonths(sources.orders),
    trailingMonths,
    currentReport,
    previousReport,
    remainingDebt,
    previousRemainingDebt,
    orderCount: periodOrders.length,
    previousOrderCount: previousOrders.length,
    topClinics: currentReport.salesRows.slice(0, DEMO_DASHBOARD_TOP_CLINICS),
    recentOrders: sortDentalOrders(periodOrders).slice(0, DEMO_DASHBOARD_RECENT_LIMIT),
    kpis: [
      kpi('revenue', 'Doanh thu', currentReport.grossRevenue, previousReport.grossRevenue),
      kpi('orders', 'Số đơn', periodOrders.length, previousOrders.length),
      kpi('remainingDebt', 'Công nợ còn lại', remainingDebt, previousRemainingDebt, true),
      kpi('collectedDebt', 'Đã thu công nợ', currentReport.collectedDebtAmount, previousReport.collectedDebtAmount),
      kpi('netProfit', 'Lợi nhuận ròng', currentReport.netProfit, previousReport.netProfit),
    ],
  };
}
