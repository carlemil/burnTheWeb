# CLAUDE.md

Rules for this repo. Deliberately terse — nearly every line is load-bearing, and **"don't X"
means X was tried and failed**. Rationale, evidence and war stories were stripped in two
compaction passes: `git show v1.12.3:CLAUDE.md` and `git show 1d0eb06:CLAUDE.md` have them.
Before overruling a rule here, read the old text first.

## What this is

Self-contained demoscene visual on GitHub Pages (https://carlemil.github.io/burnTheWeb/).
Effects share one palette + glow + banding + beat-reactive pipeline, in four families:

- **Point-accumulation** — Sierpiński (`sirpinfyer`), Tetrafyer, Attractor (de Jong), Fractal
  flames (`flames`, the one **additive** stamper — `stampAdd`), Boids.
- **Shader fractals** — AnimeJulia, Burning Ship, Multibrot, Newton.
- **Shader pattern** — Plasma, Tunnel, Metaballs, Kaleidoscope, Rotozoomer, Moiré, Munching
  Squares, Copper Bars, Sun surface, Kefrens bars, Twister, Cymatics, Lightning storm,
  Starfield, Aurora, Reaction-diffusion.
- **Shader SDF** — Polygon, Shape grid, Concentric rings, Bouncing shapes, Bouncing solids,
  Mandelbulb, Menger sponge (the last three 3D raymarched).

Each = one `EFFECTS` descriptor + a `draw(dt)` shader hook or a `stamp(box)` point hook. No
package manager, test framework or runtime dependency. Keep `README.md` in sync.

## Build

- **Source of truth is `src/`.** `styles.css` + `*.js` concatenated in **`src/manifest.txt`
  order** into `dev-index.html`. That order is load-bearing (TDZ + forward refs) — don't reorder.
  Files named by subsystem: `audio-*`, `render-*`, `effects-*`, `orbit-*`, `persist-*`, `stack-*`,
  `controls-*`, `ui-*`.
- **`src/config.js` loads first, holds `CONFIG`** — every default not part of a preset. Scattered
  `const NAME = CONFIG.path` keeps original names; change defaults THERE. `PALETTES` is the single
  palette catalog.
- **Never hand-edit `dev-index.html` / `index.html`.** `node tools/build.js` rebuilds byte-for-byte
  (split/join, never `String.replace` — `$` corrupts JS); `--check` exits non-zero if stale.
- **Deploy with `/deploy`**. `index.html` = production, `dev-index.html` = preview; probes run
  against the preview.
- **Every deploy is a numbered release.** `CONFIG.version` is the only version string; `/deploy`
  bumps it, writes the `CHANGELOG.md` section, tags `v<version>` (push the tag). A version with
  **no tag** is prepared-but-unreleased — publish *that* one, don't bump past it. **major = a
  saved scene / share link / backup stops loading identically**, which must never happen: patch
  for fixes, minor for a new effect/filter/control. `CHANGELOG.md` is user-facing (linked live).
- **Pages deploys via `.github/workflows/pages.yml`** (Actions), not the legacy branch builder.
  Status + logs: Actions tab.
- `.gitattributes` pins LF (global `core.autocrlf=true`).

## Workflow

- **Always commit and push after a verified change**: edit `src/`, `node tools/build.js`, commit
  **`src/` + `dev-index.html`** together, `git push origin HEAD:main`. Don't ask first.
- Commit trailers end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  + the `Claude-Session:` line.
- Preview: open `dev-index.html`, or `python -m http.server`.
- Don't re-run `gh api -X POST repos/carlemil/burnTheWeb/pages`.

## Architecture (one IIFE, authored across `src/*.js`)

### Render pipeline — WebGL2 primary, Canvas2D fallback
`useGL` from `initGL()`; every draw path branches on it.
- **Fire**: low-res heat grid. `glPropagate()` ping-pongs heat textures (cgtutor averaging
  `v = sum_of_4_below * 32 / decay`; `>128` decays, `<128` amplifies). CPU fallback = the double
  loop in `simulate()`.
- **Chaos-game points stay on the CPU** (deterministic): `pushPt()`/`glDrawPoints()`, or `plot()`.
- **Shader effects** write heat to the texture's `.r` (`o = vec4(heat,0,0,1)`), each with a CPU
  mirror. Each has an `FS_*` + `glProg.<id>` registered in `initGL`; `draw(dt)` calls
  `glShaderDraw(name, setU)` or the mirror. `*Seed(dt)` advances phase (identical GL/CPU).
- **Adding a shader effect = append one descriptor** (`FS_*`+`glProg`, `draw`/`cpu`,
  `params`/`defaults`). Sliders generate from `CONTROLS`.
- **Glow**: `glRender()`/`render()` map heat through the palette, then composite an additive
  blurred copy.

### Cardioid seed orbit (AnimeJulia / Burning Ship / Multibrot)
- All three call `juliaSeed(dt)` **once** in `draw`; `julia`/`burningShip`/`multibrot` must
  **never** call it themselves.
- `juliaSeed` = rim point on the scaled main cardioid + a riding circle of radius `juliaInnerR`
  at `ratio ×` the outer phase.
- **The cardioid depends on the exponent**: `d=2` ⇒ Mandelbrot cardioid, else the degree-d
  Multibrot boundary `c = z − z^d` on `|z| = d^(−1/(d−1))`. `cardioidAt(th, d)` is that curve,
  **integer d only — it doesn't close otherwise**; fractional d rides `cardioidBlendAt` (blend of
  the two neighbouring integer cardioids, pushed out by **`JULIA_FRAC_BOOST` 0.3 windowed by
  `4·f·(1−f)`**, zero at whole powers). `juliaPower` is a **FLOAT**, taken raw by the render;
  `setEffect` resets it to 2; Multibrot's `draw` sets it from `mbPower` **before** `juliaSeed`.
  Integer d stays bit-identical to the old hardcoded form.
- Easing: each step × `EASE_K · (1 + JULIA_EASE_A·cos((round(power)−1)·θ))` — the cusp count
  **must stay whole**. **`EASE_K = 1/√(1−A²)` is load-bearing** (lap time `1/rpm` at any power).
  Warp applies to the **outer phase only**, symmetric about θ=π.
- `juliaPower` is declared **above `juliaEase`**. `juliaSeedAt` stays unwarped; the Orbit editor
  **integrates** `dφ = ratio·dθ/ease(θ)`.
- **Burning Ship rides the "wrong" cardioid deliberately — do not "fix" it.** Shipped `outrad`
  **[1.4, 1.9]** compensates; washed out ⇒ check that slider first.
- `tools/juliaprobe.js` locks this down.

### Bouncing solids (the one 3D shader effect)
`src/solids-3d.js`: CPU rigid-body physics, ≤8 bodies, hands the shader only `uPos`
(centre+radius `vec4`), `uQuat`, `uShape`. `FS_SOLIDS` raymarches; CPU mirror `solids()` uses half
the steps.
- **Orientation is a quaternion**; the shader undoes it per sample (`toBody`, conjugate rotation).
  One renormalise per frame.
- **Collision is a bounding SPHERE**; every SDF fits inside radius `r` (box half-extent `0.55r`,
  torus `0.70r`+`0.30r`, …). `Size` IS that radius.
- **Clamp the step (`min(0.05, dt)`)** — one huge `dt` from a backgrounded tab tunnels a body out.
- Bodies live on the **layer** (`L.solids`), like `L.tetras`; they can't ride `PHASE_VARS`.
  `installStackItem` calls **`installSolids(L)`**, else two solids layers share one set.
- Start state uses `sdHash(k, salt, i)`, **not sines**; positions scale to `SOLID_BOX[ax] − radius`.
- `tools/solidsprobe.js` pins containment, quaternion normality, per-layer ownership, spread.

### Menger sponge camera (street drive + tunnel dives)
- Camera **drives the street grid** (corridors at x/z ≡ 1.5 mod 3, y = 1.5 plane), turning at
  hash-picked intersections. **Most segments (`MG_DIVE_P` 0.72) dive on a lane LADDER**: level 0
  street, level 1 the edge tunnel (`(±1, ±1)` lines, carve DE exactly **1/3**), level 2 the inner
  corridor (`(±1/3, ±1/3)` lines, carve DE exactly **1/9**). The DE is `max`-composed, so fewest
  iterations is the binding case.
- **Adjacent lanes cannot be cut between mid-cube.** Swoops happen only inside the open gap slab
  between cube rows; the level steps by at most ±1 per crossing (pyramid `min(r, C−1−r, 2)` in
  `mgLvlAt`). Dives run 4–7 cells, weighted long: ~50% of drive time inside the sponges, ~21% in
  the deep corridors.
- **The whole path is C2.** Swoops and level blends use SMOOTHERSTEP (`mgSS`, window ±0.42 of the
  0.45 gap half-width); corners blend **between the two street lines** (`mgCorner`, `MG_R` 0.9).
  **A free waypoint spline is NOT usable** — it bows off the lane inside a 1/9 tunnel.
- Path lives in **`mengerSeed` on the CPU** (scalar state → `PHASE_VARS`); the shader gets
  `uPos`/`uFwd`/`uRoll` and only builds the view basis; aim = lookahead 1.6. `uFwd` **tilts during
  swoops (|fy| ≤ ~0.36) but must never go vertical**; the CPU mirror builds the same tilted basis.
  `mgLvlAt` and `mgEval` are **pure**; the committed advance lives only in `mengerSeed`.
- Bob is scaled by `(1−g)` (off in tunnels) and its phase **must not contain `mgSeg`**.
- **Never put the camera on the lattice AXIS or a face-centre line** — carve pinch points,
  clearance zero. Scan-verified: min DE 0.107, ~940 dives over 6000 s at max sliders.

### Effect-shader gotchas
- **The heat buffer is Y-FLIPPED against the screen** — buffer row 0 renders at the screen TOP
  (`fire[]` row 0 too). An orientation-sensitive shader (Aurora, Lightning) must treat
  `gl_FragCoord.y/fh − 0.5` as pointing DOWN, or negate it at construction.
- **Reaction–diffusion owns a state texture pair** (`glTex.rd`, RGBA16F where
  `EXT_color_buffer_float` exists, RGBA8 fallback — 8-bit increments under 1/510 freeze the
  culture). `glRDTick` seeds on `rdNeedSeed` (set by `glResize` and `onEnter`) and ping-pongs
  `rdCur`. **A SINGLETON deliberately.** Steps scale with `dt` ⇒ frame-rate independent.
- **Headless virtual-time runs render FEW real frames with large clamped `dt`** — a
  per-frame-stepped sim looks frozen while dt-driven animation sails on. Before diagnosing a
  freeze, patch the pass in a PROBE COPY (hard zero / pure decay / accumulator writes).
- **Boids follows the solids arrangement exactly**: flock on `L.boids`, `installStackItem` calls
  `installBoids(L)` for `boids: true`, hash-seeded start, deterministic flight. Only `bdPrev`
  rides `PHASE_VARS`.

### Point-accumulation effects
Run the fire sim, stamp via `plot()`. `simulate()` dispatches to `stamp(box)` if present, else the
`fractal2d`/tetra branches. Adding one = a descriptor with `stamp`, no `draw`. Stamping happens
inside a **safe box** (heat grid less a 1px margin); Size/Rotation scale & spin the corners about
its centre.
- **Stamp at `POINT_HEAT` (`CONFIG.tuning.pointHeat` = 209), not 255** — 14/19 palettes are
  near-white at 255 and effects ship with no filters.
