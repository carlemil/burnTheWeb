# CLAUDE.md

Rules for this repo. Deliberately terse — nearly every line is load-bearing, and **"don't X"
means X was tried and failed**. The reasoning behind each rule was stripped in the 1.12.3
compaction pass; recover it with `git show v1.12.3:CLAUDE.md`.

## What this is

Self-contained demoscene visual on GitHub Pages (https://carlemil.github.io/burnTheWeb/).
Effects share one palette + glow + banding + beat-reactive pipeline, in four families:

- **Point-accumulation** — Sierpiński (`sirpinfyer`), Tetrafyer, Attractor (de Jong),
  Fractal flames (`flames`, the one **additive** stamper — `stampAdd`), Boids (flock on
  `L.boids`, the solids arrangement).
- **Shader fractals** — AnimeJulia, Burning Ship, Multibrot, Newton.
- **Shader pattern** — Plasma, Tunnel, Metaballs, Kaleidoscope, Rotozoomer, Moiré, Munching
  Squares, Copper Bars, Sun surface, Kefrens bars, Twister, Cymatics, Lightning storm,
  Starfield, Aurora, Reaction-diffusion (own state textures — see below).
- **Shader SDF** — Polygon, Shape grid, Concentric rings, Bouncing shapes (2D), Bouncing
  solids (3D raymarched), Mandelbulb, Menger sponge (both 3D raymarched).

Each = one `EFFECTS` descriptor + a `draw(dt)` shader hook or a `stamp(box)` point hook. No
package manager, test framework or runtime dependency. Keep `README.md` in sync.

## Build

- **Source of truth is `src/`.** `styles.css` + `*.js` concatenated in **`src/manifest.txt`
  order** into `dev-index.html`. That order is load-bearing (TDZ + forward refs) — don't
  reorder. Files named by subsystem: `audio-*`, `render-*`, `effects-*`, `orbit-*`,
  `persist-*`, `stack-*`, `controls-*`, `ui-*`.
- **`src/config.js` loads first, holds `CONFIG`** — every default not part of a preset.
  Scattered `const NAME = CONFIG.path` keeps original names; change defaults THERE.
- `PALETTES` is the single palette catalog (`#palette` options + swatches generate from it).
- **Never hand-edit `dev-index.html` / `index.html`** — generated.
- `node tools/build.js` rebuilds byte-for-byte (split/join, never `String.replace` — its `$`
  handling corrupts JS). `--check` exits non-zero if stale.
- **Deploy with `/deploy`**. `index.html` = production, `dev-index.html` = preview. Probes run
  against `dev-index.html`.
- **Every deploy is a numbered release.** `CONFIG.version` is the only version string.
  `/deploy` bumps it, writes the `CHANGELOG.md` section, tags `v<version>`; the tag must be
  pushed. A version with **no tag** is prepared-but-unreleased — publish *that* one, don't bump
  past it. **major = a saved scene / share link / backup stops loading identically**; that must
  never happen, so patch for fixes, minor for a new effect/filter/control. `CHANGELOG.md` is
  linked from the live page — user-facing.
- **Pages deploys via `.github/workflows/pages.yml`** (Actions), not the legacy branch
  builder — that pipeline went flaky post-1.16.0 (instant zero-detail failures; the
  workflow file's header has the history). Publish status lives in the Actions tab;
  a failed deploy has real logs there.
- `.gitattributes` pins LF (global `core.autocrlf=true`).

## Workflow

- **Always commit and push after a verified change**: edit `src/`, `node tools/build.js`,
  commit **`src/` + `dev-index.html`** together, `git push origin HEAD:main`. Don't ask before
  pushing the preview.
- Commit trailers end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  + the `Claude-Session:` line.
- Preview: open `dev-index.html`, or `python -m http.server`.
- Don't re-run `gh api -X POST repos/carlemil/burnTheWeb/pages`.

## Architecture (one IIFE, authored across `src/*.js`)

### Render pipeline — WebGL2 primary, Canvas2D fallback
`useGL` from `initGL()`; every draw path branches on it.
- **Fire**: low-res heat grid. `glPropagate()` ping-pongs heat textures (cgtutor averaging
  `v = sum_of_4_below * 32 / decay`; `>128` decays, `<128` amplifies). CPU fallback = the
  double loop in `simulate()`.
- **Chaos-game points stay on the CPU** (deterministic): `pushPt()`/`glDrawPoints()`, or
  `plot()` on the CPU path.
- **Shader effects** write heat to the texture's `.r` (`o = vec4(heat,0,0,1)`), each with a CPU
  mirror. Each has an `FS_*` + a `glProg.<id>` registered in `initGL`; `draw(dt)` calls
  `glShaderDraw(name, setU)` or the mirror. `*Seed(dt)` advances phase (identical GL/CPU).
- **Adding a shader effect = append one descriptor** (`FS_*`+`glProg`, `draw`/`cpu`,
  `params`/`defaults`). Sliders generate from `CONTROLS`.
- **Glow**: `glRender()`/`render()` map heat through the palette, then composite an additive
  blurred copy.

### Cardioid seed orbit (AnimeJulia / Burning Ship / Multibrot)
- All three call `juliaSeed(dt)` **once** in `draw`. `julia`/`burningShip`/`multibrot` must
  **never** call it themselves — the CPU path would advance the orbit twice a frame.
- `juliaSeed` = rim point on the scaled main cardioid + a riding circle of radius `juliaInnerR`
  at `ratio ×` the outer phase.
- **The cardioid depends on the exponent**: `d=2` ⇒ Mandelbrot cardioid, else the degree-d
  Multibrot boundary `c = z − z^d` on `|z| = d^(−1/(d−1))`. `cardioidAt(th, d)` is that curve
  (integer d only — it doesn't close otherwise); fractional d rides `cardioidBlendAt`.
  `juliaPower` carries it (fractional now); `setEffect` resets to 2; Multibrot's `draw` sets it
  from `mbPower` **before** calling `juliaSeed`. At `d=2` the result is bit-identical to the old
  hardcoded form — that is what keeps existing presets unchanged.
- Easing: each step × `EASE_K · (1 + JULIA_EASE_A·cos((round(power)−1)·θ))`. The cusp count
  **must stay whole** (a fractional `cos(nθ)` isn't periodic over a lap), so the easing
  snaps to `round(power)−1` while **Power itself is a FLOAT now** — the render takes it raw
  (the fractal morphs continuously; fractional exponents show the characteristic
  principal-branch seam ray) and the orbit rides **`cardioidBlendAt`**: the blend of the two
  neighbouring integer cardioids (closed for every d — the raw parametric curve only closes
  at integers, the whole reason Power used to round), pushed outward by
  **`JULIA_FRAC_BOOST` windowed by `4·f·(1−f)`** (zero at whole powers; 0.3 measured all
  fractional powers into the integers' ~15–22%-inside band). Bit-identical at integer d.
  **`EASE_K = 1/√(1−A²)` is load-bearing** (preserves lap time `1/rpm` minutes at any power).
  Warp applies to the **outer phase only**; symmetric about θ=π.
- `juliaPower` is declared **above `juliaEase`** (the arrow reads it at startup).
- `juliaSeedAt` stays unwarped; the Orbit editor **integrates** `dφ = ratio·dθ/ease(θ)`.
- **Burning Ship rides the "wrong" cardioid deliberately — do not "fix" it.** Shipped `outrad`
  **[1.4, 1.9]** compensates. Washed out ⇒ check that slider first.
- `tools/juliaprobe.js` locks this down.

### Bouncing solids (the one 3D shader effect)
`src/solids-3d.js`: CPU rigid-body physics, ≤8 bodies, hands the shader only `uPos`
(centre+radius `vec4`), `uQuat`, `uShape`. `FS_SOLIDS` raymarches; CPU mirror `solids()` uses
half the steps.
- **Orientation is a quaternion**; the shader undoes it per sample (`toBody`, conjugate
  rotation). One renormalise per frame.
- **Collision is a bounding SPHERE**; every SDF fits inside radius `r` (box half-extent
  `0.55r`, torus `0.70r`+`0.30r`, …). `Size` IS that radius.
- **Clamp the step (`min(0.05, dt)`)** — a backgrounded tab returns one huge `dt` and a body
  tunnels out forever.
- Bodies live on the **layer** (`L.solids`), like `L.tetras`; they can't ride `PHASE_VARS`.
  `installStackItem` calls **`installSolids(L)`** — without it two solids layers share one set.
- Start state uses `sdHash(k, salt, i)`, **not sines**; positions scale to `SOLID_BOX[ax] −
  radius`.
- `tools/solidsprobe.js` pins containment, quaternion normality, per-layer ownership, spread.

### Menger sponge camera (street drive + tunnel dives)
The camera **drives the street grid** of the lattice (corridors at x/z ≡ 1.5 mod 3 in the
y = 1.5 plane), turning at hash-picked intersections through quadratic-Bezier corners
(`MG_R` 0.9), and **hash-picked segments dive through the sponges**: the carve leaves
straight flyable tunnels along the `(±1, ±1)` edge lines of every cube row — the level-1
carve term is exactly **1/3 on that whole line at every Detail** (the DE is `max`-composed,
so deeper carves only raise it; fewest iterations is the binding case). A dive swoops
±0.5 laterally and vertically inside the open gap slab between cube rows (clearance there
≥ ~0.27), threads 1–3 cubes, returns before the end corner; `mgDiveG` is a pure function
of (segment hash, s), so no new state. Path lives in **`mengerSeed` on the CPU** (scalar
state → `PHASE_VARS`); the shader gets `uPos`/`uFwd`/`uRoll` and only builds the view
basis. `uFwd` **tilts during swoops (|fy| ≤ ~0.33) but must never go vertical** — the
basis uses world-up; the CPU mirror builds the same full tilted basis. The bob is scaled
by `(1−g)` (off in tunnels). **Never put the camera on the lattice AXIS or a face-centre
line** — both sit on carve pinch points (clearance zero ⇒ wall-cutting flicker; the
original bug). Only the edge lines are provably clear. Scan-verified: min DE 0.27 over
~900 dives at max sliders, 9.5 s frames included. Lookahead (`mgEval`) is safe because
everything ahead is hash-determined, and `mgEval` must stay pure (the committed advance is
only in `mengerSeed`). `MG_DIVE_P` exists so probe pages can force every segment to dive.

### Effect-shader gotchas (learned the hard way)
- **The heat buffer is Y-FLIPPED against the screen** — buffer row 0 renders at the screen
  TOP (proven with a gradient probe; `fire[]` row 0 is the top on the CPU path too). An
  orientation-sensitive shader (Aurora's hanging curtains, Lightning's sky gradient) must
  treat `gl_FragCoord.y/fh − 0.5` as pointing DOWN, or negate it at construction. Symmetric
  effects never notice, which is why nothing older documents this.
- **Reaction–diffusion owns a state texture pair** (`glTex.rd`, RGBA16F where
  `EXT_color_buffer_float` exists, RGBA8 fallback — 8-bit sub-1/510 increments round to
  zero and freeze the culture). `glRDTick` seeds on `rdNeedSeed` (set by `glResize` and the
  effect's `onEnter`) and ping-pongs `rdCur`. **A SINGLETON deliberately**: two RD layers
  share one culture. Steps scale with `dt` (target `Sim speed`/60Hz-frame), so evolution is
  frame-rate independent.
- **Headless virtual-time runs render FEW real frames with large clamped `dt`** — a
  per-frame-stepped sim looks frozen there while dt-driven animation sails on. Before
  diagnosing a freeze, patch the pass in a PROBE COPY (hard zero / pure decay /
  accumulator writes) — three screenshots separate "pass never lands" from "dynamics
  converged" from "frame-starved". The RD "freeze" was the third.
- **Boids follows the solids arrangement exactly**: the flock lives on the layer
  (`L.boids`), `installStackItem` calls `installBoids(L)` for `boids: true` descriptors,
  start state is hash-seeded, flight is deterministic. Only `bdPrev` (the Scatter
  rising-edge detector) rides `PHASE_VARS`.

### Point-accumulation effects
Run the fire sim, stamp via `plot()`. `simulate()` dispatches to `stamp(box)` if present
(Attractor), else the `fractal2d`/tetra branches. Adding one = a descriptor with `stamp`, no
`draw`.
- **Stamp at `POINT_HEAT` (`CONFIG.tuning.pointHeat` = 209), not 255** — 14/19 palettes are
  near-white at 255 and effects ship with no filters, so the raw stamps are the picture.
- **`stampAdd: true` (Fractal flames) switches the stamp to ADDITIVE**: `plot(x, y, v, true)`
  does `min(255, heat + v)` on the CPU, and all three `glBlitPoints` call sites pass `"add"`
  (FUNC_ADD ONE/ONE) when the item's descriptor carries the flag — density is the picture, and
  MAX stamping would flatten it to a silhouette. The white-out-at-255 concern inverts here:
  the saturated core IS the flame look. `flamesStamp` reseeds the chaos PRNG itself and
  advances `flPhase` per tick (like `nodPhase`); Strike-style beat wiring does not apply.
- Stamping happens inside a **safe box** (heat grid less a 1px margin), shared by all three.
  Size/Rotation scale & spin the corners about the box centre.

### Credits overlay + scene banner
Credits draw on **their own canvas** (`#creditcv`, `z-index: 4`, `pointer-events: none`) via
`creditDraw()` from `frame()` **after** `glRender()`/`render()`; below the menu (`z-index: 10`).
Never stamp them into heat.
- `CREDIT_HOLD` 5s then `CREDIT_FADE` 3s; `creditLeft` counts **rendered** time. `?credits=<s>`
  overrides the hold. Once expired, `creditDraw` clears once and sets `display: none`.
- `CREDITS` drives both the overlay and the panel's Credits box (`buildCreditList()`).
- On/off preference has its own `localStorage` key, **not** the scene blob.

**`#scenebanner` is DOM CHROME, not part of the frame** — `"<scene name>  ·  <account>"` in the
top button row. `showSceneTitle(name, author)` arms `titleLeft` from
`CONFIG.credits.titleHold`/`titleFade` (2.5s + 1.5s); `sceneBannerTick()` pushes that clock.
- **BOTH halves gate on the credits**: `frame()` decrements `titleLeft` only in the `else` of
  `creditLeft > 0`, **and** `sceneBannerTick` must gate on `creditLeft <= 0`. The tick runs
  **unconditionally**, not inside that `else`.
- **`applyPreset` must not read `p.name`/`p.collection`** (presetprobe asserts every `p.<field>`
  is one `snapshotScene` captures). It calls **`sceneTitleFor(i)`**, declared beside
  `collectionOf`.
- Author = `collection`; absent ⇒ `#cloud-name`; no profile ⇒ name alone, dash dropped.
  **Not** `myCollectionLabel()` (its `"My scenes"` fallback is a list heading).
- Own `localStorage` key + **"Show author"** (`#sceneTitleOn`) in the **Scene box under
  Auto-cycle**. Don't add a second copy in the Credits box.
- `#sceneTitleOn` and `#creditsOn` carry **`data-nopersist`** — else `onEdit` autosaves the live
  scene on every tick.
- **`createPreset` does not arm the banner.**

### Preset transitions
`TRANSITIONS` — third registry beside `EFFECTS`/`FILTERS`. Sixteen entries, each a `mode` of the
single **`FS_TRANS`** pass: `cut`, `burnoff`, `crossfade`, `dip`, `flash`, `pixelate`, `blur`,
`wipe`, `iris`, then the staggered family `checker`, `bars`, `shutter`, `slide`, `clock`,
`dissolve`, `ripple`. `cut` needs no pass; **`burnoff` lends retention** (`hasFeedback()` true
while `transBurning()`).

**`cut` is the fallback, never a choice.** Not listed, never auto-picked while anything else is
ticked, and ticking anything drops it from the set. Everything iterates **`TRANS_PICKABLE`**
(registry minus cut) — `buildTransPick`, `setTransUse` (materialise + size-compare; comparing to
`TRANSITIONS.length` would never collapse to `null`), `pickTransition`. It survives only as the
one-member set `{"cut"}` = "none of these" (what "Select none" writes); an empty pool falls back
to it. Unticking the last row writes that set, **not** `null` (which means all).

- Staggered family = one idea, seven delay fields (cell parity, bar index, slat distance, angle,
  hash, ring radius). `slide` translates both frames instead. **`hash21` has no time term** — a
  per-frame re-randomise boils.
- CPU mirror: mask-based ones (wipe, iris, checker, bars, shutter, clock) paint a white mask,
  `destination-in`, old frame underneath; `slide` = two offset `drawImage`s; `dissolve`/`ripple`
  fall through to a crossfade.
- `transUse`: `null` = all pickable (shipped, and what older blobs decode to); stored **by stable
  id**, not index. Global blob field, skipped while `sharing`.
- `glRender` sends the zoom output to `glFbo.post[0]` (not `glFbo.scene`) while a transition is
  live, so the blend precedes the glow. `render()` mirrors all seven visible modes.
- **The outgoing frame is frozen** (`transBegin` copies `glTex.scene` → `glTex.prev`).
- Auto-pick = `fits(a, b) → weight` over `sceneInfo()` (`{dense, retains, palette}`), no pixel
  readback. Both dense ⇒ crossfade; density differs ⇒ pixelate/blur/wipe; palettes far apart ⇒
  dip/flash.
- **Transition** slider = [min,max] seconds, drawn per switch like `ttlMs`/`morphMs`. Both thumbs
  0 = cut. `trans.t` advances in **rendered** time.

### Filters (post-FX)
`FILTERS` — second registry, **three stages**, and the registry must list them in that order
(`filterprobe` asserts it):

**feedback** (`Fire`, `Fade pixel`, `Diffuse`, `Echo`, `Zoom feedback`, `Swirl`, `Cellular
automaton`) — mutate
retained heat, run inside `glBeginHeat` before the effect is MAX-injected. With no feedback
filter `glBeginHeat` **clears** and the CPU path zeroes `fire`.
- Echo/Zoom feedback/Swirl are **one program**, `FS_HWARP`, via
  `glWarpFeedback(src, dist, ang, scale, spin, keep)`.
- That pass samples through **`glSampLin`** (WebGL2 sampler object) — heat textures are
  `NEAREST`. A sampler binds to the **texture unit**: unbind immediately after.
- **Each of the four carries its own `Lifetime`** (displacement conserves heat ⇒ saturates to
  white). The label is the only place that says "Lifetime"; keys (`fade`, `diffkeep`,
  `echokeep`, `zfbkeep`, `swirlkeep`), globals and `uKeep` keep their names — **keys are the
  wire format**.
- All four need **CPU mirrors** (`heatWarpCPU`/`heatDiffuseCPU`, sharing `bilinearHeat` +
  `warpBuf`); `cpuOk: false` here would leave the fallback with nothing carrying heat over.

**post** (Twist, Wedge fold, Slice glitch, Pixelate, Blur/sharpen, Edge, Posterize, Halftone,
Solarize, Chromatic aberration, Mirror, Shockwave, Pixel sort, Lens bubble, Droste zoom,
Oil paint, Bloom) — read the palette-mapped image. `glPostChain()`
ping-pongs `glTex.post[0]/[1]` and **returns `glTex.native` untouched when empty** (no
pass-through copy). Bloom has no pass — it is the glow composite under `bloomAmt`/`uBloom`.

**screen — EMPTY.** Barrel, Scanlines, Vignette, Film grain and Bloom are per-layer `post`
passes; `glBloomPass` makes the glow a chain entry, the other four use `postPass` (fw×fh), not
`screenPass`.
- `glRender`'s final step is `FS_COMP` with **`uBloom` pinned to 0**.
- `glBloomPass` borrows `glFbo.blur1/blur2` and must restore the caller's target — hence
  `bindFbo`/`bindDefault` track `curFbo/curW/curH`, which are **`var`, not `let`** (`bindFbo` is
  hoisted and called before the declaration line runs).
- `uSize` is the render buffer ⇒ Scanline count = lines across `fh`; two scanline layers can
  moiré; Vignette after Bloom darkens the glow.
- **`SCENE_FILTER_IDS`/`SCENE_FILTER_KEYS` are empty seams** — kept because they are the
  **wire-format** seam. `sceneFx` still rides in every blob and **`migrateSceneFx`** folds an old
  scene's whole-scene filters onto its layers (ids appended last; values overwrite). Runs beside
  `migrateCam` in both load paths, deletes the field, idempotent.
- **No "Scene filters" box; `FILTER_LISTS` has ONE entry.** Putting a filter back on the whole
  scene needs a host + a `FILTER_LISTS` entry as well as an id — a filter routed to a missing
  host silently vanishes.

**Slice glitch and Film grain read `postTime`**, accumulated from the frame loop's `dt` — not
`performance.now()` (breaks the stubbed-rAF gate), not `simT` (doesn't advance for shaders).

**Ping-pong parity**: `glBeginHeat` runs each ticked `glFeedback(srcTex)` in registry order, one
pass each, with **`pendingDst` = wherever the last pass landed** (not a fixed `1 - curHeat`);
`pendingDst = src` after the loop. `tools/heatprobe.js` locks this down.

**Feedback filters apply to shader effects too**: `frame()` advances retained heat first
(`heatFeedbackTick()` × `ticks`) and `glShaderDraw` **MAX-blends** over it. `hasFeedback()` is
the single predicate. On CPU, `frame()` hands the mirror the *other* buffer (`fire`/`fireKeep`
pointer swap) and MAX-merges — depends on **every CPU mirror writing every cell**; no early-outs.
`beginHeatTick()` does **not** flip `curHeat`; `heatFeedbackTick()` does. `applyFilters()` wipes
`fire` on `!hasFeedback()`, **not** `!filterOn("fire")`.

**CPU masking**: post filters carry `cpuOk: false` on the fallback. Mask **at the point of use**
(`cpuBlocked` → `filterOn()` → `activeFilters()`/`hasFeedback()`) and **never remove them from
`activeIds`**. `cpuBlocked` is filled by the FILTERS block but declared with the render globals.

**BYPASS (`.filter-by`, the dot beside each filter row)** mutes a filter *in place* — ✕ removes
it and loses its chain position and settings, which is useless for working out what a filter
contributes. **Transient and deliberately outside the wire format**: a scene records its chain,
never what you had muted while looking at it.
- Held on the **layer object** (`L.fxOff`, a Set) rather than a slot-keyed map, so it follows
  its layer through a reorder for free; `stackItemOut` names its fields explicitly, so it is
  never serialised, and `installStack` drops it on every scene load.
- **`filterOn(id)` is the one place it is applied** for the drawing layer — which is what makes
  `hasFeedback()` (and so whether the heat buffer clears) and every CPU mirror agree without
  further edits. `renderFxOff` is set per layer in `frame()` beside `renderFilters`.
- The two per-layer chain builders read **`liveChainIds(L)`**, which strips the bypass **before
  `splitChain`** — otherwise muting a feedback filter would leave the heat/image boundary where
  it was and silently move image filters into the heat phase.
- The dot is inside a `<summary>`, so its handler must `preventDefault()` as well as
  `stopPropagation()`, or every A/B toggles the `<details>` open.

**Foldable control groups** — `FOLDABLE_GROUPS` (just `camera`) and the transient `foldedGroups`,
which starts as a copy of it, so Camera opens collapsed. `refreshBlockVisibility` hides a folded
group's ROWS but **the heading is shown against `shown`, never the fold** — gate it on the fold
and it hides itself along with the only way back. The heading click is delegated on `#panel`
(headings are rebuilt by the visibility pass, so per-heading listeners drift). Applies to every
block at once: Camera is scene-global, so per-block folds would be three chevrons for one set of
sliders.

**The list shows only the filters you have ADDED, in run order.** `+ Add filter` → `#fltdlg` is
the only place the full catalogue appears; rows carry `⠿` and `✕`. `buildFilterUI` builds one
`<details>` per filter (body adopted out of `#filterctl`); `renderFilterLists()` re-appends the
added ones in chain order.
- **Every section stays in the DOM forever**, hidden not removed (`el()` is `getElementById`,
  which cannot find a detached node).
- **Order is expressed by re-appending** — DOM order *is* the order.
- **`#flt-<id>` survives as a hidden checkbox** (the on/off value store).
- `setFilterOn(id, on)` is the single toggle path.
- `buildFilterUI` must run **before** the `POPPABLE` pass. `#filterctl` survives as an empty
  hidden node.
- `makeFilterGrab`: transform the dragged section, show a `.filter-drop` marker, reorder once on
  release. Never move the node mid-drag (Chromium drops pointer capture on reparent).

Filter `params` are ordinary CONTROLS keys (host `"filter"`, one contiguous `group` per filter).
`refreshControlVisibility()` shows a control when the effect declares it **or** a ticked filter
owns it. `presetState` merges `FILTER_DEFAULTS` into every effect's state (an effect naming the
same key wins).

**Every effect defaults to NO filters** (`presetFilters` → `[]`). `DEFAULT_SCENE` carries an
explicit `sceneFx:{on:["bloom"]}`. Per-effect list = `extras[e].filters` (stable string ids);
**`mergeExtra` is mandatory**. `setEffect` runs its visibility pass before `loadExtra` knows the
new list, so `loadExtra` re-runs `refreshControlVisibility()`.

**The stored list is the USER'S ORDER.** Every chain walks it via **`orderFilters(ids)`** — never
`FILTERS.filter(...)`. `filtersOk` returns a Set built in array order (Sets iterate by insertion).
- **The chain is a SEQUENCE, split not sorted — `splitChain(ids)`.** Everything at or above the
  **last feedback filter** runs in the heat phase; everything below runs on the palette-mapped
  picture. A `post` filter runs in **either** (above ⇒ warps heat, `R8`, shader writes `.r`;
  below ⇒ repaints). `runHeatPass(f, tex)` dispatches (`glFeedback` if present, else `gl`).
- **Never re-introduce a stage sort** — it made Swirl+Mirror unswappable.
- **The divider marks where the EFFECT draws**, not a barrier: `stageDivider()` emitted once
  after `splitChain(...).heat.length` rows; `flashStageMove` explains a cross-boundary drag. No
  feedback filter ⇒ everything in the image phase, no divider.
- **Both render paths**: single-layer runs `activeFilters()` off `activeIds`; a stack runs
  `renderStackColor` → `layerFeedbackChain`/`glLayerPostChain` off **`L.filters`** (kept current
  for the selected layer by `applyFilters()` → `persist()` → `stackOut()`). `DEFAULT_SCENE` is a
  four-layer stack, so the stacked path is what users hit first.
- **Four sites must respect the order**: `glBeginHeat` + `glPostChain`, `layerFeedbackChain` +
  `glLayerPostChain`, and — easiest to miss — **`mergeExtra`**. `activeFilterIds()` is the write
  side (`saveExtra`, `captureLayerExtras`).
- **`orderFilters` is a function declaration; `FILTER_STAGE_RANK` is a const it closes over** —
  `buildFilterUI()` must run **after** that block, or the TDZ throws and every filter shows.

**Effect `defaults` are NEUTRAL**: `palcycle [0,0]`, banding off, no rotation, every dual slider
`[lo,lo]`.

TDZ: the registry block sits **above `presetState`**; `buildFilterUI()` **after** the registry;
`activeIds` + `filterOn` with the render globals (`bindRange` runs `apply()` during wiring).

### Effects & per-effect state
**`EFFECTS` is the single source of truth** — `{id, name, presetName?, subtitle, help, params,
helpTags, draw?/fractal2d, bakesOwnZoom?, cardioid?, onEnter?, defaults, beat, extras}`. Adding
an effect = append one descriptor (`assertRegistry()` warns on dup id / unknown param).
- **Controls** generate from `CONTROLS` (type, label, range, `fmt`, `apply`, `durScale`, host).
  `buildControls()` → `#fxctl`/`#bandctl`; `setEffect` shows only the descriptor's ordered
  `params`. No hand-written control HTML.
- **Defaults** seed `states[e]`/`beatStates[e]`/`extras[e]` via
  `presetState`/`presetBeat`/`presetExtra`. Include render-affecting keys the effect doesn't
  display (e.g. `band` at 0) so switching resets them.
- **Render**: `frame()` runs `draw(dt)` or the fire accumulator; `simulate()` stamps 2D when
  `fractal2d`; `setEffect` runs `onEnter`; `renderHelp` filters by `helpTags`.
- **Identity: the stable string `id`, never the index.** `serializeBlob`/`deserializeBlob`
  convert at the storage edge; `LEGACY_EFFECT_IDS` migrates pre-id blobs; `effect` stays the
  runtime index. **`EFFECT_MAPS` + `keysToIds`/`keysToIdx` cover the per-effect maps**
  (`states`, `beats`, `pulses`, `plens`, `extras`). Numeric key ⇒ pre-id blob; unknown id ⇒
  dropped, never misfiled. `presetprobe` deserializes under a shuffled registry.

**Break-out boxes.** Every `dual`/`plain` slider appears in the menu as a name + `+`/`−` launcher
(`.ctl-row`); the `#ctl-<key>` node lives in `#breakout`, a `position:fixed` column filling
top→down in click order. A thumb is only ever visible in the column.
- **A box belongs to a LAYER**: `popped` keyed `"<slot>/<key>"` (scene = `"s/<key>"`).
  `refreshBreakout()` shows one iff its slot/key is popped **and** that layer still uses the
  control. `ctlOwner(slot, key)` prefixes `L2 ·`; `syncPopOwners()` re-stamps after a reorder.
  Transient.
- **A SCENE filter param is ONE box and N rows** (`bloom`, `burn`, `barrel`, `scan`,
  `scancount`, `vignette`, `grain`). It carries an `id`, not `data-k`, so `ctlIn` — a map
  lookup — never finds it: the per-block POPPABLE loop and `buildFilterUIFor`'s adoption both
  skipped it, and the slider was stranded in the `#filterctl` that `buildFilterUIFor` then
  hides (Bloom's `<details>` opened empty; Fire showed `Rise` and not `Burn rate`). A second
  pass over `FILTERS`' params — **params order, not `POPPABLE` order** — dresses one box into
  `#breakout` with **no `data-slot`** and appends a launcher row to *every* block's copy of
  that section. **`popSlot(slot, key)` folds those keys to `-1`** inside `syncPopBtns`, so the
  block-sweeps don't ask about `"2/bloom"`. `ttl`/`tdur` are scene controls too but have one
  home in the Scene box and render there in full — they get no launcher.
- **NOTHING calls `dockAll()`** — kept, no callers.
- `#breakout` is **outside** `#panel`, so: control CSS scoped `#panel …, #breakout …`; `onEdit`
  attached to `#breakout` too; its **own capture-phase `pointerdown` + `focusin`** selecting
  `box.dataset.slot`'s layer.
- Box order top→bottom: `.ctl-owner`, label+value, slider, `.rng-edit`, `.ctl-div`, **Triggers**
  (`.trig-t`) over the chips, **Trigger shape** over the `PULSE_SHAPES` picker, **Trigger
  duration** (`.plen-name`) over `.plen`. `makeChips` **appends** (append order = display order).
  The range editor is built later (POPPABLE pass) and must **`insertBefore` `.trig-t`**, not
  append. It carries no `border-top`. The last five exist only in a box.
- `.ctl-owner` = `ctlOwner(key)` → `CTL_GROUPS[control.group]`, `"Filter · "` prefix for `f_*`.
  Added in `POPPABLE.forEach`, not `ctlHTML`.

**Range editor** (`makeRangeEditor`): `min`/`max`/`step` + ↺ (restore `RNG_ORIG`). `rngApply`
writes the attribute onto the real slider(s), re-clamps, dispatches `input` **on the slider** (the
number fields are skipped in `onEdit`). `applyRanges` calls `rngSyncAll()`.

**Blocked controls**: `CTL_BLOCKED` maps blocked key → blocker (`bandsize`/`banddim` → `band`,
`nodspd` → `nod`). A control is off when its dual's **high thumb is 0** (`ctlHi`) — read the
thumb, not the animated value. `refreshBlocked` runs from `refreshControlVisibility` **and
`onEdit`**.

**Orbit editor** (`#carddlg`, `#cardbtn`), gated on `cardioid: true`. Floating, non-modal,
bottom-right, `z-index: 5` — **never add a backdrop or click-outside-closes**. Hides on `m`/`Esc`.
- Samples **`juliaSeedAt(outer, inner)`** so opening never advances the animation; `frame()`
  redraws while open.
- Backdrop **`cardLocus(w, h, d)`**: Mandelbrot at power 2, degree-d Multibrot otherwise.
  Quantised to `CARD_POW_Q`, half-res offscreen, integer-2 fast path.
- `card` is a **`var`**; `cardOpen`/`cardDraw` early-return on falsy `card`.

**Seed path**: `seedPathMode` (`"cardioid"`|`"circle"`|`"freehand"`), per-path `seedRideOn`,
freehand `seedPts` → arc-length LUT `seedSpline`. **`basePathAt(th)`** is the fork; freehand is a
closed periodic Catmull-Rom traversed by arc length. `juliaSeedAt` adds the riding circle only
when `seedRideOn`. **`juliaEase` is a flat 1 off the cardioid.** Default (cardioid + ride on)
reproduces the original math byte-for-byte.
- **Per-LAYER scene data** (`L.seedPath`/`seedRide`/`seedPts`), `extras[e]` as per-effect
  fallback. Shares at 4dp, capped by `seedPtsOk`; rides via `stackItemOut`/`mergeLayers`.
- **`installSeedPath(L)`** from `installStackItem`; epilogue restores the selected layer's.
  **`captureSeed(L)`** swaps in a **NEW** `seedPts` array (never mutate in place) so the
  `seedSplineFor` WeakMap invalidates.
- `stageLayerExtras`/`applyLayerExtras` install the seed, **not `loadExtra`**.
- `syncOrbitUI()` reflects live state. `seedDrawing` is transient.

**Camera on CPU**: mirrors call `camPix(x, y)` per pixel (writing scratch `camPX`/`camPY`, no
allocation). Per-row hoists must stay **inside** the x loop — rotation mixes x into y. **Copper
Bars** keeps its row-constant fast path but gates it on `camOn()`.

### UI: two menus
☰ opens the **menubar** (`src/ui-menubar.js`, `#menubar`) — everything that is *not* scene data:
Controls panel / Fullscreen / Hide all UI, **Audio**, **Resolution**, Cloud profile, Public
scenes, Credits, help. **`#panel` is only the scene editor.** ☰ does **not** toggle the panel;
`m` does.

**Audio and Resolution are ROOT items** (no "System" parent). Each needs **its own adopt host**
(`#audiobox`, `#resbox`) — one host per leaf.

**The menubar ADOPTS nodes, it does not rebuild them.** `#audiobox`, `#resbox`, `#cloudbox`,
`#creditbox` are authored hidden in the panel markup; `{adopt: "id"}` *moves their children* in.
`ui-menubar.js` is **last in the manifest**.

**`returnAdopted()` is load-bearing and its absence is destructive** — panels are destroyed on
close, so an adopted block must go home first or the real audio buttons, resolution select,
`#cloudrow` and credits list are **deleted from the document**. `box.dataset.adopt` names home.

**Every dialog's title + close button are STICKY.** First two children = the `.pal-close`-family
button and an `<h2>`.
- Button is `position: sticky` + `float: right`, **not `absolute`**.
- **The box gives up its `padding-top`; the header carries it.**
- Header background bleeds over side padding via `box-shadow: 0 -30px 0 30px` (padding differs
  per dialog, 18–26px) plus a `backdrop-filter`.
- **A probe that opens a dialog by un-hiding it proves nothing** — content is built on open, so
  the sticky assertion passes vacuously. Click the real opener (`#transpick-open`,
  `#pal-detail-btn`).

**Shared widget CSS is keyed on the CLASS, never scoped to a container** (this has bitten three
times). `.pal-close, .card-close, .help-close, .sync-close` and `.audbtn` are single unscoped
rules; a dialog need only be `position: relative` (or deliberately `static`, as
`#carddlg .card-box` is). The control-appearance CSS is the exception — it names `#panel …,
#breakout …, #menubar …` because those are three real hosts for the same nodes.

`#menubar` is a full-screen overlay that **catches** pointer events while open (it is the
click-outside closer). Every CSS rule an adopted block needs must name `#menubar` alongside
`#panel` — **including the font**, which lives on `#panel`, not `body`.

**Panel layout**: header + **four `.box` `<details>`** (fold transient) — *Scene*, *Scene
filters*, *Beat tuning*, hidden *Layer effect & filters* — plus **`#lyrsec`, a plain titled
SECTION** for Layers (not a box). The hidden box holds `#effect`, `#fxctl`, the Orbit editor,
Reset, per-layer filters, palette. `buildControls` routes by `host`: `"band"` → `#bandctl`,
`"pal"` → `#palctl`, else `#fxctl`.

**`#scenenow`** names the selected scene; filled by `syncSceneTitle()` from
**`buildPresetList()`** — the single choke point every selection path goes through.

### One control block PER LAYER
A `.lyrblock` cloned from `<template id="lyrblock">`, `STACK_MAX` of them, built at startup and
living permanently in their row. Any number open at once. No `#lyrctl`, no `parkLayerCtl`.

- **Nothing inside a block carries an `id`.** They carry the same string on **`data-k`**, resolved
  via **`ctl(k)`** (selected), **`ctlIn(slot, k)`** (one), **`ctlEach(k)`** (all). The STRING
  never changes — `speed-lo` is a wire key (`ranges` is named by it). `ctlReg` registers a node
  *and* stamps `data-k`.
- **Node REFERENCES, not subtree queries**: `keyMap[slot]` is a hash, because POPPABLE moves every
  `.ctl` into `#breakout`.
- **A SCENE control keeps its `id`, generated in slot 0 only** — the seven `SHARED_FILTER_KEYS`
  plus `ttl`/`tdur`. `ctl()` falls through to `getElementById`. `isSceneCtl` sits above
  `ctlHTML`. **`#effect` and `#palette` are hoisted OUT of the block** (single value stores).
- **One set of maps pointed at one block**: `wireRange(slot, …)` builds nodes, `ui()`, clamps and
  the beat block; `registerAnim` creates `anims`/`animPhase` and runs the single startup
  `apply()` from slot 0; **`pointMaps(slot)`** re-points on selection. It must **never** re-create
  `animPhase` and **never** call `apply()`. `makeChips` handlers guard on being the **live**
  block, not `slot === stackSel`.
- **`paintBlock(slot, L)`** fills a NON-selected block from its frozen record: skip the selected
  block, apply that layer's **bounds BEFORE its values**, and **never dispatch `input`**.
  **`repaintAllBlocks()` must run wherever a slot changes which layer it holds** — reorder, add,
  remove, `installStack`. It lives inside `installStack`, not `applyPreset`.
- **Visibility passes are per block**: `shownKeysFor(slot)`, `refreshBlockVisibility`,
  `markFirstGroup`, `refreshBlocked`, `ctlHiIn` all take a slot.
- **`RNG_ORIG` is built from `CONTROLS`, not a DOM scan** (layer controls have no id; a scan also
  swallows the gain sliders).
- **`selectStack`'s order is load-bearing**: `freezeItem` → `stackSel = j` → `pointMaps(j)` → rest.
- Selection = capture-phase **`pointerdown` AND `focusin`** on the row. Pointer alone leaves a
  keyboard hole (arrow-key edits land on a node not in `anims`).
- Fold via **chevron** (`openSlots`, `.lyr.folded > .lyrblock { display: none }`) — it only HIDES.
  **Every layer starts folded**, `openSlots` starts empty, and **selecting does not unfold**.
  Unfolding does select. `dropOpen`/`moveOpen` remap on remove and drag.
- **NOTHING may override the row's `padding-bottom`.** An open row is squared off by the block's
  `margin-bottom: -6px`; a folded row has no block, so the 6px padding is its whole floor. Any
  per-state padding must name `:not(.folded)`.
- **The chevron is on EVERY row, upper-left**, and both opens and closes.
- **Explicitly PLACED grid child** (`grid-column: 1; grid-row: 1`) — without placement it takes
  the next auto cell and collapses the row. The drag handle drops to `grid-row: 2 / 4`.
- Styled **`#panel .lyr b.lyr-chev`** (type selector: `#panel .lyr b` outranks a plain class).
- **Every chevron in the app is 2x** (~20–22px). `::before` ones pin `line-height: 0`; the layer
  one uses `line-height: 1` (a flex item with a zero line box collapses).
- **`#effect` is hidden here, not deleted** — it stays the effect value store.
- First *visible* group heading's top border via **`.grp-first`, set by `markFirstGroup()`** —
  **not `:first-child`**.

**Palette cycle**: `palcycle` dual (host `pal`) = [min,max] seconds per morph; `morphMs()` draws
each duration like `ttlMs()`. Both thumbs 0 pins it. `morphing` is **derived** (`palCycleOn()`),
not stored; `syncMorphFromSlider()` starts/pins on edit. `extras.morph` still written for compat.

**Reverse colours** (`#palrev`) — **per layer**: live `paletteReverse` for the selected layer,
`L.paletteRev` otherwise (`layerPalRev(L)`), `extras[e].paletteRev` as single-layer fallback.
Flips indices **1..255** of the baked LUT, leaving 0 as background. Both bake choke points:
`composePalette` and `bakeLayerBytes(…, rev)`.

**Background** (`#palbg`) — **per layer**: `paletteBg` ∈ `"palette"` (**default**) | `"black"` |
`"white"`. Default in both deciding places: the initial global and **`bgOk`'s fallback**.

**Palette editor** (`#paledlg`, `src/palette-editor.js`): `+` on a built-in copies, `✎` edits a
custom; shipped ramps stay pristine. Floating, non-modal, hides on `m`/`Esc`.
- **Edits LIVE, not as a draft** (palettes are referenced by index and re-derived every frame).
  **A fresh copy closed without an edit is removed again**; `Save & close` overrides.
- **Customs live in the SAME `PALETTES` array**, after the built-ins; `PAL_BUILTIN` captured
  immediately after the literal. `grad()` hangs `stops` on the returned fn; `palStopsOf` samples
  for the three procedural ramps.
- **`applyBlob` must install customs BEFORE validating any palette value.** `customPalettesOk`
  drops malformed entries and **sorts stop lists**.
- **Deleting a custom shifts later indices down** ⇒ `palRemapDeleted` rewrites the live stack,
  per-effect `extras` and every preset. Existing share links are not rewritten.

**`palUse`** (`#palpickdlg`, the `+` tile ending the strip): gates the STRIP and the CYCLE only
(`pickOther` picks from it). A scene storing an unticked palette still loads and renders, and the
strip always shows the current ramp. `null` = all (shipped, what older blobs decode to);
`setPalUse` collapses full/empty back to `null`. Global blob field, skipped while `sharing`.
**Indices ⇒ `palRemapDeleted` must remap it.**

**Palette names may change; the ORDER may not** — everything references palettes by index.

**Palette picker**: `#palette <select>` is the hidden value store; `#palswatches` is visible (one
gradient per in-use entry via `palGradientCss(i)`). A swatch sets `paletteSel.value` and
dispatches a bubbling `change` — no extra state. `syncPalSwatches()` mirrors the highlight on
programmatic changes. Keep the select in the DOM.

**`setEffect(i, save)`** shows `params`, runs `onEnter`, swaps five per-effect maps: `states[e]`,
`beatStates[e]`, `pulseStates[e]` (default `"snap"`), `plenStates[e]` (default `PULSE_DROP`),
`extras[e]`. Calls `save*` for the outgoing effect, `load*` for the incoming.

**`setEffect` does not clear the heat buffer** (clearing blinked black on every switch). `acc = 0`
still resets.

**Beat chips ship unarmed**; per-band colours (L blue, M green, H red) apply only to `.on`.

**Beat dots** (`.ctl-dot`, `dotEls`): ≤3 per row, **12px**, chip colours, `display:none` unless
armed, `opacity .5` idle, lit by `flashChips()` (the idle figure is repeated in `flashChips`'s
ramp — keep the two in step). `syncDots()` is called **from** `syncChips()`; dots
are built only for keys present in `chipEls`.

**Beat pulse**: `updateAnims` snaps an armed slider to the high thumb and decays `a.pulse`
linearly 1→0 over `pulseLen[id]` seconds (`.plen`, `PLEN_MIN`–`PLEN_MAX`, default `PULSE_DROP` =
0.2s). `pulseShape[id]` reshapes it: `a.apply(mn + shape(a.pulse)*(mx-mn))`. Every `PULSE_SHAPES`
fn maps `[0,1]→[0,1]` with `f(0)=0`, `f(1)=1`; `snap` is identity. `pulseEls`/`syncPulse` mirror
`chipEls`/`syncChips`; `plenEls`/`syncPlen`/`prunePlens`/`mergePlen` mirror the shape set.

### The effect stack (layers)
Ordered list of ≤4 effects composited into one heat buffer. `stack`, `stackSel`, `STACK_MAX` = 4.

**Never call it `layers` in code** — `layers` is already a CONTROLS key (`layerCount`/`LAYER_MAX`,
copies of the *fractal*) persisted in every `states[e]`. "Layer" is user-facing only. Use
`stackSel`, not `slot` (a local in both ping-pong loops).

**`effect` = the SELECTED item's effect**, assigned only in `setEffect`. Only the render path
reads `stack`. **`EFFECTS[effect]` must never reappear in a render path.**

**Pressing anywhere in a row selects that layer** — capture-phase `pointerdown` (children
`stopPropagation()` on `click`), plus capture-phase `focusin`. The `click` listener stays for
synthetic clicks; `selectStack` early-returns when already selected.

**Rows are a FIXED POOL of `STACK_MAX`, keyed by SLOT, built once, never destroyed.**
`syncStackUI` only paints; spares hidden. **Every handler reads `stack[slot]` live.**

**The grab handle is excluded from row selection**; it selects on pointer**up**.

**Every row has its own effect `<select>`** (`select.lyr-name`). A change on a non-selected row
calls `selectStack(j)` **first**; `fx` is read off the `<select>` **before** either call.

**The DOM is the store for the selected item; every other item holds plain numbers.** `loadState`
writes the DOM and dispatches synthetic `input`. `bandOf`/`beatOf`/`shapeOf`/`plenOf`
short-circuit to singletons for a one-item stack. `freezeItem`/`thawItem` move between
representations and **null the record on thaw**. Reading a frozen record without freezing first
loses the last edit.

**Palette + filter stack are per-layer** (`L.palette`, `L.filters` — not `extras[e]`). Live
`paletteSel.value` + `activeIds` are the selected layer's. `applyLayerExtras(L)` puts a layer's
palette+filters live; `captureLayerExtras` reads them back.
- **Switching layers must run `stageLayerExtras(L)` BEFORE `setEffect`** (which ends in
  `persist()` and freezes the selected item).
- Changing a layer's effect KEEPS its palette/filters.

**Animation is split scene vs layer.** `bindRange` tags `anims` entries `scene` via `isSceneCtl`
— palette, banding, camera, display zoom. Most filter params are LAYER keys; only
`SHARED_FILTER_KEYS` are scene-wide: `burn`, `bloom`, and the screen filters (`barrel`, `scan`,
`scancount`, `vignette`, `grain`). Scene keys apply immediately; layer keys are computed, then
`installStackItem(L)` pushes them before that item draws. **Feedback params are read during
propagation, before `installStackItem` in the single-layer path** — that branch calls
`installStackItem(live[0])` up front.

`updateAnims` is **key-major, not item-major** (each drift segment draws twice from
`Math.random`).

**Epilogue `installStackItem(stack[stackSel])`** after the loop — `glRender`, `render()` and
`cardDraw` read these globals outside any item's turn.

Beats need no per-item work (`beatReact`/`pulseShape`/`pulseLen` are singletons; the stack loop
lives *inside* `updateAnims`). **`clearBeats()` must stay after the whole loop.**

**Phase clocks are per item via `PHASE_VARS`** — 16 accumulators (`simT`, `spinAngle`, `nodPhase`,
`juliaOuter/Inner`, `plasmaTime`, …), installed before an item draws, captured after. **Add a line
when you add an effect that accumulates a clock** — otherwise two items share one clock and render
as a single brighter copy; no error, no probe. `installStack` seeds each item's phase from the
**current** clocks.

**Compositing (heat-space)**: each item renders into `glTex.layer`, merges via
`glMergeLayer(blend, gain)` (`FS_MERGE`). `glShaderDraw` overwrites the scratch with blending off.
**Gain must be a multiply inside the shader, not a blend factor** (`blendEquation(MAX)` ignores
`blendFunc`). `glMergeLayer` restores BLEND **and** `blendEquation` **and** `blendFunc`.

**Per-layer palettes — two paths, gated on live-layer count.** `live.length <= 1` ⇒ the old
heat-space merge, byte-for-byte. Two or more ⇒ **`renderStackColor`**, each layer coloured with
its own palette and blended in **OKLab**.
- Each layer owns `glTex.heatL[slot]` and runs its own feedback via **`glLayerBeginHeat`** (a copy
  of `glBeginHeat`'s ping-pong — **not** `glBeginHeat` itself, which stays untouched for the
  `heatprobe` slice). `renderLayerHeat` calls `installStackItem(L)` first.
- `stepLayerPal(slot)` is a per-slot morph clock drawing durations from the shared sliders.
  `bakeLayerBytes` bakes ramp + live banding into `glTex.palL[slot]`. `layerPalIndex` reads the
  **live dropdown** for the selected layer (`L.palette` is null while selected), `L.palette`
  otherwise.
- `glColorizeLayer` (FS_PAL) → `glLayerPostChain(L)` → `glOkMerge` into `glTex.color[0/1]`. Blend
  = `L.blend` → `BLEND_MODES[].u` → `FS_OKMERGE` branch: `0` add (brightness-weighted), `1` max,
  `2` diff, `3` colour, `4` luminosity. **`BLEND_MODES` is the single source of truth** (row
  button, uniform, `blendOk`). An **`accW < ε` guard** returns the plain layer before the branch.
  `L.gain` scales the weight ONCE here. `FS_OKMERGE` takes a finished RGB layer (`uLayer`).
  `glRender` starts from `glColorTex`, skipping the shared `FS_PAL` and composite `glPostChain`.
- **Menu grouping**: `buildFilterUI` groups by `filterGroup(f)` — feedback + post-minus-Bloom are
  ONE group ("Per-effect · heat, trails & image"), Bloom + screen are "Whole scene · final image".
  Works only because registry order keeps that run contiguous.
- Canvas2D fallback untouched: one item, one palette.
- `STACK_MAX` is declared up by the canvas/GL setup (TDZ — `initGL` allocates per-layer buffers).

**Point items own the tick loop**: one `beginHeatTick()` per tick, then every point item stamps
and blits (`glPtCount` reset per item), `curHeat = pendingDst` once at tick end; shader items draw
once per frame after. `stampTick(L, now)` is the reusable stamp half. No point items and no
retention ⇒ **`glClearHeatCurrent()`**, *not* `glBeginHeat`'s no-chain branch.

**Canvas2D fallback renders ONE item** (first unmuted) — mirrors assign rather than MAX.

**Zoom applies to CONTENT, never the finished picture.** Shaders divide coordinates by `zoom`
(`bakesOwnZoom`); point effects **`plot()`-scale about the grid centre before stamping**, composed
with the camera 2×2. The fractal rasterises at full grid resolution; out-of-grid points drop.
- `zoomPoints()` multiplies count by `zoom²` at the one choke point in `stampTick`, capped at
  `CONFIG.tuning.zoomPointCap` = **8**.
- **`stackZoom()` is always 1** ⇒ `FS_ZOOM` is an identity blit and the CPU zoom block is dead.
  Both kept deliberately.

**A single-layer scene never touches `mergeLayers`** — `applyBlob` calls it only when
`saved.layers` exists. Its else-branch must **seed `stack[0].filters` from the restored
`extras[e]`**. Two non-fixes:
- **Do not add an `extras[L.fx]` fallback to `applyLayerExtras`** — removing it is what stopped
  same-effect layers mirroring the last one edited.
- **Setting live `activeIds` does not survive** (`stackOut()` returns null for one item).

**Persistence: an optional `layers` array.** One item ⇒ **nothing emitted**. `mergeLayers`
truncates to `STACK_MAX`, drops retired effect ids, clamps gain, defaults blend, and runs every
per-item map through its own `merge*` **against that item's own effect**. Items omitting
`palette`/`filters` fall back to the top-level `extra`. `installShared` re-seeds a single-item
stack. **`blendOk`/`gainOk` are function declarations, not const arrows** (a const TDZ there
aborts startup and surfaces as a confusing later TDZ on `nextSwitch`).

`?stack=plasma,tunnel` — dev hook, never persisted.

### Scene collections
A preset carries an optional **`collection`** (the published profile it came from). It rides
**beside `name`** and is **not** part of `snapshotScene`.

**Must be listed explicitly in `validatePresetList`** — that mapping rebuilds each preset from an
object literal, so anything missing is dropped on every cloud load and gallery install.

**The gallery installs a collection instead of merging**: `applySharedLibrary(raw, replace,
collection)` stages `pendingRestore`, and `applyRestore` has a third branch — drop every preset
carrying that collection, append the incoming ones stamped with it. `out.curPreset` matches the
sender's selection **within that collection**. One button (`Load scenes`).

**`#preset` is the hidden value store**; `#presetlist` is visible, built by `buildPresetList()`
(a `<select>` cannot collapse an `<optgroup>`). Called from `rebuildPresetOptions`, from
`applyPreset`, and from the `change` handler's `-1` branch — miss one and the highlight goes stale.

**`openCollections` is a transient Set starting empty.** Your own group is always emitted, even
empty. `dropCollection` re-finds the selection **by identity** after filtering.

**Your own group is labelled with your profile name, cached for the FIRST paint.**
`myProfileName()` reads `#cloud-name` then falls back to **`PROFILE_NAME_KEY`**
(`burnTheWeb.profile.v1`) *synchronously*. **`setProfileName(v)` is the one way the name is set**
— writes field, cache, and calls `buildPresetList()`. Its own key, **not** part of `cloudSess`.
`myCollectionLabel()` = `myProfileName() || DEFAULT_PROFILE_NAME` (`"burnTheWeb"`).
`sceneTitleFor` uses `myProfileName()` **without** the default.

**`p.rotate`** — per-scene auto-cycle checkbox. `inRotation(p)` is `!(p.rotate === false)` —
**absent means IN**; `setRotation` *deletes* the key rather than writing `true`. `rotationPool()`
is rebuilt per tick; nothing ticked ⇒ the cycler **idles**. `setRotation` calls `persist()` but
**not** `autosavePreset()`.
- Like `collection`, **not** in `snapshotScene`, and **must be listed in `validatePresetList`**.
- The row is a `.pl-row` with the checkbox **beside** the `.pl-scene` button; its click
  `stopPropagation()`s.
- Every `.pl-scene` is a real saved scene. (An `.pl-unsaved` row used to carry `.pl-scene` too,
  making any count of that class off by one; it is gone.)

**`autosavePreset` must carry over every field that rides beside `name`** (it rebuilds from
`snapshotScene()`, which captures none of them). Adding such a field means editing **three**
places: `autosavePreset`, `validatePresetList`, and wherever it is set.

### Presets & persistence
**User-facing word is "scene"; the code word is "preset".** Nothing in the code or wire format
was renamed (`presets`, `curPreset`, `kind: "preset"`, `#preset`, `.presetrow`, every `*Preset*`).
Consequences: **`HELP.sliders[].n` must match the rendered label text** (`ctlHelpBlurb` looks up by
`ctlLabel(key)`), and `safeFileName`'s empty-name fallback is `"Scene"`.

A preset = `snapshotScene()`: `{name, effect, state, beat, pulse, plen, cam, sceneFx, beatTune,
ranges, ttl, tdur, extra, layers}`. Globals deliberately carried, because anything missing renders
as the recipient's value:
- `cam` — in no effect's `defaults`.
- `sceneFx` — lives nowhere in an effect's state.
- `beatTune` — different thresholds = different animation.
- `ranges` — `mergeState` does **no** bounds check and `loadState`'s `el.value =` is DOM-clamped.
- `ttl` + `tdur` — installed via `applyPresetDual`; older presets omit them, leaving the globals.

`applyPreset` applies `ranges` **first**, then `ttl`/`tdur`. `presetprobe` asserts every restored
field is one `snapshotScene` captures *and* one the import mapping carries.

**Does not travel**: resolution (`cfg.scale`), audio on/off, the `randSeed` re-roll, the
`Date.now()` chaos seed, every accumulated phase.

**First-visit library** built once when `presets.length === 0`: `defaultPresets()`, applied at
index 0, then `persist()` once. It is **`DEFAULT_LIBRARY` — THREE scenes**: `Fetingen`
(Sierpiński, single layer), `Round and round` (Moiré, two layers) and `Julia shapes`
(AnimeJulia + Bouncing shapes, two layers, `xor` blend), lifted from the published dyze and
Erbsman profiles with `collection` stripped so a new visitor sees them as their own.
- **Wire format** (effect ids), so a registry reorder cannot remap them, and every map is kept
  **whole** — pruning `beat` against all-false is only sound while no descriptor arms a chip,
  and source bytes are free. Re-export from the app and paste over to change them.
- `defaultPresets()` runs it through `deserializeBlob`, which drops any scene naming a retired
  effect; if that took the lot it falls back to **`perEffectPresets()`** (the old one-per-effect
  builder, now only a backstop) so the library can never be empty and break the
  always-something-selected invariant.
- **`function defaultPresets(` is a `presetprobe` slicing marker** — keep the name and keep it
  directly after `snapshotScene`, or the probe's field extraction swallows the giant literal.

**Creating a preset, adopting a shared scene and restoring a backup all `stopCycling()`.**
`applyRestore` can't (it reloads), so it writes `out.cycle = false` **last**, overriding the
backup file's own `cycle`.

**Switching effect stays on the selected preset and folds the change into it** — three lines:
`setEffect`, `autosavePreset`, `persist`. A preset named after its original effect keeps that
name; that is **intended**. `presetprobe` asserts this structurally (the two previous
behaviours both look reasonable).

**THERE IS NO "unsaved scene" — something is ALWAYS selected**: `presets.length >= 1` and
`0 <= curPreset < presets.length`. **`ensureSelection()`** is the single choke point (re-seeds
the default library if empty, then clamps); `curPreset = -1` survives only as the bootstrap
declaration and `applyBlob`'s empty-library fallback, and `presetprobe` fails if a third site
appears. A stored blob or link carrying `-1` still decodes — it resolves to scene 0.
- **The corollary is the whole risk: selection and live state must AGREE.** `autosavePreset()`
  now writes on every edit, so any path that changes the selection while leaving a different
  picture up will have that picture written over the newly selected scene on the next slider
  move. **Delete** and **`dropCollection`** therefore call `applyPreset` rather than just moving
  the highlight, and a settings-only restore lands on scene 0 *and applies it*.
- Deleting the last scene **re-seeds** the shipped library; an empty library would break the
  invariant.
- **A shared link is kept**, as a scene in a `"Shared with you"` collection (`SHARED_COLLECTION`)
  — collections already guarantee it cannot collide with a scene of yours and can be dropped
  whole. `installShared` only parks `pendingShared`; **`adoptSharedScene()`** does the library
  write. That split is mandatory: the legacy `?s=` path calls `installShared` **synchronously
  mid-slice**, three slices before the preset code exists and before `restore()` has built the
  library — a push there is discarded by the load that follows. `adoptSharedScene` is idempotent
  and is called from the startup epilogue (covering `?s=`) and from the `?z=`/`#c=` handlers.
  Only `#c=` has a real name to use (the `/scenes` doc's `name`); `sceneBlob()` has no name
  field, so the rest fall back to `"Shared scene"` — **`bumpName` only when it is taken**, since
  it always bumps and made the first one "Shared scene 2".

Presets are **local to the browser**; selecting one links edits to it (`onEdit` →
`autosavePreset()`, no manual save). `mergeState()` normalizes against `presetState(e)`;
`mergePulse()` does the same for `pulse`.

**All four of `applyPreset`'s maps must go through `merge*`** — `mergeState`, `mergeBeat`,
`mergePulse`, `mergePlen`. **`classList.toggle("on", undefined)` *flips* the class** (an
explicitly-passed `undefined` counts as "force not supplied"), so `loadBeat` spreads over an
all-false base and `syncChips` coerces with `!!`.

**Beat chips are `<button>`s — no `input`/`change`, so `onEdit` cannot see them.** `chipEdited()`
calls `autosavePreset()` (guarded on `persistReady && !applyingPreset`) then `persist()`.

- **Storage**: `localStorage["burnTheWeb.v1"]` = `{states, beats, pulses, plens, extras, effect,
  ranges, beatTune, presets, curPreset, cycle, ttl, scale, panelOpen, audio}`, built by
  **`fullSnapshot()`** — the definition of "everything we remember". `persist()` and Backup
  serialize exactly that. `applyBlob(saved, sharing)` applies `ranges` + `beatTune` **first**,
  then validates every value against those bounds. Anything not in `fullSnapshot()` is transient.
- **Custom slider ranges** are saved: `RNG_ORIG` captures shipped bounds up top (before
  `restore()`), `collectRanges()` stores only differences, `applyRanges()` sets them back. They
  ride in `localStorage`, the share URL and Backup.

### Share / bundle / backup codecs
**Everything that DECODES must keep working forever.** `?z=`/`?s=`, `#zp=`/`#sp=`, `#c=` all still
open, landing in the **Restore dialog**.

- **`?z=`** — JSON → `CompressionStream("deflate-raw")` → **base64url** (`+`/`/` cost three chars
  each percent-encoded). `?s=` (plain base64) is emitted when `CompressionStream` is missing and
  **decoded forever**; `?z=` is checked first, mutually exclusive. Values rounded to
  `CONTROLS.step` then **clamped to live bounds** (`applyBlob`'s `ok()` hard-rejects). Decoding is
  **async**, landing after startup's `setEffect`, so the promise re-activates with `resize()` +
  `setEffect(...)`. `shareUrl()` is async; Share copies via `ClipboardItem`'s promise form so the
  gesture survives the `await`.
- **Encodes only the CURRENT scene** — `{states, beats, pulses, plens, extras, effect, cam,
  beatTune, ranges}`, one entry per per-effect map. Map *shape* unchanged (`{[effectIndex]: …}`),
  so old all-effects links still decode. `cycle`/`ttl` dropped. `stripShareParam()` runs at
  startup.
- **`pruneBeats()`/`prunePulses()` prune against the descriptor's defaults, not all-false.**
  Share-only; `fullSnapshot()` stays verbose. Works **only because `applyShared` re-seeds first**
  (`initStates()`/`initBeatStates()`/…).
- **Short link**: `shortenUrl(url)` POSTs to `tinyurl.com/api-create.php` (301s byte-for-byte,
  CORS, no key, doesn't block `github.io` — is.gd/v.gd reject all GitHub domains). It signals
  failure with **200 + an error string**, so validate the response shape.
- **Preset bundles**: `libraryUrl(chosen)` = `serializeBlob({presets, cycle, curPreset})` →
  deflate. **Rides in the URL FRAGMENT — `#zp=` (fallback `#sp=`), never a `?query`** (a multi-KB
  query gets **414** from Pages/Fastly before any JS runs), and distinct from `?z=`/`?s=`.
  Recipient: `applyShared()` checks the fragment **first** → **`openSharedLibrary`** →
  `normalizeBackup` → `deserializeBlob` → **`validatePresetList`** → Restore dialog. A **file**
  restore forces auto-cycle off; a **link** honours the sender's toggle (`__link` gates it).
  `applyRestore` stashes the preset index in `sessionStorage["btw.applyPreset"]`; startup reads it
  once.
- **Ordering trap**: `openSharedLibrary` lives in `persist-backup-restore.js` but `applyShared()`
  is called during the earlier `audio-tuning-data.js` load, so `pendingRestore`/`openRestore` are
  in the TDZ. The async `#zp=` `.then` lands after all slices; the sync `#sp=` path must be
  deferred the same way (`Promise.resolve().then(…)`). Same for `#c=`.
- **Backup** = one file per preset + `_settings.json`. `backupFiles()` builds `[{name, text}]`;
  each preset file is `{app, kind: "preset", version, preset}` through `serializeBlob`.
  `curPreset` is **not** in `_settings.json`. Delivery splits on `showDirectoryPicker`: Chromium
  writes `BurnTheWeb/<YYYY-MM-DD_HHMM>/`; everything else downloads **~150ms apart** and
  **flattens** (user agents sanitize path components out of `a.download`).
  - Folder handle lives in IndexedDB (`burnTheWeb.fs`). `backupRoot()` reuses it while permitted.
    **Shift-click Backup forces a re-pick.** A write failure calls `bkClear()`.
  - **`bkStore` must always resolve** — a throw inside an IDB event handler hangs Backup forever
    (`put()` throws `DataCloneError` where handles aren't cloneable).
  - **`safeFileName`** strips path separators, Windows-illegal chars and control codes, trims,
    drops trailing dots/spaces, escapes device names (`CON`, `NUL`, `COM1`…), truncates to 80,
    falls back to `Scene`. `backupFiles` de-duplicates with ` (2)`. Pinned by `presetprobe`.
- **Restore** takes **multiple files**. `normalizeBackup()` folds every shape ever written into
  one and runs **before** `deserializeBlob`. `openRestore(parsed, valid, name)` shows a checkbox
  per part plus merge-vs-replace (**Presets is not always enabled** — `_settings.json` alone is
  legitimate). `applyRestore()` starts from `fullSnapshot()`, overrides ticked parts, writes
  `localStorage`, **reloads**. (`location.reload` is non-configurable in Chromium — tests read
  `localStorage` synchronously and stash the verdict in `sessionStorage`.)

**Backup / Restore / Share buttons are gone from the menu**; the cloud profile is the way in and
out. Only the file/link *creating* half was removed. `libraryUrl`, `shortenUrl`, `backupFiles`,
`safeFileName` and the IndexedDB helpers are **deliberately kept** (pure builders, probe-pinned).
`validatePresetList` and `normalizeBackup` are live — the cloud path uses them.

### Cloud profiles (Firebase Auth + Firestore, over REST)
`src/cloud-profile.js` is the whole client; `firestore.rules` is the whole security boundary.

**No Firebase SDK** — `fetch()` against `identitytoolkit` (exchange a Google ID token),
`securetoken` (refresh), `firestore` (the document). The one remote script is Google Identity
Services for the sign-in button.

**`CONFIG.cloud.apiKey` is a kill switch** (like `CONFIG.analyticsId`): empty ⇒ row hidden, no
script injected, **no request at all**.

**The payload is one deflated string, not Firestore structure.** `cloudBlob()` builds a
`libraryUrl()`-shaped blob through the same `serializeBlob` + `zipToB64` — **same codec, same
decode path**, so a downloaded profile goes straight to `openSharedLibrary(raw)` and every `#zp=`
decoder opens it. Since 1.14.0 the CONTENT differs on purpose: the cloud blob filters borrowed
presets and adds a `collections` field `libraryUrl` never emits (see the bullets below) — a
filtered superset of the shape, NOT the same bytes, and that is fine because the decode side
tolerates both. **What must never diverge is the codec/decode path itself** — anything that would
stop `openSharedLibrary` opening a profile means cloud loading needs its own decoder; `cloudprobe`
asserts the shared path structurally.

**Rules are the only defence** (the web API key is public by design, there is no backend). They
carry the size caps a server's body limit would provide, and `hasOnly()` pins the document shape —
without it the collection is a free 1 MiB-per-doc file host. `firestore.rules` is checked in; its
header lists the nine cases to verify in the Rules Playground.

Tokens: id token ~1h, refreshed **60s early**; a 401 mid-flight refreshes and retries **exactly
once**. Session tokens live under their own `localStorage` key, **not** the scene blob.

**"Share this scene"** stores the scene in Firestore, returns `#c=<docId>` (~12 chars). Signed out
or refused ⇒ falls back to `?z=`; the cloud route is an optimisation, not a gate. Payload is
**`sceneBlob()`, split out of `shareUrl`**; the recipient path is `installShared`.

**Shared scenes live in `/scenes`, NOT `/profiles`.** World-readable, created only by a signed-in
user stamping their own uid as `owner`, **immutable** (`allow update: if false`), deletable by
their owner.

**`cloudApplyPayload(payload)` is the ONE place a stored payload becomes a library** — unzip →
parse → `openSharedLibrary`. `cloudLoad` is its only caller today, and the seam is kept
deliberately: anything else that turns a stored payload into a library must come through it, or
a cloud payload stops being a `#zp=` bundle. `cloudprobe` pins it.

**ONLY THE CURRENT VERSION IS STORED.** A profile is one document; a save replaces it. There is
no version history — it shipped in 1.13.0 and was removed in 1.13.1, because a snapshot was a
copy of the *whole library* rather than a delta, so it scaled badly in both storage and reads
(the prune listing billed one read per retained snapshot, on every save).
- **Deleting a scene locally already removes it from the cloud** — `cloudBlob()` is built from
  `fullSnapshot()` and the write is a full replace, so there is no per-scene state to go stale.
  A deleted scene survives only in `/scenes` share links, which are immutable by design.
- **`cloudBlob()` sends YOUR scenes only — except `"Shared with you"`**, which uploads like your
  own work: an adopted link scene has no source profile to re-fetch from, so filtering it out
  would destroy it on the next cross-machine load. Every other preset carrying a `collection`
  (the "not mine" marker) is dropped — a borrowed collection in your document would be counted
  on your gallery card and re-published to anyone who loads you. What rides instead is
  **`collections`**, the list of `{key, uid}` you hold — the *fact* that you added them, not
  their work. A borrowed collection with **no follow entry** (pre-follow-list library) is noted
  **uid-less** before its scenes are dropped, and `refollowCollections` resolves it by name;
  never clobber an entry that has a uid. `curPreset` is an index into the array being sent, so
  it is **remapped, not copied**, and falls back to 0 when the selected scene is a dropped one.
  `cloudSave` refuses only when there are **no scenes AND no follows** — a follow-list alone is
  a legal, count-0 document (`firestore.rules` allows `count >= 0`).
- **`collectionsHeld` is declared in `audio-tuning-data.js`, filled from `persist-presets.js`**
  (`noteCollection`/`forgetCollection`/`collectionsOk`, function declarations so they hoist).
  `restore()` runs at the foot of that earlier slice, so a `let` down beside the functions is
  in the TDZ on **every reload that carries the field** — the same split as `cpuBlocked`.
  **The follow is noted INSIDE `applySharedLibrary`, after validation passes** (galLoad hands
  the uid through) — noting it in `galLoad` first left a phantom follow whenever every scene
  failed `validatePresetList`, uploaded on every save and unremovable from the UI because
  `dropCollection` needs a group that exists in the scene list. **`delpreset` calls
  `forgetCollection` when the delete empties a collection**, or the next profile load would
  re-fetch the set just deleted scene by scene; its confirm says a partially-kept collection
  refreshes on load (that is the follow model, not a bug — a profile that stores no borrowed
  scenes cannot round-trip holes inside someone else's set).
- **`refollowCollections(raw)` puts them back, INSIDE `cloudApplyPayload`** — before anything
  is applied, so the whole load stays **one `applyRestore` and one reload**. Doing it after the
  reload cannot be that cheap: the install path (`applySharedLibrary` → `applyRestore`) *ends*
  in `location.reload()`, so N collections would be N reloads.
  - **Appended, never prepended** — `curPreset` indexes that array.
  - Each fetched scene is **re-stamped with the key YOU follow it under**, as the gallery
    install does; an older source carrying its own borrowed scenes must not smuggle a third
    party's name through.
  - A collection **already present in the payload is not re-fetched** (older blobs, saved
    before `cloudBlob` filtered, carry them) — re-fetching would duplicate, not refresh.
  - A source that is gone/unpublished/corrupt is **skipped and named**; it resolves
    `{raw, missed}` so the caller can report without `cloudMsg("")` wiping it. Sequential, so
    one slow source is not blamed on the others.
  - **A uid-less entry is resolved by NAME against `galList()`** (the collection key IS the
    source profile's name — `galLoad` keys it so). One listing covers every such entry; a
    healed uid is **written back into `raw.collections`** so the restore stores it and the
    resolution only has to succeed once. Still unresolved ⇒ `missed`, by name — the old
    `c.uid &&` filter made uid-less entries doubly invisible (never fetched, never missed).
  - `galFetchLibrary(uid)` is the shared fetch→unzip→parse, split out of `galLoad`.
- **`applyRestore`'s MERGE matches on `(name, collection)`, not name alone.** A profile load
  now brings your scenes *and* the collections you follow in one array, so name alone would let
  a borrowed "Sunset" overwrite yours — the very collision collections exist to prevent.
  Identical for anything with no collections (every key is `""`).
- **`sharedLibrary` carries `collections` through**, and `applyRestore` writes it **only when
  `__ownCloud` is set** (and `coll` unset — a gallery install is one person's set, and whose
  sets *they* follow is not a statement about whose you do). `__ownCloud` comes from
  **`cloudOwnLoad`, an out-of-band `let` beside `sharedLibrary`** that only `cloudApplyPayload`
  sets and the next `sharedLibrary()` consumes — never from the payload, because a `#zp=` link
  is attacker-authored JSON and "this is your own profile" is the claim that lets `collections`
  replace your follow-list. **Merge mode UNIONS the follow-lists** (local entry wins unless the
  incoming one has a uid the local lacks); Replace replaces.
- `firestore.rules` still carries a **read-and-delete-only** `snapshots` block. It is not dead
  weight: those documents are owner-only and **Firestore does not cascade-delete**, so with no
  rule permitting a delete anything written while the feature existed would be permanently
  unreachable *and* undeletable. The known profiles were swept before the rule was tightened;
  drop the block once you are satisfied nothing is left.
- Two things worth keeping from the exercise, both general: **a subcollection does NOT inherit
  `match /profiles/{uid}`** (it needs its own block, and the catch-all denies it until then),
  and **Firestore does not cascade-delete**, so any subcollection needs an explicit sweep before
  its parent goes.

**`installShared` hands its scene to the library** (see the presets section): it parks
`pendingShared` and `adoptSharedScene()` files it under `"Shared with you"`.

**The gallery applies a row straight away — no Restore dialog.** Rows offer *Load and merge* /
*Load and replace*. **`applySharedLibrary(raw, replace)` does not reimplement the apply** — it
stages `pendingRestore` + checkbox state and calls `applyRestore`. `sharedLibrary(raw)` is the
shared decode+validate half.

**The gallery is browsable signed out** — `galFetchJson` uses a plain keyed `fetch`, not
`cloudFetch`, and Browse sits *outside* `#cloud-authed`. **`cloudPublish` re-saves the whole
profile** rather than patching `pub` (the rules require name/payload/count).

**The listing survives a missing composite index**: `pub == true` + `orderBy updated` needs one; a
fresh project answers 400 `FAILED_PRECONDITION` with a creation URL. `galList` retries
**unordered**, logs the URL once via `console.info`, and **sorts in both cases**. The query
`select`s away `payload`. Cached for `CONFIG.cloud.galleryTtlMs`; `galBust()` clears it.

### Audio & beat reactivity
`audio` holds the WebAudio graph; `startAudio("capture"|"mic")` must run inside a user gesture.
With audio on and a chip armed, `updateAnims()` stops that slider drifting — it rests at the low
thumb and snaps to the high thumb on each beat. `armAudioResume()` re-opens the last source on the
first post-load gesture (browsers cannot silently re-grab audio).

**Mute is `audio.muted`; the split from `audio.on` is the design.** `♪` (and the **S** key — `M` is
the menu) → `toggleMute` → `setMuted`, which **never touches the stream**. `audioTick`
early-returns instead.
- `audio.on` = **a stream is open**. "Is audio reaching the visual?" is **`audioLive() = audio.on
  && !audio.muted`** — four sites: `stepAnim`'s `armed` (the important one), `flashChips`'s `lit`,
  `frame()`'s `updateMeter`/`flashChips`/`clearBeats`, the `audio-off` class. Still reading
  `audio.on`: Capture/Mic lit state, `armAudioResume`, `fullSnapshot`'s last-live-source.
- `setMuted` zeroes `pulse`/`energy`/`beatNow` and calls `updateMeter()` + `flashChips()` **once**
  on the way down. `stopAudio` clears `muted`. `audio.muted` is **transient**.
- Same `♪` glyph in both states; `.muted` adds `line-through` (never changes width or baseline).

**`audioTick` is an ONSET detector, not an energy detector — don't "simplify" it back.** Per band
it computes **spectral flux** (sum of positive bin-to-bin changes since the previous tick):
- **Float, linear magnitudes** — `getFloatFrequencyData` → `10^(dB/20)`. The byte spectrum is
  dB-compressed; a ratio test there is a ratio in log space.
- **`smoothingTimeConstant = 0`.**
- **Adaptive threshold + peak picking**: a beat is a *local maximum* above
  `median(last ~1s) × beatCfg.fluxK[b]` and above `beatCfg.floor × recent peak`, with a per-band
  refractory. Causal — inspects the *previous* tick (one 10ms hop of latency).
- **Bands are narrow on purpose**: 30–150 / 150–2500 / 2500–12000 Hz, mapped by `computeBins`.
- **Thresholds are per-preset scene data.** `beatCfg` (defaults `BEAT_DEFAULTS`, both in the
  detector constants block) holds per-band `fluxK`, global `floor`, per-band `refract`, `bands`.
  **`mergeBeatTune(saved)` has replace semantics** (start from `BEAT_DEFAULTS`, overlay only valid
  fields). **`installBeatTune` writes fields in place, never replacing the object** (`audioTick`
  closes over it; `beatprobe` slices it out). It re-runs `beatBuild()` and `computeBins()` (the
  latter only when `audio.on` — it throws before audio starts).

**`audioTick` runs on `setInterval(HOP_MS)` (100Hz), not rAF.** Beats are **latched** in
`beatNow[]`; `frame()` calls `updateAnims()` then `clearBeats()`. `audioTick(t)` takes an optional
timestamp for fake clocks.

**Beat tuning** lives in `<details class="box" id="beatDetails">` (per-preset scene data, must
autosave):
- CSS scoped to `#beatDetails`.
- `beatChanged` must **not** `persist()` (the delegated `onEdit` already does). `beatReset` is a
  click, so it persists + autosaves by hand.
- **`RNG_ORIG` and `refreshRangeUI` skip `#beatDetails`** — the generated sliders have no `id`, so
  a scan writes `RNG_ORIG[undefined]` and `collectRanges` emits a junk `undefined` key into every
  blob.
- **`beatUi` is a `var`** (like `card`) — `installBeatTune` reads it during startup before the
  declaration.
- `applyPreset` rebuilds the sliders (`beatBuild`), so any reference held across a preset switch
  is a **detached node**.

### Dev tools
No Diagnostics section. The **beat trace** (`?debug=1` or the Beat tuning checkbox; `dbgInit`
builds a floating canvas of flux + threshold + beat ticks per band, lane labels from
`beatCfg.bands`) lives in the Beat tuning box. The frame/FPS counter has no toggle — `H` drives it
via `body.ui-hidden`; `#frames.hidden` survives in the CSS as the mechanism `?hideui`/`H` use.

**The persistence opt-out is `data-nopersist`**, not `#diag`: `onEdit` early-returns on
`closest("[data-nopersist]")`; `RNG_ORIG`/`refreshRangeUI` use the same marker.

### Sync nudge + analytics
`#syncpop` shows to users who haven't started audio at growing gaps of active (tab-visible) time
(`SYNC_DELAYS` = 30s, 5min, 1h), capped at 3 showings ever; state in
`localStorage["burnTheWeb.sync.v1"]`, satisfied for good once any source goes live. `track(name,
params)` is provider-agnostic; the GA4 gtag scaffold is **live** (`GA_MEASUREMENT_ID` is a real
`G-…` id) — clearing it to `""` makes it inert.

### Timing
`frame()` runs every rAF. **The fire sim is decoupled**: a fixed accumulator tick (`cfg.burn`
ticks/sec, capped 4/frame) while render/morph/beat run every frame. Phase clocks accumulate per
tick from the live speed, never the wall clock. Clicking the canvas toggles `paused`.

### Determinism
Chaos game uses a **mulberry32 PRNG re-seeded to `SEED` every frame** — the point *sequence* is
identical each frame; only moving geometry reshapes the fractal. Auto-morph uses `Math.random()`,
kept separate.
- **AnimeJulia**: `juliaOuter/juliaInner` default 0, set by `reseedJulia()` — a random lap when
  the per-effect **Random seed** toggle (`randSeed`, an `extras` field, default on) is on, else 0.
  `setEffect` calls it on every entry.
- **Attractor jitter**: the de Jong map is exact; `atjit` scatters each point by ±jit heat pixels
  from `Math.random()` (clear of the chaos PRNG). The `jit > 0` guard keeps jitter 0
  byte-identical.
- **Don't add a fixed-seed toggle for the jitter** — built, shipped, reverted.

## Config & control gotchas

`cfg = { points, speed, decay, scale, burn }`. Sliders wired via `bindRange(id, valId, fmt, apply,
durScale, beat)`, registered in `anims`; `updateAnims()` drives drift between the thumbs.
`bindRange`'s `ui()` reads `lo.min`/`lo.max` **live** (bounds are runtime-editable) and uses them
for precision: **a range spanning more than 1 shows at most one decimal**. Rounding applies to the
value handed to `fmt` and is **readout only** — the applied value stays a free float.

- **Flame rise** is linear in flame *height*: `decay = 128 * R / (R - 1)`.
- **Drift speed** slider ÷ 100 → `cfg.speed`.
- **Rotation** slider is degrees/second → rad/s (`rotSpeed`), accumulated into `spinAngle` per
  tick (independent of drift speed and burn rate).
- **Tetrafyer has two rotations**: `Rotation` yaws (`spinAngle`); pitch is `nodAmp·sin(nodPhase)`
  behind **Box nod** (degrees) and **Nod speed** (×). **`nodPhase` accumulates per tick**
  (`NOD_RATE · nodSpd · cfg.speed / cfg.burn`), never derived as `0.12·simT` (which teleports the
  nod mid-swing once the rate animates). At `nodSpd` 1 it tracks `0.12·simT` exactly.
- **Palette** bakes into a `Uint32Array` in **little-endian ABGR**. **Banding is a filter over the
  active palette**, not a palette.
- **A preset switch always blends the palette in from what was on screen** (no snap); **where it
  blends to depends on the cycle** — cycling on ⇒ a fresh random palette, pinned ⇒ the palette the
  preset **stored**. `applyPreset` snapshots live `paletteBase` *before* `setEffect`/`loadExtra`
  can overwrite it, then `beginMorph(fromRamp, morphing ? pickOther(...) : +paletteSel.value)`.
  `beginMorph` paints `fromRamp` into `paletteBase` immediately and arms the blend;
  `morphOnce = !morphing` makes it one-shot. A manual pick or plain scene load clears `morphOnce`.
- `cfg.scale` changes need `resize()` to reallocate buffers.
- **Reset** restores the current effect's `state`/`beat`/`pulse`/`plen`/`extra` **and the shipped
  bounds** (`RNG_ORIG` over every key in `presetState(effect)`, **before** `loadState`, then
  `rngSyncAll()`). Current effect only.

## Testing (no framework — headless verification)

- **Syntax check** each `<script>`: `node -e "...new Function(scriptText)..."`.
- **Assertion probe**: inject a `<script>` into a temp copy that manipulates the DOM, asserts, and
  appends a green/red result `<div>`; screenshot with `msedge --headless=new --disable-gpu
  --screenshot=out.png --virtual-time-budget=N file:///…`; Read the PNG.
- `{bubbles:true}` on synthetic events. Seed `localStorage` **before** the app. Auto-morph off
  before asserting palette. `setInterval` advances under `--virtual-time-budget`;
  `document.hidden` may read true. Analytics are inert on `file://`/`localhost`.
- **`--dump-dom` returns nothing** in the installed Edge — results must come back via the
  screenshot. Style the result block `position:fixed;inset:0;background:#fff;color:#000`, or it
  renders under the canvas and a red run looks clean.

**Headless runs WebGL2 on the REAL GPU by default — prefer that.** Drop `--disable-gpu` and
the SwiftShader flags entirely: on this dev machine (RTX 4090) four effect screenshots take
~12 s where SwiftShader took ~10 min, and heavy raymarchers (Mandelbulb) render fully. Assert
`gl.getError() === 0` and a console-error count of 0 (a failed link is otherwise silent —
`useProgram(null)` just draws nothing).
- **SwiftShader remains the fallback** for machines without a GPU and for the bit-reproducible
  pixel gates (which were proven under it): `--enable-unsafe-swiftshader --use-gl=angle
  --use-angle=swiftshader`, ~8–15 fps. The SwiftShader-specific stall traps below apply ONLY
  under SwiftShader — on hardware GL a four-layer scene renders fine headlessly.

**SwiftShader is why probes HANG** — virtual time only advances when the task queue drains:
- **Do not add a layer from a probe** (two live layers switch on `renderStackColor` and the frame
  loop stops yielding). Test per-layer UI by toggling classes.
- **The shipped `DEFAULT_SCENE` is a FOUR-LAYER stack, so a fresh profile starts on the heavy
  path.** Anything that keeps it on screen for the run stalls: stopping auto-cycle is enough,
  because the cycler is otherwise what moves you onto a cheap single-layer scene. This is why
  seeding `cycle:false` hangs, and why it looks like the feature under test broke.
  **For a DOM-only probe, stub rAF in `<head>`** (`requestAnimationFrame = () => 0`) so
  `frame()` never runs — all the DOM logic still works and nothing renders.
- **Never `while (...) el.click()`** — bound every drive loop.
- Kill stray `msedge*` first, **including `msedgewebview2`**.
- **A Git Bash path is not a `file://` URL.** `file:///c/Users/…` loads Chromium's "File not
  found" page, which *passes* every "did it finish" check instantly — a green harness measuring
  nothing. Use `file:///C:/Users/…`.

**A probe-generator script must contain no backtick** anywhere in the injected source (comments
included) when that source sits in a template literal — it closes the literal, node dies, and **the
previous probe page is silently reused**. Same class: `\n` in that literal becomes a real newline
and the injected script fails to parse. Use `String.fromCharCode(10)`; check the generator printed
its "wrote" line.

**The app is one IIFE, so an injected `<script>` cannot call into it.** DOM/menu/`localStorage`
assertions work from the page; anything needing an internal function must be a Node probe that
slices the source.

**Test a CSS regression WITHOUT the app**: inline `src/styles.css` into a bare page with a
synthetic node and read `getComputedStyle`. Prove the check is sensitive by re-appending the old
rules and watching it go red.

**Four traps when screenshotting ONE effect** (all four produced confident wrong readings):
- **Turn auto-cycle off first** (`#cycle`), and assert the effect is *still* the one under test at
  screenshot time. It may have swapped **before** your first line runs.
- **`gl.getError()` must be sampled inside a real frame** (afterwards it returns a spurious `0x502`
  from the probe's own `readPixels`). Pixel evidence must be the screenshot, not `readPixels`.
- **`?stack=<id>` does not survive a fresh profile** — the first-visit branch installs
  `DEFAULT_LIBRARY`'s first scene over it.
- **The shipped scenes are not headlessly renderable.** `Fetingen` runs the fire sim (a point
  effect) and `Round and round` is two layers; both stall SwiftShader, so a first-visit
  *screenshot* will not come back. Verify the library through the DOM and look at the real
  preview for the picture.
- **Keep the run under 30s of active time** or `SYNC_DELAYS[0]` opens the nudge over the canvas.
  `?credits=0` doesn't clear credits in a slow run (`creditLeft` counts *rendered* time).

**The pixel gate is BISTABLE — a single mismatch is inconclusive.** No-filter Plasma matches ~9/10;
Plasma + Fire ~3/4. **Re-run a mismatch 2–3 times**; only a repeated one is a signal.

**Pixel gates: shader effects only.** With a stubbed rAF (own the callback queue, fixed 1/60 step)
shader effects are bit-reproducible; **point effects are not** — gate those on logic.
- **Inject before the app**, into `<head>`.
- **Do not clear the rAF queue** — `frame()` re-arms itself.
- Stub `Math.random`; read pixels with `readPixels` in the **same task** as the last frame.

**A green logic probe is necessary, not sufficient**, for anything writing retained heat — drive a
few hundred real frames and look at the screenshot.

**Credits overlay**: read `#creditcv` itself (`getImageData`, count alpha > 8), not the composited
frame; assert the layer properties (own canvas, `pointer-events: none`, z-index above `#fire`,
under the menu). **The claim to nail: credits never touch heat** — zero `fire`, put credits up,
call `creditDraw()`, assert the buffer still sums to zero. **Never diff heat with credits up vs
down** (`simT` advances between runs).

**Credits/banner, three traps** (each red on correct code):
- **Inked-row runs are NOT a stable identity** (2 bands at full alpha, 4 mid-fade). Use the ink
  **bounding-box height**; `bands === 1` is only safe for the title.
- **`frame()` clamps `dt` to 0.25s** — step a stubbed rAF **under** 250ms or the credits never
  expire.
- **Compare pixel COUNTS only between identical strings.** Re-select the *same* scene to prove a
  re-arm; compare bounding-box **width** across very different name lengths to prove the name is
  drawn (`prompt` is stubbable).

**Audio tests need `AudioContext` stubbed**, not just `getUserMedia` (a real one never settles
headless). Contract: `sampleRate`, `resume`, `createAnalyser`, `createMediaStreamSource`, and an
analyser with `fftSize`/`frequencyBinCount`/`getFloatFrequencyData`/`min|maxDecibels`. Pair with a
no-op rAF.

**Share tests need three stubs**: `navigator.clipboard` with capturing `writeText`/`write` (the
`write` stub must resolve the ClipboardItem promise and read the Blob back), and a stubbed `fetch`
for Short link. **Run twice** — once as-is, once with `ClipboardItem` hidden.

### Node probes (`tools/*probe.js`)
All slice real source out of the built file by **markers — keep them**.

- **`filterprobe.js`** — params have defaults; three stages in pipeline order with Bloom last
  **among the post ones**; every screen filter `cpuOk: false`; a stored list applies in registry
  order; `filtersOk` drops unknown/duplicate/non-string ids; point-vs-shader defaults;
  `presetState`'s seeded arrays are per-effect **copies**; an **empty** stored list is honoured
  (only a *missing* key falls back). Markers: `// ---- FILTERS: stackable post-FX` …
  `function initStates(`; `function presetExtra(` … `function initExtras(`.
- **`presetprobe.js`** — structural: every `p.<field>` `applyPreset` restores is one
  `snapshotScene` captures *and* one the import mapping rebuilds. Behavioural: `mergeBeatTune`
  replace semantics + junk rejection. Also pins `safeFileName`, `normalizeBackup`. Markers:
  `const BEAT_DEFAULTS` … `const beatCfg`; `function mergeBeatTune(` … `function installBeatTune(`;
  `function snapshotScene()` … `function defaultPresets(`; `function applyPreset(` …
  `function createPreset(`; `function validatePresetList(` … the comment that replaced the old
  import button.
- **`heatprobe.js`** — parity is invisible to a screenshot. Chains of 0–4 passes from either
  buffer: `pendingDst` names the buffer the *last* pass wrote, no pass samples its own render
  target, the final FBO is still bound on exit. Also pins **`glLayerBeginHeat`** (same parity,
  returns the last-written buffer instead of setting `pendingDst`). Markers:
  `function glBeginHeat(` … `function glBlitPoints(`; `function glLayerBeginHeat(` …
  `function renderLayerHeat(`.
- **`juliaprobe.js`** — rim point matches the cardioid formula; the seed sits exactly
  `juliaInnerR` off it; the inner phase advances at `ratio ×` the outer, `ratio` epicycles per lap;
  `juliaOffX` shifts only the real axis; each of the three descriptors advances the orbit **once**
  per frame. Markers: `const RPM` … `function julia(`.
- **`solidsprobe.js`** — containment (6000 steps, a 9.5s frame, every slider extreme), quaternion
  normality, `Shape mix` never naming a primitive the shader lacks, `Count` clamped to the shader
  array size, per-layer ownership, determinism, per-axis spread. **Two tolerance traps**: assert
  double-exactness on the BODIES (`S.Q`), float32 tolerance only on staged uniform arrays; strip
  comments before grepping for `Math.random`. Markers: `const SOLID_SHAPES` …
  `// ---- CPU mirror of FS_SOLIDS`.
- **`beatprobe.js`** — runs the real detector against a stub analyser fed synthetic dB spectra on a
  fake clock: kick over sustained bass, hi-hats on 8ths (no low-band leak), a 20dB quiet verse,
  silence and a sustained tone (no false positives), a double-time fill (refractory holds).
  Markers: `const HOP_MS` … `const meterBars`; `const medBuf` … `function audioMsg`;
  `function audioTick` … `function clearBeats`.
- **`shareprobe.js`** — the share codec round trip.
- **`cloudprobe.js`** — the cloud path structurally shares `serializeBlob` + the codec with `#zp=`
  bundles; an empty `CONFIG.cloud.apiKey` makes zero network requests at startup.
