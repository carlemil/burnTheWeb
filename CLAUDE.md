# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single self-contained demoscene visual published as a GitHub Pages site at
https://carlemil.github.io/burnTheWeb/. Four effects — Sirpinfyer (2D Sierpiński
triangle) and Tetrafyer (3D bouncing tetrahedron) are fire/chaos-game based;
AnimeJulia (animated Julia set) and Plasma (animated sin/cos interference) are
per-pixel shaders — all share one palette + glow pipeline and can react to the
user's music. There
is **no build system, package manager, test framework, or dependency** — the
entire app is inline HTML/CSS/JS in `index.html`. `README.md` documents it for
end users; keep it in sync when behaviour changes.

## Workflow

- **Always commit and push after a completed, verified change.** `git push origin
  main` (via `HEAD:main`) auto-deploys the live site (~1 min; hard-refresh to
  bypass cache). Do not ask "want me to deploy?" first.
- **All code lives in `index.html`.** Edit it directly.
- Commit trailers must end with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` and the
  `Claude-Session:` line.
- **Preview**: open `index.html` directly, or `python -m http.server` → `http://localhost:8000`.
- Pages was configured once (`gh api -X POST repos/carlemil/burnTheWeb/pages`); do not re-run it.

## Architecture (all in `index.html`)

The whole app is one IIFE. Systems layer on top of each other and update at
different rates.

### Dual render pipeline — WebGL2 primary, Canvas2D fallback
`useGL` is set by `initGL()` at startup; every draw path branches on it.
- **Fire**: a low-res heat grid. On GPU, `glPropagate()` ping-pongs heat textures
  (cgtutor averaging `v = sum_of_4_below * 32 / decay`; `decay > 128` decays,
  `< 128` amplifies). The CPU fallback is the double loop in `simulate()`.
- **Chaos-game points** stay on the **CPU** (deterministic — see below) and are
  drawn as additive GL points via `pushPt()`/`glDrawPoints()`, or stamped into the
  heat grid with `plot()` on the CPU path.
- **Julia** (effect 2) and **Plasma** (effect 3) are fragment shaders
  (`glJulia()`/`glPlasma()`) writing per-pixel heat, or `julia()`/`plasma()`
  recomputed every frame on CPU. Each consumes a `*Seed(dt)` that advances its
  animation phase (identical on GL/CPU). Both bake their own zoom into the shader
  (so `glRender`/`render` force display-zoom to 1 for effects 2 & 3). **Adding a
  Plasma-like effect = mirror the Julia path** + register the effect index (see
  below).
- **Glow**: `glRender()` / `render()` map heat through the palette, then composite
  an additive blurred copy for the bloom.

### Effects & per-effect "scenes"
`effect` (0/1/2) selects the visual. `setEffect(i, save)` shows/hides the relevant
control groups (`grp-sirp` = fire controls for 0 & 1, `grp-julia` + `grp-band` for
2, `grp-tetra` for 1) and swaps three parallel per-effect state maps:
- `states[e]` — slider values (keys come from `PRESETS[e]`, e.g. band, speed,
  rise, size, rot, rpm, ratio, inrad, outrad, phase, points).
- `beatStates[e]` — the L/M/H beat-chip selections.
- `extras[e]` — palette, auto-morph, show-box, Preset TTL.

Switching effects calls `saveState/saveBeat/saveExtra` for the outgoing effect and
`loadState/loadBeat/loadExtra` for the incoming one, so each effect is a fully
independent scene. Only `cycle` (auto-cycle on/off) and panel open/closed are
shared/global. The fire sim only runs for effects 0 & 1 (`if (effect === 2)`
takes the Julia path); the `else` branch in `simulate()` is Tetrafyer-only.

