import { readFileSync } from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, serverTimestamp, Timestamp, writeBatch, getDoc } from 'firebase/firestore';

const OWNER = 'Jh8O5dzdD4M1AP5tI57BsRWketu1';
const SALE = 'saleUserUid000000000000000001';
const OTHER_ADMIN = 'otherAdminUid00000000000001';
const NEW_USER = 'newSaleUserUid000000000000001';
const NEW_USER2 = 'newViewerUid0000000000000001';

function userHistory({ id, action, entityId, changes, actorUid = OWNER, actorEmail = 'a@b.co', actorName = 'AT', undoOf }) {
  const data = {
    id, ownerId: OWNER, actorUid, actorEmail, actorName,
    action, entityType: 'users', entityId,
    entityLabel: 'User', summary: `${action} users: User`.slice(0, 400),
    changes, canUndo: false,
    undoBlockReason: 'Không hỗ trợ hoàn tác thay đổi tài khoản / quyền / bảo mật.',
    createdAt: serverTimestamp(),
  };
  if (undoOf) data.undoOf = undoOf;
  return data;
}

function orderHistory({ id, entityId, changes, afterSnapshot }) {
  return {
    id, ownerId: OWNER, actorUid: OWNER, actorEmail: 'a@b.co', actorName: 'AT',
    action: 'create', entityType: 'orders', entityId,
    entityLabel: 'P', summary: 'Tạo mới Đơn hàng: P',
    changes, canUndo: true, undoBlockReason: '',
    afterSnapshot,
    createdAt: serverTimestamp(),
  };
}

let pass = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); console.log('PASS', name); pass++; }
  catch (e) { console.log('FAIL', name, (e.message || e).toString().slice(0, 240)); fail++; }
}

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-atlab-users',
  firestore: { rules: readFileSync('./firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const [uid, email, role, ws] of [
    [OWNER, 'a@b.co', 'admin', OWNER],
    [SALE, 'sale@x.co', 'sale', OWNER],
    [OTHER_ADMIN, 'o@x.co', 'admin', OTHER_ADMIN],
  ]) {
    await setDoc(doc(db, 'users', uid), {
      uid, email, displayName: uid.slice(0, 8), role, active: true,
      workspaceOwnerId: ws, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
  }
});

const admin = () => testEnv.authenticatedContext(OWNER, { email: 'a@b.co' }).firestore();
const sale = () => testEnv.authenticatedContext(SALE, { email: 'sale@x.co' }).firestore();
const otherAdmin = () => testEnv.authenticatedContext(OTHER_ADMIN, { email: 'o@x.co' }).firestore();

