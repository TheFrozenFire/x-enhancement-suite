/**
 * MAIN world content script — generic runner for MAIN-world data collectors.
 *
 * Creates a CacheService with bridge proxy (dispatches CustomEvents on set)
 * and initializes all discovered MAIN-world collectors.
 */

import { createCacheService } from "@/lib/cache";
import { createMainWorldBridge } from "@/lib/cache-bridge";
import type { DataCollector } from "@/lib/plugin-types";
import { extractPlugins } from "@/lib/registry";

const LOG = "[XES:main-world]";

const collectorModules = import.meta.glob<{ default: DataCollector }>(
  "../lib/collectors/main/*.ts",
  { eager: true }
);

export default defineContentScript({
  matches: ["*://*.x.com/*", "*://*.twitter.com/*"],
  world: "MAIN",
  runAt: "document_idle",
  async main() {
    // Don't run inside data-scraping iframes
    if (window !== window.top && window.name === "xes-iframe") return;

    const rawCache = createCacheService();
    const cache = createMainWorldBridge(rawCache);

    const collectors = extractPlugins(collectorModules);
    console.log(
      LOG,
      "Init — discovered",
      collectors.length,
      "MAIN collectors:",
      collectors.map((c) => c.id)
    );

    for (const collector of collectors) {
      try {
        await collector.init(cache);
        console.log(LOG, "Initialized collector:", collector.id);
      } catch (err) {
        console.error(LOG, "Failed to init collector:", collector.id, err);
      }
    }
  },
});
