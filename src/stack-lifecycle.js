  // ---- stack item lifecycle --------------------------------------------------
  // Freezing copies the DOM (and the singleton chip/pulse/plen maps, and the live
  // animation phase) into the item's own record; thawing does the reverse and NULLS the
  // record, so exactly one of "selected" / "holds numbers" is true for an item. Any path
  // that reads a frozen record without freezing first silently loses the user's last
  // edit — the failure class the chipEdited() history in CLAUDE.md documents.
  function freezeItem(L) {
    const st = states[L.fx] || {};
    L.state = {}; L.beat = {}; L.pulse = {}; L.plen = {};
    for (const id in st) {
      if (SCENE_FILTER_KEYS.includes(id)) continue;   // scene-filter values are global, not per-layer
      L.state[id] = Array.isArray(st[id])
        ? [+el(id + "-lo").value, +el(id + "-hi").value]
        : +el(id).value;
    }
    for (const id in beatReact) L.beat[id] = Object.assign({}, beatReact[id]);
    for (const id in pulseShape) L.pulse[id] = pulseShape[id];
    for (const id in pulseLen) L.plen[id] = pulseLen[id];
    L.anim = {};
    for (const id in animPhase) L.anim[id] = Object.assign({}, animPhase[id]);
    capturePhase(L);
    captureLayerExtras(L);            // this layer's palette + filters, from the live globals
    // Remember this layer's open slider pop-out boxes, so re-selecting it restores them
    // (restoreLayerUi). Transient, like `popped` itself: not serialized, shared or backed up.
    // (The Orbit editor is scene-wide sticky, not per layer — see setEffect / cardWanted.)
    L.popped = [...popped];
    L.ranges = collectLayerRanges();  // this layer's custom slider bounds (applied by setEffect on select)
  }
  function thawItem(L) {
    if (L.state) states[L.fx] = mergeState(L.fx, L.state);
    if (L.beat) beatStates[L.fx] = mergeBeat(L.fx, L.beat);
    if (L.pulse) pulseStates[L.fx] = mergePulse(L.fx, L.pulse);
    if (L.plen) plenStates[L.fx] = mergePlen(L.fx, L.plen);
    // The selected item's phase records ARE the singletons from here on.
    for (const id in L.anim) if (animPhase[id]) Object.assign(animPhase[id], L.anim[id]);
    installPhase(L);
    L.state = L.beat = L.pulse = L.plen = null;
    L.anim = {};
  }
  function selectStack(j) {
    if (j === stackSel || !stack[j]) return;
    freezeItem(stack[stackSel]);
    stackSel = j;
    const pops = stack[j].popped;    // read BEFORE setEffect's persist re-freezes and wipes it
    thawItem(stack[j]);
    stageLayerExtras(stack[j]);      // live palette/filters = this layer's, before setEffect's persist
    setEffect(stack[j].fx, false, false);   // reloads the maps for editing; enter=false ⇒ no reseed, the layer keeps running
    applyLayerExtras(stack[j]);      // ...and the full palette + filter UI/morph
    restoreLayerUi(stack[j], pops);  // ...and re-open the pop-out boxes it had open
    syncStackUI();
  }
  function addStackItem(fx) {
    if (stack.length >= STACK_MAX) return;
    freezeItem(stack[stackSel]);
    const L = newStackItem(fx === undefined ? effect : fx);
    // A fresh item is seeded from its effect's shipped defaults, not from the item that
    // happened to be selected — mergeState against its OWN effect, or every key that
    // effect declares would be dropped.
    L.state = mergeState(L.fx, presetState(L.fx));
    L.beat = mergeBeat(L.fx, presetBeat(L.fx));
    L.pulse = mergePulse(L.fx, presetPulse(L.fx));
    L.plen = mergePlen(L.fx, presetPlen(L.fx));
    L.palette = presetExtra(L.fx).palette;   // a fresh layer opens on its effect's default look
    L.paletteRev = presetExtra(L.fx).paletteRev;
    L.paletteBg = presetExtra(L.fx).paletteBg;
    { const px = presetExtra(L.fx); L.seedPath = px.seedPath; L.seedRide = px.seedRide; L.seedPts = px.seedPts; }
    L.filters = presetFilters(L.fx);
    stack.push(L);
    stackSel = stack.length - 1;
    thawItem(L);
    stageLayerExtras(L);
    setEffect(L.fx, false);
    applyLayerExtras(L);
    restoreLayerUi(L, null);         // a fresh layer has no pop-out boxes ⇒ clean editing surface
    syncStackUI();
  }
  function removeStackItem(j) {
    if (stack.length <= 1 || !stack[j]) return;
    stack.splice(j, 1);
    if (stackSel >= stack.length) stackSel = stack.length - 1;
    else if (j < stackSel) stackSel--;
    const pops = stack[stackSel].popped;   // before setEffect's persist wipes it
    thawItem(stack[stackSel]);
    stageLayerExtras(stack[stackSel]);
    setEffect(stack[stackSel].fx, false, false);   // re-selecting a surviving layer ⇒ no reseed
    applyLayerExtras(stack[stackSel]);   // the newly-selected layer's palette + filters
    restoreLayerUi(stack[stackSel], pops);   // ...and its remembered pop-out boxes
    syncStackUI();
  }
  // ---- the layer list ----
  // One row per stack item: reorder, name, mute, blend, gain, remove. Blend/gain/mute
  // are deliberately NOT CONTROLS entries — that registry is per-key singletons and
  // these are per item — so they are plain DOM whose change bubbles to the delegated
  // onEdit for persist + autosave, the same route the palette <select> takes. They are
  // also deliberately not animatable or beat-armable.
  function syncStackUI() {
    const host = el("stacklist");
    if (!host) return;
    host.textContent = "";
    stack.forEach((L, j) => {
      const row = document.createElement("div");
      row.className = "lyr" + (j === stackSel ? " sel" : "") + (L.mute ? " muted" : "");
      row.title = "Click to edit this layer";
      // Selecting is what every slider in the box below follows, so pressing ANYWHERE in the
      // row selects it — including on the mute dot, the gain slider, the blend dropdown and
      // the effect chooser. Those all stopPropagation on `click` (so their own action doesn't
      // double-fire), which is why this listens for `pointerdown` in the CAPTURE phase: it
      // runs before any child handler can stop it, and before the control acts, so a gain drag
      // or a blend pick applies to a layer that is already selected rather than selecting
      // afterwards off a stale index.
      //
      // The grab handle is excluded HERE only, for a mechanical reason rather than a taste
      // one: selectStack re-runs syncStackUI, which rebuilds every row — that would detach
      // the handle holding the pointer capture mid-drag, and Chromium drops capture on
      // reparent, killing the drag after the first pixel (the trap documented on the drag
      // code below). The handle still selects, just on pointerUP — see its onUp.
      row.addEventListener("pointerdown", e => {
        if (!e.target.closest(".lyr-grab")) selectStack(j);
      }, true);
      // Kept as well: a synthetic click (tests, assistive tech) never emits pointerdown, and
      // selectStack early-returns when the row is already selected, so this cannot double-work.
      row.addEventListener("click", () => selectStack(j));

      // Grab handle → drag to reorder. It captures the pointer and live-moves this row
      // among its siblings. The dragged row is NEVER re-parented mid-drag — it only rides
      // the pointer via `transform: translateY` (which doesn't change layout, so the other
      // rows stay put and their midpoints stay valid) while a drop-marker line shows where
      // it will land. Moving the row's DOM node would detach the handle that holds the
      // pointer capture, and Chromium drops capture on reparent — which killed the drag
      // after the first pixel. The actual reorder happens once, on release. Selection is
      // left untouched — you drag to reorder, click the row body to select.
      const from = j;
      const grab = document.createElement("div");
      grab.className = "lyr-grab" + (stack.length < 2 ? " off" : "");
      grab.textContent = "⠿";
      grab.title = "Drag to reorder — layers higher in the list draw first (underneath)";
      grab.setAttribute("aria-label", "Drag to reorder layer");
      grab.addEventListener("click", e => e.stopPropagation());
      grab.addEventListener("pointerdown", e => {
        if (stack.length < 2) return;
        e.preventDefault(); e.stopPropagation();
        grab.setPointerCapture(e.pointerId);
        const startY = e.clientY;
        row.classList.add("dragging");
        const marker = document.createElement("div");
        marker.className = "lyr-drop";
        let to = from;                       // insertion index within the list MINUS the row
        const onMove = ev => {
          row.style.transform = "translateY(" + (ev.clientY - startY) + "px)";
          // Scan only the other rows: their rects are stable (untransformed), whereas the
          // dragged row's rect rides the pointer. `to` = how many of them sit above it.
          const others = [...host.querySelectorAll(".lyr")].filter(r => r !== row);
          to = 0;
          for (const r of others) {
            const b = r.getBoundingClientRect();     // DOMRect: .height, NOT .offsetHeight
            if (ev.clientY < b.top + b.height / 2) break;
            to++;
          }
          host.insertBefore(marker, others[to] || null);   // a sibling move; the row stays put
        };
        const onUp = () => {
          grab.releasePointerCapture(e.pointerId);
          grab.removeEventListener("pointermove", onMove);
          grab.removeEventListener("pointerup", onUp);
          grab.removeEventListener("pointercancel", onUp);
          marker.remove();
          row.style.transform = "";
          row.classList.remove("dragging");
          // Using the handle selects that layer too — but ON RELEASE, never on press. The
          // rest of the row selects from a capture-phase pointerdown; doing that here would
          // rebuild the rows mid-gesture, and since selectStack → syncStackUI reparents the
          // handle that holds the pointer capture, Chromium drops the capture and the drag
          // dies after the first pixel. Deferring to pointerup gets the selection without
          // touching the DOM while the pointer is down.
          //
          // Held by IDENTITY, not by index: a reorder moves it, so `from` no longer names it.
          const dragged = stack[from];
          const moved = to !== from;
          if (moved) {
            // `to` indexes the array with the dragged item already removed, so splice-out
            // then splice-in at `to` directly (no gap adjustment needed).
            stack.splice(to, 0, stack.splice(from, 1)[0]);
          }
          const at = stack.indexOf(dragged);
          if (at >= 0 && at !== stackSel) selectStack(at);   // ...which re-runs syncStackUI
          else syncStackUI();                                // a plain click on the selected row
          if (moved) { persist(); autosavePreset(); }
        };
        grab.addEventListener("pointermove", onMove);
        grab.addEventListener("pointerup", onUp);
        grab.addEventListener("pointercancel", onUp);
      });
      row.appendChild(grab);

      // The effect chooser sits ON the row, not only in the Layer effect & filters box below —
      // re-pointing a layer is the single most common thing you do to one, and it used to
      // mean select the row, scroll down, then use the other chooser. Both drive the same
      // path: changing a row that is NOT selected selects it FIRST, because setEffect edits
      // whatever `stackSel` names, and routing through selectStack is what keeps the
      // freeze/stageLayerExtras ordering honest (writing L.fx directly here would strand the
      // layer's palette + filters on the outgoing effect — the load-order trap in CLAUDE.md).
      // `fx` is read off the <select> BEFORE either call: both re-run syncStackUI, which
      // rebuilds these rows, so `nm` is a detached node by the time they return.
      const nm = document.createElement("select");
      nm.className = "lyr-name";
      EFFECTS.forEach((f, i) => {
        const o = document.createElement("option");
        o.value = String(i); o.textContent = f.name; o.title = f.subtitle;
        nm.appendChild(o);
      });
      nm.value = String(L.fx);
      nm.title = "This layer's effect — " + EFFECTS[L.fx].subtitle;
      nm.addEventListener("click", e => e.stopPropagation());   // picking ≠ selecting the row
      nm.addEventListener("change", e => {
        e.stopPropagation();
        const fx = +nm.value;
        if (j !== stackSel) selectStack(j);
        setEffect(fx);          // ...which re-runs syncStackUI, so the row redraws itself
        autosavePreset();
        persist();
        nextSwitch = 0;         // a manual pick restarts the auto-cycle clock, as in the box below
      });
      row.appendChild(nm);

      const ctl = document.createElement("div");
      ctl.className = "lyr-ctl";
      row.appendChild(ctl);

      const mute = document.createElement("b");
      mute.textContent = L.mute ? "○" : "●";
      mute.title = L.mute ? "Muted — click to show" : "Showing — click to mute";
      mute.addEventListener("click", e => {
        e.stopPropagation();
        L.mute = !L.mute;
        syncStackUI(); persist(); autosavePreset();
      });
      ctl.appendChild(mute);

      const gn = document.createElement("input");
      gn.type = "range"; gn.min = 0; gn.max = 1; gn.step = 0.01; gn.value = L.gain;
      gn.title = "Layer strength";
      gn.addEventListener("click", e => e.stopPropagation());
      gn.addEventListener("input", e => { e.stopPropagation(); L.gain = gainOk(+gn.value); });
      gn.addEventListener("change", () => { persist(); autosavePreset(); });
      ctl.appendChild(gn);

      const rm = document.createElement("b");
      rm.textContent = "✕"; rm.title = "Remove this layer";
      if (stack.length <= 1) rm.classList.add("off");
      rm.addEventListener("click", e => { e.stopPropagation(); removeStackItem(j); persist(); autosavePreset(); });
      ctl.appendChild(rm);

      // Blend mode on its own row: a <select> (with the mode's tip as its title) flanked by
      // ▲/▼ steppers that cycle through BLEND_MODES, so you can either pick directly or nudge.
      const blendRow = document.createElement("div");
      blendRow.className = "lyr-blend";
      const blbl = document.createElement("span");
      blbl.className = "lyr-blend-lbl"; blbl.textContent = "Blend";
      blendRow.appendChild(blbl);
      const bcur = () => BLEND_BY_ID[L.blend] || BLEND_MODES[0];
      const sel = document.createElement("select");
      BLEND_MODES.forEach(m => { const o = document.createElement("option"); o.value = m.id; o.textContent = m.label; o.title = m.tip; sel.appendChild(o); });
      sel.value = bcur().id; sel.title = bcur().tip;
      sel.addEventListener("click", e => e.stopPropagation());
      sel.addEventListener("change", e => { e.stopPropagation(); L.blend = blendOk(sel.value); syncStackUI(); persist(); autosavePreset(); });
      blendRow.appendChild(sel);
      const cycleBlend = dir => { const i = BLEND_MODES.indexOf(bcur()); L.blend = BLEND_MODES[(i + dir + BLEND_MODES.length) % BLEND_MODES.length].id; syncStackUI(); persist(); autosavePreset(); };
      const up = document.createElement("b");
      up.className = "lyr-arrow"; up.textContent = "▲"; up.title = "Previous blend mode";
      up.addEventListener("click", e => { e.stopPropagation(); cycleBlend(-1); });
      const dn = document.createElement("b");
      dn.className = "lyr-arrow"; dn.textContent = "▼"; dn.title = "Next blend mode";
      dn.addEventListener("click", e => { e.stopPropagation(); cycleBlend(1); });
      blendRow.appendChild(up); blendRow.appendChild(dn);
      row.appendChild(blendRow);

      host.appendChild(row);
    });
    const add = el("addlayer");
    if (add) add.classList.toggle("off", stack.length >= STACK_MAX);
  }

  // Per-effect beat-toggle state, parallel to `states`. beatStates[effect][id] =
  // {low,mid,high}; the live `beatReact` reflects the current effect and drives
  // updateAnims. Switching saves/loads it just like the slider values.
  const beatStates = {};
  function presetBeat(e) {            // a fresh copy of effect e's default chip selection (descriptor `beat`)
    const bt = {};
    for (const id in beatReact) bt[id] = { low: false, mid: false, high: false };
    const bp = EFFECTS[e].beat;
    if (bp) for (const id in bp) if (bt[id]) for (const band of bp[id]) bt[id][band] = true;
    return bt;
  }
  function initBeatStates() { EFFECTS.forEach((_, k) => beatStates[k] = presetBeat(k)); }
  initBeatStates();
  function saveBeat(e) { for (const id in beatReact) beatStates[e][id] = { ...beatReact[id] }; }
  // A missing id must land as all-false, not `{}`: an undefined band would reach
  // classList.toggle below, where "force not supplied" means *flip*, not clear.
  function loadBeat(e) { for (const id in beatReact) beatReact[id] = { low: false, mid: false, high: false, ...beatStates[e][id] }; syncChips(); }
  function syncChips() {
    // !! is load-bearing — see loadBeat. toggle(cls, undefined) toggles.
    for (const id in chipEls) for (const k in chipEls[id]) chipEls[id][k].classList.toggle("on", !!(beatReact[id] && beatReact[id][k]));
    syncDots();
  }
  // The menu row's dots mirror the armed chips, so the overview survives every path
  // that changes them (loadBeat, Reset, a chip click) without a second sync to forget.
  function syncDots() {
    for (const id in dotEls) for (const k in dotEls[id])
      dotEls[id][k].classList.toggle("armed", !!(beatReact[id] && beatReact[id][k]));
  }

  // Per-effect beat-pulse SHAPE, parallel to beatStates. pulseStates[effect][id] =
  // a PULSE_SHAPES key; the live `pulseShape` reflects the current effect and is
  // read by updateAnims. Seeded to the descriptor's optional `pulse` map, else snap.
  const pulseStates = {};
  function presetPulse(e) {
    const pt = {};
    for (const id in pulseShape) pt[id] = PULSE_DEFAULT;
    const pp = EFFECTS[e].pulse;
    if (pp) for (const id in pp) if (id in pt && PULSE_FN[pp[id]]) pt[id] = pp[id];
    return pt;
  }
  function initPulseStates() { EFFECTS.forEach((_, k) => pulseStates[k] = presetPulse(k)); }
  initPulseStates();
  function savePulse(e) { for (const id in pulseShape) pulseStates[e][id] = pulseShape[id]; }
  function loadPulse(e) { for (const id in pulseShape) pulseShape[id] = PULSE_FN[pulseStates[e][id]] ? pulseStates[e][id] : PULSE_DEFAULT; syncPulse(); }
  function syncPulse() { for (const id in pulseEls) pulseEls[id].value = pulseShape[id]; }

  // Per-effect beat-pulse LENGTH, exactly parallel to pulseStates above. Seeded to
  // the descriptor's optional `plen` map, else PULSE_DROP (the old hardcoded value).
  const plenStates = {};
  const plenOk = v => typeof v === "number" && isFinite(v) && v >= PLEN_MIN && v <= PLEN_MAX;
  function presetPlen(e) {
    const pt = {};
    for (const id in pulseLen) pt[id] = PULSE_DROP;
    const pp = EFFECTS[e].plen;
    if (pp) for (const id in pp) if (id in pt && plenOk(pp[id])) pt[id] = pp[id];
    return pt;
  }
  function initPlenStates() { EFFECTS.forEach((_, k) => plenStates[k] = presetPlen(k)); }
  initPlenStates();
  function savePlen(e) { for (const id in pulseLen) plenStates[e][id] = pulseLen[id]; }
  function loadPlen(e) { for (const id in pulseLen) pulseLen[id] = plenOk(plenStates[e][id]) ? plenStates[e][id] : PULSE_DROP; syncPlen(); }
  function syncPlen() {
    for (const id in plenEls) { plenEls[id].inp.value = pulseLen[id]; plenEls[id].out.textContent = plenFmt(pulseLen[id]); }
  }

  // Per-effect "extras": palette, auto-morph, show-box and Effect TTL are also
  // remembered per effect, so each effect is a fully independent scene.
  const extras = {};
  function presetExtra(e) {
    const x = EFFECTS[e].extras;
    return { palette: x.palette, paletteRev: !!x.paletteRev, paletteBg: bgOk(x.paletteBg), morph: x.morph, showBox: x.showBox, randSeed: x.randSeed, filters: presetFilters(e),
      seedPath: seedModeOk(x.seedPath), seedRide: x.seedRide !== false, seedPts: seedPtsOk(x.seedPts) };
  }
  // Freehand control points are free-form scene data (they ride in localStorage, presets,
  // backups and share links), so validate on the way in: finite [x,y] pairs, capped so a
  // pathological blob can't bloat a link. 200 points is far more than a hand-drawn loop.
  function seedPtsOk(a) {
    if (!Array.isArray(a)) return [];
    const out = [];
    for (const p of a) {
      if (Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1])) { out.push([+p[0], +p[1]]); if (out.length >= 200) break; }
    }
    return out;
  }
  // Preset extras are copied verbatim by applyPreset, so a preset saved before
  // filters existed has no `filters` key — default it from the descriptor rather
  // than leaving the scene with no filters at all (which would kill fire and glow).
  function mergeExtra(e, saved) {
    const base = presetExtra(e);
    if (saved) for (const k in base) if (saved[k] !== undefined) base[k] = saved[k];
    const ok = filtersOk(saved && saved.filters);
    base.filters = ok ? FILTERS.filter(f => ok.has(f.id)).map(f => f.id) : presetFilters(e);
    base.seedPath = seedModeOk(base.seedPath);       // sanitize the seed-path fields a
    base.seedRide = base.seedRide !== false;          // preset/blob may or may not carry
    base.seedPts = seedPtsOk(base.seedPts);
    base.paletteRev = !!base.paletteRev;
    base.paletteBg = bgOk(base.paletteBg);
    return base;
  }
  function initExtras() { EFFECTS.forEach((_, k) => extras[k] = presetExtra(k)); }
  initExtras();
  function saveExtra(e) {
    extras[e] = { palette: paletteSel.value, paletteRev: paletteReverse, paletteBg: paletteBg, morph: palCycleOn(), showBox: showBoxChk.checked, randSeed: randSeedChk.checked,
      filters: FILTERS.filter(f => activeIds.has(f.id)).map(f => f.id),   // always registry order
      // Seed-path config for the selected effect. Points are rounded to trim share links.
      seedPath: seedPathMode, seedRide: seedRideOn, seedPts: seedPts.map(p => [+p[0].toFixed(4), +p[1].toFixed(4)]) };
  }
  // The per-EFFECT half of a scene's extras: show-box and the random-seed toggle stay
  // keyed by effect. Palette and the filter stack are per-LAYER now — see applyLayerExtras.
  function loadExtra(e) {
    const x = extras[e];
    suppressPersist = true;
    // NOT showBox: it is per-LAYER now (stageLayerExtras / applyLayerExtras install it from the
    // layer), for the same reason the seed path is. Setting it here made the box follow the
    // SELECTED layer's EFFECT — and since Tetrafyer ships showBox:false while every other effect
    // ships true, the box appeared whenever you edited another layer and vanished the instant you
    // selected the Tetrafyer one. extras[e].showBox survives as the per-effect fallback.
    randSeed = x.randSeed !== false;  // default on for presets/blobs saved before this existed
    randSeedChk.checked = randSeed;
    // The seed PATH is per-LAYER now (stageLayerExtras / applyLayerExtras install it from the
    // layer), NOT here — loadExtra must not touch it, or setEffect's persist-freeze would
    // capture the effect default over the staged layer path (the load-order trap).
    // Migration: scenes saved before the Palette cycle slider carry only the old `morph`
    // boolean. loadState has already applied any stored palcycle, so pin the cycle when
    // the old flag says off. palcycle is per-effect state, so this stays here.
    if (x.morph === false && palCycleOn()) setPalCycle(0, 0);
    suppressPersist = false;
  }
  // Capture the live palette + filter stack into a layer, so its look is remembered
  // independently of any other layer that happens to run the same effect.
  function captureLayerExtras(L) {
    L.palette = paletteSel.value;
    L.paletteRev = paletteReverse;
    L.paletteBg = paletteBg;
    captureSeed(L);                   // the layer's orbit path (mode / ride / freehand points)
    L.showBox = showBoxChk.checked;   // the wireframe box is per-layer, not per-effect
    L.filters = FILTERS.filter(f => activeIds.has(f.id)).map(f => f.id);
  }
  // Put a layer's palette + filter SET onto the live globals — just the two values
  // captureLayerExtras reads back — WITHOUT the UI/morph work. This must run before
  // setEffect when switching layers, because setEffect ends in persist(), which snapshots
  // the stack by freezing the selected layer; without this it would capture the OUTGOING
  // layer's palette/filters onto the incoming one, collapsing both to the same look.
  function stageLayerExtras(L) {
    const fx = extras[L.fx] || presetExtra(L.fx);
    activeIds = filtersOk(L.filters) || new Set(presetFilters(L.fx));   // per-layer, then descriptor default — never runtime extras[L.fx] (see layerFeedbackChain)
    paletteSel.value = L.palette != null ? L.palette : fx.palette;
    paletteReverse = L.paletteRev != null ? !!L.paletteRev : !!fx.paletteRev;
    paletteBg = L.paletteBg != null ? bgOk(L.paletteBg) : bgOk(fx.paletteBg);
    // The box, before setEffect's persist-freeze can capture the effect default over it —
    // the same load-order trap the seed path documents below.
    showBox = L.showBox != null ? !!L.showBox : fx.showBox !== false;
    showBoxChk.checked = showBox;
    installSeedPath(L);              // seed globals = this layer's orbit path, before the persist-freeze
  }
  // Push a layer's palette + filters onto the live globals. Called after setEffect for
  // whichever layer is now selected — selecting a layer, adding one, applying a preset,
  // startup. A null field (a fresh layer, or a scene saved before per-layer extras) falls
  // back to the effect's stored/default extras, which is what preserves how old scenes
  // looked (every same-effect layer shared one palette). The fallback is then captured,
  // so from that point the layer owns concrete values that serialize.
  function applyLayerExtras(L) {
    suppressPersist = true;
    const fx = extras[L.fx] || presetExtra(L.fx);
    // Keep a stored list intact even for filters this device can't run — filterOn() masks
    // them (cpuBlocked), so they stay ticked-but-greyed and survive a round trip.
    activeIds = filtersOk(L.filters) || new Set(presetFilters(L.fx));   // per-layer, then descriptor default — never runtime extras[L.fx] (see layerFeedbackChain)
    syncFilterUI();
    bloomAmt = filterOn("bloom") ? +el("bloom-lo").value : 0;   // bloom follows this layer's filters
    refreshControlVisibility();       // filter param rows follow the active list
    nextSwitch = 0;                   // restart the auto-cycle countdown on a scene switch
    morphOnce = false;                // cancel a pending one-shot morph from a prior switch
    paletteSel.value = L.palette != null ? L.palette : fx.palette;
    paletteReverse = L.paletteRev != null ? !!L.paletteRev : !!fx.paletteRev;
    paletteBg = L.paletteBg != null ? bgOk(L.paletteBg) : bgOk(fx.paletteBg);
    if (el("palrev")) el("palrev").checked = paletteReverse;
    if (el("palbg")) el("palbg").value = paletteBg;
    showBox = L.showBox != null ? !!L.showBox : fx.showBox !== false;   // per-layer, not per-effect
    showBoxChk.checked = showBox;
    installSeedPath(L);              // seed globals = this layer's orbit path
    seedHistory = []; seedDragIdx = -1; seedHover = -1;   // fresh editing session per layer
    syncOrbitUI();                   // reflect this layer's mode / ride / points in the editor
    morphing = palCycleOn();
    if (morphing) startMorph(+paletteSel.value); else setPalette(+paletteSel.value);
    syncPalSwatches();                // highlight this layer's palette in the preview picker
    captureLayerExtras(L);            // concrete from here, so it serializes and stops falling back
    suppressPersist = false;
  }

