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

**Which cardioid depends on the exponent.** The seed is only interesting just *outside*
the **connectedness locus** — the set of `c` for which the filled Julia set of `z^d + c`
is connected. Inside it, the filled set has interior that never escapes, so the render
pins whole regions at `i >= maxIter` ⇒ max palette. For `d = 2` the locus is the
Mandelbrot set and its period-1 boundary is the familiar cardioid. For any other `d` it
is the **degree-d Multibrot set**, whose period-1 boundary is a *different* curve:
`c = z − z^d` on `|z| = d^(−1/(d−1))` (from the fixed point `z^d + c = z` with neutral
multiplier `|d·z^(d−1)| = 1`). `cardioidAt(th, d)` is that curve.

This was hardcoded to the `d = 2` cardioid whatever the Power slider said, and Multibrot
ships Power *drifting* 2→3.5, so ~3/4 of every lap put the seed inside the real locus —
a solid white blob instead of dendrites. `juliaPower` carries the exponent: `setEffect`
resets it to 2 and Multibrot's `draw` sets it from `mbPower` **before** calling
`juliaSeed`, so the orbit rides this frame's power. At `d = 2` the formula reduces to
`|z| = 0.5`, `c = z − z²` — **bit-identical** (every power involved is exact in binary
floating point), which is what keeps AnimeJulia, Burning Ship and every `d = 2` preset
unchanged; `juliaprobe` asserts `max |Δ| == 0` over a full lap.

Two residuals worth knowing, both measured by the probe rather than hand-waved:
the inside-the-locus fraction is **not** 0 even at `d = 2` (≈15%) — scaling the cardioid
radially by `JULIA_MARGIN` walks the seed through the period-2 bulb near θ=π, and those
fat Julia sets are part of AnimeJulia's shipped look. And **fractional powers stay worse
than integer ones** (≈40–55% vs ≈20%): `z^d` uses the principal branch, discontinuous
across the negative real axis, so their locus is a messier object with more attached
components. The probe therefore asserts *matched beats mismatched by ≥20 points*, not
perfection — the honest property, and the one that goes red if `juliaPower` stops tracking.

**Lap-speed easing.** The orbit is *not* swept at constant angular speed: `juliaSeed`
scales each step by `EASE_K · (1 + JULIA_EASE_A·cos((power−1)·θ))`, so the seed sprints
through every cusp of the cardioid and eases off between them.
`JULIA_EASE_A = 0.5` ⇒ a cusp is exactly `(1+A)/(1−A)` = **3×** the slowest point.

**The `power−1` is the cusp count, not a tuning knob.** The degree-d cardioid
`c = z − z^d` has `dc/dθ = 0` exactly where `e^{i(d−1)θ} = 1`, i.e. at `θ = 2πk/(d−1)` —
**`d−1` cusps**: one at power 2 (the classic cardioid), two at 3, three at 4. A fixed
`cos θ` would sprint through the first cusp and crawl straight through all the others,
which is the opposite of the intent. This is also why **Multibrot's Power is an integer**
(`apply` rounds; the thumbs still animate continuously between them): a fractional power
makes `power−1` fractional, the warp no longer closes over a lap, and the locus itself is
ragged anyway because `z^d` uses the principal branch.

**`EASE_K = 1/√(1−A²)` is load-bearing**, and works unchanged at every power:
`∮dθ/(1+A·cos nθ) = 2π/√(1−A²)` for *any* integer `n`, since `u = nθ` just covers the
cosine's period `n` times. So a lap takes exactly `1/rpm` minutes at any power and every
existing preset keeps its pace; without `EASE_K` the same rpm would run ~15% slow.
At power 2 the whole expression is `cos(1·θ)` — bit-identical to the original, which is
what leaves AnimeJulia and Burning Ship untouched.

`juliaPower` is declared **above `juliaEase`** on purpose: the arrow reads it, and leaving
it below only worked while nothing called the ease during startup — this file has been
bitten by exactly that three times.

The warp applies to the **outer phase only** — the riding circle keeps its steady rate,
so its epicycles bunch up where the cardioid crawls and stretch where it sprints; that
unevenness is the point. Because lap *time* is preserved the
inner still completes exactly `ratio` turns per lap, just unevenly distributed. Note the
easing is symmetric about θ=π, so the two half-laps take **equal** time — the asymmetry
is per quarter (a probe assertion got this wrong before the maths did). `juliaSeedAt`
stays unwarped; the Cardioid debug view therefore **integrates** `dφ = ratio·dθ/ease(θ)`
as it walks the path (via the shared `juliaEase`) instead of assuming φ is linear in θ,
or the drawn epicycles would not match the ones on screen.
`juliaprobe` locks all of this down.

