const DB_NAME = 'spotti-spaghetti';
const DB_VERSION = 1;

export const DB_STORES = {
  exportHistory: 'export-history',
};

const openDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;

    if (!db.objectStoreNames.contains(DB_STORES.exportHistory)) {
      const store = db.createObjectStore(DB_STORES.exportHistory, { keyPath: 'id' });
      store.createIndex('playlistId', 'playlistId', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
    }
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const withStore = async (storeName, mode, callback) => {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };

    result = callback(store);
  });
};

const requestToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const database = {
  async getAll(storeName) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  },

  put(storeName, value) {
    return withStore(storeName, 'readwrite', store => store.put(value));
  },

  delete(storeName, key) {
    return withStore(storeName, 'readwrite', store => store.delete(key));
  },

  clear(storeName) {
    return withStore(storeName, 'readwrite', store => store.clear());
  },

  requestToPromise,
};
