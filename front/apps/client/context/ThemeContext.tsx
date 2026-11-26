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
  background: '#09090B',
  secondary: '#121216',
  card: '#18181F',
  elevated: '#22222B',
  primary: '#FF202A',
  text: '#F4F4F5',
  textSecondary: '#9CA3AF',
  border: '#272732',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

const LIGHT_PALETTE: ThemePalette = {
  background: '#F1F4F9',
  secondary: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#E8ECF4',
  primary: '#FF202A',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
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
