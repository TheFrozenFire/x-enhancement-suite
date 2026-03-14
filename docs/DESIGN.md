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

type FeatureOption =
  | { id: string; label: string; description?: string; type: "boolean"; defaultValue: boolean }
  | { id: string; label: string; description?: string; type: "number"; defaultValue: number; min?: number; max?: number; step?: number };
```

### How Features Are Applied
1. Content script loads on `x.com` / `twitter.com`
2. Reads enabled feature IDs from extension storage
3. For selector-based features: injects a `<style>` tag with `display: none !important` rules
4. For script-based features: calls `init()`, and `cleanup()` when disabled
5. Listens for storage changes to apply/remove features in real-time without page reload

### Feature Options
Features can declare `options` — per-feature settings that users can toggle independently.
Option states are stored as `Record<string, Record<string, boolean | number>>` under `local:featureOptionStates`.

### Storage
Uses WXT's `storage.defineItem` for type-safe persistent storage.
- Feature states: `Record<string, boolean>` under `local:featureStates`
- Feature option states: `Record<string, Record<string, boolean | number>>` under `local:featureOptionStates`

### Fiber Bridge Architecture
MV3 content scripts run in an ISOLATED world and cannot access page JavaScript properties like `__reactFiber$`. To extract React data from X's DOM, a two-script bridge is used:

1. **MAIN world script** (`entrypoints/fiber-bridge.content.ts`) — runs in the page's JS context, walks React fiber trees to extract tweet/user data, and writes it as a JSON `data-xes-tweet-data` attribute on each `article[data-testid="tweet"]` element.
2. **ISOLATED world script** (`entrypoints/content.ts`) — reads those data attributes via `lib/tweet-utils.ts` helper functions.

The MAIN world script uses a MutationObserver + periodic rescan to handle X's virtual scrolling, which recycles DOM nodes.

### Tweet Utilities (`lib/tweet-utils.ts`)
Shared utilities for reading tweet data from the `data-xes-tweet-data` bridge attribute:
- `getTweetUserData(article)` — extracts screen name, following/followed-by status
- `getTweetData(article)` — extracts engagement metrics (likes, retweets, replies, views)
- `getLoggedInUsername()` — reads the logged-in user's screen name from the nav bar

These are intended as global data sources that any feature can consume.

### X Virtual Scrolling
X uses a virtualized timeline where each `[data-testid="cellInnerDiv"]` is absolutely positioned with `translateY()`. This means:
- DOM sibling order does not equal visual order
- Inserted elements must go **inside** an existing cell, not as siblings
- Nodes are recycled — injected buttons/elements may be removed and need re-insertion (checked via `isConnected`)

### X API Data Loading
Key GraphQL queries used by X on profile and tweet pages:
- **`UserByScreenName`** — main profile data (name, bio, location, follower counts). Loaded on navigation.
- **`ProfileSpotlightsQuery`** — profile metadata (relationship status). Loaded on navigation.
- **`UserTweets`** — timeline posts. Loaded on navigation.
- **`TweetDetail`** — focal tweet + replies on status pages. Loaded on navigation.
- **`AboutAccountQuery`** — account transparency data ("Account based in [country]", creation date). **Loaded on demand** when hovering over the join date on a profile page, not on initial navigation.

### Adding a New Feature
1. Create a file in `lib/features/` exporting a `Feature` object
2. Register it in `lib/features/index.ts`
3. The feature automatically appears in the popup UI and is applied by the content script
