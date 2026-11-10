import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createdAtMillis,
  deliveryAddedMillis,
  deliveryIdCreatedAtMillis,
  sortDeliveriesByRecentlyAdded,
} from './deliveryRecency';

const NEW_MS = Date.UTC(2026, 10, 11, 8); // 11/11/2026 08:00 UTC — after typical deliveryDate fixtures
const OLD_MS = Date.UTC(2026, 0, 15, 8);

test('createdAtMillis accepts number, Timestamp shapes, ISO, and numeric string', () => {
  assert.equal(createdAtMillis(NEW_MS), NEW_MS);
  assert.equal(createdAtMillis({ toMillis: () => NEW_MS }), NEW_MS);
  assert.equal(createdAtMillis({ seconds: NEW_MS / 1000, nanoseconds: 0 }), NEW_MS);
  assert.equal(createdAtMillis({ _seconds: OLD_MS / 1000, _nanoseconds: 0 }), OLD_MS);
  assert.equal(createdAtMillis('2026-11-10T07:00:00.000Z'), Date.parse('2026-11-10T07:00:00.000Z'));
  assert.equal(createdAtMillis(String(NEW_MS)), NEW_MS);
});

test('createdAtMillis rejects missing or invalid values', () => {
  assert.equal(createdAtMillis(undefined), null);
  assert.equal(createdAtMillis(null), null);
  assert.equal(createdAtMillis(''), null);
  assert.equal(createdAtMillis(0), null);
  assert.equal(createdAtMillis(Number.NaN), null);
  assert.equal(createdAtMillis('not-a-date'), null);
  assert.equal(createdAtMillis({}), null);
});

test('deliveryIdCreatedAtMillis only accepts reliably encoded deliv_<13-digit-ms>', () => {
  assert.equal(deliveryIdCreatedAtMillis(`deliv_${NEW_MS}`), NEW_MS);
  assert.equal(deliveryIdCreatedAtMillis(`deliv_${NEW_MS}_ab`), NEW_MS);
  assert.equal(deliveryIdCreatedAtMillis('deliv_123'), null);
  assert.equal(deliveryIdCreatedAtMillis('deliv_abc'), null);
  assert.equal(deliveryIdCreatedAtMillis('not_a_deliv_1731234567890'), null);
  assert.equal(deliveryIdCreatedAtMillis(undefined), null);
});

test('sort is driven by createdAt, not deliveryDate', () => {
  const olderAdded = { id: 'a', createdAt: OLD_MS, deliveryDate: '10/11/2026' };
  const newerAdded = { id: 'b', createdAt: NEW_MS, deliveryDate: '01/01/2020' };
  assert.deepEqual(
    sortDeliveriesByRecentlyAdded([olderAdded, newerAdded]).map((row) => row.id),
    ['b', 'a'],
  );
});

test('legacy rows fall back to id time, then deliveryDate, then stable original order', () => {
  const byId = { id: `deliv_${NEW_MS}`, deliveryDate: '01/01/2020' };
  const byDate = { id: 'legacy-uuid', deliveryDate: '09/11/2026' };
  const unrankedEarly = { id: 'first-unranked' };
  const unrankedLate = { id: 'second-unranked' };
  const sorted = sortDeliveriesByRecentlyAdded([unrankedEarly, byDate, byId, unrankedLate]);
  assert.deepEqual(sorted.map((row) => row.id), [
    `deliv_${NEW_MS}`,
    'legacy-uuid',
    'first-unranked',
    'second-unranked',
  ]);
  assert.equal(deliveryAddedMillis(byId), NEW_MS);
  assert.equal(deliveryAddedMillis(byDate), new Date(2026, 10, 9).getTime());
  assert.equal(deliveryAddedMillis(unrankedEarly), null);
});

test('equal recency ties keep original relative order', () => {
  const first = { id: 'first', createdAt: NEW_MS };
  const second = { id: 'second', createdAt: NEW_MS };
  assert.deepEqual(
    sortDeliveriesByRecentlyAdded([first, second]).map((row) => row.id),
    ['first', 'second'],
  );
});

test('mixed timestamp shapes sort newest first; deliveryDate is local date-only', () => {
  const iso = { id: 'iso', createdAt: '2026-11-10T01:00:00.000Z' };
  const stamp = { id: 'stamp', createdAt: { toMillis: () => NEW_MS } };
  const localDay = { id: 'day', deliveryDate: '31/02/2026' }; // invalid, unranked
  const validDay = { id: 'valid-day', deliveryDate: '08/11/2026' };
  const sorted = sortDeliveriesByRecentlyAdded([validDay, localDay, iso, stamp]);
  assert.deepEqual(sorted.map((row) => row.id), ['stamp', 'iso', 'valid-day', 'day']);
  // 08/11/2026 local must not shift to 07/11 via UTC ISO.
  assert.equal(deliveryAddedMillis(validDay), new Date(2026, 10, 8).getTime());
});

test('newly added optimistic row with Date.now createdAt or deliv_ id lands first', () => {
  const now = Date.now();
  const existing = { id: `deliv_${OLD_MS}`, createdAt: OLD_MS, deliveryDate: '01/10/2026' };
  const optimistic = { id: `deliv_${now}`, createdAt: now, deliveryDate: '01/01/2020' };
  assert.equal(sortDeliveriesByRecentlyAdded([existing, optimistic])[0].id, optimistic.id);
  const pendingWithoutCreatedAt = { id: `deliv_${now}`, deliveryDate: '01/01/2020' };
  assert.equal(sortDeliveriesByRecentlyAdded([existing, pendingWithoutCreatedAt])[0].id, pendingWithoutCreatedAt.id);
});
