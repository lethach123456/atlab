import { DentalOrder } from '../types/dental';
import { parseTeethNotation } from './fdiTeeth';
import { getUnitPriceForMaterial, extractMonthYear } from './financeUtils';

/**
 * Robust CSV parser that handles quotes with commas, newlines within quotes,
 * and varying column counts.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Standardize warranty years into a numeric value
 */
export function extractWarrantyYears(text: string): number {
  if (!text) return 10;
  const lower = text.toLowerCase();
  if (lower.includes('trọn đời') || lower.includes('vĩnh viễn')) return 99;
  const match = lower.match(/(\d+)\s*năm/);
  if (match) return parseInt(match[1], 10);
  const numOnly = parseInt(text.replace(/\D/g, ''), 10);
  if (!isNaN(numOnly) && numOnly > 0 && numOnly <= 100) return numOnly;
  return 10;
}

const CODES_YEAR_2024 = new Set(['NS50380', 'NS50068']);
const CODES_YEAR_2025 = new Set([
  'NS60017',
  'NS60018',
  'NS60019',
  'NS60100',
  'UC10880',
  'NS70195',
  'UC10833',
  'NS70139',
  'NS70127',
  'NS70140',
]);

/**
 * Normalize date into standard DD/MM/YYYY and fix spreadsheet autofill year typos
 */
export function normalizeDate(
  dateStr: string,
  rowIndex = 0,
  warrantyCode = '',
  fallbackDate = '01/10/2026'
): string {
  if (!dateStr || !dateStr.trim()) {
    return fallbackDate;
  }
  let s = dateStr.trim().replace(/\s+/g, '');
  if (s.includes('24/062026')) return '24/06/2026';
  if (s.includes('1019/2024')) return '19/10/2024';
  if (s.includes('31/8/3024')) return '31/08/2024';

  const parts = s.split(/[\/-]/);
  if (parts.length >= 2) {
    const dayNum = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10);
    if (isNaN(dayNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return fallbackDate;
    }
    const day = String(dayNum).padStart(2, '0');
    const month = String(monthNum).padStart(2, '0');
    let year = parts[2] ? parts[2].replace(/\D/g, '') : '';
    if (year.length === 2) year = '20' + year;

    const upperCode = (warrantyCode || '').trim().toUpperCase();
    if (CODES_YEAR_2024.has(upperCode)) {
      year = '2024';
    } else if (CODES_YEAR_2025.has(upperCode)) {
      year = '2025';
    } else if (!year || year.length !== 4) {
      if (rowIndex > 955) year = '2026';
      else if (rowIndex > 560) year = '2025';
      else year = '2024';
    } else {
      const yNum = parseInt(year, 10);
      // Fix Excel autofill year increments (e.g., 02/11/2027, 03/11/2027 -> 02/11/2026, 03/11/2026)
      if (rowIndex <= 560 && yNum > 2024) {
        year = '2024';
      } else if (rowIndex > 560 && rowIndex <= 955 && yNum > 2025) {
        year = '2025';
      } else if (rowIndex > 955) {
        if (yNum > 2026) {
          year = '2026';
        } else if (yNum === 2025) {
          year = '2026';
        }
      }
    }

    return `${day}/${month}/${year}`;
  }
  return fallbackDate;
}

let lastParsedOrderDate = '23/04/2024';

/**
 * Normalizes raw CSV row into a structured DentalOrder
 */
