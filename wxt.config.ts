import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: "PinX",
    description: "Pin your tweet and jump back anytime on X",
    version: "1.0.2",
    permissions: ["storage"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"],
    action: {
      default_icon: {
        "16": "icon-16.png",
        "48": "icon-48.png",
        "128": "icon-128.png"
      }
    }
  },
  srcDir: "src"
});
