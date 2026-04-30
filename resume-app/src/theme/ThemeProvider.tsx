import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
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

function useSystemDark() {
  const [isDark, setIsDark] = useState(() => getSystemIsDark());

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isDark;
}

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const systemIsDark = useSystemDark();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  
  // Track previous system state to detect changes
  const prevSystemDarkRef = useRef(systemIsDark);

  // If system theme changes, reset override to 'system'
  useEffect(() => {
    if (prevSystemDarkRef.current !== systemIsDark) {
      setThemeModeState('system');
      prevSystemDarkRef.current = systemIsDark;
    }
  }, [systemIsDark]);

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
