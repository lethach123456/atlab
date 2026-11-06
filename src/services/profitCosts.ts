import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addChangeHistoryToTransaction, plainRecord } from './changeHistory';
import { debtMonthValue } from '../utils/debtLedger';
import type { ProfitFixedExpense, ProfitFixedExpenseInput } from '../utils/profit';

export function subscribeProfitCosts(
  ownerId: string,
  onRecords: (records: ProfitFixedExpense[]) => void,
  onError: (message: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'profitMonthlyCosts'), where('ownerId', '==', ownerId)),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      onRecords(snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          monthYear: data.monthYear,
          kind: data.kind,
          amount: data.amount,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0,
        };
      }));
    },
    () => onError('Không tải được chi phí mặt bằng và điện nước. Vui lòng tải lại trang.'),
  );
}

/** One monthly value per workspace and kind, including an explicit zero override. */
export async function saveProfitFixedCost(ownerId: string, input: ProfitFixedExpenseInput): Promise<void> {
  if (!ownerId || debtMonthValue(input.monthYear) === null ||
      !['rent', 'utilities'].includes(input.kind) || !Number.isSafeInteger(input.amount) || input.amount < 0) {
    throw new Error('Nhập số tiền nguyên từ 0 trở lên cho tháng đã chọn.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ownerId));
  const ownerKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const [month, year] = input.monthYear.split('/');
  const id = `profitcost_${ownerKey}_${year}_${month}_${input.kind}`;
  const reference = doc(db, 'profitMonthlyCosts', id);
  try {
    await runTransaction(db, async (transaction) => {
      const current = await transaction.get(reference);
      const before = current.exists() ? plainRecord(current.data()) : null;
      const after = { id, ownerId, monthYear: input.monthYear, kind: input.kind, amount: input.amount };
      transaction.set(reference, {
        ...after,
        createdAt: current.exists() ? current.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addChangeHistoryToTransaction(transaction, ownerId, {
        action: before ? 'update' : 'create',
        entityType: 'profitMonthlyCosts',
        entityId: id,
        before,
        after,
      });
    });
  } catch {
    throw new Error('Không lưu được chi phí. Vui lòng kiểm tra kết nối và thử lại.');
  }
}
