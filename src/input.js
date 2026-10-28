// Clock Out! — input abstraction. Every player is fed by one or more "sources"
// (keyboard, gamepad N, touch, bot, or later: network). The sim only ever sees
// plain serializable intents: { mx, my, h:{held}, p:{pressed this frame} }.
(function (CO) {
  const ACTS = ['light', 'heavy', 'jump', 'dash', 's1', 's2', 's3', 'ult', 'pause', 'confirm', 'back', 'up', 'down', 'left', 'right'];

  // ---------------------------------------------------------------------------------------------
  // v3: rebindable controls. CO.binds holds per-player keyboard maps (P1 + P2 share one keyboard,
  // each action has up to 2 keys) and one gamepad map shared by pads 1-5. Saved in localStorage
  // ('clockout.binds') and read live by the input sources below, so a rebind applies immediately.
  // ---------------------------------------------------------------------------------------------
  const KB_ACTIONS = [   // [id, label]  (order = Controls screen order)
    ['up', 'Move Up'], ['down', 'Move Down'], ['left', 'Move Left'], ['right', 'Move Right'],
    ['light', 'Attack (combo)'], ['heavy', 'Heavy (smash)'], ['jump', 'Jump'], ['dash', 'Dash'],
    ['s1', 'Skill 1'], ['s2', 'Skill 2'], ['s3', 'Skill 3'], ['ult', 'Ultimate'], ['pause', 'Pause'],
  ];
  const PAD_ACTIONS = ['light', 'heavy', 'jump', 'dash', 's1', 's2', 's3', 'ult', 'pause'];
  const KB_DEF = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], light: ['KeyJ', 'KeyZ'], heavy: ['KeyK', 'KeyX'], jump: ['Space', 'KeyC'], dash: ['KeyL', 'ShiftLeft'],
      s1: ['KeyU', 'Digit1'], s2: ['KeyI', 'Digit2'], s3: ['KeyO', 'Digit3'], ult: ['Semicolon', 'Digit4'], pause: ['Escape', 'KeyP'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], light: ['Comma'], heavy: ['Period'], jump: ['Slash'], dash: ['ShiftRight'],
      s1: ['Digit7'], s2: ['Digit8'], s3: ['Digit9'], ult: ['Digit0'], pause: [] },
  ];
  const PAD_DEF = { light: [2], heavy: [3], jump: [0], dash: [1, 7], s1: [4], s2: [5], s3: [6], ult: [11], pause: [9] };
  const SOLO_MOVE = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };   // P1 also gets the arrows when playing alone
  const two = a => [a[0] === undefined ? null : a[0], a[1] === undefined ? null : a[1]];
  const clone = o => JSON.parse(JSON.stringify(o));
  const B = {
    ACTIONS: KB_ACTIONS, PAD_ACTIONS, KB_DEF, PAD_DEF, kb: [{}, {}], pad: {}, version: 1,
    defaults() { const kb = KB_DEF.map(m => { const o = {}; KB_ACTIONS.forEach(([a]) => o[a] = two(m[a] || [])); return o; }); const pad = {}; PAD_ACTIONS.forEach(a => pad[a] = two(PAD_DEF[a])); return { kb, pad }; },
    load() {
      const d = this.defaults(); this.kb = d.kb; this.pad = d.pad;
      try {
        const j = JSON.parse(localStorage.getItem('clockout.binds') || 'null');
        if (j && j.v === 1) {
          [0, 1].forEach(s => KB_ACTIONS.forEach(([a]) => { const v = j.kb && j.kb[s] && j.kb[s][a]; if (Array.isArray(v)) this.kb[s][a] = [typeof v[0] === 'string' ? v[0] : null, typeof v[1] === 'string' ? v[1] : null]; }));
          PAD_ACTIONS.forEach(a => { const v = j.pad && j.pad[a]; if (Array.isArray(v)) this.pad[a] = [Number.isInteger(v[0]) ? v[0] : null, Number.isInteger(v[1]) ? v[1] : null]; });
        }
      } catch (e) { /* corrupt save: keep defaults */ }
    },
    save() { try { localStorage.setItem('clockout.binds', JSON.stringify({ v: 1, kb: this.kb, pad: this.pad })); } catch (e) {} },
    reset(what) { const d = this.defaults(); if (!what || what === 'kb') this.kb = d.kb; if (!what || what === 'pad') this.pad = d.pad; this.save(); },
    keys(slot, act) { return (this.kb[slot] && this.kb[slot][act] || []).filter(Boolean); },
    isDefault() { return JSON.stringify([this.kb, this.pad]) === JSON.stringify([this.defaults().kb, this.defaults().pad]); },
    label(act) { const f = KB_ACTIONS.find(x => x[0] === act); return f ? f[1] : act; },
    // Bind `code` to (slot, act, idx). Keys can't be used twice on the shared keyboard: the clash is resolved by SWAP
    // (the other cell receives this cell's old key) and reported in msg. Returns { ok, msg, swapped }.
    setKey(slot, act, idx, code) {
      if (code === 'Escape') return { ok: false, msg: 'Esc is reserved (cancel).' };
      const cur = this.kb[slot][act][idx]; if (cur === code) return { ok: true, msg: '' };
      let hit = null;
      for (const s of [0, 1]) for (const [a] of KB_ACTIONS) this.kb[s][a].forEach((c, i) => { if (c === code && !(s === slot && a === act && i === idx)) hit = { s, a, i }; });
      let msg = '', swapped = null;
      if (hit) {
        const need = KB_DEF[hit.s][hit.a].length > 0;
        if (cur === null && need && this.keys(hit.s, hit.a).length <= 1) {   // would leave the other action with no key: refuse
          return { ok: false, msg: this.label(hit.a) + ' (P' + (hit.s + 1) + ') needs that key. Free another key first.' };
        }
        this.kb[hit.s][hit.a][hit.i] = cur; swapped = hit;
        msg = 'Swapped with ' + this.label(hit.a) + ' (P' + (hit.s + 1) + ').';
      }
      this.kb[slot][act][idx] = code; this.save(); return { ok: true, msg, swapped };
    },
    clearKey(slot, act, idx) {
      if (KB_DEF[slot][act].length > 0 && this.keys(slot, act).length <= 1 && this.kb[slot][act][idx]) return { ok: false, msg: 'Each action needs at least one key.' };
      this.kb[slot][act][idx] = null; this.save(); return { ok: true, msg: 'Cleared.' };
    },
    setPad(act, idx, btn) {
      const cur = this.pad[act][idx]; if (cur === btn) return { ok: true, msg: '' };
      let hit = null; PAD_ACTIONS.forEach(a => this.pad[a].forEach((b, i) => { if (b === btn && !(a === act && i === idx)) hit = { a, i }; }));
      let msg = ''; if (hit) { this.pad[hit.a][hit.i] = cur; msg = 'Swapped with ' + this.label(hit.a) + '.'; }
      this.pad[act][idx] = btn; this.save(); return { ok: true, msg };
    },
    clearPad(act, idx) { if (this.pad[act].filter(v => v !== null).length <= 1 && act !== 'pause') return { ok: false, msg: 'Each action needs at least one button.' }; this.pad[act][idx] = null; this.save(); return { ok: true, msg: 'Cleared.' }; },
  };
  B.load();
  CO.binds = B;
  CO.activePlayers = 1;
  const CODE_NAMES = { Space: 'Space', Enter: 'Enter', NumpadEnter: 'Num Enter', Escape: 'Esc', Backspace: 'Bksp', Tab: 'Tab', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', CapsLock: 'Caps', Delete: 'Del', Insert: 'Ins', PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End', NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*', NumpadDivide: 'Num/', NumpadDecimal: 'Num.' };
  CO.keyName = c => { if (!c) return '—'; if (CODE_NAMES[c]) return CODE_NAMES[c]; let m; if ((m = /^Key([A-Z])$/.exec(c))) return m[1]; if ((m = /^Digit(\d)$/.exec(c))) return m[1]; if ((m = /^Numpad(\d)$/.exec(c))) return 'Num' + m[1]; return c; };
  const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'];
  CO.padName = b => (b === null || b === undefined) ? '—' : (PAD_NAMES[b] || 'Btn ' + b);
  CO.keyLabel = (slot, act) => { const k = B.keys(slot, act); return k.length ? k.map(CO.keyName).join(' / ') : '—'; };
  CO.padLabel = act => { const k = B.pad[act].filter(v => v !== null); return k.length ? k.map(CO.padName).join(' / ') : '—'; };

  // one shared key tracker; every KeyboardSource reads it
  class KeyTracker {
    constructor() {
      this.down = new Set(); this.seq = {}; this.last = null; this.capture = null;   // capture(code): scene-level raw key hook (Controls screen)
      this.phys = new Set();      // every key physically held right now (also while capturing)
      this.ignore = new Set();    // keys held when a capture started / ended: their repeats and keydowns are ignored until released
      window.addEventListener('keydown', e => {
        this.phys.add(e.code);
        if (this.capture) {   // v3.1: swallow EVERYTHING while waiting for a key; only a fresh (non-repeat, not-held-at-start) press is delivered
          e.preventDefault(); e.stopImmediatePropagation(); e.__captured = true;
          if (!e.repeat && !this.ignore.has(e.code)) this.capture(e.code);
          return;
        }
        if (this.ignore.has(e.code)) { e.preventDefault(); e.__captured = true; return; }   // key that was just bound / cancelled / opened the prompt, still held (auto-repeat)
        if (!e.repeat) this.seq[e.code] = (this.seq[e.code] || 0) + 1; this.down.add(e.code);
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); CO.lastDevice = 'keyboard';
      }, true);
      window.addEventListener('keyup', e => { this.down.delete(e.code); this.phys.delete(e.code); this.ignore.delete(e.code); }, true);
      window.addEventListener('blur', () => { this.down.clear(); this.phys.clear(); this.ignore.clear(); });
    }
    // begin / end a raw capture: everything physically held at that moment is ignored until it is released
    startCapture(fn) { this.ignore = new Set(this.phys); this.down.clear(); this.capture = fn; }
    endCapture() { if (!this.capture) return; this.capture = null; this.ignore = new Set(this.phys); this.down.clear(); }
  }
  const tracker = new KeyTracker();
  const MENU_MAP = { confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyJ'], back: ['Escape', 'Backspace'], pause: ['Escape'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
  class KeyboardSource {
    // slot 0/1 = in-game player keyboard maps (live from CO.binds); slot -1 = fixed menu keys
    constructor(slot) { this.slot = slot; this.t = tracker; }
    poll(o, st) {
      st = st || {}; const T = this.t, memo = {};
      const k = c => { if (c in memo) return memo[c]; const n = T.seq[c] || 0; let v = T.down.has(c); if (n > (st[c] || 0)) { st[c] = n; v = true; } return (memo[c] = v); };
      const map = {};
      if (this.slot < 0) for (const a in MENU_MAP) map[a] = MENU_MAP[a];
      else { for (const [a] of KB_ACTIONS) map[a] = B.keys(this.slot, a).slice(); if (this.slot === 0 && CO.activePlayers < 2) for (const a in SOLO_MOVE) map[a].push(SOLO_MOVE[a]); }
      for (const a in map) { for (const c of map[a]) if (k(c)) { o.h[a] = true; break; } }
      if (this.slot >= 0 && o.h.s1 && o.h.s2) o.h.ult = true; // S1+S2 together = Clock Out
      o.mx += (o.h.right ? 1 : 0) - (o.h.left ? 1 : 0); o.my += (o.h.down ? 1 : 0) - (o.h.up ? 1 : 0);
    }
  }
  const MENU_KEYS = new KeyboardSource(-1);

  class GamepadSource {
    constructor(index) { this.index = index; }
    poll(o) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []; const g = pads && pads[this.index]; if (!g) return;
      const b = i => i !== null && i !== undefined && g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5);
      let ax = g.axes[0] || 0, ay = g.axes[1] || 0; if (Math.hypot(ax, ay) < 0.22) ax = ay = 0;
      if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
      o.mx += ax; o.my += ay;
      const set = (a, v) => { if (v) { o.h[a] = true; CO.lastDevice = 'gamepad'; } };
      for (const a of PAD_ACTIONS) set(a, B.pad[a].some(b));
      set('ult', b(4) && b(5)); set('confirm', b(0)); set('back', b(1));   // menu buttons stay fixed (A / B)
      set('up', ay < -0.5); set('down', ay > 0.5); set('left', ax < -0.5); set('right', ax > 0.5);
    }
  }

  // Touch source: the TouchUI scene writes into `state`.
  class TouchSource { constructor() { this.state = { mx: 0, my: 0, h: {} }; } poll(o) { o.mx += this.state.mx; o.my += this.state.my; for (const a in this.state.h) if (this.state.h[a]) o.h[a] = true; } }

  // Scripted autopilot used by automated tests (?bot=1). Reads sim state only.
  class BotSource {
    constructor(getSim, slot) { this.getSim = getSim; this.slot = slot; this.t = 0; this.tap = {}; }
    poll(o) {
      const sim = this.getSim(); if (!sim) return; const p = sim.players[this.slot]; if (!p || !p.alive) return;
      this.t++; const press = a => { o.h[a] = (this.t % 2 === 0); };
      // dodge deadlines
      for (const h of sim.hazards) { const dx = p.x - h.x, dy = p.y - h.y; if (Math.hypot(dx, dy * 1.6) < h.r + 30 && h.t > h.T - 45) { o.mx += Math.sign(dx || 1); o.my += Math.sign(dy || 1) * 0.6; if (h.t > h.T - 20) press('dash'); return; } }
      const tg = sim.targets();
      if (!tg.length) {
        const k = sim.pickups.find(k => Math.abs(k.x - p.x) < 500 && (p.hp < p.maxhp * 0.9 || p.mp < p.maxmp * 0.7));
        if (k) { o.mx += Math.sign(k.x - p.x) * (Math.abs(k.x - p.x) > 10); o.my += Math.sign(k.y - p.y) * (Math.abs(k.y - p.y) > 8); }
        else if (sim.scroll && (sim.state === 'roam' || sim.state === 'start')) {   // story: head for the next area / exit
          o.mx += 1; const my = (sim.A.y0 + sim.A.y1) / 2 + (this.slot - 2) * 30 - p.y; if (Math.abs(my) > 20) o.my += Math.sign(my) * 0.5;
        }
        return;
      }
      let t = null, bd = 1e9; for (const e of tg) { const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2; if (d < bd) { bd = d; t = e; } }
      const near = tg.filter(e => Math.abs(e.x - p.x) < 260 && Math.abs(e.y - p.y) < 120).length;
      if (p.ot >= 100 && (near >= 3 || t.kind === 'boss')) { press('ult'); return; }
      if (p.hp < p.maxhp * 0.55 && p.mp >= 30 && p.cds[0] <= 0) { press('s1'); return; }
      const side = Math.sign(p.x - t.x) || 1, range = p.char.botRange ? (t.kind === 'boss' ? p.char.botRange + 20 : p.char.botRange - 10) : (t.kind === 'boss' ? 150 : 75);
      if (p.char.id === 'keith' && p.mp >= 40 && p.cds[2] <= 0 && sim.players.some(q => !q.alive)) { press('s3'); return; }
      const tx = t.x + side * range, ty = t.y + (this.slot ? ((this.slot % 2) ? 1 : -1) * 6 : 0);
      const dx = tx - p.x, dy = ty - p.y;
      if (Math.abs(dx) > 18) o.mx += Math.sign(dx); if (Math.abs(dy) > 12) o.my += Math.sign(dy);
      const aligned = Math.abs(t.x - p.x) < range + 50 && Math.abs(t.y - p.y) < 34;
      if (aligned) {
        o.mx = 0; o.my = 0; if (Math.sign(t.x - p.x) !== p.face) o.mx = Math.sign(t.x - p.x) * 0.5;
        if (t.kind === 'boss' && t.state === 'sweep' && t.st < 30) { o.mx = -Math.sign(t.x - p.x); press('dash'); return; }
        if (p.mp >= 40 && near >= 3 && p.cds[1] <= 0) press('s2');
        else if (p.mp >= 55 && near >= 4 && p.cds[2] <= 0) press('s3');
        else if (t.type === 'hr' && !t.shieldDown) press('heavy');
        else if (this.t % 90 < 6) press('heavy');
        else press('light');
      }
    }
  }

  class PlayerInput {
    constructor(sources) { this.sources = sources; this.st = sources.map(() => ({})); this.prev = {}; this.intent = CO.emptyIntent(); }
    update() {
      const o = { mx: 0, my: 0, h: {}, p: {} };
      this.sources.forEach((s, i) => s.poll(o, this.st[i]));
      const L = Math.hypot(o.mx, o.my); if (L > 1) { o.mx /= L; o.my /= L; }
      for (const a of ACTS) { if (o.h[a] && !this.prev[a]) o.p[a] = true; }
      this.prev = o.h; this.intent = o; return o;
    }
  }

  // Per-player device assignment (co-op ready, up to CO.MAX_PLAYERS = 5):
  //   P1 = keyboard + gamepad 0 + touch,  P2..P5 = gamepads 1..4,  bots for tests / CPU partners.
  function forSlot(slot, opts = {}) {
    if (opts.bot) return new PlayerInput([new BotSource(opts.getSim, slot)]);
    if (slot === 0) return new PlayerInput([new KeyboardSource(0), new GamepadSource(0), CO.touch]);
    if (slot === 1) return new PlayerInput([new KeyboardSource(1), new GamepadSource(1)]);
    return new PlayerInput([new GamepadSource(slot)]);
  }
  CO.Input = { KeyboardSource, GamepadSource, TouchSource, BotSource, PlayerInput, forSlot, tracker };
  CO.keyboard = tracker;
  CO.touch = new TouchSource();
  // Menu input = any device (fixed menu keys, any gamepad A/B/stick, touch).
  CO.menuInput = new PlayerInput([MENU_KEYS, new GamepadSource(0), new GamepadSource(1), new GamepadSource(2), new GamepadSource(3), new GamepadSource(4), CO.touch]);

  // v3.1 "fresh press" gate for dialogue / menu screens: nothing counts until (a) every confirm/back key, button and pointer
  // that was already held when the scene started has been RELEASED, and (b) a short lock (default 300 ms) has passed.
  // relock(ms) re-arms the lock (used on every new dialogue line).
  CO.Fresh = class {
    constructor(scene, lockMs = 300) { this.scene = scene; this.armed = false; this.t0 = performance.now(); this.until = this.t0 + lockMs; }   // v3.2: also arms after 1 s regardless, so a stuck pad button / lost pointerup can never freeze a dialogue
    poll(I) { if (!this.armed && performance.now() - this.t0 > 1000) this.armed = true; if (!this.armed && !I.h.confirm && !I.h.back && !I.h.pause && !(this.scene.input && this.scene.input.activePointer && this.scene.input.activePointer.isDown)) this.armed = true; return this; }
    relock(ms = 300) { this.until = performance.now() + ms; }
    get ok() { return this.armed && performance.now() >= this.until; }
  };
})(window.CO);