**Burning Ship rides the wrong cardioid too — and it does not matter. Measured, twice.**
Its connectedness locus is the Burning Ship set (iterate the critical point 0 under
`zy = 2|zx·zy| + cy; zx = zx² − zy² + cx`), not the Mandelbrot cardioid the seed traces,
so in principle it has exactly the bug Multibrot had. In practice it does not, because its
shipped `outrad` is **[1.4, 1.9]** where AnimeJulia's is 1.05 — whoever tuned it pushed the
orbit out by eye until it looked right, which empirically compensates. Sweeping a full lap
(720 outer × 24 inner phases) against the real ship locus: **4.6–31% inside across its
drift range, ~17% typical**, versus AnimeJulia's own **27.1%** against the Mandelbrot at its
defaults. Burning Ship is *better* than the reference scene, and screenshots agree — small
bright clusters with filigree, a disconnected Julia set, not a filled blob.

So: **do not "fix" this.** There is no closed form for the ship boundary, tracing it
numerically is real work, and it would change every Burning Ship preset for no visible
gain. The one thing worth knowing is that the compensation is a *magic number, not a
correction*: drag Outer radius down toward AnimeJulia-like values and it degrades fast —
28% inside at 1.2, 39% at 1.05, 45% at 1.0 — noticeably worse than AnimeJulia at the same
setting, because the curve genuinely is wrong for this family. If Burning Ship ever looks
washed out, Outer radius is the first thing to check.

- **Point-accumulation effects** (Sirpinfyer, Tetrafyer, Attractor) run the fire sim and
  stamp points into the heat grid via `plot()`. `simulate()` dispatches to the
  descriptor's **`stamp(box)`** hook if present (Attractor), else the `fractal2d` (2D
  chaos game) / tetra branches. Adding one = a descriptor with a `stamp` hook, no `draw`.
- **Glow**: `glRender()` / `render()` map heat through the palette, then composite
  an additive blurred copy for the bloom.

### Credits overlay
The startup credits render on **their own canvas** (`#creditcv`, `z-index: 4`,
`pointer-events: none`) drawn by `creditDraw()` from `frame()` **after** `glRender()`/
`render()` — so they sit above the effect *and* above the whole post-filter chain, and
below the menu at `z-index: 10`.

**They used to be stamped into the heat grid** through the same `plot()` the effects use,
which gave them the palette and let them burn away with the fire — genuinely nicer, and
the reason the old design existed. It was abandoned because the post filters mangled
them: Pixelate blocked the glyphs up, Mirror doubled them, Edge reduced them to outlines.
Chrome you cannot read is not chrome. Consequences of the move, all of them wins except
the first: no palette tie-in and no burn-away; but immunity to the camera and to display
zoom **for free** (an overlay is not in the buffer those transform), no accumulation
smear, and the panel's *actual* colours instead of a one-channel brightness stand-in —
role `#ffb15a`, name white at `.8`, "aka" at `.45`, handle `#ffcf87`, straight off
`#panel .credit-*`. Each run is drawn twice, once with a dark halo and once with a warm
glow, so it stays legible over a bright frame without looking like a caption.

Gone with it: `creditStamp`, `creditRaster`, the `fw`/`fh` mask cache, `creditZoomCap`,
and `plot`'s fourth `raw` argument (added solely so the credits could skip the camera —
every caller wants the camera now). `CREDITS` still drives **both** the overlay and the
panel's Credits box via `buildCreditList()`, so the two cannot drift.

**Timing is `CREDIT_HOLD` (5s) at full, then `CREDIT_FADE` (3s) ramping to nothing**;
`CREDIT_S` is their sum and `creditLeft` counts the whole thing down in **rendered** time
(`dt` from the frame loop), not wall clock — a backgrounded tab stops rAF, and a
wall-clock timer would run the credits out unseen. `creditAlpha()` is 1 while
`creditLeft >= CREDIT_FADE`, then `creditLeft/CREDIT_FADE`. `?credits=<s>` overrides the
**hold**; the fade is always added on top, so `?credits=600` parks them on screen and
still fades the same way. Once expired `creditDraw` clears the layer once and sets
`display: none`, so it costs nothing for the rest of the session.

The on/off preference lives in its own `localStorage` key, deliberately **not** in the
scene blob — it is a per-browser choice, not part of a shared or backed-up scene.

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

