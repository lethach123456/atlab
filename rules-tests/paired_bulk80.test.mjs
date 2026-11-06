import { readFileSync } from 'fs';
import { assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';

const OWNER = 'Jh8O5dzdD4M1AP5tI57BsRWketu1';
const N = 80; // representative bulk (<<200 but exercises paired history volume)

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-atlab-bulk',
  firestore: { rules: readFileSync('./firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'users', OWNER), {
    uid: OWNER, email: 'a@b.co', displayName: 'AT', role: 'admin', active: true,
    workspaceOwnerId: OWNER, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
});
const db = testEnv.authenticatedContext(OWNER, { email: 'a@b.co' }).firestore();
const b = writeBatch(db);
for (let i = 0; i < N; i++) {
  const id = `order_bulk_${i}`;
  const afterSnapshot = {
    warrantyCode: `W${i}`, patientName: 'P', phone: '0', clinicName: 'C', clinicAddress: 'A',
    material: 'M', warrantyPeriod: '15', warrantyYears: 15, orderDate: '07/11/2026', monthYear: '11/2026',
    teeth: '11', teethCount: 1, toothForm: 'F', unitPrice: 1, totalAmount: 1, notes: '',
    status: '', paymentStatus: 'unpaid',
  };
  b.set(doc(db, 'orders', id), { id, ownerId: OWNER, ...afterSnapshot, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.set(doc(db, 'changeHistory', `ch_bulk_${i}`), {
    id: `ch_bulk_${i}`, ownerId: OWNER, actorUid: OWNER, actorEmail: 'a@b.co', actorName: 'AT',
    action: 'create', entityType: 'orders', entityId: id, entityLabel: 'P', summary: 'Tạo mới Đơn hàng: P',
    changes: [
      { field: 'patientName', before: null, after: 'P' },
      { field: 'material', before: null, after: 'M' },
      { field: '_more', before: null, after: '+14 trường khác' },
    ],
    canUndo: true, undoBlockReason: '', afterSnapshot, createdAt: serverTimestamp(),
  });
}
await assertSucceeds(b.commit());
console.log('PASS paired bulk', N, 'orders +', N, 'history =', N * 2, 'writes');
await testEnv.cleanup();
