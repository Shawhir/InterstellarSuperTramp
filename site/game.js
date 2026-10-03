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
  const hud = { score: $('score'), mult: $('mult'), alt: $('alt'), layer: $('layer'), stars: $('stars'), toast: $('toast'), music: $('music'), sfx: $('sfx'), tilt: $('tilt') };

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
  const L1_TIERS = [
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
  let TIERS = L1_TIERS;
  let TOP = TIERS.length - 1;

  // ---- Level 2: from the Moon to Mars or Venus ---------------------------------
  // You start at a future Moon base. One launch pad heads for Mars, the other for
  // Venus. g is gravity compared with Earth's, softened so it stays playable (the
  // real Moon's is a sixth). Hazards: wind (the solar wind pushes you sideways),
  // dust (clouds of grit that sandblast you if you linger), rad (radiation
  // bursts), plus flaming meteors everywhere past the Moon.
  const MOON_TIERS = [
    { km: 0, type: 'pad', layer: 'Moon base', g: 0.45 },
    { km: 100, type: 'rocket', layer: 'Lunar orbit', g: 0.45, note: "Lunar orbit. The Moon's gravity is a sixth of Earth's, so everything floats." },
    { km: 2000, type: 'rocket', layer: 'Lunar orbit', g: 0.45 },
    { km: 60000, type: 'rocket', layer: 'Leaving the Moon', g: 0.5, note: "About 60,000 km out, the Moon's pull fades and the Sun's takes over." },
  ];
  const L2_ROUTES = {
    mars: [
      ...MOON_TIERS,
      { km: 1500000, type: 'kamo', layer: 'Near-Earth space', g: 0.55, note: "Kamo'oalewa: a rock 40 to 100 m wide that loops round Earth. It may be a chip off the Moon, and China's Tianwen-2 is going to fetch a sample." },
      { km: 5000000, type: 'asteroid', layer: 'Solar wind', g: 0.55, wind: 1, visitor: 'oumuamua', note: 'The solar wind: charged particles streaming from the Sun. It pushes you sideways.' },
      { km: 12000000, type: 'asteroid', layer: 'Solar wind', g: 0.55, wind: 1 },
      { km: 20000000, type: 'car', layer: 'Solar wind', g: 0.55, wind: 1, ride: { kind: 'car', title: "LUMEN'S CAR", fact: 'Lumen has been circling the Sun in this old car for years. A real car, launched in 2018, is out here too.' } },
      { km: 28000000, type: 'asteroid', layer: 'Dust field', g: 0.55, dust: 1, note: 'Space dust: grains from comets and asteroids. Hang about in a cloud and it sandblasts you.' },
      { km: 36000000, type: 'asteroid', layer: 'Dust field', g: 0.55, dust: 1, note: 'Cruithne, 5 km wide, is named after the Cruthin, an early people of Ireland and Scotland. Its horseshoe path takes 770 years.' },
      { km: 44000000, type: 'rocket', layer: 'Cosmic rays', g: 0.55, rad: 1, visitor: 'atlas', note: 'Radiation from the Sun and deep space is the real danger for astronauts. Dodge the bursts.' },
      { km: 50000000, type: 'asteroid', layer: 'Cosmic rays', g: 0.55, rad: 1, fact: { kind: 'marsrock', text: 'A Mars rock! Over 300 Martian meteorites have been found on Earth, blasted off Mars by impacts.' } },
      { km: 54500000, type: 'phobos', layer: 'Mars orbit', g: 0.6, note: 'Phobos: a lumpy moon 22 km across that laps Mars three times a day. In 30 to 50 million years it will break up into a ring.' },
      { km: 54600000, type: 'mars', layer: 'Mars' },
    ],
    venus: [
      ...MOON_TIERS,
      { km: 1500000, type: 'asteroid', layer: 'Near-Earth space', g: 0.55, visitor: 'oumuamua', note: 'A few thousand asteroids cross this part of space, spread across billions of cubic kilometres.' },
      { km: 5000000, type: 'asteroid', layer: 'Sunward', g: 0.55, wind: 1.3, note: 'Heading sunward. The solar wind gets stronger the closer you get to the Sun.' },
      { km: 10000000, type: 'asteroid', layer: 'Sunward', g: 0.55, wind: 1.3 },
      { km: 16000000, type: 'comet', layer: 'Sunward', g: 0.55, wind: 1.3, ride: { kind: 'comet', title: 'COMET BORISOV', fact: 'Borisov, 2019: a comet from another star, found by an amateur astronomer with a telescope he built himself.' } },
      { km: 22000000, type: 'asteroid', layer: 'Solar flares', g: 0.6, rad: 1, note: 'Solar flares: sudden blasts of radiation from the Sun. Watch for the warning flicker.' },
      { km: 28000000, type: 'rocket', layer: 'Solar flares', g: 0.6, rad: 1, visitor: 'atlas' },
      { km: 33000000, type: 'asteroid', layer: 'Solar flares', g: 0.6, rad: 1, fact: { kind: 'venera', text: 'Venera 7 (1970) was the first spacecraft to land on another planet and send data home. It lasted 23 minutes in the heat.' } },
      { km: 36000000, type: 'asteroid', layer: 'Venus approach', g: 0.7, note: 'Venus spins backwards, so the Sun rises in the west there. And its day is longer than its year!' },
      { km: 37999950, type: 'cloudv', layer: 'Venus clouds', g: 0.75, note: "50 km up in Venus's clouds, the air is almost like Earth's. Down at the surface it's 465°C." },
      { km: 38000000, type: 'venus', layer: 'Venus' },
    ],
  };
  const VISITORS = {
    oumuamua: "'Oumuamua, 2017: the first object seen visiting from another star. Its name means scout, or messenger from afar.",
    atlas: '3I/ATLAS, found in 2025: the fastest visitor from another star yet. It may be older than our whole solar system.',
    atlas3: '3I/ATLAS, a comet from another star, flew past Mars in October 2025, and the spacecraft orbiting Mars turned their cameras to watch.',
  };
  // ---- Level 3: from Mars out to the asteroid belt ------------------------------
  // You start on Mars, past its two little moons, then out towards the belt.
  // Halfway, Jupiter's pull swings the view round and it becomes a sideways
  // bouncer: you head right instead of up, and a big knock sends you back
  // towards Mars. Gravity is weak in the belt, so it's floaty. A being of light
  // waiting at the turn gives you a force field, and with it the drifting
  // asteroids turn into pinball bumpers you can bounce off. Without it they
  // just knock you back. The last layer has four big worlds; land on any one.
  const FLIP = 8; // the layer where the view turns sideways
  const L3_TIERS = [
    { km: 0, type: 'pad', layer: 'Jezero base', g: 0.5 },
    { km: 8, type: 'cloudm', layer: 'Martian sky', g: 0.5, note: "Mars has air, just thin: about 1% of Earth's, mostly carbon dioxide. Enough for wispy clouds of water ice." },
    { km: 40, type: 'cloudm', layer: 'Martian sky', g: 0.5, dust: 1, note: 'Dust storms on Mars can wrap the whole planet. One ended the Opportunity rover in 2018.' },
    { km: 6000, type: 'phobos', layer: 'Mars orbit', g: 0.5, note: 'Phobos ("fear"), 22 km across, races round Mars three times a day, so it rises in the west and sets in the east.' },
    { km: 14000, type: 'rocket', layer: 'Mars orbit', g: 0.5 },
    { km: 23460, type: 'deimos', layer: 'Mars orbit', g: 0.5, note: 'Deimos ("dread"), just 12 km across. Asaph Hall found both moons in 1877 and named them after the sons of Ares, god of war.' },
    { km: 2000000, type: 'asteroid', layer: 'Leaving Mars', g: 0.45, visitor: 'atlas3', note: "Mars trojans: a few asteroids share Mars's orbit, 60° ahead of it and behind. The biggest is called Eureka." },
    { km: 20000000, type: 'rocket', layer: 'Leaving Mars', g: 0.45, fact: { kind: 'probe', text: 'Dawn (2007 to 2018) was the first spacecraft to orbit two worlds past the Moon: Vesta, then Ceres. It still circles Ceres, switched off.' } },
    { km: 50000000, type: 'asteroid', layer: "Jupiter's pull", g: 0.4 },
    { km: 80000000, type: 'miner', layer: 'Inner belt', g: 0.35, bumpers: 2, note: 'In films, asteroid fields are packed. The real belt is mostly empty space, asteroids about a million km apart. This bit is the film version.' },
    { km: 95000000, type: 'asteroid', layer: 'Inner belt', g: 0.35, bumpers: 2, laser: 1 },
    { km: 110000000, type: 'hauler', layer: 'Inner belt', g: 0.35, bumpers: 2, ride: { kind: 'hauler', title: 'ICE HAULER', fact: "Ice is the belt's real treasure: melt it to drink, split it into air to breathe and rocket fuel. Sci-fi belters haul it about in great blocks." } },
    { km: 125000000, type: 'asteroid', layer: 'Kirkwood gap', g: 0.33, bumpers: 3, note: "Kirkwood gaps: lanes in the belt that Jupiter's pull has swept almost empty. Almost.", fact: { kind: 'probe', text: 'NASA\'s Psyche probe, launched in 2023, reaches 16 Psyche in 2029: an asteroid that may be the bare metal core of a baby planet.' } },
    { km: 145000000, type: 'miner', layer: 'Main belt', g: 0.3, bumpers: 3, laser: 1, note: 'Asteroid mining: one metal-rich asteroid could hold more iron and nickel than humans have ever dug up. Watch out for the mining lasers.' },
    { km: 165000000, type: 'outpost', layer: 'Main belt', g: 0.3, bumpers: 3, note: 'A belter outpost: spin the ring and you get a little gravity back. Science fiction loves building cities out here.' },
    { km: 180000000, type: 'asteroid', layer: 'Main belt', g: 0.3, bumpers: 4, laser: 1 },
    { km: 190000000, type: 'ceres', layer: 'Dwarf planets' },
  ];
  // The four biggest worlds in the belt. Only Ceres is officially a dwarf planet;
  // Hygiea may qualify, and Vesta and Pallas are giant asteroids.
  const BELT_WORLDS = {
    ceres: { name: 'Ceres', r: 96, body: '#8d8a86', dark: '#6c6966', note: 'Ceres, 940 km across: the only dwarf planet in the belt. The bright spots in Occator crater are salt left by salty water seeping up from below.' },
    vesta: { name: 'Vesta', r: 66, body: '#a39a8a', dark: '#7d7466', note: 'Vesta, 525 km across, the brightest asteroid. Its Rheasilvia crater has a central peak about twice as tall as Everest.' },
    pallas: { name: 'Pallas', r: 64, body: '#7f8a94', dark: '#5f6971', note: 'Pallas, 512 km across, travels on a steeply tilted path, and its surface is pitted all over like a golf ball.' },
    hygiea: { name: 'Hygiea', r: 58, body: '#5d5a5e', dark: '#444146', note: 'Hygiea, about 430 km across, is almost perfectly round. If it gets the title, it will be the smallest dwarf planet.' },
  };
  let level = 1;      // 1: Earth to the Moon. 2: the Moon to Mars or Venus. 3: Mars to the belt
  let route = null;   // level 2: 'mars' or 'venus', picked by the launch pad you use. Level 3: 'belt'
  let landedOn = null; // level 3: the belt world you landed on
  function useTiers() {
    TIERS = level === 3 ? L3_TIERS : level === 2 ? L2_ROUTES[route || 'mars'] : L1_TIERS;
    TOP = TIERS.length - 1;
    CHECKPOINTS = checkpointsFor(TIERS);
    // In the belt, the turn is the last checkpoint: get knocked back past it
    // and you fall all the way back to Mars
    if (level === 3) for (const k of [...CHECKPOINTS]) if (k > FLIP) CHECKPOINTS.delete(k);
  }
  // How far the Moon's cratered ground sits above (+) or below (-) the base radius
  function surfAt(a) {
    const sf = world && world.surf;
    if (!sf) return 0;
    const n = sf.length, f = ((((a / TAU) * n) % n) + n) % n, i = Math.floor(f), k = f - i;
    return sf[i] * (1 - k) + sf[(i + 1) % n] * k;
  }
  const gravAt = (k) => (level >= 2 ? TIERS[Math.max(0, Math.min(TOP, k))].g || 0.6 : 1);
  const WIDTH = { trampoline: 70, cloud: 130, balloon: 80, nlc: 120, satellite: 96, station: 150, asteroid: 84, moon: 220,
    pad: 80, rocket: 116, kamo: 84, car: 150, comet: 140, phobos: 110, deimos: 80, cloudv: 140, mars: 220, venus: 220,
    cloudm: 140, miner: 120, hauler: 160, outpost: 150, ceres: 160, vesta: 110, pallas: 106, hygiea: 96 };
  const MOON_R = 110; // the landing Moon's radius; its top is the last bouncy surface
  const tierR = (k) => R0 + 30 + k * TIER_GAP;
  // Around-the-world rides: land on one and it carries you halfway round the
  // planet, where the next layer's platform is waiting on the far side.
  const RIDES = {
    4: { kind: 'jet', title: 'JET STREAM', fact: 'The jet stream: winds up to 400 km/h, 10 km up. Hold on!' },
    11: { kind: 'iss', title: 'SPACE STATION', fact: 'The ISS laps the whole Earth every 92 minutes, with astronauts living on board.' },
  };
  const RIDE_TIME = 5.5;
  // Checkpoints: the first layer of each new part of the sky. Once you've landed
  // on one, a miss above it catches you there instead of dropping you to Earth.
  const checkpointsFor = (T) => new Set(T.map((t, k) => (k >= 1 && k < T.length - 1 && t.layer !== T[k - 1].layer ? k : -1)).filter((k) => k > 0));
  let CHECKPOINTS = checkpointsFor(TIERS);
  // Difficulty: each step up the bouncing gets faster, from 1.01x on the first
  // trampoline to 2x by the last jump before the Moon. Heights stay the same;
  // gravity and bounce speed scale together so you get less time to steer.
  const HARD_START = 1.01, HARD_END = 2;
  const speedFor = (k) => {
    // Level 2 starts a bit quicker and ends quicker still; low gravity keeps it floaty
    // Level 3 ends hardest of all; the belt's weak gravity keeps it floaty
    const [a, b] = level === 3 ? [1.15, 2.25] : level === 2 ? [1.12, 2.1] : [HARD_START, HARD_END];
    return a * Math.pow(b / a, clamp(k, 0, TOP - 1) / (TOP - 1));
  };
  const bounceFor = (k) => speedFor(k) * Math.sqrt(2 * G * gravAt(k) * (tierR(k + 1) - tierR(k) + OVERSHOOT));

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

  // Spacesuit: white suit and helmet, blue visor, orange stripes
  const SUIT = { h: '#eef1f7', k: '#3b6fd8', s: '#9fd8ff', y: '#ff7a1a', c: '#f4f6fb', p: '#d6dce8', b: '#7d869a' };
  const HOT = { h: '#fff3b0', k: '#ff7a1a', s: '#ffd36b', y: '#ffffff', c: '#ffb23a', p: '#ff8a2a', b: '#e0433b' };
  function drawSprite(frame, x, y, flip, sy, sx = 1, alpha = 1, pal = PAL) {
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
        ctx.fillStyle = pal[ch];
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
    if (level === 3) return buildWorld3(seed);
    if (level === 2) return buildWorld2(seed);
    const rnd = mulberry32(seed);
    const plats = [];
    const stars = [];
    const mk = (tier, a) => {
      const type = TIERS[tier].type;
      const p = { tier, a, a0: a, type, R: tierR(tier), w: WIDTH[type], bounce: bounceFor(tier), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU };
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
        mk(k, prevA + ((170 * (rnd() < 0.5 ? -1 : 1)) / R)).dest = true;
        break;
      }
      // Faster bounces mean less air time, so keep the gap reachable.
      const off = (100 + (rnd() * 210) / Math.sqrt(speedFor(k - 1))) * (rnd() < 0.5 ? -1 : 1);
      const a = prevA + off / R;
      const mp = mk(k, a);
      mp.main = true;
      // A star on the natural arc between the last layer and this one.
      stars.push({ a: prevA + (a - prevA) * 0.62, R: R + 50, taken: false });
      let nextA = a;
      if (RIDES[k]) {
        const dir = rnd() < 0.5 ? -1 : 1;
        mp.ride = { ...RIDES[k], near: a, far: a + Math.PI * dir, from: a, to: a, t: 0, state: 'near', idle: 0 };
        mp.sway = 0;
        if (RIDES[k].kind === 'jet') mp.w = 190;
        // Stars strung along the route, collected as you ride past
        for (const f of [0.2, 0.4, 0.6, 0.8]) stars.push({ a: a + Math.PI * dir * f, R: R + 200, taken: false, big: true });
        nextA = mp.ride.far;
      }
      // Spare platforms off to the side, some carrying a bonus star.
      const extras = k < 9 ? 2 : 1;
      for (let i = 0; i < extras; i++) {
        const ea = a + ((360 + rnd() * 420) * (i % 2 ? -1 : 1)) / R;
        mk(k, ea);
        if (rnd() < 0.55) stars.push({ a: ea, R: R + 150, taken: false });
      }
      prevA = nextA;
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

    const issPlat = plats.find((q) => q.ride && q.ride.kind === 'iss') || null;
    return { seed, plats, stars, decor, crust, swirls, sky, ranges, issPlat };
  }

  function buildWorld2(seed) {
    const rnd = mulberry32(seed);
    const plats = [], stars = [], beams = [], dust = [];
    const SWAY = new Set(['rocket', 'asteroid', 'kamo', 'phobos', 'deimos', 'cloudv']);
    const mk = (rt, tier, a, type = L2_ROUTES[rt][tier].type) => {
      const g = L2_ROUTES[rt][tier].g || 0.6;
      const p = { tier, a, a0: a, type, route: rt, g, R: tierR(tier), w: WIDTH[type], bounce: speedFor(tier) * Math.sqrt(2 * G * g * (TIER_GAP + OVERSHOOT)), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU, dir: rnd() < 0.5 ? -1 : 1 };
      if (SWAY.has(type) && tier > 0) { p.sway = (25 + rnd() * 35) / p.R; p.freq = 0.3 + rnd() * 0.3; p.phase = rnd() * TAU; }
      plats.push(p);
      return p;
    };
    // Mars is to the right of the base, Venus to the left; the routes head away
    // from each other so they never tangle.
    for (const [rt, s] of [['mars', 1], ['venus', -1]]) {
      const T = L2_ROUTES[rt], top = T.length - 1;
      mk(rt, 0, s * 0.62).main = true;
      mk(rt, 0, s * 1.7);
      let prevA = s * 0.62;
      for (let k = 1; k <= top; k++) {
        const R = tierR(k), t = T[k];
        if (k === top) { mk(rt, k, prevA + (s * 170) / R).dest = true; break; }
        const off = (110 + (rnd() * 200) / Math.sqrt(speedFor(k - 1))) * (rnd() < 0.8 ? s : -s);
        const a = prevA + off / R;
        const mp = mk(rt, k, a);
        mp.main = true;
        stars.push({ a: prevA + (a - prevA) * 0.62, R: R + 50, taken: false, route: rt });
        // The stack of rings from the drawing, puffed out above each rocket
        if (t.type === 'rocket') for (let i = 0; i < 3; i++) stars.push({ a: a + (s * 24) / R, R: R + 80 + i * 36, taken: false, route: rt, ring: true });
        if (t.fact) stars.push({ a: a - (s * 110) / R, R: R + 150, taken: false, route: rt, big: true, fact: t.fact });
        let nextA = a;
        if (t.ride) {
          const far = a + Math.PI * 0.6 * s;
          mp.ride = { ...t.ride, near: a, far, from: a, to: a, t: 0, state: t.ride.kind === 'car' ? 'loop' : 'near', idle: 0, w: (TAU / 26) * s };
          mp.sway = 0;
          for (const f of [0.2, 0.4, 0.6, 0.8]) stars.push({ a: a + (far - a) * f, R: R + 200, taken: false, big: true, route: rt });
          nextA = far;
        }
        if (t.rad) for (const side of [-1, 1]) beams.push({ a: a + (side * (120 + rnd() * 70)) / R, tier: k, period: 3.4 + rnd() * 1.4, phase: rnd() * 4, route: rt });
        if (t.dust) dust.push({ a: a + (s * (150 + rnd() * 80)) / R, R: R + 125, phase: rnd() * TAU, route: rt }, { a: a - (s * (210 + rnd() * 90)) / R, R: R + 140, phase: rnd() * TAU, route: rt });
        const spare = t.ride || t.type === 'kamo' ? 'asteroid' : t.type === 'phobos' ? 'deimos' : t.type;
        for (let i = 0; i < (k < 6 ? 2 : 1); i++) {
          const ea = a + ((340 + rnd() * 380) * (i % 2 ? -1 : 1)) / R;
          mk(rt, k, ea, spare);
          if (rnd() < 0.5) stars.push({ a: ea, R: R + 150, taken: false, route: rt });
        }
        prevA = nextA;
      }
    }
    stars.forEach((st, i) => { st.id = i; });

    // The Moon's surface: boulders first, landmarks drawn on top
    const decor = [];
    for (let i = 0; i < 34; i++) {
      const a = rnd() * TAU - Math.PI;
      if (Math.abs(a) > 0.36) decor.push({ a, kind: 'boulder', size: 0.5 + rnd() * 0.9, hue: Math.floor(rnd() * 3) });
    }
    decor.push(
      { a: -0.45, kind: 'sign', text: '< VENUS', col: '#ffd23f' },
      { a: 0.45, kind: 'sign', text: 'MARS >', col: '#ff6a4a' },
      { a: 0.95, kind: 'solar' }, { a: -0.95, kind: 'solar' },
      { a: -1.25, kind: 'greenhouse' }, { a: 1.25, kind: 'antenna' },
      { a: 1.98, kind: 'lander' }, { a: 2.3, kind: 'mining' },
      { a: 2.62, kind: 'prints' }, { a: 2.72, kind: 'apollo' }, { a: 2.86, kind: 'prints' },
      { a: -2.18, kind: 'tracks' }, { a: -1.98, kind: 'rover' }, { a: -1.8, kind: 'tracks' },
      { a: -2.6, kind: 'dish' }, { a: -2.95, kind: 'monolith' },
    );
    // Inside the crust: pale highland rock, polar ice, meteorite iron, orange
    // volcanic glass beads (Apollo 17 found some) and the odd lava tube
    const crust = [];
    for (let i = 0; i < 90; i++) {
      const r = rnd();
      const kind = r < 0.42 ? 'rock' : r < 0.6 ? 'ice' : r < 0.76 ? 'meteorite' : r < 0.92 ? 'glass' : 'tube';
      // Lava tubes run deep, well below the craters
      crust.push({ a: rnd() * TAU, rf: kind === 'tube' ? 0.91 + rnd() * 0.025 : 0.905 + rnd() * 0.07, kind, hue: Math.floor(rnd() * 3) });
    }
    const swirls = [];
    for (let i = 0; i < 18; i++) swirls.push({ a: rnd() * TAU, rf: 0.4 + rnd() * 0.46, len: 0.1 + rnd() * 0.25 });
    // The view behind the base, after a flat vector Moon scene: a wide plain
    // running back to a low horizon, in three bands of distance. Low,
    // flat-topped crater rims sit on the horizon; a few oval craters lie on the
    // plain, small far away and bigger close up, with lots of empty ground between.
    const spaced = (count, gap) => {
      const out = [];
      for (let t = 0; t < 500 && out.length < count; t++) { const a = rnd() * TAU; if (out.every((q) => Math.abs(wrap(a - q)) > gap)) out.push(a); }
      return out;
    };
    const plains = [
      { f: 0.3, sink: 0.6, top: 66, col: '#26343e', rx: [9, 14], craters: 5 },
      { f: 0.5, sink: 0.74, top: 42, col: '#2e3e49', rx: [13, 20], craters: 4 },
      { f: 0.72, sink: 0.87, top: 20, col: '#374955', rx: [17, 24], craters: 4 },
    ].map((L, i, all) => {
      const below = i < all.length - 1 ? all[i + 1].top : 0;
      const room = L.top - below;
      const craters = spaced(L.craters, TAU / (L.craters * 1.8)).map((a) => {
        const rx = L.rx[0] + rnd() * (L.rx[1] - L.rx[0]), ry = rx * 0.32;
        // Sits within its own band, visible above the nearer band
        return { a, rx, h: below + ry + 2 + rnd() * Math.max(0, room - ry * 2 - 4) };
      });
      return { ...L, below, craters };
    });
    const sky = [];
    for (let i = 0; i < 240; i++) sky.push({ x: rnd(), y: rnd(), s: rnd() < 0.12 ? 2 : 1, tw: rnd() * TAU });
    return { seed, plats, stars, decor, crust, swirls, sky, ranges: [], plains, issPlat: null, beams, dust, surf: new Float32Array(720) };
  }

  function buildWorld3(seed) {
    const rnd = mulberry32(seed);
    const plats = [], stars = [], beams = [], dust = [], rocks = [];
    const T = L3_TIERS;
    const SWAY = new Set(['rocket', 'asteroid', 'phobos', 'deimos', 'cloudm', 'miner']);
    const mk = (tier, a, type = T[tier].type) => {
      const g = T[tier].g || 0.6;
      const p = { tier, a, a0: a, type, g, R: tierR(tier), w: WIDTH[type], bounce: speedFor(tier) * Math.sqrt(2 * G * g * (TIER_GAP + OVERSHOOT)), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU, dir: rnd() < 0.5 ? -1 : 1 };
      if (SWAY.has(type) && tier > 0) { p.sway = (25 + rnd() * 35) / p.R; p.freq = 0.3 + rnd() * 0.3; p.phase = rnd() * TAU; }
      plats.push(p);
      return p;
    };
    mk(0, 0.62).main = true;
    mk(0, -0.55);
    let prevA = 0.62;
    for (let k = 1; k <= TOP; k++) {
      const R = tierR(k), t = T[k];
      if (k === TOP) {
        // Four worlds side by side, in a different order each run
        const order = Object.keys(BELT_WORLDS).sort(() => rnd() - 0.5);
        order.forEach((type, i) => { const p = mk(k, prevA + ((i - 1.5) * 240) / R, type); p.dest = true; p.world = BELT_WORLDS[type]; });
        break;
      }
      const off = (110 + (rnd() * 200) / Math.sqrt(speedFor(k - 1))) * (rnd() < 0.8 ? 1 : -1);
      const a = prevA + off / R;
      const mp = mk(k, a);
      mp.main = true;
      stars.push({ a: prevA + (a - prevA) * 0.62, R: R + 50, taken: false });
      if (t.type === 'rocket') for (let i = 0; i < 3; i++) stars.push({ a: a + 24 / R, R: R + 80 + i * 36, taken: false, ring: true });
      if (t.fact) stars.push({ a: a - 110 / R, R: R + 150, taken: false, big: true, fact: t.fact });
      // Pinball bumpers: asteroids drifting to and fro across the way up,
      // more of them and faster the further into the belt you get
      for (let i = 0; i < (t.bumpers || 0); i++) {
        const rr = tierR(k - 1) + 80 + rnd() * 100;
        const c = prevA + (a - prevA) * (0.2 + rnd() * 0.6) + ((rnd() - 0.5) * 220) / rr;
        rocks.push({ c, a: c, R: rr, r: 18 + rnd() * 16, amp: (80 + rnd() * 90) / rr, freq: 0.45 + (k - FLIP) * 0.09 + rnd() * 0.3, ph: rnd() * TAU, spin: rnd() * TAU, flash: 0, cool: 0, claim: rnd() < 0.3 });
      }
      let nextA = a;
      if (t.ride) {
        const far = a + Math.PI * 0.6;
        mp.ride = { ...t.ride, near: a, far, from: a, to: a, t: 0, state: 'near', idle: 0 };
        mp.sway = 0;
        for (const f of [0.2, 0.4, 0.6, 0.8]) stars.push({ a: a + (far - a) * f, R: R + 200, taken: false, big: true });
        nextA = far;
      }
      if (t.laser) for (const side of [-1, 1]) beams.push({ a: a + (side * (120 + rnd() * 70)) / R, tier: k, period: 3 + rnd() * 1.2, phase: rnd() * 4, route: 'belt', kind: 'laser' });
      if (t.dust) dust.push({ a: a + (150 + rnd() * 80) / R, R: R + 125, phase: rnd() * TAU, route: 'belt' }, { a: a - (210 + rnd() * 90) / R, R: R + 140, phase: rnd() * TAU, route: 'belt' });
      const spare = t.type === 'cloudm' ? 'cloudm' : t.type === 'phobos' || t.type === 'deimos' ? 'rocket' : 'asteroid';
      for (let i = 0; i < (k < 5 ? 2 : 1); i++) {
        const ea = a + ((340 + rnd() * 380) * (i % 2 ? -1 : 1)) / R;
        mk(k, ea, spare);
        if (rnd() < 0.5) stars.push({ a: ea, R: R + 150, taken: false });
      }
      prevA = nextA;
    }
    stars.forEach((st, i) => { st.id = i; });

    // Mars's surface: red boulders, then the rovers and landers that are really
    // there (squashed closer together). Walk past one to find out about it.
    const decor = [];
    for (let i = 0; i < 30; i++) {
      const a = rnd() * TAU - Math.PI;
      if (Math.abs(a) > 0.3) decor.push({ a, kind: 'boulder', size: 0.5 + rnd() * 0.8, hue: Math.floor(rnd() * 3) });
    }
    const drive = (a, span, w) => ({ a0: a, span, w, ph: rnd() * TAU });
    decor.push(
      { a: 0.42, kind: 'sign', text: 'BELT >', col: '#ffd23f' },
      { a: -0.26, kind: 'hab', note: 'A greenhouse full of potatoes. Somebody has been growing their own dinner. Hopefully they got home.' },
      { a: 0.98, kind: 'tracks' }, { a: 1.0, kind: 'perseverance', drive: drive(1.0, 0.07, 0.12), note: 'Perseverance, landed 2021 in Jezero crater, an old lake bed. It drills rock samples and seals them in tubes, ready for a trip to Earth one day.' },
      { a: 1.16, kind: 'ingenuity', drive: drive(1.16, 0.05, 0.35), note: "Ingenuity: the first aircraft to fly on another planet. Mars's air is so thin its blades spun at about 2,500 rpm to lift off. It flew 72 times." },
      { a: 1.62, kind: 'tracks' }, { a: 1.64, kind: 'curiosity', drive: drive(1.64, 0.06, 0.1), note: 'Curiosity, landed 2012, is still climbing Mount Sharp. It runs on nuclear power, and once hummed Happy Birthday to itself.' },
      { a: 2.05, kind: 'insight', note: 'InSight (2018 to 2022) listened for marsquakes. It heard over 1,300 of them, and showed Mars has a big liquid iron core.' },
      { a: 2.45, kind: 'zhurong', note: "Zhurong (2021), China's first Mars rover, named after a god of fire. It went to sleep for the Martian winter in 2022 and hasn't woken up." },
      { a: 2.9, kind: 'face', note: "The 'Face on Mars': a hill in Cydonia that looked like a face in a 1976 Viking photo. Sharper pictures show it's just a hill. Probably." },
      { a: -0.98, kind: 'opportunity', note: 'Opportunity was meant to last 90 days. It drove for 14 years, until a dust storm covered the whole planet in 2018 and blocked out its Sun.' },
      { a: -1.42, kind: 'spirit', note: "Spirit, Opportunity's twin, got stuck in soft sand in 2009 and carried on working as a weather station for months." },
      { a: -1.86, kind: 'sojourner', note: 'Sojourner (1997): the very first rover on Mars, about the size of a microwave oven.' },
      { a: -2.3, kind: 'viking', note: 'Viking 1 (1976) worked on Mars for over six years and sent back the first colour photos from its surface.' },
    );
    for (const d of decor) if (d.drive) d.dir = 1;
    // Inside the crust: rock, buried water ice, and hematite "blueberries"
    // (little iron spheres Opportunity found by the thousand)
    const crust = [];
    for (let i = 0; i < 90; i++) {
      const r = rnd();
      crust.push({ a: rnd() * TAU, rf: 0.905 + rnd() * 0.075, kind: r < 0.5 ? 'rock' : r < 0.75 ? 'ice' : 'berry', hue: Math.floor(rnd() * 3) });
    }
    const swirls = [];
    for (let i = 0; i < 22; i++) swirls.push({ a: rnd() * TAU, rf: 0.58 + rnd() * 0.26, len: 0.12 + rnd() * 0.28 });
    // The view behind the base: three bands of plain, with the great volcanoes
    // on them. Angles are where each sits when you start.
    const scape = [
      { f: 0.3, sink: 0.6, top: 60, col: '#8c4a33', volc: [{ a: -0.2, h: 125, w: 0.7, name: 'OLYMPUS MONS', sub: '22 km high, the biggest volcano we know' }] },
      { f: 0.5, sink: 0.74, top: 38, col: '#a3553a', volc: [
        { a: 0.68, h: 60, w: 0.15, name: 'ARSIA MONS' }, { a: 0.95, h: 64, w: 0.15, name: 'PAVONIS MONS', sub: 'THE THARSIS MONTES' }, { a: 1.22, h: 62, w: 0.15, name: 'ASCRAEUS MONS' },
        { a: 2.7, h: 62, w: 0.2, name: 'ELYSIUM MONS' },
      ] },
      { f: 0.72, sink: 0.87, top: 18, col: '#b4613f', canyon: { a: -1.25, w: 0.4, d: 16, name: 'VALLES MARINERIS', sub: '4,000 km long' } },
    ];
    const sky = [];
    for (let i = 0; i < 240; i++) sky.push({ x: rnd(), y: rnd(), s: rnd() < 0.12 ? 2 : 1, tw: rnd() * TAU });
    return { seed, plats, stars, decor, crust, swirls, sky, ranges: [], scape, issPlat: null, beams, dust, rocks };
  }

  // ---- State ----------------------------------------------------------------
  const player = { r: R0, vr: 0, vx: 0, onGround: true, facing: 1, walkT: 0, squash: 0, speed: 1 };
  let theta = 0;
  let lastTier = -1;
  let bestTier = -1;
  let state = 'title';
  let playTime = 0;
  let particles = [];
  let cam = { r: R0, anchor: 0, zoom: 1 };
  let view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let toastTimer = 0;
  let clock = 0;
  // Juice: screen shake, landing rings, floating text, afterimages, banners
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shake = 0;
  let fx = { geoms: [], flames: [], craters: [], puffs: [], rings: [], pops: [], trail: [], trailT: 0, banner: null, flash: 0, streak: 0, whistled: false, shooting: [], shootT: 2, meteors: [], meteorT: 4, visitor: null, dedication: 0 };
  const tilt = { on: false, axis: 0, zero: null, got: false };
  let score = 0;        // points this run, each award multiplied by mult
  let mult = 1;         // Geometry Wars-style multiplier: +1 per geom, back to x1 on a miss
  let checkpoint = 0;   // highest checkpoint layer reached this run
  let falls = 0;        // misses this run (caught at a checkpoint or back on Earth)
  let heightRecordShown = false;
  let flipK = 0;        // level 3: 0 normal, 1 turned sideways (see FLIP)
  let flipA = 0;        // the angle the world is drawn turned by this frame

  // ---- Personal bests (kept on this device only) ----------------------------
  const STORE_KEY = 'supertramp.v1';
  const MEDAL = { none: 0, bronze: 1, silver: 2, gold: 3 };
  const MEDAL_NAMES = ['none', 'bronze', 'silver', 'gold'];
  // Time medals are first guesses; tune them once people have played.
  const TIME_MEDALS = [[30, 'gold'], [45, 'silver'], [75, 'bronze']];
  const MODES = {
    checkpoint: { name: 'Checkpoint mode', short: 'Checkpoint' },
    uber: { name: 'Uber Tramp mode', short: 'Uber Tramp' },
  };
  let mode = 'checkpoint';
  function loadBests() {
    const blank = () => ({ runs: 0, wins: 0, bestTime: null, bestStars: 0, bestTier: -1, timeMedal: 0, starMedal: 0, flawless: false });
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { saved = null; }
    saved = saved || {};
    // Records from before modes existed were all made with checkpoints.
    if ('runs' in saved && !saved.checkpoint) saved = { checkpoint: saved };
    return { last: saved.last === 'uber' ? 'uber' : 'checkpoint', checkpoint: { ...blank(), ...(saved.checkpoint || {}) }, uber: { ...blank(), ...(saved.uber || {}) } };
  }
  function saveBests() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(bests)); } catch (e) { /* storage unavailable: bests last for this visit */ }
  }
  let bests = loadBests();
  mode = bests.last;
  const rec = () => bests[mode];
  const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const timeMedal = (t) => (TIME_MEDALS.find(([limit]) => t <= limit) || [0, 'none'])[1];
  const starMedal = (got, total) => (got >= total ? 'gold' : got >= total * (2 / 3) ? 'silver' : got >= total / 3 ? 'bronze' : 'none');

  const keys = { left: false, right: false };
  const touch = window.matchMedia('(pointer: coarse)').matches;
  let jumpBuffer = 0;

  function reset(seed) {
    world = buildWorld(seed);
    Object.assign(player, { r: R0, vr: 0, vx: 0, onGround: true, facing: 1, walkT: 0, squash: 0, speed: 1, apexR: R0, lastPlat: null, lastH: 0, heat: 0, suit: level >= 2, field: 0, inside: false, g: gravAt(0), shield: 0, hurt: 0, grit: 0 });
    theta = 0; lastTier = -1; bestTier = -1; playTime = 0; particles = [];
    fx = { geoms: [], flames: [], craters: [], puffs: [], rings: [], pops: [], trail: [], trailT: 0, banner: null, flash: 0, streak: 0, whistled: false, shooting: [], shootT: 2, meteors: [], meteorT: 4, visitor: null, dedication: 0 };
    checkpoint = 0; falls = 0; heightRecordShown = false;
    score = 0; mult = 1; fx.geoms = [];
    updateScoreHud();
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
  const fmtScore = (n) => Math.round(n).toLocaleString('en-GB');
  function updateScoreHud(bump) {
    if (!hud.score) return;
    hud.score.textContent = fmtScore(score);
    hud.mult.textContent = `x${mult}`;
    if (bump) { hud.mult.classList.remove('bump'); void hud.mult.offsetWidth; hud.mult.classList.add('bump'); }
  }
  function addScore(pts, a, R) {
    const gained = Math.round(pts * mult);
    score += gained;
    updateScoreHud();
    if (a !== undefined) fx.pops.push({ a, R, text: `+${fmtScore(gained)}`, color: '#eef1ff', t: 0, small: true });
    return gained;
  }
  function addMult(a, R) {
    mult += 1;
    sfx.geom(mult);
    if (a !== undefined) fx.pops.push({ a, R: R + 18, text: `x${mult}`, color: '#6dff7a', t: 0 });
    updateScoreHud(true);
  }
  function loseMult() {
    if (mult > 1) { pop(`x${mult} LOST`, '#ff5a4a', player.r + 150); sfx.multLost(); }
    mult = 1;
    updateScoreHud(true);
  }
  // Green geoms burst out on big moments and drift about; grab them before they fade.
  function spawnGeoms(n, a, R) {
    for (let i = 0; i < n; i++) {
      fx.geoms.push({ a: a + ((Math.random() - 0.5) * 60) / R, R: R + 30 + Math.random() * 40, vt: (Math.random() - 0.5) * 260, vr: 60 + Math.random() * 160, t: 0, life: 5 + Math.random(), spin: Math.random() * TAU });
    }
  }

  // On level 2 only the stars along your route count (the other route's are out of reach)
  // Once you've picked a route, the other one is a ghost: see-through and not solid
  const ghost = (q) => level === 2 && route && q.route && q.route !== route && q.tier > 0;
  const routeStars = () => (level === 2 ? world.stars.filter((s) => s.route === (route || 'mars')) : world.stars);
  function updateStarsHud(popIt) {
    const list = routeStars();
    const got = list.filter((s) => s.taken).length;
    hud.stars.textContent = `◆ ${got} / ${list.length}`;
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
  const destName = () => (level === 3 ? (landedOn ? landedOn.name : 'the asteroid belt') : level === 2 ? (route === 'venus' ? 'Venus' : 'Mars') : 'the Moon');
  function layerName() {
    if (player.onGround) return lastTier === TOP ? `On ${destName()}` : level === 3 ? 'On Mars' : level === 2 ? 'On the Moon' : 'On the ground';
    const k = Math.floor(tierFloat(player.r));
    return k === 0 ? (level === 3 ? 'Jezero base' : level === 2 ? 'Moon base' : 'Troposphere') : TIERS[k].layer;
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
      if (route && p.route && p.route !== route) continue;
      const d = wrap(p.a + theta) * p.R;
      if (Math.abs(d) < Math.abs(bestD)) { best = p; bestD = d; }
    }
    return best ? { p: best, d: bestD, lined: Math.abs(bestD) <= best.w / 2 + 4 } : null;
  }

  // ---- Particles ------------------------------------------------------------
  // Haptics (Android; iPhones ignore it). Off whenever sound effects are off.
  const buzz = (pattern) => {
    try { if (navigator.vibrate && (!snd || snd.sfxOn) && state === 'play') navigator.vibrate(pattern); } catch (e) { /* not allowed */ }
  };

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
  function chooseRoute(rt) {
    route = rt;
    useTiers();
    updateStarsHud();
    banner(rt === 'mars' ? 'TO MARS' : 'TO VENUS', rt === 'mars' ? 'THE RED PLANET' : 'THE HOTTEST PLANET');
    sfx.tier();
  }
  function land(p) {
    if (p === world.issPlat && !player.suit && p.ride.state === 'near') { dock(p); return; }
    if (level === 2 && p.tier === 0 && p.route !== route) chooseRoute(p.route);
    const off = Math.abs(wrap(p.a + theta) * p.R);
    if (player.heat > 0.3) {
      // Put out by the landing: a hiss of steam
      for (let i = 0; i < 12; i++) fx.puffs.push({ a: -theta, R: p.R + 6, vt: (Math.random() - 0.5) * 220, vr: 60 + Math.random() * 140, r: 5 + Math.random() * 8, t: 0, life: 0.7 + Math.random() * 0.5, nlc: false });
      sfx.sizzle();
      pop('PHEW!', '#8fd0ff', player.r + 90);
      player.heat = 0; fx.flames = [];
    }
    player.r = p.R;
    p.squash = 1;
    player.squash = 1;
    fx.whistled = false;
    if (p.dest) {
      if (p.world) landedOn = p.world;
      player.vr = 0; player.onGround = true;
      lastTier = TOP; bestTier = TOP;
      win();
      return;
    }
    // Rebound: a platform throws you back as high as you fell from. Each repeat
    // bounce on the same platform halves the extra height until it's back to normal.
    player.speed = speedFor(p.tier);
    player.g = p.g || 1;
    const normalH = tierR(p.tier + 1) - tierR(p.tier) + OVERSHOOT;
    const fellFrom = player.apexR - p.R;
    let bounceH = fellFrom > normalH + 20 ? fellFrom : normalH;
    if (p === player.lastPlat && player.lastH > normalH) bounceH = normalH + (player.lastH - normalH) / 2;
    if (bounceH - normalH < 20) bounceH = normalH;
    const rebound = bounceH > normalH && p !== player.lastPlat;
    player.lastPlat = p; player.lastH = bounceH; player.apexR = p.R;
    player.vr = bounceH > normalH ? player.speed * Math.sqrt(2 * G * player.g * bounceH) : p.bounce;
    if (rebound && bounceH > normalH + 150) pop('REBOUND!', '#8fd0ff', player.r + 110);
    p.jig = 0; p.hit = Math.min(1.6, 0.8 + (player.vr / p.bounce - 1) * 0.6);
    const climbed = p.tier > lastTier;
    lastTier = p.tier;
    sfx.boing(p.tier, player.speed);
    buzz(12);
    const puff = p.type === 'cloud' || p.type === 'balloon' || p.type === 'nlc' || p.type === 'cloudm' ? '#ffffff' : '#ffd23f';
    if (p.type === 'cloud' || p.type === 'nlc' || p.type === 'cloudm') {
      const n = 7 + Math.round(p.hit * 4);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        fx.puffs.push({ a: -theta, R: p.R - 4 - Math.random() * 10, vt: side * (40 + Math.random() * 110) * p.hit, vr: 20 + Math.random() * 60, r: 5 + Math.random() * 7, t: 0, life: 0.6 + Math.random() * 0.4, nlc: p.type === 'nlc' });
      }
    }
    burst(-theta, p.R, puff, 12, 200);
    ring(-theta, p.R, puff);
    addShake(2 + player.speed * 1.5);
    addScore(10 * (p.tier + 1), -theta, p.R + 60);
    if (off < 10 && p.tier > 0) {
      addScore(100);
      spawnGeoms(3, -theta, p.R);
      pop('PERFECT!', '#52e07a');
      sfx.perfect();
      burst(-theta, p.R, '#52e07a', 10, 260);
      ring(-theta, p.R, '#52e07a', 1.6);
    }
    if (mode === 'checkpoint' && p.main && CHECKPOINTS.has(p.tier) && p.tier > checkpoint) {
      checkpoint = p.tier;
      pop('CHECKPOINT', '#52e07a', player.r + 130);
    }
    if (p.tier > bestTier) {
      addScore(500);
      spawnGeoms(p.tier > 0 && TIERS[p.tier].layer !== TIERS[p.tier - 1].layer ? 5 : 2, -theta, p.R);
      bestTier = p.tier;
      if (bestTier > rec().bestTier) {
        if (rec().bestTier >= 1 && !heightRecordShown) {
          heightRecordShown = true;
          pop('NEW HEIGHT RECORD!', '#ffd23f', player.r + 160);
          sfx.perfect();
        }
        rec().bestTier = bestTier;
        saveBests();
      }
      fx.streak = climbed ? fx.streak + 1 : 1;
      if (fx.streak >= 3) pop(`${fx.streak} IN A ROW`, '#ffab3d', player.r + 100);
      const prevLayer = p.tier > 0 ? TIERS[p.tier - 1].layer : null;
      if (p.tier > 0 && TIERS[p.tier].layer !== prevLayer) {
        banner(TIERS[p.tier].layer.toUpperCase(), fmtKm(TIERS[p.tier].km));
        sfx.tier();
        fx.flash = 0.35;
      }
      if (TIERS[p.tier].note) toast(TIERS[p.tier].note);
      else if (p.tier === 0) toast(level === 3 ? "Boing! Mars's gravity is just over a third of Earth's. Follow the arrow up through the clouds." : level === 2 ? 'Boing! Low gravity: you float. Follow the arrow up to the rockets.' : 'Boing! Steer toward the arrow to reach the clouds.');
      if (TIERS[p.tier].visitor) fx.visitor = { kind: TIERS[p.tier].visitor, t: 0, told: false, dir: Math.random() < 0.5 ? -1 : 1 };
    }
    if (level === 3 && p.main && (p.tier === FLIP || p.type === 'outpost') && player.field < FIELD_MAX) meetBeing(p);
    if (p.ride && (p.ride.state === 'near' || p.ride.state === 'loop')) startRide(p);
  }

  // A fireball hits the ground: boom, big shake, crater.
  function impact(h) {
    buzz([60, 40, 120]);
    const a = -theta, mars = level === 3;
    sfx.boom(h);
    addShake(14 + h * 16);
    fx.flash = 0.45 + h * 0.3;
    ring(a, R0, '#ffb23a', 2.2);
    ring(a, R0, '#ffffff', 1.4);
    burst(a, R0, mars ? '#b4532f' : '#8a5a3b', 26, 320);
    burst(a, R0, mars ? '#7a2e1c' : '#5a3a28', 16, 420);
    burst(a, R0, '#ffb23a', 20, 260);
    burst(a, R0, '#fff3b0', 10, 200);
    for (let i = 0; i < 16; i++) fx.puffs.push({ a, R: R0 + 4, vt: (Math.random() - 0.5) * 320, vr: 40 + Math.random() * 160, r: 8 + Math.random() * 12, t: 0, life: 1 + Math.random() * 0.8, nlc: false, smoke: true });
    fx.craters.push({ a, t: 0, size: 0.8 + h * 0.6, mars });
    pop('KABOOM!', '#ffb23a', R0 + 120);
    toast(mars ? "Mars has just enough air to set you on fire, and not enough to slow you down. That's why landing there is so hard. Find the launch pad." : 'Crash landing! Find a trampoline to get back up.', mars ? 5 : 3.2);
  }

  // A hard landing on the Moon: no air, so no fire. Just a new crater.
  let craterFactShown = false;
  function moonCrash() {
    const a = -theta;
    buzz([40, 30, 80]);
    sfx.thud();
    addShake(12);
    ring(a, R0, '#d9d7e0', 2);
    burst(a, R0, '#b4b2be', 26, 280);
    burst(a, R0, '#8a8896', 16, 360);
    for (let i = 0; i < 14; i++) fx.puffs.push({ a, R: R0 + 4, vt: (Math.random() - 0.5) * 300, vr: 30 + Math.random() * 120, r: 6 + Math.random() * 10, t: 0, life: 1.4 + Math.random(), nlc: false, dust: true });
    fx.craters.push({ a, t: 0, size: 0.9, moon: true });
    pop('THUD!', '#d9d7e0', R0 + 110);
    if (!craterFactShown) { craterFactShown = true; toast("No air on the Moon, so you don't burn up on the way down. You just make a crater, like the millions already here.", 5); }
    else toast('Back on the Moon. Find a launch pad!', 2.6);
  }

  // Caught by the last checkpoint: drop back onto its platform from just above.
  function rescue() {
    const p = world.plats.find((q) => q.tier === checkpoint && q.main && (!route || !q.route || q.route === route));
    if (!p) return;
    player.heat = 0; fx.flames = [];
    player.g = p.g || 1;
    falls++;
    loseMult();
    theta = -p.a;
    player.r = p.R + 170; player.vr = -150; player.vx = 0;
    player.apexR = player.r; player.lastPlat = null; player.lastH = 0;
    player.speed = speedFor(Math.max(0, checkpoint - 1));
    lastTier = checkpoint - 1; fx.streak = 0; fx.whistled = false; fx.trail = [];
    cam.r = player.r - 260;
    fx.flash = 0.25;
    ring(-theta, player.r, '#52e07a', 1.2);
    sfx.tier();
    toast(`Caught at the ${TIERS[checkpoint].layer} checkpoint.`, 2.5);
  }

  const riding = (p) => player.lastPlat === p && !player.onGround && state === 'play';
  function updateRide(p, dt) {
    const r = p.ride;
    if (r.state === 'loop') {
      // Lumen cruises round and slows down as he passes you, so you can time a jump
      const ph = wrap(p.a + theta);
      const slow = 0.28 + 0.72 * clamp((Math.abs(ph) - 0.05) / 0.5, 0, 1);
      p.a += r.w * slow * dt; p.a0 = p.a;
      return;
    }
    if (r.state === 'moving' || r.state === 'returning') {
      r.t += dt;
      const u = clamp(r.t / RIDE_TIME, 0, 1);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const na = r.from + (r.to - r.from) * e;
      const d = na - p.a;
      p.a = p.a0 = na;
      if (riding(p)) theta -= d; // carry the tramp along with it
      if (u >= 1) {
        if (r.kind === 'car') { r.state = 'far'; if (riding(p)) slingshot(p); }
        else r.state = r.to === r.far ? 'far' : 'near';
        r.idle = 0;
        if (player.inside && player.lastPlat === p) eject(p);
      }
    } else if (r.state === 'far') {
      // If you fell off on the way, it heads back to pick you up.
      const away = Math.abs(wrap(p.a + theta)) > Math.PI / 2;
      r.idle = !riding(p) && away ? r.idle + dt : 0;
      if (r.idle > 2) {
        if (r.kind === 'car') r.state = 'loop';
        else { r.state = 'returning'; r.from = r.far; r.to = r.near; r.t = 0; }
      }
    }
  }
  // Docking with the Space Station: in you go, out you come in a spacesuit.
  function dock(p) {
    player.inside = true;
    player.lastPlat = p; player.onGround = false;
    player.vr = 0; player.vx = 0; player.heat = 0; fx.flames = []; fx.trail = [];
    if (p.tier > lastTier) lastTier = p.tier;
    if (p.tier > bestTier) { bestTier = p.tier; addScore(500); }
    startRide(p);
    banner('DOCKING', 'SPACE STATION');
    toast('Docked with the Space Station. Suiting up for space…', 4);
    sfx.airlock();
    ring(-theta, p.R + 12, '#8fd0ff', 1.2);
    for (let i = 0; i < 10; i++) fx.puffs.push({ a: -theta, R: p.R + 12, vt: (Math.random() - 0.5) * 160, vr: (Math.random() - 0.2) * 120, r: 4 + Math.random() * 6, t: 0, life: 0.6 + Math.random() * 0.4, nlc: true });
  }
  function eject(p) {
    player.inside = false;
    player.suit = true;
    player.speed = speedFor(p.tier);
    player.r = p.R; player.vr = p.bounce * 1.05;
    player.apexR = p.R; player.lastH = 0; player.squash = -0.6;
    lastTier = p.tier;
    addScore(750);
    sfx.airlock(); sfx.tier();
    fx.flash = 0.35;
    ring(-theta, p.R + 12, '#ffffff', 1.6);
    for (let i = 0; i < 18; i++) fx.puffs.push({ a: -theta, R: p.R + 14, vt: (Math.random() - 0.5) * 320, vr: 80 + Math.random() * 200, r: 5 + Math.random() * 9, t: 0, life: 0.8 + Math.random() * 0.6, nlc: false });
    pop('SPACESUIT ON!', '#ff9a3a', player.r + 120);
    banner('SPACESUIT ON', 'READY FOR DEEP SPACE');
    toast('A real spacesuit weighs about 145 kg on Earth. Up here, it keeps you alive.', 5);
  }

  function startRide(p) {
    const r = p.ride;
    addScore(250);
    r.state = 'moving'; r.from = r.near; r.to = r.far; r.t = 0;
    if (r.kind === 'car') {
      // From wherever he is, Lumen drives on round to where the next layer waits
      let d = (((r.far - p.a) % TAU) + TAU) % TAU;
      if (d < 1.2) d += TAU;
      r.from = p.a; r.to = p.a + d;
      player.shield = 24;
      pop('SHIELD ON!', '#8fd0ff', player.r + 130);
      sfx.airlock();
    } else if (r.kind === 'comet' || r.kind === 'hauler') {
      player.shield = 16;
      pop('ICE SHIELD!', '#8fd0ff', player.r + 130);
    }
    banner(level >= 2 ? 'HITCHING A RIDE' : 'AROUND THE WORLD', r.title);
    toast(r.fact, 5);
    sfx.tier();
    fx.flash = 0.2;
  }

  // End of Lumen's ride: he floors it and flings you on, the biggest boost in the level
  function slingshot(p) {
    player.g = p.g || 0.55;
    player.speed = speedFor(p.tier);
    const h = TIER_GAP * 2 + OVERSHOOT;
    player.vr = player.speed * Math.sqrt(2 * G * player.g * h);
    player.apexR = p.R; player.lastPlat = p; player.lastH = h; player.squash = -0.6;
    addScore(1000, -theta, p.R + 60);
    pop('SLINGSHOT!', '#ff9a3a', player.r + 120);
    fx.flash = 0.3; addShake(8);
    sfx.whoosh(); sfx.tier();
    toast('📻 "Hold on to your helmet, kid!"', 3);
  }

  // ---- Space hazards (level 2) ------------------------------------------------
  const beamState = (b) => { const u = (clock + b.phase) % b.period; return u < 1.1 ? 'warn' : u < 1.8 ? 'on' : 'off'; };
  function spaceHit(label, knock) {
    if (player.hurt > 0) return;
    player.hurt = 1;
    if (player.shield > 0) {
      player.shield = Math.max(0, player.shield - 3);
      pop('SHIELDED!', '#8fd0ff', player.r + 110);
      ring(-theta, player.r + 24, '#8fd0ff', 1.2);
      sfx.perfect();
      return;
    }
    pop(label, '#ff5a4a', player.r + 110);
    if (mult <= 1) sfx.thud();
    loseMult();
    addShake(7);
    buzz([20, 30, 40]);
    burst(-theta, player.r + 24, '#ffb23a', 14, 220);
    if (knock && player.vr > -200) player.vr = -200;
  }
  let radioAt = 0;
  let monolithSeen = false;
  // Level 3: hitting an asteroid. With the force field you bounce off it like
  // a pinball (land on top of one and it throws you on); without, it knocks
  // you back the way you came.
  const FIELD_MAX = 5;
  function bump(q, nx, ny, overlap) {
    q.cool = 0.35; q.flash = 1;
    player.r -= ny * overlap;
    theta += (nx * overlap) / player.r;
    // The ice hauler's shield works as a force field too, without using it up
    if (player.field > 0 || player.shield > 0) {
      if (player.shield <= 0) player.field--;
      // Bounce off: reflect the way you were going, with a bit extra
      let vx = player.vx, vr = player.vr;
      const into = vx * nx + vr * ny;
      if (into > 0) { vx -= 2 * into * nx; vr -= 2 * into * ny; }
      const away = -(vx * nx + vr * ny), min = 480 * Math.sqrt(player.speed);
      if (away < min) { vx -= nx * (min - away); vr -= ny * (min - away); }
      player.vx = vx * 1.1; player.vr = vr * 1.1;
      player.apexR = player.r; player.lastPlat = null; player.lastH = 0;
      addScore(100, -theta, player.r + 40);
      pop(player.shield > 0 ? 'BOING!' : player.field ? `BOING! FIELD ${player.field}` : 'FIELD GONE!', player.field || player.shield > 0 ? '#ff6ad5' : '#ffab3d', player.r + 100);
      if (!player.field && player.shield <= 0) toast('Force field used up. Grab geoms to charge it again!', 3);
      sfx.boing(TOP, 1.6);
      ring(q.a, q.R, '#ff6ad5', q.r / 26);
      burst(-theta, player.r + 24, '#ff6ad5', 12, 240);
      addShake(5);
      buzz(15);
      return;
    }
    // No field: a big shove back towards Mars
    player.vr = -Math.max(650, Math.abs(player.vr)) * Math.sqrt(player.speed);
    player.vx = -nx * 420;
    spaceHit('KNOCKED BACK!', false);
    ring(q.a, q.R, '#ffab3d', q.r / 26);
  }
  // The being of light in the belt: it hums its five notes and gives you a
  // force field (and tops it up again at the outpost)
  function meetBeing(p) {
    const first = !fx.metBeing;
    fx.metBeing = true;
    player.field = FIELD_MAX;
    p.beingT = clock;
    sfx.hum();
    pop('FORCE FIELD!', '#ff6ad5', player.r + 140);
    ring(-theta, player.r + 24, '#ff6ad5', 1.6);
    fx.flash = 0.3;
    if (first) toast('A being of light hums five notes and wraps you in a force field. Now you can bounce off the asteroids! Each bounce uses a charge; geoms top it up.', 7);
  }

  function updateSpace(dt) {
    if (fx.dedication > 0) fx.dedication -= dt;
    // Walk past something on the ground to hear about it
    if (player.onGround && player.r <= R0 + 1) {
      for (const d of world.decor) {
        if (d.note && !d.seen && Math.abs(wrap(d.a + theta)) * R0 < 28) { d.seen = true; toast(d.note, 6); }
      }
    }
    // The rovers that still work potter about
    for (const d of world.decor) {
      if (!d.drive) continue;
      const na = d.drive.a0 + d.drive.span * Math.sin(clock * d.drive.w + d.drive.ph);
      if (Math.abs(na - d.a) > 1e-6) d.dir = Math.sign(na - d.a);
      d.a = na;
    }
    if (!monolithSeen && player.onGround && player.r <= R0 + 1) {
      const mono = world.decor.find((d) => d.kind === 'monolith');
      if (mono && Math.abs(wrap(mono.a + theta)) * R0 < 30) { monolithSeen = true; toast('A black slab, perfectly smooth. Nobody knows who left it here…', 4.5); sfx.jingle && sfx.jingle('uber'); }
    }
    player.shield = Math.max(0, (player.shield || 0) - dt);
    player.hurt = Math.max(0, (player.hurt || 0) - dt);
    const k = clamp(Math.floor(tierFloat(player.r)), 0, TOP);
    const T = TIERS[k];
    const air = !player.onGround && !player.inside;
    for (const q of world.rocks || []) {
      q.a = q.c + q.amp * Math.sin(clock * q.freq + q.ph);
      q.flash = Math.max(0, q.flash - dt * 2.5);
      q.cool = Math.max(0, q.cool - dt);
      if (!air || q.cool > 0) continue;
      const ph = q.a + theta, bodyR = player.r + 24;
      const dx = q.R * Math.sin(ph), dy = q.R * Math.cos(ph) - bodyR, d = Math.hypot(dx, dy) || 1;
      if (d < q.r + 16) bump(q, dx / d, dy / d, q.r + 16 - d);
    }
    // Solar wind pushes you sideways, unless you're shielded
    if (air && T.wind && player.shield <= 0) theta -= (T.wind * 70 * dt) / player.r;
    // Dust clouds: hang about inside one and it sandblasts you
    let inDust = false;
    for (const d of world.dust || []) if (d.route === route && Math.abs(wrap(d.a + theta)) * d.R < 120 && Math.abs(player.r + 24 - d.R) < 80) inDust = true;
    if (air && inDust) {
      if (player.shield > 0) player.shield = Math.max(0, player.shield - dt * 2);
      else { player.grit += dt; if (player.grit > 1.1) { player.grit = 0; spaceHit('SANDBLASTED!', false); } }
    } else player.grit = Math.max(0, player.grit - dt);
    // Radiation bursts: a flicker of warning, then a blast
    for (const b of world.beams || []) {
      if (!air || b.route !== route || beamState(b) !== 'on') continue;
      const R1 = tierR(b.tier) + 40, R2 = tierR(b.tier + 1) - 40;
      if (player.r + 24 > R1 && player.r < R2 && Math.abs(wrap(b.a + theta)) * player.r < 22) spaceHit(b.kind === 'laser' ? 'MINING LASER!' : 'RADIATION!', false);
    }
    // Flaming meteors streak across, like in the drawing
    fx.meteorT -= dt;
    if (fx.meteorT <= 0 && k >= 2 && lastTier < TOP && (level === 2 || (flipK < 0.05 && k < FLIP))) {
      fx.meteorT = 5 + Math.random() * 5;
      const side = Math.random() < 0.5 ? -1 : 1;
      const R = player.r + 40 + Math.random() * 190;
      fx.meteors.push({ a: -theta + (side * W * 0.75) / R, R, va: (-side * (300 + Math.random() * 140)) / R, t: 0 });
      sfx.whoosh();
    }
    for (const m of fx.meteors) {
      m.t += dt; m.a += m.va * dt;
      if (!m.hit && air && Math.abs(wrap(m.a + theta)) * m.R < 26 && Math.abs(m.R - (player.r + 24)) < 30) { m.hit = true; spaceHit('METEOR!', true); }
    }
    fx.meteors = fx.meteors.filter((m) => m.t < 8);
    if (fx.visitor) {
      fx.visitor.t += dt;
      if (!fx.visitor.told && fx.visitor.t > 2) { fx.visitor.told = true; toast(VISITORS[fx.visitor.kind], 6); }
      if (fx.visitor.t > 9) fx.visitor = null;
    }
  }

  function update(dt) {
    clock += dt;
    if (state === 'splash' || state === 'descend') { updateIntro(dt); return; }
    for (const p of world.plats) {
      if (p.sway) p.a = p.a0 + p.sway * Math.sin(clock * p.freq + p.phase);
      if (p.ride) updateRide(p, dt);
      p.squash = Math.max(0, p.squash - dt * 4);
      p.jig += dt;
    }

    if (state === 'title') {
      // Attract mode: stroll along so the world turns behind the title card.
      player.vx = 80; player.facing = 1;
      theta -= (player.vx * dt) / player.r;
      player.walkT += dt * 5;
    } else if (state === 'play') {
      playTime += dt;
      const kdir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const dir = player.inside ? 0 : kdir !== 0 ? kdir : tilt.on ? tilt.axis : 0;
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
          burst(-theta, R0, level === 3 ? '#c8603c' : level === 2 ? '#b4b2be' : '#c9a27a', 2, 50);
        }
      }

      jumpBuffer -= dt;
      if (player.onGround && jumpBuffer > 0) {
        player.vr = HOP_V; player.speed = 1; player.onGround = false; jumpBuffer = 0; player.g = gravAt(0);
        player.apexR = player.r; player.lastPlat = null; player.lastH = 0;
        player.squash = -0.6;
        sfx.hop();
        burst(-theta, R0, level === 3 ? '#c8603c' : level === 2 ? '#b4b2be' : '#c9a27a', 5, 80);
      }
      if (player.inside) {
        player.r = player.lastPlat.R + 14; player.vr = 0; player.vx = 0;
      }
      // Hit the Space Station (from above or below) to dock and suit up
      const iss = world.issPlat;
      if (iss && !player.suit && !player.inside && iss.ride.state === 'near'
        && Math.abs(wrap(iss.a + theta) * iss.R) < iss.w / 2 + 6 && Math.abs(player.r - (iss.R + 10)) < 34) dock(iss);
      if (!player.onGround && !player.inside) {
        const prev = player.r;
        player.apexR = Math.max(player.apexR || player.r, player.r);
        player.vr = Math.max(player.vr - G * (player.g || 1) * player.speed * player.speed * dt, -1600 * player.speed);
        player.r += player.vr * dt;
        if (player.vr < 0) {
          let landed = false;
          for (const p of world.plats) {
            if (ghost(p)) continue;
            if (prev >= p.R && player.r <= p.R && Math.abs(wrap(p.a + theta) * p.R) <= p.w / 2 + 8) { land(p); landed = true; break; }
          }
          // Missed Lumen as he drove past: he'll be round again
          if (!landed && level === 2 && clock > radioAt) {
            for (const p of world.plats) {
              if (p.ride && p.ride.kind === 'car' && p.ride.state === 'loop' && prev >= p.R && player.r < p.R) { radioAt = clock + 8; toast('📻 "Next time, kid." Lumen will be round again.', 3.2); }
            }
          }
        }
        // Missed: whistle on the way down
        if (!fx.whistled && lastTier >= 0 && player.vr < -500 && player.r < tierR(lastTier) - 40) {
          fx.whistled = true; fx.streak = 0; sfx.fall();
        }
        if (state === 'play' && mode === 'checkpoint' && checkpoint > 0 && player.vr < 0 && player.r < tierR(checkpoint) - 180) rescue();
        if (state === 'play' && player.r <= R0) {
          const hard = player.vr < -900;
          if (lastTier >= 0) { falls++; loseMult(); }
          player.r = R0; player.vr = 0; player.onGround = true; player.squash = 1;
          if (player.heat > 0.3) impact(player.heat);
          else if (level === 2 && hard) moonCrash();
          else if (lastTier >= 0) { toast(level === 3 ? 'Back on Mars. Find the launch pad!' : level === 2 ? 'Back on the Moon. Find a launch pad!' : 'Back on solid ground. Find a trampoline!'); sfx.thud(); addShake(hard ? 12 : 6); ring(-theta, R0, level === 3 ? '#c8603c' : level === 2 ? '#b4b2be' : '#c9a27a', 1.4); }
          if (level === 2) { route = null; updateStarsHud(); }
          player.heat = 0; fx.flames = [];
          lastTier = -1; fx.streak = 0; fx.whistled = false;
          player.lastPlat = null; player.lastH = 0;
          burst(-theta, R0, level === 3 ? '#9a3b2a' : level === 2 ? '#8a8896' : '#8a5a3b', hard ? 18 : 8, hard ? 180 : 90);
        }
      }

      // Stars are green geoms: pulled in when you're close, +1 multiplier each.
      const bodyR = player.r + 24;
      const pull = (g, range) => {
        const ph = g.a + theta;
        const dx = g.R * Math.sin(ph), dy = g.R * Math.cos(ph) - bodyR;
        const d = Math.hypot(dx, dy);
        if (d < range) {
          const k = Math.min(1, dt * (4 + (1 - d / range) * 10));
          g.R += (bodyR - g.R) * k;
          g.a += wrap(-theta - g.a) * k;
        }
        return d;
      };
      for (const s of world.stars) {
        if (s.taken || ghost(s)) continue;
        const d = pull(s, s.big ? 200 : 150);
        if (d < (s.big ? 60 : 28)) {
          s.taken = true;
          if (s.fact) { toast(s.fact.text, 6); addScore(500); pop(s.fact.kind === 'marsrock' ? 'MARS ROCK!' : 'SPACE PROBE!', '#ffab3d', player.r + 140); }
          sfx.star(mult);
          burst(s.a, s.R, '#6dff7a', 16, 170);
          ring(s.a, s.R, '#6dff7a', 0.8);
          addMult(s.a, s.R);
          addScore(25);
          updateStarsHud(true);
          if (level === 3 && fx.metBeing && player.field < FIELD_MAX) player.field++;
        }
      }
      for (const g of fx.geoms) {
        g.t += dt;
        g.R += g.vr * dt; g.a += (g.vt * dt) / g.R;
        g.vr *= 1 - dt * 2.2; g.vt *= 1 - dt * 2.2;
        if (pull(g, 170) < 26) {
          g.t = g.life;
          burst(g.a, g.R, '#6dff7a', 8, 120);
          if (level === 3 && fx.metBeing && player.field < FIELD_MAX) player.field++;
          addMult(g.a, g.R);
          addScore(25);
        }
      }
      fx.geoms = fx.geoms.filter((g) => g.t < g.life);
      if (level >= 2) updateSpace(dt);
    }

    player.squash = player.squash > 0 ? Math.max(0, player.squash - dt * 5) : Math.min(0, player.squash + dt * 4);
    // Re-entry: only a real miss heats you up. It's measured below the platform
    // you last bounced off, so rebounds and near misses never catch fire.
    const launchR = player.lastPlat ? player.lastPlat.R : R0;
    const below = !player.onGround && player.vr < 0 ? launchR - player.r : 0;
    // Mars has air too, thinner than Earth's: falls heat up a little less, and
    // only once you're back down in its sky
    const marsAir = level === 3 && player.r < tierR(3);
    const heatWant = state === 'play' && (level === 1 || marsAir) ? clamp((below - 100) / 400, 0, 1) * (marsAir ? 0.85 : 1) : 0;
    player.heat = (player.heat || 0) + (heatWant - (player.heat || 0)) * Math.min(1, dt * (heatWant > (player.heat || 0) ? 7 : 10));
    if (player.heat > 0.05 && state === 'play') {
      const n = Math.ceil(player.heat * 4);
      for (let i = 0; i < n; i++) {
        fx.flames.push({ a: -theta + ((Math.random() - 0.5) * 22) / player.r, R: player.r + 10 + Math.random() * 30, vt: (Math.random() - 0.5) * 60, vr: Math.random() * 60, t: 0, life: 0.25 + Math.random() * 0.35 * player.heat, size: 4 + Math.random() * 8 * player.heat });
      }
    }
    for (const f of fx.flames) { f.t += dt; f.R += f.vr * dt; f.a += (f.vt * dt) / f.R; }
    fx.flames = fx.flames.filter((f) => f.t < f.life);
    for (const c of fx.craters) c.t += dt;
    fx.craters = fx.craters.filter((c) => c.t < 14);
    if (snd) snd.sfx.burn(state === 'play' ? player.heat : 0);
    shake = Math.max(0, shake - dt * 30);
    fx.flash = Math.max(0, fx.flash - dt * 1.5);
    for (const q of fx.puffs) { q.t += dt; q.R += q.vr * dt; q.a += (q.vt * dt) / q.R; q.vt *= 1 - dt * 2.5; q.vr *= 1 - dt * 2; }
    fx.puffs = fx.puffs.filter((q) => q.t < q.life);
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
    if (snd) snd.music.set({ tierF: tierFloat(player.r) + (level >= 2 ? 9 : 0), speed: player.speed, won: state === 'won' });
    for (const q of particles) {
      q.R += q.vr * dt; q.a += (q.vt * dt) / q.R; q.vr -= 380 * dt; q.life -= dt;
    }
    particles = particles.filter((q) => q.life > 0);

    // Level 3: past halfway the view turns so the belt lies off to the right
    const flipWant = level === 3 && state !== 'title' && player.r > tierR(FLIP) - TIER_GAP * 0.5 ? 1 : 0;
    flipK = approach(flipK, flipWant, dt / 1.3);
    if (flipWant && !fx.flipShown && state === 'play') {
      fx.flipShown = true;
      banner('SIDEWAYS!', "JUPITER'S PULL");
      toast(touch ? 'Jupiter swings you round: the belt is to the right now. Steer with ▲ ▼.' : 'Jupiter swings you round: the belt is to the right now. Steer with ↑ ↓ (or W S).', 5);
      sfx.whoosh();
    }
    if ((flipK > 0.5) !== document.body.classList.contains('flipped')) setPadFlip(flipK > 0.5);

    // Camera: follow height, and look further down while falling.
    cam.r += (player.r - cam.r) * Math.min(1, dt * 7);
    const want = player.vr < -250 ? 0.34 : 0.46;
    cam.anchor = lerp(cam.anchor || want, want, Math.min(1, dt * 2));
    // Pull the camera out during a ride so you can watch the Earth turn below.
    const onRide = player.lastPlat && player.lastPlat.ride && (player.lastPlat.ride.state === 'moving') && riding(player.lastPlat);
    const zWant = onRide ? clamp((H * 0.42) / (player.r - R0 + 80), 0.1, 1) : 1;
    cam.zoom = lerp(cam.zoom, zWant, Math.min(1, dt * (onRide ? 1.6 : 1.2)));

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

  const onScreen = (x, y, m = 220) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;
  function at(phi, R, fn, margin) {
    const x = cx + R * Math.sin(phi), y = cy - R * Math.cos(phi);
    if (!onScreen(x, y, margin)) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(phi); fn(); ctx.restore();
  }
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function drawSky() {
    if (level === 3) { drawMarsSky(); return; }
    if (level === 2) { drawSpaceSky(); return; }
    const s = clamp((cam.r - R0) / (tierR(9) - R0), 0, 1);
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
    const p = world.plats.find((q) => q.dest && (!route || !q.route || q.route === route));
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
    const k = clamp((tf - (TOP - 5)) / (5 - 0.6), 0, 1);
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
    // Mars's two little moons circle it until it glides in to become the ground
    drawPlanet(m.p.type, m.x, m.y, m.r, m.alpha, 1 - m.t);
  }

  // Round worlds seen from space: the Moon, Earth, Mars and Venus
  const PLANET = {
    moon: { glow: '230,228,240', body: '#e6e4ec', spots: '#c3c0cc' },
    earth: { glow: '120,190,255', body: '#2f6fd0', spots: '#4fb34a' },
    mars: { glow: '255,140,100', body: '#c8553a', spots: '#9a3b2a' },
    venus: { glow: '255,230,160', body: '#efd9a0', spots: '#dcc07a' },
  };
  function drawPlanet(type, x, y, r, alpha = 1, moons = 1) {
    const P = PLANET[type] || PLANET.moon;
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.6);
    glow.addColorStop(0, `rgba(${P.glow},0.35)`);
    glow.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = P.body; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.fillStyle = P.spots;
    if (type === 'venus') {
      // Thick swirling cloud bands; you never see the ground from up here
      for (let i = -3; i <= 3; i++) {
        ctx.fillStyle = i % 2 ? '#f7ead0' : '#dcc07a';
        ctx.fillRect(x - r, y + i * r * 0.28 + Math.sin(clock * 0.3 + i) * r * 0.05, r * 2, r * 0.14);
      }
    } else if (type === 'earth') {
      for (const [cxo, cyo, cr] of [[-0.35, -0.2, 0.32], [0.3, 0.25, 0.26], [0.1, -0.5, 0.18], [-0.1, 0.55, 0.16]]) {
        ctx.beginPath(); ctx.arc(x + cxo * r, y + cyo * r, cr * r, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [cxo, cyo, w] of [[-0.6, -0.45, 0.7], [0.0, 0.05, 0.8], [-0.2, 0.4, 0.6]]) ctx.fillRect(x + cxo * r, y + cyo * r, w * r, Math.max(1, r * 0.08));
    } else {
      const spots = type === 'mars' ? [[-0.3, 0.1, 0.3], [0.35, -0.15, 0.2], [0.1, 0.45, 0.22]] : [[-0.3, -0.2, 0.22], [0.35, 0.25, 0.15], [0.05, 0.5, 0.18], [-0.45, 0.35, 0.1], [0.4, -0.4, 0.09]];
      for (const [cxo, cyo, cr] of spots) { ctx.beginPath(); ctx.arc(x + cxo * r, y + cyo * r, cr * r, 0, TAU); ctx.fill(); }
      if (type === 'mars') {
        ctx.fillStyle = '#f4f6fb'; ctx.beginPath(); ctx.ellipse(x, y - r * 0.92, r * 0.42, r * 0.16, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e07a52'; ctx.beginPath(); ctx.arc(x - r * 0.45, y - r * 0.3, r * 0.1, 0, TAU); ctx.fill(); // Olympus Mons
      }
    }
    // Night side: a shadow on the side away from the Sun (top left)
    ctx.fillStyle = 'rgba(8,8,24,0.32)';
    ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.35, r * 1.05, 0, TAU); ctx.arc(x - r * 0.2, y - r * 0.2, r * 1.05, 0, TAU, true); ctx.fill('evenodd');
    ctx.restore();
    if (type === 'mars' && moons > 0.02) drawMarsMoons(x, y, r, alpha * moons);
  }
  // Phobos laps Mars in under 8 hours, close in; Deimos takes 30 hours, further out.
  // Each passes behind the planet on the far half of its orbit.
  function drawMarsMoons(x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    for (const [name, dist, size, speed, ph] of [['PHOBOS', 1.45, 0.08, 0.9, 0.6], ['DEIMOS', 2.3, 0.055, 0.25, 2.4]]) {
      const ang = clock * speed + ph, mx = x + Math.cos(ang) * r * dist, my = y + Math.sin(ang) * r * dist * 0.35;
      if (Math.sin(ang) < 0 && Math.abs(mx - x) < r) continue; // behind Mars
      ctx.fillStyle = '#a89484';
      ctx.beginPath(); ctx.ellipse(mx, my, Math.max(1.5, r * size * 1.3), Math.max(1.2, r * size), 0.4, 0, TAU); ctx.fill();
      if (r > 24) { ctx.fillStyle = 'rgba(238,241,255,0.75)'; ctx.fillText(name, mx, my - Math.max(5, r * size) - 4); }
    }
    ctx.textAlign = 'start';
    ctx.restore();
  }

  function drawSpaceSky() {
    const tf = tierFloat(player.r), f = tf / TOP;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070c12'); g.addColorStop(1, '#16232d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // No air, so the stars shine steady: twinkling is caused by an atmosphere
    for (const st of world.sky) {
      let x = (st.x * W - theta * 200) % W; if (x < 0) x += W;
      px(x, st.y * H, st.s, st.s, st.s > 1 ? '#fff3c4' : '#c9d7f0');
    }
    // The Sun: bigger and fiercer on the way to Venus, smaller towards Mars
    const sunK = route === 'venus' ? 1 + f * 1.3 : route === 'mars' ? 1 - f * 0.35 : 1;
    const sx = W * 0.14, sy = H * 0.12, sr = 15 * sunK;
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
    sg.addColorStop(0, 'rgba(255,244,200,0.6)'); sg.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    // Earth hangs in the black sky, shrinking behind you as you go
    drawPlanet('earth', W * 0.84, H * 0.17 + tf * 22, 46 / (1 + tf * 0.45));
    if (fx.visitor) drawVisitor(fx.visitor);
    if (route) drawSkyMoon();
    else {
      // From the base you can see both: Venus off to the left, Mars to the right
      drawPlanet('venus', W * 0.36, H * 0.2, 7);
      drawPlanet('mars', W * 0.62, H * 0.22, 6);
      ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(238,241,255,0.75)';
      ctx.fillText('VENUS', W * 0.36, H * 0.2 + 20); ctx.fillText('MARS', W * 0.62, H * 0.22 + 19);
      ctx.textAlign = 'start';
    }
  }

  // Level 3. Mars's thin air scatters the dust in it, so the daytime sky is a
  // pale butterscotch; it fades to black as you climb out of it.
  function drawMarsSky() {
    const tf = tierFloat(player.r), f = tf / TOP;
    const air = clamp(1 - tf / 2.6, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix('#070c12', '#b9794f', air)); g.addColorStop(1, mix('#16232d', '#e6b98c', air));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1 - air;
    for (const st of world.sky) {
      let x = (st.x * W - theta * 200) % W; if (x < 0) x += W;
      px(x, st.y * H, st.s, st.s, st.s > 1 ? '#fff3c4' : '#c9d7f0');
    }
    ctx.globalAlpha = 1;
    // The Sun, smaller out here, and smaller still in the belt
    const sx = W * 0.14, sy = H * 0.12, sr = 11 * (1 - f * 0.4);
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
    sg.addColorStop(0, `rgba(255,244,220,${0.6 - air * 0.2})`); sg.addColorStop(1, 'rgba(255,244,220,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    // Home: just a bright blue star from here
    ctx.fillStyle = '#9fd0ff'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.16, 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(238,241,255,0.7)'; ctx.fillText('EARTH', W * 0.82, H * 0.16 + 12);
    // From the ground both moons cross the sky: Phobos fast and backwards
    // (west to east), Deimos slowly the usual way
    const low = clamp(1 - tf / 2.5, 0, 1);
    if (low > 0) {
      ctx.globalAlpha = low;
      for (const [name, x, y, w, h] of [
        ['PHOBOS', ((clock * 0.025 - theta * 0.2) % 1.3 + 1.3) % 1.3 * W - 0.15 * W, H * 0.28, 9, 6],
        ['DEIMOS', ((0.6 - clock * 0.004 - theta * 0.2) % 1.3 + 1.3) % 1.3 * W - 0.15 * W, H * 0.12, 4, 3],
      ]) {
        ctx.fillStyle = '#8f7d70'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6f5f55'; ctx.beginPath(); ctx.arc(x - w * 0.3, y, h * 0.35, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,248,236,0.8)'; ctx.fillText(name, x, y + h + 10);
      }
      ctx.globalAlpha = 1;
    }
    // Further out: the belt glitters ahead, and Jupiter looms beyond it
    const belt = clamp((tf - 5) / 3, 0, 1);
    if (belt > 0) {
      for (let i = 0; i < 70; i++) {
        const x = ((i * 0.137 + theta * 0.03) % 1 + 1) % 1, y = 0.45 + Math.sin(i * 1.7) * 0.06 + (x - 0.5) * 0.25;
        ctx.globalAlpha = belt * (0.35 + 0.35 * Math.sin(clock * 1.5 + i));
        px(W * (0.55 + x * 0.45), H * y, i % 5 ? 2 : 3, i % 5 ? 2 : 3, '#d9cbb8');
      }
      ctx.globalAlpha = 1;
      const jr = 8 + clamp((tf - 6) / (TOP - 6), 0, 1) * 26, jx = W * 0.88, jy = H * 0.5;
      ctx.save(); ctx.globalAlpha = belt;
      ctx.fillStyle = '#e3c9a3'; ctx.beginPath(); ctx.arc(jx, jy, jr, 0, TAU); ctx.fill(); ctx.clip();
      for (let i = -3; i <= 3; i++) { ctx.fillStyle = i % 2 ? '#c49a6c' : '#efdcc0'; ctx.fillRect(jx - jr, jy + i * jr * 0.26, jr * 2, jr * 0.12); }
      ctx.fillStyle = '#c8553a'; ctx.beginPath(); ctx.ellipse(jx + jr * 0.3, jy + jr * 0.32, jr * 0.18, jr * 0.1, 0, 0, TAU); ctx.fill(); // the Great Red Spot
      ctx.restore();
      ctx.globalAlpha = belt; ctx.fillStyle = 'rgba(238,241,255,0.75)'; ctx.fillText('JUPITER', jx, jy + jr + 12); ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'start';
    if (fx.visitor) drawVisitor(fx.visitor);
  }

  // Visitors from other stars cross the sky now and then
  function drawVisitor(v) {
    const k = v.t / 9;
    const x = v.dir > 0 ? lerp(-60, W + 60, k) : lerp(W + 60, -60, k), y = H * (0.3 + k * 0.1);
    ctx.save(); ctx.translate(x, y);
    if (v.kind === 'oumuamua') {
      ctx.rotate(v.t * 2.2); // tumbling end over end
      ctx.fillStyle = '#b5523a'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e0875a'; ctx.beginPath(); ctx.ellipse(-4, -1, 12, 2, 0, 0, TAU); ctx.fill();
    } else {
      ctx.scale(v.dir, 1);
      const tg = ctx.createLinearGradient(-90, 0, 0, 0);
      tg.addColorStop(0, 'rgba(143,208,255,0)'); tg.addColorStop(1, 'rgba(200,240,255,0.8)');
      ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-90, -10); ctx.lineTo(-90, 10); ctx.lineTo(0, 4); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(238,241,255,0.8)';
    ctx.fillText(v.kind === 'oumuamua' ? "'OUMUAMUA" : '3I/ATLAS', x, y + 24);
    ctx.textAlign = 'start';
  }

  function drawAurora() {
    // Northern-lights curtains between the mesosphere and low orbit.
    const tf = tierFloat(player.r);
    const a = clamp(1 - Math.abs(tf - 10) / 3.5, 0, 1);
    if (a <= 0) return;
    const bands = [['rgba(90,255,170,', 0.18, 0], ['rgba(170,110,255,', 0.3, 2]];
    for (const [col, yf, ph] of bands) {
      const stripW = lowQuality ? 18 : 6;
      for (let x = 0; x < W; x += stripW) {
        const wave = Math.sin(x * 0.012 + clock * 0.8 + ph + theta * 3) * 22 + Math.sin(x * 0.031 - clock * 1.3) * 10;
        const h = 60 + Math.sin(x * 0.02 + clock + ph) * 25;
        const g = ctx.createLinearGradient(0, H * yf + wave, 0, H * yf + wave + h);
        g.addColorStop(0, col + '0)'); g.addColorStop(0.5, col + (0.35 * a) + ')'); g.addColorStop(1, col + '0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, H * yf + wave, stripW, h);
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

  function drawFire(feetX, feetY) {
    const h = player.heat || 0;
    for (const f of fx.flames) {
      at(f.a + theta, f.R, () => {
        const k = f.t / f.life;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = k < 0.25 ? '#fff3b0' : k < 0.55 ? '#ffb23a' : k < 0.8 ? '#ff6a1a' : '#8a3a2a';
        const sz = f.size * (1 - k * 0.5);
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.globalAlpha = 1;
      }, 40);
    }
    if (h < 0.05) return;
    const y = feetY - 24;
    const g = ctx.createRadialGradient(feetX, y, 4, feetX, y, 40 + h * 40);
    g.addColorStop(0, `rgba(255,243,176,${0.8 * h})`);
    g.addColorStop(0.4, `rgba(255,140,40,${0.55 * h})`);
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(feetX, y, 40 + h * 40, 0, TAU); ctx.fill();
    // Flame cone streaming up behind the falling tramp
    const flick = Math.sin(clock * 40) * 4;
    ctx.fillStyle = `rgba(255,120,30,${0.7 * h})`;
    ctx.beginPath(); ctx.moveTo(feetX - 22, y + 6); ctx.quadraticCurveTo(feetX + flick, y - 90 * h - 20, feetX + 22, y + 6); ctx.fill();
    ctx.fillStyle = `rgba(255,230,140,${0.8 * h})`;
    ctx.beginPath(); ctx.moveTo(feetX - 12, y + 4); ctx.quadraticCurveTo(feetX - flick, y - 55 * h - 10, feetX + 12, y + 4); ctx.fill();
  }

  function drawCraters() {
    for (const c of fx.craters) {
      at(c.a + theta, R0, () => {
        const fade = clamp(1 - (c.t - 10) / 4, 0, 1);
        ctx.globalAlpha = fade;
        ctx.scale(c.size, c.size);
        if (c.moon) {
          ctx.fillStyle = '#55536a'; ctx.beginPath(); ctx.ellipse(0, 3, 34, 9, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#6e6c7a'; ctx.beginPath(); ctx.ellipse(0, 2, 24, 5, 0, 0, TAU); ctx.fill();
          px(-38, -3, 8, 4, '#cfcdd8'); px(30, -3, 8, 4, '#cfcdd8');
          ctx.globalAlpha = 1;
          return;
        }
        ctx.fillStyle = c.mars ? '#4a1a10' : '#2a1a14'; ctx.beginPath(); ctx.ellipse(0, 3, 34, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = c.mars ? '#6e2a1a' : '#4a2e20'; ctx.beginPath(); ctx.ellipse(0, 2, 24, 5, 0, 0, TAU); ctx.fill();
        if (c.t < 0.6) { ctx.fillStyle = `rgba(255,178,58,${1 - c.t / 0.6})`; ctx.beginPath(); ctx.ellipse(0, 1, 20, 4, 0, 0, TAU); ctx.fill(); }
        // wisps of smoke
        ctx.fillStyle = 'rgba(90,90,100,0.35)';
        for (let i = 0; i < 3; i++) {
          const k = ((c.t * 0.5 + i / 3) % 1);
          ctx.beginPath(); ctx.arc((i - 1) * 12 + Math.sin(c.t * 2 + i) * 4, -k * 60, 5 + k * 10, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }, 120);
    }
  }

  function drawFx() {
    for (const q of fx.puffs) {
      at(q.a + theta, q.R, () => {
        const k = q.t / q.life;
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.fillStyle = q.dust ? '#b4b2be' : q.smoke ? '#8a7f78' : q.nlc ? '#b8e4ff' : '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, q.r * (1 + k * 1.2), 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }, 60);
    }
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
        let sc = q.t < 0.15 ? 0.6 + (q.t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (q.t - 0.15));
        if (q.small) sc *= 0.75;
        upright();
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
    const fade = clamp(1 - (tf - 3) / 4, 0, 1) * clamp((cam.zoom - 0.55) / 0.35, 0, 1);
    if (fade <= 0) return;
    const skyS = clamp((cam.r - R0) / (tierR(9) - R0), 0, 1);
    const haze = mix(level === 2 ? '#0b1030' : '#58b4f0', '#03040c', skyS).match(/\d+/g).map(Number);
    const tint = (hex, k) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return `rgb(${c.map((v, i) => Math.round(lerp(v, haze[i], k))).join(',')})`;
    };
    const climb = cam.r - R0;
    ctx.globalAlpha = fade;
    world.ranges.forEach((m, depth) => {
      const my = cy - climb * (1 - m.sink); // this range's own centre, lifted by parallax
      if (my - R0 - m.hMax > view.y1 + 20) return;
      const n = m.h.length;
      const rot = theta * m.f;
      const hazeK = (1 - m.sink) * 0.7 + skyS * 0.5;
      const pt = (i, hh) => {
        const a = (i / n) * TAU + rot;
        const r = R0 - 6 + (hh === undefined ? m.h[((i % n) + n) % n] : hh);
        return [cx + r * Math.sin(a), my - r * Math.cos(a)];
      };
      const span = Math.min(n / 2, Math.ceil((n * ((view.x1 - view.x0) / 2 + 260)) / (TAU * R0)));
      const mid = Math.round((((-rot / TAU) % 1) + 1) % 1 * n);
      ctx.fillStyle = tint(m.col, hazeK);
      ctx.beginPath();
      for (let i = mid - span; i <= mid + span; i++) {
        const [x, y] = pt((i + n) % n);
        i === mid - span ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      // Close the shape well below the screen so nothing shows through underneath.
      ctx.lineTo(view.x1 + 400, Math.max(my, view.y1 + 400));
      ctx.lineTo(view.x0 - 400, Math.max(my, view.y1 + 400));
      ctx.closePath();
      ctx.fill();
      if (m.flat) {
        // Two tones, like a vector illustration: slopes facing the Sun (to the
        // left) are lit, the rest stays in shade
        ctx.fillStyle = tint(m.lit, hazeK);
        let run = null;
        const face = (i0, i1) => {
          ctx.beginPath();
          for (let i = i0; i <= i1; i++) { const [x, y] = pt(i); i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
          // ...tapering down the slope, like a flat-shaded plane
          for (let i = i1; i >= i0; i--) { const [x, y] = pt(i, m.h[((i % n) + n) % n] * 0.45 + Math.max(0, (i - i0) * 0.6)); ctx.lineTo(x, y); }
          ctx.closePath(); ctx.fill();
        };
        for (let i = mid - span; i <= mid + span + 1; i++) {
          const k = ((i % n) + n) % n, up = i <= mid + span && m.h[k] - m.h[(k - 1 + n) % n] > 0.2;
          if (up && run === null) run = i - 1;
          else if (!up && run !== null) { face(run, i - 1); run = null; }
        }
        // Crater mouths: one flat shape, a shade darker
        const colPx = (TAU * (R0 - 6)) / n;
        ctx.fillStyle = tint(mix(m.col, '#000000', 0.42).match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).reduce((a, b) => a + b, '#'), hazeK);
        for (const c of m.craters) {
          const off = ((((c.c - mid) % n) + n + n / 2) % n) - n / 2;
          if (Math.abs(off) > span) continue;
          const a = (c.c / n) * TAU + rot, r = R0 - 6 + c.height;
          ctx.save(); ctx.translate(cx + r * Math.sin(a), my - r * Math.cos(a)); ctx.rotate(a);
          ctx.beginPath(); ctx.ellipse(0, 0, c.w * colPx * 0.85, Math.max(4, c.w * colPx * 0.17), 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
      } else if (m.rims) {
        // Sunlit crater rims: a bright edge along the top
        ctx.strokeStyle = tint(m.snow, hazeK * 0.6); ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = mid - span; i <= mid + span; i++) { const [x, y] = pt((i + n) % n); i === mid - span ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        // Each crater's mouth, seen slightly from above: a dark bowl inside the
        // rim, its far wall catching the sunlight
        const colPx = (TAU * (R0 - 6)) / n;
        for (const c of m.craters) {
          const off = ((c.c - mid) % n + n + n / 2) % n - n / 2;
          if (Math.abs(off) > span) continue;
          const a = (c.c / n) * TAU + rot, r = R0 - 6 + c.height;
          const x = cx + r * Math.sin(a), y = my - r * Math.cos(a);
          const rx = c.w * colPx, ry = Math.max(4, rx * 0.24);
          ctx.save(); ctx.translate(x, y); ctx.rotate(a);
          // the mouth: bright rim, dark floor, the far wall lit by the Sun
          ctx.fillStyle = tint(m.snow, hazeK * 0.6); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry + 2, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = tint('#3a3848', hazeK); ctx.beginPath(); ctx.ellipse(0, 1, rx - 4, ry - 1, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = tint(m.col, hazeK * 0.7); ctx.beginPath(); ctx.ellipse(rx * 0.1, -ry * 0.05, rx * 0.86, ry * 0.7, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
          if (c.w > 13) { ctx.fillStyle = tint(m.snow, hazeK * 0.7); ctx.beginPath(); ctx.moveTo(-rx * 0.1, ry * 0.45); ctx.lineTo(0, -ry * 0.1); ctx.lineTo(rx * 0.1, ry * 0.45); ctx.fill(); } // central peak
          ctx.restore();
        }
      } else if (m.snow) {
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
        ctx.fillRect(view.x0, my - R0 - 10, view.x1 - view.x0, 70);
      }
    });
    ctx.globalAlpha = 1;
  }

  // Level 2: the plain behind the base, far band first
  function drawPlains() {
    const tf = tierFloat(player.r);
    const fade = clamp(1 - (tf - 3) / 4, 0, 1) * clamp((cam.zoom - 0.55) / 0.35, 0, 1);
    if (fade <= 0 || !world.plains) return;
    const climb = cam.r - R0;
    const reach = Math.min(Math.PI, ((view.x1 - view.x0) / 2 + 220) / R0);
    const dark = (c, k) => hexOf(mix(c, '#000000', k)), light = (c, k) => hexOf(mix(c, '#ffffff', k));
    ctx.globalAlpha = fade;
    for (const L of world.plains) {
      const my = cy - climb * (1 - L.sink);
      if (my - R0 - L.top > view.y1 + 20) continue;
      const rot = theta * L.f;
      // Each layer is a bigger circle around the same centre as the Moon,
      // further back, sliding past more slowly
      const P = (ph, h) => { const r = R0 - 6 + h; return [cx + r * Math.sin(ph), my - r * Math.cos(ph)]; };
      const tilt = (ph) => ph;
      const seen = (a, m = 0) => Math.abs(wrap(a + rot)) < reach + m / R0;
      ctx.fillStyle = L.col;
      ctx.beginPath(); ctx.arc(cx, my, R0 - 6 + L.top, 0, TAU); ctx.fill();
      if (L === world.plains[1]) drawBaseGroup(P(rot, L.top), rot, L.col);
      // Oval craters on the plain: lit far wall, shadow in the bowl
      for (const c of L.craters) {
        if (!seen(c.a, c.rx)) continue;
        const ph = c.a + rot, [x, y] = P(ph, c.h), ry = c.rx * 0.32;
        ctx.save(); ctx.translate(x, y); ctx.rotate(tilt(ph));
        ctx.fillStyle = dark(L.col, 0.14); ctx.beginPath(); ctx.ellipse(0, 0, c.rx, ry, 0, 0, TAU); ctx.fill();
        ctx.clip();
        ctx.fillStyle = dark(L.col, 0.45); ctx.beginPath(); ctx.ellipse(c.rx * 0.04, ry * 0.42, c.rx * 0.96, ry * 0.8, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  // The base, as one group standing on a flat stretch of the distant horizon
  const BASE_LAYOUT = [
    [-150, 'rocketpad'], [-108, 'dish2'], [-90, 'dome', { w: 26, h: 16, ant: true }], [-52, 'dome', { w: 54, h: 30, door: true }],
    [-18, 'fence'], [26, 'dome', { w: 74, h: 30, wins: 3, ant: true }], [78, 'tower'], [122, 'dome', { w: 46, h: 24 }], [150, 'hover'],
  ];
  function drawBaseGroup([x, y], ph, ground) {
    if (Math.abs(wrap(ph)) * R0 > (view.x1 - view.x0) / 2 + 260) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ph); ctx.scale(0.8, 0.8);
    // A flat shelf of ground for the base to stand on
    ctx.fillStyle = ground; ctx.fillRect(-190, -1, 380, 40);
    ctx.fillStyle = hexOf(mix(ground, '#ffffff', 0.12)); ctx.fillRect(-190, -1, 380, 2);
    for (const [bx, kind, opts] of BASE_LAYOUT) { ctx.save(); ctx.translate(bx, 0); MOON_DECOR[kind](opts || {}); ctx.restore(); }
    ctx.restore();
  }
  const hexOf = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('');

  function drawEarth() {
    if (cy - R0 > view.y1 + 60) return;
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

  // The Moon in cross-section, roughly in the real proportions: a thick crust,
  // a stiff rocky mantle, a partly molten layer, then a small iron core.
  function drawMoonBody() {
    if (cy - R0 > view.y1 + 60) return;
    const disc = (r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); };
    // The cratered outline: everything inside is clipped to it
    const sf = world.surf, n = sf.length;
    const sp = (i) => { const a = (i / n) * TAU + theta, r = R0 + sf[((i % n) + n) % n]; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
    const outline = new Path2D();
    for (let i = 0; i <= n; i++) { const [x, y] = sp(i); i ? outline.lineTo(x, y) : outline.moveTo(x, y); }
    outline.closePath();
    ctx.save();
    ctx.clip(outline);
    const crustG = ctx.createRadialGradient(cx, cy, R0 * 0.9, cx, cy, R0);
    crustG.addColorStop(0, '#2c3a45'); crustG.addColorStop(1, '#455865');
    disc(R0 + 24, crustG);
    const mantle = ctx.createRadialGradient(cx, cy, R0 * 0.32, cx, cy, R0 * 0.9);
    mantle.addColorStop(0, '#26323c'); mantle.addColorStop(1, '#3a4955');
    disc(R0 * 0.9, mantle);
    disc(R0 * 0.32, '#a8553a');
    const outer = ctx.createRadialGradient(cx, cy, R0 * 0.19, cx, cy, R0 * 0.26);
    outer.addColorStop(0, '#ffb23a'); outer.addColorStop(1, '#e07a2e');
    disc(R0 * 0.26, outer);
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.19);
    inner.addColorStop(0, '#fff3c4'); inner.addColorStop(1, '#ffd45e');
    disc(R0 * 0.19, inner);
    // Moonquakes: faint cracks running through the cold mantle
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(210,200,230,0.22)';
    for (const sw of world.swirls) {
      const a = sw.a + theta - Math.PI / 2;
      ctx.beginPath(); ctx.arc(cx, cy, sw.rf * R0, a, a + sw.len); ctx.stroke();
    }
    for (const c of world.crust) {
      at(c.a + theta, c.rf * R0, () => {
        if (c.kind === 'rock') { px(-5, -3, 10, 6, ['#6f828e', '#64767f', '#7a8c97'][c.hue]); px(-3, -5, 6, 2, '#8ea1ac'); }
        else if (c.kind === 'ice') { px(-2, -5, 4, 10, '#7f9cb0'); px(-5, -2, 10, 4, '#7f9cb0'); px(-1, -4, 2, 2, '#b8cfdc'); }
        else if (c.kind === 'meteorite') { px(-5, -4, 10, 8, '#1f2c36'); px(-3, -3, 3, 3, '#6d7f8a'); px(1, 0, 2, 2, '#8ea1ac'); }
        else if (c.kind === 'glass') { for (const [x, y] of [[-4, -2], [0, -4], [3, 0], [-1, 2]]) px(x, y, 3, 3, c.hue ? '#8c8072' : '#9a8d7c'); }
        else { px(-18, -2, 36, 5, '#4a4757'); px(-18, -3, 36, 1, '#8a8796'); px(-20, -1, 2, 3, '#4a4757'); px(18, -1, 2, 3, '#4a4757'); } // lava tube
      }, 34);
    }
    // Pale regolith on top: dust and broken rock, smooth like Earth's grass band
    ctx.strokeStyle = '#4c606d'; ctx.lineWidth = 22; ctx.stroke(outline);
    ctx.strokeStyle = '#6d828f'; ctx.lineWidth = 5; ctx.stroke(outline);
    ctx.restore();
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const labels = [['CRUST', 0.95], ['MANTLE', 0.62], ['PARTLY MOLTEN', 0.29], ['OUTER CORE', 0.225], ['INNER CORE', 0.1]];
    for (const [t, rf] of labels) {
      const x = cx - Math.sin(0.3) * rf * R0 * (rf > 0.2 ? 1 : 0), y = cy - Math.cos(0.3) * rf * R0 + 3;
      if (y > H + 10) continue;
      ctx.fillStyle = 'rgba(20,10,20,0.55)'; ctx.fillText(t, x + 1, y + 1);
      ctx.fillStyle = '#fff4dc'; ctx.fillText(t, x, y);
    }
    ctx.textAlign = 'start';
  }

  // Things on the Moon's surface, old and new
  const MOON_DECOR = {
    boulder(d) {
      ctx.scale(d.size, d.size);
      ctx.fillStyle = ['#566975', '#617480', '#4b5d69'][d.hue];
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-9, -10); ctx.lineTo(2, -14); ctx.lineTo(11, -7); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill();
      px(-7, -11, 7, 3, '#8ea1ac'); px(6, -6, 5, 6, '#33434e');
    },
    // The base, in a clean flat vector style: pale buildings, soft shading
    // (lit from the left), dark doors and windows
    dome(d) {
      const { w, h } = d, B = '#cfdbe1', S = '#8fa1ac', D = '#1f2c36';
      px(-w / 2 - 3, -3, w + 6, 4, S);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, -2, w / 2, h, 0, Math.PI, TAU); ctx.closePath();
      ctx.fillStyle = S; ctx.fill(); ctx.clip();
      ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(-w * 0.09, 0, w * 0.44, h * 0.96, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#eef4f7'; ctx.beginPath(); ctx.ellipse(-w * 0.18, -h * 0.72, w * 0.12, h * 0.12, -0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b2c1c9'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, -2, w / 2, h * 0.5, 0, Math.PI, TAU); ctx.stroke();
      ctx.restore();
      if (d.door) {
        px(-7, -14, 14, 12, '#4a5a66');
        ctx.fillStyle = '#4a5a66'; ctx.beginPath(); ctx.arc(0, -14, 7, Math.PI, TAU); ctx.fill();
        px(-5, -13, 10, 11, D); ctx.fillStyle = D; ctx.beginPath(); ctx.arc(0, -13, 5, Math.PI, TAU); ctx.fill();
        px(-1, -10, 2, 2, Math.sin(clock * 2) > 0 ? '#52e07a' : '#2a5a3a');
      }
      for (let i = 0; i < (d.wins || 0); i++) {
        const x = (i - (d.wins - 1) / 2) * 16;
        px(x - 4, -h * 0.42, 8, 4, D); px(x - 4, -h * 0.42, 8, 1, '#7fa8c8');
      }
      px(-0.5, -h - 1, 1, h - 2, '#b2c1c9');
      px(-3, -h - 4, 6, 4, '#8fa1ac'); px(-3, -h - 4, 3, 4, '#cfdbe1');
      if (d.ant) { px(-1, -h - 10, 2, 9, '#6d7f8a'); ctx.fillStyle = '#cfdbe1'; ctx.beginPath(); ctx.arc(0, -h - 11, 2.5, 0, TAU); ctx.fill(); }
    },
    tower() {
      // Two tall cylinders joined under a rounded cap, a slim column on top
      const B = '#cfdbe1', S = '#8fa1ac', D = '#1f2c36';
      for (const [x, lit] of [[-15, true], [0, false]]) {
        px(x, -86, 15, 84, S); px(x, -86, lit ? 11 : 5, 84, B);
        px(x + 7, -86, 1, 84, '#b2c1c9');
      }
      ctx.fillStyle = S; ctx.beginPath(); ctx.ellipse(0, -86, 17, 8, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(-4, -86, 12, 7, 0, Math.PI, TAU); ctx.fill();
      px(-7, -114, 14, 26, S); px(-7, -114, 9, 26, B);
      ctx.fillStyle = S; ctx.beginPath(); ctx.ellipse(0, -114, 9, 9, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(-2, -114, 6, 8, 0, Math.PI, TAU); ctx.fill();
      px(-9, -102, 18, 3, S); // the band where the column meets the cap
      px(-2, -108, 4, 5, D);
      px(-10, -30, 7, 10, D); px(3, -60, 6, 8, D);
      if (Math.sin(clock * 3) > 0) px(-1, -126, 2, 3, '#ff5a4a');
    },
    rocketpad() {
      // A rocket on its pad: a little winged craft on the nose, a booster each side
      const B = '#cfdbe1', S = '#8fa1ac', D = '#1f2c36';
      px(-30, -4, 60, 4, S); px(-30, -4, 60, 2, B);
      for (const x of [-22, 14]) {
        px(x, -46, 8, 42, S); px(x, -46, 5, 42, B);
        ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(x + 4, -46, 4, 6, 0, Math.PI, TAU); ctx.fill();
      }
      px(-8, -78, 16, 74, S); px(-8, -78, 11, 74, B);
      ctx.fillStyle = B; ctx.beginPath(); ctx.moveTo(-8, -78); ctx.lineTo(0, -92); ctx.lineTo(8, -78); ctx.fill();
      // the winged craft riding on top
      ctx.fillStyle = B; ctx.beginPath(); ctx.moveTo(-4, -92); ctx.lineTo(0, -112); ctx.lineTo(4, -92); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3, -98); ctx.lineTo(-12, -92); ctx.lineTo(-3, -94); ctx.fill();
      ctx.fillStyle = S; ctx.beginPath(); ctx.moveTo(3, -98); ctx.lineTo(12, -92); ctx.lineTo(3, -94); ctx.fill();
      ctx.fillStyle = B; ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(-15, -4); ctx.lineTo(-8, -10); ctx.fill();
      ctx.fillStyle = S; ctx.beginPath(); ctx.moveTo(8, -22); ctx.lineTo(15, -4); ctx.lineTo(8, -10); ctx.fill();
      ctx.fillStyle = D; ctx.beginPath(); ctx.arc(-1, -58, 2.5, 0, TAU); ctx.fill();
    },
    dish2() {
      px(-1, -22, 2, 22, '#6d7f8a');
      ctx.fillStyle = '#cfdbe1'; ctx.beginPath(); ctx.ellipse(0, -26, 10, 6, -0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8fa1ac'; ctx.beginPath(); ctx.ellipse(2, -25, 6, 3.5, -0.6, 0, TAU); ctx.fill();
    },
    fence() {
      px(-14, -12, 28, 2, '#b2c1c9'); px(-14, -6, 28, 2, '#b2c1c9');
      for (let x = -14; x <= 12; x += 4) px(x, -12, 2, 12, '#cfdbe1');
    },
    hover() {
      // A lander hovering above the base
      ctx.translate(0, -170 + Math.sin(clock * 1.3) * 5);
      px(-6, -10, 12, 10, '#cfdbe1'); px(1, -10, 5, 10, '#8fa1ac');
      ctx.fillStyle = '#cfdbe1'; ctx.beginPath(); ctx.arc(0, -10, 5, Math.PI, TAU); ctx.fill();
      px(-2, -8, 4, 3, '#1f2c36');
      ctx.strokeStyle = '#8fa1ac'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-10, 8); ctx.moveTo(5, 0); ctx.lineTo(10, 8); ctx.stroke();
      px(-12, 8, 4, 1, '#8fa1ac'); px(8, 8, 4, 1, '#8fa1ac');
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(clock * 20); px(-2, 2, 4, 6, '#ffd36b'); ctx.globalAlpha = 1;
    },
    sheep() {
      // An electric sheep, plugged in and grazing in its pen
      ctx.translate(-120, 0);
      const flick = (seed) => Math.sin(clock * 13 + seed * 7.1) + Math.sin(clock * 3.7 + seed) > -1.6;
      // The electric sheep, plugged in and grazing in its pen
      for (const x of [100, 124, 148]) px(x, -18, 2, 18, '#c3ccd2');
      px(100, -16, 50, 2, '#c3ccd2'); px(100, -8, 50, 2, '#c3ccd2');
      const bob = Math.sin(clock * 2) > 0.3 ? 2 : 0;
      ctx.fillStyle = '#f4f6fb';
      for (const [x, y, r] of [[118, -16, 6], [126, -18, 7], [134, -16, 6], [124, -12, 6], [131, -12, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      px(138, -18 + bob, 7, 6, '#2a2230'); px(143, -16 + bob, 2, 2, '#ff5a4a'); // head, with a glowing eye
      px(119, -8, 2, 6, '#2a2230'); px(131, -8, 2, 6, '#2a2230');
      ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(114, -14); ctx.quadraticCurveTo(108, -2, 96, -10); ctx.stroke(); // power cable
      px(92, -16, 5, 10, '#7d869a'); px(93, -14, 3, 2, flick(20) ? '#52e07a' : '#2a6a3a');
    },
    sign(d) {
      px(-1, -34, 2, 34, '#c9ced9');
      px(-28, -48, 56, 15, '#2a2230');
      ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = d.col; ctx.fillText(d.text, 0, -37);
      ctx.textAlign = 'start';
    },
    solar() {
      for (let i = -1; i <= 1; i++) {
        px(i * 30 - 1, -16, 2, 16, '#9aa3b5');
        px(i * 30 - 13, -28, 26, 12, '#2b4fb8');
        for (let x = -13; x < 13; x += 6) px(i * 30 + x, -28, 1, 12, '#6d8cf0');
        px(i * 30 - 13, -23, 26, 1, '#6d8cf0');
      }
    },
    greenhouse() {
      ctx.fillStyle = 'rgba(191,232,255,0.35)';
      ctx.beginPath(); ctx.ellipse(0, 0, 42, 32, 0, Math.PI, TAU); ctx.fill();
      for (let x = -30; x <= 30; x += 10) { px(x, -10 - ((x * 7) % 9 + 9) / 2, 4, 10, '#4fb34a'); px(x - 2, -14 - ((x * 7) % 9 + 9) / 2, 8, 5, '#3a8f3a'); }
      ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 42, 32, 0, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(0, 0); ctx.moveTo(-30, -22); ctx.lineTo(30, -22); ctx.stroke();
    },
    antenna() {
      px(-2, -96, 4, 96, '#9aa3b5');
      ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 1;
      for (let y = -90; y < 0; y += 14) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8, y + 14); ctx.moveTo(8, y); ctx.lineTo(-8, y + 14); ctx.stroke(); }
      ctx.fillStyle = '#e6e4ec'; ctx.beginPath(); ctx.ellipse(0, -96, 14, 5, -0.3, 0, TAU); ctx.fill();
      if (Math.sin(clock * 4) > 0) px(-2, -110, 4, 4, '#ff5a4a');
      px(2, -80, 1, 10, '#c9ced9');
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(3, -80); ctx.lineTo(13, -76); ctx.lineTo(3, -72); ctx.fill();
    },
    lander() {
      ctx.strokeStyle = '#c9ced9'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(-24, 0); ctx.moveTo(10, -20); ctx.lineTo(24, 0); ctx.stroke();
      px(-28, -2, 8, 2, '#c9ced9'); px(20, -2, 8, 2, '#c9ced9');
      px(-11, -78, 22, 60, '#eef1f7'); px(-11, -78, 22, 4, '#c9ced9');
      ctx.fillStyle = '#e0433b'; ctx.beginPath(); ctx.moveTo(-11, -78); ctx.lineTo(0, -98); ctx.lineTo(11, -78); ctx.fill();
      ctx.fillStyle = '#3b3b4f'; ctx.beginPath(); ctx.arc(0, -58, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8fd0ff'; ctx.beginPath(); ctx.arc(0, -58, 4, 0, TAU); ctx.fill();
    },
    mining() {
      ctx.strokeStyle = '#d9a93b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -60); ctx.lineTo(22, 0); ctx.moveTo(-14, -24); ctx.lineTo(14, -24); ctx.stroke();
      px(-2, -60, 4, 64, '#7d869a');
      px(-36, -12, 20, 10, '#8a5a3b'); px(-34, -16, 16, 4, '#c3c0cc');
      ctx.fillStyle = '#3b3b4f'; ctx.beginPath(); ctx.arc(-32, -2, 3, 0, TAU); ctx.arc(-20, -2, 3, 0, TAU); ctx.fill();
    },
    apollo() {
      // Apollo 11's landing site, July 1969: the descent stage stays where it landed
      ctx.strokeStyle = '#c9ced9'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-22, 0); ctx.moveTo(12, -14); ctx.lineTo(22, 0); ctx.stroke();
      px(-25, -2, 6, 2, '#c9ced9'); px(19, -2, 6, 2, '#c9ced9');
      px(-15, -24, 30, 14, '#d9a93b'); px(-13, -22, 10, 4, '#f5d27a'); px(4, -18, 8, 6, '#8a5a3b');
      px(30, -40, 2, 40, '#e8e8f0');
      for (let i = 0; i < 5; i++) px(32, -40 + i * 2, 18, 2, i % 2 ? '#ffffff' : '#e0433b');
      px(32, -40, 7, 6, '#3f6fd8');
      ctx.font = '5px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(238,241,255,0.75)'; ctx.fillText('APOLLO 11 · 1969', 0, -32);
      ctx.textAlign = 'start';
    },
    prints() {
      for (let i = -4; i <= 4; i++) px(i * 9, 1 + (i % 2 ? 2 : 0), 4, 2, '#77758a');
    },
    tracks() {
      for (let i = -6; i <= 6; i++) { px(i * 7, 1, 4, 1, '#7d7a88'); px(i * 7 + 2, 4, 4, 1, '#7d7a88'); }
    },
    rover() {
      px(-24, -16, 48, 4, '#c9ced9'); px(-18, -24, 10, 8, '#8a8f98'); px(4, -24, 10, 8, '#8a8f98');
      ctx.fillStyle = '#3b3b4f';
      for (const x of [-17, 17]) { ctx.beginPath(); ctx.arc(x, -6, 6, 0, TAU); ctx.fill(); }
      px(-1, -40, 2, 24, '#9aa3b5');
      ctx.fillStyle = '#e6e4ec'; ctx.beginPath(); ctx.arc(0, -42, 9, Math.PI, TAU); ctx.fill();
      px(18, -22, 6, 6, '#d9a93b');
    },
    dish() {
      // A radio telescope: one day the quiet far side of the Moon may host one
      px(-3, -40, 6, 40, '#9aa3b5');
      ctx.fillStyle = '#e6e4ec'; ctx.beginPath(); ctx.arc(0, -66, 34, 0.15 * Math.PI, 0.85 * Math.PI); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, -66); ctx.stroke();
    },
    monolith() {
      px(-9, -66, 18, 66, '#0b0b10'); px(-9, -66, 2, 66, '#3b3b4f');
    },
  };
  function drawMoonDecor() {
    for (const d of world.decor) at(d.a + theta, R0 - 2 + surfAt(d.a), () => MOON_DECOR[d.kind](d), d.kind === 'base' ? 360 : 240);
  }

  // Level 3: the plain behind the base, with the great volcanoes standing on it
  function drawMarsScape() {
    const tf = tierFloat(player.r);
    const fade = clamp(1 - (tf - 3) / 4, 0, 1) * clamp((cam.zoom - 0.55) / 0.35, 0, 1);
    if (fade <= 0 || !world.scape) return;
    const climb = cam.r - R0;
    const reach = Math.min(Math.PI, ((view.x1 - view.x0) / 2 + 260) / R0);
    ctx.globalAlpha = fade;
    for (const L of world.scape) {
      const my = cy - climb * (1 - L.sink);
      if (my - R0 - L.top - 160 > view.y1 + 20) continue;
      const rot = theta * L.f;
      const P = (ph, h) => { const r = R0 - 6 + h; return [cx + r * Math.sin(ph), my - r * Math.cos(ph)]; };
      const seen = (a, w) => Math.abs(wrap(a + rot)) < reach + w;
      ctx.fillStyle = L.col;
      ctx.beginPath(); ctx.arc(cx, my, R0 - 6 + L.top, 0, TAU); ctx.fill();
      const lit = hexOf(mix(L.col, '#ffd9b0', 0.22)), shade = hexOf(mix(L.col, '#000000', 0.18));
      const label = (ph, h, name, sub) => {
        const [x, y] = P(ph, h);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ph);
        ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(40,14,8,0.6)'; ctx.fillText(name, 1, 1);
        ctx.fillStyle = '#fff1e0'; ctx.fillText(name, 0, 0);
        if (sub) { ctx.font = '5px "Press Start 2P", monospace'; ctx.fillStyle = 'rgba(255,241,224,0.8)'; ctx.fillText(sub, 0, 9); }
        ctx.restore();
      };
      // Shield volcanoes: wide, gentle slopes with a collapsed crater (caldera) on top
      const prof = (u) => (u < 0.1 ? 0.94 + 0.6 * u : Math.pow(1 - Math.pow((u - 0.1) / 0.9, 1.6), 1.5));
      for (const v of L.volc || []) {
        if (!seen(v.a, v.w)) continue;
        const shape = (u0, u1, k) => {
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const u = u0 + ((u1 - u0) * i) / 40, [x, y] = P(v.a + rot + u * v.w, L.top + v.h * prof(Math.abs(u)) * k);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          const [bx, by] = P(v.a + rot + u1 * v.w, L.top - 8), [ax, ay] = P(v.a + rot + u0 * v.w, L.top - 8);
          ctx.lineTo(bx, by); ctx.lineTo(ax, ay); ctx.closePath(); ctx.fill();
        };
        ctx.fillStyle = shade; shape(-1, 1, 1);
        ctx.fillStyle = lit; shape(-1, 0, 1); // the slope facing the Sun
        label(v.a + rot, L.top + v.h + 14, v.name, v.sub);
      }
      if (L.canyon && seen(L.canyon.a, L.canyon.w)) {
        // Valles Marineris: a great rift, shown as a dark gash in the near plain
        const c = L.canyon;
        ctx.fillStyle = '#5e2a1c';
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const u = -1 + i / 15, [x, y] = P(c.a + rot + u * c.w, L.top - c.d * (1 - Math.pow(Math.abs(u), 6)) * (0.8 + 0.2 * Math.sin(i * 1.9)));
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill();
        label(c.a + rot, L.top + 10, c.name, c.sub);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Mars in cross-section: a thin crust, a thick mantle, and a big liquid iron
  // core about half the planet's width (the InSight lander measured it)
  function drawMarsBody() {
    if (cy - R0 > view.y1 + 60) return;
    const glow = ctx.createRadialGradient(cx, cy, R0, cx, cy, R0 + 50);
    glow.addColorStop(0, 'rgba(240,170,120,0.35)'); glow.addColorStop(1, 'rgba(240,170,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R0 + 50, 0, TAU); ctx.fill();
    const disc = (r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); };
    const crustG = ctx.createRadialGradient(cx, cy, R0 * 0.9, cx, cy, R0);
    crustG.addColorStop(0, '#6e2a1a'); crustG.addColorStop(1, '#a5452a');
    disc(R0, crustG);
    const mantle = ctx.createRadialGradient(cx, cy, R0 * 0.54, cx, cy, R0 * 0.9);
    mantle.addColorStop(0, '#d0682e'); mantle.addColorStop(1, '#842e1e');
    disc(R0 * 0.9, mantle);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.54);
    core.addColorStop(0, '#ffe08a'); core.addColorStop(1, '#ff9a2e');
    disc(R0 * 0.54, core);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,190,130,0.3)';
    for (const sw of world.swirls) {
      const a = sw.a + theta - Math.PI / 2;
      ctx.beginPath(); ctx.arc(cx, cy, sw.rf * R0, a, a + sw.len); ctx.stroke();
    }
    for (const c of world.crust) {
      at(c.a + theta, c.rf * R0, () => {
        if (c.kind === 'rock') { px(-5, -3, 10, 6, ['#5a2418', '#7a3a2a', '#4e2016'][c.hue]); px(-3, -5, 6, 2, '#94503a'); }
        else if (c.kind === 'ice') { px(-2, -5, 4, 10, '#b9d4e6'); px(-5, -2, 10, 4, '#b9d4e6'); px(-1, -4, 2, 2, '#ffffff'); }
        else for (const [x, y] of [[-4, -2], [0, -4], [3, 0], [-1, 2]]) px(x, y, 3, 3, '#3a4a6a'); // blueberries
      }, 30);
    }
    // Rusty dust on top: iron oxide is why Mars is red
    ctx.strokeStyle = '#b4532f'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 5, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#d9774a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 1, 0, TAU); ctx.stroke();
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const [t, rf] of [['CRUST', 0.95], ['MANTLE', 0.72], ['LIQUID CORE', 0.3]]) {
      const x = cx - Math.sin(0.3) * rf * R0, y = cy - Math.cos(0.3) * rf * R0 + 3;
      if (y > H + 10) continue;
      ctx.fillStyle = 'rgba(20,10,20,0.55)'; ctx.fillText(t, x + 1, y + 1);
      ctx.fillStyle = '#fff4dc'; ctx.fillText(t, x, y);
    }
    ctx.textAlign = 'start';
  }

  // Robots on Mars, old and new. The ones still working drive about.
  const WHITE = '#e8e4dc', GREY = '#9aa3b5', DARK = '#3b3b4f', PANEL = '#2b4fb8';
  function marsLabel(text, y) {
    ctx.font = '5px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(40,14,8,0.55)'; ctx.fillText(text, 1, y + 1);
    ctx.fillStyle = 'rgba(255,244,230,0.9)'; ctx.fillText(text, 0, y);
    ctx.textAlign = 'start';
  }
  function wheels(xs, r) { ctx.fillStyle = DARK; for (const x of xs) { ctx.beginPath(); ctx.arc(x, -r, r, 0, TAU); ctx.fill(); } }
  const MARS_DECOR = {
    boulder(d) {
      ctx.scale(d.size, d.size);
      ctx.fillStyle = ['#8c3f28', '#9e4a30', '#7a3522'][d.hue];
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-9, -10); ctx.lineTo(2, -14); ctx.lineTo(11, -7); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill();
      px(-7, -11, 7, 3, '#c8704a'); px(6, -6, 5, 6, '#5e2a1c');
    },
    sign: (d) => MOON_DECOR.sign(d),
    tracks() { for (let i = -6; i <= 6; i++) { px(i * 7, 1, 4, 1, '#8a3a24'); px(i * 7 + 2, 4, 4, 1, '#8a3a24'); } },
    hab() {
      // A hab with a potato greenhouse
      MOON_DECOR.dome({ w: 50, h: 26, door: true, ant: true });
      ctx.translate(50, 0);
      ctx.fillStyle = 'rgba(191,232,255,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 22, 0, Math.PI, TAU); ctx.fill();
      for (let x = -20; x <= 20; x += 8) { px(x - 3, -7, 7, 4, '#4f8f3a'); px(x - 1, -4, 3, 3, '#b08a4a'); }
      ctx.strokeStyle = GREY; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 30, 22, 0, Math.PI, TAU); ctx.stroke();
      marsLabel('POTATOES', -28);
    },
    perseverance(d) {
      // Six wheels, a white body, a mast with its camera head, the nuclear
      // power pack sticking out the back
      ctx.save(); ctx.scale(d.dir, 1);
      wheels([-17, -2, 13], 5);
      px(-20, -22, 38, 11, WHITE); px(-20, -13, 38, 2, '#c9c2b5');
      px(-28, -24, 9, 9, '#5d5563'); px(-30, -22, 2, 6, '#7d7585');
      px(10, -46, 3, 24, GREY); px(6, -52, 12, 7, WHITE); px(13, -50, 4, 3, DARK);
      px(16, -20, 10, 2, GREY); px(25, -22, 3, 5, GREY); // the arm with its drill
      ctx.restore();
      marsLabel('PERSEVERANCE · 2021', -60);
    },
    ingenuity(d) {
      // The little helicopter, hovering, rotors a blur
      ctx.translate(0, -44 - Math.sin(clock * 2.2 + d.a * 9) * 8);
      px(-5, -6, 10, 8, '#cfcfd4'); px(-3, -10, 6, 4, '#2b2b3a');
      px(-1, -18, 2, 8, GREY);
      const blur = 13 + Math.sin(clock * 50) * 2;
      px(-blur, -18, blur * 2, 2, 'rgba(60,60,72,0.8)'); px(-blur + 2, -14, blur * 2 - 4, 2, 'rgba(60,60,72,0.6)');
      ctx.strokeStyle = GREY; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(-9, 10); ctx.moveTo(4, 2); ctx.lineTo(9, 10); ctx.stroke();
      marsLabel('INGENUITY', -24);
    },
    curiosity(d) {
      ctx.save(); ctx.scale(d.dir, 1);
      wheels([-17, -2, 13], 5);
      px(-20, -22, 38, 11, '#ddd6c8'); px(-20, -13, 38, 2, '#b9b1a3');
      px(-28, -26, 9, 11, '#5d5563');
      px(8, -44, 3, 22, GREY); px(4, -50, 12, 7, '#ddd6c8'); px(5, -48, 3, 3, DARK);
      ctx.restore();
      marsLabel('CURIOSITY · 2012', -58);
    },
    insight() {
      // The lander with its two round solar panels, and its quake detector
      // under a dome on the ground beside it
      px(-14, -16, 28, 8, '#d9a93b'); px(-12, -8, 2, 8, GREY); px(10, -8, 2, 8, GREY);
      for (const x of [-26, 26]) { ctx.fillStyle = PANEL; ctx.beginPath(); ctx.ellipse(x, -14, 13, 4, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(44, 0, 7, Math.PI, TAU); ctx.fill();
      marsLabel('INSIGHT · 2018', -30);
    },
    zhurong() {
      // Blue solar panels spread like butterfly wings
      wheels([-12, 0, 12], 4);
      px(-14, -16, 28, 8, WHITE);
      ctx.fillStyle = PANEL;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 6, -16); ctx.lineTo(s * 30, -28); ctx.lineTo(s * 26, -20); ctx.closePath(); ctx.fill(); }
      px(-2, -32, 3, 16, GREY); px(-5, -36, 9, 5, WHITE);
      marsLabel('ZHURONG · 2021', -44);
    },
    opportunity() {
      wheels([-14, 0, 14], 4);
      px(-24, -20, 48, 4, PANEL); px(-14, -16, 28, 6, WHITE);
      for (let x = -24; x < 24; x += 6) px(x, -20, 1, 4, '#6d8cf0');
      px(8, -40, 2, 20, GREY); px(4, -44, 10, 5, WHITE);
      ctx.fillStyle = 'rgba(201,120,80,0.55)'; ctx.fillRect(-24, -21, 48, 3); // dust on the panels
      marsLabel('OPPORTUNITY · 2004', -52);
    },
    spirit() {
      ctx.translate(0, 3); ctx.rotate(-0.12); // tipped over in the sand trap
      wheels([-14, 0, 14], 4);
      px(-24, -20, 48, 4, PANEL); px(-14, -16, 28, 6, WHITE);
      px(8, -40, 2, 20, GREY); px(4, -44, 10, 5, WHITE);
      ctx.rotate(0.12);
      ctx.fillStyle = '#c8704a'; ctx.beginPath(); ctx.ellipse(-6, 0, 26, 5, 0, Math.PI, TAU); ctx.fill();
      marsLabel('SPIRIT · 2004', -52);
    },
    sojourner() {
      wheels([-6, 0, 6], 2.5);
      px(-8, -10, 16, 5, '#d9d2c4'); px(-9, -12, 18, 2, PANEL);
      marsLabel('SOJOURNER · 1997', -20);
    },
    viking() {
      ctx.strokeStyle = GREY; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-18, 0); ctx.moveTo(8, -10); ctx.lineTo(18, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 0); ctx.stroke();
      px(-12, -22, 24, 12, '#c9c2b5'); px(-12, -22, 24, 2, WHITE);
      px(4, -34, 2, 12, GREY);
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.ellipse(5, -36, 9, 4, -0.3, 0, TAU); ctx.fill();
      marsLabel('VIKING 1 · 1976', -46);
    },
    face() {
      // A flat-topped hill. From the right angle, with the right shadows...
      ctx.fillStyle = '#8c3f28';
      ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(-30, -30); ctx.lineTo(30, -32); ctx.lineTo(46, 0); ctx.closePath(); ctx.fill();
      px(-16, -24, 9, 4, '#5e2a1c'); px(8, -24, 9, 4, '#5e2a1c'); px(-2, -20, 4, 8, '#6e3020'); px(-10, -10, 20, 3, '#5e2a1c');
      marsLabel('CYDONIA', -40);
    },
  };
  function drawMarsDecor() {
    for (const d of world.decor) at(d.a + theta, R0 - 2, () => MARS_DECOR[d.kind](d), 240);
  }

  function drawDecor() {
    if (level === 3) { drawMarsDecor(); return; }
    if (level === 2) { drawMoonDecor(); return; }
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

  // Level 2 platforms. The rockets and meteors follow the drawing: a pointed
  // nose, a porthole, and zigzag flames out the back.
  function zigFlame(x0, top, bottom, len, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x0, top);
    const n = 6;
    for (let i = 0; i <= n; i++) ctx.lineTo(x0 - (i % 2 ? len * 0.5 : len) - Math.sin(clock * 28 + i * 1.7) * 4, top + ((bottom - top) * i) / n);
    ctx.lineTo(x0, bottom); ctx.closePath(); ctx.fill();
  }
  const L2_PLATS = {
    pad(p, w, sq) {
      const col = p.route === 'venus' ? '#ffd23f' : '#ff6a4a';
      px(-w / 2 + 6, 4, 4, 26, '#5d5563'); px(w / 2 - 10, 4, 4, 26, '#5d5563');
      px(-w / 2, 0, w, 6, col);
      ctx.fillStyle = '#1b1530';
      ctx.beginPath(); ctx.moveTo(-w / 2 + 6, 1); ctx.quadraticCurveTo(0, 1 + sq * 14, w / 2 - 6, 1); ctx.lineTo(w / 2 - 6, 4); ctx.quadraticCurveTo(0, 4 + sq * 14, -w / 2 + 6, 4); ctx.fill();
      const on = Math.sin(clock * 5) > 0;
      px(-w / 2, -4, 6, 4, on ? '#fff3b0' : '#5d5563'); px(w / 2 - 6, -4, 6, 4, on ? '#5d5563' : '#fff3b0');
    },
    rocket(p, w) {
      ctx.scale(p.dir, 1);
      const h = 24, x0 = -w / 2 + 16, x1 = w / 2 - 26;
      zigFlame(x0, 2, h - 2, 46, '#ff8a2a');
      zigFlame(x0, 7, h - 7, 26, '#ffd36b');
      ctx.fillStyle = '#e0433b';
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 18, 0); ctx.lineTo(x0 - 6, -12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0, h); ctx.lineTo(x0 + 18, h); ctx.lineTo(x0 - 6, h + 12); ctx.fill();
      px(x0, 0, x1 - x0, h, '#eef1f7'); px(x0, h - 5, x1 - x0, 5, '#c9ced9');
      px(x0 + (x1 - x0) * 0.3, 0, 2, h, '#9aa3b5');
      ctx.fillStyle = '#e0433b';
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(w / 2, h / 2); ctx.lineTo(x1, h); ctx.fill();
      ctx.fillStyle = '#3b3b4f'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * 0.66, h / 2, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8fd0ff'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * 0.66, h / 2, 5, 0, TAU); ctx.fill();
    },
    kamo(p, w) { rock(w, '#8a7a78', '#6d5f5c', '#b0a29c', p); },
    phobos(p, w) {
      ctx.fillStyle = '#7a6a5e';
      ctx.beginPath(); ctx.moveTo(-w / 2, 10); ctx.quadraticCurveTo(-w / 2, -2, -w / 4, 0); ctx.lineTo(w / 4, -1); ctx.quadraticCurveTo(w / 2, 0, w / 2, 14);
      ctx.quadraticCurveTo(w / 2 - 6, 40, 0, 42); ctx.quadraticCurveTo(-w / 2 + 4, 40, -w / 2, 10); ctx.fill();
      ctx.fillStyle = '#5d5049';
      ctx.beginPath(); ctx.arc(-w * 0.18, 18, w * 0.13, 0, TAU); ctx.fill(); // Stickney crater
      ctx.beginPath(); ctx.arc(w * 0.2, 26, 5, 0, TAU); ctx.arc(w * 0.05, 12, 3, 0, TAU); ctx.fill();
      px(-w / 4, 0, w / 2, 3, '#a39282');
    },
    deimos(p, w) { L2_PLATS.phobos(p, w); },
    cloudv(p, w) {
      const puffs = [[-w * 0.32, 18, 17], [-w * 0.1, 12, 22], [w * 0.14, 14, 20], [w * 0.34, 20, 15]];
      ctx.fillStyle = '#cdb06a';
      for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y + 5, r, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f2e2a0';
      for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y + Math.sin(clock * 2 + x) * 1.5, r, 0, TAU); ctx.fill(); }
    },
    car(p, w) {
      // Lumen, the roadside drifter, in his old convertible
      const near = Math.abs(wrap(p.a + theta)) < 0.5;
      if (player.shield > 0 && player.lastPlat === p) {
        const bg = ctx.createLinearGradient(w / 2, 0, w / 2 + 160, 0);
        bg.addColorStop(0, 'rgba(255,243,176,0.55)'); bg.addColorStop(1, 'rgba(255,243,176,0)');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2 + 160, -30); ctx.lineTo(w / 2 + 160, 40); ctx.lineTo(w / 2, 10); ctx.fill();
      }
      px(-w / 2, 0, w, 15, '#c8323a'); px(-w / 2, 0, w, 3, '#ff7a7a'); px(-w / 2 + 4, 15, w - 8, 4, '#7d1f26');
      px(w / 2 - 6, 4, 6, 5, '#fff3b0'); px(-w / 2, 4, 4, 5, '#ff5a4a');
      ctx.font = '5px "Press Start 2P", monospace'; ctx.fillStyle = '#fff3c4'; ctx.fillText("DON'T PANIC", -16, 12);
      ctx.fillStyle = '#2a2230';
      for (const x of [-w / 2 + 24, w / 2 - 26]) { ctx.beginPath(); ctx.arc(x, 20, 8, 0, TAU); ctx.fill(); }
      px(-w / 2 + 21, 17, 6, 6, '#9aa3b5'); px(w / 2 - 29, 17, 6, 6, '#9aa3b5');
      // Windscreen, then Lumen: lanky, scuffed silver suit, waving when you're near
      px(-w / 2 + 52, -12, 3, 12, 'rgba(191,232,255,0.8)');
      px(-w / 2 + 28, -22, 12, 22, '#c9ced9'); px(-w / 2 + 30, -18, 3, 6, '#9aa3b5');
      ctx.fillStyle = '#e6e4ec'; ctx.beginPath(); ctx.arc(-w / 2 + 34, -29, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffb23a'; ctx.beginPath(); ctx.arc(-w / 2 + 36, -29, 5, -0.9, 0.9); ctx.fill();
      ctx.save(); ctx.translate(-w / 2 + 38, -20);
      ctx.rotate(near ? -1.3 + Math.sin(clock * 9) * 0.5 : -0.3);
      px(0, -2, 16, 4, '#c9ced9'); px(14, -3, 5, 6, '#e6e4ec');
      ctx.restore();
    },
    comet(p, w) {
      // Borisov: an icy lump with a long glowing tail streaming behind it
      ctx.scale(-1, 1);
      const tg = ctx.createLinearGradient(-w / 2, 0, -w / 2 - 200, 0);
      tg.addColorStop(0, 'rgba(180,230,255,0.7)'); tg.addColorStop(1, 'rgba(180,230,255,0)');
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 10, 0);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-w / 2 - (i % 2 ? 140 : 200) - Math.sin(clock * 6 + i) * 8, -10 + i * 9);
      ctx.lineTo(-w / 2 + 10, 34); ctx.fill();
      const cg = ctx.createRadialGradient(0, 14, 10, 0, 14, w * 0.8);
      cg.addColorStop(0, 'rgba(200,240,255,0.35)'); cg.addColorStop(1, 'rgba(200,240,255,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 14, w * 0.8, 0, TAU); ctx.fill();
      rock(w, '#9fb4d8', '#7d8db0', '#e6f4ff', p);
    },
    // Level 3
    cloudm(p, w) {
      // Thin Martian clouds of water ice, pale blue against the butterscotch
      const breath = Math.sin(clock * 1.4 + p.spin) * 0.04;
      ctx.scale(1 + p.squash * 0.15 + breath, 1 - p.squash * 0.2);
      ctx.fillStyle = 'rgba(214,232,245,0.7)';
      for (const [x, y, r] of [[-w * 0.3, 14, 14], [-w * 0.08, 10, 18], [w * 0.15, 12, 16], [w * 0.34, 16, 12]]) { ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.8, 0, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(240,250,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-w / 2, 6); ctx.bezierCurveTo(-w / 4, -2, w / 4, 14, w / 2, 4); ctx.stroke();
    },
    miner(p, w) {
      // A mining rig bolted to an asteroid: drill tower, ore skip, beacon
      rock(w, '#6f6670', '#4f4752', '#998fa0', p);
      ctx.strokeStyle = '#d9a93b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w / 2 - 34, 0); ctx.lineTo(w / 2 - 24, -34); ctx.lineTo(w / 2 - 14, 0); ctx.moveTo(w / 2 - 31, -12); ctx.lineTo(w / 2 - 17, -12); ctx.stroke();
      px(w / 2 - 25, -34, 2, 40 + Math.sin(clock * 6) * 3, '#9aa3b5');
      px(-w / 2 + 12, -8, 18, 8, '#8a5a3b'); px(-w / 2 + 14, -11, 14, 3, '#ffb23a');
      if (Math.sin(clock * 4 + p.spin) > 0) px(w / 2 - 26, -40, 4, 4, '#ff5a4a');
      ctx.font = '5px "Press Start 2P", monospace'; ctx.fillStyle = '#ffd23f'; ctx.fillText('CLAIMED', -16, 22);
    },
    hauler(p, w) {
      // A block of ice towed by a tug: water, air and fuel for the belt
      ctx.fillStyle = 'rgba(190,230,255,0.85)';
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2 - 20, 0); ctx.lineTo(w / 2 - 10, 18); ctx.lineTo(w / 2 - 24, 40); ctx.lineTo(-w / 2 + 14, 42); ctx.lineTo(-w / 2 - 6, 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(-w / 2 + 10, 4); ctx.lineTo(-w / 6, 4); ctx.lineTo(-w / 4, 20); ctx.closePath(); ctx.fill();
      px(-w / 2, 0, w - 20, 3, '#e8f6ff');
      ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w / 2 - 12, 18); ctx.lineTo(w / 2 + 16, 18); ctx.stroke();
      px(w / 2 + 16, 10, 22, 16, '#d6dce8'); px(w / 2 + 16, 10, 22, 4, '#e0433b'); px(w / 2 + 30, 14, 5, 5, '#8fd0ff');
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(clock * 20); px(w / 2 + 38, 13, 8, 10, '#8fd0ff'); ctx.globalAlpha = 1;
    },
    outpost(p, w) {
      // A belter outpost: a landing deck over a slowly spinning ring
      px(-w / 2, 0, w, 7, '#c9ced9'); px(-w / 2, 0, w, 2, '#eef1f7');
      px(-3, 7, 6, 22, '#9aa3b5');
      ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, 34, 62, 14, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const ang = clock * 0.6 + (i * TAU) / 8, x = Math.cos(ang) * 62, y = 34 + Math.sin(ang) * 14;
        px(x - 3, y - 2, 6, 4, Math.sin(ang) > 0 ? '#fff3b0' : '#5a6a8a');
      }
      for (const x of [-w / 2 + 4, w / 2 - 8]) if (Math.sin(clock * 3 + x) > 0) px(x, -4, 4, 4, '#52e07a');
    },
    ceres: (p, w) => beltWorld(p),
    vesta: (p, w) => beltWorld(p),
    pallas: (p, w) => beltWorld(p),
    hygiea: (p, w) => beltWorld(p),
  };
  // One of the four big worlds at the end of level 3. Its top is the landing spot.
  function beltWorld(p) {
    const B = p.world, r = B.r;
    ctx.save();
    ctx.fillStyle = B.body; ctx.beginPath(); ctx.arc(0, r, r, 0, TAU); ctx.fill();
    ctx.clip();
    ctx.fillStyle = B.dark;
    const craters = p.type === 'pallas' ? 14 : 6;
    for (let i = 0; i < craters; i++) {
      const ang = i * 2.39 + p.spin, d = r * (0.25 + ((i * 0.37) % 0.6));
      ctx.beginPath(); ctx.arc(Math.cos(ang) * d, r + Math.sin(ang) * d, p.type === 'pallas' ? 5 : 6 + (i % 3) * 5, 0, TAU); ctx.fill();
    }
    if (p.type === 'ceres') {
      // The bright salt spots in Occator crater, and a little belter town
      ctx.fillStyle = '#6c6966'; ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.55, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.55, 4, 0, TAU); ctx.arc(-r * 0.24, r * 0.6, 2.5, 0, TAU); ctx.fill();
    } else if (p.type === 'vesta') {
      // Rheasilvia: a huge crater at the south pole with a tall peak in it
      ctx.fillStyle = B.dark; ctx.beginPath(); ctx.ellipse(0, r * 2, r * 0.8, r * 0.35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = B.body; ctx.beginPath(); ctx.moveTo(-10, r * 2); ctx.lineTo(0, r * 1.72); ctx.lineTo(10, r * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(8,8,24,0.3)';
    ctx.beginPath(); ctx.arc(r * 0.35, r * 1.35, r * 1.05, 0, TAU); ctx.arc(-r * 0.2, r * 0.8, r * 1.05, 0, TAU, true); ctx.fill('evenodd');
    ctx.restore();
    px(-p.w / 2, -1, p.w, 3, hexOf(mix(B.body, '#ffffff', 0.35)));
    if (p.type === 'ceres') {
      for (const [x, s] of [[-40, 14], [-22, 10]]) { ctx.fillStyle = 'rgba(191,232,255,0.6)'; ctx.beginPath(); ctx.arc(x, 0, s, Math.PI, TAU); ctx.fill(); }
      if (Math.sin(clock * 3) > 0) px(-41, -18, 2, 3, '#ff5a4a');
    }
    // Its name, kept upright even when the view has turned sideways
    ctx.save(); ctx.translate(0, -26); upright();
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#1b1530'; ctx.fillText(B.name.toUpperCase(), 1, 1);
    ctx.fillStyle = '#ffd23f'; ctx.fillText(B.name.toUpperCase(), 0, 0);
    ctx.textAlign = 'start';
    ctx.restore();
  }
  // Undo the sideways turn, so text reads normally
  const upright = () => { if (flipA) ctx.rotate(-flipA); };
  function rock(w, body, dark, light, p) {
    ctx.rotate(Math.sin(clock * 0.5 + p.spin) * 0.05);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 12); ctx.lineTo(-w / 3, 0); ctx.lineTo(w / 4, -2); ctx.lineTo(w / 2, 10);
    ctx.lineTo(w / 3, 34); ctx.lineTo(-w / 5, 40); ctx.closePath(); ctx.fill();
    px(-12, 10, 10, 8, dark); px(10, 18, 8, 6, dark); px(-w / 3, 0, w * 0.55, 3, light);
  }

  function drawHazards() {
    for (const b of world.beams || []) {
      const st = beamState(b);
      if (st === 'off' || b.route !== route) continue;
      const R1 = tierR(b.tier) + 40, len = tierR(b.tier + 1) - 40 - R1;
      at(b.a + theta, R1, () => {
        const laser = b.kind === 'laser';
        if (laser) { px(-8, 4, 16, 8, '#5d5563'); px(-3, 0, 6, 4, '#9aa3b5'); } // the mining drone firing it
        if (st === 'warn') {
          if (Math.sin(clock * 30) > 0) for (let y = 0; y < len; y += 16) px(-1, -y - 8, 3, 8, laser ? 'rgba(255,90,74,0.85)' : 'rgba(255,210,63,0.85)');
        } else {
          px(-16, -len, 32, len, laser ? 'rgba(255,80,40,0.22)' : 'rgba(255,90,170,0.22)');
          px(-7, -len, 14, len, laser ? 'rgba(255,120,60,0.75)' : 'rgba(255,140,200,0.7)');
          px(-2, -len, 4, len, laser ? '#fff1e0' : '#fff3f8');
        }
      }, len + 60);
    }
    for (const d of world.dust || []) {
      if (d.route !== route) continue;
      at(d.a + theta, d.R, () => {
        for (let i = 0; i < 48; i++) {
          const ang = i * 2.4 + d.phase, rr = ((i * 7) % 11) / 11;
          const x = Math.cos(ang + clock * 0.25) * 120 * rr, y = Math.sin(ang * 1.3 + clock * 0.35) * 70 * rr;
          px(x, y, 3, 3, i % 3 ? 'rgba(201,162,122,0.6)' : 'rgba(150,120,90,0.7)');
        }
      }, 170);
    }
    // Belt asteroids: bumpers. With the force field on, their rims light up
    for (const q of world.rocks || []) {
      at(q.a + theta, q.R, () => {
        const live = player.field > 0 || player.shield > 0;
        if (live || q.flash > 0) {
          ctx.strokeStyle = `rgba(255,106,213,${0.25 + 0.2 * Math.sin(clock * 4 + q.ph) + q.flash * 0.6})`;
          ctx.lineWidth = 3 + q.flash * 4;
          ctx.beginPath(); ctx.arc(0, 0, q.r + 5 + q.flash * 6, 0, TAU); ctx.stroke();
        }
        ctx.save(); ctx.rotate(q.spin + clock * 0.3);
        ctx.fillStyle = q.flash > 0.5 ? '#ffd6f2' : '#6f6670';
        ctx.beginPath();
        for (let i = 0; i < 9; i++) { const ang = (i * TAU) / 9, rr = q.r * (0.82 + 0.18 * Math.sin(i * 2.7 + q.ph)); i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(rr, 0); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4f4752';
        ctx.beginPath(); ctx.arc(-q.r * 0.3, -q.r * 0.2, q.r * 0.22, 0, TAU); ctx.arc(q.r * 0.35, q.r * 0.25, q.r * 0.15, 0, TAU); ctx.fill();
        px(-q.r * 0.5, -q.r * 0.7, q.r * 0.6, 3, '#998fa0');
        ctx.restore();
        if (q.claim) { px(-1, -q.r - 14, 2, 14, '#c9ced9'); px(1, -q.r - 14, 9, 6, '#ffd23f'); } // someone's mining claim
      }, 80);
    }
    for (const m of fx.meteors) {
      at(m.a + theta, m.R, () => {
        ctx.scale(Math.sign(m.va) || 1, 1);
        zigFlame(-6, -12, 12, 70, 'rgba(255,138,42,0.9)');
        zigFlame(-6, -6, 6, 40, 'rgba(255,211,107,0.9)');
        ctx.fillStyle = '#8a5a3b'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
        px(-5, -4, 5, 4, '#5a3a28'); px(3, 2, 4, 4, '#5a3a28'); px(-2, -9, 6, 3, '#c9a27a');
      }, 120);
    }
  }
  // The being of light: a glowing ring with an eye, beside the platform at the
  // turn and at the outpost. It brightens and sings when it gives you a field.
  function drawBeings() {
    for (const p of world.plats) {
      if (!p.main || !(p.tier === FLIP || p.type === 'outpost')) continue;
      at(p.a + theta, p.R, () => {
        ctx.translate(p.w / 2 + 46, -50 + Math.sin(clock * 1.7) * 8);
        upright();
        const sing = clamp(1 - (clock - (p.beingT || -9)) / 2.5, 0, 1);
        const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46 + sing * 30);
        glow.addColorStop(0, `rgba(255,214,242,${0.7 + sing * 0.3})`); glow.addColorStop(1, 'rgba(255,106,213,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 46 + sing * 30, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffd6f2'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 22, 7, clock * (0.8 + i * 0.3) + i * 1.05, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
        const look = clamp(-wrap(p.a + theta) * 4, -1, 1); // its eye follows you
        ctx.fillStyle = '#6a2a8a'; ctx.beginPath(); ctx.arc(look * 2.5, 0, 3, 0, TAU); ctx.fill();
        if (sing > 0) {
          ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,214,242,${sing})`;
          ctx.fillText('♪', -26 + Math.sin(clock * 3) * 4, -24 - (1 - sing) * 20); ctx.fillText('♫', 24, -30 - (1 - sing) * 26);
          ctx.textAlign = 'start';
        }
      }, 120);
    }
  }
  // A meteor coming in from off screen gets a warning at the edge
  function drawMeteorWarnings() {
    for (const m of fx.meteors) {
      const ph = m.a + theta, x = cx + m.R * Math.sin(ph), y = cy - m.R * Math.cos(ph);
      const coming = (x < 0 && m.va > 0) || (x > W && m.va < 0);
      if (!coming || y < 0 || y > H || Math.sin(clock * 16) < 0) continue;
      const ex = x < 0 ? 14 : W - 14;
      px(ex - 8, y - 12, 16, 24, '#ff5a4a'); px(ex - 2, y - 8, 4, 10, '#ffffff'); px(ex - 2, y + 5, 4, 4, '#ffffff');
    }
  }
  function drawWind() {
    if (player.onGround) return;
    const wnd = TIERS[clamp(Math.floor(tierFloat(player.r)), 0, TOP)].wind;
    if (!wnd) return;
    ctx.fillStyle = player.shield > 0 ? 'rgba(143,208,255,0.25)' : 'rgba(255,230,160,0.4)';
    for (let i = 0; i < 16; i++) {
      const y = ((i * 0.37 + 0.11) % 1) * H, len = 30 + (i % 4) * 18;
      const x = ((((i * 0.61) + clock * (0.45 + (i % 3) * 0.2) * wnd) % 1) * (W + len)) - len;
      ctx.fillRect(Math.round(x), Math.round(y), len, 2);
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
        // Jelly wobble after a landing (squash, overshoot, settle) plus a slow idle breath.
        const spring = Math.exp(-4.5 * p.jig) * Math.cos(17 * p.jig) * p.hit;
        const breath = Math.sin(clock * 1.6 + p.spin) * 0.03;
        ctx.scale(1 + spring * 0.22 + breath, 1 - spring * 0.32 - breath * 0.6);
        const base = p.type === 'nlc' ? 'rgba(130,200,255,0.85)' : '#ffffff';
        const shade = p.type === 'nlc' ? 'rgba(80,120,255,0.7)' : '#d7e6f5';
        const bulge = (i) => 1 + spring * 0.18 * (i % 2 ? 1 : -1) + Math.sin(clock * 2.3 + p.spin + i * 1.7) * 0.04;
        const puffs = [[-w * 0.32, 18, 17], [-w * 0.1, 12, 22], [w * 0.14, 14, 20], [w * 0.34, 20, 15]].map(([x, y, r], i) => [x, y, r * bulge(i)]);
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
      } else if (L2_PLATS[p.type]) {
        L2_PLATS[p.type](p, w, sq);
      } else if (p.dest) {
        // The planet itself is drawn by drawSkyMoon; once it has arrived, mark the spot.
        const m = moonView();
        if (!m || m.t < 0.98) return;
        if (p.type === 'venus') {
          // A city floating in the clouds, 50 km up, where the air is mild
          px(-96, 0, 192, 8, '#d6dce8'); px(-84, 8, 168, 6, '#9aa3b5');
          for (const x of [-70, 62]) {
            ctx.fillStyle = 'rgba(191,232,255,0.6)'; ctx.beginPath(); ctx.arc(x, 0, 20, Math.PI, TAU); ctx.fill();
            px(x - 1, -34, 2, 14, '#c9ced9');
          }
          ctx.fillStyle = '#f2e6d0'; ctx.beginPath(); ctx.ellipse(-70, -56, 18, 14, 0, 0, TAU); ctx.fill();
        } else {
          px(30, -40, 3, 41, '#e8e8f0'); px(33, -40, 22, 14, '#e0433b'); px(36, -36, 6, 6, '#ffd23f');
          if (p.type === 'mars') {
            px(-70, -16, 34, 8, '#e6e4ec'); px(-62, -24, 6, 8, '#9aa3b5');
            ctx.fillStyle = '#3b3b4f';
            for (const x of [-66, -53, -40]) { ctx.beginPath(); ctx.arc(x, -5, 4, 0, TAU); ctx.fill(); }
          }
        }
      }
    }, 220);
  }

  function drawRide(p) {
    const r = p.ride;
    const moving = r.state === 'moving' || r.state === 'returning';
    // Dotted orbit line showing where the ride goes, until it's used
    if (r.state === 'near') {
      ctx.fillStyle = 'rgba(143,208,255,0.55)';
      const steps = 60;
      for (let i = 1; i <= steps; i++) {
        const a = r.near + (r.far - r.near) * (i / steps);
        at(a + theta, p.R + 18, () => { px(-2, -2, 4, 4, 'rgba(143,208,255,0.55)'); }, 10);
      }
    }
    at(p.a + theta, p.R, () => {
      if (moving) {
        // Streaks trailing behind as it races round
        const dir = Math.sign(r.to - r.from);
        ctx.fillStyle = r.kind === 'jet' ? 'rgba(255,255,255,0.7)' : 'rgba(255,210,63,0.6)';
        for (let i = 0; i < 7; i++) {
          const y = 4 + i * 6, len = 40 + ((i * 37 + Math.floor(clock * 20)) % 50);
          ctx.fillRect(-dir * (p.w / 2 + 6) - (dir > 0 ? len : 0), y, len, 2);
        }
      }
      // Docked: the windows glow while the tramp suits up inside
      if (r.kind === 'iss' && player.inside && player.lastPlat === p) {
        for (let i = -1; i <= 1; i++) {
          const on = Math.sin(clock * 6 + i * 2) > 0;
          px(i * 11 - 3, 6, 6, 5, on ? '#fff3b0' : '#5a6a8a');
        }
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1b1530'; ctx.fillText('SUITING UP', 1, -15);
        ctx.fillStyle = '#ffd23f'; ctx.fillText('SUITING UP', 0, -16);
        ctx.textAlign = 'start';
      }
      if (r.kind === 'car' && r.state === 'loop') {
        ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#1b1530'; ctx.fillText('LUMEN', 1, 44);
        ctx.fillStyle = '#ffab3d'; ctx.fillText('LUMEN', 0, 43);
        ctx.textAlign = 'start';
      }
      // Label so you know this one goes somewhere
      if (r.state === 'near') {
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const label = r.kind === 'iss' && !player.suit ? 'DOCK HERE' : r.kind === 'comet' ? 'HITCH A RIDE' : 'RIDE';
        ctx.fillStyle = '#1b1530'; ctx.fillText(label, 1, 58);
        ctx.fillStyle = '#8fd0ff'; ctx.fillText(label, 0, 57);
        ctx.textAlign = 'start';
      }
    }, 260);
  }

  function drawGeom(a, R, size, spin, alpha) {
    at(a + theta, R, () => {
      ctx.globalAlpha = alpha;
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, size * 2.2);
      glow.addColorStop(0, 'rgba(109,255,122,0.55)');
      glow.addColorStop(1, 'rgba(109,255,122,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, size * 2.2, 0, TAU); ctx.fill();
      ctx.rotate(spin);
      ctx.strokeStyle = '#6dff7a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, 0); ctx.lineTo(0, size); ctx.lineTo(-size * 0.7, 0); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(190,255,196,0.9)';
      ctx.beginPath(); ctx.moveTo(0, -size * 0.45); ctx.lineTo(size * 0.3, 0); ctx.lineTo(0, size * 0.45); ctx.lineTo(-size * 0.3, 0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }, 40);
  }
  function drawStar(s) {
    if (s.taken || ghost(s)) return;
    const bob = Math.sin(clock * 3 + s.id) * 4;
    drawGeom(s.a, s.R + bob, s.big ? 14 : 10, clock * 2 + s.id, 1);
  }
  function drawGeoms() {
    for (const g of fx.geoms) {
      const left = g.life - g.t;
      const blink = left < 1.5 ? (Math.sin(g.t * 30) > 0 ? 1 : 0.25) : 1;
      drawGeom(g.a, g.R, 8, g.spin + clock * 4, blink);
    }
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
      const big = level === 1 && k === 9;
      px(x - (big ? 7 : 4), y, big ? 14 : 8, 2, k <= bestTier ? '#ffd23f' : 'rgba(238,241,255,0.45)');
      if (mode === 'checkpoint' && CHECKPOINTS.has(k)) {
        ctx.fillStyle = k <= checkpoint ? '#52e07a' : 'rgba(238,241,255,0.6)';
        ctx.beginPath(); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x + 12, y - 2); ctx.lineTo(x + 5, y + 1); ctx.fill();
      }
    }
    // Your best height so far, on this device
    if (level === 1 && rec().bestTier > 0) {
      const yb = yFor(Math.min(rec().bestTier, TOP));
      ctx.fillStyle = 'rgba(255,210,63,0.9)';
      ctx.beginPath(); ctx.moveTo(x - 12, yb - 4); ctx.lineTo(x - 6, yb + 1); ctx.lineTo(x - 12, yb + 6); ctx.fill();
    }
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(238,241,255,0.8)';
    if (level === 1) ctx.fillText('100 km', x - 10, yFor(9) + 4);
    ctx.textAlign = 'start';
    if (level === 3) {
      // From Mars at the bottom to the four belt worlds at the top; a pink
      // tick marks where the view turns sideways
      ctx.fillStyle = '#c8553a'; ctx.beginPath(); ctx.arc(x, bottom + 10, 8, 0, TAU); ctx.fill();
      px(x - 4, bottom + 6, 3, 3, '#9a3b2a');
      px(x - 8, yFor(FLIP), 16, 2, '#ff6ad5');
      for (const [i, c] of ['#8d8a86', '#a39a8a', '#7f8a94', '#5d5a5e'].entries()) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x - 9 + i * 6, top - 10, 3, 0, TAU); ctx.fill(); }
    } else if (level === 2) {
      // From the Moon at the bottom to Mars or Venus at the top
      ctx.fillStyle = '#c9c7cf'; ctx.beginPath(); ctx.arc(x, bottom + 10, 8, 0, TAU); ctx.fill();
      px(x - 4, bottom + 6, 3, 3, '#9e9caa'); px(x + 1, bottom + 11, 3, 3, '#9e9caa');
      if (route) { ctx.fillStyle = route === 'venus' ? '#efd9a0' : '#c8553a'; ctx.beginPath(); ctx.arc(x, top - 10, 7, 0, TAU); ctx.fill(); }
      else {
        ctx.fillStyle = '#efd9a0'; ctx.beginPath(); ctx.arc(x - 6, top - 10, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c8553a'; ctx.beginPath(); ctx.arc(x + 6, top - 10, 5, 0, TAU); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#3a8fe0'; ctx.beginPath(); ctx.arc(x, bottom + 10, 8, 0, TAU); ctx.fill();
      px(x - 4, bottom + 5, 5, 4, '#4fb34a'); px(x + 1, bottom + 11, 4, 3, '#4fb34a');
      ctx.fillStyle = '#c9c7cf'; ctx.beginPath(); ctx.arc(x, top - 10, 7, 0, TAU); ctx.fill();
    }
    const y = yFor(tierFloat(player.r));
    px(x - 5, y - 5, 10, 10, '#1b1530'); px(x - 4, y - 4, 8, 8, '#e0433b');
  }

  function render() {
    if (state === 'splash') { drawIntro(); return; }
    const anchorY = H * (cam.anchor || 0.46);
    cx = Math.round(W / 2);
    cy = anchorY + cam.r;
    drawSky();
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    // Level 3 past the turn: the whole world swings a quarter turn, so "up"
    // points right and Mars drops away to the left. The tramp sits left of
    // centre, to leave room to see what's coming.
    const fk = level === 3 ? flipK * flipK * (3 - 2 * flipK) : 0;
    flipA = fk * Math.PI / 2;
    if (fk > 0) {
      const x0 = cx, y0 = anchorY;
      ctx.translate(lerp(x0, W * (0.3 + (0.46 - cam.anchor) * 1.25), fk), lerp(y0, H * 0.5, fk));
      ctx.rotate(flipA);
      ctx.translate(-x0, -y0);
    }
    // Zoom about the tramp (only differs from 1 during a ride).
    const z = cam.zoom, pivotY = cy - player.r;
    if (z < 0.999) { ctx.translate(cx, pivotY); ctx.scale(z, z); ctx.translate(-cx, -pivotY); }
    view = { x0: cx - cx / z, x1: cx + (W - cx) / z, y0: pivotY - pivotY / z, y1: pivotY + (H - pivotY) / z };
    if (fk > 0) { const half = Math.hypot(W, H) / z; view = { x0: cx - half, x1: cx + half, y0: anchorY - half, y1: anchorY + half }; }
    if (level === 3) drawMarsScape(); else if (level === 2) drawPlains(); else drawMountains();
    if (level === 3) drawMarsBody(); else if (level === 2) drawMoonBody(); else drawEarth();
    drawDecor();
    drawCraters();
    for (const p of world.plats) {
      if (ghost(p)) ctx.globalAlpha = 0.18;
      if (p.ride) drawRide(p);
      drawPlatform(p);
      ctx.globalAlpha = 1;
    }
    if (level >= 2) drawHazards();
    if (level === 3) drawBeings();
    for (const p of world.plats) {
      if (mode !== 'checkpoint' || !p.main || !CHECKPOINTS.has(p.tier)) continue;
      if (level === 2 && p.route !== (route || 'mars')) continue;
      at(p.a + theta, p.R, () => {
        const col = p.tier <= checkpoint ? '#52e07a' : 'rgba(238,241,255,0.8)';
        const x = -p.w / 2 + 4, wave = Math.sin(clock * 5 + p.tier) * 2;
        px(x, -30, 2, 30, '#e8e8f0');
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x + 2, -30); ctx.lineTo(x + 16, -25 + wave); ctx.lineTo(x + 2, -20); ctx.fill();
      });
    }
    for (const s of world.stars) drawStar(s);
    drawGeoms();

    const onSurface = level === 2 && player.onGround && player.r <= R0 + 0.5;
    const feetX = cx, feetY = Math.round(cy - player.r - (onSurface ? surfAt(-theta) : 0));
    let frame = 'stand';
    if (!player.onGround) frame = 'jump';
    else if ((state === 'title') || Math.abs(player.vx) > 5) frame = WALK_CYCLE[Math.floor(player.walkT) % 4];
    // Squash on landing, stretch while rising or falling fast
    const stretch = player.onGround ? 0 : clamp(Math.abs(player.vr) / 5000, 0, 0.18);
    const sy = 1 - player.squash * 0.2 + stretch;
    const sx = 1 + player.squash * 0.15 - stretch * 0.6;
    const hidden = player.inside;
    for (const g of hidden ? [] : fx.trail) {
      const ph = g.a + theta;
      drawSprite('jump', cx + g.r * Math.sin(ph), cy - g.r * Math.cos(ph), g.flip, 1, 1, g.life * 2);
    }
    if (!hidden) {
      drawGuide(feetX, feetY);
      drawFire(feetX, feetY);
      drawSprite(frame, feetX, feetY, player.facing < 0, sy, sx, 1, player.heat > 0.55 ? HOT : player.suit ? SUIT : PAL);
      if (level >= 2 && player.shield > 0 && (player.shield > 3 || Math.sin(clock * 20) > 0)) {
        ctx.fillStyle = 'rgba(143,208,255,0.14)'; ctx.strokeStyle = 'rgba(143,208,255,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(feetX, feetY - 24, 36, 0, TAU); ctx.fill(); ctx.stroke();
      }
      if (level === 3 && player.field > 0) {
        // The force field: a pink bubble, one ring per charge left
        const k = player.field / FIELD_MAX;
        ctx.fillStyle = `rgba(255,106,213,${0.08 + 0.08 * k})`; ctx.strokeStyle = `rgba(255,150,230,${0.5 + 0.4 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(feetX, feetY - 24, 40 + Math.sin(clock * 6) * 2, 0, TAU); ctx.fill(); ctx.stroke();
        for (let i = 0; i < player.field; i++) {
          const ang = clock * 1.5 + (i * TAU) / FIELD_MAX;
          px(feetX + Math.cos(ang) * 40 - 2, feetY - 24 + Math.sin(ang) * 40 - 2, 4, 4, '#ffd6f2');
        }
      }
    }
    drawParticles();
    drawFx();
    ctx.restore();
    if (fk > 0) {
      // Speed lines run along the direction of travel, so sideways once turned
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(flipA); ctx.translate(-W / 2, -H / 2);
      drawSpeedLines();
      ctx.restore();
    } else drawSpeedLines();
    if (level >= 2) { drawWind(); if (fk < 0.05) drawMeteorWarnings(); }
    drawBanner();
    if (fx.dedication > 0) {
      // For the man who fell to Earth
      ctx.globalAlpha = clamp(Math.min(fx.dedication, 7 - fx.dedication), 0, 1);
      ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      for (const [i, line] of ['For David Bowie, who looked up', 'and made the rest of us look too.'].entries()) {
        ctx.fillStyle = '#1b1530'; ctx.fillText(line, W / 2 + 1, H * 0.58 + i * 16 + 1);
        ctx.fillStyle = '#eef1ff'; ctx.fillText(line, W / 2, H * 0.58 + i * 16);
      }
      ctx.textAlign = 'start'; ctx.globalAlpha = 1;
    }
    if (fx.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${fx.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    if (state === 'descend') drawIntroOverlay();
    else drawRail();
  }

  // ---- Intro: a comet writes the title in space; tap to fall to Earth --------
  const intro = { t: 0, letters: [], parts: [], warp: [], passT: 0, dT: 0, startR: 0, ready: 0 };
  const INTRO_LINES = [
    { text: 'INTERSTELLAR', scale: 0.4, row: -1, colors: ['#8fd0ff'] },
    { text: 'SUPERTRAMP', scale: 1, row: 0, colors: ['#ffd23f', '#ffd23f', '#ffd23f', '#ffd23f', '#ffd23f', '#eef1ff'] },
  ];
  const PASS = 2.6;      // seconds for the comet to cross the screen
  const DESCEND = 2.6;   // seconds for the fall to Earth
  for (let i = 0; i < 140; i++) intro.warp.push({ a: Math.random() * TAU, d: Math.random(), v: 0.15 + Math.random() * 0.5 });

  function introLayout() {
    const big = Math.max(20, Math.min(W * 0.085, 72));
    const out = [];
    for (const line of INTRO_LINES) {
      const size = Math.round(big * line.scale);
      ctx.font = `${size}px "Press Start 2P", monospace`;
      const cw = ctx.measureText('M').width * 1.06;
      const total = cw * line.text.length;
      const y = H * 0.42 + line.row * big * 1.25;
      [...line.text].forEach((ch, i) => out.push({ ch, size, x: W / 2 - total / 2 + cw * (i + 0.5), y, color: line.colors[Math.min(i, line.colors.length - 1)] }));
    }
    return out;
  }
  const cometY = (x) => H * 0.42 + Math.sin((x / W) * Math.PI * 1.2 - 0.5) * H * 0.1 + 12;
  const cometX = (k) => lerp(-0.2 * W, 1.25 * W, k);
  const easeBack = (k) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  function updateIntro(dt) {
    intro.t += dt;
    const lay = introLayout();
    while (intro.letters.length < lay.length) intro.letters.push({ emitT: null, fx: 0, fy: 0, glint: -9 });
    // Comet passes: the first one writes the title off its tail, later ones make it glint
    intro.passT += dt;
    const period = PASS + 2.2;
    if (intro.passT > period) intro.passT -= period;
    const k = intro.passT / PASS;
    if (k <= 1) {
      const hx = cometX(k), hy = cometY(hx);
      for (let i = 0; i < 7; i++) {
        intro.parts.push({ x: hx, y: hy, vx: -(60 + Math.random() * 160), vy: (Math.random() - 0.5) * 70, life: 0.6 + Math.random() * 0.9, t: 0, s: 2 + Math.random() * 3, c: ['#ffffff', '#bfe8ff', '#8fd0ff', '#b58cff'][i % 4] });
      }
      lay.forEach((L, i) => {
        const st = intro.letters[i];
        if (hx - 50 > L.x) {
          if (st.emitT === null) {
            st.emitT = intro.t; st.fx = hx - 50; st.fy = cometY(hx - 50);
            for (let j = 0; j < 8; j++) intro.parts.push({ x: st.fx, y: st.fy, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.5 + Math.random() * 0.5, t: 0, s: 2 + Math.random() * 2, c: L.color });
          } else if (intro.t - st.glint > 1 && intro.t - st.emitT > 1.5) st.glint = intro.t;
        }
      });
    }
    for (const p of intro.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 0.8; }
    intro.parts = intro.parts.filter((p) => p.t < p.life);
    if (!intro.ready && intro.letters.every((l) => l.emitT !== null && intro.t - l.emitT > 0.9)) intro.ready = intro.t;
    for (const w of intro.warp) { w.d += w.v * dt * (state === 'descend' ? 3 : 1); if (w.d > 1) { w.d = 0; w.a = Math.random() * TAU; } }

    if (state === 'descend') {
      intro.dT += dt;
      const p = clamp(intro.dT / DESCEND, 0, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      cam.r = lerp(intro.startR, R0, e);
      cam.anchor = 0.46;
      if (p >= 1) finishDescend();
    }
  }

  function drawWarp(alpha) {
    // Stars streaming out from the middle, like flying through space
    const cx0 = W / 2, cy0 = H * 0.42, maxR = Math.hypot(W, H) * 0.6;
    ctx.lineCap = 'round';
    for (const w of intro.warp) {
      const r1 = Math.pow(w.d, 2.2) * maxR, r0 = Math.max(0, r1 - 6 - w.d * 40);
      ctx.strokeStyle = `rgba(220,235,255,${alpha * Math.min(1, w.d * 2.5)})`;
      ctx.lineWidth = 1 + w.d * 2;
      ctx.beginPath();
      ctx.moveTo(cx0 + Math.cos(w.a) * r0, cy0 + Math.sin(w.a) * r0);
      ctx.lineTo(cx0 + Math.cos(w.a) * r1, cy0 + Math.sin(w.a) * r1);
      ctx.stroke();
    }
  }

  function drawIntroText(alpha, lift) {
    const lay = introLayout();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lay.forEach((L, i) => {
      const st = intro.letters[i];
      if (!st || st.emitT === null) return;
      const k = clamp((intro.t - st.emitT) / 0.9, 0, 1);
      const e = easeBack(k);
      const x = lerp(st.fx, L.x, e);
      const y = lerp(st.fy, L.y, e) + Math.sin(intro.t * 2 + i * 0.6) * 3 * k - lift;
      const sc = 0.25 + 0.75 * e;
      const gl = clamp(1 - (intro.t - st.glint) / 0.35, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha * Math.min(1, k * 3);
      ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.font = `${L.size}px "Press Start 2P", monospace`;
      if (L.size > 30) { ctx.fillStyle = '#1b1530'; ctx.fillText(L.ch, 4, 4); ctx.fillStyle = '#e0433b'; ctx.fillText(L.ch, 2, 2); }
      ctx.fillStyle = gl > 0 ? mix(L.color, '#ffffff', gl) : L.color;
      ctx.fillText(L.ch, 0, 0);
      ctx.restore();
    });
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  function drawComet(alpha) {
    for (const p of intro.parts) {
      ctx.globalAlpha = alpha * (1 - p.t / p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    const k = intro.passT / PASS;
    if (k > 1 || alpha <= 0) return;
    const hx = cometX(k), hy = cometY(hx);
    const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, 34);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.35, `rgba(170,225,255,${0.7 * alpha})`);
    g.addColorStop(1, 'rgba(120,160,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(hx, hy, 34, 0, TAU); ctx.fill();
  }

  function drawIntro() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#02030a'); bg.addColorStop(1, '#0b1030');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // a faint nebula
    const neb = ctx.createRadialGradient(W * 0.7, H * 0.3, 10, W * 0.7, H * 0.3, W * 0.6);
    neb.addColorStop(0, 'rgba(120,70,200,0.18)'); neb.addColorStop(1, 'rgba(120,70,200,0)');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    for (const st of world.sky) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(clock * 2 + st.tw);
      px(st.x * W, st.y * H, st.s, st.s, '#ffffff');
    }
    ctx.globalAlpha = 1;
    drawWarp(0.9);
    // Home, far below: the rim of the Earth glowing at the bottom
    const er = W * 1.4, ey = H + er * 0.93;
    const atm = ctx.createRadialGradient(W / 2, ey, er * 0.98, W / 2, ey, er * 1.06);
    atm.addColorStop(0, 'rgba(120,200,255,0.55)'); atm.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(W / 2, ey, er * 1.06, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1d4f8f'; ctx.beginPath(); ctx.arc(W / 2, ey, er, 0, TAU); ctx.fill();
    drawComet(1);
    drawIntroText(1, 0);
    if (intro.ready && intro.t - intro.ready > 0.3 && Math.floor(intro.t * 1.8) % 2 === 0) {
      ctx.font = `${W < 480 ? 10 : 13}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(touch ? 'TAP TO START' : 'CLICK OR PRESS SPACE', W / 2, H * 0.68);
      ctx.textAlign = 'start';
    }
  }

  function drawIntroOverlay() {
    // During the fall the title and comet fly up and fade as the world arrives
    const p = clamp(intro.dT / DESCEND, 0, 1);
    const a = clamp(1 - p * 1.8, 0, 1);
    if (a <= 0) return;
    drawWarp(a * 0.9);
    ctx.save(); ctx.translate(0, -p * H * 0.8);
    drawComet(a);
    ctx.restore();
    drawIntroText(a, p * H * 0.8);
  }

  function beginDescend() {
    if (state !== 'splash') return;
    state = 'descend';
    intro.dT = 0;
    intro.startR = tierR(11);
    cam.r = intro.startR;
    if (snd) { snd.init(); snd.music.start(); snd.sfx.whoosh(); }
  }

  function finishDescend() {
    state = 'title';
    cam.r = R0;
    document.body.classList.remove('intro');
    const t = $('title');
    t.hidden = false;
    t.classList.remove('fade-in'); void t.offsetWidth; t.classList.add('fade-in');
    if (typeof loadTitleBoard === 'function') loadTitleBoard();
  }

  canvas.addEventListener('pointerdown', () => { if (state === 'splash') beginDescend(); });
  // No long-press menus on the game or its touch buttons (Android)
  for (const el of [canvas, ...document.querySelectorAll('.pad button, .hud button')]) el.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- Title logo: the tramp hops along the letters ---------------------------
  function startLogo() {
    const c = $('logo-tramp');
    if (!c) return;
    const g = c.getContext('2d');
    const paint = (frame) => {
      g.clearRect(0, 0, c.width, c.height);
      FRAMES[frame].forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '.') continue;
          g.fillStyle = PAL[row[i]];
          g.fillRect(i * SCALE, j * SCALE, SCALE, SCALE);
        }
      });
    };
    const letters = [...document.querySelectorAll('.logo-main span')];
    const spot = (el) => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop });
    const land = (el) => {
      el.classList.remove('squash'); void el.offsetWidth; el.classList.add('squash');
      el.addEventListener('animationend', () => el.classList.remove('squash'), { once: true });
    };
    let at = 0, step = 1, t0 = performance.now() + 1100; // wait for the letters to drop in
    let flip = false, ends = 0;
    const HOP = 480;
    function tick(now) {
      requestAnimationFrame(tick);
      if ($('title').hidden || !c.offsetWidth) return;
      let u = (now - t0) / (flip ? HOP * 2.2 : HOP);
      if (u >= 1) {
        if (flip) flip = false;
        else {
          at += step;
          if (at === letters.length - 1 || at === 0) {
            step = -step; // turn round at each end
            ends++;
            flip = ends % 2 === 0 || Math.random() < 0.35; // and now and then a big flip
          }
        }
        land(letters[at]);
        if (flip) sfx.hop();
        t0 = now; u = 0;
      }
      u = Math.max(0, u);
      const a = spot(letters[at]), b = flip ? a : spot(letters[at + step]);
      const x = lerp(a.x, b.x, u), base = lerp(a.y, b.y, u);
      const h = c.offsetHeight, w = c.offsetWidth;
      const y = base - h + 4 - Math.sin(u * Math.PI) * h * (flip ? 2.4 : 0.9);
      const spin = flip ? (u < 0.12 ? 0 : u > 0.88 ? 360 : ((u - 0.12) / 0.76) * 360) * -step : 0;
      paint(u > 0.08 && u < 0.92 ? 'jump' : 'stand');
      c.style.transform = `translate(${x - w / 2}px, ${y}px) rotate(${spin}deg) scaleX(${step < 0 ? -1 : 1})`;
    }
    requestAnimationFrame(tick);
  }
  startLogo();

  // ---- Flow -----------------------------------------------------------------
  // carry: the score so far when you come straight on from the Moon
  let carry = null;
  function startGame(lv = level, from = null) {
    if (snd) { snd.init(); snd.music.start(); }
    tilt.zero = null;
    level = lv; route = lv === 3 ? 'belt' : null; landedOn = null; flipK = 0; useTiers();
    reset(Math.floor(Math.random() * 1e9));
    carry = from;
    if (carry) { score = carry.score; mult = carry.mult; updateScoreHud(); }
    if (level === 1) rec().runs++;
    bests.last = mode; saveBests();
    state = 'play';
    $('title').hidden = true;
    $('won').hidden = true;
    document.body.classList.add('playing');
    if (level === 3) {
      banner('MARS', 'NEXT STOP: THE ASTEROID BELT');
      toast('Welcome to Mars. Behind you: Olympus Mons, the biggest volcano we know of, two and a half times as tall as Everest. The launch pad to the belt is to the right.', 7);
    } else if (level === 2) {
      banner('MOON BASE', 'MARS OR VENUS?');
      fx.dedication = 7;
      toast('Mars is to the right, Venus to the left. Walk to a launch pad and hop on. You float here: Moon gravity is a sixth of Earth\'s.', 6);
    } else if (mode === 'uber') toast('Uber Tramp: no checkpoints. Miss once and it is back to Earth.', 4.5);
    else toast(touch ? (tilt.on ? 'Tilt to walk, press HOP to jump on a trampoline.' : 'Walk to a trampoline, press HOP to jump on. Tap TILT to steer by tilting.') : 'Walk to a trampoline, then hop on with Space.', 4.5);
    canvas.focus();
    try { navigator.wakeLock?.request('screen').catch(() => {}); } catch (e) { /* not available */ }
  }
  const L2_TIME_MEDALS = [[60, 'gold'], [90, 'silver'], [140, 'bronze']];
  const L3_TIME_MEDALS = [[90, 'gold'], [130, 'silver'], [190, 'bronze']];
  const START_BODY = { 1: 'Earth', 2: 'the Moon', 3: 'Mars' };
  function win() {
    buzz([30, 60, 30, 60, 90]);
    state = 'won';
    document.body.classList.remove('playing');
    const dest = destName();
    banner(dest.replace('the ', '').toUpperCase(), level >= 2 ? `${fmtKm(TIERS[TOP].km)}` : '384,400 km');
    fx.flash = 0.6;
    addShake(10);
    for (let i = 0; i < 5; i++) burst(-theta + (i - 2) * 0.004, player.r, ['#ffd23f', '#52e07a', '#e0433b', '#3f6fd8', '#ffffff'][i], 14, 300);
    sfx.win();
    const timeBonus = Math.max(0, Math.round(([0, 180, 240, 300][level] - playTime) * 100));
    const bonus = [0, 10000, 15000, 20000][level] + timeBonus;
    addScore(bonus);
    const list = routeStars();
    const got = list.filter((s) => s.taken).length, total = list.length;
    const medals = level === 3 ? L3_TIME_MEDALS : level === 2 ? L2_TIME_MEDALS : TIME_MEDALS;
    const tMedal = (medals.find(([limit]) => playTime <= limit) || [0, 'none'])[1], sMedal = starMedal(got, total);
    const R = rec();
    let newTime, best;
    if (level === 3) {
      const L = R.l3 = R.l3 || { wins: 0, bestTime: null, worlds: {} };
      newTime = L.bestTime === null || playTime < L.bestTime;
      L.wins++;
      if (newTime) L.bestTime = playTime;
      L.worlds[dest.toLowerCase()] = true;
      best = L;
    } else if (level === 2) {
      R.l2 = R.l2 || {};
      const L = R.l2[route] = R.l2[route] || { wins: 0, bestTime: null };
      newTime = L.bestTime === null || playTime < L.bestTime;
      L.wins++;
      if (newTime) L.bestTime = playTime;
      best = L;
    } else {
      newTime = R.bestTime === null || playTime < R.bestTime;
      R.wins++;
      R.runs = Math.max(R.runs, R.wins);
      R.bestTier = TOP;
      if (newTime) R.bestTime = playTime;
      if (got > R.bestStars) R.bestStars = got;
      R.timeMedal = Math.max(R.timeMedal, MEDAL[tMedal]);
      R.starMedal = Math.max(R.starMedal, MEDAL[sMedal]);
      if (falls === 0) R.flawless = true;
      best = R;
    }
    const newScore = score > (R.bestScore || 0);
    if (newScore) R.bestScore = score;
    saveBests();
    const nextTime = medals.slice().reverse().find(([limit]) => playTime > limit);
    // Coming straight on from the level before, the whole trip goes on the
    // scoreboard as one run
    const c = carry || { time: 0, got: 0, total: 0, falls: 0 };
    const trail = [...(carry && carry.trail ? carry.trail : [START_BODY[level]]), dest];
    $('won-mode').textContent = MODES[mode].name + (carry ? ' · ' + trail.join(' to ') : '');
    lastRun = { mode, timeMs: (c.time + playTime) * 1000, stars: c.got + got, total: c.total + total, falls: c.falls + falls, score: Math.round(score) };
    lastWin = { time: c.time + playTime, got: c.got + got, total: c.total + total, falls: c.falls + falls, trail };
    offerPost();
    $('medals').innerHTML = [
      medalHtml(tMedal, 'Time', fmtTime(playTime), newTime, nextTime ? `${nextTime[1]} under ${fmtTime(nextTime[0])}` : 'top medal'),
      medalHtml(sMedal, 'Geoms', `${got} / ${total}`, level === 1 && got > 0 && got >= R.bestStars, sMedal === 'gold' ? 'every geom' : 'gold for every geom'),
      medalHtml(falls === 0 ? 'gold' : 'none', 'Falls', String(falls), false, falls === 0 ? 'flawless run' : 'gold for none'),
    ].join('');
    $('won-dest').textContent = dest;
    $('won-score').textContent = fmtScore(score);
    $('won-score-new').hidden = !newScore;
    const facts = {
      Mars: 'The real trip takes 6 to 9 months, and Earth and Mars only line up for it every 26 months.',
      Venus: 'Venus is the hottest planet: 465°C under clouds of sulfuric acid. Good thing you stopped in the clouds.',
    };
    const seen = level === 3 ? Object.keys(best.worlds).length : 0;
    $('won-stats').textContent = `Includes a ${level >= 2 ? dest : 'Moon'} bonus of ${fmtScore(bonus)} x${mult}. `
      + (level === 3 ? `${landedOn.note} You've landed on ${seen} of the 4 big belt worlds.`
        : level === 2 ? `${facts[dest]} For David Bowie, who looked up and made the rest of us look too.`
        : R.wins === 1 ? 'Your first trip to the Moon.' : newTime ? 'New best time!' : `Your best time is ${fmtTime(best.bestTime)}.`);
    $('to-l2').hidden = level !== 1;
    $('to-l3').hidden = !(level === 2 && route === 'mars');
    $('again').textContent = level === 3 ? 'Start on Mars again' : level === 2 ? 'Start at the Moon again' : 'Bounce again';
    renderBests();
    setTimeout(() => { $('won').hidden = false; }, 900);
  }

  // ---- Shared scoreboard (see scoreboard.js) ----------------------------------
  const board = window.SuperTrampBoard;
  const NAME_KEY = 'supertramp.name';
  let lastRun = null;
  let lastWin = null;
  let mustPost = false; // on the Moon screen, posting the score is the way on
  let boardMode = 'checkpoint';
  let boardBack = 'title';
  const setStatus = (text) => { const el = $('post-status'); el.textContent = text; el.hidden = !text; };
  function placeText(res, m) {
    if (res && res.worker) return `Posted as ${res.name}! It shows on the board in a minute or two.`;
    if (res && res.pending) return 'Finish on GitHub: tap Submit new issue. Your run shows on the board a minute or two later.';
    if (!res || !res.rank) return 'Posted.';
    const where = board.kind === 'artifact' ? "this page's" : 'the';
    return `${res.kept ? 'Your earlier run is still your best: ' : ''}#${res.rank} of ${res.of} on ${where} ${MODES[m].short} board.`;
  }
  async function postRun(name) {
    if (!lastRun) return;
    const run = { ...lastRun, name };
    setStatus('Posting your score…');
    $('post-btn').disabled = true;
    try {
      const res = await board.submit(run);
      setStatus(placeText(res, run.mode));
      $('post').hidden = true;
      unlockActions();
    } catch (e) {
      const noName = e && e.message === 'name';
      setStatus(noName ? 'Type your name using letters or numbers (emoji and symbols are left out).'
        : e && e.userMessage ? e.userMessage
        : "Couldn't reach the scoreboard. Check your connection and try again.");
      $('post-btn').disabled = false;
      // Only a real failure (not a missing name) offers a way past
      if (!noName && mustPost) $('post-skip').hidden = false;
      if (noName) { try { $('post-name').focus(); } catch (err) { /* ignore */ } }
    }
  }
  function unlockActions() {
    mustPost = false;
    $('won-actions').hidden = false;
    $('post-skip').hidden = true;
  }
  function offerPost() {
    setStatus('');
    $('post').hidden = true;
    $('post-skip').hidden = true;
    $('won-actions').hidden = false;
    mustPost = false;
    if (!board || board.kind === 'none') return;
    if (board.needsName) {
      // The name box comes first; post your score, or skip it
      mustPost = true;
      $('won-actions').hidden = true;
      $('post-skip').hidden = false;
      setTimeout(() => { try { $('post-name').focus(); } catch (e) { /* ignore */ } }, 950);
    }
    if (board.viaGithub) {
      $('post-label').textContent = 'Post this run to the online scoreboard. It opens GitHub, where you tap Submit (free GitHub account needed).';
      $('post-name').hidden = true;
      $('post-btn').textContent = 'Post on GitHub';
      $('post-btn').disabled = false;
      $('post').hidden = false;
    } else if (board.needsName) {
      $('post-label').textContent = 'Your name on the scoreboard';
      $('post-name').hidden = false;
      $('post-btn').textContent = 'Post score';
      $('post-gh').hidden = !board.viaWorker;
      let saved = '';
      try { saved = localStorage.getItem(NAME_KEY) || ''; } catch (e) { /* no storage */ }
      $('post-name').value = saved;
      $('post-btn').disabled = false;
      $('post').hidden = false;
    } else {
      postRun(''); // claude.ai page: posted under your own profile name
    }
  }
  function renderBoardRows(rows, list = $('board-list')) {
    list.textContent = '';
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'note';
      li.textContent = 'No Moon landings yet. Be the first.';
      list.append(li);
      return;
    }
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      if (r.isMe) li.className = 'me';
      const cells = [['rank', `#${i + 1}`], ['who', r.name], ['stars-col', fmtScore(r.score || 0)], ['time', fmtTime(r.timeMs / 1000)]];
      for (const [cls, text] of cells) { const span = document.createElement('span'); span.className = cls; span.textContent = text; li.append(span); }
      list.append(li);
    });
  }
  // The top five, right on the title screen
  async function loadTitleBoard() {
    if (!board || board.kind === 'none') return;
    $('title-board').hidden = false;
    $('tb-mode').textContent = MODES[mode].short;
    const list = $('tb-list');
    list.innerHTML = '<li class="note">Loading…</li>';
    try { renderBoardRows(await board.top(mode, 5), list); } catch (e) { list.innerHTML = '<li class="note">Couldn\'t load the scoreboard.</li>'; }
  }

  async function loadBoard() {
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.board === boardMode)));
    const list = $('board-list');
    list.innerHTML = '<li class="note">Loading…</li>';
    try { renderBoardRows(await board.top(boardMode, 10)); } catch (e) { list.innerHTML = '<li class="note">Couldn\'t load the scoreboard. Check your connection.</li>'; }
  }
  function openBoard(from) {
    boardBack = from;
    boardMode = mode;
    $('board-where').textContent = `${board.where()}. Highest scores reaching the Moon; ties go to the faster run.`;
    $(from).hidden = true;
    $('board').hidden = false;
    loadBoard();
  }
  if (board) {
    board.ready.then((kind) => {
      if (kind === 'none') return;
      loadTitleBoard();
      $('open-board').hidden = false;
      $('won-board').hidden = false;
    });
    $('open-board').addEventListener('click', () => openBoard('title'));
    $('won-board').addEventListener('click', () => openBoard('won'));
    $('close-board').addEventListener('click', () => { $('board').hidden = true; $(boardBack).hidden = false; if (boardBack === 'title') loadTitleBoard(); });
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { boardMode = t.dataset.board; loadBoard(); }));
    $('post-btn').addEventListener('click', () => {
      if (board.viaGithub) { postRun(''); return; }
      const name = board.cleanName($('post-name').value);
      $('post-name').value = name;
      try { if (name) localStorage.setItem(NAME_KEY, name); } catch (e) { /* no storage */ }
      postRun(name);
    });
    $('post-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('post-btn').click(); });
    $('post-gh').addEventListener('click', () => {
      if (!lastRun) return;
      setStatus(placeText(board.postWithGithub(lastRun), lastRun.mode));
      $('post').hidden = true;
      unlockActions();
    });
    $('post-skip').addEventListener('click', () => { setStatus(''); $('post').hidden = true; unlockActions(); });
  }

  function medalHtml(medal, label, value, isNew, hint) {
    return `<div class="medal ${medal}"><span class="disc" aria-hidden="true"></span><span class="m-label">${label}</span><span class="m-value">${value}${isNew ? ' <b>NEW BEST</b>' : ''}</span><span class="m-hint">${medal === 'none' ? 'no medal · ' : ''}${hint}</span></div>`;
  }
  function renderBests() {
    for (const m of Object.keys(MODES)) {
      const R = bests[m], el = $(`bests-${m}`);
      if (!R.runs && !R.wins) { el.textContent = 'No runs yet.'; continue; }
      const parts = [];
      if (R.bestScore) parts.push(`best <b>${fmtScore(R.bestScore)}</b>`);
      if (R.bestTime !== null) parts.push(`fastest <b>${fmtTime(R.bestTime)}</b>`);
      if (R.bestTier >= 0 && R.bestTier < TOP) parts.push(`highest <b>${fmtKm(TIERS[R.bestTier].km)}</b>`);
      parts.push(`Moon ${R.wins}/${R.runs}`);
      if (R.l2) for (const [k, n] of [['mars', 'Mars'], ['venus', 'Venus']]) if (R.l2[k] && R.l2[k].wins) parts.push(`${n} ✓`);
      if (R.l3 && R.l3.wins) parts.push(`Belt ${Object.keys(R.l3.worlds).length}/4`);
      el.innerHTML = parts.join(' · ');
    }
    // Level 2 opens up once you've reached the Moon in either mode
    $('l2-start').hidden = !(bests.checkpoint.wins || bests.uber.wins);
    // ...and level 3 once you've reached Mars
    $('l3-start').hidden = !Object.keys(MODES).some((m) => bests[m].l2 && bests[m].l2.mars && bests[m].l2.mars.wins);
    document.querySelectorAll('.mode').forEach((btn) => btn.classList.toggle('last', btn.dataset.mode === mode));
  }
  renderBests();

  const jingle = () => { if (snd) { snd.init(); snd.sfx.jingle(mode); } };
  document.querySelectorAll('.mode').forEach((btn) => btn.addEventListener('click', () => { mode = btn.dataset.mode; jingle(); startGame(1); }));
  $('again').addEventListener('click', () => startGame(level));
  $('to-l2').addEventListener('click', () => { jingle(); startGame(2, { score, mult, ...(lastWin || { time: 0, got: 0, total: 0, falls: 0 }) }); });
  $('l2-start').addEventListener('click', () => { jingle(); startGame(2); });
  $('to-l3').addEventListener('click', () => { jingle(); startGame(3, { score, mult, ...(lastWin || { time: 0, got: 0, total: 0, falls: 0 }) }); });
  $('l3-start').addEventListener('click', () => { jingle(); startGame(3); });
  // Back to the title: the Earth turns behind it again
  function toTitle() {
    level = 1; route = null; flipK = 0; useTiers();
    reset(Math.floor(Math.random() * 1e9));
    state = 'title';
    setPadFlip(false);
    $('won').hidden = true;
    renderBests();
    loadTitleBoard();
    $('title').hidden = false;
  }
  $('change-mode').addEventListener('click', toTitle);
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
  // Turned sideways (level 3), up and down steer: up is what left was
  const FLIPMAP = { ArrowUp: 'left', KeyW: 'left', ArrowDown: 'right', KeyS: 'right' };
  // The touch arrows turn with the view
  function setPadFlip(on) {
    document.body.classList.toggle('flipped', on);
    for (const [key, a, b, la, lb] of [['left', '◀', '▲', 'Walk left', 'Steer up'], ['right', '▶', '▼', 'Walk right', 'Steer down']]) {
      const btn = document.querySelector(`.pad [data-key="${key}"]`);
      if (btn) { btn.textContent = on ? b : a; btn.setAttribute('aria-label', on ? lb : la); }
    }
  }
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!$('board').hidden) return;
    if (FLIPMAP[e.code] && state === 'play' && level === 3 && flipK > 0.5) { keys[FLIPMAP[e.code]] = true; e.preventDefault(); return; }
    if (KEYMAP[e.code] && state === 'title') {
      // On the title screen, left/right picks the mode that Space will start.
      mode = KEYMAP[e.code] === 'left' ? 'checkpoint' : 'uber';
      renderBests();
      loadTitleBoard();
      e.preventDefault();
    } else if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
    else if (JUMP.has(e.code)) {
      e.preventDefault();
      if (state === 'splash') { if (!e.repeat) beginDescend(); return; }
      if (state === 'descend') return;
      if (state === 'won' && mustPost) return; // post your score first
      if (state === 'title') { if (!e.repeat) { jingle(); startGame(1); } return; }
      if (state === 'won' && !$('won').hidden) { if (!e.repeat) { jingle(); startGame(level); } return; }
      if (!e.repeat) jumpBuffer = 0.15;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false;
    if (FLIPMAP[e.code]) keys[FLIPMAP[e.code]] = false;
  });
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
  let frameAvg = 1 / 60, lowQuality = false;
  function frame(t) {
    const dt = Math.min(1 / 30, (t - last) / 1000 || 0);
    // Watch frame times; slow phones get a lighter version of the heavy effects
    if (dt > 0) { frameAvg = frameAvg * 0.97 + dt * 0.03; if (!lowQuality && frameAvg > 1 / 40 && clock > 3) lowQuality = true; }
    last = t;
    checkSize();
    if (snd) snd.beat();
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // Hot reload support when hosted as an artifact; harmless elsewhere.
  function snapshot() {
    return { seed: world.seed, state, level, route, theta, lastTier, bestTier, playTime, checkpoint, falls, mode, score, mult, player: { ...player, lastPlat: null }, taken: world.stars.filter((s) => s.taken).map((s) => s.id) };
  }
  function start(data) {
    resize();
    if (data && data.level >= 2) { level = data.level; route = data.route || (level === 3 ? 'belt' : null); useTiers(); }
    reset(data && data.seed ? data.seed : 20260930);
    if (!data || !data.state) {
      state = 'splash';
      $('title').hidden = true;
      document.body.classList.add('intro');
    }
    if (data && data.state === 'play') {
      theta = data.theta; lastTier = data.lastTier; bestTier = data.bestTier; playTime = data.playTime;
      checkpoint = data.checkpoint || 0; falls = data.falls || 0; score = data.score || 0; mult = data.mult || 1; updateScoreHud(); mode = data.mode === 'uber' ? 'uber' : 'checkpoint';
      Object.assign(player, data.player);
      player.inside = false;
      cam.r = player.r;
      for (const id of data.taken || []) if (world.stars[id]) world.stars[id].taken = true;
      updateStarsHud();
      state = 'play';
      $('title').hidden = true;
      document.body.classList.add('playing');
    }
    window.claude?.hot?.snapshot?.(snapshot);
    // Read-only peek for automated tests (only where hot reload exists)
    if (window.claude?.hot) window.claude.hot.peek = () => ({ world, theta, route, level, TOP, state, score, mult, shield: player.shield, field: player.field, flipK, player });
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
