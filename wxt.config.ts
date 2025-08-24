import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: "X Bookmark Position",
    description: "Save and restore your reading position on X (Twitter)",
    version: "1.0.0",
    permissions: ["storage", "activeTab"],
    host_permissions: ["https://x.com/*", "https://twitter.com/*"]
  },
  srcDir: "src"
});