Post filters are GPU passes; on the Canvas2D fallback they carry `cpuOk: false`, which
greys out their checkbox. They are masked **at the point of use** — `cpuBlocked` is
consulted by `filterOn()`, which `activeFilters()`/`hasFeedback()` route through — and
are deliberately **never removed from `activeIds`**. `loadExtra` used to delete them on
load, and since `saveExtra` writes `activeIds` straight back out, opening a scene on a
fallback machine and touching anything **permanently stripped Pixelate/Blur/Edge/
Posterize/Mirror from it**. A ticked-but-greyed checkbox honestly reads "stored on,
unavailable here" and survives the round trip. `cpuBlocked` is filled by the FILTERS
block but declared up with the render globals, and is empty until then — which is what
keeps `filterOn` safe to call during slider wiring, long before the registry exists.

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
  is **transient** (not persisted). **`dockAll()`** empties the column whenever the scene
  changes, so a stack left over from the previous one isn't stale furniture: `setEffect`
  calls it first (covering effect switches, preset applies and the auto-cycle), and so do
  `createPreset`, the Delete handler and the preset `<select>`'s `change`. That last one
  docks **up front, before dispatching**, because it has to cover both branches — picking a
  preset would dock anyway via `applyPreset` → `setEffect`, but **"— unsaved scene —" never reaches
  `setEffect`**, and leaning on that chain would make the behaviour quietly depend on where
  `setEffect` happens to call `dockAll`. Rename deliberately does *not* dock: the scene is
  unchanged, only its label. `dockAll` goes through `dockCtl` per key rather than clearing
  the set, so the menu rows' `+`/`−` buttons can't desync from `popped`. Because `#breakout` sits *outside* `#panel` (the
  panel's `backdrop-filter` + `overflow` would clip a fixed child), three things are
  wired to reach it too: the control-appearance CSS is scoped to `#panel …, #breakout …`;
  the delegated `onEdit` (persist/autosave) is attached to `#breakout` as well; and
  `sceneRangeInputs()` scans `#panel` + `#breakout`. Element refs (`anims`, `el(id)`) are
  location-independent, so a moved slider keeps animating, saving and loading unchanged.
  A box holds, top→bottom: the **owner line** (`.ctl-owner`), the label + value, the beat
  chips + pulse picker on their own line, the slider, its **pulse-length** knob (`.plen`)
  and its **range editor** (`.rng-edit`) — the last three exist only in a box
  (`#panel .plen { display:none }`, and the owner line and editor are added to the `.ctl`
  node when the box is built).
  The **owner line** says which effect/filter the box belongs to, from `ctlOwner(key)` →
  `CTL_GROUPS[control.group]`, with a `"Filter · "` prefix for the `f_*` groups so the
  Fire *filter* can't read as the Fire *effect family*. It exists because controls are
  singletons reused across effects, so a stack of boxes labelled "Speed", "Strength",
  "Size" is unreadable — Plasma's Speed and Tunnel's Fly speed, or Bloom's Strength, are
  otherwise indistinguishable once popped. It is safe to add unconditionally in
  `POPPABLE.forEach` because a `.ctl` node is *only* ever visible inside `#breakout`; the
  menu slot shows the `.ctl-row` launcher instead. (Non-poppable controls — `check`,
  `layers` — keep their `.ctl` in the panel, which is why the line is added in the
  poppable loop and not in `ctlHTML`.)
- **Defaults** — `defaults` (slider values), `beat` (chip selections), `extras`
  (palette/morph/showBox/randSeed) seed `states[e]`/`beatStates[e]`/`extras[e]` via
  `presetState`/`presetBeat`/`presetExtra`. `defaults` includes a few render-affecting
  keys the effect doesn't display (e.g. `band` at 0) so switching to it resets them.
- **Render** — `frame()` runs the effect's `draw(dt)` (shader) or the fire-sim
  accumulator; `simulate()` stamps 2D when `fractal2d`; `glRender/render` force display
  zoom to 1 when `bakesOwnZoom`; `setEffect` runs `onEnter`; `renderHelp` filters by `helpTags`.
- **Identity** — persistence uses the **stable string `id`**, not the numeric index:
  `serializeBlob`/`deserializeBlob` convert at the storage edge and `LEGACY_EFFECT_IDS`
  migrates pre-id blobs, so reordering/removing effects never corrupts saved data.
  `effect` stays the runtime numeric index (registry position).
  That covers **two** things, and for a long time it only covered one. `effect` and
  `presets[].effect` were converted, but the per-effect maps (`states`, `beats`,
  `pulses`, `plens`, `extras`) were still stored keyed by registry *position* — so a
  reorder handed every saved scene to whichever effect had moved into that slot, in
  localStorage, Backups and share links alike, while presets stayed correct. `EFFECT_MAPS`
  + `keysToIds`/`keysToIdx` close that: keys go out as ids and come back as indices, a
  numeric key is read as a pre-id blob (the registry has only ever been appended to, so
  its recorded position is still right), and an id that no longer ships is dropped rather
  than misfiled. `presetprobe` serializes under one registry and deserializes under a
  shuffled one to prove scenes follow their effect — the failure is otherwise invisible
  until the day someone actually reorders `EFFECTS`, by which point every user's saved
  settings are already wrong.

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
a modal**) rendering the connectedness locus in the c-plane with the seed's full cardioid, the
path it actually traces at the current ratio/radii, the riding circle and the live seed
point drawn over it. Non-modal on purpose: you tune the orbit sliders *while watching it*,
so it must never intercept a click — don't reintroduce a backdrop or click-outside-closes. It samples **`juliaSeedAt(outer, inner)`** — the pure part split out
of `juliaSeed(dt)`, which also applies the **`cardx`** slider's `juliaOffX` real-axis
shift — so opening it never advances the animation and it always shows the true orbit. `frame()` redraws it
while open. The backdrop is **`cardLocus(w, h, d)`** — the Mandelbrot set at power 2, the
degree-d Multibrot otherwise, matching whatever the seed is actually riding. Drawing the
Mandelbrot under a Multibrot orbit made the panel *lie*: the seed looked comfortably
outside the set while sitting deep inside the locus that governs it. Since Power drifts
continuously, the bitmap is quantised to `CARD_POW_Q` (= the slider's own step) and
rendered at **half resolution** into an offscreen canvas that `drawImage` scales up —
a full-res 120-iteration repaint per frame is far too slow for a debug overlay. It keeps
an integer-2 fast path (no `pow`/`atan2` per step). Transient: never persisted,
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
default), *Backup, restore & share* (the 2×2 `.presetrow.grid2`), *Scene* (the preset
chooser, auto-cycle and TTL), *Effects* (`#effect`, `#fxctl`, Cardioid debug, Reset) and
*Palette settings* (`#palette`, `#palctl`, `#bandctl`). `buildControls` routes a control by
`host`: `"band"` → `#bandctl`, `"pal"` → `#palctl`, else `#fxctl`.
The **Effect chooser sits in *Effects*, above `#fxctl`** — with the sliders it drives
rather than up in *Scene*, which is now purely about presets. That is also why
`#fxctl > .ctl-grp:first-child` no longer suppresses its top border: the first group used
to butt against the box title (where a rule read as a stray line) and now separates the
chooser from the sliders. Note the Restore dialog's "Effect settings" checkbox is a
*different* thing — a blob category (states/beats/extras), not this section.

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

