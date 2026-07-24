  // ---- palettes (classic demoscene style) ----
  // Each entry maps a heat index 0..255 to [r,g,b]; index 0 is forced to black
  // so unlit areas stay dark. The active one is baked into `palette` (ABGR).
  const palette = new Uint32Array(256);       // final ABGR pixels the render reads
  let paletteReverse = false;                 // reverse colour order (per-layer; the selected layer's live value)
  let paletteBg = "black";                    // background (heat 0): "black" | "white" | "palette" (per-layer)
  const BG_MODES = { black: 1, white: 1, palette: 1 };
  const bgOk = v => BG_MODES[v] ? v : "black";
  const paletteBase = new Float32Array(256 * 3);   // the smooth, unbanded RGB ramp
  const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

  // The original HSL fire ramp: black -> red -> orange -> yellow -> white.
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function fireColor(x) {
    const h = (x / 3) / 255, l = Math.min(255, x * 2) / 255, s = 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
  }

  // Piecewise-linear gradient through colour stops [pos(0..1), [r,g,b]].
  function grad(stops) {
    return x => {
      const t = x / 255;
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          const a = stops[i - 1], b = stops[i];
          const f = (t - a[0]) / ((b[0] - a[0]) || 1);
          return [
            a[1][0] + (b[1][0] - a[1][0]) * f,
            a[1][1] + (b[1][1] - a[1][1]) * f,
            a[1][2] + (b[1][2] - a[1][2]) * f,
          ];
        }
      }
      return stops[stops.length - 1][1];
    };
  }

  // Rainbow plasma: three phase-shifted sines, faded to black at the low end.
  function rainbowColor(x) {
    const t = x / 255, k = Math.PI * 2 * t, dim = Math.min(1, t * 2);
    return [
      (Math.sin(k) * 0.5 + 0.5) * 255 * dim,
      (Math.sin(k + 2.094) * 0.5 + 0.5) * 255 * dim,
      (Math.sin(k + 4.188) * 0.5 + 0.5) * 255 * dim,
    ];
  }

  const PALETTES = [
    { name: "Fire", fn: fireColor },
    { name: "Ice", fn: grad([[0, [0, 0, 0]], [0.35, [0, 0, 80]], [0.6, [0, 90, 200]], [0.8, [90, 205, 255]], [1, [230, 250, 255]]]) },
    { name: "Toxic", fn: grad([[0, [0, 0, 0]], [0.35, [0, 60, 0]], [0.6, [45, 180, 0]], [0.8, [165, 240, 40]], [1, [240, 255, 200]]]) },
    { name: "Copper", fn: grad([[0, [0, 0, 0]], [0.3, [70, 30, 10]], [0.55, [170, 90, 40]], [0.75, [230, 150, 90]], [0.9, [255, 210, 170]], [1, [255, 245, 230]]]) },
    { name: "Purple", fn: grad([[0, [0, 0, 0]], [0.35, [40, 0, 60]], [0.6, [140, 0, 180]], [0.8, [240, 60, 220]], [1, [255, 220, 255]]]) },
    { name: "Rainbow", fn: rainbowColor },
    { name: "Grayscale", fn: x => [x, x, x] },
    { name: "Electric", fn: grad([[0, [0, 0, 0]], [0.3, [0, 40, 120]], [0.55, [0, 200, 220]], [0.75, [180, 120, 255]], [0.9, [255, 120, 240]], [1, [255, 240, 255]]]) },
    { name: "Amber", fn: grad([[0, [0, 0, 0]], [0.3, [60, 25, 0]], [0.6, [180, 90, 0]], [0.85, [255, 170, 20]], [1, [255, 235, 160]]]) },
    { name: "Matrix", fn: grad([[0, [0, 0, 0]], [0.3, [0, 50, 10]], [0.6, [0, 160, 40]], [0.85, [80, 255, 120]], [1, [220, 255, 220]]]) },
    { name: "Sunset", fn: grad([[0, [0, 0, 0]], [0.25, [30, 0, 60]], [0.5, [150, 20, 90]], [0.7, [240, 90, 60]], [0.88, [255, 180, 60]], [1, [255, 245, 200]]]) },
    { name: "C64", fn: grad([[0, [0, 0, 0]], [0.3, [48, 44, 128]], [0.6, [104, 104, 200]], [0.85, [160, 200, 240]], [1, [255, 255, 255]]]) },
    { name: "CGA", fn: grad([[0, [0, 0, 0]], [0.35, [0, 0, 170]], [0.55, [0, 170, 170]], [0.75, [255, 85, 255]], [1, [255, 255, 255]]]) },
    { name: "Blood", fn: grad([[0, [0, 0, 0]], [0.35, [50, 0, 0]], [0.6, [150, 0, 10]], [0.8, [225, 40, 30]], [0.92, [255, 140, 110]], [1, [255, 230, 215]]]) },
    { name: "Chrome", fn: grad([[0, [0, 0, 0]], [0.25, [20, 30, 55]], [0.45, [90, 110, 140]], [0.62, [200, 215, 235]], [0.75, [70, 90, 120]], [0.9, [180, 200, 225]], [1, [255, 255, 255]]]) },
    // Rastafari palettes — green / gold / red. "One love" runs the full tricolor;
    // the other three each lean on one of the three colours.
    { name: "One love", fn: grad([[0, [0, 0, 0]], [0.22, [0, 110, 40]], [0.5, [240, 200, 20]], [0.78, [210, 25, 25]], [1, [255, 240, 205]]]) },
    { name: "Rasta Red", fn: grad([[0, [0, 0, 0]], [0.12, [70, 0, 0]], [0.5, [200, 15, 15]], [0.78, [235, 45, 25]], [0.86, [255, 130, 30]], [0.93, [255, 215, 60]], [1, [255, 250, 235]]]) },
    { name: "Rasta Green", fn: grad([[0, [0, 0, 0]], [0.12, [0, 60, 15]], [0.5, [15, 180, 30]], [0.78, [50, 220, 35]], [0.86, [170, 225, 40]], [0.93, [255, 225, 60]], [1, [245, 255, 235]]]) },
    { name: "Rasta Yellow", fn: grad([[0, [0, 0, 0]], [0.1, [130, 10, 5]], [0.22, [225, 35, 15]], [0.34, [255, 150, 25]], [0.5, [255, 205, 40]], [0.72, [255, 230, 70]], [0.9, [255, 248, 170]], [1, [255, 255, 240]]]) },
  ];

  // ---- Banded stripes: a *filter* over whatever palette is active, not a
  // palette of its own. It dims alternating groups of heat bands (three light,
  // three dark, repeating) so any ramp reads as crisp contour stripes. Its
  // strength (bandLevel, 0..1) is driven by the ranged Banding slider — so it
  // can sit anywhere, or wander erratically between two bounds.
  const BAND_COUNT = 18;          // number of posterized flat colours across the ramp
  let bandLevel = 0;              // 0..1 filter amount (set by the Banding slider)
  let bandGroup = 3;              // colours per light (and per dark) run — Band size slider
  let bandDim = 0.35;             // dark-run brightness — Dark strength slider (1 = none)
  let bandLive = false;           // is the currently-baked palette banded?

  // setPalette / morphStep fill this smooth base ramp; composePalette() then
  // bakes it (with the live banding filter) into the ABGR `palette` each frame.
  function setBase(i) {
    const fn = PALETTES[i].fn;
    for (let x = 0; x < 256; x++) {
      const c = fn(x);
      paletteBase[x * 3] = clamp(c[0]);
      paletteBase[x * 3 + 1] = clamp(c[1]);
      paletteBase[x * 3 + 2] = clamp(c[2]);
    }
  }
  let paletteDirty = true;   // gate GL palette re-upload to frames where it changed
  function setPalette(i) { setBase(i); composePalette(0); }

  // Fold the banding filter over paletteBase into the final ABGR palette. For
  // each band we take a single flat colour (the band's centre of the smooth
  // ramp) and dim alternating groups of three, so any palette turns into hard
  // light/dark contour stripes. The applied amount per index = bandLevel · a
  // travelling wave, so the stripes fade in with the toggle and shimmer along
  // the ramp while on — off, fully on, or anywhere between.
  // `base`/`rev`/`bg` default to the selected layer's live globals (every caller but the
  // render-layer bake below passes only `now`, so that path is byte-identical). They are
  // overridable so a frame whose visible layer is NOT the selected one can colour through
  // THAT layer's ramp instead — see the renderL bake in frame().
  function composePalette(now, base, rev, bg) {
    base = base || paletteBase;
    if (rev === undefined) rev = paletteReverse;
    if (bg === undefined) bg = paletteBg;
    const t = now * 0.001;
    const on = bandLevel > 0.001;
    for (let x = 0; x < 256; x++) {
      let r = base[x * 3], g = base[x * 3 + 1], b = base[x * 3 + 2];
      if (on) {
        const band = (x / 256 * BAND_COUNT) | 0;
        const ci = (((band + 0.5) / BAND_COUNT) * 256) | 0;          // flat band colour
        const dim = ((band / bandGroup) | 0) % 2 === 0 ? 1 : bandDim; // light vs dark run
        const wave = 0.6 + 0.4 * Math.sin(t * 0.9 - x * 0.05);    // breathe along ramp
        const amt = bandLevel * wave;
        r += (base[ci * 3] * dim - r) * amt;                      // blend toward the
        g += (base[ci * 3 + 1] * dim - g) * amt;                  // flat, dimmed band
        b += (base[ci * 3 + 2] * dim - b) * amt;
      }
      palette[x] = (255 << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r);
    }
    // Reverse colour order: flip indices 1..255 (255↔1, 254↔2, …; 128 fixed), leaving 0 as
    // the forced black below — so the dark background stays black while the ramp runs the
    // other way. Applied after banding, so the stripes simply run the other direction too.
    if (rev) for (let x = 1; x <= 127; x++) { const t = palette[x]; palette[x] = palette[256 - x]; palette[256 - x] = t; }
    // Background (heat 0): black (default), white, or the palette's own colour-0 (leave as
    // composed). Everything else keeps the old forced-black behaviour byte-for-byte.
    if (bg === "white") palette[0] = 0xFFFFFFFF;
    else if (bg !== "palette") palette[0] = 0xFF000000; // opaque black
    paletteDirty = true;      // composePalette is the only writer ⇒ flag GL re-upload
  }
  setPalette(0);

  // ---- auto-morph: continuously blend to a random palette over 8s ----
  const MORPH_MS = 8000;          // fallback only — the live duration comes from the Palette cycle slider
  // Palette cycle: the [min,max] seconds one morph takes, from the "palcycle"
  // dual slider. Both thumbs at 0 pins the palette (what the old "Auto-morph"
  // checkbox unticked used to do). palCycleLive is the slider's animated value;
  // morphMs() draws each cycle's duration from the thumbs, like ttlMs().
  let palCycleLive = 8, palHoldLive = 0;
  function palCycleBand() {
    const lo = el("palcycle-lo"), hi = el("palcycle-hi");
    if (!lo || !hi) return [8, 8];
    return [Math.min(+lo.value, +hi.value), Math.max(+lo.value, +hi.value)];
  }
  function palCycleOn() { return palCycleBand()[1] > 0; }        // fixed palette when the band tops out at 0
  function morphMs() {
    const [a, b] = palCycleBand();
    const s = a + Math.random() * (b - a);
    return Math.max(0.2, s) * 1000;                              // never divide by ~0
  }
  // How long to HOLD an arrived palette before starting the next morph — a [min,max]
  // seconds range, a fresh draw per hold. Both thumbs at 0 (the shipped default, so
  // every existing scene keeps its old continuous morph) means no hold at all.
  function palHoldBand() {
    const lo = el("palhold-lo"), hi = el("palhold-hi");
    if (!lo || !hi) return [0, 0];
    return [Math.min(+lo.value, +hi.value), Math.max(+lo.value, +hi.value)];
  }
  function holdMs() {
    const [a, b] = palHoldBand();
    return (a + Math.random() * (b - a)) * 1000;
  }
  let morphing = false, morphFrom = null, morphTo = null, morphStart = 0,
    morphTargetIndex = 0, morphInit = false, morphOnce = false,   // morphOnce: a single transition (preset switch) even when auto-morph is off
    morphHoldUntil = 0;   // while > now, sit on the arrived palette (Palette hold) before the next morph

  function paletteRGB(i) {
    const fn = PALETTES[i].fn, arr = new Float32Array(256 * 3);
    for (let x = 0; x < 256; x++) {
      const c = fn(x);
      arr[x * 3] = clamp(c[0]); arr[x * 3 + 1] = clamp(c[1]); arr[x * 3 + 2] = clamp(c[2]);
    }
    arr[0] = arr[1] = arr[2] = 0; // index 0 black
    return arr;
  }
  function pickOther(cur) {                 // random palette index != cur
    let n;
    do { n = (Math.random() * PALETTES.length) | 0; } while (n === cur);
    return n;
  }
  // reflect the palette we're heading toward in the dropdown
  function showMorphTarget() { el("palette").value = morphTargetIndex; syncPalSwatches(); }
  // Start a morph FROM an explicit base ramp (a live snapshot of what's on
  // screen) TO a target palette index — so the blend begins exactly where we
  // are, with no snap. We paint the start frame immediately so a switch made
  // mid-frame (auto-cycle) doesn't flash the raw target for one frame before
  // morphStep takes over. startMorph() is the common case: blend from a
  // discrete palette, picking a fresh random destination.
  function beginMorph(fromRGB, targetIndex) {
    morphFrom = fromRGB;
    morphTargetIndex = targetIndex;
    morphTo = paletteRGB(targetIndex);
    morphInit = true;                       // capture start time on next frame
    paletteBase.set(fromRGB);               // start exactly where we were
    composePalette(0);
    showMorphTarget();
  }
  function startMorph(fromIndex) { beginMorph(paletteRGB(fromIndex), pickOther(fromIndex)); }
  let morphDur = MORPH_MS;
  // Begin the next auto-morph from the palette we just arrived on.
  function morphNext(now) {
    morphFrom = morphTo;                    // target becomes current, pick a new one
    morphTargetIndex = pickOther(morphTargetIndex);
    morphTo = paletteRGB(morphTargetIndex);
    morphStart = now;
    morphDur = morphMs();                   // each cycle draws its own transition time
    showMorphTarget();
  }
  function morphStep(now) {
    if (morphInit) { morphStart = now; morphDur = morphMs(); morphInit = false; morphHoldUntil = 0; }
    // Holding on the arrived palette (Palette hold) — sit still until the timer expires,
    // then start the next morph. composePalette still runs so the banding filter animates.
    if (morphHoldUntil) {
      if (now < morphHoldUntil) { composePalette(now); return; }
      morphHoldUntil = 0;
      morphNext(now);
    }
    let f = (now - morphStart) / morphDur;
    if (f >= 1) {                           // arrived
      if (!morphing) { morphOnce = false; setPalette(morphTargetIndex); return; }   // one-shot: settle on the target
      const hold = holdMs();
      if (hold > 0) {                       // land exactly on the target and dwell before the next
        paletteBase.set(morphTo);
        morphHoldUntil = now + hold;
        composePalette(now);
        return;
      }
      morphNext(now);                       // no hold ⇒ continuous morph, exactly as before
      f = 0;
    }
    const from = morphFrom, to = morphTo;
    for (let i = 0, len = 256 * 3; i < len; i++) {
      paletteBase[i] = from[i] + (to[i] - from[i]) * f;   // blend into the base ramp
    }
    composePalette(now);                    // then apply the live banding filter
  }

  // ---- buffers ----
  // `fire` is the heat buffer; `fireNext` is the propagation write target (the
  // CPU path double-buffers so propagation is left/right symmetric — reading a
  // single in-place buffer in column order would bias heat leftward and the
  // flames would lean, diverging from the symmetric GPU shader).
  // `fireKeep` holds the retained heat while a shader effect's CPU mirror overwrites
  // the scratch buffer (see frame()); the two are swapped, never copied.
  let fw = 0, fh = 0, fire = null, fireNext = null, fireKeep = null, img = null, buf32 = null;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    fw = Math.max(4, Math.floor(w / cfg.scale));
    fh = Math.max(4, Math.floor(h / cfg.scale));
    if (useGL) {
      if (glReady) { glResize(); glClearHeat(); }
    } else {
      off.width = fw;
      off.height = fh;
      fire = new Uint8Array(fw * fh);
      fireNext = new Uint8Array(fw * fh);
      fireKeep = new Uint8Array(fw * fh);
      img = offCtx.createImageData(fw, fh);
      buf32 = new Uint32Array(img.data.buffer);
      ctx.imageSmoothingEnabled = true;
    }
  }
  if (useGL) initGL();          // compile programs + allocate GL objects first
  window.addEventListener("resize", resize);
  resize();

  // -----------------------------------------------------------------------
