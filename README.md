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

An **Effect** selector at the top of the panel switches between fifteen visuals
that share the same palette, glow and music-reactivity pipeline — but each is an
independent "scene" that remembers its own settings (see Controls):

- **Sirpinfyer** — the classic 2D Sierpiński-**triangle** fire described below.
- **Tetrafyer** — the same fire seeded by a 3D Sierpiński **tetrahedron** that
  is a rigid body **bouncing inside a rubbery box** in front of a fixed camera.
  Each of the four corners collides with the walls under impulse-based physics
  (isotropic inertia, near-elastic restitution), so a corner-hit realistically
  kicks the solid into a tumble; each hit bursts a fading sphere of points out
  from the impact point. The chaos game runs in 3D between the physics-driven
  vertices and is perspective-projected, and a slow orbit shows the box as solid 3D.
- **AnimeJulia** — an animated Julia set. The seed `c` is orbited around the
  Mandelbrot plane along two stacked loops: a large slow loop tracing just
  outside the inner bound (the main cardioid, pushed slightly outward) so the
  Julia set stays intricate, plus a much smaller, faster circle riding on top
  that only ever nudges the seed further out — never into the interior. The big
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
  - **Multibrot** — `z^power + c` with an animatable exponent that morphs the number of bulbs.
  - **Newton** — the three interlocking root-basins of `z³−1` with fractal borders (Root spin / Relaxation).
  - **Attractor** — a de Jong strange attractor whose four coefficients a/b/c/d morph its delicate threads.

## How it works

