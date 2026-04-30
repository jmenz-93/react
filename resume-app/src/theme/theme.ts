export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

export function getStoredThemeMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

export function setStoredThemeMode(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function getSystemIsDark(): boolean {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return getSystemIsDark();
}

export function applyDarkClass(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}
