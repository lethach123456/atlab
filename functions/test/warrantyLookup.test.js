import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWarrantyResult } from '../warrantyLookup.js';
const base = { ownerId: 'lab', patientName: 'Nguyễn A', clinicName: 'Tâm An', material: 'Sứ', warrantyPeriod: '15 năm', orderDate: '01/11/2026' };
test('Combines and deduplicates positions for matching records', () => {
  const result = buildWarrantyResult('UC123', [{...base, teeth: '14-24, 34-44'}, {...base, teeth: '44, 14-24'}]);
  assert.equal(result.teeth, '14-24, 34-44, 44');
  assert.equal(result.restorations.length, 2);
  assert.equal(result.patientName, 'Nguyễn A');
  assert.equal(result.clinicName, 'Tâm An');
});
test('Rejects different patients or workspaces sharing a code', () => {
  assert.equal(buildWarrantyResult('UC123', [base, {...base, patientName:'Nguyễn B'}]), null);
  assert.equal(buildWarrantyResult('UC123', [base, {...base, ownerId:'other'}]), null);
});
test('Preserves nonstandard tooth descriptions and empty positions', () => {
  const result = buildWarrantyResult('UC123', [{...base, teeth:'1 răng'}, {...base, teeth:''}]);
  assert.equal(result.teeth, '1 răng');
});
