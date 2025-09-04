# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` with `entrypoints/` (content scripts), `modules/` (logic), and `styles/` (CSS).
- Build output: `.output/` (load `/.output/chrome-mv3` in Chrome during dev).
- Static assets: `public/` (e.g., `icon-48.png`).
- Config: `wxt.config.ts` (Manifest V3 via WXT) and `tsconfig.json`.

## Build, Test, and Development Commands
- `npm run dev`: Start WXT in watch mode; builds to `.output/`.
- `npm run build`: Production build for all targets.
- `npm run zip`: Create distributable archives.
- `npm run compile`: Type-check with TypeScript (no emit).

Example (first run):
```bash
npm install
npm run dev
# Chrome → chrome://extensions → Load unpacked → .output/chrome-mv3
```

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules, `"type": "module"`).
- Strictness: TS `strict` enabled; fix type errors before PR (`npm run compile`).
- Indentation: 2 spaces; prefer early returns and small, single-purpose functions.
- Filenames: lowercase for TS modules (e.g., `detector.ts`, `storage.ts`, `ui.ts`); CSS in `styles/`.
- UI text: Match product verbs “Pin” and “Jump”.

## Testing Guidelines
- No test framework configured yet. If adding significant logic, propose lightweight unit tests (e.g., Vitest) in the PR and include `npm` scripts.
- For manual verification, include steps and screenshots/GIFs (pin, navigate, jump; Following tab switching).

## Commit & Pull Request Guidelines
- Commits: Keep short, imperative, and focused (e.g., "update icon", "enhance search loading").
- PRs must include:
  - Purpose and scope with linked issue (if any).
  - Testing steps and expected behavior; screenshots for UI/UX.
  - Notes on permissions/manifest changes (if modified).

## Security & Configuration Tips
- Permissions are minimal (`storage` only). Justify any new permission in PR description.
- Persisted data lives in `chrome.storage.local` under `pinx_saved_position`; no network calls.
- Manifest and host permissions are defined in `wxt.config.ts`.

## Architecture Overview
- `TweetDetector`: Finds tweets, tracks loading, and searches by ID/context.
- `StorageManager`: Saves/restores pinned position in extension storage.
- `UIManager`: Renders Pin/Jump controls and toasts; handles theme.
- `entrypoints/content.ts`: Wires modules and binds actions for X.com/Twitter.

