// Clock Out! — character data: LEMON (Player 1 default).
// Each playable character lives in its own file under src/chars/ and registers itself in
// CO.CHARACTERS. Co-op (up to 5 players) just adds more files like this one — the engine reads
// stats, poses, moves, skills and ult from here; nothing in sim.js is Lemon-specific.
window.CO = window.CO || {};
(function (CO) {
  // ---- Moves -------------------------------------------------------------
  // poses: [[startFrame, frameKey, rotation(rad), flip(bool)]]  (60 fps frames)
  // hit: forward offset fx, ellipse rx/ry (3/4 floor plane), zr = height tolerance
  // active: [start,end] frames, every: multi-hit interval
  const LEMON_MOVES = {
    l1: { name: 'Memo', total: 19, poses: [[0, 'swing', -0.35], [5, 'swing', 0.05], [11, 'swing', 0.18]],
      active: [5, 9], hit: { fx: 70, rx: 100, ry: 48, zr: 90 }, dmg: 22, kb: 140, stun: 22,
      arc: [-70, 60], next: { light: 'l2', heavy: 'stamp' }, cancel: 9, lunge: 140, sfx: 'swing' },
    l2: { name: 'Cc: Everyone', total: 21, poses: [[0, 'swing', 0.3, true], [5, 'swing', -0.1, true], [12, 'swing', -0.25, true]],
      active: [5, 10], hit: { fx: 70, rx: 105, ry: 50, zr: 90 }, dmg: 24, kb: 150, stun: 22,
      arc: [60, -70], next: { light: 'l3', heavy: 'promo' }, cancel: 10, lunge: 160, sfx: 'swing' },
    l3: { name: 'Bcc:', total: 24, poses: [[0, 'dash', -0.15], [7, 'dash', 0.1]],
      active: [6, 12], hit: { fx: 80, rx: 115, ry: 52, zr: 90 }, dmg: 28, kb: 170, stun: 24,
      arc: [-30, 30], next: { light: 'l4', heavy: 'promo' }, cancel: 12, lunge: 380, sfx: 'swing' },
    l4: { name: 'Spin Cycle', total: 38, poses: [[0, 'swing', 0], [5, 'swing', 0, true], [10, 'swing', 0], [15, 'swing', 0, true], [20, 'swing', 0], [25, 'swing', 0, true], [30, 'idle', 0]],
      active: [6, 27], every: 7, hit: { fx: 0, rx: 140, ry: 68, zr: 100 }, dmg: 16, kb: 60, finalKb: 330, stun: 26,
      arc: [-180, 180], spin: true, next: {}, cancel: 30, sfx: 'spin' },
    h1: { name: 'Hard Copy', total: 42, poses: [[0, 'windup', -0.1], [15, 'smash', 0]],
      active: [15, 19], hit: { fx: 85, rx: 120, ry: 60, zr: 70 }, dmg: 60, kb: 240, stun: 40, knockdown: true,
      shock: true, chargeable: true, charge: { from: 8, max: 45, dmg: 130, rx: 190, ry: 90, name: 'Final Draft' },
      breaksGuard: true, next: { light: 'l1' }, cancel: 26, sfx: 'heavy' },
    stamp: { name: 'Rubber Stamp', total: 32, poses: [[0, 'windup', 0], [9, 'smash', 0]],
      active: [9, 13], hit: { fx: 75, rx: 110, ry: 58, zr: 60 }, dmg: 40, kb: 60, stun: 70, shock: true,
      breaksGuard: true, stampText: 'APPROVED', next: { light: 'l1' }, cancel: 20, sfx: 'heavy' },
    promo: { name: 'Promotion', total: 30, poses: [[0, 'windup', 0.2], [6, 'uppercut', 0]],
      active: [6, 12], hit: { fx: 60, rx: 100, ry: 55, zr: 50 }, dmg: 34, kb: 40, stun: 40, launch: 900,
      breaksGuard: true, selfLaunch: 860, stampText: 'PROMOTED!', arc: [80, -100], next: {}, cancel: 14, sfx: 'launch' },
    air1: { name: 'Memo Juggle', total: 16, air: true, poses: [[0, 'airslam', -0.6], [4, 'airslam', 0.1]],
      active: [4, 8], hit: { fx: 55, rx: 100, ry: 60, zr: 110, air: true }, dmg: 18, kb: 30, stun: 30, juggle: 380, hover: 260,
      arc: [-90, 40], next: { light: 'air1', heavy: 'dive' }, cancel: 8, maxChain: 5, sfx: 'swing' },
    dive: { name: 'Hole Punch', total: 60, air: true, dive: true, poses: [[0, 'airslam', 0.4]],
      active: [0, 0], hit: { fx: 20, rx: 150, ry: 75, zr: 60 }, dmg: 55, kb: 260, stun: 40, knockdown: true, shock: true,
      breaksGuard: true, next: {}, cancel: 99, sfx: 'heavy' },
    commute: { name: 'Commute', total: 24, poses: [[0, 'dash', 0.05]],
      active: [3, 11], hit: { fx: 60, rx: 110, ry: 50, zr: 80 }, dmg: 30, kb: 220, stun: 26, lunge: 620,
      arc: [-20, 20], next: { light: 'l2' }, cancel: 14, sfx: 'swing' },
  };

  const LEMON_SKILLS = [
    { id: 'coffee', name: 'Coffee Rush', icon: 'ic_coffee', cost: 30, cd: 9, pose: 'drink', total: 38,
      heal: 70, buff: 8, desc: 'Speed + attack speed, small heal' },
    { id: 'staples', name: 'Staple Barrage', icon: 'ic_stapler', cost: 22, cd: 3.5, pose: 'cannon', total: 40,
      fire: { from: 8, count: 9, every: 2, spread: 0.55, speed: 1150, life: 32, dmg: 15, stun: 50 }, desc: 'Fan of staples that pin enemies' },
    { id: 'briefcase', name: 'Briefcase Spin', icon: 'ic_briefcase', cost: 32, cd: 6, pose: 'throw', total: 30,
      case: { at: 10, out: 26, back: 26, speed: 640, every: 8, dmg: 12, pull: 260, r: 85 }, desc: 'Boomerang briefcase that drags enemies in' },
  ];

  CO.CHARACTERS = CO.CHARACTERS || {};
  CO.CHARACTERS.lemon = {
      id: 'lemon', name: 'LEMON', portrait: 'portrait_lemon', scale: 1.0,
      title: 'Hate My Job', weapon: 'Heavy-Duty Stapler 9000',
      stats: { hp: 520, mp: 100, mpRegen: 3.5, speed: 285, dash: 760, jump: 680, w: 34 },
      poses: { idle: 'idle', run: ['run01', 'run02', 'run03', 'run04', 'run05', 'run06', 'run07', 'run08', 'run09', 'run10', 'run11', 'run12'],
        runStride: 13, runStart: 'run03', skid: 'run06', hurt: 'hurt', down: 'down', victory: 'victory',
        rise: 'uppercut', fall: 'airslam', dash: 'dash', joy: 'runjoy' },
      moves: LEMON_MOVES, start: { light: 'l1', heavy: 'h1', air: 'air1', airHeavy: 'dive', dashLight: 'commute' },
      skills: LEMON_SKILLS,
      ult: { id: 'clockout', name: 'Clock Out', icon: 'ic_clock', pose: 'victory', total: 100, at: 70, dmg: 260, bossDmg: 320 },
      lines: { ult: ["I'm clocking out.", 'Not my job.', 'Shift: ENDED.'], hurt: ['Ugh.', 'Seriously?'], win: 'Bye.' },
      color: 0xffd23f,
  };

})(window.CO);
