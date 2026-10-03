# Interstellar SuperTramp

A little pixel game. The tramp walks on the spot at the top of the world while the
planet turns under their feet, with Earth shown in cross-section (crust, mantle,
outer core, inner core). Hop onto a trampoline and bounce upward from cloud to
weather balloon to satellite to asteroid until you land on the Moon, collecting
stars on the way.

The arrow under the tramp's feet points to the next bouncy thing. It turns green
and points down when you are lined up to land on it.

## Play

Open `site/index.html` in a browser. There's no build step and nothing to install.

### On your phone

The game is live at **https://shawhir.github.io/InterstellarSuperTramp/**.
GitHub Pages serves the `gh-pages` branch; `.github/workflows/pages.yml` copies
everything in `site/` there on every push to `main`, so changes go live a minute or two
after they are pushed.

On the phone, open the link and use **Add to Home Screen** (Safari: Share button;
Chrome: ⋮ menu). It then launches full screen with its own icon, like an app.

| Action | Keys | Touch |
|---|---|---|
| Walk / steer | ← → or A D | ◀ ▶, or tap TILT and lean the phone |
| Hop on | walk up to a trampoline or launch pad and you hop on by yourself | |

Tilt steering uses the phone's motion sensor. The angle you hold the phone at when
you switch it on counts as level. It works when the game is opened from its own web
address (GitHub Pages); embedded previews usually block motion sensors, and the game
says so if that happens.

## How it works

- `site/game.js`: everything lives in polar coordinates around Earth's centre. The
  player is fixed at the top; walking changes `theta`, the angle the whole world
  has turned, so the ground and every platform slide past underneath.
- Each bouncy layer (tier) sits at a fixed height and bounces you just high enough
  to reach the next one. The altimeter maps those tiers to real altitudes
  (clouds to 12 km, balloons to 40 km, the Kármán line at 100 km, the ISS at
  408 km, GPS at 20,200 km, the Moon at 384,400 km).
- Difficulty ramps up with every step: the first trampoline bounces at 1.01x speed
  and it builds evenly to 2x by the last jump before the Moon. Bounce heights stay
  the same, but faster bounces leave less time to steer; the HUD shows the current
  multiplier. Gaps between platforms shrink a little as it speeds up, so every jump
  stays possible.
- Five mountain ranges sit behind the ground and turn more slowly than it
  (parallax), so they feel further away. They also sink more slowly than the
  ground as you climb, so the first few bounces reveal the far ranges behind,
  before they fade into the haze on the way to space.
- `site/audio.js`: every sound is synthesised with the Web Audio API, no audio files.
  Bounces climb a pentatonic scale as you go higher; the chiptune soundtrack shifts
  from a bouncy major tune near Earth, to a brighter lead in the sky, to a slow
  minor drift with echo in space, and speeds up with the bounce multiplier.
  Music and sound effects have separate on/off buttons.
- Intro: on the Moon, drawn as a pixel globe from a real map: the dark seas
  in their true places (Ocean of Storms, Sea of Rains, Sea of Tranquillity,
  Sea of Crises and the rest), big craters like Tycho and Copernicus with
  their bright rays, and the seas labelled, with the Apollo 11 site marked.
  It turns slowly beneath you as Earth rises over its edge. Tap and you lift
  off and fly to Earth, past the Space Station and satellites, and straight
  in: the globe becomes the game world as space fades to blue sky. Tap during
  the flight to skip to the zoom.
- Arriving at a new world (the Moon, Mars, Venus, Mercury, the belt worlds,
  and daylight at the end of the hollow Earth): after you've watched it grow
  in the sky, its gravity grabs you as you get close, swinging you over and
  pulling you down onto it faster and faster. There's no change of scene: the
  little world you touch down on is the next level's world seen from far off,
  and it swells under your feet into the landscape you play on, while the old
  view (home, now overhead) turns upside down and fades away. You carry
  straight on with that world's own gravity, the score carried on and the
  whole trip counted as one run. Mercury and Europa are the ends of the line,
  with a results screen: at Mercury the view turns over behind the Sun's
  glare and you land on its real landscape and plant a flag.
- Hopping on: walk up to a trampoline or launch pad and you hop on in one
  smooth arc that lands you on its middle.
- Juice: screen shake on landings, squash and stretch, afterimage trail, landing
  rings, PERFECT! for centre landings, streak counter, layer banners, speed lines,
  a sun, drifting clouds, aurora, shooting stars.
