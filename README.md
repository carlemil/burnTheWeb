# burnTheWeb

A classic demoscene **fire effect** whose flames are seeded by an animated
**Sierpiński fractal** — either a 2D triangle or a 3D tetrahedron. A chaos-game
point cloud stamps the fractal into the fire as fresh heat every tick, so the
whole thing burns, flickers, and morphs continuously.

🔥 **Live demo:** https://carlemil.github.io/burnTheWeb/

## Effects

An **Effect** selector at the top of the panel switches between three visuals
that share the same palette, auto-morph and glow pipeline:

- **Sirpinfyer** — the classic 2D Sierpiński-**triangle** fire described below.
- **Tetrafyer** — the same fire seeded by a 3D Sierpiński **tetrahedron** that
  is a rigid body **bouncing inside a rubbery box** in front of a fixed camera.
  Each of the four corners collides with the walls under impulse-based physics
  (isotropic inertia, near-elastic restitution), so a corner-hit realistically
  kicks the solid into a tumble; hits send a fading ripple across the wall they
  struck. The chaos game runs in 3D between the physics-driven vertices and is
  perspective-projected, and a slow orbit shows the box as solid 3D.
- **AnimeJulia** — an animated Julia set. The seed `c` is orbited around the
  Mandelbrot plane along two stacked loops: a large slow loop tracing just
  outside the inner bound (the main cardioid, pushed slightly outward) so the
  Julia set stays intricate, plus a much smaller, faster circle riding on top
  that only ever nudges the seed further out — never into the interior. The big
  loop turns at ~0.05 rpm, the small one a fair bit faster, so the fractal
  reshapes continuously. Per-pixel escape time is written as heat and coloured
  through the same fire palettes.

## How it works

- **Fire** — a low-resolution heat buffer where each cell averages the pixels
  below it with a slight decay, so heat rises and flickers. This is the classic
  algorithm from [Lode's computer graphics tutorial](https://lodev.org/cgtutor/fire.html).
- **Sierpiński seed** — the fractal is generated with the
  [chaos game](https://en.wikipedia.org/wiki/Sierpi%C5%84ski_triangle): repeatedly
  jump halfway toward a randomly chosen corner. **Sirpinfyer** uses a 2D triangle
  (three corners); **Tetrafyer** uses a 3D tetrahedron (four vertices), running the
  walk in 3D and perspective-projecting each point. Each point is stamped into the
  fire buffer as maximum heat, so flames rise out of the fractal.
- **Moving geometry** — the triangle's corners drift on their own `sin`/`cos`
  mixes driven by the wall clock, fit into a safe box (clear of the top 20% and
  the left/right/bottom 5%) so the fractal never runs off the edges. The
  tetrahedron instead moves under the rigid-body physics described above,
  ricocheting off the walls of its container.
- **Deterministic point cloud** — the chaos game uses a seeded PRNG (mulberry32)
  that resets to the same value every frame, so the point *sequence* is identical
  each frame. Only the moving geometry reshapes the fractal — no random shimmer.
- **Palettes & glow** — eight classic demoscene-style palettes to choose from
  (Fire, Ice, Toxic, Copper, Purple, Rainbow, Grayscale, Electric), plus a subtle
  additive bloom that makes the white-hot points glow. An optional auto-morph mode
  continuously blends from the current palette to a random next one over 8 seconds,
  on repeat.
- **Banded stripes** — an optional *filter* over whichever palette is active
  (not a palette of its own). It posterises the heat ramp into bands and dims
  alternating groups of three, turning any palette into crisp light/dark contour
  stripes. It eases in and out with the toggle, and while on its strength runs as
  a slow wave along the ramp, so the stripes gently shimmer.
- **Timing** — the simulation advances on a slow fixed tick rate, decoupled from
  the render frame rate, so the burn stays smooth and controllable.

## Controls

An on-screen panel (top-left) lets you tune the effect live:

| Control | What it does |
| --- | --- |
| **Effect** | Switch between **Sirpinfyer** (triangle fire), **Tetrafyer** (tetrahedron bouncing in a box) and **AnimeJulia** (animated Julia set). |
| **Palette** | Pick one of eight demoscene-style colour ramps. |
| **Auto-morph palettes** | Continuously blend to a random palette over 8 seconds, on repeat. |
| **Banded stripes** | Toggle a filter that turns the active palette into light/dark contour stripes (eases in/out and shimmers). |
| **Points** | Number of chaos-game points per frame (100–4000). |
| **Drift speed** | How fast the triangle's corners move around the screen. |
| **Flame rise** | How tall the flames climb before fading (linear in height). |
| **Resolution** | Fire buffer scale — sharper vs. chunkier/softer flames. |
| **Cardioid RPM** | AnimeJulia only — how fast the big seed loop orbits the Mandelbrot cardioid (0.01–2 rpm). |

Press **H** to hide the panel; click the canvas to pause.

## Running locally

It's a single self-contained `index.html` — no build step, no dependencies.
Open the file directly in a browser, or serve the folder:

```sh
python -m http.server
# then open http://localhost:8000
```

## Tech

Plain HTML5 `<canvas>` and vanilla JavaScript. Hosted on GitHub Pages.
