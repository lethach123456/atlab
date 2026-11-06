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

type NotifyApi = {
  notify: (request: NotifyRequest) => string | null;
  dismiss: (id: string) => void;
  clear: () => void;
};

const NotifyContext = createContext<NotifyApi | null>(null);

const toneMeta: Record<
  NotifyTone,
  { Icon: typeof AlertCircle; bar: string; icon: string; label: string }
> = {
  error: {
    Icon: AlertCircle,
    bar: 'border-l-[#dc2626]',
    icon: 'text-[#dc2626]',
    label: 'Lỗi',
  },
  success: {
    Icon: CheckCircle2,
    bar: 'border-l-[#059669]',
    icon: 'text-[#059669]',
    label: 'Thành công',
  },
  warning: {
    Icon: AlertTriangle,
    bar: 'border-l-[#d97706]',
    icon: 'text-[#d97706]',
    label: 'Cảnh báo',
  },
  info: {
    Icon: Info,
    bar: 'border-l-[#2563eb]',
    icon: 'text-[#2563eb]',
    label: 'Thông tin',
  },
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<NotifyItem[]>([]);
  const recentKeys = useRef(new Map<string, number>());
  const actionsRef = useRef(new Map<string, () => void>());
  const timersRef = useRef(new Map<string, number>());

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

  useEffect(() => () => {
    for (const id of timersRef.current.keys()) clearTimer(id);
  }, [clearTimer]);

  const api = useMemo<NotifyApi>(() => ({ notify, dismiss, clear }), [notify, dismiss, clear]);

  return (
    <NotifyContext.Provider value={api}>
      {children}
      <AppToastHost items={queue} onDismiss={dismiss} actionsRef={actionsRef} />
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
      className="app-toast-host pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-end gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-4"
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
            className={`app-toast pointer-events-auto w-full max-w-[min(100%,24rem)] overflow-hidden rounded-[12px] border border-slate-200/90 border-l-4 ${meta.bar} bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:bg-slate-900`}
          >
            <div className="flex gap-3 p-3.5">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.icon}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  {item.title}
                </p>
                <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-300">
                  {item.message}
                </p>
                {item.actionLabel && action && (
                  <button
                    type="button"
                    onClick={() => {
                      action();
                      onDismiss(item.id);
                    }}
                    className="mt-2.5 inline-flex min-h-9 items-center rounded-[8px] bg-[#1d4ed8] px-3 text-xs font-semibold text-white hover:bg-[#1e40af] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => onDismiss(item.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
