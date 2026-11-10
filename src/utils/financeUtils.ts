import {
  MaterialPriceConfig,
  ClinicMaterialPriceRow,
  DentalOrder,
  DebtPaymentRecord,
  ClinicDebtRecord,
  CashflowTransaction,
  DeliveryRecord,
  LabProfileConfig,
} from '../types/dental';
import { normalizeClinicName } from './debtLedger';

export const DEFAULT_LAB_PROFILE: LabProfileConfig = {
  labName: 'AT DENTAL LABORATORY',
  tagline: 'Trung Tâm Phục Hình Răng Sứ Kỹ Thuật Số CAD/CAM Chất Lượng Cao',
  hotline: '0903.589.987 - 0777.265.444',
  address: 'Hải Châu, TP. Đà Nẵng',
  email: 'contact@atdentallab.vn',
  bankName: 'Vietcombank (VCB) - CN Đà Nẵng',
  bankAccountNumber: '0041000889999',
  bankAccountHolder: 'AT DENTAL LAB',
  directorName: 'Lê Hoàng Huy Thạch',
};

/**
 * Danh mục Dòng Sứ theo bảng giá Lab (Sườn / Full / Veneer / Hoàn thiện / Sườn implant / Full implant).
 * Cột Hoàn thiện lưu đúng tên họ sứ (vd. "Zirconia"), không gắn tiền tố form.
 * Giá trên sheet ghi theo nghìn đồng → unitPrice lưu VNĐ (× 1000).
 * Hoàn thiện không có giá mặc định trên sheet (unitPrice 0 / chưa nhập).
 * Nhãn cũ "Đắp mài" vẫn được nhận khi đọc; ghi mới dùng "Hoàn thiện".
 */
export const MATERIAL_PRICES_SEED_VERSION = '2026-11-06-sheet-v2';

/** Cột giá trên bảng sheet (thứ tự hiển thị). */
export const MATERIAL_SHEET_FORM_LABELS = [
  'Sườn',
  'Full',
  'Veneer',
  'Hoàn thiện',
  'Sườn implant',
  'Full implant',
] as const;

/** Canonical form whose catalog/order name is the bare family (no column-label prefix). */
export const DAP_MAI_SHEET_FORM = 'Hoàn thiện' as const;

/** Previous column label; still accepted on read. */
export const DAP_MAI_SHEET_FORM_LEGACY = 'Đắp mài' as const;

export function isBareFamilySheetForm(form: string): boolean {
  const key = form.trim().toLowerCase();
  return key === DAP_MAI_SHEET_FORM.toLowerCase() || key === DAP_MAI_SHEET_FORM_LEGACY.toLowerCase();
}

export type MaterialSheetFormLabel = (typeof MATERIAL_SHEET_FORM_LABELS)[number];

/** Parse tên: ưu tiên form dài (Sườn implant / Full implant) trước Sườn / Full. */
const MATERIAL_SHEET_FORM_PARSE_ORDER: MaterialSheetFormLabel[] = [
  'Sườn implant',
  'Full implant',
  'Veneer',
  'Sườn',
  'Full',
];

type SheetForm = {
  form: MaterialSheetFormLabel;
  category: string;
};

const MATERIAL_SHEET_FORMS: SheetForm[] = [
  { form: 'Sườn', category: 'Sườn Sứ Zirconia' },
  { form: 'Full', category: 'Zirconia Nguyên Khối (Full)' },
  { form: 'Veneer', category: 'Mặt Dán Sứ Veneer' },
  { form: 'Hoàn thiện', category: 'Hoàn thiện' },
  { form: 'Sườn implant', category: 'Phục Hình Trên Implant' },
  { form: 'Full implant', category: 'Phục Hình Trên Implant' },
];

const SHEET_FORM_CATEGORY: Record<MaterialSheetFormLabel, string> = Object.fromEntries(
  MATERIAL_SHEET_FORMS.map((row) => [row.form, row.category])
) as Record<MaterialSheetFormLabel, string>;

export function categoryForSheetForm(form: MaterialSheetFormLabel): string {
  return SHEET_FORM_CATEGORY[form];
}

