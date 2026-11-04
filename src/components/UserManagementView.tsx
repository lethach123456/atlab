import React, { useState } from 'react';
import { Loader2, Pencil, Plus, Users } from 'lucide-react';
import type { CreateUserInput, UpdateUserInput, UserProfile, UserRole } from '../types/user';

interface UserManagementViewProps {
  users: UserProfile[];
  currentUserId: string;
  onCreate: (input: CreateUserInput) => Promise<void>;
  onUpdate: (uid: string, changes: UpdateUserInput) => Promise<void>;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ users, currentUserId, onCreate, onUpdate }) => {
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [role, setRole] = useState<UserRole>('sale');

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const displayName = String(values.get('displayName') ?? '').trim();
    const email = String(values.get('email') ?? '').trim();
    const password = String(values.get('password') ?? '');
    setError('');
    setNotice('');
    if (!displayName || !email) {
      setError('Nhập tên người dùng và email.');
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      setError('Email này đã có trong danh sách người dùng.');
      return;
    }
    setCreating(true);
    try {
      await onCreate({ displayName, email, password, role });
      form.reset();
      setRole('sale');
      setAdding(false);
      setNotice(`Đã tạo tài khoản ${email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa tạo được người dùng. Vui lòng thử lại.');
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser || updatingId) return;
    const values = new FormData(event.currentTarget);
    const displayName = String(values.get('displayName') ?? '').trim();
    if (!displayName) {
      setError('Nhập họ tên người dùng.');
      return;
    }
    const changes: UpdateUserInput = {};
    if (displayName !== editingUser.displayName) changes.displayName = displayName;
    if (editingUser.uid !== currentUserId) {
      const role = values.get('role');
      const active = values.get('active') === 'true';
      if ((role === 'admin' || role === 'sale' || role === 'viewer') && role !== editingUser.role) changes.role = role;
      if (active !== editingUser.active) changes.active = active;
    }
    if (Object.keys(changes).length === 0) {
      setEditingUser(null);
      setError('');
      return;
    }
    setUpdatingId(editingUser.uid);
    setError('');
    setNotice('');
    try {
      await onUpdate(editingUser.uid, changes);
      setNotice(`Đã cập nhật tài khoản ${editingUser.email}.`);
      setEditingUser(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa cập nhật được người dùng. Vui lòng thử lại.');
    } finally {
      setUpdatingId(null);
    }
  };

  const inputClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

  return (
    <section aria-labelledby="user-management-heading" className="space-y-4">
      <div className="bento-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <h1 id="user-management-heading" className="flex items-center gap-2 text-lg font-bold">
            <Users className="size-5 text-teal-700 dark:text-teal-300" aria-hidden="true" /> Quản lý người dùng
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cấp tài khoản và quản lý quyền truy cập labo.</p>
        </div>
        <button type="button" aria-expanded={adding} disabled={Boolean(updatingId)} onClick={() => { setEditingUser(null); setAdding(true); setError(''); setNotice(''); }} className="flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-60">
          <Plus className="size-4" aria-hidden="true" /> Thêm người dùng
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

      {adding && (
        <form onSubmit={createUser} aria-busy={creating} className="bento-card space-y-4 rounded-2xl p-4">
          <h2 className="text-sm font-bold">Tạo tài khoản</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Họ tên
              <input name="displayName" autoComplete="name" maxLength={150} required disabled={creating} className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Email
              <input name="email" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={creating} className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Mật khẩu
              <input name="password" type="password" autoComplete="new-password" minLength={12} required disabled={creating} aria-describedby="new-user-password-help" className={inputClass} />
              <span id="new-user-password-help" className="text-xs font-normal text-slate-500 dark:text-slate-400">Tối thiểu 12 ký tự.</span>
            </label>
            <label className="grid content-start gap-1.5 text-sm font-medium">
              Vai trò
              <select name="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)} disabled={creating} className={inputClass}>
                <option value="sale">Sale</option>
                <option value="viewer">Người xem (Chỉ xem)</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">
              {creating && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
            </button>
            <button type="button" disabled={creating} onClick={() => { setAdding(false); setError(''); setRole('sale'); }} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800">Hủy</button>
          </div>
        </form>
      )}

      {editingUser && (
        <form key={editingUser.uid} onSubmit={updateUser} aria-busy={Boolean(updatingId)} className="bento-card space-y-4 rounded-2xl p-4">
          <div>
            <h2 className="text-sm font-bold">Sửa người dùng</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{editingUser.email}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Họ tên
              <input name="displayName" defaultValue={editingUser.displayName} maxLength={150} required autoFocus disabled={Boolean(updatingId)} className={inputClass} />
            </label>
            {editingUser.uid !== currentUserId && (
              <>
                <label className="grid gap-1.5 text-sm font-medium">
                  Vai trò
                  <select name="role" defaultValue={editingUser.role} disabled={Boolean(updatingId)} className={inputClass}>
                    <option value="sale">Sale</option>
                    <option value="viewer">Người xem (Chỉ xem)</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Trạng thái
                  <select name="active" defaultValue={String(editingUser.active)} disabled={Boolean(updatingId)} className={inputClass}>
                    <option value="true">Đang hoạt động</option>
                    <option value="false">Đã khóa</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={Boolean(updatingId)} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
              {updatingId ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
            <button type="button" disabled={Boolean(updatingId)} onClick={() => { setEditingUser(null); setError(''); }} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Hủy</button>
          </div>
        </form>
      )}

      <div className="bento-card overflow-x-auto rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              {['Họ tên', 'Email', 'Vai trò', 'Trạng thái', 'Thao tác'].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">{heading}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((user) => {
              const isCurrent = user.uid === currentUserId;
              const updating = updatingId === user.uid;
              return (
                <tr key={user.uid} aria-busy={updating} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <th scope="row" className="min-w-36 px-4 py-3 font-semibold">
                    {user.displayName || '—'}
                    {isCurrent && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">Bạn</span>}
                  </th>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="min-w-44 px-4 py-3">
                    {user.role === 'admin' ? 'Quản trị viên' : user.role === 'viewer' ? 'Người xem (Chỉ xem)' : 'Sale'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={user.active ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'font-medium text-slate-500 dark:text-slate-400'}>{user.active ? 'Đang hoạt động' : 'Đã khóa'}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button type="button" aria-label={`Sửa tài khoản ${user.email}`}
                      onClick={() => { setEditingUser(user); setAdding(false); setError(''); setNotice(''); }}
                      disabled={Boolean(updatingId) || creating}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 font-semibold hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800">
                      <Pencil className="size-3.5" aria-hidden="true" /> Sửa
                    </button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">Chưa có người dùng.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};
