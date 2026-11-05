/**
 * FDI World Dental Federation two-digit notation helper
 */

export interface ToothData {
  id: number;
  code: string;
  quadrant: 1 | 2 | 3 | 4;
  index: number; // 1 to 8
  nameVi: string;
  arch: 'upper' | 'lower';
  side: 'right' | 'left';
}

export const TOOTH_NAMES_VI: Record<number, string> = {
  1: 'Răng cửa giữa',
  2: 'Răng cửa bên',
  3: 'Răng nanh',
  4: 'Răng cối nhỏ 1',
  5: 'Răng cối nhỏ 2',
  6: 'Răng cối lớn 1',
  7: 'Răng cối lớn 2',
  8: 'Răng khôn',
};

// 32 adult teeth list
export const ALL_ADULT_TEETH: ToothData[] = [
  // Quadrant 1: Upper Right (18 -> 11)
  ...[18, 17, 16, 15, 14, 13, 12, 11].map((id) => ({
    id,
    code: id.toString(),
    quadrant: 1 as const,
    index: id % 10,
    nameVi: `Răng ${id} (${TOOTH_NAMES_VI[id % 10]} hàm trên phải)`,
    arch: 'upper' as const,
    side: 'right' as const,
  })),
  // Quadrant 2: Upper Left (21 -> 28)
  ...[21, 22, 23, 24, 25, 26, 27, 28].map((id) => ({
    id,
    code: id.toString(),
    quadrant: 2 as const,
    index: id % 10,
    nameVi: `Răng ${id} (${TOOTH_NAMES_VI[id % 10]} hàm trên trái)`,
    arch: 'upper' as const,
    side: 'left' as const,
  })),
  // Quadrant 4: Lower Right (48 -> 41)
  ...[48, 47, 46, 45, 44, 43, 42, 41].map((id) => ({
    id,
    code: id.toString(),
    quadrant: 4 as const,
    index: id % 10,
    nameVi: `Răng ${id} (${TOOTH_NAMES_VI[id % 10]} hàm dưới phải)`,
    arch: 'lower' as const,
    side: 'right' as const,
  })),
  // Quadrant 3: Lower Left (31 -> 38)
  ...[31, 32, 33, 34, 35, 36, 37, 38].map((id) => ({
    id,
    code: id.toString(),
    quadrant: 3 as const,
    index: id % 10,
    nameVi: `Răng ${id} (${TOOTH_NAMES_VI[id % 10]} hàm dưới trái)`,
    arch: 'lower' as const,
    side: 'left' as const,
  })),
];

export const QUADRANT_1 = [18, 17, 16, 15, 14, 13, 12, 11];
export const QUADRANT_2 = [21, 22, 23, 24, 25, 26, 27, 28];
export const QUADRANT_4 = [48, 47, 46, 45, 44, 43, 42, 41];
export const QUADRANT_3 = [31, 32, 33, 34, 35, 36, 37, 38];

export const UPPER_TEETH = [...QUADRANT_1, ...QUADRANT_2];
export const LOWER_TEETH = [...QUADRANT_4, ...QUADRANT_3];

/**
 * Parses teeth string like "14-24 34-44", "Toàn Hàm", "11-21", "35-36-37", "46", "14 răng"
 * and returns matched tooth IDs and an estimated count.
 */
