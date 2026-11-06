import {
  deleteField,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  assessLegacyUndoAvailability,
  buildUpdateUndoPatch,
  findUpdateConflicts,
  undoHistoryDocId,
  valuesEqualForUndo,
  type UndoSnapshot,
} from '../utils/changeUndo';
import { REDACT_FIELDS } from '../utils/changeDiff';
import {
  CHANGE_HISTORY_COLLECTION,
  buildHistoryDocument,
  plainRecord,
  type ChangeHistoryEntry,
} from './changeHistory';

function requireAdminUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập.');
  return user.uid;
}

async function assertAdmin(ownerId: string, uid: string): Promise<void> {
  const profile = await getDoc(doc(db, 'users', uid));
  if (!profile.exists()) throw new Error('Không xác định được quyền tài khoản.');
  const data = profile.data();
  if (data.active !== true || data.role !== 'admin') {
    throw new Error('Chỉ quản trị viên được hoàn tác lịch sử thay đổi.');
  }
  if (String(data.workspaceOwnerId || '') !== ownerId) {
    throw new Error('Không có quyền hoàn tác dữ liệu labo này.');
  }
}

function snapshotFromEntry(value: unknown): UndoSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as UndoSnapshot;
}

export function describeUndoAvailability(entry: ChangeHistoryEntry): {
  canUndo: boolean;
  reason: string;
} {
  return assessLegacyUndoAvailability({
    action: entry.action,
    entityType: entry.entityType,
    canUndo: entry.canUndo,
    undoBlockReason: entry.undoBlockReason,
    beforeSnapshot: entry.beforeSnapshot,
    afterSnapshot: entry.afterSnapshot,
    undoOf: entry.undoOf,
  });
}

