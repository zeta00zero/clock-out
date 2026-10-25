// Clock Out! — game data. Characters, enemies, bosses and stages are pure data,
// so new Arcane Duel characters / floors plug in without touching the engine.
window.CO = window.CO || {};
(function (CO) {
  CO.MAX_PLAYERS = 5;
  CO.PLAYER_COLORS = [0xffd23f, 0x6fd3ff, 0xff8fc8, 0x8ee35a, 0xb98cff];   // P1..P5 indicator colours

  // ---- Enemies -------------------------------------------------------------
  // frames.cycle = walk-cycle frames (advanced by distance walked); ai: 'melee' (default) | 'ranged'
  // attack.kind: 'melee' | 'shout' (wide cone, may CC reinforcements) | 'whip' (long reach, pulls) | 'throw' (lobbed projectile)
  CO.ENEMIES = {
    shambler: { name: 'Cubicle Shambler', hp: 95, speed: 82, w: 30, mass: 1,
      frames: { walk: 'shambler_walk', cycle: ['shambler_w1', 'shambler_w2', 'shambler_w3', 'shambler_w4'], stride: 30, atk: 'shambler_atk', hurt: 'shambler_hurt' },
      attack: { range: 72, rx: 85, ry: 40, windup: 32, active: 8, recover: 40, dmg: 20, kb: 220, cd: 62 }, score: 100,
      barks: ['Got a sec?', 'Quick question...', 'Brains... storming...', 'Per my last email'] },
    intern: { name: 'The Intern', hp: 45, speed: 165, w: 26, mass: 0.7,
      frames: { walk: 'intern_walk', cycle: ['intern_w1', 'intern_w2', 'intern_w3', 'intern_w4'], stride: 26, atk: 'intern_atk', hurt: 'intern_hurt' },
      attack: { range: 150, rx: 70, ry: 38, windup: 22, active: 14, recover: 46, dmg: 14, kb: 160, cd: 55, lunge: 520 }, score: 60,
      barks: ['Coffee? It\'s decaf!', 'Is this unpaid?', 'I made a spreadsheet!'] },
    hr: { name: 'HR Shield', hp: 160, speed: 64, w: 34, mass: 1.6, guard: 6,
      frames: { walk: 'hr_walk', cycle: ['hr_w1', 'hr_w2', 'hr_w3', 'hr_w4'], stride: 30, atk: 'hr_atk', hurt: 'hr_hurt' },
      attack: { range: 85, rx: 95, ry: 45, windup: 36, active: 8, recover: 46, dmg: 24, kb: 300, cd: 75 }, score: 180,
      barks: ['Please fill out Form 27B.', 'Let\'s keep it professional.', 'DENIED.'] },
    replyall: { name: 'Reply-All', hp: 85, speed: 105, w: 28, mass: 0.9,
      frames: { walk: 'replyall_walk', atk: 'replyall_atk', hurt: 'replyall_hurt' },
      attack: { kind: 'shout', range: 175, rx: 150, ry: 55, windup: 30, active: 10, recover: 52, dmg: 15, kb: 280, cd: 95, cc: 0.25 }, score: 140,
      barks: ['REPLY ALL!', 'Adding 400 people!', 'Can everyone see my screen?', '+1', 'Sorry, wrong thread!'] },
    printer: { name: 'Printer Jammer', hp: 105, speed: 72, w: 32, mass: 1.3, ai: 'ranged', keep: 330,
      frames: { walk: 'printer_walk', atk: 'printer_atk', hurt: 'printer_hurt' },
      attack: { kind: 'throw', range: 460, windup: 34, active: 2, recover: 60, dmg: 16, cd: 115, proj: 'paperball' }, score: 150,
      barks: ['PC LOAD LETTER?!', 'Paper jam in tray 2!', 'Out of toner. Out of patience.', 'Printing 400 copies...'] },
    itguy: { name: 'IT Guy', hp: 120, speed: 96, w: 30, mass: 1.1,
      frames: { walk: 'itguy_walk', atk: 'itguy_atk', hurt: 'itguy_hurt' },
      attack: { kind: 'whip', range: 195, rx: 150, ry: 42, windup: 30, active: 8, recover: 50, dmg: 17, kb: -320, cd: 85 }, score: 160,
      barks: ['Turn it off and on again?', 'Ticket closed. Won\'t fix.', 'Works on MY machine.', 'Is it plugged in?'] },
  };

  // ---- Bosses ----------------------------------------------------------------
  // Generic boss brain (sweep / hazards / projectiles / summon / dizzy / phase 2), flavoured per boss.
  CO.BOSSES = {
    micromanager: { name: 'THE MICROMANAGER', hp: 3200, speed: 95, w: 60, poise: 320, scale: 1,
      frames: { idle: 'mm_idle', atk: 'mm_atk', summon: 'mm_summon', hurt: 'mm_hurt' },
      summon: ['intern'], proj: 'note', hazard: 'DUE', hazardName: 'DEADLINE',
      intro: ['Leaving already, Lemon?', 'Before you go... quick sync?'],
      phase2: 'This is now TOP PRIORITY!',
      barks: ["Let's circle back!", 'Per my last email...', 'Can you stay late?', 'Who approved this?', 'Did you CC me?', "It'll only take five minutes!"],
      defeat: ['Fine... take... the afternoon...', '...off.'] },
    hrdirector: { name: 'THE HR DIRECTOR', hp: 1700, speed: 80, w: 50, poise: 240, scale: 1.45, tint: 0xffb0b0,
      frames: { idle: 'hr_walk', atk: 'hr_atk', summon: 'hr_w2', hurt: 'hr_hurt' },
      summon: ['shambler', 'intern'], proj: 'form', hazard: 'REVIEW', hazardName: 'PERFORMANCE REVIEW',
      intro: ['Lemon. A word. In my office.', 'This is a formal written warning.'],
      phase2: 'Escalating to... HR of HR!',
      barks: ['Fill out Form 27B!', 'This is going in your file.', 'Let\'s take this offline.', 'Mandatory training!'],
      defeat: ['I\'ll... put this... in your file...', '...it\'s a very nice file.'] },
    printerboss: { name: 'THE PRINTER FROM HELL', hp: 2100, speed: 70, w: 54, poise: 280, scale: 1.5, tint: 0xd0ffd0,
      frames: { idle: 'printer_walk', atk: 'printer_atk', summon: 'printer_walk', hurt: 'printer_hurt' },
      summon: ['itguy', 'intern'], proj: 'paperball', hazard: 'JAM', hazardName: 'PAPER JAM',
      intro: ['PC LOAD LETTER.', 'You are out of... TIME.'],
      phase2: 'DUPLEX MODE: ENGAGED!',
      barks: ['Printing... printing...', 'Error 49.4C!', 'Low toner, high rage!', 'Collating YOU!'],
      defeat: ['Toner... low...', '*sad fax noises*'] },
    ceo_lobby: { name: 'THE CEO OF MONDAYS', hp: 4200, speed: 85, w: 64, poise: 9999, scale: 1, scripted: 0.72,
      frames: { idle: 'ceo_idle', atk: 'ceo_atk', summon: 'ceo_summon', hurt: 'ceo_hurt' },
      summon: ['replyall', 'shambler'], proj: 'note', hazard: 'MON', hazardName: 'MONDAY',
      intro: ['Going somewhere, Lemon?', 'The exit is... CLOSED. Forever.'],
      phase2: 'MONDAY AURA!',
      barks: ['It\'s ALWAYS Monday somewhere.', 'Synergy!', 'Let\'s take this offline.', 'Weekends are a myth.'],
      defeat: ['Hah! My MONDAY AURA can\'t be stapled!', 'The doors stay sealed. FOREVER!'] },
    ceo: { name: 'THE CEO OF MONDAYS', hp: 4400, speed: 100, w: 64, poise: 380, scale: 1,
      frames: { idle: 'ceo_idle', atk: 'ceo_atk', summon: 'ceo_summon', hurt: 'ceo_hurt' },
      summon: ['replyall', 'itguy', 'printer'], proj: 'note', hazard: 'MON', hazardName: 'MONDAY',
      intro: ['You took the GONDOLA?! Unapproved route!', 'Every road leads back to MONDAY, Lemon.'],
      phase2: 'MANDATORY FUN! ALL-HANDS!',
      barks: ['Synergy!', 'Circle back!', 'Weekends are a myth.', 'You\'re on mute!', 'Let\'s make it a Monday!'],
      defeat: ['Fine... take... Friday...', '...have a good weekend.'] },
  };

  CO.GRADES = [
    { g: 'S', min: 9000, c: 'Exceeds Expectations. Promoted to Front Row.' },
    { g: 'A', min: 7000, c: 'Strong performer. Leaves on time. Suspicious.' },
    { g: 'B', min: 5000, c: 'Meets expectations. Stapled things well.' },
    { g: 'C', min: 3000, c: 'Needs improvement. Was seen enjoying herself.' },
    { g: 'D', min: 0, c: 'See me in my office. (Lemon did not see him.)' },
  ];
})(window.CO);
