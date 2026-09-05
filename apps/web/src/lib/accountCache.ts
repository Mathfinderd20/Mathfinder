// Repositories use a synchronous in-memory view; IndexedDB stores atomic,
// account-scoped snapshots. Legacy unscoped localStorage is never imported.
export type Entries = Record<string, string>;
export interface CacheSnapshot {
  version: 1;
  userId: string;
  cachedAt: string;
  entries: Entries;
  baseline: Entries;
}

let entries: Entries = {};
let writable = false;
let revision = 0;
export const cacheGeneration = () => revision;
export const accountStorage = {
  getItem(key: string) {
    return entries[key] ?? null;
  },
  setItem(key: string, value: string) {
    if (!writable || entries[key] === value) return;
    entries = { ...entries, [key]: value };
  },
  removeItem(key: string) {
    if (!writable) return;
    const next = { ...entries };
    delete next[key];
    entries = next;
  },
};
export function setCacheWritable(value: boolean) {
  writable = value;
}
export function cacheWritable() {
  return writable;
}
export function replaceEntries(value: Entries) {
  entries = { ...value };
  revision++;
}
export function currentEntries(): Entries {
  return { ...entries };
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mathfinder-accounts", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("accounts");
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other Mathfinder tabs to update the cache."));
    request.onsuccess = () => resolve(request.result);
  });
}
export async function readCache(
  key: string,
  userId: string,
): Promise<CacheSnapshot | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("accounts")
        .objectStore("accounts")
        .get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const value = request.result as CacheSnapshot | undefined;
        if (
          !value ||
          value.version !== 1 ||
          value.userId !== userId ||
          !value.entries ||
          !value.baseline ||
          !Number.isFinite(Date.parse(value.cachedAt)) ||
          !Object.values(value.entries).every((v) => typeof v === "string") ||
          !Object.values(value.baseline).every((v) => typeof v === "string")
        ) {
          resolve(undefined);
        } else resolve(value);
      };
    });
  } finally {
    db.close();
  }
}
export async function writeCache(key: string, snapshot?: CacheSnapshot) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("accounts", "readwrite");
      const store = tx.objectStore("accounts");
      if (snapshot) store.put(snapshot, key);
      else store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
