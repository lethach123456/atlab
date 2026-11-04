import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  CashflowTransaction,
  ClinicDebtRecord,
  ClinicPartner,
  DebtPaymentRecord,
  DeliveryRecord,
  DentalOrder,
  LabProfileConfig,
  MaterialPriceConfig,
} from '../types/dental';

export interface WorkspaceData {
  orders: DentalOrder[];
  payments: DebtPaymentRecord[];
  cashflows: CashflowTransaction[];
  deliveries: DeliveryRecord[];
  prices: MaterialPriceConfig[];
  debts: ClinicDebtRecord[];
  partners: ClinicPartner[];
  profile: LabProfileConfig;
}

const workspaceCollections = {
  orders: 'orders',
  payments: 'debtPayments',
  cashflows: 'cashflows',
  deliveries: 'deliveries',
  prices: 'materialPrices',
  debts: 'clinicDebts',
  partners: 'clinicPartners',
  profile: 'settings',
} as const;

export type WorkspaceCollection = typeof workspaceCollections[keyof typeof workspaceCollections];

export interface WorkspaceChange {
  collection: WorkspaceCollection;
  id: string;
  data?: object;
  isNew?: boolean;
}

const emptyProfile: LabProfileConfig = {
  labName: '',
  tagline: '',
  hotline: '',
  address: '',
  email: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolder: '',
  directorName: '',
};

function workspaceError(error: unknown): Error {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied' || code === 'unauthenticated') {
    return new Error('Tài khoản không có quyền truy cập dữ liệu này. Vui lòng kiểm tra trạng thái đăng nhập.');
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return new Error('Chưa kết nối được Firestore. Vui lòng kiểm tra kết nối mạng và thử lại.');
  }
  return new Error('Không thể đồng bộ dữ liệu với Firestore. Vui lòng thử lại.');
}

function readRecord(id: string, data: DocumentData): DocumentData {
  const { ownerId: _ownerId, ...record } = data;
  for (const field of ['createdAt', 'updatedAt']) {
    if (record[field] instanceof Timestamp) record[field] = record[field].toMillis();
  }
  return { ...record, id };
}

/** Emits complete workspace state once every collection has answered from Firestore. */
export function subscribeWorkspaceData(
  ownerId: string,
  onData: (data: WorkspaceData) => void,
  onError: (error: Error) => void
): () => void {
  const state: WorkspaceData = {
    orders: [],
    payments: [],
    cashflows: [],
    deliveries: [],
    prices: [],
    debts: [],
    partners: [],
    profile: { ...emptyProfile },
  };
  const ready = new Set<keyof WorkspaceData>();
  let closed = false;

  const unsubscribes = Object.entries(workspaceCollections).map(([key, name]) => {
    const stateKey = key as keyof WorkspaceData;
    return onSnapshot(
      query(collection(db, name), where('ownerId', '==', ownerId)),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (closed || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        if (stateKey === 'profile') {
          const profile = snapshot.docs.find((item) => item.id === `profile_${ownerId}`)?.data();
          state.profile = Object.fromEntries(
            Object.keys(emptyProfile).map((field) => [field, profile?.[field] ?? ''])
          ) as unknown as LabProfileConfig;
        } else {
          const records = snapshot.docs.map((item) => readRecord(item.id, item.data()));
          Object.assign(state, { [stateKey]: records });
        }
        ready.add(stateKey);
        if (ready.size === Object.keys(workspaceCollections).length) onData({ ...state });
      },
      (error) => {
        if (!closed) onError(workspaceError(error));
      }
    );
  });

  return () => {
    closed = true;
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

function writeRecord(change: WorkspaceChange, ownerId: string): DocumentData {
  const record: DocumentData = { ...change.data, id: change.id, ownerId };
  for (const field of Object.keys(record)) {
    if (record[field] === undefined) delete record[field];
  }
  if (change.isNew) {
    if (['orders', 'debtPayments', 'cashflows', 'deliveries', 'clinicDebts'].includes(change.collection)) {
      record.notes ??= '';
    }
    if (change.collection === 'orders') record.paymentStatus ??= 'unpaid';
    if (change.collection === 'cashflows') record.clinicName ??= '';
    record.createdAt = serverTimestamp();
  } else {
    // Merge updates preserve the original server timestamp, including nanoseconds.
    delete record.createdAt;
  }
  record.updatedAt = serverTimestamp();
  return record;
}

/** Related changes within one chunk are committed atomically. */
export async function commitWorkspaceChanges(
  ownerId: string,
  changes: WorkspaceChange[]
): Promise<void> {
  if (!ownerId) throw new Error('Chưa xác định được labo của tài khoản.');
  for (const change of changes) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(change.id)) {
      throw new Error('Mã dữ liệu không hợp lệ.');
    }
  }
  try {
    for (let offset = 0; offset < changes.length; offset += 450) {
      const batch = writeBatch(db);
      for (const change of changes.slice(offset, offset + 450)) {
        const reference = doc(db, change.collection, change.id);
        if (change.data === undefined) {
          batch.delete(reference);
        } else {
          batch.set(reference, writeRecord(change, ownerId), { merge: true });
        }
      }
      await batch.commit();
    }
  } catch (error) {
    throw workspaceError(error);
  }
}

export function saveWorkspaceRecord(
  collectionName: WorkspaceCollection,
  id: string,
  record: object,
  ownerId: string,
  isNew = false
): Promise<void> {
  return commitWorkspaceChanges(ownerId, [{ collection: collectionName, id, data: record, isNew }]);
}

export function deleteWorkspaceRecord(
  collectionName: WorkspaceCollection,
  id: string,
  ownerId: string
): Promise<void> {
  return commitWorkspaceChanges(ownerId, [{ collection: collectionName, id }]);
}
