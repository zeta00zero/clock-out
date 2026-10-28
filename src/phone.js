// Clock Out! v4 — (1) the PHONE-THROW intro that plays before the title, (2) the CHARACTER SELECT screen.
// Everything is drawn in code (no extra art): a buzzing phone, boss texts, Lemon's throw, a cracking glass screen and
// ~40 (phones) / ~90 (desktop) Voronoi shards that fall away to reveal the title (v4.2: storyboard stills).
(function (CO) {
  const rnd = (a, b) => a + Math.random() * (b - a);

  // v4.2: rebuilt to match the approved storyboard (preview_v4/intro_storyboard.png + intro_preview.mp4), 5.6 s:
  // #1 0-1.3 desk still + buzzing phone + boss notification · #2 1.3-2.3 the throw (flash, speed lines) ·
  // #3 2.3-3.0 the phone fills the screen, cracks spread · #4 3.0-4.3 Voronoi shards fall over the live title ·
  // #5 4.3-5.6 the title + menu settle. Stills are AI art (intro_assets.js); all text, cracks and shards are code.
  const lcg = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function voronoi(sites, W, H) {   // half-plane clipping: fine for <= 90 sites, done once
    return sites.map((p, i) => {
      let poly = [[0, 0], [W, 0], [W, H], [0, H]];
      for (let j = 0; j < sites.length && poly.length; j++) {
        if (j === i) continue; const q = sites[j], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = q[0] - p[0], ny = q[1] - p[1];
        const f = v => (v[0] - mx) * nx + (v[1] - my) * ny, out = [];
        for (let k = 0; k < poly.length; k++) { const A = poly[k], B = poly[(k + 1) % poly.length], fa = f(A), fb = f(B);
          if (fa <= 0) out.push(A); if ((fa < 0) !== (fb < 0)) { const t = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); } }
        poly = out;
      }
      return poly;
    });
  }
  class PhoneIntro extends Phaser.Scene {
    constructor() { super('PhoneIntro'); }
    create() {
      this.leaving = false; this.t = 0; this.stage = 0; this.shards = []; window.__phoneIntro = 'run';
      const phone = this.phoneMode = CO.touchOn() || CO.isTouchDevice();
      this.add.rectangle(640, 360, 1280, 720, 0x05050f);
      // layer per panel; each image is 1280x720 so zoom = scale + clamped offset (same maths as the preview)
      this.desk = this.add.image(0, 0, 'intro_desk').setOrigin(0);
      this.throwI = this.add.image(0, 0, 'intro_throw').setOrigin(0).setVisible(false);
      this.lines = this.add.graphics().setVisible(false);
      this.glassC = this.add.container(0, 0).setVisible(false);
      this.glassC.add(this.add.image(0, 0, 'intro_glass').setOrigin(0));
      const st = (sz, c) => ({ fontFamily: CO.FONT, fontStyle: 'bold', fontSize: sz + 'px', color: c, stroke: '#78000a', strokeThickness: 4 });
      this.glassC.add(this.add.text(666, 112, 'BOSS: QUICK FAVOUR?', st(50, '#ffffff')).setOrigin(0.5));
      this.glassC.add(this.add.text(666, 176, 'NEED YOU TILL 3AM  :)', st(50, '#ffebeb')).setOrigin(0.5));
      this.crackG = this.add.graphics(); this.glassC.add(this.crackG);
      // boss notification bubble (#1) — code-drawn; 5:59 PM: before the 8 PM STARSHIFT concert
      const bub = this.bubble = this.add.container(0, 0).setAlpha(0), bg = this.add.graphics();
      bg.fillStyle(0xe62832, 0.92); bg.fillRoundedRect(700, 70, 500, 120, 20); bg.lineStyle(3, 0xffffff); bg.strokeRoundedRect(700, 70, 500, 120, 20); bg.fillTriangle(780, 190, 830, 190, 765, 262);
      bub.add([bg, this.add.text(730, 84, 'BOSS  •  5:59 PM', { fontFamily: CO.FONT, fontSize: '20px', color: '#ffe6e6' }),
        this.add.text(730, 116, '"Quick favour! Need you in\n tonight. Unpaid. Thx :)"', { fontFamily: CO.FONT, fontSize: '24px', color: '#ffffff', lineSpacing: 4 })]);
      // Voronoi plan (~90 desktop / ~40 phone), 12 (6) sites clustered at the impact
      const R = lcg(4), NS = phone ? 40 : 90, NC = phone ? 6 : 12, nrm = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return u - 3; };
      this.sites = []; for (let i = 0; i < NS - NC; i++) this.sites.push([R() * 1280, R() * 720]);
      for (let i = 0; i < NC; i++) this.sites.push([Phaser.Math.Clamp(640 + nrm() * 60, 1, 1279), Phaser.Math.Clamp(360 + nrm() * 50, 1, 719)]);
      this.cells = voronoi(this.sites, 1280, 720);
      this.edges = []; for (const c of this.cells) for (let k = 0; k < c.length; k++) { const A = c[k], B = c[(k + 1) % c.length];
        if ((A[0] <= 0.5 && B[0] <= 0.5) || (A[0] >= 1279.5 && B[0] >= 1279.5) || (A[1] <= 0.5 && B[1] <= 0.5) || (A[1] >= 719.5 && B[1] >= 719.5)) continue;
        this.edges.push([A, B, Math.hypot((A[0] + B[0]) / 2 - 640, (A[1] + B[1]) / 2 - 360)]); }
      this.flash = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0).setDepth(150);
      this.hint = this.add.text(1262, 702, CO.isTouchDevice() ? 'TAP TO SKIP' : 'PRESS ANY KEY TO SKIP', CO.style(16, '#cfe8ff')).setOrigin(1, 1).setAlpha(0.8).setDepth(200);
      this.cameras.main.fadeIn(200);
      this.input.keyboard.on('keydown', () => this.finish(true)); this.input.on('pointerdown', () => this.finish(true));
      this.padDown = false;
      this.ev = []; const at = (ms, fn) => this.ev.push({ ms, fn, done: false });
      at(150, () => CO.audio.sfx('buzz')); at(320, () => CO.audio.sfx('phonering')); at(700, () => CO.audio.sfx('buzz')); at(1050, () => CO.audio.sfx('buzz'));
      at(1300, () => { CO.audio.sfx('throw'); CO.audio.sfx('whoosh'); this.desk.setVisible(false); this.bubble.setVisible(false); this.throwI.setVisible(true); this.lines.setVisible(true); this.cameras.main.shake(160, 0.006); });
      at(2300, () => { CO.audio.sfx('crack'); this.throwI.setVisible(false); this.lines.setVisible(false); this.glassC.setVisible(true); this.cameras.main.shake(140, 0.008); });
      at(2650, () => CO.audio.sfx('crack'));
      at(3000, () => this.shatter());
    }
    zoom(o, z, cx, cy) { const cw = 1280 / z, ch = 720 / z, x0 = Phaser.Math.Clamp(cx - cw / 2, 0, 1280 - cw), y0 = Phaser.Math.Clamp(cy - ch / 2, 0, 720 - ch); o.setScale(z); o.x = -x0 * z; o.y = -y0 * z; }
    shatter() {
      if (this.stage) return; this.stage = 1; CO.audio.sfx('shatter'); this.cameras.main.shake(220, 0.012);
      this.zoom(this.glassC, 1, 640, 360);
      // bake the glass frame (still + code text + all cracks) once, then cut one small canvas per cell
      const W = 1280, H = 720, base = document.createElement('canvas'); base.width = W; base.height = H; const x = base.getContext('2d');
      x.drawImage(this.textures.get('intro_glass').getSourceImage(), 0, 0, W, H);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 50px ' + CO.FONT; x.lineJoin = 'round'; x.lineWidth = 4; x.strokeStyle = '#78000a';
      [['BOSS: QUICK FAVOUR?', 112, '#ffffff'], ['NEED YOU TILL 3AM  :)', 176, '#ffebeb']].forEach(([s, y, c]) => { x.strokeText(s, 666, y); x.fillStyle = c; x.fillText(s, 666, y); });
      x.strokeStyle = 'rgba(235,240,255,0.55)'; x.lineWidth = 3; x.beginPath(); for (const [A, B] of this.edges) { x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); } x.stroke();
      // the live title scene goes underneath; this scene stays on top until the last shard is gone
      this.scene.launch('Title', { fromIntro: true, seamless: true }); this.scene.bringToTop();
      this.glassC.setVisible(false); this.children.list.filter(o => o.type === 'Rectangle' && o !== this.flash).forEach(o => o.setVisible(false));
      this.dark = this.add.rectangle(640, 360, 1280, 720, 0x05050f, 1).setDepth(5);
      const rr = lcg(2), u = () => rr();
      this.cells.forEach((poly, i) => {
        if (poly.length < 3) return; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [px, py] of poly) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
        x0 = Math.floor(x0); y0 = Math.floor(y0); const w = Math.max(2, Math.ceil(x1) - x0), h = Math.max(2, Math.ceil(y1) - y0), key = '__shard' + i;
        if (this.textures.exists(key)) this.textures.remove(key);
        const ct = this.textures.createCanvas(key, w, h), c = ct.getContext();
        c.beginPath(); poly.forEach(([px, py], k) => k ? c.lineTo(px - x0, py - y0) : c.moveTo(px - x0, py - y0)); c.closePath(); c.save(); c.clip(); c.drawImage(base, x0, y0, w, h, 0, 0, w, h); c.restore();
        c.strokeStyle = 'rgba(220,235,255,0.8)'; c.lineWidth = 2; c.stroke(); ct.refresh();
        const im = this.add.image(x0 + w / 2, y0 + h / 2, key).setDepth(10);
        this.shards.push({ im, x: x0 + w / 2, y: y0 + h / 2, cx: this.sites[i][0], vx: u() * 2 - 1, g: 0.7 + u() * 0.9, rot: -60 + u() * 120, dl: u() * 0.35 });
      });
      this.flash.setAlpha(0.63);
    }
    finish(skip) {
      if (this.leaving) return; this.leaving = true; window.__phoneIntro = skip ? 'skipped' : 'done';
      const clean = () => { for (const q of this.shards) if (this.textures.exists(q.im.texture.key)) { const k = q.im.texture.key; q.im.destroy(); this.textures.remove(k); } };
      if (this.stage) { clean(); this.scene.stop(); return; }   // the title is already live underneath
      if (skip) { CO.audio.sfx('ui'); this.cameras.main.fadeOut(160); this.time.delayedCall(180, () => this.scene.start('Title', { fromIntro: true })); }
      else this.scene.start('Title', { fromIntro: true, seamless: true });
    }
    update(time, dt) {
      if (this.leaving) return; this.t += window.__introStep != null ? window.__introStep : dt * (CO.params.speed > 1 ? 4 : 1); const t = window.__introT = this.t;
      const pads = this.input.gamepad && this.input.gamepad.total ? this.input.gamepad.gamepads : []; for (const p of pads) if (p && p.buttons.some(b => b.pressed)) { this.finish(true); return; }
      for (const e of this.ev) if (!e.done && t >= e.ms) { e.done = true; e.fn(); }
      if (t < 1300) {
        const u = t / 1300; this.zoom(this.desk, 1 + 0.08 * u, 760, 330);
        if (t > 250 && Math.floor(t * 14 / 1000) % 2 === 0) { this.desk.x += Phaser.Math.Between(-3, 3); this.desk.y += Phaser.Math.Between(-3, 3); }
        this.bubble.setAlpha(Phaser.Math.Clamp((t - 300) * 6 / 1000, 0, 1));
      } else if (t < 2300) {
        const u = (t - 1300) / 1000; this.zoom(this.throwI, 1 + 0.18 * u * u, 800, 300);
        this.flash.setAlpha(u < 0.12 ? 0.78 * (1 - u / 0.12) : 0);
        const g = this.lines.clear(); g.lineStyle(3, 0xffffff, 0.35 * (1 - u * 0.6)); const r0 = 260 + 200 * u;
        for (let k = 0; k < 36; k++) { const a = k / 36 * 6.283 + Math.sin(k * 7.3 + t / 60) * 0.05, r1 = r0 + 60 + (k * 53 % 140); g.lineBetween(800 + Math.cos(a) * r0, 300 + Math.sin(a) * r0, 800 + Math.cos(a) * (r1 + 700), 300 + Math.sin(a) * (r1 + 700)); }
      } else if (t < 3000 && !this.stage) {
        const u = (t - 2300) / 700; this.zoom(this.glassC, 1.5 - 0.5 * (1 - Math.pow(1 - u, 3)), 640, 360); this.flash.setAlpha(0);
        const R = 60 + 360 * u, g = this.crackG.clear(); g.lineStyle(2, 0xebf0ff, 0.45);
        for (const [A, B, d] of this.edges) if (d < R) g.lineBetween(A[0], A[1], B[0], B[1]);
      }
      if (this.stage === 1) {
        const u = (t - 3000) / 1300;
        this.dark.setAlpha(Math.max(0, 1 - u * 2.2)); this.flash.setAlpha(u < 0.1 ? 0.63 * (1 - u / 0.1) : 0);
        for (const q of this.shards) {
          const uu = Math.max(0, u - q.dl * 0.6), dx = q.vx * 80 * uu + (q.cx - 640) * 0.18 * uu, dy = q.g * 900 * uu * uu - 20 * uu;
          q.im.setPosition(q.x + dx, q.y + dy).setAngle(q.rot * uu * 2).setAlpha(Math.max(0, 1 - Math.max(0, uu - 0.75) * 4));
        }
        this.hint.setAlpha(Math.max(0, 0.8 - u));
        if (u >= 1) this.finish(false);
      }
    }
  }

  // ======================================================================================================
  const RATING = { lemon: { hp: 0.95, spd: 0.65, pow: 0.95, role: 'BRUISER — heavy stapler hits, big ultimate' }, weisheng: { hp: 0.7, spd: 1, pow: 0.62, role: 'SKIRMISHER / SUPPORT — fast, air-dash, heals allies' }, keith: { hp: 0.62, spd: 0.8, pow: 0.7, role: 'SUMMONER / SUPPORT — laser range, holo catgirl allies, revives' }, weiyao: { hp: 0.55, spd: 0.88, pow: 0.78, role: 'AERIAL SHOWMAN — on-beat hits, air juggles, team buffs' } };
  class CharSelect extends Phaser.Scene {
    constructor() { super('CharSelect'); }
    create(d) {
      d = this.d = d || {}; this.n = Phaser.Math.Clamp(d.n || 1, 1, CO.MAX_PLAYERS); this.picks = []; this.leaving = false;
      this.ids = Object.keys(CO.CHARACTERS); this.cur = Math.max(0, this.ids.indexOf(CO.sel.chars[0]));
      this.add.rectangle(640, 360, 1280, 720, 0x0b0f1e); this.add.image(640, 360, 'bg_title').setDisplaySize(1280, 720).setAlpha(0.18);
      this.head = this.add.text(640, 30, '', CO.style(44, '#ffd34d')).setOrigin(0.5, 0);
      this.sub = this.add.text(640, 84, '', CO.style(20, '#cfe8ff')).setOrigin(0.5, 0);
      this.g = this.add.graphics(); this.cards = [];
      const W = this.ids.length > 3 ? 296 : this.ids.length > 2 ? 396 : 440, H = 480, y0 = 122, gap = this.ids.length > 3 ? 12 : this.ids.length > 2 ? 16 : 30, tot = this.ids.length * W + (this.ids.length - 1) * gap;
      this.ids.forEach((id, i) => {
        const c = CO.CHARACTERS[id], x = 640 - tot / 2 + W / 2 + i * (W + gap), R = RATING[id] || { hp: 0.8, spd: 0.8, pow: 0.8, role: '' }, o = { id, x, y: y0, W, H, c, R }, L = x - W / 2;
        o.spr = this.add.image(L + (W < 300 ? 70 : 110), y0 + 304, c.poses.idle).setOrigin(0.5, 1).setScale(W < 300 ? 0.84 : 1); o.sc = W < 300 ? 0.84 : 1; o.badge = this.add.text(x + W / 2 - 14, y0 + 10, '', CO.style(30, '#ffffff')).setOrigin(1, 0);
        this.add.text(L + 20, y0 + 28, c.name, CO.style(W < 300 ? 38 : 46, '#ffffff')).setOrigin(0, 0); this.add.text(L + 20, y0 + 82, '"' + c.title + '"', CO.style(W < 300 ? 16 : 18, '#9aa7c7'));
        [['HP', R.hp, 0xe8384f], ['SPEED', R.spd, 0x6fd3ff], ['POWER', R.pow, 0xffc83d]].forEach(([n, v, col], k) => { const nar = W < 300, yy = y0 + 130 + k * 36, xx = L + (nar ? 120 : 136), bw = nar ? 96 : 140, bo = nar ? 62 : 70; this.add.text(xx, yy - 2, n, CO.style(nar ? 14 : 16, '#cfe8ff')); const gg = this.add.graphics(); gg.fillStyle(0x000000, 0.6); gg.fillRect(xx + bo, yy + 2, bw, 14); gg.fillStyle(col); gg.fillRect(xx + bo, yy + 2, bw * v, 14); });
        const rt = this.add.text(L + 20, y0 + (W < 300 ? 308 : 322), R.role, CO.style(W < 300 ? 13 : 15, '#ffe9a8', { wordWrap: { width: W - 40 } })); rt.setStroke('#0d1022', 3);
        this.add.text(L + 20, y0 + 352, 'Weapon: ' + c.weapon, CO.style(W < 300 ? 12 : 14, '#9aa7c7', { wordWrap: { width: W - 30 } }));
        const all = c.skills.concat([c.ult]);
        const sp = W < 300 ? (W - 30) / 4 : 104, isz = W < 300 ? 44 : 48; all.forEach((s, k) => { const xx = L + (W < 300 ? 14 : 20) + k * sp; this.add.image(xx + 24, y0 + 404, s.icon).setDisplaySize(isz, isz); const nm = this.add.text(xx + 24, y0 + 434, s.name, CO.style(W < 300 ? 11 : 12, k === 3 ? '#ffd34d' : '#cfe8ff', { align: 'center', wordWrap: { width: sp - 4 } })).setOrigin(0.5, 0); });
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
      this.picks.push(o.id); CO.audio.sfx('uiok'); this.tweens.add({ targets: o.spr, scale: { from: 1.12 * o.sc, to: o.sc }, duration: 200 }); this.pairs(); this.fresh.relock(220);
      if (this.picks.length >= this.n) this.done();
      else { const nx = this.ids.findIndex(id => !this.taken(id)); if (nx >= 0) this.cur = nx; }
    }
    undo() {
      if (this.leaving) return; CO.audio.sfx('ui');
      if (this.picks.length) { this.picks.pop(); this.pairs(); return; }
      this.leaving = true; this.scene.start(this.d.back || 'Title', this.d.backData);
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