- **`stampAdd: true` (Fractal flames) makes the stamp ADDITIVE**: `plot(x, y, v, true)` does
  `min(255, heat + v)` on the CPU, and all three `glBlitPoints` call sites pass `"add"` (FUNC_ADD
  ONE/ONE) when the descriptor carries the flag. Density is the picture; the saturated core IS the
  look. `flamesStamp` reseeds the chaos PRNG itself and advances `flPhase` per tick; Strike-style
  beat wiring does not apply.
- **Flames auto-exposure is load-bearing.** Pass 1 runs the orbit unstamped to measure
  hits-per-occupied-cell (64×36 grid); thin phases boost per-point heat up to 6× (capped 220);
  pass 2 re-runs the SAME seeded sequence and stamps. Dense phases keep gain 1. Both passes reseed
  identically — determinism holds with zero per-layer state.
- **Flames owns its Points range**: `ranges: { points: { min: 2000, max: 30000 } }`, default 12000.
  See per-effect ranges under *Effects & per-effect state*.

### Credits overlay + scene banner
Credits draw on **their own canvas** (`#creditcv`, `z-index: 4`, `pointer-events: none`) via
`creditDraw()` from `frame()` **after** `glRender()`/`render()`; below the menu (`z-index: 10`).
**Never stamp them into heat.**
- `CREDIT_HOLD` 5s then `CREDIT_FADE` 3s; `creditLeft` counts **rendered** time. `?credits=<s>`
  overrides the hold. Once expired, `creditDraw` clears once and sets `display: none`.
- `CREDITS` drives both the overlay and the panel's Credits box (`buildCreditList()`). The on/off
  preference has its own `localStorage` key, **not** the scene blob.

**`#scenebanner` is DOM CHROME, not part of the frame** — `"<scene name>  ·  <account>"` in the top
button row. `showSceneTitle(name, author)` arms `titleLeft` from
`CONFIG.credits.titleHold`/`titleFade` (2.5s + 1.5s); `sceneBannerTick()` pushes that clock.
- **BOTH halves gate on the credits**: `frame()` decrements `titleLeft` only in the `else` of
  `creditLeft > 0`, **and** `sceneBannerTick` gates on `creditLeft <= 0`. The tick runs
  **unconditionally**, not inside that `else`.
- **`applyPreset` must not read `p.name`/`p.collection`** — it calls **`sceneTitleFor(i)`**,
  declared beside `collectionOf`.
- Author = `collection`; absent ⇒ `#cloud-name`; no profile ⇒ name alone, dash dropped. **Not**
  `myCollectionLabel()`.
- Own `localStorage` key + **"Show author"** (`#sceneTitleOn`) in the **Scene box under
  Auto-cycle**; no second copy in the Credits box. `#sceneTitleOn` and `#creditsOn` carry
  **`data-nopersist`**.
- **`createPreset` does not arm the banner.**

### Preset transitions
`TRANSITIONS` — third registry beside `EFFECTS`/`FILTERS`. Sixteen entries, each a `mode` of the
single **`FS_TRANS`** pass: `cut`, `burnoff`, `crossfade`, `dip`, `flash`, `pixelate`, `blur`,
`wipe`, `iris`, then the staggered family `checker`, `bars`, `shutter`, `slide`, `clock`,
`dissolve`, `ripple`. `cut` needs no pass; **`burnoff` lends retention** (`hasFeedback()` true
while `transBurning()`).

**`cut` is the fallback, never a choice.** Not listed, never auto-picked while anything else is
ticked, and ticking anything drops it. Everything iterates **`TRANS_PICKABLE`** (registry minus
cut): `buildTransPick`, `setTransUse` (materialise + size-compare — comparing to
`TRANSITIONS.length` would never collapse to `null`), `pickTransition`. It survives only as the
one-member set `{"cut"}` = "none of these"; an empty pool falls back to it. Unticking the last row
writes that set, **not** `null` (which means all).

- Staggered family = one idea, seven delay fields (cell parity, bar index, slat distance, angle,
  hash, ring radius); `slide` translates both frames. **`hash21` has no time term.**
- CPU mirror: mask-based ones (wipe, iris, checker, bars, shutter, clock) paint a white mask,
  `destination-in`, old frame underneath; `slide` = two offset `drawImage`s; `dissolve`/`ripple`
  fall through to a crossfade. `render()` mirrors all seven visible modes.
- `transUse`: `null` = all pickable; stored **by stable id**, not index. Global blob field, skipped
  while `sharing`.
- `glRender` sends the zoom output to `glFbo.post[0]` (not `glFbo.scene`) while a transition is
  live, so the blend precedes the glow. **The outgoing frame is frozen** (`transBegin` copies
  `glTex.scene` → `glTex.prev`).
- Auto-pick = `fits(a, b) → weight` over `sceneInfo()` (`{dense, retains, palette}`), no pixel
  readback. Both dense ⇒ crossfade; density differs ⇒ pixelate/blur/wipe; palettes far apart ⇒
  dip/flash.
- **Transition** slider = [min,max] seconds, drawn per switch like `ttlMs`/`morphMs`. Both thumbs
  0 = cut. `trans.t` advances in **rendered** time.

### Filters (post-FX)
`FILTERS` — second registry, **three stages, listed in that order** (`filterprobe` asserts it).

**feedback** (`Fire`, `Fade pixel`, `Diffuse`, `Echo`, `Zoom feedback`, `Swirl`, `Cellular
automaton`) — mutate retained heat inside `glBeginHeat`, before the effect is MAX-injected. With
no feedback filter `glBeginHeat` **clears** and the CPU path zeroes `fire`.
- Echo/Zoom feedback/Swirl are **one program**, `FS_HWARP`, via
  `glWarpFeedback(src, dist, ang, scale, spin, keep)`. It samples through **`glSampLin`** (heat
  textures are `NEAREST`); a sampler binds to the **texture unit** — unbind immediately after.
- **Each of the four carries its own `Lifetime`.** The label is the only place that says
  "Lifetime"; keys (`fade`, `diffkeep`, `echokeep`, `zfbkeep`, `swirlkeep`), globals and `uKeep`
  keep their names — **keys are the wire format**.
- All four need **CPU mirrors** (`heatWarpCPU`/`heatDiffuseCPU`, sharing `bilinearHeat` +
  `warpBuf`); `cpuOk: false` here leaves the fallback with nothing carrying heat over.

**post** (Twist, Wedge fold, Slice glitch, Pixelate, Blur/sharpen, Edge, Posterize, Halftone,
Solarize, Chromatic aberration, Mirror, Shockwave, Pixel sort, Lens bubble, Droste zoom, Oil paint,
Bloom) — read the palette-mapped image. `glPostChain()` ping-pongs `glTex.post[0]/[1]` and
**returns `glTex.native` untouched when empty**. Bloom has no pass — it is the glow composite under
`bloomAmt`/`uBloom`.

**screen — EMPTY.** Barrel, Scanlines, Vignette, Film grain and Bloom are per-layer `post` passes;
`glBloomPass` makes the glow a chain entry, the other four use `postPass` (fw×fh), not
`screenPass`.
- `glRender`'s final step is `FS_COMP` with **`uBloom` pinned to 0**.
- `glBloomPass` borrows `glFbo.blur1/blur2` and must restore the caller's target — hence
  `bindFbo`/`bindDefault` track `curFbo/curW/curH`, **`var`, not `let`** (`bindFbo` is hoisted and
  called before the declaration line runs).
- `uSize` is the render buffer ⇒ Scanline count = lines across `fh`; two scanline layers can moiré;
  Vignette after Bloom darkens the glow.
- **`SCENE_FILTER_IDS`/`SCENE_FILTER_KEYS` are empty seams**, kept as the **wire-format** seam.
  `sceneFx` still rides in every blob; **`migrateSceneFx`** folds an old scene's whole-scene
  filters onto its layers (ids appended last, values overwrite), runs beside `migrateCam` in both
  load paths, deletes the field, idempotent.
- **No "Scene filters" box; `FILTER_LISTS` has ONE entry.** Putting a filter back on the whole
  scene needs a host + a `FILTER_LISTS` entry as well as an id — a filter routed to a missing host
  silently vanishes.

**Slice glitch and Film grain read `postTime`**, accumulated from the frame loop's `dt` — not
`performance.now()`, not `simT`.

**Ping-pong parity**: `glBeginHeat` runs each ticked `glFeedback(srcTex)` in registry order, one
pass each, **`pendingDst` = wherever the last pass landed** (not a fixed `1 - curHeat`);
`pendingDst = src` after the loop. `tools/heatprobe.js` locks this down.

**Feedback filters apply to shader effects too**: `frame()` advances retained heat first
(`heatFeedbackTick()` × `ticks`) and `glShaderDraw` **MAX-blends** over it. `hasFeedback()` is the
single predicate. On CPU, `frame()` hands the mirror the *other* buffer (`fire`/`fireKeep` swap)
and MAX-merges — depends on **every CPU mirror writing every cell**; no early-outs.
`beginHeatTick()` does **not** flip `curHeat`; `heatFeedbackTick()` does. `applyFilters()` wipes
`fire` on `!hasFeedback()`, **not** `!filterOn("fire")`.

**CPU masking**: post filters carry `cpuOk: false` on the fallback. Mask **at the point of use**
(`cpuBlocked` → `filterOn()` → `activeFilters()`/`hasFeedback()`) and **never remove them from
`activeIds`**. `cpuBlocked` is filled by the FILTERS block but declared with the render globals.

**BYPASS (`.filter-by`, the eye beside each filter row)** mutes a filter *in place*. **Transient
and deliberately outside the wire format.**
- Held on the **layer object** (`L.fxOff`, a Set), so it follows its layer through a reorder;
  `stackItemOut` names its fields explicitly so it is never serialised, and `installStack` drops it
  on every scene load.
- **`filterOn(id)` is the one place it is applied** for the drawing layer. `renderFxOff` is set per
  layer in `frame()` beside `renderFilters`.
- The two per-layer chain builders read **`liveChainIds(L)`**, which strips the bypass **before
  `splitChain`**.
- The eye is inside a `<summary>`, so its handler must `preventDefault()` as well as
  `stopPropagation()`. Both visibility toggles (this and the layer mute `b.lyr-eye`) render
  `EYE_OPEN`/`EYE_SHUT` (boot-globals, inline SVG on currentColor) via innerHTML.

**Foldable control groups** — `FOLDABLE_GROUPS` is **EMPTY by request**; the machinery stays
(heading build, delegated `#panel` click, visibility pass all read that one set).
`refreshBlockVisibility` hides a folded group's ROWS but **the heading is shown against `shown`,
never the fold**. The heading click is delegated on `#panel`. Folds apply to every block at once.

**The list shows only the filters you have ADDED, in run order.** `+ Add filter` → `#fltdlg` is the
only place the full catalogue appears; rows carry `⠿` and `✕`. `buildFilterUI` builds one
`<details>` per filter (body adopted out of `#filterctl`); `renderFilterLists()` re-appends the
added ones in chain order. **Only the catalogue sorts**: `buildFilterPicker` collects into caption
groups first, keeps the captions in REGISTRY order (they mirror the pipeline) and lists the
filters inside each **by name**. The menu's own list is the chain — its order IS the run order and
must never be sorted.
- **Every section stays in the DOM forever**, hidden not removed (`el()` is `getElementById`).
  **Order is expressed by re-appending** — DOM order *is* the order. **`#flt-<id>` survives as a
  hidden checkbox** (the value store); `setFilterOn(id, on)` is the single toggle path.
