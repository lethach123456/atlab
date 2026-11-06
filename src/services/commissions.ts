import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addChangeHistoryToBatch, addChangeHistoryToTransaction, plainRecord } from './changeHistory';
import type { CommissionInput, SaleCommission } from '../types/commission';

async function commissionId(ownerId: string, input: CommissionInput) {
  const clinic = input.clinicName.trim().normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ');
  const bytes = new TextEncoder().encode(JSON.stringify([ownerId, input.saleId, clinic]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'commission_' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function subscribeCommissions(
  ownerId: string,
  onRecords: (records: SaleCommission[]) => void,
  onError: () => void
) {
  return onSnapshot(query(collection(db, 'saleCommissions'), where('ownerId', '==', ownerId)), { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    onRecords(snapshot.docs.map((item) => {
      const data = item.data();
      return { id: item.id, saleId: data.saleId, clinicName: data.clinicName, ratePercent: data.ratePercent };
    }).sort((a, b) => a.clinicName.localeCompare(b.clinicName, 'vi')));
  }, onError);
}

function validateCommission(input: CommissionInput) {
  if (!input.saleId || !input.clinicName.trim() || !Number.isFinite(input.ratePercent) ||
      input.ratePercent < 0 || input.ratePercent > 100) {
    throw new Error('Chọn sale, nha khoa và tỷ lệ hoa hồng từ 0 đến 100%.');
  }
}

export async function saveCommission(ownerId: string, input: CommissionInput, existingId?: string): Promise<void> {
  validateCommission(input);
  const id = existingId ?? await commissionId(ownerId, input);
  const reference = doc(db, 'saleCommissions', id);
  try {
    await runTransaction(db, async (transaction) => {
      const previous = await transaction.get(reference);
      if (!existingId && previous.exists()) {
        throw new Error('Sale này đã được cấu hình tại nha khoa đã chọn. Bấm Sửa để đổi tỷ lệ.');
      }
      if (existingId && !previous.exists()) {
        throw new Error('Cấu hình này đã bị xóa. Vui lòng tải lại danh sách.');
      }
      if (existingId) {
        const before = previous.exists() ? plainRecord(previous.data()) : null;
        transaction.update(reference, { ratePercent: input.ratePercent, updatedAt: serverTimestamp() });
        addChangeHistoryToTransaction(transaction, ownerId, {
          action: 'update',
          entityType: 'saleCommissions',
          entityId: id,
          before,
          after: { ...(before || {}), ratePercent: input.ratePercent },
        });
      } else {
        const after = {
          ...input,
          clinicName: input.clinicName.trim(),
          id,
          ownerId,
        };
        transaction.set(reference, {
          ...after,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addChangeHistoryToTransaction(transaction, ownerId, {
          action: 'create',
          entityType: 'saleCommissions',
          entityId: id,
          before: null,
          after,
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && !('code' in error)) throw error;
    throw new Error('Không lưu được hoa hồng. Kiểm tra kết nối và quyền quản trị, rồi thử lại.');
  }
}

export async function saveCommissions(
  ownerId: string,
  saleId: string,
  clinicNames: string[],
  ratePercent: number
): Promise<{ created: number; skipped: number }> {
  const unique = new Map<string, string>();
  for (const name of clinicNames) {
    const clinic = name.trim();
    unique.set(clinic.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' '), clinic);
    validateCommission({ saleId, clinicName: clinic, ratePercent });
  }
  if (!unique.size) throw new Error('Chọn ít nhất một nha khoa.');

  const records = await Promise.all([...unique.values()].map(async (clinicName) => {
    const input = { saleId, clinicName, ratePercent };
    const id = await commissionId(ownerId, input);
    return { input, id, reference: doc(db, 'saleCommissions', id) };
  }));
  let created = 0;
  try {
    for (let offset = 0; offset < records.length; offset += 200) {
      const chunk = records.slice(offset, offset + 400);
      created += await runTransaction(db, async (transaction) => {
        const snapshots = await Promise.all(chunk.map(({ reference }) => transaction.get(reference)));
        let added = 0;
        chunk.forEach(({ input, id, reference }, index) => {
          if (snapshots[index].exists()) return;
          const after = { ...input, id, ownerId };
          transaction.set(reference, {
            ...after,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          addChangeHistoryToTransaction(transaction, ownerId, {
            action: 'create',
            entityType: 'saleCommissions',
            entityId: id,
            before: null,
            after,
          });
          added++;
        });
        return added;
      });
    }
  } catch {
    throw new Error('Chưa lưu đủ các nha khoa. Bấm lưu lại để hoàn tất các mục còn thiếu.');
  }
  return { created, skipped: records.length - created };
}

export async function deleteCommission(id: string): Promise<void> {
  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    throw new Error('Mã cấu hình hoa hồng không hợp lệ.');
  }
  try {
    const reference = doc(db, 'saleCommissions', id);
    const snap = await getDoc(reference);
    const before = snap.exists() ? plainRecord(snap.data()) : null;
    const ownerId = String(before?.ownerId || '');
    const batch = writeBatch(db);
    batch.delete(reference);
    if (ownerId) {
      addChangeHistoryToBatch(batch, ownerId, {
        action: 'delete',
        entityType: 'saleCommissions',
        entityId: id,
        before,
        after: null,
      });
    }
    await batch.commit();
  } catch {
    throw new Error('Không xóa được cấu hình hoa hồng. Vui lòng thử lại.');
  }
}

export async function deleteCommissions(ids: string[]): Promise<void> {
  const validIds = ids.filter((id) => id && /^[a-zA-Z0-9_-]{1,128}$/.test(id));
  if (validIds.length === 0) return;
  try {
    for (let offset = 0; offset < validIds.length; offset += 200) {
      const chunk = validIds.slice(offset, offset + 200);
      const snaps = await Promise.all(chunk.map((id) => getDoc(doc(db, 'saleCommissions', id))));
      const batch = writeBatch(db);
      chunk.forEach((id, index) => {
        const snap = snaps[index];
        const before = snap.exists() ? plainRecord(snap.data()) : null;
        const ownerId = String(before?.ownerId || '');
        batch.delete(doc(db, 'saleCommissions', id));
        if (ownerId) {
          addChangeHistoryToBatch(batch, ownerId, {
            action: 'delete',
            entityType: 'saleCommissions',
            entityId: id,
            before,
            after: null,
          });
        }
      });
      await batch.commit();
    }
  } catch {
    throw new Error('Không xóa được các cấu hình hoa hồng đã chọn. Vui lòng thử lại.');
  }
}


