/**
 * ISOLATED world content script — runs ISOLATED collectors and behavior plugins.
 *
 * 1. Creates a CacheService and sets up the bridge listener for MAIN-world data
 * 2. Globs ISOLATED collectors and behavior plugins
 * 3. Reads enabled states from WXT storage
 * 4. Validates dependencies, inits collectors first, then plugins in dependency order
 * 5. Applies hideSelectors CSS for enabled behavior plugins
 * 6. Watches storage for state/option changes
 */

import { createCacheService } from "@/lib/cache";
import { listenForBridgeEvents } from "@/lib/cache-bridge";
import type { DataCollector, BehaviorPlugin } from "@/lib/plugin-types";
import { extractPlugins, validateDependencies, sortByDependencies } from "@/lib/registry";
import { pluginStates, featureOptionStates } from "@/lib/storage";
import type { PluginStates } from "@/lib/types";

const LOG = "[XES:content]";
const STYLE_ID = "xes-hide-styles";

const collectorModules = import.meta.glob<{ default: DataCollector }>(
  "../lib/collectors/isolated/*.ts",
  { eager: true }
);

const pluginModules = import.meta.glob<{ default: BehaviorPlugin }>(
  "../lib/plugins/*.ts",
  { eager: true }
);

const activePlugins = new Map<string, () => void>();

function buildCSS(
  plugins: BehaviorPlugin[],
  states: PluginStates
): string {
  return plugins
    .filter((p) => states[p.id] && p.hideSelectors?.length)
    .flatMap((p) => p.hideSelectors!)
    .map((selector) => `${selector} { display: none !important; }`)
    .join("\n");
}

function applyStyles(plugins: BehaviorPlugin[], states: PluginStates) {
  let style = document.getElementById(STYLE_ID);
  const css = buildCSS(plugins, states);

  if (!css) {
    style?.remove();
    return;
  }

  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

export default defineContentScript({
  matches: ["*://*.x.com/*", "*://*.twitter.com/*"],
  async main() {
    // Don't apply features inside our data-scraping iframes
    if (window !== window.top && window.name === "xes-iframe") return;

    // 1. Create cache and bridge listener
    const cache = createCacheService();
    const stopBridge = listenForBridgeEvents(cache);

    // 2. Discover collectors and plugins
    const collectors = extractPlugins(collectorModules);
    const plugins = extractPlugins(pluginModules);

    console.log(
      LOG,
      "Discovered",
      collectors.length,
      "ISOLATED collectors:",
      collectors.map((c) => c.id)
    );
    console.log(
      LOG,
      "Discovered",
      plugins.length,
      "behavior plugins:",
      plugins.map((p) => p.id)
    );

    // 3. Validate and sort
    validateDependencies(collectors, plugins);
    const sortedPlugins = sortByDependencies(plugins);

    // 4. Build defaults from all discovered plugins
    const allPlugins = [...collectors, ...sortedPlugins];
    const defaults: PluginStates = Object.fromEntries(
      allPlugins.map((p) => [p.id, p.defaultEnabled])
    );
    const stored = await pluginStates.getValue();
    const states = { ...defaults, ...stored };

    // 5. Init ISOLATED collectors first
    for (const collector of collectors) {
      if (states[collector.id] !== false) {
        try {
          await collector.init(cache);
          activePlugins.set(collector.id, collector.cleanup);
          console.log(LOG, "Initialized collector:", collector.id);
        } catch (err) {
          console.error(LOG, "Failed to init collector:", collector.id, err);
        }
      }
    }

    // 6. Init behavior plugins in dependency order
    for (const plugin of sortedPlugins) {
      if (states[plugin.id]) {
        try {
          await plugin.init(cache);
          activePlugins.set(plugin.id, plugin.cleanup);
          console.log(LOG, "Initialized plugin:", plugin.id);
        } catch (err) {
          console.error(LOG, "Failed to init plugin:", plugin.id, err);
        }
      }
    }

    // 7. Apply hideSelectors CSS
    applyStyles(sortedPlugins, states);

    // 8. Watch for state changes
    pluginStates.watch(async (newStates: PluginStates) => {
      const merged = { ...defaults, ...newStates };

      // Handle behavior plugins
      for (const plugin of sortedPlugins) {
        const shouldBeActive = !!merged[plugin.id];
        const isActive = activePlugins.has(plugin.id);

        if (shouldBeActive && !isActive) {
          try {
            await plugin.init(cache);
            activePlugins.set(plugin.id, plugin.cleanup);
            console.log(LOG, "Enabled plugin:", plugin.id);
          } catch (err) {
            console.error(LOG, "Failed to init plugin:", plugin.id, err);
          }
        } else if (!shouldBeActive && isActive) {
          activePlugins.get(plugin.id)!();
          activePlugins.delete(plugin.id);
          console.log(LOG, "Disabled plugin:", plugin.id);
        }
      }

      // Handle collectors
      for (const collector of collectors) {
        const shouldBeActive = merged[collector.id] !== false;
        const isActive = activePlugins.has(collector.id);

        if (shouldBeActive && !isActive) {
          try {
            await collector.init(cache);
            activePlugins.set(collector.id, collector.cleanup);
            console.log(LOG, "Enabled collector:", collector.id);
          } catch (err) {
            console.error(LOG, "Failed to init collector:", collector.id, err);
          }
        } else if (!shouldBeActive && isActive) {
          activePlugins.get(collector.id)!();
          activePlugins.delete(collector.id);
          console.log(LOG, "Disabled collector:", collector.id);
        }
      }

      applyStyles(sortedPlugins, merged);
    });

    // 9. Re-init active plugins when their options change
    featureOptionStates.watch(async () => {
      for (const plugin of sortedPlugins) {
        if (activePlugins.has(plugin.id)) {
          activePlugins.get(plugin.id)!(); // cleanup
          await plugin.init(cache); // re-init with new options
          activePlugins.set(plugin.id, plugin.cleanup);
          console.log(LOG, "Re-initialized plugin with new options:", plugin.id);
        }
      }
    });
  },
});