await check('admin atomic create user + history (userAccounts path)', async () => {
  const db = admin();
  const profile = {
    uid: NEW_USER, email: 'newsale@x.co', displayName: 'New Sale', role: 'sale', active: true,
    workspaceOwnerId: OWNER, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  const h = userHistory({
    id: 'ch_user_create_1', action: 'create', entityId: NEW_USER,
    changes: [
      { field: 'displayName', before: null, after: 'New Sale' },
      { field: 'email', before: null, after: 'newsale@x.co' },
      { field: 'role', before: null, after: 'sale' },
    ],
  });
  const b = writeBatch(db);
  b.set(doc(db, 'users', NEW_USER), profile);
  b.set(doc(db, 'changeHistory', h.id), h);
  await assertSucceeds(b.commit());
});

await check('sale cannot create user + history batch', async () => {
  const db = sale();
  const profile = {
    uid: NEW_USER2, email: 'v@x.co', displayName: 'V', role: 'viewer', active: true,
    workspaceOwnerId: OWNER, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  const h = userHistory({
    id: 'ch_user_sale_fail', action: 'create', entityId: NEW_USER2,
    changes: [{ field: 'role', before: null, after: 'viewer' }],
    actorUid: SALE, actorEmail: 'sale@x.co', actorName: 'Sale',
  });
  const b = writeBatch(db);
  b.set(doc(db, 'users', NEW_USER2), profile);
  b.set(doc(db, 'changeHistory', h.id), h);
  await assertFails(b.commit());
});

await check('cross-workspace admin cannot create user in OWNER lab', async () => {
  const db = otherAdmin();
  const uid = 'crossUserUid000000000000000001';
  const profile = {
    uid, email: 'c@x.co', displayName: 'C', role: 'viewer', active: true,
    workspaceOwnerId: OWNER, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  const h = userHistory({
    id: 'ch_user_cross', action: 'create', entityId: uid,
    changes: [{ field: 'role', before: null, after: 'viewer' }],
    actorUid: OTHER_ADMIN, actorEmail: 'o@x.co', actorName: 'Other',
  });
  const b = writeBatch(db);
  b.set(doc(db, 'users', uid), profile);
  b.set(doc(db, 'changeHistory', h.id), h);
  await assertFails(b.commit());
});

await check('admin update user displayName + history atomic', async () => {
  const db = admin();
  const ref = doc(db, 'users', NEW_USER);
  const before = (await getDoc(ref)).data();
  const h = userHistory({
    id: 'ch_user_upd_1', action: 'update', entityId: NEW_USER,
    changes: [{ field: 'displayName', before: before.displayName, after: 'Sale Renamed' }],
  });
  const b = writeBatch(db);
  b.update(ref, { displayName: 'Sale Renamed', updatedAt: serverTimestamp() });
  b.set(doc(db, 'changeHistory', h.id), h);
  await assertSucceeds(b.commit());
});

await check('admin role transition sale→viewer + history allowed', async () => {
  const db = admin();
  const ref = doc(db, 'users', NEW_USER);
  const h = userHistory({
    id: 'ch_user_role_1', action: 'update', entityId: NEW_USER,
    changes: [{ field: 'role', before: 'sale', after: 'viewer' }],
  });
  const b = writeBatch(db);
  b.update(ref, { role: 'viewer', updatedAt: serverTimestamp() });
  b.set(doc(db, 'changeHistory', h.id), h);
  await assertSucceeds(b.commit());
});

await check('admin cannot change own role via update+history', async () => {
  const db = admin();
  const ref = doc(db, 'users', OWNER);
  const h = userHistory({
    id: 'ch_user_self_role', action: 'update', entityId: OWNER,
    changes: [{ field: 'role', before: 'admin', after: 'viewer' }],
  });
  const b = writeBatch(db);
  b.update(ref, { role: 'viewer', updatedAt: serverTimestamp() });
  b.set(doc(db, 'changeHistory', h.id), h);
  await assertFails(b.commit());
});

await check('non-admin cannot write undoOf history marker', async () => {
  const db = sale();
  const h = userHistory({
    id: 'undo_ch_user_create_1', action: 'delete', entityId: NEW_USER,
    changes: [{ field: 'role', before: 'viewer', after: null }],
    actorUid: SALE, actorEmail: 'sale@x.co', actorName: 'Sale',
    undoOf: 'ch_user_create_1',
  });
  await assertFails(setDoc(doc(db, 'changeHistory', h.id), h));
});

await check('representative paired multiwrite: 10 entities + 10 history (<<200)', async () => {
  const db = admin();
  const b = writeBatch(db);
  for (let i = 0; i < 10; i++) {
    const id = `order_pair_${i}`;
    const afterSnapshot = {
      warrantyCode: `W${i}`, patientName: 'P', phone: '0', clinicName: 'C', clinicAddress: 'A',
      material: 'M', warrantyPeriod: '15', warrantyYears: 15, orderDate: '07/11/2026', monthYear: '11/2026',
      teeth: '11', teethCount: 1, toothForm: 'F', unitPrice: 1, totalAmount: 1, notes: '',
      status: '', paymentStatus: 'unpaid',
    };
    b.set(doc(db, 'orders', id), {
      id, ownerId: OWNER, ...afterSnapshot,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    b.set(doc(db, 'changeHistory', `ch_pair_${i}`), orderHistory({
      id: `ch_pair_${i}`, entityId: id,
      changes: [
        { field: 'patientName', before: null, after: 'P' },
        { field: 'material', before: null, after: 'M' },
        { field: '_more', before: null, after: '+14 trường khác' },
      ],
      afterSnapshot,
    }));
  }
  await assertSucceeds(b.commit());
});

console.log('\n==== USER/HISTORY SUMMARY ====', { pass, fail });
await testEnv.cleanup();
process.exit(fail ? 1 : 0);
