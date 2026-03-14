export interface FeatureOptionBase {
  id: string;
  label: string;
  description?: string;
}

export interface BooleanFeatureOption extends FeatureOptionBase {
  type: "boolean";
  defaultValue: boolean;
}

export interface NumericFeatureOption extends FeatureOptionBase {
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface StringFeatureOption extends FeatureOptionBase {
  type: "string";
  defaultValue: string;
}

export type FeatureOption = BooleanFeatureOption | NumericFeatureOption | StringFeatureOption;

// Legacy type — kept for storage migration
export type FeatureStates = Record<string, boolean>;

// New plugin states — covers both collectors and behavior plugins
export type PluginStates = Record<string, boolean>;

export type FeatureOptionStates = Record<string, Record<string, boolean | number | string>>;

export interface CountryCacheEntry {
  country: string;
  fetchedAt: number;
}

export type CountryCache = Record<string, CountryCacheEntry>;
