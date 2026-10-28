// Clock Out! v4.2 — character data: KEITH (first form: after-hours AV tech, Paw-Click Laser Presenter). Ranged support / summoner.
// Built from preview_v5/keith_spec.md. Hits use purple sparkle + paw-print FX (hitFx 'paw'); the only red is the S1 laser dot.
window.CO = window.CO || {};
(function (CO) {
  // beam: visual laser line (len px) drawn by game.js on the 'swing' event; proj: piercing bolt spawned at active[0]
  const M = {
    l1: { name: 'Aim Jab', total: 16, poses: [[0, 'jab', -0.05], [4, 'jab', 0.03]], active: [4, 7], hit: { fx: 140, rx: 125, ry: 40, zr: 95 }, dmg: 14, kb: 110, stun: 20,
      beam: 260, next: { light: 'l2', heavy: 'h1' }, cancel: 8, lunge: 60, sfx: 'zap' },
    l2: { name: 'Laser Whip', total: 20, poses: [[0, 'whip', 0.12, true], [6, 'whip', -0.06]], active: [6, 10], hit: { fx: 120, rx: 140, ry: 52, zr: 95 }, dmg: 18, kb: 140, stun: 22, maxTargets: 2,
      arc: [60, -50], next: { light: 'l3', heavy: 'h1' }, cancel: 10, lunge: 80, sfx: 'zap' },
    l3: { name: 'Pointer Shot', total: 22, poses: [[0, 'shot', -0.04], [7, 'shot', 0.04]], active: [7, 9], hit: { fx: 60, rx: 60, ry: 34, zr: 90 }, dmg: 22, kb: 150, stun: 24,
      proj: { speed: 1150, dmg: 22, pierce: 4, life: 42, kb: 150, stun: 24 }, next: { light: 'l4', heavy: 'h1' }, cancel: 12, sfx: 'zap' },
    l4: { name: 'Spin Sweep', total: 32, poses: [[0, 'sweep', 0], [8, 'sweep', 0, true], [16, 'sweep', 0], [24, 'idle', 0]], active: [6, 22], every: 7,
      hit: { fx: 0, rx: 150, ry: 70, zr: 100 }, dmg: 10, kb: 60, finalKb: 360, stun: 24, arc: [-180, 180], spin: true, next: {}, cancel: 24, sfx: 'spin' },
    h1: { name: 'Hold-Click', total: 34, poses: [[0, 'hold', -0.04], [12, 'shot', 0]], active: [12, 15], hit: { fx: 210, rx: 215, ry: 42, zr: 95 }, dmg: 30, kb: 200, stun: 36,
      beam: 440, chargeable: true, charge: { from: 6, max: 45, dmg: 70, rx: 290, ry: 50, name: 'Full Click' }, breaksGuard: true, next: { light: 'l1' }, cancel: 22, sfx: 'heavy' },
    air1: { name: 'Sky Pointer', total: 14, air: true, poses: [[0, 'sky', -0.2], [3, 'sky', 0.05]], active: [3, 6], hit: { fx: 90, rx: 120, ry: 58, zr: 120, air: true }, dmg: 12, kb: 40, stun: 30,
      beam: 200, juggle: 360, hover: 240, next: { light: 'air1', heavy: 'dive' }, cancel: 7, maxChain: 6, sfx: 'zap' },
    dive: { name: 'Paw Drop', total: 44, air: true, dive: true, poses: [[0, 'sky', 0.4]], active: [0, 0], hit: { fx: 20, rx: 150, ry: 72, zr: 60 }, dmg: 34, kb: 240, stun: 40,
      knockdown: true, shock: true, breaksGuard: true, next: {}, cancel: 99, sfx: 'heavy' },
    dashL: { name: 'Next Slide', total: 22, poses: [[0, 'dash', 0.05], [6, 'shot', 0]], active: [6, 8], hit: { fx: 50, rx: 60, ry: 34, zr: 90 }, dmg: 18, kb: 160, stun: 22, lunge: -420,
      proj: { speed: 1100, dmg: 18, pierce: 3, life: 36, kb: 160, stun: 22 }, next: { light: 'l2' }, cancel: 12, sfx: 'zap' },
  };
  CO.prepMoves(M, 'kt_', 1.0);

  CO.CHARACTERS = CO.CHARACTERS || {};
  CO.CHARACTERS.keith = {
    id: 'keith', name: 'KEITH', portrait: 'portrait_keith', scale: 1.02, key: 'kt',
    title: 'After-Hours AV Tech', mpName: 'BATTERY', otName: 'ULT', weapon: 'Paw-Click Laser Presenter',
    stats: { hp: 460, mp: 120, mpRegen: 5.0, speed: 300, dash: 760, jump: 660, w: 32 },
    passive: { name: 'Cat Nap', napAfter: 90, napMul: 2, catAtk: 0.05 },
    poses: { idle: 'kt_idle', run: Array.from({ length: 24 }, (_, i) => 'kt_run' + String(i + 1).padStart(2, '0')),
      runStride: 11.0, runOffset: 4, jogUntil: 0,
      hurt: 'kt_hurt', down: 'kt_down', victory: 'kt_victory', rise: 'kt_rise', fall: 'kt_fall', dash: 'kt_dash', joy: 'kt_victory' },
    moves: M, start: { light: 'l1', heavy: 'h1', air: 'air1', airHeavy: 'dive', dashLight: 'dashL' },
    skills: [
      { id: 'lure', name: 'Laser Lure', icon: 'ic_lure', cost: 25, cd: 9, pose: 'kt_lure', total: 26, at: 10, range: 400, r: 250, T: 180, dps: 8, desc: 'Laser dot: zombies chase it 3s, 8 dmg/s' },
      { id: 'callout', name: 'Catgirl Call-Out', icon: 'ic_callout', cost: 35, cd: 12, pose: 'kt_callout', total: 30, at: 14, T: 480, max: 2, desc: 'Holo catgirl ally 8s (ninja / brawler / café maid)' },
      { id: 'ninelives', name: 'Nine Lives', icon: 'ic_nine', cost: 40, cd: 45, pose: 'kt_nine', total: 30, at: 14, revive: 0.4, invuln: 120, shield: 120, shieldT: 240, r: 220, desc: 'Revive a downed ally (40%) or shield the team (120)' },
    ],
    ult: { id: 'showtime', name: 'Nyan Idol Showtime', icon: 'ic_show', pose: 'kt_ult', total: 120, at: 60, dmg: 220, bossDmg: 280, stamp: 'NYAN IDOL SHOWTIME', launch: 520, kb: 300,
      charm: 150, teamAtk: { mul: 1.25, T: 360 } },
    lines: { ult: ['Showtime, kitties!', 'Nya~ go!'], hurt: ['Ow, bro!', 'Not the shades!'], win: 'Relax, bro. My kitties got this. Nya~' },
    color: 0xb48cff, fxCol: 0xc58cff, hitFx: 'paw', botRange: 190, buffMul: { aspd: 1.15, spd: 1.15, dmg: 1.2 },
  };
})(window.CO);
