import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessLegacyUndoAvailability,
  applyUpdateUndoMerge,
  buildRollbackPlan,
  buildUpdateUndoPatch,
  findUpdateConflicts,
  redactedFieldsChanged,
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

test('settings update with unchanged bank: canUndo and merge preserves bank number', () => {
  const before = { labName: 'AT', bankAccountNumber: '123456', hotline: '090' };
  const after = { labName: 'AT Lab', bankAccountNumber: '123456', hotline: '090' };
  const plan = buildRollbackPlan('update', 'settings', before, after);
  assert.equal(plan.canUndo, true);
  assert.deepEqual(plan.beforeSnapshot, { labName: 'AT', hotline: '090' });
  assert.deepEqual(plan.afterSnapshot, { labName: 'AT Lab', hotline: '090' });
  assert.equal('bankAccountNumber' in (plan.beforeSnapshot || {}), false);
  const current = { ...after };
  const restored = applyUpdateUndoMerge(current, plan.beforeSnapshot!, plan.afterSnapshot!);
  assert.equal(restored.labName, 'AT');
  assert.equal(restored.bankAccountNumber, '123456');
  assert.equal(restored.hotline, '090');
});

test('settings update that also changes bank is not undoable', () => {
  const plan = buildRollbackPlan(
    'update',
    'settings',
    { labName: 'AT', bankAccountNumber: '111' },
    { labName: 'AT Lab', bankAccountNumber: '222' }
  );
  assert.equal(plan.canUndo, false);
  assert.match(plan.undoBlockReason, /bảo mật|nhạy cảm/i);
  assert.equal(redactedFieldsChanged(
    { bankAccountNumber: '111' },
    { bankAccountNumber: '222' }
  ), true);
});

test('settings deletion with bank secret must not be undoable (no incomplete recreate)', () => {
  const plan = buildRollbackPlan(
    'delete',
    'settings',
    { labName: 'AT', bankAccountNumber: '123456', hotline: '090' },
    null
  );
  assert.equal(plan.canUndo, false);
  assert.match(plan.undoBlockReason, /bảo mật|tạo hoặc xóa|nhạy cảm/i);
  assert.equal(plan.beforeSnapshot, null);
});

test('create with redacted fields refuses unsafe delete-undo', () => {
  const plan = buildRollbackPlan(
    'create',
    'settings',
    null,
    { labName: 'AT', bankAccountNumber: '123456', hotline: '090' }
  );
  assert.equal(plan.canUndo, false);
  assert.match(plan.undoBlockReason, /bảo mật|tạo hoặc xóa|nhạy cảm/i);
  assert.equal(plan.afterSnapshot, null);
});

test('all-redacted update is not a successful noop undo', () => {
  const plan = buildRollbackPlan(
    'update',
    'settings',
    { labName: 'AT', bankAccountNumber: '111' },
    { labName: 'AT', bankAccountNumber: '222' }
  );
  assert.equal(plan.canUndo, false);
  assert.match(plan.undoBlockReason, /bảo mật|an toàn|nhạy cảm|trường an toàn/i);
});

test('create without secrets remains undoable', () => {
  const plan = buildRollbackPlan('create', 'cashflows', null, { title: 'Chi', amount: 1 });
  assert.equal(plan.canUndo, true);
  assert.deepEqual(plan.afterSnapshot, { title: 'Chi', amount: 1 });
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
