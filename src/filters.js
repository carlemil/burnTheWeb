  // ---- FILTERS: stackable post-FX applied after the effect renders ------------
  // The fire simulation used to be hardwired to the three point effects; it is now
  // one entry here, so any effect can have it. Three stages, split by where in the
  // pipeline the filter writes — and they must be listed in that order (filterprobe):
  //   feedback — mutates heat that survives to the next frame (Fire, Fade, Diffuse,
  //              Echo, Zoom feedback, Swirl). Runs inside glBeginHeat, before the
  //              effect's output is MAX-injected. Each carries its own Lifetime (the
  //              `*Keep` globals — the label was renamed, the state names were not): a pure
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
    // Bloom is a REAL PASS now, not the composite. It used to BE the whole-scene glow with its
    // strength as a uniform, which is exactly why it had no `gl` hook and could never be
    // per-layer. glBloomPass makes it an ordinary chain entry, so each layer glows on its own
    // before the layers blend. (The Canvas2D path still glows via bloomAmt in render(), so it
    // stays available there — hence no cpuOk: false.)
    { id: "bloom", name: "Bloom", stage: "post", params: ["bloom"],
      help: "Additive glow: a blurred copy added back over this layer.",
      defaults: { bloom: [0.35, 0.35] },
      gl: src => glBloomPass(src) },
    // ---- the ex-"screen" filters, now ordinary PER-LAYER image passes ----------------
    // They ran once on the finished composite, at display resolution. Every filter belongs to
    // a layer now and nothing acts on the whole screen. Two consequences worth knowing rather
    // than discovering:
    //   * uSize is the render buffer (fw x fh), not the canvas, so Scanline count means lines
    //     across the render buffer. At Full resolution that is the number it always was; at
    //     lower resolutions the same count is a coarser raster.
    //   * On a stack each layer carries its own and the results blend, so two layers with
    //     scanlines can moire against each other. Put it on ONE layer for a clean raster.
    //   * The old stage existed partly because a vignette UNDER an additive glow gets lit back
    //     up. That is now yours to order: put Vignette after Bloom in the chain and it darkens
    //     the glow too, which is what the old fixed order did.
    { id: "barrel", cpuOk: false, name: "Barrel distortion", stage: "post", params: ["barrel"],
      help: "Bulge the image as if it were painted on the front of a CRT.",
      defaults: { barrel: [0.15, 0.15] },
      gl: src => postPass("barrel", src, u => gl.uniform1f(u.uAmount, barrelAmt)) },
    { id: "scanlines", cpuOk: false, name: "Scanlines", stage: "post", params: ["scan", "scancount"],
      help: "Darken alternating rows — the raster you are pretending to be.",
      defaults: { scan: [0.35, 0.35], scancount: [240, 240] },
      gl: src => postPass("scan", src, u => { gl.uniform1f(u.uAmount, scanAmt); gl.uniform1f(u.uCount, scanCount); }) },
    { id: "vignette", cpuOk: false, name: "Vignette", stage: "post", params: ["vignette"],
      help: "Fall off toward the corners.",
      defaults: { vignette: [0.4, 0.4] },
      gl: src => postPass("vignette", src, u => gl.uniform1f(u.uAmount, vigAmt)) },
    { id: "grain", cpuOk: false, name: "Film grain", stage: "post", params: ["grain"],
      help: "Animated noise over the finished frame.",
      defaults: { grain: [0.08, 0.08] },
      gl: src => postPass("grain", src, u => { gl.uniform1f(u.uAmount, grainAmt); gl.uniform1f(u.uTime, postTime); }) },
  ];
  const FILTER_BY_ID = {};
  FILTERS.forEach(f => FILTER_BY_ID[f.id] = f);
  // Fill the fallback mask now that the registry exists (see cpuBlocked's declaration).
  if (!useGL) FILTERS.forEach(f => { if (f.cpuOk === false) cpuBlocked.add(f.id); });
  const FILTER_DEFAULTS = {};                 // merged into every effect's state
  FILTERS.forEach(f => Object.assign(FILTER_DEFAULTS, f.defaults));
  // ---- ORDER: the stored list is the USER's order, not the registry's ----------------
  // Each per-effect filter carries a drag handle, so `L.filters` is an ORDERED list and
  // everything that walks a chain iterates that order. (`filtersOk` builds its Set by
  // inserting in array order and a JS Set iterates in insertion order, so the stored order
  // survives it untouched.) Registry order is still the fallback for anything with no
  // stored list, and ids are still matched by name, so reordering FILTERS itself cannot
  // remap a saved scene.
  //
  // STAGE OUTRANKS THE USER'S ORDER, and it has to. A `feedback` filter mutates retained
  // heat BEFORE the effect draws, a `post` filter runs on the palette-mapped image AFTER,
  // and a `screen` filter after the composite — there is no pipeline position where
  // Pixelate could run before Fire. So a chain is stage-partitioned, stably, and the MENU
  // is rendered from this same normalized order. That is what keeps "applied in the order
  // shown" literally true rather than approximately: drag an image filter above a heat one
  // and it visibly lands at the boundary instead of pretending to move.
  //
  // A function declaration, not a const arrow: render-gl-pipeline.js is 5th in the manifest
  // and calls this, while FILTERS lives here at 21st. Hoisting is what makes that legal —
  // exactly the arrangement `filtersOk` already relies on.
  const FILTER_STAGE_RANK = { feedback: 0, post: 1, screen: 2 };
  function orderFilters(ids) {
    const out = [], seen = new Set();
    for (const id of ids || []) {
      const f = FILTER_BY_ID[id];
      if (f && !seen.has(id)) { seen.add(id); out.push(f); }
    }
    // NO stage sort for the per-layer chain — see splitChain. `screen` filters belong to the
    // scene list, which is not reorderable, so they are pushed last purely for tidiness.
    return out.sort((a, b) => (a.stage === "screen" ? 1 : 0) - (b.stage === "screen" ? 1 : 0));
  }
  // ---- WHERE EACH FILTER RUNS: split the chain, do not sort it ------------------------
  // The chain is a sequence and it is honoured as one. The pipeline has exactly one fixed
  // point — the effect draws its fresh output into the heat buffer — and everything the user
  // puts ABOVE that runs on the heat, everything below runs on the palette-mapped picture.
  //
  // A `feedback` filter (Fire, Fade, Diffuse, Echo, Zoom feedback, Swirl) reads and writes
  // retained heat with a keep factor; it is only meaningful in the heat phase, so the LAST
  // feedback filter in the chain marks the boundary. A `post` filter is just a pass that
  // samples a texture and draws a quad, so it runs happily in EITHER phase: placed above a
  // feedback filter it warps the heat (heat textures are R8, the shader writes .r back);
  // placed below, it repaints the finished image as before.
  //
  // This is what makes "Mirror above Swirl" a real, visible thing rather than a drag that
  // snaps back — reported twice, and the previous answer (partition by stage, draw the
  // boundary, explain the clamp) was solving the wrong problem. With no feedback filter at
  // all the heat is cleared every frame, so there is nothing to warp and the whole chain runs
  // in the image phase.
  function splitChain(ids) {
    const list = orderFilters(ids).filter(f => f.stage !== "screen");
    let last = -1;
    list.forEach((f, i) => { if (f.stage === "feedback") last = i; });
    return {
      heat: list.slice(0, last + 1).filter(f => f.glFeedback || f.gl),
      image: list.slice(last + 1).filter(f => f.gl),
    };
  }
  // Run one entry of a heat-phase chain: a feedback filter through its own hook, a post
  // filter through the ordinary pass it already has. Both draw into the bound FBO.
  function runHeatPass(f, srcTex) {
    if (f.glFeedback) f.glFeedback(srcTex); else f.gl(srcTex);
  }
  // Which filters are on for the live effect, in the order they will be applied: the
  // selected layer's own ordered set, plus the scene-global ones (which are not per-layer
  // and so have no user order of their own).
  function activeFilters() {
    const ids = [...(renderFilters || activeIds)];
    for (const f of FILTERS) if (isSceneFilter(f.id) && sceneOn.has(f.id)) ids.push(f.id);
    return orderFilters(ids).filter(f => filterOn(f.id));
  }
  // The SELECTED layer's per-effect filter ids in the user's order — what saveExtra and
  // captureLayerExtras write back. They used to write `FILTERS.filter(...)`, i.e. registry
  // order, which silently discarded any reordering on the very next capture.
  const activeFilterIds = () => orderFilters(activeIds).map(f => f.id);
  // AFTER the ORDER block, not before it: buildFilterUI ends in renderFilterLists, which
  // calls orderFilters, which reads the `const FILTER_STAGE_RANK` above. Called any earlier
  // that const is in the temporal dead zone and the whole list silently fails to render —
  // every filter showing at once, because nothing ever hid the ones you have not added.
  // (`function orderFilters` itself hoists fine; it is the const it closes over that does not.)
  buildFilterUI();                           // must follow FILTERS, not buildControls
  // transBurning(): a "burn off" transition lends retention to a scene that has none,
  // so the outgoing image decays under it instead of being wiped on the first frame.
  const hasFeedback = () => transBurning() || FILTERS.some(f => f.stage === "feedback" && filterOn(f.id));
  // ONE layer's chain as it will actually be drawn: its stored order (or the descriptor
  // default) less anything bypassed. The stored list itself is never touched — bypass is a
  // view of the chain, not an edit to it, so it survives no save and changes no scene.
  function liveChainIds(L) {
    const set = filtersOk(L && L.filters) || new Set(presetFilters(L ? L.fx : effect));
    const off = (L && L.fxOff) || null;
    if (!off || !off.size) return set;
    return new Set([...set].filter(id => !off.has(id)));
  }
  function filtersOk(v) {                     // validate a stored list
    if (!Array.isArray(v)) return null;
    const seen = new Set();
    for (const id of v) if (typeof id === "string" && FILTER_BY_ID[id]) seen.add(id);
    return seen;
  }
  // A descriptor's default filter list. Every effect now ships with NO filters on — a new
  // effect / layer starts as its raw output, and you tick the filters you want. (A descriptor
  // may still pin its own `filters` list; none do.) NOTE: point effects (Sierpiński / Tetrafyer
  // / Attractor) render as raw stamped points without `fire` — tick Fire to get the rising-fire
  // look. Bloom is off too, so nothing glows until you enable it.
  function presetFilters(e) {
    const d = EFFECTS[e].filters || [];
    return d.slice();
  }
