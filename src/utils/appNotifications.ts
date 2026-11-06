/** Pure helpers for app toast queue / dedupe (no React). */

export type NotifyTone = 'error' | 'success' | 'warning' | 'info';

export interface NotifySpec {
  tone: NotifyTone;
  title: string;
  message: string;
  /** Optional action button label (handler lives in React layer). */
  actionLabel?: string;
  /**
   * true = stay until dismissed;
   * false = auto-dismiss with tone default;
   * omit = error persists, warning ~8s, success/info ~4s
   */
  persist?: boolean;
  /** Stable id for dedupe / replace. Auto-generated if omitted. */
  id?: string;
}

export interface NotifyItem {
  id: string;
  tone: NotifyTone;
  title: string;
  message: string;
  actionLabel?: string;
  createdAt: number;
  /** null means persist until user closes */
  dismissMs: number | null;
}

export function sanitizeNotifyText(text: string, max = 280): string {
  return text
    .replace(/ghp_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function notificationDedupeKey(spec: Pick<NotifySpec, 'tone' | 'title' | 'message'>): string {
  // Message-primary: App sync banner + local catch often share the same body with different titles.
  return `${spec.tone}|${sanitizeNotifyText(spec.message, 200)}`;
}

export function defaultDismissMs(tone: NotifyTone, persist?: boolean): number | null {
  if (persist === true) return null;
  if (persist === false) {
    if (tone === 'error') return 12_000;
    if (tone === 'warning') return 8_000;
    return 4_000;
  }
  if (tone === 'success' || tone === 'info') return 4_000;
  if (tone === 'warning') return 8_000;
  return null;
}

/** Returns true when this key was seen within windowMs (caller should skip enqueue). */
export function recordDedupeHit(
  recent: Map<string, number>,
  key: string,
  now: number,
  windowMs = 4_000,
): boolean {
  const last = recent.get(key);
  if (last != null && now - last < windowMs) return true;
  recent.set(key, now);
  // prune old entries
  for (const [k, t] of recent) {
    if (now - t > windowMs * 3) recent.delete(k);
  }
  return false;
}

export function buildNotifyItem(spec: NotifySpec, now = Date.now()): NotifyItem {
  const title = sanitizeNotifyText(spec.title, 80) || 'Thông báo';
  const message = sanitizeNotifyText(spec.message, 280) || 'Đã có cập nhật.';
  const id = spec.id?.trim() || notificationDedupeKey({ tone: spec.tone, title, message });
  return {
    id,
    tone: spec.tone,
    title,
    message,
    actionLabel: spec.actionLabel?.trim() || undefined,
    createdAt: now,
    dismissMs: defaultDismissMs(spec.tone, spec.persist),
  };
}

export function enqueueNotification(
  queue: NotifyItem[],
  item: NotifyItem,
  max = 4,
): NotifyItem[] {
  const without = queue.filter((entry) => entry.id !== item.id);
  return [...without, item].slice(-Math.max(1, max));
}

export function dismissNotification(queue: NotifyItem[], id: string): NotifyItem[] {
  return queue.filter((entry) => entry.id !== id);
}


/** Serial confirm queue: one dialog at a time; settle/cancel safely. */
export type ConfirmResolver = (value: boolean) => void;

export function createConfirmQueue() {
  let chain: Promise<unknown> = Promise.resolve();
  let active: ConfirmResolver | null = null;

  function settle(value: boolean) {
    const resolve = active;
    active = null;
    resolve?.(value);
  }

  return {
    /** Enqueue a confirm; `open` receives a once-only resolver. */
    enqueue(open: (resolve: ConfirmResolver) => void): Promise<boolean> {
      const run = () =>
        new Promise<boolean>((resolve) => {
          let done = false;
          const once: ConfirmResolver = (value) => {
            if (done) return;
            done = true;
            if (active === once) active = null;
            resolve(value);
          };
          active = once;
          open(once);
        });
      const next = chain.then(run, run);
      chain = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
    settle,
    /** Resolve current confirm as false (unmount / abort). */
    cancelActive() {
      settle(false);
    },
    hasActive() {
      return active != null;
    },
  };
}
