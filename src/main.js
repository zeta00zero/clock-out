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
  window.__CO = CO;
})(window.CO);