export function materialSheetItemName(
  form: MaterialSheetFormLabel | typeof DAP_MAI_SHEET_FORM_LEGACY,
  brand: string
): string {
  const trimmed = brand.trim();
  if (isBareFamilySheetForm(form)) return trimmed;
  return `${form} ${trimmed}`.trim();
}

export function sheetBrandKey(brand: string): string {
  return brand.trim().toLowerCase();
}

/** Prefixed sheet names only (Sườn/Full/…). Bare family names are handled in groupMaterialPricesForSheet. */
export function parseMaterialSheetName(
  name: string
): { form: MaterialSheetFormLabel; brand: string } | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const form of MATERIAL_SHEET_FORM_PARSE_ORDER) {
    const prefix = `${form.toLowerCase()} `;
    if (lower.startsWith(prefix)) {
      const brand = trimmed.slice(form.length).trim();
      if (!brand) return null;
      return { form, brand };
    }
  }
  return null;
}

export function suggestedRetailFromUnitPrice(unitPrice: number): number {
  return Math.round((unitPrice * 5.5) / 100_000) * 100_000;
}

export interface MaterialSheetBrandRow {
  brandKey: string;
  brand: string;
  origin: string;
  strengthMpa: number;
  defaultWarranty: string;
  byForm: Partial<Record<MaterialSheetFormLabel, MaterialPriceConfig>>;
  configIds: string[];
}

export interface MaterialPricesSheetView {
  brandRows: MaterialSheetBrandRow[];
  extras: MaterialPriceConfig[];
}

function upsertSheetBrandRow(
  brandMap: Map<string, MaterialSheetBrandRow>,
  brandOrder: string[],
  brandKey: string,
  brand: string,
  item: MaterialPriceConfig,
  form: MaterialSheetFormLabel
): void {
  let row = brandMap.get(brandKey);
  if (!row) {
    row = {
      brandKey,
      brand,
      origin: item.origin,
      strengthMpa: item.strengthMpa,
      defaultWarranty: item.defaultWarranty,
      byForm: {},
      configIds: [],
    };
    brandMap.set(brandKey, row);
    brandOrder.push(brandKey);
  }
  if (!row.byForm[form]) {
    row.byForm[form] = item;
    row.configIds.push(item.id);
  }
  if (item.origin?.trim()) row.origin = item.origin;
  if (item.strengthMpa) row.strengthMpa = item.strengthMpa;
  if (item.defaultWarranty?.trim()) row.defaultWarranty = item.defaultWarranty;
  if (form === 'Full') row.brand = brand;
}

export function groupMaterialPricesForSheet(
  prices: MaterialPriceConfig[]
): MaterialPricesSheetView {
  const brandMap = new Map<string, MaterialSheetBrandRow>();
  const brandOrder: string[] = [];
  const pendingBare: MaterialPriceConfig[] = [];

  for (const item of prices) {
    const parsed = parseMaterialSheetName(item.name);
    if (!parsed) {
      pendingBare.push(item);
      continue;
    }
    upsertSheetBrandRow(
      brandMap,
      brandOrder,
      sheetBrandKey(parsed.brand),
      parsed.brand,
      item,
      parsed.form
    );
  }

  const knownKeys = new Set<string>([
    ...brandMap.keys(),
    ...MATERIAL_SHEET_BRANDS.map((row) => sheetBrandKey(row.brand)),
  ]);
  const extras: MaterialPriceConfig[] = [];
  for (const item of pendingBare) {
    const key = sheetBrandKey(item.name);
    if (!key || !knownKeys.has(key) || brandMap.get(key)?.byForm[DAP_MAI_SHEET_FORM]) {
      extras.push(item);
      continue;
    }
    const official = MATERIAL_SHEET_BRANDS.find((row) => sheetBrandKey(row.brand) === key)?.brand;
    const brand = brandMap.get(key)?.brand || official || item.name.trim();
    upsertSheetBrandRow(brandMap, brandOrder, key, brand, item, DAP_MAI_SHEET_FORM);
  }

  return {
    brandRows: brandOrder.map((key) => brandMap.get(key)!),
    extras,
  };
}

