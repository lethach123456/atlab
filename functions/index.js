import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineJsonSecret } from 'firebase-functions/params';
import { buildWarrantyResult } from './warrantyLookup.js';

initializeApp();

// The app uses this named database, rather than the project's default database.
const db = getFirestore('ai-studio-atdentallabqunll-228a6161-2408-4bb9-ba0f-db8a7fd91902');
const auth = getAuth();
const validUid = /^[A-Za-z0-9_-]{1,128}$/;
const leaseDurationMs = 5 * 60 * 1000;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export const updateSaleEmail = onCall({ region: 'us-central1', timeoutSeconds: 60 }, async (request) => {
  if (!request.auth || !validUid.test(request.auth.uid)) {
    throw new HttpsError('unauthenticated', 'Vui lòng đăng nhập lại.');
  }

  const callerUid = request.auth.uid;
  const { uid, email: rawEmail, expectedEmail } = request.data ?? {};
  const email = normalizeEmail(rawEmail);
  if (typeof uid !== 'string' || !validUid.test(uid) || uid === callerUid ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (expectedEmail !== undefined && (typeof expectedEmail !== 'string' || expectedEmail.length > 254))) {
    throw new HttpsError('invalid-argument', 'Tài khoản hoặc email mới không hợp lệ.');
  }

  const bearer = request.rawRequest.get('authorization')?.match(/^Bearer (\S+)$/i);
  try {
    const decoded = bearer && await auth.verifyIdToken(bearer[1], true);
    if (decoded?.uid !== callerUid) throw new Error('Invalid authenticated session');
  } catch (error) {
    if (['auth/internal-error', 'auth/insufficient-permission'].includes(error?.code)) {
      logger.error('Sale email authorization could not be verified', { code: error.code });
      throw new HttpsError('internal', 'Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.');
    }
    throw new HttpsError('unauthenticated', 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.');
  }

  const caller = db.collection('users').doc(callerUid);
  const target = db.collection('users').doc(uid);
  // Admin SDK access only. Serializes requests for the same account across instances.
  const lease = db.collection('saleEmailUpdateLocks').doc(uid);
  const operationId = randomUUID();
  let leaseAcquired = false;
  let authEmailReady = false;

  try {
    await db.runTransaction(async (tx) => {
      const [callerSnap, targetSnap, leaseSnap] = await tx.getAll(caller, target, lease);
      const admin = callerSnap.data();
      const sale = targetSnap.data();
      if (admin?.role !== 'admin' || admin.active !== true || !admin.workspaceOwnerId ||
          sale?.role !== 'sale' || sale.workspaceOwnerId !== admin.workspaceOwnerId) {
        throw new HttpsError('permission-denied', 'Chỉ quản trị viên được đổi email cho sale cùng labo.');
      }
      const previousEmail = normalizeEmail(sale.email);
      if (expectedEmail !== undefined && previousEmail !== normalizeEmail(expectedEmail) && previousEmail !== email) {
        throw new HttpsError('failed-precondition', 'Email đã được thay đổi. Vui lòng mở lại form Sửa.');
      }
      if (leaseSnap.data()?.expiresAt > Date.now()) {
        throw new HttpsError('aborted', 'Tài khoản đang được cập nhật. Vui lòng thử lại.');
      }
      tx.set(lease, { operationId, expiresAt: Date.now() + leaseDurationMs });
    });
    leaseAcquired = true;

    const user = await auth.getUser(uid);
    // A linked provider can keep accepting its old login after the primary email changes.
    if (user.providerData.length !== 1 || user.providerData[0].providerId !== 'password') {
      throw new HttpsError('failed-precondition', 'Chỉ hỗ trợ tài khoản sale đăng nhập bằng email và mật khẩu.', { reason: 'unsupported-provider' });
    }

    const updated = normalizeEmail(user.email) === email
      ? user
      : await auth.updateUser(uid, { email, emailVerified: false });
    authEmailReady = true;

    // Authentication and Firestore cannot commit atomically. Retrying the same
    // email skips the Auth write and can finish a previously interrupted sync.
    await db.runTransaction(async (tx) => {
      const lock = await tx.get(lease);
      if (lock.data()?.operationId !== operationId) {
        throw new HttpsError('aborted', 'Phiên cập nhật đã hết hạn. Vui lòng thử lại.');
      }
      tx.update(target, { email: updated.email, updatedAt: FieldValue.serverTimestamp() });
      tx.delete(lease);
    });
    leaseAcquired = false;
    return { email: updated.email };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Email này đã được tài khoản khác sử dụng.');
    }
    if (error?.code === 'auth/invalid-email') throw new HttpsError('invalid-argument', 'Email mới không hợp lệ.');
    if (error?.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'Không tìm thấy tài khoản đăng nhập của sale.', { reason: 'sale-auth-not-found' });
    }
    logger.error('Sale email update failed', { code: error?.code, authEmailReady });
    if (authEmailReady) {
      throw new HttpsError('unavailable', 'Email đăng nhập đã cập nhật. Hãy lưu lại cùng email để đồng bộ hồ sơ.', { reason: 'profile-sync-pending' });
    }
    throw new HttpsError('internal', 'Chưa hoàn tất đổi email. Vui lòng thử lại với cùng email.');
  } finally {
    if (leaseAcquired) {
      try {
        await db.runTransaction(async (tx) => {
          if ((await tx.get(lease)).data()?.operationId === operationId) tx.delete(lease);
        });
      } catch (error) {
        logger.warn('Sale email update lock will expire automatically', { code: error?.code });
      }
    }
  }
});

const warrantyApiConfig = defineJsonSecret('WARRANTY_API_CONFIG');
// The key is held by the calling website's backend, never embedded in browser code.
export const lookupWarranty = onRequest({ region: 'us-central1', cors: false, secrets: ['WARRANTY_API_CONFIG'], maxInstances: 3, timeoutSeconds: 15 }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).set('Allow', 'GET').json({ error: 'method_not_allowed' });
  const suppliedKey = req.get('x-api-key') || '';
  const config = warrantyApiConfig.value();
  const expectedKey = config?.apiKey;
  const digest = value => createHash('sha256').update(value).digest();
  if (typeof expectedKey !== 'string' || !expectedKey || typeof config?.ownerId !== 'string' || !validUid.test(config.ownerId) || !suppliedKey || suppliedKey.length > 256 || !timingSafeEqual(digest(suppliedKey), digest(expectedKey))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const input = req.query.code;
  if (typeof input !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(input.trim())) {
    return res.status(400).json({ error: 'invalid_code' });
  }
  const code = input.trim().toUpperCase();
  try {
    const snapshot = await db.collection('orders').where('warrantyCode', '==', code).limit(101).get();
    if (snapshot.empty) return res.status(404).json({ error: 'not_found' });
    if (snapshot.size > 100) return res.status(409).json({ error: 'ambiguous_code' });
    const records = snapshot.docs.map(doc => doc.data()).filter(row => row.ownerId === config.ownerId);
    if (!records.length) return res.status(404).json({ error: 'not_found' });
    const result = buildWarrantyResult(code, records);
    if (!result) return res.status(409).json({ error: 'ambiguous_code' });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Warranty lookup failed', { code: error?.code });
    return res.status(503).json({ error: 'unavailable' });
  }
});
