// db.js
import { HISTORY_KEY, MAX_ITEMS } from './state.js';

const DB_NAME = 'ImageTaggerDB';
const DB_VERSION = 1;
const STORE_NAME = 'recent_images';
let db = null;

export function initDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      console.warn("IndexedDB não suportado neste navegador. Usando localStorage.");
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = e => {
      console.warn("Falha ao abrir IndexedDB, usando localStorage:", e.target.error);
      resolve(null);
    };
    request.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = e => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export function addRecentImage(name, ts, thumb, fullBlob) {
  return new Promise((resolve, reject) => {
    if (!db) {
      // Fallback para localStorage
      let arr = readHistoryLegacy();
      arr.unshift({ name, ts, thumb });
      if (arr.length > MAX_ITEMS) arr = arr.slice(0, MAX_ITEMS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
      resolve();
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const requestGetAll = store.getAllKeys();
    requestGetAll.onsuccess = () => {
      const keys = requestGetAll.result;
      if (keys.length >= MAX_ITEMS) {
        const keysToDelete = keys.slice(0, keys.length - MAX_ITEMS + 1);
        keysToDelete.forEach(k => store.delete(k));
      }
      
      const record = { name, ts, thumb, image: fullBlob };
      const requestAdd = store.add(record);
      requestAdd.onsuccess = () => resolve(requestAdd.result);
      requestAdd.onerror = e => reject(e.target.error);
    };
    requestGetAll.onerror = e => reject(e.target.error);
  });
}

export function getRecentImages() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(readHistoryLegacy());
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result.sort((a, b) => b.ts - a.ts);
      resolve(items);
    };
    request.onerror = e => reject(e.target.error);
  });
}

export function deleteRecentImage(id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
}

export function readHistoryLegacy() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