/** Giá sheet theo thứ tự form ở trên, đơn vị nghìn đồng. */
const MATERIAL_SHEET_BRANDS: Array<{
  brand: string;
  origin: string;
  strengthMpa: number;
  pricesThousands: [number, number, number, number, number];
}> = [
  { brand: 'Zirconia', origin: 'Đức', strengthMpa: 1150, pricesThousands: [390, 390, 390, 420, 520] },
  { brand: 'UNC', origin: 'Đức', strengthMpa: 1100, pricesThousands: [90, 130, 110, 200, 250] },
  { brand: 'DD Bio Cao Cấp', origin: 'Đức', strengthMpa: 1100, pricesThousands: [180, 230, 205, 300, 350] },
  { brand: 'Cercon HT', origin: 'Đức', strengthMpa: 1200, pricesThousands: [350, 410, 380, 480, 530] },
  { brand: 'Ceramill Zolid', origin: 'Áo', strengthMpa: 1200, pricesThousands: [550, 620, 585, 690, 740] },
  { brand: 'Lava Plus 3M', origin: 'Mỹ', strengthMpa: 1250, pricesThousands: [750, 830, 790, 900, 950] },
  { brand: 'Orodent Italy', origin: 'Ý', strengthMpa: 1400, pricesThousands: [900, 980, 940, 1050, 1100] },
  { brand: 'Nacera', origin: 'Đức', strengthMpa: 1300, pricesThousands: [950, 1050, 1000, 1120, 1170] },
  { brand: 'Orodent Gold', origin: 'Ý', strengthMpa: 1400, pricesThousands: [1000, 1060, 1030, 1130, 1180] },
];

function materialRowId(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `mat_${slug}`;
}

const SHEET_MATERIAL_PRICES: MaterialPriceConfig[] = MATERIAL_SHEET_BRANDS.flatMap((brand) => {
  let pricedIndex = 0;
  return MATERIAL_SHEET_FORMS.map((form) => {
    const name = materialSheetItemName(form.form, brand.brand);
    const isDapMai = form.form === DAP_MAI_SHEET_FORM;
    const unitPrice = isDapMai ? 0 : brand.pricesThousands[pricedIndex++] * 1000;
    return {
      id: materialRowId(name),
      materialKey: name.toLowerCase(),
      name,
      category: form.category,
      origin: brand.origin,
      unitPrice,
      retailSuggestedPrice: unitPrice > 0 ? suggestedRetailFromUnitPrice(unitPrice) : 0,
      defaultWarranty: '15 năm',
      strengthMpa: brand.strengthMpa,
    };
  });
});

/** Dòng phụ không nằm trên sheet giá sứ (giữ lại trong bảng). */
const EXTRA_MATERIAL_PRICES: MaterialPriceConfig[] = [
  {
    id: 'mat_cuigia',
    materialKey: 'cùi giả',
    name: 'Cùi giả',
    category: 'Chốt Cùi Phục Hình',
    origin: 'Đức',
    unitPrice: 300000,
    retailSuggestedPrice: 1200000,
    defaultWarranty: '15 năm',
    strengthMpa: 1100,
  },
];

export const DEFAULT_MATERIAL_PRICES: MaterialPriceConfig[] = [
  ...SHEET_MATERIAL_PRICES,
  ...EXTRA_MATERIAL_PRICES,
];

export interface MaterialPriceSeedResult {
  next: MaterialPriceConfig[];
  updated: number;
  added: number;
  removed: number;
  changed: boolean;
}

/**
 * Gộp bảng giá đang lưu với DEFAULT (sheet): cập nhật giá/origin cho dòng trùng
 * materialKey/name, thêm dòng thiếu, giữ dòng phụ không đụng sheet (vd. Cùi giả đã có trong DEFAULT).
 * Các dòng cũ trùng “họ” sứ trên sheet nhưng khác tên (vd. full cercon) bị thay bởi bộ sheet.
 */
