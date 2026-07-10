# burnTheWeb

A classic demoscene **fire effect** whose flames are seeded by an animated
**Sierpiński tetrahedron**. The tetrahedron's four vertices tumble in 3D, and a
chaos-game point cloud — run in 3D and perspective-projected — stamps the fractal
into the fire as fresh heat every tick, so the whole thing burns, flickers, and
morphs continuously.

🔥 **Live demo:** https://carlemil.github.io/burnTheWeb/

## Effects

An **Effect** selector at the top of the panel switches between two visuals that
share the same palette, auto-morph and glow pipeline:

- **Sirpinfyer** — the Sierpiński-tetrahedron fire described below.
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
- **Sierpiński seed** — the fractal is generated with the 3D
  [chaos game](https://en.wikipedia.org/wiki/Sierpi%C5%84ski_triangle): repeatedly
  jump halfway toward a randomly chosen one of the tetrahedron's four vertices.
  Each resulting point is perspective-projected and stamped into the fire buffer
  as maximum heat, so flames rise out of the fractal.
- **Tumbling in 3D** — the four vertices of a regular tetrahedron rotate about
  two axes on the wall clock, so the fractal turns and reshapes. The projection is
  fit into a safe box (clear of the top 20% and the left/right/bottom 5%) so it
  never runs off the edges.
- **Deterministic point cloud** — the chaos game uses a seeded PRNG (mulberry32)
  that resets to the same value every frame, so the point *sequence* is identical
  each frame. Only the tumbling vertices reshape the fractal — no random shimmer.
- **Palettes & glow** — eight classic demoscene-style palettes to choose from
  (Fire, Ice, Toxic, Copper, Purple, Rainbow, Grayscale, Electric), plus a subtle
  additive bloom that makes the white-hot points glow. An optional auto-morph mode
  continuously blends from the current palette to a random next one over 8 seconds,
  on repeat.
- **Timing** — the simulation advances on a slow fixed tick rate, decoupled from
  the render frame rate, so the burn stays smooth and controllable.

## Controls

An on-screen panel (top-left) lets you tune the effect live:

| Control | What it does |
| --- | --- |
| **Effect** | Switch between **Sirpinfyer** (Sierpiński fire) and **AnimeJulia** (animated Julia set). |
| **Palette** | Pick one of eight demoscene-style colour ramps. |
| **Auto-morph palettes** | Continuously blend to a random palette over 8 seconds, on repeat. |
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

## Windows screen saver

There's a native Windows screen saver (`.scr`) in [`screensaver/`](screensaver/)
that hosts this same `index.html` in an embedded Edge (WebView2) surface, so it
renders identically to the web version. See its
[README](screensaver/README.md) to build and install it.

## Tech

Plain HTML5 `<canvas>` and vanilla JavaScript. Hosted on GitHub Pages.
