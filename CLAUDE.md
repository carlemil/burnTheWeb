# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single self-contained demoscene visual published as a GitHub Pages site at
https://carlemil.github.io/burnTheWeb/. A registry of effects (see below) in three
families, all sharing one palette + glow + banding + beat-reactive pipeline:
- **Fire / point-accumulation** — Sirpinfyer (2D Sierpiński triangle), Tetrafyer (3D
  bouncing tetrahedron), Attractor (de Jong): stamp points into a rising-fire heat grid.
- **Shader fractals** — AnimeJulia, Burning Ship, Multibrot, Newton: per-pixel escape/
  iteration fractals.
- **Shader coordinate/pattern** — Plasma, Tunnel, Metaballs, Kaleidoscope, Rotozoomer,
  Moiré, Munching Squares, Copper Bars.

Each is one `EFFECTS` descriptor (metadata + `params`/`defaults`/`beat`/`extras` + a
`draw(dt)` shader hook or a `stamp(box)` point hook). There is **no build system,
package manager, test framework, or dependency** — the entire app is inline HTML/CSS/JS
in `index.html`. `README.md` documents it for end users; keep it in sync when behaviour
changes.

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
- **Shader effects** (Julia, Plasma, Tunnel, Metaballs, Burning Ship, Kaleidoscope,
  Rotozoomer, Moiré, Newton, Multibrot, Copper Bars) are fragment shaders writing
  per-pixel heat to the texture's `.r` channel (`o = vec4(heat,0,0,1)`), with a CPU
  mirror (`julia()`/`plasma()`/`tunnel()`/…). Each has an `FS_*` source + a `glProg.<id>`
  registered in `initGL`; the descriptor's `draw(dt)` calls the generic
  **`glShaderDraw(name, setU)`** (binds the heat FBO, `uSize`, then `setU` sets the
  effect's uniforms) or the CPU mirror. A `*Seed(dt)` advances the animation phase
  (identical GL/CPU). `bakesOwnZoom: true` bakes zoom into the shader so `glRender`/
  `render` force display-zoom to 1. **Adding a shader effect = append one descriptor**
  with an `FS_*`+`glProg` pair, a `draw`/`cpu` pair, `params`/`defaults`; its presence
  routes `frame()` past the fire sim, and its sliders generate from the `CONTROLS` schema.
- **Point-accumulation effects** (Sirpinfyer, Tetrafyer, Attractor) run the fire sim and
  stamp points into the heat grid via `plot()`. `simulate()` dispatches to the
  descriptor's **`stamp(box)`** hook if present (Attractor), else the `fractal2d` (2D
  chaos game) / tetra branches. Adding one = a descriptor with a `stamp` hook, no `draw`.
- **Glow**: `glRender()` / `render()` map heat through the palette, then composite
  an additive blurred copy for the bloom.