export function seedMaterialPricesFromDefaults(
  existing: MaterialPriceConfig[],
  defaults: MaterialPriceConfig[] = DEFAULT_MATERIAL_PRICES
): MaterialPriceSeedResult {
  const defaultKeys = new Set(
    defaults.flatMap((row) => [row.materialKey.toLowerCase().trim(), row.name.toLowerCase().trim()])
  );

  const existingByKey = new Map<string, MaterialPriceConfig>();
  for (const row of existing) {
    existingByKey.set(row.materialKey.toLowerCase().trim(), row);
    existingByKey.set(row.name.toLowerCase().trim(), row);
  }

  let updated = 0;
  let added = 0;
  const usedIds = new Set<string>();
  const next: MaterialPriceConfig[] = [];

  for (const def of defaults) {
    const match =
      existingByKey.get(def.materialKey.toLowerCase().trim()) ||
      existingByKey.get(def.name.toLowerCase().trim());
    if (match) {
      usedIds.add(match.id);
      const keepExistingPrice =
        def.unitPrice === 0 &&
        parseMaterialSheetName(def.name) === null &&
        sheetBrandKey(def.name) === sheetBrandKey(match.name);
      const merged: MaterialPriceConfig = {
        ...match,
        materialKey: def.materialKey,
        name: def.name,
        category: def.category,
        origin: def.origin,
        unitPrice: keepExistingPrice ? match.unitPrice : def.unitPrice,
        retailSuggestedPrice: keepExistingPrice ? match.retailSuggestedPrice : def.retailSuggestedPrice,
        defaultWarranty: def.defaultWarranty,
        strengthMpa: def.strengthMpa,
      };
      if (
        match.unitPrice !== merged.unitPrice ||
        match.origin !== merged.origin ||
        match.name !== merged.name ||
        match.category !== merged.category ||
        match.retailSuggestedPrice !== merged.retailSuggestedPrice ||
        match.defaultWarranty !== merged.defaultWarranty ||
        match.strengthMpa !== merged.strengthMpa ||
        match.materialKey !== merged.materialKey
      ) {
        updated += 1;
      }
      next.push(merged);
    } else {
      added += 1;
      usedIds.add(def.id);
      next.push(def);
    }
  }

  // Keep only extras that are clearly outside the sheet catalog keys.
  for (const row of existing) {
    if (usedIds.has(row.id)) continue;
    const key = row.materialKey.toLowerCase().trim();
    const name = row.name.toLowerCase().trim();
    if (defaultKeys.has(key) || defaultKeys.has(name)) continue;
    // Drop legacy brand rows that the sheet supersedes (same product family, old naming).
    if (isLegacySheetSupersededMaterial(name) || isLegacySheetSupersededMaterial(key)) {
      continue;
    }
    next.push(row);
  }

  const removed = existing.filter((row) => !next.some((item) => item.id === row.id)).length;
  const changed = updated > 0 || added > 0 || removed > 0;
  return { next, updated, added, removed, changed };
}

function isLegacySheetSupersededMaterial(value: string): boolean {
  const v = value.toLowerCase().trim();
  // Bare family names (Zirconia, Cercon HT, …) are the Hoàn thiện catalog rows — never drop them.
  if (MATERIAL_SHEET_BRANDS.some((row) => sheetBrandKey(row.brand) === v)) return false;
  const markers = [
    'zirconia',
    'zirco',
    'ziconia',
    'cercon',
    'ddbio',
    'dd bio',
    'orodent',
    'nacera',
    'ceramill',
    'lava',
    'unc',
    'razor',
    'implant zirconia',
  ];
  return markers.some((marker) => v.includes(marker));
}

/**
 * Determine reference unit price for a material name (chỉ dùng để tham khảo trong danh mục)
 */
export function getUnitPriceForMaterial(
  materialName: string,
  priceConfigs: MaterialPriceConfig[] = DEFAULT_MATERIAL_PRICES
): number {
  if (!materialName) return 0;
  const lower = materialName.toLowerCase().trim();
  const exact = priceConfigs.find(
    (p) =>
      p.name.toLowerCase() === lower || p.materialKey.toLowerCase() === lower
  );
  if (exact) return exact.unitPrice;
  return 0;
}

/**
 * Khóa chuẩn hóa để gắn bảng giá riêng với nha khoa (kể cả tên cũ/alias).
 */
export function clinicMaterialPriceKey(clinicName: string): string {
  return normalizeClinicName(clinicName);
}

/** Doc id Firestore an toàn cho một dòng giá theo nha khoa. */
export function clinicMaterialPriceDocId(clinicId: string, materialId: string): string {
  const safeClinic = (clinicId || 'clinic')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64) || 'clinic';
  const safeMat = (materialId || 'mat')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 56) || 'mat';
  return `cmp_${safeClinic}_${safeMat}`.slice(0, 128);
}

