// Clock Out! — procedural textures, particles, slash arcs, floating text. Render-only.
(function (CO) {
  CO.makeTextures = function (scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const tex = (key, w, h, fn) => { g.clear(); fn(g); g.generateTexture(key, w, h); };
    tex('shadow', 120, 40, g => { g.fillStyle(0x000000, 0.38); g.fillEllipse(60, 20, 118, 38); });
    tex('p_paper', 20, 24, g => { g.fillStyle(0xffffff); g.fillRect(0, 0, 20, 24); g.fillStyle(0x9aa7b8); for (let i = 0; i < 5; i++) g.fillRect(3, 4 + i * 4, 14 - (i === 4 ? 6 : 0), 1.5); g.lineStyle(1, 0x55606e); g.strokeRect(0, 0, 20, 24); });
    tex('p_ink', 18, 18, g => { g.fillStyle(0x1b2a6b); g.fillCircle(9, 9, 8); g.fillStyle(0x3d55c4); g.fillCircle(6, 6, 3); });
    tex('p_coffee', 14, 14, g => { g.fillStyle(0x6b3e1e); g.fillCircle(7, 7, 6); g.fillStyle(0xb07a4a); g.fillCircle(5, 5, 2); });
    tex('p_slime', 24, 24, g => { g.fillStyle(0x8ee35a, 0.9); g.fillCircle(12, 12, 11); g.fillStyle(0xd6ff9e, 0.9); g.fillCircle(8, 8, 4); });
    tex('p_star', 26, 26, g => { g.fillStyle(0xffe14d); const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12, a = -Math.PI / 2 + i * Math.PI / 5; pts.push({ x: 13 + Math.cos(a) * r, y: 13 + Math.sin(a) * r }); } g.fillPoints(pts, true); g.lineStyle(2, 0x9a6a00); g.strokePoints(pts, true); });
    tex('p_spark', 8, 26, g => { g.fillStyle(0xffffff); g.fillEllipse(4, 13, 6, 24); });
    tex('p_dot', 8, 8, g => { g.fillStyle(0xffffff); g.fillCircle(4, 4, 4); });
    tex('staple', 30, 12, g => { g.lineStyle(4, 0xd8dee8); g.beginPath(); g.moveTo(2, 2); g.lineTo(2, 10); g.lineTo(28, 10); g.lineTo(28, 2); g.strokePath(); g.lineStyle(1, 0x5c6470); g.strokeRect(0, 0, 30, 12); });
    tex('briefcase', 64, 48, g => { g.fillStyle(0x6b4425); g.fillRoundedRect(2, 10, 60, 36, 6); g.lineStyle(4, 0x3a2412); g.strokeRoundedRect(20, 2, 24, 12, 4); g.fillStyle(0xd9b45a); g.fillRect(28, 22, 8, 8); g.lineStyle(2, 0x2a170a); g.strokeRoundedRect(2, 10, 60, 36, 6); });
    tex('note', 28, 28, g => { g.fillStyle(0xffe066); g.fillRect(1, 1, 26, 26); g.fillStyle(0xe0b830); g.fillTriangle(27, 18, 27, 27, 18, 27); g.fillStyle(0x7a6620); g.fillRect(5, 8, 16, 2); g.fillRect(5, 14, 12, 2); });
    tex('bean', 34, 26, g => { g.fillStyle(0x6b3e1e); g.fillEllipse(17, 13, 30, 22); g.lineStyle(3, 0x3a1f0c); g.beginPath(); g.moveTo(9, 6); g.lineTo(25, 20); g.strokePath(); g.lineStyle(2, 0xffffff, 0.6); g.strokeEllipse(17, 13, 30, 22); });
    tex('donut', 38, 30, g => { g.fillStyle(0xf7e3c0); g.fillTriangle(2, 26, 36, 26, 30, 4); g.fillStyle(0xff8fc8); g.fillTriangle(10, 14, 30, 4, 33, 14); g.fillStyle(0xd94f70); g.fillCircle(30, 6, 4); g.lineStyle(2, 0x7a4b2a); g.strokeTriangle(2, 26, 36, 26, 30, 4); });
    tex('ring', 256, 128, g => { g.lineStyle(10, 0xffffff, 1); g.strokeEllipse(128, 64, 240, 112); });
    tex('glow', 128, 128, g => { for (let i = 16; i > 0; i--) { g.fillStyle(0xffffff, 0.04); g.fillCircle(64, 64, i * 4); } });
    tex('stopwatch', 40, 46, g => { g.fillStyle(0xdddddd); g.fillCircle(20, 26, 18); g.fillStyle(0xffffff); g.fillCircle(20, 26, 14); g.fillStyle(0x888888); g.fillRect(16, 2, 8, 6); g.lineStyle(3, 0x222222); g.strokeCircle(20, 26, 18); g.beginPath(); g.moveTo(20, 26); g.lineTo(20, 15); g.strokePath(); });
    tex('paperball', 30, 30, g => { g.fillStyle(0xf4f4ee); g.fillCircle(15, 15, 13); g.lineStyle(2, 0x9aa7b8); g.beginPath(); g.moveTo(6, 10); g.lineTo(14, 16); g.lineTo(22, 8); g.moveTo(9, 22); g.lineTo(18, 18); g.lineTo(24, 22); g.strokePath(); g.lineStyle(2, 0x55606e); g.strokeCircle(15, 15, 13); });
    tex('form', 30, 36, g => { g.fillStyle(0xffd6d6); g.fillRect(1, 1, 28, 34); g.fillStyle(0xc0392b); g.fillRect(4, 4, 22, 5); g.fillStyle(0x7a6060); for (let i = 0; i < 4; i++) g.fillRect(4, 13 + i * 5, 20 - i * 3, 2); g.lineStyle(2, 0x8a3030); g.strokeRect(1, 1, 28, 34); });
    g.destroy();
  };

  class FX {
    constructor(scene) {
      this.s = scene; this.parts = []; this.pool = []; this.arcs = []; this.texts = []; this.tpool = [];
      this.gfx = scene.add.graphics().setDepth(5000).setBlendMode(Phaser.BlendModes.ADD);
    }
    part(tex, x, y, z, o = {}) {
      let img = this.pool.pop(); if (!img) img = this.s.add.image(0, 0, tex); else img.setTexture(tex).setVisible(true);
      img.setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setTint(o.tint || 0xffffff).setAlpha(1);
      const p = { img, x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 40, max: o.life || 40, rot: o.rot || Math.random() * 6, vr: o.vr || 0, grav: o.grav === undefined ? 900 : o.grav, sc: o.sc || 1, sc1: o.sc1 === undefined ? (o.sc || 1) : o.sc1, drag: o.drag || 0.98, flut: o.flut || 0 };
      this.parts.push(p); if (this.parts.length > 420) this.kill(this.parts.shift()); return p;
    }
    kill(p) { p.img.setVisible(false); this.pool.push(p.img); }
    burst(kind, x, y, z, n, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (120 + Math.random() * 300) * power;
        const o = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.4, vz: 150 + Math.random() * 350 * power, vr: (Math.random() - 0.5) * 14, life: 30 + Math.random() * 25 };
        if (kind === 'paper') { o.grav = 260; o.drag = 0.95; o.flut = 1; o.life = 60 + Math.random() * 40; o.sc = 0.7 + Math.random() * 0.6; }
        if (kind === 'star') { o.grav = 500; o.sc = 0.6 + Math.random() * 0.5; o.sc1 = 0.1; }
        if (kind === 'slime') { o.grav = 0; o.vz = 40; o.vx *= 0.3; o.vy *= 0.3; o.sc = 0.6; o.sc1 = 1.8; o.life = 24; }
        if (kind === 'ink' || kind === 'coffee') { o.grav = 1300; o.sc = 0.6 + Math.random() * 0.7; }
        if (kind === 'spark') { o.grav = 0; o.add = true; o.tint = power > 1.2 ? 0xffd34d : 0x9ff8ff; o.life = 10 + Math.random() * 8; o.vz = 0; o.sc = 0.8; o.sc1 = 0.2; o.drag = 0.85; o.rot = a + Math.PI / 2; o.vr = 0; o.vx = Math.cos(a) * sp * 2; o.vy = Math.sin(a) * sp * 1.4; }
        this.part(kind === 'spark' ? 'p_spark' : 'p_' + kind, x, y, z, o);
      }
    }
    hit(x, y, z, kind, heavy, gold) {
      this.burst('spark', x, y, z, heavy ? 10 : 6, gold ? 1.5 : 1);
      this.burst(kind, x, y, z, heavy ? 8 : 4, heavy ? 1.3 : 0.9);
      if (Math.random() < 0.5) this.burst('star', x, y, z + 20, heavy ? 3 : 1, 0.6);
      const f = this.part('glow', x, y, z, { grav: 0, life: 8, sc: heavy ? 1.3 : 0.8, sc1: 0.2, add: true, tint: gold ? 0xffd34d : 0x9ff8ff, vr: 0 });
    }
    poof(x, y, z) { // defeated zombie -> paperwork
      this.burst('paper', x, y, z + 60, 16, 1.2); this.burst('slime', x, y, z + 50, 5, 1); this.burst('star', x, y, z + 90, 3, 0.8);
      for (let i = 0; i < 4; i++) this.part('p_paper', x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 12, 2, { grav: 0, life: 120, vr: 0, rot: (Math.random() - 0.5) * 0.6, sc: 1.2, drag: 1 });
    }
    shock(x, y, col, big) { const p = this.part('ring', x, y, 0, { grav: 0, life: 18, sc: 0.2, sc1: big ? 1.8 : 1.1, vr: 0, rot: 0, add: true, tint: col }); p.flat = true; this.burst('paper', x, y, 10, big ? 10 : 5, 1); }
    arc(x, y, z, face, a0, a1, o = {}) { this.arcs.push({ x, y, z, face, a0, a1, t: 0, T: o.T || 11, rx: o.rx || 130, ry: o.ry || 62, col: o.col || 0x5ff6ff, vert: !!o.vert, w: o.w || 26, follow: o.follow }); }
    text(x, y, z, msg, o = {}) {
      let t = this.tpool.pop();
      const st = { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: (o.size || 26) + 'px', color: o.col || '#ffffff', stroke: o.stroke || '#14182b', strokeThickness: o.size > 30 ? 7 : 5 };
      if (!t) t = this.s.add.text(0, 0, msg, st).setOrigin(0.5); else { t.setStyle(st).setText(msg).setVisible(true); }
      t.setAngle(o.angle || 0).setScale(1).setAlpha(1);
      this.texts.push({ t, x: x + (o.jit ? (Math.random() - 0.5) * 30 : 0), y, z, vz: o.vz === undefined ? 90 : o.vz, life: o.life || 50, max: o.life || 50, pop: o.pop });
      if (this.texts.length > 14) { const k = this.texts.shift(); k.t.setVisible(false); this.tpool.push(k.t); }
    }
    // Damage numbers merge: hits landing near an existing fresh number add to it (less clutter).
    dmg(x, y, z, n, heavy) {
      const q = this.texts.find(q => q.dmg && q.max - q.life < 30 && Math.abs(q.x - x) < 90 && Math.abs(q.y - y) < 60);
      if (q) { q.n += n; q.life = q.max; q.t.setText(String(q.n)); q.pop = true; if (heavy) q.t.setColor('#ffd34d'); return; }
      this.text(x, y, z, String(n), { size: heavy ? 34 : 26, col: heavy ? '#ffd34d' : '#ffffff', life: 38, pop: heavy });
      const t = this.texts[this.texts.length - 1]; t.dmg = true; t.n = n;
    }
    update(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i]; p.life--;
        if (p.life <= 0) { this.kill(p); this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt; p.vx *= p.drag; p.vy *= p.drag;
        if (p.flut) p.vx += Math.sin(p.life * 0.2) * 12;
        if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; p.vr *= 0.5; }
        p.rot += p.vr * dt; const k = 1 - p.life / p.max;
        p.img.setPosition(p.x, p.y - p.z).setRotation(p.rot).setScale(p.sc + (p.sc1 - p.sc) * k, (p.sc + (p.sc1 - p.sc) * k) * (p.flat ? 1 : 1)).setDepth(p.z < 4 && !p.flat && p.grav === 0 && p.max >= 100 ? 2 : p.y + 6);
        if (p.flat) p.img.setDepth(3);
        p.img.setAlpha(Math.min(1, p.life / Math.min(18, p.max)));
      }
      const g = this.gfx; g.clear();
      for (let i = this.arcs.length - 1; i >= 0; i--) {
        const a = this.arcs[i]; a.t++; if (a.t > a.T) { this.arcs.splice(i, 1); continue; }
        if (a.follow) { a.x = a.follow.x; a.y = a.follow.y; a.z = a.follow.z; }
        const k = a.t / a.T, cx = a.x, cy = a.y - a.z - (a.vert ? 80 : 60);
        const sweep = Math.min(1, k * 2.2), d0 = a.a0 * Math.PI / 180, d1 = a.a1 * Math.PI / 180;
        const end = d0 + (d1 - d0) * sweep, start = d0 + (d1 - d0) * Math.max(0, k * 1.6 - 0.6);
        const steps = 22, outer = [], inner = []; const w = a.w * (1 - k * 0.7);
        for (let s = 0; s <= steps; s++) {
          const ang = start + (end - start) * s / steps, taper = Math.sin(Math.PI * s / steps);
          const ux = Math.cos(ang) * a.face, uy = Math.sin(ang);
          const rx = a.rx, ry = a.vert ? a.rx : a.ry;
          outer.push({ x: cx + ux * rx, y: cy + uy * ry }); inner.push({ x: cx + ux * (rx - w * taper), y: cy + uy * (ry - w * taper * (a.vert ? 1 : 0.5)) });
        }
        const pts = outer.concat(inner.reverse());
        g.fillStyle(a.col, 0.55 * (1 - k)); g.fillPoints(pts, true);
        g.lineStyle(3, 0xffffff, 0.9 * (1 - k)); g.strokePoints(outer, false);
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const q = this.texts[i]; q.life--;
        if (q.life <= 0) { q.t.setVisible(false); this.tpool.push(q.t); this.texts.splice(i, 1); continue; }
        q.z += q.vz * dt; q.vz *= 0.92; const k = 1 - q.life / q.max;
        const sc = q.pop ? (k < 0.15 ? 0.4 + k * 6 : 1.3 - Math.min(0.3, k)) : 1;
        q.t.setPosition(q.x, q.y - q.z).setDepth(6000).setScale(sc).setAlpha(q.life < 15 ? q.life / 15 : 1);
      }
    }
  }
  CO.FX = FX;
})(window.CO);