- `buildFilterUI` must run **before** the `POPPABLE` pass. `#filterctl` survives empty and hidden.
- `makeFilterGrab`: transform the dragged section, show a `.filter-drop` marker, reorder once on
  release. **Never move the node mid-drag** (Chromium drops pointer capture on reparent).

Filter `params` are ordinary CONTROLS keys (host `"filter"`, one contiguous `group` per filter).
`refreshControlVisibility()` shows a control when the effect declares it **or** a ticked filter owns
it. `presetState` merges `FILTER_DEFAULTS` into every effect's state (an effect naming the same key
wins).

**Every effect defaults to NO filters** (`presetFilters` → `[]`); `DEFAULT_SCENE` carries an
explicit `sceneFx:{on:["bloom"]}`. Per-effect list = `extras[e].filters` (stable string ids);
**`mergeExtra` is mandatory**. `setEffect` runs its visibility pass before `loadExtra` knows the new
list, so `loadExtra` re-runs `refreshControlVisibility()`.

**The stored list is the USER'S ORDER.** Every chain walks it via **`orderFilters(ids)`** — never
`FILTERS.filter(...)`. `filtersOk` returns a Set built in array order.
- **The chain is a SEQUENCE, split not sorted — `splitChain(ids)`.** Everything at or above the
  **last feedback filter** runs in the heat phase; everything below runs on the palette-mapped
  picture. A `post` filter runs in **either** (above ⇒ warps heat, `R8`, shader writes `.r`; below
  ⇒ repaints). `runHeatPass(f, tex)` dispatches (`glFeedback` if present, else `gl`).
- **Never re-introduce a stage sort** — it made Swirl+Mirror unswappable.
- **The divider marks where the EFFECT draws**, not a barrier: `stageDivider()` emitted once after
  `splitChain(...).heat.length` rows; `flashStageMove` explains a cross-boundary drag. No feedback
  filter ⇒ no divider.
- **Both render paths**: single-layer runs `activeFilters()` off `activeIds`; a stack runs
  `renderStackColor` → `layerFeedbackChain`/`glLayerPostChain` off **`L.filters`** (kept current for
  the selected layer by `applyFilters()` → `persist()` → `stackOut()`). `DEFAULT_SCENE` is a
  four-layer stack, so the stacked path is what users hit first.
- **Four sites must respect the order**: `glBeginHeat` + `glPostChain`, `layerFeedbackChain` +
  `glLayerPostChain`, and — easiest to miss — **`mergeExtra`**. `activeFilterIds()` is the write
  side (`saveExtra`, `captureLayerExtras`).
- **`orderFilters` is a function declaration; `FILTER_STAGE_RANK` is a const it closes over** —
  `buildFilterUI()` must run **after** that block, or the TDZ throws and every filter shows.

**Effect `defaults` are NEUTRAL**: `palcycle [0,0]`, banding off, no rotation, every dual `[lo,lo]`.

TDZ: the registry block sits **above `presetState`**; `buildFilterUI()` **after** the registry;
`activeIds` + `filterOn` with the render globals (`bindRange` runs `apply()` during wiring).

### Effects & per-effect state
**`EFFECTS` is the single source of truth** — `{id, name, presetName?, subtitle, help, params,
helpTags, draw?/fractal2d, bakesOwnZoom?, cardioid?, onEnter?, defaults, ranges?, beat, extras}`.
Adding an effect = append one descriptor (`assertRegistry()` warns on dup id and on unknown
`params`/`defaults`/`ranges` keys).
- **The dropdowns list effects BY NAME** via **`effectsByName()`** (declared with the registry) —
  `#effect` and every row's `select.lyr-name`. Display only: `EFFECTS` keeps registry order
  because the runtime `effect` is an index into it, and each option's `value` is that index.
- **Controls** generate from `CONTROLS` (type, label, range, `fmt`, `apply`, `durScale`, host).
  `buildControls()` → `#fxctl`/`#bandctl`; `setEffect` shows only the descriptor's ordered
  `params`. No hand-written control HTML.
- **Defaults** seed `states[e]`/`beatStates[e]`/`extras[e]` via
  `presetState`/`presetBeat`/`presetExtra`. Include render-affecting keys the effect doesn't
  display (e.g. `band` at 0) so switching resets them.
- **Render**: `frame()` runs `draw(dt)` or the fire accumulator; `simulate()` stamps 2D when
  `fractal2d`; `setEffect` runs `onEnter`; `renderHelp` filters by `helpTags`.
- **Identity: the stable string `id`, never the index.** `serializeBlob`/`deserializeBlob` convert
  at the storage edge; `LEGACY_EFFECT_IDS` migrates pre-id blobs; `effect` stays the runtime index.
  **`EFFECT_MAPS` + `keysToIds`/`keysToIdx` cover the per-effect maps** (`states`, `beats`,
  `pulses`, `plens`, `extras`). Numeric key ⇒ pre-id blob; unknown id ⇒ dropped, never misfiled.

