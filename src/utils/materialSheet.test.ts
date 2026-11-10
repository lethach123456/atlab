import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MaterialPriceConfig } from '../types/dental';
import {
  DAP_MAI_SHEET_FORM,
  DEFAULT_MATERIAL_PRICES,
  MATERIAL_PRICES_SEED_VERSION,
  MATERIAL_SHEET_FORM_LABELS,
  getUnitPriceForMaterial,
  groupMaterialPricesForSheet,
  materialSheetItemName,
  parseMaterialSheetName,
  seedMaterialPricesFromDefaults,
} from './financeUtils';

function price(
  name: string,
  unitPrice: number,
  id = `mat_${name.toLowerCase().replace(/\s+/g, '_')}`
): MaterialPriceConfig {
  return {
    id,
    materialKey: name.toLowerCase(),
    name,
    category: 'Test',
    origin: 'Đức',
    unitPrice,
    retailSuggestedPrice: unitPrice,
    defaultWarranty: '15 năm',
    strengthMpa: 1150,
  };
}

describe('hoàn thiện / đắp mài sheet naming', () => {
  it('keeps the seed version so live catalogs are not auto-overwritten', () => {
    assert.equal(MATERIAL_PRICES_SEED_VERSION, '2026-11-06-sheet-v2');
  });

  it('places Hoàn thiện after Veneer and before implant forms', () => {
    assert.deepEqual(MATERIAL_SHEET_FORM_LABELS, [
      'Sườn',
      'Full',
      'Veneer',
      'Hoàn thiện',
      'Sườn implant',
      'Full implant',
    ]);
    assert.equal(DAP_MAI_SHEET_FORM, 'Hoàn thiện');
  });

  it('uses the bare family name for Hoàn thiện (and legacy Đắp mài) and prefixed names for other forms', () => {
    assert.equal(materialSheetItemName('Hoàn thiện', 'Zirconia'), 'Zirconia');
    assert.equal(materialSheetItemName('Hoàn thiện', 'Cercon HT'), 'Cercon HT');
    assert.equal(materialSheetItemName('Đắp mài', 'Zirconia'), 'Zirconia');
    assert.equal(materialSheetItemName('Full', 'Zirconia'), 'Full Zirconia');
    assert.equal(materialSheetItemName('Sườn', 'Zirconia'), 'Sườn Zirconia');
    assert.equal(materialSheetItemName('Veneer', 'Zirconia'), 'Veneer Zirconia');
  });

  it('parses only prefixed sheet names (bare family names are not a form prefix)', () => {
    assert.deepEqual(parseMaterialSheetName('Full Zirconia'), { form: 'Full', brand: 'Zirconia' });
    assert.deepEqual(parseMaterialSheetName('Sườn implant Cercon HT'), {
      form: 'Sườn implant',
      brand: 'Cercon HT',
    });
    assert.equal(parseMaterialSheetName('Zirconia'), null);
    assert.equal(parseMaterialSheetName('Cercon HT'), null);
    assert.equal(parseMaterialSheetName('Đắp mài Zirconia'), null);
    assert.equal(parseMaterialSheetName('Hoàn thiện Zirconia'), null);
  });
});

