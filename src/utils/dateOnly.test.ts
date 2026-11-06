import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMonths,
  buildCalendarCells,
  daysInMonth,
  formatDdMmYyyy,
  formatMonthYear,
  isValidDdMmYyyy,
  normalizeDdMmYyyy,
  parseDdMmYyyy,
  partsFromLocalDate,
  todayDdMmYyyy,
} from './dateOnly.ts';

test('parseDdMmYyyy accepts valid and rejects impossible days', () => {
  assert.deepEqual(parseDdMmYyyy('7/11/2026'), { year: 2026, month: 11, day: 7 });
  assert.deepEqual(parseDdMmYyyy('29/02/2024'), { year: 2024, month: 2, day: 29 });
  assert.equal(parseDdMmYyyy('29/02/2025'), null);
  assert.equal(parseDdMmYyyy('31/04/2026'), null);
  assert.equal(parseDdMmYyyy('00/01/2026'), null);
  assert.equal(parseDdMmYyyy('32/01/2026'), null);
  assert.equal(parseDdMmYyyy(''), null);
  assert.equal(parseDdMmYyyy('2026-11-07'), null);
  assert.equal(parseDdMmYyyy('abc'), null);
});

test('normalizeDdMmYyyy zero-pads and roundtrips', () => {
  assert.equal(normalizeDdMmYyyy('7/3/2026'), '07/03/2026');
  assert.equal(isValidDdMmYyyy('07/03/2026'), true);
  assert.equal(normalizeDdMmYyyy('31/02/2026'), null);
});

test('format helpers and month year', () => {
  assert.equal(formatDdMmYyyy({ year: 2026, month: 1, day: 5 }), '05/01/2026');
  assert.equal(formatMonthYear({ year: 2026, month: 11 }), '11/2026');
});

test('todayDdMmYyyy uses local wall clock not UTC shift', () => {
  const fixed = new Date(2026, 10, 7, 0, 30, 0); // local 07/11/2026 00:30
  assert.equal(todayDdMmYyyy(fixed), '07/11/2026');
  const nearMidnight = new Date(2026, 10, 7, 23, 59, 0);
  assert.equal(todayDdMmYyyy(nearMidnight), '07/11/2026');
  assert.deepEqual(partsFromLocalDate(fixed), { year: 2026, month: 11, day: 7 });
});

test('leap year and month length', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2025, 2), 28);
  assert.equal(daysInMonth(2026, 11), 30);
  assert.equal(daysInMonth(2026, 12), 31);
});

test('addMonths rolls year and clamps day', () => {
  assert.deepEqual(addMonths({ year: 2026, month: 1, day: 31 }, 1), { year: 2026, month: 2, day: 28 });
  assert.deepEqual(addMonths({ year: 2025, month: 12, day: 15 }, 1), { year: 2026, month: 1, day: 15 });
  assert.deepEqual(addMonths({ year: 2026, month: 3, day: 31 }, -1), { year: 2026, month: 2, day: 28 });
});

test('calendar grid monday-first includes valid days only', () => {
  const cells = buildCalendarCells(2026, 11);
  assert.equal(cells.length % 7, 0);
  const days = cells.filter(Boolean);
  assert.equal(days.length, 30);
  assert.deepEqual(days[0], { year: 2026, month: 11, day: 1 });
  assert.deepEqual(days[29], { year: 2026, month: 11, day: 30 });
});

test('empty and invalid manual entry stay invalid without throwing', () => {
  assert.equal(parseDdMmYyyy('  '), null);
  assert.equal(parseDdMmYyyy('99/99/9999'), null);
  assert.equal(normalizeDdMmYyyy(undefined), null);
});
