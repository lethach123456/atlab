/** Pure helpers for safe admin undo of change-history entries. */

import {
  DIFF_SKIP_FIELDS,
  REDACT_FIELDS,
  type ChangeAction,
} from './changeDiff';

export const UNDO_UNSUPPORTED_ENTITIES = new Set(['users']);

const SNAPSHOT_MAX_FIELDS = 60;
const SNAPSHOT_MAX_STRING = 2000;
const SNAPSHOT_MAX_LIST = 40;
const SNAPSHOT_MAX_LIST_ITEM = 250;

export type UndoSnapshot = Record<string, unknown>;

export interface RollbackPlan {
  canUndo: boolean;
  undoBlockReason: string;
  beforeSnapshot: UndoSnapshot | null;
  afterSnapshot: UndoSnapshot | null;
}

export interface UndoConflict {
  field: string;
  expected: unknown;
  actual: unknown;
}

function cloneSnapshotValue(value: unknown): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { ok: false, reason: 'Giá trị số không hợp lệ để hoàn tác.' };
    }
    return { ok: true, value };
  }
  if (typeof value === 'string') {
    if (value.length > SNAPSHOT_MAX_STRING) {
      return { ok: false, reason: 'Trường quá dài nên không lưu đủ để hoàn tác an toàn.' };
    }
    return { ok: true, value };
  }
  if (Array.isArray(value)) {
    if (value.length > SNAPSHOT_MAX_LIST) {
      return { ok: false, reason: 'Danh sách quá dài nên không lưu đủ để hoàn tác an toàn.' };
    }
    const out: unknown[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        if (item.length > SNAPSHOT_MAX_LIST_ITEM) {
          return { ok: false, reason: 'Phần tử danh sách quá dài nên không hoàn tác an toàn.' };
        }
        out.push(item);
      } else if (typeof item === 'number' || typeof item === 'boolean' || item === null) {
        out.push(item);
      } else {
        return { ok: false, reason: 'Kiểu phần tử danh sách không hỗ trợ hoàn tác.' };
      }
    }
    return { ok: true, value: out };
  }
  return { ok: false, reason: 'Kiểu dữ liệu lồng nhau không hỗ trợ hoàn tác an toàn.' };
}

export interface UndoSnapshotBuild {
  snapshot: UndoSnapshot | null;
  incompleteReason: string;
  /** Redacted keys present on the source record (never stored in snapshot). */
  omittedRedactedKeys: string[];
}

function listRedactedKeys(record: Record<string, unknown> | null | undefined): string[] {
  if (!record) return [];
  return Object.keys(record)
    .filter((key) => REDACT_FIELDS.has(key) && record[key] !== undefined)
    .sort();
}

/** Compare redacted field values without depending on valuesEqualForUndo order. */
function redactedValueEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (typeof a === 'number' && typeof b === 'number') return a === b || (Number.isNaN(a) && Number.isNaN(b));
  return false;
}

function redactedFieldsDiffer(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): boolean {
  const keys = new Set([...listRedactedKeys(before), ...listRedactedKeys(after)]);
  for (const key of keys) {
    const left = before?.[key];
    const right = after?.[key];
    if (!redactedValueEqual(left === undefined ? null : left, right === undefined ? null : right)) {
      return true;
    }
  }
  return false;
}

/**
 * Build a bounded snapshot for undo. Redacted keys are never stored.
 * Callers must treat create/delete with omitted redacts as non-undoable.
 */
