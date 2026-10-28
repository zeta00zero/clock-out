// Clock Out! v5 — character data: WEI YAO (first form: company emcee, Event-Hall Wireless Mic). Aerial rhythm showman.
// Built from preview_v5/weiyao/weiyao_spec.md. Hits use gold sparkle + music notes (hitFx 'note'); no blood, no red FX.
window.CO = window.CO || {};
(function (CO) {
  const M = {
    l1: { name: 'Mic Swing', total: 15, poses: [[0, 'swing', -0.12], [4, 'swing', 0.05]], active: [4, 7], hit: { fx: 95, rx: 110, ry: 42, zr: 95 }, dmg: 16, kb: 110, stun: 20,
      arc: [-60, 50], next: { light: 'l2', heavy: 'h1' }, cancel: 8, lunge: 90, sfx: 'swing' },
    l2: { name: 'Cable Whip', total: 18, poses: [[0, 'whip', 0.1, true], [5, 'whip', -0.04]], active: [5, 9], hit: { fx: 120, rx: 180, ry: 46, zr: 95 }, dmg: 18, kb: 140, stun: 22, maxTargets: 3,
      arc: [60, -40], next: { light: 'l3', heavy: 'h1' }, cancel: 10, lunge: 70, sfx: 'swing' },
    l3: { name: 'Feedback', total: 24, poses: [[0, 'shout', -0.03], [7, 'shout', 0.03]], active: [7, 11], hit: { fx: 150, rx: 175, ry: 70, zr: 110 }, dmg: 26, kb: 330, stun: 30,
      beam: 0, shock: false, wave: true, next: { light: 'l1', heavy: 'h1' }, cancel: 16, sfx: 'heavy' },
    h1: { name: 'Mic Drop', total: 26, poses: [[0, 'launch', -0.1], [8, 'launch', 0.06]], active: [8, 11], hit: { fx: 90, rx: 120, ry: 50, zr: 100 }, dmg: 30, kb: 60, stun: 40,
      launch: 820, jumpCancel: true, next: { light: 'l1' }, cancel: 12, sfx: 'heavy' },
    air1: { name: 'Mic Juggle', total: 12, air: true, poses: [[0, 'juggle', -0.25], [3, 'swing', 0.1]], active: [3, 6], hit: { fx: 85, rx: 115, ry: 58, zr: 125, air: true }, dmg: 12, kb: 40, stun: 30,
      juggle: 380, hover: 260, next: { light: 'air1', heavy: 'dive' }, cancel: 6, maxChain: 6, sfx: 'swing' },
    dive: { name: 'Stage Dive', total: 40, air: true, dive: true, poses: [[0, 'dive', 0.2]], active: [0, 0], hit: { fx: 20, rx: 160, ry: 74, zr: 60 }, dmg: 38, kb: 260, stun: 40,
      knockdown: true, shock: true, confetti: true, breaksGuard: true, next: {}, cancel: 99, sfx: 'heavy' },
    dashL: { name: 'Spotlight Slide', total: 18, poses: [[0, 'dash', 0.05], [6, 'swing', -0.1]], active: [5, 9], hit: { fx: 70, rx: 110, ry: 40, zr: 95 }, dmg: 20, kb: 160, stun: 22, lunge: 420,
      selfLaunch: 560, next: { light: 'air1' }, cancel: 10, sfx: 'swing' },
  };
  CO.prepMoves(M, 'wy_', 1.0);

  CO.CHARACTERS = CO.CHARACTERS || {};
  CO.CHARACTERS.weiyao = {
    id: 'weiyao', name: 'WEI YAO', portrait: 'portrait_weiyao', scale: 1.02, key: 'wy',
    title: 'Company Emcee', mpName: 'VOICE', otName: 'ULT', weapon: 'Event-Hall Wireless Mic',
    stats: { hp: 400, mp: 100, mpRegen: 4.0, speed: 315, dash: 820, jump: 760, jump2: 640, airJumps: 1, w: 30 },
    passive: { name: 'On Beat', airDash: true, onbeat: { bpm: 120, window: 80, mult: 1.5, refund: true, fever: { hits: 8, mul: 1.10, T: 300 } } },
    poses: { idle: 'wy_idle', run: Array.from({ length: 24 }, (_, i) => 'wy_run' + String(i + 1).padStart(2, '0')),
      runStride: 11.75, runOffset: 0, jogUntil: 0,
      hurt: 'wy_hurt', down: 'wy_down', victory: 'wy_victory', rise: 'wy_rise', fall: 'wy_fall', dash: 'wy_dash', joy: 'wy_victory' },
    moves: M, start: { light: 'l1', heavy: 'h1', air: 'air1', airHeavy: 'dive', dashLight: 'dashL' },
    skills: [
      { id: 'encore', name: 'Encore Stage', icon: 'ic_encore', cost: 30, cd: 14, pose: 'wy_encore', total: 28, at: 12, r: 150, heal: 25, max: 8, atk: { mul: 1.15, T: 360 }, desc: 'Spotlight: +25 HP per zombie in it (8 max), allies +15% ATK 6s' },
      { id: 'centerspin', name: 'Center Spin', icon: 'ic_spin', cost: 26, cd: 7, pose: 'wy_spin', total: 30, at: 6, hits: 4, every: 6, dmg: 12, r: 170, launch: 820, air: true, desc: '4-hit spin: pulls zombies in and pops them up (works in the air)' },
      { id: 'confetti', name: 'Confetti Wall', icon: 'ic_confetti', cost: 24, cd: 10, pose: 'wy_confetti', total: 20, at: 6, T: 180, beats: 2, desc: 'Gold barrier 3s: blocks projectiles + frontal hits, +2 beats' },
    ],
    ult: { id: 'prismlive', name: 'Prism Center Live!', icon: 'ic_live', pose: 'wy_ult', total: 130, at: 70, dmg: 250, bossDmg: 300, stamp: 'PRISM CENTER LIVE!', launch: 760, kb: 260,
      allOnBeat: 480 },
    lines: { ult: ['Lights, music, action!', "It's showtime!"], hurt: ['Not the jacket!', 'Off-beat...'], win: 'Encore! ...Now, happy hour.' },
    color: 0xffd678, fxCol: 0xffd678, hitFx: 'note', botRange: 150, buffMul: { aspd: 1.25, spd: 1.2, dmg: 1.15 },
    tips: ['Hits ON THE BEAT (watch the metronome) do x1.5 and refund your double jump + air dash', 'Mic Drop (heavy) launches - jump to cancel and juggle in the air', '8 on-beat hits in a row = FEVER: team +10% ATK'],
  };
})(window.CO);
