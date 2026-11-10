const DAP_MAI_LABEL = /đắp\s*mài/i;

/** Display name for a stored catalog material on the warranty API payload. */
export function displayMaterialName(material) {
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
