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
      palettes: customPalettes(),                    // user-authored ramps ({name, stops}); [] when there are none
      palUse: palUse ? [...palUse].sort((a, b) => a - b) : null,   // which ramps the strip shows / the cycle picks (null ⇒ all)
      transUse: transUse ? [...transUse] : null,     // which transitions a scene change picks from (null ⇒ all)
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
    // Custom palettes BEFORE anything that reads a palette value. They are referenced by
    // index (PAL_BUILTIN and up), so a scene naming custom #21 needs #21 to exist by the time
    // its palette is validated — installing them later would silently reject every custom
    // reference and fall back to a built-in. `customPalettesOk` drops malformed entries
    // rather than letting a bad stop list reach grad(). A blob with no `palettes` key (every
    // scene saved before the editor existed) leaves the list untouched.
    if (saved.palettes !== undefined) {
      installCustomPalettes(customPalettesOk(saved.palettes));
      buildPalSwatches();                          // regenerate the swatch grid + <select> options
    }
    // ...and the in-use set AFTER them, since it validates indices against PALETTES.length.
    // Absent (every blob predating the picker) ⇒ null ⇒ all in use, so nothing changes.
    // Skipped while `sharing`: which ramps you keep in your strip is your own preference,
    // the same class as auto-cycle and the TTL, not part of the scene you were sent.
    if (!sharing && saved.palUse !== undefined) { palUse = palUseOk(saved.palUse); buildPalSwatches(); }
    // Same class as palUse and auto-cycle: the recipient's own preference, so it is skipped
    // while `sharing`. Absent (every blob predating the picker) ⇒ null ⇒ all in use.
    if (!sharing && saved.transUse !== undefined) transUse = transUseOk(saved.transUse);
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
      writeSceneFx({ on, vals });   // lift the selected effect's scene-filters; none ⇒ no scene filters (all off)
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
    } else {
      // NO `layers` ⇒ a single-layer scene, and mergeLayers never runs — so nothing ever
      // read the filter list back and every reload silently unticked Fire / Fade / the
      // image filters while the blob still held them. (Multi-layer scenes were fine: their
      // items carry `filters` and go through mergeLayers, which is why this only bit once
      // you were down to one layer.)
      //
      // The item's `filters` is given a CONCRETE value here, which is what the comment in
      // layerFeedbackChain means by "old-scene compat is handled at load in mergeLayers":
      // `applyLayerExtras` must keep falling back to the DESCRIPTOR default rather than the
      // runtime `extras[L.fx]`, because that fallback is what made every not-yet-captured
      // same-effect layer mirror the last one edited. So the value has to be in place
      // BEFORE it is read, not discovered afterwards.
      //
      // Setting the live `activeIds` instead does NOT work, and the reason is worth
      // recording: `stackOut()` returns null the moment the stack holds one item, so it
      // never freezes and persist() never captures the live set into `L.filters` — the
      // restored `activeIds` is simply overwritten by applyLayerExtras a moment later.
      // Nothing clobbers `L.filters` for a one-item stack, for exactly the same reason.
      const e = Number.isInteger(saved.effect) && EFFECTS[saved.effect] ? saved.effect : 0;
      const fset = filtersOk(extras[e] && extras[e].filters);
      // Written in registry order, like every other stored list, so reordering FILTERS
      // cannot remap a saved scene.
      if (fset && stack.length === 1) stack[0].filters = FILTERS.filter(f => fset.has(f.id)).map(f => f.id);
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
    sceneOn = new Set();     // same reason: a shared scene omitting sceneFx must not inherit the recipient's Scene filters
    // Same reason as the five above: a shared scene with no `layers` must land as ONE
    // item, not inherit whatever stack the recipient happened to have built.
    installStack([newStackItem(0)]);
    applyBlob(d, true);
    curPreset = -1;                  // a shared scene isn't one of your saved presets
    // ...and the chooser has to say so. Without this it keeps displaying whichever preset
    // startup had selected, so a shared link looks like it loaded YOUR preset of that name.
    // Harmless to the data (autosavePreset early-returns while curPreset < 0) and purely
    // misleading, which is exactly the kind of thing nobody reports and everybody misreads.
    if (typeof presetSel !== "undefined" && presetSel) presetSel.value = "-1";
    return true;
  }
  // ?z= (deflated) or ?s= (legacy, uncompressed) — a single SCENE, never the presets.
  // #zp=/#sp= are the PRESET-BUNDLE links (a curated preset library), checked first and
  // mutually exclusive with the scene params. All are mutually exclusive by construction —
  // a share URL carries one.
  function applyShared() {
    const parse = json => { try { return JSON.parse(json); } catch (e) { return null; } };
    // Preset-bundle links → openSharedLibrary → the Restore dialog (merge/replace). That
    // function lives in a LATER slice (persist-backup-restore) and applyShared() runs during
    // THIS slice's load, before that one — so its state is still in the temporal dead zone.
    // The async unzip .then already lands after every slice has run; the sync #sp= path MUST
    // be deferred the same way (a microtask) or openSharedLibrary throws. Same trap as card/beatUi.
    //
    // The bundle rides in the FRAGMENT (location.hash), never the query: several KB of ?query
    // makes GitHub Pages / Fastly reject the link with 414 URI Too Long before any JS runs,
    // whereas the fragment is never sent to the server. Read the hash first, then the query
    // so the earlier ?zp=/?sp= links still decode.
    const bundle = re => (location.hash.match(re) || location.search.match(re));
    const zp = bundle(/[?&#]zp=([^?&#]+)/);
    const sp = zp ? null : bundle(/[?&#]sp=([^?&#]+)/);
    if (zp || sp) {
      try { history.replaceState(null, "", location.pathname); } catch (e) {}   // clear query AND fragment
      if (sp) { Promise.resolve().then(() => openSharedLibrary(parse(atobSafe(sp[1])))); return; }
      unzipFromB64(zp[1]).then(json => openSharedLibrary(parse(json)));
      return;
    }
    // #c=<id> — a scene stored in Firestore (see cloudShareScene). Same payload as ?z=, just
    // fetched instead of carried, so it lands through installShared exactly like one.
    // DEFERRED for the same reason #sp= is: cloudFetchScene lives in a much later slice whose
    // `CLOUD` const is still in the temporal dead zone while this slice is loading. The fetch
    // is anonymous — a share link has to open for someone with no account.
    const c = (location.hash.match(/[?&#]c=([A-Za-z0-9_-]+)/) || location.search.match(/[?&]c=([A-Za-z0-9_-]+)/));
    if (c) {
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
      Promise.resolve().then(() => cloudFetchScene(c[1])).then(json => {
        if (!json || !installShared(parse(json))) return;
        resize();
        setEffect(+effectSel.value, false);
      });
      return;
    }
    const z = location.search.match(/[?&]z=([^&#]+)/);
    const m = z ? null : location.search.match(/[?&]s=([^&#]+)/);
    if (!z && !m) return;
    stripShareParam();
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
  // First-visit scene defaults from CONFIG (auto-cycle, Preset TTL, Transition). A saved scene
  // overrides these in restore() below — this only sets what a brand-new visitor sees. Dispatching
  // input mirrors restore()'s own ttl handling so the dual-slider fills follow; persist isn't armed
  // yet, so it's inert. (These are the DOM defaults that used to be hard-coded in the template.)
  el("cycle").checked = cycleOn;
  el("ttl-lo").value = CONFIG.scene.ttl[0]; el("ttl-hi").value = CONFIG.scene.ttl[1];
  el("tdur-lo").value = CONFIG.scene.transition[0]; el("tdur-hi").value = CONFIG.scene.transition[1];
  ["ttl-lo", "ttl-hi", "tdur-lo", "tdur-hi"].forEach(id => el(id).dispatchEvent(new Event("input")));
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

