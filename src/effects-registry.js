  // ---- effect registry: the single source of truth for each effect. Adding an
  // effect = append a descriptor here. (Phase 0 holds metadata — name/subtitle/help
  // and the default-preset name; dispatch, controls and persistence move here next.)
  // `name` is the dropdown/help name; `presetName` (optional) is the default preset's
  // name when it differs. Order = the current numeric effect index.
  // Fields per descriptor: `params` = the ordered control keys this effect shows
  // (rendered from the CONTROLS schema; setEffect toggles their visibility);
  // `helpTags` = which HELP.sliders `w:` tags apply; `draw(dt)` = a shader effect that
  // writes heat directly (its presence routes frame() away from the fire sim);
  // `fractal2d` = fire-sim effect stamps the 2D chaos game (else the 3D tetra);
  // `bakesOwnZoom` = zoom is baked into the shader so display zoom is forced to 1;
  // `onEnter()` = run on switching to this effect.
  const EFFECTS = [
    { id: "sirpinfyer", name: "Sierpiński", subtitle: "Sierpiński triangle · classic fire",
      help: "A 2D Sierpiński triangle drawn by the chaos game — repeatedly jump halfway toward a random one of three slowly drifting corners — stamped as fresh heat into a classic rising-fire buffer.",
      params: ["points", "layers", "speed", "size", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"], helpTags: ["all", "fire"], fractal2d: true, bakesOwnZoom: true,
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [22, 22], rise: [52, 52], zoom: [1, 1], size: [1, 1], rot: [0, 0], layers: 3, rpm: [0.03, 0.03], ratio: [21.5, 21.5], inrad: [0.03, 0.03], outrad: [1.05, 1.05], phase: [0, 0], points: [3850, 3850] },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "tetrafyer", name: "Tetrahedron", subtitle: "Sierpiński tetrahedron · classic fire",
      help: "A 3D Sierpiński tetrahedron, a rigid body under real physics whose four tumbling corners seed the same fire. With Show box on it bounces inside an invisible box, bursting a sphere of sparks on each wall hit; with the box off there are no walls, so it orbits the centre of the screen instead. Objects stacks more tetrahedra, each smaller and moving on its own. Two rotations turn the view: Rotation yaws it (0 by default — spread the thumbs to drift) and Box nod pitches it up and down in a slow sine (Nod speed sets how fast).",
      params: ["showbox", "boxsize", "points", "layers", "speed", "size", "rot", "nod", "nodspd", "sway", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"], helpTags: ["all", "fire", "tetra"], bakesOwnZoom: true,
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [23, 23], rise: [105, 105], zoom: [1, 1], size: [1.75, 1.75], rot: [0, 0], nod: [17.2, 17.2], nodspd: [1, 1], sway: [0.5, 0.5], boxsize: [4, 4], layers: 3, rpm: [0.03, 0.03], ratio: [21.5, 21.5], inrad: [0.03, 0.03], outrad: [1.05, 1.05], phase: [0, 0], points: [1500, 1500] },
      beat: {}, extras: { palette: "1", morph: false, showBox: false, randSeed: true } },
    { id: "animejulia", name: "Julia", subtitle: "Julia set · animated seed",
      help: "A live Julia set. The seed point c orbits the rim of the Mandelbrot cardioid; each pixel's escape time is coloured through the palette.",
      params: ["rpm", "ratio", "inrad", "outrad", "phase", "cardx", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim", "randseed"], helpTags: ["all", "julia", "band"],
      bakesOwnZoom: true, cardioid: true, onEnter: () => reseedJulia(), draw: dt => { const s = juliaSeed(dt); if (useGL) glJulia(s); else julia(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [92, 92], rise: [130, 130], zoom: [1, 1], size: [1, 1], rot: [0, 0], layers: 1, rpm: [0.28, 0.28], ratio: [8.5, 8.5], inrad: [0.03, 0.03], outrad: [1, 1], phase: [0, 0], cardx: [0, 0], points: [1500, 1500] },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "plasma", name: "Plasma", subtitle: "Plasma · sinusoidal interference",
      help: "An old-school plasma: several sine/cosine waves interfere across the screen and animate over time, coloured through the palette. Add banding for classic hard contour stripes.",
      params: ["pspeed", "pscale", "pwarp", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "plasma", "band"],
      bakesOwnZoom: true, draw: dt => { if (useGL) glPlasma(plasmaSeed(dt)); else plasma(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], zoom: [1, 1], pspeed: [0.5, 0.5], pscale: [0.9, 0.9], pwarp: [0.4, 0.4] },
      beat: {}, extras: { palette: "3", morph: false, showBox: true, randSeed: true } },
    { id: "tunnel", name: "Tunnel", subtitle: "Tunnel · demoscene flythrough",
      help: "A classic demoscene tunnel: the screen is polar-mapped so concentric rings rush toward the vanishing point. Fly speed drives you forward; Twist rotates the pipe.",
      params: ["tunspeed", "tuntwist", "tunrings", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"], helpTags: ["all", "tunnel"], bakesOwnZoom: true,
      draw: dt => { const s = tunnelSeed(dt); if (useGL) glShaderDraw("tunnel", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uTwist, s.twist); gl.uniform1f(u.uRings, s.rings); gl.uniform1f(u.uZoom, s.zoom); }); else tunnel(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], tunspeed: [0.6, 0.6], tuntwist: [0.1, 0.1], tunrings: [8, 8], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "0", morph: false, showBox: true, randSeed: true } },
    { id: "metaballs", name: "Metaballs", subtitle: "Metaballs · gooey blobs",
      help: "Blobby fields that merge and split like lava-lamp goo — a sum of inverse-square fields from moving centres, soft-saturated. Turn up Banding for hard iso-contour shells.",
      params: ["mbcount", "mbradius", "mbspeed", "mbgain", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "meta", "band"], bakesOwnZoom: true,
      draw: dt => { const s = metaSeed(dt); if (useGL) glShaderDraw("metaball", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uRadius, s.radius); gl.uniform1f(u.uGain, s.gain); gl.uniform1f(u.uZoom, s.zoom); }); else metaballs(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], mbcount: [5, 5], mbradius: [0.16, 0.16], mbspeed: [0.6, 0.6], mbgain: [0.8, 0.8], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "2", morph: false, showBox: true, randSeed: true } },
    { id: "burningship", name: "Burning Ship", subtitle: "Burning Ship · fractal",
      help: "The Burning Ship fractal — like the Julia set but each step folds the value to |Re·Im|, giving jagged, architectural, flame-like structures. The seed orbits the Mandelbrot cardioid exactly like Julia, so it shares those controls.",
      params: ["rpm", "ratio", "inrad", "outrad", "phase", "cardx", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim", "randseed"], helpTags: ["all", "julia", "band"],
      // `locus: "ship"` — the Orbit editor's backdrop. This effect folds Re·Im to its absolute
      // value, so the set of seeds that give a connected fractal is the Burning Ship set, not
      // the Mandelbrot set the other two cardioid effects share. Without this the editor drew
      // the seed comfortably outside a set it was in fact well inside. It does NOT change the
      // seed path, which still rides the Mandelbrot main cardioid on purpose (see CLAUDE.md).
      bakesOwnZoom: true, cardioid: true, locus: "ship", onEnter: () => reseedJulia(),
      draw: dt => { const s = juliaSeed(dt); if (useGL) glShaderDraw("burning", u => { gl.uniform2f(u.uC, s.cx, s.cy); gl.uniform2f(u.uSpan, s.spanX, s.spanY); }); else burningShip(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], zoom: [0.5, 0.5], rpm: [0.2, 0.2], ratio: [8.5, 8.5], inrad: [0.15, 0.15], outrad: [1.4, 1.4], phase: [0, 0], cardx: [0, 0] },
      beat: {}, extras: { palette: "0", morph: false, showBox: true, randSeed: true } },
    { id: "kaleidoscope", name: "Kaleidoscope", subtitle: "Kaleidoscope · mirrored symmetry",
      help: "A moving field folded into mirror-symmetric wedges, like looking down a kaleidoscope. Segments sets the symmetry, Spin rotates the whole thing, Flow animates the pattern. Add banding for sharp mandala rings.",
      params: ["ksegments", "krotspeed", "knoisespeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "kaleido", "band"], bakesOwnZoom: true,
      draw: dt => { const s = kaleidoSeed(dt); if (useGL) glShaderDraw("kaleido", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uSeg, s.seg); gl.uniform1f(u.uRot, s.rot); gl.uniform1f(u.uZoom, s.zoom); }); else kaleidoscope(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], ksegments: [6, 6], krotspeed: [0.1, 0.1], knoisespeed: [0.6, 0.6], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "rotozoom", name: "Rotozoomer", subtitle: "Rotozoomer · rotate + zoom",
      help: "The classic Amiga rotozoomer: a tiled grid texture spun and pulse-zoomed in real time. Rotation sets the spin, Zoom pulse the breathing scale, Tile density how fine the grid is.",
      params: ["rzrot", "rzzoom", "rztile", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "roto", "band"], bakesOwnZoom: true,
      draw: dt => { const s = rotozoomSeed(dt); if (useGL) glShaderDraw("rotozoom", u => { gl.uniform1f(u.uAngle, s.angle); gl.uniform1f(u.uScale, s.scale); gl.uniform1f(u.uTile, s.tile); gl.uniform1f(u.uZoom, s.zoom); }); else rotozoom(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], rzrot: [0.2, 0.2], rzzoom: [0.3, 0.3], rztile: [3, 3], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "munch", name: "Munching Squares", subtitle: "Munching squares · XOR pattern",
      help: "The hypnotic PDP-1 classic: each pixel is ((x XOR y) + time) masked to a value, mapped through the palette. Munch speed animates it, Square size sets the pixel chunkiness, Detail the wrap.",
      params: ["xorspeed", "xorscale", "xormask", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"], helpTags: ["all", "xor"], bakesOwnZoom: true,
      draw: dt => { const s = munchSeed(dt); if (useGL) glShaderDraw("munch", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uScale, s.scale); gl.uniform1f(u.uMask, s.mask); gl.uniform1f(u.uZoom, s.zoom); }); else munch(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], xorspeed: [12, 12], xorscale: [0.35, 0.35], xormask: [255, 255], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "moire", name: "Moiré", subtitle: "Moiré · interference shimmer",
      help: "Two sets of concentric rings drift over each other and interfere into shimmering moiré bands. Ring frequency sets how tight the rings are, Drift speed how fast the centres move, Blend fades between multiply and add.",
      params: ["mofreq", "modrift", "momix", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "moire", "band"], bakesOwnZoom: true,
      draw: dt => { const s = moireSeed(dt); if (useGL) glShaderDraw("moire", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uFreq, s.freq); gl.uniform1f(u.uMix, s.mix); gl.uniform1f(u.uZoom, s.zoom); }); else moire(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], mofreq: [8, 8], modrift: [0.6, 0.6], momix: [0.3, 0.3], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "newton", name: "Newton", subtitle: "Newton fractal · root basins",
      help: "The Newton fractal: each pixel is coloured by which root of z³−1 Newton's method converges to, plus how many steps it took, giving three interlocking basins with fractal borders. Root spin rotates it; Relaxation warps the convergence.",
      params: ["nwspin", "nwrelax", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "newton", "band"], bakesOwnZoom: true,
      draw: dt => { const s = newtonSeed(dt); if (useGL) glShaderDraw("newton", u => { gl.uniform1f(u.uSpin, s.spin); gl.uniform1f(u.uRelax, s.relax); gl.uniform1f(u.uZoom, s.zoom); }); else newton(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], nwspin: [0.05, 0.05], nwrelax: [0.9, 0.9], zoom: [0.8, 0.8], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "multibrot", name: "Multibrot", subtitle: "Multibrot · power sweep",
      help: "The Multibrot family: z^power + c, with the seed orbiting the cardioid like Julia (so it shares those controls). Power now sweeps CONTINUOUSLY — whole numbers give the classic sets (each adds a bulb of symmetry), and the fractions in between morph one into the next, with a characteristic straight seam ray where the fractional exponent's branch cut lies. The seed rides a blend of the two neighbouring whole-power cardioids, sprinting through the cusps and easing off between them.",
      params: ["mbexp", "rpm", "ratio", "inrad", "outrad", "phase", "cardx", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim", "randseed"], helpTags: ["all", "julia", "band", "multibrot"],
      bakesOwnZoom: true, cardioid: true, onEnter: () => reseedJulia(),
      // juliaPower BEFORE juliaSeed: the orbit must ride this frame's power, not the last one's.
      draw: dt => { juliaPower = mbPower; const s = juliaSeed(dt); if (useGL) glShaderDraw("multibrot", u => { gl.uniform2f(u.uC, s.cx, s.cy); gl.uniform2f(u.uSpan, s.spanX, s.spanY); gl.uniform1f(u.uPower, mbPower); }); else multibrot(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], mbexp: [2, 2], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], zoom: [1, 1], rpm: [0.15, 0.15], ratio: [8.5, 8.5], inrad: [0.03, 0.03], outrad: [1, 1], phase: [0, 0], cardx: [0, 0] },
      beat: {}, extras: { palette: "4", morph: false, showBox: true, randSeed: true } },
    { id: "copperbars", name: "Copper Bars", subtitle: "Copper bars · raster sine bars",
      help: "The Amiga copper-bar effect: horizontal gradient bars sliding up and down on sine motion. Bar count, Bar speed and Bar width shape them; the Copper palette gives them their metallic sheen.",
      params: ["cbcount", "cbspeed", "cbwidth", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "copper", "band"], bakesOwnZoom: true,
      draw: dt => { const s = copperSeed(dt); if (useGL) glShaderDraw("copper", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uWidth, s.width); gl.uniform1f(u.uZoom, s.zoom); }); else copperbars(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], cbcount: [5, 5], cbspeed: [0.6, 0.6], cbwidth: [0.08, 0.08], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "3", morph: false, showBox: true, randSeed: true } },
    { id: "attractor", name: "Attractor", subtitle: "Strange attractor · de Jong",
      help: "A de Jong strange attractor — millions of points from x'=sin(a·y)−cos(b·x), y'=sin(c·x)−cos(d·y) stamped into the fire. The four coefficients a/b/c/d are the shape knobs; nudge them (or arm their L/M/H chips) and the delicate threads morph. Points sets the density, Flame rise the glow. The map is exact, so Point jitter scatters each point a little to soften the threads — set it to 0 for the bare, hard-edged curves.",
      params: ["ata", "atb", "atc", "atd", "atjit", "points", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"], helpTags: ["all", "attractor"], bakesOwnZoom: true,
      stamp: (xL, xR, yT, yB, n) => attractorStamp(xL, xR, yT, yB, n),
      defaults: { palcycle: [0, 0], palhold: [0, 0], ata: [1.3, 1.3], atb: [-2.4, -2.4], atc: [2.3, 2.3], atd: [-2.2, -2.2], atjit: [0.5, 0.5], points: [6000, 6000], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    // ---- Geometric shapes (SDF shader effects; append-only for id stability) ----
    { id: "apollo", name: "Apollonian gasket", subtitle: "Apollonian · recursive sphere packing",
      help: "An infinite packing of spheres, each nestled in the gap between the last three, raymarched from inside the gasket. It is built by INVERSION rather than by iteration of a power: each step reflects the point through a sphere and folds it back into the unit cell, so the structure repeats at every scale without ever being drawn twice. **Packing** is the inversion radius and the shape knob — small values open the gaps out, large ones pack them tight and the whole thing turns into filigree. Detail is how many folds (and how much GPU), Halo how tightly the near-miss glow hugs the surface, Glow how bright it burns.",
      params: ["apscale", "apiter", "apthin", "apglow", "apspeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "band"], bakesOwnZoom: true,
      draw: dt => { const s = apolloSeed(dt); if (useGL) glShaderDraw("apollo", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uScale, s.scale); gl.uniform1f(u.uIter, s.iter); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uThin, s.thin); gl.uniform1f(u.uZoom, s.zoom); }); else apollo(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], apscale: [1.15, 1.15], apiter: [8, 8], apthin: [1, 1], apglow: [0.6, 0.6], apspeed: [1, 1] },
      beat: {}, extras: { palette: "7", morph: false } },
    { id: "mbox", name: "Mandelbox", subtitle: "Mandelbox · box-fold fractal",
      help: "The Mandelbulb's architectural cousin. Where the bulb runs a POWER map and grows organic lobes, this folds space — reflect anything outside a box back in, invert anything inside a small sphere, scale, repeat — and the result is hard-edged: corridors, shells and rooms rather than petals. **Scale** is the whole character, and NEGATIVE values are the famous ones (the shipped -1.7 hollows it into chambers); push it positive and it collapses toward a solid block. Fold sets the size of the box being folded against, Detail how many iterations.",
      params: ["bxscale", "bxfold", "bxiter", "bxglow", "bxspeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "band"], bakesOwnZoom: true,
      draw: dt => { const s = mboxSeedFn(dt); if (useGL) glShaderDraw("mbox", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uScale, s.scale); gl.uniform1f(u.uIter, s.iter); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uFold, s.fold); gl.uniform1f(u.uZoom, s.zoom); }); else mbox(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], bxscale: [-1.7, -1.7], bxfold: [1, 1], bxiter: [8, 8], bxglow: [0.5, 0.5], bxspeed: [1, 1] },
      beat: {}, extras: { palette: "3", morph: false } },
    { id: "gyroid", name: "Gyroid", subtitle: "Gyroid · infinite minimal surface",
      help: "A triply-periodic minimal surface — the sheet that soap film makes when it divides space into two interlocking labyrinths that never touch. It is NOT a fractal: it is one smooth infinite lattice, which is why it reads so differently from the two beside it. The entire surface is one line of trigonometry, so it is also the cheapest 3D effect here. **Cell size** sets the scale of the weave, Thickness how solid the sheet is (thin gives a delicate membrane, thick closes the gaps into tunnels), Drift slides the lattice past the camera.",
      params: ["gyfreq", "gythick", "gywarp", "gyglow", "gyspeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "band"], bakesOwnZoom: true,
      draw: dt => { const s = gyroidSeed(dt); if (useGL) glShaderDraw("gyroid", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uFreq, s.freq); gl.uniform1f(u.uThick, s.thick); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uWarp, s.warp); gl.uniform1f(u.uZoom, s.zoom); }); else gyroid(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], gyfreq: [2.2, 2.2], gythick: [0.35, 0.35], gywarp: [0.6, 0.6], gyglow: [0.5, 0.5], gyspeed: [1, 1] },
      beat: {}, extras: { palette: "5", morph: false } },
    { id: "voronoi", name: "Voronoi cells", subtitle: "Voronoi · cracked cellular field",
      help: "A cellular field: space is divided between wandering seed points, and every pixel is coloured by how far it is from the nearest one. **Edge** is the character knob — at 0 you get soft blobs (distance to the nearest seed), at 1 the crack BETWEEN cells (the gap between nearest and second-nearest), which is the shattered-glass look. Cells sets how many, Wander how far each seed drifts from its home, Speed how fast. Nothing else here measures cellular distance — Reaction-diffusion is a chemical simulation and Cellular automaton is a filter over heat.",
      params: ["vocells", "voedge", "vojit", "vospeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "band"], bakesOwnZoom: true,
      draw: dt => { const s = voronoiSeed(dt); if (useGL) glShaderDraw("voronoi", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCells, s.cells); gl.uniform1f(u.uEdge, s.edge); gl.uniform1f(u.uJit, s.jit); gl.uniform1f(u.uZoom, s.zoom); }); else voronoi(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], vocells: [6, 6], voedge: [0.6, 0.6], vojit: [0.7, 0.7], vospeed: [0.5, 0.5] },
      beat: {}, extras: { palette: "2", morph: false } },
    { id: "warpnoise", name: "Flow noise", subtitle: "Flow noise · domain-warped fbm",
      help: "Fractal noise whose INPUT is displaced by more noise, twice over — the marbled, slowly-flowing field that most modern shader work is built on. **Warp** is what makes it: at 0 it is plain cloud noise, and as it rises the field folds into itself and grows filaments and eddies. Scale is how big the features are, Detail how many octaves (and how much GPU), Flow how fast it moves. Plasma is built from sines and cannot make this shape however many you stack.",
      params: ["wnscale", "wnwarp", "wnoct", "wnspeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "band"], bakesOwnZoom: true,
      draw: dt => { const s = warpnoiseSeed(dt); if (useGL) glShaderDraw("warpnoise", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uScale, s.scale); gl.uniform1f(u.uWarp, s.warp); gl.uniform1f(u.uOct, s.oct); gl.uniform1f(u.uZoom, s.zoom); }); else warpnoise(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], wnscale: [3, 3], wnwarp: [4, 4], wnoct: [5, 5], wnspeed: [1, 1] },
      beat: {}, extras: { palette: "4", morph: false } },
    { id: "truchet", name: "Truchet tiles", subtitle: "Truchet · woven arc maze",
      help: "Every tile holds one of two quarter-arc pairs, picked by a coin flip, and because the arcs always meet at the tile edges an endless woven maze falls out of it. **Weave** slides the threshold that decides which way each tile faces, so tiles turn over one at a time rather than the whole grid re-rolling — drift it, or arm it to a beat, and the maze re-knits itself continuously. Tiles sets the grid, Line width the ribbon, Turn rate how fast the flipping travels.",
      params: ["trucells", "truwidth", "truflip", "truspeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "band"], bakesOwnZoom: true,
      draw: dt => { const s = truchetSeed(dt); if (useGL) glShaderDraw("truchet", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCells, s.cells); gl.uniform1f(u.uWidth, s.width); gl.uniform1f(u.uFlip, s.flip); gl.uniform1f(u.uZoom, s.zoom); }); else truchet(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], trucells: [6, 6], truwidth: [0.35, 0.35], truflip: [0.5, 0.5], truspeed: [1, 1] },
      beat: {}, extras: { palette: "9", morph: false } },
    { id: "shapegrid", name: "Shape grid", subtitle: "Shape grid · pulsing lattice",
      help: "A tiled lattice of one shape. Density sets how many cells fill the screen, Size the shape within each cell, Squareness morphs circle → square, and Pulse (with Pulse speed) makes every cell breathe out of phase with its neighbours. Reads like a pulsing dot-grid or checkerboard.",
      params: ["sgcells", "sgdot", "sgsquare", "sgpulse", "sgspeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "shape"], bakesOwnZoom: true,
      draw: dt => { const s = shapegridSeed(dt); if (useGL) glShaderDraw("shapegrid", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCells, s.cells); gl.uniform1f(u.uDot, s.dot); gl.uniform1f(u.uSquare, s.square); gl.uniform1f(u.uPulse, s.pulse); gl.uniform1f(u.uZoom, s.zoom); }); else shapegrid(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], sgcells: [9, 9], sgdot: [0.3, 0.3], sgsquare: [0, 0], sgpulse: [0.35, 0.35], sgspeed: [1.2, 1.2], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "concentric", name: "Concentric rings", subtitle: "Concentric · shape tunnel",
      help: "Nested polygon (or circle) contours radiating out from the centre and marching outward over time — a hypnotic target / shape-tunnel. Sides sets the shape, Ring count how tightly packed the rings are, March speed how fast they travel (negative pulls inward), Thickness the ring width, and Spin rotates the whole thing.",
      params: ["cosides", "cocount", "cothick", "cospeed", "cospin", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "shape"], bakesOwnZoom: true,
      draw: dt => { const s = concentricSeed(dt); if (useGL) glShaderDraw("concentric", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uSides, s.sides); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uThick, s.thick); gl.uniform1f(u.uSpin, s.spin); gl.uniform1f(u.uZoom, s.zoom); }); else concentric(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], cosides: [6, 6], cocount: [6, 6], cothick: [0.4, 0.4], cospeed: [0.6, 0.6], cospin: [0.1, 0.1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "bounce", name: "Bouncing shapes", subtitle: "Bouncing shapes · DVD-logo drift",
      help: "A handful of shapes drifting and bouncing off the edges, DVD-logo style. **Shape mix** is how many different KINDS are in play — 1 is all the same (circle↔square, as it always was), and up to 7 brings in triangles, pentagons, hexagons, stars, rings and crosses, each object picking one and keeping it. Count sets how many objects, Size how big, Squareness morphs circle → square (kind 1 only), Spin how fast they turn — a still triangle reads as a texture, a turning one reads as an object — and Speed how fast they travel. Tick a Fade pixel or Fire feedback filter to give them glowing trails.",
      params: ["bncount", "bnrad", "bnsquare", "bnmix", "bnspin", "bnspeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "shape"], bakesOwnZoom: true,
      draw: dt => { const s = bounceSeed(dt); if (useGL) glShaderDraw("bounce", u => { gl.uniform2fv(u.uPos, s.pos); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uRad, s.rad); gl.uniform1f(u.uSquare, s.square); gl.uniform1f(u.uZoom, s.zoom); gl.uniform1f(u.uMix, s.mix); gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uSpin, s.spin); }); else bounce(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], bncount: [4, 4], bnrad: [0.09, 0.09], bnsquare: [0.6, 0.6], bnmix: [7, 7], bnspin: [0.8, 0.8], bnspeed: [1, 1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "2", morph: false, showBox: true, randSeed: true } },
    { id: "solids", name: "Bouncing solids", subtitle: "Solids · raymarched 3D",
      help: "Real 3D: a handful of solid primitives — sphere, box, doughnut, capsule, octahedron, cylinder — tumbling and ricocheting off the walls of an invisible room, raymarched as signed-distance fields and shaded into the palette by surface angle and depth. Count sets how many bodies, Size how big (which is also the radius they bounce on, so bigger ones turn sooner), Shape mix how many different primitives are in play (1 = all spheres, 6 = all six), Speed how fast they travel and Tumble how hard they spin — a wall hit converts slide into roll, so they kick into a tumble on an angled clip. Edge glow lights the silhouettes. Tick Fire or Fade pixel for trails.",
      params: ["sdcount", "sdsize", "sdmix", "sdspeed", "sdspin", "sdrim", "world", "wldx", "wldy", "wldz", "wldscale", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "solids", "band"],
      bakesOwnZoom: true, solids: true,
      draw: dt => { const s = solidsSeed(dt); if (useGL) glShaderDraw("solids", u => { gl.uniform4fv(u.uPos, s.pos); gl.uniform4fv(u.uQuat, s.quat); gl.uniform1fv(u.uShape, s.shape); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uRim, s.rim); gl.uniform1f(u.uZoom, s.zoom); }); else solids(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], sdcount: [5, 5], sdsize: [0.26, 0.26], sdmix: [6, 6], sdspeed: [1, 1], sdspin: [1, 1], sdrim: [0.55, 0.55], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, world: false, randSeed: true } },
    { id: "sunsurface", name: "Sun surface", subtitle: "Sun surface · solar granulation",
      help: "The boiling surface of the sun, as the Inouye Solar Telescope sees it: a full-screen field of bright convection cells separated by narrow dark lanes, each cell slowly drifting, deforming and brightening as it churns, with tiny bright points sparking in the lanes. Raise Sunspot to sink a dark spot into the middle — a near-black core ringed by fine filaments radiating out into the granulation. Fire-family palettes (Amber, Fire, Ember, Sunburst) give it its colour.",
      params: ["sunscale", "sunspeed", "sunlane", "sunglow", "sunspot", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "sun", "band"], bakesOwnZoom: true,
      // Plasma-shaped draw: the clock advances exactly ONCE per frame on either path —
      // sun(dt) calls sunSeed itself, so nothing may pre-call it before the CPU branch.
      // (The metaballs-style `const s = seed(dt); ... else mirror(dt)` double-advances.)
      draw: dt => { if (useGL) { const s = sunSeed(dt); glShaderDraw("sun", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uDensity, s.density); gl.uniform1f(u.uLane, s.lane); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uSpot, s.spot); gl.uniform1f(u.uZoom, s.zoom); }); } else sun(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], sunscale: [14, 14], sunspeed: [1, 1], sunlane: [0.35, 0.35], sunglow: [1, 1], sunspot: [0, 0], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "8", morph: false, showBox: true, randSeed: true } },
    { id: "kefrens", name: "Kefrens bars", subtitle: "Kefrens · weaving ribbons",
      help: "The classic Amiga effect: vertical bars redrawn at a phase offset on every scanline, so the ribbons weave impossibly through each other. Bars sets how many, Sway how far they wander, Speed how fast, and Bar width how fat each ribbon is. Arm Sway or Speed to a beat to make them lash.",
      params: ["kfbars", "kfsway", "kfspeed", "kfwidth", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "kefrens", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = kefrensSeed(dt); glShaderDraw("kefrens", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uBars, s.bars); gl.uniform1f(u.uSway, s.sway); gl.uniform1f(u.uWidth, s.width); gl.uniform1f(u.uZoom, s.zoom); }); } else kefrens(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], kfbars: [6, 6], kfsway: [0.25, 0.25], kfspeed: [1, 1], kfwidth: [0.045, 0.045], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "3", morph: false, showBox: true, randSeed: true } },
    { id: "twister", name: "Twister", subtitle: "Twister · liquorice column",
      help: "The classic twisting column: a square bar wrung along its height, each face shaded by its angle, bright seams on the edges. Twist sets how hard it is wrung (negative reverses), Speed how fast it turns, Width how fat it is, and Columns puts up to three side by side, out of phase.",
      params: ["twcols", "twwidth", "twtwist", "twspeed", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "twister", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = twisterSeed(dt); glShaderDraw("twister", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCols, s.cols); gl.uniform1f(u.uWidth, s.width); gl.uniform1f(u.uTwist, s.twist); gl.uniform1f(u.uZoom, s.zoom); }); } else twister(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], twcols: [1, 1], twwidth: [0.22, 0.22], twtwist: [2, 2], twspeed: [1, 1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "8", morph: false, showBox: true, randSeed: true } },
    { id: "cymatics", name: "Cymatics", subtitle: "Cymatics · Chladni plate",
      help: "Sand on a vibrating plate: bright lines trace the nodes of a standing wave, and the figure snaps into a new symmetry every time the mode changes. Mode is the wave number — drift its two thumbs apart for continuous morphing, or arm its chips so the figure JUMPS on the beat. Mode offset skews the pattern off square, Sharpness thins the lines, Shimmer makes the sand tremble.",
      params: ["cymode", "cymoff", "cysharp", "cyshimmer", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "chladni", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = cymaticsSeed(dt); glShaderDraw("cymatics", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uModeN, s.n); gl.uniform1f(u.uModeM, s.m); gl.uniform1f(u.uSharp, s.sharp); gl.uniform1f(u.uShim, s.shim); gl.uniform1f(u.uZoom, s.zoom); }); } else cymatics(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], cymode: [3, 3], cymoff: [1, 1], cysharp: [5, 5], cyshimmer: [0.4, 0.4], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "lightning", name: "Lightning storm", subtitle: "Lightning · beat-fired bolts",
      help: "Forked fractal bolts tearing down the screen, each one a fresh shape: a jagged main channel that splits into side branches on its way down, lighting up from the cloud to the ground with a hot racing tip — Strike speed is how fast it travels. Rate fires strikes on a clock; arm Strike's L/M/H chips and the BEAT fires them instead — a kick snaps Strike to full and the bolt decays over the Trigger duration, exactly like Shockwave's ring. Bolts sets how many strike at once, Afterglow how much the sky lights up.",
      params: ["ltstrike", "ltrate", "ltspd", "ltbolts", "ltglow", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "storm", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = stormSeed(dt); glShaderDraw("storm", u => { gl.uniform1f(u.uEnv, s.env); gl.uniform1f(u.uSeed, s.seed); gl.uniform1f(u.uBolts, s.bolts); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); gl.uniform1f(u.uFront, s.front); }); } else storm(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], ltstrike: [0, 0], ltrate: [0.5, 0.5], ltspd: [12, 12], ltbolts: [2, 2], ltglow: [0.5, 0.5], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "mandelbulb", name: "Mandelbulb", subtitle: "Mandelbulb · flight inside a 3D fractal",
      help: "The 3D Mandelbrot: z → z^p + c run in spherical coordinates and raymarched as a solid, with the camera in a slow orbit around it. **Distance** is how far out that orbit sits: the bulb is centred on the origin and its surface stays inside about 1.2, so 2.5 frames the whole solid, 1.5 flies you close over the lobes, and below about 1.2 you are inside it — where the iteration never escapes and there is nothing left to draw, because a Mandelbulb has no hollow middle. Height lifts the orbit off the equator, which shows the lobed structure far better than looking at it dead-on. Power reshapes it continuously — 8 is the classic bulb, low values melt it toward a sphere, high values bristle it, and the fractions in between morph smoothly (drift Power's two thumbs apart and the bulb never stops reshaping around you). Detail adds fractal depth (and GPU cost), Orbit speed is how fast the flight winds through it, Glow lights the walls and puts a halo where a ray only just misses. The heaviest effect in the app — it wants a real GPU.",
      params: ["bpdist", "bplift", "bppower", "bpdetail", "bpspin", "bpglow", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "bulb", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = bulbSeed(dt); glShaderDraw("bulb", u => { gl.uniform3f(u.uPos, s.px, s.py, s.pz); gl.uniform3f(u.uFwd, s.fx, s.fy, s.fz); gl.uniform1f(u.uPower, s.power); gl.uniform1f(u.uIter, s.iter); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); }); } else bulb(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], bpdist: [2.5, 2.5], bplift: [0.8, 0.8], bppower: [8, 8], bpdetail: [7, 7], bpspin: [0.35, 0.35], bpglow: [0.5, 0.5], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "4", morph: false, showBox: true, randSeed: true } },
    { id: "flames", name: "Fractal flames", subtitle: "Fractal flames · IFS density",
      help: "An iterated function system in the Apophysis / Electric Sheep style: the chaos game bounces between two slowly-morphing affine maps, a nonlinear Variation bends every step, and each landing ADDS heat — so the dense heart of the orbit burns white while the wisps stay faint. Variation picks the fold (Spherical and Swirl are the classics), Morph speed orbits the coefficients, Point glow sets how much each landing adds, and Points the density budget.",
      params: ["flvar", "flmorph", "flglow", "points", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"], helpTags: ["all", "flames"], bakesOwnZoom: true, stampAdd: true,
      stamp: (xL, xR, yT, yB, n) => flamesStamp(xL, xR, yT, yB, n),
      // The ONE effect that ships with a filter: additive stamps + Fade retention IS the
      // fractal-flame render model — density accumulates over ~a second and decays, so the
      // dense heart of the orbit stacks toward white while the wisps stay faint. Without
      // retention each tick starts from black and the picture is a sparse dust.
      filters: ["fade", "diffuse"],
      // Points is the density budget of an ADDITIVE stamper, so it wants a range of its own:
      // the shared schema tops out at 24000, which is where flames only starts to fill in.
      // Per-effect bounds (see rngShipped) instead of widening the schema — a 10k floor on the
      // shared slider would clamp every other point effect's shipped default upward.
      ranges: { points: { min: 2000, max: 30000 } },
      defaults: { palcycle: [0, 0], palhold: [0, 0], flvar: [3, 3], flmorph: [0.3, 0.3], flglow: [30, 30], points: [12000, 12000], fade: [0.975, 0.975], diffuse: [0.8, 0.8], diffkeep: [0.985, 0.985], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "starfield", name: "Starfield", subtitle: "Starfield · hyperspace",
      help: "A 3D starfield flying past — six parallax depths of hash-placed stars, each twinkling on its own phase. Warp smears every star into a radial streak: arm its L/M/H chips and the kick punches to hyperspace, easing back as the pulse decays. Star density and Fly speed set the traffic, Twinkle the shimmer.",
      params: ["stdensity", "stspeed", "stwarp", "sttwinkle", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "stars", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = starsSeed(dt); glShaderDraw("stars", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uDensity, s.density); gl.uniform1f(u.uWarp, s.warp); gl.uniform1f(u.uTwinkle, s.twinkle); gl.uniform1f(u.uZoom, s.zoom); }); } else stars(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], stdensity: [1.2, 1.2], stspeed: [1, 1], stwarp: [0, 0], sttwinkle: [0.8, 0.8], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "6", morph: false, showBox: true, randSeed: true } },
    { id: "aurora", name: "Aurora", subtitle: "Aurora · northern lights",
      help: "Curtains of light hanging from the top of the sky, swaying on slow layered waves, each rippling and shimmering on its own phase over a faint horizon glow. Curtains sets how many, Sway how far the whole sky bends, Shimmer how restless the light is. Ice and Electric palettes were made for it; Verdant gives the green aurora.",
      params: ["aucurtains", "ausway", "auspeed", "aushimmer", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "aurora", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = auroraSeed(dt); glShaderDraw("aurora", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCurtains, s.curtains); gl.uniform1f(u.uSway, s.sway); gl.uniform1f(u.uShim, s.shim); gl.uniform1f(u.uZoom, s.zoom); }); } else aurora(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], aucurtains: [3, 3], ausway: [0.5, 0.5], auspeed: [1, 1], aushimmer: [1, 1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "reactdiff", name: "Reaction-diffusion", subtitle: "Gray–Scott · living patterns",
      help: "Two chemicals feeding and killing each other on a dish, forming spots, stripes, coral and mazes that grow and never repeat. Feed and Kill choose the regime — tiny nudges cross into whole new pattern families, and some settings kill the culture outright; when everything dies, the dish quietly re-seeds itself, so exploring (or arming Feed's chips to let the beat push the culture into a new life) is always safe. Sim speed is how many chemistry steps run per frame. The state is ONE shared dish: two layers of it show the same culture.",
      params: ["rdfeed", "rdkill", "rdspeed", "rdgain", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "rd", "band"], bakesOwnZoom: true,
      onEnter: () => { rdNeedSeed = true; rdCpuSeed = true; },
      draw: dt => { const s = rdSeedFn(dt); if (useGL) { glRDTick(s.steps, s.feed, s.kill); glShaderDraw("rdshow", u => { bindTexUnit(0, glTex.rd[rdCur]); gl.uniform1i(u.uState, 0); gl.uniform1f(u.uGain, s.gain); gl.uniform1f(u.uZoom, s.zoom); }); } else rdCPU(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], rdfeed: [0.03, 0.03], rdkill: [0.062, 0.062], rdspeed: [8, 8], rdgain: [1, 1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "2", morph: false, showBox: true, randSeed: true } },
    { id: "menger", name: "Menger sponge", subtitle: "Menger · fractal city drive",
      help: "An endless lattice of Menger sponges — the 3D Sierpiński carpet — raymarched while the camera drives the streets between them, turning at intersections and swooping down to thread the carved tunnels straight through the sponges, on a wandering route that never repeats. Dive speed is the flight, Detail the fractal depth (and the GPU bill), Glow lights the canyon walls. Kin to Sierpiński: this is what its carpet looks like grown into a solid.",
      params: ["mgdive", "mgrot", "mgiter", "mgglow", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "menger", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = mengerSeed(dt); glShaderDraw("menger", u => { gl.uniform3f(u.uPos, s.px, s.py, s.pz); gl.uniform3f(u.uFwd, s.fx, s.fy, s.fz); gl.uniform1f(u.uRoll, s.roll); gl.uniform1f(u.uIter, s.iter); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); }); } else menger(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], mgdive: [0.5, 0.5], mgrot: [0.3, 0.3], mgiter: [4, 4], mgglow: [0.5, 0.5], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "3", morph: false, showBox: true, randSeed: true } },
    { id: "boids", name: "Boids", subtitle: "Boids · murmuration",
      help: "A flock of birds wheeling as one — cohesion, alignment and separation, nothing else, which is the whole magic of boids. Each bird stamps a short streak, and the shipped Fade filter turns the flock into a smoky murmuration. Arm Scatter's L/M/H chips and every beat BLASTS the flock apart from its centre before it regathers; Cohesion sets how tightly it wheels.",
      params: ["bdcount", "bdspeed", "bdcoh", "bdfear", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"], helpTags: ["all", "boids"], boids: true,
      stamp: (xL, xR, yT, yB, n) => boidsStamp(xL, xR, yT, yB, n),
      bakesOwnZoom: true,
      filters: ["fade"],
      defaults: { palcycle: [0, 0], palhold: [0, 0], bdcount: [80, 80], bdspeed: [1, 1], bdcoh: [1, 1], bdfear: [0, 0], fade: [0.93, 0.93], points: [2500, 2500], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "galaxy", name: "Galaxy", subtitle: "Galaxy · log-spiral star disc",
      help: "A disc of stars whose density follows log spirals — the shape real galaxies make, where an arm is a straight line in log-radius so the winding tightens toward the core by itself rather than being drawn tighter by hand. The stars differentially rotate too: inner orbits sweep round faster, so the arms shear and re-form instead of turning like a rigid pinwheel. Arms sets how many, Twist how tightly they wind (low is a barred spiral, high a nearly circular ring), Scatter how sharply defined they are against the disc, Core how bright the central bulge burns. Arm Core or Scatter to the beat and the galaxy flares.",
      params: ["gxarms", "gxtwist", "gxspin", "gxcore", "gxscatter", "points", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"],
      helpTags: ["all", "galaxy"], bakesOwnZoom: true, stampAdd: true,
      stamp: (xL, xR, yT, yB, n) => galaxyStamp(xL, xR, yT, yB, n),
      ranges: { points: { min: 3000, max: 40000 } },
      defaults: { palcycle: [0, 0], palhold: [0, 0], gxarms: [2, 2], gxtwist: [0.55, 0.55], gxspin: [0.5, 0.5], gxcore: [0.35, 0.35], gxscatter: [0.30, 0.30],
        points: [16000, 16000], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "6", morph: false, showBox: true, randSeed: true } },
    { id: "harmonograph", name: "Harmonograph", subtitle: "Harmonograph · damped pendulum ribbons",
      help: "The Victorian drawing machine: two pendulums per axis, each a dying sine, their sum traced by a pen. Frequency ratio is the figure — whole numbers give the closed classical forms, and the values between them the open weaving ones. Detune is the trick: at exactly 0 the curve closes and retraces itself forever, and a hair off it each lap misses by a little and the whole figure precesses into a ribbon. Damping is how fast the pendulums die, so low values spiral a long way in and high ones draw a tight knot. Points is how finely the pen is sampled; add a Fade or Fire filter and the ribbons trail.",
      params: ["hgratio", "hgdetune", "hgdecay", "hgmorph", "points", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"],
      helpTags: ["all", "harmo"], bakesOwnZoom: true,
      stamp: (xL, xR, yT, yB, n) => harmonographStamp(xL, xR, yT, yB, n),
      // Its own Points range, like Flames. This effect samples ONE continuous curve rather
      // than scattering a cloud, so the count is the pen's resolution: below ~10k the line
      // breaks into visible dots, and the shared floor of 500 would only ever look broken.
      ranges: { points: { min: 4000, max: 60000 } },
      defaults: { palcycle: [0, 0], palhold: [0, 0], hgratio: [3, 3], hgdetune: [0.012, 0.012], hgdecay: [0.022, 0.022], hgmorph: [0.35, 0.35],
        points: [24000, 24000], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "vballs", name: "Vector balls", subtitle: "Vector balls · Amiga bobs in formation",
      help: "The Amiga classic: a rigid constellation of shaded spheres tumbling in 3D. Formation picks how they are arranged — Lattice (a cube of them), Sphere (an even shell), Ring or Helix — and the whole set turns as one body, so the shape reads only from how the balls occlude and shade each other. Balls sets how many, Ball size how fat (wind it up and they merge into a solid), Tumble how fast, Edge glow how hard the silhouettes are lit. Nearer balls are brighter, which is what separates the formation in depth.",
      params: ["vbcount", "vbshape", "vbsize", "vbspin", "vbglow", "world", "wldx", "wldy", "wldz", "wldscale", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"],
      helpTags: ["all", "vballs", "band"], bakesOwnZoom: true,
      draw: dt => { const s = vballsSeed(dt);
        if (useGL) glShaderDraw("vballs", u => { gl.uniform1f(u.uPhase, s.phase); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uShape, s.shape); gl.uniform1f(u.uRad, s.rad); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); });
        else vballsCPU(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], vbcount: [24, 24], vbshape: [1, 1], vbsize: [0.30, 0.30], vbspin: [0.5, 0.5], vbglow: [0.5, 0.5],
        zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "6", morph: false, showBox: true, world: false, randSeed: true } },
    { id: "glass", name: "Glass ball", subtitle: "Glass ball · raytraced spheres over the layers below",
      help: "Raytraced spheres that reflect and refract WHAT IS UNDERNEATH THEM. Put this layer on top of another one and the balls pick that layer's picture up: Metal mirrors it, Glass bends it through and turns it upside down the way a real ball does, Bubble is a thin shell that barely bends it but rings hard at the edge. Refraction is the glass's density — low is nearly water, high squeezes the whole scene into the middle of the ball. On its own, with no layer beneath, the balls fall back to reflecting a procedural room so the effect still stands up. The reflection is of BRIGHTNESS, not colour — everything is re-tinted by this layer's own palette.",
      params: ["gbcount", "gbsize", "gbmat", "gbior", "gbglow", "world", "wldx", "wldy", "wldz", "wldscale", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"],
      helpTags: ["all", "glass", "band"], bakesOwnZoom: true,
      draw: dt => { const s = glassSeed(dt);
        if (useGL) glShaderDraw("glass", u => {
          gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uRad, s.rad);
          gl.uniform1f(u.uMat, s.mat); gl.uniform1f(u.uIor, s.ior); gl.uniform1f(u.uGlow, s.glow);
          gl.uniform1f(u.uZoom, s.zoom);
          // The layers beneath, as this ball's environment. A sampler must be bound to a
          // COMPLETE texture even when the shader never reads it, so with nothing underneath
          // bind any real texture and let uHasBelow switch the branch.
          bindTexUnit(3, glBelowTex || glTex.native); gl.uniform1i(u.uBelow, 3);
          gl.uniform1f(u.uHasBelow, glBelowTex ? 1 : 0);
        });
        else glassCPU(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], gbcount: [3, 3], gbsize: [0.62, 0.62], gbmat: [1, 1], gbior: [1.45, 1.45], gbglow: [0.5, 0.5],
        zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      // OVER by default: a ball is an object that hides what is behind it. With MAX a bright
      // layer beneath showed straight through a metal ball, which read as "transparent".
      blend: "over",
      beat: {}, extras: { palette: "2", morph: false, showBox: true, world: false, randSeed: true } },
    { id: "trees", name: "Trees", subtitle: "Trees · recursive canopy in the wind",
      help: "A row of fractal trees bending in a wind. Each trunk splits, each branch splits again, and the sway is added at every joint rather than to the tree as a whole — so it accumulates from trunk to tip and the twigs whip while the trunk barely moves, which is what a real tree does. Depth is how many times it splits (the picture gets its filigree from here), Splits how many branches come off each joint, Branch angle how wide the fork opens and Taper how much shorter each generation is — low taper gives a stubby shrub, high a tall wispy one. Sway is the wind strength and Wind speed its rate. **Arm Sway's L/M/H chips and the trees gust on the beat.** It stamps into the fire buffer like the other point effects, so a Fade or Fire filter turns the moving tips into trails.",
      params: ["trcount", "trdepth", "trsplit", "trangle", "trshrink", "trsway", "trspeed", "points", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold"],
      helpTags: ["all", "trees"], bakesOwnZoom: true,
      stamp: (xL, xR, yT, yB, n) => treeStamp(xL, xR, yT, yB, n),
      // TREES OWN THEIR POINTS RANGE, and it is high for a reason: this effect draws LINES,
      // not a cloud, so the budget is spread over the tree's total length rather than
      // scattered. Three default trees are ~26k pixels of branch at full resolution, so the
      // shared 2500 default drew a dotted wireframe. 30000 is roughly one point per pixel.
      ranges: { points: { min: 4000, max: 60000 } },
      defaults: { palcycle: [0, 0], palhold: [0, 0], trcount: [3, 3], trdepth: [8, 8], trsplit: [2, 2], trangle: [28, 28], trshrink: [0.72, 0.72], trsway: [0.35, 0.35], trspeed: [1, 1],
        points: [30000, 30000], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "6", morph: false, showBox: true, randSeed: true } },
    { id: "torus", name: "Doughnut", subtitle: "Doughnut · flight inside a torus",
      help: "The inside of a doughnut, flown along the tube. The camera rides the pipe's centre line, so the wall wraps the whole frame and the curve of the ring keeps bringing new surface into view — you are always about to round a bend you can never quite see past. Flutes cuts lengthwise grooves into the pipe and Twist winds them into a spiral (both whole numbers, so the pattern closes on itself with no seam; set Flutes to 0 for a smooth pipe). Ring radius is how big the doughnut is — small values bend the tunnel hard and shorten the view, large ones straighten it out. Tube radius is how tight it is around you. Speed runs the flight, and negative reverses it.",
      params: ["dnring", "dntube", "dnspeed", "dntwist", "dnflute", "dnglow", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"],
      helpTags: ["all", "torus", "band"], bakesOwnZoom: true,
      draw: dt => { const s = torusSeed(dt);
        if (useGL) glShaderDraw("torus", u => { gl.uniform3f(u.uPos, s.px, s.py, s.pz); gl.uniform3f(u.uFwd, s.fx, s.fy, s.fz); gl.uniform1f(u.uRing, s.ring); gl.uniform1f(u.uTube, s.tube); gl.uniform1f(u.uTwist, s.twist); gl.uniform1f(u.uFlute, s.flute); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); });
        else torusCPU(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], dnring: [3, 3], dntube: [0.8, 0.8], dnspeed: [1, 1], dntwist: [1, 1], dnflute: [6, 6], dnglow: [0.5, 0.5],
        zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "4", morph: false, showBox: true, randSeed: true } },
    { id: "ocean", name: "Ocean", subtitle: "Ocean · Gerstner swell to the horizon",
      help: "A rolling sea running out to a horizon. Six wave trains are summed, each sharpened so the troughs stay round and the crests come to a point — that is Chop, and it is the difference between a real swell and a bland sine. The directions turn octave by octave, so the water interferes with itself and never repeats. Swell scales the whole surface (and with it the glint and the foam), Foam sets how high and how steep a crest has to be before it breaks white, and Wind turns the whole sea. Amber and Ember make it a sunset; the cold palettes make it the North Sea.",
      params: ["goswell", "goheight", "gochop", "gospeed", "gofoam", "goreflect", "gowind", "world", "wldx", "wldy", "wldz", "wldscale", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"],
      helpTags: ["all", "ocean", "band"], bakesOwnZoom: true,
      draw: dt => { const s = oceanSeed(dt);
        if (useGL) glShaderDraw("ocean", u => {
          gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uSwell, s.swell); gl.uniform1f(u.uChop, s.chop);
          gl.uniform1f(u.uFoam, s.foam); gl.uniform1f(u.uWind, s.wind); gl.uniform1f(u.uZoom, s.zoom);
          gl.uniform1f(u.uHeight, s.height); gl.uniform1f(u.uReflect, s.reflect);
          // The layers beneath, for the reflection. Bind a real texture either way — a
          // sampler must point at a COMPLETE one even on the branch that never reads it.
          bindTexUnit(3, glBelowTex || glTex.native); gl.uniform1i(u.uBelow, 3);
          gl.uniform1f(u.uHasBelow, glBelowTex ? 1 : 0);
        });
        else oceanCPU(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], goswell: [1, 1], gochop: [2.5, 2.5], gospeed: [1, 1], gofoam: [0.45, 0.45], gowind: [0, 0], goheight: [0.7, 0.7], goreflect: [0.6, 0.6],
        zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, world: false, randSeed: true } },
    { id: "bhole", name: "Black hole", subtitle: "Black hole · lensed accretion disk",
      help: "An accretion disk seen through the hole's own gravity. The photons are integrated rather than drawn straight, so light from the FAR side of the disk is bent up over the top of the shadow and back under the bottom — those arcs closing round the dark centre are the whole point, and a straight-ray version would just be an ellipse. Tilt is the camera's height above the disk plane: low is the iconic nearly-edge-on view, high looks down on a plain ring. Beaming is the relativistic boost that makes the limb coming toward you far brighter than the one going away; wind it to 0 for an evenly lit disk. The disk orbits Keplerian, so the inside shears past the outside and the turbulence never repeats. Heavy: it wants a real GPU.",
      params: ["bhtilt", "bhouter", "bhspin", "bhbeam", "bhorbit", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim"],
      helpTags: ["all", "bhole", "band"], bakesOwnZoom: true,
      draw: dt => { const s = bholeSeed(dt);
        if (useGL) glShaderDraw("bhole", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uOrbit, s.orbit); gl.uniform1f(u.uTilt, s.tilt); gl.uniform1f(u.uOuter, s.outer); gl.uniform1f(u.uBeam, s.beam); gl.uniform1f(u.uZoom, s.zoom); });
        else bholeCPU(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], bhtilt: [12, 12], bhouter: [8, 8], bhspin: [1, 1], bhbeam: [0.8, 0.8], bhorbit: [0.08, 0.08],
        zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "0", morph: false, showBox: true, randSeed: true } },
    { id: "qjulia", name: "Quaternion Julia", subtitle: "Quaternion Julia · raymarched 4D fractal",
      help: "The Julia set done in four dimensions: z → z² + c iterated in the quaternions and raymarched as a solid. What you see can only ever be a 3D SLICE of a 4D object, and the two slice controls are where the shapes come from — Slice is where the cut falls, Cut angle rotates the cutting plane itself, and between them they walk the solid through cross-sections nothing in three dimensions can show. Leave both at 0 and you get the plain Julia set spun about its axis. The seed c rides the SAME cardioid orbit as Julia, so the Orbit editor drives this too and the same rule applies: just outside the set gives intricate filigree, well inside gives a blob. Heavy: it wants a real GPU.",
      params: ["qjslice", "qjcut", "qjdetail", "qjspin", "qjpitch", "qjyaw", "qjroll", "qjtumx", "qjtumy", "qjtumz", "qjglow", "rpm", "ratio", "inrad", "outrad", "phase", "cardx", "world", "wldx", "wldy", "wldz", "wldscale", "zoom", "camrx", "camry", "camrz", "fov", "palcycle", "palhold", "band", "bandsize", "banddim", "randseed"],
      helpTags: ["all", "julia", "qjulia", "band"], bakesOwnZoom: true, cardioid: true, onEnter: () => reseedJulia(),
      // ONE juliaSeed() per frame, like the other three — the mirror takes the seed rather
      // than re-advancing it (juliaprobe pins both halves of that for every cardioid effect).
      draw: dt => { const seed = juliaSeed(dt), s = qjuliaSeed(dt);
        if (useGL) glShaderDraw("qjulia", u => { gl.uniform4f(u.uC, seed.cx, seed.cy, 0, 0); gl.uniform1f(u.uPhase, s.phase); gl.uniform1f(u.uSlice, s.slice); gl.uniform1f(u.uCut, s.cut); gl.uniform1f(u.uIter, s.iter); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); gl.uniform3f(u.uRot, s.rx, s.ry, s.rz); });
        else qjulia(seed, s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], qjslice: [0, 0], qjcut: [0, 0], qjdetail: [8, 8], qjspin: [0.3, 0.3], qjglow: [0.5, 0.5],
        qjpitch: [0, 0], qjyaw: [0, 0], qjroll: [0, 0], qjtumx: [0, 0], qjtumy: [0, 0], qjtumz: [0, 0],
        rpm: [0.15, 0.15], ratio: [6.5, 6.5], inrad: [0.12, 0.12], outrad: [1.02, 1.02], phase: [0, 0], cardx: [0, 0],
        zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "4", morph: false, showBox: true, world: false, randSeed: true } },
  ];
  // DISPLAY order only: every effect dropdown lists by name (twenty-odd effects in registry
  // order are a pile to hunt through), while EFFECTS keeps its own order — the runtime
  // `effect` is an index into it, and each option carries that index as its value.
  const effectsByName = () => EFFECTS.map((_, i) => i)
    .sort((a, b) => EFFECTS[a].name.localeCompare(EFFECTS[b].name) || a - b);
  effectsByName().forEach(i => effectSel.appendChild(new Option(EFFECTS[i].name, String(i))));
  // Dev sanity check: catch a mis-authored descriptor (dup id, param/default that
  // isn't a real control) at load instead of as a silent runtime break. Warns only.
  (function assertRegistry() {
    const ctlKeys = new Set(CONTROLS.map(c => c.key)), seen = new Set();
    EFFECTS.forEach((f, i) => {
      if (!f.id || seen.has(f.id)) console.warn("EFFECTS[" + i + "]: missing or duplicate id:", f.id);
      seen.add(f.id);
      (f.params || []).forEach(k => { if (!ctlKeys.has(k)) console.warn(f.id + ": params references unknown control '" + k + "'"); });
      for (const k in (f.defaults || {})) if (!ctlKeys.has(k)) console.warn(f.id + ": defaults references unknown control '" + k + "'");
      for (const k in (f.ranges || {})) if (!ctlKeys.has(k)) console.warn(f.id + ": ranges references unknown control '" + k + "'");
      for (const k in (f.ranges || {})) if (SINGLE_KEYS.has(k)) console.warn(f.id + ": ranges overrides single control '" + k + "' — its bounds must stay whole");
    });
    // The params ⊆ presetState check that belongs here CANNOT live here: it has to call
    // presetState, whose FILTER_DEFAULTS is a `const` two slices below (filters.js), so
    // calling it at this slice's load time is a TDZ crash. It runs instead as
    // assertPresetStateCovers(), immediately after presetState in transitions.js.
    // A single control is a dual with its thumbs pinned, so it only makes sense on an integer
    // grid: a fractional step, bound or default would put every snapped value off it.
    const whole = n => typeof n === "number" && n === Math.round(n);
    CONTROLS.forEach(c => {
      if (!c.single) return;
      if (c.type !== "dual") console.warn(c.key + ": single needs type 'dual' — the [lo,hi] pair IS the wire format");
      if (!whole(c.step) || !(c.step > 0)) console.warn(c.key + ": single needs a whole positive step");
      if (!whole(c.min) || !whole(c.max)) console.warn(c.key + ": single needs whole bounds");
      if (c.lo !== c.hi || !whole(c.lo)) console.warn(c.key + ": single needs lo === hi, whole");
    });
  })();

  // Effect identity in *saved* blobs is a stable string id, not the volatile numeric
  // index — so reordering/removing effects never silently remaps or drops saved
  // presets. Everything in memory stays a numeric index; convert only at the
  // serialize/deserialize edge (persist/backup/share out, applyBlob/restore in).
  const LEGACY_EFFECT_IDS = ["sirpinfyer", "tetrafyer", "animejulia", "plasma"];   // old index → id, for blobs saved before ids existed
  // RETIRED EFFECTS, mapped to their nearest surviving relative. An id that resolves to -1 is
  // DROPPED by every caller -- mergeLayers loses the layer, validatePresetList loses the whole
  // scene -- so simply deleting a descriptor silently damages every saved scene, share link and
  // backup that used it. Retiring one means naming its heir here instead, and this is the single
  // choke point all the decode paths already funnel through.
  //
  // Polygon -> Concentric rings: a single N-gon outline is the one-ring case of nested N-gon
  // contours, so the layer keeps its shape family rather than becoming something unrelated.
  // NOTE it is NOT in LEGACY_EFFECT_IDS above (that list is positional, and only covers the
  // four ids that predate string ids), so nothing numeric depended on its index.
  const RETIRED_EFFECT_IDS = { polygon: "concentric" };
  const effectId = idx => (EFFECTS[idx] || EFFECTS[0]).id;
  function effectIndexFromId(v) {                 // id (or a legacy number) → current numeric index, or -1
    if (typeof v === "number") v = LEGACY_EFFECT_IDS[v];
    if (RETIRED_EFFECT_IDS[v]) v = RETIRED_EFFECT_IDS[v];   // a retired effect becomes its heir, never -1
    return EFFECTS.findIndex(f => f.id === v);
  }
  // ---- THE per-effect-map registry ---------------------------------------------------
  // One row per per-effect map, naming its wire field and its whole verb family. The verbs
  // are function declarations from later slices — hoisting is what lets this table sit here.
  // The MECHANICAL all-maps sites iterate this table instead of hand-listing six calls:
  // the three snapshot preambles (saveLiveMaps), setEffect's save/load runs (loadLiveMaps),
  // and installShared's re-seed (initAllMaps) — which is exactly the site that proved the
  // point: its hand-list was missing initBtuneStates, so a recipient's own per-slider beat
  // tuning silently bled into every shared scene they opened. A new map = one row here.
  //
  // The SEMANTIC per-map sites stay explicit on purpose — applyBlob's validation loops,
  // snapshotScene's literal, applyPreset's merge lines, freezeItem/thawItem — because their
  // per-map differences (bounds-checking, replace-vs-merge, deep copies) are the behaviour,
  // and presetprobe/stackprobe pin them line by line.
  //
  // The wire names double as EFFECT_MAPS: the maps are keyed by registry POSITION in memory,
  // which only means anything in the build that wrote them, so they get the same id
  // treatment as `effect` at the storage edge — otherwise reordering or removing an effect
  // silently reattaches every saved scene to whichever effect now sits at that index.
  const MAP_DEFS = [
    { wire: "states", save: e => saveState(e), load: e => loadState(e), init: () => initStates() },
    { wire: "beats",  save: e => saveBeat(e),  load: e => loadBeat(e),  init: () => initBeatStates() },
    { wire: "pulses", save: e => savePulse(e), load: e => loadPulse(e), init: () => initPulseStates() },
    { wire: "plens",  save: e => savePlen(e),  load: e => loadPlen(e),  init: () => initPlenStates() },
    { wire: "btunes", save: e => saveBtune(e), load: e => loadBtune(e), init: () => initBtuneStates() },
    { wire: "extras", save: e => saveExtra(e), load: e => loadExtra(e), init: () => initExtras() },
  ];
  const EFFECT_MAPS = MAP_DEFS.map(d => d.wire);
  function saveLiveMaps(e) { for (const d of MAP_DEFS) d.save(e); }   // fold the live DOM/singletons into effect e's maps
  function loadLiveMaps(e) { for (const d of MAP_DEFS) d.load(e); }   // put effect e's maps onto the live DOM/singletons
  function initAllMaps() { for (const d of MAP_DEFS) d.init(); }      // re-seed every map to its shipped defaults
  function keysToIds(m) {                          // { 3: {...} } → { plasma: {...} }
    const out = {};
    for (const k in m) { const f = EFFECTS[+k]; if (f) out[f.id] = m[k]; }
    return out;
  }
  function keysToIdx(m) {                          // ...and back, tolerating legacy keys
    const out = {};
    for (const k in m) {
      // A numeric key is a blob written before this change. The registry has only ever
      // been appended to, so the position it recorded is still the right one.
      const i = /^\d+$/.test(k) ? +k : effectIndexFromId(k);
      if (i >= 0 && EFFECTS[i]) out[i] = m[k];     // an id we no longer ship is dropped
    }
    return out;
  }
  // ---- palette references get the same edge treatment as effect ids -----------------
  // Palette refs live NESTED — extras values, layer items, presets' extra + layers — and the
  // inputs alias RUNTIME objects (extras[e], the presets array), so every level that gets a
  // rewritten field is copied, never mutated in place. Encode keeps the raw value when the
  // index resolves to no id (nothing to say about it ⇒ say what was there); decode drops an
  // unknown id (never misfile) and emits STRING indices, the shape the runtime has always
  // stored (`L.palette`/`extras[e].palette` are numeric strings).
  const palExOut = ex => {
    if (!ex || typeof ex !== "object" || ex.palette == null) return ex;
    const id = palIdOut(ex.palette);
    return id ? { ...ex, palette: id } : ex;
  };
  const palLayersOut = ls => (Array.isArray(ls)
    ? ls.map(L => {
        if (!L || typeof L !== "object" || L.palette == null) return L;
        const id = palIdOut(L.palette);
        return id ? { ...L, palette: id } : L;
      })
    : ls);
  const palListOut = a => (Array.isArray(a) ? a.map(palIdOut).filter(Boolean) : a);
  // Decode halves. `customs` is the blob's own (already-validated) `palettes` list, which is
  // where a custom id resolves — see palIdxIn.
  const palExIn = (ex, customs) => {
    if (!ex || typeof ex !== "object" || ex.palette == null) return ex;
    const i = palIdxIn(ex.palette, customs);
    if (i < 0) { const c = { ...ex }; delete c.palette; return c; }
    return { ...ex, palette: String(i) };
  };
  const palLayersIn = (ls, customs) => (Array.isArray(ls)
    ? ls.map(L => {
        if (!L || typeof L !== "object" || L.palette == null) return L;
        const i = palIdxIn(L.palette, customs);
        if (i < 0) { const c = { ...L }; delete c.palette; return c; }
        return { ...L, palette: String(i) };
      })
    : ls);
  const palListIn = (a, customs) => (Array.isArray(a)
    ? a.map(v => palIdxIn(v, customs)).filter(i => i >= 0) : a);
  const mapValues = (m, fn) => {
    const out = {};
    for (const k in m) out[k] = fn(m[k]);
    return out;
  };
  function serializeBlob(b) {                      // numeric effect indices → ids, for storage
    const out = { ...b };
    if (typeof b.effect === "number") out.effect = effectId(b.effect);
    if (Array.isArray(b.presets)) out.presets = b.presets.map(p => {
      if (!p || typeof p !== "object") return p;
      const q = { ...p, extra: palExOut(p.extra) };
      if (typeof p.effect === "number") q.effect = effectId(p.effect);
      if (Array.isArray(p.layers)) q.layers = palLayersOut(p.layers);
      return q;
    });
    for (const f of EFFECT_MAPS) if (b[f] && typeof b[f] === "object") out[f] = keysToIds(b[f]);
    if (out.extras && typeof out.extras === "object") out.extras = mapValues(out.extras, palExOut);
    if (Array.isArray(b.layers)) out.layers = palLayersOut(b.layers);
    if (Array.isArray(b.palUse)) out.palUse = palListOut(b.palUse);
    if (Array.isArray(b.palGone)) out.palGone = palListOut(b.palGone);
    return out;
  }
  function deserializeBlob(b) {                    // ids (or legacy numbers) → numeric indices; drops unknown-effect presets
    if (!b || typeof b !== "object") return b;
    const out = { ...b };
    // The custom list first: it is what the palette refs below resolve their ids against,
    // and normalizing it HERE (rather than only in applyBlob) pins the positions — applyBlob
    // installs this same validated list, so an id resolved to PAL_BUILTIN+n now still names
    // that ramp after the install. customPalettesOk is idempotent, so the second run in
    // applyBlob sees it unchanged.
    if (b.palettes !== undefined) out.palettes = customPalettesOk(b.palettes);
    const customs = out.palettes;
    if (b.effect !== undefined) { const i = effectIndexFromId(b.effect); if (i >= 0) out.effect = i; else delete out.effect; }
    if (Array.isArray(b.presets)) out.presets = b.presets.map(p => {
      if (!p || typeof p !== "object") return null;
      const i = effectIndexFromId(p.effect);
      if (i < 0) return null;
      const q = { ...p, effect: i, extra: palExIn(p.extra, customs) };
      if (Array.isArray(p.layers)) q.layers = palLayersIn(p.layers, customs);
      return q;
    }).filter(Boolean);
    for (const f of EFFECT_MAPS) if (b[f] && typeof b[f] === "object") out[f] = keysToIdx(b[f]);
    if (out.extras && typeof out.extras === "object") out.extras = mapValues(out.extras, ex => palExIn(ex, customs));
    if (Array.isArray(b.layers)) out.layers = palLayersIn(b.layers, customs);
    if (Array.isArray(b.palUse)) out.palUse = palListIn(b.palUse, customs);
    if (Array.isArray(b.palGone)) out.palGone = palListIn(b.palGone, customs);
    return out;
  }
  // Per-effect slider presets, loaded whenever an effect becomes active (manual
  // pick, Reset, or the auto-cycle). Arrays are [lo,hi] for ranged sliders; a
  // bare number is a simple slider. Each effect gets its own tuned look.
  // Each effect keeps its own slider values, seeded from its descriptor's `defaults`.
  // Switching saves the outgoing effect's sliders and restores the incoming effect's,
  // so per-effect tweaks are kept. The whole thing is mirrored to localStorage and
  // restored next visit — values outside a slider's current bounds are ignored, so
  // changing a slider's range can never load stale/junk values. `defaults` includes a
  // few render-affecting keys the effect doesn't display (e.g. band) at safe values so
  // switching to it resets them rather than inheriting the previous effect's.
  const states = {};
