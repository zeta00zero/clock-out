// Clock Out! — combat simulation. Pure logic: no Phaser, no DOM.
// The renderer reads state + drains `events`. A future online host runs this
// same Sim and ships snapshots; clients only render + send intents.
(function (CO) {
  const DT = 1 / 60, GRAV = 2100, EGRAV = 1900;
  const ACTIONS = ['light', 'heavy', 'jump', 'dash', 's1', 's2', 's3', 'ult'];
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sign = v => v < 0 ? -1 : 1;

  class Sim {
    constructor(opts = {}) {
      this.rng = mulberry32(opts.seed || 1234);
      this.stage = CO.STAGES[opts.stage || 'survival'];
      this.mode = this.stage.len ? 'story' : 'survival';
      this.scroll = !!this.stage.len;   // story stages scroll left->right through connected areas
      if (this.scroll) {
        const S = this.stage; this.world = { w: S.len, h: S.h };
        this.A = { x0: 40, x1: 1240, y0: S.band[0], y1: S.band[1] };
        this.view = { x: 0, w: 1280 }; this.enc = -1; this.scrollMin = 0; this.locked = false; this.curWaves = [];
        const cp = typeof opts.checkpoint === 'number' ? opts.checkpoint : -1;
        if (cp >= 0) { this.enc = cp - 1; this.scrollMin = Math.max(0, S.encounters[cp].x - 1100); this.A.x0 = this.scrollMin + 40; this.A.x1 = this.scrollMin + 1240; }
      } else { this.world = this.stage.world; this.A = Object.assign({}, this.stage.arena); }
      this.surv = { wave: 0, level: 0, start: Math.max(1, Math.min(100, opts.level || 1)) }; this.spdMul = 1; this.eliteP = 0; this.score = opts.score || 0; this.hpMul = 1; this.dmgMul = 1;
      this.clockRate = this.mode === 'survival' ? 20 : 3;   // v4: story clock 3 game-sec per sec so 7 stages fit 5:59 -> ~7:50 PM
      this.players = []; this.enemies = []; this.projs = []; this.hazards = []; this.pickups = [];
      this.boss = null; this.zones = []; this.lures = []; this.allies = []; this.cd = 0; this.events = []; this.frame = 0; this.hitstop = 0; this.timeStop = 0; this.slowmo = 0;
      this.nextId = 1; this.state = 'start'; this.st = 0; this.wave = -1; this.queue = []; this.spawnT = 0;
      this.checkpoint = opts.checkpoint || null; this.continues = opts.continues || 0;
      this.gameSec = opts.clock || this.stage.clock || (17 * 60 + 59) * 60; // story starts 5:59 PM
      this.stats = Object.assign({ kos: 0, maxCombo: 0, dmgTaken: 0, overtimes: 0, frames: 0, ults: 0 }, opts.stats || {});
      this.god = !!opts.god; this.result = null;
    }
    ev(e) { this.events.push(e); return e; }
    r(a = 0, b = 1) { return a + (b - a) * this.rng(); }

    // ---------- players ----------
    addPlayer(charId, slot) {
      const c = CO.CHARACTERS[charId], s = c.stats;
      const sx = this.scroll ? this.A.x0 + 160 + slot * 55 : (this.A.x0 + this.A.x1) / 2 - 80 + slot * 60;
      const sy = (this.A.y0 + this.A.y1) / 2 + (this.scroll ? (slot - 2) * 32 : 40);
      const p = { id: this.nextId++, kind: 'player', slot, char: c, x: sx, y: sy, runDist: 0, runT: 0, stopT: 0,
        z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: s.hp, maxhp: s.hp, mp: s.mp * 0.6, maxmp: s.mp, ot: 0, combo: 0, comboT: 0, overtime: false,
        state: 'idle', st: 0, move: null, mt: 0, hitMap: null, buf: {}, iframes: 60, cds: c.skills.map(() => 0), buff: 0, airChain: 0,
        charge: 0, slowT: 0, slowV: 0, blind: 0, castId: 0, airDashed: false, alive: true, pose: c.poses.idle, rot: 0, flip: false, w: s.w, flash: 0, reviveT: 0, otReady: false };
      this.players.push(p); return p;
    }
    alivePlayers() { return this.players.filter(p => p.alive); }

    step(intents) {
      this.events.length = 0;
      if (this.hitstop > 0) { this.hitstop--; return; }
      this.frame++; this.stats.frames++; if (this.allBeatT > 0) this.allBeatT--;
      if (this.state !== 'clear' && this.state !== 'failed' && this.state !== 'won') this.gameSec += this.clockRate * DT;
      this.players.forEach((p, i) => this.updatePlayer(p, p.auto ? this.autoIntent(p) : (intents[i] || CO.emptyIntent())));
      if (this.timeStop > 0) { this.timeStop--; } else {
        this.updateAuras();
        for (const e of this.enemies) this.updateEnemy(e);
        if (this.boss) this.updateBoss(this.boss);
        this.updateProjs(); this.updateKeith(); this.updateHazards(); this.updateZones(); this.separate(); this.wallClamp();
      }
      this.updatePickups();
      this.enemies = this.enemies.filter(e => !e.gone);
      this.director();
    }

    updatePlayer(p, it) {
      const c = p.char, S = c.stats;
      if (!p.alive) { p.pose = c.poses.down; p.vx *= 0.8; this.physics(p, GRAV); return; }
      p.held = it.h;
      for (const a of ACTIONS) { if (it.p[a]) p.buf[a] = 9; else if (p.buf[a] > 0) p.buf[a]--; }
      if (p.iframes > 0) p.iframes--;
      if (p.flash > 0) p.flash--;
      const PV = c.passive || {};
      p.stillT = (p.state === 'idle' && Math.abs(it.mx) < 0.2 && Math.abs(it.my) < 0.2) ? (p.stillT || 0) + 1 : 0;
      p.mp = Math.min(p.maxmp, p.mp + S.mpRegen * DT * (PV.napAfter && p.stillT >= PV.napAfter ? PV.napMul : 1));
      if (p.shieldT > 0 && --p.shieldT <= 0) p.shield = 0;
      if (p.wallT > 0) p.wallT--;
      if (p.atkUpT > 0) p.atkUpT--;
      p.cds = p.cds.map(v => Math.max(0, v - DT));
      if (p.buff > 0) p.buff -= DT;
      if (p.blind > 0) p.blind--;
      if (p.slowT > 0) p.slowT--; else p.slowV = 0;
      if (p.comboT > 0 && --p.comboT <= 0) { if (p.overtime) this.ev({ t: 'overtime_end', p: p.id }); p.combo = 0; p.overtime = false; }
      const BM = c.buffMul || { aspd: 1.3, spd: 1.3, dmg: 1.1 };
      const aspd = p.buff > 0 ? BM.aspd : 1, spd = S.speed * (p.buff > 0 ? BM.spd : 1) * (1 - (p.slowT > 0 ? p.slowV : 0));
      const take = a => { if (p.buf[a] > 0) { p.buf[a] = 0; return true; } return false; };
      const mx = it.mx, my = it.my;
      if (Math.abs(mx) > 0.25) p.wantFace = sign(mx); else p.wantFace = 0;
      p.st++;
      const free = p.state === 'idle' || p.state === 'run';
      const tryGeneric = (cancelAll) => {
        if (p.ot >= 100 && (take('ult'))) return this.startUlt(p);
        for (let i = 0; i < c.skills.length; i++) if (p.buf['s' + (i + 1)] > 0) { const sk = c.skills[i]; if (p.mp >= sk.cost && p.cds[i] <= 0) { take('s' + (i + 1)); return this.startSkill(p, i); } else if (cancelAll) { take('s' + (i + 1)); this.ev({ t: 'nope', p: p.id, x: p.x, y: p.y, msg: p.mp < sk.cost ? 'Need caffeine' : 'Cooldown' }); } }
        if (take('dash')) return this.startDash(p);
        return false;
      };
      if (free) {
        if (tryGeneric(true)) return this.physics(p, GRAV);
        if (take('jump')) { p.state = 'air'; p.vz = S.jump; p.airChain = 0; this.ev({ t: 'sfx', s: 'jump', p: p.id }); }
        else if (take('light')) this.startMove(p, c.start.light);
        else if (take('heavy')) this.startMove(p, c.start.heavy);
        else {
          p.vx = mx * spd; p.vy = my * spd * 0.72;
          const P = c.poses, moving = Math.abs(mx) + Math.abs(my) > 0.2;
          if (p.wantFace && p.wantFace !== p.face && moving && p.runT >= (P.jogUntil || 22) && P.turn) { p.turnT = P.turnTicks || 5; p.runT = 14; }
          if (p.wantFace) p.face = p.wantFace;
          p.state = moving ? 'run' : 'idle'; p.rot = 0; p.flip = false;
          // v3 run animation (visual only): accel start -> jog blend -> full 24-frame sprint (advances by
          // distance, so no foot-sliding); analog sticks under walkBelow use the walk cycle; a hard
          // direction reversal plays a turn frame; stopping from a sprint plays a 3-frame skid with a short slide.
          if (moving) {
            const amag = Math.hypot(mx, my * 1.2);
            p.runDist += Math.hypot(p.vx, p.vy * 1.25) * DT; p.stopT = 0;
            const R = P.run;
            if (p.turnT > 0) { p.turnT--; p.pose = P.turn[p.turnT > 2 ? 0 : 1]; }
            else if (P.walk && amag < (P.walkBelow || 0.55)) { p.runT = Math.min(p.runT + 1, 12); p.pose = P.walk[Math.floor(p.runDist / P.walkStride) % P.walk.length]; }
            else {
              p.runT++;
              const ss = P.startStep || 2;
              if (P.start && p.runT <= P.start.length * ss) p.pose = P.start[Math.min(P.start.length - 1, Math.floor((p.runT - 1) / ss))];
              else if (P.jog && P.jogStride && p.runT < (P.jogUntil || 22)) p.pose = P.jog[Math.floor(p.runDist / P.jogStride) % P.jog.length];
              else p.pose = R[(Math.floor(p.runDist / (P.runStride || 40)) + (P.runOffset || 0)) % R.length];
            }
          } else {
            if (p.runT >= (P.jogUntil || 22) && P.skid) p.stopT = P.skidTicks || 12;
            p.runT = 0; p.runDist = 0; p.turnT = 0;
            if (p.stopT > 0) {
              const n = P.skid.length, k = Math.min(n - 1, Math.floor((P.skidTicks - p.stopT) / (P.skidTicks / n)));
              p.pose = P.skid[k]; p.vx = p.face * S.speed * 0.5 * (p.stopT / P.skidTicks); p.stopT--;
            } else p.pose = P.idle;
          }
        }
      } else if (p.state === 'air') {
        p.vx = mx * spd * 0.85; p.vy = my * spd * 0.5; if (p.wantFace) p.face = p.wantFace;
        p.pose = p.vz > 0 ? c.poses.rise : c.poses.fall; p.rot = p.vz > 0 ? 0 : 0.15; p.flip = false;
        if (take('light') && p.airChain < 6) this.startMove(p, c.start.air);
        else if (take('heavy')) this.startMove(p, c.start.airHeavy);
        else if (c.skills.some((sk, i) => sk.air && p.buf['s' + (i + 1)] > 0 && p.mp >= sk.cost && p.cds[i] <= 0)) { const i = c.skills.findIndex((sk, i) => sk.air && p.buf['s' + (i + 1)] > 0 && p.mp >= sk.cost && p.cds[i] <= 0); take('s' + (i + 1)); this.startSkill(p, i); p.vz = Math.max(p.vz, 200); }
        else if (c.passive && c.passive.airDash && !p.airDashed && take('dash')) { p.airDashed = true; this.startDash(p); p.vz = 0; }
        // v4.2: DOUBLE JUMP, generic for every character (stats.airJumps default 1, stats.jump2 default 85% of jump); once per airtime, reset on landing
        else if ((p.airJumps || 0) < (S.airJumps == null ? 1 : S.airJumps) && take('jump')) {
          p.airJumps = (p.airJumps || 0) + 1; p.vz = S.jump2 || S.jump * 0.85; p.djT = 18; p.airChain = 0;
          this.ev({ t: 'djump', x: p.x, y: p.y, z: p.z, p: p.id });
        }
        if (p.djT > 0) { p.djT--; p.rot = -(1 - p.djT / 18) * Math.PI * 2; }
      } else if (p.state === 'move') {
        this.runMove(p, aspd, take, tryGeneric, mx);
      } else if (p.state === 'dash') {
        const DD = c.passive && c.passive.dashCd ? Math.round(18 * c.passive.dashCd) : 18;
        const k = p.st / DD; p.vx = p.face * S.dash * (1 - k * 0.6); p.vy = (my || 0) * S.speed * 0.4;
        p.pose = c.poses.dash; p.rot = 0; if (p.z > 0) p.vz = Math.max(p.vz, 0) * 0.5;
        if (p.st > 3 && take('light')) this.startMove(p, c.start.dashLight);
        else if (p.st >= DD) { p.state = p.z > 0 ? 'air' : 'idle'; p.st = 0; }
      } else if (p.state === 'skill') {
        this.runSkill(p, aspd);
      } else if (p.state === 'ult') {
        this.runUlt(p);
      } else if (p.state === 'hurt') {
        p.pose = c.poses.hurt; p.vx *= 0.85; p.vy *= 0.85;
        if (p.st >= p.stun) { p.state = 'idle'; p.st = 0; }
      } else if (p.state === 'down') {
        p.pose = c.poses.down; p.vx *= 0.9; p.vy *= 0.9;
        if (p.st >= 55 && p.z <= 0) { p.state = 'idle'; p.st = 0; p.iframes = 50; }
      }
      this.physics(p, (p.state === 'move' && p.move && p.move.air && p.mt < (p.move.active[1] || 0)) ? GRAV * 0.55 : GRAV);
      if (p.z <= 0 && p.state === 'air') { p.state = 'idle'; p.st = 0; p.airDashed = false; p.airJumps = 0; p.djT = 0; this.ev({ t: 'land', x: p.x, y: p.y, p: p.id }); }
    }

    physics(o, g) {
      if (o.kind === 'player' && o.z <= 0 && o.vz <= 0 && o.state !== 'air') { o.airJumps = 0; o.djT = 0; }
      o.x += o.vx * DT; o.y += o.vy * DT;
      if (o.z > 0 || o.vz > 0) { o.z += o.vz * DT; o.vz -= g * DT; if (o.z <= 0) { o.z = 0; o.landed = Math.abs(o.vz); o.vz = 0; } }
      const A = this.A, pad = o.kind === 'boss' ? 30 : 0;
      if (o.kind === 'player' || o.state !== 'enter') { o.x = clamp(o.x, A.x0 + pad, A.x1 - pad); { const [a, b] = this.bandFor(o); o.y = clamp(o.y, a, b); } }
    }

    startMove(p, id) {
      const m = p.char.moves[id]; if (!m) return false;
      if (m.air && p.z <= 0 && !m.dive) return false;
      if (m.air && !m.dive && p.airChain >= (m.maxChain || 6)) return false;
      p.state = 'move'; p.move = m; p.moveId = id; p.mt = 0; p.prevMt = -1; p.hitMap = new Map(); p.charge = 0; p.st = 0;
      if (p.wantFace) p.face = p.wantFace;
      if (m.air) { p.airChain++; if (m.dive) { p.vz = -1700; p.vx = p.face * 120; } }
      this.ev({ t: 'sfx', s: m.sfx || 'swing', delay: m.active[0], p: p.id });
      return true;
    }

    runMove(p, aspd, take, tryGeneric, mx) {
      const m = p.move, c = p.char;
      // charge hold
      if (m.chargeable && p.held && p.held.heavy && p.mt >= m.charge.from && p.charge < m.charge.max && p.mt < m.active[0]) {
        p.charge++; if (p.charge === 22) this.ev({ t: 'charged', p: p.id, x: p.x, y: p.y });
      } else p.mt += aspd;
      const f = Math.floor(p.mt), pf = Math.floor(p.prevMt);
      p.prevMt = p.mt;
      for (const ps of m.poses) if (f >= ps[0]) { p.pose = ps[1]; p.rot = ps[2] || 0; p.flip = !!ps[3]; }
      if (m.charge && p.charge > 0 && p.mt < m.active[0]) p.rot = -0.1 - Math.min(p.charge, 40) * 0.004 + Math.sin(p.charge) * 0.03;
      // lunge during startup->active
      if (m.lunge && f < m.active[1]) { p.vx = p.face * m.lunge * (1 - f / m.active[1]); p.vy *= 0.5; } else if (p.z <= 0) { p.vx *= 0.7; p.vy *= 0.7; }
      if (m.air && !m.dive) { p.vx *= 0.9; p.vy *= 0.8; }
      if (f >= m.active[0] && pf < m.active[0] && m.proj) {
        const Q = m.proj;
        this.projs.push({ id: this.nextId++, kind: 'pbolt', tex: 'kbolt', bolt: true, owner: p, x: p.x + p.face * 70, y: p.y, z: p.z + 120, vx: p.face * Q.speed, vy: 0, life: Q.life, dmg: Q.dmg, kb: Q.kb, stun: Q.stun, pierce: Q.pierce, hit: new Set() });
      }
      if (f >= m.active[0] && pf < m.active[0]) {
        if (m.selfLaunch) { p.vz = m.selfLaunch; }
        if (m.hover && p.vz < m.hover) p.vz = m.hover;
        const charged = m.charge && p.charge >= 22;
        this.ev({ t: 'swing', p: p.id, move: p.moveId, x: p.x, y: p.y, z: p.z, face: p.face, arc: m.arc, spin: m.spin, shock: m.shock, charged, overtime: p.overtime, flip: p.flip, beam: m.beam ? m.beam + (charged ? 120 : 0) : 0 });
        if (m.shock) this.ev({ t: 'shake', a: charged ? 0.012 : 0.006, d: charged ? 260 : 140 });
      }
      if (m.dive) {
        if (p.z <= 0 && !p.dived) { p.dived = true; this.doHits(p, m, true); this.ev({ t: 'swing', p: p.id, move: p.moveId, x: p.x, y: p.y, z: 0, face: p.face, shock: true }); this.ev({ t: 'shake', a: 0.01, d: 200 }); p.mt = m.total - 16; p.vx = 0; }
        if (!p.dived) p.mt = Math.min(p.mt, m.total - 17);
      } else if (f >= m.active[0] && f <= m.active[1]) this.doHits(p, m, false);
      // cancels
      if (f >= m.cancel) {
        if (m.next.light && take('light')) { if (this.startMove(p, m.air && p.z <= 0 ? c.start.light : m.next.light)) return; }
        if (m.next.heavy && take('heavy')) { if (this.startMove(p, m.next.heavy)) return; }
        if (m.jumpCancel && f > m.active[1] && take('jump')) { p.move = null; p.state = 'air'; p.st = 0; p.vz = p.char.stats.jump; p.airChain = 0; p.rot = 0; this.ev({ t: 'sfx', s: 'jump', p: p.id }); return; }
        if (p.z > 0 && m.air === undefined && take('light')) { this.startMove(p, c.start.air); return; }
        if (tryGeneric(false)) return;
      }
      if (p.mt >= m.total) { p.dived = false; p.move = null; p.state = p.z > 0 ? 'air' : 'idle'; p.st = 0; p.rot = 0; p.flip = false; }
    }

    hitTest(p, h, tx, ty, tz, tw, face) {
      const cx = p.x + face * h.fx, dx = (tx - cx) / (h.rx + tw), dy = (ty - p.y) / (h.ry + tw * 0.5);
      if (dx * dx + dy * dy > 1) return false;
      return Math.abs(tz - p.z) <= h.zr;
    }

    doHits(p, m, once) {
      const charged = m.charge && p.charge >= 22;
      const h = charged ? Object.assign({}, m.hit, { rx: m.charge.rx, ry: m.charge.ry }) : m.hit;
      const targets = this.enemies.filter(e => e.state !== 'dead' && e.state !== 'enter2');
      if (this.boss && this.boss.state !== 'dead' && this.boss.state !== 'intro') targets.push(this.boss);
      const f = Math.floor(p.mt); let any = false;
      for (const e of targets) {
        if (h.air && e.z <= 0 && p.z > 40 && Math.abs(e.z - p.z) > h.zr) continue;
        if (!this.hitTest(p, h, e.x, e.y, e.z, e.w, p.face)) continue;
        const last = p.hitMap.get(e.id);
        if (last !== undefined && (!m.every || f - last < m.every)) continue;
        if (m.maxTargets && last === undefined && p.hitMap.size >= m.maxTargets) continue;
        p.hitMap.set(e.id, f);
        const finisher = m.every && f >= m.active[1] - m.every;
        let dmg = charged ? m.charge.dmg : m.dmg;
        this.damage(e, p, { dmg, kb: finisher && m.finalKb ? m.finalKb : m.kb, stun: m.stun, launch: m.launch, juggle: m.juggle,
          knockdown: m.knockdown || charged, breaksGuard: m.breaksGuard || charged, stampText: charged ? (m.charge.name || 'FINAL DRAFT') : m.stampText, from: p.x, heavy: m.dmg >= 40 || charged });
        any = true;
      }
      if (any) this.hitstop = Math.max(this.hitstop, m.dmg >= 40 || charged ? 5 : 2);
    }

    // generic damage from a player to an enemy/boss
    damage(e, p, o) {
      if (e.state === 'dead') return;
      let dmg = o.dmg * (p && p.overtime ? 1.25 : 1) * (p && p.buff > 0 ? (p.char.buffMul ? p.char.buffMul.dmg : 1.1) : 1) * (p && p.atkUpT > 0 ? (p.atkUpMul || 1.25) : 1);
      if (p && p.char.passive && p.char.passive.catAtk) dmg *= 1 + p.char.passive.catAtk * this.allies.filter(a => a.owner === p).length;
      if (p && p.kind === 'player') dmg *= this.onBeat(p, e);   // v5 Wei Yao: On Beat x1.5 (also team-wide during Prism Center Live!)
      if (e.def.kbResist && e.kind === 'enemy') o = Object.assign({}, o, { kb: o.kb * (1 - e.def.kbResist) });
      // v4 frontal blockers (WFH laptop 50%, Umbrella 70%): hit them from behind or with guard-breakers
      if (e.def.block && e.kind === 'enemy' && !o.breaksGuard && e.state !== 'air' && e.state !== 'down' && e.z <= 0 && sign((p ? p.x : o.from) - e.x) === e.face) {
        dmg *= 1 - e.def.block; if (this.frame - (e.blkT || -99) > 20) { e.blkT = this.frame; this.ev({ t: 'block', x: e.x, y: e.y, z: 100, msg: e.def.block >= 0.7 ? 'UMBRELLA' : 'LAPTOP' }); }
      }
      const dir = sign(e.x - (o.from !== undefined ? o.from : (p ? p.x : e.x)));
      let fx = ['paper', 'star', 'slime', 'ink', 'coffee'][Math.floor(this.rng() * 5)];
      if (p && p.char.hitFx) fx = p.char.hitFx;
      // HR Shield blocks frontal hits
      if (e.type === 'hr' && !e.shieldDown && e.state !== 'air' && e.state !== 'down' && sign((p ? p.x : o.from) - e.x) === e.face && e.z <= 0) {
        if (!o.breaksGuard) {
          e.guard--; dmg *= 0.12; e.vx += dir * 60;
          this.ev({ t: 'block', x: e.x, y: e.y, z: 70, msg: e.guard > 0 ? 'DENIED' : 'COMPLAINT FILED' });
          if (e.guard > 0) { e.hp -= dmg; this.comboHit(p); return; }
        }
        e.shieldDown = 300; e.guard = e.def.guard;
        this.ev({ t: 'text', x: e.x, y: e.y, z: 120, msg: 'SHIELD DOWN!', col: '#ffd34d' });
      }
      if (e.kind === 'boss') {
        if (e.state === 'dizzy') dmg *= 1.5;
        if (o.stagger && e.def.kit === 'landlord' && e.state !== 'dizzy' && e.lastCast !== o.castId) {   // 3 briefcase / drift casts stagger the Landlord
          e.lastCast = o.castId; e.skillHits = (e.skillHits || 0) + 1;
          if (e.skillHits >= 3) { e.skillHits = 0; e.state = 'dizzy'; e.st = 0; this.ev({ t: 'text', x: e.x, y: e.y, z: 260, msg: 'STAGGERED!', col: '#ffd34d' }); this.ev({ t: 'sfx', s: 'dizzy' }); }
        }
        if (e.state === 'aura') { this.ev({ t: 'block', x: e.x, y: e.y, z: 200, msg: 'IMMUNE' }); return; }
        e.hp -= dmg; e.dmgTaken = (e.dmgTaken || 0) + dmg;
        if (e.def.scripted && e.hp <= e.maxhp * e.def.scripted) { e.hp = e.maxhp * e.def.scripted; this.startAura(e); } e.flash = 4; e.poise -= dmg;
        if (e.poise <= 0 && e.state !== 'dizzy') { e.state = 'dizzy'; e.st = 0; e.poise = e.def.poise; this.ev({ t: 'text', x: e.x, y: e.y, z: 260, msg: 'OVERWHELMED!', col: '#ffd34d' }); this.ev({ t: 'sfx', s: 'dizzy' }); }
        e.vx += dir * Math.min(60, o.kb * 0.15);
        this.ev({ t: 'hit', x: e.x, y: e.y, z: 140 + this.r(-40, 40), dmg: Math.round(dmg), fx, heavy: o.heavy, boss: true });
        if (o.stampText) this.ev({ t: 'stamp', x: e.x, y: e.y, z: 220, msg: o.stampText });
        this.comboHit(p);
        if (e.hp <= 0 && !e.def.scripted) this.killBoss(e);
        return;
      }
      e.hp -= dmg; e.flash = 4;
      this.ev({ t: 'hit', x: e.x, y: e.y, z: e.z + 70, dmg: Math.round(dmg), fx, heavy: o.heavy });
      if (o.stampText) this.ev({ t: 'stamp', x: e.x, y: e.y, z: e.z + 150, msg: o.stampText });
      this.comboHit(p);
      e.face = -dir;
      if (o.launch) { e.vz = o.launch; e.state = 'air'; e.vx = dir * o.kb; }
      else if (e.state === 'air' || e.z > 0) { e.vz = Math.max(e.vz, o.juggle || 300); e.vx = dir * o.kb * 0.5; e.state = 'air'; if (o.knockdown) e.vz = -600; }
      else if (o.knockdown) { e.vz = 380; e.state = 'air'; e.vx = dir * o.kb * 1.3; }
      else { e.state = 'stun'; e.st = 0; e.stun = o.stun; e.vx = dir * o.kb; }
      if (o.pin) { e.pinned = 1; this.ev({ t: 'text', x: e.x, y: e.y, z: e.z + 120, msg: 'PINNED', col: '#cfe8ff', small: true }); }
      if (e.hp <= 0) this.killEnemy(e, p);
    }

    // v5: 120 BPM metronome (30 frames per beat at 60 fps); +-80 ms = +-5 frames
    beatOff() { const k = this.frame % 30; return Math.min(k, 30 - k); }
    onBeat(p, e) {
      const OB = p.char.passive && p.char.passive.onbeat;
      if (!OB && !(this.allBeatT > 0)) return 1;
      const on = this.allBeatT > 0 || this.beatOff() <= Math.round((OB ? OB.window : 80) / 1000 * 60);
      if (!on) { if (OB) p.beatChain = 0; return 1; }
      if (this.frame - (p.beatF || -99) >= 3) { this.ev({ t: 'onbeat', p: p.id, x: e.x, y: e.y, z: (e.z || 0) + 170 }); p.beatF = this.frame; if (OB) this.beatHit(p, 1); }
      if (OB && OB.refund) { p.airJumps = 0; p.airDashed = false; }
      return OB ? OB.mult : 1.5;
    }
    beatHit(p, n) {
      const F = p.char.passive.onbeat.fever; p.beatChain = (p.beatChain || 0) + n;
      if (p.beatChain >= F.hits) {
        p.beatChain = 0; this.ev({ t: 'text', x: p.x, y: p.y, z: 260, msg: 'FEVER!', col: '#ffd678' }); this.ev({ t: 'sfx', s: 'buff' });
        for (const o of this.players) if (o.alive) { if (!(o.atkUpT > 0) || (o.atkUpMul || 1) <= F.mul) { o.atkUpMul = F.mul; } o.atkUpT = Math.max(o.atkUpT || 0, F.T); this.ev({ t: 'buff', p: o.id, x: o.x, y: o.y, idol: true }); }
      }
    }

    comboHit(p) {
      if (!p) return;
      p.combo++; p.comboT = p.overtime ? 190 : 150;
      if (p.combo > this.stats.maxCombo) this.stats.maxCombo = p.combo;
      if (p.combo >= 50 && !p.overtime) { p.overtime = true; this.stats.overtimes++; this.ev({ t: 'overtime', p: p.id }); }
      p.ot = Math.min(100, p.ot + (p.overtime ? 1.5 : 0.9));
      if (p.ot >= 100 && !p.otReady) { p.otReady = true; this.ev({ t: 'ult_ready', p: p.id }); }
    }

    killEnemy(e, p) {
      e.state = 'dead'; e.gone = true; this.stats.kos++;
      this.score += Math.round(e.def.score * (1 + Math.min(p ? p.combo : 0, 100) / 50));
      this.ev({ t: 'kill', x: e.x, y: e.y, z: e.z, type: e.type, score: e.def.score });
      if (e.def.death === 'puddle') this.addZone({ kind: 'coffee', x: e.x, y: e.y, r: 110, T: 240, slow: 0.35 });
      if (e.def.death === 'cart') this.addZone({ kind: 'cart', x: e.x, y: e.y, r: 62, T: 300, slow: 0.5 });
      const r = this.rng();
      if (r < 0.22) this.pickups.push({ id: this.nextId++, type: 'bean', x: e.x, y: e.y, t: 0 });
      else if (r < 0.32) this.pickups.push({ id: this.nextId++, type: 'donut', x: e.x, y: e.y, t: 0 });
    }

    hurtPlayer(p, dmg, kb, from, knockdown, stunF) {
      if (!p.alive || p.iframes > 0 || p.state === 'ult' || p.state === 'dash' || p.state === 'down') return false;
      if (this.god) dmg = 0;
      if (p.wallT > 0 && sign(from - p.x) === p.wallFace) { if (this.frame - (p.wallBlk || -99) > 12) { p.wallBlk = this.frame; this.ev({ t: 'block', x: p.x + p.wallFace * 60, y: p.y, z: 150, msg: 'CONFETTI WALL' }); } return false; }   // v5 Wei Yao S3
      if (p.shieldT > 0 && p.shield > 0) {   // Keith S3 Nine Lives shield
        const ab = Math.min(p.shield, dmg); p.shield -= ab; dmg -= ab;
        if (p.shield <= 0) { p.shieldT = 0; this.ev({ t: 'text', x: p.x, y: p.y, z: 170, msg: 'SHIELD POP', col: '#d6b8ff', small: true }); }
        if (dmg <= 0) { p.iframes = 10; this.ev({ t: 'block', x: p.x, y: p.y, z: 150, msg: 'NINE LIVES' }); return false; }
      }
      p.hp -= dmg; this.stats.dmgTaken += dmg; p.flash = 6;
      if (p.overtime) this.ev({ t: 'overtime_end', p: p.id });
      p.combo = 0; p.overtime = false; p.comboT = 0;
      const dir = sign(p.x - from);
      p.move = null; p.dived = false;
      this.ev({ t: 'phurt', p: p.id, x: p.x, y: p.y, z: p.z + 80, dmg });
      if (p.hp <= 0) { p.hp = 0; p.alive = false; p.state = 'ko'; p.vx = dir * 300; this.ev({ t: 'pko', p: p.id }); return true; }
      if (knockdown) { p.state = 'down'; p.st = 0; p.vx = dir * kb; p.vz = 300; }
      else { p.state = 'hurt'; p.st = 0; p.stun = stunF || 18; p.vx = dir * kb; }
      p.iframes = knockdown ? 0 : (stunF ? Math.min(stunF, 30) : 20);
      return true;
    }

    // HP loss without a flinch (smoke clouds etc.)
    chip(p, dmg) {
      if (!p.alive || this.god || p.state === 'ult') return;
      p.hp -= dmg; this.stats.dmgTaken += dmg; this.ev({ t: 'chip', p: p.id, x: p.x, y: p.y, z: p.z + 100, dmg });
      if (p.hp <= 0) { p.hp = 0; p.alive = false; p.state = 'ko'; this.ev({ t: 'pko', p: p.id }); }
    }
    startDash(p) {
      p.state = 'dash'; p.st = 0; p.iframes = 13; if (p.wantFace) p.face = p.wantFace; p.move = null;
      this.ev({ t: 'dash', p: p.id, x: p.x, y: p.y, face: p.face }); return true;
    }

    startSkill(p, i) {
      const sk = p.char.skills[i]; p.mp -= sk.cost; p.cds[i] = sk.cd;
      p.castId = ++this.nextId; p.state = 'skill'; p.skill = sk; p.st = 0; p.mt = 0; p.prevMt = -1; p.pose = sk.pose; p.rot = 0; p.flip = false;
      if (p.wantFace) p.face = p.wantFace;
      this.ev({ t: 'skill', p: p.id, id: sk.id, name: sk.name, x: p.x, y: p.y });
      return true;
    }

    runSkill(p, aspd) {
      const sk = p.skill; p.mt += aspd; const f = Math.floor(p.mt), pf = Math.floor(p.prevMt); p.prevMt = p.mt;
      p.vx *= 0.75; p.vy *= 0.75; p.pose = sk.pose;
      if (sk.id === 'coffee' && f >= 18 && pf < 18) { p.hp = Math.min(p.maxhp, p.hp + sk.heal); p.buff = sk.buff; this.ev({ t: 'buff', p: p.id, x: p.x, y: p.y }); }
      if (sk.id === 'encore' && f >= sk.at && pf < sk.at) {   // v5 Wei Yao S1: spotlight heal per zombie + ally ATK
        const inR = o => Math.abs(o.x - p.x) <= sk.r && Math.abs(o.y - p.y) <= sk.r * 0.6;
        let n = this.enemies.filter(e => e.state !== 'dead' && inR(e)).length + (this.boss && this.boss.state !== 'dead' && inR(this.boss) ? 1 : 0); n = Math.min(n, sk.max);
        if (n > 0) { p.hp = Math.min(p.maxhp, p.hp + sk.heal * n); this.ev({ t: 'text', x: p.x, y: p.y, z: 230, msg: '+' + sk.heal * n + ' HP', col: '#9dffb0' }); }
        for (const o of this.players) if (o.alive && inR(o)) { o.atkUpT = sk.atk.T; o.atkUpMul = sk.atk.mul; this.ev({ t: 'buff', p: o.id, x: o.x, y: o.y, idol: true }); }
        this.ev({ t: 'spot', x: p.x, y: p.y, r: sk.r, n }); this.ev({ t: 'sfx', s: 'buff' });
      }
      if (sk.id === 'centerspin') {   // v5 Wei Yao S2: 4 hits, pull in, last hit launches
        p.vx *= 0.5; if (p.z > 0) p.vz = Math.max(p.vz, -60);
        for (let k = 0; k < sk.hits; k++) {
          const at = sk.at + k * sk.every;
          if (f >= at && pf < at) {
            const last = k === sk.hits - 1; this.ev({ t: 'swing', p: p.id, move: 'centerspin', x: p.x, y: p.y, z: p.z, face: p.face, spin: true, arc: [-180, 180] });
            const T = this.enemies.filter(e => e.state !== 'dead' && e.state !== 'enter2'); if (this.boss && this.boss.state !== 'dead' && this.boss.state !== 'intro') T.push(this.boss);
            for (const e of T) if (Math.abs(e.x - p.x) <= sk.r + e.w && Math.abs(e.y - p.y) <= sk.r * 0.45 && Math.abs((e.z || 0) - p.z) < 200) {
              if (e.kind === 'enemy') { e.x += (p.x - e.x) * 0.35; e.y += (p.y - e.y) * 0.35; }
              this.damage(e, p, { dmg: sk.dmg, kb: last ? 120 : 10, stun: 30, launch: last ? sk.launch : 0, juggle: 420, from: p.x, castId: p.castId, heavy: last });
            }
            this.hitstop = Math.max(this.hitstop, 2);
          }
        }
      }
      if (sk.id === 'confetti' && f >= sk.at && pf < sk.at) {   // v5 Wei Yao S3: frontal barrier, counts as 2 on-beat hits
        p.wallT = sk.T; p.wallFace = p.face; this.ev({ t: 'wall', p: p.id, x: p.x, y: p.y, face: p.face, T: sk.T });
        for (const q of this.projs) if (q.owner !== p && !q.owner && sign(q.x - p.x) === p.face && Math.abs(q.x - p.x) < 260) q.life = 0;
        if (p.char.passive.onbeat) this.beatHit(p, sk.beats);
      }
      if (sk.id === 'staples') {
        const F = sk.fire;
        for (let k = 0; k < F.count; k++) {
          const at = F.from + k * F.every;
          if (f >= at && pf < at) {
            const a = (k / (F.count - 1) - 0.5) * 2 * F.spread + this.r(-0.05, 0.05);
            this.projs.push({ id: this.nextId++, kind: 'staple', owner: p, x: p.x + p.face * 70, y: p.y, z: 85, vx: Math.cos(a) * F.speed * p.face, vy: Math.sin(a) * F.speed * 0.6, life: F.life, dmg: F.dmg, stun: F.stun, pierce: 2, hit: new Set() });
            this.ev({ t: 'sfx', s: 'staple' });
          }
        }
        p.rot = Math.sin(p.mt * 1.5) * 0.04;
      }
      if (sk.id === 'briefcase' && f >= sk.case.at && pf < sk.case.at) {
        const C = sk.case;
        this.projs.push({ id: this.nextId++, kind: 'case', castId: p.castId, owner: p, x: p.x + p.face * 60, y: p.y, z: 70, vx: p.face * C.speed, vy: 0, life: 200, t: 0, C, hitT: new Map() });
        this.ev({ t: 'sfx', s: 'throw' });
      }
      if (sk.id === 'tuneup') {
        p.rot = 0;
        if (f >= 14 && pf < 14) {
          p.hp = Math.min(p.maxhp, p.hp + sk.heal); p.buff = sk.buff; this.ev({ t: 'buff', p: p.id, x: p.x, y: p.y, wrench: true });
          for (const o of this.players) if (o !== p && o.alive && Math.hypot(o.x - p.x, (o.y - p.y) * 1.6) <= sk.r) { o.hp = Math.min(o.maxhp, o.hp + sk.heal * sk.allyHeal); o.buff = sk.buff; this.ev({ t: 'buff', p: o.id, x: o.x, y: o.y, wrench: true }); }
          this.ev({ t: 'sfx', s: 'wrench' });
        }
      }
      if (sk.id === 'ebrake' && f >= sk.at && pf < sk.at) {
        const C = sk.cone; this.ev({ t: 'cone', x: p.x, y: p.y, face: p.face, r: C.r, ry: C.ry, col: 0xffb347 }); this.ev({ t: 'sfx', s: 'brake' }); this.ev({ t: 'shake', a: 0.008, d: 160 });
        for (const e of this.targets()) {
          const dx = (e.x - p.x) * p.face; if (dx < -20 || dx > C.r || Math.abs(e.y - p.y) > C.ry) continue;
          this.damage(e, p, { dmg: sk.dmg, kb: 60, stun: sk.stun, from: p.x, breaksGuard: true, stampText: 'HANDBRAKE!' });
          if (e.kind === 'boss' && e.state !== 'dead') e.frozen = sk.bossStun;
        }
      }
      if (sk.id === 'hairpin') {
        const H = sk.slide, run = 25;
        if (f >= H.from && f < H.from + run) {
          p.vx = p.face * H.dist / (run / 60); p.vy *= 0.5; p.iframes = Math.max(p.iframes, 3); p.rot = -0.12 * p.face;
          if ((f - H.from) % 3 === 0) this.addZone({ kind: 'skid', x: p.x, y: p.y, r: 46, T: 60, slow: 0.5, team: 'e' });
          if ((f - H.from) % H.every === 0 && f !== Math.floor(pf)) {
            this.ev({ t: 'drift', x: p.x, y: p.y, face: p.face });
            for (const e of this.targets()) if (Math.abs(e.x - p.x) < H.rx + e.w && Math.abs(e.y - p.y) < H.ry && e.z < 120) this.damage(e, p, { dmg: H.dmg, kb: 120, stun: 22, from: p.x - p.face * 60, breaksGuard: true, stagger: true, castId: p.castId });
          }
        } else p.rot = 0;
      }
      if (sk.id === 'lure' && f >= sk.at && pf < sk.at) {
        let tx = p.x + p.face * sk.range * 0.75; const tg = this.targets().filter(e => e.kind !== 'boss' && sign(e.x - p.x) === p.face && Math.abs(e.x - p.x) < sk.range);
        if (tg.length) tx = p.x + p.face * Math.min(sk.range, Math.max(160, Math.abs(tg.reduce((a, e) => a + e.x, 0) / tg.length - p.x)));
        const x = clamp(tx, this.A.x0 + 40, this.A.x1 - 40), [b0, b1] = this.bandAt(x), y = clamp(p.y, b0 + 10, b1 - 10);
        this.lures.push({ id: this.nextId++, owner: p, x, y, r: sk.r, T: sk.T, t: 0, dps: sk.dps });
        this.ev({ t: 'lure', x, y, px: p.x, py: p.y, face: p.face }); this.ev({ t: 'sfx', s: 'zap' });
      }
      if (sk.id === 'callout' && f >= sk.at && pf < sk.at) {
        const fl = ['ninja', 'brawl', 'maid'][(p.calloutN = ((p.calloutN || 0) + 1)) % 3 === 1 ? 0 : (p.calloutN % 3 === 2 ? 1 : 2)];
        const mine = this.allies.filter(a => a.owner === p); if (mine.length >= sk.max) mine[0].T = 0;
        const [b0, b1] = this.bandAt(p.x);
        const a = { id: this.nextId++, owner: p, flav: fl, x: p.x + p.face * 80, y: clamp(p.y + 18, b0 + 8, b1 - 8), z: 0, face: p.face, T: sk.T, cd: 20, atkT: 0, vx: 0, vy: 0 };
        this.allies.push(a); this.ev({ t: 'callout', x: a.x, y: a.y, flav: fl }); this.ev({ t: 'sfx', s: 'ding' });
      }
      if (sk.id === 'ninelives' && f >= sk.at && pf < sk.at) {
        const down = this.players.filter(o => o !== p && !o.alive).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
        if (down) {
          down.alive = true; down.hp = Math.round(down.maxhp * sk.revive); down.state = 'idle'; down.st = 0; down.z = 0; down.vz = 0; down.iframes = sk.invuln; down.move = null;
          this.ev({ t: 'revive', p: down.id, x: down.x, y: down.y }); this.ev({ t: 'text', x: down.x, y: down.y, z: 200, msg: 'NINE LIVES!', col: '#e2c8ff' });
        } else {
          for (const o of this.players) if (o.alive && Math.hypot(o.x - p.x, (o.y - p.y) * 1.6) <= sk.r) { o.shield = sk.shield; o.shieldT = sk.shieldT; this.ev({ t: 'shield', p: o.id, x: o.x, y: o.y }); }
        }
        this.ev({ t: 'sfx', s: 'ding' });
      }
      if (p.mt >= sk.total) { p.state = p.z > 0 ? 'air' : 'idle'; p.st = 0; p.rot = 0; }
    }

    // ---------- Keith: laser lures + holo catgirl allies ----------
    updateKeith() {
      for (const L of this.lures) {
        L.t++; L.T--;
        for (const e of this.enemies) {
          if (e.state === 'dead' || Math.hypot(e.x - L.x, (e.y - L.y) * 1.6) > L.r) continue;
          e.lureT = 3; e.lureX = L.x; e.lureY = L.y;
          if (L.t % 30 === 0) this.damage(e, L.owner, { dmg: L.dps * 0.5, kb: 0, stun: 1, from: L.x });
        }
      }
      for (const e of this.enemies) if (e.charmT > 0) e.charmT--;
      this.lures = this.lures.filter(L => L.T > 0);
      for (const a of this.allies) {
        a.T--; if (a.atkT > 0) a.atkT--; if (a.cd > 0) a.cd--;
        const o = a.owner;
        if (a.flav === 'maid') { for (const q of this.players) if (q.alive && Math.hypot(q.x - a.x, (q.y - a.y) * 1.6) < 320) q.hp = Math.min(q.maxhp, q.hp + 6 * DT); }
        let t = null, bd = 1e9; for (const e of this.targets()) { const d = Math.abs(e.x - a.x) + Math.abs(e.y - a.y) * 2; if (d < bd && d < 900) { bd = d; t = e; } }
        let tx, ty;
        if (t) { const side = sign(a.x - t.x) || -o.face; tx = t.x + side * (a.flav === 'maid' ? 150 : 70); ty = t.y; a.face = sign(t.x - a.x) || a.face; }
        else { tx = o.x - o.face * 90; ty = o.y + 20; a.face = o.face; }
        const dx = tx - a.x, dy = ty - a.y, Ld = Math.hypot(dx, dy), sp = a.flav === 'ninja' ? 430 : 360;
        if (a.dash > 0) { a.dash--; a.vx = a.face * 900; a.vy = 0; }
        else if (Ld > 10) { a.vx = dx / Ld * Math.min(sp, Ld * 6); a.vy = dy / Ld * Math.min(sp, Ld * 6) * 0.8; } else { a.vx *= 0.6; a.vy *= 0.6; }
        a.x += a.vx * DT; a.y += a.vy * DT;
        a.x = clamp(a.x, this.A.x0 + 20, this.A.x1 - 20); { const [b0, b1] = this.bandAt(a.x); a.y = clamp(a.y, b0, b1); }
        if (t && a.cd <= 0 && Math.abs(t.x - a.x) < (a.flav === 'maid' ? 200 : 130) && Math.abs(t.y - a.y) < 50) {
          a.atkT = 14; this.ev({ t: 'catatk', x: a.x, y: a.y, face: a.face, flav: a.flav });
          if (a.flav === 'ninja') { a.cd = 36; a.dash = 8; for (const e of this.targets()) if (Math.abs(e.x - (a.x + a.face * 90)) < 110 + e.w && Math.abs(e.y - a.y) < 45) this.damage(e, o, { dmg: 10, kb: 120, stun: 18, from: a.x }); }
          else if (a.flav === 'brawl') { a.cd = 44; for (const e of this.targets()) { const ddx = (e.x - a.x) * a.face; if (ddx > -20 && ddx < 200 && Math.abs(e.y - a.y) < 50) this.damage(e, o, { dmg: 14, kb: 180, stun: 22, from: a.x, breaksGuard: true }); } }
          else { a.cd = 60; this.damage(t, o, { dmg: 6, kb: 40, stun: 10, from: a.x }); }
        }
      }
      this.allies = this.allies.filter(a => a.T > 0 && a.owner.alive);
    }

    startUlt(p) {
      const u = p.char.ult; p.state = 'ult'; p.mt = 0; p.ot = 0; p.otReady = false; p.vx = p.vy = 0; p.move = null; this.stats.ults++;
      this.timeStop = u.total; p.pose = u.pose;
      const line = p.char.lines.ult[Math.floor(this.rng() * p.char.lines.ult.length)];
      this.ev({ t: 'ult_start', p: p.id, line, char: p.char.id, face: p.face }); return true;
    }
    runUlt(p) {
      const u = p.char.ult; p.mt++; p.pose = u.pose; p.rot = 0;
      if (p.mt === u.at) {
        for (const e of this.enemies) if (e.state !== 'dead') { this.damage(e, p, { dmg: u.dmg, kb: u.kb || 300, launch: u.launch || 700, from: p.x, heavy: true }); }
        if (this.boss && this.boss.state !== 'dead' && this.boss.state !== 'intro') this.damage(this.boss, p, { dmg: u.bossDmg, kb: 0, from: p.x, heavy: true, stampText: u.stamp || 'CLOCKED OUT' });
        if (u.charm) for (const e of this.enemies) if (e.state !== 'dead' && e.hp > 0) { e.state = 'stun'; e.stun = u.charm; e.st = 0; e.vx = e.vy = 0; e.charmT = u.charm; this.ev({ t: 'charm', x: e.x, y: e.y }); }
        if (u.allOnBeat) { this.allBeatT = u.allOnBeat; this.ev({ t: 'text', x: p.x, y: p.y, z: 280, msg: 'EVERY HIT ON BEAT!', col: '#ffd678' }); }
        if (u.teamAtk) for (const o of this.players) if (o.alive) { o.atkUpT = u.teamAtk.T; o.atkUpMul = u.teamAtk.mul; this.ev({ t: 'buff', p: o.id, x: o.x, y: o.y, idol: true }); }
        this.ev({ t: 'ult_hit', p: p.id, char: p.char.id }); this.ev({ t: 'shake', a: 0.02, d: 400 });
      }
      if (p.mt >= u.total) { p.state = 'idle'; p.st = 0; p.iframes = 30; }
    }

    // ---------- enemies ----------
    spawnEnemy(type, side) {
      const d = CO.ENEMIES[type], A = this.A, n = Math.max(1, this.players.length);
      side = side || ['l', 'r', 'b', 'l', 'r'][Math.floor(this.rng() * 5)];
      let x, y;
      if (side === 'l') { x = A.x0 - 140; y = this.r(A.y0 + 40, A.y1 - 40); }
      else if (side === 'r') { x = A.x1 + 140; y = this.r(A.y0 + 40, A.y1 - 40); }
      else { x = this.r(A.x0 + 100, A.x1 - 100); y = A.y1 + 140; }
      let door = null;
      if (side !== 'b' && this.doorActive()) {   // v4.3: lift zombies step OUT of the open door instead of walking through the walls
        const D = this.stage.door; x = this.r(D.sx[0], D.sx[1]); y = this.doorTh(x) - this.r(12, 30);
        const tx = x - this.r(80, 150); door = { y0: y - 4, tx, ty: clamp(this.doorTh(tx) + this.r(40, 70), A.y0 + 10, A.y1 - 10) };
      }
      const hp = d.hp * (1 + 0.35 * (n - 1)) * this.hpMul;
      const e = { walkD: this.r(0, 100), id: this.nextId++, kind: 'enemy', type, def: d, x, y, z: 0, vx: 0, vy: 0, vz: 0, face: x < (A.x0 + A.x1) / 2 ? 1 : -1,
        hp, maxhp: hp, state: 'enter', st: 0, cd: 40 + this.r(0, 60), w: d.w, guard: d.guard || 0, shieldDown: 0, flash: 0,
        slotY: this.r(-28, 28), pose: d.frames.walk, rot: 0, barkT: this.r(200, 900) };
      if (door) { e.door = door; e.face = -1; }
      if (this.spdMul !== 1) e.def = Object.assign({}, d, { speed: d.speed * this.spdMul });
      if (this.eliteP && type !== 'speaker' && this.rng() < this.eliteP) { e.elite = true; e.hp *= 2; e.maxhp *= 2; e.def = Object.assign({}, e.def, { speed: e.def.speed * 1.12 }); }   // v5 survival elites (gold)
      this.enemies.push(e); return e;
    }

    attackers() { let n = 0; for (const e of this.enemies) if (e.state === 'windup' || e.state === 'attack') n++; return n; }

    nearestPlayer(o) {
      let best = null, bd = 1e9;
      for (const p of this.players) if (p.alive) { const d = Math.abs(p.x - o.x) + Math.abs(p.y - o.y) * 1.5; if (d < bd) { bd = d; best = p; } }
      return best;
    }

    updateEnemy(e) {
      const d = e.def, at = d.attack, A = this.A; e.st++; if (e.flash > 0) e.flash--;
      if (e.shieldDown > 0) e.shieldDown--;
      const t = this.nearestPlayer(e);
      const walkPose = () => {
        const F = d.frames; e.walkD += Math.hypot(e.vx, e.vy) * DT;
        if (F.cycle) { e.pose = F.cycle[Math.floor(e.walkD / F.stride) % F.cycle.length]; e.rot = Math.sin(e.walkD / F.stride * Math.PI / 2) * 0.025; }
        else { e.pose = F.walk; const ph = e.walkD / 22; e.rot = Math.sin(ph) * 0.07; e.bob = Math.abs(Math.sin(ph)) * 6; }
      };
      if (e.door && e.state !== 'enter') { const b0 = this.bandAt(e.x)[0]; e.door.y0 += 4; if (e.y < b0) e.y = Math.min(b0, e.y + 3); if (e.door.y0 >= b0) e.door = null; }   // v4.3: knocked mid-exit -> ease out of the doorway, no pop
      if (e.state === 'enter') {
        const tx = e.door ? e.door.tx : clamp(e.x, A.x0 + 60, A.x1 - 60), ty = e.door ? e.door.ty : clamp(e.y, A.y0 + 20, A.y1 - 20);
        const dx = tx - e.x, dy = ty - e.y, L = Math.hypot(dx, dy) || 1;
        e.vx = dx / L * d.speed * 1.3; e.vy = dy / L * d.speed * 1.3; walkPose(); e.face = sign(dx || e.face);
        if (L < 10 || (e.door && e.st > 400)) { e.state = 'chase'; e.st = 0; e.door = null; }
      } else if (e.state === 'chase') {
        walkPose();
        if (e.type === 'hr' && e.shieldDown > 0) { e.pose = d.frames.hurt; }
        if (e.lureT > 0) {   // Keith S1: chase the laser dot
          e.lureT--; const dx = e.lureX - e.x, dy = e.lureY - e.y, L = Math.hypot(dx, dy);
          if (L > 14) { e.vx = dx / L * d.speed * 1.15; e.vy = dy / L * d.speed * 0.9; } else { e.vx *= 0.6; e.vy *= 0.6; e.pose = d.frames.walk; e.rot = Math.sin(e.st * 0.5) * 0.12; }
          e.face = sign(dx) || e.face;
        }
        else if (!t) { e.vx *= 0.9; e.vy *= 0.9; }
        else {
          const side = sign(e.x - t.x), tx = t.x + side * (d.ai === 'ranged' ? d.keep : (d.stand || at.range * 0.8)), ty = t.y + e.slotY * (d.ai === 'ranged' ? 2 : 0.4);
          const dx = tx - e.x, dy = ty - e.y, L = Math.hypot(dx, dy);
          const sp = d.speed * (e.type === 'hr' && e.shieldDown > 0 ? 0.6 : 1) * (e.auraT > 0 ? 1.25 : 1) * (e.slowT > 0 ? 0.5 : 1);
          if (L > 8) { e.vx = dx / L * sp; e.vy = dy / L * sp * 0.8; } else { e.vx *= 0.7; e.vy *= 0.7; e.pose = d.frames.walk; e.rot = 0; }
          e.face = sign(t.x - e.x);
          if (e.cd > 0) e.cd--;
          let inR = d.ai === 'ranged' ? Math.abs(t.x - e.x) < at.range && Math.abs(t.y - e.y) < 90 : Math.abs(t.x - e.x) < at.range + 20 && Math.abs(t.y - e.y) < 34;
          if (at.kind === 'charge') inR = Math.abs(t.x - e.x) < at.range && Math.abs(t.x - e.x) > 140 && Math.abs(t.y - e.y) < 40;
          else if (at.kind === 'ring') inR = Math.hypot(t.x - e.x, (t.y - e.y) * 1.6) < at.r + 24;
          else if (at.kind === 'summon') inR = this.enemies.filter(q => q.parent === e.id && q.state !== 'dead').length < at.max && this.enemies.length < 12;
          else if (at.kind === 'cloud') inR = Math.abs(t.x - e.x) < at.range && Math.abs(t.y - e.y) < 70;
          if (inR && e.cd <= 0 && this.attackers() < 2 + this.players.length) { e.state = 'windup'; e.st = 0; e.vx = e.vy = 0; this.ev({ t: 'tell', id: e.id }); }
        }
        if (--e.barkT <= 0) { e.barkT = this.r(500, 1400); if (this.rng() < 0.5) this.ev({ t: 'bark', x: e.x, y: e.y, z: 170, msg: d.barks[Math.floor(this.rng() * d.barks.length)] }); }
      } else if (e.state === 'windup') {
        e.pose = d.frames.walk; e.rot = -0.12 * e.face; e.vx *= 0.8; e.vy *= 0.8;
        if (t && (at.kind === 'bolt' || at.kind === 'volley' || at.kind === 'boomerang' || at.kind === 'throw' || at.kind === 'cloud')) e.face = sign(t.x - e.x) || e.face;
        if (at.kind === 'bolt' && t && e.st < at.windup - 12) e.aim = { x: t.x, y: t.y };   // laser sight tracks, then locks for the last 12 frames
        if (at.kind === 'cone' && e.st === 1) this.ev({ t: 'cone', x: e.x, y: e.y, face: e.face, r: at.range, ry: at.ry, col: at.fx && at.fx.blind ? 0xffffff : at.fx && at.fx.stun ? 0xffe27a : at.fx && at.fx.slow ? 0x8fd0ff : 0x9ff0e0, tell: at.windup });
        if (at.kind === 'ring' && e.st === 1) this.ev({ t: 'ringtell', x: e.x, y: e.y, r: at.r, T: at.windup });
        if (at.kind === 'charge' && t) { e.face = sign(t.x - e.x) || e.face; if (e.st === 1) this.ev({ t: 'text', x: e.x, y: e.y, z: 170, msg: '!', col: '#ffd34d' }); }
        if (e.st >= at.windup) {
          e.state = 'attack'; e.st = 0; e.hitDone = false; if (at.lunge) e.vx = e.face * at.lunge; this.ev({ t: 'sfx', s: at.kind === 'shout' ? 'shout' : 'eswing' });
          if (at.kind === 'throw' && t) {   // lobbed paper ball, lands where the target is heading
            const T = 0.8, z0 = 120, g = 900, tx = t.x + t.vx * 0.3, ty = t.y + t.vy * 0.3;
            this.projs.push({ id: this.nextId++, kind: 'eproj', tex: at.proj, owner: e, x: e.x + e.face * 40, y: e.y, z: z0, vx: (tx - e.x) / T, vy: (ty - e.y) / T, vz: (0.5 * g * T * T - z0) / T, g, life: 120, dmg: at.dmg * this.dmgMul });
            e.hitDone = true;
          }
          if (at.kind === 'shout') { this.ev({ t: 'shout', x: e.x, y: e.y, face: e.face }); if (this.rng() < at.cc && this.enemies.length < 10) { this.spawnEnemy('intern'); this.ev({ t: 'text', x: e.x, y: e.y, z: 190, msg: '+1 CC\'d', col: '#9fd0ff', small: true }); } }
          if (at.kind === 'whip') this.ev({ t: 'whip', x: e.x, y: e.y, face: e.face, r: at.range });
          this.enemyAttackStart(e, at, t);
        }
      } else if (e.state === 'attack') {
        e.pose = d.frames.atk; e.rot = 0.05 * e.face;
        if (at.kind === 'charge') {
          e.rot = 0.12 * e.face; e.vx = e.face * at.speed * (e.auraT > 0 ? 1.2 : 1); e.vy = 0;
          if (e.st % 5 === 0) this.ev({ t: 'dust', x: e.x - e.face * 30, y: e.y });
          if (!e.hitDone) for (const p of this.players) if (p.alive && Math.abs(p.x - e.x) < at.rx * 0.55 + p.w && Math.abs(p.y - e.y) < at.ry + 12 && p.z < 70) {
            if (this.hurtPlayer(p, this.edm(e, at.dmg), at.kb, e.x, false)) e.hitDone = true;
          }
          if (e.st > 6 && (e.x <= A.x0 + 1 || e.x >= A.x1 - 1)) { e.state = 'stun'; e.st = 0; e.stun = at.wallStun; e.vx = -e.face * 60; e.cd = at.cd; this.ev({ t: 'text', x: e.x, y: e.y, z: 170, msg: 'CRASH!', col: '#ffd34d' }); this.ev({ t: 'sfx', s: 'clang' }); this.ev({ t: 'shake', a: 0.006, d: 160 }); }
          else if (e.st >= at.active) { if (at.selfStun) { e.state = 'stun'; e.st = 0; e.stun = at.selfStun; e.cd = at.cd; this.ev({ t: 'text', x: e.x, y: e.y, z: 170, msg: 'WOBBLE', col: '#ffd34d', small: true }); } else { e.state = 'recover'; e.st = 0; } }
        } else {
          if (!at.lunge) e.vx *= 0.8; else e.vx *= 0.93;
          if (!e.hitDone) for (const p of this.players) {
            if (!p.alive) continue;
            const cx = e.x + e.face * at.range * 0.6, dx = (p.x - cx) / (at.rx + p.w), dy = (p.y - e.y) / (at.ry + 12);
            if (dx * dx + dy * dy <= 1 && p.z < 70) {
              const wall = at.wallBonus && (p.x < A.x0 + 70 || p.x > A.x1 - 70 || p.y < A.y0 + 20 || p.y > A.y1 - 20);
              if (this.hurtPlayer(p, this.edm(e, at.dmg + (wall ? at.wallBonus : 0)), at.kb, e.x, e.type === 'hr', at.fx && at.fx.stun)) {
                e.hitDone = at.kind !== 'shout'; if (at.kind === 'whip') this.ev({ t: 'text', x: p.x, y: p.y, z: 150, msg: 'YOINK', col: '#9fffb0', small: true });
                if (wall) this.ev({ t: 'text', x: p.x, y: p.y, z: 150, msg: 'WALL SLAM', col: '#ffd34d', small: true });
                this.applyFx(p, at.fx);
              }
            }
          }
          if (e.st >= at.active) { e.state = 'recover'; e.st = 0; }
        }
      } else if (e.state === 'recover') {
        e.pose = d.frames.walk; e.rot = 0; e.vx *= 0.85; e.vy *= 0.85;
        if (e.st >= at.recover) { e.state = 'chase'; e.st = 0; e.cd = at.cd + this.r(0, 50); }
      } else if (e.state === 'stun') {
        e.pose = d.frames.hurt; e.rot = Math.sin(e.st * 0.9) * 0.05; e.vx *= 0.86; e.vy *= 0.86;
        if (e.st >= (e.pinned ? e.stun + 0 : e.stun)) { e.state = 'chase'; e.st = 0; e.pinned = 0; e.cd = Math.max(e.cd, 20); }
      } else if (e.state === 'air') {
        e.pose = d.frames.hurt; e.rot += 0.12 * -e.face; e.vx *= 0.98;
        if (e.z <= 0 && e.vz <= 0 && e.st > 2) { e.state = 'down'; e.st = 0; e.rot = 1.35 * -e.face; this.ev({ t: 'thud', x: e.x, y: e.y }); }
      } else if (e.state === 'down') {
        e.pose = d.frames.hurt; e.rot = 1.35 * -e.face * Math.max(0, 1 - Math.max(0, e.st - 40) / 15); e.vx *= 0.8; e.vy *= 0.8;
        if (e.st >= 55) { e.state = 'chase'; e.st = 0; e.rot = 0; e.cd = 40; }
      }
      if (e.state === 'air' && e.st === 0) e.st = 1;
      if (e.slowT > 0) { e.slowT--; if (e.state !== 'attack') { e.vx *= 0.6; e.vy *= 0.6; } }
      this.physics(e, EGRAV);
    }

    edm(e, base) { return base * this.dmgMul * (e.auraT > 0 ? 1.2 : 1); }
    applyFx(p, fx) {
      if (!fx) return;
      if (fx.blind) { p.blind = Math.max(p.blind, fx.blind); this.ev({ t: 'blind', p: p.id }); }
      if (fx.slow) { p.slowT = fx.slow; p.slowV = 0.4; this.ev({ t: 'text', x: p.x, y: p.y, z: 160, msg: 'SLOWED', col: '#8fd0ff', small: true }); }
    }
    addZone(z) {
      z.id = this.nextId++; z.t = 0; z.team = z.team || 'p'; z.acc = 0; this.zones.push(z);
      if (this.zones.length > 16) this.zones.shift();
      this.ev({ t: 'zone', kind: z.kind, x: z.x, y: z.y, r: z.r });
      return z;
    }
    updateZones() {
      for (const z of this.zones) {
        z.t++;
        if (z.team !== 'e') for (const p of this.players) {
          if (!p.alive || p.z > 40) continue; const dx = (p.x - z.x) / z.r, dy = (p.y - z.y) / (z.r * 0.5);
          if (dx * dx + dy * dy > 1) continue;
          if (z.slow) { p.slowT = Math.max(p.slowT, 6); p.slowV = Math.max(p.slowV, z.slow); }
          if (z.dps && z.t % 60 === 0) this.chip(p, z.dps);
        }
        if (z.team === 'e') for (const e of this.targets()) {
          const dx = (e.x - z.x) / z.r, dy = (e.y - z.y) / (z.r * 0.6);
          if (dx * dx + dy * dy <= 1 && e.kind === 'enemy') e.slowT = Math.max(e.slowT || 0, 8);
        }
      }
      this.zones = this.zones.filter(z => z.t < z.T);
    }
    updateAuras() {
      for (const e of this.enemies) if (e.auraT > 0) e.auraT--;
      for (const sp of this.enemies) {
        if (!sp.def.aura || sp.state === 'dead' || sp.state === 'enter') continue;
        for (const e of this.enemies) if (e !== sp && e.state !== 'dead' && Math.hypot(e.x - sp.x, (e.y - sp.y) * 1.6) <= sp.def.aura) e.auraT = 8;
        if (this.frame % 240 === sp.id % 240) this.ev({ t: 'aura', x: sp.x, y: sp.y, r: sp.def.aura });
      }
    }
    enemyAttackStart(e, at, t) {
      const k = at.kind;
      if (at.text) this.ev({ t: 'text', x: e.x, y: e.y, z: 200, msg: at.text, col: '#ffd34d' });
      if (k === 'bolt' && e.aim) {
        const dx = e.aim.x - e.x, dy = (e.aim.y - e.y), a = Math.atan2(dy, dx || e.face), sx = 900;
        this.projs.push({ id: this.nextId++, kind: 'note', tex: at.proj, bolt: true, ang: a, owner: e, x: e.x + e.face * 50, y: e.y, z: 100, vx: Math.cos(a) * sx, vy: Math.sin(a) * sx, life: 80, dmg: this.edm(e, at.dmg) });
        e.hitDone = true; e.aim = null; this.ev({ t: 'sfx', s: 'laser' });
      }
      if (k === 'volley' && t) {
        const base = Math.atan2((t.y - e.y) * 1.2, t.x - e.x);
        for (let i = 0; i < at.n; i++) { const a = base + (i - (at.n - 1) / 2) * 0.22; this.projs.push({ id: this.nextId++, kind: 'note', tex: at.proj, ang: a, owner: e, x: e.x + e.face * 40, y: e.y, z: 100, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520 * 0.7, life: 100, dmg: this.edm(e, at.dmg) }); }
        e.hitDone = true; this.ev({ t: 'sfx', s: 'throw' });
      }
      if (k === 'boomerang' && t) {
        const base = Math.atan2((t.y - e.y) * 1.0, t.x - e.x);
        for (let i = 0; i < at.n; i++) { const a = base + (at.n > 1 ? (i - (at.n - 1) / 2) * 0.42 : 0); this.projs.push({ id: this.nextId++, kind: 'boom', tex: at.proj, owner: e, x: e.x + e.face * 40, y: e.y, z: 90, ax: Math.cos(a), ay: Math.sin(a) * 0.7, t: 0, out: 34, life: 260, dmg: this.edm(e, at.dmg), fx: at.fx, hit: new Set(), spin: 0 }); }
        e.hitDone = true; this.ev({ t: 'sfx', s: 'throw' });
      }
      if (k === 'ring') {
        e.hitDone = true; this.ev({ t: 'ringhit', x: e.x, y: e.y, r: at.r }); this.ev({ t: 'sfx', s: 'ring' }); this.ev({ t: 'shake', a: 0.006, d: 160 });
        for (const p of this.players) if (p.alive && p.z < 60 && Math.hypot(p.x - e.x, (p.y - e.y) * 1.6) <= at.r + p.w) this.hurtPlayer(p, this.edm(e, at.dmg), at.kb, e.x, false);
      }
      if (k === 'summon') {
        e.hitDone = true; this.ev({ t: 'sfx', s: 'ding' });
        for (let i = 0; i < at.n; i++) { if (this.enemies.length >= 12) break; const c = this.spawnEnemy(at.spawn, e.x < (this.A.x0 + this.A.x1) / 2 ? 'l' : 'r'); c.parent = e.id; }
        this.ev({ t: 'text', x: e.x, y: e.y, z: 200, msg: 'DING DING!', col: '#ffd34d' });
      }
      if (k === 'cloud') {
        e.hitDone = true; this.addZone({ kind: 'smoke', x: e.x + e.face * 70, y: e.y + 10, r: at.r, T: at.T, dps: at.dmg }); this.ev({ t: 'sfx', s: 'puff' });
      }
      if (at.puddle) this.addZone({ kind: 'coffee', x: e.x + e.face * 80, y: e.y + 6, r: 80, T: 240, slow: 0.35 });
      if (k === 'cone' && at.fx && at.fx.slick) this.addZone({ kind: 'soap', x: e.x + e.face * 130, y: e.y + 6, r: 110, T: 300, slow: 0.4 });
      if (k === 'cone') this.ev({ t: 'sfx', s: at.fx && at.fx.blind ? 'flash' : 'whoosh' });
    }

    // ---------- boss ----------
    spawnBoss(id, from, lines) {
      const d = CO.BOSSES[id], A = this.A, n = Math.max(1, this.players.length);
      const hp = d.hp * (1 + 0.85 * (n - 1)) * this.hpMul, L = from === 'l';   // v5.1: +25% more per extra player
      this.boss = { id: this.nextId++, kind: 'boss', type: id, def: d, x: L ? A.x0 - 200 : A.x1 + 200, y: (A.y0 + A.y1) / 2 - 20, z: 0, vx: 0, vy: 0, vz: 0, face: L ? 1 : -1,
        hp, maxhp: hp, poise: d.poise, state: 'intro', st: 0, cd: 60, w: d.w, flash: 0, phase: 1, pose: d.frames.idle, rot: 0, summonCd: 400, last: '',
        from: L ? 'l' : 'r', intro: lines || d.intro, fightT: 0 };
      if (!L && this.doorActive()) { const D = this.stage.door, b = this.boss; b.x = (D.sx[0] + D.sx[1]) / 2; b.y = this.doorTh(b.x) - 16; b.door = { y0: b.y - 4, tx: b.x - 230, ty: (A.y0 + A.y1) / 2 }; }
      return this.boss;
    }
    startAura(b) {   // scripted, unwinnable lobby encounter: the CEO becomes immune and seals the exit
      if (b.state === 'aura' || b.state === 'done') return;
      b.state = 'aura'; b.st = 0; b.vx = b.vy = 0; this.hazards.length = 0; this.projs = this.projs.filter(q => q.kind === 'staple' || q.kind === 'case' || q.kind === 'pbolt'); this.zones.length = 0;
      for (const e of this.enemies) { this.ev({ t: 'kill', x: e.x, y: e.y, z: e.z, type: e.type }); e.gone = true; }
      for (const p of this.players) p.iframes = 400;
      this.ev({ t: 'banner', msg: 'MONDAY AURA', sub: 'Your stapler does... nothing?!' }); this.ev({ t: 'sfx', s: 'boom' }); this.ev({ t: 'shake', a: 0.015, d: 500 });
    }

    updateBoss(b) {
      const d = b.def, A = this.A; b.st++; if (b.flash > 0) b.flash--;
      const t = this.nearestPlayer(b); const sp = d.speed * (b.phase >= 2 ? 1.25 : 1);
      const say = m => this.ev({ t: 'bark', x: b.x, y: b.y, z: 330, msg: m, boss: true });
      if (b.state === 'intro') {
        b.pose = d.frames.idle; const L = b.from === 'l', tx = L ? A.x0 + 180 : A.x1 - 180;
        b.vx = L ? (b.x < tx ? 200 : 0) : (b.x > tx ? -160 : 0); b.rot = Math.sin(b.st * 0.2) * 0.03;
        if (b.door) { const dx = b.door.tx - b.x, dy = b.door.ty - b.y, Ld = Math.hypot(dx, dy); b.vx = Ld > 6 ? dx / Ld * 120 : 0; b.y += Ld > 6 ? dy / Ld * 120 * DT : 0; }
        b.x += b.vx * DT; if (b.st === 40) say(b.intro[0]); if (b.st === 130) say(b.intro[1]);
        if (b.st >= 210) { b.state = 'idle'; b.st = 0; b.cd = 30; b.door = null; }
        return;
      }
      if (b.state === 'dead') { b.pose = d.frames.hurt; b.rot = Math.min(1.4, b.st * 0.02); return; }
      if (b.state === 'done') { b.pose = d.frames.idle; b.rot = 0; return; }
      if (b.state === 'aura') {
        b.pose = b.st < 90 ? d.frames.summon : d.frames.idle; b.rot = Math.sin(b.st * 0.4) * 0.03; b.flash = b.st % 10 < 5 ? 2 : 0;
        if (b.st === 20) say(d.defeat[0]); if (b.st === 120) say(d.defeat[1]);
        if (b.st >= 210) { b.state = 'done'; b.st = 0; }
        return;
      }
      if (b.frozen > 0) { b.frozen--; b.pose = d.frames.hurt; b.vx *= 0.8; b.vy *= 0.8; b.rot = Math.sin(b.st * 0.5) * 0.04; this.physics(b, EGRAV); return; }
      b.fightT++;
      if (d.scripted && b.fightT > 2400) return this.startAura(b);   // never unwinnable-forever: the cutscene triggers regardless
      if (d.kit === 'muzak') {
        if (b.phase === 1 && b.hp < b.maxhp * 0.66) { b.phase = 2; say(d.phase2); this.ev({ t: 'banner', msg: 'PHASE 2', sub: d.name + ': "' + d.phase2 + '"' }); }
        else if (b.phase === 2 && b.hp < b.maxhp * 0.33) { b.phase = 3; say(d.phase3); this.ev({ t: 'banner', msg: 'PHASE 3', sub: d.name + ': "' + d.phase3 + '"' }); this.ev({ t: 'shake', a: 0.01, d: 400 }); }
      } else if (b.phase === 1 && b.hp < b.maxhp * 0.5) { b.phase = 2; say(d.phase2); this.ev({ t: 'banner', msg: 'PHASE 2', sub: d.name + ': "' + d.phase2 + '"' }); }
      if (b.summonCd > 0) b.summonCd--;
      if (b.state === 'idle') {
        b.pose = d.frames.idle; b.rot = Math.sin(b.st * 0.1) * 0.03;
        if (t) {
          b.face = sign(t.x - b.x);
          const dx = t.x - b.face * 150 - b.x, dy = t.y - b.y, L = Math.hypot(dx, dy) || 1;
          if (L > 30) { b.vx = dx / L * sp; b.vy = dy / L * sp * 0.7; } else { b.vx *= 0.8; b.vy *= 0.8; }
          if (--b.cd <= 0) {
            const dist = Math.abs(t.x - b.x) + Math.abs(t.y - b.y);
            const adds = this.enemies.length; const r = this.rng();
            let next;
            if (d.kit) next = this.kitPick(b, dist, adds);
            else if (dist < 260 && r < 0.55) next = 'sweep';
            else if (b.summonCd <= 0 && adds < 3 && r < 0.75) next = 'summon';
            else next = this.rng() < 0.5 ? 'deadline' : 'notes';
            if (!d.kit && next === b.last && next !== 'sweep') next = next === 'deadline' ? 'notes' : 'deadline';
            b.last = next; b.state = next; b.st = 0; b.vx = b.vy = 0;
            if (next === 'sweep') this.ev({ t: 'tell', id: b.id, boss: true });
            if (this.rng() < 0.45) say(d.barks[Math.floor(this.rng() * d.barks.length)]);
          }
        }
      } else if (b.state === 'sweep') {
        const W = b.phase >= 2 ? 30 : 40;
        b.pose = b.st < W ? d.frames.idle : d.frames.atk; b.rot = b.st < W ? -0.08 * b.face : 0.06 * b.face;
        if (b.st === W) { this.ev({ t: 'sfx', s: 'bossswing' }); this.ev({ t: 'swing', p: 0, x: b.x, y: b.y, z: 0, face: b.face, arc: [-80, 80], enemy: true, r: 190 }); }
        if (b.st >= W && b.st <= W + 8) for (const p of this.players) {
          if (!p.alive) continue; const cx = b.x + b.face * 110, dx = (p.x - cx) / 200, dy = (p.y - b.y) / 85;
          if (dx * dx + dy * dy <= 1 && p.z < 120) this.hurtPlayer(p, 34 * this.dmgMul, 420, b.x, true);
        }
        if (b.st >= W + 45) { b.state = 'idle'; b.st = 0; b.cd = b.phase >= 2 ? 35 : 55; }
      } else if (b.state === 'deadline') {
        b.pose = d.frames.idle; b.rot = 0;
        if (b.st === 20 && t) {
          const n = b.phase >= 2 ? 5 : 3;
          for (let k = 0; k < n; k++) {
            const hx = clamp(t.x + (k === 0 ? t.vx * 0.5 : this.r(-220, 220)), A.x0 + 40, A.x1 - 40), hy = clamp(t.y + (k === 0 ? t.vy * 0.5 : this.r(-140, 140)), A.y0 + 20, A.y1 - 20);
            this.hazards.push({ id: this.nextId++, kind: 'deadline', label: d.hazard || 'DUE', x: hx, y: hy, r: 95, t: 0, T: b.phase >= 2 ? 80 : 100, dmg: 38 * this.dmgMul });
          }
          this.ev({ t: 'sfx', s: 'tick' });
        }
        if (b.st >= 70) { b.state = 'idle'; b.st = 0; b.cd = 50; }
      } else if (b.state === 'notes') {
        b.pose = b.st < 25 ? d.frames.idle : d.frames.atk;
        if (b.st === 25 && t) {
          const n = b.phase >= 2 ? 7 : 5, base = Math.atan2((t.y - b.y) / 0.6, t.x - b.x);
          for (let k = 0; k < n; k++) { const a = base + (k / (n - 1) - 0.5) * 0.9; this.projs.push({ id: this.nextId++, kind: 'note', tex: d.proj || 'note', owner: b, x: b.x + b.face * 80, y: b.y, z: 150, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520 * 0.6, life: 110, dmg: 14 * this.dmgMul, ang: a }); }
          this.ev({ t: 'sfx', s: d.kit === 'muzak' ? 'sax' : 'throw' });
        }
        if (b.st >= 60) { b.state = 'idle'; b.st = 0; b.cd = 45; }
      } else if (b.state === 'summon') {
        b.pose = d.frames.summon; b.rot = Math.sin(b.st * 0.5) * 0.04;
        if (b.st === 30) {
          const types = d.summon || ['intern']; say(d.kit === 'muzak' ? 'Rush hour, folks!' : d.kit === 'landlord' ? 'New tenants! Meet the old ones!' : b.phase >= 2 ? 'EVERYONE! In my office! NOW!' : "Let's circle back! Team?!");
          for (let k = 0; k < (b.phase >= 2 ? 4 : 3); k++) { if (this.enemies.length < 8) this.spawnEnemy(types[k % types.length], k % 2 ? 'l' : 'r'); } b.summonCd = 700;
        }
        if (b.st >= 70) { b.state = 'idle'; b.st = 0; b.cd = 40; }
      } else if (b.state === 'bass') {   // Muzak: bass-drop ring, jump it
        b.pose = b.st < 40 ? d.frames.summon : d.frames.atk; b.rot = Math.sin(b.st * 0.6) * 0.03;
        if (b.st === 4) { this.hazards.push({ id: this.nextId++, kind: 'wave', label: 'BASS DROP', x: b.x, y: b.y, r: b.phase >= 2 ? 320 : 270, t: 0, T: 46, ex: 34, dmg: 22 * this.dmgMul, hit: new Set() }); this.ev({ t: 'sfx', s: 'tick' }); }
        if (b.st === 50 && b.phase >= 2 && t) this.hazards.push({ id: this.nextId++, kind: 'wave', label: 'BASS DROP', x: b.x, y: b.y, r: 320, t: 0, T: 30, ex: 30, dmg: 22 * this.dmgMul, hit: new Set() });
        if (b.st >= (b.phase >= 2 ? 120 : 95)) { b.state = 'idle'; b.st = 0; b.cd = 40; }
      } else if (b.state === 'lurch') {   // Muzak phase 3: "Going down!" lunges across the cab
        b.pose = b.st < 34 ? d.frames.summon : d.frames.atk; b.rot = b.st < 34 ? Math.sin(b.st * 1.4) * 0.07 : 0.1 * b.face;
        if (b.st === 2) { say(d.phase3); b.lx = t ? sign(t.x - b.x) : b.face; b.face = b.lx; this.ev({ t: 'tell', id: b.id, boss: true }); }
        if (b.st >= 34 && b.st < 58) {
          b.vx = b.lx * 960; b.vy *= 0.5;
          for (const p of this.players) if (p.alive && !b.hitLurch && Math.abs(p.x - b.x) < 100 && Math.abs(p.y - b.y) < 62 && p.z < 80) { if (this.hurtPlayer(p, 26 * this.dmgMul, 460, b.x, true)) b.hitLurch = true; }
          if (b.st % 4 === 0) this.ev({ t: 'dust', x: b.x - b.lx * 40, y: b.y });
        } else if (b.st === 58) { b.hitLurch = false; b.vx = 0; }
        if (b.st >= 96) { b.state = 'idle'; b.st = 0; b.cd = 45; b.hitLurch = false; }
      } else if (b.state === 'keys') {   // Landlord: key-jangle ring
        b.pose = b.st < 30 ? d.frames.summon : d.frames.atk; b.rot = Math.sin(b.st * 0.8) * 0.03;
        if (b.st === 6) { this.hazards.push({ id: this.nextId++, kind: 'deadline', label: 'KEYS', x: b.x, y: b.y + 6, r: b.phase >= 2 ? 250 : 215, t: 0, T: 44, dmg: 26 * this.dmgMul }); this.ev({ t: 'sfx', s: 'keys' }); }
        if (b.st >= 76) { b.state = 'idle'; b.st = 0; b.cd = b.phase >= 2 ? 36 : 54; }
      } else if (b.state === 'evict') {   // homing eviction notice(s)
        b.pose = b.st < 26 ? d.frames.summon : d.frames.atk; b.rot = 0;
        if (b.st === 26 && t) {
          const n = b.phase >= 2 ? 2 : 1; say('EVICTION NOTICE!');
          for (let k = 0; k < n; k++) { const a = Math.atan2(t.y - b.y, t.x - b.x) + (k - (n - 1) / 2) * 0.7; this.projs.push({ id: this.nextId++, kind: 'homing', tex: 'eviction', owner: b, x: b.x + b.face * 80, y: b.y, z: 150, ang: a, sp: 250, t: 0, life: 230, dmg: 18 * this.dmgMul }); }
          this.ev({ t: 'sfx', s: 'throw' });
        }
        if (b.st >= 70) { b.state = 'idle'; b.st = 0; b.cd = 44; }
      } else if (b.state === 'rent') {   // RENT DUE: slam + tenants
        b.pose = b.st < 40 ? d.frames.summon : d.frames.atk; b.rot = b.st < 40 ? -0.05 * b.face : 0.06 * b.face;
        if (b.st === 4) say('RENT. IS. DUE!');
        if (b.st === 40) {
          this.hazards.push({ id: this.nextId++, kind: 'wave', label: 'RENT DUE', x: b.x, y: b.y, r: 340, t: 0, T: 0, ex: 32, dmg: 24 * this.dmgMul, hit: new Set() });
          this.ev({ t: 'shake', a: 0.012, d: 300 }); this.ev({ t: 'stamp', x: b.x, y: b.y, z: 250, msg: 'RENT DUE' }); this.ev({ t: 'sfx', s: 'crash' });
          if (this.enemies.length < 4) for (let k = 0; k < 2; k++) this.spawnEnemy('wfh', k ? 'l' : 'r');
        }
        if (b.st >= 90) { b.state = 'idle'; b.st = 0; b.cd = 50; }
      } else if (b.state === 'dizzy') {
        b.pose = d.frames.hurt; b.rot = Math.sin(b.st * 0.3) * 0.08; b.vx *= 0.8; b.vy *= 0.8;
        if (b.st >= 210) { b.state = 'idle'; b.st = 0; b.cd = 20; }
      }
      b.vx *= 0.96;
      this.physics(b, EGRAV);
    }

    kitPick(b, dist, adds) {
      const r = this.rng(), ph = b.phase; let L;
      if (b.def.kit === 'muzak') {
        if (dist < 230 && r < 0.4) return 'sweep';
        L = ph === 1 ? ['bass', 'notes', 'bass'] : ph === 2 ? ['bass', 'notes', 'notes', 'summon'] : ['lurch', 'bass', 'notes', 'lurch', 'summon'];
      } else {
        if (dist < 230 && r < 0.4) return 'sweep';
        L = ph === 1 ? ['keys', 'evict', 'rent', 'keys'] : ['keys', 'evict', 'rent', 'evict', 'summon'];
      }
      let n = L[Math.floor(this.rng() * L.length)];
      if (n === 'summon' && (b.summonCd > 0 || adds >= 3)) n = L[0];
      if (n === b.last && L.length > 1) n = L[(L.indexOf(n) + 1) % L.length];
      if (n === 'summon' && (b.summonCd > 0 || adds >= 3)) n = 'notes';
      return n;
    }

    killBoss(b) {
      b.state = 'dead'; b.st = 0; b.hp = 0; this.stats.kos++; this.score += 5000;
      for (const e of this.enemies) { this.ev({ t: 'kill', x: e.x, y: e.y, z: e.z, type: e.type }); e.gone = true; }
      this.hazards.length = 0; this.projs = this.projs.filter(p => p.kind === 'staple' || p.kind === 'case' || p.kind === 'pbolt');
      this.ev({ t: 'bossdown', x: b.x, y: b.y }); this.ev({ t: 'bark', x: b.x, y: b.y, z: 330, msg: b.def.defeat[0], boss: true });
      this.slowmo = 90;
    }

    // ---------- projectiles / hazards / pickups ----------
    updateProjs() {
      for (const q of this.projs) {
        q.life--;
        if (q.kind === 'staple') {
          q.x += q.vx * DT; q.y += q.vy * DT;
          for (const e of this.targets()) {
            if (q.hit.has(e.id)) continue;
            if (e.def.block >= 0.7 && e.kind === 'enemy' && sign(q.x - e.x) === e.face && sign(q.vx) === -e.face && Math.abs(e.x - q.x) < e.w + 18 && Math.abs(e.y - q.y) < 34) {   // umbrellas bounce staples straight back
              q.hit.add(e.id); q.vx *= -1; q.hit = new Set([e.id]); this.ev({ t: 'text', x: e.x, y: e.y, z: 150, msg: 'BOING!', col: '#9fd0ff', small: true }); break;
            }
            if (Math.abs(e.x - q.x) < e.w + 18 && Math.abs(e.y - q.y) < 34 && Math.abs(e.z + 80 - q.z) < 110) {
              q.hit.add(e.id); this.damage(e, q.owner, { dmg: q.dmg, kb: 40, stun: q.stun, from: q.x - sign(q.vx) * 50, pin: e.kind !== 'boss', breaksGuard: true });
              if (--q.pierce <= 0) { q.life = 0; break; }
            }
          }
        } else if (q.kind === 'pbolt') {
          q.x += q.vx * DT; q.y += q.vy * DT;
          for (const e of this.targets()) {
            if (q.hit.has(e.id)) continue;
            if (Math.abs(e.x - q.x) < e.w + 30 && Math.abs(e.y - q.y) < 40 && Math.abs(e.z + 90 - q.z) < 130) {
              q.hit.add(e.id); this.damage(e, q.owner, { dmg: q.dmg, kb: q.kb, stun: q.stun, from: q.x - sign(q.vx) * 50 });
              if (--q.pierce <= 0) { q.life = 0; break; }
            }
          }
        } else if (q.kind === 'case') {
          q.t++; const C = q.C, o = q.owner;
          if (q.t > C.out) { const dx = o.x - q.x, dy = o.y - q.y, L = Math.hypot(dx, dy) || 1; const s = Math.min(C.speed * 1.2, 300 + q.t * 12); q.vx = dx / L * s; q.vy = dy / L * s; if (L < 50 && q.t > C.out + 6) q.life = 0; }
          else { q.vx *= 0.96; }
          q.x += q.vx * DT; q.y += q.vy * DT;
          for (const e of this.targets()) {
            const dx = q.x - e.x, dy = q.y - e.y, L = Math.hypot(dx, dy * 1.6);
            if (L < C.r * 2.4 && e.kind !== 'boss') { e.x += dx / (L || 1) * C.pull * DT; e.y += dy / (L || 1) * C.pull * DT * 0.6; }
            if (L < C.r + e.w) { const last = q.hitT.get(e.id); if (last === undefined || q.t - last >= C.every) { q.hitT.set(e.id, q.t); this.damage(e, o, { dmg: C.dmg, kb: 10, stun: 16, from: q.x, breaksGuard: true, stagger: true, castId: q.castId }); this.ev({ t: 'sfx', s: 'tap' }); } }
          }
          if (q.t > C.out + C.back + 60) q.life = 0;
        } else if (q.kind === 'note') {
          q.x += q.vx * DT; q.y += q.vy * DT;
          for (const p of this.players) if (p.alive && Math.abs(p.x - q.x) < 30 && Math.abs(p.y - q.y) < 30 && p.z < 120) { if (this.hurtPlayer(p, q.dmg, 160, q.x - q.vx, false)) { q.life = 0; if (q.bolt) this.ev({ t: 'poofs', x: q.x, y: q.y, z: q.z }); } }
          if (q.x < this.A.x0 - 200 || q.x > this.A.x1 + 200) q.life = 0;
        } else if (q.kind === 'boom') {   // out-and-back (delivery boxes, salaryman case)
          q.t++; const o = q.owner; q.spin += 0.35;
          if (q.t <= q.out) { const k = 1 - q.t / q.out * 0.4; q.x += q.ax * 460 * k * DT; q.y += q.ay * 460 * k * DT; }
          else if (o && o.state !== 'dead' && !o.gone) { const dx = o.x - q.x, dy = o.y - q.y, L = Math.hypot(dx, dy) || 1; const sp = 260 + (q.t - q.out) * 6; q.x += dx / L * sp * DT; q.y += dy / L * sp * DT; if (L < 36) q.life = 0; }
          else { q.x += q.ax * 300 * DT; q.y += q.ay * 300 * DT; }
          for (const p of this.players) if (p.alive && !q.hit.has(p.id) && Math.abs(p.x - q.x) < 34 && Math.abs(p.y - q.y) < 30 && p.z < 120) {
            if (this.hurtPlayer(p, q.dmg, 180, q.x - q.ax * 50, false)) { q.hit.add(p.id); this.applyFx(p, q.fx); }
          }
        } else if (q.kind === 'homing') {   // Landlord's Eviction Notice
          let tp = null, bd = 1e9; for (const p of this.players) if (p.alive) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; tp = p; } }
          if (tp && q.t++ < 150) { const want = Math.atan2(tp.y - q.y, tp.x - q.x); let da = want - q.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); q.ang += clamp(da, -0.045, 0.045); }
          q.x += Math.cos(q.ang) * q.sp * DT; q.y += Math.sin(q.ang) * q.sp * DT * 0.75;
          for (const p of this.players) if (p.alive && Math.abs(p.x - q.x) < 36 && Math.abs(p.y - q.y) < 34 && p.z < 120) { if (this.hurtPlayer(p, q.dmg, 240, q.x - Math.cos(q.ang) * 50, false)) { q.life = 0; this.ev({ t: 'poofs', x: q.x, y: q.y, z: 100 }); } }
        } else if (q.kind === 'eproj') {   // lobbed enemy projectile (paper ball)
          q.x += q.vx * DT; q.y += q.vy * DT; q.z += q.vz * DT; q.vz -= q.g * DT; q.spin = (q.spin || 0) + 0.3;
          for (const p of this.players) if (p.alive && Math.abs(p.x - q.x) < 36 && Math.abs(p.y - q.y) < 30 && q.z < 110) { if (this.hurtPlayer(p, q.dmg, 180, q.x - q.vx, false)) { q.life = 0; this.ev({ t: 'poofs', x: q.x, y: q.y, z: q.z }); } }
          if (q.z <= 0) { q.life = 0; this.ev({ t: 'poofs', x: q.x, y: q.y, z: 0 }); }
        }
      }
      this.projs = this.projs.filter(q => q.life > 0);
    }
    targets() { const t = this.enemies.filter(e => e.state !== 'dead' && e.state !== 'enter'); if (this.boss && this.boss.state !== 'dead' && this.boss.state !== 'intro') t.push(this.boss); return t; }

    updateHazards() {
      for (const h of this.hazards) {
        h.t++;
        if (h.kind === 'wave') {   // Mr. Muzak's bass drop: telegraph, then a ring races outward; jump it
          if (h.t === h.T) this.ev({ t: 'sfx', s: 'boom' });
          if (h.t > h.T && h.t <= h.T + h.ex) {
            const rad = (h.t - h.T) / h.ex * h.r;
            for (const p of this.players) { if (!p.alive || h.hit.has(p.id)) continue; const dd = Math.hypot(p.x - h.x, (p.y - h.y) * 1.5); if (Math.abs(dd - rad) < 46 && p.z < 70) { if (this.hurtPlayer(p, h.dmg, 280, h.x, false)) h.hit.add(p.id); } }
          }
          continue;
        }
        if (h.t === h.T) {
          this.ev({ t: 'boom', x: h.x, y: h.y, r: h.r }); this.ev({ t: 'shake', a: 0.006, d: 120 });
          for (const p of this.players) { const dx = (p.x - h.x) / h.r, dy = (p.y - h.y) / (h.r * 0.55); if (dx * dx + dy * dy <= 1 && p.z < 60) this.hurtPlayer(p, h.dmg, 300, h.x, true); }
        }
      }
      this.hazards = this.hazards.filter(h => h.t < (h.kind === 'wave' ? h.T + h.ex + 2 : h.T + 2));
    }

    updatePickups() {
      for (const k of this.pickups) {
        k.t++;
        for (const p of this.players) if (p.alive && Math.abs(p.x - k.x) < 46 && Math.abs(p.y - k.y) < 34) {
          if (k.type === 'bean') { p.mp = Math.min(p.maxmp, p.mp + 30); this.ev({ t: 'pickup', x: k.x, y: k.y, msg: '+30 CAFFEINE', col: '#6fd3ff' }); }
          else { p.hp = Math.min(p.maxhp, p.hp + 60); this.ev({ t: 'pickup', x: k.x, y: k.y, msg: '+60 HP (birthday cake)', col: '#7dff8a' }); }
          k.done = true; break;
        }
        if (k.t > 900) k.done = true;
      }
      this.pickups = this.pickups.filter(k => !k.done);
    }

    // v4.2: per-x band (S.zones: [{x0, x1, y0, y1, ramp}]) — e.g. the s4 lift cab whose floor starts much lower than the lobby's
    bandAt(x) {
      const A = this.A, Z = this.scroll && this.stage.zones; let y0 = A.y0, y1 = A.y1;
      if (Z) for (const z of Z) {
        const r = z.ramp || 1, k = x < z.x0 - r ? 0 : x < z.x0 ? (x - z.x0 + r) / r : x <= z.x1 ? 1 : 0;
        if (k > 0) { y0 = Math.max(y0, y0 + (z.y0 - y0) * k); y1 = y1 + (z.y1 - y1) * k; }
      }
      const D = this.stage.door; if (D && x > D.x0 && x < D.x1) y0 = Math.max(y0, this.doorTh(x) + 22);   // v4.3: never stand on the open lift door's face
      return [y0, y1];
    }
    // v4.3: lift doors. o.door = {y0} lets a scripted actor (boarding player / zombie stepping out) stand inside the doorway
    doorTh(x) { const D = this.stage.door; return D.y + (x - D.x0) * D.k; }
    bandFor(o) { const r = this.bandAt(o.x); if (o.door) r[0] = Math.min(r[0], o.door.y0); return r; }
    doorActive() { const D = this.stage.door; if (!D) return false; if (!this.scroll) return true; const en = this.stage.encounters[this.enc]; return this.locked && !!(en && en.cab); }
    autoIntent(p) {
      const t = p.auto, it = CO.emptyIntent(), dx = t.x - p.x, dy = t.y - p.y;
      if (Math.abs(dx) > 6) it.mx = sign(dx) * Math.min(1, Math.abs(dx) / 50 + 0.35);
      if (Math.abs(dy) > 4) it.my = sign(dy) * Math.min(1, Math.abs(dy) / 40 + 0.35);
      if (!it.mx && t.face) p.face = t.face;
      return it;
    }
    autoDone(ps, d) { return ps.every(p => !p.alive || Math.hypot(p.auto.x - p.x, p.auto.y - p.y) < (d || 12)); }
    // v4.2: nobody touches the wall — final clamp of every actor's feet into the walkable band (after separate/knockback/dash)
    wallClamp() {
      const A = this.A;
      const f = o => { const [a, b] = this.bandFor(o); o.y = (o.state === 'enter' || o.state === 'intro') && o.kind !== 'player' ? Math.max(o.y, a) : clamp(o.y, a, b); };
      for (const o of this.players) f(o);
      for (const o of this.enemies) f(o);
      if (this.boss) f(this.boss);
    }

    separate() {
      const all = this.enemies.filter(e => e.state !== 'enter' && e.state !== 'dead');
      if (this.boss && this.boss.state !== 'dead' && this.boss.state !== 'intro') all.push(this.boss);
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j], dx = b.x - a.x, dy = (b.y - a.y) * 1.6, L = Math.hypot(dx, dy), R = a.w + b.w;
        if (L < R && L > 0.01) { const push = (R - L) * 0.25; const ma = a.kind === 'boss' ? 0.1 : 1, mb = b.kind === 'boss' ? 0.1 : 1; a.x -= dx / L * push * ma; a.y -= dy / L * push * 0.6 * ma; b.x += dx / L * push * mb; b.y += dy / L * push * 0.6 * mb; }
      }
    }

    // ---------- stage director ----------
    director() {
      this.st++;
      if (this.slowmo > 0) this.slowmo--;
      if (this.state !== 'failed' && this.state !== 'clear' && this.state !== 'won' && this.players.length && this.alivePlayers().length === 0) {
        this.state = 'failed'; this.st = 0; this.ev({ t: 'failed', mode: this.mode }); return;
      }
      if (this.mode === 'survival') return this.dirSurvival();
      return this.dirStory();
    }
    spawnTick(max) {
      if (this.queue.length && --this.spawnT <= 0) {
        if (this.enemies.length < max) { this.spawnEnemy(this.queue.shift()); this.spawnT = 28; }
      }
    }
    // v5.1 co-op scaling (solo = 1): before v5.1 each extra player added +40% enemies; v5.1 adds another +30% each
    // (2P x1.7, 3P x2.4, 4P x3.1 vs solo), bosses +85% HP each (was +60%), and higher on-screen caps. Online players count the same as local ones.
    coopN() { return Math.max(1, Math.min(CO.MAX_PLAYERS || 4, this.players.length)); }
    coopCount() { return 1 + 0.7 * (this.coopN() - 1); }
    coopCap(base) { const n = this.coopN(); return Math.min(Math.round(12 + (n - 1) * 8 / 3), Math.round(base * (1 + 0.3 * (n - 1)))); }
    buildQueue(spawns) {
      const q = [], lists = spawns.map(([t, n]) => Array(Math.round(n * this.coopCount())).fill(t));
      while (lists.some(l => l.length)) for (const l of lists) if (l.length) q.push(l.pop());
      return q;
    }

    // Story: walk right through connected areas; encounters lock the screen until cleared.
    dirStory() {
      const S = this.stage, E = S.encounters, A = this.A, al = this.alivePlayers();
      const minX = al.length ? Math.min(...al.map(p => p.x)) : A.x0, maxX = al.length ? Math.max(...al.map(p => p.x)) : A.x0;
      if (this.state === 'start') {
        if (this.st === 1) this.ev({ t: 'card', title: 'STAGE ' + S.num + ': ' + S.name, sub: S.sub, lines: S.caption });
        if (this.st >= 170) this.unlock(this.enc >= 0);
      } else if (this.state === 'roam') {
        // camera may not scroll back; co-op leash keeps everyone within one (zoomed-out) screen
        this.scrollMin = Math.max(this.scrollMin, Math.min(minX - 360, S.len - 1280));
        const nxt = E[this.enc + 1], limit = nxt ? nxt.x + 560 : Math.min(S.len - 40, S.exit + 80);
        A.x0 = this.scrollMin + 40; A.x1 = Math.min(limit, minX + 1500);
        if (nxt && maxX >= nxt.x - 140) this.lock(this.enc + 1);
        else if (!nxt && maxX >= S.exit - 30) { if (S.door && S.lobbyLift) this.startExit(); else this.finish(S.endScene || null); }
      } else if (this.state === 'wave') {
        const en0 = E[this.enc];
        if (this.cd > 0) this.cd--;
        if (en0 && en0.countdown && this.cd === 0 && !this.dinged) { this.dinged = true; this.ev({ t: 'lift_ding' }); }
        this.spawnTick(Math.max(this.curWaves[this.wave].max, Math.min(20, Math.round(this.curWaves[this.wave].max * (1 + 0.3 * (this.coopN() - 1))) + 2 * (this.coopN() - 1))));
        if (!this.queue.length && this.enemies.length === 0) { this.state = 'between'; this.st = 0; this.ev({ t: 'waveclear', wave: this.wave, quiet: !!(en0 && en0.countdown) }); }
      } else if (this.state === 'between') {
        const en = E[this.enc];
        if (this.cd > 0) this.cd--;
        if (en.countdown && this.cd === 0 && !this.dinged) { this.dinged = true; this.ev({ t: 'lift_ding' }); }
        if (this.st >= 70) {
          if (en.countdown) { if (this.cd > 0) this.nextWave(Math.min(this.wave + 1, this.curWaves.length - 1)); else if (this.stage.lobbyLift) this.startBoard(); else this.unlock(true); }   // lift lobby: keep coming until the lift arrives
          else if (this.wave + 1 < this.curWaves.length) this.nextWave();
          else if (en.boss) this.toBoss(en);
          else this.unlock(true);
        }
      } else if (this.state === 'board') { this.dirBoard();
      } else if (this.state === 'alight') {
        if (this.autoDone(this.players) || this.st >= 150) { for (const p of this.players) { p.auto = null; p.door = null; p.iframes = 40; } this.lock(this.enc + 1); }
      } else if (this.state === 'exitDoor') {
        if (this.autoDone(this.players) || this.st >= 170) { for (const p of this.players) p.auto = null; this.finish(S.endScene || null); }
      } else if (this.state === 'bossIntro') {
        if (this.boss.state !== 'intro') { this.state = 'boss'; this.st = 0; }
      } else if (this.state === 'boss') {
        this.spawnTick(6);
        if (this.boss.state === 'dead') { this.state = 'bossDown'; this.st = 0; }
        if (this.boss.state === 'done') this.finish(E[this.enc].scene);
      } else if (this.state === 'bossDown') {
        if (this.st === 60) this.ev({ t: 'bark', x: this.boss.x, y: this.boss.y, z: 330, msg: this.boss.def.defeat[1], boss: true });
        if (this.st >= 170) { const en = E[this.enc]; if (en.scene) this.finish(en.scene); else { this.boss = null; this.unlock(true); } }
      }
    }
    // v4.3: scripted lift boarding. Doors open -> everyone walks INTO the back-wall lift (behind its front jambs/panels) -> doors close ->
    // fade -> the cab, stepping in from its open side door -> FLOOR 12 locks. All deterministic (sim frames).
    startBoard() {
      this.state = 'board'; this.st = 0; this.boardT = 0;
      const L = this.stage.lobbyLift, cx = (L.x0 + L.x1) / 2, n = this.players.length;
      this.ev({ t: 'liftdoor', id: 'lobby', open: true }); this.ev({ t: 'board' });
      this.players.forEach((p, i) => { p.iframes = 9999; p.auto = { x: cx + (i - (n - 1) / 2) * 56, y: L.th + 40, face: 1 }; });
    }
    dirBoard() {
      const L = this.stage.lobbyLift, cx = (L.x0 + L.x1) / 2, n = this.players.length, ps = this.players;
      ps.forEach((p, i) => {   // one after another, through the doorway
        if (this.st === 50 + i * 24) { const off = clamp((i - (n - 1) / 2) * 30, -48, 48); p.door = { y0: L.th - 40 }; p.auto = { x: cx + off, y: L.th - 26 - (i % 2) * 8, face: off < 0 ? 1 : -1 }; }
      });
      if (!this.boardT && this.st > 50 + (n - 1) * 24 && (ps.every(p => !p.alive || p.y < L.th - 14) || this.st >= 50 + n * 24 + 150)) { this.boardT = this.st; this.ev({ t: 'liftdoor', id: 'lobby', open: false }); }
      if (this.boardT && this.st === this.boardT + 48) this.ev({ t: 'fadeout' });
      if (this.boardT && this.st === this.boardT + 66) {   // ride up: into the cab
        const S = this.stage, D = S.door, en = S.encounters[this.enc + 1];
        this.view.x = clamp(en.x - 640, 0, S.len - 1280); this.scrollMin = this.view.x; this.locked = true;
        Object.assign(this.A, S.cab, { x0: this.view.x + 40, x1: D.x1 });
        ps.forEach((p, i) => {
          const x = D.sx[0] + 12 + (i % 4) * 26, tx = 3270 - i * 80;
          p.x = x; p.y = this.doorTh(x) - 14; p.z = 0; p.vx = p.vy = 0; p.face = -1; p.door = { y0: p.y - 4 };
          p.auto = { x: tx, y: 640 + (i % 3) * 22, face: -1 };
          if (!p.alive) { p.x = tx; p.y = 650; p.door = null; }
        });
        this.state = 'alight'; this.st = 0; this.ev({ t: 'snapcam', x: this.view.x + 640 });
      }
    }
    startExit() {   // roof access: everyone steps out through the cab door (behind its near pillar)
      const D = this.stage.door; this.state = 'exitDoor'; this.st = 0; this.A.x1 = D.x1;
      this.players.forEach((p, i) => { const x = D.sx[0] + 20 + (i % 4) * 22; p.iframes = 9999; p.door = { y0: this.doorTh(x) - 30 }; p.auto = { x, y: this.doorTh(x) - 20, face: 1 }; });
    }
    lock(i) {
      const S = this.stage, en = S.encounters[i]; this.enc = i; this.checkpoint = i; this.locked = true;
      this.view.x = clamp(en.x - 640, 0, S.len - 1280);
      this.A.x0 = this.view.x + 40; this.A.x1 = this.view.x + 1240; this.scrollMin = this.view.x;
      if (en.cab && S.cab) Object.assign(this.A, S.cab); else { this.A.y0 = S.band[0]; this.A.y1 = S.band[1]; }
      this.wave = -1; this.curWaves = en.waves; this.cd = en.countdown ? en.countdown * 60 : 0; this.dinged = false;
      this.ev({ t: 'lock', i, x: this.view.x, label: en.label, countdown: en.countdown || 0, cab: !!en.cab });
      if (en.waves.length) this.nextWave(); else this.toBoss(en);
    }
    unlock(go) {
      const nx = this.stage.encounters[this.enc + 1];
      if (go && nx && nx.chain) { this.ev({ t: 'floor', label: nx.label }); return this.lock(this.enc + 1); }   // lift cab: floor stops chain straight into the next wave
      this.locked = false; this.state = 'roam'; this.st = 0;
      const S = this.stage, nxt = S.encounters[this.enc + 1]; this.A.y0 = S.band[0]; this.A.y1 = S.band[1];
      if (go) this.ev({ t: 'go', label: nxt ? '' : S.exitLabel });
    }
    finish(scene) {
      this.state = 'clear'; this.st = 0; this.result = this.computeResult(); this.result.scene = scene || null;
      this.ev({ t: 'clear', result: this.result });
    }
    nextWave(force) {
      this.wave = force !== undefined ? force : this.wave + 1; const w = this.curWaves[this.wave];
      this.queue = this.buildQueue(w.spawns); this.spawnT = 10; this.state = 'wave'; this.st = 0;
      const en1 = this.stage.encounters[this.enc];
      this.ev({ t: 'wave', n: this.wave + 1, of: this.curWaves.length, text: w.text, label: en1 && en1.label, countdown: !!(en1 && en1.countdown) });
    }
    toBoss(en) {
      this.state = 'bossIntro'; this.st = 0; this.queue = [];
      const b = this.spawnBoss(en.boss, en.bossFrom, en.bossLines);
      this.ev({ t: 'bossintro', name: b.def.name, text: en.bossText });
    }

    // v5 Survival: 100 numbered levels. 1-99 = cleared wave sets (boss every 10th), 100 = BOSS RUSH (every boss, one at a time).
    dirSurvival() {
      const S = this.stage, V = this.surv;
      if (this.state === 'start') {
        if (this.st === 1) { const L = V.start; this.ev({ t: 'card', title: 'SURVIVAL: ' + S.arenaName, sub: L >= 100 ? 'LEVEL 100 — BOSS RUSH' : 'LEVEL ' + L + ' / 100', lines: [L >= 100 ? 'Every boss in the building. One at a time. No breaks for lunch.' : S.liftArena ? 'The doors keep opening. The lift never stops.' : 'Clear 100 levels of overtime. Level 100 is the Boss Rush.', 'A boss every 10 levels.'] }); }
        if (this.st >= 150) this.survNext(V.start);
      } else if (this.state === 'wave') {
        this.spawnTick(V.max);
        if (!this.queue.length && this.enemies.length === 0) this.survCleared();
      } else if (this.state === 'between') {
        if (this.st >= (V.breakT || 150)) { if (V.level % 10 === 0 && V.level < 100 && CO.survArenaFor && CO.survArenaFor(V.level + 1) !== S.id && !V.arenaEv) { V.arenaEv = true; this.ev({ t: 'survArena', next: CO.survArenaFor(V.level + 1), level: V.level + 1 }); } else if (!V.arenaEv) this.survNext(V.level + 1); }
      } else if (this.state === 'bossIntro') {
        if (this.boss.state !== 'intro') { this.state = 'boss'; this.st = 0; }
      } else if (this.state === 'boss') {
        this.spawnTick(V.rush ? 0 : 5);
        if (this.boss.state === 'dead') { this.state = 'bossDown'; this.st = 0; }
      } else if (this.state === 'bossDown') {
        if (this.st === 60) this.ev({ t: 'bark', x: this.boss.x, y: this.boss.y, z: 330, msg: this.boss.def.defeat[1], boss: true });
        if (this.st >= 140) {
          this.boss = null; this.enemies.length = 0; this.queue = [];
          if (V.rush) { V.rushI++; if (V.rushI < V.rushList.length) { this.heal(0.4); this.state = 'rushBreak'; this.st = 0; this.ev({ t: 'waveclear', wave: V.level, surv: true, rush: V.rushI, of: V.rushList.length }); } else { this.state = 'won'; this.st = 0; V.won = true; this.score += 25000; this.ev({ t: 'survwin', level: 100, score: this.score }); } }
          else this.survCleared();
        }
      } else if (this.state === 'rushBreak') {
        if (this.st >= 170) this.rushBoss();
      }
    }
    heal(f) { for (const p of this.alivePlayers()) { p.hp = Math.min(p.maxhp, p.hp + p.maxhp * f); p.mp = Math.min(p.maxmp, p.mp + p.maxmp * 0.5); } }
    survCleared() {
      const V = this.surv; this.score += 300 * V.level; V.best = Math.max(V.best || 0, V.level); V.wave = V.level;
      this.heal(V.level % 10 === 0 ? 0.5 : 0.15);
      { const cx = (this.A.x0 + this.A.x1) / 2, cy = (this.A.y0 + this.A.y1) / 2; this.pickups.push({ id: this.nextId++, type: V.level % 10 === 0 || V.level % 3 === 0 ? 'donut' : 'bean', x: cx, y: cy, t: 0 }); }   // break item
      V.breakT = V.level % 10 === 0 ? 200 : 140;
      this.state = 'between'; this.st = 0; this.ev({ t: 'waveclear', wave: V.level, surv: true, level: V.level });
    }
    levelPlan(L) {   // pure function of L (and the rng for the mix) so host / tests / docs agree
      const ORDER = ['shambler', 'commuter', 'intern', 'salesman', 'hr', 'replyall', 'penner', 'smoker', 'printer', 'itguy', 'sniper', 'spiller', 'guard', 'recept', 'wfh', 'roller', 'kbwar', 'presenter', 'bluescr', 'valet', 'washer', 'delivery', 'laundry', 'umbrella', 'courier', 'salaryman'];
      const types = ORDER.filter((t, i) => CO.ENEMIES[t] && L >= 1 + i * 3);
      return { types, total: Math.round(4 + L * 0.2), max: Math.min(12, 4 + Math.floor(L / 9)), hpMul: 1 + 0.018 * (L - 1) + 0.02 * Math.max(0, L - 60), dmgMul: 1 + 0.011 * (L - 1) + 0.015 * Math.max(0, L - 60), spdMul: 1 + 0.0025 * (L - 1), eliteP: L < 15 ? 0 : Math.min(0.35, (L - 15) * 0.0042), speakers: L >= 20 && L % 3 === 0 ? 1 + (L >= 60 ? 1 : 0) : 0 };
    }
    survNext(L) {
      const S = this.stage, V = this.surv; V.level = L; V.wave = L - 1; V.arenaEv = false;
      const P = this.levelPlan(L); this.hpMul = P.hpMul; this.dmgMul = P.dmgMul; this.spdMul = P.spdMul; this.eliteP = P.eliteP;
      if (L >= 100) {   // BOSS RUSH
        V.rush = true; V.rushI = 0; V.rushList = CO.BOSS_RUSH || Object.keys(CO.BOSSES); this.hpMul = 1.35; this.dmgMul = 1.6; this.spdMul = 1; this.eliteP = 0;
        this.ev({ t: 'wave', n: 100, of: 0, text: 'BOSS RUSH — ' + V.rushList.length + ' bosses, back to back.', surv: true, level: 100 });
        this.rushBoss(); return;
      }
      if (L % 10 === 0) {
        const ROT = ['micromanager', 'muzak', 'hrdirector', 'printerboss', 'landlord', 'ceo'], id = ROT[(L / 10 - 1) % ROT.length];
        this.hpMul = 1 + 0.011 * (L - 1) + 0.015 * Math.max(0, L - 60); this.dmgMul = P.dmgMul;
        this.state = 'bossIntro'; this.st = 0; this.queue = [];
        const b = this.spawnBoss(id, S.liftArena ? 'r' : (this.rng() < 0.5 ? 'l' : 'r'), id === 'ceo' ? ['Overtime is MANDATORY.', 'Survival? We call it a Tuesday.'] : null);
        this.ev({ t: 'bossintro', name: b.def.name, text: 'LEVEL ' + L + ' — PERFORMANCE REVIEW!' });
        return;
      }
      const counts = {};
      for (let k = 0; k < P.total; k++) { const t = k < 2 ? P.types[P.types.length - 1] : P.types[Math.floor(this.rng() * P.types.length)]; counts[t] = (counts[t] || 0) + 1; }
      if (P.speakers) counts.speaker = P.speakers;
      V.max = this.coopN() > 1 ? Math.max(P.max, this.coopCap(P.max) + (this.coopN() - 1)) : P.max;   // v5.1: cap 12 solo -> ~20 at 4P
      if (S.liftArena) this.ev({ t: 'doors', open: true });
      this.queue = this.buildQueue(Object.entries(counts)); this.spawnT = 10; this.state = 'wave'; this.st = 0;
      this.ev({ t: 'wave', n: L, of: 0, text: SURV_LINES[(L - 1) % SURV_LINES.length], surv: true, level: L });
    }
    rushBoss() {
      const V = this.surv, id = V.rushList[V.rushI]; this.state = 'bossIntro'; this.st = 0; this.queue = [];
      const b = this.spawnBoss(id, this.stage.liftArena ? 'r' : (V.rushI % 2 ? 'r' : 'l'), null);
      this.ev({ t: 'bossintro', name: b.def.name, text: 'BOSS RUSH ' + (V.rushI + 1) + ' / ' + V.rushList.length });
    }
    computeResult() {
      const s = this.stats, sec = s.frames / 60;
      const time = clamp(Math.round(3000 - Math.max(0, sec - (this.stage.par || 200)) * 9), 0, 3000);
      const combo = Math.min(3000, s.maxCombo * 30), dmg = Math.max(0, Math.round(2500 - s.dmgTaken * 3.5)), ko = Math.min(1500, s.kos * 25);
      const total = Math.max(0, time + combo + dmg + ko - this.continues * 1500);
      const grade = CO.GRADES.find(g => total >= g.min);
      const h = Math.floor(this.gameSec / 3600), m = Math.floor(this.gameSec / 60) % 60;
      return { total, time, combo, dmg, ko, grade, sec, clockH: h, clockM: m, clock: this.gameSec, onTime: this.gameSec < 20 * 3600, stats: Object.assign({}, s), continues: this.continues, stage: this.stage.id, score: this.score, wave: this.surv.wave };
    }
  }

  const SURV_LINES = ['They just keep scheduling meetings.', 'A calendar invite with no end time...', 'Someone said "quick question". Everyone heard.',
    'The coffee machine is broken. Morale: zombified.', 'Mandatory team-building. Mandatory.', 'IT pushed an update. Nobody can leave.',
    'Your out-of-office reply was rejected.', 'The 5 PM all-hands is now the 9 PM all-hands.', 'Someone microwaved fish. The horde grows.',
    'They found the Reply-All button. All of it.', 'Synergy levels: critical.', "It's Q4 forever now."];
  CO.emptyIntent = () => ({ mx: 0, my: 0, h: {}, p: {} });
  CO.ACTIONS = ACTIONS;
  CO.Sim = Sim;
  CO.fmtClock = sec => { let h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; };
})(window.CO);