export function clinicIdForPartner(
  partner: { id?: string; name: string } | null | undefined,
  clinicName: string
): string {
  if (partner?.id?.trim()) return partner.id.trim();
  const slug = clinicMaterialPriceKey(clinicName || partner?.name || 'clinic')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'clinic';
  return `ck_${slug}`;
}

export function materialIdFromClinicPriceDocId(docId: string): string {
  const matIdx = docId.indexOf('_mat_');
  if (docId.startsWith('cmp_') && matIdx >= 0) return docId.slice(matIdx + 1);
  return docId;
}

export function stripClinicPriceFields(row: ClinicMaterialPriceRow): MaterialPriceConfig {
  return {
    id: materialIdFromClinicPriceDocId(row.id),
    materialKey: row.materialKey,
    name: row.name,
    category: row.category,
    origin: row.origin,
    unitPrice: row.unitPrice,
    retailSuggestedPrice: row.retailSuggestedPrice,
    defaultWarranty: row.defaultWarranty,
    strengthMpa: row.strengthMpa,
  };
}

/** Đưa các dòng Firestore về MaterialPriceConfig để sửa trên cùng UI matrix. */
export function materialConfigsFromClinicRows(
  rows: ClinicMaterialPriceRow[]
): MaterialPriceConfig[] {
  return rows.map(stripClinicPriceFields);
}

export function clinicHasCustomMaterialPrices(
  clinicName: string,
  clinicRows: ClinicMaterialPriceRow[]
): boolean {
  const key = clinicMaterialPriceKey(clinicName);
  if (!key) return false;
  return clinicRows.some((row) => row.clinicKey === key);
}

export function listClinicsWithCustomMaterialPrices(
  clinicRows: ClinicMaterialPriceRow[]
): string[] {
  const names = new Map<string, string>();
  for (const row of clinicRows) {
    if (!row.clinicKey) continue;
    if (!names.has(row.clinicKey)) names.set(row.clinicKey, row.clinicName || row.clinicKey);
  }
  return Array.from(names.values()).sort((a, b) => a.localeCompare(b, 'vi'));
}

function materialMatchKeys(row: Pick<MaterialPriceConfig, 'name' | 'materialKey'>): string[] {
  return [row.materialKey, row.name].map((value) => value.toLowerCase().trim()).filter(Boolean);
}

/**
 * Giá áp dụng cho nha khoa, theo từng dòng sứ:
 * - Có dòng trong bảng riêng → dùng giá riêng (kể cả khi đơn giá = 0).
 * - Bảng riêng tồn tại nhưng thiếu dòng đó → lấy giá bảng chung.
 * - Chưa có bảng riêng → toàn bộ bảng chung.
 */
export function resolveMaterialPricesForClinic(
  clinicName: string,
  sharedPrices: MaterialPriceConfig[],
  clinicRows: ClinicMaterialPriceRow[] = []
): MaterialPriceConfig[] {
  const key = clinicMaterialPriceKey(clinicName);
  if (!key) return sharedPrices;
  const custom = clinicRows.filter((row) => row.clinicKey === key);
  if (custom.length === 0) return sharedPrices;

  const clinicConfigs = custom.map(stripClinicPriceFields);
  const clinicByKey = new Map<string, MaterialPriceConfig>();
  for (const row of clinicConfigs) {
    for (const matchKey of materialMatchKeys(row)) {
      if (!clinicByKey.has(matchKey)) clinicByKey.set(matchKey, row);
    }
  }

  const usedIds = new Set<string>();
  const next: MaterialPriceConfig[] = [];
  for (const shared of sharedPrices) {
    const match = materialMatchKeys(shared)
      .map((matchKey) => clinicByKey.get(matchKey))
      .find(Boolean);
    if (match) {
      usedIds.add(match.id);
      next.push(match);
    } else {
      next.push(shared);
    }
  }
  for (const row of clinicConfigs) {
    if (!usedIds.has(row.id)) next.push(row);
  }
  return next;
}

