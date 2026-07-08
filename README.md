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
  The corners are confined to a safe box (clear of the top 20% and the
  left/right/bottom 5%) so the triangle never runs off the edges.
- **Deterministic point cloud** — the chaos game uses a seeded PRNG (mulberry32)
  that resets to the same value every frame, so the point *sequence* is identical
  each frame. Only the moving corners reshape the triangle — no random shimmer.
- **Palettes & glow** — eight classic demoscene-style palettes to choose from
  (Fire, Ice, Toxic, Copper, Purple, Rainbow, Grayscale, Electric), plus a subtle
  additive bloom that makes the white-hot points glow.
- **Timing** — the simulation advances on a slow fixed tick rate, decoupled from
  the render frame rate, so the burn stays smooth and controllable.

## Controls

An on-screen panel (top-left) lets you tune the effect live:

| Control | What it does |
| --- | --- |
| **Palette** | Pick one of eight demoscene-style colour ramps. |
| **Points** | Number of chaos-game points per frame (100–4000). |
| **Drift speed** | How fast the triangle's corners move around the screen. |
| **Flame rise** | How tall the flames climb before fading (linear in height). |
| **Resolution** | Fire buffer scale — sharper vs. chunkier/softer flames. |

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
