# CLAUDE.md

Guidance for Claude Code in this repository. Terse by design: nearly every line is a rule that
cost something to learn. If a line says "don't", it has been tried.

## What this is

A self-contained demoscene visual on GitHub Pages (https://carlemil.github.io/burnTheWeb/).
Effects in four families share one palette + glow + banding + beat-reactive pipeline:

- **Point-accumulation** — Sierpiński (id `sirpinfyer`), Tetrafyer, Attractor (de Jong): stamp
  points into a rising-fire heat grid.
- **Shader fractals** — AnimeJulia, Burning Ship, Multibrot, Newton.
- **Shader pattern** — Plasma, Tunnel, Metaballs, Kaleidoscope, Rotozoomer, Moiré, Munching
  Squares, Copper Bars.
- **Shader SDF shapes** — Polygon, Shape grid, Concentric rings, Bouncing shapes (2D), Bouncing
  solids (3D raymarched).

Each is one `EFFECTS` descriptor (metadata + `params`/`defaults`/`beat`/`extras` + a `draw(dt)`
shader hook or a `stamp(box)` point hook). No package manager, test framework or runtime
dependency. Keep `README.md` (end-user docs) in sync when behaviour changes.

## Build

- **Source of truth is `src/`.** `src/styles.css` + `src/*.js` concatenated in **`src/manifest.txt`
  order** into `dev-index.html`. That order is load-bearing (TDZ + forward references) — don't
  reorder. Files named by subsystem: `audio-*`, `render-*`, `effects-*`, `orbit-*`, `persist-*`,
  `stack-*`, `controls-*`, `ui-*`.
- **`src/config.js` loads first and holds `CONFIG`** — every default not part of a preset
  (stack/layer limits, initial `cfg`, credits timing, auto-cycle/TTL/transition, palette
  morph/band, pulse defaults, `beatDefaults`, sync-nudge delays, analytics id, `version`, a
  `tuning` block). Scattered `const NAME = CONFIG.path` keeps each original name — change a
  default THERE.
- `PALETTES` is the single palette catalog; the `#palette` options and the swatches generate
  from it.
- **Never hand-edit `dev-index.html` / `index.html`** — generated.
- **`node tools/build.js`** rebuilds byte-for-byte (joins with `""`, substitutes via split/join —
  `String.replace`'s `$` handling would corrupt the JS). **`--check`** exits non-zero if stale.
- **Deploy with `/deploy`**: build, copy `dev-index.html` → `index.html`, commit, tag, push.
  `index.html` = production, `dev-index.html` = preview. Probes run against `dev-index.html`.
- **Every deploy is a numbered release.** `CONFIG.version` is the one version string. `/deploy`
  bumps it, writes the `CHANGELOG.md` section, tags `v<version>` — the tag must be pushed (it is
  what makes "commits since last release" computable). A version with **no tag** was prepared but
  not released: `/deploy` publishes *that* one rather than bumping past it. Semver where **major =
  a saved scene / share link / backup stops loading exactly as it did**; the standing rule is that
  never happens, so patch for fixes, minor for a new effect/filter/control. `CHANGELOG.md` is
  linked from the live page — user-facing.
- `.gitattributes` pins LF (global `core.autocrlf=true` would break byte-reproducibility).

## Workflow

- **Always commit and push after a completed, verified change.** Edit `src/`,
  `node tools/build.js`, commit **`src/` + `dev-index.html`** together, `git push origin HEAD:main`
  — updates the live `/dev-index.html` preview (~1 min). Don't ask before pushing the preview.
- Commit trailers end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  and the `Claude-Session:` line.
- Preview: open `dev-index.html`, or `python -m http.server`.
- Pages was configured once; don't re-run `gh api -X POST repos/carlemil/burnTheWeb/pages`.

## Architecture (one IIFE, authored across `src/*.js`)

### Dual render pipeline — WebGL2 primary, Canvas2D fallback
`useGL` is set by `initGL()`; every draw path branches on it.
- **Fire**: a low-res heat grid. GPU `glPropagate()` ping-pongs heat textures (cgtutor averaging
  `v = sum_of_4_below * 32 / decay`; `>128` decays, `<128` amplifies). CPU fallback = the double
  loop in `simulate()`.
- **Chaos-game points** stay on the CPU (deterministic) — additive GL points via
  `pushPt()`/`glDrawPoints()`, or `plot()` into the heat grid on CPU.
- **Shader effects** write per-pixel heat to the texture's `.r` (`o = vec4(heat,0,0,1)`), each
  with a CPU mirror. Each has an `FS_*` source + a `glProg.<id>` registered in `initGL`; the
  descriptor's `draw(dt)` calls `glShaderDraw(name, setU)` or the CPU mirror. `*Seed(dt)` advances
  the animation phase (identical GL/CPU).
- **Adding a shader effect = append one descriptor** with an `FS_*`+`glProg` pair, a `draw`/`cpu`
  pair, `params`/`defaults`. Its presence routes `frame()` past the fire sim; sliders generate from
  the `CONTROLS` schema.
- **Glow**: `glRender()`/`render()` map heat through the palette, then composite an additive
  blurred copy.

### Cardioid seed orbit (AnimeJulia / Burning Ship / Multibrot)
- All three call `juliaSeed(dt)` **once** in `draw` and pass the seed on. `julia(seed)` /
  `burningShip(seed)` / `multibrot(seed)` must **never** call `juliaSeed()` themselves, or the CPU
  path advances the orbit twice a frame.
- `juliaSeed` = rim point on the scaled main cardioid **plus** a riding circle of radius
  `juliaInnerR` at `ratio ×` the outer phase (that circle keeps the seed's neighbourhood varying
  instead of retracing one closed curve).
- **The cardioid depends on the exponent.** The seed is interesting just *outside* the
  connectedness locus: `d=2` ⇒ the Mandelbrot cardioid, otherwise the degree-d Multibrot boundary
  `c = z − z^d` on `|z| = d^(−1/(d−1))`. `cardioidAt(th, d)` is that curve. `juliaPower` carries the
  exponent — `setEffect` resets it to 2; Multibrot's `draw` sets it from `mbPower` **before**
  calling `juliaSeed`. At `d=2` the formula is bit-identical to the old hardcoded one, which is
  what keeps every existing preset unchanged.
- **Lap-speed easing**: each step scaled by `EASE_K · (1 + JULIA_EASE_A·cos((power−1)·θ))`, so the
  seed sprints through every cusp. `power−1` **is the cusp count**, not a knob — hence
  **Multibrot's Power is an integer** (`apply` rounds); a fractional power makes the warp not close
  over a lap. **`EASE_K = 1/√(1−A²)` is load-bearing**: it preserves lap *time* (`1/rpm` minutes) at
  any power, so presets keep their pace. The warp applies to the **outer phase only**; the easing is
  symmetric about θ=π so both half-laps take equal time.
- `juliaPower` is declared **above `juliaEase`** (the arrow reads it during startup).
- `juliaSeedAt` stays unwarped, so the Orbit editor **integrates** `dφ = ratio·dθ/ease(θ)` rather
  than assuming φ is linear in θ.
- **Burning Ship rides the "wrong" cardioid deliberately — do not "fix" it.** Its shipped `outrad`
  **[1.4, 1.9]** empirically compensates. If Burning Ship looks washed out, check that slider first.
- `tools/juliaprobe.js` locks this down.

### Bouncing solids (the one 3D shader effect)
`src/solids-3d.js` runs CPU rigid-body physics once per frame for up to 8 bodies and hands the
shader only the pose — `uPos` (centre+radius `vec4`), `uQuat`, `uShape`. `FS_SOLIDS` raymarches it;
the CPU mirror `solids()` marches the same scene at half the steps.
- **Orientation is a quaternion** (implicit surfaces have no vertices) — the shader undoes it per
  sample (`toBody`, rotating by the conjugate). Cannot shear like an accumulated 3×3 basis; one
  renormalise per frame.
- **Collision is a bounding SPHERE**; every SDF fits inside radius `r` (box half-extent `0.55r`,
  torus `0.70r`+`0.30r`, …). `Size` IS that radius.
- **The step is clamped (`min(0.05, dt)`)** — a backgrounded tab returns one enormous `dt` and a
  body tunnels through a wall forever.
- Bodies live on the **layer** (`L.solids`), like `L.tetras` — lists of objects, not scalar clocks,
  so they can't ride `PHASE_VARS`. `installStackItem` calls **`installSolids(L)`**; without it two
  Bouncing solids layers share one set.
- Start state uses `sdHash(k, salt, i)`, not sines (a near-π multiplier once stacked every body at
  x≈0); positions scale to the room available (`SOLID_BOX[ax] − radius`).
- `tools/solidsprobe.js` pins containment, quaternion normality, per-layer ownership, spread.

### Point-accumulation effects
Run the fire sim and stamp via `plot()`. `simulate()` dispatches to the descriptor's `stamp(box)`
hook if present (Attractor), else the `fractal2d`/tetra branches. Adding one = a descriptor with a
`stamp` hook, no `draw`.
- **They stamp at `POINT_HEAT` (`CONFIG.tuning.pointHeat` = 209), not 255** — 14 of 19 palettes are
  near-white at 255, and effects ship with no filters so the raw stamps *are* the picture. At 209,
  17 of 19 draw in colour; Fire and Grayscale are achromatic at the top by design.
- The chaos game stamps inside a **safe box** (heat grid less a 1px margin), shared by all three
  point effects. Size/Rotation scale & spin the corners about the box centre.

### Credits overlay
Drawn on **its own canvas** (`#creditcv`, `z-index: 4`, `pointer-events: none`) by `creditDraw()`
from `frame()` **after** `glRender()`/`render()` — above the effect and the whole post-filter chain,
below the menu (`z-index: 10`). Stamping them into heat let post filters mangle them; the overlay
buys immunity to camera, display zoom and accumulation smear.
- `CREDIT_HOLD` (5s) full, then `CREDIT_FADE` (3s) ramp; `creditLeft` counts **rendered** time
  (`dt`), not wall clock. `?credits=<s>` overrides the hold; the fade is always added. Once expired,
  `creditDraw` clears once and sets `display: none`.
- `CREDITS` drives both the overlay and the panel's Credits box (`buildCreditList()`).
- The on/off preference has its own `localStorage` key, **not** the scene blob.

**The scene banner (`#scenebanner`) is DOM CHROME, not part of the frame.** On every scene change it
names what you switched to — `"<scene name>  ·  <account>"` — in the top button row, right of mute.
As chrome it is immune to filters and camera, stays crisp at any render resolution, costs the render
nothing. `showSceneTitle(name, author)` fills it and arms `titleLeft` from
`CONFIG.credits.titleHold`/`titleFade` (2.5s + 1.5s — shorter than the credits, it fires on every
auto-cycle tick); `sceneBannerTick()` pushes that clock onto the element.
- **"After the credits" needs BOTH halves.** `frame()` decrements `titleLeft` only in the `else` of
  `creditLeft > 0` (so a scene applied during the opening credits waits), **and** `sceneBannerTick`
  must gate on `creditLeft <= 0` — a DOM element shows the moment it is armed, and startup arms one
  *before* `startCredits()` sets the clock. The tick is called **unconditionally**, not inside that
  `else`: the tick taking `titleLeft` to 0 must still run to hide it. Re-arming restarts the
  countdown, so switching twice quickly shows the second name.
- **`applyPreset` must not read `p.name`/`p.collection`** — `presetprobe` asserts every `p.<field>`
  in `applyPreset` is one `snapshotScene` captures, and neither is. It calls **`sceneTitleFor(i)`**
  (declared beside `collectionOf`), which does the reads.
- The author is `collection`. Absent ⇒ yours ⇒ the `#cloud-name` value; with no profile the title
  is the name alone (dash dropped too). Deliberately **not** `myCollectionLabel()`, whose
  `"My scenes"` fallback is a list heading.
- Own `localStorage` key + the **"Show author"** checkbox (`#sceneTitleOn`) in the **Scene box under
  Auto-cycle**, not beside the credits switch. Two prefs: credits are about the first five seconds,
  this fires forever after. Don't add a second copy in the Credits box.
- That checkbox and `#creditsOn` carry **`data-nopersist`** — per-browser prefs authored inside
  `#panel`; without it the delegated `onEdit` autosaves the live scene into the selected preset on
  every tick.
- **`createPreset` does not arm it**: saving the scene you are already on changes its label, not the
  picture.

### Preset transitions
`TRANSITIONS` is a third registry beside `EFFECTS` and `FILTERS`. It exists because the free
dissolve from `setEffect` only works when something **retains** the buffer; with no feedback filter
`glBeginHeat`/`applyFilters` rewrite the buffer on frame one by design.

Sixteen entries, each a `mode` of the single **`FS_TRANS`** pass: `cut`, `burnoff`, `crossfade`,
`dip`, `flash`, `pixelate`, `blur`, `wipe`, `iris`, then the **staggered-reveal family** — `checker`,
`bars`, `shutter`, `slide`, `clock`, `dissolve`, `ripple`. Two need no pass: `cut` does nothing, and
**`burnoff` lends retention** (`hasFeedback()` is true while `transBurning()`).

**`cut` IS NOT A CHOICE — it is the floor under the choices.** It is not listed in the picker, never
auto-picked while anything else is ticked, and ticking anything drops it from the set. Everything
here therefore iterates **`TRANS_PICKABLE`** (`TRANSITIONS` minus `cut`), not `TRANSITIONS`:
`buildTransPick` lists it, `setTransUse` materialises and size-compares against it (comparing a full
set to `TRANSITIONS.length` would never collapse to `null`), and `pickTransition` pools from it.
`cut` survives only as the one-member set `{"cut"}` — how "none of these, thanks" is stored, and
what "Select none" writes; `pickTransition` finds an empty pool and falls back to it. Unticking the
last row writes that set rather than collapsing to `null` (= all), or "none" would mean "everything".

- **The staggered family is one idea with seven delay fields** — each part of the frame gets its own
  moment in 0..1, revealed by the same soft step; only the field differs (cell parity, bar index,
  distance from a slat centre, angle, hash, ring radius). `slide` is the exception (a translation of
  both frames). `hash21` has no time term on purpose — a dissolve that re-randomised per frame would
  boil.
- **CPU mirror** covers the mask-based ones (wipe, iris, checker, bars, shutter, clock: paint a
  white mask of what changed, `destination-in`, put the old frame underneath) and `slide` (two
  `drawImage` calls at an offset). `dissolve`/`ripple` are per-pixel and fall through to a
  crossfade — a truthful stand-in on a path that only runs where there is no GPU.
- **`transUse` shape**: `null` = all pickable (shipped state, and what every older blob decodes to);
  stored **by stable id**, not index, because the registry is a fixed list of named modes. A global
  blob field, skipped while `sharing` (the recipient's own preference, like auto-cycle).
- **Where the pass runs matters**: `glRender` sends the zoom output to `glFbo.post[0]` instead of
  `glFbo.scene` while a transition is live, so the blend happens *before* the glow. Zero cost idle.
  `render()` mirrors all seven visible modes with canvas ops.
- **The outgoing frame is frozen** (`transBegin` copies `glTex.scene` → `glTex.prev`).
- **Auto-pick** is `fits(a, b) → weight` over `sceneInfo()` summaries (`{dense, retains, palette}`)
  — no pixel readback. Both dense ⇒ `crossfade`; density differs ⇒ `pixelate`/`blur`/`wipe`;
  palettes far apart ⇒ `dip`/`flash`. (`cut`'s own weight of 3 when either side retains is now
  unreachable — it is out of the pool.)
- The **Transition** slider is a [min,max] seconds range drawn per switch like `ttlMs`/`morphMs`.
  Both thumbs at 0 = cut. `trans.t` advances in **rendered** time.

### Filters (post-FX)
`FILTERS` is a second registry. **Three stages by where the filter writes**, and the registry must
list them in that order (`filterprobe` asserts it):

- **feedback** (`Fire`, `Fade pixel`, `Diffuse`, `Echo`, `Zoom feedback`, `Swirl`) — mutate heat that
  survives to the next frame, so they run inside `glBeginHeat` *before* the effect's output is
  MAX-injected. With no feedback filter `glBeginHeat` **clears** (skipping would read 2-frames-stale
  heat) and the CPU path zeroes `fire`.
  - Echo/Zoom feedback/Swirl are **one program**, `FS_HWARP`, via
    `glWarpFeedback(src, dist, ang, scale, spin, keep)`.
  - That pass samples through **`glSampLin`, a WebGL2 sampler object** — heat textures are `NEAREST`
    (fire propagation reads exact texels) and a sub-pixel warp through `NEAREST` quantises into
    chunky rings. A sampler binds to the **texture unit**, so unbind it immediately after or it
    silently softens whatever samples unit 0 next.
  - **Each of the four carries its own `Lifetime`** — pure displacement conserves heat, so a warp
    with nothing decaying it saturates to white. **The label is the only thing saying "Lifetime"**:
    the keys (`fade`, `diffkeep`, `echokeep`, `zfbkeep`, `swirlkeep`), globals and the `uKeep`
    uniform keep their names — keys are the wire format.
  - All four have **CPU mirrors** (`heatWarpCPU`/`heatDiffuseCPU`, sharing `bilinearHeat` +
    `warpBuf`); `cpuOk: false` here would leave the fallback with nothing carrying heat over.
- **post** (Twist, Wedge fold, Slice glitch, Pixelate, Blur/sharpen, Edge, Posterize, Halftone,
  Solarize, Chromatic aberration, Mirror, Bloom) — read the palette-mapped image. `glPostChain()`
  ping-pongs `glTex.post[0]/[1]` between FS_PAL and FS_ZOOM and **returns `glTex.native` untouched
  when the chain is empty** (an extra RGBA8 sample can shift a value by an LSB). Bloom has no pass of
  its own: it is the glow composite under `bloomAmt`/`uBloom`.
- **screen — THIS STAGE IS EMPTY.** Barrel, Scanlines, Vignette, Film grain and Bloom are ordinary
  **per-layer `post` passes**: `glBloomPass` turns the glow into a chain entry, the other four call
  `postPass` (fw×fh) instead of `screenPass`. Nothing acts on the whole screen.
  - `glRender`'s final step is still `FS_COMP` with **`uBloom` pinned to 0** — byte-identical to a
    bloom-off scene, and the two blur passes can be skipped rather than run to fill a buffer nothing
    reads.
  - `glBloomPass` borrows `glFbo.blur1/blur2` mid-chain and must restore the caller's target, which
    is why `bindFbo`/`bindDefault` track `curFbo/curW/curH`. Those are **`var`, not `let`**:
    `bindFbo` is hoisted and called during startup before the declaration runs (same class as `card`
    and `beatUi`).
  - Consequences: `uSize` is the render buffer, so a Scanline count means lines across `fh`
    (identical at Full resolution, coarser below); two layers with scanlines can moiré; and the order
    that used to keep a vignette out of the glow is now yours to choose (Vignette after Bloom darkens
    the glow too).
  - **`SCENE_FILTER_IDS`/`SCENE_FILTER_KEYS` are the empty seams.** `isSceneFilter`, `filterOn`,
    `saveState`/`loadState` and `readSceneFx` still route through them; empty is what makes "nothing
    is scene-global" true in one place. Kept because they are the **wire-format** seam — `sceneFx`
    still rides in every blob and **`migrateSceneFx`** folds an old scene's whole-scene filters onto
    its layers on load (ids appended to each chain — they ran last; values overwrite, since `sceneFx`
    was authoritative). It runs beside `migrateCam` in both load paths and deletes the field, so it
    is idempotent.
  - **There is no "Scene filters" box, and `FILTER_LISTS` has ONE entry.** `#screenfilterlist` /
    `#screenfilterctl` are gone, `filterListOf` always returns the layer list, `filterGroup` returns
    one group. Putting a filter back on the whole scene means re-adding a host and a `FILTER_LISTS`
    entry as well as an id — a filter routed to a missing host silently vanishes.

**Two filters animate on their own** (Slice glitch, Film grain) and read **`postTime`**, accumulated
from the frame loop's `dt` — not `performance.now()` (breaks the stubbed-rAF pixel gate) and not
`simT` (doesn't advance for shader effects).

**Ping-pong parity.** `glBeginHeat` runs each ticked feedback filter's `glFeedback(srcTex)` in
registry order, one pass each, with **`pendingDst` set to wherever the last pass landed** — not a
fixed `1 - curHeat`. With two filters the result lands back where it started, hence
`pendingDst = src` after the loop. `tools/heatprobe.js` locks this down.

**Feedback filters apply to shader effects too.** A shader overwrites the whole heat buffer, so
`frame()` advances retained heat first (`heatFeedbackTick()` × `ticks`) and `glShaderDraw`
**MAX-blends** over it. `hasFeedback()` is the single predicate; false ⇒ the original clean-slate
overwrite, byte for byte. On CPU, `frame()` hands the mirror the *other* buffer (a `fire`/`fireKeep`
pointer swap) and MAX-merges — this depends on the invariant that **every CPU mirror writes every
cell**; an early-out would leak stale pixels. `beginHeatTick()` is the shared tick body and does
**not** flip `curHeat`; `heatFeedbackTick()` is the flipping variant. `applyFilters()` wipes `fire`
on `!hasFeedback()`, not `!filterOn("fire")`.

**CPU masking.** Post filters carry `cpuOk: false` on the Canvas2D fallback (greys the checkbox).
Masked **at the point of use** (`cpuBlocked` → `filterOn()` → `activeFilters()`/`hasFeedback()`) and
deliberately **never removed from `activeIds`** — deleting them on load permanently stripped filters
from scenes opened on a fallback machine. `cpuBlocked` is filled by the FILTERS block but declared up
with the render globals, keeping `filterOn` safe to call during slider wiring.

**The list shows only the filters you have ADDED, in the order they run.** `+ Add filter` opens
`#fltdlg`, the only place the full catalogue appears; each row carries a `⠿` drag handle and an `✕`.
`buildFilterUI` builds one `<details>` per filter (summary = handle + name + ✕, body = that filter's
params, adopted out of `#filterctl`); `renderFilterLists()` re-appends the added ones in chain order.
- **Every section stays in the DOM forever**, hidden rather than removed — it holds that filter's
  adopted `#ctl-<key>` nodes, and `el()` is `getElementById`, which cannot find a detached node.
- **Order is expressed by re-appending** (`appendChild` moves a node), so DOM order *is* the order
  and a moved node keeps its children, listeners and adopted controls.
- **`#flt-<id>` survives as a hidden checkbox** in each section: the on/off value store
  `syncFilterUI` writes and the picker reads, as `#preset`/`#palette` sit behind visible pickers.
- `setFilterOn(id, on)` is the single toggle path (picker, a row's ✕, a programmatic load).
- `buildFilterUI` must run **before** the `POPPABLE` pass (it moves `#ctl-<key>` into a body; the
  pop-out pass inserts the `.ctl-row` launcher next to it). `#filterctl` survives as an empty hidden
  node — panel-wide scans still walk it.
- `makeFilterGrab` is the layer-row drag copied: transform the dragged section, show a
  `.filter-drop` marker, reorder once on release. Moving the node mid-drag would detach the handle
  holding pointer capture (Chromium drops capture on reparent).

A filter's `params` are ordinary CONTROLS keys (host `"filter"`, one `group` per filter, contiguous).
`refreshControlVisibility()` shows a control when the effect declares it **or** a ticked filter owns
it. `presetState` merges `FILTER_DEFAULTS` into every effect's state, so a new filter needs no
descriptor edits (an effect naming the same key still wins).

**Every effect defaults to NO filters** (`presetFilters` → `[]`) — raw output until you tick. Point
effects show raw stamped points until **Fire**; nothing glows until **Bloom**. `DEFAULT_SCENE`
carries an explicit `sceneFx:{on:["bloom"]}`. The per-effect list is `extras[e].filters` (stable
string ids); **`mergeExtra` is still mandatory**. Ordering trap: `setEffect` runs its visibility pass
before `loadExtra` knows the new list, so `loadExtra` re-runs `refreshControlVisibility()`.

**The stored list is the USER'S ORDER, not the registry's.** `L.filters` / `extras[e].filters` is the
drag order and every chain walks it via **`orderFilters(ids)`** — never `FILTERS.filter(...)`.
`filtersOk` returns a Set built by inserting in array order (JS Sets iterate in insertion order), so
the stored order survives. Ids are matched by name, so reordering `FILTERS` cannot remap a saved
scene, and a list stored in registry order behaves exactly as before.
- **The chain is a SEQUENCE and is split, not sorted — `splitChain(ids)`.** The pipeline has one
  fixed point (the effect drawing into the heat buffer). Everything at or above the **last feedback
  filter** runs in the heat phase; everything below runs on the palette-mapped picture. A `feedback`
  filter is only meaningful in the heat phase, but a `post` filter is just a pass sampling a texture,
  so it runs in **either** — above a feedback filter it warps the heat (heat textures are `R8`, the
  shader writes `.r` back), below it repaints the image. `runHeatPass(f, tex)` dispatches per filter
  (`glFeedback` if it has one, else `gl`).
- **This replaced a stage sort.** `orderFilters` used to stage-partition, so **Swirl (feedback) +
  Mirror (post)** could never swap and it read as "reordering does nothing". Measured on a static
  single-layer scene, swapping that pair changes **48% of pixels** against a 6.6% noise floor.
- **The divider marks where the EFFECT draws**, not a barrier — `stageDivider()` is emitted once,
  after `splitChain(...).heat.length` rows; `flashStageMove` says what a filter now *does* when a
  drag moves it across. With no feedback filter the heat is cleared every frame, so `splitChain` puts
  everything in the image phase and no divider is drawn.
- **Both render paths must be checked**: the single-layer path runs `activeFilters()` off
  `activeIds`, a stacked scene runs `renderStackColor` → `layerFeedbackChain`/`glLayerPostChain` off
  **`L.filters`**. `L.filters` stays current for the selected layer only because `applyFilters()` →
  `persist()` → `stackOut()` freezes it. The shipped `DEFAULT_SCENE` is a four-layer stack, so the
  multi-layer path is what a user hits first.
- **Four sites must respect it**: `glBeginHeat` + `glPostChain` (single layer),
  `layerFeedbackChain` + `glLayerPostChain` (stack) all go through `splitChain` — and the easiest to
  miss, **`mergeExtra`**, the gate every loaded scene passes through, which re-sorted to registry
  order and threw the chain away on reload. `activeFilterIds()` is the write side (`saveExtra`,
  `captureLayerExtras`).
- **`orderFilters` is a function declaration but `FILTER_STAGE_RANK` is a const it closes over**, so
  `buildFilterUI()` must be called **after** that block — called before, the const is in the TDZ,
  `renderFilterLists` throws, and the symptom is every filter showing at once.

**Effect `defaults` are NEUTRAL**: palette cycle off (`palcycle [0,0]`), banding off, no rotation,
every dual slider collapsed to `[lo,lo]`. Only affects fresh effects / per-effect default presets.

Three TDZ constraints: the registry block sits **above `presetState`**; `buildFilterUI()` is called
**after** the registry; `activeIds` + `filterOn` live with the render globals (because `bindRange`
runs a slider's `apply()` during wiring).

### Effects & per-effect "scenes"
**`EFFECTS` is the single source of truth per effect** — `{id, name, presetName?, subtitle, help,
params, helpTags, draw?/fractal2d, bakesOwnZoom?, cardioid?, onEnter?, defaults, beat, extras}`.
Adding an effect = append one descriptor (`assertRegistry()` warns on a dup id or a param that isn't
a real control). Everything derives from it:
- **Controls** generate from the shared `CONTROLS` schema (type, label, range, `fmt`, `apply`,
  `durScale`, host). `buildControls()` renders into `#fxctl`/`#bandctl`; `setEffect` shows only the
  keys in the descriptor's ordered `params`. No hand-written control HTML.
- **Defaults** — `defaults`/`beat`/`extras` seed `states[e]`/`beatStates[e]`/`extras[e]` via
  `presetState`/`presetBeat`/`presetExtra`. `defaults` includes render-affecting keys the effect
  doesn't display (e.g. `band` at 0) so switching to it resets them.
- **Render** — `frame()` runs `draw(dt)` or the fire-sim accumulator; `simulate()` stamps 2D when
  `fractal2d`; `setEffect` runs `onEnter`; `renderHelp` filters by `helpTags`.
- **Identity** — persistence uses the **stable string `id`**, never the numeric index.
  `serializeBlob`/`deserializeBlob` convert at the storage edge; `LEGACY_EFFECT_IDS` migrates pre-id
  blobs. `effect` stays the runtime numeric index. **`EFFECT_MAPS` + `keysToIds`/`keysToIdx` cover
  the per-effect maps too** (`states`, `beats`, `pulses`, `plens`, `extras`) — they were keyed by
  registry position for a long time, so a reorder would have handed every saved scene to whichever
  effect moved into that slot. A numeric key reads as a pre-id blob; an id that no longer ships is
  dropped rather than misfiled. `presetprobe` deserializes under a shuffled registry.

**Break-out boxes.** Every `dual`/`plain` slider shows in the menu as a name + a `+`/`−` button (a
`.ctl-row` launcher); the whole `#ctl-<key>` node lives in `#breakout`, a `position:fixed` column
filling top→down in click order. **So the sliders are not in the layer block** — a block holds
launcher rows, group headings, the filter chain and the palette strip, and a thumb is only ever
visible in the column.
- **A box belongs to a LAYER.** `popped` is keyed `"<slot>/<key>"` (a scene control is `"s/<key>"`),
  so layer 1's and layer 3's Speed boxes are two boxes, both openable. `refreshBreakout()` shows one
  iff its own slot/key is popped **and** that layer still uses the control. `ctlOwner(slot, key)`
  prefixes the title with `L2 ·`; `syncPopOwners()` re-stamps after a reorder. State is **transient**.
- **NOTHING calls `dockAll()`.** Emptying the column takes away the comparison you opened it for. The
  function is kept with no callers; the column is yours to curate. `L.popped`/`restoreLayerUi`'s
  restore went with it (and its freeze-during-persist trap).
- `#breakout` sits **outside** `#panel` (the panel's `backdrop-filter` + `overflow` would clip a
  fixed child), so three things reach it: control CSS scoped `#panel …, #breakout …`; the delegated
  `onEdit` attached to `#breakout` too; and its **own capture-phase `pointerdown` + `focusin`** which
  selects `box.dataset.slot`'s layer (only the selected block's nodes are in `anims`).
- A box holds top→bottom: **owner line** (`.ctl-owner`), label + value, **the slider**, its **range
  editor** (`.rng-edit`, min/max/step + ↺), a divider (`.ctl-div`), then three titled rows —
  **Triggers** (`.trig-t`) over the beat chips, **Trigger shape** over the `PULSE_SHAPES` picker,
  **Trigger duration** (`.plen-name`) over its length slider (`.plen`). `makeChips` **appends** all
  of it to the `.ctl` (which holds only `[label, slider]` at that point), so append order is display
  order. The range editor is built LATER (the `POPPABLE` pass) and must **insertBefore `.trig-t`**,
  not append; with no chips there is no anchor and `insertBefore(…, null)` appends, which is right
  for free. It has no `border-top` (under the slider that rule cut a control off from its own
  bounds). The last five exist only in a box.
- The **owner line** (`ctlOwner(key)` → `CTL_GROUPS[control.group]`, with a `"Filter · "` prefix for
  `f_*` groups) exists because controls are singletons reused across effects. Added in
  `POPPABLE.forEach`, not `ctlHTML` (non-poppable controls keep their `.ctl` in the panel).

**Per-slider range editor** (`makeRangeEditor`): `min`/`max`/`step` fields + ↺ (restore `RNG_ORIG`).
`rngApply` writes the attribute onto the real slider(s), re-clamps and dispatches `input` on the
**slider** so the delegated `onEdit` persists it normally (the number fields are skipped in
`onEdit`). `applyRanges` calls `rngSyncAll()`.

**Blocked controls.** A slider neutralised by another is greyed, its `+`/`−` killed, and a click
flashes the blocker. `CTL_BLOCKED` maps blocked key → blocker key (`bandsize`/`banddim` → `band`,
`nodspd` → `nod`); a control is *off* when its dual's **high thumb is 0** (`ctlHi`) — a stable read
off the thumb, not the animated value. `refreshBlocked` runs from `refreshControlVisibility` **and
`onEdit`**. Extend by adding a `CTL_BLOCKED` entry.

**Orbit editor** (`#carddlg`, `#cardbtn`), gated on `cardioid: true`. **Floating, non-modal**
(bottom-right, `z-index: 5`, translucent) — you tune the orbit sliders while watching it, so **never
reintroduce a backdrop or click-outside-closes**. Like `#paldlg` it **hides on `m`/`Esc`**.
- Samples **`juliaSeedAt(outer, inner)`** — the pure part split out of `juliaSeed(dt)` — so opening
  it never advances the animation. `frame()` redraws it while open.
- Backdrop is **`cardLocus(w, h, d)`**: Mandelbrot at power 2, degree-d Multibrot otherwise (drawing
  the wrong one made the panel lie). Quantised to `CARD_POW_Q`, rendered at half resolution
  offscreen; keeps an integer-2 fast path.
- `card` is a **`var`** and `cardOpen`/`cardDraw` early-return on falsy `card`, because `setEffect`
  calls `cardOpen` during startup before the declaration runs.

**Seed PATH shape.** `seedPathMode` (`"cardioid"`|`"circle"`|`"freehand"`), a per-path `seedRideOn`
toggle, freehand `seedPts` (compiled to an arc-length LUT `seedSpline`). **`basePathAt(th)`** is the
fork; freehand is a closed periodic Catmull-Rom traversed by arc length. `juliaSeedAt` adds the
riding circle only when `seedRideOn`. **`juliaEase` is a flat 1 off the cardioid** (circle and
freehand have no cusps). The default (cardioid + ride on) reproduces the original seed math
byte-for-byte.
- Config is **per-LAYER scene data** (`L.seedPath`/`seedRide`/`seedPts`), mirroring
  `palette`/`paletteRev`, with `extras[e]` as the per-effect fallback. Saves, shares (4dp + capped by
  `seedPtsOk`) and rides in presets/backups via `stackItemOut`/`mergeLayers`.
- **`installSeedPath(L)`** (from `installStackItem`) installs per layer; the epilogue restores the
  selected layer's. **`captureSeed(L)`** writes globals back — a drag swaps in a **NEW** `seedPts`
  array (never mutate in place) so the `seedSplineFor` WeakMap invalidates.
- `stageLayerExtras`/`applyLayerExtras` install the seed from the layer, **not `loadExtra`** — that
  would capture the effect default over the staged layer path during `setEffect`'s persist-freeze.
- `syncOrbitUI()` reflects live state onto the controls (from `loadExtra` and on open).
  `seedDrawing` is transient; the committed shape is not.

**Camera on the CPU path.** Shader CPU mirrors call `camPix(x, y)` per pixel (writing the scratch
pair `camPX`/`camPY` rather than allocating). This forces hoisted per-row terms inside the x loop —
a rotation mixes x into y, so `const py = f(y)` outside the inner loop is only valid while the camera
is upright. **Copper Bars** keeps its row-constant fast path but gates it on `camOn()`.

### UI: two menus
The ☰ opens the **menubar** (`src/ui-menubar.js`, `#menubar`) — everything that is *not* scene data:
Controls panel / Fullscreen / Hide all UI, then **Audio**, **Resolution**, Cloud profile, Public
scenes, Credits, help link. The **panel** (`#panel`) is only the scene editor. ☰ **no longer toggles
the panel**; `m` does.

**Audio and Resolution are ROOT items.** They sat under a "System" parent, which bought one more
hover to reach the two settings the menu is mostly opened for. Each still needs **its own adopt
host** (`#audiobox`, `#resbox`) — that never depended on the parent, and one host per leaf is the
rule (`returnAdopted` needs a home per block).

**The menubar ADOPTS existing nodes, it does not rebuild them.** `#audiobox`, `#resbox`, `#cloudbox`,
`#creditbox` are authored in the panel markup (hidden) and a `{adopt: "id"}` menu item *moves their
children* into its panel — the same trick `buildFilterUI` uses, keeping every listener, `el(id)`
lookup and sync path working. `ui-menubar.js` is **last in the manifest**.

**`returnAdopted()` is load-bearing and its absence is destructive.** Panels are rebuilt on open and
destroyed on close, so an adopted block must be moved home *before* its panel is removed — otherwise
closing the menu **deletes the real audio buttons, resolution select, `#cloudrow` and credits list
from the document**. `box.dataset.adopt` is how each knows home.

**Every dialog's title and close button are STICKY at the top.** They are scrolling boxes whose first
two children are the `.pal-close`-family button and an `<h2>`.
- The button is `position: sticky` + `float: right`, **not `absolute`** — an absolutely positioned
  child of a scrolling box is placed against its padding box and scrolls with the content.
- **The box gives up its `padding-top` and the header carries it** — sticky pins to the scrollport's
  top edge, so any top padding is a gap content passes through above the header.
- The header's background bleeds over the box's *side* padding via `box-shadow: 0 -30px 0 30px`
  rather than negative margins (padding differs per dialog, 18–26px). It also carries a
  `backdrop-filter` — at 0.93–0.97 alpha alone, text underneath still ghosted through.
- **A probe that opens a dialog by un-hiding it proves nothing**: these build content on open, so the
  box is empty, cannot scroll, and the sticky assertion passes vacuously. Click the real opener
  (`#transpick-open`, `#pal-detail-btn`), and say so when a box genuinely does not scroll.

**Shared widget CSS is keyed on the CLASS, not scoped to a container — this trap has bitten three
times.** `#paldlg .pal-close` or `#panel .audbtn` leaves every *other* user of that class at browser
default. So `.pal-close, .card-close, .help-close, .sync-close` and `.audbtn` are single unscoped
rules; a dialog need only be `position: relative` (or deliberately `static`, as `#carddlg .card-box`
is, so the × pins to the floating panel). The control-appearance CSS is the deliberate exception — it
names `#panel …, #breakout …, #menubar …` because those really are three hosts for the same nodes.

Two consequences: `#menubar` is a full-screen overlay that **catches** pointer events while open
(it is the click-outside closer; without that a dismissing click pauses the animation), and every CSS
rule an adopted block needs must name `#menubar` alongside `#panel` — including the *font*, which
lives on `#panel` rather than `body`.

**Panel layout.** Header + **four `.box` `<details>` sections** (fold state transient): *Scene*
(chooser, auto-cycle, TTL, transition), *Scene filters*, *Beat tuning*, the hidden *Layer effect &
filters*; plus **`#lyrsec`, a plain titled SECTION for Layers** — not a box, because every layer row
is already a framed box and the selected one holds a third frame. Its `.sec-t` heading matches the
in-panel group headings. The hidden box still holds `#effect`, `#fxctl`, the Orbit editor, Reset, the
per-layer filters and the palette. `buildControls` routes by `host`: `"band"` → `#bandctl`, `"pal"` →
`#palctl`, else `#fxctl`.

**`#scenenow` names the selected scene**, a heading between the Scene box and Scene filters. Filled by
`syncSceneTitle()` from **`buildPresetList()`** — deliberately not from each selection path, because
that function is already the single choke point every path goes through to move the list highlight.

### One control block PER LAYER

**Every layer row owns its own control block, and any number can be open at once.** A block is a
`.lyrblock` cloned from `<template id="lyrblock">` — `STACK_MAX` of them, built at startup, living
permanently in their row: header (effect chooser, mute, gain, ✕, blend), then that effect's controls,
its filters, its palette. There is no `#lyrctl` and no `parkLayerCtl`.

- **Nothing inside a block carries an `id`.** Four elements with `id="speed-lo"` are invalid and
  `getElementById` returns the first, so every edit would land on layer 1. They carry the same string
  on **`data-k`** and resolve through **`ctl(k)`** (selected layer), **`ctlIn(slot, k)`** (one layer)
  or **`ctlEach(k)`** (all). The STRING never changes: `speed-lo` is a wire key — a stored `ranges`
  map is named by it. `ctlReg` registers a node *and* stamps `data-k`, so DOM and map agree.
- **Node REFERENCES, not a subtree query.** `keyMap[slot]` is a hash, because the POPPABLE pass moves
  every `.ctl` out of its block into `#breakout` — `blocks[slot].querySelector` would stop finding
  them. Same property `anims` relies on.
- **A SCENE control keeps its `id` and is generated in slot 0 only** — the seven
  `SHARED_FILTER_KEYS` plus `ttl`/`tdur`. `ctl()` falls through to `getElementById`. `isSceneCtl`
  sits above `ctlHTML` so the generator can read it. **`#effect` and `#palette` are hoisted OUT of
  the block**: pure value stores behind visible pickers; four copies would mean `setEffect` writing
  one, `applyBlob` validating another and the render reading a third.
- **The wiring is one set of maps pointed at one block.** `wireRange(slot, …)` builds a block's
  nodes, `ui()` closure, clamp listeners and beat block; `registerAnim` creates `anims`/`animPhase`
  and runs the single startup `apply()` from slot 0; **`pointMaps(slot)`** re-points the maps on
  selection. It must never re-create `animPhase` (teleports every drifting slider on every layer
  click) and never call `apply()` (rewrites the render globals out of turn). `makeChips`'s handlers
  guard on being the **live** block, not on `slot === stackSel` — the slot test is wrong whenever one
  block serves a different selection.
- **`paintBlock(slot, L)`** fills a NON-selected block from its layer's frozen record. It skips the
  selected block (which IS the store), applies that layer's **bounds BEFORE its values** (a value
  painted against shipped bounds is silently clamped and the next `freezeItem` writes the clamped
  number back — data loss), and **never dispatches `input`** (that reaches `onEdit`, so painting
  three blocks would persist the scene three times). **`repaintAllBlocks()` must run wherever a slot
  changes which layer it holds** — reorder, add, remove, `installStack`. Missing one is the quietest
  failure here: records and render stay right, only the panel lies. It lives inside `installStack`,
  not `applyPreset`, so `presetprobe`'s structural check still holds.
- **The visibility passes are per block.** `shownKeysFor(slot)` reads that layer's effect params and
  its own ticked filters; `refreshBlockVisibility`, `markFirstGroup`, `refreshChanged`,
  `refreshBlocked` and `ctlHiIn` all take a slot. Left global, every block shows the SELECTED
  effect's controls.
- **`RNG_ORIG` is built from the `CONTROLS` schema, not a DOM scan** — layer controls carry no id
  (every key would be `undefined`), and a scan would also swallow the four gain sliders.
- **`selectStack`'s order is load-bearing**: `freezeItem` (reads the OUTGOING block) → `stackSel = j`
  → `pointMaps(j)` → the rest. Any other order loses the last edit silently.
- Selection is a capture-phase **`pointerdown` AND `focusin`** on the row. Pointer alone leaves a
  keyboard hole: tab into another layer's slider, press an arrow key, and `input` fires with no
  pointerdown — the value lands on a node not in `anims`, nothing renders, and the next `paintBlock`
  reverts it. The `focusin` also makes the panel work with assistive tech.
- A block folds behind its **chevron** (`openSlots`, `.lyr.folded > .lyrblock { display: none }`). It
  only HIDES — the block stays in the document, so every `ctl()` lookup keeps working. **Every layer
  starts folded**, `openSlots` starts empty, and **selecting a layer does not unfold it** (with
  several open, a click meant for one layer shouldn't rearrange the others). Unfolding does select.
  `dropOpen`/`moveOpen` remap the set on a remove and a drag — the fold belongs to the layer, not the
  slot.
- **NOTHING may override the row's `padding-bottom`.** An OPEN row is squared off by the block's own
  `margin-bottom: -6px`, which lands its edge exactly on the border whether the row is selected or
  not; a FOLDED row has no block, so the 6px padding is all that holds its floor up. A
  `.lyr.sel { padding-bottom: 0 }` used to sit below `.lyr.folded { padding-bottom: 6px }` — **equal
  specificity, later in the file, so it won**, and selecting a folded row visibly shrank it by 6px.
  Any per-state padding here has to name `:not(.folded)`.
- **The chevron is on EVERY row, upper-left**, and is the one control that both opens and closes.
- **It is an explicitly PLACED grid child** (`grid-column: 1; grid-row: 1`). Appended without one it
  takes the next auto cell and pushes the chooser, mute row and blend row along, visibly collapsing
  the row. The drag handle drops to `grid-row: 2 / 4` to make room.
- Styled as **`#panel .lyr b.lyr-chev`**, with the type selector: `#panel .lyr b` gives every `<b>`
  in a row the mute/✕ chrome (border, background, `font: 10px/1`) and outranks a plain class selector.
- **Every chevron in the app is 2x** (~20–22px): panel boxes, scene collections, filter sections,
  menubar submenus, this one. The `::before` ones pin `line-height: 0` so a bigger glyph cannot grow
  its row; the layer one uses `line-height: 1` because as a FLEX item a zero line box collapses the
  glyph to a sliver.
- **`#effect` is hidden in this box, not deleted** — every layer row has its own chooser, but the
  `<select>` remains the effect **value store** (`setEffect` writes `.value`, `applyBlob` validates
  against its options, its `change` is what everything dispatches through).
- The first *visible* group heading's top border is suppressed via **`.grp-first`, set by
  `markFirstGroup()` from `refreshControlVisibility` — NOT `:first-child`**: every group exists in the
  DOM and only some are shown.

**Palette cycle.** A `palcycle` dual slider (host `pal`) sets the **[min,max] seconds one morph
takes**; `morphMs()` draws each cycle's duration like `ttlMs()`. Both thumbs at 0 pins the palette —
`morphing` is *derived* (`palCycleOn()`), not stored, and `syncMorphFromSlider()` starts/pins the
blend on any edit. `extras.morph` is still written for backward compat.

**Reverse colours** (`#palrev`) flips the palette order **per layer** — live global `paletteReverse`
for the selected layer, `L.paletteRev` otherwise (`layerPalRev(L)` reads through), plus
`extras[e].paletteRev` as the single-layer fallback. Flips indices **1..255** of the final baked LUT,
leaving 0 as the background. Applied at both bake choke points: `composePalette` and
`bakeLayerBytes(…, rev)`.

**Background** (`#palbg`) sets what heat-0 pixels show, **per layer**: `paletteBg` ∈ `"palette"`
(**default** — leave index 0 as composed) | `"black"` | `"white"`. `"palette"` is the default in both
deciding places: the initial global and **`bgOk`'s fallback**. Same per-layer plumbing and choke
points as `paletteRev`.

**Palette editor** (`#paledlg`, `src/palette-editor.js`). `+` on a built-in makes an editable copy;
`✎` on a custom edits it — shipped ramps stay pristine. Floating, translucent, non-modal; hides on
`m`/`Esc`.
- **It edits LIVE, not as a draft** — a palette is referenced by *index* and re-derived from
  `PALETTES` every frame. The custom is created and selected on open and every edit rewrites it in
  place. Consequence: **a fresh copy closed without a single edit is removed again**; `Save & close`
  overrides that.
- **Customs live in the SAME `PALETTES` array**, appended after the built-ins. `PAL_BUILTIN` is
  captured immediately after the array literal. `grad()` hangs its `stops` on the returned fn;
  `palStopsOf` falls back to sampling for the three procedural ramps.
- **`applyBlob` must install customs BEFORE it validates any palette value.** `customPalettesOk`
  drops malformed entries and **sorts stop lists** (`grad` interpolates backwards through an unsorted
  one and renders flat).
- **Deleting a custom shifts every later custom's index down**, so `palRemapDeleted` rewrites the
  live stack, per-effect `extras` and every preset. Already-generated share links are not rewritten
  (a link naming a missing custom falls back like any out-of-range palette).

**Which palettes are in use** (`palUse`, `#palpickdlg`, the `+` tile ending the swatch strip). The
strip shows only ticked ramps and **`pickOther` picks only from them**. It gates the STRIP and CYCLE
only — a scene storing an unticked palette still loads and renders it, and the strip always shows the
current ramp whether ticked or not (else selecting such a scene blanks the highlight). `null` = all
(shipped state, what every older blob decodes to, nothing to migrate); `setPalUse` collapses a full or
empty set back to `null`. A **global** blob field like auto-cycle and Preset TTL; `applyBlob` skips it
while `sharing`. **Indices, so `palRemapDeleted` must remap it.**

**Palette names are free to change; the ORDER is not.** Palettes are referenced by index everywhere,
so renaming touches no saved scene, link, backup or profile — but inserting or reordering silently
re-points every stored reference.

**Palette preview picker.** `#palette <select>` is the value store but **hidden**; the visible control
is `#palswatches` (one gradient per in-use `PALETTES` entry from `palGradientCss(i)`). A swatch click
sets `paletteSel.value` and dispatches a bubbling `change` — no extra state or persistence.
`syncPalSwatches()` mirrors the highlight wherever the value changes programmatically
(`showMorphTarget`, `applyLayerExtras`, the `change` handler). Keep the select in the DOM.

**`setEffect(i, save)`** shows the descriptor's `params`, runs `onEnter`, and swaps five parallel
per-effect maps: `states[e]` (slider values), `beatStates[e]` (L/M/H chips), `pulseStates[e]`
(`PULSE_SHAPES` key, default `"snap"`), `plenStates[e]` (pulse length, default `PULSE_DROP`),
`extras[e]` (palette, morph, show-box, random-seed). It calls `save*` for the outgoing effect and
`load*` for the incoming one.

**`setEffect` deliberately does not clear the heat buffer** — it used to, which blinked black on every
switch including every auto-cycle change. Leaving the outgoing heat lets it decay under the incoming
scene. `acc = 0` still resets.

**Beat chips ship unarmed** — every `beat` map is empty; unarmed styling is colourless and dim, the
per-band colours (L blue, M green, H red) apply only to `.on`.

**Beat-trigger dots** (`.ctl-dot`, `dotEls`): up to three per menu row, one per band, chip colours.
`display:none` unless armed, `opacity .34` when armed and idle, lit by `flashChips()`. Two things keep
them honest: `syncDots()` is called *from* `syncChips()`, and dots are built only for keys present in
`chipEls`.

**Beat-pulse shape & length.** On a beat, `updateAnims` snaps an armed slider to the high thumb and
decays `a.pulse` linearly 1→0 over that slider's own `pulseLen[id]` seconds (`.plen` range,
`PLEN_MIN`–`PLEN_MAX`, default `PULSE_DROP` = 0.2s). The per-slider `pulseShape[id]` reshapes that
decay: `a.apply(mn + shape(a.pulse)*(mx-mn))`. Every `PULSE_SHAPES` fn maps `p∈[0,1]` → `[0,1]` with
`f(1)=1`, `f(0)=0`; `snap` is the identity. `pulseEls`/`syncPulse` mirror `chipEls`/`syncChips`;
`plenEls`/`syncPlen`/`prunePlens`/`mergePlen` mirror the pulse-shape set.

### The effect stack (layers)
A scene is an **ordered list of up to 4 effects** composited into the one heat buffer. `stack` is the
list, `stackSel` the selected index, `STACK_MAX` = 4.

**Never call it `layers` in code.** `layers` is already a CONTROLS key (`layerCount`/`LAYER_MAX` —
copies of the *fractal*) persisted in every `states[e]`. "Layer" is the user-facing word only.
`stackSel`, not `slot` (`slot` is a local in both ping-pong loops).

**`effect` survives as the SELECTED item's effect**, assigned only in `setEffect` — that is what keeps
this feature small. Only the render path reads `stack`. **If `EFFECTS[effect]` ever reappears in a
render path** it renders the selected item's descriptor for every item — invisible whenever two items
share an effect.

**Pressing anywhere in a layer row selects that layer.** Child controls `stopPropagation()` on
`click`, so selection is a **capture-phase `pointerdown`** on the row — it runs before any child
handler and before the control acts, so a gain drag applies to an already-selected layer. A
capture-phase **`focusin`** sits beside it for keyboard/assistive tech. The row's `click` listener is
kept for synthetic clicks; `selectStack` early-returns when already selected.

**The rows are a FIXED POOL of `STACK_MAX`, keyed by SLOT, built once and never destroyed.**
`syncStackUI` only paints them; spares are hidden. Rebuilding rows would destroy the very node the
user has a pointer down on. Keyed by slot rather than item identity because `installStack` replaces
the whole array on every scene load (every auto-cycle tick); the cost is that a reorder changes which
item a row shows, so **every handler reads `stack[slot]` live** and the paint covers all of them.

**The grab handle is excluded from row selection** (dragging is not selecting). It selects on
pointer**up**.

**Every layer row carries its own effect `<select>`** (`select.lyr-name`). A change on a row that is
**not** selected calls `selectStack(j)` **first** — `setEffect` edits whatever `stackSel` names, and
going through `selectStack` runs the `freezeItem`/`stageLayerExtras` sequence. `fx` is read off the
`<select>` **before** either call, since both re-run `syncStackUI`.

**The DOM is the store for the selected item; every other item holds plain numbers.** `loadState`
writes the DOM and dispatches synthetic `input`. `bandOf`/`beatOf`/`shapeOf`/`plenOf` short-circuit to
the singletons when the stack holds one item. `freezeItem`/`thawItem` move an item between
representations and **null the record on thaw**: exactly one of "selected"/"holds numbers" is true.
Reading a frozen record without freezing first silently loses the last edit.

**Palette and the filter stack are per-layer** (`L.palette`, `L.filters` — not in `extras[e]`, so two
layers of one effect can differ). The live `paletteSel.value` + `activeIds` are the SELECTED layer's.
`loadExtra` handles only the still-per-effect bits; `applyLayerExtras(L)` puts a layer's palette +
filters live (falling back to the effect's stored/default extras when null); `captureLayerExtras`
reads them back.
- **Load-order trap:** `setEffect` ends in `persist()`, which freezes the selected item — so switching
  layers must run `stageLayerExtras(L)` **BEFORE** `setEffect`, or that persist stamps the OUTGOING
  layer's palette/filters onto the incoming one.
- Consequence: changing a layer's effect KEEPS its palette/filters.

**Animation is split scene vs layer.** `bindRange` tags each `anims` entry `scene` via `isSceneCtl` —
palette, banding, camera, display zoom. **Most filter params are LAYER keys**; only
`SHARED_FILTER_KEYS` stay scene-wide — `burn` (shared sim clock), `bloom`, and the screen filters
(`barrel`/`scan`/`scancount`/`vignette`/`grain`), which act on the ONE finished image. Scene keys apply
immediately; layer keys are only *computed*, then `installStackItem(L)` pushes them into the globals
before that item draws. **Feedback params are read during propagation, which in the single-layer path
runs BEFORE `installStackItem`** — so that branch of `frame()` calls `installStackItem(live[0])` up
front.

`updateAnims` is **key-major, not item-major** — each fresh drift segment draws twice from
`Math.random`, so key-major keeps a one-item stack drawing in exactly the old sequence.

An **epilogue `installStackItem(stack[stackSel])`** runs after the loop, because `glRender`, `render()`
and `cardDraw` read these globals outside any item's turn.

Beats need no per-item work (`beatReact`/`pulseShape`/`pulseLen` stay singletons; the stack loop lives
*inside* `updateAnims` so every item sees the same latched `audio.beatNow[]`). **`clearBeats()` must
stay after the whole loop** — hoisting the loop into `frame()` leaves items 2–4 never pulsing.

**Phase clocks are per item, via `PHASE_VARS`** — a name/getter/setter table over all 16 accumulators
(`simT`, `spinAngle`, `nodPhase`, `juliaOuter/Inner`, `plasmaTime`, …), installed before an item draws
and captured after. **Add a line when you add an effect that accumulates a clock**, or two items share
one clock and render as a single brighter copy — no error, no probe, the most easily missed thing here.
`installStack` seeds every item's phase from the **current** clocks, so applying a preset doesn't
rewind `simT`.

**Compositing (heat-space).** Each item renders into `glTex.layer` and merges via
`glMergeLayer(blend, gain)` (`FS_MERGE`). `glShaderDraw` always overwrites the scratch with blending
off. **Gain must be a multiply inside the shader, not a blend factor** — `blendEquation(MAX)` ignores
`blendFunc`, so gain via blend state works for Add and is silently dropped for Max. `glMergeLayer`
restores BLEND **and** `blendEquation` **and** `blendFunc`.

**Per-layer palettes — two render paths, gated on the live-layer count.** The heat-space merge flattens
everything into one grayscale buffer coloured once; that is still exactly what runs for a **single**
live layer (`live.length <= 1`), byte-for-byte. With **two or more**, `frame()` calls
**`renderStackColor`**: each layer is coloured with its own palette and blended in **OKLab**.
- **Per-layer heat + feedback.** Each layer owns `glTex.heatL[slot]` and runs its OWN feedback filters
  via **`glLayerBeginHeat`** — a copy of `glBeginHeat`'s ping-pong (NOT `glBeginHeat` itself, which
  stays untouched for the `heatprobe` slice). `renderLayerHeat` drives it and calls
  `installStackItem(L)` first.
- **Independent palette cycling.** `stepLayerPal(slot)` is a per-slot morph clock drawing durations
  from the shared sliders, so layers drift out of phase. `bakeLayerBytes` bakes its ramp (+ live
  banding) into `glTex.palL[slot]`. `layerPalIndex` reads the **live dropdown** for the SELECTED layer
  (`L.palette` is null while selected) and `L.palette` for the rest.
- **Colour + post filters + OKLab blend.** `glColorizeLayer` (FS_PAL) → `glLayerPostChain(L)` →
  `glOkMerge` into the RGBA8 ping-pong accumulator `glTex.color[0/1]`. Blend mode = `L.blend` →
  `BLEND_MODES[].u` → an `FS_OKMERGE` branch: `0` add (brightness-weighted), `1` max, `2` diff, `3`
  colour, `4` luminosity. **`BLEND_MODES` is the single source of truth** (row button, uniform,
  `blendOk` validation) — adding a mode is one array entry plus one shader branch. An **`accW < ε`
  guard** returns the plain layer before the branch so diff/colour/lum don't render the first layer
  black. `L.gain` scales the weight, applied ONCE here. `FS_OKMERGE` takes a finished RGB layer
  (`uLayer`), not heat+palette. Bloom has no `f.gl` hook so it stays whole-scene. `glRender` starts
  from `glColorTex` and skips both the shared `FS_PAL` and the composite-level `glPostChain`.
- **Menu grouping mirrors it**: `buildFilterUI` groups by `filterGroup(f)` — feedback **and**
  post-minus-Bloom are ONE group ("Per-effect · heat, trails & image"), Bloom + screen are "Whole
  scene · final image". Bloom lands right because it is registry-last among `post`. The single
  per-effect heading only works because the registry order puts all feedback, then all post-but-Bloom,
  then the whole-scene set, keeping the run contiguous.
- The Canvas2D fallback is untouched: one item, one palette.
- `STACK_MAX` is declared up by the canvas/GL setup (TDZ — `initGL` allocates per-layer buffers).

**Point items own the tick loop.** `simulate()` propagates *and* stamps per tick, ~2× per frame. So:
one `beginHeatTick()` per tick, then every point item stamps and blits into it (`glPtCount` reset per
item), `curHeat = pendingDst` once at tick end; shader items draw once per frame afterwards.
`stampTick(L, now)` is the reusable stamp half. With no point items and no retention,
**`glClearHeatCurrent()`** clears without flipping — *not* `glBeginHeat`'s no-chain branch, which
clears the other buffer and flips the parity `heatprobe` pins.

**The Canvas2D fallback renders ONE item** (first unmuted) — CPU mirrors assign rather than MAX.

**Zoom is applied to the CONTENT, never to the finished picture — all effects.** Shader effects divide
their coordinates by `zoom` (that is what `bakesOwnZoom` marks); point effects **`plot()`-scale the
point about the grid centre before stamping**, composed with the camera's 2×2 (a uniform scale
commutes, so order is free). The fractal rasterises at full grid resolution whatever the zoom;
out-of-grid points are dropped by the existing bounds test.
- **The count scales with it**: `zoomPoints()` multiplies by `zoom²` at the one choke point in
  `stampTick`, capped at `CONFIG.tuning.zoomPointCap` = **8** (not the 16 zoom 4 asks for — `zoom²` is
  an area rule and a Sierpiński triangle has dimension ~1.585, so full compensation renders ~3.5×
  denser; the cap also halves a real CPU cost).
- Consequence: zoom no longer magnifies flames or glow, so a scene saved with zoom ≠ 1 on a point
  effect renders differently (it still *loads* identically; the wire format didn't move).
- **`stackZoom()` is consequently always 1** — every descriptor carries `bakesOwnZoom`, so `FS_ZOOM` is
  an identity blit and the CPU zoom block is dead. Both kept deliberately.

**A single-layer scene never touches `mergeLayers`.** `applyBlob` only calls it when `saved.layers`
exists, so a one-item scene keeps `newStackItem(0)` with `filters: null` — and `applyLayerExtras` falls
back to the **descriptor default** on purpose. The fix is in `applyBlob`'s else-branch: **seed
`stack[0].filters` from the restored `extras[e]`**. Two alternatives that do NOT work:
- **Do not add an `extras[L.fx]` fallback to `applyLayerExtras`** — removing that fallback is what
  fixed same-effect layers mirroring the last one edited.
- **Setting the live `activeIds` does not survive** — `stackOut()` returns null for a one-item stack,
  so nothing ever freezes it into `L.filters`. (That same fact makes the seed safe.)

**Persistence: an optional `layers` array.** One item ⇒ **nothing is emitted** (`stackOut` returns
null), so every pre-feature scene is byte-for-byte unchanged. `mergeLayers` is the `mergeExtra` of this
feature: truncates to `STACK_MAX`, drops items whose effect id no longer ships, clamps gain, defaults
blend, and runs every per-item map through its own `merge*` **against that item's own effect**. Items
omitting `palette`/`filters` fall back to the scene's top-level `extra`. `installShared` re-seeds a
single-item stack so a shared non-stacked scene doesn't inherit the recipient's. **`blendOk`/`gainOk`
are function declarations, not const arrows** — `mergeLayers` runs from `applyBlob` far above where
they sit (a const TDZ there aborts startup and surfaces as a confusing later TDZ on `nextSwitch`).

`?stack=plasma,tunnel` builds a stack at startup by effect id — a dev hook, never persisted.

### Scene collections (the grouped chooser)
A preset carries an optional **`collection`**: the name of the published profile it came from. Absent
⇒ one of yours. It rides **beside `name`** and is deliberately *not* part of `snapshotScene` — it says
where a scene came from, not what it renders.

**It must be listed explicitly in `validatePresetList`** — that mapping rebuilds each preset from an
object literal, so a field missing from it is silently dropped on every cloud load and gallery install.
(`serializeBlob`/`deserializeBlob` spread, so they need no change.)

**The gallery installs a collection instead of merging.** `applySharedLibrary(raw, replace,
collection)` puts the name into `pendingRestore`, and `applyRestore` gains a third branch ahead of
merge/replace: drop every preset already carrying that collection, then append the incoming ones
stamped with it. `out.curPreset` matches the sender's selection **within that collection**. The gallery
row is consequently ONE button (`Load scenes`).

**`#preset` is hidden and stays the value store**; the visible control is `#presetlist`, built by
`buildPresetList()` — it exists because **a `<select>` cannot collapse an `<optgroup>`**.
`buildPresetList` is called from `rebuildPresetOptions`, from `applyPreset` (covering the auto-cycle,
which sets `.value` without firing `change`) and from the `change` handler's `-1` branch; miss any one
and the highlight goes stale.

**`openCollections` is a transient Set that starts empty** — every group folds on load while surviving
rebuilds. Your own group is always emitted even when empty. `dropCollection` re-finds the selection
**by identity** after filtering.

**Your own group is labelled with your profile name, cached so it is right on the FIRST paint.**
`#cloud-name` is filled by `cloudFetchProfileMeta` (a network round trip), so a label resolved only
from the live field renamed itself when you clicked the group open. Two halves, both needed:
`myProfileName()` reads `#cloud-name` then falls back to **`PROFILE_NAME_KEY`**
(`burnTheWeb.profile.v1`) *synchronously*; and **`setProfileName(v)`** is the one way the name is set —
it writes the field, the cache, and calls `buildPresetList()` (covering a first sign-in and a rename,
where no cache helps). Its own key, **not** part of `cloudSess`, so it outlives a sign-out.
`myCollectionLabel()` = `myProfileName() || DEFAULT_PROFILE_NAME` (`"burnTheWeb"`, the same string
`cloudSave` writes). `sceneTitleFor` uses `myProfileName()` **without** the default.

**Auto-cycle rotation: `p.rotate`.** Each scene row carries a checkbox; unticked scenes stay selectable
by hand but are skipped by the cycler. `inRotation(p)` is `!(p.rotate === false)` — **absent means
IN**, so everything saved/shared/backed up/published before the field existed keeps cycling, and
`setRotation` *deletes* the key rather than writing `true`, so a fully-ticked library serialises
byte-identically. `rotationPool()` is rebuilt per tick; with nothing ticked the cycler **idles** rather
than falling back to the whole library. `setRotation` calls `persist()` but deliberately **not**
`autosavePreset()` — the tick belongs to the scene in the library, not the scene on screen.
- Like `collection`, `rotate` is **not** in `snapshotScene` and **must be listed explicitly in
  `validatePresetList`**.
- The row is a `.pl-row` holding the checkbox **beside** the `.pl-scene` button (a checkbox cannot live
  inside a `<button>`). Its click `stopPropagation()`s so ticking never selects.
- **`.pl-unsaved` also carries `.pl-scene`**: "— unsaved scene —" is a mode, not a saved scene, and has
  no checkbox. Anything selecting `.pl-scene` to count scenes is off by one.

**`autosavePreset` must carry over every field that rides beside `name`.** It rebuilds
`presets[curPreset]` from `snapshotScene()`, which captures none of them, so a bare `{name, ...}`
silently dropped `collection` (reassigning someone else's scene to you on the first slider drag) and
`rotate`. Adding a field beside `name` means editing **three** places: here, `validatePresetList`, and
wherever it is set.

### Presets & persistence

**The user-facing word is "scene", the code word is "preset".** Menu, prompts, titles and help say
scene; nothing in the **code or wire format** was renamed (`presets`, `curPreset`, `kind: "preset"`,
`#preset`, `.presetrow`, every `*Preset*` function) — renaming blob fields would stop every saved
scene, backup, link and cloud profile loading. Two consequences: **`HELP.sliders[].n` must match the
rendered label text** (`ctlHelpBlurb` looks up by `ctlLabel(key)`), and `safeFileName`'s empty-name
fallback is `"Scene"`.

A **preset** is `snapshotScene()`: `{name, effect, state, beat, pulse, plen, cam, sceneFx, beatTune,
ranges, ttl, tdur, extra, layers}`. Several are globals **deliberately remembered per preset**, because
anything a preset fails to carry renders as the recipient's value, invisibly:
- `cam` — `camrx/camry/camrz` exist in no effect's `defaults`.
- `sceneFx` — the scene-global filters live nowhere in an effect's state.
- `beatTune` — different thresholds mean a different animation.
- `ranges` — `mergeState` does **no** bounds check and `loadState`'s `el.value =` is silently clamped
  by the DOM, so a value authored against a widened bound would quietly animate differently.
- `ttl` + `tdur` — a preset remembers the pacing it was authored with, so a shared scene *plays* the
  same. `applyPreset` installs them via `applyPresetDual`. Older presets omit them; then the current
  globals are left alone.

`applyPreset` applies `ranges` **first** (mirroring `applyBlob`), then `ttl`/`tdur`.
`tools/presetprobe.js` asserts by construction that every field `applyPreset` restores is one
`snapshotScene` captures *and* one the import mapping carries.

What deliberately does **not** travel: resolution (`cfg.scale`), audio on/off (needs a gesture), the
`randSeed` re-roll, the `Date.now()` chaos seed, and every accumulated phase. A shared scene is the
same *configuration*, not the same *frame*.

**The first-visit preset library** is built once when `presets.length === 0`: `defaultPresets()` (one
per effect) with **`DEFAULT_SCENE` prepended and applied**, so a new visitor opens on the shipped scene
(`JuliaBgTet`, a four-layer Rasta stack). `DEFAULT_SCENE` is a real exported preset in the **wire
format** (effect ids, pruned to deltas — only beat/pulse/plen are pruned; state maps kept whole).
`defaultScenePreset()` runs it through `deserializeBlob` and returns null if it names a retired effect.
The fresh visit then `persist()`s once. To change the opening scene, export a preset and replace
`DEFAULT_SCENE`.

**Creating a preset and restoring a backup both stop the cycler** (`stopCycling()`) — auto-cycle is on
by default, so the next TTL tick used to swap a just-created preset straight back out. `applyRestore`
can't call it (it reloads), so it writes `out.cycle = false` into the blob, set **last** so it also
overrides the backup file's own `cycle`.

**Switching effect stays on the selected preset and folds the change into it.** The handler is three
lines — `setEffect`, `autosavePreset`, `persist`. A preset is "my scene" and its effect is just another
field, so changing it is an edit like moving a slider. The knock-on is **intended**: a preset named
after the effect it started as keeps that name. `autosavePreset()` still early-returns while
`curPreset < 0`, so "— unsaved scene —" is a genuine scratch mode. `presetprobe` asserts the current
rule structurally, because the two previous behaviours (deselect; auto-select a preset of the new
effect) both look reasonable in isolation.

Presets are **local to the browser**. Selecting one links edits to it: `onEdit` → `autosavePreset()`
(no manual save). `mergeState()` normalizes a loaded preset to the current slider set against
`presetState(e)`; `mergePulse()` does the same for `pulse`.

**Every one of `applyPreset`'s four maps must go through its `merge*`** — `mergeState`, `mergeBeat`,
`mergePulse`, `mergePlen`. A preset saved before a control existed has no entry for it, so `loadBeat`
spread `undefined` into `{}` — and **`classList.toggle("on", undefined)` *flips* the class** (per spec,
an explicitly-passed `undefined` counts as "force not supplied"). The chip inverted on every load while
`updateAnims` never armed the slider. `loadBeat` now spreads over an all-false base and `syncChips`
coerces with `!!`.

**Beat chips are `<button>`s, so they fire neither `input` nor `change`** — the delegated `onEdit`
cannot see them. `chipEdited()` does it by hand: `autosavePreset()` (guarded on `persistReady &&
!applyingPreset`) then `persist()`. Calling only `persist()` reached `localStorage` but never the
selected preset.

- **Storage**: `localStorage["burnTheWeb.v1"]` = `{states, beats, pulses, plens, extras, effect, ranges,
  beatTune, presets, curPreset, cycle, ttl, scale, panelOpen, audio}` — built by the single helper
  **`fullSnapshot()`**, *the* definition of "everything we remember". `persist()` and the Backup file
  both serialize exactly that. `applyBlob(saved, sharing)` (shared by `restore()` and `applyShared()`)
  applies `ranges` + `beatTune` **first**, then validates every value against those bounds. Anything a
  user can change that is *not* in `fullSnapshot()` is deliberately transient (pause, fullscreen, fold
  states).
- **Custom slider ranges** (min/max/step) are saved. `RNG_ORIG` captures the shipped bounds up top
  (before `restore()` can overwrite them); `collectRanges()` stores only sliders that differ;
  `applyRanges()` sets them back. They ride in `localStorage`, the share URL and the Backup file.

### Share / bundle / backup codecs
**Everything that DECODES must keep working forever.** `?z=`/`?s=` scene links, `#zp=`/`#sp=` preset
bundles and `#c=` cloud scenes all still open, and they land in the **Restore dialog**, which is also
where *Load from cloud* and the gallery land.

- **Scene share (`?z=`)** — JSON through `CompressionStream("deflate-raw")` → base64url (base64url
  matters: `+` and `/` cost three characters each percent-encoded). `?s=` (plain base64) is emitted
  when `CompressionStream` is missing and **decoded forever**; `?z=` is checked first and the two are
  mutually exclusive. Values are rounded on encode to each control's `CONTROLS.step` then **clamped to
  the live bounds** (`applyBlob`'s `ok()` is a hard reject). Decoding `?z=` is **async**, landing after
  startup's `setEffect`, so the promise re-activates with `resize()` + `setEffect(...)`. `shareUrl()`
  is therefore async, and Share copies via `ClipboardItem`'s promise form so the user gesture survives
  an `await`.
- **It encodes only the CURRENT scene** — `{states, beats, pulses, plens, extras, effect, cam,
  beatTune, ranges}` with exactly one entry per per-effect map. The map *shape* is unchanged
  (`{[effectIndex]: …}`), so **every old all-effects link still decodes** — `applyBlob` skips keys the
  blob omits. `cycle`/`ttl` are deliberately dropped (recipient's preferences). `stripShareParam()`
  runs during startup, so anything reading `location.search` later sees it gone.
- **`pruneBeats()`/`prunePulses()`** send only what differs from each effect's `presetBeat(e)` / pulse
  defaults. **Prune against the descriptor's defaults, not against all-false** — they coincide today,
  but the moment a descriptor arms a chip, all-false would drop the user turning it *off*. Pruning is
  share-only; `fullSnapshot()` stays verbose. Works **only because `applyShared` re-seeds first**
  (`initStates()`/`initBeatStates()`/…), otherwise pruned maps decode against the recipient's own saved
  scene.
- **Short link** — `shortenUrl(url)` POSTs to `tinyurl.com/api-create.php`. TinyURL because it 301s
  byte-for-byte, sends CORS headers, needs no key, and doesn't block `github.io` (is.gd/v.gd reject all
  GitHub domains). POST keeps a big scene off the query string. The API signals failure with **200 + an
  error string**, so the response shape is validated.
- **Preset-bundle links** — `libraryUrl(chosen)` = `serializeBlob({presets, cycle, curPreset})` →
  deflate, carrying the auto-cycle toggle and the selected preset (as an index *within `chosen`*).
  **The payload rides in the URL FRAGMENT — `#zp=` (fallback `#sp=`), not a `?query`** — a multi-KB
  query makes GitHub Pages / Fastly answer **414 URI Too Long** before any JS runs. `#zp=`/`#sp=` are
  also **distinct** from `?z=`/`?s=` so the decode paths never collide. Recipient side: `applyShared()`
  checks the fragment **first** and routes to **`openSharedLibrary`** → `normalizeBackup` →
  `deserializeBlob` → **`validatePresetList`** → the **Restore dialog**. A **file** restore forces
  auto-cycle off; a **link** honours the sender's toggle (the `__link` marker gates it). The receiver
  lands on the sender's selected preset's *scene*: `applyRestore` stashes the index in
  `sessionStorage["btw.applyPreset"]` and startup reads it once.
- **Ordering trap:** `openSharedLibrary` lives in `persist-backup-restore.js` but `applyShared()` is
  *called* during the earlier `audio-tuning-data.js` load, so `pendingRestore`/`openRestore` are in the
  TDZ then. The async `#zp=` unzip `.then` lands after all slices; the sync `#sp=` path is deferred the
  same way (`Promise.resolve().then(…)`) or it throws. Same for `#c=`.
- **Backup** writes **one file per preset** (named after the preset) plus `_settings.json`.
  `backupFiles()` builds `[{name, text}]`; each preset file is `{app, kind: "preset", version, preset}`
  through `serializeBlob`. `curPreset` is deliberately **not** in `_settings.json`. Delivery splits on
  `showDirectoryPicker`: Chromium writes into `BurnTheWeb/<YYYY-MM-DD_HHMM>/`; everything else
  downloads one file per preset **~150ms apart** (browsers drop back-to-back downloads) and
  **flattens** rather than nests, because the HTML spec has user agents sanitize path components out of
  `a.download`.
  - The folder handle lives in IndexedDB (`burnTheWeb.fs`) — localStorage only stores strings.
    `backupRoot()` reuses it when permission is still granted. **Shift-clicking Backup forces a
    re-pick.** A write failure calls `bkClear()`.
  - **`bkStore` must always resolve** — a throw inside an IDB event handler leaves the promise pending
    forever and hangs Backup (`put()` throws `DataCloneError` where handles aren't cloneable).
  - **`safeFileName`** strips path separators, Windows-illegal characters and control codes, trims,
    drops trailing dots/spaces, escapes reserved device names (`CON`, `NUL`, `COM1`…), truncates to 80,
    falls back to `Scene`. `backupFiles` de-duplicates with ` (2)`. `presetprobe` pins it.
- **Restore** takes **multiple files**. `normalizeBackup()` folds every shape we have ever written into
  one (single preset file, settings file, whole-library snapshot, legacy `{presets, ranges}`, bare
  array) and runs **before** `deserializeBlob`. `openRestore(parsed, valid, name)` shows a checkbox per
  part the selection contains plus a merge-vs-replace radio (Presets is **not** always enabled —
  selecting only `_settings.json` is legitimate). `applyRestore()` starts from `fullSnapshot()`,
  overrides only ticked parts, writes to `localStorage` and **reloads**. (`location.reload` is
  non-configurable in Chromium, so tests read `localStorage` synchronously and stash the verdict in
  `sessionStorage`.)

**The Backup / Restore / Share buttons are gone from the menu** — the cloud profile is the one way in
and out. Only the half that **creates** files and links was removed. `libraryUrl`, `shortenUrl`,
`backupFiles`, `safeFileName` and the IndexedDB helpers are unreachable from the UI and deliberately
**kept**: pure builders, pinned by probes, one line to re-attach. `validatePresetList` and
`normalizeBackup` are live because the cloud path uses them.

### Cloud profiles (Firebase Auth + Firestore, over REST)
`src/cloud-profile.js` is the whole client; `firestore.rules` (repo root) is the whole security
boundary.

**No Firebase SDK** — `fetch()` against three REST endpoints (`identitytoolkit` to exchange a Google ID
token, `securetoken` to refresh, `firestore` for the document), so the page stays one self-contained
file. The one remote script is Google Identity Services for the sign-in button.

**`CONFIG.cloud.apiKey` is a kill switch**, like `CONFIG.analyticsId`: empty ⇒ row hidden, no script
injected, **no request made at all**.

**The payload is one deflated string, not Firestore structure.** Firestore's REST API wraps every field
in its type (`{"stringValue":…}`; integers are *strings*), so mapping the nested blob in would mean a
second encoder duplicating `serializeBlob`. Instead `cloudBlob()` builds exactly the blob `libraryUrl()`
builds and runs it through the same `zipToB64` — **a cloud profile and a `#zp=` bundle are the same
bytes**, the document has five scalar fields, and the typed-value codec (`fsOut`/`fsIn`) is a dozen
lines. A downloaded profile goes straight to `openSharedLibrary(raw)`, inheriting validation and the
Restore dialog. **If those two formats ever diverge, cloud loading needs its own decoder** —
`cloudprobe` asserts the shared path structurally.

**Rules are the only defence** — the web API key in the page is public by design and there is no
backend. The rules carry the size caps a server's body limit would provide, and `hasOnly()` pins the
document shape; without it the collection is a free 1 MiB-per-doc file host. `firestore.rules` is
checked in so the boundary is reviewable in a diff; its header lists the nine cases to verify in the
console Rules Playground.

Tokens: the id token lasts ~an hour and is refreshed **60s early**; a 401 mid-flight refreshes and
retries **exactly once**. Session tokens live under their own `localStorage` key, **not** in the scene
blob.

**"Share this scene"** stores the scene in Firestore and returns a ~12-character `#c=<docId>` fragment.
Signed out, or if the write is refused, it falls back to the self-contained `?z=` link — the cloud
route is an optimisation, not a gate. The payload is **`sceneBlob()`, split out of `shareUrl`**: one
definition of "what a shared scene is", two transports; the recipient path is the existing
`installShared`.

**Shared scenes live in `/scenes`, NOT `/profiles`** — a link into a profile would only open while that
profile was published, so sharing one scene would drag the whole library public. `/scenes` docs are
world-readable, created only by a signed-in user stamping their own uid as `owner`, **immutable**
(`allow update: if false`), and deletable by their owner.

**`installShared` also resets the preset chooser to "— unsaved scene —"** — it always set
`curPreset = -1` but left the `<select>` showing whichever preset startup selected.

**The gallery ("Published scenes") applies a row straight away — no Restore dialog.** Each row has
*Load and merge* and *Load and replace*, because merge-vs-replace is the entire content of the dialog
it used to open. **`applySharedLibrary(raw, replace)` does not reimplement the apply** — it stages the
same `pendingRestore` + checkbox state and calls `applyRestore`. `sharedLibrary(raw)` is the shared
decode+validate half, so the dialog route (`openSharedLibrary`, used by `#zp=` links and *Load from
cloud*) can't drift from the dialogless one.

**The gallery is browsable signed out**, so `galFetchJson` uses a plain keyed `fetch` rather than
`cloudFetch`, and the Browse button sits *outside* `#cloud-authed`. Publishing is opt-in and
**`cloudPublish` re-saves the whole profile** rather than patching `pub` alone (the rules require
name/payload/count).

**The listing survives a missing composite index.** `where pub == true` + `orderBy updated` needs one;
a fresh project answers 400 `FAILED_PRECONDITION` with a creation URL. `galList` retries **unordered**
and logs the URL once via `console.info`. The **sort is applied in both cases**, so rendered order
doesn't depend on which path ran. The query `select`s away `payload`. Cached for
`CONFIG.cloud.galleryTtlMs`; `galBust()` clears it when publishing changes.

### Audio & beat reactivity
`audio` holds the WebAudio graph; `startAudio("capture"|"mic")` must run inside a user gesture. **Pulse
mode**: with audio on and an armed chip, `updateAnims()` stops that slider drifting — it rests at the
low thumb and snaps to the high thumb on each beat. Browsers can't silently re-grab audio after a
reload, so `armAudioResume()` re-opens the last source on the first post-load gesture.

**Mute is `audio.muted`, and the split from `audio.on` is the whole design.** The `♪` button (and the
**S** key — `M` is the menu here) calls `toggleMute` → `setMuted`, which **never touches the stream**:
the same "can't silently re-grab" rule means `stopAudio()` would cost a fresh picker dialog to come
back from. `audioTick` early-returns instead.
- `audio.on` keeps its meaning — **a stream is open**. Everything asking "is audio reaching the
  visual?" goes through **`audioLive() = audio.on && !audio.muted`**. Four sites: `stepAnim`'s `armed`
  (the important one — reading `audio.on` would leave armed sliders frozen at their low thumb),
  `flashChips`'s `lit`, `frame()`'s `updateMeter`/`flashChips`/`clearBeats`, and the `audio-off` class.
  What still reads `audio.on`: the Capture/Mic buttons' lit state, `armAudioResume`, and
  `fullSnapshot`'s last-live-source field.
- `setMuted` zeroes `pulse`/`energy`/`beatNow` and calls `updateMeter()` + `flashChips()` **once** on
  the way down (`frame()` stops refreshing them once `audioLive()` is false). `stopAudio` clears
  `muted`. `audio.muted` is **transient**.
- The glyph is the **same `♪` in both states**, with `.muted` adding `line-through`, so it never
  changes width or baseline.

**The detector (`audioTick`) is an onset detector, not an energy detector** — don't "simplify" it back.
Per band it computes **spectral flux**: the sum of positive bin-to-bin changes since the previous tick.
Load-bearing properties:
- **Float, linear magnitudes** — `getFloatFrequencyData` → `10^(dB/20)`. The *byte* spectrum is
  dB-compressed, so a ratio test there is a ratio in log space and a real 6dB hit barely moves it.
- **`smoothingTimeConstant = 0`** — the analyser's smoothing is a low-pass across frames.
- **Adaptive threshold + peak picking** — a beat is a *local maximum* of flux above
  `median(last ~1s) × beatCfg.fluxK[b]` and above `beatCfg.floor × recent peak`, with a per-band
  refractory. Peak-picking is causal and inspects the *previous* tick (one 10ms hop of latency).
- **Bands are narrow on purpose** (default 30–150 / 150–2500 / 2500–12000 Hz; `computeBins` maps them
  to FFT bins) — a wide low band dilutes the kick, and 2k–16k over ~680 empty bins never clears a
  floor.
- **Thresholds are live-tunable and per-preset scene data.** `beatCfg` (defaults `BEAT_DEFAULTS`, both
  in the detector constants block) holds per-band `fluxK`, global `floor`, per-band `refract` and
  `bands`. `mergeBeatTune(saved)` has **replace semantics** (start from `BEAT_DEFAULTS`, overlay only
  valid supplied fields) — merging into the live `beatCfg` would leak the previous preset's tuning into
  any preset that omits a field. `installBeatTune` writes fields **in place**, never replacing the
  object (`audioTick` closes over it and `beatprobe` slices it out of the constants block). It also
  re-runs `beatBuild()` and `computeBins()` (the latter only when `audio.on`, since it throws before
  audio starts).

`audioTick` runs on a **fixed `setInterval(HOP_MS)` (100Hz), not rAF** — beat timing must not jitter
with framerate. Beats are **latched** in `beatNow[]`; `frame()` calls `updateAnims()` then
`clearBeats()`. `audioTick(t)` takes an optional timestamp so tests can drive a fake clock.

**Beat tuning** lives in its own `<details class="box" id="beatDetails">` beside the other scene
controls, because it is per-preset scene data that must autosave:
- Its CSS is scoped to `#beatDetails`.
- `beatChanged` must **not** `persist()` itself (the delegated `onEdit` already does — double write).
  `beatReset` is a click, so `onEdit` never sees it: it persists + autosaves by hand.
- `RNG_ORIG` and `refreshRangeUI` skip `#beatDetails` explicitly: the generated beat sliders have **no
  `id`**, so letting them into the ranges scan writes an `RNG_ORIG[undefined]` entry and
  `collectRanges` then emits a junk `undefined` key into every saved and shared blob.
- `beatUi` is a **`var`** (like `card`): `installBeatTune` runs during startup long before the
  declaration and reads `beatUi && beatUi.wired`. With `let` that read is a TDZ crash.
- `applyPreset` rebuilds the sliders (`beatBuild`), so any reference held across a preset switch is a
  **detached node** — its listeners fire but nothing bubbles to `onEdit`.

### Dev tools
There is **no Diagnostics section**. The **beat-detection trace** (`?debug=1` or the checkbox in Beat
tuning; a floating canvas built by `dbgInit` showing scrolling flux + threshold + beat ticks per band,
lane labels read from `beatCfg.bands` live) lives in the Beat tuning box. The frame + FPS counter lost
its toggle — `H` governs it via `body.ui-hidden`, and `#frames.hidden` survives in the CSS as the
mechanism `?hideui`/`H` drive.

**The opt-out from persistence is `data-nopersist`**, not `#diag`: `onEdit` early-returns on
`closest("[data-nopersist]")`, and `RNG_ORIG`/`refreshRangeUI` use the same marker — a dev control can
live anywhere and still opt out.

### "Sync with your music" nudge + analytics
`#syncpop` shows to users who haven't started audio, at growing gaps of active (tab-visible) time
(`SYNC_DELAYS` = 30s, 5min, 1h), capped at 3 showings ever; state in
`localStorage["burnTheWeb.sync.v1"]`, satisfied for good once any source goes live. `track(name,
params)` is a provider-agnostic hook; the GA4 gtag scaffold is **live** (`GA_MEASUREMENT_ID` is a real
`G-…` id). Clearing it back to `""` makes it completely inert.

### Timing model
`frame()` runs every rAF. The **fire sim is decoupled** from render: a fixed accumulator tick
(`cfg.burn` ticks/sec, capped 4/frame) while render/morph/beat run every frame. Phase clocks accumulate
per tick from the live speed rather than reading the wall clock, so animating the speed never teleports
the phase. Clicking the canvas toggles `paused`.

### Determinism
The chaos game uses a **mulberry32 PRNG re-seeded to `SEED` every frame**, so the point *sequence* is
identical each frame — only the moving geometry reshapes the fractal. Auto-morph uses `Math.random()`,
kept separate so it never perturbs the fractal.
- **AnimeJulia random start.** `juliaOuter/juliaInner` default to 0 and are set by `reseedJulia()`: a
  random lap when the per-effect **Random seed** toggle (`randSeed`, an `extras` field, default on) is
  on, else 0. `setEffect` calls it on every entry to AnimeJulia.
- **Attractor point jitter.** The de Jong map is exact; `atjit` scatters each stamped point by ±jit heat
  pixels to dither the hard threads, drawing from `Math.random()` (clear of the chaos PRNG). The
  `jit > 0` guard keeps jitter 0 byte-identical.
- **Don't add a fixed-seed toggle for the jitter** — built, shipped and reverted. The heat grid
  accumulates over many ticks, so a repeating scatter and a free one fill the same neighbourhood within
  a few frames.

## Config & control gotchas

`cfg = { points, speed, decay, scale, burn }` holds live fire state. Sliders are wired via
`bindRange(id, valId, fmt, apply, durScale, beat)` and registered in `anims`; `updateAnims()` drives
their drift between the two thumbs. `bindRange`'s `ui()` reads `lo.min`/`lo.max` **live** rather than
closing over them, because bounds are editable at runtime — and it uses them to pick precision: **a
slider whose range spans more than 1 shows at most one decimal** (three significant digits is right for
a 0–1 knob and absurd on a wider one — readouts like `0.00815×–1.5×`). The rounding is applied to the
value handed to `fmt`, so each control keeps its own units, and it is **readout only** — the applied
value stays a free float. Non-obvious mappings:
- **Flame rise** is linear in flame *height*: `decay = 128 * R / (R - 1)`.
- **Drift speed** slider value is divided by 100 → `cfg.speed`.
- **Rotation** slider is degrees/second → rad/s (`rotSpeed`), accumulated into `spinAngle` per tick
  (independent of drift speed & burn rate).
- **Tetrafyer has two rotations.** `Rotation` yaws (`spinAngle`); the **pitch** is `nodAmp·sin(nodPhase)`
  behind the **Box nod** (degrees) and **Nod speed** (×) sliders. `nodPhase` is **accumulated per tick**
  (`NOD_RATE · nodSpd · cfg.speed / cfg.burn`), not derived as `0.12·simT` — reading it off `simT` would
  teleport the nod mid-swing once the rate is animatable. At `nodSpd` 1 it tracks `0.12·simT` exactly.
- **Palette** is baked into a `Uint32Array` in **little-endian ABGR** for direct pixel writes.
  **Banding** is a *filter* over the active palette, not a palette of its own.
- **A preset switch always blends the palette in from whatever was on screen** (no snap), but **where it
  blends to depends on the palette cycle**: cycling on ⇒ a fresh random palette; cycling pinned ⇒ the
  palette the preset actually **stored** (it used to be random either way, so a preset could never show
  its own colours). `applyPreset` snapshots the live `paletteBase` *before* `setEffect`/`loadExtra` can
  overwrite it, then calls `beginMorph(fromRamp, morphing ? pickOther(...) : +paletteSel.value)`.
  `beginMorph` paints `fromRamp` into `paletteBase` immediately (so a mid-`frame()` switch doesn't flash
  the target) and arms the blend; `morphOnce = !morphing` makes it a one-shot. A manual pick or a plain
  scene load clears `morphOnce`.
- `cfg.scale` changes need a `resize()` to reallocate buffers.
- **Reset** restores the current effect's `state`/`beat`/`pulse`/`plen`/`extra` **and the shipped slider
  bounds** (`RNG_ORIG`, over every key in `presetState(effect)`, before `loadState` so values validate
  against the restored bounds, then `rngSyncAll()`). It touches only the current effect.

## Testing (no framework — headless verification)

Changes are verified by driving the page in headless Edge and reading a screenshot:
- **Syntax check** each `<script>`: `node -e "...new Function(scriptText)..."`.
- **Assertion probe**: generate a temp copy with an injected `<script>` that manipulates the DOM,
  asserts, and appends a green/red result `<div>`; screenshot with `msedge --headless=new --disable-gpu
  --screenshot=out.png --virtual-time-budget=N file:///…`, then Read the PNG.
- Use `{bubbles:true}` on synthetic events. Seed `localStorage` in a `<script>` placed **before** the
  app. Set auto-morph off before asserting palette. `setInterval` advances under
  `--virtual-time-budget`; `document.hidden` may read true in headless. Analytics stay inert on
  `file://`/`localhost`.
- **`--dump-dom` returns nothing** in the installed Edge, so results have to come back through the
  screenshot. Style the result block `position:fixed;inset:0;background:#fff;color:#000` — otherwise it
  renders under the canvas and the screenshot looks like a clean run with no assertions.

**Headless CAN run WebGL2 — via SwiftShader.** Launch Edge with `--enable-unsafe-swiftshader
--use-gl=angle --use-angle=swiftshader` and `initGL()` succeeds, so shaders actually compile and link.
Assert `gl.getError() === 0` and a console-error count of 0 (a failed link is silent otherwise —
`useProgram(null)` just draws nothing, reading as a dark scene). Expect ~8–15 fps, so give
`--virtual-time-budget` several seconds for anything needing the fire to build up.

**SwiftShader is why a probe HANGS, and the hang looks like a browser bug.** Virtual time only advances
when the task queue drains, so anything that keeps the renderer busy stops the clock and the run never
produces a screenshot:
- **Do not add a layer from a probe.** Two live layers switch on `renderStackColor` (per-layer heat,
  colour, OKLab merge) and the frame loop stops yielding. Test per-layer *UI* by toggling classes, not
  by building a real stack.
- **Never `while (...) el.click()`** — bound every drive loop with a `for`.
- Kill stray `msedge*` processes first, **including `msedgewebview2`**: a dozen of those starve
  SwiftShader enough to turn a 30s run into a timeout.

**A generator script that builds the probe page must not contain a backtick** anywhere in the injected
source (comments included) if it holds that source in a template literal — it closes the literal, node
dies, **the previous probe page is silently reused**, and you debug a stale file. Same class of trap:
`\n` inside that literal becomes a real newline and the injected script fails to parse, so nothing
runs at all. Prefer `String.fromCharCode(10)`, and check the generator printed its "wrote" line.

**The app is one IIFE, so an injected `<script>` cannot call into it.** UI-level assertions (DOM, menus,
`localStorage`) work from the page; anything needing an internal function has to be a Node probe that
slices the source, which is what every `tools/*probe.js` does.

**A CSS regression is best tested WITHOUT the app.** Inline `src/styles.css` into a bare page with a
synthetic node (`<div class="lyr folded"><div class="lyrblock">`) and read `getComputedStyle` — no
WebGL, no timing, runs in a second. Prove the check is sensitive by re-appending the old rules and
watching it go red; a cascade test that cannot fail is measuring nothing.

**Four traps when the thing you screenshot is ONE effect** (all four produced confident, wrong
readings):
- **Turn auto-cycle off first** (`#cycle`) — the TTL swaps the preset every few seconds. Assert the
  effect is *still* the one under test at screenshot time. It may already have swapped **before** your
  first line runs, so don't assume the shipped four-layer scene is still loaded.
- **`gl.getError()` must be sampled inside a real frame** — read afterwards it returns a spurious
  `0x502` from the probe's own `readPixels`. For the same reason pixel evidence must be the screenshot,
  not `readPixels` (the drawing buffer is cleared on composite).
- **`?stack=<id>` does not survive a fresh profile** — the first-visit branch installs `DEFAULT_SCENE`
  over it. Drive the layer-row UI, or seed `localStorage` first.
- **Keep the run under 30s of active time**, or `SYNC_DELAYS[0]` opens the sync nudge over the canvas.
  `?credits=0` doesn't clear credits in a slow run — `creditLeft` counts *rendered* time.

**The pixel gate is BISTABLE — treat a single mismatch as inconclusive.** A no-filter Plasma scene
returns the same hash ~9 times in 10; Plasma + Fire only ~3 in 4. The alternates are *stable values*,
pointing at a startup race, and both files under test show it — a property of the harness. **Always
re-run a mismatch 2–3 times.** A *repeated* mismatch is a real signal.

**Pixel-level regression gates: shader effects only.** With a stubbed rAF (own the callback queue, fixed
1/60 step), shader effects are bit-reproducible. **Point effects are not** — Sierpiński/Tetrafyer hash
differently between two runs of the *same* file; gate those on logic. Harness requirements:
- **Inject before the app**, into `<head>` — stubbing rAF after init lets real frames advance `simT` and
  the morph for however long startup took.
- **Do not clear the rAF queue** — `frame()` re-arms itself, so clearing leaves nothing to call and every
  configuration hashes to the untouched startup frame.
- Stub `Math.random` too, and read pixels with `readPixels` in the **same task** as the last frame.

**A green logic probe is necessary and not sufficient** for anything that writes the retained heat
buffer — the credit-stamping zoom bug passed its probe cleanly because it only existed across
*accumulated* ticks with a *drifting* zoom. Drive a few hundred real frames and look at the screenshot.

**Testing the credits overlay**: read `#creditcv` itself (`getImageData`, count pixels with alpha > 8)
rather than the composited frame. Assert the layer properties too (own canvas, `pointer-events: none`,
z-index above `#fire` but under the menu). **The claim to nail is that credits no longer touch heat**:
zero `fire`, put credits up, call `creditDraw()`, assert the buffer still sums to zero. Do *not* diff
heat with credits up vs down — `simT` advances between runs.

**Testing the credits/scene-title overlay, three traps** (each produced a red assertion on correct
code):
- **Contiguous inked-row runs are NOT a stable identity for the credits** — they read as 2 bands at full
  alpha and 4 mid-fade. Use the ink **bounding-box height** to tell the credits block from a one-line
  title; a `bands === 1` check is only safe for the title.
- **`frame()` clamps `dt` to 0.25s**, so pumping a stubbed rAF at 500ms steps accounts for half the
  rendered time it looks like and the credits never expire. Step **under** 250ms.
- **Compare pixel COUNTS only between identical strings** — across two names it measures text length,
  not alpha. To prove a re-arm restores full alpha, re-select the *same* scene. To prove the name is
  really drawn, compare bounding-box **width** across names of very different lengths (`prompt` is
  stubbable).

**Testing audio needs `AudioContext` stubbed**, not just `getUserMedia` — a real one hangs headless
(`await audio.ctx.resume()` never settles with no audio device). The detector's contract is small
(`sampleRate`, `resume`, `createAnalyser`, `createMediaStreamSource`, and an analyser with
`fftSize`/`frequencyBinCount`/`getFloatFrequencyData`/`min|maxDecibels`). Pair it with a no-op rAF.

**Testing share paths** needs three stubs: `navigator.clipboard` with capturing `writeText`/`write` (the
`write` stub must resolve the ClipboardItem's promise and read the Blob back), and a stubbed `fetch` for
Short link. Run it **twice** — once as-is, once with `ClipboardItem` hidden.

### Node probes (`tools/*probe.js`)
All slice real source out of the built file by **markers — keep them**.

- **`filterprobe.js`** — every filter's params have defaults, the three stages appear in pipeline order
  with Bloom last **among the post ones**, every screen filter is `cpuOk: false`, a stored list applies
  in **registry** order, `filtersOk` drops unknown/duplicate/non-string ids, the point-vs-shader
  defaults, `presetState`'s seeded arrays are per-effect **copies**, and an **empty** stored list is
  honoured (only a *missing* `filters` key falls back to the descriptor default).
  Markers: `// ---- FILTERS: stackable post-FX` … `function initStates(`; `function presetExtra(` …
  `function initExtras(`.
- **`presetprobe.js`** — **structural** half: every `p.<field>` `applyPreset` restores is one
  `snapshotScene` captures *and* one the import mapping rebuilds (the mapping silently dropped `cam` for
  a long time). **Behavioural** half: `mergeBeatTune`'s replace semantics and junk rejection. Also pins
  `safeFileName` and `normalizeBackup`. Markers: `const BEAT_DEFAULTS` … `const beatCfg`;
  `function mergeBeatTune(` … `function installBeatTune(`; `function snapshotScene()` …
  `function defaultPresets(`; `function applyPreset(` … `function createPreset(`;
  `function validatePresetList(` … the comment that replaced the old import button.
- **`heatprobe.js`** — ping-pong **parity is invisible to a screenshot**. For chains of 0–4 passes from
  either starting buffer: `pendingDst` names the buffer the *last* pass wrote, no pass samples its own
  render target, the final FBO is still bound on exit. Also pins **`glLayerBeginHeat`** (same parity,
  returns the last-written buffer instead of setting `pendingDst`). Markers: `function glBeginHeat(` …
  `function glBlitPoints(`; `function glLayerBeginHeat(` … `function renderLayerHeat(`.
- **`juliaprobe.js`** — the rim point matches the cardioid formula, the seed sits exactly `juliaInnerR`
  off that rim, the inner phase advances at `ratio ×` the outer and yields `ratio` epicycles per lap,
  `juliaOffX` shifts only the real axis, and each of the three descriptors advances the orbit **once**
  per frame. Markers: `const RPM` … `function julia(`.
- **`solidsprobe.js`** — every failure mode here is invisible to a screenshot. Pins containment (6000
  steps, a 9.5s frame, every slider extreme), quaternion normality, `Shape mix` never naming a primitive
  the shader lacks, `Count` clamped to the shader's array size, per-layer body ownership, determinism,
  per-axis start spread. **Two tolerance traps:** assert double-exactness on the BODIES (`S.Q`) and only
  float32 tolerance on the staged uniform arrays; and strip comments before grepping for `Math.random`.
  Markers: `const SOLID_SHAPES` … `// ---- CPU mirror of FS_SOLIDS`.
- **`beatprobe.js`** — a headless browser has no audio, so this runs the real detector with a stub
  analyser fed synthetic dB spectra on a fake clock: a kick riding loud sustained bass, hi-hats on 8ths
  (no leak into the low band), a 20dB quiet verse, silence and a sustained tone (no false positives), a
  double-time fill (refractory holds). Markers: `const HOP_MS` … `const meterBars`; `const medBuf` …
  `function audioMsg`; `function audioTick` … `function clearBeats`.
- **`shareprobe.js`** — the share codec round trip.
- **`cloudprobe.js`** — the cloud path structurally shares `serializeBlob` + the codec with `#zp=`
  bundles, and an empty `CONFIG.cloud.apiKey` makes zero network requests at startup.
