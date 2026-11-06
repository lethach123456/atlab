/* Parse adult FDI positions without guessing ambiguous or cross-arch ranges. */
(function (root) {
  'use strict';
  const upper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const lower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  function parsePositions(raw) {
    const original = typeof raw === 'string' ? raw.trim() : '';
    if (!original) return { ids: [], incomplete: false, original };
    if (/^\d+\s*(?:răng|r|dv|đv)$/iu.test(original)) return { ids: [], incomplete: true, original };
    if (/^(toàn hàm|nguyên hàm|toàn hảm)$/iu.test(original)) {
      return { ids: [...upper, ...lower].filter(id => id % 10 !== 8).sort((a, b) => a - b), incomplete: false, original };
    }
    const ids = new Set();
    let incomplete = false, end = 0, match;
    const pattern = /(?<!\d)([1-4][1-8])(?!\d)(?:\s*(?:->|-|–|—|→)\s*([1-4][1-8])(?!\d))?/gu;
    while ((match = pattern.exec(original)) !== null) {
      if (/[^\s,;/]/u.test(original.slice(end, match.index))) incomplete = true;
      const first = Number(match[1]), second = match[2] ? Number(match[2]) : null;
      if (second === null) ids.add(first);
      else {
        const arch = upper.includes(first) && upper.includes(second) ? upper : lower.includes(first) && lower.includes(second) ? lower : null;
        if (!arch) incomplete = true;
        else {
          const a = arch.indexOf(first), b = arch.indexOf(second);
          arch.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(id => ids.add(id));
        }
      }
      end = pattern.lastIndex;
    }
    if (/[^\s,;/]/u.test(original.slice(end))) incomplete = true;
    return { ids: [...ids].sort((a, b) => a - b), incomplete, original };
  }

  function renderQuadrants(container, raw) {
    const parsed = parsePositions(raw);
    container.querySelectorAll('[data-quadrant]').forEach((field) => {
      const quadrant = Number(field.dataset.quadrant);
      const ids = parsed.ids.filter((id) => Math.floor(id / 10) === quadrant);
      field.textContent = ids.join(', ');
      field.setAttribute('aria-label', `Phần hàm ${quadrant}: ${ids.length ? ids.join(', ') : 'không có răng được chỉ định'}`);
    });
    const note = container.querySelector('.quadrant-note');
    if (note) {
      note.textContent = parsed.incomplete ? `Vị trí gốc: ${parsed.original}` : !parsed.original ? 'Chưa cập nhật vị trí răng' : '';
      note.hidden = !note.textContent;
    }
    return parsed;
  }

  root.UNCToothPositions = { parsePositions, renderQuadrants };
})(typeof window !== 'undefined' ? window : globalThis);
