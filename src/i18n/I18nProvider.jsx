import { useState, useCallback } from 'react';
import { I18nContext } from './context.js';
import { en } from './translations/en.js';
import { zh } from './translations/zh.js';
import { STORAGE_KEYS } from '../config/storage.js';

const translations = { zh, en };

export const I18nProvider = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.language);
    if (saved) return saved;
    return navigator.language.startsWith('zh') ? 'zh' : 'en';
  });

  const t = useCallback((key, ...args) => {
    const val = translations[locale]?.[key] ?? translations.zh[key] ?? key;
    if (typeof val === 'function') return val(...args);
    return val;
  }, [locale]);

  const toggleLocale = useCallback(() => {
    setLocale(prev => {
      const next = prev === 'zh' ? 'en' : 'zh';
      localStorage.setItem(STORAGE_KEYS.language, next);
      return next;
    });
  }, []);

  const changeLocale = useCallback((val) => {
    setLocale(val);
    localStorage.setItem(STORAGE_KEYS.language, val);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, toggleLocale, changeLocale }}>
      {children}
    </I18nContext.Provider>
  );
};
