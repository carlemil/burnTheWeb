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
    { key: "points", host: "fx", group: "shape", type: "plain", label: "Points", valId: "vPoints", min: 100, max: 8000, step: 50, value: 2500 },
    { key: "layers", host: "fx", group: "shape", type: "layers", label: "Layers", valId: "vLayers" },
    { key: "speed", host: "fx", group: "shape", type: "dual", label: "Drift speed", valId: "vSpeed", min: 1, max: 300, step: 1, lo: 92, hi: 92, fmt: v => sig3(v), apply: v => cfg.speed = v / 100 },

    { key: "size", host: "fx", group: "shape", type: "dual", label: "Size", valId: "vSize", min: 0.3, max: 5, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => fractalSize = v, durScale: 10 },
    { key: "rot", host: "fx", group: "shape", type: "dual", label: "Rotation", valId: "vRot", min: -180, max: 180, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "°/s", apply: v => rotSpeed = v * Math.PI / 180, durScale: 10 },
    { key: "nod", host: "fx", group: "shape", type: "dual", label: "Box nod", valId: "vNod", min: 0, max: 90, step: 0.1, lo: 17.2, hi: 17.2, fmt: v => sig3(v) + "°", apply: v => nodAmp = v * Math.PI / 180, durScale: 10 },
    { key: "nodspd", host: "fx", group: "shape", type: "dual", label: "Nod speed", valId: "vNodSpd", min: 0, max: 4, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => nodSpd = v, durScale: 10 },
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
    { key: "cocount", host: "fx", group: "concentric", type: "dual", label: "Ring count", valId: "vCoCount", min: 1, max: 20, step: 0.5, lo: 6, hi: 6, fmt: v => sig3(v), apply: v => coCount = v, durScale: 10 },
    { key: "cothick", host: "fx", group: "concentric", type: "dual", label: "Thickness", valId: "vCoThick", min: 0.02, max: 0.98, step: 0.02, lo: 0.4, hi: 0.4, fmt: v => sig3(v), apply: v => coThick = v, durScale: 10 },
    { key: "cospeed", host: "fx", group: "concentric", type: "dual", label: "March speed", valId: "vCoSpeed", min: -3, max: 3, step: 0.05, lo: 0.6, hi: 0.6, fmt: v => sig3(v) + "×", apply: v => coSpeed = v, durScale: 10 },
    { key: "cospin", host: "fx", group: "concentric", type: "dual", label: "Spin", valId: "vCoSpin", min: -2, max: 2, step: 0.05, lo: 0.1, hi: 0.1, fmt: v => sig3(v) + "×", apply: v => coSpinSpeed = v, durScale: 10 },
    // Bouncing shapes
    { key: "bncount", host: "fx", group: "bounce", type: "dual", label: "Count", valId: "vBnCount", min: 1, max: 8, step: 1, lo: 4, hi: 4, fmt: v => sig3(v), apply: v => bnCount = Math.round(v), durScale: 10 },
    { key: "bnrad", host: "fx", group: "bounce", type: "dual", label: "Size", valId: "vBnRad", min: 0.02, max: 0.25, step: 0.005, lo: 0.09, hi: 0.09, fmt: v => sig3(v), apply: v => bnRad = v, durScale: 10 },
    { key: "bnsquare", host: "fx", group: "bounce", type: "dual", label: "Squareness", valId: "vBnSquare", min: 0, max: 1, step: 0.02, lo: 0.6, hi: 0.6, fmt: v => sig3(v), apply: v => bnSquare = v, durScale: 10 },
    { key: "bnspeed", host: "fx", group: "bounce", type: "dual", label: "Speed", valId: "vBnSpeed", min: 0, max: 4, step: 0.05, lo: 1, hi: 1, fmt: v => sig3(v) + "×", apply: v => bnSpeed = v, durScale: 10 },
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
    // ---- filter parameters. Contiguous, one group per filter, host "filter" so
    // they render in the Filters box; shown only while their filter is ticked. ----
    { key: "rise", host: "filter", group: "f_fire", type: "dual", label: "Flame rise", valId: "vRise", min: 3, max: 200, step: 1, lo: 130, hi: 130, fmt: v => sig3(v), apply: v => cfg.decay = 128 * v / (v - 1) },
    { key: "burn", host: "filter", group: "f_fire", type: "dual", label: "Burn rate", valId: "vBurn", min: 20, max: 240, step: 1, lo: 120, hi: 120, fmt: v => sig3(v) + "/s", apply: v => cfg.burn = Math.max(1, v), durScale: 10 },
    { key: "fade", host: "filter", group: "f_fade", type: "dual", label: "Keep", valId: "vFade", min: 0.5, max: 0.995, step: 0.001, lo: 0.94, hi: 0.94, fmt: v => sig3(v * 100) + "%", apply: v => fadeKeep = v, durScale: 10 },
    { key: "diffuse", host: "filter", group: "f_diffuse", type: "dual", label: "Spread", valId: "vDiffuse", min: 0.5, max: 6, step: 0.1, lo: 1, hi: 1, fmt: v => sig3(v) + "px", apply: v => diffRad = v, durScale: 10 },
    { key: "diffkeep", host: "filter", group: "f_diffuse", type: "dual", label: "Keep", valId: "vDiffKeep", min: 0.5, max: 1, step: 0.001, lo: 0.97, hi: 0.97, fmt: v => sig3(v * 100) + "%", apply: v => diffKeep = v, durScale: 10 },
    { key: "echo", host: "filter", group: "f_echo", type: "dual", label: "Distance", valId: "vEcho", min: 0, max: 8, step: 0.1, lo: 2, hi: 2, fmt: v => sig3(v) + "px", apply: v => echoDist = v, durScale: 10 },
    { key: "echoang", host: "filter", group: "f_echo", type: "dual", label: "Angle", valId: "vEchoAng", min: 0, max: 360, step: 1, lo: 90, hi: 90, fmt: v => sig3(v) + "°", apply: v => echoAng = v, durScale: 10 },
    { key: "echokeep", host: "filter", group: "f_echo", type: "dual", label: "Keep", valId: "vEchoKeep", min: 0.5, max: 0.995, step: 0.001, lo: 0.94, hi: 0.94, fmt: v => sig3(v * 100) + "%", apply: v => echoKeep = v, durScale: 10 },
    { key: "zfb", host: "filter", group: "f_zoomfb", type: "dual", label: "Scale", valId: "vZfb", min: 0.9, max: 1.1, step: 0.001, lo: 1.02, hi: 1.02, fmt: v => sig3(v) + "×", apply: v => zfbScale = v, durScale: 10 },
    { key: "zfbkeep", host: "filter", group: "f_zoomfb", type: "dual", label: "Keep", valId: "vZfbKeep", min: 0.5, max: 0.995, step: 0.001, lo: 0.94, hi: 0.94, fmt: v => sig3(v * 100) + "%", apply: v => zfbKeep = v, durScale: 10 },
    { key: "swirl", host: "filter", group: "f_swirl", type: "dual", label: "Spin", valId: "vSwirl", min: -15, max: 15, step: 0.1, lo: 2, hi: 2, fmt: v => sig3(v) + "°", apply: v => swirlSpin = v, durScale: 10 },
    { key: "swirlkeep", host: "filter", group: "f_swirl", type: "dual", label: "Keep", valId: "vSwirlKeep", min: 0.5, max: 0.995, step: 0.001, lo: 0.94, hi: 0.94, fmt: v => sig3(v * 100) + "%", apply: v => swirlKeep = v, durScale: 10 },
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
    { key: "scancount", host: "filter", group: "f_scanlines", type: "dual", label: "Lines", valId: "vScanCount", min: 60, max: 800, step: 10, lo: 240, hi: 240, fmt: v => sig3(v), apply: v => scanCount = v, durScale: 10 },
    { key: "vignette", host: "filter", group: "f_vignette", type: "dual", label: "Amount", valId: "vVignette", min: 0, max: 1, step: 0.01, lo: 0.4, hi: 0.4, fmt: v => sig3(v), apply: v => vigAmt = v, durScale: 10 },
    { key: "grain", host: "filter", group: "f_grain", type: "dual", label: "Amount", valId: "vGrain", min: 0, max: 0.5, step: 0.005, lo: 0.08, hi: 0.08, fmt: v => sig3(v), apply: v => grainAmt = v, durScale: 10 },
    { key: "band", host: "band", group: "banding", type: "dual", label: "Banding", valId: "vBand", min: 0, max: 100, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "%", apply: v => bandLevel = v / 100 },
    { key: "bandsize", host: "band", group: "banding", type: "dual", label: "Band size", valId: "vBandSize", min: 1, max: 9, step: 1, lo: 1, hi: 1, fmt: v => sig3(v), apply: v => bandGroup = Math.round(v) },
    { key: "banddim", host: "band", group: "banding", type: "dual", label: "Darkness", valId: "vBandDim", min: 0, max: 100, step: 1, lo: 0, hi: 0, fmt: v => sig3(v) + "%", apply: v => bandDim = 1 - v / 100 },
  ];
  function ctlHTML(c) {
    const open = '<div class="ctl" id="ctl-' + c.key + '">';
    if (c.type === "check")
      return open + '<label class="check"><input type="checkbox" id="' + c.key + '" checked> ' + c.label + "</label></div>";
    if (c.type === "layers")
      return open + '<label>Layers <span class="val" id="vLayers"></span></label>' +
        '<div class="presetrow"><button id="layer-minus" class="audbtn" type="button" title="Remove the smallest copy" aria-label="Fewer layers">−</button>' +
        '<button id="layer-plus" class="audbtn" type="button" title="Add a smaller copy — half size, half points, new seed" aria-label="More layers">+</button></div>' +
        '<input type="number" id="layers" min="1" max="6" step="1" value="1" style="display:none"></div>';
    const lbl = "<label>" + c.label + ' <span class="val" id="' + c.valId + '"></span></label>';
    if (c.type === "plain")
      return open + lbl + '<input id="' + c.key + '" type="range" min="' + c.min + '" max="' + c.max + '" step="any" value="' + c.value + '"></div>';
    // step="any": sliders are continuous. A quantised step made the readout lie
    // (a 0.001-step control formatted to 2dp looked like it jumped 0.01 -> 0.02),
    // and every value is shown to 3 significant digits by sig3() instead.
    const inp = t => '<input type="range" id="' + c.key + "-" + t + '" min="' + c.min + '" max="' + c.max + '" step="any" value="' + (t === "lo" ? c.lo : c.hi) + '">';
    return open + lbl + '<div class="dual"><div class="track"></div><div class="fill"></div>' + inp("lo") + inp("hi") + "</div></div>";
  }
  // The Filters checkbox list. Ticking one reveals its parameter group (see the
  // dynamic `shown` set in setEffect) and re-derives the live chain. Built once —
  // the list is the same for every effect, only the ticks differ.
  // Subheadings that say not just what each group of filters does, but WHERE it acts —
  // the one thing that matters now that filters are per-layer. Feedback and post filters
  // run on EACH stacked effect on its own (with that effect's own values), so the group
  // is titled "Per-effect"; Bloom (the glow) and the screen filters act once on the
  // finished, blended image, so they read "Whole scene". Grouping is by this behaviour,
  // not raw stage — Bloom is a "post" filter internally but belongs with the whole-scene
  // set, and it sits last among the post filters (so it falls into that group in order).
  function filterGroup(f) {
    if (f.stage === "feedback") return { key: "fb", title: "Per-effect · heat & trails", desc: "each layer keeps its own fire, fade and warp" };
    if (f.stage === "post" && f.id !== "bloom") return { key: "post", title: "Per-effect · image", desc: "each layer is filtered on its own, before they blend" };
    return { key: "scene", title: "Whole scene · final image", desc: "applied once to the finished, blended picture" };
  }
  // One <details> per filter: chevron + tick + name in the summary, that filter's own
  // params in the body. Must run BEFORE the POPPABLE pass, which inserts each slider's
  // .ctl-row launcher next to its .ctl — moving the .ctl into a body afterwards would
  // strand the row in #filterctl.
  const filterSecs = {};
  function buildFilterUI() {
    const host = el("filterlist"), ctlHost = el("filterctl");
    const screenHost = el("screenfilterlist");   // whole-scene filters get their own box
    let openKey = null;
    FILTERS.forEach(f => {
      const g = filterGroup(f);
      // The "Whole scene · final image" group lives in the Scene filters box; the
      // per-effect groups stay in the Effects & Filters box. The box title already says
      // "Scene filters", so the scene group needs no in-box caption of its own.
      const dest = g.key === "scene" ? screenHost : host;
      if (g.key !== openKey) {
        openKey = g.key;
        if (g.key !== "scene") {
          const h = document.createElement("div");
          h.className = "ctl-grp filter-grp";
          h.textContent = g.title;
          const d = document.createElement("div");
          d.className = "filter-grp-d"; d.textContent = g.desc;
          h.appendChild(d);
          dest.appendChild(h);
        }
      }
      const sec = document.createElement("details");
      sec.className = "filter-sec";
      const sum = document.createElement("summary");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.id = "flt-" + f.id;
      // The tick sits inside the summary, so its click must not also fold the section.
      cb.addEventListener("click", e => e.stopPropagation());
      cb.addEventListener("change", () => {
        const set = isSceneFilter(f.id) ? sceneOn : activeIds;   // scene filters toggle the scene-global set
        if (cb.checked) set.add(f.id); else set.delete(f.id);
        syncFilterSec(f.id);
        if (cb.checked && !sec.open) sec.open = true;   // reveal what you just enabled
        applyFilters();
      });
      const nm = document.createElement("span");
      nm.className = "filter-name"; nm.textContent = f.name;
      sum.appendChild(cb); sum.appendChild(nm);
      sum.title = f.help || f.name;
      sec.appendChild(sum);
      const body = document.createElement("div");
      body.className = "filter-body";
      // Adopt this filter's controls out of the flat #filterctl list.
      (f.params || []).forEach(k => { const n = el("ctl-" + k); if (n) body.appendChild(n); });
      sec.appendChild(body);
      // A GPU-only filter on the Canvas2D fallback: disable it visibly rather than
      // leaving a checkbox that silently does nothing.
      if (f.cpuOk === false && !useGL) {
        cb.disabled = true;
        sec.classList.add("off");
        sum.title = f.name + " needs WebGL — unavailable on this device's fallback renderer.";
      }
      filterSecs[f.id] = sec;
      dest.appendChild(sec);
    });
    if (ctlHost) ctlHost.style.display = "none";   // now empty; keep the node for scans
  }
  // Unticked ⇒ the body has nothing in it worth opening, so fold it and say so.
  function syncFilterSec(id) {
    const sec = filterSecs[id], cb = el("flt-" + id);
    if (!sec || !cb) return;
    sec.classList.toggle("idle", !cb.checked);
    if (!cb.checked) sec.open = false;
  }
  // A control is visible when the current effect declares it OR it belongs to a
  // ticked filter — so filter params appear and vanish with their checkbox without
  // any effect needing to list them.
  function shownKeys() {
    const shown = new Set(EFFECTS[effect].params);
    for (const f of activeFilters()) for (const k of f.params) shown.add(k);
    return shown;
  }
  function refreshControlVisibility() {
    const shown = shownKeys();
    CONTROLS.forEach(c => {           // poppable sliders toggle their menu row; other controls toggle themselves
      const vis = shown.has(c.key) ? "" : "none";
      if (rows[c.key]) rows[c.key].style.display = vis;
      else el("ctl-" + c.key).style.display = vis;
    });
    for (const g in CTL_GROUPS) {     // a heading shows only if something under it is shown
      const hdr = el("grp-" + g);
      if (hdr) hdr.style.display = CONTROLS.some(c => c.group === g && shown.has(c.key)) ? "" : "none";
    }
    refreshBreakout();                // show/hide the pop-out boxes to match
    refreshBlocked(shown);            // grey any control another setting has neutralised
    refreshChanged(shown);            // mark any slider moved off its shipped default
  }
  // Mark a slider's menu row (and its pop-out box) when its live value differs from the
  // current effect's SHIPPED default — a modified-from-default dot, so you can see at a
  // glance what you've customised. Reads the DOM thumbs (stable; the drift lives elsewhere),
  // so it must run on every edit too. Dual → compare [lo,hi]; plain → the single value.
  function refreshChanged(shown) {
    shown = shown || shownKeys();
    const def = presetState(effect);
    for (const c of CONTROLS) {
      const row = rows[c.key];
      if (!row) continue;             // only poppable sliders carry a launcher row
      let changed = false;
      if (shown.has(c.key)) {
        const d = def[c.key];
        if (Array.isArray(d)) {
          const lo = el(c.key + "-lo"), hi = el(c.key + "-hi");
          if (lo && hi) changed = Math.abs(+lo.value - d[0]) > 1e-9 || Math.abs(+hi.value - d[1]) > 1e-9;
        } else if (d != null) {
          const e = el(c.key);
          if (e) changed = Math.abs(+e.value - d) > 1e-9;
        }
      }
      row.classList.toggle("ctl-changed", changed);
      const box = el("ctl-" + c.key);
      if (box) box.classList.toggle("ctl-changed", changed);
    }
  }
  // A control that does nothing while another slider sits at its neutral value (a dual
  // whose HIGH thumb is 0 — i.e. turned fully off, so the drift can never leave 0). Keyed
  // blocked-control → the blocker it depends on. Extend by adding an entry.
  const CTL_BLOCKED = { bandsize: "band", banddim: "band", nodspd: "nod" };
  function ctlHi(key) { const a = anims[key]; return a ? (a.hi ? +a.hi.value : +a.lo.value) : 1; }
  // Grey the blocked control's menu row + box, kill its +/- button, and stash the blocker
  // on the row so a click can flash it. Reads live thumb values, so it must run on edits too.
  function refreshBlocked(shown) {
    shown = shown || shownKeys();
    for (const key in CTL_BLOCKED) {
      const by = CTL_BLOCKED[key];
      const blocked = shown.has(key) && ctlHi(by) === 0;
      const row = rows[key], box = el("ctl-" + key);
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
  function syncFilterUI() {
    FILTERS.forEach(f => { const cb = el("flt-" + f.id); if (cb) cb.checked = (isSceneFilter(f.id) ? sceneOn : activeIds).has(f.id); syncFilterSec(f.id); });
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
    camera: "Camera", other: "Other",
    f_fire: "Fire", f_fade: "Fade pixel", f_pixelate: "Pixelate", f_soften: "Blur / sharpen",
    f_edge: "Edge", f_poster: "Posterize", f_mirror: "Mirror", f_bloom: "Bloom",
    f_diffuse: "Diffuse", f_echo: "Echo", f_zoomfb: "Zoom feedback", f_swirl: "Swirl",
    f_twist: "Twist", f_wedge: "Wedge fold", f_glitch: "Slice glitch",
    f_halftone: "Halftone", f_thresh: "Solarize", f_chroma: "Chromatic aberration",
    f_barrel: "Barrel distortion", f_scanlines: "Scanlines", f_vignette: "Vignette", f_grain: "Film grain",
    palette: "Palette", banding: "Banding",
  };
  function buildControls() {
    const fxHost = el("fxctl"), bandHost = el("bandctl"), palHost = el("palctl"), filterHost = el("filterctl");
    let open = null;
    CONTROLS.forEach(c => {
      const host = c.host === "band" ? bandHost : c.host === "pal" ? palHost
        : c.host === "filter" ? filterHost : fxHost;
      if (c.group !== open) {
        open = c.group;
        if (c.group) host.insertAdjacentHTML("beforeend",
          '<div class="ctl-grp" id="grp-' + c.group + '">' + CTL_GROUPS[c.group] + "</div>");
      }
      host.insertAdjacentHTML("beforeend", ctlHTML(c));
    });
  }
  buildControls();   // render the control DOM before the bind() / bindRange() wiring below reads it

  function bind(id, valId, fmt, onChange) {
    const input = el(id), out = el(valId);
    const update = () => { out.textContent = fmt(input.value); onChange(input.value); };
    input.addEventListener("input", update);
    update();
  }
  bind("points", "vPoints", v => sig3(v), v => cfg.points = +v);

  // Layers: the −/+ buttons drive a hidden number input (so it rides the normal
  // per-effect state/persist/preset machinery); each layer adds a smaller,
  // fewer-point, differently-seeded copy of the fractal.
  const LAYER_MAX = CONFIG.layerMax;
  function applyLayers(v) { layerCount = Math.max(1, Math.min(LAYER_MAX, v | 0)); el("vLayers").textContent = layerCount; }
  el("layers").addEventListener("input", () => applyLayers(+el("layers").value));
  function stepLayers(d) {
    const v = Math.max(1, Math.min(LAYER_MAX, (+el("layers").value | 0) + d));
    el("layers").value = v;
    el("layers").dispatchEvent(new Event("input", { bubbles: true }));   // updates + persists via onEdit
  }
  el("layer-plus").addEventListener("click", () => stepLayers(1));
  el("layer-minus").addEventListener("click", () => stepLayers(-1));

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