describe('groupMaterialPricesForSheet — Hoàn thiện column', () => {
  it('maps an existing exact family-name row into Hoàn thiện without duplicating it', () => {
    const zirconia = price('Zirconia', 250000, 'mat_zirconia_live');
    const full = price('Full Zirconia', 390000);
    const view = groupMaterialPricesForSheet([full, zirconia]);
    assert.equal(view.brandRows.length, 1);
    assert.equal(view.brandRows[0].brand, 'Zirconia');
    assert.equal(view.brandRows[0].byForm.Full?.id, full.id);
    assert.equal(view.brandRows[0].byForm[DAP_MAI_SHEET_FORM]?.id, 'mat_zirconia_live');
    assert.equal(view.brandRows[0].byForm[DAP_MAI_SHEET_FORM]?.unitPrice, 250000);
    assert.equal(view.brandRows[0].byForm[DAP_MAI_SHEET_FORM]?.name, 'Zirconia');
    assert.deepEqual(view.extras, []);
  });

  it('leaves the Hoàn thiện cell empty when the family has no bare-name row', () => {
    const view = groupMaterialPricesForSheet([price('Full Zirconia', 390000), price('Sườn Zirconia', 390000)]);
    assert.equal(view.brandRows[0].byForm[DAP_MAI_SHEET_FORM], undefined);
    assert.deepEqual(view.extras, []);
  });

  it('still groups a known bare family name when prefixed rows are missing', () => {
    const view = groupMaterialPricesForSheet([price('Cercon HT', 410000, 'mat_cercon_ht')]);
    assert.equal(view.brandRows.length, 1);
    assert.equal(view.brandRows[0].brand, 'Cercon HT');
    assert.equal(view.brandRows[0].byForm[DAP_MAI_SHEET_FORM]?.id, 'mat_cercon_ht');
    assert.deepEqual(view.extras, []);
  });

  it('keeps unknown names and a second exact-name collision in extras', () => {
    const first = price('Zirconia', 250000, 'mat_zirconia');
    const second = price('Zirconia', 999000, 'mat_zirconia_dup');
    const mystery = price('Vật liệu lạ', 10000);
    const view = groupMaterialPricesForSheet([price('Full Zirconia', 390000), first, second, mystery]);
    assert.equal(view.brandRows[0].byForm[DAP_MAI_SHEET_FORM]?.id, 'mat_zirconia');
    assert.equal(view.extras.length, 2);
    assert.deepEqual(
      view.extras.map((row) => row.id).sort(),
      ['mat_zirconia_dup', mystery.id].sort()
    );
  });

  it('does not treat Cùi giả as a Hoàn thiện family', () => {
    const view = groupMaterialPricesForSheet([price('Cùi giả', 50000)]);
    assert.equal(view.brandRows.length, 0);
    assert.equal(view.extras[0]?.name, 'Cùi giả');
  });
});

describe('DEFAULT_MATERIAL_PRICES and seed safety', () => {
  it('includes a 0-price bare family row per brand, and does not invent a "Đắp mài …" name', () => {
    const zirconia = DEFAULT_MATERIAL_PRICES.find((row) => row.name === 'Zirconia');
    const cercon = DEFAULT_MATERIAL_PRICES.find((row) => row.name === 'Cercon HT');
    assert.ok(zirconia);
    assert.ok(cercon);
    assert.equal(zirconia?.unitPrice, 0);
    assert.equal(cercon?.unitPrice, 0);
    assert.equal(zirconia?.category, 'Hoàn thiện');
    assert.equal(
      DEFAULT_MATERIAL_PRICES.some((row) => row.name.startsWith('Đắp mài ') || row.name.startsWith('Hoàn thiện ')),
      false
    );
    assert.equal(getUnitPriceForMaterial('Full Zirconia', DEFAULT_MATERIAL_PRICES), 390000);
    assert.equal(getUnitPriceForMaterial('Zirconia', DEFAULT_MATERIAL_PRICES), 0);
  });

  it('does not overwrite an existing exact-name price with the 0 default', () => {
    const existing = [
      price('Full Zirconia', 390000),
      price('Zirconia', 500000, 'mat_zirconia_live'),
    ];
    const result = seedMaterialPricesFromDefaults(existing);
    const live = result.next.find((row) => row.name === 'Zirconia');
    assert.ok(live);
    assert.equal(live?.id, 'mat_zirconia_live');
    assert.equal(live?.unitPrice, 500000);
    assert.equal(live?.retailSuggestedPrice, 500000);
  });

  it('does not drop a bare family name as a superseded legacy row', () => {
    const existing = [
      price('Zirconia', 180000, 'mat_old_zirconia'),
      price('full cercon', 100000, 'mat_legacy_cercon'),
      price('Cùi giả', 40000, 'mat_cui_gia_live'),
    ];
    const result = seedMaterialPricesFromDefaults(existing);
    const zirconia = result.next.find((row) => row.name === 'Zirconia' || row.id === 'mat_old_zirconia');
    assert.ok(zirconia);
    assert.equal(zirconia?.unitPrice, 180000);
    assert.equal(result.next.some((row) => row.id === 'mat_legacy_cercon'), false);
    assert.ok(result.next.some((row) => row.name === 'Cùi giả'));
  });
});
