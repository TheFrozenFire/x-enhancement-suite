# X Enhancement Suite — Design Document

## Plugin Architecture

The extension uses a plugin system with two types of plugins:
- **Data Collectors** — extract data from X's DOM/APIs and publish it to a shared cache
- **Behavior Plugins** — subscribe to cache events and manipulate the DOM

### Plugin Types

```typescript
interface DataCollector {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  world: 'main' | 'isolated';
  options?: FeatureOption[];
  init: (cache: CacheService) => void | Promise<void>;
  cleanup: () => void;
}

interface BehaviorPlugin {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  depends?: string[];          // collector IDs
  options?: FeatureOption[];
  hideSelectors?: string[];
  init: (cache: CacheService) => void | Promise<void>;
  cleanup: () => void;
}
```

### CacheService (Event Bus)

The `CacheService` is the central data bus connecting collectors to behavior plugins:

```typescript
interface CacheService {
  get<T>(collectorId: string, key: string): T | undefined;
  set(collectorId: string, key: string, value: unknown): void;
  getAll<T>(collectorId: string): Map<string, T>;
  on(collectorId: string, handler: CacheEventHandler): void;
  off(collectorId: string, handler: CacheEventHandler): void;
}
```

- Backed by `Map<collectorId, Map<key, value>>`
- `set()` stores data and emits to registered listeners for that `collectorId`
- Behavior plugins subscribe via `cache.on('collector-id', handler)` for reactive processing

### Data Flow

```
MAIN world (main-world.content.ts)
  └─ tweet-data collector → cache.set() → CustomEvent('xes-cache-update') ──┐
                                                                             │
ISOLATED world (content.ts)                                                  │
  ├─ country-data collector → cache.set() ─┐                                │
  │                                        ▼                                ▼
  │                              CacheService ◀──── bridge listener
  │                                  │
  │                            .on() │
  │                    ┌─────────────┴──────────────┐
  │                    ▼                            ▼
  │           reply-filter            disable-video-loop
  │           (behavior)              (behavior)
```

### MAIN ↔ ISOLATED Bridge

MV3 content scripts run in an ISOLATED world. The bridge uses CustomEvents:
- **MAIN world**: `cache.set()` also dispatches `CustomEvent('xes-cache-update', { detail: { collectorId, key, value } })`
- **ISOLATED world**: listens for `xes-cache-update`, calls `cache.set()` locally, triggering behavior plugin subscribers

### Auto-Discovery

Plugins are discovered via `import.meta.glob()` at build time:
- `entrypoints/main-world.content.ts` globs `lib/collectors/main/*.ts`
- `entrypoints/content.ts` globs `lib/collectors/isolated/*.ts` + `lib/plugins/*.ts`
- Options/popup pages glob all three directories for metadata

Adding a new plugin: create a file in the appropriate directory with a default export. No manual registration needed.

### Plugin Lifecycle

1. Content script creates a `CacheService` and sets up the bridge listener
2. Reads enabled states from WXT storage (`pluginStates`)
3. Validates dependencies (warns if a behavior plugin depends on a missing collector)
4. Initializes ISOLATED collectors first, then behavior plugins in dependency order
5. Applies `hideSelectors` CSS for enabled behavior plugins
6. Watches storage for state/option changes → init/cleanup as needed

### Storage

Uses WXT's `storage.defineItem` for type-safe persistent storage:
- `local:pluginStates` — `Record<string, boolean>` toggle states for all plugins
- `local:featureOptionStates` — `Record<string, Record<string, value>>` per-plugin options
- `local:countryCache` — country data with 7-day TTL

One-time migration copies `local:featureStates` (legacy) into `local:pluginStates` on first load.

### Settings UI

- **Popup**: Quick-access toggle list for all plugins + "Open Full Settings" button
- **Options page**: Full settings console with sidebar categories, search, toggle switches, option controls (sliders, text inputs), and dependency warnings

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

### Skinsuiting

Plugins must reuse X's existing DOM elements rather than creating parallel UI. The principle: never create a new UX element when an existing X element can be repurposed.

**Rules:**
1. **Replace content, not containers.** Find X's existing element (listbox, panel, sidebar widget) and swap its inner content. Do not hide it and render a sibling.
2. **Guard against X repopulation.** X's JS frequently re-renders its own elements. Use `MutationObserver` on the skinsuited container to re-clear when X pushes new children. An `isOurContent` flag prevents the observer from fighting your own writes.
3. **Match existing styling.** Reuse X's CSS classes and DOM structure for injected items so they look native. Only add custom CSS when X has no applicable class.
4. **Intercept, don't duplicate.** For interactive elements (forms, inputs), attach event listeners to X's existing elements with `{ capture: true }` to intercept before X's own handlers. Do not create shadow inputs or hidden forms.

**Example — Grok Search:**
- Attaches to `[data-testid="SearchBox_Search_Input"]` (X's search input)
- Clears and replaces content inside `form[role="search"] [role="listbox"]` (X's typeahead dropdown)
- Intercepts form submission on the existing `<form>` with `capture: true`
- No custom dropdown elements created

### Adding a New Plugin

1. **Data Collector**: Create a file in `lib/collectors/main/` or `lib/collectors/isolated/` exporting a `DataCollector` as default
2. **Behavior Plugin**: Create a file in `lib/plugins/` exporting a `BehaviorPlugin` as default
3. The plugin is auto-discovered and appears in the settings UI
