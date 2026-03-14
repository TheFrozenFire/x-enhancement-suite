import { useState, useEffect, useMemo } from "react";
import type { DataCollector, BehaviorPlugin, Plugin } from "@/lib/plugin-types";
import { extractPlugins } from "@/lib/registry";
import { pluginStates, setPluginEnabled } from "@/lib/storage";
import type { PluginStates } from "@/lib/types";

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

const allPlugins: Plugin[] = [
  ...extractPlugins(collectorMainModules),
  ...extractPlugins(collectorIsolatedModules),
  ...extractPlugins(pluginModules),
];

function App() {
  const [states, setStates] = useState<PluginStates>({});

  const defaults = useMemo<PluginStates>(
    () => Object.fromEntries(allPlugins.map((p) => [p.id, p.defaultEnabled])),
    []
  );

  useEffect(() => {
    pluginStates.getValue().then((s) => setStates(s));
    const unwatch = pluginStates.watch((s) => setStates(s));
    return () => unwatch();
  }, []);

  const merged = { ...defaults, ...states };

  async function handleToggle(pluginId: string, enabled: boolean) {
    await setPluginEnabled(pluginId, enabled);
  }

  function openSettings() {
    browser.runtime.openOptionsPage();
  }

  return (
    <div style={{ width: 280, padding: 12, fontFamily: "system-ui, sans-serif", background: "#15202b", color: "#e7e9ea" }}>
      <h1 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px", color: "#1d9bf0" }}>
        X Enhancement Suite
      </h1>

      {allPlugins.map((plugin) => {
        const enabled = merged[plugin.id] ?? plugin.defaultEnabled;
        return (
          <div
            key={plugin.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #38444d",
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{plugin.name}</span>
              <span style={{ marginLeft: 6, fontSize: 11, color: "#8b98a5" }}>
                {plugin.category}
              </span>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: 36, height: 20, flexShrink: 0 }}>
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
                  borderRadius: 20,
                  transition: "background 0.2s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    height: 14,
                    width: 14,
                    left: enabled ? 19 : 3,
                    bottom: 3,
                    background: "#fff",
                    borderRadius: "50%",
                    transition: "left 0.2s",
                  }}
                />
              </span>
            </label>
          </div>
        );
      })}

      <button
        onClick={openSettings}
        style={{
          display: "block",
          width: "100%",
          marginTop: 10,
          padding: "8px 0",
          border: "none",
          borderRadius: 8,
          background: "#1d9bf0",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Open Full Settings
      </button>
    </div>
  );
}

export default App;
