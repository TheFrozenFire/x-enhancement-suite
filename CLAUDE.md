# X Enhancement Suite

## Project Overview
Chrome extension (WXT + React) that enhances the X/Twitter experience with toggleable plugins.

## Architecture
- **WXT framework** with React, targeting Manifest V3
- **pnpm** as package manager
- Plugin system with auto-discovery via `import.meta.glob()`
- Two plugin types: **DataCollectors** (extract data) and **BehaviorPlugins** (manipulate DOM)
- Central **CacheService** acts as event bus connecting collectors to behavior plugins
- MAIN ↔ ISOLATED world bridge via CustomEvents
- Features are user-directed — don't add features without being told to

## Plugin System
Plugins are defined as default exports in their respective directories:
- **Data Collectors** publish data to the CacheService via `cache.set()`
- **Behavior Plugins** subscribe to cache events via `cache.on()` and declare `depends` on collectors
- Plugins are auto-discovered at build time — no manual registration needed

## Key Paths
- `lib/plugin-types.ts` — DataCollector, BehaviorPlugin, CacheService interfaces
- `lib/cache.ts` — CacheService implementation (event bus + typed storage)
- `lib/cache-bridge.ts` — MAIN↔ISOLATED CustomEvent bridge
- `lib/registry.ts` — Dependency ordering, validation, auto-discovery helpers
- `lib/storage.ts` — Plugin state persistence (WXT storage API)
- `lib/types.ts` — Shared types (FeatureOption, PluginStates)
- `lib/collectors/main/` — MAIN world data collectors (e.g. tweet-data)
- `lib/collectors/isolated/` — ISOLATED world data collectors (e.g. country-data)
- `lib/plugins/` — Behavior plugins (e.g. reply-filtering, disable-video-loop)
- `entrypoints/main-world.content.ts` — MAIN world collector runner
- `entrypoints/content.ts` — ISOLATED world collector + plugin runner
- `entrypoints/background.ts` — DNR rules + storage migration
- `entrypoints/options/` — Full settings console (React)
- `entrypoints/popup/` — Quick-toggle popup (React)

## Conventions
- Maintain `docs/DESIGN.md` as living design documentation
- Update this file when architecture decisions change
