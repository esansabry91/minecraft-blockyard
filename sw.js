/* Update helper for Family Game Box.
 * Always asks the website for the newest version of every page and file
 * (so new games and fixes show up straight away), and keeps a copy of
 * each one so games you have opened before still work without internet.
 */
const CACHE = 'gamebox-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts and other sites: leave to the browser
  if (url.pathname.endsWith('/version.json')) return; // the update check must always be live
  e.respondWith((async () => {
    try {
      // 'no-cache' makes the browser check with the website instead of using an old saved copy
      const fresh = await fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }));
      if (fresh && fresh.ok) {
        const copy = fresh.clone();
        caches.open(CACHE).then(c => c.put(url.origin + url.pathname, copy)).catch(() => { });
      }
      return fresh;
    } catch (err) { // offline: use the copy from last time
      const hit = await caches.match(url.origin + url.pathname);
      if (hit) return hit;
      throw err;
    }
  })());
});
