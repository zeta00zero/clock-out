// Clock Out! v3 — pre-game "HOW TO PLAY" screen + "CONTROLS" (key binding) screen.
// HowTo is shown before every mode (Story, any stage from Stage Select, Survival, co-op) unless the player
// ticked "Don't show again" (localStorage 'clockout.howto'); it stays reachable from the main menu.
(function (CO) {
  const st = (k, d) => { try { return Object.assign({}, d, JSON.parse(localStorage.getItem(k) || '{}')); } catch (e) { return Object.assign({}, d); } };
  CO.howto = {
    hidden: () => !!st('clockout.howto', { hide: false }).hide,
    setHidden(v) { try { localStorage.setItem('clockout.howto', JSON.stringify({ hide: !!v })); } catch (e) {} },
  };
  // Single door into gameplay. Opens How to Play first unless hidden / skipped.
  //   opts.back = scene key for BACK, opts.label = "next up" line, opts.noHowTo = continue-the-run transitions
  CO.enterGame = (scene, key, data, opts = {}) => {
    if (key === 'Game' && data && !data.chars) data = Object.assign({ chars: CO.sel.chars.slice() }, data);   // v4: the fighter(s) picked on the select screen
    if (opts.noHowTo || CO.params.skip || CO.howto.hidden()) { scene.scene.start(key, data); return; }
    scene.scene.start('HowTo', { target: { key, data }, back: opts.back || 'Title', label: opts.label || '' });
  };

  const C = { bg: 0x0b0f1e, panel: 0x10162e, edge: 0x3a4a7a, cyan: 0x1fd1e8, gold: 0xffd34d };
  const txt = (s, x, y, size, col, o = {}, extra) => s.add.text(x, y, '', CO.style(size, col, Object.assign({ strokeThickness: Math.max(2, size / 8) }, extra || {})));
  const panel = (s, x, y, w, h, a = 0.9) => { const g = s.add.graphics(); g.fillStyle(C.panel, a); g.fillRoundedRect(x, y, w, h, 12); g.lineStyle(3, C.edge, 1); g.strokeRoundedRect(x, y, w, h, 12); return g; };
  const bgFor = s => { s.add.rectangle(640, 360, 1280, 720, C.bg); s.add.image(640, 360, 'bg_title').setDisplaySize(1280, 720).setAlpha(0.18); };

  // horizontal button row used by both screens: items [{label|fn, w, cb, kind}]
  class Row {
    constructor(scene, items, y, o = {}) {
      this.s = scene; this.items = items; this.i = Math.max(0, items.findIndex(it => it.def)); this.y = y; this.o = o;
      const gap = 16, total = items.reduce((a, it) => a + it.w, 0) + gap * (items.length - 1); let x = (o.cx || 640) - total / 2;
      items.forEach((it, k) => {
        it.x = x + it.w / 2; x += it.w + gap;
        it.g = scene.add.graphics().setDepth(5); it.t = scene.add.text(it.x, y, '', CO.style(it.size || 24, '#fff')).setOrigin(0.5).setDepth(6);
        it.z = scene.add.zone(it.x, y, it.w, 56).setInteractive({ useHandCursor: true }).setDepth(7);
        it.z.on('pointerover', () => { if (this.i !== k) { this.i = k; CO.audio.sfx('ui'); this.draw(); } });
        it.z.on('pointerdown', () => { this.i = k; this.draw(); this.fire(); });
      });
      this.draw();
    }
    label(it) { return typeof it.label === 'function' ? it.label() : it.label; }
    draw() {
      this.items.forEach((it, k) => {
        const sel = k === this.i; it.g.clear(); const h = 56;
        it.g.fillStyle(sel ? (it.kind === 'go' ? 0x7dff8a : C.cyan) : (it.kind === 'go' ? 0x1d4a2c : 0x10162e), 0.95); it.g.fillRoundedRect(it.x - it.w / 2, this.y - h / 2, it.w, h, 10);
        it.g.lineStyle(3, sel ? 0xffffff : C.edge, 1); it.g.strokeRoundedRect(it.x - it.w / 2, this.y - h / 2, it.w, h, 10);
        it.t.setText(this.label(it)).setColor(sel ? '#0d1022' : '#ffffff').setStroke(sel ? '#ffffff' : '#0d1022', sel ? 2 : 5);
        if (it.t.width > it.w - 16) it.t.setScale((it.w - 16) / it.t.width); else it.t.setScale(1);
      });
    }
    fire() { const it = this.items[this.i]; CO.audio.sfx('uiok'); it.cb && it.cb(); }
    update(P) {
      if (P.left) { this.i = (this.i + this.items.length - 1) % this.items.length; CO.audio.sfx('ui'); this.draw(); }
      if (P.right) { this.i = (this.i + 1) % this.items.length; CO.audio.sfx('ui'); this.draw(); }
      if (P.confirm) this.fire();
    }
  }

  // ======================================================================================================
  class HowTo extends Phaser.Scene {
    constructor() { super('HowTo'); }
    create(d) {
      d = this.d = d || {}; const info = this.info = !d.target; this.leaving = false;
      const inPlay = (d.target && d.target.data && d.target.data.chars) || CO.sel.chars, np = Math.max(1, Math.min(CO.MAX_PLAYERS || 5, CO.params.players || 1, 9) , inPlay.length), two = np > 1;
      bgFor(this);
      txt(this, 40, 18, 44, '#ffd34d').setText('HOW TO PLAY');
      txt(this, 40, 70, 18, '#cfe8ff').setText(info ? 'Your live key bindings, the items you can pick up, and a few combos.' : (d.label ? 'Up next: ' + d.label : 'Get ready!') + (two ? '   ·   ' + np + ' players' : ''));
      // ---- controls panel (live bindings) ----
      const px = 30, py = 104, pw = two ? 800 : 780, ph = 478; panel(this, px, py, pw, ph);
      const cols = two ? [{ k: 'ACTION', x: 50 }, { k: 'KEYBOARD P1', x: 262 }, { k: 'KEYBOARD P2', x: 452 }, { k: 'GAMEPAD', x: 612 }, { k: 'TOUCH', x: 712 }] : [{ k: 'ACTION', x: 50 }, { k: 'KEYBOARD', x: 270 }, { k: 'GAMEPAD', x: 520 }, { k: 'TOUCH', x: 650 }];
      cols.forEach(c => txt(this, c.x, py + 12, 17, '#6fd3ff').setText(c.k));
      const B = CO.binds, T = { light: 'ATK button', heavy: 'HVY button', jump: 'JUMP button', dash: 'DASH button', s1: 'skill icon 1', s2: 'skill icon 2', s3: 'skill icon 3', ult: 'ULT icon', pause: 'II (top right)' };
      const mv = s => ['up', 'left', 'down', 'right'].map(a => CO.keyName(B.keys(s, a)[0])).join(' ');
      const rows = [['Move', mv(0), mv(1), 'Left stick / D-pad', 'Left thumb stick'],
        ...B.ACTIONS.slice(4).map(([a, l]) => [l, CO.keyLabel(0, a), CO.keyLabel(1, a), B.pad[a] ? CO.padLabel(a) : '—', T[a]])];
      rows.forEach((r, i) => {
        const y = py + 42 + i * 36; if (i % 2 === 0) { const g = this.add.graphics(); g.fillStyle(0xffffff, 0.05); g.fillRect(px + 8, y - 3, pw - 16, 33); }
        const cell = (x, s, w, col) => { const t = txt(this, x, y + 2, 17, col || '#ffffff').setText(s); if (t.width > w) t.setScale(w / t.width); return t; };
        if (two) { cell(50, r[0], 200, '#ffe9a8'); cell(262, r[1], 180); cell(452, r[2], 150); cell(612, r[3], 92); cell(712, r[4], 112, '#cfe8ff'); }
        else { cell(50, r[0], 210, '#ffe9a8'); cell(270, r[1], 240); cell(520, r[3], 120); cell(650, r[4], 124, '#cfe8ff'); }
      });
      txt(this, px + 18, py + ph - 28, 14, '#9aa7c7').setText(CO.touchOn() ? 'Touch: stick on the left, buttons on the right.' : 'Solo: arrow keys also move P1. U+I together = Clock Out. Change any key on the CONTROLS screen.');
      // ---- items panel ----
      const ix = 850, iw = 400; panel(this, ix, py, iw, 196);
      txt(this, ix + 16, py + 10, 20, '#ffd34d').setText('ITEMS  (dropped by coworkers)');
      const item = (y, key, name, lines, sc) => { const b = this.add.graphics(); b.fillStyle(0x000000, 0.35); b.fillRoundedRect(ix + 14, y, 72, 62, 8); this.add.image(ix + 50, y + 31, key).setScale(sc);
        txt(this, ix + 98, y + 1, 18, '#ffffff').setText(name); txt(this, ix + 98, y + 26, 14, '#cfe8ff', {}, { wordWrap: { width: 290 } }).setText(lines); };
      item(py + 42, 'bean', 'COFFEE BEAN', '+30 caffeine / nitro — refills the meter you spend on skills.', 1.4);
      item(py + 114, 'donut', 'BIRTHDAY CAKE', '+60 HP — rarer drop. Grab them before they vanish!', 1.3);
      // ---- tips ----
      panel(this, ix, py + 208, iw, ph - 208);
      txt(this, ix + 16, py + 218, 20, '#ffd34d').setText('COMBOS & SPECIALS');
      const L = { lemon: ['LEMON: ATK ×4 = Memo → Cc → Bcc → Spin Cycle. HEAVY = Hard Copy (hold: Final Draft). JUMP+ATK juggles; HEAVY in the air = Hole Punch.', 'Coffee Rush / Staple Barrage / Briefcase Spin cost caffeine. Full meter: CLOCK OUT.'],
        weisheng: ['WEISHENG: ATK ×4 = Jab → Cross → Sweep → Spin Out. HEAVY = Torque Slam (hold: Full Tank). Fast dash, air-dash.', 'Garage Tune-Up heals (allies too), Emergency Brake stuns, Hairpin Drift slides. Full meter: HYPERION ZERO.'] };
      const tips = [].concat(...inPlay.filter((c, i) => inPlay.indexOf(c) === i).map(c => L[c] || [])).concat(['Hits fill the ULT meter — when it glows, unleash it!', 'New zombies: dodge the telegraph (cones, rings: JUMP the shock-waves), avoid puddles & spills.', 'Co-op: P1 = keyboard 1 / pad 1, P2 = keyboard 2 / pad 2, P3-5 = pads.']);
      let ty = py + 248; tips.forEach(t => { const o = txt(this, ix + 34, ty, 13, '#ffffff', {}, { wordWrap: { width: 350 } }); o.setText(t); txt(this, ix + 16, ty - 1, 13, '#6fd3ff').setText('•'); ty += o.height + 4; });
      // ---- buttons ----
      const items = [];
      if (!info) items.push({ label: 'START  ▶', w: 250, size: 28, kind: 'go', def: true, cb: () => this.go() });
      items.push({ label: 'CONTROLS / KEY BINDING', w: 340, size: 22, def: info, cb: () => this.scene.start('Controls', { back: { key: 'HowTo', data: d } }) });
      items.push({ label: info ? 'BACK' : 'BACK', w: 130, size: 22, cb: () => this.back() });
      items.push({ label: () => (CO.howto.hidden() ? '☑' : '☐') + " DON'T SHOW AGAIN", w: 290, size: 20, cb: () => { CO.howto.setHidden(!CO.howto.hidden()); this.row.draw(); } });
      this.row = new Row(this, items, 640); this.fresh = new CO.Fresh(this, 300);
      txt(this, 640, 690, 15, '#9aa7c7').setText(info ? 'Esc: back' : CO.isTouchDevice() ? 'Tap START' : 'Enter / A / tap: start   ·   Esc: back   ·   ← → choose');
      this.children.list.filter(o => o.type === 'Text' && o.y > 680).forEach(o => o.setOrigin(0.5, 0));
      window.__howto = { info, hidden: () => CO.howto.hidden(), shown: true };
      CO.menuInput.update(); this.cameras.main.fadeIn(200);
    }
    go() { if (this.leaving || !this.fresh.ok) return; this.leaving = true; CO.audio.sfx('bell'); const t = this.d.target; this.cameras.main.fadeOut(220); this.time.delayedCall(240, () => { window.__howto = null; this.scene.start(t.key, t.data); }); }
    back() { if (this.leaving) return; this.leaving = true; window.__howto = null; this.scene.start(this.d.back || 'Title'); }
    update() { if (this.leaving) return; const I = CO.menuInput.update(); this.fresh.poll(I); if (this.fresh.ok) this.row.update(I.p); if (this.fresh.ok && I.p.back) { CO.audio.sfx('ui'); this.back(); } }
  }

  // ======================================================================================================
  class Controls extends Phaser.Scene {
    constructor() { super('Controls'); }
    create(d) {
      d = this.d = d || {}; this.leaving = false; this.tab = 0; this.row = 0; this.col = 0; this.listen = null; this.flashCell = null; this.msgT = 0;
      bgFor(this);
      txt(this, 40, 14, 44, '#ffd34d').setText('CONTROLS');
      txt(this, 40, 66, 17, '#cfe8ff').setText('Pick an action, press ENTER (or click), then press the new key. Esc cancels. Del clears. Used keys are swapped.');
      this.tabs = ['KEYBOARD  P1', 'KEYBOARD  P2', 'GAMEPAD  1-5', 'TOUCH'].map((n, i) => {
        const x = 40 + i * 215, g = this.add.graphics(), t = txt(this, x + 100, 107, 19, '#fff').setText(n).setOrigin(0.5);
        const z = this.add.zone(x + 100, 107, 205, 40).setInteractive({ useHandCursor: true }); z.on('pointerdown', () => this.setTab(i)); return { x, g, t };
      });
      panel(this, 30, 134, 1220, 490, 0.92);
      this.hdr = ['ACTION', 'KEY 1', 'KEY 2'].map((s, i) => txt(this, [60, 560, 780][i], 142, 16, '#6fd3ff').setText(s));
      this.cells = []; this.labels = []; this.hints = [];
      const HINT = { up: 'Move', down: 'Move', left: 'Move (also faces her)', right: 'Move', light: 'Tap ×4 for the combo', heavy: 'Hold to charge', jump: 'Then ATK to juggle', dash: 'Then ATK = lunge', s1: 'Heal + haste', s2: 'Fan of staples', s3: 'Boomerang briefcase', ult: 'Needs full meter (S1+S2 also works)', pause: 'Esc always works for P1' };
      for (let r = 0; r < 13; r++) {
        const y = 168 + r * 31; this.labels.push(txt(this, 60, y + 3, 18, '#ffe9a8')); this.hints.push(txt(this, 1010, y + 5, 14, '#9aa7c7'));
        const row = []; for (let c = 0; c < 2; c++) {
          const x = 550 + c * 220, g = this.add.graphics(), t = txt(this, x + 100, y + 13, 18, '#fff').setOrigin(0.5);
          const z = this.add.zone(x + 100, y + 13, 200, 28).setInteractive({ useHandCursor: true });
          z.on('pointerdown', () => { this.row = r; this.col = c; if (this.listen) this.cancel(true); this.begin(); this.draw(); });
          z.on('pointerover', () => { if (!this.listen && (this.row !== r || this.col !== c)) { this.row = r; this.col = c; this.draw(); } });
          row.push({ x, y, g, t, z });
        }
        this.cells.push(row); this.hints[r].hintKey = Object.keys(HINT)[r];
      }
      this.HINT = HINT;
      this.info = txt(this, 60, 170, 20, '#cfe8ff', {}, { wordWrap: { width: 1100 }, lineSpacing: 8 });
      this.status = txt(this, 640, 603, 18, '#7dff8a').setOrigin(0.5, 0.5);
      this.btn = new Row(this, [
        { label: 'RESET TO DEFAULTS', w: 330, size: 22, cb: () => this.reset() },
        { label: 'BACK', w: 200, size: 24, def: true, cb: () => this.back() },
      ], 668);
      this.btn.i = 1; this.btn.draw(); this.inBtns = false;
      this.keyH = e => { if (this.listen || e.__captured) return; if (e.code === 'Tab') { e.preventDefault(); this.setTab((this.tab + (e.shiftKey ? 3 : 1)) % 4); } else if (e.code === 'Delete' || (e.code === 'Backspace' && !this.inBtns)) this.clearCell(); else if (e.code === 'PageDown' || e.code === 'KeyE') this.setTab((this.tab + 1) % 4); else if (e.code === 'PageUp' || e.code === 'KeyQ') this.setTab((this.tab + 3) % 4); };
      window.addEventListener('keydown', this.keyH);
      this.events.once('shutdown', () => { window.removeEventListener('keydown', this.keyH); CO.keyboard.endCapture(); window.__controls = null; });
      this.padPrev = {}; this.setTab(0); CO.menuInput.update(); this.cameras.main.fadeIn(150);
      window.__controls = this;
    }
    rowsOf() { const t = this.tab; return t === 2 ? CO.binds.PAD_ACTIONS.map(a => [a, CO.binds.label(a)]) : t < 2 ? CO.binds.ACTIONS : []; }
    setTab(i) {
      if (this.listen) this.cancel(true); this.tab = i; this.row = 0; this.col = 0; this.inBtns = false; this.btn.i = 1;
      const touch = i === 3, n = this.rowsOf().length;
      this.cells.forEach((row, r) => row.forEach(c => { const on = !touch && r < n; c.z.setVisible(on); if (!on) { c.g.clear(); c.t.setText(''); } c.z.input.enabled = on; }));
      this.labels.forEach((l, r) => l.setVisible(!touch && r < n)); this.hints.forEach((l, r) => l.setVisible(!touch && r < n)); this.hdr.forEach(h => h.setVisible(!touch));
      this.hdr[1].setText(i === 2 ? 'BUTTON 1' : 'KEY 1'); this.hdr[2].setText(i === 2 ? 'BUTTON 2' : 'KEY 2');
      this.info.setVisible(touch);
      if (touch) this.info.setText('TOUCH CONTROLS (phones & tablets)\n\n• Left thumb: drag anywhere on the left half = move stick.\n• Right side: ATK, HVY, JUMP and DASH buttons; coffee / stapler / briefcase icons = skills 1-3; the clock icon = Clock Out when the meter is full.\n• II (top right) pauses.\n\nTouch buttons are fixed. Turn them on or off in SETTINGS (Auto / On / Off).');
      this.say(i === 1 ? 'P2 shares this keyboard in co-op. Defaults never overlap with P1.' : i === 2 ? 'Pads 1-5 are players 1-5. All pads use this one button layout. Sticks / D-pad move. A / B stay confirm / back in menus.' : i === 0 ? 'Solo play: arrow keys also move P1 (not in 2+ player games).' : '', '#9aa7c7');
      this.draw();
    }
    say(s, col = '#7dff8a') { this.status.setText(s).setColor(col); this.msgT = 400; }
    draw() {
      this.tabs.forEach((t, i) => { const sel = i === this.tab; t.g.clear(); t.g.fillStyle(sel ? C.cyan : 0x10162e, 0.95); t.g.fillRoundedRect(t.x, 88, 205, 38, 8); t.g.lineStyle(3, sel ? 0xffffff : C.edge, 1); t.g.strokeRoundedRect(t.x, 88, 205, 38, 8); t.t.setColor(sel ? '#0d1022' : '#ffffff').setStroke(sel ? '#ffffff' : '#0d1022', sel ? 2 : 4); });
      if (this.tab === 3) return;
      const B = CO.binds, rows = this.rowsOf();
      rows.forEach((rw, r) => {
        const act = rw[0]; this.labels[r].setText(rw[1]); this.hints[r].setText(this.tab === 2 ? '' : this.HINT[act] || '');
        const vals = this.tab === 2 ? B.pad[act] : B.kb[this.tab][act];
        this.cells[r].forEach((c, ci) => {
          const sel = r === this.row && ci === this.col && !this.inBtns, lis = this.listen && this.listen.row === r && this.listen.col === ci, fl = this.flashCell && this.flashCell.r === r && this.flashCell.c === ci && this.flashCell.tab === this.tab;
          c.g.clear(); c.g.fillStyle(lis ? 0xffc83d : fl ? 0x2a7a3a : sel ? C.cyan : 0x1a2244, 0.95); c.g.fillRoundedRect(c.x, c.y, 200, 28, 6); c.g.lineStyle(2, sel || lis ? 0xffffff : C.edge, 1); c.g.strokeRoundedRect(c.x, c.y, 200, 28, 6);
          const v = vals[ci]; c.t.setText(lis ? (this.tab === 2 ? 'PRESS A BUTTON…' : 'PRESS A KEY…') : this.tab === 2 ? CO.padName(v) : CO.keyName(v)).setColor(lis ? '#0d1022' : sel ? '#0d1022' : (v === null || v === undefined) ? '#7d8597' : '#ffffff').setStroke(lis || sel ? '#ffffff' : '#0d1022', lis || sel ? 2 : 4);
        });
      });
      this.btn.draw();
    }
    begin() {
      if (this.tab === 3) return; this.listen = { row: this.row, col: this.col }; CO.audio.sfx('uiok'); this.say(this.tab === 2 ? 'Press a gamepad button… (Esc cancels)' : 'Press a key… (Esc cancels)', '#ffc83d');
      if (this.tab === 2) { this.padPrev = this.padNow() || {}; } else CO.keyboard.startCapture(code => this.onKey(code));
      this.draw();
    }
    cancel(silent) { this.listen = null; CO.keyboard.endCapture(); if (!silent) this.say('Cancelled.', '#9aa7c7'); CO.menuInput.update(); this.draw(); }
    padNow() { const out = {}; const pads = navigator.getGamepads ? navigator.getGamepads() : []; let any = false; for (let p = 0; p < pads.length; p++) { const g = pads[p]; if (!g) continue; any = true; g.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) out[i] = true; }); } return any ? out : null; }
    result(r) {
      const L = this.listen; this.listen = null; CO.keyboard.endCapture(); CO.menuInput.update();
      this.say(r.ok ? (r.msg || 'Bound!') : r.msg, r.ok ? (r.msg ? '#ffd34d' : '#7dff8a') : '#ff9a6a'); CO.audio.sfx(r.ok ? 'pickup' : 'nope');
      if (r.ok && L) { this.flashCell = { tab: this.tab, r: L.row, c: L.col }; this.time.delayedCall(900, () => { this.flashCell = null; this.draw(); }); }
      this.draw();
    }
    onKey(code) {
      if (!this.listen) return; if (code === 'Escape') { this.cancel(); return; }
      const rows = this.rowsOf(), act = rows[this.listen.row][0]; this.result(CO.binds.setKey(this.tab, act, this.listen.col, code));
    }
    clearCell() { if (this.tab === 3 || this.inBtns) return; const act = this.rowsOf()[this.row][0]; this.result(this.tab === 2 ? CO.binds.clearPad(act, this.col) : CO.binds.clearKey(this.tab, act, this.col)); }
    reset() { CO.binds.reset(); this.say('All controls reset to defaults.', '#7dff8a'); this.draw(); }
    back() { if (this.leaving) return; this.leaving = true; CO.keyboard.endCapture(); const b = this.d.back || { key: 'Title' }; this.scene.start(b.key, b.data); }
    update() {
      if (this.leaving) return; if (this.msgT > 0 && --this.msgT === 0) this.status.setText('');
      const I = CO.menuInput.update(), P = I.p;
      if (this.listen) {
        if (this.tab === 2) {
          const now = this.padNow() || {};
          if (I.p.back && false) return;
          for (const b in now) if (!this.padPrev[b]) { const act = this.rowsOf()[this.listen.row][0]; this.result(CO.binds.setPad(act, this.listen.col, +b)); break; }
          this.padPrev = now; if (P.back && this.listen) this.cancel();
        }
        return;
      }
      if (this.tab === 3) { if (P.back) this.back(); return; }
      const n = this.rowsOf().length;
      if (P.back) { CO.audio.sfx('ui'); this.back(); return; }
      if (this.inBtns) { if (P.up) { this.inBtns = false; this.row = n - 1; CO.audio.sfx('ui'); this.draw(); } else this.btn.update(P); return; }
      if (P.up) { this.row = (this.row + n - 1) % n; CO.audio.sfx('ui'); this.draw(); }
      if (P.down) { if (this.row === n - 1) { this.inBtns = true; } else this.row++; CO.audio.sfx('ui'); this.draw(); }
      if (P.left || P.right) { this.col = 1 - this.col; CO.audio.sfx('ui'); this.draw(); }
      if (P.confirm) this.begin();
    }
  }
  Object.assign(CO.Scenes, { HowTo, Controls });
})(window.CO);
