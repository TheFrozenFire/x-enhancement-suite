/**
 * MAIN ↔ ISOLATED world cache bridge using CustomEvents.
 *
 * MAIN world: wraps a CacheService so that `set()` also dispatches
 * a CustomEvent('xes-cache-update') readable by the ISOLATED world.
 *
 * ISOLATED world: listens for 'xes-cache-update' and forwards the
 * data into its local CacheService, triggering behavior plugin subscribers.
 */

import type { CacheService } from "./plugin-types";

const EVENT_NAME = "xes-cache-update";
const LOG = "[XES:cache-bridge]";

interface BridgeDetail {
  collectorId: string;
  key: string;
  value: unknown;
}

/**
 * Wraps a CacheService so every `set()` also dispatches a CustomEvent
 * on `document` for the ISOLATED world to pick up.
 */
export function createMainWorldBridge(cache: CacheService): CacheService {
  return {
    get: cache.get.bind(cache),
    getAll: cache.getAll.bind(cache),
    on: cache.on.bind(cache),
    off: cache.off.bind(cache),

    set(collectorId: string, key: string, value: unknown): void {
      cache.set(collectorId, key, value);

      const detail: BridgeDetail = { collectorId, key, value };
      document.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail })
      );
    },
  };
}

/**
 * Listens for 'xes-cache-update' CustomEvents dispatched by the MAIN world
 * and forwards them into the local (ISOLATED) CacheService.
 */
export function listenForBridgeEvents(cache: CacheService): () => void {
  function handler(e: Event) {
    const detail = (e as CustomEvent<BridgeDetail>).detail;
    if (!detail?.collectorId || !detail?.key) return;
    console.log(LOG, "Bridge event:", detail.collectorId, detail.key);
    cache.set(detail.collectorId, detail.key, detail.value);
  }

  document.addEventListener(EVENT_NAME, handler);
  console.log(LOG, "Listening for bridge events");

  return () => {
    document.removeEventListener(EVENT_NAME, handler);
  };
}
