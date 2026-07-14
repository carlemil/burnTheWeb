# burnTheWeb

A GPU demoscene visual built around a classic **fire effect**: flames seeded by
an animated **Sierpiński fractal** (2D triangle or bouncing 3D tetrahedron) or an
**animated Julia set**, all coloured through the same palette + glow pipeline. A
chaos-game point cloud stamps the fractal into the fire as fresh heat every tick,
so the whole thing burns, flickers, and morphs continuously — and it can **react
to whatever music you're playing**.

🔥 **Live demo:** https://carlemil.github.io/burnTheWeb/

## Effects

An **Effect** selector at the top of the panel switches between four visuals
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
- **Palettes & glow** — eight classic demoscene-style palettes to choose from
  (Fire, Ice, Toxic, Copper, Purple, Rainbow, Grayscale, Electric), plus a subtle
  additive bloom that makes the white-hot points glow. An optional auto-morph mode
  continuously blends from the current palette to a random next one over 8 seconds,
  on repeat.
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

**Each effect is a fully independent scene** — its sliders, beat chips, palette,
auto-morph, show-box and hold time are all remembered *separately per effect*, so
tweaking Tetrafyer never touches AnimeJulia. Only auto-cycle on/off and the
panel's open/closed state are shared. Everything is **saved to your browser** and
restored on your next visit (persisted values that fall outside a slider's
current range are ignored, so updates can't load junk). The **?** by the title
opens an effect-aware help panel; a small **frame counter + rolling FPS** sits in
the top-right corner.

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
toggle chips: arm one and — while audio is on — the slider stops drifting and
instead rests at its low thumb, snapping to its high thumb on each beat in that
band and dropping back within 0.2s (so the range width sets how big the pulse
is). The chips are remembered per effect and persisted. Pinned sliders (thumbs
together) have no range to pulse within, so widen a slider to make it react.
Browsers can't silently re-grab tab/screen (or mic) audio after a reload, so the
last source is remembered and re-opened on your **first click/keypress** after
the page loads.

*(ranged)* controls are the two-thumb sliders described above; the rest are
single sliders, dropdowns or toggles. Everything except auto-cycle and panel
visibility is remembered per effect.

| Control | What it does |
| --- | --- |
| **Presets** | A preset is a named full scene (the effect + all its settings). Pick one to load it; from then on every change is **auto-saved** back into it. **New** saves the current scene as a fresh preset, **Delete** removes the selected one. Pick "— custom —" to tweak without touching a saved preset. **Backup** downloads all your presets (and any custom slider ranges) as a `.json` file and **Restore** loads them back (they're otherwise local to this browser). Restore **merges**: a preset in the file overwrites the one with the same name, new names are added, and anything you have that the file doesn't mention is kept — so it never deletes and never duplicates. |
| **Effect** | Switch between **Sirpinfyer** (triangle fire), **Tetrafyer** (tetrahedron bouncing in a box) and **AnimeJulia** (animated Julia set). |
| **Auto-cycle presets** | When on, a random saved preset is applied every so often (needs ≥2 presets); off to stay put. *(Shared, not per-effect.)* |
| **Preset TTL** *(ranged, seconds)* | How long auto-cycle holds each preset before applying a random other one — a random time drawn from this range. Grays out while auto-cycle is off. |
| **Palette** | Pick one of eight demoscene-style colour ramps. |
| **Auto-morph palettes** | Continuously blend to a random palette over 8 seconds, on repeat. |
| **React to music** | **Capture** system/tab audio (e.g. Spotify) or **Mic**; the audio is split into low/mid/high bands with per-band beat detection (see below). |
| **Banding** *(ranged)* | AnimeJulia / Plasma — strength of the light/dark contour-stripe filter over the active palette. |
| **Band size** *(ranged)* | AnimeJulia / Plasma — colours per light (and per dark) run in the banding pattern. |
| **Darkness** *(ranged)* | AnimeJulia / Plasma — how far the banding's dark runs are darkened. |
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
| **Speed** *(ranged)* | Plasma only — how fast the waves animate (0 freezes the field). |
| **Scale** *(ranged)* | Plasma only — spatial frequency of the waves (fine vs coarse pattern). |
| **Warp** *(ranged)* | Plasma only — domain warp: bends the waves into swirls (0 = clean interference). |
| **Reset this effect** | Restore only the current effect's settings to their defaults (other effects and shared controls are left alone). |
| **Export / Import / Share** | **Export** copies the current effect's settings as text (handy to paste to Claude to bake in as new defaults); **Import** pastes such a string back; **Share** copies a URL that reopens the page with every effect's current settings (saved presets stay local to your browser and are not shared). |

Press **H** or **☰** to toggle the panel, **F** or **⛶** for fullscreen (works on
mobile too), and click the canvas to pause. A **Resolution** control drops the render
resolution on low-end devices. If your browser requests **reduced motion**, the
page opens paused (a static frame) — click the canvas to animate. On mobile,
tab/screen audio capture isn't available, so only **Mic** is shown.

## Dev overlays

Two tuning tools, off by default and never put in a preset (their on/off state
isn't saved). A hint at the bottom of the panel points at both:

- **D** (or `?debug=1`) — **beat trace**. A scrolling plot per band of the
  spectral flux, the adaptive threshold it has to clear, and a tick on every
  detected beat, plus a rough BPM. This is how you see *why* a beat was missed:
  the flux never rose, or it rose but stayed under the threshold. (Shows nothing
  that gets saved.)
- **R** (or `?ranges=1`) — **slider range editor**. Ships each slider's
  min/max/step as an attribute, but lets you retune the bounds **live** for the
  currently selected effect. Unlike the beat trace, **the bounds you set are
  saved** — they persist in your browser, travel in a **Share** link and go into
  your **Backup** — so you can fully customize each slider's input range. **Copy
  changed** puts the new attributes on the clipboard for baking into `index.html`
  as new shipped defaults; **Reset** restores those defaults.

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
source has been used. An optional **Google Analytics 4** hook (page views plus
custom events like Capture-button clicks) is wired in but stays completely
inert — no script loaded, nothing sent — until a `G-…` Measurement ID is set in
the `GA_MEASUREMENT_ID` constant.