export async function undoChangeHistoryEntry(input: {
  ownerId: string;
  entry: ChangeHistoryEntry;
}): Promise<{ message: string }> {
  const uid = requireAdminUid();
  await assertAdmin(input.ownerId, uid);

  const availability = describeUndoAvailability(input.entry);
  if (!availability.canUndo) {
    throw new Error(availability.reason || 'Không thể hoàn tác bản ghi này.');
  }

  const entryRef = doc(db, CHANGE_HISTORY_COLLECTION, input.entry.id);
  const undoRef = doc(db, CHANGE_HISTORY_COLLECTION, undoHistoryDocId(input.entry.id));
  const entityRef = doc(db, input.entry.entityType, input.entry.entityId);

  await runTransaction(db, async (transaction) => {
    const [entrySnap, undoSnap, entitySnap] = await Promise.all([
      transaction.get(entryRef),
      transaction.get(undoRef),
      transaction.get(entityRef),
    ]);

    if (!entrySnap.exists()) {
      throw new Error('Không tìm thấy bản ghi lịch sử.');
    }
    if (undoSnap.exists()) {
      throw new Error('Thay đổi này đã được hoàn tác trước đó.');
    }

    const entryData = entrySnap.data();
    if (String(entryData.ownerId || '') !== input.ownerId) {
      throw new Error('Bản ghi lịch sử không thuộc labo hiện tại.');
    }
    if (entryData.undoOf) {
      throw new Error('Đây là bản ghi hoàn tác, không hoàn tác lại.');
    }
    if (entryData.canUndo !== true) {
      throw new Error(
        String(entryData.undoBlockReason || 'Bản ghi này không hỗ trợ hoàn tác.')
      );
    }

    const action = entryData.action === 'create' || entryData.action === 'delete' ? entryData.action : 'update';
    const beforeSnapshot = snapshotFromEntry(entryData.beforeSnapshot);
    const afterSnapshot = snapshotFromEntry(entryData.afterSnapshot);
    const current = plainRecord(entitySnap.exists() ? entitySnap.data() : null) || {};

    let undoBefore: Record<string, unknown> | null = null;
    let undoAfter: Record<string, unknown> | null = null;
    let undoAction: 'create' | 'update' | 'delete' = 'update';

    if (action === 'update') {
      if (!beforeSnapshot || !afterSnapshot) {
        throw new Error('Thiếu snapshot để hoàn tác cập nhật.');
      }
      if (!entitySnap.exists()) {
        throw new Error('Bản ghi gốc không còn tồn tại, không hoàn tác cập nhật được.');
      }
      const conflicts = findUpdateConflicts(current, beforeSnapshot, afterSnapshot);
      if (conflicts.length) {
        const fields = conflicts.map((c) => c.field).join(', ');
        throw new Error(
          `Dữ liệu đã đổi sau lần sửa này (trường: ${fields}). Không hoàn tác để tránh ghi đè thay đổi mới.`
        );
      }
      const patch = buildUpdateUndoPatch(beforeSnapshot, afterSnapshot);
      const updatePayload: DocumentData = { updatedAt: serverTimestamp() };
      for (const [field, value] of Object.entries(patch)) {
        updatePayload[field] = value === null ? deleteField() : value;
      }
      transaction.update(entityRef, updatePayload);
      undoBefore = { ...afterSnapshot };
      undoAfter = { ...beforeSnapshot };
      undoAction = 'update';
    } else if (action === 'create') {
      if (!afterSnapshot) throw new Error('Thiếu snapshot lúc tạo.');
      if (!entitySnap.exists()) {
        throw new Error('Bản ghi tạo mới không còn tồn tại.');
      }
      // Refuse delete-undo when live doc has secrets the snapshot could not verify.
      for (const key of Object.keys(current)) {
        if (REDACT_FIELDS.has(key) && current[key] !== undefined && current[key] !== null && String(current[key]).length > 0) {
          throw new Error(
            'Bản ghi có trường bảo mật không nằm trong snapshot — không xóa hoàn tác an toàn.'
          );
        }
      }
      for (const [field, expected] of Object.entries(afterSnapshot)) {
        if (!valuesEqualForUndo(current[field], expected)) {
          throw new Error(
            `Dữ liệu đã đổi sau khi tạo (trường ${field}). Không xóa hoàn tác để tránh mất thay đổi mới.`
          );
        }
      }
      transaction.delete(entityRef);
      undoBefore = { ...afterSnapshot };
      undoAfter = null;
      undoAction = 'delete';
    } else {
      // undo delete => recreate
      if (!beforeSnapshot) throw new Error('Thiếu snapshot lúc xóa.');
      if (entitySnap.exists()) {
        throw new Error('Bản ghi đã được tạo lại hoặc tồn tại khác, không khôi phục đè được.');
      }
      // Snapshot must not be used to recreate docs that originally carried secrets.
      for (const key of Object.keys(beforeSnapshot)) {
        if (REDACT_FIELDS.has(key)) {
          throw new Error('Snapshot chứa trường bảo mật không hợp lệ — từ chối khôi phục.');
        }
      }
      const restore: DocumentData = {
        ...beforeSnapshot,
        id: input.entry.entityId,
        ownerId: input.ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      transaction.set(entityRef, restore);
      undoBefore = null;
      undoAfter = { ...beforeSnapshot };
      undoAction = 'create';
    }

    const history = buildHistoryDocument({
      ownerId: input.ownerId,
      action: undoAction,
      entityType: input.entry.entityType,
      entityId: input.entry.entityId,
      before: undoBefore,
      after: undoAfter,
      undoOf: input.entry.id,
      forceId: undoHistoryDocId(input.entry.id),
    });
    // Undo history itself is not further undoable via another undo chain from UI on marker.
    history.data.canUndo = false;
    history.data.undoBlockReason = 'Đây là bản ghi hoàn tác.';
    history.data.undoOf = input.entry.id;
    transaction.set(undoRef, history.data);
  });

  return { message: 'Đã hoàn tác thay đổi thành công.' };
}
