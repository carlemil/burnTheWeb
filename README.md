# burnTheWeb

A GPU demoscene visual built around a classic **fire effect**: flames seeded by
an animated **Sierpiński fractal** (2D triangle or bouncing 3D tetrahedron) or an
**animated Julia set**, all coloured through the same palette + glow pipeline. A
chaos-game point cloud stamps the fractal into the fire as fresh heat every tick,
so the whole thing burns, flickers, and morphs continuously — and it can **react
to whatever music you're playing**.

🔥 **Live demo:** https://carlemil.github.io/burnTheWeb/

## Effects

An **Effect** selector at the top of the panel switches between three visuals
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
  as heat and coloured through the same fire palettes.

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
3-bar meter shows it working). Each ranged slider has three tiny **L / M / H**
toggle chips: arm one and — while audio is on — the slider stops drifting and
instead rests at its low thumb, snapping to its high thumb on each beat in that
band and dropping back within 0.2s (so the range width sets how big the pulse
is). The chips are remembered per effect and persisted. Pinned sliders (thumbs
together) have no range to pulse within, so widen a slider to make it react.

*(ranged)* controls are the two-thumb sliders described above; the rest are
single sliders, dropdowns or toggles. Everything except auto-cycle and panel
visibility is remembered per effect.

| Control | What it does |
| --- | --- |
| **Presets** | A preset is a named full scene (the effect + all its settings). Pick one to load it; from then on every change is **auto-saved** back into it. **New** saves the current scene as a fresh preset, **Delete** removes the selected one. Pick "— custom —" to tweak without touching a saved preset. |
| **Effect** | Switch between **Sirpinfyer** (triangle fire), **Tetrafyer** (tetrahedron bouncing in a box) and **AnimeJulia** (animated Julia set). |
| **Auto-cycle presets** | When on, a random saved preset is applied every so often (needs ≥2 presets); off to stay put. *(Shared, not per-effect.)* |
| **Preset TTL** *(ranged, seconds)* | How long auto-cycle holds each preset before applying a random other one — a random time drawn from this range. |
| **Palette** | Pick one of eight demoscene-style colour ramps. |
| **Auto-morph palettes** | Continuously blend to a random palette over 8 seconds, on repeat. |
| **React to music** | **Capture** system/tab audio (e.g. Spotify) or **Mic**; the audio is split into low/mid/high bands with per-band beat detection (see below). |
| **Banding** *(ranged)* | Strength of the light/dark contour-stripe filter over the active palette. |
| **Band size** *(ranged)* | Colours per light (and per dark) run in the banding pattern. |
| **Darkness** *(ranged)* | How far the banding's dark runs are darkened. |
| **Points** | Number of chaos-game points per frame (100–8000). *(Sirpinfyer / Tetrafyer.)* |
| **Drift speed** *(ranged)* | How fast the triangle's corners move / the tetrahedron's physics tempo. *(Sirpinfyer / Tetrafyer.)* |
| **Flame rise** *(ranged)* | How tall the flames climb before fading (linear in height). *(Sirpinfyer / Tetrafyer.)* |
| **Show box** | Show or hide the wireframe of the box the tetrahedron bounces in. *(Tetrafyer.)* |
| **Zoom** *(ranged)* | Zoom the whole view in and out. |
| **Cardioid RPM** *(ranged)* | AnimeJulia only — how fast the big seed loop orbits the Mandelbrot cardioid. |
| **Inner : outer ratio** *(ranged)* | AnimeJulia only — how many times the small seed circle spins per big-loop lap. Defaults to the hypocycloid ratio implied by the two circumferences (≈21.5×). |
| **Cardioid start** *(ranged)* | AnimeJulia only — an offset added to the seed's position around the cardioid, in laps (0 and 1 are the same point, 0.5 is halfway round). |
| **Reset this effect** | Restore only the current effect's settings to their defaults (other effects and shared controls are left alone). |
| **Export / Import settings** | Copy the current effect's settings to the clipboard as text (also handy to paste to Claude to bake in as new defaults), or paste such a string back to apply it. |

The fire runs at full resolution (there is no resolution control). Press **H** or
**☰** to toggle the panel, **F11** for fullscreen, and click the canvas to pause.

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