### Effects & per-effect "scenes"
**The `EFFECTS` registry is the single source of truth per effect** — an array of
descriptors `{id, name, presetName?, subtitle, help, params, helpTags, draw?/fractal2d,
bakesOwnZoom?, onEnter?, defaults, beat, extras}`. *Adding an effect = append one
descriptor*, nothing else (a dev `assertRegistry()` warns on a dup id or a
param/default that isn't a real control). Everything derives from the registry:
- **Dropdown / subtitle / help / default-preset name** — from `name`/`subtitle`/`help`.
- **Controls** — each effect's sliders are **generated from the shared `CONTROLS`
  schema** (one entry per slider/checkbox: type, label, range, `fmt`, `apply`,
  `durScale`, host). `buildControls()` renders them into `#fxctl`/`#bandctl`; `setEffect`
  shows only the keys in the descriptor's ordered `params`. No hand-written control HTML.
- **Defaults** — `defaults` (slider values), `beat` (chip selections), `extras`
  (palette/morph/showBox/randSeed) seed `states[e]`/`beatStates[e]`/`extras[e]` via
  `presetState`/`presetBeat`/`presetExtra`. `defaults` includes a few render-affecting
  keys the effect doesn't display (e.g. `band` at 0) so switching to it resets them.
- **Render** — `frame()` runs the effect's `draw(dt)` (shader) or the fire-sim
  accumulator; `simulate()` stamps 2D when `fractal2d`; `glRender/render` force display
  zoom to 1 when `bakesOwnZoom`; `setEffect` runs `onEnter`; `renderHelp` filters by `helpTags`.
- **Identity** — persistence uses the **stable string `id`**, not the numeric index:
  `serializeBlob`/`deserializeBlob` convert at the storage edge and `LEGACY_EFFECT_IDS`
  migrates pre-id blobs, so reordering/removing effects never corrupts saved presets.
  `effect` stays the runtime numeric index (registry position).

`setEffect(i, save)` shows the descriptor's `params` controls, runs `onEnter`, and swaps
three parallel per-effect state maps:
- `states[e]` — slider values (seeded from the descriptor's `defaults`).
- `beatStates[e]` — the L/M/H beat-chip selections (seeded from `beat`).
- `extras[e]` — palette, auto-morph, show-box, random-seed (seeded from `extras`).

Switching effects calls `saveState/saveBeat/saveExtra` for the outgoing effect and
`loadState/loadBeat/loadExtra` for the incoming one, so each effect is a fully
independent scene. `cycle` (auto-cycle on/off), **`ttl` (Preset TTL)**, `scale`
(resolution) and panel open/closed are shared/global (top-level blob fields, not per
effect and not in a preset). `frame()` routes shader effects (those with a `draw`
hook) past the fire sim; `simulate()` stamps the 2D chaos game when `fractal2d`, else
the 3D tetra.

### Presets & persistence
A **preset** is a named full-scene snapshot `{name, effect, state, beat, extra}`,
**local to the browser**. Selecting one links edits to it: `onEdit` → `autosavePreset()`
writes the current scene straight back into the selected preset (no manual save).
`mergeState()` normalizes a loaded preset to the current slider set — it drops
retired keys and defaults new ones, so old saved presets keep loading after an
effect's `defaults` change (it validates against `presetState(e)`, i.e. the
descriptor's `defaults`). `effect` in a saved preset is the stable string `id`.
- Persistence: `localStorage["burnTheWeb.v1"]` = `{states, beats, extras, effect,
  ranges, beatTune, presets, curPreset, cycle, ttl, scale, panelOpen, audio}` — built by the
  single helper **`fullSnapshot()`**, which is *the* definition of "everything we
  remember." `persist()` and the Backup file both serialize exactly `fullSnapshot()`, so
  a newly saved setting can never land in one but not the other. `applyBlob(saved,
  sharing)` is shared by `restore()` and `applyShared()`; it applies `ranges` +
  `beatTune` **first** (so the live slider bounds / detector thresholds are the custom
  ones) then validates every value against those bounds so a changed range can never
  load junk. Anything a user can change that is *not* in `fullSnapshot()` is
  deliberately transient: pause, fullscreen, and the `dbg`/`beat`/`rng` overlay visibility.
- **Custom slider ranges** (min/max/step) are saved, not just live. `RNG_ORIG`
  captures the shipped bounds up top (before `restore()` can overwrite them);
  `collectRanges()` stores only sliders whose bounds differ from shipped and
  `applyRanges()` sets them back. They ride in `localStorage`, the `?s=` URL and the
  Backup file. The `rng` editor (below) writes them live via the normal persist path.
- **Share** encodes `{states, beats, extras, effect, cycle, ranges}` (NOT presets)
  as a `?s=<base64>` URL; `applyShared()` decodes on load and strips the param.
- **Backup** file (top of panel) is the full `fullSnapshot()` blob (every preset + all
  settings). **Restore** opens the `#restoredlg` dialog: `openRestore(parsed, valid,
  name)` shows a checkbox per part the file actually contains (presets / effect settings
  / ranges / beat tuning) plus a merge-vs-replace radio for presets. `applyRestore()`
  starts from the current `fullSnapshot()` and overrides only the ticked parts — presets
  merge by name or fully replace, `curPreset` is remapped by name — then writes to
  `localStorage` and **reloads**, so the normal load path (`restore` → `applyBlob` →
  `setEffect` → `resize`) reapplies it exactly. Older `{presets, ranges}` objects and
  bare-array backups still load (only the parts they carry are offered). There is no
  per-effect text Export/Import — removed; **Share** is the only text-export path.

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
  `median(last ~1s of flux) × beatCfg.fluxK[b]` and above `beatCfg.floor × recent peak
  flux`, with a per-band refractory (`beatCfg.refract[b]`). The median tracks the
  band's noise floor (beats are sparse), so the bar follows the mix. Peak-picking is
  causal and inspects the *previous* tick, so detection costs one hop (10ms) of latency.
- **Bands are narrow on purpose** (`beatCfg.bands`, default 30–150 / 150–2500 /
  2500–12000 Hz; `computeBins` maps them to FFT bins) — a wide low band dilutes the
  kick, and 2k–16k averaged over ~680 near-empty bins is too quiet to ever clear a floor.
- **The thresholds are live-tunable, not consts.** `beatCfg` (defaults in
  `BEAT_DEFAULTS`, both in the detector constants block) holds per-band `fluxK`, global
  `floor`, per-band `refract`, and per-band `bands`; `audioTick`/`computeBins` read it
  live. The **`b` overlay** edits it (see Dev overlays). It persists to `localStorage`
  and the Backup file (via `collectBeatTune`/`applyBeatTune` in `fullSnapshot`/
  `applyBlob`) but is **not** in Share links or presets. `beatprobe` still slices the
  same markers and gets `beatCfg` because it lives in the sliced constants block.

`audioTick` runs on a **fixed `setInterval(HOP_MS)` (100Hz), not on rAF** — beat
timing must not jitter with framerate, and two beats inside one slow frame would
otherwise collapse into one. Beats found between frames are **latched** in
`beatNow[]`; `frame()` calls `updateAnims()` (the only consumer) and then
`clearBeats()`. `audioTick(t)` takes an optional timestamp so tests can drive it on
a fake clock.

### Dev overlays (not user settings)
Three overlays, off by default; they never enter presets and their on/off state is
never saved. The `d`/`b`/`r` keys are surfaced in a hint line at the bottom of the panel.
- **`dbg` — beat trace** (`d` key / `?debug=1`): scrolling flux + adaptive threshold
  + beat ticks per band. The tool for diagnosing a missed beat. Persists nothing. Its
  lane labels read `beatCfg.bands` live, so they track band edits from the `b` overlay.
- **`beat` — detection tuning** (`b` key / `?beat=1`): live sliders/fields for
  `beatCfg` (per-band `fluxK`, `floor`, per-band `refract`, per-band `bands` Hz),
  meant to sit beside the `d` trace. Edits write into `beatCfg`, `persist()`, and
  re-run `computeBins()` when a band edge moves. **Unlike its on/off state, the values
  persist** (localStorage + Backup, not Share/presets — see the detector section).
  Reset restores `BEAT_DEFAULTS`. `beatUi` (the overlay object) is separate from the
  many `beat*`/`BEAT_*` scene-audio names.
- **`rng` — slider range editor** (`r` key / `?ranges=1`): the sliders' shipped
  `min`/`max`/`step` are HTML attributes; this edits them live (for the *current
  effect* only — `setEffect` calls `rngRefresh`). Unlike `dbg`, the **bounds it sets
  now persist** — a range edit dispatches `input`, which the delegated `onEdit` turns
  into a `persist()` (see Custom slider ranges above), so they save to `localStorage`,
  ride the `?s=` share URL and go in the Backup file. "Copy changed" still emits the
  attributes for baking into `index.html` as new shipped defaults; Reset restores
  those defaults. Because of the editor, `bindRange`'s `ui()` reads `lo.min`/`lo.max`
  **live** rather than closing over them, and `rng` is declared with `var` (`setEffect`
  runs before its declaration is evaluated).

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

**AnimeJulia random start.** The Julia orbit accumulators `juliaOuter/juliaInner`
default to a fixed 0 and are set by `reseedJulia()`: a random lap (`Math.random()`,
clear of the chaos PRNG) when the per-effect **Random seed** toggle (`randSeed`, an
`extras` field, default on) is on, else 0 (reproducible). `setEffect(2)` calls it on
every entry to AnimeJulia — first load, effect switch, and preset apply — so it opens
somewhere new each reload; toggling the checkbox re-rolls immediately.

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
- **Every preset switch morphs the palette to a fresh random one, blended in from
  whatever was on screen** (no snap). `applyPreset` snapshots the live `paletteBase`
  *before* `setEffect`/`loadExtra` can overwrite it, then calls **`beginMorph(fromRamp,
  pickOther(...))`** — `startMorph(i)` is just `beginMorph(paletteRGB(i), pickOther(i))`,
  the discrete-source case. `beginMorph` paints `fromRamp` into `paletteBase` immediately
  (so an auto-cycle switch made mid-`frame()` doesn't flash the target for one frame) and
  arms the blend; `morphOnce = !morphing` makes it a one-shot when auto-morph is off (which
  `morphStep` settles via `setPalette(morphTargetIndex)`) and a continuing cycle when on.
  The frame loop runs `morphStep` when `morphing || morphOnce`; a manual palette pick or a
  plain scene load clears `morphOnce`.
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
