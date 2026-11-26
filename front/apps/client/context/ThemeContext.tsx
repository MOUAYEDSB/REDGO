import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';

export type ThemePalette = {
  background: string;
  secondary: string;
  card: string;
  elevated: string;
  primary: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
};

const DARK_PALETTE: ThemePalette = {
  background: '#090909',
  secondary: '#121212',
  card: '#191919',
  elevated: '#222222',
  primary: '#FF202A',
  text: '#F4F4F5',
  textSecondary: '#929292',
  border: '#292929',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

const LIGHT_PALETTE: ThemePalette = {
  background: '#F4F5F7',
  secondary: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#EEF0F4',
  primary: '#FF202A',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
};

const THEME_STORAGE_KEY = '@redgo_theme_mode_v1';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  palette: ThemePalette;
  setMode: (next: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  isDark: true,
  palette: DARK_PALETTE,
  setMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      palette: mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE,
      setMode,
      toggleTheme,
    }),
    [mode, setMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
