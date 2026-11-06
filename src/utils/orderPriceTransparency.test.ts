import assert from 'node:assert/strict';
import test from 'node:test';
import type { MaterialPriceConfig } from '../types/dental';
import { attachClinicMetaToPrices } from './financeUtils';
import {
  explainOrderAmountSuggestion,
  resolvePriceSourceForMaterial,
} from './orderPriceTransparency';

const shared: MaterialPriceConfig[] = [
  {
    id: 'mat_full_zirconia',
    materialKey: 'full zirconia',
    name: 'Full Zirconia',
    category: 'Zirconia',
    origin: 'Đức',
    unitPrice: 390000,
    retailSuggestedPrice: 2000000,
    defaultWarranty: '15 năm',
    strengthMpa: 1150,
  },
  {
    id: 'mat_full_unc',
    materialKey: 'full unc',
    name: 'Full UNC',
    category: 'Zirconia',
    origin: 'Đức',
    unitPrice: 130000,
    retailSuggestedPrice: 700000,
    defaultWarranty: '15 năm',
    strengthMpa: 1100,
  },
];

test('shared source when clinic has no custom table', () => {
  assert.equal(
    resolvePriceSourceForMaterial('Nha khoa Lăng Cô', 'Full Zirconia', shared, []),
    'shared'
  );
  const expl = explainOrderAmountSuggestion({
    clinicName: 'Nha khoa Lăng Cô',
    material: 'Full Zirconia',
    quantity: 2,
    enteredAmount: 780000,
    sharedPrices: shared,
    clinicRows: [],
  });
  assert.equal(expl.source, 'shared');
  assert.equal(expl.sourceLabel, 'Giá chung');
  assert.equal(expl.unitPrice, 390000);
  assert.equal(expl.suggestedTotal, 780000);
  assert.match(expl.calculationText, /390\.000|390,000/);
  assert.match(expl.calculationText, /× 2/);
  assert.match(expl.calculationText, /780\.000|780,000/);
  assert.equal(expl.relation, 'matches');
  assert.equal(expl.relationLabel, null);
});

test('clinic source only for materials present in that clinic table', () => {
  const rows = attachClinicMetaToPrices('Lăng Cô', 'partner_abc', [
    { ...shared[0], unitPrice: 350000 },
  ]);
  assert.equal(
    resolvePriceSourceForMaterial('Nha khoa Lăng Cô', 'Full Zirconia', shared, rows),
    'clinic'
  );
  // Full UNC is not in the clinic table → resolve does not fall back → unavailable
  assert.equal(
    resolvePriceSourceForMaterial('Nha khoa Lăng Cô', 'Full UNC', shared, rows),
    'unavailable'
  );
  const expl = explainOrderAmountSuggestion({
    clinicName: 'Nha khoa Lăng Cô',
    material: 'Full Zirconia',
    quantity: 3,
    enteredAmount: 1050000,
    sharedPrices: shared,
    clinicRows: rows,
  });
  assert.equal(expl.source, 'clinic');
  assert.equal(expl.sourceLabel, 'Giá riêng nha khoa');
  assert.equal(expl.unitPrice, 350000);
  assert.equal(expl.suggestedTotal, 1050000);
});

test('missing material or clinic keys → neutral unavailable, not a false zero quote', () => {
  const expl = explainOrderAmountSuggestion({
    clinicName: 'Nha khoa Lăng Cô',
    material: 'Vật liệu không tồn tại',
    quantity: 2,
    enteredAmount: 0,
    sharedPrices: shared,
    clinicRows: [],
  });
  assert.equal(expl.source, 'unavailable');
  assert.equal(expl.hasSuggestion, false);
  assert.equal(expl.unitPrice, 0);
  assert.equal(expl.suggestedTotal, 0);
  assert.match(expl.calculationText, /Chưa có đơn giá/i);
  assert.doesNotMatch(expl.helpText, /^0 .*×/);
});

test('session manual override labeled Đã sửa tay; calculation stays suggested total', () => {
  const expl = explainOrderAmountSuggestion({
    clinicName: 'Nha khoa A',
    material: 'Full UNC',
    quantity: 2,
    enteredAmount: 999000,
    sharedPrices: shared,
    sessionManual: true,
  });
  assert.equal(expl.suggestedTotal, 260000);
  assert.equal(expl.relation, 'session_manual');
  assert.equal(expl.relationLabel, 'Đã sửa tay');
  assert.match(expl.calculationText, /260\.000|260,000/);
  assert.notEqual(999000, expl.suggestedTotal);
});

test('loaded saved amount differing from catalog is Khác giá đề xuất, not Đã sửa tay', () => {
  const expl = explainOrderAmountSuggestion({
    clinicName: 'Nha khoa A',
    material: 'Full UNC',
    quantity: 2,
    enteredAmount: 200000,
    sharedPrices: shared,
    sessionManual: false,
    loadedDiffersFromSuggestion: true,
  });
  assert.equal(expl.relation, 'loaded_diff');
  assert.equal(expl.relationLabel, 'Khác giá đề xuất');
});

test('incomplete clinic/material shows choose-keys message', () => {
  const expl = explainOrderAmountSuggestion({
    clinicName: '',
    material: '',
    quantity: 1,
    enteredAmount: 0,
    sharedPrices: shared,
  });
  assert.equal(expl.source, 'unavailable');
  assert.match(expl.calculationText, /Chọn nha khoa/i);
});
