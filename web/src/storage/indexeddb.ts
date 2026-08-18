import type { AppData, Store } from "../domain/store";
import { createMemoryStore, prepareAppData } from "../domain/store";

const DB_VERSION = 1;
const STORE_NAME = "app";
const DATA_KEY = "data";

export function createIndexedDBStore(
  dbName = "diet",
  factory: IDBFactory = globalThis.indexedDB
): Store {
  if (!factory) throw new Error("IndexedDB is unavailable");

  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
  });

  const read = async (): Promise<AppData | undefined> => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(DATA_KEY);
      request.onsuccess = () => resolve(request.result as AppData | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read IndexedDB"));
    });
  };

  const write = async (data: AppData): Promise<void> => {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(data, DATA_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Unable to write IndexedDB"));
    });
  };

  const memory = createMemoryStore();
  return {
    async load() {
      const stored = (await read()) ?? await memory.load();
      const prepared = prepareAppData(stored);
      if (JSON.stringify(prepared) !== JSON.stringify(stored)) await write(prepared);
      await memory.save(prepared);
      return prepared;
    },
    async save(data) {
      const prepared = prepareAppData(data);
      await memory.save(prepared);
      await write(prepared);
    },
    export: async () => {
      const data = await (await read()) ?? await memory.load();
      return (await createMemoryStore(data)).export();
    },
    async import(file) {
      const target = createMemoryStore((await read()) ?? await memory.load());
      const result = await target.import(file);
      await write(result.data);
      await memory.save(result.data);
      return result;
    }
  };
}
