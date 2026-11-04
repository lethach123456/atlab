import {
  MaterialPriceConfig,
  DentalOrder,
  DebtPaymentRecord,
  ClinicDebtRecord,
  CashflowTransaction,
  DeliveryRecord,
  LabProfileConfig,
} from '../types/dental';

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
 * Danh mục Dòng Sứ đầy đủ đọc từ dữ liệu Doanh Thu Tháng Này (T11) & Tháng 10
 */
export const DEFAULT_MATERIAL_PRICES: MaterialPriceConfig[] = [
  {
    id: 'mat_full_zirco_razor',
    materialKey: 'full zirco razor',
    name: 'Full zirco razor',
    category: 'Zirconia Nguyên Khối (Full)',
    origin: 'Hàn Quốc / Đức',
    unitPrice: 520000,
    retailSuggestedPrice: 3000000,
    defaultWarranty: '15 năm',
    strengthMpa: 1200,
  },
  {
    id: 'mat_suon_zirco_razor',
    materialKey: 'sườn zirco razor',
    name: 'Sườn zirco Razor',
    category: 'Sườn Sứ Zirconia',
    origin: 'Hàn Quốc / Đức',
    unitPrice: 480000,
    retailSuggestedPrice: 2500000,
    defaultWarranty: '15 năm',
    strengthMpa: 1200,
  },
  {
    id: 'mat_veneer_zirco_razor',
    materialKey: 'veneer zirco razor',
    name: 'Veneer zirco Razor',
    category: 'Mặt Dán Sứ Veneer',
    origin: 'Hàn Quốc / Đức',
    unitPrice: 550000,
    retailSuggestedPrice: 3200000,
    defaultWarranty: '15 năm',
    strengthMpa: 1150,
  },
  {
    id: 'mat_full_zirco_razor_ipl',
    materialKey: 'full zirco razor trên ipl',
    name: 'Full zirco razor trên ipl',
    category: 'Phục Hình Trên Implant',
    origin: 'Hàn Quốc / Đức',
    unitPrice: 950000,
    retailSuggestedPrice: 5500000,
    defaultWarranty: '15 năm',
    strengthMpa: 1250,
  },
  {
    id: 'mat_zirconia_std',
    materialKey: 'zirconia',
    name: 'Zirconia',
    category: 'Zirconia Toàn Sứ',
    origin: 'Đức',
    unitPrice: 500000,
    retailSuggestedPrice: 2800000,
    defaultWarranty: '15 năm',
    strengthMpa: 1150,
  },
  {
    id: 'mat_zirconia_razor',
    materialKey: 'zirconia (razor)',
    name: 'Zirconia (RAZOR)',
    category: 'Zirconia Cao Cấp',
    origin: 'Đức / Hàn Quốc',
    unitPrice: 520000,
    retailSuggestedPrice: 3000000,
    defaultWarranty: '10 - 15 năm',
    strengthMpa: 1200,
  },
  {
    id: 'mat_cercon',
    materialKey: 'cercon',
    name: 'CERCON',
    category: 'Zirconia Chính Hãng',
    origin: 'Đức (Dentsply Sirona)',
    unitPrice: 850000,
    retailSuggestedPrice: 5000000,
    defaultWarranty: '15 năm',
    strengthMpa: 1200,
  },
  {
    id: 'mat_full_cercon',
    materialKey: 'full cercon',
    name: 'full cercon',
    category: 'Cercon Nguyên Khối',
    origin: 'Đức (Dentsply Sirona)',
    unitPrice: 850000,
    retailSuggestedPrice: 5000000,
    defaultWarranty: '15 năm',
    strengthMpa: 1200,
  },
  {
    id: 'mat_veneer_cercon',
    materialKey: 'veneer cercon',
    name: 'Veneer Cercon',
    category: 'Mặt Dán Sứ Cercon',
    origin: 'Đức (Dentsply Sirona)',
    unitPrice: 900000,
    retailSuggestedPrice: 5500000,
    defaultWarranty: '15 năm',
    strengthMpa: 1150,
  },
  {
    id: 'mat_suon_cercon',
    materialKey: 'sườn cercon',
    name: 'Sườn cercon',
    category: 'Sườn Sứ Cercon',
    origin: 'Đức (Dentsply Sirona)',
    unitPrice: 750000,
    retailSuggestedPrice: 4500000,
    defaultWarranty: '15 năm',
    strengthMpa: 1200,
  },
  {
    id: 'mat_full_ddbio',
    materialKey: 'full ddbio',
    name: 'full ddbio',
    category: 'Zirconia Sinh Học DDBio',
    origin: 'Đức (Dental Direkt)',
    unitPrice: 650000,
    retailSuggestedPrice: 3800000,
    defaultWarranty: '15 năm',
    strengthMpa: 1100,
  },
  {
    id: 'mat_full_orodent',
    materialKey: 'full orodent',
    name: 'Full orodent',
    category: 'Zirconia Cao Cấp Orodent',
    origin: 'Ý (Orodent)',
    unitPrice: 1200000,
    retailSuggestedPrice: 7500000,
    defaultWarranty: '15 năm - Trọn đời',
    strengthMpa: 1400,
  },
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
  {
    id: 'mat_ziconia_ipl',
    materialKey: 'ziconia ipl',
    name: 'Ziconia IPL',
    category: 'Phục Hình Trên Implant',
    origin: 'Đức / Hàn Quốc',
    unitPrice: 950000,
    retailSuggestedPrice: 5500000,
    defaultWarranty: '10 - 15 năm',
    strengthMpa: 1250,
  },
  {
    id: 'mat_implant',
    materialKey: 'implant zirconia',
    name: 'Implant Zirconia',
    category: 'Phục Hình Trên Implant',
    origin: 'Pháp / Châu Âu',
    unitPrice: 1250000,
    retailSuggestedPrice: 7500000,
    defaultWarranty: '10 - 15 năm',
    strengthMpa: 1300,
  },
];

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

