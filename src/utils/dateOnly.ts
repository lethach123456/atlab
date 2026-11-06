/** Date-only helpers for DD/MM/YYYY UI — never use UTC/ISO string shifts for calendar days. */

export interface DateOnlyParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDdMmYyyy(parts: DateOnlyParts): string {
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

export function formatMonthYear(parts: Pick<DateOnlyParts, 'year' | 'month'>): string {
  return `${pad2(parts.month)}/${parts.year}`;
}

/** Local calendar parts from a Date (wall-clock), not UTC. */
export function partsFromLocalDate(date: Date): DateOnlyParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function todayParts(now = new Date()): DateOnlyParts {
  return partsFromLocalDate(now);
}

export function todayDdMmYyyy(now = new Date()): string {
  return formatDdMmYyyy(todayParts(now));
}

/**
 * Parse DD/MM/YYYY (1–2 digit day/month allowed).
 * Returns null for empty/malformed/impossible calendar days (e.g. 31/02, 29/02 non-leap).
 */
export function parseDdMmYyyy(raw: string | null | undefined): DateOnlyParts | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const match = DMY_RE.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isValidDdMmYyyy(raw: string | null | undefined): boolean {
  return parseDdMmYyyy(raw) != null;
}

/** Normalize to zero-padded DD/MM/YYYY or null if invalid. */
export function normalizeDdMmYyyy(raw: string | null | undefined): string | null {
  const parts = parseDdMmYyyy(raw);
  return parts ? formatDdMmYyyy(parts) : null;
}

export function compareDateOnly(a: DateOnlyParts, b: DateOnlyParts): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function addMonths(parts: DateOnlyParts, delta: number): DateOnlyParts {
  const index = parts.year * 12 + (parts.month - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const dim = daysInMonth(year, month);
  return { year, month, day: Math.min(parts.day, dim) };
}

/** Monday-first week grid for VN-friendly calendars. Cells null = padding. */
export function buildCalendarCells(year: number, month: number): (DateOnlyParts | null)[] {
  const dim = daysInMonth(year, month);
  const first = new Date(year, month - 1, 1);
  // JS: 0=Sun..6=Sat → Monday-first offset
  const mondayIndex = (first.getDay() + 6) % 7;
  const cells: (DateOnlyParts | null)[] = [];
  for (let i = 0; i < mondayIndex; i += 1) cells.push(null);
  for (let day = 1; day <= dim; day += 1) cells.push({ year, month, day });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function partsEqual(a: DateOnlyParts | null | undefined, b: DateOnlyParts | null | undefined): boolean {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
