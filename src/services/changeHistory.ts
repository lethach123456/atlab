import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
  type WriteBatch,
  type Transaction,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  actionLabelVi,
  buildEntityLabel,
  buildFieldChanges,
  ENTITY_LABELS,
  type ChangeAction,
  type FieldChange,
} from '../utils/changeDiff';

export const CHANGE_HISTORY_COLLECTION = 'changeHistory';
export const CHANGE_HISTORY_PAGE_SIZE = 40;

export interface ChangeHistoryEntry {
  id: string;
  ownerId: string;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  action: ChangeAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: FieldChange[];
  createdAtMs: number;
}

export interface ChangeHistoryPage {
  entries: ChangeHistoryEntry[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

function plainRecord(data: DocumentData | undefined | null): Record<string, unknown> | null {
  if (!data) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'toMillis' in (value as Timestamp)) {
      out[key] = (value as Timestamp).toMillis();
    } else {
      out[key] = value as unknown;
    }
  }
  return out;
}

function newHistoryId(): string {
  return `ch_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function actorFields(): { actorUid: string; actorEmail: string; actorName: string } {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập nên không ghi được lịch sử thay đổi.');
  return {
    actorUid: user.uid,
    actorEmail: (user.email || '').slice(0, 254),
    actorName: (user.displayName || user.email || 'Người dùng').slice(0, 200),
  };
}

export function buildHistoryDocument(input: {
  ownerId: string;
  action: ChangeAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): { id: string; data: DocumentData } {
  const actor = actorFields();
  const labelSource = input.action === 'delete' ? input.before : input.after || input.before;
  const entityLabel = buildEntityLabel(input.entityType, labelSource, input.entityId).slice(0, 300);
  const changes = buildFieldChanges(input.before, input.after, input.action).slice(0, 40);
  const typeLabel = ENTITY_LABELS[input.entityType] || input.entityType;
  const summary = `${actionLabelVi(input.action)} ${typeLabel}: ${entityLabel}`.slice(0, 400);
  const id = newHistoryId();
  return {
    id,
    data: {
      id,
      ownerId: input.ownerId,
      ...actor,
      action: input.action,
      entityType: input.entityType.slice(0, 64),
      entityId: input.entityId.slice(0, 128),
      entityLabel,
      summary,
      changes,
      createdAt: serverTimestamp(),
    },
  };
}

/** Attach one append-only history doc to an existing write batch (same commit). */
export function addChangeHistoryToBatch(
  batch: WriteBatch,
  ownerId: string,
  input: {
    action: ChangeAction;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }
): void {
  const { id, data } = buildHistoryDocument({ ownerId, ...input });
  batch.set(doc(db, CHANGE_HISTORY_COLLECTION, id), data);
}

/** Attach history inside a Firestore transaction. */
export function addChangeHistoryToTransaction(
  transaction: Transaction,
  ownerId: string,
  input: {
    action: ChangeAction;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }
): void {
  const { id, data } = buildHistoryDocument({ ownerId, ...input });
  transaction.set(doc(db, CHANGE_HISTORY_COLLECTION, id), data);
}

/** Best-effort standalone create when the caller cannot share a batch (non-fatal). */
export async function recordChangeHistoryBestEffort(
  ownerId: string,
  input: {
    action: ChangeAction;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    addChangeHistoryToBatch(batch, ownerId, input);
    await batch.commit();
  } catch (error) {
    console.warn('changeHistory best-effort write failed', error);
  }
}

export async function loadEntitySnapshot(
  entityType: string,
  entityId: string
): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getDoc(doc(db, entityType, entityId));
    return plainRecord(snap.exists() ? snap.data() : null);
  } catch {
    return null;
  }
}

function mapEntry(id: string, data: DocumentData): ChangeHistoryEntry {
  const createdAt = data.createdAt;
  const createdAtMs =
    createdAt && typeof createdAt === 'object' && 'toMillis' in createdAt
      ? (createdAt as Timestamp).toMillis()
      : typeof createdAt === 'number'
        ? createdAt
        : 0;
  const rawChanges = Array.isArray(data.changes) ? data.changes : [];
  return {
    id,
    ownerId: String(data.ownerId || ''),
    actorUid: String(data.actorUid || ''),
    actorEmail: String(data.actorEmail || ''),
    actorName: String(data.actorName || ''),
    action: (data.action === 'create' || data.action === 'delete' ? data.action : 'update') as ChangeAction,
    entityType: String(data.entityType || ''),
    entityId: String(data.entityId || ''),
    entityLabel: String(data.entityLabel || ''),
    summary: String(data.summary || ''),
    changes: rawChanges.map((row: DocumentData) => ({
      field: String(row?.field || ''),
      before: row?.before == null ? null : String(row.before),
      after: row?.after == null ? null : String(row.after),
    })),
    createdAtMs,
  };
}

export async function fetchChangeHistoryPage(options: {
  ownerId: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot | null;
  entityType?: string;
}): Promise<ChangeHistoryPage> {
  const pageSize = Math.min(100, Math.max(1, options.pageSize || CHANGE_HISTORY_PAGE_SIZE));
  const base = collection(db, CHANGE_HISTORY_COLLECTION);
  const snap = await getDocs(
    options.cursor
      ? options.entityType
        ? query(
            base,
            where('ownerId', '==', options.ownerId),
            where('entityType', '==', options.entityType),
            orderBy('createdAt', 'desc'),
            startAfter(options.cursor),
            limit(pageSize + 1)
          )
        : query(
            base,
            where('ownerId', '==', options.ownerId),
            orderBy('createdAt', 'desc'),
            startAfter(options.cursor),
            limit(pageSize + 1)
          )
      : options.entityType
        ? query(
            base,
            where('ownerId', '==', options.ownerId),
            where('entityType', '==', options.entityType),
            orderBy('createdAt', 'desc'),
            limit(pageSize + 1)
          )
        : query(
            base,
            where('ownerId', '==', options.ownerId),
            orderBy('createdAt', 'desc'),
            limit(pageSize + 1)
          )
  );
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  return {
    entries: pageDocs.map((item) => mapEntry(item.id, item.data())),
    cursor: pageDocs.length ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
}

export { plainRecord };
