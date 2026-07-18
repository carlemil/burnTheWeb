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
**The three cardioid-seeded effects share one seed path.** AnimeJulia, Burning Ship
and Multibrot each call `juliaSeed(dt)` **once** in their `draw` hook and hand the
resulting seed to either the shader (`uC`) or the CPU mirror — `julia(seed)` /
`burningShip(seed)` / `multibrot(seed)` take the seed as an argument and must never
call `juliaSeed()` themselves, or the Canvas2D path advances the orbit twice a frame
(it did, until fixed). `juliaSeed` = rim point on the scaled main cardioid **plus**
the small riding circle of radius `juliaInnerR` at `ratio ×` the outer phase; the
riding circle is what keeps the seed's neighbourhood varying instead of retracing
one closed curve.

**Lap-speed easing.** The orbit is *not* swept at constant angular speed: `juliaSeed`
scales each step by `EASE_K · (1 + JULIA_EASE_A·cos θ)`, so the seed sprints through
the cardioid's cusp (θ=0, the start/end of a lap) and eases off at the back (θ=π).
`JULIA_EASE_A = 0.5` ⇒ the cusp is exactly `(1+A)/(1−A)` = **3×** the back.
**`EASE_K = 1/√(1−A²)` is load-bearing**: `∮dθ/(1+A·cos θ) = 2π/√(1−A²)`, so without
it the same rpm would run ~15% slow — with it a lap takes exactly `1/rpm` minutes and
every existing preset keeps its pace.

The warp applies to the **outer phase only** — the riding circle keeps its steady rate,
so its epicycles bunch up where the cardioid crawls (the back) and stretch where it
sprints (the cusp); that unevenness is the point. Because lap *time* is preserved the
inner still completes exactly `ratio` turns per lap, just unevenly distributed. Note the
easing is symmetric about θ=π, so the two half-laps take **equal** time — the asymmetry
is per quarter (a probe assertion got this wrong before the maths did). `juliaSeedAt`
stays unwarped; the Cardioid debug view therefore **integrates** `dφ = ratio·dθ/ease(θ)`
as it walks the path (via the shared `juliaEase`) instead of assuming φ is linear in θ,
or the drawn epicycles would not match the ones on screen.
`juliaprobe` locks all of this down.

- **Point-accumulation effects** (Sirpinfyer, Tetrafyer, Attractor) run the fire sim and
  stamp points into the heat grid via `plot()`. `simulate()` dispatches to the
  descriptor's **`stamp(box)`** hook if present (Attractor), else the `fractal2d` (2D
  chaos game) / tetra branches. Adding one = a descriptor with a `stamp` hook, no `draw`.
- **Glow**: `glRender()` / `render()` map heat through the palette, then composite
  an additive blurred copy for the bloom.

### Credits burn-in
The startup credits are stamped into the **heat grid** through the same `plot()` the
effects use, not drawn as an overlay — so they take the effect's palette, glow and (with
Fire on) rise and burn away with no undraw step. `creditRaster()` rasterises the two lines
once to an offscreen 2D canvas at heat resolution and caches the coverage mask per
`fw`/`fh`; `creditStamp()` replays it every tick.

The credits are the one thing on the heat grid the **camera does not touch** — they are
fixed chrome, so a preset's rotation or zoom must not tilt or rescale the text. Two
opt-outs, one per transform: `plot(x, y, v, raw)` takes a fourth argument that skips the
`camOn()` rotation (only `creditStamp` passes it, so every other caller is unchanged), and
`creditStamp` cancels the *display* zoom by gathering — the render pass maps heat pixel
`h` to screen `(h−c)·z + c`, so a glyph texel is written at `(h−c)·z + c` sampled from the
mask, landing it at its nominal screen spot. It uses the **same `bakesOwnZoom ? 1 : zoom`
ternary as `glRender`/`render`**; if the three ever diverge the credits drift out of
place. A `z === 1` fast path keeps the common case the original tight loop. At high zoom
the glyphs are written into a smaller region and so read thinner — correct, since they end
up the right size on screen.

It is called from **two** places, because the two effect families reach the heat grid
differently: inside `simulate()` for point effects (so the glyphs join that tick's stamp
list), and in `frame()` right after `fx.draw(dt)` for shader effects (which overwrite the
whole heat texture each frame, so the credits have to go on top). On GL the latter needs
`glBlitPoints()` — the MAX-blended point draw split out of `glDrawPoints` so it can run
*without* the `curHeat` flip the point path owns.

