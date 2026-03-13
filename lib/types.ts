export interface FeatureOption {
  id: string;
  label: string;
  description?: string;
  type: "boolean";
  defaultValue: boolean;
}

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
export type FeatureOptionStates = Record<string, Record<string, boolean>>;
