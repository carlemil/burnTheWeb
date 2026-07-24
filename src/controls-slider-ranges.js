  // ---- custom slider ranges (min/max/step) — persisted, shared and backed up ----
  // The sliders' bounds ship as HTML attributes; capture them once, pristine, so we
  // can store only the ones the user actually retunes (and let a changed shipped
  // default flow through to sliders they never touched). This must run before the
  // first applyBlob() (restore/share) below, which applies saved ranges via RNG_ORIG.
  const RNG_ORIG = {};        // element id -> {min,max,step} as shipped
  panel.querySelectorAll("input[type=range]").forEach(inp => {
    if (inp.closest("#diag") || inp.closest("#beatDetails")) return;   // dev tools / beat tuning aren't scene ranges
    if (inp.closest(".plen")) return;   // nor the per-slider pulse-length knobs (fixed bounds)
    RNG_ORIG[inp.id] = { min: inp.min, max: inp.max, step: inp.step };
  });
  // A slider's BOUNDS are per-LAYER exactly when the slider itself is (effect params, incl.
  // zoom) and scene-wide otherwise (camera rotation, palette cycle, banding, TTL, scene
  // filters) — the same split as isSceneCtl / the value store, so a custom bound stays with
  // the exact layer + effect + slider it tunes instead of being shared across every layer.
  function rangeIsLayer(id) {
    const c = CONTROLS.find(x => x.key === id.replace(/-(lo|hi)$/, ""));
    return !!c && !isSceneCtl(c);
  }
  function rangesDiffering(want) {         // { id: {min,max,step} } for bounds ≠ shipped, filtered by want(id)
    const out = {};
    for (const id in RNG_ORIG) {
      if (!want(id)) continue;
      const inp = el(id), o = RNG_ORIG[id];
      if (inp && (inp.min !== o.min || inp.max !== o.max || inp.step !== o.step))
        out[id] = { min: inp.min, max: inp.max, step: inp.step };
    }
    return out;
  }
  function collectRanges() { return rangesDiffering(id => !rangeIsLayer(id)); }   // scene-wide bounds only (per-layer ones ride on the stack item)
  function collectLayerRanges() { return rangesDiffering(rangeIsLayer); }         // this layer's custom bounds
  function layerRangesOf(r) {              // the per-layer-slider entries of a scene-wide ranges map (old-scene migration)
    const out = {};
    if (r && typeof r === "object") for (const id in r) if (rangeIsLayer(id)) out[id] = r[id];
    return out;
  }
  // The top-level `ranges` for a blob/preset: scene-wide bounds always, PLUS the sole layer's
  // per-layer bounds when the stack holds one item (stackOut emits no `layers` then, so they
  // would otherwise be lost — the same "single layer stores its per-layer bits at the top" rule
  // as palette/filters). Multi-layer stacks carry each layer's bounds in layers[].ranges.
  function sceneRanges() { return stack.length <= 1 ? { ...collectRanges(), ...collectLayerRanges() } : collectRanges(); }
  // Each pop-out box's range editor registers a sync fn here, so bounds loaded from
  // a blob (restore / share link) show up in the fields. Declared beside applyRanges
  // because applyRanges calls it, and applyBlob can run before the boxes are built.
  const rngSyncs = [];
  function rngSyncAll() { rngSyncs.forEach(f => f()); }
  // Put one slider back the way it ships for the CURRENT effect: bounds, value,
  // beat chips, pulse shape and pulse length. The box's ↺ used to restore only the
  // range, which left a slider you had wandered off into a strange place still
  // strange. Bounds go first, so the value below validates against them.
  // A control's shipped default straight from the CONTROLS schema — the source of truth
  // for sliders no effect's `defaults` mentions. Dual sliders carry lo/hi, plain ones a
  // single `value`; checkboxes have neither and reset elsewhere.
  function ctlDefault(key) {
    const c = CONTROLS.find(x => x.key === key);
    if (!c) return undefined;
    if (c.type === "dual") return [c.lo, c.hi];
    if (c.type === "plain") return c.value;
    return undefined;
  }
  function resetControl(key) {
    const els = ctlRangeInputs(key);
    for (const inp of els) {
      const o = RNG_ORIG[inp.id]; if (!o) continue;
      inp.min = o.min; inp.max = o.max; inp.step = o.step;
    }
    // presetState merges the filter + camera defaults, so their params reset too — but it
    // only knows keys the effect declares in `defaults` (plus those merged-in sets), and some
    // on-screen sliders are none of those. Fall back to the shipped default from the CONTROLS
    // schema, which every slider has by construction. (The camera was the case that bit here:
    // camrx/camry/camrz sit in most effects' `params` but not their `defaults`; presetState now
    // seeds them to [0,0] as per-layer state, so st[key] resolves — the fallback still covers
    // any other params-but-not-defaults slider.)
    const st = presetState(effect);
    const v = st[key] !== undefined ? st[key] : ctlDefault(key);
    if (Array.isArray(v)) {
      const lo = el(key + "-lo"), hi = el(key + "-hi");
      if (lo && hi) { lo.value = v[0]; hi.value = v[1]; }
    } else if (v !== undefined && el(key)) {
      el(key).value = v;
    }
    const b = presetBeat(effect)[key];
    if (b && beatReact[key]) {
      for (const band of ["low", "mid", "high"]) beatReact[key][band] = !!b[band];
      syncChips();
    }
    const ps = presetPulse(effect)[key];
    if (ps && pulseShape[key] !== undefined) { pulseShape[key] = ps; syncPulse(); }
    const pl = presetPlen(effect)[key];
    if (pl !== undefined && pulseLen[key] !== undefined) { pulseLen[key] = pl; syncPlen(); }
    // Re-dispatch so the fill, the readout and the effect all follow, and the
    // delegated onEdit persists it (and autosaves into the selected preset).
    for (const inp of els) inp.dispatchEvent(new Event("input", { bubbles: true }));
    persist();
  }
  // Set custom bounds onto the slider elements (validated). Restores every slider to its
  // shipped bounds first, so this is a REPLACE, not a merge: `r` is always the complete
  // set of non-default bounds (collectRanges only stores what differs), and switching to
  // a preset that widened nothing must narrow the previous preset's widening back.
  function applyRangesFor(r, want) {      // reset the wanted sliders to shipped, then apply r's bounds for them
    for (const id in RNG_ORIG) {
      if (!want(id)) continue;
      const inp = el(id), o = RNG_ORIG[id];
      if (inp) { inp.min = o.min; inp.max = o.max; inp.step = o.step; }
    }
    if (r && typeof r === "object") for (const id in r) {
      if (!want(id)) continue;
      const inp = el(id), o = RNG_ORIG[id], v = r[id]; if (!inp || !o || !v) continue;
      const mn = +v.min, mx = +v.max;
      if (!isFinite(mn) || !isFinite(mx) || mx <= mn) continue;
      inp.min = String(mn); inp.max = String(mx);
      // Honour a saved step; a blob that omits it (older ones, and every non-stepped
      // scene) keeps the shipped step set in the reset loop above. A saved 0 means the
      // author made the slider continuous, so it overrides a shipped integer step.
      if (v.step !== undefined) { const sp = +v.step; inp.step = isFinite(sp) && sp > 0 ? String(sp) : "any"; }
    }
    rngSyncAll();                         // the in-box min/max/step fields follow
  }
  function applyRanges(r) { applyRangesFor(r, id => !rangeIsLayer(id)); }   // scene-wide bounds (a REPLACE — see the old note)
  function applyLayerRanges(r) { applyRangesFor(r, rangeIsLayer); }         // one layer's per-layer-slider bounds
  // After bounds change mid-session, re-clamp stray values and re-run each slider's
  // fill/readout by re-dispatching input (bindRange's ui() reads min/max live).
  // Every scene range slider, whether docked in the menu or popped into #breakout.
  function sceneRangeInputs() {
    const b = document.getElementById("breakout");
    return [...panel.querySelectorAll("input[type=range]"), ...(b ? b.querySelectorAll("input[type=range]") : [])];
  }
  function refreshRangeUI() {
    sceneRangeInputs().forEach(inp => {
      // The beat-tuning sliders have no ids and fixed bounds — re-dispatching on them
      // would fire their handlers (and another persist) for no gain.
      if (inp.closest("#diag") || inp.closest("#beatDetails")) return;
      const c = Math.min(+inp.max, Math.max(+inp.min, +inp.value));
      if (c !== +inp.value) inp.value = String(c);
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

