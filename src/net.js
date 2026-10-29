// Clock Out! v5 — ONLINE CO-OP (PeerJS / WebRTC, host-authoritative).
//  * the host runs sim.js; clients send inputs (coalesced, <=~30 msgs/s) and get a 30 Hz motion stream (unordered channel) plus a
//    15 Hz state delta (keyframe every 1 s) — v5.2, see the codec section
//  * clients keep a mirror Sim (never stepped) that render()/HUD read; remote actors are interpolated ~100 ms behind, the own fighter is predicted
//  * cosmetic sim events are forwarded; scene flow (Game / Cutscene / Intro / Result / GameOver) follows the host
//  * a dropped client becomes a CPU bot; if the host drops, clients get a message and go back to the title
//  Classic script (no modules) so file:// keeps working; online simply reports "unavailable" without PeerJS / network.
(function (CO) {
  const Q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
  const CFG = { prefix: 'clockout-v5-', alpha: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', ver: 'clockout-v5.3', hz: 30, keyEvery: 15, delay: 100, extra: 100, snapErr: 160, pingMs: 2000, lostMs: 12000, joinMs: 15000, max: 4 };
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
  const tx = (c, m, b) => { if (!c || !c.open) return 0; try { c.send(m); } catch (e) { return 0; } b = b || JSON.stringify(m).length; N.stats.tx += b; return b; };
  N.send = m => tx(N.host, m);
  N.bcast = m => { if (!N.conns.length) return 0; const b = JSON.stringify(m).length; for (const c of N.conns) if (c.ok) tx(c.c, m, b); return b; };   // v5.2: size measured once, not per peer
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
    try { if (N.host) N.host.close(); } catch (e) {} N.host = null; try { if (N.uc) N.uc.close(); } catch (e) {} N.uc = null; N.motQ = []; N.hostG = null; try { if (N.peer) N.peer.destroy(); } catch (e) {} N.peer = null; N.code = null;
    N.lobby.players = []; N.me.ready = false; N.status = ''; clearTimeout(N.joinT); N.mirror = null;
    N.inPlay = false; N.gameSlot = null; N.mySlot = 0; N.snapQ = []; N.evBuf = []; N.game = null; N.lobbyChars = null; N.gate = null; N.last = null; N.mlast = null;   // v5.3: no state leaks into solo play
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
      const md = c.metadata || {};
      if (md.u) { const R = N.conns.find(r => r.id === c.peer); if (R) { R.u = c; c.on('data', d => { R.last = now(); }); } else try { c.close(); } catch (e) {} return; }   // v5.2: the client's unordered snapshot channel
      const rej = why => { try { c.send({ t: 'reject', why }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 400); };
      if (md.v !== CFG.ver) return rej('Version mismatch — reload the latest game page.');
      if (N.inPlay) return rej('A game is already running in this room.');
      const used = new Set(N.lobby.players.map(p => p.slot)); let slot = -1; for (let k = 1; k < CFG.max; k++) if (!used.has(k)) { slot = k; break; }
      if (slot < 0) return rej('Sorry, this room is full: 4 players max. Ask the host for a new room.');
      const want = N.charFree(md.char, null) ? md.char : N.cycleChar(md.char || 'lemon', 1, null);
      const R = { c, slot, id: c.peer, ok: true, last: now(), rtt: 0, inp: { mx: 0, my: 0, h: {}, p: {} } };
      N.conns.push(R); N.lobby.players.push({ slot, id: c.peer, name: String(md.name || 'Player').slice(0, 12), char: want, ready: false, phone: !!md.phone });
      c.on('data', d => { R.last = now(); N.stats.rx += 40; try { hostMsg(R, d); } catch (e) { console.error(e); } });
      c.on('close', () => dropClient(R, 'closed')); c.on('error', () => dropClient(R, 'error'));
      tx(c, { t: 'welcome', slot, code: N.code, ver: CFG.ver }); N.pushLobby(); N.toast('P' + (slot + 1) + ' ' + (md.name || 'Player') + ' joined');
    });
  }
  function hostMsg(R, m) {
    const L = N.lobby.players.find(p => p.slot === R.slot);
    switch (m.t) {
      case 'in': { R.inT = now(); const I = R.inp; I.mx = m.mx || 0; I.my = m.my || 0; I.h = {}; (m.h || []).forEach(a => I.h[a] = true); (m.p || []).forEach(a => { if (a !== 'pause') I.p[a] = true; }); if (m.q != null) { R.q = m.q; R.qF = N.hostG && N.hostG.sim ? N.hostG.sim.frame : 0; } N.stats.ins++; break; }
      case 'gready': if (N.gate && N.gate.wait) N.gate.ready.add(R.slot); break;   // v5.3: this client finished loading the stage
      case 'pong': R.rtt = Date.now() - m.ts; N.stats.rtt[R.slot] = R.rtt; break;
      case 'pick': if (L && !N.inPlay && N.charFree(m.char, L)) { L.char = m.char; L.ready = false; } N.pushLobby(); break;
      case 'ready': if (L) L.ready = !!m.v; N.pushLobby(); break;
      case 'name': if (L) L.name = String(m.name || 'Player').slice(0, 12); N.pushLobby(); break;
      case 'bye': dropClient(R, 'left'); break;
      case 'cutok': { const s = N.gm().getScene(m.key); if (s && s.sys.isActive() && s.press && !s.auto && m.i === s.i && s.fresh && s.fresh.ok) s.press(); break; }   // v5.2: any player's confirm advances (AUTO OFF)
    }
  }
  function dropClient(R, why) {
    const i = N.conns.indexOf(R); if (i < 0) return; N.conns.splice(i, 1); R.ok = false; try { R.c.close(); } catch (e) {} try { if (R.u) R.u.close(); } catch (e) {}
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
  // each player on a different fighter (4 fighters, 4 seats max)
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
    const chars = P.map(p => p.char); N.lobbyChars = chars.slice(); CO.curChars = chars.slice();   // v5.3: host's own solo pick (CO.sel.chars) is left alone; the host (P1) leads the story
    for (const R of N.conns) { R.inp = { mx: 0, my: 0, h: {}, p: {} }; R.inT = now(); tx(R.c, { t: 'start', gslot: N.gameSlot[R.slot], names: N.names, chars }); }
    if (L.mode === 'survival') { const lv = Phaser.Math.Clamp(L.level | 0, 1, 100); scene.scene.start('Game', { stage: CO.survArenaFor(lv), level: lv, chars }); }
    else {   // v5.3: the host may pick any of the 7 stages; each starts with its story lead-in (intro / lobby / rooftop panels)
      const S = CO.STAGES[L.stage], data = { stage: L.stage, chars, clock: S.clock || 0 }, lead = { s1: null, s4: 'lobby', s6: 'roof' }[L.stage];
      if (L.stage === 's1') scene.scene.start('Intro', { chars, next: 'Game', data });
      else if (lead) scene.scene.start('Cutscene', { scene: lead, chars, next: 'Game', data });
      else scene.scene.start('Game', data);
    }
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
      c.on('data', d => { N.lastRx = now(); try { clientMsg(d, () => { if (!done) { done = true; clearTimeout(N.joinT); cb && cb(true); } }, fail); } catch (e) { console.error(e); } });
      c.on('close', () => { if (done && N.mode === 'client') hostLost('The host left the room.'); });
      c.on('error', () => fail('Connection error.'));
    });
    p.on('error', e => { const t = e && e.type; fail(t === 'peer-unavailable' ? 'Room ' + code + ' was not found. Check the code (the host must keep the lobby open).' : 'Connection failed (' + t + ').'); });
  };
  function clientMsg(m, ok, fail) {
    switch (m.t) {
      case 'welcome': N.session = true; N.me.slot = m.slot; N.status = 'Joined room ' + N.code; ok(); openU(); break;
      case 'reject': fail(m.why); break;
      case 'lobby': N.lobby = { players: m.players, mode: m.mode, stage: m.stage, level: m.level }; N.lobbyRev = (N.lobbyRev || 0) + 1; { const me = m.players.find(p => p.slot === N.me.slot); if (me) { N.me.char = me.char; N.me.ready = me.ready; } } break;
      case 'ping': N.send({ t: 'pong', ts: m.ts }); break;
      case 'start': N.mySlot = m.gslot; N.names = m.names; N.inPlay = true; if (m.chars) { N.lobbyChars = m.chars.slice(); CO.curChars = m.chars.slice(); } break;
      case 'cd': N.cdShow(m.ms); break;
      case 'goto': clientGoto(m); break;
      case 'cut': { const s = N.gm().getScene(m.key); if (s && s.sys.isActive() && s.panelTo) s.panelTo(m.i, m.auto); break; }
      case 'snap': { const b = JSON.stringify(m).length; N.stats.rx += b; N.stats.snaps++; N.stats.snapBytes += b; (N.snapQ = N.snapQ || []).push(m); break; }
      case 's': motIn(m); break;
      case 'cutfx': { const s = N.gm().getScene(m.key); if (s && s.sys.isActive() && s.netFx) s.netFx(m); break; }
      case 'note': N.toast(m.msg); break;
      case 'bye': hostLost(m.why || 'The host left the room.'); break;
    }
  }
  function motIn(m) { N.lastRx = now(); N.stats.rx += 30 + 12 * m.a.length; N.stats.mots = (N.stats.mots || 0) + 1; (N.motQ = N.motQ || []).push({ m, rt: now() }); if (N.motQ.length > 60) N.motQ.shift(); }
  // v5.2: second, UNORDERED data channel for the motion stream (PeerJS reliable:false -> ordered:false)
  function openU() {
    try { const u = N.peer.connect(CFG.prefix + N.code, { reliable: false, serialization: 'json', metadata: { u: 1, v: CFG.ver } }); N.uc = u; u.on('data', d => { if (d && d.t === 's') motIn(d); }); u.on('error', () => {}); } catch (e) {}
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
  // v5.2 netcode: two streams, both sent from a FIXED 30 Hz host timer (not tied to the host's frame rate)
  //  * 's'    motion  — every entity's x/y/z/face/pose/rot/flip, quantized + short arrays, only entities that changed
  //                     (all of them every 0.5 s); sent on an UNORDERED channel so one late packet never blocks the next
  //  * 'snap' state   — the generic delta of everything else (hp, mp, state, lists, HUD, ...) at 15 Hz, keyframe every 1 s,
  //                     plus the cosmetic events (every tick when there are any) — reliable + ordered
  // clients buffer motion samples and render remote actors ~100 ms in the past (interpolation, clamped extrapolation) and
  // PREDICT their own fighter with the same sim.updatePlayer code, reconciling smoothly against the host.
  // defs (characters, moves, skills, enemies, bosses, stages, stories) are sent as paths; entities as ids; everything else by value
  let REG = null, PATH = null, POSE = null, POSEL = null;
  function buildReg() {
    REG = new Map(); PATH = new Map(); const roots = ['CHARACTERS', 'ENEMIES', 'BOSSES', 'STAGES', 'STORIES', 'STORY', 'LIGHT', 'ITEMS', 'PICKUPS'];
    const strs = new Set();
    const walk = (o, p, d) => { if (!o || typeof o !== 'object' || REG.has(o) || d > 7) return; const pr = Object.getPrototypeOf(o); if (pr !== Object.prototype && pr !== Array.prototype) return; REG.set(o, p); PATH.set(p, o); for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string' && v.length < 40) strs.add(v); walk(v, p + '.' + k, d + 1); } };
    roots.forEach(r => walk(CO[r], r, 0));
    POSEL = Object.keys(window.FRAMES || {}).sort(); POSE = new Map(POSEL.map((s, i) => [s, i]));   // same sprite atlas on both ends -> same pose index table
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
  // v5.2: structural compare without JSON.stringify (was the main host-side encode cost)
  const same = (a, b) => {
    if (a === b) return true; if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a)) { if (!Array.isArray(b) || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false; return true; }
    const ka = Object.keys(a); if (ka.length !== Object.keys(b).length) return false; for (const k of ka) if (!same(a[k], b[k])) return false; return true;
  };
  const TOPSKIP = new Set(['events', 'frame', 'boss', 'rngState', ...ENT]);
  const MOT = new Set(['x', 'y', 'z', 'face', 'pose', 'rot', 'flip']);
  // host: called from Game.update after stepping — only notes that the sim is live; the timer below does the sending
  N.hostTick = (g) => {
    if (!N.isHost() || !N.conns.length) { N.evBuf = []; return; }
    const t = now(); N.hostG = g; N.liveT = t; if (g.sim.frame !== N.stepF) { N.stepF = g.sim.frame; N.stepT = t; }
  };
  setInterval(() => { try { N.hostSend(); } catch (e) { console.error(e); } }, 1000 / CFG.hz);
  N.hostSend = () => {
    const g = N.hostG; if (!N.isHost() || !N.conns.length || !g || !g.sim || !N.inPlay || now() - (N.liveT || 0) > 1500) return;
    if (!REG) buildReg(); const t0 = now(), sim = g.sim; N.tk = (N.tk || 0) + 1;
    const ents = new Map(); for (const L of ENT) for (const e of sim[L]) ents.set(e, 1); if (sim.boss) ents.set(sim.boss, 1);
    // --- motion stream ---
    if (sim.frame !== N.motF || N.tk % 10 === 0) {
      N.motF = sim.frame; const full = N.tk % 15 === 0 || !N.mlast, ML = full ? (N.mlast = new Map()) : N.mlast, arr = [];
      for (const e of ents.keys()) {
        const pi = e.pose == null ? 0 : e.pose;   // pose names travel as strings (atlas frames are generated lazily, so index tables can differ between peers)
        const a = [e.id, Math.round(e.x || 0), Math.round(e.y || 0), Math.round(e.z || 0), e.face == null ? 0 : rnd(e.face), pi, rnd(e.rot || 0), e.flip ? 1 : 0];
        while (a.length > 5 && !a[a.length - 1]) a.pop();
        const sig = a.join(); if (!full && ML.get(e.id) === sig) continue; ML.set(e.id, sig); arr.push(a);
      }
      const ts = Math.round(N.stepT || t0), body = JSON.stringify(arr).length + 40;
      for (const R of N.conns) if (R.ok) {
        const m = { t: 's', f: sim.frame, ts, a: arr }; if (R.q != null) m.k = [R.q, sim.frame - R.qF];
        const c = R.u && R.u.open ? R.u : R.c; if (c && c.open) { try { c.send(m); N.stats.tx += body; } catch (e) {} }
      }
      N.stats.mots = (N.stats.mots || 0) + 1; N.stats.motBytes = (N.stats.motBytes || 0) + body;
    }
    // --- state stream (15 Hz) + events (every tick) ---
    const lch = !!N.last && ENT.some(L => N.last.lists[L] !== sim[L].map(e => e.id).join());   // a spawn/despawn must carry the new entity's full state
    const gen = N.tk % 2 === 0 || lch, ev = N.evBuf && N.evBuf.length;
    if (gen || ev) {
      const snap = { t: 'snap', f: sim.frame, k: 0, e: {}, l: {}, b: sim.boss ? sim.boss.id : null, top: {} };
      if (gen) {
        const key = (N.snapN = (N.snapN || 0) + 1) % CFG.keyEvery === 1 || !N.last, last = key ? (N.last = { ents: new Map(), top: {}, lists: {} }) : N.last;
        snap.k = key ? 1 : 0; const seen = new Set();
        for (const e of ents.keys()) {
          seen.add(e.id); const prev = last.ents.get(e.id) || null, cur = {}, out = {}; let any = false;
          for (const k in e) {
            if (prev && MOT.has(k) && k in prev) { cur[k] = prev[k]; continue; }   // positions/poses travel in the motion stream
            const v = enc(e[k], ents, 1); if (v === undefined) continue; cur[k] = v; if (!prev || !same(prev[k], v)) { out[k] = v; any = true; } }
          if (prev) { const gone = Object.keys(prev).filter(k => !(k in cur)); if (gone.length) { out.$x = gone; any = true; } }
          if (any || !prev) snap.e[e.id] = out; last.ents.set(e.id, cur);
        }
        for (const id of last.ents.keys()) if (!seen.has(id)) last.ents.delete(id);
        for (const L of ENT) { const ids = sim[L].map(e => e.id), j = ids.join(); if (last.lists[L] !== j) { snap.l[L] = ids; last.lists[L] = j; } }
        for (const k in sim) { if (TOPSKIP.has(k)) continue; const v = enc(sim[k], ents, 1); if (v === undefined) continue; if (!same(last.top[k], v)) { snap.top[k] = v; last.top[k] = v; } }
      } else { for (const L of ENT) { const ids = sim[L].map(e => e.id); if (N.last && N.last.lists[L] !== ids.join()) { snap.l[L] = ids; N.last.lists[L] = ids.join(); } } }
      if (ev) { snap.ev = N.evBuf.map(e => enc(e, ents, 1)); N.stats.evs += snap.ev.length; } N.evBuf = [];
      const b = N.bcast(snap); N.stats.snaps++; N.stats.snapBytes += b; N.stats.maxSnap = Math.max(N.stats.maxSnap, b);
    }
    N.stats.encMs = (N.stats.encMs || 0) * 0.9 + (now() - t0) * 0.1;
  };
  N.capture = e => { if (!FLOW.has(e.t)) (N.evBuf = N.evBuf || []).push(e); };

  // ---------------- client ----------------
  const PRED = new Set(['x', 'y', 'z', 'vx', 'vy', 'vz', 'state', 'st', 'face', 'wantFace', 'pose', 'rot', 'flip', 'move', 'moveId', 'mt', 'prevMt', 'hitMap', 'charge',
    'airJumps', 'djT', 'airChain', 'airDashed', 'runT', 'runDist', 'turnT', 'stopT', 'buf', 'held', 'dived', 'landed', 'stillT']);
  const ADOPT = new Set(['hurt', 'down', 'ko', 'skill', 'ult']);          // host-driven states: the client stops predicting and follows
  const LOCALEV = new Set(['sfx', 'swing', 'djump', 'dash', 'land', 'charged', 'skill']);   // own-fighter cosmetics played at once on the pressing client
  const myId = (g) => { const p = g.sim.players[g.mySlot | 0]; return p ? p.id : -1; };
  N.clientApply = (g) => {
    const Qs = N.snapQ || []; N.snapQ = []; const Ms = N.motQ || []; N.motQ = []; if (!REG) buildReg();
    const sim = g.sim, M = N.mirror && N.mirror.sim === sim ? N.mirror : (N.mirror = { sim, store: new Map(), grave: new Map(), hs: new Map(), lf: null, hostMe: {}, offs: [], off: null, lev: [], levT: 0 });
    const t = now(), me = myId(g), predicting = M.pp && !M.adopt;
    const get = id => M.store.get(id) || M.grave.get(id) || { id, x: 0, y: 0, z: 0, alive: false };
    const dec = v => { if (v === null || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(dec); if (v.$r !== undefined) return get(v.$r); if (v.$d !== undefined) return PATH.get(v.$d); const o = {}; for (const k in v) o[k] = dec(v[k]); return o; };
    for (const s of Qs) { try {   // v5.3: one bad snapshot must not abort the rest (the next keyframe heals the mirror)
      for (const id in s.e) if (!M.store.has(+id)) M.store.set(+id, M.grave.get(+id) || { id: +id });
      for (const id in s.e) {
        const o = M.store.get(+id), d = s.e[id], mine = +id === me, H = M.hs.get(+id);
        for (const k in d) {
          if (k === '$x') { d.$x.forEach(x => { if (!MOT.has(x)) delete o[x]; }); continue; }
          const v = dec(d[k]);
          if (mine && PRED.has(k)) { M.hostMe[k] = v; if (o[k] === undefined) o[k] = v; continue; }   // own fighter: predicted locally
          if (MOT.has(k) && H && H.length) continue;                                                    // interpolated from the motion stream
          o[k] = v;
        }
      }
      for (const L in s.l) { sim[L] = s.l[L].map(id => get(id)); }
      for (const k in s.top) sim[k] = dec(s.top[k]);
      sim.boss = s.b != null ? get(s.b) : null;
      if (Object.keys(s.l).length) {
        const live = new Set(); for (const L of ENT) for (const e of sim[L]) live.add(e.id); if (sim.boss) live.add(sim.boss.id);
        for (const [id, o] of M.store) if (!live.has(id)) { M.store.delete(id); M.grave.set(id, o); M.hs.delete(id); }
        if (M.grave.size > 400) M.grave = new Map([...M.grave].slice(-200));
      }
      if (M.lf === null || Math.abs(s.f - M.lf) > 8) M.lf = s.f; M.hf = Math.max(M.hf || 0, s.f);
      if (s.ev) for (const e of s.ev) {
        const ev = dec(e); if (FLOW.has(ev.t)) continue;
        if (predicting && ev.p === me && LOCALEV.has(ev.t) && t - M.levT < 1500) continue;   // already played locally
        try { g.onEvent(ev); } catch (x) { console.warn('ev', ev.t, x); }
      }
    } catch (x) { window.__snapErr = (window.__snapErr || 0) + 1; if (window.__snapErr < 4) console.warn('snapshot skipped', x && x.stack); } }
    // motion samples -> per-entity history (host clock), offset = lowest observed (arrival - host time)
    for (const { m, rt } of Ms) {
      M.offs.push(rt - m.ts); if (M.offs.length > 90) M.offs.shift(); M.off = Math.min(...M.offs);
      const seen = new Set();
      for (const a of m.a) {
        const id = a[0]; seen.add(id); let H = M.hs.get(id); if (!H) { H = []; M.hs.set(id, H); }
        const pz = a[5], smp = { t: m.ts, x: a[1], y: a[2], z: a[3], face: a[4] || 0, pose: typeof pz === 'number' ? (pz > 0 ? POSEL[pz - 1] : undefined) : pz, rot: a[6] || 0, flip: !!a[7] };
        let i = H.length; while (i > 0 && H[i - 1].t > smp.t) i--; if (i > 0 && H[i - 1].t === smp.t) H[i - 1] = smp; else H.splice(i, 0, smp);
        if (H.length > 40) H.shift();
        if (id === me && m.k) M.recon = { s: m.k[0] + m.k[1], x: smp.x, y: smp.y, z: smp.z, ts: m.ts };
      }
      for (const [id, H] of M.hs) if (!seen.has(id) && H.length && H[H.length - 1].t < m.ts) { const l = H[H.length - 1]; H.push(Object.assign({}, l, { t: m.ts })); if (H.length > 40) H.shift(); }
      M.hf = Math.max(M.hf || 0, m.f); if (M.lf === null) M.lf = m.f;
    }
    // render remote actors CFG.delay ms in the past: interpolate between the bracketing samples, extrapolate at most CFG.extra ms
    if (M.off !== null) {
      const rt = t - M.off - CFG.delay;
      for (const [id, H] of M.hs) {
        if (id === me && M.pp && !M.adopt) continue; const o = M.store.get(id); if (!o || !H.length) continue;
        let i = H.length - 1; while (i > 0 && H[i].t > rt) i--;
        const a = H[i], b = H[i + 1]; let x = a.x, y = a.y, z = a.z;
        if (rt <= a.t) { /* older than the buffer: hold the first sample */ }
        else if (b) { const u = Math.min(1, (rt - a.t) / Math.max(1, b.t - a.t)); if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) < 500) { x += (b.x - a.x) * u; y += (b.y - a.y) * u; z += (b.z - a.z) * u; } }
        else if (i > 0) { const p = H[i - 1], dt = a.t - p.t, e = Math.min(rt - a.t, CFG.extra); if (dt > 0 && dt < 250 && Math.abs(a.x - p.x) < 300) { x += (a.x - p.x) / dt * e; y += (a.y - p.y) / dt * e; z = Math.max(0, z + (a.z - p.z) / dt * e); } }
        o.x = x; o.y = y; o.z = z; if (a.face) o.face = a.face; if (a.pose !== undefined) o.pose = a.pose; o.rot = a.rot; o.flip = a.flip;
        while (H.length > 3 && H[1].t < rt - 500) H.shift();
      }
    }
    if (M.lf !== null) { M.lf = Math.min(M.lf + 1, (M.hf || 0) + 4); sim.frame = Math.round(M.lf); }
  };

  // client-side prediction of the own fighter: the SAME sim.updatePlayer code, run in a sandbox (no hits, no spawns, no
  // events leaking into the mirror), on a private copy of the fighter; hits / damage stay host-authoritative
  function sandbox(M, sim) {
    const P = Object.create(sim);
    P.ev = e => { if (LOCALEV.has(e.t)) M.lev.push(e); return e; };
    P.doHits = () => {}; P.damage = () => {}; P.hitstop = 0;
    P.startSkill = (p, i) => { const sk = p.char.skills[i]; p.state = 'hold'; p.holdT = now(); p.st = 0; p.vx = p.vy = 0; p.pose = sk.pose; p.rot = 0; if (p.wantFace) p.face = p.wantFace; M.lev.push({ t: 'skill', p: p.id, id: sk.id, name: sk.name, x: p.x, y: p.y }); return true; };
    P.startUlt = p => { p.state = 'hold'; p.holdT = now(); p.st = 0; p.vx = p.vy = 0; return true; };
    return P;
  }
  function predict(g, it, delta) {
    const M = N.mirror, sim = g.sim; if (!M || CO.params.nopredict) return;
    const me = sim.players[g.mySlot | 0]; if (!me || me.x === undefined || !me.char || !me.char.stats) return;
    const H = M.hostMe, hs = H.state !== undefined ? H.state : me.state;
    if (!me.alive || me.auto || ADOPT.has(hs) || sim.state === 'clear' || sim.state === 'won') {   // follow the host
      M.adopt = true; M.pp = null; for (const k in H) if (!MOT.has(k)) me[k] = H[k]; M.pendP = {}; return;
    }
    const t = now();
    if (!M.pp) {
      const pp = M.pp = Object.assign({}, me); for (const k in H) if (!MOT.has(k)) pp[k] = H[k];
      pp.buf = Object.assign({}, H.buf || me.buf || {}); pp.hitMap = new Map(); M.hist = new Map(); M.cs = M.cs || 0; M.pacc = 0; M.pend = { x: 0, y: 0, z: 0 }; M.adopt = false; M.P = null; M.pendP = {};
    }
    const pp = M.pp; if (!M.P || M.P.__sim !== sim) { M.P = sandbox(M, sim); M.P.__sim = sim; }
    for (const k in me) if (!PRED.has(k) && k[0] !== '_') pp[k] = me[k];
    if (pp.state === 'hold' && t - pp.holdT > (N.stats.rtt[N.me.slot] || 150) + 250) { pp.state = 'idle'; pp.st = 0; }
    for (const a in it.p) if (it.p[a]) M.pendP[a] = true;
    M.pacc += Math.min(delta, 100); const STEP = 1000 / 60, P = M.P;
    while (M.pacc >= STEP) {
      M.pacc -= STEP; P.projs = []; P.zones = []; P.allies = []; P.lures = []; P.hazards = []; P.pickups = []; P.events = [];
      P.updatePlayer(pp, { mx: it.mx, my: it.my, h: it.h, p: M.pendP }); M.pendP = {};
      M.cs++; M.hist.set(M.cs, { x: pp.x, y: pp.y, z: pp.z }); M.hist.delete(M.cs - 240);
    }
    // reconcile against the host's position for the matching input step: small errors are blended in, large ones snap
    if (M.recon) { const R = M.recon, h = M.hist.get(R.s); M.recon = null;
      if (h) { const ex = R.x - h.x, ey = R.y - h.y, ez = R.z - h.z; if (Math.abs(ex) + Math.abs(ey) + Math.abs(ez) > CFG.snapErr) shift(M, pp, ex, ey, ez), M.pend = { x: 0, y: 0, z: 0 }; else M.pend = { x: ex, y: ey, z: ez }; N.stats.predErr = Math.hypot(ex, ey, ez); } }
    { const f = 1 - Math.pow(0.85, delta / 16.67), P2 = M.pend; if (Math.abs(P2.x) + Math.abs(P2.y) + Math.abs(P2.z) > 0.3) { const dx = P2.x * f, dy = P2.y * f, dz = P2.z * f; shift(M, pp, dx, dy, dz); P2.x -= dx; P2.y -= dy; P2.z -= dz; } }
    for (const e of M.lev) { try { g.onEvent(Object.assign({}, e, { x: e.x === undefined ? pp.x : e.x })); } catch (x) {} M.levT = t; } M.lev = [];
    for (const k of PRED) if (k in pp) me[k] = pp[k];
  }
  function shift(M, pp, dx, dy, dz) { pp.x += dx; pp.y += dy; pp.z = Math.max(0, pp.z + dz); for (const h of M.hist.values()) { h.x += dx; h.y += dy; h.z += dz; } }

  // ---------------- Game hooks (called from game.js) ----------------
  class RemoteSource { constructor(R) { this.R = R; } poll(o) { const I = this.R.inp; if (now() - (this.R.inT || 0) > 600) { I.mx = I.my = 0; I.h = {}; } /* v5.3: no input for 0.6 s -> release held keys */ o.mx += I.mx; o.my += I.my; for (const a in I.h) o.h[a] = true; for (const a in I.p) o.h[a] = true; I.p = {}; } }
  N.gameBuild = (g) => {
    N.game = g; N.evBuf = []; N.last = null; N.mlast = null; N.tk = 0; N.hostG = null;
    if (N.mode === 'host') {
      N.gate = { wait: true, ready: new Set(), t0: now(), g, end: 0 };
      for (const R of N.conns) { const k = N.gameSlot && N.gameSlot[R.slot]; if (k != null && g.inputs[k]) g.inputs[k] = new CO.Input.PlayerInput([new RemoteSource(R)]); }
      for (const L of N.lobby.players) if (L.bot && N.gameSlot && N.gameSlot[L.slot] != null) { const k = N.gameSlot[L.slot]; g.inputs[k] = CO.Input.forSlot(k, { bot: true, getSim: () => g.sim }); }
      if (N.gameSlot) for (const k in g.inputs) if (+k > 0 && !Object.values(N.gameSlot).includes(+k)) g.inputs[k] = CO.Input.forSlot(+k, { bot: true, getSim: () => g.sim });
    } else if (N.mode === 'client') {
      g.netClient = true; const k = N.mySlot | 0; g.mySlot = k; N.mirror = null; N.snapQ = N.snapQ || []; N.motQ = [];
      g.myIn = CO.params.bot ? CO.Input.forSlot(k, { bot: true, getSim: () => g.sim }) : CO.Input.forSlot(0, {});
      g.lastSent = ''; g.lastSentT = 0; g.inP = {};
      N.send({ t: 'gready' }); g.time.delayedCall(1000, () => { if (!N.cdOn) N.send({ t: 'gready' }); });   // v5.3: loaded -> tell the host (resent once)
    }
  };
  // v5.3 READY / SET / GO: the host holds the sim until every client has loaded the stage (or 6 s), then everyone counts down
  // from the host's clock (the 'cd' message carries the time left, so late receivers shorten their count to match)
  const CD = 2400;
  N.gateOpen = g => {
    const G = N.gate; if (!G || G.g !== g || !N.isHost() || !N.inPlay) return true;
    const t = now();
    if (G.wait) {
      const need = N.conns.filter(R => R.ok && N.gameSlot && N.gameSlot[R.slot] != null).map(R => R.slot);
      if (need.every(k => G.ready.has(k)) || t - G.t0 > 6000) { G.wait = false; G.end = t + CD; N.bcast({ t: 'cd', ms: CD }); N.cdShow(CD); N.stats.gateMs = Math.round(t - G.t0); }
      return false;
    }
    if (t < G.end) return false;
    N.gate = null; return true;
  };
  N.cdShow = ms => {
    const g = N.game; if (!g || !g.add || !g.sys || !g.sys.isActive()) { N.cdOn = false; return; } N.cdOn = true; window.__cd = (window.__cd || 0) + 1;
    if (N.cdTxt) try { N.cdTxt.destroy(); } catch (e) {}
    const tx0 = N.cdTxt = g.add.text(640, 300, '', CO.style(96, '#ffd34d', { strokeThickness: 10 })).setOrigin(0.5).setScrollFactor(0).setDepth(99999);
    const steps = [['READY…', '#ffd34d', 'tick'], ['SET…', '#ffb347', 'tick'], ['GO!', '#7dff8a', 'ready']], seg = CD / 3, t0 = now() - (CD - ms);
    const show = () => {
      if (!tx0.scene) return; const e = now() - t0, k = Math.min(2, Math.floor(e / seg));
      if (tx0._k !== k) { tx0._k = k; tx0.setText(steps[k][0]).setColor(steps[k][1]).setScale(1.5).setAlpha(1); g.tweens.add({ targets: tx0, scale: 1, duration: 220, ease: 'Back.out' }); CO.audio.sfx(steps[k][2]); }
      if (e < CD) g.time.delayedCall(50, show); else { g.tweens.add({ targets: tx0, alpha: 0, scale: 1.4, duration: 400, onComplete: () => { try { tx0.destroy(); } catch (x) {} } }); N.cdOn = false; }
    };
    show();
  };
  // v5.3: hidden host tab — Phaser's rAF loop stops, so a worker timer (not throttled like page timers) keeps the room's sim running
  (() => {
    let last = now();
    const tick = () => { const t = now(), dt = t - last; last = t; try { const g = N.hostG || N.game; if (document.hidden && N.isHost() && N.inPlay && g && g.sim && g.hiddenStep && g.sys && g.sys.isActive()) g.hiddenStep(dt); } catch (e) { console.error(e); } };
    try { const w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},33)'], { type: 'text/javascript' }))); w.onmessage = tick; }
    catch (e) { setInterval(tick, 33); }
  })();
  // v5.3: client tab hidden / blurred -> send a neutral input at once (the host also times out after 0.6 s)
  const idle = () => { if (N.isClient() && N.inPlay) N.send({ t: 'in', mx: 0, my: 0, h: [], p: [] }); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) idle(); });
  window.addEventListener('blur', idle);
  N.clientUpdate = (g, delta) => {
    let it = g.myIn.update();
    if (it.p.pause && !g.scene.isActive('Pause')) { g.scene.launch('Pause', { net: true }); g.scene.bringToTop('Pause'); }   // v5.3: overlay — the client view keeps running
    if (g.scene.isActive('Pause')) it = { mx: 0, my: 0, h: {}, p: {} };
    N.clientApply(g); predict(g, it, delta);
    // input: coalesced, at most ~30 msgs/s (presses go out within one frame), latest state only — no backlog
    for (const a in it.p) if (it.p[a] && a !== 'pause') g.inP[a] = true;
    const h = Object.keys(it.h).filter(a => it.h[a]), p = Object.keys(g.inP), t = now();
    const sig = Math.round(it.mx * 20) + ',' + Math.round(it.my * 20) + ',' + h.join(), gap = t - g.lastSentT;
    if ((p.length && gap >= 15) || (sig !== g.lastSent && gap >= 30) || gap > 250) {
      N.send({ t: 'in', mx: rnd(it.mx), my: rnd(it.my), h, p, q: N.mirror ? N.mirror.cs || 0 : 0 }); g.lastSent = sig; g.lastSentT = t; g.inP = {}; N.stats.ins++;
    }
    g._dt = delta; try { g.render(delta / 1000); } catch (e) { window.__renderErr = (window.__renderErr || 0) + 1; if (window.__renderErr < 4) console.warn('render skipped', e); }   // v5.3: one bad frame never freezes a client
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
