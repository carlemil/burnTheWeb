

  const canvas = document.getElementById("fire");

  // Max effects in one stack. Declared up here (far above the stack code that owns it)
  // because initGL() — called during startup, long before the stack block — allocates
  // STACK_MAX per-layer heat/palette buffers; a `const` down by newStackItem would be
  // in the temporal dead zone at that call. Same hoisting reason as `card`/`beatUi`.
  const STACK_MAX = 4;

  // Prefer a WebGL2 renderer (the whole fire/Julia/palette/glow pipeline runs on
  // the GPU); fall back to the original Canvas2D path when WebGL2 is missing. A
  // canvas can only ever hold ONE context type, so we try webgl2 first and only
  // ask for "2d" if that fails.
  let gl = null, ctx = null, useGL = false, glReady = false;
  try {
    gl = canvas.getContext("webgl2", {
      antialias: false, depth: false, stencil: false,
      alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false,
    });
  } catch (e) { gl = null; }
  let off = null, offCtx = null;
  if (gl) {
    useGL = true;
  } else {
    ctx = canvas.getContext("2d");
    off = document.createElement("canvas");
    offCtx = off.getContext("2d");
  }

  // ---- GL resource handles (populated by initGL) ----
  const glProg = {};          // compiled/linked programs { p, u:{uniformLocs} }
  const glTex = {};           // textures (heat pair + colour/blur/palette)
  const glFbo = {};           // framebuffers matching the textures
  let quadVao = null, ptVao = null, ptVbo = null, ptVboCap = 0;
  let glSampLin = null;       // LINEAR sampler object for the warp feedback passes
  let curHeat = 0, pendingDst = 0;         // ping-pong index + propagation target
  const palBytes = new Uint8Array(256 * 4);// palette texture upload scratch
  let glPts = new Float32Array(3 * 8192), glPtCount = 0;   // CPU chaos-game stamps

  const cfg = { points: 1500, speed: 0.92, decay: 129, scale: 1, burn: 120 };

  // Active effect: 0 = Sirpinfyer (2D Sierpiński triangle fire), 1 = Tetrafyer
  // (3D Sierpiński tetrahedron fire), 2 = AnimeJulia (animated Julia set). All
  // write heat into the shared `fire` buffer, so palettes, auto-morph and the
  // render/glow pipeline are identical for every mode.
  let effect = 0;
  let showBox = true;        // Tetrafyer: draw the box wireframe (toggle)
  let randSeed = true;       // AnimeJulia: re-roll the orbit start on reload / effect entry (toggle)
  let cycleOn = true;        // auto-cycle saved presets on the TTL timer (toggle)
  let presets = [], curPreset = -1, applyingPreset = false;   // named full-scene snapshots

  // Zoom factor shared by both effects (1 = default). AnimeJulia zooms optically
  // by shrinking the complex-plane span (revealing real fractal detail); the fire
  // has no sub-pixel detail, so it zooms by scaling the rendered image.
  let zoom = 1;
  // Additive glow strength. Was a hardcoded 0.35 in FS_COMP and its CPU twin;
  // hoisted so the Bloom filter can drive it (0 = no glow). BLOOM_DEFAULT is what
  // every scene was authored under, so it stays the default everywhere.
  const BLOOM_DEFAULT = 0.35;
  let bloomAmt = BLOOM_DEFAULT;
  // Which post-FX filters are on for the live effect. Declared up here (and read
  // through a hoisted function) because bindRange runs a slider's apply() during
  // wiring, long before the FILTERS registry block is evaluated.
  let fadeKeep = 0.94, pixelBlock = 6, softenAmt = -0.6, softenRad = 1.5,
    edgeAmt = 0.7, posterLevels = 5, mirrorMode = 1;
  // Feedback warps (Echo / Zoom feedback / Swirl / Diffuse). Each carries its own
  // Keep, so it decays standalone instead of saturating to white when it is the only
  // feedback filter ticked — Fade is a separate filter you may or may not stack.
  let echoDist = 2, echoAng = 90, echoKeep = 0.94,
    zfbScale = 1.02, zfbKeep = 0.94, swirlSpin = 2, swirlKeep = 0.94,
    diffRad = 1, diffKeep = 0.97;
  // Post warps / colour
  let twistAmt = 1.2, wedgeSeg = 6, wedgeRot = 0, glitchAmt = 0.05, glitchRows = 8,
    halfDot = 4, halfAmt = 0.8, threshLevel = 0.5, threshAmt = 0.8, chromaAmt = 1;
  // Screen stage (after the glow, at display resolution)
  let barrelAmt = 0.15, scanAmt = 0.35, scanCount = 240, vigAmt = 0.4, grainAmt = 0.08;
  // Wall time for the post/screen passes that animate on their own (Slice glitch,
  // Grain). Accumulated from the frame loop's dt, never read off performance.now(),
  // so a stubbed-rAF pixel gate stays reproducible.
  let postTime = 0;
  let activeIds = new Set(["fire", "bloom"]);
  // GPU-only filters on the Canvas2D fallback. They are masked HERE, at the point of
  // use, and never removed from activeIds — that set is what saveExtra writes back, so
  // deleting them on load meant opening a scene on a fallback machine and touching
  // anything permanently stripped Pixelate/Blur/Edge/Posterize/Mirror from it. Filled
  // by the FILTERS block; empty until then, which is why filterOn stays safe to call
  // during slider wiring (bindRange runs apply() long before the registry exists).
  const cpuBlocked = new Set();
  // The whole-scene ("Scene filters") FX are SCENE-GLOBAL, not per layer: their on/off and
  // their slider values are one setting shared across every layer/effect. On/off lives in
  // `sceneOn` (not per-layer activeIds); values live in the DOM as singletons that loadState
  // /saveState/freezeItem skip (so switching layers never reloads them), persisted as the
  // top-level `sceneFx` blob field — modelled on the camera. The per-layer L.filters/states[e]
  // may still carry these ids/keys but they are INERT: filterOn and the checkbox route scene
  // filters through sceneOn, and the per-layer render chains exclude them by stage anyway.
  const SCENE_FILTER_IDS = new Set(["bloom", "barrel", "scanlines", "vignette", "grain"]);
  const SCENE_FILTER_KEYS = ["bloom", "barrel", "scan", "scancount", "vignette", "grain"];   // their dual-slider param keys
  const isSceneFilter = id => SCENE_FILTER_IDS.has(id);
  let sceneOn = new Set(["bloom"]);            // scene-global on/off; bloom on = the old unconditional glow
  // `activeIds` is the SELECTED layer's live filter set (the "DOM is the store for the
  // selected item" rule). The RENDER must follow what is on screen, not what is selected for
  // editing — you can select a muted layer to tweak it while a different one is the only
  // visible thing. `renderFilters` is that override: non-null only while the frame is drawing
  // a layer that is not the selected one, and always cleared before the frame returns, so
  // every UI caller (syncFilterUI, refreshControlVisibility) still sees activeIds.
  let renderFilters = null;
  function filterOn(id) {
    const on = isSceneFilter(id) ? sceneOn.has(id) : (renderFilters || activeIds).has(id);
    return on && !cpuBlocked.has(id);
  }
  // Camera rotation (radians) applied to each effect's own sampled space — see
  // camProg/camGlsl for the GL path and the camM matrix for the CPU path. These are the
  // LIVE globals for whichever layer is currently being drawn: the camera is per-layer
  // state (states[e].camrx/camry/camrz), and installStackItem pushes each layer's angles
  // in — plus camMat() — just before that layer renders.
  let camRX = 0, camRY = 0, camRZ = 0;
  // CPU mirror of the shader camera. Rotating (x, y, 0) by Rz·Ry·Rx and dropping z is a
  // plain 2×2 map, so the whole camera collapses to four numbers — worth hoisting,
  // since the CPU mirrors would otherwise call trig six times per pixel. Recomputed
  // once per frame by camMat(); the mirrors read camM and multiply.
  const camM = [1, 0, 0, 1];           // [m00, m01, m10, m11]
  function camMat() {
    const sx = Math.sin(camRX), cx = Math.cos(camRX);
    const sy = Math.sin(camRY), cy = Math.cos(camRY);
    const sz = Math.sin(camRZ), cz = Math.cos(camRZ);
    camM[0] = cy * cz;  camM[1] = sx * sy * cz - cx * sz;
    camM[2] = cy * sz;  camM[3] = sx * sy * sz + cx * cz;
    return camM;
  }
  const camOn = () => camRX !== 0 || camRY !== 0 || camRZ !== 0;   // skip the maths at rest
  // Rotate a pixel about the frame centre into camPX/camPY. The CPU mirrors call
  // this per pixel, so it writes scratch globals rather than returning a pair.
  // Mirrors the shader camera (camGlsl), which rotates gl_FragCoord the same way.
  let camPX = 0, camPY = 0;
  function camPix(x, y) {
    if (!camOn()) { camPX = x; camPY = y; return; }
    const dx = x - fw * 0.5, dy = y - fh * 0.5;
    camPX = camM[0] * dx + camM[1] * dy + fw * 0.5;
    camPY = camM[2] * dx + camM[3] * dy + fh * 0.5;
  }

  // Deterministic PRNG (mulberry32). Seeded once from unix time at load, then
  // re-seeded to that same value every frame so the chaos game draws the
  // identical point sequence each time — only the moving corners change the
  // shape, not the random noise. Different page loads get a different seed.
  const SEED = Date.now() | 0;
  let rngState = SEED;
  function rnd() {
    rngState |= 0;
    rngState = (rngState + 0x6D2B79F5) | 0;
    let z = rngState;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