**`setEffect` deliberately does not clear the heat buffer.** It used to
(`fire.fill(0)` + `glClearHeat()`), which blinked the screen to black on every switch —
including every auto-cycle preset change, a few seconds apart. Leaving the outgoing
effect's heat in place lets it decay *under* the incoming scene, so the switch dissolves
instead. It only reads as a fade when the incoming scene has a **feedback filter** (Fire
or Fade pixel) to decay it; with none, `applyFilters`/`glBeginHeat` rewrite the whole
buffer on the first frame regardless — that is the clean-slate contract those paths
already document, not a regression. `acc = 0` still resets, so no banked sim time carries
across.

**Beat chips ship unarmed.** Every effect's `beat` map is empty and the *unarmed*
chip styling is deliberately colourless and dim — the per-band colours (L blue, M green,
H red) apply only to `.on`. A vividly outlined chip reads as enabled even when nothing is
armed, which is exactly how it used to look.

**Beat-trigger dots** (`.ctl-dot`, `dotEls`) give the same information *without* popping
every box: each menu row carries up to three dots between the name and the `+`/`−` button,
one per band, in the same colours as the chips. A dot is `display:none` unless its band is
armed, sits at `opacity .34` when armed and idle, and is lit by `flashChips()` on that
band's beat — same `audio.pulse` the chips ride, quieter treatment, because it is an
overview rather than the control. So the shape of a preset's beat mapping reads straight
off the menu. Two things keep it honest: `syncDots()` is called *from* `syncChips()` rather
than alongside it, so every path that arms a chip (`loadBeat`, Reset, a chip click) updates
both and none can be forgotten; and dots are built only for keys present in `chipEls`, so
a `plain` control like `points` — poppable but never armable — correctly gets none.
`#panel.audio-off .ctl-dot` dims them when nothing can trigger, matching `.bandchips`.
`flashChips` only runs while `audio.on`, plus once on the way down, which is what clears
the inline lit styles back to the CSS default.

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
A **preset** is a named full-scene snapshot, built by `snapshotScene()`:
`{name, effect, state, beat, pulse, plen, cam, beatTune, ranges, extra}`.
The last three of those are **globals deliberately remembered per preset**, because a
preset has to be a *complete* copy of what is on screen — it is something you hand to
someone else, and anything it fails to carry renders as the recipient's value instead,
invisibly. `cam` because `camrx/camry/camrz` exist nowhere else (no effect's `defaults`
names them); `beatTune` because different thresholds mean different beats mean a
different animation; `ranges` because `mergeState` does **no** bounds check and
`loadState`'s `el.value = …` is then silently clamped by the DOM, so a value authored
against a widened bound quietly animates differently. `applyPreset` applies `ranges`
**first**, mirroring `applyBlob`'s ordering, for exactly that reason.
`tools/presetprobe.js` asserts by construction that every field `applyPreset` restores
is one `snapshotScene` captures *and* one the import mapping carries — the check exists
because `applyRestore`'s mapping silently dropped `cam` for a long time.
What deliberately does **not** travel: resolution (`cfg.scale`, a device setting — it
changes flame height in screen pixels, point density and glow radius, but a scene from a
fast GPU must not tank a phone), audio on/off (needs a user gesture), the `randSeed`
orbit re-roll, the `Date.now()` chaos seed, and every accumulated phase (`simT`,
`spinAngle`, `*Time`). A shared scene is the same *configuration*, not the same *frame*.

