# Effect ideas — demo & game effects we haven't built yet

A curated backlog, written 2026-08-06 (at v1.15.0: 21 effects, 22 filters, 16 transitions).
High-end entries assume a powerful GPU. Everything here was chosen to FIT the engine — an
effect writes scalar heat to `.r` and gets its colour from the palette pipeline, so ideas
that are inherently "one animated scalar field" rank above ones that need real RGB.

★ = recommended, ★★ = flagship pick. See the build order at the bottom.

## A. Missed demoscene classics (cheap, high nostalgia)

| Effect | What it is | How it fits |
|---|---|---|
| ~~**Kefrens bars**~~ ✅ | SHIPPED in 1.16.0 | weaving ribbons, Bars / Sway / Speed / Bar width |
| ~~**Twister**~~ ✅ | SHIPPED in 1.16.0 | shaded faces + edge seams, up to 3 columns |
| **Starfield / hyperspace** ★ | Parallax 3D starfield that smears into warp streaks — a beat-armable **Warp** is the killer feature | Pattern shader; Density / Speed / Warp |
| **Sine scroller** | Marquee text riding a sine wave. Needs a text source (procedural glyph SDFs, or a fixed string; user text is a wire-format question) | Pattern shader; medium effort for the font |
| **Shadebobs** | Additive blobs orbiting Lissajous paths, trailing via the existing Fade filter | Nearly covered by Metaballs+Fade; only worth it as a distinct look |
| **Glenz / vector balls** | Classic Amiga: transparent polyhedra or a grid of shaded balls tumbling in 3D | Point-stamp on the Tetrafyer 3D infra, or an SDF shader |

## B. Organic / natural fields (palette-native beauty)

| Effect | What it is | How it fits |
|---|---|---|
| **Aurora borealis** ★ | Curtains of light: fbm-warped vertical gradients swaying slowly; made for the Ice/Electric ramps | Pattern shader; Curtains / Sway / Shimmer |
| ~~**Lightning storm**~~ ✅ | SHIPPED in 1.16.0 | value-is-progress Strike + auto Rate, up to 5 bolts |
| **Reaction–diffusion (Gray–Scott)** ★ | Self-organising spots/stripes/coral that never repeat — motion unlike anything shipped | Needs its own ping-pong state texture (precedent: the fire heat pair); heat = chemical V; Feed / Kill / Flow morph the regime |
| ~~**Cymatics / Chladni plate**~~ ✅ | SHIPPED in 1.16.0 | Mode drift morphs, beat chips snap figures |
| **Gerstner ocean** | Rolling sea heightfield lit low, heat by height+slope; sunset ramps | Pattern shader (Gerstner wave sum); Swell / Chop / Wind |
| **Volumetric nebula** | fbm cloud raymarch with light scattering — slow, huge, high-end | Raymarch; Density / Light / Drift; CPU mirror at low steps |
| **Crystal growth** | DLA-style frost creeping from seeds, dissolving and regrowing | Feedback-texture sim like reaction–diffusion |

## C. High-end 3D / raymarched flagships

| Effect | What it is | How it fits |
|---|---|---|
| ~~**Mandelbulb**~~ ✅ | SHIPPED in 1.16.0 | 64-step raymarch, Power 2–12, halo on misses |
| **Menger sponge flythrough** ★ | Infinite cubic lattice dive — thematically perfect beside Sierpiński (it IS the 3D Sierpiński carpet) | Raymarch, cheap SDF; Dive speed / Rotation / Hollow |
| **Quaternion Julia (4D)** | Raymarched 4D Julia slices whose seed rides the SAME cardioid-orbit machinery AnimeJulia uses | Raymarch; reuses `juliaSeed` and the Orbit editor for free |
| **Kleinian limit set** | Wada-basin sphere packings — the exotic showpiece | Raymarch; niche but jaw-dropping |
| **Black hole** | Accretion disk with gravitational lensing and doppler shading | The one most likely to read as "how is this in a browser" |
| **3D metaball goo** | Smooth-min blobs merging in 3D (the lava lamp done properly) | Raymarch; reuse the solids physics for blob centres |

## D. Point-accumulation (the underused family — 3 of 21 effects)