- The Moon is one object for the whole climb: a speck in the sky near Earth that
  grows as you rise, drifts toward the side it really lies on, and over the last
  few layers glides into place as the surface you land on.
  Screen shake and speed lines switch off for reduced-motion settings.
- Replay hooks: personal records (best time, most stars, highest point, runs) are
  saved on the device and shown on the title screen, with a gold marker on the
  journey rail at your best height and a NEW HEIGHT RECORD pop when you pass it.
  Two modes, chosen on the title screen, each with its own records and medals:
  **Checkpoint** (green flags at the start of each new part of the sky; once you've
  landed on one, a miss above it catches you there) and **Uber Tramp** (no
  checkpoints: any miss drops you all the way back to Earth). Each Moon landing awards medals for time (gold under 0:30, silver
  under 0:45, bronze under 1:15, first guesses to tune), stars (all, two thirds,
  a third) and falls (gold for none).
- Rebound: fall from higher up onto a lower platform and the first bounce throws
  you back to the height you fell from; each repeat bounce on that platform
  halves the extra height until it is back to the normal bounce.
- Clouds wobble like jelly when you land (squash, overshoot, settle), breathe
  gently while idle, and throw off soft puffs.
- Around-the-world rides: the jet stream (about 10 km) and the Space Station
  (408 km) carry you halfway round the planet while the camera pulls out to show
  the Earth turning below; the next layer's platform waits on the far side. If
  you fall off, the ride goes back to fetch you. Hitting the Space Station docks
  you inside: it carries you round the world while you suit up, then the airlock
  launches you out in a spacesuit, worn for the rest of the space section.
- Zero gravity tumble: out in space (past the Kármán line on Earth, anywhere
  off the Moon, and above Mars's thin sky) nothing keeps the tramp upright, so
  it somersaults slowly on the way up and rights itself on the way down to land
  feet first.
- Re-entry (every level except inside the asteroid belt): miss and fall below the platform you bounced off, and the tramp
  heats up into a fireball (glow from 100px below it, full fire by 500px) with a
  flame trail and a rising roar. Hit the ground like that for a KABOOM: big screen
  shake, flash, shockwave, flying dirt and a smoking crater. Land on a platform
  instead and it goes out in a hiss of steam.
- Score and multiplier, Geometry Wars style: bounces, PERFECT landings, new
  layers, rides and the Moon (plus a time bonus) earn points, all multiplied.
  The stars are green geoms: they drift to you when you're close and each adds +1
  to the multiplier; PERFECT landings and new layers burst out extra geoms that
  fade after a few seconds. Any miss resets the multiplier to x1.
- `site/scoreboard.js`: shared scoreboard of fastest Moon landings per mode (see below).
- `site/style.css`: HUD, overlays and the touch pad.

## Level 2: the Moon to Mars or Venus

Reach the Moon and you can carry straight on (your score comes with you), or
start level 2 from the title screen once you've landed there once.

- **The Moon base.** You start below a base drawn in a clean flat vector style,
  standing as one group on a flat stretch of the distant horizon under a big
  Earth: a rocket on its pad between two boosters, domes, a dish, a railing,
  a tall twin tower and a lander hovering overhead. The Moon is shown in cross-section
  like Earth: crust with pale highland rock, polar ice, meteorite iron, orange
  volcanic glass and lava tubes; a cold mantle with moonquake cracks; a partly
  molten layer; and a small iron core. On the surface: Apollo 11's landing
  site, a rover and its tracks, a radio telescope, solar arrays, a greenhouse,
  a lander and a mining rig. Behind, three rings of plain step back in
  distance with a few craters on them.
- **Two routes.** The launch pad on the right heads for Mars, the one on the
  left for Venus. Once you pick, the other route turns into see-through ghosts.
- **Gravity.** Lower than Earth's, so you float (softened from the real values
  to keep it playable). Venus pulls harder as you get close.
- **Solar flares on the way to Venus.** Heading sunward, where flares are
  fiercest, a flare comes every half minute or so: a warning and countdown,
  then the blast. Be under a rocket or an asteroid when it hits, or lose your
  multiplier.
- **Hazards.** Flaming meteors (with a warning at the screen edge), the solar
  wind pushing you sideways, dust clouds that sandblast you if you linger, and
  radiation bursts that flicker before they fire. Each costs your multiplier.
