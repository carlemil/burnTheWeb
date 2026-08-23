# Changelog

All notable changes to [burnTheWeb](https://carlemil.github.io/burnTheWeb/), newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the version
numbers follow [Semantic Versioning](https://semver.org/):

- **patch** (1.1.**x**) — fixes and copy changes, nothing new to find in the menu.
- **minor** (1.**x**.0) — a new effect, filter, control or panel feature.
- **major** (**x**.0.0) — a change that stops an existing saved scene, share link or backup
  from loading exactly as it did. There has not been one, and the intent is that there never
  is: every link ever generated still decodes.

The version shown at the foot of the menu is `CONFIG.version` in `src/config.js`, which is
the single source of truth; `/deploy` bumps it and adds the section below in the same commit.

## [1.37.1] — 2026-08-23

### Fixed

- **The page hung at startup in 1.37.0.** The shared-3D-world shader was being compiled at
  boot, and with all five effects in it the graphics driver took over a minute to link — the
  page sat on a black screen with no error. It is now built only when a scene actually ticks
  **Share one 3D world**, only for the effects that joined, and in the background: the joined
  layers draw themselves for a moment and the shared world appears once the driver is ready.
  Startup is back to a few seconds, and scenes that never use the world never build it.

### Internal

- `tools/startup-check.sh` — a wall-clock startup gate, now part of `/deploy`. This bug was
  invisible to every existing check: no error, DOM fine, probes green, and the headless
  browser checks passed too because their virtual clock waits through a synchronous stall.
  Only real seconds see a hang: 4 s on this build, 69 s on 1.37.0.

## [1.37.0] — 2026-08-23

### Added

- **Three more effects can join the shared 3D world**: **Bouncing solids**, **Quaternion
  Julia** and **Vector balls**, alongside Ocean and Glass ball. Tick **Share one 3D world** on
  any two and they are traced as one scene — solids bobbing in the sea, a 4D Julia solid
  standing in it, a formation of vector balls hanging over it, each hiding the others where it
  should and each appearing inside the glass ball's reflections in its own colours. One layer
  of each kind per world. The effects you fly *inside* — Mandelbulb, Menger sponge, Doughnut —
  still cannot join: they put the camera in their own geometry, so there is nowhere for them to
  stand in anyone else's.

### Changed

- **The snap grid is easier to see** while you drag a box or a panel — thicker lines, brighter
  against a lit scene.

## [1.36.0] — 2026-08-23

### Added

- **Share one 3D world** — a new per-layer tick on **Ocean** and **Glass ball**. Turn it on for
  both and their geometry is traced as **one scene** instead of two separate pictures: the balls
  really sit in the water, refracting and reflecting it, reflected back in it, hidden by the
  waves in front of them, with a real waterline cutting across them. **Place X / Y / Z** and
  **World scale** say where each layer's geometry stands (the water is at height 0), and the
  camera comes from the lowest layer that has joined — its Camera X/Y/Z, Zoom and Field of view
  now move the whole world.
  Each layer keeps its own palette, so the water seen inside the ball is tinted like the ball.
  Off by default, so every scene you already have is unchanged; the effects you fly *inside*
  (Mandelbulb, Menger sponge, Doughnut) cannot join, since they have no shared viewpoint.

### Changed

- **The Ocean's Reflection slider does more.** Up to 1 it behaves like water, weighted so the
  reflection concentrates toward the horizon; **above 1 it lifts toward a flat mirror**, which is
  there because a camera this close to the surface sees the near sea too steeply for the physical
  amount to show. The slider now reaches 2, and the shipped setting is unchanged.

## [1.35.0] — 2026-08-23

### Added

- **The snap grid is visible while you drag**, and it is the **editor's own grid** — it starts
  at the panel's right edge, one column is exactly one box wide, and the rows divide the
  panel's height, so everything you place lines up with the menu instead of with an arbitrary
  fraction of the window.
- **Every floating panel can be moved**, not just the slider boxes: the **Orbit editor**, the
  **Palette editor** and **inspector**, the filter/palette/transition pickers and the dialogs
  are all dragged by their **title bar** onto that same grid. Drag one past the middle and it
  re-aligns to the near edge and grows inward; double-click its title bar to give the
  placement back.

### Changed

- **Field of view now works on the point effects too** — Sierpiński, Tetrahedron, Attractor,
  Fractal flames, Harmonograph, Galaxy, Boids and Trees. Those stamp a position rather than
  sampling one, so the lens runs backwards for them, which is what makes a stamped layer and
  a shader layer bow the *same* way at the same setting. A wide lens pulls a stamped picture
  in from the corners (expect dark edges where a shader effect would simply show you more); a
  long one folds the far field out of the frame entirely.
- **The palette fold chevron matches the layer chevron** — same size, glyph and position at
  the head of its label, so the two folds read as the same control.

## [1.34.0] — 2026-08-23

### Changed

- **Scene transitions no longer freeze the scene you are leaving.** Both sides of a blend
  run: the outgoing scene keeps animating all the way out instead of becoming a still
  photograph the moment you switch, so a dissolve is now two live pictures rather than one
  live one over a frozen one. Nothing to set — every transition mode gets it, and there is no
  measurable cost to the frame rate.

## [1.33.0] — 2026-08-23

### Added

- **Break-out boxes go anywhere.** Drag a popped-out slider box by its title line and it
  snaps to a grid over the whole screen, so the controls you are working can sit beside the
  thing they change. Drag one **past the middle and it re-aligns to the near edge and grows
  inward** — a box parked in a corner stays in that corner however tall it gets. Double-click
  its title to send it back to the column beside the menu.
- **Shape thumbnails in the box.** Polygon, Concentric rings, Shape grid, Bouncing shapes,
  Bouncing solids and Vector balls now show a small picture of the shape their sliders make,
  at the top of every one of that effect's boxes — so "Sides 7, Thickness 0.3" is a
  seven-sided ring you can see rather than one you have to imagine.
- **The Triggers section folds away.** The chevron on a box's **Triggers** heading collapses
  the beat wiring — Shape, Duration, Tuning **and the L/M/H chips** — even while a band is
  armed. The coloured dot on the menu row still shows the slider is wired to the beat, so
  nothing is hidden that you need.

## [1.32.0] — 2026-08-23

### Added

- **Field of view** — a new per-layer camera slider, beside Camera X/Y/Z. Positive bows the
  middle of the frame outward into a fisheye and drags the corners in; negative flattens it
  into a telephoto; 0 is the normal lens. It works by moving where each pixel takes its colour
  from, so it costs nothing and applies to every shader effect, and it is per layer — one
  layer can bulge while another stays flat. Drift the two thumbs and the layer breathes.
  Not offered on the point effects (Sierpiński, Trees, Boids and the rest), which stamp points
  rather than sampling a coordinate.
- **Ocean: Wave height and Reflection.** **Wave height** is real geometry now, not shading
  (see below). **Reflection** mirrors the layer underneath the water, concentrated toward the
  horizon the way a real reflection is — put the Ocean on top of another layer and that layer
  appears in the sea.

### Changed

- **The Ocean's waves are really three-dimensional.** The surface is intersected ray by ray
  instead of being painted onto a flat plane, so crests now hide the troughs behind them, the
  horizon breaks up in a heavy sea, and Swell and Wave height change the shape of the water
  rather than only its lighting.

## [1.31.0] — 2026-08-23

### Added

- **Doughnut** — a new effect: the inside of a torus, flown along the tube. The wall wraps
  the whole frame and the curve of the ring keeps bringing new surface into view, so you are
  always about to round a bend you can never quite see past. **Flutes** cuts lengthwise
  grooves into the pipe and **Twist** winds them into a spiral (0 flutes gives a smooth pipe);
  **Ring radius** bends the tunnel, **Tube radius** tightens it around you, and **Speed** runs
  the flight — negative flies it backwards.
- **Trees** — a new effect: a row of fractal trees bending in a wind. The sway is added at
  every joint rather than to the tree as a whole, so it accumulates from trunk to tip and the
  twigs whip while the trunk barely moves. **Arm Sway's L/M/H chips and the trees gust on the
  beat.** **Depth**, **Splits**, **Branch angle** and **Taper** shape the tree; it stamps into
  the fire buffer like the other point effects, so a Fade or Fire filter turns the moving tips
  into trails.
- **Glass ball** — a new effect: raytraced spheres that **reflect and refract the layers
  underneath them**. Put it on top of another layer and the balls pick that layer's picture
  up — **Metal** mirrors it, **Glass** bends it through and turns it over inside the ball,
  **Bubble** is a thin shell that rings hard at the edge. **Refraction** is the glass's
  density. On its own it falls back to reflecting a procedural room, so it still stands up as
  a single layer. What it reflects is brightness, so everything comes back in this layer's own
  palette.

### Internal

- `tools/dnutprobe.js` and `tools/treeprobe.js` — the properties a still frame cannot show:
  the Doughnut camera never enters the wall at any slider setting and its flute pattern closes
  across the atan2 branch cut (a fractional Twist tears it, which is why Twist and Flutes are
  whole numbers); the Trees segment budget cannot be multiplied past its cap, the canopy is
  scaled to the frame at every Taper, and the sway really does accumulate — measured as tip
  travel against trunk travel.

## [1.30.0] — 2026-08-23

### Added

- **The palette section folds away.** The `▾` beside **Palette** in a layer's block collapses
  the swatch strip, Reverse colours, Background and the palette-cycle sliders down to the
  heading — the tallest run of furniture in the block, and the first thing you stop needing
  once the colours are settled. It folds every layer at once, and like the other folds it is
  not remembered across a reload.

### Changed

- **Auto-cycle now pauses while the scene editor is open**, so a scene is never swapped out
  from under you mid-edit. Hide the panel (**M**, or **H** for all the chrome) and the show
  runs again. Your **Auto-cycle scenes** tick is never touched — only the timer is held — and
  closing the panel starts a fresh hold rather than switching the instant you do.
- **A first visit now opens with the panel closed**, so the scenes that ship with the app run
  as a show straight away. If you have used the app before, your saved open/closed state still
  wins. The tutorial's "Two menus" step opens the editor with **M** to match, and says why the
  scenes stop changing while it is up.

### Internal

- `tools/foldcycle-check.js` — a browser check (14 assertions over three seeded profiles) for
  the cycle gate, the fold and the first-visit default. Half of it was written, measured
  against a build with the feature deleted, found to pass anyway, and removed: after a mid-run
  toggle a headless page renders two frames in twenty virtual seconds, so "nothing happened"
  is not evidence. CLAUDE.md now carries that as a rule.

## [1.29.0] — 2026-08-23

### Changed

- **Mandelbulb is now flown from the INSIDE.** The camera no longer orbits the silhouette
  at arm's length — it threads the canyons between the lobes, with the fractal closing over
  your head. **Orbit speed** is how fast that flight winds through it (0 parks you, still
  inside), **Glow** lights the walls and haloes a ray that only just misses, and **Power**
  reshapes the structure around you as it drifts. Existing Mandelbulb scenes load with every
  slider exactly as saved; what changed is where the camera stands.

### Fixed

- **Eight control groups showed the word "undefined" as their section heading** — Galaxy,
  Harmonograph, Vector balls, Ocean, Black hole and Quaternion Julia, plus the Hex pixelate
  and CRT phosphor filters. All eight are named now, and a group that ever loses its name
  again falls back to something readable instead.

### Internal

- `tools/bulbprobe.js` — 17 assertions flying the real camera solver on a fake clock:
  clearance held, never embedded in a wall, no teleports at any orbit speed or frame rate,
  the flight contained in the shell, deterministic, per-layer (the escape offset rides
  `PHASE_VARS`, so two Mandelbulb layers cannot share one camera), and the camera solving at
  the same iteration count as the surface it dodges. Every one of those is a failure a
  screenshot passes.

## [1.28.0] — 2026-08-14

### Added

- **"My shared links"** in the cloud box (☰ → Cloud profile, signed in). Every scene you
  share as a short `#c=` link is now remembered on this device: the list shows what you
  shared, **Copy** re-issues a link, and **✕ deletes the shared scene from the cloud**, so
  the link stops opening for everyone holding it. Until now a shared link could never be
  taken back. Links shared before this release can't be listed (nothing recorded them) —
  only new ones. **Delete profile** now also removes the shared scenes this device knows
  about.

### Changed

- **Saving to the cloud can no longer silently overwrite a newer copy.** If another device
  (or another tab) saved after this browser last looked, Save now stops and tells you —
  **Load** to keep the cloud copy, or press **Save again** to deliberately replace it.
  Previously the last writer always won without a word, and even ticking **Publish to
  gallery** on a freshly signed-in machine could wipe a real library with the starter
  scenes.
- **A library over the cloud's 500-scene cap now says so** before uploading, instead of
  failing with a bare permissions error.

### Fixed

- **Shared scenes no longer pick up the recipient's beat tuning.** If you had tuned a
  slider's own beat thresholds, opening someone else's shared scene silently applied *your*
  tuning to *their* scene. A shared scene now arrives with its own (or the shipped)
  detector tuning throughout.
- **Saved palette choices are now stored by name, not position.** A share link or backup
  that used a custom palette could end up showing a *different* palette after custom
  palettes were added or deleted, because the reference was "the Nth one". Palettes now
  travel under stable ids (every old link and scene still loads exactly as before), so a
  saved scene keeps meaning the ramp it was saved with.
- **A corrupt or malicious share/cloud payload can no longer freeze the tab.** Compressed
  payloads are decompressed under a 10 MB budget; one that expands past it is refused like
  any other corrupt link. The Firestore rules were also tightened (gallery timestamps must
  be real and near-current), and the gallery's sort index is now deployed, removing a
  failed request on every uncached gallery open.

### Internal

- The data-model review's structural hardening: one `migrateBlob` funnel for every
  legacy-shape fix (both load paths); single-layer scenes load through the same
  `mergeLayers` reader as stacks; one `MAP_DEFS` registry for the six per-effect maps;
  the retired `sceneFx` field is no longer written into every blob (old ones still decode).
  Two new probes — `stackprobe` (freeze/thaw lifecycle + fullSnapshot↔applyBlob symmetry)
  and palprobe's palette-id codec section — plus pins for the cloud precondition and
  shared-link retraction; the suite is now 13 probes / 758 checks. `persist()` reports
  non-quota failures instead of swallowing them.

## [1.27.1] — 2026-08-11

### Fixed

- **Blank canvas no longer plays in the auto-cycle show.** It seeded with the cycle checkbox
  ticked like every other scene, so a fresh library's show would periodically cut to a bare,
  motionless plasma and hold it for the full scene time — easy to read as the app hanging.
  It now arrives unticked; tick it in the scene list if you do want it in the rotation, and
  anything you build on top of it stays out of the show until you do.

## [1.27.0] — 2026-08-10

### Added

- **A "Blank canvas" scene**, at the bottom of the shipped scene list. One layer, no filters,
  a plain plasma on its shipped defaults — somewhere to start from nothing. Every other scene
  in the list is a finished picture, and changing a layer's effect deliberately keeps that
  layer's filter chain, so building something of your own previously began by taking a dozen
  filters off somebody else's scene.

  It arrives with the rest of the starter library, so it appears on a first visit or on a
  library you have emptied — an existing set of scenes is left alone.

## [1.26.0] — 2026-08-10

### Added

- **A first-run tutorial.** An eight-step tour of what the app is and how it works, which
  opens by itself the first time you visit — once the startup credits have burned away, and
  before anything asks you for audio. It lives at **☰ → Tutorial** afterwards, so you can
  read it again whenever you like. Where **Help** explains every individual control,
  this explains the shape of the thing: the two menus, scenes, layers, ranged sliders,
  filters, music, and sharing.
- **Six new effects**, bringing the total to thirty-eight:
  - **Quaternion Julia** — the Julia set done in four dimensions and raymarched as a solid.
    A 4D object can only ever be cut, not shown, so the shapes live in the two slice
    controls: **Slice** is where the cut falls, **Cut angle** turns the cutting plane itself.
    The seed rides the same cardioid orbit as AnimeJulia, so the Orbit editor drives it too.
  - **Black hole** — an accretion disk seen through its own gravity. The light is bent rather
    than drawn straight, so the far side of the disk arcs up over the top of the shadow and
    back under the bottom. **Tilt** is the camera's height (low is the iconic nearly-edge-on
    view), **Beaming** the relativistic boost that makes one limb far brighter than the other.
  - **Ocean** — a rolling Gerstner swell out to a horizon, with glinting crests and breaking
    foam. **Chop** sharpens the crests, **Wind** turns the whole sea. Amber and Ember make it
    a sunset; the cold palettes make it the North Sea.
  - **Vector balls** — the Amiga classic: a rigid constellation of shaded spheres tumbling in
    3D, as a **Lattice**, **Sphere**, **Ring** or **Helix**. The shape reads purely from how
    the balls occlude and shade each other.
  - **Harmonograph** — the Victorian drawing machine: two pendulums per axis, their sum traced
    by a pen. **Detune** is the trick — at exactly 0 the curve retraces itself forever, and a
    hair off it the figure precesses into a woven ribbon.
  - **Galaxy** — a disc of stars on log spirals with a bulge that burns white. **Arms**,
    **Twist**, **Scatter** and **Core** shape it; the arms trail the rotation, as real ones do.
- **Two new filters**, bringing the total to twenty-four:
  - **Hex pixelate** — the picture snaps to a honeycomb instead of squares. Hexes read as a
    deliberate screen where squares read as low resolution.
  - **CRT phosphor** — RGB shadow-mask triads and the electron beam's horizontal smear, which
    is the rest of the television beside Scanlines and Barrel.

### Changed

- **The microphone is armed by default.** With no audio source of your own chosen, your first
  click anywhere asks to listen through the mic, so music in the room drives the visual
  without you having to find anything. Say no, or press **Stop**, and it is never asked
  again — that decision is now remembered separately from "never chose".
- **Filters show themselves off when you add them.** Ticking a filter in the picker is how you
  find out what it does, and sixteen of them shipped so timid that adding one appeared to do
  nothing at all. Their defaults are bolder now.
- Oil paint's **Brush size** goes up to 6 (was 4), which is where the effect becomes obvious.

### Fixed

- **Shockwave did nothing when you added it.** Its **Shock** value *is* the ring's position,
  and it defaulted to 0 — the ring already gone off the edge of the screen. It now sweeps.
- **Clicking in the tutorial no longer raises the browser's "Choose what to share" picker.**
  If your last session had audio capture running, the first click anywhere re-opened it — and
  on a first visit that click is the tutorial's own **Next** button.

### Internal

- New `galaxyprobe.js` pins the two Galaxy properties a still frame cannot show: that the arms
  trail, and that they stay arms rather than winding themselves out of existence.
- `juliaprobe` now discovers the cardioid effects from the registry instead of naming the
  three that existed, so a fourth cannot quietly break the once-per-frame seed rule.
- `filterprobe` compares Fire's seeded Flame rise against the registry rather than a
  hard-coded number, which is the claim it was actually making.
- `uiprobe`'s dialog table covers the tutorial, so it is checked against every list a dialog
  has to appear in.

Scenes saved before this load exactly as they did: a saved scene carries its own value for
every filter setting, so the bolder defaults apply only to filters you add from now on.
Nothing about an existing scene, share link or backup changes.

## [1.25.0] — 2026-08-08

### Added

- **Every slider with a trigger armed detects its own beats now.** Open a slider's box, arm an
  **L/M/H** chip, and a **Tuning** section appears at the foot of it with that slider's own
  **Sensitivity**, **Floor** and **Refractory**. So a kick can hammer one parameter while a
  slower, choosier trigger swells another off the same band — which was not previously
  possible, because every armed slider shared one set of thresholds.
- **Rows follow the global settings until you move one.** Each row shows the inherited value
  marked **global**; moving it makes it that slider's own and the mark clears. It is per
  setting, so giving a slider its own Refractory leaves its Sensitivity following the global.
  The **↺** on the Tuning heading hands the whole section back.

### Changed

- **Beat tuning is now called Global beat tuning**, because it is no longer the only beat
  tuning there is — it is the set of defaults every un-tuned slider follows.

### Fixed

- **A slider's Refractory only affects that slider.** It used to write into the scene-wide
  value, so tuning the gap between beats for one slider silently retuned every other armed
  slider in the scene — the one control that looked most obviously local was the least.
- Chips light on the beats their own slider actually reacted to, rather than on every beat in
  the band, so a slider you have deliberately made choosy no longer flashes as though it had
  fired.

Scenes saved before this load exactly as they did, with every slider following the global
settings; nothing about an existing scene, share link or backup changes.

### Internal

- `beatprobe` gains 14 assertions driving the real detector on a fake clock, headed by the
  property everything rests on: with nothing overridden, a slider's beats are the scene-wide
  beats tick for tick. Eight reintroduced bugs were each confirmed to turn it red.
- `presetprobe` now also checks that every field a scene *saves* is one it *reads back* — the
  silent direction, where the data is stored and quietly discarded on every scene switch.

## [1.24.1] — 2026-08-08

### Fixed

- **The Orbit editor now draws the Burning Ship's own set behind the seed.** Burning Ship
  folds each step to its absolute value, so the seeds that give a connected, intricate
  fractal are a different set from the Mandelbrot one the editor was showing — it reaches
  further right, and unlike every Julia/Multibrot locus it is not symmetric about the
  horizontal axis. Over the seed path this effect actually ships with, roughly a quarter of
  the loop sat on the wrong side of the boundary the picture drew, so the editor showed the
  seed sailing clear of the set at exactly the moments it was deepest inside it — which is
  what makes the fractal go solid. The view is also centred on the set in both directions
  now, so the ship sits in the frame instead of low in it. **AnimeJulia and Multibrot are
  unchanged**, down to the pixel.
- The seed's **path** is untouched: it still traces the Mandelbrot cardioid, which is
  deliberate and is what **Outer radius** (shipped high, 1.4–1.9, for this effect) is tuned
  around. Only the set drawn underneath it was wrong.

### Internal

- `tools/juliaprobe.js` gains 16 assertions covering the editor backdrop: the escape test is
  checked against references written from the shipped shaders, the two loci are shown to
  differ and to disagree along the seed path, and the framing is pinned to be exactly
  unchanged for symmetric loci.

## [1.24.0] — 2026-08-08

### Added

- **The ☰ menu works from the keyboard.** Opening it steps into the first item; ↑/↓ move,
  Home/End jump to the ends, ▸ opens a submenu and steps into it, ◂ comes back out, and Esc
  closes and returns you to the button. ◂ is left alone inside a submenu's own controls — on
  the Resolution dropdown the arrows still change the resolution.
- **Dialogs behave like dialogs.** The four that dim the page behind them — Help, Restore,
  **Public scenes** and the music-sync nudge — now take the keyboard with them, keep Tab
  inside, and hand focus back to whatever you opened them from. The floating tool panels
  (**Orbit editor**, **Palette editor**, the palette inspector and the pickers) deliberately
  do not: they exist to be used while the scene keeps running.
- **The Orbit editor is 30% bigger** (and its Mandelbrot backdrop is drawn at full resolution
  for AnimeJulia and Burning Ship, so the boundary is sharp instead of soft). The extra size
  is drawing precision — a freehand loop gets more control points across the same curve.
- **"Hide all UI" now tells you how to undo it.** Stripping the chrome also stripped the line
  naming the **H** key, so a brief note says it and fades out — and it never appears on the
  `?hideui` URL, which exists for clean captures.
- **Restore from backup has a × like every other dialog**, instead of only Cancel.

### Changed

- **The panel tools fit a narrow window.** The filter, palette and transition pickers, the
  palette editor and the palette inspector used to be pinned beside the controls panel
  whatever the screen width, which squeezed them to a strip on a phone; below ~760px they now
  centre. Pop-out slider boxes become a row along the bottom instead of a column running off
  the edge.

### Fixed

- **Esc now closes every dialog.** **Public scenes** and the music-sync nudge could only be
  dismissed with the mouse.
- **H (hide all UI) no longer leaves the Help panel or the Restore dialog on screen.**
- **The Orbit editor keeps working while the scene is paused.** Switching between Cardioid,
  Circle and Freehand, editing points, Undo and Clear all changed the orbit but left the
  picture frozen, so the whole panel looked broken. It now repaints as you use it — including
  following the pointer while you draw a freehand loop, which is exactly when you would pause.
- **Removing the only layer no longer asks first and then does nothing.** A scene always keeps
  one layer, so the ✕ on the last one is properly greyed out rather than raising a
  confirmation for something that cannot happen.
- **Buttons that look unavailable now really are.** Greyed-out controls — **+ Add layer** at
  four layers, the Orbit editor's freehand-only buttons, the palette editor's stop buttons —
  ignored the mouse but still responded to the keyboard.
- **The Orbit editor's title sits flat on the panel again** instead of on a black bar, and the
  Orbit editor and music-sync titles no longer scroll away from their own close button.

### Internal

- New `tools/uiprobe.js` (143 assertions): every dialog is checked from one table against each
  of the lists it has to appear in — Esc, hide-all-UI, the sticky-header rules and the header
  padding — because each of those had silently lost a dialog. Every fix above was confirmed by
  reintroducing the bug and watching the probe go red.
- `/deploy` runs every probe in `tools/`; its hand-kept list had drifted five behind.

## [1.23.3] — 2026-08-08

### Fixed

- **Deleting a palette no longer lands on one you had already deleted.** Removing a shipped
  ramp from your strip and then deleting the palette you were actually using could drop you
  straight back onto the removed one — gone from the swatch strip and from **Palettes in
  use**, but selected. The fallback now walks the strip in the order you see it, starting
  from the palette you deleted, and takes the next one that is still there: the neighbour you
  were looking at, never a deleted ramp and never whatever happened to be first in the list.
  If that leaves your in-use set empty, the palette you land on is ticked back on, so the
  strip always shows something and the palette cycle always has somewhere to go.

### Internal

- New `tools/palprobe.js` pins palette deletion — display order versus array order, the
  neighbour rule, the preference for a palette in use, the never-empty in-use set, and the
  index shifting after a custom palette is removed.

## [1.23.2] — 2026-08-07

### Changed

- **Palettes, effects and the filter catalogue read alphabetically now.** The swatch strip
  and the **Palettes in use** dialog, the effect dropdown on every layer, and the **+ Add
  filter** catalogue are all listed by name instead of in whatever order they were built in
  — with two dozen effects and thirty-odd filters, hunting through a fixed order was the
  slow part of building a scene. The catalogue keeps its **Heat & trails** / **Image**
  captions in pipeline order and sorts inside each, and **the filters you have added stay in
  chain order** — that list is the running order, so it is never re-sorted.

### Fixed

- **Deleting a palette lands on one you actually use.** Any layer or scene pointing at the
  deleted ramp fell back to the first shipped palette, even if you had unticked it — so it
  could land on something the strip does not even show. It now falls back to another palette
  that is in use, and only to the first in the list if none is; the confirm names the one
  you will get.

## [1.23.1] — 2026-08-07

### Removed

- **"Delete selected" is gone from the Palettes in use dialog.** Deleting a palette is the
  ✕ on its own row, where the thing you click names the thing you lose; the button acted on
  whichever swatch happened to be highlighted behind the open dialog, leaving the confirm as
  the only clue what it was about to remove. Deleting itself is unchanged — custom palettes
  go for good, shipped ramps only leave your strip and picker and come back with **Select
  all**, and one palette always remains.

## [1.23.0] — 2026-08-07

### Changed

- **Sliders that pick a thing are one whole number now, not a range.** Fractal flames'
  **Variation**, Mirror's **Axis**, Pixel sort's **Direction** and Bouncing solids' **Shape
  mix** — plus every small count (Sides, Segments, Bars, Bolts, Columns, Curtains, Ball
  count, Detail, States, Brush size, Sim speed …) — now show a single thumb that snaps to
  whole values. A "Variation 2–5" used to drift across four unrelated warp functions, and a
  fractional segment count could leave a kaleidoscope wedge that didn't close. Twenty-two
  sliders in all; they no longer drift or take trigger chips, and your saved scenes, share
  links and backups all keep loading — a stored range simply settles on its low value.
- **Densities stay smooth.** Anything that scales rather than counts — Shape grid's
  **Density**, Concentric rings' **Ring count**, Ring density, Tile density, Multibrot's
  **Power** — keeps its two thumbs and its free-floating value, and Shape grid's Density now
  drifts smoothly instead of stepping.
- **Fractal flames stays lit through a morph.** The additive picture used to fade toward
  black mid-morph, when the attractor spreads thin; it now measures how dense the orbit
  actually is each tick and lifts thin phases back up, leaving dense ones exactly as they
  looked.
- **Fractal flames' Points** starts at 12 000 and runs 2 000–30 000, a range that suits an
  additive stamper rather than the one shared with every other point effect.

### Internal

- Effects can declare their own bounds for a slider (`ranges` on the descriptor) instead of
  widening the shared control for everyone; the load path validates a stored value against
  the owning effect's bounds.
- New `tools/singleprobe.js` (116 assertions) pins the single-value set, the whole-number
  grid, the no-drift guarantee and the collapse of an older stored range.
- `CLAUDE.md` compacted a second time — rationale stripped, every rule kept.

## [1.22.0] — 2026-08-07

### Added

- **Edit a band's refractory right where you arm its trigger** — arming an L/M/H chip in a
  slider box unfolds the trigger kit, ending in a **Refractory (ms)** slider per armed
  band: the minimum gap between beats, the same value Beat tuning edits (both stay in
  sync). Sub-titles are now just Shape / Duration / Refractory.
- **Delete shipped palettes too** — the "Palettes in use" dialog's ✕ (and Delete selected)
  now work on the built-in ramps as well, down to a single remaining palette. Scenes and
  share links that use a deleted shipped ramp keep rendering — it only leaves your strip,
  picker and cycle — and **Select all brings the shipped palettes back**.

### Changed

- **Slider boxes reorganised**: min/max/step fold into a collapsible **Value range**
  section (closed by default, with its own ? explaining what they do); the whole trigger
  kit — Shape, Duration and Refractory — folds out as **one element** when a trigger is
  armed; and the always-visible **reset slider** row closes the box behind a divider, ↺ at
  the right edge. Duration's bound field is named **limit** (it isn't the slider max).