export function parseTeethNotation(raw: string | undefined): { toothIds: number[]; count: number; isFullArch: boolean } {
  if (!raw || !raw.trim()) {
    return { toothIds: [], count: 0, isFullArch: false };
  }

  const str = raw.trim().toLowerCase();

  // Handle explicit count notations like "28 răng", "14 r", "10r", "3dv", "toàn hàm", "nguyên hàm"
  if (str.includes('toàn hàm') || str.includes('nguyên hàm') || str.includes('toàn hảm')) {
    // Exclude wisdom teeth 18, 28, 38, 48 by default -> 28 teeth
    const full = ALL_ADULT_TEETH.filter((t) => t.index !== 8).map((t) => t.id);
    return { toothIds: full, count: 28, isFullArch: true };
  }

  // Look for regex like "14 răng", "22 răng", "7r", "3 dv"
  const countMatch = str.match(/(\d+)\s*(răng|r|dv|đv)/);
  let explicitCount = countMatch ? parseInt(countMatch[1], 10) : 0;

  const toothSet = new Set<number>();

  // Normalize delimiters: replace newlines, slashes, arrows, semicolons with space
  const cleanStr = raw
    .replace(/\n/g, ' ')
    .replace(/->/g, '-')
    .replace(/[;,]/g, ' ')
    .replace(/\s+/g, ' ');

  // Split by whitespace
  const tokens = cleanStr.split(' ');

  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;

    // Check range like "14-24" or "17-26" or "35-45"
    if (t.includes('-')) {
      const parts = t.split('-').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
      if (parts.length >= 2) {
        // Can be range like 14-24 or multi-tooth list like 35-36-37
        if (parts.length === 2) {
          const [start, end] = parts;
          const qStart = Math.floor(start / 10);
          const iStart = start % 10;
          const qEnd = Math.floor(end / 10);
          const iEnd = end % 10;

          // Cross-quadrant upper: e.g. 14-24 (14, 13, 12, 11, 21, 22, 23, 24)
          if (qStart === 1 && qEnd === 2) {
            for (let i = iStart; i >= 1; i--) toothSet.add(10 + i);
            for (let i = 1; i <= iEnd; i++) toothSet.add(20 + i);
          }
          // Cross-quadrant lower: e.g. 44-34 (44, 43, 42, 41, 31, 32, 33, 34)
          else if (qStart === 4 && qEnd === 3) {
            for (let i = iStart; i >= 1; i--) toothSet.add(40 + i);
            for (let i = 1; i <= iEnd; i++) toothSet.add(30 + i);
          }
          // Cross-quadrant lower inverted order: e.g. 34-44 (34, 33, 32, 31, 41, 42, 43, 44)
          else if (qStart === 3 && qEnd === 4) {
            for (let i = iStart; i >= 1; i--) toothSet.add(30 + i);
            for (let i = 1; i <= iEnd; i++) toothSet.add(40 + i);
          }
          // Same quadrant range: e.g. 11-16 or 16-11
          else if (qStart === qEnd && qStart >= 1 && qStart <= 4) {
            const minI = Math.min(iStart, iEnd);
            const maxI = Math.max(iStart, iEnd);
            for (let i = minI; i <= maxI; i++) {
              toothSet.add(qStart * 10 + i);
            }
          } else {
            // General range
            toothSet.add(start);
            toothSet.add(end);
          }
        } else {
          // Multi-tooth connected like 12-11-21-22 or 35-36-37
          for (const p of parts) {
            if (p >= 11 && p <= 48) toothSet.add(p);
          }
        }
      }
    } else {
      // Single tooth number like "46", "11", "24"
      const num = parseInt(t, 10);
      if (!isNaN(num) && num >= 11 && num <= 48) {
        toothSet.add(num);
      }
    }
  }

  const ids = Array.from(toothSet).sort((a, b) => a - b);
  const calculatedCount = ids.length > 0 ? ids.length : explicitCount > 0 ? explicitCount : 1;

  return {
    toothIds: ids,
    count: explicitCount > 0 ? explicitCount : calculatedCount,
    isFullArch: ids.length >= 24,
  };
}

/**
 * Format an array of tooth IDs back into a concise readable dental string
 */
export function formatTeethList(toothIds: number[]): string {
  if (!toothIds || toothIds.length === 0) return 'Chưa chỉ định';
  if (toothIds.length >= 24) return 'Toàn hàm';

  const sorted = [...new Set(toothIds)].sort((a, b) => a - b);
  const groups: string[] = [];
  let start = sorted[0];
  let end = start;

  for (const id of sorted.slice(1)) {
    if (Math.floor(id / 10) === Math.floor(end / 10) && id === end + 1) {
      end = id;
      continue;
    }
    groups.push(start === end ? String(start) : `${start}-${end}`);
    start = end = id;
  }
  groups.push(start === end ? String(start) : `${start}-${end}`);
  return groups.join(', ');
}
