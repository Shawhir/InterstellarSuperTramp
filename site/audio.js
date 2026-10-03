// Interstellar SuperTramp: sound effects and a little chiptune soundtrack,
// all synthesised with the Web Audio API (no audio files).
// Exposes window.SuperTrampAudio.
(() => {
  'use strict';

  let ac = null, master, musicBus, sfxBus, noiseBuf;
  let musicOn = true, sfxOn = true;

  // iPhones mute web audio when the ring/silent switch is on unless the page
  // says it plays media ("playback"), as a video player would. iOS 17+.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }

  // iOS suspends or "interrupts" audio after a call, app switch or screen lock;
  // wake it up again on the next touch or when the page comes back.
  const wake = () => { if (ac && ac.state !== 'running' && !document.hidden) ac.resume().catch(() => {}); };
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));

  // Go fully quiet when the page is hidden (app switch, tab change, screen lock).
  // Otherwise iOS keeps "media" audio alive in the background while the browser
  // throttles the music timer, which comes out as stuttering notes.
  let musicWasPlaying = false;
  let dozing = false;
  // Heartbeat from the game loop. If frames stop (page closed, hidden or frozen
  // without telling us), the watchdog below silences everything.
  let lastBeat = performance.now();
  function beat() {
    lastBeat = performance.now();
    if (dozing && !document.hidden) { dozing = false; unsleep(); }
  }
  setInterval(() => {
    if (!dozing && ac && performance.now() - lastBeat > 600) { dozing = true; sleep(); }
  }, 250);
  function sleep() {
    musicWasPlaying = musicWasPlaying || music.playing;
    music.stop();
    if (burnNode) { try { burnNode.src.stop(); } catch (e) { /* already stopped */ } burnNode = null; }
    if (ac && ac.state === 'running') ac.suspend().catch(() => {});
    try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) { /* older iOS */ }
  }
  function unsleep() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
    if (ac && ac.state !== 'running') ac.resume().catch(() => {});
    if (musicWasPlaying) { musicWasPlaying = false; music.start(); }
  }
  // (listeners are attached at the bottom, once `music` exists)

  function init() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
    if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = 0.9;
    master.connect(comp).connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(master);
    // A space echo on the music, faded in as you leave the atmosphere.
    const delay = ac.createDelay(1); delay.delayTime.value = 0.33;
    const fb = ac.createGain(); fb.gain.value = 0.35;
    echo = ac.createGain(); echo.gain.value = 0;
    musicBus.connect(echo); echo.connect(delay); delay.connect(fb).connect(delay); delay.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  let echo = null;
  let burnNode = null;

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // One synth voice with an attack/decay envelope and optional pitch slide.
  function voice({ type = 'square', f, f1, t, dur, vol = 0.1, bus = sfxBus, attack = 0.005, vib = 0 }) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (vib) {
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 18; lg.gain.value = vib;
      lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise({ t, dur, vol = 0.1, bus = sfxBus, type = 'highpass', freq = 6000, freq1, q = 0.7 }) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const now = () => ac.currentTime + 0.005;
  const ok = () => ac && sfxOn;
  // Major pentatonic steps, so bounces climb a tune as you go higher.
  const PENTA = [0, 2, 4, 7, 9];
  const pentaNote = (base, i) => base + PENTA[i % 5] + 12 * Math.floor(i / 5);

  const sfx = {
    step() { if (!ok()) return; noise({ t: now(), dur: 0.04, vol: 0.05, type: 'bandpass', freq: 900 + Math.random() * 300, q: 2 }); },
    hop() { if (!ok()) return; const t = now(); voice({ f: 330, f1: 660, t, dur: 0.12, vol: 0.06 }); },
    boing(tier, speed) {
      if (!ok()) return;
      const t = now(), n = hz(pentaNote(52, tier));
      voice({ type: 'triangle', f: n * 0.5, f1: n * 2, t, dur: 0.32, vol: 0.2, vib: 30 });
      voice({ type: 'square', f: n, f1: n * 1.5, t, dur: 0.12, vol: 0.05 });
      voice({ type: 'sine', f: 140, f1: 45, t, dur: 0.18, vol: 0.35 });
      if (speed > 1.3) noise({ t: t + 0.03, dur: 0.35 / speed + 0.15, vol: 0.05 * speed, type: 'bandpass', freq: 600, freq1: 3000, q: 1.2 });
    },
    perfect() {
      if (!ok()) return;
      const t = now() + 0.06;
      [84, 88, 91].forEach((m, i) => voice({ type: 'square', f: hz(m), t: t + i * 0.05, dur: 0.18, vol: 0.05 }));
    },
    star(streak) {
      if (!ok()) return;
      const t = now(), base = 76 + Math.min(streak, 8) * 2;
      [0, 4, 7, 12].forEach((s, i) => voice({ type: 'square', f: hz(base + s), t: t + i * 0.045, dur: 0.12, vol: 0.05 }));
      voice({ type: 'triangle', f: hz(base + 24), t: t + 0.18, dur: 0.3, vol: 0.06 });
    },
    tier() {
      if (!ok()) return;
      const t = now() + 0.1;
      [[72, 76, 79], [74, 77, 81], [76, 79, 84]].forEach((ch, i) => ch.forEach((m) => voice({ type: 'square', f: hz(m), t: t + i * 0.1, dur: i === 2 ? 0.5 : 0.12, vol: 0.035 })));
    },
    fall() {
      if (!ok()) return;
      voice({ type: 'sine', f: 1400, f1: 220, t: now(), dur: 1.1, vol: 0.08, vib: 12 });
    },
    // Roar of re-entry; level 0..1, called every frame
    burn(level) {
      if (!ac) return;
      if (!burnNode) {
        if (level < 0.05) return;
        const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = noiseBuf; src.loop = true;
        f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 1.5;
        g.gain.value = 0;
        src.connect(f).connect(g).connect(sfxBus);
        src.start();
        burnNode = { src, f, g };
      }
      const t = ac.currentTime, v = sfxOn ? level * 0.35 : 0;
      burnNode.g.gain.setTargetAtTime(v, t, 0.05);
      burnNode.f.frequency.setTargetAtTime(300 + level * 1500, t, 0.08);
      if (level < 0.02) { const n = burnNode; burnNode = null; n.g.gain.setTargetAtTime(0, t, 0.05); n.src.stop(t + 0.4); }
    },
    // Geom pickup: a bright blip that climbs with the multiplier
    geom(m) {
      if (!ok()) return;
      const t = now(), n = 72 + Math.min(m, 30) * 0.7;
      voice({ type: 'square', f: hz(n), f1: hz(n + 12), t, dur: 0.08, vol: 0.05 });
      voice({ type: 'triangle', f: hz(n + 19), t: t + 0.04, dur: 0.1, vol: 0.05 });
    },
    multLost() {
      if (!ok()) return;
      const t = now();
      [76, 72, 67, 60].forEach((m, i) => voice({ type: 'square', f: hz(m), t: t + i * 0.07, dur: 0.1, vol: 0.05 }));
    },
    // Falling from space to Earth after the title
    whoosh() {
      if (!ok()) return;
      const t = now();
      noise({ t, dur: 2.4, vol: 0.22, type: 'bandpass', freq: 3200, freq1: 260, q: 1.4 });
      voice({ type: 'sine', f: 900, f1: 120, t, dur: 2.2, vol: 0.06, vib: 8 });
      voice({ type: 'sine', f: 70, f1: 40, t: t + 2.1, dur: 0.6, vol: 0.4 });
    },
    // Picking a mode: bright for Checkpoint, darker and tougher for Uber Tramp
    jingle(mode) {
      if (!ok()) return;
      const t = now();
      const notes = mode === 'uber' ? [57, 60, 63, 69, 68] : [67, 71, 74, 79, 83];
      notes.forEach((m, i) => voice({ type: 'square', f: hz(m), t: t + i * 0.08, dur: i === notes.length - 1 ? 0.35 : 0.1, vol: 0.06 }));
      voice({ type: 'triangle', f: hz(notes[0] - 12), t, dur: 0.5, vol: 0.12 });
    },
    // The being in the belt says hello in five notes: D E C, C an octave down, G
    hum() {
      if (!ok()) return;
      const t = now();
      [74, 76, 72, 60, 67].forEach((m, i) => voice({ type: 'sine', f: hz(m), t: t + i * 0.42, dur: i === 4 ? 0.9 : 0.38, vol: 0.12, attack: 0.04, vib: 3 }));
    },
    // Airlock: a heavy clunk and a hiss of air
    airlock() {
      if (!ok()) return;
      const t = now();
      voice({ type: 'sine', f: 90, f1: 45, t, dur: 0.3, vol: 0.5 });
      voice({ type: 'square', f: 180, f1: 120, t, dur: 0.08, vol: 0.06 });
      noise({ t: t + 0.08, dur: 0.9, vol: 0.2, type: 'highpass', freq: 2500, freq1: 5000 });
    },
    sizzle() {
      if (!ok()) return;
      noise({ t: now(), dur: 0.6, vol: 0.25, type: 'highpass', freq: 3000, freq1: 7000 });
    },
    boom(h = 1) {
      if (!ok()) return;
      const t = now();
      voice({ type: 'sine', f: 90, f1: 22, t, dur: 1.2, vol: 0.8 });
      voice({ type: 'triangle', f: 160, f1: 40, t, dur: 0.5, vol: 0.4 });
      noise({ t, dur: 1.4, vol: 0.5 * (0.6 + h * 0.4), type: 'lowpass', freq: 2500, freq1: 90, q: 0.5 });
      noise({ t: t + 0.05, dur: 0.25, vol: 0.3, type: 'bandpass', freq: 900, q: 0.6 });
    },
    thud() {
      if (!ok()) return;
      const t = now();
      voice({ type: 'sine', f: 110, f1: 35, t, dur: 0.35, vol: 0.5 });
      noise({ t, dur: 0.3, vol: 0.25, type: 'lowpass', freq: 1200, freq1: 150 });
    },
    win() {
      if (!ok()) return;
      const t = now();
      [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => voice({ type: 'square', f: hz(m), t: t + i * 0.13, dur: i === 6 ? 0.9 : 0.14, vol: 0.06 }));
      [48, 55, 60].forEach((m) => voice({ type: 'triangle', f: hz(m), t: t + 0.78, dur: 1.2, vol: 0.12 }));
    },
  };

  // ---- Music ---------------------------------------------------------------
  // Four-bar loops in 16th notes. The mood follows your altitude: a bouncy
  // major tune near Earth, a brighter lead in the sky, a dreamy minor drift in space.
  const PROGS = {
    earth: [[48, [60, 64, 67]], [43, [59, 62, 67]], [45, [57, 60, 64]], [41, [57, 60, 65]]], // C G Am F
    sky: [[41, [57, 60, 65]], [43, [59, 62, 67]], [48, [60, 64, 67]], [45, [57, 60, 64]]],   // F G C Am
    space: [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [60, 64, 67]], [43, [55, 59, 62]]], // Am F C G
  };
  // Lead phrases as chord-tone indexes per 8th note (-1 rest).
  const LEAD = [
    [0, -1, 1, 2, -1, 1, 0, -1],
    [2, -1, 1, -1, 0, 1, 2, 3],
    [3, 2, -1, 1, 0, -1, 1, -1],
    [0, 1, 2, -1, 3, -1, 2, 1],
  ];

  const music = {
    playing: false, step: 0, next: 0, timer: null,
    mood: 'earth', speed: 1, space: 0, intensity: 0,
    start() {
      if (!ac || this.playing || document.hidden) return;
      this.playing = true; this.step = 0; this.next = ac.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 25);
    },
    stop() { this.playing = false; clearInterval(this.timer); this.timer = null; },
    set({ tierF = 0, speed = 1, won = false }) {
      this.mood = won ? 'space' : tierF < 4.5 ? 'earth' : tierF < 9 ? 'sky' : 'space';
      this.speed = speed;
      this.space = Math.max(0, Math.min(1, (tierF - 8) / 4));
      this.intensity = won ? 0 : Math.min(1, tierF / 9);
      if (echo) echo.gain.setTargetAtTime(this.space * 0.8, ac.currentTime, 0.5);
    },
    tick() {
      if (document.hidden || performance.now() - lastBeat > 600) { sleep(); dozing = true; return; }
      if (!musicOn) { this.next = ac.currentTime + 0.05; return; }
      const bpm = 112 + (this.speed - 1) * 40 - this.space * 12;
      const sixteenth = 60 / bpm / 4;
      // If the timer was paused (background, throttling), skip the missed notes
      // instead of cramming them all in at once, which sounds like stuttering.
      if (this.next < ac.currentTime - 0.05) this.next = ac.currentTime + 0.05;
      while (this.next < ac.currentTime + 0.12) {
        this.play(this.step, this.next, sixteenth);
        this.next += sixteenth;
        this.step = (this.step + 1) % 64;
      }
    },
    play(step, t, len) {
      const bar = Math.floor(step / 16), s = step % 16;
      const [root, chord] = PROGS[this.mood][bar];
      const space = this.mood === 'space';
      const b = musicBus;
      // Bass
      if (!space && [0, 3, 6, 8, 10, 14].includes(s)) voice({ type: 'triangle', f: hz(root - (s === 10 ? -7 : 0)), t, dur: len * 1.8, vol: 0.32, bus: b });
      if (space && s === 0) voice({ type: 'triangle', f: hz(root), t, dur: len * 14, vol: 0.28, bus: b, attack: 0.2 });
      // Arpeggio
      const arp = chord[[0, 1, 2, 1][s % 4]] + (s >= 8 ? 12 : 0);
      if (!space || s % 2 === 0) voice({ type: space ? 'sine' : 'square', f: hz(arp), t, dur: len * (space ? 3 : 0.9), vol: space ? 0.07 : 0.035, bus: b, attack: space ? 0.03 : 0.004 });
      // Lead melody in the sky
      if (this.mood === 'sky' && s % 2 === 0) {
        const idx = LEAD[bar][s / 2];
        if (idx >= 0) voice({ type: 'square', f: hz(chord[idx % 3] + 12 * (idx === 3 ? 2 : 1)), t, dur: len * 1.8, vol: 0.045, bus: b, vib: 4 });
      }
      // Drums
      if (!space) {
        if (s === 0 || s === 8 || (this.intensity > 0.4 && s === 11)) voice({ type: 'sine', f: 150, f1: 40, t, dur: 0.15, vol: 0.6, bus: b });
        if (s === 4 || s === 12) noise({ t, dur: 0.12, vol: 0.18, bus: b, type: 'bandpass', freq: 1800, q: 0.8 });
      }
      if (s % 2 === 1 || (this.intensity > 0.6 && !space)) noise({ t, dur: 0.03, vol: space ? 0.03 : 0.06, bus: b, type: 'highpass', freq: 8000 });
    },
  };

  document.addEventListener('visibilitychange', () => (document.hidden ? sleep() : unsleep()));
  window.addEventListener('pagehide', sleep);
  window.addEventListener('pageshow', () => { if (!document.hidden) unsleep(); });

  window.addEventListener('freeze', sleep);
  window.addEventListener('blur', () => { if (document.hidden) sleep(); });

  window.SuperTrampAudio = {
    init,
    beat,
    sfx,
    music,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    toggleMusic() { musicOn = !musicOn; return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; return sfxOn; },
  };
})();
