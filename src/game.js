// Clock Out! — Game scene (renders the Sim), HUD and touch controls.
(function (CO) {
  const STEP = 1000 / 60, F = () => window.FRAMES;
  const SCALE = { player: 1.0, enemy: 1.0, boss: 1.0 };
  const hex = c => '#' + c.toString(16).padStart(6, '0');

  class Game extends Phaser.Scene {
    constructor() { super('Game'); }
    // v3: story maps are WebP chunks in maps/maps_<id>.js, loaded per stage (script tag => works from file://)
    create(data) {
      data = data || {}; const id = data.stage || 'survival';
      this.sim = null;
      for (const k of Object.keys(this.textures.list)) if (k.indexOf('map_') === 0 && k.indexOf('map_' + id + '_') !== 0) this.textures.remove(k);   // drop the previous stage's chunks
      if (!CO.STAGES[id].len || this.textures.exists('map_' + id + '_n0')) return this.build(data);
      const t = this.add.text(640, 360, 'LOADING…', CO.style(30, '#ffffff')).setOrigin(0.5);
      const done = () => { t.destroy(); this.build(data); };
      const addImgs = () => {
        const D = window.MAPDATA && window.MAPDATA[id]; if (!D) { console.error('map data missing', id); return done(); }
        for (const k in D.img) this.load.image(k, D.img[k]);
        this.load.once('complete', done); this.load.start();
      };
      if (window.MAPDATA && window.MAPDATA[id]) return addImgs();
      const sc = document.createElement('script'); sc.src = 'maps/maps_' + id + '.js'; sc.onload = () => addImgs(); sc.onerror = () => { console.error('map script failed', id); done(); }; document.head.appendChild(sc);   // plain <script>: works on file:// (XHR does not)
    }
    // v4.2: BACKGROUND -> WALL -> FLOOR -> actors -> FOREGROUND. v4.1: layered maps. BACKGROUND = one wide unique image (sky, skyline, single moon) at parallax F;
    // PLAYFIELD = alpha WebP chunks scrolling 1:1 (transparent windows/sky); FOREGROUND = thin rain on the street (High fx only)
    buildMap(id, W) {
      const D = window.MAPDATA[id], M = D.meta;
      if (M.bg) this.add.image(0, 0, M.bg.k).setOrigin(0).setScrollFactor(M.bg.F, 0).setDepth(-30);
      if (M.sky) this.add.image(0, 0, M.sky.k).setOrigin(0).setScrollFactor(M.sky.F, 0).setDepth(-30);
      for (const c of (M.far || [])) this.add.image(c.x, M.farY || 0, c.k).setOrigin(0).setScrollFactor(M.F, 0).setDepth(-20);
      for (const c of (M.near || [])) this.add.image(c.x, 0, c.k).setOrigin(0).setDepth(0);
      // v4.2: WALL/BUILDING layer (back walls, frames, doors, shopfronts; transparent windows) and FLOOR layer, both 1:1 so the wall base never slides
      this.mapWall = (M.wall || []).map(c => this.add.image(c.x, c.y, c.k).setOrigin(0).setDepth(-10));
      this.mapFloor = (M.floor || []).map(c => this.add.image(c.x, c.y, c.k).setOrigin(0).setDepth(-5));
      this.fgRain = null;
      if (id === 's7' && this.fxHigh) {
        if (!this.textures.exists('fg_rain')) {
          const g = this.make.graphics({ x: 0, y: 0, add: false }), r = new Phaser.Math.RandomDataGenerator(['rain41']);
          for (let i = 0; i < 70; i++) {   // seamless: every streak wrapped inside the 256x256 tile
            const x = r.between(0, 255), y = r.between(0, 255), l = r.between(18, 46), a = r.realInRange(0.25, 0.7);
            g.lineStyle(1, 0xcfe0ff, a);
            for (const dx of [0, -256, 256]) for (const dy of [0, -256, 256]) g.lineBetween(x + dx, y + dy, x + dx - l * 0.18, y + dy + l);
          }
          g.generateTexture('fg_rain', 256, 256); g.destroy();
        }
        this.fgRain = this.add.tileSprite(0, 0, 1280, 720, 'fg_rain').setOrigin(0).setScrollFactor(0).setDepth(3800).setAlpha(0.18);
      }
    }
    build(data) {
      data = this.data0 = data || {};
      const stageId = data.stage || 'survival', S = this.S = CO.STAGES[stageId];
      this.mode = S.len ? 'story' : 'survival'; this.L = CO.LIGHT[S.light] || CO.LIGHT.arena; this.fxHigh = CO.fxHigh();
      let cp = data.checkpoint; if (cp === undefined && CO.params.boss && S.encounters) cp = S.encounters.length - 1;
      this.sim = new CO.Sim({ seed: CO.params.seed || ((Math.random() * 1e9) | 0), stage: stageId, mode: this.mode, checkpoint: cp, continues: data.continues || 0, stats: data.stats, god: CO.params.god, clock: Math.max(S.clock || 0, data.clock || 0), score: data.score });
      // players: P1 = keyboard/pad/touch (or bot in tests); extra slots (debug ?players=N) = CPU bots
      const chars = data.chars || (CO.params.chars && CO.params.chars.length ? CO.params.chars : null) || [CO.params.char || 'lemon'];
      const n = Phaser.Math.Clamp(Math.max(CO.params.players || 1, chars.length), 1, CO.MAX_PLAYERS); this.inputs = []; CO.activePlayers = n;
      for (let k = 0; k < n; k++) {
        this.sim.addPlayer(chars[k] || ['lemon', 'weisheng', 'keith'][k % 3], k);
        this.inputs.push(CO.Input.forSlot(k, { bot: k === 0 ? CO.params.bot : !!(CO.params.bot || CO.params.cpu), getSim: () => this.sim }));
      }
      CO.lastChars = this.sim.players.map(p => p.char.name);
      const W = this.sim.world;
      if (this.sim.scroll) {   // v3: unique (never mirrored) chunked map + parallax sky/skyline
        this.buildMap(stageId, W);
        this.drawExit(S);
      } else this.add.image(0, 0, S.bg).setOrigin(0).setDisplaySize(W.w, W.h).setDepth(0);
      this.buildDoors(S, stageId, W);
      const cam = this.cameras.main; cam.setBounds(0, 0, W.w, W.h); cam.setBackgroundColor('#0b0f1e');
      this.charScale = 1;   // v4: Lemon is already drawn +26%
      this.fx = new CO.FX(this); this.views = new Map(); this.projViews = new Map(); this.pickViews = new Map(); this.bubbles = [];
      this.hazG = this.add.graphics().setDepth(4); this.hazT = [];
      this.zoneG = this.add.graphics().setDepth(1.1); this.zoneTop = this.add.graphics().setDepth(3900); this.laserG = this.add.graphics().setDepth(3950);
      this.acc = 0; this.ended = false; this.lastHitSfx = 0; this.pend = this.inputs.map(() => ({}));
      const p = this.sim.players[0]; cam.centerOn(p.x, p.y - 80);
      CO.audio.play(S.music || 'stage'); CO.audio.setIntensity(0);
      this.textGate = {};
      this.scene.launch('Ambient'); this.scene.launch('HUD'); this.scene.launch('Touch');
      this.scene.bringToTop('Ambient'); this.scene.bringToTop('HUD'); this.scene.bringToTop('Touch');
      this.syncInput();
      this.cameras.main.fadeIn(300);
      window.__sim = this.sim; window.__gameScene = this;
      this.fpsLog = [];
    }
    // v4.3: lift doors as layers. Everything a body can pass BEHIND (near pillar/jambs, header, sliding panels) is cut out of the
    // plate into its own image with depth = the door's threshold y; the opening/cab interior stays behind every actor.
    cutPlate(stageId, x, y, w, h) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
      if (this.sim.scroll) {
        const M = window.MAPDATA[stageId].meta;
        for (const ch of (M.wall || []).concat(M.floor || [])) { const im = this.textures.get(ch.k).getSourceImage(); if (ch.x < x + w && ch.x + im.width > x && ch.y < y + h && ch.y + im.height > y) c.drawImage(im, ch.x - x, ch.y - y); }
      } else { const im = this.textures.get(this.S.bg).getSourceImage(), k = im.width / this.sim.world.w; c.drawImage(im, x * k, y * k, w * k, h * k, 0, 0, w, h); }
      return cv;
    }
    addCut(key, cv) { if (this.textures.exists(key)) this.textures.remove(key); this.textures.addCanvas(key, cv); return key; }
    buildDoors(S, stageId) {
      this.liftPanels = null; const D = S.door;
      if (D) {   // open side door: near pillar + header in front of anyone inside the doorway
        const dep = D.y + (D.pil[0] - D.x0) * D.k + 2;
        for (const [nm, r] of [['pil', D.pil], ['hdr', D.hdr]]) this.add.image(r[0], r[2], this.addCut('door43_' + stageId + nm, this.cutPlate(stageId, r[0], r[2], r[1] - r[0], r[3] - r[2]))).setOrigin(0).setDepth(dep);
      }
      const L = S.lobbyLift; if (!L) return;
      const fw = L.fx1 - L.fx0, fh = L.th + 4 - L.ftop, ox = L.x0 - L.fx0, oy = L.top - L.ftop, ow = L.x1 - L.x0, oh = L.th - L.top, hw = ow / 2;
      const full = this.cutPlate(stageId, L.fx0, L.ftop, fw, fh);
      const frame = document.createElement('canvas'); frame.width = fw; frame.height = fh; const fc = frame.getContext('2d'); fc.drawImage(full, 0, 0); fc.clearRect(ox, oy, ow, oh + 6);
      const pan = i => { const cv = document.createElement('canvas'); cv.width = hw; cv.height = oh; cv.getContext('2d').drawImage(full, ox + i * hw, oy, hw, oh, 0, 0, hw, oh); return cv; };
      const cab = document.createElement('canvas'); cab.width = ow; cab.height = oh; const g = cab.getContext('2d');   // the cab behind the doors (code-drawn, lit)
      let gr = g.createLinearGradient(0, 0, 0, oh); gr.addColorStop(0, '#5b5f66'); gr.addColorStop(0.62, '#8a8d91'); gr.addColorStop(0.63, '#3d342b'); gr.addColorStop(1, '#6b5a47'); g.fillStyle = gr; g.fillRect(0, 0, ow, oh);
      const bw = ow * 0.56, bx = (ow - bw) / 2, bh = oh * 0.62;   // back wall + perspective side walls
      gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#9da2a8'); gr.addColorStop(0.5, '#c9cdd1'); gr.addColorStop(1, '#9da2a8'); g.fillStyle = gr; g.fillRect(bx, oh * 0.1, bw, bh - oh * 0.1);
      g.fillStyle = 'rgba(30,30,36,0.35)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(bx, oh * 0.1); g.lineTo(bx, bh); g.lineTo(0, oh); g.fill(); g.beginPath(); g.moveTo(ow, 0); g.lineTo(bx + bw, oh * 0.1); g.lineTo(bx + bw, bh); g.lineTo(ow, oh); g.fill();
      g.fillStyle = 'rgba(255,240,205,0.9)'; g.fillRect(bx + 8, oh * 0.1 - 6, bw - 16, 5);   // ceiling light
      g.fillStyle = 'rgba(120,96,70,0.9)'; g.fillRect(bx, bh * 0.66, bw, 5); g.fillRect(0, bh * 0.7, bx * 0.9, 4); g.fillRect(bx + bw + bx * 0.1, bh * 0.7, bx * 0.9, 4);   // hand rails
      gr = g.createRadialGradient(ow / 2, oh * 0.15, 4, ow / 2, oh * 0.2, oh * 0.9); gr.addColorStop(0, 'rgba(255,236,190,0.35)'); gr.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, ow, oh);
      this.add.image(L.x0, L.top, this.addCut('lift43_cab', cab)).setOrigin(0).setDepth(-4);
      const P = [this.add.image(L.x0, L.top, this.addCut('lift43_pl', pan(0))).setOrigin(0).setDepth(L.th + 0.1), this.add.image(L.x0 + hw, L.top, this.addCut('lift43_pr', pan(1))).setOrigin(0).setDepth(L.th + 0.1)];
      this.add.image(L.fx0, L.ftop, this.addCut('lift43_frame', frame)).setOrigin(0).setDepth(L.th + 0.2);
      this.liftPanels = { P, L, hw, oh, k: 0 };
    }
    setLift(k) {
      const Q = this.liftPanels; if (!Q) return; Q.k = k; const s = Math.round(Q.hw * k), w = Math.max(0, Q.hw - s);
      Q.P[0].setX(Q.L.x0 - s).setCrop(s, 0, w, Q.oh).setVisible(w > 0); Q.P[1].setX(Q.L.x0 + Q.hw + s).setCrop(0, 0, w, Q.oh).setVisible(w > 0);
    }
    liftDoor(open) {
      const Q = this.liftPanels; if (!Q) return;
      Q.anim = { a: Q.k, b: open ? 1 : 0, f0: this.sim.frame };   // sim-frame driven (45 frames), so it stays in sync with the scripted walk
      CO.audio.sfx(open ? 'ding' : 'tick');
    }
    drawExit(S) {
      if (S.exit > S.len) return;
      if (S.lobbyLift && S.door) {   // v4.3: roof access is through the cab's open door
        this.exitSign = this.add.text(S.exit + 40, S.cab.y1 - 22, S.exitLabel + ' →', CO.style(26, '#7dff8a')).setOrigin(0.5).setDepth(1.5); return;
      }
      const x = S.exit + 40, y0 = S.band[0] - 10, g = this.add.graphics().setDepth(2);
      g.fillStyle(0x7dff8a, 0.10); g.fillRect(x - 70, y0 - 220, 140, S.band[1] - y0 + 220);
      g.lineStyle(4, 0x7dff8a, 0.7); g.strokeRect(x - 70, y0 - 220, 140, 220);
      this.exitSign = this.add.text(x, S.band[1] - 26, S.exitLabel + ' →', CO.style(26, '#7dff8a')).setOrigin(0.5).setDepth(1.5);  // v3.1: on the floor, no longer over door signs
      this.tweens.add({ targets: this.exitSign, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
    }
    gate(key, frames) { const f = this.sim.frame; if (this.textGate[key] && f - this.textGate[key] < frames) return false; this.textGate[key] = f; return true; }
    syncInput() { this.inputs.forEach(i => i.update()); this.pend = this.inputs.map(() => ({})); }
    stopOverlays() { this.scene.stop('Ambient'); this.scene.stop('HUD'); this.scene.stop('Touch'); }
    restart(d) { this.stopOverlays(); this.scene.restart(d); }
    quit() { this.stopOverlays(); this.scene.stop(); this.scene.start('Title'); }

    update(time, delta) {
      if (!this.sim) return;
      if (this.game.loop.actualFps) this.fpsLog.push(this.game.loop.actualFps);
      const intents = this.inputs.map(i => i.update());
      if (intents.some(it => it.p.pause) && !this.ended) { this.scene.pause(); this.scene.pause('HUD'); this.scene.pause('Ambient'); this.scene.launch('Pause'); this.scene.bringToTop('Pause'); return; }
      // collect presses so a frame with 0 sim steps doesn't lose them
      intents.forEach((it, k) => { for (const a in it.p) this.pend[k][a] = true; });
      let steps;
      if (CO.params.speed > 1) steps = CO.params.speed;
      else { this.acc += Math.min(delta, 100); steps = Math.floor(this.acc / STEP); this.acc -= steps * STEP; }
      if (window.__fs !== undefined) { steps = window.__fs > 0 ? 1 : 0; if (steps) window.__fs--; }   // test hook: frame-exact capture
      for (let s = 0; s < steps; s++) {
        if (this.sim.slowmo > 0 && (this.sim.frame + s) % 3 !== 0 && CO.params.speed === 1) { this.sim.slowmo--; continue; }
        const its = intents.map((it, k) => ({ mx: it.mx, my: it.my, h: it.h, p: this.pend[k] }));
        this.pend = intents.map(() => ({}));
        this.sim.step(its);
        for (const e of this.sim.events) this.onEvent(e);
        if (this.ended) break;
      }
      CO.audio.setIntensity(this.sim.players.some(p => p.overtime) ? 1 : 0);
      { const Q = this.liftPanels; if (Q && Q.anim) { const u = Math.min(1, (this.sim.frame - Q.anim.f0) / 45), e = 0.5 - Math.cos(u * Math.PI) / 2; this.setLift(Q.anim.a + (Q.anim.b - Q.anim.a) * e); if (u >= 1) Q.anim = null; } }
      this.perfWatch(delta);
      this.render(delta / 1000);
    }

    // auto effects quality: if the frame rate stays low for ~3 s on 'auto', drop to Low (remembered for the session)
    perfWatch(delta) {
      if (!this.fxHigh || (CO.settings.fx || 'auto') !== 'auto' || CO.fxAutoLow) return;
      this.slowT = (this.slowT || 0) + (delta > 28 ? delta : -delta * 0.5); if (this.slowT < 0) this.slowT = 0;
      if (this.slowT > 3000) { CO.fxAutoLow = true; console.log('fx auto -> low'); this.restartFx(); }
    }
    // Settings → EFFECTS changed mid-run: rebuild the rim/reflection decorations (views re-create themselves) and the Ambient layer
    refreshFx() { const h = CO.fxHigh(); if (h === this.fxHigh) return; this.fxHigh = h; for (const v of this.views.values()) { for (const k of ['rim', 'rim2', 'refl', 'glow', 'tag', 'bar']) if (v[k]) v[k].destroy(); v.spr.destroy(); v.sh.destroy(); } this.views.clear(); }
    restartFx() { const am = this.scene.get('Ambient'); if (am && am.rebuild) am.rebuild(); this.fxHigh = false; for (const v of this.views.values()) { for (const k of ['rim', 'rim2', 'refl']) if (v[k]) { v[k].destroy(); v[k] = null; } } }

    // ---------------- rendering ----------------
    view(o, cat) {
      let v = this.views.get(o.id);
      if (!v) {
        v = { sh: this.add.image(o.x, o.y, 'shadow').setDepth(1), spr: this.add.image(o.x, o.y, o.pose), o, cat, seen: 0 };
        if (this.fxHigh) {   // High effects: per-stage rim light (tint-filled additive silhouette behind the sprite) + wet-floor reflection
          const L = this.L, A = Phaser.BlendModes.ADD;
          if (L.rim) v.rim = this.add.image(o.x, o.y, o.pose).setBlendMode(A).setTintFill(L.rim);
          if (L.rim2 && cat !== 'enemy') v.rim2 = this.add.image(o.x, o.y, o.pose).setBlendMode(A).setTintFill(L.rim2);
          if (L.refl >= 0.12) v.refl = this.add.image(o.x, o.y, o.pose).setDepth(1.2).setTint(0x9fb0d8);
        }
        if (cat === 'player' && this.sim.players.length > 1) { const k = this.sim.players.indexOf(o); v.tag = this.add.text(o.x, o.y, 'P' + (k + 1), CO.style(18, hex(CO.PLAYER_COLORS[k]), { stroke: '#0d1022', strokeThickness: 4 })).setOrigin(0.5).setDepth(3990); }
        if (cat === 'player') { v.glow = this.add.image(o.x, o.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(1.5).setVisible(false); }
        if (cat !== 'player') { v.bar = this.add.graphics().setDepth(4000); }
        this.views.set(o.id, v);
      }
      v.seen = this.frameNo; return v;
    }
    place(v, o, sc) {
      const fr = F()[o.pose] || F().idle; v.spr.setTexture(F()[o.pose] ? o.pose : 'idle');
      const flip = (o.face < 0) !== !!o.flip;
      sc *= this.charScale * (o.def && o.def.scale || 1);
      v.spr.setFlipX(flip).setOrigin(flip ? 1 - fr.ax : fr.ax, 1);
      const bob = (o.state === 'idle' || o.state === 'chase' && Math.abs(o.vx) < 5) ? Math.sin(this.time.now / 260 + o.id) * 0.012 : 0;
      // secondary motion: turn-around squash, run lean-in, landing squash
      if (v.face !== undefined && v.face !== o.face) v.turn = 1; v.face = o.face;
      v.turn = Math.max(0, (v.turn || 0) - 0.2);
      if (o.landed > 500 && !v.landT) v.landT = 8; o.landed = 0; v.landT = Math.max(0, (v.landT || 0) - 1);
      let sx = sc * (1 - 0.42 * Math.sin(v.turn * Math.PI / 2)), sy = sc * (1 + bob) * (1 + 0.04 * v.turn);
      if (v.landT) { const k = Math.sin(v.landT / 8 * Math.PI) * 0.08; sx *= 1 + k; sy *= 1 - k; }
      let rot = (o.rot || 0) * (o.face < 0 ? -1 : 1);
      // v3: run/skid/turn lean now comes from the art itself (real frames), no procedural rotation
      let fxo = 0, fyo = 0;   // v4.2: double-jump flip spins around the body centre, not the feet
      if (o.djT > 0 && o.state === 'air') { const hh = v.spr.displayHeight / 2, th = rot; fxo = -hh * Math.sin(th); fyo = -hh + hh * Math.cos(th); }
      v.spr.setPosition(o.x + fxo, o.y - o.z - (o.bob || 0) + fyo).setRotation(rot).setScale(sx, sy).setDepth(o.y + (o.kind === 'player' ? 0.5 : 0));
      v.fl = flip; v.sx = sx; v.sy = sy; v.rot = rot;
      const shs = (o.w / 50) * Math.max(0.45, 1 - o.z / 500) * (o.kind === 'boss' ? 2.4 : 1.6) * this.charScale;
      v.sh.setPosition(o.x, o.y).setScale(shs, shs * 0.9).setAlpha(Math.max(0.3, 1 - o.z / 600));
      if (o.flash > 0) { if (o.kind === 'boss') v.spr.setTint(0xfff0c0); else if ((o.flash | 0) % 4 < 2) v.spr.setTintFill(0xffffff); else v.spr.setTint(0xfff0b8); } else if (o.def && o.def.tint) v.spr.setTint(o.def.tint); else v.spr.clearTint();
    }
    // rim light + reflection follow the sprite (called after alpha/tint were set)
    deco(v) {
      const s = v.spr, o = v.o; if (!v.rim && !v.rim2 && !v.refl) return;
      const tex = s.texture.key, ox = s.originX, k = Math.max(0.6, v.sx) * 3.2;
      const dd = s.depth - 0.2, a = s.alpha * 0.75 * (o.flash > 0 ? 0.4 : 1);
      if (v.rim) v.rim.setTexture(tex).setOrigin(ox, 1).setFlipX(s.flipX).setPosition(s.x + k, s.y - 1).setRotation(s.rotation).setScale(v.sx, v.sy).setDepth(dd).setAlpha(a);
      if (v.rim2) v.rim2.setTexture(tex).setOrigin(ox, 1).setFlipX(s.flipX).setPosition(s.x - k, s.y - 1).setRotation(s.rotation).setScale(v.sx, v.sy).setDepth(dd).setAlpha(a * 0.8);
      if (v.refl) v.refl.setTexture(tex).setOrigin(ox, 1).setFlipX(s.flipX).setPosition(s.x, o.y + o.z).setRotation(-s.rotation).setScale(v.sx, -v.sy * 0.9).setAlpha(this.L.refl * s.alpha * (o.kind === 'boss' ? 0.8 : 1) * Math.max(0.2, 1 - o.z / 300));
    }
    // Keith: holo catgirl allies, laser-lure dots, Nine Lives shield bubbles, charm hearts, team ATK glow
    renderKeith(t) {
      const sim = this.sim, fx = this.fx; this.allyViews = this.allyViews || new Map(); this.lureViews = this.lureViews || new Map();
      if (!this.kG) this.kG = this.add.graphics();
      const seen = new Set();
      for (const a of sim.allies) {
        seen.add(a.id); let v = this.allyViews.get(a.id);
        if (!v) { v = { spr: this.add.image(a.x, a.y, 'kt_cat_' + a.flav), sh: this.add.image(a.x, a.y, 'shadow').setAlpha(0.35), glow: this.add.image(a.x, a.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xb48cff) }; this.allyViews.set(a.id, v); }
        const key = 'kt_cat_' + a.flav + (a.atkT > 0 ? '_atk' : ''), fr = CO.FRAMES && CO.FRAMES[key] || window.FRAMES && window.FRAMES[key] || { ax: 0.5 };
        const sc = this.charScale || 1, fl = a.face < 0;
        v.spr.setTexture(key).setFlipX(fl).setOrigin(fl ? 1 - fr.ax : fr.ax, 1).setScale(sc).setPosition(a.x, a.y - 6 - Math.abs(Math.sin(t / 180 + a.id)) * 6).setDepth(a.y + 0.3)
          .setAlpha((a.T < 60 && (a.T >> 2) % 2 ? 0.35 : 0.88) + Math.sin(t / 50 + a.id) * 0.06);
        v.sh.setPosition(a.x, a.y).setScale(0.9 * sc, 0.8 * sc).setDepth(a.y - 1);
        v.glow.setPosition(a.x, a.y - 60 * sc).setScale(1.3 * sc, 1.6 * sc).setAlpha(0.22 + Math.sin(t / 90) * 0.06).setDepth(a.y - 0.5);
        if (this.frameNo % 9 === 0) fx.burst('spark', a.x, a.y, 40 + Math.random() * 60, 1, 0.3);
      }
      for (const [id, v] of this.allyViews) if (!seen.has(id)) { fx.burst('paw', v.spr.x, v.spr.y, 60, 4, 0.7); v.spr.destroy(); v.sh.destroy(); v.glow.destroy(); this.allyViews.delete(id); }
      const seenL = new Set();
      for (const L of sim.lures) {
        seenL.add(L.id); let im = this.lureViews.get(L.id);
        if (!im) { im = this.add.image(L.x, L.y, 'laserdot').setBlendMode(Phaser.BlendModes.ADD); this.lureViews.set(L.id, im); }
        im.setPosition(L.x + Math.sin(t / 70) * 6, L.y - 4 + Math.cos(t / 90) * 3).setDepth(L.y + 1).setScale(1 + Math.sin(t / 60) * 0.15).setAlpha(L.T < 30 ? L.T / 30 : 1);
      }
      for (const [id, im] of this.lureViews) if (!seenL.has(id)) { im.destroy(); this.lureViews.delete(id); }
      const g = this.kG; g.clear(); g.setDepth(4500);
      for (const p of sim.players) {
        if (p.alive && p.shieldT > 0 && p.shield > 0) { g.lineStyle(4, 0xc58cff, 0.35 + 0.25 * Math.sin(t / 80)); g.strokeEllipse(p.x, p.y - p.z - 110, 170, 250); g.fillStyle(0xb48cff, 0.08); g.fillEllipse(p.x, p.y - p.z - 110, 170, 250); }
        if (p.alive && p.atkUpT > 0 && this.frameNo % 12 === 0) fx.burst('paw', p.x, p.y, 200, 1, 0.3);
      }
      for (const e of sim.enemies) if (e.charmT > 0 && this.frameNo % 20 === 0) fx.burst('heart', e.x, e.y, 170, 1, 0.6);
    }
    render(dt) {
      this.frameNo = (this.frameNo || 0) + 1;
      if (this.fgRain) { const c = this.cameras.main; this.fgRain.tilePositionX = c.scrollX * 1.35 - this.time.now * 0.12; this.fgRain.tilePositionY = -this.time.now * 0.9; }
      const sim = this.sim, t = this.time.now;
      for (const p of sim.players) {
        const v = this.view(p, 'player'); this.place(v, p, SCALE.player);
        if (p.flash > 0) v.spr.setTintFill(0xffffff); else if (p.buff > 0) v.spr.setTint(0xfff0c8); else if (p.slowT > 0) v.spr.setTint(0xbfdcff); else v.spr.clearTint();
        v.spr.setAlpha(p.iframes > 0 && p.state !== 'dash' && Math.floor(t / 60) % 2 ? 0.55 : 1);
        if (v.tag) v.tag.setPosition(p.x, p.y - p.z - 268 + Math.sin(t / 220) * 3).setAlpha(p.alive ? 1 : 0.4);
        v.glow.setVisible(p.overtime || p.charge >= 22 || p.buff > 0).setPosition(p.x, p.y - p.z - 70).setScale(p.overtime ? 2.4 : 1.8, p.overtime ? 2.6 : 2).setTint(p.overtime ? 0xffc83d : p.charge >= 22 ? 0xffffff : p.char.color || 0x9a6a3a).setAlpha(0.35 + Math.sin(t / 90) * 0.1);
        if (p.state === 'dash' && this.frameNo % 3 === 0) this.ghost(v.spr, p.char.color || 0x6fd3ff);
        if (p.overtime && this.frameNo % 6 === 0 && p.state === 'move') this.ghost(v.spr, 0xffc83d);
      }
      for (const e of sim.enemies) {
        const v = this.view(e, 'enemy'); this.place(v, e, SCALE.enemy); if (e.door && e.state === 'enter') { v.spr.setAlpha(Math.min(1, e.st / 16)); v.dA = 1; } else if (v.dA) { v.spr.setAlpha(1); v.dA = 0; }
        if (e.type === 'hr' && e.shieldDown > 0 && e.flash <= 0) v.spr.setTint(0xb8c4ff);
        v.bar.clear(); if (e.hp < e.maxhp) { const w = 70, x = e.x - w / 2, y = e.y - e.z - 158 * this.charScale; v.bar.fillStyle(0x000000, 0.6); v.bar.fillRect(x - 2, y - 2, w + 4, 9); v.bar.fillStyle(0x8ee35a); v.bar.fillRect(x, y, w * Math.max(0, e.hp / e.maxhp), 5); }
      }
      if (sim.boss) { const b = sim.boss, v = this.view(b, 'boss'); this.place(v, b, SCALE.boss); v.bar.clear(); if (b.state === 'dizzy') { for (let k = 0; k < 3; k++) { const a = t / 200 + k * 2.1; v.bar.fillStyle(0xffe14d); v.bar.fillCircle(b.x + Math.cos(a) * 50, b.y - 290 + Math.sin(a) * 12, 7); } } if (b.state === 'dead') v.spr.setAlpha(Math.max(0, 1 - b.st / 160));
        if (b.state === 'aura') { v.bar.lineStyle(6, 0xb36bff, 0.5 + Math.sin(t / 80) * 0.3); v.bar.strokeEllipse(b.x, b.y - 150, 300 + Math.sin(t / 120) * 20, 360); } }
      for (const [id, v] of this.views) if (v.seen !== this.frameNo) { v.spr.destroy(); v.sh.destroy(); v.bar && v.bar.destroy(); v.glow && v.glow.destroy(); v.tag && v.tag.destroy(); v.rim && v.rim.destroy(); v.rim2 && v.rim2.destroy(); v.refl && v.refl.destroy(); this.views.delete(id); }
      else this.deco(v);
      // projectiles
      const seenP = new Set();
      for (const q of sim.projs) {
        seenP.add(q.id); let im = this.projViews.get(q.id);
        if (!im) { const tk = q.kind === 'staple' ? 'staple' : q.kind === 'case' ? 'briefcase' : (q.tex && this.textures.exists(q.tex) ? q.tex : 'note'); im = this.add.image(q.x, q.y, tk); this.projViews.set(q.id, im); if (q.bolt) im.setBlendMode(Phaser.BlendModes.ADD); }
        im.setPosition(q.x, q.y - q.z).setDepth(q.y + 2);
        if (q.kind === 'staple') im.setRotation(Math.atan2(q.vy, q.vx) + Math.PI / 2);
        else if (q.kind === 'note' && q.ang !== undefined) im.setRotation(q.ang * (q.tex === 'bolt' || q.tex === 'pen' ? 1 : 0) + (q.tex === 'bolt' || q.tex === 'pen' ? 0 : im.rotation * 0 + (this.frameNo * 0.08)));
        else if (q.kind === 'pbolt') { im.setFlipX(q.vx < 0); if (this.frameNo % 2 === 0) this.fx.burst('spark', q.x, q.y, q.z, 1, 0.5); }
        else if (q.kind === 'homing') im.setRotation(q.ang + Math.PI / 2 * 0);
        else if (q.kind === 'eproj') im.rotation += 0.12;
        else im.rotation += q.kind === 'case' ? 0.5 : 0.2;
      }
      for (const [id, im] of this.projViews) if (!seenP.has(id)) { im.destroy(); this.projViews.delete(id); }
      this.renderKeith(t);
      const seenK = new Set();
      for (const k of sim.pickups) { seenK.add(k.id); let im = this.pickViews.get(k.id); if (!im) { im = this.add.image(k.x, k.y, k.type); this.pickViews.set(k.id, im); } im.setPosition(k.x, k.y - 20 - Math.abs(Math.sin(k.t / 12)) * 14).setDepth(k.y).setAlpha(k.t > 780 && k.t % 10 < 5 ? 0.3 : 1); }
      for (const [id, im] of this.pickViews) if (!seenK.has(id)) { im.destroy(); this.pickViews.delete(id); }
      // hazards: deadline circles
      const g = this.hazG; g.clear(); this.hazT.forEach(x => x.setVisible(false)); let hi = 0;
      for (const h of sim.hazards) {
        if (h.kind === 'wave') {   // Mr. Muzak / Landlord shock ring: telegraph, then an expanding band you must jump
          const ry = h.r * 2 / 1.5;
          if (h.t < h.T) { const kk = h.t / h.T; g.lineStyle(5, 0xffe27a, 0.45 + 0.4 * Math.sin(h.t * 0.5)); g.strokeEllipse(h.x, h.y, h.r * 2, ry); g.fillStyle(0xffc83d, 0.10 + 0.1 * kk); g.fillEllipse(h.x, h.y, h.r * 2, ry);
            let tx = this.hazT[hi]; if (!tx) { tx = this.add.text(0, 0, '', CO.style(20, '#ffffff')).setOrigin(0.5).setDepth(4001); this.hazT.push(tx); } tx.setVisible(true).setPosition(h.x, h.y - 30).setText(h.label + ' · JUMP!'); hi++; }
          else { const kk = (h.t - h.T) / h.ex, rr = h.r * kk; g.lineStyle(26 * (1 - kk) + 6, 0xffe27a, 0.35 * (1 - kk)); g.strokeEllipse(h.x, h.y, rr * 2, rr * 2 / 1.5); g.lineStyle(7 * (1 - kk) + 2, 0xffffff, 0.9 * (1 - kk)); g.strokeEllipse(h.x, h.y, rr * 2, rr * 2 / 1.5); }
          continue;
        }
        const k = Math.min(1, h.t / h.T);
        g.fillStyle(0xff9a2e, 0.18); g.fillEllipse(h.x, h.y, h.r * 2, h.r * 1.1);
        g.fillStyle(0xffc83d, 0.35); g.fillEllipse(h.x, h.y, h.r * 2 * k, h.r * 1.1 * k);
        g.lineStyle(3, 0xffd34d, 0.9); g.strokeEllipse(h.x, h.y, h.r * 2, h.r * 1.1);
        let tx = this.hazT[hi]; if (!tx) { tx = this.add.text(0, 0, '', CO.style(18, '#ffffff')).setOrigin(0.5).setDepth(4001); this.hazT.push(tx); }
        tx.setVisible(true).setPosition(h.x, h.y).setText((h.label || 'DUE') + ' ' + Math.max(0, Math.ceil((h.T - h.t) / 60 * 10) / 10).toFixed(1) + 's'); hi++;
      }
      // zones (coffee puddles, soap, smoke clouds, skid marks, luggage carts) + sniper laser lines
      const zg = this.zoneG, zt = this.zoneTop; zg.clear(); zt.clear(); const tm = this.time.now;
      for (const z of sim.zones) {
        const left = z.T - z.t, fade = Math.min(1, left / 40, z.t / 8 + 0.2), ry = z.r * 1.1;
        if (z.kind === 'coffee') { zg.fillStyle(0x4b2a14, 0.55 * fade); zg.fillEllipse(z.x, z.y, z.r * 2, ry); zg.fillStyle(0x8a5a30, 0.35 * fade); zg.fillEllipse(z.x - z.r * 0.1, z.y - 4, z.r * 1.4, ry * 0.6); zg.fillStyle(0xffffff, 0.18 * fade); zg.fillEllipse(z.x - z.r * 0.3, z.y - 8, z.r * 0.4, ry * 0.18); }
        else if (z.kind === 'soap') { zg.fillStyle(0x9fe0f0, 0.32 * fade); zg.fillEllipse(z.x, z.y, z.r * 2, ry); zg.lineStyle(3, 0xffffff, 0.5 * fade); zg.strokeEllipse(z.x, z.y, z.r * 1.8, ry * 0.9);
          for (let k = 0; k < 6; k++) { const a = z.id * 7 + k * 1.9 + tm / 1400, r = z.r * (0.2 + 0.6 * ((k * 0.37) % 1)); zg.lineStyle(2, 0xffffff, 0.7 * fade); zg.strokeCircle(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * 0.5 - 6 - ((tm / 40 + k * 9) % 18), 4 + k % 3); } }
        else if (z.kind === 'smoke') { for (let k = 0; k < 7; k++) { const a = z.id + k * 0.9 + tm / 1900 * (k % 2 ? 1 : -1), r = z.r * (0.25 + 0.45 * ((k * 0.31) % 1)); zt.fillStyle(0x9aa0aa, 0.30 * fade); zt.fillCircle(z.x + Math.cos(a) * r, z.y - 50 + Math.sin(a) * r * 0.45 - 30 * ((k * 0.17) % 1), z.r * 0.4 + 6 * Math.sin(tm / 400 + k)); } zg.fillStyle(0x6a707a, 0.25 * fade); zg.fillEllipse(z.x, z.y, z.r * 2, ry); }
        else if (z.kind === 'skid') { zg.fillStyle(0x161a24, 0.5 * fade); zg.fillEllipse(z.x, z.y, z.r * 1.8, ry * 0.35); }
        else if (z.kind === 'cart') { zg.fillStyle(0x000000, 0.3 * fade); zg.fillEllipse(z.x, z.y + 6, z.r * 2.1, ry * 0.7); zg.lineStyle(5, 0xc8a24a, fade); zg.strokeRect(z.x - z.r * 0.8, z.y - 38, z.r * 1.6, 34); zg.lineStyle(2, 0xe8d08a, 0.8 * fade); for (let k = 1; k < 5; k++) zg.lineBetween(z.x - z.r * 0.8 + k * z.r * 0.32, z.y - 38, z.x - z.r * 0.8 + k * z.r * 0.32, z.y - 4); zg.fillStyle(0x222633, fade); zg.fillCircle(z.x - z.r * 0.6, z.y, 6); zg.fillCircle(z.x + z.r * 0.6, z.y, 6); }
      }
      const lg = this.laserG; lg.clear();
      for (const e of sim.enemies) if (e.aim && e.state !== 'dead') { const ex = e.x + e.face * 50, ey = e.y - 100, ax = e.aim.x, ay = e.aim.y - 60, tw = 0.5 + 0.5 * Math.sin(tm / 40); lg.lineStyle(2 + tw * 2, 0x4fe6ff, 0.35 + 0.4 * tw); lg.lineBetween(ex, ey, ax, ay); lg.fillStyle(0xffffff, 0.8); lg.fillCircle(ax, ay, 5); }
      // bubbles
      for (let i = this.bubbles.length - 1; i >= 0; i--) {
        const b = this.bubbles[i]; b.life--;
        const o = b.id ? (sim.enemies.find(e => e.id === b.id) || (sim.boss && sim.boss.id === b.id ? sim.boss : null)) : null;
        if (o) { b.x = o.x; b.y = o.y - o.z; }
        b.t.setPosition(b.x, b.y - b.z).setAlpha(b.life < 15 ? b.life / 15 : 1);
        if (b.life <= 0) { b.t.destroy(); this.bubbles.splice(i, 1); }
      }
      this.fx.update(1 / 60);
      this.updateCamera();
    }
    // Camera: follows the centroid of living players and zooms out to fit up to 5 of them.
    // Story: locks to the encounter screen; never scrolls back past sim.scrollMin.
    updateCamera() {
      const sim = this.sim, cam = this.cameras.main;
      const ps = sim.alivePlayers().length ? sim.alivePlayers() : sim.players;
      let cx = 0, cy = 0, mn = 1e9, mx = -1e9; ps.forEach(p => { cx += p.x; cy += p.y - p.z * 0.3 - 80; mn = Math.min(mn, p.x); mx = Math.max(mx, p.x); }); cx /= ps.length; cy /= ps.length;
      let zoom = 1, tx, ty;
      if (sim.scroll) {
        if (sim.locked) { tx = sim.view.x + 640; }
        else { zoom = Phaser.Math.Clamp(1280 / (mx - mn + 700), 0.8, 1); tx = Math.max(cx + 140, sim.scrollMin + 640 / zoom); }
        ty = 360;
      } else { zoom = Phaser.Math.Clamp(1280 / (mx - mn + 700), 0.8, 1); tx = cx; ty = cy; }
      cam.setZoom(cam.zoom + (zoom - cam.zoom) * 0.08);
      const curX = cam.scrollX + 640, curY = cam.scrollY + 360;
      cam.centerOn(curX + (tx - curX) * 0.1, curY + (ty - curY) * 0.1);
    }
    ghost(spr, col) {
      const g = this.add.image(spr.x, spr.y, spr.texture.key).setOrigin(spr.originX, spr.originY).setFlipX(spr.flipX).setRotation(spr.rotation).setScale(spr.scaleX, spr.scaleY).setDepth(spr.depth - 1).setTintFill(col).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    }
    bubble(x, y, z, msg, id, boss) {
      if (this.bubbles.length > 4) { const b = this.bubbles.shift(); b.t.destroy(); }
      const t = this.add.text(x, y - z, msg, { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: boss ? '22px' : '17px', color: '#111', backgroundColor: boss ? '#ffe066' : '#ffffff', padding: { x: 10, y: 6 }, wordWrap: { width: 260 }, align: 'center' }).setOrigin(0.5, 1).setDepth(6500);
      this.bubbles.push({ t, x, y, z, id, boss, life: boss ? 150 : 110 });
    }
    ent(id) { const s = this.sim; return s.players.find(p => p.id === id) || s.enemies.find(e => e.id === id) || (s.boss && s.boss.id === id ? s.boss : null); }

    // ---------------- events ----------------
    onEvent(e) {
      const A = CO.audio, fx = this.fx, sim = this.sim;
      this.events.emit('ev', e);
      switch (e.t) {
        case 'sfx': if (e.delay) this.time.delayedCall(e.delay * STEP, () => A.sfx(e.s)); else A.sfx(e.s); break;
        case 'swing': {
          if (e.enemy) { fx.arc(e.x, e.y, 40, e.face, -80, 80, { rx: e.r || 190, ry: 90, col: 0xff9a2e, T: 14, w: 40 }); break; }
          const p = sim.players.find(q => q.id === e.p), m = p && p.char.moves[e.move]; if (!m) break;
          const col = e.overtime ? 0xffc83d : e.charged ? 0xffffff : (p.char.fxCol || 0x5ff6ff);
          if (e.beam) fx.beam(e.x, e.y, e.z, e.face, e.beam, col, e.charged ? 16 : 10);
          if (e.spin) fx.arc(e.x, e.y, e.z, e.face, -180, 180, { rx: m.hit.rx, ry: m.hit.ry, col, T: 22, follow: p });
          else if (e.arc) fx.arc(e.x + e.face * 20, e.y, e.z, e.face, e.arc[0], e.arc[1], { rx: m.hit.rx + 20, ry: m.hit.ry + 10, col, vert: e.move === 'promo' || !!m.air, T: 11 });
          if (e.shock) { fx.shock(e.x + e.face * (m.hit.fx || 0), e.y, col, e.charged); A.sfx('kachunk'); }
          if (e.charged && m.charge && m.charge.name) { fx.text(e.x, e.y, 200, m.charge.name.toUpperCase() + '!', { size: 40, col: '#e2c8ff', life: 60, pop: true }); A.sfx('hitHeavy'); }
          else if (e.charged) { fx.text(e.x, e.y, 200, 'FINAL DRAFT!', { size: 40, col: '#ffd34d', life: 60, pop: true }); A.sfx('hitHeavy'); }
          break;
        }
        case 'lure': fx.beam(e.px, e.py, 0, e.face, Math.abs(e.x - e.px) - 60, 0xff4050, 4); fx.ringAt(e.x, e.y, 250, 0xff6070, 20, true); break;
        case 'callout': fx.burst('paw', e.x, e.y, 60, 8, 1); fx.burst('spark', e.x, e.y, 80, 10, 1); fx.ringAt(e.x, e.y, 80, 0xc58cff, 18, true); fx.text(e.x, e.y, 200, { ninja: 'NINJA NEKO!', brawl: 'BRAWLER NEKO!', maid: 'CAFÉ MAID NEKO!' }[e.flav], { size: 24, col: '#e2c8ff', life: 50 }); break;
        case 'catatk': fx.arc(e.x + e.face * 10, e.y, 0, e.face, -60, 60, { rx: e.flav === 'maid' ? 90 : 120, ry: 50, col: e.flav === 'maid' ? 0xffb8e8 : 0xc58cff, T: 9, w: 14 }); break;
        case 'revive': fx.burst('paw', e.x, e.y, 60, 12, 1.2); fx.ringAt(e.x, e.y, 140, 0xe2c8ff, 26, true); A.sfx('overtime'); break;
        case 'shield': fx.ringAt(e.x, e.y, 90, 0xc58cff, 20, true); break;
        case 'charm': fx.burst('heart', e.x, e.y, 150, 3, 1); break;
        case 'shake': if (CO.settings.shake) this.cameras.main.shake(e.d, e.a); break;
        case 'hit': {
          const gold = sim.players.some(p => p.overtime);
          fx.hit(e.x, e.y, e.z, e.fx, e.heavy, gold);
          fx.dmg(e.x, e.y, e.z + 20, e.dmg, e.heavy);   // merged per target area: one growing number instead of a cloud
          if (this.sim.frame - this.lastHitSfx > 2) { A.sfx(e.heavy ? 'hitHeavy' : 'hit'); this.lastHitSfx = this.sim.frame; }
          break;
        }
        case 'stamp': fx.text(e.x, e.y, e.z, e.msg, { size: 38, col: e.msg === 'CLOCKED OUT' ? '#6fd3ff' : e.msg === 'FINAL DRAFT' ? '#ffd34d' : '#5cff8a', angle: -10, vz: 30, life: 55, pop: true }); break;
        case 'block': fx.burst('spark', e.x, e.y, e.z, 5, 0.8); if (this.gate('block', 40)) fx.text(e.x, e.y, e.z + 60, e.msg, { size: 24, col: '#b8c4ff', life: 40 }); A.sfx('block'); break;
        case 'text': if (this.gate('t:' + e.msg, e.small ? 50 : 20)) fx.text(e.x, e.y, e.z, e.msg, { size: e.small ? 18 : 28, col: e.col, life: 45 }); break;
        case 'shout': A.sfx('shout'); fx.shock(e.x + e.face * 60, e.y, 0x9fd0ff, false); fx.burst('paper', e.x + e.face * 80, e.y, 120, 6, 1); break;
        case 'whip': fx.arc(e.x, e.y, 70, e.face, -20, 20, { rx: e.r, ry: 30, col: 0x7dff8a, T: 10, w: 10 }); break;
        case 'poofs': fx.burst('paper', e.x, e.y, e.z + 10, 7, 0.9); A.sfx('tap'); break;
        case 'lock': A.sfx('tick'); break;
        case 'liftdoor': if (e.id === 'lobby') this.liftDoor(e.open); break;
        case 'fadeout': this.cameras.main.fadeOut(260, 0, 0, 0); break;
        case 'snapcam': { const cam = this.cameras.main; cam.centerOn(e.x, 360); this.time.delayedCall(30, () => cam.fadeIn(420)); A.sfx('ding'); break; }
        case 'floor': A.sfx('ding'); break;
        case 'go': A.sfx('ready'); break;
        case 'kill': fx.poof(e.x, e.y, e.z); A.sfx('poof'); if (Math.random() < 0.15 && this.gate('quip', 120)) fx.text(e.x, e.y, e.z + 120, ['FILED!', 'SHREDDED!', 'ARCHIVED!', 'OUT OF OFFICE!', 'ESCALATED!'][Math.floor(Math.random() * 5)], { size: 26, col: '#ffffff', life: 50, pop: true }); break;
        case 'phurt': { fx.burst('star', e.x, e.y, e.z, 5, 0.8); fx.burst('spark', e.x, e.y, e.z, 4, 0.8); if (e.dmg > 0) fx.text(e.x, e.y, e.z + 30, '-' + Math.round(e.dmg), { size: 26, col: '#ffb36b', life: 40 }); A.sfx('phurt');
          if (Math.random() < 0.25) { const p = sim.players.find(q => q.id === e.p); if (p) this.bubble(e.x, e.y, 200, p.char.lines.hurt[Math.floor(Math.random() * p.char.lines.hurt.length)]); } break; }
        case 'chip': if (this.gate('chip' + e.p, 20)) fx.text(e.x, e.y, e.z, '-' + Math.round(e.dmg), { size: 18, col: '#c9d2e6', life: 30 }); break;
        case 'pko': { const q = sim.players.find(o => o.id === e.p) || sim.players[0]; fx.text(q.x, q.y, 220, 'OUT OF OFFICE', { size: 44, col: '#ff8a3d', life: 120 }); A.sfx('boom'); break; }
        case 'cone': fx.arc(e.x, e.y, 60, e.face, -70, 70, { rx: e.r, ry: e.ry || 80, col: e.col || 0xffb347, T: Math.min(e.tell || 18, 40), w: 18 }); break;
        case 'ringtell': fx.ringAt(e.x, e.y, e.r, 0xffe27a, Math.max(10, e.T | 0), true); break;
        case 'ringhit': fx.shock(e.x, e.y, 0xffe27a, true); fx.ringAt(e.x, e.y, e.r, 0xffffff, 16); break;
        case 'dust': fx.dust(e.x, e.y, 2); break;
        case 'drift': fx.dust(e.x, e.y, 3, 0xbfc6d8); fx.burst('spark', e.x, e.y, 6, 3, 0.7); break;
        case 'aura': fx.ringAt(e.x, e.y, e.r, 0x9fe0ff, 30, true); break;
        case 'zone': fx.dust(e.x, e.y, 4, e.kind === 'soap' ? 0xcff4ff : e.kind === 'coffee' ? 0x6a4020 : 0xb0b6c0); break;
        case 'blind': { const q = sim.players.find(o => o.id === e.p); if (q) fx.burst('spark', q.x, q.y, 140, 8, 1.2); break; }
        case 'lift_ding': A.sfx('ding'); fx.text(sim.players[0].x, sim.players[0].y, 260, 'DING!', { size: 44, col: '#ffe9a8', life: 70, pop: true }); break;
        case 'doors': A.sfx('ding'); break;
        case 'dash': A.sfx('dash'); fx.burst('paper', e.x, e.y, 5, 3, 0.4); break;
        case 'land': A.sfx('thud'); break;
        case 'djump': A.sfx('djump'); fx.burst('spark', e.x, e.y, e.z + 10, 9, 0.9); fx.dust(e.x, e.y, 2, 0xe8eeff); break;
        case 'thud': A.sfx('thud'); fx.burst('paper', e.x, e.y, 5, 3, 0.5); break;
        case 'skill': { const nm = { coffee: 'slurp', staples: 'kachunk', briefcase: 'throw', tuneup: 'wrench', ebrake: 'brake', hairpin: 'skid' }[e.id]; if (nm) A.sfx(nm); const q = sim.players.find(o => o.id === e.p); fx.text(e.x, e.y, 230, e.name.toUpperCase() + '!', { size: 28, col: q ? hex(q.char.color || 0x6fd3ff) : '#6fd3ff', life: 40, vz: 40 }); break; }
        case 'buff': if (e.idol) { fx.burst('paw', e.x, e.y, 140, 6, 0.8); fx.ringAt(e.x, e.y, 90, 0xffb8e8, 20, true); } else if (e.wrench) { fx.burst('spark', e.x, e.y, 120, 12, 1.2); fx.ringAt(e.x, e.y, 120, 0xff9a4a, 22, true); } else fx.burst('coffee', e.x, e.y, 120, 10, 1); break;
        case 'ult_ready': A.sfx('ready'); { const p = sim.players.find(q => q.id === e.p) || sim.players[0]; fx.text(p.x, p.y, 260, (p.char.otName || 'ULT') + ' READY!', { size: 30, col: '#ffd34d', life: 70, pop: true }); } break;
        case 'overtime': A.sfx('overtime'); break;
        case 'ult_start': A.sfx('bell'); break;
        case 'ult_hit': {
          A.sfx('ultHit'); this.cameras.main.flash(260, 255, 255, 240);
          const p = sim.players.find(q => q.id === e.p) || sim.players[0]; fx.shock(p.x, p.y, 0xffd34d, true); fx.shock(p.x, p.y, p.char.color || 0x6fd3ff, true);
          if (p.char.id === 'keith') {   // Nyan Idol Showtime: stage lights, hearts + paw confetti
            for (const en of sim.enemies) { fx.burst('heart', en.x, en.y, 160, 3, 1); fx.burst('paw', en.x, en.y, 80, 6, 1.2); }
            for (let k = 0; k < 5; k++) fx.ringAt(p.x, p.y, 120 + k * 90, [0xc58cff, 0xffb8e8, 0x8fe8ff][k % 3], 28 + k * 4, true);
            fx.burst('paw', p.x, p.y, 200, 20, 1.6); fx.text(p.x, p.y, 300, 'NYA~!', { size: 54, col: '#ffb8e8', life: 80, pop: true });
          } else for (const en of sim.enemies) { fx.burst('paper', en.x, en.y, 80, 10, 1.4); }
          break;
        }
        case 'tell': { const o = this.ent(e.id); if (o) fx.text(o.x, o.y, o.z + (e.boss ? 300 : 170), '!', { size: e.boss ? 64 : 44, col: '#ffd34d', life: e.boss ? 40 : 26, vz: 0, pop: true }); break; }
        case 'bark': if (!e.boss && this.bubbles.filter(b => !b.boss).length >= 1) break; this.bubble(e.x, e.y, e.z, e.msg, e.boss ? sim.boss && sim.boss.id : null, e.boss); break;
        case 'boom': fx.shock(e.x, e.y, 0xff9a2e, false); fx.burst('paper', e.x, e.y, 10, 12, 1.3); fx.burst('ink', e.x, e.y, 10, 6, 1); A.sfx('boom'); break;
        case 'pickup': fx.text(e.x, e.y, 80, e.msg, { size: 22, col: e.col, life: 60 }); A.sfx('pickup'); break;
        case 'charged': A.sfx('ready'); fx.burst('spark', e.x, e.y, 90, 8, 1.5); break;
        case 'nope': A.sfx('nope'); if (this.gate('nope', 60)) fx.text(e.x, e.y, 210, e.msg, { size: 18, col: '#9aa7c7', life: 35 }); break;
        case 'wave': A.sfx('elevator'); break;
        case 'bossintro': A.play(this.S.boss_music || 'boss'); A.sfx('elevator'); break;
        case 'bossdown': A.sfx('ultHit'); this.cameras.main.flash(400, 255, 255, 255); fx.burst('paper', e.x, e.y, 150, 40, 2); fx.burst('star', e.x, e.y, 200, 10, 1.2); break;
        case 'clear': {
          this.ended = true; A.stop(); A.sfx('bell'); window.__cleared = e.result;
          CO.save.stageClear(this.S.id, e.result);
          const res = Object.assign({ quick: CO.params.speed > 1 }, e.result);
          this.time.delayedCall(CO.params.speed > 1 ? 300 : 2600, () => {
            this.stopOverlays();
            if (e.result.scene) this.scene.start('Cutscene', { scene: e.result.scene, next: 'Result', data: res });
            else this.scene.start('Result', res);
          }); break;
        }
        case 'failed': this.ended = true; A.stop(); window.__failed = true;
          if (this.mode === 'survival') { this.survOver = { score: sim.score, wave: sim.surv.wave, sec: sim.stats.frames / 60 }; this.survOver.best = CO.save.survivalBest(this.survOver); window.__survival = this.survOver; }
          this.time.delayedCall(1600, () => { this.scene.pause(); this.scene.pause('HUD'); this.scene.pause('Ambient'); this.scene.launch('GameOver', { mode: this.mode, stage: this.S.id, surv: this.survOver, checkpoint: sim.checkpoint, continues: sim.continues, stats: sim.stats, clock: this.S.clock }); this.scene.bringToTop('GameOver'); }); break;
      }
    }
  }

  // ---------------- HUD ----------------
  class HUD extends Phaser.Scene {
    constructor() { super('HUD'); }
    create() {
      this.game_ = this.scene.get('Game'); const sim0 = this.game_.sim, P = sim0.players, n = this.n = P.length, coop = this.coop = n > 1;
      const g = this.g = this.add.graphics();
      const S = this.S = this.game_.S;
      // ---- per-player panels: P1 big (top-left), P2 compact-full below it, P3..P5 mini rows
      this.pan = P.map((p, k) => {
        const c = p.char, col = CO.PLAYER_COLORS[k] || 0xffffff, o = { p, k, c, col };
        if (k === 0) {
          o.big = true; o.x = 136; this.add.image(70, 70, c.portrait).setDisplaySize(104, 104);
          const fr = this.add.graphics(); fr.lineStyle(4, coop ? col : (c.color || 0x6fd3ff)); fr.strokeRoundedRect(18, 18, 104, 104, 10);
          const nmT = this.add.text(136, 10, c.name, CO.style(28, '#ffffff'));
          this.add.text(136 + nmT.width + 10, 17, '"' + c.title + '"', CO.style(15, '#9aa7c7'));
          o.hpT = this.add.text(452, 52, '', CO.style(15)).setOrigin(1, 0.5); o.mpT = this.add.text(452, 78, '', CO.style(13, '#cfe8ff')).setOrigin(1, 0.5);
          o.otT = this.add.text(136, 104, c.otName || 'CLOCK-OUT', CO.style(14, '#ffd34d')).setOrigin(0, 0.5);
          if (coop) this.badge(18, 18, 'P1', col);
        } else if (k === 1) {
          o.x = 108; const y = 146; this.add.image(58, y + 40, c.portrait).setDisplaySize(80, 80);
          const fr = this.add.graphics(); fr.lineStyle(3, col); fr.strokeRoundedRect(18, y, 80, 80, 8); this.badge(18, y, 'P2', col);
          this.add.text(108, y - 2, c.name.toUpperCase(), CO.style(20, hex(col)));
          o.hpT = this.add.text(366, y + 31, '', CO.style(12)).setOrigin(1, 0.5); o.mpT = this.add.text(300, y + 51, '', CO.style(11, '#cfe8ff')).setOrigin(1, 0.5);
          o.otT = this.add.text(108, y + 71, c.otName || 'ULT', CO.style(11, '#ffd34d')).setOrigin(0, 0.5); o.y = y;
        } else {
          const y = 240 + (k - 2) * 52; o.y = y; this.add.image(36, y + 20, c.portrait).setDisplaySize(40, 40);
          const fr = this.add.graphics(); fr.lineStyle(3, col); fr.strokeRoundedRect(16, y, 40, 40, 6);
          this.add.text(64, y - 2, 'P' + (k + 1) + ' ' + c.name.toUpperCase(), CO.style(14, hex(col)));
        }
        return o;
      });
      if (coop) this.add.text(640, 714, 'CO-OP · ' + n + ' PLAYERS', CO.style(16, '#cfe8ff')).setOrigin(0.5, 1).setAlpha(0.7);
      // combo (shows the best combo among players)
      this.combo = this.add.text(1250, 40, '', CO.style(64, '#ffffff')).setOrigin(1, 0);
      this.hits = this.add.text(1250, 104, 'HITS', CO.style(30, '#6fd3ff')).setOrigin(1, 0).setVisible(false);
      this.otBadge = this.add.text(1250, 140, 'OVERTIME!', CO.style(40, '#ffc83d')).setOrigin(1, 0).setVisible(false);
      // top centre
      this.floorT = this.add.text(724, 16, '', CO.style(20, '#ffffff')).setOrigin(0.5, 0);
      this.clockT = this.add.text(724, 42, '', CO.style(22, '#ffd34d')).setOrigin(0.5, 0);
      this.cdT = this.add.text(724, 72, '', CO.style(26, '#ffe9a8')).setOrigin(0.5, 0).setVisible(false);
      // skills bars: solo = centred; co-op = P1 left, P2 right (the mock-up)
      this.touch = CO.touchOn(); this.skills = [];
      const pad = CO.lastDevice === 'gamepad', acts = ['s1', 's2', 's3', 'ult'];
      P.slice(0, 2).forEach((p, k) => {
        const c = p.char, all = c.skills.concat([Object.assign({ cost: 0 }, c.ult)]), sz = coop ? 70 : 84;
        const x0 = coop ? (k === 0 ? 90 : 800) : 640 - 165, pitch = coop ? 92 : 110, y = coop ? 656 : 650;
        if (coop) this.add.text(x0 - 36, y - 62, 'P' + (k + 1) + ' · ' + c.name.toUpperCase(), CO.style(14, hex(CO.PLAYER_COLORS[k]))).setOrigin(0, 0.5);
        all.forEach((sk, i) => {
          const x = x0 + i * pitch, ic = this.add.image(x, y, sk.icon).setDisplaySize(sz, sz);
          const lab = pad && k === 0 ? CO.padLabel(acts[i]).split(' / ')[0] : CO.keyLabel(k, acts[i]).split(' / ')[0];
          const kt = this.add.text(x - sz / 2 + 2, y - sz / 2 - 2, lab, CO.style(coop ? 13 : 16, '#ffffff')).setOrigin(0, 0);
          const nm = this.add.text(x, y + sz / 2 + 4, sk.name, CO.style(coop ? 11 : 13, '#cfe8ff')).setOrigin(0.5, 0);
          this.skills.push({ ic, kt, nm, x, y, sk, i, k, sz });
        });
      });
      this.skG = this.add.graphics(); this.setSkillsVisible(!this.touch);
      // boss bar
      this.bossName = this.add.text(640, 88, '', CO.style(22, '#ffd34d')).setOrigin(0.5, 0).setVisible(false);
      // banners
      this.banner = this.add.text(640, 300, '', CO.style(64, '#ffffff', { align: 'center' })).setOrigin(0.5).setAlpha(0);
      this.bannerSub = this.add.text(640, 370, '', CO.style(26, '#cfe8ff', { align: 'center', wordWrap: { width: 1000 } })).setOrigin(0.5).setAlpha(0);
      // ult cut-in (portrait / name / colour come from the casting character)
      const c0 = P[0].char;
      this.ultBg = this.add.rectangle(640, 360, 1280, 720, 0x06081a, 0.7).setAlpha(0);
      this.ultBand = this.add.rectangle(640, 360, 1280, 220, 0xffc83d, 1).setAlpha(0).setAngle(-6);
      this.ultPort = this.add.image(-200, 360, c0.portrait).setDisplaySize(240, 240);
      this.ultTitle = this.add.text(2000, 320, 'CLOCK OUT', CO.style(96, '#0d1022', { stroke: '#ffffff', strokeThickness: 8 })).setOrigin(0.5);
      this.ultLine = this.add.text(2000, 410, '', CO.style(34, '#ffffff')).setOrigin(0.5);
      this.ultClock = this.add.image(640, 360, c0.ult.icon).setDisplaySize(300, 300).setAlpha(0);
      // blind white-out (Flash-photo zombie etc.)
      this.white = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0).setDepth(90);
      // GO → prompt
      this.goT = this.add.text(1240, 330, 'GO →', CO.style(64, '#7dff8a')).setOrigin(1, 0.5).setVisible(false);
      this.goSub = this.add.text(1240, 380, '', CO.style(22, '#ffffff')).setOrigin(1, 0.5).setVisible(false);
      this.goOn = false;
      this.game_.events.on('ev', this.onEv, this);
      this.events.once('shutdown', () => this.game_.events.off('ev', this.onEv, this));
      this.base = S.num ? 'STAGE ' + S.num + ' · ' + S.name : 'SURVIVAL · ' + (S.arenaName || '');
      this.floorLabel = this.base;
    }
    badge(x, y, txt, col) { this.add.rectangle(x + 14, y + 11, 28, 20, col).setStrokeStyle(2, 0x10162e); this.add.text(x + 14, y + 11, txt, CO.style(13, '#10162e')).setOrigin(0.5); }
    setSkillsVisible(v) { this.skills.forEach(s => { s.ic.setVisible(v); s.kt.setVisible(v); s.nm.setVisible(v); }); this.skG.setVisible(v); }
    show(msg, sub, col = '#ffffff', hold = 1800) {
      this.tweens.killTweensOf([this.banner, this.bannerSub]);
      this.banner.setText(msg).setColor(col).setAlpha(0).setScale(0.6); this.bannerSub.setText(sub || '').setAlpha(0);
      this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 250, ease: 'Back.out' });
      this.tweens.add({ targets: this.bannerSub, alpha: 1, duration: 300, delay: 120 });
      this.tweens.add({ targets: [this.banner, this.bannerSub], alpha: 0, duration: 400, delay: hold });
    }
    onEv(e) {
      const S = this.S, sim = this.game_.sim, base = this.base, enc = () => S.encounters && S.encounters[sim.enc];
      switch (e.t) {
        case 'card': this.show(e.title, e.sub + '\n' + (e.lines || []).join('\n'), '#ffd34d', 2600); break;
        case 'wave': if (e.surv) { this.floorLabel = 'SURVIVAL · ' + (S.arenaName || '') + ' · WAVE ' + e.n; this.show('WAVE ' + e.n, e.text, '#ffffff', 1500); }
          else { const en = enc(); this.floorLabel = base + ' · ' + (en && en.label ? en.label : 'AREA ' + (sim.enc + 1) + '/' + S.encounters.length); if (e.n === 1) this.show(e.of > 1 ? 'WAVE 1/' + e.of : 'FIGHT!', e.text, '#ffffff', 1500); else this.show('WAVE ' + e.n + '/' + e.of, e.text, '#ffffff', 1200); }
          break;
        case 'floor': this.show(e.label, 'The lift climbs…', '#ffe9a8', 1100); this.floorLabel = base + ' · ' + e.label; break;
        case 'doors': if (e.open) this.show('DOORS OPEN', '', '#ffe9a8', 700); break;
        case 'lift_ding': this.show('DING!', 'The lift has arrived!', '#ffe9a8', 1300); break;
        case 'waveclear': if (e.surv) this.show('WAVE ' + e.wave + ' SURVIVED', '+' + (400 * e.wave) + ' pts · +12% HP', '#8ee35a', 1000); break;
        case 'lock': this.goOn = false; if (e.label) this.floorLabel = base + ' · ' + e.label; break;
        case 'go': this.goOn = true; this.floorLabel = base; this.goSub.setText(e.label ? 'to the ' + e.label : ''); break;
        case 'bossintro': this.floorLabel = base + ' · BOSS'; this.show('BOSS', e.text, '#ff9a2e', 2000); this.bossName.setText(e.name).setVisible(true); break;
        case 'banner': this.show(e.msg, e.sub, '#ff9a2e', 1600); break;
        case 'overtime': { const q = sim.players.find(o => o.id === e.p); this.show((q && q.char.otName === 'ULT' ? 'NITRO' : 'OVERTIME') + '!', '50+ hits — damage up, meter fills faster!', '#ffc83d', 1000); this.tweens.add({ targets: this.otBadge, scale: { from: 1.6, to: 1 }, duration: 300 }); break; }
        case 'bossdown': this.show('BOSS DEFEATED', '"' + sim.boss.def.defeat[0] + '"', '#ffd34d', 2200); break;
        case 'clear': this.goOn = false; this.show(e.result.scene === 'lobby' ? 'THE EXIT IS BLOCKED!' : S.num === 7 ? 'STARSHIFT!' : 'STAGE CLEAR!', S.clear, e.result.scene === 'lobby' ? '#ff9a2e' : '#8ee35a', 2400); break;
        case 'failed': this.show('OUT OF OFFICE', (this.n > 1 ? 'The whole team has been' : sim.players[0].char.name + ' has been') + '… reassigned.', '#ff8a3d', 1600); break;
        case 'ult_start': this.ult(e); break;
        case 'ult_hit': this.tweens.add({ targets: [this.ultBg, this.ultBand, this.ultClock], alpha: 0, duration: 200 }); this.ultPort.x = -200; this.ultTitle.x = 2000; this.ultLine.x = 2000; break;
      }
    }
    ult(e) {
      const c = CO.CHARACTERS[e.char] || this.game_.sim.players[0].char, col = c.color || 0xffc83d;
      this.ultPort.setTexture(c.portrait).setDisplaySize(240, 240); this.ultClock.setTexture(c.ult.icon).setDisplaySize(300, 300);
      this.ultTitle.setText(c.ult.name.toUpperCase()).setFontSize(c.ult.name.length > 11 ? 70 : 96);
      this.ultBand.setFillStyle(col, 1);
      this.ultBg.setAlpha(0); this.ultBand.setAlpha(0); this.ultLine.setText('"' + e.line + '"');
      this.tweens.add({ targets: this.ultBg, alpha: 1, duration: 150 });
      this.tweens.add({ targets: this.ultBand, alpha: 0.92, duration: 150, delay: 100 });
      this.ultPort.x = -200; this.tweens.add({ targets: this.ultPort, x: 260, duration: 260, delay: 100, ease: 'Back.out' });
      this.ultTitle.x = 2000; this.tweens.add({ targets: this.ultTitle, x: 780, duration: 260, delay: 160, ease: 'Back.out' });
      this.ultLine.x = 2000; this.tweens.add({ targets: this.ultLine, x: 780, duration: 260, delay: 260, ease: 'Back.out' });
      this.ultClock.setAlpha(0).setAngle(0); this.tweens.add({ targets: this.ultClock, alpha: 0.35, angle: 720, duration: 1000, delay: 300 });
    }
    bar(x, y, w, h, k, col, back = 0x1a1f38) { const g = this.g; g.fillStyle(0x000000, 0.6); g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 4); g.fillStyle(back); g.fillRect(x, y, w, h); g.fillStyle(col); g.fillRect(x, y, w * Phaser.Math.Clamp(k, 0, 1), h); g.fillStyle(0xffffff, 0.25); g.fillRect(x, y, w * Phaser.Math.Clamp(k, 0, 1), h / 3); }
    update(t) {
      const sim = this.game_.sim; if (!sim) return; const g = this.g; g.clear();
      const tc = CO.touchOn(); if (tc !== this.touch) { this.touch = tc; this.setSkillsVisible(!tc); }
      // panels
      let best = sim.players[0];
      for (const o of this.pan) {
        const p = o.p, c = o.c, ready = p.ot >= 100; if (p.combo > best.combo) best = p;
        const hpCol = !p.alive ? 0x555a6a : p.hp < p.maxhp * 0.3 && Math.floor(t / 200) % 2 ? 0xff7a7a : (o.k === 1 ? 0xff8a3c : 0xe8384f);
        if (o.big) {
          this.bar(136, 44, 318, 18, p.hp / p.maxhp, hpCol); this.bar(136, 72, 318, 12, p.mp / p.maxmp, 0x3fa8ff);
          this.bar(236, 98, 218, 12, p.ot / 100, ready ? (Math.floor(t / 120) % 2 ? 0xffffff : 0xffc83d) : 0xffc83d);
          o.otT.setText(ready ? 'READY!' : (c.otName || 'CLOCK-OUT')); o.hpT.setText(Math.ceil(p.hp) + ' / ' + p.maxhp); o.mpT.setText((c.mpName || 'CAFFEINE') + ' ' + Math.floor(p.mp));
        } else if (o.k === 1) {
          const y = o.y; this.bar(108, y + 24, 258, 14, p.hp / p.maxhp, hpCol); this.bar(108, y + 44, 192, 9, p.mp / p.maxmp, 0x3fa8ff);
          this.bar(166, y + 62, 134, 9, p.ot / 100, ready ? (Math.floor(t / 120) % 2 ? 0xffffff : 0xffc83d) : 0xffc83d);
          o.otT.setText(ready ? 'READY!' : (c.otName || 'ULT')); o.hpT.setText(Math.ceil(p.hp) + '/' + p.maxhp); o.mpT.setText((c.mpName || 'CAFFEINE') + ' ' + Math.floor(p.mp));
        } else { const y = o.y; this.bar(64, y + 22, 150, 8, p.hp / p.maxhp, hpCol); this.bar(222, y + 22, 50, 8, p.ot / 100, 0xffc83d); }
      }
      // combo
      const p = best, show = p.combo >= 2; this.combo.setVisible(show).setText(p.combo + ''); this.hits.setVisible(show);
      this.combo.setColor(p.overtime ? '#ffc83d' : '#ffffff'); this.otBadge.setVisible(p.overtime).setText(p.char.otName === 'ULT' ? 'NITRO!' : 'OVERTIME!');
      if (p.overtime) this.otBadge.setAngle(Math.sin(t / 80) * 3);
      if (show) { g.fillStyle(0x000000, 0.5); g.fillRect(1250 - 160, 136 + (p.overtime ? 48 : 0), 160, 6); g.fillStyle(p.overtime ? 0xffc83d : 0x6fd3ff); g.fillRect(1250 - 160, 136 + (p.overtime ? 48 : 0), 160 * p.comboT / (p.overtime ? 190 : 150), 6); }
      // clock / survival counters
      const left = Math.max(0, 20 * 3600 - sim.gameSec), lm = Math.floor(left / 60);
      this.floorT.setText(this.floorLabel);
      if (sim.mode === 'survival') {
        const sec = Math.floor(sim.stats.frames / 60), bst = this.best || (this.best = CO.save.best());
        this.clockT.setText('WAVE ' + sim.surv.wave + '  ·  ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + '  ·  ' + sim.score.toLocaleString() + ' PTS  ·  BEST ' + Math.max(bst.score, sim.score).toLocaleString()).setColor(sim.score > bst.score && bst.score ? '#7dff8a' : '#ffd34d');
      } else this.clockT.setText('🕒 ' + CO.fmtClock(sim.gameSec) + '   ·   STARSHIFT in ' + (left <= 0 ? 'NOW!!' : Math.floor(lm / 60) + 'h ' + String(lm % 60).padStart(2, '0') + 'm')).setColor(lm < 30 ? '#ff9a2e' : '#ffd34d');
      // lift countdown
      const en = this.S.encounters && this.S.encounters[sim.enc], cdOn = en && en.countdown && sim.cd > 0 && sim.locked;
      this.cdT.setVisible(!!cdOn); if (cdOn) { const s = Math.ceil(sim.cd / 60); this.cdT.setText('LIFT ARRIVES IN ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')); }
      // GO → prompt
      const go = this.goOn && sim.state === 'roam' && !sim.locked;
      this.goT.setVisible(go && Math.floor(t / 350) % 2 === 0); this.goSub.setVisible(go); if (go) this.goT.x = 1240 + Math.sin(t / 120) * 10;
      // blind white-out
      const bl = this.n === 1 ? sim.players[0].blind : Math.max(...sim.players.map(q => q.blind)) * 0.5; this.white.setAlpha(bl > 0 ? Math.min(this.n === 1 ? 0.92 : 0.45, bl / 30) : 0);
      // skills
      if (!this.touch) {
        const sg = this.skG; sg.clear();
        this.skills.forEach(s => {
          const q = sim.players[s.k], isUlt = s.i === 3, ready = q.ot >= 100, cd = isUlt ? 0 : q.cds[s.i], max = isUlt ? 1 : s.sk.cd, cant = isUlt ? !ready : (q.mp < s.sk.cost), h = s.sz / 2;
          s.ic.setAlpha(cant ? 0.45 : 1);
          if (cd > 0) { sg.fillStyle(0x000000, 0.6); sg.slice(s.x, s.y, h, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / max), false); sg.fillPath(); }
          if (isUlt) { sg.fillStyle(0x000000, 0.55); sg.fillRect(s.x - h, s.y - h, s.sz, s.sz * (1 - q.ot / 100)); if (ready) { sg.lineStyle(4, 0xffc83d, 0.6 + Math.sin(t / 100) * 0.4); sg.strokeCircle(s.x, s.y, h + 6); } }
        });
      }
      // boss bar
      if (sim.boss && sim.boss.state !== 'intro' || (sim.boss && sim.boss.st > 40)) {
        const b = sim.boss; this.bossName.setVisible(true);
        this.bar(340, 118, 600, 16, b.hp / b.maxhp, b.frozen ? 0x9ff8ff : b.phase === 2 ? 0xff9a2e : 0xffc83d);
        g.fillStyle(0xffffff, 0.8); g.fillRect(340 + 300, 116, 2, 20);
        this.bar(340, 140, 600, 5, b.state === 'dizzy' ? 0 : b.poise / b.def.poise, 0x9ff8ff);
      } else this.bossName.setVisible(false);
    }
  }

  // ---------------- Touch controls ----------------
  class Touch extends Phaser.Scene {
    constructor() { super('Touch'); }
    create() {
      this.input.addPointer(5);
      this.g = this.add.graphics(); this.labels = [];
      const c = this.scene.get('Game').sim.players[0].char;
      // layout (game coords, 1280x720)
      this.btns = [
        { a: 'light', x: 1140, y: 600, r: 72, label: 'ATK', col: 0x1fd1e8 },
        { a: 'heavy', x: 1010, y: 640, r: 56, label: 'HVY', col: 0xffc83d },
        { a: 'jump', x: 1190, y: 460, r: 54, label: 'JUMP', col: 0x8ee35a },
        { a: 'dash', x: 1055, y: 510, r: 50, label: 'DASH', col: 0xb8c4ff },
        { a: 's1', x: 880, y: 660, r: 42, icon: c.skills[0].icon, i: 0 },
        { a: 's2', x: 900, y: 560, r: 42, icon: c.skills[1].icon, i: 1 },
        { a: 's3', x: 960, y: 445, r: 42, icon: c.skills[2].icon, i: 2 },
        { a: 'ult', x: 1110, y: 360, r: 46, icon: c.ult.icon, ult: true },
        { a: 'pause', x: 1240, y: 200, r: 30, label: 'II', col: 0xffffff },
      ];
      for (const b of this.btns) {
        if (b.icon) b.img = this.add.image(b.x, b.y, b.icon).setDisplaySize(b.r * 1.9, b.r * 1.9);
        if (b.label) b.txt = this.add.text(b.x, b.y, b.label, CO.style(b.r > 60 ? 28 : 20)).setOrigin(0.5);
      }
      this.stick = { id: null, bx: 0, by: 0, x: 0, y: 0 }; this.held = new Map();
      this.input.on('pointerdown', this.down, this); this.input.on('pointermove', this.move, this);
      this.input.on('pointerup', this.up, this); this.input.on('pointerupoutside', this.up, this);
      this.refresh();
    }
    refresh() { this.on = CO.touchOn(); this.children.list.forEach(o => o.setVisible(this.on)); if (!this.on) this.clear(); }
    clear() { CO.touch.state.mx = 0; CO.touch.state.my = 0; CO.touch.state.h = {}; this.held.clear(); this.stick.id = null; }
    hitBtn(x, y) { let best = null, bd = 1e9; for (const b of this.btns) { const d = Math.hypot(x - b.x, y - b.y); if (d < b.r * 1.25 && d < bd) { bd = d; best = b; } } return best; }
    down(ptr) {
      if (!this.on) return; const b = this.hitBtn(ptr.x, ptr.y);
      if (b) { this.held.set(ptr.id, b.a); this.sync(); return; }
      if (ptr.x < 640 && this.stick.id === null) { this.stick = { id: ptr.id, bx: ptr.x, by: ptr.y, x: ptr.x, y: ptr.y }; this.move(ptr); }
    }
    move(ptr) {
      if (!this.on) return;
      if (ptr.id === this.stick.id) { const s = this.stick; let dx = ptr.x - s.bx, dy = ptr.y - s.by; const L = Math.hypot(dx, dy), R = 80; if (L > R) { s.bx += dx / L * (L - R); s.by += dy / L * (L - R); dx = ptr.x - s.bx; dy = ptr.y - s.by; } s.x = ptr.x; s.y = ptr.y; const k = Math.min(1, Math.hypot(dx, dy) / R); const a = Math.atan2(dy, dx); CO.touch.state.mx = k > 0.2 ? Math.cos(a) * k : 0; CO.touch.state.my = k > 0.2 ? Math.sin(a) * k : 0; }
      else if (this.held.has(ptr.id)) { const b = this.hitBtn(ptr.x, ptr.y); if (b && b.a !== this.held.get(ptr.id)) { this.held.set(ptr.id, b.a); this.sync(); } }
    }
    up(ptr) { if (ptr.id === this.stick.id) { this.stick.id = null; CO.touch.state.mx = 0; CO.touch.state.my = 0; } if (this.held.delete(ptr.id)) this.sync(); }
    sync() { const h = {}; for (const a of this.held.values()) h[a] = true; CO.touch.state.h = h; }
    update(t) {
      const g = this.g; g.clear(); if (!this.on) return;
      const sim = this.scene.get('Game').sim, p = sim && sim.players[0];
      // stick
      const s = this.stick; const bx = s.id !== null ? s.bx : 190, by = s.id !== null ? s.by : 560;
      g.fillStyle(0xffffff, 0.12); g.fillCircle(bx, by, 95); g.lineStyle(4, 0xffffff, 0.35); g.strokeCircle(bx, by, 95);
      const kx = s.id !== null ? s.x : bx, ky = s.id !== null ? s.y : by; const dx = kx - bx, dy = ky - by, L = Math.hypot(dx, dy), R = 80;
      g.fillStyle(0x6fd3ff, 0.55); g.fillCircle(bx + (L > R ? dx / L * R : dx), by + (L > R ? dy / L * R : dy), 44);
      for (const b of this.btns) {
        const on = CO.touch.state.h[b.a];
        let alpha = 0.32, col = b.col || 0x10162e;
        if (p && b.i !== undefined) { const sk = p.char.skills[b.i]; const okk = p.mp >= sk.cost && p.cds[b.i] <= 0; b.img.setAlpha(okk ? 0.95 : 0.4); if (p.cds[b.i] > 0) { g.fillStyle(0x000000, 0.55); g.slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.cds[b.i] / sk.cd); g.fillPath(); } }
        if (p && b.ult) { const rd = p.ot >= 100; b.img.setAlpha(rd ? 1 : 0.35); g.lineStyle(5, 0xffc83d, 1); g.beginPath(); g.arc(b.x, b.y, b.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.ot / 100); g.strokePath(); if (rd) { g.fillStyle(0xffc83d, 0.25 + Math.sin(t / 100) * 0.15); g.fillCircle(b.x, b.y, b.r + 12); } }
        g.fillStyle(col, on ? 0.75 : alpha); g.fillCircle(b.x, b.y, b.r); g.lineStyle(3, 0xffffff, on ? 0.95 : 0.5); g.strokeCircle(b.x, b.y, b.r);
      }
    }
  }

  CO.Scenes.Game = Game; CO.Scenes.HUD = HUD; CO.Scenes.Touch = Touch; CO.Scenes.Ambient = CO.AmbientScene;
})(window.CO);
