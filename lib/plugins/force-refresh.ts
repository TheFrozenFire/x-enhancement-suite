import type { BehaviorPlugin, CacheService } from "../plugin-types";

const LOG = "[XES:force-refresh]";

let lastPath = window.location.pathname;
let observer: MutationObserver | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;

function checkForNavigation() {
  const currentPath = window.location.pathname;
  if (currentPath !== lastPath) {
    console.log(LOG, "SPA navigation detected:", lastPath, "→", currentPath);
    lastPath = currentPath;
    window.location.reload();
  }
}

function cleanupAll() {
  console.log(LOG, "Cleanup");
  observer?.disconnect();
  observer = null;
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

const forceRefresh: BehaviorPlugin = {
  id: "force-refresh",
  name: "Force Refresh on Navigation",
  description:
    "Performs a full page reload on SPA route changes (workaround for broken X navigation)",
  category: "Fixes",
  defaultEnabled: false,
  depends: [],

  async init(_cache: CacheService) {
    console.log(LOG, "Init — watching for SPA navigation");
    lastPath = window.location.pathname;

    // Poll for URL changes (pushState/replaceState don't fire events reliably)
    checkInterval = setInterval(checkForNavigation, 500);
  },

  cleanup: cleanupAll,
};

export default forceRefresh;
