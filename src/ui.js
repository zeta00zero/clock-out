// Clock Out! — shared UI helpers, settings, menus, and non-gameplay scenes.
(function (CO) {
  const Q = new URLSearchParams(location.search);
  CO.params = { bot: Q.has('bot'), speed: Math.max(1, +Q.get('speed') || 1), god: Q.has('god'), skip: Q.has('skip'), seed: +Q.get('seed') || 0, touch: Q.get('touch'), boss: Q.has('boss'),
    stage: Q.get('stage') || (Q.has('survival') ? 'survival' : null), players: +Q.get('players') || 1, chain: Q.has('chain'), cpu: Q.has('cpu'),
    char: Q.get('char') || null, chars: Q.get('chars') ? Q.get('chars').split(',').filter(c => c) : null, fx: Q.get('fx') || null, noflash: Q.has('noflash'), nointro: Q.has('nointro'), level: +Q.get('level') || 0, net: Q.get('net') || null, room: Q.get('room') || null };
  const DEF = { music: 0.6, sfx: 0.8, touch: 'auto', shake: true, fx: 'auto' };
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
    // v4: the story grew from 5 to 7 stages (new: 4 THE LIFT, 6 THE APARTMENT). Old saves (no `ver`) are migrated once:
    //   old s4 Rooftop -> s5, old s5 Streets -> s7; unlocked 1-4 stay, 5 (Rooftop cleared) -> 6, a won save -> 7.
    progress() {
      let raw = null; try { raw = JSON.parse(localStorage.getItem('clockout.progress') || 'null'); } catch (e) {}
      if (raw && raw.ver !== 4) {
        const g = raw.grades || {}, c = raw.clocks || {}, u = Math.max(1, Math.min(5, +raw.unlocked || 1)), won = !!raw.won || !!g.s5;
        const ng = {}, nc = {}; for (const k of Object.keys(g)) ng[k === 's4' ? 's5' : k === 's5' ? 's7' : k] = g[k]; for (const k of Object.keys(c)) nc[k === 's4' ? 's5' : k === 's5' ? 's7' : k] = c[k];
        raw = { unlocked: won ? 7 : u >= 5 ? 6 : u, grades: ng, clocks: nc, seenIntro: !!raw.seenIntro, won, ver: 4 }; store('clockout.progress', raw);
      }
      return load('clockout.progress', { unlocked: 1, grades: {}, clocks: {}, seenIntro: false, won: false, ver: 4 });
    },
    stageClear(id, r) {
      const P = this.progress(), i = CO.STORY_ORDER.indexOf(id); if (i < 0) return P;
      P.unlocked = Math.max(P.unlocked, Math.min(CO.STORY_ORDER.length, i + 2));
      const rank = g => 'SABCD'.indexOf(g); const old = P.grades[id];
      if (!old || rank(r.grade.g) < rank(old)) P.grades[id] = r.grade.g;
      P.clocks[id] = r.clock; if (id === CO.STORY_ORDER[CO.STORY_ORDER.length - 1]) P.won = true; P.ver = 4; store('clockout.progress', P); return P;
    },
    markIntro() { const P = this.progress(); P.seenIntro = true; P.ver = 4; store('clockout.progress', P); },
    best: () => load('clockout.best', { score: 0, wave: 0, sec: 0 }),
    survLevel: () => load('clockout.survlv', { max: 1, won: false }),
    survReach(L, won) { const B = this.survLevel(); let nw = false; if (L > B.max) { B.max = Math.min(100, L); nw = true; } if (won) B.won = true; store('clockout.survlv', B); B.isNew = nw; return B; },
    survivalBest(r) { const B = this.best(); if (r.score > B.score) { B.score = r.score; B.wave = r.wave; B.sec = r.sec; store('clockout.best', B); B.isNew = true; } return B; },
  };
  // v4: fighter selection (1-5 players). Order: ?chars= / ?char= params > last choice saved in this browser > Lemon.
  const ARN = CO.SURV_ARENAS || ['survival'];
  CO.sel = Object.assign({ chars: ['lemon'], arena: 'survival' }, load('clockout.sel', {}));
  if (CO.params.chars) CO.sel.chars = CO.params.chars.slice(); else if (CO.params.char) CO.sel.chars = [CO.params.char];
  CO.sel.chars = CO.sel.chars.filter(c => CO.CHARACTERS[c]); if (!CO.sel.chars.length) CO.sel.chars = ['lemon']; if (ARN.indexOf(CO.sel.arena) < 0) CO.sel.arena = ARN[0];
  CO.saveSel = () => store('clockout.sel', { chars: CO.sel.chars, arena: CO.sel.arena });
  CO.startStage = (scene, id, extra = {}) => {
    const P = CO.save.progress(), i = CO.STORY_ORDER.indexOf(id), prev = i > 0 ? P.clocks[CO.STORY_ORDER[i - 1]] : 0;
    const data = Object.assign({ stage: id, clock: Math.max(CO.STAGES[id].clock || 0, prev || 0) }, extra), S = CO.STAGES[id];
    // fresh Story entries (title / stage select / intro) go through HOW TO PLAY; Result->NEXT stage passes {pre:false}
    CO.enterGame(scene, 'Game', data, { noHowTo: extra.pre === false, back: extra.back || 'StageSelect', label: 'Stage ' + S.num + ' — ' + S.name });
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
      if (CO.params.skip) this.scene.start('Game', { stage: CO.params.stage || (CO.params.level ? CO.survArenaFor(CO.params.level) : 's1'), level: CO.params.level || 0, chars: CO.sel.chars.slice() });
      else if (new URLSearchParams(location.search).get('net')) this.scene.start('Lobby', { mode: new URLSearchParams(location.search).get('mode') || 'story', auto: true });
      else if (CO.params.nointro || CO.params.bot) this.scene.start('Title'); else this.scene.start('PhoneIntro');   // v4: phone-throw intro, then the title
    }
  }

  // ---------- Title ----------
  class Title extends Phaser.Scene {
    constructor() { super('Title'); }
    create(d) {
      d = d || {}; this.add.image(640, 360, 'bg_title').setDisplaySize(1280, 720);
      const sh = this.add.graphics(); sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0); sh.fillRect(0, 280, 700, 440);
      CO.audio.play('title'); this.fresh = new CO.Fresh(this, d.fromIntro ? 400 : d.quiet ? 150 : 0);
      // v5 menu: STORY MODE / SURVIVAL MODE / SETTINGS, each with its own submenu (Esc / BACK climbs one level)
      const page = this.page = d.page || 'main', coopN = this.coopN = Math.max(2, Math.min(CO.MAX_PLAYERS, CO.sel.chars.length)), go = (pg) => this.scene.restart({ page: pg, quiet: true });
      const online = mode => { this.cameras.main.fadeOut(200); this.time.delayedCall(220, () => this.scene.start('Lobby', { mode })); };
      const P = CO.save.progress(), SL = CO.save.survLevel();
      const PAGES = {
        main: { head: null, back: null, items: [
          { label: 'STORY MODE', size: 30, cb: () => go('story') },
          { label: 'SURVIVAL MODE', size: 30, cb: () => go('surv') },
          { label: 'SETTINGS', size: 30, cb: () => go('settings') } ] },
        story: { head: 'STORY MODE', back: 'main', items: [
          { label: P.unlocked > 1 || P.seenIntro ? 'CONTINUE' : 'START', sub: '(intro + fighter)', size: 26, cb: () => this.pick(1, { scene: 'Intro' }, 'story') },
          { label: 'STAGE SELECT', size: 26, cb: () => { this.cameras.main.fadeOut(250); this.time.delayedCall(270, () => this.scene.start('StageSelect')); } },
          { label: 'CO-OP', size: 26, cb: () => go('storycoop') },
          { label: 'BACK', size: 22, cb: () => go('main') } ] },
        storycoop: { head: 'STORY CO-OP', back: 'story', items: [
          { label: () => 'LOCAL  ◀ ' + this.coopN + ' PLAYERS ▶', size: 24, adjust: d => { this.coopN = Phaser.Math.Clamp(this.coopN + d, 2, CO.MAX_PLAYERS); }, cb: () => this.pick(this.coopN, { scene: 'StageSelect' }, 'storycoop') },
          { label: 'ONLINE', sub: '(host or join)', size: 24, cb: () => online('story') },
          { label: 'BACK', size: 22, cb: () => go('story') } ] },
        surv: { head: 'SURVIVAL MODE', back: 'main', items: [
          { label: 'SINGLE', sub: '(best: LV ' + SL.max + ')', size: 26, cb: () => this.pick(1, { scene: 'SurvSelect' }, 'surv') },
          { label: 'CO-OP', size: 26, cb: () => go('survcoop') },
          { label: 'BACK', size: 22, cb: () => go('main') } ] },
        survcoop: { head: 'SURVIVAL CO-OP', back: 'surv', items: [
          { label: 'ONLINE', sub: '(host or join)', size: 24, cb: () => online('survival') },
          { label: () => 'LOCAL  ◀ ' + this.coopN + ' PLAYERS ▶', size: 24, adjust: d => { this.coopN = Phaser.Math.Clamp(this.coopN + d, 2, CO.MAX_PLAYERS); }, cb: () => this.pick(this.coopN, { scene: 'SurvSelect' }, 'survcoop') },
          { label: 'BACK', size: 22, cb: () => go('surv') } ] },
        settings: { head: 'SETTINGS', back: 'main', items: [
          { label: 'HOW TO PLAY', size: 24, cb: () => this.scene.start('HowTo', { back: 'Title' }) },
          { label: 'KEY BINDING', sub: '(controls)', size: 24, cb: () => this.scene.start('Controls', { back: { key: 'Title', data: { page: 'settings', quiet: true } } }) },
          { label: 'AUDIO · TOUCH · EFFECTS', size: 22, cb: () => { this.scene.pause(); this.scene.launch('Settings', { from: 'Title' }); } },
          { label: 'BACK', size: 22, cb: () => go('main') } ] },
      };
      const PG = PAGES[page] || PAGES.main;
      if (PG.head) this.add.text(60, 268, PG.head, CO.style(30, '#ffd34d'));
      this.menu = new Menu(this, 250, 330, PG.items, { w: 380, h: 50, gap: 10, onBack: PG.back ? () => go(PG.back) : null });
      window.__menuPage = page;
      if (d.netMsg) { const nm = this.add.text(640, 210, d.netMsg, CO.style(26, '#ffd34d', { backgroundColor: '#10162ecc', padding: { x: 18, y: 10 } })).setOrigin(0.5).setDepth(300); this.tweens.add({ targets: nm, alpha: 0, delay: 5000, duration: 600 }); }
      const B = CO.save.best();
      this.add.text(70, 704, (B.score ? 'SURVIVAL BEST: ' + B.score.toLocaleString() + ' pts · wave ' + B.wave + '   ·   ' : '') + (CO.isTouchDevice() ? 'Tap to choose.' : 'WASD/Arrows + Enter  ·  Gamepad OK'), CO.style(17, '#cfe8ff')).setOrigin(0, 0.5);
      this.add.text(1265, 708, 'v5 · 7-stage Story + 100-level Survival · Lemon, Weisheng, Keith & Wei Yao · local + online co-op', CO.style(14, '#9aa7c7')).setOrigin(1, 1);
      if (d.quiet) {} else if (!d.seamless) this.cameras.main.fadeIn(d.fromIntro ? 180 : 400);
      else { const cam = this.cameras.main; cam.setZoom(1.05); this.tweens.add({ targets: cam, zoom: 1, duration: 1500, delay: 1000, ease: 'Cubic.out' }); }   // v4.2 intro #5: title + menu settle in
      this.events.on('resume', () => { CO.menuInput.update(); });
    }
    // v4: every mode goes through the fighter pick (remembers the last choice)
    pick(n, next, page) { this.cameras.main.fadeOut(250); this.time.delayedCall(270, () => this.scene.start('CharSelect', { n, next, back: 'Title', backData: { page: page || 'main', quiet: true } })); }
    // v3.2: STORY always plays the intro story (Esc / Skip leaves it); it used to jump straight to Stage Select once a save had seenIntro (any v2/v3 save) = 'the story is not there'
    go() { this.cameras.main.fadeOut(300); this.time.delayedCall(320, () => this.scene.start('Intro')); }
    update() { const I = CO.menuInput.intent; this.fresh.poll(I && I.h ? I : { h: {} }); if (this.fresh.ok) this.menu.update(); }
  }

  // ---------- Stage select ----------
  class StageSelect extends Phaser.Scene {
    constructor() { super('StageSelect'); }
    create() {
      const P = CO.save.progress(); this.P = P;
      this.add.rectangle(640, 360, 1280, 720, 0x0b0f1e);
      this.prev = this.add.image(860, 330, 'bg_3f').setDisplaySize(720, 405);
      const fr = this.add.graphics(); fr.lineStyle(5, 0x6fd3ff); fr.strokeRect(500, 127, 720, 405);
      // v5: header follows the lead fighter's story (CO.STORIES[lead]); refreshed when the fighter line changes
      this.hd = this.add.text(60, 40, '', CO.style(42, '#ffd34d')); this.hd2 = this.add.text(60, 92, '', CO.style(18, '#cfe8ff')); this.head();
      this.title = this.add.text(860, 560, '', CO.style(30, '#ffffff')).setOrigin(0.5, 0);
      this.cap = this.add.text(860, 602, '', CO.style(18, '#cfe8ff', { align: 'center', wordWrap: { width: 700 } })).setOrigin(0.5, 0);
      this.lock = this.add.text(860, 330, '🔒 LOCKED', CO.style(48, '#ffffff')).setOrigin(0.5);
      const items = CO.STORY_ORDER.map((id, k) => { const S = CO.STAGES[id], g = P.grades[id]; return { label: (k + 1) + '. ' + S.name, sub: g ? '[' + g + ']' : (k < P.unlocked ? '' : '🔒'), size: 22, disabled: k >= P.unlocked, cb: () => this.start(id) }; });
      // v4: fighter / co-op line (cycles LEMON -> WEISHENG -> CO-OP 2P -> ...) and the two Survival arenas
      const IDS = Object.keys(CO.CHARACTERS), opts = IDS.map(c => [c]).concat([IDS.slice(0, 2)], IDS.length > 2 ? [IDS.slice(0, 3)] : []), cur = () => Math.max(0, opts.findIndex(o => o.join() === CO.sel.chars.join()));
      const fl = () => CO.sel.chars.length > 1 ? 'CO-OP · ' + CO.sel.chars.map(c => CO.CHARACTERS[c].name).join(' + ') : 'FIGHTER · ' + CO.CHARACTERS[CO.sel.chars[0]].name;
      items.push({ label: () => '◀ ' + fl() + ' ▶', size: 18, adjust: d => { CO.sel.chars = opts[(cur() + d + opts.length) % opts.length].slice(); CO.saveSel(); }, cb: () => this.scene.start('CharSelect', { n: CO.sel.chars.length, next: { scene: 'StageSelect' }, back: 'StageSelect' }) });
      items.push({ label: () => 'SURVIVAL  ◀ ' + CO.STAGES[CO.sel.arena].arenaName + ' ▶', size: 18, adjust: d => { CO.sel.arena = ARN[(ARN.indexOf(CO.sel.arena) + d + ARN.length) % ARN.length]; CO.saveSel(); }, cb: () => { this.cameras.main.fadeOut(250); this.time.delayedCall(270, () => CO.enterGame(this, 'Game', { stage: CO.sel.arena }, { back: 'StageSelect', label: 'Survival — ' + CO.STAGES[CO.sel.arena].arenaName })); } });
      items.push({ label: 'WATCH INTRO', size: 18, cb: () => this.scene.start('Intro') });
      const bk = () => this.scene.start('Title', { page: 'story', quiet: true });
      items.push({ label: 'BACK', size: 20, cb: bk });
      this.menu = new Menu(this, 250, 150, items, { w: 340, h: 40, gap: 6, onBack: bk });
      this.menu.i = Math.min(P.unlocked, CO.STORY_ORDER.length) - 1; this.menu.draw();
      this.shown = -1; CO.audio.play('title'); this.cameras.main.fadeIn(250);
      window.__stageSelect = true;
    }
    head() {
      const SY = CO.story(CO.sel.chars), dl = SY.deadline || 1200, dh = Math.floor(dl / 60) % 12 + ':' + String(dl % 60).padStart(2, '0') + ' PM'; this.hk = CO.sel.chars.join();
      this.hd.setText(SY.title + ' — STAGE SELECT'); this.hd2.setText('3F → 2F → Lobby → The Lift → Rooftop → The Apartment → The Streets.   ' + (SY.hudGoal ? SY.hudGoal.replace(/ · $/, '') + ' PM.' : SY.goal + ' at ' + dh + '.'));
      window.__ssHead = SY.title;
    }
    start(id) { CO.audio.sfx('bell'); this.cameras.main.fadeOut(250); this.time.delayedCall(270, () => CO.startStage(this, id)); }
    update() {
      this.menu.update(); if (this.hk !== CO.sel.chars.join()) this.head();
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
        { label: () => 'EFFECTS  ◀ ' + (S.fx || 'auto').toUpperCase() + ' ▶', adjust: d => { const f = ['auto', 'high', 'low']; S.fx = f[(f.indexOf(S.fx || 'auto') + d + 3) % 3]; CO.fxAutoLow = false; CO.saveSettings(); const g = this.scene.get('Ambient'); if (g && g.rebuild) g.rebuild(); const gm = this.scene.get('Game'); if (gm && gm.refreshFx) gm.refreshFx(); } },
        { label: 'BACK', cb: back },
      ], { w: 560, align: 'center', depth: 10, onBack: back });
      this.add.text(640, 640, 'Left/Right (or tap the sides) to change  ·  EFFECTS: HIGH = lighting, rim light, rain, reflections · LOW = lean (auto on phones)', CO.style(18, '#9aa7c7')).setOrigin(0.5);
    }
    update() { this.menu.update(); }
  }

  // ---------- Intro story ----------
  class Intro extends Phaser.Scene {
    constructor(key) { super(key || 'Intro'); }
    create(data) {
      data = data || {}; this.d = data; this.leaving = false;
      // v5: per-character story — the intro / ending panels come from CO.STORIES[lead]; shared cutscenes swap the hero's name
      const lead = CO.storyLead(data.chars || CO.curChars || CO.sel.chars), nm = (CO.CHARACTERS[lead] || {}).name || 'Lemon', cap = nm.charAt(0) + nm.slice(1).toLowerCase();
      const swap = p => lead === 'lemon' ? p : p.map(q => Object.assign({}, q, { t: q.t.replace(/Lemon/g, cap).replace(/LEMON/g, nm), s: q.s.replace(/Lemon/g, cap).replace(/LEMON/g, nm).replace(/STARSHIFT/g, CO.STORIES[lead].goal) }));
      this.panels = data.panels || (data.scene ? swap(CO.STORY.scenes[data.scene].panels) : CO.storyIntro(data.chars || CO.sel.chars));
      window.__story = { lead, scene: data.story || data.scene || 'intro', n: this.panels.length };
      this.bg = this.add.image(640, 360, data.scene ? CO.STORY.scenes[data.scene].img : (this.panels[0] && this.panels[0].img) || 'bg_intro').setDisplaySize(1280, 720);
      this.tweens.add({ targets: this.bg, scale: this.bg.scale * 1.06, duration: 16000 });
      const g = this.add.graphics(); g.fillStyle(0x000000, 0.72); g.fillRect(0, 520, 1280, 200);
      this.title = this.add.text(640, 575, '', CO.style(42, '#ffd34d')).setOrigin(0.5);
      this.sub = this.add.text(640, 640, '', CO.style(24, '#ffffff', { strokeThickness: 4, align: 'center', wordWrap: { width: 1100 } })).setOrigin(0.5);
      this.hint = this.add.text(1260, 700, CO.isTouchDevice() ? 'Tap ▶' : 'Enter ▶   ·   Esc: skip', CO.style(18, '#9aa7c7')).setOrigin(1, 1);
      this.i = -1; this.fresh = new CO.Fresh(this, 300); this.next(); CO.audio.play('title'); CO.menuInput.update();
      // v3.1: pointer/tap obeys the same gate as the keys (a tap from the previous screen can't skip a line)
      this.input.on('pointerdown', () => { if (this.fresh.ok && !(CO.net && CO.net.isClient() && CO.net.inPlay)) this.press(); });
      const sk = this.add.text(1262, 18, 'SKIP ▶▶', CO.style(20, '#cfe8ff')).setOrigin(1, 0).setInteractive({ useHandCursor: true }); sk.on('pointerdown', () => { if (!(CO.net && CO.net.isClient() && CO.net.inPlay)) this.go(); });   // v3.2: tappable skip
      this.cameras.main.fadeIn(300);
    }
    next() {
      this.i++; const P = this.panels;
      if (this.i >= P.length) return this.go();
      CO.audio.sfx(this.i === 0 ? 'tick' : 'ui'); this.fresh.relock(300);   // input lock on every new line
      if (P[this.i].img) this.bg.setTexture(P[this.i].img).setDisplaySize(1280, 720);
      this.title.setText(P[this.i].t).setScale(0.6).setAlpha(0); this.tweens.add({ targets: this.title, scale: 1, alpha: 1, duration: 260, ease: 'Back.out' });
      this.full = P[this.i].s; this.ch = 0; this.sub.setText(''); this.doneAt = 0;
      window.__cutscene = (this.d.scene || 'intro') + ':' + this.i;
      if (CO.net && CO.net.isHost() && CO.net.inPlay) CO.net.bcast({ t: 'cut', key: this.scene.key, i: this.i });   // v5 online: the host turns the pages
    }
    // first press completes the typewriter line, the next press advances
    press() { if (this.leaving) return; if (this.ch < this.full.length) { this.ch = this.full.length; this.sub.setText(this.full); this.doneAt = performance.now(); this.fresh.relock(150); } else this.next(); }
    go() {
      if (this.leaving) return; this.leaving = true; CO.audio.sfx('bell'); this.cameras.main.fadeOut(400);
      this.time.delayedCall(420, () => { if (this.d.next) this.scene.start(this.d.next, this.d.data); else { CO.save.markIntro(); if (CO.save.progress().unlocked > 1) this.scene.start('StageSelect'); else CO.startStage(this, 's1', { back: 'Title' }); } });
    }
    panelTo(i) { if (i === this.i) return; this.i = i - 1; this.next(); }
    update(t) {
      const I = CO.menuInput.update(); this.fresh.poll(I);
      if (CO.net && CO.net.isClient() && CO.net.inPlay) { if (this.ch < this.full.length) { this.ch += 1.2; this.sub.setText(this.full.slice(0, Math.floor(this.ch))); } this.hint.setText('Host controls the story ▶'); return; }
      if (this.ch < this.full.length) { this.ch += CO.params.speed > 1 ? 99 : 1.2; this.sub.setText(this.full.slice(0, Math.floor(this.ch))); if (this.ch >= this.full.length) this.doneAt = performance.now(); }
      if (!this.leaving && this.fresh.ok) { if (I.p.back) return this.go(); if (I.p.confirm) this.press(); }
      if (!this.leaving && this.ch >= this.full.length && this.doneAt && performance.now() - this.doneAt > (CO.params.speed > 1 ? 150 : 3200) && this.fresh.ok) this.next();
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
      const resume = () => { this.scene.stop(); this.scene.resume('Game'); this.scene.resume('HUD'); this.scene.resume('Ambient'); const g = this.scene.get('Game'); g.syncInput(); };
      const cl = CO.net && CO.net.isClient();
      this.menu = new Menu(this, 640, 260, cl ? [
        { label: 'RESUME', cb: resume },
        { label: 'SETTINGS', cb: () => { this.scene.pause(); this.scene.launch('Settings', { from: 'Pause' }); } },
        { label: 'LEAVE ONLINE GAME', cb: () => { this.scene.stop(); this.scene.get('Game').quit(); } },
      ] : [
        { label: 'RESUME', cb: resume },
        { label: 'RESTART STAGE', cb: () => { this.scene.stop(); const g = this.scene.get('Game'); g.restart(Object.assign({}, g.data0, { checkpoint: null, continues: 0, stats: null })); } },
        { label: 'SETTINGS', cb: () => { this.scene.pause(); this.scene.launch('Settings', { from: 'Pause' }); } },
        { label: 'QUIT TO TITLE', cb: () => { this.scene.stop(); this.scene.get('Game').quit(); } },
      ], { w: 420, align: 'center', onBack: resume });
      if (cl) this.add.text(640, 520, 'Online: the game keeps running for everyone while you are here.', CO.style(18, '#9aa7c7')).setOrigin(0.5);
      const tc = CO.touchOn();
      this.add.text(640, 600, tc ? 'Touch: left stick to move · ATK / HVY / JUMP / DASH · skill icons · CLOCK OUT when the gold bar is full'
        : 'Move ' + ['up', 'left', 'down', 'right'].map(a => CO.keyName(CO.binds.keys(0, a)[0])).join('') + ' · Light ' + CO.keyLabel(0, 'light') + ' · Heavy ' + CO.keyLabel(0, 'heavy') + ' (hold to charge) · Jump ' + CO.keyLabel(0, 'jump') + ' · Dash ' + CO.keyLabel(0, 'dash') + '\nSkills ' + ['s1', 's2', 's3'].map(a => CO.keyLabel(0, a)).join(' / ') + ' · Clock Out ' + CO.keyLabel(0, 'ult') + ' · Pause ' + CO.keyLabel(0, 'pause') + '   —   change keys: TITLE → CONTROLS', CO.style(17, '#9aa7c7', { align: 'center' })).setOrigin(0.5);
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
      const t = this.add.text(640, 190, data.win ? 'BOSS RUSH CLEARED!\nYOU CLOCKED OUT OF ALL 100.' : surv ? 'SURVIVAL OVER.\nTHE OFFICE WINS... THIS TIME.' : "YOU'VE BEEN ASSIGNED\nTO THE WEEKEND SHIFT.", CO.style(56, '#ff8a3d', { align: 'center' })).setOrigin(0.5).setScale(0.5).setAlpha(0);
      this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 400, ease: 'Back.out' });
      const g = this.scene.get('Game');
      if (surv) {
        const mm = Math.floor(R.sec / 60), ss = Math.floor(R.sec % 60);
        if (data.win) t.setColor('#ffd34d');
        const L = R.level || R.wave, cp = Math.max(1, Math.floor((L - 1) / 10) * 10 + 1);
        this.add.text(640, 300, (data.win ? 'LEVEL 100 · BOSS RUSH' : 'Level ' + L + '/100') + '  ·  ' + mm + ':' + String(ss).padStart(2, '0') + ' survived  ·  ' + R.score.toLocaleString() + ' pts', CO.style(26, '#ffffff')).setOrigin(0.5);
        this.add.text(640, 340, R.best.isNew ? '★ NEW PERSONAL BEST! ★' : 'Best: ' + R.best.score.toLocaleString() + ' pts  ·  highest level ' + CO.save.survLevel().max, CO.style(24, R.best.isNew ? '#ffd34d' : '#cfe8ff')).setOrigin(0.5);
        this.menu = new Menu(this, 640, 430, [
          ...(data.win || CO.net && CO.net.isClient() ? [] : [{ label: 'RETRY FROM LEVEL ' + cp, cb: () => { this.scene.stop(); const d = Object.assign({}, g.data0, { checkpoint: null, continues: 0, stats: null, level: cp, stage: CO.survArenaFor(cp), score: 0, hpf: null }); if (CO.net && CO.net.isHost()) CO.net.hostCmd('restart', d); g.restart(d); } }]),
          { label: data.win ? 'PLAY AGAIN FROM LEVEL 1' : 'RESTART AT LEVEL 1', disabled: !!(CO.net && CO.net.isClient()), cb: () => { this.scene.stop(); const d = Object.assign({}, g.data0, { checkpoint: null, continues: 0, stats: null, level: 1, stage: CO.survArenaFor(1), score: 0, hpf: null }); if (CO.net && CO.net.isHost()) CO.net.hostCmd('restart', d); g.restart(d); } },
          { label: 'QUIT TO TITLE', cb: () => { this.scene.stop(); g.quit(); } },
        ], { w: 380, align: 'center' });
        return;
      }
      const S = CO.STAGES[data.stage];
      this.add.text(640, 300, data.checkpoint !== null && data.checkpoint !== undefined ? 'Retry from the last locked area of ' + S.name + '. (-1500 review points)' : 'Retry from the start of ' + S.name + '.', CO.style(22, '#cfe8ff')).setOrigin(0.5);
      this.add.text(640, 335, CO.story(CO.curChars).overLine + (CO.activePlayers > 1 ? '  (Whole team down.)' : ''), CO.style(22, '#ffd34d')).setOrigin(0.5);
      this.menu = new Menu(this, 640, 430, [
        ...(CO.net && CO.net.isClient() ? [{ label: 'WAITING FOR HOST…', disabled: true }] : []),
        { label: 'RETRY', disabled: !!(CO.net && CO.net.isClient()), cb: () => { this.scene.stop(); g.restart(Object.assign({}, g.data0, { checkpoint: data.checkpoint, continues: data.continues + 1, stats: data.stats })); } },
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
      const SE = CO.story(CO.curChars).ending, bg = this.add.image(640, 360, last ? (SE ? SE[SE.length - 1].img : 'bg_win') : S.bg).setDisplaySize(1280, 720);
      if (!last) { const sh = this.add.graphics(); sh.fillStyle(0x000000, 0.45); sh.fillRect(0, 0, 1280, 720); }
      this.tweens.add({ targets: bg, scale: bg.scale * 1.05, duration: 12000 });
      this.cameras.main.fadeIn(500, 255, 255, 255);
      const SY = CO.story(CO.curChars), off = SY.clockOff || 0, dm = r.clockH * 60 + r.clockM + off, late = !r.onTime, hm = Math.floor(dm / 60) % 12 + ':' + String(dm % 60).padStart(2, '0') + ' PM';
      const sd = SY.stages[S.id] || {}, coop = CO.activePlayers > 1, H = SY.endHead[late ? 0 : 1];
      const head = this.add.text(40, 40, last ? (coop ? H.replace(/^(SHE|HE) MADE/, 'THEY MADE').replace(/\. (SHE|HE) MADE/, '. THEY MADE') : H) : 'STAGE ' + S.num + ' CLEAR — ' + (sd.sub || S.name), CO.style(44, '#ffd34d', { wordWrap: { width: 1200 } })).setAlpha(0);
      const xt = last && coop ? CO.storyExtras(CO.curChars).map(c => CO.STORIES[c].coopEnd).filter(Boolean).join('  ') : '';
      const sub = this.add.text(40, 96, last ? SY.endSub(hm, late, this.spare(r)) + (xt ? '\n' + xt : '')
        : (sd.clear || S.clear) + '\nIt is ' + hm + '. ' + (late ? SY.lateMsg : this.spare(r) + ' ' + SY.until), CO.style(22, '#ffffff', { wordWrap: { width: 780 } })).setAlpha(0);
      this.tweens.add({ targets: [head, sub], alpha: 1, duration: 500, delay: 300 });
      // confetti
      for (let i = 0; i < 60; i++) { const c = this.add.image(Phaser.Math.Between(0, 1280), -20 - Math.random() * 600, Math.random() < 0.5 ? 'p_star' : 'p_paper').setScale(0.5 + Math.random() * 0.6).setTint([0xff8fc8, 0x6fd3ff, 0xffd34d, 0x8ee35a, 0xffffff][i % 5]);
        this.tweens.add({ targets: c, y: 760, x: c.x + Phaser.Math.Between(-120, 120), angle: Phaser.Math.Between(-400, 400), duration: Phaser.Math.Between(3500, 7000), repeat: -1, delay: Math.random() * 2000 }); }
      this.time.delayedCall(r.quick ? 50 : 1800, () => this.review());
      CO.menuInput.update();
    }
    next(id) { CO.startStage(this, id, { stats: null, pre: false }); }
    spare(r) { const m = 20 * 60 - (r.clockH * 60 + r.clockM);   // deadline-relative, so it holds for every story (display offset cancels)
      return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min'; }
    review() {
      const r = this.r, X = 880, Y = 150;
      const g = this.add.graphics(); g.fillStyle(0xfdfbf3, 0.97); g.fillRoundedRect(X - 20, Y - 10, 400, 520, 8); g.lineStyle(4, 0x1b2a6b); g.strokeRoundedRect(X - 20, Y - 10, 400, 520, 8);
      const panel = this.add.container(0, 0, [g]);
      const ink = (x, y, s, size = 22, col = '#1b2a6b', o = {}) => { const t = this.add.text(x, y, s, Object.assign({ fontFamily: '"Courier New", monospace', fontSize: size + 'px', color: col, fontStyle: 'bold' }, o)); panel.add(t); return t; };
      ink(X, Y + 4, 'PERFORMANCE REVIEW', 28); ink(X, Y + 40, (CO.lastChars || ['LEMON']).join(' + ') + '  ·  ' + (this.S.num ? 'S' + this.S.num + ' ' : '') + this.S.name, 17, '#55606e');
      const mm = Math.floor(r.sec / 60), ss = Math.floor(r.sec % 60);
      const rows = [['Time on the clock', mm + ':' + String(ss).padStart(2, '0'), r.time], ['Longest combo', r.stats.maxCombo + ' hits', r.combo], ['Damage taken', Math.round(r.stats.dmgTaken) + ' HP', r.dmg], ['Coworkers filed', r.stats.kos + '', r.ko], ['Overtime / ults', (r.stats.overtimes || 0) + ' / ' + (r.stats.ults || 0), null], ['Continues', r.continues + '', r.continues ? -1500 * r.continues : null]];
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
        const cl = CO.net && CO.net.isClient() && CO.net.inPlay;
        if (cl) items.push({ label: 'WAITING FOR HOST…', disabled: true });
        if (nxt) items.push({ label: 'NEXT: ' + CO.STAGES[nxt].name, disabled: cl, cb: () => this.next(nxt) });
        if (CO.net && CO.net.isHost() && CO.net.inPlay) items.push({ label: 'BACK TO LOBBY', cb: () => { this.scene.start('StageSelect'); } });
        else if (!cl) items.push({ label: 'STAGE SELECT', cb: () => { this.scene.start('StageSelect'); } });
        items.push({ label: cl ? 'LEAVE ONLINE GAME' : 'BACK TO TITLE', cb: () => { this.scene.start('Title'); } });
        this.menu = new Menu(this, 230, nxt ? 520 : 560, items, { w: 360 });
        window.__resultShown = r.stage;
        if (CO.params.chain && nxt) this.time.delayedCall(300, () => this.next(nxt));
      });
    }
    update() { if (this.menu) this.menu.update(); }
  }

  // ---------- v5 Survival level select: any level reached, or jump by checkpoints (every 10) ----------
  class SurvSelect extends Phaser.Scene {
    constructor() { super('SurvSelect'); }
    create(d) {
      d = this.d = d || {}; const SL = CO.save.survLevel(); this.max = Math.max(1, Math.min(100, SL.max)); this.L = Phaser.Math.Clamp(d.level || this.max, 1, this.max);
      this.add.rectangle(640, 360, 1280, 720, 0x0b0f1e); if (this.textures.exists('bg_title')) this.add.image(640, 360, 'bg_title').setDisplaySize(1280, 720).setAlpha(0.25);
      this.add.text(60, 40, 'SURVIVAL — LEVEL SELECT', CO.style(42, '#ffd34d'));
      this.add.text(60, 96, 'Highest level reached: ' + this.max + (SL.won ? '   ·   BOSS RUSH CLEARED ★' : '') + '   ·   ' + CO.sel.chars.map(c => CO.CHARACTERS[c].name).join(' + '), CO.style(18, '#cfe8ff'));
      const ROT = ['MICROMANAGER', 'MUZAK', 'HR DIRECTOR', 'PRINTER BOSS', 'LANDLORD', 'CEO'];
      this.info = this.add.text(700, 200, '', CO.style(22, '#ffffff')).setWordWrapWidth(520);
      const cps = () => { const a = [1]; for (let k = 10; k <= this.max; k += 10) a.push(k); return a; };
      const items = [
        { label: () => 'LEVEL  ◀ ' + this.L + ' ▶', size: 28, adjust: dd => { this.L = Phaser.Math.Clamp(this.L + dd, 1, this.max); }, cb: () => this.start() },
        { label: () => 'CHECKPOINT  ◀ ' + this.L + ' ▶', sub: '(steps of 10)', size: 24, adjust: dd => { const c = cps(); let i = c.findIndex(v => v >= this.L); if (i < 0) i = c.length - 1; if (dd > 0) i = c[i] > this.L ? i : i + 1; else i = i - 1; this.L = c[Phaser.Math.Clamp(i, 0, c.length - 1)]; }, cb: () => this.start() },
        { label: 'START', size: 28, cb: () => this.start() },
        { label: 'BACK', size: 22, cb: () => this.back() },
      ];
      this.menu = new Menu(this, 300, 220, items, { w: 440, h: 54, gap: 12, onBack: () => this.back() });
      this.rot = ROT; this.fresh = new CO.Fresh(this, 150); this.cameras.main.fadeIn(250); window.__survSel = this;
    }
    plan(L) {
      if (L >= 100) return 'LEVEL 100 — THE BOSS RUSH. Every boss back to back, a refill between each. Clear it to clock out for good.';
      const st = CO.STAGES[CO.survArenaFor(L)], boss = L % 10 === 0 ? this.rot[(L / 10 - 1) % this.rot.length] : null;
      return 'LEVEL ' + L + '\nArena: ' + (st.arenaName || st.name) + '\n' + (boss ? 'BOSS: ' + boss : 'Next boss: level ' + (Math.ceil(L / 10) * 10)) + '\n\nBreaks between levels heal you a little and drop an item.' + (CO.sel.chars.length > 1 ? '\nCo-op: enemy HP and numbers scale with ' + CO.sel.chars.length + ' players.' : '');
    }
    start() {
      if (this.leaving) return; this.leaving = true; const L = this.L, stage = CO.survArenaFor(L);
      this.cameras.main.fadeOut(220);
      this.time.delayedCall(240, () => CO.enterGame(this, 'Game', { stage, level: L }, { back: 'SurvSelect', label: 'Survival — Level ' + L + ' · ' + (CO.STAGES[stage].arenaName || '') }));
    }
    back() { if (this.leaving) return; this.leaving = true; this.scene.start('Title', { page: CO.sel.chars.length > 1 ? 'survcoop' : 'surv', quiet: true }); }
    update() { const I = CO.menuInput.intent; this.fresh.poll(I && I.h ? I : { h: {} }); if (this.fresh.ok) this.menu.update(); this.info.setText(this.plan(this.L)); }
  }

  CO.Scenes = { SurvSelect, Boot, Title, StageSelect, Settings, Intro, Cutscene, Pause, GameOver, Result };
})(window.CO);
