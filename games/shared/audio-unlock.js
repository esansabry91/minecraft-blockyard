/* Makes game sounds work on phones and tablets.
 *
 * - Browsers only let sound start from a tap, so on every tap/click/key we
 *   wake up any sound engine (AudioContext) the game has made.
 * - iPhones and iPads mute web game sounds when the device is in silent mode,
 *   even with the volume up. Asking for the "playback" audio session (newer
 *   iOS) and playing a silent looping sound (older iOS) makes them play through
 *   the speaker like a video would.
 *
 * Load this before the game's own scripts.
 */
(function () {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  const contexts = [];
  // keep a list of every sound engine the game creates
  const Tracked = function (opts) { const c = opts ? new Ctor(opts) : new Ctor(); contexts.push(c); return c; };
  Tracked.prototype = Ctor.prototype;
  window.AudioContext = Tracked;
  if (window.webkitAudioContext) window.webkitAudioContext = Tracked;

  // half a second of silence as a tiny WAV file
  function silentWavUrl() {
    const rate = 8000, n = rate / 2, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  let keepAlive = null;
  function setPlayback() {
    try { if (navigator.audioSession && navigator.audioSession.type !== 'play-and-record') navigator.audioSession.type = 'playback'; } catch (e) { }
  }
  function unlock() {
    setPlayback();
    try {
      if (!keepAlive) {
        keepAlive = new Audio(silentWavUrl());
        keepAlive.loop = true; keepAlive.setAttribute('playsinline', ''); keepAlive.preload = 'auto';
      }
      if (keepAlive.paused && !document.hidden) keepAlive.play().catch(() => { });
    } catch (e) { }
    for (const c of contexts) {
      if (c.state === 'closed') continue;
      if (c.state !== 'running') c.resume().catch(() => { });
      try { // a one-sample blip of silence finishes waking it on older iOS
        const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
      } catch (e) { }
    }
  }
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (keepAlive) keepAlive.pause(); }
  });
  window.GameAudio = { unlock, contexts };
})();
