import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: "X Pin",
    description: "Pin your tweet - Pin and jump back to your tweet on X",
    version: "1.0.0",
    permissions: ["storage", "activeTab"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"]
  },
  srcDir: "src"
});