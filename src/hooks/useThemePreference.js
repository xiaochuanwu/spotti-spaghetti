import { useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../config/storage.js';

const getSystemDarkPreference = () => (
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
);

export const useThemePreference = () => {
  const [themePreference, setThemePreference] = useState(() => (
    localStorage.getItem(STORAGE_KEYS.theme) || 'system'
  ));
  const [systemDark, setSystemDark] = useState(getSystemDarkPreference);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemDark(event.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const effectiveTheme = useMemo(() => {
    if (themePreference === 'system') return systemDark ? 'dark' : 'light';
    return themePreference;
  }, [systemDark, themePreference]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
    localStorage.setItem(STORAGE_KEYS.theme, themePreference);
  }, [effectiveTheme, themePreference]);

  return { effectiveTheme, setTheme: setThemePreference, themePreference };
};
