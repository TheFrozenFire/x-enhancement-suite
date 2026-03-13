# X Enhancement Suite

## Project Overview
Chrome extension (WXT + React) that enhances the X/Twitter experience with toggleable features.

## Architecture
- **WXT framework** with React, targeting Manifest V3
- **pnpm** as package manager
- Features are user-directed — don't add features without being told to

## Feature System
Features are defined in `lib/features/`. Each feature module exports a `Feature` definition containing:
- Metadata (id, name, description, category)
- CSS selectors to hide/show elements
- Optional content script logic for complex behaviors
- Default enabled/disabled state

Feature state is persisted via WXT's `storage` API.

The content script reads enabled features and applies them:
- Selector-based features inject CSS to hide matching elements
- Script-based features execute their logic directly

## Key Paths
- `lib/features/` — Feature definitions
- `lib/storage.ts` — Feature state persistence
- `lib/types.ts` — Shared types
- `entrypoints/content.ts` — Applies features to X pages
- `entrypoints/background.ts` — Handles storage and messaging
- `entrypoints/popup/` — React UI for toggling features

## Conventions
- Maintain `docs/DESIGN.md` as living design documentation
- Update this file when architecture decisions change