### Presets & persistence
A **preset** is a named full-scene snapshot `{name, effect, state, beat, extra}`,
**local to the browser**. Selecting one links edits to it: `onEdit` → `autosavePreset()`
writes the current scene straight back into the selected preset (no manual save).
`mergeState()` normalizes a loaded preset to the current slider set — it drops
retired keys and defaults new ones, so old saved presets keep loading after the
slider set changes (call it whenever you add/remove/rename a `PRESETS` key).
- Persistence: `localStorage["burnTheWeb.v1"]` = `{states, beats, extras, effect,
  presets, curPreset, cycle, panelOpen, audio}`. `applyBlob(saved, sharing)` is
  shared by `restore()` and `applyShared()`; it validates every value against the
  live slider bounds so a changed range can never load junk.
- **Share** encodes `{states, beats, extras, effect, cycle}` (NOT presets) as a
  `?s=<base64>` URL; `applyShared()` decodes on load and strips the param.

### Audio & beat reactivity
`audio` holds the WebAudio graph; `startAudio("capture"|"mic")` grabs
`getDisplayMedia`/`getUserMedia` and must run inside a user gesture. **Pulse mode**:
when audio is on and a slider has an armed chip, `updateAnims()` stops that slider
drifting — it rests at the low thumb and snaps to the high thumb on each beat,
dropping back over ~0.2s. Browsers can't silently re-grab audio after a reload, so
`armAudioResume()` re-opens the last-used source on the first post-load gesture.

**The detector (`audioTick`) is an onset detector, not an energy detector** — don't
"simplify" it back. Per band it computes **spectral flux**: the sum of the positive
bin-to-bin changes since the previous tick. Four properties are load-bearing:
- **Float, linear magnitudes.** `getFloatFrequencyData` → `10^(dB/20)`. The *byte*
  spectrum is dB-compressed, so "energy > average × 1.4" there is a ratio in log
  space and a real 6dB hit barely moves it — that was the main source of misses.
- **`smoothingTimeConstant = 0`.** The analyser's smoothing is a low-pass *across
  frames*: it smears the transients and adds ~2 frames of lag.
- **Adaptive threshold + peak picking.** A beat is a *local maximum* of flux above
  `median(last ~1s of flux) × FLUX_K` and above `FLUX_FLOOR × recent peak flux`,
  with a per-band refractory (`BEAT_REFRACT`). The median tracks the band's noise
  floor (beats are sparse), so the bar follows the mix. Peak-picking is causal and
  inspects the *previous* tick, so detection costs one hop (10ms) of latency.
- **Bands are narrow on purpose** (`computeBins`: 30–150 / 150–2500 / 2500–12000 Hz)
  — a wide low band dilutes the kick, and 2k–16k averaged over ~680 near-empty bins
  is too quiet to ever clear a floor.

`audioTick` runs on a **fixed `setInterval(HOP_MS)` (100Hz), not on rAF** — beat
timing must not jitter with framerate, and two beats inside one slow frame would
otherwise collapse into one. Beats found between frames are **latched** in
`beatNow[]`; `frame()` calls `updateAnims()` (the only consumer) and then
`clearBeats()`. `audioTick(t)` takes an optional timestamp so tests can drive it on
a fake clock.

### Dev overlays (not user settings)
Both are off by default, persist nothing and never enter presets/share:
- **`dbg` — beat trace** (`d` key / `?debug=1`): scrolling flux + adaptive threshold
  + beat ticks per band. The tool for diagnosing a missed beat.
- **`rng` — slider range editor** (`r` key / `?ranges=1`): the sliders' `min`/`max`/
  `step` are hardcoded HTML attributes; this edits them live (for the *current
  effect* only — `setEffect` calls `rngRefresh`) and copies the changed attributes
  out for pasting into `index.html`. Because of it, `bindRange`'s `ui()` reads
  `lo.min`/`lo.max` **live** rather than closing over them, and `rng` is declared
  with `var` (`setEffect` runs before its declaration is evaluated).

### "Sync with your music" nudge + analytics
`#syncpop` is shown to users who haven't successfully started audio, at growing
gaps of active (tab-visible) time (`SYNC_DELAYS` = 30s, 5min, 1h), capped at 3
showings ever; state in `localStorage["burnTheWeb.sync.v1"]`, satisfied for good
once any source goes live. `track(name, params)` is a provider-agnostic event
hook; the GA4 gtag scaffold stays **completely inert** (no script, no requests)
until `GA_MEASUREMENT_ID` is set to a real `G-…` id.

