import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, User } from 'firebase/auth';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { accountError, subscribeUserProfile } from '../services/userAccounts';
import type { UserProfile } from '../types/user';
import { LoginView } from './LoginView';

export function AuthGate({ children }: { children: (profile: UserProfile) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next);
    setProfile(null);
    setProfileReady(false);
    setReady(true);
  }), []);

  useEffect(() => {
    if (!user) return;
    return subscribeUserProfile(user.uid, (next) => {
      setProfile(next);
      setProfileReady(true);
    }, () => {
      setError('Không đọc được quyền truy cập. Kiểm tra kết nối rồi tải lại trang.');
      setProfileReady(true);
    });
  }, [user]);

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

  if (!ready || (user && !profileReady)) {
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
  if (!user) {
    return <LoginView
      login={(email, password) => login(() => signInWithEmailAndPassword(auth, email, password))}
      googleLogin={() => login(() => signInWithPopup(auth, googleProvider))}
      error={error}
      busy={busy}
    />;
  }
  if (!profile?.active) {
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
