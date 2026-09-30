# Interstellar SuperTramp

A little pixel game. The tramp walks on the spot at the top of the world while the
planet turns under their feet, with Earth shown in cross-section (crust, mantle,
outer core, inner core). Hop onto a trampoline and bounce upward from cloud to
weather balloon to satellite to asteroid until you land on the Moon, collecting
stars on the way.

The arrow under the tramp's feet points to the next bouncy thing. It turns green
and points down when you are lined up to land on it.

## Play

Open `index.html` in a browser. There's no build step and nothing to install.

### On your phone

The game is live at **https://shawhir.github.io/InterstellarSuperTramp/**.
GitHub Pages serves the `gh-pages` branch; `.github/workflows/pages.yml` copies
the game files there on every push to `main`, so changes go live a minute or two
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

- `game.js`: everything lives in polar coordinates around Earth's centre. The
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
- `audio.js`: every sound is synthesised with the Web Audio API, no audio files.
  Bounces climb a pentatonic scale as you go higher; the chiptune soundtrack shifts
  from a bouncy major tune near Earth, to a brighter lead in the sky, to a slow
  minor drift with echo in space, and speeds up with the bounce multiplier.
  Music and sound effects have separate on/off buttons.
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
- `style.css`: HUD, overlays and the touch pad.
