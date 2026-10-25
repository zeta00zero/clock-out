// Clock Out! — Game scene (renders the Sim), HUD and touch controls.
(function (CO) {
  const STEP = 1000 / 60, F = () => window.FRAMES;
  const SCALE = { player: 1.0, enemy: 1.04, boss: 1.0 };

  class Game extends Phaser.Scene {
    constructor() { super('Game'); }
    create(data) {
      data = this.data0 = data || {};
      const stageId = data.stage || 'survival', S = this.S = CO.STAGES[stageId];
      this.mode = stageId === 'survival' ? 'survival' : 'story';
      let cp = data.checkpoint; if (cp === undefined && CO.params.boss && S.encounters) cp = S.encounters.length - 1;
      this.sim = new CO.Sim({ seed: CO.params.seed || ((Math.random() * 1e9) | 0), stage: stageId, mode: this.mode, checkpoint: cp, continues: data.continues || 0, stats: data.stats, god: CO.params.god, clock: Math.max(S.clock || 0, data.clock || 0), score: data.score });
      // players: P1 = keyboard/pad/touch (or bot in tests); extra slots (debug ?players=N) = CPU bots
      const n = Phaser.Math.Clamp(CO.params.players || 1, 1, CO.MAX_PLAYERS); this.inputs = [];
      const chars = data.chars || [];
      for (let k = 0; k < n; k++) {
        this.sim.addPlayer(chars[k] || 'lemon', k);
        this.inputs.push(CO.Input.forSlot(k, { bot: k === 0 ? CO.params.bot : true, getSim: () => this.sim }));
      }
      const W = this.sim.world;
      if (this.sim.scroll) {   // tiled, alternately mirrored stage background
        for (let i = 0; i * 1280 < W.w; i++) this.add.image(i * 1280, 0, S.bg).setOrigin(0).setDisplaySize(1281, W.h).setFlipX(i % 2 === 1).setDepth(0);
        this.drawExit(S);
      } else this.add.image(0, 0, S.bg).setOrigin(0).setDisplaySize(W.w, W.h).setDepth(0);
      const cam = this.cameras.main; cam.setBounds(0, 0, W.w, W.h); cam.setBackgroundColor('#0b0f1e');
      this.charScale = CO.touchOn() ? 1.24 : 1;   // phones: Lemon & co. drawn bigger
      this.fx = new CO.FX(this); this.views = new Map(); this.projViews = new Map(); this.pickViews = new Map(); this.bubbles = [];
      this.hazG = this.add.graphics().setDepth(4); this.hazT = [];
      this.acc = 0; this.ended = false; this.lastHitSfx = 0; this.pend = {};
      const p = this.sim.players[0]; cam.centerOn(p.x, p.y - 80);
      CO.audio.play(S.music || 'stage'); CO.audio.setIntensity(0);
      this.textGate = {};
      this.scene.launch('HUD'); this.scene.launch('Touch');
      this.scene.bringToTop('HUD'); this.scene.bringToTop('Touch');
      this.syncInput();
      this.cameras.main.fadeIn(300);
      window.__sim = this.sim; window.__gameScene = this;
      this.fpsLog = [];
    }
    drawExit(S) {
      if (S.exit > S.len) return;
      const x = S.exit + 40, y0 = S.band[0] - 10, g = this.add.graphics().setDepth(2);
      g.fillStyle(0x7dff8a, 0.10); g.fillRect(x - 70, y0 - 220, 140, S.band[1] - y0 + 220);
      g.lineStyle(4, 0x7dff8a, 0.7); g.strokeRect(x - 70, y0 - 220, 140, 220);
      this.exitSign = this.add.text(x, y0 - 250, S.exitLabel + ' →', CO.style(26, '#7dff8a')).setOrigin(0.5).setDepth(3);
      this.tweens.add({ targets: this.exitSign, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
    }
    gate(key, frames) { const f = this.sim.frame; if (this.textGate[key] && f - this.textGate[key] < frames) return false; this.textGate[key] = f; return true; }
    syncInput() { this.inputs.forEach(i => i.update()); this.pend = {}; }
    restart(d) { this.scene.stop('HUD'); this.scene.stop('Touch'); this.scene.restart(d); }
    quit() { this.scene.stop('HUD'); this.scene.stop('Touch'); this.scene.stop(); this.scene.start('Title'); }

    update(time, delta) {
      if (this.game.loop.actualFps) this.fpsLog.push(this.game.loop.actualFps);
      const intents = this.inputs.map(i => i.update());
      if (intents[0].p.pause && !this.ended) { this.scene.pause(); this.scene.pause('HUD'); this.scene.launch('Pause'); this.scene.bringToTop('Pause'); return; }
      // collect presses so a frame with 0 sim steps doesn't lose them
      for (const it of intents) for (const a in it.p) this.pend[a] = true;
      let steps;
      if (CO.params.speed > 1) steps = CO.params.speed;
      else { this.acc += Math.min(delta, 100); steps = Math.floor(this.acc / STEP); this.acc -= steps * STEP; }
      for (let s = 0; s < steps; s++) {
        if (this.sim.slowmo > 0 && (this.sim.frame + s) % 3 !== 0 && CO.params.speed === 1) { this.sim.slowmo--; continue; }
        const its = intents.map((it, k) => ({ mx: it.mx, my: it.my, h: it.h, p: k === 0 ? this.pend : {} }));
        this.pend = {};
        this.sim.step(its);
        for (const e of this.sim.events) this.onEvent(e);
        if (this.ended) break;
      }
      CO.audio.setIntensity(this.sim.players.some(p => p.overtime) ? 1 : 0);
      this.render(delta / 1000);
    }

    // ---------------- rendering ----------------
    view(o, cat) {
      let v = this.views.get(o.id);
      if (!v) {
        v = { sh: this.add.image(o.x, o.y, 'shadow').setDepth(1), spr: this.add.image(o.x, o.y, o.pose), o, cat, seen: 0 };
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
      if (o.kind === 'player' && o.state === 'run') rot += o.face * (o.runT < 8 ? 0.06 : 0.02) + Math.sin(o.runDist / 26) * 0.012;
      if (o.kind === 'player' && o.stopT > 0) rot -= o.face * 0.05 * (o.stopT / 7);
      v.spr.setPosition(o.x, o.y - o.z - (o.bob || 0)).setRotation(rot).setScale(sx, sy).setDepth(o.y + (o.kind === 'player' ? 0.5 : 0));
      const shs = (o.w / 50) * Math.max(0.45, 1 - o.z / 500) * (o.kind === 'boss' ? 2.4 : 1.6) * this.charScale;
      v.sh.setPosition(o.x, o.y).setScale(shs, shs * 0.9).setAlpha(Math.max(0.3, 1 - o.z / 600));
      if (o.flash > 0) { if (o.kind === 'boss') v.spr.setTint(0xffb0b0); else if ((o.flash | 0) % 4 < 2) v.spr.setTintFill(0xffffff); else v.spr.setTint(0xffd0d0); } else if (o.def && o.def.tint) v.spr.setTint(o.def.tint); else v.spr.clearTint();
    }
    render(dt) {
      this.frameNo = (this.frameNo || 0) + 1;
      const sim = this.sim, t = this.time.now;
      for (const p of sim.players) {
        const v = this.view(p, 'player'); this.place(v, p, SCALE.player);
        if (p.flash > 0) v.spr.setTintFill(0xffffff); else if (p.buff > 0) v.spr.setTint(0xfff0c8); else v.spr.clearTint();
        v.spr.setAlpha(p.iframes > 0 && p.state !== 'dash' && Math.floor(t / 60) % 2 ? 0.55 : 1);
        v.glow.setVisible(p.overtime || p.charge >= 22 || p.buff > 0).setPosition(p.x, p.y - p.z - 70).setScale(p.overtime ? 2.4 : 1.8, p.overtime ? 2.6 : 2).setTint(p.overtime ? 0xffc83d : p.charge >= 22 ? 0xffffff : 0x9a6a3a).setAlpha(0.35 + Math.sin(t / 90) * 0.1);
        if (p.state === 'dash' && this.frameNo % 3 === 0) this.ghost(v.spr, 0x6fd3ff);
        if (p.overtime && this.frameNo % 6 === 0 && p.state === 'move') this.ghost(v.spr, 0xffc83d);
      }
      for (const e of sim.enemies) {
        const v = this.view(e, 'enemy'); this.place(v, e, SCALE.enemy);
        if (e.type === 'hr' && e.shieldDown > 0 && e.flash <= 0) v.spr.setTint(0xb8c4ff);
        v.bar.clear(); if (e.hp < e.maxhp) { const w = 70, x = e.x - w / 2, y = e.y - e.z - 158 * this.charScale; v.bar.fillStyle(0x000000, 0.6); v.bar.fillRect(x - 2, y - 2, w + 4, 9); v.bar.fillStyle(0x8ee35a); v.bar.fillRect(x, y, w * Math.max(0, e.hp / e.maxhp), 5); }
      }
      if (sim.boss) { const b = sim.boss, v = this.view(b, 'boss'); this.place(v, b, SCALE.boss); v.bar.clear(); if (b.state === 'dizzy') { for (let k = 0; k < 3; k++) { const a = t / 200 + k * 2.1; v.bar.fillStyle(0xffe14d); v.bar.fillCircle(b.x + Math.cos(a) * 50, b.y - 290 + Math.sin(a) * 12, 7); } } if (b.state === 'dead') v.spr.setAlpha(Math.max(0, 1 - b.st / 160));
        if (b.state === 'aura') { v.bar.lineStyle(6, 0xb36bff, 0.5 + Math.sin(t / 80) * 0.3); v.bar.strokeEllipse(b.x, b.y - 150, 300 + Math.sin(t / 120) * 20, 360); } }
      for (const [id, v] of this.views) if (v.seen !== this.frameNo) { v.spr.destroy(); v.sh.destroy(); v.bar && v.bar.destroy(); v.glow && v.glow.destroy(); this.views.delete(id); }
      // projectiles
      const seenP = new Set();
      for (const q of sim.projs) {
        seenP.add(q.id); let im = this.projViews.get(q.id);
        if (!im) { im = this.add.image(q.x, q.y, q.kind === 'staple' ? 'staple' : q.kind === 'case' ? 'briefcase' : (q.tex || 'note')); this.projViews.set(q.id, im); }
        im.setPosition(q.x, q.y - q.z).setDepth(q.y + 2);
        if (q.kind === 'staple') im.setRotation(Math.atan2(q.vy, q.vx) + Math.PI / 2);
        else im.rotation += q.kind === 'case' ? 0.5 : 0.2;
      }
      for (const [id, im] of this.projViews) if (!seenP.has(id)) { im.destroy(); this.projViews.delete(id); }
      const seenK = new Set();
      for (const k of sim.pickups) { seenK.add(k.id); let im = this.pickViews.get(k.id); if (!im) { im = this.add.image(k.x, k.y, k.type); this.pickViews.set(k.id, im); } im.setPosition(k.x, k.y - 20 - Math.abs(Math.sin(k.t / 12)) * 14).setDepth(k.y).setAlpha(k.t > 780 && k.t % 10 < 5 ? 0.3 : 1); }
      for (const [id, im] of this.pickViews) if (!seenK.has(id)) { im.destroy(); this.pickViews.delete(id); }
      // hazards: deadline circles
      const g = this.hazG; g.clear(); this.hazT.forEach(x => x.setVisible(false)); let hi = 0;
      for (const h of sim.hazards) {
        const k = Math.min(1, h.t / h.T);
        g.fillStyle(0xff9a2e, 0.18); g.fillEllipse(h.x, h.y, h.r * 2, h.r * 1.1);
        g.fillStyle(0xffc83d, 0.35); g.fillEllipse(h.x, h.y, h.r * 2 * k, h.r * 1.1 * k);
        g.lineStyle(3, 0xffd34d, 0.9); g.strokeEllipse(h.x, h.y, h.r * 2, h.r * 1.1);
        let tx = this.hazT[hi]; if (!tx) { tx = this.add.text(0, 0, '', CO.style(18, '#ffffff')).setOrigin(0.5).setDepth(4001); this.hazT.push(tx); }
        tx.setVisible(true).setPosition(h.x, h.y).setText((h.label || 'DUE') + ' ' + Math.max(0, Math.ceil((h.T - h.t) / 60 * 10) / 10).toFixed(1) + 's'); hi++;
      }
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
          const col = e.overtime ? 0xffc83d : e.charged ? 0xffffff : 0x5ff6ff;
          if (e.spin) fx.arc(e.x, e.y, e.z, e.face, -180, 180, { rx: m.hit.rx, ry: m.hit.ry, col, T: 22, follow: p });
          else if (e.arc) fx.arc(e.x + e.face * 20, e.y, e.z, e.face, e.arc[0], e.arc[1], { rx: m.hit.rx + 20, ry: m.hit.ry + 10, col, vert: e.move === 'promo' || !!m.air, T: 11 });
          if (e.shock) { fx.shock(e.x + e.face * (m.hit.fx || 0), e.y, col, e.charged); A.sfx('kachunk'); }
          if (e.charged) { fx.text(e.x, e.y, 200, 'FINAL DRAFT!', { size: 40, col: '#ffd34d', life: 60, pop: true }); A.sfx('hitHeavy'); }
          break;
        }
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
        case 'go': A.sfx('ready'); break;
        case 'kill': fx.poof(e.x, e.y, e.z); A.sfx('poof'); if (Math.random() < 0.15 && this.gate('quip', 120)) fx.text(e.x, e.y, e.z + 120, ['FILED!', 'SHREDDED!', 'ARCHIVED!', 'OUT OF OFFICE!', 'ESCALATED!'][Math.floor(Math.random() * 5)], { size: 26, col: '#ffffff', life: 50, pop: true }); break;
        case 'phurt': { fx.burst('star', e.x, e.y, e.z, 5, 0.8); fx.burst('coffee', e.x, e.y, e.z, 4, 0.8); if (e.dmg > 0) fx.text(e.x, e.y, e.z + 30, '-' + Math.round(e.dmg), { size: 26, col: '#ff8a8a', life: 40 }); A.sfx('phurt');
          if (Math.random() < 0.25) { const p = sim.players.find(q => q.id === e.p); this.bubble(e.x, e.y, 200, p.char.lines.hurt[Math.floor(Math.random() * p.char.lines.hurt.length)]); } break; }
        case 'pko': fx.text(e.x || sim.players[0].x, e.y || sim.players[0].y, 220, 'OUT OF OFFICE', { size: 44, col: '#ff8a3d', life: 120 }); A.sfx('boom'); break;
        case 'dash': A.sfx('dash'); fx.burst('paper', e.x, e.y, 5, 3, 0.4); break;
        case 'land': A.sfx('thud'); break;
        case 'thud': A.sfx('thud'); fx.burst('paper', e.x, e.y, 5, 3, 0.5); break;
        case 'skill': { const nm = { coffee: 'slurp', staples: 'kachunk', briefcase: 'throw' }[e.id]; A.sfx(nm); fx.text(e.x, e.y, 230, e.name.toUpperCase() + '!', { size: 28, col: '#6fd3ff', life: 40, vz: 40 }); break; }
        case 'buff': fx.burst('coffee', e.x, e.y, 120, 10, 1); break;
        case 'ult_ready': A.sfx('ready'); { const p = sim.players[0]; fx.text(p.x, p.y, 260, 'CLOCK OUT READY!', { size: 30, col: '#ffd34d', life: 70, pop: true }); } break;
        case 'overtime': A.sfx('overtime'); break;
        case 'ult_start': A.sfx('bell'); break;
        case 'ult_hit': {
          A.sfx('ultHit'); this.cameras.main.flash(260, 255, 255, 240);
          const p = sim.players[0]; fx.shock(p.x, p.y, 0xffd34d, true); fx.shock(p.x, p.y, 0x6fd3ff, true);
          for (const en of sim.enemies) { fx.burst('paper', en.x, en.y, 80, 10, 1.4); }
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
            this.scene.stop('HUD'); this.scene.stop('Touch');
            if (e.result.scene) this.scene.start('Cutscene', { scene: e.result.scene, next: 'Result', data: res });
            else this.scene.start('Result', res);
          }); break;
        }
        case 'failed': this.ended = true; A.stop(); window.__failed = true;
          if (this.mode === 'survival') { this.survOver = { score: sim.score, wave: sim.surv.wave, sec: sim.stats.frames / 60 }; this.survOver.best = CO.save.survivalBest(this.survOver); window.__survival = this.survOver; }
          this.time.delayedCall(1600, () => { this.scene.pause(); this.scene.pause('HUD'); this.scene.launch('GameOver', { mode: this.mode, stage: this.S.id, surv: this.survOver, checkpoint: sim.checkpoint, continues: sim.continues, stats: sim.stats, clock: this.S.clock }); this.scene.bringToTop('GameOver'); }); break;
      }
    }
  }

  // ---------------- HUD ----------------
  class HUD extends Phaser.Scene {
    constructor() { super('HUD'); }
    create() {
      this.game_ = this.scene.get('Game'); const sim = () => this.game_.sim;
      const c = sim().players[0].char;
      const g = this.g = this.add.graphics();
      // portrait frame
      this.add.image(70, 70, c.portrait).setDisplaySize(104, 104);
      const fr = this.add.graphics(); fr.lineStyle(4, 0x6fd3ff); fr.strokeRoundedRect(18, 18, 104, 104, 10);
      const nmT = this.add.text(136, 18, c.name, CO.style(28, '#ffffff'));
      this.add.text(136 + nmT.width + 10, 27, '"' + c.title + '"', CO.style(15, '#9aa7c7'));
      this.hpT = this.add.text(452, 52, '', CO.style(15)).setOrigin(1, 0.5);
      this.mpT = this.add.text(452, 78, '', CO.style(13, '#cfe8ff')).setOrigin(1, 0.5);
      this.otT = this.add.text(136, 104, 'CLOCK-OUT', CO.style(14, '#ffd34d')).setOrigin(0, 0.5);
      // combo
      this.combo = this.add.text(1250, 40, '', CO.style(64, '#ffffff')).setOrigin(1, 0);
      this.hits = this.add.text(1250, 104, 'HITS', CO.style(30, '#6fd3ff')).setOrigin(1, 0).setVisible(false);
      this.otBadge = this.add.text(1250, 140, 'OVERTIME!', CO.style(40, '#ffc83d')).setOrigin(1, 0).setVisible(false);
      // top centre
      this.floorT = this.add.text(640, 16, '', CO.style(20, '#ffffff')).setOrigin(0.5, 0);
      this.clockT = this.add.text(640, 42, '', CO.style(22, '#ffd34d')).setOrigin(0.5, 0);
      this.add.image(640 - 130, 54, 'ic_clock').setDisplaySize(26, 26).setVisible(false);
      // skills bar
      this.touch = CO.touchOn();
      this.skills = [];
      const keys = CO.lastDevice === 'gamepad' ? ['LB', 'RB', 'LT', 'LB+RB'] : ['U', 'I', 'O', ';'];
      const all = c.skills.concat([Object.assign({ cost: 0 }, c.ult)]);
      all.forEach((sk, i) => {
        const x = 640 - 165 + i * 110, y = 650;
        const ic = this.add.image(x, y, sk.icon).setDisplaySize(84, 84);
        const kt = this.add.text(x - 36, y - 40, keys[i], CO.style(16, '#ffffff')).setOrigin(0, 0);
        const nm = this.add.text(x, y + 47, sk.name, CO.style(13, '#cfe8ff')).setOrigin(0.5, 0);
        this.skills.push({ ic, kt, nm, x, y, sk, i });
      });
      this.skG = this.add.graphics();
      this.setSkillsVisible(!this.touch);
      // boss bar
      this.bossName = this.add.text(640, 88, '', CO.style(22, '#ffd34d')).setOrigin(0.5, 0).setVisible(false);
      // banners
      this.banner = this.add.text(640, 300, '', CO.style(64, '#ffffff', { align: 'center' })).setOrigin(0.5).setAlpha(0);
      this.bannerSub = this.add.text(640, 370, '', CO.style(26, '#cfe8ff', { align: 'center', wordWrap: { width: 1000 } })).setOrigin(0.5).setAlpha(0);
      // ult cut-in
      this.ultBg = this.add.rectangle(640, 360, 1280, 720, 0x06081a, 0.7).setAlpha(0);
      this.ultBand = this.add.rectangle(640, 360, 1280, 220, 0xffc83d, 1).setAlpha(0).setAngle(-6);
      this.ultPort = this.add.image(-200, 360, c.portrait).setDisplaySize(240, 240);
      this.ultTitle = this.add.text(2000, 320, 'CLOCK OUT', CO.style(96, '#0d1022', { stroke: '#ffffff', strokeThickness: 8 })).setOrigin(0.5);
      this.ultLine = this.add.text(2000, 410, '', CO.style(34, '#ffffff')).setOrigin(0.5);
      this.ultClock = this.add.image(640, 360, 'ic_clock').setDisplaySize(300, 300).setAlpha(0);
      // GO → prompt (story, between locked areas)
      this.goT = this.add.text(1240, 330, 'GO →', CO.style(64, '#7dff8a')).setOrigin(1, 0.5).setVisible(false);
      this.goSub = this.add.text(1240, 380, '', CO.style(22, '#ffffff')).setOrigin(1, 0.5).setVisible(false);
      this.goOn = false;
      // compact panels for P2..P5 (co-op ready)
      this.mini = sim().players.slice(1).map((p, k) => ({ p, y: 146 + k * 46, t: this.add.text(18, 146 + k * 46, 'P' + (k + 2) + ' ' + p.char.name, CO.style(16, '#' + (CO.PLAYER_COLORS[k + 1] || 0xffffff).toString(16).padStart(6, '0'))) }));
      this.game_.events.on('ev', this.onEv, this);
      this.events.once('shutdown', () => this.game_.events.off('ev', this.onEv, this));
      const S = this.game_.S; this.S = S;
      this.floorLabel = S.num ? 'STAGE ' + S.num + ' · ' + S.name : 'SURVIVAL';
    }
    setSkillsVisible(v) { this.skills.forEach(s => { s.ic.setVisible(v); s.kt.setVisible(v); s.nm.setVisible(v); }); this.skG.setVisible(v); }
    show(msg, sub, col = '#ffffff', hold = 1800) {
      this.tweens.killTweensOf([this.banner, this.bannerSub]);
      this.banner.setText(msg).setColor(col).setAlpha(0).setScale(0.6); this.bannerSub.setText(sub || '').setAlpha(0);
      this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 250, ease: 'Back.out' });
      this.tweens.add({ targets: this.bannerSub, alpha: 1, duration: 300, delay: 120 });
      this.tweens.add({ targets: [this.banner, this.bannerSub], alpha: 0, duration: 400, delay: hold });
    }
    onEv(e) {
      const S = this.S, sim = this.game_.sim, base = S.num ? 'STAGE ' + S.num + ' · ' + S.name : 'SURVIVAL';
      switch (e.t) {
        case 'card': this.show(e.title, e.sub + '\n' + (e.lines || []).join('\n'), '#ffd34d', 2600); break;
        case 'wave': if (e.surv) { this.floorLabel = 'SURVIVAL · WAVE ' + e.n; this.show('WAVE ' + e.n, e.text, '#ffffff', 1500); }
          else { this.floorLabel = base + ' · AREA ' + (sim.enc + 1) + '/' + S.encounters.length; if (e.n === 1) this.show(e.of > 1 ? 'WAVE 1/' + e.of : 'FIGHT!', e.text, '#ffffff', 1500); else this.show('WAVE ' + e.n + '/' + e.of, e.text, '#ffffff', 1200); }
          break;
        case 'waveclear': if (e.surv) this.show('WAVE ' + e.wave + ' SURVIVED', '+' + (400 * e.wave) + ' pts · +12% HP', '#8ee35a', 1000); break;
        case 'lock': this.goOn = false; break;
        case 'go': this.goOn = true; this.floorLabel = base; this.goSub.setText(e.label ? 'to the ' + e.label : ''); break;
        case 'bossintro': this.floorLabel = base + ' · BOSS'; this.show('BOSS', e.text, '#ff9a2e', 2000); this.bossName.setText(e.name).setVisible(true); break;
        case 'banner': this.show(e.msg, e.sub, '#ff9a2e', 1600); break;
        case 'overtime': this.show('OVERTIME!', '50+ hits — damage up, meter fills faster!', '#ffc83d', 1000); this.tweens.add({ targets: this.otBadge, scale: { from: 1.6, to: 1 }, duration: 300 }); break;
        case 'bossdown': this.show('BOSS DEFEATED', '"' + sim.boss.def.defeat[0] + '"', '#ffd34d', 2200); break;
        case 'clear': this.goOn = false; this.show(e.result.scene === 'lobby' ? 'THE EXIT IS BLOCKED!' : S.num === 5 ? 'STARSHIFT!' : 'STAGE CLEAR!', S.clear, e.result.scene === 'lobby' ? '#ff9a2e' : '#8ee35a', 2400); break;
        case 'failed': this.show('OUT OF OFFICE', 'Lemon has been… reassigned.', '#ff8a3d', 1600); break;
        case 'ult_start': this.ult(e.line); break;
        case 'ult_hit': this.tweens.add({ targets: [this.ultBg, this.ultBand, this.ultClock], alpha: 0, duration: 200 }); this.ultPort.x = -200; this.ultTitle.x = 2000; this.ultLine.x = 2000; break;
      }
    }
    ult(line) {
      this.ultBg.setAlpha(0); this.ultBand.setAlpha(0); this.ultLine.setText('"' + line + '"');
      this.tweens.add({ targets: this.ultBg, alpha: 1, duration: 150 });
      this.tweens.add({ targets: this.ultBand, alpha: 0.92, duration: 150, delay: 100 });
      this.ultPort.x = -200; this.tweens.add({ targets: this.ultPort, x: 260, duration: 260, delay: 100, ease: 'Back.out' });
      this.ultTitle.x = 2000; this.tweens.add({ targets: this.ultTitle, x: 780, duration: 260, delay: 160, ease: 'Back.out' });
      this.ultLine.x = 2000; this.tweens.add({ targets: this.ultLine, x: 780, duration: 260, delay: 260, ease: 'Back.out' });
      this.ultClock.setAlpha(0).setAngle(0); this.tweens.add({ targets: this.ultClock, alpha: 0.35, angle: 720, duration: 1000, delay: 300 });
    }
    bar(x, y, w, h, k, col, back = 0x1a1f38) { const g = this.g; g.fillStyle(0x000000, 0.6); g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 4); g.fillStyle(back); g.fillRect(x, y, w, h); g.fillStyle(col); g.fillRect(x, y, w * Phaser.Math.Clamp(k, 0, 1), h); g.fillStyle(0xffffff, 0.25); g.fillRect(x, y, w * Phaser.Math.Clamp(k, 0, 1), h / 3); }
    update(t) {
      const sim = this.game_.sim; if (!sim) return; const p = sim.players[0], g = this.g; g.clear();
      const tc = CO.touchOn(); if (tc !== this.touch) { this.touch = tc; this.setSkillsVisible(!tc); }
      this.bar(136, 44, 318, 18, p.hp / p.maxhp, p.hp < p.maxhp * 0.3 && Math.floor(t / 200) % 2 ? 0xff7a7a : 0xe8384f);
      this.bar(136, 72, 318, 12, p.mp / p.maxmp, 0x3fa8ff);
      const ready = p.ot >= 100;
      this.bar(220, 98, 234, 12, p.ot / 100, ready ? (Math.floor(t / 120) % 2 ? 0xffffff : 0xffc83d) : 0xffc83d);
      this.otT.setText(ready ? 'READY!' : 'CLOCK-OUT');
      this.hpT.setText(Math.ceil(p.hp) + ' / ' + p.maxhp); this.mpT.setText('CAFFEINE ' + Math.floor(p.mp));
      // combo
      const show = p.combo >= 2; this.combo.setVisible(show).setText(p.combo + ''); this.hits.setVisible(show);
      this.combo.setColor(p.overtime ? '#ffc83d' : '#ffffff'); this.otBadge.setVisible(p.overtime);
      if (p.overtime) this.otBadge.setAngle(Math.sin(t / 80) * 3);
      if (show) { g.fillStyle(0x000000, 0.5); g.fillRect(1250 - 160, 136 + (p.overtime ? 48 : 0), 160, 6); g.fillStyle(p.overtime ? 0xffc83d : 0x6fd3ff); g.fillRect(1250 - 160, 136 + (p.overtime ? 48 : 0), 160 * p.comboT / (p.overtime ? 190 : 150), 6); }
      // clock / survival counters
      const left = Math.max(0, 20 * 3600 - sim.gameSec), lm = Math.floor(left / 60);
      this.floorT.setText(this.floorLabel);
      if (sim.mode === 'survival') {
        const sec = Math.floor(sim.stats.frames / 60), best = this.best || (this.best = CO.save.best());
        this.clockT.setText('WAVE ' + sim.surv.wave + '  ·  ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + '  ·  ' + sim.score.toLocaleString() + ' PTS  ·  BEST ' + Math.max(best.score, sim.score).toLocaleString()).setColor(sim.score > best.score && best.score ? '#7dff8a' : '#ffd34d');
      } else this.clockT.setText('🕒 ' + CO.fmtClock(sim.gameSec) + '   ·   STARSHIFT in ' + (left <= 0 ? 'NOW!!' : Math.floor(lm / 60) + 'h ' + String(lm % 60).padStart(2, '0') + 'm')).setColor(lm < 30 ? '#ff9a2e' : '#ffd34d');
      // GO → prompt
      const go = this.goOn && sim.state === 'roam' && !sim.locked;
      this.goT.setVisible(go && Math.floor(t / 350) % 2 === 0); this.goSub.setVisible(go); if (go) this.goT.x = 1240 + Math.sin(t / 120) * 10;
      // P2..P5 compact panels
      for (const m of this.mini) { const q = m.p; this.bar(18, m.y + 22, 160, 8, q.hp / q.maxhp, 0xe8384f); this.bar(186, m.y + 22, 60, 8, q.ot / 100, 0xffc83d); }
      // skills
      if (!this.touch) {
        const sg = this.skG; sg.clear();
        this.skills.forEach(s => {
          const isUlt = s.i === 3, cd = isUlt ? 0 : p.cds[s.i], max = isUlt ? 1 : s.sk.cd, cant = isUlt ? !ready : (p.mp < s.sk.cost);
          s.ic.setAlpha(cant ? 0.45 : 1);
          if (cd > 0) { sg.fillStyle(0x000000, 0.6); sg.slice(s.x, s.y, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / max), false); sg.fillPath(); }
          if (isUlt) { sg.fillStyle(0x000000, 0.55); sg.fillRect(s.x - 42, s.y - 42, 84, 84 * (1 - p.ot / 100)); if (ready) { sg.lineStyle(4, 0xffc83d, 0.6 + Math.sin(t / 100) * 0.4); sg.strokeCircle(s.x, s.y, 48); } }
        });
      }
      // boss bar
      if (sim.boss && sim.boss.state !== 'intro' || (sim.boss && sim.boss.st > 40)) {
        const b = sim.boss; this.bossName.setVisible(true);
        this.bar(340, 118, 600, 16, b.hp / b.maxhp, b.phase === 2 ? 0xff9a2e : 0xffc83d);
        g.fillStyle(0xffffff, 0.8); g.fillRect(340 + 300, 116, 2, 20);
        this.bar(340, 140, 600 * (b.def.poise / b.def.poise), 5, b.state === 'dizzy' ? 0 : b.poise / b.def.poise, 0x9ff8ff);
      } else this.bossName.setVisible(false);
    }
  }

  // ---------------- Touch controls ----------------
  class Touch extends Phaser.Scene {
    constructor() { super('Touch'); }
    create() {
      this.input.addPointer(5);
      this.g = this.add.graphics(); this.labels = [];
      const c = CO.CHARACTERS.lemon;
      // layout (game coords, 1280x720)
      this.btns = [
        { a: 'light', x: 1140, y: 600, r: 72, label: 'ATK', col: 0x1fd1e8 },
        { a: 'heavy', x: 1010, y: 640, r: 56, label: 'HVY', col: 0xffc83d },
        { a: 'jump', x: 1190, y: 460, r: 54, label: 'JUMP', col: 0x8ee35a },
        { a: 'dash', x: 1055, y: 510, r: 50, label: 'DASH', col: 0xb8c4ff },
        { a: 's1', x: 880, y: 660, r: 42, icon: 'ic_coffee', i: 0 },
        { a: 's2', x: 900, y: 560, r: 42, icon: 'ic_stapler', i: 1 },
        { a: 's3', x: 960, y: 445, r: 42, icon: 'ic_briefcase', i: 2 },
        { a: 'ult', x: 1110, y: 360, r: 46, icon: 'ic_clock', ult: true },
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

  CO.Scenes.Game = Game; CO.Scenes.HUD = HUD; CO.Scenes.Touch = Touch;
})(window.CO);
