// Clock Out! — all music & sound synthesized at runtime with WebAudio. No audio files.
(function (CO) {
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz
  class Audio {
    constructor() { this.ctx = null; this.musicVol = 0.6; this.sfxVol = 0.8; this.song = null; this.intensity = 0; this.step = 0; this.nextT = 0; this.timer = null; }
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); const c = this.ctx;
        this.master = c.createDynamicsCompressor(); this.master.connect(c.destination);
        this.mBus = c.createGain(); this.mBus.connect(this.master); this.sBus = c.createGain(); this.sBus.connect(this.master);
        this.setVolumes(this.musicVol, this.sfxVol);
        const len = c.sampleRate; this.noise = c.createBuffer(1, len, c.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.timer = setInterval(() => this.schedule(), 25);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    setVolumes(m, s) { this.musicVol = m; this.sfxVol = s; if (this.mBus) { this.mBus.gain.value = m * 0.5; this.sBus.gain.value = s * 0.7; } }

    // ---------- primitives ----------
    tone(bus, t, f, dur, type = 'square', vol = 0.2, opts = {}) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
      if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
      if (opts.detune) o.detune.value = opts.detune;
      const a = opts.a || 0.005; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (opts.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(opts.lp, t); if (opts.lpEnd) fl.frequency.exponentialRampToValueAtTime(opts.lpEnd, t + dur); fl.Q.value = opts.q || 1; o.connect(fl); node = fl; }
      node.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
    }
    noiz(bus, t, dur, vol, type = 'highpass', f = 6000, opts = {}) {
      const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise;
      fl.type = type; fl.frequency.setValueAtTime(f, t); if (opts.fEnd) fl.frequency.exponentialRampToValueAtTime(opts.fEnd, t + dur); fl.Q.value = opts.q || 0.8;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }
    kick(t, v = 0.9) { this.tone(this.mBus, t, 150, 0.28, 'sine', v, { slide: 40 }); }
    snare(t, v = 0.35) { this.noiz(this.mBus, t, 0.16, v, 'bandpass', 1800, { q: 0.7 }); this.tone(this.mBus, t, 210, 0.08, 'triangle', v * 0.5); }
    hat(t, v = 0.12, open) { this.noiz(this.mBus, t, open ? 0.18 : 0.04, v, 'highpass', 8000); }
    clap(t, v = 0.3) { for (let i = 0; i < 3; i++) this.noiz(this.mBus, t + i * 0.01, 0.12, v, 'bandpass', 1400, { q: 1.2 }); }

    // ---------- songs ----------
    play(name) {
      if (this.songName === name) return; this.songName = name; this.song = SONGS[name] || null; this.step = 0;
      if (this.ctx) this.nextT = this.ctx.currentTime + 0.08;
      if (this.song && this.song.once) this.onceDone = false;
    }
    stop() { this.song = null; this.songName = null; }
    setIntensity(i) { this.intensity = i; }
    schedule() {
      if (!this.ctx || !this.song) return; const c = this.ctx;
      if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.02;
      while (this.nextT < c.currentTime + 0.12) {
        const S = this.song, bpm = S.bpm + (this.intensity > 0 ? (S.otBpm || 8) : 0), sd = 60 / bpm / 4;
        if (S.once && this.step >= S.len) { this.song = null; return; }
        S.play(this, this.step, this.nextT, sd, this.intensity);
        this.step++; this.nextT += sd;
      }
    }

    // ---------- sfx ----------
    sfx(name) {
      if (!this.ctx) return; const t = this.ctx.currentTime + 0.005, B = this.sBus, r = Math.random;
      switch (name) {
        case 'swing': this.noiz(B, t, 0.13, 0.25, 'bandpass', 900, { fEnd: 3500, q: 1.5 }); break;
        case 'spin': for (let i = 0; i < 3; i++) this.noiz(B, t + i * 0.1, 0.1, 0.2, 'bandpass', 800, { fEnd: 3000, q: 1.5 }); break;
        case 'heavy': this.noiz(B, t, 0.2, 0.3, 'bandpass', 500, { fEnd: 2000 }); break;
        case 'launch': this.noiz(B, t, 0.25, 0.3, 'bandpass', 400, { fEnd: 4000 }); this.tone(B, t, 300, 0.2, 'square', 0.06, { slide: 900 }); break;
        case 'hit': this.tone(B, t, 180 + r() * 60, 0.09, 'square', 0.18, { slide: 60, lp: 1800 }); this.noiz(B, t, 0.06, 0.22, 'lowpass', 2500); break;
        case 'hitHeavy': this.tone(B, t, 110, 0.2, 'sawtooth', 0.25, { slide: 40, lp: 1200 }); this.noiz(B, t, 0.15, 0.35, 'lowpass', 1500); break;
        case 'staple': this.tone(B, t, 1400, 0.04, 'square', 0.08, { slide: 500 }); this.noiz(B, t, 0.03, 0.15, 'highpass', 3000); break;
        case 'kachunk': this.tone(B, t, 90, 0.12, 'square', 0.22, { slide: 50, lp: 900 }); this.tone(B, t + 0.06, 1200, 0.05, 'square', 0.08); break;
        case 'throw': this.noiz(B, t, 0.2, 0.15, 'bandpass', 600, { fEnd: 1500 }); break;
        case 'tap': this.tone(B, t, 500, 0.05, 'triangle', 0.12); break;
        case 'poof': this.noiz(B, t, 0.3, 0.25, 'bandpass', 2500, { fEnd: 600 }); this.tone(B, t, 900, 0.12, 'triangle', 0.06, { slide: 1600 }); break;
        case 'block': this.tone(B, t, 900, 0.08, 'square', 0.12); this.tone(B, t, 1350, 0.12, 'square', 0.06); break;
        case 'phurt': this.tone(B, t, 300, 0.2, 'sawtooth', 0.2, { slide: 120, lp: 1500 }); break;
        case 'dash': this.noiz(B, t, 0.18, 0.2, 'bandpass', 2000, { fEnd: 500 }); break;
        case 'jump': this.tone(B, t, 300, 0.12, 'triangle', 0.1, { slide: 600 }); break;
        case 'slurp': for (let i = 0; i < 4; i++) this.noiz(B, t + i * 0.07, 0.06, 0.15, 'bandpass', 700 + i * 200, { q: 4 }); this.tone(B, t + 0.3, 660, 0.25, 'sine', 0.12, { slide: 990 }); break;
        case 'tick': for (let i = 0; i < 3; i++) this.tone(B, t + i * 0.12, 2000, 0.03, 'square', 0.08); break;
        case 'boom': this.tone(B, t, 120, 0.4, 'sawtooth', 0.25, { slide: 30, lp: 800 }); this.noiz(B, t, 0.35, 0.3, 'lowpass', 900); break;
        case 'bossswing': this.noiz(B, t, 0.3, 0.3, 'bandpass', 300, { fEnd: 1200 }); break;
        case 'dizzy': for (let i = 0; i < 5; i++) this.tone(B, t + i * 0.08, 1200 + (i % 2) * 300, 0.07, 'triangle', 0.08); break;
        case 'pickup': this.tone(B, t, 880, 0.08, 'square', 0.1); this.tone(B, t + 0.07, 1320, 0.12, 'square', 0.1); break;
        case 'ui': this.tone(B, t, 660, 0.06, 'square', 0.08); break;
        case 'uiok': this.tone(B, t, 660, 0.06, 'square', 0.1); this.tone(B, t + 0.06, 990, 0.1, 'square', 0.1); break;
        case 'nope': this.tone(B, t, 200, 0.12, 'square', 0.08); break;
        case 'overtime': [0, 4, 7, 12].forEach((s, i) => this.tone(B, t + i * 0.06, N(72 + s), 0.25, 'sawtooth', 0.12, { lp: 3000 })); break;
        case 'ready': [0, 7, 12].forEach((s, i) => this.tone(B, t + i * 0.08, N(79 + s), 0.2, 'square', 0.08)); break;
        case 'bell': [0, 0.5].forEach(d => { this.tone(B, t + d, N(84), 1.2, 'sine', 0.25); this.tone(B, t + d, N(91), 0.8, 'sine', 0.1); }); break;
        case 'ultHit': this.tone(B, t, 60, 0.8, 'sawtooth', 0.35, { slide: 25, lp: 600 }); this.noiz(B, t, 0.7, 0.4, 'lowpass', 1200, { fEnd: 200 }); break;
        case 'elevator': this.tone(B, t, N(88), 0.6, 'sine', 0.2); this.tone(B, t + 0.25, N(84), 0.9, 'sine', 0.2); break;
        case 'thud': this.tone(B, t, 90, 0.12, 'sine', 0.2, { slide: 40 }); break;
        case 'shout': this.tone(B, t, 220, 0.3, 'sawtooth', 0.12, { slide: 140, lp: 1400 }); this.noiz(B, t, 0.25, 0.15, 'bandpass', 1200, { fEnd: 600 }); break;
        case 'eswing': this.noiz(B, t, 0.1, 0.1, 'bandpass', 700, { fEnd: 1500 }); break;
      }
    }
  }

  // Patterns: helpers
  const chordAt = (prog, step, per) => prog[Math.floor(step / per) % prog.length];
  const SONGS = {
    // Title: chill lo-fi office ambience
    title: { bpm: 88, play(a, s, t, sd) {
      const prog = [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]]; const ch = chordAt(prog, s, 32), b = s % 32;
      if (b === 0 || b === 20) ch.forEach((n, i) => a.tone(a.mBus, t + i * 0.012, N(n), sd * 14, 'triangle', 0.05, { a: 0.03, lp: 1800 }));
      if (b % 8 === 0) a.tone(a.mBus, t, N(ch[0] - 24), sd * 6, 'sine', 0.22, { a: 0.01 });
      if (s % 16 === 0 || s % 16 === 10) a.kick(t, 0.5); if (s % 16 === 8) a.snare(t, 0.15); if (s % 4 === 2) a.hat(t, 0.05);
      if (s % 64 >= 32 && s % 4 === 0 && Math.random() < 0.5) a.tone(a.mBus, t, N(ch[(s / 4) % 4] + 12), sd * 3, 'sine', 0.05, { a: 0.01 });
    } },
    // Stage: office funk in A minor, intensity 1 = OVERTIME layer
    stage: { bpm: 122, otBpm: 10, play(a, s, t, sd, I) {
      const prog = [[57, 60, 64, 67], [62, 66, 69, 72], [53, 57, 60, 64], [52, 56, 59, 62]]; const ch = chordAt(prog, s, 16), b = s % 16;
      const bass = [0, null, 12, null, 0, 0, null, 10, null, 0, 12, null, 7, null, 10, 12];
      if (bass[b] !== null) a.tone(a.mBus, t, N(ch[0] - 24 + bass[b]), sd * 0.9, 'sawtooth', 0.16, { lp: 700, lpEnd: 300, q: 4 });
      if (b === 2 || b === 6 || b === 11 || b === 14) ch.forEach(n => a.tone(a.mBus, t, N(n), sd * 0.7, 'square', 0.028, { lp: 2600 }));
      if (b % 4 === 0) a.kick(t, 0.8); if (b === 4 || b === 12) a.snare(t, 0.32); a.hat(t, b % 2 ? 0.05 : 0.09, b === 14);
      if (I > 0) { const arp = [0, 1, 2, 3, 2, 1, 3, 2]; a.tone(a.mBus, t, N(ch[arp[s % 8]] + 12), sd * 0.8, 'sawtooth', 0.05, { lp: 4000 }); if (b % 2 === 1) a.hat(t, 0.06); if (b === 15) a.clap(t, 0.2); }
    } },
    // Boss: urgent D minor
    boss: { bpm: 140, otBpm: 8, play(a, s, t, sd, I) {
      const prog = [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 61, 64]]; const ch = chordAt(prog, s, 16), b = s % 16;
      a.tone(a.mBus, t, N(ch[0] - 24 + (b % 4 === 2 ? 12 : 0)), sd * 0.8, 'sawtooth', 0.15, { lp: 900, lpEnd: 250, q: 5 });
      if (b % 4 === 0) a.kick(t, 0.9); if (b === 4 || b === 12) a.snare(t, 0.38); if (b === 14 || b === 15) a.snare(t, 0.18); a.hat(t, 0.07);
      if (b === 0 || b === 8) ch.forEach(n => a.tone(a.mBus, t, N(n + 12), sd * 6, 'sawtooth', 0.025, { lp: 2000, a: 0.02 }));
      const mel = [12, null, 10, null, 9, null, 7, 9, null, 5, null, 7, null, 4, null, null];
      if (s % 64 >= 32 && mel[b] !== null) a.tone(a.mBus, t, N(ch[0] + mel[b]), sd * 1.6, 'square', 0.05, { lp: 3000 });
      if (I > 0 && b % 2 === 0) a.tone(a.mBus, t, N(ch[(s / 2) % 3] + 24), sd * 0.6, 'square', 0.03);
    } },
    // Win: bright original "K-pop" style anthem for STARSHIFT
    win: { bpm: 126, play(a, s, t, sd) {
      const prog = [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]]; const ch = chordAt(prog, s, 16), b = s % 16;
      if (b % 4 === 0) a.kick(t, 0.85); if (b === 4 || b === 12) { a.clap(t, 0.28); a.snare(t, 0.15); } if (b % 4 === 2) a.hat(t, 0.1, true);
      if (b % 2 === 0) a.tone(a.mBus, t, N(ch[0] - 24 + (b % 4 === 2 ? 12 : 0)), sd * 1.5, 'sawtooth', 0.13, { lp: 1000, q: 3 });
      a.tone(a.mBus, t, N(ch[s % 4] + 12), sd * 0.7, 'triangle', 0.05);
      const mel = [7, null, 7, 9, null, 7, null, 4, 2, null, 4, null, 7, null, null, null]; const m2 = [9, null, 9, 11, null, 12, null, 11, 9, null, 7, null, 4, null, 2, null];
      const M = (Math.floor(s / 16) % 2 ? m2 : mel)[b]; if (s >= 32 && M !== null) a.tone(a.mBus, t, N(60 + M + 12), sd * 1.8, 'square', 0.06, { lp: 3500 });
    } },
    over: { bpm: 80, once: true, len: 24, play(a, s, t, sd) { const m = { 0: 67, 4: 66, 8: 65, 12: 64 }; if (m[s] !== undefined) a.tone(a.mBus, t, N(m[s]), sd * (s === 12 ? 10 : 3.5), 'triangle', 0.12, { lp: 1500 }); if (s === 12) a.tone(a.mBus, t, N(40), sd * 10, 'sine', 0.2); } },
  };
  // ---- v2: per-stage track variations, built from one parameterised groove generator ----
  function groove(o) {
    return { bpm: o.bpm, otBpm: o.otBpm || 8, play(a, s, t, sd, I) {
      const ch = chordAt(o.prog, s, o.per || 16), b = s % 16, T = o.tr || 0;
      const bn = o.bass[b]; if (bn !== null) a.tone(a.mBus, t, N(ch[0] - 24 + bn + T), sd * (o.bassLen || 0.9), o.bassWave || 'sawtooth', o.bassVol || 0.15, { lp: o.bassLp || 700, lpEnd: 280, q: 4 });
      if (o.stabs.includes(b)) ch.forEach((n, i) => a.tone(a.mBus, t + i * (o.strum || 0), N(n + T), sd * (o.stabLen || 0.7), o.stabWave || 'square', o.stabVol || 0.026, { lp: o.stabLp || 2600, a: o.stabA || 0.005 }));
      o.drums(a, s, b, t);
      if (o.mel && s % (o.melEvery || 64) >= (o.melFrom || 32)) { const M = o.mel[(Math.floor(s / 16) % (o.mel.length / 16)) * 16 + b]; if (M !== null && M !== undefined) a.tone(a.mBus, t, N(o.melRoot + M + T), sd * (o.melLen || 1.6), o.melWave || 'square', o.melVol || 0.05, { lp: o.melLp || 3200 }); }
      if (I > 0) { const arp = [0, 1, 2, 3, 2, 1, 3, 2]; a.tone(a.mBus, t, N(ch[arp[s % 8] % ch.length] + 12 + T), sd * 0.8, 'sawtooth', 0.045, { lp: 4000 }); if (b === 15) a.clap(t, 0.2); }
    } };
  }
  const _ = null;
  const fourFloor = (a, s, b, t) => { if (b % 4 === 0) a.kick(t, 0.85); if (b === 4 || b === 12) a.clap(t, 0.25); a.hat(t, b % 2 ? 0.05 : 0.09, b % 4 === 2); };
  const backbeat = (a, s, b, t) => { if (b === 0 || b === 10) a.kick(t, 0.8); if (b === 4 || b === 12) a.snare(t, 0.3); if (b % 2 === 0) a.hat(t, 0.07); };
  Object.assign(SONGS, {
    st3f: SONGS.stage,   // 3rd floor keeps the v1 office-funk theme
    // 2nd floor: server-room techno in E minor, blinking-light arps
    st2f: groove({ bpm: 128, prog: [[64, 67, 71], [60, 64, 67], [62, 66, 69], [59, 62, 66]], bass: [0, _, 0, 12, 0, _, 0, 12, 0, _, 0, 12, 0, _, 10, 12], stabs: [3, 11], stabWave: 'sawtooth', stabLp: 1800,
      drums: fourFloor, mel: [12, 7, 12, 15, 12, 7, 19, 15, 12, 7, 12, 15, 17, 15, 12, 10], melRoot: 64, melWave: 'square', melLen: 0.6, melVol: 0.035, melFrom: 16, melEvery: 32 }),
    // Lobby: smooth (suspicious) elevator jazz-funk, maj7 chords
    stlobby: groove({ bpm: 104, prog: [[65, 69, 72, 76], [62, 65, 69, 72], [64, 67, 71, 74], [57, 60, 64, 67]], bass: [0, _, _, 7, _, _, 12, _, 10, _, 7, _, 5, _, 3, _], bassWave: 'triangle', bassVol: 0.22, bassLp: 900, bassLen: 1.6,
      stabs: [0, 6, 10], stabWave: 'triangle', stabVol: 0.04, stabLen: 2.5, strum: 0.015, drums: backbeat, mel: [7, _, 9, _, 11, _, 12, _, _, _, 11, 9, 7, _, _, _, 4, _, 5, _, 7, _, 4, _, 2, _, _, _, _, _, _, _], melRoot: 72, melWave: 'sine', melVol: 0.08 }),
    // Rooftop: windy, driving rock-synth in G minor
    stroof: groove({ bpm: 136, prog: [[55, 58, 62], [51, 55, 58], [53, 57, 60], [50, 54, 57]], bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 10, 10, 12, 12], bassLen: 0.6, stabs: [0, 3, 6, 8, 11, 14], stabWave: 'sawtooth', stabVol: 0.02, stabLen: 0.4,
      drums: (a, s, b, t) => { if (b % 4 === 0 || b === 7) a.kick(t, 0.9); if (b === 4 || b === 12) a.snare(t, 0.36); a.hat(t, 0.08); if (s % 64 === 0) a.noiz(a.mBus, t, 1.6, 0.08, 'bandpass', 500, { fEnd: 2500 }); },
      mel: [7, _, 10, _, 12, _, 10, 7, _, _, 5, _, 7, _, _, _, 7, _, 10, _, 14, _, 12, 10, _, _, 12, _, 10, _, 7, _], melRoot: 67, melWave: 'square', melVol: 0.05 }),
    // Streets: bright synth-pop, STARSHIFT is close!
    ststreet: groove({ bpm: 132, prog: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], bass: [0, _, 12, _, 0, _, 12, 0, _, 0, 12, _, 0, _, 12, 7], bassLp: 1000,
      stabs: [2, 6, 10, 14], stabWave: 'square', stabVol: 0.025, drums: fourFloor,
      mel: [7, _, 7, 9, _, 12, _, 9, 7, _, 4, _, 2, _, 4, _, 9, _, 9, 11, _, 12, _, 14, 12, _, 11, _, 9, _, 7, _], melRoot: 72, melWave: 'triangle', melVol: 0.07, melFrom: 16, melEvery: 32 }),
    // The CEO of Mondays: heavy, slow-burn boss theme in C minor
    ceo: groove({ bpm: 148, prog: [[48, 51, 55], [44, 48, 51], [46, 50, 53], [43, 47, 50]], bass: [0, 0, _, 0, 0, _, 1, 0, 0, 0, _, 0, 0, _, 3, 1], bassVol: 0.18, bassLp: 600, bassLen: 0.7,
      stabs: [0, 8], stabWave: 'sawtooth', stabVol: 0.03, stabLen: 6, stabA: 0.03, tr: 12,
      drums: (a, s, b, t) => { if (b % 4 === 0 || b === 3) a.kick(t, 1); if (b === 4 || b === 12) a.snare(t, 0.4); if (b >= 14) a.snare(t, 0.2); a.hat(t, 0.06); if (s % 32 === 0) a.tone(a.mBus, t, N(36), sd0(148) * 16, 'sine', 0.15); },
      mel: [12, _, 11, _, 12, _, 15, _, 14, _, 12, _, 11, _, 8, _], melRoot: 60, melWave: 'sawtooth', melVol: 0.04 }),
  });
  function sd0(bpm) { return 60 / bpm / 4; }
  CO.audio = new Audio();
})(window.CO);
