import type { DentalOrder } from '../types/dental';

export interface DailyMetric {
  day: string;
  date: string;
  revenue: number;
  teeth: number;
  orders: number;
}

export interface ShareSegment {
  name: string;
  value: number;
  fraction: number;
  percent: number;
}

export function getCurrentMonthYear(date = new Date()): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function parseMonthYear(value: string): { month: number; year: number } | null {
  const match = /^(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  return month >= 1 && month <= 12 && year >= 1000 ? { month, year } : null;
}

function parseOrderDate(value: string): { day: number; month: number; year: number } | null {
  const text = value.trim();
  const local = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!local && !iso) return null;
  const day = Number(local ? local[1] : iso![3]);
  const month = Number(local ? local[3] : iso![2]);
  const year = Number(local ? local[4] : iso![1]);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return null;
  if (day > new Date(year, month, 0).getDate()) return null;
  return { day, month, year };
}

export function buildDailyMetrics(orders: DentalOrder[], monthYear: string): DailyMetric[] {
  const period = parseMonthYear(monthYear);
  if (!period) return [];
  const normalizedMonth = `${String(period.month).padStart(2, '0')}/${period.year}`;
  const days = Array.from({ length: new Date(period.year, period.month, 0).getDate() }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return { day, date: `${day}/${normalizedMonth}`, revenue: 0, teeth: 0, orders: 0 };
  });

  for (const order of orders) {
    const accountingMonth = parseMonthYear(order.monthYear || '');
    if (!accountingMonth || accountingMonth.month !== period.month || accountingMonth.year !== period.year) continue;
    const date = parseOrderDate(order.orderDate || '');
    if (!date || date.month !== period.month || date.year !== period.year) continue;
    const metric = days[date.day - 1];
    metric.orders += 1;
    metric.revenue += Number.isFinite(order.totalAmount) ? order.totalAmount : 0;
    metric.teeth += Number.isFinite(order.teethCount) ? order.teethCount : 0;
  }

  return days;
}

export function buildShareSegments(
  items: { name: string; value: number }[],
  limit = 4
): ShareSegment[] {
  const grouped = new Map<string, number>();
  for (const item of items) {
    if (!Number.isFinite(item.value) || item.value <= 0) continue;
    const name = item.name.trim().normalize('NFC') || 'Chưa xác định';
    grouped.set(name, (grouped.get(name) || 0) + item.value);
  }
  const ranked = Array.from(grouped, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 4;
  const segments = ranked.slice(0, count);
  const remainder = ranked.slice(count).reduce((total, item) => total + item.value, 0);
  if (remainder > 0) {
    const other = segments.find((item) => item.name === 'Khác');
    if (other) other.value += remainder;
    else segments.push({ name: 'Khác', value: remainder });
  }
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  return segments.map((item) => ({ ...item, fraction: item.value / total, percent: item.value / total * 100 }));
}
