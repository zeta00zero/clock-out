// Clock Out! v5 — ONLINE CO-OP (PeerJS / WebRTC, host-authoritative).
//  * the host runs sim.js; clients send inputs (~60 Hz on change) and get snapshots at 20 Hz (delta-encoded, keyframe every 2 s)
//  * clients keep a mirror Sim (never stepped) that render()/HUD read; positions are interpolated between snapshots
//  * cosmetic sim events are forwarded; scene flow (Game / Cutscene / Intro / Result / GameOver) follows the host
//  * a dropped client becomes a CPU bot; if the host drops, clients get a message and go back to the title
//  Classic script (no modules) so file:// keeps working; online simply reports "unavailable" without PeerJS / network.
(function (CO) {
  const Q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
  const CFG = { prefix: 'clockout-v5-', alpha: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', ver: 'clockout-v5.0', snapEvery: 3, keyEvery: 40, pingMs: 2000, lostMs: 12000, joinMs: 15000, max: 5 };
  const FLOW = new Set(['clear', 'failed', 'survArena', 'survwin']);           // never replayed on clients (the host drives scene changes)
  const SYNC = new Set(['Game', 'Cutscene', 'Intro', 'Result', 'GameOver']);    // host scene changes mirrored on every client
  const OUT = new Set(['Title', 'StageSelect', 'SurvSelect', 'CharSelect', 'HowTo']);   // host leaving play -> everyone back to the lobby
  const ENT = ['players', 'enemies', 'projs', 'pickups', 'hazards', 'zones', 'allies', 'lures'];
  const now = () => performance.now();

  const N = CO.net = {
    CFG, mode: null, session: false, code: null, peer: null, conns: [], host: null, me: { name: '', char: 'lemon', ready: false, slot: 0 },
    lobby: { players: [], mode: 'story', stage: 's1', level: 1 }, status: '', err: '', names: null, mySlot: 0,
    stats: { tx: 0, rx: 0, snaps: 0, snapBytes: 0, evs: 0, ins: 0, txRate: 0, rxRate: 0, maxSnap: 0, rtt: {}, t0: now() },
    isHost: () => N.mode === 'host' && N.session, isClient: () => N.mode === 'client' && N.session, active: () => N.session,
    hostCmd() {},   // v4.3 hook: restarts are now mirrored generically (scene restart hook below)
    available: () => typeof window.Peer === 'function',
  };
  window.__net = N;
  const name0 = () => { try { return localStorage.getItem('clockout.name') || ''; } catch (e) { return ''; } };
  N.me.name = (Q.get('name') || name0() || 'Player').slice(0, 12);
  { const c0 = Q.get('char') || (() => { try { return localStorage.getItem('clockout.netchar'); } catch (e) { return null; } })(); if (c0 && CO.CHARACTERS && CO.CHARACTERS[c0]) N.me.char = c0; }
  N.setName = s => { N.me.name = String(s || 'Player').replace(/[^\w .!?-]/g, '').slice(0, 12) || 'Player'; try { localStorage.setItem('clockout.name', N.me.name); } catch (e) {} if (N.isClient()) N.send({ t: 'name', name: N.me.name }); else if (N.isHost()) { N.lobbyMe().name = N.me.name; N.pushLobby(); } };
  N.genCode = () => { let s = ''; for (let i = 0; i < 6; i++) s += CFG.alpha[Math.floor(Math.random() * CFG.alpha.length)]; return s; };
  N.cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').split('').filter(c => CFG.alpha.includes(c)).join('').slice(0, 6);

  function peerOpts() {
    const o = { debug: +(Q.get('netdebug') || 0) }, host = Q.get('peerhost');
    if (host) { o.host = host; o.port = +(Q.get('peerport') || 443); o.path = Q.get('peerpath') || '/'; const sec = Q.get('peersecure'); o.secure = sec != null ? sec !== '0' : o.port === 443; o.key = Q.get('peerkey') || 'peerjs'; }
    const ice = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }];
    const tu = Q.get('turn'); if (tu) ice.unshift({ urls: tu.split(/[\s,]+/).filter(Boolean), username: Q.get('turnuser') || '', credential: Q.get('turncred') || '' });
    o.config = { iceServers: ice }; if (Q.get('relay') === '1') o.config.iceTransportPolicy = 'relay';
    return o;
  }

  // ---------------- transport ----------------
  const tx = (c, m) => { if (!c || !c.open) return 0; try { c.send(m); } catch (e) { return 0; } const b = JSON.stringify(m).length; N.stats.tx += b; return b; };
  N.send = m => tx(N.host, m);
  N.bcast = m => { let b = 0; for (const c of N.conns) if (c.ok) b = tx(c.c, m); return b; };
  setInterval(() => {   // 1 s rates + pings + lost-link watchdog
    const S = N.stats, t = now(), dt = (t - S.t0) / 1000; if (dt <= 0) return;
    S.txRate = Math.round((S.tx - (S._tx || 0)) / dt); S.rxRate = Math.round((S.rx - (S._rx || 0)) / dt); S._tx = S.tx; S._rx = S.rx; S.t0 = t;
    if (!N.session) return;
    if (N.mode === 'host') for (const c of N.conns.slice()) { if (t - c.last > CFG.lostMs) dropClient(c, 'timeout'); }
    else if (N.mode === 'client' && t - N.lastRx > CFG.lostMs) hostLost('The host stopped responding.');
  }, 1000);
  setInterval(() => { if (!N.session) return; if (N.mode === 'host') N.bcast({ t: 'ping', ts: Date.now() }); }, CFG.pingMs);

  N.reset = () => {
    N.session = false; N.mode = null; N.names = null; N.conns.forEach(c => { try { c.c.close(); } catch (e) {} }); N.conns = [];
    try { if (N.host) N.host.close(); } catch (e) {} N.host = null; try { if (N.peer) N.peer.destroy(); } catch (e) {} N.peer = null; N.code = null;
    N.lobby.players = []; N.me.ready = false; N.status = ''; clearTimeout(N.joinT); N.mirror = null;
  };
  N.leave = (why) => { if (N.mode === 'client') N.send({ t: 'bye' }); if (N.mode === 'host') N.bcast({ t: 'bye', why: why || 'The host closed the room.' }); setTimeout(N.reset, 80); N.session = false; };

  // ---------------- host ----------------
  N.hostRoom = (cb) => {
    N.reset(); if (!N.available()) { N.err = 'Online play needs PeerJS + an internet connection.'; return cb && cb(false); }
    N.mode = 'host'; N.code = N.cleanCode(Q.get('room')) || N.genCode(); N.status = 'Opening room on the PeerJS server…'; N.err = '';
    const p = N.peer = new Peer(CFG.prefix + N.code, peerOpts());
    p.on('open', () => { if (N.peer !== p) return; N.session = true; N.status = 'Room open. Share the code!'; N.lobby.players = [{ slot: 0, id: 'host', name: N.me.name, char: N.me.char, ready: true, host: true }]; N.me.slot = 0; N.pushLobby(); cb && cb(true); });
    p.on('connection', c => hostIncoming(c));
    p.on('disconnected', () => { setTimeout(() => { try { if (N.peer === p && !p.destroyed && p.disconnected) p.reconnect(); } catch (e) {} }, 1500); });
    p.on('error', e => { if (N.peer !== p) return; const t = e && e.type; if (t === 'unavailable-id' && !N.session) { N.code = N.genCode(); try { p.destroy(); } catch (x) {} return N.hostRoom(cb); } if (!N.session) { N.err = 'Could not open a room (' + t + ').'; N.mode = null; cb && cb(false); } else console.warn('peer error', t); });
  };
  function hostIncoming(c) {
    c.on('open', () => {
      const md = c.metadata || {}, rej = why => { try { c.send({ t: 'reject', why }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 400); };
      if (md.v !== CFG.ver) return rej('Version mismatch — reload the latest game page.');
      if (N.inPlay) return rej('A game is already running in this room.');
      const used = new Set(N.lobby.players.map(p => p.slot)); let slot = -1; for (let k = 1; k < CFG.max; k++) if (!used.has(k)) { slot = k; break; }
      if (slot < 0) return rej('This room is full (5 players).');
      const want = N.charFree(md.char, null) ? md.char : N.cycleChar(md.char || 'lemon', 1, null);
      const R = { c, slot, id: c.peer, ok: true, last: now(), rtt: 0, inp: { mx: 0, my: 0, h: {}, p: {} } };
      N.conns.push(R); N.lobby.players.push({ slot, id: c.peer, name: String(md.name || 'Player').slice(0, 12), char: want, ready: false, phone: !!md.phone });
      c.on('data', d => { R.last = now(); N.stats.rx += JSON.stringify(d).length; try { hostMsg(R, d); } catch (e) { console.error(e); } });
      c.on('close', () => dropClient(R, 'closed')); c.on('error', () => dropClient(R, 'error'));
      tx(c, { t: 'welcome', slot, code: N.code, ver: CFG.ver }); N.pushLobby(); N.toast('P' + (slot + 1) + ' ' + (md.name || 'Player') + ' joined');
    });
  }
  function hostMsg(R, m) {
    const L = N.lobby.players.find(p => p.slot === R.slot);
    switch (m.t) {
      case 'in': { const I = R.inp; I.mx = m.mx || 0; I.my = m.my || 0; I.h = {}; (m.h || []).forEach(a => I.h[a] = true); (m.p || []).forEach(a => { if (a !== 'pause') I.p[a] = true; }); N.stats.ins++; break; }
      case 'pong': R.rtt = Date.now() - m.ts; N.stats.rtt[R.slot] = R.rtt; break;
      case 'pick': if (L && !N.inPlay && N.charFree(m.char, L)) { L.char = m.char; L.ready = false; } N.pushLobby(); break;
      case 'ready': if (L) L.ready = !!m.v; N.pushLobby(); break;
      case 'name': if (L) L.name = String(m.name || 'Player').slice(0, 12); N.pushLobby(); break;
      case 'bye': dropClient(R, 'left'); break;
    }
  }
  function dropClient(R, why) {
    const i = N.conns.indexOf(R); if (i < 0) return; N.conns.splice(i, 1); R.ok = false; try { R.c.close(); } catch (e) {}
    const L = N.lobby.players.find(p => p.slot === R.slot), nm = 'P' + (R.slot + 1) + ' ' + (L ? L.name : '');
    if (N.inPlay && N.gameSlot && N.gameSlot[R.slot] != null) {   // mid-game: a CPU bot takes over that fighter
      const g = N.game, k = N.gameSlot[R.slot]; if (g && g.inputs && g.inputs[k]) g.inputs[k] = CO.Input.forSlot(k, { bot: true, getSim: () => g.sim });
      if (L) L.bot = true; N.toast(nm + ' disconnected — CPU takes over'); N.bcast({ t: 'note', msg: nm + ' disconnected — CPU takes over' });
    } else { N.lobby.players = N.lobby.players.filter(p => p.slot !== R.slot); N.toast(nm + ' left'); }
    N.pushLobby(); N.lastDrop = { slot: R.slot, why };
  }
  N.lobbyMe = () => N.lobby.players.find(p => p.slot === N.me.slot) || {};
  N.pushLobby = () => { if (N.mode !== 'host') return; const L = N.lobby; N.bcast({ t: 'lobby', players: L.players, mode: L.mode, stage: L.stage, level: L.level, code: N.code }); N.lobbyRev = (N.lobbyRev || 0) + 1; };
  N.chars = () => Object.keys(CO.CHARACTERS);
  // each player on a different fighter while one is free (4 fighters, 5 seats: the 5th may double up)
  N.charFree = (ch, L) => { if (!CO.CHARACTERS[ch]) return false; const others = N.lobby.players.filter(p => p !== L).map(p => p.char); return !others.includes(ch) || N.chars().every(c => others.includes(c)); };
  N.cycleChar = (cur, d, L) => { const C = N.chars(); let i = C.indexOf(cur); for (let n = 0; n < C.length; n++) { i = (i + d + C.length) % C.length; if (N.charFree(C[i], L)) return C[i]; } return cur; };
  N.hostPick = ch => { const L = N.lobbyMe(); if (N.charFree(ch, L)) { L.char = ch; N.me.char = ch; } N.pushLobby(); };
  N.clientPick = ch => { N.me.char = ch; N.me.ready = false; N.send({ t: 'pick', char: ch }); };
  N.clientReady = v => { N.me.ready = v; N.send({ t: 'ready', v }); };
  N.allReady = () => N.lobby.players.length >= 1 && N.lobby.players.every(p => p.ready || p.host);
  // START: fighters in slot order; each client learns its game slot from the 'start' message
  N.start = (scene) => {
    if (!N.isHost()) return false; const L = N.lobby, P = L.players.slice().sort((a, b) => a.slot - b.slot);
    N.gameSlot = {}; P.forEach((p, k) => N.gameSlot[p.slot] = k); N.names = P.map(p => p.name); N.inPlay = true;
    for (const R of N.conns) { R.inp = { mx: 0, my: 0, h: {}, p: {} }; tx(R.c, { t: 'start', gslot: N.gameSlot[R.slot], names: N.names }); }
    CO.sel.chars = P.map(p => p.char); CO.curChars = CO.sel.chars.slice();
    const chars = CO.sel.chars.slice();
    if (L.mode === 'survival') { const lv = Phaser.Math.Clamp(L.level | 0, 1, 100); scene.scene.start('Game', { stage: CO.survArenaFor(lv), level: lv, chars }); }
    else if (L.stage === 's1') scene.scene.start('Intro', { chars, next: 'Game', data: { stage: 's1', chars } });
    else CO.startStage(scene, L.stage, { chars, pre: false });
    return true;
  };

  // ---------------- client ----------------
  N.join = (code, cb) => {
    N.reset(); code = N.cleanCode(code); if (code.length !== 6) { N.err = 'Room codes have 6 characters.'; return cb && cb(false); }
    if (!N.available()) { N.err = 'Online play needs PeerJS + an internet connection.'; return cb && cb(false); }
    N.mode = 'client'; N.code = code; N.status = 'Connecting to room ' + code + '…'; N.err = '';
    const p = N.peer = new Peer(peerOpts()); let done = false;
    const fail = why => { if (done) return; done = true; clearTimeout(N.joinT); N.err = why; N.mode = null; N.session = false; try { p.destroy(); } catch (e) {} cb && cb(false); };
    N.joinT = setTimeout(() => fail('Could not reach room ' + code + ' (timeout). A firewall / NAT may be blocking WebRTC — try ?relay=1.'), CFG.joinMs);
    p.on('open', () => {
      const c = p.connect(CFG.prefix + code, { reliable: true, serialization: 'json', metadata: { v: CFG.ver, name: N.me.name, char: N.me.char, phone: CO.isTouchDevice ? CO.isTouchDevice() : false } });
      c.on('open', () => { N.host = c; N.lastRx = now(); });
      c.on('data', d => { N.lastRx = now(); N.stats.rx += JSON.stringify(d).length; try { clientMsg(d, () => { if (!done) { done = true; clearTimeout(N.joinT); cb && cb(true); } }, fail); } catch (e) { console.error(e); } });
      c.on('close', () => { if (done && N.mode === 'client') hostLost('The host left the room.'); });
      c.on('error', () => fail('Connection error.'));
    });
    p.on('error', e => { const t = e && e.type; fail(t === 'peer-unavailable' ? 'Room ' + code + ' was not found. Check the code (the host must keep the lobby open).' : 'Connection failed (' + t + ').'); });
  };
  function clientMsg(m, ok, fail) {
    switch (m.t) {
      case 'welcome': N.session = true; N.me.slot = m.slot; N.status = 'Joined room ' + N.code; ok(); break;
      case 'reject': fail(m.why); break;
      case 'lobby': N.lobby = { players: m.players, mode: m.mode, stage: m.stage, level: m.level }; N.lobbyRev = (N.lobbyRev || 0) + 1; { const me = m.players.find(p => p.slot === N.me.slot); if (me) { N.me.char = me.char; N.me.ready = me.ready; } } break;
      case 'ping': N.send({ t: 'pong', ts: m.ts }); break;
      case 'start': N.mySlot = m.gslot; N.names = m.names; N.inPlay = true; break;
      case 'goto': clientGoto(m); break;
      case 'cut': { const s = N.gm().getScene(m.key); if (s && s.sys.isActive() && s.panelTo) s.panelTo(m.i); break; }
      case 'snap': N.stats.snaps++; N.stats.snapBytes += JSON.stringify(m).length; (N.snapQ = N.snapQ || []).push(m); break;
      case 'note': N.toast(m.msg); break;
      case 'bye': hostLost(m.why || 'The host left the room.'); break;
    }
  }
  N.gm = () => (window.__game || CO.game).scene;
  function stopAll() { const sm = N.gm(); sm.getScenes(true).forEach(s => { if (s.sys.settings.key !== 'Lobby' || true) sm.stop(s.sys.settings.key); }); }
  function clientGoto(m) {
    const sm = N.gm(); N.applying = true;
    try {
      if (m.key === 'Lobby') { N.inPlay = false; N.snapQ = []; stopAll(); sm.start('Lobby', { room: true }); }
      else if (m.launch) { ['Game', 'HUD', 'Ambient'].forEach(k => { if (sm.isActive(k)) sm.pause(k); }); sm.start(m.key, m.data); sm.bringToTop(m.key); }
      else { N.snapQ = []; stopAll(); sm.start(m.key, m.data); }
    } finally { N.applying = false; }
  }
  function hostLost(why) {
    if (N.mode !== 'client') return; N.reset(); N.inPlay = false; const sm = N.gm(); stopAll(); CO.audio && CO.audio.stop && CO.audio.stop();
    sm.start('Title', { page: 'main', quiet: true, netMsg: why || 'Disconnected from the host.' }); window.__netLost = why;
  }

  // ---------------- scene-flow hooks (generic: wrap Phaser's ScenePlugin) ----------------
  const SP = Phaser.Scenes.ScenePlugin.prototype, oStart = SP.start, oLaunch = SP.launch, oRestart = SP.restart;
  const clean = d => { try { return JSON.parse(JSON.stringify(d || {}, (k, v) => (v instanceof Set || v instanceof Map || typeof v === 'function') ? undefined : v)); } catch (e) { return {}; } };
  SP.start = function (key, data) {
    if (N.session && N.inPlay && !N.applying) {
      if (N.mode === 'host') {
        if (SYNC.has(key)) N.bcast({ t: 'goto', key, data: clean(data) });
        else if (OUT.has(key)) { N.inPlay = false; N.bcast({ t: 'goto', key: 'Lobby' }); key = 'Lobby'; data = { room: true }; N.lobby.players.forEach(p => { if (!p.host) p.ready = false; }); N.lobby.players = N.lobby.players.filter(p => !p.bot); N.pushLobby(); }
      } else if (N.mode === 'client') {
        if (SYNC.has(key)) return this;                         // the host decides what comes next
        if (OUT.has(key)) { N.leave(); data = Object.assign({ page: 'main', quiet: true }, key === 'Title' ? data : {}); key = 'Title'; }
      }
    }
    return oStart.call(this, key, data);
  };
  SP.launch = function (key, data) { if (N.isHost() && N.inPlay && key === 'GameOver' && !N.applying) N.bcast({ t: 'goto', key, data: clean(data), launch: true }); return oLaunch.call(this, key, data); };
  SP.restart = function (data) { const k = this.key; if (N.isHost() && N.inPlay && k === 'Game' && !N.applying) N.bcast({ t: 'goto', key: 'Game', data: clean(data) }); if (N.isClient() && N.inPlay && k === 'Game' && !N.applying) return this; return oRestart.call(this, data); };

  // ---------------- snapshot codec ----------------
  // defs (characters, moves, skills, enemies, bosses, stages, stories) are sent as paths; entities as ids; everything else by value
  let REG = null, PATH = null;
  function buildReg() {
    REG = new Map(); PATH = new Map(); const roots = ['CHARACTERS', 'ENEMIES', 'BOSSES', 'STAGES', 'STORIES', 'STORY', 'LIGHT', 'ITEMS', 'PICKUPS'];
    const walk = (o, p, d) => { if (!o || typeof o !== 'object' || REG.has(o) || d > 7) return; const pr = Object.getPrototypeOf(o); if (pr !== Object.prototype && pr !== Array.prototype) return; REG.set(o, p); PATH.set(p, o); for (const k of Object.keys(o)) walk(o[k], p + '.' + k, d + 1); };
    roots.forEach(r => walk(CO[r], r, 0));
  }
  const rnd = v => Number.isInteger(v) ? v : Math.round(v * 100) / 100;
  function enc(v, ents, d) {
    if (v === null || v === undefined) return null;
    const ty = typeof v; if (ty === 'number') return Number.isFinite(v) ? rnd(v) : 0; if (ty === 'string' || ty === 'boolean') return v; if (ty !== 'object') return undefined;
    if (ents.has(v)) return { $r: v.id }; if (REG.has(v)) return { $d: REG.get(v) };
    if (v instanceof Set || v instanceof Map || d > 4) return undefined;
    const pr = Object.getPrototypeOf(v);
    if (Array.isArray(v)) return v.map(x => { const e = enc(x, ents, d + 1); return e === undefined ? null : e; });
    if (pr !== Object.prototype && pr !== null) return undefined;
    const o = {}; for (const k in v) { const e = enc(v[k], ents, d + 1); if (e !== undefined) o[k] = e; } return o;
  }
  const same = (a, b) => a === b || (a && b && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
  const TOPSKIP = new Set(['events', 'frame', 'boss', 'rngState', ...ENT]);
  // host: called each frame after stepping; sends every CFG.snapEvery frames (20 Hz at 60 fps)
  N.hostTick = (g) => {
    if (!N.isHost() || !N.conns.length) { N.evBuf = []; return; }
    N.tk = (N.tk || 0) + 1; if (N.tk % CFG.snapEvery) return; if (!REG) buildReg();
    const sim = g.sim, key = (N.snapN = (N.snapN || 0) + 1) % CFG.keyEvery === 1 || !N.last, last = key ? (N.last = { ents: new Map(), top: {}, lists: {} }) : N.last;
    const ents = new Map(); for (const L of ENT) for (const e of sim[L]) ents.set(e, 1); if (sim.boss) ents.set(sim.boss, 1);
    const snap = { t: 'snap', f: sim.frame, k: key ? 1 : 0, e: {}, l: {}, b: sim.boss ? sim.boss.id : null, top: {} };
    const seen = new Set();
    for (const e of ents.keys()) {
      seen.add(e.id); const prev = last.ents.get(e.id) || null, cur = {}, out = {}; let any = false;
      for (const k in e) { const v = enc(e[k], ents, 1); if (v === undefined) continue; cur[k] = v; if (!prev || !same(prev[k], v)) { out[k] = v; any = true; } }
      if (prev) { const gone = Object.keys(prev).filter(k => !(k in cur)); if (gone.length) { out.$x = gone; any = true; } }
      if (any || !prev) snap.e[e.id] = out; last.ents.set(e.id, cur);
    }
    for (const id of last.ents.keys()) if (!seen.has(id)) last.ents.delete(id);
    for (const L of ENT) { const ids = sim[L].map(e => e.id), j = ids.join(); if (last.lists[L] !== j) { snap.l[L] = ids; last.lists[L] = j; } }
    for (const k in sim) { if (TOPSKIP.has(k)) continue; const v = enc(sim[k], ents, 1); if (v === undefined) continue; if (!same(last.top[k], v)) { snap.top[k] = v; last.top[k] = v; } }
    if (N.evBuf && N.evBuf.length) { snap.ev = N.evBuf.map(e => enc(e, ents, 1)); N.stats.evs += snap.ev.length; } N.evBuf = [];
    const b = N.bcast(snap); N.stats.snaps++; N.stats.snapBytes += b; N.stats.maxSnap = Math.max(N.stats.maxSnap, b);
  };
  N.capture = e => { if (!FLOW.has(e.t)) (N.evBuf = N.evBuf || []).push(e); };

  // client: apply queued snapshots to the mirror sim, interpolate, replay events
  N.clientApply = (g) => {
    const Qs = N.snapQ || []; N.snapQ = []; if (!REG) buildReg();
    const sim = g.sim, M = N.mirror && N.mirror.sim === sim ? N.mirror : (N.mirror = { sim, store: new Map(), grave: new Map(), lf: null, iv: 50, lastT: 0 });
    const t = now();
    for (const s of Qs) {
      if (s.k) { /* keyframe: full state, nothing special needed — every entity is complete */ }
      for (const id in s.e) if (!M.store.has(+id)) M.store.set(+id, { id: +id, _new: 1 });
      const get = id => M.store.get(id) || M.grave.get(id) || { id, x: 0, y: 0, z: 0, alive: false };
      const dec = v => { if (v === null || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(dec); if (v.$r !== undefined) return get(v.$r); if (v.$d !== undefined) return PATH.get(v.$d); const o = {}; for (const k in v) o[k] = dec(v[k]); return o; };
      for (const id in s.e) {
        const o = M.store.get(+id), d = s.e[id];
        for (const k in d) { if (k === '$x') { d.$x.forEach(x => delete o[x]); continue; } const v = dec(d[k]);
          if ((k === 'x' || k === 'y' || k === 'z') && typeof v === 'number') { if (o._new || o['_t' + k] === undefined || Math.abs(v - (o[k] || 0)) > 400) { o[k] = v; o['_f' + k] = v; } else o['_f' + k] = o[k]; o['_t' + k] = v; }
          else o[k] = v; }
        o._at = t; delete o._new;
      }
      for (const L in s.l) { sim[L] = s.l[L].map(id => get(id)); }
      for (const k in s.top) sim[k] = dec(s.top[k]);
      sim.boss = s.b != null ? get(s.b) : null;
      const live = new Set(); for (const L of ENT) for (const e of sim[L]) live.add(e.id); if (sim.boss) live.add(sim.boss.id);
      for (const [id, o] of M.store) if (!live.has(id)) { M.store.delete(id); M.grave.set(id, o); }
      if (M.grave.size > 400) M.grave = new Map([...M.grave].slice(-200));
      if (M.lastT) M.iv = Math.max(30, Math.min(120, M.iv * 0.8 + (t - M.lastT) * 0.2)); M.lastT = t;
      if (M.lf === null || Math.abs(s.f - M.lf) > 8) M.lf = s.f; M.hf = s.f;
      if (s.ev) for (const e of s.ev) { const ev = dec(e); if (!FLOW.has(ev.t)) { try { g.onEvent(ev); } catch (x) { console.warn('ev', ev.t, x); } } }
    }
    // interpolation between the last two snapshots of each entity
    for (const o of M.store.values()) { if (o._at === undefined) continue; const a = Math.min(1, (t - o._at) / M.iv); for (const k of ['x', 'y', 'z']) if (o['_t' + k] !== undefined) o[k] = o['_f' + k] + (o['_t' + k] - o['_f' + k]) * a; }
    if (M.lf !== null) { M.lf = Math.min(M.lf + 1, (M.hf || 0) + 4); sim.frame = Math.round(M.lf); }
  };

  // ---------------- Game hooks (called from game.js) ----------------
  class RemoteSource { constructor(R) { this.R = R; } poll(o) { const I = this.R.inp; o.mx += I.mx; o.my += I.my; for (const a in I.h) o.h[a] = true; for (const a in I.p) o.h[a] = true; I.p = {}; } }
  N.gameBuild = (g) => {
    N.game = g; N.evBuf = []; N.last = null; N.tk = 0;
    if (N.mode === 'host') {
      for (const R of N.conns) { const k = N.gameSlot && N.gameSlot[R.slot]; if (k != null && g.inputs[k]) g.inputs[k] = new CO.Input.PlayerInput([new RemoteSource(R)]); }
      for (const L of N.lobby.players) if (L.bot && N.gameSlot && N.gameSlot[L.slot] != null) { const k = N.gameSlot[L.slot]; g.inputs[k] = CO.Input.forSlot(k, { bot: true, getSim: () => g.sim }); }
      if (N.gameSlot) for (const k in g.inputs) if (+k > 0 && !Object.values(N.gameSlot).includes(+k)) g.inputs[k] = CO.Input.forSlot(+k, { bot: true, getSim: () => g.sim });
    } else if (N.mode === 'client') {
      g.netClient = true; const k = N.mySlot | 0; g.mySlot = k; N.mirror = null; N.snapQ = N.snapQ || [];
      g.myIn = CO.params.bot ? CO.Input.forSlot(k, { bot: true, getSim: () => g.sim }) : CO.Input.forSlot(0, {});
      g.lastSent = ''; g.lastSentT = 0;
    }
  };
  N.clientUpdate = (g, delta) => {
    const it = g.myIn.update(), h = Object.keys(it.h).filter(a => it.h[a]), p = Object.keys(it.p).filter(a => it.p[a] && a !== 'pause');
    const sig = Math.round(it.mx * 20) + ',' + Math.round(it.my * 20) + ',' + h.join(); const t = now();
    if (p.length || sig !== g.lastSent || t - g.lastSentT > 250) { N.send({ t: 'in', mx: rnd(it.mx), my: rnd(it.my), h, p }); g.lastSent = sig; g.lastSentT = t; N.stats.ins++; }
    if (it.p.pause) { g.scene.pause(); g.scene.launch('Pause', { net: true }); g.scene.bringToTop('Pause'); return; }
    N.clientApply(g); g.render(delta / 1000);
  };

  // in-game names / toasts
  N.tagName = k => N.names && N.names[k] ? N.names[k] : null;
  N.toast = msg => {
    N.toasts = (N.toasts || []).concat([{ msg, t: now() }]).slice(-4); console.log('[net] ' + msg);
    try { const sm = N.gm(), s = sm.getScenes(true).slice(-1)[0]; if (!s || !s.add) return; const tt = s.add.text(640, 40, msg, CO.style(22, '#ffd34d')).setOrigin(0.5).setDepth(9999).setScrollFactor(0); s.tweens.add({ targets: tt, alpha: 0, delay: 2600, duration: 500, onComplete: () => tt.destroy() }); } catch (e) {}
  };
})(window.CO);
// v5: tell the room when this tab closes so drops are handled at once instead of after the 12 s timeout
window.addEventListener('pagehide', () => { try { if (window.CO && CO.net && CO.net.session) CO.net.leave('closed'); } catch (e) {} });
