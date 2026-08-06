# Effect ideas — demo & game effects we haven't built yet

A curated backlog, written 2026-08-06 (at v1.15.0: 21 effects, 22 filters, 16 transitions).
High-end entries assume a powerful GPU. Everything here was chosen to FIT the engine — an
effect writes scalar heat to `.r` and gets its colour from the palette pipeline, so ideas
that are inherently "one animated scalar field" rank above ones that need real RGB.

★ = recommended, ★★ = flagship pick. See the build order at the bottom.

## A. Missed demoscene classics (cheap, high nostalgia)

| Effect | What it is | How it fits |
|---|---|---|
| **Kefrens bars** ★ | THE missed classic: vertical bars redrawn per scanline with a phase offset, weaving impossible overlapping ribbons | Pattern shader, one pass; Bars / Sway / Speed |
| **Twister** ★ | A vertical column twisted by sine — the rotating "liquorice" bar; optionally several | Pattern shader; Width / Twist / Speed / Count |
| **Starfield / hyperspace** ★ | Parallax 3D starfield that smears into warp streaks — a beat-armable **Warp** is the killer feature | Pattern shader; Density / Speed / Warp |
| **Sine scroller** | Marquee text riding a sine wave. Needs a text source (procedural glyph SDFs, or a fixed string; user text is a wire-format question) | Pattern shader; medium effort for the font |
| **Shadebobs** | Additive blobs orbiting Lissajous paths, trailing via the existing Fade filter | Nearly covered by Metaballs+Fade; only worth it as a distinct look |
| **Glenz / vector balls** | Classic Amiga: transparent polyhedra or a grid of shaded balls tumbling in 3D | Point-stamp on the Tetrafyer 3D infra, or an SDF shader |

## B. Organic / natural fields (palette-native beauty)

| Effect | What it is | How it fits |
|---|---|---|
| **Aurora borealis** ★ | Curtains of light: fbm-warped vertical gradients swaying slowly; made for the Ice/Electric ramps | Pattern shader; Curtains / Sway / Shimmer |
| **Lightning storm** ★ | Beat-TRIGGERED bolts (hash midpoint displacement) with afterglow via Fade — the trigger system's showpiece | Pattern shader; Strike rate / Branching / Glow, chips armed on Strike |
| **Reaction–diffusion (Gray–Scott)** ★ | Self-organising spots/stripes/coral that never repeat — motion unlike anything shipped | Needs its own ping-pong state texture (precedent: the fire heat pair); heat = chemical V; Feed / Kill / Flow morph the regime |
| **Cymatics / Chladni plate** ★ | Standing-wave sand patterns; mode numbers stepping on the beat — the most "music made visible" idea here | Pattern shader, cheap; Modes / Sharpness / Morph |
| **Gerstner ocean** | Rolling sea heightfield lit low, heat by height+slope; sunset ramps | Pattern shader (Gerstner wave sum); Swell / Chop / Wind |
| **Volumetric nebula** | fbm cloud raymarch with light scattering — slow, huge, high-end | Raymarch; Density / Light / Drift; CPU mirror at low steps |
| **Crystal growth** | DLA-style frost creeping from seeds, dissolving and regrowing | Feedback-texture sim like reaction–diffusion |

## C. High-end 3D / raymarched flagships

| Effect | What it is | How it fits |
|---|---|---|
| **Mandelbulb** ★★ | The power-8 3D fractal, slowly orbiting, orbit-trap colouring driving the palette — the crown jewel beside Bouncing solids | Raymarch on the solids/camera infra; Power / Orbit / Detail / Glow; CPU mirror at half steps |
| **Menger sponge flythrough** ★ | Infinite cubic lattice dive — thematically perfect beside Sierpiński (it IS the 3D Sierpiński carpet) | Raymarch, cheap SDF; Dive speed / Rotation / Hollow |
| **Quaternion Julia (4D)** | Raymarched 4D Julia slices whose seed rides the SAME cardioid-orbit machinery AnimeJulia uses | Raymarch; reuses `juliaSeed` and the Orbit editor for free |
| **Kleinian limit set** | Wada-basin sphere packings — the exotic showpiece | Raymarch; niche but jaw-dropping |
| **Black hole** | Accretion disk with gravitational lensing and doppler shading | The one most likely to read as "how is this in a browser" |
| **3D metaball goo** | Smooth-min blobs merging in 3D (the lava lamp done properly) | Raymarch; reuse the solids physics for blob centres |

