  // ---- presets: named full-scene snapshots (effect + all its settings) ----
  function snapshotScene() {
    saveState(effect); saveBeat(effect); savePulse(effect); savePlen(effect); saveExtra(effect);
    return {
      effect,
      state: JSON.parse(JSON.stringify(states[effect])),
      beat: JSON.parse(JSON.stringify(beatStates[effect])),
      pulse: JSON.parse(JSON.stringify(pulseStates[effect])),
      plen: JSON.parse(JSON.stringify(plenStates[effect])),
      // beatTune + ranges are globals, remembered per preset so a scene is a COMPLETE copy of
      // what is on screen — the point of the exercise, since a preset is now something you hand
      // to someone else. beatTune: different thresholds mean different beats mean a different
      // animation. ranges: a value outside the recipient's slider bounds is silently clamped by
      // the DOM, so a preset authored with a widened bound would quietly animate differently.
      // The camera is NOT a preset-root field: it is per-layer state, riding inline in this
      // top-level `state` (the single/selected effect) and in each layer's own `cam` node.
      sceneFx: readSceneFx(),         // the scene-global Scene filters travel with the preset
      beatTune: collectBeatTune(),
      ranges: sceneRanges(),
      extra: JSON.parse(JSON.stringify(extras[effect])),
      // Null (and dropped by JSON) whenever the stack holds one item, so a non-stacked
      // preset is exactly the shape it has always been.
      layers: stackOut(),
    };
  }
  function defaultPresets() {
    return EFFECTS.map((f, e) => ({ name: f.presetName || f.name, effect: e, state: presetState(e), beat: presetBeat(e), pulse: presetPulse(e), plen: presetPlen(e), extra: presetExtra(e), beatTune: mergeBeatTune(null), ranges: {} }));
  }
  // The scene a first-time visitor sees: a three-layer stack (two Multibrot fractals
  // behind a bouncing tetrahedron), authored in the app and exported as a preset. Stored
  // in the wire format (effect ids, not indices) and pruned to its deltas — applyPreset
  // re-merges every map onto the effect defaults, so the omitted keys cost nothing. Only
  // beat/pulse/plen are pruned (their defaults are universal); state maps are kept whole
  // so nothing can silently drift. Cam and beat-tuning are omitted because they are the
  // shipped defaults here.
  const DEFAULT_SCENE = {"name":"JuliaBgTet","effect":"tetrafyer","state":{"rise":[105,155],"burn":[120,120],"fade":[0.970788043478261,0.989619565217391],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[1.02,1.02],"zfbkeep":[0.94,0.94],"swirl":[2,2],"swirlkeep":[0.94,0.94],"twist":[1.2,1.2],"wedgeseg":[7.6304347826087,7.70652173913043],"wedgerot":[0,0],"glitch":[0.05,0.05],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.7,0.7],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[0.00815217391304348,1.5],"barrel":[0.15,0.15],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"palcycle":[0,0],"palhold":[0,0],"band":[0,0],"bandsize":[1,1],"banddim":[65,65],"speed":[23,60],"zoom":[1,1],"size":[1.5,1.5],"rot":[-5,5],"nod":[17.2,17.2],"nodspd":[1,1],"boxsize":[5,5],"layers":3,"rpm":[0.03,0.15],"ratio":[21.5,21.5],"inrad":[0.03,0.03],"outrad":[1.05,1.05],"phase":[0,0],"points":1923.07692307692},"beat":{"speed":{"low":true,"mid":false,"high":false},"size":{"low":false,"mid":true,"high":false},"rise":{"low":false,"mid":false,"high":true},"bloom":{"low":false,"mid":false,"high":true}},"plen":{"bloom":0.13},"extra":{"palette":"16","morph":false,"showBox":true,"randSeed":true,"filters":["fade","wedge","bloom"]},"ranges":{"outrad-lo":{"min":"1","max":"2","step":"any"},"outrad-hi":{"min":"1","max":"2","step":"any"},"cardx-lo":{"min":"-50","max":"50","step":"1"},"cardx-hi":{"min":"-50","max":"50","step":"1"},"mbexp-lo":{"min":"2","max":"9","step":"any"},"mbexp-hi":{"min":"2","max":"9","step":"any"},"cbcount-lo":{"min":"1","max":"12","step":"1"},"cbcount-hi":{"min":"1","max":"12","step":"1"},"swirl-lo":{"min":"-5","max":"5","step":"any"},"swirl-hi":{"min":"-5","max":"5","step":"any"},"palcycle-lo":{"min":"0","max":"12","step":"any"},"palcycle-hi":{"min":"0","max":"12","step":"any"}},"layers":[{"effect":"multibrot","state":{"rise":[3,14.7771739130435],"burn":[120,120],"fade":[0.989619565217391,0.992309782608696],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[0.998260869565217,0.999565217391304],"zfbkeep":[0.94,0.94],"swirl":[-0.978260869565217,0.978260869565217],"swirlkeep":[0.938505434782609,0.973478260869565],"twist":[1.2,1.2],"wedgeseg":[6.41304347826087,6.41304347826087],"wedgerot":[0,0],"glitch":[0.00543478260869565,0.0190217391304348],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.717391304347826,0.717391304347826],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[1.09239130434783,1.09239130434783],"barrel":[0.15,0.15],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"palcycle":[0,0],"palhold":[0,5.21739130434783],"mbexp":[5.0054347826087,5.0054347826087],"band":[0,0],"bandsize":[1,1],"banddim":[0,0],"zoom":[1,1.24184782608696],"rpm":[0.347826086956522,0.565217391304348],"ratio":[50.3804347826087,56.4728260869565],"inrad":[0.03,0.06],"outrad":[1.05978260869565,1.09782608695652],"phase":[0.00706521739130435,0.0152173913043478],"cardx":[0,0]},"beat":{"phase":{"low":true,"mid":false,"high":false},"swirl":{"low":false,"mid":false,"high":true},"edge":{"low":false,"mid":false,"high":true}},"pulse":{"swirl":"bounce","edge":"ease"},"plen":{"inrad":0.34,"palcycle":3,"swirlkeep":0.46,"edge":1.43},"palette":"17","filters":["fade","zoomfb","wedge","bloom"],"blend":"max","gain":1,"mute":false},{"effect":"multibrot","state":{"rise":[130,130],"burn":[120,120],"fade":[0.94,0.94],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[1,1],"zfbkeep":[0.94,0.94],"swirl":[2,2],"swirlkeep":[0.94,0.94],"twist":[1.2,1.2],"wedgeseg":[7.70652173913043,7.70652173913043],"wedgerot":[0,0],"glitch":[0.05,0.05],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.7,0.7],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[0.35,0.35],"barrel":[0.15,0.15],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"palcycle":[0,0],"palhold":[0,5.8695652173913],"mbexp":[2,4],"band":[0,100],"bandsize":[1,5],"banddim":[0,100],"zoom":[1.12771739130435,1.41304347826087],"rpm":[0.15,0.5],"ratio":[8.5,20.5],"inrad":[0.03,0.1],"outrad":[1.125,1.19565217391304],"phase":[0,0.052],"cardx":[0,0]},"palette":"18","filters":["fade","wedge","bloom"],"blend":"max","gain":0.7,"mute":false},{"effect":"tetrafyer","state":{"rise":[105,155],"burn":[120,120],"fade":[0.970788043478261,0.989619565217391],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[1.02,1.02],"zfbkeep":[0.94,0.94],"swirl":[2,2],"swirlkeep":[0.94,0.94],"twist":[1.2,1.2],"wedgeseg":[7.6304347826087,7.70652173913043],"wedgerot":[0,0],"glitch":[0.05,0.05],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.7,0.7],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[0.00815217391304348,1.5],"barrel":[0.15,0.15],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"palcycle":[0,0],"palhold":[0,0],"band":[0,0],"bandsize":[1,1],"banddim":[65,65],"speed":[23,60],"zoom":[1,1],"size":[1.5,1.5],"rot":[-5,5],"nod":[17.2,17.2],"nodspd":[1,1],"boxsize":[5,5],"layers":3,"rpm":[0.03,0.15],"ratio":[21.5,21.5],"inrad":[0.03,0.03],"outrad":[1.05,1.05],"phase":[0,0],"points":1923.07692307692},"beat":{"speed":{"low":true,"mid":false,"high":false},"size":{"low":false,"mid":true,"high":false},"rise":{"low":false,"mid":false,"high":true},"bloom":{"low":false,"mid":false,"high":true}},"plen":{"bloom":0.13},"palette":"16","filters":["fade","wedge","bloom"],"blend":"max","gain":0.75,"mute":false},{"effect":"copperbars","state":{"rise":[130,130],"burn":[120,120],"fade":[0.94,0.94],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[1.02,1.02],"zfbkeep":[0.94,0.94],"swirl":[2,2],"swirlkeep":[0.94,0.94],"twist":[1.2,1.2],"wedgeseg":[10.0652173913043,10.0652173913043],"wedgerot":[0,0],"glitch":[0.05,0.05],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.7,0.7],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[0.35,0.35],"barrel":[0.15,0.15],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"palcycle":[0,0],"palhold":[0,0],"cbcount":[1,3],"cbspeed":[0.244565217391304,0.423913043478261],"cbwidth":[0.02,0.09],"zoom":[1,1],"band":[0,0],"bandsize":[1,1],"banddim":[0,0]},"beat":{"cbwidth":{"low":true,"mid":false,"high":false}},"plen":{"cbwidth":0.25},"palette":"15","filters":["wedge","bloom"],"blend":"max","gain":0.48,"mute":false}]};
  // Convert it to the in-memory preset shape (numeric top-level effect; layer effect ids
  // are converted later by mergeLayers). Returns null if it names an effect we no longer
  // ship, in which case the first visit just falls back to the per-effect defaults.
  function defaultScenePreset() {
    const p = deserializeBlob({ presets: [DEFAULT_SCENE] }).presets[0];
    return p && EFFECTS[p.effect] ? p : null;
  }
  function rebuildPresetOptions() {
    presetSel.innerHTML = "";
    presetSel.appendChild(new Option("— unsaved scene —", "-1"));
    presets.forEach((p, i) => presetSel.appendChild(new Option(p.name, String(i))));
    presetSel.value = curPreset < 0 ? "-1" : String(curPreset);
  }
  // Normalize a saved state to the current slider set: keep only keys that still
  // exist (drops retired ones like `radius`) and default any newly-added keys.
  function mergeState(e, saved) {
    const base = presetState(e);
    if (saved) for (const id in base) {
      const v = saved[id]; if (v === undefined) continue;
      base[id] = Array.isArray(base[id]) ? (Array.isArray(v) ? v.slice() : base[id]) : v;
    }
    return base;
  }
  // ...and for its beat-chip map. This was the one loader that copied verbatim, which
  // left `beatStates[e][id]` undefined for any control the preset predates. loadBeat
  // spread that into `{}`, and `syncChips`'s classList.toggle(…, undefined) *flips*
  // the class rather than clearing it (per the DOM spec an explicit undefined counts
  // as "force not supplied"), so the chip inverted on every load while the slider was
  // never actually armed. Merging here is the fix; syncChips coerces as a backstop.
  function mergeBeat(e, saved) {
    const base = presetBeat(e);
    if (saved) for (const id in base) {
      const b = saved[id]; if (!b) continue;
      for (const band of ["low", "mid", "high"]) if (typeof b[band] === "boolean") base[id][band] = b[band];
    }
    return base;
  }
  // Same normalization for a preset's pulse-shape map: keep known ids/keys, default
  // the rest — so presets saved before pulse shapes existed (no `pulse`) still load.
  function mergePulse(e, saved) {
    const base = presetPulse(e);
    if (saved) for (const id in base) if (typeof saved[id] === "string" && PULSE_FN[saved[id]]) base[id] = saved[id];
    return base;
  }
  // ...and for its pulse lengths (no `plen` ⇒ every slider at PULSE_DROP).
  function mergePlen(e, saved) {
    const base = presetPlen(e);
    if (saved) for (const id in base) if (plenOk(saved[id])) base[id] = saved[id];
    return base;
  }
  // ---- the stack in a preset / blob ------------------------------------------
  // A stack rides as an OPTIONAL `layers` array. When it holds one item nothing is
  // emitted at all (see stackOut), so every scene saved, shared or backed up before
  // this feature — and every one saved after it that doesn't stack — is byte-for-byte
  // what it always was. Backward compatibility by construction rather than by testing,
  // the same discipline as "?s= decodes forever".
  // Function declarations, NOT const arrows: mergeLayers runs from applyBlob during
  // restore(), which is hundreds of lines above this block, so a const would be in the
  // temporal dead zone and throw. That aborts the rest of startup, and the symptom you
  // actually see is a later TDZ error on `nextSwitch` inside frame() — this file has
  // been bitten by the same shape before (see `card` and `beatUi`, both var for it).
  function blendOk(v) { return BLEND_BY_ID[v] ? v : "max"; }
  function gainOk(v) { return (typeof v === "number" && isFinite(v)) ? Math.min(1, Math.max(0, v)) : 1; }
  // One item, with its effect as the stable string id (converted at the storage edge
  // like every other effect reference). The selected item's values live in the DOM, so
  // freeze first — a caller that forgets loses the user's most recent edit.
  function stackItemOut(L) {
    const { state, cam } = splitLayerCam(L.state || {});   // camera → its own per-layer `cam` node
    return { effect: effectId(L.fx), state, cam, beat: L.beat, pulse: L.pulse,
      plen: L.plen, palette: L.palette, paletteRev: L.paletteRev, paletteBg: L.paletteBg,
      seedPath: L.seedPath, seedRide: L.seedRide, seedPts: L.seedPts, ranges: L.ranges,
      showBox: L.showBox, filters: L.filters, blend: L.blend, gain: L.gain, mute: !!L.mute };
  }
  function stackOut() {
    if (stack.length <= 1) return null;          // one item ⇒ emit nothing
    freezeItem(stack[stackSel]);
    const out = stack.map(stackItemOut);
    thawItem(stack[stackSel]);                   // put the selected item back on the DOM
    return out;
  }
  // Rebuild a stack from a preset/blob. Falls back to a single item described by the
  // legacy top-level fields, which is exactly what a pre-feature preset carries.
  function mergeLayers(p) {
    const raw = Array.isArray(p.layers) ? p.layers.slice(0, STACK_MAX) : null;
    const out = [];
    for (const r of (raw || [])) {
      if (!r) continue;
      const e = typeof r.effect === "number" ? r.effect : effectIndexFromId(r.effect);
      if (e < 0 || !EFFECTS[e]) continue;        // effect no longer ships: drop, never misfile
      const L = newStackItem(e);
      // Each item merges against ITS OWN effect. Merging one item's state against a
      // different effect's defaults silently drops every key that effect declares.
      // The camera rides in a sibling `cam` node now — fold it back into state first (a
      // pre-grouping scene has the keys inline in r.state and no r.cam, which joinLayerCam
      // passes through unchanged).
      L.state = mergeState(e, joinLayerCam(r.state, r.cam));
      L.beat = mergeBeat(e, r.beat);
      L.pulse = mergePulse(e, r.pulse);
      L.plen = mergePlen(e, r.plen);
      // Per-layer palette + filters. Absent (a scene saved before this) ⇒ fall back to
      // the scene's top-level extra, which is what every layer shared before — so an old
      // stacked scene still loads looking the way it did. null ⇒ applyLayerExtras defaults
      // it from the effect. `p.extra` exists on a preset; a blob has no top-level extra,
      // and its per-effect extras (already installed) are the fallback applyLayerExtras uses.
      const tex = p.extra || {};
      L.palette = r.palette != null ? r.palette : (tex.palette != null ? tex.palette : null);
      L.paletteRev = r.paletteRev != null ? !!r.paletteRev : (tex.paletteRev != null ? !!tex.paletteRev : null);
      L.paletteBg = r.paletteBg != null ? bgOk(r.paletteBg) : (tex.paletteBg != null ? bgOk(tex.paletteBg) : null);
      L.seedPath = r.seedPath != null ? seedModeOk(r.seedPath) : (tex.seedPath != null ? seedModeOk(tex.seedPath) : null);
      L.seedRide = r.seedRide != null ? r.seedRide !== false : (tex.seedRide != null ? tex.seedRide !== false : null);
      L.seedPts = r.seedPts != null ? seedPtsOk(r.seedPts) : (tex.seedPts != null ? seedPtsOk(tex.seedPts) : null);
      L.showBox = r.showBox != null ? !!r.showBox : (tex.showBox != null ? !!tex.showBox : null);
      const fset = filtersOk(r.filters) || filtersOk(tex.filters);
      L.filters = fset ? FILTERS.filter(f => fset.has(f.id)).map(f => f.id) : null;
      // Per-layer slider bounds. Absent (a scene saved before this) ⇒ migrate the scene's
      // global ranges' per-layer entries onto every layer, so an old stacked scene keeps its
      // widened sliders (all layers share them until you retune one per-layer).
      L.ranges = (r.ranges && typeof r.ranges === "object") ? r.ranges : layerRangesOf(p.ranges);
      L.blend = blendOk(r.blend);
      L.gain = gainOk(r.gain);
      L.mute = !!r.mute;
      out.push(L);
    }
    if (!out.length) {                           // pre-feature preset, or every item dropped
      const e = EFFECTS[p.effect] ? p.effect : 0;
      const L = newStackItem(e);
      L.state = mergeState(e, p.state); L.beat = mergeBeat(e, p.beat);
      L.pulse = mergePulse(e, p.pulse); L.plen = mergePlen(e, p.plen);
      const tex = p.extra || {};                 // the single layer takes the scene's palette + filters
      L.palette = tex.palette != null ? tex.palette : null;
      L.paletteRev = tex.paletteRev != null ? !!tex.paletteRev : null;
      L.paletteBg = tex.paletteBg != null ? bgOk(tex.paletteBg) : null;
      L.seedPath = tex.seedPath != null ? seedModeOk(tex.seedPath) : null;
      L.seedRide = tex.seedRide != null ? tex.seedRide !== false : null;
      L.seedPts = tex.seedPts != null ? seedPtsOk(tex.seedPts) : null;
      L.showBox = tex.showBox != null ? !!tex.showBox : null;
      const fset = filtersOk(tex.filters);
      L.filters = fset ? FILTERS.filter(f => fset.has(f.id)).map(f => f.id) : null;
      L.ranges = layerRangesOf(p.ranges);        // the single layer takes the scene's per-layer bounds
      out.push(L);
    }
    return out;
  }
  // Install a rebuilt stack and select its first item. The caller runs setEffect after.
  // Every item inherits the CURRENT phase clocks rather than the fresh ones newStackItem
  // seeds: accumulated phase deliberately does not travel with a preset ("the same
  // configuration, not the same frame"), so applying one must not rewind simT/plasmaTime
  // and snap every animation back to its start. Items diverge from here as they run.
  function installStack(items) {
    const now = phaseSnapshot();
    for (const L of items) L.phase = Object.assign({}, now);
    stack = items;
    stackSel = 0;
    thawItem(stack[0]);
  }
  function applyPreset(i) {
    const p = presets[i]; if (!p) return;
    applyingPreset = true;
    // Start the transition BEFORE anything is swapped: it freezes the frame that is
    // still on screen, and picks its mode by comparing the outgoing scene to this one.
    transBegin(sceneInfo(p.effect, p.extra && p.extra.filters, p.extra && p.extra.palette,
      Array.isArray(p.layers) ? p.layers.map(r => effectIndexFromId(r && r.effect)) : null));
    const fromRamp = paletteBase.slice();   // the palette on screen right now — blend away from it
    // Bounds FIRST, matching applyBlob's ordering: loadState below assigns straight to
    // el.value, which the DOM silently clamps to the slider's current min/max — so a
    // stale bound would quietly rewrite the value we are about to install.
    applyRanges(p.ranges);
    migrateCam(p);                                // pre-per-layer preset: fold its one `cam` into p.state / p.layers before they merge
    installBeatTune(mergeBeatTune(p.beatTune));   // absent in pre-feature presets ⇒ shipped defaults
    states[p.effect] = mergeState(p.effect, p.state);
    beatStates[p.effect] = mergeBeat(p.effect, p.beat);      // p.beat may predate a control → default it
    pulseStates[p.effect] = mergePulse(p.effect, p.pulse);   // p.pulse absent in pre-feature presets → all snap
    plenStates[p.effect] = mergePlen(p.effect, p.plen);      // ...likewise p.plen → the default length
    if (p.sceneFx) writeSceneFx(sceneFxOk(p.sceneFx));       // scene-global Scene filters (absent ⇒ keep current)
    extras[p.effect] = mergeExtra(p.effect, p.extra);   // no p.extra.filters ⇒ the descriptor's
    // The stack, after applyRanges for the same reason the four maps are: every item's
    // values are validated against the live bounds. installStack thaws item 0, which
    // overwrites states[...] for its effect — so it must run before setEffect reads them.
    installStack(mergeLayers(p));
    effectSel.value = stack[0].fx;
    stageLayerExtras(stack[0]);       // before setEffect's persist, as when selecting a layer
    setEffect(stack[0].fx, false);    // loads the just-installed scene (may snap the palette)
    applyLayerExtras(stack[0]);        // slot 0's palette + filters go live (beginMorph blends to them)
    // Blend the palette in from whatever was on screen (fromRamp) rather than snapping.
    // WHERE it blends to depends on whether the palette cycle is running: with cycling on,
    // head for a fresh random palette and keep going — that is the whole point of cycling.
    // With it pinned (band tops out at 0) settle on the palette the preset actually stored,
    // or a preset could never show its own colours: this is a one-shot that morphStep ends
    // with setPalette(morphTargetIndex). That mattered the moment presets became portable —
    // a scene sent to someone else used to land on a random palette on arrival.
    morphOnce = !morphing;
    beginMorph(fromRamp, morphing ? pickOther(+paletteSel.value) : +paletteSel.value);
    curPreset = i; presetSel.value = String(i);
    applyingPreset = false;
    persist();
  }
  function createPreset() {           // save the current scene as a new preset
    const name = (prompt("Preset name:", "Preset " + (presets.length + 1)) || "").trim();
    if (!name) return;
    presets.push({ name, ...snapshotScene() });
    curPreset = presets.length - 1;
    stopCycling();                    // ...and keep it on screen (see stopCycling)
    dockAll();                        // back to just the menu (see Break-out boxes)
    rebuildPresetOptions();
    persist();
  }
  el("newpreset").addEventListener("click", createPreset);
  // When a preset is selected, edits flow straight back into it (auto-save); this
  // writes the current scene over the selected preset, keeping its name.
  function autosavePreset() {
    if (curPreset >= 0 && curPreset < presets.length)
      presets[curPreset] = { name: presets[curPreset].name, ...snapshotScene() };
  }
  el("renamepreset").addEventListener("click", () => {
    if (curPreset < 0 || curPreset >= presets.length) return;   // nothing real selected
    const name = (prompt("Rename preset:", presets[curPreset].name) || "").trim();
    if (!name) return;
    presets[curPreset].name = name;
    rebuildPresetOptions();
    persist();
  });
  el("delpreset").addEventListener("click", () => {
    if (curPreset < 0 || curPreset >= presets.length) return;   // nothing real selected
    presets.splice(curPreset, 1);
    curPreset = -1;
    dockAll();
    rebuildPresetOptions();
    persist();
  });
  // dockAll() up front covers BOTH branches — picking a preset and dropping to
  // "— unsaved scene —". Selecting a preset would dock anyway via applyPreset → setEffect,
  // but "— unsaved scene —" never reaches setEffect, and relying on that chain would make
  // this quietly depend on where setEffect happens to call dockAll.
  presetSel.addEventListener("change", () => {
    dockAll();
    const i = +presetSel.value; if (i >= 0) applyPreset(i); else curPreset = -1;
  });

