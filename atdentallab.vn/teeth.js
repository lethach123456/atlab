/* FDI positions are interpreted only when a range stays in the same dental arch. */
(function (root) {
  'use strict';
  const upper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const lower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const all = new Set([...upper, ...lower]);

  function parsePositions(raw) {
    const original = typeof raw === 'string' ? raw.trim() : '';
    if (!original) return { ids: [], incomplete: false };
    if (/^\d+\s*(?:răng|r|dv|đv)$/iu.test(original)) return { ids: [], incomplete: true };
    if (/^(toàn hàm|nguyên hàm|toàn hảm)$/iu.test(original)) {
      return { ids: [...upper, ...lower].filter(id => id % 10 !== 8).sort((a, b) => a - b), incomplete: false };
    }
    const ids = new Set();
    let incomplete = false;
    // A tooth number consists of two valid FDI digits; leave other text unparsed.
    const pattern = /(?<!\d)([1-4][1-8])(?!\d)(?:\s*(?:->|-|–|—|→)\s*([1-4][1-8])(?!\d))?/gu;
    let match;
    let end = 0;
    while ((match = pattern.exec(original)) !== null) {
      const between = original.slice(end, match.index);
      if (/[^\s,;/]/u.test(between)) incomplete = true;
      const first = Number(match[1]);
      const second = match[2] ? Number(match[2]) : null;
      if (!all.has(first) || (second !== null && !all.has(second))) {
        incomplete = true;
      } else if (second === null) {
        ids.add(first);
      } else {
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
    return { ids: Array.from(ids).sort((a, b) => a - b), incomplete };
  }

  function createToothDiagram(raw) {
    const { ids, incomplete } = parsePositions(raw);
    const selected = new Set(ids);
    const diagram = document.createElement('div');
    diagram.className = 'fdi-diagram';
    diagram.setAttribute('role', 'img');
    diagram.setAttribute('aria-label', ids.length ? `Sơ đồ răng bảo hành: ${ids.join(', ')}` : 'Chưa xác định được vị trí răng trên sơ đồ');
    [upper, lower].forEach((arch, index) => {
      const row = document.createElement('div');
      row.className = 'fdi-row';
      row.setAttribute('aria-hidden', 'true');
      arch.forEach((id, toothIndex) => {
        const cell = document.createElement('span');
        cell.className = `fdi-tooth${selected.has(id) ? ' is-selected' : ''}${toothIndex === 8 ? ' fdi-midline' : ''}`;
        cell.textContent = String(id % 10);
        cell.title = `Răng ${id}`;
        cell.style.setProperty('--tooth-index', String(toothIndex + index * 2));
        row.appendChild(cell);
      });
      diagram.appendChild(row);
    });
    if (incomplete || !ids.length) {
      const note = document.createElement('p');
      note.className = 'fdi-note';
      note.textContent = 'Vị trí chưa xác định đầy đủ trên sơ đồ; vui lòng xem ký hiệu bên trên.';
      diagram.appendChild(note);
    }
    return diagram;
  }

  root.ATTeeth = { parsePositions, createToothDiagram };
})(typeof window !== 'undefined' ? window : globalThis);
