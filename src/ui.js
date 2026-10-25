// Clock Out! — shared UI helpers, settings, menus, and non-gameplay scenes.
(function (CO) {
  const Q = new URLSearchParams(location.search);
  CO.params = { bot: Q.has('bot'), speed: Math.max(1, +Q.get('speed') || 1), god: Q.has('god'), skip: Q.has('skip'), seed: +Q.get('seed') || 0, touch: Q.get('touch'), boss: Q.has('boss'),
    stage: Q.get('stage') || (Q.has('survival') ? 'survival' : null), players: +Q.get('players') || 1, chain: Q.has('chain') };
  const DEF = { music: 0.6, sfx: 0.8, touch: 'auto', shake: true };
  try { CO.settings = Object.assign({}, DEF, JSON.parse(localStorage.getItem('clockout.settings') || '{}')); } catch (e) { CO.settings = Object.assign({}, DEF); }
  CO.saveSettings = () => { try { localStorage.setItem('clockout.settings', JSON.stringify(CO.settings)); } catch (e) {} CO.audio.setVolumes(CO.settings.music, CO.settings.sfx); };
  CO.audio.setVolumes(CO.settings.music, CO.settings.sfx);
  CO.isTouchDevice = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  CO.touchOn = () => { const t = CO.params.touch || CO.settings.touch; return t === 'on' || (t === 'auto' && CO.isTouchDevice()); };
  CO.FONT = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
  CO.style = (size, col = '#ffffff', extra = {}) => Object.assign({ fontFamily: CO.FONT, fontSize: size + 'px', color: col, stroke: '#0d1022', strokeThickness: Math.max(3, size / 6) }, extra);
  // ---------- save data (localStorage; survives offline file:// play in most browsers) ----------
  const load = (k, d) => { try { return Object.assign({}, d, JSON.parse(localStorage.getItem(k) || '{}')); } catch (e) { return Object.assign({}, d); } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  CO.save = {
    progress: () => load('clockout.progress', { unlocked: 1, grades: {}, clocks: {}, seenIntro: false, won: false }),
    stageClear(id, r) {
      const P = this.progress(), i = CO.STORY_ORDER.indexOf(id); if (i < 0) return P;
      P.unlocked = Math.max(P.unlocked, Math.min(CO.STORY_ORDER.length, i + 2));
      const rank = g => 'SABCD'.indexOf(g); const old = P.grades[id];
      if (!old || rank(r.grade.g) < rank(old)) P.grades[id] = r.grade.g;
      P.clocks[id] = r.clock; if (id === 's5') P.won = true; store('clockout.progress', P); return P;
    },
    markIntro() { const P = this.progress(); P.seenIntro = true; store('clockout.progress', P); },
    best: () => load('clockout.best', { score: 0, wave: 0, sec: 0 }),
    survivalBest(r) { const B = this.best(); if (r.score > B.score) { B.score = r.score; B.wave = r.wave; B.sec = r.sec; store('clockout.best', B); B.isNew = true; } return B; },
  };
  CO.startStage = (scene, id, extra = {}) => {
    const P = CO.save.progress(), i = CO.STORY_ORDER.indexOf(id), prev = i > 0 ? P.clocks[CO.STORY_ORDER[i - 1]] : 0;
    scene.scene.start('Game', Object.assign({ stage: id, clock: Math.max(CO.STAGES[id].clock || 0, prev || 0) }, extra));
  };
  const unlock = () => { CO.audio.unlock(); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock); window.addEventListener('touchstart', unlock);

  // ---------- menu ----------
  class Menu {
    constructor(scene, x, y, items, o = {}) {
      this.s = scene; this.items = items; this.i = items.findIndex(it => !it.disabled); this.o = o; this.btns = [];
      const W = o.w || 340, H = o.h || 58, gap = o.gap || 14;
      items.forEach((it, k) => {
        const c = scene.add.container(x, y + k * (H + gap)).setDepth(o.depth || 100);
        const g = scene.add.graphics(); const t = scene.add.text(o.align === 'center' ? 0 : 22 - W / 2, 0, '', CO.style(it.size || 30, it.disabled ? '#7d8597' : '#ffffff')).setOrigin(o.align === 'center' ? 0.5 : 0, 0.5);
        c.add([g, t]); c.setSize(W, H); c.setInteractive({ useHandCursor: !it.disabled });
        c.on('pointerdown', (ptr) => { if (it.disabled) { CO.audio.sfx('nope'); this.shake(k); return; } this.i = k; this.draw(); if (it.adjust) { it.adjust(ptr.x - c.x > 0 ? 1 : -1); CO.audio.sfx('ui'); this.draw(); } else this.fire(); });
        c.on('pointerover', () => { if (!it.disabled && this.i !== k) { this.i = k; CO.audio.sfx('ui'); this.draw(); } });
        this.btns.push({ c, g, t, W, H });
      });
      CO.menuInput.update(); this.draw();
    }
    shake(k) { const c = this.btns[k].c; this.s.tweens.add({ targets: c, x: c.x + 8, duration: 40, yoyo: true, repeat: 2 }); }
    label(it) { return typeof it.label === 'function' ? it.label() : it.label; }
    draw() {
      this.items.forEach((it, k) => {
        const b = this.btns[k], sel = k === this.i; b.g.clear();
        b.g.fillStyle(sel ? 0x1fd1e8 : 0x10162e, it.disabled ? 0.55 : 0.88); b.g.fillRoundedRect(-b.W / 2, -b.H / 2, b.W, b.H, 10);
        b.g.lineStyle(3, sel ? 0xffffff : 0x3a4a7a, 1); b.g.strokeRoundedRect(-b.W / 2, -b.H / 2, b.W, b.H, 10);
        if (sel) { b.g.fillStyle(0xffd34d, 1); b.g.fillTriangle(-b.W / 2 - 22, -12, -b.W / 2 - 22, 12, -b.W / 2 - 6, 0); }
        b.t.setText(this.label(it) + (it.sub ? '  ' + it.sub : '')).setColor(it.disabled ? '#7d8597' : sel ? '#0d1022' : '#ffffff').setStroke(sel ? '#ffffff' : '#0d1022', sel ? 2 : 5);
      });
    }
    fire() { const it = this.items[this.i]; if (!it || it.disabled) return; CO.audio.sfx('uiok'); it.cb && it.cb(); }
    update() {
      const I = CO.menuInput.update(), P = I.p; let mv = 0;
      if (P.up) mv = -1; if (P.down) mv = 1;
      if (mv) { let k = this.i; do { k = (k + mv + this.items.length) % this.items.length; } while (this.items[k].disabled); this.i = k; CO.audio.sfx('ui'); this.draw(); }
      const it = this.items[this.i];
      if (it && it.adjust && (P.left || P.right)) { it.adjust(P.right ? 1 : -1); CO.audio.sfx('ui'); this.draw(); }
      else if (P.confirm) this.fire();
      else if (P.back && this.o.onBack) { CO.audio.sfx('ui'); this.o.onBack(); }
    }
  }
  CO.Menu = Menu;

  // ---------- Boot ----------
  class Boot extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() {
      const w = 1280, h = 720, bar = this.add.graphics();
      this.add.text(w / 2, h / 2 - 40, 'CLOCKING IN...', CO.style(34)).setOrigin(0.5);
      this.load.on('progress', v => { bar.clear(); bar.fillStyle(0x1fd1e8); bar.fillRect(w / 2 - 200, h / 2, 400 * v, 16); bar.lineStyle(2, 0xffffff); bar.strokeRect(w / 2 - 200, h / 2, 400, 16); });
      for (const k in window.ASSETS) this.load.image(k, window.ASSETS[k]);
    }
    create() {
      CO.makeTextures(this);
      if (CO.params.skip) this.scene.start('Game', { stage: CO.params.stage || 's1' }); else this.scene.start('Title');
    }
  }

  // ---------- Title ----------
  class Title extends Phaser.Scene {
    constructor() { super('Title'); }
    create() {
      this.add.image(640, 360, 'bg_title').setDisplaySize(1280, 720);
      const sh = this.add.graphics(); sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0); sh.fillRect(0, 280, 700, 440);
      CO.audio.play('title');
      this.menu = new Menu(this, 250, 392, [
        { label: 'STORY', sub: '(CLOCK IN)', size: 32, cb: () => this.go() },
        { label: 'SURVIVAL', size: 30, cb: () => { this.cameras.main.fadeOut(250); this.time.delayedCall(270, () => this.scene.start('Game', { stage: 'survival' })); } },
        { label: 'CO-OP 1-5', sub: '(coming soon)', size: 26, disabled: true },
        { label: 'SETTINGS', size: 28, cb: () => { this.scene.pause(); this.scene.launch('Settings', { from: 'Title' }); } },
      ], { w: 380, h: 54, gap: 12 });
      const B = CO.save.best();
      this.add.text(70, 668, (B.score ? 'SURVIVAL BEST: ' + B.score.toLocaleString() + ' pts · wave ' + B.wave + '   ·   ' : '') + (CO.isTouchDevice() ? 'Tap to choose.' : 'WASD/Arrows + Enter  ·  Gamepad OK'), CO.style(17, '#cfe8ff')).setOrigin(0, 0.5);
      this.add.text(1265, 708, 'v2 · Story (5 stages) + Survival · Lemon', CO.style(14, '#9aa7c7')).setOrigin(1, 1);
      this.cameras.main.fadeIn(400);
      this.events.on('resume', () => { CO.menuInput.update(); });
    }
    go() { const P = CO.save.progress(); this.cameras.main.fadeOut(300); this.time.delayedCall(320, () => { if (!P.seenIntro) this.scene.start('Intro'); else this.scene.start('StageSelect'); }); }
    update() { this.menu.update(); }
  }

  // ---------- Stage select ----------
  class StageSelect extends Phaser.Scene {
    constructor() { super('StageSelect'); }
    create() {
      const P = CO.save.progress(); this.P = P;
      this.add.rectangle(640, 360, 1280, 720, 0x0b0f1e);
      this.prev = this.add.image(860, 330, 'bg_3f').setDisplaySize(720, 405);
      const fr = this.add.graphics(); fr.lineStyle(5, 0x6fd3ff); fr.strokeRect(500, 127, 720, 405);
      this.add.text(60, 40, 'CLOCK IN — STAGE SELECT', CO.style(42, '#ffd34d'));
      this.add.text(60, 92, 'Escape the office. 3F → 2F → Lobby → Rooftop → the Streets. STARSHIFT at 8 PM.', CO.style(18, '#cfe8ff'));
      this.title = this.add.text(860, 560, '', CO.style(30, '#ffffff')).setOrigin(0.5, 0);
      this.cap = this.add.text(860, 602, '', CO.style(18, '#cfe8ff', { align: 'center', wordWrap: { width: 700 } })).setOrigin(0.5, 0);
      this.lock = this.add.text(860, 330, '🔒 LOCKED', CO.style(48, '#ffffff')).setOrigin(0.5);
      const items = CO.STORY_ORDER.map((id, k) => { const S = CO.STAGES[id], g = P.grades[id]; return { label: (k + 1) + '. ' + S.name, sub: g ? '[' + g + ']' : (k < P.unlocked ? '' : '🔒'), size: 24, disabled: k >= P.unlocked, cb: () => this.start(id) }; });
      items.push({ label: 'WATCH INTRO', size: 20, cb: () => this.scene.start('Intro') });
      items.push({ label: 'BACK', size: 22, cb: () => this.scene.start('Title') });
      this.menu = new Menu(this, 250, 170, items, { w: 340, h: 50, gap: 10, onBack: () => this.scene.start('Title') });
      this.menu.i = Math.min(P.unlocked, 5) - 1; this.menu.draw();
      this.shown = -1; CO.audio.play('title'); this.cameras.main.fadeIn(250);
      window.__stageSelect = true;
    }
    start(id) { CO.audio.sfx('bell'); this.cameras.main.fadeOut(250); this.time.delayedCall(270, () => CO.startStage(this, id)); }
    update() {
      this.menu.update();
      const i = this.menu.i; if (i === this.shown) return; this.shown = i;
      const id = CO.STORY_ORDER[i]; if (!id) return;
      const S = CO.STAGES[id], locked = i >= this.P.unlocked;
      this.prev.setTexture(S.bg).setDisplaySize(720, 405).setTint(locked ? 0x333344 : 0xffffff);
      this.lock.setVisible(locked);
      this.title.setText('STAGE ' + S.num + ': ' + S.name + ' — ' + S.sub);
      this.cap.setText(locked ? 'Clear the previous stage to unlock.' : S.caption.join('\n') + (this.P.grades[id] ? '\nBest review: ' + this.P.grades[id] : ''));
    }
  }

  // ---------- Settings (overlay) ----------
  class Settings extends Phaser.Scene {
    constructor() { super('Settings'); }
    create(data) {
      this.from = data.from; const S = CO.settings;
      this.add.rectangle(640, 360, 1280, 720, 0x060914, 0.86).setInteractive();
      this.add.text(640, 110, 'SETTINGS', CO.style(54, '#ffd34d')).setOrigin(0.5);
      this.add.text(640, 160, 'HR-approved preferences. Saved to this browser.', CO.style(18, '#cfe8ff')).setOrigin(0.5);
      const pct = v => '◀ ' + Math.round(v * 10) + ' ▶';
      const back = () => { CO.saveSettings(); this.scene.stop(); this.scene.resume(this.from); };
      const tset = ['auto', 'on', 'off'];
      this.menu = new Menu(this, 640, 240, [
        { label: () => 'MUSIC     ' + pct(S.music), adjust: d => { S.music = Phaser.Math.Clamp(Math.round(S.music * 10 + d) / 10, 0, 1); CO.saveSettings(); } },
        { label: () => 'SOUND FX  ' + pct(S.sfx), adjust: d => { S.sfx = Phaser.Math.Clamp(Math.round(S.sfx * 10 + d) / 10, 0, 1); CO.saveSettings(); } },
        { label: () => 'TOUCH CONTROLS  ◀ ' + S.touch.toUpperCase() + ' ▶', adjust: d => { S.touch = tset[(tset.indexOf(S.touch) + d + 3) % 3]; CO.saveSettings(); const t = this.scene.get('Touch'); if (t && t.refresh) t.refresh(); } },
        { label: () => 'SCREEN SHAKE  ◀ ' + (S.shake ? 'ON' : 'OFF') + ' ▶', adjust: () => { S.shake = !S.shake; CO.saveSettings(); } },
        { label: 'BACK', cb: back },
      ], { w: 560, align: 'center', depth: 10, onBack: back });
      this.add.text(640, 640, 'Left/Right (or tap the sides) to change', CO.style(18, '#9aa7c7')).setOrigin(0.5);
    }
    update() { this.menu.update(); }
  }

  // ---------- Intro story ----------
  class Intro extends Phaser.Scene {
    constructor(key) { super(key || 'Intro'); }
    create(data) {
      data = data || {}; this.d = data; this.leaving = false;
      this.panels = data.scene ? CO.STORY.scenes[data.scene].panels : CO.STORY.intro;
      this.bg = this.add.image(640, 360, data.scene ? CO.STORY.scenes[data.scene].img : 'bg_intro').setDisplaySize(1280, 720);
      this.tweens.add({ targets: this.bg, scale: this.bg.scale * 1.06, duration: 16000 });
      const g = this.add.graphics(); g.fillStyle(0x000000, 0.72); g.fillRect(0, 520, 1280, 200);
      this.title = this.add.text(640, 575, '', CO.style(42, '#ffd34d')).setOrigin(0.5);
      this.sub = this.add.text(640, 640, '', CO.style(24, '#ffffff', { strokeThickness: 4, align: 'center', wordWrap: { width: 1100 } })).setOrigin(0.5);
      this.hint = this.add.text(1260, 700, CO.isTouchDevice() ? 'Tap ▶' : 'Enter ▶   ·   Esc: skip', CO.style(18, '#9aa7c7')).setOrigin(1, 1);
      this.i = -1; this.next(); CO.audio.play('title'); CO.menuInput.update();
      this.input.on('pointerdown', () => this.next());
      this.cameras.main.fadeIn(300);
    }
    next() {
      this.i++; const P = this.panels;
      if (this.i >= P.length) return this.go();
      CO.audio.sfx(this.i === 0 ? 'tick' : 'ui');
      this.title.setText(P[this.i].t).setScale(0.6).setAlpha(0); this.tweens.add({ targets: this.title, scale: 1, alpha: 1, duration: 260, ease: 'Back.out' });
      this.full = P[this.i].s; this.ch = 0; this.sub.setText('');
      this.auto = this.time.now + (CO.params.speed > 1 ? 150 : 3200);
      window.__cutscene = (this.d.scene || 'intro') + ':' + this.i;
    }
    go() {
      if (this.leaving) return; this.leaving = true; CO.audio.sfx('bell'); this.cameras.main.fadeOut(400);
      this.time.delayedCall(420, () => { if (this.d.next) this.scene.start(this.d.next, this.d.data); else { CO.save.markIntro(); CO.startStage(this, 's1'); } });
    }
    update(t) {
      const I = CO.menuInput.update();
      if (this.ch < this.full.length) { this.ch += CO.params.speed > 1 ? 99 : 1.2; this.sub.setText(this.full.slice(0, Math.floor(this.ch))); }
      if (I.p.back) return this.go();
      if (I.p.confirm) { if (this.ch < this.full.length) this.ch = this.full.length; else this.next(); }
      if (t > this.auto && this.ch >= this.full.length) this.next();
    }
  }

  class Cutscene extends Intro { constructor() { super('Cutscene'); } }   // lobby / rooftop story panels

  // ---------- Pause ----------
  class Pause extends Phaser.Scene {
    constructor() { super('Pause'); }
    create() {
      this.add.rectangle(640, 360, 1280, 720, 0x060914, 0.78).setInteractive();
      this.add.text(640, 120, 'PAUSED', CO.style(64, '#ffd34d')).setOrigin(0.5);
      this.add.text(640, 175, '"Taking a quick break." (Do NOT tell the Micromanager.)', CO.style(20, '#cfe8ff')).setOrigin(0.5);
      const resume = () => { this.scene.stop(); this.scene.resume('Game'); this.scene.resume('HUD'); const g = this.scene.get('Game'); g.syncInput(); };
      this.menu = new Menu(this, 640, 260, [
        { label: 'RESUME', cb: resume },
        { label: 'RESTART STAGE', cb: () => { this.scene.stop(); const g = this.scene.get('Game'); g.restart(Object.assign({}, g.data0, { checkpoint: null, continues: 0, stats: null })); } },
        { label: 'SETTINGS', cb: () => { this.scene.pause(); this.scene.launch('Settings', { from: 'Pause' }); } },
        { label: 'QUIT TO TITLE', cb: () => { this.scene.stop(); this.scene.get('Game').quit(); } },
      ], { w: 420, align: 'center', onBack: resume });
      const tc = CO.touchOn();
      this.add.text(640, 600, tc ? 'Touch: left stick to move · ATK / HVY / JUMP / DASH · skill icons · CLOCK OUT when the gold bar is full'
        : 'Move WASD/Arrows · Light J · Heavy K (hold to charge) · Jump Space · Dash L/Shift\nSkills U / I / O · Clock Out ; or P · Pause Esc   —   Pad: X / Y / A / B, LB RB LT, LB+RB', CO.style(17, '#9aa7c7', { align: 'center' })).setOrigin(0.5);
      this.events.on('resume', () => CO.menuInput.update());
    }
    update() { this.menu.update(); }
  }

  // ---------- Game over ----------
  class GameOver extends Phaser.Scene {
    constructor() { super('GameOver'); }
    create(data) {
      this.d = data; CO.audio.play('over');
      this.add.rectangle(640, 360, 1280, 720, 0x05060c, 0.94).setInteractive();
      const surv = data.mode === 'survival', R = data.surv;
      const t = this.add.text(640, 190, surv ? 'SURVIVAL OVER.\nTHE OFFICE WINS... THIS TIME.' : "YOU'VE BEEN ASSIGNED\nTO THE WEEKEND SHIFT.", CO.style(56, '#ff8a3d', { align: 'center' })).setOrigin(0.5).setScale(0.5).setAlpha(0);
      this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 400, ease: 'Back.out' });
      const g = this.scene.get('Game');
      if (surv) {
        const mm = Math.floor(R.sec / 60), ss = Math.floor(R.sec % 60);
        this.add.text(640, 300, 'Wave ' + R.wave + '  ·  ' + mm + ':' + String(ss).padStart(2, '0') + ' survived  ·  ' + R.score.toLocaleString() + ' pts', CO.style(26, '#ffffff')).setOrigin(0.5);
        this.add.text(640, 340, R.best.isNew ? '★ NEW PERSONAL BEST! ★' : 'Best: ' + R.best.score.toLocaleString() + ' pts (wave ' + R.best.wave + ')', CO.style(24, R.best.isNew ? '#ffd34d' : '#cfe8ff')).setOrigin(0.5);
        this.menu = new Menu(this, 640, 430, [
          { label: 'AGAIN!', cb: () => { this.scene.stop(); g.restart({ stage: 'survival' }); } },
          { label: 'QUIT TO TITLE', cb: () => { this.scene.stop(); g.quit(); } },
        ], { w: 380, align: 'center' });
        return;
      }
      const S = CO.STAGES[data.stage];
      this.add.text(640, 300, data.checkpoint !== null && data.checkpoint !== undefined ? 'Retry from the last locked area of ' + S.name + '. (-1500 review points)' : 'Retry from the start of ' + S.name + '.', CO.style(22, '#cfe8ff')).setOrigin(0.5);
      this.add.text(640, 335, 'STARSHIFT starts at 8 PM. The clock does not care.', CO.style(22, '#ffd34d')).setOrigin(0.5);
      this.menu = new Menu(this, 640, 430, [
        { label: 'RETRY', cb: () => { this.scene.stop(); g.restart(Object.assign({}, g.data0, { checkpoint: data.checkpoint, continues: data.continues + 1, stats: data.stats })); } },
        { label: 'QUIT TO TITLE', cb: () => { this.scene.stop(); this.scene.get('Game').quit(); } },
      ], { w: 380, align: 'center' });
    }
    update() { this.menu.update(); }
  }

  // ---------- Result / Win ----------
  class Result extends Phaser.Scene {
    constructor() { super('Result'); }
    create(r) {
      this.r = r; CO.audio.play('win');
      const S = this.S = CO.STAGES[r.stage], last = this.last = r.stage === CO.STORY_ORDER[CO.STORY_ORDER.length - 1];
      const bg = this.add.image(640, 360, last ? 'bg_win' : S.bg).setDisplaySize(1280, 720);
      if (!last) { const sh = this.add.graphics(); sh.fillStyle(0x000000, 0.45); sh.fillRect(0, 0, 1280, 720); }
      this.tweens.add({ targets: bg, scale: bg.scale * 1.05, duration: 12000 });
      this.cameras.main.fadeIn(500, 255, 255, 255);
      const late = !r.onTime, hm = r.clockH % 12 + ':' + String(r.clockM).padStart(2, '0') + ' PM';
      const head = this.add.text(40, 40, last ? (late ? 'SHE MADE IT... FASHIONABLY LATE.' : 'CLOCKED OUT. SHE MADE IT.') : 'STAGE ' + S.num + ' CLEAR — ' + S.name, CO.style(44, '#ffd34d')).setAlpha(0);
      const sub = this.add.text(40, 96, last ? 'Reached STARSHIFT at ' + hm + ' — ' + (late ? 'missed the opener, caught the encore.' : this.spare(r) + ' to spare. Seat A-12. Lightsticks UP.')
        : S.clear + '\nIt is ' + hm + '. ' + (late ? 'STARSHIFT has started. RUN.' : this.spare(r) + ' until STARSHIFT.'), CO.style(22, '#ffffff', { wordWrap: { width: 780 } })).setAlpha(0);
      this.tweens.add({ targets: [head, sub], alpha: 1, duration: 500, delay: 300 });
      // confetti
      for (let i = 0; i < 60; i++) { const c = this.add.image(Phaser.Math.Between(0, 1280), -20 - Math.random() * 600, Math.random() < 0.5 ? 'p_star' : 'p_paper').setScale(0.5 + Math.random() * 0.6).setTint([0xff8fc8, 0x6fd3ff, 0xffd34d, 0x8ee35a, 0xffffff][i % 5]);
        this.tweens.add({ targets: c, y: 760, x: c.x + Phaser.Math.Between(-120, 120), angle: Phaser.Math.Between(-400, 400), duration: Phaser.Math.Between(3500, 7000), repeat: -1, delay: Math.random() * 2000 }); }
      this.time.delayedCall(r.quick ? 50 : 1800, () => this.review());
      CO.menuInput.update();
    }
    next(id) { CO.startStage(this, id, { stats: null }); }
    spare(r) { const m = 20 * 60 - (r.clockH * 60 + r.clockM); return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min'; }
    review() {
      const r = this.r, X = 880, Y = 150;
      const g = this.add.graphics(); g.fillStyle(0xfdfbf3, 0.97); g.fillRoundedRect(X - 20, Y - 10, 400, 520, 8); g.lineStyle(4, 0x1b2a6b); g.strokeRoundedRect(X - 20, Y - 10, 400, 520, 8);
      const panel = this.add.container(0, 0, [g]);
      const ink = (x, y, s, size = 22, col = '#1b2a6b', o = {}) => { const t = this.add.text(x, y, s, Object.assign({ fontFamily: '"Courier New", monospace', fontSize: size + 'px', color: col, fontStyle: 'bold' }, o)); panel.add(t); return t; };
      ink(X, Y + 4, 'PERFORMANCE REVIEW', 28); ink(X, Y + 40, 'LEMON  ·  ' + (this.S.num ? 'S' + this.S.num + ' ' : '') + this.S.name, 17, '#55606e');
      const mm = Math.floor(r.sec / 60), ss = Math.floor(r.sec % 60);
      const rows = [['Time on the clock', mm + ':' + String(ss).padStart(2, '0'), r.time], ['Longest combo', r.stats.maxCombo + ' hits', r.combo], ['Damage taken', Math.round(r.stats.dmgTaken) + ' HP', r.dmg], ['Coworkers filed', r.stats.kos + '', r.ko], ['Overtime bursts', r.stats.overtimes + '', null], ['Continues', r.continues + '', r.continues ? -1500 * r.continues : null]];
      rows.forEach((row, k) => { const y = Y + 84 + k * 38; const a = ink(X, y, row[0], 18), b = ink(X + 205, y, row[1], 18, '#000'), c = ink(X + 360, y, row[2] === null ? '' : (row[2] >= 0 ? '+' : '') + row[2], 18, row[2] < 0 ? '#b03a2e' : '#2a7a3a').setOrigin(1, 0);
        [a, b, c].forEach(t => { t.setAlpha(0); this.tweens.add({ targets: t, alpha: 1, duration: 150, delay: 200 + k * 160 }); }); this.time.delayedCall(200 + k * 160, () => CO.audio.sfx('tap')); });
      const tot = ink(X, Y + 330, 'TOTAL  ' + r.total, 30, '#000').setAlpha(0); this.tweens.add({ targets: tot, alpha: 1, delay: 1300, duration: 200 });
      const st = this.add.text(X + 300, Y + 340, r.grade.g, { fontFamily: CO.FONT, fontSize: '120px', color: r.grade.g === 'S' ? '#d4a400' : '#2a7a3a', stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5).setAngle(-12).setScale(3).setAlpha(0);
      this.time.delayedCall(1600, () => { CO.audio.sfx('kachunk'); this.cameras.main.shake(120, 0.006); this.tweens.add({ targets: st, scale: 1, alpha: 1, duration: 180, ease: 'Quad.in' }); });
      const cm = ink(X, Y + 420, '"' + r.grade.c + '"', 17, '#333', { wordWrap: { width: 360 } }).setAlpha(0); this.tweens.add({ targets: cm, alpha: 1, delay: 1900, duration: 300 });
      ink(X, Y + 478, 'Score: ' + (r.score || 0).toLocaleString(), 16, '#7a6620');
      const i = CO.STORY_ORDER.indexOf(r.stage), nxt = CO.STORY_ORDER[i + 1];
      this.time.delayedCall(r.quick ? 200 : 2000, () => {
        const items = [];
        if (nxt) items.push({ label: 'NEXT: ' + CO.STAGES[nxt].name, cb: () => this.next(nxt) });
        items.push({ label: 'STAGE SELECT', cb: () => { this.scene.start('StageSelect'); } });
        items.push({ label: 'BACK TO TITLE', cb: () => { this.scene.start('Title'); } });
        this.menu = new Menu(this, 230, nxt ? 520 : 560, items, { w: 360 });
        window.__resultShown = r.stage;
        if (CO.params.chain && nxt) this.time.delayedCall(300, () => this.next(nxt));
      });
    }
    update() { if (this.menu) this.menu.update(); }
  }

  CO.Scenes = { Boot, Title, StageSelect, Settings, Intro, Cutscene, Pause, GameOver, Result };
})(window.CO);