**Creating a preset and restoring a backup both stop the cycler** (`stopCycling()`).
Auto-cycle is on by default, so `createPreset` selected the new preset correctly and then
the very next TTL tick swapped it straight back out — which reads as "my new preset wasn't
selected" when in fact it was, and then got cycled away from. `applyRestore` can't call
`stopCycling()` because it reloads the page, so it writes `out.cycle = false` into the blob
instead, set **last** so it also overrides the backup file's own `cycle`: whatever the
backup was saved with, you want to see what you just restored.

**Switching effect prefers that effect's own preset.** `effectSel`'s change handler looks
for a preset whose `effect` matches and **applies** it — so you land on a real named scene
rather than "— unsaved scene —" on every single effect change. It must be *applied*, not
merely selected: selecting alone would leave the live scene ≠ the preset, and the first
slider drag would autosave whatever was on screen over it. `applyPreset` runs `setEffect`
with `save=false`, so the **outgoing** effect's scene is saved explicitly first or its live
tweaks are lost. Only when no preset uses that effect does it fall back to dropping the
selection. Either way the original guarantee holds: a preset is never rewritten to a
different effect — the new selection is a preset that *already is* the new effect.

**Switching effect leaves the selected preset** (drops the menu to "— unsaved scene —") rather
than rewriting it. A preset carries its own effect, so the delegated autosave used to
fold the switch straight into it: pick "Sirpinfyer", switch to Tunnel, and your
Sirpinfyer preset silently became a Tunnel scene under its old name. Suppressing autosave
for just that one event would not have been enough — the preset would keep its old effect
only until the next slider drag wrote the new one in. Deselecting fixes both, because
`autosavePreset()` early-returns while `curPreset < 0`. The deselect lives in the effect
`<select>`'s own listener, which runs in the **target phase**, before the delegated
`onEdit` bubbles up to `#panel` — that ordering is what makes it win the race. Assigning
`presetSel.value` does not fire `change`, so `applyPreset` is not re-entered.

