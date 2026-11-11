/**
 * TV_Abdul: kvStore
 * Small JSON key-value cache for data that is too large for localStorage (catalogs, guides).
 * Uses IndexedDB, falling back to an in-memory map where IndexedDB is unavailable.
 */

const DB_NAME = 'TV_Abdul_KV';
const STORE = 'kv';
const memory = new Map();
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
  return dbPromise;
}

export const kvStore = {
  /** @returns {Promise<any>} the stored value, or null */
  async get(key) {
    const db = await openDb();
    if (!db) return memory.has(key) ? memory.get(key) : null;
    return new Promise((resolve) => {
      try {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result === undefined ? null : request.result);
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async set(key, value) {
    const db = await openDb();
    if (!db) {
      memory.set(key, value);
      return;
    }
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }
};

/**
 * Fetch JSON with a time limit. Rejects on a network error, a non-2xx status or a timeout.
 */
export async function fetchJson(url, timeoutMs = 15000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
