CLOCK OUT!  —  An Arcane Duel Chronicles Story   (v3.2: story always plays from STORY; v3.1 run cycle, rebind + dialogue fixes)

HOW TO PLAY
  Unzip, then double-click index.html (Chrome, Edge, Firefox or Safari). No server or internet needed.
  On a phone, put the folder on any static host (for example GitHub Pages later) and play in landscape.

KEYBOARD (defaults - every key can be changed: TITLE -> CONTROLS, or CONTROLS / KEY BINDING on the How to Play screen)
  P1: Move WASD   Light J / Z   Heavy K / X (hold to charge "Final Draft")   Jump Space / C   Dash L / Shift
      Coffee Rush U / 1   Staple Barrage I / 2   Briefcase Spin O / 3   Clock Out (ult) ; / 4   Pause Esc / P
      With one player the arrow keys also move Lemon.
  P2: Move arrows   Light ,   Heavy .   Jump /   Dash Right-Shift   Skills 7 8 9   Clock Out 0
  Combos: J J J J spin, J K Rubber Stamp, J J K Promotion (launcher), then J in the air to juggle and K for Hole Punch; dash then J = Commute
GAMEPAD   X light, Y heavy, A jump, B/RT dash, LB/RB/LT skills, R3 Clock Out, Start pause (same layout for pads 1-5)
TOUCH     Left thumb is the floating stick; the right-side buttons are ATK / HVY / JUMP / DASH, the 3 skills and the clock (ult). The II button pauses.

HOW TO PLAY SCREEN  Shown before every mode (Story, Stage Select, Survival, co-op): your current keys, gamepad and touch controls,
                    the items (Coffee Bean +30 caffeine, Birthday Cake +60 HP) and combo tips. Tick "Don't show again" to skip it;
                    it stays reachable from the title menu (HOW TO PLAY).
KEY BINDING         13 actions x 2 keys each (move x4, light, heavy, jump, dash, 3 skills, ult, pause) for P1 and P2.
                    Enter to rebind a slot, Esc cancels, Del clears, a key already in use is swapped, RESET restores defaults.
                    Saved in this browser (localStorage).

v3.2 CHANGES (urgent fix: "the story is not there")
  - STORY on the title menu now ALWAYS plays the intro story. Before, it jumped straight to Stage Select whenever the saved
    progress said you had seen the intro (any earlier version's save in the same browser sets that), so the story seemed gone.
  - Esc or the tappable SKIP >> (top-right) leaves the intro; the story ends in Stage Select if you have progress, else How to Play / Stage 1.
  - New title item STAGE SELECT goes straight to the stage list.
  - The dialogue input gate also re-arms itself after 1 second, so a stuck pad button or lost mouse-up can never freeze a dialogue.

v3.1 CHANGES
  - RUN: new 24-frame rig-drawn sprint cycle (alternating legs, arm pump, body bob + lean, ~2.85 steps/s), stride locked to distance (no foot slide).
  - KEY BINDING: one key per press, no more auto-closing / jumping to the 2nd slot. STORY: dialogue lines no longer skipped by held/stale keys or taps.
  - HUD name/clock-out/timer overlaps, exit labels moved off the door/venue signs, street lamps moved off the 24H MART sign, Survival glitch pass.

GOAL      Escape the office before STARSHIFT starts at 8 PM. Land 50+ hits in one combo for OVERTIME!

MODES
  STORY (CLOCK IN)  5 scrolling stages from Lemon's desk to the STARSHIFT venue:
                    1 3rd Floor  ->  2 2nd Floor  ->  3 1F Lobby  ->  4 Rooftop  ->  5 The Streets.
                    Fights lock the screen; when "GO ->" flashes, run right to the next fight / the EXIT.
                    Cleared stages unlock in STAGE SELECT (saved in this browser).
  SURVIVAL          The endless arena. Waves get harder, a boss every 5 waves. Best score is saved.
  CO-OP 1-5         Coming soon (the code already supports up to 5 players).

GITHUB PAGES
  Upload the contents of this folder (index.html at the repo root). All paths are relative; no build step.

DEBUG URL OPTIONS  (add to index.html?...)
  skip         go straight into a stage          stage=s1..s5 or stage=survival
  bot          autoplay                           speed=2..8   (fast-forward)
  boss         start at the stage's boss          god          (no damage)
  chain        auto-continue to the next stage    players=1..5 (extra players are bots; co-op test)
  touch=on     force the touch UI (touch=off hides it)

FILES  maps/ holds the per-stage map art (loaded on demand, keep it next to index.html).
