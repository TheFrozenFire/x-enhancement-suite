import { useState, useEffect, useMemo } from "react";
import type { Plugin, DataCollector, BehaviorPlugin } from "@/lib/plugin-types";
import { isDataCollector, isBehaviorPlugin } from "@/lib/plugin-types";
import { extractPlugins, getPluginsByCategory } from "@/lib/registry";
import { pluginStates, featureOptionStates, aiProviderConfig, setPluginEnabled, setFeatureOption } from "@/lib/storage";
import type { PluginStates, FeatureOptionStates } from "@/lib/types";
import type { AiProviderConfig, AiProvider } from "@/lib/ai/types";

// Discover all plugins for metadata
const collectorMainModules = import.meta.glob<{ default: DataCollector }>(
  "../../lib/collectors/main/*.ts",
  { eager: true }
);
const collectorIsolatedModules = import.meta.glob<{ default: DataCollector }>(
  "../../lib/collectors/isolated/*.ts",
  { eager: true }
);
const pluginModules = import.meta.glob<{ default: BehaviorPlugin }>(
  "../../lib/plugins/*.ts",
  { eager: true }
);

const allCollectors = [
  ...extractPlugins(collectorMainModules),
  ...extractPlugins(collectorIsolatedModules),
];
const allBehaviorPlugins = extractPlugins(pluginModules);
const allPlugins: Plugin[] = [...allCollectors, ...allBehaviorPlugins];

