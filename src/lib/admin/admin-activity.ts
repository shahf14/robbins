export type AdminActivityKey =
  | 'dbSync'
  | 'dbCheck'
  | 'export'
  | 'settingsSave'
  | 'tokenSave'
  | 'logsRefresh'
  | 'dbConnectionOk';

const STORAGE_KEY = 'robbins_admin_activity';

export type AdminActivityState = Partial<Record<AdminActivityKey, string>>;

export function getAdminActivity(): AdminActivityState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AdminActivityState;
  } catch {
    return {};
  }
}

export function recordAdminActivity(key: AdminActivityKey): void {
  if (typeof window === 'undefined') return;
  const next = {...getAdminActivity(), [key]: new Date().toISOString()};
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function formatAdminActivityTime(
  iso: string | undefined,
  locale: string,
  neverLabel: string
): string {
  if (!iso) return neverLabel;
  try {
    return new Date(iso).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return neverLabel;
  }
}