## D. Point-accumulation (the underused family — 3 of 21 effects)

| Effect | What it is | How it fits |
|---|---|---|
| **Fractal flames** ★★ | Apophysis / Electric Sheep: IFS with nonlinear variations and LOG-DENSITY tone mapping — the most beautiful thing the point pipeline could draw | `stamp(box)` like Attractor + a log-normalise before the palette (the one new pipeline piece); Variation / Coeffs / Gamma |
| **Lorenz / Thomas / Aizawa** | 3D strange attractors through the Tetrafyer spin+projection — butterfly curves in fire | `stamp()` + existing 3D projection; an Attractor picker |
| **Particle galaxy** | Log-spiral arms, differential rotation, core bloom, beat-pulsed star bursts | `stamp()`; Arms / Twist / Core |
| **Harmonograph** | Decaying pendulum Lissajous ribbons, endlessly re-launching | `stamp()`; cheap and elegant |
| **Boids murmuration** | A starling flock stamping heat, scattering on the beat | CPU sim on the layer (like solids' bodies); Flock / Cohesion / Fear |

## E. Game-style FILTERS (the beat system makes these shine)

| Filter | What it is | How it fits |
|---|---|---|
| **Shockwave** ★★ | A radial displacement ring from the centre — armed on the kick, the single highest-impact addition for music sync | Post filter (an `FS_HWARP` cousin); Strength beat-armed, Speed, Width |
| **Pixel sort** ★ | The modern glitch: streak bright pixels along rows/columns above a threshold | Post filter; Threshold / Direction / Length |
| **Droste zoom** | Infinite recursive spiral zoom of the image into itself | Post filter; Depth / Twist |
| **Kuwahara oil-paint** | Painterly flattening — every effect looks screen-printed | Post filter; Radius |
| **Hex pixelate** | Hexagonal mosaic (Pixelate covers squares) | Post filter; Size |
| **Lens bubble** | A wandering fisheye magnifier warping the field — the classic demo "lens" | Post filter; Size / Speed |
| **Cellular automaton** | Heat evolving by CA rules between frames (cyclic CA boils; Life gliders drift) — trippy and nearly free | FEEDBACK filter (heat stage), like Diffuse; Rule / Blend |
| **CRT phosphor + mask** | Shadow-mask RGB triads and phosphor persistence, completing the Scanlines/Barrel set | Post filter; Mask / Persistence |
| **Anaglyph split** | Red/cyan stereo offset breathing with the beat | Post filter; cheap novelty |

## Considered and rejected (poor fit for this engine)

- **Buddhabrot** — needs minutes of accumulation; fights the live-animation model.
- **Cloth / flag / soft bodies** — reads wrong through a 1-D palette ramp.
- **Datamosh** — no real motion vectors in this pipeline; fakes just look like Swirl.
- **Voxel terrain (Comanche)** — the heightfield's own colour IS the content; the ramp fights it.

## Recommended build order

1. **Shockwave filter** — smallest work, biggest beat-sync payoff.
2. **Kefrens bars + Twister** — two cheap classics.
3. **Fractal flames** — the point family's flagship; log-density is the only new machinery.
4. **Mandelbulb** — the high-end headline; the solids infra carries most of it.
5. **Lightning storm** — beat-triggered strikes show off the trigger system.
6. **Reaction–diffusion** — the "how does it keep not repeating" effect.
7. **Cymatics** — cheap, and the most literally music-driven.
