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
| Hop | Space, ↑ or W | HOP |

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
- Intro: a comet streaks through a rushing starfield and the title peels off its
  tail; tap to fall from space down to Earth, then the menu fades in with the top
  scores. On the menu the tramp hops along the logo (with the odd backflip off the
  end letter), and each mode plays its own jingle when picked.
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
- Re-entry (every level): miss and fall below the platform you bounced off, and the tramp
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
- **Mars orbit.** Bounce off Phobos and Deimos, then past a Mars trojan and the
  Dawn probe, with 3I/ATLAS flying by.
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
  pebbles (OSIRIS-REx saw Bennu doing it). And every minute or so a solar
  flare: there's no magnetic field out here to shield you, so when the
  countdown starts, get under an asteroid. Caught in the open, it costs a
  force-field charge, or your multiplier.
- **A light freighter and a space slug.** Partway up each route is a huge
  asteroid with a cave in it. Every so often a battered light freighter bolts
  out of the cave, with a giant space slug lunging out after it.
- **Sci-fi nods along the way:** mining rigs and claim flags, mining lasers
  fired by drones, an ice hauler to land on for an ice shield, a belter
  outpost with a spinning ring, and a Kirkwood gap.
- **Ambience.** In the belt the music changes to its own pulsing groove with
  pinball bleeps, and asteroids drift past in three layers of distance,
  lit by the Sun and glinting now and then, with dust in between. Only Ceres is officially a dwarf planet in the belt (Hygiea may join
  it); Vesta and Pallas are the next biggest. Each has its own fact, and the
  title screen counts how many of the four you've visited.

A run straight from Earth to the belt goes on the scoreboard as one run.

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
