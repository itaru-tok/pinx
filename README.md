# X Pin - Pin your tweet

A Chrome extension to pin and jump back to your position on X (Twitter)

## Features

- 📍 Pin your current tweet position with one click
- ↩️ Jump back to your pinned position instantly
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
2. Click "📍 Pin" button on the right side
3. After navigating away, click "↩️ Jump" to restore position

## Tech Stack

- WXT (Web Extension Toolkit)
- TypeScript
- Chrome Extension Manifest V3