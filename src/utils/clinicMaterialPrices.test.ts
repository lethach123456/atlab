import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ClinicMaterialPriceRow, MaterialPriceConfig } from '../types/dental';
import {
  applyCatalogPricesToOrderData,
  attachClinicMetaToPrices,
  clinicHasCustomMaterialPrices,
  clinicMaterialPriceDocId,
  clinicMaterialPriceKey,
  getUnitPriceForMaterial,
  materialConfigsFromClinicRows,
  resolveMaterialPricesForClinic,
} from './financeUtils';

const shared: MaterialPriceConfig[] = [
  {
    id: 'mat_full_zirconia',
    materialKey: 'full zirconia',
    name: 'Full Zirconia',
    category: 'Zirconia Nguyên Khối (Full)',
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
    category: 'Zirconia Nguyên Khối (Full)',
    origin: 'Đức',
    unitPrice: 130000,
    retailSuggestedPrice: 700000,
    defaultWarranty: '15 năm',
    strengthMpa: 1100,
  },
];

describe('clinic material prices', () => {
  it('falls back to shared when clinic has no custom table', () => {
    const resolved = resolveMaterialPricesForClinic('Nha khoa Lăng Cô', shared, []);
    assert.equal(getUnitPriceForMaterial('Full Zirconia', resolved), 390000);
  });

  it('uses custom clinic prices when present', () => {
    const rows = attachClinicMetaToPrices('Lăng Cô', 'partner_abc', [
      { ...shared[0], unitPrice: 350000 },
      shared[1],
    ]);
    assert.equal(clinicHasCustomMaterialPrices('Nha khoa Lăng Cô', rows), true);
    const resolved = resolveMaterialPricesForClinic('Nha khoa Lăng Cô', shared, rows);
    assert.equal(getUnitPriceForMaterial('Full Zirconia', resolved), 350000);
    assert.equal(getUnitPriceForMaterial('Full UNC', resolved), 130000);
  });

  it('round-trips material ids through clinic doc ids', () => {
    const rows = attachClinicMetaToPrices('Tâm An', 'partner_xyz', shared);
    assert.equal(rows[0].id, clinicMaterialPriceDocId('partner_xyz', 'mat_full_zirconia'));
    const back = materialConfigsFromClinicRows(rows);
    assert.equal(back[0].id, 'mat_full_zirconia');
    assert.equal(back[0].unitPrice, 390000);
  });

  it('fills zero unit/total from catalog on order create', () => {
    const priced = applyCatalogPricesToOrderData(
      { material: 'Full UNC', teethCount: 3, unitPrice: 0, totalAmount: 0 },
      shared
    );
    assert.equal(priced.unitPrice, 130000);
    assert.equal(priced.totalAmount, 390000);
  });

  it('keeps explicit totalAmount when provided', () => {
    const priced = applyCatalogPricesToOrderData(
      { material: 'Full UNC', teethCount: 3, unitPrice: 0, totalAmount: 500000 },
      shared
    );
    assert.equal(priced.unitPrice, 130000);
    assert.equal(priced.totalAmount, 500000);
  });

  it('normalizes clinic key aliases', () => {
    assert.equal(clinicMaterialPriceKey('Nha khoa Lăng Cô'), clinicMaterialPriceKey('Lăng Cô'));
  });
});
