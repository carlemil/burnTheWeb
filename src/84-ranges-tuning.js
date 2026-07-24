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

  // ---- beat-detection tuning — per-preset scene data (localStorage, Backup, Share
  // and every preset). A snapshot of the live beatCfg, validated field by field.
  function collectBeatTune() {
    return { fluxK: beatCfg.fluxK.slice(), floor: beatCfg.floor,
             refract: beatCfg.refract.slice(), bands: beatCfg.bands.map(b => b.slice()) };
  }
  // REPLACE semantics, deliberately: build a fresh tuning from BEAT_DEFAULTS and overlay
  // only the fields the saved object actually supplies. The obvious alternative —
  // merging into the live beatCfg — leaks the previously selected preset's tuning into
  // any preset that omits a field, which for a preset saved before this feature is
  // every field. Mirrors mergeState/mergeBeat/mergePulse/mergePlen, which all start
  // from the descriptor's defaults for the same reason.
  function mergeBeatTune(saved) {
    const base = { fluxK: BEAT_DEFAULTS.fluxK.slice(), floor: BEAT_DEFAULTS.floor,
                   refract: BEAT_DEFAULTS.refract.slice(), bands: BEAT_DEFAULTS.bands.map(b => b.slice()) };
    if (!saved || typeof saved !== "object") return base;
    const nyq = 24000;   // half of a typical 48k rate; band edges must stay below it
    if (Array.isArray(saved.fluxK)) for (let b = 0; b < 3; b++)
      if (isFinite(+saved.fluxK[b]) && +saved.fluxK[b] > 0) base.fluxK[b] = +saved.fluxK[b];
    if (isFinite(+saved.floor) && +saved.floor >= 0 && +saved.floor <= 1) base.floor = +saved.floor;
    if (Array.isArray(saved.refract)) for (let b = 0; b < 3; b++)
      if (isFinite(+saved.refract[b]) && +saved.refract[b] >= 0) base.refract[b] = +saved.refract[b];
    if (Array.isArray(saved.bands)) for (let b = 0; b < 3; b++) {
      const e = saved.bands[b];
      if (!Array.isArray(e)) continue;        // a short/sparse array would throw on e[0]
      const lo = +e[0], hi = +e[1];
      if (isFinite(lo) && isFinite(hi) && lo >= 1 && hi > lo && hi <= nyq) base.bands[b] = [lo, hi];
    }
    return base;
  }
  // Write a validated tuning into the live detector. beatCfg's FIELDS are replaced but
  // the object identity is kept — audioTick closes over it, and tools/beatprobe.js
  // slices it straight out of the constants block.
  function installBeatTune(t) {
    beatCfg.fluxK = t.fluxK.slice(); beatCfg.floor = t.floor;
    beatCfg.refract = t.refract.slice(); beatCfg.bands = t.bands.map(b => b.slice());
    if (beatUi && beatUi.wired) beatBuild();   // the sliders never refresh themselves
    if (audio.on) computeBins();               // computeBins throws before audio starts
  }
  function applyBeatTune(t) { if (t) installBeatTune(mergeBeatTune(t)); }

  const STORE_KEY = "burnTheWeb.v1";
  // App version stamped into exported files (Backup) so you can tell which build wrote them.
  // Calendar-versioned (YYYY.MM.DD); bump it on a notable change or release. Distinct from the
  // per-file `version` field, which is the file-format schema version (still 1).
  const APP_VERSION = "2026.07.22";
  let persistReady = false, suppressPersist = false;
  // The single source of truth for "everything the user can change and we remember":
  // both localStorage (persist) and the Backup file are this exact object, so a new
  // saved setting can never end up in one but not the other. Anything NOT here is
  // deliberately transient (pause, fullscreen, the dev overlays) — see the Backup docs.
  function fullSnapshot() {
    saveState(effect);                // fold the live sliders into the current effect
    saveBeat(effect);                 // ...the live beat toggles
    savePulse(effect);                // ...the live beat-pulse shapes
    savePlen(effect);                 // ...their lengths
    saveExtra(effect);                // ...and palette/morph/show-box/TTL
    return {
      states, beats: beatStates, pulses: pulseStates, plens: plenStates, extras, effect,
      layers: stackOut(),                            // the live stack (null ⇒ one item, omitted); each item carries its own `cam`
      sceneFx: readSceneFx(),                        // the scene-global Scene filters (on/off + values)
      ranges: sceneRanges(),                       // custom slider min/max/step (only what differs)
      beatTune: collectBeatTune(),                   // live detector thresholds (localStorage + Backup only)
      presets, curPreset,
      cycle: cycleChk.checked,                       // auto-cycle presets (global)
      ttl: [+el("ttl-lo").value, +el("ttl-hi").value],  // preset TTL (global, not per-effect)
      tdur: [+el("tdur-lo").value, +el("tdur-hi").value],   // transition length (ditto)
      scale: cfg.scale,                              // render resolution (global)
      panelOpen: !panel.classList.contains("hidden"),
      audio: audio.on ? audio.src : null,            // last live source, to re-arm on reload
    };
  }
  function persist() {
    if (!persistReady || suppressPersist) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(serializeBlob(fullSnapshot()))); }
    catch (e) { /* storage full / disabled — ignore */ }
  }
  // Apply a settings blob (from localStorage or a shared URL). `sharing` skips the
  // browser-local bits (saved presets, panel state) so a shared link only carries
  // the settings themselves.
  function applyBlob(saved, sharing) {
    if (!saved) return;
    saved = deserializeBlob(saved);                // stable effect ids (or legacy numbers) → numeric indices
    migrateCam(saved);                             // pre-per-layer scenes: fold the one scene-wide `cam` into every layer/effect state
    if (saved.ranges) applyRanges(saved.ranges);   // custom bounds first, so states below validate against them
    if (saved.beatTune) applyBeatTune(saved.beatTune);   // detector thresholds (localStorage/Backup; absent in Share links)
    const ok = (id, x) => { const mn = +el(id).min, mx = +el(id).max; return typeof x === "number" && x >= mn && x <= mx; };
    if (saved.states) {
      for (const k in states) {
        const ss = saved.states[k]; if (!ss) continue;
        for (const id in states[k]) {
          const v = ss[id]; if (v === undefined) continue;
          if (Array.isArray(states[k][id])) {                 // ranged: both thumbs in bounds
            if (Array.isArray(v) && ok(id + "-lo", v[0]) && ok(id + "-lo", v[1])) states[k][id] = [v[0], v[1]];
          } else if (ok(id, v)) states[k][id] = v;             // simple: in bounds
        }
      }
    }
    if (saved.beats) {
      for (const k in beatStates) {
        const bs = saved.beats[k]; if (!bs) continue;
        for (const id in beatStates[k]) {
          const b = bs[id]; if (!b) continue;
          for (const band of ["low", "mid", "high"]) if (typeof b[band] === "boolean") beatStates[k][id][band] = b[band];
        }
      }
    }
    if (saved.pulses) {                 // per-effect beat-pulse shapes (a blob may carry only non-default ids)
      for (const k in pulseStates) {
        const ps = saved.pulses[k]; if (!ps) continue;
        for (const id in pulseStates[k]) {
          const v = ps[id]; if (typeof v === "string" && PULSE_FN[v]) pulseStates[k][id] = v;
        }
      }
    }
    // Camera is per-layer state now: it rides in saved.states / saved.layers (applied above /
    // by installStack). A pre-per-layer scene's scene-wide `cam` was folded in by migrateCam.
    if (saved.sceneFx) writeSceneFx(sceneFxOk(saved.sceneFx));   // scene-global Scene filters (on/off + values)
    else {   // pre-feature blob: Scene filters lived per-effect — lift the selected effect's onto the global set
      const e = Number.isInteger(saved.effect) ? saved.effect : 0;
      const src = (Array.isArray(saved.layers) && saved.layers[0] && saved.layers[0].filters)
        || (saved.extras && saved.extras[e] && saved.extras[e].filters);
      const fset = filtersOk(src);
      const on = fset ? [...fset].filter(isSceneFilter) : [];
      const st = (saved.states && saved.states[e]) || {};
      const vals = {};
      for (const k of SCENE_FILTER_KEYS) if (Array.isArray(st[k])) vals[k] = st[k];
      writeSceneFx({ on: on.length ? on : ["bloom"], vals });   // default to bloom on (the old unconditional glow)
    }
    if (saved.plens) {                  // ...and their lengths (absent in pre-feature blobs → PULSE_DROP)
      for (const k in plenStates) {
        const ps = saved.plens[k]; if (!ps) continue;
        for (const id in plenStates[k]) if (plenOk(ps[id])) plenStates[k][id] = ps[id];
      }
    }
    // Per-effect extras (palette / morph / show-box / TTL). Migrate a legacy blob
    // that stored these once at the root into every effect's extras.
    const legacy = saved.extras ? null : saved;
    const paletteOK = p => typeof p === "string" && paletteSel.querySelector('option[value="' + p + '"]');
    for (const k in extras) {
      const ex = saved.extras ? saved.extras[k] : legacy; if (!ex) continue;
      if (paletteOK(ex.palette)) extras[k].palette = ex.palette;
      const fok = filtersOk(ex.filters);          // absent in pre-filter blobs ⇒ keep the default
      if (fok) extras[k].filters = FILTERS.filter(f => fok.has(f.id)).map(f => f.id);
      if (typeof ex.morph === "boolean") extras[k].morph = ex.morph;
      if (typeof ex.showBox === "boolean") extras[k].showBox = ex.showBox;
      if (typeof ex.randSeed === "boolean") extras[k].randSeed = ex.randSeed;
    }
    if (typeof saved.cycle === "boolean") { cycleChk.checked = saved.cycle; cycleOn = saved.cycle; }
    // Preset TTL is a global setting (like auto-cycle), not per-effect. Migrate a legacy
    // per-effect ttl (once stored in extras) so old blobs still land on a sensible value.
    const savedTtl = saved.ttl
      || (saved.extras && saved.extras[saved.effect] && saved.extras[saved.effect].ttl)
      || (saved.extras && saved.extras["0"] && saved.extras["0"].ttl);
    if (Array.isArray(savedTtl) && ok("ttl-lo", savedTtl[0]) && ok("ttl-lo", savedTtl[1])) {
      el("ttl-lo").value = savedTtl[0]; el("ttl-hi").value = savedTtl[1];
      el("ttl-lo").dispatchEvent(new Event("input")); el("ttl-hi").dispatchEvent(new Event("input"));
    }
    // Transition length, same treatment: global, absent in pre-feature blobs ⇒ shipped.
    if (Array.isArray(saved.tdur) && ok("tdur-lo", saved.tdur[0]) && ok("tdur-lo", saved.tdur[1])) {
      el("tdur-lo").value = saved.tdur[0]; el("tdur-hi").value = saved.tdur[1];
      el("tdur-lo").dispatchEvent(new Event("input")); el("tdur-hi").dispatchEvent(new Event("input"));
    }
    if ([1, 1.5, 2, 3, 4].includes(saved.scale)) { cfg.scale = saved.scale; resSel.value = String(saved.scale); }
    if (Number.isInteger(saved.effect) && EFFECTS[saved.effect]) effectSel.value = saved.effect;
    // The stack, AFTER the states above: installStack thaws item 0 into states[...], so
    // running it earlier would have the per-effect restore overwrite the item's values.
    // A blob with no `layers` leaves the single default item alone — which is every blob
    // written before this feature, and every non-stacked one written after it.
    if (Array.isArray(saved.layers) && saved.layers.length) {
      installStack(mergeLayers(saved));
      effectSel.value = stack[0].fx;
    }
    if (!sharing) {   // browser-local: saved presets + panel visibility
      if (Array.isArray(saved.presets)) presets = saved.presets.filter(p => p && EFFECTS[p.effect] && p.state && p.beat && p.extra);
      curPreset = (Number.isInteger(saved.curPreset) && saved.curPreset >= 0 && saved.curPreset < presets.length) ? saved.curPreset : -1;
      if (typeof saved.panelOpen === "boolean") panel.classList.toggle("hidden", !saved.panelOpen);
      if (saved.audio === "capture" || saved.audio === "mic") armAudioResume(saved.audio);
    }
  }
  function restore() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { saved = null; }
    applyBlob(saved, false);
  }
  // Drop the payload from the address bar. Runs even when decode FAILS, so a
  // corrupt link doesn't stick around and get retried on every reload.
  function stripShareParam() {
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
  }
  // Install a decoded share blob. **Re-seeding first is load-bearing**: restore()
  // has already loaded the recipient's own scene into these maps, and applyBlob
  // SKIPS every key a blob omits — so without this, anything the sender left at a
  // default would silently inherit the recipient's value instead. The pruned
  // beats/pulses/plens maps omit defaults by design, so that bled through for
  // anyone who had used the app before (it looked perfect in a fresh browser).
  function installShared(d) {
    if (!d) return false;
    initStates(); initBeatStates(); initPulseStates(); initPlenStates(); initExtras();
    sceneOn = new Set(["bloom"]);     // same reason: a shared scene omitting sceneFx must not inherit the recipient's Scene filters
    // Same reason as the five above: a shared scene with no `layers` must land as ONE
    // item, not inherit whatever stack the recipient happened to have built.
    installStack([newStackItem(0)]);
    applyBlob(d, true);
    curPreset = -1;                  // a shared scene isn't one of your saved presets
    return true;
  }
  // ?z= (deflated) or ?s= (legacy, uncompressed) — the settings, never the presets.
  // ?z= wins if both are somehow present; they are mutually exclusive by construction.
  function applyShared() {
    const z = location.search.match(/[?&]z=([^&#]+)/);
    const m = z ? null : location.search.match(/[?&]s=([^&#]+)/);
    if (!z && !m) return;
    stripShareParam();
    const parse = json => { try { return JSON.parse(json); } catch (e) { return null; } };
    if (m) { installShared(parse(atobSafe(m[1]))); return; }
    // The compressed path is async, so it lands after the startup below has already
    // run setEffect() on the recipient's own scene — re-activate once it arrives.
    unzipFromB64(z[1]).then(json => {
      if (!json || !installShared(parse(json))) return;
      resize();
      stageLayerExtras(stack[stackSel]);
      setEffect(+effectSel.value, false);
      applyLayerExtras(stack[stackSel]);   // the shared scene's selected-layer palette + filters
    });
  }
  function atobSafe(s) { try { return decodeURIComponent(escape(atob(s))); } catch (e) { return ""; } }
  restore();
  applyShared();
  resize();          // re-apply the restored render resolution (cfg.scale)

  // `enter` = this is a *fresh* entry into the effect (first load, an effect switch, a preset
  // apply) — run its onEnter (AnimeJulia re-rolls its random seed start) and drop banked sim
  // time. Merely RE-SELECTING an existing stack layer to edit it passes enter=false: the
  // layer keeps running exactly as it was, so selecting a layer never changes the render.
  function setEffect(i, save = true, enter = true) {
    if (save && i !== effect && states[effect]) { saveState(effect); saveBeat(effect); savePulse(effect); savePlen(effect); saveExtra(effect); }  // remember outgoing
    effect = i;
    // `effect` is the SELECTED stack item's effect — the one the menu edits. Every
    // editor-side use of it (shownKeys, refreshBreakout, resetControl, ctlOwner, the
    // cardioid button) keeps its exact meaning; only the render path reads
    // the stack. Assigned in this one place, so the two cannot drift apart.
    stack[stackSel].fx = i;
    effectSel.value = i;              // the chooser follows, so selecting a layer shows its effect
    syncStackUI();                    // the selected row's name follows the chooser
    const fx = EFFECTS[i];
    sub.textContent = fx.subtitle;
    juliaPower = 2;                   // Multibrot's draw overrides this every frame
    dockAll();                        // new scene ⇒ empty pop-out column (see Break-out boxes)
    // show only the controls this effect declares (rendered from the CONTROLS schema)
    refreshControlVisibility();       // effect params + the ticked filters' params
    // The Orbit editor only means anything for a Mandelbrot-seeded (cardioid) effect. It is a
    // single, scene-wide sticky panel: `cardWanted` is the user's intent (button opens it, X /
    // Esc close it), and every setEffect shows it iff the selected effect is cardioid AND wanted.
    // So it stays open as you jump between cardioid layers (showing each layer's orbit) and
    // auto-hides on a non-cardioid layer, re-appearing when you return to a cardioid one.
    el("cardbtn").style.display = fx.cardioid ? "" : "none";
    cardOpen(!!fx.cardioid && cardWanted);
    applyLayerRanges(stack[stackSel].ranges);   // this layer's custom slider bounds — BEFORE loadState, so its values validate against them
    loadState(i);                     // restore this effect's remembered sliders
    loadBeat(i);                      // ...its beat-toggle selection
    loadPulse(i);                     // ...its per-slider beat-pulse shapes
    loadPlen(i);                      // ...and their lengths
    loadExtra(i);                     // ...and palette/morph/show-box/random-seed/TTL
    if (enter && fx.onEnter) fx.onEnter();      // e.g. AnimeJulia re-rolls its start on entry — but NOT on a layer re-select
    if (enter) acc = 0;               // don't carry banked sim time across a switch (kept on a re-select)
    // The heat buffer is deliberately NOT cleared here. Leaving the outgoing effect's
    // heat in place lets it decay under the incoming scene instead of the screen
    // blinking to black — the switch becomes a dissolve, which matters most on
    // auto-cycle where it happens on its own every few seconds.
    //
    // It only *reads* as a fade when the incoming scene has a feedback filter (Fire or
    // Fade pixel) to decay it. With none, `applyFilters`/`glBeginHeat` rewrite the whole
    // buffer on the first frame anyway, so the old image is gone immediately — that is
    // the clean-slate contract those paths already have, not a regression here.
    persist();
  }

