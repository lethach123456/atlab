import { parseDdMmYyyy } from './dateOnly';

/** Timestamp-like values used on delivery records (Firestore Timestamp, millis, ISO). */
export type TimestampLike =
  | number
  | string
  | { toMillis: () => number }
  | { seconds: number; nanoseconds?: number }
  | { _seconds: number; _nanoseconds?: number }
  | null
  | undefined;

export interface DeliveryRecencyInput {
  id?: string;
  createdAt?: TimestampLike;
  deliveryDate?: string;
}

const MS_DIGIT_RE = /^\d{13}$/;
const DELIV_ID_MS_RE = /^deliv_(\d{13})(?:_|$)/;
/** 13-digit millis from 2001-09 through 2286 — matches Date.now() ids like deliv_1731234567890. */
const MIN_RELIABLE_MS = 1_000_000_000_000;
const MAX_RELIABLE_MS = 9_999_999_999_999;

function finiteMillis(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function secondsAndNanos(seconds: number, nanos = 0): number | null {
  if (!Number.isFinite(seconds)) return null;
  const ms = seconds * 1000 + Math.floor((Number.isFinite(nanos) ? nanos : 0) / 1e6);
  return finiteMillis(ms);
}

/** Normalize createdAt to epoch millis. Returns null when missing or unreadable. */
export function createdAtMillis(value: TimestampLike | unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return finiteMillis(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return finiteMillis(Number(trimmed));
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? finiteMillis(parsed) : null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.toMillis === 'function') {
      try {
        return finiteMillis((record.toMillis as () => number)());
      } catch {
        return null;
      }
    }
    if (typeof record.seconds === 'number') {
      return secondsAndNanos(record.seconds, typeof record.nanoseconds === 'number' ? record.nanoseconds : 0);
    }
    if (typeof record._seconds === 'number') {
      return secondsAndNanos(record._seconds, typeof record._nanoseconds === 'number' ? record._nanoseconds : 0);
    }
  }
  return null;
}

/** Millis from ids like `deliv_1731234567890` or `deliv_1731234567890_ab` — only 13-digit Date.now() encodings. */
export function deliveryIdCreatedAtMillis(id: string | undefined): number | null {
  if (!id) return null;
  const match = DELIV_ID_MS_RE.exec(id);
  if (!match || !MS_DIGIT_RE.test(match[1])) return null;
  const ms = Number(match[1]);
  if (ms < MIN_RELIABLE_MS || ms > MAX_RELIABLE_MS) return null;
  return ms;
}

/** Local start-of-day millis from DD/MM/YYYY — no UTC date shift. */
export function deliveryDateMillis(deliveryDate: string | undefined): number | null {
  const parts = parseDdMmYyyy(deliveryDate);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day).getTime();
}

/**
 * Recency for "most recently added first":
 * 1) createdAt (any supported timestamp shape)
 * 2) reliably encoded `deliv_<13-digit-ms>` id
 * 3) deliveryDate (local calendar day)
 * 4) otherwise unranked (caller keeps original order)
 */
export function deliveryAddedMillis(record: DeliveryRecencyInput): number | null {
  return createdAtMillis(record.createdAt)
    ?? deliveryIdCreatedAtMillis(record.id)
    ?? deliveryDateMillis(record.deliveryDate);
}

/** Newest added first. Ties and unranked rows keep their original relative order. */
export function sortDeliveriesByRecentlyAdded<T extends DeliveryRecencyInput>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index, recency: deliveryAddedMillis(item) }))
    .sort((a, b) => {
      if (a.recency != null && b.recency != null && a.recency !== b.recency) {
        return b.recency - a.recency;
      }
      if (a.recency != null && b.recency == null) return -1;
      if (a.recency == null && b.recency != null) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
