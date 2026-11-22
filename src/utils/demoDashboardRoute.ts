export const DEMO_DASHBOARD_PATH = '/demo-dashboard';
export const DEMO_DASHBOARD_QUERY = 'demo=dashboard';

function normalizePath(pathname: string): string {
  const trimmed = (pathname || '/').replace(/\/+$/, '');
  return trimmed || '/';
}

function hashIndicatesDemo(hash: string): boolean {
  const raw = (hash || '').replace(/^#/, '').trim();
  if (!raw) return false;
  if (normalizePath(raw) === DEMO_DASHBOARD_PATH || raw === 'demo-dashboard') return true;
  const query = raw.startsWith('?') ? raw.slice(1) : raw;
  try {
    return new URLSearchParams(query).get('demo') === 'dashboard';
  } catch {
    return false;
  }
}

/** True when the user opened the standalone demo dashboard URL. */
export function isDemoDashboardLocation(
  location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
): boolean {
  if (normalizePath(location.pathname) === DEMO_DASHBOARD_PATH) return true;
  try {
    if (new URLSearchParams(location.search).get('demo') === 'dashboard') return true;
  } catch {
    // ignore malformed search
  }
  return hashIndicatesDemo(location.hash);
}
