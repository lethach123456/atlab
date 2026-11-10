const VARIANT_LABEL = /đắp\s*mài|hoàn\s*thiện/i;
const ZAROC_DISPLAY_NAME = 'Phôi đơn lớp Zaroc';
const ZAROC_TOKEN_ALIASES = new Set(['razor', 'unc']);

/** Fold for comparison: lowercase, strip accents, drop whitespace. */
function foldForMatch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, '');
}

/** Lowercase and strip accents, keeping punctuation so tokens can be split. */
function foldKeepSeparators(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi');
}

function materialTokens(value) {
  return foldKeepSeparators(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isZarocFamilyMaterial(material) {
  if (foldForMatch(material).includes('zaroc')) return true;
  return materialTokens(material).some((token) => ZAROC_TOKEN_ALIASES.has(token));
}

/** Display name for a stored catalog material on the warranty API payload. */
export function displayMaterialName(material) {
  const raw = String(material ?? '').trim();
  if (!raw) return '';
  if (isZarocFamilyMaterial(raw)) return ZAROC_DISPLAY_NAME;
  if (!VARIANT_LABEL.test(raw)) return raw;
  return raw
    .replace(/[(\[]\s*(?:đắp\s*mài|hoàn\s*thiện)\s*[)\]]/gi, ' ')
    .replace(/(?:đắp\s*mài|hoàn\s*thiện)/gi, ' ')
    .replace(/[-–—:·|,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
