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

export type FeatureOption = BooleanFeatureOption | NumericFeatureOption;

export interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  /** Toggleable options for this feature */
  options?: FeatureOption[];
  /** CSS selectors — matched elements get hidden when this feature is enabled */
  hideSelectors?: string[];
  /** For complex behaviors that can't be done with CSS alone */
  contentScript?: {
    init: () => void | Promise<void>;
    cleanup: () => void;
  };
}

export type FeatureStates = Record<string, boolean>;
export type FeatureOptionStates = Record<string, Record<string, boolean | number>>;
