import { deleteApp, initializeApp } from 'firebase/app';
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
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db } from '../lib/firebase';
import type { UpdateUserInput, UserProfile, UserRole } from '../types/user';

export function accountError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/email-already-in-use':
      return 'Email này đã có tài khoản.';
    case 'auth/weak-password':
      return 'Mật khẩu cần ít nhất 12 ký tự.';
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập.';
    case 'auth/too-many-requests':
      return 'Có quá nhiều lần thử. Vui lòng thử lại sau.';
    case 'auth/network-request-failed':
      return 'Không kết nối được. Vui lòng kiểm tra mạng.';
    case 'permission-denied':
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
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: input.displayName.trim(),
        role: input.role,
        active: true,
        workspaceOwnerId: admin.workspaceOwnerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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

export async function updateAccount(uid: string, changes: UpdateUserInput) {
  await updateDoc(doc(db, 'users', uid), { ...changes, updatedAt: serverTimestamp() });
}
