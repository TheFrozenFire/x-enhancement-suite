import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  browser: "chrome",
  runner: {
    disabled: true,
  },
  manifest: {
    name: "X Enhancement Suite",
    description: "Toggleable enhancements for a better X/Twitter experience",
    permissions: ["storage", "declarativeNetRequest"],
    host_permissions: ["*://*.x.com/*", "*://*.twitter.com/*"],
  },
});
