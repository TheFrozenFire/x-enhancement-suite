import type { FeatureOption } from "./types";

export type CacheEventHandler = (
  collectorId: string,
  key: string,
  value: unknown
) => void;

export interface CacheService {
  get<T>(collectorId: string, key: string): T | undefined;
  set(collectorId: string, key: string, value: unknown): void;
  getAll<T>(collectorId: string): Map<string, T>;
  on(collectorId: string, handler: CacheEventHandler): void;
  off(collectorId: string, handler: CacheEventHandler): void;
}

export interface DataCollector {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  world: "main" | "isolated";
  options?: FeatureOption[];
  init: (cache: CacheService) => void | Promise<void>;
  cleanup: () => void;
}

export interface BehaviorPlugin {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  depends?: string[];
  options?: FeatureOption[];
  hideSelectors?: string[];
  init: (cache: CacheService) => void | Promise<void>;
  cleanup: () => void;
}

export type Plugin = DataCollector | BehaviorPlugin;

export function isDataCollector(plugin: Plugin): plugin is DataCollector {
  return "world" in plugin;
}

export function isBehaviorPlugin(plugin: Plugin): plugin is BehaviorPlugin {
  return !("world" in plugin);
}
