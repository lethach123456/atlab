import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { History as HistoryIcon, Loader2, RefreshCw, RotateCcw, Search, X } from 'lucide-react';
import {
  CHANGE_HISTORY_PAGE_SIZE,
  fetchChangeHistoryPage,
  type ChangeHistoryEntry,
} from '../services/changeHistory';
import {
  describeUndoAvailability,
  undoChangeHistoryEntry,
} from '../services/changeHistoryUndo';
import { ENTITY_LABELS, actionLabelVi, type ChangeAction } from '../utils/changeDiff';
import { useNotify } from './AppNotifications';

interface ChangeHistoryViewProps {
  ownerId: string;
}

const ENTITY_FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'Tất cả' },
  ...Object.entries(ENTITY_LABELS).map(([id, label]) => ({ id, label })),
];

function formatTimeAsiaSaigon(ms: number): string {
  if (!ms) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString('vi-VN');
  }
}

function actionBadgeClass(action: ChangeAction): string {
  if (action === 'create') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (action === 'delete') return 'bg-rose-500/10 text-rose-700 dark:text-rose-400';
  return 'bg-sky-500/10 text-sky-700 dark:text-sky-400';
}

export const ChangeHistoryView: React.FC<ChangeHistoryViewProps> = ({ ownerId }) => {
  const [entries, setEntries] = useState<ChangeHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { notify } = useNotify();
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<ChangeHistoryEntry | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');
  const [undoError, setUndoError] = useState('');

  const load = useCallback(
    async (mode: 'reset' | 'more', pageCursor: QueryDocumentSnapshot | null = null) => {
      if (!ownerId) return;
      if (mode === 'reset') {
        setLoading(true);
        setError('');
      } else {
        setLoadingMore(true);
      }
      try {
        const page = await fetchChangeHistoryPage({
          ownerId,
          pageSize: CHANGE_HISTORY_PAGE_SIZE,
          cursor: mode === 'more' ? pageCursor : null,
          entityType: entityType || undefined,
        });
        setEntries((prev) => (mode === 'more' ? [...prev, ...page.entries] : page.entries));
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      } catch {
        const message = 'Không tải được lịch sử thay đổi. Kiểm tra quyền quản trị và kết nối mạng.';
        setError(message);
        notify({ tone: 'error', title: 'Lịch sử thay đổi', message, persist: true });
        if (mode === 'reset') {
          setEntries([]);
          setCursor(null);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [ownerId, entityType]
  );

  useEffect(() => {
    void load('reset', null);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const hay = [
        entry.summary,
        entry.entityLabel,
        entry.actorName,
        entry.actorEmail,
        entry.entityId,
        entry.entityType,
        ...entry.changes.flatMap((c) => [c.field, c.before || '', c.after || '']),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, search]);

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <HistoryIcon className="w-4 h-4 text-teal-600" />
              Lịch sử thay đổi
            </h2>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Chỉ tài khoản quản trị xem được nhật ký này. Thay đổi được ghi từ lúc bật tính năng trở đi —
              dữ liệu cũ chưa từng ghi log không thể dựng lại. Nhật ký ghi từ máy khách cùng lần lưu
              (không phải sổ bất biến phía máy chủ).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void load('reset', null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Tải lại
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo người, nội dung, trường…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {ENTITY_FILTERS.map((opt) => (
              <option key={opt.id || 'all'} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400 px-1">
          {error}
        </p>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải lịch sử…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 px-4 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Chưa có bản ghi lịch sử</p>
            <p>Thao tác tạo/sửa/xóa sau khi bật tính năng sẽ xuất hiện ở đây (mới nhất trước).</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((entry) => {
              const open = expandedId === entry.id;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : entry.id)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${actionBadgeClass(entry.action)}`}>
                        {actionLabelVi(entry.action)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {ENTITY_LABELS[entry.entityType] || entry.entityType}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 ml-auto">
                        {formatTimeAsiaSaigon(entry.createdAtMs)}
                        <span className="ml-1 text-slate-300 dark:text-slate-600">(Asia/Saigon)</span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {entry.entityLabel || entry.summary}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {entry.actorName}
                      {entry.actorEmail ? ` · ${entry.actorEmail}` : ''}
                      <span className="text-slate-400"> · id {entry.entityId}</span>
                    </p>
                  </button>
                  {open && (
                    <div className="px-3.5 pb-3">
                      {entry.changes.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Không có khác biệt trường để hiển thị.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                          <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500">
                              <tr>
                                <th className="text-left font-bold px-2 py-1.5">Trường</th>
                                <th className="text-left font-bold px-2 py-1.5">Trước</th>
                                <th className="text-left font-bold px-2 py-1.5">Sau</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {entry.changes.map((change) => (
                                <tr key={`${entry.id}-${change.field}`}>
                                  <td className="px-2 py-1.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                    {change.field}
                                  </td>
                                  <td className="px-2 py-1.5 text-rose-700/90 dark:text-rose-300 break-all">
                                    {change.before ?? '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-emerald-700/90 dark:text-emerald-300 break-all">
                                    {change.after ?? '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {(() => {
                        const availability = describeUndoAvailability(entry);
                        return (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {availability.canUndo ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUndoError('');
                                  setUndoMessage('');
                                  setConfirmEntry(entry);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 cursor-pointer hover:bg-amber-500/15"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Hoàn tác
                              </button>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic max-w-xl">
                                {availability.reason}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && !loading && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void load('more', cursor)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-60"
            >
              {loadingMore ? 'Đang tải…' : 'Xem thêm'}
            </button>
          </div>
        )}
      </div>

      {(undoMessage || undoError) && (
        <p
          role={undoError ? 'alert' : 'status'}
          className={`text-xs font-medium px-1 ${
            undoError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {undoError || undoMessage}
        </p>
      )}

      {confirmEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Xác nhận hoàn tác</h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Thao tác này sẽ đảo ngược thay đổi trên bản ghi nghiệp vụ nếu dữ liệu hiện tại vẫn khớp trạng thái sau khi sửa.
                </p>
              </div>
              <button
                type="button"
                disabled={undoBusy}
                onClick={() => setConfirmEntry(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] dark:border-slate-800 dark:bg-slate-950">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {actionLabelVi(confirmEntry.action)} · {ENTITY_LABELS[confirmEntry.entityType] || confirmEntry.entityType}
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">{confirmEntry.entityLabel}</p>
              <p className="mt-0.5 font-mono text-slate-400">id {confirmEntry.entityId}</p>
              {confirmEntry.changes.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {confirmEntry.changes.map((change) => (
                    <li key={`${confirmEntry.id}-confirm-${change.field}`} className="font-mono">
                      <span className="text-slate-500">{change.field}</span>:{' '}
                      <span className="text-rose-600 dark:text-rose-300">{change.before ?? '—'}</span>
                      {' → '}
                      <span className="text-emerald-600 dark:text-emerald-300">{change.after ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={undoBusy}
                onClick={() => setConfirmEntry(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={undoBusy}
                onClick={() => {
                  void (async () => {
                    if (!confirmEntry) return;
                    setUndoBusy(true);
                    setUndoError('');
                    setUndoMessage('');
                    try {
                      const result = await undoChangeHistoryEntry({
                        ownerId,
                        entry: confirmEntry,
                      });
                      setUndoMessage(result.message);
                      notify({ tone: 'success', title: 'Đã hoàn tác', message: result.message });
                      setConfirmEntry(null);
                      await load('reset', null);
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : 'Không hoàn tác được. Vui lòng thử lại.';
                      setUndoError(message);
                      notify({ tone: 'error', title: 'Hoàn tác thất bại', message, persist: true });
                    } finally {
                      setUndoBusy(false);
                    }
                  })();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-500 cursor-pointer disabled:opacity-60"
              >
                {undoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Xác nhận hoàn tác
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
