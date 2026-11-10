/**
 * Display name for a stored catalog material on warranty and invoice surfaces.
 *
 * Đắp mài rows are stored as the bare family ("Zirconia", "Cercon HT", …).
 * Never prefix/suffix the price-sheet column label. If a string already
 * includes that label, strip it so the family name is what the user sees.
 */
const DAP_MAI_LABEL = /đắp\s*mài/i;

export function displayMaterialName(material: string | null | undefined): string {
  const raw = String(material ?? '').trim();
  if (!raw) return '';
  if (!DAP_MAI_LABEL.test(raw)) return raw;
  return raw
    .replace(/[(\[]\s*đắp\s*mài\s*[)\]]/gi, ' ')
    .replace(/đắp\s*mài/gi, ' ')
    .replace(/[-–—:·|,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
