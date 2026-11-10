/**
 * Display name for a stored catalog material on warranty and invoice surfaces.
 *
 * Hoàn thiện (legacy: Đắp mài) rows are stored as the bare family
 * ("Zirconia", "Cercon HT", …). Never prefix/suffix the price-sheet column
 * label. If a string already includes either label, strip it so the family
 * name is what the user sees.
 */
const VARIANT_LABEL = /đắp\s*mài|hoàn\s*thiện/i;

export function displayMaterialName(material: string | null | undefined): string {
  const raw = String(material ?? '').trim();
  if (!raw) return '';
  if (!VARIANT_LABEL.test(raw)) return raw;
  return raw
    .replace(/[(\[]\s*(?:đắp\s*mài|hoàn\s*thiện)\s*[)\]]/gi, ' ')
    .replace(/(?:đắp\s*mài|hoàn\s*thiện)/gi, ' ')
    .replace(/[-–—:·|,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
