import { storage } from "wxt/utils/storage";
import type { FeatureStates, FeatureOptionStates } from "./types";

export const featureStates = storage.defineItem<FeatureStates>(
  "local:featureStates",
  { defaultValue: {} }
);

export async function isFeatureEnabled(featureId: string): Promise<boolean> {
  const states = await featureStates.getValue();
  return states[featureId] ?? false;
}

export async function setFeatureEnabled(
  featureId: string,
  enabled: boolean
): Promise<void> {
  const states = await featureStates.getValue();
  await featureStates.setValue({ ...states, [featureId]: enabled });
}

export const featureOptionStates = storage.defineItem<FeatureOptionStates>(
  "local:featureOptionStates",
  { defaultValue: {} }
);

export async function getFeatureOption<T extends boolean | number = boolean>(
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
  value: boolean | number
): Promise<void> {
  const states = await featureOptionStates.getValue();
  const featureOpts = states[featureId] ?? {};
  await featureOptionStates.setValue({
    ...states,
    [featureId]: { ...featureOpts, [optionId]: value },
  });
}
