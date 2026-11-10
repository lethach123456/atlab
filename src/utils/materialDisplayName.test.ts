import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DAP_MAI_SHEET_FORM,
  categoryForSheetForm,
  materialSheetItemName,
} from './financeUtils';
import { displayMaterialName } from './materialDisplayName';

describe('displayMaterialName — warranty / invoice', () => {
  it('keeps the stored bare family name for đắp mài and never adds the column label', () => {
    assert.equal(materialSheetItemName('Đắp mài', 'Zirconia'), 'Zirconia');
    assert.equal(materialSheetItemName('Đắp mài', 'Cercon HT'), 'Cercon HT');
    assert.equal(displayMaterialName('Zirconia'), 'Zirconia');
    assert.equal(displayMaterialName('Cercon HT'), 'Cercon HT');
    assert.doesNotMatch(displayMaterialName('Zirconia'), /đắp\s*mài/i);
    assert.doesNotMatch(displayMaterialName('Cercon HT'), /đắp\s*mài/i);
    assert.notEqual(displayMaterialName('Zirconia'), `${DAP_MAI_SHEET_FORM} Zirconia`);
    assert.notEqual(displayMaterialName('Zirconia'), categoryForSheetForm('Đắp mài'));
    assert.equal(categoryForSheetForm('Đắp mài'), 'Đắp Mài');
  });

  it('leaves other sheet variants unchanged (sườn / full / veneer / implant)', () => {
    assert.equal(displayMaterialName('Full Zirconia'), 'Full Zirconia');
    assert.equal(displayMaterialName('Sườn Zirconia'), 'Sườn Zirconia');
    assert.equal(displayMaterialName('Veneer Cercon HT'), 'Veneer Cercon HT');
    assert.equal(displayMaterialName('Sườn implant UNC'), 'Sườn implant UNC');
    assert.equal(displayMaterialName('Full implant Zirconia'), 'Full implant Zirconia');
    assert.equal(displayMaterialName('Cùi giả'), 'Cùi giả');
  });

  it('strips an accidental đắp mài label instead of showing it', () => {
    assert.equal(displayMaterialName('Đắp mài Zirconia'), 'Zirconia');
    assert.equal(displayMaterialName('Zirconia (Đắp mài)'), 'Zirconia');
    assert.equal(displayMaterialName('Cercon HT - Đắp mài'), 'Cercon HT');
    assert.equal(displayMaterialName('Đắp Mài'), '');
    assert.equal(displayMaterialName(''), '');
  });
});
