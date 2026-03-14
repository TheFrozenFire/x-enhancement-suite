# X Enhancement Suite

A Chrome extension that enhances the X/Twitter experience with toggleable plugins for reply filtering, AI-powered content classification, and more.

Built with [WXT](https://wxt.dev/) + React, targeting Manifest V3.

## Features

- **Reply filtering** — collapse low-engagement, short, or foreign-country replies with configurable thresholds
- **AI classification** — route replies through any OpenAI-compatible LLM to detect vitriol, low-value content, etc.
- **Plugin architecture** — data collectors and behavior plugins, auto-discovered at build time, toggleable per-user
- **Options page** — full settings console with per-plugin configuration
- **Popup** — quick-toggle for all plugins

## Setup

```bash
pnpm install
pnpm wxt build
```

Load the unpacked extension from `.output/chrome-mv3` in `chrome://extensions`.

For development with hot reload:

```bash
pnpm dev
```

## AI Providers

AI classification requires an OpenAI-compatible endpoint. Configure it in the extension options page under **AI Providers**:

1. Set the **Endpoint URL** (base URL, e.g. `https://api.venice.ai/api/v1`)
2. Set the **API Key** and **Model**
3. Optionally add **Extra Parameters** as JSON (e.g. `{"venice_parameters": {"disable_thinking": true}}`)

The "fast" slot powers high-volume classifiers. The "smart" slot is reserved for future use.

Without a provider configured, AI classifiers silently skip — everything else works normally.

## Adding Classifiers

Drop a new file in `lib/ai/classifiers/` with a default export matching the `AiClassifier` interface. It will be auto-discovered at build time. No registration needed.

## Project Structure

```
lib/
  ai/                  # LLM provider types, client, classifier definitions
  collectors/          # Data collectors (MAIN and ISOLATED world)
  plugins/             # Behavior plugins (DOM manipulation)
  cache.ts             # In-memory event bus connecting collectors to plugins
  registry.ts          # Auto-discovery and dependency ordering
  storage.ts           # WXT storage (plugin states, options, provider config)
entrypoints/
  background.ts        # Service worker (DNR rules, LLM proxy)
  content.ts           # ISOLATED world runner
  main-world.content.ts # MAIN world runner (React fiber access)
  options/             # Full settings page (React)
  popup/               # Quick-toggle popup (React)
```
