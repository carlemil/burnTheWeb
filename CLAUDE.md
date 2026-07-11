# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single self-contained demoscene visual: a classic rising-fire effect seeded by an
animated Sierpiński triangle, published as a GitHub Pages project site at
https://carlemil.github.io/burnTheWeb/. There is no build system, package manager,
test suite, or dependencies — the entire app is inline HTML/CSS/JS in `index.html`.

## Workflow

- **Always commit and push after a change.** Once a change is complete and
  verified, commit it with a descriptive message and `git push origin main` as
  the final step — do not ask "want me to deploy?" first. Pushing to `main`
  auto-deploys the live site.
- **Edit** `index.html` (all code lives there; `README.md` documents it).
- **Preview locally**: open `index.html` directly in a browser, or `python -m http.server` and visit `http://localhost:8000`.
- **Deploy**: GitHub Pages serves `main` at the root path. Every push to `main` auto-deploys; the live site updates ~1 minute later (hard-refresh to bypass cache).
- Pages config was set once via `gh api -X POST repos/carlemil/burnTheWeb/pages`; you do not need to re-run it.

## Architecture (all in `index.html`)

The render pipeline layers several independent systems that update at different rates:

- **Fire buffer** — a low-resolution `Uint8Array` heat grid (`fire`), sized `window / cfg.scale`. `simulate()` propagates heat upward using the cgtutor averaging algorithm (`v = sum_of_4_below * 32 / decay`), where `decay > 128` decays and `< 128` amplifies. It then stamps the triangle's points into the buffer as max heat (255).
- **Sierpiński seed** — a chaos game (jump halfway to a random corner) run inside `simulate()`. It uses a **deterministic mulberry32 PRNG re-seeded to `SEED` every frame**, so the point *sequence* is identical each frame and only the moving corners reshape the fractal. Corner positions come from per-corner `sin`/`cos` mixes, mapped into a safe box (top 20% and left/right/bottom 5% excluded) so the triangle never touches the edges.
- **Palettes** — `PALETTES[]` maps heat index 0..255 → RGB via color functions (HSL fire, gradient-stop ramps, phase-shifted sines). `setPalette()` bakes the active one into the `palette` `Uint32Array` in **little-endian ABGR** for direct pixel writes. Index 0 is forced to opaque black.
- **Auto-morph** — when enabled, `morphStep()` RGB-interpolates `palette` from the current ramp toward a random next one over `MORPH_MS` (8s), then repeats. Uses `Math.random()` (kept separate from the chaos-game PRNG so the fractal is unaffected).
- **Render** — `render()` maps `fire` through `palette` into an offscreen `ImageData`, scales it up to the canvas, then draws an additive blurred copy (`lighter` + `blur`) for the point glow/bloom.

### Timing model (important)

`frame()` runs every `requestAnimationFrame`, but the **fire simulation is decoupled** from the render rate: it advances on a fixed accumulator tick (`cfg.burn` ticks/sec, capped at 4 ticks/frame) while `render()` and `morphStep()` run every frame. This lets the fire burn slowly while the display stays smooth. Clicking the canvas toggles `paused` (early-returns before simulate/render).

### Config & controls

`cfg = { points, speed, decay, scale, burn }` holds live state. Panel sliders are wired via `bind(id, valId, fmt, onChange)`. Two mappings are non-obvious:

- **Flame rise** slider is linear in flame *height*: `decay = 128 * R / (R - 1)`. This exists because setting `decay` directly is a `1/(decay-128)` hyperbola — brutally non-uniform near 128.
- **Drift speed** slider value is divided by 100 to get `cfg.speed`.

`cfg.scale` changes require a `resize()` to reallocate buffers. The **Reset** button snapshots each control's load-time value and restores it (and turns off morph).