- **Rides.** On the Mars route, Lumen the roadside drifter cruises past in his
  old convertible: land on it for a headlight shield and a slingshot. On the
  Venus route, hitch a ride on comet Borisov.
- **Real things out there.** Kamo'oalewa, Cruithne, 'Oumuamua, 3I/ATLAS, Phobos,
  a Mars meteorite, Venera 7, and a city in Venus's clouds at the end.
- Dedicated to David Bowie, who looked up and made the rest of us look too.
- **Mars's moons.** On the Mars route, Phobos and Deimos circle Mars in the sky
  as it grows, then fade as it glides in to become the ground.

## Level 3: Mars to the asteroid belt

Land on Mars in level 2 and you can carry straight on (score and all), or start
level 3 from the title screen. There's also a "Straight to the asteroid belt"
button that drops you onto the safe rock at the start of the belt.

- **Mars.** Shown in cross-section with its thin crust, thick mantle and big
  liquid iron core, under a butterscotch sky (Mars has a thin carbon dioxide
  atmosphere). Behind the base stand the great shield volcanoes, labelled:
  Olympus Mons, the three Tharsis Montes and Elysium Mons, plus the rift of
  Valles Marineris. Phobos races across the sky the "wrong" way; Deimos drifts.
  Earth hangs in the sky as a blue evening star with the Moon beside it.
- **The saucer field.** Nine flying saucers, and big-brained Martians in glass
  bubble helmets, with bug eyes, toothy grins and ray guns. When you first
  come near (or after a while) they hop one by one into their saucers, lift
  off together and fly off in convoy towards Earth, getting smaller until
  they sink behind the far horizon. Once per trip.
- **Four trampolines, four routes.** A colour-coded trampoline sits a quarter
  of the way round Mars from the next, one for each big world in the belt:
  Ceres, Vesta, Pallas and Hygiea. The one you bounce from picks your route
  (the others fade to ghosts), and each route has its own climb, its own turn
  and safe rock, and its own passage through the belt to its world: wide and
  calm to Ceres, narrow with mining lasers to Vesta, slanting to Pallas (the
  tilted one), and dark, gappy and full of rogue asteroids to Hygiea.
- **Robots on Mars.** Perseverance and Curiosity drive about, Ingenuity hovers,
  and Zhurong sits where it went to sleep. Walk past one to hear its story.
  There's also the Face on Mars, and a greenhouse full of potatoes.
- **The air.** Mars's first bouncy layers are thin water-ice clouds and a dust
  storm. Fall back towards it and you come in as a fireball and hit the
  ground in a red KABOOM.
- **Mars orbit.** Bounce off Phobos, Deimos and the Martians' flying saucers,
  then past a Mars trojan and the Dawn probe, with 3I/ATLAS flying by.
- **The safe rock.** Halfway out, each route reaches a broad, steady safe rock
  where a being of light hums five notes and gives you a force field (it takes
  five hits from rogue asteroids; geoms charge it back up). It appears again
  at the belter outpost to top you up.
- **The asteroid belt.** Above the safe rocks the belt is a ring right round
  Mars. There's hardly any gravity, and it fades further the higher you go:
  nothing pulls you back to Mars. Asteroids of all sizes, all spinning, are
  scattered at random through its whole depth (no walls: find your own way
  up), and the four worlds sit among them, a little way round from the top of
  each route's climb. An arrow at the edge of the screen points round to your
  world; touch any of the four to land.
- **The journey through the belt.** It's thick with asteroids, and each
  region looks different as you climb: pale stony rock and the mining zone in
  the inner belt, the sparse Kirkwood gap, a mix with shiny metal asteroids in
  the main belt, and dark carbon-rich rock and ice in the outer belt. Higher
  up, more asteroids drift from side to side and more are cracked: those
  crumble just after you bounce off them (they re-form later).
- **Mining.** Each route passes a refinery of the Belt Mining Co. (silos, a
  conveyor of ore, a crane, steam), and there are mining rigs on asteroids,
  drones ferrying ore between them, and drill drones cutting into rock.
- **Snakes and ladders.** Grabber robots up in the belt grab you and drag you
  all the way back down to the refinery; ore lifts lower down carry you up
  four layers.
- **Pinball.** Some asteroids are neon bumpers (glowing rims, chasing lights)
  that fling you off faster than you came in, and there are red and yellow
  pop bumpers too.
