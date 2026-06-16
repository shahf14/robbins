export type AppTheme = 'light' | 'dark';

const themeStorageKey = 'theme';

export function resolveTheme(saved: string | null, prefersDark: boolean): AppTheme {
  if (saved === 'light' || saved === 'dark') return saved;
  return prefersDark ? 'dark' : 'light';
}

export function readStoredTheme(): AppTheme | null {
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem(themeStorageKey);
  return saved === 'light' || saved === 'dark' ? saved : null;
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: AppTheme): void {
  window.localStorage.setItem(themeStorageKey, theme);
}

export const themeBootstrapScript = `(function(){try{var k='theme';var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s==='light'||s==='dark'?s:(d?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;
