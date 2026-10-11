/* Peer-to-peer room for playing together on different devices.
 * Based on Blockyard's room code. Needs peerjs.min.js loaded first (window.Peer).
 *
 * The first device to join a room code becomes the host; everyone else connects
 * to the host, which relays messages. If the host leaves, the others reconnect
 * and one of them takes over as host.
 *
 *   const room = await GameRoom.join('zoomkarts-family');
 *   room.on('topic', m => m.data, m.peer);   room.emit('topic', data);
 *   room.presence({ name: 'Sam' });          room.onPeers(({ peers }) => ...);
 *   room.isHost(); room.selfId(); room.leave();
 *
 * Tests can point it at a local PeerJS server with window.GAMEBOX_PEER_OPTS.
 */
(function () {
  function join(key) {
    return new Promise((resolve, reject) => {
      const PeerCtor = window.Peer;
      if (!PeerCtor) { reject(new Error('no peer library')); return; }
      const opts = window.GAMEBOX_PEER_OPTS || {};
      const hostId = key + '-host';
      const handlers = {}, listeners = [], conns = new Map(), table = new Map();
      let selfId = null, isHost = false, peer = null, hostConn = null, myPres = {}, settled = false, closed = false, bt = 0, tries = 0, lastHost = 0, gen = 0, pend = 0;
      const done = (ok, e) => { if (settled) return; settled = true; ok ? resolve(room) : reject(e); };
      const deliver = (topic, data, from) => {
        for (const fn of (handlers[topic] || []).slice()) { try { fn({ topic, data, peer: from }); } catch (e) { console.error(e); } }
      };
      const peersArr = () => Array.from(table, ([id, pr]) => ({ peer: id, presence: pr, isMe: id === selfId, isHost: id === hostId }));
      const notify = () => { const arr = peersArr(); for (const fn of listeners.slice()) { try { fn({ peers: arr }); } catch (e) { console.error(e); } } };
      const broadcastPeers = () => { if (!isHost) return; const list = Array.from(table); for (const c of conns.values()) if (c.open) { try { c.send({ t: 'peers', l: list }); } catch (e) { } } notify(); };
      const schedulePeers = () => { if (!bt) bt = setTimeout(() => { bt = 0; broadcastPeers(); }, 80); };
      const restart = () => {
        if (closed || pend) return;
        gen++;
        try { peer && peer.destroy(); } catch (e) { }
        peer = null; hostConn = null; conns.clear(); table.clear(); notify();
        if (++tries > 30) tries = 20;
        pend = setTimeout(() => { pend = 0; startHost(); }, 400 + Math.random() * 1600 + Math.min(tries, 6) * 300);
      };
      function startHost() {
        if (closed) return;
        isHost = true;
        const my = ++gen;
        const pr = peer = new PeerCtor(hostId, opts);
        peer.on('open', id => { if (my !== gen) return; selfId = id; table.set(selfId, myPres); tries = 0; notify(); done(true); });
        peer.on('connection', c => {
          if (my !== gen) { try { c.close(); } catch (e) { } return; }
          c.on('open', () => { c.lastSeen = Date.now(); conns.set(c.peer, c); table.set(c.peer, {}); schedulePeers(); });
          c.on('data', m => {
            c.lastSeen = Date.now();
            if (!m || typeof m !== 'object') return;
            if (m.t === 'ev' && typeof m.topic === 'string') {
              deliver(m.topic, m.data, c.peer);
              for (const [id, o] of conns) if (id !== c.peer && o.open) { try { o.send({ t: 'ev', topic: m.topic, data: m.data, from: c.peer }); } catch (e) { } }
            } else if (m.t === 'pr') { table.set(c.peer, m.p && typeof m.p === 'object' ? m.p : {}); schedulePeers(); }
          });
          c.on('close', () => { conns.delete(c.peer); table.delete(c.peer); schedulePeers(); });
          c.on('error', () => { });
        });
        peer.on('error', err => {
          if (my !== gen) return;
          if (err && err.type === 'unavailable-id') { try { pr.destroy(); } catch (e) { } startClient(); }
          else if (err && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed')) { if (!settled) done(false, err); else restart(); }
        });
        peer.on('disconnected', () => { if (my === gen) try { pr.reconnect(); } catch (e) { } });
      }
      function startClient() {
        if (closed) return;
        isHost = false;
        const my = ++gen;
        const pr = peer = new PeerCtor(undefined, opts);
        let opened = false;
        peer.on('open', id => {
          if (my !== gen) return;
          selfId = id;
          hostConn = peer.connect(hostId, { reliable: true });
          hostConn.on('open', () => { opened = true; tries = 0; lastHost = Date.now(); try { hostConn.send({ t: 'pr', p: myPres }); } catch (e) { } done(true); });
          hostConn.on('data', m => {
            lastHost = Date.now();
            if (!m || typeof m !== 'object') return;
            if (m.t === 'peers' && Array.isArray(m.l)) { table.clear(); for (const e of m.l) if (Array.isArray(e) && typeof e[0] === 'string') table.set(e[0], e[1] && typeof e[1] === 'object' ? e[1] : {}); notify(); }
            else if (m.t === 'ev' && typeof m.topic === 'string') deliver(m.topic, m.data, typeof m.from === 'string' ? m.from : hostId);
          });
          hostConn.on('close', () => { if (opened && my === gen) restart(); });
          hostConn.on('error', () => { });
          setTimeout(() => { if (!opened && !closed && my === gen) restart(); }, 6000);
        });
        peer.on('error', err => {
          if (my !== gen) return;
          if (err && err.type === 'peer-unavailable') restart();
          else if (err && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')) { if (!settled) done(false, err); else restart(); }
        });
        peer.on('disconnected', () => { if (my === gen) try { pr.reconnect(); } catch (e) { } });
      }
      const room = {
        emit(topic, data) {
          if (isHost) { for (const c of conns.values()) if (c.open) { try { c.send({ t: 'ev', topic, data, from: selfId }); } catch (e) { } } }
          else if (hostConn && hostConn.open) { try { hostConn.send({ t: 'ev', topic, data }); } catch (e) { } }
        },
        on(topic, fn) { (handlers[topic] = handlers[topic] || []).push(fn); return () => { handlers[topic] = (handlers[topic] || []).filter(f => f !== fn); }; },
        presence(patch) {
          myPres = Object.assign({}, myPres, patch);
          if (isHost) { table.set(selfId, myPres); schedulePeers(); }
          else if (hostConn && hostConn.open) { try { hostConn.send({ t: 'pr', p: myPres }); } catch (e) { } }
        },
        peers: peersArr,
        onPeers(fn) { listeners.push(fn); setTimeout(() => fn({ peers: peersArr() }), 0); return () => { const k = listeners.indexOf(fn); if (k >= 0) listeners.splice(k, 1); }; },
        isHost: () => isHost && selfId === hostId,
        selfId: () => selfId,
        hostId,
        leave() { closed = true; clearInterval(beat); try { peer && peer.destroy(); } catch (e) { } },
      };
      const beat = setInterval(() => {
        if (closed) return;
        const now = Date.now();
        if (isHost) {
          for (const [id, c] of Array.from(conns)) {
            if (c.open) { try { c.send({ t: 'hb' }); } catch (e) { } }
            if (now - (c.lastSeen || now) > 8000) { try { c.close(); } catch (e) { } conns.delete(id); table.delete(id); schedulePeers(); }
          }
        } else if (hostConn && hostConn.open) {
          try { hostConn.send({ t: 'pr', p: myPres }); } catch (e) { }
          if (now - lastHost > 7000) restart();
        }
      }, 2000);
      setTimeout(() => { if (!settled) { room.leave(); done(false, new Error('timeout')); } }, 14000);
      startHost();
    });
  }
  window.GameRoom = { join };
})();
