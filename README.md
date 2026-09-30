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

The repo deploys itself to GitHub Pages on every push to `main`
(`.github/workflows/pages.yml`). Once Pages is switched on, the game lives at
`https://shawhir.github.io/InterstellarSuperTramp/`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**,
then re-run the "Deploy to GitHub Pages" workflow (or push anything). GitHub Pages
on a private repo needs a paid GitHub plan; on a free plan, make the repo public.

On the phone, open the link and use **Add to Home Screen** (Safari: Share button;
Chrome: ⋮ menu). It then launches full screen with its own icon, like an app.

| Action | Keys | Touch |
|---|---|---|
| Walk / steer | ← → or A D | ◀ ▶ |
| Hop | Space, ↑ or W | HOP |

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
- Three mountain ranges sit behind the ground and turn more slowly than it
  (parallax), so they feel further away.
- `style.css`: HUD, overlays and the touch pad.
