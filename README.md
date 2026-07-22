# burnTheWeb

A GPU demoscene visual: a collection of **fifteen effects** in three families,
all sharing one palette + glow + banding pipeline —

- **Fractal fire** — a Sierpiński triangle, a bouncing 3D tetrahedron, or a de
  Jong strange attractor stamped as fresh heat into a classic rising-fire buffer.
- **Shader fractals** — animated Julia, Burning Ship, Multibrot and Newton.
- **Coordinate / pattern classics** — plasma, tunnel, metaballs, kaleidoscope,
  rotozoomer, moiré, munching squares and copper bars.

The whole thing burns, flickers, and morphs continuously — and every effect can
**react to whatever music you're playing**.

🔥 **Live demo:** https://carlemil.github.io/burnTheWeb/

## Effects

An **Effect** selector in the panel's **Effects** section switches between fifteen visuals
that share the same palette, glow and music-reactivity pipeline — but each is an
independent "scene" that remembers its own settings (see Controls). You can also **stack
up to four of them at once** — see Layers below:

- **Sierpiński** — the classic 2D Sierpiński-**triangle** fire described below.
- **Tetrafyer** — the same fire seeded by a 3D Sierpiński **tetrahedron** that
  is a rigid body **bouncing inside a rubbery box** in front of a fixed camera.
  Each of the four corners collides with the walls under impulse-based physics
  (isotropic inertia, near-elastic restitution), so a corner-hit realistically
  kicks the solid into a tumble; each hit bursts a fading sphere of points out
  from the impact point. The chaos game runs in 3D between the physics-driven
  vertices and is perspective-projected. The view turns so you read the box as solid 3D:
  **Rotation** yaws it and **Box nod** pitches it in a slow sine — both on sliders, and
  both can be set to 0 to hold it still.
- **AnimeJulia** — an animated Julia set. The seed `c` is orbited around the
  Mandelbrot plane along two stacked loops: a large slow loop tracing just
  outside the inner bound (the main cardioid, pushed slightly outward) so the
  Julia set stays intricate, plus a much smaller, faster circle riding on top
  that keeps the seed's neighbourhood changing instead of retracing one closed curve
  (wind **Inner radius** up far enough and it does dip inside, which is where the
  solid-blob frames come from). The big
  loop turns slowly (a few hundredths of an rpm) and the small one a fair bit
  faster, so the fractal reshapes continuously. Per-pixel escape time is written
  as heat and coloured through the same palettes.
- **Plasma** — a classic old-school demoscene plasma: several sine/cosine waves
  (plus a domain-warp for swirl) interfere across the screen and animate over
  time, then the summed value is wrapped through a final sine so the palette
  cycles into smooth colour bands. Sliders tune the animation **Speed**, spatial
  **Scale** and **Warp**; **Banding** works here too (as in AnimeJulia).
