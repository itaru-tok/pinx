import { defineConfig } from 'wxt';
import fs from 'node:fs';

// Read version from package.json to keep manifest and zip name in sync
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  manifest: {
    name: "PinX",
    description: "Pin your tweet and jump back anytime on X",
    version: pkg.version,
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
