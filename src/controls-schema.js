  // ---- per-effect controls, generated from the CONTROLS schema ----
  // One entry per slider/checkbox; buildControls() renders the DOM (exactly what
  // bindRange/bind/makeChips expect) into the Effect section (`fx`) or the Colour
  // section's banding block (`band`), and setEffect shows only the keys listed in the
  // current effect's `params`. Adding a slider to a new effect = add a CONTROLS entry
  // and list its key in the descriptor's `params` — no hand-written HTML. Defaults for
  // the lo/hi thumbs are cosmetic (loadState overwrites them from the effect's defaults).
  // Every slider readout goes through this: at most 3 significant digits, with
  // trailing zeros trimmed — 0.00111, 0.0123, 21.5, 1000. Sliders are continuous
  // (step="any"), so a fixed number of decimals would either hide real movement
  // or print noise like 0.012340000000000001.
  const sig3 = v => String(Number((+v).toPrecision(3)));
  const CONTROLS = [
    { key: "showbox", host: "fx", group: "shape", type: "check", label: "Show box" },
    { key: "boxsize", host: "fx", group: "shape", type: "dual", label: "Box size", valId: "vBoxSize", min: 0.8, max: 5, step: 0.05, lo: 2, hi: 2, fmt: v => sig3(v) + "×", apply: v => boxSize = v, durScale: 10 },
    { key: "points", host: "fx", group: "shape", type: "dual", label: "Points", valId: "vPoints", min: 100, max: 8000, step: 50, lo: 2500, hi: 2500, fmt: v => sig3(v), apply: v => cfg.points = Math.round(v), durScale: 10 },
    { key: "layers", host: "fx", group: "shape", type: "layers", label: "Objects", valId: "vLayers" },
    { key: "speed", host: "fx", group: "shape", type: "dual", label: "Drift speed", valId: "vSpeed", min: 1, max: 300, step: 1, lo: 92, hi: 92, fmt: v => sig3(v), apply: v => cfg.speed = v / 100 },

    { key: "size", host: "fx", group: "shape", type: "dual", label: "Size", valId: "vSize", min: 0.3, max: 5, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => fractalSize = v, durScale: 10 },
    { key: "rot", host: "fx", group: "shape", type: "dual", label: "Rotation", valId: "vRot", min: -180, max: 180, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "°/s", apply: v => rotSpeed = v * Math.PI / 180, durScale: 10 },
    { key: "nod", host: "fx", group: "shape", type: "dual", label: "Box nod", valId: "vNod", min: 0, max: 90, step: 0.1, lo: 17.2, hi: 17.2, fmt: v => sig3(v) + "°", apply: v => nodAmp = v * Math.PI / 180, durScale: 10 },
    { key: "nodspd", host: "fx", group: "shape", type: "dual", label: "Nod speed", valId: "vNodSpd", min: 0, max: 4, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => nodSpd = v, durScale: 10 },
    { key: "sway", host: "fx", group: "shape", type: "dual", label: "Sway", valId: "vSway", min: 0, max: 1.2, step: 0.02, lo: 0.5, hi: 0.5, fmt: v => sig3(v) + "×", apply: v => swaySize = v, durScale: 10 },
    { key: "rpm", host: "fx", group: "cardioid", type: "dual", label: "Cardioid RPM", valId: "vRpm", min: 0, max: 4, step: 0.01, lo: 0.03, hi: 0.15, fmt: v => sig3(v), apply: v => juliaBigRpm = v, durScale: 10 },
    { key: "ratio", host: "fx", group: "cardioid", type: "dual", label: "Inner : outer ratio", valId: "vRatio", min: 1, max: 60, step: 0.5, lo: 21.5, hi: 21.5, fmt: v => sig3(v) + "×", apply: v => juliaRatio = v },
    { key: "inrad", host: "fx", group: "cardioid", type: "dual", label: "Inner radius", valId: "vInRad", min: 0, max: 0.5, step: 0.01, lo: 0.03, hi: 0.03, fmt: v => sig3(v), apply: v => juliaInnerR = v, durScale: 10 },
    { key: "outrad", host: "fx", group: "cardioid", type: "dual", label: "Outer radius", valId: "vOutRad", min: 0.5, max: 2.5, step: 0.01, lo: 1.05, hi: 1.05, fmt: v => sig3(v) + "×", apply: v => juliaOuterR = v, durScale: 10 },
    { key: "phase", host: "fx", group: "cardioid", type: "dual", label: "Cardioid start", valId: "vPhase", min: 0, max: 0.1, step: 0.001, lo: 0, hi: 0, fmt: v => sig3(v), apply: v => juliaPhase = v, durScale: 10 },
    // Slides the whole seed orbit along the real axis. Slider units are hundredths
    // of the complex plane (like Drift speed), so ±50 walks the orbit ±0.5 — enough
    // to ride it off the cardioid into the bulbs and back.
    { key: "cardx", host: "fx", group: "cardioid", type: "dual", label: "Cardioid X offset", valId: "vCardX", min: -50, max: 50, step: 1, lo: 0, hi: 0, fmt: v => (v > 0 ? "+" : "") + sig3(v), apply: v => juliaOffX = v / 100, durScale: 10 },
    { key: "pspeed", host: "fx", group: "plasma", type: "dual", label: "Speed", valId: "vPspeed", min: 0, max: 3, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => plasmaSpeed = v, durScale: 10 },
    { key: "pscale", host: "fx", group: "plasma", type: "dual", label: "Scale", valId: "vPscale", min: 0.3, max: 3, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => plasmaScale = v, durScale: 10 },
    { key: "pwarp", host: "fx", group: "plasma", type: "dual", label: "Warp", valId: "vPwarp", min: 0, max: 2, step: 0.05, lo: 0.5, hi: 0.5, fmt: v => sig3(v), apply: v => plasmaWarp = v, durScale: 10 },
    { key: "tunspeed", host: "fx", group: "tunnel", type: "dual", label: "Fly speed", valId: "vTunSpeed", min: 0, max: 3, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => tunSpeed = v, durScale: 10 },
    { key: "tuntwist", host: "fx", group: "tunnel", type: "dual", label: "Twist", valId: "vTunTwist", min: -2, max: 2, step: 0.05, lo: 0.3, hi: 0.3, fmt: v => sig3(v), apply: v => tunTwist = v, durScale: 10 },
    { key: "tunrings", host: "fx", group: "tunnel", type: "dual", label: "Ring density", valId: "vTunRings", min: 1, max: 30, step: 0.5, lo: 10, hi: 10, fmt: v => sig3(v), apply: v => tunRings = v, durScale: 10 },
    { key: "mbcount", host: "fx", group: "metaball", type: "dual", label: "Ball count", valId: "vMbCount", min: 2, max: 16, step: 1, lo: 4, hi: 4, fmt: v => sig3(v), apply: v => mbCount = Math.round(v), durScale: 10 },   // max must stay <= the FS_METABALL loop bound (its hard ceiling)
    { key: "mbradius", host: "fx", group: "metaball", type: "dual", label: "Ball size", valId: "vMbRadius", min: 0.04, max: 0.3, step: 0.005, lo: 0.12, hi: 0.12, fmt: v => sig3(v), apply: v => mbRadius = v, durScale: 10 },
    { key: "mbspeed", host: "fx", group: "metaball", type: "dual", label: "Ball speed", valId: "vMbSpeed", min: 0, max: 3, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => mbSpeed = v, durScale: 10 },
    { key: "mbgain", host: "fx", group: "metaball", type: "dual", label: "Gain", valId: "vMbGain", min: 0.3, max: 3, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v), apply: v => mbGain = v, durScale: 10 },
    { key: "ksegments", host: "fx", group: "kaleido", type: "dual", label: "Segments", valId: "vKSeg", min: 3, max: 16, step: 1, lo: 6, hi: 6, fmt: v => sig3(v), apply: v => kSeg = Math.round(v), durScale: 10 },
    { key: "krotspeed", host: "fx", group: "kaleido", type: "dual", label: "Spin", valId: "vKRot", min: -1, max: 1, step: 0.02, lo: 0.2, hi: 0.2, fmt: v => sig3(v), apply: v => kRotSpeed = v, durScale: 10 },
    { key: "knoisespeed", host: "fx", group: "kaleido", type: "dual", label: "Flow", valId: "vKFlow", min: 0, max: 3, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => kNoiseSpeed = v, durScale: 10 },
    { key: "rzrot", host: "fx", group: "rotozoom", type: "dual", label: "Rotation", valId: "vRzRot", min: -2, max: 2, step: 0.02, lo: 0.4, hi: 0.4, fmt: v => sig3(v), apply: v => rzRot = v, durScale: 10 },
    { key: "rzzoom", host: "fx", group: "rotozoom", type: "dual", label: "Zoom pulse", valId: "vRzZoom", min: 0, max: 1.5, step: 0.02, lo: 0.5, hi: 0.5, fmt: v => sig3(v), apply: v => rzZoomAmt = v, durScale: 10 },
    { key: "rztile", host: "fx", group: "rotozoom", type: "dual", label: "Tile density", valId: "vRzTile", min: 1, max: 12, step: 0.5, lo: 4, hi: 4, fmt: v => sig3(v), apply: v => rzTile = v, durScale: 10 },
    { key: "xorspeed", host: "fx", group: "munch", type: "dual", label: "Munch speed", valId: "vXorSpeed", min: 0, max: 80, step: 1, lo: 20, hi: 20, fmt: v => sig3(v), apply: v => xorSpeed = v, durScale: 10 },
    { key: "xorscale", host: "fx", group: "munch", type: "dual", label: "Square size", valId: "vXorScale", min: 0.1, max: 2, step: 0.02, lo: 0.4, hi: 0.4, fmt: v => sig3(1 / v) + "px", apply: v => xorScale = v, durScale: 10 },
    { key: "xormask", host: "fx", group: "munch", type: "dual", label: "Detail", valId: "vXorMask", min: 15, max: 255, step: 1, lo: 255, hi: 255, fmt: v => sig3(v), apply: v => xorMask = Math.round(v), durScale: 10 },
    { key: "mofreq", host: "fx", group: "moire", type: "dual", label: "Ring frequency", valId: "vMoFreq", min: 2, max: 40, step: 0.5, lo: 10, hi: 10, fmt: v => sig3(v), apply: v => moFreq = v, durScale: 10 },
    { key: "modrift", host: "fx", group: "moire", type: "dual", label: "Drift speed", valId: "vMoDrift", min: 0, max: 3, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => moDrift = v, durScale: 10 },
    { key: "momix", host: "fx", group: "moire", type: "dual", label: "Blend", valId: "vMoMix", min: 0, max: 1, step: 0.02, lo: 0.3, hi: 0.3, fmt: v => sig3(v), apply: v => moMix = v, durScale: 10 },
    { key: "nwspin", host: "fx", group: "newton", type: "dual", label: "Root spin", valId: "vNwSpin", min: -1, max: 1, step: 0.01, lo: 0.15, hi: 0.15, fmt: v => sig3(v), apply: v => nwSpin = v, durScale: 10 },
    { key: "nwrelax", host: "fx", group: "newton", type: "dual", label: "Relaxation", valId: "vNwRelax", min: 0.4, max: 1.8, step: 0.02, lo: 1, hi: 1, fmt: v => sig3(v), apply: v => nwRelax = v, durScale: 10 },
    // Integer only. The thumbs still animate continuously — apply() rounds, so the
    // live exponent is always a whole number. Fractional powers were never really
    // sound: z^d uses the principal branch of the log, discontinuous across the
    // negative real axis, so their connectedness locus is a ragged object the seed
    // orbit can't track cleanly (measured ~40–55% of a lap inside it, vs ~20% at
    // integer powers). Rounding also makes power−1 — the cusp count the easing keys
    // off — a whole number, which is what makes the warp line up with the cusps.
    { key: "mbexp", host: "fx", group: "multibrot", type: "dual", label: "Power", valId: "vMbExp", min: 2, max: 6, step: 1, lo: 2, hi: 4, fmt: v => String(Math.round(v)), apply: v => mbPower = Math.round(v), durScale: 10 },
    { key: "cbcount", host: "fx", group: "copper", type: "dual", label: "Bar count", valId: "vCbCount", min: 1, max: 12, step: 1, lo: 5, hi: 5, fmt: v => sig3(v), apply: v => cbCount = Math.round(v), durScale: 10 },
    { key: "cbspeed", host: "fx", group: "copper", type: "dual", label: "Bar speed", valId: "vCbSpeed", min: 0, max: 3, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => cbSpeed = v, durScale: 10 },
    { key: "cbwidth", host: "fx", group: "copper", type: "dual", label: "Bar width", valId: "vCbWidth", min: 0.02, max: 0.3, step: 0.005, lo: 0.12, hi: 0.12, fmt: v => sig3(v), apply: v => cbWidth = v, durScale: 10 },
    // Geometric shapes — Polygon
    { key: "pgsides", host: "fx", group: "polygon", type: "dual", label: "Sides", valId: "vPgSides", min: 3, max: 12, step: 1, lo: 5, hi: 5, fmt: v => sig3(v), apply: v => pgSides = Math.round(v), durScale: 10 },
    { key: "pgrad", host: "fx", group: "polygon", type: "dual", label: "Size", valId: "vPgRad", min: 0.1, max: 0.5, step: 0.01, lo: 0.35, hi: 0.35, fmt: v => sig3(v), apply: v => pgRad = v, durScale: 10 },
    { key: "pgthick", host: "fx", group: "polygon", type: "dual", label: "Thickness", valId: "vPgThick", min: 0, max: 1, step: 0.02, lo: 1, hi: 1, fmt: v => sig3(v), apply: v => pgThick = v, durScale: 10 },
    { key: "pgspin", host: "fx", group: "polygon", type: "dual", label: "Spin", valId: "vPgSpin", min: -2, max: 2, step: 0.05, lo: 0.4, hi: 0.4, fmt: v => sig3(v) + "×", apply: v => pgSpinSpeed = v, durScale: 10 },
    // Shape grid
    { key: "sgcells", host: "fx", group: "shapegrid", type: "dual", label: "Density", valId: "vSgCells", min: 2, max: 24, step: 1, lo: 9, hi: 9, fmt: v => sig3(v), apply: v => sgCells = Math.round(v), durScale: 10 },
    { key: "sgdot", host: "fx", group: "shapegrid", type: "dual", label: "Size", valId: "vSgDot", min: 0.05, max: 0.6, step: 0.01, lo: 0.3, hi: 0.3, fmt: v => sig3(v), apply: v => sgDot = v, durScale: 10 },
    { key: "sgsquare", host: "fx", group: "shapegrid", type: "dual", label: "Squareness", valId: "vSgSquare", min: 0, max: 1, step: 0.02, lo: 0, hi: 0, fmt: v => sig3(v), apply: v => sgSquare = v, durScale: 10 },
    { key: "sgpulse", host: "fx", group: "shapegrid", type: "dual", label: "Pulse", valId: "vSgPulse", min: 0, max: 1, step: 0.02, lo: 0.35, hi: 0.35, fmt: v => sig3(v), apply: v => sgPulse = v, durScale: 10 },
    { key: "sgspeed", host: "fx", group: "shapegrid", type: "dual", label: "Pulse speed", valId: "vSgSpeed", min: 0, max: 4, step: 0.05, lo: 1.2, hi: 1.2, fmt: v => sig3(v) + "×", apply: v => sgSpeed = v, durScale: 10 },
    // Concentric rings
    { key: "cosides", host: "fx", group: "concentric", type: "dual", label: "Sides", valId: "vCoSides", min: 3, max: 12, step: 1, lo: 6, hi: 6, fmt: v => sig3(v), apply: v => coSides = Math.round(v), durScale: 10 },
    { key: "cocount", host: "fx", group: "concentric", type: "dual", label: "Ring count", valId: "vCoCount", min: 1, max: 20, step: 1, lo: 6, hi: 6, fmt: v => sig3(v), apply: v => coCount = v, durScale: 10 },
    { key: "cothick", host: "fx", group: "concentric", type: "dual", label: "Thickness", valId: "vCoThick", min: 0.02, max: 0.98, step: 0.02, lo: 0.4, hi: 0.4, fmt: v => sig3(v), apply: v => coThick = v, durScale: 10 },
    { key: "cospeed", host: "fx", group: "concentric", type: "dual", label: "March speed", valId: "vCoSpeed", min: -3, max: 3, step: 0.05, lo: 0.6, hi: 0.6, fmt: v => sig3(v) + "×", apply: v => coSpeed = v, durScale: 10 },
    { key: "cospin", host: "fx", group: "concentric", type: "dual", label: "Spin", valId: "vCoSpin", min: -2, max: 2, step: 0.05, lo: 0.1, hi: 0.1, fmt: v => sig3(v) + "×", apply: v => coSpinSpeed = v, durScale: 10 },
    // Bouncing shapes
    { key: "bncount", host: "fx", group: "bounce", type: "dual", label: "Count", valId: "vBnCount", min: 1, max: 8, step: 1, lo: 4, hi: 4, fmt: v => sig3(v), apply: v => bnCount = Math.round(v), durScale: 10 },
    { key: "bnrad", host: "fx", group: "bounce", type: "dual", label: "Size", valId: "vBnRad", min: 0.02, max: 0.25, step: 0.005, lo: 0.09, hi: 0.09, fmt: v => sig3(v), apply: v => bnRad = v, durScale: 10 },
    { key: "bnsquare", host: "fx", group: "bounce", type: "dual", label: "Squareness", valId: "vBnSquare", min: 0, max: 1, step: 0.02, lo: 0.6, hi: 0.6, fmt: v => sig3(v), apply: v => bnSquare = v, durScale: 10 },
    { key: "bnspeed", host: "fx", group: "bounce", type: "dual", label: "Speed", valId: "vBnSpeed", min: 0, max: 4, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => bnSpeed = v, durScale: 10 },
    // Bouncing solids (3D). Count/Size feed the physics as well as the shader — Size IS the
    // bounding radius every wall test uses, so widening it makes them bounce sooner too.
    { key: "sdcount", host: "fx", group: "solids", type: "dual", label: "Count", valId: "vSdCount", min: 1, max: 8, step: 1, lo: 5, hi: 5, fmt: v => sig3(v), apply: v => sdCount = Math.round(v), durScale: 10 },
    { key: "sdsize", host: "fx", group: "solids", type: "dual", label: "Size", valId: "vSdSize", min: 0.08, max: 0.5, step: 0.005, lo: 0.26, hi: 0.26, fmt: v => sig3(v), apply: v => sdSize = v, durScale: 10 },
    { key: "sdmix", host: "fx", group: "solids", type: "dual", label: "Shape mix", valId: "vSdMix", min: 1, max: 6, step: 1, lo: 6, hi: 6, fmt: v => sig3(v), apply: v => sdMix = Math.round(v), durScale: 10 },
    { key: "sdspeed", host: "fx", group: "solids", type: "dual", label: "Speed", valId: "vSdSpeed", min: 0, max: 4, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => sdSpeed = v, durScale: 10 },
    { key: "sdspin", host: "fx", group: "solids", type: "dual", label: "Tumble", valId: "vSdSpin", min: 0, max: 4, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => sdSpin = v, durScale: 10 },
    { key: "sdrim", host: "fx", group: "solids", type: "dual", label: "Edge glow", valId: "vSdRim", min: 0, max: 1.5, step: 0.02, lo: 0.55, hi: 0.55, fmt: v => sig3(v), apply: v => sdRim = v, durScale: 10 },
    { key: "ata", host: "fx", group: "attractor", type: "dual", label: "Coeff a", valId: "vAtA", min: -3, max: 3, step: 0.01, lo: 1.4, hi: 1.4, fmt: v => sig3(v), apply: v => atA = v, durScale: 10 },
    { key: "atb", host: "fx", group: "attractor", type: "dual", label: "Coeff b", valId: "vAtB", min: -3, max: 3, step: 0.01, lo: -2.3, hi: -2.3, fmt: v => sig3(v), apply: v => atB = v, durScale: 10 },
    { key: "atc", host: "fx", group: "attractor", type: "dual", label: "Coeff c", valId: "vAtC", min: -3, max: 3, step: 0.01, lo: 2.4, hi: 2.4, fmt: v => sig3(v), apply: v => atC = v, durScale: 10 },
    { key: "atd", host: "fx", group: "attractor", type: "dual", label: "Coeff d", valId: "vAtD", min: -3, max: 3, step: 0.01, lo: -2.1, hi: -2.1, fmt: v => sig3(v), apply: v => atD = v, durScale: 10 },
    { key: "atjit", host: "fx", group: "attractor", type: "dual", label: "Point jitter", valId: "vAtJit", min: 0, max: 3, step: 0.05, lo: 0.5, hi: 0.5, fmt: v => sig3(v) + "px", apply: v => atJit = v, durScale: 10 },
    { key: "zoom", host: "fx", group: "camera", type: "dual", label: "Zoom", valId: "vZoom", min: 0.5, max: 4, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => zoom = v, durScale: 10 },
    // Camera rotation, in degrees, shown for every effect. Global on purpose:
    // deliberately absent from every effect's `defaults`, so save/loadState (which
    // iterate the defaults) leave them alone and they persist across effect switches.
    { key: "camrx", host: "fx", group: "camera", type: "dual", label: "Camera X", valId: "vCamRX", min: -180, max: 180, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "°", apply: v => camRX = v * Math.PI / 180, durScale: 10 },
    { key: "camry", host: "fx", group: "camera", type: "dual", label: "Camera Y", valId: "vCamRY", min: -180, max: 180, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "°", apply: v => camRY = v * Math.PI / 180, durScale: 10 },
    { key: "camrz", host: "fx", group: "camera", type: "dual", label: "Camera Z", valId: "vCamRZ", min: -180, max: 180, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "°", apply: v => camRZ = v * Math.PI / 180, durScale: 10 },
    { key: "randseed", host: "fx", group: "other", type: "check", label: "Random seed each reload" },
    // Palette cycle time, in seconds, as a [min,max] band: each morph holds for a
    // random time drawn from it (like Preset TTL). Collapsed to 0 = fixed palette.
    // This replaced the old "Auto-morph palettes" checkbox — `morphing` is now
    // derived from the slider rather than stored separately.
    { key: "palcycle", host: "pal", group: "palette", type: "dual", label: "Palette cycle", valId: "vPalCycle", min: 0, max: 120, step: 1, lo: 8, hi: 8, fmt: v => v <= 0 ? "fixed" : sig3(v) + "s", apply: v => palCycleLive = v, durScale: 10 },
    { key: "palhold", host: "pal", group: "palette", type: "dual", label: "Palette hold", valId: "vPalHold", min: 0, max: 120, step: 1, lo: 0, hi: 0, fmt: v => v <= 0 ? "none" : sig3(v) + "s", apply: v => palHoldLive = v, durScale: 10, beat: false },
    // Heat boost: remap the heat toward the palette's bright end (see heatBoost). 0 = the palette
    // as-is; per-layer (host "pal"), so each layer boosts its own palette. Animatable + beat-armable.
    { key: "heatboost", host: "pal", group: "palette", type: "dual", label: "Heat boost", valId: "vHeatBoost", min: 0, max: 4, step: 0.05, lo: 0, hi: 0, fmt: v => v <= 0 ? "off" : "+" + sig3(v), apply: v => heatBoost = v, durScale: 10 },
    // ---- filter parameters. Contiguous, one group per filter, host "filter" so
    // they render in the Filters box; shown only while their filter is ticked. ----
    { key: "rise", host: "filter", group: "f_fire", type: "dual", label: "Flame rise", valId: "vRise", min: 3, max: 200, step: 1, lo: 130, hi: 130, fmt: v => sig3(v), apply: v => cfg.decay = 128 * v / (v - 1) },
    { key: "burn", host: "filter", group: "f_fire", type: "dual", label: "Burn rate", valId: "vBurn", min: 20, max: 240, step: 1, lo: 120, hi: 120, fmt: v => sig3(v) + "/s", apply: v => cfg.burn = Math.max(1, v), durScale: 10 },
    { key: "fade", host: "filter", group: "f_fade", type: "dual", label: "Lifetime", valId: "vFade", min: 0.5, max: 0.995, step: 0.001, lo: 0.94, hi: 0.94, fmt: v => sig3(v * 100) + "%", apply: v => fadeKeep = v, durScale: 10 },
    { key: "diffuse", host: "filter", group: "f_diffuse", type: "dual", label: "Spread", valId: "vDiffuse", min: 0.5, max: 6, step: 0.1, lo: 1, hi: 1, fmt: v => sig3(v) + "px", apply: v => diffRad = v, durScale: 10 },
    { key: "diffkeep", host: "filter", group: "f_diffuse", type: "dual", label: "Lifetime", valId: "vDiffKeep", min: 0.5, max: 1, step: 0.001, lo: 0.97, hi: 0.97, fmt: v => sig3(v * 100) + "%", apply: v => diffKeep = v, durScale: 10 },
    { key: "echo", host: "filter", group: "f_echo", type: "dual", label: "Distance", valId: "vEcho", min: 0, max: 8, step: 0.1, lo: 2, hi: 2, fmt: v => sig3(v) + "px", apply: v => echoDist = v, durScale: 10 },
    { key: "echoang", host: "filter", group: "f_echo", type: "dual", label: "Angle", valId: "vEchoAng", min: 0, max: 360, step: 1, lo: 90, hi: 90, fmt: v => sig3(v) + "°", apply: v => echoAng = v, durScale: 10 },
    { key: "echokeep", host: "filter", group: "f_echo", type: "dual", label: "Lifetime", valId: "vEchoKeep", min: 0.5, max: 0.995, step: 0.001, lo: 0.94, hi: 0.94, fmt: v => sig3(v * 100) + "%", apply: v => echoKeep = v, durScale: 10 },
    { key: "zfb", host: "filter", group: "f_zoomfb", type: "dual", label: "Scale", valId: "vZfb", min: 0.9, max: 1.1, step: 0.001, lo: 1.02, hi: 1.02, fmt: v => sig3(v) + "×", apply: v => zfbScale = v, durScale: 10 },
    { key: "zfbkeep", host: "filter", group: "f_zoomfb", type: "dual", label: "Lifetime", valId: "vZfbKeep", min: 0.5, max: 0.995, step: 0.001, lo: 0.94, hi: 0.94, fmt: v => sig3(v * 100) + "%", apply: v => zfbKeep = v, durScale: 10 },
    { key: "swirl", host: "filter", group: "f_swirl", type: "dual", label: "Spin", valId: "vSwirl", min: -15, max: 15, step: 0.1, lo: 2, hi: 2, fmt: v => sig3(v) + "°", apply: v => swirlSpin = v, durScale: 10 },
    { key: "swirlkeep", host: "filter", group: "f_swirl", type: "dual", label: "Lifetime", valId: "vSwirlKeep", min: 0.5, max: 0.995, step: 0.001, lo: 0.94, hi: 0.94, fmt: v => sig3(v * 100) + "%", apply: v => swirlKeep = v, durScale: 10 },
    { key: "twist", host: "filter", group: "f_twist", type: "dual", label: "Amount", valId: "vTwist", min: -4, max: 4, step: 0.05, lo: 1.2, hi: 1.2, fmt: v => sig3(v), apply: v => twistAmt = v, durScale: 10 },
    { key: "wedgeseg", host: "filter", group: "f_wedge", type: "dual", label: "Segments", valId: "vWedgeSeg", min: 2, max: 16, step: 1, lo: 6, hi: 6, fmt: v => sig3(Math.round(v)), apply: v => wedgeSeg = v, durScale: 10 },
    { key: "wedgerot", host: "filter", group: "f_wedge", type: "dual", label: "Spin", valId: "vWedgeRot", min: 0, max: 360, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "°", apply: v => wedgeRot = v, durScale: 10 },
    { key: "glitch", host: "filter", group: "f_glitch", type: "dual", label: "Amount", valId: "vGlitch", min: 0, max: 0.5, step: 0.005, lo: 0.05, hi: 0.05, fmt: v => sig3(v * 100) + "%", apply: v => glitchAmt = v, durScale: 10 },
    { key: "glitchrows", host: "filter", group: "f_glitch", type: "dual", label: "Slice height", valId: "vGlitchRows", min: 1, max: 40, step: 1, lo: 8, hi: 8, fmt: v => sig3(v) + "px", apply: v => glitchRows = v, durScale: 10 },
    { key: "pixel", host: "filter", group: "f_pixelate", type: "dual", label: "Block", valId: "vPixel", min: 2, max: 40, step: 1, lo: 6, hi: 6, fmt: v => sig3(v) + "px", apply: v => pixelBlock = v, durScale: 10 },
    { key: "soften", host: "filter", group: "f_soften", type: "dual", label: "Amount", valId: "vSoften", min: -1, max: 2, step: 0.01, lo: -0.6, hi: -0.6, fmt: v => v < 0 ? "blur " + sig3(-v) : "sharp " + sig3(v), apply: v => softenAmt = v, durScale: 10 },
    { key: "softrad", host: "filter", group: "f_soften", type: "dual", label: "Radius", valId: "vSoftRad", min: 0.5, max: 6, step: 0.1, lo: 1.5, hi: 1.5, fmt: v => sig3(v) + "px", apply: v => softenRad = v, durScale: 10 },
    { key: "edge", host: "filter", group: "f_edge", type: "dual", label: "Amount", valId: "vEdge", min: 0, max: 1, step: 0.01, lo: 0.7, hi: 0.7, fmt: v => sig3(v), apply: v => edgeAmt = v, durScale: 10 },
    { key: "poster", host: "filter", group: "f_poster", type: "dual", label: "Levels", valId: "vPoster", min: 2, max: 16, step: 1, lo: 5, hi: 5, fmt: v => sig3(Math.round(v)), apply: v => posterLevels = v, durScale: 10 },
    { key: "halfdot", host: "filter", group: "f_halftone", type: "dual", label: "Dot size", valId: "vHalfDot", min: 2, max: 20, step: 0.5, lo: 4, hi: 4, fmt: v => sig3(v) + "px", apply: v => halfDot = v, durScale: 10 },
    { key: "halfamt", host: "filter", group: "f_halftone", type: "dual", label: "Amount", valId: "vHalfAmt", min: 0, max: 1, step: 0.01, lo: 0.8, hi: 0.8, fmt: v => sig3(v), apply: v => halfAmt = v, durScale: 10 },
    { key: "threshlvl", host: "filter", group: "f_thresh", type: "dual", label: "Level", valId: "vThreshLvl", min: 0, max: 1, step: 0.01, lo: 0.5, hi: 0.5, fmt: v => sig3(v), apply: v => threshLevel = v, durScale: 10 },
    { key: "threshamt", host: "filter", group: "f_thresh", type: "dual", label: "Amount", valId: "vThreshAmt", min: 0, max: 1, step: 0.01, lo: 0.8, hi: 0.8, fmt: v => sig3(v), apply: v => threshAmt = v, durScale: 10 },
    { key: "chroma", host: "filter", group: "f_chroma", type: "dual", label: "Amount", valId: "vChroma", min: 0, max: 6, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v), apply: v => chromaAmt = v, durScale: 10 },
    { key: "mirror", host: "filter", group: "f_mirror", type: "dual", label: "Axis", valId: "vMirror", min: 1, max: 3, step: 1, lo: 1, hi: 1, fmt: v => ["", "X", "Y", "Both"][Math.round(v)] || "X", apply: v => mirrorMode = Math.round(v), durScale: 10 },
    { key: "bloom", host: "filter", group: "f_bloom", type: "dual", label: "Strength", valId: "vBloom", min: 0, max: 1.5, step: 0.01, lo: 0.35, hi: 0.35, fmt: v => sig3(v) + "×", apply: v => bloomAmt = filterOn("bloom") ? v : 0, durScale: 10 },
    { key: "barrel", host: "filter", group: "f_barrel", type: "dual", label: "Amount", valId: "vBarrel", min: 0, max: 0.6, step: 0.01, lo: 0.15, hi: 0.15, fmt: v => sig3(v), apply: v => barrelAmt = v, durScale: 10 },
    { key: "scan", host: "filter", group: "f_scanlines", type: "dual", label: "Amount", valId: "vScan", min: 0, max: 1, step: 0.01, lo: 0.35, hi: 0.35, fmt: v => sig3(v), apply: v => scanAmt = v, durScale: 10 },
    { key: "scancount", host: "filter", group: "f_scanlines", type: "dual", label: "Lines", valId: "vScanCount", min: 60, max: 800, step: 1, lo: 240, hi: 240, fmt: v => sig3(v), apply: v => scanCount = v, durScale: 10 },
    { key: "vignette", host: "filter", group: "f_vignette", type: "dual", label: "Amount", valId: "vVignette", min: 0, max: 1, step: 0.01, lo: 0.4, hi: 0.4, fmt: v => sig3(v), apply: v => vigAmt = v, durScale: 10 },
    { key: "grain", host: "filter", group: "f_grain", type: "dual", label: "Amount", valId: "vGrain", min: 0, max: 0.5, step: 0.005, lo: 0.08, hi: 0.08, fmt: v => sig3(v), apply: v => grainAmt = v, durScale: 10 },
    { key: "band", host: "band", group: "banding", type: "dual", label: "Banding", valId: "vBand", min: 0, max: 100, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "%", apply: v => bandLevel = v / 100 },
    { key: "bandsize", host: "band", group: "banding", type: "dual", label: "Band size", valId: "vBandSize", min: 1, max: 9, step: 1, lo: 1, hi: 1, fmt: v => sig3(v), apply: v => bandGroup = Math.round(v) },
    { key: "banddim", host: "band", group: "banding", type: "dual", label: "Darkness", valId: "vBandDim", min: 0, max: 100, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "%", apply: v => bandDim = 1 - v / 100 },
  ];
  // A control belongs to the SCENE rather than to one effect when it is not an effect
  // control (palette, banding) or the shared camera/display zoom. Everything else — every
  // effect param, AND now most filter params — is owned per stacked LAYER, so each effect
  // in a stack carries its own filter settings (each layer runs its own filter chain, see
  // renderStackColor). The exceptions stay scene-wide because they act on the ONE finished
  // image, not a layer: the sim tick-rate `burn` (a shared clock), the glow `bloom`, and
  // the four "screen" filters (Scanlines / Vignette / Film grain / Barrel).
  const SHARED_FILTER_KEYS = new Set(["burn", "bloom", "barrel", "scan", "scancount", "vignette", "grain"]);
  // Hosts whose sliders are PER-LAYER. "fx" is every effect slider, including the whole camera
  // group (zoom AND camera X/Y/Z) — each stacked effect samples its own space, so it holds its
  // own camera, pushed into camRX/RY/RZ by installStackItem before that layer draws.
  // "band" (banding) and "pal" (palette cycle/hold) are here because their values ALREADY live
  // per-effect in states[e], so loadState rewrote these supposedly scene-wide globals on every
  // layer selection — selecting a layer visibly re-banded the scene and changed its cycle timing.
  // They are per-layer in the render too: bakeLayerBytes bands each layer's own ramp and
  // stepLayerPal runs each layer's own clock, so nothing had to change downstream.
  const LAYER_HOSTS = new Set(["fx", "band", "pal"]);
  const isSceneCtl = c => c.host === "filter"
    ? SHARED_FILTER_KEYS.has(c.key)                       // filter params: per-layer unless shared
    : !LAYER_HOSTS.has(c.host);                           // TTL / transition / the scene filters stay scene-wide
  // A control's identifying attribute. A LAYER control exists once per stack slot, so it
  // cannot carry an id: duplicate ids are invalid and getElementById returns whichever comes
  // first, which would quietly route every edit to layer 1. It carries the same string on
  // `data-k` instead and is looked up through ctl()/ctlIn(). A SCENE control (ttl, tdur, burn,
  // bloom, the screen filters) exists once in the whole page and keeps its id, which is what
  // lets ctl() fall through to getElementById for it and leaves those sites untouched.
  //
  // The STRING never changes either way: "speed-lo" is a wire key (a stored `ranges` map is
  // keyed by it), so nothing on the wire moves.
  const kAttr = c => (isSceneCtl(c) ? ' id="' : ' data-k="');
  function ctlHTML(c) {
    const K = kAttr(c);
    const open = '<div class="ctl"' + K + 'ctl-' + c.key + '">';
    if (c.type === "check")
      return open + '<label class="check"><input type="checkbox"' + K + c.key + '" checked> ' + c.label + "</label></div>";
    if (c.type === "layers")
      return open + '<label>' + c.label + ' <span class="val"' + K + 'vLayers"></span></label>' +
        '<div class="presetrow"><button' + K + 'layer-minus" class="audbtn" type="button" title="Remove the smallest copy" aria-label="Fewer">−</button>' +
        '<button' + K + 'layer-plus" class="audbtn" type="button" title="Add a smaller copy — half size, half points, new seed" aria-label="More">+</button></div>' +
        '<input type="number"' + K + 'layers" min="1" max="6" step="1" value="1" style="display:none"></div>';
    const lbl = "<label>" + c.label + ' <span class="val"' + K + c.valId + '"></span></label>';
    if (c.type === "plain")
      return open + lbl + '<input' + K + c.key + '" type="range" min="' + c.min + '" max="' + c.max + '" step="any" value="' + c.value + '"></div>';
    // step="any": sliders are continuous. A quantised step made the readout lie
    // (a 0.001-step control formatted to 2dp looked like it jumped 0.01 -> 0.02),
    // and every value is shown to 3 significant digits by sig3() instead.
    const inp = t => '<input type="range"' + K + c.key + "-" + t + '" min="' + c.min + '" max="' + c.max + '" step="any" value="' + (t === "lo" ? c.lo : c.hi) + '">';
    return open + lbl + '<div class="dual"><div class="track"></div><div class="fill"></div>' + inp("lo") + inp("hi") + "</div></div>";
  }
  // The Filters checkbox list. Ticking one reveals its parameter group (see the
  // dynamic `shown` set in setEffect) and re-derives the live chain. Built once —
  // the list is the same for every effect, only the ticks differ.
  // Subheadings that say not just what each group of filters does, but WHERE it acts —
  // the one thing that matters now that filters are per-layer. Feedback and post filters
  // both run on EACH stacked effect on its own, with that effect's own values, so they are
  // ONE group; Bloom (the glow) and the screen filters act once on the finished, blended
  // image, so they read "Whole scene". Grouping is by this behaviour, not raw stage — Bloom
  // is a "post" filter internally but belongs with the whole-scene set, and it sits last
  // among the post filters, so it falls into that group without reordering FILTERS.
  //
  // Feedback and post were two headings ("heat & trails" / "image") until they were merged:
  // the split was the pipeline's, not the user's — both are "this layer's own filters", and
  // two captions saying so in different words only made the list longer. The single heading
  // still works out of the registry order (all feedback, then all post-but-Bloom, then the
  // whole-scene set), so the run stays contiguous and one caption is emitted for it.
  // ONE group: every filter belongs to a layer. There was a "Whole scene · final image" group
  // for Bloom and the four screen filters; they are per-layer passes now, so the group has
  // nothing to hold. FILTER_LISTS still has the scene entry and #screenfilterlist still
  // exists — both simply stay empty, which is what keeps the Scene filters box and its Add
  // button from needing special-casing if anything ever goes back.
  function filterGroup(f) {
    return { key: "layer", title: "Per-effect · heat, trails & image",
             desc: "each layer keeps its own fire, fade and warp, and is filtered on its own before they blend" };
  }
  // One <details> per filter: a grab handle + name in the summary, that filter's own params
  // in the body. Must run BEFORE the POPPABLE pass, which inserts each slider's .ctl-row
  // launcher next to its .ctl — moving the .ctl into a body afterwards would strand the row
  // in #filterctl.
  //
  // THE LIST SHOWS ONLY THE FILTERS YOU HAVE ADDED. It used to show all 22 with a checkbox
  // each, which is a wall of options you mostly are not using; now "+ Add filter" opens a
  // picker and the menu is just your chain, in order. Two consequences worth knowing:
  //
  //  - **Every section is built once and stays in the DOM forever**, hidden rather than
  //    removed. It holds this filter's `#ctl-<key>` param nodes, which were ADOPTED out of
  //    #filterctl — and `el()` is getElementById, which cannot find a detached node. Drop a
  //    section from the document and every lookup of its sliders (loadState, bindRange,
  //    refreshControlVisibility, the pop-out boxes) silently stops finding them.
  //  - **Order is expressed by re-appending**, since appendChild MOVES a node. renderFilterList
  //    re-appends the added sections in chain order on every change, so DOM order is the
  //    order, and a moved node keeps its children, listeners and adopted controls.
  //
  // `#flt-<id>` survives as a hidden checkbox inside each section: it is still the on/off
  // VALUE STORE that syncFilterUI writes and the picker reads, exactly as `#preset` and
  // `#palette` sit behind their visible pickers. Deleting it would mean rewriting all of them.
  // Per slot in `secs`; `filterSecs` is the SELECTED block's, installed by pointMaps. `let`,
  // not const, precisely so pointMaps can re-point it — setFilterOn, syncFilterSec and
  // flashStageMove all read it and must act on the layer you are editing.
  let filterSecs = {};
  // The two lists, and whether their order is the user's to choose. Only the per-effect
  // group is reorderable: the whole-scene filters are one fixed post-composite pass each,
  // and there is nothing meaningful to permute.
  const FILTER_LISTS = [
    { key: "layer", hostId: "filterlist", addId: "filter-add", reorder: true },
    { key: "scene", hostId: "screenfilterlist", addId: "screenfilter-add", reorder: false },
  ];
  function filterListOf(f) { return filterGroup(f).key === "scene" ? FILTER_LISTS[1] : FILTER_LISTS[0]; }
  const filterSetOf = id => (isSceneFilter(id) ? sceneOn : activeIds);
  // The ids currently in one list, in the order they will be applied.
  function listIds(key) { return listIdsFor(stackSel, key); }
  // One slot's chain. The selected layer's live set is `activeIds`; any other layer reads its
  // own record, falling back to its effect's shipped list — the same fallback stageLayerExtras
  // uses, and deliberately NOT `extras[L.fx]`, which is the per-effect last-used value and
  // would make every same-effect layer mirror the last one edited.
  function listIdsFor(slot, key) {
    if (key === "scene") return orderFilters([...sceneOn]).filter(f => filterListOf(f).key === key).map(f => f.id);
    const L = stack[slot];
    const src = slot === stackSel ? [...activeIds]
      : (L ? (filtersOk(L.filters) || presetFilters(L.fx)) : []);
    return orderFilters(src).filter(f => filterListOf(f).key === key).map(f => f.id);
  }
  // Built once PER BLOCK. The call site stays literally `buildFilterUI();` (filterprobe stubs
  // it by name) with the slot loop INSIDE, so the probe's slice is unaffected.
  function buildFilterUI() {
    for (let slot = 0; slot < STACK_MAX; slot++) buildFilterUIFor(slot);
    pointMaps(0);
  }
  function buildFilterUIFor(slot) {
    secs[slot] = {};
    const ctlHost = ctlIn(slot, "filterctl");
    // One caption over the per-effect chain. The Scene filters box's own title already says
    // what that list is, so only this one gets a heading — and it earns it twice over now:
    // it distinguishes per-layer from whole-scene, and it is where "top to bottom is the
    // order they run" is stated.
    const lay = ctlIn(slot, FILTER_LISTS[0].hostId);
    if (lay) {
      const g = filterGroup(FILTERS.find(f => f.stage === "feedback"));
      const h = document.createElement("div");
      h.className = "ctl-grp filter-grp";
      h.textContent = g.title;
      const d = document.createElement("div");
      d.className = "filter-grp-d";
      d.textContent = "runs top to bottom — drag ⠿ to reorder";
      h.appendChild(d);
      lay.appendChild(h);
    }
    FILTERS.forEach(f => {
      const L = filterListOf(f), dest = ctlIn(slot, L.hostId);
      if (!dest) return;
      const sec = document.createElement("details");
      sec.className = "filter-sec";
      sec.dataset.fid = f.id;
      const sum = document.createElement("summary");
      // Hidden value store — the picker dialog ticks it, syncFilterUI reads it.
      const cb = document.createElement("input");
      cb.type = "checkbox"; ctlReg(slot, "flt-" + f.id, cb);
      cb.style.display = "none";
      if (L.reorder) sum.appendChild(makeFilterGrab(f, sec, slot));
      const nm = document.createElement("span");
      nm.className = "filter-name"; nm.textContent = f.name;
      // Remove from the chain without opening the picker — the commonest edit by far.
      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "filter-rm"; rm.textContent = "✕";
      rm.title = "Remove " + f.name + " from this list";
      rm.setAttribute("aria-label", "Remove " + f.name);
      rm.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); setFilterOn(f.id, false); });
      sum.appendChild(cb); sum.appendChild(nm); sum.appendChild(rm);
      sum.title = f.help || f.name;
      sec.appendChild(sum);
      const body = document.createElement("div");
      body.className = "filter-body";
      // Adopt this filter's controls out of the flat #filterctl list.
      (f.params || []).forEach(k => { const n = ctlIn(slot, "ctl-" + k); if (n) body.appendChild(n); });
      sec.appendChild(body);
      // A GPU-only filter on the Canvas2D fallback: say so rather than leaving a row that
      // silently does nothing. (It stays in the list — see cpuBlocked: never removed.)
      if (f.cpuOk === false && !useGL) {
        cb.disabled = true;
        sec.classList.add("off");
        sum.title = f.name + " needs WebGL — unavailable on this device's fallback renderer.";
      }
      secs[slot][f.id] = sec;
      dest.appendChild(sec);
    });
    // "+ Add filter" per list, plus the caption that used to head the group.
    FILTER_LISTS.forEach(L => {
      const dest = ctlIn(slot, L.hostId);
      if (!dest) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "filter-add";
      ctlReg(slot, L.addId, b);
      b.textContent = "+ Add filter";
      b.title = "Choose which filters this list runs";
      b.addEventListener("click", () => openFilterPicker(L.key));
      dest.appendChild(b);
    });
    if (ctlHost) ctlHost.style.display = "none";   // now empty; keep the node for scans
  }
  // Put one list in order: the added sections first, in chain order, then the rest hidden,
  // then the Add button. Everything stays a child of the host — see the note above on why a
  // section must never leave the document.
  // A labelled hairline marking where one pipeline stage ends and the next begins. Made fresh
  // each render and stamped with the pass id, so the sweep at the end of renderFilterLists can
  // drop the ones left over from the previous layout.
  let renderPass = "0";
  function stageDivider() {
    const d = document.createElement("div");
    d.className = "filter-div";
    d.dataset.live = renderPass;
    d.textContent = "▲ shapes the heat   ·   the effect draws here   ·   ▼ repaints the picture";
    d.title = "Filters above this line run on the heat before the effect draws; filters below run on the finished picture. Drag one across to change which it does.";
    return d;
  }
  // Every block, each ordered by ITS OWN layer's chain. Reading `activeIds` for all of them
  // would render four copies of the selected layer's order, with the divider in the wrong
  // place — the kind of wrong that looks like the feature half-works.
  function renderFilterLists() {
    for (let slot = 0; slot < STACK_MAX; slot++) renderFilterListsFor(slot);
  }
  function renderFilterListsFor(slot) {
    renderPass = String(+renderPass + 1);
    const mySecs = secs[slot] || {};
    FILTER_LISTS.forEach(L => {
      const host = ctlIn(slot, L.hostId);
      if (!host) return;
      const ids = listIdsFor(slot, L.key), added = new Set(ids);
      const cap = host.querySelector(".filter-grp");
      if (cap) host.appendChild(cap);                       // caption stays on top
      // Rows go wherever you put them — the chain is a sequence, not two sorted groups. The
      // one line that still means something is where the EFFECT DRAWS: everything above it
      // reshapes the heat, everything below repaints the finished picture, and moving a row
      // across it genuinely changes what that filter does. splitChain puts that line straight
      // after the last feedback filter, so the marker is drawn there and nowhere else.
      const cut = splitChain(ids).heat.length;
      ids.forEach((id, i) => {
        const sec = mySecs[id];
        if (!sec) return;
        if (L.reorder && cut > 0 && i === cut) host.appendChild(stageDivider());
        sec.style.display = "";
        sec.classList.toggle("solo", ids.length < 2);
        host.appendChild(sec);
      });
      // Stale dividers from the previous render, now that the runs have moved.
      [...host.querySelectorAll(".filter-div")].forEach(d => { if (d.dataset.live !== renderPass) d.remove(); });
      FILTERS.forEach(f => {
        const sec = mySecs[f.id];
        if (!sec || added.has(f.id) || filterListOf(f).key !== L.key) return;
        sec.style.display = "none";
        sec.open = false;
        host.appendChild(sec);
      });
      const btn = ctlIn(slot, L.addId);
      if (btn) host.appendChild(btn);
      host.classList.toggle("empty", ids.length === 0);
    });
  }
  // The one way a filter goes on or off, wherever it is toggled from (the picker, a row's ✕,
  // or a programmatic load). Adding appends, so a new filter lands at the end of its stage.
  function setFilterOn(id, on) {
    const set = filterSetOf(id);
    if (on) set.add(id); else set.delete(id);
    const sec = filterSecs[id];
    if (sec && on) sec.open = true;        // reveal what you just added
    applyFilters();
    syncFilterPicker();
  }
  // Drag to reorder, modelled directly on the layer rows' handle (see syncStackUI) — same
  // gesture, same trick: the dragged section is TRANSFORMED and a marker shows where it will
  // land, and the actual reorder happens once, on release. Moving the section's DOM node
  // mid-drag would detach the handle holding the pointer capture, and Chromium drops capture
  // on reparent, which kills the drag after the first pixel.
  //
  // The handle also swallows the summary's click, or every drag would toggle the fold open.
  function makeFilterGrab(f, sec, slot) {
    const grab = document.createElement("span");
    grab.className = "filter-grab";
    grab.textContent = "⠿";
    grab.title = "Drag to reorder — filters run top to bottom";
    grab.setAttribute("aria-label", "Drag to reorder " + f.name);
    grab.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
    grab.addEventListener("pointerdown", e => {
      // The reorder below rewrites `activeIds`, which is the SELECTED layer's set — so a drag
      // that starts in another layer's list has to select it first, or it would silently
      // reorder the wrong chain. The row's own capture-phase handler is bypassed here because
      // the grab stops propagation (it must: a rebuild mid-drag drops the pointer capture).
      if (slot !== stackSel) selectStack(slot);
      const host = sec.parentNode;
      const rows = () => [...host.querySelectorAll(".filter-sec")].filter(s => s.style.display !== "none");
      if (rows().length < 2) return;
      e.preventDefault(); e.stopPropagation();
      grab.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      sec.classList.add("dragging");
      const marker = document.createElement("div");
      marker.className = "filter-drop";
      let to = rows().indexOf(sec);
      const onMove = ev => {
        sec.style.transform = "translateY(" + (ev.clientY - startY) + "px)";
        // Scan only the OTHER rows: their rects are stable, while the dragged one's rides
        // the pointer.
        const others = rows().filter(s => s !== sec);
        to = 0;
        for (const s of others) {
          const b = s.getBoundingClientRect();
          if (ev.clientY < b.top + b.height / 2) break;
          to++;
        }
        host.insertBefore(marker, others[to] || ctlIn(slot, filterListOf(f).addId) || null);
      };
      const onUp = () => {
        grab.releasePointerCapture(e.pointerId);
        grab.removeEventListener("pointermove", onMove);
        grab.removeEventListener("pointerup", onUp);
        grab.removeEventListener("pointercancel", onUp);
        marker.remove();
        sec.style.transform = "";
        sec.classList.remove("dragging");
        // Rebuild the set in the new order. A Set iterates in INSERTION order, so the way
        // to reorder one is to rebuild it — which is also why `activeIds` is re-assigned
        // rather than mutated in place.
        const key = filterListOf(f).key;
        const ids = listIds(key);
        const from = ids.indexOf(f.id);
        if (from < 0 || to === from) { renderFilterLists(); return; }
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        // Nothing is overruled any more: every position in the list is a position the
        // pipeline can actually run (see splitChain). The only thing worth saying is when a
        // move changed WHICH SIDE of the effect a filter is on, because that is a change of
        // meaning rather than of order.
        const wasHeat = splitChain(listIds(filterListOf(f).key)).heat.some(x => x.id === f.id);
        const nowHeat = splitChain(ids).heat.some(x => x.id === f.id);
        if (wasHeat !== nowHeat) flashStageMove(f, nowHeat);
        if (key === "scene") { sceneOn = new Set(ids); }
        else {
          // Keep any id the list does not own (scene ids never live here, but a stale one
          // from an old blob might) rather than dropping it on a reorder.
          const keep = [...activeIds].filter(id => !ids.includes(id));
          activeIds = new Set(ids.concat(keep));
        }
        applyFilters();          // re-render, re-derive the chains, persist
        autosavePreset();
      };
      grab.addEventListener("pointermove", onMove);
      grab.addEventListener("pointerup", onUp);
      grab.addEventListener("pointercancel", onUp);
    });
    return grab;
  }
  // A move that crossed the effect: say what the filter now does, since it is doing a
  // different job rather than the same job in a different order. A few seconds, then gone.
  let stageBlockT = 0;
  function flashStageMove(f, nowHeat) {
    const host = el(FILTER_LISTS[0].hostId);
    if (!host) return;
    let note = host.querySelector(".filter-note");
    if (!note) {
      note = document.createElement("div");
      note.className = "filter-note";
      const cap = host.querySelector(".filter-grp");
      if (cap) cap.appendChild(note); else host.prepend(note);
    }
    note.textContent = nowHeat
      ? f.name + " now shapes the heat, before the effect draws into it."
      : f.name + " now repaints the finished picture, after the effect has drawn.";
    note.classList.remove("on"); void note.offsetWidth; note.classList.add("on");
    clearTimeout(stageBlockT);
    stageBlockT = setTimeout(() => note.classList.remove("on"), 5200);
    const sec = filterSecs[f.id];
    if (sec) { sec.classList.remove("bump"); void sec.offsetWidth; sec.classList.add("bump"); }
  }
  // ---- "Add filter" picker ----------------------------------------------------------
  // A floating, translucent, non-modal panel like the palette editor and the Orbit editor,
  // hidden on m/Esc with the rest. It is the ONLY place the full catalogue is listed now,
  // which is the whole point: the menu shows your chain, this shows what you could add.
  let filterPickKey = "layer";
  function openFilterPicker(key) {
    const dlg = el("fltdlg");
    if (!dlg) return;
    filterPickKey = key;
    el("flt-title").textContent = key === "scene" ? "Scene filters" : "Filters for this layer";
    el("flt-hint").textContent = key === "scene"
      ? "Applied once to the finished, blended picture."
      : "Each layer runs its own. Heat & trails act on the fire before the effect draws; image filters act on the picture after — so the list keeps them in that order.";
    buildFilterPicker();
    dlg.classList.remove("hidden");
  }
  function closeFilterPicker() { const d = el("fltdlg"); if (d) d.classList.add("hidden"); }
  function filterPickerOpen() { const d = el("fltdlg"); return !!d && !d.classList.contains("hidden"); }
  function buildFilterPicker() {
    const host = el("flt-pick");
    if (!host) return;
    host.textContent = "";
    let stage = null;
    FILTERS.forEach(f => {
      if (filterListOf(f).key !== filterPickKey) return;
      // Sub-captions inside the picker only — the menu list itself is one flat chain.
      const s = f.stage === "feedback" ? "Heat & trails" : (isSceneFilter(f.id) ? "Whole scene" : "Image");
      if (s !== stage) {
        stage = s;
        const h = document.createElement("div");
        h.className = "flt-stage"; h.textContent = s;
        host.appendChild(h);
      }
      const lab = document.createElement("label");
      lab.className = "flt-opt";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = filterSetOf(f.id).has(f.id);
      cb.disabled = f.cpuOk === false && !useGL;
      cb.addEventListener("change", () => setFilterOn(f.id, cb.checked));
      const nm = document.createElement("span");
      nm.className = "flt-opt-n"; nm.textContent = f.name;
      lab.appendChild(cb); lab.appendChild(nm);
      if (f.help) {
        const d = document.createElement("span");
        d.className = "flt-opt-d"; d.textContent = f.help;
        lab.appendChild(d);
      }
      if (cb.disabled) lab.title = f.name + " needs WebGL — unavailable on this device's fallback renderer.";
      host.appendChild(lab);
    });
  }
  // Mirror the live sets onto the picker's ticks whenever they change underneath it (a row's
  // ✕, a scene load, an effect switch). Cheap enough to just rebuild.
  function syncFilterPicker() { if (filterPickerOpen()) buildFilterPicker(); }
  if (el("flt-close")) el("flt-close").addEventListener("click", closeFilterPicker);
  if (el("fltdlg")) el("fltdlg").addEventListener("click", e => { if (e.target === el("fltdlg")) closeFilterPicker(); });
  // Kept for the callers that only want the fold state refreshed.
  function syncFilterSec(id) { syncFilterSecIn(stackSel, id); }
  function syncFilterSecIn(slot, id) {
    const sec = (secs[slot] || {})[id], cb = ctlIn(slot, "flt-" + id);
    if (!sec || !cb) return;
    sec.classList.toggle("idle", !cb.checked);
    if (!cb.checked) sec.open = false;
  }
  // A control is visible when the current effect declares it OR it belongs to a
  // ticked filter — so filter params appear and vanish with their checkbox without
  // any effect needing to list them.
  function shownKeys() { return shownKeysFor(stackSel); }
  // What ONE slot's block shows: its own effect's params plus its own ticked filters'. For the
  // selected layer that is the live `effect` + activeFilters(); for any other it is read off
  // the record, so four open blocks each show their own controls instead of four copies of
  // whichever layer happens to be selected.
  function shownKeysFor(slot) {
    const L = stack[slot];
    const sel = slot === stackSel || !L;
    const shown = new Set(EFFECTS[sel ? effect : L.fx].params);
    const fs = sel ? activeFilters() : orderFilters(filtersOk(L.filters) || presetFilters(L.fx));
    for (const f of fs) for (const k of f.params) shown.add(k);
    shown.add("heatboost");           // a palette-box control that applies to every effect (like palcycle/palhold)
    return shown;
  }
  // The topmost VISIBLE group heading in #fxctl sits directly under the box title, where its
  // top border reads as a stray rule below the heading rather than as a separator between two
  // groups. CSS `:first-child` cannot express this: every group exists in the DOM (they are
  // all built once, from CONTROLS) and only some are shown, so the first *child* is whichever
  // group comes first in the schema — "Shape & motion" — while the first *visible* one depends
  // on the effect ("Cardioid seed" on AnimeJulia, "Plasma" on Plasma, …). Hence a class,
  // re-marked on every visibility pass.
  function markFirstGroup(slot) {
    const host = ctlIn(slot, "fxctl");
    if (!host) return;
    let seen = false;
    host.querySelectorAll(".ctl-grp").forEach(h => {
      const vis = h.style.display !== "none";
      h.classList.toggle("grp-first", vis && !seen);
      if (vis) seen = true;
    });
  }
  function refreshControlVisibility() {
    for (let slot = 0; slot < STACK_MAX; slot++) refreshBlockVisibility(slot);
    refreshBreakout();                // show/hide the pop-out boxes to match
  }
  // One block, against its own layer's effect and filters.
  function refreshBlockVisibility(slot) {
    const shown = shownKeysFor(slot);
    CONTROLS.forEach(c => {           // poppable sliders toggle their menu row; other controls toggle themselves
      const vis = shown.has(c.key) ? "" : "none";
      const row = ctlIn(slot, "row-" + c.key), box = ctlIn(slot, "ctl-" + c.key);
      if (row) row.style.display = vis;
      else if (box) box.style.display = vis;
      // A scene control has one row and one box, both outside every block; slot 0 owns them.
      else if (slot === 0 && rows[c.key]) rows[c.key].style.display = vis;
      else if (slot === 0 && el("ctl-" + c.key)) el("ctl-" + c.key).style.display = vis;
    });
    for (const g in CTL_GROUPS) {     // a heading shows only if something under it is shown
      const hdr = ctlIn(slot, "grp-" + g);
      if (hdr) hdr.style.display = CONTROLS.some(c => c.group === g && shown.has(c.key)) ? "" : "none";
    }
    markFirstGroup(slot);              // ...and the topmost visible one loses its divider
    refreshBlocked(slot, shown);      // grey any control another setting has neutralised
    refreshChanged(slot, shown);      // mark any slider moved off its shipped default
  }
  // Mark a slider's menu row (and its pop-out box) when its live value differs from the
  // current effect's SHIPPED default — a modified-from-default dot, so you can see at a
  // glance what you've customised. Reads the DOM thumbs (stable; the drift lives elsewhere),
  // so it must run on every edit too. Dual → compare [lo,hi]; plain → the single value.
  function refreshChanged(slot, shown) {
    if (slot === undefined) slot = stackSel;
    shown = shown || shownKeysFor(slot);
    const L = stack[slot];
    const def = presetState(slot === stackSel || !L ? effect : L.fx);
    const g = k => ctlIn(slot, k) || (slot === 0 ? el(k) : null);
    for (const c of CONTROLS) {
      const row = ctlIn(slot, "row-" + c.key) || (slot === 0 ? rows[c.key] : null);
      if (!row) continue;             // only poppable sliders carry a launcher row
      let changed = false;
      if (shown.has(c.key)) {
        const d = def[c.key];
        if (Array.isArray(d)) {
          const lo = g(c.key + "-lo"), hi = g(c.key + "-hi");
          if (lo && hi) changed = Math.abs(+lo.value - d[0]) > 1e-9 || Math.abs(+hi.value - d[1]) > 1e-9;
        } else if (d != null) {
          const e = g(c.key);
          if (e) changed = Math.abs(+e.value - d) > 1e-9;
        }
      }
      row.classList.toggle("ctl-changed", changed);
      const box = g("ctl-" + c.key);
      if (box) box.classList.toggle("ctl-changed", changed);
    }
  }
  // A control that does nothing while another slider sits at its neutral value (a dual
  // whose HIGH thumb is 0 — i.e. turned fully off, so the drift can never leave 0). Keyed
  // blocked-control → the blocker it depends on. Extend by adding an entry.
  const CTL_BLOCKED = { bandsize: "band", banddim: "band", nodspd: "nod" };
  function ctlHi(key) { return ctlHiIn(stackSel, key); }
  // A control is "off" when its dual's HIGH thumb is 0 — read off that block's own thumb, so a
  // blocked control is greyed per layer rather than from whichever one is selected.
  function ctlHiIn(slot, key) {
    const n = ctlIn(slot, key + "-hi") || ctlIn(slot, key) || el(key + "-hi") || el(key);
    return n ? +n.value : 1;
  }
  // Grey the blocked control's menu row + box, kill its +/- button, and stash the blocker
  // on the row so a click can flash it. Reads live thumb values, so it must run on edits too.
  function refreshBlocked(slot, shown) {
    if (slot === undefined) slot = stackSel;
    shown = shown || shownKeysFor(slot);
    for (const key in CTL_BLOCKED) {
      const by = CTL_BLOCKED[key];
      const blocked = shown.has(key) && ctlHiIn(slot, by) === 0;
      const row = ctlIn(slot, "row-" + key) || (slot === 0 ? rows[key] : null);
      const box = ctlIn(slot, "ctl-" + key) || (slot === 0 ? el("ctl-" + key) : null);
      if (row) {
        row.classList.toggle("ctl-blocked", blocked);
        row.dataset.blocker = blocked ? by : "";
        row.title = blocked ? "Does nothing while " + ctlLabel(by) + " is 0 — click to highlight it" : "";
      }
      if (box) box.classList.toggle("ctl-blocked", blocked);
    }
  }
  // Draw the eye to a control: open its section, scroll it into view, and pulse it once.
  function flashCtl(key) {
    const row = rows[key]; if (!row) return;
    const sec = row.closest("details"); if (sec) sec.open = true;
    row.scrollIntoView({ block: "nearest" });
    row.classList.remove("ctl-flash"); void row.offsetWidth; row.classList.add("ctl-flash");
    setTimeout(() => row.classList.remove("ctl-flash"), 1400);
  }
  // Every block's checkboxes, each from ITS OWN layer's set — the hidden #flt-<id> store is
  // per block, so writing only the selected one would leave the other three showing whatever
  // they were built with.
  function syncFilterUI() {
    for (let slot = 0; slot < STACK_MAX; slot++) {
      const own = new Set(listIdsFor(slot, "layer").concat(listIdsFor(slot, "scene")));
      FILTERS.forEach(f => {
        const cb = ctlIn(slot, "flt-" + f.id);
        if (cb) cb.checked = slot === stackSel ? filterSetOf(f.id).has(f.id) : own.has(f.id);
        syncFilterSecIn(slot, f.id);
      });
    }
    renderFilterLists();     // membership AND order both come from the sets, so re-render
    syncFilterPicker();
  }
  // Re-derive everything a filter change affects: which param groups are visible,
  // the bloom strength (off ⇒ 0), and the banked sim time (a fresh Fire shouldn't
  // burst catch-up ticks). Called on every tick/untick and after loading a scene.
  function applyFilters() {
    syncFilterUI();
    refreshControlVisibility();
    bloomAmt = filterOn("bloom") ? +el("bloom-lo").value : 0;   // the slider's apply respects this too
    acc = 0;
    // Only wipe when nothing carries heat over — Fade alone still retains it.
    if (!hasFeedback()) { if (fire) fire.fill(0); if (fireNext) fireNext.fill(0); }
    persist();
  }
  // Controls carrying a `group` are rendered under a shared subheading (Camera,
  // Banding), so the Settings box reads as sections rather than one long list.
  // setEffect shows a heading only while at least one of its controls is in the
  // current effect's params.
  const CTL_GROUPS = {
    shape: "Shape & motion", cardioid: "Cardioid seed", plasma: "Plasma", tunnel: "Tunnel",
    metaball: "Metaballs", kaleido: "Kaleidoscope", rotozoom: "Rotozoomer", munch: "Munching squares",
    moire: "Moiré", newton: "Newton", multibrot: "Multibrot", copper: "Copper bars",
    attractor: "Attractor", polygon: "Polygon", shapegrid: "Shape grid", concentric: "Concentric rings", bounce: "Bouncing shapes",
    solids: "Bouncing solids",
    camera: "Camera", other: "Other",
    f_fire: "Fire", f_fade: "Fade pixel", f_pixelate: "Pixelate", f_soften: "Blur / sharpen",
    f_edge: "Edge", f_poster: "Posterize", f_mirror: "Mirror", f_bloom: "Bloom",
    f_diffuse: "Diffuse", f_echo: "Echo", f_zoomfb: "Zoom feedback", f_swirl: "Swirl",
    f_twist: "Twist", f_wedge: "Wedge fold", f_glitch: "Slice glitch",
    f_halftone: "Halftone", f_thresh: "Solarize", f_chroma: "Chromatic aberration",
    f_barrel: "Barrel distortion", f_scanlines: "Scanlines", f_vignette: "Vignette", f_grain: "Film grain",
    palette: "Palette", banding: "Banding",
  };
  // Render the schema into ONE block, then index everything it made under `slot`. Group
  // headings carry data-k too: a heading belongs to the block it titles, and each block shows
  // the headings of ITS OWN effect.
  function buildControls(slot) {
    const root = blocks[slot];
    const q = k => root.querySelector('[data-k="' + k + '"]');
    const fxHost = q("fxctl"), bandHost = q("bandctl"), palHost = q("palctl"), filterHost = q("filterctl");
    // A SCENE control exists ONCE in the whole page and keeps its id — so it is generated in
    // slot 0 only. Generating it per block would put four elements carrying id="bloom-lo" in
    // the document, and getElementById would hand every one of its sites the first.
    // Filtered before the loop rather than skipped inside it, so a group whose members are
    // all scene controls never opens an empty heading in the other blocks.
    let open = null;
    CONTROLS.filter(c => slot === 0 || !isSceneCtl(c)).forEach(c => {
      const host = c.host === "band" ? bandHost : c.host === "pal" ? palHost
        : c.host === "filter" ? filterHost : fxHost;
      if (c.group !== open) {
        open = c.group;
        if (c.group) host.insertAdjacentHTML("beforeend",
          '<div class="ctl-grp" data-k="grp-' + c.group + '">' + CTL_GROUPS[c.group] + "</div>");
      }
      host.insertAdjacentHTML("beforeend", ctlHTML(c));
    });
    // Index every [data-k] the block now holds: the ones authored in the template (the four
    // hosts, the palette strip, Reset, Orbit) and the ones just generated. Registered by
    // REFERENCE, so a node keeps resolving after buildFilterUI adopts it into a filter body or
    // the POPPABLE pass exports it to #breakout.
    for (const n of root.querySelectorAll("[data-k]")) ctlReg(slot, n.dataset.k, n);
  }
  // One block per stack slot, cloned from the authored <template>. Each is built by the same
  // passes rather than copied from the finished first one: cloneNode copies nodes, not
  // listeners, so a clone of a wired block would look right and do nothing.
  const blockTpl = el("lyrblock");
  for (let slot = 0; slot < STACK_MAX; slot++) {
    blocks[slot] = blockTpl.content.firstElementChild.cloneNode(true);
    blocks[slot].dataset.slot = String(slot);
    buildControls(slot);
  }
  // All four go into the document now (the wiring passes below read them); syncStackUI moves
  // each into its layer's row on the first paint.
  for (const b of blocks) el("fxbox").appendChild(b);

  function bind(id, valId, fmt, onChange) {
    const input = el(id), out = el(valId);
    const update = () => { out.textContent = fmt(input.value); onChange(input.value); };
    input.addEventListener("input", update);
    update();
  }
  // (Points is a dual/ranged slider now — wired by the bindRange loop below, so it gets
  // L/M/H beat chips like the other ranged controls; `bind` is left for any future plain one.)

  // Layers: the −/+ buttons drive a hidden number input (so it rides the normal
  // per-effect state/persist/preset machinery); each layer adds a smaller,
  // fewer-point, differently-seeded copy of the fractal.
  const LAYER_MAX = CONFIG.layerMax;
  function applyLayers(v) { layerCount = Math.max(1, Math.min(LAYER_MAX, v | 0)); ctl("vLayers").textContent = layerCount; }
  function stepLayers(d) {
    const v = Math.max(1, Math.min(LAYER_MAX, (+ctl("layers").value | 0) + d));
    ctl("layers").value = v;
    ctl("layers").dispatchEvent(new Event("input", { bubbles: true }));   // updates + persists via onEdit
  }
  // Wired per block. The handlers read back through ctl(), i.e. the SELECTED layer's nodes,
  // which is right because touching a block selects it first.
  for (let slot = 0; slot < STACK_MAX; slot++) {
    ctlIn(slot, "layers").addEventListener("input", () => applyLayers(+ctl("layers").value));
    ctlIn(slot, "layer-plus").addEventListener("click", () => stepLayers(1));
    ctlIn(slot, "layer-minus").addEventListener("click", () => stepLayers(-1));
  }

  // Ranged (dual-thumb) sliders: the two thumbs set a [lo,hi] band and the live
  // value wanders erratically inside it — a random target reached over a random
  // duration, eased, repeating. Collapse the thumbs (lo==hi) to pin a constant
  // value, so a ranged slider still works as an ordinary one.
  // Every accumulated phase clock in the app, as name + getter + setter. These are
  // `let` bindings scattered through the effect sections, so a generic loop cannot
  // reach them by name — hence the table. It is the authoritative list: ADD A LINE
  // HERE when you add an effect that accumulates a clock, or two stack items running
  // that effect will share one clock and render as a single slightly brighter copy.
  // That failure has no error and no probe; it is the most easily missed thing in the
  // whole stack feature.
  // (Deliberately a table rather than renaming all sixteen into one `phase` object:
  // juliaprobe slices the real juliaOuter/juliaInner source out of this file by marker,
  // and a rename would break that slice for no gain.)
  const PHASE_VARS = [
    ["simT", () => simT, v => simT = v],
    ["spinAngle", () => spinAngle, v => spinAngle = v],
    ["nodPhase", () => nodPhase, v => nodPhase = v],
    ["juliaOuter", () => juliaOuter, v => juliaOuter = v],
    ["juliaInner", () => juliaInner, v => juliaInner = v],
    ["plasmaTime", () => plasmaTime, v => plasmaTime = v],
    ["tunTime", () => tunTime, v => tunTime = v],
    ["tunTwistPhase", () => tunTwistPhase, v => tunTwistPhase = v],
    ["mbTime", () => mbTime, v => mbTime = v],
    ["kRotPhase", () => kRotPhase, v => kRotPhase = v],
    ["kNoiseTime", () => kNoiseTime, v => kNoiseTime = v],
    ["rzAngle", () => rzAngle, v => rzAngle = v],
    ["rzTime", () => rzTime, v => rzTime = v],
    ["xorTime", () => xorTime, v => xorTime = v],
    ["moTime", () => moTime, v => moTime = v],
    ["nwPhase", () => nwPhase, v => nwPhase = v],
    ["cbTime", () => cbTime, v => cbTime = v],
    ["pgSpin", () => pgSpin, v => pgSpin = v],
    ["sgTime", () => sgTime, v => sgTime = v],
    ["coTime", () => coTime, v => coTime = v],
    ["coSpin", () => coSpin, v => coSpin = v],
    ["bnTime", () => bnTime, v => bnTime = v],
  ];
  const phaseSnapshot = () => { const o = {}; for (const p of PHASE_VARS) o[p[0]] = p[1](); return o; };
  // Taken once, here, while every clock still holds its declared starting value — a new
  // stack item starts from these rather than from whatever the previously drawn item
  // left in the globals.
  const PHASE_INIT = phaseSnapshot();
  function installPhase(L) { for (const p of PHASE_VARS) if (p[0] in L.phase) p[2](L.phase[p[0]]); }
  function capturePhase(L) { for (const p of PHASE_VARS) L.phase[p[0]] = p[1](); }

