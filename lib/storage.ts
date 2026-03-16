import { storage } from "wxt/utils/storage";
import type { FeatureStates, PluginStates, FeatureOptionStates, CountryCache, AiProviderConfig } from "./types";

// Legacy storage item — used only for migration
const featureStates = storage.defineItem<FeatureStates>(
  "local:featureStates",
  { defaultValue: {} }
);

// New plugin states — covers both collectors and behavior plugins
export const pluginStates = storage.defineItem<PluginStates>(
  "local:pluginStates",
  { defaultValue: {} }
);

export async function isPluginEnabled(pluginId: string): Promise<boolean> {
  const states = await pluginStates.getValue();
  return states[pluginId] ?? false;
}

export async function setPluginEnabled(
  pluginId: string,
  enabled: boolean
): Promise<void> {
  const states = await pluginStates.getValue();
  await pluginStates.setValue({ ...states, [pluginId]: enabled });
}

export const featureOptionStates = storage.defineItem<FeatureOptionStates>(
  "local:featureOptionStates",
  { defaultValue: {} }
);

export async function getFeatureOption<T extends boolean | number | string = boolean>(
  featureId: string,
  optionId: string,
  defaultValue: T
): Promise<T> {
  const states = await featureOptionStates.getValue();
  return (states[featureId]?.[optionId] as T) ?? defaultValue;
}

export async function setFeatureOption(
  featureId: string,
  optionId: string,
  value: boolean | number | string
): Promise<void> {
  const states = await featureOptionStates.getValue();
  const featureOpts = states[featureId] ?? {};
  await featureOptionStates.setValue({
    ...states,
    [featureId]: { ...featureOpts, [optionId]: value },
  });
}

// AI provider configuration
export const aiProviderConfig = storage.defineItem<AiProviderConfig>(
  "local:aiProviderConfig",
  { defaultValue: {} }
);

// Grok search history
export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
}

export const grokSearchHistory = storage.defineItem<SearchHistoryEntry[]>(
  "local:grokSearchHistory",
  { defaultValue: [] }
);

// Country cache — keyed by lowercase screen name
export const countryCache = storage.defineItem<CountryCache>(
  "local:countryCache",
  { defaultValue: {} }
);

/**
 * One-time migration: copy featureStates into pluginStates if pluginStates
 * is empty and featureStates has data.
 */
export async function migrateStorage(): Promise<void> {
  const newStates = await pluginStates.getValue();
  if (Object.keys(newStates).length > 0) return; // already migrated

  const oldStates = await featureStates.getValue();
  if (Object.keys(oldStates).length === 0) return; // nothing to migrate

  console.log("[XES:storage] Migrating featureStates → pluginStates", oldStates);
  await pluginStates.setValue(oldStates);
}
