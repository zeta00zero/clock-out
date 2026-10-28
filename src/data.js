// Clock Out! — game data. Characters, enemies, bosses and stages are pure data,
// so new Arcane Duel characters / floors plug in without touching the engine.
window.CO = window.CO || {};
(function (CO) {
  CO.MAX_PLAYERS = 4;   // v5.1: max 4 players everywhere (local + online)
  CO.PLAYER_COLORS = [0xffd23f, 0x6fd3ff, 0xff8fc8, 0x8ee35a, 0xb98cff];   // P1..P4 (5th colour unused) indicator colours


  // v4: poses are namespaced per character (lem_*, ws_*); hit boxes authored for ~190 px Lemon are scaled up for the 240 px redraw.
  CO.prepMoves = (moves, prefix, k, ky) => {
    for (const id in moves) {
      const m = moves[id]; m.poses = m.poses.map(p => [p[0], prefix + p[1]].concat(p.slice(2)));
      if (k && k !== 1) {
        const h = m.hit; h.fx = Math.round((h.fx || 0) * k); h.rx = Math.round(h.rx * k); h.ry = Math.round(h.ry * (ky || 1.1)); if (h.zr) h.zr = Math.round(h.zr * k);
        if (m.charge) { m.charge.rx = Math.round(m.charge.rx * k); m.charge.ry = Math.round(m.charge.ry * (ky || 1.1)); }
      }
    }
    return moves;
  };

  // ---- Enemies -------------------------------------------------------------
  // frames.cycle = walk-cycle frames (advanced by distance walked); ai: 'melee' (default) | 'ranged'
  // attack.kind: 'melee' | 'shout' (wide cone, may CC reinforcements) | 'whip' (long reach, pulls) | 'throw' (lobbed projectile)
  const Z = (id, stride) => ({ walk: id + '_walk', cycle: [id + '_walk', id + '_w2'], stride, atk: id + '_atk', hurt: id + '_hurt' });
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

    // ---- v4: 21 new variants (+ Motivational Speaker). frames.cycle = [walk, w2]. Behaviour kinds live in sim.js (enemyAttack*)
    sniper: { name: 'Stapler Sniper', hp: 72, speed: 62, w: 28, mass: 0.8, ai: 'ranged', keep: 420, frames: Z('sniper', 26),
      attack: { kind: 'bolt', range: 600, windup: 48, active: 2, recover: 60, dmg: 14, cd: 130, proj: 'bolt' }, score: 130,
      barks: ['Stapling from afar.', 'Hold still, please.', 'Line of sight acquired.'] },
    spiller: { name: 'Latte Spiller', hp: 110, speed: 70, w: 34, mass: 1.1, frames: Z('spiller', 28), death: 'puddle',
      attack: { kind: 'melee', range: 90, rx: 100, ry: 42, windup: 30, active: 8, recover: 44, dmg: 10, kb: 160, cd: 90, puddle: true }, score: 120,
      barks: ['Oops, it was HOT!', 'Extra foam!', 'Mind the floor...'] },
    roller: { name: 'Chair Roller', hp: 85, speed: 80, w: 32, mass: 1, stand: 300, frames: Z('roller', 26),
      attack: { kind: 'charge', range: 400, rx: 62, ry: 36, windup: 42, active: 56, recover: 50, dmg: 12, kb: 300, cd: 140, speed: 260, wallStun: 72 }, score: 120,
      barks: ['Wheeeee!', 'Ergonomic!', 'Lumbar support!'] },
    kbwar: { name: 'Keyboard Warrior', hp: 80, speed: 92, w: 28, mass: 0.9, ai: 'ranged', keep: 330, frames: Z('kbwar', 26),
      attack: { kind: 'throw', range: 440, windup: 34, active: 2, recover: 60, dmg: 12, cd: 132, proj: 'keyboard' }, score: 120,
      barks: ['L + ratio!', 'Typing... Typing...', 'Mechanical, baby!'] },
    presenter: { name: 'Projector Presenter', hp: 100, speed: 70, w: 30, mass: 1, frames: Z('presenter', 28),
      attack: { kind: 'cone', range: 250, rx: 210, ry: 70, windup: 60, active: 8, recover: 50, dmg: 8, kb: 80, cd: 150, fx: { blind: 90 }, text: 'NEXT SLIDE!' }, score: 140,
      barks: ['Next slide!', 'Can everyone see this?', 'Slide 94 of 130.'] },
    bluescr: { name: 'Blue-Screen Tech', hp: 125, speed: 75, w: 32, mass: 1.2, frames: Z('bluescr', 28),
      attack: { kind: 'ring', range: 150, rx: 140, ry: 140, windup: 36, active: 6, recover: 44, dmg: 10, kb: 220, cd: 180, r: 140, text: 'FATAL ERROR!' }, score: 150,
      barks: ['Have you tried...', 'Fatal exception 0E.', 'Rebooting you.'] },
    guard: { name: 'Security Guard', hp: 140, speed: 70, w: 34, mass: 2, kbResist: 0.7, frames: Z('guard', 28),
      attack: { kind: 'cone', range: 120, rx: 140, ry: 52, windup: 40, active: 8, recover: 50, dmg: 10, kb: 60, cd: 90, fx: { stun: 48 }, text: 'HALT!' }, score: 170,
      barks: ['Badge, please.', 'Sir, this is a Wendy\'s.', 'No running in the lobby.'] },
    recept: { name: 'Bell Receptionist', hp: 60, speed: 55, w: 26, mass: 0.7, ai: 'ranged', keep: 380, frames: Z('recept', 24),
      attack: { kind: 'summon', range: 900, windup: 34, active: 2, recover: 60, dmg: 0, cd: 360, spawn: 'intern', n: 2, max: 4 }, score: 150,
      barks: ['*DING DING*', 'Reception to the lobby!', 'Please hold.'] },
    valet: { name: 'Luggage Valet', hp: 130, speed: 70, w: 34, mass: 1.5, stand: 280, frames: Z('valet', 28), death: 'cart',
      attack: { kind: 'charge', range: 380, rx: 70, ry: 40, windup: 36, active: 50, recover: 56, dmg: 18, kb: 340, cd: 150, speed: 240, wallStun: 50 }, score: 170,
      barks: ['Your bags, sir!', 'Mind the cart!', 'Checking you out!'] },
    commuter: { name: 'Rush-Hour Commuter', hp: 70, speed: 140, w: 26, mass: 0.9, frames: Z('commuter', 24),
      attack: { kind: 'melee', range: 80, rx: 80, ry: 38, windup: 16, active: 8, recover: 30, dmg: 8, kb: 200, cd: 40, wallBonus: 6 }, score: 80,
      barks: ['Doors closing!', 'Move down the car!', 'Excuse me. EXCUSE me.'] },
    salesman: { name: 'Elevator Pitch Salesman', hp: 90, speed: 78, w: 30, mass: 1, frames: Z('salesman', 26),
      attack: { kind: 'cone', range: 210, rx: 180, ry: 62, windup: 36, active: 8, recover: 50, dmg: 6, kb: 300, cd: 110, fx: { slow: 60 }, text: 'SYNERGY!' }, score: 130,
      barks: ['Got 30 seconds?', 'Let me pitch you!', 'Disrupting the elevator!'] },
    penner: { name: 'Pen Thrower', hp: 60, speed: 70, w: 26, mass: 0.7, ai: 'ranged', keep: 380, frames: Z('penner', 24),
      attack: { kind: 'volley', range: 520, windup: 30, active: 2, recover: 50, dmg: 7, cd: 150, proj: 'pen', n: 3 }, score: 110,
      barks: ['Click click click!', 'Borrowing your pen!', 'Ink-redible!'] },
    smoker: { name: 'Smoke-Break Zombie', hp: 100, speed: 40, w: 32, mass: 1.2, frames: Z('smoker', 30),
      attack: { kind: 'cloud', range: 260, rx: 150, ry: 150, windup: 30, active: 2, recover: 80, dmg: 3, cd: 220, r: 150, T: 360 }, score: 130,
      barks: ['Just five more minutes.', '*cough*', 'Got a light?'] },
    washer: { name: 'Window Washer', hp: 120, speed: 60, w: 32, mass: 1.2, frames: Z('washer', 28),
      attack: { kind: 'melee', range: 140, rx: 140, ry: 52, windup: 36, active: 10, recover: 56, dmg: 14, kb: 280, cd: 100, lunge: 380 }, score: 150,
      barks: ['Streak-free!', 'Swinging in!', 'Squeegee time.'] },
    wfh: { name: 'WFH Zombie', hp: 90, speed: 85, w: 30, mass: 1, block: 0.5, frames: Z('wfh', 28),
      attack: { kind: 'melee', range: 85, rx: 92, ry: 40, windup: 30, active: 8, recover: 40, dmg: 11, kb: 200, cd: 70 }, score: 120,
      barks: ['You\'re on mute!', 'Camera off.', 'Can you hear me?'] },
    delivery: { name: 'Delivery Guy', hp: 75, speed: 150, w: 26, mass: 0.8, ai: 'ranged', keep: 300, frames: Z('delivery', 24),
      attack: { kind: 'boomerang', range: 440, windup: 24, active: 2, recover: 50, dmg: 8, cd: 140, proj: 'box', n: 3 }, score: 120,
      barks: ['Your order has ARRIVED!', 'Sign here!', 'Five stars?'] },
    laundry: { name: 'Laundry Lady', hp: 105, speed: 72, w: 32, mass: 1.1, frames: Z('laundry', 28),
      attack: { kind: 'cone', range: 210, rx: 230, ry: 60, windup: 36, active: 10, recover: 56, dmg: 12, kb: 220, cd: 100, fx: { slick: true }, text: 'SOAP!' }, score: 140,
      barks: ['Fluff and fold!', 'Mind the suds.', 'Delicates only!'] },
    courier: { name: 'Scooter Courier', hp: 80, speed: 220, w: 28, mass: 1, stand: 380, frames: Z('courier', 24),
      attack: { kind: 'charge', range: 560, rx: 60, ry: 36, windup: 30, active: 40, recover: 40, dmg: 12, kb: 360, cd: 120, speed: 520, wallStun: 90, selfStun: 90 }, score: 140,
      barks: ['Beep beep!', 'Rush delivery!', 'Out of my lane!'] },
    umbrella: { name: 'Umbrella Blocker', hp: 130, speed: 66, w: 34, mass: 1.4, block: 0.7, frames: Z('umbrella', 28),
      attack: { kind: 'melee', range: 95, rx: 105, ry: 42, windup: 34, active: 8, recover: 46, dmg: 10, kb: 220, cd: 80 }, score: 160,
      barks: ['Rain check!', 'Mind the spokes.', 'Under my umbrella.'] },
    salaryman: { name: 'Briefcase Salaryman', hp: 95, speed: 92, w: 28, mass: 1, ai: 'ranged', keep: 300, frames: Z('salaryman', 26),
      attack: { kind: 'boomerang', range: 460, windup: 28, active: 2, recover: 50, dmg: 15, cd: 120, proj: 'case2', n: 1, fx: { blind: 60 } }, score: 150,
      barks: ['Overtime again...', 'My train!', 'Business card?'] },
    speaker: { name: 'Motivational Speaker', hp: 150, speed: 60, w: 34, mass: 1.3, aura: 260, frames: Z('speaker', 28),
      attack: { kind: 'melee', range: 90, rx: 100, ry: 42, windup: 34, active: 8, recover: 50, dmg: 8, kb: 160, cd: 100 }, score: 220,
      barks: ['YOU CAN DO IT!', 'Synergize your WHY!', 'Be the change!'] },
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
    hrdirector: { name: 'THE HR DIRECTOR', hp: 1700, speed: 80, w: 50, poise: 240, scale: 1.45, tint: 0xffe0a8,
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
    // v4: The Lift mini-boss and the Apartment boss. kit = custom attack set (sim.js bossKit*)
    muzak: { name: 'MR. MUZAK', hp: 1400, speed: 70, w: 50, poise: 220, scale: 1, kit: 'muzak', tint: 0xfff6dc,
      frames: { idle: 'muz_idle', atk: 'muz_atk', summon: 'muz_summon', hurt: 'muz_hurt' },
      summon: ['commuter'], proj: 'sax', hazard: 'BEAT', hazardName: 'BASS DROP',
      intro: ['Welcome to the Lift Experience.', 'Please enjoy this smooth jazz. Forever.'],
      phase2: 'SAX SOLO!', phase3: 'GOING DOWN!',
      barks: ['Doo-be-doo-bee...', 'Hold music, anyone?', 'Please remain on the line.', 'Smooth. So smooth.'],
      defeat: ['The music... stops...', 'Roof access... granted.'] },
    landlord: { name: 'THE LANDLORD', hp: 2600, speed: 60, w: 62, poise: 360, scale: 1, kit: 'landlord', tint: 0xfff2dc,
      frames: { idle: 'll_idle', atk: 'll_atk', summon: 'll_summon', hurt: 'll_hurt' },
      summon: ['wfh'], proj: 'eviction', hazard: 'RENT', hazardName: 'RENT DUE',
      intro: ['You are four months behind, Lemon.', 'RENT. IS. DUE.'],
      phase2: 'THIS BUILDING IS CONDEMNED!',
      barks: ['No pets. No parties.', 'First of the month!', 'Your deposit is gone.', 'Per the lease...'],
      defeat: ['Fine... rent... waived...', '...just stop... breaking... the walls.'] },
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
      intro: ['You survived a HELICOPTER?! Unapproved route!', 'Every road leads back to MONDAY, Lemon.'],
      phase2: 'MANDATORY FUN! ALL-HANDS!',
      barks: ['Synergy!', 'Circle back!', 'Weekends are a myth.', 'You\'re on mute!', 'Let\'s make it a Monday!'],
      defeat: ['Fine... take... Friday...', '...have a good weekend.'] },
  };

  CO.BOSS_RUSH = ['micromanager', 'hrdirector', 'printerboss', 'muzak', 'landlord', 'ceo'];   // v5 level 100: every boss, one at a time
  CO.GRADES = [
    { g: 'S', min: 9000, c: 'Exceeds Expectations. Promoted to Front Row.' },
    { g: 'A', min: 7000, c: 'Strong performer. Leaves on time. Suspicious.' },
    { g: 'B', min: 5000, c: 'Meets expectations. Stapled things well.' },
    { g: 'C', min: 3000, c: 'Needs improvement. Was seen enjoying herself.' },
    { g: 'D', min: 0, c: 'See me in my office. (Lemon did not see him.)' },
  ];
})(window.CO);