export function buildUndoSnapshot(
  record: Record<string, unknown> | null | undefined
): UndoSnapshotBuild {
  if (!record) return { snapshot: null, incompleteReason: '', omittedRedactedKeys: [] };
  const omittedRedactedKeys = listRedactedKeys(record);
  const snapshot: UndoSnapshot = {};
  let fields = 0;
  for (const [key, value] of Object.entries(record)) {
    if (DIFF_SKIP_FIELDS.has(key)) continue;
    if (REDACT_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    const cloned = cloneSnapshotValue(value);
    if (!cloned.ok) {
      return { snapshot: null, incompleteReason: cloned.reason, omittedRedactedKeys };
    }
    snapshot[key] = cloned.value;
    fields += 1;
    if (fields > SNAPSHOT_MAX_FIELDS) {
      return {
        snapshot: null,
        incompleteReason: 'Quá nhiều trường thay đổi nên không lưu đủ để hoàn tác an toàn.',
        omittedRedactedKeys,
      };
    }
  }
  return { snapshot, incompleteReason: '', omittedRedactedKeys };
}

const DESTRUCTIVE_REDACT_BLOCK =
  'Có trường bảo mật/nhạy cảm nên không hoàn tác tạo hoặc xóa an toàn (snapshot thiếu trường đó).';
const REDACT_CHANGED_BLOCK =
  'Trường bảo mật đã đổi trong lần sửa này nên không hoàn tác an toàn được.';
const NO_SAFE_FIELD_BLOCK =
  'Không có trường an toàn để hoàn tác (chỉ đổi trường nhạy cảm hoặc không có khác biệt).';

/** UI copy when update undo omits unchanged secrets (merge preserves them). */
export const PARTIAL_UPDATE_RESTORE_NOTE =
  'Hoàn tác một phần: chỉ đảo các trường đã theo dõi; trường bảo mật (nếu có) được giữ nguyên trên máy chủ.';

export function buildRollbackPlan(
  action: ChangeAction,
  entityType: string,
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): RollbackPlan {
  if (UNDO_UNSUPPORTED_ENTITIES.has(entityType)) {
    return {
      canUndo: false,
      undoBlockReason: 'Không hỗ trợ hoàn tác thay đổi tài khoản / quyền / bảo mật.',
      beforeSnapshot: null,
      afterSnapshot: null,
    };
  }

  const beforeBuilt = buildUndoSnapshot(before);
  const afterBuilt = buildUndoSnapshot(after);
  if (beforeBuilt.incompleteReason) {
    return {
      canUndo: false,
      undoBlockReason: beforeBuilt.incompleteReason,
      beforeSnapshot: null,
      afterSnapshot: null,
    };
  }
  if (afterBuilt.incompleteReason) {
    return {
      canUndo: false,
      undoBlockReason: afterBuilt.incompleteReason,
      beforeSnapshot: null,
      afterSnapshot: null,
    };
  }

  const omittedAny =
    beforeBuilt.omittedRedactedKeys.length > 0 || afterBuilt.omittedRedactedKeys.length > 0;

  // Destructive undo needs a complete document picture — refuse if secrets were omitted.
  if (action === 'create' || action === 'delete') {
    if (omittedAny) {
      return {
        canUndo: false,
        undoBlockReason: DESTRUCTIVE_REDACT_BLOCK,
        beforeSnapshot: null,
        afterSnapshot: null,
      };
    }
  }

  if (action === 'update') {
    if (!beforeBuilt.snapshot || !afterBuilt.snapshot) {
      return {
        canUndo: false,
        undoBlockReason: 'Thiếu snapshot trước/sau nên không hoàn tác được cập nhật này.',
        beforeSnapshot: beforeBuilt.snapshot,
        afterSnapshot: afterBuilt.snapshot,
      };
    }
    // Secrets must be unchanged; update() merge leaves them untouched.
    if (redactedFieldsDiffer(before, after)) {
      return {
        canUndo: false,
        undoBlockReason: REDACT_CHANGED_BLOCK,
        beforeSnapshot: null,
        afterSnapshot: null,
      };
    }
    const safeChanges = changedFieldsToVerify(beforeBuilt.snapshot, afterBuilt.snapshot);
    if (safeChanges.length === 0) {
      return {
        canUndo: false,
        undoBlockReason: NO_SAFE_FIELD_BLOCK,
        beforeSnapshot: beforeBuilt.snapshot,
        afterSnapshot: afterBuilt.snapshot,
      };
    }
    return {
      canUndo: true,
      undoBlockReason: '',
      beforeSnapshot: beforeBuilt.snapshot,
      afterSnapshot: afterBuilt.snapshot,
    };
  }

  if (action === 'create') {
    if (!afterBuilt.snapshot) {
      return {
        canUndo: false,
        undoBlockReason: 'Thiếu trạng thái đầy đủ lúc tạo nên không hoàn tác (xóa) an toàn.',
        beforeSnapshot: null,
        afterSnapshot: null,
      };
    }
    return {
      canUndo: true,
      undoBlockReason: '',
      beforeSnapshot: null,
      afterSnapshot: afterBuilt.snapshot,
    };
  }

  // delete
  if (!beforeBuilt.snapshot) {
    return {
      canUndo: false,
      undoBlockReason: 'Thiếu trạng thái đầy đủ lúc xóa nên không khôi phục an toàn.',
      beforeSnapshot: null,
      afterSnapshot: null,
    };
  }
  return {
    canUndo: true,
    undoBlockReason: '',
    beforeSnapshot: beforeBuilt.snapshot,
    afterSnapshot: null,
  };
}

export function valuesEqualForUndo(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => valuesEqualForUndo(item, b[index]));
  }
  return false;
}

