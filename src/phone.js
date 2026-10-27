// Clock Out! v4 — (1) the PHONE-THROW intro that plays before the title, (2) the CHARACTER SELECT screen.
// Everything is drawn in code (no extra art): a buzzing phone, boss texts, Lemon's throw, a cracking glass screen and
// ~40 (phones) / ~90 (desktop) physics shards that fall away to reveal the title.
(function (CO) {
  const rnd = (a, b) => a + Math.random() * (b - a);

  class PhoneIntro extends Phaser.Scene {
    constructor() { super('PhoneIntro'); }
    create() {
      this.leaving = false; this.t = 0; this.stage = 0; this.shards = []; this.cracks = null; window.__phoneIntro = 'run';
      this.bg = this.add.image(640, 360, 'bg_s1').setDisplaySize(1280, 720).setTint(0x4a5578);
      this.add.rectangle(640, 360, 1280, 720, 0x05060c, 0.35);
      this.lem = this.add.image(300, 668, 'lem_idle').setOrigin(0.5, 1);
      this.mood = this.add.text(300, 380, '', CO.style(30, '#ffd34d')).setOrigin(0.5);
      // ---- the phone ----
      const ph = this.phone = this.add.container(860, 760).setDepth(10);
      const body = this.add.graphics(); body.fillStyle(0x06080f); body.fillRoundedRect(-160, -290, 320, 580, 36); body.lineStyle(4, 0x6a7aa8); body.strokeRoundedRect(-160, -290, 320, 580, 36);
      body.fillStyle(0x0e1a38); body.fillRoundedRect(-142, -262, 284, 524, 18); body.fillStyle(0x182a58); body.fillRoundedRect(-142, -262, 284, 70, { tl: 18, tr: 18, bl: 0, br: 0 });
      body.fillStyle(0x06080f); body.fillRoundedRect(-36, -280, 72, 12, 6);
      ph.add(body);
      ph.add(this.add.circle(-112, -228, 20, 0xffd34d)); ph.add(this.add.text(-112, -228, 'M', CO.style(22, '#10162e', { strokeThickness: 0 })).setOrigin(0.5));
      ph.add(this.add.text(-80, -246, 'MANAGEMENT', CO.style(20, '#ffffff', { strokeThickness: 2 }))); ph.add(this.add.text(-80, -224, 'Notifications  ·  1% battery', CO.style(12, '#9fb4e8', { strokeThickness: 0 })));
      this.msgs = [['Hey Lemon. Got a sec?', -150], ['Stay late tonight. Thx!', -60], ["Re: 'STARSHIFT 8 PM'\nLeave request: DENIED.", 40]].map(([s, y]) => {
        const c = this.add.container(-130, y).setAlpha(0).setScale(0.6), t = this.add.text(14, 10, s, { fontFamily: CO.FONT, fontSize: '22px', color: '#10162e' }); const w = Math.max(160, t.width + 28), h = t.height + 20;
        const g = this.add.graphics(); g.fillStyle(0xe9eef8); g.fillRoundedRect(0, 0, w, h, 14); g.fillTriangle(10, h - 4, 0, h + 12, 28, h - 2); c.add([g, t]); ph.add(c); return c;
      });
      this.hint = this.add.text(1262, 702, CO.isTouchDevice() ? 'TAP TO SKIP' : 'PRESS ANY KEY TO SKIP', CO.style(16, '#cfe8ff')).setOrigin(1, 1).setAlpha(0.8).setDepth(200);
      this.flash = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0).setDepth(150);
      this.cameras.main.fadeIn(350);
      // skip: any key or tap (the title then waits for the press to be released: no leak into the menu)
      this.input.keyboard.on('keydown', () => this.finish(true)); this.input.on('pointerdown', () => this.finish(true));
      this.ev = []; const at = (ms, fn) => this.ev.push({ ms, fn, done: false });
      at(500, () => { CO.audio.sfx('phonering'); this.tweens.add({ targets: ph, y: 380, duration: 420, ease: 'Back.out' }); });
      at(950, () => { CO.audio.sfx('buzz'); this.buzzT = 500; });
      at(1500, () => this.msg(0)); at(2300, () => this.msg(1)); at(3100, () => { this.msg(2); this.lem.setTexture('lem_hurt'); this.mood.setText('...').setAlpha(1); });
      at(4000, () => { this.mood.setText('NOPE.'); this.lem.setTexture('lem_airslam'); this.tweens.add({ targets: this.lem, x: 250, duration: 260, ease: 'Quad.out' }); CO.audio.sfx('throw'); });
      at(4350, () => { CO.audio.sfx('whoosh'); this.mood.setText(''); this.lem.setTexture('lem_dash'); this.tweens.add({ targets: this.lem, x: 330, duration: 200 });
        this.tweens.add({ targets: ph, x: 700, y: 330, scale: 7.5, angle: 520, duration: 560, ease: 'Cubic.in' }); });
      at(4920, () => this.impact());
      at(5400, () => this.shatter());
    }
    msg(i) { const c = this.msgs[i]; CO.audio.sfx('tick'); this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 200, ease: 'Back.out' }); }
    impact() {
      CO.audio.sfx('crack'); this.stage = 1; this.phone.setVisible(false); this.lem.setVisible(false);
      this.bg.setTexture('bg_title').clearTint(); this.title = this.add.image(640, 360, 'bg_title').setDisplaySize(1280, 720).setVisible(false);
      this.glass = this.add.graphics().setDepth(20); this.glass.fillStyle(0x0e1a38); this.glass.fillRect(0, 0, 1280, 720);
      this.glass.fillStyle(0x182a58, 0.7); this.glass.fillTriangle(0, 0, 1280, 0, 0, 380);
      this.dark = this.add.rectangle(640, 360, 1280, 720, 0x05060c, 1).setDepth(19);
      this.flash.setAlpha(1); this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 }); this.cameras.main.shake(300, 0.014);
      // crack lines grow from the impact point
      this.ix = 700; this.iy = 330; const N = 14; this.cracks = [];
      for (let k = 0; k < N; k++) { let a = k / N * Math.PI * 2 + rnd(-0.2, 0.2), x = this.ix, y = this.iy, pts = [[x, y]]; const len = rnd(300, 900); for (let d = 0; d < len; d += rnd(40, 90)) { a += rnd(-0.35, 0.35); x += Math.cos(a) * rnd(40, 90); y += Math.sin(a) * rnd(40, 90); pts.push([x, y]); } this.cracks.push(pts); }
      this.crackG = this.add.graphics().setDepth(21); this.crackT = 0;
    }
    shatter() {
      if (this.stage !== 1) return; this.stage = 2; CO.audio.sfx('shatter'); this.cameras.main.shake(220, 0.01);
      if (this.glass) { this.glass.destroy(); this.crackG.destroy(); this.glass = null; }
      this.title.setVisible(true).setDepth(1); this.bg.setVisible(false);
      this.revealShade = this.add.graphics().setDepth(2); this.revealShade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0); this.revealShade.fillRect(0, 280, 700, 440);
      this.dark.setDepth(3).setAlpha(1); this.tweens.add({ targets: this.dark, alpha: 0, duration: 900, delay: 100 });
      // glass mesh -> shards
      const phone = CO.touchOn() || CO.isTouchDevice(), cols = phone ? 5 : 9, rows = phone ? 4 : 5, cw = 1280 / cols, rh = 720 / rows, V = [];
      for (let r = 0; r <= rows; r++) { V[r] = []; for (let c = 0; c <= cols; c++) V[r][c] = { x: c * cw + (c > 0 && c < cols ? rnd(-0.38, 0.38) * cw : 0), y: r * rh + (r > 0 && r < rows ? rnd(-0.38, 0.38) * rh : 0) }; }
      const tris = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = V[r][c], b = V[r][c + 1], d = V[r + 1][c], e = V[r + 1][c + 1]; if (Math.random() < 0.5) { tris.push([a, b, d]); tris.push([b, e, d]); } else { tris.push([a, b, e]); tris.push([a, e, d]); } }
      const pal = [0x0e1a38, 0x13234a, 0x182a58, 0x0b1430, 0x1b3066];
      for (const tr of tris) {
        const cx = (tr[0].x + tr[1].x + tr[2].x) / 3, cy = (tr[0].y + tr[1].y + tr[2].y) / 3, g = this.add.graphics({ x: cx, y: cy }).setDepth(30);
        const pts = tr.map(p => ({ x: p.x - cx, y: p.y - cy })); g.fillStyle(pal[(Math.random() * pal.length) | 0], 0.97); g.fillPoints(pts, true);
        g.lineStyle(2.5, 0xcfe8ff, 0.7); g.strokePoints(pts, true); g.lineStyle(1.5, 0xffffff, 0.35); g.beginPath(); g.moveTo(pts[0].x * 0.7, pts[0].y * 0.7); g.lineTo(pts[1].x * 0.7, pts[1].y * 0.7); g.strokePath();
        const dx = cx - this.ix, dy = cy - this.iy, d = Math.hypot(dx, dy) || 1, near = 1 - Math.min(d, 1100) / 1100;
        this.shards.push({ g, vx: dx / d * (260 + 900 * near) * rnd(0.6, 1.3), vy: dy / d * (140 + 500 * near) - rnd(120, 520), vr: rnd(-5, 5), vs: rnd(0.2, 0.7), delay: d / 1500 * 1000, age: 0 });
      }
    }
    finish(skip) {
      if (this.leaving) return; this.leaving = true; window.__phoneIntro = skip ? 'skipped' : 'done';
      if (skip) { CO.audio.sfx('ui'); this.cameras.main.fadeOut(160); this.time.delayedCall(180, () => this.scene.start('Title', { fromIntro: true })); }
      else this.scene.start('Title', { fromIntro: true, seamless: true });
    }
    update(time, dt) {
      if (this.leaving) return; this.t += dt * (CO.params.speed > 1 ? 4 : 1); const t = this.t;
      for (const e of this.ev) if (!e.done && t >= e.ms) { e.done = true; e.fn(); }
      if (this.buzzT > 0) { this.buzzT -= dt; this.phone.x = 860 + Math.sin(t / 18) * 6; this.phone.angle = Math.sin(t / 22) * 2.2; } else if (this.stage === 0 && this.t < 4300) { this.phone.x = 860; this.phone.angle = 0; }
      if (this.stage === 1 && this.crackG) {
        this.crackT += dt; this.crackG.clear(); const k = Math.min(1, this.crackT / 380);
        this.crackG.lineStyle(3, 0xffffff, 0.95); for (const pts of this.cracks) { const m = Math.max(1, Math.ceil(pts.length * k)); this.crackG.beginPath(); this.crackG.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < m; i++) this.crackG.lineTo(pts[i][0], pts[i][1]); this.crackG.strokePath(); }
        this.crackG.lineStyle(1.5, 0x9fd8ff, 0.8); this.crackG.strokeCircle(this.ix, this.iy, 40 * k); this.crackG.strokeCircle(this.ix, this.iy, 110 * k);
      }
      if (this.stage === 2) {
        const s = dt / 1000; let alive = 0;
        for (const q of this.shards) {
          q.age += dt; if (q.age < q.delay) { q.g.x += Math.sin(q.age) * 0.4; alive++; continue; }
          q.vy += 2300 * s; q.g.x += q.vx * s; q.g.y += q.vy * s; q.g.rotation += q.vr * s; q.g.setScale(q.g.scale + q.vs * s * 0.5);
          if (q.g.y < 900 && q.g.x > -300 && q.g.x < 1600) alive++; else q.g.setVisible(false);
          if (q.age > 1800) q.g.setAlpha(Math.max(0, 1 - (q.age - 1800) / 500));
        }
        if (!alive || this.t > 5400 + 2300) this.finish(false);
      }
    }
  }

  // ======================================================================================================
  const RATING = { lemon: { hp: 0.95, spd: 0.65, pow: 0.95, role: 'BRUISER — heavy stapler hits, big ultimate' }, weisheng: { hp: 0.7, spd: 1, pow: 0.62, role: 'SKIRMISHER / SUPPORT — fast, air-dash, heals allies' } };
  class CharSelect extends Phaser.Scene {
    constructor() { super('CharSelect'); }
    create(d) {
      d = this.d = d || {}; this.n = Phaser.Math.Clamp(d.n || 1, 1, CO.MAX_PLAYERS); this.picks = []; this.leaving = false;
      this.ids = Object.keys(CO.CHARACTERS); this.cur = Math.max(0, this.ids.indexOf(CO.sel.chars[0]));
      this.add.rectangle(640, 360, 1280, 720, 0x0b0f1e); this.add.image(640, 360, 'bg_title').setDisplaySize(1280, 720).setAlpha(0.18);
      this.head = this.add.text(640, 30, '', CO.style(44, '#ffd34d')).setOrigin(0.5, 0);
      this.sub = this.add.text(640, 84, '', CO.style(20, '#cfe8ff')).setOrigin(0.5, 0);
      this.g = this.add.graphics(); this.cards = [];
      const W = 440, H = 480, y0 = 122, gap = 30, tot = this.ids.length * W + (this.ids.length - 1) * gap;
      this.ids.forEach((id, i) => {
        const c = CO.CHARACTERS[id], x = 640 - tot / 2 + W / 2 + i * (W + gap), R = RATING[id] || { hp: 0.8, spd: 0.8, pow: 0.8, role: '' }, o = { id, x, y: y0, W, H, c, R }, L = x - W / 2;
        o.spr = this.add.image(L + 110, y0 + 300, c.poses.idle).setOrigin(0.5, 1); o.badge = this.add.text(x + W / 2 - 14, y0 + 10, '', CO.style(30, '#ffffff')).setOrigin(1, 0);
        this.add.text(L + 20, y0 + 28, c.name, CO.style(46, '#ffffff')).setOrigin(0, 0); this.add.text(L + 20, y0 + 82, '"' + c.title + '"', CO.style(18, '#9aa7c7'));
        [['HP', R.hp, 0xe8384f], ['SPEED', R.spd, 0x6fd3ff], ['POWER', R.pow, 0xffc83d]].forEach(([n, v, col], k) => { const yy = y0 + 130 + k * 36, xx = L + 136; this.add.text(xx, yy - 2, n, CO.style(16, '#cfe8ff')); const gg = this.add.graphics(); gg.fillStyle(0x000000, 0.6); gg.fillRect(xx + 70, yy + 2, 140, 14); gg.fillStyle(col); gg.fillRect(xx + 70, yy + 2, 140 * v, 14); });
        const rt = this.add.text(L + 20, y0 + 322, R.role, CO.style(15, '#ffe9a8', { wordWrap: { width: W - 40 } })); rt.setStroke('#0d1022', 3);
        this.add.text(L + 20, y0 + 348, 'Weapon: ' + c.weapon, CO.style(14, '#9aa7c7'));
        const all = c.skills.concat([c.ult]);
        all.forEach((s, k) => { const xx = L + 20 + k * 104; this.add.image(xx + 24, y0 + 404, s.icon).setDisplaySize(48, 48); const nm = this.add.text(xx + 24, y0 + 434, s.name, CO.style(12, k === 3 ? '#ffd34d' : '#cfe8ff', { align: 'center', wordWrap: { width: 100 } })).setOrigin(0.5, 0); });
        o.zone = this.add.zone(x, y0 + H / 2, W, H).setInteractive({ useHandCursor: true });
        o.zone.on('pointerover', () => { if (!this.leaving && this.cur !== i) { this.cur = i; CO.audio.sfx('ui'); } });
        o.zone.on('pointerdown', () => { if (this.fresh.ok) { this.cur = i; this.confirm(); } });
        this.cards.push(o);
      });
      this.back = this.add.text(30, 692, '◀ BACK', CO.style(22, '#cfe8ff')).setOrigin(0, 1).setInteractive({ useHandCursor: true }); this.back.on('pointerdown', () => { if (this.fresh.ok) this.undo(); });
      this.foot = this.add.text(640, 696, '', CO.style(18, '#9aa7c7')).setOrigin(0.5, 1);
      this.fresh = new CO.Fresh(this, 300); this.pairs(); CO.menuInput.update(); this.cameras.main.fadeIn(200); window.__charSelect = { n: this.n, picks: this.picks };
    }
    taken(id) { return this.picks.indexOf(id) >= 0 && this.picks.length < this.ids.length; }   // no duplicates while a fresh character is still available
    pairs() {
      const k = Math.min(this.picks.length, this.n - 1), col = '#' + (CO.PLAYER_COLORS[k] || 0xffffff).toString(16).padStart(6, '0');
      this.head.setText(this.n > 1 ? 'CO-OP · PLAYER ' + (k + 1) + ' OF ' + this.n : 'CHOOSE YOUR FIGHTER').setColor(this.n > 1 ? col : '#ffd34d');
      this.sub.setText(this.n > 1 ? 'Pick with any keyboard / pad — each fighter can be taken once' + (this.n > this.ids.length ? ' (then doubles allowed)' : '') : 'Left / Right to choose · Enter or tap to confirm · Esc: back');
      this.foot.setText(this.picks.length ? 'Picked: ' + this.picks.map((c, i) => 'P' + (i + 1) + ' ' + CO.CHARACTERS[c].name).join('  ·  ') : (CO.touchOn() ? 'Tap a fighter' : ''));
      this.cards.forEach(o => { const idx = this.picks.reduce((a, c, i) => c === o.id ? a.concat(i) : a, []); o.badge.setText(idx.map(i => 'P' + (i + 1)).join(' ')); o.spr.setAlpha(this.taken(o.id) ? 0.4 : 1); });
      window.__charSelect = { n: this.n, picks: this.picks.slice() };
    }
    confirm() {
      if (this.leaving) return; const o = this.cards[this.cur];
      if (this.taken(o.id)) { CO.audio.sfx('nope'); this.cameras.main.shake(80, 0.003); return; }
      this.picks.push(o.id); CO.audio.sfx('uiok'); this.tweens.add({ targets: o.spr, scale: { from: 1.12, to: 1 }, duration: 200 }); this.pairs(); this.fresh.relock(220);
      if (this.picks.length >= this.n) this.done();
      else { const nx = this.ids.findIndex(id => !this.taken(id)); if (nx >= 0) this.cur = nx; }
    }
    undo() {
      if (this.leaving) return; CO.audio.sfx('ui');
      if (this.picks.length) { this.picks.pop(); this.pairs(); return; }
      this.leaving = true; this.scene.start(this.d.back || 'Title');
    }
    done() {
      this.leaving = true; CO.sel.chars = this.picks.slice(); CO.saveSel(); this.foot.setText('READY!  ' + this.picks.map((c, i) => 'P' + (i + 1) + ' ' + CO.CHARACTERS[c].name).join('  ·  ')).setColor('#7dff8a');
      const nx = this.d.next || { scene: 'StageSelect' };
      this.time.delayedCall(CO.params.speed > 1 ? 50 : 650, () => {
        this.cameras.main.fadeOut(220);
        this.time.delayedCall(240, () => {
          if (nx.game) CO.enterGame(this, 'Game', { stage: nx.game }, { back: 'Title', label: 'Survival — ' + CO.STAGES[nx.game].arenaName });
          else this.scene.start(nx.scene, nx.data);
        });
      });
    }
    update(t) {
      const g = this.g; g.clear();
      const k = this.picks.length, col = CO.PLAYER_COLORS[Math.min(k, this.n - 1)] || 0xffd34d;
      this.cards.forEach((o, i) => {
        const sel = i === this.cur && !this.leaving, tk = this.taken(o.id), pk = this.picks.indexOf(o.id) >= 0;
        g.fillStyle(0x10162e, tk ? 0.6 : 0.92); g.fillRoundedRect(o.x - o.W / 2, o.y, o.W, o.H, 14);
        g.lineStyle(sel ? 6 : 3, sel ? col : pk ? 0x7dff8a : 0x3a4a7a, 1); g.strokeRoundedRect(o.x - o.W / 2, o.y, o.W, o.H, 14);
        if (sel) { g.lineStyle(2, 0xffffff, 0.5 + Math.sin(t / 160) * 0.3); g.strokeRoundedRect(o.x - o.W / 2 - 6, o.y - 6, o.W + 12, o.H + 12, 18); }
        o.spr.y = o.y + 300 + (sel ? Math.sin(t / 220) * 3 : 0);
      });
      const I = CO.menuInput.update(); this.fresh.poll(I); if (!this.fresh.ok || this.leaving) return; const P = I.p;
      if (P.left) { this.cur = (this.cur + this.ids.length - 1) % this.ids.length; CO.audio.sfx('ui'); }
      if (P.right) { this.cur = (this.cur + 1) % this.ids.length; CO.audio.sfx('ui'); }
      if (P.confirm) this.confirm(); else if (P.back) this.undo();
    }
  }

  Object.assign(CO.Scenes, { PhoneIntro, CharSelect });
})(window.CO);
