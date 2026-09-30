// Interstellar SuperTramp
// The tramp walks on the spot at the top of the world; the planet (and everything
// on or above it) turns underneath. Positions are polar around Earth's centre:
// an object at angle `a` and radius `R` appears at screen angle a + theta, where
// theta is how far the world has turned. The player is always at angle 0 (the top).
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const hud = { alt: $('alt'), layer: $('layer'), stars: $('stars'), toast: $('toast'), music: $('music'), sfx: $('sfx'), tilt: $('tilt') };

  // ---- Tuning ---------------------------------------------------------------
  const R0 = 480;           // Earth radius in pixels
  const G = 1500;           // gravity, px/s^2
  const TIER_GAP = 250;     // height between bouncy layers
  const WALK = 210;         // walking speed on the ground, px/s
  const AIR = 300;          // steering speed in the air, px/s
  const HOP_V = 560;        // a hop clears about 100px, enough to reach a trampoline
  const OVERSHOOT = 120;    // each bounce peaks this far above the next layer
  const SCALE = 3;          // sprite pixel size

  // Real altitudes for each bouncy layer (km). The game squashes the distances,
  // the altimeter tells the truth.
  const TIERS = [
    { km: 0, type: 'trampoline', layer: 'Ground' },
    { km: 1, type: 'cloud', layer: 'Troposphere', note: 'Troposphere. All our weather happens down here.' },
    { km: 3, type: 'cloud', layer: 'Troposphere' },
    { km: 6, type: 'cloud', layer: 'Troposphere' },
    { km: 11, type: 'cloud', layer: 'Troposphere', note: 'Clouds run out at about 12 km.' },
    { km: 18, type: 'balloon', layer: 'Stratosphere', note: 'Stratosphere. The ozone layer lives up here.' },
    { km: 28, type: 'balloon', layer: 'Stratosphere' },
    { km: 40, type: 'balloon', layer: 'Stratosphere', note: 'Weather balloons burst at around 40 km.' },
    { km: 80, type: 'nlc', layer: 'Mesosphere', note: 'Noctilucent clouds: the highest clouds on Earth, 80 km up.' },
    { km: 100, type: 'satellite', layer: 'Thermosphere', note: 'The Kármán line, 100 km. You are officially in space.' },
    { km: 200, type: 'satellite', layer: 'Thermosphere' },
    { km: 408, type: 'station', layer: 'Thermosphere', note: 'The International Space Station orbits at 408 km.' },
    { km: 2000, type: 'satellite', layer: 'Low Earth orbit', note: 'Low Earth orbit ends around 2,000 km.' },
    { km: 20200, type: 'satellite', layer: 'Medium Earth orbit', note: 'GPS satellites circle at 20,200 km.' },
    { km: 35786, type: 'satellite', layer: 'Geostationary orbit', note: 'Geostationary orbit, 35,786 km. One lap per day.' },
    { km: 150000, type: 'asteroid', layer: 'Deep space', note: 'Deep space. Nearly there.' },
    { km: 384400, type: 'moon', layer: 'The Moon' },
  ];
  const TOP = TIERS.length - 1;
  const WIDTH = { trampoline: 70, cloud: 130, balloon: 80, nlc: 120, satellite: 96, station: 150, asteroid: 84, moon: 220 };
  const MOON_R = 110; // the landing Moon's radius; its top is the last bouncy surface
  const tierR = (k) => R0 + 30 + k * TIER_GAP;
  // Difficulty: each step up the bouncing gets faster, from 1.01x on the first
  // trampoline to 2x by the last jump before the Moon. Heights stay the same;
  // gravity and bounce speed scale together so you get less time to steer.
  const HARD_START = 1.01, HARD_END = 2;
  const speedFor = (k) => HARD_START * Math.pow(HARD_END / HARD_START, clamp(k, 0, TOP - 1) / (TOP - 1));
  const bounceFor = (k) => speedFor(k) * Math.sqrt(2 * G * (tierR(k + 1) - tierR(k) + OVERSHOOT));

  // ---- Pixel sprite -----------------------------------------------------------
  const PAL = { h: '#e0433b', k: '#1b1530', s: '#f2c29b', y: '#ffd23f', c: '#3f6fd8', p: '#6b5040', b: '#2a2230' };
  const HEAD = ['....hhhh....', '...hhhhhh...', '..kkkkkkkk..', '...ssssss...', '...ssksssk..', '...sssssss..', '..yyyyyyyy..'];
  const BODY = ['yy.cccccccc.', '.scccccccccs', '..cccccccc..'];
  const BODY_UP = ['s.cccccccc.s', 'y.cccccccc..', '..cccccccc..'];
  const LEGS = {
    stand: ['..pppppppp..', '..ppp..ppp..', '..ppp..ppp..', '..ppp..ppp..', '..bbbb.bbbb.', '............'],
    walk1: ['..pppppppp..', '.ppp....ppp.', '.ppp....ppp.', 'ppp......ppp', 'bbbb....bbbb', '............'],
    walk2: ['..pppppppp..', '...pppppp...', '....pppp....', '....pppp....', '....bbbbbb..', '............'],
    tuck: ['..pppppppp..', '..ppp..ppp..', '.bbbb..bbbb.', '............', '............', '............'],
  };
  const FRAMES = {
    stand: [...HEAD, ...BODY, ...LEGS.stand],
    walk1: [...HEAD, ...BODY, ...LEGS.walk1],
    walk2: [...HEAD, ...BODY, ...LEGS.walk2],
    jump: [...HEAD, ...BODY_UP, ...LEGS.tuck],
  };
  const WALK_CYCLE = ['walk1', 'stand', 'walk2', 'stand'];

  function drawSprite(frame, x, y, flip, sy, sx = 1, alpha = 1) {
    const rows = FRAMES[frame];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(flip ? -sx : sx, sy);
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        ctx.fillStyle = PAL[ch];
        ctx.fillRect((i - 6) * SCALE, (j - 15) * SCALE, SCALE, SCALE);
      }
    }
    ctx.restore();
  }

  // ---- Helpers --------------------------------------------------------------
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const TAU = Math.PI * 2;
  const wrap = (x) => { x = (x + Math.PI) % TAU; if (x < 0) x += TAU; return x - Math.PI; };
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
  const lerp = (a, b, t) => a + (b - a) * t;
  function mix(c1, c2, t) {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
  }

  // ---- World ----------------------------------------------------------------
  let world;

  function buildWorld(seed) {
    const rnd = mulberry32(seed);
    const plats = [];
    const stars = [];
    const mk = (tier, a) => {
      const type = TIERS[tier].type;
      const p = { tier, a, a0: a, type, R: tierR(tier), w: WIDTH[type], bounce: bounceFor(tier), squash: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU };
      if (type === 'satellite' || type === 'station' || type === 'asteroid') {
        // Orbiting things sway back and forth so they never drift out of reach for good.
        p.sway = (30 + rnd() * 40) / p.R;
        p.freq = 0.35 + rnd() * 0.35;
        p.phase = rnd() * TAU;
      }
      plats.push(p);
      return p;
    };

    [0.36, 0.36 + 2.1, 0.36 + 4.2].forEach((a) => mk(0, a));
    let prevA = 0.36;
    for (let k = 1; k <= TOP; k++) {
      const R = tierR(k);
      if (TIERS[k].type === 'moon') {
        // Off to one side of the last asteroid, so you rise past it and drop on top.
        mk(k, prevA + ((170 * (rnd() < 0.5 ? -1 : 1)) / R));
        break;
      }
      // Faster bounces mean less air time, so keep the gap reachable.
      const off = (100 + (rnd() * 210) / Math.sqrt(speedFor(k - 1))) * (rnd() < 0.5 ? -1 : 1);
      const a = prevA + off / R;
      mk(k, a);
      // A star on the natural arc between the last layer and this one.
      stars.push({ a: prevA + (a - prevA) * 0.62, R: R + 50, taken: false });
      // Spare platforms off to the side, some carrying a bonus star.
      const extras = k < 9 ? 2 : 1;
      for (let i = 0; i < extras; i++) {
        const ea = a + ((360 + rnd() * 420) * (i % 2 ? -1 : 1)) / R;
        mk(k, ea);
        if (rnd() < 0.55) stars.push({ a: ea, R: R + 150, taken: false });
      }
      prevA = a;
    }
    stars.forEach((s, i) => { s.id = i; });

    const decor = [];
    for (let i = 0; i < 46; i++) {
      const r = rnd();
      decor.push({ a: rnd() * TAU, kind: r < 0.45 ? 'tree' : r < 0.65 ? 'house' : r < 0.85 ? 'flower' : 'rock', hue: Math.floor(rnd() * 4), size: 0.8 + rnd() * 0.5 });
    }
    const crust = [];
    for (let i = 0; i < 90; i++) {
      const r = rnd();
      crust.push({ a: rnd() * TAU, rf: 0.905 + rnd() * 0.08, kind: r < 0.55 ? 'rock' : r < 0.75 ? 'gem' : r < 0.9 ? 'fossil' : 'bone', hue: Math.floor(rnd() * 3) });
    }
    const swirls = [];
    for (let i = 0; i < 26; i++) swirls.push({ a: rnd() * TAU, rf: 0.6 + rnd() * 0.26, len: 0.15 + rnd() * 0.3 });
    // Mountain ranges behind the ground, farthest first:
    // [sideways parallax, vertical parallax, colour, snow, tallest peak]
    const ranges = [
      [0.3, 0.55, '#cdd8ee', '#ffffff', 250],
      [0.42, 0.64, '#b3c3e2', '#f5f8ff', 205],
      [0.55, 0.74, '#9fb4d8', '#eef3ff', 160],
      [0.72, 0.84, '#7f9bc2', '#e3ebf8', 115],
      [0.88, 0.93, '#4d7a6e', null, 60],
    ].map(([f, sink, col, snow, hMax]) => {
      const n = 480, h = new Array(n).fill(0);
      const peaks = 26 + Math.floor(rnd() * 10);
      for (let i = 0; i < peaks; i++) {
        const c = rnd() * n, width = 8 + rnd() * 22, height = hMax * (0.35 + rnd() * 0.65);
        for (let j = -Math.ceil(width); j <= Math.ceil(width); j++) {
          const idx = (Math.round(c) + j + n) % n;
          h[idx] = Math.max(h[idx], height * (1 - Math.abs(j) / width));
        }
      }
      return { f, sink, col, snow, hMax, h: h.map((v) => Math.round(v / 4) * 4) };
    });
    const sky = [];
    for (let i = 0; i < 170; i++) sky.push({ x: rnd(), y: rnd(), s: rnd() < 0.15 ? 2 : 1, tw: rnd() * TAU });

    return { seed, plats, stars, decor, crust, swirls, sky, ranges };
  }

  // ---- State ----------------------------------------------------------------
  const player = { r: R0, vr: 0, vx: 0, onGround: true, facing: 1, walkT: 0, squash: 0, speed: 1 };
  let theta = 0;
  let lastTier = -1;
  let bestTier = -1;
  let state = 'title';
  let playTime = 0;
  let particles = [];
  let cam = { r: R0, anchor: 0 };
  let toastTimer = 0;
  let clock = 0;
  // Juice: screen shake, landing rings, floating text, afterimages, banners
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shake = 0;
  let fx = { rings: [], pops: [], trail: [], trailT: 0, banner: null, flash: 0, streak: 0, whistled: false, shooting: [], shootT: 2 };
  const tilt = { on: false, axis: 0, zero: null, got: false };

  const keys = { left: false, right: false };
  const touch = window.matchMedia('(pointer: coarse)').matches;
  let jumpBuffer = 0;

  function reset(seed) {
    world = buildWorld(seed);
    Object.assign(player, { r: R0, vr: 0, vx: 0, onGround: true, facing: 1, walkT: 0, squash: 0, speed: 1 });
    theta = 0; lastTier = -1; bestTier = -1; playTime = 0; particles = [];
    fx = { rings: [], pops: [], trail: [], trailT: 0, banner: null, flash: 0, streak: 0, whistled: false, shooting: [], shootT: 2 };
    cam.r = R0;
    updateStarsHud();
  }

  // ---- Sound (see audio.js) ------------------------------------------------
  const snd = window.SuperTrampAudio;
  const sfx = snd ? snd.sfx : new Proxy({}, { get: () => () => {} });

  // ---- Toasts & HUD ---------------------------------------------------------
  function toast(text, secs = 3.6) {
    hud.toast.textContent = text;
    hud.toast.hidden = false;
    hud.toast.style.opacity = '1';
    toastTimer = secs;
  }
  function updateStarsHud(popIt) {
    const got = world.stars.filter((s) => s.taken).length;
    hud.stars.textContent = `★ ${got} / ${world.stars.length}`;
    if (popIt) { hud.stars.classList.remove('pop'); void hud.stars.offsetWidth; hud.stars.classList.add('pop'); }
  }
  function kmAt(r) {
    if (r <= R0) return 0;
    const pts = [[R0, 0]];
    for (let k = 1; k <= TOP; k++) pts.push([tierR(k), TIERS[k].km]);
    if (r >= pts[pts.length - 1][0]) return TIERS[TOP].km;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ra, ka] = pts[i], [rb, kb] = pts[i + 1];
      if (r <= rb) {
        const t = (r - ra) / (rb - ra);
        return Math.pow(10, lerp(Math.log10(ka + 1), Math.log10(kb + 1), t)) - 1;
      }
    }
    return 0;
  }
  function fmtKm(km) {
    if (km < 1) return `${Math.round(km * 1000).toLocaleString('en-GB')} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km).toLocaleString('en-GB')} km`;
  }
  function tierFloat(r) {
    if (r <= tierR(0)) return 0;
    const f = (r - tierR(0)) / TIER_GAP;
    return clamp(f, 0, TOP);
  }
  function layerName() {
    if (player.onGround) return lastTier === TOP ? 'On the Moon' : 'On the ground';
    const k = Math.floor(tierFloat(player.r));
    return k === 0 ? 'Troposphere' : TIERS[k].layer;
  }

  // ---- Targeting: which bouncy thing should we aim for? ---------------------
  function findTarget() {
    let tier = Math.min(lastTier + 1, TOP);
    if (player.vr < 0 && player.r < tierR(tier) - 2) {
      // Fell short: aim for the highest layer still below us.
      tier = -1;
      for (let k = TOP; k >= 0; k--) if (tierR(k) < player.r) { tier = k; break; }
      if (tier < 0) tier = 0;
    }
    let best = null, bestD = Infinity;
    for (const p of world.plats) {
      if (p.tier !== tier) continue;
      const d = wrap(p.a + theta) * p.R;
      if (Math.abs(d) < Math.abs(bestD)) { best = p; bestD = d; }
    }
    return best ? { p: best, d: bestD, lined: Math.abs(bestD) <= best.w / 2 + 4 } : null;
  }

  // ---- Particles ------------------------------------------------------------
  function burst(a, R, color, n, speed = 160) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI;
      particles.push({ a, R, vt: Math.cos(ang) * speed * (0.4 + Math.random()), vr: Math.sin(ang) * speed * (0.4 + Math.random()), life: 0.5 + Math.random() * 0.4, color, size: 2 + Math.floor(Math.random() * 3) * 2 });
    }
  }
  const addShake = (n) => { if (!reduceMotion) shake = Math.max(shake, n); };
  const ring = (a, R, color, size = 1) => fx.rings.push({ a, R, t: 0, color, size });
  const pop = (text, color, R = player.r + 70) => fx.pops.push({ a: -theta, R, text, color, t: 0 });
  const banner = (text, sub) => { fx.banner = { text, sub, t: 0 }; };

  // ---- Update ---------------------------------------------------------------
  function land(p) {
    const off = Math.abs(wrap(p.a + theta) * p.R);
    player.r = p.R;
    p.squash = 1;
    player.squash = 1;
    fx.whistled = false;
    if (p.type === 'moon') {
      player.vr = 0; player.onGround = true;
      lastTier = TOP; bestTier = TOP;
      win();
      return;
    }
    player.vr = p.bounce;
    player.speed = speedFor(p.tier);
    const climbed = p.tier > lastTier;
    lastTier = p.tier;
    sfx.boing(p.tier, player.speed);
    const puff = p.type === 'cloud' || p.type === 'balloon' || p.type === 'nlc' ? '#ffffff' : '#ffd23f';
    burst(-theta, p.R, puff, 12, 200);
    ring(-theta, p.R, puff);
    addShake(2 + player.speed * 1.5);
    if (off < 10 && p.tier > 0) {
      pop('PERFECT!', '#52e07a');
      sfx.perfect();
      burst(-theta, p.R, '#52e07a', 10, 260);
      ring(-theta, p.R, '#52e07a', 1.6);
    }
    if (p.tier > bestTier) {
      bestTier = p.tier;
      fx.streak = climbed ? fx.streak + 1 : 1;
      if (fx.streak >= 3) pop(`${fx.streak} IN A ROW`, '#ffab3d', player.r + 100);
      const prevLayer = p.tier > 0 ? TIERS[p.tier - 1].layer : null;
      if (p.tier > 0 && TIERS[p.tier].layer !== prevLayer) {
        banner(TIERS[p.tier].layer.toUpperCase(), fmtKm(TIERS[p.tier].km));
        sfx.tier();
        fx.flash = 0.35;
      }
      if (TIERS[p.tier].note) toast(TIERS[p.tier].note);
      else if (p.tier === 0) toast('Boing! Steer toward the arrow to reach the clouds.');
    }
  }

  function update(dt) {
    clock += dt;
    for (const p of world.plats) {
      if (p.sway) p.a = p.a0 + p.sway * Math.sin(clock * p.freq + p.phase);
      p.squash = Math.max(0, p.squash - dt * 4);
    }

    if (state === 'title') {
      // Attract mode: stroll along so the world turns behind the title card.
      player.vx = 80; player.facing = 1;
      theta -= (player.vx * dt) / player.r;
      player.walkT += dt * 5;
    } else if (state === 'play') {
      playTime += dt;
      const kdir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const dir = kdir !== 0 ? kdir : tilt.on ? tilt.axis : 0;
      if (Math.abs(dir) > 0.1) player.facing = Math.sign(dir);
      const sp = player.speed;
      const maxV = player.onGround ? WALK : AIR * Math.sqrt(sp);
      player.vx = approach(player.vx, dir * maxV, (player.onGround ? 1800 : 1200 * sp) * dt);
      theta -= (player.vx * dt) / player.r;
      if (player.onGround && Math.abs(player.vx) > 5) {
        const before = Math.floor(player.walkT);
        player.walkT += dt * (Math.abs(player.vx) / 22);
        if (Math.floor(player.walkT) !== before && Math.floor(player.walkT) % 2 === 0) {
          sfx.step();
          burst(-theta, R0, '#c9a27a', 2, 50);
        }
      }

      jumpBuffer -= dt;
      if (player.onGround && jumpBuffer > 0) {
        player.vr = HOP_V; player.speed = 1; player.onGround = false; jumpBuffer = 0;
        player.squash = -0.6;
        sfx.hop();
        burst(-theta, R0, '#c9a27a', 5, 80);
      }
      if (!player.onGround) {
        const prev = player.r;
        player.vr = Math.max(player.vr - G * player.speed * player.speed * dt, -1600 * player.speed);
        player.r += player.vr * dt;
        if (player.vr < 0) {
          for (const p of world.plats) {
            if (prev >= p.R && player.r <= p.R && Math.abs(wrap(p.a + theta) * p.R) <= p.w / 2 + 8) { land(p); break; }
          }
        }
        // Missed: whistle on the way down
        if (!fx.whistled && lastTier >= 0 && player.vr < -500 && player.r < tierR(lastTier) - 40) {
          fx.whistled = true; fx.streak = 0; sfx.fall();
        }
        if (state === 'play' && player.r <= R0) {
          const hard = player.vr < -900;
          player.r = R0; player.vr = 0; player.onGround = true; player.squash = 1;
          if (lastTier >= 0) { toast('Back on solid ground. Find a trampoline!'); sfx.thud(); addShake(hard ? 12 : 6); ring(-theta, R0, '#c9a27a', 1.4); }
          lastTier = -1; fx.streak = 0; fx.whistled = false;
          burst(-theta, R0, '#8a5a3b', hard ? 18 : 8, hard ? 180 : 90);
        }
      }

      // Stars
      const bodyR = player.r + 24;
      for (const s of world.stars) {
        if (s.taken) continue;
        const ph = s.a + theta;
        const dx = s.R * Math.sin(ph), dy = s.R * Math.cos(ph) - bodyR;
        if (dx * dx + dy * dy < 30 * 30) {
          s.taken = true;
          const got = world.stars.filter((q) => q.taken).length;
          sfx.star(got);
          burst(s.a, s.R, '#ffd23f', 18, 170);
          ring(s.a, s.R, '#ffd23f', 0.8);
          fx.pops.push({ a: s.a, R: s.R + 20, text: '+1 ★', color: '#ffd23f', t: 0 });
          updateStarsHud(true);
        }
      }
    }

    player.squash = player.squash > 0 ? Math.max(0, player.squash - dt * 5) : Math.min(0, player.squash + dt * 4);
    shake = Math.max(0, shake - dt * 30);
    fx.flash = Math.max(0, fx.flash - dt * 1.5);
    for (const r of fx.rings) r.t += dt;
    fx.rings = fx.rings.filter((r) => r.t < 0.5);
    for (const q of fx.pops) q.t += dt;
    fx.pops = fx.pops.filter((q) => q.t < 1.1);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 2.6) fx.banner = null; }
    // Afterimages while moving fast through the air
    fx.trailT -= dt;
    if (!player.onGround && Math.abs(player.vr) > 350 && fx.trailT <= 0) {
      fx.trailT = 0.022;
      fx.trail.push({ a: -theta, r: player.r, flip: player.facing < 0, life: 0.16 });
    }
    for (const g of fx.trail) g.life -= dt;
    fx.trail = fx.trail.filter((g) => g.life > 0);
    // Shooting stars in space
    fx.shootT -= dt;
    if (fx.shootT <= 0) {
      fx.shootT = 1.2 + Math.random() * 2.5;
      fx.shooting.push({ x: Math.random(), y: Math.random() * 0.5, t: 0, dir: Math.random() < 0.5 ? -1 : 1 });
    }
    for (const q of fx.shooting) q.t += dt;
    fx.shooting = fx.shooting.filter((q) => q.t < 0.9);
    if (snd) snd.music.set({ tierF: tierFloat(player.r), speed: player.speed, won: state === 'won' });
    for (const q of particles) {
      q.R += q.vr * dt; q.a += (q.vt * dt) / q.R; q.vr -= 380 * dt; q.life -= dt;
    }
    particles = particles.filter((q) => q.life > 0);

    // Camera: follow height, and look further down while falling.
    cam.r += (player.r - cam.r) * Math.min(1, dt * 7);
    const want = player.vr < -250 ? 0.34 : 0.46;
    cam.anchor = lerp(cam.anchor || want, want, Math.min(1, dt * 2));

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0.4) hud.toast.style.opacity = '0';
      if (toastTimer <= 0) hud.toast.hidden = true;
    }
    hud.alt.textContent = fmtKm(kmAt(player.r));
    hud.layer.textContent = player.onGround || state !== 'play' ? layerName() : `${layerName()} ×${player.speed.toFixed(2)}`;
  }

  // ---- Drawing --------------------------------------------------------------
  let W = 0, H = 0, cx = 0, cy = 0;
  let lastSize = '';
  // Phones can report the old size when the rotation event fires, which leaves a
  // stretched canvas. Checking every frame catches the real size as soon as it lands.
  function checkSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (`${canvas.clientWidth}x${canvas.clientHeight}x${dpr}` !== lastSize) resize();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    lastSize = `${cw}x${ch}x${dpr}`;
    // Zoom out on narrow or short screens (phones, landscape) so the next
    // platform is usually in view.
    const zoom = clamp(Math.min(cw / 560, ch / 640), 0.55, 1);
    W = cw / zoom; H = ch / zoom;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  const onScreen = (x, y, m = 220) => x > -m && x < W + m && y > -m && y < H + m;
  function at(phi, R, fn, margin) {
    const x = cx + R * Math.sin(phi), y = cy - R * Math.cos(phi);
    if (!onScreen(x, y, margin)) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(phi); fn(); ctx.restore();
  }
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function drawSky() {
    const s = clamp((player.r - R0) / (tierR(9) - R0), 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix('#58b4f0', '#03040c', s));
    g.addColorStop(1, mix('#d4f0ff', '#101634', Math.min(1, s * 1.1)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawSun(s);
    drawSkyMoon();
    drawAurora();
    drawFarClouds(s);
    const alpha = clamp((s - 0.25) / 0.5, 0, 1);
    if (alpha <= 0) return;
    for (const q of fx.shooting) {
      const k = q.t / 0.9, x = (q.x + q.dir * k * 0.5) * W, y = (q.y + k * 0.25) * H;
      ctx.strokeStyle = `rgba(255,255,255,${alpha * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - q.dir * 60, y - 30); ctx.stroke();
    }
    for (const st of world.sky) {
      let x = (st.x * W - theta * 260) % W; if (x < 0) x += W;
      const tw = 0.6 + 0.4 * Math.sin(clock * 2 + st.tw);
      ctx.globalAlpha = alpha * tw;
      px(x, st.y * H, st.s, st.s, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(s) {
    const x = W * 0.16, y = H * 0.16 + s * 20;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 90);
    glow.addColorStop(0, `rgba(255,240,170,${0.9 - s * 0.3})`);
    glow.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 90, y - 90, 180, 180);
    ctx.save(); ctx.translate(x, y); ctx.rotate(clock * 0.2);
    for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); px(-2, 26 + (i % 2) * 4, 4, 10, 'rgba(255,230,140,0.8)'); }
    ctx.restore();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
  }

  // The Moon is one object for the whole climb: a small disc in the sky near
  // Earth that grows as you go up, and over the last few layers glides into
  // its real place in the world, where you land on it.
  function moonView() {
    const p = world.plats.find((q) => q.type === 'moon');
    if (!p) return null;
    const tf = tierFloat(player.r);
    const phi = wrap(p.a + theta);
    // Sky position: drifts left or right with the direction the Moon really lies.
    const f = tf / TOP;
    const rS = 8 + Math.pow(f, 1.6) * 70;
    const xS = W / 2 + clamp(phi / (Math.PI / 2), -1, 1) * W * 0.3;
    const yS = H * 0.14 + rS * 0.3;
    // World position: centre sits MOON_R below the landing surface.
    const rc = p.R - MOON_R;
    const xW = cx + rc * Math.sin(phi), yW = cy - rc * Math.cos(phi);
    const k = clamp((tf - 11) / (TOP - 0.6 - 11), 0, 1);
    const t = k * k * (3 - 2 * k); // smoothstep
    const r = lerp(rS, MOON_R, t);
    // If its real spot is off screen, keep it peeking in from that edge so it
    // never disappears; walk that way and it slides into its true position.
    const peek = r * 0.55;
    const xT = clamp(xW, peek - r, W - peek + r), yT = clamp(yW, peek - r, H - peek + r);
    return { p, phi, t, x: lerp(xS, xT, t), y: lerp(yS, yT, t), r, alpha: lerp(0.55 + f * 0.45, 1, t) };
  }

  function drawSkyMoon() {
    const m = moonView();
    if (!m) return;
    const { x, y, r } = m;
    ctx.globalAlpha = m.alpha;
    const glow = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.6);
    glow.addColorStop(0, 'rgba(230,228,240,0.35)');
    glow.addColorStop(1, 'rgba(230,228,240,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e6e4ec'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c3c0cc';
    for (const [cxo, cyo, cr] of [[-0.3, -0.2, 0.22], [0.35, 0.25, 0.15], [0.05, 0.5, 0.18], [-0.45, 0.35, 0.1], [0.4, -0.4, 0.09]]) {
      ctx.beginPath(); ctx.arc(x + cxo * r, y + cyo * r, cr * r, 0, TAU); ctx.fill();
    }
    // Shadow on the lower edge gives it a round, solid feel up close
    ctx.fillStyle = 'rgba(80,70,110,0.18)';
    ctx.beginPath(); ctx.arc(x, y, r, 0.1 * Math.PI, 0.9 * Math.PI); ctx.arc(x, y - r * 0.25, r * 0.9, 0.85 * Math.PI, 0.15 * Math.PI, true); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawAurora() {
    // Northern-lights curtains between the mesosphere and low orbit.
    const tf = tierFloat(player.r);
    const a = clamp(1 - Math.abs(tf - 10) / 3.5, 0, 1);
    if (a <= 0) return;
    const bands = [['rgba(90,255,170,', 0.18, 0], ['rgba(170,110,255,', 0.3, 2]];
    for (const [col, yf, ph] of bands) {
      for (let x = 0; x < W; x += 6) {
        const wave = Math.sin(x * 0.012 + clock * 0.8 + ph + theta * 3) * 22 + Math.sin(x * 0.031 - clock * 1.3) * 10;
        const h = 60 + Math.sin(x * 0.02 + clock + ph) * 25;
        const g = ctx.createLinearGradient(0, H * yf + wave, 0, H * yf + wave + h);
        g.addColorStop(0, col + '0)'); g.addColorStop(0.5, col + (0.35 * a) + ')'); g.addColorStop(1, col + '0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, H * yf + wave, 6, h);
      }
    }
  }

  function drawFarClouds(s) {
    const a = clamp(1 - s * 2.2, 0, 1);
    if (a <= 0) return;
    ctx.globalAlpha = 0.5 * a;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const span = W + 240;
      let x = ((i * 0.37 * span - theta * 90 + clock * 6) % span + span) % span - 120;
      let y = ((i * 0.53 % 1) * H * 0.6 + (cam.r - R0) * 0.12) % (H * 1.2);
      const r = 14 + (i % 3) * 6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU); ctx.arc(x + r, y - r * 0.4, r * 1.1, 0, TAU); ctx.arc(x + r * 2.2, y, r * 0.9, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSpeedLines() {
    const v = Math.abs(player.vr);
    if (v < 700 || reduceMotion) return;
    const a = clamp((v - 700) / 900, 0, 0.6);
    const dir = Math.sign(player.vr);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    for (let i = 0; i < 16; i++) {
      const x = ((i * 0.618 + 0.13) % 1) * W;
      if (Math.abs(x - W / 2) < 60) continue;
      const len = 20 + (v / 60) * ((i % 3) + 1) * 0.5;
      const y = (((i * 0.37 + clock * dir * (v / 700)) % 1) + 1) % 1 * (H + len) - len;
      ctx.fillRect(Math.round(x), Math.round(y), 2, len);
    }
  }

  function drawFx() {
    for (const r of fx.rings) {
      at(r.a + theta, r.R, () => {
        const k = r.t / 0.5;
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, (14 + k * 90) * r.size, (4 + k * 18) * r.size, 0, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }, 120);
    }
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const q of fx.pops) {
      at(q.a + theta, q.R + q.t * 50, () => {
        const k = q.t / 1.1;
        const sc = q.t < 0.15 ? 0.6 + (q.t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (q.t - 0.15));
        ctx.scale(sc, sc);
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = '#1b1530'; ctx.fillText(q.text, 2, 2);
        ctx.fillStyle = q.color; ctx.fillText(q.text, 0, 0);
        ctx.globalAlpha = 1;
      }, 80);
    }
    ctx.textAlign = 'start';
  }

  function drawBanner() {
    const b = fx.banner;
    if (!b) return;
    const inT = clamp(b.t / 0.35, 0, 1), outT = clamp((b.t - 2.1) / 0.5, 0, 1);
    const ease = 1 - Math.pow(1 - inT, 3);
    const x = W / 2 + (1 - ease) * -W + outT * W * 0.6, y = H * 0.27;
    ctx.globalAlpha = 1 - outT;
    ctx.fillStyle = 'rgba(11,15,38,0.7)';
    ctx.fillRect(0, y - 34, W, 58);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, y - 34, W, 3); ctx.fillRect(0, y + 21, W, 3);
    ctx.textAlign = 'center';
    ctx.font = `${W < 480 ? 14 : 20}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#1b1530'; ctx.fillText(b.text, x + 3, y + 3);
    ctx.fillStyle = '#eef1ff'; ctx.fillText(b.text, x, y);
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd23f'; ctx.fillText(b.sub, x, y + 15);
    ctx.textAlign = 'start';
    ctx.globalAlpha = 1;
  }

  function drawMountains() {
    // Distant ranges sink more slowly than the ground as you climb, so going up
    // reveals more and more of the mountains behind. They fade out into the haze
    // (and then the dark) on the way to space.
    const tf = tierFloat(player.r);
    const fade = clamp(1 - (tf - 3) / 4, 0, 1);
    if (fade <= 0) return;
    const skyS = clamp((player.r - R0) / (tierR(9) - R0), 0, 1);
    const haze = mix('#58b4f0', '#03040c', skyS).match(/\d+/g).map(Number);
    const tint = (hex, k) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return `rgb(${c.map((v, i) => Math.round(lerp(v, haze[i], k))).join(',')})`;
    };
    const climb = cam.r - R0;
    ctx.globalAlpha = fade;
    world.ranges.forEach((m, depth) => {
      const my = cy - climb * (1 - m.sink); // this range's own centre, lifted by parallax
      if (my - R0 - m.hMax > H + 20) return;
      const n = m.h.length;
      const rot = theta * m.f;
      const hazeK = (1 - m.sink) * 0.7 + skyS * 0.5;
      const pt = (i) => {
        const a = (i / n) * TAU + rot;
        const r = R0 - 6 + m.h[i % n];
        return [cx + r * Math.sin(a), my - r * Math.cos(a)];
      };
      const span = Math.min(n / 2, Math.ceil((n * (W / 2 + 260)) / (TAU * R0)));
      const mid = Math.round((((-rot / TAU) % 1) + 1) % 1 * n);
      ctx.fillStyle = tint(m.col, hazeK);
      ctx.beginPath();
      for (let i = mid - span; i <= mid + span; i++) {
        const [x, y] = pt((i + n) % n);
        i === mid - span ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      // Close the shape well below the screen so nothing shows through underneath.
      ctx.lineTo(W + 400, Math.max(my, H + 400));
      ctx.lineTo(-400, Math.max(my, H + 400));
      ctx.closePath();
      ctx.fill();
      if (m.snow) {
        ctx.fillStyle = tint(m.snow, hazeK * 0.6);
        for (let i = mid - span; i <= mid + span; i++) {
          const k = (i + n) % n;
          if (m.h[k] < m.hMax * 0.62 || m.h[k] < m.h[(k + 1) % n] || m.h[k] < m.h[(k - 1 + n) % n]) continue;
          const [x, y] = pt(k);
          const a = (k / n) * TAU + rot;
          const sc = 0.8 + (m.hMax / 260) * 0.7;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(sc, sc);
          ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(-10, 12); ctx.lineTo(-4, 9); ctx.lineTo(0, 13); ctx.lineTo(5, 9); ctx.lineTo(10, 12); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      // A soft mist line along the foot of each range adds depth between layers.
      if (depth < world.ranges.length - 1) {
        const g = ctx.createLinearGradient(0, my - R0 - 10, 0, my - R0 + 60);
        g.addColorStop(0, `rgba(${haze.join(',')},0)`);
        g.addColorStop(1, `rgba(${haze.join(',')},${0.35 * (1 - skyS)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, my - R0 - 10, W, 70);
      }
    });
    ctx.globalAlpha = 1;
  }

  function drawEarth() {
    if (cy - R0 > H + 60) return;
    // Atmosphere glow
    const glow = ctx.createRadialGradient(cx, cy, R0, cx, cy, R0 + 90);
    glow.addColorStop(0, 'rgba(140,210,255,0.45)');
    glow.addColorStop(1, 'rgba(140,210,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R0 + 90, 0, TAU); ctx.fill();

    const disc = (r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); };
    disc(R0, '#7a4e33');
    const crustG = ctx.createRadialGradient(cx, cy, R0 * 0.9, cx, cy, R0);
    crustG.addColorStop(0, '#5e3a27'); crustG.addColorStop(1, '#94603f');
    disc(R0, crustG);
    const mantle = ctx.createRadialGradient(cx, cy, R0 * 0.55, cx, cy, R0 * 0.9);
    mantle.addColorStop(0, '#f2842e'); mantle.addColorStop(1, '#a5322a');
    disc(R0 * 0.9, mantle);
    const outer = ctx.createRadialGradient(cx, cy, R0 * 0.3, cx, cy, R0 * 0.55);
    outer.addColorStop(0, '#ffd45e'); outer.addColorStop(1, '#ff9a2e');
    disc(R0 * 0.55, outer);
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.3);
    inner.addColorStop(0, '#ffffff'); inner.addColorStop(1, '#ffe98a');
    disc(R0 * 0.3, inner);

    // Mantle convection swirls, turning with the planet
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,190,120,0.35)';
    for (const sw of world.swirls) {
      const a = sw.a + theta - Math.PI / 2;
      ctx.beginPath(); ctx.arc(cx, cy, sw.rf * R0, a, a + sw.len); ctx.stroke();
    }
    // Crust contents
    for (const c of world.crust) {
      at(c.a + theta, c.rf * R0, () => {
        if (c.kind === 'rock') { px(-5, -3, 10, 6, ['#4a2e20', '#6d6258', '#3b2a22'][c.hue]); px(-3, -5, 6, 2, '#7d6a5c'); }
        else if (c.kind === 'gem') { const col = ['#5fd3e8', '#e85fb4', '#8ef06a'][c.hue]; px(-2, -4, 4, 8, col); px(-4, -2, 8, 4, col); px(-1, -3, 2, 2, '#ffffff'); }
        else if (c.kind === 'fossil') { ctx.strokeStyle = '#e8d7b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 5); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2, 0, 5); ctx.stroke(); }
        else { px(-7, -1, 14, 3, '#efe6cf'); px(-8, -3, 3, 7, '#efe6cf'); px(5, -3, 3, 7, '#efe6cf'); }
      }, 30);
    }
    // Grass
    ctx.strokeStyle = '#4fb34a'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 5, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#7ad65a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 1, 0, TAU); ctx.stroke();

    // Layer labels stay upright while the rock turns past them
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const labels = [['CRUST', 0.95], ['MANTLE', 0.73], ['OUTER CORE', 0.43], ['INNER CORE', 0.1]];
    for (const [t, rf] of labels) {
      const x = cx - Math.sin(0.3) * rf * R0 * (rf > 0.2 ? 1 : 0), y = cy - Math.cos(0.3) * rf * R0 + 3;
      if (y > H + 10) continue;
      ctx.fillStyle = 'rgba(20,10,20,0.55)'; ctx.fillText(t, x + 1, y + 1);
      ctx.fillStyle = '#fff4dc'; ctx.fillText(t, x, y);
    }
    ctx.textAlign = 'start';
  }

  function drawDecor() {
    for (const d of world.decor) {
      at(d.a + theta, R0 - 2, () => {
        ctx.scale(d.size, d.size);
        if (d.kind === 'tree') {
          px(-3, -18, 6, 18, '#6b4226');
          px(-13, -42, 26, 24, ['#2f8f3a', '#3aa047', '#27803a', '#4aa84a'][d.hue]);
          px(-9, -48, 18, 8, ['#2f8f3a', '#3aa047', '#27803a', '#4aa84a'][d.hue]);
          px(-9, -38, 6, 6, 'rgba(255,255,255,0.15)');
        } else if (d.kind === 'house') {
          const wall = ['#f2e6d0', '#e9c46a', '#c9d7f0', '#f4b6a6'][d.hue];
          px(-16, -24, 32, 24, wall);
          ctx.fillStyle = '#b8403a'; ctx.beginPath(); ctx.moveTo(-20, -24); ctx.lineTo(0, -40); ctx.lineTo(20, -24); ctx.fill();
          px(-4, -12, 8, 12, '#5a3a28');
          px(-12, -18, 6, 6, '#8fd0ff'); px(6, -18, 6, 6, '#8fd0ff');
        } else if (d.kind === 'flower') {
          px(-1, -8, 2, 8, '#3a8f3a');
          px(-3, -12, 6, 4, ['#ff6fa0', '#ffd23f', '#ffffff', '#b58cff'][d.hue]);
        } else {
          px(-8, -6, 16, 6, '#8a8f98'); px(-5, -9, 10, 3, '#a3a8b0');
        }
      });
    }
  }

  function drawPlatform(p) {
    const sq = p.squash;
    at(p.a + theta, p.R, () => {
      const w = p.w;
      if (p.type === 'trampoline') {
        px(-w / 2 + 6, 4, 4, 26, '#3b3b4f'); px(w / 2 - 10, 4, 4, 26, '#3b3b4f');
        px(-w / 2, 0, w, 6, '#e0433b');
        ctx.fillStyle = '#1b1530';
        ctx.beginPath(); ctx.moveTo(-w / 2 + 6, 1); ctx.quadraticCurveTo(0, 1 + sq * 14, w / 2 - 6, 1); ctx.lineTo(w / 2 - 6, 4); ctx.quadraticCurveTo(0, 4 + sq * 14, -w / 2 + 6, 4); ctx.fill();
        px(-w / 2, 0, 6, 6, '#ffd23f'); px(w / 2 - 6, 0, 6, 6, '#ffd23f');
      } else if (p.type === 'cloud' || p.type === 'nlc') {
        ctx.scale(1 + sq * 0.12, 1 - sq * 0.2);
        const base = p.type === 'nlc' ? 'rgba(130,200,255,0.85)' : '#ffffff';
        const shade = p.type === 'nlc' ? 'rgba(80,120,255,0.7)' : '#d7e6f5';
        const puffs = [[-w * 0.32, 18, 17], [-w * 0.1, 12, 22], [w * 0.14, 14, 20], [w * 0.34, 20, 15]];
        ctx.fillStyle = shade;
        for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y + 5, r, 0, TAU); ctx.fill(); }
        ctx.fillStyle = base;
        for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        if (p.type === 'nlc') { ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2, 10); ctx.bezierCurveTo(-w / 4, 0, w / 4, 22, w / 2, 8); ctx.stroke(); }
      } else if (p.type === 'balloon') {
        ctx.scale(1 + sq * 0.15, 1 - sq * 0.15);
        ctx.fillStyle = '#f4f6fb'; ctx.beginPath(); ctx.ellipse(0, 36, w / 2, 36, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d3d9e6'; ctx.beginPath(); ctx.ellipse(10, 42, w / 2 - 14, 26, 0, 0, TAU); ctx.fill();
        px(-10, 10, 8, 8, '#ffffff');
        ctx.strokeStyle = '#c9ced9'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 72); ctx.lineTo(0, 110); ctx.stroke();
        px(-7, 110, 14, 10, '#e0433b'); px(-3, 113, 6, 4, '#ffd23f');
      } else if (p.type === 'satellite' || p.type === 'station') {
        const body = p.type === 'station' ? 40 : 26;
        px(-body / 2, 0, body, 22, '#d9a93b'); px(-body / 2 + 3, 3, body - 6, 3, '#f5d27a');
        if (p.type === 'station') { px(-w / 2, 8, w, 5, '#9aa3b5'); }
        const panel = (x0, x1) => {
          px(x0, 4, x1 - x0, 14, '#2b4fb8');
          for (let x = x0 + 8; x < x1; x += 8) px(x, 4, 1, 14, '#6d8cf0');
          px(x0, 10, x1 - x0, 1, '#6d8cf0');
        };
        panel(-w / 2, -body / 2 - 4); panel(body / 2 + 4, w / 2);
        if (p.type === 'station') { panel(-w / 2 + 10, -w / 2 + 40); }
        px(-1, -8, 2, 8, '#c9ced9'); px(-3, -10, 6, 3, '#e0433b');
        ctx.globalAlpha = 0.3 + 0.3 * sq; px(-w / 2, -2, w, 2, '#ffd23f'); ctx.globalAlpha = 1;
      } else if (p.type === 'asteroid') {
        ctx.rotate(Math.sin(clock * 0.5 + p.spin) * 0.05);
        ctx.fillStyle = '#7b7280';
        ctx.beginPath();
        ctx.moveTo(-w / 2, 12); ctx.lineTo(-w / 3, 0); ctx.lineTo(w / 4, -2); ctx.lineTo(w / 2, 10);
        ctx.lineTo(w / 3, 34); ctx.lineTo(-w / 5, 40); ctx.closePath(); ctx.fill();
        px(-12, 10, 10, 8, '#5d5563'); px(10, 18, 8, 6, '#5d5563'); px(-w / 3, 0, w * 0.55, 3, '#a79fae');
      } else if (p.type === 'moon') {
        // The Moon itself is drawn by drawSkyMoon; once it has arrived, plant a flag on top.
        const m = moonView();
        if (!m || m.t < 0.98) return;
        px(30, -40, 3, 41, '#e8e8f0'); px(33, -40, 22, 14, '#e0433b'); px(36, -36, 6, 6, '#ffd23f');
      }
    }, 220);
  }

  function drawStar(s) {
    if (s.taken) return;
    at(s.a + theta, s.R, () => {
      const bob = Math.sin(clock * 3 + s.id) * 4;
      ctx.translate(0, bob);
      const glow = 0.25 + 0.15 * Math.sin(clock * 4 + s.id);
      ctx.fillStyle = `rgba(255,210,63,${glow})`; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 5 : 12, ang = (i / 10) * TAU - Math.PI / 2;
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath(); ctx.fill();
      px(-2, -4, 3, 3, '#fff7d6');
    }, 40);
  }

  function arrowShape(color, dir) {
    // Chunky pixel arrow pointing down (dir 0), left (-1) or right (1), 4px blocks
    const b = 4;
    const down = [[0, 0], [0, 1], [0, 2], [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3], [-1, 4], [0, 4], [1, 4], [0, 5]];
    const cells = dir === 0 ? down : down.map(([x, y]) => [(y - 2.5) * dir, x]);
    ctx.fillStyle = 'rgba(11,15,38,0.8)';
    for (const [x, y] of cells) ctx.fillRect(x * b - b / 2 - 1, y * b - 1, b + 2, b + 2);
    ctx.fillStyle = color;
    for (const [x, y] of cells) ctx.fillRect(x * b - b / 2, y * b, b, b);
  }

  function drawGuide(feetX, feetY) {
    if (state !== 'play') return;
    const t = findTarget();
    if (!t) return;
    const color = t.lined ? '#52e07a' : '#ffab3d';
    // Plumb line down to the target when we're lined up above it
    if (t.lined && t.p.R < player.r - 20) {
      const drop = player.r - t.p.R;
      ctx.fillStyle = 'rgba(82,224,122,0.55)';
      for (let y = 26; y < drop - 4; y += 12) ctx.fillRect(feetX - 1, feetY + y, 3, 6);
    }
    ctx.save();
    const pulse = t.lined ? Math.sin(clock * 8) * 2 : Math.sin(clock * 8) * 3 * Math.sign(t.d);
    if (t.lined) { ctx.translate(feetX, feetY + 8 + Math.abs(pulse)); arrowShape(color, 0); }
    else { ctx.translate(feetX + pulse, feetY + 14); arrowShape(color, Math.sign(t.d)); }
    ctx.restore();

    // Marker above the target itself
    at(t.p.a + theta, t.p.R, () => {
      ctx.translate(0, -34 - Math.abs(Math.sin(clock * 4)) * 6);
      ctx.globalAlpha = 0.9;
      arrowShape(color, 0);
      ctx.globalAlpha = 1;
    }, 40);
  }

  function drawParticles() {
    for (const q of particles) {
      at(q.a + theta, q.R, () => {
        ctx.globalAlpha = clamp(q.life * 2, 0, 1);
        px(-q.size / 2, -q.size / 2, q.size, q.size, q.color);
        ctx.globalAlpha = 1;
      }, 10);
    }
  }

  function drawRail() {
    // Journey rail on the right: Earth at the bottom, Moon at the top.
    const x = W - 22, top = H * 0.2, bottom = H * 0.78;
    const yFor = (f) => bottom - (f / TOP) * (bottom - top);
    ctx.fillStyle = 'rgba(11,15,38,0.5)';
    ctx.fillRect(x - 2, top, 4, bottom - top);
    for (let k = 1; k < TOP; k++) {
      const y = yFor(k);
      px(x - (k === 9 ? 7 : 4), y, k === 9 ? 14 : 8, 2, k <= bestTier ? '#ffd23f' : 'rgba(238,241,255,0.45)');
    }
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(238,241,255,0.8)';
    ctx.fillText('100 km', x - 10, yFor(9) + 4);
    ctx.textAlign = 'start';
    ctx.fillStyle = '#3a8fe0'; ctx.beginPath(); ctx.arc(x, bottom + 10, 8, 0, TAU); ctx.fill();
    px(x - 4, bottom + 5, 5, 4, '#4fb34a'); px(x + 1, bottom + 11, 4, 3, '#4fb34a');
    ctx.fillStyle = '#c9c7cf'; ctx.beginPath(); ctx.arc(x, top - 10, 7, 0, TAU); ctx.fill();
    const y = yFor(tierFloat(player.r));
    px(x - 5, y - 5, 10, 10, '#1b1530'); px(x - 4, y - 4, 8, 8, '#e0433b');
  }

  function render() {
    const anchorY = H * (cam.anchor || 0.46);
    cx = Math.round(W / 2);
    cy = anchorY + cam.r;
    drawSky();
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawMountains();
    drawEarth();
    drawDecor();
    for (const p of world.plats) drawPlatform(p);
    for (const s of world.stars) drawStar(s);

    const feetX = cx, feetY = Math.round(cy - player.r);
    let frame = 'stand';
    if (!player.onGround) frame = 'jump';
    else if ((state === 'title') || Math.abs(player.vx) > 5) frame = WALK_CYCLE[Math.floor(player.walkT) % 4];
    // Squash on landing, stretch while rising or falling fast
    const stretch = player.onGround ? 0 : clamp(Math.abs(player.vr) / 5000, 0, 0.18);
    const sy = 1 - player.squash * 0.2 + stretch;
    const sx = 1 + player.squash * 0.15 - stretch * 0.6;
    for (const g of fx.trail) {
      const ph = g.a + theta;
      drawSprite('jump', cx + g.r * Math.sin(ph), cy - g.r * Math.cos(ph), g.flip, 1, 1, g.life * 2);
    }
    drawGuide(feetX, feetY);
    drawSprite(frame, feetX, feetY, player.facing < 0, sy, sx);
    drawParticles();
    drawFx();
    ctx.restore();
    drawSpeedLines();
    drawBanner();
    if (fx.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${fx.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    drawRail();
  }

  // ---- Flow -----------------------------------------------------------------
  function startGame() {
    if (snd) { snd.init(); snd.music.start(); }
    tilt.zero = null;
    reset(Math.floor(Math.random() * 1e9));
    state = 'play';
    $('title').hidden = true;
    $('won').hidden = true;
    document.body.classList.add('playing');
    toast(touch ? (tilt.on ? 'Tilt to walk, press HOP to jump on a trampoline.' : 'Walk to a trampoline, press HOP to jump on. Tap TILT to steer by tilting.') : 'Walk to a trampoline, then hop on with Space.', 4.5);
    canvas.focus();
    try { navigator.wakeLock?.request('screen').catch(() => {}); } catch (e) { /* not available */ }
  }
  function win() {
    state = 'won';
    document.body.classList.remove('playing');
    banner('THE MOON', '384,400 km');
    fx.flash = 0.6;
    addShake(10);
    for (let i = 0; i < 5; i++) burst(-theta + (i - 2) * 0.004, player.r, ['#ffd23f', '#52e07a', '#e0433b', '#3f6fd8', '#ffffff'][i], 14, 300);
    sfx.win();
    const got = world.stars.filter((s) => s.taken).length;
    const m = Math.floor(playTime / 60), s = Math.floor(playTime % 60);
    $('won-stats').textContent = `${got} of ${world.stars.length} stars collected in ${m}:${String(s).padStart(2, '0')}.`;
    setTimeout(() => { $('won').hidden = false; }, 900);
  }

  $('start').addEventListener('click', startGame);
  $('again').addEventListener('click', startGame);
  const setToggle = (btn, label, on) => { btn.textContent = `${label} ${on ? 'ON' : 'OFF'}`; btn.setAttribute('aria-pressed', String(on)); };
  hud.music.addEventListener('click', () => { if (snd) { snd.init(); setToggle(hud.music, 'MUSIC', snd.toggleMusic()); } });
  hud.sfx.addEventListener('click', () => { if (snd) { snd.init(); setToggle(hud.sfx, 'SFX', snd.toggleSfx()); } });

  // ---- Tilt steering (phone gyroscope) ---------------------------------------
  // Lean the phone left or right to walk and steer. The angle you hold it at
  // when tilt starts counts as "level".
  function tiltReading(e) {
    const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    if (angle === 90) return e.beta;
    if (angle === -90 || angle === 270) return -e.beta;
    return e.gamma;
  }
  function onTilt(e) {
    if (e.gamma == null) return;
    tilt.got = true;
    const v = tiltReading(e);
    if (tilt.zero === null) tilt.zero = v;
    const d = v - tilt.zero, dead = 3, full = 18;
    tilt.axis = Math.abs(d) < dead ? 0 : Math.sign(d) * clamp((Math.abs(d) - dead) / (full - dead), 0, 1);
  }
  function stopTilt(msg) {
    window.removeEventListener('deviceorientation', onTilt);
    tilt.on = false; tilt.axis = 0;
    setToggle(hud.tilt, 'TILT', false);
    if (msg) toast(msg, 5);
  }
  async function startTilt() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const answer = await DeviceOrientationEvent.requestPermission();
        if (answer !== 'granted') { stopTilt('Tilt needs motion access. Tap TILT again and choose Allow.'); return; }
      }
    } catch (e) {
      stopTilt('Tilt steering is blocked here. Open the game from its own web address to use it.');
      return;
    }
    tilt.on = true; tilt.zero = null; tilt.got = false;
    window.addEventListener('deviceorientation', onTilt);
    setToggle(hud.tilt, 'TILT', true);
    toast('Tilt on. Hold the phone comfortably, then lean it left or right to steer.', 4);
    setTimeout(() => {
      if (tilt.on && !tilt.got) stopTilt("Tilt isn't available in this view. Open the game from its own web address to use it.");
    }, 1500);
  }
  if (touch && 'DeviceOrientationEvent' in window) {
    hud.tilt.hidden = false;
    hud.tilt.addEventListener('click', () => (tilt.on ? stopTilt() : startTilt()));
  }

  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
    else if (JUMP.has(e.code)) {
      e.preventDefault();
      if (state === 'title' || (state === 'won' && !$('won').hidden)) { if (!e.repeat) startGame(); return; }
      if (!e.repeat) jumpBuffer = 0.15;
    }
  });
  window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
  window.addEventListener('blur', () => { keys.left = keys.right = false; });

  // Touch pad
  document.querySelectorAll('.pad button').forEach((btn) => {
    const k = btn.dataset.key;
    const down = (e) => {
      e.preventDefault();
      btn.classList.add('on');
      if (k === 'jump') jumpBuffer = 0.15; else keys[k] = true;
    };
    const up = () => { btn.classList.remove('on'); if (k !== 'jump') keys[k] = false; };
    btn.addEventListener('pointerdown', down);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, up));
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  let last = 0;
  function frame(t) {
    const dt = Math.min(1 / 30, (t - last) / 1000 || 0);
    last = t;
    checkSize();
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // Hot reload support when hosted as an artifact; harmless elsewhere.
  function snapshot() {
    return { seed: world.seed, state, theta, lastTier, bestTier, playTime, player: { ...player }, taken: world.stars.filter((s) => s.taken).map((s) => s.id) };
  }
  function start(data) {
    resize();
    reset(data && data.seed ? data.seed : 20260930);
    if (data && data.state === 'play') {
      theta = data.theta; lastTier = data.lastTier; bestTier = data.bestTier; playTime = data.playTime;
      Object.assign(player, data.player);
      cam.r = player.r;
      for (const id of data.taken || []) if (world.stars[id]) world.stars[id].taken = true;
      updateStarsHud();
      state = 'play';
      $('title').hidden = true;
      document.body.classList.add('playing');
    }
    window.claude?.hot?.snapshot?.(snapshot);
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
