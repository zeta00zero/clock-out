// Clock Out! — boot. Classic scripts only (no modules) so index.html works from file://.
(function (CO) {
  const S = CO.Scenes;
  const config = {
    type: Phaser.AUTO, parent: 'game', width: 1280, height: 720, backgroundColor: '#0b0f1e',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 6, gamepad: false },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    fps: { target: 60 },
    scene: [S.Boot, S.PhoneIntro, S.Title, S.CharSelect, S.StageSelect, S.SurvSelect, S.Lobby, S.HowTo, S.Controls, S.Intro, S.Cutscene, S.Game, S.HUD, S.Touch, S.Ambient, S.Settings, S.Pause, S.GameOver, S.Result],
  };
  window.__game = new Phaser.Game(config);
  { const g = window.__game, st = g.step.bind(g);   // v5.3: an exception in any scene used to kill Phaser's rAF loop (frozen screen); log it and keep running
    g.step = (t, d) => { try { st(t, d); } catch (e) { window.__stepErr = (window.__stepErr || 0) + 1; if (window.__stepErr < 6) console.warn('frame error', e && e.stack); } }; }
  window.__CO = CO;
})(window.CO);