- **Unarmed trigger chips are visible now** — each carries a tint of its band colour
  (L blue, M green, H red) instead of the old colourless grey; armed keeps the full fill
  and glow. With audio off they also desaturate, so the states stay tellable apart.
- **A round of consistency fixes from a full UI review**: Objects is one compact
  `− value +` row; the palette-inspect button is a magnifier (the eye now always means
  visibility); Beat tuning wears the same warm theme as the rest of the panel; the scene
  name heading reads "Scene · <name>"; the filter-stage divider is one short line; armed
  beat dots are brighter; the Palette editor and inspector dock beside the panel like the
  pickers; the menubar's help entry is simply "Help".

### Fixed

- **The black band behind the "Palettes in use" and Palette editor titles is really gone**
  — the previous fix survived headless screenshots but not real GPUs (a backdrop blur
  nested inside the box's own blur composites toward black); the titles now paint nothing
  at all and scroll with the content, while the × stays put.

## [1.21.0] — 2026-08-07

### Added

- **Delete custom palettes from "Palettes in use"** — every custom palette's row carries a
  ✕, and a **Delete selected** button sits beside Create new for the currently highlighted
  palette. Both ask for confirmation first, naming the palette and what scenes using it
  fall back to; built-ins can't be deleted (Delete selected dims and explains instead).
  Scenes and layers that used the deleted ramp are safely re-pointed.

### Fixed

- **Dialog title bars are translucent again** — the sticky titles of "Palettes in use",
  the Palette editor and the other picker dialogs painted a near-opaque band that read as
  a black bar over a bright scene. They now match their box's transparency, with a strong
  blur keeping the title legible while a list scrolls beneath it.

## [1.20.0] — 2026-08-07

### Added

- **Create new palettes by name** — the "Palettes in use" dialog (the "+ Choose palettes"
  tile at the end of the swatch strip) has a **Create new** button: name your palette
  (required), and the editor opens on a simple red→green→blue starting ramp, selected live.
- **Trigger duration gets an editable max** — a `max` row under the Trigger duration
  slider re-bounds it up to 30 s, for slow falls like Shockwave rings or long lightning
  strikes. Values above the old ceiling now survive reloads and scene switches.

### Changed

- **The swatch strip is quieter** — the `+` that sat on every built-in swatch (make an
  editable copy) is gone; only your custom palettes carry a button there (✎ to edit).
  Creating palettes lives in the picker now, and the strip's end tile says what it does:
  "+ Choose palettes".

## [1.19.0] — 2026-08-07

### Added

- **Share is back** — the Scene box has a **Share** button again: one click copies a link
  to the current scene. Signed in to your cloud profile it's a ~30-character short link
  (the scene is stored in the cloud); signed out it falls back to the classic
  self-contained link, so it always works. The recipient gets the scene filed under
  "Shared with you", as always.
- **Lightning storm rebuilt as fractal bolts** — each bolt is now a jagged, kinked fractal
  channel that **splits into side branches** on its way down, and a fresh strike **lights
  up from the cloud to the ground** behind a racing hot tip. New **Strike speed** slider
  sets how fast the bolt travels — drop it low to watch the tip crawl and the branches
  catch light. Every strike re-rolls its shape, roughness and forks.

### Changed

- **Visibility toggles are eyes now** — the layer mute button and each filter's bypass
  show an open eye (visible) or a closed eye (muted) instead of the filled/hollow dot.
- **Number fields got real steppers** — the tiny native up/down arrows inside min/max/step,
  the palette stop %, and the Beat tuning Hz fields are gone; each field now has a
  side-by-side ▲/▼ pair next to it, big enough to actually hit (the blend row's pattern).
  The slider bounds editor is one labelled row per field — min, max, step, and a Reset
  row.
- **Scene box buttons on two rows** — New/Rename above, Delete/Share below.
- **Palette cycle / Palette hold sliders re-ranged** — cycle now spans 0–2 s (step 0.05)
  and hold 0–10 s (step 0.1), for fine control where it's actually used. A scene that
  stored a slower cycle under the old 0–120 bounds clamps to the new max unless it saved
  custom bounds — the min/max editor on the slider restores any span.
- **Removing a layer asks first** — the ✕ on a layer row now confirms, naming the layer's
  effect, before its settings, palette and filters are thrown away.

## [1.18.1] — 2026-08-06

### Fixed

- **Palette editor: the colour-stop handles now really drag.** They always looked
  draggable, but the gesture died the moment it started, so a stop's position could only
  be typed into the % field. Drag a handle and the stop slides with the pointer — the
  gradient, the % field and the scene all update live, and dragging a stop past its
  neighbour swaps their order as you would expect.

## [1.18.0] — 2026-08-06

### Changed

- **Menger sponge — the flight is a whole new experience.** The camera no longer falls down
  one endless street: it **drives the fractal city**, running the corridors between the
  sponges, turning at intersections on a hash-picked route that never repeats — and most
  segments **dive through the sponges themselves**, swooping down into the carved tunnels
  and threading the narrow inner corridors with the walls rushing past on all four sides.
  About half the flight is now spent inside the objects. The whole path has continuous
  curvature (spline-smooth — no more little hitches every few seconds), the camera banks
  gently into each dive, and the route is mathematically guaranteed never to clip a wall at
  any Dive speed, Roll or Detail setting. Two Menger layers wander different routes.
- **The Camera section is always open** — the chevron is gone and the three sliders no
  longer start collapsed.
- **The picker dialogs dock beside the panel** — "Filters for this layer", "Palettes in
  use" and "Transitions in use" now open at the top-left, attached next to the menu boxes
  they came from, instead of covering the middle of the picture. Their title bar blends
  with the box (no more black band) and the × sits properly in the corner.

### Fixed

- **Reaction-diffusion no longer blacks out.** The dish died within a second at full frame
  rate: the seed pattern detonated (an annihilation wave burned outward from each blob),
  and the shipped Feed/Kill defaults sat in a dying regime of this simulation. The seed is
  now the canonical gentle one, the defaults (**Feed 0.030 / Kill 0.062**) are measured
  alive — the culture grows and keeps moving indefinitely — and a safety net watches the
  dish and **re-seeds it automatically** if a slider journey (or a beat-jumped Feed) ever
  kills it. Exploring is safe: nothing you do can permanently blank the effect.

### Internal

- GitHub Pages deploys via an Actions workflow staging only the site files — the preview
  page updates within ~a minute of a push instead of eight-plus.
- The Menger path is pinned by an offline clearance scan (222k steps, ~950 dives, jittered
  and backgrounded-tab frame times, both Detail extremes) plus a fine-dt smoothness scan
  proving the path has no positional discontinuities.

## [1.17.0] — 2026-08-06

### Added

- **Five new effects** — thirty-two in all now:
  - **Starfield** — a 3D starfield flying past on six parallax depths. Arm **Warp**'s beat
    chips and the kick punches to hyperspace, every star smearing into a radial streak.
  - **Aurora** — curtains of light hanging from the top of the sky, swaying and shimmering
    over a faint horizon glow. Ice, Electric and Verdant palettes were made for it.
  - **Reaction-diffusion** — a living Gray–Scott dish: two chemicals feeding and killing
    each other into spots, stripes, coral and mazes that never repeat. **Feed** and
    **Kill** choose the regime — arm Feed's chips and the beat pushes the culture into a
    new life. The dish re-seeds each time you enter the effect.
  - **Menger sponge** — an endless lattice of Menger sponges (the 3D Sierpiński carpet),
    raymarched while the camera dives through the holes with a slow roll.
  - **Boids** — a murmuration of up to 200 birds wheeling as one, each trailing a streak.
    Arm **Scatter**'s chips and every beat is a hawk that blasts the flock apart.
- **Three new filters**:
  - **Lens bubble** — a wandering fisheye magnifier, the classic demo lens.
  - **Droste zoom** — the picture swallows itself, every ring inward the whole image again,
    crawling endlessly toward the centre. Try it over Wedge fold.
  - **Oil paint** — Kuwahara filtering: texture flattens into brushy patches while edges
    stay crisp, the screen-print look.

### Changed

- **Power sweeps continuously on Multibrot and Mandelbulb.** Whole numbers still give the
  classic sets; the fractions in between morph one form into the next — drift Power's two
  thumbs apart and the fractal never stops reshaping. (Fractional Multibrots show a
  straight seam ray where the exponent's branch cut lies — a signature of the maths, not a
  glitch.) The Multibrot seed now rides a blend of the two neighbouring whole-power
  cardioids, pushed a little further out at fractional powers so the set keeps its
  filigree.

## [1.16.0] — 2026-08-06

### Added

- **Six new effects** — the biggest drop since layers:
  - **Kefrens bars** — the classic Amiga effect: vertical ribbons redrawn at a per-scanline
    phase offset, weaving impossibly through each other.
  - **Twister** — the classic twisting column, faces shaded by angle, up to three side by
    side and out of phase.
  - **Cymatics** — sand on a vibrating plate: bright lines trace a standing wave's nodes.
    Drift **Mode**'s thumbs for continuous morphing, or arm its beat chips and the figure
    snaps to a new symmetry on the kick.
  - **Lightning storm** — bolts tearing down the screen, every strike a fresh shape.
    **Rate** fires them on a clock; arm **Strike**'s chips and the beat fires them instead,
    each bolt decaying over its Trigger duration.
  - **Mandelbulb** — the 3D Mandelbrot, raymarched and slowly orbited. **Power** reshapes
    it, **Detail** adds fractal depth, **Glow** haloes the silhouette. The heaviest effect
    in the app — it wants a real GPU.
  - **Fractal flames** — an Apophysis-style iterated function system whose landing points
    **add** heat into a fading trail, so the dense heart burns white while the wisps stay
    faint. Six **Variation** folds; Swirl gives a nebula ribbon, Sinusoidal an electric
    fractal.
- **Two new filters**:
  - **Shockwave** *(added just after 1.15.0)* — a displacement ring rushing out from the
    centre. Arm **Shock**'s beat chips and every kick fires a wave; its Trigger duration is
    literally how long the crossing takes.
  - **Pixel sort** — the modern glitch: bright pixels smear into streaks along one
    direction, dark areas stay put.
  - **Cellular automaton** — the retained heat evolves as a cyclic CA, so boiling fronts
    and spirals crawl through whatever the effect draws.

### Changed

- The **Points** slider now reaches 24 000 (was 8 000) — Fractal flames' picture is point
  density, and the other point effects can use the headroom too.

## [1.15.0] — 2026-08-06

### Added

- **New effect: Sun surface** — the boiling surface of the sun, as the Inouye Solar
  Telescope filmed it: a full-screen field of bright convection cells split by narrow dark
  lanes, each cell drifting, deforming and brightening on its own slow cycle, with tiny
  bright points sparking in the lanes. **Cell density** sets how fine the boil is, **Churn
  speed** how fast, **Lane width** how fat the dark cracks are, **Brightness** how deep in
  the palette it sits — and **Sunspot** sinks a dark spot into the middle, a near-black core
  ringed by fine filaments radiating out into the granulation (0, the default, is the clean
  surface). It banding-stripes, beat-reacts, stacks and filters like every other effect, and
  opens in the Amber palette.

### Fixed

- **Scenes adopted from a share link now survive Save to cloud.** They live in the
  "Shared with you" collection, which has no source to re-fetch them from — 1.14.0's
  own-scenes-only filter dropped them from the upload, so a load on another machine lost
  them. They now save with your own scenes.
- **Collections you followed before 1.14.0 are no longer lost on your first save.** They are
  recorded in your follow-list as you save, and a profile load finds their source in the
  Public scenes listing by name — a source that has gone away is named rather than silently
  skipped.
- **Your follow-list can no longer be overwritten by a scene-bundle link** someone sends
  you; it only ever travels on a load of your own profile. Loading an older copy of your
  profile with **Merge** now keeps collections you added since, instead of reverting the
  list wholesale.
- **A follow-list with no scenes of your own still saves** — following people is worth
  syncing on its own; before, a collections-only library refused to save at all.
- **Deleting scenes from a followed collection is honest now**: the confirm says the
  collection comes back fresh on a profile load, and deleting its last scene stops
  following it, so an emptied collection stays gone.
- **A failed collection load no longer leaves a phantom follow** that re-fetched forever
  and could not be removed.
- **A popped-out Bloom/Scanlines/Vignette box no longer vanishes** when you select a layer
  whose filter chain doesn't include that filter — the filter is scene-wide and still
  running, so its slider stays put. It still hides once no layer runs it.

## [1.14.1] — 2026-08-05

### Fixed

- **Deleting a scene asks first, and names the scene it is about to delete.** **Delete** sits
  one button along from **Rename** in a row you click while working, and it removed the
  selected scene on the click with no way back. It now confirms — naming the scene, because
  the mistake worth preventing is deleting the wrong one. Delete your last scene and it tells
  you the scenes that ship with the app will be put back, since the list is never left empty.

## [1.14.0] — 2026-08-05

### Added

- **A third scene ships with the app.** A new visitor now starts with *Fetingen*, *Round and
  round* and **Julia shapes** — an AnimeJulia layer under bouncing shapes, blended with **XOR**.

- **The collections you follow travel with your profile.** **Load from cloud** on another
  machine now brings back everyone's sets you had added, fetched fresh at the time you load —
  so they arrive up to date rather than as they were when you saved. A collection whose owner
  has since removed or unlisted their profile is skipped and named; the rest still load, and it
  returns if they do.

### Changed

- **Save to cloud stores your own scenes only.** Scenes you loaded from someone else's
  collection are no longer uploaded: they are that person's to publish, and a copy in your
  profile would be counted on your gallery card and passed on again to anyone who loads you.
  They stay in this browser, and what your profile records is simply *which* collections you
  added — the names, not the work. Expect your scene count to drop to the number that is
  actually yours.

- **The beat dots on a slider's menu row are twice the size** and brighter, so you can read
  which bands a scene has wired to the music from further away.

- **Palette swatches are one per row** instead of two, giving each gradient the panel's full
  width and its name room to breathe.

- **The little amber "changed from default" dot is gone** from slider rows. On a real scene it
  marked nearly everything, so it read as clutter rather than information.

### Fixed

- **Bloom, Barrel distortion, Scanlines, Vignette and Film grain had no sliders at all** —
  expanding one showed an empty panel with no way to reach its settings. Fire was missing its
  **Burn rate** the same way. All six are back where they belong, in the filter's own section.

- **Delete profile now clears leftover version history.** The 1.13.0 history feature was
  removed in 1.13.1 along with everything that could delete what it had already stored, so
  those copies of your library survived a delete that reported success. They are swept now.
  *(1.13.1's note said all stored history had been deleted; that was only true of the profiles
  cleared by hand. The note has been corrected.)*

- **A borrowed scene can no longer overwrite one of yours** with the same name when you merge
  on load. Collections exist so that their *Sunset* and your *Sunset* are different scenes, and
  the merge now honours that.

### Internal

- `cloudprobe` gains five assertions pinning the snapshot sweep, and the collection filter and
  re-follow are covered by their own probes.

## [1.13.1] — 2026-08-05

### Removed

- **Version history is gone**, one release after it arrived. **Save to cloud** keeps only the
  current version of your library: a save replaces what is stored, and the previous copy is not
  kept. The **History…** button and its dialog have been removed. If there is a state you might
  want back, save it as its own scene — that is what the scene list is for.

  The reason is what a history entry actually was: a copy of your *whole library*, not a record
  of what changed. Keeping more of them, or keeping them more often, multiplied both the stored
  data and the work every save had to do, for something that duplicated what saving a scene
  already gives you.

  Your scenes are untouched, and nothing about saving, loading, sharing or publishing changes.
  The profiles known at the time were cleared by hand; **Delete profile** removes anything left
  over. *(Corrected after release — this originally said all stored history had been deleted,
  which was only true of the profiles that were cleared by hand. See 1.14.0.)*

## [1.13.0] — 2026-08-05

### Added

- **Version history for your cloud profile.** **History…** in the Cloud profile box lists every
  earlier version of your scene library. Each save files a copy under that day's date — save
  five times in an afternoon and that day still has one entry, the latest — and the most recent
  fortnight is kept. **Restore** opens an older version exactly the way **Load from cloud** does,
  so you still choose merge or replace before anything changes: it is a way to look at what you
  had, not a button that overwrites your work. **Clear history** empties it. Your history is
  yours alone — publishing to the gallery shares the library you have *now*, never the older
  versions behind it.
- **A mute dot on every filter.** Each filter in a layer's list has a dot beside it that switches
  it off without removing it: it keeps its place in the chain and all its settings, and the name
  is struck through while it is off. Previously the only way to switch a filter off was **✕**,
  which removes it — so working out what one filter was contributing meant deleting it and then
  rebuilding it. The dot is for looking, not for keeping: it is not saved with the scene.

### Changed

- **A new visitor opens on two scenes, not twenty.** The shipped library is now *Fetingen* and
  *Round and round* rather than one machine-named scene per effect, and the page opens on
  Fetingen. Your own library is untouched — this only changes what a brand-new browser starts
  with.
- **The controls panel is open the first time you visit**, so there is something to reach for
  rather than a bare canvas. Close it and it stays closed.
- **A link somebody sends you is kept.** Opening a shared scene used to leave it unsaved, so it
  vanished the moment you moved on. It now lands in a **Shared with you** group in your scene
  list — its own group, so it can never collide with or overwrite a scene of yours, and its **✕**
  removes the whole set when you are done.
- **The Camera sliders fold away**, closed by default: click **Camera** to open them. They are
  three settings you adjust once and then read past forever.
- **The selected scene's name is now a proper title**, at the size the dialog headings use, so it
  is obvious what every box below it is editing.
- **Your own scene group is called "Default scenes"** until you set a profile name, instead of
  repeating the app's name back at you.
- **The release-notes link at the foot of the panel is two lines** — the title over the version —
  instead of one long line that wrapped mid-sentence.

### Removed

- **"— unsaved scene —" is gone.** One scene is always selected now, so everything you change is
  always being saved into something. To experiment without touching a scene you like, press
  **New** first and work on the copy. **Delete** moves you onto the scene beside it, and deleting
  the last one brings the shipped scenes back rather than leaving you with an empty list.

### Internal

- Firestore rules gain an owner-only `snapshots` subcollection, verified against the live
  database: a published profile's history stays private, and share links stay unlisted.
- `presetprobe` grew to 67 assertions, pinning the always-something-selected invariant and that
  Delete applies the scene it selects rather than only highlighting it; `cloudprobe` to 44,
  pinning that history and profile loading share one decoder.
- CLAUDE.md compacted by a third, with the reasoning recoverable from git, plus two harness
  traps worth the loss of an afternoon: the shipped scenes stall headless SwiftShader, and a Git
  Bash path is not a `file://` URL.

## [1.12.3] — 2026-08-04

### Changed

- **Scene changes use a real transition more often.** "Cut" is no longer one of the transitions
  the app picks between — it is only the fallback, used when you have unticked everything under
  *Choose transitions*. It was previously weighted heavily whenever either scene carried trails,
  so those switches mostly snapped rather than blending. Everything else you have ticked is
  unaffected.
- **Audio and Resolution sit at the top level of the ☰ menu.** They were behind a "System"
  submenu, which cost an extra hover to reach the two settings the menu is mostly opened for.
  That submenu is gone; nothing else moved.

### Removed

- **"Cut" no longer appears in the *Choose transitions* list.** It was never a choice worth
  making — a cut is what you get when you turn everything else off — so ticking it alongside
  real transitions only diluted them. Untick every row and scene changes still cut, exactly as
  before.

### Fixed

- **A closed layer no longer shrinks when you select it.** Clicking a folded layer row dropped
  a few pixels off the bottom of its frame, so the row jumped as the selection moved down a list.

### Internal

- CLAUDE.md records why a headless probe stalls under SwiftShader — building a second layer
  switches on the per-layer colour path and the frame loop stops yielding, so the virtual clock
  never advances — and the probe-generator traps that silently reuse a stale test page.

## [1.12.2] — 2026-08-04

### Removed

- **The empty "Scene filters" box.** It held the whole-scene filters — Bloom and the four screen
  FX — until those became ordinary per-layer passes, after which it was a titled section with
  nothing in it. Every filter it used to hold is in each layer's own chain.

### Fixed

- The help text still described that box as where Bloom lives, and said most filters are
  per-layer rather than all of them. Both now say what the app actually does, including that
  where a filter sits relative to the line changes what it does.

## [1.12.1] — 2026-08-03

### Fixed

- **↺ and "Reset this effect" restore a slider's shipped range again.** Widening a slider and
  then resetting it put the value back but left the range widened. (Introduced in 1.12.0.)
- **Dragging a layer past the selected one no longer corrupts a layer.** The selected layer's
  settings were written onto whichever layer slid into its place, destroying one layer's
  settings and leaving two identical. This one predates 1.12.0.
- **An open slider box follows its layer when you reorder.** It stayed on the position and
  quietly started showing — and editing — whichever layer moved into it.
- **A layer's filter order survives a reload.** The chain came back in the app's own order
  rather than the one you dragged, which changes what the scene renders, not just how the list
  looks, because a filter above the effect shapes the heat and one below repaints the picture.
- **A single-layer scene keeps a widened slider range, and the value that needed it.** Both came
  back at their defaults after a reload.

## [1.12.0] — 2026-08-03

### Added

- **Any number of layers can be open at once.** Unfold layer 1 and layer 3 and both stay open,
  each showing its own effect's controls, its own filter chain and its own palette. Opening one
  no longer collapses another.
- **Pop-out slider boxes belong to a layer.** Layer 1's Speed and layer 3's Speed can sit open
  side by side, each titled with its layer, so two layers running the same effect are still
  tellable apart.

### Changed

- **Every layer starts folded**, and the chevron is the only thing that unfolds one — selecting a
  layer no longer opens it, since a click meant to reach one layer's controls should not
  rearrange the others. Unfolding still selects.
- **The pop-out column never empties itself.** Switching layers, changing an effect and loading a
  scene all leave it alone; a box whose control the layer no longer uses just hides itself. It
  used to clear on every one of those, which would have closed the very comparison you opened it
  for.
- Keyboard and assistive-tech edits now reach the right layer: focusing a control selects the
  layer that owns it, so a value typed or arrowed into a layer you had not clicked first sticks.

## [1.11.2] — 2026-08-03

### Changed

- **Every layer row has a fold chevron now**, in its upper-left corner — so the same control
  both opens a collapsed layer and closes the open one, instead of appearing only once you are
  already there.
- **Dialog titles and close buttons stay put while you scroll.** In a long list — the transition
  picker, the filter catalogue, the palette list — both used to scroll away, leaving no heading
  and no visible way out.

## [1.11.1] — 2026-08-03

### Changed

- **The layer fold chevron moved to the top-left**, beside the effect chooser — where the
  layer's headline is, rather than down in the mute/strength row.
- **Every chevron in the app is twice the size**: the panel sections, the scene collections,
  the filter rows, the ☰ submenus and the layer fold. They were small enough to be easy to
  miss and fiddly to hit.

## [1.11.0] — 2026-08-03

### Changed

- **Every filter belongs to a layer now.** Bloom, Barrel distortion, Scanlines, Vignette and
  Film grain used to act once on the finished picture; they are per-layer passes like all the
  others, so the **Scene filters** box is empty and every filter lives in the layer you put it
  on.

  Bloom is the interesting one — it was never really a filter, it *was* the glow the whole
  picture got, which is why it could not be per-layer before. Now each layer glows on its own
  before the layers blend, so a bright layer no longer smears the ones above it, and its place
  in the chain matters: a Vignette after Bloom darkens the glow, a Vignette before it does not.

  Two things to expect on a stack. If two layers both carry Scanlines the two rasters can
  interfere — put it on one layer for a clean result. And a scanline count is now lines across
  the render buffer, so at lower resolutions the same number gives a coarser raster.

  Scenes saved before this keep their look: whatever they had switched on whole-scene is folded
  onto their layers when they load.

### Added

- **A chevron folds the open layer's settings away** without deselecting it — with the controls
  inline, the other layers sit below the whole block, and this brings them back into view.

## [1.10.0] — 2026-08-03

### Changed

- **Scene TTL and Transition are global again.** They were remembered per scene, so picking any
  scene silently retuned your hold time and transition length underneath you — and that is the
  show's pacing, not any one scene's. Scenes saved while they were per-scene still load fine;
  their stored values are simply ignored.
- **The scene banner moved into the top button row**, beside the mute button, and is much
  smaller. It used to be painted into the picture itself, centred and large — it had to be, to
  stay readable over a bright frame. As part of the interface it does not: it is never touched
  by the filters or the camera, stays crisp whatever the render resolution, and costs the
  visual nothing.
- **Sliders whose range spans more than 1 now show at most one decimal.** Three significant
  digits suits a 0–1 knob and looks absurd on a wider one — Bloom read "0.00815×–1.5×" and now
  reads "0×–1.5×". Only the readout rounds; the value itself is unchanged.

## [1.9.2] — 2026-08-03

### Changed

- **The trigger shape picker has a title now.** It was an unlabelled dropdown tucked to the
  right of the L/M/H buttons — the only control in a slider box you had to hover to identify.
  It sits on its own row as **Trigger shape**, between **Triggers** and **Trigger duration**,
  which is where it belongs: shape and duration describe the same fall, one its curve and one
  its length.

## [1.9.1] — 2026-08-03

### Changed

- **A slider's min / max / step now sit directly under it**, instead of at the foot of the box
  below the beat controls — they describe that slider, so they belong with it. A divider
  separates them from the **Triggers** section below.

## [1.9.0] — 2026-08-03

### Added

- **The selected scene's name now shows in the panel**, as a heading just under the Scene box.
  The Scene box folds and its list scrolls, so the name could easily be off screen while every
  box below it was editing that scene. Reads *— unsaved scene —* when nothing is selected, and
  hovering it tells you whose collection a scene came from.

### Changed

- **The pop-out slider boxes read top-down now.** The slider sits directly under its own name
  and readout — it used to be below the beat buttons, which put three lettered chips between a
  control's label and the control itself.
- **The beat buttons have a title, "Triggers"**, instead of being three unlabelled letters.
- **"Pulse" is now "Trigger duration"**, with its title above its slider rather than beside it.
  Only the wording and the layout changed: every saved scene keeps its values untouched.

## [1.8.1] — 2026-08-03

### Changed

- **The Layers list lost its own frame.** With each layer now a box, and the open layer
  holding a third box for its controls, the border around the whole list was a fourth frame
  saying "these are layers" a second time. **Layers** is a plain section heading now — the
  rows sit directly under it, and nothing else about them changed.

## [1.8.0] — 2026-08-03

### Changed

- **Each layer is now one complete box.** The Layers list and the separate "Layer effect &
  filters" box were two halves of the same thought — a row in one place, the settings for it
  somewhere else. Click a layer and it opens out where it sits: its header across the top
  (which effect it runs, its on/off dot, its strength slider, remove, and its blend mode), and
  directly underneath, everything that shapes it — that effect's own sliders, then its filter
  chain, then its palette. The layers you are not editing stay as single compact rows, so the
  list still reads as a stack.

  One knock-on to expect: the other layers now sit below the open one's controls, so reaching
  layer three means scrolling past layer one's sliders. That is the cost of a layer being one
  object rather than two.

### Internal

- The controls are MOVED into the selected row, not duplicated — there is one copy of them,
  since the DOM is the store for the selected layer. `parkLayerCtl()` returns the block to its
  home box before `syncStackUI` wipes the row list, which it does on every selection, mute,
  gain drag, blend pick and add/remove; without that ordering the wipe would delete every
  slider, filter and palette control from the document.

## [1.7.0] — 2026-08-03

### Added

- **Seven more transitions**, taking the set from nine to sixteen:
  - **Checkerboard** — tiles flip in a checkerboard, staggered so the change ripples across
    the grid.
  - **Bars** — vertical bars, alternate ones rising and falling.
  - **Shutter** — horizontal slats opening from their centres, like a venetian blind.
  - **Slide** — the new scene pushes the old one out sideways.
  - **Clock wipe** — a hand sweeps round from twelve, revealing as it goes.
  - **Dissolve** — grain by grain, in a random order. The gentlest of the set, and the one
    that suits a palette jump, since the two ramps interleave instead of meeting along an edge.
  - **Ripple** — a ring expands from the centre, carrying the change and bending the image as
    it passes.
- **Choose which transitions get used.** **+ Choose transitions**, under the Transition slider
  in the Scene box, opens the full list with a tick beside each one and a line on what it does.
  Only the ticked ones are ever picked — so if you want nothing but shutters and dissolves, say
  so. They still only turn up where they suit the two scenes, since the pick stays weighted;
  unticking narrows the pool rather than overriding the taste. Untick everything and scene
  changes cut straight over. Remembered per browser, like auto-cycle, and not part of a scene
  you share.

### Internal

- The six staggered-reveal modes are one shader idea with six delay fields — cell parity, bar
  index, distance from a slat centre, angle, hash, ring radius — which is what keeps them cheap
  to add and consistent to look at. The Canvas2D mirror reuses wipe/iris's mask shape for the
  four that are masks and lets dissolve/ripple degrade to a crossfade rather than mirroring
  per-pixel work on the fallback path.
- A driven probe forces each transition in turn, holds it mid-blend and compares every mode
  against every other, since a bad shader branch renders silently as a plain crossfade.

## [1.6.0] — 2026-08-03

### Changed

- **Filters now run where you put them, on whichever buffer sits above them.** Reordering a
  filter chain in 1.5.0 could look like it did nothing, and dragging one filter past another
  would snap it back with a message saying it "always runs after the heat filters". That was
  the wrong answer: if the list lets you drag a row, the position should be real.

  There is one line in the list now — **the effect draws here**. Filters above it shape the
  *heat* before the effect has drawn into it; filters below repaint the finished *picture*.
  Dragging a filter across that line does not just change when it runs, it changes what it
  works on, and the list tells you so.

  So the ordering is genuinely expressive. Put **Mirror** below **Swirl** and the swirl churns
  the heat while the mirror lands last, giving a perfectly symmetric frame. Drag Mirror *above*
  Swirl and it mirrors the heat first, which the swirl then twists — the symmetry is gone.
  Same two filters, completely different picture. Measured on a static scene, swapping that
  pair changes **48% of the pixels**.

  Trail filters (Fire, Fade pixel, Diffuse, Echo, Zoom feedback, Swirl) read and write the
  heat that carries over between frames, so they only make sense above the line and stay
  there. Every other filter goes wherever you put it. Existing scenes are unaffected: a chain
  saved before this loads and runs exactly as it did.

### Internal

- `splitChain()` replaces the stage sort as the single definition of where each filter runs —
  the heat phase is everything at or above the last feedback filter, the image phase is the
  rest — and `runHeatPass()` dispatches each pass through the right hook. Both render paths
  (single-layer and stacked) go through it, as does `mergeExtra`, the gate every loaded scene
  passes through.
- Four broken pixel-capture techniques are documented in CLAUDE.md after they each produced a
  confident wrong reading: reading pixels twice in one task (the second read is cleared), the
  headless exit screenshot (the WebGL canvas does not preserve its buffer), comparing captures
  across runs (the chaos seed differs), and measuring an animating scene at all. The working
  method — one capture per frame in the same task, on a scene reduced to one layer with its
  motion pinned, checking A-against-A-again first — is written down with them.

## [1.5.0] — 2026-08-03

### Added

- **Build your own filter chain, in the order it runs.** The filter list used to show all
  twenty-two with a checkbox each; it now shows only the ones you have **added**. Press
  **+ Add filter** for the full catalogue, drag a row's **⠿** handle to move it up or down the
  chain, **✕** to drop it. The order is the order the filters are applied, and it saves with
  the scene and travels in links and cloud profiles.
  One thing that looks odd until you know why: **heat filters always sit above image filters,
  and a drag that would cross that line stops at it.** A dashed divider marks where the two
  runs meet and the row tells you why it would not move. That is the pipeline, not the menu
  being stubborn — a heat filter changes what the *next* frame starts from, before the effect
  has drawn, while an image filter repaints the finished picture. There is no moment at which
  Mirror could run before Swirl. Reordering *within* a run does exactly what you would expect:
  put Mirror above Twist and you mirror the untwisted picture; swap them and you twist the
  mirrored one.
- **Choose which palettes are in play.** The **+** tile at the end of the swatch strip opens a
  list of every ramp with a tick beside it. Only the ticked ones show in the strip, and only
  they are picked when the palette cycle runs — so a nineteen-ramp catalogue can still cycle
  inside the four that suit a set. Nothing is deleted by unticking: a scene that stores an
  unticked ramp still loads and still renders it, and the one you are on always stays visible.
- **A tick beside every scene decides whether it is in the show.** Ticked scenes are the ones
  **Auto-cycle** picks from; unticked ones dim slightly and are skipped, but stay there and
  stay selectable by hand. Everything starts ticked, and unticking them all leaves the cycle
  sitting still rather than falling back to the whole list. The ticks travel with your scenes
  into backups, cloud profiles and published collections.
- **Each scene names itself on screen as you land on it** — its name, a dash, and who made it,
  in the credits' own lettering. Scenes loaded from someone's published profile are credited
  to them; your own show your profile name. On startup it waits for the credits to finish
  rather than talking over them. **Show author** in the Scene box turns it off.
- **A proper application menu behind ☰** — a multi-level fold-out for everything that is not
  scene data: **System ▸ Audio** and **System ▸ Resolution**, **Cloud profile**, **Credits**,
  plus Controls panel / Fullscreen / Hide all UI and the help link. The **m** key still opens
  the sliders directly.
- **Public scenes** sits at the top level of that menu. Browsing what other people have
  published needs no account, so it is no longer filed inside the sign-in box.
- **Collections.** Someone else's scenes load as their own group, named after them, so their
  "Sunset" and yours never collide and loading the same person again just refreshes their set.
  Groups fold; **✕** removes a whole collection.

### Changed

- **Panels and dialogs are far more readable over a bright scene** — every translucent surface
  went from 55% to 80% solid. At 55% a white-hot fire tip or a full-screen plasma read straight
  through the text.
- **Your own group in the scene list is labelled with your profile name from the moment the
  page opens.** It used to say "My scenes" and then rename itself to your name the first time
  you clicked the group open, because the name only arrived once the cloud had answered.
- **The two per-effect filter groups are one.** "Heat & trails" and "image" were the
  pipeline's distinction, not yours — both are this layer's own filters.
- **Every dialog's ✕ is in the top-right corner**, and dialog buttons are styled like the rest
  of the app rather than as plain grey browser buttons.
- **The Public scenes rows are one line each** — name, scene count and date, then **Load
  scenes** at the end.
- **Three palettes were renamed**: *Rasta Red*, *Rasta Green* and *Rasta Yellow* are now
  **Ember**, **Verdant** and **Sunburst**, and *One love* is **Tricolor**. The ramps
  themselves are unchanged, and no saved scene is affected — palettes are stored by position,
  not by name.
- The panel opens straight onto the scene controls; the title and per-effect subtitle are gone.

### Fixed

- **Per-layer filters survived a reload again.** Ticking Fire, Fade or an image filter on a
  single-layer scene, then reloading the tab, came back with every checkbox empty — the
  settings were being saved correctly and then never read back.
- **Editing a scene no longer quietly reassigns it.** The first slider drag after selecting a
  scene loaded from someone's collection moved it out of their group and under your name.

### Internal

- `orderFilters()` is the single normalizer for a filter chain: it preserves the stored (drag)
  order, drops unknown and duplicate ids, and partitions by pipeline stage. Four call sites
  must route through it — `activeFilters`, `layerFeedbackChain`, `glLayerPostChain` and
  `mergeExtra`, the last being the gate every loaded scene passes through.
- Shared widget CSS is keyed on the class, not scoped to a container. `.pal-close`/`.card-close`
  /`.help-close`/`.sync-close` and `.audbtn` are single unscoped rules; the previous
  per-dialog copies left every new user of those classes unstyled.
- `filterprobe` was rewritten around the new ordering contract (its "always registry order"
  assertions were the old one). Nine driven browser probes now cover the filter chain, the
  scene-list heading, the rotation ticks, the scene title and the dialog layouts, and a
  SwiftShader probe asserts that a same-stage reorder actually changes the rendered frame in
  both the single-layer and the multi-layer render paths.

## [1.4.0] — 2026-08-03

### Added

- **A mute button** — the **♪** beside ☰ and ⛶, or the **S** key. It stops the music driving
  the visual and armed sliders go back to drifting on their own, as if no audio were running.
  It is deliberately *not* Stop: the source stays open, so unmuting is instant. A browser
  cannot silently re-grab tab or screen audio, so actually stopping would make you pick the
  tab again to come back — this is for calming the scene down for a moment without losing the
  capture. Inert until a source is running, and not remembered across reloads.
- **New scenes are named after the one you copied.** Pressing **New** now proposes the
  selected scene's name with its version bumped — "Sunset" → "Sunset 2" → "Sunset 3" — since
  a new scene is nearly always a variation on the one you were just editing. A trailing
  number *is* the version and is incremented rather than appended to, and the suggestion
  skips names already in your library, so pressing New repeatedly walks up instead of
  offering the same name twice. It is only the default text; type over it as you like.

### Changed

- **Moving scenes in and out is now the cloud profile's job**, and the box says so. The
  **Backup**, **Restore**, **Share this scene** and **Share presets…** buttons are gone from
  the menu. Nothing that *receives* has changed: every share link, preset bundle and cloud
  link ever generated still opens, and still lands in the merge-or-replace dialog, so nothing
  of yours is ever quietly overwritten.
- **"Presets" are called "Scenes" everywhere in the app** — the box, the TTL, the auto-cycle
  toggle, every prompt and every help blurb. Saved scenes, links and backups are untouched;
  only the wording changed.
- **Published scenes load in one click.** A gallery row now carries **Load and merge** and
  **Load and replace** and applies straight away, instead of opening a dialog to ask the
  question you just answered by clicking.
- **The feedback filters' "Keep" slider is now "Lifetime"** — five filters (Fade pixel,
  Diffuse, Echo, Zoom feedback, Swirl) all had a slider called Keep, so a column of pop-out
  boxes read the same word five times. Your saved values are unaffected.
- **The "Effect & Filters" box is now "Layer effect & filters"**, since everything in it
  edits the one selected layer.
- **Beat detection: the mid band now starts at 250 Hz** instead of 150. That leaves 150–250 Hz
  in neither band on purpose — it is bass-guitar and low-synth territory, sustained pitched
  material that is neither a kick nor a snare, and feeding it to either band only diluted that
  band with notes. Scenes that saved their own band edges keep them.
- The empty sign-in box no longer shows once you are signed in.

### Fixed

- **Zooming a point effect is sharp again.** Sierpiński, Tetrahedron and Attractor went
  blocky as you zoomed, because zoom magnified the finished picture — so detail fell away the
  further in you went. They now re-draw themselves at the zoomed scale like every other
  effect does, and stamp more points to match, so zooming gains detail instead of blur. Two
  knock-ons: flames and glow keep their real size rather than being magnified with the
  geometry, and a stacked scene mixing a point effect with a shader effect no longer leaves
  the point effect un-zoomed.

### Internal

- `README.md` brought up to date after several releases of drift — twenty effects rather than
  fifteen, the current eight menu boxes, the cloud profile, twenty layer blend modes, and the
  per-layer vs whole-scene filter split.
- The zoom change is verified by measurement rather than by eye: the bounding box of lit
  pixels grows and then clips as zoom rises, which distinguishes "the geometry is scaling"
  from "more points are being drawn in the same place".

## [1.3.0] — 2026-07-30

### Added

- **Share this scene** — a new button beside *Share presets…* that copies a link to whatever
  is running right now. Signed in, the scene is stored in the cloud and the link is a dozen
  characters instead of a few thousand; signed out it falls back to the self-contained link
  that carries the scene itself, so sharing never needs an account and never stops working.
  Opening one runs the scene straight away as an unsaved scene — none of your own presets are
  touched. The link is a snapshot: editing the scene afterwards does not change what someone
  else sees until you share it again.

### Changed

- **The layer drag handle now selects its layer too**, on release — so grabbing a layer to
  reorder it also brings it up for editing. Dragging still reorders exactly as before, and the
  dragged layer ends up selected wherever it lands.
- **The beat-detection trace moved into the Beat tuning box**, next to the thresholds it
  exists to help you set, instead of sitting in a separate Diagnostics section.
- **The frame + FPS counter has no toggle any more** — **H** (hide all chrome) already
  governs it, and two controls for one thing only ever disagree. With both of its toggles
  rehoused, the Diagnostics section is gone.
- The Google sign-in button is sized to fit the menu and given room to breathe. Its internals
  are Google's own and cannot be restyled, so this is as close to the panel as it gets.
- **The page is now titled "burnTheWeb — a fractal bonfire that dances to your music"** — the
  tab, the search result and the link preview all say what it does to you rather than which
  genre it belongs to. The description was also three effects out of date (it still claimed
  fifteen; there are twenty, including the 3D solids).

### Fixed

- Opening a shared link left the preset chooser naming one of **your** presets, so an arriving
  scene looked like it had loaded that preset. It now reads "— unsaved scene —", which is what
  it always actually was. Affected every shared scene link, not just the new ones.

### Internal

- `firestore.rules` gains a `/scenes` collection for shared scenes: fetchable by id without an
  account (a share link must open for anyone) but **not listable**, so links stay unlisted
  rather than becoming a public directory of everything anyone has ever shared. Owner-stamped,
  immutable, and deletable by its owner. Kept separate from `/profiles` on purpose — a link
  into a profile would only open while that profile was published, so sharing one scene would
  have forced the sharer's whole library public.
- A `firebase.json` so the rules can be deployed from the repo (`firebase deploy --only
  firestore:rules`) instead of pasted into a console — it adds no dependency and no build step.
- Dev controls opt out of preset autosave with `data-nopersist` rather than by living in a
  particular section, which is what let the beat trace move into a box that deliberately does
  autosave everything else in it.

## [1.2.0] — 2026-07-30

### Added

- **Cloud profiles.** Sign in with Google and keep your preset library online, so it follows
  you between machines instead of living in one browser. In *Backup, restore & share*:
  **Save to cloud** uploads your presets, **Load from cloud** fetches them back and opens the
  usual restore dialog so you choose merge or replace, and **Delete profile** removes
  everything you have stored. Stored against your account: the profile name you type and your
  presets — not your email, name or picture. Your profile name reads as plain text once you
  are signed in; click it to rename.
- **A public gallery.** Tick **Publish to gallery** to list your profile, and
  **Browse profiles…** to see everyone who has. Loading someone's profile goes through the
  same merge-or-replace dialog, so nothing of yours is overwritten without asking. Browsing
  needs no account — anyone can look. Publishing is opt-in and off by default.

### Changed

- **Pressing anywhere in a layer row selects that layer** — the mute dot, the gain slider,
  the blend dropdown, the effect chooser, all of it. Previously those controls acted on their
  layer while the sliders below kept editing a different one. Dragging the grab handle still
  reorders without selecting.
- The divider above the first slider group in *Effect & Filters* is gone. It sat directly
  under the box title, where it read as a stray rule rather than a separator.

### Internal

- `firestore.rules` is checked in: with no backend, it is the entire authorization boundary,
  so it belongs in review rather than only in a web console. Verified against the live
  database that an unauthenticated read of a private profile, an unauthenticated write, and
  an unfiltered listing are all denied, while the gallery's `pub == true` query is allowed.
- The Firebase web API key sits in the source deliberately — it is a public project
  identifier, not a credential (GitHub secret-scanning alert #1, resolved on that basis).
- New `tools/cloudprobe.js`, plus headless suites covering the gallery, the configured
  save/load path with `fetch` stubbed, and the assertion that an unconfigured build makes no
  network request at all.

## [1.1.0] — 2026-07-30

### Added

- **Bouncing solids** — a new, genuinely 3D effect, and the first raymarched one. Solid
  spheres, boxes, doughnuts, capsules, octahedra and cylinders tumble and ricochet inside an
  invisible room, drawn as signed-distance fields and shaded into the palette by surface
  angle and depth. Six sliders: **Count**, **Size** (also the radius they bounce on, so
  bigger bodies turn sooner), **Shape mix** (1 = all spheres … 6 = one of each), **Speed**,
  **Tumble**, and **Edge glow** for the silhouettes. A wall impact converts sideways travel
  into roll, so an angled clip visibly kicks a body into a tumble. Tick Fire or Fade pixel
  for trails; it stacks and blends like any other layer, with its own palette and filters.
- **An effect chooser on every layer row.** Re-pointing a layer no longer means selecting it
  and then scrolling down to the chooser — each row in the *Layers* box carries its own
  dropdown. Picking on a row that is not selected selects it first, so a layer keeps its
  palette and filters exactly as it does when you switch it the long way round.
- **A palette editor.** Hover any palette swatch and click **+** to make an editable copy of
  it (or **✎** on one of your own to edit it in place — the nineteen built-in ramps are never
  changed). The ramp is edited as colour stops on a gradient bar: click the bar to add a stop
  there, drag a handle to move it, pick colours with the colour box. **Every edit previews
  live on the scene**, so there is nothing to apply and nothing to guess at. Your palettes
  join the swatch list and the palette-cycle rotation, and are saved with your settings and
  backups. A copy you open and close without changing anything is discarded, so looking costs
  nothing; **Save & close** keeps it if you wanted the duplicate. **Delete palette** removes
  one of yours, and any layer using it falls back to the ramp it was copied from.
- **Version and release-notes link** at the foot of the menu (this file).

### Changed

- The *Effects & Filters* box is now **Effect & Filters** — singular, because everything in
  it edits the one layer you have selected; the plural read as "all of the effects".
- That box no longer carries its own **Effect** dropdown. Every layer row has one now, so the
  copy at the top of the box was a second visible control for the same thing; the sliders it
  used to sit above start the box instead.
- The palette inspector button is an **eye** instead of the old ▦ grid glyph, which
  described the dialog's layout rather than what the button does and read as a stop icon.
- Custom palettes ride in saved settings, backups and preset bundles. A scene that names a
  palette you do not have falls back to a built-in rather than failing to load — the same as
  any other out-of-range value.

### Fixed

- The comment describing the analytics hook still said it was inert "until
  `GA_MEASUREMENT_ID` is set"; it has held a real id for some time.

### Internal

- New `tools/solidsprobe.js` (39 assertions) covering the rigid-body physics: containment
  over 6000 steps and at every slider extreme, the clamped frame step (an unclamped
  backgrounded-tab `dt` tunnels a body through a wall), quaternion normality, per-layer body
  ownership, and the start-position spread. Every one of those failures is invisible to a
  screenshot, which is why they are assertions rather than a look at the picture.

## [1.0.0] — 2026-07-28

The first versioned release: everything the app was before release notes existed. Recent
work included in it, newest first —

- Per-layer **Heat boost** slider (palette brightness curve).
- `fire-physics.js` renamed to `tetrahedron-physics.js` and de-fired throughout.
- The scene **Share** and **Short link** buttons were removed; sharing is preset-bundle
  only now. Every `?z=` / `?s=` scene link ever generated still opens.
- **Share presets…** — bundle a curated set of presets into one link, carrying auto-cycle
  and the selected preset so the recipient opens on the same scene and the same show plays.
  The payload rides in the URL *fragment*, which is what keeps a multi-KB bundle from being
  rejected as "URI Too Long" before any JS runs.
- **Preset TTL** and **Transition** became per-preset, so a shared scene plays at the pace
  it was authored with.
- The **Orbit editor** and **Palette inspector** became translucent floating panels and hide
  with `M` / `H` along with the rest of the chrome.
- Fixed: stacked Tetrahedron layers shared one body list and moved in lockstep.
- Fixed: freehand orbit strokes were offset from the pointer.
- **Palette inspector** popup; a confirmation on *Reset this effect*.
- Tetrahedron gained controllable **Sway**, and orbits the centre when *Show box* is off.
- **Points** became a ranged slider, so it takes L/M/H beat triggers like the rest.
- Neutral effect defaults, and every filter off by default — a fresh effect renders its raw
  output and you tick what you want.