Presets are **local to the browser**. Selecting one links edits to it: `onEdit` → `autosavePreset()`
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
- **Share** encodes **only the current scene** — `{states, beats, pulses, plens, extras,
  effect, cam, beatTune, ranges}` where every per-effect map holds exactly **one** entry,
  the effect on screen (NOT presets). It used to send all fifteen effects' settings;
  "here is the thing I made" should send that thing, and the other fourteen were most of
  the payload. Measured on a Tunnel scene: **JSON 6808 → 661 chars, URL 1492 → 601**.
  The map *shape* is deliberately unchanged (`{ [effectIndex]: … }`, just shorter), which
  is what makes it a one-function change: **no decoder change, and every old
  all-effects link still decodes** — `applyBlob` iterates its own maps and skips keys the
  blob omits, so absent effects simply keep the defaults `installShared` re-seeded. A
  probe builds an old-style two-effect payload and asserts both still restore.
  `cycle` and `ttl` are deliberately **dropped**: they are the recipient's own auto-cycle
  preferences and sharing a scene is no reason to reach in and change them (`applyBlob`
  guards every read of them, so omitting is safe). `beatTune` is now included, since it
  became scene data. Delivered as a `?z=<deflate-raw+base64url>` URL (legacy `?s=` is
  plain base64 and still decodes); `applyShared()` decodes on load and strips the param.
  **`stripShareParam()` runs during startup**, so anything reading `location.search`
  after load — a test, say — sees it already gone.
  `shareUrl()` builds it; **`pruneBeats()` diffs the beat chips against each
  effect's `presetBeat(e)` defaults and sends only what differs** — the full map
  is every control × L/M/H and was a large part of the blob back when every effect
  rode along (49k-char URLs, which chat clients truncate and TinyURL rejects; a
  truncated `?s=` silently JSON.parse-fails and opens the default scene). Still worth
  keeping now that only one effect is sent: the pruning and the single-effect payload
  compound rather than overlap. **`prunePulses()` does the same for
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
- **Backup** writes **one file per preset**, named after the preset, plus one
  `_settings.json` for everything that is not a preset. It used to be a single blob —
  a fine backup and a terrible way to hand someone one scene, since they had to import
  the whole library and hunt for it. `backupFiles()` builds `[{name, text}]`; each preset
  file is `{app, kind: "preset", version, preset}` and each is routed through
  `serializeBlob` so `effect` is the stable id. `curPreset` is deliberately **not** in
  `_settings.json`: it is an index into a list that no longer travels as a list.
  - **Delivery** splits on `showDirectoryPicker`. Chromium: write into
    `BurnTheWeb/<YYYY-MM-DD_HHMM>/` — one dated folder per backup, all siblings. There
    was briefly a `<scene>-backup/` level in between, named after the selected preset;
    it was wrong, because a backup is *every* preset, so it described the wrong thing
    and split one backup history across as many folders as you had presets.
    Everything else: one download
    per file, named `backup-<stamp> - <preset>.json`, **spaced ~150ms apart** because
    browsers drop back-to-back downloads. The fallback flattens rather than nests
    because the HTML spec has user agents sanitize path components out of `a.download`
    — `"backup-x/y.json"` arrives as one mangled file, not a folder, so nesting that way
    is not an option anywhere.
  - **The folder is asked for once, then remembered.** A `FileSystemDirectoryHandle` is
    structured-cloneable, so it lives in IndexedDB (`burnTheWeb.fs`) — localStorage can't
    hold one, it only stores strings. `backupRoot()` reuses the stored handle when
    `queryPermission` still says `granted` (silent) or `requestPermission` returns granted
    (a one-click chip, *not* a folder browser); anything else falls through to a fresh
    pick. **Shift-clicking Backup forces a re-pick** — that is the only way to move it, so
    it is spelled out in the button's `title`. A write failure (folder deleted, grant
    revoked) calls `bkClear()` so the next click re-picks instead of failing forever.
  - **`bkStore` must always resolve.** Every IDB step is wrapped, because a throw inside
    an IDB event handler leaves the promise pending *forever* and hangs Backup rather than
    merely skipping the cache — `put()` throws `DataCloneError` wherever handles aren't
    cloneable. The probe found this by accident and it is a real failure mode, not a test
    artifact.
  - Probing this needs **both** stubs: a fake `showDirectoryPicker` *and* a fake
    `indexedDB` — and the latter must go in via `Object.defineProperty`, since plain
    assignment to `window.indexedDB` silently no-ops in Chromium and the app then quietly
    uses the real one (which rejects a fake, non-cloneable handle).
  - **`safeFileName`** exists because a preset name is free text that becomes a filename:
    it strips path separators and Windows-illegal characters and control codes, trims,
    drops trailing dots/spaces (Windows removes them silently), escapes reserved device
    names (`CON`, `NUL`, `COM1`…), truncates to 80, and falls back to `Preset` for an
    empty name. `backupFiles` de-duplicates collisions with ` (2)`. `presetprobe` pins
    all of it.
- **Restore** takes **multiple files** (`#presetsfile` has `multiple`) — a whole backup
  folder, or the single preset file a friend sent. `normalizeBackup()` folds every shape
  we have ever written into the one the restore path understands (single preset file,
  settings file, whole-library snapshot, legacy `{presets, ranges}`, oldest bare array)
  and runs **before** `deserializeBlob`, so the id→index mapping lives in one place.
  Presets accumulate across all selected files; the settings come from whichever file
  carries them. `openRestore(parsed, valid, name)` shows a checkbox per part the
  selection actually contains plus a merge-vs-replace radio — **Presets is no longer
  always enabled**, since selecting only `_settings.json` is legitimate. `applyRestore()`
  starts from the current `fullSnapshot()` and overrides only the ticked parts — presets
  merge by name or fully replace — then writes to `localStorage` and **reloads**, so the
  normal load path (`restore` → `applyBlob` → `setEffect` → `resize`) reapplies it
  exactly. (`location.reload` is non-configurable in Chromium, so a test cannot stub it;
  read `localStorage` synchronously after the click and stash the verdict in
  `sessionStorage`, which survives the navigation.) There is no per-effect text
  Export/Import — removed; **Share** is the only text-export path.

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
  live. It is **per-preset scene data** — `snapshotScene` stores it, `applyPreset`
  installs it, and it rides in `localStorage`, the Backup file *and* Share links, so a
  scene reacts to music the same way wherever it is opened. `mergeBeatTune(saved)` has
  **replace semantics** (start from `BEAT_DEFAULTS`, overlay only valid supplied fields),
  which is the whole point: merging into the live `beatCfg` instead would leak the
  previously selected preset's tuning into any preset that omits a field — and a preset
  saved before the feature omits all of them. `installBeatTune` writes the fields into
  `beatCfg` **in place**, never replacing the object: `audioTick` closes over it and
  `beatprobe` slices it straight out of the constants block, so it must stay there and
  stay the same object. It also re-runs `beatBuild()` (the sliders never refresh
  themselves) and `computeBins()` — the latter only when `audio.on`, since it throws
  before audio has started. `presetprobe` locks the merge semantics down.

