export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'control-os-theme';

export function getThemePreference(): AppTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

/** Aplica e persiste a aparência sem exigir recarregar a página. */
export function setThemePreference(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent<AppTheme>('control-os-theme-change', { detail: theme }));
}
