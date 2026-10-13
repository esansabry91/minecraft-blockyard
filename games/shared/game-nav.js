/* The same easy menu in every game: keep playing, start again, the game's own
 * menu, back to all games, and full screen on/off.
 *
 *   GameNav.open({ title, onClose, items: [{ icon, label, fn, primary }] })
 *   GameNav.enterFull()   // call from a tap (e.g. a Play button)
 *
 * Full screen only lasts for one page, so each game asks again when it starts.
 * iPhones can't make web pages full screen (only the home-screen app is).
 */
(function () {
  const lobbyUrl = new URL('../../index.html', document.currentScript.src).href;
  const style = document.createElement('style');
  style.textContent = `
  .gnSheet { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 16px; }
  .gnBox { width: min(420px, 100%); max-height: 92vh; overflow: auto; background: #2a2118; border: 4px solid #0c0906; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 0 rgba(0,0,0,.35); }
  .gnBox h2 { margin: 0 0 4px; text-align: center; font: 20px/1.3 "Press Start 2P", ui-monospace, monospace; color: #ffcf3f; }
  .gnBtn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; background: #3b2f22; color: #f5ecd6; border: 3px solid #0c0906; border-radius: 12px; font: 800 18px Nunito, system-ui, sans-serif; text-align: left; text-decoration: none; cursor: pointer; }
  .gnBtn .gnIc { font-size: 26px; width: 32px; text-align: center; flex-shrink: 0; }
  .gnBtn.gnPrimary { background: #ffcf3f; color: #2a2118; }
  .gnBtn:active { transform: scale(.98); }`;
  document.head.appendChild(style);

  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  // an installed home-screen app is already full screen (but full screen we asked for also reports 'fullscreen')
  const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || (matchMedia('(display-mode: fullscreen)').matches && !isFull())));
  const el = document.documentElement;
  const canFull = () => !isStandalone() && !!(el.requestFullscreen || el.webkitRequestFullscreen);
  function enterFull() {
    if (!canFull() || isFull()) return;
    try { const f = el.requestFullscreen || el.webkitRequestFullscreen; const p = f.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => { }); } catch (e) { }
  }
  function exitFull() {
    try { const f = document.exitFullscreen || document.webkitExitFullscreen; const p = f && f.call(document); if (p && p.catch) p.catch(() => { }); } catch (e) { }
  }

  let sheet = null, onClose = null;
  function close(resume) {
    if (!sheet) return;
    sheet.remove(); sheet = null;
    const cb = onClose; onClose = null;
    if (resume && cb) cb();
  }
  function open(opts = {}) {
    close(false);
    onClose = opts.onClose || null;
    sheet = document.createElement('div'); sheet.className = 'gnSheet';
    const box = document.createElement('div'); box.className = 'gnBox'; sheet.appendChild(box);
    const h = document.createElement('h2'); h.textContent = opts.title || 'Menu'; box.appendChild(h);
    const add = (icon, label, fn, primary, href) => {
      const b = document.createElement(href ? 'a' : 'button');
      b.className = 'gnBtn' + (primary ? ' gnPrimary' : '');
      if (href) b.href = href; else b.type = 'button';
      const i = document.createElement('span'); i.className = 'gnIc'; i.textContent = icon; b.appendChild(i);
      b.appendChild(document.createTextNode(label));
      if (fn) b.addEventListener('click', fn);
      box.appendChild(b);
      return b;
    };
    for (const it of opts.items || []) add(it.icon, it.label, () => { if (it.resume) close(true); else { close(false); it.fn && it.fn(); } }, it.primary);
    add('🏠', 'All games', null, false, lobbyUrl);
    if (canFull()) {
      const fb = add('', '', () => { if (isFull()) exitFull(); else enterFull(); });
      fb.id = 'gnFull'; syncFull();
    }
    sheet.addEventListener('click', e => { if (e.target === sheet) close(true); }); // tap outside = keep playing
    document.body.appendChild(sheet);
  }
  function syncFull() {
    const fb = document.getElementById('gnFull'); if (!fb) return;
    fb.firstChild.textContent = isFull() ? '🗗' : '⛶'; fb.lastChild.textContent = isFull() ? 'Exit full screen' : 'Full screen';
  }
  document.addEventListener('fullscreenchange', syncFull); document.addEventListener('webkitfullscreenchange', syncFull);
  window.addEventListener('keydown', e => { if (sheet && e.key === 'Escape') { e.stopImmediatePropagation(); close(true); } }, true);
  window.GameNav = { open, close, enterFull, exitFull, isFull, canFull, isOpen: () => !!sheet, lobbyUrl };
})();
