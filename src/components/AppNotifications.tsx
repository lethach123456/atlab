import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import {
  buildNotifyItem,
  createConfirmQueue,
  dismissNotification,
  enqueueNotification,
  notificationDedupeKey,
  recordDedupeHit,
  type NotifyItem,
  type NotifySpec,
  type NotifyTone,
} from '../utils/appNotifications';

type NotifyRequest = NotifySpec & {
  onAction?: () => void;
};

export type ConfirmSpec = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm (delete) */
  danger?: boolean;
};

type NotifyApi = {
  notify: (request: NotifyRequest) => string | null;
  dismiss: (id: string) => void;
  clear: () => void;
  confirm: (spec: ConfirmSpec) => Promise<boolean>;
};

const NotifyContext = createContext<NotifyApi | null>(null);

const toneMeta: Record<
  NotifyTone,
  { Icon: typeof AlertCircle; chip: string; icon: string; label: string }
> = {
  error: {
    Icon: AlertCircle,
    chip: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
    icon: 'text-rose-600 dark:text-rose-300',
    label: 'Lỗi',
  },
  success: {
    Icon: CheckCircle2,
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50',
    icon: 'text-emerald-700 dark:text-emerald-300',
    label: 'Thành công',
  },
  warning: {
    Icon: AlertTriangle,
    chip: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50',
    icon: 'text-amber-700 dark:text-amber-300',
    label: 'Cảnh báo',
  },
  info: {
    Icon: Info,
    chip: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50',
    icon: 'text-blue-700 dark:text-blue-300',
    label: 'Thông tin',
  },
};

type ConfirmState = ConfirmSpec & {
  resolve: (value: boolean) => void;
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<NotifyItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const recentKeys = useRef(new Map<string, number>());
  const actionsRef = useRef(new Map<string, () => void>());
  const timersRef = useRef(new Map<string, number>());
  const confirmQueueRef = useRef(createConfirmQueue());

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    clearTimer(id);
    actionsRef.current.delete(id);
    setQueue((current) => dismissNotification(current, id));
  }, [clearTimer]);

  const clear = useCallback(() => {
    for (const id of timersRef.current.keys()) clearTimer(id);
    actionsRef.current.clear();
    setQueue([]);
  }, [clearTimer]);

  const notify = useCallback((request: NotifyRequest) => {
    const now = Date.now();
    const draft = buildNotifyItem(request, now);
    const key = notificationDedupeKey(draft);
    if (recordDedupeHit(recentKeys.current, key, now)) return null;

    if (request.onAction) actionsRef.current.set(draft.id, request.onAction);
    else actionsRef.current.delete(draft.id);

    setQueue((current) => enqueueNotification(current, draft));

    clearTimer(draft.id);
    if (draft.dismissMs != null) {
      const timer = window.setTimeout(() => dismiss(draft.id), draft.dismissMs);
      timersRef.current.set(draft.id, timer);
    }
    return draft.id;
  }, [clearTimer, dismiss]);

  const confirm = useCallback((spec: ConfirmSpec) => {
    return confirmQueueRef.current.enqueue((resolve) => {
      setConfirmState({ ...spec, resolve });
    });
  }, []);

  const finishConfirm = useCallback((value: boolean) => {
    setConfirmState((current) => {
      if (!current) return null;
      current.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => () => {
    for (const id of timersRef.current.keys()) clearTimer(id);
    // Resolve any open confirm so awaiters do not hang after unmount.
    confirmQueueRef.current.cancelActive();
    setConfirmState(null);
  }, [clearTimer]);

  const api = useMemo<NotifyApi>(
    () => ({ notify, dismiss, clear, confirm }),
    [notify, dismiss, clear, confirm],
  );

  return (
    <NotifyContext.Provider value={api}>
      {children}
      <AppToastHost items={queue} onDismiss={dismiss} actionsRef={actionsRef} />
      {confirmState && (
        <AppConfirmDialog
          spec={confirmState}
          onCancel={() => finishConfirm(false)}
          onConfirm={() => finishConfirm(true)}
        />
      )}
    </NotifyContext.Provider>
  );
}

export function useNotify(): NotifyApi {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    return {
      notify: () => null,
      dismiss: () => undefined,
      clear: () => undefined,
      confirm: async () => false,
    };
  }
  return ctx;
}

function AppToastHost({
  items,
  onDismiss,
  actionsRef,
}: {
  items: NotifyItem[];
  onDismiss: (id: string) => void;
  actionsRef: React.MutableRefObject<Map<string, () => void>>;
}) {
  return (
    <div
      className="app-toast-host pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-stretch gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-end sm:px-5 lg:px-6"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {items.map((item) => {
        const meta = toneMeta[item.tone];
        const Icon = meta.Icon;
        const action = item.actionLabel ? actionsRef.current.get(item.id) : undefined;
        const polite = item.tone === 'success' || item.tone === 'info';
        return (
          <article
            key={item.id}
            role={polite ? 'status' : 'alert'}
            aria-label={`${meta.label}: ${item.title}`}
            className="app-toast pointer-events-auto mx-auto w-full max-w-[min(100%,22.5rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18),inset_0_1px_0_0_rgba(255,255,255,0.9)] backdrop-blur-sm sm:mx-0 dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-[0_12px_32px_-14px_rgba(0,0,0,0.55)]"
          >
            <div className="flex gap-3 px-3.5 py-3">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${meta.chip}`}
                aria-hidden="true"
              >
                <Icon className={`h-4 w-4 ${meta.icon}`} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.message}
                </p>
                {item.actionLabel && action && (
                  <button
                    type="button"
                    onClick={() => {
                      action();
                      onDismiss(item.id);
                    }}
                    className="mt-2.5 inline-flex min-h-9 items-center rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-teal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => onDismiss(item.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

function AppConfirmDialog({
  spec,
  onCancel,
  onConfirm,
}: {
  spec: ConfirmSpec;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Non-destructive first focus (Cancel), not the danger/confirm action.
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      // Capture so underlying modals/forms do not also handle Escape/Enter.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const nodes = getFocusable(root);
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const prev = restoreFocusRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        // Backdrop dismiss only; do not let click fall through to forms underneath.
        event.stopPropagation();
        if (event.target === event.currentTarget) onCancel();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-desc"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:bg-slate-900"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <h2 id="app-confirm-title" className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">
            {spec.title}
          </h2>
          <p id="app-confirm-desc" className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {spec.message}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {spec.cancelLabel || 'Hủy'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex min-h-10 items-center rounded-xl px-3.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 ${
              spec.danger
                ? 'bg-rose-600 hover:bg-rose-500 focus-visible:outline-rose-600'
                : 'bg-teal-700 hover:bg-teal-600 focus-visible:outline-teal-600'
            }`}
          >
            {spec.confirmLabel || 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