`audioTick` runs on a **fixed `setInterval(HOP_MS)` (100Hz), not on rAF** — beat
timing must not jitter with framerate, and two beats inside one slow frame would
otherwise collapse into one. Beats found between frames are **latched** in
`beatNow[]`; `frame()` calls `updateAnims()` (the only consumer) and then
`clearBeats()`. `audioTick(t)` takes an optional timestamp so tests can drive it on
a fake clock.

### Diagnostics tools (not user settings)
The dev tools live in a `<details id="diag">` **Diagnostics** section at the bottom
of the System box (there are no dev keys — the whole UI opens via ☰ or **m**). They're
off by default, never enter presets, and their open/closed state is never saved. Because
they sit *inside* `#panel`, the panel-wide scans guard against them: `onEdit` (the
delegated persist listener) and the `RNG_ORIG` capture early-return on
`e.target.closest("#diag")` / `inp.closest("#diag")`, so a dev-tool edit never autosaves
into a preset. (The slider-range editor used to be a tool here; it now lives per-slider
in the pop-out boxes. Beat tuning used to be one too — see below.)
- **`dbg` — beat trace** (`#diagTrace` checkbox / `?debug=1`): a floating
  `position:fixed` canvas (built by `dbgInit`), toggled from the checkbox:
  scrolling flux + adaptive threshold + beat ticks per band. The tool for diagnosing a
  missed beat. Persists nothing. Its lane labels read `beatCfg.bands` live, so they
  track band edits from the Beat tuning box.

**Beat tuning is NOT one of these** — it moved out of `#diag` into its own
`<details class="box" id="beatDetails">` beside the other scene controls, because it
became per-preset scene data and therefore has to autosave like every other control.
That move is more than markup, and each part is load-bearing:
- Its CSS was entirely `#diag`-prefixed and is now scoped to `#beatDetails`. The
  `.rng-btns` button rule is still `#diag`-scoped, so the box carries its own copy.
- Escaping `onEdit`'s `#diag` early-return is the *point* — edits now persist and fold
  into the selected preset. `beatChanged` therefore must **not** `persist()` itself, or
  every drag double-writes. `beatReset` is a click, not an `input`, so `onEdit` never
  sees it and it persists + autosaves by hand.
- `RNG_ORIG` and `refreshRangeUI` skip `#beatDetails` explicitly as well as `#diag`:
  the generated beat sliders have **no `id`**, so letting them into the ranges scan
  writes an `RNG_ORIG[undefined]` entry and `collectRanges` then emits a junk
  `undefined` key into every saved and shared blob.
- `beatUi` is a **`var`**, like `card`: `installBeatTune` runs during startup
  (restore/share → `applyBlob`) long before the declaration, and reads
  `beatUi && beatUi.wired`. With `let` that read is a TDZ crash rather than a falsy skip.
- `applyPreset` rebuilds the sliders (`beatBuild`), so any reference held across a preset
  switch is a **detached node** — its listeners still fire but nothing bubbles to
  `onEdit`. That bit a test before it bit a user.
`beatUi` is separate from the many `beat*`/`BEAT_*` scene-audio names.
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
- **Tetrafyer's view has two rotations**, and only one used to be controllable.
  `Rotation` yaws (`spinAngle`); the **pitch** was a hardcoded `0.30·sin(simT·0.12)` —
  the ±17°, minutes-long nod that reads as "the box is slowly rotating by itself".
  It is now `nodAmp·sin(nodPhase)` behind the **Box nod** (degrees) and **Nod speed**
  (×) sliders. `nodPhase` is **accumulated per tick** (`NOD_RATE · nodSpd · cfg.speed /
  cfg.burn`), not derived as `0.12·simT`: now that the rate is a slider it can be
  animated or beat-armed, and reading it off `simT` would teleport the nod mid-swing —
  the same reason `simT` and `spinAngle` accumulate. At `nodSpd` 1 the phase tracks
  `0.12·simT` exactly, so the shipped default reproduces the old motion (the probe pins
  this to 1e-9). Still multiplied by `cfg.speed`, so Drift speed drives it as before.
- **Palette** is baked into a `Uint32Array` in **little-endian ABGR** for direct
  pixel writes; index 0 is forced opaque black. **Banding** (AnimeJulia-only) is a
  *filter* over the active palette, not a palette of its own.
