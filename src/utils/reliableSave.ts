/** Shared helpers for save UX that waits for real server acknowledgement. */

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function newStableId(prefix: string): string {
  const clean = prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24) || 'doc';
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${clean}_${uuid}`.slice(0, 128);
}

/** Strip nested Firebase/auth dumps so UI never shows secrets. */
export function formatSaveError(error: unknown, fallback = 'Không lưu được. Vui lòng thử lại.'): string {
  if (isBrowserOffline()) {
    return 'Đang offline — chưa lưu lên máy chủ. Kiểm tra mạng rồi bấm Thử lại.';
  }
  let message = '';
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;
  else message = fallback;

  // handleFirestoreError sometimes JSON.stringifies a blob — keep only the error field.
  try {
    const parsed = JSON.parse(message) as { error?: string; code?: string };
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.error === 'string' && parsed.error.trim()) message = parsed.error;
      else if (typeof parsed.code === 'string') message = parsed.code;
    }
  } catch {
    // plain string
  }

  // Keep already-localized save messages (idempotent formatting).
  if (/thử lại/i.test(message) && /(offline|máy chủ|chưa lưu|kết nối)/i.test(message)) {
    return message.trim();
  }

  const lower = message.toLowerCase();
  if (
    lower.includes('offline') ||
    lower.includes('unavailable') ||
    lower.includes('network') ||
    lower.includes('failed to fetch')
  ) {
    return 'Mất kết nối máy chủ — chưa lưu. Kiểm tra mạng rồi bấm Thử lại.';
  }
  if (lower.includes('permission') || lower.includes('unauthenticated')) {
    return 'Không có quyền lưu hoặc phiên đăng nhập đã hết. Đăng nhập lại rồi thử.';
  }
  // Never surface tokens/emails from nested dumps.
  message = message
    .replace(/ghp_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, '[redacted]');
  if (message.length > 220) message = `${message.slice(0, 220)}…`;
  return message.trim() || fallback;
}

export function assertOnlineForSave(): void {
  if (isBrowserOffline()) {
    throw new Error('Đang offline — chưa lưu lên máy chủ. Kiểm tra mạng rồi bấm Thử lại.');
  }
}

export function reuseOrCreateStableId(prefix: string, existing?: string | null): string {
  if (existing && /^[a-zA-Z0-9_-]{1,128}$/.test(existing)) return existing;
  return newStableId(prefix);
}

/** Snapshot of form field values for dirty-dismiss checks. */
export function formSnapshot(values: Record<string, string | number | boolean | null | undefined>): string {
  const keys = Object.keys(values).sort();
  return JSON.stringify(keys.map((key) => [key, values[key] ?? '']));
}
