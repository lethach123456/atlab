const VARIANT_LABEL = /đắp\s*mài|hoàn\s*thiện/i;
const ZAROC_DISPLAY_NAME = 'Phôi đơn lớp Zaroc';

/** Fold for comparison: lowercase, strip accents, drop whitespace. */
function foldForMatch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, '');
}

/** Display name for a stored catalog material on the warranty API payload. */
export function displayMaterialName(material) {
  const raw = String(material ?? '').trim();
  if (!raw) return '';
  if (foldForMatch(raw).includes('zaroc')) return ZAROC_DISPLAY_NAME;
  if (!VARIANT_LABEL.test(raw)) return raw;
  return raw
    .replace(/[(\[]\s*(?:đắp\s*mài|hoàn\s*thiện)\s*[)\]]/gi, ' ')
    .replace(/(?:đắp\s*mài|hoàn\s*thiện)/gi, ' ')
    .replace(/[-–—:·|,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
