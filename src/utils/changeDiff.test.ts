import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HISTORY_CHANGES_RULES_MAX,
  HISTORY_MORE_FIELD,
  buildEntityLabel,
  buildFieldChanges,
  buildInspectFieldChanges,
  sanitizeHistoryRecord,
  stringifyHistoryValue,
} from './changeDiff.ts';

test('stringifyHistoryValue truncates long strings', () => {
  const long = 'x'.repeat(400);
  const out = stringifyHistoryValue(long);
  assert.equal(out?.endsWith('…'), true);
  assert.ok((out?.length || 0) <= 301);
});

test('sanitizeHistoryRecord redacts secrets and drops metadata', () => {
  const cleaned = sanitizeHistoryRecord({
    id: '1',
    ownerId: 'owner',
    createdAt: 1,
    title: 'Phiếu chi',
    password: 'super-secret',
    bankAccountNumber: '123456789',
  });
  assert.deepEqual(cleaned, {
    title: 'Phiếu chi',
    password: '•••',
    bankAccountNumber: '•••',
  });
});

test('buildFieldChanges create lists after values only', () => {
  const changes = buildFieldChanges(null, { title: 'A', amount: 1000 }, 'create');
  assert.deepEqual(changes, [
    { field: 'amount', before: null, after: '1000' },
    { field: 'title', before: null, after: 'A' },
  ]);
});

test('buildFieldChanges update diffs only changed fields', () => {
  const changes = buildFieldChanges(
    { title: 'A', amount: 1000, notes: 'x' },
    { title: 'B', amount: 1000, notes: 'x' },
    'update'
  );
  assert.deepEqual(changes, [{ field: 'title', before: 'A', after: 'B' }]);
});

test('buildFieldChanges delete lists before values', () => {
  const changes = buildFieldChanges({ title: 'Gone', amount: 2 }, null, 'delete');
  assert.equal(changes.some((c) => c.field === 'title' && c.before === 'Gone' && c.after === null), true);
});

test('buildEntityLabel prefers human fields', () => {
  assert.equal(
    buildEntityLabel('orders', { patientName: 'An', warrantyCode: 'NS1' }, 'id1'),
    'An · NS1'
  );
  assert.equal(buildEntityLabel('cashflows', { title: 'Mua phôi' }, 'x'), 'Mua phôi');
});

test('buildFieldChanges caps at HISTORY_CHANGES_RULES_MAX with _more sentinel', () => {
  const after: Record<string, unknown> = {};
  for (let i = 0; i < 18; i += 1) after[`f${String(i).padStart(2, '0')}`] = `v${i}`;
  const changes = buildFieldChanges(null, after, 'create');
  assert.equal(changes.length, HISTORY_CHANGES_RULES_MAX);
  assert.equal(changes[changes.length - 1]?.field, HISTORY_MORE_FIELD);
  assert.match(String(changes[changes.length - 1]?.after), /^\+\d+ trường khác$/);
  const omitted = Number(String(changes[changes.length - 1]?.after).match(/\+(\d+)/)?.[1]);
  assert.equal(omitted, 18 - (HISTORY_CHANGES_RULES_MAX - 1));
  assert.equal(
    changes.filter((c) => c.field !== HISTORY_MORE_FIELD).length,
    HISTORY_CHANGES_RULES_MAX - 1
  );
});

test('buildFieldChanges does not add sentinel when within cap', () => {
  const changes = buildFieldChanges(null, { a: 1, b: 2, c: 3 }, 'create');
  assert.equal(changes.some((c) => c.field === HISTORY_MORE_FIELD), false);
  assert.ok(changes.length <= HISTORY_CHANGES_RULES_MAX);
});

test('buildInspectFieldChanges is uncapped for UI snapshot inspection', () => {
  const after: Record<string, unknown> = {};
  for (let i = 0; i < 18; i += 1) after[`f${String(i).padStart(2, '0')}`] = `v${i}`;
  const capped = buildFieldChanges(null, after, 'create');
  const full = buildInspectFieldChanges(null, after, 'create');
  assert.equal(capped.length, HISTORY_CHANGES_RULES_MAX);
  assert.equal(capped.some((c) => c.field === HISTORY_MORE_FIELD), true);
  assert.equal(full.length, 18);
  assert.equal(full.some((c) => c.field === HISTORY_MORE_FIELD), false);
});
