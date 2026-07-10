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
- **Banding** — an optional *filter* over whichever palette is active (not a
  palette of its own). It posterises the heat ramp into bands and dims
  alternating groups of three, turning any palette into crisp light/dark contour
  stripes. Its strength is set by a ranged slider (see below), so it can sit at a
  fixed level or wander between two bounds; while on it also shimmers as a slow
  wave along the ramp.
- **Timing** — the simulation advances on a slow fixed tick rate, decoupled from
  the render frame rate, so the burn stays smooth and controllable.

## Controls

An on-screen panel (top-left) lets you tune the effect live. Most controls are
**ranged sliders**: two thumbs set a lower and upper bound, and the live value
then wanders *erratically* between them (a random target reached over a random
time, eased, on repeat). Collapse the two thumbs together to pin a constant
value, so a ranged slider also works as an ordinary one.

| Control | What it does |
| --- | --- |
| **Effect** | Switch between **Sirpinfyer** (triangle fire), **Tetrafyer** (tetrahedron bouncing in a box) and **AnimeJulia** (animated Julia set). |
| **Palette** | Pick one of eight demoscene-style colour ramps. |
| **Auto-morph palettes** | Continuously blend to a random palette over 8 seconds, on repeat. |
| **Banding** *(ranged)* | Strength of the light/dark contour-stripe filter over the active palette. |
| **Points** | Number of chaos-game points per frame (100–4000). |
| **Drift speed** *(ranged)* | How fast the triangle's corners move around the screen. |
| **Flame rise** *(ranged)* | How tall the flames climb before fading (linear in height). |
| **Zoom** *(ranged)* | Zoom the whole view in and out. |
| **Cardioid RPM** | AnimeJulia only — how fast the big seed loop orbits the Mandelbrot cardioid (0.01–2 rpm). |
| **Inner : outer ratio** *(ranged)* | AnimeJulia only — how many times the small seed circle spins per big-loop lap. Defaults to the hypocycloid ratio implied by the two circumferences (≈21.5×). |

The fire runs at full resolution (there is no resolution control). Press **H** to
hide the panel; click the canvas to pause.

## Running locally

It's a single self-contained `index.html` — no build step, no dependencies.
Open the file directly in a browser, or serve the folder:

```sh
python -m http.server
# then open http://localhost:8000
```

## Tech

Plain HTML5 `<canvas>` and vanilla JavaScript. Hosted on GitHub Pages.
