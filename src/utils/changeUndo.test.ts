import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessLegacyUndoAvailability,
  buildRollbackPlan,
  buildUpdateUndoPatch,
  findUpdateConflicts,
  undoHistoryDocId,
  valuesEqualForUndo,
} from './changeUndo';

test('update rollback plan stores snapshots when lossless', () => {
  const plan = buildRollbackPlan(
    'update',
    'orders',
    { patientName: 'A', totalAmount: 1000 },
    { patientName: 'B', totalAmount: 1000 }
  );
  assert.equal(plan.canUndo, true);
  assert.deepEqual(plan.beforeSnapshot, { patientName: 'A', totalAmount: 1000 });
  assert.deepEqual(plan.afterSnapshot, { patientName: 'B', totalAmount: 1000 });
});

test('users entity is never undoable', () => {
  const plan = buildRollbackPlan('update', 'users', { role: 'sale' }, { role: 'admin' });
  assert.equal(plan.canUndo, false);
  assert.match(plan.undoBlockReason, /tài khoản|quyền|bảo mật/i);
});

test('secret fields block snapshot rather than store placeholders', () => {
  const plan = buildRollbackPlan(
    'update',
    'settings',
    { labName: 'AT', bankAccountNumber: '123' },
    { labName: 'AT Lab', bankAccountNumber: '123' }
  );
  assert.equal(plan.canUndo, false);
  assert.match(plan.undoBlockReason, /bảo mật|nhạy cảm/i);
});

test('conflict detection when current diverged from after snapshot', () => {
  const conflicts = findUpdateConflicts(
    { patientName: 'C', totalAmount: 1000 },
    { patientName: 'A', totalAmount: 1000 },
    { patientName: 'B', totalAmount: 1000 }
  );
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].field, 'patientName');
  assert.equal(conflicts[0].expected, 'B');
  assert.equal(conflicts[0].actual, 'C');
});

test('no conflict when current still matches after snapshot', () => {
  const conflicts = findUpdateConflicts(
    { patientName: 'B', totalAmount: 1000, notes: 'x' },
    { patientName: 'A', totalAmount: 1000 },
    { patientName: 'B', totalAmount: 1000 }
  );
  assert.equal(conflicts.length, 0);
});

test('update patch only touches changed fields', () => {
  const patch = buildUpdateUndoPatch(
    { patientName: 'A', totalAmount: 1000, notes: 'same' },
    { patientName: 'B', totalAmount: 1000, notes: 'same' }
  );
  assert.deepEqual(patch, { patientName: 'A' });
});

test('legacy entries without snapshots are not undoable', () => {
  const assessed = assessLegacyUndoAvailability({
    action: 'update',
    entityType: 'orders',
  });
  assert.equal(assessed.canUndo, false);
  assert.match(assessed.reason, /cũ|snapshot|diff/i);
});

test('repeated undo marker id is stable', () => {
  assert.equal(undoHistoryDocId('ch_abc'), 'undo_ch_abc');
});

test('create/delete require full state', () => {
  assert.equal(buildRollbackPlan('create', 'cashflows', null, null).canUndo, false);
  assert.equal(
    buildRollbackPlan('create', 'cashflows', null, { title: 'Chi', amount: 1 }).canUndo,
    true
  );
  assert.equal(buildRollbackPlan('delete', 'cashflows', null, null).canUndo, false);
  assert.equal(
    buildRollbackPlan('delete', 'cashflows', { title: 'Chi', amount: 1 }, null).canUndo,
    true
  );
});

test('array equality helper', () => {
  assert.equal(valuesEqualForUndo(['a', 'b'], ['a', 'b']), true);
  assert.equal(valuesEqualForUndo(['a'], ['b']), false);
});
