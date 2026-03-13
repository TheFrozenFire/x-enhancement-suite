# X Enhancement Suite — Design Document

## Feature System

### Feature Definition
Each feature is a plain object conforming to the `Feature` interface:

```typescript
interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  // Toggleable options for this feature
  options?: FeatureOption[];
  // CSS selectors — matched elements are hidden when feature is enabled
  hideSelectors?: string[];
  // For complex behaviors that can't be achieved with CSS alone
  contentScript?: {
    init: () => void | Promise<void>;
    cleanup: () => void;
  };
}

interface FeatureOption {
  id: string;
  label: string;
  description?: string;
  type: "boolean";
  defaultValue: boolean;
}
```

### How Features Are Applied
1. Content script loads on `x.com` / `twitter.com`
2. Reads enabled feature IDs from extension storage
3. For selector-based features: injects a `<style>` tag with `display: none !important` rules
4. For script-based features: calls `init()`, and `cleanup()` when disabled
5. Listens for storage changes to apply/remove features in real-time without page reload

### Feature Options
Features can declare `options` — per-feature settings that users can toggle independently.
Option states are stored as `Record<string, Record<string, boolean>>` under `local:featureOptionStates`.

### Storage
Uses WXT's `storage.defineItem` for type-safe persistent storage.
- Feature states: `Record<string, boolean>` under `local:featureStates`
- Feature option states: `Record<string, Record<string, boolean>>` under `local:featureOptionStates`

### Tweet Utilities (`lib/tweet-utils.ts`)
Shared utilities for extracting data from X/Twitter DOM elements via React fiber internals:
- `getTweetUserData(article)` — extracts screen name, following/followed-by status from a tweet's React fiber tree
- `getLoggedInUsername()` — reads the logged-in user's screen name from the nav bar

These are intended as global data sources that any feature can consume.

### Adding a New Feature
1. Create a file in `lib/features/` exporting a `Feature` object
2. Register it in `lib/features/index.ts`
3. The feature automatically appears in the popup UI and is applied by the content script
