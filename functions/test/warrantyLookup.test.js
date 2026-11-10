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

test('đắp mài restorations expose the plain family name, never the sheet label', () => {
  const result = buildWarrantyResult('UC123', [
    {...base, material: 'Zirconia', teeth: '11'},
    {...base, material: 'Cercon HT', teeth: '21'},
  ]);
  const names = result.restorations.map(row => row.material);
  assert.ok(names.includes('Zirconia'));
  assert.ok(names.includes('Cercon HT'));
  for (const name of names) {
    assert.equal(/đắp\s*mài/i.test(name), false);
  }
  const prefixed = buildWarrantyResult('UC123', [{...base, material: 'Đắp mài Zirconia', teeth: '11'}]);
  assert.equal(prefixed.restorations[0].material, 'Zirconia');
  assert.equal(/đắp\s*mài/i.test(prefixed.restorations[0].material), false);
});

test('other sheet variants on the warranty payload stay prefixed as stored', () => {
  const result = buildWarrantyResult('UC123', [{...base, material: 'Full Zirconia', teeth: '11'}]);
  assert.equal(result.restorations[0].material, 'Full Zirconia');
});

test('materials containing zaroc return exactly Phôi đơn lớp Zaroc', () => {
  const cases = ['Zaroc', 'ZAROC', 'zaroc', 'Za roc', 'Zaróc', 'Full Zaroc', 'Đắp mài Zaroc'];
  for (const material of cases) {
    const result = buildWarrantyResult('UC123', [{...base, material, teeth: '11'}]);
    assert.equal(result.restorations[0].material, 'Phôi đơn lớp Zaroc', material);
  }
});

test('non-zaroc materials still strip đắp mài and otherwise stay as stored', () => {
  assert.equal(
    buildWarrantyResult('UC123', [{...base, material: 'Zirconia', teeth: '11'}]).restorations[0].material,
    'Zirconia'
  );
  assert.equal(
    buildWarrantyResult('UC123', [{...base, material: 'Đắp mài Cercon HT', teeth: '11'}]).restorations[0].material,
    'Cercon HT'
  );
  assert.equal(
    buildWarrantyResult('UC123', [{...base, material: 'Full Zirconia', teeth: '11'}]).restorations[0].material,
    'Full Zirconia'
  );
});

test('Hoàn thiện labels are stripped like đắp mài; Zaroc still wins', () => {
  const stripped = buildWarrantyResult('UC123', [{...base, material: 'Hoàn thiện Zirconia', teeth: '11'}]);
  assert.equal(stripped.restorations[0].material, 'Zirconia');
  const zaroc = buildWarrantyResult('UC123', [{...base, material: 'Hoàn thiện Zaroc', teeth: '11'}]);
  assert.equal(zaroc.restorations[0].material, 'Phôi đơn lớp Zaroc');
});

test('materials containing razor or unc as whole tokens return exactly Phôi đơn lớp Zaroc', () => {
  const cases = [
    'UNC',
    'unc',
    'Full UNC',
    'UNC hoàn thiện',
    'zirco Razor',
    'Full zirco razor',
    'Sườn zirco Razor',
    'RAZOR',
    'Sườn implant UNC',
    'Đắp mài Razor',
    'Hoàn thiện UNC',
  ];
  for (const material of cases) {
    const result = buildWarrantyResult('UC123', [{...base, material, teeth: '11'}]);
    assert.equal(result.restorations[0].material, 'Phôi đơn lớp Zaroc', material);
  }
});

test('unrelated words that only contain razor or unc letters stay as stored', () => {
  const cases = [
    ['Zirconia', 'Zirconia'],
    ['Full Zirconia', 'Full Zirconia'],
    ['function', 'function'],
    ['uncommon', 'uncommon'],
    ['truncated', 'truncated'],
    ['razorback', 'razorback'],
    ['Cercon HT', 'Cercon HT'],
  ];
  for (const [material, expected] of cases) {
    const result = buildWarrantyResult('UC123', [{...base, material, teeth: '11'}]);
    assert.equal(result.restorations[0].material, expected, material);
  }
});
