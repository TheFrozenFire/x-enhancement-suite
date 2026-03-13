import { features } from "@/lib/features";
import { featureStates, featureOptionStates } from "@/lib/storage";
import type { FeatureStates } from "@/lib/types";

const STYLE_ID = "xes-hide-styles";
const activeScripts = new Map<string, () => void>();

function buildCSS(states: FeatureStates): string {
  return features
    .filter((f) => states[f.id] && f.hideSelectors?.length)
    .flatMap((f) => f.hideSelectors!)
    .map((selector) => `${selector} { display: none !important; }`)
    .join("\n");
}

function applyStyles(states: FeatureStates) {
  let style = document.getElementById(STYLE_ID);
  const css = buildCSS(states);

  if (!css) {
    style?.remove();
    return;
  }

  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

async function applyScripts(states: FeatureStates) {
  for (const feature of features) {
    const shouldBeActive = !!states[feature.id];
    const isActive = activeScripts.has(feature.id);

    if (shouldBeActive && !isActive && feature.contentScript) {
      await feature.contentScript.init();
      activeScripts.set(feature.id, feature.contentScript.cleanup);
    } else if (!shouldBeActive && isActive) {
      activeScripts.get(feature.id)!();
      activeScripts.delete(feature.id);
    }
  }
}

async function applyFeatures(states: FeatureStates) {
  applyStyles(states);
  await applyScripts(states);
}

export default defineContentScript({
  matches: ["*://*.x.com/*", "*://*.twitter.com/*"],
  async main() {
    const defaults: FeatureStates = Object.fromEntries(
      features.map((f) => [f.id, f.defaultEnabled])
    );
    const stored = await featureStates.getValue();
    const states = { ...defaults, ...stored };
    await applyFeatures(states);

    featureStates.watch((newStates: FeatureStates) => {
      applyFeatures({ ...defaults, ...newStates });
    });

    // Re-init active script features when their options change
    featureOptionStates.watch(async () => {
      for (const feature of features) {
        if (activeScripts.has(feature.id) && feature.contentScript) {
          activeScripts.get(feature.id)!(); // cleanup
          await feature.contentScript.init(); // re-init with new options
          activeScripts.set(feature.id, feature.contentScript.cleanup);
        }
      }
    });
  },
});