- **Too far.** Float out past the top of the ring and you drift off into
  space, until a passing ship on an Infinite Improbability Drive picks you up:
  in Checkpoint mode it drops you back where you were, in Uber Tramp back on
  Mars (never game over).
- **Hazards, now and then.** A rogue asteroid tumbles across, and every so
  often two asteroids collide nearby (a warning first): the blast of debris
  shoves you the other way. Real asteroid families are the pieces of old
  collisions.
- **Real belt dangers, kept rare.** Some asteroids have little moons going
  round them (like Dimorphos round Didymos, which NASA's DART hit in 2022):
  solid, so time your way past. Loose, fast-spinning rubble piles throw off
  pebbles (OSIRIS-REx saw Bennu doing it).
- **A light freighter and a space slug.** Partway up each route is a huge
  asteroid with a cave in it. The first time you come by, a battered light
  freighter bolts out with a giant space slug lunging after it, and gets clean
  away with a jump to lightspeed. After that the slug lurks, eyes glowing in
  the dark, and lunges if you come close: get bitten and it takes a fifth of
  your score.
- **Sci-fi nods along the way:** mining rigs and claim flags, mining lasers
  fired by drones, an ice hauler to land on for an ice shield, a belter
  outpost with a spinning ring, and a Kirkwood gap.
- **Ambience.** In the belt the music changes to its own pulsing groove with
  pinball bleeps, and asteroids drift past in three layers of distance,
  lit by the Sun and glinting now and then, with dust in between. Only Ceres is officially a dwarf planet in the belt (Hygiea may join
  it); Vesta and Pallas are the next biggest. Each has its own fact, and the
  title screen counts how many of the four you've visited.

- **No fireballs in the belt.** Out in the belt there's next to no pull back
  towards Mars, so on the way down you soon slow to a gentle sink. Only a hard
  knock gets you moving down fast, and even that soon slows. Nothing heats up.
- **The belt worlds are halfway.** Ceres, Vesta, Pallas and Hygiea sit in the
  middle of the belt, with more of it beyond them. Landing on one ends level 3,
  and you can carry on to Jupiter in level 5.

A run straight from Earth to the belt goes on the scoreboard as one run.

## Level 4: Venus to Mercury

Land on Venus at the end of level 2 and you can carry straight on (score
and all) towards the Sun, or start here from the title screen.

- **Cloud city.** You start on the cloud tops of Venus, 50 km up, among
  floating domes, balloons, solar panels and an airship named for NASA's
  HAVOC study. Below, Venus is shown in cross-section: the clouds, the
  scorching 465°C air, the crust with its lava, the mantle and the iron core.
- **Solar flares are the main obstacle.** Every 7 to 17 seconds, and more
  often the closer you get to the Sun, a flare is announced with a countdown.
  While it counts down, blue strips show the shadow each platform casts away
  from the Sun. Be in one when it hits (or standing on something) and you get
  SHELTERED, worth 500. Caught in the open and you're FRIED: the multiplier
  resets and the blast knocks you back down.
- **Coronal mass ejections.** Every fourth storm past halfway is a CME: a
  longer countdown and a swelling wall of plasma. Shelter is worth 2,000, but
  if it catches you, it hurls you a long way down.
- **Sunshades.** White-topped sunshades, like Parker Solar Probe's heat
  shield, give the widest shade. Radiation beams and the solar wind return
  from level 2.
- **The Sun grows** as you climb, with prominences on its edge that writhe
  harder before a flare. Mercury, grey with its Caloris Basin, glides in as
  the landing. Facts along the way cover Parker Solar Probe, BepiColombo,
  MESSENGER's polar ice, and the extremes of Mercury's days and nights.

## Level 5: the outer belt to Jupiter and Europa

Land on a belt world at the end of level 3 and carry straight on (score and all),
or start from the title screen (you start on Ceres).

- **The outer belt.** Start on the world you reached, shown in cross-section:
  Ceres with its muddy, salty mantle, Vesta with its iron core. Ceres has
  Occator's bright salt spots, the ice volcano Ahuna Mons, and Dawn still
  circling overhead, switched off. Bounce up through a ring of dark,
  carbon-rich asteroids with pinball and pop bumpers between them. As in the
  rest of the belt, there's no fireball and sinking back down is slow.
- **Mass drivers.** About a third of the way through the rest of the belt,
  the miners' magnet rails fling you on. From there it's a run: you fly
  forward, slowly at first through empty space, until Jupiter's gravity picks
  you up and pulls you in faster and faster (your speed shows in km/s, and
  rings of its pull slide in towards it). Near the end the stars, dust and
  speed lines stream past faster than a fireball fall to Earth, with warp
  streaks pouring out of Jupiter, and you hit its air as a roaring fireball. A
  green marker at the top shows where the next band's gap is. Bands of asteroids
  stretch right across the way, each with a gap: through cleanly and your
  multiplier goes up, and every 5 in a row is a streak bonus; clip one and it
  costs you points. The bands spread out as you speed up, so there's always
  time to react. On the way: the outer
  belt, the Hilda asteroids, drifting bands of comet pieces (like
  Shoemaker-Levy 9) and Jupiter's radiation belts. During the run, messages
  sit in a slim strip at the bottom and banners are see-through, so nothing
  hides what's coming.
- **Through Jupiter.** Jupiter grows ahead the whole way. When you reach it,
  a force field comes on and you go straight in: through the cloud tops,
  lightning, liquid hydrogen (where it may rain diamonds) and the metallic
  hydrogen at the middle, then out the other side. Storms and lightning
  weaken the field, and what's left is bonus points.
- **Europa.** You land on its ice: double ridges, chaos terrain, a water
  plume on the horizon and Jupiter huge in the sky. Then you go down a crack,
  through the ice shell (probably 15 to 25 km thick) and into the ocean
  beneath, steering for glowing geoms, to the hot vents on the seafloor and
  some imagined life. Facts on the way cover Lucy and the asteroid
  Dinkinesh's moon, the Hildas, Jupiter's insides, Europa's ocean and Europa
  Clipper (launched 2024, arriving 2030).

## Secret: conspiracy mode

When the menu opens, a shooting star streaks across it (and again now and
then). Click or tap it to switch on conspiracy mode; a green tag in the corner
switches it off. You get:

- a tinfoil hat;
- its own music: an eerie, wavering, theremin-like tune over a slow pulse and
  a ticking clock;
- props: a flat-earther's placard and a suspicious bird on Earth, a film set
  with lamps, a camera and a director's chair at the Moon base, and the Face on
  Mars;
- "classified files" on the way up: a famous conspiracy theory, followed by
  what's really true (the Moon landings, chemtrails, Nibiru, Mercury in
  retrograde, and more);
