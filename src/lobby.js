// Clock Out! v5 — online LOBBY scene (host / join by 6-character code, fighter pick, ready, host START + mode / stage / level)
(function (CO) {
  const N = CO.net, hex = c => '#' + c.toString(16).padStart(6, '0');
  const Q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
  class Lobby extends Phaser.Scene {
    constructor() { super('Lobby'); }
    create(d) {
      d = this.d = d || {}; this.leaving = false; if (d.mode) N.lobby.mode = d.mode === 'survival' ? 'survival' : 'story';
      this.add.rectangle(640, 360, 1280, 720, 0x0b0f1e); if (this.textures.exists('bg_title')) this.add.image(640, 360, 'bg_title').setDisplaySize(1280, 720).setAlpha(0.18);
      this.head = this.add.text(50, 30, '', CO.style(40, '#ffd34d'));
      this.stat = this.add.text(50, 82, '', CO.style(18, '#cfe8ff')).setWordWrapWidth(1180);
      this.codeT = this.add.text(50, 128, '', CO.style(56, '#ffffff'));
      this.rows = []; for (let k = 0; k < 4; k++) { const y = 230 + k * 66, g = this.add.graphics(), t = this.add.text(92, y, '', CO.style(22, '#ffffff')).setOrigin(0, 0.5), r = this.add.text(560, y, '', CO.style(20, '#7dff8a')).setOrigin(1, 0.5); this.rows.push({ y, g, t, r }); }
      this.g = this.add.graphics(); this.fresh = new CO.Fresh(this, 250); this.cameras.main.fadeIn(250);
      this.rev = -1; this.build(N.session ? 'room' : 'home'); window.__lobby = this;
      if (d.auto && !N.session) { const m = Q.get('net'); if (m === 'host') this.doHost(); else if (m === 'join') this.doJoin(Q.get('room')); }
      this.events.once('shutdown', () => this.killInput());
    }
    // ---- pages ----
    build(page) {
      this.page = page; if (this.menu) this.menu.btns.forEach(b => b.c.destroy()); this.menu = null; this.killInput();
      const host = N.mode === 'host', items = [];
      if (page === 'home') {
        items.push({ label: 'HOST A ROOM', size: 26, cb: () => this.doHost() });
        items.push({ label: 'JOIN WITH CODE', size: 26, cb: () => this.askCode() });
        items.push({ label: () => 'NAME: ' + N.me.name, size: 22, cb: () => this.askName() });
        items.push({ label: 'BACK', size: 22, cb: () => this.back() });
      } else if (page === 'room') {
        const me = () => N.lobby.players.find(p => p.slot === N.me.slot) || N.me;
        items.push({ label: () => 'FIGHTER  ◀ ' + (CO.CHARACTERS[me().char] || CO.CHARACTERS.lemon).name + ' ▶', size: 24, adjust: dd => { const L = host ? N.lobbyMe() : me(), c = N.cycleChar(L.char, dd, host ? L : N.lobby.players.find(p => p.slot === N.me.slot)); host ? N.hostPick(c) : N.clientPick(c); }, cb: () => {} });
        if (host) {
          items.push({ label: () => 'MODE  ◀ ' + (N.lobby.mode === 'survival' ? 'SURVIVAL' : 'STORY') + ' ▶', size: 24, adjust: () => { N.lobby.mode = N.lobby.mode === 'survival' ? 'story' : 'survival'; N.pushLobby(); }, cb: () => {} });
          items.push({ label: () => N.lobby.mode === 'survival' ? 'LEVEL  ◀ ' + N.lobby.level + ' ▶' : 'STAGE  ◀ ' + CO.STAGES[N.lobby.stage].num + ' ' + CO.STAGES[N.lobby.stage].name + ' ▶', size: 22, adjust: dd => this.stepWhere(dd), cb: () => this.stepWhere(10) });
          items.push({ label: () => N.allReady() ? 'START!' : 'START (waiting for READY)', size: 26, cb: () => this.doStart() });
          items.push({ label: 'COPY / SHARE CODE', size: 22, cb: () => this.copy() });
        } else items.push({ label: () => N.me.ready ? 'READY ✔ (tap to cancel)' : 'READY?', size: 26, cb: () => N.clientReady(!N.me.ready) });
        items.push({ label: 'LEAVE ROOM', size: 22, cb: () => { N.leave(); this.build('home'); } });
      }
      this.menu = new CO.Menu(this, 900, 250, items, { w: 520, h: 52, gap: 10, onBack: () => page === 'room' ? (N.leave(), this.build('home')) : this.back() });
      this.refresh();
    }
    stepWhere(dd) {
      const L = N.lobby;
      if (L.mode === 'survival') { const mx = Math.max(1, CO.save.survLevel().max); L.level = Math.abs(dd) >= 10 ? (L.level >= mx ? 1 : Math.min(mx, L.level === 1 ? 10 : L.level + 10)) : Phaser.Math.Clamp(L.level + dd, 1, mx); }
      else { const O = CO.STORY_ORDER, un = Math.max(1, CO.save.progress().unlocked || 1); let i = O.indexOf(L.stage); i = Abs(dd) >= 10 ? (i + 1) % un : Phaser.Math.Clamp(i + dd, 0, un - 1); L.stage = O[i]; }
      N.pushLobby();
    }
    doHost() { this.stat.setText('Opening a room on the PeerJS server…'); N.hostRoom(ok => { if (!this.sys.isActive()) return; if (ok) this.build('room'); else { this.stat.setText(N.err); } }); }
    doJoin(code) { this.stat.setText('Connecting to room ' + N.cleanCode(code) + '…'); N.join(code, ok => { if (!this.sys.isActive()) return; if (ok) { this.build('room'); if (Q.has('autoready')) this.time.delayedCall(400, () => N.clientReady(true)); } else { this.stat.setText(N.err); this.build('home'); this.stat.setText(N.err); } }); }
    doStart() { if (!N.allReady()) { CO.audio.sfx('nope'); this.stat.setText('Everyone has to be READY first.'); return; } this.leaving = true; this.cameras.main.fadeOut(200); this.time.delayedCall(220, () => N.start(this)); }
    copy() {
      const code = N.code, txt = 'Join my Clock Out! room: ' + code;
      try { if (navigator.share && CO.isTouchDevice()) navigator.share({ title: 'Clock Out!', text: txt }).catch(() => {}); else navigator.clipboard.writeText(code); this.stat.setText('Code ' + code + ' copied — friends pick ONLINE → JOIN WITH CODE.'); }
      catch (e) { this.stat.setText('Your code: ' + code); }
    }
    // DOM text box (works with phone keyboards); Enter submits, Esc cancels
    ask(ph, val, max, done) {
      this.killInput(); const c = this.game.canvas.getBoundingClientRect(), el = document.createElement('input');
      Object.assign(el, { type: 'text', value: val || '', maxLength: max, placeholder: ph, autocapitalize: 'characters', spellcheck: false });
      Object.assign(el.style, { position: 'fixed', left: (c.left + c.width * 0.08) + 'px', top: (c.top + c.height * 0.62) + 'px', width: (c.width * 0.36) + 'px', fontSize: Math.max(18, c.height * 0.05) + 'px', padding: '6px 10px', zIndex: 50, background: '#10162e', color: '#ffd34d', border: '3px solid #1fd1e8', borderRadius: '8px', fontFamily: 'monospace', letterSpacing: '4px' });
      document.body.appendChild(el); el.focus(); this.inp = el; CO.keyboard && CO.keyboard.beginCapture && 0;
      el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const v = el.value; this.killInput(); done(v); } else if (e.key === 'Escape') this.killInput(); });
      const ok = this.add.text(c.width ? 50 + 470 : 520, 470, '[ OK ]', CO.style(26, '#7dff8a')).setInteractive({ useHandCursor: true }); this.okBtn = ok; ok.on('pointerdown', () => { const v = el.value; this.killInput(); done(v); });
    }
    killInput() { if (this.inp) { this.inp.remove(); this.inp = null; } if (this.okBtn) { this.okBtn.destroy(); this.okBtn = null; } }
    askCode() { this.stat.setText('Type the 6-character room code and press Enter.'); this.ask('ROOM CODE', '', 6, v => this.doJoin(v)); }
    askName() { this.ask('YOUR NAME', N.me.name, 12, v => { N.setName(v); this.menu.draw(); }); }
    back() { if (this.leaving) return; this.leaving = true; this.killInput(); if (N.session) N.leave(); this.scene.start('Title', { page: N.lobby.mode === 'survival' ? 'survcoop' : 'storycoop', quiet: true }); }
    refresh() {
      const L = N.lobby, host = N.mode === 'host', room = this.page === 'room';
      this.head.setText('ONLINE CO-OP — ' + (L.mode === 'survival' ? 'SURVIVAL' : 'STORY') + (room ? (host ? '  ·  YOU ARE THE HOST' : '  ·  P' + (N.me.slot + 1)) : ''));
      this.codeT.setText(room && N.code ? 'ROOM  ' + N.code : '');
      if (room) this.stat.setText(host ? (L.players.length < 2 ? 'Share the code. Up to 4 players, each on a different fighter. ' : '') + (N.allReady() ? 'Everyone is ready — press START.' : 'Waiting for everyone to be READY…') + '   ' + (L.mode === 'survival' ? 'Survival from level ' + L.level : 'Story: ' + CO.STAGES[L.stage].name)
        : 'Host picks ' + (L.mode === 'survival' ? 'Survival · level ' + L.level : 'Story · ' + CO.STAGES[L.stage].name) + '.  ' + (N.me.ready ? 'You are READY — waiting for the host to start.' : 'Pick a fighter, then READY.'));
      this.g.clear();
      this.rows.forEach((R, k) => {
        const p = room ? L.players.slice().sort((a, b) => a.slot - b.slot)[k] : null; R.g.clear();
        if (!p) { R.t.setText(room ? '— open seat —' : '').setColor('#55607a'); R.r.setText(''); return; }
        const col = CO.PLAYER_COLORS[p.slot] || 0xffffff, ch = CO.CHARACTERS[p.char] || {};
        R.g.fillStyle(0x10162e, 0.9); R.g.fillRoundedRect(50, R.y - 27, 520, 54, 8); R.g.fillStyle(col, 1); R.g.fillRoundedRect(56, R.y - 20, 24, 40, 5);
        R.t.setText('P' + (p.slot + 1) + '  ' + p.name + (p.slot === N.me.slot ? ' (you)' : '') + (p.phone ? ' 📱' : '') + '   ' + (ch.name || '')).setColor(hex(col));
        R.r.setText(p.host ? 'HOST' : p.bot ? 'CPU' : p.ready ? 'READY' : '…').setColor(p.ready || p.host ? '#7dff8a' : '#9aa7c7');
      });
      if (this.menu) this.menu.draw();
    }
    update() {
      if (this.page === 'room' && !N.session) { this.build('home'); this.stat.setText(N.err || 'Disconnected.'); }
      if (N.lobbyRev !== this.rev) { this.rev = N.lobbyRev; this.refresh(); }
      const I = CO.menuInput.intent; this.fresh.poll(I && I.h ? I : { h: {} }); if (this.fresh.ok && !this.inp && !this.leaving && this.menu) this.menu.update();
    }
  }
  const Abs = Math.abs;
  CO.Scenes.Lobby = Lobby;
})(window.CO);
