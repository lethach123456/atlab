import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEntityLabel,
  buildFieldChanges,
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
