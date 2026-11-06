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

function firebaseErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') return code.toLowerCase();
  return '';
}

/** Strip nested Firebase/auth dumps so UI never shows secrets. */
export function formatSaveError(error: unknown, fallback = 'Không lưu được. Vui lòng thử lại.'): string {
  if (isBrowserOffline()) {
    return 'Đang offline — chưa lưu lên máy chủ. Kiểm tra mạng rồi bấm Thử lại.';
  }

  const code = firebaseErrorCode(error);

  // Prefer Firebase error codes over message substring matching.
  if (code === 'unauthenticated' || code.endsWith('/unauthenticated')) {
    return 'Phiên đăng nhập đã hết hoặc chưa xác thực. Đăng nhập lại rồi thử.';
  }
  if (code === 'permission-denied' || code.endsWith('/permission-denied')) {
    return 'Máy chủ từ chối ghi dữ liệu (permission-denied). Đây thường do quyền vai trò hoặc Firestore rules — không hẳn là hết phiên đăng nhập. Nếu vừa cập nhật app/audit, cần admin deploy lại rules.';
  }

  let message = '';
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;
  else message = fallback;

  // handleFirestoreError sometimes JSON.stringifies a blob — keep only the error field.
  try {
    const parsed = JSON.parse(message) as { error?: string; code?: string };
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.code === 'string' && parsed.code.trim()) {
        const nested = parsed.code.toLowerCase();
        if (nested.includes('unauthenticated')) {
          return 'Phiên đăng nhập đã hết hoặc chưa xác thực. Đăng nhập lại rồi thử.';
        }
        if (nested.includes('permission')) {
          return 'Máy chủ từ chối ghi dữ liệu (permission-denied). Đây thường do quyền vai trò hoặc Firestore rules — không hẳn là hết phiên đăng nhập. Nếu vừa cập nhật app/audit, cần admin deploy lại rules.';
        }
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) message = parsed.error;
    }
  } catch {
    // plain string
  }

  // Keep already-localized save messages (idempotent formatting).
  if (/thử lại|đăng nhập lại|permission-denied|từ chối ghi/i.test(message) &&
      /(offline|máy chủ|chưa lưu|kết nối|permission|quyền|phiên|rules)/i.test(message)) {
    // Still rewrite the old misleading combined message.
    if (/không có quyền lưu hoặc phiên đăng nhập đã hết/i.test(message)) {
      return 'Máy chủ từ chối ghi dữ liệu (permission-denied). Đây thường do quyền vai trò hoặc Firestore rules — không hẳn là hết phiên đăng nhập. Nếu vừa cập nhật app/audit, cần admin deploy lại rules.';
    }
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
  if (lower.includes('unauthenticated') || lower.includes('auth/requires-recent-login')) {
    return 'Phiên đăng nhập đã hết hoặc chưa xác thực. Đăng nhập lại rồi thử.';
  }
  if (lower.includes('permission-denied') || lower.includes('insufficient permissions') || lower.includes('permission')) {
    return 'Máy chủ từ chối ghi dữ liệu (permission-denied). Đây thường do quyền vai trò hoặc Firestore rules — không hẳn là hết phiên đăng nhập. Nếu vừa cập nhật app/audit, cần admin deploy lại rules.';
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