### Timing model (important)
`frame()` runs every `requestAnimationFrame`. The **fire sim is decoupled** from
render: it advances on a fixed accumulator tick (`cfg.burn` ticks/sec, capped 4
ticks/frame) while render/morph/beat run every frame. Julia recomputes fully each
frame. Phase clocks (`simT`, `spinAngle`) accumulate per tick from the live speed
rather than reading the wall clock, so animating the speed never teleports the
phase. Clicking the canvas toggles `paused`.

### Determinism
The chaos game uses a **mulberry32 PRNG re-seeded to `SEED` every frame**, so the
point *sequence* is identical each frame — only the moving geometry reshapes the
fractal (no random shimmer). Auto-morph uses `Math.random()`, kept separate so it
never perturbs the fractal.

## Config & control gotchas

`cfg = { points, speed, decay, scale, burn }` holds live fire state. Sliders are
wired via `bindRange(id, valId, fmt, apply, durScale, beat)` and registered in
`anims`; `updateAnims()` drives their erratic drift between the two thumbs. Non-obvious mappings:
- **Flame rise** is linear in flame *height*: `decay = 128 * R / (R - 1)` (setting
  `decay` directly is a brutal `1/(decay-128)` hyperbola near 128).
- **Drift speed** slider value is divided by 100 → `cfg.speed`.
- **Rotation** slider is degrees/second → converted to rad/s (`rotSpeed`),
  accumulated into `spinAngle` per tick (independent of drift speed & burn rate).
- **Palette** is baked into a `Uint32Array` in **little-endian ABGR** for direct
  pixel writes; index 0 is forced opaque black. **Banding** (AnimeJulia-only) is a
  *filter* over the active palette, not a palette of its own.
- The Sierpiński chaos game is stamped inside a **safe box** (top 20% and
  left/right/bottom 5% excluded) via `plot()`; Size/Rotation scale & spin the
  corners about the box centre and can push points past those bounds.
- `cfg.scale` changes need a `resize()` to reallocate buffers.
- **Reset** restores only the current effect's `state`/`beat`/`extra` to presets;
  other effects and the shared controls are untouched.

## Testing (no framework — headless verification)

Changes are verified by driving the page in headless Edge and reading a screenshot:
- **Syntax check** each `<script>`: `node -e "...new Function(scriptText)..."`.
- **Assertion probe**: generate a temp copy of `index.html` with an injected
  `<script>` that manipulates the DOM, asserts, and appends a green/red result
  `<div>`; screenshot it with
  `msedge --headless=new --disable-gpu --screenshot=out.png --virtual-time-budget=N file:///…`,
  then Read the PNG.
- Use `{bubbles:true}` on synthetic events (the delegated persist/onEdit listener
  needs bubbling). Seed `localStorage` in a `<script>` placed **before** the app to
  test restore/nudge paths. Set auto-morph off before asserting palette (morph
  makes the dropdown show its target). `setInterval` advances under
  `--virtual-time-budget`; `document.hidden` may read true in headless (override
  `Document.prototype.hidden` if a timer gates on visibility). GoatCounter/GA stay
  inert on `file://`/`localhost`, so tests never emit analytics.

**Beat detection** can't be tested that way — a headless browser has no audio. It
has its own probe, `tools/beatprobe.js` (`node tools/beatprobe.js index.html`):
it slices the *real* detector source out of `index.html` (the constants block, the
`audio` object, `median`, `audioTick`), runs it with a stub analyser fed synthetic
dB spectra on a fake clock, and asserts against scenes that matter — a kick riding
a loud sustained bass, hi-hats on 8ths (and no leak into the low band), a 20dB
quiet verse, silence and a sustained tone (no false positives), and a double-time
fill (refractory holds). It slices by source markers, so keep them: `const HOP_MS`
… `const meterBars`, `const medBuf` … `function audioMsg`, `function audioTick` …
`function clearBeats`.
