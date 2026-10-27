// Clock Out! v4 — character data: WEISHENG (first form: suit & tie, key fob, fleet lug wrench). Light, fast skirmisher / support.
// Numbers: Lemon x0.70 damage, frame totals /1.3. Hit boxes are authored like Lemon's and scaled by prepMoves.
window.CO = window.CO || {};
(function (CO) {
  const M = {
    l1: { name: 'Jab', total: 15, poses: [[0, 'jab', -0.1], [4, 'jab', 0.05]], active: [4, 7], hit: { fx: 66, rx: 96, ry: 44, zr: 90 }, dmg: 15, kb: 120, stun: 20,
      arc: [-40, 40], next: { light: 'l2', heavy: 'jack' }, cancel: 7, lunge: 150, sfx: 'swing' },
    l2: { name: 'Cross', total: 16, poses: [[0, 'cross', 0.2, true], [4, 'cross', -0.05, true]], active: [4, 8], hit: { fx: 68, rx: 100, ry: 46, zr: 90 }, dmg: 17, kb: 130, stun: 20,
      arc: [50, -60], next: { light: 'l3', heavy: 'flat' }, cancel: 8, lunge: 170, sfx: 'swing' },
    l3: { name: 'Sweep', total: 18, poses: [[0, 'sweep', -0.1], [5, 'sweep', 0.08]], active: [5, 10], hit: { fx: 78, rx: 112, ry: 50, zr: 90 }, dmg: 20, kb: 160, stun: 22,
      arc: [-20, 30], next: { light: 'l4', heavy: 'flat' }, cancel: 10, lunge: 420, sfx: 'swing' },
    l4: { name: 'Spin Out', total: 30, poses: [[0, 'spin', 0], [6, 'spin', 0, true], [12, 'spin', 0], [18, 'spin', 0, true], [24, 'idle', 0]], active: [5, 24], every: 6,
      hit: { fx: 0, rx: 136, ry: 66, zr: 100 }, dmg: 11, kb: 60, finalKb: 320, stun: 24, arc: [-180, 180], spin: true, next: {}, cancel: 24, sfx: 'spin' },
    h1: { name: 'Torque Slam', total: 34, poses: [[0, 'windup', -0.1], [12, 'slam', 0]], active: [12, 15], hit: { fx: 82, rx: 116, ry: 58, zr: 70 }, dmg: 42, kb: 220, stun: 40, knockdown: true,
      shock: true, chargeable: true, charge: { from: 8, max: 45, dmg: 91, rx: 185, ry: 88, name: 'Full Tank' }, breaksGuard: true, next: { light: 'l1' }, cancel: 22, sfx: 'heavy' },
    jack: { name: 'Jack Up', total: 23, poses: [[0, 'windup', 0.2], [5, 'launch', 0]], active: [5, 10], hit: { fx: 56, rx: 96, ry: 54, zr: 50 }, dmg: 24, kb: 40, stun: 40, launch: 900,
      breaksGuard: true, selfLaunch: 860, stampText: 'JACKED UP!', arc: [80, -100], next: {}, cancel: 12, sfx: 'launch' },
    flat: { name: 'Flat Tyre', total: 25, poses: [[0, 'windup', 0], [7, 'slam', 0]], active: [7, 11], hit: { fx: 72, rx: 106, ry: 56, zr: 60 }, dmg: 28, kb: 50, stun: 70, shock: true,
      breaksGuard: true, stampText: 'FLAT TYRE', next: { light: 'l1' }, cancel: 16, sfx: 'heavy' },
    air1: { name: 'Lug Juggle', total: 12, air: true, poses: [[0, 'airslash', -0.6], [3, 'airslash', 0.1]], active: [3, 6], hit: { fx: 52, rx: 96, ry: 58, zr: 110, air: true }, dmg: 13, kb: 30, stun: 30,
      juggle: 380, hover: 260, arc: [-90, 40], next: { light: 'air1', heavy: 'dive' }, cancel: 6, maxChain: 6, sfx: 'swing' },
    dive: { name: 'Pothole', total: 46, air: true, dive: true, poses: [[0, 'airslash', 0.4]], active: [0, 0], hit: { fx: 20, rx: 146, ry: 72, zr: 60 }, dmg: 39, kb: 250, stun: 40,
      knockdown: true, shock: true, breaksGuard: true, next: {}, cancel: 99, sfx: 'heavy' },
    overtake: { name: 'Overtake', total: 18, poses: [[0, 'dash', 0.05]], active: [3, 9], hit: { fx: 60, rx: 108, ry: 48, zr: 80 }, dmg: 21, kb: 200, stun: 24, lunge: 800,
      arc: [-20, 20], next: { light: 'l2' }, cancel: 11, sfx: 'swing' },
  };
  CO.prepMoves(M, 'ws_', 1.26);

  CO.CHARACTERS = CO.CHARACTERS || {};
  CO.CHARACTERS.weisheng = {
    id: 'weisheng', name: 'WEISHENG', portrait: 'portrait_weisheng', scale: 1.0, key: 'ws',
    title: 'Fleet Manager', mpName: 'NITRO', otName: 'ULT', weapon: 'Fleet Lug Wrench',
    stats: { hp: 430, mp: 100, mpRegen: 4.0, speed: 345, dash: 900, jump: 720, w: 30 },
    passive: { name: 'Nitro Boost', dashCd: 0.7, airDash: 1 },
    poses: { idle: 'ws_idle', run: Array.from({ length: 24 }, (_, i) => 'ws_run' + String(i + 1).padStart(2, '0')),
      runStride: 10.35, runOffset: 4, jogUntil: 0,
      hurt: 'ws_hurt', down: 'ws_down', victory: 'ws_victory', rise: 'ws_launch', fall: 'ws_airslash', dash: 'ws_dash', joy: 'ws_victory' },
    moves: M, start: { light: 'l1', heavy: 'h1', air: 'air1', airHeavy: 'dive', dashLight: 'overtake' },
    skills: [
      { id: 'tuneup', name: 'Garage Tune-Up', icon: 'ic_wrench', cost: 28, cd: 12, pose: 'ws_fix', total: 36, heal: 90, buff: 8, allyHeal: 0.5, r: 220, desc: 'Heal + ATK/speed buff, heals nearby allies' },
      { id: 'ebrake', name: 'Emergency Brake', icon: 'ic_brake', cost: 24, cd: 8, pose: 'ws_fob', total: 30, at: 10, cone: { r: 320, ry: 120 }, stun: 90, bossStun: 30, dmg: 10, desc: 'Fob pulse: cone stun' },
      { id: 'hairpin', name: 'Hairpin Drift', icon: 'ic_tyre', cost: 30, cd: 6, pose: 'ws_slide', total: 34, slide: { from: 4, dist: 520, hits: 5, every: 5, dmg: 14, rx: 110, ry: 62 }, desc: 'Slide-dash, 5 hits, leaves a skid trail' },
    ],
    ult: { id: 'hyperion', name: 'Hyperion Zero', icon: 'ic_fob', pose: 'ws_ult', total: 110, at: 72, dmg: 240, bossDmg: 300, stamp: 'HYPERION ZERO', launch: 650, kb: 360 },
    lines: { ult: ["Hyperion, go.", "Traffic's clear.", 'Green light.'], hurt: ['Tch.', 'Not the suit!', 'Watch the tie.'], win: "Told you I'd get you there." },
    color: 0xff8a3c, buffMul: { aspd: 1.12, spd: 1.15, dmg: 1.2 },
  };
})(window.CO);