/** Sao chép bảng chung thành các dòng gắn nha khoa (chưa ghi id Firestore cuối). */
export function buildClinicMaterialPriceRows(
  clinicName: string,
  clinicId: string,
  sharedPrices: MaterialPriceConfig[]
): ClinicMaterialPriceRow[] {
  const key = clinicMaterialPriceKey(clinicName);
  const name = clinicName.trim();
  return sharedPrices.map((price) => ({
    ...price,
    id: clinicMaterialPriceDocId(clinicId, price.id),
    clinicId,
    clinicKey: key,
    clinicName: name,
  }));
}

/** Gắn meta nha khoa khi lưu bảng riêng (prices đang dùng id mat_* như bảng chung). */
export function attachClinicMetaToPrices(
  clinicName: string,
  clinicId: string,
  prices: MaterialPriceConfig[]
): ClinicMaterialPriceRow[] {
  const key = clinicMaterialPriceKey(clinicName);
  const name = clinicName.trim();
  return prices.map((price) => {
    const materialId = price.id.startsWith('cmp_')
      ? materialIdFromClinicPriceDocId(price.id)
      : price.id;
    return {
      ...price,
      id: clinicMaterialPriceDocId(clinicId, materialId),
      clinicId,
      clinicKey: key,
      clinicName: name,
    };
  });
}

/**
 * Điền unitPrice/totalAmount từ bảng giá khi form chưa nhập (unitPrice/total = 0).
 */
export function applyCatalogPricesToOrderData<T extends {
  material?: string;
  teethCount?: number;
  unitPrice?: number;
  totalAmount?: number;
}>(data: T, priceConfigs: MaterialPriceConfig[]): T {
  const material = data.material || '';
  const lookedUp = getUnitPriceForMaterial(material, priceConfigs);
  const teethCount = data.teethCount !== undefined ? Math.max(0, Number(data.teethCount) || 0) : 1;
  const givenUnit = data.unitPrice !== undefined ? Math.max(0, Number(data.unitPrice) || 0) : 0;
  const givenTotal = data.totalAmount !== undefined ? Math.max(0, Number(data.totalAmount) || 0) : 0;
  const unitPrice = givenUnit > 0 ? givenUnit : lookedUp;
  const totalAmount = givenTotal > 0 ? givenTotal : unitPrice > 0 ? teethCount * unitPrice : 0;
  return { ...data, unitPrice, totalAmount };
}

/**
 * Extracts MM/YYYY from DD/MM/YYYY
 */
export function extractMonthYear(dateStr: string): string {
  if (!dateStr) return '11/2026';
  const parts = dateStr.trim().split(/[\/-]/);
  if (parts.length >= 3) {
    const mm = parts[1].trim().padStart(2, '0');
    let yyyy = parts[2].trim();
    if (yyyy.length === 2) yyyy = '20' + yyyy;
    const mNum = parseInt(mm, 10);
    const yNum = parseInt(yyyy, 10);
    if (mNum >= 1 && mNum <= 12 && yNum >= 2020 && yNum <= 2030) {
      return `${String(mNum).padStart(2, '0')}/${yNum}`;
    }
  }
  return '11/2026';
}

/**
 * Sort monthYear strings like "10/2026", "09/2026" in descending chronological order
 */
export function sortMonthYearsDesc(months: string[]): string[] {
  return [...months].sort((a, b) => {
    const [mA, yA] = a.split('/').map((n) => parseInt(n, 10));
    const [mB, yB] = b.split('/').map((n) => parseInt(n, 10));
    const valA = (yA || 0) * 100 + (mA || 0);
    const valB = (yB || 0) * 100 + (mB || 0);
    return valB - valA;
  });
}

/**
 * Get previous month string "MM/YYYY" from a given "MM/YYYY"
 */
export function getPreviousMonthYear(monthYear: string): string {
  const parts = monthYear.split('/');
  if (parts.length !== 2) return monthYear;
  let m = parseInt(parts[0], 10);
  let y = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(y)) return monthYear;
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${String(m).padStart(2, '0')}/${y}`;
}

/**
 * Format number as Vietnamese Dong (e.g. 12.500.000 ₫)
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0)) + ' ₫';
}

/**
 * Format number compactly (e.g. 45,2 Tr)
 */
export function formatCompactVND(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2).replace('.', ',')} Tỷ`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace('.', ',')} Tr`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K`;
  }
  return `${amount} ₫`;
}

