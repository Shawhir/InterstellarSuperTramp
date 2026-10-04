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
    // g: Earth's pull weakens the further out you go (it falls off with the
    // square of your distance from Earth's centre). Softened so it stays
    // playable: really it's down to about 6% by the GPS satellites.
    { km: 80, type: 'nlc', layer: 'Mesosphere', g: 0.98, note: 'Noctilucent clouds: the highest clouds on Earth, 80 km up.' },
    { km: 100, type: 'satellite', layer: 'Thermosphere', g: 0.97, note: 'The Kármán line, 100 km. You are officially in space.' },
    { km: 200, type: 'satellite', layer: 'Thermosphere', g: 0.94 },
    { km: 408, type: 'station', layer: 'Thermosphere', g: 0.88, note: "The International Space Station orbits at 408 km. Gravity there is still about 90% of what it is on the ground: astronauts float because they're falling round Earth." },
    { km: 2000, type: 'satellite', layer: 'Low Earth orbit', g: 0.62, note: "Low Earth orbit ends around 2,000 km. Earth's pull is weaker up here, a bit over half what it is on the ground, so you hang in the air longer." },
    { km: 20200, type: 'satellite', layer: 'Medium Earth orbit', g: 0.5, note: 'GPS satellites circle at 20,200 km.' },
    { km: 35786, type: 'satellite', layer: 'Geostationary orbit', g: 0.48, note: 'Geostationary orbit, 35,786 km. One lap per day.' },
    { km: 150000, type: 'asteroid', layer: 'Deep space', g: 0.45, note: "Deep space. Nearly there. Earth's pull is tiny out here, and soon the Moon's takes over." },
    { km: 384400, type: 'moon', layer: 'The Moon', g: 0.45 },
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
    // The way home: back across the gap to Earth, its pull getting stronger
    // all the way, through the radiation belts and down into the air
    earth: [
      ...MOON_TIERS,
      { km: 100000, type: 'rocket', layer: 'Free return', g: 0.5, note: 'Apollo 13, 1970: after an oxygen tank exploded, the crew swung round the Moon and let its gravity sling them home. All three made it back.' },
      { km: 150000, type: 'asteroid', layer: 'Earth–Moon space', g: 0.5, visitor: 'oumuamua' },
      { km: 200000, type: 'asteroid', layer: 'Earth–Moon space', g: 0.52, note: 'Halfway home. On average Earth and the Moon are about 384,000 km apart: all the other planets could just about fit in the gap.' },
      { km: 260000, type: 'rocket', layer: 'Earth–Moon space', g: 0.54, fact: { kind: 'earthrise', text: "Apollo 8, Christmas Eve 1968: the first people to see Earth rise over the Moon. Their photo, 'Earthrise', is one of the most famous ever taken." } },
      { km: 320000, type: 'asteroid', layer: 'Earth–Moon space', g: 0.56, dust: 1, note: 'Bits of comet dust out here. Hang about in a cloud and it sandblasts you.' },
      { km: 348600, type: 'satellite', layer: 'Geostationary orbit', g: 0.6, note: 'Back at geostationary orbit, 35,786 km up: weather satellites here watch the same half of Earth all day long.' },
      { km: 364200, type: 'satellite', layer: 'Van Allen belts', g: 0.64, rad: 1, note: "The Van Allen belts: charged particles trapped by Earth's magnetic field. Apollo crews crossed them quickly to keep their radiation dose low. Dodge the bursts!" },
      { km: 370000, type: 'satellite', layer: 'Van Allen belts', g: 0.68, rad: 1 },
      { km: 374000, type: 'satellite', layer: 'Medium Earth orbit', g: 0.72, note: 'GPS satellites, 20,200 km up: your phone listens to several of them at once to work out where you are.' },
      { km: 382000, type: 'station', layer: 'Low Earth orbit', g: 0.82, wind: 0.8, note: 'Low Earth orbit: home of the Space Station, thousands of satellites, and a lot of space junk zipping round. It pushes you about.' },
      { km: 384200, type: 'satellite', layer: 'Re-entry', g: 0.92, note: "Re-entry! Coming home from the Moon you hit the air at about 11 km/s. Apollo's heat shield had to take around 2,800°C." },
      { km: 384400, type: 'earth', layer: 'Earth' },
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
  // bouncer: you head right instead of up. The turn is a safe rock where a
  // being of light gives you a force field. Past it you bounce along a passage
  // walled with asteroids top and bottom, pinball style, dodging the odd rogue
  // asteroid tumbling across: the field soaks up a hit, without it you're
  // knocked back towards Mars. Gravity is weak in the belt, so it's floaty.
  // On Mars there's a trampoline for each of the four big worlds at the end;
  // the one you bounce from is your target, but you can land on any.
  const FLIP = 8; // the safe rock: the start of the asteroid belt
  const MAZE_STEP = 130; // between asteroids across a maze floor, px
  const SIDEWAYS = false; // the view used to turn sideways here; now you just keep climbing
  const L3_TIERS = [
    { km: 0, type: 'pad', layer: 'Jezero base', g: 0.5 },
    { km: 8, type: 'cloudm', layer: 'Martian sky', g: 0.5, note: "Mars has air, just thin: about 1% of Earth's, mostly carbon dioxide. Enough for wispy clouds of water ice." },
    { km: 40, type: 'cloudm', layer: 'Martian sky', g: 0.5, dust: 1, note: 'Dust storms on Mars can wrap the whole planet. One ended the Opportunity rover in 2018.' },
    { km: 6000, type: 'phobos', layer: 'Mars orbit', g: 0.5, note: 'Phobos ("fear"), 22 km across, races round Mars three times a day, so it rises in the west and sets in the east.' },
    { km: 14000, type: 'ufo', layer: 'Mars orbit', g: 0.5 },
    { km: 23460, type: 'deimos', layer: 'Mars orbit', g: 0.5, note: 'Deimos ("dread"), just 12 km across. Asaph Hall found both moons in 1877 and named them after the sons of Ares, god of war.' },
    { km: 2000000, type: 'asteroid', layer: 'Leaving Mars', g: 0.45, visitor: 'atlas3', note: "Mars trojans: a few asteroids share Mars's orbit, 60° ahead of it and behind. The biggest is called Eureka." },
    { km: 20000000, type: 'ufo', layer: 'Leaving Mars', g: 0.45, fact: { kind: 'probe', text: 'Dawn (2007 to 2018) was the first spacecraft to orbit two worlds past the Moon: Vesta, then Ceres. It still circles Ceres, switched off.' } },
    { km: 50000000, type: 'haven', layer: "Jupiter's pull", g: 0.4 },
    { km: 70000000, type: 'miner', layer: 'Inner belt', g: 0.35, note: 'In films, asteroid fields are packed. The real belt is mostly empty space, asteroids about a million km apart. This bit is the film version.' },
    { km: 78000000, type: 'asteroid', layer: 'Inner belt', g: 0.35, laser: 1 },
    { km: 86000000, type: 'asteroid', layer: 'Inner belt', g: 0.35 },
    { km: 94000000, type: 'hauler', layer: 'Inner belt', g: 0.35, ice: { title: 'ICE HAULER', fact: "Ice is the belt's real treasure: melt it to drink, split it into air to breathe and rocket fuel. Sci-fi belters haul it about in great blocks." } },
    { km: 104000000, type: 'asteroid', layer: 'Kirkwood gap', g: 0.33, note: "Kirkwood gaps: lanes in the belt that Jupiter's pull has swept almost empty. Almost.", fact: { kind: 'probe', text: 'NASA\'s Psyche probe, launched in 2023, reaches 16 Psyche in 2029: an asteroid that may be the bare metal core of a baby planet.' } },
    { km: 112000000, type: 'asteroid', layer: 'Kirkwood gap', g: 0.33 },
    { km: 122000000, type: 'miner', layer: 'Main belt', g: 0.3, laser: 1, note: 'Asteroid mining: one metal-rich asteroid could hold more iron and nickel than humans have ever dug up. Watch out for the mining lasers.' },
    { km: 132000000, type: 'asteroid', layer: 'Main belt', g: 0.3 },
    { km: 137000000, type: 'asteroid', layer: 'Main belt', g: 0.3 },
    { km: 142000000, type: 'outpost', layer: 'Main belt', g: 0.3, note: 'A belter outpost: spin the ring and you get a little gravity back. Science fiction loves building cities out here.' },
    { km: 152000000, type: 'asteroid', layer: 'Main belt', g: 0.3, laser: 1 },
    { km: 158000000, type: 'asteroid', layer: 'Main belt', g: 0.3 },
    { km: 164000000, type: 'miner', layer: 'Outer belt', g: 0.3, note: 'The outer belt: darker asteroids, rich in carbon, and some of them full of water ice.' },
    { km: 170000000, type: 'asteroid', layer: 'Outer belt', g: 0.3 },
    { km: 174000000, type: 'asteroid', layer: 'Outer belt', g: 0.3, laser: 1 },
    { km: 182000000, type: 'asteroid', layer: 'Outer belt', g: 0.3 },
    { km: 186000000, type: 'asteroid', layer: 'Outer belt', g: 0.3 },
    { km: 190000000, type: 'ceres', layer: 'Dwarf planets' },
  ];
  // Through the belt gravity fades layer by layer, so it gets floatier and
  // floatier all the way up to the worlds
  for (let k = FLIP; k < L3_TIERS.length; k++) L3_TIERS[k].g = k === FLIP ? 0.4 : 0.14 - 0.09 * ((k - FLIP - 1) / (L3_TIERS.length - 2 - FLIP));
  // The four biggest worlds in the belt. Only Ceres is officially a dwarf planet;
  // Hygiea may qualify, and Vesta and Pallas are giant asteroids.
  const BELT_WORLDS = {
    ceres: { name: 'Ceres', pad: '#ffd23f', kind: 'THE DWARF PLANET', padA: 0.55, half: 330, cols: 11, rogue: 0.6, gaps: 0.4, lasers: false, way: 'A wide, calm passage', r: 96, body: '#8d8a86', dark: '#6c6966', note: 'Ceres, 940 km across: the only dwarf planet in the belt. The bright spots in Occator crater are salt left by salty water seeping up from below.' },
    vesta: { name: 'Vesta', pad: '#ff8a3a', kind: 'THE BRIGHTEST ASTEROID', padA: 0.55 + Math.PI / 2, half: 250, cols: 8, rogue: 1, gaps: 0.6, lasers: true, way: 'A narrow passage full of mining lasers', r: 66, body: '#a39a8a', dark: '#7d7466', note: 'Vesta, 525 km across, the brightest asteroid. Its Rheasilvia crater has a central peak about twice as tall as Everest.' },
    pallas: { name: 'Pallas', pad: '#6dd3ff', kind: 'THE TILTED ONE', padA: 0.55 - Math.PI / 2, half: 290, cols: 10, rogue: 1, gaps: 0.6, lasers: false, tilt: 70, way: 'A passage that slants, like Pallas\'s tilted path', r: 64, body: '#7f8a94', dark: '#5f6971', note: 'Pallas, 512 km across, travels on a steeply tilted path, and its surface is pitted all over like a golf ball.' },
    hygiea: { name: 'Hygiea', pad: '#b58cff', kind: 'THE ROUNDEST', padA: 0.55 + Math.PI, half: 280, cols: 9, rogue: 1.6, gaps: 0.95, lasers: true, dark: true, way: 'A dark passage, full of gaps and rogue asteroids', r: 58, body: '#5d5a5e', dark: '#444146', note: 'Hygiea, about 430 km across, is almost perfectly round. If it gets the title, it will be the smallest dwarf planet.' },
  };
  // ---- Level 4: Venus to Mercury ------------------------------------------------
  // From the floating city in Venus's clouds, sunward to Mercury. The Sun grows
  // huge above you, and solar flares are the main danger: when one's coming,
  // every platform casts a shadow away from the Sun. Get in one, or get fried.
  // Now and then a coronal mass ejection: a far bigger blast.
  const L4_TIERS = [
    { km: 0, type: 'pad', layer: 'Cloud city', g: 0.8 },
    { km: 20, type: 'cloudv', layer: 'Venus clouds', g: 0.8, note: "Venus's clouds are droplets of sulfuric acid, wrapped so thickly round the planet that its surface is always hidden." },
    { km: 45, type: 'cloudv', layer: 'Venus clouds', g: 0.8, note: 'Venus spins so slowly that one day there, sunrise to sunrise, lasts 117 Earth days.' },
    { km: 1000, type: 'rocket', layer: 'Leaving Venus', g: 0.7, note: 'Venus has no moon at all. Neither does Mercury.' },
    { km: 2000000, type: 'shade', layer: 'Sunward', g: 0.6, note: 'Heading for the Sun. Out here solar flares are fierce: when one is coming, get in the shadow of something. Sunshades like this one are best.' },
    { km: 8000000, type: 'asteroid', layer: 'Sunward', g: 0.6, wind: 1.3, fact: { kind: 'probe', text: "NASA's Parker Solar Probe swings past Venus again and again to get closer to the Sun. In 2024 it flew 6.1 million km from the Sun's surface at about 690,000 km/h: the fastest thing humans have made." } },
    { km: 15000000, type: 'shade', layer: 'Solar storm', g: 0.55, rad: 1, note: 'A big solar flare can release as much energy as billions of nuclear bombs, in just a few minutes.' },
    { km: 22000000, type: 'asteroid', layer: 'Solar storm', g: 0.55, wind: 1.5 },
    { km: 29000000, type: 'rocket', layer: 'Solar storm', g: 0.55, rad: 1, note: 'A coronal mass ejection hurls billions of tonnes of the Sun\'s plasma out into space. When one is coming, take cover!' },
    { km: 35000000, type: 'shade', layer: 'Solar storm', g: 0.5, wind: 1.5 },
    { km: 41000000, type: 'asteroid', layer: 'Mercury approach', g: 0.45, fact: { kind: 'probe', text: 'BepiColombo, a European and Japanese mission, is due to go into orbit round Mercury in late 2026, after flying past Earth once, Venus twice and Mercury six times.' } },
    { km: 46000000, type: 'shade', layer: 'Mercury approach', g: 0.45, rad: 1, note: "NASA's MESSENGER orbited Mercury from 2011 to 2015 and found water ice hidden in craters at its poles, where sunlight never reaches." },
    { km: 49000000, type: 'asteroid', layer: 'Mercury approach', g: 0.4 },
    { km: 50000000, type: 'mercury', layer: 'Mercury' },
  ];
  // ---- Level 5: the outer belt, then flat out for Jupiter and Europa ----------
  // You set off from the belt world you reached, in the middle of the belt,
  // and bounce up through the outer belt to the miners' mass drivers. One
  // flings you on, faster and faster: steer round the asteroids for the rest
  // of the way, swing round behind Jupiter, and land on Europa.
  const L5_TIERS = [
    { km: 0, type: 'pad', layer: 'Belt base', g: 0.2 },
    { km: 3000000, type: 'asteroid', layer: 'Outer belt', g: 0.12, note: 'Ceres alone holds over a third of all the mass in the asteroid belt. Put every asteroid together and they still weigh far less than our Moon.' },
    { km: 9000000, type: 'asteroid', layer: 'Outer belt', g: 0.11 },
    { km: 16000000, type: 'miner', layer: 'Outer belt', g: 0.1, note: 'Out here most asteroids are dark, carbon-rich rock, some of them blacker than coal.' },
    { km: 24000000, type: 'asteroid', layer: 'Outer belt', g: 0.1, fact: { kind: 'probe', text: "NASA's Lucy, launched in 2021, is on its way to the Trojan asteroids that share Jupiter's orbit. Passing through the belt, it found that the little asteroid Dinkinesh has a moon of its own." } },
    { km: 32000000, type: 'asteroid', layer: 'Outer belt', g: 0.09 },
    { km: 40000000, type: 'asteroid', layer: 'Outer belt', g: 0.09 },
    { km: 48000000, type: 'asteroid', layer: 'Outer belt', g: 0.08 },
    { km: 55000000, type: 'driver', layer: 'Mass driver', g: 0.08 },
  ];
  // ---- Level 7: Europa to Saturn's rings --------------------------------------
  // Europa sits deep in Jupiter's gravity. Bounce up past its plumes and out of
  // its orbit to where a comet swings by: land on it and it carries you away
  // to Saturn. Miss it and Jupiter's pull drags you back down.
  const L7_TIERS = [
    { km: 0, type: 'pad', layer: 'Europa base', g: 0.3 },
    { km: 50, type: 'plume', layer: 'Europa plumes', g: 0.3, note: 'The Hubble Space Telescope may have spotted plumes of water vapour spraying up from Europa, maybe as high as 200 km. Bounce on them!' },
    { km: 120, type: 'plume', layer: 'Europa plumes', g: 0.3 },
    { km: 1500, type: 'iceberg', layer: 'Europa orbit', g: 0.3, note: "Europa goes round Jupiter every 3.5 days. Jupiter's pull squeezes and stretches it each time round, which warms its insides and keeps its ocean liquid." },
    { km: 20000, type: 'iceberg', layer: 'Radiation belts', g: 0.32, rad: 1, note: 'Europa sits inside Jupiter\'s fierce radiation belts: an unprotected person on its surface would get a deadly dose in about a day. Dodge the bursts!' },
    { km: 80000, type: 'rocket', layer: 'Radiation belts', g: 0.34, rad: 1, fact: { kind: 'probe', text: "NASA's Europa Clipper, launched in 2024, won't orbit Europa: it will swoop past about 49 times, ducking out of the radiation in between." } },
    { km: 250000, type: 'iceberg', layer: "Jupiter's pull", g: 0.38, note: "Jupiter's gravity is the strongest of any planet. To get away you need a lift from something already going fast." },
    { km: 500000, type: 'asteroid', layer: "Jupiter's pull", g: 0.4, note: "Here comes a spacecraft, on its way to a slingshot round Jupiter and on to Saturn, like Cassini in 2000. Land on it to hitch a ride. Miss it, and Jupiter pulls you back down." },
    { km: 700000, type: 'probe7', layer: 'Hitching a ride', g: 0.4 },
  ];
  const JUPITER_KM = 364000000; // from Ceres to Jupiter, when they line up
  const EUROPA_KM = 671000; // Europa's distance from Jupiter
  let l5Start = BELT_WORLDS.ceres; // level 5: the belt world you set off from

  let level = 1;      // 1: Earth to the Moon. 2: the Moon to Mars or Venus. 3: Mars to the belt. 4: Venus to Mercury. 5: the belt to Europa
  let route = null;   // the way you're going, picked by the launch pad you use: level 2 'mars' or 'venus', level 3 one of the belt worlds
  let landedOn = null; // level 3: the belt world you landed on
  let aimFor = null;   // level 3: the belt world picked by the trampoline you bounced from
  function useTiers() {
    TIERS = level === 7 ? L7_TIERS : level === 6 ? HOLLOW_TIERS : level === 5 ? L5_TIERS : level === 4 ? L4_TIERS : level === 3 ? L3_TIERS : level === 2 ? L2_ROUTES[route || 'mars'] : L1_TIERS;
    TOP = TIERS.length - 1;
    CHECKPOINTS = checkpointsFor(TIERS);
  }
  // How far the Moon's cratered ground sits above (+) or below (-) the base radius
  function surfAt(a) {
    const sf = world && world.surf;
    if (!sf) return 0;
    const n = sf.length, f = ((((a / TAU) * n) % n) + n) % n, i = Math.floor(f), k = f - i;
    return sf[i] * (1 - k) + sf[(i + 1) % n] * k;
  }
  const gravAt = (k) => TIERS[Math.max(0, Math.min(TOP, k))].g || (level >= 2 ? 0.6 : 1);
  const WIDTH = { earth: 220, trampoline: 70, cloud: 130, balloon: 80, nlc: 120, satellite: 96, station: 150, asteroid: 84, moon: 220,
    pad: 80, haven: 180, shade: 150, mercury: 220, driver: 150, mush: 90, fern: 120, raft: 130, gold: 120, crystal: 110, sway: 120, girder: 130, neon: 120, ledge: 110, hole: 160, rubble: 104, ufo: 112, refinery: 230, rocket: 116, kamo: 84, car: 150, comet: 140, phobos: 110, deimos: 80, cloudv: 140, mars: 220, venus: 220,
    cloudm: 140, plume: 130, iceberg: 110, probe7: 200, miner: 120, hauler: 160, outpost: 150, ceres: 160, vesta: 110, pallas: 106, hygiea: 96 };
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
    const [a, b] = level === 7 ? [1.15, 1.85] : level === 6 ? [1.1, 1.85] : level === 5 ? [1.15, 1.8] : level === 4 ? [1.15, 2.2] : level === 3 ? [1.15, 2.25] : level === 2 ? [1.12, 2.1] : [HARD_START, HARD_END];
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
  // rot: a tumble about the middle of the body (in space), in radians
  function drawSprite(frame, x, y, flip, sy, sx = 1, alpha = 1, pal = PAL, rot = 0) {
    const rows = FRAMES[frame];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (rot) { ctx.translate(0, -24); ctx.rotate(rot); ctx.translate(0, 24); }
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
    if (level === 6) return buildWorld6(seed);
    if (level === 7) return buildWorld7(seed);
    if (level === 5) return buildWorld5(seed);
    if (level === 4) return buildWorld4(seed);
    if (level === 3) return buildWorld3(seed);
    if (level === 2) return buildWorld2(seed);
    const rnd = mulberry32(seed);
    const plats = [];
    const stars = [];
    const mk = (tier, a) => {
      const type = TIERS[tier].type;
      const p = { tier, a, a0: a, type, g: gravAt(tier), R: tierR(tier), w: WIDTH[type], bounce: bounceFor(tier), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU };
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
    const life = buildEarthLife(rnd, decor);
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
    return { seed, plats, stars, decor, crust, swirls, sky, ranges, issPlat, life };
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
    // The way home to Earth starts from the pad right by the base, and heads
    // straight up between them.
    for (const [rt, s, a0, bias] of [['mars', 1, 0.62, 0.8], ['venus', -1, -0.62, 0.8], ['earth', 1, 0.2, 0.5]]) {
      const T = L2_ROUTES[rt], top = T.length - 1;
      mk(rt, 0, a0).main = true;
      if (rt !== 'earth') mk(rt, 0, s * 1.7);
      let prevA = a0;
      for (let k = 1; k <= top; k++) {
        const R = tierR(k), t = T[k];
        if (k === top) { mk(rt, k, prevA + (s * 170) / R).dest = true; break; }
        const off = (110 + (rnd() * 200) / Math.sqrt(speedFor(k - 1))) * (rnd() < bias ? s : -s);
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
      { a: 0.06, kind: 'sign', text: 'HOME ^', col: '#8fd0ff' },
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
      { f: 0.16, sink: 0.5, top: 84, col: '#8d8b97', rx: [7, 10], craters: 2, peaks: true },
      { f: 0.3, sink: 0.6, top: 62, col: '#9a98a4', rx: [9, 14], craters: 5 },
      { f: 0.5, sink: 0.74, top: 40, col: '#a7a5b1', rx: [13, 20], craters: 4 },
      { f: 0.72, sink: 0.87, top: 20, col: '#b3b1bd', rx: [17, 24], craters: 4 },
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
    const plats = [], stars = [], beams = [], dust = [], rocks = [], back = [], gaps = [], pops = [], lanes = {}, maze = {};
    const T = L3_TIERS;
    const SWAY = new Set(['rocket', 'ufo', 'asteroid', 'phobos', 'deimos', 'cloudm', 'miner']);
    const mk = (rt, tier, a, type = T[tier].type) => {
      const g = T[tier].g || 0.6;
      const p = { tier, a, a0: a, type, route: rt, g, R: tierR(tier), w: WIDTH[type], bounce: speedFor(tier) * Math.sqrt(2 * G * g * (TIER_GAP + OVERSHOOT)), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU, dir: rnd() < 0.5 ? -1 : 1 };
      if (SWAY.has(type) && tier > 0 && tier < FLIP) { p.sway = (25 + rnd() * 35) / p.R; p.freq = 0.3 + rnd() * 0.3; p.phase = rnd() * TAU; }
      plats.push(p);
      return p;
    };
    // Four routes, one per world, starting from trampolines a quarter of the
    // way round Mars from each other. Each has its own climb to a safe rock
    // (where the being waits), then its own maze up through the belt to its
    // world, which sits at the top in the middle.
    for (const [rt, W] of Object.entries(BELT_WORLDS)) {
      const pad = mk(rt, 0, W.padA);
      pad.aim = rt; pad.world = W; pad.main = true;
      let prevA = W.padA, beltA = 0;
      // The middle of this route's maze at layer k (Pallas's leans over)
      const centre = (k) => beltA + ((W.tilt || 0) * (k - FLIP)) / tierR(k);
      lanes[rt] = [];
      const holes = {};
      maze[rt] = { half: ((W.cols - 1) / 2) * MAZE_STEP, centre };
      for (let k = 1; k <= TOP; k++) {
        const R = tierR(k), t = T[k];
        if (k === TOP) {
          // Its world sits inside the asteroid ring, a little way round from
          // the top of this route's climb
          const d = mk(rt, k, beltA + (W.tilt ? -0.75 : 0.75), rt);
          d.R = tierR(TOP - 4); d.main = true; d.dest = true; d.world = W;
          break;
        }
        if (k > FLIP) continue; // the belt itself is the ring, built below
        const a = prevA + ((110 + (rnd() * 200) / Math.sqrt(speedFor(k - 1))) * (rnd() < 0.8 ? 1 : -1)) / R;
        if (k === FLIP) beltA = a;
        const mp = mk(rt, k, a);
        mp.main = true;
        stars.push({ a: prevA + (a - prevA) * 0.62, R: R + 50, taken: false, route: rt });
        if (t.type === 'ufo') for (let i = 0; i < 3; i++) stars.push({ a: a + 24 / R, R: R + 80 + i * 36, taken: false, ring: true, route: rt });
        if (t.fact) stars.push({ a: a - 110 / R, R: R + 150, taken: false, big: true, fact: t.fact, route: rt });
        if (t.laser && W.lasers) for (const side of [-1, 1]) beams.push({ a: a + (side * (120 + rnd() * 70)) / R, tier: k, period: 3 + rnd() * 1.2, phase: rnd() * 4, route: rt, kind: 'laser' });
        if (t.dust) dust.push({ a: a + (150 + rnd() * 80) / R, R: R + 125, phase: rnd() * TAU, route: rt }, { a: a - (210 + rnd() * 90) / R, R: R + 140, phase: rnd() * TAU, route: rt });
        const spare = t.type === 'cloudm' ? 'cloudm' : t.type === 'phobos' || t.type === 'deimos' || t.type === 'ufo' ? 'ufo' : 'asteroid';
        for (let i = 0; i < (k === FLIP ? 0 : k < 5 ? 2 : 1); i++) {
          const ea = a + ((340 + rnd() * 380) * (i % 2 ? -1 : 1)) / R;
          mk(rt, k, ea, spare);
          if (rnd() < 0.5) stars.push({ a: ea, R: R + 150, taken: false, route: rt });
        }
        prevA = a;
      }
    }
    // The asteroid belt: a ring right round Mars. Asteroids of all sizes,
    // spinning, scattered at random through its whole depth (no walls, no
    // rows: find your own way up), with the four worlds sitting among them.
    // Some asteroids are neon pinball bumpers that fling you off, and here and
    // there are pop bumpers, mining rigs, ice haulers and outposts.
    const worlds = plats.filter((q) => q.dest);
    // On each route, partway up: a huge asteroid with a cave in it. Something
    // lives in that cave. (Scenery: it's behind everything.)
    const caves = [];
    for (const W of Object.values(BELT_WORLDS)) {
      const rock = plats.find((q) => q.tier === FLIP && q.route === Object.keys(BELT_WORLDS).find((k) => BELT_WORLDS[k] === W));
      if (rock) caves.push({ a: rock.a + (rnd() < 0.5 ? -1 : 1) * 0.12, R: tierR(FLIP + 4) + 60, ph: rnd() * 9, seen: false });
    }
    // Each route passes a mining refinery low in the belt
    const keep = [];
    for (const rt of Object.keys(BELT_WORLDS)) {
      const rock = plats.find((q) => q.tier === FLIP && q.route === rt);
      if (!rock) continue;
      const f = mk(null, FLIP + 2, rock.a + 0.12, 'refinery');
      f.main = true; f.turn = 0;
      keep.push({ a: f.a, R: f.R - 20, r: 170 });
    }
    const clear = (a, R, pad) => worlds.every((w) => Math.hypot(wrap(a - w.a) * R, R - (w.R - w.world.r)) > w.world.r + pad)
      && caves.every((c) => Math.hypot(wrap(a - c.a) * R, R - c.R) > 130 + pad)
      && keep.every((c) => Math.hypot(wrap(a - c.a) * R, R - c.R) > c.r + pad);
    const drones = [];
    let lastRock = null;
    for (let k = FLIP + 1; k < TOP; k++) {
      const R0k = tierR(k), t = T[k], u = (k - FLIP) / (TOP - FLIP); // 0 low in the belt, 1 at the top
      // The journey through the belt: each region has its own look. The inner
      // belt is pale stony rock and the mining zone; the Kirkwood gap is
      // sparse; the main belt is a mix with shiny metal asteroids; the outer
      // belt is dark carbon-rich rock and ice. Higher up, more drift and crumble.
      const region = t.layer, gap = region === 'Kirkwood gap';
      for (let a = rnd() * 0.1; a < TAU; a += ((125 + rnd() * 125) * (gap ? 2 : 1)) / R0k) {
        const R = R0k + (rnd() - 0.5) * 120;
        if (!clear(a, R, 60)) continue;
        const mining = region === 'Inner belt' || region === 'Main belt';
        const special = (t.type !== 'asteroid' && rnd() < 0.07) || (mining && rnd() < 0.06);
        const rubble = !special && rnd() < 0.012;
        const p = mk(null, k, a, special ? (t.type !== 'asteroid' ? t.type : 'miner') : rubble ? 'rubble' : 'asteroid');
        p.R = R; p.main = true;
        if (!special && !rubble) {
          const r3 = rnd();
          p.col = region === 'Outer belt' ? (r3 < 0.25 ? ['#cfe6f2', '#9fbccc', '#ffffff'] : ['#3e3a42', '#2a272e', '#5e5864'])
            : region === 'Main belt' && r3 < 0.2 ? ['#9aa3b5', '#6d7586', '#e6ecf5']
            : region === 'Inner belt' ? ['#9a8a78', '#77685a', '#c4b49e'] : null;
          if (p.col && p.col[0] === '#9aa3b5') p.metal = true;
          if (p.col && p.col[0] === '#cfe6f2') p.ice = true;
          // Mining: drones ferrying ore between asteroids, and drill drones
          if (mining && lastRock && Math.abs(wrap(lastRock.a - a)) * R < 400 && rnd() < 0.05) drones.push({ p1: lastRock, p2: p, ph: rnd() * TAU, speed: 0.25 + rnd() * 0.2 });
          else if (mining && rnd() < 0.035) drones.push({ drill: p, ph: rnd() * TAU });
          lastRock = p;
        }
        if (rubble) { p.turn = (rnd() < 0.5 ? -1 : 1) * (1.6 + rnd()); p.shedT = rnd() * 4; }
        else if (!special) {
          p.w = 55 + rnd() * 75; p.turn = (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 1.2);
          if (rnd() < 0.15 + u * 0.25) { p.sway = (40 + rnd() * 70) / R; p.freq = 0.35 + rnd() * 0.5; p.phase = rnd() * TAU; }
          if (rnd() < 0.08 + u * 0.14) p.crumble = true;
        }
        // Now and then an asteroid with a little moon going round it
        if (!special && !rubble && rnd() < 0.012) rocks.push({ route: null, moonOf: p, rad: 95, w: (rnd() < 0.5 ? -1 : 1) * (1.3 + rnd() * 0.6), ph: rnd() * TAU, a, R, r: 22, spin: rnd() * TAU, turn: 0.4, flash: 0, cool: 0, wall: true });
        const r2 = rnd();
        if (r2 < 0.2 + u * 0.15) {
          // A neon pinball bumper floating above
          const br = R + 110 + rnd() * 60, ba = a + ((rnd() - 0.5) * 160) / br;
          if (clear(ba, br, 50)) rocks.push({ route: null, a: ba, R: br, r: 22 + rnd() * 16, spin: rnd() * TAU, turn: (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd()), ph: rnd() * TAU, flash: 0, cool: 0, wall: true, pinball: true });
        } else if (r2 < 0.3 + u * 0.15) {
          const pr = R + 125 + rnd() * 40, pa = a + ((rnd() - 0.5) * 140) / pr;
          if (clear(pa, pr, 40)) pops.push({ route: null, a: pa, R: pr, r: 18, flash: 0, cool: 0, spin: rnd() * TAU });
        }
        if (rnd() < 0.025) stars.push({ a, R: R + 80 + rnd() * 60, taken: false });
        if (t.fact && !t.factPlaced && rnd() < 0.03) { t.factPlaced = seed; stars.push({ a, R: R + 150, taken: false, big: true, fact: t.fact }); }
      }
    }
    // Snakes and ladders: mining grabber robots up in the belt that drag you
    // back down to the refinery, and ore lifts lower down that carry you up
    const grabbers = [], lifts = [];
    const freeSpot = (k0, k1) => {
      for (let tries = 0; tries < 40; tries++) {
        const a = rnd() * TAU, R = tierR(k0 + Math.floor(rnd() * (k1 - k0))) + 120 + rnd() * 40;
        if (clear(a, R, 60)) return { a, R };
      }
      return null;
    };
    for (let i = 0; i < 18; i++) { const at0 = freeSpot(FLIP + 6, TOP - 1); if (at0) grabbers.push({ ...at0, a0: at0.a, ph: rnd() * TAU }); }
    for (let i = 0; i < 14; i++) { const at0 = freeSpot(FLIP + 2, TOP - 6); if (at0) lifts.push({ ...at0, ph: rnd() * TAU }); }
    stars.forEach((st, i) => { st.id = i; });
    // Asteroids far off in the background, in three layers of distance (just
    // scenery): the further, the smaller, dimmer and slower. Each has its own
    // lumpy outline, and now and then catches the Sun.
    const far = [];
    for (const [n, d0, d1, r0, r1] of [[30, 0.06, 0.16, 2, 6], [20, 0.2, 0.36, 5, 12], [10, 0.45, 0.7, 10, 22]]) {
      for (let i = 0; i < n; i++) far.push({ x: rnd(), y: rnd(), r: r0 + rnd() * (r1 - r0), depth: d0 + rnd() * (d1 - d0), spin: rnd() * TAU, turn: (rnd() - 0.5) * 0.5, shape: Array.from({ length: 9 }, () => 0.72 + rnd() * 0.28), glint: rnd() * 20 });
    }
    far.sort((p, q) => p.depth - q.depth);
    const motes = [];
    for (let i = 0; i < 40; i++) motes.push({ x: rnd(), y: rnd(), depth: 0.6 + rnd() * 0.6 });

    // Mars's surface: red boulders, then the rovers and landers that are really
    // there (squashed closer together). Walk past one to find out about it.
    const decor = [];
    for (let i = 0; i < 30; i++) {
      const a = rnd() * TAU - Math.PI;
      if (Math.abs(a) > 0.3) decor.push({ a, kind: 'boulder', size: 0.5 + rnd() * 0.8, hue: Math.floor(rnd() * 3) });
    }
    const drive = (a, span, w) => ({ a0: a, span, w, ph: rnd() * TAU });
    decor.push(
      { a: -0.26, kind: 'hab', note: 'A greenhouse full of potatoes. Somebody has been growing their own dinner. Hopefully they got home.' },
      { a: 0.98, kind: 'tracks' }, { a: 1.0, kind: 'perseverance', drive: drive(1.0, 0.07, 0.12), note: 'Perseverance, landed 2021 in Jezero crater, an old lake bed. It drills rock samples and seals them in tubes, ready for a trip to Earth one day.' },
      { a: 1.16, kind: 'ingenuity', drive: drive(1.16, 0.05, 0.35), note: "Ingenuity: the first aircraft to fly on another planet. Mars's air is so thin its blades spun at about 2,500 rpm to lift off. It flew 72 times." },
      { a: 1.62, kind: 'tracks' }, { a: 1.64, kind: 'curiosity', drive: drive(1.64, 0.06, 0.1), note: 'Curiosity, landed 2012, is still climbing Mount Sharp. It runs on nuclear power, and once hummed Happy Birthday to itself.' },
      { a: 2.8, kind: 'zhurong', note: "Zhurong (2021), China's first Mars rover, named after a god of fire. It went to sleep for the Martian winter in 2022 and hasn't woken up." },
      { a: 3.18, kind: 'face', note: "The 'Face on Mars': a hill in Cydonia that looked like a face in a 1976 Viking photo. Sharper pictures show it's just a hill. Probably." },
      { a: SAUCER_FIELD, kind: 'saucers' },
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
    return { seed, plats, stars, decor, crust, swirls, sky, ranges: [], scape, issPlat: null, beams, dust, rocks, back, far, motes, lanes, gaps, pops, maze, caves, drones, grabbers, lifts };
  }

  function buildWorld4(seed) {
    const rnd = mulberry32(seed);
    const plats = [], stars = [], beams = [], dust = [];
    const T = L4_TIERS;
    const SWAY = new Set(['rocket', 'asteroid', 'shade', 'cloudv']);
    const mk = (tier, a, type = T[tier].type) => {
      const g = T[tier].g || 0.6;
      const p = { tier, a, a0: a, type, g, R: tierR(tier), w: WIDTH[type], bounce: speedFor(tier) * Math.sqrt(2 * G * g * (TIER_GAP + OVERSHOOT)), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU, dir: rnd() < 0.5 ? -1 : 1 };
      if (SWAY.has(type) && tier > 0) { p.sway = (25 + rnd() * 35) / p.R; p.freq = 0.3 + rnd() * 0.3; p.phase = rnd() * TAU; }
      plats.push(p);
      return p;
    };
    mk(0, 0.55).main = true;
    mk(0, -0.7);
    let prevA = 0.55;
    for (let k = 1; k <= TOP; k++) {
      const R = tierR(k), t = T[k];
      if (k === TOP) { mk(k, prevA + (170 * (rnd() < 0.5 ? -1 : 1)) / R).dest = true; break; }
      const a = prevA + ((110 + (rnd() * 200) / Math.sqrt(speedFor(k - 1))) * (rnd() < 0.75 ? 1 : -1)) / R;
      const mp = mk(k, a);
      mp.main = true;
      stars.push({ a: prevA + (a - prevA) * 0.62, R: R + 50, taken: false });
      if (t.type === 'rocket') for (let i = 0; i < 3; i++) stars.push({ a: a + 24 / R, R: R + 80 + i * 36, taken: false, ring: true });
      if (t.fact) stars.push({ a: a - 110 / R, R: R + 150, taken: false, big: true, fact: t.fact });
      if (t.rad) for (const side of [-1, 1]) beams.push({ a: a + (side * (120 + rnd() * 70)) / R, tier: k, period: 3.4 + rnd() * 1.4, phase: rnd() * 4, route: null });
      // Spare platforms off to the side: often sunshades, for cover
      for (let i = 0; i < (k < 5 ? 2 : 3); i++) {
        const ea = a + ((260 + rnd() * 420) * (i % 2 ? -1 : 1)) / R;
        mk(k, ea, k <= 2 ? 'cloudv' : rnd() < 0.45 ? 'shade' : 'asteroid');
        if (rnd() < 0.5) stars.push({ a: ea, R: R + 150, taken: false });
      }
      prevA = a;
    }
    stars.forEach((st, i) => { st.id = i; });
    // On the cloud tops: the floating city, balloons, an airship, solar panels
    const decor = [];
    for (let i = 0; i < 26; i++) { const a = rnd() * TAU - Math.PI; if (Math.abs(a) > 0.3) decor.push({ a, kind: 'puff', size: 0.6 + rnd() * 0.9 }); }
    decor.push(
      { a: 0.3, kind: 'sign', text: 'MERCURY >', col: '#ffd23f' },
      { a: -0.2, kind: 'citydome', size: 1.2 }, { a: -0.42, kind: 'citydome', size: 0.8 }, { a: 1.1, kind: 'citydome', size: 1 },
      { a: 0.85, kind: 'balloon' }, { a: -1.1, kind: 'balloon' }, { a: 1.6, kind: 'airship' },
      { a: -1.5, kind: 'vpanels' }, { a: 2.2, kind: 'vpanels' }, { a: 2.7, kind: 'citydome', size: 1.1 },
    );
    const crust = [];
    for (let i = 0; i < 60; i++) crust.push({ a: rnd() * TAU, rf: 0.8 + rnd() * 0.06, kind: rnd() < 0.5 ? 'lava' : 'rock', hue: Math.floor(rnd() * 3) });
    const swirls = [];
    for (let i = 0; i < 22; i++) swirls.push({ a: rnd() * TAU, rf: 0.9 + rnd() * 0.08, len: 0.2 + rnd() * 0.4 });
    const sky = [];
    for (let i = 0; i < 240; i++) sky.push({ x: rnd(), y: rnd(), s: rnd() < 0.12 ? 2 : 1, tw: rnd() * TAU });
    return { seed, plats, stars, decor, crust, swirls, sky, ranges: [], issPlat: null, beams, dust };
  }

  // Level 5. Around the belt world you start on: the outer belt, a ring of
  // dark asteroids scattered through its whole depth, with pinball and pop
  // bumpers between, and the miners' mass drivers along the top.
  const RUN_LEN = 16000; // how far the run to Jupiter goes, px
  const DIVE_LEN = 11000; // then right through Jupiter, layer by layer
  const OCEAN_LEN = 4300; // and at the end, down through Europa's ice into its ocean
  // Under Europa's surface, layer by layer like the fall through the hollow
  // Earth (but not so deep): 'at' is how far down each starts, in px
  const EU_LAYERS = [
    { at: 0, name: 'SURFACE ICE', sub: 'ABOUT -160°C', c: ['#ece6dc', '#cfd6de'], fact: "Europa's surface: ice as hard as rock, at about -160°C. The reddish-brown streaks are probably salts that came up from the ocean below." },
    { at: 450, name: 'THE ICE SHELL', sub: 'PROBABLY 15 TO 25 KM THICK', c: ['#bcd6ea', '#86b0d4'], fact: "The ice shell, probably 15 to 25 km thick. It's cracked into ridges and plates, because Jupiter's pull squeezes and stretches Europa every orbit." },
    { at: 1400, name: 'WARM ICE', sub: 'SOFT, SLOWLY CHURNING', c: ['#6c9ccc', '#4676ac'], fact: 'Lower down the ice is warmer and softer, slowly churning like a lava lamp. There may even be lakes of water trapped inside it.' },
    { at: 2100, name: 'THE OCEAN', sub: 'SALTY, MAYBE 60 TO 150 KM DEEP', c: ['#1d4a7c', '#071830'], fact: "The ocean! Salty water, maybe 60 to 150 km deep: twice as much water as all of Earth's oceans put together." },
    { at: OCEAN_LEN, name: 'THE SEAFLOOR', sub: 'ROCK, AND MAYBE HOT VENTS', c: ['#2a2a32', '#16161c'], fact: "The seafloor: rock, and maybe hot vents like the ones deep-sea creatures live round on Earth. If there's life on Europa, it might be down here. NASA's Europa Clipper arrives in 2030 to find out more." },
  ];
  const euLayer = (od) => { let i = 0; while (i < EU_LAYERS.length - 1 && EU_LAYERS[i + 1].at <= od) i++; return i; };
  const euKm = (od) => (od < 2100 ? (od / 2100) * 20 : 20 + ((od - 2100) / (OCEAN_LEN - 2100)) * 100);
  function buildWorld5(seed) {
    const rnd = mulberry32(seed);
    const plats = [], stars = [], rocks = [], pops = [];
    const T = L5_TIERS;
    const mk = (tier, a, type = T[tier].type) => {
      const g = T[tier].g || 0.1;
      const p = { tier, a, a0: a, type, g, R: tierR(tier), w: WIDTH[type], bounce: speedFor(tier) * Math.sqrt(2 * G * g * (TIER_GAP + OVERSHOOT)), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU, dir: rnd() < 0.5 ? -1 : 1 };
      plats.push(p);
      return p;
    };
    for (const a of [0.55, 0.55 + 2.1, 0.55 - 2.1]) { const p = mk(0, a); p.main = true; p.world = l5Start; }
    const facts = new Set();
    for (let k = 1; k < TOP; k++) {
      const Rk = tierR(k), u = (k - 1) / Math.max(1, TOP - 2);
      for (let a = rnd() * 0.1; a < TAU - 0.03; a += (130 + rnd() * 130) / Rk) {
        const R = Rk + (rnd() - 0.5) * 110;
        const special = T[k].type === 'miner' && rnd() < 0.12;
        const p = mk(k, a, special ? 'miner' : 'asteroid');
        p.R = R; p.main = true;
        if (!special) {
          p.w = 55 + rnd() * 70; p.turn = (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 1.2);
          if (rnd() < 0.2) { p.col = ['#cfe6f2', '#9fbccc', '#ffffff']; p.ice = true; } else p.col = ['#3e3a42', '#2a272e', '#5e5864'];
          if (rnd() < 0.15 + u * 0.2) { p.sway = (40 + rnd() * 70) / R; p.freq = 0.35 + rnd() * 0.5; p.phase = rnd() * TAU; }
        }
        const r2 = rnd();
        if (r2 < 0.18 + u * 0.12) {
          const br = R + 110 + rnd() * 60;
          rocks.push({ route: null, a: a + ((rnd() - 0.5) * 160) / br, R: br, r: 22 + rnd() * 16, spin: rnd() * TAU, turn: (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd()), ph: rnd() * TAU, flash: 0, cool: 0, wall: true, pinball: true });
        } else if (r2 < 0.27 + u * 0.1) {
          const pr = R + 125 + rnd() * 40;
          pops.push({ route: null, a: a + ((rnd() - 0.5) * 140) / pr, R: pr, r: 18, flash: 0, cool: 0, spin: rnd() * TAU });
        }
        if (rnd() < 0.03) stars.push({ a, R: R + 80 + rnd() * 60, taken: false });
        if (T[k].fact && !facts.has(k) && rnd() < 0.04) { facts.add(k); stars.push({ a, R: R + 150, taken: false, big: true, fact: T[k].fact }); }
      }
    }
    // A trail of geoms up from each launch trampoline, to get you going
    for (const p of plats.filter((q) => q.tier === 0)) for (let i = 0; i < 3; i++) stars.push({ a: p.a + 0.03 * i, R: tierR(0) + 90 + i * 50, taken: false });
    // The mass drivers: long rails with magnet coils that fling ore (and you) out
    for (let i = 0; i < 6; i++) { const d = mk(TOP, 0.55 + (i * TAU) / 6 + (rnd() - 0.5) * 0.2, 'driver'); d.main = true; d.launch = true; }
    // The run: no walls, just loose asteroids (then comet pieces, radiation,
    // and storms inside Jupiter) scattered in your way. Skim close past one for
    // a close call and your multiplier goes up; hit one and it costs points.
    // And Jupiter's big moons, whose gravity drags you towards them.
    const run = [];
    let d = 900;
    while (d < RUN_LEN + DIVE_LEN - 300) {
      const f = d / RUN_LEN, dive = d >= RUN_LEN;
      const kind = dive ? 'storm' : f < 0.3 ? 'rock' : f < 0.45 ? 'open' : f < 0.6 ? 'hilda' : f < 0.75 ? 'frag' : 'spark';
      const n = dive ? 1 + (rnd() < 0.4 ? 1 : 0) : 1 + Math.floor(rnd() * (f < 0.25 ? 2 : 3)), rocks = [];
      for (let k = 0; k < n; k++) {
        const r = kind === 'spark' ? 11 : kind === 'frag' ? 10 + rnd() * 6 : 14 + rnd() * 14;
        let u = 0, tries = 0;
        do { u = rnd() * 2.1 - 1.05; } while (rocks.some((o) => Math.abs(o.u - u) < 0.4) && ++tries < 10);
        rocks.push({ u, r, spin: rnd() * TAU, turn: (rnd() - 0.5) * 3, ph: rnd() * TAU, shape: Array.from({ length: 9 }, () => 0.72 + rnd() * 0.28) });
      }
      run.push({ d, kind, rocks, gap: 0, vu: kind === 'frag' ? (rnd() < 0.5 ? -1 : 1) * (0.1 + rnd() * 0.08) : 0, off: 0 });
      if (run.length % 3 === 0) stars.push({ run: true, d: d + 170, u: rnd() * 1.6 - 0.8, taken: false });
      d += dive ? 480 + rnd() * 160 : lerp(300, 460, f) + rnd() * 140;
    }
    const moons = [['callisto', 0.33, -1, 130, 1], ['ganymede', 0.52, 1, 150, 1.3], ['europa', 0.7, -1, 105, 0.9], ['io', 0.86, 1, 112, 1]]
      .map(([name, f, side, r, pull]) => ({ name, d: f * RUN_LEN, side, r, pull }));
    // Europa's ocean: glowing geoms to grab on the way down
    for (let od = 500; od < OCEAN_LEN - 400; od += 380 + rnd() * 200) stars.push({ ocean: true, d: od, u: rnd() * 1.6 - 0.8, taken: false });
    stars.forEach((st, i) => { st.id = i; });
    // On the ground: craters, a miners' camp, a drill rig, a sign the way to go,
    // and each world's own landmarks
    const decor = [];
    for (let i = 0; i < 26; i++) { const a = rnd() * TAU - Math.PI; if (Math.abs(a) > 0.3) decor.push({ a, kind: 'crater5', size: 0.5 + rnd(), hue: Math.floor(rnd() * 3) }); }
    decor.push({ a: 0.3, kind: 'sign', text: 'JUPITER >', col: '#ffab3d' }, { a: -0.3, kind: 'camp' }, { a: 1.35, kind: 'camp' }, { a: -1.25, kind: 'drill' });
    if (l5Start === BELT_WORLDS.ceres) decor.push(
      { a: 0.9, kind: 'salt', note: "Occator crater's bright spots: salt, left behind when salty water from deep inside Ceres seeped up and boiled away into space." },
      { a: -0.75, kind: 'icemount', note: 'Ahuna Mons: a lonely mountain 4 km high, made by an ice volcano that oozed salty slush instead of lava.' },
      { a: 2.2, kind: 'dawn', note: 'Up above: Dawn. It ran out of fuel in 2018 and still circles Ceres, switched off.' });
    else if (l5Start === BELT_WORLDS.vesta) decor.push({ a: -0.75, kind: 'icemount', peak: true, note: "The peak in Vesta's giant Rheasilvia crater is about 22 km high: one of the tallest mountains in the Solar System." });
    const crust = [];
    for (let i = 0; i < 50; i++) crust.push({ a: rnd() * TAU, rf: 0.7 + rnd() * 0.25, kind: rnd() < 0.3 ? 'ice' : 'rock', hue: Math.floor(rnd() * 3) });
    const sky = [];
    for (let i = 0; i < 240; i++) sky.push({ x: rnd(), y: rnd(), s: rnd() < 0.12 ? 2 : 1, tw: rnd() * TAU });
    const far = [];
    for (const [n, d0, d1, r0, r1] of [[30, 0.06, 0.16, 2, 6], [20, 0.2, 0.36, 5, 12], [10, 0.45, 0.7, 10, 22]]) {
      for (let i = 0; i < n; i++) far.push({ x: rnd(), y: rnd(), r: r0 + rnd() * (r1 - r0), depth: d0 + rnd() * (d1 - d0), spin: rnd() * TAU, turn: (rnd() - 0.5) * 0.5, shape: Array.from({ length: 9 }, () => 0.72 + rnd() * 0.28) });
    }
    far.sort((p, q) => p.depth - q.depth);
    return { seed, plats, stars, decor, crust, swirls: [], sky, ranges: [], issPlat: null, beams: [], dust: [], rocks, pops, far, run, moons };
  }

  // Level 7. Round Europa, its plumes and orbit, out through Jupiter's
  // radiation to where a comet swings by; then the run to Saturn's rings.
  function buildWorld7(seed) {
    const rnd = mulberry32(seed);
    const plats = [], stars = [], beams = [];
    const T = L7_TIERS;
    const SWAY = new Set(['rocket', 'asteroid', 'iceberg', 'plume']);
    const mk = (tier, a, type = T[tier].type) => {
      const g = T[tier].g || 0.3;
      const p = { tier, a, a0: a, type, g, R: tierR(tier), w: WIDTH[type], bounce: speedFor(tier) * Math.sqrt(2 * G * g * (TIER_GAP + OVERSHOOT)), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU, dir: rnd() < 0.5 ? -1 : 1 };
      if (SWAY.has(type) && tier > 0) { p.sway = (20 + rnd() * 30) / p.R; p.freq = 0.3 + rnd() * 0.3; p.phase = rnd() * TAU; }
      plats.push(p);
      return p;
    };
    mk(0, 0.55).main = true;
    mk(0, -0.7);
    let prevA = 0.55;
    for (let k = 1; k <= TOP; k++) {
      const R = tierR(k), t = T[k];
      if (k === TOP) {
        // The spacecraft, sweeping back and forth across the sky above: time it
        const c = mk(k, prevA, 'probe7'); c.main = true; c.probe7 = true;
        c.sway = 380 / R; c.freq = 0.3; c.phase = rnd() * TAU;
        break;
      }
      const a = prevA + ((110 + (rnd() * 200) / Math.sqrt(speedFor(k - 1))) * (rnd() < 0.75 ? 1 : -1)) / R;
      const mp = mk(k, a);
      mp.main = true;
      stars.push({ a: prevA + (a - prevA) * 0.62, R: R + 50, taken: false });
      if (t.fact) stars.push({ a: a - 110 / R, R: R + 150, taken: false, big: true, fact: t.fact });
      if (t.rad) for (const side of [-1, 1]) beams.push({ a: a + (side * (120 + rnd() * 70)) / R, tier: k, period: 3.4 + rnd() * 1.4, phase: rnd() * 4, route: null });
      for (let i = 0; i < (k < 4 ? 2 : 1); i++) {
        const ea = a + ((280 + rnd() * 380) * (i % 2 ? -1 : 1)) / R;
        mk(k, ea, k <= 2 ? 'plume' : 'iceberg');
        if (rnd() < 0.5) stars.push({ a: ea, R: R + 150, taken: false });
      }
      prevA = a;
    }
    stars.forEach((st, i) => { st.id = i; });
    // On the ice: double ridges, chaos terrain, plumes, ice spikes, a lander
    const decor = [];
    for (let i = 0; i < 18; i++) { const a = rnd() * TAU - Math.PI; if (Math.abs(a) > 0.35) decor.push({ a, kind: rnd() < 0.5 ? 'chaos' : 'spikes', size: 0.6 + rnd() * 0.7 }); }
    decor.push(
      { a: 0.3, kind: 'sign', text: 'SATURN ^', col: '#f2d98a' },
      { a: -0.3, kind: 'plume', note: "A plume of water vapour, maybe from the ocean under the ice. If one really is there, a passing spacecraft could fly through it and taste the ocean without landing." },
      { a: 1.2, kind: 'plume' },
      { a: -1.3, kind: 'lander', note: "NASA has studied sending a lander to Europa to dig into the ice and look for signs of life. It hasn't been given the go-ahead yet." },
      { a: 2.1, kind: 'chaos', size: 1.6, note: 'Chaos terrain: blocks of ice that broke apart, drifted and froze again, maybe where warm water came close to the surface.' },
      { a: -2.3, kind: 'spikes', size: 1.4, note: 'Some scientists think Europa may be covered in fields of tall ice spikes, like the "penitentes" on high mountains on Earth. Nobody has seen them close up yet.' },
    );
    const crust = [];
    for (let i = 0; i < 70; i++) crust.push({ a: rnd() * TAU, rf: 0.8 + rnd() * 0.18, kind: rnd() < 0.55 ? 'ice' : 'bubble', hue: Math.floor(rnd() * 3) });
    const swirls = [];
    for (let i = 0; i < 20; i++) swirls.push({ a: rnd() * TAU, rf: 0.955 + rnd() * 0.03, len: 0.15 + rnd() * 0.35 });
    const sky = [];
    for (let i = 0; i < 240; i++) sky.push({ x: rnd(), y: rnd(), s: rnd() < 0.12 ? 2 : 1, tw: rnd() * TAU });
    return { seed, plats, stars, decor, crust, swirls, sky, ranges: [], issPlat: null, beams, dust: [] };
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
  let fx = { geoms: [], flames: [], craters: [], puffs: [], rings: [], pops: [], trail: [], trailT: 0, banner: null, flash: 0, streak: 0, whistled: false, shooting: [], shootT: 2, meteors: [], meteorT: 4, visitor: null, dedication: 0, crossers: [], crossT: 3 };
  const tilt = { on: false, axis: 0, zero: null, got: false, fb: 0, zeroFB: null };
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
    addBackTramp();
    Object.assign(player, { r: R0, vr: 0, vx: 0, onGround: true, facing: 1, walkT: 0, squash: 0, speed: 1, apexR: R0, lastPlat: null, lastH: 0, heat: 0, suit: level >= 2, field: 0, lost: false, adrift: 0, carried: false, spin: 0, inside: false, g: gravAt(0), shield: 0, hurt: 0, grit: 0 });
    theta = 0; lastTier = -1; bestTier = -1; playTime = 0; particles = [];
    fx = freshFx();
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
  const ghost = (q) => level >= 2 && route && q.route && q.route !== route && q.tier > 0;
  const routeStars = () => (level >= 4 ? world.stars : level >= 2 ? world.stars.filter((s) => s.route === (route || (level === 3 ? 'ceres' : 'mars')) || (level === 3 && !s.route)) : world.stars);
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
  const destName = () => (level === 7 ? 'Titan' : level === 6 ? 'the surface' : level === 5 ? 'Europa' : level === 4 ? 'Mercury' : level === 3 ? (landedOn ? landedOn.name : 'the asteroid belt') : level === 2 ? (route === 'venus' ? 'Venus' : route === 'earth' ? 'Earth' : 'Mars') : 'the Moon');
  function layerName() {
    if (fx.run) {
      const R = fx.run;
      if (R.phase !== 'run') return R.phase === 'exit' ? 'Past Jupiter' : R.phase === 'ocean' ? `Europa: ${EU_LAYERS[euLayer(R.od)].name.toLowerCase()}` : 'Europa';
      const f = runF(), k = diveK();
      const name = R.d >= RUN_LEN ? `Jupiter: ${JUP_LAYERS[jupLayer(R.d)].name.toLowerCase()}` : f < 0.26 ? 'Outer belt' : f < 0.44 ? 'Past the belt' : f < 0.6 ? 'Hilda asteroids' : f < 0.75 ? 'Comet pieces' : 'Radiation belts';
      return `${name} · ${Math.round(R.v * 0.03)} km/s`;
    }
    if (level === 6 && (player.onGround || tierFloat(player.r) < 1)) return player.onGround ? (player.r <= R0 + 1 ? 'In Pellucidar' : `On the floor: ${HOLLOW[hollowZone(tierFloat(player.r) + 0.5)].name}`) : 'Pellucidar';
    if (level === 5 && (player.onGround || tierFloat(player.r) < 1)) return player.onGround ? `On ${l5Start.name}` : `${l5Start.name} base`;
    if (player.onGround) return lastTier === TOP ? `On ${destName()}` : level === 7 ? 'On Europa' : level === 4 ? 'Above Venus' : level === 3 ? 'On Mars' : level === 2 ? 'On the Moon' : 'On the ground';
    const k = Math.floor(tierFloat(player.r));
    return k === 0 ? (level === 7 ? 'Europa base' : level === 4 ? 'Cloud city' : level === 3 ? 'Jezero base' : level === 2 ? 'Moon base' : 'Troposphere') : TIERS[k].layer;
  }

  // ---- Targeting: which bouncy thing should we aim for? ---------------------
  function findTarget() {
    if (level === 3 && player.lost === true) {
      const rock = safeRock(), d = rock ? wrap(rock.a + theta) * rock.R : 0;
      if (rock) return { p: rock, d, lined: Math.abs(d) <= BEAM_HALF };
    }
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
      if (p.broken) continue;
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
    if (level === 3) {
      aimFor = rt;
      const W = BELT_WORLDS[rt];
      banner(`TO ${W.name.toUpperCase()}`, W.kind);
      toast(`Heading for ${W.name}. ${W.way} awaits in the belt.`, 4);
    } else if (rt === 'earth') {
      banner('THE WAY HOME', 'BACK TO EARTH');
      toast("Heading home: 384,400 km back to Earth. Its pull gets stronger the closer you get, and you'll have to get through the radiation belts and the space junk first.", 6);
    } else banner(rt === 'mars' ? 'TO MARS' : 'TO VENUS', rt === 'mars' ? 'THE RED PLANET' : 'THE HOTTEST PLANET');
    sfx.tier();
  }
  function land(p) {
    player.hopLock = 0; // an auto-hop holds your steering until you land
    if (p === world.issPlat && !player.suit && p.ride.state === 'near') { dock(p); return; }
    if ((level === 2 || level === 3) && p.tier === 0 && !p.back && p.route !== route) chooseRoute(p.route);
    player.backTo = p.back ? p.back : 0; player.backR = p.R;
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
    player.lost = false; player.adrift = 0; fx.improbable = null;
    if (level === 6 && p.type === 'crystal' && !p.breakAt) p.breakAt = clock + 0.35;
    if (level === 6) {
      const col = ZONE_GLOW[hollowZone(p.tier)];
      burst(-theta, p.R, col, 10, 240); hollowStartle(p.R);
      if (TIERS[p.tier] && p.tier > bestTier && p.tier > 0 && TIERS[p.tier].layer !== TIERS[p.tier - 1].layer) {
        // A new cavern: fireworks in its colours
        for (let i = 0; i < 6; i++) { const da = ((Math.random() - 0.5) * 500) / p.R, dr = 80 + Math.random() * 260; burst(-theta + da, p.R + dr, i % 2 ? col : '#ffffff', 16, 260); ring(-theta + da, p.R + dr, col, 1 + Math.random()); }
        addShake(10); pop('NEW CAVERN!', col, player.r + 150);
      }
    }
    if (p.crumble && !p.breakAt) {
      p.breakAt = clock + 0.3;
      if (!fx.crumbleTold) { fx.crumbleTold = true; toast('Cracked asteroids are loose rubble: bounce off one and it falls apart behind you. No going back down that way!', 5); }
    }
    if (p.launch) { lastTier = TOP; bestTier = TOP; startLaunch(p); return; }
    if (p.probe7) { lastTier = TOP; bestTier = TOP; startSling(p); return; }
    if (p.dest) {
      player.vr = 0; player.onGround = true;
      reachDest(p);
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
    if (level === 3 && p.tier >= FLIP && SIDEWAYS) {
      // (sideways belt only) in zero gravity every platform is a speed booster
      player.vr = BELT_BOOST + 60 * (player.speed - 1);
      pop('BOOST!', '#6dd3ff', player.r + 90);
    }
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
      if (conspiracy && p.tier > 0 && !TIERS[p.tier].note && !TIERS[p.tier].fact && (fx.fileGap = (fx.fileGap || 0) + 1) % 2 === 1) nextFile();
      else if (TIERS[p.tier].note) toast(TIERS[p.tier].note);
      else if (p.tier === 0) toast(level === 7 ? "Boing! Europa's gravity is only about a seventh of Earth's. Up you go, past the plumes, to where the spacecraft swings by." : level === 6 ? 'Boing! Up you go, out of Pellucidar. Follow the arrow up through the caverns.' : level === 5 ? `Boing! ${l5Start.name}'s gravity is tiny: a few percent of Earth's. Up through the outer belt to the mass drivers!` : level === 4 ? 'Boing! Venus pulls almost as hard as Earth. Head up, sunward: watch for flare warnings and get in the shade.' : level === 3 ? "Boing! Mars's gravity is just over a third of Earth's. Follow the arrow up through the clouds." : level === 2 ? 'Boing! Low gravity: you float. Follow the arrow up to the rockets.' : 'Boing! Steer toward the arrow to reach the clouds.');
      if (TIERS[p.tier].visitor) fx.visitor = { kind: TIERS[p.tier].visitor, t: 0, told: false, dir: Math.random() < 0.5 ? -1 : 1 };
    }
    if (level === 3 && p.main && (p.tier === FLIP || p.type === 'outpost') && player.field < FIELD_MAX) meetBeing(p);
    if (level === 3 && p.type === 'hauler' && !p.used && TIERS[p.tier].ice) {
      p.used = true;
      player.shield = 14;
      pop('ICE SHIELD!', '#8fd0ff', player.r + 130);
      banner('ICE HAULER', 'SHIELD ON');
      toast(TIERS[p.tier].ice.fact, 6);
    }
    if (p.ride && (p.ride.state === 'near' || p.ride.state === 'loop')) startRide(p);
  }

  // A fireball hits the ground: boom, big shake, crater.
  function impact(h) {
    buzz([60, 40, 120]);
    const a = -theta, mars = level === 3, moon = level === 2, venus = level === 4;
    sfx.boom(h);
    addShake(14 + h * 16);
    fx.flash = 0.45 + h * 0.3;
    ring(a, R0, '#ffb23a', 2.2);
    ring(a, R0, '#ffffff', 1.4);
    burst(a, R0, moon ? '#b4b2be' : mars ? '#b4532f' : '#8a5a3b', 26, 320);
    burst(a, R0, moon ? '#8a8896' : mars ? '#7a2e1c' : '#5a3a28', 16, 420);
    burst(a, R0, '#ffb23a', 20, 260);
    burst(a, R0, '#fff3b0', 10, 200);
    for (let i = 0; i < 16; i++) fx.puffs.push({ a, R: R0 + 4, vt: (Math.random() - 0.5) * 320, vr: 40 + Math.random() * 160, r: 8 + Math.random() * 12, t: 0, life: 1 + Math.random() * 0.8, nlc: false, smoke: true });
    fx.craters.push({ a, t: 0, size: 0.8 + h * 0.6, mars, moon });
    pop('KABOOM!', '#ffb23a', R0 + 120);
    toast(venus ? "KABOOM, into the clouds of Venus! Down at the surface it's 465°C, so lucky you landed up here. Bounce back up!" : moon ? "KABOOM! (Game physics: the real Moon has no air to burn up in, so things just smash into it. That's why it's covered in craters.) Find a launch pad." : mars ? "Mars has just enough air to set you on fire, and not enough to slow you down. Your score's safe: bounce back up from the launch field!" : 'Crash landing! Find a trampoline to get back up.', mars || moon ? 5.5 : 3.2);
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
  const nearestOn = (tier) => {
    let best = null, bd = Infinity;
    for (const q of world.plats) {
      if (q.tier !== tier || (route && q.route && q.route !== route) || q.dest) continue;
      const d = Math.abs(wrap(q.a + theta));
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  };
  function rescue(p = level === 3 && checkpoint > FLIP ? nearestOn(checkpoint) : world.plats.find((q) => q.tier === checkpoint && q.main && (!route || !q.route || q.route === route)), msg) {
    if (!p) return;
    player.lost = false;
    player.heat = 0; fx.flames = [];
    player.g = p.g || 1;
    falls++;
    loseMult();
    theta = -p.a;
    player.r = p.R + 170; player.vr = -150; player.vx = 0;
    player.apexR = player.r; player.lastPlat = null; player.lastH = 0;
    player.speed = speedFor(Math.max(0, p.tier - 1));
    lastTier = p.tier - 1; fx.streak = 0; fx.whistled = false; fx.trail = [];
    cam.r = player.r - 260;
    fx.flash = 0.25;
    ring(-theta, player.r, '#52e07a', 1.2);
    sfx.tier();
    toast(msg || `Caught at the ${TIERS[checkpoint].layer} checkpoint.`, 2.5);
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
    } else if (r.kind === 'comet') {
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
  // How far into the belt you are: 0 before the safe rock, 1 once past it
  const beltK = () => (level === 3 ? clamp(tierFloat(player.r) - (FLIP - 0.5), 0, 1) : 0);
  // Where the passage through the belt runs at radius R: its middle and half-width
  function laneAt(R, rt = route) {
    const L = ((world.lanes || {})[rt] || []).find((q) => R >= q.R0 && R <= q.R1);
    if (!L) return null;
    const u = (R - L.R0) / (L.R1 - L.R0);
    return { a: lerp(L.a0, L.a1, u), half: BELT_WORLDS[rt].half };
  }
  // Level 3: slipping out of the passage through a gap. You fall back towards
  // Mars, but you can steer: back in through a gap, or into the being's
  // tractor beam at the safe rock, which catches you at the start of the belt.
  // Miss both and it's all the way back to Mars.
  const BEAM_HALF = 260;
  // Inside the passage, past the safe rock, the belt is zero gravity
  const BELT_CRUISE = 70, BELT_BOOST = 380;
  // (from the moment the view turns: you're in outer space now)
  const beltFlight = () => level === 3 && flipK > 0.5 && player.lost !== true && player.lost !== 'mars' && !player.onGround && player.r > tierR(FLIP) - TIER_GAP * 0.5;
  // In the belt there's next to no pull back towards the planet: on your way
  // down you soon slow to a gentle sink, unless something knocked you hard,
  // and nothing heats up into a fireball
  const BELT_SINK = 140;
  const inBelt = () => (level === 3 && player.r > tierR(FLIP) - 60) || (level === 5 && player.r > tierR(1) - 60);
  const safeRock = () => world.plats.find((q) => q.tier === FLIP && q.main && q.route === route);
  // Level 3's maze: take a wrong turn out past its sides and you float off
  // into space (nothing pulls you back to Mars up here), until a ship running
  // on an Infinite Improbability Drive pops up out of nowhere and drops you
  // back on the floor you left
  function mazeAt(R) {
    const M = world.maze && world.maze[route];
    if (!M) return null;
    const k = clamp(Math.floor(tierFloat(R)), FLIP + 1, TOP - 1);
    return { a: M.centre(k), half: M.half };
  }
  // Asteroids collide out here, if rarely: whole families of asteroids are the
  // broken pieces of old crashes. Now and then two converge near you (watch
  // for the warning), smash together, and the blast of debris shoves you the
  // other way.
  // Real dangers of the belt, kept rare:
  //  - asteroid moons: some asteroids have a little moon going round them
  //    (like Dimorphos round Didymos), solid, so time your way past
  //  - rubble piles: loose heaps of boulders, spinning fast, that throw off
  //    pebbles (NASA's OSIRIS-REx saw Bennu doing it)
  function updateBeltHazards(dt) {
    for (const p of world.plats) {
      if (!p.crumble || !p.breakAt) continue;
      if (!p.broken && clock > p.breakAt) {
        p.broken = true; p.backAt = clock + 8;
        burst(p.a, p.R + 10, '#8a8290', 16, 200); burst(p.a, p.R + 10, '#5d5563', 10, 140);
        for (let i = 0; i < 6; i++) fx.puffs.push({ a: p.a, R: p.R + 10, vt: (Math.random() - 0.5) * 160, vr: (Math.random() - 0.5) * 120, r: 5 + Math.random() * 6, t: 0, life: 0.8, dust: true });
        sfx.thud();
      } else if (p.broken && clock > p.backAt) { p.broken = false; p.breakAt = 0; }
    }
    const near = (a, R, d) => Math.abs(wrap(a + theta)) * player.r < d && Math.abs(R - player.r) < d;
    for (const q of world.rocks || []) {
      if (!q.moonOf) continue;
      const h = q.moonOf, ang = q.ph + clock * q.w;
      q.R = h.R - 18 + Math.sin(ang) * q.rad * 0.7;
      q.a = h.a + (Math.cos(ang) * q.rad) / h.R;
      if (!fx.moonTold && state === 'play' && near(q.a, q.R, 260)) { fx.moonTold = true; toast('This asteroid has a moon! Plenty do: in 2022 NASA\'s DART spacecraft crashed into Dimorphos, the little moon of asteroid Didymos, and changed its orbit.', 6); }
    }
    fx.pebbles = fx.pebbles || [];
    for (const p of world.plats) {
      if (p.type !== 'rubble' || !near(p.a, p.R, 700)) continue;
      p.shedT -= dt;
      if (p.shedT <= 0) {
        p.shedT = 3 + Math.random() * 3;
        for (let i = 0; i < 5; i++) { const ang = Math.random() * Math.PI, v = 140 + Math.random() * 120; fx.pebbles.push({ a: p.a, R: p.R + 10, va: (Math.cos(ang) * v) / p.R, vr: Math.sin(ang) * v, t: 0, hit: false }); }
        if (!fx.rubbleTold && near(p.a, p.R, 400)) { fx.rubbleTold = true; toast('A rubble pile: loose boulders held together by their own weak gravity. Spin one fast and it throws off pebbles, as NASA\'s OSIRIS-REx saw asteroid Bennu doing.', 6); }
      }
    }
    for (const q of fx.pebbles) {
      q.t += dt; q.a += q.va * dt; q.R += q.vr * dt;
      if (q.hit || player.onGround || state !== 'play') continue;
      const ph = q.a + theta, dx = q.R * Math.sin(ph), dy = q.R * Math.cos(ph) - (player.r + 24), d = Math.hypot(dx, dy) || 1;
      if (d < 22) {
        q.hit = true;
        if (player.field > 0) { player.field--; pop(`PING! FIELD ${player.field}`, '#ff6ad5', player.r + 100); }
        else { player.vx -= (dx / d) * 160; player.vr -= (dy / d) * 160; pop('PEBBLE!', '#ffab3d', player.r + 100); }
        sfx.step();
      }
    }
    fx.pebbles = fx.pebbles.filter((q) => q.t < 3 && !q.hit);
  }
  const FLARE_WARN = 4;
  // Solar flares, on the sunward route to Venus where they're fiercest (out
  // in the asteroid belt they're about seven times weaker than at Earth).
  // A warning and countdown, then the blast: be under something when it hits.
  // Is there something between you and the Sun (straight up, sunward)?
  const SHADE_LEN = 330;
  const sheltered = () => {
    const above = (a, R, half) => Math.abs(wrap(a + theta)) * R < half && R > player.r + 40 && R < player.r + SHADE_LEN;
    return player.onGround || world.plats.some((p) => !p.dest && !ghost(p) && above(p.a, p.R, p.w / 2 + 10)) || (world.rocks || []).some((q) => above(q.a, q.R, q.r + 10));
  };
  function updateFlare(dt) {
    fx.flareT = (fx.flareT ?? (level === 4 ? 6 : 12)) - dt;
    const venusRoute = level === 2 && route === 'venus' && lastTier >= 4;
    const sunward = level === 4 && lastTier >= 3; // level 4: the main obstacle
    if (!fx.flare && fx.flareT <= 0 && (venusRoute || sunward) && lastTier < TOP && state === 'play') {
      // On level 4 they come faster the closer you get to the Sun, and every
      // so often it's a coronal mass ejection: a far bigger blast
      const near = level === 4 ? clamp((lastTier - 3) / (TOP - 4), 0, 1) : 0;
      const cme = level === 4 && lastTier >= 6 && (fx.cmeCount = (fx.cmeCount || 0) + 1) % 4 === 0;
      fx.flareT = level === 4 ? lerp(13, 7, near) + Math.random() * 4 : 35 + Math.random() * 15;
      fx.flare = { t: 0, hit: false, cme, warn: cme ? 5 : FLARE_WARN };
      banner(cme ? 'CORONAL MASS EJECTION!' : 'SOLAR FLARE!', 'GET IN THE SHADE');
      if (cme) toast('A coronal mass ejection: a huge blast of the Sun\'s plasma. Get in the shade of something, fast!', 4.5);
      else if (!fx.flareTold) { fx.flareTold = true; toast('A solar flare is coming! There\'s no magnetic field out here to shield you. Everything casts a shadow away from the Sun: get in one before it hits.', 5); }
      sfx.tier();
    }
    const f = fx.flare;
    if (!f) return;
    f.t += dt;
    if (!f.hit && f.t >= f.warn) {
      f.hit = true;
      fx.flash = f.cme ? 0.95 : 0.7;
      if (f.cme) addShake(14);
      if (sheltered()) { pop('SHELTERED!', '#52e07a', player.r + 120); addScore(f.cme ? 2000 : 500); sfx.perfect(); }
      else if (player.shield > 0) { pop('SHIELDED!', '#8fd0ff', player.r + 120); sfx.perfect(); }
      else {
        pop(f.cme ? 'BLASTED!' : 'FRIED!', '#ff5a4a', player.r + 120); loseMult(); sfx.thud(); buzz([40, 30, 80]);
        // The blast pushes you away from the Sun: back down
        if (level === 4) { player.vr = Math.min(player.vr, f.cme ? -900 : -420); if (f.cme) player.heat = 0.7; }
      }
    }
    if (f.t > f.warn + 1.6) fx.flare = null;
  }
  function updateCrash(dt) {
    fx.crashT = (fx.crashT ?? 22) - dt;
    if (!fx.crash && fx.crashT <= 0 && beltK() > 0.9 && state === 'play' && !player.adrift) {
      fx.crashT = 30 + Math.random() * 15;
      const side = Math.random() < 0.5 ? -1 : 1, R = player.r + 60 + Math.random() * 160;
      fx.crash = { a: -theta + (side * (150 + Math.random() * 110)) / R, R, t: 0, hit: false, debris: [] };
    }
    const c = fx.crash;
    if (!c) return;
    c.t += dt;
    if (!c.hit && c.t >= 1.3) {
      c.hit = true;
      fx.flash = Math.max(fx.flash, 0.35); addShake(9); sfx.boom(0.5); buzz([30, 30, 60]);
      ring(c.a, c.R, '#ffd6a0', 2.4); ring(c.a, c.R, '#ffffff', 1.4);
      for (let i = 0; i < 26; i++) { const ang = Math.random() * TAU, v = 120 + Math.random() * 260; c.debris.push({ a: c.a, R: c.R, va: (Math.cos(ang) * v) / c.R, vr: Math.sin(ang) * v, r: 3 + Math.random() * 7, spin: Math.random() * TAU }); }
      // The shockwave: the closer you are, the harder it shoves you away
      const ph = c.a + theta, bodyR = player.r + 24;
      const dx = c.R * Math.sin(ph), dy = c.R * Math.cos(ph) - bodyR, d = Math.hypot(dx, dy) || 1;
      if (d < 360) {
        const push = 520 * (1 - d / 360) + 140;
        player.vx -= (dx / d) * push; player.vr -= (dy / d) * push;
        pop('DEBRIS!', '#ffab3d', player.r + 120);
        if (!fx.crashTold) { fx.crashTold = true; toast('Asteroids collide out here, now and then: whole families of asteroids are the broken bits of old crashes. Mind the debris!', 5.5); }
      }
    }
    for (const q of c.debris) { q.a += q.va * dt; q.R += q.vr * dt; q.spin += dt * 3; }
    if (c.t > 4.5) fx.crash = null;
  }
  function updateAdrift(dt) {
    if (level !== 3 || player.onGround || player.carried || state !== 'play') return;
    if (player.adrift) {
      player.adrift += dt;
      // Drift back in before the ship arrives and you're fine
      if (!fx.improbable && player.r < tierR(TOP) + 150) {
        player.adrift = 0; pop('BACK IN!', '#52e07a', player.r + 120); return;
      }
      // Floating free: no pull either way, just a slow drift outwards
      player.vr *= 1 - dt * 0.8;
      if (player.adrift > 2.6 && !fx.improbable) {
        fx.improbable = { t: 0, side: Math.sign(player.vx) || 1 };
        sfx.whoosh();
      }
      if (fx.improbable && fx.improbable.t > 1.1) {
        // The improbable rescue. In Checkpoint mode it drops you back on the
        // floor you left; in Uber Tramp, all the way back on Mars (never game
        // over: your score's safe)
        fx.improbable = null; player.adrift = 0;
        fx.flash = 0.6;
        if (mode === 'uber') {
          const pad = world.plats.find((q) => q.tier === 0 && q.route === route);
          falls++; loseMult();
          theta = pad ? -pad.a + 120 / R0 : theta;
          Object.assign(player, { r: R0, vr: 0, vx: 0, onGround: true, heat: 0, lastPlat: null, lastH: 0, spin: 0 });
          route = null; aimFor = null; lastTier = -1; updateStarsHud();
          cam.r = R0 + 200;
          toast('A passing ship on an Infinite Improbability Drive scooped you up… and, improbably, dropped you back on Mars. Don\'t panic: your score\'s safe.', 5.5);
        } else {
          const floor = nearestOn(clamp(player.adriftTier, FLIP + 1, TOP - 1));
          rescue(floor, 'Picked up by a passing ship on an Infinite Improbability Drive. Don\'t panic, and always know where your towel is.');
        }
        for (let i = 0; i < 18; i++) fx.puffs.push({ a: -theta, R: player.r + 20, vt: (Math.random() - 0.5) * 300, vr: (Math.random() - 0.3) * 260, r: 6 + Math.random() * 8, t: 0, life: 0.9, nlc: true });
        pop('IMPROBABLE!', '#ffffff', player.r + 150);
      }
      return;
    }
    if (lastTier > FLIP && player.r > tierR(TOP) + 220) {
      player.adrift = 0.001; player.adriftTier = Math.floor(tierFloat(player.r));
      pop('ADRIFT IN SPACE!', '#ff5a4a', player.r + 140);
      toast('Too far! You\'ve floated out past the asteroid belt into empty space…', 3);
      loseMult(); sfx.fall();
    }
  }
  function updateLost() {
    if (player.onGround || state !== 'play' || flipK < 0.5) return;
    const L = player.r > tierR(FLIP) + 90 ? laneAt(player.r) : null;
    if (L) {
      const off = Math.abs(wrap(-theta - L.a)) * player.r;
      if (!player.lost && off > L.half + 25) {
        player.lost = true;
        pop('LOST IN SPACE!', '#ff5a4a', player.r + 140);
        toast('You slipped out through a gap! Steer back in, or for the green beam at the safe rock to get back to the start of the belt. Miss it and it\'s back to Mars.', 6);
        loseMult(); sfx.fall(); fx.whistled = true;
      } else if (player.lost === true && off < L.half - 10) {
        player.lost = false;
        pop('BACK IN!', '#52e07a', player.r + 120);
        sfx.perfect();
      }
    }
    // Falling past the safe rock: in the beam, or not?
    const rock = safeRock();
    if (player.lost === true && rock && player.vr < 0 && player.r < rock.R + 40) {
      if (Math.abs(wrap(rock.a + theta)) * rock.R < BEAM_HALF) {
        for (let i = 0; i < 10; i++) fx.puffs.push({ a: -theta, R: player.r + 20, vt: (Math.random() - 0.5) * 220, vr: 40 + Math.random() * 120, r: 5 + Math.random() * 7, t: 0, life: 0.7, nlc: true });
        rescue(rock, 'Caught by the tractor beam! Back to the start of the belt.');
        sfx.hum();
      } else {
        player.lost = 'mars';
        toast("Missed the beam… back down to Mars. Not game over: your score's safe, bounce back up!", 4);
      }
    }
  }
  // Level 3: the passage walls. Like the sides of a pinball table, they
  // always bounce you back into the way through.
  // A neon pinball asteroid: like a pinball bumper, it flings you off
  // faster than you came in
  function bumpPinball(q, nx, ny, overlap) {
    q.cool = 0.2; q.flash = 1;
    player.r -= ny * overlap;
    theta += (nx * overlap) / player.r;
    let vx = player.vx, vr = player.vr;
    const into = vx * nx + vr * ny;
    if (into > 0) { vx -= 2 * into * nx; vr -= 2 * into * ny; }
    const sp = Math.hypot(vx, vr) || 1, out = clamp(sp * 1.2, 480, 950);
    // Mostly the way you'd bounce, partly straight away from its middle
    player.vx = (vx / sp) * out * 0.6 - nx * out * 0.4; player.vr = (vr / sp) * out * 0.6 - ny * out * 0.4;
    addScore(150, -theta, player.r + 40);
    pop('BUMPER!', '#6dd3ff', player.r + 100);
    sfx.boing(TOP, 2.6); sfx.star(mult);
    ring(q.a, q.R, '#6dd3ff', q.r / 22);
    burst(-theta, player.r + 24, '#ff6ad5', 10, 260);
    addShake(4); buzz(16);
  }
  function bumpWall(q, nx, ny, overlap) {
    if (q.pinball) { bumpPinball(q, nx, ny, overlap); return; }
    q.cool = 0.25; q.flash = 1;
    player.r -= ny * overlap;
    theta += (nx * overlap) / player.r;
    let vx = player.vx, vr = player.vr;
    const into = vx * nx + vr * ny;
    if (into > 0) { vx -= 2 * into * nx; vr -= 2 * into * ny; }
    const away = -(vx * nx + vr * ny), min = 120;
    if (away < min) { vx -= nx * (min - away); vr -= ny * (min - away); }
    // Like a pinball: you come off at the speed you hit, and never slower
    // than a good lively bounce
    const sp = Math.hypot(vx, vr), want = Math.max(sp, BOUNCE_MIN);
    player.vx = (vx / sp) * want; player.vr = (vr / sp) * want;
    addScore(10);
    sfx.boing(TOP, 1.8);
    burst(-theta, player.r + 24, '#ff6ad5', 6, 160);
    addShake(2);
  }
  // A pop bumper: kicks you straight off, faster than you came in
  const BOUNCE_MIN = 380;
  function bumpPop(q, nx, ny, overlap) {
    q.cool = 0.2; q.flash = 1;
    player.r -= ny * overlap;
    theta += (nx * overlap) / player.r;
    const out = clamp(Math.hypot(player.vx, player.vr) * 1.25, 560, 1000);
    player.vx = -nx * out; player.vr = -ny * out;
    addScore(250, -theta, player.r + 40);
    pop('POP!', '#ffd23f', player.r + 100);
    sfx.boing(TOP, 2.4); sfx.geom(mult);
    ring(q.a, q.R, '#ffd23f', 1);
    burst(-theta, player.r + 24, '#ffd23f', 14, 280);
    addShake(4);
    buzz(18);
  }
  // A rogue asteroid tumbling across the passage. The force field soaks up the
  // hit and bounces you off it (one charge each); without, it knocks you back
  // the way you came.
  const FIELD_MAX = 5;
  function bump(q, nx, ny, overlap) {
    q.cool = 0.35; q.flash = 1;
    player.r -= ny * overlap;
    theta += (nx * overlap) / player.r;
    // The ice hauler's shield works as a force field too, without using it up
    if (player.field > 0 || player.shield > 0) {
      if (player.shield <= 0) player.field--;
      // Bounce off: reflect the way you were going, at the same speed
      let vx = player.vx, vr = player.vr;
      const into = vx * nx + vr * ny;
      if (into > 0) { vx -= 2 * into * nx; vr -= 2 * into * ny; }
      const away = -(vx * nx + vr * ny), min = 200;
      if (away < min) { vx -= nx * (min - away); vr -= ny * (min - away); }
      player.vx = vx; player.vr = vr;
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
    if (first) toast('A being of light hums five notes and wraps you in a force field: it takes 5 hits from rogue asteroids, and geoms charge it back up. Above is the asteroid belt, all the way round Mars: find your way to your world.', 7);
  }

  function updateSpace(dt) {
    if (fx.dedication > 0) fx.dedication -= dt;
    updateFlare(dt);
    // Walk past something on the ground to hear about it
    if (player.onGround && (player.r <= R0 + 1 || level === 6)) {
      for (const d of world.decor) {
        if (d.note && !d.seen && Math.abs(wrap(d.a + theta)) * player.r < 34 && (level !== 6 || Math.abs(d.R - player.r) < 4)) { d.seen = true; toast(d.note, 7); }
      }
    }
    // The Martians set off when you first come near their field, or after a while
    if (level === 3 && fx.convoyStart == null && state === 'play'
      && ((player.onGround && Math.abs(wrap(SAUCER_FIELD + theta)) * R0 < W * 0.4) || playTime > 25)) fx.convoyStart = clock;
    if (level === 3 && !fx.convoySeen && tierFloat(player.r) < 2.5
      && ((convoyT() < BOARD_END && Math.abs(wrap(SAUCER_FIELD + theta)) * R0 < W * 0.45) || (convoyK() > 0.08 && convoyK() < 0.5))) {
      fx.convoySeen = true;
      toast(convoyT() < BOARD_END ? 'Martians! Big brains, glass helmets, ray guns… and they\'re climbing into their flying saucers. Where are they off to?'
        : 'A convoy of flying saucers, heading for Earth! Big brains, glass helmets, and they look in a hurry. Somebody should warn them.', 5.5);
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
    const air = !player.onGround && !player.inside && !player.carried;
    const collide = (q, hit) => {
      q.flash = Math.max(0, q.flash - dt * 2.5);
      q.cool = Math.max(0, q.cool - dt);
      if (!air || q.cool > 0 || Math.abs(q.R - player.r) > 120) return;
      const ph = q.a + theta, bodyR = player.r + 24;
      const dx = q.R * Math.sin(ph), dy = q.R * Math.cos(ph) - bodyR, d = Math.hypot(dx, dy) || 1;
      if (d < q.r + 16) hit(q, dx / d, dy / d, q.r + 16 - d);
    };
    if (level === 6) updateHollow(dt, collide);
    // Lost outside the passage, you can drift back in through the walls
    if (player.lost !== true) for (const q of world.rocks || []) if (!q.route || q.route === route) collide(q, bumpWall);
    for (const q of world.pops || []) if (!q.route || q.route === route) collide(q, bumpPop);
    // Rogue asteroids: now and then one tumbles across the passage, more often
    // the deeper into the belt you are
    if (level === 3) {
      fx.crossT -= dt;
      if (beltK() > 0.5 && lastTier >= FLIP && lastTier < TOP && fx.crossT <= 0 && state === 'play') {
        const depth = (lastTier - FLIP) / (TOP - FLIP);
        fx.crossT = (lerp(9, 5, depth) + Math.random() * 3) / (route ? BELT_WORLDS[route].rogue : 1);
        // They come in from the side, across the way up, ahead of you
        const R = player.r + 170 + Math.random() * 250, L = laneAt(R) || { a: -theta, half: W * 0.6 };
        if (L) {
          const side = Math.random() < 0.5 ? -1 : 1;
          fx.crossers.push({ a: L.a + (side * (L.half + 30)) / R, R, va: (-side * (110 + depth * 130)) / R, r: 15 + Math.random() * 9, spin: Math.random() * TAU, ph: 0, flash: 0, cool: 0, t: 0 });
          sfx.whoosh();
        }
      }
      for (const q of fx.crossers) { q.t += dt; q.a += q.va * dt; q.spin += dt * 2; collide(q, bump); }
      fx.crossers = fx.crossers.filter((q) => q.t < 9);
      updateLost();
      updateAdrift(dt);
      updateCrash(dt);
      updateBeltHazards(dt);
      updateCaves();
      updateCarry(dt);
      for (const g of world.grabbers || []) g.a = g.a0 + (Math.sin(clock * 0.4 + g.ph) * 90) / g.R;
      for (const c of world.caves || []) {
        if (!c.seen && Math.abs(wrap(c.a + theta)) * player.r < W * 0.5 && Math.abs(c.R - player.r) < H * 0.5) {
          c.seen = true; c.t0 = clock;
          toast('A battered light freighter just shot out of a cave in that asteroid… chased by a giant space slug! It wasn\'t a cave. The ship got away. Will you?', 6);
        }
      }
      if (fx.improbable) fx.improbable.t += dt;
      updateForeground(dt);
      // Touch your world from any side and you've landed on it
      if (state === 'play' && !player.onGround && player.r > tierR(FLIP + 2)) {
        for (const d of world.plats) {
          if (!d.dest) continue;
          const cR = d.R - d.world.r, ph = d.a + theta, bodyR = player.r + 24;
          if (Math.hypot(cR * Math.sin(ph), cR * Math.cos(ph) - bodyR) < d.world.r + 22) { route = aimFor = d.route; theta = -d.a; land(d); break; }
        }
      }
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
      if (player.r + 24 > R1 && player.r < R2 && Math.abs(wrap(b.a + theta)) * player.r < 22) spaceHit(b.kind === 'laser' ? 'MINING LASER!' : b.kind === 'lava' ? 'SCORCHED!' : b.kind === 'steam' ? 'STEAMED!' : 'RADIATION!', false);
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

  // Out of the air and into space, nothing keeps you upright: the tramp
  // tumbles slowly on the way up, and rights itself on the way down so it
  // still lands feet first. Space starts at the Kármán line on Earth, on the
  // Moon straight away (no air), and above Mars's thin sky.
  const inSpace = () => (level === 6 ? false : level === 1 ? player.r > tierR(9) : level === 2 || level === 5 || level === 7 ? true : player.r > tierR(3)); // (levels 3 and 4: above the air)
  function updateTumble(dt) {
    if (player.onGround || player.inside) { player.spin = 0; return; }
    let s = player.spin || 0;
    if (player.vr > 0 && inSpace()) {
      // Turning the way you're heading, a little faster when you steer hard
      s += dt * (3.2 + Math.abs(player.vx) / 250) * (player.facing || 1);
    } else {
      s = wrap(s);
      s -= s * Math.min(1, dt * 6);
    }
    player.spin = s;
  }

  // ---- Level 5: the run --------------------------------------------------------
  // Flung off a mass driver you fly straight out, faster and faster, and the
  // speed never lets up. Bands of asteroids stretch right across the way,
  // each with a gap: get through cleanly and your multiplier goes up, clip one
  // and it costs you points. Then, in a force field, straight through Jupiter
  // and out the other side, down onto Europa, and into the ocean under its ice.
  const RUN_Y = 0.76; // where you fly on the screen, from the top
  const RUN_NOTES = [
    [0.03 * RUN_LEN, 'EMPTY SPACE', "Out into empty space, and Jupiter's gravity is already pulling you in."],
    [0.12 * RUN_LEN, 'OUTER BELT', 'The last stray asteroids of the belt. Skim close past one for a CLOSE CALL and your multiplier goes up. Clip one and it costs you points.'],
    [0.26 * RUN_LEN, 'EDGE OF THE BELT', "The outer edge of the main belt. Beyond here, Jupiter's pull has swept most of the asteroids away."],
    [0.36 * RUN_LEN, "JUPITER'S PULL", "Jupiter's gravity has you now: from here it pulls you in faster and faster."],
    [0.29 * RUN_LEN, 'CALLISTO', "Callisto, one of the most heavily cratered worlds we know of. Its gravity drags you sideways: steer against it!"],
    [0.44 * RUN_LEN, 'HILDA ASTEROIDS', "The Hildas go round the Sun three times for every two of Jupiter's orbits, and bunch up in a giant triangle. Here comes a corner of it!"],
    [0.48 * RUN_LEN, 'GANYMEDE', 'Ganymede: the biggest moon in the Solar System, bigger than the planet Mercury. Its pull is the strongest. Keep away!'],
    [0.6 * RUN_LEN, 'COMET PIECES', "A comet torn apart by Jupiter's gravity, like Shoemaker-Levy 9: its pieces smashed into Jupiter in 1994. They drift across your path!"],
    [0.66 * RUN_LEN, 'EUROPA', "Europa, with an ocean hidden under its ice. You'll be back soon, so don't let it catch you yet."],
    [0.75 * RUN_LEN, 'RADIATION BELTS', "Jupiter's radiation belts are the fiercest of any planet. Europa Clipper keeps its electronics in a thick metal vault."],
    [0.81 * RUN_LEN, 'IO', 'Io: the most volcanic place in the Solar System, squeezed and stretched by the pull of Jupiter and its other moons.'],
    [0.89 * RUN_LEN, 'FALLING FAST', 'Falling towards Jupiter, the Juno probe reached about 265,000 km/h: one of the fastest speeds any spacecraft has ever hit.'],
    [0.93 * RUN_LEN, 'JUPITER', "Jupiter: so big that all the other planets would fit inside it. It has no solid surface to hit… so you're going in."],
    [RUN_LEN + 0.985 * DIVE_LEN, 'OUT THE OTHER SIDE', 'Out through the cloud tops on the far side of Jupiter! The force field held.'],
  ];
  const runLane = () => Math.min(W / 2 - 30, 330);
  // Out of Jupiter and on to Europa: climbing away, then up and over it
  const EXIT_T = 3.2, EU_UP = 1.0, EU_TURN = 1.6, EU_FALL = 1.9;
  const EU_LAND = EU_UP + EU_TURN + EU_FALL;
  // Where you sit on the screen in the run: you start where you were when the
  // mass driver flung you, and glide down to make room to see what's coming
  const runPY = () => {
    const R = fx.run, base = lerp(0.46, RUN_Y, smooth(clamp(((R && R.age) || 0) / 1.3, 0, 1)));
    // Climbing away from Jupiter you rise to the middle, ready to go up and over Europa
    if (R && R.phase === 'exit') return H * lerp(base, 0.45, smooth(clamp(R.pt / EXIT_T, 0, 1)));
    return H * (R && R.phase === 'europa' ? 0.45 : base);
  };
  const runF = () => (fx.run ? clamp(fx.run.d / RUN_LEN, 0, 1) : 0);
  // Inside Jupiter, layer by layer, like the fall through the hollow Earth:
  // down through each layer to the middle, then back up through them all on
  // the far side. 'at' is how deep each starts (0 the cloud tops, 1 the middle).
  const JUP_LAYERS = [
    { at: 0, name: 'AMMONIA ICE CLOUDS', sub: 'THE CLOUD TOPS, ABOUT -145°C', c: ['#f4ead2', '#e2cfa6'], fact: "The cloud tops: white clouds of ammonia ice, at about -145°C. Jupiter's stripes get their colours from what's mixed into them." },
    { at: 0.1, name: 'AMMONIUM HYDROSULFIDE', sub: 'BROWN CLOUDS', c: ['#c99a6a', '#a26a3a'], fact: 'Lower down: brownish clouds of ammonium hydrosulfide, ammonia mixed with hydrogen sulfide, the gas that smells of rotten eggs.' },
    { at: 0.2, name: 'WATER CLOUDS', sub: 'WHERE THE LIGHTNING IS', c: ['#7f8ea6', '#525c76'], fact: "Deeper still: clouds of water, where a lot of Jupiter's lightning flashes. (The Juno probe has spotted flashes higher up too.) Mind the bolts!" },
    { at: 0.32, name: 'HYDROGEN AND HELIUM', sub: 'NO SURFACE, JUST DEEPER', c: ['#8a4a24', '#5a2a14'], fact: "Below the clouds: just hydrogen and helium gas, hotter and thicker the deeper you go. There's no surface to land on." },
    { at: 0.5, name: 'LIQUID HYDROGEN', sub: 'AN OCEAN WITH NO SHORE', c: ['#6a1e14', '#3e1010'], fact: 'Squeezed so hard the hydrogen turns to liquid: an ocean with no shore. Drops of helium may rain down through it.' },
    { at: 0.7, name: 'METALLIC HYDROGEN', sub: "WHERE JUPITER'S MAGNETISM COMES FROM", c: ['#222a5a', '#10142e'], fact: "Hydrogen squeezed so hard it carries electricity like a metal. Swirling about, it makes Jupiter's huge magnetic field. (Game physics: nothing could really fly through here!)" },
    { at: 0.9, name: 'THE CORE', sub: 'THOUSANDS OF DEGREES', c: ['#fff0c0', '#ffa860'], fact: "The middle. The Juno probe found Jupiter's core may be big and 'fuzzy': not a solid ball, but mixed into the hydrogen round it." },
  ];
  const jupDepth = (d) => { const k = clamp((d - RUN_LEN) / DIVE_LEN, 0, 1); return 1 - Math.abs(k * 2 - 1); };
  const jupLayer = (d) => { const dp = jupDepth(d); let i = 0; while (i < JUP_LAYERS.length - 1 && JUP_LAYERS[i + 1].at <= dp) i++; return i; };
  // Where each boundary is: [distance, layer beyond it, layer before it], in and out
  const JUP_BOUNDS = [
    ...JUP_LAYERS.slice(1).map((L, i) => [RUN_LEN + (DIVE_LEN * L.at) / 2, i + 1, i]),
    ...JUP_LAYERS.slice(1).map((L, i) => [RUN_LEN + DIVE_LEN * (1 - L.at / 2), i, i + 1]).reverse(),
  ];
  const diveK = () => (fx.run ? clamp((fx.run.d - RUN_LEN) / DIVE_LEN, 0, 1) : 0);
  const bandU = (b, o) => o.u + b.off;
  // The mass driver: it grabs you, its coils charge one after another, then it
  // flings you up and away; the view fades into the run as you go
  const LAUNCH_CHARGE = 0.8, LAUNCH_HAND = 1.15, LAUNCH_END = 1.75;
  function startLaunch(p) {
    fx.launch = { t: 0, p, coil: 0 };
    player.vr = 0; player.vx = 0; player.onGround = true; player.r = p.R; player.heat = 0; fx.flames = [];
    banner('MASS DRIVER', 'CHARGING...'); sfx.tier(); buzz(20);
  }
  function updateLaunch(dt) {
    const L = fx.launch, p = L.p;
    L.t += dt;
    if (L.t < LAUNCH_CHARGE) {
      theta += wrap(-p.a - theta) * Math.min(1, dt * 8);
      player.squash = 0.5 * (L.t / LAUNCH_CHARGE);
      shake = Math.max(shake, 1 + 6 * (L.t / LAUNCH_CHARGE));
      const coil = Math.floor((L.t / LAUNCH_CHARGE) * 6);
      if (coil > L.coil) { L.coil = coil; sfx.boing(coil, 1 + coil * 0.15); burst(-theta, p.R + 10, '#6dd3ff', 4, 160); }
    } else {
      if (!L.flung) {
        L.flung = true; player.vr = 2200; player.onGround = false; player.squash = -0.8;
        fx.flash = 0.6; addShake(12); sfx.whoosh(); buzz([30, 30, 60]);
        burst(-theta, p.R, '#6dd3ff', 24, 520); ring(-theta, p.R, '#6dd3ff', 2.2);
        banner('MASS DRIVER!', 'FLAT OUT FOR JUPITER');
      }
      player.vr += 2500 * dt; player.r += player.vr * dt;
      cam.r += (player.r - cam.r) * Math.min(1, dt * 14); cam.anchor = lerp(cam.anchor || 0.46, 0.46, dt * 4);
    }
    for (const q of particles) { q.R += q.vr * dt; q.a += (q.vt * dt) / q.R; q.vr -= 380 * dt; q.life -= dt; }
    particles = particles.filter((q) => q.life > 0);
    for (const q of fx.pops) q.t += dt;
    fx.pops = fx.pops.filter((q) => q.t < 1.1);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 2.6) fx.banner = null; }
    shake = Math.max(0, shake - dt * 20); fx.flash = Math.max(0, fx.flash - dt * 1.5);
    player.squash = player.squash < 0 ? Math.min(0, player.squash + dt * 3) : player.squash;
    if (L.t >= LAUNCH_HAND) startRun(p);
  }
  let runFade = null;
  function startRun(p) {
    fx.run = { j0: 9 + tierFloat(p.R) * 1.5, d: 0, v: 300, x: 0, vx: 0, t: 0, hitT: 0, phase: 'run', pt: 0, told: 0, trail: [], from: p, field: 0, od: 0, flashT: 0, bolt: null };
    document.body.classList.add('run');
    player.onGround = false; player.vr = 0; player.vx = 0; player.spin = 0; player.heat = 0; fx.flames = []; fx.trail = [];
    fx.pops = []; particles = [];
    addScore(1000);
    banner('MASS DRIVER!', 'FLAT OUT FOR JUPITER');
    toast(touch ? "Flung off a mass driver, and Jupiter's gravity has you. Steer with ◀ ▶ (or tilt): dodge the asteroids, and keep clear of the big moons' pull."
      : "Flung off a mass driver, and Jupiter's gravity has you. Steer with ← →: dodge the asteroids, and keep clear of the big moons' pull.", 6);
    sfx.whoosh(); sfx.tier(); addShake(10); fx.flash = 0.5; buzz([30, 30, 60]);
  }
  function runSteer(dt, lane) {
    const R = fx.run;
    const kdir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const dir = kdir !== 0 ? kdir : tilt.on ? tilt.axis : 0;
    if (Math.abs(dir) > 0.1) player.facing = Math.sign(dir);
    R.vx = approach(R.vx, dir * 600, 3200 * dt);
    R.x += R.vx * dt;
    if (Math.abs(R.x) > lane) { R.x = Math.sign(R.x) * lane; R.vx = 0; }
  }
  function updateRun(dt) {
    const R = fx.run, lane = runLane();
    R.pt += dt; R.flashT = Math.max(0, R.flashT - dt);
    const py = runPY();
    if (R.phase === 'run') {
      // Jupiter's gravity: slow going in empty space at first, then it pulls
      // you in faster and faster the closer you get (speed rises as one over
      // the square root of the distance left). Climbing out the far side, you slow.
      // (It's a fall: as fast as dropping through the hollow Earth, and faster.)
      const want = R.d < RUN_LEN ? Math.min(2600, 1100 + 650 * (1 / Math.sqrt(1 - runF() + 0.04) - 1 / Math.sqrt(1.04))) : 2400 - 900 * diveK();
      R.v = approach(R.v, want, 1500 * dt);
      // How fast it *looks*: the stars and dust stream by far faster than the
      // asteroids come at you (they stay dodgeable), so it feels like a fall
      R.vis = R.v * (R.d < RUN_LEN ? 1.3 + 1.2 * runF() * runF() : 2.2 - 1.0 * diveK());
      R.vd = (R.vd || 0) + R.vis * dt;
      if (R.v > 500) shake = Math.max(shake, (R.v - 500) / 60);
      R.adv = Math.min(R.v, R.d < RUN_LEN ? lerp(780, 1180, runF()) : 1150);
      // Hitting Jupiter's air at this speed: a fireball, just like falling to Earth
      R.heat = R.d < RUN_LEN ? clamp((runF() - 0.86) / 0.14, 0, 1) : clamp(1 - diveK() / 0.3, 0, 1);
      R.d += R.adv * dt;
      R.hitT = Math.max(0, R.hitT - dt);
      runSteer(dt, lane);
      const bx = W / 2 + R.x, by = py - 24;
      // The big moons: each one's gravity drags you sideways towards it
      for (const m of world.moons || []) {
        const my = py - (m.d - R.d), mx = W / 2 + m.side * (lane + m.r * 0.55);
        if (my > H + m.r + 200 || my < -m.r - 400) continue;
        const dist = Math.hypot(mx - bx, my - by);
        const drift = Math.min(240, 620 * m.pull * (190 / Math.max(dist, 190)) ** 2);
        R.x += Math.sign(mx - bx) * drift * dt * clamp(1 - Math.abs(my - by) / 520, 0, 1);
        if (Math.abs(R.x) > lane) R.x = Math.sign(R.x) * lane;
        if (!m.told && my > -m.r) { m.told = true; pop(`${m.name.toUpperCase()}'S PULL!`, '#ffd6a0', player.r + 120); }
        if (R.hitT <= 0 && dist < m.r + 14) {
          R.hitT = 0.7; R.vx = -m.side * 560; R.x -= m.side * 20;
          const loss = Math.min(Math.round(score), 300 + Math.round(score * 0.05));
          score -= loss; updateScoreHud(); R.streak = 0;
          fx.flash = 0.3; addShake(12); sfx.thud(); buzz([40, 30, 80]);
          pop(`CAUGHT BY ${m.name.toUpperCase()}! -${fmtScore(loss)}`, '#ff5a4a', player.r + 90);
        }
      }
      for (const b of world.run) {
        const y = py - (b.d - R.d);
        if (y > H + 80 || y < -120) continue;
        if (b.vu) { b.off += b.vu * dt; if (Math.abs(b.off) > 0.5) b.vu = -b.vu; }
        if (!b.hit && R.hitT <= 0 && Math.abs(y - by) < 40) {
          for (const o of b.rocks) {
            const ox = W / 2 + bandU(b, o) * lane + (b.kind === 'spark' ? 6 * Math.sin(clock * 9 + o.ph) : 0);
            if (Math.hypot(ox - bx, y - by) < o.r + 13) {
              // Clipped it: points off (the speed doesn't drop)
              b.hit = true; R.hitT = 0.5; R.vx = Math.sign(bx - ox || 1) * 380;
              const loss = Math.min(Math.round(score), 200 + Math.round(score * 0.04));
              score -= loss; updateScoreHud();
              if (R.d > RUN_LEN) R.field = Math.max(0, R.field - 20);
              fx.flash = 0.25; addShake(9); sfx.thud(); buzz([40, 30, 60]);
              pop(`-${fmtScore(loss)}`, '#ff5a4a', player.r + 90);
              for (let i = 0; i < 10; i++) R.trail.push({ x: ox, y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, t: 0, life: 0.5, c: b.kind === 'spark' ? '#ff6ad5' : '#9a92a2' });
              break;
            }
          }
        }
        if (!b.passed && y > by + 10) {
          b.passed = true;
          // Skimmed one without touching: a close call
          const near = !b.hit && b.rocks.some((o) => Math.abs(W / 2 + bandU(b, o) * lane - bx) < o.r + 58);
          if (near) {
            addMult(); addScore(50); R.streak = (R.streak || 0) + 1;
            if (R.streak % 5 === 0) { addScore(50 * R.streak); pop(`STREAK ${R.streak}!`, '#ffd23f', player.r + 110); sfx.perfect(); for (let i = 0; i < 14; i++) R.trail.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 360, vy: (Math.random() - 0.5) * 360, t: 0, life: 0.6, c: '#ffd23f' }); }
            else pop(`CLOSE CALL! x${mult}`, '#6dff7a', player.r + 70);
          } else if (b.hit) R.streak = 0;
          else addScore(10);
        }
      }
      for (const g of world.stars) {
        if (!g.run || g.taken) continue;
        const y = py - (g.d - R.d);
        if (y > H + 40 || y < -40) continue;
        const gx = W / 2 + g.u * lane;
        if (Math.hypot(gx - bx, y - by) < 34) {
          g.taken = true; addScore(100); sfx.star(mult); updateStarsHud(true);
          for (let i = 0; i < 8; i++) R.trail.push({ x: gx, y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, t: 0, life: 0.45, c: '#6dff7a' });
        }
      }
      while (R.told < RUN_NOTES.length && R.d >= RUN_NOTES[R.told][0]) {
        const [, title, text] = RUN_NOTES[R.told++];
        banner(title, fmtKm(runKm())); toast(text, 5.5); sfx.tier();
      }
      // Into Jupiter: the force field comes on
      if (R.d >= RUN_LEN && !R.field && !R.inJ) {
        R.inJ = true; R.field = 100; fx.flash = 0.9; addShake(14); sfx.whoosh();
        banner('FORCE FIELD ON!', 'INTO JUPITER');
        toast('FORCE FIELD ON! Straight into Jupiter as a fireball. (In 1995 the Galileo probe hit Jupiter\'s air at 47 km/s, and most of its heat shield burned away.) Storms you clip weaken the field.', 6);
      }
      if (R.inJ) {
        R.field = Math.min(100, R.field + 3 * dt);
        // Lightning: a warning flicker down a column, then a bolt
        // Crashing through into each new layer
        const li = jupLayer(R.d);
        if (li !== R.layer) {
          const L = JUP_LAYERS[li], deeper = R.layer === undefined || li > R.layer;
          R.layer = li; R.flashT = 0.15; addShake(10); sfx.thud(); buzz(25);
          banner(L.name, L.sub);
          for (let i = 0; i < 24; i++) R.trail.push({ x: W / 2 + R.x + (Math.random() - 0.5) * 160, y: py - 24, vx: (Math.random() - 0.5) * 520, vy: (Math.random() - 0.7) * 420, t: 0, life: 0.7, c: L.c[0] });
          if (deeper && !(R.seenL || (R.seenL = {}))[li]) { R.seenL[li] = true; toast(L.fact, 6); }
        }
        if (!R.bolt && Math.random() < dt * 1.2 && li === 2) R.bolt = { u: R.x / lane + (Math.random() - 0.5) * 0.6, t: 0 };
        if (R.bolt) {
          R.bolt.t += dt;
          if (R.bolt.t > 0.9 && !R.bolt.hit) {
            R.bolt.hit = true; R.flashT = 0.2; sfx.thud();
            if (Math.abs(W / 2 + R.bolt.u * lane - bx) < 34 && R.hitT <= 0) { R.field = Math.max(0, R.field - 20); R.hitT = 0.5; pop('ZAP!', '#8fd0ff', player.r + 90); addShake(8); }
          }
          if (R.bolt.t > 1.2) R.bolt = null;
        }
      }
      R.trail.push({ x: bx + (Math.random() - 0.5) * 10, y: py + 4, vx: (Math.random() - 0.5) * 40, vy: 120 + R.v * 0.3, t: 0, life: 0.35, c: Math.random() < 0.5 ? '#ffd23f' : '#ff8a3a' });
      if (R.d >= RUN_LEN + DIVE_LEN) {
        R.phase = 'exit'; R.pt = 0; R.x0 = bx;
        const bonus = Math.round(R.field) * 30;
        addScore(bonus); pop(`FIELD BONUS ${fmtScore(bonus)}`, '#8fd0ff', player.r + 100);
        sfx.perfect();
      }
    } else if (R.phase === 'exit') {
      // Bursting out of the far side, and climbing away: Jupiter's pull holds
      // you back, so you slow as it shrinks behind you
      runSteer(dt, lane);
      R.v = approach(R.v, 380, 700 * dt); R.vis = R.v * 1.4; R.vd = (R.vd || 0) + R.vis * dt;
      if (R.pt < 0.6) shake = Math.max(shake, 8 * (1 - R.pt / 0.6));
      if (R.pt > EXIT_T) {
        R.phase = 'europa'; R.pt = 0;
        banner('EUROPA', 'AN OCEAN UNDER THE ICE');
        toast("Europa: a moon of ice, a bit smaller than ours. Under the ice is a salty ocean that may hold twice as much water as all of Earth's oceans.", 6);
        sfx.tier();
      }
    } else if (R.phase === 'europa') {
      // Up after it as it slides out of sight above you, over you go, and
      // down you drift onto its ice, the same as landing on any other world
      R.x = approach(R.x, 0, 400 * dt);
      R.vis = Math.max(0, (R.vis || 0) - 500 * dt); R.vd = (R.vd || 0) + R.vis * dt;
      if (R.pt > EU_UP && !R.turnTold) { R.turnTold = true; banner("EUROPA'S PULL", 'UP AND OVER'); sfx.whoosh(); }
      if (R.pt > EU_LAND && !R.landed) {
        R.landed = true; addShake(6); sfx.thud(); buzz(30);
        for (let i = 0; i < 22; i++) R.trail.push({ x: W / 2, y: H * 0.72, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 120, t: 0, life: 1.3, c: '#eef4ff' });
        toast("On Europa! Its gravity is only about a seventh of Earth's, so you drift down slowly. Jupiter fills the sky, and it never moves: Europa always keeps the same face towards it.", 6);
      }
      if (R.landed) R.crack = clamp((R.pt - EU_LAND - 0.7) / 0.6, 0, 1);
      if (R.pt > EU_LAND + 1.3) {
        // The ice gives way under you, and down you go
        R.phase = 'ocean'; R.pt = 0; R.od = 0; R.ov = 0; R.x = 0; R.vx = 0; R.euL = 0;
        addShake(10); sfx.thud(); buzz([40, 30, 60]); pop('CRACK!', '#eef4ff', player.r + 90);
        banner('SURFACE ICE', 'ABOUT -160°C'); toast(EU_LAYERS[0].fact, 6);
      }
    } else if (R.phase === 'ocean') {
      runSteer(dt, lane);
      // Smashing down through the ice fast; the water slows you; easing
      // down onto the seafloor at the end
      const want = R.od < 2100 ? 1000 : R.od < OCEAN_LEN - 500 ? 560 : 160;
      R.ov = approach(R.ov, want, (R.od < 2100 ? 900 : 700) * dt);
      R.od = Math.min(OCEAN_LEN, R.od + R.ov * dt);
      if (R.od < 2100 && R.ov > 500) shake = Math.max(shake, 2);
      const fy = euFeetY(R), by = fy - 24, bx = W / 2 + R.x;
      // Crashing through into each new layer
      const li = euLayer(R.od);
      if (li !== R.euL) {
        R.euL = li; const L = EU_LAYERS[li];
        banner(L.name, L.sub); toast(L.fact, li === EU_LAYERS.length - 1 ? 8 : 6);
        addShake(li === 3 ? 8 : 10); sfx.thud(); buzz(25);
        for (let i = 0; i < 24; i++) R.trail.push({ x: bx + (Math.random() - 0.5) * 120, y: fy, vx: (Math.random() - 0.5) * 460, vy: -Math.random() * 380, t: 0, life: 0.8, c: li === 3 ? '#cfe8ff' : L.c[0] });
        if (li === 3) { pop('SPLASH!', '#8fd0ff', player.r + 90); sfx.whoosh(); }
      }
      for (const g of world.stars) {
        if (!g.ocean || g.taken) continue;
        const y = fy + (g.d - R.od), gx = W / 2 + g.u * lane;
        if (Math.hypot(gx - bx, y - by) < 34) {
          g.taken = true; addMult(); addScore(50); sfx.star(mult); updateStarsHud(true);
          for (let i = 0; i < 8; i++) R.trail.push({ x: gx, y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, t: 0, life: 0.45, c: '#8fffe0' });
        }
      }
      if (R.od >= OCEAN_LEN && !R.floored) { R.floored = true; R.floorT = 0; addShake(6); sfx.thud(); for (let i = 0; i < 18; i++) R.trail.push({ x: bx, y: fy, vx: (Math.random() - 0.5) * 240, vy: -Math.random() * 140, t: 0, life: 1, c: '#5a5a66' }); }
      if (R.floored && (R.floorT += dt) > 1.6 && state === 'play') { lastTier = TOP; bestTier = TOP; win(); }
    }
    for (const q of R.trail) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    R.trail = R.trail.filter((q) => q.t < q.life);
  }
  const runKm = () => {
    const R = fx.run;
    if (!R) return 0;
    if (R.phase === 'run') return R.d < RUN_LEN ? lerp(TIERS[TOP].km, JUPITER_KM, runF()) : JUPITER_KM;
    return JUPITER_KM + EUROPA_KM;
  };
  // The parts of the frame update that still matter during the run
  function updateRunFrame(dt) {
    if (state === 'play') playTime += dt;
    fx.run.age = (fx.run.age || 0) + dt;
    if (fx.launch) {
      // Still rocketing away from the belt in the old view while the run fades in
      const L = fx.launch; L.t += dt;
      player.vr += 2500 * dt; player.r += player.vr * dt; cam.r = player.r;
      if (L.t >= LAUNCH_END) fx.launch = null;
    }
    updateRun(dt);
    if (snd) { snd.music.set({ tierF: 9 + TOP + runF() * 6, speed: 1 + runF(), won: state === 'won', belt: state === 'play' }); snd.sfx.burn(fx.run.phase === 'run' ? fx.run.heat || 0 : 0); }
    for (const q of fx.pops) q.t += dt;
    fx.pops = fx.pops.filter((q) => q.t < 1.1);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 2.6) fx.banner = null; }
    shake = Math.max(0, shake - dt * 30);
    fx.flash = Math.max(0, fx.flash - dt * 1.5);
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0.4) hud.toast.style.opacity = '0';
      if (toastTimer <= 0) hud.toast.hidden = true;
    }
    const R = fx.run;
    hud.alt.textContent = R.phase === 'ocean' ? `${fmtKm(euKm(R.od))} down` : fmtKm(runKm());
    hud.layer.textContent = layerName();
  }
  // ---- Arriving at a new world --------------------------------------------------------
  // When you reach a world you've watched grow in the sky, the whole view
  // turns upside down (it was above you; now it's under your feet) while
  // something of that world's own hides the change: a dust cloud, an entry
  // fireball, acid clouds, glare. Then you drop onto its real landscape.
  const ARR_TURN = [0.25, 1.45], ARR_SWAP = 1.5;
  const ARRIVE = {
    moon: { g: 0.17, cover: 'dust', sky: ['#000000', '#05060c'], ground: ['#b9b6c2', '#5c5a66'], curve: 3, note: "On the Moon! Gravity here is a sixth of Earth's, so you float down. Earth hangs in the sky and hardly moves: the Moon always keeps the same face towards it." },
    mars: { g: 0.38, cover: 'fire', sky: ['#c99a6e', '#e6c29a'], ground: ['#c8603c', '#7a2e1c'], curve: 5, note: 'On Mars: rusty red dust under a butterscotch sky. At sunset the sky round the Sun turns blue!' },
    venus: { g: 0.9, cover: 'cloud', sky: ['#d9a94e', '#f6dfa0'], ground: ['#f2e2a0', '#cdb06a'], curve: 5, note: 'In the clouds of Venus, 50 km up: the air pressure and temperature here are the most Earth-like anywhere else in the Solar System.' },
    mercury: { g: 0.38, cover: 'glare', sky: ['#000000', '#0a0806'], ground: ['#a9a39c', '#5f5a54'], curve: 3, note: "On Mercury: the Sun looks about three times as big as it does from Earth, and there's almost no air, so the sky is black even in the day." },
    ceres: { g: 0.03, cover: 'rubble', sky: ['#000000', '#05060c'], ground: ['#8d8a86', '#4c4a48'], curve: 1.4, note: "On Ceres: hardly any gravity, so you'd jump many metres high here. The bright spots are salt." },
    vesta: { g: 0.025, cover: 'rubble', sky: ['#000000', '#05060c'], ground: ['#a39a8a', '#5d5649'], curve: 1.4, note: 'On Vesta: the mountain on the horizon, in the giant Rheasilvia crater, is more than twice as tall as Everest.' },
    pallas: { g: 0.02, cover: 'rubble', sky: ['#000000', '#05060c'], ground: ['#7f8a94', '#454d54'], curve: 1.4, note: 'On Pallas: its path round the Sun is tilted steeply, so it swings far above and below most of the other asteroids.' },
    hygiea: { g: 0.01, cover: 'rubble', sky: ['#000000', '#05060c'], ground: ['#5d5a5e', '#2e2c30'], curve: 1.2, note: 'On Hygiea: almost perfectly round, so it may count as a dwarf planet. Its dark surface is carbon-rich rock.' },
    earth: { g: 1, cover: 'daylight', sky: ['#58b4f0', '#d4f0ff'], ground: ['#4fb34a', '#2f6f2a'], curve: 5, note: "Back in daylight! You climbed right out of the hollow Earth. Nobody's ever going to believe you." },
  };
  // Where each world leads on to: you land on the next level, ready to play
  const nextLevel = () => (level === 1 ? 2 : level === 2 ? (route === 'venus' ? 4 : route === 'earth' ? 1 : 3) : level === 3 ? 5 : level === 6 ? 1 : 0);
  const ARR_PULL = 0.9;
  function reachDest(p) {
    if (p.world) landedOn = p.world;
    lastTier = TOP; bestTier = TOP;
    startArrival(p);
  }
  function startArrival(p) {
    const key = level === 6 ? 'earth' : level === 3 && p.world ? p.world.name.toLowerCase() : p.type;
    if (!ARRIVE[key]) { win(); return; }
    // The clock starts below zero: first the world's pull takes you, then the turn
    const pull = ARR_PULL;
    fx.arrive = { key, t: -pull, target: p, gr: 0, landed: false, bits: [], time: playTime, next: nextLevel(), aim: -p.a, th0: theta, r0: player.r, R: p.R, globe: level === 3 && p.world ? p.world.r : MOON_R };
    fx.arrive.gr = fx.arrive.globe;
    player.vx = 0; player.spin = 0; player.heat = 0; fx.flames = [];
    sfx.whoosh();
    if (!player.onGround) { addShake(4); banner(level === 6 ? 'DAYLIGHT!' : `${destName().replace('the ', '').toUpperCase()}'S PULL`, level === 6 ? 'UP AND OUT' : 'HERE WE GO'); }
  }
  // Straight on into the next level, with no change of scene: you touch down
  // on a world exactly the size and place of the next level's, and play on.
  const LAND_T = 0.3;
  let landSnap = null, snapping = false;
  function goOn() {
    const A = fx.arrive, from = level;
    // Keep a picture of the old view to turn and fade out
    landSnap = landSnap || document.createElement('canvas');
    landSnap.width = canvas.width; landSnap.height = canvas.height;
    fx.banner = null; snapping = true; renderWorld(); snapping = false; // just the world: no banner or rail
    const sc = landSnap.getContext('2d');
    sc.globalCompositeOperation = 'copy'; sc.drawImage(canvas, 0, 0); sc.globalCompositeOperation = 'source-over';
    const feetY = H * (cam.anchor || 0.46);
    playTime = A.time;
    const bonus = win(true);
    startGame(A.next, { score, mult, ...lastWin });
    cam.r = R0; cam.anchor = feetY / H; cam.zoom = 1;
    fx.land = { t: 0 };
    pop(`LEVEL ${from} DONE! +${fmtScore(bonus)}`, '#ffd23f', player.r + 110);
    sfx.tier();
  }
  // ---- Climbing out to the next world ------------------------------------------
  // From the last platform you bounce up after the world that's slid out of
  // sight above you, and keep going: its pull has you now. The next level's
  // own world really is up there, upside down, getting closer. The view turns
  // right over (you stay upright; home swings round overhead, the sky becomes
  // the new world's sky) and by the end you're simply falling towards the
  // next level's ground, which is where the game carries on: nothing swaps.
  const climbOut = () => (level === 1 || level === 2 || level === 6) && nextLevel() > 0;
  const CLIMB_TURN = [0.35, 1.85], CLIMB_T = 1.9, DROP_H = 1250, CLIMB_VE = 420, CLIMB_BUMP = 1100;
  // The backdrop tramp on each world's starting ground takes you back the way you came
  // (The Moon has no backdrop tramp: the way home to Earth is a whole route of its own)
  const PREV = { 3: 2, 4: 2, 5: 3 };
  const WORLD_NAME = { 1: 'Earth', 2: 'the Moon', 3: 'Mars', 4: 'Venus', 5: 'the belt', 6: 'the hollow Earth' };
  // Worlds with air to fall through on the way down
  const AIRY = (lv) => lv === 1 || lv === 3 || lv === 4;
  const climbTurn = () => (fx.climb ? Math.PI * smooth(clamp((fx.climb.t - CLIMB_TURN[0]) / (CLIMB_TURN[1] - CLIMB_TURN[0]), 0, 1)) : 0);
  // How far you've flown after t seconds: off the bounce, faster and faster,
  // then easing as the new world's gravity takes over
  const climbDist = (C, t) => C.v0 * t + ((CLIMB_VE - C.v0) * t * t) / (2 * CLIMB_T) + ((CLIMB_BUMP * CLIMB_T) / Math.PI) * (1 - Math.cos((Math.PI * t) / CLIMB_T));
  const freshFx = () => ({ geoms: [], flames: [], craters: [], puffs: [], rings: [], pops: [], trail: [], trailT: 0, banner: null, flash: 0, streak: 0, whistled: false, shooting: [], shootT: 2, meteors: [], meteorT: 4, visitor: null, dedication: 0, crossers: [], crossT: 3 });
  // Everything the drawing reads about "which world", so a second one can be drawn
  const grabState = () => ({ level, route, aimFor, landedOn, world, theta, TIERS, TOP, CHECKPOINTS, fx, particles, flipK, checkpoint, cam, lastTier, bestTier, pr: player.r, pvr: player.vr, pg: player.onGround, ps: player.spin });
  function putState(S) {
    ({ level, route, aimFor, landedOn, world, theta, TIERS, TOP, CHECKPOINTS, fx, particles, flipK, checkpoint, cam, lastTier, bestTier } = S);
    player.r = S.pr; player.vr = S.pvr; player.onGround = S.pg; player.spin = S.ps;
  }
  function inState(G, fn) { const S = grabState(); putState(G); try { fn(); } finally { G.cam = cam; putState(S); } }
  let ghostDraw = false, noSky = false;
  function startClimb(next = nextLevel(), back = false) {
    const C = fx.climb = { t: 0, next, back, time: playTime, r0: player.r, v0: Math.max(player.vr, 400) };
    const from = level;
    lastTier = TOP; bestTier = TOP;
    player.heat = 0; fx.flames = []; player.hopLock = 0;
    // Build the next level's world now: it's up there, waiting
    const S = grabState();
    level = C.next; route = null; aimFor = null; landedOn = null; useTiers();
    theta = 0; flipK = 0; checkpoint = 0; lastTier = -1; bestTier = -1; particles = []; fx = freshFx();
    world = buildWorld(Math.floor(Math.random() * 1e9));
    addBackTramp();
    cam = { r: R0 + DROP_H + climbDist(C, CLIMB_T), anchor: 0.5, zoom: 1 };
    player.r = cam.r; player.vr = 0; player.onGround = false; player.spin = 0;
    C.G = grabState();
    putState(S);
    fx.climb = C;
    player.backTo = 0;
    if (back) banner(`BACK TO ${WORLD_NAME[next].replace('the ', '').toUpperCase()}`, 'BACKDROP!');
    else banner(from === 6 ? 'DAYLIGHT!' : `${destName().replace('the ', '').toUpperCase()}'S PULL`, from === 6 ? 'UP AND OUT' : 'UP AND OVER');
    sfx.whoosh(); addShake(4);
  }
  function updateClimb(dt) {
    const C = fx.climb;
    C.t = Math.min(C.t + dt, CLIMB_T);
    if (state === 'play') playTime += dt;
    const d = climbDist(C, C.t);
    player.vr = (climbDist(C, C.t + 0.01) - d) / 0.01;
    player.r = C.r0 + d; player.onGround = false;
    player.spin = -climbTurn(); // stays upright on screen as the world turns
    cam.r = player.r; cam.anchor = lerp(cam.anchor || 0.46, 0.5, Math.min(1, dt * 8));
    // Where you are as seen from the new world: high above its ground, coming down
    C.G.pr = R0 + DROP_H + climbDist(C, CLIMB_T) - d; C.G.cam.r = C.G.pr; C.G.cam.anchor = cam.anchor;
    for (const q of particles) { q.R += q.vr * dt; q.a += (q.vt * dt) / q.R; q.vr -= 380 * dt; q.life -= dt; }
    particles = particles.filter((q) => q.life > 0);
    for (const q of fx.pops) q.t += dt;
    fx.pops = fx.pops.filter((q) => q.t < 1.1);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 2.6) fx.banner = null; }
    shake = Math.max(0, shake - dt * 30);
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0.4) hud.toast.style.opacity = '0'; if (toastTimer <= 0) hud.toast.hidden = true; }
    if (C.t >= CLIMB_T) climbArrive();
  }
  // Both worlds, turned over about the tramp: the old one below (then above),
  // the new one above (then below)
  function drawClimb() {
    const C = fx.climb, turn = climbTurn();
    const skyK = smooth(clamp((C.t - 0.3) / (CLIMB_T - 0.35), 0, 1));
    // Everything turns about the middle of the tramp, who stays put and
    // upright: the worlds, and the sky with them (the old sky turning away,
    // the new world's turning in, upside down to right way up)
    const px0 = W / 2, py0 = H * (cam.anchor || 0.5) - 24;
    turnSkies(C, turn, skyK, px0, py0);
    const flip = () => { ctx.translate(px0, py0); ctx.rotate(Math.PI); ctx.translate(-px0, -py0); };
    ctx.save();
    ctx.translate(px0, py0); ctx.rotate(turn); ctx.translate(-px0, -py0);
    const was = snapping; snapping = true; noSky = true;
    inState(C.G, () => { ctx.save(); flip(); ghostDraw = true; renderWorld(); ghostDraw = false; ctx.restore(); });
    renderWorld();
    snapping = was; noSky = false;
    ctx.restore();
  }
  // The sky, turning: each sky is drawn, kept, and put back turned with soft
  // edges, over an unturned copy that fills the corners
  let skyA = null, skyB = null, feather = null;
  const canvasLike = (c) => { c = c || document.createElement('canvas'); if (c.width !== canvas.width || c.height !== canvas.height) { c.width = canvas.width; c.height = canvas.height; c.made = false; } return c; };
  function turnSkies(C, turn, skyK, px0, py0) {
    skyA = canvasLike(skyA); skyB = canvasLike(skyB); feather = canvasLike(feather);
    const keep = (buf) => { const b = buf.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'copy'; b.drawImage(canvas, 0, 0); b.globalCompositeOperation = 'source-over'; };
    drawSky(); keep(skyA);
    if (skyK > 0) { inState(C.G, () => drawSky()); keep(skyB); }
    // Underneath, unturned
    ctx.drawImage(skyA, 0, 0, W, H);
    if (skyK > 0) { ctx.save(); ctx.globalAlpha = skyK; ctx.drawImage(skyB, 0, 0, W, H); ctx.restore(); }
    if (turn < 0.002) return;
    if (!feather.made) {
      const f = feather.getContext('2d'), fw = feather.width, fh = feather.height, e = Math.min(fw, fh) * 0.22;
      f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, fw, fh); f.fillStyle = '#000'; f.fillRect(0, 0, fw, fh);
      f.globalCompositeOperation = 'destination-out';
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, e, 0, 0, 0, e, fh], [fw, 0, fw - e, 0, fw - e, 0, e, fh], [0, 0, 0, e, 0, 0, fw, e], [0, fh, 0, fh - e, 0, fh - e, fw, e]]) {
        const g = f.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = g; f.fillRect(rx, ry, rw, rh);
      }
      f.globalCompositeOperation = 'source-over'; feather.made = true;
    }
    const soften = (buf) => { const b = buf.getContext('2d'); b.globalCompositeOperation = 'destination-in'; b.drawImage(feather, 0, 0); b.globalCompositeOperation = 'source-over'; };
    const put = (buf, ang, a) => { ctx.save(); ctx.globalAlpha = a; ctx.translate(px0, py0); ctx.rotate(ang); ctx.translate(-px0, -py0); ctx.drawImage(buf, 0, 0, W, H); ctx.restore(); };
    soften(skyA); put(skyA, turn, 1);
    if (skyK > 0) { soften(skyB); put(skyB, turn - Math.PI, skyK); }
  }
  // The turn's done and you're falling towards the new world's ground: from
  // here on it's simply that level, already exactly as it was drawn
  function climbArrive() {
    const C = fx.climb, from = level, suit = player.suit;
    playTime = C.time + C.t;
    let bonus = 0;
    if (C.back) { const c = carry || { time: 0, got: 0, total: 0, falls: 0 }; startGame(C.next, { ...c, score, mult, time: c.time + playTime }); }
    else { bonus = win(true); startGame(C.next, { score, mult, ...lastWin }); }
    const keep = fx; putState(C.G); fx = keep; // (startGame's banner and toast, the world as drawn)
    theta = 0; lastTier = -1; bestTier = -1;
    player.r = R0 + DROP_H; player.vr = -CLIMB_VE; player.onGround = false; player.apexR = player.r; player.spin = 0;
    if (from !== 6) player.suit = suit; // (no quick change on the way down)
    cam.r = player.r; cam.zoom = 1;
    updateStarsHud();
    fx.drop = true;
    if (bonus) pop(`LEVEL ${from} DONE! +${fmtScore(bonus)}`, '#ffd23f', player.r + 110);
    if (AIRY(level) && from !== 6) toast(level === 1 ? 'Back into Earth\'s air: it heats up round you as it slows you down.' : level === 3 ? "Into Mars's thin air: it's less than 1% as thick as Earth's, but at this speed it still glows round you." : "Into Venus's thick clouds of sulfuric acid. The air down at the surface is 90 times as thick as Earth's.", 5);
    sfx.tier();
  }
  // Falling into a world's air: it piles up in a glowing cap under your feet
  // and streams away above you, fading as the air slows you down
  function drawEntry(x, y) {
    const k = clamp((player.r - R0 - 150) / 700, 0, 1) * clamp(-player.vr / 400, 0, 1);
    if (k <= 0.02) return;
    const col = level === 4 ? '255,225,150' : level === 3 ? '255,150,90' : '255,190,120';
    const g = ctx.createRadialGradient(x, y + 6, 4, x, y + 6, 70);
    g.addColorStop(0, `rgba(255,255,235,${0.9 * k})`); g.addColorStop(0.35, `rgba(${col},${0.6 * k})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + 6, 70, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,245,220,${0.8 * k})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y - 18, 40, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const ox = (i - 4.5) * 7 + Math.sin(clock * 9 + i) * 3, len = (40 + ((i * 37) % 50)) * k, t = (clock * 3 + i * 0.23) % 1;
      ctx.fillStyle = `rgba(${col},${0.55 * k * (1 - t)})`; ctx.fillRect(x + ox - 1, y - 50 - t * 60 - len, 3, len);
    }
  }
  // A trampoline for going back: bounce on it and you're off the way you came
  function addBackTramp() {
    const to = PREV[level];
    if (!to || !world) return;
    const ground = world.plats.filter((q) => q.tier === 0);
    const free = (a) => Math.abs(a) * R0 > 150 && ground.every((q) => Math.abs(wrap(q.a - a)) * R0 > 150);
    const a = [-0.42, 0.42, -0.62, 0.62, -0.85, 0.85, -1.1, 1.1, -1.4, 1.4].find(free);
    if (a === undefined) return;
    world.plats.push({ tier: 0, a, a0: a, type: 'backdrop', back: to, g: gravAt(0), R: tierR(0), w: 84, bounce: bounceFor(0), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: 0 });
  }
  function drawBackTramp(p, w, sq) {
    // A blue trampoline, and a sign pointing home
    px(-w / 2 + 6, 4, 4, 26, '#3b3b4f'); px(w / 2 - 10, 4, 4, 26, '#3b3b4f');
    px(-w / 2, 0, w, 6, '#3f6fd8');
    ctx.fillStyle = '#1b1530';
    ctx.beginPath(); ctx.moveTo(-w / 2 + 6, 1); ctx.quadraticCurveTo(0, 1 + sq * 14, w / 2 - 6, 1); ctx.lineTo(w / 2 - 6, 4); ctx.quadraticCurveTo(0, 4 + sq * 14, -w / 2 + 6, 4); ctx.fill();
    px(-w / 2, 0, 6, 6, '#8fd0ff'); px(w / 2 - 6, 0, 6, 6, '#8fd0ff');
    px(w / 2 - 4, -44, 3, 44, '#9aa3b5');
    const label = `BACK TO ${WORLD_NAME[p.back].replace('the ', '').toUpperCase()}`;
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 12;
    px(w / 2 - 3 - tw, -58, tw, 15, '#1b1530'); px(w / 2 - 3 - tw, -58, tw, 2, '#8fd0ff');
    ctx.fillStyle = '#8fd0ff'; ctx.fillText(label, w / 2 - 3 - tw / 2, -47); ctx.textAlign = 'start';
  }
  // The ground is the same size and in the same place either side of the
  // change; this just blends the two skies for a moment
  function drawLandSnap() {
    const a = Math.min(1, 1 - fx.land.t / LAND_T);
    if (!landSnap || a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.drawImage(landSnap, 0, 0, W, H); ctx.restore();
  }
  function updateArrive(dt) {
    const A = fx.arrive, D = ARRIVE[A.key];
    A.t += dt;
    if (A.t < 0) {
      // Its gravity takes you: a last little rise, then you're swung over
      // and pulled down onto it, faster and faster
      const u = clamp(1 + A.t / ARR_PULL, 0, 1);
      theta = A.th0 + wrap(A.aim - A.th0) * smooth(u);
      // Close up, it fills the view: by touchdown it's as big as the world
      // you'll play on next, so there's nothing to change but the level
      if (A.next) A.gr = lerp(A.globe, R0, smooth(u));
      player.r = lerp(A.r0, A.R, u * u * u) + (A.r0 === A.R ? 0 : 150) * Math.sin(Math.PI * Math.min(1, u * 1.2));
      player.onGround = false; player.facing = wrap(A.aim - A.th0) > 0 ? 1 : -1;
      cam.r += (player.r - cam.r) * Math.min(1, dt * 10);
      shake = Math.max(shake, 1 + 4 * u * u);
    } else if (!A.down) {
      A.down = true; player.r = A.R; player.onGround = true; player.squash = 1; theta = A.aim;
      if (A.r0 !== A.R) { addShake(8); sfx.thud(); burst(-theta, A.R, ARRIVE[A.key].ground[0], 14, 160); }
    }
    if (A.t >= 0 && A.next) { goOn(); return; }
    if (A.t > ARR_SWAP && !A.started) { A.started = true; sfx.tier(); }
    const fall = clamp(0.45 / Math.sqrt(D.g), 0.45, 1.6);
    if (!A.landed && A.t > ARR_SWAP + 0.4 + fall) {
      A.landed = true; A.landT = A.t; addShake(6); sfx.thud();
      const col = D.ground[0];
      for (let i = 0; i < 22; i++) A.bits.push({ x: W / 2 + (Math.random() - 0.5) * 30, y: H * 0.74, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 200 * (D.g < 0.1 ? 0.5 : 1), t: 0, life: 1 + (D.g < 0.1 ? 1 : 0), c: col, g: 400 * Math.max(0.15, D.g) });
      toast(D.note, 7);
    }
    if (A.landed && A.t > A.landT + 1.1 && state === 'play') { playTime = A.time; win(); }
    for (const q of A.bits) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; }
    A.bits = A.bits.filter((q) => q.t < q.life);
  }
  function updateArriveFrame(dt) {
    updateArrive(dt);
    if (!fx.arrive) return; // carried straight on into the next level
    for (const q of particles) { q.R += q.vr * dt; q.a += (q.vt * dt) / q.R; q.vr -= 380 * dt; q.life -= dt; }
    particles = particles.filter((q) => q.life > 0);
    player.squash = Math.max(0, player.squash - dt * 4);
    for (const q of fx.pops) q.t += dt;
    fx.pops = fx.pops.filter((q) => q.t < 1.1);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 2.6) fx.banner = null; }
    shake = Math.max(0, shake - dt * 30);
    fx.flash = Math.max(0, fx.flash - dt * 1.5);
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0.4) hud.toast.style.opacity = '0';
      if (toastTimer <= 0) hud.toast.hidden = true;
    }
  }
  // The turn: how far round the view has swung (0 to π)
  const arriveTurn = () => { const A = fx.arrive; return A && A.t < ARR_SWAP ? Math.PI * smooth(clamp((A.t - ARR_TURN[0]) / (ARR_TURN[1] - ARR_TURN[0]), 0, 1)) : 0; };
  // Each world's own way of hiding the change: 0 to 1, peaking at the swap
  const coverK = (t) => (t < ARR_SWAP ? clamp((t - 0.4) / (ARR_SWAP - 0.5), 0, 1) : clamp(1 - (t - ARR_SWAP - 0.15) / 0.7, 0, 1));
  function drawArriveCover(A = fx.arrive) {
    const k = coverK(A.t), kind = ARRIVE[A.key].cover;
    if (k <= 0) return;
    if (kind === 'glare' || kind === 'daylight') {
      const g = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.4, Math.max(W, H));
      g.addColorStop(0, `rgba(255,255,245,${k})`); g.addColorStop(1, kind === 'glare' ? `rgba(255,220,140,${k * 0.9})` : `rgba(200,235,255,${k * 0.9})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(255,255,255,${k * 0.6})`; ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) { const a = i * 0.52 + clock * 0.3; ctx.beginPath(); ctx.moveTo(W / 2, H * 0.4); ctx.lineTo(W / 2 + Math.cos(a) * W, H * 0.4 + Math.sin(a) * W); ctx.stroke(); }
      return;
    }
    if (kind === 'fire') {
      // Hitting the thin Martian air: a wall of flame streaking past
      ctx.fillStyle = `rgba(255,120,40,${k * 0.85})`; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) {
        const x = (i * 97) % W, y = ((i * 53 + A.t * 900) % (H + 200)) - 100;
        ctx.fillStyle = i % 3 ? `rgba(255,220,120,${k})` : `rgba(255,255,230,${k})`;
        ctx.beginPath(); ctx.ellipse(x, y, 10 + (i % 4) * 6, 50 + (i % 5) * 20, 0, 0, TAU); ctx.fill();
      }
      return;
    }
    // Clouds of dust, acid cloud or rubble, billowing in to fill the view
    const col = kind === 'cloud' ? [242, 226, 160] : kind === 'dust' ? [190, 188, 200] : [120, 105, 90];
    for (let i = 0; i < 36; i++) {
      const sx = (i * 0.618 % 1) * W, sy = (i * 0.414 % 1) * H, r = (60 + (i % 5) * 30) * (0.3 + k * 1.2);
      const dx = Math.sin(i + A.t) * 20, dy = Math.cos(i * 1.3 + A.t * 1.2) * 16;
      ctx.fillStyle = `rgba(${col[0] - (i % 3) * 18},${col[1] - (i % 3) * 18},${col[2] - (i % 3) * 18},${Math.min(1, k * 1.1)})`;
      ctx.beginPath(); ctx.arc(sx + dx, sy + dy, r, 0, TAU); ctx.fill();
    }
    if (kind === 'rubble') for (let i = 0; i < 30; i++) px((i * 131 + A.t * 200) % W, (i * 71 + A.t * 140 * (i % 2 ? 1 : -1) + H * 2) % H, 5, 4, `rgba(60,55,50,${k})`);
  }
  // The world's real landscape, with you dropping onto it
  function drawArrival() {
    const A = fx.arrive, D = ARRIVE[A.key], key = A.key, gy = H * 0.74;
    const Rm = Math.max(W, H) * D.curve, mx = W / 2, my = gy + Rm;
    const yAt = (x) => my - Math.sqrt(Math.max(0, Rm * Rm - (x - mx) * (x - mx)));
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, D.sky[0]); sky.addColorStop(1, D.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const airless = D.sky[0] === '#000000';
    if (airless) for (const st of world.sky) px(st.x * W, st.y * gy, st.s, st.s, '#c9d7f0');
    // In the sky: Earth from the Moon, the huge Sun from Mercury, Mars's moons, and so on
    if (key === 'moon') drawGlobe(W * 0.72, H * 0.24, Math.min(W, H) * 0.09, clock * 0.02 + 0.4, 1, 0.3);
    else if (key === 'mercury') { const g = ctx.createRadialGradient(W * 0.25, H * 0.22, 20, W * 0.25, H * 0.22, 260); g.addColorStop(0, 'rgba(255,240,190,0.9)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, gy); ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(W * 0.25, H * 0.22, 56, 0, TAU); ctx.fill(); }
    else if (key === 'mars') { ctx.fillStyle = '#fff3e0'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.18, 12, 0, TAU); ctx.fill(); px(W * 0.3, H * 0.14, 5, 3, '#8a7a6a'); px(W * 0.55, H * 0.1, 3, 2, '#8a7a6a'); ctx.fillStyle = '#a5552f'; ctx.beginPath(); ctx.ellipse(W * 0.2, gy, W * 0.3, 70, 0, Math.PI, TAU); ctx.fill(); }
    else if (key === 'venus') { ctx.fillStyle = 'rgba(255,250,220,0.6)'; ctx.beginPath(); ctx.arc(W * 0.7, H * 0.2, 30, 0, TAU); ctx.fill(); }
    else if (key === 'earth') { ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.16, 24, 0, TAU); ctx.fill(); for (const [x, y] of [[0.2, 0.18], [0.5, 0.1]]) { ctx.fillStyle = '#ffffff'; for (const [ox, r] of [[0, 18], [20, 24], [42, 16]]) { ctx.beginPath(); ctx.arc(W * x + ox, H * y, r, 0, TAU); ctx.fill(); } } }
    else { drawJupiter(W * 0.76, H * 0.2, 9); ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(W * 0.2, H * 0.15, 6, 0, TAU); ctx.fill(); if (key === 'vesta') { ctx.fillStyle = '#7d7466'; ctx.beginPath(); ctx.moveTo(W * 0.45, yAt(W * 0.6) + 4); ctx.lineTo(W * 0.62, gy - 150); ctx.lineTo(W * 0.68, gy - 140); ctx.lineTo(W * 0.85, yAt(W * 0.85) + 4); ctx.fill(); } }
    // The ground: curved by the size of the world, with its own surface
    const gg = ctx.createLinearGradient(0, gy - 40, 0, H);
    gg.addColorStop(0, D.ground[0]); gg.addColorStop(1, D.ground[1]);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(mx, my, Rm, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(mx, my, Rm, 0, TAU); ctx.clip();
    for (let row = 0; row < 6; row++) {
      const depth = row / 5, yb = gy + 8 + Math.pow(depth, 1.5) * (H - gy), sc = 0.4 + depth * 1.3;
      for (let i = 0; i < 9 + row * 2; i++) {
        const h = Math.sin(i * 12.9898 + row * 78.233) * 43758.5453, fr = h - Math.floor(h);
        const x = ((i + fr) / (9 + row * 2)) * W, y = Math.max(yb, yAt(x) + 6), r = (6 + fr * 14) * sc;
        if (key === 'venus') { ctx.fillStyle = 'rgba(255,248,220,0.6)'; ctx.beginPath(); ctx.arc(x, y, r * 1.4, 0, TAU); ctx.fill(); }
        else if (key === 'earth') { if (fr > 0.6) { px(x - 2, y - 10 * sc, 4 * sc, 10 * sc, '#6b4226'); ctx.fillStyle = '#3aa047'; ctx.beginPath(); ctx.arc(x, y - 14 * sc, 9 * sc, 0, TAU); ctx.fill(); } else px(x, y, 3, 2, '#3a8f3a'); }
        else if (key === 'mars') { ctx.fillStyle = fr > 0.5 ? '#5a2418' : 'rgba(255,200,160,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, r * (fr > 0.5 ? 0.6 : 1.4), r * 0.3, 0, 0, TAU); ctx.fill(); }
        else {
          // Craters, lit from one side; on Ceres some are bright with salt
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.25 + depth * 0.2), 0, 0, TAU); ctx.fill();
          ctx.fillStyle = key === 'ceres' && fr > 0.85 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(x + r * 0.2, y + r * 0.06, r * 0.8, r * (0.18 + depth * 0.15), 0, 0, Math.PI); ctx.fill();
        }
      }
    }
    ctx.restore();
    // A few things standing on it
    if (key === 'venus') { for (const x of [W * 0.2, W * 0.82]) { ctx.fillStyle = 'rgba(191,232,255,0.6)'; ctx.beginPath(); ctx.arc(x, yAt(x), 36, Math.PI, TAU); ctx.fill(); px(x - 44, yAt(x), 88, 8, '#d6dce8'); } }
    if (key === 'earth') { for (const x of [W * 0.18, W * 0.84]) { const y = yAt(x); px(x - 16, y - 24, 32, 24, '#f2e6d0'); ctx.fillStyle = '#b8403a'; ctx.beginPath(); ctx.moveTo(x - 20, y - 24); ctx.lineTo(x, y - 40); ctx.lineTo(x + 20, y - 24); ctx.fill(); } }
    if (key === 'mars') { const x = W * 0.8, y = yAt(x); px(x - 20, y - 14, 40, 10, '#e8e4dc'); px(x - 4, y - 26, 4, 12, '#9aa3b5'); for (const wx of [-16, 0, 16]) { ctx.fillStyle = '#3b3b4f'; ctx.beginPath(); ctx.arc(x + wx, y - 3, 4, 0, TAU); ctx.fill(); } }
    // You, dropping down (slowly where gravity is weak), then standing proud
    const fall = clamp(0.45 / Math.sqrt(D.g), 0.45, 1.6), k = clamp((A.t - ARR_SWAP - 0.4) / fall, 0, 1);
    const y = lerp(-60, gy, k * k), sq = A.landed ? Math.max(0, 1 - (A.t - A.landT) * 4) : 0;
    const pal = level === 1 && !player.suit ? PAL : SUIT;
    drawSprite(A.landed ? 'stand' : 'jump', W / 2, y, false, 1 - sq * 0.25, 1 + sq * 0.2, 1, pal);
    if (conspiracy) drawFoilHat(W / 2, y, 0);
    if (A.landed && key !== 'venus' && key !== 'earth') { px(W / 2 + 30, gy - 40, 3, 40, '#e8e8f0'); px(W / 2 + 33, gy - 40, 22, 14, '#e0433b'); px(W / 2 + 36, gy - 36, 6, 6, '#ffd23f'); }
    for (const q of A.bits) { ctx.globalAlpha = 1 - q.t / q.life; px(q.x - 3, q.y - 3, 6, 6, q.c); }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawArriveCover();
  }
  // ---- Secret: conspiracy mode ---------------------------------------------------
  // Click the shooting star that crosses the title screen to switch it on. The
  // tramp gets a tinfoil hat, the odd prop turns up (a film set on the Moon,
  // the Face on Mars), and "classified files" pop up on the way: a famous
  // conspiracy theory, then what's really true.
  const FILES = {
    1: [
      ['The Earth is flat.', 'From up here you can see the curve. The ancient Greeks knew Earth was round over 2,000 years ago, from the round shadow it casts on the Moon.'],
      ['Plane trails are secret chemicals ("chemtrails").', 'Contrails are water vapour from the engines freezing into ice crystals, like your breath on a cold day.'],
      ["Birds aren't real: they're government drones.", "Birds are real. \"Birds Aren't Real\" started in 2017 as a joke, poking fun at conspiracy theories."],
      ['The Moon landings were filmed in a studio.', 'Apollo astronauts left mirrors on the Moon, and observatories still bounce lasers off them today.'],
    ],
    2: [
      ["The flag was waving, so there's air: it was faked!", 'A rod along the top held the flag out, and with no air to slow it, it kept wobbling after it was twisted into the ground.'],
      ["There's a secret base on the dark side of the Moon.", "There's no dark side: the far side gets just as much sunshine. We just never see it from Earth."],
      ['NASA is hiding an alien city on Mars.', 'The rovers and orbiters have sent home huge numbers of pictures, free for anyone to look at.'],
    ],
    3: [
      ['The Face on Mars was built by aliens.', 'In 1976 Viking 1 photographed a hill that looked like a face. Sharper pictures in 1998 and 2001 showed it was just a hill.'],
      ['Planet Nibiru is coming to smash into Earth.', 'Astronomers track every planet and millions of asteroids. A planet heading our way would be one of the brightest things in the sky.'],
      ["There's a giant alien ship hiding in the asteroid belt.", "Spacecraft have flown through the belt many times. The biggest things in it are Ceres and Vesta, and they're definitely rocks."],
    ],
    4: [
      ['Mercury in retrograde ruins your week.', 'Mercury only looks like it goes backwards for a few weeks, as speedy Mercury overtakes Earth on the inside track. Nothing changes down here.'],
      ['Venus is hollow, and full of aliens.', "The Magellan probe mapped 98% of Venus's surface by radar in the 1990s: rock, volcanoes and lava plains."],
      ['Someone controls the weather from space.', 'Weather is driven by the Sun heating the air and the oceans. No satellite can steer it.'],
    ],
    5: [
      ["Jupiter is a failed star that's about to light up.", 'Jupiter would need about 80 times more mass to start burning like a star. It isn\'t going to.'],
      ['The Great Red Spot is a giant alien eye.', "It's a storm wider than Earth, and it's been raging for at least 150 years."],
      ["There's a black monolith on Europa.", "That's from 2010: Odyssey Two, a novel by Arthur C. Clarke. But Europa really might have an ocean under its ice!"],
    ],
  };
  let conspiracy = false;
  function nextFile() {
    const list = FILES[level] || [];
    fx.fileK = fx.fileK || 0;
    if (fx.fileK >= list.length) return false;
    const [claim, truth] = list[fx.fileK++];
    toast(`📁 CLASSIFIED FILE: "${claim}"  THE TRUTH: ${truth}`, 7.5);
    pop('FILE FOUND!', '#8fff6a', player.r + 150);
    return true;
  }
  // A tinfoil hat, worn on the tramp's head (same place and turn as the sprite)
  function drawFoilHat(x, y, rot = 0, flip = false) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (rot) { ctx.translate(0, -24); ctx.rotate(rot); ctx.translate(0, 24); }
    if (flip) ctx.scale(-1, 1);
    ctx.fillStyle = '#b9bfcc';
    ctx.beginPath(); ctx.moveTo(-11, -41); ctx.lineTo(11, -41); ctx.lineTo(2, -64); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eef1f7';
    ctx.beginPath(); ctx.moveTo(-6, -42); ctx.lineTo(-1, -42); ctx.lineTo(1, -58); ctx.closePath(); ctx.fill();
    px(-12, -43, 24, 3, '#9aa3b5');
    if (Math.sin(clock * 3) > 0.6) px(1, -66, 3, 3, '#ffffff');
    ctx.restore();
  }
  // The black slab: on Europa (conspiracy mode only), and on Mars as before
  function drawMonolith(x, y) {
    px(x - 9, y - 58, 18, 58, '#0c0c12'); px(x - 9, y - 58, 2, 58, '#3a3a4a');
  }
  // Props that only turn up in conspiracy mode, drawn standing on the ground
  function drawConspiracyProps() {
    if (!conspiracy) return;
    const stand = (a, fn, m = 200) => at(a + theta, R0 - 2 + (level === 2 ? surfAt(a) : 0), fn, m);
    if (level === 1) {
      stand(-0.6, () => {
        // A flat-earther's placard, and a robot bird on a post
        px(-1, -40, 3, 40, '#6b4226'); px(-46, -64, 92, 26, '#f2e6d0'); px(-46, -64, 92, 3, '#c9a27a');
        ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#b8403a';
        ctx.fillText('THE EARTH', 0, -53); ctx.fillText('IS FLAT', 0, -43); ctx.textAlign = 'start';
      });
      stand(0.75, () => {
        px(-1, -44, 3, 44, '#6b4226');
        px(-8, -54, 14, 10, '#7d869a'); px(4, -52, 6, 3, '#ffab3d'); px(-2, -51, 3, 3, Math.sin(clock * 6) > 0 ? '#ff5a4a' : '#3b3b4f');
        px(-1, -62, 1, 8, '#9aa3b5'); px(-2, -63, 3, 2, '#ff5a4a');
        ctx.font = '5px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#eef1ff'; ctx.fillText('BIRD?', 0, -70); ctx.textAlign = 'start';
      });
    } else if (level === 2) {
      // A film set next to the base: two big lamps, a camera on a dolly and
      // the director's chair
      stand(0.42, () => {
        for (const x of [-60, 60]) {
          px(x - 1, -50, 3, 50, '#3b3b4f'); px(x - 8, -2, 16, 2, '#3b3b4f');
          ctx.save(); ctx.translate(x, -56); ctx.rotate(x < 0 ? 0.5 : -0.5);
          px(-9, -7, 18, 14, '#2a2a36'); px(-7, -5, 14, 10, '#fff3b0');
          ctx.restore();
        }
        px(-12, -26, 22, 14, '#2a2a36'); ctx.fillStyle = '#2a2a36'; ctx.beginPath(); ctx.arc(-8, -32, 6, 0, TAU); ctx.arc(4, -32, 6, 0, TAU); ctx.fill();
        px(10, -22, 8, 6, '#3b3b4f'); px(-4, -12, 3, 10, '#5a5a6a'); px(-14, -2, 24, 3, '#5a5a6a');
        px(26, -24, 18, 3, '#7a4a28'); px(26, -16, 18, 3, '#7a4a28'); px(26, -24, 2, 24, '#7a4a28'); px(42, -24, 2, 24, '#7a4a28');
        px(25, -30, 20, 7, '#1b1530');
        ctx.font = '4px "Press Start 2P", monospace'; ctx.fillStyle = '#ffd23f'; ctx.fillText('DIRECTOR', 25.5, -25);
      }, 260);
    } else if (level === 3) {
      // The Face on Mars: a mesa with a face, if you squint
      stand(2.7, () => {
        ctx.fillStyle = '#9a4a32';
        ctx.beginPath(); ctx.moveTo(-80, 2); ctx.quadraticCurveTo(-70, -66, 0, -70); ctx.quadraticCurveTo(70, -66, 80, 2); ctx.fill();
        ctx.fillStyle = '#5e2a1c';
        ctx.beginPath(); ctx.ellipse(-22, -44, 10, 6, 0, 0, TAU); ctx.ellipse(22, -44, 10, 6, 0, 0, TAU); ctx.fill();
        px(-3, -40, 6, 16, '#7a3a26'); px(-20, -16, 40, 5, '#5e2a1c');
        ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff1e0'; ctx.fillText('THE FACE ON MARS?', 0, -80); ctx.textAlign = 'start';
      }, 260);
    }
  }

  // ---- Conspiracy mode, level 6: the hollow Earth ------------------------------------
  // Crash into the Earth as a fireball (or pick it from the menu) and you smash
  // right through the crust into the hollow Earth: a round world inside the
  // world, with a little sun at its centre. Climb back out through its caverns,
  // ring after ring, past things from the old stories (Burroughs' Pellucidar,
  // Verne's underground sea, Wells' Morlocks) and the conspiracy theories
  // (Agartha, the lizard people).
  const HOLLOW = [
    { key: 'pellucidar', name: 'Pellucidar', tiers: 3, plat: 'fern', col: '#2a3a1a',
      note: "Edgar Rice Burroughs' Pellucidar (1914): a land inside the Earth, lit by a sun that never sets and ruled by flying reptiles called Mahars. For real, nobody has been deeper than about 4 km, at the bottom of a South African gold mine." },
    { key: 'sea', name: 'The Lidenbrock Sea', tiers: 4, plat: 'raft', col: '#10303a',
      note: 'Jules Verne put a whole sea down here, with sea monsters fighting in it, in Journey to the Centre of the Earth (1864). For real: deep down, a mineral called ringwoodite may hold as much water as all the oceans, locked inside its crystals.' },
    { key: 'agartha', name: 'Agartha', tiers: 4, plat: 'gold', col: '#2a2010',
      file: ['A golden city called Agartha lies at the centre of the Earth, reached through holes at the poles.', 'Satellites have mapped both poles in detail. There are no holes, just ice.'] },
    { key: 'crystal', name: 'The crystal caves', tiers: 3, plat: 'crystal', col: '#1a1430',
      note: "For real: Mexico's Cave of the Crystals is full of gypsum crystals up to 12 m long. These ones shatter when you bounce on them!", note2: 'The lights on the ceiling are glow-worms, like the ones in New Zealand caves: tiny larvae that glow to lure insects into their sticky threads.' },
    { key: 'fungus', name: 'The fungus forest', tiers: 3, plat: 'sway', col: '#10261a',
      note: 'For real: the biggest living thing known is a fungus. A honey fungus in Oregon spreads underground across nearly 10 square km.', note2: 'In that pool: an olm, a blind, pale cave salamander from Slovenia. Olms can live for over 100 years, and go years without eating.' },
    { key: 'morlock', name: 'The Morlock works', tiers: 4, plat: 'girder', col: '#14161c',
      note: "In H.G. Wells' The Time Machine (1895), the pale, big-eyed Morlocks live underground among their great machines, and only come up at night. Mind the steam!" },
    { key: 'lava', name: 'The lava tubes', tiers: 3, plat: 'rock', col: '#2a0e08',
      note: 'For real: lava tubes are tunnels left behind when the outside of a lava flow cools and the inside drains away. Some run for tens of km. Watch the lava jets!' },
    { key: 'city', name: 'Lizard city', tiers: 4, plat: 'neon', col: '#0e1218',
      file: ['Lizard people secretly run the world from underground.', 'The deepest hole ever drilled, the Kola Superdeep Borehole, goes down 12.3 km. It found hot rock and water. No lizards.'],
      note2: "The drilling machines are a nod to the Iron Mole, which tunnels down to Pellucidar in Burroughs' At the Earth's Core." },
    { key: 'shaft', name: 'The way out', tiers: 3, plat: 'ledge', col: '#241a12',
      note: 'For real: the deepest known cave, Veryovkina in Georgia, goes down about 2.2 km. Daylight ahead!' },
  ];
  const HOLLOW_TIERS = (() => {
    const T = [{ km: 30, type: 'mush', layer: 'Pellucidar', g: 0.65 }];
    const n = HOLLOW.reduce((s, Z) => s + Z.tiers, 0);
    HOLLOW.forEach((Z, z) => {
      for (let i = 0; i < Z.tiers; i++) {
        const k = T.length;
        T.push({ km: 30 * (1 - k / (n + 1)), type: Z.plat, layer: Z.name, zone: z, g: 0.65,
          note: i === 0 ? (Z.file ? `📁 CLASSIFIED FILE: "${Z.file[0]}"  THE TRUTH: ${Z.file[1]}` : Z.note) : i === 1 ? Z.note2 : undefined });
      }
    });
    T.push({ km: 0, type: 'hole', layer: 'The surface', zone: HOLLOW.length - 1 });
    return T;
  })();
  const hollowZone = (k) => (HOLLOW_TIERS[clamp(Math.round(k), 0, HOLLOW_TIERS.length - 1)].zone ?? 0);
  // The rock shell between two caverns sits halfway between their layers
  const zoneBase = (z) => { const k = HOLLOW_TIERS.findIndex((t) => t.zone === z && t.layer !== 'The surface'); return z === 0 ? R0 : (tierR(k) + tierR(k - 1)) / 2; };
  function buildWorld6(seed) {
    const rnd = mulberry32(seed);
    const plats = [], stars = [], beams = [], movers = [], decor = [], gaps = [];
    const T = HOLLOW_TIERS;
    const SWAY = new Set(['raft', 'sway', 'gold']);
    const mk = (tier, a, type = T[tier].type) => {
      const g = T[tier].g || 0.65;
      const p = { tier, a, a0: a, type, g, R: tierR(tier), w: WIDTH[type] || 120, bounce: speedFor(tier) * Math.sqrt(2 * G * g * (TIER_GAP + OVERSHOOT)), squash: 0, jig: 9, hit: 0, sway: 0, freq: 0, phase: 0, spin: rnd() * TAU, dir: rnd() < 0.5 ? -1 : 1 };
      if (SWAY.has(type) && tier > 0) { p.sway = (30 + rnd() * 40) / p.R; p.freq = 0.3 + rnd() * 0.3; p.phase = rnd() * TAU; }
      plats.push(p);
      return p;
    };
    for (const a of [0.45, -0.75, 2.2]) mk(0, a, 'mush').main = true;
    const pathA = [0.45];
    let prevA = 0.45;
    for (let k = 1; k <= TOP; k++) {
      const R = tierR(k), t = T[k], z = t.zone, Z = HOLLOW[z];
      const a = prevA + ((110 + (rnd() * 200) / Math.sqrt(speedFor(k - 1))) * (rnd() < 0.7 ? 1 : -1)) / R;
      pathA.push(a);
      if (k === TOP) { const d = mk(k, a, 'hole'); d.main = true; d.dest = true; break; }
      const mp = mk(k, a); mp.main = true;
      stars.push({ a: prevA + (a - prevA) * 0.62, R: R + 50, taken: false });
      for (let i = 0; i < (k < 4 ? 2 : 3); i++) {
        const ea = a + ((240 + rnd() * 420) * (i % 2 ? -1 : 1)) / R;
        mk(k, ea, Z.plat === 'crystal' && rnd() < 0.5 ? 'sway' : Z.plat);
        if (rnd() < 0.45) stars.push({ a: ea, R: R + 140, taken: false });
      }
      // Each cavern's own danger
      if (Z.key === 'lava') for (const side of [-1, 1]) beams.push({ a: a + (side * (120 + rnd() * 80)) / R, tier: k, period: 3.2 + rnd() * 1.4, phase: rnd() * 4, route: null, kind: 'lava' });
      if (Z.key === 'morlock' && k % 2 === 0) beams.push({ a: a + ((rnd() < 0.5 ? -1 : 1) * (130 + rnd() * 60)) / R, tier: k, period: 3.6 + rnd(), phase: rnd() * 4, route: null, kind: 'steam' });
      if (Z.key === 'city' && k % 2 === 1) movers.push({ kind: 'mole', a0: a, R: R + 140, amp: 420, sp: 0.5 + rnd() * 0.3, ph: rnd() * TAU, r: 26, flash: 0, cool: 0 });
      if ((Z.key === 'crystal' || Z.key === 'shaft') && k < TOP - 1) movers.push({ kind: 'bats', a0: a, R: R + 130, amp: 520, sp: 0.6 + rnd() * 0.3, ph: rnd() * TAU, r: 30, flash: 0, cool: 0 });
      prevA = a;
    }
    stars.forEach((st, i) => { st.id = i; });
    // Each cavern's floor is a crust of its own, right round, that you can
    // land on and walk about (and drop through its gap to the one below).
    // On it, a whole town: a back row of tall shapes for depth, a front row of
    // buildings, and people and creatures wandering about. Some are real
    // places underground; walk up to them to hear about them.
    const shells = [];
    const CITY = {
      pellucidar: { front: ['treefern', 'stilthut', 'fernbush', 'treefern', 'rocks', 'hut'], back: 'jungle', walk: ['dino', 'dino', 'sagoth'], gap: 120 },
      sea: { front: ['stilthut', 'boat', 'bigmush', 'rocks', 'lighthouse', 'nets'], back: 'cliff', walk: ['mastodon', 'mastodon', 'shepherd'], gap: 130 },
      agartha: { front: ['temple', 'dome', 'spire', 'ziggurat', 'vril', 'dome'], back: 'goldtower', walk: ['agarthan', 'agarthan'], gap: 110 },
      crystal: { front: ['crystals', 'saltstatue', 'crystals', 'minehead', 'crystals'], back: 'crystalspire', walk: ['miner', 'miner'], gap: 110 },
      fungus: { front: ['carved', 'mushfarm', 'bigmush', 'carved', 'rollstone'], back: 'mesa', walk: ['villager', 'goat', 'villager'], gap: 115 },
      morlock: { front: ['machine', 'wellshaft', 'conveyor', 'factory', 'machine'], back: 'chimney', walk: ['morlock', 'morlock', 'morlock'], gap: 120 },
      lava: { front: ['dugout', 'minehead', 'opals', 'lavarock', 'dugout'], back: 'volcano', walk: ['minecart', 'opalminer'], gap: 120 },
      city: { front: ['tower', 'neonsign', 'lifttower', 'tower', 'kiosk'], back: 'skyscraper', walk: ['lizard', 'lizard', 'lizard'], gap: 100 },
      shaft: { front: ['bunker', 'lantern', 'tunnelsign', 'bunker', 'crates'], back: 'tunnelmouth', walk: ['shelterer', 'shelterer'], gap: 120 },
    };
    const SIGNS = ['LIZARD HQ', 'NOTHING TO SEE HERE', 'AREA 52', 'HUMANS: KEEP OUT', 'WE ARE NOT HERE', 'REPTILE SPA', 'SCALES R US'];
    const REAL = {
      pellucidar: ['sign', 'HANG SON DOONG?', "For real: Vietnam's Hang Son Doong, the biggest cave known, is so huge it has its own jungle inside, and even its own clouds."],
      fungus: ['carved', '', 'For real: Derinkuyu in Turkey is a city dug out of soft rock, at least 8 levels and 85 m deep, with wells, stables, chapels and air shafts. It could shelter around 20,000 people, with their animals.'],
      crystal: ['saltchapel', '', "For real: St Kinga's Chapel in Poland's Wieliczka salt mine, 101 m down, is carved entirely from salt: the walls, the altar, even the chandeliers."],
      lava: ['dugout', '', 'For real: in Coober Pedy, an opal-mining town in the Australian desert, about half the people live underground in "dugouts", where it stays around 23°C while it\'s 37°C up top.'],
      shaft: ['bunker', '', "For real: under Beijing is Dixia Cheng, a Cold War tunnel city dug from 1969 to 1979 to shelter people from war, with shops, cinemas and even a mushroom farm."],
    };
    HOLLOW.forEach((Z, z) => {
      const k0 = T.findIndex((t) => t.zone === z), base = zoneBase(z), top = z < HOLLOW.length - 1 ? zoneBase(z + 1) : tierR(TOP) + 200;
      const around = pathA[Math.max(0, k0 - 1)];
      const shell = z > 0 ? { R: base, zone: z, gapA: (pathA[k0 - 1] + pathA[k0]) / 2, gapW: 380 / base } : null;
      if (shell) shells.push(shell);
      const inGap = (a) => shell && Math.abs(wrap(a - shell.gapA)) < shell.gapW / 2 + 40 / base;
      const C = CITY[Z.key];
      // The back row, then the front row, right round the floor
      for (let a = rnd() * 0.05; a < TAU; a += (C.gap * 1.6 + rnd() * C.gap) / base) if (!inGap(a)) decor.push({ a, R: base, kind: C.back, back: true, h: 0.6 + rnd() * 0.8, ph: rnd() * 9, size: 0.8 + rnd() * 0.5 });
      for (let a = rnd() * 0.05; a < TAU; a += (C.gap + rnd() * C.gap * 0.8) / base) {
        if (inGap(a)) continue;
        const kind = C.front[Math.floor(rnd() * C.front.length)];
        decor.push({ a, R: base, kind, size: 0.75 + rnd() * 0.5, h: 120 + rnd() * 160, ph: rnd() * 9, text: kind === 'neonsign' ? SIGNS[Math.floor(rnd() * SIGNS.length)] : '' });
      }
      // A real underground place, close to where you arrive
      if (REAL[Z.key]) {
        const [kind, text, note] = REAL[Z.key];
        const a = around + (inGap(around + 200 / base) ? -200 : 200) / base;
        decor.push({ a, R: base, kind, size: 1.2, h: 200, ph: 1, text, col: '#ffd23f', note, real: true });
      }
      // Lakes on the sea floor, and pools of lava in the tubes, each with life in them
      if (Z.key === 'sea' || Z.key === 'lava') {
        for (let i = 0; i < 10; i++) {
          const a = around + ((i - 5) * 900 + rnd() * 300) / base;
          if (!inGap(a)) decor.push({ a, R: base, kind: Z.key === 'sea' ? 'lake' : 'lavapool', w: 160 + rnd() * 140, ph: rnd() * 9, beast: Z.key === 'sea' ? (i % 3 === 0 ? 'plesio' : i % 3 === 1 ? 'ichthyo' : 'fish') : 'bubbles' });
        }
      }
      // People and creatures wandering about near the way
      for (let i = 0; i < 22; i++) {
        const a0 = around + ((rnd() - 0.5) * 5000) / base;
        if (inGap(a0)) continue;
        const kind = C.walk[Math.floor(rnd() * C.walk.length)];
        decor.push({ a: a0, R: base, kind, walker: true, ph: rnd() * 9, drive: { a0, span: (60 + rnd() * 200) / base, w: (kind === 'minecart' ? 0.5 : 0.2) + rnd() * 0.3, ph: rnd() * TAU } });
      }
      // From the roof: waterfalls, glow-worms, roots, Morlock eyes, flying things
      const roof = (n, fn) => { for (let i = 0; i < n; i++) { const a = around + ((rnd() - 0.5) * 4200) / top; fn(a); } };
      if (Z.key === 'sea' || Z.key === 'fungus' || Z.key === 'agartha') roof(6, (a) => decor.push({ a, R: top, kind: 'waterfall', len: top - base - 10, w: 14 + rnd() * 18, gold: Z.key === 'agartha' }));
      if (Z.key === 'lava') roof(5, (a) => decor.push({ a, R: top, kind: 'waterfall', len: top - base - 10, w: 16 + rnd() * 16, lava: true }));
      if (Z.key === 'crystal') roof(40, (a) => decor.push({ a, R: top, kind: 'glowworm', len: 20 + rnd() * 70 }));
      if (Z.key === 'crystal') roof(6, (a) => decor.push({ a, R: top, kind: 'chandelier', len: 40 + rnd() * 30, ph: rnd() * 9 }));
      if (Z.key === 'shaft' || Z.key === 'fungus') roof(30, (a) => decor.push({ a, R: top, kind: 'root', len: 30 + rnd() * 90 }));
      if (Z.key === 'morlock') roof(16, (a) => decor.push({ a, R: base, kind: 'eyes', ph: rnd() * 9 }));
      if (Z.key === 'pellucidar') roof(6, (a) => decor.push({ a, R: R0 + 260 + rnd() * 400, kind: 'mahar', ph: rnd() * TAU }));
      if (Z.key === 'pellucidar') roof(5, (a) => decor.push({ a, R: R0 + 160 + rnd() * 500, kind: 'mist', ph: rnd() * 9, w: 120 + rnd() * 160 }));
      if (Z.key === 'agartha') roof(3, (a) => decor.push({ a, R: base + 200 + rnd() * 300, kind: 'vimana', ph: rnd() * 9 }));
      if (Z.key === 'city') roof(2, (a) => decor.push({ a, R: base + 230, kind: 'monorail', ph: rnd() * 9 }));
      if (Z.key === 'pellucidar') decor.push({ a: 0.2, R: R0, kind: 'sign', text: 'PELLUCIDAR', col: '#8fff6a' });
      if (Z.key === 'agartha') decor.push({ a: around + 320 / base, R: base, kind: 'sign', text: 'AGARTHA', col: '#ffd23f' });
    });
    const sky = [];
    for (let i = 0; i < 160; i++) sky.push({ x: rnd(), y: rnd(), s: rnd() < 0.15 ? 2 : 1, tw: rnd() * TAU });
    return { seed, plats, stars, decor, crust: [], swirls: [], sky, ranges: [], issPlat: null, beams, dust: [], movers, shells };
  }
  // In from a crash on level 1: the score comes too
  // Conspiracy mode: hit the ground as a fireball and you don't stop. You
  // smash through the crust, burrow down through solid rock, burst out of
  // the roof of the topmost cavern and fall all the way down through the
  // hollow Earth, crashing through each cavern's floor, to the inner sun.
  function startBurrow() {
    fx.burrow = { phase: 1, t: 0, v: 950 };
    player.onGround = false; player.heat = 0; fx.flames = [];
    fx.flash = 0.8; addShake(16); sfx.boom(1); buzz([60, 40, 120]);
    burst(-theta, R0, '#8a5a3b', 30, 420); ring(-theta, R0, '#ff8a3a', 2);
    banner('SMASH!', "IT'S... HOLLOW?!");
  }
  function updateBurrow(dt) {
    const B = fx.burrow;
    B.t += dt;
    if (state === 'play') playTime += dt;
    B.v = Math.max(650, B.v - 300 * dt);
    player.r -= B.v * dt; player.vr = -B.v; player.onGround = false; player.spin = 0;
    cam.r += (player.r - cam.r) * Math.min(1, dt * 12); cam.anchor = lerp(cam.anchor || 0.46, 0.4, Math.min(1, dt * 3));
    if (Math.random() < dt * 30) burst(-theta + (Math.random() - 0.5) * 0.05, player.r + 30, Math.random() < 0.5 ? '#6b5440' : '#4a3a2a', 3, 200);
    for (const q of particles) { q.R += q.vr * dt; q.a += (q.vt * dt) / q.R; q.vr -= 380 * dt; q.life -= dt; }
    particles = particles.filter((q) => q.life > 0);
    for (const q of fx.pops) q.t += dt;
    fx.pops = fx.pops.filter((q) => q.t < 1.1);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 2.6) fx.banner = null; }
    shake = Math.max(shake * 0.9, 3); fx.flash = Math.max(0, fx.flash - dt * 1.5);
    if (player.r < R0 - 380) enterHollowEarth();
  }
  const hollowOuter = () => tierR(TOP) + 260;
  function enterHollowEarth() {
    const got = routeStars().filter((s) => s.taken).length;
    startGame(6, { score, mult, time: playTime, got, total: routeStars().length, falls, trail: ['Earth'] });
    // Still in the rock, just above the topmost cavern's roof, and falling
    player.r = hollowOuter() + 260; player.vr = -950; player.onGround = false; player.apexR = player.r;
    cam.r = player.r; cam.anchor = 0.4;
    fx.drop = true; fx.burrow = { phase: 2 };
    toast('You smashed straight through the crust… into the HOLLOW EARTH, with a little sun at its middle! Down you go, through every cavern. Then climb back out.', 7);
  }
  // Solid rock rushing past while you burrow through it
  function drawRock(k) {
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = '#2a2018'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const x = (i * 0.618 % 1) * W, sz = 6 + (i % 5) * 6, y = H + 40 - ((i * 97 + clock * 1100) % (H + 80));
      px(x - sz / 2, y, sz, sz * 0.7, i % 3 ? '#4a3a2a' : '#6b5440');
      if (i % 7 === 0) px(x - 1, y - 30, 2, 24, 'rgba(255,140,60,0.5)');
    }
    // The hole you're making, glowing round you
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.4, 120);
    g.addColorStop(0, 'rgba(255,170,90,0.35)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const rockK = () => {
    const B = fx.burrow;
    if (!B) return 0;
    if (B.phase === 1) return clamp((R0 - player.r) / 240, 0, 1);
    return level === 6 ? clamp((player.r - hollowOuter() + 30) / 240, 0, 1) : 0;
  };
  const ZONE_GLOW = ['#8fff6a', '#6ac4d8', '#ffd23f', '#b8a8ff', '#b8ff6a', '#ff6a3a', '#ff8a1a', '#ff6ad5', '#e8c88a'];
  const shellGap = (sh) => Math.abs(wrap(-theta - sh.gapA)) < sh.gapW / 2;
  // Landing on a cavern's floor: from a fall it costs the multiplier, and the
  // arrow points you back up from there
  function landShell(sh) {
    const k0 = HOLLOW_TIERS.findIndex((t) => t.zone === sh.zone), fell = lastTier >= k0, col = ZONE_GLOW[sh.zone];
    Object.assign(player, { r: sh.R, vr: 0, onGround: true, squash: 1, lastPlat: null, lastH: 0, heat: 0, hopLock: 0 });
    fx.whistled = false;
    if (fell) { falls++; loseMult(); toast(`Back down on the floor of ${HOLLOW[sh.zone].name}. Walk under a platform to hop back up.`, 3.5); }
    lastTier = k0 - 1;
    sfx.thud(); addShake(fell ? 9 : 4);
    burst(-theta, sh.R, '#b8a080', 14, 200); burst(-theta, sh.R, col, 10, 160); ring(-theta, sh.R, col, 1.4);
    for (let i = 0; i < 10; i++) fx.puffs.push({ a: -theta, R: sh.R + 4, vt: (Math.random() - 0.5) * 260, vr: 20 + Math.random() * 90, r: 5 + Math.random() * 8, t: 0, life: 0.9, nlc: false, dust: true });
    hollowStartle(sh.R);
  }
  // Creatures near where you land jump in surprise
  function hollowStartle(R) {
    for (const d of world.decor) if (d.walker && Math.abs(d.R - R) < 420 && Math.abs(wrap(d.a + theta)) * d.R < 320) d.hopT = clock + Math.random() * 0.2;
  }
  // Level 6 each frame: the movers (bats, the Iron Mole drills), and crystals
  // that shatter under you and grow back
  function updateHollow(dt, collide) {
    if (!player.onGround && player.vr > 300 && Math.random() < dt * 24) particles.push({ a: -theta + (Math.random() - 0.5) * 16 / player.r, R: player.r + 10 + Math.random() * 30, vt: (Math.random() - 0.5) * 60, vr: -60 - Math.random() * 60, life: 0.6, color: ZONE_GLOW[hollowZone(tierFloat(player.r))], size: 2 + Math.floor(Math.random() * 2) * 2 });
    for (const q of world.movers || []) {
      q.a = q.a0 + (q.amp * Math.sin(clock * q.sp + q.ph)) / q.R;
      collide(q, () => { q.cool = 0.6; q.flash = 1; spaceHit(q.kind === 'bats' ? 'BATS!' : 'DRILLED!', true); });
    }
    for (const p of world.plats) {
      if (p.type !== 'crystal') continue;
      if (p.breakAt && !p.broken && clock > p.breakAt) { p.broken = true; p.backAt = clock + 5; burst(p.a, p.R + 10, '#6dd3ff', 16, 200); sfx.thud(); }
      else if (p.broken && clock > p.backAt) { p.broken = false; p.breakAt = 0; }
    }
  }
  // ---- Level 6 drawing ----------------------------------------------------------------
  // The screen behind everything takes the colour of the cavern you're in
  function drawHollowSky() {
    const z = hollowZone(tierFloat(player.r)), Z = HOLLOW[z];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hexOf(mix(Z.col, '#000000', 0.35))); g.addColorStop(1, Z.col);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Specks of light drifting in the dark
    for (const st of world.sky) {
      let x = (st.x * W - theta * 300) % W; if (x < 0) x += W;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(clock * 1.5 + st.tw);
      px(x, st.y * H, st.s, st.s, z === 2 ? '#ffd23f' : z === 3 ? '#9fe0ff' : '#b8ff6a');
    }
    ctx.globalAlpha = 1;
  }
  // The round world: each cavern a ring round the inner sun, in its own
  // colour, with a shell of rock between one and the next
  // Each cavern's own far-off walls, in two layers that slide by slower than
  // the world (parallax). Each is drawn only inside its own cavern's ring, so
  // when two caverns are on screen each shows its own, and nothing switches.
  const hash3 = (a, b, c) => { const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return h - Math.floor(h); };
  function drawCavernParallax(z, Rin, Rout) {
    const Z = HOLLOW[z], key = Z.key, anchorY = cy - cam.r, glow = ZONE_GLOW[z];
    // Four layers, from the far wall to the near one, each sliding past at its
    // own speed: further back is smaller, closer together, darker and hazier
    for (const [L, pf] of [[0, 0.2], [1, 0.36], [2, 0.54], [3, 0.72]]) {
      const nk = L / 3, A = lerp(0.5, 0.88, nk);
      const yF = anchorY + (cam.r - Rin) * pf, yC = anchorY + (cam.r - Rout) * pf;
      if (yF < -60 && yC < -60) continue;
      const Rm = (Rin + Rout) / 2, step = lerp(90, 160, nk) / (Rm * pf), span = (W * 0.75) / (Rm * pf);
      const dark = hexOf(mix(hexOf(mix(Z.col, '#000000', lerp(0.6, 0.22, nk))), glow, lerp(0.12, 0, nk))), mid = hexOf(mix(hexOf(mix(Z.col, '#000000', lerp(0.45, 0.06, nk))), glow, lerp(0.14, 0, nk)));
      ctx.globalAlpha = A;
      // The cavern roof: a jagged mass of rock with stalactites
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-20, yC - 400);
      for (let x = -20; x <= W + 40; x += 30) ctx.lineTo(x, yC + 14 + 18 * Math.sin((x + theta * Rm * pf) * 0.05 + z + L) + 10 * Math.sin((x + theta * Rm * pf) * 0.13));
      ctx.lineTo(W + 40, yC - 400); ctx.fill();
      if (L === 0) {
        // The far wall of the cavern: a long ridge of rock, with the odd light
        const off = theta * Rm * pf, rh = (x) => 50 + 40 * Math.sin((x + off) * 0.011 + z * 2) + 26 * Math.sin((x + off) * 0.029 + z) + 12 * Math.sin((x + off) * 0.07);
        ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-20, yF + 10);
        for (let x = -20; x <= W + 40; x += 20) ctx.lineTo(x, yF - rh(x) * 1.6);
        ctx.lineTo(W + 40, yF + 10); ctx.fill();
        for (let k = 0; k < 14; k++) {
          const lx = ((k * 211 + off * 1) % (W + 200) + W + 200) % (W + 200) - 100;
          if (hash3(k, z, 9) > 0.5) px(lx, yF - rh(lx) * 1.6 * hash3(k, z, 4), 3, 3, glow);
        }
      }
      const i0 = Math.floor((-theta - span) / step), i1 = Math.ceil((-theta + span) / step);
      for (let i = i0; i <= i1; i++) {
        const x = W / 2 + wrap(i * step + theta) * Rm * pf, h1 = hash3(i, z, L), h2 = hash3(i + 7, z, L), h3 = hash3(i, z + 3, L + 5);
        // Gaps and clusters, and every size from runt to giant
        if (h3 < (L === 0 ? 0.3 : L === 3 ? 0.4 : 0.15)) continue;
        const sc = 0.55 + hash3(i, z + 9, L) * 0.95;
        const H1 = (lerp(120, 70, nk) + h1 * lerp(170, 110, nk)) * sc, w = (lerp(26, 34, nk) + h2 * lerp(28, 44, nk)) * lerp(0.8, 1.25, sc - 0.55);
        if (L === 3 && h1 > 0.72) { cavernColumn(x, yF, yC, w, dark, mid, glow, key); continue; }
        ctx.fillStyle = dark;
        // From the roof: stalactites, roots, vines, cables
        if (key === 'fungus' || key === 'shaft' || key === 'pellucidar') { ctx.fillStyle = key === 'pellucidar' ? '#1e3a18' : '#3a2a1a'; for (let k = 0; k < 3; k++) ctx.fillRect(x + (k - 1) * 9, yC + 10, 2, 30 + hash3(i, k, L) * 80); }
        else if (key === 'city') { ctx.strokeStyle = h3 > 0.5 ? glow : '#8fff6a'; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 60, yC + 20); ctx.quadraticCurveTo(x, yC + 60 + h1 * 40, x + 60, yC + 20); ctx.stroke(); ctx.globalAlpha = A; }
        else if (key === 'morlock') { ctx.fillRect(x - 70, yC + 30 + h1 * 30, 140, 6); px(x, yC + 10, 2, 40 + h2 * 40, dark); }
        else { ctx.beginPath(); ctx.moveTo(x - 8, yC + 10); ctx.lineTo(x + 8, yC + 10); ctx.lineTo(x, yC + 40 + h1 * 60); ctx.fill(); if (key === 'crystal' || key === 'agartha') px(x - 1, yC + 14, 2, 20 + h1 * 30, glow); if (key === 'lava' && Math.sin(clock * 3 + i) > 0.6) px(x - 1, yC + 40 + h1 * 60 + ((clock * 60 + i * 13) % 80), 2, 4, '#ff8a3a'); }
        // From the floor: each cavern's own far-off shapes (two kinds each)
        ctx.fillStyle = mid;
        if ((L === 2 && h2 > 0.3) || (L === 1 && h2 > 0.75)) { ctx.save(); cavernAlt(key, x, yF, yC, H1, w, mid, dark, glow, i); ctx.restore(); ctx.globalAlpha = A; continue; }
        if (key === 'pellucidar') {
          ctx.fillRect(x - 4, yF - H1, 8, H1); for (const [ox, oy, r] of [[0, 0, 26], [-18, 14, 18], [18, 12, 20]]) { ctx.beginPath(); ctx.arc(x + ox, yF - H1 + oy, r * lerp(1.35, 1, nk), 0, TAU); ctx.fill(); }
        } else if (key === 'sea') {
          ctx.beginPath(); ctx.moveTo(x - w, yF); ctx.lineTo(x - w * 0.6, yF - H1); ctx.lineTo(x + w * 0.4, yF - H1 * 0.9); ctx.lineTo(x + w, yF); ctx.fill();
          if (h3 > 0.55) { ctx.fillStyle = 'rgba(160,215,255,0.5)'; ctx.fillRect(x - 3, yC + 30, 6, yF - yC - 30); for (let k = 0; k < 3; k++) px(x - 3, yC + 30 + ((clock * 120 + k * 60 + i * 30) % Math.max(1, yF - yC - 30)), 6, 10, 'rgba(230,245,255,0.7)'); }
        } else if (key === 'agartha') {
          ctx.fillRect(x - w / 2, yF - H1, w, H1); ctx.beginPath(); ctx.arc(x, yF - H1, w / 2, Math.PI, TAU); ctx.fill();
          for (let y = yF - H1 + 12; y < yF - 6; y += 16) px(x - 3, y, 6, 6, (Math.floor(clock * 2 + i + y) % 4) ? glow : '#fff3c4');
        } else if (key === 'crystal') {
          ctx.beginPath(); ctx.moveTo(x - w * 0.5, yF); ctx.lineTo(x - w * 0.15, yF - H1); ctx.lineTo(x + w * 0.1, yF - H1 * 1.08); ctx.lineTo(x + w * 0.5, yF); ctx.fill();
          ctx.globalAlpha *= 0.6; px(x - w * 0.1, yF - H1 * 0.95, 3, H1 * 0.8, glow); ctx.globalAlpha = A;
        } else if (key === 'fungus') {
          ctx.fillRect(x - w * 0.12, yF - H1, w * 0.24, H1); ctx.beginPath(); ctx.ellipse(x, yF - H1, w * 0.9, H1 * 0.2, 0, Math.PI, TAU); ctx.fill();
          for (const k of [-0.5, 0, 0.5]) px(x + k * w * 0.8 - 2, yF - H1 - 4, 4, 4, glow);
        } else if (key === 'morlock') {
          ctx.fillRect(x - w / 2, yF - H1 * 0.7, w, H1 * 0.7); ctx.fillRect(x - 6, yF - H1 * 1.2, 12, H1 * 0.5);
          for (let k = 0; k < 3; k++) { const t = (clock * 0.25 + k / 3 + h1) % 1; ctx.fillStyle = `rgba(140,140,150,${0.35 * (1 - t)})`; ctx.beginPath(); ctx.arc(x + Math.sin(t * 3) * 8, yF - H1 * 1.2 - t * 70, 8 + t * 16, 0, TAU); ctx.fill(); }
          for (let y = yF - H1 * 0.6; y < yF - 8; y += 14) px(x - w / 2 + 6, y, 6, 6, (Math.floor(clock + i + y) % 3) ? '#ff5a3a' : '#3a1a10');
        } else if (key === 'lava') {
          ctx.beginPath(); ctx.moveTo(x - w * 1.4, yF); ctx.lineTo(x - 8, yF - H1); ctx.lineTo(x + 8, yF - H1); ctx.lineTo(x + w * 1.4, yF); ctx.fill();
          if (h3 > 0.4) { px(x - 2, yF - H1, 4, H1, '#ff6a1a'); if (Math.sin(clock * 4 + i) > 0.5) px(x - 3, yF - H1 - 8, 6, 6, '#ffd23f'); }
        } else if (key === 'city') {
          ctx.fillRect(x - w / 2, yF - H1 * 1.3, w, H1 * 1.3);
          for (let y = yF - H1 * 1.3 + 8; y < yF - 6; y += 12) for (let xx = x - w / 2 + 5; xx < x + w / 2 - 5; xx += 10) if (hash3(i, y, xx) > 0.45) px(xx, y, 4, 5, hash3(xx, y, i) > 0.7 ? glow : '#8fff6a');
        } else {
          ctx.beginPath(); ctx.moveTo(x - w, yF); ctx.lineTo(x - w, yF - H1 * 0.5); ctx.arc(x, yF - H1 * 0.5, w, Math.PI, TAU); ctx.lineTo(x + w, yF); ctx.fill();
          ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.moveTo(x - w * 0.6, yF); ctx.lineTo(x - w * 0.6, yF - H1 * 0.5); ctx.arc(x, yF - H1 * 0.5, w * 0.6, Math.PI, TAU); ctx.lineTo(x + w * 0.6, yF); ctx.fill();
          if (Math.sin(clock * 2 + i) > 0) px(x - 3, yF - H1 * 0.5 - 4, 6, 6, '#ffb23a');
        }
      }
      // A low glow along the far floor in the cavern's colour
      const fg = ctx.createLinearGradient(0, yF - 80, 0, yF + 10);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, hexOf(mix(Z.col, glow, 0.25)));
      ctx.fillStyle = fg; ctx.fillRect(0, yF - 80, W, 90);
      // Mist lying between the layers, drifting, so each depth sits apart
      if (L === 0 || L === 2) {
        const c = mix(Z.col, glow, 0.35).match(/\d+/g), my = yF - (L ? 50 : 90), mh = L ? 120 : 170;
        const mg = ctx.createLinearGradient(0, my - mh / 2, 0, my + mh / 2);
        mg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0)`); mg.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},${L ? 0.16 : 0.24})`); mg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        ctx.globalAlpha = 1; ctx.fillStyle = mg; ctx.fillRect(0, my - mh / 2, W, mh);
        for (let k = 0; k < 5; k++) {
          const mx = (((k * 260 + clock * (8 + k * 3) + theta * Rm * pf) % (W + 400)) + W + 400) % (W + 400) - 200;
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.08)`; ctx.beginPath(); ctx.ellipse(mx, my + Math.sin(k) * 14, 160, 22, 0, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  // A great column where a stalactite and stalagmite have met, close by
  function cavernColumn(x, yF, yC, w, dark, mid, glow, key) {
    const cw = w * 0.7;
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(x - cw * 1.6, yF); ctx.quadraticCurveTo(x - cw * 0.5, yF - 60, x - cw * 0.45, (yF + yC) / 2);
    ctx.quadraticCurveTo(x - cw * 0.5, yC + 50, x - cw * 1.5, yC); ctx.lineTo(x + cw * 1.5, yC);
    ctx.quadraticCurveTo(x + cw * 0.5, yC + 50, x + cw * 0.45, (yF + yC) / 2); ctx.quadraticCurveTo(x + cw * 0.5, yF - 60, x + cw * 1.6, yF); ctx.fill();
    ctx.fillStyle = mid; ctx.fillRect(x - cw * 0.45, yC + 60, 3, Math.max(0, yF - yC - 120));
    // Something growing on it
    if (key === 'fungus' || key === 'pellucidar') for (let k = 0; k < 5; k++) px(x - cw * 0.5 - 4, yC + 80 + k * ((yF - yC - 160) / 5), 8, 4, key === 'fungus' ? glow : '#3f7a2a');
    else if (key === 'crystal' || key === 'agartha') for (let k = 0; k < 4; k++) px(x + cw * 0.2, yC + 90 + k * ((yF - yC - 180) / 4), 3, 12, glow);
  }
  // Each cavern's second kind of far-off shape
  function cavernAlt(key, x, yF, yC, H, w, mid, dark, glow, i) {
    ctx.fillStyle = mid;
    if (key === 'pellucidar') {
      // A long-necked dinosaur, as in Burroughs's Pellucidar stories
      const s = H / 120, wob = Math.sin(clock * 0.8 + i) * 4 * s;
      ctx.beginPath(); ctx.ellipse(x, yF - 30 * s, 40 * s, 20 * s, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 9 * s; ctx.strokeStyle = mid; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 30 * s, yF - 36 * s); ctx.quadraticCurveTo(x + 55 * s, yF - 80 * s, x + 50 * s + wob, yF - 110 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 36 * s, yF - 30 * s); ctx.quadraticCurveTo(x - 70 * s, yF - 20 * s, x - 90 * s, yF - 8 * s); ctx.stroke();
      ctx.lineCap = 'butt';
      for (const lx of [-24, -10, 12, 26]) ctx.fillRect(x + lx * s, yF - 18 * s, 7 * s, 18 * s);
    } else if (key === 'sea') {
      // A sea arch, and a raft like Lidenbrock's
      ctx.beginPath(); ctx.moveTo(x - w * 1.6, yF); ctx.lineTo(x - w * 1.3, yF - H); ctx.lineTo(x + w * 1.3, yF - H); ctx.lineTo(x + w * 1.6, yF);
      ctx.lineTo(x + w * 0.7, yF); ctx.quadraticCurveTo(x, yF - H * 1.4, x - w * 0.7, yF); ctx.fill();
      const rx = x + Math.sin(clock * 0.2 + i) * 40;
      ctx.fillStyle = dark; ctx.fillRect(rx - 14, yF - 6, 28, 4); ctx.fillRect(rx - 1, yF - 26, 2, 20);
      ctx.beginPath(); ctx.moveTo(rx + 1, yF - 25); ctx.lineTo(rx + 13, yF - 12); ctx.lineTo(rx + 1, yF - 10); ctx.fill();
    } else if (key === 'agartha') {
      // A stepped pyramid, its top alight
      for (let k = 0; k < 5; k++) ctx.fillRect(x - w * (1.6 - k * 0.3), yF - (k + 1) * H * 0.18, w * (3.2 - k * 0.6), H * 0.18 + 1);
      ctx.fillStyle = glow; ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(clock * 2 + i);
      ctx.beginPath(); ctx.arc(x, yF - H * 0.95, 6, 0, TAU); ctx.fill();
    } else if (key === 'crystal') {
      // A cluster of giant crystals leaning every way (like Naica's)
      for (const [ang, len, ww] of [[-0.5, 1, 0.5], [0.1, 1.3, 0.6], [0.6, 0.8, 0.45], [-0.15, 0.6, 0.35]]) {
        ctx.save(); ctx.translate(x, yF); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(-w * ww, 0); ctx.lineTo(-w * ww * 0.8, -H * len); ctx.lineTo(0, -H * len - 14); ctx.lineTo(w * ww * 0.8, -H * len); ctx.lineTo(w * ww, 0); ctx.fill();
        ctx.globalAlpha *= 0.5; px(-1, -H * len * 0.9, 2, H * len * 0.8, glow); ctx.restore();
      }
    } else if (key === 'fungus') {
      // Puffballs, breathing out spores
      for (const [ox, r] of [[-w * 0.8, 0.5], [0, 0.75], [w * 0.9, 0.42]]) {
        const rr = H * r * 0.45; ctx.beginPath(); ctx.arc(x + ox, yF - rr, rr, 0, TAU); ctx.fill();
        for (let k = 0; k < 3; k++) { const t = (clock * 0.4 + k / 3 + i * 0.13) % 1; px(x + ox + Math.sin(t * 6 + k) * 10, yF - rr * 2 - t * 60, 3, 3, glow); }
      }
    } else if (key === 'morlock') {
      // A huge turning gear, and the pipe that feeds it
      const r = H * 0.42, cxg = x, cyg = yF - r - 6, rot = clock * 0.5 * (i % 2 ? 1 : -1);
      for (let k = 0; k < 10; k++) { const a = rot + (k / 10) * TAU; ctx.save(); ctx.translate(cxg + Math.cos(a) * r, cyg + Math.sin(a) * r); ctx.rotate(a); ctx.fillRect(-5, -7, 12, 14); ctx.restore(); }
      ctx.beginPath(); ctx.arc(cxg, cyg, r, 0, TAU); ctx.arc(cxg, cyg, r * 0.35, 0, TAU, true); ctx.fill('evenodd');
      ctx.fillRect(x + r, yF - 20, w * 2, 12); ctx.fillRect(x + r + w * 2 - 12, yC + 10, 12, yF - yC - 10);
    } else if (key === 'lava') {
      // A lavafall from the roof, into a glowing pool
      const top = yC + 30, g = ctx.createLinearGradient(0, top, 0, yF);
      g.addColorStop(0, 'rgba(255,200,80,0.9)'); g.addColorStop(1, 'rgba(255,90,20,0.8)');
      ctx.fillStyle = g; ctx.fillRect(x - w * 0.25, top, w * 0.5, yF - top);
      for (let k = 0; k < 4; k++) px(x - w * 0.25 + 2, top + ((clock * 140 + k * 70 + i * 23) % Math.max(1, yF - top)), w * 0.5 - 4, 8, '#ffd23f');
      ctx.fillStyle = 'rgba(255,120,30,0.6)'; ctx.beginPath(); ctx.ellipse(x, yF - 2, w * 1.6, 8, 0, 0, TAU); ctx.fill();
    } else if (key === 'city') {
      // A dome and a skybridge between two towers
      ctx.beginPath(); ctx.arc(x, yF, w * 1.4, Math.PI, TAU); ctx.fill();
      ctx.fillRect(x - w * 2.4, yF - H * 1.1, w * 0.6, H * 1.1); ctx.fillRect(x + w * 1.8, yF - H * 0.9, w * 0.6, H * 0.9);
      ctx.fillRect(x - w * 1.8, yF - H * 0.75, w * 3.6, 5);
      for (let k = 0; k < 6; k++) px(x - w * 1.7 + k * w * 0.62, yF - H * 0.75 + 1, 3, 3, (Math.floor(clock * 3) + k) % 3 ? glow : '#ffffff');
    } else {
      // A mine's headframe, its wheel turning
      ctx.beginPath(); ctx.moveTo(x - w, yF); ctx.lineTo(x - 3, yF - H); ctx.lineTo(x + 3, yF - H); ctx.lineTo(x + w, yF); ctx.lineTo(x + w - 6, yF); ctx.lineTo(x, yF - H + 10); ctx.lineTo(x - w + 6, yF); ctx.fill();
      ctx.strokeStyle = mid; ctx.lineWidth = 3; const a = clock * 1.5;
      ctx.beginPath(); ctx.arc(x, yF - H, 14, 0, TAU); ctx.moveTo(x + Math.cos(a) * 14, yF - H + Math.sin(a) * 14); ctx.lineTo(x - Math.cos(a) * 14, yF - H - Math.sin(a) * 14); ctx.stroke();
      ctx.fillRect(x - 1, yF - H, 2, H);
    }
  }
  // How far from the middle of the world the screen reaches, nearest and furthest
  function viewRadii() {
    const nx = clamp(cx, view.x0, view.x1), ny = clamp(cy, view.y0, view.y1);
    const dmin = Math.hypot(nx - cx, ny - cy);
    const dmax = Math.max(...[[view.x0, view.y0], [view.x1, view.y0], [view.x0, view.y1], [view.x1, view.y1]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
    return [dmin, dmax];
  }
  function drawHollowWorld() {
    const [dmin, dmax] = viewRadii();
    hollowView = [dmin, dmax];
    // Cavern rings, outermost first (only the ones on screen)
    for (let z = HOLLOW.length - 1; z >= 0; z--) {
      const R = z < HOLLOW.length - 1 ? zoneBase(z + 1) : tierR(TOP) + 260, Rin = z === 0 ? R0 : zoneBase(z);
      if (R < dmin - 40 || Rin > dmax + 40) continue;
      // Lit from the town on its floor, fading into the dark under the roof
      const g = ctx.createRadialGradient(cx, cy, Rin, cx, cy, R);
      g.addColorStop(0, hexOf(mix(HOLLOW[z].col, ZONE_GLOW[z], 0.35))); g.addColorStop(0.35, HOLLOW[z].col); g.addColorStop(1, hexOf(mix(HOLLOW[z].col, '#000000', 0.5)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
      drawCavernParallax(z, Rin, R);
      ctx.restore();
    }
    // The way out: daylight beyond the last shell
    const outer = tierR(TOP) + 260;
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 60; ctx.beginPath(); ctx.arc(cx, cy, outer, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#4fb34a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, outer + 30, 0, TAU); ctx.stroke();
    // The inner sun, and the land of Pellucidar round it
    const sg = ctx.createRadialGradient(cx, cy, R0 * 0.2, cx, cy, R0 * 2.2);
    sg.addColorStop(0, 'rgba(255,230,150,0.55)'); sg.addColorStop(0.4, 'rgba(255,170,80,0.18)'); sg.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R0 * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a7a2a'; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.arc(cx, cy, R0 - 10, 0, TAU, true); ctx.fill('evenodd');
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.62);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.5, '#fff0a0'); core.addColorStop(1, '#ffb040');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R0 * 0.62, 0, TAU); ctx.fill();
    // (a gap of dark between the sun and the land, so you can see it's a sun)
    ctx.strokeStyle = 'rgba(30,20,10,0.9)'; ctx.lineWidth = R0 * 0.12; ctx.beginPath(); ctx.arc(cx, cy, R0 * 0.78, 0, TAU); ctx.stroke();
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    const ly = cy - R0 * 0.25;
    if (ly < H + 20) { ctx.fillStyle = '#7a4a10'; ctx.fillText('THE "INNER SUN"', cx, ly); }
    ctx.textAlign = 'start';
    // Rock shells between caverns, with the opening where the way goes through
    for (const s of world.shells) {
      if (cy - s.R > view.y1 + 60) continue;
      const g0 = s.gapA - s.gapW / 2 + theta - Math.PI / 2, g1 = s.gapA + s.gapW / 2 + theta - Math.PI / 2;
      // Light pouring down through the gap from the cavern above
      at(s.gapA + theta, s.R, () => {
        const w = s.gapW * s.R, lg = ctx.createLinearGradient(0, -20, 0, 320);
        lg.addColorStop(0, `rgba(255,240,200,${0.13 + 0.04 * Math.sin(clock * 1.3 + s.R)})`); lg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w * 0.6, 320); ctx.lineTo(-w * 0.6, 320); ctx.fill();
        for (const side of [-1, 1]) { ctx.fillStyle = '#3a2e26'; ctx.beginPath(); ctx.arc(side * w / 2, 22, 26, 0, TAU); ctx.fill(); px(side * w / 2 - 14, -2, 28, 5, hexOf(mix('#8a7056', ZONE_GLOW[s.zone], 0.25))); }
        for (let i = 0; i < 8; i++) px(Math.sin(clock * 0.7 + i * 2.1) * w * 0.4, ((clock * 30 + i * 47) % 300), 2, 2, 'rgba(255,250,220,0.6)');
      }, 400);
      // The crust: solid rock you can walk on, its top at the shell's radius
      ctx.strokeStyle = '#3a2e26'; ctx.lineWidth = 48;
      ctx.beginPath(); ctx.arc(cx, cy, s.R - 24, g1, g0 + TAU); ctx.stroke();
      ctx.strokeStyle = hexOf(mix('#8a7056', ZONE_GLOW[s.zone], 0.25)); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, s.R - 2, g1, g0 + TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, s.R - 30, g1, g0 + TAU); ctx.stroke();
      // Its underside: stalactites hanging into the cavern below
      for (let i = -14; i <= 14; i++) {
        const a = -theta + (i * 70) / s.R;
        if (Math.abs(wrap(a - s.gapA)) < s.gapW / 2 + 0.01) continue;
        at(a, s.R - 48, () => { ctx.fillStyle = '#3a2e26'; ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(8, -2); ctx.lineTo(0, 14 + ((i * 37) % 5) * 6); ctx.fill(); }, 40);
      }
    }
    drawHollowAmbient();
    // Bands: the Lidenbrock Sea, and a river of lava
    for (const d of world.decor) {
      if (d.kind !== 'seaband' && d.kind !== 'lavaband') continue;
      if (cy - d.R > view.y1 + 200) continue;
      const lava = d.kind === 'lavaband';
      ctx.strokeStyle = lava ? '#ff6a1a' : '#17485a'; ctx.lineWidth = 70;
      ctx.beginPath(); ctx.arc(cx, cy, d.R + 52, 0, TAU); ctx.stroke();
      ctx.strokeStyle = lava ? '#ffd23f' : '#5ab4c8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, d.R + 88 + Math.sin(clock * 2) * 2, 0, TAU); ctx.stroke();
    }
  }
  // Life in the air round you: fireflies, spores, sparkles, embers, steam and
  // dust, in the colours of whatever cavern each one is in
  function drawHollowAmbient() {
    for (let i = 0; i < 46; i++) {
      const u = ((i * 0.6180339) % 1) - 0.5, v = ((i * 0.4142135) % 1) - 0.45;
      const R = player.r + v * H * 1.1 + Math.sin(clock * 0.5 + i) * 20;
      const a = -theta + (u * W * 1.2 + Math.sin(clock * 0.3 + i * 1.7) * 40) / R;
      const z = hollowZone((R - R0 - 30) / TIER_GAP), key = HOLLOW[z].key;
      at(a, R, () => {
        const tw = 0.5 + 0.5 * Math.sin(clock * 3 + i * 1.3);
        if (key === 'lava') { const y = -((clock * 40 + i * 31) % 120); px(0, y, 2, 3, `rgba(255,${140 + (i % 3) * 30},40,${0.9 - (-y / 120)})`); }
        else if (key === 'morlock') { ctx.fillStyle = `rgba(200,200,210,${0.12 * tw})`; ctx.beginPath(); ctx.arc(0, 0, 10 + tw * 8, 0, TAU); ctx.fill(); }
        else if (key === 'crystal') { if (tw > 0.7) { px(-3, 0, 7, 1, '#ffffff'); px(0, -3, 1, 7, '#ffffff'); } }
        else if (key === 'city') px(0, 0, 2, 2, i % 2 ? `rgba(255,106,213,${tw})` : `rgba(143,255,106,${tw})`);
        else if (key === 'shaft') px(0, 0, 2, 2, `rgba(230,210,170,${0.4 * tw})`);
        else { ctx.fillStyle = `rgba(${key === 'sea' ? '160,230,255' : '200,255,120'},${0.3 + 0.7 * tw})`; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill(); }
      }, 20);
    }
  }
  let hollowView = [0, 1e9];
  function drawHollowDecor() {
    const [dmin, dmax] = hollowView;
    for (const d of world.decor) {
      if (d.kind === 'seaband' || d.kind === 'lavaband') continue;
      if (d.R + 400 < dmin || d.R - (d.len || 0) - 400 > dmax) continue;
      const dr = d.kind === 'waterfall' || d.kind === 'glowworm' || d.kind === 'root' || d.kind === 'island' ? d.len || 0 : 0;
      at(d.a + theta, d.R, () => {
        if (d.kind === 'island') {
          // A floating island of rock, with something on it, and maybe a waterfall off its edge
          if (d.fall) drawHollowItem({ kind: 'waterfall', w: 14, len: d.len, lava: d.lava, gold: d.gold }, d.w * 0.3, 20);
          const Z = HOLLOW[hollowZone((d.R - R0 - 30) / TIER_GAP)];
          ctx.fillStyle = hexOf(mix(Z.col, '#6a5a4a', 0.55));
          ctx.beginPath(); ctx.moveTo(-d.w / 2, 0); ctx.lineTo(d.w / 2, 0); ctx.lineTo(d.w * 0.3, 22); ctx.lineTo(d.w * 0.05, 44); ctx.lineTo(-d.w * 0.25, 26); ctx.closePath(); ctx.fill();
          px(-d.w / 2, 0, d.w, 3, d.lava ? '#ff8a3a' : d.gold ? '#ffd23f' : '#8a7a5a');
          drawHollowItem({ ...d, kind: d.item }, 0, 0);
          return;
        }
        drawHollowItem(d, 0, 0);
      }, 200 + dr);
    }
    drawHollowMovers();
  }
  function drawHollowItem(d, ox, oy) {
    ctx.save(); ctx.translate(ox, oy);
    {
      {
        const k = d.kind;
        if (k === 'lake' || k === 'lavapool') {
          // Water (or lava) lying in a dip in the floor, with life in it
          const lava = k === 'lavapool', w = d.w;
          ctx.fillStyle = lava ? '#ff5a1a' : '#1e5a70';
          ctx.beginPath(); ctx.ellipse(0, 2, w / 2, 9, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = lava ? '#ffd23f' : '#6ac4d8';
          for (let i = 0; i < 4; i++) px(-w / 2 + 12 + ((i * 41 + clock * (lava ? 6 : 14)) % (w - 24)), -1 + Math.sin(clock * 3 + i) * 1.5, 10, 2, ctx.fillStyle);
          if (d.beast === 'bubbles') { for (let i = 0; i < 3; i++) { const t = (clock * 0.7 + i / 3 + d.ph) % 1; ctx.fillStyle = `rgba(255,200,80,${1 - t})`; ctx.beginPath(); ctx.arc(-w / 4 + i * w / 4, -t * 14, 3 + t * 3, 0, TAU); ctx.fill(); } }
          else if (d.beast === 'fish') { const t = (clock * 0.5 + d.ph) % 3; if (t < 1) { const x = lerp(-w / 4, w / 4, t), y = -Math.sin(t * Math.PI) * 40; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.cos(t * Math.PI) * -0.8); ctx.fillStyle = '#c9d7f0'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -4); ctx.lineTo(-14, 4); ctx.fill(); ctx.restore(); } }
          else drawHollowItem({ kind: d.beast }, 0, 4);
        } else if (k === 'jungle') {
          // Back row: tall jungle trees in the haze
          ctx.globalAlpha = 0.55; const h = 160 * d.h;
          px(-5, -h, 10, h, '#1e3018'); ctx.fillStyle = '#24401c';
          for (const [x, y, r] of [[0, -h, 34], [-22, -h + 20, 24], [22, -h + 16, 26]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = 1;
        } else if (k === 'treefern') {
          const h = 70 + d.size * 40, sway = Math.sin(clock * 0.9 + d.ph) * 0.08;
          px(-3, -h, 6, h, '#5a3a20');
          ctx.save(); ctx.translate(0, -h); ctx.rotate(sway);
          ctx.fillStyle = '#3f8f3a';
          for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(-1.4 + i * 0.56); ctx.beginPath(); ctx.ellipse(0, -18, 5, 20, 0, 0, TAU); ctx.fill(); ctx.restore(); }
          ctx.restore();
        } else if (k === 'stilthut') {
          px(-20, -50, 3, 50, '#5a3a20'); px(17, -50, 3, 50, '#5a3a20');
          px(-24, -62, 48, 14, '#8a6a3a'); ctx.fillStyle = '#a5824a'; ctx.beginPath(); ctx.moveTo(-28, -62); ctx.lineTo(0, -86); ctx.lineTo(28, -62); ctx.fill();
          px(-5, -60, 10, 10, Math.sin(clock * 2 + d.ph) > -0.5 ? '#ffb23a' : '#3a2a1a');
          for (let i = 0; i < 3; i++) { const t = (clock * 0.4 + i / 3 + d.ph) % 1; ctx.fillStyle = `rgba(200,200,200,${0.4 * (1 - t)})`; ctx.beginPath(); ctx.arc(10, -88 - t * 40, 4 + t * 8, 0, TAU); ctx.fill(); }
        } else if (k === 'rocks') {
          ctx.fillStyle = '#5a4a40'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-14, -22); ctx.lineTo(4, -18); ctx.lineTo(10, -30); ctx.lineTo(26, 0); ctx.fill(); px(-12, -20, 10, 3, '#7a6a5a');
        } else if (k === 'cliff') {
          ctx.globalAlpha = 0.6; const h = 180 * d.h;
          ctx.fillStyle = '#16343c'; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-36, -h); ctx.lineTo(30, -h * 0.9); ctx.lineTo(50, 0); ctx.fill();
          ctx.fillStyle = 'rgba(160,210,255,0.6)'; ctx.fillRect(-4, -h * 0.9, 6, h * 0.9);
          ctx.globalAlpha = 1;
        } else if (k === 'boat') {
          const bob = Math.sin(clock * 1.5 + d.ph) * 2;
          ctx.fillStyle = '#7a4a28'; ctx.beginPath(); ctx.moveTo(-28, -10 + bob); ctx.lineTo(28, -10 + bob); ctx.lineTo(20, 0 + bob); ctx.lineTo(-20, 0 + bob); ctx.fill();
          px(-1, -50 + bob, 2, 40, '#5a3a20'); ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(1, -48 + bob); ctx.lineTo(24, -16 + bob); ctx.lineTo(1, -16 + bob); ctx.fill();
        } else if (k === 'lighthouse') {
          px(-10, -110, 20, 110, '#e8e0d0'); for (let y = -100; y < 0; y += 26) px(-10, y, 20, 8, '#e0433b');
          px(-12, -122, 24, 12, '#3b3b4f'); px(-8, -120, 16, 8, '#fff3b0');
          ctx.save(); ctx.translate(0, -116); ctx.rotate(clock * 1.5);
          const g = ctx.createLinearGradient(0, 0, 160, 0); g.addColorStop(0, 'rgba(255,240,180,0.5)'); g.addColorStop(1, 'rgba(255,240,180,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(160, -18); ctx.lineTo(160, 18); ctx.fill();
          ctx.restore();
        } else if (k === 'nets') {
          px(-24, -30, 2, 30, '#5a3a20'); px(22, -30, 2, 30, '#5a3a20');
          ctx.strokeStyle = 'rgba(200,190,160,0.7)'; ctx.lineWidth = 1;
          for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-22, -28 + i * 4); ctx.quadraticCurveTo(0, -18 + i * 4 + Math.sin(clock + i) * 2, 22, -28 + i * 4); ctx.stroke(); }
        } else if (k === 'temple') {
          // A golden temple of Agartha, with columns and a glowing doorway
          px(-50, -8, 100, 8, '#b88a2a'); for (let x = -42; x <= 34; x += 19) px(x, -66, 8, 58, '#e0b040');
          ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-56, -66); ctx.lineTo(0, -96); ctx.lineTo(56, -66); ctx.fill();
          const g = 0.5 + 0.5 * Math.sin(clock * 2 + d.ph); px(-8, -40, 16, 32, `rgba(255,240,160,${0.5 + g * 0.5})`);
        } else if (k === 'ziggurat') {
          for (let i = 0; i < 5; i++) px(-50 + i * 10, -16 - i * 16, 100 - i * 20, 16, i % 2 ? '#c99a3a' : '#e0b040');
          px(-6, -96, 12, 16, '#fff3c4'); if (Math.sin(clock * 3 + d.ph) > 0) px(-2, -110, 4, 14, '#ffffff');
        } else if (k === 'vril') {
          // A lamp of "vril", the glowing power of the people in Bulwer-Lytton's The Coming Race (1871)
          px(-2, -60, 4, 60, '#b88a2a');
          const g = ctx.createRadialGradient(0, -66, 2, 0, -66, 30); g.addColorStop(0, 'rgba(180,255,255,0.9)'); g.addColorStop(1, 'rgba(120,220,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -66, 30 + Math.sin(clock * 4 + d.ph) * 4, 0, TAU); ctx.fill();
          px(-5, -71, 10, 10, '#e6ffff');
        } else if (k === 'goldtower') {
          ctx.globalAlpha = 0.5; const h = 220 * d.h;
          ctx.fillStyle = '#7a5a20'; ctx.fillRect(-18, -h, 36, h); ctx.beginPath(); ctx.arc(0, -h, 18, Math.PI, TAU); ctx.fill();
          for (let y = -h + 20; y < -10; y += 22) px(-4, y, 8, 8, '#ffd23f');
          ctx.globalAlpha = 1;
        } else if (k === 'vimana') {
          // A flying saucer, Agartha's "vimana", hovering and turning
          const y = Math.sin(clock * 1.1 + d.ph) * 12, x = Math.cos(clock * 0.4 + d.ph) * 50;
          ctx.fillStyle = '#c9ced9'; ctx.beginPath(); ctx.ellipse(x, y, 40, 9, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(191,232,255,0.7)'; ctx.beginPath(); ctx.arc(x, y - 6, 14, Math.PI, TAU); ctx.fill();
          for (let i = 0; i < 5; i++) px(x - 30 + i * 14, y - 1, 4, 3, (Math.floor(clock * 6) + i) % 2 ? '#ffd23f' : '#ff6ad5');
          const g = ctx.createLinearGradient(0, y + 8, 0, y + 90); g.addColorStop(0, 'rgba(180,255,220,0.35)'); g.addColorStop(1, 'rgba(180,255,220,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 14, y + 8); ctx.lineTo(x + 14, y + 8); ctx.lineTo(x + 30, y + 90); ctx.lineTo(x - 30, y + 90); ctx.fill();
        } else if (k === 'crystalspire') {
          ctx.globalAlpha = 0.5; const h = 200 * d.h;
          ctx.fillStyle = '#4a3a8a'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-10, -h); ctx.lineTo(4, -h - 20); ctx.lineTo(26, 0); ctx.fill();
          px(-6, -h * 0.9, 3, h * 0.8, 'rgba(200,190,255,0.6)'); ctx.globalAlpha = 1;
        } else if (k === 'saltstatue') {
          // A statue carved from salt, as in the Wieliczka mine
          px(-14, -8, 28, 8, '#d8d0c8'); px(-7, -44, 14, 36, '#e8e2da'); ctx.fillStyle = '#e8e2da'; ctx.beginPath(); ctx.arc(0, -52, 8, 0, TAU); ctx.fill();
          px(-12, -36, 6, 14, '#d8d0c8'); px(6, -36, 6, 14, '#d8d0c8');
        } else if (k === 'saltchapel') {
          // St Kinga's Chapel: an arched hall carved from salt, with salt chandeliers
          px(-80, -100, 160, 100, '#cfc6b8'); ctx.fillStyle = '#b8ae9e'; ctx.beginPath(); ctx.moveTo(-90, -100); ctx.lineTo(0, -140); ctx.lineTo(90, -100); ctx.fill();
          for (let x = -60; x <= 40; x += 33) { ctx.fillStyle = '#8a7e6e'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -50); ctx.arc(x + 10, -50, 10, Math.PI, TAU); ctx.lineTo(x + 20, 0); ctx.fill(); }
          for (const x of [-40, 40]) { px(x - 1, -100, 2, 14, '#e8e2da'); const g = 0.7 + 0.3 * Math.sin(clock * 3 + x); for (let i = -2; i <= 2; i++) px(x + i * 6 - 2, -86 + Math.abs(i) * 3, 4, 8, `rgba(255,245,220,${g})`); }
          ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#5a4a3a'; ctx.fillText('ST KINGA', 0, -112); ctx.textAlign = 'start';
        } else if (k === 'chandelier') {
          // Hanging from the roof (down is +y): a salt chandelier, glittering
          px(-1, 0, 2, d.len, '#d8d0c8');
          for (let i = -3; i <= 3; i++) { const g = 0.6 + 0.4 * Math.sin(clock * 4 + i + d.ph); px(i * 7 - 2, d.len + Math.abs(i) * 3, 4, 10, `rgba(255,248,230,${g})`); }
        } else if (k === 'minehead') {
          // A mine shaft head with a winding wheel that turns
          px(-24, -80, 4, 80, '#5a4a3a'); px(20, -80, 4, 80, '#5a4a3a'); px(-24, -82, 48, 4, '#5a4a3a');
          ctx.save(); ctx.translate(0, -92); ctx.rotate(clock * 1.2 + d.ph);
          ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.stroke();
          for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.fillStyle = '#8a7a6a'; ctx.fillRect(-1, -14, 2, 28); }
          ctx.restore();
          px(-1, -78, 2, 70 - Math.abs(Math.sin(clock * 0.6 + d.ph)) * 40, '#3a3a3a');
        } else if (k === 'mesa') {
          // Back row: a cliff of soft rock riddled with doors and windows, like Derinkuyu and Cappadocia
          ctx.globalAlpha = 0.6; const h = 170 * d.h;
          ctx.fillStyle = '#5a4630'; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.quadraticCurveTo(-50, -h, 0, -h); ctx.quadraticCurveTo(50, -h, 60, 0); ctx.fill();
          for (let y = -h + 30; y < -10; y += 30) for (let x = -36; x <= 30; x += 22) if ((x + y) % 3) px(x, y, 8, 12, Math.sin(clock + x + y) > 0.6 ? '#ffb23a' : '#2a1e14');
          ctx.globalAlpha = 1;
        } else if (k === 'carved') {
          // A house dug into a mound of soft rock, its door and windows glowing
          ctx.fillStyle = '#8a6e4a'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-36, -70 * d.size, 0, -74 * d.size); ctx.quadraticCurveTo(36, -70 * d.size, 40, 0); ctx.fill();
          ctx.fillStyle = '#2a1e14'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, -20); ctx.arc(0, -20, 8, Math.PI, TAU); ctx.lineTo(8, 0); ctx.fill();
          px(-24, -40, 8, 8, Math.sin(clock * 1.5 + d.ph) > -0.3 ? '#ffb23a' : '#2a1e14'); px(16, -46, 8, 8, '#ffb23a');
        } else if (k === 'rollstone') {
          // A round stone door, rolled across to shut the way in (as at Derinkuyu)
          const roll = Math.sin(clock * 0.3 + d.ph) * 12;
          px(-34, -46, 68, 46, '#7a6040'); px(-10, -40, 20, 40, '#1a120a');
          ctx.save(); ctx.translate(roll, -20); ctx.rotate(roll / 20);
          ctx.fillStyle = '#9a8a6a'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); px(-2, -2, 4, 4, '#5a4a3a');
          ctx.restore();
        } else if (k === 'mushfarm') {
          px(-36, -4, 72, 4, '#4a3a2a');
          for (let i = 0; i < 6; i++) { const x = -30 + i * 12, h = 8 + ((i * 7) % 5) * 2; px(x, -4 - h, 2, h, '#d9cbb0'); ctx.fillStyle = i % 2 ? '#c0452a' : '#7a3fbf'; ctx.beginPath(); ctx.ellipse(x + 1, -4 - h, 6, 4, 0, Math.PI, TAU); ctx.fill(); }
        } else if (k === 'conveyor') {
          px(-50, -24, 100, 6, '#3a3a42'); px(-50, -18, 4, 18, '#3a3a42'); px(46, -18, 4, 18, '#3a3a42');
          for (let i = 0; i < 4; i++) { const x = -48 + ((clock * 30 + i * 26) % 96); px(x, -36, 12, 12, '#8a6a3a'); px(x, -36, 12, 2, '#a5824a'); }
        } else if (k === 'factory') {
          px(-50, -80, 100, 80, '#3a3a42'); ctx.fillStyle = '#4a4a52'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 25, -80); ctx.lineTo(-50 + i * 25, -100); ctx.lineTo(-25 + i * 25, -80); ctx.fill(); }
          for (let x = -40; x < 40; x += 16) px(x, -60, 10, 14, (Math.floor(clock * 2 + x) % 3) ? '#ff8a3a' : '#5a3a20');
          px(-8, -30, 16, 30, '#1a1a20');
        } else if (k === 'chimney') {
          ctx.globalAlpha = 0.55; const h = 230 * d.h;
          px(-12, -h, 24, h, '#1e2028'); for (let i = 0; i < 4; i++) { const t = (clock * 0.25 + i / 4 + d.ph) % 1; ctx.fillStyle = `rgba(120,120,130,${0.5 * (1 - t)})`; ctx.beginPath(); ctx.arc(Math.sin(t * 3) * 10, -h - t * 120, 10 + t * 24, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = 1;
        } else if (k === 'volcano') {
          ctx.globalAlpha = 0.6; const h = 180 * d.h;
          ctx.fillStyle = '#3a1a10'; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(-14, -h); ctx.lineTo(14, -h); ctx.lineTo(90, 0); ctx.fill();
          ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.moveTo(-6, -h); ctx.lineTo(6, -h); ctx.lineTo(20 + Math.sin(clock) * 4, -h * 0.4); ctx.lineTo(12, -h * 0.4); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (k === 'dugout') {
          // A Coober Pedy dugout: a door in a mound, with air pipes poking out of the top
          ctx.fillStyle = '#c9864a'; ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-40, -60, 0, -62); ctx.quadraticCurveTo(40, -60, 46, 0); ctx.fill();
          px(-9, -28, 18, 28, '#4a2a1a'); px(-7, -26, 14, 24, '#6a3a20'); px(14, -34, 10, 8, '#8fd0ff');
          px(-26, -78, 5, 22, '#9aa3b5'); px(20, -72, 5, 16, '#9aa3b5');
        } else if (k === 'opals') {
          px(-20, -10, 40, 10, '#a5713f');
          for (let i = 0; i < 5; i++) { const c = ['#6dd3ff', '#ff6ad5', '#8fff6a', '#ffd23f', '#b58cff'][(i + Math.floor(clock * 3)) % 5]; px(-16 + i * 8, -16 + (i % 2) * 3, 5, 5, c); }
        } else if (k === 'skyscraper') {
          ctx.globalAlpha = 0.55; const h = 260 * d.h;
          px(-26, -h, 52, h, '#141a22'); for (let y = -h + 10; y < -10; y += 14) for (let x = -20; x < 20; x += 12) if (((x + y) / 2 + Math.floor(d.ph)) % 3) px(x, y, 6, 6, (Math.floor(x * y + d.ph)) % 4 ? 'rgba(140,255,120,0.7)' : 'rgba(255,106,213,0.7)');
          ctx.globalAlpha = 1;
        } else if (k === 'lifttower') {
          px(-16, -200, 32, 200, '#2a323c'); px(-2, -200, 4, 200, '#4a5260');
          const y = -20 - ((Math.sin(clock * 0.6 + d.ph) + 1) / 2) * 160;
          px(-12, y - 16, 24, 16, '#ffd23f'); px(-8, y - 12, 16, 8, '#fff3c4');
        } else if (k === 'kiosk') {
          px(-26, -36, 52, 36, '#232b33'); px(-26, -40, 52, 6, Math.sin(clock * 5 + d.ph) > 0 ? '#ff6ad5' : '#8fff6a');
          ctx.font = '5px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#8fff6a'; ctx.fillText('FLIES 2 FOR 1', 0, -22); ctx.textAlign = 'start';
        } else if (k === 'monorail') {
          px(-400, 0, 800, 4, '#4a5260');
          for (let x = -360; x <= 360; x += 180) { px(x - 3, 4, 6, 226, '#3a4250'); px(x - 10, 226, 20, 6, '#3a4250'); }
          const x = ((clock * 120 + d.ph * 100) % 1000) - 500;
          px(x - 50, -20, 100, 20, '#c9ced9'); for (let i = 0; i < 6; i++) px(x - 44 + i * 16, -16, 10, 8, '#8fff6a'); px(x + 46, -18, 6, 16, '#e0433b');
        } else if (k === 'bunker') {
          // A Cold War shelter: a concrete door in the rock, a sign, a light
          px(-40, -60, 80, 60, '#6a6a6a'); px(-16, -44, 32, 44, '#3a3a3a'); px(-14, -42, 28, 40, '#4a4a4a');
          ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.arc(8, -22, 4, 0, TAU); ctx.fill();
          px(-36, -56, 14, 8, Math.sin(clock * 2 + d.ph) > 0 ? '#ff5a4a' : '#5a2a2a');
        } else if (k === 'lantern') {
          px(-1, -50, 2, 50, '#3a3a3a'); ctx.fillStyle = `rgba(255,190,90,${0.7 + 0.3 * Math.sin(clock * 6 + d.ph)})`; ctx.beginPath(); ctx.arc(0, -54, 6, 0, TAU); ctx.fill();
        } else if (k === 'tunnelsign') {
          px(-30, -46, 60, 22, '#2a6a3a'); px(-1, -24, 2, 24, '#5a5a5a');
          ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#eef1ff'; ctx.fillText('EXIT ↑', 0, -32); ctx.textAlign = 'start';
        } else if (k === 'tunnelmouth') {
          ctx.globalAlpha = 0.6; ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-50, -60); ctx.arc(0, -60, 50, Math.PI, TAU); ctx.lineTo(50, 0); ctx.fill();
          ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-30, -50); ctx.arc(0, -50, 30, Math.PI, TAU); ctx.lineTo(30, 0); ctx.fill(); ctx.globalAlpha = 1;
        } else if (k === 'crates') {
          px(-24, -20, 20, 20, '#8a6a3a'); px(-2, -20, 20, 20, '#7a5a2a'); px(-14, -38, 20, 18, '#9a7a4a');
        } else if (k === 'mist') {
          // A cloud, drifting inside the cave (Hang Son Doong has its own)
          ctx.fillStyle = 'rgba(230,240,230,0.1)';
          const x = Math.sin(clock * 0.1 + d.ph) * 80;
          for (const [ox, r] of [[-d.w * 0.3, 30], [0, 42], [d.w * 0.3, 32]]) { ctx.beginPath(); ctx.arc(x + ox, 0, r, 0, TAU); ctx.fill(); }
        } else if (d.walker) drawWalker(d);
        else if (k === 'lavarock') {
          ctx.fillStyle = '#3a1a10'; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-8, -50); ctx.lineTo(10, -40); ctx.lineTo(30, 0); ctx.fill();
          px(-4, -46, 6, 46, '#ff8a3a'); px(-2, -46, 2, 46, '#ffd23f');
        } else if (k === 'waterfall') {
          // Pouring down from the cavern roof (down is +y here)
          const col = d.lava ? ['rgba(255,120,40,0.85)', '#ffd23f'] : d.gold ? ['rgba(255,220,120,0.7)', '#fff3c4'] : ['rgba(150,210,255,0.6)', '#e6f6ff'];
          ctx.fillStyle = col[0]; ctx.fillRect(-d.w / 2, 0, d.w, d.len);
          ctx.fillStyle = col[1];
          for (let i = 0; i < 6; i++) { const y = ((clock * 300 + i * 53) % d.len); ctx.fillRect(-d.w / 2 + (i * 7) % d.w, y, 2, 24); }
          ctx.fillStyle = d.lava ? 'rgba(255,200,100,0.4)' : 'rgba(230,245,255,0.45)';
          for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-d.w / 2 + (i * d.w) / 4, d.len - 6 + Math.sin(clock * 6 + i) * 4, 10 + (i % 2) * 6, 0, TAU); ctx.fill(); }
        } else if (k === 'glowworm') {
          ctx.strokeStyle = 'rgba(200,240,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, d.len); ctx.stroke();
          const g = 0.6 + 0.4 * Math.sin(clock * 2 + d.a * 50);
          ctx.fillStyle = `rgba(140,240,255,${g})`; ctx.beginPath(); ctx.arc(0, d.len, 3, 0, TAU); ctx.fill();
        } else if (k === 'root') {
          px(-1, 0, 3, d.len, '#6b4a2a'); px(-4, d.len * 0.6, 3, d.len * 0.3, '#5a3a20');
        } else if (k === 'fernbush') {
          ctx.scale(d.size, d.size);
          ctx.fillStyle = '#3f8f3a';
          for (let i = -2; i <= 2; i++) { ctx.save(); ctx.rotate(i * 0.35); ctx.beginPath(); ctx.ellipse(0, -26, 6, 26, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        } else if (k === 'dino') {
          // A long-necked dinosaur, plodding along
          ctx.scale(d.dir || 1, 1);
          ctx.fillStyle = '#5a7a4a';
          ctx.beginPath(); ctx.ellipse(0, -30, 40, 20, 0, 0, TAU); ctx.fill();
          ctx.fillRect(26, -86, 10, 60); ctx.beginPath(); ctx.ellipse(36, -88, 12, 7, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-36, -34); ctx.lineTo(-80, -14); ctx.lineTo(-36, -24); ctx.fill();
          const step = Math.sin(clock * 3) * 4;
          px(-26 + step, -14, 9, 14, '#4a6a3a'); px(14 - step, -14, 9, 14, '#4a6a3a');
          px(40, -90, 2, 2, '#1b1530');
        } else if (k === 'mahar') {
          // A Mahar: a flying reptile, wheeling about
          const y = Math.sin(clock * 0.8 + d.ph) * 30, x = Math.cos(clock * 0.5 + d.ph) * 60, f = Math.sin(clock * 6 + d.ph) * 10;
          ctx.fillStyle = '#6a3a5a';
          ctx.beginPath(); ctx.moveTo(x - 34, y - f); ctx.lineTo(x, y + 4); ctx.lineTo(x + 34, y - f); ctx.lineTo(x, y - 4); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, TAU); ctx.fill();
          px(x + 8, y - 6, 12, 3, '#6a3a5a'); px(x + 10, y - 5, 2, 2, '#ffd23f');
        } else if (k === 'hut') {
          ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -34); ctx.lineTo(22, 0); ctx.fill();
          px(-5, -14, 10, 14, '#3a2a1a');
        } else if (k === 'sign' || k === 'neonsign') {
          const neon = k === 'neonsign';
          px(-1, -36, 3, 36, '#9aa3b5');
          ctx.font = '7px "Press Start 2P", monospace';
          const w = ctx.measureText(d.text).width + 16;
          px(-w / 2, -52, w, 18, '#1b1530');
          ctx.textAlign = 'center';
          ctx.fillStyle = neon ? (Math.sin(clock * 5 + d.ph) > -0.8 ? (d.ph % 2 ? '#ff6ad5' : '#8fff6a') : '#334') : d.col;
          ctx.fillText(d.text, 0, -40); ctx.textAlign = 'start';
        } else if (k === 'plesio' || k === 'ichthyo') {
          // Verne's sea monsters, rising and falling in the waves
          const bob = Math.sin(clock * 1.2 + (k === 'plesio' ? 0 : 2)) * 8;
          ctx.fillStyle = k === 'plesio' ? '#2f5a3a' : '#4a5a6a';
          if (k === 'plesio') {
            ctx.beginPath(); ctx.ellipse(0, -30 + bob, 34, 10, 0, Math.PI, TAU); ctx.fill();
            ctx.fillRect(18, -78 + bob, 8, 48); ctx.beginPath(); ctx.ellipse(28, -80 + bob, 12, 7, 0, 0, TAU); ctx.fill(); px(32, -83 + bob, 2, 2, '#ffd23f');
          } else {
            ctx.beginPath(); ctx.ellipse(0, -40 + bob, 30, 12, 0.2, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-28, -44 + bob); ctx.lineTo(-46, -60 + bob); ctx.lineTo(-44, -30 + bob); ctx.fill();
            px(16, -46 + bob, 3, 3, '#ffffff'); px(26, -40 + bob, 16, 3, '#4a5a6a');
          }
        } else if (k === 'bigmush') {
          ctx.scale(d.size, d.size);
          px(-8, -70, 16, 70, '#d9cbb0');
          const glow = ctx.createRadialGradient(0, -72, 4, 0, -72, 70);
          glow.addColorStop(0, 'rgba(184,255,106,0.3)'); glow.addColorStop(1, 'rgba(184,255,106,0)');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -72, 70, 0, TAU); ctx.fill();
          ctx.fillStyle = '#7a3fbf'; ctx.beginPath(); ctx.ellipse(0, -70, 50, 24, 0, Math.PI, TAU); ctx.fill();
          ctx.fillStyle = '#b8ff6a'; for (const x of [-26, 0, 22]) { ctx.beginPath(); ctx.arc(x, -80 + Math.abs(x) * 0.2, 5, 0, TAU); ctx.fill(); }
        } else if (k === 'dome') {
          ctx.scale(d.size, d.size);
          px(-40, -10, 80, 10, '#b88a2a');
          ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, -10, 34, Math.PI, TAU); ctx.fill();
          ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(-12, -26, 8, 0, TAU); ctx.fill();
          px(-1, -64, 2, 20, '#ffd23f'); px(-4, -68, 8, 6, '#fff3c4');
        } else if (k === 'spire') {
          ctx.scale(d.size, d.size);
          ctx.fillStyle = '#e0b040'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, -140); ctx.lineTo(14, 0); ctx.fill();
          for (let y = -20; y > -110; y -= 22) px(-3, y, 6, 6, Math.sin(clock * 3 + y) > 0 ? '#ffffff' : '#ffe9a0');
        } else if (k === 'crystals') {
          ctx.scale(d.size, d.size);
          for (const [x, h, r] of [[-20, 70, -0.3], [0, 100, 0], [18, 60, 0.35]]) {
            ctx.save(); ctx.rotate(r);
            ctx.fillStyle = `rgba(170,150,255,${0.6 + 0.2 * Math.sin(clock + x)})`;
            ctx.beginPath(); ctx.moveTo(x - 8, 0); ctx.lineTo(x - 8, -h); ctx.lineTo(x, -h - 12); ctx.lineTo(x + 8, -h); ctx.lineTo(x + 8, 0); ctx.fill();
            px(x - 5, -h, 3, h - 6, 'rgba(255,255,255,0.4)');
            ctx.restore();
          }
        } else if (k === 'pool') {
          ctx.fillStyle = '#1a3a3a'; ctx.beginPath(); ctx.ellipse(0, 0, 60, 10, 0, 0, TAU); ctx.fill();
          // The olm, pale and blind, wiggling in it
          const x = Math.sin(clock * 0.7) * 30;
          ctx.fillStyle = '#f2d0c8'; ctx.beginPath(); ctx.ellipse(x, -2, 16, 3, 0, 0, TAU); ctx.fill();
          px(x + 14, -4, 3, 1, '#ff9aa0'); px(x + 14, -1, 3, 1, '#ff9aa0');
        } else if (k === 'machine') {
          // A Morlock machine: boiler, chimney, a wheel turning, a piston pumping
          ctx.scale(d.size, d.size);
          px(-40, -50, 60, 50, '#4a4a52'); px(-40, -50, 60, 4, '#6a6a72');
          px(-30, -90, 12, 40, '#3a3a42');
          for (let i = 0; i < 3; i++) { const kk = ((clock * 0.5 + i / 3) % 1); ctx.fillStyle = `rgba(180,180,190,${0.4 * (1 - kk)})`; ctx.beginPath(); ctx.arc(-24, -96 - kk * 60, 6 + kk * 10, 0, TAU); ctx.fill(); }
          ctx.save(); ctx.translate(36, -30); ctx.rotate(clock * 2 + d.ph);
          ctx.strokeStyle = '#8a8a92'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke();
          for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.fillStyle = '#8a8a92'; ctx.fillRect(-1, -22, 2, 44); }
          ctx.restore();
          px(-14, -40 + Math.abs(Math.sin(clock * 3 + d.ph)) * 20, 10, 20, '#9a8a6a');
          px(-36, -30, 6, 6, Math.sin(clock * 4 + d.ph) > 0 ? '#ff8a3a' : '#5a3a20');
        } else if (k === 'wellshaft') {
          // The Morlocks' wells: round shafts with a ladder, up to the world above
          px(-14, -160, 28, 160, '#2a2a30'); px(-14, -160, 4, 160, '#4a4a52'); px(10, -160, 4, 160, '#4a4a52');
          for (let y = -10; y > -160; y -= 14) px(-6, y, 12, 2, '#6a6a72');
          ctx.fillStyle = '#ff5a4a';
          if (Math.sin(clock * 0.9 + d.a * 30) > 0.3) { px(-5, -60, 3, 3, '#ff5a4a'); px(3, -60, 3, 3, '#ff5a4a'); }
        } else if (k === 'eyes') {
          // Morlock eyes, glowing in the dark, and blinking
          ctx.fillStyle = '#08080c'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14, -24); ctx.arc(0, -24, 14, Math.PI, TAU); ctx.lineTo(14, 0); ctx.fill();
          px(-18, -42, 36, 4, '#3a3a42');
          if (Math.sin(clock * 0.7 + d.ph) > -0.6) { px(-7, -24, 5, 4, '#ff4a3a'); px(3, -24, 5, 4, '#ff4a3a'); }
        } else if (k === 'tower') {
          px(-30, -d.h, 60, d.h, '#232b33');
          for (let wy = 10; wy < d.h - 10; wy += 16) for (let wx = -22; wx < 22; wx += 14) if ((wx + wy + Math.floor(d.ph)) % 3) px(wx, -d.h + wy, 8, 8, (wx * wy + Math.floor(d.ph)) % 5 ? 'rgba(140,255,120,0.6)' : 'rgba(255,106,213,0.6)');
          px(-1, -d.h - 20, 2, 20, '#9aa3b5'); if (Math.sin(clock * 3 + d.ph) > 0) px(-2, -d.h - 22, 4, 4, '#ff5a4a');
        } else if (k === 'lizard') {
          // A lizard person in a suit, keeping watch
          const look = Math.sin(clock * 0.8 + d.ph) > 0 ? 1 : -1;
          px(-7, -26, 14, 26, '#1b1530'); px(-2, -26, 4, 10, '#ffffff'); px(-1, -24, 2, 8, '#e0433b');
          ctx.fillStyle = '#5aa04a'; ctx.beginPath(); ctx.ellipse(look * 3, -34, 9, 8, 0, 0, TAU); ctx.fill();
          px(look * 8, -36, 6, 4, '#5aa04a'); px(look * 4 - 1, -37, 3, 3, '#ffd23f'); px(look * 4, -36, 1, 2, '#1b1530');
        }
      }
    }
    ctx.restore();
  }
  // People and creatures walking about on the cavern floors
  function drawWalker(d) {
    const k = d.kind, f = d.dir || 1, step = Math.sin(clock * 6 + d.ph), legA = step * 3;
    ctx.save();
    const hp = d.hopT ? clock - d.hopT : 9;
    if (hp > 0 && hp < 0.6) { ctx.translate(0, -Math.sin((Math.PI * hp) / 0.6) * 22); if (hp < 0.3) { ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText('!', -2, k === 'dino' || k === 'mastodon' ? -110 : -64); } }
    ctx.scale(f, 1);
    if (k === 'dino') {
      ctx.fillStyle = '#5a7a4a'; ctx.beginPath(); ctx.ellipse(0, -30, 40, 20, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(30, -40); ctx.rotate(-0.25 + Math.sin(clock * 0.8 + d.ph) * 0.12); ctx.fillRect(-4, -50, 9, 52); ctx.beginPath(); ctx.ellipse(4, -52, 12, 7, 0, 0, TAU); ctx.fill(); px(9, -55, 2, 2, '#1b1530'); ctx.restore();
      ctx.beginPath(); ctx.moveTo(-36, -34); ctx.lineTo(-80, -14 + Math.sin(clock * 2) * 4); ctx.lineTo(-36, -24); ctx.fill();
      px(-26 + legA, -14, 9, 14, '#4a6a3a'); px(14 - legA, -14, 9, 14, '#4a6a3a');
    } else if (k === 'mastodon') {
      ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.ellipse(0, -34, 30, 20, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(26, -40, 13, 0, TAU); ctx.fill(); px(34, -36, 4, 20 + Math.sin(clock * 2 + d.ph) * 3, '#6a4a30');
      ctx.strokeStyle = '#f2e6d0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(40, -22, 10, Math.PI, Math.PI * 1.6); ctx.stroke();
      px(-20 + legA, -16, 8, 16, '#5a3a20'); px(12 - legA, -16, 8, 16, '#5a3a20'); px(28, -44, 2, 2, '#1b1530');
    } else if (k === 'shepherd') {
      // Verne's giant shepherd, minding the mastodons
      px(-6 + legA, -40, 5, 40, '#5a3a20'); px(2 - legA, -40, 5, 40, '#5a3a20'); px(-9, -86, 18, 48, '#7a6a4a');
      ctx.fillStyle = '#c9a27a'; ctx.beginPath(); ctx.arc(0, -94, 9, 0, TAU); ctx.fill(); px(-10, -104, 20, 6, '#3a2a1a');
      px(12, -110, 3, 110, '#8a6a3a'); px(9, -112, 9, 4, '#8a6a3a');
    } else if (k === 'sagoth') {
      ctx.fillStyle = '#3a2e2a'; ctx.beginPath(); ctx.ellipse(0, -30, 14, 20, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(4, -54, 9, 0, TAU); ctx.fill();
      px(-14, -40, 5, 24 + legA, '#3a2e2a'); px(10, -40, 5, 24 - legA, '#3a2e2a'); px(-8 + legA, -12, 6, 12, '#3a2e2a'); px(2 - legA, -12, 6, 12, '#3a2e2a'); px(7, -56, 2, 2, '#ffd23f');
    } else if (k === 'agarthan') {
      // A robed Agarthan, with a glowing staff
      ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-6, -36); ctx.lineTo(6, -36); ctx.lineTo(10, 0); ctx.fill();
      ctx.fillStyle = '#e0b090'; ctx.beginPath(); ctx.arc(0, -42, 6, 0, TAU); ctx.fill(); px(-7, -48, 14, 3, '#ffd23f');
      px(10, -50, 2, 50, '#b88a2a'); ctx.fillStyle = `rgba(180,255,255,${0.6 + 0.4 * Math.sin(clock * 5 + d.ph)})`; ctx.beginPath(); ctx.arc(11, -52, 4, 0, TAU); ctx.fill();
    } else if (k === 'miner' || k === 'opalminer' || k === 'shelterer' || k === 'villager') {
      const coat = k === 'miner' ? '#5a6a7a' : k === 'opalminer' ? '#a5713f' : k === 'shelterer' ? '#4a5a3a' : '#8a5a4a';
      px(-4 + legA * 0.6, -14, 4, 14, '#2a2230'); px(1 - legA * 0.6, -14, 4, 14, '#2a2230');
      px(-6, -32, 12, 18, coat); ctx.fillStyle = '#e0b090'; ctx.beginPath(); ctx.arc(0, -37, 5, 0, TAU); ctx.fill();
      if (k === 'miner' || k === 'opalminer') { px(-6, -44, 12, 4, '#ffd23f'); px(5, -43, 3, 3, '#fff3b0'); const g = ctx.createLinearGradient(6, 0, 70, 0); g.addColorStop(0, 'rgba(255,240,180,0.35)'); g.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(7, -42); ctx.lineTo(70, -52); ctx.lineTo(70, -28); ctx.fill(); }
      if (k === 'villager') px(6, -34, 2, 34, '#6b4a2a');
      if (k === 'shelterer') px(-10, -30, 4, 10, '#c9a27a');
    } else if (k === 'goat') {
      px(-12, -18, 22, 10, '#e8e0d0'); px(8, -24, 8, 8, '#e8e0d0'); px(12, -28, 2, 5, '#8a7a6a');
      px(-10 + legA * 0.5, -8, 3, 8, '#8a7a6a'); px(5 - legA * 0.5, -8, 3, 8, '#8a7a6a');
    } else if (k === 'morlock') {
      // A Morlock: pale, hunched, huge red eyes, a lantern swinging
      ctx.fillStyle = '#d8d0d8'; ctx.beginPath(); ctx.ellipse(0, -24, 10, 16, 0.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(8, -40, 8, 0, TAU); ctx.fill();
      px(8, -43, 4, 4, '#ff3a2a'); px(12, -43, 2, 4, '#ff3a2a');
      px(-6 + legA, -10, 4, 10, '#c9c0c9'); px(2 - legA, -10, 4, 10, '#c9c0c9');
      ctx.save(); ctx.translate(12, -26); ctx.rotate(Math.sin(clock * 3 + d.ph) * 0.4); px(-1, 0, 2, 12, '#5a5a5a'); ctx.fillStyle = 'rgba(255,190,90,0.9)'; ctx.beginPath(); ctx.arc(0, 15, 4, 0, TAU); ctx.fill(); ctx.restore();
    } else if (k === 'lizard') {
      px(-5 + legA * 0.6, -14, 4, 14, '#1b1530'); px(1 - legA * 0.6, -14, 4, 14, '#1b1530');
      px(-7, -36, 14, 22, '#1b1530'); px(-2, -36, 4, 10, '#ffffff'); px(-1, -34, 2, 8, '#e0433b');
      ctx.fillStyle = '#5aa04a'; ctx.beginPath(); ctx.ellipse(3, -44, 9, 8, 0, 0, TAU); ctx.fill(); px(8, -46, 7, 4, '#5aa04a');
      px(5, -47, 3, 3, '#ffd23f'); px(6, -46, 1, 2, '#1b1530');
      const tongue = Math.sin(clock * 4 + d.ph) > 0.85; if (tongue) px(15, -44, 6, 1, '#ff5a7a');
      px(-12, -18, 6, 3, '#5aa04a'); // tail peeking out of the suit
    } else if (k === 'minecart') {
      px(-26, -6, 52, 3, '#5a4a3a');
      px(-20, -26, 40, 18, '#6a5a4a'); px(-18, -30, 36, 6, '#c9864a');
      for (let i = 0; i < 3; i++) px(-14 + i * 10, -34, 6, 5, ['#6dd3ff', '#ff6ad5', '#ffd23f'][(i + Math.floor(clock * 2)) % 3]);
      ctx.fillStyle = '#2a2a30'; for (const x of [-12, 12]) { ctx.beginPath(); ctx.arc(x, -6, 5, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  // Movers: bat swarms and the Iron Mole drills
  function drawHollowMovers() {
    for (const q of world.movers || []) {
      if (q.kind !== 'mole') continue;
      const down = q.R - zoneBase(hollowZone((q.R - R0 - 30) / TIER_GAP));
      at(q.a0 + theta, q.R, () => {
        px(-q.amp - 50, 16, (q.amp + 50) * 2, 6, '#4a5260'); px(-q.amp - 50, 16, (q.amp + 50) * 2, 2, '#8a93a4');
        for (let x = -q.amp - 40; x <= q.amp + 40; x += 160) px(x - 3, 22, 6, down - 22, '#3a4250');
      }, q.amp + down + 100);
    }
    for (const q of world.movers || []) {
      at(q.a + theta, q.R, () => {
        if (q.kind === 'bats') {
          for (let i = 0; i < 6; i++) {
            const bx = Math.cos(i * 1.7 + clock * 3) * 22, by = Math.sin(i * 2.3 + clock * 4) * 14, f = Math.sin(clock * 20 + i) > 0 ? 6 : 2;
            ctx.fillStyle = '#1b1530'; ctx.beginPath(); ctx.moveTo(bx - 9, by - f); ctx.lineTo(bx, by + 2); ctx.lineTo(bx + 9, by - f); ctx.lineTo(bx, by - 2); ctx.fill();
            px(bx - 1, by - 2, 1, 1, '#ff5a4a');
          }
        } else {
          const dir = Math.cos(clock * q.sp + q.ph) > 0 ? 1 : -1;
          ctx.scale(dir, 1);
          px(-30, -14, 40, 28, q.flash > 0.5 ? '#ffffff' : '#8a93a4'); px(-30, -14, 40, 4, '#c9ced9'); px(-22, -6, 8, 8, '#ffd23f');
          ctx.fillStyle = '#c9ced9'; ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(36, 0); ctx.lineTo(10, 14); ctx.fill();
          ctx.strokeStyle = '#5d6472'; ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) { const o = ((clock * 40 + i * 9) % 26); ctx.beginPath(); ctx.moveTo(10 + o, -14 + o * 0.54); ctx.lineTo(10 + o, 14 - o * 0.54); ctx.stroke(); }
        }
      }, 80);
    }
  }
  // What holds each platform up: stalks and trunks growing from the cavern
  // floor, crystal pillars, struts and basalt columns, ropes or roots from the
  // roof, or (in Agartha) the glow of the vril that keeps the discs aloft
  function hollowSupport(p, w) {
    const z = hollowZone(p.tier), floorR = z === 0 ? R0 : zoneBase(z), ceilR = z < HOLLOW.length - 1 ? zoneBase(z + 1) - 48 : tierR(TOP) + 200;
    const down = Math.max(0, p.R - floorR), up = Math.max(0, ceilR - p.R), t = p.type;
    if (t === 'mush' || t === 'sway') { px(-5, 10, 10, down - 10, '#cfc2a6'); px(-5, 10, 3, down - 10, '#e6dcc4'); px(-12, down - 6, 24, 6, '#8a7a5a'); }
    else if (t === 'fern') { px(-4, 8, 8, down - 8, '#5a3a20'); for (let y = 30; y < down; y += 40) px(-6, y, 12, 3, '#4a2a18'); }
    else if (t === 'crystal') { ctx.fillStyle = 'rgba(109,211,255,0.35)'; ctx.fillRect(-9, 16, 18, down - 16); px(-3, 16, 2, down - 16, 'rgba(230,250,255,0.6)'); }
    else if (t === 'girder') { for (const x of [-w / 2 + 8, w / 2 - 12]) px(x, 8, 4, down - 8, '#5a4a3a'); for (let y = 30; y < down; y += 36) { ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + 10, y); ctx.lineTo(w / 2 - 10, y + 30); ctx.stroke(); } }
    else if (t === 'rock') { px(-w / 4, 24, w / 2, down - 24, '#3a1a12'); for (let y = 40; y < down; y += 50) px(-2, y, 4, 20, '#ff6a1a'); }
    else if (t === 'neon') { for (const x of [-w / 2 + 6, w / 2 - 8]) px(x, 10, 2, down - 10, '#4a5260'); }
    else if (t === 'raft' || t === 'ledge') { ctx.strokeStyle = t === 'raft' ? '#a5824a' : '#6b4a2a'; ctx.lineWidth = 2; for (const x of [-w / 2 + 6, w / 2 - 6]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x * 0.6, -up); ctx.stroke(); } }
    else if (t === 'gold') { const g = ctx.createLinearGradient(0, 10, 0, 140); g.addColorStop(0, `rgba(180,255,255,${0.35 + 0.15 * Math.sin(clock * 4 + p.spin)})`); g.addColorStop(1, 'rgba(180,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w * 0.3, 10); ctx.lineTo(w * 0.3, 10); ctx.lineTo(w * 0.15, 140); ctx.lineTo(-w * 0.15, 140); ctx.fill(); }
  }
  // Platforms for the hollow Earth (drawn with the level 2 set)
  const HOLLOW_PLATS = {
    mush(p, w) {
      px(-6, 4, 12, 26, '#d9cbb0');
      ctx.fillStyle = '#7a3fbf'; ctx.beginPath(); ctx.ellipse(0, 4 + p.squash * 4, w / 2, 14 - p.squash * 4, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#b8ff6a'; for (const k of [-0.3, 0, 0.28]) { ctx.beginPath(); ctx.arc(k * w, -4 + Math.abs(k) * 8, 4, 0, TAU); ctx.fill(); }
    },
    fern(p, w) {
      ctx.fillStyle = '#3f8f3a';
      for (let i = -3; i <= 3; i++) { ctx.save(); ctx.rotate(i * 0.12); ctx.beginPath(); ctx.ellipse(i * w * 0.07, 6, w * 0.16, 7, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      px(-3, 8, 6, 40, '#6b4a2a');
    },
    raft(p, w) { for (let i = 0; i < 5; i++) px(-w / 2 + (i * w) / 5, 0, w / 5 - 2, 12, i % 2 ? '#8a5a3b' : '#a5713f'); px(-w / 2, 4, w, 2, '#5a3a28'); },
    gold(p, w) {
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 6, w / 2, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b88a2a'; ctx.beginPath(); ctx.ellipse(0, 10, w / 2, 8, 0, 0, Math.PI); ctx.fill();
      for (let i = 0; i < 5; i++) px(-w / 2 + 8 + i * (w - 16) / 4, 2, 4, 4, Math.sin(clock * 4 + i) > 0 ? '#ffffff' : '#fff3c4');
    },
    crystal(p, w) {
      if (p.breakAt) ctx.translate((Math.random() - 0.5) * 3, 0);
      ctx.fillStyle = 'rgba(109,211,255,0.12)'; ctx.beginPath(); ctx.ellipse(0, 4, w * 0.6, 14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6dd3ff'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 4, 18); ctx.lineTo(w / 4, 18); ctx.lineTo(w / 2, 0); ctx.lineTo(0, -8); ctx.fill();
      px(-4, -2, 8, 10, '#e6fbff');
    },
    sway(p, w) {
      px(-6, 4, 12, 40, '#d9cbb0');
      ctx.fillStyle = '#c0452a'; ctx.beginPath(); ctx.ellipse(0, 4, w / 2, 16, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#ffe6c0'; for (const k of [-0.3, 0, 0.28]) { ctx.beginPath(); ctx.arc(k * w, -4 + Math.abs(k) * 8, 4, 0, TAU); ctx.fill(); }
    },
    girder(p, w) { px(-w / 2, 0, w, 10, '#6a5a4a'); for (let x = -w / 2; x < w / 2 - 8; x += 14) { ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 7, 10); ctx.lineTo(x + 14, 0); ctx.stroke(); } px(-w / 2, 0, w, 2, '#9a8a6a'); },
    rock(p, w) { ctx.fillStyle = '#4a2a20'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 3, 26); ctx.lineTo(-w / 3, 26); ctx.fill(); px(-w / 2, 0, w, 3, '#ff8a3a'); },
    neon(p, w) { px(-w / 2, 0, w, 10, '#2a2f38'); px(-w / 2, 0, w, 3, Math.sin(clock * 4 + p.spin) > 0 ? '#ff6ad5' : '#8fff6a'); },
    ledge(p, w) { px(-w / 2, 0, w, 12, '#6b4a2a'); px(-w / 2, 0, w, 3, '#4fb34a'); },
    hole(p, w) {
      // The way out: a hole in the crust, with daylight pouring down
      const g = ctx.createLinearGradient(0, -120, 0, 60);
      g.addColorStop(0, 'rgba(220,240,255,0.9)'); g.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w / 2, -120); ctx.lineTo(w / 2, -120); ctx.lineTo(w, 60); ctx.lineTo(-w, 60); ctx.fill();
      px(-w / 2, 0, w, 10, '#4fb34a');
      ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#1b1530'; ctx.fillText('WAY OUT', 0, -20); ctx.textAlign = 'start';
    },
  };

  function update(dt) {
    clock += dt;
    if (state === 'splash' || state === 'tour' || state === 'descend') { updateIntro(dt); return; }
    if (fx.launch && !fx.run) { updateLaunch(dt); return; }
    if (fx.sling) { updateSling(dt); return; }
    if (fx.rings7) { updateRings7(dt); return; }
    if (fx.run) { updateRunFrame(dt); return; }
    if (fx.arrive) { updateArriveFrame(dt); return; }
    if (fx.climb) { updateClimb(dt); return; }
    if (level === 1 && world.life) updateEarthLife(dt);
    if (fx.burrow && fx.burrow.phase === 1) { updateBurrow(dt); return; }
    if (fx.burrow && level === 6 && player.r < hollowOuter() - 500) fx.burrow = null;
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
      player.hopLock = Math.max(0, (player.hopLock || 0) - dt);
      const dir = player.inside || player.carried || player.hopLock > 0 ? 0 : kdir !== 0 ? kdir : tilt.on ? (level === 3 && flipK > 0.5 ? tilt.fb : tilt.axis) : 0;
      if (Math.abs(dir) > 0.1) player.facing = Math.sign(dir);
      const sp = player.speed;
      const maxV = player.onGround ? WALK : AIR * Math.sqrt(sp);
      // In the belt's zero gravity, sideways speed carries on until you steer
      if (player.hopLock > 0 && !player.onGround) player.vx = player.hopVx || 0;
      else if (beltFlight() && Math.abs(dir) < 0.1) player.vx = clamp(player.vx, -900, 900);
      else player.vx = approach(player.vx, dir * maxV, (player.onGround ? 1800 : 1200 * sp) * dt);
      theta -= (player.vx * dt) / player.r;
      if (player.onGround && Math.abs(player.vx) > 5) {
        const before = Math.floor(player.walkT);
        player.walkT += dt * (Math.abs(player.vx) / 22);
        if (Math.floor(player.walkT) !== before && Math.floor(player.walkT) % 2 === 0) {
          sfx.step();
          burst(-theta, level === 6 ? player.r : R0, level === 6 ? '#b8a080' : level === 5 ? '#8d8a86' : level === 4 ? '#f2d98a' : level === 3 ? '#c8603c' : level === 2 ? '#b4b2be' : '#c9a27a', 2, 50);
        }
      }

      // Hollow Earth: walk into a cavern floor's gap and you drop through it
      if (level === 6 && player.onGround && player.r > R0 + 1) {
        const sh = world.shells.find((q) => Math.abs(q.R - player.r) < 2);
        if (!sh || shellGap(sh)) { player.onGround = false; player.vr = -80; player.apexR = player.r; player.lastPlat = null; pop('DOWN YOU GO!', '#ffab3d', player.r + 80); sfx.fall(); }
      }
      // Walk up to a trampoline (or launch pad) and you hop straight on
      if (player.onGround && (player.r <= R0 + 1 || level === 6)) {
        for (const q of world.plats) {
          if ((level === 6 ? !(q.R > player.r + 20 && q.R < player.r + 150) : q.tier !== 0) || ghost(q) || q.broken) continue;
          // Close enough and heading its way (or already under it): hop on in
          // one smooth arc that lands you on its middle
          const d = wrap(q.a + theta) * q.R;
          if (Math.abs(d) < q.w / 2 + 46 && (Math.abs(d) < q.w / 2 - 6 || Math.sign(d) === Math.sign(player.vx))) {
            const g = gravAt(0), vr = Math.min(HOP_V, Math.sqrt(2 * G * g * 160)), a = G * g, h = Math.max(0, q.R - player.r);
            const tFly = (vr + Math.sqrt(Math.max(0, vr * vr - 2 * a * h))) / a;
            jumpBuffer = 0.1; player.hopVx = clamp(d / tFly, -600, 600); player.hopLock = 3;
            break;
          }
        }
      }
      jumpBuffer -= dt;
      if (player.onGround && jumpBuffer > 0) {
        player.g = gravAt(0); player.vr = Math.min(HOP_V, Math.sqrt(2 * G * player.g * 160)); player.speed = 1; player.onGround = false; jumpBuffer = 0;
        player.apexR = player.r; player.lastPlat = null; player.lastH = 0;
        player.squash = -0.6;
        sfx.hop();
        burst(-theta, level === 6 ? player.r : R0, level === 6 ? '#b8a080' : level === 5 ? '#8d8a86' : level === 4 ? '#f2d98a' : level === 3 ? '#c8603c' : level === 2 ? '#b4b2be' : '#c9a27a', 5, 80);
      }
      if (player.inside) {
        player.r = player.lastPlat.R + 14; player.vr = 0; player.vx = 0;
      }
      // Hit the Space Station (from above or below) to dock and suit up
      const iss = world.issPlat;
      if (iss && !player.suit && !player.inside && iss.ride.state === 'near'
        && Math.abs(wrap(iss.a + theta) * iss.R) < iss.w / 2 + 6 && Math.abs(player.r - (iss.R + 10)) < 34) dock(iss);
      if (!player.onGround && !player.inside && !player.carried) {
        const prev = player.r;
        player.apexR = Math.max(player.apexR || player.r, player.r);
        if (beltFlight()) {
          // Out in the belt nothing pulls you back to Mars: you keep your
          // speed. Only if you've all but stopped does the belt's drift
          // nudge you gently on.
          if (Math.abs(player.vr) < BELT_CRUISE) player.vr += (BELT_CRUISE - player.vr) * Math.min(1, dt * 0.5);
          player.vr = clamp(player.vr, -1100, 1300);
        } else {
          // Lost in space (level 3): you drift back slowly, so there's time to steer for the beam
          const drift = player.lost === true ? 0.35 : player.adrift ? 0 : 1;
          player.vr = Math.max(player.vr - G * (player.g || 1) * player.speed * player.speed * dt * drift, -1600 * player.speed);
          const sink = BELT_SINK * Math.sqrt(player.speed);
          if (inBelt() && player.vr < -sink) player.vr += (-sink - player.vr) * Math.min(1, dt * 2.5);
        }
        player.r += player.vr * dt;
        if (state === 'play' && climbOut() && lastTier === TOP - 1 && player.vr > 0 && player.r > tierR(TOP - 1) + 120) { startClimb(); return; }
        if (state === 'play' && player.backTo && player.vr > 0 && player.r > player.backR + 120) { startClimb(player.backTo, true); return; }
        // Close to the world you're heading for, its gravity takes hold and
        // pulls you in
        if (state === 'play' && !beltFlight() && player.vr > 0) {
          for (const p of world.plats) {
            if (!p.dest || ghost(p) || p.broken) continue;
            if (prev < p.R - 60 && player.r >= p.R - 60 && Math.abs(wrap(p.a + theta) * p.R) <= p.w / 2 + 160) { reachDest(p); break; }
          }
          if (fx.arrive) return;
        }
        if (beltFlight() && player.vr > 0) {
          // Flying forward into a platform: it's a speed booster, and a belt
          // world catches you as you reach its near side
          for (const p of world.plats) {
            if (p.tier < FLIP) continue;
            // A world is reached when your head touches its near side
            const near = p.dest ? p.R - p.world.r * 2 - 44 : p.R, half = p.dest ? p.world.r * 0.9 : p.w / 2 + 8;
            if (prev < near && player.r >= near && Math.abs(wrap(p.a + theta) * p.R) <= half) {
              land(p);
              if (p.dest) { player.r = near - 4; player.spin = Math.PI; } // turned round, feet on the world
              break;
            }
          }
        }
        // Dropping onto a new world: air (where there is some) slows you
        // more and more as you get lower
        if (fx.drop) { player.heat = 0; player.vr = Math.max(player.vr, level === 6 ? -1500 : AIRY(level) ? -lerp(330, 680, clamp((player.r - R0) / 900, 0, 1)) : -650); }
        if (fx.drop && level === 6) {
          // Crashing down through each cavern's floor (slowing near the bottom)
          for (const sh of world.shells) if (prev >= sh.R && player.r < sh.R) { burst(-theta, sh.R, '#8a7056', 18, 320); ring(-theta, sh.R, ZONE_GLOW[sh.zone], 1.6); addShake(8); sfx.thud(); }
          if (player.r < R0 + 900) player.vr = Math.max(player.vr, -lerp(380, 1500, clamp((player.r - R0) / 900, 0, 1)));
        }
        if (player.vr < 0 && !fx.drop) {
          let landed = false;
          for (const p of world.plats) {
            if (ghost(p) || p.broken) continue;
            if (prev >= p.R && player.r <= p.R && Math.abs(wrap(p.a + theta) * p.R) <= p.w / 2 + 8) { land(p); landed = true; break; }
          }
          // Hollow Earth: each cavern's floor catches you, unless you're over its gap
          if (!landed && level === 6) for (const sh of world.shells) if (prev >= sh.R && player.r <= sh.R && !shellGap(sh)) { landShell(sh); break; }
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
        if (state === 'play' && mode === 'checkpoint' && checkpoint > 0 && !player.lost && player.vr < 0 && player.r < tierR(checkpoint) - 180) rescue();
        if (state === 'play' && player.r <= R0) {
          const hard = player.vr < -900;
          if (lastTier >= 0) { falls++; loseMult(); }
          if (fx.drop) { fx.drop = false; addShake(6); sfx.thud(); }
          player.r = R0; player.vr = 0; player.onGround = true; player.squash = 1; player.lost = false;
          if (player.heat > 0.3 && conspiracy && level === 1) startBurrow();
          else if (player.heat > 0.3) impact(player.heat);
          else if (level === 2 && hard) moonCrash();
          else if (lastTier >= 0) { toast(level === 7 ? "Jupiter's pull dragged you back down to Europa. Bounce back up and catch that spacecraft!" : level === 6 ? 'Back down in Pellucidar by the inner sun. Bounce back up!' : level === 5 ? `Back on ${l5Start.name}, score and all. Bounce back up!` : level === 4 ? 'Back on the clouds of Venus, score and all. Bounce back up!' : level === 3 ? 'Back on Mars, score and all. Bounce back up from the launch field!' : level === 2 ? 'Back on the Moon. Find a launch pad!' : 'Back on solid ground. Find a trampoline!'); sfx.thud(); addShake(hard ? 12 : 6); ring(-theta, R0, level === 5 ? '#8d8a86' : level === 4 ? '#f2d98a' : level === 3 ? '#c8603c' : level === 2 ? '#b4b2be' : '#c9a27a', 1.4); }
          if (level >= 2) { route = null; aimFor = null; updateStarsHud(); }
          player.heat = 0; fx.flames = [];
          lastTier = -1; fx.streak = 0; fx.whistled = false;
          player.lastPlat = null; player.lastH = 0;
          burst(-theta, R0, level === 5 ? '#6c6966' : level === 4 ? '#e6c46a' : level === 3 ? '#9a3b2a' : level === 2 ? '#8a8896' : '#8a5a3b', hard ? 18 : 8, hard ? 180 : 90);
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
        if (s.taken || s.run || ghost(s)) continue;
        const d = pull(s, s.big ? 200 : 150);
        if (d < (s.big ? 60 : 28)) {
          s.taken = true;
          if (s.fact) { toast(s.fact.text, 6); addScore(500); pop(s.fact.kind === 'marsrock' ? 'MARS ROCK!' : s.fact.kind === 'earthrise' ? 'EARTHRISE!' : 'SPACE PROBE!', '#ffab3d', player.r + 140); }
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
      updateTumble(dt);
      if (level >= 2) updateSpace(dt);
    }

    player.squash = player.squash > 0 ? Math.max(0, player.squash - dt * 5) : Math.min(0, player.squash + dt * 4);
    // Re-entry: only a real miss heats you up. It's measured below the platform
    // you last bounced off, so rebounds and near misses never catch fire.
    const launchR = player.lastPlat ? player.lastPlat.R : R0;
    const below = !player.onGround && player.vr < 0 ? launchR - player.r : 0;
    // A long fall turns you into a fireball on the way back down, in every
    // level (on the Moon that's game physics: there's no air to burn in)
    const heatWant = state === 'play' && level !== 6 && !beltFlight() && !player.adrift && !inBelt() ? clamp((below - 100) / 400, 0, 1) : 0;
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
      fx.trail.push({ a: -theta, r: player.r, flip: player.facing < 0, life: 0.16, spin: player.spin || 0 });
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
    if (snd) snd.music.set({ tierF: tierFloat(player.r) + (level >= 2 ? 9 : 0), speed: player.speed, won: state === 'won', belt: state === 'play' && (beltK() > 0.5 || level === 5) });
    for (const q of particles) {
      q.R += q.vr * dt; q.a += (q.vt * dt) / q.R; q.vr -= 380 * dt; q.life -= dt;
    }
    particles = particles.filter((q) => q.life > 0);

    // Level 3: past halfway the view turns so the belt lies off to the right
    const flipWant = SIDEWAYS && level === 3 && state !== 'title' && player.r > tierR(FLIP) - TIER_GAP * 0.5 ? 1 : 0;
    flipK = approach(flipK, flipWant, dt / 1.3);
    if (flipWant && !fx.flipShown && state === 'play') {
      fx.flipShown = true;
      fx.meteors = []; // nothing in the way at the turn
      banner('SIDEWAYS!', "JUPITER'S PULL");
      toast(!touch ? 'Jupiter swings you round: the belt is to the right now. Steer with ↑ ↓ (or W S).'
        : tilt.on ? 'Jupiter swings you round: the belt is to the right now. Tip the phone forward to go up, back to go down.'
        : 'Jupiter swings you round: the belt is to the right now. Steer with ▲ ▼.', 5);
      sfx.whoosh();
    }
    if ((flipK > 0.5) !== document.body.classList.contains('flipped')) setPadFlip(flipK > 0.5);

    // Camera: follow height, and look further down while falling.
    cam.r += (player.r - cam.r) * Math.min(1, dt * (fx.drop ? 14 : 7));
    // (dropping onto a new world: look down at it coming up to meet you)
    const want = fx.drop ? 0.24 : player.vr < -250 ? 0.34 : 0.46;
    cam.anchor = lerp(cam.anchor || want, want, Math.min(1, dt * 2));
    // Pull the camera out during a ride so you can watch the Earth turn below.
    const onRide = player.lastPlat && player.lastPlat.ride && (player.lastPlat.ride.state === 'moving') && riding(player.lastPlat);
    const zWant = onRide ? clamp((H * 0.42) / (player.r - R0 + 80), 0.1, 1) : 1;
    cam.zoom = lerp(cam.zoom, zWant, Math.min(1, dt * (onRide ? 1.6 : 1.2)));
    if (fx.land) {
      // Coming in to land on the new world: it grows steadily under your feet
      fx.land.t += dt;
      if (fx.land.t > LAND_T) fx.land = null;
    }

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0.4) hud.toast.style.opacity = '0';
      if (toastTimer <= 0) hud.toast.hidden = true;
    }
    hud.alt.textContent = level === 6 ? `${fmtKm(Math.max(0, 30 * (1 - tierFloat(player.r) / TOP)))} down` : fmtKm(kmAt(player.r));
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
    if (level === 6) { drawHollowSky(); return; }
    if (level === 7) { drawEuropaSky7(); return; }
    if (level === 5) { drawBeltSky5(); return; }
    if (level === 4) { drawVenusSky(); return; }
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
    const mr = fx.arrive && fx.arrive.target === p ? fx.arrive.gr : MOON_R;
    const rc = p.R - mr;
    const xW = cx + rc * Math.sin(phi), yW = cy - rc * Math.cos(phi);
    const k = clamp((tf - (TOP - 5)) / (5 - 0.6), 0, 1);
    const t = k * k * (3 - 2 * k); // smoothstep
    if (climbOut()) {
      // It grows as you climb, then slides up out of sight above you: you'll
      // bounce up after it and come down on it from the other side
      const up = smooth(clamp((tf - (TOP - 4)) / 2.6, 0, 1)), rr = rS * (1 + 1.6 * k);
      return { p, phi, t: 0, x: xS, y: yS - up * (yS + rr * 1.7 + 40), r: rr, alpha: lerp(0.55 + f * 0.45, 1, k) };
    }
    const r = lerp(rS, mr, t);
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
    mercury: { glow: '220,215,210', body: '#a9a39c', spots: '#7f7973' },
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
      if (type === 'mercury') {
        // Caloris Basin: one of the biggest impact craters in the Solar System
        ctx.strokeStyle = '#c9c3bb'; ctx.lineWidth = Math.max(1, r * 0.03);
        ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.3, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#d8d2ca';
        for (const [cxo, cyo, cr] of [[-0.6, 0.0, 0.05], [0.2, 0.7, 0.04], [-0.2, -0.65, 0.045], [0.65, 0.3, 0.035]]) { ctx.beginPath(); ctx.arc(x + cxo * r, y + cyo * r, cr * r, 0, TAU); ctx.fill(); }
      }
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
    if (route !== 'earth') drawPlanet('earth', W * 0.84, H * 0.17 + tf * 22, 46 / (1 + tf * 0.45));
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

  // Level 4. Above Venus's clouds the sky is a hazy gold; it turns black as
  // you climb, and the Sun gets bigger and fiercer all the way to Mercury
  // (from Mercury it looks about three times as wide as it does from Earth)
  function drawVenusSky() {
    const tf = tierFloat(player.r), f = tf / TOP;
    const air = clamp(1 - tf / 2.8, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix('#0b0a10', '#d9a94e', air)); g.addColorStop(1, mix('#22160e', '#f6dfa0', air));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1 - air;
    for (const st of world.sky) {
      let x = (st.x * W - theta * 200) % W; if (x < 0) x += W;
      px(x, st.y * H, st.s, st.s, st.s > 1 ? '#fff3c4' : '#c9d7f0');
    }
    ctx.globalAlpha = 1;
    const f2 = fx.flare, warn = f2 && !f2.hit ? 0.5 + 0.5 * Math.sin(clock * 12) : 0;
    const sx = W * 0.5, sy = -H * 0.02, sr = 26 + f * 70;
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4);
    sg.addColorStop(0, `rgba(255,236,170,${0.75 + warn * 0.2})`); sg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    // Loops of glowing plasma on the Sun's edge (prominences), wilder before a flare
    ctx.strokeStyle = `rgba(255,150,60,${0.5 + warn * 0.4})`; ctx.lineWidth = 3 + warn * 3;
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI * (0.15 + i * 0.14), lx = sx + Math.cos(ang) * sr, ly = sy + Math.sin(ang) * sr;
      const h = sr * (0.18 + 0.08 * Math.sin(clock * 1.3 + i * 2) + warn * 0.2);
      ctx.beginPath(); ctx.arc(lx + Math.cos(ang) * h * 0.5, ly + Math.sin(ang) * h * 0.5, h * 0.6, ang + Math.PI * 0.9, ang + Math.PI * 2.1); ctx.stroke();
    }
    if (tf > 0.5) {
      // Earth: a blue dot far behind you
      ctx.globalAlpha = clamp((tf - 0.5) / 1.5, 0, 1);
      drawPlanet('earth', W * 0.86, H * 0.3, 5);
      ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(238,241,255,0.75)';
      ctx.fillText('EARTH', W * 0.86, H * 0.3 + 16); ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
    }
    drawSkyMoon();
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
    // Home, seen from Mars: a bright blue evening star, with the Moon beside it
    const [ex, ey] = EARTH_FROM_MARS();
    const eg = ctx.createRadialGradient(ex, ey, 2, ex, ey, 22);
    eg.addColorStop(0, 'rgba(150,200,255,0.75)'); eg.addColorStop(1, 'rgba(150,200,255,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3f7fe0'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4fb34a'; ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e6e4ec'; ctx.beginPath(); ctx.arc(ex + 11, ey - 4, 1.6, 0, TAU); ctx.fill();
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = 'rgba(40,14,8,0.5)'; ctx.fillText('EARTH', ex + 1, ey + 19);
    ctx.fillStyle = '#eef5ff'; ctx.fillText('EARTH', ex, ey + 18);
    // The details only while you're still at Mars
    ctx.globalAlpha = clamp(1 - tf / 3, 0, 1);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = 'rgba(238,245,255,0.85)'; ctx.fillText('AND THE MOON', ex, ey + 27);
    ctx.fillText('ABOUT 225 MILLION KM AWAY', ex, ey + 35);
    ctx.globalAlpha = 1;
    ctx.font = '6px "Press Start 2P", monospace';
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
    // Once you're in the belt: asteroids far off in the background, sliding
    // past slowly as you go (the nearer ones faster)
    const bk = beltK();
    if (bk > 0 && world.far) {
      const travel = cam.r - tierR(FLIP);
      const wrapTo = (v, span) => ((v % span) + span) % span;
      // A faint haze of dust along the belt
      const hz = ctx.createLinearGradient(0, 0, 0, H);
      hz.addColorStop(0, 'rgba(120,100,90,0)'); hz.addColorStop(0.5, `rgba(120,100,90,${0.1 * bk})`); hz.addColorStop(1, 'rgba(120,100,90,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H);
      for (const q of world.far) {
        const x = wrapTo(q.x * (W + q.r * 4) + theta * q.depth * 900, W + q.r * 4) - q.r * 2;
        const y = wrapTo(q.y * (H + q.r * 4) + travel * q.depth * 0.6, H + q.r * 4) - q.r * 2;
        const a = bk * (0.3 + q.depth * 0.9);
        ctx.save(); ctx.translate(x, y); ctx.rotate(q.spin + clock * q.turn);
        const shape = () => { ctx.beginPath(); q.shape.forEach((k, i) => { const ang = (i * TAU) / 9; i ? ctx.lineTo(Math.cos(ang) * q.r * k, Math.sin(ang) * q.r * k) : ctx.moveTo(q.r * k, 0); }); ctx.closePath(); };
        ctx.globalAlpha = a;
        ctx.fillStyle = mix('#1a1820', '#5a5260', q.depth); shape(); ctx.fill();
        // Lit from the Sun's side, shaded on the other, a crater or two
        ctx.save(); shape(); ctx.clip();
        ctx.rotate(-(q.spin + clock * q.turn));
        ctx.fillStyle = `rgba(255,236,210,${0.18 + q.depth * 0.2})`; ctx.beginPath(); ctx.arc(-q.r * 0.45, -q.r * 0.45, q.r * 0.9, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(q.r * 0.5, q.r * 0.5, q.r * 0.8, 0, TAU); ctx.fill();
        ctx.restore();
        if (q.r > 6) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(q.r * 0.2, -q.r * 0.1, q.r * 0.22, 0, TAU); ctx.fill(); }
        ctx.restore();
        // Now and then a glint of sunlight off a shiny face
        const g = (clock + q.glint) % 20;
        if (g < 0.4) { ctx.globalAlpha = a * (1 - Math.abs(g - 0.2) / 0.2); px(x - 1 - q.r * 0.3, y - 4 - q.r * 0.3, 2, 8, '#fff6e0'); px(x - 4 - q.r * 0.3, y - 1 - q.r * 0.3, 8, 2, '#fff6e0'); }
      }
      // Dust motes drifting past, nearer than the rocks
      ctx.fillStyle = '#d9cbb8';
      for (const m of world.motes || []) {
        ctx.globalAlpha = bk * 0.35;
        ctx.fillRect(wrapTo(m.x * W + theta * m.depth * 900, W), wrapTo(m.y * H + travel * m.depth + clock * 20 * m.depth, H), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'start';
    if (fx.visitor) drawVisitor(fx.visitor);
  }

  // Every so often a convoy of flying saucers lifts off from Mars and heads
  // for Earth: big-brained Martians under glass domes, in a V formation,
  // shrinking into the distance as they go
  // The cycle: Martians hop into their parked saucers one by one, the saucers
  // lift off together, then the convoy flies off across the sky to Earth.
  // Afterwards they're back on the field, getting ready to go again.
  const CONVOY_EVERY = 30, BOARD_END = 5, LIFT_END = 7, CONVOY_FLIGHT = 12;
  const SAUCER_FIELD = -1.8, LIFT_H = 150, SAUCERS = 9;
  const EARTH_FROM_MARS = () => [W * 0.78, H * 0.2];
  const convoyT = () => (fx.convoyStart == null ? -1 : clock - fx.convoyStart);
  const convoyK = () => (convoyT() - LIFT_END) / CONVOY_FLIGHT;
  // Where the lifted-off saucers hover, on screen
  const fieldOnScreen = () => { const ph = SAUCER_FIELD + theta, R = R0 - 2 + LIFT_H; return [cx + R * Math.sin(ph), cy - R * Math.cos(ph)]; };
  // Where the far horizon (the furthest band of plain) is at screen x
  function farHorizonY(x) {
    const band = world.scape && world.scape[0];
    if (!band) return H * 0.4;
    const my = cy - (cam.r - R0) * (1 - band.sink), Rb = R0 - 6 + band.top, dx = x - cx;
    return Math.abs(dx) < Rb ? my - Math.sqrt(Rb * Rb - dx * dx) : my;
  }
  // layer 'near' is drawn in front of everything, 'far' behind Mars and its
  // volcanoes: once the convoy is well on its way it passes behind them
  function drawConvoy(ex, ey, alpha, layer) {
    const k = convoyK();
    if (k < 0 || k >= 1 || alpha <= 0) return;
    if ((layer === 'far') !== (k > 0.62)) return;
    ey = farHorizonY(ex) - 4; // heading for Earth, which lies beyond the horizon
    const [x0, y0] = fieldOnScreen();
    const e = k * k * (3 - 2 * k);
    const dir = Math.atan2(ey - y0, ex - x0);
    ctx.save();
    ctx.globalAlpha = alpha * clamp((1 - k) * 4, 0, 1);
    for (let i = 0; i < SAUCERS; i++) {
      // The leader in front, two wings behind it
      const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
      const back = row * 26 * (1 - e * 0.75), wide = row * 18 * side * (1 - e * 0.75);
      const x = lerp(x0, ex, e) - Math.cos(dir) * back - Math.sin(dir) * wide;
      // Up into the sky first, then down towards the far horizon and behind it
      const y = lerp(y0, ey, e) - Math.sin(e * Math.PI) * H * 0.22 - Math.sin(dir) * back + Math.cos(dir) * wide + Math.sin(clock * 3 + i) * 2;
      drawSaucer(x, y, lerp(13, 2, e) * (i ? 0.85 : 1), dir * 0.25, i);
    }
    if (k < 0.45) {
      const lx = lerp(x0, ex, e), ly = lerp(y0, ey, e) - 22;
      ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(40,14,8,0.5)'; ctx.fillText('FLYING TO EARTH', lx + 1, ly + 1);
      ctx.fillStyle = '#b8ff9a'; ctx.fillText('FLYING TO EARTH', lx, ly);
      ctx.textAlign = 'start';
    }
    ctx.restore();
  }
  // A Martian's head, in the style of the old trading cards and the film:
  // a huge bare brain, a skull face, big black eyes and a toothy grin
  function martianHead(x, y, u) {
    ctx.save(); ctx.translate(x, y); ctx.scale(u, u);
    ctx.fillStyle = '#c8dcb0'; ctx.beginPath(); ctx.ellipse(0, 1, 3.6, 3.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8fc8'; ctx.beginPath(); ctx.ellipse(0, -3.4, 5.6, 4.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c9508a'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0, -7.4); ctx.lineTo(0, -1); ctx.moveTo(-3.5, -5); ctx.quadraticCurveTo(-2, -3, -4, -1.5); ctx.moveTo(3.5, -5); ctx.quadraticCurveTo(2, -3, 4, -1.5); ctx.stroke();
    ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.ellipse(-1.5, 0.6, 1.3, 1.8, 0.2, 0, TAU); ctx.ellipse(1.5, 0.6, 1.3, 1.8, -0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-1.8, 3, 3.6, 0.9);
    ctx.fillStyle = '#0b0b10'; for (let i = -1; i <= 1; i++) ctx.fillRect(i * 1.1 - 0.15, 3, 0.3, 0.9);
    ctx.restore();
  }
  // A whole Martian standing on the ground (feet at 0,0): green suit, silver
  // collar, ray gun, and the glass bubble helmet over that brain
  function drawMartian(scale = 1.2, gunUp = false) {
    ctx.save(); ctx.scale(scale, scale);
    const suit = '#2f7f5f';
    px(-4, -8, 3, 8, suit); px(1, -8, 3, 8, suit);
    px(-5, -16, 10, 9, suit); px(-5, -10, 10, 1, '#1f5f45');
    px(4, gunUp ? -18 : -15, 5, 2, suit); px(8, gunUp ? -20 : -16, 6, 3, '#9aa3b5'); px(13, gunUp ? -20 : -16, 2, 2, '#ff5a4a');
    px(-7, -15, 3, 6, suit);
    ctx.fillStyle = '#c9ced9'; ctx.beginPath(); ctx.ellipse(0, -16, 7, 2, 0, 0, TAU); ctx.fill();
    martianHead(0, -21, 1);
    ctx.fillStyle = 'rgba(191,232,255,0.22)'; ctx.strokeStyle = 'rgba(235,248,255,0.85)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0, -23, 8.5, 0, TAU); ctx.fill(); ctx.stroke();
    px(-4, -29, 2, 2, 'rgba(255,255,255,0.8)');
    ctx.restore();
  }
  function drawSaucer(x, y, s, tilt, i, empty = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    // Glass dome with a Martian inside: skull face, bug eyes, a huge bare brain
    ctx.fillStyle = 'rgba(191,232,255,0.4)'; ctx.beginPath(); ctx.arc(0, -s * 0.35, s * 0.85, Math.PI, TAU); ctx.fill();
    if (s > 4 && !empty) martianHead(0, -s * 0.5, s * 0.11);
    ctx.strokeStyle = 'rgba(230,245,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -s * 0.35, s * 0.85, Math.PI, TAU); ctx.stroke();
    // The saucer
    ctx.fillStyle = '#c3c8d4'; ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s * 2, s * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a90a0'; ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 1.3, s * 0.35, 0, 0, Math.PI); ctx.fill();
    for (let j = -2; j <= 2; j++) {
      ctx.fillStyle = Math.sin(clock * 10 + j + i) > 0 ? '#ffd23f' : '#ff5a4a';
      ctx.fillRect(j * s * 0.7 - 1, -s * 0.22, 2, 2);
    }
    ctx.restore();
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
    if (fx.run) {
      // During the run: just the words, small and see-through, so nothing
      // coming at you is hidden
      const a = clamp(Math.min(b.t / 0.3, (2.6 - b.t) / 0.5), 0, 1) * 0.7;
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillStyle = '#1b1530'; ctx.fillText(b.text, W / 2 + 2, 112);
      ctx.fillStyle = '#ffd23f'; ctx.fillText(b.text, W / 2, 110);
      ctx.textAlign = 'start'; ctx.globalAlpha = 1;
      return;
    }
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
      if (L.peaks) {
        // Far off, low rolling hills and old crater rims, softened by billions
        // of years of tiny meteorite hits: long gentle slopes lit by the Sun,
        // then a steeper side in shadow, like sand dunes
        const dune = (u) => (u < 0.7 ? (1 - Math.cos((u / 0.7) * Math.PI)) / 2 : (1 + Math.cos(((u - 0.7) / 0.3) * Math.PI)) / 2);
        const fr = (v) => v - Math.floor(v);
        const hgt = (a) => 4 + 30 * dune(fr(a * 1.9 + 0.3)) + 10 * dune(fr(a * 4.3 + 0.7));
        const p0 = -reach - 0.05, p1 = reach + 0.05, st = 0.005;
        ctx.beginPath(); ctx.moveTo(...P(p0, 0));
        for (let ph = p0; ph <= p1; ph += st) ctx.lineTo(...P(ph, L.top + hgt(ph - rot)));
        ctx.lineTo(...P(p1, 0)); ctx.closePath(); ctx.fill();
        // The steep sides, in shadow
        ctx.fillStyle = dark(L.col, 0.22);
        for (let ph = p0; ph < p1; ph += st) {
          const h0 = hgt(ph - rot), h1 = hgt(ph + st - rot);
          if (h1 >= h0 - 0.05) continue;
          ctx.beginPath(); ctx.moveTo(...P(ph, L.top + h0)); ctx.lineTo(...P(ph + st * 1.2, L.top + h1)); ctx.lineTo(...P(ph + st * 1.2, L.top + h1 - 14)); ctx.lineTo(...P(ph, L.top + h0 - 14)); ctx.fill();
        }
        ctx.fillStyle = L.col;
        ctx.strokeStyle = light(L.col, 0.3); ctx.lineWidth = 2; ctx.beginPath();
        for (let ph = p0; ph <= p1; ph += st) ctx.lineTo(...P(ph, L.top + hgt(ph - rot)));
        ctx.stroke();
      }
      // The base, split across two layers that slide past each other
      if (L === world.plains[2]) drawBaseGroup(P(rot, L.top), rot, L.col, BASE_FAR, 0.7);
      if (L === world.plains[3]) drawBaseGroup(P(rot + 0.18, L.top), rot + 0.18, L.col, BASE_NEAR, 0.95);
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
  // Far half: the landing pad and the small habitats; near half: the big
  // dome, the tower and the hover pad
  const BASE_FAR = [
    [-110, 'rocketpad'], [-66, 'dish2'], [-46, 'dome', { w: 26, h: 16, ant: true }], [-6, 'dome', { w: 54, h: 30, door: true }], [40, 'fence'],
  ];
  const BASE_NEAR = [[-60, 'dome', { w: 74, h: 30, wins: 3, ant: true }], [-4, 'tower'], [44, 'dome', { w: 46, h: 24 }], [80, 'hover']];
  function drawBaseGroup([x, y], ph, ground, layout, sc) {
    if (Math.abs(wrap(ph)) * R0 > (view.x1 - view.x0) / 2 + 260) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ph); ctx.scale(sc, sc);
    // A flat shelf of ground for the base to stand on
    ctx.fillStyle = ground; ctx.fillRect(-150, -1, 300, 40);
    ctx.fillStyle = hexOf(mix(ground, '#ffffff', 0.12)); ctx.fillRect(-150, -1, 300, 2);
    for (const [bx, kind, opts] of layout) { ctx.save(); ctx.translate(bx, 0); MOON_DECOR[kind](opts || {}); ctx.restore(); }
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
    crustG.addColorStop(0, '#7c7a86'); crustG.addColorStop(1, '#a6a4b0');
    disc(R0 + 24, crustG);
    const mantle = ctx.createRadialGradient(cx, cy, R0 * 0.32, cx, cy, R0 * 0.9);
    mantle.addColorStop(0, '#5a5864'); mantle.addColorStop(1, '#75737f');
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
        if (c.kind === 'rock') { px(-5, -3, 10, 6, ['#c4c2cc', '#b5b3be', '#cfcdd6'][c.hue]); px(-3, -5, 6, 2, '#e2e0e8'); }
        else if (c.kind === 'ice') { px(-2, -5, 4, 10, '#a9c4d6'); px(-5, -2, 10, 4, '#a9c4d6'); px(-1, -4, 2, 2, '#e0eef6'); }
        else if (c.kind === 'meteorite') { px(-5, -4, 10, 8, '#3a3846'); px(-3, -3, 3, 3, '#8a8896'); px(1, 0, 2, 2, '#b0aeba'); }
        else if (c.kind === 'glass') { for (const [x, y] of [[-4, -2], [0, -4], [3, 0], [-1, 2]]) px(x, y, 3, 3, c.hue ? '#8c8072' : '#9a8d7c'); }
        else { px(-18, -2, 36, 5, '#4a4757'); px(-18, -3, 36, 1, '#8a8796'); px(-20, -1, 2, 3, '#4a4757'); px(18, -1, 2, 3, '#4a4757'); } // lava tube
      }, 34);
    }
    // Pale regolith on top: dust and broken rock, smooth like Earth's grass band
    ctx.strokeStyle = '#b9b6c2'; ctx.lineWidth = 22; ctx.stroke(outline);
    ctx.strokeStyle = '#dedce6'; ctx.lineWidth = 5; ctx.stroke(outline);
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
      ctx.fillStyle = ['#a8a6b2', '#b4b2bd', '#9c9aa6'][d.hue];
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-9, -10); ctx.lineTo(2, -14); ctx.lineTo(11, -7); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill();
      px(-7, -11, 7, 3, '#dcdae3'); px(6, -6, 5, 6, '#6e6c7a');
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

  // Venus in cross-section, under its cloud tops: the thick, scorching air,
  // a rocky crust with lava, a mantle, and an iron core about Earth's
  function drawVenusBody() {
    if (cy - R0 > view.y1 + 60) return;
    const disc = (r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); };
    const air = ctx.createRadialGradient(cx, cy, R0 * 0.86, cx, cy, R0);
    air.addColorStop(0, '#c9541e'); air.addColorStop(0.5, '#e09a3a'); air.addColorStop(1, '#f4d68a');
    disc(R0, air);
    const crustG = ctx.createRadialGradient(cx, cy, R0 * 0.78, cx, cy, R0 * 0.86);
    crustG.addColorStop(0, '#4a2a1e'); crustG.addColorStop(1, '#7a4a30');
    disc(R0 * 0.86, crustG);
    const mantle = ctx.createRadialGradient(cx, cy, R0 * 0.45, cx, cy, R0 * 0.78);
    mantle.addColorStop(0, '#e0782e'); mantle.addColorStop(1, '#8a3a1e');
    disc(R0 * 0.78, mantle);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.45);
    core.addColorStop(0, '#fff0a0'); core.addColorStop(1, '#ffa030');
    disc(R0 * 0.45, core);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,240,190,0.35)';
    for (const sw of world.swirls) {
      // The cloud tops race round the planet in about 4 days, far faster than it spins
      const a = sw.a + theta - Math.PI / 2 + clock * 0.02;
      ctx.beginPath(); ctx.arc(cx, cy, sw.rf * R0, a, a + sw.len); ctx.stroke();
    }
    for (const c of world.crust) {
      at(c.a + theta, c.rf * R0, () => {
        if (c.kind === 'lava') { px(-4, -3, 8, 6, '#ff7a2a'); px(-2, -2, 4, 3, '#ffe08a'); }
        else { px(-5, -3, 10, 6, ['#3a2018', '#5a3424', '#2e1a14'][c.hue]); px(-3, -5, 6, 2, '#7a4a30'); }
      }, 30);
    }
    // The cloud deck you're bouncing on
    ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 6, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fbeec0'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 1, 0, TAU); ctx.stroke();
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const [t, rf] of [['CLOUDS', 0.97], ['465°C AIR', 0.91], ['CRUST', 0.82], ['MANTLE', 0.64], ['IRON CORE', 0.22]]) {
      const x = cx - Math.sin(0.3) * rf * R0, y = cy - Math.cos(0.3) * rf * R0 + 3;
      if (y > H + 10) continue;
      ctx.fillStyle = 'rgba(20,10,20,0.55)'; ctx.fillText(t, x + 1, y + 1);
      ctx.fillStyle = '#fff4dc'; ctx.fillText(t, x, y);
    }
    ctx.textAlign = 'start';
  }
  // The cloud city: domes held up by the air (a breathable-air balloon floats
  // in Venus's thick CO2, an idea NASA studied as HAVOC), balloons, an airship
  function drawVenusDecor() {
    for (const d of world.decor) {
      at(d.a + theta, R0 - 4, () => {
        if (d.kind === 'puff') {
          ctx.scale(d.size, d.size);
          ctx.fillStyle = '#f7e6b0';
          for (const [x, y, r] of [[-14, -4, 10], [0, -9, 13], [14, -4, 9]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        } else if (d.kind === 'citydome') {
          ctx.scale(d.size, d.size);
          px(-40, -6, 80, 8, '#d6dce8'); px(-34, 2, 68, 5, '#9aa3b5');
          ctx.fillStyle = 'rgba(191,232,255,0.55)'; ctx.beginPath(); ctx.arc(0, -6, 30, Math.PI, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -6, 30, Math.PI, TAU); ctx.stroke();
          px(-16, -20, 8, 14, '#eef1f7'); px(-4, -28, 10, 22, '#f2e6d0'); px(10, -16, 9, 10, '#eef1f7');
          px(-2, -24, 3, 3, '#ffd23f'); px(12, -13, 3, 3, '#ffd23f');
          px(-1, -50, 2, 14, '#c9ced9'); px(1, -50, 10, 6, '#e0433b');
        } else if (d.kind === 'balloon') {
          const bob = Math.sin(clock * 1.2 + d.a * 3) * 4;
          px(-1, -60 + bob, 2, 54, '#9aa3b5');
          ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.arc(0, -78 + bob, 18, 0, TAU); ctx.fill();
          px(-6, -94 + bob, 5, 8, '#ffd08a');
          px(-7, -8, 14, 8, '#d6dce8');
        } else if (d.kind === 'airship') {
          const y = -110 + Math.sin(clock * 0.8) * 6;
          ctx.fillStyle = '#e6e4ec'; ctx.beginPath(); ctx.ellipse(0, y, 52, 16, 0, 0, TAU); ctx.fill();
          px(-50, y - 2, 100, 3, '#c9ced9');
          ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.moveTo(-48, y); ctx.lineTo(-62, y - 14); ctx.lineTo(-62, y + 14); ctx.fill();
          px(-12, y + 14, 24, 7, '#3b3b4f'); px(-8, y + 16, 4, 3, '#8fd0ff'); px(2, y + 16, 4, 3, '#8fd0ff');
          ctx.font = '5px "Press Start 2P", monospace'; ctx.fillStyle = '#e0433b'; ctx.textAlign = 'center'; ctx.fillText('HAVOC', 0, y + 2); ctx.textAlign = 'start';
        } else if (d.kind === 'vpanels') {
          for (const x of [-30, 0, 30]) { px(x - 1, -14, 2, 14, '#9aa3b5'); px(x - 12, -22, 24, 9, PANEL); px(x - 12, -18, 24, 1, '#5a7ae0'); }
        } else if (d.kind === 'sign') {
          px(-1, -36, 3, 36, '#9aa3b5');
          px(-40, -50, 80, 16, '#1b1530'); px(-38, -48, 76, 12, '#3b3b4f');
          ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = d.col; ctx.fillText(d.text, 0, -39); ctx.textAlign = 'start';
        }
      }, 140);
    }
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
    saucers() {
      // The saucer field: Martians hop into their saucers, the saucers lift
      // off, then (drawn by drawConvoy) fly off to Earth
      const t = convoyT(), n = SAUCERS, gap = 44;
      if (t >= LIFT_END) { marsLabel('SAUCER FIELD', -8); return; } // they've gone
      const lift = t >= BOARD_END && t < LIFT_END ? (t - BOARD_END) / (LIFT_END - BOARD_END) : 0;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * gap;
        const jumpAt = 0.6 + i * 0.8, boarding = t < BOARD_END;
        const inside = lift > 0 || (boarding && t > jumpAt + 0.5);
        const y = -LIFT_H * lift * lift * (3 - 2 * lift) - 6 - Math.sin(clock * 3 + i) * (lift ? 2 : 0);
        if (lift > 0) {
          ctx.globalAlpha = 0.5 * (1 - lift); ctx.fillStyle = '#b8ff9a';
          ctx.beginPath(); ctx.moveTo(x - 8, y + 4); ctx.lineTo(x + 8, y + 4); ctx.lineTo(x + 14, 0); ctx.lineTo(x - 14, 0); ctx.fill();
          ctx.globalAlpha = 1;
        }
        drawSaucer(x, y, 9, 0, i, !inside);
        if (boarding && !inside) {
          // Waiting by the saucer, then a hop up into the dome
          const k = clamp((t - jumpAt) / 0.5, 0, 1);
          ctx.save();
          ctx.translate(lerp(x + 18, x, k), lerp(0, -14, k) - Math.sin(k * Math.PI) * 30);
          drawMartian(1.4 - 0.6 * k, k === 0 && Math.sin(clock * 2 + i) > 0.6);
          ctx.restore();
        } else if (!boarding && lift === 0) {
          // Back from the trip, standing about by their saucers
          ctx.save(); ctx.translate(x + 18, 0); if (i % 2) ctx.scale(-1, 1); drawMartian(1.4, Math.sin(clock * 1.5 + i * 2) > 0.7); ctx.restore();
        }
      }
      marsLabel('SAUCER FIELD', 14);
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
    if (level === 6) { drawHollowDecor(); return; }
    if (level === 7) { drawEuropaDecor7(); return; }
    if (level === 5) { drawDwarfDecor(); return; }
    if (level === 4) { drawVenusDecor(); return; }
    if (level === 3) { drawMarsDecor(); return; }
    if (level === 2) { drawMoonDecor(); return; }
    if (world.life) drawBiomeGround();
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
        } else if (EARTH_PLANTS[d.kind]) EARTH_PLANTS[d.kind](d);
        else {
          px(-8, -6, 16, 6, '#8a8f98'); px(-5, -9, 10, 3, '#a3a8b0');
        }
      });
    }
    if (world.life) drawEarthLife();
  }

  // ---- Life on Earth ---------------------------------------------------------
  // The world is split into regions, each with its own ground, plants and
  // animals: a town, meadows, farmland, forest, a river and lake, savanna,
  // desert, a beach and sea, and Arctic tundra. Animals wander, graze, and
  // run (or hop) away if you come close. Birds fly round in flocks.
  const BIOMES = [
    { key: 'town', a0: -0.35, a1: 0.35, ground: null },
    { key: 'farm', a0: 0.35, a1: 1.05, ground: '#9bbf3a', fact: "A cow's stomach has four parts, to break down tough grass. Farms like this feed most of the world." },
    { key: 'forest', a0: 1.05, a1: 1.8, ground: '#2f7a34', fact: 'Forests cover about a third of all the land on Earth. Their trees take in carbon dioxide and give out oxygen.' },
    { key: 'lake', a0: 1.8, a1: 2.45, ground: '#4fb34a', fact: 'Only a tiny bit of Earth\'s water is fresh, in rivers, lakes and ice. About 97% of it is salty sea.' },
    { key: 'savanna', a0: 2.45, a1: 3.2, ground: '#c9b45a', fact: 'On the savanna: African elephants are the biggest animals on land, and giraffes are the tallest.' },
    { key: 'desert', a0: 3.2, a1: 3.85, ground: '#e6c27a', fact: 'Deserts, hot and cold, cover about a third of the land. Cacti store water in their thick stems.' },
    { key: 'sea', a0: 3.85, a1: 4.6, ground: '#e9d9a0', fact: 'The ocean covers about 71% of Earth. Blue whales live in it: the biggest animals known ever to have lived.' },
    { key: 'tundra', a0: 4.6, a1: 5.3, ground: '#eef3f8', fact: 'Arctic tundra: just below the surface the ground stays frozen all year round. It\'s called permafrost.' },
    { key: 'meadow', a0: 5.3, a1: TAU - 0.35, ground: '#5cc04f', fact: 'Bees and other pollinators help produce around a third of the food crops we eat.' },
  ];
  const biomeAt = (a) => { const x = ((a % TAU) + TAU + 0.35) % TAU - 0.35; return BIOMES.find((b) => x >= b.a0 && x < b.a1) || BIOMES[0]; };
  function buildEarthLife(rnd, decor) {
    const animals = [], water = [], flowers = [], flocks = [];
    const put = (b, kind, n, extra = {}) => { for (let i = 0; i < n; i++) decor.push({ a: b.a0 + 0.04 + rnd() * (b.a1 - b.a0 - 0.08), kind, hue: Math.floor(rnd() * 4), size: 0.75 + rnd() * 0.55, ...extra }); };
    const beast = (b, kind, n, o = {}) => { for (let i = 0; i < n; i++) animals.push({ kind, a0: b.a0 + 0.06 + rnd() * (b.a1 - b.a0 - 0.12), x: 0, dir: rnd() < 0.5 ? -1 : 1, speed: o.speed || 12, range: o.range || 40, pause: rnd() * 3, phase: rnd() * TAU, flee: 0, hop: 0, onWater: o.onWater || false }); };
    for (const b of BIOMES) {
      if (b.key === 'town') { put(b, 'house', 5); put(b, 'tree', 4); put(b, 'flower', 5); beast(b, 'dog', 1, { speed: 30, range: 60 }); }
      if (b.key === 'farm') { put(b, 'wheat', 7); put(b, 'barn', 1); put(b, 'hedge', 3); beast(b, 'cow', 3, { speed: 6, range: 30 }); beast(b, 'sheep', 4, { speed: 7, range: 25 }); }
      if (b.key === 'forest') { put(b, 'oak', 6); put(b, 'pine', 6); put(b, 'birch', 4); put(b, 'mushroom', 4); beast(b, 'deer', 2, { speed: 14, range: 50 }); beast(b, 'fox', 1, { speed: 22, range: 70 }); beast(b, 'rabbit', 2, { speed: 18, range: 40 }); }
      if (b.key === 'lake') { const mid = (b.a0 + b.a1) / 2; water.push({ a0: mid - 0.2, a1: mid + 0.2, depth: 16, kind: 'lake' }); put({ a0: b.a0, a1: mid - 0.2 }, 'reeds', 3); put({ a0: mid + 0.2, a1: b.a1 }, 'reeds', 3); put({ a0: b.a0, a1: mid - 0.22 }, 'willow', 1); put({ a0: mid + 0.22, a1: b.a1 }, 'oak', 2); animals.push({ kind: 'duck', a0: mid - 0.08, x: 0, dir: 1, speed: 8, range: 40, pause: 0, phase: 1, flee: 0, hop: 0, onWater: true }, { kind: 'duck', a0: mid + 0.06, x: 0, dir: -1, speed: 7, range: 30, pause: 0, phase: 2, flee: 0, hop: 0, onWater: true }); water[water.length - 1].fish = [mid - 0.12, mid + 0.02, mid + 0.13]; beast({ a0: mid + 0.2, a1: b.a1 }, 'heron', 1, { speed: 3, range: 10 }); }
      if (b.key === 'savanna') { put(b, 'acacia', 5); put(b, 'grass', 6); beast(b, 'elephant', 2, { speed: 6, range: 40 }); beast(b, 'giraffe', 2, { speed: 8, range: 40 }); beast(b, 'zebra', 2, { speed: 10, range: 40 }); }
      if (b.key === 'desert') { put(b, 'cactus', 6); put(b, 'dune', 3); beast(b, 'camel', 1, { speed: 6, range: 50 }); beast(b, 'lizard', 2, { speed: 30, range: 30 }); }
      if (b.key === 'sea') { const mid = (b.a0 + b.a1) / 2; water.push({ a0: mid - 0.24, a1: mid + 0.26, depth: 24, kind: 'sea' }); put({ a0: b.a0, a1: mid - 0.25 }, 'palm', 3); put({ a0: b.a0, a1: mid - 0.25 }, 'shell', 3); beast({ a0: b.a0, a1: mid - 0.25 }, 'crab', 2, { speed: 16, range: 25 }); water[water.length - 1].whale = mid + 0.05; water[water.length - 1].boat = mid - 0.1; }
      if (b.key === 'tundra') { put(b, 'snowpine', 5); put(b, 'snowrock', 3); beast(b, 'polarbear', 1, { speed: 7, range: 40 }); beast(b, 'arcticfox', 1, { speed: 20, range: 50 }); beast(b, 'reindeer', 2, { speed: 9, range: 40 }); }
      if (b.key === 'meadow') { put(b, 'flower', 14); put(b, 'tree', 3); put(b, 'hive', 1); beast(b, 'rabbit', 3, { speed: 18, range: 40 }); for (let i = 0; i < 6; i++) flowers.push(b.a0 + 0.05 + rnd() * (b.a1 - b.a0 - 0.1)); }
    }
    for (let i = 0; i < 4; i++) flocks.push({ a: rnd() * TAU, R: R0 + 140 + rnd() * 260, speed: (0.03 + rnd() * 0.03) * (rnd() < 0.5 ? -1 : 1), n: 3 + Math.floor(rnd() * 4), phase: rnd() * TAU });
    return { animals, water, flowers, flocks, seen: {} };
  }
  function updateEarthLife(dt) {
    const L = world.life, me = -theta, low = player.r < R0 + 70;
    for (const q of L.animals) {
      q.hop = Math.max(0, q.hop - dt);
      const pos = q.a0 + q.x / R0, gap = wrap(pos - me) * R0;
      if (low && Math.abs(gap) < 80 && !q.onWater && q.kind !== 'heron') { q.flee = 1.2; q.dir = gap > 0 ? 1 : -1; if (q.hop <= 0 && (q.kind === 'rabbit' || q.kind === 'deer' || q.kind === 'reindeer')) q.hop = 0.35; }
      if (q.flee > 0) { q.flee -= dt; q.x += q.dir * q.speed * 5 * dt; continue; }
      if (q.pause > 0) { q.pause -= dt; continue; }
      q.x += q.dir * q.speed * dt;
      if (Math.abs(q.x) > q.range) { q.x = Math.sign(q.x) * q.range; q.dir *= -1; q.pause = 1 + Math.random() * 3; }
      else if (Math.random() < dt * 0.2) q.pause = 1 + Math.random() * 2;
    }
    for (const f of L.flocks) f.a += f.speed * dt;
    // A note about each region, the first time you're on the ground in it
    if (state === 'play' && player.onGround && player.r <= R0 + 1 && toastTimer <= 0) {
      const b = biomeAt(me);
      if (b.fact && !L.seen[b.key]) { L.seen[b.key] = true; toast(b.fact, 5.5); }
    }
  }
  // Each region's ground colour, and its water
  function drawBiomeGround() {
    if (cy - R0 > view.y1 + 60) return;
    const L = world.life, toCanvas = (a) => a + theta - Math.PI / 2;
    for (const b of BIOMES) {
      if (!b.ground) continue;
      ctx.strokeStyle = b.ground; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(cx, cy, R0 - 5, toCanvas(b.a0), toCanvas(b.a1)); ctx.stroke();
      if (b.key === 'tundra') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R0 - 1, toCanvas(b.a0), toCanvas(b.a1)); ctx.stroke(); }
    }
    for (const w of L.water) {
      ctx.strokeStyle = w.kind === 'sea' ? '#1f5fa8' : '#2f7fd0'; ctx.lineWidth = w.depth;
      ctx.beginPath(); ctx.arc(cx, cy, R0 - w.depth / 2, toCanvas(w.a0), toCanvas(w.a1)); ctx.stroke();
      // Ripples and glints
      ctx.strokeStyle = 'rgba(220,240,255,0.7)'; ctx.lineWidth = 2;
      for (let k = 0; k < 10; k++) {
        const a = w.a0 + ((k + 0.5) / 10) * (w.a1 - w.a0) + Math.sin(clock * 0.8 + k) * 0.005;
        if (Math.sin(clock * 2 + k * 1.7) > 0.2) { ctx.beginPath(); ctx.arc(cx, cy, R0 - 2, toCanvas(a), toCanvas(a + 0.012)); ctx.stroke(); }
      }
      if (w.kind === 'sea') for (const side of [w.a0]) at(side + theta, R0 - 2, () => { for (let k = 0; k < 3; k++) { const t = (clock * 0.5 + k / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - t)})`; ctx.fillRect(-4 - t * 30, -2, 8, 2); } }, 60);
    }
  }
  // Plants and things that grow in each region
  const EARTH_PLANTS = {
    oak(d) { px(-3, -20, 6, 20, '#6b4226'); for (const [x, y, r] of [[0, -36, 16], [-11, -28, 11], [11, -28, 11]]) { ctx.fillStyle = ['#2f8f3a', '#3aa047', '#27803a', '#4aa84a'][d.hue]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } },
    pine(d) { px(-2, -10, 4, 10, '#5a3a20'); ctx.fillStyle = '#1f6a3a'; for (const [y, w] of [[-10, 16], [-22, 13], [-34, 9]]) { ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.lineTo(0, y - 18); ctx.fill(); } },
    birch(d) { px(-2, -34, 4, 34, '#f2f2ec'); for (let y = -30; y < 0; y += 7) px(-2, y, 2, 2, '#333'); ctx.fillStyle = '#7cc04a'; ctx.beginPath(); ctx.ellipse(0, -38, 10, 14, 0, 0, TAU); ctx.fill(); },
    willow(d) { px(-3, -24, 6, 24, '#5a3a20'); ctx.fillStyle = '#6aa83a'; ctx.beginPath(); ctx.arc(0, -30, 18, Math.PI, TAU); ctx.fill(); for (let x = -16; x <= 16; x += 4) px(x, -30, 2, 18 + Math.sin(x + clock) * 3, '#6aa83a'); },
    mushroom(d) { px(-1, -5, 2, 5, '#f2e6d0'); ctx.fillStyle = '#d8403a'; ctx.beginPath(); ctx.arc(0, -5, 5, Math.PI, TAU); ctx.fill(); px(-2, -8, 1, 1, '#fff'); px(2, -7, 1, 1, '#fff'); },
    wheat(d) { for (let x = -18; x <= 18; x += 4) { const sway = Math.sin(clock * 1.5 + x * 0.3 + d.a * 50) * 1.5; px(x + sway, -14, 2, 14, '#d9b23a'); px(x + sway - 1, -17, 3, 4, '#e9c84a'); } },
    barn(d) { px(-22, -26, 44, 26, '#b8403a'); ctx.fillStyle = '#7a2a24'; ctx.beginPath(); ctx.moveTo(-26, -26); ctx.lineTo(0, -42); ctx.lineTo(26, -26); ctx.fill(); px(-8, -16, 16, 16, '#f2e6d0'); px(-7, -15, 14, 14, '#7a2a24'); },
    hedge(d) { ctx.fillStyle = '#2f7a34'; for (const x of [-12, 0, 12]) { ctx.beginPath(); ctx.arc(x, -6, 8, 0, TAU); ctx.fill(); } },
    reeds(d) { for (let x = -6; x <= 6; x += 3) { const sway = Math.sin(clock * 2 + x) * 2; px(x + sway, -18, 1, 18, '#4a7a2a'); if (x % 2 === 0) px(x + sway - 1, -20, 3, 6, '#6b4226'); } },
    acacia(d) { px(-2, -26, 4, 26, '#6b4a2a'); px(-6, -28, 2, 6, '#6b4a2a'); ctx.fillStyle = '#5a8a2a'; ctx.beginPath(); ctx.ellipse(0, -32, 24, 6, 0, 0, TAU); ctx.fill(); },
    grass(d) { for (let x = -8; x <= 8; x += 4) px(x + Math.sin(clock * 2 + x) * 1, -8, 2, 8, '#b8a040'); },
    cactus(d) { px(-3, -30, 6, 30, '#3f8a4a'); px(-11, -20, 4, 10, '#3f8a4a'); px(-11, -20, 8, 3, '#3f8a4a'); px(7, -24, 4, 12, '#3f8a4a'); px(3, -14, 8, 3, '#3f8a4a'); if (d.hue === 1) px(-2, -33, 4, 3, '#ff6fa0'); },
    dune(d) { ctx.fillStyle = '#dcb468'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 12, 0, Math.PI, TAU); ctx.fill(); },
    palm(d) { const sway = Math.sin(clock * 1.2 + d.a * 30) * 2; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4, -20, 2 + sway, -40); ctx.stroke(); ctx.fillStyle = '#3a9a3a'; for (const a of [-2.6, -2, -1.2, -0.5]) { ctx.save(); ctx.translate(2 + sway, -40); ctx.rotate(a + 1.57); ctx.beginPath(); ctx.ellipse(0, -10, 3, 12, 0, 0, TAU); ctx.fill(); ctx.restore(); } px(-1 + sway, -40, 4, 4, '#6b4226'); },
    shell(d) { ctx.fillStyle = '#f4b6a6'; ctx.beginPath(); ctx.arc(0, -2, 3, Math.PI, TAU); ctx.fill(); },
    snowpine(d) { EARTH_PLANTS.pine(d); ctx.fillStyle = '#ffffff'; for (const [y, w] of [[-14, 10], [-26, 8], [-38, 5]]) { ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.lineTo(0, y - 8); ctx.fill(); } },
    snowrock(d) { px(-10, -8, 20, 8, '#8a8f98'); px(-8, -10, 16, 3, '#ffffff'); },
    hive(d) { px(-1, -26, 2, 26, '#6b4226'); ctx.fillStyle = '#e9b23a'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(0, -16 + k * 4 - 12, 8 - k, 3, 0, 0, TAU); ctx.fill(); } },
  };
  // The same regions in depth: two layers further back (smaller, hazier,
  // sliding past more slowly) and one in front of you (low grass, bushes and
  // flowers sliding past faster). Each layer follows the region you're in.
  const ECO_BACK = { town: ['house', 'tree', 'oak'], farm: ['barn', 'hedge', 'turbine', 'wheat', 'cow', 'sheep'], forest: ['pine', 'oak', 'birch', 'pine', 'deer'], lake: ['willow', 'oak', 'reeds', 'heron'], savanna: ['acacia', 'grass', 'elephant', 'giraffe', 'zebra'], desert: ['cactus', 'mesa', 'dune', 'camel'], sea: ['palm', 'shell'], tundra: ['snowpine', 'snowrock', 'reindeer', 'polarbear'], meadow: ['tree', 'hedge', 'flower', 'hive', 'rabbit'] };
  const ECO_FRONT = { town: ['tuft', 'flower'], farm: ['tuft', 'wheat'], forest: ['fern', 'mushroom', 'tuft'], lake: ['reeds', 'tuft'], savanna: ['grass', 'tuft'], desert: ['pebbles'], sea: ['pebbles', 'shell'], tundra: ['snowtuft'], meadow: ['flower', 'tuft', 'flower'] };
  const ECO_LAYERS = [
    { f: 0.9, sink: 0.95, sc: 0.5, alpha: 0.62, step: 0.06, keep: 0.55, lift: 34 },
    { f: 0.95, sink: 0.975, sc: 0.72, alpha: 0.82, step: 0.07, keep: 0.5, lift: 16 },
  ];
  const ECO_FRONT_L = { f: 1.1, sink: 1, sc: 1.15, alpha: 0.95, step: 0.05, keep: 0.38, lift: -2 };
  function drawEcoLayers(front) {
    const tf = tierFloat(player.r);
    const fade = clamp(1 - (tf - 2) / 3, 0, 1) * clamp((cam.zoom - 0.55) / 0.35, 0, 1);
    if (fade <= 0) return;
    const climb = cam.r - R0, reach = ((view.x1 - view.x0) / 2 + 120) / R0;
    for (const L of front ? [ECO_FRONT_L] : ECO_LAYERS) {
      const my = cy - climb * (1 - L.sink);
      if (my - R0 - 120 > view.y1 + 20) continue;
      const N = Math.round(TAU / L.step), step = TAU / N;
      // The sea, out on the horizon behind the beach
      if (!front) {
        const sea = BIOMES.find((b) => b.key === 'sea'), R = R0 - 6 + L.lift;
        for (const k of [-1, 0, 1]) {
          const p0 = L.f * (sea.a0 + 0.1 + k * TAU + theta) - Math.PI / 2, p1 = L.f * (sea.a1 + k * TAU + theta) - Math.PI / 2;
          ctx.globalAlpha = fade * L.alpha; ctx.strokeStyle = '#2a6ab8'; ctx.lineWidth = 10;
          ctx.beginPath(); ctx.arc(cx, my, R, p0, p1); ctx.stroke();
        }
      }
      // Ground angles round the one under you; each lands on the screen at f times its turn
      const g0 = -theta - reach / L.f, g1 = -theta + reach / L.f;
      for (let i = Math.floor(g0 / step); i <= Math.ceil(g1 / step); i++) {
        const idx = ((i % N) + N) % N, h = hash3(idx, L.f * 10, 3), h2 = hash3(idx, L.f * 10, 7);
        if (h > L.keep) continue;
        const g = i * step + (h2 - 0.5) * step * 0.6, b = biomeAt(g);
        const list = (front ? ECO_FRONT : ECO_BACK)[b.key];
        const kind = list[Math.floor(h2 * list.length) % list.length];
        // Nothing standing on the water (in front, or out on the sea)
        if ((front || b.key === 'sea') && world.life.water.some((w) => wrap(g - w.a0) > -0.02 && wrap(w.a1 - g) > -0.02)) continue;
        const ph = L.f * (g + theta), r = R0 - 6 + L.lift;
        const x = cx + r * Math.sin(ph), y = my - r * Math.cos(ph);
        ctx.save(); ctx.globalAlpha = fade * L.alpha;
        ctx.translate(x, y); ctx.rotate(ph);
        const sc = L.sc * (0.8 + hash3(idx, 5, L.f * 10) * 0.4);
        ctx.scale(sc * (h2 > 0.5 ? 1 : -1), sc);
        const d = { a: g, hue: Math.floor(hash3(idx, 2, 9) * 4), size: 1 };
        if (ANIMALS[kind]) { ctx.translate(Math.sin(clock * 0.25 + idx) * 14, 0); ANIMALS[kind](Math.sin(clock * 6 + idx) * 0.6, { phase: idx, dir: 1 }); }
        else if (ECO_EXTRA[kind]) ECO_EXTRA[kind](d);
        else if (EARTH_PLANTS[kind]) EARTH_PLANTS[kind](d);
        else if (kind === 'house') { px(-16, -24, 32, 24, ['#f2e6d0', '#e9c46a', '#c9d7f0', '#f4b6a6'][d.hue]); ctx.fillStyle = '#b8403a'; ctx.beginPath(); ctx.moveTo(-20, -24); ctx.lineTo(0, -40); ctx.lineTo(20, -24); ctx.fill(); px(-4, -12, 8, 12, '#5a3a28'); }
        else if (kind === 'tree') { px(-3, -18, 6, 18, '#6b4226'); px(-13, -42, 26, 24, ['#2f8f3a', '#3aa047', '#27803a', '#4aa84a'][d.hue]); }
        else if (kind === 'flower') { px(-1, -8, 2, 8, '#3a8f3a'); px(-3, -12, 6, 4, ['#ff6fa0', '#ffd23f', '#ffffff', '#b58cff'][d.hue]); }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  // A few things only seen in the layers
  const ECO_EXTRA = {
    turbine(d) { px(-1, -60, 3, 60, '#eef1f7'); const a = clock * 1.6 + d.a * 9; ctx.strokeStyle = '#eef1f7'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { const t = a + (k * TAU) / 3; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(Math.cos(t) * 24, -60 + Math.sin(t) * 24); ctx.stroke(); } },
    mesa(d) { ctx.fillStyle = '#c0703a'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-28, -40); ctx.lineTo(26, -40); ctx.lineTo(40, 0); ctx.fill(); px(-28, -40, 54, 4, '#d8885a'); px(-30, -24, 58, 3, '#a85a2a'); },
    tuft(d) { for (let x = -8; x <= 8; x += 3) px(x + Math.sin(clock * 2 + x + d.a * 40) * 1.5, -10 - ((x * 7) & 3) * 2, 2, 12, ['#3a9a3a', '#4aa84a', '#2f8a34', '#5ab84a'][d.hue]); },
    fern(d) { ctx.strokeStyle = '#2f8a34'; ctx.lineWidth = 2; for (const a of [-0.9, -0.4, 0.1, 0.6]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.sin(a) * 10, -14, Math.sin(a) * 20 + Math.sin(clock + a) * 2, -18); ctx.stroke(); } },
    pebbles(d) { for (const [x, w] of [[-8, 6], [0, 4], [6, 7]]) px(x, -3, w, 3, ['#a39a8a', '#8a8f98', '#c9b49a', '#b0a898'][d.hue]); },
    snowtuft(d) { ctx.fillStyle = '#ffffff'; for (const [x, r] of [[-6, 5], [2, 7], [9, 4]]) { ctx.beginPath(); ctx.arc(x, 0, r, Math.PI, TAU); ctx.fill(); } },
  };
  // The animals, the flocks, and the little things buzzing round the flowers
  function drawEarthLife() {
    const L = world.life;
    for (const q of L.animals) {
      const pos = q.a0 + q.x / R0, moving = q.flee > 0 || q.pause <= 0;
      const hopY = q.hop > 0 ? -Math.sin((q.hop / 0.35) * Math.PI) * 10 : 0;
      at(pos + theta, R0 - (q.onWater ? 6 : 2), () => {
        ctx.translate(0, hopY); ctx.scale(q.dir, 1);
        const step = moving ? Math.sin(clock * (q.flee > 0 ? 20 : 8) + q.phase) : 0;
        ANIMALS[q.kind](step, q);
      }, 80);
    }
    // Fish leaping in the lake; a whale and a boat out at sea
    for (const w of L.water) {
      for (const f of w.fish || []) {
        const t = (clock * 0.35 + f * 7) % 1;
        if (t < 0.25) { const u = t / 0.25; at(f + (u - 0.5) * 0.02 + theta, R0 - 8 + -Math.sin(u * Math.PI) * 26, () => { ctx.rotate((u - 0.5) * 2); px(-5, -2, 10, 4, '#c8d8e8'); ctx.fillStyle = '#c8d8e8'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-9, -3); ctx.lineTo(-9, 3); ctx.fill(); }, 40); }
      }
      if (w.whale) {
        const t = (clock * 0.12) % 1;
        if (t < 0.4) at(w.whale + theta, R0 - 12, () => {
          const up = Math.sin((t / 0.4) * Math.PI);
          ctx.fillStyle = '#3a4a6a'; ctx.beginPath(); ctx.ellipse(0, 4 - up * 8, 34, 10, 0, Math.PI, TAU); ctx.fill();
          if (up > 0.6) for (let k = 0; k < 6; k++) px(-4 + Math.sin(k) * 6, -8 - up * 8 - k * 5, 3, 3, 'rgba(220,240,255,0.8)');
        }, 80);
      }
      if (w.boat) at(w.boat + Math.sin(clock * 0.1) * 0.03 + theta, R0 - 20, () => {
        ctx.rotate(Math.sin(clock * 1.5) * 0.06);
        px(-16, -6, 32, 6, '#8a5a3a'); px(-1, -30, 2, 24, '#6b4226');
        ctx.fillStyle = '#f2f2ec'; ctx.beginPath(); ctx.moveTo(1, -29); ctx.lineTo(14, -8); ctx.lineTo(1, -8); ctx.fill();
      }, 60);
    }
    // Bees and butterflies over the meadow flowers
    for (let i = 0; i < L.flowers.length; i++) {
      const a = L.flowers[i];
      at(a + theta, R0 - 2, () => {
        const bx = Math.sin(clock * 1.7 + i) * 18, by = -18 - Math.abs(Math.sin(clock * 2.3 + i * 2)) * 14;
        if (i % 2) { px(bx - 2, by - 1, 4, 3, '#ffd23f'); px(bx - 1, by - 1, 1, 3, '#1b1530'); px(bx - 1, by - 3, 2, 2, 'rgba(255,255,255,0.8)'); }
        else { const flap = Math.abs(Math.sin(clock * 12 + i)); ctx.fillStyle = ['#ff6fa0', '#b58cff', '#ffab3d'][i % 3]; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(bx + s * 3 * flap, by, 3 * flap + 0.5, 4, 0, 0, TAU); ctx.fill(); } px(bx, by - 3, 1, 6, '#1b1530'); }
      }, 50);
    }
    // Birds in V formation, flapping
    for (const f of L.flocks) {
      for (let k = 0; k < f.n; k++) {
        const side = k % 2 ? 1 : -1, rank = Math.ceil(k / 2);
        at(f.a - (rank * 16 * Math.sign(f.speed)) / f.R + theta, f.R + Math.sin(clock + f.phase) * 8 - rank * 9 * side * 0.6 + side * rank * 6, () => {
          const flap = Math.sin(clock * 9 + k + f.phase) * 4;
          ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-6, flap); ctx.lineTo(0, 0); ctx.lineTo(6, flap); ctx.stroke();
        }, 20);
      }
    }
  }
  const ANIMALS = {
    dog(st) { px(-8, -8, 14, 6, '#a0703a'); px(4, -12, 6, 6, '#a0703a'); px(9, -10, 3, 2, '#1b1530'); px(-10, -10, 3, 2, '#a0703a'); for (const x of [-7, 2]) px(x + st, -2, 2, 2, '#7a5028'); },
    cow(st, q) { const graze = Math.sin(clock * 0.8 + q.phase) > 0.3; px(-12, -16, 22, 11, '#ffffff'); px(-8, -15, 6, 5, '#1b1530'); px(2, -12, 5, 4, '#1b1530'); px(9, graze ? -8 : -18, 7, 7, '#ffffff'); px(14, graze ? -6 : -16, 2, 2, '#ff9ab0'); for (const x of [-10, -5, 2, 7]) px(x + (x % 2 ? st : -st), -5, 2, 5, '#3a3a3a'); },
    sheep(st, q) { ctx.fillStyle = '#f4f4ee'; for (const [x, y] of [[-6, -10], [0, -12], [6, -10], [0, -8]]) { ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); } px(9, -13, 5, 5, '#2a2a2a'); for (const x of [-5, 4]) px(x + st, -4, 2, 4, '#2a2a2a'); },
    deer(st) { px(-10, -18, 18, 8, '#9a6a3a'); px(6, -26, 4, 10, '#9a6a3a'); px(6, -28, 7, 5, '#9a6a3a'); px(8, -34, 1, 6, '#5a3a20'); px(10, -33, 1, 5, '#5a3a20'); px(-11, -18, 3, 3, '#fff'); for (const x of [-9, -5, 3, 6]) px(x + (x > 0 ? st : -st), -10, 2, 10, '#7a5028'); },
    reindeer(st) { ANIMALS.deer(st); px(5, -38, 8, 1, '#5a3a20'); px(-11, -18, 3, 3, '#e8e0d0'); },
    fox(st) { px(-8, -8, 14, 6, '#e0703a'); px(4, -12, 6, 6, '#e0703a'); px(5, -14, 2, 2, '#e0703a'); px(9, -10, 2, 2, '#1b1530'); px(-16, -10, 9, 4, '#e0703a'); px(-17, -10, 3, 4, '#ffffff'); for (const x of [-6, 3]) px(x + st, -2, 2, 2, '#3a2a20'); },
    arcticfox(st) { px(-8, -8, 14, 6, '#f2f2f2'); px(4, -12, 6, 6, '#f2f2f2'); px(9, -10, 2, 2, '#1b1530'); px(-16, -10, 9, 4, '#f2f2f2'); for (const x of [-6, 3]) px(x + st, -2, 2, 2, '#cfd6de'); },
    rabbit(st, q) { px(-5, -7, 9, 6, '#c9b49a'); px(3, -10, 5, 5, '#c9b49a'); px(4, -15, 2, 6, '#c9b49a'); px(-6, -7, 3, 3, '#ffffff'); px(7, -9, 1, 1, '#1b1530'); },
    duck(st, q) { const bob = Math.sin(clock * 3 + q.phase) * 1; px(-6, -5 + bob, 11, 5, '#8a6a3a'); px(3, -10 + bob, 5, 5, '#2f8f3a'); px(8, -8 + bob, 3, 2, '#ffab3d'); },
    heron(st) { px(-4, -26, 8, 8, '#9aa3b5'); px(2, -36, 2, 12, '#9aa3b5'); px(2, -38, 5, 3, '#9aa3b5'); px(7, -37, 5, 1, '#e9c84a'); px(-2, -18, 1, 18, '#6b6b6b'); px(1, -18, 1, 18, '#6b6b6b'); },
    elephant(st) { px(-16, -26, 30, 18, '#8a8f98'); px(12, -26, 10, 12, '#8a8f98'); px(18, -16, 4, 14, '#8a8f98'); px(10, -24, 5, 9, '#6f747c'); px(18, -22, 2, 2, '#1b1530'); for (const x of [-14, -7, 3, 9]) px(x + (x > 0 ? st : -st), -8, 5, 8, '#7a7f88'); },
    giraffe(st) { px(-10, -26, 18, 9, '#e0b050'); px(4, -50, 5, 26, '#e0b050'); px(4, -54, 10, 6, '#e0b050'); px(6, -57, 1, 3, '#7a5028'); for (const [x, y] of [[-7, -24], [-1, -22], [5, -40], [5, -32], [-4, -20]]) px(x, y, 3, 3, '#8a5a28'); for (const x of [-9, -4, 3, 6]) px(x + (x > 0 ? st : -st), -17, 2, 17, '#c9a040'); },
    zebra(st) { px(-10, -16, 18, 9, '#ffffff'); for (let x = -9; x < 8; x += 4) px(x, -16, 2, 9, '#1b1530'); px(6, -22, 5, 9, '#ffffff'); px(7, -22, 1, 9, '#1b1530'); for (const x of [-9, -4, 3, 6]) px(x + (x > 0 ? st : -st), -7, 2, 7, '#ffffff'); },
    camel(st) { px(-12, -22, 22, 10, '#c9a060'); ctx.fillStyle = '#c9a060'; ctx.beginPath(); ctx.arc(-4, -22, 6, Math.PI, TAU); ctx.fill(); px(8, -32, 4, 14, '#c9a060'); px(8, -34, 9, 5, '#c9a060'); for (const x of [-10, -5, 2, 6]) px(x + (x > 0 ? st : -st), -12, 2, 12, '#a88048'); },
    lizard(st) { px(-6, -3, 12, 3, '#6a9a3a'); px(5, -4, 4, 3, '#6a9a3a'); px(-11, -2, 6, 2, '#6a9a3a'); px(-3 + st, -1, 2, 1, '#4a7a2a'); px(2 - st, -1, 2, 1, '#4a7a2a'); },
    crab(st) { px(-5, -5, 10, 5, '#e0503a'); px(-8, -7 + st, 3, 3, '#e0503a'); px(5, -7 - st, 3, 3, '#e0503a'); px(-3, -7, 1, 2, '#1b1530'); px(2, -7, 1, 2, '#1b1530'); },
    polarbear(st) { px(-14, -16, 26, 12, '#f2f2ec'); px(10, -18, 9, 8, '#f2f2ec'); px(17, -15, 2, 2, '#1b1530'); px(12, -20, 2, 2, '#f2f2ec'); for (const x of [-12, -6, 3, 8]) px(x + (x > 0 ? st : -st), -5, 4, 5, '#e2e2dc'); },
  };

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
      const col = p.world ? p.world.pad : p.route === 'venus' ? '#ffd23f' : p.route === 'earth' ? '#8fd0ff' : '#ff6a4a';
      if (p.world) {
        // A signpost pointing the way to this one's world
        px(-w / 2 - 4, -46, 2, 46, '#c9ced9');
        px(-w / 2 - 30, -60, 54, 15, '#2a2230'); px(-w / 2 - 30, -60, 54, 2, col);
        ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = col; ctx.fillText(`${p.world.name.toUpperCase()} >`, -w / 2 - 3, -49);
        ctx.textAlign = 'start';
        if (aimFor === p.aim) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(clock * 6); px(-w / 2, -6, w, 3, col); ctx.globalAlpha = 1; }
      }
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
    driver(p, w) {
      // A mass driver: a magnet rail with glowing coils, pointing up and out
      px(-w / 2, 0, w, 6, '#5d6472'); px(-w / 2, 6, w, 8, '#2a2a36'); px(-w / 2, 0, w, 2, '#c9ced9');
      const L = fx.launch && fx.launch.p === p ? fx.launch : null, ch = L ? clamp(L.t / LAUNCH_CHARGE, 0, 1) : 0;
      for (let i = 0; i < 6; i++) {
        const on = L ? i < ch * 6 : (Math.floor(clock * 10) - i) % 6 === 0;
        const x = -w / 2 + 10 + i * ((w - 20) / 5);
        ctx.strokeStyle = on ? (L ? '#ffffff' : '#6dd3ff') : '#3b6fd8'; ctx.lineWidth = L && on ? 4 : 3;
        ctx.beginPath(); ctx.ellipse(x, -10, 6, 14, 0, 0, TAU); ctx.stroke();
        if (L && on && Math.random() < 0.5) { ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, -24); ctx.lineTo(x + (Math.random() - 0.5) * 16, -34 - Math.random() * 14); ctx.stroke(); }
      }
      if (L) {
        const g2 = ctx.createRadialGradient(0, -20, 4, 0, -20, 40 + 80 * ch);
        g2.addColorStop(0, `rgba(190,240,255,${0.3 + 0.5 * ch})`); g2.addColorStop(1, 'rgba(109,211,255,0)');
        ctx.fillStyle = g2; ctx.fillRect(-w, -140, w * 2, 160);
      }
      const g = ctx.createLinearGradient(0, 0, 0, -60);
      g.addColorStop(0, 'rgba(109,211,255,0.35)'); g.addColorStop(1, 'rgba(109,211,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -60, w, 60);
      px(-12, 14, 24, 14, '#3b3b4f'); px(-8, 18, 6, 6, '#ffd23f');
    },
    plume(p, w) {
      // A puff of a water-vapour plume, glittering with ice crystals
      const puffs = [[-w * 0.32, 14, 15], [-w * 0.1, 8, 20], [w * 0.14, 10, 18], [w * 0.34, 16, 13]];
      ctx.fillStyle = 'rgba(200,225,245,0.75)';
      for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y + 4, r, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(245,250,255,0.95)';
      for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, TAU); ctx.fill(); }
      for (let i = 0; i < 6; i++) if (Math.sin(clock * 5 + i * 2 + p.spin) > 0.3) px(-w * 0.4 + i * w * 0.16, 2 + (i % 3) * 8, 2, 2, '#ffffff');
    },
    iceberg(p, w) {
      // A slab of ice, blue in its depths
      ctx.fillStyle = '#9cc4e4'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w * 0.38, 20); ctx.lineTo(w * 0.1, 30); ctx.lineTo(-w * 0.3, 24); ctx.closePath(); ctx.fill();
      px(-w / 2, 0, w, 4, '#f2f8ff'); ctx.strokeStyle = 'rgba(150,80,50,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-w * 0.35, 3); ctx.lineTo(w * 0.3, 6); ctx.stroke();
    },
    probe7(p, w) {
      // A Cassini-style spacecraft: a big white dish on top (land on it), a
      // tall gold-foil body, a long boom, and a little probe on its side
      ctx.fillStyle = '#f4f6fb'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, 22, w / 2, 0); ctx.lineTo(w / 2 - 6, 4); ctx.quadraticCurveTo(0, 26, -w / 2 + 6, 4); ctx.fill();
      px(-w / 2, -2, w, 3, '#ffffff'); px(-2, -18, 4, 16, '#c9ced9'); px(-5, -22, 10, 5, '#e8e8f0');
      px(-16, 18, 32, 46, '#d9a63a'); px(-16, 18, 32, 3, '#ffd23f'); px(-12, 26, 6, 30, '#b07a1a');
      px(16, 34, 70, 2, '#9aa3b5'); px(84, 30, 8, 8, '#e8e8f0');
      ctx.fillStyle = '#e0d2b8'; ctx.beginPath(); ctx.arc(-26, 40, 12, 0, TAU); ctx.fill(); px(-30, 37, 8, 2, '#a88a5a');
      for (let i = 0; i < 3; i++) { const t = (clock * 2 + i / 3) % 1; px(-6 + i * 5, 64 + t * 30, 3, 6, `rgba(255,200,120,${1 - t})`); }
      if (!p.noLabel) { ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#bff0ff'; ctx.fillText('HITCH A RIDE!', 0, -32); ctx.textAlign = 'start'; }
    },
    shade(p, w) {
      // A sunshade: white on the sunny side, like Parker Solar Probe's heat
      // shield, with a little gold-foil craft tucked in its shadow
      px(-w / 2, 0, w, 6, '#f4f6fb'); px(-w / 2, 6, w, 5, '#2b2b3a'); px(-w / 2 + 4, 11, w - 8, 3, '#c9ced9');
      px(-w / 2, 0, w, 2, '#ffffff');
      px(-16, 14, 32, 18, '#d9a63a'); px(-16, 14, 32, 3, '#ffd23f'); px(-10, 20, 4, 8, '#b07a1a'); px(4, 22, 6, 6, '#b07a1a');
      px(-36, 20, 20, 7, PANEL); px(16, 20, 20, 7, PANEL);
      px(-1, 32, 2, 10, '#9aa3b5');
    },
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
    ufo(p, w) {
      // A flying saucer, Martian at the controls: you bounce on its glass dome
      const bob = Math.sin(clock * 3 + p.spin) * 2;
      ctx.translate(0, bob);
      ctx.fillStyle = 'rgba(191,232,255,0.45)'; ctx.beginPath(); ctx.arc(0, 18, 22, Math.PI, TAU); ctx.fill();
      martianHead(0, 10, 1.3);
      ctx.strokeStyle = 'rgba(230,245,255,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 18, 22, Math.PI, TAU); ctx.stroke();
      const g = ctx.createLinearGradient(0, 14, 0, 34);
      g.addColorStop(0, '#e6e9f0'); g.addColorStop(1, '#8a90a0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 22, w / 2, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6d7383'; ctx.beginPath(); ctx.ellipse(0, 28, w * 0.32, 6, 0, 0, Math.PI); ctx.fill();
      for (let i = -4; i <= 4; i++) { ctx.fillStyle = Math.sin(clock * 9 + i + p.spin) > 0 ? '#ffd23f' : '#ff5a4a'; ctx.fillRect(i * (w / 10) - 2, 21, 4, 3); }
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(clock * 6); ctx.fillStyle = '#b8ff9a';
      ctx.beginPath(); ctx.moveTo(-14, 32); ctx.lineTo(14, 32); ctx.lineTo(22, 52); ctx.lineTo(-22, 52); ctx.fill(); ctx.globalAlpha = 1;
    },
    refinery(p, w) {
      // A mining refinery: a deck to land on, ore silos, a conveyor carrying
      // ore up from the rock below, a crane arm, steam and warning lights
      rock(w, '#5d5666', '#3e3a44', '#7d7585', p);
      px(-w / 2, -6, w, 8, '#c9ced9'); px(-w / 2, -6, w, 2, '#eef1f7');
      for (const x of [-w / 2 + 6, w / 2 - 34]) { px(x, -58, 28, 52, '#8a90a0'); px(x, -58, 28, 6, '#d9a93b'); ctx.fillStyle = '#8a90a0'; ctx.beginPath(); ctx.ellipse(x + 14, -58, 14, 6, 0, Math.PI, TAU); ctx.fill(); }
      ctx.strokeStyle = '#d9a93b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(10, -70); ctx.lineTo(60, -76); ctx.stroke();
      px(58, -76, 3, 22, '#9aa3b5'); px(52, -56, 14, 8, '#7d1f26');
      // the conveyor, ore moving along it
      px(-w / 2 + 34, -24, w - 70, 5, '#3b3b4f');
      for (let i = 0; i < 8; i++) { const x = -w / 2 + 34 + (((clock * 40 + i * 22) % (w - 76))); px(x, -29, 6, 5, i % 2 ? '#b08a4a' : '#8a6a3a'); }
      for (let i = 0; i < 3; i++) { const k = (clock * 0.4 + i / 3) % 1; ctx.fillStyle = `rgba(230,230,240,${0.4 * (1 - k)})`; ctx.beginPath(); ctx.arc(-w / 2 + 20 + Math.sin(k * 6) * 4, -64 - k * 50, 6 + k * 10, 0, TAU); ctx.fill(); }
      for (const x of [-w / 2 + 2, w / 2 - 6]) if (Math.sin(clock * 4 + x) > 0) px(x, -10, 4, 4, '#ffab3d');
      ctx.save(); upright(); ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#1b1530'; ctx.fillText('BELT MINING CO.', 1, 13); ctx.fillStyle = '#ffd23f'; ctx.fillText('BELT MINING CO.', 0, 12);
      ctx.textAlign = 'start'; ctx.restore();
    },
    rubble(p, w) {
      // A rubble pile: a loose heap of boulders, spinning fast
      ctx.translate(0, 20); ctx.rotate(p.spin + clock * (p.turn || 2)); ctx.translate(0, -20);
      for (let i = 0; i < 9; i++) {
        const ang = i * 2.4 + p.spin, d = (i % 3) * 14 + 6, r = 9 + ((i * 7) % 5) * 2;
        const x = Math.cos(ang) * d, y = 20 + Math.sin(ang) * d;
        ctx.fillStyle = ['#7d7585', '#6f6670', '#8a8290'][i % 3]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, TAU); ctx.fill();
      }
    },
    haven(p, w) {
      // The safe rock at the turn: broad, flat and steady, with landing lights
      ctx.fillStyle = '#7d7585';
      ctx.beginPath(); ctx.moveTo(-w / 2, 4); ctx.lineTo(-w / 2 + 12, 0); ctx.lineTo(w / 2 - 12, 0); ctx.lineTo(w / 2, 6);
      ctx.lineTo(w / 2 - 24, 40); ctx.lineTo(-w / 2 + 30, 46); ctx.closePath(); ctx.fill();
      px(-w / 2 + 12, 0, w - 24, 3, '#b8b0c2');
      ctx.fillStyle = '#5d5563'; ctx.beginPath(); ctx.arc(-w * 0.2, 22, 8, 0, TAU); ctx.arc(w * 0.18, 30, 6, 0, TAU); ctx.fill();
      for (let i = -3; i <= 3; i++) px(i * 22 - 2, -3, 4, 3, Math.sin(clock * 4 - i * 0.8) > 0 ? '#52e07a' : '#2a5a3a');
      ctx.save(); upright();
      ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#52e07a'; ctx.fillText('SAFE ROCK', 0, 60);
      ctx.restore();
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
    const B = p.world, r = fx.arrive && fx.arrive.target === p ? fx.arrive.gr : B.r;
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
      if (b.kind === 'lava' || b.kind === 'steam') {
        // Hollow Earth: lava jets and Morlock steam vents, bubbling, then blasting up
        const lava = b.kind === 'lava';
        at(b.a + theta, R1, () => {
          px(-12, 2, 24, 8, lava ? '#3a1a10' : '#3a3a42');
          if (st === 'warn') { for (let i = 0; i < 4; i++) px(-6 + Math.random() * 12, -10 - Math.random() * 20, 5, 5, lava ? '#ffab3d' : '#d6dce8'); }
          else {
            px(-18, -len, 36, len, lava ? 'rgba(255,90,30,0.3)' : 'rgba(220,230,240,0.25)');
            px(-9, -len, 18, len, lava ? 'rgba(255,170,60,0.85)' : 'rgba(240,245,250,0.7)');
            px(-3, -len, 6, len, lava ? '#fff3b0' : '#ffffff');
          }
        }, len + 60);
        continue;
      }
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
    // The passage through the belt: a dark row of asteroids behind, then the
    // row you bounce off, with pinball-pink rims that flash when hit
    const lump = (q, body, dark, light) => {
      ctx.save(); ctx.rotate(q.spin + clock * (q.turn || 0.2));
      ctx.fillStyle = body;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) { const ang = (i * TAU) / 9, rr = q.r * (0.8 + 0.2 * Math.sin(i * 2.7 + q.spin * 3)); i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(rr, 0); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(-q.r * 0.3, -q.r * 0.2, q.r * 0.22, 0, TAU); ctx.arc(q.r * 0.35, q.r * 0.25, q.r * 0.15, 0, TAU); ctx.fill();
      if (light) px(-q.r * 0.5, -q.r * 0.7, q.r * 0.6, 3, light);
      ctx.restore();
    };
    const faint = (q) => { ctx.globalAlpha = route && q.route && q.route !== route ? 0.2 : 1; };
    for (const q of world.back || []) { faint(q); at(q.a + theta, q.R, () => lump(q, q.route === 'hygiea' ? '#26222c' : '#3a3540', '#1c1a20'), 60); }
    for (const q of world.rocks || []) {
      faint(q);
      if (q.moonOf) {
        // Its orbit: a faint dotted ring round the asteroid it belongs to
        const h = q.moonOf;
        at(h.a + theta, h.R - 18, () => {
          ctx.fillStyle = 'rgba(220,230,255,0.35)';
          for (let i = 0; i < 28; i++) { const ang = (i * TAU) / 28; ctx.fillRect(Math.cos(ang) * q.rad - 1.5, -Math.sin(ang) * q.rad * 0.7 - 1.5, 3, 3); }
        }, q.rad + 40);
      }
      at(q.a + theta, q.R, () => {
        if (q.moonOf) {
          // A little moon: pale, cratered and glowing, unlike the rocks
          const g = ctx.createRadialGradient(0, 0, q.r * 0.8, 0, 0, q.r * 2.2);
          g.addColorStop(0, `rgba(230,236,255,${0.45 + q.flash * 0.4})`); g.addColorStop(1, 'rgba(230,236,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, q.r * 2.2, 0, TAU); ctx.fill();
          ctx.fillStyle = q.flash > 0.5 ? '#ffffff' : '#dfe3ec'; ctx.beginPath(); ctx.arc(0, 0, q.r, 0, TAU); ctx.fill();
          ctx.save(); ctx.beginPath(); ctx.arc(0, 0, q.r, 0, TAU); ctx.clip();
          ctx.rotate(q.spin + clock * q.turn);
          ctx.fillStyle = '#b4b8c6';
          for (const [x, y, r] of [[-7, -6, 6], [8, 4, 5], [-2, 10, 4], [9, -10, 3]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
          ctx.rotate(-(q.spin + clock * q.turn));
          ctx.fillStyle = 'rgba(20,20,40,0.3)'; ctx.beginPath(); ctx.arc(q.r * 0.5, q.r * 0.5, q.r, 0, TAU); ctx.fill();
          ctx.restore();
          ctx.save(); upright();
          ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
          ctx.fillStyle = '#1b1530'; ctx.fillText('MOON', 1, -q.r - 7); ctx.fillStyle = '#eef1ff'; ctx.fillText('MOON', 0, -q.r - 8);
          ctx.textAlign = 'start'; ctx.restore();
          return;
        }
        if (q.pinball) {
          // A neon pinball asteroid: dark rock, a glowing cyan rim, a ring of
          // chasing lights, and a bright flash when it flings you
          const f = q.flash;
          const g = ctx.createRadialGradient(0, 0, q.r * 0.6, 0, 0, q.r * 2 + f * 20);
          g.addColorStop(0, `rgba(109,211,255,${0.35 + f * 0.5})`); g.addColorStop(1, 'rgba(255,106,213,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, q.r * 2 + f * 20, 0, TAU); ctx.fill();
          lump(q, f > 0.5 ? '#ffffff' : '#2a2438', '#1a1626', '#6dd3ff');
          ctx.strokeStyle = f > 0.3 ? '#ffffff' : '#6dd3ff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, q.r + 3, 0, TAU); ctx.stroke();
          for (let i = 0; i < 10; i++) {
            const ang = (i * TAU) / 10 + clock * 1.5, on = (Math.floor(clock * 8) + i) % 3 === 0;
            px(Math.cos(ang) * (q.r + 8) - 2, Math.sin(ang) * (q.r + 8) - 2, 4, 4, on ? '#ff6ad5' : '#5a2a6a');
          }
          return;
        }
        ctx.strokeStyle = `rgba(255,106,213,${0.22 + 0.12 * Math.sin(clock * 3 + q.ph) + q.flash * 0.7})`;
        ctx.lineWidth = 2 + q.flash * 4;
        ctx.beginPath(); ctx.arc(0, 0, q.r + 4 + q.flash * 5, 0, TAU); ctx.stroke();
        lump(q, q.flash > 0.5 ? '#ffd6f2' : q.dark ? '#4a4450' : '#6f6670', q.dark ? '#332f38' : '#4f4752', q.dark ? '#6d6577' : '#998fa0');
        if (q.claim) { px(-1, -q.r - 14, 2, 14, '#c9ced9'); px(1, -q.r - 14, 9, 6, '#ffd23f'); } // someone's mining claim
      }, 60);
    }
    // Pop bumpers: red rim, yellow cap, a star on top; they flash when hit
    for (const q of world.pops || []) {
      faint(q);
      at(q.a + theta, q.R, () => {
        upright();
        const f = q.flash;
        if (f > 0) { ctx.fillStyle = `rgba(255,210,63,${0.5 * f})`; ctx.beginPath(); ctx.arc(0, 0, q.r + 14 * f + 6, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#7d1f26'; ctx.beginPath(); ctx.arc(2, 3, q.r + 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e0433b'; ctx.beginPath(); ctx.arc(0, 0, q.r + 4, 0, TAU); ctx.fill();
        ctx.fillStyle = f > 0.5 ? '#ffffff' : '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, q.r - 3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e0433b';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const ang = q.spin + clock * 0.6 + (i * Math.PI) / 5, rr = i % 2 ? 4 : 10; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fill();
      }, 60);
    }
    ctx.globalAlpha = 1;
    // Rogue asteroids: glowing hot orange so you can tell them from the walls,
    // with a trail of dust behind
    for (const q of fx.crossers || []) {
      at(q.a + theta, q.R, () => {
        const dir = Math.sign(q.va) || 1;
        for (let i = 1; i <= 5; i++) { ctx.globalAlpha = 0.5 - i * 0.08; ctx.fillStyle = '#c9a27a'; ctx.beginPath(); ctx.arc(-dir * i * 9, Math.sin(i + clock * 5) * 3, q.r * (0.7 - i * 0.1), 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(0, 0, q.r * 0.6, 0, 0, q.r * 2);
        g.addColorStop(0, 'rgba(255,140,60,0.55)'); g.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, q.r * 2, 0, TAU); ctx.fill();
        lump(q, q.flash > 0.5 ? '#ffe0c0' : '#8a5a3b', '#5a3a28', '#c9a27a');
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
  // Now and then a huge asteroid sweeps past right in front of you, close and
  // dark and fast, out of focus: scenery only, it can't hit you
  function updateForeground(dt) {
    fx.fore = fx.fore || [];
    fx.foreT = (fx.foreT ?? 4) - dt;
    if (fx.foreT <= 0 && beltK() > 0.9 && state === 'play') {
      fx.foreT = 8 + Math.random() * 6;
      const r = 70 + Math.random() * 70;
      fx.fore.push({ x: W * (Math.random() < 0.5 ? 0.08 + Math.random() * 0.2 : 0.72 + Math.random() * 0.2), y: -r * 2, r, vy: 1000 + Math.random() * 500, spin: Math.random() * TAU, turn: (Math.random() - 0.5) * 1.2, shape: Array.from({ length: 11 }, () => 0.7 + Math.random() * 0.3) });
    }
    for (const q of fx.fore) { q.y += (q.vy + Math.max(0, player.vr) * 0.6) * dt; q.spin += q.turn * dt; }
    fx.fore = fx.fore.filter((q) => q.y < H + q.r * 3);
  }
  function drawForeground() {
    for (const q of fx.fore || []) {
      // A smear of motion blur, then the rock itself, its edge rim-lit
      for (let i = 3; i >= 0; i--) {
        ctx.save(); ctx.translate(q.x, q.y - i * q.r * 0.25); ctx.rotate(q.spin);
        ctx.globalAlpha = i ? 0.12 : 0.95;
        ctx.fillStyle = '#0e0c12';
        ctx.beginPath(); q.shape.forEach((k, j) => { const ang = (j * TAU) / 11; j ? ctx.lineTo(Math.cos(ang) * q.r * k, Math.sin(ang) * q.r * k) : ctx.moveTo(q.r * k, 0); }); ctx.closePath(); ctx.fill();
        if (!i) { ctx.strokeStyle = 'rgba(255,220,190,0.25)'; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  // In the asteroid ring: an arrow at the edge of the screen pointing round to
  // your world (or the nearest one, if you haven't picked)
  function drawWorldPointer() {
    if (state !== 'play' || beltK() < 0.5) return;
    let d = null, best = Infinity;
    for (const q of world.plats) {
      if (!q.dest) continue;
      const off = wrap(q.a + theta) * player.r;
      if ((aimFor && q.route === aimFor) || (!aimFor && Math.abs(off) < best)) { d = q; best = Math.abs(off); if (aimFor) break; }
    }
    if (!d) return;
    const off = wrap(d.a + theta) * player.r, up = d.R - d.world.r - player.r;
    if (Math.abs(off) < W * 0.42 && Math.abs(up) < H * 0.45) return; // it's on screen
    const ang = Math.atan2(-up, off), x = W / 2 + Math.cos(ang) * (W * 0.42), y = H * 0.46 + Math.sin(ang) * (H * 0.36);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = d.world.pad;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -9); ctx.lineTo(-2, 0); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#1b1530'; ctx.fillText(d.world.name.toUpperCase(), x + 1, y + 21);
    ctx.fillStyle = d.world.pad; ctx.fillText(d.world.name.toUpperCase(), x, y + 20);
    ctx.textAlign = 'start';
  }
  // Mining drones: little craft with a blinking light, carrying ore from one
  // asteroid to the next; drill drones hover over a rock, cutting into it
  function drawDrones() {
    for (const d of world.drones || []) {
      if (d.drill) {
        const h = d.drill;
        at(h.a + theta, h.R, () => {
          const y = -52 + Math.sin(clock * 2 + d.ph) * 4;
          px(-8, y - 6, 16, 8, '#c9ced9'); px(-8, y - 6, 16, 2, '#eef1f7'); px(-11, y - 9, 22, 2, 'rgba(60,60,72,0.8)');
          if (Math.sin(clock * 6 + d.ph) > 0) px(-1, y - 8, 2, 2, '#ff5a4a');
          const on = Math.sin(clock * 1.3 + d.ph) > -0.3;
          if (on) {
            px(-1, y + 2, 3, -y - 2, 'rgba(255,90,74,0.85)'); px(-3, y + 2, 7, -y - 2, 'rgba(255,90,74,0.25)');
            for (let i = 0; i < 4; i++) px(Math.sin(clock * 30 + i * 2) * 10, -3 - Math.abs(Math.cos(clock * 25 + i)) * 8, 2, 2, '#ffd23f');
          }
        }, 80);
        continue;
      }
      const k = (Math.sin(clock * d.speed + d.ph) + 1) / 2, a = lerp(d.p1.a, d.p1.a + wrap(d.p2.a - d.p1.a), k), R = lerp(d.p1.R, d.p2.R, k) + 60 + Math.sin(k * Math.PI) * 40;
      at(a + theta, R, () => {
        px(-7, -5, 14, 8, '#d9a93b'); px(-7, -5, 14, 2, '#f5d27a'); px(-10, -8, 20, 2, 'rgba(60,60,72,0.8)');
        if (Math.cos(clock * d.speed + d.ph) > 0) { px(-1, 3, 2, 8, '#9aa3b5'); px(-5, 11, 10, 7, '#8a6a3a'); } // a lump of ore on its hook
        if (Math.sin(clock * 5 + d.ph) > 0) px(-1, -7, 2, 2, '#52e07a');
      }, 40);
    }
  }
  // A grabber robot: boxy, a red eye, two claw arms; and an ore lift: a
  // glowing pod with green arrows pointing up
  function drawGrabber(open) {
    px(-14, -12, 28, 22, '#5d5563'); px(-14, -12, 28, 4, '#8a8290'); px(-10, -4, 20, 4, '#2a2230');
    px(-6 + Math.sin(clock * 3) * 4, -4, 6, 4, '#ff5a4a');
    ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 3;
    for (const s2 of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s2 * 12, 8); ctx.lineTo(s2 * 18, 20); ctx.lineTo(s2 * (open ? 22 : 10), 30); ctx.stroke();
    }
    px(-2, -20, 4, 8, '#9aa3b5'); if (Math.sin(clock * 6) > 0) px(-2, -22, 4, 3, '#ff5a4a');
  }
  function drawSnakesLadders() {
    for (const g of world.grabbers || []) {
      if (fx.carry && fx.carry.from === g) continue;
      at(g.a + theta, g.R, () => { ctx.translate(0, Math.sin(clock * 2 + g.ph) * 5); drawGrabber(true); }, 60);
    }
    for (const l of world.lifts || []) {
      if (fx.carry && fx.carry.from === l) continue;
      at(l.a + theta, l.R, () => {
        const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 40);
        g.addColorStop(0, 'rgba(82,224,122,0.45)'); g.addColorStop(1, 'rgba(82,224,122,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
        px(-12, -16, 24, 30, '#c9ced9'); px(-12, -16, 24, 4, '#eef1f7'); px(-8, -10, 16, 18, '#1f3a2a');
        for (let i = 0; i < 2; i++) { const y = 4 - (((clock * 30) + i * 9) % 18); ctx.fillStyle = '#52e07a'; ctx.beginPath(); ctx.moveTo(0, y - 4); ctx.lineTo(-5, y + 2); ctx.lineTo(5, y + 2); ctx.fill(); }
        ctx.save(); upright(); ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#52e07a'; ctx.fillText('LIFT', 0, -24); ctx.textAlign = 'start'; ctx.restore();
      }, 60);
    }
    // Whatever's carrying you, drawn with you
    const c = fx.carry;
    if (c) at(0, player.r + 24, () => {
      if (c.kind === 'down') { ctx.translate(0, -44); drawGrabber(false); }
      else { ctx.globalAlpha = 0.6; px(-16, -30, 32, 64, '#52e07a'); ctx.globalAlpha = 1; }
    }, 60);
  }
  function drawPebbles() {
    for (const q of fx.pebbles || []) at(q.a + theta, q.R, () => { px(-3, -3, 6, 5, '#9a92a2'); px(-3, -3, 3, 2, '#d0c8d8'); }, 10);
  }
  // The flare, in screen space: a pulsing warning from the Sun's side with a
  // countdown, then a blinding wash of light
  function drawFlare() {
    const f = fx.flare;
    if (!f) return;
    const [sx, sy] = level === 4 ? [W * 0.5, -H * 0.02] : [W * 0.14, H * 0.12];
    if (f.t < f.warn) {
      const pulse = 0.12 + 0.1 * Math.sin(clock * 10);
      const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, Math.max(W, H));
      g.addColorStop(0, `rgba(255,200,80,${pulse + 0.2})`); g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.font = '22px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      if (f.cme) {
        // The cloud of plasma, swelling out from the Sun towards you
        const k = f.t / f.warn, rr = k * k * H * 0.75;
        ctx.strokeStyle = `rgba(255,90,60,${0.35 + 0.3 * k})`; ctx.lineWidth = 10 + k * 20;
        ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI); ctx.stroke();
      }
      const cy2 = level === 4 ? H * 0.68 : H * 0.4;
      ctx.fillStyle = '#1b1530'; ctx.fillText(String(Math.ceil(f.warn - f.t)), W / 2 + 2, cy2 + 2);
      ctx.fillStyle = f.cme ? '#ff5a4a' : '#ffd23f'; ctx.fillText(String(Math.ceil(f.warn - f.t)), W / 2, cy2);
      ctx.textAlign = 'start';
    } else {
      const k = clamp((f.t - f.warn) / 1.6, 0, 1);
      ctx.fillStyle = `rgba(255,236,190,${0.55 * (1 - k)})`; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(255,200,90,${0.6 * (1 - k)})`; ctx.lineWidth = 6;
      for (let i = 0; i < 9; i++) { const ang = level === 4 ? 0.5 + i * 0.27 : 0.1 + i * 0.17; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(ang) * W * 1.5, sy + Math.sin(ang) * W * 1.5); ctx.stroke(); }
    }
  }
  // While a flare is on its way, show the shade each thing casts away from
  // the Sun (straight down, towards Venus), so you can see where to hide
  function drawShadows() {
    const f = fx.flare;
    if (!f || f.hit) return;
    const a0 = 0.3 + 0.15 * Math.sin(clock * 6);
    const cast = (a, R, half) => {
      const s = a + theta;
      if (Math.abs(wrap(s)) * R > W) return;
      at(s, R, () => {
        const len = SHADE_LEN - 40;
        const g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, `rgba(110,200,255,${a0})`); g.addColorStop(1, 'rgba(110,200,255,0)');
        ctx.fillStyle = g; ctx.fillRect(-half, 4, half * 2, len);
        // Dashed edges, so the safe strip stands out against the glare
        for (let y = 8; y < len; y += 16) { px(-half, y, 2, 8, `rgba(170,225,255,${a0 * 2 * (1 - y / len)})`); px(half - 2, y, 2, 8, `rgba(170,225,255,${a0 * 2 * (1 - y / len)})`); }
      }, SHADE_LEN);
    };
    for (const p of world.plats) if (!p.dest && !ghost(p) && Math.abs(p.R - player.r) < 600) cast(p.a, p.R, p.w / 2 + 10);
    for (const q of world.rocks || []) if (Math.abs(q.R - player.r) < 600) cast(q.a, q.R, q.r + 10);
  }
  function drawCrash() {
    const c = fx.crash;
    if (!c) return;
    if (!c.hit) {
      // Two asteroids closing in, and a flashing warning where they'll meet
      const k = c.t / 1.3, gap = (1 - k * k) * 200;
      for (const side of [-1, 1]) {
        at(c.a + (side * gap) / c.R + theta, c.R, () => {
          ctx.rotate(clock * 2 * side);
          ctx.fillStyle = '#7d7585'; ctx.beginPath();
          for (let i = 0; i < 8; i++) { const ang = (i * TAU) / 8, rr = 22 * (0.8 + 0.2 * Math.sin(i * 2.1 + side)); i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(rr, 0); }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#5d5563'; ctx.beginPath(); ctx.arc(-5, -4, 6, 0, TAU); ctx.fill();
        }, 60);
      }
      if (Math.sin(clock * 18) > 0) at(c.a + theta, c.R, () => { upright(); ctx.font = '14px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff5a4a'; ctx.fillText('!', 0, 6); ctx.textAlign = 'start'; }, 40);
      return;
    }
    const fade = clamp(1 - (c.t - 1.3) / 3, 0, 1);
    ctx.globalAlpha = fade;
    for (const q of c.debris) at(q.a + theta, q.R, () => { ctx.rotate(q.spin); px(-q.r / 2, -q.r / 2, q.r, q.r * 0.8, '#8a8290'); px(-q.r / 2, -q.r / 2, q.r * 0.5, 2, '#c9c2d0'); }, 20);
    ctx.globalAlpha = 1;
  }
  // The cave asteroid, the light freighter bolting out of it, and the giant
  // space slug. The first time you come by, the freighter shoots out of the
  // cave with the slug lunging after it, and gets clean away with a jump to
  // lightspeed. After that the slug lurks, and lunges at you if you come too
  // close: get bitten and it takes a big chunk of your score.
  const SLUG_MOUTH = [30, -82];
  function slugOut(c) {
    if (c.t0 != null && !c.escaped) {
      const t = clock - c.t0;
      return t < 0.6 ? 0 : t < 1.4 ? (t - 0.6) / 0.8 : t < 3 ? 1 : t < 3.8 ? 1 - (t - 3) / 0.8 : 0;
    }
    if (c.lungeAt == null) return 0;
    const t = clock - c.lungeAt;
    return t < 0.45 ? t / 0.45 : t < 1.6 ? 1 : t < 2.4 ? 1 - (t - 1.6) / 0.8 : 0;
  }
  const slugMaw = (c, out) => [SLUG_MOUTH[0] + Math.sin(2.4 + clock * 2) * 14, SLUG_MOUTH[1] - 150 * out - 8];
  // Being carried: by a grabber robot down to the refinery, or by an ore lift
  // up four layers. You can't steer, and when it lets go you drop onto it.
  function startCarry(kind, target, from) {
    player.carried = true; player.vr = 0; player.vx = 0; player.heat = 0;
    fx.carry = { kind, target, a0: -theta, R0: player.r, t: 0, dur: kind === 'down' ? 2.6 : 1.8, from };
    if (kind === 'down') {
      loseMult(); pop('GRABBED!', '#ff5a4a', player.r + 130); sfx.airlock(); addShake(6);
      toast('A mining robot grabbed you, and it\'s hauling you all the way back down to the refinery. Snakes and ladders!', 4.5);
    } else {
      addScore(250); pop('LIFT!', '#52e07a', player.r + 130); sfx.tier();
      if (!fx.liftTold) { fx.liftTold = true; toast('An ore lift: hop in and it carries you up four layers. Snakes and ladders!', 4); }
    }
  }
  function updateCarry(dt) {
    const c = fx.carry;
    if (!c) {
      if (level !== 3 || state !== 'play' || player.onGround) return;
      const touching = (q) => Math.hypot(wrap(q.a + theta) * player.r, q.R - (player.r + 24)) < 34;
      for (const g of world.grabbers || []) if (touching(g)) {
        const ref = world.plats.filter((q) => q.type === 'refinery').sort((p, q) => Math.abs(wrap(p.a + theta)) - Math.abs(wrap(q.a + theta)))[0];
        if (ref) { g.busy = clock; startCarry('down', ref, g); }
        return;
      }
      for (const l of world.lifts || []) if (touching(l)) {
        const k = Math.min(TOP - 1, Math.floor(tierFloat(l.R)) + 4);
        let best = null, bd = Infinity;
        for (const q of world.plats) { if (q.tier !== k || q.dest || q.broken) continue; const d = Math.abs(wrap(q.a - l.a)); if (d < bd) { bd = d; best = q; } }
        if (best) { startCarry('up', best, l); return; }
      }
      return;
    }
    c.t += dt;
    const k = clamp(c.t / c.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    theta = -(c.a0 + wrap(c.target.a - c.a0) * e);
    player.r = lerp(c.R0, c.target.R + 60, e);
    player.vr = 0; player.vx = 0;
    if (k >= 1) {
      player.carried = false; fx.carry = null;
      player.vr = -60; player.apexR = player.r; player.lastPlat = null; player.lastH = 0;
      lastTier = c.target.tier - 1;
    }
  }
  function updateCaves() {
    for (const c of world.caves || []) {
      if (c.t0 == null) continue;
      if (!c.escaped && clock - c.t0 > 4.2) c.escaped = true;
      // The mouth, in the world
      const mR = c.R - SLUG_MOUTH[1], mA = c.a + SLUG_MOUTH[0] / c.R;
      const dMouth = Math.hypot(wrap(mA + theta) * player.r, mR - (player.r + 24));
      if (c.escaped && dMouth < 340 && (c.lungeAt == null || clock - c.lungeAt > 4)) { c.lungeAt = clock; sfx.boom(0.3); }
      const out = slugOut(c);
      if (out > 0.55 && state === 'play' && (c.bitAt == null || clock - c.bitAt > 3)) {
        const [x, y] = slugMaw(c, out);
        const a = c.a + x / c.R, R = c.R - y;
        const dx = wrap(a + theta) * R, dy = R - (player.r + 24), d = Math.hypot(dx, dy);
        if (d < 58) {
          c.bitAt = clock;
          const steal = Math.max(500, Math.round(score * 0.2));
          score = Math.max(0, score - steal); updateScoreHud(true);
          pop(`CHOMP! -${fmtScore(steal)}`, '#ff5a4a', player.r + 130);
          loseMult(); addShake(12); buzz([60, 40, 60]); sfx.thud();
          player.vx = -(dx / (d || 1)) * 500; player.vr = -(dy / (d || 1)) * 500;
          if (!fx.slugTold) { fx.slugTold = true; toast('The space slug took a big bite out of your score! Keep your distance from that cave.', 4.5); }
        }
      }
    }
  }
  function drawCaves() {
    for (const c of world.caves || []) {
      at(c.a + theta, c.R, () => {
        // The asteroid: big, cratered, with the cave mouth up on one side
        ctx.fillStyle = '#4a4450';
        ctx.beginPath();
        for (let i = 0; i < 14; i++) { const ang = (i * TAU) / 14, rr = 118 * (0.86 + 0.14 * Math.sin(i * 2.7)); i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(rr, 0); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5d5666'; ctx.beginPath(); ctx.arc(-34, -30, 70, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a3540';
        for (const [x, y, r] of [[40, 40, 18], [-50, 50, 12], [-20, -70, 10], [70, -10, 9]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        const [mx, my] = SLUG_MOUTH;
        ctx.fillStyle = '#0b0a10'; ctx.beginPath(); ctx.ellipse(mx, my, 30, 16, -0.3, 0, TAU); ctx.fill();
        // Two glowing eyes in the dark of the cave, while it waits
        if (c.escaped && slugOut(c) === 0 && Math.sin(clock * 0.7 + c.ph) > -0.6) { px(mx - 10, my - 3, 4, 3, '#ffd23f'); px(mx + 4, my - 4, 4, 3, '#ffd23f'); }
        const out = slugOut(c);
        if (out > 0) {
          const segs = 9, len = 150 * out;
          for (let i = 0; i <= segs; i++) {
            const u = i / segs, sx = mx + Math.sin(u * 2.4 + clock * 2) * 14 * u, sy = my - len * u;
            ctx.fillStyle = i % 2 ? '#8a7a72' : '#9c8c82';
            ctx.beginPath(); ctx.arc(sx, sy, 24 - u * 4, 0, TAU); ctx.fill();
          }
          const [x, y] = slugMaw(c, out), jaw = 0.6 + 0.4 * Math.sin(clock * 9);
          ctx.fillStyle = '#2a1018'; ctx.beginPath(); ctx.ellipse(x, y, 20, 12 * jaw + 4, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#f2ead8';
          for (let i = 0; i < 10; i++) { const ang = (i * TAU) / 10; ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * 20, y + Math.sin(ang) * (12 * jaw + 4)); ctx.lineTo(x + Math.cos(ang) * 13, y + Math.sin(ang) * (8 * jaw + 2)); ctx.lineTo(x + Math.cos(ang + 0.3) * 20, y + Math.sin(ang + 0.3) * (12 * jaw + 4)); ctx.fill(); }
        }
        // The freighter: bolts out of the cave and away, then jumps to lightspeed
        if (c.t0 != null && !c.escaped) {
          const t = clock - c.t0;
          if (t > 0.2 && t < 3.6) {
            const k = clamp((t - 0.2) / 3, 0, 1), fx0 = mx + k * 300, fy = my - 40 - k * 260 + Math.sin(k * 9) * 8;
            ctx.save(); ctx.translate(fx0, fy); ctx.rotate(-0.7);
            if (t > 3.1) {
              // The jump: the ship stretches into streaks of light
              const s2 = (t - 3.1) / 0.5;
              ctx.fillStyle = `rgba(220,240,255,${1 - s2})`; ctx.fillRect(-20, -3, 60 + s2 * 900, 6);
              ctx.fillStyle = `rgba(160,210,255,${0.6 * (1 - s2)})`; ctx.fillRect(-20, -10, 40 + s2 * 700, 3); ctx.fillRect(-20, 8, 40 + s2 * 700, 3);
            } else {
              ctx.fillStyle = 'rgba(140,200,255,0.7)'; ctx.fillRect(-34, -6, 10, 12);
              ctx.fillStyle = '#c9ced9'; ctx.beginPath(); ctx.ellipse(0, 0, 24, 20, 0, 0, TAU); ctx.fill();
              ctx.fillRect(16, -12, 18, 7); ctx.fillRect(16, 5, 18, 7);
              ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
              ctx.fillStyle = '#c9ced9'; ctx.fillRect(4, 14, 18, 7); ctx.fillStyle = '#8fd0ff'; ctx.fillRect(18, 15, 4, 5);
            }
            ctx.restore();
          }
        }
      }, 340);
    }
  }
  function drawImprobable() {
    const q = fx.improbable;
    if (!q) return;
    const k = clamp(q.t / 1.1, 0, 1), e = 1 - Math.pow(1 - k, 3);
    const x = lerp(q.side > 0 ? W + 160 : -160, W * 0.5 + q.side * 70, e), y = H * 0.36 - Math.sin(k * Math.PI) * 30;
    ctx.save(); ctx.translate(x, y); ctx.scale(-q.side, 1);
    // A sleek white hull, swept like a running shoe, with a glowing drive
    ctx.fillStyle = '#f4f6fb';
    ctx.beginPath(); ctx.moveTo(-70, 10); ctx.quadraticCurveTo(-74, -12, -40, -16); ctx.lineTo(10, -16); ctx.quadraticCurveTo(40, -16, 64, 4); ctx.quadraticCurveTo(70, 14, 50, 16); ctx.lineTo(-62, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9ced9'; ctx.fillRect(-62, 10, 112, 4);
    ctx.fillStyle = '#8fd0ff'; ctx.fillRect(-30, -10, 34, 6);
    const g = ctx.createRadialGradient(-74, 6, 2, -74, 6, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(160,220,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-74, 6, 30, 0, TAU); ctx.fill();
    ctx.restore();
    // Improbability shimmer
    ctx.globalAlpha = 0.5 * Math.sin(k * Math.PI);
    ctx.fillStyle = ['#ff6ad5', '#6dd3ff', '#ffd23f', '#52e07a'][Math.floor(clock * 12) % 4];
    for (let i = 0; i < 12; i++) ctx.fillRect(x + Math.sin(i * 2.3 + clock * 9) * 90, y + Math.cos(i * 1.7 + clock * 7) * 40, 4, 4);
    ctx.globalAlpha = 1;
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#1b1530'; ctx.fillText('DON\'T PANIC', x + 1, y + 36); ctx.fillStyle = '#52e07a'; ctx.fillText('DON\'T PANIC', x, y + 35);
    ctx.textAlign = 'start';
  }
  // The being of light: a glowing ring with an eye, beside the platform at the
  // turn and at the outpost. It brightens and sings when it gives you a field.
  function drawBeings() {
    // Gaps in the passage walls: flashing hazard lights at each end
    for (const g of world.gaps || []) {
      if (g.route !== route) continue;
      for (const R of [g.R0, g.R1]) {
        const L = laneAt(R, g.route);
        if (!L) continue;
        at(L.a + (g.side * (L.half + 10)) / R + theta, R, () => {
          const on = Math.sin(clock * 8 + R) > 0;
          px(-4, -4, 8, 8, on ? '#ff5a4a' : '#ffd23f');
          ctx.globalAlpha = 0.35; ctx.fillStyle = on ? '#ff5a4a' : '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        }, 40);
      }
      const L = laneAt((g.R0 + g.R1) / 2, g.route);
      if (L) at(L.a + (g.side * (L.half + 30)) / ((g.R0 + g.R1) / 2) + theta, (g.R0 + g.R1) / 2, () => {
        upright();
        ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = Math.sin(clock * 6) > 0 ? '#ff5a4a' : '#ffd23f'; ctx.fillText('GAP!', 0, 3);
        ctx.textAlign = 'start';
      }, 40);
    }
    // Lost in space: the being shines a tractor beam out from the safe rock
    const rock = safeRock();
    if (rock && player.lost === true) {
      at(rock.a + theta, rock.R, () => {
        const len = Math.max(300, player.r - rock.R + 200);
        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, 'rgba(82,224,122,0.32)'); g.addColorStop(1, 'rgba(82,224,122,0.04)');
        ctx.fillStyle = g; ctx.fillRect(-BEAM_HALF, -len, BEAM_HALF * 2, len);
        ctx.fillStyle = 'rgba(160,255,180,0.5)';
        for (let i = 0; i < 6; i++) { const y = -((clock * 160 + i * len / 6) % len); ctx.fillRect(-BEAM_HALF, y, BEAM_HALF * 2, 2); }
        ctx.fillStyle = 'rgba(82,224,122,0.8)'; ctx.fillRect(-BEAM_HALF, -len, 3, len); ctx.fillRect(BEAM_HALF - 3, -len, 3, len);
      }, 4000);
    }
    for (const p of world.plats) {
      if (!p.main || !(p.tier === FLIP || p.type === 'outpost')) continue;
      at(p.a + theta, p.R, () => {
        ctx.translate(-(p.side || -1) * (p.w / 2 + 46), -50 + Math.sin(clock * 1.7) * 8);
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
      if (p.back) drawBackTramp(p, w, sq);
      else if (level === 6 && HOLLOW_PLATS[p.type]) { hollowSupport(p, w); HOLLOW_PLATS[p.type](p, w); }
      else if (p.type === 'trampoline') {
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
        // Belt asteroids spin about their middle; elsewhere they just rock
        if (p.turn) { ctx.translate(0, 18); ctx.rotate(p.spin + clock * p.turn); ctx.translate(0, -18); }
        else ctx.rotate(Math.sin(clock * 0.5 + p.spin) * 0.05);
        const [cb, cd, cl] = p.col || ['#7b7280', '#5d5563', '#a79fae'];
        ctx.fillStyle = cb;
        ctx.beginPath();
        ctx.moveTo(-w / 2, 12); ctx.lineTo(-w / 3, 0); ctx.lineTo(w / 4, -2); ctx.lineTo(w / 2, 10);
        ctx.lineTo(w / 3, 34); ctx.lineTo(-w / 5, 40); ctx.closePath(); ctx.fill();
        px(-12, 10, 10, 8, cd); px(10, 18, 8, 6, cd); px(-w / 3, 0, w * 0.55, 3, cl);
        // Metal asteroids glint as they turn; icy ones shine
        if (p.metal && Math.sin(clock * 2 + p.spin * 5) > 0.92) { px(w / 6, 6, 3, 10, '#ffffff'); px(w / 6 - 4, 10, 11, 3, '#ffffff'); }
        if (p.ice) { ctx.fillStyle = 'rgba(200,240,255,0.35)'; ctx.beginPath(); ctx.arc(0, 18, w * 0.45, 0, TAU); ctx.fill(); }
        if (p.crumble) {
          // Cracked right through: it won't hold together for long
          const shake = p.breakAt ? (Math.random() - 0.5) * 3 : 0;
          ctx.strokeStyle = '#ffab3d'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-w / 4 + shake, 2); ctx.lineTo(-w / 10, 14); ctx.lineTo(-w / 6, 24); ctx.lineTo(0, 36);
          ctx.moveTo(w / 5, 4); ctx.lineTo(w / 8, 16); ctx.lineTo(w / 4, 26); ctx.stroke();
        }
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
    }, level === 6 ? 1200 : 220);
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
    const yFor = (f) => bottom - (f / TOP) * (bottom - top) * (level === 5 || level === 7 ? 1 / 3 : 1);
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
    if (level === 6) {
      // From the inner sun at the bottom to the surface at the top
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, bottom + 10, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4fb34a'; ctx.beginPath(); ctx.arc(x, top - 10, 7, 0, TAU); ctx.fill();
    } else if (level === 7) {
      // From Europa at the bottom to Saturn at the top; the comet a third of the way up
      ctx.fillStyle = '#e8dfcf'; ctx.beginPath(); ctx.arc(x, bottom + 10, 7, 0, TAU); ctx.fill();
      drawSaturn(x, top - 12, 6, 1);
      px(x - 8, bottom - (bottom - top) / 3, 16, 2, '#bff0ff');
      const f = fx.rings7 ? 1 / 3 + (2 / 3) * (0.4 + 0.6 * clamp(fx.rings7.x / TITAN_X, 0, 1)) : fx.sling ? 1 / 3 + (2 / 3) * 0.4 * clamp(fx.sling.t / SL_END, 0, 1) : (tierFloat(player.r) / TOP) / 3;
      const yy = bottom - f * (bottom - top);
      px(x - 5, yy - 5, 10, 10, '#1b1530'); px(x - 4, yy - 4, 8, 8, '#e0433b');
      return;
    } else if (level === 5) {
      // From the belt world at the bottom to Jupiter at the top; the mass
      // driver a third of the way up, then the run
      ctx.fillStyle = l5Start.body; ctx.beginPath(); ctx.arc(x, bottom + 10, 7, 0, TAU); ctx.fill();
      drawJupiter(x, top - 12, 8);
      const yD = bottom - (bottom - top) / 3;
      px(x - 8, yD, 16, 2, '#6dd3ff');
      const f = fx.run ? (fx.run.phase === 'run' ? 1 / 3 + (2 / 3) * Math.min(1, fx.run.d / (RUN_LEN + DIVE_LEN)) : 1) : (tierFloat(player.r) / TOP) / 3;
      const yy = bottom - f * (bottom - top);
      px(x - 5, yy - 5, 10, 10, '#1b1530'); px(x - 4, yy - 4, 8, 8, '#e0433b');
      return;
    }
    if (level === 4) {
      // From Venus at the bottom to Mercury at the top
      ctx.fillStyle = '#efd9a0'; ctx.beginPath(); ctx.arc(x, bottom + 10, 8, 0, TAU); ctx.fill();
      px(x - 5, bottom + 7, 10, 2, '#dcc07a');
      ctx.fillStyle = '#a9a39c'; ctx.beginPath(); ctx.arc(x, top - 10, 6, 0, TAU); ctx.fill();
    } else if (level === 3) {
      // From Mars at the bottom to the four belt worlds at the top; a pink
      // tick marks where the view turns sideways
      ctx.fillStyle = '#c8553a'; ctx.beginPath(); ctx.arc(x, bottom + 10, 8, 0, TAU); ctx.fill();
      px(x - 4, bottom + 6, 3, 3, '#9a3b2a');
      px(x - 8, yFor(FLIP), 16, 2, '#ff6ad5');
      Object.entries(BELT_WORLDS).forEach(([key, B], i) => {
        ctx.fillStyle = B.body; ctx.beginPath(); ctx.arc(x - 9 + i * 6, top - 10, 3, 0, TAU); ctx.fill();
        if (key === aimFor) { ctx.strokeStyle = B.pad; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x - 9 + i * 6, top - 10, 5, 0, TAU); ctx.stroke(); }
      });
    } else if (level === 2) {
      // From the Moon at the bottom to Mars or Venus at the top
      ctx.fillStyle = '#c9c7cf'; ctx.beginPath(); ctx.arc(x, bottom + 10, 8, 0, TAU); ctx.fill();
      px(x - 4, bottom + 6, 3, 3, '#9e9caa'); px(x + 1, bottom + 11, 3, 3, '#9e9caa');
      if (route) { ctx.fillStyle = route === 'venus' ? '#efd9a0' : route === 'earth' ? '#2f6fd0' : '#c8553a'; ctx.beginPath(); ctx.arc(x, top - 10, 7, 0, TAU); ctx.fill(); }
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

  // ---- Level 5 drawing ---------------------------------------------------------
  // Jupiter: cream and rust bands, the Great Red Spot, lit from the Sun behind
  // you. `night` (0 to 1) turns it to a thin crescent, seen from the far side.
  function drawJupiter(x, y, r, night = 0, alpha = 1) {
    if (r < 1) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, y, r * 0.95, x, y, r * 1.25);
    glow.addColorStop(0, `rgba(255,214,160,${0.3 * (1 - night)})`); glow.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.fillStyle = '#e9d8b4'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    const bands = [[-0.78, 0.1, '#c9a37a'], [-0.55, 0.14, '#b5794a'], [-0.3, 0.08, '#d9b48a'], [-0.12, 0.16, '#f2e6cf'], [0.12, 0.13, '#b97b4b'], [0.32, 0.1, '#e3c9a0'], [0.52, 0.12, '#a86f45'], [0.74, 0.1, '#cfb08a']];
    for (const [b, h, col] of bands) {
      ctx.fillStyle = col;
      for (let i = 0; i < 6; i++) {
        const wob = Math.sin(clock * 0.4 + b * 9 + i) * r * 0.012;
        ctx.fillRect(x - r + (i * r) / 3, y + b * r + wob, r / 3 + 1, h * r);
      }
    }
    // The Great Red Spot, turning slowly across with the planet
    const sx = x + r * (((clock * 0.03 + 0.3) % 1.4) - 0.7) * 1.4;
    ctx.fillStyle = '#c2553a'; ctx.beginPath(); ctx.ellipse(sx, y + r * 0.3, r * 0.17, r * 0.09, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e07a5a'; ctx.beginPath(); ctx.ellipse(sx, y + r * 0.3, r * 0.1, r * 0.05, 0, 0, TAU); ctx.fill();
    // Limb darkening, then the night side
    const ld = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
    ld.addColorStop(0, 'rgba(0,0,0,0)'); ld.addColorStop(1, 'rgba(40,20,10,0.35)');
    ctx.fillStyle = ld; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (night > 0) {
      ctx.fillStyle = `rgba(6,6,14,${0.92 * night})`;
      ctx.beginPath(); ctx.arc(x + r * 0.25 * night, y + r * 0.2 * night, r * 1.02, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // Jupiter's four big moons, found by Galileo in 1610, round a Jupiter at x, y
  function drawGalileans(x, y, r, alpha = 1, skip) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    for (const [name, dist, size, col, sp, ph] of [['IO', 1.5, 0.05, '#e8d27a', 0.5, 0.4], ['EUROPA', 1.9, 0.045, '#eee6d6', 0.3, 2.1], ['GANYMEDE', 2.5, 0.07, '#a39c92', 0.18, 3.9], ['CALLISTO', 3.3, 0.065, '#6e6660', 0.1, 5.2]]) {
      if (skip === name) continue;
      const ang = clock * sp + ph, mx = x + Math.cos(ang) * r * dist, my = y + Math.sin(ang) * r * dist * 0.18;
      if (Math.sin(ang) < 0 && Math.abs(mx - x) < r) continue; // behind Jupiter
      const mr = Math.max(1.5, r * size);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
      if (r > 30) { ctx.fillStyle = 'rgba(238,241,255,0.75)'; ctx.fillText(name, mx, my - mr - 4); }
    }
    ctx.textAlign = 'start'; ctx.restore();
  }
  // The sky out in the belt: black, steady stars, a small Sun, asteroids far
  // off in three layers, and Jupiter, a bright little disc that grows
  function drawBeltSky5() {
    const tf = tierFloat(player.r);
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);
    for (const st of world.sky) {
      let x = (st.x * W - theta * 200) % W; if (x < 0) x += W;
      px(x, st.y * H, st.s, st.s, st.s > 1 ? '#fff3c4' : '#c9d7f0');
    }
    const sx = W * 0.14, sy = H * 0.12, sr = 7;
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, sr * 5);
    sg.addColorStop(0, 'rgba(255,244,220,0.6)'); sg.addColorStop(1, 'rgba(255,244,220,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    const jr = 9 + tf * 1.5, jx = W * 0.62, jy = H * 0.15;
    drawJupiter(jx, jy, jr);
    drawGalileans(jx, jy, jr, 0.8);
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(238,241,255,0.75)';
    ctx.fillText('JUPITER', jx, jy + jr + 12); ctx.textAlign = 'start';
    drawFarRocks(theta * 300, 0);
  }
  function drawFarRocks(dx, dy, alpha = 1) {
    for (const q of world.far || []) {
      let x = (q.x * W - dx * q.depth) % (W + 60); if (x < -30) x += W + 60;
      let y = (q.y * H + dy * q.depth) % (H + 60); if (y < -30) y += H + 60;
      ctx.save(); ctx.translate(x, y); ctx.rotate(q.spin + clock * q.turn);
      ctx.globalAlpha = alpha * (0.35 + q.depth * 0.6);
      ctx.fillStyle = q.depth > 0.4 ? '#4a4450' : '#2e2a34';
      ctx.beginPath(); q.shape.forEach((k, j) => { const ang = (j * TAU) / 9; j ? ctx.lineTo(Math.cos(ang) * q.r * k, Math.sin(ang) * q.r * k) : ctx.moveTo(q.r * k, 0); }); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // The belt world in cross-section. Ceres: a crust of rock, ice and salt over
  // a muddy, salty mantle and a rocky core. Vesta: an iron core, like a little
  // planet. Pallas and Hygiea: mostly rock all through.
  function drawDwarfBody() {
    if (cy - R0 > view.y1 + 60) return;
    const Wd = l5Start;
    const disc = (r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); };
    const layers = Wd === BELT_WORLDS.ceres ? [[1, Wd.dark, Wd.body, 'CRUST'], [0.86, '#4a5560', '#6a7884', 'MUDDY MANTLE'], [0.5, '#5a4a40', '#7a6252', 'ROCKY CORE']]
      : Wd === BELT_WORLDS.vesta ? [[1, Wd.dark, Wd.body, 'CRUST'], [0.88, '#6a5a48', '#8a7660', 'MANTLE'], [0.45, '#c9ced9', '#8a93a4', 'IRON CORE']]
      : [[1, Wd.dark, Wd.body, 'RUBBLY CRUST'], [0.8, '#4e4a50', '#625d66', 'ROCK']];
    for (const [rf, c0, c1] of layers) {
      const g = ctx.createRadialGradient(cx, cy, R0 * rf * 0.6, cx, cy, R0 * rf);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      disc(R0 * rf, g);
    }
    for (const c of world.crust) {
      at(c.a + theta, c.rf * R0, () => {
        if (c.kind === 'ice') { px(-2, -5, 4, 10, '#b9d4e6'); px(-5, -2, 10, 4, '#b9d4e6'); }
        else { px(-5, -3, 10, 6, ['#4a4650', '#5e5a64', '#3a3640'][c.hue]); px(-3, -5, 6, 2, '#7a7680'); }
      }, 30);
    }
    ctx.strokeStyle = Wd.body; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 4, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 1, 0, TAU); ctx.stroke();
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    layers.forEach(([rf, , , name], i) => {
      const f = i === layers.length - 1 ? rf * 0.4 : (rf + (layers[i + 1] ? layers[i + 1][0] : 0)) / 2;
      const x = cx - Math.sin(0.3) * f * R0, y = cy - Math.cos(0.3) * f * R0 + 3;
      if (y > H + 10) return;
      ctx.fillStyle = 'rgba(10,10,20,0.6)'; ctx.fillText(name, x + 1, y + 1);
      ctx.fillStyle = '#eef1ff'; ctx.fillText(name, x, y);
    });
    ctx.textAlign = 'start';
  }
  function drawDwarfDecor() {
    for (const d of world.decor) {
      at(d.a + theta, R0 - 3, () => {
        if (d.kind === 'crater5') {
          ctx.scale(d.size, d.size);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 1, 16, 4, 0, 0, TAU); ctx.fill();
          px(-17, -2, 4, 3, l5Start.body); px(13, -2, 4, 3, l5Start.body);
        } else if (d.kind === 'salt') {
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 40, 7, 0, 0, TAU); ctx.fill();
          const g = ctx.createRadialGradient(0, -4, 2, 0, -4, 30);
          g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -4, 30, 0, TAU); ctx.fill();
          px(-6, -3, 12, 4, '#ffffff'); px(14, -2, 6, 3, '#f4f8ff');
        } else if (d.kind === 'icemount') {
          const h = d.peak ? 110 : 70, w = d.peak ? 120 : 60;
          ctx.fillStyle = l5Start.dark;
          ctx.beginPath(); ctx.moveTo(-w, 2); ctx.lineTo(-w * 0.3, -h); ctx.lineTo(w * 0.3, -h); ctx.lineTo(w, 2); ctx.fill();
          if (!d.peak) { ctx.fillStyle = '#e6f0f8'; for (let i = 0; i < 6; i++) px(-w * 0.3 + i * (w * 0.1), -h + (i % 2) * 8, w * 0.1, 30 + (i % 3) * 14, '#e6f0f8'); }
          ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#eef1ff';
          ctx.fillText(d.peak ? 'RHEASILVIA PEAK' : 'AHUNA MONS', 0, -h - 8); ctx.textAlign = 'start';
        } else if (d.kind === 'dawn') {
          const y = -150 + Math.sin(clock * 0.5) * 6;
          px(-8, y - 6, 16, 12, '#d9a63a'); px(-44, y - 3, 34, 6, PANEL); px(10, y - 3, 34, 6, PANEL);
          ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(238,241,255,0.8)'; ctx.fillText('DAWN', 0, y - 12); ctx.textAlign = 'start';
        } else if (d.kind === 'camp') {
          px(-30, -18, 26, 18, '#d6dce8'); px(-30, -18, 26, 3, '#9aa3b5'); px(-24, -12, 5, 5, '#ffd23f');
          ctx.fillStyle = 'rgba(191,232,255,0.5)'; ctx.beginPath(); ctx.arc(12, 0, 16, Math.PI, TAU); ctx.fill();
          px(2, -40, 2, 22, '#c9ced9'); px(4, -40, 10, 6, '#ffab3d');
        } else if (d.kind === 'drill') {
          px(-4, -54, 8, 54, '#9aa3b5'); px(-14, -58, 28, 6, '#ffab3d'); px(-1, -4, 2, 8, '#3b3b4f');
          if (Math.sin(clock * 12) > 0) px(-3, 0, 6, 3, '#ffd23f');
        } else if (d.kind === 'sign') {
          px(-1, -36, 3, 36, '#9aa3b5');
          px(-40, -50, 80, 16, '#1b1530'); px(-38, -48, 76, 12, '#3b3b4f');
          ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = d.col; ctx.fillText(d.text, 0, -39); ctx.textAlign = 'start';
        }
      }, 200);
    }
  }
  function drawGeomAt(x, y) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, 16);
    g.addColorStop(0, 'rgba(109,255,122,0.5)'); g.addColorStop(1, 'rgba(109,255,122,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(clock * 2);
    ctx.strokeStyle = '#6dff7a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  // The run, drawn straight onto the screen: stars streaming past, the Sun
  // falling behind, the bands coming at you, and Jupiter growing ahead
  function drawRun() {
    const R = fx.run, f = runF(), lane = runLane();
    const py = runPY();
    ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    if (R.phase === 'ocean') { drawOcean(R); ctx.restore(); return; }
    if (R.phase === 'europa') { drawEuropaArrival(R); ctx.restore(); return; }
    const inJ = R.phase === 'run' && R.d >= RUN_LEN;
    const sp = R.phase === 'run' ? R.v : 400;
    const scroll = R.phase === 'run' ? R.d : RUN_LEN + DIVE_LEN + R.pt * 400;
    if (inJ) drawJupiterInside(R);
    else {
      for (const st of world.sky) {
        const vis = R.vis || sp, y = (st.y * H + (R.vd || scroll) * (0.15 + st.s * 0.18)) % H;
        px(st.x * W, y, st.s, st.s * (1 + vis / 160), st.s > 1 ? '#fff3c4' : '#c9d7f0');
      }
      if (R.phase === 'run') {
        const sg = ctx.createRadialGradient(W / 2, H * 1.15, 4, W / 2, H * 1.15, H * 0.5);
        sg.addColorStop(0, `rgba(255,236,190,${0.35 * (1 - f)})`); sg.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, H * 0.6, W, H * 0.4);
        drawFarRocks(0, (R.vd || scroll) * 0.3, clamp(1 - (f - 0.25) * 3, 0, 1));
        // Jupiter grows the whole way; at the end it fills everything as you hit it
        const m = Math.min(W, H);
        // It starts just where it was in the belt's sky, and glides to the middle
        const jk = smooth(clamp(f / 0.12, 0, 1)), jx = lerp(W * 0.62, W / 2, jk), jy = lerp(H * 0.15, H * 0.2, jk);
        const jr = f < 0.92 ? lerp(R.j0 || 10, 0.36 * m, Math.pow(f / 0.92, 2.2)) : 0.36 * m * Math.exp((f - 0.92) * 40);
        // Jupiter's pull: faint rings sliding in towards it, stronger the closer you are
        if (f > 0.1 && f < 0.97) {
          ctx.lineWidth = 2;
          for (let i = 0; i < 6; i++) {
            const k = (clock * (0.25 + f * 0.6) + i / 6) % 1, rr = jr * (1.15 + (1 - k) * 5);
            ctx.strokeStyle = `rgba(255,220,170,${0.18 * k * Math.min(1, f * 2)})`;
            ctx.beginPath(); ctx.ellipse(jx, jy, rr, rr * 0.6, 0, 0, TAU); ctx.stroke();
          }
        }
        // Warp streaks pouring out of Jupiter as you fall towards it
        if (f > 0.35) {
          ctx.strokeStyle = `rgba(255,235,200,${Math.min(0.28, (f - 0.35) * 0.6)})`; ctx.lineWidth = 2;
          for (let i = 0; i < 46; i++) {
            const a = i * 2.39996, k = ((clock * (0.6 + f * 1.6) + i * 0.137) % 1), r0 = jr + k * k * W, r1 = r0 + 20 + k * (R.vis || sp) * 0.08;
            ctx.beginPath(); ctx.moveTo(jx + Math.cos(a) * r0, jy + Math.sin(a) * r0 * 0.8); ctx.lineTo(jx + Math.cos(a) * r1, jy + Math.sin(a) * r1 * 0.8); ctx.stroke();
          }
        }
        drawJupiter(jx, jy, jr);
        if (f < 0.95) drawGalileans(jx, jy, jr, Math.max(0.8 * (1 - f / 0.25), clamp((f - 0.6) * 4, 0, 1)));
        if (f < 0.12) { ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(238,241,255,${0.75 * (1 - f / 0.12)})`; ctx.fillText('JUPITER', jx, jy + jr + 12); ctx.textAlign = 'start'; }
      } else {
        // Out the far side, the way you went in but backwards: Jupiter huge
        // behind you and shrinking, streaks pouring back down into it, the
        // big moons wheeling round, and Europa growing ahead
        const k = clamp(R.pt / EXIT_T, 0, 1);
        drawExitSpace(R, k);
        if (R.pt < 0.6) {
          // Bursting out through the cloud tops
          ctx.fillStyle = `rgba(244,234,210,${1 - R.pt / 0.6})`; ctx.fillRect(0, 0, W, H);
          for (let i = 0; i < 12; i++) { const y = H - ((i * 83 + R.pt * 1400) % (H + 200)); ctx.fillStyle = `rgba(255,250,235,${0.5 * (1 - R.pt / 0.6)})`; ctx.fillRect(0, y, W, 20 + (i % 3) * 12); }
        }
        const er = lerp(4, Math.min(W, H) * 0.12, k * k);
        drawEuropaGlobe(W / 2, H * 0.16, er);
        ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#eef1ff'; ctx.fillText('EUROPA', W / 2, H * 0.16 - er - 8); ctx.textAlign = 'start';
      }
    }
    if (R.phase === 'run') {
      // Speed lines down the sides
      ctx.fillStyle = inJ ? 'rgba(255,240,210,0.3)' : `rgba(220,235,255,${0.12 + f * 0.25})`;
      const vis = R.vis || sp, nLines = Math.round(14 + vis / 120);
      for (let i = 0; i < nLines; i++) {
        const x = ((i * 0.618) % 1) * W, y = (i * 211 + (R.vd || scroll) * 1.2) % (H + 300) - 150;
        if (Math.abs(x - W / 2) < lane + 20 && i % 4) continue; // keep your path clear to see
        ctx.fillRect(x, y, 2, 30 + vis * 0.09);
      }
      for (const m of world.moons || []) {
        const my = py - (m.d - R.d);
        if (my > H + m.r + 40 || my < -m.r - 40) continue;
        drawRunMoon(m, W / 2 + m.side * (lane + m.r * 0.55), my);
      }
      for (const b of world.run) {
        const y = py - (b.d - R.d);
        // Coming up: a red arrow at the top edge where each one will appear
        if (y < -10 && y > -460) for (const o of b.rocks) { const x = W / 2 + bandU(b, o) * lane, a = 0.4 + 0.5 * (1 + y / 460); ctx.fillStyle = `rgba(255,90,74,${a})`; ctx.beginPath(); ctx.moveTo(x - 9, 4); ctx.lineTo(x + 9, 4); ctx.lineTo(x, 16); ctx.fill(); }
        if (y > H + 60 || y < -60) continue;
        for (const o of b.rocks) drawRunThing(b.kind, o, W / 2 + bandU(b, o) * lane, y);
      }
      for (const g of world.stars) {
        if (!g.run || g.taken) continue;
        const y = py - (g.d - R.d);
        if (y > H + 30 || y < -30) continue;
        drawGeomAt(W / 2 + g.u * lane, y);
      }
      if (R.bolt) {
        const x = W / 2 + R.bolt.u * lane;
        if (R.bolt.t < 0.9) { if (Math.sin(clock * 40) > 0) for (let y = 0; y < H; y += 24) px(x - 1, y, 3, 12, 'rgba(180,220,255,0.7)'); }
        else {
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, 0);
          for (let y = 30; y < H; y += 30) ctx.lineTo(x + (Math.random() - 0.5) * 30, y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(109,211,255,0.12)';
      ctx.fillRect(W / 2 - lane - 22, 0, 2, H); ctx.fillRect(W / 2 + lane + 20, 0, 2, H);
    }
    for (const q of R.trail) { ctx.globalAlpha = 1 - q.t / q.life; px(q.x - 2, q.y - 2, 4, 4, q.c); }
    ctx.globalAlpha = 1;
    if (R.phase === 'run' || R.phase === 'exit') {
      const bx = W / 2 + R.x, tilt0 = clamp(R.vx / 2000, -0.3, 0.3);
      if (R.hitT <= 0 || Math.sin(clock * 30) > 0) drawSprite('jump', bx, py, player.facing < 0, 1, 1, 1, (R.heat || 0) > 0.55 ? HOT : SUIT, tilt0);
      if (conspiracy) drawFoilHat(bx, py, tilt0);
      if (R.heat > 0 && R.phase === 'run') {
        // The fireball: flames streaming back off you, the same as falling to Earth
        const hk = R.heat;
        const g = ctx.createRadialGradient(bx, py - 24, 6, bx, py - 24, 70 + hk * 40);
        g.addColorStop(0, `rgba(255,240,170,${0.55 * hk})`); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, py - 24, 110, 0, TAU); ctx.fill();
        for (let i = 0; i < 26; i++) {
          const k = ((clock * 3 + i * 0.173) % 1), x = bx + Math.sin(i * 7.3 + clock * 9) * (10 + k * 26), y = py - 30 + k * (120 + hk * 140);
          ctx.fillStyle = i % 3 ? `rgba(255,${140 + (i % 4) * 25},40,${(1 - k) * hk})` : `rgba(255,250,210,${(1 - k) * hk})`;
          ctx.beginPath(); ctx.arc(x, y, (14 - k * 10) * (0.6 + hk * 0.6), 0, TAU); ctx.fill();
        }
      }
      if (R.inJ && R.phase === 'run') drawForceField(bx, py - 24, R.field);
    }
    if (R.flashT > 0) { ctx.fillStyle = `rgba(220,235,255,${R.flashT * 3})`; ctx.fillRect(0, 0, W, H); }
    drawRunPops(W / 2 + R.x, py);
    ctx.restore();
  }
  function drawRunPops(x, y) {
    ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    for (const q of fx.pops) {
      const k = q.t / 1.1, yy = y - 60 - (q.R - player.r) * 0.4 - k * 40;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#1b1530'; ctx.fillText(q.text, x + 1, yy + 1);
      ctx.fillStyle = q.color; ctx.fillText(q.text, x, yy);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'start';
  }
  function drawForceField(x, y, field) {
    const a = 0.25 + (field / 100) * 0.5, r = 42 + Math.sin(clock * 8) * 2;
    ctx.fillStyle = `rgba(143,208,255,${a * 0.3})`; ctx.strokeStyle = `rgba(190,230,255,${a + 0.2})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 6; i++) { const ang = clock * 3 + i; px(x + Math.cos(ang) * r - 2, y + Math.sin(ang) * r - 2, 4, 4, '#ffffff'); }
    // The field's strength, as a little bar under you
    px(x - 30, y + 54, 60, 6, 'rgba(11,15,38,0.7)'); px(x - 29, y + 55, Math.round(58 * field / 100), 4, field > 40 ? '#8fd0ff' : '#ff8a3a');
  }
  // Inside Jupiter: cloud layers rushing past, then deep orange, then the dark,
  // electric metallic hydrogen at the middle, and back out the far side
  function drawJupiterInside(R) {
    const py = runPY(), li = jupLayer(R.d), L = JUP_LAYERS[li], depth = jupDepth(R.d);
    const fillLayer = (Lr, y0, y1) => { if (y1 <= y0) return; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, Lr.c[0]); g.addColorStop(1, Lr.c[1]); ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0); };
    fillLayer(L, 0, H);
    jupLayerFx(li, R, 0, H);
    // The edges of the layers, coming at you with their names on
    for (const [bd, after, before] of JUP_BOUNDS) {
      const y = py - (bd - R.d);
      if (y < -140 || y > H + 140) continue;
      const ahead = bd > R.d, other = JUP_LAYERS[before];
      const edge = (x) => y + Math.sin(x * 0.02 + bd) * 10 + Math.sin(x * 0.051 + bd * 2) * 5;
      ctx.save(); ctx.beginPath();
      if (ahead) { ctx.moveTo(0, 0); ctx.lineTo(W, 0); for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, edge(x)); }
      else { ctx.moveTo(0, H); ctx.lineTo(W, H); for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, edge(x)); }
      ctx.closePath(); ctx.clip();
      fillLayer(ahead ? JUP_LAYERS[after] : other, 0, H);
      jupLayerFx(ahead ? after : before, R, 0, H);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,250,235,0.85)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = 0; x <= W; x += 20) x ? ctx.lineTo(x, edge(x)) : ctx.moveTo(x, edge(x));
      ctx.stroke();
      if (ahead) {
        const Ln = JUP_LAYERS[after];
        ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(10,8,20,0.75)'; ctx.fillText(Ln.name, W / 2 + 1, y - 13);
        ctx.fillStyle = '#ffffff'; ctx.fillText(Ln.name, W / 2, y - 14);
        ctx.font = '7px "Press Start 2P", monospace'; ctx.fillStyle = 'rgba(255,245,220,0.9)'; ctx.fillText(Ln.sub, W / 2, y - 30);
        ctx.textAlign = 'start';
      }
    }
    // The deeper you go, the more it glows
    if (depth > 0.5) { const g = ctx.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.3, Math.max(W, H)); g.addColorStop(0, `rgba(255,220,160,${(depth - 0.5) * 0.4})`); g.addColorStop(1, 'rgba(255,160,80,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }
  // What each layer looks like as you fall through it
  function jupLayerFx(li, R, y0, y1) {
    const sc = R.d;
    if (li <= 1) {
      // Cloud bands and wisps streaming past (white ammonia, brown below)
      for (let i = 0; i < 9; i++) {
        const y = ((i * 97 + sc * 0.9) % (H + 120)) - 60, h = 18 + (i % 4) * 10;
        ctx.fillStyle = li === 0 ? 'rgba(255,252,240,0.45)' : 'rgba(120,70,36,0.35)'; ctx.fillRect(0, y, W, h);
        ctx.fillStyle = li === 0 ? 'rgba(200,150,100,0.25)' : 'rgba(240,200,150,0.25)'; ctx.fillRect(0, y + h, W, 6);
      }
      if (li === 0) for (let i = 0; i < 40; i++) px((i * 137) % W, (i * 61 + sc * 1.2) % H, 2, 2, 'rgba(255,255,255,0.8)');
    } else if (li === 2) {
      // Water cloud: rain streaks, and the cloud lighting up now and then
      ctx.fillStyle = 'rgba(200,220,255,0.45)';
      for (let i = 0; i < 60; i++) ctx.fillRect((i * 151) % W, (i * 89 + sc * 1.6) % H, 1.5, 14);
      if (Math.sin(clock * 3.1) > 0.97 || Math.sin(clock * 4.7 + 1) > 0.985) { ctx.fillStyle = 'rgba(230,240,255,0.35)'; ctx.fillRect(0, 0, W, H); }
    } else if (li === 3) {
      // Hot haze, thicker and thicker
      for (let i = 0; i < 8; i++) { const y = ((i * 131 + sc * 0.5) % (H + 200)) - 100; ctx.fillStyle = 'rgba(255,170,100,0.12)'; ctx.beginPath(); ctx.ellipse(W * ((i * 0.37) % 1), y, 220, 40, 0, 0, TAU); ctx.fill(); }
    } else if (li === 4) {
      // A sea of liquid hydrogen: bubbles rising, helium drops raining down
      for (let i = 0; i < 30; i++) { ctx.strokeStyle = 'rgba(255,190,150,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc((i * 173) % W, H - ((i * 67 + sc * 0.7) % H), 3 + (i % 4) * 2, 0, TAU); ctx.stroke(); }
      for (let i = 0; i < 30; i++) px((i * 211) % W, (i * 53 + sc * 1.3) % H, 2, 5, 'rgba(220,240,255,0.7)');
    } else if (li === 5) {
      // Metallic hydrogen: electric currents crackling through it
      ctx.strokeStyle = 'rgba(140,180,255,0.7)'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); let x = (i * 223 + clock * 60) % W; ctx.moveTo(x, 0); for (let y = 0; y < H; y += 40) { x += Math.sin(clock * 7 + i + y) * 18; ctx.lineTo(x, y); } ctx.stroke(); }
      for (let i = 0; i < 20; i++) px((i * 97 + clock * 300) % W, (i * 71 + sc) % H, 3, 3, '#cfe0ff');
    } else {
      // The core: white-hot, pulsing
      const g = ctx.createRadialGradient(W / 2, H * 0.35, 10, W / 2, H * 0.35, Math.max(W, H) * 0.7);
      g.addColorStop(0, `rgba(255,255,255,${0.6 + 0.2 * Math.sin(clock * 4)})`); g.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 24; i++) { const a = i * 2.39996, r = ((clock * 200 + i * 50) % Math.max(W, H)); px(W / 2 + Math.cos(a) * r, H * 0.35 + Math.sin(a) * r, 3, 3, 'rgba(255,240,200,0.8)'); }
    }
  }
  // Jupiter's four big moons, and the pull of their gravity rippling in
  const RUN_MOONS = {
    callisto: { body: '#5a4d42', spots: '#a89a88' },
    ganymede: { body: '#8a7d70', spots: '#c9bfae' },
    europa: { body: '#e8dfcf', spots: '#a8603a' },
    io: { body: '#e9c84a', spots: '#b8501a' },
  };
  function drawRunMoon(m, x, y) {
    const C = RUN_MOONS[m.name];
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const k = (clock * 0.7 + i / 4) % 1, rr = m.r * (1.1 + (1 - k) * 2.4);
      ctx.strokeStyle = `rgba(255,214,160,${0.22 * k})`; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = C.body; ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.clip();
    ctx.fillStyle = C.spots;
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39996, d = Math.sqrt((i + 0.5) / 18) * m.r * 0.92, r = m.r * (0.05 + ((i * 37) % 7) * 0.012);
      if (m.name === 'europa') { ctx.strokeStyle = C.spots; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.lineTo(x + Math.cos(a + 1.4) * d, y + Math.sin(a + 1.4) * d); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, TAU); ctx.fill(); }
    }
    if (m.name === 'io') for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.5, t = (clock * 0.8 + i / 3) % 1, vx = x + Math.cos(a) * m.r * 0.5, vy = y + Math.sin(a) * m.r * 0.5; ctx.fillStyle = `rgba(255,200,120,${0.6 * (1 - t)})`; ctx.beginPath(); ctx.arc(vx, vy - t * 30, 4 + t * 14, 0, TAU); ctx.fill(); }
    // Lit from the Sun on one side, in shadow on the other
    const sh = ctx.createLinearGradient(x - m.r, y, x + m.r, y);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = sh; ctx.fillRect(x - m.r, y - m.r, m.r * 2, m.r * 2);
    ctx.restore();
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,240,220,0.85)';
    ctx.fillText(m.name.toUpperCase(), x - m.side * m.r * 0.3, y - m.r - 10); ctx.textAlign = 'start';
  }
  // ---- Level 7: Europa, the comet ride, and Saturn's rings --------------------
  function drawEuropaSky7() {
    const tf = tierFloat(player.r), f = tf / TOP;
    ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, W, H);
    for (const st of world.sky) { let x = (st.x * W - theta * 200) % W; if (x < 0) x += W; px(x, st.y * H, st.s, st.s, st.s > 1 ? '#fff3c4' : '#c9d7f0'); }
    const sx = W * 0.12, sy = H * 0.12;
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, TAU); ctx.fill();
    // Jupiter, huge, never moving in Europa's sky; smaller as you climb away
    const jr = Math.min(W, H) * lerp(0.34, 0.2, f);
    drawJupiter(W * 0.72, H * lerp(0.3, 0.42, f), jr, 0.6);
    ctx.fillStyle = '#e8d27a'; ctx.beginPath(); ctx.arc(W * 0.32, H * 0.22, 4, 0, TAU); ctx.fill();
    // Saturn, a speck far ahead
    drawSaturn(W * 0.36, H * 0.07, 3 + f * 4, 0.9);
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(238,241,255,0.75)';
    ctx.fillText('SATURN', W * 0.36, H * 0.07 + 20); ctx.fillText('IO', W * 0.32, H * 0.22 - 9); ctx.textAlign = 'start';
  }
  // Round Europa in cross-section: ice shell, the ocean, rock, an iron core
  function drawEuropaBody7() {
    if (cy - R0 > view.y1 + 60) return;
    const disc = (r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); };
    const ice = ctx.createRadialGradient(cx, cy, R0 * 0.9, cx, cy, R0);
    ice.addColorStop(0, '#9cc4e4'); ice.addColorStop(1, '#e8f0f6');
    disc(R0, ice);
    const sea = ctx.createRadialGradient(cx, cy, R0 * 0.78, cx, cy, R0 * 0.9);
    sea.addColorStop(0, '#0e2a4e'); sea.addColorStop(1, '#2a6aa8');
    disc(R0 * 0.9, sea);
    const rock = ctx.createRadialGradient(cx, cy, R0 * 0.36, cx, cy, R0 * 0.78);
    rock.addColorStop(0, '#6a4a34'); rock.addColorStop(1, '#8a6a4a');
    disc(R0 * 0.78, rock);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.36);
    core.addColorStop(0, '#ffe8b0'); core.addColorStop(1, '#c08850');
    disc(R0 * 0.36, core);
    for (const c of world.crust) {
      at(c.a + theta, c.rf * R0, () => {
        if (c.kind === 'ice' && c.rf > 0.9) { px(-5, -3, 10, 5, ['#cfe4f4', '#b8d4ea', '#e4f0fa'][c.hue]); }
        else if (c.rf < 0.9) { ctx.strokeStyle = 'rgba(200,235,255,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 2 + c.hue, 0, TAU); ctx.stroke(); }
      }, 30);
    }
    // The surface: pale ice with reddish-brown cracks (lineae)
    ctx.strokeStyle = '#f2ece2'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx, cy, R0 - 6, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,80,50,0.65)'; ctx.lineWidth = 3;
    for (const sw of world.swirls) { const a = sw.a + theta - Math.PI / 2; ctx.beginPath(); ctx.arc(cx, cy, sw.rf * R0, a, a + sw.len); ctx.stroke(); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R0 - 1, 0, TAU); ctx.stroke();
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    for (const [t, rf] of [['ICE SHELL', 0.95], ['OCEAN', 0.84], ['ROCKY MANTLE', 0.6], ['IRON CORE', 0.2]]) {
      const x = cx - Math.sin(0.3) * rf * R0, y = cy - Math.cos(0.3) * rf * R0 + 3;
      if (y > H + 10) continue;
      ctx.fillStyle = 'rgba(10,10,30,0.55)'; ctx.fillText(t, x + 1, y + 1); ctx.fillStyle = '#f4f8ff'; ctx.fillText(t, x, y);
    }
    ctx.textAlign = 'start';
  }
  function drawEuropaDecor7() {
    for (const d of world.decor) {
      at(d.a + theta, R0 - 2, () => {
        if (d.kind === 'chaos') {
          ctx.scale(d.size, d.size);
          for (const [x, y, w, h] of [[-26, -10, 18, 10], [-6, -14, 22, 14], [18, -8, 14, 8]]) { px(x, y, w, h, '#dfe8f0'); px(x, y, w, 2, '#ffffff'); px(x + w - 3, y, 3, h, '#a9c0d4'); }
        } else if (d.kind === 'spikes') {
          ctx.scale(d.size, d.size); ctx.fillStyle = '#e8f2fa';
          for (let i = -3; i <= 3; i++) { const h = 14 + ((i * 37) & 7) * 2; ctx.beginPath(); ctx.moveTo(i * 7 - 3, 0); ctx.lineTo(i * 7, -h); ctx.lineTo(i * 7 + 3, 0); ctx.fill(); }
        } else if (d.kind === 'plume') {
          for (let i = 0; i < 14; i++) { const t = ((clock * 0.5 + i / 14) % 1); ctx.fillStyle = `rgba(230,242,255,${0.5 * (1 - t)})`; ctx.beginPath(); ctx.arc(Math.sin(i * 2.1) * 12 * t, -t * 220, 4 + t * 18, 0, TAU); ctx.fill(); }
          px(-8, -4, 16, 4, '#9cc4e4');
        } else if (d.kind === 'lander') {
          px(-14, -18, 28, 14, '#d8dde6'); px(-14, -18, 28, 3, '#ffffff');
          for (const x of [-16, 12]) { px(x, -6, 3, 6, '#9aa3b5'); }
          px(-2, -30, 3, 12, '#9aa3b5'); px(-8, -34, 16, 4, '#3f6fd8');
          px(8, -4, 3, 10, '#7a7f88'); px(6, 4, 7, 3, '#5a5f68');
        } else if (d.kind === 'sign') {
          px(-1, -40, 3, 40, '#c9ced9'); px(-30, -54, 60, 15, '#1b1530'); px(-30, -54, 60, 2, d.col);
          ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = d.col; ctx.fillText(d.text, 0, -43); ctx.textAlign = 'start';
        }
      }, 240);
    }
  }
  // Saturn with its rings (tilted), the back half of the rings behind it
  function drawSaturn(x, y, r, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
    const rings = (from, to) => {
      for (const [k, w, col] of [[1.32, 0.1, 'rgba(180,160,130,0.5)'], [1.55, 0.3, 'rgba(236,220,186,0.95)'], [1.88, 0.05, 'rgba(10,10,20,0.6)'], [2.05, 0.22, 'rgba(214,198,166,0.9)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, r * w); ctx.beginPath(); ctx.ellipse(0, 0, r * k, r * k * 0.2, 0, from, to); ctx.stroke();
      }
    };
    rings(Math.PI, TAU);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#f0dca8'); g.addColorStop(0.5, '#d8b878'); g.addColorStop(1, '#b8945a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    if (r > 8) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip(); for (let i = -3; i <= 3; i++) { ctx.fillStyle = i % 2 ? 'rgba(170,130,80,0.35)' : 'rgba(255,240,210,0.3)'; ctx.fillRect(-r, i * r * 0.25, r * 2, r * 0.1); } ctx.restore(); }
    rings(0, Math.PI);
    ctx.restore();
  }
  // Saturn up close, the classic view: banded gold planet, the rings tilted
  // round it (C, B, the Cassini Division, A, the Encke Gap, F) and the
  // rings' shadow across the planet
  function drawSaturnBig(x, y, r) {
    const T = 0, E = 0.2; // level, seen from just above the ring plane
    ctx.save(); ctx.translate(x, y); ctx.rotate(T);
    const RINGS = [[1.24, 1.52, 'rgba(150,135,115,0.45)'], [1.52, 1.95, 'rgba(238,224,192,0.95)'], [1.95, 2.02, 'rgba(10,10,20,0.35)'], [2.02, 2.27, 'rgba(214,198,166,0.92)'], [2.19, 2.2, 'rgba(10,10,20,0.6)'], [2.32, 2.34, 'rgba(240,230,210,0.8)']];
    const ringHalf = (back) => {
      for (const [a, b, col] of RINGS) {
        ctx.fillStyle = col; ctx.beginPath();
        if (back) { ctx.ellipse(0, 0, r * b, r * b * E, 0, Math.PI, TAU); ctx.ellipse(0, 0, r * a, r * a * E, 0, TAU, Math.PI, true); }
        else { ctx.ellipse(0, 0, r * b, r * b * E, 0, 0, Math.PI); ctx.ellipse(0, 0, r * a, r * a * E, 0, Math.PI, 0, true); }
        ctx.fill();
        // fine ringlets
        if (r > 60) { ctx.strokeStyle = 'rgba(255,250,235,0.15)'; ctx.lineWidth = 1; for (let k = a + 0.05; k < b; k += 0.07) { ctx.beginPath(); ctx.ellipse(0, 0, r * k, r * k * E, 0, back ? Math.PI : 0, back ? TAU : Math.PI); ctx.stroke(); } }
      }
    };
    ringHalf(true);
    // The planet, lit from the left
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#e9d6a2'); g.addColorStop(0.45, '#e2c488'); g.addColorStop(0.7, '#cfa868'); g.addColorStop(1, '#a8844a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    for (let i = -8; i <= 8; i++) { ctx.fillStyle = i % 2 ? 'rgba(170,130,80,0.22)' : 'rgba(255,245,215,0.18)'; ctx.fillRect(-r, i * r * 0.11, r * 2, r * 0.05); }
    // The pale blue-grey north, and the hexagon storm at the pole
    ctx.fillStyle = 'rgba(150,175,190,0.35)'; ctx.fillRect(-r, -r, r * 2, r * 0.35);
    // The rings' shadow on the planet
    ctx.fillStyle = 'rgba(40,30,20,0.35)'; ctx.beginPath(); ctx.ellipse(0, r * 0.06, r * 1.9, r * 0.08, 0, 0, Math.PI); ctx.ellipse(0, r * 0.06, r * 1.9, r * 0.03, 0, Math.PI, 0, true); ctx.fill();
    const sh = ctx.createLinearGradient(-r, 0, r, 0); sh.addColorStop(0, 'rgba(0,0,10,0)'); sh.addColorStop(0.55, 'rgba(0,0,10,0)'); sh.addColorStop(1, 'rgba(0,0,10,0.55)');
    ctx.fillStyle = sh; ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ringHalf(false);
    ctx.restore();
    if (r > 30) { ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,245,220,0.75)'; ctx.fillText('SATURN', x, y - r * 1.25); ctx.textAlign = 'start'; }
  }
  // The ring sheet: for each ring, the region between its inner and outer
  // edges, from where they run round Saturn's far side (the ellipse) to where
  // they cross the band you hop along (x from x0 to x1)
  const SHEET = [
    [-300, 2000, 1.24, 1.52, [150, 135, 115], 0.45], [2000, 4300, 1.52, 1.95, [238, 224, 192], 0.85],
    [4820, 5900, 2.02, 2.19, [214, 198, 166], 0.8], [6160, 6800, 2.2, 2.27, [214, 198, 166], 0.8], [6980, 7700, 2.32, 2.34, [240, 230, 210], 0.75],
  ];
  function drawRingSheet(SX, plane, sx, sy, sr) {
    const E = 0.2, arc = 0.55, n = 10;
    const ell = (rho, phi) => [sx + Math.cos(phi) * rho * sr, sy + Math.sin(phi) * rho * sr * E];
    for (const [x0, x1, r0, r1, c, a] of SHEET) {
      if (c[0] < 50) continue; // the gaps: just empty, the stars showing through
      const f0 = [SX(x0), plane], f1 = [SX(x1), plane];
      if (Math.max(f0[0], f1[0]) < -400 && Math.max(ell(r0, 0)[0], ell(r1, 0)[0]) < -40) continue;
      // From the far side round the back (top), out to the right-hand tip,
      // round the near side a little, then sweeping down to the band
      const g = ctx.createLinearGradient(0, sy, 0, plane);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.7})`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const [x, y] = ell(r1, -0.15 + (i / n) * (arc + 0.15)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      const e1 = ell(r1, arc), e0 = ell(r0, arc);
      ctx.bezierCurveTo(e1[0] + (f1[0] - e1[0]) * 0.2, lerp(e1[1], plane, 0.7), f1[0], lerp(e1[1], plane, 0.9), f1[0], f1[1]);
      ctx.lineTo(f0[0], f0[1]);
      ctx.bezierCurveTo(f0[0], lerp(e0[1], plane, 0.9), e0[0] + (f0[0] - e0[0]) * 0.2, lerp(e0[1], plane, 0.7), e0[0], e0[1]);
      for (let i = n; i >= 0; i--) { const [x, y] = ell(r0, -0.15 + (i / n) * (arc + 0.15)); ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill();
    }
    // Ringlets running along the sheet, so it reads as rings, not a blob
    ctx.strokeStyle = 'rgba(255,250,235,0.12)'; ctx.lineWidth = 1;
    for (const [x0, x1, r0, r1] of SHEET.slice(0, 7)) for (let q = 0.25; q < 1; q += 0.25) {
      const rr = lerp(r0, r1, q), fx0 = SX(lerp(x0, x1, q)), e = ell(rr, arc);
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const [x, y] = ell(rr, -0.15 + (i / n) * (arc + 0.15)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.bezierCurveTo(e[0] + (fx0 - e[0]) * 0.2, lerp(e[1], plane, 0.7), fx0, lerp(e[1], plane, 0.9), fx0, plane); ctx.stroke();
    }
  }
  // ---- Level 7: the slingshot round Jupiter, then across Saturn's rings --------
  // The things every frame needs while the world itself is paused
  function tickCommon(dt) {
    if (state === 'play') playTime += dt;
    for (const q of fx.pops) q.t += dt;
    fx.pops = fx.pops.filter((q) => q.t < 1.1);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 2.6) fx.banner = null; }
    shake = Math.max(0, shake - dt * 30);
    fx.flash = Math.max(0, fx.flash - dt * 1.5);
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0.4) hud.toast.style.opacity = '0'; if (toastTimer <= 0) hud.toast.hidden = true; }
  }
  // Timings for the slingshot: fade in, close in on Jupiter, swing round it,
  // fly off, years of cruising, then down onto Saturn's rings
  const SL_FADE = 0.7, SL_APP = 1.6, SL_SWING = 4.6, SL_LEAVE = 6.2, SL_ARR = 8.2, SL_END = 10.6;
  const SL_A0 = 0.15 * Math.PI, SL_A1 = 1.8 * Math.PI;
  function startSling(p) {
    player.vr = 900; player.onGround = false; player.heat = 0; fx.flames = [];
    const geoms = [];
    for (let i = 0; i < 9; i++) geoms.push({ u: 0.08 + (i / 9) * 0.86, off: (Math.random() - 0.5) * 110, taken: false });
    fx.sling = { t: 0, off: 0, sd: 0, geoms, told: 0 };
    fx.flash = 0.4; addShake(8); sfx.whoosh(); sfx.tier(); buzz([30, 30, 60]);
    addScore(1000);
    banner('HITCHING A RIDE!', 'SLINGSHOT ROUND JUPITER');
    toast(touch ? "You're riding a spacecraft! It's about to swing round Jupiter. Steer with ◀ ▶ to grab the geoms on the way round." : "You're riding a spacecraft! It's about to swing round Jupiter. Steer with ← → to grab the geoms on the way round.", 6);
  }
  // Where Jupiter is on screen during the slingshot
  function slJ(t) {
    const m = Math.min(W, H), P0 = [W * 0.72, H * 0.42, m * 0.2], P1 = [W * 0.45, H * 0.56, m * 0.33], P2 = [W * 0.06, H * 1.05, m * 0.05];
    const L = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    if (t < SL_APP) return L(P0, P1, smooth(t / SL_APP));
    if (t < SL_SWING) return P1;
    return L(P1, P2, smooth(clamp((t - SL_SWING) / (SL_ARR - SL_SWING), 0, 1)));
  }
  const slOrbit = (J, phi, off = 0) => { const r = J[2] * 1.5 + off; return [J[0] + Math.cos(phi) * r, J[1] + Math.sin(phi) * r * 0.9]; };
  const slPhi = (u) => lerp(SL_A0, SL_A1, u * u * (3 - 2 * u));
  // Where you are on screen (riding the spacecraft)
  function slYou(t, S) {
    const A = [W / 2, H * 0.46], C = [W * 0.6, H * 0.42];
    if (t < SL_APP) { const e = smooth(t / SL_APP), B = slOrbit(slJ(SL_APP), SL_A0); return [lerp(A[0], B[0], e), lerp(A[1], B[1], e)]; }
    if (t < SL_SWING) return slOrbit(slJ(t), slPhi((t - SL_APP) / (SL_SWING - SL_APP)), S.off);
    const e = smooth(clamp((t - SL_SWING) / (SL_LEAVE - SL_SWING), 0, 1)), B = slOrbit(slJ(SL_SWING), SL_A1, S.off);
    return [lerp(B[0], C[0], e), lerp(B[1], C[1], e) + Math.sin(clock * 2) * 3];
  }
  function updateSling(dt) {
    const S = fx.sling;
    S.t += dt;
    tickCommon(dt);
    if (S.t < SL_FADE) { player.vr += 2000 * dt; player.r += player.vr * dt; cam.r = player.r; }
    const kdir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dir = kdir !== 0 ? kdir : tilt.on ? tilt.axis : 0;
    S.off = approach(S.off, dir * 70, 260 * dt);
    // How fast it's going: fastest at the closest point to Jupiter
    const u = clamp((S.t - SL_APP) / (SL_SWING - SL_APP), 0, 1);
    S.speed = S.t < SL_APP ? lerp(300, 700, S.t / SL_APP) : S.t < SL_SWING ? 700 + 1600 * Math.sin(Math.PI * u) : S.t < SL_ARR ? lerp(1400, 2600, clamp((S.t - SL_SWING) / 1.5, 0, 1)) : lerp(2600, 200, clamp((S.t - SL_ARR) / (SL_END - SL_ARR), 0, 1));
    S.sd += S.speed * dt;
    if (S.t > SL_APP && S.t < SL_SWING) {
      shake = Math.max(shake, 3 * Math.sin(Math.PI * u));
      const [yx, yy] = slYou(S.t, S), J = slJ(S.t);
      for (const g of S.geoms) {
        if (g.taken) continue;
        const [gx, gy] = slOrbit(J, slPhi(g.u), g.off);
        if (Math.hypot(gx - yx, gy - (yy - 24)) < 34) { g.taken = true; addMult(); addScore(100); sfx.star(mult); }
      }
    }
    const notes = [
      [SL_APP, 'GRAVITY ASSIST', "Swinging close round Jupiter, the spacecraft steals a tiny bit of Jupiter's speed round the Sun and gets flung on faster. Cassini did this in 2000 on its way to Saturn, saving years of travel."],
      [SL_SWING, 'FLUNG ON!', "Off towards Saturn, faster than before. (Jupiter slows down a tiny, tiny bit in exchange: far too little to ever notice.)"],
      [SL_LEAVE, '3½ YEARS LATER...', 'Cassini took three and a half years to get from Jupiter to Saturn. It arrived in 2004 and went round Saturn for 13 years.'],
      [SL_ARR + 0.6, 'SATURN', "Saturn's rings, side on. Jump off the spacecraft and bounce across them, and on from moon to moon, all the way out to Titan!"],
    ];
    while (S.told < notes.length && S.t >= notes[S.told][0]) { const [, a, b] = notes[S.told++]; banner(a, S.told === 3 ? 'THE LONG CRUISE' : S.told === 4 ? 'JUMP ACROSS TO TITAN' : 'ROUND JUPITER'); toast(b, 6); sfx.tier(); }
    if (S.t >= SL_ARR && !S.Z) S.Z = buildRings7();
    if (snd) snd.music.set({ tierF: 9 + TOP + clamp(S.t / SL_END, 0, 1) * 4, speed: 1 + S.speed / 2000, won: false, belt: state === 'play' });
    hud.alt.textContent = fmtKm(S.t < SL_LEAVE ? 700000 : lerp(700000, 650000000, clamp((S.t - SL_LEAVE) / (SL_END - SL_LEAVE), 0, 1)));
    hud.layer.textContent = S.t < SL_SWING ? 'Slingshot round Jupiter' : S.t < SL_ARR ? 'On the way to Saturn' : 'Saturn';
    if (S.t >= SL_END) {
      const Z = S.Z; fx.sling = null; fx.rings7 = Z;
      Z.standT = 0.6; Z.probeT = 0;
    }
  }
  // You, riding the spacecraft (its dish under your feet)
  function drawRide(x, y, tiltA = 0, scale = 0.7) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tiltA); ctx.scale(scale, scale);
    L2_PLATS.probe7({ spin: 0, noLabel: true }, 200, 0);
    ctx.restore();
  }
  function drawSling() {
    const S = fx.sling, t = S.t, J = slJ(t);
    if (t >= SL_ARR) {
      // Arriving: Saturn's rings, side on, coming up to meet you
      const k = clamp((t - SL_ARR) / (SL_END - SL_ARR), 0, 1), z = Math.exp(lerp(Math.log(0.05), 0, smooth(k)));
      const Z = S.Z, ax = W * 0.38, ay = H * 0.66;
      drawRings7(Z, { zoom: z, ax, ay, noPlayer: true, streak: (1 - k) * 2 });
      const C = [W * 0.6, H * 0.42], e = smooth(k), x = lerp(C[0], ax, e), y = lerp(C[1], ay, e);
      drawRide(x, y + 4); drawSprite('stand', x, y, false, 1, 1, 1, SUIT); if (conspiracy) drawFoilHat(x, y, 0);
      return;
    }
    ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, W, H);
    // Stars streaming past, longer the faster you go
    const len = 2 + S.speed * 0.02;
    ctx.fillStyle = '#c9d7f0';
    for (const st of world.sky) {
      const x = (((st.x * W - S.sd * 0.25 * (0.4 + st.s * 0.3)) % W) + W) % W, y = (((st.y * H + S.sd * 0.12 * (0.4 + st.s * 0.3)) % H) + H) % H;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.45); ctx.fillRect(0, 0, len, st.s); ctx.restore();
    }
    if (J[2] > 2 && t < SL_ARR) {
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const kk = (clock * 0.6 + i / 5) % 1, rr = J[2] * (1.1 + kk * 2); ctx.strokeStyle = `rgba(255,214,160,${0.18 * (1 - kk)})`; ctx.beginPath(); ctx.arc(J[0], J[1], rr, 0, TAU); ctx.stroke(); }
      drawJupiter(J[0], J[1], J[2], 0.6);
    }
    // The way round, dotted, and the geoms along it
    if (t < SL_SWING) {
      ctx.fillStyle = 'rgba(191,240,255,0.45)';
      for (let i = 0; i <= 40; i++) { const [x, y] = slOrbit(slJ(Math.max(t, SL_APP)), slPhi(i / 40)); px(x - 1, y - 1, 3, 3, 'rgba(191,240,255,0.45)'); }
      for (const g of S.geoms) if (!g.taken) { const [gx, gy] = slOrbit(slJ(Math.max(t, SL_APP)), slPhi(g.u), g.off); drawGeomAt(gx, gy); }
    }
    // Years going by on the long cruise
    if (t > SL_LEAVE - 0.3) {
      const k = clamp((t - SL_LEAVE) / (SL_ARR - SL_LEAVE), 0, 1), a = Math.min(1, (t - SL_LEAVE + 0.3) / 0.4) * (1 - smooth(clamp((k - 0.8) / 0.2, 0, 1)));
      ctx.globalAlpha = a * 0.5; ctx.font = '28px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#eef1ff';
      ctx.fillText(String(2001 + Math.min(3, Math.floor(k * 4))), W / 2, H * 0.3); ctx.textAlign = 'start'; ctx.globalAlpha = 1;
    }
    const [x, y] = slYou(t, S), tiltA = t > SL_APP && t < SL_SWING ? Math.sin(Math.PI * (t - SL_APP) / (SL_SWING - SL_APP)) * 0.3 : 0;
    drawRide(x, y + 4, tiltA);
    drawSprite('stand', x, y, false, 1, 1, 1, SUIT, tiltA);
    if (conspiracy) drawFoilHat(x, y, tiltA);
    drawRunPops(x, y);
  }

  // ---- Saturn's rings, side on: skate across them, jump the gaps, on to Titan --
  // Laid out left to right from Saturn, x in px. The rings are solid ice to
  // skate on; the gaps between them have to be jumped, and the wider ones need
  // speed. Past the F ring you launch out and hop from moon to moon to Titan.
  const R7_G = 1500, R7_BOUNCE = 860, R7_VX = 440, TITAN_X = 13000;
  const R7_JUMP = 720, R7_TOP = 780, F_END = 7700;
  // The ring surfaces: [from, to, ring]
  const R7_SURF = [[-300, 1500, 0], [1620, 2000, 0], [2000, 4300, 1], [4820, 5900, 3], [6160, 6650, 3], [6730, 6800, 3], [6980, F_END, 6]];
  const R7_GAPS = { 1500: 'the Maxwell Gap', 4300: 'the Cassini Division', 5900: 'the Encke Gap', 6650: 'the Keeler Gap', 6800: 'the gap to the F ring' };
  const R7_ZONES = [
    { x: -300, name: 'THE C RING', sub: 'FAINT, CLOSE TO SATURN', fact: "The C ring, the closest of the main rings to Saturn: fainter, with dustier ice. Skate! Hold right to build up speed, and you'll jump the gaps by yourself (or jump when you like with Space, ↑ or a tap)." },
    { x: 2000, name: 'THE B RING', sub: 'THE BIGGEST AND BRIGHTEST', fact: 'The B ring: the biggest, brightest and most packed ring of all. Chunks of water ice, from specks of dust to boulders as big as a house. Build up speed: the Cassini Division is coming!' },
    { x: 4300, name: 'THE CASSINI DIVISION', sub: 'ABOUT 4,800 KM WIDE', fact: "The Cassini Division: a gap about 4,800 km wide, first spotted by Giovanni Cassini in 1675. It isn't empty, just much thinner." },
    { x: 4820, name: 'THE A RING', sub: 'ICE, FROM DUST TO BOULDERS', fact: 'The A ring. At the end of its mission in 2017, the Cassini spacecraft dived between Saturn and its rings 22 times, then plunged into Saturn.' },
    { x: 5900, name: 'THE ENCKE GAP', sub: 'SWEPT CLEAR BY LITTLE PAN', fact: 'The Encke Gap, kept clear by the little moon Pan, which is shaped like a ravioli.' },
    { x: 6160, name: 'THE A RING', sub: 'ITS OUTER EDGE', fact: 'The Keeler Gap, near the A ring\'s outer edge, is kept clear by a tiny moon, Daphnis, which raises waves in the ring as it goes.' },
    { x: 6800, name: 'THE F RING', sub: 'NARROW AND TWISTED', fact: "The F ring: narrow and twisted into braids, kept in line by two little 'shepherd' moons, Prometheus and Pandora. At its end, launch off towards the moons!" },
    { x: F_END, name: 'THE E RING', sub: "SATURN'S MOONS", fact: "Out past the main rings: the faint E ring, made of ice sprayed out by the moon Enceladus, and Saturn's moons, one after another. Bounce from moon to moon to Titan!" },
  ];
  const R7_MOONS = {
    mimas: { R: 55, body: '#b4b0aa', fact: "Mimas: its giant Herschel crater makes it look a lot like a certain moon-sized space station from the films. That's no moon... oh wait, it is." },
    enceladus: { R: 60, body: '#f6f9ff', fact: 'Enceladus: the shiniest thing in the Solar System. Jets of water spray out of cracks near its south pole, from an ocean under its ice.' },
    telesto: { R: 0, body: '#d8d4cc', fact: 'Telesto and Calypso: two little moons that share Tethys\'s orbit, one ahead of it and one behind.' },
    tethys: { R: 90, body: '#e2e2e6', fact: 'Tethys is made almost entirely of water ice, with a huge canyon, Ithaca Chasma, running most of the way round it.' },
    calypso: { R: 0, body: '#d8d4cc', fact: null },
    helene: { R: 0, body: '#d8d4cc', fact: "Helene and Polydeuces share Dione's orbit, the same way Tethys has its two little companions." },
    dione: { R: 90, body: '#d0d0d6', fact: 'Dione: icy, with long bright cliffs of ice criss-crossing one side.' },
    polydeuces: { R: 0, body: '#d8d4cc', fact: null },
    rhea: { R: 115, body: '#c9c4bc', fact: "Rhea, Saturn's second-biggest moon: a ball of ice and rock about 1,500 km across." },
    titan: { R: 200, body: '#d99a3a', fact: null },
  };
  function buildRings7() {
    const plats = [], geoms = [];
    const chunk = (x, w) => plats.push({ x, w, top: -(8 + Math.random() * 22), kind: 'chunk', zone: 7, ph: Math.random() * TAU, shape: Array.from({ length: 9 }, () => 0.75 + Math.random() * 0.25) });
    const moonlet = (x, name) => plats.push({ x, w: 46, top: -22, kind: 'moonlet', name, ph: Math.random() * TAU });
    const moon = (x, name) => { const R = R7_MOONS[name].R; plats.push({ x, w: R * 1.3, top: -R, kind: 'moon', name, R, ph: 0 }); };
    // Past the F ring: from moon to moon (every hop no more than about 340 px)
    for (const [mx, name] of [[8100, 'mimas'], [8450, null], [8800, 'enceladus'], [9180, 'telesto'], [9600, 'tethys'], [10000, 'calypso'], [10360, 'helene'], [10780, 'dione'], [11180, 'polydeuces'], [11530, null], [11950, 'rhea'], [12360, null], [12730, null], [TITAN_X, 'titan']]) {
      if (!name) chunk(mx, 50);
      else if (R7_MOONS[name].R) moon(mx, name);
      else moonlet(mx, name);
    }
    // Geoms: some low along the ice to skate through, and up high over each
    // gap for a jump to take you through
    for (const [a, b] of R7_SURF) for (let x = a + 300; x < b - 200; x += 420 + Math.random() * 300) geoms.push({ x, y: -30, taken: false });
    for (let i = 0; i < R7_SURF.length - 1; i++) { const g0 = R7_SURF[i][1], g1 = R7_SURF[i + 1][0]; geoms.push({ x: (g0 + g1) / 2, y: -150, taken: false }); }
    for (let i = 0; i < plats.length - 1; i++) if (Math.random() < 0.6) geoms.push({ x: (plats[i].x + plats[i + 1].x) / 2, y: -230, taken: false });
    return { plats, geoms, x: 60, y: 0, vx: 0, vy: 0, ground: true, mode: 'skate', camX: 60 - W * 0.38, camY: 0, zone: -1, seen: {}, cleared: {}, last: null, standT: 0, probeT: 0, done: false, doneT: 0, bits: [], squash: 0, warned: false, skate: 0, wantJump: false, startX: 60 };
  }
  const r7Top = (p) => p.top + (p.kind === 'chunk' ? Math.sin(clock * 1.3 + p.ph) * 3 : 0);
  const r7Surf = (x) => R7_SURF.find(([a, b]) => x >= a && x <= b);
  function updateRings7(dt) {
    const Z = fx.rings7;
    tickCommon(dt);
    Z.probeT += dt; Z.squash = Math.max(0, Z.squash - dt * 4);
    for (const q of Z.bits) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 400 * dt; }
    Z.bits = Z.bits.filter((q) => q.t < q.life);
    const kdir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dir = kdir !== 0 ? kdir : tilt.on ? tilt.axis : 0;
    if (Math.abs(dir) > 0.1) player.facing = Math.sign(dir);
    const jump = (v = R7_JUMP) => { Z.vy = -v; Z.ground = false; Z.squash = -0.6; Z.jumpX = Z.x; sfx.hop(); for (let i = 0; i < 8; i++) Z.bits.push({ x: Z.x, y: 0, vx: -Z.vx * 0.3 + (Math.random() - 0.5) * 120, vy: -Math.random() * 150, t: 0, life: 0.5, c: '#eef4ff' }); };
    if (Z.done) {
      Z.doneT += dt;
      if (Z.doneT > 2 && state === 'play') { lastTier = TOP; bestTier = TOP; win(); }
    } else if (Z.standT > 0) {
      // Just off the spacecraft: a moment to find your feet on the ice
      Z.standT -= dt; Z.y = 0; Z.wantJump = false;
    } else if (Z.mode === 'skate' && Z.ground) {
      // Skating: push off to speed up, ease off to glide, push back to brake
      if (dir > 0.1) Z.vx += 620 * dir * dt; else if (dir < -0.1) Z.vx += 900 * dir * dt; else Z.vx *= 1 - 0.2 * dt;
      Z.vx = clamp(Z.vx, -260, R7_TOP);
      Z.x += Z.vx * dt; Z.skate += Math.abs(Z.vx) * dt;
      if (Math.abs(Z.vx) > 300 && Math.random() < dt * 30) Z.bits.push({ x: Z.x - Math.sign(Z.vx) * 10, y: -2, vx: -Z.vx * 0.25, vy: -Math.random() * 90, t: 0, life: 0.45, c: '#f4f8ff' });
      const sf = r7Surf(Z.x);
      if (!sf) { Z.ground = false; Z.vy = 0; }
      // At the edge of a gap you jump by yourself (or jump whenever you like)
      else if (Z.wantJump || (Z.vx > 40 && sf[1] - Z.x < 8 + Z.vx * 0.03 && sf[1] < F_END + 1)) jump(sf[1] >= F_END ? R7_JUMP * 1.3 : R7_JUMP);
      Z.wantJump = false;
    } else {
      // In the air: over the rings a little steering; out among the moons, plenty
      if (Z.mode === 'skate') Z.vx = clamp(Z.vx + dir * 260 * dt, -300, R7_TOP);
      else Z.vx = approach(Z.vx, dir * R7_VX, 2600 * dt);
      const prevY = Z.y;
      Z.vy += R7_G * dt; Z.x += Z.vx * dt; Z.y += Z.vy * dt;
      Z.wantJump = false;
      if (Z.x > F_END + 40 && Z.mode === 'skate') Z.mode = 'hop';
      // Landing back on the ice
      if (Z.mode === 'skate' && Z.vy > 0 && prevY <= 0 && Z.y >= 0 && r7Surf(Z.x)) {
        Z.y = 0; Z.vy = 0; Z.ground = true; Z.squash = 1; sfx.thud();
        for (let i = 0; i < 10; i++) Z.bits.push({ x: Z.x, y: 0, vx: (Math.random() - 0.5) * 220 + Z.vx * 0.3, vy: -Math.random() * 120, t: 0, life: 0.6, c: '#eef4ff' });
        // Cleared a gap?
        const g = Object.keys(R7_GAPS).map(Number).find((g0) => Z.jumpX <= g0 && Z.x > g0);
        if (g !== undefined && !Z.cleared[g]) { Z.cleared[g] = true; addMult(); addScore(g === 4300 ? 1000 : 300); pop(`CLEARED ${R7_GAPS[g].toUpperCase()}!`, '#6dff7a', player.r + 110); if (g === 4300) { sfx.perfect(); addShake(6); } }
      }
      if (Z.mode === 'hop' && Z.vy > 0) for (const p of Z.plats) {
        if (Math.abs(p.x - Z.x) > p.w / 2 + 8) continue;
        const top = r7Top(p);
        if (prevY <= top && Z.y >= top) {
          Z.y = top; Z.last = p; Z.squash = 1;
          for (let i = 0; i < 10; i++) Z.bits.push({ x: Z.x, y: top, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 120, t: 0, life: 0.6, c: '#eef4ff' });
          if (p.name === 'titan') {
            Z.done = true; Z.vy = 0; Z.vx = 0; addShake(8); sfx.thud(); buzz([40, 30, 80]);
            banner('TITAN!', "SATURN'S BIGGEST MOON");
            toast("You made it to Titan, Saturn's biggest moon: bigger than the planet Mercury, wrapped in thick orange haze.", 6);
            break;
          }
          Z.vy = -R7_BOUNCE; addScore(10); sfx.boing(2, 1.2);
          if (p.name && !Z.seen[p.name]) {
            Z.seen[p.name] = true; addMult(); addScore(300);
            if (p.kind === 'moon') { pop(p.name.toUpperCase() + '!', '#ffd23f', player.r + 120); addShake(5); }
            const f = R7_MOONS[p.name] && R7_MOONS[p.name].fact;
            if (f) toast(f, 6);
          }
          break;
        }
      }
      // Fell through a gap (or off a moon): Saturn's pull would have you
      if (Z.y > 320) {
        falls++; loseMult(); sfx.fall();
        if (Z.mode === 'skate' || !Z.last) {
          const back = [...R7_SURF].reverse().find(([a]) => a < Z.x) || R7_SURF[0];
          const gapName = R7_GAPS[back[1]];
          toast(gapName ? `Not fast enough to clear ${gapName}! Back you go: build up more speed on the run-up.` : 'Back onto the ice!', 4);
          Z.mode = 'skate'; Z.x = Math.max(back[0] + 40, back[1] - 650); Z.y = 0; Z.vy = 0; Z.vx = 200; Z.ground = true;
        } else {
          if (!Z.warned) { Z.warned = true; toast("Missed! Saturn's gravity would pull you down, so back to the last moon you landed on.", 5); }
          Z.x = Z.last.x; Z.y = r7Top(Z.last) - 120; Z.vy = 0; Z.vx = 0;
        }
      }
    }
    for (const g of Z.geoms) if (!g.taken && Math.hypot(g.x - Z.x, g.y - (Z.y - 24)) < 36) { g.taken = true; addMult(); addScore(50); sfx.star(mult); }
    // Into each new zone
    let zi = 0; while (zi < R7_ZONES.length - 1 && R7_ZONES[zi + 1].x <= Z.x) zi++;
    if (zi !== Z.zone) { Z.zone = zi; const Zn = R7_ZONES[zi]; banner(Zn.name, Zn.sub); if (Zn.fact) toast(Zn.fact, 6); sfx.tier(); }
    Z.camX += (Z.x - W * 0.38 - Z.camX) * Math.min(1, dt * 6);
    Z.camY += (Math.min(0, Z.y + 160) - Z.camY) * Math.min(1, dt * 4);
    if (snd) snd.music.set({ tierF: 13 + TOP + clamp(Z.x / TITAN_X, 0, 1) * 4, speed: 1 + Math.abs(Z.vx) / 1000, won: state === 'won', belt: state === 'play' });
    // How far out from Saturn's middle you are
    const marks = [[-300, 74500], [F_END, 140200], [8100, 185500], [8800, 238000], [9600, 294700], [10780, 377400], [11950, 527100], [TITAN_X, 1221900]];
    let km = marks[marks.length - 1][1];
    for (let i = 0; i < marks.length - 1; i++) if (Z.x < marks[i + 1][0]) { km = lerp(marks[i][1], marks[i + 1][1], clamp((Z.x - marks[i][0]) / (marks[i + 1][0] - marks[i][0]), 0, 1)); break; }
    hud.alt.textContent = `${fmtKm(km)} from Saturn`;
    const near = Z.plats.find((p) => p.kind === 'moon' && Math.abs(p.x - Z.x) < p.w);
    hud.layer.textContent = near ? near.name[0].toUpperCase() + near.name.slice(1) : `${R7_ZONES[Math.max(0, Z.zone)].name.replace('THE ', 'The ').replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase())}${Z.mode === 'skate' ? ` · ${Math.round(Math.abs(Z.vx) * 0.05)} km/s` : ''}`;
  }
  const R7_ICE = ['#b8b0a2', '#ece4d2', '#888', '#ddd4c2', '#888', '#ddd4c2', '#f4f0e6', '#e4eef8'];
  function drawRings7(Z = fx.rings7, o = {}) {
    ctx.save();
    ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, W, H);
    const streak = o.streak || 0;
    ctx.fillStyle = '#c9d7f0';
    for (const st of world.sky) { const x = (((st.x * W - Z.camX * 0.05) % W) + W) % W; ctx.fillRect(x, st.y * H, st.s + streak * 20, st.s); }
    if (o.zoom) { ctx.translate(o.ax, o.ay); ctx.scale(o.zoom, o.zoom); ctx.translate(-o.ax, -o.ay); }
    const SX = (wx) => wx - Z.camX, SY = (wy) => H * 0.66 + (wy - Z.camY), plane = SY(0);
    // Saturn, the whole planet and its rings, hanging in the sky behind; it
    // drifts slowly and shrinks as you head out towards Titan. The rings you're
    // on are its own: each one sweeps from its place round Saturn down to the
    // stretch of ring under your feet, as one sheet of ice seen from just above
    {
      const k = clamp(Z.x / TITAN_X, 0, 1), sr = Math.min(W, H) * lerp(0.26, 0.11, k);
      const sx = lerp(W * 0.36, W * 0.16, k) - Z.camX * 0.02, sy = plane - H * lerp(0.36, 0.42, k);
      drawSaturnBig(sx, sy, sr);
      drawRingSheet(SX, plane, sx, sy, sr);
    }
    // The ring surfaces you skate on: the near edge of the ice, with the gaps
    // between them open to the stars; past the F ring, the faint E ring
    ctx.fillStyle = 'rgba(160,200,240,0.1)'; ctx.fillRect(Math.max(-50, SX(F_END + 100)), plane - 30, W * 3, 60);
    for (const [a, b, zone] of R7_SURF) {
      const x0 = SX(a), x1 = SX(b);
      if (x1 < -40 || x0 > W / (o.zoom || 1) + W) continue;
      ctx.fillStyle = R7_ICE[zone]; ctx.fillRect(x0, plane - 4, x1 - x0, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x0, plane - 4, x1 - x0, 3);
      ctx.fillStyle = 'rgba(0,0,10,0.35)'; ctx.fillRect(x0, plane + 8, x1 - x0, 4);
      for (let wx = Math.ceil((Math.max(a, Z.camX - 100)) / 26) * 26; wx < Math.min(b, Z.camX + W / (o.zoom || 1) + 100); wx += 26) px(SX(wx) + hash3(wx, 3, 1) * 20, plane + 1 + hash3(1, wx, 5) * 8, 2 + (hash3(wx, 2, 2) * 4 | 0), 2, 'rgba(255,250,240,0.6)');
      // Rounded ends where the ice stops at a gap
      ctx.fillStyle = R7_ICE[zone]; ctx.beginPath(); ctx.arc(x0, plane + 4, 8, 0, TAU); ctx.arc(x1, plane + 4, 8, 0, TAU); ctx.fill();
    }
    // The gaps' names, under the edge
    ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(200,220,255,0.65)';
    for (let i = 0; i < R7_SURF.length - 1; i++) { const g0 = R7_SURF[i][1], g1 = R7_SURF[i + 1][0], name = R7_GAPS[g0]; if (name) { const x = SX((g0 + g1) / 2); if (x > -100 && x < W + 100) ctx.fillText(name.replace('the ', '').toUpperCase(), x, plane + 30); } }
    // Pan, in the Encke Gap
    { const x = SX(6030), y = plane + 4 + Math.sin(clock) * 4; if (x > -60 && x < W + 60) { ctx.fillStyle = '#c9c0b0'; ctx.beginPath(); ctx.ellipse(x, y, 16, 9, 0, 0, TAU); ctx.fill(); px(x - 19, y - 1, 38, 3, '#e6ddcc'); } }
    ctx.textAlign = 'start';
    // Little moons and the big moons, out past the rings
    for (const p of Z.plats) {
      const x = SX(p.x), y = SY(r7Top(p));
      if (x < -p.w * 2 - 300 || x > W / (o.zoom || 1) + W + 300) continue;
      if (p.kind === 'chunk') {
        const r = p.w / 2;
        ctx.fillStyle = R7_ICE[p.zone] || '#ddd4c2';
        ctx.beginPath(); p.shape.forEach((k, j) => { const ang = (j * TAU) / 9; const xx = x + Math.cos(ang) * r * k, yy = y + 12 + Math.sin(ang) * 14 * k; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,20,40,0.6)'; ctx.lineWidth = 2; ctx.stroke();
        px(x - r * 0.6, y, r * 1.2, 2, '#ffffff');
      } else if (p.kind === 'moonlet') {
        ctx.fillStyle = '#d8d4cc'; ctx.beginPath(); ctx.ellipse(x, y + 16, p.w / 2, 18, 0, 0, TAU); ctx.fill();
        if (p.name) { ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,245,220,0.85)'; ctx.fillText(p.name.toUpperCase(), x, y - 10); ctx.textAlign = 'start'; }
      } else {
        const M = R7_MOONS[p.name], R = p.R, cy0 = SY(0);
        if (p.name === 'titan') { const hz = ctx.createRadialGradient(x, cy0, R * 0.9, x, cy0, R * 1.25); hz.addColorStop(0, 'rgba(240,170,70,0.6)'); hz.addColorStop(1, 'rgba(240,170,70,0)'); ctx.fillStyle = hz; ctx.beginPath(); ctx.arc(x, cy0, R * 1.25, 0, TAU); ctx.fill(); }
        ctx.fillStyle = M.body; ctx.beginPath(); ctx.arc(x, cy0, R, 0, TAU); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(x, cy0, R, 0, TAU); ctx.clip();
        if (p.name === 'mimas') { ctx.fillStyle = '#8e8a84'; ctx.beginPath(); ctx.arc(x - R * 0.3, cy0 - R * 0.15, R * 0.36, 0, TAU); ctx.fill(); px(x - R * 0.32, cy0 - R * 0.18, 4, 4, '#b4b0aa'); }
        else if (p.name === 'enceladus') { ctx.strokeStyle = '#7ab4e0'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - R * 0.5 + i * 6, cy0 + R * 0.6); ctx.lineTo(x + R * 0.4 + i * 6, cy0 + R * 0.75); ctx.stroke(); } }
        else if (p.name === 'tethys') { ctx.strokeStyle = '#a8a8b0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - R, cy0 - R * 0.2); ctx.quadraticCurveTo(x, cy0 + R * 0.3, x + R, cy0 - R * 0.1); ctx.stroke(); }
        else if (p.name === 'dione') { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + R * 0.1 + i * 8, cy0 - R * 0.6); ctx.lineTo(x + R * 0.3 + i * 10, cy0 + R * 0.5); ctx.stroke(); } }
        else if (p.name === 'titan') { for (let i = -3; i <= 3; i++) { ctx.fillStyle = i % 2 ? 'rgba(200,120,40,0.35)' : 'rgba(255,200,120,0.25)'; ctx.fillRect(x - R, cy0 + i * R * 0.25, R * 2, R * 0.1); } }
        else for (let i = 0; i < 10; i++) { const a = i * 2.4, d = Math.sqrt((i + 0.5) / 10) * R * 0.9; ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, cy0 + Math.sin(a) * d, R * 0.08, 0, TAU); ctx.fill(); }
        const sh = ctx.createLinearGradient(x - R, 0, x + R, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.4)'); ctx.fillStyle = sh; ctx.fillRect(x - R, cy0 - R, R * 2, R * 2);
        ctx.restore();
        if (p.name === 'enceladus') for (let i = 0; i < 6; i++) { const t = (clock * 0.7 + i / 6) % 1; ctx.fillStyle = `rgba(230,245,255,${0.6 * (1 - t)})`; ctx.beginPath(); ctx.arc(x + (i - 2.5) * 7, cy0 + R + t * 70, 3 + t * 12, 0, TAU); ctx.fill(); }
        ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,245,220,0.9)'; ctx.fillText(p.name.toUpperCase(), x, cy0 - R - 14); ctx.textAlign = 'start';
      }
    }
    for (const g of Z.geoms) if (!g.taken) drawGeomAt(SX(g.x), SY(g.y));
    // The spacecraft you rode in on, flying off to go into orbit
    if (Z.probeT < 3) { const k = Z.probeT / 3; ctx.globalAlpha = 1 - k; drawRide(SX(Z.startX) + k * 500, plane - k * 260 + 4); ctx.globalAlpha = 1; }
    for (const q of Z.bits) { ctx.globalAlpha = 1 - q.t / q.life; px(SX(q.x) - 2, SY(q.y) - 2, 4, 4, q.c); }
    ctx.globalAlpha = 1;
    if (!o.noPlayer) {
      const x = SX(Z.x), y = SY(Z.y), sq = Z.squash;
      const skating = Z.mode === 'skate' && Z.ground && !Z.done;
      const frame = Z.done || Z.standT > 0 ? 'stand' : skating ? (Math.abs(Z.vx) > 30 ? WALK_CYCLE[Math.floor(Z.skate / 40) % 4] : 'stand') : 'jump';
      const lean = skating ? clamp(Z.vx / 2200, -0.25, 0.3) : clamp(Z.vx / 3000, -0.15, 0.15);
      drawSprite(frame, x, y, player.facing < 0, 1 - sq * 0.2, 1 + sq * 0.15, 1, SUIT, lean);
      if (conspiracy) drawFoilHat(x, y, lean, player.facing < 0);
      if (Z.done) { px(x + 30, y - 40, 3, 40, '#e8e8f0'); px(x + 33, y - 40, 22, 14, '#e0433b'); px(x + 36, y - 36, 6, 6, '#ffd23f'); }
      drawRunPops(x, y + 6);
    }
    ctx.restore();
  }
  function drawRunThing(kind, o, x, y) {
    ctx.save(); ctx.translate(x, y);
    if (kind === 'spark') {
      ctx.translate(6 * Math.sin(clock * 9 + o.ph), 0);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
      g.addColorStop(0, 'rgba(255,200,240,0.9)'); g.addColorStop(1, 'rgba(255,106,213,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = clock * 9 + i * 2.1 + o.ph; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(Math.cos(a + 0.5) * 15, Math.sin(a + 0.5) * 15); ctx.stroke(); }
    } else if (kind === 'frag') {
      ctx.fillStyle = 'rgba(170,225,255,0.25)';
      ctx.beginPath(); ctx.moveTo(-o.r, 0); ctx.lineTo(-10, -40); ctx.lineTo(o.r, 0); ctx.fill();
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, o.r * 2);
      g.addColorStop(0, 'rgba(230,248,255,0.9)'); g.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, o.r * 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#dff2ff'; ctx.beginPath(); ctx.arc(0, 0, o.r * 0.7, 0, TAU); ctx.fill();
    } else if (kind === 'storm') {
      // A knot of storm cloud, swirling, lit from inside now and then
      ctx.rotate(clock * 2 + o.ph);
      ctx.fillStyle = 'rgba(60,30,20,0.85)'; ctx.beginPath(); ctx.arc(0, 0, o.r + 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = Math.sin(clock * 6 + o.ph * 3) > 0.9 ? '#eef4ff' : 'rgba(200,140,90,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, o.r * 0.6, 0, 4.5); ctx.stroke();
    } else {
      // A warm danger glow behind, so it stands out against anything
      const hg = ctx.createRadialGradient(0, 0, o.r * 0.6, 0, 0, o.r * 2);
      hg.addColorStop(0, 'rgba(255,150,90,0.35)'); hg.addColorStop(1, 'rgba(255,120,80,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, o.r * 2, 0, TAU); ctx.fill();
      ctx.rotate(o.spin + clock * o.turn);
      const path = () => { ctx.beginPath(); o.shape.forEach((k, j) => { const ang = (j * TAU) / 9; j ? ctx.lineTo(Math.cos(ang) * o.r * k, Math.sin(ang) * o.r * k) : ctx.moveTo(o.r * k, 0); }); ctx.closePath(); };
      path(); ctx.fillStyle = kind === 'hilda' ? '#b88462' : '#9a92a8'; ctx.fill();
      ctx.strokeStyle = '#0b0b14'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(-o.r * 0.3, -o.r * 0.2, o.r * 0.25, 0, TAU); ctx.fill();
      ctx.rotate(-(o.spin + clock * o.turn));
      ctx.strokeStyle = 'rgba(255,240,210,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, o.r * 0.8, 3.6, 5.6); ctx.stroke();
    }
    if (kind === 'frag' || kind === 'spark' || kind === 'storm') { ctx.strokeStyle = 'rgba(11,11,20,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, (kind === 'storm' ? o.r + 6 : o.r * 0.75 + 2), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  // Europa, as seen from space: pale ice criss-crossed with reddish-brown
  // cracks (lineae), and patches of jumbled "chaos" terrain
  function drawEuropaGlobe(x, y, r) {
    ctx.save();
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, '#fbf8f0'); g.addColorStop(0.7, '#e6dccb'); g.addColorStop(1, '#b9ad98');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(150,80,50,0.7)'; ctx.lineWidth = Math.max(1, r * 0.018);
    for (let i = 0; i < 12; i++) {
      const a = i * 0.9, ox = Math.cos(a) * r * 0.4, oy = Math.sin(a * 1.3) * r * 0.4;
      ctx.beginPath(); ctx.arc(x + ox + r, y + oy - r * 0.5, r * (1 + (i % 3) * 0.3), Math.PI * 0.8, Math.PI * 1.25); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160,100,70,0.35)';
    for (const [cxo, cyo, cr] of [[-0.3, 0.2, 0.18], [0.35, -0.25, 0.12], [0.1, 0.5, 0.1]]) { ctx.beginPath(); ctx.arc(x + cxo * r, y + cyo * r, cr * r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(10,10,30,0.35)'; ctx.beginPath(); ctx.arc(x + r * 0.45, y + r * 0.4, r * 1.05, 0, TAU); ctx.arc(x - r * 0.15, y - r * 0.15, r * 1.05, 0, TAU, true); ctx.fill('evenodd');
    ctx.restore();
  }
  // Space behind you on the way out of Jupiter: stars streaming down past
  // you, Jupiter huge at the bottom and shrinking (k: 0 just out, 1 well away)
  function drawExitSpace(R, k) {
    const vis = R.vis || 400;
    for (const st of world.sky) { const y = (st.y * H + (R.vd || 0) * (0.15 + st.s * 0.18)) % H; px(st.x * W, y, st.s, st.s * (1 + vis / 220), st.s > 1 ? '#fff3c4' : '#c9d7f0'); }
    // One Jupiter all the way: it falls away behind you, and ends up just
    // where, once the view has turned over, it hangs in Europa's sky
    const e = smooth(k), J = euJupiter();
    const jr = Math.exp(lerp(Math.log(Math.max(W, H) * 1.1), Math.log(J.r), e));
    const jx = lerp(W / 2, W - J.x, e), jy = lerp(H + Math.max(W, H) * 0.16, 2 * (H * 0.45 - 24) - J.y, e);
    // Streaks pouring back down into it behind you
    ctx.strokeStyle = `rgba(255,235,200,${0.25 * (1 - k)})`; ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const a = i * 2.39996, kk = ((clock * 1.2 + i * 0.137) % 1), r1 = jr + (1 - kk) * (1 - kk) * W, r0 = r1 + 20 + (1 - k) * 60;
      ctx.beginPath(); ctx.moveTo(jx + Math.cos(a) * r0, jy + Math.sin(a) * r0); ctx.lineTo(jx + Math.cos(a) * r1, jy + Math.sin(a) * r1); ctx.stroke();
    }
    drawJupiter(jx, jy, jr, 0.7);
    // Speed lines down the sides, slowing
    ctx.fillStyle = `rgba(220,235,255,${0.25 * (1 - k)})`;
    for (let i = 0; i < 18; i++) { const x = ((i * 0.618) % 1) * W, y = (i * 211 + (R.vd || 0) * 1.2) % (H + 300) - 150; ctx.fillRect(x, y, 2, 20 + vis * 0.06); }
  }
  // Europa's surface and sky as you land on it (the space behind, turned
  // right over, with Jupiter in its place in the sky, and the ice)
  function drawEuropaSurface(R) {
    const pc = H * 0.45 - 24;
    ctx.save(); ctx.translate(W / 2, pc); ctx.rotate(Math.PI); ctx.translate(-W / 2, -pc);
    ctx.fillStyle = '#04050b'; ctx.fillRect(-W, -H * 3, W * 3, H * 7);
    drawExitSpace(R, 1);
    ctx.restore();
    drawEuropaLanding(R, 1, false);
  }
  // Where your feet are on the screen on the way down: from the surface you
  // landed on, gliding up to leave room to see what's below
  const euFeetY = (R) => H * lerp(0.72, 0.4, smooth(clamp(R.pt / 1.2, 0, 1)));
  // Where Jupiter hangs in Europa's sky
  const euJupiter = () => ({ x: W * 0.68, y: H * 0.26, r: Math.min(W, H) * 0.32 });
  // Europa: it slides up out of sight above you, the view turns right over,
  // and you drift down onto its ice (the same way you land on every world)
  function drawEuropaArrival(R) {
    const t = R.pt, py0 = H * 0.45, pc = py0 - 24;
    const turn = Math.PI * smooth(clamp((t - EU_UP) / EU_TURN, 0, 1));
    const skyK = smooth(clamp((t - EU_UP - 0.2) / (EU_TURN - 0.2), 0, 1));
    // Space and Jupiter behind you, turning away
    ctx.save(); ctx.translate(W / 2, pc); ctx.rotate(turn); ctx.translate(-W / 2, -pc);
    ctx.fillStyle = '#04050b'; ctx.fillRect(-W, -H, W * 3, H * 3);
    drawExitSpace(R, 1);
    if (t < EU_UP) {
      // Europa, close now, filling the view and sliding up out of sight
      const k = t / EU_UP, er = lerp(Math.min(W, H) * 0.12, Math.max(W, H) * 0.9, k * k), ey = lerp(H * 0.16, -er - 30, smooth(k));
      drawEuropaGlobe(W / 2, ey, er);
    }
    ctx.restore();
    // Europa's ground, turning in from above to right way up under you
    if (t >= EU_UP) {
      ctx.save(); ctx.translate(W / 2, pc); ctx.rotate(turn - Math.PI); ctx.translate(-W / 2, -pc);
      drawEuropaLanding(R, skyK, false);
      ctx.restore();
    }
    // You, upright all the way, then drifting down onto the ice
    const fk = clamp((t - EU_UP - EU_TURN) / EU_FALL, 0, 1);
    const y = lerp(py0, H * 0.72, fk * fk);
    const squash = R.landed ? Math.max(0, 1 - (t - EU_LAND) * 4) : 0;
    drawSprite(R.landed ? 'stand' : 'jump', W / 2 + R.x * (1 - fk), y, false, 1 - squash * 0.2, 1 + squash * 0.15, 1, SUIT);
    if (conspiracy) drawFoilHat(W / 2 + R.x * (1 - fk), y, 0);
    for (const q of R.trail) { ctx.globalAlpha = 1 - q.t / q.life; px(q.x - 3, q.y - 3, 6, 6, q.c); }
    ctx.globalAlpha = 1;
  }
  // On Europa: down you come onto its cracked, ridged ice, with Jupiter huge
  // in the sky, Io beside it, and a plume of water vapour on the horizon
  function drawEuropaLanding(R, skyA = 1, ownSky = true) {
    ctx.save(); ctx.globalAlpha = skyA;
    if (ownSky) { ctx.fillStyle = '#04050b'; ctx.fillRect(-W, -H * 2, W * 3, H * 2.72); for (const st of world.sky) px(st.x * W, st.y * H * 0.7, st.s, st.s, '#c9d7f0'); }
    if (ownSky) { const J = euJupiter(); drawJupiter(J.x, J.y, J.r, 0.7); }
    ctx.fillStyle = '#e8d27a'; ctx.beginPath(); ctx.arc(W * 0.22, H * 0.18, 5, 0, TAU); ctx.fill();
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(238,241,255,0.7)'; ctx.fillText('IO', W * 0.22, H * 0.18 - 10); ctx.textAlign = 'start';
    ctx.restore();
    const ER = Math.max(W, H) * 0.85, ecx = W / 2, ecy = H * 0.72 + ER; // round Europa
    // A plume, maybe: Hubble may have spotted water vapour spraying out
    const px0 = W * 0.84, py0 = H * 0.72 - 8;
    for (let i = 0; i < 26; i++) {
      const k = ((clock * 0.6 + i / 26) % 1), sx = px0 + Math.sin(i * 2.3) * 30 * k, sy = py0 - k * H * 0.4;
      ctx.fillStyle = `rgba(230,240,255,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(sx, sy, 4 + k * 14, 0, TAU); ctx.fill();
    }
    const ice = ctx.createLinearGradient(0, H * 0.7, 0, H);
    ice.addColorStop(0, '#f4f1ea'); ice.addColorStop(0.4, '#ddd3c0'); ice.addColorStop(1, '#a9b8c8');
    ctx.fillStyle = ice; ctx.beginPath(); ctx.arc(ecx, ecy, ER, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(ecx, ecy, ER, 0, TAU); ctx.clip();
    // Double ridges: pairs of raised lines with a groove down the middle
    for (let i = 0; i < 6; i++) {
      const x0 = ((i * 173) % (W + 200)) - 100, y0 = H * 0.74 + (i % 3) * 22;
      for (const [dy, col, lw] of [[0, 'rgba(120,70,45,0.75)', 5], [-4, 'rgba(255,255,255,0.7)', 2], [4, 'rgba(255,255,255,0.5)', 2]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0 + dy); ctx.bezierCurveTo(x0 + 130, y0 + 30 + dy, x0 + 260, y0 - 10 + dy, x0 + 420, y0 + 70 + dy); ctx.stroke();
      }
    }
    // Chaos terrain: broken blocks of ice that refroze
    for (let i = 0; i < 9; i++) { const x = W * 0.08 + i * 26, y = H * 0.8 + (i % 3) * 14; px(x, y, 20, 12, i % 2 ? '#cfd8e2' : '#e9e2d4'); px(x, y, 20, 2, '#ffffff'); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(0, H * 0.72, W, 3);
    // Cracks spreading out from under your feet as the ice gives way
    const ck = R.phase === 'ocean' ? 1 : R.crack || 0;
    if (ck > 0) {
      ctx.strokeStyle = '#3a6a9a'; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const a = Math.PI * (0.05 + (i / 6) * 0.9), len = ck * (60 + (i % 3) * 40); ctx.beginPath(); ctx.moveTo(W / 2, H * 0.72 + 2); ctx.lineTo(W / 2 + Math.cos(a) * len * 0.6, H * 0.72 + 2 + Math.sin(a) * len * 0.15); ctx.lineTo(W / 2 + Math.cos(a + 0.2) * len, H * 0.72 + 2 + Math.sin(a) * len * 0.3); ctx.stroke(); }
    }
    ctx.restore();
    if (conspiracy) drawMonolith(W * 0.24, H * 0.72);
  }
  // Under Europa's ice: through the ice shell, down through the dark ocean,
  // to the seafloor and its hot vents
  function drawOcean(R) {
    const lane = runLane(), fy = euFeetY(R), S = fy - R.od; // S: where the surface is on screen
    // Above: the surface you landed on, its sky and Jupiter, scrolling away up
    // (its curved ice carries on down as the surface layer, until the ice shell takes over)
    if (S + EU_LAYERS[1].at > -10) { ctx.save(); ctx.translate(0, S - H * 0.72); drawEuropaSurface(R); ctx.restore(); }
    // Below: the layers, each with its own look, cut away like the hollow Earth
    for (let i = 1; i < EU_LAYERS.length; i++) {
      const L = EU_LAYERS[i], y0 = Math.max(S + L.at, -10), y1 = Math.min(i < EU_LAYERS.length - 1 ? S + EU_LAYERS[i + 1].at : H + 10, H + 10);
      if (y1 <= y0) continue;
      const g = ctx.createLinearGradient(0, S + L.at, 0, S + (i < EU_LAYERS.length - 1 ? EU_LAYERS[i + 1].at : L.at + 400));
      g.addColorStop(0, L.c[0]); g.addColorStop(1, L.c[1]);
      ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
      ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, y1 - y0); ctx.clip();
      euLayerFx(i, R, S + L.at, y0, y1);
      ctx.restore();
      // The edge, with its name, coming up at you
      if (i > 0) {
        const y = S + L.at;
        if (y > -40 && y < H + 40) {
          ctx.strokeStyle = i === 3 ? 'rgba(200,235,255,0.95)' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.beginPath();
          for (let x = 0; x <= W; x += 20) { const yy = y + Math.sin(x * 0.03 + i) * (i === 3 ? 4 + 2 * Math.sin(clock * 2) : 6); x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
          ctx.stroke();
          if (y > fy) {
            ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(10,8,20,0.75)'; ctx.fillText(L.name, W / 2 + 1, y + 23);
            ctx.fillStyle = '#ffffff'; ctx.fillText(L.name, W / 2, y + 22);
            ctx.font = '7px "Press Start 2P", monospace'; ctx.fillStyle = 'rgba(240,248,255,0.9)'; ctx.fillText(L.sub, W / 2, y + 38);
            ctx.textAlign = 'start';
          }
        }
      }
    }
    // The seafloor's hot vents ("black smokers"), with shimmering plumes
    const floorY = S + OCEAN_LEN;
    if (floorY < H + 260) for (const vx of [W * 0.18, W * 0.5 + lane * 0.85, W * 0.8]) {
      px(vx - 12, floorY - 70, 24, 70, '#3a3a42'); px(vx - 8, floorY - 78, 16, 10, '#4a4a52');
      for (let i = 0; i < 10; i++) { const kk = ((clock * 0.5 + i / 10) % 1); ctx.fillStyle = `rgba(40,40,50,${0.6 * (1 - kk)})`; ctx.beginPath(); ctx.arc(vx + Math.sin(i + clock) * 8 * kk, floorY - 80 - kk * 160, 6 + kk * 16, 0, TAU); ctx.fill(); }
      const vg = ctx.createRadialGradient(vx, floorY - 74, 2, vx, floorY - 74, 40);
      vg.addColorStop(0, 'rgba(255,140,60,0.6)'); vg.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = vg; ctx.fillRect(vx - 40, floorY - 114, 80, 80);
    }
    // The hole you've smashed down through the ice behind you
    const iceBot = Math.min(S + 2100, fy - 30);
    if (iceBot > S) { ctx.fillStyle = 'rgba(14,42,68,0.55)'; ctx.beginPath(); ctx.moveTo(W / 2 + R.x * 0.3 - 26, Math.max(S, -10)); ctx.lineTo(W / 2 + R.x * 0.3 + 26, Math.max(S, -10)); ctx.lineTo(W / 2 + R.x + 22, iceBot); ctx.lineTo(W / 2 + R.x - 22, iceBot); ctx.fill(); }
    for (const gm of world.stars) {
      if (!gm.ocean || gm.taken) continue;
      const y = fy + (gm.d - R.od);
      if (y > -30 && y < H + 30) drawGeomAt(W / 2 + gm.u * lane, y);
    }
    for (const q of R.trail) { ctx.globalAlpha = 1 - q.t / q.life; px(q.x - 2, q.y - 2, 4, 4, q.c); }
    ctx.globalAlpha = 1;
    const bx = W / 2 + R.x, wet = R.od > 2100;
    if (wet) for (let i = 0; i < 4; i++) { const kk = ((clock * 0.8 + i / 4) % 1); ctx.strokeStyle = `rgba(220,240,255,${0.6 * (1 - kk)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx + 6 + Math.sin(i * 3) * 4, fy - 50 - kk * 60, 3 + kk * 2, 0, TAU); ctx.stroke(); }
    else if (R.ov > 300) for (let i = 0; i < 6; i++) { const kk = ((clock * 3 + i / 6) % 1); px(bx - 18 + i * 7, fy - 50 - kk * 50, 4, 4, `rgba(235,245,255,${0.7 * (1 - kk)})`); }
    const sq = R.floored ? Math.max(0, 1 - R.floorT * 4) : 0;
    drawSprite(R.floored ? 'stand' : 'jump', bx, fy, player.facing < 0, 1 - sq * 0.2, 1 + sq * 0.15, 1, SUIT);
    if (conspiracy) drawFoilHat(bx, fy, 0);
    drawRunPops(bx, fy + 6);
  }
  // What each of Europa's layers looks like as you fall through it
  function euLayerFx(i, R, top, y0, y1) {
    if (i === 0) {
      // Reddish-brown salt streaks, and double ridges
      ctx.strokeStyle = 'rgba(150,80,50,0.55)'; ctx.lineWidth = 4;
      for (let k = 0; k < 6; k++) { const y = top + 60 + k * 70; ctx.beginPath(); ctx.moveTo(-20, y); ctx.bezierCurveTo(W * 0.3, y + 30, W * 0.6, y - 20, W + 20, y + 25); ctx.stroke(); }
    } else if (i === 1) {
      // Layers of brittle ice, and cracks through them
      for (let k = 0; k < 16; k++) { const y = top + 30 + k * 58; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, y, W, 3); }
      ctx.strokeStyle = 'rgba(40,90,140,0.5)'; ctx.lineWidth = 2;
      for (let k = 0; k < 7; k++) { const x = (k * 157) % W, y = top + 80 + k * 120; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30, y + 40); ctx.lineTo(x + 10, y + 90); ctx.stroke(); }
    } else if (i === 2) {
      // Soft ice slowly churning, and pockets of trapped water
      for (let k = 0; k < 8; k++) { const x = W * ((k * 0.37) % 1) + Math.sin(clock * 0.5 + k) * 20, y = top + 60 + k * 80; ctx.fillStyle = 'rgba(160,200,240,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 90, 30, Math.sin(clock * 0.3 + k) * 0.3, 0, TAU); ctx.fill(); }
      for (let k = 0; k < 3; k++) { const x = W * (0.2 + k * 0.3), y = top + 200 + k * 160; ctx.fillStyle = '#1d4a7c'; ctx.beginPath(); ctx.ellipse(x, y, 60, 14, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(200,235,255,0.6)'; ctx.fillRect(x - 40, y - 2, 30, 2); }
    } else if (i === 3) {
      // Icicles under the ice, drifting specks, and (imagined) glowing life
      ctx.fillStyle = '#cfe8ff';
      for (let k = 0; k < 24; k++) { const x = (k * 41) % W; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 8, top + 14 + (k % 4) * 8); ctx.lineTo(x + 16, top); ctx.fill(); }
      for (let k = 0; k < 40; k++) px((k * 97) % W, top + ((k * 53) % 2200), 2, 2, 'rgba(180,220,255,0.35)');
      for (let k = 0; k < 5; k++) {
        const x = W * ((k * 0.29 + 0.1) % 1) + Math.sin(clock + k) * 20, y = top + 600 + k * 330 + Math.sin(clock * 1.5 + k) * 10;
        ctx.fillStyle = 'rgba(140,255,220,0.5)'; ctx.beginPath(); ctx.arc(x, y, 10, Math.PI, TAU); ctx.fill();
        for (let j = 0; j < 4; j++) px(x - 7 + j * 4, y, 1.5, 10 + Math.sin(clock * 3 + j + k) * 3, 'rgba(140,255,220,0.5)');
      }
      ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(160,255,230,0.7)'; ctx.fillText('IMAGINED LIFE?', W * 0.39, top + 570); ctx.textAlign = 'start';
    } else {
      // The seafloor: rocks and pebbles
      for (let k = 0; k < 14; k++) px((k * 67) % W, top + 6 + (k % 3) * 10, 10 + (k % 4) * 6, 5, '#3a3a44');
    }
  }

  function render() {
    if (state === 'splash' || state === 'tour') { drawIntro(); return; }
    if (fx.arrive) {
      if (fx.arrive.t >= ARR_SWAP) { drawArrival(); drawBanner(); return; }
      // The world turning over (scaled up a little so the corners stay covered)
      ctx.save();
      const turn = arriveTurn(), zs = 1 + Math.sin(turn) * 0.45;
      ctx.translate(W / 2, H / 2); ctx.rotate(turn); ctx.scale(zs, zs); ctx.translate(-W / 2, -H / 2);
      renderWorld();
      ctx.restore();
      drawArriveCover();
      return;
    }
    if (fx.climb) { drawClimb(); drawBanner(); drawRail(); return; }
    if (fx.sling && fx.sling.t < SL_FADE) {
      // The old view, the spacecraft carrying you up and away, fading into the slingshot
      const S = fx.sling; fx.sling = null; renderWorld(); fx.sling = S;
      runFade = canvasLike(runFade);
      const b = runFade.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'copy'; b.drawImage(canvas, 0, 0); b.globalCompositeOperation = 'source-over';
      renderWorld();
      ctx.save(); ctx.globalAlpha = 1 - smooth(clamp(S.t / SL_FADE, 0, 1)); ctx.drawImage(runFade, 0, 0, W, H); ctx.restore();
      return;
    }
    if (fx.launch && fx.run) {
      // The old view, flying away, fading out over the run
      const R = fx.run; fx.run = null; renderWorld(); fx.run = R;
      runFade = canvasLike(runFade);
      const b = runFade.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'copy'; b.drawImage(canvas, 0, 0); b.globalCompositeOperation = 'source-over';
      renderWorld();
      ctx.save(); ctx.globalAlpha = 1 - smooth(clamp((fx.launch.t - LAUNCH_HAND) / (LAUNCH_END - LAUNCH_HAND), 0, 1)); ctx.drawImage(runFade, 0, 0, W, H); ctx.restore();
      return;
    }
    renderWorld();
    if (fx.land) drawLandSnap();
    if (fx.burrow) {
      const k = rockK();
      drawRock(k);
      // You, smashing on down through it
      if (k > 0) { const fy = H * (cam.anchor || 0.4) + cam.r - player.r; drawSprite('jump', W / 2, fy, player.facing < 0, 1, 1, k, level === 1 && !player.suit ? PAL : SUIT); if (conspiracy) drawFoilHat(W / 2, fy, 0); }
    }
  }
  function renderWorld() {
    if (fx.sling || fx.rings7) {
      if (fx.sling) drawSling(); else drawRings7();
      drawBanner();
      if (fx.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${fx.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
      drawRail();
      return;
    }
    if (fx.run) {
      drawRun(); drawBanner();
      if (fx.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${fx.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
      drawRail();
      return;
    }
    const anchorY = H * (cam.anchor || 0.46);
    cx = Math.round(W / 2);
    cy = anchorY + cam.r;
    if (!noSky) drawSky();
    if (state === 'descend') drawIntroSpace();
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
    if (level === 3) drawConvoy(...EARTH_FROM_MARS(), clamp(1 - tierFloat(player.r) / 3.5, 0, 1), 'far');
    if (level === 3) drawMarsScape(); else if (level === 2) drawPlains(); else if (level === 1) { drawMountains(); drawEcoLayers(false); }
    if (level === 3) drawMarsBody(); else if (level === 2) drawMoonBody(); else if (level === 1) drawEarth();
    if (level === 4) drawVenusBody();
    if (level === 5) drawDwarfBody();
    if (level === 7) drawEuropaBody7();
    if (level === 6) drawHollowWorld();
    drawDecor();
    drawConspiracyProps();
    drawCraters();
    if (level === 3) drawCaves();
    if (level === 4) drawShadows();
    const platA = state === 'descend' ? clamp((cam.zoom - 0.55) / 0.35, 0, 1) : 1;
    for (const p of world.plats) {
      if (p.broken || platA <= 0) continue;
      ctx.globalAlpha = ghost(p) ? 0.18 * platA : platA;
      if (p.ride) drawRide(p);
      drawPlatform(p);
      ctx.globalAlpha = 1;
    }
    if (level >= 2) drawHazards();
    if (level === 3) { drawBeings(); drawCrash(); drawPebbles(); drawDrones(); drawSnakesLadders(); }
    for (const p of world.plats) {
      if (mode !== 'checkpoint' || !p.main || !CHECKPOINTS.has(p.tier)) continue;
      if ((level === 2 || level === 3) && p.route !== (route || (level === 3 ? p.route : 'mars'))) continue;
      at(p.a + theta, p.R, () => {
        const col = p.tier <= checkpoint ? '#52e07a' : 'rgba(238,241,255,0.8)';
        const x = -p.w / 2 + 4, wave = Math.sin(clock * 5 + p.tier) * 2;
        px(x, -30, 2, 30, '#e8e8f0');
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x + 2, -30); ctx.lineTo(x + 16, -25 + wave); ctx.lineTo(x + 2, -20); ctx.fill();
      });
    }
    if (state !== 'descend') { for (const s of world.stars) if (!s.run) drawStar(s); drawGeoms(); }

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
      drawSprite('jump', cx + g.r * Math.sin(ph), cy - g.r * Math.cos(ph), g.flip, 1, 1, g.life * 2, PAL, g.spin);
    }
    if (!hidden && !ghostDraw) {
      drawGuide(feetX, feetY);
      drawFire(feetX, feetY);
      if (fx.drop && AIRY(level)) drawEntry(feetX, feetY);
      drawSprite(frame, feetX, feetY, player.facing < 0, sy, sx, 1, player.heat > 0.55 ? HOT : player.suit ? SUIT : PAL, player.spin || 0);
      if (conspiracy) drawFoilHat(feetX, feetY, player.spin || 0, player.facing < 0);
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
    if (level === 1) drawEcoLayers(true);
    drawParticles();
    drawFx();
    ctx.restore();
    if (ghostDraw || noSky) return; // the far world, or turning over: no screen overlays
    if (fk > 0) {
      // Speed lines run along the direction of travel, so sideways once turned
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(flipA); ctx.translate(-W / 2, -H / 2);
      drawSpeedLines();
      ctx.restore();
    } else drawSpeedLines();
    if (level >= 2) { drawWind(); if (fk < 0.05) drawMeteorWarnings(); }
    if (level === 3) { drawForeground(); drawImprobable(); drawWorldPointer(); }
    if (level === 2 || level === 4) drawFlare();
    // The saucers fly in front of the scenery, across the top of the sky
    if (level === 3) drawConvoy(...EARTH_FROM_MARS(), clamp(1 - tierFloat(player.r) / 3.5, 0, 1), 'near');
    if (!snapping) drawBanner();
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
    else if (!snapping) drawRail();
  }

  // ---- Intro: a comet writes the title in space; tap to fall to Earth --------
  const intro = { t: 0, letters: [], parts: [], warp: [], passT: 0, dT: 0, startR: 0, ready: 0 };
  const INTRO_LINES = [
    { text: 'INTERSTELLAR', scale: 0.4, row: -1, colors: ['#8fd0ff'] },
    { text: 'SUPERTRAMP', scale: 1, row: 0, colors: ['#ffd23f', '#ffd23f', '#ffd23f', '#ffd23f', '#ffd23f', '#eef1ff'] },
  ];
  const PASS = 2.6;      // seconds for the comet to cross the screen
  const DESCEND = 2.8;   // seconds for the zoom down to the ground
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
    for (const w of intro.warp) { w.d += w.v * dt * (state === 'tour' ? 3 : 1); if (w.d > 1) { w.d = 0; w.a = Math.random() * TAU; } }

    if (state === 'tour') {
      intro.tT += dt;
      if (intro.tT >= TOUR) beginZoom();
    } else if (state === 'descend') {
      intro.dT += dt;
      const p = zoomK();
      const e = 1 - Math.pow(1 - p, 2.2);
      cam.zoom = zoomFrom() * Math.pow(1 / zoomFrom(), e);
      cam.r = R0; cam.anchor = 0.46;
      player.walkT += dt * 5; // already strolling
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

  // ---- The intro's Earth: a globe with real continents --------------------------
  // Rough outlines (longitude, latitude), filled into a 1.25° grid once at load
  const CONTINENTS = [
    [[-165, 68], [-140, 70], [-110, 72], [-90, 72], [-80, 65], [-62, 60], [-55, 50], [-66, 44], [-75, 35], [-81, 25], [-90, 29], [-97, 26], [-97, 20], [-88, 16], [-83, 9], [-78, 8], [-92, 15], [-105, 20], [-112, 30], [-118, 34], [-124, 40], [-124, 48], [-135, 58], [-150, 60], [-165, 60]],
    [[-55, 82], [-30, 83], [-20, 75], [-40, 65], [-50, 62], [-60, 75]],
    [[-78, 8], [-60, 10], [-50, 0], [-35, -7], [-40, -22], [-48, -28], [-58, -38], [-65, -42], [-68, -55], [-74, -50], [-72, -35], [-71, -18], [-78, -8], [-81, -3]],
    [[-10, 36], [-9, 43], [-2, 48], [5, 53], [10, 57], [5, 62], [15, 69], [30, 71], [45, 68], [70, 73], [100, 77], [140, 72], [179, 68], [178, 62], [160, 60], [140, 54], [135, 43], [127, 38], [122, 30], [120, 22], [108, 20], [106, 10], [100, 13], [100, 3], [97, 17], [90, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [50, 30], [35, 32], [27, 37], [24, 40], [20, 40], [15, 45], [12, 44], [16, 38], [8, 44], [3, 43], [-5, 36]],
    [[35, 28], [48, 30], [56, 25], [59, 22], [52, 16], [43, 12], [39, 20]],
    [[-17, 21], [-10, 30], [-6, 35], [10, 37], [20, 32], [32, 31], [35, 25], [43, 12], [51, 11], [40, -3], [40, -15], [33, -26], [20, -35], [17, -29], [12, -17], [13, -6], [9, 4], [-8, 5], [-16, 12]],
    [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -28], [150, -37], [140, -38], [132, -32], [115, -34]],
    [[-6, 50], [2, 51], [0, 58], [-5, 58]], [[130, 31], [141, 36], [142, 44], [139, 40]], [[44, -25], [50, -15], [48, -13], [44, -17]],
    [[109, 1], [117, 7], [119, 1], [115, -4], [110, -3]], [[95, 5], [105, -6], [100, -2]], [[166, -46], [174, -41], [178, -38], [172, -34], [168, -44]],
  ];
  const GLOBE = (() => {
    const inPoly = (x, y, poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const cells = [];
    for (let lat = -89.375; lat < 90; lat += 1.25) {
      for (let lon = -179.375; lon < 180; lon += 1.25) {
        const ice = lat < -70 || (lat > 60 && inPoly(lon, lat, CONTINENTS[1]));
        if (!ice && !CONTINENTS.some((p) => inPoly(lon, lat, p))) continue;
        const desert = (lat > 15 && lat < 32 && lon > -15 && lon < 58) || (lat > -30 && lat < -20 && lon > 118 && lon < 142) || (lat > 36 && lat < 46 && lon > 75 && lon < 110);
        const n = Math.sin(lon * 0.37 + lat * 0.71) * Math.sin(lon * 0.13 - lat * 0.29);
        cells.push({ la: (lat * Math.PI) / 180, lo: (lon * Math.PI) / 180, col: ice ? '#f2f6fa' : desert ? (n > 0 ? '#c9a86a' : '#b8955a') : lat > 55 || lat < -45 ? '#6f8f5a' : n > 0.2 ? '#3f8f3a' : n < -0.2 ? '#5aa04a' : '#4a9a42' });
      }
    }
    const clouds = [];
    for (let i = 0; i < 70; i++) clouds.push({ la: Math.asin(Math.random() * 1.8 - 0.9), lo: Math.random() * TAU, w: 0.08 + Math.random() * 0.2 });
    return { cells, clouds };
  })();
  function drawGlobe(x, y, r, rot, alpha = 1, tilt = 0.4) {
    if (r < 18) { ctx.globalAlpha = alpha; drawPlanet('earth', x, y, r); ctx.globalAlpha = 1; return; }
    ctx.save(); ctx.globalAlpha = alpha;
    const atm = ctx.createRadialGradient(x, y, r * 0.96, x, y, r * 1.12);
    atm.addColorStop(0, 'rgba(120,200,255,0.6)'); atm.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.fillStyle = '#1f5fae'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const sz = Math.max(1.5, r * 0.024);
    const proj = (la, lo) => {
      const cl = Math.cos(la), px0 = cl * Math.sin(lo + rot), py0 = Math.sin(la), pz0 = cl * Math.cos(lo + rot);
      return [px0, py0 * ct - pz0 * st, pz0 * ct + py0 * st];
    };
    for (const c of GLOBE.cells) {
      const [gx, gy, gz] = proj(c.la, c.lo);
      if (gz <= 0) continue;
      ctx.fillStyle = c.col;
      ctx.fillRect(Math.round(x + gx * r - sz / 2), Math.round(y - gy * r - sz / 2), Math.ceil(sz * (0.5 + gz * 0.5)) + 1, Math.ceil(sz) + 1);
    }
    // Clouds drift a little faster than the ground turns
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const c of GLOBE.clouds) {
      const [gx, gy, gz] = proj(c.la, c.lo + clock * 0.03);
      if (gz <= 0.05) continue;
      ctx.fillRect(x + gx * r - c.w * r * gz * 0.5, y - gy * r - sz * 0.4, c.w * r * gz, sz * 0.8);
    }
    // Lit from the upper left; night creeping in on the lower right
    const sh = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x - r * 0.2, y - r * 0.2, r * 1.5);
    sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(0.55, 'rgba(0,0,20,0)'); sh.addColorStop(1, 'rgba(0,0,20,0.75)');
    ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  // ---- The intro's Moon: a real map, in the same pixel style as the Earth ----------
  // The dark "seas" (maria) are old lava plains; the bright highlands are older
  // and covered in craters. Positions are selenographic longitude and latitude
  // on the side that always faces Earth.
  const MARIA = [
    { name: 'OCEAN OF STORMS', poly: [[-75, 10], [-66, 30], [-52, 44], [-38, 42], [-30, 26], [-26, 10], [-34, -4], [-44, -14], [-58, -18], [-72, -6]] },
    { name: 'SEA OF RAINS', c: [-16, 33], r: 17 }, { name: 'SEA OF SERENITY', c: [17, 28], r: 9 },
    { name: 'SEA OF TRANQUILLITY', c: [30, 9], r: 11 }, { name: 'SEA OF CRISES', c: [59, 17], r: 7 },
    { name: 'SEA OF FERTILITY', c: [51, -8], r: 9 }, { name: 'SEA OF NECTAR', c: [34, -15], r: 5 },
    { name: 'SEA OF CLOUDS', c: [-17, -21], r: 10 }, { name: 'SEA OF MOISTURE', c: [-39, -24], r: 5 },
    { c: [4, 13], r: 4 }, { c: [-23, -10], r: 5 }, { c: [12, 20], r: 4 },
    { name: 'SEA OF COLD', poly: [[-45, 54], [-20, 58], [10, 60], [40, 58], [42, 53], [10, 55], [-20, 53], [-44, 50]] },
  ];
  const MOON_CRATERS = [
    { name: 'TYCHO', c: [-11, -43], r: 2.6, rays: 9 }, { name: 'COPERNICUS', c: [-20, 10], r: 2.9, rays: 5 }, { c: [-38, 8], r: 1.5, rays: 3 },
    { name: 'PLATO', c: [-9, 51], r: 2.2, dark: true }, { c: [-47, 24], r: 1.4, bright: true }, { c: [-14, -58], r: 3.6 }, { c: [-68, -5], r: 2.6, dark: true },
    { c: [5, -48], r: 2.2 }, { c: [27, -50], r: 2.6 }, { c: [-5, -12], r: 2.4 }, { c: [60, -40], r: 2.8 }, { c: [40, 40], r: 2.3 },
  ];
  const MOON_MAP = (() => {
    const inPoly = (x, y, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
    const dist = (lo1, la1, lo2, la2) => { const r = Math.PI / 180; return Math.acos(clamp(Math.sin(la1 * r) * Math.sin(la2 * r) + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.cos((lo1 - lo2) * r), -1, 1)) / r; };
    const hsh = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
    // Lots of small craters scattered about, more on the highlands
    const small = [];
    for (let i = 0; i < 520; i++) small.push({ c: [hsh(i, 1) * 360 - 180, Math.asin(hsh(i, 2) * 2 - 1) * 57.3], r: 0.6 + hsh(i, 3) * 1.8 });
    const cells = [];
    for (let lat = -89.6875; lat < 90; lat += 0.625) {
      for (let lon = -179.6875; lon < 180; lon += 0.625) {
        let col = null;
        // Smooth, blotchy variation (not speckle), and wavy edges to the seas
        const n = Math.sin(lon * 0.13 + 1.3) * Math.sin(lat * 0.17 - 0.4) + 0.5 * Math.sin(lon * 0.41 + lat * 0.29);
        const mare = MARIA.some((m) => (m.poly ? inPoly(lon + 2 * Math.sin(lat * 0.5), lat, m.poly) : dist(lon, lat, m.c[0], m.c[1]) < m.r * (1 + 0.12 * Math.sin(lon * 0.7 + lat * 0.9))));
        if (mare) col = n > 0.2 ? '#6f6d79' : n < -0.4 ? '#5f5d69' : '#67656f';
        else if (n > 0.95) col = '#d4d1da';
        else if (n < -0.95) col = '#b4b1bc';
        for (const k of MOON_CRATERS) {
          const d = dist(lon, lat, k.c[0], k.c[1]);
          if (d < k.r * 0.75) col = k.dark ? '#5e5c68' : k.bright ? '#f2f0f6' : '#9e9ba8';
          else if (d < k.r * 1.15) col = '#eceaf2';
          else if (k.rays && d < k.r * 12) {
            // Bright rays splashed out from the impact
            const r = Math.PI / 180, b = Math.atan2(Math.sin((lon - k.c[0]) * r) * Math.cos(lat * r), Math.cos(k.c[1] * r) * Math.sin(lat * r) - Math.sin(k.c[1] * r) * Math.cos(lat * r) * Math.cos((lon - k.c[0]) * r));
            const lane = ((b / TAU) * k.rays * 2 + 10) % 1;
            if (lane < 0.16 && hsh(Math.round(d), Math.round(b * 10)) > 0.25 - (k.r * 12 - d) / (k.r * 40)) col = mare ? '#a8a6b2' : '#e6e4ec';
          }
        }
        if (!col || mare) for (const k of small) { const d = Math.abs(lon - k.c[0]) < 6 && Math.abs(lat - k.c[1]) < 6 ? dist(lon, lat, k.c[0], k.c[1]) : 99; if (d < k.r) { col = d < k.r * 0.55 ? (mare ? '#56545f' : '#9f9ca9') : (mare ? '#8a8894' : '#dedbe4'); break; } }
        if (!col) continue;
        const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
        cells.push({ cl: Math.cos(la), sl: Math.sin(la), co: Math.cos(lo), so: Math.sin(lo), col });
      }
    }
    return cells;
  })();
  // The Moon drawn as a globe, turned by rot (radians) and tipped by tilt
  function drawMoonGlobe(x, y, r, rot, tilt = -0.35) {
    if (y - r > H + 10) return;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, r * 0.95, x, y, r * 1.08);
    g.addColorStop(0, 'rgba(220,220,235,0.35)'); g.addColorStop(1, 'rgba(220,220,235,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c4c1cb'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(rot), sr = Math.sin(rot), sz = Math.max(1.2, r * 0.0112);
    for (const c of MOON_MAP) {
      const sinL = c.so * cr + c.co * sr, cosL = c.co * cr - c.so * sr;
      const px0 = c.cl * sinL, pz0 = c.cl * cosL;
      const gy = c.sl * ct - pz0 * st, gz = pz0 * ct + c.sl * st;
      if (gz <= 0) continue;
      const sx = x + px0 * r, sy = y - gy * r;
      if (sy < -sz || sy > H + sz || sx < -sz || sx > W + sz) continue;
      ctx.fillStyle = c.col;
      ctx.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), Math.ceil(sz * (0.5 + gz * 0.5)) + 1, Math.ceil(sz * gz * 0.6 + sz * 0.4) + 1);
    }
    // Labels on the big seas, and where Apollo 11 landed
    if (r > 260) {
      ctx.font = `${r > 600 ? 8 : 6}px "Press Start 2P", monospace`; ctx.textAlign = 'center';
      const put = (lon, lat, text, col) => {
        const lo = (lon * Math.PI) / 180 + rot, la = (lat * Math.PI) / 180, cl = Math.cos(la);
        const gx = cl * Math.sin(lo), pz = cl * Math.cos(lo), gy = Math.sin(la) * ct - pz * st, gz = pz * ct + Math.sin(la) * st;
        if (gz < 0.25) return;
        const sx = x + gx * r, sy = y - gy * r;
        if (sy < 8 || sy > H - 4) return;
        ctx.globalAlpha = Math.min(1, (gz - 0.25) * 3);
        ctx.fillStyle = 'rgba(20,20,30,0.7)'; ctx.fillText(text, sx + 1, sy + 1); ctx.fillStyle = col; ctx.fillText(text, sx, sy);
        ctx.globalAlpha = 1;
      };
      for (const m of MARIA) if (m.name) { const c = m.c || [m.poly.reduce((s, p) => s + p[0], 0) / m.poly.length, m.poly.reduce((s, p) => s + p[1], 0) / m.poly.length]; put(c[0], c[1], m.name, '#eef1ff'); }
      for (const k of MOON_CRATERS) if (k.name) put(k.c[0], k.c[1] - k.r - 1.5, k.name, '#ffe9a0');
      put(23.5, 0.7, '▲ APOLLO 11', '#ffd23f');
      ctx.textAlign = 'start';
    }
    // Sunlight from the upper right; the night side creeping in on the left
    const sh = ctx.createLinearGradient(x - r, y, x + r, y - r * 0.4);
    sh.addColorStop(0, 'rgba(5,6,16,0.85)'); sh.addColorStop(0.28, 'rgba(5,6,16,0.25)'); sh.addColorStop(0.45, 'rgba(5,6,16,0)'); sh.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  // ---- The intro's journey -----------------------------------------------------------
  // It opens on the Moon: its grey, cratered horizon turning slowly beneath
  // you, an old lander and its flag on the skyline, and the Earth rising
  // over it (like Apollo 8's famous "Earthrise" photo). Tap and you lift off
  // and fly to Earth, past the Space Station and satellites, and straight in.
  const TOUR = 5.6;      // seconds of flight before the zoom to the ground
  const zoomFrom = () => (Math.min(W, H) * 0.2) / R0;
  const smooth = (k) => k * k * k * (k * (k * 6 - 15) + 10);
  const FLYBY = [
    { kind: 'iss', t: 3.9, x: 0.11, y: -0.09, r: 26, label: 'SPACE STATION' },
    { kind: 'sat', t: 4.7, x: -0.12, y: 0.07, r: 12 },
    { kind: 'sat', t: 5.6, x: 0.12, y: 0.09, r: 12 },
    { kind: 'sat', t: 6.3, x: -0.1, y: -0.11, r: 10 },
    { kind: 'sat', t: 7.0, x: 0.09, y: -0.1, r: 10 },
  ];
  function flyDepth(t, tp) { return Math.max(0.04, (tp - t) * 0.9 + 0.28); }
  function drawSatellite(kind, x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(kind === 'iss' ? 0.2 : clock * 0.6);
    const s = r / 26;
    if (kind === 'iss') {
      px(-40 * s, -2 * s, 80 * s, 4 * s, '#c9ced9');
      for (const ox of [-36, -24, 20, 32]) { px(ox * s, -22 * s, 10 * s, 18 * s, '#2b4fb8'); px(ox * s, 4 * s, 10 * s, 18 * s, '#2b4fb8'); }
      px(-10 * s, -6 * s, 20 * s, 12 * s, '#e8e8f0'); px(-4 * s, -9 * s, 8 * s, 18 * s, '#d6dce8');
    } else {
      px(-6 * s, -6 * s, 12 * s, 12 * s, '#d9a63a'); px(-26 * s, -3 * s, 18 * s, 6 * s, '#2b4fb8'); px(8 * s, -3 * s, 18 * s, 6 * s, '#2b4fb8');
      if (Math.sin(clock * 6 + x) > 0.6) px(-1 * s, -9 * s, 2 * s + 1, 2 * s + 1, '#ff5a4a');
    }
    ctx.restore();
  }
  function drawFlyby(f, t) {
    const d = flyDepth(t, f.t), sc = 0.28 / d;
    const x = W / 2 + f.x * W * sc * 3.4, y = H * 0.48 + f.y * H * sc * 3.4, r = f.r * sc;
    if (r < 0.6 || x < -r * 3 || x > W + r * 3 || y < -r * 3 || y > H + r * 3) return;
    const a = clamp((t - (f.t - 3.2)) * 1.2, 0, 1) * (state === 'splash' ? 0 : clamp(t / 1.2, 0, 1));
    if (a <= 0) return;
    ctx.globalAlpha = a;
    if (f.kind === 'iss' || f.kind === 'sat') drawSatellite(f.kind, x, y, r);
    else drawPlanet(f.kind, x, y, r);
    if (f.label && r > 6 && r < 260) {
      ctx.globalAlpha = a * clamp((r - 6) / 10, 0, 1);
      ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#1b1530'; ctx.fillText(f.label, x + 1, y - r - 9); ctx.fillStyle = '#eef1ff'; ctx.fillText(f.label, x, y - r - 10);
      ctx.textAlign = 'start';
    }
    ctx.globalAlpha = 1;
  }
  // Earth: rising over the Moon at first, then gliding to the middle and
  // growing until it becomes the game world
  function tourEarth(t) {
    const k = smooth(clamp(t / TOUR, 0, 1)), target = R0 * zoomFrom(), r0 = Math.min(W, H) * 0.09;
    return { x: lerp(W * 0.7, W / 2, k), y: lerp(H * 0.72, H * 0.46 + target, k), r: Math.exp(lerp(Math.log(r0), Math.log(target), k)) };
  }
  function drawTourScene(t, titleAlpha) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#02030a'); bg.addColorStop(1, '#0b1030');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const sp = state === 'tour' ? clamp(t / 2, 0, 1) : 0;
    for (const st of world.sky) {
      const dx = st.x - 0.5, dy = st.y - 0.48, k = 1 + sp * ((clock * 0.15 + st.tw) % 1) * 0.5;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(clock * 2 + st.tw);
      px(W / 2 + dx * W * k, H * 0.48 + dy * H * k, st.s, st.s * (1 + sp * 1.5), '#ffffff');
    }
    ctx.globalAlpha = 1;
    // Earth (half in shadow, as from the Moon), then the Moon's horizon in front
    const E = tourEarth(t);
    drawGlobe(E.x, E.y, E.r, clock * 0.05 + 0.4, 1, 0.3);
    // The Moon below you, turning slowly; as you lift off it drops away
    const lift = smooth(clamp(t / 2.8, 0, 1)), mr = Math.max(W, H) * lerp(0.85, 0.5, lift);
    drawMoonGlobe(W / 2, lerp(H * 0.74, H * 1.2, lift) + mr * 0.97, mr, clock * 0.04 - 0.2, lerp(-0.55, -0.2, lift));
    if (state === 'tour' && t > 1.4 && E.r < 70) { ctx.globalAlpha = clamp((t - 1.4) * 2, 0, 1); ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(160,210,255,0.9)'; ctx.fillText('EARTH', E.x, E.y - E.r - 12); ctx.textAlign = 'start'; ctx.globalAlpha = 1; }
    for (const f of FLYBY) drawFlyby(f, t);
    if (titleAlpha > 0) {
      ctx.save(); ctx.translate(0, -(1 - titleAlpha) * H * 0.4);
      drawComet(titleAlpha);
      ctx.restore();
      drawIntroText(titleAlpha, (1 - titleAlpha) * H * 0.4);
    }
  }

  function drawIntro() {
    if (state === 'tour') { drawTourScene(intro.tT, clamp(1 - intro.tT / 1.2, 0, 1)); return; }
    drawTourScene(0, 1);
    if (intro.ready && intro.t - intro.ready > 0.3 && Math.floor(intro.t * 1.8) % 2 === 0) {
      ctx.font = `${W < 480 ? 10 : 13}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1b1530'; ctx.fillText(touch ? 'TAP TO START' : 'CLICK OR PRESS SPACE', W / 2 + 2, H * 0.53 + 2);
      ctx.fillStyle = '#ffd23f'; ctx.fillText(touch ? 'TAP TO START' : 'CLICK OR PRESS SPACE', W / 2, H * 0.53);
      ctx.textAlign = 'start';
    }
  }

  // Zooming in on the real Earth: the globe fades into the game world, and
  // the black of space into the blue sky
  const zoomK = () => clamp(intro.dT / DESCEND, 0, 1);
  function drawIntroOverlay() {
    const z = cam.zoom, a = 1 - clamp((z - 0.3) / 0.3, 0, 1);
    const r = R0 * z;
    if (a > 0) drawGlobe(W / 2, H * 0.46 + r, r, clock * 0.05 + 0.4, a, 0.3);
    // The last satellites and the Moon, still flying past as you drop in
    const t = TOUR + intro.dT;
    for (const f of FLYBY) if (f.t > TOUR - 1) drawFlyby(f, t);
  }
  // Space, over the sky but under the world, until you're close in
  function drawIntroSpace() {
    const a = 1 - clamp((cam.zoom - 0.3) / 0.55, 0, 1);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#02030a'); bg.addColorStop(1, '#0b1030');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (const st of world.sky) px(st.x * W, st.y * H, st.s, st.s, '#ffffff');
    ctx.globalAlpha = 1;
  }

  function beginDescend() {
    if (state !== 'splash') return;
    state = 'tour';
    intro.tT = 0;
    if (snd) { snd.init(); snd.music.start(); snd.sfx.whoosh(); }
  }
  // After the flight: the zoom down to the ground (tap again to skip ahead)
  function beginZoom() {
    state = 'descend';
    intro.dT = 0;
    cam.r = R0; cam.anchor = 0.46; cam.zoom = zoomFrom();
  }

  function finishDescend() {
    state = 'title';
    cam.r = R0; cam.zoom = 1;
    document.body.classList.remove('intro');
    const t = $('title');
    t.hidden = false;
    t.classList.remove('fade-in'); void t.offsetWidth; t.classList.add('fade-in');
    if (typeof loadTitleBoard === 'function') loadTitleBoard();
    setTimeout(() => launchSecretStar(), 1200);
  }

  canvas.addEventListener('pointerdown', () => { if (fx.rings7 && state === 'play') { fx.rings7.wantJump = true; return; } if (state === 'splash') beginDescend(); else if (state === 'tour' && intro.tT > 0.5) beginZoom(); });
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
    stopped = false; $('carry-on').hidden = true;
    tilt.zero = null;
    // Level 5 starts from the belt world you reached at the end of level 3
    if (lv === 5) l5Start = (from && level === 3 && landedOn) || BELT_WORLDS.ceres;
    level = lv; route = null; landedOn = null; aimFor = null; flipK = 0; useTiers();
    document.body.classList.remove('run');
    reset(Math.floor(Math.random() * 1e9));
    carry = from;
    if (carry) { score = carry.score; mult = carry.mult; updateScoreHud(); }
    if (level === 1) rec().runs++;
    bests.last = mode; saveBests();
    state = 'play';
    $('title').hidden = true;
    $('won').hidden = true;
    document.body.classList.add('playing');
    if (level === 7) {
      banner('EUROPA', 'NEXT STOP: SATURN');
      toast("On Europa, deep in Jupiter's gravity. To reach Saturn you'll need a lift: bounce up to where a spacecraft swings by, and land on it. Miss it, and Jupiter's pull drags you back down.", 7);
    } else if (level === 6) {
      banner('THE HOLLOW EARTH?!', 'CLIMB BACK OUT');
      toast('Inside the hollow Earth, with a little sun at its middle. Nine caverns between you and daylight: walk to a mushroom to hop on, and mind the bats, the steam, the lava and the drills.', 7);
    } else if (level === 5) {
      banner(l5Start.name.toUpperCase(), 'NEXT STOP: JUPITER');
      toast(`${l5Start.name}, in the middle of the asteroid belt. Bounce up through the outer belt to the mass drivers: they'll fling you the rest of the way to Jupiter.`, 7);
    } else if (level === 4) {
      banner('VENUS', 'NEXT STOP: MERCURY');
      toast('A floating city in the clouds of Venus, 50 km up, where the air is mild. Mercury is up there, past the Sun\'s fury: when a flare is coming, get in the shade of something!', 7);
    } else if (level === 3) {
      banner('MARS', 'NEXT STOP: THE ASTEROID BELT');
      toast('Welcome to Mars. Behind you: Olympus Mons, the biggest volcano we know of, two and a half times as tall as Everest. To the right: a trampoline for each world in the belt. Pick one!', 7);
    } else if (level === 2) {
      banner('MOON BASE', 'MARS OR VENUS?');
      fx.dedication = 7;
      toast('Mars is to the right, Venus to the left. Walk up to a launch pad and you hop on. You float here: Moon gravity is a sixth of Earth\'s.', 6);
    } else if (mode === 'uber') toast('Uber Tramp: no checkpoints. Miss once and it is back to Earth.', 4.5);
    else toast(touch ? (tilt.on ? 'Tilt to walk. Walk up to a trampoline and you hop on.' : 'Walk up to a trampoline and you hop on. Tap TILT to steer by tilting.') : 'Walk up to a trampoline with ← → and you hop on.', 4.5);
    canvas.focus();
    try { navigator.wakeLock?.request('screen').catch(() => {}); } catch (e) { /* not available */ }
  }
  const L2_TIME_MEDALS = [[60, 'gold'], [90, 'silver'], [140, 'bronze']];
  const L3_TIME_MEDALS = [[90, 'gold'], [130, 'silver'], [190, 'bronze']];
  const L4_TIME_MEDALS = [[80, 'gold'], [120, 'silver'], [180, 'bronze']];
  const L5_TIME_MEDALS = [[90, 'gold'], [130, 'silver'], [190, 'bronze']];
  const L6_TIME_MEDALS = [[120, 'gold'], [180, 'silver'], [260, 'bronze']];
  const START_BODY = { 1: 'Earth', 2: 'the Moon', 3: 'Mars', 4: 'Venus', 6: 'the hollow Earth', 7: 'Europa' };
  const L7_TIME_MEDALS = [[100, 'gold'], [150, 'silver'], [220, 'bronze']];
  // go: carrying straight on into the next level, so no results screen
  // ---- Stop whenever you like ---------------------------------------------------
  // The whole game freezes where it is, and you get your score so far (the
  // whole trip, if you've come straight on from earlier worlds) to post, with
  // the choice to carry on exactly where you were.
  let stopped = false;
  function stopRun() {
    if (state !== 'play' || stopped || fx.climb || fx.burrow) return;
    stopped = true; state = 'won';
    keys.left = keys.right = false;
    document.body.classList.remove('playing');
    const list = routeStars(), got = list.filter((s) => s.taken).length, total = list.length;
    const c = carry || { time: 0, got: 0, total: 0, falls: 0 };
    const trail = [...(carry && carry.trail ? carry.trail : [level === 5 ? l5Start.name : START_BODY[level]])];
    lastRun = { mode, timeMs: (c.time + playTime) * 1000, stars: c.got + got, total: c.total + total, falls: c.falls + falls, score: Math.round(score) };
    lastWin = { time: c.time + playTime, got: c.got + got, total: c.total + total, falls: c.falls + falls, trail };
    const R = rec(), newScore = score > (R.bestScore || 0);
    if (newScore) { R.bestScore = score; saveBests(); }
    const where = fx.run ? layerName() : hud.layer.textContent.replace(/\s*×.*$/, '');
    $('won-title').firstChild.nodeValue = 'Stopped: ';
    $('won-dest').textContent = `${where}, ${hud.alt.textContent}`;
    $('won-mode').textContent = MODES[mode].name + (conspiracy ? ' · 👁 Conspiracy' : '') + ' · ' + trail.join(' to ');
    $('won-score').textContent = fmtScore(score);
    $('won-score-new').hidden = !newScore;
    $('won-stats').textContent = `Time ${fmtTime(c.time + playTime)} · geoms ${c.got + got} / ${c.total + total} · falls ${c.falls + falls}. Post your score as it stands, or carry on from right where you were.`;
    $('medals').innerHTML = '';
    for (const id of ['to-l2', 'to-l3', 'to-l4', 'to-l5', 'to-surface']) $(id).hidden = true;
    $('carry-on').hidden = false;
    $('again').textContent = 'Start this level again';
    offerPost();
    $('won').hidden = false;
    sfx.tier();
  }
  function carryOn() {
    if (!stopped) return;
    stopped = false; state = 'play';
    $('won').hidden = true; $('carry-on').hidden = true;
    document.body.classList.add('playing');
    last = performance.now();
    canvas.focus();
  }
  function win(go = false) {
    $('won-title').firstChild.nodeValue = 'You made it to ';
    buzz([30, 60, 30, 60, 90]);
    state = 'won';
    document.body.classList.remove('playing');
    const dest = destName();
    banner(level === 6 ? 'ESCAPED!' : dest.replace('the ', '').toUpperCase(), level === 6 ? 'OUT OF THE HOLLOW EARTH' : level === 7 ? "SATURN'S BIGGEST MOON" : level === 5 ? "JUPITER'S ICY MOON" : level >= 2 ? `${fmtKm(TIERS[TOP].km)}` : '384,400 km');
    fx.flash = 0.6;
    addShake(10);
    for (let i = 0; i < 5; i++) burst(-theta + (i - 2) * 0.004, player.r, ['#ffd23f', '#52e07a', '#e0433b', '#3f6fd8', '#ffffff'][i], 14, 300);
    sfx.win();
    const timeBonus = Math.max(0, Math.round(([0, 180, 240, 300, 300, 330, 400, 420][level] - playTime) * 100));
    const bonus = [0, 10000, 15000, 20000, 25000, 30000, 20000, 35000][level] + timeBonus;
    addScore(bonus);
    const list = routeStars();
    const got = list.filter((s) => s.taken).length, total = list.length;
    const medals = level === 7 ? L7_TIME_MEDALS : level === 6 ? L6_TIME_MEDALS : level === 5 ? L5_TIME_MEDALS : level === 4 ? L4_TIME_MEDALS : level === 3 ? L3_TIME_MEDALS : level === 2 ? L2_TIME_MEDALS : TIME_MEDALS;
    const tMedal = (medals.find(([limit]) => playTime <= limit) || [0, 'none'])[1], sMedal = starMedal(got, total);
    const R = rec();
    let newTime, best;
    if (level === 7) {
      const L = R.l7 = R.l7 || { wins: 0, bestTime: null };
      newTime = L.bestTime === null || playTime < L.bestTime;
      L.wins++;
      if (newTime) L.bestTime = playTime;
      best = L;
    } else if (level === 6) {
      const L = R.l6 = R.l6 || { wins: 0, bestTime: null };
      newTime = L.bestTime === null || playTime < L.bestTime;
      L.wins++;
      if (newTime) L.bestTime = playTime;
      best = L;
    } else if (level === 5) {
      const L = R.l5 = R.l5 || { wins: 0, bestTime: null };
      newTime = L.bestTime === null || playTime < L.bestTime;
      L.wins++;
      if (newTime) L.bestTime = playTime;
      best = L;
    } else if (level === 4) {
      const L = R.l4 = R.l4 || { wins: 0, bestTime: null };
      newTime = L.bestTime === null || playTime < L.bestTime;
      L.wins++;
      if (newTime) L.bestTime = playTime;
      best = L;
    } else if (level === 3) {
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
    const trail = [...(carry && carry.trail ? carry.trail : [level === 5 ? l5Start.name : START_BODY[level]]), dest];
    $('won-mode').textContent = MODES[mode].name + (conspiracy ? ' · 👁 Conspiracy' : '') + (carry ? ' · ' + trail.join(' to ') : '');
    lastRun = { mode, timeMs: (c.time + playTime) * 1000, stars: c.got + got, total: c.total + total, falls: c.falls + falls, score: Math.round(score) };
    lastWin = { time: c.time + playTime, got: c.got + got, total: c.total + total, falls: c.falls + falls, trail };
    if (go) return bonus;
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
      Europa: "NASA's Europa Clipper, launched in 2024, arrives in 2030 to find out whether Europa's hidden ocean could support life.",
      Mercury: "Mercury is the smallest planet and the closest to the Sun. With almost no air to hold heat, its days reach 430°C and its nights drop to -180°C.",
      Venus: 'Venus is the hottest planet: 465°C under clouds of sulfuric acid. Good thing you stopped in the clouds.',
    };
    const seen = level === 3 ? Object.keys(best.worlds).length : 0;
    $('won-stats').textContent = `Includes ${level === 6 ? 'an escape' : `a ${level >= 2 ? dest : 'Moon'}`} bonus of ${fmtScore(bonus)} x${mult}. `
      + (level === 7 ? "Titan is the only moon with a thick atmosphere, and the only other place we know of with lakes, rivers and rain. They're liquid methane, not water. NASA's Dragonfly drone is due to fly there in the 2030s."
        : level === 6 ? "You climbed out of the hollow Earth! Nobody will ever believe you. (Real Earth isn't hollow: earthquake waves show solid rock and metal all the way to its iron core.)"
        : level === 5 ? `${facts.Europa} You flew the whole way from the middle of the belt.${conspiracy ? ' ALL THESE WORLDS ARE YOURS EXCEPT EUROPA. ATTEMPT NO LANDING THERE. (Oops.)' : ''}`
        : level === 3 ? `${landedOn.note} That's the middle of the asteroid belt: you've landed on ${seen} of its 4 big worlds. Jupiter's next.`
        : level === 4 ? `${facts.Mercury} You outran the solar storms.`
        : level === 2 ? `${facts[dest]} For David Bowie, who looked up and made the rest of us look too.`
        : R.wins === 1 ? 'Your first trip to the Moon.' : newTime ? 'New best time!' : `Your best time is ${fmtTime(best.bestTime)}.`);
    $('to-l2').hidden = level !== 1;
    $('to-l3').hidden = !(level === 2 && route === 'mars');
    $('to-l4').hidden = !(level === 2 && route === 'venus');
    $('to-l5').hidden = level !== 3;
    $('to-l7').hidden = level !== 5;
    $('to-surface').hidden = level !== 6;
    $('again').textContent = level === 7 ? 'Start on Europa again' : level === 6 ? 'Fall in again' : level === 5 ? 'Start in the belt again' : level === 4 ? 'Start on Venus again' : level === 3 ? 'Start on Mars again' : level === 2 ? 'Start at the Moon again' : 'Bounce again';
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
      if (R.l4 && R.l4.wins) parts.push(`Mercury ${fmtTime(R.l4.bestTime)}`);
      if (R.l5 && R.l5.wins) parts.push(`Europa ${fmtTime(R.l5.bestTime)}`);
      if (R.l6 && R.l6.wins) parts.push(`Hollow Earth ${fmtTime(R.l6.bestTime)}`);
      el.innerHTML = parts.join(' · ');
    }
    // Level 2 opens up once you've reached the Moon in either mode
    $('l2-start').hidden = !(bests.checkpoint.wins || bests.uber.wins);
    // Level 3, and a shortcut straight to its asteroid belt, are always open
    document.querySelectorAll('.mode').forEach((btn) => btn.classList.toggle('last', btn.dataset.mode === mode));
  }
  renderBests();

  const jingle = () => { if (snd) { snd.init(); snd.sfx.jingle(mode); } };
  document.querySelectorAll('.mode').forEach((btn) => btn.addEventListener('click', () => { mode = btn.dataset.mode; jingle(); startGame(1); }));
  $('again').addEventListener('click', () => startGame(level));
  $('stop').addEventListener('click', (e) => { e.currentTarget.blur(); stopRun(); });
  $('carry-on').addEventListener('click', () => { jingle(); carryOn(); });
  $('to-l2').addEventListener('click', () => { jingle(); startGame(2, { score, mult, ...(lastWin || { time: 0, got: 0, total: 0, falls: 0 }) }); });
  $('l2-start').addEventListener('click', () => { jingle(); startGame(2); });
  $('to-l3').addEventListener('click', () => { jingle(); startGame(3, { score, mult, ...(lastWin || { time: 0, got: 0, total: 0, falls: 0 }) }); });
  $('l3-start').addEventListener('click', () => { jingle(); startGame(3); });
  $('to-l4').addEventListener('click', () => { jingle(); startGame(4, { score, mult, ...(lastWin || { time: 0, got: 0, total: 0, falls: 0 }) }); });
  $('l4-start').addEventListener('click', () => { jingle(); startGame(4); });
  $('to-l5').addEventListener('click', () => { jingle(); startGame(5, { score, mult, ...(lastWin || { time: 0, got: 0, total: 0, falls: 0 }) }); });
  $('l5-start').addEventListener('click', () => { jingle(); startGame(5); });
  $('to-l7').addEventListener('click', () => { jingle(); startGame(7, { score, mult, ...(lastWin || { time: 0, got: 0, total: 0, falls: 0 }) }); });
  $('l7-start').addEventListener('click', () => { jingle(); startGame(7); });
  $('l6-start').addEventListener('click', () => { jingle(); startGame(6); });
  // Out of the hollow Earth: back on the surface, carry on up to the Moon
  $('to-surface').addEventListener('click', () => { jingle(); startGame(1, { score, mult, ...(lastWin || { time: 0, got: 0, total: 0, falls: 0 }) }); });
  $('belt-start').addEventListener('click', () => { jingle(); startGame(3); toBelt(); });
  // Straight onto a mass driver: it charges and flings you into the run
  $('jupiter-start').addEventListener('click', () => {
    jingle(); startGame(5);
    const d = world.plats.find((q) => q.launch);
    theta = -d.a; lastTier = TOP; bestTier = TOP;
    player.r = d.R; player.onGround = true; cam.r = d.R; cam.anchor = 0.46;
    toastTimer = 0; hud.toast.hidden = true;
    startLaunch(d);
  });
  // Straight to the asteroid belt: drop onto the safe rock at the turn, where
  // the being of light is waiting with your force field
  function toBelt() {
    const keys = Object.keys(BELT_WORLDS);
    route = aimFor = keys[Math.floor(Math.random() * keys.length)];
    updateStarsHud();
    const rock = safeRock();
    if (!rock) return;
    theta = -rock.a;
    Object.assign(player, { r: rock.R, vr: 0, vx: 0, onGround: false, suit: true, g: rock.g, speed: speedFor(FLIP - 1), apexR: rock.R, lastPlat: null, lastH: 0 });
    lastTier = FLIP - 1; bestTier = FLIP - 1;
    cam.r = player.r; flipK = 0;
    land(rock); // the being gives you your force field, and off you go
    banner('THE ASTEROID BELT', `ON THE WAY TO ${BELT_WORLDS[route].name.toUpperCase()}`);
    toast(touch ? 'Straight to the belt! Gravity fades as you climb: find your way up through the asteroids.' : 'Straight to the belt! Gravity fades as you climb: find your way up through the asteroids.', 5);
  }
  // Back to the title: the Earth turns behind it again
  function toTitle() {
    stopped = false; $('carry-on').hidden = true;
    document.body.classList.remove('run');
    level = 1; route = null; flipK = 0; useTiers();
    reset(Math.floor(Math.random() * 1e9));
    state = 'title';
    setPadFlip(false);
    $('won').hidden = true;
    renderBests();
    loadTitleBoard();
    $('title').hidden = false;
    setTimeout(() => launchSecretStar(), 1200);
  }
  $('change-mode').addEventListener('click', toTitle);
  // The secret shooting star: it streaks across the title screen as it opens
  // (and now and then after). Click it for conspiracy mode.
  const secretStar = $('secret-star');
  function launchSecretStar() {
    if (state !== 'title' || $('title').hidden) return;
    secretStar.hidden = true; void secretStar.offsetWidth; secretStar.hidden = false;
  }
  secretStar.addEventListener('animationend', () => { secretStar.hidden = true; });
  setInterval(() => { if (Math.random() < 0.5) launchSecretStar(); }, 20000);
  function setConspiracy(on) {
    conspiracy = on;
    document.body.classList.toggle('conspiracy', on);
    $('conspiracy-tag').hidden = !on;
    $('l6-start').hidden = !on;
    if (snd) snd.music.conspiracy = on;
  }
  secretStar.addEventListener('click', (e) => {
    e.stopPropagation();
    secretStar.hidden = true;
    setConspiracy(!conspiracy);
    if (snd) { snd.init(); snd.sfx.jingle('uber'); }
    if (conspiracy) toast('👁 CONSPIRACY MODE. Tinfoil hat on. Keep an eye out for classified files on the way up… and for what\'s really true.', 6);
  });
  $('conspiracy-tag').addEventListener('click', () => setConspiracy(false));
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
  // Forward and back, for level 3 once the view has turned sideways: tip the
  // top of the screen away from you to go up, towards you to go down, like
  // rolling a marble across it
  function tiltReadingFB(e) {
    const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    if (angle === 90) return e.gamma;
    if (angle === -90 || angle === 270) return -e.gamma;
    if (angle === 180) return -e.beta;
    return e.beta;
  }
  const tiltAxis = (d, dead = 3, full = 18) => (Math.abs(d) < dead ? 0 : Math.sign(d) * clamp((Math.abs(d) - dead) / (full - dead), 0, 1));
  function onTilt(e) {
    if (e.gamma == null) return;
    tilt.got = true;
    const v = tiltReading(e);
    if (tilt.zero === null) tilt.zero = v;
    tilt.axis = tiltAxis(v - tilt.zero);
    // The way you're holding the phone when the view turns counts as level
    const fb = tiltReadingFB(e);
    if (fb == null) return;
    if (tilt.zeroFB === null) tilt.zeroFB = fb;
    tilt.fb = tiltAxis(fb - tilt.zeroFB);
  }
  function stopTilt(msg) {
    window.removeEventListener('deviceorientation', onTilt);
    tilt.on = false; tilt.axis = 0; tilt.fb = 0;
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
    toast(level === 3 && flipK > 0.5 ? 'Tilt on. Hold the phone comfortably, then tip it forward or back to steer.' : 'Tilt on. Hold the phone comfortably, then lean it left or right to steer.', 4);
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
    if (on) { tilt.zeroFB = null; tilt.fb = 0; }
    for (const [key, a, b, la, lb] of [['left', '◀', '▲', 'Walk left', 'Steer up'], ['right', '▶', '▼', 'Walk right', 'Steer down']]) {
      const btn = document.querySelector(`.pad [data-key="${key}"]`);
      if (btn) { btn.textContent = on ? b : a; btn.setAttribute('aria-label', on ? lb : la); }
    }
  }
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!$('board').hidden) return;
    if (e.code === 'Escape') { if (state === 'play') stopRun(); else if (stopped && !mustPost) carryOn(); e.preventDefault(); return; }
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
      if (fx.rings7 && state === 'play') { fx.rings7.wantJump = true; return; }
      if (state === 'splash') { if (!e.repeat) beginDescend(); return; }
      if (state === 'tour') { if (!e.repeat && intro.tT > 0.5) beginZoom(); return; }
      if (state === 'descend') return;
      if (state === 'won' && mustPost) return; // post your score first
      if (stopped && !$('won').hidden) { if (!e.repeat) carryOn(); return; }
      if (state === 'title') { if (!e.repeat) { jingle(); startGame(1); } return; }
      if (state === 'won' && !$('won').hidden) { if (!e.repeat) { jingle(); startGame(level); } return; }
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
      keys[k] = true;
    };
    const up = () => { btn.classList.remove('on'); keys[k] = false; };
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
    if (!stopped) update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // Hot reload support when hosted as an artifact; harmless elsewhere.
  function snapshot() {
    return { seed: world.seed, state, level, route, aimFor, theta, lastTier, bestTier, playTime, checkpoint, falls, mode, score, mult, player: { ...player, lastPlat: null }, taken: world.stars.filter((s) => s.taken).map((s) => s.id) };
  }
  function start(data) {
    resize();
    if (data && data.level >= 2) { level = data.level; route = data.route || null; aimFor = data.aimFor || route; useTiers(); }
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
      if (data.conspiracy) setConspiracy(true);
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
    if (window.claude?.hot) window.claude.hot.peek = () => ({ world, theta, route, level, TOP, state, score, mult, shield: player.shield, field: player.field, flipK, player, aimFor, fx });
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