function App() {
  const [states, setStates] = useState<PluginStates>({});
  const [optionStates, setOptionStates] = useState<FeatureOptionStates>({});
  const [providerConfig, setProviderConfig] = useState<AiProviderConfig>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Build defaults
  const defaults = useMemo<PluginStates>(
    () => Object.fromEntries(allPlugins.map((p) => [p.id, p.defaultEnabled])),
    []
  );

  // Load states
  useEffect(() => {
    pluginStates.getValue().then((s) => setStates(s));
    featureOptionStates.getValue().then((s) => setOptionStates(s));
    aiProviderConfig.getValue().then((s) => setProviderConfig(s));

    const unwatchPlugin = pluginStates.watch((s) => setStates(s));
    const unwatchOption = featureOptionStates.watch((s) => setOptionStates(s));
    const unwatchProvider = aiProviderConfig.watch((s) => setProviderConfig(s));
    return () => {
      unwatchPlugin();
      unwatchOption();
      unwatchProvider();
    };
  }, []);

  const merged = { ...defaults, ...states };

  // Categories
  const categories = useMemo(() => {
    const cats = getPluginsByCategory(allPlugins);
    // "Data Sources" first, then alphabetical
    const sorted = [...cats.keys()].sort((a, b) => {
      if (a === "Data Sources") return -1;
      if (b === "Data Sources") return 1;
      return a.localeCompare(b);
    });
    return sorted.map((name) => ({ name, plugins: cats.get(name)! }));
  }, []);

  // Filtered plugins
  const visiblePlugins = useMemo(() => {
    let plugins = selectedCategory
      ? allPlugins.filter((p) => p.category === selectedCategory)
      : allPlugins;

    if (search) {
      const q = search.toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }

    return plugins;
  }, [selectedCategory, search]);

  // Find plugins that depend on a given collector
  function getDependentPlugins(collectorId: string): BehaviorPlugin[] {
    return allBehaviorPlugins.filter((p) =>
      p.depends?.includes(collectorId)
    );
  }

  async function handleProviderChange(
    slot: "fast" | "smart" | "search",
    field: keyof AiProvider,
    value: string | Record<string, unknown>
  ) {
    const current = await aiProviderConfig.getValue();
    const slotConfig = current[slot] ?? { endpoint: "", apiKey: "", model: "" };
    const updated = { ...slotConfig, [field]: value };
    // Clean out empty extraParams
    if (field === "extraParams" && (value === "" || value === null)) {
      delete (updated as any).extraParams;
    }
    await aiProviderConfig.setValue({
      ...current,
      [slot]: updated,
    });
  }

  async function handleToggle(pluginId: string, enabled: boolean) {
    await setPluginEnabled(pluginId, enabled);
  }

  async function handleOptionChange(
    pluginId: string,
    optionId: string,
    value: boolean | number | string
  ) {
    await setFeatureOption(pluginId, optionId, value);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#15202b", color: "#e7e9ea" }}>
      {/* Sidebar */}
      <nav style={{ width: 220, borderRight: "1px solid #38444d", padding: "16px 0", flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, padding: "0 16px 12px", margin: 0, color: "#1d9bf0" }}>
          X Enhancement Suite
        </h1>

        <div style={{ padding: "0 12px 12px" }}>
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              border: "1px solid #38444d",
              borderRadius: 8,
              background: "#192734",
              color: "#e7e9ea",
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 16px",
            border: "none",
            background: selectedCategory === null ? "#1d9bf020" : "transparent",
            color: selectedCategory === null ? "#1d9bf0" : "#8b98a5",
            fontWeight: selectedCategory === null ? 700 : 400,
            fontSize: 14,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          All
        </button>

        <button
          onClick={() => setSelectedCategory("__ai_providers__")}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 16px",
            border: "none",
            background: selectedCategory === "__ai_providers__" ? "#1d9bf020" : "transparent",
            color: selectedCategory === "__ai_providers__" ? "#1d9bf0" : "#8b98a5",
            fontWeight: selectedCategory === "__ai_providers__" ? 700 : 400,
            fontSize: 14,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          AI Providers
        </button>

        {categories.map(({ name, plugins }) => (
          <button
            key={name}
            onClick={() => setSelectedCategory(name)}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 16px",
              border: "none",
              background: selectedCategory === name ? "#1d9bf020" : "transparent",
              color: selectedCategory === name ? "#1d9bf0" : "#8b98a5",
              fontWeight: selectedCategory === name ? 700 : 400,
              fontSize: 14,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {name} ({plugins.length})
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: 24, maxWidth: 720 }}>
        {selectedCategory === "__ai_providers__" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>
              AI Providers
            </h2>
            <p style={{ fontSize: 13, color: "#8b98a5", margin: "0 0 16px" }}>
              Configure OpenAI-compatible LLM endpoints. The "fast" slot is used for high-volume tasks like reply classification. The "smart" slot is reserved for future deeper analysis. The "search" slot powers X post search via Grok.
            </p>

            {(["fast", "smart", "search"] as const).map((slot) => {
              const config = providerConfig[slot] ?? { endpoint: "", apiKey: "", model: "" };
              const isEmpty = !config.endpoint && !config.apiKey && !config.model;
              return (
                <div
                  key={slot}
                  style={{
                    border: "1px solid #38444d",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    background: "#192734",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize" }}>
                      {slot} Provider
                    </span>
                    {isEmpty && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#8b98a5" }}>
                        Not configured
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: "#8b98a5", display: "block", marginBottom: 4 }}>
                      Endpoint URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://api.example.com/v1"
                      value={config.endpoint}
                      onChange={(e) => handleProviderChange(slot, "endpoint", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #38444d",
                        borderRadius: 8,
                        background: "#15202b",
                        color: "#e7e9ea",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: "#8b98a5", display: "block", marginBottom: 4 }}>
                      API Key
                    </label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={config.apiKey}
                      onChange={(e) => handleProviderChange(slot, "apiKey", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #38444d",
                        borderRadius: 8,
                        background: "#15202b",
                        color: "#e7e9ea",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: "#8b98a5", display: "block", marginBottom: 4 }}>
                      Model
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. gpt-4o-mini"
                      value={config.model}
                      onChange={(e) => handleProviderChange(slot, "model", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #38444d",
                        borderRadius: 8,
                        background: "#15202b",
                        color: "#e7e9ea",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: "#8b98a5", display: "block", marginBottom: 4 }}>
                      Extra Parameters (JSON)
                    </label>
                    <textarea
                      placeholder='e.g. {"reasoning_effort": "low"}'
                      value={config.extraParams ? JSON.stringify(config.extraParams, null, 2) : ""}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (!val) {
                          handleProviderChange(slot, "extraParams", "" as any);
                          return;
                        }
                        try {
                          const parsed = JSON.parse(val);
                          handleProviderChange(slot, "extraParams", parsed);
                        } catch {
                          // Don't update storage on invalid JSON — let user keep typing
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #38444d",
                        borderRadius: 8,
                        background: "#15202b",
                        color: "#e7e9ea",
                        fontSize: 13,
                        fontFamily: "monospace",
                        boxSizing: "border-box",
                        minHeight: 60,
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedCategory !== "__ai_providers__" && visiblePlugins.map((plugin) => {
          const enabled = merged[plugin.id] ?? plugin.defaultEnabled;
          const isCollector = isDataCollector(plugin);
          const dependents = isCollector ? getDependentPlugins(plugin.id) : [];
          const disabledDependents = dependents.filter((d) => merged[d.id]);

          return (
            <div
              key={plugin.id}
              style={{
                border: "1px solid #38444d",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                background: "#192734",
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{plugin.name}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#8b98a5" }}>
                    {plugin.category}
                  </span>
                  {isCollector && (plugin as DataCollector).world === "main" && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: "#f4212e",
                        background: "#f4212e20",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      Requires reload
                    </span>
                  )}
                </div>

                {/* Toggle switch */}
                <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => handleToggle(plugin.id, e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      cursor: "pointer",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: enabled ? "#1d9bf0" : "#38444d",
                      borderRadius: 24,
                      transition: "background 0.2s",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        content: '""',
                        height: 18,
                        width: 18,
                        left: enabled ? 22 : 3,
                        bottom: 3,
                        background: "#fff",
                        borderRadius: "50%",
                        transition: "left 0.2s",
                      }}
                    />
                  </span>
                </label>
              </div>

              <p style={{ fontSize: 13, color: "#8b98a5", margin: "6px 0 0" }}>
                {plugin.description}
              </p>

              {/* Dependency warning */}
              {!enabled && disabledDependents.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 12px",
                    background: "#f4212e15",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#f4212e",
                  }}
                >
                  Disabling this collector affects:{" "}
                  {disabledDependents.map((d) => d.name).join(", ")}
                </div>
              )}

              {/* Options */}
              {enabled && plugin.options && plugin.options.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #38444d" }}>
                  {plugin.options.map((opt) => {
                    const value =
                      optionStates[plugin.id]?.[opt.id] ?? opt.defaultValue;

                    return (
                      <div key={opt.id} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</span>
                            {opt.description && (
                              <p style={{ fontSize: 12, color: "#8b98a5", margin: "2px 0 0" }}>
                                {opt.description}
                              </p>
                            )}
                          </div>

                          {opt.type === "boolean" && (
                            <label style={{ position: "relative", display: "inline-block", width: 36, height: 20, flexShrink: 0 }}>
                              <input
                                type="checkbox"
                                checked={value as boolean}
                                onChange={(e) =>
                                  handleOptionChange(plugin.id, opt.id, e.target.checked)
                                }
                                style={{ opacity: 0, width: 0, height: 0 }}
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  cursor: "pointer",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: value ? "#1d9bf0" : "#38444d",
                                  borderRadius: 20,
                                  transition: "background 0.2s",
                                }}
                              >
                                <span
                                  style={{
                                    position: "absolute",
                                    height: 14,
                                    width: 14,
                                    left: value ? 19 : 3,
                                    bottom: 3,
                                    background: "#fff",
                                    borderRadius: "50%",
                                    transition: "left 0.2s",
                                  }}
                                />
                              </span>
                            </label>
                          )}
                        </div>

                        {opt.type === "number" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <input
                              type="range"
                              min={opt.min}
                              max={opt.max}
                              step={opt.step}
                              value={value as number}
                              onChange={(e) =>
                                handleOptionChange(
                                  plugin.id,
                                  opt.id,
                                  parseFloat(e.target.value)
                                )
                              }
                              style={{ flex: 1, accentColor: "#1d9bf0" }}
                            />
                            <input
                              type="number"
                              min={opt.min}
                              max={opt.max}
                              step={opt.step}
                              value={value as number}
                              onChange={(e) =>
                                handleOptionChange(
                                  plugin.id,
                                  opt.id,
                                  parseFloat(e.target.value) || opt.defaultValue
                                )
                              }
                              style={{
                                width: 70,
                                padding: "4px 6px",
                                border: "1px solid #38444d",
                                borderRadius: 6,
                                background: "#15202b",
                                color: "#e7e9ea",
                                fontSize: 13,
                              }}
                            />
                          </div>
                        )}

                        {opt.type === "string" && (
                          <input
                            type="text"
                            value={value as string}
                            onChange={(e) =>
                              handleOptionChange(plugin.id, opt.id, e.target.value)
                            }
                            style={{
                              marginTop: 6,
                              width: "100%",
                              padding: "6px 10px",
                              border: "1px solid #38444d",
                              borderRadius: 8,
                              background: "#15202b",
                              color: "#e7e9ea",
                              fontSize: 13,
                              boxSizing: "border-box",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </main>

    </div>
  );
}

export default App;
