# X Bookmark Position Extension

A Chrome extension to save and restore your scroll position on X (Twitter)

## Features

- 📍 Save current tweet position with one click
- ↩️ Instantly return to saved position
- ⌨️ Keyboard shortcuts support
  - `Ctrl/Cmd + Shift + S`: Save position
  - `Ctrl/Cmd + Shift + R`: Restore position
- 🌓 Automatic dark/light mode support
- 📱 Responsive design

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start in development mode:
```bash
npm run dev
```

3. Load extension in Chrome:
   - Open Chrome extensions page: `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `.output/chrome-mv3` folder

## Build

Production build:
```bash
npm run build
```

## Usage

1. Open X.com (Twitter)
2. Click "📍 Save Position" button on the right side
3. After navigating away, click "↩️ Return to Previous" to restore position

## Tech Stack

- WXT (Web Extension Toolkit)
- TypeScript
- Chrome Extension Manifest V3