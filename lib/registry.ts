import type { DataCollector, BehaviorPlugin, Plugin } from "./plugin-types";
import { isDataCollector, isBehaviorPlugin } from "./plugin-types";

const LOG = "[XES:registry]";

/**
 * Extract plugins from an import.meta.glob result.
 * Each module should have a default export conforming to Plugin.
 */
export function extractPlugins<T extends Plugin>(
  modules: Record<string, { default: T }>
): T[] {
  return Object.entries(modules).map(([path, mod]) => {
    console.log(LOG, "Discovered:", path, "→", mod.default.id);
    return mod.default;
  });
}

/**
 * Warn if a behavior plugin depends on a collector that isn't registered.
 */
export function validateDependencies(
  collectors: DataCollector[],
  plugins: BehaviorPlugin[]
): void {
  const collectorIds = new Set(collectors.map((c) => c.id));
  for (const plugin of plugins) {
    for (const dep of plugin.depends ?? []) {
      if (!collectorIds.has(dep)) {
        console.warn(
          LOG,
          `Plugin "${plugin.id}" depends on collector "${dep}" which is not registered`
        );
      }
    }
  }
}

/**
 * Sort behavior plugins so those with dependencies come after those without.
 * Collectors always run first (handled by caller), this only orders plugins.
 */
export function sortByDependencies(plugins: BehaviorPlugin[]): BehaviorPlugin[] {
  const sorted: BehaviorPlugin[] = [];
  const visited = new Set<string>();

  function visit(plugin: BehaviorPlugin) {
    if (visited.has(plugin.id)) return;
    visited.add(plugin.id);

    for (const dep of plugin.depends ?? []) {
      const depPlugin = plugins.find((p) => p.id === dep);
      if (depPlugin) visit(depPlugin);
    }

    sorted.push(plugin);
  }

  for (const plugin of plugins) {
    visit(plugin);
  }

  return sorted;
}

/**
 * Group plugins by category for settings UI.
 */
export function getPluginsByCategory(
  plugins: Plugin[]
): Map<string, Plugin[]> {
  const groups = new Map<string, Plugin[]>();
  for (const plugin of plugins) {
    const category = plugin.category;
    let group = groups.get(category);
    if (!group) {
      group = [];
      groups.set(category, group);
    }
    group.push(plugin);
  }
  return groups;
}
