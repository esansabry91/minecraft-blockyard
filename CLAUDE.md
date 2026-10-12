# Family Game Box

A home-screen web app (no build step) with several kids' games. The root `index.html` is the lobby; each game lives in `games/<id>/index.html`; shared scripts are in `games/shared/`.

## Releasing an update
The installed home-screen app only refreshes itself when the version changes. **Whenever you change anything, bump the version in both places, to the same new value:**
- `version.json` → `"version"`
- `index.html` → `<script src="update.js" data-version="...">`

Use the date plus a counter, e.g. `2026-10-12.2`.

`sw.js` is a network-first service worker (fresh files when online, saved copies offline). `update.js` registers it on every page and, on the lobby, reloads when `version.json` is newer than the page.

## Conventions
- Every game page includes `../../update.js` and `../shared/audio-unlock.js` before its own scripts.
- Saves use `localStorage` and must survive updates: never rename existing storage keys.
