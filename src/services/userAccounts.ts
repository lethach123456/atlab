import { deleteApp, getApp, initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db } from '../lib/firebase';
import { recordChangeHistoryBestEffort, plainRecord } from './changeHistory';
import type { UpdateUserInput, UserProfile, UserRole } from '../types/user';

export function accountError(error: unknown): string {
  const { code, details } = (error ?? {}) as { code?: string; details?: { reason?: string } };
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/email-already-in-use':
    case 'functions/already-exists':
      return 'Email này đã có tài khoản.';
    case 'functions/invalid-argument':
      return 'Email đăng nhập không hợp lệ.';
    case 'functions/failed-precondition':
      if (details?.reason === 'unsupported-provider') return 'Tài khoản dùng phương thức đăng nhập khác email và mật khẩu.';
      return 'Thông tin tài khoản đã thay đổi. Mở lại form Sửa rồi thử lại.';
    case 'functions/unauthenticated':
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 'functions/not-found':
      if (details?.reason === 'sale-auth-not-found') return 'Không tìm thấy tài khoản đăng nhập của sale.';
      return 'Chức năng đổi email chưa có trên Firebase. Vui lòng liên hệ quản trị dự án.';
    case 'functions/aborted':
      return 'Tài khoản đang được cập nhật. Vui lòng thử lại sau.';
    case 'functions/unavailable':
      if (details?.reason === 'profile-sync-pending') return 'Email đăng nhập đã đổi. Bấm Lưu lại với cùng email để đồng bộ hồ sơ.';
      return 'Chưa kết nối được chức năng đổi email trên Firebase. Vui lòng thử lại sau.';
    case 'functions/internal':
    case 'functions/deadline-exceeded':
      return 'Chưa lưu được email qua Firebase. Vui lòng thử lại sau.';
    case 'account/profile-update-after-email':
      return 'Đã đổi email đăng nhập. Các thay đổi khác chưa được lưu, vui lòng thử lại.';
    case 'auth/weak-password':
      return 'Mật khẩu cần ít nhất 12 ký tự.';
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập.';
    case 'auth/too-many-requests':
      return 'Có quá nhiều lần thử. Vui lòng thử lại sau.';
    case 'auth/network-request-failed':
      return 'Không kết nối được. Vui lòng kiểm tra mạng.';
    case 'permission-denied':
    case 'functions/permission-denied':
      return 'Tài khoản chưa có quyền thực hiện thao tác này.';
    default:
      return 'Không thực hiện được thao tác. Vui lòng thử lại.';
  }
}

export function subscribeUserProfile(uid: string, onProfile: (profile: UserProfile | null) => void, onError: () => void) {
  return onSnapshot(doc(db, 'users', uid), (snapshot) => {
    if (!snapshot.exists()) {
      onProfile(null);
      return;
    }
    const data = snapshot.data();
    onProfile({ ...data, uid: snapshot.id, createdAt: data.createdAt?.toMillis?.() } as UserProfile);
  }, onError);
}

export function subscribeUsers(ownerId: string, onUsers: (users: UserProfile[]) => void, onError: () => void) {
  return onSnapshot(query(collection(db, 'users'), where('workspaceOwnerId', '==', ownerId)), (snapshot) => {
    onUsers(snapshot.docs.map((item) => {
      const data = item.data();
      return { ...data, uid: item.id, createdAt: data.createdAt?.toMillis?.() } as UserProfile;
    }).sort((a, b) => a.email.localeCompare(b.email)));
  }, onError);
}

export async function createAccount(
  admin: UserProfile,
  input: { email: string; password: string; displayName: string; role: UserRole }
): Promise<void> {
  if (admin.role !== 'admin' || !admin.active || auth.currentUser?.uid !== admin.uid) {
    throw new Error('Admin session required');
  }
  if (input.password.length < 12) throw { code: 'auth/weak-password' };
  const secondary = initializeApp(firebaseConfig, 'create-user-' + crypto.randomUUID());
  const secondaryAuth = getAuth(secondary);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email.trim(), input.password);
    try {
      const profileDoc = {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: input.displayName.trim(),
        role: input.role,
        active: true,
        workspaceOwnerId: admin.workspaceOwnerId,
      };
      await setDoc(doc(db, 'users', credential.user.uid), {
        ...profileDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Password is never written to history. History write is best-effort after profile create.
      await recordChangeHistoryBestEffort(admin.workspaceOwnerId, {
        action: 'create',
        entityType: 'users',
        entityId: credential.user.uid,
        before: null,
        after: profileDoc,
      });
    } catch (error) {
      await deleteUser(credential.user).catch(() => undefined);
      throw error;
    }
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondary);
  }
}

export async function updateAccount(uid: string, { emailChange, ...changes }: UpdateUserInput) {
  if (emailChange) {
    const updateSaleEmail = httpsCallable<{ uid: string; email: string; expectedEmail: string }, { email: string }>(
      getFunctions(getApp(), 'us-central1'), 'updateSaleEmail',
    );
    await updateSaleEmail({ uid, ...emailChange });
  }

  if (Object.keys(changes).length > 0) {
    try {
      const ref = doc(db, 'users', uid);
      const beforeSnap = await getDoc(ref);
      const before = beforeSnap.exists() ? plainRecord(beforeSnap.data()) : null;
      await updateDoc(ref, { ...changes, updatedAt: serverTimestamp() });
      const ownerId = String(before?.workspaceOwnerId || auth.currentUser?.uid || '');
      if (ownerId) {
        await recordChangeHistoryBestEffort(ownerId, {
          action: 'update',
          entityType: 'users',
          entityId: uid,
          before,
          after: { ...(before || {}), ...changes },
        });
      }
    } catch (error) {
      if (emailChange) throw { code: 'account/profile-update-after-email' };
      throw error;
    }
  }
}
