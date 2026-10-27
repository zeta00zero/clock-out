// Clock Out! — procedural textures, particles, slash arcs, floating text. Render-only.
(function (CO) {
  CO.makeTextures = function (scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const tex = (key, w, h, fn) => { g.clear(); fn(g); g.generateTexture(key, w, h); };
    // soft contact shadow + v4 canvas textures (gradients)
    const cv = (key, w, h, fn) => { if (scene.textures.exists(key)) return; const t = scene.textures.createCanvas(key, w, h); fn(t.getContext(), w, h); t.refresh(); };
    cv('shadow', 120, 40, (c, w, h) => { c.save(); c.translate(w / 2, h / 2); c.scale(1, h / w); const gr = c.createRadialGradient(0, 0, 2, 0, 0, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.34)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, w / 2, 0, 7); c.fill(); c.restore(); });
    cv('vignette', 640, 360, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, h * 0.38, w / 2, h / 2, w * 0.62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    cv('shaft', 200, 720, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(70, 0); c.lineTo(130, 0); c.lineTo(200, h); c.lineTo(0, h); c.closePath(); c.save(); c.filter = 'blur(6px)'; c.fill(); c.restore(); });
    cv('band', 64, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    cv('mist', 256, 128, (c, w, h) => { c.save(); c.translate(w / 2, h / 2); c.scale(1, h / w); const gr = c.createRadialGradient(0, 0, 0, 0, 0, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, w / 2, 0, 7); c.fill(); c.restore(); });
    cv('softdot', 32, 32, (c, w, h) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    cv('rain', 4, 40, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(200,225,255,0)'); gr.addColorStop(1, 'rgba(225,240,255,0.9)'); c.fillStyle = gr; c.fillRect(1, 0, 2, h); });
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
    tex('form', 30, 36, g => { g.fillStyle(0xd6e4ff); g.fillRect(1, 1, 28, 34); g.fillStyle(0x3b6bd0); g.fillRect(4, 4, 22, 5); g.fillStyle(0x60687a); for (let i = 0; i < 4; i++) g.fillRect(4, 13 + i * 5, 20 - i * 3, 2); g.lineStyle(2, 0x30508a); g.strokeRect(1, 1, 28, 34); });
    // v4 projectile textures (original designs, no red)
    tex('bolt', 64, 16, g => { g.fillStyle(0x4fe6ff, 0.35); g.fillEllipse(32, 8, 64, 16); g.fillStyle(0x9ff8ff); g.fillEllipse(34, 8, 48, 8); g.fillStyle(0xffffff); g.fillEllipse(38, 8, 32, 4); });
    tex('keyboard', 56, 24, g => { g.fillStyle(0x4a5368); g.fillRoundedRect(0, 2, 56, 20, 3); g.fillStyle(0xcfd6e6); for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) g.fillRect(3 + c * 6, 5 + r * 5.5, 4.6, 3.8); g.lineStyle(2, 0x1c2233); g.strokeRoundedRect(0, 2, 56, 20, 3); });
    tex('pen', 44, 12, g => { g.fillStyle(0x2d56c8); g.fillRoundedRect(0, 3, 32, 6, 3); g.fillStyle(0xdfe6f2); g.fillTriangle(32, 3, 32, 9, 44, 6); g.fillStyle(0xffffff); g.fillRect(4, 4, 18, 1.5); g.lineStyle(1.5, 0x14204a); g.strokeRoundedRect(0, 3, 32, 6, 3); });
    tex('box', 46, 42, g => { g.fillStyle(0xc99a5b); g.fillRect(2, 8, 42, 32); g.fillStyle(0xdbb176); g.fillRect(2, 8, 42, 8); g.fillStyle(0xeadbb8); g.fillRect(19, 8, 8, 32); g.lineStyle(2.5, 0x6b4a22); g.strokeRect(2, 8, 42, 32); g.beginPath(); g.moveTo(2, 8); g.lineTo(10, 2); g.lineTo(36, 2); g.lineTo(44, 8); g.strokePath(); });
    tex('case2', 58, 42, g => { g.fillStyle(0x2c3550); g.fillRoundedRect(2, 10, 54, 30, 5); g.lineStyle(4, 0x151b30); g.strokeRoundedRect(19, 2, 20, 12, 4); g.fillStyle(0xcfd6e6); g.fillRect(25, 21, 8, 7); g.fillStyle(0x8a95b3); g.fillRect(2, 24, 54, 2); g.lineStyle(2, 0x0d1224); g.strokeRoundedRect(2, 10, 54, 30, 5); });
    tex('sax', 44, 44, g => { g.lineStyle(9, 0xe0b030); g.beginPath(); g.moveTo(10, 4); g.lineTo(16, 28); g.lineTo(26, 38); g.lineTo(36, 30); g.strokePath(); g.lineStyle(3, 0xfff1a0); g.beginPath(); g.moveTo(8, 6); g.lineTo(14, 28); g.strokePath(); g.fillStyle(0xe0b030); g.fillTriangle(30, 24, 44, 22, 38, 38); g.fillStyle(0x7a5a10); g.fillCircle(15, 14, 2); g.fillCircle(17, 22, 2); });
    tex('eviction', 40, 52, g => { g.fillStyle(0xfaf3dc); g.fillRect(1, 1, 38, 50); g.fillStyle(0x2d56c8); g.fillRect(5, 5, 30, 6); g.fillStyle(0x6a6a72); for (let i = 0; i < 4; i++) g.fillRect(5, 16 + i * 6, 30 - (i === 3 ? 12 : 0), 2); g.lineStyle(3, 0x2d56c8); g.strokeCircle(26, 40, 6); g.lineStyle(2, 0x3a3a44); g.strokeRect(1, 1, 38, 50); });
    tex('p_shard', 24, 24, g => { g.fillStyle(0xdff4ff, 0.9); g.fillTriangle(2, 22, 22, 14, 10, 2); g.lineStyle(1.5, 0xffffff, 0.9); g.strokeTriangle(2, 22, 22, 14, 10, 2); });
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
      this.parts.push(p); if (this.parts.length > (CO.fxHigh() ? 420 : 240)) this.kill(this.parts.shift()); return p;
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
    dust(x, y, n = 3, col = 0xcfc4b0) { for (let i = 0; i < n; i++) this.part('mist', x + (Math.random() - 0.5) * 30, y, 6, { grav: 0, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 20, vz: 20 + Math.random() * 30, life: 26, sc: 0.18, sc1: 0.5, tint: col, drag: 0.94 }); }
    ringAt(x, y, r, col, life = 14, grow = false) { const full = r * 2 / 240, p = this.part('ring', x, y, 0, { grav: 0, life, sc: grow ? full * 0.15 : full, sc1: full, rot: 0, add: true, tint: col }); p.flat = true; p.rot = 0; return p; }
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

  // ----------------------------------------------------------------------------------------------------------------
  // v4: effects quality + per-stage lighting presets + the screen-space Ambient scene (sun shafts, motes, glow bands,
  // flicker, twinkles, rain/splashes/ripples/mist/lightning). Everything is a handful of pooled sprites: no post-FX.
  // ----------------------------------------------------------------------------------------------------------------
  CO.fxHigh = () => { const m = CO.settings.fx || 'auto'; if (CO.params && CO.params.fx) return CO.params.fx === 'high'; if (m === 'high') return true; if (m === 'low') return false; return !CO.touchOn() && !CO.fxAutoLow; };
  CO.LIGHT = {
    f3:     { amb: 0xfff0d8, rim: 0xffd68c, rim2: 0, refl: 0.10, vig: 0.45, shafts: { n: 5, col: 0xffe2a0, a: 0.17 }, motes: { n: 36, col: 0xfff0c0 }, tube: true },
    f2:     { amb: 0xdde8ff, rim: 0x6fb4ff, rim2: 0xc06bff, refl: 0.16, vig: 0.55, bands: [{ y: 150, h: 140, col: 0x39c8ff, a: 0.10, spd: 1.1 }, { y: 190, h: 90, col: 0xc060ff, a: 0.08, spd: 0.7 }], motes: { n: 22, col: 0x9fd8ff }, flickScr: true },
    lobby:  { amb: 0xffe8cc, rim: 0xffc27a, rim2: 0, refl: 0.26, vig: 0.42, shafts: { n: 4, col: 0xffb870, a: 0.20 }, motes: { n: 30, col: 0xffe0a0 } },
    lift:   { amb: 0xfff0d6, rim: 0xffcd82, rim2: 0x78bfff, refl: 0.22, vig: 0.55, motes: { n: 20, col: 0xffe6b0 }, tube: true, cabFlick: true, bands: [{ y: 60, h: 120, col: 0xffd9a0, a: 0.07, spd: 0.8 }] },
    roof:   { amb: 0xc8d4ff, rim: 0xffa860, rim2: 0x6fa0ff, refl: 0.12, vig: 0.50, twinkle: 36, clouds: 2, motes: { n: 12, col: 0xcfe0ff } },
    apt:    { amb: 0xffe0c4, rim: 0xffb070, rim2: 0x8fb8ff, refl: 0.14, vig: 0.58, shafts: { n: 4, col: 0xffa860, a: 0.18 }, motes: { n: 30, col: 0xffd8a0 }, tube: true },
    streets:{ amb: 0xe8deff, rim: 0xff5ac8, rim2: 0x50e6ff, refl: 0.34, vig: 0.55, rain: 150, mist: 4, neon: true, lightning: true, grade: [0x0a0828, 0.10], motes: { n: 0, col: 0xffffff } },
    arena:  { amb: 0xdde4ff, rim: 0xffd34d, rim2: 0x6fd3ff, refl: 0.10, vig: 0.55, spots: 2, alarm: true, motes: { n: 18, col: 0xfff0c0 } },
    liftarena: { amb: 0xfff0d6, rim: 0xffcd82, rim2: 0x78bfff, refl: 0.22, vig: 0.55, motes: { n: 18, col: 0xffe6b0 }, tube: true, cabFlick: true, alarm: true },
  };
  class Ambient extends Phaser.Scene {
    constructor() { super('Ambient'); }
    rebuild() { this.scene.restart(); }
    create() {
      this.G = this.scene.get('Game'); const S = this.S = this.G.S; this.L = CO.LIGHT[S.light] || CO.LIGHT.arena; const L = this.L;
      this.high = CO.fxHigh(); this.T = 0; this.lightningT = 400 + Math.random() * 500; this.flickT = 0;
      this.add.image(640, 360, 'vignette').setDisplaySize(1280, 720).setAlpha(L.vig === undefined ? 0.5 : L.vig * (this.high ? 1 : 0.8)).setDepth(1);
      if (L.grade) this.add.rectangle(640, 360, 1280, 720, L.grade[0], L.grade[1]).setDepth(0);
      this.shafts = []; this.motes = []; this.bands = []; this.rain = []; this.splash = []; this.mist = []; this.stars = []; this.cloud = [];
      const hi = this.high, B = Phaser.BlendModes.ADD;
      if (L.shafts) { const n = hi ? L.shafts.n : Math.max(2, L.shafts.n - 2); for (let i = 0; i < n; i++) this.shafts.push({ im: this.add.image(0, 0, 'shaft').setOrigin(0.5, 0).setBlendMode(B).setTint(L.shafts.col).setDepth(2), x: 150 + i * (1280 / n) + Math.random() * 60, sc: 0.8 + Math.random() * 1.0, ph: Math.random() * 6, a: L.shafts.a }); }
      if (L.spots) for (let i = 0; i < L.spots; i++) this.shafts.push({ im: this.add.image(0, 0, 'shaft').setOrigin(0.5, 0).setBlendMode(B).setTint(0xdfe8ff).setDepth(2), x: 400 + i * 480, sc: 1.0, ph: i * 3, a: 0.12, sweep: true });
      const mn = L.motes ? (hi ? L.motes.n : Math.floor(L.motes.n * 0.5)) : 0;
      for (let i = 0; i < mn; i++) this.motes.push({ im: this.add.image(Math.random() * 1280, Math.random() * 720, 'softdot').setBlendMode(B).setTint(L.motes.col).setDepth(3).setScale(0.18 + Math.random() * 0.3), vx: -4 + Math.random() * 10, vy: 6 + Math.random() * 12, ph: Math.random() * 6 });
      if (L.bands) for (const b of L.bands) this.bands.push({ im: this.add.image(640, b.y, 'band').setDisplaySize(1280, b.h).setBlendMode(B).setTint(b.col).setAlpha(b.a).setDepth(2), b });
      if (L.rain) { const n = hi ? L.rain : 70; for (let i = 0; i < n; i++) this.rain.push({ im: this.add.image(Math.random() * 1400, Math.random() * 720, 'rain').setDepth(3).setAlpha(0.35 + Math.random() * 0.35).setRotation(0.13).setScale(1, 0.7 + Math.random() * 0.9), v: 1000 + Math.random() * 500 });
        for (let i = 0; i < (hi ? 24 : 12); i++) this.splash.push({ im: this.add.image(0, 0, 'ring').setDepth(2.5).setVisible(false).setTint(0xcfe0ff), t: -1, x: 0, y: 0 }); }
      if (L.mist) for (let i = 0; i < (hi ? L.mist : 2); i++) this.mist.push({ im: this.add.image(Math.random() * 1280, 470 + Math.random() * 200, 'mist').setScale(5 + Math.random() * 3, 2.5).setTint(0xb6a8ff).setAlpha(0.14).setDepth(2), vx: 6 + Math.random() * 10 });
      if (L.twinkle) { const n = hi ? L.twinkle : Math.floor(L.twinkle / 2); for (let i = 0; i < n; i++) this.stars.push({ im: this.add.image(0, 0, 'softdot').setBlendMode(B).setTint([0xfff4c8, 0xffd48a, 0xaee0ff][i % 3]).setDepth(2).setScale(0.12 + Math.random() * 0.18), wx: Math.random() * S.len, wy: 30 + Math.random() * 170, ph: Math.random() * 6, sp: 1.5 + Math.random() * 3 }); }
      if (L.clouds) for (let i = 0; i < L.clouds; i++) this.cloud.push({ im: this.add.image(Math.random() * 1280, 120 + i * 200, 'mist').setScale(7, 3).setTint(0x05081a).setAlpha(0.22).setDepth(1), vx: 8 + i * 4 });
      this.dark = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0).setDepth(4);
      this.white = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0).setDepth(5).setBlendMode(B);
      this.pulse = this.add.rectangle(640, 360, 1280, 720, 0xffd9a0, 0).setDepth(5).setBlendMode(B);
      if (L.alarm) this.alarm = this.add.rectangle(640, 360, 1280, 720, 0xffa030, 0).setDepth(4).setBlendMode(B);
      this.G.events.on('ev', this.onEv, this); this.events.once('shutdown', () => this.G.events.off('ev', this.onEv, this));
    }
    onEv(e) {
      if (e.t === 'lift_ding' || e.t === 'doors') { this.pulse.setFillStyle(0xfff0c0).setAlpha(0.5); this.tweens.add({ targets: this.pulse, alpha: 0, duration: 500 }); }
      else if (e.t === 'ult_hit') { this.white.setAlpha(0.5); this.tweens.add({ targets: this.white, alpha: 0, duration: 300 }); }
      else if (e.t === 'floor') { this.pulse.setFillStyle(0xffe6b0).setAlpha(0.25); this.tweens.add({ targets: this.pulse, alpha: 0, duration: 400 }); }
    }
    w2s(wx, wy) { const c = this.G.cameras.main, v = c.worldView; return [(wx - v.x) * c.zoom, (wy - v.y) * c.zoom]; }
    update(time, delta) {
      const dt = Math.min(0.05, delta / 1000), L = this.L, G = this.G; if (!G.sim) return; this.T += dt; const T = this.T, cam = G.cameras.main;
      const sx = cam.worldView.x;
      for (const s of this.shafts) { const a = s.sweep ? 0.10 + 0.05 * Math.sin(T * 0.8 + s.ph) : 0.6 + 0.4 * Math.sin(T * 0.35 + s.ph); const x = s.sweep ? 640 + Math.sin(T * 0.5 + s.ph) * 460 : (((s.x - sx * 0.25) % 1500) + 1500) % 1500 - 110;
        s.im.setPosition(x, -20).setScale(s.sc * 1.3, 1.1).setAlpha(s.a * (s.sweep ? a * 5 : a) * (G.flickK === undefined ? 1 : G.flickK)); }
      for (const m of this.motes) { m.im.x += m.vx * dt; m.im.y += m.vy * dt + Math.sin(T + m.ph) * 0.2; if (m.im.y > 740) { m.im.y = -10; m.im.x = Math.random() * 1280; } if (m.im.x > 1300) m.im.x = -10; if (m.im.x < -20) m.im.x = 1290; m.im.setAlpha(0.25 + 0.5 * Math.abs(Math.sin(T * 1.3 + m.ph))); }
      for (const b of this.bands) { const k = 0.6 + 0.4 * Math.sin(T * b.b.spd * 2 + b.b.y); b.im.setAlpha(b.b.a * (L.flickScr && Math.random() < 0.03 ? 0.3 : k)); }
      // flicker (cab light dips / tube / monitors)
      let dark = 0; this.flickT--;
      if ((L.cabFlick || L.tube) && this.flickT <= 0) { if (Math.random() < (L.cabFlick ? 0.01 : 0.004)) this.flickT = 6 + Math.random() * 18; }
      if (this.flickT > 0 && (L.cabFlick || L.tube)) dark = (L.cabFlick ? 0.28 : 0.12) * (this.flickT % 4 < 2 ? 1 : 0.4);
      this.dark.setAlpha(dark);
      if (this.alarm) { const sim = G.sim, w = sim.surv ? sim.surv.wave : 0; this.alarm.setAlpha(Math.min(0.07, w * 0.004) * (0.5 + 0.5 * Math.sin(T * 5))); }
      // rain / splashes / ripples / mist / lightning
      if (this.rain.length) {
        for (const r of this.rain) { r.im.y += r.v * dt; r.im.x -= r.v * 0.13 * dt; if (r.im.y > 740) { r.im.y = -40; r.im.x = Math.random() * 1400; } }
        const band = this.S.band; let free = 0;
        for (const sp of this.splash) {
          if (sp.t < 0) { if (Math.random() < 0.35 && free < 2) { free++; sp.t = 0; const wx = cam.worldView.x + Math.random() * cam.worldView.width, wy = band[0] + Math.random() * (band[1] - band[0]); sp.x = wx; sp.y = wy; sp.big = Math.random() < 0.3; sp.im.setVisible(true).setTint(sp.big ? 0xffb0f0 : 0xcfe0ff); } continue; }
          sp.t += dt; const k = sp.t / (sp.big ? 0.9 : 0.4); if (k >= 1) { sp.t = -1; sp.im.setVisible(false); continue; }
          const [px, py] = this.w2s(sp.x, sp.y); sp.im.setPosition(px, py).setScale((sp.big ? 0.05 + k * 0.22 : 0.02 + k * 0.07) * cam.zoom, (sp.big ? 0.05 + k * 0.22 : 0.02 + k * 0.07) * cam.zoom * 0.9).setAlpha((1 - k) * (sp.big ? 0.45 : 0.6));
        }
        if (L.lightning && !CO.params.noflash) { this.lightningT--; if (this.lightningT <= 0) { this.lightningT = 900 + Math.random() * 1500; this.white.setFillStyle(0xcfd8ff); this.tweens.add({ targets: this.white, alpha: { from: 0.35, to: 0 }, duration: 160, yoyo: false }); this.time.delayedCall(180, () => { this.white.setAlpha(0.25); this.tweens.add({ targets: this.white, alpha: 0, duration: 380 }); }); } }
      }
      for (const m of this.mist) { m.im.x += m.vx * dt; if (m.im.x > 1700) m.im.x = -400; m.im.setAlpha(0.10 + 0.05 * Math.sin(T * 0.4 + m.vx)); }
      for (const s of this.stars) { const [px, py] = this.w2s(s.wx, s.wy); s.im.setPosition(px, py).setAlpha(0.15 + 0.85 * Math.max(0, Math.sin(T * s.sp + s.ph))); }
      for (const c of this.cloud) { c.im.x += c.vx * dt; if (c.im.x > 1900) c.im.x = -600; }
    }
  }
  CO.AmbientScene = Ambient;
  CO.FX = FX;
})(window.CO);