**Per-effect slider bounds** — optional `ranges: { <key>: {min, max, step?} }`, **per-LAYER keys
only** (a scene key's bounds are shared scene-wide). Flames' `points` is the one user; widening the
shared schema entry instead would raise every other point effect's floor and re-clamp saved values.
- **`rngShipped(id, fx)` is the single reader** — `RNG_ORIG` with that effect's override laid over
  it. `rangesDiffering`, `resetControl`, `applyRangesFor` and the Reset-effect button all go through
  it, so an effect's bounds are never mistaken for a user widening and ↺ restores the *effect's*
  range.
- `applyRangesFor` resolves the effect per block (`stack[slot].fx`, else `effect`) — also what
  re-widens the slider on an effect SWITCH (`setEffect` calls `applyLayerRanges` after assigning
  `effect`, before `loadState`).
- **`applyBlob`'s `ok(id, x, e)` takes the effect** and widens by its declared range before testing;
  it validates every effect's states against the LIVE sliders, which belong to whichever effect is
  on screen.
- A stored value below a newly-declared floor clamps up when that effect goes live — declaring or
  raising a `min` is a scene-visible change.

**SINGLE controls** — `single: true` on a `dual` entry: one integer, one thumb. Used by the four
enums (`flvar`, `mirror`, `pxdir`, `sdmix`) and the small-domain counts (sides, segments, bars,
bolts, iterations, …). Not `points`/`bdcount`/`xormask`/`bandsize`, nor anything that scales
rather than counts — `cocount` and `sgcells` are densities the shader multiplies by, so a
fraction renders correctly and a spread is worth drifting.
- **It stays `type: "dual"`.** The store is still the `[lo,hi]` pair and the wire keys are still
  `<key>-lo`/`<key>-hi`, so no scene, link or backup needed migrating. `type: "plain"` would have
  changed both — and nothing wires `plain` (the loop filters `type === "dual"`), so its `apply`
  would never run.
- `SINGLE_KEYS` + **`singlePair(id, v)`** live in `controls-schema.js` (first slice — `ctlHTML`,
  `wireRange`, `RNG_ORIG`, `applyBlob`, `mergeState` and `paintBlock` all read them).
  **`singlePair` is a function declaration**, not a const arrow (TDZ, same rule as `blendOk`). It
  collapses a stored pair **lo-then-round**, which reproduces what these controls' own
  `Math.round(v)` applies already computed — a scene that *rendered* N still renders N.
- `ctlHTML` emits the real `step` (not `"any"`) and a `.dual.single` wrapper + `.thumb-hi` class;
  the browser then snaps every `.value =` write onto the grid, and **`snapStep` becomes live**
  (it short-circuits on the `NaN` that `"any"` gives it).
- **`RNG_ORIG` must carry that step too**, and `applyRangesFor` must ignore a stored `step` for
  these keys — it resets every slider's step from `rngShipped` on every scene load and effect
  switch, so an `"any"` there silently un-quantises the lot on the first load.
- `wireRange` mirrors the hidden thumb and is **the one place triggers are suppressed**
  (`beat !== false && !single`). No chips ⇒ the key never enters
  `beatReact`/`pulseShape`/`pulseLen`, so every `merge*`/`prune*`/`sync*` that iterates those maps
  skips it and a saved scene's stale `beat` entry is simply never visited.
- **No drift comes free**: with `lo === hi`, `stepAnim` takes its `mx - mn < 1e-9` branch and
  draws no `Math.random`. The readout is free too — `ui()` already prints one number when `A === B`.
- Collapse sites are `mergeState` (the funnel, and the only fix for a non-selected layer —
  `bandOf` reads `L.state` directly), `applyBlob`'s states loop (it bypasses `mergeState`) and
  `paintBlock` (the one site that writes values without dispatching `input`).
- The range editor drops its step row for these keys and rounds typed bounds; `tools/singleprobe.js`
  pins the set and the behaviour.

**Break-out boxes.** Every `dual`/`plain` slider appears in the menu as a name + `+`/`−` launcher
(`.ctl-row`); the `#ctl-<key>` node lives in `#breakout`, a `position:fixed` column filling top→down
in click order. A thumb is only ever visible in the column.
- **A box belongs to a LAYER**: `popped` keyed `"<slot>/<key>"` (scene = `"s/<key>"`).
  `refreshBreakout()` shows one iff its slot/key is popped **and** that layer still uses the
  control. `ctlOwner(slot, key)` prefixes `L2 ·`; `syncPopOwners()` re-stamps after a reorder.
  Transient.
- **A SCENE filter param is ONE box and N rows** (`bloom`, `burn`, `barrel`, `scan`, `scancount`,
  `vignette`, `grain`). It carries an `id`, not `data-k`, so the map lookup `ctlIn` never finds it:
  a second pass over `FILTERS`' params — **params order, not `POPPABLE` order** — dresses one box
  into `#breakout` with **no `data-slot`** and appends a launcher row to *every* block's copy of
  that section. **`popSlot(slot, key)` folds those keys to `-1`** inside `syncPopBtns`. `ttl`/`tdur`
  are scene controls too but have one home in the Scene box — no launcher.
- **NOTHING calls `dockAll()`** — kept, no callers.
- `#breakout` is **outside** `#panel`, so: control CSS scoped `#panel …, #breakout …`; `onEdit`
  attached to `#breakout` too; its **own capture-phase `pointerdown` + `focusin`** selecting
  `box.dataset.slot`'s layer.
- Box order top→bottom: `.ctl-owner`; label+value; slider; **`.rng-sec`** (collapsible "Value range"
  wrapping `.rng-edit` — min/max/step only, closed by default, summary `?` opens `openRangeHelp`);
  `.ctl-div`; **Triggers** (`.trig-t`) over the chips; **`.trig-body` — ONE folding element holding
  the whole trigger kit** (**Shape** over the `PULSE_SHAPES` picker, **Duration** (`.plen-name`)
  over `.plen` + its max row, **Refractory** (`.trig-refs`) closing it — per-band sliders,
  `beatCfg.refract` 20–500 ms, shown only for armed bands); then **a `.ctl-div` + the Reset row
  (`.ctl-reset`) CLOSING the box, outside both foldables, always visible**.
  The trigger body is hidden until ANY chip is armed and shows as one element when one is
  (`syncTrigRefs` via `refs.body`, re-pointed like the chips via `refEls`). Sub-titles drop the word
  "Trigger". `makeChips` **appends** (append order = display order). The range editor is built later
  (POPPABLE pass) and must **`insertBefore` `.trig-t`** — the FIRST `.trig-t` is the Triggers
  heading. It carries no `border-top`. The trigger section exists only in a box.
- `.ctl-owner` = `ctlOwner(key)` → `CTL_GROUPS[control.group]`, `"Filter · "` prefix for `f_*`.
  Added in `POPPABLE.forEach`, not `ctlHTML`.

**Range editor** (`makeRangeEditor`): `min`/`max`/`step` + ↺ (→ `resetControl`). `rngApply` writes
the attribute onto the real slider(s), re-clamps, dispatches `input` **on the slider** (the number
fields are skipped in `onEdit`). `applyRanges` calls `rngSyncAll()`.

**Blocked controls**: `CTL_BLOCKED` maps blocked key → blocker (`bandsize`/`banddim` → `band`,
`nodspd` → `nod`). A control is off when its dual's **high thumb is 0** (`ctlHi`) — read the thumb,
not the animated value. `refreshBlocked` runs from `refreshControlVisibility` **and `onEdit`**.

**Orbit editor** (`#carddlg`, `#cardbtn`), gated on `cardioid: true`. Floating, non-modal,
bottom-right, `z-index: 5` — **never add a backdrop or click-outside-closes**. Hides on `m`/`Esc`.
- Samples **`juliaSeedAt(outer, inner)`** so opening never advances the animation; `frame()` redraws
  while open.
- Backdrop **`cardLocus(w, h, d)`**: Mandelbrot at power 2, degree-d Multibrot otherwise. Quantised
  to `CARD_POW_Q`, half-res offscreen, integer-2 fast path.
- `card` is a **`var`**; `cardOpen`/`cardDraw` early-return on falsy `card`.

**Seed path**: `seedPathMode` (`"cardioid"`|`"circle"`|`"freehand"`), per-path `seedRideOn`,
freehand `seedPts` → arc-length LUT `seedSpline`. **`basePathAt(th)`** is the fork; freehand is a
closed periodic Catmull-Rom traversed by arc length. `juliaSeedAt` adds the riding circle only when
`seedRideOn`. **`juliaEase` is a flat 1 off the cardioid.** Default (cardioid + ride on) reproduces
the original math byte-for-byte.
- **Per-LAYER scene data** (`L.seedPath`/`seedRide`/`seedPts`), `extras[e]` as per-effect fallback.
  Shares at 4dp, capped by `seedPtsOk`; rides via `stackItemOut`/`mergeLayers`.
- **`installSeedPath(L)`** from `installStackItem`; epilogue restores the selected layer's.
  **`captureSeed(L)`** swaps in a **NEW** `seedPts` array (never mutate in place) so the
  `seedSplineFor` WeakMap invalidates.
- `stageLayerExtras`/`applyLayerExtras` install the seed, **not `loadExtra`**. `syncOrbitUI()`
  reflects live state; `seedDrawing` is transient.

**Camera on CPU**: mirrors call `camPix(x, y)` per pixel (scratch `camPX`/`camPY`, no allocation).
Per-row hoists must stay **inside** the x loop — rotation mixes x into y. **Copper Bars** keeps its
row-constant fast path but gates it on `camOn()`.

### UI: two menus
☰ opens the **menubar** (`src/ui-menubar.js`, `#menubar`) — everything that is *not* scene data:
Controls panel / Fullscreen / Hide all UI, **Audio**, **Resolution**, Cloud profile, Public scenes,
Credits, help. **`#panel` is only the scene editor.** ☰ does **not** toggle the panel; `m` does.

**Audio and Resolution are ROOT items** (no "System" parent). Each needs **its own adopt host**
(`#audiobox`, `#resbox`) — one host per leaf.

**The menubar ADOPTS nodes, it does not rebuild them.** `#audiobox`, `#resbox`, `#cloudbox`,
`#creditbox` are authored hidden in the panel markup; `{adopt: "id"}` *moves their children* in.
`ui-menubar.js` is **last in the manifest**. **`returnAdopted()` is load-bearing and its absence is
destructive** — panels are destroyed on close, so an adopted block must go home first or the real
audio buttons, resolution select, `#cloudrow` and credits list are **deleted from the document**.
`box.dataset.adopt` names home.

**Every dialog's title + close button are STICKY.** First two children = the `.pal-close`-family
button and an `<h2>`.
- **The panel-tool dialogs dock TOP-LEFT beside the panel** (margin 58px/298px, the `#breakout`
  column line): the three pickers (`#fltdlg`, `#palpickdlg`, `#transpickdlg`), the Palette editor
  (`#paledlg`), the Palette inspector (`#paldlg`). Reading/flow dialogs (Help, Gallery, Restore)
  stay centered. Their `h2` has **no right margin**, their header tone matches the box tint, and the
  × is pulled 12px into the side padding and 12px down.
- Button is `position: sticky` + `float: right`, **not `absolute`**. **The box gives up its
  `padding-top`; the header carries it.** Header background bleeds over side padding via
  `box-shadow: 0 -30px 0 30px` (18–26px per dialog) plus a `backdrop-filter`.
- **A probe that opens a dialog by un-hiding it proves nothing** — content is built on open. Click
  the real opener (`#transpick-open`, `#pal-detail-btn`).

**Shared widget CSS is keyed on the CLASS, never scoped to a container** (bitten three times).
`.pal-close, .card-close, .help-close, .sync-close` and `.audbtn` are single unscoped rules; a
dialog need only be `position: relative` (or deliberately `static`, as `#carddlg .card-box` is). The
control-appearance CSS is the exception — it names `#panel …, #breakout …, #menubar …`, three real
hosts for the same nodes.

`#menubar` is a full-screen overlay that **catches** pointer events while open (it is the
click-outside closer). Every CSS rule an adopted block needs must name `#menubar` alongside `#panel`
— **including the font**, which lives on `#panel`, not `body`.

**Panel layout**: header + **four `.box` `<details>`** (fold transient) — *Scene*, *Scene filters*,
*Beat tuning*, hidden *Layer effect & filters* — plus **`#lyrsec`, a plain titled SECTION** for
Layers (not a box). The hidden box holds `#effect`, `#fxctl`, the Orbit editor, Reset, per-layer
filters, palette. `buildControls` routes by `host`: `"band"` → `#bandctl`, `"pal"` → `#palctl`, else
`#fxctl`. **`#scenenow`** names the selected scene, filled by `syncSceneTitle()` from
**`buildPresetList()`** — the choke point every selection path goes through.

### One control block PER LAYER
A `.lyrblock` cloned from `<template id="lyrblock">`, `STACK_MAX` of them, built at startup and
living permanently in their row. Any number open at once. No `#lyrctl`, no `parkLayerCtl`.

- **Nothing inside a block carries an `id`.** They carry the same string on **`data-k`**, resolved
  via **`ctl(k)`** (selected), **`ctlIn(slot, k)`** (one), **`ctlEach(k)`** (all). The STRING never
  changes — `speed-lo` is a wire key. `ctlReg` registers a node *and* stamps `data-k`.
- **Node REFERENCES, not subtree queries**: `keyMap[slot]` is a hash, because POPPABLE moves every
  `.ctl` into `#breakout`.
- **A SCENE control keeps its `id`, generated in slot 0 only** — the seven `SHARED_FILTER_KEYS`
  plus `ttl`/`tdur`. `ctl()` falls through to `getElementById`. `isSceneCtl` sits above `ctlHTML`.
  **`#effect` and `#palette` are hoisted OUT of the block** (single value stores).
- **One set of maps pointed at one block**: `wireRange(slot, …)` builds nodes, `ui()`, clamps and
  the beat block; `registerAnim` creates `anims`/`animPhase` and runs the single startup `apply()`
  from slot 0; **`pointMaps(slot)`** re-points on selection — it must **never** re-create
  `animPhase` and **never** call `apply()`. `makeChips` handlers guard on being the **live** block,
  not `slot === stackSel`.
- **`paintBlock(slot, L)`** fills a NON-selected block from its frozen record: skip the selected
  block, apply that layer's **bounds BEFORE its values**, and **never dispatch `input`**.
  **`repaintAllBlocks()` must run wherever a slot changes which layer it holds** — reorder, add,
  remove, `installStack`. It lives inside `installStack`, not `applyPreset`.
- **Visibility passes are per block**: `shownKeysFor(slot)`, `refreshBlockVisibility`,
  `markFirstGroup`, `refreshBlocked`, `ctlHiIn` all take a slot.
- **`RNG_ORIG` is built from `CONTROLS`, not a DOM scan.**
- **`selectStack`'s order is load-bearing**: `freezeItem` → `stackSel = j` → `pointMaps(j)` → rest.
- Selection = capture-phase **`pointerdown` AND `focusin`** on the row; pointer alone leaves a
  keyboard hole.
- Fold via **chevron** (`openSlots`, `.lyr.folded > .lyrblock { display: none }`) — it only HIDES.
  **Every layer starts folded**, `openSlots` starts empty, and **selecting does not unfold**.
  Unfolding does select. `dropOpen`/`moveOpen` remap on remove and drag.
- **NOTHING may override the row's `padding-bottom`.** An open row is squared off by the block's
  `margin-bottom: -6px`; a folded row has no block, so the 6px padding is its whole floor. Any
  per-state padding must name `:not(.folded)`.
- **The chevron is on EVERY row, upper-left**, and both opens and closes. **Explicitly PLACED grid
  child** (`grid-column: 1; grid-row: 1`), else it takes the next auto cell and collapses the row;
  the drag handle drops to `grid-row: 2 / 4`. Styled **`#panel .lyr b.lyr-chev`** (`#panel .lyr b`
  outranks a plain class). **Every chevron in the app is 2x** (~20–22px); `::before` ones pin
  `line-height: 0`, the layer one uses `line-height: 1`.
- **`#effect` is hidden here, not deleted** — it stays the effect value store.
- First *visible* group heading's top border via **`.grp-first`, set by `markFirstGroup()`** —
  **not `:first-child`**.

**Palette cycle**: `palcycle` dual (host `pal`) = [min,max] seconds per morph; `morphMs()` draws
each duration like `ttlMs()`. Both thumbs 0 pins it. `morphing` is **derived** (`palCycleOn()`), not
stored; `syncMorphFromSlider()` starts/pins on edit. `extras.morph` still written for compat.

**Reverse colours** (`#palrev`) — **per layer**: live `paletteReverse` for the selected layer,
`L.paletteRev` otherwise (`layerPalRev(L)`), `extras[e].paletteRev` as single-layer fallback. Flips
indices **1..255** of the baked LUT, leaving 0 as background. Both bake choke points:
`composePalette` and `bakeLayerBytes(…, rev)`.

**Background** (`#palbg`) — **per layer**: `paletteBg` ∈ `"palette"` (**default**) | `"black"` |
`"white"`. Default in both deciding places: the initial global and **`bgOk`'s fallback**.

**Palette editor** (`#paledlg`, `src/palette-editor.js`): `✎` on a CUSTOM swatch edits it; new
customs come from the **picker's Create new** (`#palpick-new`) — a plain RGB ramp under a
user-supplied name via `prompt`, and **no name ⇒ no palette**. A named creation goes through the
custom branch, so closing without an edit KEEPS it. Create new must add the new index to a
**materialised `palUse` set**. Floating, non-modal, hides on `m`/`Esc`.
- **Edits LIVE, not as a draft.** **A fresh copy closed without an edit is removed again**;
  `Save & close` overrides.
- **A stop-handle drag must not rebuild `#pale-stops`** — the capture and move/up listeners live on
  the dragged button (same rule as the filter-list drag). Mid-drag goes through
  `paleApply(full, dragLive)`; the full re-render runs on release. `setPointerCapture` is wrapped in
  try/catch (synthetic probe events carry no live pointer).
- **Customs live in the SAME `PALETTES` array**, after the built-ins; `PAL_BUILTIN` captured
  immediately after the literal. `grad()` hangs `stops` on the returned fn; `palStopsOf` samples the
  three procedural ramps.
- **`applyBlob` must install customs BEFORE validating any palette value.** `customPalettesOk` drops
  malformed entries and **sorts stop lists**.
- **Deleting a custom shifts later indices down** ⇒ `palRemapDeleted` rewrites the live stack,
  per-effect `extras` and every preset. Existing share links are not rewritten.

**`palGone`** — SOFT-deleted shipped palettes (a tombstone Set of built-in indices, persisted beside
`palUse`, skipped while sharing). **A built-in can never really be removed** — indices are the wire
format — so the entry stays in `PALETTES` and `palInUse` gates it out of the strip/picker/cycle.
`deleteAnyPalette` is the one entry and the **per-row ✕ is its only caller** (a "Delete selected"
button acting on the swatch highlighted behind the dialog was a second, blinder way into the same
destructive path — removed): customs really delete, built-ins tombstone; **floor = one alive palette
total**, enforced again at `applyBlob`. **"Select all" clears the tombstones** — the recovery path.
- **Deleting falls back to an IN-USE palette** — `palFallbackFor(gone)` (beside `palInUse`): the
  first other palette `palInUse` allows, else the first in the list. Landing on index 0 regardless
  put layers on a ramp the strip might not even show. It returns a **pre-splice** index, so
  `deleteCustomPalette`/`deletePalEditor` shift a result above `gone` down by one before handing it
  to `palRemapDeleted` — `palRemapOne` writes `back` verbatim. The editor's own Delete still prefers
  the palette the copy came from, but only while that one is in use.

**`palUse`** (`#palpickdlg`, the "+ Choose palettes" tile ending the strip): gates the STRIP and the
CYCLE only (`pickOther` picks from it). A scene storing an unticked palette still loads and renders.
`null` = all; `setPalUse` collapses full/empty back to `null`. Global blob field, skipped while
`sharing`. **Indices ⇒ `palRemapDeleted` must remap it.**

**Palette names may change; the ORDER may not** — everything references palettes by index. The
UI nevertheless lists them **by name** through **`palByName()`** (beside `palInUse`): the strip,
the picker rows and the hidden `#palette` options are appended in name order while `PALETTES`
itself never moves, and every option/swatch still carries the real index (`value`, `data-pal`).
Sorting the array instead would repoint every saved scene, link and backup.

**Palette picker**: `#palette <select>` is the hidden value store; `#palswatches` is visible (one
gradient per in-use entry via `palGradientCss(i)`). A swatch sets `paletteSel.value` and dispatches
a bubbling `change` — no extra state. `syncPalSwatches()` mirrors the highlight on programmatic
changes. Keep the select in the DOM.

**`setEffect(i, save)`** shows `params`, runs `onEnter`, swaps five per-effect maps: `states[e]`,
`beatStates[e]`, `pulseStates[e]` (default `"snap"`), `plenStates[e]` (default `PULSE_DROP`),
`extras[e]`. Calls `save*` for the outgoing effect, `load*` for the incoming. **It does not clear
the heat buffer**; `acc = 0` still resets.

**Beat chips ship unarmed**; per-band colours (L blue, M green, H red) tint them even UNARMED
(letter/border/faint fill); armed = full solid fill + glow.

**Beat dots** (`.ctl-dot`, `dotEls`): ≤3 per row, **12px**, chip colours, `display:none` unless
armed, `opacity .75` idle, lit by `flashChips()` (the idle figure is repeated in `flashChips`'s ramp
— keep the two in step). `syncDots()` is called **from** `syncChips()`; dots exist only for keys
present in `chipEls`.

**Beat pulse**: `updateAnims` snaps an armed slider to the high thumb and decays `a.pulse` linearly
1→0 over `pulseLen[id]` seconds (`.plen`, `PLEN_MIN`–`PLEN_MAX`, default `PULSE_DROP` = 0.2s).
`pulseShape[id]` reshapes it: `a.apply(mn + shape(a.pulse)*(mx-mn))`. Every `PULSE_SHAPES` fn maps
`[0,1]→[0,1]` with `f(0)=0`, `f(1)=1`; `snap` is identity. `pulseEls`/`syncPulse` mirror
`chipEls`/`syncChips`; `plenEls`/`syncPlen`/`prunePlens`/`mergePlen` mirror the shape set.

### The effect stack (layers)
Ordered list of ≤4 effects composited into one heat buffer. `stack`, `stackSel`, `STACK_MAX` = 4.

**Never call it `layers` in code** — `layers` is already a CONTROLS key (`layerCount`/`LAYER_MAX`,
copies of the *fractal*) persisted in every `states[e]`. "Layer" is user-facing only. Use
`stackSel`, not `slot` (a local in both ping-pong loops).

**`effect` = the SELECTED item's effect**, assigned only in `setEffect`. Only the render path reads
`stack`. **`EFFECTS[effect]` must never reappear in a render path.**

**Pressing anywhere in a row selects that layer** — capture-phase `pointerdown` (children
`stopPropagation()` on `click`) plus capture-phase `focusin`. The `click` listener stays for
synthetic clicks; `selectStack` early-returns when already selected. **The grab handle is excluded**
— it selects on pointer**up**.

**Rows are a FIXED POOL of `STACK_MAX`, keyed by SLOT, built once, never destroyed.** `syncStackUI`
only paints; spares hidden. **Every handler reads `stack[slot]` live.**

**Every row has its own effect `<select>`** (`select.lyr-name`). A change on a non-selected row calls
`selectStack(j)` **first**; `fx` is read off the `<select>` **before** either call.

**The DOM is the store for the selected item; every other item holds plain numbers.** `loadState`
writes the DOM and dispatches synthetic `input`. `bandOf`/`beatOf`/`shapeOf`/`plenOf` short-circuit
to singletons for a one-item stack. `freezeItem`/`thawItem` move between representations and **null
the record on thaw**. Reading a frozen record without freezing first loses the last edit.

**Palette + filter stack are per-layer** (`L.palette`, `L.filters` — not `extras[e]`). Live
`paletteSel.value` + `activeIds` are the selected layer's. `applyLayerExtras(L)` puts a layer's
palette+filters live; `captureLayerExtras` reads them back. **Switching layers must run
`stageLayerExtras(L)` BEFORE `setEffect`.** Changing a layer's effect KEEPS its palette/filters.

**Animation is split scene vs layer.** `bindRange` tags `anims` entries `scene` via `isSceneCtl` —
palette, banding, camera, display zoom. Most filter params are LAYER keys; only
`SHARED_FILTER_KEYS` are scene-wide: `burn`, `bloom`, `barrel`, `scan`, `scancount`, `vignette`,
`grain`. Scene keys apply immediately; layer keys are computed, then `installStackItem(L)` pushes
them before that item draws. **Feedback params are read during propagation, before
`installStackItem` in the single-layer path** — that branch calls `installStackItem(live[0])` up
front.

`updateAnims` is **key-major, not item-major** (each drift segment draws twice from `Math.random`).

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
heat-space merge, byte-for-byte. Two or more ⇒ **`renderStackColor`**, each layer coloured with its
own palette and blended in **OKLab**.
- Each layer owns `glTex.heatL[slot]` and runs its own feedback via **`glLayerBeginHeat`** (a copy
  of `glBeginHeat`'s ping-pong — **not** `glBeginHeat` itself, which stays untouched for the
  `heatprobe` slice). `renderLayerHeat` calls `installStackItem(L)` first.
- `stepLayerPal(slot)` is a per-slot morph clock drawing durations from the shared sliders.
  `bakeLayerBytes` bakes ramp + live banding into `glTex.palL[slot]`. `layerPalIndex` reads the
  **live dropdown** for the selected layer (`L.palette` is null while selected), `L.palette`
  otherwise.
- `glColorizeLayer` (FS_PAL) → `glLayerPostChain(L)` → `glOkMerge` into `glTex.color[0/1]`. Blend =
  `L.blend` → `BLEND_MODES[].u` → `FS_OKMERGE` branch: `0` add (brightness-weighted), `1` max, `2`
  diff, `3` colour, `4` luminosity. **`BLEND_MODES` is the single source of truth** (row button,
  uniform, `blendOk`). An **`accW < ε` guard** returns the plain layer before the branch. `L.gain`
  scales the weight ONCE here. `FS_OKMERGE` takes a finished RGB layer (`uLayer`). `glRender` starts
  from `glColorTex`, skipping the shared `FS_PAL` and composite `glPostChain`.
- **Menu grouping**: `buildFilterUI` groups by `filterGroup(f)` — feedback + post-minus-Bloom are
  ONE group ("Per-effect · heat, trails & image"), Bloom + screen are "Whole scene · final image".
  Works only because registry order keeps that run contiguous.
- Canvas2D fallback untouched: one item, one palette.
- `STACK_MAX` is declared up by the canvas/GL setup (TDZ — `initGL` allocates per-layer buffers).

**Point items own the tick loop**: one `beginHeatTick()` per tick, then every point item stamps and
blits (`glPtCount` reset per item), `curHeat = pendingDst` once at tick end; shader items draw once
per frame after. `stampTick(L, now)` is the reusable stamp half. No point items and no retention ⇒
**`glClearHeatCurrent()`**, *not* `glBeginHeat`'s no-chain branch.

**Canvas2D fallback renders ONE item** (first unmuted) — mirrors assign rather than MAX.

**Zoom applies to CONTENT, never the finished picture.** Shaders divide coordinates by `zoom`
(`bakesOwnZoom`); point effects **`plot()`-scale about the grid centre before stamping**, composed
with the camera 2×2. The fractal rasterises at full grid resolution; out-of-grid points drop.
- `zoomPoints()` multiplies count by `zoom²` at the one choke point in `stampTick`, capped at
  `CONFIG.tuning.zoomPointCap` = **8**.
- **`stackZoom()` is always 1** ⇒ `FS_ZOOM` is an identity blit and the CPU zoom block is dead. Both
  kept deliberately.

**A single-layer scene never touches `mergeLayers`** — `applyBlob` calls it only when `saved.layers`
exists. Its else-branch must **seed `stack[0].filters` from the restored `extras[e]`**. Two
non-fixes: **do not add an `extras[L.fx]` fallback to `applyLayerExtras`**, and **setting live
`activeIds` does not survive** (`stackOut()` returns null for one item).

**Persistence: an optional `layers` array.** One item ⇒ **nothing emitted**. `mergeLayers` truncates
to `STACK_MAX`, drops retired effect ids, clamps gain, defaults blend, and runs every per-item map
through its own `merge*` **against that item's own effect**. Items omitting `palette`/`filters` fall
back to the top-level `extra`. `installShared` re-seeds a single-item stack. **`blendOk`/`gainOk`
are function declarations, not const arrows** (a const TDZ there aborts startup and surfaces as a
confusing later TDZ on `nextSwitch`).

`?stack=plasma,tunnel` — dev hook, never persisted.

### Scene collections
A preset carries an optional **`collection`** (the published profile it came from), riding **beside
`name`**, **not** part of `snapshotScene`. **Must be listed explicitly in `validatePresetList`** —
that mapping rebuilds each preset from an object literal, so anything missing is dropped on every
cloud load and gallery install.

**The gallery installs a collection instead of merging**: `applySharedLibrary(raw, replace,
collection)` stages `pendingRestore`, and `applyRestore` has a third branch — drop every preset
carrying that collection, append the incoming ones stamped with it. `out.curPreset` matches the
sender's selection **within that collection**. One button (`Load scenes`).

**`#preset` is the hidden value store**; `#presetlist` is visible, built by `buildPresetList()` (a
`<select>` cannot collapse an `<optgroup>`). Called from `rebuildPresetOptions`, from `applyPreset`,
and from the `change` handler's `-1` branch — miss one and the highlight goes stale.

**`openCollections` is a transient Set starting empty.** Your own group is always emitted, even
empty. `dropCollection` re-finds the selection **by identity** after filtering.

**Your own group is labelled with your profile name, cached for the FIRST paint.** `myProfileName()`
reads `#cloud-name` then falls back to **`PROFILE_NAME_KEY`** (`burnTheWeb.profile.v1`)
*synchronously*. **`setProfileName(v)` is the one way the name is set** — writes field, cache, and
calls `buildPresetList()`. Its own key, **not** part of `cloudSess`. `myCollectionLabel()` =
`myProfileName() || DEFAULT_PROFILE_NAME` (`"burnTheWeb"`); `sceneTitleFor` uses `myProfileName()`
**without** the default.

**`p.rotate`** — per-scene auto-cycle checkbox. `inRotation(p)` is `!(p.rotate === false)` —
**absent means IN**; `setRotation` *deletes* the key rather than writing `true`. `rotationPool()` is
rebuilt per tick; nothing ticked ⇒ the cycler **idles**. `setRotation` calls `persist()` but **not**
`autosavePreset()`. Like `collection`, **not** in `snapshotScene` and **must be listed in
`validatePresetList`**. The row is a `.pl-row` with the checkbox **beside** the `.pl-scene` button;
its click `stopPropagation()`s. Every `.pl-scene` is a real saved scene.

**`autosavePreset` must carry over every field that rides beside `name`** (it rebuilds from
`snapshotScene()`, which captures none of them). Adding such a field means editing **three** places:
`autosavePreset`, `validatePresetList`, and wherever it is set.

### Presets & persistence
**User-facing word is "scene"; the code word is "preset".** Nothing in the code or wire format was
renamed (`presets`, `curPreset`, `kind: "preset"`, `#preset`, `.presetrow`, every `*Preset*`).
Consequences: **`HELP.sliders[].n` must match the rendered label text** (`ctlHelpBlurb` looks up by
`ctlLabel(key)`), and `safeFileName`'s empty-name fallback is `"Scene"`.

A preset = `snapshotScene()`: `{name, effect, state, beat, pulse, plen, cam, sceneFx, beatTune,
ranges, ttl, tdur, extra, layers}`. The globals are deliberately carried, because anything missing
renders as the recipient's value: `cam` (in no effect's `defaults`), `sceneFx` (lives nowhere in an
effect's state), `beatTune` (different thresholds = different animation), `ranges` (`mergeState`
does **no** bounds check and `loadState`'s `el.value =` is DOM-clamped), `ttl` + `tdur` (installed
via `applyPresetDual`).

