// Clock Out! v5 — per-character stories (data-driven). Each playable character may have an entry; a character
// without one falls back to CO.STORIES.lemon (the main STARSHIFT thread). To add a new character's story later,
// just add CO.STORIES.<charId> = {...} with the same shape — no scene code changes needed.
(function (CO) {
  const st = k => 'st_' + k, s53 = k => 'st53_' + k;   // v5.3: Keith / Weisheng stills redrawn as full anime illustrations
  CO.STORIES = {
    lemon: {
      title: 'STARSHIFT', goal: 'STARSHIFT', deadline: 20 * 60, clockOff: 0, pron: 'SHE',
      intro: null,                     // null = the original CO.STORY.intro panels on bg_intro
      stages: {}, boss: {}, texts: [],
      ending: null,                    // null = the original STARSHIFT result screen (bg_win)
      endHead: ['SHE MADE IT... FASHIONABLY LATE.', 'CLOCKED OUT. SHE MADE IT.'],
      endSub: (hm, late, spare) => 'Reached STARSHIFT at ' + hm + ' — ' + (late ? 'missed the opener, caught the encore.' : spare + ' to spare. Seat A-12. Lightsticks UP.'),
      until: 'until STARSHIFT.', lateMsg: 'STARSHIFT has started. RUN.', overLine: 'STARSHIFT starts at 8 PM. The clock does not care.',
      coopEnd: '',
    },
    weisheng: {
      exit7: 'HOME', scenes: {
        lobby: { img: 'st53_ws_lobby', panels: [{ fx: 'shake', t: 'The CEO seals the front doors.', s: '"Exit sealed. …Roof, then. Detour noted."' }, { t: 'Plan B: the lift. Up to the roof.', s: '"Lift\'s the fastest thing in this building. Including me."' }] },
        roof: { img: 'st53_ws_heli', panels: [{ fx: 'whoosh', t: 'Take-off!', s: '"Shortest distance between two points: a straight line. Down."' }, { fx: 'crash', t: 'CRASH.', s: '"It\'s going down. Not the way I planned."' }, { t: 'A quiet apartment block.', s: '"Sorry about the wall. I\'ll send a cheque."', img: 'st53_ws_crash', fx: 'dust' }] } },
      title: 'HOME BY 7:30', goal: 'DINNER', deadline: 19 * 60 + 30, clockOff: -30, pron: 'HE',
      intro: [
        { t: '5:58 PM. Friday.', s: 'Daughter: "Papa, dinner at 7:30! Mama made curry. You promised!!"  —  "Promised. Leaving at six. Not a minute later."', img: s53('ws_i1'), fx: 'ping' },
        { t: 'The car park camera.', s: 'Car boxed in. Shutter jammed. A zombie guard asleep on the button.  "Garage blocked. Fine. Taking the long way."', img: s53('ws_i2') },
        { t: 'Tie straightened. Watch checked.', s: 'The whole floor shambles out of the cubicles.  "Ninety minutes. Zero wasted."', img: s53('ws_i3') },
        { t: 'CLOCK OUT!  —  HOME BY 7:30', s: 'Weisheng. Car-pool guy. Family man. On schedule.', img: s53('ws_t'), fx: 'flash' },
      ],
      stages: {
        s1: { sub: 'OPEN-PLAN TRAFFIC JAM', start: '"Stairwell\'s on the far side. Efficient route: through them."', clear: '"One floor. Eighty-one minutes."', text: 'Papa where r u' },
        s2: { sub: 'THE MEETING THAT COULD\'VE BEEN AN EMAIL', start: '"I don\'t do \'quick syncs\'."', clear: '"Lobby next. Then the car."', text: 'Mama says dont run in the suit' },
        s3: { sub: 'THE LOBBY', start: '"Front door. Garage after that."', clear: '"Exit sealed. …Roof, then. Detour noted."' },
        s4: { sub: 'EXPRESS TO THE ROOF', start: '"Lift\'s the fastest thing in this building. Including me."', clear: '"Roof. There\'s a helicopter. Of course there is."', text: 'Is that you on the news??' },
        s5: { sub: 'HELIPAD', start: '"Shortest distance between two points: a straight line. Down."', clear: '"It\'s going down. Not the way I planned."' },
        s6: { sub: 'WRONG FLAT', start: '"Sorry about the wall. I\'ll send a cheque."', clear: '"Street level. Twelve minutes left."', text: 'We saved u the big plate' },
        s7: { sub: 'THE LAST STRETCH', start: '"I can see the junction to my estate."', clear: '"7:29. Door\'s right there."' },
      },
      boss: { hrdirector: 'Policy says I leave at six. Read your own handbook.', printerboss: 'PC LOAD LETTER. Not my department.', ceo_lobby: 'With respect: no.', muzak: 'Elevator music. My kid\'s recorder recital was better.', micromanager: 'You want a status update? Leaving.', landlord: 'I\'m not a tenant. I\'m a shortcut.', ceo: 'My overtime ends at 7:30. Sharp.' },
      ending: [
        { t: '7:29 PM. The front door.', s: 'Hallway light spills out. Suit torn. Tie still perfect.', img: s53('ws_e1') },
        { t: '7:29 PM. Home.', s: 'Daughter: "You made it!"   Weisheng: "Told you. Not a minute late."', img: s53('ws_e2') },
        { t: 'HOME. 7:30 PM. On time.', s: 'Curry. Rice. The crayon drawing on the fridge. Worth every floor.', img: s53('ws_e3') },
      ],
      endHead: ['HE MADE IT... DINNER\'S A BIT COLD.', 'CLOCKED OUT. HOME FOR DINNER.'],
      endSub: (hm, late, spare) => 'Home at ' + hm + ' — ' + (late ? 'dinner\'s cold, but the hug is warm.' : spare + ' to spare. Curry, rice, family.'),
      until: 'until dinner.', lateMsg: 'Dinner\'s cold.', overLine: 'Dinner is at 7:30. The curry does not wait.',
      coopEnd: 'Weisheng made dinner. 7:30 sharp.',
    },
    keith: {
      exit7: 'GAME NIGHT', scenes: {
        lobby: { img: 'st53_kt_lobby', panels: [{ fx: 'shake', t: 'The CEO seals the front doors.', s: '"Door\'s locked. Guess we take the long route, like a side quest."' }, { t: 'Plan B: the lift. Up to the roof.', s: '"Elevator = loading screen. Fight during the loading screen."' }] },
        roof: { img: 'st53_kt_heli', panels: [{ fx: 'whoosh', t: 'Take-off!', s: '"A helicopter?? Bro, this is a cutscene."' }, { fx: 'crash', t: 'CRASH.', s: '"Okay that crash was NOT in the trailer."' }, { t: 'A quiet apartment block.', s: '"Sorry auntie! Wrong game night!"', img: 'st53_kt_crash', fx: 'dust' }] } },
      title: 'GAME NIGHT, BRO', goal: 'GAME NIGHT', deadline: 20 * 60, clockOff: 0, pron: 'HE',
      intro: [
        { t: '5:58 PM. The AV booth.', s: 'Group chat BROS: "8PM game night!!"  "new banner drops tonight"  "KEITH U BRINGING THE SNACKS"  "limited event bro dont be late"', img: s53('kt_i1'), fx: 'ping' },
        { t: 'Lights out. Something shambles on the projector.', s: '"Bro. Not tonight."', img: s53('kt_i2'), fx: 'shake' },
        { t: 'Snacks: secured. Laser pointer: ready.', s: '"Relax, bro. Two hours. Easy."', img: s53('kt_i3') },
        { t: 'CLOCK OUT!  —  GAME NIGHT, BRO', s: 'Keith. After-hours AV tech. The kitties have his back.', img: s53('kt_t'), fx: 'flash' },
      ],
      stages: {
        s1: { sub: 'LAG SPIKE', start: '"Relax, bro. It\'s just the tutorial level."', clear: '"Floor cleared. Achievement unlocked."', text: 'keith eta??' },
        s2: { sub: 'SERVER FARM', start: '"Server room? Bro, I could get such good ping here."', clear: '"Lobby time. Snacks still intact."', text: 'we pulled 0 SSRs waiting for u' },
        s3: { sub: 'THE LOBBY', start: '"Boss at the door? That\'s a raid boss, bro."', clear: '"Door\'s locked. Guess we take the long route, like a side quest."' },
        s4: { sub: 'LOADING SCREEN', start: '"Elevator = loading screen. Fight during the loading screen."', clear: '"Roof unlocked. New area discovered!"', text: 'bro is that u on the rooftop cam lol' },
        s5: { sub: 'HELIPAD', start: '"A helicopter?? Bro, this is a cutscene."', clear: '"Okay that crash was NOT in the trailer."' },
        s6: { sub: 'WRONG HOUSE', start: '"Sorry auntie! Wrong game night!"', clear: '"Street level. Bros say the banner\'s live."', text: 'SNACKS. KEITH. SNACKS.' },
        s7: { sub: 'FINAL BOSS ENERGY', start: '"Last level, bro. No continues."', clear: '"8:00. Logging in."' },
      },
      boss: { hrdirector: 'Is this a mandatory fun session? Pass, bro.', printerboss: 'Bro needs a firmware update.', ceo_lobby: 'Raid boss. Unkillable phase. Classic.', muzak: 'Your playlist is mid, bro.', micromanager: 'Relax, bro. You\'re micro-managing my build.', landlord: 'I\'m not paying rent. I\'m passing through.', ceo: 'Final boss. Kitties, it\'s showtime.' },
      ending: [
        { t: '8:00 PM. "KEIIIITH!"', s: 'The bros jump off the sofa. He brought the snacks.', img: s53('kt_e1') },
        { t: 'NEW BANNER!', s: '"Relax, bros. I brought the luck."', img: s53('kt_e2') },
        { t: 'SSR!!!', s: 'GAME NIGHT. 8:00 PM. Logged in.', img: s53('kt_e3'), fx: 'flash' },
      ],
      endHead: ['HE MADE IT... BANNER\'S HALF OVER.', 'CLOCKED OUT. GAME NIGHT, BRO.'],
      endSub: (hm, late, spare) => 'Logged in at ' + hm + ' — ' + (late ? 'the bros pulled without him. Still SSR vibes.' : spare + ' to spare. Snacks delivered.'),
      until: 'until game night.', lateMsg: 'Bros started the gacha without you.', overLine: 'Game night is at 8. The banner does not wait.',
      coopEnd: 'Keith made game night. SSR pulled.',
    },
    weiyao: {
      exit7: 'HIGHBALL HIDEOUT', scenes: {
        lobby: { img: 'bg_s3', panels: [{ t: 'The CEO seals the front doors.', s: '"Doors sealed? Then we take the stage door — the roof."' }, { t: 'Plan B: the lift. Up to the roof.', s: '"Elevator music. I could do a better cover."' }] },
        roof: { img: 'bg_s5', panels: [{ t: 'Take-off!', s: '"High ground. My best angle."' }, { t: 'CRASH.', s: '"...That landing was NOT choreographed."' }, { t: 'A quiet apartment block.', s: '"Pardon the intrusion — autographs later!"', img: 'bg_s6' }] } },
      title: 'HAPPY HOUR ENCORE', goal: 'HAPPY HOUR', deadline: 20 * 60, clockOff: 0, pron: 'HE', clearFlash: 'GRAND DERBY 8:00 PM', hudGoal: 'HAPPY HOUR ends 8:00 · ',
      intro: [
        { t: '5:58 PM. The event-hall desk.', s: 'STARLIGHT GALLOP!: "GRAND DERBY tonight 8PM! Your ace Crimson Encore is entered!"   Highball Hideout: "Highball happy hour, 2-for-1 til 8:00"   —  "Rehearsal\'s over. Showtime ends at six."', img: st('wy_i1') },
        { t: 'The cubicles fill with zombies. A spotlight snaps on.', s: '"Lights, music, action — it\'s showtime, and you\'re my audience!"', img: st('wy_i2') },
        { t: 'Headset: fixed. Phone: checked.', s: '"Two hours. One race. Five highballs. Let\'s go."', img: st('wy_i3') },
        { t: 'CLOCK OUT!  —  HAPPY HOUR ENCORE', s: 'Wei Yao. Company emcee. Every hit on the beat.', img: st('wy_t') },
      ],
      stages: {
        s1: { sub: 'OPENING ACT', start: '"Warm-up crowd. Let\'s hear you!"', clear: '"Opening act: nailed it."', text: 'STARLIGHT GALLOP!: Gate draw announced — Crimson Encore, gate 7!' },
        s2: { sub: 'SOUNDCHECK', start: '"Check, check... one, two... zombie."', clear: '"Mic\'s hot. Lobby next."', text: 'Highball Hideout: 2 hrs left of happy hour' },
        s3: { sub: 'THE LOBBY', start: '"A grand foyer. Finally, a venue worthy of me."', clear: '"Doors sealed? Then we take the stage door — the roof."' },
        s4: { sub: 'INTERMISSION', start: '"Elevator music. I could do a better cover."', clear: '"Roof. A helicopter entrance? I love it."', text: 'STARLIGHT GALLOP!: Pre-race paddock is LIVE' },
        s5: { sub: 'AERIAL ROUTINE', start: '"High ground. My best angle."', clear: '"...That landing was NOT choreographed."' },
        s6: { sub: 'UNSCHEDULED GUEST SPOT', start: '"Pardon the intrusion — autographs later!"', clear: '"Street level. The bar\'s two blocks away."', text: 'Highball Hideout: Taku says your usual stool is free' },
        s7: { sub: 'GRAND FINALE', start: '"Final number. Encore not included."', clear: '"7:59. Save me a stool."' },
      },
      boss: { hrdirector: 'Mandatory fun? I *am* the mandatory fun.', printerboss: 'Paper jam? Darling, I improvise.', ceo_lobby: 'You hired me to host. Watch me.', muzak: 'Off-key and off-beat. Let a professional take the mic.',
        micromanager: 'Notes on my performance? Save them for the encore.', landlord: 'I\'m not staying. This is a walk-on cameo.', ceo: 'Final number. Lights, music — action!' },
      ending: [
        { t: '7:59 PM. Highball Hideout.', s: 'Taku: "Cutting it close, maestro."   Wei Yao: "An entrance is all about timing."', img: st('wy_e1') },
        { t: 'STARLIGHT GALLOP! — GRAND DERBY', s: 'Crimson Encore pulls level on the final stretch...', img: st('wy_e2') },
        { t: 'PHOTO FINISH!', s: '"Encore! ...Taku, another round!"   HAPPY HOUR. 8:00 PM. Encore!', img: st('wy_e3') },
      ],
      endHead: ['HE MADE IT... FULL PRICE.', 'CLOCKED OUT. HAPPY HOUR ENCORE.'],
      endSub: (hm, late, spare) => 'On his stool at ' + hm + ' — ' + (late ? 'happy hour\'s over, but the derby\'s still on.' : spare + ' to spare. Five highballs, 2-for-1.'),
      until: 'until happy hour ends.', lateMsg: 'Happy hour\'s over. Full price.', overLine: 'Happy hour ends at 8. The derby starts at 8. Get up!',
      coopEnd: 'Wei Yao made happy hour. Crimson Encore won by a nose.',
    },
  };
  // whose story runs: solo = the picked fighter (if they have a story); co-op = Lemon's thread if she's in, else P1's
  CO.storyLead = chars => { chars = chars || CO.sel.chars || ['lemon']; return CO.STORIES[chars[0]] ? chars[0] : 'lemon'; };   // v5.3: P1 / the online host always leads (co-op used to fall back to Lemon whenever she was in the party)
  CO.story = chars => CO.STORIES[CO.storyLead(chars)];
  CO.storyExtras = chars => (chars || CO.sel.chars || []).filter(c => c !== CO.storyLead(chars) && CO.STORIES[c]);
  CO.storyIntro = chars => { const s = CO.story(chars); return s.intro || CO.STORY.intro; };
})(window.CO);