`creditLeft` counts down in **rendered** time (`dt` from the frame loop), not wall clock:
a backgrounded tab stops rAF, and a wall-clock timer would burn the credits away unseen.
`?credits=<seconds>` overrides the duration (same spirit as `?debug=1`). The on/off
preference lives in its own `localStorage` key, deliberately **not** in the scene blob —
it is a per-browser choice, not part of a shared or backed-up scene.

### Filters (post-FX)
`FILTERS` is a second registry beside `EFFECTS`: stackable post-processing any effect can
use, ticked in a checkbox list (registry order is the apply order — a checkbox list can't
be reordered, so that order is a design decision). Two stages, split by **whether the
filter writes the retained heat buffer**:
- **feedback** (`Fire`, `Fade pixel`; later Echo) — mutates heat that survives to the next
  frame, so it runs inside `glBeginHeat` *before* the effect's output is MAX-injected. With
  no feedback filter, `glBeginHeat` **clears** (skipping it would read 2-frames-stale heat)
  and the CPU path zeroes `fire` instead of running the propagation loop.
- **post** (Pixelate, Blur/sharpen, Edge, Posterize, Mirror, Bloom) — read the
  palette-mapped image. `glPostChain()` ping-pongs them through `glTex.post[0]/[1]`
  between FS_PAL and FS_ZOOM and **returns `glTex.native` untouched when the chain is
  empty** — it must not run a pass-through copy, since an extra RGBA8 sample through a
  nominally identity pass can shift a value by a LSB and read as a brightness change.
  Bloom has no pass of its own: it is the pre-existing glow composite with its strength
  under `bloomAmt`/`uBloom` (0 when off).

`glBeginHeat` runs the feedback chain — every ticked `stage: "feedback"` filter's
`glFeedback(srcTex)` in registry order, one ping-pong pass each — with **`pendingDst` set
to wherever the last pass landed**, not a fixed `1 - curHeat`, so any number of passes
works without a parity fixup. With two filters the result ends up back in the buffer it
started in, which is why `pendingDst = src` (not `dst`) after the loop; a `1 - curHeat`
assumption is correct for one pass and wrong for two, so it is easy to ship broken.
`tools/heatprobe.js` locks the parity down.

**Feedback filters apply to shader effects too, not just the point ones.** A shader
effect overwrites the whole heat buffer, so `frame()` advances the retained heat first
(`heatFeedbackTick()` × `ticks`) and then `glShaderDraw` **MAX-blends** its output over
it instead of replacing it — the same injection point stamps use. `hasFeedback()` is the
single predicate: false ⇒ the original clean-slate overwrite, byte for byte. On the CPU
path the mirrors still write every cell unconditionally, so `frame()` hands the mirror
the *other* buffer (a `fire`/`fireKeep` **pointer swap**, not a per-frame memcpy) and
MAX-merges afterwards; this depends on the invariant that **every CPU mirror writes every
cell** — an early-out in one would leak two-frames-stale pixels. `beginHeatTick()` is the
shared tick body (extracted from `simulate`) and does **not** flip `curHeat`;
`heatFeedbackTick()` is the flipping variant for shader effects, which have no stamp
phase to close the tick. `applyFilters()` wipes `fire` on `!hasFeedback()`, not
`!filterOn("fire")` — otherwise unticking Fire would wipe Fade's trails.

Post filters are GPU passes; on the Canvas2D fallback they carry `cpuOk: false`,
which greys out their checkbox *and* is stripped from a loaded scene's list, so a blob
authored on a GL machine can't silently enable a no-op on a fallback one.

A filter's `params` are ordinary CONTROLS keys (host `"filter"` → `#filterctl`, one
`group` per filter, contiguous in the array). `refreshControlVisibility()` shows a control
when the effect declares it **or** a ticked filter owns it, so `Flame rise` follows the
Fire checkbox rather than living in any effect's `params`. `presetState` merges
`FILTER_DEFAULTS` into every effect's state, so a new filter needs no edit to the 19
descriptors — an effect that names the same key still wins.

