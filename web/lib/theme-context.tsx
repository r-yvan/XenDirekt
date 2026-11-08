'use client';

import { createContext, useCallback, useContext, useEffect } from 'react';
import { useLocalStorage, useMediaQuery, writeStorage } from './browser-store';
import { THEME_KEY, type ThemePreference } from './theme';

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (value: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = useLocalStorage(THEME_KEY);
  const preference: ThemePreference = stored === 'light' || stored === 'dark' ? stored : 'system';
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)', true);
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setPreference = useCallback((value: ThemePreference) => writeStorage(THEME_KEY, value), []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme outside ThemeProvider');
  return value;
}
