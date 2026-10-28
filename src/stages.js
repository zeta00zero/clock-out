// Clock Out! — stage data. Story = 5 scrolling point-A-to-point-B stages; Survival = endless arena.
// Stage fields: bg (preview image only; the in-game map is the unique WebP chunks in maps/maps_<id>.js), len (world width), band (walkable y range),
// encounters [{x, waves:[{text, spawns:[[type,count]], max}], boss?, bossFrom?}], exit (goal x).
window.CO = window.CO || {};
(function (CO) {
  const W = (text, spawns, max) => ({ text, spawns, max });
  CO.STORY_ORDER = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
  // v4 clock: 7 stages from 5:59 PM; every stage starts 15 min later and the story clock ticks at 3 game-sec per second, so a normal run
  // reaches the Streets finish at ~7:50 PM (always before STARSHIFT at 8 PM). If the player is slow the clock runs on (late result), it never says 11 PM.
  const T = (h, m) => h * 3600 + m * 60;
  // lighting preset keys are defined in fx.js (CO.LIGHT)
  CO.STAGES = {
    s1: { id: 's1', num: 1, name: '3RD FLOOR', sub: 'OPEN-PLAN PURGATORY', bg: 'bg_s1', music: 'st3f', boss_music: 'boss', light: 'f3',
      len: 6400, h: 720, band: [345, 690], wallBase: 290, exit: 6250, exitLabel: 'STAIRWELL', clock: T(17, 59), par: 200,
      caption: ['5:59 PM. Lemon\'s desk, 3rd floor.', 'Goal: the stairwell. Obstacles: everyone.'],
      encounters: [
        { x: 1300, waves: [W('Cubicle Shamblers! And a Stapler Sniper on the far desks.', [['shambler', 3], ['sniper', 2]], 5)] },
        { x: 2700, waves: [W('Interns! Someone spilled a latte. Mind the puddles.', [['intern', 3], ['spiller', 2], ['roller', 2]], 7)] },
        { x: 4000, waves: [W('HR has entered the chat. Chair Rollers are charging!', [['hr', 2], ['sniper', 2], ['roller', 2], ['shambler', 3]], 8)] },
        { x: 5350, waves: [W('Someone booked a "quick chat"...', [['shambler', 2], ['spiller', 1], ['sniper', 1]], 5)], boss: 'hrdirector', bossText: 'THE HR DIRECTOR guards the stairwell!' },
      ],
      clear: 'Stairwell reached. One floor down.' },
    s2: { id: 's2', num: 2, name: '2ND FLOOR', sub: 'MEETING ROOMS & SERVER FARM', bg: 'bg_s2', music: 'st2f', boss_music: 'boss', light: 'f2',
      len: 6400, h: 720, band: [445, 690], wallBase: 400, exit: 6250, exitLabel: 'STAIRS DOWN', clock: T(18, 14), par: 220,
      caption: ['6:14 PM. 2nd floor.', 'Every meeting room is booked. By zombies. For "syncs".'],
      encounters: [
        { x: 1300, waves: [W('Keyboard Warriors throw their gear. IT Guys have cables.', [['kbwar', 2], ['itguy', 1], ['shambler', 3]], 6)] },
        { x: 2700, waves: [W('Projector Presenters. Do NOT look at the slide.', [['presenter', 2], ['intern', 3], ['kbwar', 1]], 6),
          // v4.2: Keith's join moment at the projector
          W('KEITH, the after-hours AV tech, pops out from behind the projector: "Bro... they ate my slides."', [['intern', 2]], 2),
          W('LEMON: "Help us clock out and my spare STARSHIFT ticket is yours." KEITH: "Deal. Kitties, assemble."', [['shambler', 2]], 2)] },
        { x: 4000, waves: [W('The server room is overheating. Blue screens everywhere.', [['bluescr', 2], ['itguy', 2], ['presenter', 1], ['printer', 1]], 8)] },
        { x: 5350, waves: [W('Something in the copy room is... warming up.', [['intern', 3], ['bluescr', 1]], 4)], boss: 'printerboss', bossText: 'THE PRINTER FROM HELL is out of paper. And mercy.' },
      ],
      clear: 'Down to the lobby. Freedom is RIGHT there.' },
    s3: { id: 's3', num: 3, name: '1ST FLOOR', sub: 'THE LOBBY', bg: 'bg_s3', music: 'stlobby', boss_music: 'ceo', light: 'lobby',
      len: 6400, h: 720, band: [445, 690], wallBase: 400, exit: 99999, exitLabel: 'EXIT', clock: T(18, 29), par: 200,
      caption: ['6:29 PM. The lobby.', 'The front doors are RIGHT THERE. What could go wrong?'],
      encounters: [
        { x: 1300, waves: [W('Security Guards. They resist knockback. Use heavies!', [['guard', 2], ['shambler', 3]], 6)] },
        { x: 2700, waves: [W('Reception keeps ringing the bell for reinforcements.', [['recept', 2], ['guard', 1], ['replyall', 2]], 7)] },
        { x: 4000, waves: [W('Luggage Valets. Mind the carts.', [['valet', 2], ['hr', 1], ['guard', 2], ['intern', 2]], 8)] },
        { x: 5600, waves: [], boss: 'ceo_lobby', bossText: 'THE CEO OF MONDAYS blocks the exit!', scene: 'lobby' },
      ],
      clear: 'Exit sealed. Plan B: THE LIFT, up to the roof.' },
    // The Lift: Part A = the lift lobby (a countdown with waves while the car arrives), Part B = inside the cab (waves at each floor stop) + mini-boss.
    s4: { id: 's4', num: 4, name: 'THE LIFT', sub: 'GOING UP', bg: 'bg_s4', music: 'stlift', boss_music: 'boss', light: 'lift',
      len: 3744, h: 720, band: [490, 690], wallBase: 468, zones: [{ x0: 2600, x1: 99999, y0: 615, y1: 708, ramp: 160, wb: 580 }], cab: { x0: 2640, x1: 3500, y0: 615, y1: 708 }, exit: 3330,
      // v4.3: lift doors. lobbyLift = the back-wall lift you board (closed in the art; panels animate). door = the cab's open side door (threshold line y + (x - x0) * k)
      lobbyLift: { x0: 2135, x1: 2300, top: 145, th: 468, fx0: 2111, fx1: 2324, ftop: 116 }, door: { x0: 3290, x1: 3560, y: 545, k: 0.27, sx: [3385, 3480], pil: [3532, 3580, 60, 720], hdr: [3290, 3580, 60, 136] }, exitLabel: 'ROOF ACCESS', clock: T(18, 44), par: 170,
      caption: ['6:44 PM. The lift lobby, ground floor.', 'The car is coming. So is rush hour. Hold the lobby, then ride it to the roof.'],
      encounters: [
        { x: 1000, label: 'LIFT LOBBY', waves: [W('Rush-Hour Commuters come in packs of three!', [['commuter', 3], ['salesman', 1]], 5)] },
        { x: 2000, label: 'LIFT ARRIVING', countdown: 30, waves: [W('The lift is on its way. Hold the lobby!', [['commuter', 3], ['intern', 2]], 6), W('Elevator Pitch Salesmen! "SYNERGY!" knocks you back.', [['salesman', 2], ['commuter', 3]], 7)] },
        { x: 3104, cab: true, label: 'FLOOR 12', waves: [W('Doors close. Floor 12.', [['commuter', 3], ['salesman', 1]], 5)] },
        { x: 3104, cab: true, chain: true, label: 'FLOOR 27', waves: [W('Floor 27. Everyone gets on.', [['salesman', 2], ['commuter', 3]], 6)] },
        { x: 3104, cab: true, chain: true, label: 'FLOOR 41', waves: [W('Floor 41. The lights flicker.', [['commuter', 3], ['salesman', 2], ['intern', 2]], 7)] },
        { x: 3104, cab: true, chain: true, label: 'FLOOR 52', waves: [], boss: 'muzak', bossText: 'MR. MUZAK plays the lift music. Forever.', bossFrom: 'r' },
      ],
      clear: 'Roof access unlocked. The doors slide open on the night sky.' },
    s5: { id: 's5', num: 5, name: 'ROOFTOP', sub: 'HELIPAD', bg: 'bg_s5', music: 'stroof', boss_music: 'boss', light: 'roof',
      len: 6400, h: 720, band: [390, 690], wallBase: 340, exit: 6050, exitLabel: 'HELIPAD', clock: T(19, 0), par: 200, endScene: 'roof',
      caption: ['7:00 PM. The roof. STARSHIFT\'s dome glows across the city.', 'There is a helicopter on the pad. Someone has to get to it.'],
      encounters: [
        { x: 1300, waves: [W('Pen Throwers! They volley from the vents.', [['penner', 3], ['intern', 3]], 6)] },
        { x: 2800, waves: [W('Smoke-Break Zombies. They have been out here since 2019. Don\'t stand in the cloud.', [['smoker', 2], ['washer', 2], ['penner', 2]], 7)] },
        { x: 4600, waves: [W('Is that... a drone? No — a "quick sync".', [['shambler', 2], ['penner', 2], ['intern', 2]], 5)], boss: 'micromanager', bossText: 'THE MICROMANAGER took the lift. Unapproved!', bossLines: ['You took the LIFT?!', 'That route was NOT approved!'] },
      ],
      clear: 'The helicopter lifts off... and does not stay up.' },
    s6: { id: 's6', num: 6, name: 'THE APARTMENT', sub: 'WHERE THE HELICOPTER LANDED', bg: 'bg_s6', music: 'stapt', boss_music: 'boss', light: 'apt',
      len: 6400, h: 720, band: [450, 690], wallBase: 410, exit: 6250, exitLabel: 'THE STREET', clock: T(19, 16), par: 220,
      caption: ['7:16 PM. A smashed unit on the 6th floor.', 'Smashed unit, corridor, laundry room, stairwell... then the street. The tenants are awake.'],
      encounters: [
        { x: 1300, waves: [W('The smashed unit. WFH Zombies shield with laptops.', [['wfh', 3], ['delivery', 2]], 5)] },
        { x: 2700, waves: [W('The corridor. A Delivery Guy brought boomerang boxes.', [['delivery', 3], ['wfh', 2], ['laundry', 1]], 7)] },
        { x: 4000, waves: [W('The laundry room. Mind the soap.', [['laundry', 2], ['wfh', 2], ['delivery', 2]], 8)] },
        { x: 5400, waves: [W('The stairwell. Someone is jangling keys...', [['wfh', 2], ['laundry', 1]], 4)], boss: 'landlord', bossText: 'THE LANDLORD wants the rent. Right now.', bossLines: ['Who is paying for THAT hole?!', 'RENT. IS. DUE.'] },
      ],
      clear: 'Down the stairs and out onto the street. STARSHIFT is close.' },
    s7: { id: 's7', num: 7, name: 'THE STREETS', sub: 'RUN TO STARSHIFT', bg: 'bg_s7', music: 'ststreet', boss_music: 'ceo', light: 'streets',
      len: 6800, h: 720, band: [445, 690], wallBase: 400, exit: 6650, exitLabel: 'STARSHIFT LIVE', clock: T(19, 32), par: 240,
      caption: ['7:32 PM. Neon City, in the rain.', 'Under half an hour to showtime. The CEO is NOT done with her.'],
      encounters: [
        { x: 1300, waves: [W('Scooter Couriers! They charge in a straight line, then crash.', [['courier', 3], ['umbrella', 2], ['shambler', 2]], 7)] },
        { x: 2800, waves: [W('Umbrella Blockers hide behind their umbrellas. Hit them from behind.', [['salaryman', 2], ['umbrella', 2], ['courier', 2]], 7)] },
        { x: 4200, waves: [W('Rush hour in the rain. Briefcases fly.', [['courier', 2], ['umbrella', 2], ['salaryman', 2], ['hr', 1]], 8)] },
        { x: 5650, waves: [W('Corporate security!', [['itguy', 2], ['salaryman', 1], ['shambler', 2]], 5)], boss: 'ceo', bossFrom: 'l', bossText: 'THE CEO OF MONDAYS — FINAL REVIEW!' },
      ],
      clear: 'STARSHIFT. 8 PM. She made it.' },
    survival: { id: 'survival', name: 'SURVIVAL', sub: 'ENDLESS OVERTIME', arenaName: 'OVERTIME', bg: 'bg_arena', music: 'stage', boss_music: 'boss', light: 'arena',
      world: { w: 1600, h: 900 }, arena: { x0: 280, x1: 1320, y0: 225, y1: 840 }, wallBase: 110, clock: T(17, 59),
      bossEvery: 5, bossRotation: ['micromanager', 'hrdirector', 'printerboss', 'ceo'], bossAt: { 15: 'landlord' },
      unlocks: [[1, 'shambler'], [2, 'intern'], [3, 'hr'], [4, 'replyall'], [6, 'printer'], [7, 'itguy'], [8, 'sniper'], [9, 'spiller'], [11, 'guard'], [12, 'bluescr'], [13, 'roller'], [14, 'kbwar'], [16, 'salaryman'], [17, 'umbrella'], [18, 'delivery'], [19, 'laundry']],
      speakerFrom: 6 },
    // v4: second arena — the lift cab. Doors open every wave; spawns from both sides; Mr. Muzak on waves 5 and 10, the Landlord on 15.
    survival_lift: { id: 'survival_lift', name: 'SURVIVAL', sub: 'THE LIFT', arenaName: 'THE LIFT', bg: 'bg_lift', music: 'stlift', boss_music: 'boss', light: 'liftarena', liftArena: true,
      world: { w: 1600, h: 900 }, arena: { x0: 200, x1: 1330, y0: 765, y1: 875 }, wallBase: 730,
      door: { x0: 1090, x1: 1420, y: 735, k: 0.41, sx: [1150, 1280], pil: [1334, 1394, 100, 900], hdr: [1000, 1394, 80, 150] }, clock: T(17, 59),
      bossEvery: 5, bossRotation: ['micromanager', 'hrdirector', 'printerboss', 'ceo'], bossAt: { 5: 'muzak', 10: 'muzak', 15: 'landlord' },
      unlocks: [[1, 'commuter'], [2, 'salesman'], [3, 'shambler'], [4, 'intern'], [6, 'hr'], [7, 'replyall'], [8, 'sniper'], [9, 'guard'], [11, 'wfh'], [12, 'umbrella'], [13, 'courier'], [14, 'laundry'], [16, 'bluescr'], [17, 'salaryman']],
      speakerFrom: 6 },
  };
  CO.SURV_ARENAS = ['survival', 'survival_lift'];

  CO.STORY = {
    intro: [
      { t: '5:59 PM. Friday.', s: 'One minute to freedom.' },
      { t: 'STARSHIFT — LIVE. TONIGHT, 8 PM.', s: 'Six months of waiting. Seat A-12. Nothing can stop her now.' },
      { t: 'Then the office... woke up.', s: '"Hey Lemon... got a sec?"  "Can you stay late?"' },
      { t: 'Lemon picks up the Heavy-Duty Stapler 9000.', s: '"No. I\'m clocking out."' },
    ],
    scenes: {
      lobby: { img: 'scene_lobby', panels: [
        { t: 'The CEO shrugs off the stapler.', s: '"MONDAY AURA. Nothing gets through. Not even stapled memos."' },
        { t: 'CLUNK. CLUNK. CLUNK.', s: 'He seals the doors with chains and caution tape. Lots of caution tape.' },
        { t: '"This building has no exits. Only MEETINGS."', s: 'Lemon looks at the doors. Then at the lift. Going UP.' },
        { t: 'Plan B: the lift. Up to the roof.', s: '"Fine. I\'ll take the long way out."' },
      ] },
      roof: { img: 'scene_heli1', panels: [
        { t: 'The Micromanager crumples into a pile of sticky notes.', s: 'The zombie office floods onto the roof after her. The helicopter is warm. The keys are in it.' },
        { t: 'Take-off!', s: '"Out of office. Effective immediately."', img: 'scene_heli1' },
        { t: 'Something goes wrong.', s: 'A coffee-stained rotor. A very tired pilot. A very sudden descent.', img: 'scene_heli2' },
        { t: 'CRASH.', s: 'Straight through the wall of a quiet apartment block. Lemon looks up. "...Sorry about the wall."', img: 'scene_apt' },
      ] },
    },
  };
})(window.CO);
