import { STORAGE_KEYS } from '../config/storage.js';

export const batchSession = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.resumeBatch) || 'null');
    } catch {
      return null;
    }
  },

  save(session) {
    localStorage.setItem(STORAGE_KEYS.resumeBatch, JSON.stringify({
      ...session,
      updatedAt: new Date().toISOString(),
    }));
  },

  clear() {
    localStorage.removeItem(STORAGE_KEYS.resumeBatch);
  },
};
