const DB_NAME = 'storymap';
const DB_VERSION = 2;
const STORE = 'sessions';
const INDEX_KEY = 'index';

let dbPromise = null;

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Fresh multi-session schema. The old single-doc `state` store is dropped
      // outright (no migration — the app had no users yet).
      if (db.objectStoreNames.contains('state')) db.deleteObjectStore('state');
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const tx = async (mode) => {
  const db = await openDb();
  return db.transaction(STORE, mode).objectStore(STORE);
};

const getKey = async (key) => {
  const s = await tx('readonly');
  return new Promise((res, rej) => {
    const r = s.get(key);
    r.onsuccess = () => res(r.result ?? null);
    r.onerror = () => rej(r.error);
  });
};

const putKey = async (value, key) => {
  const s = await tx('readwrite');
  return new Promise((res, rej) => {
    const r = s.put(value, key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
};

const delKey = async (key) => {
  const s = await tx('readwrite');
  return new Promise((res, rej) => {
    const r = s.delete(key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
};

// The session list + active pointer: { activeId, sessions: [{id,title,createdAt,updatedAt}] }
export const loadIndex = () => getKey(INDEX_KEY);
export const saveIndex = (index) => putKey(index, INDEX_KEY);

// Heavy per-session record: { id, state, history }
export const loadSession = (id) => getKey(id);
export const saveSession = (id, data) => putKey(data, id);
export const deleteSessionRecord = (id) => delKey(id);

export const requestPersistence = async () => {
  if (navigator.storage?.persist) {
    try { await navigator.storage.persist(); } catch {}
  }
};
