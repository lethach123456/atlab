/**
 * Max entity writes per batch/transaction when each pairs with one history doc.
 * Firestore limit is 500 ops; 200×2=400 leaves headroom.
 */
export const CHANGE_HISTORY_PAIRED_CHUNK = 200;

/** Split entity ops so entity+history pairs stay under Firestore's 500-write limit. */
export function chunkForPairedHistoryWrites<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let offset = 0; offset < items.length; offset += CHANGE_HISTORY_PAIRED_CHUNK) {
    out.push(items.slice(offset, offset + CHANGE_HISTORY_PAIRED_CHUNK) as T[]);
  }
  return out;
}
