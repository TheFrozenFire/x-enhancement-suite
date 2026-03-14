import type { CacheService, CacheEventHandler } from "./plugin-types";

const LOG = "[XES:cache]";

export function createCacheService(): CacheService {
  const store = new Map<string, Map<string, unknown>>();
  const listeners = new Map<string, Set<CacheEventHandler>>();

  return {
    get<T>(collectorId: string, key: string): T | undefined {
      return store.get(collectorId)?.get(key) as T | undefined;
    },

    set(collectorId: string, key: string, value: unknown): void {
      let collectorStore = store.get(collectorId);
      if (!collectorStore) {
        collectorStore = new Map();
        store.set(collectorId, collectorStore);
      }
      collectorStore.set(key, value);

      const handlers = listeners.get(collectorId);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(collectorId, key, value);
          } catch (err) {
            console.error(LOG, "Handler error for", collectorId, err);
          }
        }
      }
    },

    getAll<T>(collectorId: string): Map<string, T> {
      const collectorStore = store.get(collectorId);
      if (!collectorStore) return new Map();
      return collectorStore as Map<string, T>;
    },

    on(collectorId: string, handler: CacheEventHandler): void {
      let handlers = listeners.get(collectorId);
      if (!handlers) {
        handlers = new Set();
        listeners.set(collectorId, handlers);
      }
      handlers.add(handler);
    },

    off(collectorId: string, handler: CacheEventHandler): void {
      listeners.get(collectorId)?.delete(handler);
    },
  };
}
