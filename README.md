# burnTheWeb

A classic demoscene **fire effect** whose flames are seeded by an animated
**Sierpiński triangle**. The triangle's three corners drift around the screen on
a mix of sine and cosine waves, and a chaos-game point cloud stamps the fractal
into the fire as fresh heat every tick — so the whole thing burns, flickers, and
morphs continuously.

🔥 **Live demo:** https://carlemil.github.io/burnTheWeb/

## How it works

- **Fire** — a low-resolution heat buffer where each cell averages the pixels
  below it with a slight decay, so heat rises and flickers. This is the classic
  algorithm from [Lode's computer graphics tutorial](https://lodev.org/cgtutor/fire.html).
- **Sierpiński seed** — the fractal is generated with the
  [chaos game](https://en.wikipedia.org/wiki/Sierpi%C5%84ski_triangle): repeatedly
  jump halfway toward a randomly chosen corner. Each resulting point is stamped
  into the fire buffer as maximum heat, so flames rise out of the fractal.
- **Moving corners** — each of the three triangle corners drifts on its own mix
  of `sin`/`cos` waves at different frequencies, so the fractal morphs and wanders.
- **Deterministic point cloud** — the chaos game uses a seeded PRNG (mulberry32)
  that resets to the same value every frame, so the point *sequence* is identical
  each frame. Only the moving corners reshape the triangle — no random shimmer.
- **Palette** — a classic fire ramp built in HSL: black → red → orange → yellow → white.
- **Two layers** — the triangle and the fire are rendered independently. The
  fire simulation advances only on a slow fixed tick (Burn speed), while the
  Sierpiński overlay is recomputed and drawn every frame — so the triangle moves
  at full frame rate on top of the slowly-burning fire it also seeds.

## Controls

An on-screen panel (top-left) lets you tune the effect live:

| Control | What it does |
| --- | --- |
| **Points** | Number of chaos-game points per frame (100–4000). |
| **Burn speed** | Simulation ticks per second — how fast the fire evolves. |
| **Drift speed** | How fast the triangle's corners move around the screen. |
| **Flame rise** | How tall the flames climb before fading. |
| **Resolution** | Fire buffer scale — sharper vs. chunkier/softer flames. |

Press **H** or click the canvas to hide/show the panel.

## Running locally

It's a single self-contained `index.html` — no build step, no dependencies.
Open the file directly in a browser, or serve the folder:

```sh
python -m http.server
# then open http://localhost:8000
```

## Tech

Plain HTML5 `<canvas>` and vanilla JavaScript. Hosted on GitHub Pages.
