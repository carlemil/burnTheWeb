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
      params: ["points", "layers", "speed", "size", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "fire"], fractal2d: true,
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [22, 22], rise: [52, 52], zoom: [1, 1], size: [1, 1], rot: [0, 0], layers: 3, rpm: [0.03, 0.03], ratio: [21.5, 21.5], inrad: [0.03, 0.03], outrad: [1.05, 1.05], phase: [0, 0], points: 3850 },
      beat: {}, extras: { palette: "7", morph: false, showBox: true, randSeed: true } },
    { id: "tetrafyer", name: "Tetrahedron", subtitle: "Sierpiński tetrahedron · classic fire",
      help: "A 3D Sierpiński tetrahedron that is a rigid body bouncing inside a box under real physics; its four tumbling corners seed the same fire, and each wall hit bursts a sphere of sparks. The box drifts because two things turn it: Rotation yaws it (it drifts −5…5°/s out of the box — set both thumbs to 0 to stop it) and Box nod pitches it up and down in a slow sine. Box nod 0 holds it level; Nod speed scales how fast it swings.",
      params: ["showbox", "boxsize", "points", "layers", "speed", "size", "rot", "nod", "nodspd", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "fire", "tetra"],
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [23, 23], rise: [105, 105], zoom: [1, 1], size: [1.75, 1.75], rot: [0, 0], nod: [17.2, 17.2], nodspd: [1, 1], boxsize: [4, 4], layers: 3, rpm: [0.03, 0.03], ratio: [21.5, 21.5], inrad: [0.03, 0.03], outrad: [1.05, 1.05], phase: [0, 0], points: 1500 },
      beat: {}, extras: { palette: "1", morph: false, showBox: false, randSeed: true } },
    { id: "animejulia", name: "AnimeJulia", subtitle: "Julia set · animated seed",
      help: "A live Julia set. The seed point c orbits the rim of the Mandelbrot cardioid; each pixel's escape time is coloured through the palette.",
      params: ["rpm", "ratio", "inrad", "outrad", "phase", "cardx", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold", "band", "bandsize", "banddim", "randseed"], helpTags: ["all", "julia", "band"],
      bakesOwnZoom: true, cardioid: true, onEnter: () => reseedJulia(), draw: dt => { const s = juliaSeed(dt); if (useGL) glJulia(s); else julia(s); },
      defaults: { palcycle: [0, 0], palhold: [0, 0], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [92, 92], rise: [130, 130], zoom: [1, 1], size: [1, 1], rot: [0, 0], layers: 1, rpm: [0.28, 0.28], ratio: [8.5, 8.5], inrad: [0.03, 0.03], outrad: [1, 1], phase: [0, 0], cardx: [0, 0], points: 1500 },
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
      help: "The Multibrot family: z^power + c, with the seed orbiting the cardioid like AnimeJulia (so it shares those controls). Power is a whole number and steps 2, 3, 4… — each step adds a bulb of symmetry. The seed rides the matching degree-power cardioid, which has power−1 cusps, and the orbit sprints through every one of them and eases off in between.",
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
      params: ["ata", "atb", "atc", "atd", "atjit", "points", "zoom", "camrx", "camry", "camrz", "palcycle", "palhold"], helpTags: ["all", "attractor"],
      stamp: (xL, xR, yT, yB, n) => attractorStamp(xL, xR, yT, yB, n),
      defaults: { palcycle: [0, 0], palhold: [0, 0], ata: [1.3, 1.3], atb: [-2.4, -2.4], atc: [2.3, 2.3], atd: [-2.2, -2.2], atjit: [0.5, 0.5], points: 6000, rise: [130, 130], zoom: [1, 1], band: [0, 0], bandsize: [1, 1], banddim: [0, 0], speed: [10, 10], size: [1, 1], rot: [0, 0], layers: 1 },
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
