/** Field-level before/after helpers for admin change history. */

export type ChangeAction = 'create' | 'update' | 'delete';

export interface FieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

/** Metadata / identity noise skipped in readable diffs. */
export const DIFF_SKIP_FIELDS = new Set([
  'id',
  'ownerId',
  'createdAt',
  'updatedAt',
  'uid',
  'workspaceOwnerId',
]);

/** Never persist these values in history payloads. */
export const REDACT_FIELDS = new Set([
  'password',
  'bankAccountNumber',
  'apiKey',
  'token',
  'secret',
  'credential',
]);

const MAX_VALUE_LEN = 300;

/**
 * Must stay in sync with firestore.rules `validHistoryChangesList` size bound.
 * Emulator ceiling for full per-item validation + order write batch ≈ 7.
 * Display diffs are capped here; beforeSnapshot/afterSnapshot stay lossless for undo.
 */
export const HISTORY_CHANGES_RULES_MAX = 7;
/** Sentinel field name when display diffs are truncated (still a valid change item). */
export const HISTORY_MORE_FIELD = '_more';
const HISTORY_DETAILED_MAX = HISTORY_CHANGES_RULES_MAX - 1; // 6 detailed + optional sentinel

export function stringifyHistoryValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.length > MAX_VALUE_LEN ? `${trimmed.slice(0, MAX_VALUE_LEN)}…` : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === 'string' || typeof item === 'number' ? String(item) : JSON.stringify(item)))
      .join(', ');
    return joined.length > MAX_VALUE_LEN ? `${joined.slice(0, MAX_VALUE_LEN)}…` : joined;
  }
  try {
    const json = JSON.stringify(value);
    if (!json) return null;
    return json.length > MAX_VALUE_LEN ? `${json.slice(0, MAX_VALUE_LEN)}…` : json;
  } catch {
    return String(value).slice(0, MAX_VALUE_LEN);
  }
}

export function sanitizeHistoryRecord(
  record: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!record) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (REDACT_FIELDS.has(key)) {
      if (value !== undefined && value !== null && String(value).length > 0) {
        out[key] = '•••';
      }
      continue;
    }
    if (DIFF_SKIP_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export function buildFieldChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  action: ChangeAction
): FieldChange[] {
  const left = sanitizeHistoryRecord(before) || {};
  const right = sanitizeHistoryRecord(after) || {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const changes: FieldChange[] = [];
  let omitted = 0;

  for (const field of [...keys].sort()) {
    if (DIFF_SKIP_FIELDS.has(field) || REDACT_FIELDS.has(field) && action !== 'delete') {
      // Still show redacted marker when value exists on delete/create edges.
    }
    const beforeRaw = left[field];
    const afterRaw = right[field];
    const beforeText = stringifyHistoryValue(
      REDACT_FIELDS.has(field) && beforeRaw !== undefined ? '•••' : beforeRaw
    );
    const afterText = stringifyHistoryValue(
      REDACT_FIELDS.has(field) && afterRaw !== undefined ? '•••' : afterRaw
    );
    if (beforeText === afterText) continue;
    if (action === 'create' && afterText === null) continue;
    if (action === 'delete' && beforeText === null) continue;
    if (changes.length >= HISTORY_DETAILED_MAX) {
      omitted += 1;
      continue;
    }
    changes.push({ field, before: beforeText, after: afterText });
  }
  if (omitted > 0) {
    changes.push({
      field: HISTORY_MORE_FIELD,
      before: null,
      after: `+${omitted} trường khác`,
    });
  }
  return changes;
}

export const ENTITY_LABELS: Record<string, string> = {
  orders: 'Đơn hàng',
  debtPayments: 'Thu công nợ',
  cashflows: 'Thu chi',
  deliveries: 'Giao vận',
  materialPrices: 'Bảng giá chung',
  clinicMaterialPrices: 'Bảng giá nha khoa',
  clinicDebts: 'Công nợ',
  clinicPartners: 'Đối tác nha khoa',
  settings: 'Cấu hình labo',
  employeePayrolls: 'Bảng lương',
  saleCommissions: 'Hoa hồng sale',
  profitMonthlyCosts: 'Chi phí lợi nhuận',
  users: 'Người dùng',
};

export function buildEntityLabel(
  entityType: string,
  record: Record<string, unknown> | null | undefined,
  entityId: string
): string {
  if (!record) return `${ENTITY_LABELS[entityType] || entityType} · ${entityId}`;
  if (entityType === 'orders') {
    const patient = String(record.patientName || '').trim();
    const code = String(record.warrantyCode || '').trim();
    return [patient, code].filter(Boolean).join(' · ') || entityId;
  }
  if (entityType === 'cashflows') {
    return String(record.title || record.category || entityId);
  }
  if (entityType === 'debtPayments' || entityType === 'clinicDebts' || entityType === 'clinicPartners') {
    return String(record.clinicName || record.name || entityId);
  }
  if (entityType === 'deliveries') {
    return [record.patientName, record.clinicName].filter(Boolean).join(' · ') || entityId;
  }
  if (entityType === 'materialPrices' || entityType === 'clinicMaterialPrices') {
    const clinic = record.clinicName ? `${record.clinicName} · ` : '';
    return `${clinic}${record.name || record.materialKey || entityId}`;
  }
  if (entityType === 'settings') return String(record.labName || 'Cấu hình labo');
  if (entityType === 'employeePayrolls') {
    return [record.employeeName, record.monthYear].filter(Boolean).join(' · ') || entityId;
  }
  if (entityType === 'saleCommissions') {
    return [record.clinicName, record.saleId].filter(Boolean).join(' · ') || entityId;
  }
  if (entityType === 'profitMonthlyCosts') {
    return [record.monthYear, record.kind].filter(Boolean).join(' · ') || entityId;
  }
  if (entityType === 'users') {
    return String(record.displayName || record.email || entityId);
  }
  return String(record.title || record.name || entityId);
}

export function actionLabelVi(action: ChangeAction): string {
  if (action === 'create') return 'Tạo mới';
  if (action === 'delete') return 'Xóa';
  return 'Cập nhật';
}