/** True when any redacted field value differs between before/after (including add/remove). */
export function redactedFieldsChanged(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): boolean {
  return redactedFieldsDiffer(before, after);
}

/** Whether an undoable update may leave secrets untouched (for UI copy). */
export function isPartialSecretPreservingUpdate(entry: {
  action: ChangeAction;
  entityType?: string;
  canUndo?: boolean;
  beforeSnapshot?: UndoSnapshot | null;
  afterSnapshot?: UndoSnapshot | null;
  changes?: { before?: string | null; after?: string | null }[];
}): boolean {
  if (entry.action !== 'update' || entry.canUndo !== true) return false;
  // Settings profiles always omit bank/secret keys from undo snapshots.
  if (entry.entityType === 'settings') return true;
  // Display diffs that already show redacted markers.
  if (entry.changes?.some((c) => c.before === '•••' || c.after === '•••')) return true;
  return false;
}

/** Fields that must still equal the original "after" snapshot before undoing an update. */
export function changedFieldsToVerify(
  beforeSnapshot: UndoSnapshot,
  afterSnapshot: UndoSnapshot
): string[] {
  const keys = new Set([...Object.keys(beforeSnapshot), ...Object.keys(afterSnapshot)]);
  const fields: string[] = [];
  for (const key of keys) {
    if (!valuesEqualForUndo(beforeSnapshot[key], afterSnapshot[key])) fields.push(key);
  }
  return fields.sort();
}

export function findUpdateConflicts(
  current: Record<string, unknown>,
  beforeSnapshot: UndoSnapshot,
  afterSnapshot: UndoSnapshot
): UndoConflict[] {
  const conflicts: UndoConflict[] = [];
  for (const field of changedFieldsToVerify(beforeSnapshot, afterSnapshot)) {
    const expected = afterSnapshot[field];
    const actual = current[field];
    if (!valuesEqualForUndo(expected, actual)) {
      conflicts.push({ field, expected, actual });
    }
  }
  return conflicts;
}

export function buildUpdateUndoPatch(
  beforeSnapshot: UndoSnapshot,
  afterSnapshot: UndoSnapshot
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of changedFieldsToVerify(beforeSnapshot, afterSnapshot)) {
    if (field in beforeSnapshot) patch[field] = beforeSnapshot[field];
    else patch[field] = null; // signal delete field — caller maps to deleteField()
  }
  return patch;
}


/** Simulate Firestore update() merge for tests — secrets not in patch stay put. */
export function applyUpdateUndoMerge(
  current: Record<string, unknown>,
  beforeSnapshot: UndoSnapshot,
  afterSnapshot: UndoSnapshot
): Record<string, unknown> {
  const patch = buildUpdateUndoPatch(beforeSnapshot, afterSnapshot);
  const next: Record<string, unknown> = { ...current };
  for (const [field, value] of Object.entries(patch)) {
    if (value === null) delete next[field];
    else next[field] = value;
  }
  return next;
}

export function assessLegacyUndoAvailability(entry: {
  action: ChangeAction;
  entityType: string;
  canUndo?: boolean;
  undoBlockReason?: string;
  beforeSnapshot?: UndoSnapshot | null;
  afterSnapshot?: UndoSnapshot | null;
  undoOf?: string;
}): { canUndo: boolean; reason: string } {
  if (entry.undoOf) {
    return { canUndo: false, reason: 'Đây là bản ghi hoàn tác, không hoàn tác lại.' };
  }
  if (typeof entry.canUndo === 'boolean') {
    return {
      canUndo: entry.canUndo,
      reason: entry.canUndo ? '' : entry.undoBlockReason || 'Không thể hoàn tác bản ghi này.',
    };
  }
  // Old rows only have truncated string diffs — never guess.
  return {
    canUndo: false,
    reason:
      'Bản ghi cũ chỉ có diff rút gọn, thiếu snapshot đầy đủ nên không hoàn tác an toàn được.',
  };
}

export function undoHistoryDocId(originalHistoryId: string): string {
  const clean = originalHistoryId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return `undo_${clean || 'unknown'}`;
}
