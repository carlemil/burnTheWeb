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
      params: ["points", "layers", "speed", "size", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "fire"], fractal2d: true, bakesOwnZoom: true,
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [22, 22], rise: [52, 52], zoom: [1, 1], size: [1, 1], rot: [0, 0], layers: 3, rpm: [0.03, 0.03], ratio: [21.5, 21.5], inrad: [0.03, 0.03], outrad: [1.05, 1.05], phase: [0, 0], points: [3850, 3850] },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "tetrafyer", name: "Tetrahedron", subtitle: "Sierpiński tetrahedron · classic fire",
      help: "A 3D Sierpiński tetrahedron, a rigid body under real physics whose four tumbling corners seed the same fire. With Show box on it bounces inside an invisible box, bursting a sphere of sparks on each wall hit; with the box off there are no walls, so it orbits the centre of the screen instead. Objects stacks more tetrahedra, each smaller and moving on its own. Two rotations turn the view: Rotation yaws it (0 by default — spread the thumbs to drift) and Box nod pitches it up and down in a slow sine (Nod speed sets how fast).",
      params: ["showbox", "boxsize", "points", "layers", "speed", "size", "rot", "nod", "nodspd", "sway", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "fire", "tetra"], bakesOwnZoom: true,
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [23, 23], rise: [105, 105], zoom: [1, 1], size: [1.75, 1.75], rot: [0, 0], nod: [17.2, 17.2], nodspd: [1, 1], sway: [0.5, 0.5], boxsize: [4, 4], layers: 3, rpm: [0.03, 0.03], ratio: [21.5, 21.5], inrad: [0.03, 0.03], outrad: [1.05, 1.05], phase: [0, 0], points: [1500, 1500] },
      beat: {}, extras: { palette: "1", morph: false, showBox: false, randSeed: true } },
    { id: "animejulia", name: "AnimeJulia", subtitle: "Julia set · animated seed",
      help: "A live Julia set. The seed point c orbits the rim of the Mandelbrot cardioid; each pixel's escape time is coloured through the palette.",
      params: ["rpm", "ratio", "inrad", "outrad", "phase", "cardx", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim", "randseed"], helpTags: ["all", "julia", "band"],
      bakesOwnZoom: true, cardioid: true, onEnter: () => reseedJulia(), draw: dt => { const s = juliaSeed(dt); if (useGL) glJulia(s); else julia(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [92, 92], rise: [130, 130], zoom: [1, 1], size: [1, 1], rot: [0, 0], layers: 1, rpm: [0.28, 0.28], ratio: [8.5, 8.5], inrad: [0.03, 0.03], outrad: [1, 1], phase: [0, 0], cardx: [0, 0], points: [1500, 1500] },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "plasma", name: "Plasma", subtitle: "Plasma · sinusoidal interference",
      help: "An old-school plasma: several sine/cosine waves interfere across the screen and animate over time, coloured through the palette. Add banding for classic hard contour stripes.",
      params: ["pspeed", "pscale", "pwarp", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "plasma", "band"],
      bakesOwnZoom: true, draw: dt => { if (useGL) glPlasma(plasmaSeed(dt)); else plasma(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], zoom: [1, 1], pspeed: [0.5, 0.5], pscale: [0.9, 0.9], pwarp: [0.4, 0.4] },
      beat: {}, extras: { palette: "3", morph: false, showBox: true, randSeed: true } },
    { id: "tunnel", name: "Tunnel", subtitle: "Tunnel · demoscene flythrough",
      help: "A classic demoscene tunnel: the screen is polar-mapped so concentric rings rush toward the vanishing point. Fly speed drives you forward; Twist rotates the pipe.",
      params: ["tunspeed", "tuntwist", "tunrings", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "tunnel"], bakesOwnZoom: true,
      draw: dt => { const s = tunnelSeed(dt); if (useGL) glShaderDraw("tunnel", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uTwist, s.twist); gl.uniform1f(u.uRings, s.rings); gl.uniform1f(u.uZoom, s.zoom); }); else tunnel(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], tunspeed: [0.6, 0.6], tuntwist: [0.1, 0.1], tunrings: [8, 8], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "0", morph: false, showBox: true, randSeed: true } },
    { id: "metaballs", name: "Metaballs", subtitle: "Metaballs · gooey blobs",
      help: "Blobby fields that merge and split like lava-lamp goo — a sum of inverse-square fields from moving centres, soft-saturated. Turn up Banding for hard iso-contour shells.",
      params: ["mbcount", "mbradius", "mbspeed", "mbgain", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "meta", "band"], bakesOwnZoom: true,
      draw: dt => { const s = metaSeed(dt); if (useGL) glShaderDraw("metaball", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uRadius, s.radius); gl.uniform1f(u.uGain, s.gain); gl.uniform1f(u.uZoom, s.zoom); }); else metaballs(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], mbcount: [5, 5], mbradius: [0.16, 0.16], mbspeed: [0.6, 0.6], mbgain: [0.8, 0.8], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "2", morph: false, showBox: true, randSeed: true } },
    { id: "burningship", name: "Burning Ship", subtitle: "Burning Ship · fractal",
      help: "The Burning Ship fractal — like the Julia set but each step folds the value to |Re·Im|, giving jagged, architectural, flame-like structures. The seed orbits the Mandelbrot cardioid exactly like AnimeJulia, so it shares those controls.",
      params: ["rpm", "ratio", "inrad", "outrad", "phase", "cardx", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim", "randseed"], helpTags: ["all", "julia", "band"],
      bakesOwnZoom: true, cardioid: true, onEnter: () => reseedJulia(),
      draw: dt => { const s = juliaSeed(dt); if (useGL) glShaderDraw("burning", u => { gl.uniform2f(u.uC, s.cx, s.cy); gl.uniform2f(u.uSpan, s.spanX, s.spanY); }); else burningShip(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], zoom: [0.5, 0.5], rpm: [0.2, 0.2], ratio: [8.5, 8.5], inrad: [0.15, 0.15], outrad: [1.4, 1.4], phase: [0, 0], cardx: [0, 0] },
      beat: {}, extras: { palette: "0", morph: false, showBox: true, randSeed: true } },
    { id: "kaleidoscope", name: "Kaleidoscope", subtitle: "Kaleidoscope · mirrored symmetry",
      help: "A moving field folded into mirror-symmetric wedges, like looking down a kaleidoscope. Segments sets the symmetry, Spin rotates the whole thing, Flow animates the pattern. Add banding for sharp mandala rings.",
      params: ["ksegments", "krotspeed", "knoisespeed", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "kaleido", "band"], bakesOwnZoom: true,
      draw: dt => { const s = kaleidoSeed(dt); if (useGL) glShaderDraw("kaleido", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uSeg, s.seg); gl.uniform1f(u.uRot, s.rot); gl.uniform1f(u.uZoom, s.zoom); }); else kaleidoscope(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], ksegments: [6, 6], krotspeed: [0.1, 0.1], knoisespeed: [0.6, 0.6], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "rotozoom", name: "Rotozoomer", subtitle: "Rotozoomer · rotate + zoom",
      help: "The classic Amiga rotozoomer: a tiled grid texture spun and pulse-zoomed in real time. Rotation sets the spin, Zoom pulse the breathing scale, Tile density how fine the grid is.",
      params: ["rzrot", "rzzoom", "rztile", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "roto", "band"], bakesOwnZoom: true,
      draw: dt => { const s = rotozoomSeed(dt); if (useGL) glShaderDraw("rotozoom", u => { gl.uniform1f(u.uAngle, s.angle); gl.uniform1f(u.uScale, s.scale); gl.uniform1f(u.uTile, s.tile); gl.uniform1f(u.uZoom, s.zoom); }); else rotozoom(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], rzrot: [0.2, 0.2], rzzoom: [0.3, 0.3], rztile: [3, 3], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "munch", name: "Munching Squares", subtitle: "Munching squares · XOR pattern",
      help: "The hypnotic PDP-1 classic: each pixel is ((x XOR y) + time) masked to a value, mapped through the palette. Munch speed animates it, Square size sets the pixel chunkiness, Detail the wrap.",
      params: ["xorspeed", "xorscale", "xormask", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "xor"], bakesOwnZoom: true,
      draw: dt => { const s = munchSeed(dt); if (useGL) glShaderDraw("munch", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uScale, s.scale); gl.uniform1f(u.uMask, s.mask); gl.uniform1f(u.uZoom, s.zoom); }); else munch(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], xorspeed: [12, 12], xorscale: [0.35, 0.35], xormask: [255, 255], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "moire", name: "Moiré", subtitle: "Moiré · interference shimmer",
      help: "Two sets of concentric rings drift over each other and interfere into shimmering moiré bands. Ring frequency sets how tight the rings are, Drift speed how fast the centres move, Blend fades between multiply and add.",
      params: ["mofreq", "modrift", "momix", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "moire", "band"], bakesOwnZoom: true,
      draw: dt => { const s = moireSeed(dt); if (useGL) glShaderDraw("moire", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uFreq, s.freq); gl.uniform1f(u.uMix, s.mix); gl.uniform1f(u.uZoom, s.zoom); }); else moire(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], mofreq: [8, 8], modrift: [0.6, 0.6], momix: [0.3, 0.3], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "newton", name: "Newton", subtitle: "Newton fractal · root basins",
      help: "The Newton fractal: each pixel is coloured by which root of z³−1 Newton's method converges to, plus how many steps it took, giving three interlocking basins with fractal borders. Root spin rotates it; Relaxation warps the convergence.",
      params: ["nwspin", "nwrelax", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "newton", "band"], bakesOwnZoom: true,
      draw: dt => { const s = newtonSeed(dt); if (useGL) glShaderDraw("newton", u => { gl.uniform1f(u.uSpin, s.spin); gl.uniform1f(u.uRelax, s.relax); gl.uniform1f(u.uZoom, s.zoom); }); else newton(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], nwspin: [0.05, 0.05], nwrelax: [0.9, 0.9], zoom: [0.8, 0.8], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "5", morph: false, showBox: true, randSeed: true } },
    { id: "multibrot", name: "Multibrot", subtitle: "Multibrot · power sweep",
      help: "The Multibrot family: z^power + c, with the seed orbiting the cardioid like AnimeJulia (so it shares those controls). Power now sweeps CONTINUOUSLY — whole numbers give the classic sets (each adds a bulb of symmetry), and the fractions in between morph one into the next, with a characteristic straight seam ray where the fractional exponent's branch cut lies. The seed rides a blend of the two neighbouring whole-power cardioids, sprinting through the cusps and easing off between them.",
      params: ["mbexp", "rpm", "ratio", "inrad", "outrad", "phase", "cardx", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim", "randseed"], helpTags: ["all", "julia", "band", "multibrot"],
      bakesOwnZoom: true, cardioid: true, onEnter: () => reseedJulia(),
      // juliaPower BEFORE juliaSeed: the orbit must ride this frame's power, not the last one's.
      draw: dt => { juliaPower = mbPower; const s = juliaSeed(dt); if (useGL) glShaderDraw("multibrot", u => { gl.uniform2f(u.uC, s.cx, s.cy); gl.uniform2f(u.uSpan, s.spanX, s.spanY); gl.uniform1f(u.uPower, mbPower); }); else multibrot(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], mbexp: [2, 2], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], zoom: [1, 1], rpm: [0.15, 0.15], ratio: [8.5, 8.5], inrad: [0.03, 0.03], outrad: [1, 1], phase: [0, 0], cardx: [0, 0] },
      beat: {}, extras: { palette: "4", morph: false, showBox: true, randSeed: true } },
    { id: "copperbars", name: "Copper Bars", subtitle: "Copper bars · raster sine bars",
      help: "The Amiga copper-bar effect: horizontal gradient bars sliding up and down on sine motion. Bar count, Bar speed and Bar width shape them; the Copper palette gives them their metallic sheen.",
      params: ["cbcount", "cbspeed", "cbwidth", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "copper", "band"], bakesOwnZoom: true,
      draw: dt => { const s = copperSeed(dt); if (useGL) glShaderDraw("copper", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uWidth, s.width); gl.uniform1f(u.uZoom, s.zoom); }); else copperbars(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], cbcount: [5, 5], cbspeed: [0.6, 0.6], cbwidth: [0.08, 0.08], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "3", morph: false, showBox: true, randSeed: true } },
    { id: "attractor", name: "Attractor", subtitle: "Strange attractor · de Jong",
      help: "A de Jong strange attractor — millions of points from x'=sin(a·y)−cos(b·x), y'=sin(c·x)−cos(d·y) stamped into the fire. The four coefficients a/b/c/d are the shape knobs; nudge them (or arm their L/M/H chips) and the delicate threads morph. Points sets the density, Flame rise the glow. The map is exact, so Point jitter scatters each point a little to soften the threads — set it to 0 for the bare, hard-edged curves.",
      params: ["ata", "atb", "atc", "atd", "atjit", "points", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "attractor"], bakesOwnZoom: true,
      stamp: (xL, xR, yT, yB, n) => attractorStamp(xL, xR, yT, yB, n),
      defaults: { palcycle: [0, 0], palhold: [0, 0], ata: [1.3, 1.3], atb: [-2.4, -2.4], atc: [2.3, 2.3], atd: [-2.2, -2.2], atjit: [0.5, 0.5], points: [6000, 6000], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    // ---- Geometric shapes (SDF shader effects; append-only for id stability) ----
    { id: "polygon", name: "Polygon", subtitle: "Polygon · rotating N-gon",
      help: "A single rotating regular polygon drawn as a signed-distance field. Sides morphs triangle → square → … → circle; Size scales it, Spin rotates it (negative reverses), and Thickness hollows it out — 1 is solid, low values leave a thin outline. Arm Size or Spin to a beat to make it throb.",
      params: ["pgsides", "pgrad", "pgthick", "pgspin", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "shape"], bakesOwnZoom: true,
      draw: dt => { const s = polygonSeed(dt); if (useGL) glShaderDraw("polygon", u => { gl.uniform1f(u.uSpin, s.spin); gl.uniform1f(u.uSides, s.sides); gl.uniform1f(u.uRad, s.rad); gl.uniform1f(u.uThick, s.thick); gl.uniform1f(u.uZoom, s.zoom); }); else polygon(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], pgsides: [5, 5], pgrad: [0.35, 0.35], pgthick: [1, 1], pgspin: [0.4, 0.4], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "8", morph: false, showBox: true, randSeed: true } },
    { id: "shapegrid", name: "Shape grid", subtitle: "Shape grid · pulsing lattice",
      help: "A tiled lattice of one shape. Density sets how many cells fill the screen, Size the shape within each cell, Squareness morphs circle → square, and Pulse (with Pulse speed) makes every cell breathe out of phase with its neighbours. Reads like a pulsing dot-grid or checkerboard.",
      params: ["sgcells", "sgdot", "sgsquare", "sgpulse", "sgspeed", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "shape"], bakesOwnZoom: true,
      draw: dt => { const s = shapegridSeed(dt); if (useGL) glShaderDraw("shapegrid", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCells, s.cells); gl.uniform1f(u.uDot, s.dot); gl.uniform1f(u.uSquare, s.square); gl.uniform1f(u.uPulse, s.pulse); gl.uniform1f(u.uZoom, s.zoom); }); else shapegrid(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], sgcells: [9, 9], sgdot: [0.3, 0.3], sgsquare: [0, 0], sgpulse: [0.35, 0.35], sgspeed: [1.2, 1.2], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "concentric", name: "Concentric rings", subtitle: "Concentric · shape tunnel",
      help: "Nested polygon (or circle) contours radiating out from the centre and marching outward over time — a hypnotic target / shape-tunnel. Sides sets the shape, Ring count how tightly packed the rings are, March speed how fast they travel (negative pulls inward), Thickness the ring width, and Spin rotates the whole thing.",
      params: ["cosides", "cocount", "cothick", "cospeed", "cospin", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "shape"], bakesOwnZoom: true,
      draw: dt => { const s = concentricSeed(dt); if (useGL) glShaderDraw("concentric", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uSides, s.sides); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uThick, s.thick); gl.uniform1f(u.uSpin, s.spin); gl.uniform1f(u.uZoom, s.zoom); }); else concentric(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], cosides: [6, 6], cocount: [6, 6], cothick: [0.4, 0.4], cospeed: [0.6, 0.6], cospin: [0.1, 0.1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "bounce", name: "Bouncing shapes", subtitle: "Bouncing shapes · DVD-logo drift",
      help: "A handful of shapes drifting and bouncing off the edges, DVD-logo style. Count sets how many, Size how big, Squareness morphs circle → square, and Speed how fast they travel. Tick a Fade pixel or Fire feedback filter to give them glowing trails.",
      params: ["bncount", "bnrad", "bnsquare", "bnspeed", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "shape"], bakesOwnZoom: true,
      draw: dt => { const s = bounceSeed(dt); if (useGL) glShaderDraw("bounce", u => { gl.uniform2fv(u.uPos, s.pos); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uRad, s.rad); gl.uniform1f(u.uSquare, s.square); gl.uniform1f(u.uZoom, s.zoom); }); else bounce(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], bncount: [4, 4], bnrad: [0.09, 0.09], bnsquare: [0.6, 0.6], bnspeed: [1, 1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "2", morph: false, showBox: true, randSeed: true } },
    { id: "solids", name: "Bouncing solids", subtitle: "Solids · raymarched 3D",
      help: "Real 3D: a handful of solid primitives — sphere, box, doughnut, capsule, octahedron, cylinder — tumbling and ricocheting off the walls of an invisible room, raymarched as signed-distance fields and shaded into the palette by surface angle and depth. Count sets how many bodies, Size how big (which is also the radius they bounce on, so bigger ones turn sooner), Shape mix how many different primitives are in play (1 = all spheres, 6 = all six), Speed how fast they travel and Tumble how hard they spin — a wall hit converts slide into roll, so they kick into a tumble on an angled clip. Edge glow lights the silhouettes. Tick Fire or Fade pixel for trails.",
      params: ["sdcount", "sdsize", "sdmix", "sdspeed", "sdspin", "sdrim", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "solids", "band"],
      bakesOwnZoom: true, solids: true,
      draw: dt => { const s = solidsSeed(dt); if (useGL) glShaderDraw("solids", u => { gl.uniform4fv(u.uPos, s.pos); gl.uniform4fv(u.uQuat, s.quat); gl.uniform1fv(u.uShape, s.shape); gl.uniform1f(u.uCount, s.count); gl.uniform1f(u.uRim, s.rim); gl.uniform1f(u.uZoom, s.zoom); }); else solids(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], sdcount: [5, 5], sdsize: [0.26, 0.26], sdmix: [6, 6], sdspeed: [1, 1], sdspin: [1, 1], sdrim: [0.55, 0.55], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "sunsurface", name: "Sun surface", subtitle: "Sun surface · solar granulation",
      help: "The boiling surface of the sun, as the Inouye Solar Telescope sees it: a full-screen field of bright convection cells separated by narrow dark lanes, each cell slowly drifting, deforming and brightening as it churns, with tiny bright points sparking in the lanes. Raise Sunspot to sink a dark spot into the middle — a near-black core ringed by fine filaments radiating out into the granulation. Fire-family palettes (Amber, Fire, Ember, Sunburst) give it its colour.",
      params: ["sunscale", "sunspeed", "sunlane", "sunglow", "sunspot", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "sun", "band"], bakesOwnZoom: true,
      // Plasma-shaped draw: the clock advances exactly ONCE per frame on either path —
      // sun(dt) calls sunSeed itself, so nothing may pre-call it before the CPU branch.
      // (The metaballs-style `const s = seed(dt); ... else mirror(dt)` double-advances.)
      draw: dt => { if (useGL) { const s = sunSeed(dt); glShaderDraw("sun", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uDensity, s.density); gl.uniform1f(u.uLane, s.lane); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uSpot, s.spot); gl.uniform1f(u.uZoom, s.zoom); }); } else sun(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], sunscale: [14, 14], sunspeed: [1, 1], sunlane: [0.35, 0.35], sunglow: [1, 1], sunspot: [0, 0], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "8", morph: false, showBox: true, randSeed: true } },
    { id: "kefrens", name: "Kefrens bars", subtitle: "Kefrens · weaving ribbons",
      help: "The classic Amiga effect: vertical bars redrawn at a phase offset on every scanline, so the ribbons weave impossibly through each other. Bars sets how many, Sway how far they wander, Speed how fast, and Bar width how fat each ribbon is. Arm Sway or Speed to a beat to make them lash.",
      params: ["kfbars", "kfsway", "kfspeed", "kfwidth", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "kefrens", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = kefrensSeed(dt); glShaderDraw("kefrens", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uBars, s.bars); gl.uniform1f(u.uSway, s.sway); gl.uniform1f(u.uWidth, s.width); gl.uniform1f(u.uZoom, s.zoom); }); } else kefrens(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], kfbars: [6, 6], kfsway: [0.25, 0.25], kfspeed: [1, 1], kfwidth: [0.045, 0.045], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "3", morph: false, showBox: true, randSeed: true } },
    { id: "twister", name: "Twister", subtitle: "Twister · liquorice column",
      help: "The classic twisting column: a square bar wrung along its height, each face shaded by its angle, bright seams on the edges. Twist sets how hard it is wrung (negative reverses), Speed how fast it turns, Width how fat it is, and Columns puts up to three side by side, out of phase.",
      params: ["twcols", "twwidth", "twtwist", "twspeed", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "twister", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = twisterSeed(dt); glShaderDraw("twister", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCols, s.cols); gl.uniform1f(u.uWidth, s.width); gl.uniform1f(u.uTwist, s.twist); gl.uniform1f(u.uZoom, s.zoom); }); } else twister(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], twcols: [1, 1], twwidth: [0.22, 0.22], twtwist: [2, 2], twspeed: [1, 1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "8", morph: false, showBox: true, randSeed: true } },
    { id: "cymatics", name: "Cymatics", subtitle: "Cymatics · Chladni plate",
      help: "Sand on a vibrating plate: bright lines trace the nodes of a standing wave, and the figure snaps into a new symmetry every time the mode changes. Mode is the wave number — drift its two thumbs apart for continuous morphing, or arm its chips so the figure JUMPS on the beat. Mode offset skews the pattern off square, Sharpness thins the lines, Shimmer makes the sand tremble.",
      params: ["cymode", "cymoff", "cysharp", "cyshimmer", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "chladni", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = cymaticsSeed(dt); glShaderDraw("cymatics", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uModeN, s.n); gl.uniform1f(u.uModeM, s.m); gl.uniform1f(u.uSharp, s.sharp); gl.uniform1f(u.uShim, s.shim); gl.uniform1f(u.uZoom, s.zoom); }); } else cymatics(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], cymode: [3, 3], cymoff: [1, 1], cysharp: [5, 5], cyshimmer: [0.4, 0.4], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "lightning", name: "Lightning storm", subtitle: "Lightning · beat-fired bolts",
      help: "Forked fractal bolts tearing down the screen, each one a fresh shape: a jagged main channel that splits into side branches on its way down, lighting up from the cloud to the ground with a hot racing tip — Strike speed is how fast it travels. Rate fires strikes on a clock; arm Strike's L/M/H chips and the BEAT fires them instead — a kick snaps Strike to full and the bolt decays over the Trigger duration, exactly like Shockwave's ring. Bolts sets how many strike at once, Afterglow how much the sky lights up.",
      params: ["ltstrike", "ltrate", "ltspd", "ltbolts", "ltglow", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "storm", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = stormSeed(dt); glShaderDraw("storm", u => { gl.uniform1f(u.uEnv, s.env); gl.uniform1f(u.uSeed, s.seed); gl.uniform1f(u.uBolts, s.bolts); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); gl.uniform1f(u.uFront, s.front); }); } else storm(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], ltstrike: [0, 0], ltrate: [0.5, 0.5], ltspd: [12, 12], ltbolts: [2, 2], ltglow: [0.5, 0.5], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "mandelbulb", name: "Mandelbulb", subtitle: "Mandelbulb · raymarched 3D fractal",
      help: "The 3D Mandelbrot: z → z^p + c run in spherical coordinates and raymarched as a solid, slowly orbited by the camera. Power reshapes it continuously — 8 is the classic bulb, low values melt it toward a sphere, high values bristle it, and the fractions in between morph smoothly (drift Power's two thumbs apart and the bulb never stops reshaping). Detail adds fractal depth (and GPU cost), Orbit speed sets the camera's lap, Glow lights the silhouette and puts a halo on near-misses. The heaviest effect in the app — it wants a real GPU.",
      params: ["bppower", "bpdetail", "bpspin", "bpglow", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "bulb", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = bulbSeed(dt); glShaderDraw("bulb", u => { gl.uniform1f(u.uPhase, s.phase); gl.uniform1f(u.uPower, s.power); gl.uniform1f(u.uIter, s.iter); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); }); } else bulb(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], bppower: [8, 8], bpdetail: [7, 7], bpspin: [0.35, 0.35], bpglow: [0.5, 0.5], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "4", morph: false, showBox: true, randSeed: true } },
    { id: "flames", name: "Fractal flames", subtitle: "Fractal flames · IFS density",
      help: "An iterated function system in the Apophysis / Electric Sheep style: the chaos game bounces between two slowly-morphing affine maps, a nonlinear Variation bends every step, and each landing ADDS heat — so the dense heart of the orbit burns white while the wisps stay faint. Variation picks the fold (Spherical and Swirl are the classics), Morph speed orbits the coefficients, Point glow sets how much each landing adds, and Points the density budget.",
      params: ["flvar", "flmorph", "flglow", "points", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "flames"], bakesOwnZoom: true, stampAdd: true,
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
      ranges: { points: { min: 10000, max: 200000 } },
      defaults: { palcycle: [0, 0], palhold: [0, 0], flvar: [3, 3], flmorph: [0.3, 0.3], flglow: [30, 30], points: [30000, 30000], fade: [0.975, 0.975], diffuse: [0.8, 0.8], diffkeep: [0.985, 0.985], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "starfield", name: "Starfield", subtitle: "Starfield · hyperspace",
      help: "A 3D starfield flying past — six parallax depths of hash-placed stars, each twinkling on its own phase. Warp smears every star into a radial streak: arm its L/M/H chips and the kick punches to hyperspace, easing back as the pulse decays. Star density and Fly speed set the traffic, Twinkle the shimmer.",
      params: ["stdensity", "stspeed", "stwarp", "sttwinkle", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "stars", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = starsSeed(dt); glShaderDraw("stars", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uDensity, s.density); gl.uniform1f(u.uWarp, s.warp); gl.uniform1f(u.uTwinkle, s.twinkle); gl.uniform1f(u.uZoom, s.zoom); }); } else stars(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], stdensity: [1.2, 1.2], stspeed: [1, 1], stwarp: [0, 0], sttwinkle: [0.8, 0.8], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "6", morph: false, showBox: true, randSeed: true } },
    { id: "aurora", name: "Aurora", subtitle: "Aurora · northern lights",
      help: "Curtains of light hanging from the top of the sky, swaying on slow layered waves, each rippling and shimmering on its own phase over a faint horizon glow. Curtains sets how many, Sway how far the whole sky bends, Shimmer how restless the light is. Ice and Electric palettes were made for it; Verdant gives the green aurora.",
      params: ["aucurtains", "ausway", "auspeed", "aushimmer", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "aurora", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = auroraSeed(dt); glShaderDraw("aurora", u => { gl.uniform1f(u.uTime, s.t); gl.uniform1f(u.uCurtains, s.curtains); gl.uniform1f(u.uSway, s.sway); gl.uniform1f(u.uShim, s.shim); gl.uniform1f(u.uZoom, s.zoom); }); } else aurora(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], aucurtains: [3, 3], ausway: [0.5, 0.5], auspeed: [1, 1], aushimmer: [1, 1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
    { id: "reactdiff", name: "Reaction-diffusion", subtitle: "Gray–Scott · living patterns",
      help: "Two chemicals feeding and killing each other on a dish, forming spots, stripes, coral and mazes that grow and never repeat. Feed and Kill choose the regime — tiny nudges cross into whole new pattern families, and some settings kill the culture outright; when everything dies, the dish quietly re-seeds itself, so exploring (or arming Feed's chips to let the beat push the culture into a new life) is always safe. Sim speed is how many chemistry steps run per frame. The state is ONE shared dish: two layers of it show the same culture.",
      params: ["rdfeed", "rdkill", "rdspeed", "rdgain", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "rd", "band"], bakesOwnZoom: true,
      onEnter: () => { rdNeedSeed = true; rdCpuSeed = true; },
      draw: dt => { const s = rdSeedFn(dt); if (useGL) { glRDTick(s.steps, s.feed, s.kill); glShaderDraw("rdshow", u => { bindTexUnit(0, glTex.rd[rdCur]); gl.uniform1i(u.uState, 0); gl.uniform1f(u.uGain, s.gain); gl.uniform1f(u.uZoom, s.zoom); }); } else rdCPU(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], rdfeed: [0.03, 0.03], rdkill: [0.062, 0.062], rdspeed: [8, 8], rdgain: [1, 1], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "2", morph: false, showBox: true, randSeed: true } },
    { id: "menger", name: "Menger sponge", subtitle: "Menger · fractal city drive",
      help: "An endless lattice of Menger sponges — the 3D Sierpiński carpet — raymarched while the camera drives the streets between them, turning at intersections and swooping down to thread the carved tunnels straight through the sponges, on a wandering route that never repeats. Dive speed is the flight, Detail the fractal depth (and the GPU bill), Glow lights the canyon walls. Kin to Sierpiński: this is what its carpet looks like grown into a solid.",
      params: ["mgdive", "mgrot", "mgiter", "mgglow", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim"], helpTags: ["all", "menger", "band"], bakesOwnZoom: true,
      draw: dt => { if (useGL) { const s = mengerSeed(dt); glShaderDraw("menger", u => { gl.uniform3f(u.uPos, s.px, s.py, s.pz); gl.uniform3f(u.uFwd, s.fx, s.fy, s.fz); gl.uniform1f(u.uRoll, s.roll); gl.uniform1f(u.uIter, s.iter); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uZoom, s.zoom); }); } else menger(dt); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], mgdive: [0.5, 0.5], mgrot: [0.3, 0.3], mgiter: [4, 4], mgglow: [0.5, 0.5], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0] },
      beat: {}, extras: { palette: "3", morph: false, showBox: true, randSeed: true } },
    { id: "boids", name: "Boids", subtitle: "Boids · murmuration",
      help: "A flock of birds wheeling as one — cohesion, alignment and separation, nothing else, which is the whole magic of boids. Each bird stamps a short streak, and the shipped Fade filter turns the flock into a smoky murmuration. Arm Scatter's L/M/H chips and every beat BLASTS the flock apart from its centre before it regathers; Cohesion sets how tightly it wheels.",
      params: ["bdcount", "bdspeed", "bdcoh", "bdfear", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "boids"], boids: true,
      stamp: (xL, xR, yT, yB, n) => boidsStamp(xL, xR, yT, yB, n),
      bakesOwnZoom: true,
      filters: ["fade"],
      defaults: { palcycle: [0, 0], palhold: [0, 0], bdcount: [80, 80], bdspeed: [1, 1], bdcoh: [1, 1], bdfear: [0, 0], fade: [0.93, 0.93], points: [2500, 2500], rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
      beat: {}, extras: { palette: "1", morph: false, showBox: true, randSeed: true } },
  ];
  EFFECTS.forEach((f, i) => effectSel.appendChild(new Option(f.name, String(i))));   // build the dropdown from the registry
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
    });
  })();

  // Effect identity in *saved* blobs is a stable string id, not the volatile numeric
  // index — so reordering/removing effects never silently remaps or drops saved
  // presets. Everything in memory stays a numeric index; convert only at the
  // serialize/deserialize edge (persist/backup/share out, applyBlob/restore in).
  const LEGACY_EFFECT_IDS = ["sirpinfyer", "tetrafyer", "animejulia", "plasma"];   // old index → id, for blobs saved before ids existed
  const effectId = idx => (EFFECTS[idx] || EFFECTS[0]).id;
  function effectIndexFromId(v) {                 // id (or a legacy number) → current numeric index, or -1
    if (typeof v === "number") v = LEGACY_EFFECT_IDS[v];
    return EFFECTS.findIndex(f => f.id === v);
  }
  // The per-effect maps are keyed by registry POSITION, which only means anything in the
  // build that wrote them. They get the same id treatment as `effect` at the storage
  // edge — otherwise reordering or removing an effect silently reattaches every saved
  // scene to whichever effect now sits at that index, in localStorage, Backups and
  // share links alike. Presets were already safe (their `effect` is an id); these maps
  // were the hole in that guarantee, and the failure is invisible until someone reorders.
  const EFFECT_MAPS = ["states", "beats", "pulses", "plens", "extras"];
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
  function serializeBlob(b) {                      // numeric effect indices → ids, for storage
    const out = { ...b };
    if (typeof b.effect === "number") out.effect = effectId(b.effect);
    if (Array.isArray(b.presets)) out.presets = b.presets.map(p => (p && typeof p.effect === "number" ? { ...p, effect: effectId(p.effect) } : p));
    for (const f of EFFECT_MAPS) if (b[f] && typeof b[f] === "object") out[f] = keysToIds(b[f]);
    return out;
  }
  function deserializeBlob(b) {                    // ids (or legacy numbers) → numeric indices; drops unknown-effect presets
    if (!b || typeof b !== "object") return b;
    const out = { ...b };
    if (b.effect !== undefined) { const i = effectIndexFromId(b.effect); if (i >= 0) out.effect = i; else delete out.effect; }
    if (Array.isArray(b.presets)) out.presets = b.presets.map(p => {
      if (!p || typeof p !== "object") return null;
      const i = effectIndexFromId(p.effect);
      return i >= 0 ? { ...p, effect: i } : null;
    }).filter(Boolean);
    for (const f of EFFECT_MAPS) if (b[f] && typeof b[f] === "object") out[f] = keysToIdx(b[f]);
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
