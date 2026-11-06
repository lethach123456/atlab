import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useNotify } from './AppNotifications';

interface LoginViewProps {
  login: (email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  error: string;
  busy: boolean;
}

function BrandMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <div
      className={`${className} rounded-[10px] bg-[#2563eb] flex items-center justify-center shrink-0`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-[55%] h-[55%] text-white"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 3C4.8 3 3 4.8 3 7c0 2.6 1.2 4.6 2 6.8.7 2 1.1 5.2 2.6 6.8.9 1 2.2.4 2.7-.9.5-1.3 1-2.7 1.7-2.7s1.2 1.4 1.7 2.7c.5 1.3 1.8 1.9 2.7.9 1.5-1.6 1.9-4.8 2.6-6.8.8-2.2 2-4.2 2-6.8 0-2.2-1.8-4-4-4-1.5 0-2.8.8-3.8 1.6-.7.5-1.7.5-2.4 0C9.8 3.8 8.5 3 7 3Z" />
      </svg>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  );
}

export const LoginView: React.FC<LoginViewProps> = ({
  login,
  googleLogin,
  error,
  busy,
}) => {
  const { notify } = useNotify();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    try {
      await login(email.trim(), password);
    } catch {
      const message = 'Sai email hoặc mật khẩu. Vui lòng thử lại.';
      setLocalError(message);
      notify({ tone: 'error', title: 'Đăng nhập thất bại', message, persist: true });
    }
  };

  const signInWithGoogle = async () => {
    setLocalError('');
    try {
      await googleLogin();
    } catch {
      const message = 'Đăng nhập Google chưa thành công. Thử lại.';
      setLocalError(message);
      notify({ tone: 'error', title: 'Đăng nhập Google', message, persist: true });
    }
  };

  const displayedError = error || localError;

  useEffect(() => {
    if (!error) return;
    notify({ tone: 'error', title: 'Đăng nhập', message: error, persist: true, id: `login:${error.slice(0, 120)}` });
  }, [error, notify]);
  const fieldClass =
    'login-field min-h-11 w-full rounded-[10px] border border-slate-200 bg-white pl-10 pr-3.5 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/18 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400';

  return (
    <main className="login-screen min-h-dvh w-full max-w-[100vw] overflow-x-hidden text-slate-900 dark:text-slate-100">
      {/* —— Mobile layout: navy brand band + light sheet —— */}
      <div className="lg:hidden flex min-h-dvh flex-col">
        <header className="login-mobile-hero relative shrink-0 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
          <div className="flex items-center gap-3">
            <BrandMark className="w-11 h-11" />
            <div className="min-w-0">
              <p className="font-display text-[17px] font-bold tracking-tight text-white leading-tight">
                AT Dental Lab
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-slate-300">Labo · Đà Nẵng</p>
            </div>
          </div>
          <h1
            id="login-heading"
            className="mt-7 font-display text-[28px] font-bold tracking-tight text-white leading-none"
          >
            Đăng nhập
          </h1>
        </header>

        <section
          aria-labelledby="login-heading"
          className="login-mobile-sheet relative z-10 -mt-3 flex flex-1 flex-col rounded-t-[22px] bg-white px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:bg-slate-900"
        >
          {displayedError && (
            <div
              id="login-error-mobile"
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{displayedError}</span>
            </div>
          )}

          <form
            onSubmit={submit}
            aria-busy={busy}
            aria-describedby={displayedError ? 'login-error-mobile' : undefined}
            className="space-y-4"
          >
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  required
                  disabled={busy}
                  placeholder="email@atdentallab.vn"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setLocalError('');
                  }}
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setLocalError('');
                  }}
                  className={`${fieldClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[8px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="login-primary mt-1 flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#1d4ed8] px-4 text-base font-semibold text-white transition-colors hover:bg-[#1e40af] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Đang đăng nhập…
                </>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-[12px] font-medium uppercase tracking-wide text-slate-400">hoặc</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <GoogleGlyph />
            Google
          </button>

          <p className="mt-auto pt-8 text-center text-[11px] text-slate-400">© AT Dental Lab</p>
        </section>
      </div>

      {/* —— Desktop layout: showcase + form column —— */}
      <div className="mx-auto hidden min-h-dvh w-full max-w-[1360px] grid-cols-12 overflow-hidden border border-slate-200/90 bg-white shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12)] lg:grid lg:min-h-[780px] lg:rounded-3xl dark:border-slate-800 dark:bg-slate-900 lg:my-6">
        <section className="relative col-span-7 flex flex-col justify-between overflow-hidden bg-[#0b1220] p-14 text-white">
          <div className="pointer-events-none absolute inset-0 login-desktop-wash" aria-hidden="true" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <BrandMark className="w-11 h-11" />
              <div>
                <span className="font-display block text-lg font-bold tracking-tight leading-none text-white">
                  AT DENTAL LABORATORY
                </span>
                <span className="mt-1 block text-xs text-slate-400">Labo răng sứ kỹ thuật số</span>
              </div>
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-400">Đà Nẵng</span>
          </div>

          <div className="relative z-10 max-w-xl space-y-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-sky-300/90 uppercase">Hệ thống labo</p>
            <h2
              className="font-display text-[40px] font-bold tracking-tight leading-[1.15] text-white"
              style={{ textWrap: 'balance' }}
            >
              Đơn hàng, bảo hành & công nợ theo thời gian thực.
            </h2>
            <p className="max-w-lg text-base leading-relaxed text-slate-300/90">
              Đồng bộ phiếu labo, thẻ bảo hành và đối soát công nợ nha khoa.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-400">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <span><span className="font-mono font-bold text-white tabular-nums">1200–1400 MPa</span> · Phôi sứ</span>
              <span><span className="font-mono font-bold text-white tabular-nums">10–15 năm</span> · Bảo hành</span>
            </div>
            <span className="font-mono text-[11px] tabular-nums">0903.589.987</span>
          </div>
        </section>

        <section
          aria-labelledby="login-heading-desktop"
          className="col-span-5 flex flex-col justify-between bg-white p-12 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-[#2563eb]" aria-hidden="true" />
              Cổng nội bộ Labo
            </span>
            <span className="font-mono tabular-nums">AT-ERP</span>
          </div>

          <div className="mx-auto my-auto w-full max-w-md py-8">
            <h1
              id="login-heading-desktop"
              className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              Đăng nhập
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Dùng tài khoản được cấp quyền.
            </p>

            {displayedError && (
              <div
                id="login-error-desktop"
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{displayedError}</span>
              </div>
            )}

            <form
              onSubmit={submit}
              aria-busy={busy}
              aria-describedby={displayedError ? 'login-error-desktop' : undefined}
              className="mt-6 space-y-4"
            >
              <div>
                <label htmlFor="login-email-desktop" className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="login-email-desktop"
                    type="email"
                    name="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    required
                    disabled={busy}
                    placeholder="email@atdentallab.vn"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setLocalError('');
                    }}
                    className={`${fieldClass} lg:text-sm`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password-desktop" className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="login-password-desktop"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setLocalError('');
                    }}
                    className={`${fieldClass} pr-12 lg:text-sm`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[8px] text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="login-primary mt-1 flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#1d4ed8] px-4 text-sm font-semibold text-white hover:bg-[#1e40af] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Đang đăng nhập…
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="text-[12px] font-medium uppercase tracking-wide text-slate-400">hoặc</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <GoogleGlyph />
              Google
            </button>
          </div>

          <p className="text-xs text-slate-400">© AT Dental Lab</p>
        </section>
      </div>
    </main>
  );
};
