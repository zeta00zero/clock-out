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
      this.mode = opts.mode || (opts.stage && opts.stage !== 'survival' ? 'story' : 'survival');
      this.stage = CO.STAGES[opts.stage || 'survival'];
      this.scroll = !!this.stage.len;   // story stages scroll left->right through connected areas
      if (this.scroll) {
        const S = this.stage; this.world = { w: S.len, h: S.h };
        this.A = { x0: 40, x1: 1240, y0: S.band[0], y1: S.band[1] };
        this.view = { x: 0, w: 1280 }; this.enc = -1; this.scrollMin = 0; this.locked = false; this.curWaves = [];
        const cp = typeof opts.checkpoint === 'number' ? opts.checkpoint : -1;
        if (cp >= 0) { this.enc = cp - 1; this.scrollMin = Math.max(0, S.encounters[cp].x - 1100); this.A.x0 = this.scrollMin + 40; this.A.x1 = this.scrollMin + 1240; }
      } else { this.world = this.stage.world; this.A = Object.assign({}, this.stage.arena); }
      this.surv = { wave: 0 }; this.score = opts.score || 0; this.hpMul = 1; this.dmgMul = 1;
      this.clockRate = this.mode === 'survival' ? 20 : 7;
      this.players = []; this.enemies = []; this.projs = []; this.hazards = []; this.pickups = [];
      this.boss = null; this.events = []; this.frame = 0; this.hitstop = 0; this.timeStop = 0; this.slowmo = 0;
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
        charge: 0, alive: true, pose: c.poses.idle, rot: 0, flip: false, w: s.w, flash: 0, reviveT: 0, otReady: false };
      this.players.push(p); return p;
    }
    alivePlayers() { return this.players.filter(p => p.alive); }

    step(intents) {
      this.events.length = 0;
      if (this.hitstop > 0) { this.hitstop--; return; }
      this.frame++; this.stats.frames++;
      if (this.state !== 'clear' && this.state !== 'failed') this.gameSec += this.clockRate * DT;
      this.players.forEach((p, i) => this.updatePlayer(p, intents[i] || CO.emptyIntent()));
      if (this.timeStop > 0) { this.timeStop--; } else {
        for (const e of this.enemies) this.updateEnemy(e);
        if (this.boss) this.updateBoss(this.boss);
        this.updateProjs(); this.updateHazards(); this.separate();
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
      p.mp = Math.min(p.maxmp, p.mp + S.mpRegen * DT);
      p.cds = p.cds.map(v => Math.max(0, v - DT));
      if (p.buff > 0) p.buff -= DT;
      if (p.comboT > 0 && --p.comboT <= 0) { if (p.overtime) this.ev({ t: 'overtime_end', p: p.id }); p.combo = 0; p.overtime = false; }
      const aspd = p.buff > 0 ? 1.3 : 1, spd = S.speed * (p.buff > 0 ? 1.3 : 1);
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
        if (take('jump')) { p.state = 'air'; p.vz = S.jump; p.airChain = 0; this.ev({ t: 'sfx', s: 'jump' }); }
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
      } else if (p.state === 'move') {
        this.runMove(p, aspd, take, tryGeneric, mx);
      } else if (p.state === 'dash') {
        const k = p.st / 18; p.vx = p.face * S.dash * (1 - k * 0.6); p.vy = (my || 0) * S.speed * 0.4;
        p.pose = c.poses.dash; p.rot = 0;
        if (p.st > 3 && take('light')) this.startMove(p, c.start.dashLight);
        else if (p.st >= 18) { p.state = 'idle'; p.st = 0; }
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
      if (p.z <= 0 && p.state === 'air') { p.state = 'idle'; p.st = 0; this.ev({ t: 'land', x: p.x, y: p.y }); }
    }

    physics(o, g) {
      o.x += o.vx * DT; o.y += o.vy * DT;
      if (o.z > 0 || o.vz > 0) { o.z += o.vz * DT; o.vz -= g * DT; if (o.z <= 0) { o.z = 0; o.landed = Math.abs(o.vz); o.vz = 0; } }
      const A = this.A, pad = o.kind === 'boss' ? 30 : 0;
      if (o.kind === 'player' || o.state !== 'enter') { o.x = clamp(o.x, A.x0 + pad, A.x1 - pad); o.y = clamp(o.y, A.y0, A.y1); }
    }

    startMove(p, id) {
      const m = p.char.moves[id]; if (!m) return false;
      if (m.air && p.z <= 0 && !m.dive) return false;
      if (m.air && !m.dive && p.airChain >= (m.maxChain || 6)) return false;
      p.state = 'move'; p.move = m; p.moveId = id; p.mt = 0; p.prevMt = -1; p.hitMap = new Map(); p.charge = 0; p.st = 0;
      if (p.wantFace) p.face = p.wantFace;
      if (m.air) { p.airChain++; if (m.dive) { p.vz = -1700; p.vx = p.face * 120; } }
      this.ev({ t: 'sfx', s: m.sfx || 'swing', delay: m.active[0] });
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
      if (f >= m.active[0] && pf < m.active[0]) {
        if (m.selfLaunch) { p.vz = m.selfLaunch; }
        if (m.hover && p.vz < m.hover) p.vz = m.hover;
        const charged = m.charge && p.charge >= 22;
        this.ev({ t: 'swing', p: p.id, move: p.moveId, x: p.x, y: p.y, z: p.z, face: p.face, arc: m.arc, spin: m.spin, shock: m.shock, charged, overtime: p.overtime, flip: p.flip });
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
        p.hitMap.set(e.id, f);
        const finisher = m.every && f >= m.active[1] - m.every;
        let dmg = charged ? m.charge.dmg : m.dmg;
        this.damage(e, p, { dmg, kb: finisher && m.finalKb ? m.finalKb : m.kb, stun: m.stun, launch: m.launch, juggle: m.juggle,
          knockdown: m.knockdown || charged, breaksGuard: m.breaksGuard || charged, stampText: charged ? 'FINAL DRAFT' : m.stampText, from: p.x, heavy: m.dmg >= 40 || charged });
        any = true;
      }
      if (any) this.hitstop = Math.max(this.hitstop, m.dmg >= 40 || charged ? 5 : 2);
    }

    // generic damage from a player to an enemy/boss
    damage(e, p, o) {
      if (e.state === 'dead') return;
      let dmg = o.dmg * (p && p.overtime ? 1.25 : 1) * (p && p.buff > 0 ? 1.1 : 1);
      const dir = sign(e.x - (o.from !== undefined ? o.from : (p ? p.x : e.x)));
      let fx = ['paper', 'star', 'slime', 'ink', 'coffee'][Math.floor(this.rng() * 5)];
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
      const r = this.rng();
      if (r < 0.22) this.pickups.push({ id: this.nextId++, type: 'bean', x: e.x, y: e.y, t: 0 });
      else if (r < 0.32) this.pickups.push({ id: this.nextId++, type: 'donut', x: e.x, y: e.y, t: 0 });
    }

    hurtPlayer(p, dmg, kb, from, knockdown) {
      if (!p.alive || p.iframes > 0 || p.state === 'ult' || p.state === 'dash' || p.state === 'down') return false;
      if (this.god) dmg = 0;
      p.hp -= dmg; this.stats.dmgTaken += dmg; p.flash = 6;
      if (p.overtime) this.ev({ t: 'overtime_end', p: p.id });
      p.combo = 0; p.overtime = false; p.comboT = 0;
      const dir = sign(p.x - from);
      p.move = null; p.dived = false;
      this.ev({ t: 'phurt', p: p.id, x: p.x, y: p.y, z: p.z + 80, dmg });
      if (p.hp <= 0) { p.hp = 0; p.alive = false; p.state = 'ko'; p.vx = dir * 300; this.ev({ t: 'pko', p: p.id }); return true; }
      if (knockdown) { p.state = 'down'; p.st = 0; p.vx = dir * kb; p.vz = 300; }
      else { p.state = 'hurt'; p.st = 0; p.stun = 18; p.vx = dir * kb; }
      p.iframes = knockdown ? 0 : 20;
      return true;
    }

    startDash(p) {
      p.state = 'dash'; p.st = 0; p.iframes = 13; if (p.wantFace) p.face = p.wantFace; p.move = null;
      this.ev({ t: 'dash', p: p.id, x: p.x, y: p.y, face: p.face }); return true;
    }

    startSkill(p, i) {
      const sk = p.char.skills[i]; p.mp -= sk.cost; p.cds[i] = sk.cd;
      p.state = 'skill'; p.skill = sk; p.st = 0; p.mt = 0; p.prevMt = -1; p.pose = sk.pose; p.rot = 0; p.flip = false;
      if (p.wantFace) p.face = p.wantFace;
      this.ev({ t: 'skill', p: p.id, id: sk.id, name: sk.name, x: p.x, y: p.y });
      return true;
    }

    runSkill(p, aspd) {
      const sk = p.skill; p.mt += aspd; const f = Math.floor(p.mt), pf = Math.floor(p.prevMt); p.prevMt = p.mt;
      p.vx *= 0.75; p.vy *= 0.75; p.pose = sk.pose;
      if (sk.id === 'coffee' && f >= 18 && pf < 18) { p.hp = Math.min(p.maxhp, p.hp + sk.heal); p.buff = sk.buff; this.ev({ t: 'buff', p: p.id, x: p.x, y: p.y }); }
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
        this.projs.push({ id: this.nextId++, kind: 'case', owner: p, x: p.x + p.face * 60, y: p.y, z: 70, vx: p.face * C.speed, vy: 0, life: 200, t: 0, C, hitT: new Map() });
        this.ev({ t: 'sfx', s: 'throw' });
      }
      if (p.mt >= sk.total) { p.state = 'idle'; p.st = 0; }
    }

    startUlt(p) {
      const u = p.char.ult; p.state = 'ult'; p.mt = 0; p.ot = 0; p.otReady = false; p.vx = p.vy = 0; p.move = null; this.stats.ults++;
      this.timeStop = u.total; p.pose = u.pose;
      const line = p.char.lines.ult[Math.floor(this.rng() * p.char.lines.ult.length)];
      this.ev({ t: 'ult_start', p: p.id, line }); return true;
    }
    runUlt(p) {
      const u = p.char.ult; p.mt++; p.pose = u.pose; p.rot = 0;
      if (p.mt === u.at) {
        for (const e of this.enemies) if (e.state !== 'dead') { this.damage(e, p, { dmg: u.dmg, kb: 300, launch: 700, from: p.x, heavy: true }); }
        if (this.boss && this.boss.state !== 'dead' && this.boss.state !== 'intro') this.damage(this.boss, p, { dmg: u.bossDmg, kb: 0, from: p.x, heavy: true, stampText: 'CLOCKED OUT' });
        this.ev({ t: 'ult_hit', p: p.id }); this.ev({ t: 'shake', a: 0.02, d: 400 });
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
      const hp = d.hp * (1 + 0.35 * (n - 1)) * this.hpMul;
      const e = { walkD: this.r(0, 100), id: this.nextId++, kind: 'enemy', type, def: d, x, y, z: 0, vx: 0, vy: 0, vz: 0, face: x < (A.x0 + A.x1) / 2 ? 1 : -1,
        hp, maxhp: hp, state: 'enter', st: 0, cd: 40 + this.r(0, 60), w: d.w, guard: d.guard || 0, shieldDown: 0, flash: 0,
        slotY: this.r(-28, 28), pose: d.frames.walk, rot: 0, barkT: this.r(200, 900) };
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
      if (e.state === 'enter') {
        const tx = clamp(e.x, A.x0 + 60, A.x1 - 60), ty = clamp(e.y, A.y0 + 20, A.y1 - 20);
        const dx = tx - e.x, dy = ty - e.y, L = Math.hypot(dx, dy) || 1;
        e.vx = dx / L * d.speed * 1.3; e.vy = dy / L * d.speed * 1.3; walkPose(); e.face = sign(dx || e.face);
        if (L < 10) { e.state = 'chase'; e.st = 0; }
      } else if (e.state === 'chase') {
        walkPose();
        if (e.type === 'hr' && e.shieldDown > 0) { e.pose = d.frames.hurt; }
        if (!t) { e.vx *= 0.9; e.vy *= 0.9; }
        else {
          const side = sign(e.x - t.x), tx = t.x + side * (d.ai === 'ranged' ? d.keep : at.range * 0.8), ty = t.y + e.slotY * (d.ai === 'ranged' ? 2 : 0.4);
          const dx = tx - e.x, dy = ty - e.y, L = Math.hypot(dx, dy);
          const sp = d.speed * (e.type === 'hr' && e.shieldDown > 0 ? 0.6 : 1);
          if (L > 8) { e.vx = dx / L * sp; e.vy = dy / L * sp * 0.8; } else { e.vx *= 0.7; e.vy *= 0.7; e.pose = d.frames.walk; e.rot = 0; }
          e.face = sign(t.x - e.x);
          if (e.cd > 0) e.cd--;
          const inR = d.ai === 'ranged' ? Math.abs(t.x - e.x) < at.range && Math.abs(t.y - e.y) < 90 : Math.abs(t.x - e.x) < at.range + 20 && Math.abs(t.y - e.y) < 34;
          if (inR && e.cd <= 0 && this.attackers() < 2 + this.players.length) { e.state = 'windup'; e.st = 0; e.vx = e.vy = 0; this.ev({ t: 'tell', id: e.id }); }
        }
        if (--e.barkT <= 0) { e.barkT = this.r(500, 1400); if (this.rng() < 0.5) this.ev({ t: 'bark', x: e.x, y: e.y, z: 170, msg: d.barks[Math.floor(this.rng() * d.barks.length)] }); }
      } else if (e.state === 'windup') {
        e.pose = d.frames.walk; e.rot = -0.12 * e.face; e.vx *= 0.8; e.vy *= 0.8;
        if (e.st >= at.windup) {
          e.state = 'attack'; e.st = 0; e.hitDone = false; if (at.lunge) e.vx = e.face * at.lunge; this.ev({ t: 'sfx', s: at.kind === 'shout' ? 'shout' : 'eswing' });
          if (at.kind === 'throw' && t) {   // lobbed paper ball, lands where the target is heading
            const T = 0.8, z0 = 120, g = 900, tx = t.x + t.vx * 0.3, ty = t.y + t.vy * 0.3;
            this.projs.push({ id: this.nextId++, kind: 'eproj', tex: at.proj, owner: e, x: e.x + e.face * 40, y: e.y, z: z0, vx: (tx - e.x) / T, vy: (ty - e.y) / T, vz: (0.5 * g * T * T - z0) / T, g, life: 120, dmg: at.dmg * this.dmgMul });
            e.hitDone = true;
          }
          if (at.kind === 'shout') { this.ev({ t: 'shout', x: e.x, y: e.y, face: e.face }); if (this.rng() < at.cc && this.enemies.length < 10) { this.spawnEnemy('intern'); this.ev({ t: 'text', x: e.x, y: e.y, z: 190, msg: '+1 CC\'d', col: '#9fd0ff', small: true }); } }
          if (at.kind === 'whip') this.ev({ t: 'whip', x: e.x, y: e.y, face: e.face, r: at.range });
        }
      } else if (e.state === 'attack') {
        e.pose = d.frames.atk; e.rot = 0.05 * e.face;
        if (!at.lunge) e.vx *= 0.8; else e.vx *= 0.93;
        if (!e.hitDone) for (const p of this.players) {
          if (!p.alive) continue;
          const cx = e.x + e.face * at.range * 0.6, dx = (p.x - cx) / (at.rx + p.w), dy = (p.y - e.y) / (at.ry + 12);
          if (dx * dx + dy * dy <= 1 && p.z < 70) { if (this.hurtPlayer(p, at.dmg * this.dmgMul, at.kb, e.x, e.type === 'hr')) { e.hitDone = at.kind !== 'shout'; if (at.kind === 'whip') this.ev({ t: 'text', x: p.x, y: p.y, z: 150, msg: 'YOINK', col: '#9fffb0', small: true }); } }
        }
        if (e.st >= at.active) { e.state = 'recover'; e.st = 0; }
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
      this.physics(e, EGRAV);
    }

    // ---------- boss ----------
    spawnBoss(id, from, lines) {
      const d = CO.BOSSES[id], A = this.A, n = Math.max(1, this.players.length);
      const hp = d.hp * (1 + 0.6 * (n - 1)) * this.hpMul, L = from === 'l';
      this.boss = { id: this.nextId++, kind: 'boss', type: id, def: d, x: L ? A.x0 - 200 : A.x1 + 200, y: (A.y0 + A.y1) / 2 - 20, z: 0, vx: 0, vy: 0, vz: 0, face: L ? 1 : -1,
        hp, maxhp: hp, poise: d.poise, state: 'intro', st: 0, cd: 60, w: d.w, flash: 0, phase: 1, pose: d.frames.idle, rot: 0, summonCd: 400, last: '',
        from: L ? 'l' : 'r', intro: lines || d.intro, fightT: 0 };
      return this.boss;
    }
    startAura(b) {   // scripted, unwinnable lobby encounter: the CEO becomes immune and seals the exit
      if (b.state === 'aura' || b.state === 'done') return;
      b.state = 'aura'; b.st = 0; b.vx = b.vy = 0; this.hazards.length = 0; this.projs = this.projs.filter(q => q.kind === 'staple' || q.kind === 'case');
      for (const e of this.enemies) { this.ev({ t: 'kill', x: e.x, y: e.y, z: e.z, type: e.type }); e.gone = true; }
      for (const p of this.players) p.iframes = 400;
      this.ev({ t: 'banner', msg: 'MONDAY AURA', sub: 'Your stapler does... nothing?!' }); this.ev({ t: 'sfx', s: 'boom' }); this.ev({ t: 'shake', a: 0.015, d: 500 });
    }

    updateBoss(b) {
      const d = b.def, A = this.A; b.st++; if (b.flash > 0) b.flash--;
      const t = this.nearestPlayer(b); const sp = d.speed * (b.phase === 2 ? 1.25 : 1);
      const say = m => this.ev({ t: 'bark', x: b.x, y: b.y, z: 330, msg: m, boss: true });
      if (b.state === 'intro') {
        b.pose = d.frames.idle; const L = b.from === 'l', tx = L ? A.x0 + 180 : A.x1 - 180;
        b.vx = L ? (b.x < tx ? 200 : 0) : (b.x > tx ? -160 : 0); b.rot = Math.sin(b.st * 0.2) * 0.03;
        b.x += b.vx * DT; if (b.st === 40) say(b.intro[0]); if (b.st === 130) say(b.intro[1]);
        if (b.st >= 210) { b.state = 'idle'; b.st = 0; b.cd = 30; }
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
      b.fightT++;
      if (d.scripted && b.fightT > 2400) return this.startAura(b);   // never unwinnable-forever: the cutscene triggers regardless
      if (b.phase === 1 && b.hp < b.maxhp * 0.5) { b.phase = 2; say(d.phase2); this.ev({ t: 'banner', msg: 'PHASE 2', sub: d.name + ': "' + d.phase2 + '"' }); }
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
            if (dist < 260 && r < 0.55) next = 'sweep';
            else if (b.summonCd <= 0 && adds < 3 && r < 0.75) next = 'summon';
            else next = this.rng() < 0.5 ? 'deadline' : 'notes';
            if (next === b.last && next !== 'sweep') next = next === 'deadline' ? 'notes' : 'deadline';
            b.last = next; b.state = next; b.st = 0; b.vx = b.vy = 0;
            if (next === 'sweep') this.ev({ t: 'tell', id: b.id, boss: true });
            if (this.rng() < 0.45) say(d.barks[Math.floor(this.rng() * d.barks.length)]);
          }
        }
      } else if (b.state === 'sweep') {
        const W = b.phase === 2 ? 30 : 40;
        b.pose = b.st < W ? d.frames.idle : d.frames.atk; b.rot = b.st < W ? -0.08 * b.face : 0.06 * b.face;
        if (b.st === W) { this.ev({ t: 'sfx', s: 'bossswing' }); this.ev({ t: 'swing', p: 0, x: b.x, y: b.y, z: 0, face: b.face, arc: [-80, 80], enemy: true, r: 190 }); }
        if (b.st >= W && b.st <= W + 8) for (const p of this.players) {
          if (!p.alive) continue; const cx = b.x + b.face * 110, dx = (p.x - cx) / 200, dy = (p.y - b.y) / 85;
          if (dx * dx + dy * dy <= 1 && p.z < 120) this.hurtPlayer(p, 34 * this.dmgMul, 420, b.x, true);
        }
        if (b.st >= W + 45) { b.state = 'idle'; b.st = 0; b.cd = b.phase === 2 ? 35 : 55; }
      } else if (b.state === 'deadline') {
        b.pose = d.frames.idle; b.rot = 0;
        if (b.st === 20 && t) {
          const n = b.phase === 2 ? 5 : 3;
          for (let k = 0; k < n; k++) {
            const hx = clamp(t.x + (k === 0 ? t.vx * 0.5 : this.r(-220, 220)), A.x0 + 40, A.x1 - 40), hy = clamp(t.y + (k === 0 ? t.vy * 0.5 : this.r(-140, 140)), A.y0 + 20, A.y1 - 20);
            this.hazards.push({ id: this.nextId++, kind: 'deadline', label: d.hazard || 'DUE', x: hx, y: hy, r: 95, t: 0, T: b.phase === 2 ? 80 : 100, dmg: 38 * this.dmgMul });
          }
          this.ev({ t: 'sfx', s: 'tick' });
        }
        if (b.st >= 70) { b.state = 'idle'; b.st = 0; b.cd = 50; }
      } else if (b.state === 'notes') {
        b.pose = b.st < 25 ? d.frames.idle : d.frames.atk;
        if (b.st === 25 && t) {
          const n = b.phase === 2 ? 7 : 5, base = Math.atan2((t.y - b.y) / 0.6, t.x - b.x);
          for (let k = 0; k < n; k++) { const a = base + (k / (n - 1) - 0.5) * 0.9; this.projs.push({ id: this.nextId++, kind: 'note', tex: d.proj || 'note', owner: b, x: b.x + b.face * 80, y: b.y, z: 150, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520 * 0.6, life: 110, dmg: 14 * this.dmgMul }); }
          this.ev({ t: 'sfx', s: 'throw' });
        }
        if (b.st >= 60) { b.state = 'idle'; b.st = 0; b.cd = 45; }
      } else if (b.state === 'summon') {
        b.pose = d.frames.summon; b.rot = Math.sin(b.st * 0.5) * 0.04;
        if (b.st === 30) {
          const types = d.summon || ['intern']; say(b.phase === 2 ? 'EVERYONE! In my office! NOW!' : "Let's circle back! Team?!");
          for (let k = 0; k < (b.phase === 2 ? 4 : 3); k++) this.spawnEnemy(types[k % types.length]); b.summonCd = 700;
        }
        if (b.st >= 70) { b.state = 'idle'; b.st = 0; b.cd = 40; }
      } else if (b.state === 'dizzy') {
        b.pose = d.frames.hurt; b.rot = Math.sin(b.st * 0.3) * 0.08; b.vx *= 0.8; b.vy *= 0.8;
        if (b.st >= 210) { b.state = 'idle'; b.st = 0; b.cd = 20; }
      }
      b.vx *= 0.96;
      this.physics(b, EGRAV);
    }

    killBoss(b) {
      b.state = 'dead'; b.st = 0; b.hp = 0; this.stats.kos++; this.score += 5000;
      for (const e of this.enemies) { this.ev({ t: 'kill', x: e.x, y: e.y, z: e.z, type: e.type }); e.gone = true; }
      this.hazards.length = 0; this.projs = this.projs.filter(p => p.kind !== 'note' && p.kind !== 'eproj');
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
            if (Math.abs(e.x - q.x) < e.w + 18 && Math.abs(e.y - q.y) < 34 && Math.abs(e.z + 80 - q.z) < 110) {
              q.hit.add(e.id); this.damage(e, q.owner, { dmg: q.dmg, kb: 40, stun: q.stun, from: q.x - sign(q.vx) * 50, pin: e.kind !== 'boss', breaksGuard: true });
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
            if (L < C.r + e.w) { const last = q.hitT.get(e.id); if (last === undefined || q.t - last >= C.every) { q.hitT.set(e.id, q.t); this.damage(e, o, { dmg: C.dmg, kb: 10, stun: 16, from: q.x, breaksGuard: true }); this.ev({ t: 'sfx', s: 'tap' }); } }
          }
          if (q.t > C.out + C.back + 60) q.life = 0;
        } else if (q.kind === 'note') {
          q.x += q.vx * DT; q.y += q.vy * DT;
          for (const p of this.players) if (p.alive && Math.abs(p.x - q.x) < 30 && Math.abs(p.y - q.y) < 30 && p.z < 120) { if (this.hurtPlayer(p, q.dmg, 160, q.x - q.vx, false)) q.life = 0; }
          if (q.x < this.A.x0 - 200 || q.x > this.A.x1 + 200) q.life = 0;
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
        if (h.t === h.T) {
          this.ev({ t: 'boom', x: h.x, y: h.y, r: h.r }); this.ev({ t: 'shake', a: 0.006, d: 120 });
          for (const p of this.players) { const dx = (p.x - h.x) / h.r, dy = (p.y - h.y) / (h.r * 0.55); if (dx * dx + dy * dy <= 1 && p.z < 60) this.hurtPlayer(p, h.dmg, 300, h.x, true); }
        }
      }
      this.hazards = this.hazards.filter(h => h.t < h.T + 2);
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
      if (this.state !== 'failed' && this.state !== 'clear' && this.players.length && this.alivePlayers().length === 0) {
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
    buildQueue(spawns) {
      const q = [], lists = spawns.map(([t, n]) => Array(Math.round(n * (1 + 0.4 * (this.players.length - 1)))).fill(t));
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
        else if (!nxt && maxX >= S.exit - 30) this.finish(null);
      } else if (this.state === 'wave') {
        this.spawnTick(this.curWaves[this.wave].max + 2 * (this.players.length - 1));
        if (!this.queue.length && this.enemies.length === 0) { this.state = 'between'; this.st = 0; this.ev({ t: 'waveclear', wave: this.wave }); }
      } else if (this.state === 'between') {
        if (this.st >= 70) {
          const en = E[this.enc];
          if (this.wave + 1 < this.curWaves.length) this.nextWave();
          else if (en.boss) this.toBoss(en);
          else this.unlock(true);
        }
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
    lock(i) {
      const S = this.stage, en = S.encounters[i]; this.enc = i; this.checkpoint = i; this.locked = true;
      this.view.x = clamp(en.x - 640, 0, S.len - 1280);
      this.A.x0 = this.view.x + 40; this.A.x1 = this.view.x + 1240; this.scrollMin = this.view.x;
      this.wave = -1; this.curWaves = en.waves; this.ev({ t: 'lock', i, x: this.view.x });
      if (en.waves.length) this.nextWave(); else this.toBoss(en);
    }
    unlock(go) {
      this.locked = false; this.state = 'roam'; this.st = 0;
      const S = this.stage, nxt = S.encounters[this.enc + 1];
      if (go) this.ev({ t: 'go', label: nxt ? '' : S.exitLabel });
    }
    finish(scene) {
      this.state = 'clear'; this.st = 0; this.result = this.computeResult(); this.result.scene = scene || null;
      this.ev({ t: 'clear', result: this.result });
    }
    nextWave() {
      this.wave++; const w = this.curWaves[this.wave];
      this.queue = this.buildQueue(w.spawns); this.spawnT = 10; this.state = 'wave'; this.st = 0;
      this.ev({ t: 'wave', n: this.wave + 1, of: this.curWaves.length, text: w.text });
    }
    toBoss(en) {
      this.state = 'bossIntro'; this.st = 0; this.queue = [];
      const b = this.spawnBoss(en.boss, en.bossFrom, en.bossLines);
      this.ev({ t: 'bossintro', name: b.def.name, text: en.bossText });
    }

    // Survival: endless escalating waves, a boss every N waves, score + best (saved by the UI).
    dirSurvival() {
      const S = this.stage, V = this.surv;
      if (this.state === 'start') {
        if (this.st === 1) this.ev({ t: 'card', title: 'SURVIVAL', sub: 'ENDLESS OVERTIME', lines: ['How long can Lemon last before the office wins?', 'Boss review every ' + S.bossEvery + ' waves.'] });
        if (this.st >= 150) this.survNext();
      } else if (this.state === 'wave') {
        this.spawnTick(V.max);
        if (!this.queue.length && this.enemies.length === 0) this.survCleared();
      } else if (this.state === 'between') {
        if (this.st >= 110) this.survNext();
      } else if (this.state === 'bossIntro') {
        if (this.boss.state !== 'intro') { this.state = 'boss'; this.st = 0; }
      } else if (this.state === 'boss') {
        this.spawnTick(6);
        if (this.boss.state === 'dead') { this.state = 'bossDown'; this.st = 0; }
      } else if (this.state === 'bossDown') {
        if (this.st === 60) this.ev({ t: 'bark', x: this.boss.x, y: this.boss.y, z: 330, msg: this.boss.def.defeat[1], boss: true });
        if (this.st >= 140) { this.boss = null; this.survCleared(); }
      }
    }
    survCleared() {
      const V = this.surv; this.score += 400 * V.wave; V.best = Math.max(V.best || 0, V.wave);
      for (const p of this.alivePlayers()) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.12);
      this.state = 'between'; this.st = 0; this.ev({ t: 'waveclear', wave: V.wave, surv: true });
    }
    survNext() {
      const S = this.stage, V = this.surv, w = ++V.wave;
      this.hpMul = 1 + 0.07 * (w - 1); this.dmgMul = 1 + 0.035 * (w - 1);
      if (w % S.bossEvery === 0) {
        const id = S.bossRotation[(w / S.bossEvery - 1) % S.bossRotation.length];
        this.state = 'bossIntro'; this.st = 0; this.queue = [];
        const b = this.spawnBoss(id, this.rng() < 0.5 ? 'l' : 'r', id === 'ceo' ? ['Overtime is MANDATORY.', 'Survival? We call it a Tuesday.'] : null);
        this.ev({ t: 'bossintro', name: b.def.name, text: 'WAVE ' + w + ' — PERFORMANCE REVIEW!' });
        return;
      }
      const types = S.unlocks.filter(([n]) => w >= n).map(u => u[1]);
      const total = Math.round(4 + w * 1.5), counts = {};
      for (let k = 0; k < total; k++) { const t = k < 2 ? types[types.length - 1] : types[Math.floor(this.rng() * types.length)]; counts[t] = (counts[t] || 0) + 1; }
      V.max = Math.min(13, 5 + Math.floor(w * 0.6));
      this.queue = this.buildQueue(Object.entries(counts)); this.spawnT = 10; this.state = 'wave'; this.st = 0;
      const J = SURV_LINES[(w - 1) % SURV_LINES.length];
      this.ev({ t: 'wave', n: w, of: 0, text: J, surv: true });
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
