import assert from 'node:assert/strict';
import '../assets/teeth.js';
const { parsePositions, renderQuadrants } = globalThis.UNCToothPositions;
const merged = '14-24, 34-44, 15-17, 25-27, 45';
const expected = {
  1: '11, 12, 13, 14, 15, 16, 17',
  2: '21, 22, 23, 24, 25, 26, 27',
  4: '41, 42, 43, 44, 45',
  3: '31, 32, 33, 34',
};
const fields = [1, 2, 4, 3].map((q) => ({
  dataset: { quadrant: String(q) },
  textContent: '',
  setAttribute() {},
}));
const note = { textContent: '', hidden: true };
const container = { querySelectorAll: () => fields, querySelector: () => note };
const parsed = renderQuadrants(container, merged);
assert.equal(parsed.ids.length, 23);
for (const field of fields) assert.equal(field.textContent, expected[field.dataset.quadrant]);
assert.equal(note.hidden, true);
renderQuadrants(container, '21-23, 22');
assert.equal(fields[0].textContent, '');
assert.equal(fields[1].textContent, '21, 22, 23');
assert.equal(fields[2].textContent, '');
assert.equal(fields[3].textContent, '');
renderQuadrants(container, '14-44');
assert.equal(note.hidden, false);
assert.equal(note.textContent, 'Vị trí gốc: 14-44');
assert.deepEqual(parsePositions('35- 37, 34').ids, [34, 35, 36, 37]);
assert.equal(parsePositions('1 răng').incomplete, true);
renderQuadrants(container, '');
assert.ok(fields.every(field => field.textContent === ''));
assert.equal(note.hidden, false);
console.log('Merged positions, all four quadrant fields, deduplication and clearing: passed.');
