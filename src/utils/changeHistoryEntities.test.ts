import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRollbackPlan, applyUpdateUndoMerge, isPartialSecretPreservingUpdate } from './changeUndo.ts';
import { buildFieldChanges, buildInspectFieldChanges, HISTORY_CHANGES_RULES_MAX } from './changeDiff.ts';

const entities: { type: string; sample: Record<string, unknown> }[] = [
  { type: 'orders', sample: { patientName: 'A', material: 'Z', totalAmount: 1, teeth: '11' } },
  { type: 'cashflows', sample: { title: 'Chi', amount: 10, type: 'expense', category: 'vat-tu' } },
  { type: 'deliveries', sample: { patientName: 'A', clinicName: 'C', status: 'pending' } },
  { type: 'materialPrices', sample: { name: 'Full Z', unitPrice: 1, materialKey: 'full z' } },
  { type: 'clinicMaterialPrices', sample: { name: 'Full Z', unitPrice: 2, clinicName: 'C', clinicKey: 'c' } },
  { type: 'clinicDebts', sample: { clinicName: 'C', amount: 100, monthYear: '11/2026' } },
  { type: 'clinicPartners', sample: { name: 'C', address: 'A', phone: '0' } },
  { type: 'employeePayrolls', sample: { employeeName: 'E', monthYear: '11/2026', netSalary: 1 } },
  { type: 'saleCommissions', sample: { clinicName: 'C', saleId: 's1', ratePercent: 5 } },
  { type: 'profitMonthlyCosts', sample: { monthYear: '11/2026', kind: 'rent', amount: 1 } },
];

for (const { type, sample } of entities) {
  test(`entity ${type}: create/update/delete undo plans for flat records`, () => {
    const created = buildRollbackPlan('create', type, null, sample);
    assert.equal(created.canUndo, true, type + ' create');
    const updated = buildRollbackPlan('update', type, sample, { ...sample, notes: 'x' });
    // notes may be new field
    assert.equal(updated.canUndo, true, type + ' update');
    const deleted = buildRollbackPlan('delete', type, sample, null);
    assert.equal(deleted.canUndo, true, type + ' delete');
  });
}

test('users entity never undoable across actions', () => {
  for (const action of ['create', 'update', 'delete'] as const) {
    const plan = buildRollbackPlan(action, 'users', { role: 'sale' }, { role: 'admin' });
    assert.equal(plan.canUndo, false);
  }
});

test('partial restore note only for settings or redacted markers', () => {
  assert.equal(
    isPartialSecretPreservingUpdate({ action: 'update', canUndo: true, entityType: 'orders' }),
    false
  );
  assert.equal(
    isPartialSecretPreservingUpdate({ action: 'update', canUndo: true, entityType: 'settings' }),
    true
  );
  assert.equal(
    isPartialSecretPreservingUpdate({
      action: 'update',
      canUndo: true,
      entityType: 'orders',
      changes: [{ before: '•••', after: '•••' }],
    }),
    true
  );
});

test('order duplicate-sized create still caps display diffs but inspect is full', () => {
  const after: Record<string, unknown> = {};
  for (let i = 0; i < 20; i++) after[`f${i}`] = i;
  const capped = buildFieldChanges(null, after, 'create');
  const full = buildInspectFieldChanges(null, after, 'create');
  assert.equal(capped.length, HISTORY_CHANGES_RULES_MAX);
  assert.equal(full.length, 20);
});

test('settings update merge leaves omitted unrelated current fields', () => {
  const before = { labName: 'A', hotline: '1', bankAccountNumber: '9' };
  const after = { labName: 'B', hotline: '1', bankAccountNumber: '9' };
  const plan = buildRollbackPlan('update', 'settings', before, after);
  assert.equal(plan.canUndo, true);
  const current = { ...after, directorName: 'Director', extra: 1 };
  const restored = applyUpdateUndoMerge(current, plan.beforeSnapshot!, plan.afterSnapshot!);
  assert.equal(restored.labName, 'A');
  assert.equal(restored.bankAccountNumber, '9');
  assert.equal(restored.directorName, 'Director');
  assert.equal(restored.extra, 1);
});
