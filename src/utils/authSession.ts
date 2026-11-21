/** How the app should treat the current Firebase Auth + user-profile state. */
export type AuthAccessState = 'loading' | 'login' | 'ready' | 'blocked' | 'profile_unavailable';

export interface AuthAccessInput {
  authReady: boolean;
  user: { uid: string } | null;
  /** Loaded workspace profile, if any. Kept across transient listener errors. */
  profile: { active?: boolean } | null;
  /** True after a successful profile snapshot (document exists or is confirmed missing). */
  profileResolved: boolean;
  /** True when the profile listener failed (network, rules, etc.). */
  profileError: boolean;
}

/**
 * Decide the auth gate without treating transient profile errors as a logout or a locked account.
 * A missing or inactive profile only blocks after a successful snapshot.
 */
export function resolveAuthAccess({
  authReady,
  user,
  profile,
  profileResolved,
  profileError,
}: AuthAccessInput): AuthAccessState {
  if (!authReady) return 'loading';
  if (!user) return 'login';
  if (profile?.active) return 'ready';
  if (profileResolved && (!profile || profile.active === false)) return 'blocked';
  if (profileError) return 'profile_unavailable';
  return 'loading';
}

/**
 * Errors that mean the Firebase account itself is gone or the refresh token was revoked.
 * Network, permission, and other transient codes must not force a sign-out.
 */
export function isRevokedAuthError(code: string | null | undefined): boolean {
  const normalized = String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/^auth\//, '');
  return normalized === 'user-disabled'
    || normalized === 'user-not-found'
    || normalized === 'user-token-expired'
    || normalized === 'invalid-user-token';
}
