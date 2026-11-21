import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, User } from 'firebase/auth';
import { Loader2, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { accountError, subscribeUserProfile } from '../services/userAccounts';
import { resolveAuthAccess } from '../utils/authSession';
import type { UserProfile } from '../types/user';
import { LoginView } from './LoginView';

export function AuthGate({ children }: { children: (profile: UserProfile) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (next) => {
    const previousId = userIdRef.current;
    const nextId = next?.uid ?? null;
    userIdRef.current = nextId;
    setUser(next);
    setAuthReady(true);
    if (previousId !== nextId) {
      setProfile(null);
      setProfileResolved(false);
      setProfileError(false);
      setError('');
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    return subscribeUserProfile(user.uid, (next) => {
      setProfile(next);
      setProfileResolved(true);
      setProfileError(false);
      setError('');
    }, () => {
      setProfileError(true);
      setError('Không đọc được quyền truy cập. Kiểm tra kết nối rồi thử lại — phiên đăng nhập vẫn được giữ.');
    });
  }, [user, retryToken]);

  const retryProfile = useCallback(() => {
    setProfileError(false);
    setError('');
    if (!profile) setProfileResolved(false);
    setRetryToken((value) => value + 1);
  }, [profile]);

  async function login(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(accountError(error));
    } finally {
      setBusy(false);
    }
  }

  const access = resolveAuthAccess({
    authReady,
    user,
    profile,
    profileResolved,
    profileError,
  });

  if (access === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950 p-6 text-slate-900 dark:text-slate-100">
        <div role="status" className="flex flex-col items-center gap-3 text-center">
          <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold">Đang kiểm tra phiên đăng nhập AT Dental Lab…</p>
        </div>
      </main>
    );
  }
  if (access === 'login' || !user) {
    return <LoginView
      login={(email, password) => login(() => signInWithEmailAndPassword(auth, email, password))}
      googleLogin={() => login(() => signInWithPopup(auth, googleProvider))}
      error={error}
      busy={busy}
    />;
  }
  if (access === 'profile_unavailable') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950 p-4 text-slate-900 dark:text-slate-100">
        <section className="bento-card max-w-md w-full space-y-4 rounded-2xl p-6 sm:p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <RefreshCw className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-xl font-bold">Chưa tải được quyền truy cập</h1>
          <p role="alert" className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {error || 'Không đọc được quyền truy cập. Kiểm tra kết nối rồi thử lại — phiên đăng nhập vẫn được giữ.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={retryProfile}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Tải lại quyền truy cập</span>
            </button>
            <button
              type="button"
              onClick={() => { setError(''); void signOut(auth); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </section>
      </main>
    );
  }
  if (access === 'blocked' || !profile?.active) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950 p-4 text-slate-900 dark:text-slate-100">
        <section className="bento-card max-w-md w-full space-y-4 rounded-2xl p-6 sm:p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-xl font-bold">Quyền truy cập tài khoản</h1>
          <p role="alert" className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {error || 'Tài khoản chưa được cấp quyền hoặc đã bị khóa. Vui lòng liên hệ quản trị viên AT Dental Lab.'}
          </p>
          <button
            type="button"
            onClick={() => { setError(''); void signOut(auth); }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Đăng xuất tài khoản</span>
          </button>
        </section>
      </main>
    );
  }
  return <>{children(profile)}</>;
}
