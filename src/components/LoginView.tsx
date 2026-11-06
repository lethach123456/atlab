import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

interface LoginViewProps {
  login: (email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  error: string;
  busy: boolean;
}

function BrandMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <div
      className={`${className} rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(59,130,246,0.55)] shrink-0`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-[55%] h-[55%] text-white"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 3C4.8 3 3 4.8 3 7c0 2.6 1.2 4.6 2 6.8.7 2 1.1 5.2 2.6 6.8.9 1 2.2.4 2.7-.9.5-1.3 1-2.7 1.7-2.7s1.2 1.4 1.7 2.7c.5 1.3 1.8 1.9 2.7.9 1.5-1.6 1.9-4.8 2.6-6.8.8-2.2 2-4.2 2-6.8 0-2.2-1.8-4-4-4-1.5 0-2.8.8-3.8 1.6-.7.5-1.7.5-2.4 0C9.8 3.8 8.5 3 7 3Z" />
      </svg>
    </div>
  );
}

export const LoginView: React.FC<LoginViewProps> = ({
  login,
  googleLogin,
  error,
  busy,
}) => {
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
      setLocalError('Sai email hoặc mật khẩu. Vui lòng thử lại.');
    }
  };

  const signInWithGoogle = async () => {
    setLocalError('');
    try {
      await googleLogin();
    } catch {
      setLocalError('Đăng nhập Google chưa thành công. Thử lại.');
    }
  };

  const displayedError = error || localError;
  const fieldClass =
    'min-h-12 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 pl-10 pr-3.5 text-base lg:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-3 focus:ring-blue-500/15 disabled:opacity-60 transition-colors';

  return (
    <main className="login-screen relative isolate min-h-dvh w-full max-w-[100vw] overflow-x-hidden text-slate-900 dark:text-slate-100 flex flex-col justify-center lg:bg-slate-50 dark:lg:bg-slate-950 lg:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute inset-0 lg:hidden overflow-hidden" aria-hidden="true">
        <div className="login-screen__glow login-screen__glow--a" />
        <div className="login-screen__glow login-screen__glow--b" />
        <div className="login-screen__glow login-screen__glow--c" />
        <div className="login-screen__grid" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1360px] min-h-dvh lg:min-h-[780px] grid grid-cols-1 lg:grid-cols-12 bg-transparent lg:bg-white dark:lg:bg-slate-900 lg:rounded-3xl border-0 lg:border border-slate-200/90 dark:border-slate-800 shadow-none lg:shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12)] overflow-hidden">
        {/* Desktop-only marketing panel */}
        <section className="hidden lg:flex lg:col-span-7 relative bg-slate-950 text-white p-8 sm:p-12 lg:p-14 flex-col justify-between overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-25 cyber-grid" aria-hidden="true" />
          <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/25 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-28 right-0 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden="true" />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <BrandMark className="w-11 h-11" />
              <div>
                <span className="font-display text-lg font-bold tracking-tight text-white block leading-none">
                  AT DENTAL LABORATORY
                </span>
                <span className="text-xs text-slate-400 mt-1 block">
                  Labo răng sứ kỹ thuật số
                </span>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400 tabular-nums">Đà Nẵng</span>
          </div>

          <div className="relative z-10 my-10 lg:my-0 space-y-8">
            <div className="space-y-4 max-w-xl">
              <p className="text-xs font-semibold tracking-wider text-cyan-400">
                Hệ thống điều hành labo
              </p>
              <h2
                className="font-display text-3xl lg:text-[40px] font-bold tracking-tight text-white leading-[1.15]"
                style={{ textWrap: 'balance' }}
              >
                Đơn hàng, bảo hành & công nợ theo thời gian thực.
              </h2>
              <p className="text-base text-slate-300/90 leading-relaxed max-w-lg">
                Đồng bộ phiếu labo, thẻ bảo hành và đối soát công nợ nha khoa.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-5 sm:p-6 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
                <div className="text-xs font-semibold text-white">Quy trình labo</div>
                <span className="text-xs font-mono text-cyan-400 tabular-nums">FDI ISO-3950</span>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400">01. Phục hình</div>
                  <div className="text-sm font-semibold text-white">Mã BH & sơ đồ răng</div>
                </div>
                <div className="space-y-1 border-l border-slate-800 pl-4">
                  <div className="text-[11px] text-slate-400">02. Công nợ</div>
                  <div className="text-sm font-semibold text-white">Đối soát theo tháng</div>
                </div>
                <div className="space-y-1 border-l border-slate-800 pl-4">
                  <div className="text-[11px] text-slate-400">03. Báo cáo</div>
                  <div className="text-sm font-semibold text-white">Phân quyền đám mây</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-slate-800/80 flex items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <span className="font-mono font-bold text-white tabular-nums">1200–1400 MPa</span>
                <span className="mx-1.5 text-slate-600">·</span>
                <span>Phôi sứ CAD/CAM</span>
              </div>
              <div>
                <span className="font-mono font-bold text-white tabular-nums">10–15 năm</span>
                <span className="mx-1.5 text-slate-600">·</span>
                <span>Bảo hành</span>
              </div>
            </div>
            <div className="font-mono text-[11px] tabular-nums">0903.589.987</div>
          </div>
        </section>

        {/* Auth column */}
        <section
          aria-labelledby="login-heading"
          className="lg:col-span-5 px-4 py-6 sm:px-8 sm:py-10 lg:p-12 flex flex-col justify-center lg:justify-between bg-transparent lg:bg-white dark:lg:bg-slate-900 min-h-dvh lg:min-h-0 overflow-y-auto"
        >
          {/* Mobile brand over navy background */}
          <div className="lg:hidden mb-5 flex flex-col items-center text-center gap-3">
            <BrandMark className="w-12 h-12" />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold tracking-tight text-white">
                AT Dental Lab
              </p>
              <p className="text-xs font-medium text-cyan-200/90 mt-0.5">Đăng nhập</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              Cổng nội bộ Labo
            </span>
            <span className="font-mono tabular-nums">AT-ERP</span>
          </div>

          <div className="login-card my-auto w-full max-w-md mx-auto rounded-2xl border border-white/55 bg-white/95 p-5 shadow-[0_18px_50px_-18px_rgba(2,6,23,0.65),inset_0_1px_0_0_rgba(255,255,255,0.85)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-[0_18px_50px_-18px_rgba(0,0,0,0.7)] sm:p-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none dark:lg:bg-transparent">
            <div className="space-y-1.5">
              <h1
                id="login-heading"
                className="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Đăng nhập
              </h1>
              <p className="hidden sm:block text-sm text-slate-600 dark:text-slate-400">
                Dùng tài khoản được cấp quyền để vào hệ thống.
              </p>
            </div>

            {displayedError && (
              <div
                id="login-error"
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{displayedError}</span>
              </div>
            )}

            <form
              onSubmit={submit}
              aria-busy={busy}
              aria-describedby={displayedError ? 'login-error' : undefined}
              className="mt-5 space-y-3.5"
            >
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
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
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
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
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex min-h-12 min-w-12 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-2.5 text-base lg:text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.45)] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Đang đăng nhập…</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div
              className="my-4 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span>hoặc</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-base lg:text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
            >
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
              <span>Google</span>
            </button>

            <div className="mt-5 hidden lg:flex pt-3 border-t border-slate-100 dark:border-slate-800/80 items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                Kết nối bảo mật
              </span>
              <span>© AT Dental Lab</span>
            </div>
          </div>

          <p className="lg:hidden mt-5 text-center text-[11px] font-medium text-white/55">
            © AT Dental Lab
          </p>
        </section>
      </div>
    </main>
  );
};