`applyPreset` applies `ranges` **first**, then `ttl`/`tdur`. `presetprobe` asserts every restored
field is one `snapshotScene` captures *and* one the import mapping carries.

**Does not travel**: resolution (`cfg.scale`), audio on/off, the `randSeed` re-roll, the
`Date.now()` chaos seed, every accumulated phase.

**First-visit library** built once when `presets.length === 0`: `defaultPresets()`, applied at index
0, then `persist()` once. It is **`DEFAULT_LIBRARY` — THREE scenes**: `Fetingen` (Sierpiński, single
layer), `Round and round` (Moiré, two layers), `Julia shapes` (AnimeJulia + Bouncing shapes, two
layers, `xor` blend).
- **Wire format** (effect ids), so a registry reorder cannot remap them, and every map is kept
  **whole**. Re-export from the app and paste over to change them.
- `defaultPresets()` runs it through `deserializeBlob`, which drops any scene naming a retired
  effect; if that took the lot it falls back to **`perEffectPresets()`** (backstop only), so the
  library can never be empty and break the always-something-selected invariant.
- **`function defaultPresets(` is a `presetprobe` slicing marker** — keep the name and keep it
  directly after `snapshotScene`.

**Creating a preset, adopting a shared scene and restoring a backup all `stopCycling()`.**
`applyRestore` can't (it reloads), so it writes `out.cycle = false` **last**.