- …plus more demoscene effects, each with its own sliders (react to music via the
  L/M/H chips like everything else):
  - **Tunnel** — polar-mapped rings rushing toward the vanishing point (Fly speed / Twist / Ring density).
  - **Metaballs** — gooey blobs that merge with organic necks; turn up Banding for iso-contour shells.
  - **Kaleidoscope** — a moving field folded into mirror-symmetric wedges (Segments / Spin / Flow).
  - **Rotozoomer** — the classic Amiga rotate-and-pulse-zoom of a tiled grid.
  - **Moiré** — two drifting concentric-ring sets interfering into shimmering fringes.
  - **Munching Squares** — the hypnotic `(x XOR y) + t` pattern with self-similar nested squares.
  - **Copper Bars** — horizontal gradient raster bars sliding up and down on sine motion.
  - **Burning Ship** — a jagged, flame-like fractal (Julia's abs-fold cousin), sharing AnimeJulia's controls.
  - **Multibrot** — `z^power + c`, where **Power** is a whole number stepping 2, 3, 4… and each step adds a bulb of symmetry. The seed orbits the boundary of the matching **degree-`power`** set, not the plain Mandelbrot cardioid, so the fractal keeps its delicate filigree as the exponent steps instead of flooding solid. That cardioid gains a cusp per step (`power−1` of them), and the seed sprints through every cusp and eases off in between — so raising Power adds fast-slow stretches to the orbit as well as bulbs to the fractal.
  - **Newton** — the three interlocking root-basins of `z³−1` with fractal borders (Root spin / Relaxation).
  - **Attractor** — a de Jong strange attractor whose four coefficients a/b/c/d morph its delicate threads. **Point jitter** scatters each stamped point to soften them — set it to 0 for the bare, hard-edged curves.

## How it works

- **Fire** — a low-resolution heat buffer where each cell averages the pixels
  below it with a slight decay, so heat rises and flickers. This is the classic
  algorithm from [Lode's computer graphics tutorial](https://lodev.org/cgtutor/fire.html).
- **Sierpiński seed** — the fractal is generated with the
  [chaos game](https://en.wikipedia.org/wiki/Sierpi%C5%84ski_triangle): repeatedly
  jump halfway toward a randomly chosen corner. **Sierpiński** uses a 2D triangle
  (three corners); **Tetrafyer** uses a 3D tetrahedron (four vertices), running the
  walk in 3D and perspective-projecting each point. Each point is stamped into the
  fire buffer as maximum heat, so flames rise out of the fractal.
- **Moving geometry** — the triangle's corners drift on their own `sin`/`cos`
  mixes driven by a phase that accumulates per simulation tick (not the wall clock,
  so changing Drift speed eases the motion instead of teleporting it), fit into a safe box that fills the frame with a
  single pixel of margin on every side. The
  tetrahedron instead moves under the rigid-body physics described above,
  ricocheting off the walls of its container.
- **Deterministic point cloud** — the chaos game uses a seeded PRNG (mulberry32)
  that resets to the same value every frame, so the point *sequence* is identical
  each frame. Only the moving geometry reshapes the fractal — no random shimmer.
- **Palettes & glow** — nineteen classic demoscene-style palettes (including a set of
  Rastafari ramps), each shown as a gradient swatch you click to preview and pick
  (Fire, Ice, Toxic, Copper, Purple, Rainbow, Grayscale, Electric, Amber, Matrix,
  Sunset, C64, CGA, Blood, Chrome), plus a subtle
  additive bloom that makes the white-hot points glow. The palette-cycle slider
  continuously blends from the current palette to a random next one, taking a time
  drawn from its min–max range each cycle (set it to 0 to hold one palette).
- **Banding** — an optional *filter* over whichever palette is active (not a
  palette of its own). It posterises the heat ramp into bands and dims
  alternating groups of three, turning any palette into crisp light/dark contour
  stripes. Its strength is set by a ranged slider (see below), so it can sit at a
  fixed level or wander between two bounds; while on it also shimmers as a slow
  wave along the ramp.
- **Timing** — the simulation advances on a slow fixed tick rate, decoupled from
  the render frame rate, so the burn stays smooth and controllable.

## Controls

An on-screen panel (top-left) lets you tune the effect live. Most controls are
**ranged sliders**: two thumbs set a lower and upper bound, and the live value
then wanders *erratically* between them (a random target reached over a random
time, eased, on repeat). Collapse the two thumbs together to pin a constant
value, so a ranged slider also works as an ordinary one.

**Each effect is a fully independent scene** — its sliders, beat chips, pulse shapes
and lengths, palette, palette cycle and show-box are all remembered *separately per
effect*, so tweaking Tetrafyer never touches AnimeJulia. A handful of things are
deliberately **shared** instead: auto-cycle and its hold time, the render resolution,
the camera angles, and the panel's open/closed state. Everything is **saved to your browser** and
restored on your next visit (persisted values that fall outside a slider's
current range are ignored, so updates can't load junk). The **?** by the title
opens an effect-aware help panel; a small **frame counter + rolling FPS** sits in
the top-right corner.

**Pop out a slider** — every slider has a small **+** button. Click it to break
that slider out into its own box in a column to the right of the menu; the menu
keeps the slider's name with a **−** to put it back. Pop out several and the boxes
stack from the top down, so you can line up just the controls you're playing with.
(This layout is per-session and isn't saved — it clears whenever the scene changes:
switching effect, picking or creating or deleting a preset, or dropping to
"— unsaved scene —".) Each box is titled with what it
belongs to — the effect or the filter, e.g. *Camera*, *Plasma*, *Filter · Bloom* —
so a stack of boxes reading "Speed", "Strength", "Size" stays readable. A box
gives the slider room for
everything that belongs to it: its value, the **L / M / H** beat chips and
**pulse-shape** picker, a **Pulse** knob for how long its beat kick lasts, and a
**min / max** row that retunes that slider's own range live. **↺ resets the whole
slider** — value, bounds, beat chips, pulse shape and pulse length all go back to
this effect's defaults, so a slider you've wandered somewhere strange is one click
from sane. Custom bounds are saved: they persist in your browser, ride along in a
**Share** link and go into your **Backup**.

A slider's menu row also shows small **beat dots** just left of that **+** — one per
armed band, in the band's colour (L blue, M green, H red). They sit dim and light up
on the beat that drives them, so you can see at a glance which sliders a preset has
wired to the music without opening a single box.

**The menu is eight foldable sections** — click a heading's chevron to collapse it:
**System** (audio, resolution and the diagnostics tools; folded by default),
**Backup, restore & share**, **Scene** (which preset, and how long each is held),
**Effects** (pick the visual, then its sliders), **Filters** (the post-processing
stack), **Beat tuning** (how beats are detected), **Palette settings** (the ramp,
how fast it cycles, and banding) and **Credits**.

**React to music** — click **Capture** to tap system/tab audio (so it reacts to
whatever you're playing, e.g. Spotify: pick *Entire Screen* + "share system
audio", or a *tab* + "share tab audio"), or **Mic** for the microphone. The
audio is split into **low / mid / high** bands with per-band beat detection (the
3-bar meter shows it working). Detection is **onset-based**: each band watches its
*spectral flux* — how much the spectrum jumped **up** since the last look — so it
fires on the attack of a kick or a hi-hat rather than on loudness, and a sustained
bass line no longer masks the kick riding on top of it. The bar it has to clear
adapts to the mix (it follows the recent flux, so a quiet verse still triggers),
and the analysis runs on its own **100 Hz clock**, independent of the framerate,
so beats stay in time even when the visual is working hard. Each ranged slider has three tiny **L / M / H**
toggle chips, all **off** to start — they stay dim and colourless until you arm
one, which lights it in that band's colour: arm one and — while audio is on — the slider stops drifting and
instead rests at its low thumb, snapping to its high thumb on each beat in that
band and dropping back over that slider's own **Pulse** time (0.2s by default, set
per slider in its pop-out box; the range width sets how *big* the pulse is, the
pulse time how *long* it lasts). Beside the chips is a **pulse-shape** dropdown that picks the curve the value
follows on the way back down — **Snap** (linear, the classic), **Pluck** (fast
percussive drop), **Sustain** (holds high, then falls), **Ease** (smooth S-curve),
**Bounce** (a few decaying bounces) or **Steps** (retro quantized). The chips and
shapes and pulse times are remembered per effect and persisted. Pinned sliders (thumbs
together) have no range to pulse within, so widen a slider to make it react.
Browsers can't silently re-grab tab/screen (or mic) audio after a reload, so the
last source is remembered and re-opened on your **first click/keypress** after
the page loads.

*(ranged)* controls are the two-thumb sliders described above; the rest are
single sliders, dropdowns or toggles. Everything is remembered per effect except
the shared few listed above (auto-cycle, hold time, resolution, camera, panel state).

| Control | What it does |
| --- | --- |
| **Presets** | A preset is a named full scene (the effect + all its settings). Pick one to load it; from then on every change is **auto-saved** back into it. **New** saves the current scene as a fresh preset, selects it, and switches auto-cycle off so it stays on screen; **Delete** removes the selected one. Pick "— unsaved scene —" to tweak without touching a saved preset. Switching to a different **effect** keeps you on the preset you have selected and folds the change into it, the same as moving a slider does — so you carry on working on your scene rather than being moved somewhere else. Note the preset keeps its **name**, so one called "Sierpiński" that you switch to Tunnel stays called Sierpiński until you rename it. In "— unsaved scene —" nothing is written, as usual. Switching to a preset leaves the previous effect on screen to burn away under the new one rather than cutting to black (visible whenever the incoming scene has the Fire or Fade pixel filter on), and blends the palette in from whatever is on screen: to a fresh random one while the palette cycle is running, or to the preset's own stored palette when the cycle is pinned to 0. At the top of the panel, **Backup** saves **one `.json` per preset**, each named after the preset, plus a `_settings.json` holding everything that isn't a preset (each effect's current values, custom slider ranges, the active effect, auto-cycle, render resolution). One file per preset is the point: to send someone a scene, send them that one file. In Chrome and Edge you pick a folder **once, ever** — it is remembered from then on, and each backup lands in its own dated folder, `BurnTheWeb/<date-time>/`. Shift-click **Backup** to choose a different folder. Other browsers download the files individually with the date in the name. **Restore** takes as many files as you select — a whole backup folder, or the single preset a friend sent you. A dialog lets you tick **which parts** to bring in (presets, effect settings, slider ranges, beat tuning — only the ones your selection actually contains) and, for presets, whether to **merge** (overwrite same-named, keep the rest) or **replace** (delete yours, use only the backup's). Applying reloads the page. Older single-file backups still restore. |
| **Effect** | Switch between all fifteen effects listed above, in dropdown order (Sierpiński, Tetrafyer, AnimeJulia, Plasma, Tunnel, Metaballs, Burning Ship, Kaleidoscope, Rotozoomer, Munching Squares, Moiré, Newton, Multibrot, Copper Bars, Attractor). Each shows its own sliders. |
| **Auto-cycle presets** | When on, a random saved preset is applied every so often (needs ≥2 presets); off to stay put. *(Shared, not per-effect.)* |
| **Preset TTL** *(ranged, seconds)* | How long auto-cycle holds each preset before applying a random other one — a random time drawn from this range. Grays out while auto-cycle is off. *(Global, not per-effect.)* |
| **Palette** | Pick one of nineteen colour ramps — each is shown as a gradient swatch, so you preview the colours instead of reading a name. Click one to select it; the active ramp is highlighted. |
| **Palette cycle** | How long one blend to a random palette takes, as a min–max range in seconds — each cycle picks a time inside it. Collapse both thumbs to **0** for a fixed palette that never cycles. (This replaced the old Auto-morph checkbox.) |
| **Palette hold** | How long to rest on each palette before the next blend begins, as a min–max range in seconds — a fresh dwell is drawn each time. At **0** (the default) the palette cross-fades continuously; raise it to pause on each palette between changes. Only applies while Palette cycle is running. |
| **React to music** | **Capture** system/tab audio (e.g. Spotify) or **Mic**; the audio is split into low/mid/high bands with per-band beat detection (see below). |
| **Banding** *(ranged)* | Most shader effects (AnimeJulia, Plasma, Metaballs, Burning Ship, Kaleidoscope, Rotozoomer, Moiré, Newton, Multibrot, Copper Bars) — strength of the light/dark contour-stripe filter over the active palette. |
| **Band size** *(ranged)* | Shader effects with banding — colours per light (and per dark) run in the banding pattern. |
| **Darkness** *(ranged)* | Shader effects with banding — how far the banding's dark runs are darkened. |
| **Points** | Number of points stamped per frame (100–8000). *(Sierpiński / Tetrafyer / Attractor.)* |
| **Layers** | −/+ stack up to 6 copies of the fractal; each added copy is half the size and half the points of the last, with a new seed, so it drifts/tumbles independently. *(Sierpiński / Tetrafyer.)* |
| **Drift speed** *(ranged)* | How fast the triangle's corners move / the tetrahedron's physics tempo. *(Sierpiński / Tetrafyer.)* |
| **Flame rise** *(ranged)* | How tall the flames climb before fading (linear in height). Belongs to the **Fire filter**, so it is available to any effect that has Fire ticked. |
| **Size** *(ranged)* | Scales the fractal about its centre — the triangle, or the tetrahedron with matching physics. Distinct from Zoom. *(Sierpiński / Tetrafyer.)* |
| **Rotation** *(ranged)* | Tetrafyer only — **yaw** rate in degrees/second for the scene orbit around the box. Ships drifting −5…5°/s; set both thumbs to 0 to hold still. |
| **Box nod** *(ranged)* | Tetrafyer only — how far the view **pitches** up and down in its slow sine, in degrees (default ≈17°). 0 holds the box dead level. This is the drift that used to be hardcoded with no control. |
| **Nod speed** *(ranged)* | Tetrafyer only — multiplier on how fast that nod swings. 0 freezes it mid-swing; the swing is also scaled by Drift speed, as it always was. |
| **Show box** | Show or hide the wireframe of the box the tetrahedron bounces in, along with the spark-sphere burst each wall hit throws off. *(Tetrafyer.)* |
| **Box size** *(ranged)* | How large the box the tetrahedra bounce inside is — bigger gives them more room. *(Tetrafyer.)* |
| **Zoom** *(ranged)* | Zoom the whole view in and out. |
| **Camera X / Y / Z** *(ranged, degrees)* | Tilt and spin the whole scene in 3D — X and Y rock it away from you, Z rolls it in the plane of the screen. Shared across effects rather than per-effect, so it acts as a camera over whatever is running. |
| **Power** | Multibrot only — the exponent in `z^power + c`, a whole number. Each step adds a bulb of symmetry, and adds a cusp to the seed's cardioid, so the orbit gains a fast/slow stretch with it. |
| **Point jitter** *(ranged)* | Attractor only — scatters each plotted point by up to this many pixels to soften the map's hard threads. 0 gives the bare, razor-thin curves. |
| **Cardioid RPM** *(ranged)* | AnimeJulia, Burning Ship and Multibrot — how fast the big seed loop orbits the cardioid, in rpm. |
| **Inner : outer ratio** *(ranged)* | The cardioid-seeded effects — how many times the small seed circle spins per big-loop lap. Defaults to the hypocycloid ratio implied by the two circumferences (≈21.5×). |
| **Inner radius** *(ranged)* | The cardioid-seeded effects — the size of the small circle riding on the seed. Small values keep the seed just outside the cardioid (intricate); large values swing it wider and can dip inside, giving solid-blob frames. |
| **Outer radius** *(ranged)* | The cardioid-seeded effects — the scale of the big cardioid loop the seed traces. Larger values push the whole orbit outward, further clear of the set. Burning Ship ships this high (1.4–1.9) for exactly that reason; wind it down and it washes out. |
| **Cardioid start** *(ranged)* | The cardioid-seeded effects — an offset added to the seed's position around the cardioid, in laps (0 and 1 are the same point, 0.5 is halfway round). |
| **Cardioid X offset** *(ranged)* | The cardioid-seeded effects — slides the whole orbit along the real axis. Negative walks it toward the bulbs and the spike, positive past the cusp. |
| **Random seed each reload** | The cardioid-seeded effects — when on (the default), the fractal opens from a fresh random spot on the cardioid every page load and each time you switch to the effect. Turn off for a fixed, reproducible starting frame. |
| **Speed** *(ranged)* | Plasma only — how fast the waves animate (0 freezes the field). |
| **Scale** *(ranged)* | Plasma only — spatial frequency of the waves (fine vs coarse pattern). |
| **Warp** *(ranged)* | Plasma only — domain warp: bends the waves into swirls (0 = clean interference). |
| **Reset this effect** | Put the current effect back the way it ships: every slider's **value and range**, its beat chips, pulse shapes and lengths, and its palette. Other effects and the shared controls are left alone. (The ↺ in a single slider's pop-out box does the same for just that slider.) |
| **Share** | Copies a URL that reopens the page with **the scene you're looking at** — the current effect and everything about it, including its beat tuning and camera. Your other effects' settings and your saved presets stay local to your browser. Your auto-cycle and hold-time settings aren't sent either, so opening someone's link doesn't rearrange your own. Works offline — the whole scene rides in the link. |
| **Short link** | Copies a short `tinyurl.com` link to the same scene. Needs the internet, and hands the share URL to TinyURL to store — use **Share** if you'd rather nothing left your browser. The scene is deflated into the link, so it is around a tenth of the size it used to be — short enough that TinyURL accepts it and chat apps stop truncating it. |

Press **M** or **☰** to toggle the menu, **F** or **⛶** for fullscreen (works on
mobile too), and click the canvas to pause. The frame + FPS counter is a checkbox in
the menu's **Diagnostics** section. A **Resolution** control drops the render
resolution on low-end devices. If your browser requests **reduced motion**, the
page opens paused (a static frame) — click the canvas to animate. On mobile,
tab/screen audio capture isn't available, so only **Mic** is shown.

## Transitions

When one preset gives way to the next, the change is blended rather than cut. Some
scenes always did this on their own — anything with **Fire** or **Fade pixel** on
keeps its buffer, so the old picture burns or smears away under the new one. Scenes
with neither redraw from scratch every frame, so they used to snap over in a single
frame.

A transition is now chosen automatically for each switch, from nine:

| | |
| --- | --- |
| **Cut** | No blend. Picked when the buffers already dissolve for you. |
| **Burn off** | Lends the old scene the fire's decay for the length of the switch, so it burns away even under an effect that has no filter on. |
| **Crossfade** | Straight dissolve between the two. |
| **Dip to black** | Down to black in the middle and back up. |
| **Flash** | A bright bloom over the join. |
| **Pixelate through** | Blocks grow, the scene changes at the coarsest point, blocks shrink again. |
| **Blur through** | The same shape, with blur instead of blocks. |
| **Wipe** | A soft edge travels across. |
| **Iris** | The new scene opens out from the centre. |

The choice isn't random for its own sake — each one knows which switches it flatters.
A crossfade between two full-screen fields looks lovely, but crossfading a sparse
point cloud against a dense one just looks like a double exposure, so those get the
ones that break the picture up (pixelate, blur, wipe) — they destroy the image exactly
where it changes, which is what hides the join. Big jumps in palette lean toward dip
and flash. Scenes that already dissolve on their own mostly get left alone.

**Transition** (in the **Scene** box, under Preset TTL) sets how long they take, as a
min–max range in seconds — each switch draws a length from it. Collapse both thumbs to
**0** for a hard cut, which is exactly how the app behaved before.

One thing to know: during a transition the outgoing scene is a frozen frame, not still
running. Two effects can't be rendered at once here. At well under a second it reads
the way a video mixer's dissolve does.

## Layers

A scene can stack **up to four effects at once**, composited into the same fire buffer.
The **Layers** list sits at the top of the **Effects** section, one row per layer, and
they combine in list order.

Click a row to select it — the **Effect** chooser and every slider below then edit *that*
layer, so each one keeps its own settings, its own drifting sliders and its own beat
reactions. **+ Add layer** adds another (it starts as a copy of the selected layer's
effect; change it with the Effect chooser). Each row also carries:

- **⠿** — the grab handle: drag it up or down to reorder the layer in the stack.
- **●** — mute it. A muted layer costs nothing and leaves nothing behind, which makes it
  the quickest way to see what a layer is actually contributing.
- **Blend** — how it combines with the layers below; click to cycle. Because each layer
  carries its own palette (below), a multi-layer stack blends in **colour**, in the
  perceptual OKLab space, so hues mix cleanly instead of muddying to grey. Five modes:
  - **MAX** — the brighter layer wins each pixel. Clean separation, the safe default.
  - **ADD** — screens the layers' brightness and averages their hue by brightness, so
    each colour shows in proportion to how bright it is where they overlap.
  - **DIF** *(difference)* — `|below − this|`. Psychedelic where the two disagree, dark
    where they match.
  - **COL** *(colour)* — keeps the **brightness** of the layers below, repainted in **this**
    layer's hue.
  - **LUM** *(luminosity)* — the inverse: this layer's brightness wearing the hue of the
    layers below.
  DIF, COL and LUM only do anything with two or more layers — a lone layer has nothing
  underneath to blend against.
- The **strength** slider — how much of the layer reaches the composite, from nothing to
  full.
- **✕** — remove it.

Layers are part of the scene: they save into presets, ride along in backups, and travel
in share links. A scene with a single layer is stored exactly the way it always was, so
every preset, backup and link made before layers existed still opens unchanged.

Each layer keeps its **own palette and its own filters**, so every effect in a stack shows
in its own colours and is shaped on its own — set a layer's palette and tick its filters
while that layer is selected, and they are remembered per layer. With the palette cycle
running, layers even morph on their own schedules. The **Filters** list says which is which:
the **Per-effect** filters (Fire, Fade and the trail effects; Wedge fold, Twist, Edge and
the rest of the image filters) run on each effect on its own, before the layers blend; the
**Whole-scene** filters (Bloom, Scanlines, Vignette, Film grain, Barrel) plus the camera,
beat tuning and render resolution act once on the finished, blended picture. Because display
**Zoom** is applied once to that composite, adding a shader effect (which does its own
optical zoom) to a point-based scene will stop the point effect zooming.

On machines without WebGL the Canvas2D fallback renders the first unmuted layer only:
stacking is a GPU feature, and each extra layer there would be a full software render.

## Filters

Under **Filters** in the menu is a list of twenty-two post-processing effects you
can stack on top of whatever effect is running — tick as many as you like and they
apply in order. Each one's settings appear underneath it while it's ticked, and the
whole selection is remembered per effect and saved into presets. The list is split
into the three stages of the pipeline, which is the one thing worth understanding
about them: **feedback** filters change what the *next* frame starts from, **post**
filters repaint the image, and **screen** filters sit on the finished frame.

**Feedback (heat)** — these run on the retained heat, before the effect's fresh
output is mixed in, so they're what trails and long exposures are made of. Each
carries its own **Keep**, so it decays on its own rather than piling up to white.

- **Fire** — the rising, cooling heat simulation. It used to be hardwired to the
  three point effects; now any effect can burn. **Flame rise** sets how tall the
  flames climb, **Burn rate** how many times a second the fire advances.
- **Fade pixel** — every pixel keeps a fraction of its brightness each tick, so
  the image smears into phosphor trails. **Keep** near 100% holds almost forever.
- **Diffuse** — heat bleeds sideways as well as up, so Fire's flames turn to smoke.
- **Echo** — trails drag in a **Direction** instead of just dimming in place.
- **Zoom feedback** — the retained heat is rescaled about the centre every tick.
  Over 1× it rushes outward into an endless tunnel; under 1× it falls inward.
- **Swirl** — the same, rotating instead of scaling, so trails spiral. Stack it
  with Zoom feedback for a vortex.

**Post (image)** — these repaint the palette-mapped picture.

- **Twist** — spin the middle of the image and leave the rim, so straight
  structure curls into the centre.
- **Wedge fold** — fold the picture into N mirrored **Segments**: Mirror's trick
  generalised to a kaleidoscope, available to every effect.
- **Slice glitch** — tear horizontal slices sideways at random. Arm **Amount** to
  a beat and the picture rips on the hit.
- **Pixelate** — snap the picture to a coarse grid. **Block** is the cell size.
- **Blur / sharpen** — one knob: negative blurs, positive sharpens (unsharp mask),
  with its own **Radius**.
- **Edge** — a Sobel outline that traces the shapes instead of filling them.
- **Posterize** — quantise the colours into flat bands. **Levels** sets how many.
- **Halftone** — a rotated dot screen whose dots grow with brightness: the print
  look. Posterize flattens the ramp, this one spends texture on it.
- **Solarize** — invert everything above a brightness **Level**.
- **Chromatic aberration** — split red and blue radially, so the picture fringes
  toward the corners the way a cheap lens does.
- **Mirror** — fold the image about its centre, on **X**, **Y** or both.
- **Bloom** — the additive glow: a blurred copy of the scene added back over it.
  **Strength** at 0 turns it off entirely.

**Screen (final)** — these go on top of the finished, glowing frame, at your
display's real resolution rather than the fire grid's. They're the "it's a screen
you're looking at" layer, and they only read right after the bloom — a vignette
*under* an additive glow just gets lit back up again.

- **Barrel distortion** — bulge the image as if it were painted on a CRT.
- **Scanlines** — darken alternating rows. **Lines** sets how many across the height.
- **Vignette** — fall off toward the corners.
- **Film grain** — animated noise over the whole frame.

Untick everything for the raw effect with no post-processing.

The feedback group is what decides whether the picture starts from a clean slate.
With none of them ticked, every frame is drawn fresh over black — which is what
the shader effects (Plasma, the fractals, Tunnel, …) have always done. Tick any
one and the previous frame stays put — decayed, drifting upward, dragged sideways
or spun — with the new frame laid over the top wherever it's brighter. That's
where trails, smears and long exposures come from.

On machines without WebGL the app falls back to a Canvas2D renderer. Every
feedback filter runs on both paths, so the fallback keeps its trails; the filters
that are GPU passes — everything under Post except Bloom, and all four Screen
ones — are greyed out there rather than pretending to work.

## Diagnostics

The tuning tools live in a collapsible **Diagnostics** section at the bottom of the
menu's **System** box (no more secret keys). They're off by default and never put in a preset (their
open/closed state isn't saved):

- **Frame + FPS counter** — a checkbox that shows/hides the on-screen counter.
- **Beat-detection trace** (a checkbox; also `?debug=1`) — a scrolling plot per band
  of the spectral flux, the adaptive threshold it has to clear, and a tick on every
  detected beat, plus a rough BPM. This is how you see *why* a beat was missed:
  the flux never rose, or it rose but stayed under the threshold. (Shows nothing
  that gets saved.)
**Beat tuning has its own box** in the menu now, not a Diagnostics tool — because it is
part of the scene rather than a dev setting. See below.
Two more tools sit outside that section: each slider's **min / max / step** row
(in its pop-out box — see above), and **Cardioid debug**, a button in **Effects**
for the effects whose seed orbits a cardioid (AnimeJulia, Burning Ship,
Multibrot). It opens the fractal set the seed is riding — the Mandelbrot set, or
the matching Multibrot set once you move Multibrot's **Power** off 2 — with that
orbit drawn on top: the full seed cardioid, the path the seed actually traces at
the current ratio and radii, the little riding circle and the live seed point, so
you can see exactly where your **Cardioid RPM / ratio / radius / start / X
offset** settings land.
It's a floating panel, not a modal: the menu stays live underneath it, so you can
drag those sliders and watch the orbit redraw. **×** or **Esc** closes it.

## Beat tuning

Its own box in the menu: live sliders for how beats are detected — per-band
**sensitivity** (lower = more beats), the **relative floor**, per-band **refractory**
gap (the minimum time between two beats), and each band's **frequency range** in Hz.
**Reset** restores the shipped defaults. Open the **Beat-detection trace** in
Diagnostics alongside it and you can watch the effect of every change.

**The tuning is part of the preset**, not a global setting — so a punchy kick-driven
scene and a hi-hat-driven one can each detect beats their own way, and switching
between them switches the tuning too. It rides along in presets, Share links and
Backups, which means a scene you send someone reacts to music the way you set it up.

### What a shared scene does and doesn't carry

A preset is a complete copy of the settings: every slider, the palette, the filters,
the camera, the beat chips and pulse shapes, the beat tuning, and any slider bounds
you widened. A few things deliberately stay behind:

- **Render resolution** is yours, not the scene's — otherwise a scene built on a fast
  GPU could bring a laptop or phone to a crawl with no obvious cause.
- **Audio** can't be started for you; browsers require you to click. A beat-reactive
  scene wanders gently until you turn on Capture or Mic.
- **The random bits stay random** — where a Julia orbit starts (unless you turn off
  Random seed), the chaos game's speckle, and how far into its cycle the animation is.

So a shared scene is the same *configuration*, not the same *frame*. Open the same link
twice and it won't be pixel-identical — that's the demo running, not something broken.

## Credits

On startup the credits appear over whatever is running — each person's role and
name, in the same layout as the **Credits** box in the menu, since both are
generated from the same list. They hold for five seconds, then fade out over
three. They are drawn on their own layer above the visual, so they stay readable
whatever effect and filters you have on (Pixelate and Mirror used to chew them
up), and they ignore the camera and zoom.

That menu box also has a checkbox to stop them appearing on future visits
(remembered in this browser only, and kept out of presets, share links and backups
since it's a per-browser preference). `?credits=<seconds>` overrides the **hold**
if you want a longer look; the three-second fade is always added on top.

## Running locally

It's a single self-contained `index.html` — no build step, no dependencies.
Open the file directly in a browser, or serve the folder:

```sh
python -m http.server
# then open http://localhost:8000
```

## Tech

A single self-contained `index.html` — vanilla JavaScript, no build step, no
dependencies. The per-pixel work (fire propagation, palette + glow, and the Julia
escape-time) runs on the GPU via **WebGL2**, with a Canvas2D fallback if WebGL2
is unavailable. The deterministic chaos game stays on the CPU and is drawn as
additive GL points. Hosted on GitHub Pages. Settings persist in `localStorage`.

A first-run **"Sync with your music"** nudge explains the Capture/Mic audio
buttons to visitors who haven't tried them yet — shown at three growing gaps of
active time (30s, 5min, 1h), at most three times, never again once an audio
source has been used. A **Google Analytics 4** hook (page views plus custom
events like Capture-button clicks) is active via the `GA_MEASUREMENT_ID`
constant. Clearing that constant back to `""` makes the whole hook inert again —
no script loaded, nothing sent.