- **level 6, the hollow Earth.** On level 1, crash into Earth as a fireball and
  you smash straight through the crust, score and all. (Or pick "Secret: the
  hollow Earth" on the menu.) It's a round world inside the world: a little
  "inner sun" at the centre, and nine caverns in rings round it, each walled
  off from the next by a shell of rock with a way through. Climb out, from the
  inside, through:
  - **Pellucidar** (Edgar Rice Burroughs), with dinosaurs and flying Mahars;
  - **the Lidenbrock Sea** (Jules Verne), with sea monsters and underground
    waterfalls;
  - **Agartha**, the golden city of the conspiracy theories;
  - **the crystal caves**, with shattering crystals and glow-worms;
  - **the fungus forest**, with giant mushrooms and an olm in a pool;
  - **the Morlock works** (H.G. Wells), with factory chimneys, wells, glowing
    eyes and steam vents;
  - **the lava tubes**, with lava jets and lava falls;
  - **Lizard city**, with neon towers, lizard people in suits, and drill
    machines (a nod to Burroughs' Iron Mole);
  - **the way out**, with roots, bats and daylight.

  Nothing floats without a reason: mushrooms, tree ferns and crystals grow up
  from the floor, girders and lava rock stand on struts and columns, rafts and
  ledges hang on ropes and roots, and Agartha's golden discs hover on the glow
  of vril. Each cavern's floor is a crust of its own, right round: land on it, walk
  about, and drop through its gap into the cavern below if you wander in.
  On every floor stands a whole town (a back row for depth, then the front
  row), with its people and creatures walking about: dinosaurs and gorilla-like
  Sagoths, Verne's giant shepherd and his mastodons, robed Agarthans under a
  hovering saucer, salt miners with headlamps, villagers and their goats,
  lantern-carrying Morlocks, mine carts full of opals, and lizard people in
  suits. They jump in surprise when you land near them.

  Real places underground are there too; stand by one to hear about it:
  Hang Son Doong (a cave with its own jungle and clouds), Derinkuyu (a rock-cut
  city 85 m deep), St Kinga's Chapel (carved from salt), Coober Pedy's dugouts,
  and Beijing's Cold War tunnel city.

  Behind each cavern are its own far-off walls in two parallax layers: jungle,
  sea cliffs and waterfalls, golden towers, giant crystals, giant mushrooms,
  smoking factories, volcanoes, skyscrapers with neon cables, tunnel mouths.
  Each is drawn only inside its own cavern, so they blend as you climb from
  one to the next.

  For juice: each cavern's floor lights its cavern, and light pours down
  through the gaps. Fireflies, spores, embers, sparkles and steam drift
  about, landings burst in the cavern's colours, a sparkle trail follows you
  up, and reaching a new cavern sets off fireworks. Floating islands carry
  more buildings, creatures and waterfalls next to the way up. Real facts and classified
  files come on the way. Checkpoints, geoms, medals and records work as on
  the other levels, and from the finish you can carry your score back up to
  the Moon.
- On Europa, a black monolith (a nod to Arthur C. Clarke's *2010*).

## Online scoreboard

The scoreboard lists the highest scores reaching the Moon for each mode (ties go to the faster run), best run per name.
It lives in `site/scores.json` in this repo; the **Record a score** workflow
(`.github/workflows/score.yml`, checks in `.github/scripts/record_score.py`) adds
runs to it and republishes the site. Runs reach it in one of two ways:

- **With just a name (no GitHub account)**, through a small free Cloudflare
  Worker (`worker/score-worker.js`). The Worker holds a private GitHub token,
  checks the run, filters rude names, limits posting to once every 20 seconds per
  player, and hands the run to GitHub. Set up once as below.
- **With a GitHub account**, through a pre-filled GitHub issue (the name is the
  player's GitHub username). This is what the game uses until the Worker is set
  up, and stays available as "Or post with your GitHub account".

The claude.ai artifact version keeps its own board in the artifact's shared storage.

### Setting up the Cloudflare Worker (once, about 10 minutes)

1. **Make a GitHub token for the Worker.** Go to
   https://github.com/settings/personal-access-tokens/new and choose:
   - Token name: `SuperTramp scores`; Expiration: up to a year
   - Repository access: **Only select repositories** → `InterstellarSuperTramp`
   - Repository permissions → **Contents: Read and write** (nothing else)

   Click **Generate token** and copy it (it starts with `github_pat_`).
2. **Create the Worker.** Sign up free at https://dash.cloudflare.com, then
   **Workers & Pages → Create → Create Worker**. Name it `supertramp-scores` and
   click **Deploy**.
3. Click **Edit code**, replace everything with the contents of
   `worker/score-worker.js` from this repo, and click **Deploy**.
4. **Add the token.** In the Worker, go to **Settings → Variables and Secrets →
   Add**: type **Secret**, name `GITHUB_TOKEN`, value = the token from step 1.
   Save / deploy.
5. Copy the Worker's address (like `https://supertramp-scores.<you>.workers.dev`)
   into `workerUrl` in `site/scoreboard-config.js` and push. The Moon screen then asks
   for a name.

Opening the Worker's address in a browser should show
`{"ok":true,"service":"Interstellar SuperTramp scores"}`.

With no login, anyone can type any name or try to fake a time. Impossible numbers
are rejected, and an owner can delete a line from `site/scores.json` by hand.

### Optional: Supabase instead of GitHub

Scores can live in a free Supabase database instead of this repo:

1. Create a project at https://supabase.com.
2. In its **SQL Editor**, run:

   ```sql
   create table public.scores (
     id bigint generated always as identity primary key,
     name text not null check (char_length(name) between 1 and 16),
     mode text not null check (mode in ('checkpoint', 'uber')),
     time_ms integer not null check (time_ms between 5000 and 3600000),
     stars integer not null check (stars between 0 and 200),
     total_stars integer not null check (total_stars between 1 and 200),
     falls integer not null default 0 check (falls between 0 and 1000),
     score integer not null default 0 check (score between 0 and 50000000),
     created_at timestamptz not null default now()
   );
   alter table public.scores enable row level security;
   create policy "Anyone can read scores" on public.scores for select using (true);
   create policy "Anyone can add a score" on public.scores for insert with check (true);
   ```

3. Copy the **Project URL** and **anon public** key from **Project Settings → API**
   into `site/scoreboard-config.js` and push. Players then type a nickname instead.
