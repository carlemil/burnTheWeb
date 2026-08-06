  // ---- help popup: effect-aware explanation of every control ----
  const HELP = {
    intro: "Most sliders are <b>ranged</b>: the two thumbs set a low and a high bound and the live value drifts erratically between them — pinch the thumbs together to hold a constant. With <b>React to music</b> on, each slider's L/M/H chips make it react to low/mid/high beats, and the dropdown beside them picks the <b>pulse shape</b> — how the value animates back down after each hit. Everything is saved in your browser, per stacked layer — bar a shared few that belong to the whole scene: auto-cycle and its timing, the whole-scene (Scene) filters, the render resolution, and whether the menu is open.",
    // Per-effect names/blurbs come from the EFFECTS registry (see renderHelp).
    // Each slider blurb's `w:` tag is matched against the effect's `helpTags`
    // (see the EFFECTS registry). "all" shows on every effect; "band" on every
    // shader effect with a Banding slider; the rest are per-effect tags.
    sliders: [
      { n: "Scenes", w: "all", t: "A saved scene is a named full snapshot — the effect plus every setting. Pick one to load it; from then on any change you make is auto-saved straight back into it. New saves what is on screen as a fresh scene, selects it and turns auto-cycle off so it stays up; Rename renames the selected one; Delete removes it and moves you to the one beside it. One scene is always selected, so every change you make is always being saved into something — if you want to experiment without touching a scene you like, press New first and work on the copy. Open a link somebody sent you and that scene is kept too, in a “Shared with you” group of its own, so it can never overwrite a scene of yours; drop the whole group with its ✕ when you are done with it. Your whole library can be kept against a Google account in the Cloud profile box, and published there for other people to load." },
      { n: "Auto-cycle scenes", w: "all", t: "When on, a random saved scene is applied every so often (see Scene TTL) — it cycles whole scenes, not effects, though a scene switch can change the effect too. Turn off to stay put. Needs at least two saved scenes. Creating a scene or restoring a backup switches it off, so the one you just chose stays on screen." },
      { n: "Scene TTL", w: "all", t: "How long auto-cycle holds each scene: a random time in this range (seconds) before applying a random other one." },
      { n: "Transition", w: "all", t: "How long a scene change takes to blend, as a range in seconds — each switch draws a length from it. A suitable transition is chosen automatically for the two scenes involved: a crossfade between two full-screen effects, something that breaks the picture up (pixelate, blur, wipe) when a sparse point cloud meets a dense field, a dip or flash when the palettes jump, and often nothing at all when the scenes already dissolve on their own through Fire or Fade pixel. Collapse both thumbs to 0 to cut straight over instead." },
      { n: "Effect", w: "all", t: "Which visual is running — the chooser at the top of the Effects section, directly above that effect's own sliders. Switching keeps the scene you have selected and folds the change into it, like any other edit — so you carry on working on your scene. The scene keeps its name, so rename it if it no longer suits. Part of a saved scene, so auto-cycle can switch it for you." },
      { n: "Palette", w: "all", t: "The colour ramp this layer's heat is mapped through — click a swatch to pick it. Per-layer, so stacked effects can each carry their own colours (blended together in perceptual OKLab space when they overlap)." },
      { n: "Reverse colours", w: "all", t: "Runs this layer's palette the other way round — the dark (background) end stays black, so only the lit ramp is flipped. Per-layer." },
      { n: "Background", w: "all", t: "What this layer's unlit pixels (heat 0) show: Black (default), White, or the palette's own colour 0. In a multi-layer scene it's per-layer, so a background layer can wash the scene while the ones above keep a black backdrop." },
      { n: "Palette cycle", w: "all", t: "How long one cross-fade to a random new palette takes, as a range in seconds — each cycle draws a fresh duration from it. Pinch both thumbs to 0 to hold the chosen palette still. Every scene switch also blends the palette rather than snapping to it." },
      { n: "Palette hold", w: "all", t: "How long to rest on each palette before starting the next cross-fade, as a range in seconds — a fresh dwell is drawn each time. At 0 (the default) the colours cross-fade continuously with no pause; raise it to sit on each palette for a while between changes. Only matters while Palette cycle is running." },
      { n: "React to music", w: "all", t: "Capture system/tab audio (e.g. Spotify) or the microphone, split into low/mid/high bands. Arm a slider with its L/M/H chips: while audio is on it stops drifting and instead sits at its low end, snapping to its high end on each beat in that band and dropping back over its Pulse time. Chips glow on the beats that drive them, and each menu row shows a small dot per armed band in the same colour — dim at rest, lit on the beat — so you can see what a scene has wired to the music without opening a single box." },
      { n: "Pulse shape", w: "all", t: "The little dropdown beside each slider's L/M/H chips picks the curve the value follows back down after a beat: Snap (linear, the classic), Pluck (fast percussive drop), Sustain (holds high then falls), Ease (smooth S-curve), Bounce (a few decaying bounces), or Steps (retro quantized). Saved per slider, per effect." },
      { n: "Pulse", w: "all", t: "In a slider's pop-out box: how long that slider's beat kick lasts — the time it takes to fall from its high end back to its low end after a beat (0.2s by default). Short is a tight flick, long is a swell. Saved per slider, per effect." },
      { n: "Pop-out boxes", w: "all", t: "The + beside a slider's name breaks it out into its own box to the right of the menu, with room for its value, beat chips, pulse shape, pulse length and range editor; − puts it back. Each box is titled with what it belongs to — the effect or the filter — so a stack of them stays readable. Pop out several and they queue top-down. The layout is per-session, and clears when you change effect or scene." },
      { n: "Slider range (min / max / step)", w: "all", t: "The row at the foot of a slider's pop-out box retunes that slider's own bounds live, so you can push a control past its shipped limits (or make it finer). ↺ restores the shipped range. Custom bounds are saved in your browser, ride along in Share links and go into Backups." },
      { n: "Show box", w: "tetra", t: "Tetrahedron only — ON draws the wireframe box the tetrahedron bounces inside (with a burst of sparks on each wall hit). OFF hides the box and, with no walls to ricochet in, the tetrahedron orbits the centre of the screen instead." },
      { n: "Box size", w: "tetra", t: "Tetrahedron only — zooms the whole scene (box and tetrahedra together). Bigger fills more of the frame; past 1× the box corners run off the edges." },
      { n: "Banding", w: "band", t: "Strength of a filter that posterises the palette into hard light/dark contour stripes." },
      { n: "Band size", w: "band", t: "How many palette colours make up each light (and each dark) stripe." },
      { n: "Darkness", w: "band", t: "How far the dark stripes are darkened (0% = none, 100% = black)." },
      { n: "Points", w: "fire", t: "Chaos-game points stamped per frame — the density and brightness of the fractal seed feeding the fire. Ranged, so spread the thumbs to let the density wander, or arm its L/M/H chips to burst more points on the beat." },
      { n: "Objects", w: "fire", t: "− / + add extra copies of the fractal (up to 6) — the tetrahedra / triangles moving on screen. Each added copy is half the size and half the points of the last, with a new seed, so it drifts/tumbles on its own. (Distinct from the effect stack, also called Layers.)" },
      { n: "Drift speed", w: "fire", t: "Sierpiński: how fast the triangle's three corners wander. Tetrahedron: the physics tempo — how fast it bounces (or orbits, with the box hidden)." },
      { n: "Size", w: "fire", t: "Scales the fractal itself about its centre — Sierpiński's triangle or the Tetrahedron's solid (which grows/shrinks with matching physics). Separate from Zoom, which scales the whole view." },
      { n: "Rotation", w: "tetra", t: "Tetrahedron only — the yaw rate in degrees per second for the scene's rotation about the box. It defaults to 0 (held still); spread the two thumbs to let it drift, or set one thumb to a constant spin." },
      { n: "Box nod", w: "tetra", t: "Tetrahedron only — how far the view pitches up and down in its slow sine, in degrees. This is the second, slower drift that used to be built in with no control at all; 0 holds the box dead level." },
      { n: "Nod speed", w: "tetra", t: "Tetrahedron only — how fast that nod swings, as a multiplier; 0 freezes it mid-swing. Drift speed scales it too, so a faster scene nods faster." },
      { n: "Sway", w: "tetra", t: "Tetrahedron only, and only with Show box OFF — how far the whole object wanders up/down, sideways and in/out around the centre on a slow looping path (0 pins it to the centre so it just spins in place). Each stacked Object wanders on its own phase. The tempo follows Drift speed; arm its L/M/H chips to lunge on the beat." },
      { n: "Zoom", w: "all", t: "Scales the whole view in and out." },
      { n: "Camera X / Y / Z", w: "all", t: "Tilt and spin this layer in 3D, in degrees. X and Y rock it away from you; Z rolls it in the plane of the screen. Per-layer, like Zoom — each stacked effect keeps its own camera, applied to that layer before the layers are blended (in a one-layer scene it's simply the camera over what's running). The startup credits deliberately ignore it and stay level." },
      { n: "Filters", w: "all", t: "A stack of post-effects, all OFF by default — tick the ones you want. Every one is PER-LAYER: each layer keeps its own chain, listed in the order it runs, so two layers can be filtered completely differently before they blend. Where a filter sits in that list matters — above the line it shapes the heat before the effect draws, below it repaints the finished picture — so dragging one across the line changes what it does. Fire and Fade pixel feed back into the layer, building up over successive frames; the rest are single passes. Ticking one reveals its own sliders. Without WebGL the GPU-only ones are greyed out." },
      { n: "Fire", w: "all", t: "The classic rising-fire feedback: heat drifts upward and cools each frame, so whatever the effect draws sprouts flames. Flame rise sets how tall they climb before fading (linear in height); Burn rate how many simulation steps run per second — faster is livelier and flickerier." },
      { n: "Fade pixel", w: "all", t: "Keeps a fraction of the previous frame instead of clearing it, leaving motion trails. Lifetime near 100% smears almost forever; lower values fade quickly. Stacks with Fire." },
      { n: "Pixelate", w: "all", t: "Chunks the image into blocks. Block sets the size — a direct route to a lo-fi console look." },
      { n: "Blur / sharpen", w: "all", t: "One kernel doing both: negative Amount blurs, positive sharpens, 0 is off. Radius sets how far it reaches, so a wide soft blur and a tight crisp edge come from the same pass." },
      { n: "Edge", w: "all", t: "Edge detection over the finished image — Amount fades between the original and the outlines it finds." },
      { n: "Posterize", w: "all", t: "Crushes the colours to a fixed number of Levels, turning smooth gradients into flat bands." },
      { n: "Mirror", w: "all", t: "Reflects the image about its centre. Axis picks horizontal, vertical or both (kaleidoscope-style quadrants)." },
      { n: "Bloom", w: "all", t: "The additive glow around the brightest areas. Per-layer like every other filter, so each layer can glow by a different amount — or not at all. Off by default; add it to a layer's chain and raise Strength." },
      { n: "Cardioid RPM", w: "julia", t: "How fast the seed orbits the big cardioid loop, in revolutions per minute." },
      { n: "Inner : outer ratio", w: "julia", t: "A small circle rides on the seed; this is how many turns it makes per big-loop lap (a spirograph gear ratio). It reshapes the fractal's fine filigree." },
      { n: "Inner radius", w: "julia", t: "Size of the small circle that rides on the seed. Small values keep the seed just outside the cardioid (intricate fractals); larger ones swing it wider and can dip inside for solid-blob frames." },
      { n: "Outer radius", w: "julia", t: "Scale of the big cardioid loop the seed traces. Larger values push the whole orbit outward, further clear of the set, which keeps the fractal intricate rather than solid. Burning Ship ships this high (1.4-1.9) for exactly that reason — wind it down and it washes out faster than the others do." },
      { n: "Cardioid debug", w: "julia", t: "Opens the fractal set this effect's seed is riding — the Mandelbrot set, or the matching Multibrot set once Multibrot's Power is above 2 — with the orbit drawn on top: the full seed cardioid, the path the seed actually traces at the current ratio and radii, the small riding circle and the live seed point. Use it to see where the Cardioid RPM / ratio / radius / start settings put the seed: right at the frontier gives intricate fractals, too far inside gives solid blobs. It floats rather than blocking the menu, so you can drag the sliders and watch the orbit redraw." },
      { n: "Cardioid X offset", w: "julia", t: "Slides the whole seed orbit left or right along the real axis (0 = the Mandelbrot cardioid's own position). Negative walks it toward the bulbs and the spike; positive pushes it out past the cusp. Use Cardioid debug to see where it lands." },
      { n: "Cardioid start", w: "julia", t: "A fixed offset added to the seed's position around the cardioid, in laps (0 and 1 are the same point, 0.5 is halfway round)." },
      { n: "Random seed each reload", w: "julia", t: "When on, the fractal opens from a fresh random spot on the cardioid every page load and each time you switch to this effect. Turn off for a fixed, reproducible starting frame. Applies to all three cardioid-seeded effects (AnimeJulia, Burning Ship, Multibrot)." },
      { n: "Speed", w: "plasma", t: "How fast the plasma's waves animate. 0 freezes the field." },
      { n: "Scale", w: "plasma", t: "Spatial frequency of the waves — how fine or coarse the interference pattern is." },
      { n: "Warp", w: "plasma", t: "Domain warp: bends the waves into swirls. 0 = clean straight interference; higher = turbulent." },
      { n: "Fly speed", w: "tunnel", t: "Tunnel only — how fast you fly down the pipe toward the vanishing point (0 freezes)." },
      { n: "Twist", w: "tunnel", t: "Tunnel only — how fast the pipe rotates around you; negative spins the other way." },
      { n: "Ring density", w: "tunnel", t: "Tunnel only — how many rings are packed along the depth of the tunnel." },
      { n: "Ball count", w: "meta", t: "Metaballs only — how many blobs (2–16). Spread the thumbs to make the count pulse." },
      { n: "Ball size", w: "meta", t: "Metaballs only — each blob's radius; bigger blobs merge into larger gooey masses." },
      { n: "Ball speed", w: "meta", t: "Metaballs only — how fast the blobs drift along their paths (0 freezes them)." },
      { n: "Gain", w: "meta", t: "Metaballs only — overall field strength: raises the threshold so blobs fill more of the screen." },
      { n: "Segments", w: "kaleido", t: "Kaleidoscope only — how many mirror wedges the plane is folded into (the order of symmetry)." },
      { n: "Spin", w: "kaleido", t: "Kaleidoscope only — how fast the whole mandala rotates; negative spins the other way." },
      { n: "Flow", w: "kaleido", t: "Kaleidoscope only — how fast the underlying pattern animates inside the wedges (0 freezes it)." },
      { n: "Rotation", w: "roto", t: "Rotozoomer only — spin rate of the tiled plane; negative spins the other way." },
      { n: "Zoom pulse", w: "roto", t: "Rotozoomer only — how much the tile scale breathes in and out over time (0 holds a fixed zoom)." },
      { n: "Tile density", w: "roto", t: "Rotozoomer only — how many grid cells fill the plane (fine vs coarse texture)." },
      { n: "Munch speed", w: "xor", t: "Munching squares only — how fast the XOR pattern churns (0 freezes a still frame)." },
      { n: "Square size", w: "xor", t: "Munching squares only — the pixel-block size; bigger blocks read as chunkier retro squares." },
      { n: "Detail", w: "xor", t: "Munching squares only — the bit mask the value wraps at; higher = finer nested detail." },
      { n: "Ring frequency", w: "moire", t: "Moiré only — how tightly packed the concentric rings are; higher = finer, more shimmer." },
      { n: "Drift speed", w: "moire", t: "Moiré only — how fast the two ring centres wander over each other (0 holds still)." },
      { n: "Blend", w: "moire", t: "Moiré only — fades the two ring sets between multiply (0, dark webs) and add (1, bright overlaps)." },
      { n: "Root spin", w: "newton", t: "Newton only — rotates the whole basin structure; negative spins the other way." },
      { n: "Relaxation", w: "newton", t: "Newton only — the Newton step size (1 = standard). Away from 1 warps and swirls the basin boundaries." },
      { n: "Power", w: "multibrot", t: "Multibrot only — the exponent in z^power + c, a whole number. 2 is the Julia set; step up for more symmetric bulbs (3, 4, …). It also sets the shape of the seed orbit: the cardioid gains a cusp per step, and the seed sprints through each cusp and slows between them." },
      { n: "Bar count", w: "copper", t: "Copper bars only — how many horizontal bars slide up and down (1–12)." },
      { n: "Bar speed", w: "copper", t: "Copper bars only — how fast the bars bob on their sine paths (0 holds them still)." },
      { n: "Bar width", w: "copper", t: "Copper bars only — the thickness of each gradient bar." },
      { n: "Point jitter", w: "attractor", t: "Attractor only — scatters each plotted point by up to this many pixels, softening the map's hard threads into something more alive. The de Jong map is exact, so 0 gives the bare, razor-thin curves." },
      { n: "Coeff a", w: "attractor", t: "Attractor only — the a coefficient of the de Jong map; one of the four shape knobs. Arm its L/M/H chips to morph on the beat." },
      { n: "Coeff b", w: "attractor", t: "Attractor only — the b coefficient of the de Jong map." },
      { n: "Coeff c", w: "attractor", t: "Attractor only — the c coefficient of the de Jong map." },
      { n: "Coeff d", w: "attractor", t: "Attractor only — the d coefficient of the de Jong map." },
      { n: "Count", w: "solids", t: "Bouncing solids only — how many bodies share the room, up to 8. Each one is a different primitive (see Shape mix) with its own start position, heading and tumble, so they never move as a group." },
      { n: "Size", w: "solids", t: "Bouncing solids only — how big the bodies are. This is also the radius the physics bounces on, so larger solids turn away from the walls sooner and crowd the room; push it far enough and they barely have anywhere to go." },
      { n: "Shape mix", w: "solids", t: "Bouncing solids only — how many different primitives are in play, in order: sphere, box, doughnut, capsule, octahedron, cylinder. 1 gives a room of spheres, 6 gives one of each cycling through the bodies. Arm its L/M/H chips to swap the whole cast on the beat." },
      { n: "Speed", w: "solids", t: "Bouncing solids only — how fast the bodies travel, and so how often they hit a wall. 0 freezes them mid-air, still lit and still spinning down." },
      { n: "Tumble", w: "solids", t: "Bouncing solids only — how fast the bodies rotate. A wall impact converts sideways travel into roll, so an angled clip visibly kicks a body into a tumble; this scales all of that. 0 holds every solid at a fixed orientation." },
      { n: "Edge glow", w: "solids", t: "Bouncing solids only — lights the silhouettes, brightest where a surface turns away from you. Low values give flat shaded solids; high values outline every body in fire and read almost like an X-ray." },
      { n: "Shock", w: "all", t: "The Shockwave filter's wave itself: 1 puts the ring at the centre, 0 has it gone off the edge — so the value IS the ring's position. Arm its L/M/H chips and every beat snaps it to the high thumb and lets it fall, firing a wave that crosses the screen in one Trigger duration." },
      { n: "Push", w: "all", t: "How hard the Shockwave ring displaces the picture as it passes — 0 is an invisible wave, high values shove pixels aside like a blast front." },
      { n: "Ring width", w: "all", t: "How thick and soft the Shockwave ring is, from a hairline ripple to a broad swell." },
      { n: "Cell density", w: "sun", t: "Sun surface only — how many convection cells fill the screen. Low values give a few huge granules; high values a fine boiling texture like the telescope footage." },
      { n: "Churn speed", w: "sun", t: "Sun surface only — how fast the cells boil: drift, deform and brighten or dim. 1× gives each granule a lifetime of roughly 15–30 seconds; 0 freezes the surface." },
      { n: "Lane width", w: "sun", t: "Sun surface only — how wide and soft the dark lanes between cells are. Low values give hairline cracks; high values fat dark borders that shrink the bright cells." },
      { n: "Brightness", w: "sun", t: "Sun surface only — scales the whole surface up or down the palette. Lower it to sit the cells deeper in the ramp's oranges; raise it to push the centres toward white heat." },
      { n: "Bars", w: "kefrens", t: "Kefrens bars only — how many ribbons weave down the screen, up to 12." },
      { n: "Sway", w: "kefrens", t: "Kefrens bars only — how far the ribbons wander sideways. High values whip them across the full width." },
      { n: "Speed", w: "kefrens", t: "Kefrens bars only — how fast the ribbons weave. 0 freezes the tangle." },
      { n: "Bar width", w: "kefrens", t: "Kefrens bars only — how fat each ribbon is. Thin bars read as threads, fat ones as overlapping silk." },
      { n: "Columns", w: "twister", t: "Twister only — how many columns stand side by side, up to three, each turning out of phase with its neighbours." },
      { n: "Width", w: "twister", t: "Twister only — how fat the column is (and how far apart multiple columns stand)." },
      { n: "Twist", w: "twister", t: "Twister only — how hard the column is wrung along its height. 0 is an untwisted turning bar; negative reverses the wring." },
      { n: "Speed", w: "twister", t: "Twister only — how fast the column turns. 0 holds it still, faces frozen mid-twist." },
      { n: "Mode", w: "chladni", t: "Cymatics only — the standing wave's mode number. Every value has its own figure; drift the two thumbs apart for continuous morphing, or arm the L/M/H chips and the figure snaps to a new symmetry on the beat." },
      { n: "Mode offset", w: "chladni", t: "Cymatics only — offsets the second wave's mode from the first. 0 is fully symmetric; raising it skews the figure into rectangular patterns." },
      { n: "Sharpness", w: "chladni", t: "Cymatics only — how thin the sand lines are. Low is a soft glow around the nodes, high is a fine engraved line figure." },
      { n: "Shimmer", w: "chladni", t: "Cymatics only — a slow tremble in the plate, so the sand lines breathe instead of standing perfectly still." },
      { n: "Strike", w: "storm", t: "Lightning storm only — the strike itself: 1 is a fresh bolt at full brightness, decaying to darkness at 0. Arm its L/M/H chips and every beat fires a NEW bolt that fades over the Trigger duration — the storm plays the drums." },
      { n: "Rate", w: "storm", t: "Lightning storm only — automatic strikes per second, for a storm that rolls without music. 0 leaves firing entirely to the Strike chips." },
      { n: "Bolts", w: "storm", t: "Lightning storm only — how many bolts each strike throws down at once, up to five." },
      { n: "Afterglow", w: "storm", t: "Lightning storm only — how much each strike lights the sky behind it, and how much ambient glow remains between strikes." },
      { n: "Power", w: "bulb", t: "Mandelbulb only — the exponent in z → z^p + c. 8 is the classic bulb; low values melt it toward a sphere, high values bristle it with fine lobes. Whole numbers only." },
      { n: "Detail", w: "bulb", t: "Mandelbulb only — how many fractal iterations the surface gets. More is crisper and more filigreed, and costs GPU directly." },
      { n: "Orbit speed", w: "bulb", t: "Mandelbulb only — how fast the camera circles the bulb, with a slow nod built in. 0 parks it." },
      { n: "Glow", w: "bulb", t: "Mandelbulb only — silhouette lighting plus a halo where a ray only just misses the surface. High values wrap the bulb in fire." },
      { n: "Variation", w: "flames", t: "Fractal flames only — the nonlinear fold applied to every step of the chaos game: Sinusoidal, Spherical, Swirl, Horseshoe, Polar or Disc. Each is a different family of shapes; Spherical and Swirl are the classic flame looks." },
      { n: "Morph speed", w: "flames", t: "Fractal flames only — how fast the underlying maps' coefficients orbit, morphing the flame through its family of shapes. 0 freezes the form." },
      { n: "Point glow", w: "flames", t: "Fractal flames only — how much heat every landing point ADDS. Flames accumulate density instead of stamping a fixed heat, so this sets how quickly the dense heart burns toward white." },
      { n: "Star density", w: "stars", t: "Starfield only — how thick the star traffic is across all six parallax depths." },
      { n: "Fly speed", w: "stars", t: "Starfield only — how fast you fly through the field. 0 parks the ship; the stars just twinkle." },
      { n: "Warp", w: "stars", t: "Starfield only — hyperspace: every star smears into a radial streak. Arm its L/M/H chips and the kick punches to warp, easing back as the pulse decays." },
      { n: "Twinkle", w: "stars", t: "Starfield only — how much the stars shimmer. 0 is a steady field." },
      { n: "Curtains", w: "aurora", t: "Aurora only — how many light curtains hang in the sky, up to five, each wandering on its own." },
      { n: "Sway", w: "aurora", t: "Aurora only — how far the whole sky bends the curtains as they hang." },
      { n: "Speed", w: "aurora", t: "Aurora only — how fast the display moves: the wander, the sway and the shimmer all scale with it." },
      { n: "Shimmer", w: "aurora", t: "Aurora only — how restless the light inside each curtain is." },
      { n: "Feed", w: "rd", t: "Reaction-diffusion only — how fast chemical U is replenished. With Kill it chooses the regime: spots, stripes, coral, mazes. Arm its chips and the beat pushes the culture into a new pattern family." },
      { n: "Kill", w: "rd", t: "Reaction-diffusion only — how fast chemical V dies off. Tiny nudges against Feed cross into whole new pattern families." },
      { n: "Sim speed", w: "rd", t: "Reaction-diffusion only — chemistry steps per frame. More is faster evolution, not a different pattern." },
      { n: "Brightness", w: "rd", t: "Reaction-diffusion only — scales the culture up or down the palette ramp." },
      { n: "Dive speed", w: "menger", t: "Menger sponge only — how fast the camera flies forward through the lattice. 0 hangs in the tunnel." },
      { n: "Roll", w: "menger", t: "Menger sponge only — the slow barrel roll (and drift) of the dive." },
      { n: "Detail", w: "menger", t: "Menger sponge only — fractal recursion depth. Each step cubes the holes and multiplies the GPU cost." },
      { n: "Glow", w: "menger", t: "Menger sponge only — lights the tunnel walls and haloes the near-misses." },
      { n: "Flock", w: "boids", t: "Boids only — how many birds fly, up to 200." },
      { n: "Speed", w: "boids", t: "Boids only — how fast the flock flies. Scattering birds also fly faster while Scatter is raised." },
      { n: "Cohesion", w: "boids", t: "Boids only — how strongly the birds pull toward their neighbours. Low is a loose drift, high a tight wheeling ball." },
      { n: "Scatter", w: "boids", t: "Boids only — a rising value blasts the flock apart from its centre (the fall regathers it). Arm its L/M/H chips and every beat is a hawk." },
      { n: "Sunspot", w: "sun", t: "Sun surface only — sinks a sunspot into the centre: a near-black core (the umbra) ringed by fine bright and dark filaments radiating outward (the penumbra) that fade into the granulation. 0, the default, is a clean surface; higher values grow the spot. The camera sliders move it off-centre." },
    ],
  };
  const helpEl = el("help");
  function renderHelp() {
    const e = EFFECTS[effect];
    const rel = HELP.sliders.filter(s => e.helpTags.includes(s.w));   // which slider blurbs apply to this effect
    let html = '<div class="help-box"><button class="help-close" type="button" aria-label="Close">×</button>';
    html += "<h2>burnTheWeb — " + e.name + "</h2><p>" + e.help + "</p>";
    html += '<p class="help-intro">' + HELP.intro + '</p><dl class="help-cols">';
    for (const s of rel) html += "<dt>" + s.n + "</dt><dd>" + s.t + "</dd>";
    html += "</dl></div>";
    helpEl.innerHTML = html;
  }
  function openHelp() { renderHelp(); helpEl.classList.remove("hidden"); }
  function closeHelp() { helpEl.classList.add("hidden"); }
  // The per-box ? — reuses the same modal as the panel help, but focused on one slider:
  // its own blurb (a filter param uses the filter's description; an effect control matches
  // its HELP entry, disambiguated by the live effect's tags — "Drift speed" and "Rotation"
  // each mean two different things), then the shared note on how a slider box works.
  function ctlHelpBlurb(key) {
    const label = ctlLabel(key);
    const f = FILTERS.find(x => Array.isArray(x.params) && x.params.includes(key));
    if (f) return { owner: "Filter · " + f.name, body: f.help || "" };
    const tags = (EFFECTS[effect] && EFFECTS[effect].helpTags) || [];
    const cands = HELP.sliders.filter(s => s.n === label || s.n.split(" / ")[0] === label);
    const s = cands.find(x => tags.includes(x.w)) || cands[0];
    // -1: the help dialog describes the CONTROL, not one layer's copy of it, so it takes the
    // owner line without the "L2 ·" prefix the pop-out boxes carry.
    return { owner: ctlOwner(-1, key), body: s ? s.t : "" };
  }
  const RANGE_BLURB = () => (HELP.sliders.find(s => s.n === "Slider range (min / max / step)") || {}).t || "";
  function openCtlHelp(key) {
    const { owner, body } = ctlHelpBlurb(key);
    let html = '<div class="help-box"><button class="help-close" type="button" aria-label="Close">×</button>';
    html += "<h2>" + ctlLabel(key) + "</h2>";
    if (owner) html += '<p class="help-owner">' + owner + "</p>";
    if (body) html += "<p>" + body + "</p>";
    html += '<p class="help-intro">' + HELP.intro + "</p>";
    const rb = RANGE_BLURB(); if (rb) html += '<p class="help-intro">' + rb + "</p>";
    html += "</div>";
    helpEl.innerHTML = html;
    helpEl.classList.remove("hidden");
  }
  el("help-btn").addEventListener("click", openHelp);
  // The Scenes ? — what a saved scene actually stores. It is a COMPLETE snapshot
  // (snapshotScene / stackItemOut) nesting three scopes: scene-wide, the per-layer stack,
  // and a selected-effect copy that also serves single-layer scenes. Reuses the help modal.
  function openPresetHelp() {
    const tree =
      "<b>scene</b>                     <i>everything on screen — snapshotScene()</i>\n" +
      "├─ name\n" +
      "├─ effect                  <i>the SELECTED layer's effect (a stable name)</i>\n" +
      "├─ state·beat·pulse·plen   <i>selected effect's copy (single-layer fallback)</i>\n" +
      "├─ extra                   <i>…its palette / seed / filters</i>\n" +
      "├─ <b>sceneFx</b>   { on, vals }   <i>Scene filters: Bloom + screen FX</i>\n" +
      "├─ <b>beatTune</b>  { fluxK, floor, refract, bands }\n" +
      "├─ <b>ranges</b>    { slider min/max/step }   <i>scene-wide bounds</i>\n" +
      "└─ <b>layers[ ]</b>                 <i>the stack, draw order (omitted if 1 layer)</i>\n" +
      "   └─ layer  { effect, state, beat, pulse, plen,\n" +
      "               <b>cam</b> { zoom, camrx, camry, camrz },\n" +
      "               palette, paletteRev, paletteBg,\n" +
      "               seedPath, seedRide, seedPts,\n" +
      "               ranges, filters, blend, gain, mute }";
    let html = '<div class="help-box"><button class="help-close" type="button" aria-label="Close">×</button>';
    html += "<h2>What a scene saves</h2>";
    html += "<p>A saved scene is a <b>complete snapshot of what is on screen</b> — the effect stack plus every setting — portable enough to hand to someone else. It nests three scopes of state.</p>";
    html += '<pre class="help-tree">' + tree + "</pre>";
    html += "<dl>";
    html += "<dt>Scene-wide — one per scene</dt><dd>The Scene filters (Bloom + the screen FX), the beat-detector tuning, and the scene-wide slider bounds.</dd>";
    html += "<dt>Per-layer — the stack</dt><dd>Each layer keeps its own effect, slider values, beat wiring, <b>camera</b> (zoom + X/Y/Z, in its own <code>cam</code>), palette, cardioid orbit, its <em>own</em> slider bounds, filters, and how it blends into the stack (blend / gain / mute).</dd>";
    html += "<dt>Selected-effect copy</dt><dd>The top-level effect and its values describe the selected layer — the whole story for a one-layer scene (its camera rides inside that <code>state</code>), and a fallback for a stack (which a one-layer scene omits entirely, so it stays byte-identical to how scenes were stored before stacking).</dd>";
    html += "</dl>";
    html += '<p class="help-intro">Effects are stored as stable names, not positions, so reordering or removing one never corrupts a saved scene. Deliberately <b>not</b> saved: the render resolution, audio on/off, and the running animation phase — a saved scene is the same <em>configuration</em>, not the same <em>frame</em>. Your cloud profile carries the whole library of them; a share link carries just the one.</p>';
    html += "</div>";
    helpEl.innerHTML = html;
    helpEl.classList.remove("hidden");
  }
  el("preset-help-btn").addEventListener("click", openPresetHelp);
  helpEl.addEventListener("click", e => { if (e.target === helpEl || e.target.classList.contains("help-close")) closeHelp(); });

  // ---- version + release-notes link (panel footer) ----
  // Filled in from CONFIG.version so the version string exists in exactly ONE place; the
  // /deploy skill bumps it there and writes the matching CHANGELOG.md section. The href is
  // set here too rather than hardcoded in the HTML, so both come from CONFIG.
  // Guarded: a missing node must not throw during startup and take the whole panel with it.
  {
    const vn = el("vernum"), vl = el("verlink");
    if (vn) vn.textContent = "v" + CONFIG.version;
    if (vl) {
      vl.href = CONFIG.changelogUrl;
      vl.title = "burnTheWeb v" + CONFIG.version + " — what changed in this and previous releases";
      vl.addEventListener("click", () => track("release_notes_open", { version: CONFIG.version }));
    }
  }

  // ---- analytics (Google Analytics 4) ----
  // Live: GA_MEASUREMENT_ID (CONFIG.analyticsId) holds a real "G-XXXXXXXXXX" web-stream
  // id, so gtag.js loads, page views are counted automatically and track() fires custom
  // events. Clearing it back to "" makes this completely inert again — no script is
  // loaded and track() becomes a no-op, so nothing is sent.
  const GA_MEASUREMENT_ID = CONFIG.analyticsId;
  function track(name, params) {
    try { if (window.gtag) window.gtag("event", name, params || {}); } catch (e) {}
  }
  (function initAnalytics() {
    if (!GA_MEASUREMENT_ID) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID);
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
  })();

  // ---- "Sync with your music" nudge ----
  // Shown only to users who haven't successfully started an audio source, at three
  // growing gaps of *active* (tab-visible) time — 30s, then 5min, then 1h — and
  // never more than three times, ever. State persists across reloads.
  const SYNC_KEY = "burnTheWeb.sync.v1";
  const SYNC_DELAYS = CONFIG.sync.delays;
  let syncState = { shows: 0, sinceLast: 0, used: false };
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY) || "null");
    if (s && typeof s === "object") syncState = { shows: s.shows | 0, sinceLast: s.sinceLast | 0, used: !!s.used };
  } catch (e) {}
  function saveSync() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncState)); } catch (e) {} }

  const syncPop = el("syncpop");
  function hideSyncPopup() { syncPop.classList.add("hidden"); }
  function dismissSync() { hideSyncPopup(); track("sync_popup_dismiss"); }
  function showSyncPopup() {
    syncPop.classList.remove("hidden");
    track("sync_popup_shown", { shows: syncState.shows + 1 });
  }
  function markAudioUsed() {          // a source is live — satisfy the nudge permanently
    if (!syncState.used) { syncState.used = true; saveSync(); }
    hideSyncPopup();
  }
  el("sync-close").addEventListener("click", dismissSync);
  el("sync-later").addEventListener("click", dismissSync);
  syncPop.addEventListener("click", e => { if (e.target === syncPop) dismissSync(); });
  el("sync-capture").addEventListener("click", () => { track("sync_popup_capture"); startAudio("capture"); });
  el("sync-mic").addEventListener("click", () => { track("sync_popup_mic"); startAudio("mic"); });

  if (!syncState.used && syncState.shows < 3) {
    const syncTimer = setInterval(() => {
      if (syncState.used || syncState.shows >= 3) { clearInterval(syncTimer); return; }
      if (document.hidden) return;              // only count time while the tab is visible
      syncState.sinceLast += 1000;
      if (syncState.sinceLast >= SYNC_DELAYS[syncState.shows]) {
        showSyncPopup();
        syncState.shows += 1;
        syncState.sinceLast = 0;
        if (syncState.shows >= 3) clearInterval(syncTimer);
      }
      saveSync();
    }, 1000);
  }
