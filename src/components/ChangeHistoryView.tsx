import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { History as HistoryIcon, Loader2, RefreshCw, Search } from 'lucide-react';
import {
  CHANGE_HISTORY_PAGE_SIZE,
  fetchChangeHistoryPage,
  type ChangeHistoryEntry,
} from '../services/changeHistory';
import { ENTITY_LABELS, actionLabelVi, type ChangeAction } from '../utils/changeDiff';

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
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        setError('Không tải được lịch sử thay đổi. Kiểm tra quyền quản trị và kết nối mạng.');
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
    </div>
  );
};