- **A preset switch always blends the palette in from whatever was on screen** (no snap),
  but **where it blends to depends on the palette cycle**. Cycling on ⇒ a fresh random
  palette, and it keeps cycling. Cycling pinned (`palcycle` band tops out at 0) ⇒ the
  palette the preset actually **stored**. It used to be random either way, which meant a
  preset could never show its own colours — invisible while presets were browser-local,
  and the single biggest "why doesn't this look like yours" the moment they became
  something you hand to someone else. `applyPreset` snapshots the live `paletteBase`
  *before* `setEffect`/`loadExtra` can overwrite it, then calls **`beginMorph(fromRamp,
  morphing ? pickOther(...) : +paletteSel.value)`** — `startMorph(i)` is just
  `beginMorph(paletteRGB(i), pickOther(i))`, the discrete-source case. `beginMorph` paints `fromRamp` into `paletteBase` immediately
  (so an auto-cycle switch made mid-`frame()` doesn't flash the target for one frame) and
  arms the blend; `morphOnce = !morphing` makes it a one-shot when auto-morph is off (which
  `morphStep` settles via `setPalette(morphTargetIndex)`) and a continuing cycle when on.
  The frame loop runs `morphStep` when `morphing || morphOnce`; a manual palette pick or a
  plain scene load clears `morphOnce`.
- The Sierpiński chaos game is stamped inside a **safe box** (top 20% and
  left/right/bottom 5% excluded) via `plot()`; Size/Rotation scale & spin the
  corners about the box centre and can push points past those bounds.
- `cfg.scale` changes need a `resize()` to reallocate buffers.
- **Reset** restores the current effect's `state`/`beat`/`pulse`/`plen`/`extra` **and the
  shipped slider bounds** (`RNG_ORIG`, over every key in `presetState(effect)` — filter
  params included — before `loadState`, so values validate against the restored bounds,
  then `rngSyncAll()` so the in-box min/max fields follow). It used to reset every value
  and leave a widened slider still widened, which made "reset" measurably untrue; the
  per-slider ↺ (`resetControl`) had always done bounds, so the two now agree. It touches
  only the current effect;
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

**Testing the credits overlay.** It is a separate canvas, so read *it* rather than the
composited frame: `getImageData` on `#creditcv` and count pixels with alpha > 8. That
gives a clean "is it painting / is it fading / has it stopped" signal with no risk of
confusing glyphs for the effect's own structure. Assert the layer properties too — its own
canvas, `pointer-events: none`, z-index above `#fire` but under the menu — since those are
what actually make it immune to the filters.

**The claim to nail is that credits no longer touch heat**: fill `fire` with zeros, put
the credits up, call `creditDraw()`, and assert the buffer still sums to zero. Do *not*
try to prove it by running `simulate()` with credits up and down and diffing the heat —
`simT` advances between the two runs, so the geometry moves and the buffers differ for
reasons that have nothing to do with credits. (That exact mistake cost a red assertion
here; the direct test is both simpler and actually about the thing.)

**A standing lesson from the version that stamped into the buffer.** Its zoom-cancellation
probe passed cleanly — one stamp into a *cleared* buffer really did land where the maths
said — while the bug only existed across *accumulated* ticks with a *drifting* zoom, which
the probe never exercised. For anything that writes the retained heat buffer, a green logic
probe is necessary and not sufficient: drive a few hundred real frames and **look at the
screenshot** as well.

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

**Preset completeness** has `tools/presetprobe.js` (`node tools/presetprobe.js
index.html`, 44 assertions). Three parts — it also pins `safeFileName` (the Windows
filename traps: reserved device names, trailing dots, path separators in a free-text
preset name) and `normalizeBackup` (every backup shape we have ever written still
restores). Two halves for the preset itself. The **structural** half reads the real
`snapshotScene`, `applyPreset` and the import mapping out of the source and asserts every
`p.<field>` `applyPreset` restores is a field `snapshotScene` captures *and* one the
import mapping rebuilds — so adding a field to one and forgetting the other two fails by
construction rather than when someone notices their camera is wrong. That is not
hypothetical: the import mapping dropped `cam` for a long time, and because the failure
mode is "you silently get the recipient's camera", nothing local ever surfaced it. The
**behavioural** half slices `mergeBeatTune` and pins its replace semantics — that a
partial or empty tuning defaults the rest instead of inheriting the previously applied
preset's, that results are deep copies, and that junk (wrong types, inverted bands, bands
above Nyquist, a sparse `bands` array) is rejected without throwing. It slices by markers:
`const BEAT_DEFAULTS` … `const beatCfg`, `function mergeBeatTune(` … `function
installBeatTune(`, `function snapshotScene()` … `function defaultPresets(`, `function
applyPreset(` … `function createPreset(`, and `const valid = arr` … `if (!valid.length)`.

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