The **list** is per-effect in `extras[e].filters` (stable string ids, always written in
registry order so reordering `FILTERS` can't remap a saved scene). Defaults preserve
today: point effects — including Attractor, which uses `stamp`, not `draw` — get
`["fire","bloom"]`, shader effects `["bloom"]`, because the glow used to be
unconditional. **`mergeExtra` is mandatory**: `applyPreset` copies extras verbatim, so a
preset saved before filters has no `filters` key and would otherwise load with no fire and
no glow. Ordering trap: `setEffect` runs its visibility pass before `loadExtra` knows the
new filter list, so `loadExtra` re-runs `refreshControlVisibility()`.

Three ordering constraints bit during implementation and are load-bearing: the registry
block must sit **above `presetState`** (which reads `FILTER_DEFAULTS`), `buildFilterUI()`
must be called **after** the registry (not next to `buildControls`), and `activeIds` +
`filterOn` live up with the render globals because `bindRange` runs a slider's `apply()`
during wiring — all three were temporal-dead-zone crashes.

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
- **Break-out boxes** — every slider (the `dual`/`plain` `CONTROLS`) shows in the menu
  as **just a name + a `+`/`−` button on the right** (a `.ctl-row` launcher). The
  slider itself, its value readout, beat chips and pulse picker never sit in the menu —
  the whole `#ctl-<key>` node lives in `#breakout`, a `position:fixed` column to the
  right of the menu that fills top→down in click order, and is only shown while popped.
  Clicking `+` pops it (`breakout.appendChild` reorders it to the end); `−` docks it
  (the box stays a hidden child of `#breakout`). Both the row's button and the box's own
  gutter button stay in sync via `syncPopBtns`. `popped` is a global set of control keys
  (a control is one singleton reused across effects); `refreshBreakout()` — called by
  `setEffect` — shows a box iff `popped.has(key) && effect.params.has(key)` and toggles
  `#breakout.empty`. `setEffect` toggles the **menu row** for poppable keys (the box
  itself is left to `refreshBreakout`) and the control node directly for the rest. State
  is **transient** (not persisted). `setEffect` also calls **`dockAll()`** first: a switch
  swaps every slider, chip and palette, so a column left over from the previous scene is
  stale furniture — you start clean and re-pop what you want. It runs on *every*
  `setEffect`, including a same-effect preset apply (also a new scene) and the auto-cycle's,
  and it goes through `dockCtl` per key rather than clearing the set, so the menu rows'
  `+`/`−` buttons can't desync from `popped`. Because `#breakout` sits *outside* `#panel` (the
  panel's `backdrop-filter` + `overflow` would clip a fixed child), three things are
  wired to reach it too: the control-appearance CSS is scoped to `#panel …, #breakout …`;
  the delegated `onEdit` (persist/autosave) is attached to `#breakout` as well; and
  `sceneRangeInputs()` scans `#panel` + `#breakout`. Element refs (`anims`, `el(id)`) are
  location-independent, so a moved slider keeps animating, saving and loading unchanged.
  A box holds, top→bottom: the label + value, the beat chips + pulse picker on their own
  line, the slider, its **pulse-length** knob (`.plen`) and its **range editor**
  (`.rng-edit`) — the last two exist only in a box (`#panel .plen { display:none }`,
  and the editor is appended to the `.ctl` node when the box is built).
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

**Per-slider range editor** (`makeRangeEditor`, at the foot of every pop-out box).
`min`/`max`/`step` number fields + a ↺ (restore the shipped bounds from `RNG_ORIG`) for
*that* slider — this replaced the one shared "Slider ranges" list in Diagnostics (and its
"Copy changed" button; bake a bound by reading it off the field). `rngApply` writes the
attribute onto the real slider(s) (a dual's two thumbs share one set), re-clamps the value
and dispatches `input` on the **slider**, so the delegated `onEdit` persists it the normal
way — the number fields themselves are skipped in `onEdit`. `applyRanges` calls
`rngSyncAll()` so bounds arriving from a blob show up in the fields.

**Cardioid debug** (`#carddlg`, button `#cardbtn`). Descriptor-gated on `cardioid: true`
(AnimeJulia / Burning Ship / Multibrot — the effects seeded from a Mandelbrot point):
a **floating panel** (bottom-right, `z-index: 5` like `#breakout`, **no backdrop and not
a modal**) rendering the Mandelbrot set in the c-plane with the seed's full cardioid, the
path it actually traces at the current ratio/radii, the riding circle and the live seed
point drawn over it. Non-modal on purpose: you tune the orbit sliders *while watching it*,
so it must never intercept a click — don't reintroduce a backdrop or click-outside-closes. It samples **`juliaSeedAt(outer, inner)`** — the pure part split out
of `juliaSeed(dt)`, which also applies the **`cardx`** slider's `juliaOffX` real-axis
shift — so opening it never advances the animation and it always shows the true orbit. `frame()` redraws it
while open; the Mandelbrot bitmap is rendered once and cached. Transient: never persisted,
never in a preset. `card` is a **`var`** and `cardOpen`/`cardDraw` early-return on a falsy
`card`, because `setEffect` calls `cardOpen` during startup before the declaration runs.

**Camera on the CPU path.** The 12 shader effects' CPU mirrors call `camPix(x, y)` per
pixel (writing the scratch pair `camPX`/`camPY` rather than allocating), which applies the
same 2×2 `camM` map the shader camera uses. This forced the hoisted per-row terms inside
the x loop: a rotation mixes x into the y coordinate, so `const py = f(y)` outside the
inner loop is only valid while the camera is upright. **Copper Bars** keeps its
row-constant fast path but gates it on `camOn()` — its bars really are constant across a
row until you rotate, and then they aren't.

**Menu layout.** The panel is a header (title + subtitle) followed by **five `.box`
sections**, each a `<details>` so it folds (chevron from `.box-t::before`; open/closed is
**transient**, like Diagnostics): *System* (audio, resolution, Diagnostics — collapsed by
default), *Backup, restore & share* (the 2×2 `.presetrow.grid2`), *Scene* (preset +
effect choosers), *Effect settings* (`#fxctl`, Cardioid debug, Reset) and *Palette
settings* (`#palette`, `#palctl`, `#bandctl`). `buildControls` routes a control by
`host`: `"band"` → `#bandctl`, `"pal"` → `#palctl`, else `#fxctl`.

**Palette cycle.** The old "Auto-morph palettes" checkbox is gone; a `palcycle` dual
slider (host `pal`) sets the **[min,max] seconds one morph takes**, and `morphMs()` draws
each cycle's duration from it the way `ttlMs()` does for presets. Both thumbs at 0 pins
the palette — `morphing` is now *derived* (`palCycleOn()`), not stored, and
`syncMorphFromSlider()` starts/pins the blend on any edit. `extras.morph` is still
written for backward compatibility, and `loadExtra` seeds the slider to 0 for a scene
saved with `morph:false` before the slider existed.

`setEffect(i, save)` shows the descriptor's `params` controls, runs `onEnter`, and swaps
five parallel per-effect state maps:
- `states[e]` — slider values (seeded from the descriptor's `defaults`).
- `beatStates[e]` — the L/M/H beat-chip selections (seeded from `beat`).
- `pulseStates[e]` — per-slider **beat-pulse shape** (a `PULSE_SHAPES` key; seeded
  from the descriptor's optional `pulse` map, else `"snap"`).
- `plenStates[e]` — per-slider **beat-pulse length** in seconds (seeded from the
  descriptor's optional `plen` map, else `PULSE_DROP`).
- `extras[e]` — palette, auto-morph, show-box, random-seed (seeded from `extras`).

Switching effects calls `saveState/saveBeat/savePulse/savePlen/saveExtra` for the outgoing
effect and `loadState/loadBeat/loadPulse/loadPlen/loadExtra` for the incoming one, so each
effect is a fully independent scene.

**Beat chips ship unarmed.** Every effect's `beat` map is empty and the *unarmed*
chip styling is deliberately colourless and dim — the per-band colours (L blue, M green,
H red) apply only to `.on`. A vividly outlined chip reads as enabled even when nothing is
armed, which is exactly how it used to look.

**Beat-pulse shape & length.** When an armed slider (audio on + an L/M/H chip) gets a
beat, `updateAnims` snaps it to the high thumb and decays `a.pulse` linearly 1→0 over
**that slider's own** `pulseLen[id]` seconds (a `.plen` range in its pop-out box, bounds
`PLEN_MIN`–`PLEN_MAX`, default `PULSE_DROP` = the old hardcoded 0.2s, so untouched scenes
are unchanged); the per-slider shape (`pulseShape[id]`, a `PULSE_FN` entry) *reshapes*
that decay into the applied value — `a.apply(mn + shape(a.pulse)*(mx-mn))`. Every
`PULSE_SHAPES` fn maps the phase `p∈[0,1]` to an amplitude in `[0,1]` (so the value
never leaves `[lo,hi]`), with `f(1)=1` (full at the beat) and `f(0)=0` (back to rest);
`snap` is the identity, i.e. the shipped default reproduces the old linear fall exactly.
A `<select>.pulsesel` per slider (built in `makeChips`, alongside the chips) drives
`pulseShape[id]`; its `change` bubbles to the delegated `onEdit` (persist + autosave),
like the palette `<select>`. `pulseEls`/`syncPulse` mirror `chipEls`/`syncChips`, and
`plenEls`/`syncPlen`/`prunePlens`/`mergePlen` mirror the pulse-shape set one-for-one. `cycle` (auto-cycle on/off), **`ttl` (Preset TTL)**, `scale`
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
descriptor's `defaults`). `mergePulse()` does the same for a preset's `pulse` map,
so presets saved before pulse shapes existed (no `pulse` key) load as all-`snap`.
`effect` in a saved preset is the stable string `id`.

**Every one of `applyPreset`'s four maps must go through its `merge*`** — `mergeState`,
`mergeBeat`, `mergePulse`, `mergePlen`. `beat` was copied verbatim for a long time and
that was a real, ugly bug: a preset saved before a control existed has no entry for that
id, `loadBeat` spread the `undefined` into `{}`, and **`classList.toggle("on", undefined)`
*flips* the class** — per the DOM spec an explicitly-passed `undefined` counts as "force
not supplied". So the chip inverted on every `loadBeat` (every effect switch, preset apply
and Reset) while `updateAnims` saw `undefined` and never armed the slider: a chip that
looked lit and did nothing. It hid well, because the chips only exist inside `#breakout`
and an un-popped box is `display:none`, so the flips accumulated unseen and what you saw
on first pop was just the parity of how many loads had happened. `saveBeat` then wrote the
`{}` straight back, so it survived reloads. `loadBeat` now spreads over an all-false base
and `syncChips` coerces with `!!` — belt and braces, since the flip is silent and the
merge is easy to forget again.

**Beat chips are `<button>`s, so they fire neither `input` nor `change`** and the delegated
`onEdit` cannot see them. `chipEdited()` does `onEdit`'s job by hand — `autosavePreset()`
(guarded on `persistReady && !applyingPreset`) then `persist()`. Calling only `persist()`
was the second half of the same bug report: the chip reached `localStorage` but never the
*selected preset*, so re-selecting that preset silently disarmed it. It looked intermittent
because any later slider drag *did* autosave and retroactively captured the chip.
- Persistence: `localStorage["burnTheWeb.v1"]` = `{states, beats, pulses, plens, extras, effect,
  ranges, beatTune, presets, curPreset, cycle, ttl, scale, panelOpen, audio}` — built by the
  single helper **`fullSnapshot()`**, which is *the* definition of "everything we
  remember." `persist()` and the Backup file both serialize exactly `fullSnapshot()`, so
  a newly saved setting can never land in one but not the other. `applyBlob(saved,
  sharing)` is shared by `restore()` and `applyShared()`; it applies `ranges` +
  `beatTune` **first** (so the live slider bounds / detector thresholds are the custom
  ones) then validates every value against those bounds so a changed range can never
  load junk. Anything a user can change that is *not* in `fullSnapshot()` is
  deliberately transient: pause, fullscreen, the Diagnostics tools' open/closed state, and
  the frame+fps counter's visibility (the `#diagFrames` checkbox toggles `#frames`'s `.hidden`).
- **Custom slider ranges** (min/max/step) are saved, not just live. `RNG_ORIG`
  captures the shipped bounds up top (before `restore()` can overwrite them);
  `collectRanges()` stores only sliders whose bounds differ from shipped and
  `applyRanges()` sets them back. They ride in `localStorage`, the `?s=` URL and the
  Backup file. Each slider's in-box range editor writes them live via the normal persist path.
- **Share** is **deflated**: the JSON goes through `CompressionStream("deflate-raw")`
  and out as base64url under **`?z=`** (measured 9400 → 1368 chars, and a messy
  full-precision scene 23252 → 646). base64url matters — `+` and `/` cost three
  characters each once percent-encoded. `?s=` (plain base64) is still emitted when
  `CompressionStream` is missing and **decoded forever**, so every link ever made keeps
  working; `?z=` is checked first and the two are mutually exclusive. The `s/<n>/`
  landing pages forward `location.search` **wholesale**, so `?z=` travels through them
  unchanged. Values are rounded on encode to each control's declared `CONTROLS.step`
  (`step="any"` sliders otherwise carry full-precision doubles, which more than doubles
  the payload) and then **clamped to the live bounds** — `applyBlob`'s `ok()` is a hard
  reject, so an out-of-range value would silently fall back to the seeded default.
  Decoding `?z=` is **async**, so it lands after startup has already run `setEffect`;
  the promise re-activates with `resize()` + `setEffect(...)` itself. `shareUrl()` is
  therefore async too, and Share copies via `ClipboardItem`'s promise form so the user
  gesture survives (a plain `writeText` after an `await` is rejected by Safari).
- **Share** encodes `{states, beats, pulses, plens, extras, effect, cycle, ranges}` (NOT
  presets) as a `?s=<base64>` URL; `applyShared()` decodes on load and strips the param.
  `shareUrl()` builds it; **`pruneBeats()` diffs the beat chips against each
  effect's `presetBeat(e)` defaults and sends only what differs** — the full map
  is every control × L/M/H × every effect and was a large part of the blob (49k-char URLs,
  which chat clients truncate and TinyURL rejects; a truncated `?s=` silently
  JSON.parse-fails and opens the default scene). **`prunePulses()` does the same for
  the pulse shapes** (only sliders whose shape ≠ the effect default, almost always
  `snap`). Pruning is share-only: `fullSnapshot()` (localStorage/Backup) stays
  verbose, and `applyBlob` leaves any id/band/shape a blob omits at its seeded
  default — **but only because `applyShared` re-seeds first**. `restore()` runs before it
  and `applyBlob` skips any key a blob omits, so without `initStates()`/`initBeatStates()`/
  … the pruned maps would decode against *the recipient's own saved scene* and bleed their
  chips and pulse shapes into the shared one. That was a real bug, invisible in a fresh
  browser and wrong for everyone else. **Prune
  against the descriptor's defaults, not against all-false** — the two happen to
  coincide today (every effect ships `beat: {}`, so no chip is armed out of the
  box), but the moment a descriptor arms one again, diffing against all-false
  would silently drop the user turning it *off*.
- **Share URL routing.** `OG_PAGES` maps an effect **id** → its static unfurl
  landing page `s/<n>/` (a numbered dir whose redirect forwards `?s=` to the app,
  so social unfurls show that effect's `og/` image). Only `sirpinfyer`/`tetrafyer`/
  `animejulia`/`plasma` have one; `shareUrl()` links the app root for every other
  effect, because `s/<n>/` would 404 and a 404 forwards nothing. (Each landing page is
  `location.replace("../../" + location.search + location.hash)` — the *whole* query
  string, so it carries `?z=` as happily as `?s=`.) **Add a
  landing page + `og/` image ⇒ add its id to `OG_PAGES`**; it's keyed by id, not
  index, so reordering the registry can't silently repoint the dirs. The landing
  pages redirect **relatively** (`../../`) so a local checkout or fork stays put
  instead of jumping to the live site.
- **Short link** (`#shorten`) POSTs the share URL to `tinyurl.com/api-create.php`
  and copies the result. Opt-in and separate from Share on purpose: it needs the
  network and hands the scene to a third party. TinyURL because it 301s
  byte-for-byte (no interstitial/injected params), sends CORS headers, needs no
  key, and doesn't block `github.io` (is.gd/v.gd reject all GitHub domains). POST
  keeps a big scene off the query string; its URL ceiling is ~30k chars, so the
  `pruneBeats` diff above is what keeps shares shortenable. The API signals
  failure with **200 + an error string**, so the response shape is validated.
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
dropping back over ~0.2s along the slider's chosen **beat-pulse shape** (see the
Effects section — `pulseShape[id]`, default `snap` = the original linear drop).
Browsers can't silently re-grab audio after a reload, so `armAudioResume()` re-opens
the last-used source on the first post-load gesture.

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

### Diagnostics tools (not user settings)
The two dev tools live in a `<details id="diag">` **Diagnostics** section at the bottom
of the System box (there are no dev keys — the whole UI opens via ☰ or **m**). They're
off by default, never enter presets, and their open/closed state is never saved. Because
they sit *inside* `#panel`, the panel-wide scans guard against them: `onEdit` (the
delegated persist listener) and the `RNG_ORIG` capture early-return on
`e.target.closest("#diag")` / `inp.closest("#diag")`, so a dev-tool edit never autosaves
into a preset and the beat sliders never leak into the saved ranges. (The slider-range
editor used to be the third tool here; it now lives per-slider in the pop-out boxes.)
- **`dbg` — beat trace** (`#diagTrace` checkbox / `?debug=1`): still a floating
  `position:fixed` canvas (built by `dbgInit`), just toggled from the checkbox now:
  scrolling flux + adaptive threshold + beat ticks per band. The tool for diagnosing a
  missed beat. Persists nothing. Its lane labels read `beatCfg.bands` live, so they
  track band edits from the Beat tuning section.
- **`beat` — detection tuning** (`#beatDetails` `<details>` / `?beat=1`): live
  sliders/fields for `beatCfg` (per-band `fluxK`, `floor`, per-band `refract`, per-band
  `bands` Hz), inlined into the panel. `beatWire()` builds it once (content isn't
  per-effect) and syncs `beatUi.on` off the `<details>` toggle. Edits write into
  `beatCfg`, `persist()`, and re-run `computeBins()` when a band edge moves. **Unlike
  its open/closed state, the values persist** (localStorage + Backup, not Share/presets
  — see the detector section). Reset restores `BEAT_DEFAULTS`. `beatUi` is separate from
  the many `beat*`/`BEAT_*` scene-audio names.
Because slider bounds are editable at runtime (the per-box range editor), `bindRange`'s
`ui()` reads `lo.min`/`lo.max` **live** rather than closing over them.

### "Sync with your music" nudge + analytics
`#syncpop` is shown to users who haven't successfully started audio, at growing
gaps of active (tab-visible) time (`SYNC_DELAYS` = 30s, 5min, 1h), capped at 3
showings ever; state in `localStorage["burnTheWeb.sync.v1"]`, satisfied for good
once any source goes live. `track(name, params)` is a provider-agnostic event
hook; the GA4 gtag scaffold is **live** — `GA_MEASUREMENT_ID` is set to the real
`G-…` id, so `initAnalytics()` loads gtag.js and page views + `track()` events
flow. Clearing `GA_MEASUREMENT_ID` back to `""` makes it **completely inert**
again (no script, no requests).

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

**Attractor point jitter.** The de Jong map is *exact* — same coefficients, same figure,
no randomness anywhere on its path (it is a point effect but not a chaos game). **Point
jitter** (`atjit`) scatters each stamped point by up to ±jit heat pixels to dither the
hard threads. It draws from `Math.random()`, deliberately clear of the chaos PRNG (same
reasoning as auto-morph) so it can never perturb the other point effects. The `jit > 0`
guard keeps jitter 0 byte-identical to the un-jittered map.

**Don't add a fixed-seed toggle for it** — it was built, shipped and reverted. Pinning the
scatter to a repeating sequence is invisible in practice: the heat grid accumulates over
many ticks, so a repeating scatter and a free one both fill the same ±jit neighbourhood
within a few frames, and glow + decay erase what little difference remains. The probe
could prove the buffers differed frame to frame; a human watching the screen could not.
A distinction only a pixel diff can see is not a user-facing control.

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

**Testing the share buttons** needs three stubs, because both paths are async and both
end in something the page can't observe: define `navigator.clipboard` with capturing
`writeText`/`write` (the `write` stub must resolve the ClipboardItem's promise and read
the Blob back), and stub `fetch` so Short link resolves without TinyURL. Run it **twice** —
once as-is, once with `ClipboardItem` hidden — since the two clipboard paths are different
code and only the fallback runs on older Safari/Firefox.

**Testing a timed overlay** (the credits): drive the clock, stub WebGL off so pixels are
readable, then run the page twice — once with `?credits=<short>` and once with the
preference disabled — and hash the same driven frames. Early frames must **differ** (it is
drawing) and frames past the duration must be **byte-identical** (it left no trace).
That pair is what makes "it disappears on schedule" a real assertion rather than an
eyeball; a brightness/band heuristic can't tell thin glyphs from the effect's own structure.

**Testing that the credits ignore the camera** is a *logic* assertion, not a pixel one
(point-effect pixels aren't reproducible across runs). Inject an export hook just before
the app IIFE closes, stub WebGL off so `fire` is the live buffer, then call `creditStamp()`
directly with the camera set various ways and compare the set of lit `fire` indices: a
rotated camera must stamp **byte-identical** indices, `zoom = 2` must halve the stamped
bounding box while staying centred, and `plot(x, y, v)` *without* the raw flag must still
be moved by the camera (or the opt-out silently disabled the camera for effects). Run the
same probe against a copy with the fix reverted — both halves must go red, or the
assertions aren't biting. Note the two reverts are separate one-token edits and a naive
`.replace()` of `const z = EFFECTS[effect].bakesOwnZoom ? 1 : zoom;` hits `glRender` first.

**Pixel-level regression gates: shader effects only.** Driving the page with a stubbed
`requestAnimationFrame` (own the callback queue, feed a fixed 1/60 timestamp step) makes
*shader* effects bit-reproducible — Plasma hashes identically across runs and builds, so
it works as a before/after gate. The **point effects do not**: Sirpinfyer/Tetrafyer hash
differently between two runs of the *same* file, so a fire-path pixel diff is noise. Gate
those on logic instead (e.g. compare tick sequences in Node) rather than pixels. Also note
`--virtual-time-budget` stops the page after a dozen-odd frames, so any timing comparison
must drive its own clock rather than let the animation run.

**The filter registry** has `tools/filterprobe.js` (`node tools/filterprobe.js index.html`,
34 assertions): it slices the real `FILTERS` block and the extras helpers out of
`index.html` and runs them against stub effects. It pins the invariants that are easy to
break silently — every filter's params have defaults (else `presetState` can't seed
them), feedback filters all precede post ones in the registry and Bloom is last, a
stored list always applies in **registry** order, `filtersOk` drops unknown/duplicate/
non-string ids, the point-vs-shader defaults (an effect with `stamp` but no `draw` counts
as a point effect), and `presetState`'s seeded arrays are per-effect **copies**.
One behaviour it deliberately locks: an **empty** stored list is honoured (turning every
filter off is a real choice that must survive a round trip) and a list naming only retired
filters ends up empty — only a *missing* `filters` key falls back to the descriptor
default. It slices by markers: `// ---- FILTERS: stackable post-FX` … `function
initStates(`, and `function presetExtra(` … `function initExtras(`.

**The GL heat-tick feedback chain** has `tools/heatprobe.js` (`node tools/heatprobe.js
index.html`, 24 assertions): it slices the real `glBeginHeat` and runs it against a
recording stub `gl`. It exists because **a headless browser has no usable WebGL** — the
pixel harness can only ever drive the Canvas2D path, so the GL ping-pong parity is
invisible to it. It asserts, for chains of 0–4 passes from either starting buffer, that
`pendingDst` names the buffer the *last* pass wrote, that no pass samples its own render
target (undefined behaviour in WebGL), and that the final FBO is still bound on exit. The
two-pass case (Fire + Fade, the only one a user can hit today) is the one that
distinguishes `pendingDst = src` from the `1 - curHeat` bug — flipping that one token
turns 12 of these red. It slices by markers: `function glBeginHeat(` … `function
glBlitPoints(`.

**The cardioid seed orbit** has its own probe, `tools/juliaprobe.js` (`node
tools/juliaprobe.js index.html`): it slices the *real* seed source out of
`index.html` (the constants block through `juliaSeedAt`/`juliaSeed`) and drives it
on a fake clock, asserting the geometry the three Mandelbrot-seeded effects depend
on — the rim point matches the cardioid formula, the seed sits exactly `juliaInnerR`
off that rim (an `innerR` of 0 collapses it onto the rim), the inner phase advances
at `ratio ×` the outer one and yields `ratio` epicycles per lap, and `juliaOffX`
shifts only the real axis. It also greps the three descriptors to assert each
advances the orbit **once** per frame. It slices by source markers, so keep them:
`const RPM` … `function julia(`.

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
