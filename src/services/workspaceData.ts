import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  waitForPendingWrites,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addChangeHistoryToBatch, plainRecord } from './changeHistory';
import { assertOnlineForSave, formatSaveError } from '../utils/reliableSave';
import { createClinicNameResolver } from '../utils/clinicPartners';
import type {
  CashflowTransaction,
  ClinicDebtRecord,
  ClinicMaterialPriceRow,
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
  clinicPrices: ClinicMaterialPriceRow[];
  debts: ClinicDebtRecord[];
  partners: ClinicPartner[];
  profile: LabProfileConfig;
}

/** Renames retain the link to historical records without rewriting their source data. */
export function resolveWorkspaceClinicNames(data: WorkspaceData): WorkspaceData {
  const resolveName = createClinicNameResolver(data.partners);
  const resolve = <T extends { clinicName?: string }>(records: T[]): T[] => records.map((record) => {
    if (!record.clinicName) return record;
    const clinicName = resolveName(record.clinicName);
    return clinicName === record.clinicName ? record : { ...record, clinicName };
  });
  return {
    ...data,
    orders: resolve(data.orders),
    debts: resolve(data.debts),
    payments: resolve(data.payments),
    deliveries: resolve(data.deliveries),
    cashflows: resolve(data.cashflows),
  };
}

const workspaceCollections = {
  orders: 'orders',
  payments: 'debtPayments',
  cashflows: 'cashflows',
  deliveries: 'deliveries',
  prices: 'materialPrices',
  clinicPrices: 'clinicMaterialPrices',
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
    clinicPrices: [],
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
        if (ready.size === Object.keys(workspaceCollections).length) onData(resolveWorkspaceClinicNames(state));
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
    if (change.collection === 'cashflows') {
      record.clinicName ??= '';
      record.spenderName ??= '';
    }
    record.createdAt = serverTimestamp();
  } else {
    // Merge updates preserve the original server timestamp, including nanoseconds.
    delete record.createdAt;
  }
  record.updatedAt = serverTimestamp();
  return record;
}


async function waitForServerAcknowledgement(): Promise<void> {
  assertOnlineForSave();
  const timeoutMs = 25000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      waitForPendingWrites(db),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              'Máy chủ chưa xác nhận lưu (hết thời gian chờ). Kiểm tra mạng rồi bấm Thử lại.'
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Đang offline — chưa lưu lên máy chủ. Kiểm tra mạng rồi bấm Thử lại.');
  }
}

/** Related changes within one chunk are committed atomically (entity + history). */
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
    // Each business write pairs with one history doc → keep chunks under the 500 op limit.
    const chunkSize = 200;
    for (let offset = 0; offset < changes.length; offset += chunkSize) {
      const chunk = changes.slice(offset, offset + chunkSize);
      const befores = await Promise.all(
        chunk.map(async (change) => {
          if (change.isNew && change.data !== undefined) return null;
          try {
            const snap = await getDoc(doc(db, change.collection, change.id));
            return plainRecord(snap.exists() ? snap.data() : null);
          } catch {
            return null;
          }
        })
      );

      const batch = writeBatch(db);
      chunk.forEach((change, index) => {
        const reference = doc(db, change.collection, change.id);
        const before = befores[index];
        if (change.data === undefined) {
          batch.delete(reference);
          addChangeHistoryToBatch(batch, ownerId, {
            action: 'delete',
            entityType: change.collection,
            entityId: change.id,
            before,
            after: null,
          });
          return;
        }

        const action = change.isNew || !before ? 'create' : 'update';
        const written = writeRecord(change, ownerId);
        batch.set(reference, written, { merge: true });
        const afterPlain: Record<string, unknown> = {
          ...(before || {}),
          ...Object.fromEntries(
            Object.entries(change.data as Record<string, unknown>).filter(([, value]) => value !== undefined)
          ),
          id: change.id,
        };
        addChangeHistoryToBatch(batch, ownerId, {
          action,
          entityType: change.collection,
          entityId: change.id,
          before: action === 'create' ? null : before,
          after: afterPlain,
        });
      });
      await batch.commit();
    }
    await waitForServerAcknowledgement();
  } catch (error) {
    const mapped = workspaceError(error);
    throw new Error(formatSaveError(error, mapped.message));
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