**Switching effect stays on the selected preset and folds the change into it** — three lines:
`setEffect`, `autosavePreset`, `persist`. A preset named after its original effect keeps that name;
**intended**. `presetprobe` asserts this structurally.

**THERE IS NO "unsaved scene" — something is ALWAYS selected**: `presets.length >= 1` and
`0 <= curPreset < presets.length`. **`ensureSelection()`** is the single choke point; `curPreset =
-1` survives only as the bootstrap declaration and `applyBlob`'s empty-library fallback, and
`presetprobe` fails if a third site appears. A stored blob or link carrying `-1` resolves to scene 0.
- **The corollary is the whole risk: selection and live state must AGREE.** `autosavePreset()`
  writes on every edit, so any path that changes the selection while leaving a different picture up
  overwrites the newly selected scene on the next slider move. **Delete** and **`dropCollection`**
  therefore call `applyPreset`, and a settings-only restore lands on scene 0 *and applies it*.
- Deleting the last scene **re-seeds** the shipped library.
- **A shared link is kept**, as a scene in a `"Shared with you"` collection (`SHARED_COLLECTION`).
  `installShared` only parks `pendingShared`; **`adoptSharedScene()`** does the library write. That
  split is mandatory: the legacy `?s=` path calls `installShared` **synchronously mid-slice**, three
  slices before the preset code exists and before `restore()` has built the library.
  `adoptSharedScene` is idempotent and is called from the startup epilogue (covering `?s=`) and from
  the `?z=`/`#c=` handlers. Only `#c=` has a real name (the `/scenes` doc's `name`); the rest fall
  back to `"Shared scene"` — **`bumpName` only when it is taken**.

Presets are **local to the browser**; selecting one links edits to it (`onEdit` →
`autosavePreset()`, no manual save). `mergeState()` normalizes against `presetState(e)`;
`mergePulse()` does the same for `pulse`. **All four of `applyPreset`'s maps must go through
`merge*`** — `mergeState`, `mergeBeat`, `mergePulse`, `mergePlen`. **`classList.toggle("on",
undefined)` *flips* the class**, so `loadBeat` spreads over an all-false base and `syncChips`
coerces with `!!`.

**Beat chips are `<button>`s — no `input`/`change`, so `onEdit` cannot see them.** `chipEdited()`
calls `autosavePreset()` (guarded on `persistReady && !applyingPreset`) then `persist()`.

- **Storage**: `localStorage["burnTheWeb.v1"]` = `{states, beats, pulses, plens, extras, effect,
  ranges, beatTune, presets, curPreset, cycle, ttl, scale, panelOpen, audio}`, built by
  **`fullSnapshot()`** — the definition of "everything we remember". `persist()` and Backup
  serialize exactly that. `applyBlob(saved, sharing)` applies `ranges` + `beatTune` **first**, then
  validates every value against those bounds. Anything not in `fullSnapshot()` is transient.
- **Custom slider ranges** are saved: `RNG_ORIG` captures shipped bounds up top (before
  `restore()`), `collectRanges()` stores only differences, `applyRanges()` sets them back. They ride
  in `localStorage`, the share URL and Backup.

### Share / bundle / backup codecs
**Everything that DECODES must keep working forever.** `?z=`/`?s=`, `#zp=`/`#sp=`, `#c=` all still
open, landing in the **Restore dialog**.

- **`?z=`** — JSON → `CompressionStream("deflate-raw")` → **base64url**. `?s=` (plain base64) is
  emitted when `CompressionStream` is missing and **decoded forever**; `?z=` is checked first,
  mutually exclusive. Values rounded to `CONTROLS.step` then **clamped to live bounds**
  (`applyBlob`'s `ok()` hard-rejects). Decoding is **async**, landing after startup's `setEffect`,
  so the promise re-activates with `resize()` + `setEffect(…)`. `shareUrl()` is async; Share copies
  via `ClipboardItem`'s promise form so the gesture survives the `await`. `stripShareParam()` runs
  at startup.
- **Encodes only the CURRENT scene** — `{states, beats, pulses, plens, extras, effect, cam,
  beatTune, ranges}`, one entry per per-effect map. Map *shape* unchanged (`{[effectIndex]: …}`), so
  old all-effects links still decode. `cycle`/`ttl` dropped.
- **`pruneBeats()`/`prunePulses()` prune against the descriptor's defaults, not all-false.**
  Share-only; `fullSnapshot()` stays verbose. Works **only because `applyShared` re-seeds first**.
- **Short link**: `shortenUrl(url)` POSTs to `tinyurl.com/api-create.php` (301s byte-for-byte, CORS,
  no key, doesn't block `github.io`; is.gd/v.gd reject all GitHub domains). It signals failure with
  **200 + an error string**, so validate the response shape.
- **Preset bundles**: `libraryUrl(chosen)` = `serializeBlob({presets, cycle, curPreset})` → deflate.
  **Rides in the URL FRAGMENT — `#zp=` (fallback `#sp=`), never a `?query`** (a multi-KB query gets
  **414** from Pages/Fastly before any JS runs). Recipient: `applyShared()` checks the fragment
  **first** → **`openSharedLibrary`** → `normalizeBackup` → `deserializeBlob` →
  **`validatePresetList`** → Restore dialog. A **file** restore forces auto-cycle off; a **link**
  honours the sender's toggle (`__link` gates it). `applyRestore` stashes the preset index in
  `sessionStorage["btw.applyPreset"]`; startup reads it once.
- **Ordering trap**: `openSharedLibrary` lives in `persist-backup-restore.js` but `applyShared()` is
  called during the earlier `audio-tuning-data.js` load, so `pendingRestore`/`openRestore` are in
  the TDZ. The async `#zp=` `.then` lands after all slices; the sync `#sp=` path must be deferred
  the same way (`Promise.resolve().then(…)`). Same for `#c=`.
- **Backup** = one file per preset + `_settings.json`. `backupFiles()` builds `[{name, text}]`; each
  preset file is `{app, kind: "preset", version, preset}` through `serializeBlob`. `curPreset` is
  **not** in `_settings.json`. Delivery splits on `showDirectoryPicker`: Chromium writes
  `BurnTheWeb/<YYYY-MM-DD_HHMM>/`; everything else downloads **~150ms apart** and **flattens**.
  - Folder handle lives in IndexedDB (`burnTheWeb.fs`); `backupRoot()` reuses it while permitted.
    **Shift-click Backup forces a re-pick.** A write failure calls `bkClear()`. **`bkStore` must
    always resolve** — a throw inside an IDB event handler hangs Backup forever.
  - **`safeFileName`** strips path separators, Windows-illegal chars and control codes, trims, drops
    trailing dots/spaces, escapes device names (`CON`, `NUL`, `COM1`…), truncates to 80, falls back
    to `Scene`. `backupFiles` de-duplicates with ` (2)`. Pinned by `presetprobe`.
- **Restore** takes **multiple files**. `normalizeBackup()` folds every shape ever written into one
  and runs **before** `deserializeBlob`. `openRestore(parsed, valid, name)` shows a checkbox per
  part plus merge-vs-replace (**Presets is not always enabled** — `_settings.json` alone is
  legitimate). `applyRestore()` starts from `fullSnapshot()`, overrides ticked parts, writes
  `localStorage`, **reloads**. (`location.reload` is non-configurable in Chromium — tests read
  `localStorage` synchronously and stash the verdict in `sessionStorage`.)

**Backup / Restore buttons are gone from the menu**; the cloud profile is the way in and out. Only
the file/link *creating* half was removed. `libraryUrl`, `shortenUrl`, `backupFiles`, `safeFileName`
and the IndexedDB helpers are **deliberately kept** (pure builders, probe-pinned);
`validatePresetList` and `normalizeBackup` are live — the cloud path uses them.
**Share came back by request as `#sharepreset`** in the Scene box's button row (wired in
`persist-presets.js`): `cloudShareScene()` → the ~30-char Firestore `#c=` link, `?z=` fallback when
signed out or on any cloud failure. The copy uses **`ClipboardItem`'s promise form** (claim the
clipboard inside the click gesture, before the async link resolves), then `writeText`, then
`prompt()` — the link is never silently lost.

### Cloud profiles (Firebase Auth + Firestore, over REST)
`src/cloud-profile.js` is the whole client; `firestore.rules` is the whole security boundary.

**No Firebase SDK** — `fetch()` against `identitytoolkit` (exchange a Google ID token),
`securetoken` (refresh), `firestore` (the document). The one remote script is Google Identity
Services for the sign-in button. **`CONFIG.cloud.apiKey` is a kill switch** (like
`CONFIG.analyticsId`): empty ⇒ row hidden, no script injected, **no request at all**.

**The payload is one deflated string, not Firestore structure.** `cloudBlob()` builds a
`libraryUrl()`-shaped blob through the same `serializeBlob` + `zipToB64` — **same codec, same decode
path**, so a downloaded profile goes straight to `openSharedLibrary(raw)`. Since 1.14.0 the CONTENT
differs on purpose (borrowed presets filtered, plus a `collections` field `libraryUrl` never emits)
— a filtered superset of the shape, NOT the same bytes. **What must never diverge is the
codec/decode path itself**; `cloudprobe` asserts it structurally.

**Rules are the only defence** (the web API key is public by design, there is no backend). They
carry the size caps a server's body limit would provide, and `hasOnly()` pins the document shape.
`firestore.rules` is checked in; its header lists the nine cases to verify in the Rules Playground.

Tokens: id token ~1h, refreshed **60s early**; a 401 mid-flight refreshes and retries **exactly
once**. Session tokens live under their own `localStorage` key, **not** the scene blob.

**"Share this scene"** stores the scene in Firestore, returns `#c=<docId>` (~12 chars). Signed out
or refused ⇒ falls back to `?z=`; the cloud route is an optimisation, not a gate. Payload is
**`sceneBlob()`, split out of `shareUrl`**; the recipient path is `installShared`.

**Shared scenes live in `/scenes`, NOT `/profiles`.** World-readable, created only by a signed-in
user stamping their own uid as `owner`, **immutable** (`allow update: if false`), deletable by their
owner.

**`cloudApplyPayload(payload)` is the ONE place a stored payload becomes a library** — unzip → parse
→ `openSharedLibrary`. `cloudLoad` is its only caller today; the seam is kept deliberately.
`cloudprobe` pins it.

**ONLY THE CURRENT VERSION IS STORED.** A profile is one document; a save replaces it. No version
history (shipped 1.13.0, removed 1.13.1 — a snapshot was a copy of the *whole library*, not a delta).
- **Deleting a scene locally already removes it from the cloud** — `cloudBlob()` is built from
  `fullSnapshot()` and the write is a full replace. A deleted scene survives only in `/scenes` share
  links, immutable by design.
- **`cloudBlob()` sends YOUR scenes only — except `"Shared with you"`**, which uploads like your own
  work (an adopted link scene has no source profile to re-fetch from). Every other preset carrying a
  `collection` is dropped. What rides instead is **`collections`**, the list of `{key, uid}` you
  hold. A borrowed collection with **no follow entry** is noted **uid-less** before its scenes are
  dropped, and `refollowCollections` resolves it by name; never clobber an entry that has a uid.
  `curPreset` indexes the array being sent, so it is **remapped, not copied**, falling back to 0.
  `cloudSave` refuses only when there are **no scenes AND no follows** — a follow-list alone is a
  legal, count-0 document.
- **`collectionsHeld` is declared in `audio-tuning-data.js`, filled from `persist-presets.js`**
  (`noteCollection`/`forgetCollection`/`collectionsOk`, function declarations so they hoist).
  `restore()` runs at the foot of that earlier slice, so a `let` beside the functions is in the TDZ
  on **every reload that carries the field** — the same split as `cpuBlocked`. **The follow is noted
  INSIDE `applySharedLibrary`, after validation passes** (galLoad hands the uid through).
  **`delpreset` calls `forgetCollection` when the delete empties a collection**; its confirm says a
  partially-kept collection refreshes on load (the follow model, not a bug).
- **`refollowCollections(raw)` puts them back, INSIDE `cloudApplyPayload`** — before anything is
  applied, so the whole load stays **one `applyRestore` and one reload**.
  - **Appended, never prepended** — `curPreset` indexes that array.
  - Each fetched scene is **re-stamped with the key YOU follow it under**.
  - A collection **already present in the payload is not re-fetched**.
  - A source that is gone/unpublished/corrupt is **skipped and named**; it resolves `{raw, missed}`
    so the caller can report without `cloudMsg("")` wiping it. Sequential.
  - **A uid-less entry is resolved by NAME against `galList()`** (the collection key IS the source
    profile's name). One listing covers every such entry; a healed uid is **written back into
    `raw.collections`**. Still unresolved ⇒ `missed`, by name — a `c.uid &&` filter would make
    uid-less entries doubly invisible.
  - `galFetchLibrary(uid)` is the shared fetch→unzip→parse, split out of `galLoad`.
- **`applyRestore`'s MERGE matches on `(name, collection)`, not name alone** — else a borrowed
  "Sunset" overwrites yours. Identical for anything with no collections (every key is `""`).
- **`sharedLibrary` carries `collections` through**, and `applyRestore` writes it **only when
  `__ownCloud` is set** (and `coll` unset). `__ownCloud` comes from **`cloudOwnLoad`, an
  out-of-band `let` beside `sharedLibrary`** that only `cloudApplyPayload` sets and the next
  `sharedLibrary()` consumes — **never from the payload**, which is attacker-authored JSON.
  **Merge mode UNIONS the follow-lists** (local wins unless the incoming one has a uid the local
  lacks); Replace replaces.
- `firestore.rules` still carries a **read-and-delete-only** `snapshots` block: those documents are
  owner-only and **Firestore does not cascade-delete**, so without it anything written while the
  feature existed would be permanently unreachable *and* undeletable. Drop the block once satisfied
  nothing is left.
- Two general lessons: **a subcollection does NOT inherit `match /profiles/{uid}`**, and **Firestore
  does not cascade-delete** — any subcollection needs an explicit sweep before its parent goes.

**`installShared` hands its scene to the library**: it parks `pendingShared` and
`adoptSharedScene()` files it under `"Shared with you"`.

**The gallery applies a row straight away — no Restore dialog.** Rows offer *Load and merge* / *Load
and replace*. **`applySharedLibrary(raw, replace)` does not reimplement the apply** — it stages
`pendingRestore` + checkbox state and calls `applyRestore`. `sharedLibrary(raw)` is the shared
decode+validate half.

**The gallery is browsable signed out** — `galFetchJson` uses a plain keyed `fetch`, not
`cloudFetch`, and Browse sits *outside* `#cloud-authed`. **`cloudPublish` re-saves the whole
profile** rather than patching `pub` (the rules require name/payload/count).

**The listing survives a missing composite index**: `pub == true` + `orderBy updated` needs one; a
fresh project answers 400 `FAILED_PRECONDITION` with a creation URL. `galList` retries **unordered**,
logs the URL once via `console.info`, and **sorts in both cases**. The query `select`s away
`payload`. Cached for `CONFIG.cloud.galleryTtlMs`; `galBust()` clears it.

### Audio & beat reactivity
`audio` holds the WebAudio graph; `startAudio("capture"|"mic")` must run inside a user gesture. With
audio on and a chip armed, `updateAnims()` stops that slider drifting — it rests at the low thumb
and snaps to the high thumb on each beat. `armAudioResume()` re-opens the last source on the first
post-load gesture.

**Mute is `audio.muted`; the split from `audio.on` is the design.** `♪` (and the **S** key — `M` is
the menu) → `toggleMute` → `setMuted`, which **never touches the stream**; `audioTick` early-returns
instead.
- `audio.on` = **a stream is open**. "Is audio reaching the visual?" is **`audioLive() = audio.on &&
  !audio.muted`** — four sites: `stepAnim`'s `armed` (the important one), `flashChips`'s `lit`,
  `frame()`'s `updateMeter`/`flashChips`/`clearBeats`, the `audio-off` class. Still reading
  `audio.on`: Capture/Mic lit state, `armAudioResume`, `fullSnapshot`'s last-live-source.
- `setMuted` zeroes `pulse`/`energy`/`beatNow` and calls `updateMeter()` + `flashChips()` **once** on
  the way down. `stopAudio` clears `muted`. `audio.muted` is **transient**.
- Same `♪` glyph in both states; `.muted` adds `line-through` (never changes width or baseline).

**`audioTick` is an ONSET detector, not an energy detector — don't "simplify" it back.** Per band it
computes **spectral flux** (sum of positive bin-to-bin changes since the previous tick):
- **Float, linear magnitudes** — `getFloatFrequencyData` → `10^(dB/20)`; a ratio test on the byte
  spectrum is a ratio in log space. **`smoothingTimeConstant = 0`.**
- **Adaptive threshold + peak picking**: a beat is a *local maximum* above
  `median(last ~1s) × beatCfg.fluxK[b]` and above `beatCfg.floor × recent peak`, with a per-band
  refractory. Causal — inspects the *previous* tick (one 10ms hop of latency).
- **Bands are narrow on purpose**: 30–150 / 150–2500 / 2500–12000 Hz, mapped by `computeBins`.
- **Thresholds are per-preset scene data.** `beatCfg` (defaults `BEAT_DEFAULTS`, both in the detector
  constants block) holds per-band `fluxK`, global `floor`, per-band `refract`, `bands`.
  **`mergeBeatTune(saved)` has replace semantics.** **`installBeatTune` writes fields in place,
  never replacing the object** (`audioTick` closes over it; `beatprobe` slices it out). It re-runs
  `beatBuild()` and `computeBins()` (the latter only when `audio.on` — it throws before audio
  starts).

**`audioTick` runs on `setInterval(HOP_MS)` (100Hz), not rAF.** Beats are **latched** in `beatNow[]`;
`frame()` calls `updateAnims()` then `clearBeats()`. `audioTick(t)` takes an optional timestamp for
fake clocks.

**Beat tuning** lives in `<details class="box" id="beatDetails">` (per-preset scene data, must
autosave). CSS scoped to `#beatDetails`.
- `beatChanged` must **not** `persist()` (the delegated `onEdit` already does). `beatReset` is a
  click, so it persists + autosaves by hand.
- **`RNG_ORIG` and `refreshRangeUI` skip `#beatDetails`** — the generated sliders have no `id`, so a
  scan writes `RNG_ORIG[undefined]` and `collectRanges` emits a junk key into every blob.
- **`beatUi` is a `var`** (like `card`) — `installBeatTune` reads it during startup before the
  declaration.
- `applyPreset` rebuilds the sliders (`beatBuild`), so any reference held across a preset switch is
  a **detached node**.

### Dev tools
No Diagnostics section. The **beat trace** (`?debug=1` or the Beat tuning checkbox; `dbgInit` builds
a floating canvas of flux + threshold + beat ticks per band, lane labels from `beatCfg.bands`) lives
in the Beat tuning box. The frame/FPS counter has no toggle — `H` drives it via `body.ui-hidden`;
`#frames.hidden` survives in the CSS as the mechanism `?hideui`/`H` use.

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
ticks/sec, capped 4/frame) while render/morph/beat run every frame. Phase clocks accumulate per tick
from the live speed, never the wall clock. Clicking the canvas toggles `paused`.

### Determinism
Chaos game uses a **mulberry32 PRNG re-seeded to `SEED` every frame** — the point *sequence* is
identical each frame; only moving geometry reshapes the fractal. Auto-morph uses `Math.random()`,
kept separate.
- **AnimeJulia**: `juliaOuter/juliaInner` default 0, set by `reseedJulia()` — a random lap when the
  per-effect **Random seed** toggle (`randSeed`, an `extras` field, default on) is on, else 0.
  `setEffect` calls it on every entry.
- **Attractor jitter**: the de Jong map is exact; `atjit` scatters each point by ±jit heat pixels
  from `Math.random()` (clear of the chaos PRNG). The `jit > 0` guard keeps jitter 0 byte-identical.
- **Don't add a fixed-seed toggle for the jitter.**

## Config & control gotchas

`cfg = { points, speed, decay, scale, burn }`. Sliders wired via `bindRange(id, valId, fmt, apply,
durScale, beat)`, registered in `anims`; `updateAnims()` drives drift between the thumbs.
`bindRange`'s `ui()` reads `lo.min`/`lo.max` **live** (bounds are runtime-editable) and uses them for
precision: **a range spanning more than 1 shows at most one decimal**. Rounding applies to the value
handed to `fmt` and is **readout only** — the applied value stays a free float.

- **Flame rise** is linear in flame *height*: `decay = 128 * R / (R - 1)`.
- **Drift speed** slider ÷ 100 → `cfg.speed`.
- **Rotation** slider is degrees/second → rad/s (`rotSpeed`), accumulated into `spinAngle` per tick
  (independent of drift speed and burn rate).
- **Tetrafyer has two rotations**: `Rotation` yaws (`spinAngle`); pitch is `nodAmp·sin(nodPhase)`
  behind **Box nod** (degrees) and **Nod speed** (×). **`nodPhase` accumulates per tick**
  (`NOD_RATE · nodSpd · cfg.speed / cfg.burn`), never derived as `0.12·simT`. At `nodSpd` 1 it
  tracks `0.12·simT` exactly.
- **Palette** bakes into a `Uint32Array` in **little-endian ABGR**. **Banding is a filter over the
  active palette**, not a palette.
- **A preset switch always blends the palette in from what was on screen** (no snap); **where it
  blends to depends on the cycle** — cycling on ⇒ a fresh random palette, pinned ⇒ the palette the
  preset **stored**. `applyPreset` snapshots live `paletteBase` *before* `setEffect`/`loadExtra` can
  overwrite it, then `beginMorph(fromRamp, morphing ? pickOther(...) : +paletteSel.value)`.
  `beginMorph` paints `fromRamp` into `paletteBase` immediately and arms the blend; `morphOnce =
  !morphing` makes it one-shot. A manual pick or plain scene load clears `morphOnce`.
- `cfg.scale` changes need `resize()` to reallocate buffers.
- **Reset** restores the current effect's `state`/`beat`/`pulse`/`plen`/`extra` **and the shipped
  bounds** (`rngShipped` over every key in `presetState(effect)`, **before** `loadState`, then
  `rngSyncAll()`). Current effect only.

## Testing (no framework — headless verification)

- **Syntax check** each `<script>`: `node -e "...new Function(scriptText)..."`.
- **Assertion probe**: inject a `<script>` into a temp copy that manipulates the DOM, asserts and
  reports; screenshot with `msedge --headless=new --screenshot=out.png --virtual-time-budget=N
  file:///…`; Read the PNG.
- Results come back **either** as a result `<div>` styled
  `position:fixed;inset:0;background:#fff;color:#000` (unstyled it renders under the canvas and a
  red run looks clean) **or** via `console.log` captured with `--enable-logging=stderr --v=0` —
  `--dump-dom` returns nothing in the installed Edge. Add `--disable-extensions`, or an extension
  delays `load`.
- `{bubbles:true}` on synthetic events. Seed `localStorage` **before** the app. Auto-morph off
  before asserting palette. `setInterval` advances under `--virtual-time-budget`; `document.hidden`
  may read true. Analytics are inert on `file://`/`localhost`.

**Headless runs WebGL2 on the REAL GPU by default — prefer that.** Drop `--disable-gpu` and the
SwiftShader flags entirely: on this dev machine (RTX 4090) four effect screenshots take ~12 s where
SwiftShader took ~10 min, and heavy raymarchers render fully. Assert `gl.getError() === 0` and a
console-error count of 0 (a failed link is otherwise silent — `useProgram(null)` just draws
nothing).
- **SwiftShader remains the fallback** for machines without a GPU and for the bit-reproducible pixel
  gates: `--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`, ~8–15 fps. The stall
  traps below apply ONLY under SwiftShader.

**SwiftShader is why probes HANG** — virtual time only advances when the task queue drains:
- **Do not add a layer from a probe** (two live layers switch on `renderStackColor` and the frame
  loop stops yielding). Test per-layer UI by toggling classes.
- **The shipped `DEFAULT_SCENE` is a FOUR-LAYER stack, so a fresh profile starts on the heavy
  path.** Anything that keeps it on screen for the run stalls — stopping auto-cycle is enough,
  because the cycler is otherwise what moves you onto a cheap single-layer scene. **For a DOM-only
  probe, stub rAF in `<head>`** (`requestAnimationFrame = () => 0`, or let ~4 frames through so the
  app initialises).
- **Never `while (...) el.click()`** — bound every drive loop.
- Kill stray `msedge*` first, **including `msedgewebview2`**.
- **A Git Bash path is not a `file://` URL.** `file:///c/Users/…` loads Chromium's "File not found"
  page, which *passes* every "did it finish" check instantly. Use `file:///C:/Users/…`.

**A probe-generator script must contain no backtick** anywhere in the injected source (comments
included) when that source sits in a template literal — it closes the literal, node dies, and **the
previous probe page is silently reused**. Same class: `\n` in that literal becomes a real newline.
Use `String.fromCharCode(10)`, or keep the injected source in its OWN file and `readFileSync` it
(sidesteps both). Check the generator printed its "wrote" line.

**The app is one IIFE, so an injected `<script>` cannot call into it.** DOM/menu/`localStorage`
assertions work from the page; anything needing an internal function must be a Node probe that
slices the source.

**Test a CSS regression WITHOUT the app**: inline `src/styles.css` into a bare page with a synthetic
node and read `getComputedStyle`. Prove the check is sensitive by re-appending the old rules and
watching it go red.

**Five traps when screenshotting ONE effect** (each produced a confident wrong reading):
- **Turn auto-cycle off first** (`#cycle`), and assert the effect is *still* the one under test at
  screenshot time.
- **`gl.getError()` must be sampled inside a real frame** (afterwards it returns a spurious `0x502`
  from the probe's own `readPixels`). Pixel evidence must be the screenshot, not `readPixels`.
- **`?stack=<id>` does not survive a fresh profile** — the first-visit branch installs
  `DEFAULT_LIBRARY`'s first scene over it.
- **The shipped scenes are not headlessly renderable under SwiftShader** (`Fetingen` runs the fire
  sim, `Round and round` is two layers). Verify the library through the DOM.
- **Keep the run under 30s of active time** or `SYNC_DELAYS[0]` opens the nudge over the canvas.
  `?credits=0` doesn't clear credits in a slow run (`creditLeft` counts *rendered* time).

**The pixel gate is BISTABLE — a single mismatch is inconclusive.** No-filter Plasma matches ~9/10;
Plasma + Fire ~3/4. **Re-run a mismatch 2–3 times.**

**Pixel gates: shader effects only.** With a stubbed rAF (own the callback queue, fixed 1/60 step)
shader effects are bit-reproducible; **point effects are not** — gate those on logic. **Inject
before the app**, into `<head>`. **Do not clear the rAF queue** — `frame()` re-arms itself. Stub
`Math.random`; read pixels with `readPixels` in the **same task** as the last frame.

**A green logic probe is necessary, not sufficient**, for anything writing retained heat — drive a
few hundred real frames and look at the screenshot.

**Credits overlay**: read `#creditcv` itself (`getImageData`, count alpha > 8), not the composited
frame; assert the layer properties (own canvas, `pointer-events: none`, z-index above `#fire`, under
the menu). **The claim to nail: credits never touch heat** — zero `fire`, put credits up, call
`creditDraw()`, assert the buffer still sums to zero. **Never diff heat with credits up vs down**
(`simT` advances between runs).

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
- **`presetprobe.js`** — structural: every `p.<field>` `applyPreset` restores is one `snapshotScene`
  captures *and* one the import mapping rebuilds. Behavioural: `mergeBeatTune` replace semantics +
  junk rejection. Also pins `safeFileName`, `normalizeBackup`. Markers: `const BEAT_DEFAULTS` …
  `const beatCfg`; `function mergeBeatTune(` … `function installBeatTune(`;
  `function snapshotScene()` … `function defaultPresets(`; `function applyPreset(` …
  `function createPreset(`; `function validatePresetList(` … the comment that replaced the old
  import button.
- **`heatprobe.js`** — parity is invisible to a screenshot. Chains of 0–4 passes from either buffer:
  `pendingDst` names the buffer the *last* pass wrote, no pass samples its own render target, the
  final FBO is still bound on exit. Also pins **`glLayerBeginHeat`**. Markers:
  `function glBeginHeat(` … `function glBlitPoints(`; `function glLayerBeginHeat(` …
  `function renderLayerHeat(`.
- **`juliaprobe.js`** — rim point matches the cardioid formula; the seed sits exactly `juliaInnerR`
  off it; the inner phase advances at `ratio ×` the outer, `ratio` epicycles per lap; `juliaOffX`
  shifts only the real axis; each of the three descriptors advances the orbit **once** per frame.
  Markers: `const RPM` … `function julia(`.
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
- **`singleprobe.js`** — `SINGLE_KEYS` is exactly the intended 23 (hard-coded, so nobody quietly
  adds `points`); every single entry is a `dual` on a whole grid with `lo === hi`; each enum's
  `fmt` names every integer it can now hold; `snapStep` quantises with step 1 and still passes
  through with `"any"`; `stepAnim` on a pinned pair draws **zero** `Math.random`; `singlePair`
  and `mergeState` collapse a stored spread/fraction and leave ranged float keys alone. Markers:
  `const sig3 =` … `// A control belongs to the SCENE`; `function snapStep(` …
  `function stepAnim(` … `// The loop is KEY-major`; `function mergeState(` … `function mergeBeat(`.
- **`shareprobe.js`** — the share codec round trip.
- **`cloudprobe.js`** — the cloud path structurally shares `serializeBlob` + the codec with `#zp=`
  bundles; an empty `CONFIG.cloud.apiKey` makes zero network requests at startup.
