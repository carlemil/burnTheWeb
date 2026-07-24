  // ---- FILTERS: stackable post-FX applied after the effect renders ------------
  // The fire simulation used to be hardwired to the three point effects; it is now
  // one entry here, so any effect can have it. Three stages, split by where in the
  // pipeline the filter writes — and they must be listed in that order (filterprobe):
  //   feedback — mutates heat that survives to the next frame (Fire, Fade, Diffuse,
  //              Echo, Zoom feedback, Swirl). Runs inside glBeginHeat, before the
  //              effect's output is MAX-injected. Each carries its own Keep: a pure
  //              displacement conserves heat, so a warp with nothing decaying it
  //              saturates to white on its own.
  //   post     — reads the palette-mapped image; Bloom is the existing glow composite,
  //              now with its strength under a filter, and closes this stage.
  //   screen   — runs AFTER that composite, at display resolution (glRender step F).
  //              A vignette under an additive glow just gets lit back up, and a
  //              scanline count means nothing against the fire grid — hence a stage
  //              of its own rather than four more post filters.
  // Order here is the order they apply — a checkbox list can't be reordered, so this
  // is a design decision, not an implementation detail.
  // `params` are CONTROLS keys shown only while the filter is ticked; `defaults`
  // seed every effect's state (see presetState) so any effect can use any filter
  // without editing all 19 descriptors. `cpu: false` marks a filter the Canvas2D
  // fallback can't do — the UI greys those out rather than lying.
  const FILTERS = [
    { id: "fire",  name: "Fire",  stage: "feedback", params: ["rise", "burn"],
      help: "Heat rises and cools, the classic fire sim — now available to every effect, not just the point ones.",
      defaults: { rise: [130, 130], burn: [120, 120] },
      glFeedback: src => {
        gl.useProgram(glProg.prop.p);
        bindTexUnit(0, src);
        gl.uniform1i(glProg.prop.u.uHeat, 0);
        gl.uniform2f(glProg.prop.u.uSize, fw, fh);
        gl.uniform1f(glProg.prop.u.uDecay, cfg.decay);
        drawQuad();
      } },
    { id: "fade",  name: "Fade pixel", stage: "feedback", params: ["fade"],
      help: "Each pixel keeps a fraction of its heat every tick — phosphor trails.",
      defaults: { fade: [0.94, 0.94] },
      glFeedback: src => {
        const P = glProg.fade;
        gl.useProgram(P.p);
        bindTexUnit(0, src); gl.uniform1i(P.u.uHeat, 0);
        gl.uniform1f(P.u.uKeep, fadeKeep);
        drawQuad();
      },
      cpuFeedback: () => { for (let i = 0; i < fire.length; i++) fire[i] = fire[i] * fadeKeep; } },
    { id: "diffuse", name: "Diffuse", stage: "feedback", params: ["diffuse", "diffkeep"],
      help: "Heat bleeds sideways as well as up — Fire's flames turn to smoke.",
      defaults: { diffuse: [1, 1], diffkeep: [0.97, 0.97] },
      glFeedback: src => {
        const P = glProg.diffuse;
        gl.useProgram(P.p);
        bindTexUnit(0, src); gl.uniform1i(P.u.uHeat, 0);
        gl.uniform2f(P.u.uSize, fw, fh);
        gl.uniform1f(P.u.uRadius, diffRad);
        gl.uniform1f(P.u.uKeep, diffKeep);
        drawQuad();
      },
      cpuFeedback: () => heatDiffuseCPU(diffRad, diffKeep) },
    { id: "echo", name: "Echo", stage: "feedback", params: ["echo", "echoang", "echokeep"],
      help: "Trails drag in a direction instead of just dimming in place.",
      defaults: { echo: [2, 2], echoang: [90, 90], echokeep: [0.94, 0.94] },
      glFeedback: src => glWarpFeedback(src, echoDist, echoAng, 1, 0, echoKeep),
      cpuFeedback: () => heatWarpCPU(echoDist, echoAng, 1, 0, echoKeep) },
    { id: "zoomfb", name: "Zoom feedback", stage: "feedback", params: ["zfb", "zfbkeep"],
      help: "The retained heat is rescaled about the centre every tick — over 1 it rushes outward into an endless tunnel, under 1 it falls inward.",
      defaults: { zfb: [1.02, 1.02], zfbkeep: [0.94, 0.94] },
      glFeedback: src => glWarpFeedback(src, 0, 0, zfbScale, 0, zfbKeep),
      cpuFeedback: () => heatWarpCPU(0, 0, zfbScale, 0, zfbKeep) },
    { id: "swirl", name: "Swirl", stage: "feedback", params: ["swirl", "swirlkeep"],
      help: "The retained heat is rotated about the centre every tick, so trails spiral. Stack it with Zoom feedback for a vortex.",
      defaults: { swirl: [2, 2], swirlkeep: [0.94, 0.94] },
      glFeedback: src => glWarpFeedback(src, 0, 0, 1, swirlSpin, swirlKeep),
      cpuFeedback: () => heatWarpCPU(0, 0, 1, swirlSpin, swirlKeep) },
    { id: "twist", cpuOk: false, name: "Twist", stage: "post", params: ["twist"],
      help: "Spin the middle of the image and leave the rim — straight structure curls into the centre.",
      defaults: { twist: [1.2, 1.2] },
      gl: src => postPass("twist", src, u => gl.uniform1f(u.uAmount, twistAmt)) },
    { id: "wedge", cpuOk: false, name: "Wedge fold", stage: "post", params: ["wedgeseg", "wedgerot"],
      help: "Fold the image into N mirrored wedges — Mirror's X/Y fold generalised to a kaleidoscope, for any effect.",
      defaults: { wedgeseg: [6, 6], wedgerot: [0, 0] },
      gl: src => postPass("wedge", src, u => { gl.uniform1f(u.uSeg, wedgeSeg); gl.uniform1f(u.uRot, wedgeRot * Math.PI / 180); }) },
    { id: "glitch", cpuOk: false, name: "Slice glitch", stage: "post", params: ["glitch", "glitchrows"],
      help: "Tear horizontal slices sideways at random. Arm the amount to a beat and it rips on the hit.",
      defaults: { glitch: [0.05, 0.05], glitchrows: [8, 8] },
      gl: src => postPass("glitch", src, u => {
        gl.uniform1f(u.uAmount, glitchAmt); gl.uniform1f(u.uRows, glitchRows); gl.uniform1f(u.uTime, postTime);
      }) },
    { id: "pixelate", cpuOk: false, name: "Pixelate", stage: "post", params: ["pixel"],
      help: "Snap the image to a coarse grid of blocks.",
      defaults: { pixel: [6, 6] },
      gl: src => postPass("pixelate", src, u => gl.uniform1f(u.uBlock, pixelBlock)) },
    { id: "soften", cpuOk: false, name: "Blur / sharpen", stage: "post", params: ["soften", "softrad"],
      help: "One knob: negative blurs, positive sharpens (unsharp mask).",
      defaults: { soften: [-0.6, -0.6], softrad: [1.5, 1.5] },
      gl: src => postPass("soften", src, u => { gl.uniform1f(u.uRadius, softenRad); gl.uniform1f(u.uAmount, softenAmt); }) },
    { id: "edge", cpuOk: false, name: "Edge", stage: "post", params: ["edge"],
      help: "Sobel outline — traces the shapes instead of filling them.",
      defaults: { edge: [0.7, 0.7] },
      gl: src => postPass("edge", src, u => gl.uniform1f(u.uAmount, edgeAmt)) },
    { id: "poster", cpuOk: false, name: "Posterize", stage: "post", params: ["poster"],
      help: "Quantise the colours into flat bands.",
      defaults: { poster: [5, 5] },
      gl: src => postPass("posterize", src, u => gl.uniform1f(u.uLevels, posterLevels)) },
    { id: "halftone", cpuOk: false, name: "Halftone", stage: "post", params: ["halfdot", "halfamt"],
      help: "A rotated dot screen whose dots grow with brightness — the print look. Posterize flattens the ramp; this one spends texture on it.",
      defaults: { halfdot: [4, 4], halfamt: [0.8, 0.8] },
      gl: src => postPass("halftone", src, u => { gl.uniform1f(u.uDot, halfDot); gl.uniform1f(u.uAmount, halfAmt); }) },
    { id: "thresh", cpuOk: false, name: "Solarize", stage: "post", params: ["threshlvl", "threshamt"],
      help: "Invert everything above a brightness level — Posterize's nastier cousin.",
      defaults: { threshlvl: [0.5, 0.5], threshamt: [0.8, 0.8] },
      gl: src => postPass("thresh", src, u => { gl.uniform1f(u.uLevel, threshLevel); gl.uniform1f(u.uAmount, threshAmt); }) },
    { id: "chroma", cpuOk: false, name: "Chromatic aberration", stage: "post", params: ["chroma"],
      help: "Split the red and blue channels radially, so the image fringes toward the corners like a cheap lens.",
      defaults: { chroma: [1, 1] },
      gl: src => postPass("chroma", src, u => gl.uniform1f(u.uAmount, chromaAmt)) },
    { id: "mirror", cpuOk: false, name: "Mirror", stage: "post", params: ["mirror"],
      help: "Fold the image about its centre — X, Y or both.",
      defaults: { mirror: [1, 1] },
      gl: src => postPass("mirror", src, u => gl.uniform1f(u.uMode, mirrorMode)) },
    { id: "bloom", name: "Bloom", stage: "post", params: ["bloom"],
      help: "Additive glow: a blurred copy of the scene added back over it.",
      defaults: { bloom: [0.35, 0.35] } },
    // ---- screen stage: on top of the composite, at display resolution ----
    // Bloom is still the last *post* entry — these run after it, which is the whole
    // reason the stage exists (a vignette under an additive glow gets lit back up).
    { id: "barrel", cpuOk: false, name: "Barrel distortion", stage: "screen", params: ["barrel"],
      help: "Bulge the image as if it were painted on the front of a CRT.",
      defaults: { barrel: [0.15, 0.15] },
      gl: (src, w, h) => screenPass("barrel", src, w, h, u => gl.uniform1f(u.uAmount, barrelAmt)) },
    { id: "scanlines", cpuOk: false, name: "Scanlines", stage: "screen", params: ["scan", "scancount"],
      help: "Darken alternating rows — the raster you are pretending to be.",
      defaults: { scan: [0.35, 0.35], scancount: [240, 240] },
      gl: (src, w, h) => screenPass("scan", src, w, h, u => { gl.uniform1f(u.uAmount, scanAmt); gl.uniform1f(u.uCount, scanCount); }) },
    { id: "vignette", cpuOk: false, name: "Vignette", stage: "screen", params: ["vignette"],
      help: "Fall off toward the corners.",
      defaults: { vignette: [0.4, 0.4] },
      gl: (src, w, h) => screenPass("vignette", src, w, h, u => gl.uniform1f(u.uAmount, vigAmt)) },
    { id: "grain", cpuOk: false, name: "Film grain", stage: "screen", params: ["grain"],
      help: "Animated noise over the finished frame.",
      defaults: { grain: [0.08, 0.08] },
      gl: (src, w, h) => screenPass("grain", src, w, h, u => { gl.uniform1f(u.uAmount, grainAmt); gl.uniform1f(u.uTime, postTime); }) },
  ];
  const FILTER_BY_ID = {};
  FILTERS.forEach(f => FILTER_BY_ID[f.id] = f);
  // Fill the fallback mask now that the registry exists (see cpuBlocked's declaration).
  if (!useGL) FILTERS.forEach(f => { if (f.cpuOk === false) cpuBlocked.add(f.id); });
  const FILTER_DEFAULTS = {};                 // merged into every effect's state
  FILTERS.forEach(f => Object.assign(FILTER_DEFAULTS, f.defaults));
  buildFilterUI();                           // must follow FILTERS, not buildControls
  // Which filters are on for the live effect, in registry order (never in stored
  // order — reordering FILTERS must not remap a saved scene).
  const activeFilters = () => FILTERS.filter(f => filterOn(f.id));
  // transBurning(): a "burn off" transition lends retention to a scene that has none,
  // so the outgoing image decays under it instead of being wiped on the first frame.
  const hasFeedback = () => transBurning() || FILTERS.some(f => f.stage === "feedback" && filterOn(f.id));
  function filtersOk(v) {                     // validate a stored list
    if (!Array.isArray(v)) return null;
    const seen = new Set();
    for (const id of v) if (typeof id === "string" && FILTER_BY_ID[id]) seen.add(id);
    return seen;
  }
  // A descriptor's default filter list. Point effects (no `draw` hook — including
  // Attractor, which uses `stamp`) ship Fire on, so today's look is unchanged; every
  // effect ships Bloom on, because the glow used to be unconditional.
  function presetFilters(e) {
    const d = EFFECTS[e].filters || (EFFECTS[e].draw ? ["bloom"] : ["fire", "bloom"]);
    return d.slice();
  }
