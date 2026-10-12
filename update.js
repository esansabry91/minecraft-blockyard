/* Keeps the home-screen app up to date.
 * Every page loads this to switch on the update helper (sw.js).
 * The lobby also passes data-version: when the app is opened or comes back
 * to the front, it compares that with version.json on the website and
 * refreshes itself if a newer version is out. Saved games are kept.
 */
(function () {
  const me = document.currentScript;
  const root = new URL('.', me.src).href;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(root + 'sw.js', { scope: root, updateViaCache: 'none' }).catch(() => { });
  }
  const pageVersion = me.dataset.version;
  if (!pageVersion) return;

  function banner(latest) {
    if (document.getElementById('gbUpdate')) return;
    const b = document.createElement('button');
    b.id = 'gbUpdate'; b.type = 'button';
    b.textContent = '✨ New games and updates are ready! Tap here to update';
    b.style.cssText = 'position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:99;max-width:92vw;padding:14px 18px;border:4px solid #0c0906;border-radius:14px;background:#ffcf3f;color:#2a2118;font:800 16px Nunito,system-ui,sans-serif;box-shadow:0 6px 0 rgba(0,0,0,.35);cursor:pointer';
    b.onclick = () => location.replace(root + 'index.html?v=' + encodeURIComponent(latest) + '&t=' + Date.now());
    document.body.appendChild(b);
  }
  let checking = false;
  async function check() {
    if (checking || !navigator.onLine) return;
    checking = true;
    try {
      const r = await fetch(root + 'version.json?t=' + Date.now(), { cache: 'no-store' });
      const latest = r.ok ? (await r.json()).version : null;
      if (!latest || latest === pageVersion) return;
      // refresh once by ourselves; if that still shows the old version, ask with a button instead
      let tried = null;
      try { tried = sessionStorage.getItem('gb-update-tried'); } catch (e) { }
      if (tried !== latest) {
        try { sessionStorage.setItem('gb-update-tried', latest); } catch (e) { }
        location.replace(root + 'index.html?v=' + encodeURIComponent(latest));
      } else banner(latest);
    } catch (e) { /* offline or the website is busy: try again next time */ }
    finally { checking = false; }
  }
  check();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('pageshow', e => { if (e.persisted) check(); });
  window.addEventListener('online', check);
})();
