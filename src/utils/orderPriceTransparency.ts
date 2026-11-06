/** Explain where an order amount suggestion comes from (clinic vs shared vs none). */

import type { ClinicMaterialPriceRow, MaterialPriceConfig } from '../types/dental';
import {
  clinicMaterialPriceKey,
  formatVND,
  getUnitPriceForMaterial,
  resolveMaterialPricesForClinic,
} from './financeUtils';

export type OrderPriceSource = 'clinic' | 'shared' | 'unavailable';

/** How the entered total relates to the current catalog suggestion. */
export type OrderAmountRelation =
  | 'matches'
  | 'session_manual'
  | 'loaded_diff'
  | 'no_suggestion'
  | 'empty';

export interface OrderPriceExplanation {
  source: OrderPriceSource;
  sourceLabel: string;
  unitPrice: number;
  quantity: number;
  suggestedTotal: number;
  hasSuggestion: boolean;
  /** e.g. "390.000 ₫ × 2 = 780.000 ₫" or unavailable copy */
  calculationText: string;
  relation: OrderAmountRelation;
  relationLabel: string | null;
  /** Concise helper under the amount field. */
  helpText: string;
}

function matchMaterial(
  materialName: string,
  configs: Array<Pick<MaterialPriceConfig, 'name' | 'materialKey' | 'unitPrice'>>
): (typeof configs)[number] | undefined {
  if (!materialName.trim()) return undefined;
  const lower = materialName.toLowerCase().trim();
  return configs.find(
    (row) => row.name.toLowerCase() === lower || row.materialKey.toLowerCase() === lower
  );
}

export function clinicRowForMaterial(
  clinicName: string,
  materialName: string,
  clinicRows: ClinicMaterialPriceRow[]
): ClinicMaterialPriceRow | undefined {
  const key = clinicMaterialPriceKey(clinicName);
  if (!key) return undefined;
  const forClinic = clinicRows.filter((row) => row.clinicKey === key);
  return matchMaterial(materialName, forClinic) as ClinicMaterialPriceRow | undefined;
}

/**
 * Price suggestion + source for order forms.
 * Unit/total follow resolveMaterialPricesForClinic + getUnitPriceForMaterial.
 * Source is per-material: clinic only when THIS material is in the clinic table;
 * never "clinic" merely because some other clinic rows exist.
 */
export function explainOrderAmountSuggestion(input: {
  clinicName: string;
  material: string;
  quantity: number;
  enteredAmount: number;
  sharedPrices: MaterialPriceConfig[];
  clinicRows?: ClinicMaterialPriceRow[];
  /** True when the user edited amount this session (not autofill). */
  sessionManual?: boolean;
  /**
   * True when the amount was loaded from a saved order and already differed
   * from the current catalog suggestion at hydrate (not a new session edit).
   */
  loadedDiffersFromSuggestion?: boolean;
}): OrderPriceExplanation {
  const clinicRows = input.clinicRows || [];
  const quantity = Math.max(0, Number(input.quantity) || 0);
  const entered = Math.max(0, Number(input.enteredAmount) || 0);

  const catalog = resolveMaterialPricesForClinic(
    input.clinicName,
    input.sharedPrices,
    clinicRows
  );
  const unitPrice = getUnitPriceForMaterial(input.material, catalog);
  const suggestedTotal = unitPrice > 0 ? quantity * unitPrice : 0;
  const hasSuggestion = unitPrice > 0 && Number.isFinite(suggestedTotal);

  const key = clinicMaterialPriceKey(input.clinicName);
  const clinicHasTable = Boolean(key && clinicRows.some((row) => row.clinicKey === key));
  const clinicHit = clinicRowForMaterial(input.clinicName, input.material, clinicRows);

  let source: OrderPriceSource = 'unavailable';
  if (hasSuggestion) {
    if (clinicHit && clinicHit.unitPrice === unitPrice) {
      source = 'clinic';
    } else if (!clinicHasTable) {
      source = 'shared';
    } else if (clinicHit) {
      // Clinic catalog row present (resolve uses clinic table wholesale).
      source = 'clinic';
    } else {
      // Resolved via shared-only path (no clinic table for this clinic).
      const sharedHit = matchMaterial(input.material, input.sharedPrices);
      source = sharedHit ? 'shared' : 'unavailable';
    }
  } else {
    source = 'unavailable';
  }

  const sourceLabel =
    source === 'clinic'
      ? 'Giá riêng nha khoa'
      : source === 'shared'
        ? 'Giá chung'
        : 'Chưa có đơn giá';

  const calculationText = hasSuggestion
    ? `${formatVND(unitPrice)} × ${quantity} = ${formatVND(suggestedTotal)}`
    : !input.clinicName.trim() || !input.material.trim()
      ? 'Chọn nha khoa và dòng sứ để xem đơn giá.'
      : 'Chưa có đơn giá cho tổ hợp nha khoa / dòng sứ này.';

  let relation: OrderAmountRelation = 'empty';
  let relationLabel: string | null = null;
  if (entered <= 0 && !hasSuggestion) {
    relation = 'empty';
  } else if (hasSuggestion && entered === suggestedTotal) {
    relation = 'matches';
  } else if (input.sessionManual && hasSuggestion && entered !== suggestedTotal) {
    relation = 'session_manual';
    relationLabel = 'Đã sửa tay';
  } else if (
    input.loadedDiffersFromSuggestion &&
    hasSuggestion &&
    entered !== suggestedTotal &&
    !input.sessionManual
  ) {
    relation = 'loaded_diff';
    relationLabel = 'Khác giá đề xuất';
  } else if (hasSuggestion && entered !== suggestedTotal && entered > 0) {
    // Fallback: differ without explicit flags (e.g. partial state)
    relation = input.sessionManual ? 'session_manual' : 'loaded_diff';
    relationLabel = input.sessionManual ? 'Đã sửa tay' : 'Khác giá đề xuất';
  } else if (!hasSuggestion && entered > 0) {
    relation = 'no_suggestion';
    relationLabel = input.sessionManual ? 'Đã sửa tay' : null;
  } else if (hasSuggestion && entered === suggestedTotal) {
    relation = 'matches';
  }

  const parts: string[] = [];
  if (source !== 'unavailable') {
    parts.push(sourceLabel);
  }
  if (hasSuggestion) {
    parts.push(calculationText);
  } else {
    parts.push(calculationText);
  }
  const helpText = parts.filter(Boolean).join(' · ');

  return {
    source,
    sourceLabel,
    unitPrice: hasSuggestion ? unitPrice : 0,
    quantity,
    suggestedTotal: hasSuggestion ? suggestedTotal : 0,
    hasSuggestion,
    calculationText,
    relation,
    relationLabel,
    helpText,
  };
}

/** Exposed for tests: whether a material's resolved unit came from the clinic table. */
export function resolvePriceSourceForMaterial(
  clinicName: string,
  material: string,
  sharedPrices: MaterialPriceConfig[],
  clinicRows: ClinicMaterialPriceRow[] = []
): OrderPriceSource {
  return explainOrderAmountSuggestion({
    clinicName,
    material,
    quantity: 1,
    enteredAmount: 0,
    sharedPrices,
    clinicRows,
  }).source;
}