export function parseDentalOrderRow(row: string[], index: number): DentalOrder | null {
  if (index === 1) {
    lastParsedOrderDate = '23/04/2024';
  }

  // If row is entirely empty or only has default tooth form filler
  if (!row || row.length === 0 || row.every((c) => !c || c.trim() === '')) {
    return null;
  }

  const code = row[0]?.trim() || '';
  const patientName = row[1]?.trim() || '';
  const phone = row[2]?.trim() || '';
  let clinicName = row[3]?.trim() || '';
  const clinicAddress = row[4]?.trim() || '';

  if (!patientName && !clinicName && !code) {
    return null;
  }

  // Find date column index in columns >= 6 (standard date position)
  let dateIdx = -1;
  for (let i = row.length - 1; i >= 6; i--) {
    const val = row[i]?.trim();
    if (val && /\d{1,2}\s*\/\s*\d{1,2}/.test(val)) {
      dateIdx = i;
      break;
    }
  }

  let material = '';
  let warrantyPeriod = '10 năm';
  let rawOrderDate = '';
  let teeth = '';
  let toothForm = 'Form tự nhiên';
  let notes = '';

  if (dateIdx >= 6) {
    rawOrderDate = row[dateIdx]?.trim() || '';
    material = row[5]?.trim() || 'Zirconia';

    const warrantyIdx = dateIdx - 1;
    warrantyPeriod = row[warrantyIdx]?.trim() || '10 năm';

    if (dateIdx === 8 && row[6] === '1' && row[7]?.includes('năm')) {
      warrantyPeriod = '5 năm';
    }

    if (row.length > dateIdx + 1) {
      teeth = row[dateIdx + 1]?.trim() || '';
    }
    if (row.length > dateIdx + 2) {
      toothForm = row[dateIdx + 2]?.trim() || 'Form tự nhiên';
    }
    if (row.length > dateIdx + 3) {
      notes = row.slice(dateIdx + 3).filter(Boolean).join(' ').trim();
    }
  } else {
    material = row[5]?.trim() || 'Zirconia';
    warrantyPeriod = row[6]?.trim() || '10 năm';
    const col7 = row[7]?.trim() || '';
    if (/\d{1,2}\s*\/\s*\d{1,2}/.test(col7)) {
      rawOrderDate = col7;
    } else if (/\d{1,2}\s*\/\s*\d{1,2}/.test(patientName)) {
      rawOrderDate = patientName;
    } else {
      rawOrderDate = '';
    }
    teeth = row[8]?.trim() || '';
    toothForm = row[9]?.trim() || 'Form tự nhiên';
    notes = row.slice(10).filter(Boolean).join(' ').trim();
  }

  if (patientName.includes('/') && !clinicName) {
    clinicName = row[3] || 'Nha Khoa Đối Tác';
  }

  let cleanMaterial = material.trim();
  if (!cleanMaterial || cleanMaterial === ',') cleanMaterial = 'Zirconia';
  if (cleanMaterial.toLowerCase().includes('razor mutilayer'))
    cleanMaterial = 'Zirconia (RAZOR Multilayer)';
  else if (
    cleanMaterial.toLowerCase().includes('mutilayer') ||
    cleanMaterial.toLowerCase().includes('multilayer')
  )
    cleanMaterial = 'Zirconia Multilayer';
  else if (
    cleanMaterial.toLowerCase().includes('đơn lớp razor') ||
    cleanMaterial.toLowerCase().includes('phôi đơn lớp')
  )
    cleanMaterial = 'Phôi Đơn Lớp Razor';

  let cleanForm = toothForm.trim().replace(/^From\s+/i, 'Form ');
  if (!cleanForm) cleanForm = 'Form tự nhiên';

  const finalCode = code || `AT${String(index + 1000).padStart(5, '0')}`;
  const finalPatient = patientName || 'Khách Hàng';
  const finalClinic = clinicName || 'Nha Khoa Đối Tác';

  const normalizedDate = normalizeDate(
    rawOrderDate,
    index,
    finalCode,
    lastParsedOrderDate
  );
  lastParsedOrderDate = normalizedDate;

  const teethInfo = parseTeethNotation(teeth);
  const monthYear = extractMonthYear(normalizedDate);
  const teethCount = teethInfo.count || 1;
  const unitPrice = 0;
  const totalAmount = 0;

  return {
    id: `order_${index}_${finalCode.replace(/[^a-zA-Z0-9]/g, '')}`,
    warrantyCode: finalCode,
    patientName: finalPatient,
    phone: phone.replace(/[\s.-]/g, ''),
    clinicName: finalClinic,
    clinicAddress: clinicAddress || 'Đà Nẵng',
    material: cleanMaterial,
    warrantyPeriod: warrantyPeriod || '10 năm',
    warrantyYears: extractWarrantyYears(warrantyPeriod),
    orderDate: normalizedDate,
    monthYear,
    teeth: teeth || '1 răng',
    teethCount,
    toothForm: cleanForm,
    unitPrice,
    totalAmount,
    notes: notes,
    status: 'completed',
    paymentStatus: 'unpaid',
    createdAt: Date.now() - index * 100000,
  };
}