| Effect | What it is | How it fits |
|---|---|---|
| ~~**Fractal flames**~~ ✅ | SHIPPED in 1.16.0 | additive `stampAdd` + shipped Fade/Diffuse retention turned out to be the density model — no log-normalise pass needed |
| **Lorenz / Thomas / Aizawa** | 3D strange attractors through the Tetrafyer spin+projection — butterfly curves in fire | `stamp()` + existing 3D projection; an Attractor picker |
| **Particle galaxy** | Log-spiral arms, differential rotation, core bloom, beat-pulsed star bursts | `stamp()`; Arms / Twist / Core |
| **Harmonograph** | Decaying pendulum Lissajous ribbons, endlessly re-launching | `stamp()`; cheap and elegant |
| **Boids murmuration** | A starling flock stamping heat, scattering on the beat | CPU sim on the layer (like solids' bodies); Flock / Cohesion / Fear |

## E. Game-style FILTERS (the beat system makes these shine)

| Filter | What it is | How it fits |
|---|---|---|
| ~~**Shockwave**~~ ✅ | SHIPPED (post-1.15.0): the Shock value IS the ring position, so the beat pulse animates the wave — a trick worth reusing (see Lightning) | Done — `FS_SHOCK`, Shock / Push / Ring width |
| ~~**Pixel sort**~~ ✅ | SHIPPED in 1.16.0 | 32-tap directional max-smear |
| **Droste zoom** | Infinite recursive spiral zoom of the image into itself | Post filter; Depth / Twist |
| **Kuwahara oil-paint** | Painterly flattening — every effect looks screen-printed | Post filter; Radius |
| **Hex pixelate** | Hexagonal mosaic (Pixelate covers squares) | Post filter; Size |
| **Lens bubble** | A wandering fisheye magnifier warping the field — the classic demo "lens" | Post filter; Size / Speed |
| ~~**Cellular automaton**~~ ✅ | SHIPPED in 1.16.0 | cyclic CA over retained heat, feedback stage |
| **CRT phosphor + mask** | Shadow-mask RGB triads and phosphor persistence, completing the Scanlines/Barrel set | Post filter; Mask / Persistence |
| **Anaglyph split** | Red/cyan stereo offset breathing with the beat | Post filter; cheap novelty |

## Considered and rejected (poor fit for this engine)

- **Buddhabrot** — needs minutes of accumulation; fights the live-animation model.
- **Cloth / flag / soft bodies** — reads wrong through a 1-D palette ramp.
- **Datamosh** — no real motion vectors in this pipeline; fakes just look like Swirl.
- **Voxel terrain (Comanche)** — the heightfield's own colour IS the content; the ramp fights it.

## Recommended build order (updated after the 1.16.0 eight shipped)

1. **Starfield / hyperspace** (effect) — the last cheap missed classic, with a beat-armed
   **Warp** that smears stars into streaks on the kick.
2. **Aurora borealis** (effect) — fbm-warped light curtains; pure palette-native beauty,
   low risk, Ice/Electric ramps were made for it.
3. **Reaction–diffusion** (effect) — Gray–Scott spots/stripes/coral that never repeat; the
   one remaining piece of new machinery (its own ping-pong state texture — the fire heat
   pair is the precedent).
4. **Menger sponge flythrough** (effect) — Mandelbulb proved the raymarch infra; the sponge
   is a cheaper DE and thematically closes the loop with Sierpiński.
5. **Boids murmuration** (effect) — a starling flock stamping heat, scattering on the beat;
   per-layer CPU sim exactly like the solids bodies.
6. **Lens bubble** (filter) — a wandering fisheye magnifier, the classic demo "lens"; one
   cheap pass.
7. **Droste zoom** (filter) — the picture swallowing itself in an infinite spiral; pairs
   absurdly well with Wedge fold and Kaleidoscope.
8. **Kuwahara oil-paint** (filter) — painterly flattening that makes every effect look
   screen-printed; the strongest remaining "make everything prettier" filter.

Next tier: Quaternion Julia (reuses `juliaSeed` AND the Orbit editor), Gerstner ocean,
Black hole, Glenz/vector balls, Harmonograph, CRT phosphor+mask.
