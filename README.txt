CLOCK OUT!  —  An Arcane Duel Chronicles Story   v5.3   (v5: Story / Survival / Settings menus, ONLINE co-op, 100-level Survival with Boss Rush, new fighter WEI YAO, per-character stories)

WHAT'S NEW IN v5.3
  ONLINE    The story follows the HOST's fighter (intro, cutscenes and ending). The host picks any of the 7 stages; all stages and
            cutscenes are unlocked. READY / SET / GO countdown before play. Each player gets their own HUD (your fighter big, teammates
            small). Fixed: random freezes / pauses for joining players, players getting stuck (a watchdog now frees them), the host's
            blank screen on START, and leftover online/co-op settings leaking into the next mode. Version tag clockout-v5.3.
  LOCAL     Local co-op is now 2 players (P1 + P2) with a 2-player HUD. Online still allows up to 4.
  STORY     Keith's and Weisheng's cutscenes are now fully illustrated with camera moves, effects, music and sound, like Lemon's and Wei Yao's.
  START     Slower, bigger phone-smash intro (~9 s) with its own music, phone ping, buzz (vibrates on phones), glass crack and shatter.

WHAT'S NEW IN v5.2
  ONLINE    Smoother co-op for joining players: the host now sends at a fixed ~30 Hz (motion on an unordered channel, events/state on a
            reliable one, compact delta updates with a full refresh every ~1 s); other fighters are shown ~100 ms in the past and
            interpolated; your own fighter moves, jumps, double-jumps and starts attacks/skills instantly on your screen (hits are still
            decided by the host) and is gently corrected if it drifts. Version tag clockout-v5.2 (v5.1 rooms can't mix with v5.2).
  STORY     Cutscene AUTO-ADVANCE toggle: AUTO ON/OFF button next to SKIP, key A, or gamepad Y; also SETTINGS -> STORY AUTO-ADVANCE
            (saved, default ON). With AUTO OFF each line waits for Enter / click / tap (a blinking > shows it is ready; the first press
            finishes a line still typing). Covers the intro, mid-story cutscenes and endings for all four fighters. Online: the host's
            setting is used, and with AUTO OFF any player's confirm turns the page for everyone.

WHAT'S NEW IN v5
  MENU      STORY MODE (Start/Continue with character select, Stage Select, Co-op LOCAL or ONLINE) · SURVIVAL MODE (Single with level select,
            Co-op ONLINE or LOCAL) · SETTINGS (How to Play, Key Binding, Audio/Touch/Effects). Esc / Back works on every page.
  ONLINE    STORY or SURVIVAL -> CO-OP -> ONLINE. HOST A ROOM gives a 6-character code (COPY / SHARE CODE); friends pick JOIN WITH CODE.
            Up to 4 players, each on a different fighter (a 5th player trying to join gets a friendly 'room is full' message). Everyone presses READY, the host picks the mode and stage/level and presses START.
            The host runs the game; others see it live (works on phones). If a player drops, a CPU takes over their fighter; if the host
            leaves, everyone returns to the menu. Online needs internet (PeerJS cloud server). Some strict NAT / office firewalls can block it -
            try another network or add ?relay=1 to the address. Offline / file:// play is unaffected.
  SURVIVAL  100 levels, a boss every 10, Level 100 = BOSS RUSH (all bosses back to back, refills between). Breaks heal and drop an item.
            Your best level is saved; start from any level you've reached. Scales with co-op players.
  WEI YAO   Player 4 fighter with his own story; Weisheng ("Home by 7:30") and Keith ("Game Night, Bro") stories too. In co-op, Lemon's story leads.

HOW TO PLAY
  Unzip, then double-click index.html (Chrome, Edge, Firefox or Safari). No server or internet needed.
  On a phone, put the folder on any static host (for example GitHub Pages) and play in landscape.

START   A ~9 s phone-smash intro plays before the title (desk -> throw -> cracked screen -> ~90 glass shards fall away onto the live menu; ~40 on phones). Any key, tap or pad button skips it; the skip press never reaches the menu.
        STORY, SURVIVAL and CO-OP open a CHARACTER SELECT: LEMON, WEISHENG, KEITH or WEI YAO (local co-op: 2 players; online: 2-4; each picks a different fighter).

KEYBOARD (defaults - every key can be changed: TITLE -> CONTROLS, or CONTROLS / KEY BINDING on the How to Play screen)
  P1: Move WASD   Light J / Z   Heavy K / X (hold to charge)   Jump Space / C   Dash L / Shift
      Skill 1/2/3  U I O  (or 1 2 3)   Ultimate ; / 4   Pause Esc / P.   With one player the arrow keys also move.
  P2: Move arrows   Light ,   Heavy .   Jump /   Dash Right-Shift   Skills 7 8 9   Ultimate 0
  P3-P4: gamepads 3-4.   GAMEPAD  X light, Y heavy, A jump, B/RT dash, LB/RB/LT skills, R3 ultimate, Start pause (pads 1-4)
  TOUCH   Left thumb = floating stick; right side: ATK / HVY / JUMP / DASH, three skill icons and the ultimate. II pauses.
  DOUBLE JUMP  press Jump again while airborne (once per jump, slightly lower, with a flip). Works on keyboard, gamepad and the touch JUMP button; air attacks still work after it.

FIGHTERS
  LEMON     stapler bruiser. ATK x4 = Memo > Cc > Bcc > Spin Cycle. HEAVY = Hard Copy (hold: Final Draft); J J K Promotion launcher,
            JUMP+ATK juggle, HEAVY in the air = Hole Punch. Skills: Coffee Rush, Staple Barrage, Briefcase Spin. Ultimate: CLOCK OUT.
  WEISHENG  suit, key fob, fleet lug wrench - fast skirmisher / support. ATK x4 = Jab > Cross > Sweep > Spin Out. HEAVY = Torque Slam (hold: Full Tank),
            Jack Up launcher, Flat Tyre, air-dash, Overtake lunge. Skills: Garage Tune-Up (heals), Emergency Brake (stun), Hairpin Drift. Ultimate: HYPERION ZERO.
  KEITH     after-hours AV tech, Paw-Click Laser Presenter - ranged summoner / support. ATK x4 = Aim Jab > Laser Whip > Pointer Shot (piercing bolt)
            > Spin Sweep. HEAVY = Hold-Click beam (hold to charge), Sky Pointer in the air, DASH+ATK = Next Slide. Passive Cat Nap: stand still 1.5 s
            = double battery regen; each holo catgirl gives +5% ATK. Skills: Laser Lure (zombies chase the dot), Catgirl Call-Out (holo ally 8 s,
            ninja / brawler / cafe maid, max 2), Nine Lives (revive a downed ally at 40% or shield the team). Ultimate: NYAN IDOL SHOWTIME (charm + team ATK).
            Joins the story at the 2F projector.

GOAL      Escape the office and reach STARSHIFT before 8 PM. Story clock: 5:59 PM at the 3rd floor, about 7:50 PM at the Streets finish.

STORY (CLOCK IN)  7 stages:  1 3rd Floor > 2 2nd Floor > 3 1F Lobby (the CEO blocks the exit) > 4 The Lift (lobby countdown + in-cab floor stops,
                  mini-boss Mr. Muzak) > 5 Rooftop (ends with the helicopter take-off and crash) > 6 The Apartment (boss: the Landlord) > 7 The Streets.
                  Cleared stages unlock in STAGE SELECT. Old 5-stage saves are migrated automatically.
SURVIVAL          Endless waves, a boss every 5 waves; arenas: OVERTIME and THE LIFT (switch on the title / stage select). Best score is saved.
CO-OP 2-5         Local co-op from the title menu (arrows pick the player count).
ENEMIES           23 new zombie variants (snipers, spillers, rollers, presenters, bouncers, ...) and the Motivational Speaker in Survival.
                  Watch the telegraphs (cones, rings - jump the shock-waves), avoid puddles and spills.

EFFECTS   SETTINGS > EFFECTS High / Low (auto-Low on phones; also drops itself to Low if the frame rate collapses). Low keeps the plates and
          lighting but reduces rain, dust and glow particles.

GITHUB PAGES  Upload the contents of this folder (index.html at the repo root). All paths are relative; no build step.

DEBUG URL OPTIONS  (add to index.html?...)
  skip   straight into a stage   stage=s1..s7 | survival | survival_lift   char=lemon|weisheng   chars=lemon,weisheng,...   players=1..5
  bot    autoplay   speed=2..8   boss   god   chain   touch=on|off   fx=low|high   nointro   noflash

FILES  maps/ holds the per-stage map art (loaded on demand, keep it next to index.html).

v4.3 (2026-10-28): Lift doors are now a front layer. Players board the lobby lift through the opening, the doors slide shut behind them, and they step out of the cab door. Zombies walk out of the lift doorway in the cab fight and in Survival: The Lift.
