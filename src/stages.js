// Clock Out! — stage data. Story = 5 scrolling point-A-to-point-B stages; Survival = endless arena.
// Stage fields: bg (preview image only; the in-game map is the unique WebP chunks in maps/maps_<id>.js), len (world width), band (walkable y range),
// encounters [{x, waves:[{text, spawns:[[type,count]], max}], boss?, bossFrom?}], exit (goal x).
window.CO = window.CO || {};
(function (CO) {
  const W = (text, spawns, max) => ({ text, spawns, max });
  CO.STORY_ORDER = ['s1', 's2', 's3', 's4', 's5'];
  CO.STAGES = {
    s1: { id: 's1', num: 1, name: '3RD FLOOR', sub: 'OPEN-PLAN PURGATORY', bg: 'bg_3f', music: 'st3f', boss_music: 'boss',
      len: 6400, h: 720, band: [335, 690], exit: 6250, exitLabel: 'STAIRWELL', clock: 18 * 3600 - 60, par: 200,
      caption: ['5:59 PM. Lemon\'s desk, 3rd floor.', 'Goal: the stairwell. Obstacles: everyone.'],
      encounters: [
        { x: 1300, waves: [W('Cubicle Shamblers! They want "just five minutes".', [['shambler', 5]], 5)] },
        { x: 2700, waves: [W('Interns! They brought coffee. It\'s decaf.', [['intern', 4], ['shambler', 3]], 7)] },
        { x: 4000, waves: [W('HR has entered the chat. Hit them from behind, or use heavies!', [['hr', 2], ['shambler', 4], ['intern', 2]], 8)] },
        { x: 5350, waves: [W('Someone booked a "quick chat"...', [['shambler', 3], ['intern', 2]], 5)], boss: 'hrdirector', bossText: 'THE HR DIRECTOR guards the stairwell!' },
      ],
      clear: 'Stairwell reached. One floor down.' },
    s2: { id: 's2', num: 2, name: '2ND FLOOR', sub: 'MEETING ROOMS & SERVER FARM', bg: 'bg_2f', music: 'st2f', boss_music: 'boss',
      len: 6400, h: 720, band: [345, 690], exit: 6250, exitLabel: 'STAIRS DOWN', clock: 18 * 3600 + 20 * 60, par: 220,
      caption: ['6:20 PM. 2nd floor.', 'Every meeting room is booked. By zombies. For "syncs".'],
      encounters: [
        { x: 1300, waves: [W('IT Guys! They have cables and zero patience.', [['itguy', 2], ['shambler', 4]], 6)] },
        { x: 2700, waves: [W('Printer Jammers lob paper from range — close the distance!', [['printer', 2], ['intern', 4]], 6)] },
        { x: 4000, waves: [W('The server room is overheating. So is Lemon.', [['itguy', 2], ['printer', 2], ['hr', 1], ['shambler', 3]], 8)] },
        { x: 5350, waves: [W('Something in the copy room is... warming up.', [['intern', 3], ['itguy', 1]], 4)], boss: 'printerboss', bossText: 'THE PRINTER FROM HELL is out of paper. And mercy.' },
      ],
      clear: 'Down to the lobby. Freedom is RIGHT there.' },
    s3: { id: 's3', num: 3, name: '1ST FLOOR', sub: 'THE LOBBY', bg: 'bg_lobby', music: 'stlobby', boss_music: 'ceo',
      len: 6400, h: 720, band: [385, 690], exit: 99999, exitLabel: 'EXIT', clock: 18 * 3600 + 40 * 60, par: 200,
      caption: ['6:40 PM. The lobby.', 'The front doors are RIGHT THERE. What could go wrong?'],
      encounters: [
        { x: 1300, waves: [W('Reply-Alls! One shout and EVERYONE is CC\'d.', [['replyall', 2], ['shambler', 4]], 6)] },
        { x: 2700, waves: [W('Reception is "just following up".', [['replyall', 2], ['hr', 2], ['intern', 3]], 7)] },
        { x: 4000, waves: [W('The whole building is in this meeting now.', [['itguy', 2], ['printer', 1], ['shambler', 4], ['intern', 2]], 8)] },
        { x: 5600, waves: [], boss: 'ceo_lobby', bossText: 'THE CEO OF MONDAYS blocks the exit!', scene: 'lobby' },
      ],
      clear: 'Exit sealed. Plan B: THE ROOFTOP.' },
    s4: { id: 's4', num: 4, name: 'ROOFTOP', sub: 'THE LONG WAY DOWN', bg: 'bg_roof', music: 'stroof', boss_music: 'boss',
      len: 6400, h: 720, band: [385, 690], exit: 6050, exitLabel: 'GONDOLA', clock: 19 * 3600, par: 200,
      caption: ['7:00 PM. Rooftop. 40 flights of stairs later.', 'A window-cleaning gondola. The skyline. STARSHIFT\'s dome glowing in the distance.'],
      encounters: [
        { x: 1300, waves: [W('Interns took the stairs too. Of course they did.', [['intern', 5], ['replyall', 2]], 7)] },
        { x: 2800, waves: [W('Smoke break zombies. They\'ve been out here since 2019.', [['itguy', 2], ['printer', 2], ['shambler', 3]], 7)] },
        { x: 4600, waves: [W('Is that... a helicopter? No — a "quick sync".', [['shambler', 3], ['intern', 2]], 5)], boss: 'micromanager', bossText: 'THE MICROMANAGER took the stairs. Unapproved!', bossLines: ['You took the STAIRS?!', 'That route was NOT approved!'], scene: 'roof' },
      ],
      clear: 'Lemon leaps for the gondola. Down to the streets!' },
    s5: { id: 's5', num: 5, name: 'THE STREETS', sub: 'RUN TO STARSHIFT', bg: 'bg_street', music: 'ststreet', boss_music: 'ceo',
      len: 6800, h: 720, band: [365, 690], exit: 6650, exitLabel: 'STARSHIFT LIVE', clock: 19 * 3600 + 20 * 60, par: 240,
      caption: ['7:20 PM. Neon City.', 'Forty minutes to showtime. The CEO is NOT done with her.'],
      encounters: [
        { x: 1300, waves: [W('The night shift. Still in their lanyards.', [['shambler', 5], ['replyall', 2]], 7)] },
        { x: 2800, waves: [W('IT Guys at the vending machines. Have they tried turning it off?', [['itguy', 3], ['printer', 2], ['intern', 3]], 7)] },
        { x: 4200, waves: [W('Rush hour. Every commuter is a zombie. Just like a normal Friday.', [['hr', 2], ['replyall', 2], ['shambler', 4], ['intern', 2]], 9)] },
        { x: 5650, waves: [W('Corporate security!', [['itguy', 2], ['shambler', 3]], 5)], boss: 'ceo', bossFrom: 'l', bossText: 'THE CEO OF MONDAYS — FINAL REVIEW!' },
      ],
      clear: 'STARSHIFT. 8 PM. She made it.' },
    survival: { id: 'survival', name: 'SURVIVAL', sub: 'ENDLESS OVERTIME', bg: 'bg_arena', music: 'stage', boss_music: 'boss',
      world: { w: 1600, h: 900 }, arena: { x0: 280, x1: 1320, y0: 225, y1: 840 }, clock: 18 * 3600 - 60,
      bossEvery: 5, bossRotation: ['micromanager', 'hrdirector', 'printerboss', 'ceo'],
      unlocks: [[1, 'shambler'], [2, 'intern'], [3, 'hr'], [4, 'replyall'], [6, 'printer'], [7, 'itguy']] },
  };

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
        { t: 'CLUNK. CLUNK. CLUNK.', s: 'He seals the doors with chains and red tape. Lots of red tape.' },
        { t: '"This building has no exits. Only MEETINGS."', s: 'Lemon looks at the doors. Then at the stairs. Going UP.' },
        { t: 'Plan B: the rooftop.', s: '"Fine. I\'ll take the long way out."' },
      ] },
      roof: { img: 'scene_roof', panels: [
        { t: 'The Micromanager crumples into a pile of sticky notes.', s: 'The zombie office stumbles out of the stairwell after her.' },
        { t: 'The window-cleaning gondola.', s: 'Lemon doesn\'t do heights. Lemon does STARSHIFT.' },
        { t: 'She jumps.', s: '"Out of office. Effective immediately."' },
      ] },
    },
  };
})(window.CO);
