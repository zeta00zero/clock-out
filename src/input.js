// Clock Out! — input abstraction. Every player is fed by one or more "sources"
// (keyboard, gamepad N, touch, bot, or later: network). The sim only ever sees
// plain serializable intents: { mx, my, h:{held}, p:{pressed this frame} }.
(function (CO) {
  const ACTS = ['light', 'heavy', 'jump', 'dash', 's1', 's2', 's3', 'ult', 'pause', 'confirm', 'back', 'up', 'down', 'left', 'right'];

  class KeyboardSource {
    constructor() {
      this.down = new Set(); this.seq = {}; // seq: per-key press counter so taps shorter than a frame still register
      this.map = { light: ['KeyJ', 'KeyZ'], heavy: ['KeyK', 'KeyX'], jump: ['Space', 'KeyC'], dash: ['KeyL', 'ShiftLeft', 'ShiftRight'],
        s1: ['KeyU', 'Digit1'], s2: ['KeyI', 'Digit2'], s3: ['KeyO', 'Digit3'], ult: ['Semicolon', 'KeyP', 'Digit4'], pause: ['Escape'],
        confirm: ['Enter', 'Space', 'KeyJ'], back: ['Escape', 'Backspace'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
      window.addEventListener('keydown', e => { if (!e.repeat) this.seq[e.code] = (this.seq[e.code] || 0) + 1; this.down.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); CO.lastDevice = 'keyboard'; });
      window.addEventListener('keyup', e => this.down.delete(e.code));
      window.addEventListener('blur', () => this.down.clear());
    }
    poll(o, st) {
      st = st || {};
      const memo = {};
      const k = c => { if (c in memo) return memo[c]; const n = this.seq[c] || 0; let v = this.down.has(c); if (n > (st[c] || 0)) { st[c] = n; v = true; } return (memo[c] = v); };
      for (const a in this.map) { let any = false; for (const c of this.map[a]) if (k(c)) any = true; if (any) o.h[a] = true; }
      if (o.h.s1 && o.h.s2) o.h.ult = true; // U+I = Clock Out
      o.mx += (o.h.right ? 1 : 0) - (o.h.left ? 1 : 0); o.my += (o.h.down ? 1 : 0) - (o.h.up ? 1 : 0);
    }
  }

  class GamepadSource {
    constructor(index) { this.index = index; }
    poll(o) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []; const g = pads && pads[this.index]; if (!g) return;
      const b = i => g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5);
      let ax = g.axes[0] || 0, ay = g.axes[1] || 0; if (Math.hypot(ax, ay) < 0.22) ax = ay = 0;
      if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
      o.mx += ax; o.my += ay;
      const set = (a, v) => { if (v) { o.h[a] = true; CO.lastDevice = 'gamepad'; } };
      set('jump', b(0)); set('dash', b(1) || b(7)); set('light', b(2)); set('heavy', b(3)); set('s1', b(4)); set('s2', b(5)); set('s3', b(6));
      set('ult', (b(4) && b(5)) || b(11)); set('pause', b(9)); set('confirm', b(0)); set('back', b(1));
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
      const side = Math.sign(p.x - t.x) || 1, range = t.kind === 'boss' ? 150 : 75;
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
    if (slot === 0) return new PlayerInput([CO.keyboard, new GamepadSource(0), CO.touch]);
    return new PlayerInput([new GamepadSource(slot)]);
  }
  CO.Input = { KeyboardSource, GamepadSource, TouchSource, BotSource, PlayerInput, forSlot };
  CO.keyboard = new KeyboardSource();
  CO.touch = new TouchSource();
  // Menu input = any device.
  CO.menuInput = new PlayerInput([CO.keyboard, new GamepadSource(0), new GamepadSource(1), new GamepadSource(2), new GamepadSource(3), new GamepadSource(4), CO.touch]);
})(window.CO);