- **Fire** — a low-resolution heat buffer where each cell averages the pixels
  below it with a slight decay, so heat rises and flickers. This is the classic
  algorithm from [Lode's computer graphics tutorial](https://lodev.org/cgtutor/fire.html).
- **Sierpiński seed** — the fractal is generated with the
  [chaos game](https://en.wikipedia.org/wiki/Sierpi%C5%84ski_triangle): repeatedly
  jump halfway toward a randomly chosen corner. **Sirpinfyer** uses a 2D triangle
  (three corners); **Tetrafyer** uses a 3D tetrahedron (four vertices), running the
  walk in 3D and perspective-projecting each point. Each point is stamped into the
  fire buffer as maximum heat, so flames rise out of the fractal.
- **Moving geometry** — the triangle's corners drift on their own `sin`/`cos`
  mixes driven by the wall clock, fit into a safe box (clear of the top 20% and
  the left/right/bottom 5%) so the fractal never runs off the edges. The
  tetrahedron instead moves under the rigid-body physics described above,
  ricocheting off the walls of its container.
- **Deterministic point cloud** — the chaos game uses a seeded PRNG (mulberry32)
  that resets to the same value every frame, so the point *sequence* is identical
  each frame. Only the moving geometry reshapes the fractal — no random shimmer.
- **Palettes & glow** — fifteen classic demoscene-style palettes to choose from
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

**Each effect is a fully independent scene** — its sliders, beat chips, pulse
shapes, palette, palette cycle, show-box and hold time are all remembered *separately
per effect*, so
tweaking Tetrafyer never touches AnimeJulia. Only auto-cycle on/off and the
panel's open/closed state are shared. Everything is **saved to your browser** and
restored on your next visit (persisted values that fall outside a slider's
current range are ignored, so updates can't load junk). The **?** by the title
opens an effect-aware help panel; a small **frame counter + rolling FPS** sits in
the top-right corner.

**Pop out a slider** — every slider has a small **+** button. Click it to break
that slider out into its own box in a column to the right of the menu; the menu
keeps the slider's name with a **−** to put it back. Pop out several and the boxes
stack from the top down, so you can line up just the controls you're playing with.
(This layout is per-session and isn't saved.) A box gives the slider room for
everything that belongs to it: its value, the **L / M / H** beat chips and
**pulse-shape** picker, a **Pulse** knob for how long its beat kick lasts, and a
**min / max** row that retunes that slider's own range live. **↺ resets the whole
slider** — value, bounds, beat chips, pulse shape and pulse length all go back to
this effect's defaults, so a slider you've wandered somewhere strange is one click
from sane. Custom bounds are saved: they persist in your browser, ride along in a
**Share** link and go into your **Backup**.

**The menu is five foldable sections** — click a heading's chevron to collapse it:
**System** (audio, resolution and the diagnostics tools; folded by default),
**Backup, restore & share**, **Scene** (which preset and effect), **Effect
settings** (the selected effect's sliders) and **Palette settings** (the ramp, how
fast it cycles, and banding).

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
single sliders, dropdowns or toggles. Everything except auto-cycle and panel
visibility is remembered per effect.

| Control | What it does |
| --- | --- |
| **Presets** | A preset is a named full scene (the effect + all its settings). Pick one to load it; from then on every change is **auto-saved** back into it. **New** saves the current scene as a fresh preset (and selects it), **Delete** removes the selected one. Pick "— custom —" to tweak without touching a saved preset. Switching to a preset also morphs the palette to a fresh random one. At the top of the panel, **Backup** downloads a full `.json` snapshot — every preset **plus** all your saved settings (each effect's current values, custom slider ranges, beat-detection tuning, the active effect, auto-cycle, render resolution — everything the app remembers). **Restore** loads it back: a dialog lets you tick **which parts** to bring in (presets, effect settings, slider ranges, beat tuning) and, for presets, whether to **merge** (overwrite same-named, keep the rest) or **replace** (delete yours, use only the backup's). Applying reloads the page. |
| **Effect** | Switch between all fifteen effects listed above, in dropdown order (Sirpinfyer, Tetrafyer, AnimeJulia, Plasma, Tunnel, Metaballs, Burning Ship, Kaleidoscope, Rotozoomer, Munching Squares, Moiré, Newton, Multibrot, Copper Bars, Attractor). Each shows its own sliders. |
| **Auto-cycle presets** | When on, a random saved preset is applied every so often (needs ≥2 presets); off to stay put. *(Shared, not per-effect.)* |
| **Preset TTL** *(ranged, seconds)* | How long auto-cycle holds each preset before applying a random other one — a random time drawn from this range. Grays out while auto-cycle is off. *(Global, not per-effect.)* |
| **Palette** | Pick one of fifteen demoscene-style colour ramps. |
| **Palette cycle** | How long one blend to a random palette takes, as a min–max range in seconds — each cycle picks a time inside it. Collapse both thumbs to **0** for a fixed palette that never cycles. (This replaced the old Auto-morph checkbox.) |
| **React to music** | **Capture** system/tab audio (e.g. Spotify) or **Mic**; the audio is split into low/mid/high bands with per-band beat detection (see below). |
| **Banding** *(ranged)* | Most shader effects (AnimeJulia, Plasma, Metaballs, Burning Ship, Kaleidoscope, Rotozoomer, Moiré, Newton, Multibrot, Copper Bars) — strength of the light/dark contour-stripe filter over the active palette. |
| **Band size** *(ranged)* | Shader effects with banding — colours per light (and per dark) run in the banding pattern. |
| **Darkness** *(ranged)* | Shader effects with banding — how far the banding's dark runs are darkened. |
| **Points** | Number of chaos-game points per frame (100–8000). *(Sirpinfyer / Tetrafyer.)* |
| **Layers** | −/+ stack up to 6 copies of the fractal; each added copy is half the size and half the points of the last, with a new seed, so it drifts/tumbles independently. *(Sirpinfyer / Tetrafyer.)* |
| **Drift speed** *(ranged)* | How fast the triangle's corners move / the tetrahedron's physics tempo. *(Sirpinfyer / Tetrafyer.)* |
| **Flame rise** *(ranged)* | How tall the flames climb before fading (linear in height). *(Sirpinfyer / Tetrafyer.)* |
| **Size** *(ranged)* | Scales the fractal about its centre — the triangle, or the tetrahedron with matching physics. Distinct from Zoom. *(Sirpinfyer / Tetrafyer.)* |
| **Rotation** *(ranged)* | Tetrafyer only — spin rate in degrees/second for the scene orbit around the box. 0 holds still. |
| **Show box** | Show or hide the wireframe of the box the tetrahedron bounces in, along with the spark-sphere burst each wall hit throws off. *(Tetrafyer.)* |
| **Box size** *(ranged)* | How large the box the tetrahedra bounce inside is — bigger gives them more room. *(Tetrafyer.)* |
| **Zoom** *(ranged)* | Zoom the whole view in and out. |
| **Cardioid RPM** *(ranged)* | AnimeJulia only — how fast the big seed loop orbits the Mandelbrot cardioid. |
| **Inner : outer ratio** *(ranged)* | AnimeJulia only — how many times the small seed circle spins per big-loop lap. Defaults to the hypocycloid ratio implied by the two circumferences (≈21.5×). |
| **Inner radius** *(ranged)* | AnimeJulia only — the size of the small circle riding on the seed. Small values keep the seed just outside the cardioid; large values can dip it inside. |
| **Outer radius** *(ranged)* | AnimeJulia only — the scale of the big cardioid loop the seed traces. Larger values push the whole orbit outward. |
| **Cardioid start** *(ranged)* | AnimeJulia only — an offset added to the seed's position around the cardioid, in laps (0 and 1 are the same point, 0.5 is halfway round). |
| **Random seed each reload** | AnimeJulia only — when on (the default), the fractal opens from a fresh random spot on the cardioid every page load and each time you switch to the effect. Turn off for a fixed, reproducible starting frame. |
| **Speed** *(ranged)* | Plasma only — how fast the waves animate (0 freezes the field). |
| **Scale** *(ranged)* | Plasma only — spatial frequency of the waves (fine vs coarse pattern). |
| **Warp** *(ranged)* | Plasma only — domain warp: bends the waves into swirls (0 = clean interference). |
| **Reset this effect** | Restore only the current effect's settings to their defaults (other effects and shared controls are left alone). |
| **Share** | Copies a URL that reopens the page with every effect's current settings (saved presets stay local to your browser and are not shared). Works offline — the whole scene rides in the link. |
| **Short link** | Copies a short `tinyurl.com` link to the same scene. Needs the internet, and hands the (long) share URL to TinyURL to store — use **Share** if you'd rather nothing left your browser. Handy because a full share link is a few thousand characters and some chat apps truncate long links. |

Press **M** or **☰** to toggle the menu, **F** or **⛶** for fullscreen (works on
mobile too), and click the canvas to pause. The frame + FPS counter is a checkbox in
the menu's **Diagnostics** section. A **Resolution** control drops the render
resolution on low-end devices. If your browser requests **reduced motion**, the
page opens paused (a static frame) — click the canvas to animate. On mobile,
tab/screen audio capture isn't available, so only **Mic** is shown.

## Filters

Under **Filters** in the menu is a list of post-processing effects you can stack
on top of whatever effect is running — tick as many as you like and they apply in
order. Each one's settings appear underneath it while it's ticked, and the whole
selection is remembered per effect and saved into presets.

- **Fire** — the rising, cooling heat simulation. It used to be hardwired to the
  three point effects; now any effect can burn. **Flame rise** sets how tall the
  flames climb, **Burn rate** how many times a second the fire advances.
- **Fade pixel** — every pixel keeps a fraction of its brightness each tick, so
  the image smears into phosphor trails. **Keep** near 100% holds almost forever.
- **Pixelate** — snap the picture to a coarse grid. **Block** is the cell size.
- **Blur / sharpen** — one knob: negative blurs, positive sharpens (unsharp mask),
  with its own **Radius**.
- **Edge** — a Sobel outline that traces the shapes instead of filling them.
- **Posterize** — quantise the colours into flat bands. **Levels** sets how many.
- **Mirror** — fold the image about its centre, on **X**, **Y** or both.
- **Bloom** — the additive glow: a blurred copy of the scene added back over it.
  **Strength** at 0 turns it off entirely.

Untick everything for the raw effect with no post-processing. Fire and Fade run
on the retained heat, before the effect's fresh output is mixed in; the rest work
on the finished colour image, so they behave the way their names suggest.

On machines without WebGL the app falls back to a Canvas2D renderer, and the
filters that are GPU passes (Pixelate, Blur/sharpen, Edge, Posterize, Mirror) are
greyed out there rather than pretending to work. Fire, Fade and Bloom run on both.

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
- **Beat tuning** (a collapsible section; also `?beat=1`) — live sliders for the
  detector, meant to sit beside the trace: per-band **sensitivity** (lower = more
  beats), the **relative floor**, per-band **refractory** gap, and each band's
  **frequency range**. Unlike the trace, the values you set **are saved** (in your
  browser and in Backups — not in Share links or presets); **Reset** restores the
  shipped defaults.
Two more tools sit outside that section: each slider's **min / max / step** row
(in its pop-out box — see above), and **Cardioid debug**, a button in **Settings**
for the effects whose seed orbits the Mandelbrot cardioid (AnimeJulia, Burning
Ship, Multibrot). It opens the Mandelbrot set with that orbit drawn on top — the
full seed cardioid, the path the seed actually traces at the current ratio and
radii, the little riding circle and the live seed point — so you can see exactly
where your **Cardioid RPM / ratio / radius / start / X offset** settings land.
It's a floating panel, not a modal: the menu stays live underneath it, so you can
drag those sliders and watch the orbit redraw. **×** or **Esc** closes it.

## Credits

On startup the credits are **burned into the effect itself** rather than drawn over
it: the two lines are rasterised and stamped into the fire's heat grid, so they
pick up whatever palette and glow the running effect has, and — with the Fire
filter on — rise and burn away by themselves after about three seconds.

They're also listed under **Credits** at the foot of the menu, with a checkbox to
stop them appearing on future visits (remembered in this browser only, and kept
out of presets, share links and backups since it's a per-browser preference).
`?credits=<seconds>` overrides the duration if you want a longer look.

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
