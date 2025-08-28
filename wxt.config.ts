import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: "PinX",
    description: "Pin your tweet and jump back anytime on X",
    version: "1.0.1",
    permissions: ["storage"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"]
  },
  srcDir: "src"
});