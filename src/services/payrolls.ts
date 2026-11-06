import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addChangeHistoryToBatch, plainRecord } from './changeHistory';
import type { EmployeePayroll, EmployeePayrollInput } from '../types/payroll';

function readTimestamp(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export function subscribePayrolls(
  ownerId: string,
  onRecords: (records: EmployeePayroll[]) => void,
  onError: (message: string) => void
): () => void {
  return onSnapshot(
    query(collection(db, 'employeePayrolls'), where('ownerId', '==', ownerId)),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      const list: EmployeePayroll[] = snapshot.docs.map((item) => {
        const d = item.data();
        const baseSalary = Number(d.baseSalary) || 0;
        const allowance = Number(d.allowance) || 0;
        const commissionAmount = Number(d.commissionAmount) || 0;
        const bonus = Number(d.bonus) || 0;
        const deduction = Number(d.deduction) || 0;
        const netSalary =
          typeof d.netSalary === 'number'
            ? d.netSalary
            : Math.max(0, baseSalary + allowance + commissionAmount + bonus - deduction);
        return {
          id: item.id,
          monthYear: String(d.monthYear || '11/2026'),
          employeeType: d.employeeType === 'sale' ? 'sale' : 'custom',
          saleUserId: String(d.saleUserId || ''),
          employeeName: String(d.employeeName || ''),
          employeeEmail: String(d.employeeEmail || ''),
          phone: String(d.phone || ''),
          position: String(d.position || 'Nhân viên'),
          workDays: Number(d.workDays) || 26,
          baseSalary,
          allowance,
          commissionAmount,
          bonus,
          deduction,
          netSalary,
          paymentStatus: d.paymentStatus === 'paid' ? 'paid' : 'unpaid',
          paymentDate: String(d.paymentDate || ''),
          notes: String(d.notes || ''),
          createdAt: readTimestamp(d.createdAt),
          updatedAt: readTimestamp(d.updatedAt),
        };
      });
      list.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'vi'));
      onRecords(list);
    },
    () => {
      onError('Không tải được dữ liệu bảng lương. Vui lòng kiểm tra quyền quản trị hoặc tải lại trang.');
    }
  );
}

export async function savePayrollRecord(
  ownerId: string,
  input: EmployeePayrollInput,
  existingId?: string
): Promise<void> {
  const employeeName = input.employeeName.trim().slice(0, 200);
  if (!employeeName) {
    throw new Error('Vui lòng nhập họ tên nhân viên.');
  }
  const monthYear = input.monthYear.trim().slice(0, 16);
  if (!/^\d{2}\/\d{4}$/.test(monthYear)) {
    throw new Error('Kỳ lương không hợp lệ (MM/YYYY).');
  }

  const workDays = Math.min(31, Math.max(0, Number(input.workDays) || 0));
  const baseSalary = Math.max(0, Math.round(Number(input.baseSalary) || 0));
  const allowance = Math.max(0, Math.round(Number(input.allowance) || 0));
  const commissionAmount = Math.max(0, Math.round(Number(input.commissionAmount) || 0));
  const bonus = Math.max(0, Math.round(Number(input.bonus) || 0));
  const deduction = Math.max(0, Math.round(Number(input.deduction) || 0));
  const netSalary = Math.max(
    0,
    baseSalary + allowance + commissionAmount + bonus - deduction
  );

  const id = existingId || `pay_${monthYear.replace('/', '_')}_${crypto.randomUUID().slice(0, 8)}`;
  const ref = doc(db, 'employeePayrolls', id);

  const payload: Record<string, unknown> = {
    id,
    ownerId,
    monthYear,
    employeeType: input.employeeType === 'sale' ? 'sale' : 'custom',
    saleUserId: (input.saleUserId || '').trim().slice(0, 128),
    employeeName,
    employeeEmail: (input.employeeEmail || '').trim().slice(0, 254),
    phone: (input.phone || '').trim().slice(0, 50),
    position: (input.position || 'Nhân viên').trim().slice(0, 150),
    workDays,
    baseSalary,
    allowance,
    commissionAmount,
    bonus,
    deduction,
    netSalary,
    paymentStatus: input.paymentStatus === 'paid' ? 'paid' : 'unpaid',
    paymentDate: (input.paymentDate || '').trim().slice(0, 32),
    notes: (input.notes || '').trim().slice(0, 500),
    updatedAt: serverTimestamp(),
  };

  if (!existingId) {
    payload.createdAt = serverTimestamp();
  }

  try {
    const beforeSnap = existingId ? await getDoc(ref) : null;
    const before = beforeSnap?.exists() ? plainRecord(beforeSnap.data()) : null;
    const batch = writeBatch(db);
    batch.set(ref, payload, { merge: true });
    addChangeHistoryToBatch(batch, ownerId, {
      action: existingId && before ? 'update' : 'create',
      entityType: 'employeePayrolls',
      entityId: id,
      before: existingId ? before : null,
      after: { ...payload, createdAt: undefined, updatedAt: undefined },
    });
    await batch.commit();
  } catch {
    throw new Error('Không lưu được bảng lương. Vui lòng thử lại.');
  }
}

export async function deletePayrollRecord(id: string, ownerId?: string): Promise<void> {
  try {
    const ref = doc(db, 'employeePayrolls', id);
    const snap = await getDoc(ref);
    const before = snap.exists() ? plainRecord(snap.data()) : null;
    const resolvedOwner = ownerId || String(before?.ownerId || '');
    const batch = writeBatch(db);
    batch.delete(ref);
    if (resolvedOwner) {
      addChangeHistoryToBatch(batch, resolvedOwner, {
        action: 'delete',
        entityType: 'employeePayrolls',
        entityId: id,
        before,
        after: null,
      });
    }
    await batch.commit();
  } catch {
    throw new Error('Không xóa được dòng lương này. Vui lòng thử lại.');
  }
}
