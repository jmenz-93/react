import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  applyDarkClass,
  getSystemIsDark,
  getStoredThemeMode,
  setStoredThemeMode,
  type ThemeMode,
} from './theme';

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => getSystemIsDark());

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media?.addEventListener) return;

    const onChange = () => setSystemIsDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const isDark = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  // Apply Tailwind dark mode class
  useEffect(() => {
    applyDarkClass(isDark);
  }, [isDark]);

  // Persist choice
  useEffect(() => {
    setStoredThemeMode(themeMode);
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const value = useMemo(
    () => ({ themeMode, setThemeMode, isDark }),
    [themeMode, setThemeMode, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
