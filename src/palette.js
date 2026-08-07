  // ---- palettes (classic demoscene style) ----
  // Each entry maps a heat index 0..255 to [r,g,b]; index 0 is forced to black
  // so unlit areas stay dark. The active one is baked into `palette` (ABGR).
  const palette = new Uint32Array(256);       // final ABGR pixels the render reads
  let paletteReverse = false;                 // reverse colour order (per-layer; the selected layer's live value)
  // Background (heat 0): "black" | "white" | "palette", per layer. The default is
  // **palette** — heat 0 shows whatever colour 0 the ramp itself defines, rather than a
  // forced black. Every built-in ramp starts at [0,0,0] anyway, so the shipped look is
  // unchanged; what it fixes is a CUSTOM ramp whose colour 0 is not black, which used to
  // be silently overridden. `bgOk` is also the validator for loaded scenes, so a scene that
  // stored a background explicitly keeps it — only one that never had the field (saved
  // before this control existed) now opens on "palette" instead of "black".
  let paletteBg = "palette";
  const BG_MODES = { black: 1, white: 1, palette: 1 };
  const bgOk = v => BG_MODES[v] ? v : "palette";
  const paletteBase = new Float32Array(256 * 3);   // the smooth, unbanded RGB ramp
  const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  // Ease the lowest few colours (1..PAL_FADE_N−1) into the background so lit areas
  // fade OUT of it over several steps instead of showing a hard edge where the fractal
  // meets the black. Index 0 is the forced background; the ramp reaches its real colour
  // by PAL_FADE_N. Matters most for a REVERSED ramp, whose colour 1 would otherwise be the
  // brightest one straight against black. smoothstep so the ramp itself has no kink.
  const PAL_FADE_N = 8;
  const palFadeW = x => { const s = x / PAL_FADE_N; return s * s * (3 - 2 * s); };

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
  // The returned fn carries its own `stops`, so the palette editor can seed itself with a
  // built-in's EXACT control points instead of re-sampling the curve back into stops (which
  // would round-trip Fire into something subtly different from Fire the moment you opened it).
  function grad(stops) {
    const fn = x => {
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
    fn.stops = stops;
    return fn;
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
    // A green / gold / red family. "Tricolor" runs all three in sequence; the other three
    // each lean on one of them. Renaming these is SAFE: a palette is referenced everywhere
    // by INDEX (see palRemapDeleted), never by name, so no saved scene, share link, backup
    // or cloud profile is affected — keep the ORDER, though.
    { name: "Tricolor", fn: grad([[0, [0, 0, 0]], [0.22, [0, 110, 40]], [0.5, [240, 200, 20]], [0.78, [210, 25, 25]], [1, [255, 240, 205]]]) },
    { name: "Ember", fn: grad([[0, [0, 0, 0]], [0.12, [70, 0, 0]], [0.5, [200, 15, 15]], [0.78, [235, 45, 25]], [0.86, [255, 130, 30]], [0.93, [255, 215, 60]], [1, [255, 250, 235]]]) },
    { name: "Verdant", fn: grad([[0, [0, 0, 0]], [0.12, [0, 60, 15]], [0.5, [15, 180, 30]], [0.78, [50, 220, 35]], [0.86, [170, 225, 40]], [0.93, [255, 225, 60]], [1, [245, 255, 235]]]) },
    { name: "Sunburst", fn: grad([[0, [0, 0, 0]], [0.1, [130, 10, 5]], [0.22, [225, 35, 15]], [0.34, [255, 150, 25]], [0.5, [255, 205, 40]], [0.72, [255, 230, 70]], [0.9, [255, 248, 170]], [1, [255, 255, 240]]]) },
  ];

  // ---- custom palettes (the palette editor) ---------------------------------
  // User-authored ramps live in the SAME `PALETTES` array, appended after the shipped ones,
  // so every consumer — `paletteRGB`, `setBase`, `pickOther`, the swatches, the `<select>`
  // options, per-layer `bakeLayerBytes` — keeps working untouched and a custom palette is a
  // first-class choice everywhere a built-in is. `PAL_BUILTIN` is captured HERE, immediately
  // after the literal, so it is the count of shipped palettes no matter what is appended later.
  //
  // Consequence to know: a palette is referenced by INDEX (that is the existing storage
  // format, `L.palette`), so customs must be installed BEFORE anything reads one back — they
  // ride in the saved blob and `applyBlob` installs them ahead of validating any palette
  // value. A share link naming a custom index the recipient does not have fails validation
  // and falls back to the seeded default rather than corrupting anything.
  const PAL_BUILTIN = PALETTES.length;
  const PAL_MAX_CUSTOM = 24, PAL_MAX_STOPS = 16, PAL_MIN_STOPS = 2;
  const isCustomPal = i => i >= PAL_BUILTIN;
  // One custom definition {name, stops} → a PALETTES entry. `stops` is kept on the entry as
  // well as inside the fn so the editor and the serializer read the same array.
  function customPalEntry(def) {
    return { name: def.name, fn: grad(def.stops), custom: true, stops: def.stops };
  }
  // Replace the custom tail wholesale. Truncating to PAL_BUILTIN first is what makes this
  // idempotent — it is called on every load and on every editor save.
  function installCustomPalettes(list) {
    PALETTES.length = PAL_BUILTIN;
    (list || []).forEach(d => PALETTES.push(customPalEntry(d)));
  }
  const customPalettes = () => PALETTES.slice(PAL_BUILTIN).map(p => ({ name: p.name, stops: p.stops }));
  // Validate a stop list from a blob: pairs of [pos 0..1, [r,g,b]], sorted, deduped, clamped,
  // capped. Returns null if it cannot be made into a usable ramp — a caller that gets null
  // drops that palette rather than installing something that would throw inside grad().
  function palStopsOk(raw) {
    if (!Array.isArray(raw)) return null;
    const out = [];
    for (const s of raw.slice(0, PAL_MAX_STOPS)) {
      if (!Array.isArray(s) || s.length < 2 || !Array.isArray(s[1]) || s[1].length < 3) continue;
      const p = +s[0], c = s[1].slice(0, 3).map(v => clamp(+v));
      if (!Number.isFinite(p) || c.some(v => !Number.isFinite(v))) continue;
      out.push([Math.max(0, Math.min(1, p)), c]);
    }
    if (out.length < PAL_MIN_STOPS) return null;
    out.sort((a, b) => a[0] - b[0]);
    // grad() divides by (b[0] - a[0]) with a `|| 1` guard, so duplicate positions are safe
    // but useless; drop them so a saved ramp stays editable.
    const dedup = out.filter((s, i) => i === 0 || s[0] > out[i - 1][0] + 1e-6);
    return dedup.length >= PAL_MIN_STOPS ? dedup : null;
  }
  function customPalettesOk(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const d of raw.slice(0, PAL_MAX_CUSTOM)) {
      if (!d || typeof d !== "object") continue;
      const stops = palStopsOk(d.stops);
      if (!stops) continue;
      const name = typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 40) : "Custom";
      out.push({ name, stops });
    }
    return out;
  }
  // The stops to seed the editor with for palette `i`: a gradient's own control points where
  // it has them, else the curve sampled evenly. Fire, Rainbow and Grayscale are procedural
  // (no stops), so editing one starts from a faithful sampled approximation of it.
  const PAL_SAMPLE_N = 9;
  function palStopsOf(i) {
    const p = PALETTES[i] || PALETTES[0];
    if (p.fn.stops) return p.fn.stops.map(s => [s[0], s[1].slice(0, 3).map(clamp)]);
    const out = [];
    for (let k = 0; k < PAL_SAMPLE_N; k++) {
      const t = k / (PAL_SAMPLE_N - 1);
      out.push([t, p.fn(Math.round(t * 255)).slice(0, 3).map(clamp)]);
    }
    return out;
  }

  // ---- Banded stripes: a *filter* over whatever palette is active, not a
  // palette of its own. It dims alternating groups of heat bands (three light,
  // three dark, repeating) so any ramp reads as crisp contour stripes. Its
  // strength (bandLevel, 0..1) is driven by the ranged Banding slider — so it
  // can sit anywhere, or wander erratically between two bounds.
  const BAND_COUNT = CONFIG.bandCount;   // number of posterized flat colours across the ramp
  let bandLevel = 0;              // 0..1 filter amount (set by the Banding slider)
  let bandGroup = 3;              // colours per light (and per dark) run — Band size slider
  let bandDim = 0.35;             // dark-run brightness — Dark strength slider (1 = none)
  let bandLive = false;           // is the currently-baked palette banded?
  // Heat boost (per-layer, the "Heat boost" slider). A gamma remap of the heat VALUE before it
  // indexes the palette: idx' = idx^(1/(1+heatBoost)), so 0 = identity (the palette as-is) and
  // higher values push the dim mid-heat up into the bright end of the ramp, using more of its
  // strong colours. Endpoints are fixed (0→0 background, 1→1 top). Applied in the shader
  // (FS_PAL's uCurve) and, on the Canvas2D path, through heatLut below.
  let heatBoost = 0;
  const heatLut = new Uint8Array(256);   // CPU remap LUT, rebuilt each frame when heatBoost > 0

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
    // Smooth the lowest colours into the background (see PAL_FADE_N). Skipped for the
    // "palette" background, which deliberately keeps the ramp's own colour-0.
    if (bg !== "palette") {
      const bv = bg === "white" ? 255 : 0;
      for (let x = 1; x < PAL_FADE_N; x++) {
        const w = palFadeW(x), p = palette[x];
        const r = bv + ((p & 0xff) - bv) * w, g = bv + (((p >> 8) & 0xff) - bv) * w, b = bv + (((p >> 16) & 0xff) - bv) * w;
        palette[x] = (255 << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r);
      }
    }
    // Background (heat 0): black (default), white, or the palette's own colour-0 (leave as
    // composed). Everything else keeps the old forced-black behaviour byte-for-byte.
    if (bg === "white") palette[0] = 0xFFFFFFFF;
    else if (bg !== "palette") palette[0] = 0xFF000000; // opaque black
    paletteDirty = true;      // composePalette is the only writer ⇒ flag GL re-upload
  }
  setPalette(0);

  // ---- auto-morph: continuously blend to a random palette over 8s ----
  const MORPH_MS = CONFIG.paletteMorphMs;   // fallback only — the live duration comes from the Palette cycle slider
  // Palette cycle: the [min,max] seconds one morph takes, from the "palcycle"
  // dual slider. Both thumbs at 0 pins the palette (what the old "Auto-morph"
  // checkbox unticked used to do). palCycleLive is the slider's animated value;
  // morphMs() draws each cycle's duration from the thumbs, like ttlMs().
  let palCycleLive = 8, palHoldLive = 0;
  function palCycleBand() {
    const lo = ctl("palcycle-lo"), hi = ctl("palcycle-hi");
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
    const lo = ctl("palhold-lo"), hi = ctl("palhold-hi");
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
  // ---- which palettes are IN USE ---------------------------------------------------
  // The swatch strip shows only these, and the palette cycle picks only from them — so you
  // can keep a catalogue of 20+ ramps and still have the cycle stay inside the four that
  // suit a set. NOTHING is deleted by unticking: a scene that stores an untick-ed palette
  // still loads it and still renders it, because this gates the STRIP and the CYCLE, not
  // `paletteRGB`. (The strip therefore also shows the current palette whether or not it is
  // ticked, or selecting a scene would blank the highlight.)
  //
  // `null` means "all of them", which is the shipped state and what every blob saved before
  // this existed decodes to — so there is nothing to migrate and no key is written until you
  // actually narrow the set. Indices, like every other palette reference here, which is why
  // palRemapDeleted has to remap this too.
  //
  // Global, not per-scene: the same class as auto-cycle and Preset TTL. A shared scene
  // deliberately does not carry it — it is the recipient's own library preference.
  let palUse = null;
  // DELETED shipped palettes — a SOFT delete (tombstone Set of built-in indices). A real
  // removal is impossible for a built-in: palette indices are the wire format and the
  // shipped block is shared vocabulary across every browser and share link, so the entry
  // STAYS in PALETTES (scenes that reference it keep rendering) and only disappears from
  // the strip, the picker and the cycle — all of which gate through palInUse. Persisted
  // beside palUse (global library preference, skipped while sharing). Customs never enter
  // here — they really delete (deleteCustomPalette). "Select all" clears it, which is the
  // recovery path. At least ONE palette must stay alive overall.
  let palGone = new Set();
  const palInUse = i => !palGone.has(i) && (!palUse || palUse.has(i));
  const palAliveCount = () => PALETTES.length - palGone.size;
  // DISPLAY order only: the strip, the picker and the hidden <select> list palettes by name.
  // PALETTES itself never moves — indices are the wire format, so sorting the array would
  // silently repoint every saved scene, share link and backup at a different ramp. Everything
  // downstream keeps using the real index; only the order they are appended in changes.
  const palByName = () => PALETTES.map((_, i) => i)
    .sort((a, b) => PALETTES[a].name.localeCompare(PALETTES[b].name) || a - b);
  // Where a reference to palette `gone` should land when it is deleted.
  //
  // Walk the DISPLAY order — what the strip actually shows — starting just AFTER `gone` and
  // wrapping, and take the first palette that is IN USE. That is the neighbour you were
  // looking at, not whatever happens to sit at index 0. If nothing else is in use, take the
  // first that is merely ALIVE.
  //
  // A TOMBSTONED palette is NEVER returned, and that is the whole point: the first version of
  // this fell through to `PALETTES[0]` when nothing was in use, so deleting Fire and then
  // deleting the palette you were on landed straight back on Fire — a palette you had already
  // deleted and which the strip no longer shows. The one-alive-palette floor (enforced by
  // every caller before it deletes) guarantees there is something left to return.
  //
  // Returns a PRE-splice index — a caller that removes the entry must shift a result above
  // `gone` down by one before storing it (palRemapOne writes `back` verbatim).
  function palFallbackFor(gone) {
    const order = palByName(), at = order.indexOf(gone), ring = [];
    for (let k = 1; k <= order.length; k++) ring.push(order[(at + k) % order.length]);
    for (const i of ring) if (i !== gone && palInUse(i)) return i;
    for (const i of ring) if (i !== gone && !palGone.has(i)) return i;
    return gone;                            // unreachable while one palette must stay alive
  }
  // Deleting can empty the in-use set — you narrowed it to the very palette you just deleted.
  // The landing palette then joins the set, so the strip never goes empty and the cycle always
  // has somewhere to go: the same "never leave it empty" rule setPalUse follows.
  function palKeepInUse(i) {
    if (palUse && !palGone.has(i) && !palUse.has(i)) palUse.add(i);
  }
  function palGoneOk(v) {                   // validate a stored tombstone list
    const s = new Set();
    if (!Array.isArray(v)) return s;
    for (const n of v) if (Number.isInteger(n) && n >= 0 && n < PAL_BUILTIN) s.add(n);
    return s;
  }
  function palUseOk(v) {                    // validate a stored list
    if (!Array.isArray(v)) return null;
    const s = new Set();
    for (const n of v) if (Number.isInteger(n) && n >= 0 && n < PALETTES.length) s.add(n);
    return s.size ? s : null;               // empty ⇒ treat as "all", never as "none"
  }
  function pickOther(cur) {                 // random IN-USE palette index != cur
    const pool = [];
    for (let i = 0; i < PALETTES.length; i++) if (i !== cur && palInUse(i)) pool.push(i);
    if (!pool.length) return cur;           // one palette in use ⇒ stay on it (a pinned cycle)
    return pool[(Math.random() * pool.length) | 0];
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
