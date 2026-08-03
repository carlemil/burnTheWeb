  // ---- Break-out boxes -------------------------------------------------------
  // Every poppable slider shows in the menu as just a name + a +/- button (a
  // .ctl-row launcher). Its full control block (slider, value readout, beat chips,
  // pulse-shape picker) lives in the pop-out column (#breakout) and is only shown
  // while popped — so the menu stays a compact index and the sliders never crowd
  // each other. `popped` is a global set of control keys — a control is one
  // singleton reused across effects, so a pop applies wherever that slider appears;
  // refreshBreakout filters both the rows and the boxes to the current effect's
  // params. Transient (not persisted). The moved node keeps working: element refs
  // (anims/loadState) are location-independent, its styling is scoped to #breakout
  // too (CSS), and onEdit + the range editor scan #breakout as well (see below).
  const breakout = el("breakout");
  const popped = new Set();
  const rows = {};                   // key -> menu row element (name + +/- button)
  const POPPABLE = CONTROLS.filter(c => c.type === "dual" || c.type === "plain").map(c => c.key);
  const ctlLabel = key => { const c = CONTROLS.find(x => x.key === key); return c ? c.label : key; };
  function makePopBtn(key) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ctl-pop";
    b.addEventListener("click", () => togglePop(key));
    return b;
  }
  // ---- per-slider range editor (lives at the foot of the slider's pop-out box) --
  // Sliders ship their min/max/step as HTML attributes; these fields retune the
  // bounds of *this* slider live, against the running visual. It replaced the one
  // shared "Slider ranges" list that used to sit in Diagnostics — the bounds belong
  // next to the slider they bound, and only a popped-out slider is being tuned.
  // Retuned bounds persist (localStorage), ride the ?s= share URL and go into
  // backups (see collectRanges/applyRanges); ↺ restores the shipped ones. The
  // fields don't persist themselves — rngApply dispatches `input` on the real
  // slider, and the delegated onEdit turns that into a persist + autosave.
  function ctlRangeInputs(key) {   // a dual's two thumbs share one set of bounds
    const lo = ctl(key + "-lo"), hi = ctl(key + "-hi");
    if (lo && hi) return [lo, hi];
    const p = ctl(key);
    return p && p.type === "range" ? [p] : [];
  }
  // A slider's `step` attribute as a NUMBER for the editor field: "any" (continuous) and
  // any non-numeric read back as 0, so the field's "0 = continuous" convention is total.
  const stepFieldVal = s => { const n = +s; return isFinite(n) && n > 0 ? String(n) : "0"; };
  function rngApply(els, which, v) {
    if (!isFinite(v)) return;
    for (const inp of els) {
      if (which === "step") {
        // 0 (or empty/negative) ⇒ continuous, i.e. step="any"; otherwise snap to v.
        inp.step = v > 0 ? String(v) : "any";
      } else {
        inp[which] = String(v);
        // A value outside the new bounds would otherwise be clamped by the browser
        // only on the next drag — clamp now and re-apply, so the visual, the readout
        // and the fill all agree immediately (and the change persists).
        const c = Math.min(+inp.max, Math.max(+inp.min, +inp.value));
        if (c !== +inp.value) inp.value = String(c);
      }
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function makeRangeEditor(key) {
    const els = ctlRangeInputs(key);
    if (!els.length) return null;
    const box = document.createElement("div");
    box.className = "rng-edit";
    const fields = {};
    for (const which of ["min", "max", "step"]) {
      const cell = document.createElement("label");
      cell.className = "rng-cell";
      cell.appendChild(document.createTextNode(which));
      const f = document.createElement("input");
      f.type = "number"; f.step = "any";
      f.value = which === "step" ? stepFieldVal(els[0].step) : els[0][which];
      // "step" 0 leaves the slider continuous; any positive value snaps its thumbs to
      // that increment. It only affects manual dragging — the animation drives the value
      // as a free float regardless — so it is a drag-resolution knob, not a quantiser.
      f.title = which === "step"
        ? ctlLabel(key) + " step (0 = continuous)"
        : ctlLabel(key) + " " + which;
      f.addEventListener("input", () => rngApply(els, which, +f.value));
      cell.appendChild(f);
      box.appendChild(cell);
      fields[which] = f;
    }
    const sync = () => { for (const w in fields) fields[w].value = w === "step" ? stepFieldVal(els[0].step) : els[0][w]; };
    rngSyncs.push(sync);
    const rst = document.createElement("button");
    rst.type = "button"; rst.className = "rng-rst"; rst.textContent = "↺";
    rst.title = "Reset this slider — value, range, beat chips and pulse — to this effect's defaults";
    rst.setAttribute("aria-label", ctlLabel(key) + ": reset to defaults");
    rst.addEventListener("click", () => { resetControl(key); sync(); });
    box.appendChild(rst);
    return box;
  }

  // Who a control belongs to, for the box title. CTL_GROUPS already carries the human
  // name of every family — effects ("Plasma", "Cardioid seed"), the shared ones
  // ("Camera", "Shape & motion") and the filters. Filters get an explicit prefix so
  // "Fire" the filter can't be read as Fire the effect family.
  function ctlOwner(key) {
    const c = CONTROLS.find(x => x.key === key);
    const g = c && c.group;
    if (!g || !CTL_GROUPS[g]) return "";
    return (g.startsWith("f_") ? "Filter · " : "") + CTL_GROUPS[g];
  }
  POPPABLE.forEach(key => {
    const box = ctl("ctl-" + key);
    box.classList.add("poppable");
    // Title line, first child so it sits above the label. Only ever visible in
    // #breakout: the menu slot shows the .ctl-row launcher, never the .ctl itself.
    // Always built (even with no owner group) so it can carry the per-box help ?.
    const own = ctlOwner(key);
    const t = document.createElement("div");
    t.className = "ctl-owner";
    const ownTxt = document.createElement("span");
    ownTxt.className = "own-txt"; ownTxt.textContent = own;
    t.appendChild(ownTxt);
    const hb = document.createElement("button");
    hb.type = "button"; hb.className = "ctl-help"; hb.textContent = "?";
    hb.title = "What " + ctlLabel(key) + " does";
    hb.setAttribute("aria-label", ctlLabel(key) + " — help");
    hb.addEventListener("click", e => { e.stopPropagation(); openCtlHelp(key); });
    t.appendChild(hb);
    box.insertBefore(t, box.firstChild);
    // Bounds editor goes directly UNDER THE SLIDER, not at the foot of the box: min/max/step
    // describe that slider, so they belong with it rather than below the beat controls, which
    // are a different subject. A divider closes the block off from the Triggers section.
    //
    // Inserted rather than appended, because makeChips (run earlier, from bindRange) has
    // already appended the trigger block — so the anchor is the first thing it added, and
    // everything lands in front of that. `.trig-t` is that anchor; with no chips (a `plain`
    // control that can't be beat-armed) there is nothing to insert before and appending is
    // right, which insertBefore(…, null) does for free.
    const rngEd = makeRangeEditor(key);
    if (rngEd) {
      const anchor = box.querySelector(".trig-t");
      box.insertBefore(rngEd, anchor);
      if (anchor) {
        const hr = document.createElement("div");
        hr.className = "ctl-div";
        box.insertBefore(hr, anchor);
      }
    }
    box.appendChild(makePopBtn(key));            // the box's own dock button (left gutter in #breakout)
    const row = document.createElement("div");   // the launcher that stays in the menu slot
    row.className = "ctl-row";
    const name = document.createElement("span");
    name.className = "ctl-row-name"; name.textContent = ctlLabel(key);
    row.appendChild(name);
    // Beat dots, left of the +/- button. Only for sliders that have chips at all —
    // `plain` controls are poppable but never armed, so they get no dots.
    if (chipEls[key]) {
      const dots = document.createElement("span");
      dots.className = "ctl-dots";
      dotEls[key] = {};
      for (const b of ["low", "mid", "high"]) {
        const d = document.createElement("i");
        d.className = "ctl-dot d-" + b;
        d.title = b + " beat";
        dots.appendChild(d);
        dotEls[key][b] = d;
      }
      row.appendChild(dots);
    }
    row.appendChild(makePopBtn(key));            // +/- button, right of the name
    box.parentNode.insertBefore(row, box);       // row takes the control's menu slot
    breakout.appendChild(box);                   // full control lives in the column (hidden until popped)
    rows[key] = row;
    syncPopBtns(key);
  });
  // Index the layer control block as slot 0. Every per-layer control node is registered
  // under the string that is its id today, so ctl(k) resolves through keyMap instead of
  // getElementById — the same node, by a route that can hold four of them. This runs LAST,
  // after buildControls, buildFilterUI and the POPPABLE pass above, because it walks the
  // finished DOM; from M4a each build pass registers its own nodes as it makes them and
  // this whole-document sweep goes away.
  //
  // #breakout is walked too: the pass above just moved every .ctl out of the block into it,
  // and those nodes are the ones the control sites look up.
  blocks[0] = el("lyrctl");
  for (const host of [el("lyrctl"), el("breakout")]) {
    if (!host) continue;
    if (host.id) ctlReg(0, host.id, host);
    for (const n of host.querySelectorAll("[id]")) ctlReg(0, n.id, n);
  }
  function syncPopBtns(key) {         // keep both the menu-row and the box's button in sync
    const docked = !popped.has(key);
    for (const host of [rows[key], ctl("ctl-" + key)]) {
      const b = host.querySelector(".ctl-pop");
      if (!b) continue;
      b.textContent = docked ? "+" : "−";
      b.title = docked ? "Pop out into its own box" : "Return to the menu";
      b.setAttribute("aria-label", ctlLabel(key) + ": " + b.title);
    }
  }
  function popCtl(key) {
    if (popped.has(key)) return;
    popped.add(key);
    breakout.appendChild(ctl("ctl-" + key));      // append ⇒ boxes stack top→down in click order
    syncPopBtns(key);
    refreshBreakout();
  }
  function dockCtl(key) {
    if (!popped.has(key)) return;
    popped.delete(key);                          // box stays a child of #breakout, just hidden below
    syncPopBtns(key);
    refreshBreakout();
  }
  function togglePop(key) { popped.has(key) ? dockCtl(key) : popCtl(key); }
  // Dock everything. setEffect calls this: a switch is a whole new scene (every
  // slider, chip and palette is swapped out from under you), so a column left over
  // from the last one is stale furniture — start clean and let the user re-pop.
  function dockAll() {
    if (!popped.size) return;
    const keys = [...popped];                    // snapshot: dockCtl mutates the set
    for (const key of keys) dockCtl(key);
  }
  function refreshBreakout() {
    const shown = shownKeys();
    let anyVisible = false;
    for (const key of POPPABLE) {
      const vis = popped.has(key) && shown.has(key);   // shown only when popped AND used by this effect
      ctl("ctl-" + key).style.display = vis ? "" : "none";
      if (vis) anyVisible = true;
    }
    breakout.classList.toggle("empty", !anyVisible);
  }
  // Re-open the pop-out boxes + Orbit editor a layer had open when last selected. Called
  // AFTER setEffect, which dockAll()s the column and — for a non-cardioid effect — closes the
  // Orbit editor, so this rebuilds that layer's surface on a clean slate. Keys the layer no
  // longer uses stay in `popped` but are hidden by refreshBreakout, like the global set.
  // `pops` is passed EXPLICITLY, captured before setEffect ran: setEffect ends in
  // persist() → stackOut() → freezeItem(selected), which re-captures L.popped from the
  // now-empty live `popped` (dockAll just cleared it) and would wipe the stored value before
  // we read it — the same freeze-during-persist trap the layer-extras code documents.
  // (The Orbit editor is NOT restored here — it is a single, scene-wide sticky panel that
  // setEffect shows/hides per `cardWanted` + whether the selected effect is cardioid, so it
  // stays open as you jump between cardioid layers to compare their orbits.)
  function restoreLayerUi(L, pops) {
    if (!L) return;
    if (pops) for (const key of pops) if (ctl("ctl-" + key)) popCtl(key);
  }

  // A preset is a named full scene (effect + all its settings). Auto-cycle holds
  // each for a random time drawn from the Preset TTL range, then applies a random
  // *different* saved preset.
  let nextSwitch = 0;
  cycleChk.addEventListener("change", () => { cycleOn = cycleChk.checked; nextSwitch = 0; syncTtlEnabled(); });
  // Stop the cycler dead. Called when the user has just deliberately put a specific
  // scene on screen — creating a preset, or restoring a backup. Without it the next
  // tick of the TTL would swap that scene straight back out, which reads as "my new
  // preset wasn't selected" when in fact it was selected and then cycled away from.
  function stopCycling() {
    if (!cycleOn && !nextSwitch) return;
    cycleOn = false; cycleChk.checked = false; nextSwitch = 0;
    syncTtlEnabled();
  }
  function ttlMs() {
    const a = Math.min(+el("ttl-lo").value, +el("ttl-hi").value);
    const b = Math.max(+el("ttl-lo").value, +el("ttl-hi").value);
    return (a + Math.random() * (b - a)) * 1000;
  }
  // The scenes the cycler is allowed to pick from: the ticked ones (see inRotation).
  // Rebuilt per tick rather than cached — the ticks, the library and the collections all
  // change under it, and a stale pool would cycle to a scene that no longer exists.
  function rotationPool() {
    const pool = [];
    for (let i = 0; i < presets.length; i++) if (inRotation(presets[i])) pool.push(i);
    return pool;
  }
  function cyclePresets(now) {
    const pool = rotationPool();
    // Something to switch TO: two or more ticked scenes, or exactly one that isn't the one
    // already on screen (having hand-picked an unticked scene, the cycle should still take
    // you back into the show). Untick everything and the cycler simply idles — it does not
    // fall back to the whole library, because "none in the rotation" is a real choice.
    const canSwitch = pool.length > 1 || (pool.length === 1 && pool[0] !== curPreset);
    if (!cycleOn || !canSwitch || Math.max(+el("ttl-lo").value, +el("ttl-hi").value) <= 0) { nextSwitch = 0; return; }
    if (!nextSwitch) { nextSwitch = now + ttlMs(); return; }
    if (now >= nextSwitch) {
      let n; do { n = pool[(Math.random() * pool.length) | 0]; } while (n === curPreset && pool.length > 1);
      applyPreset(n);
      nextSwitch = now + ttlMs();
    }
  }
  el("ttl-lo").addEventListener("input", () => nextSwitch = 0);   // reschedule on retune
  el("ttl-hi").addEventListener("input", () => nextSwitch = 0);
  // Switching effect is an EDIT TO THE SELECTED PRESET, not a reason to leave it.
  //
  // This has now been all three ways round, so the reasoning is worth keeping. It used
  // to deselect (drop to "— unsaved scene —"), because the delegated autosave folded the
  // switch into the selected preset and a preset carries its own effect: pick
  // "Sirpinfyer", switch to Tunnel, and that preset became a Tunnel scene under its old
  // name. Then it auto-selected a preset belonging to the new effect, which kept you on a
  // named scene but still moved you off *your* one.
  //
  // Both were solving for the wrong thing. A preset is "my scene", and changing its
  // effect is just another edit to it — the same as moving a slider. So: stay put, and
  // fold the new effect straight in. The consequence is real and intended, not a bug to
  // re-fix later: a preset named after the effect it started as will keep that name after
  // you change the effect. Rename it if that bothers you.
  //
  // autosavePreset() early-returns while curPreset < 0, so "— unsaved scene —" still
  // behaves as a scratch mode and nothing is written.
  effectSel.addEventListener("change", () => {
    setEffect(+effectSel.value);
    autosavePreset();
    persist();
    nextSwitch = 0;
  });
  // A new layer starts on the same effect as the selected one — you almost always want
  // to pick its effect next anyway, and copying the selection is a less surprising
  // starting point than an arbitrary one. It ships max/gain 1 and unmuted: three
  // additive layers at full gain clip an R8 buffer to white everywhere, which reads as
  // "the palette broke" rather than "turn the gain down".
  el("addlayer").addEventListener("click", () => {
    addStackItem(effect);
    autosavePreset();
    persist();
  });
  paletteSel.addEventListener("change", () => {
    // A manual pick must land on the palette you chose. While cycling, blend TO it from
    // what's on screen (then the cycle carries on from there) — NOT startMorph(), which
    // heads to a random OTHER palette and made a click look like it selected at random.
    if (morphing) beginMorph(paletteBase.slice(), +paletteSel.value);
    else { morphOnce = false; setPalette(+paletteSel.value); }   // manual pick cancels a one-shot morph
    syncPalSwatches();                                           // keep the preview highlight in step
  });
  // Reverse the colour order for the selected layer. Re-bakes the LUT immediately (the
  // multi-layer path re-bakes per frame via bakeLayerBytes); onEdit persists + autosaves it.
  const palrevChk = el("palrev");
  palrevChk.addEventListener("change", () => {
    paletteReverse = palrevChk.checked;
    composePalette(0);
    paletteDirty = true;
    captureLayerExtras(stack[stackSel]);   // so the selected layer owns the new value at once
  });
  // Background (heat 0): black / white / palette. Same re-bake + capture path as reverse.
  const palbgSel = el("palbg");
  palbgSel.addEventListener("change", () => {
    paletteBg = bgOk(palbgSel.value);
    composePalette(0);
    paletteDirty = true;
    captureLayerExtras(stack[stackSel]);
  });
  // The Palette cycle slider replaces the old auto-morph checkbox: any edit
  // re-derives `morphing` and (re)starts or pins the blend.
  function syncMorphFromSlider() {
    const on = palCycleOn();
    if (on === morphing) return;
    morphing = on;
    if (morphing) startMorph(+paletteSel.value);
    else { morphOnce = false; setPalette(+paletteSel.value); }   // pinned: settle on the shown palette
  }
  function setPalCycle(lo, hi) {
    const a = ctl("palcycle-lo"), b = ctl("palcycle-hi");
    if (!a || !b) return;
    a.value = lo; b.value = hi;
    a.dispatchEvent(new Event("input")); b.dispatchEvent(new Event("input"));
  }
  for (const id of ["palcycle-lo", "palcycle-hi"])
    el(id).addEventListener("input", syncMorphFromSlider);
  // Persist any control change (slider drag, select, checkbox) — one delegated
  // listener over the whole panel covers them all. When a preset is selected the
  // edit is auto-saved into it; in "— unsaved scene —" it just updates the working scene.
  function onEdit(e) {
    // A dev tool must never be folded into a preset. This used to be a `#diag` check, but that
    // section is gone and its one surviving toggle (the beat trace) now sits INSIDE the Beat
    // tuning box — which deliberately does not escape this listener, because its sliders are
    // per-preset scene data and must autosave. So the opt-out is per-element and explicit,
    // which also means a future dev control can live anywhere and still opt out.
    if (e.target.closest("[data-nopersist]")) return;
    if (e.target.closest(".rng-edit")) return;   // bounds fields persist via the input they dispatch on the slider
    refreshBlocked();                        // a thumb move can neutralise (or free) a dependent control
    refreshChanged();                        // a thumb move can move a slider off (or back to) its default
    if (persistReady && !applyingPreset && e.target.id !== "preset") autosavePreset();
    persist();
  }
  // Click a greyed (blocked) control row → flash the setting that's neutralising it, so it's
  // obvious what to change first. The +/- button is pointer-events:none while blocked, so a
  // click here can only be on the row body.
  panel.addEventListener("click", e => {
    const row = e.target.closest(".ctl-row.ctl-blocked");
    if (row && row.dataset.blocker) flashCtl(row.dataset.blocker);
  });
  // Beat chips are <button>s, so they never fire input/change and the delegated
  // listener above can't see them. Same body, minus the target-based guards.
  function chipEdited() {
    if (persistReady && !applyingPreset) autosavePreset();
    persist();
  }
  panel.addEventListener("input", onEdit);
  panel.addEventListener("change", onEdit);
  breakout.addEventListener("input", onEdit);    // popped controls live outside #panel — persist their edits too
  breakout.addEventListener("change", onEdit);

  // Reset: restore *only the current effect's* settings (sliders, beat chips,
  // palette, auto-morph, show-box and TTL) to their preset defaults. It doesn't
  // change the effect, other effects, or the shared controls (auto-cycle, panel).
  el("reset").addEventListener("click", () => {
    // Confirm first — this throws away every change to the effect (values, ranges, beat
    // wiring, palette) and is not undoable.
    if (!confirm("Reset " + EFFECTS[effect].name + " to its shipped defaults?\nYour changes to this effect (sliders, ranges, beats, palette) will be lost.")) return;
    states[effect] = presetState(effect);
    beatStates[effect] = presetBeat(effect);
    pulseStates[effect] = presetPulse(effect);
    plenStates[effect] = presetPlen(effect);
    extras[effect] = presetExtra(effect);
    // Shipped BOUNDS too, matching the per-slider ↺ — this used to reset every value
    // and leave a slider you had widened still widened, so "reset" left the control
    // measurably not as it ships. Same scope as the values above (every key in this
    // effect's defaults, filter params included), and bounds go first so loadState's
    // values validate against them rather than the custom ones.
    for (const key in states[effect])
      for (const inp of ctlRangeInputs(key)) {
        const o = RNG_ORIG[inp.id];
        if (o) { inp.min = o.min; inp.max = o.max; inp.step = o.step; }
      }
    loadState(effect);                // apply to the live sliders
    loadBeat(effect);                 // ...the live chips
    loadPulse(effect);                // ...the live pulse shapes
    loadPlen(effect);                 // ...and their lengths
    loadExtra(effect);                // ...and palette/morph/show-box/TTL
    rngSyncAll();                     // the in-box min/max fields follow the restored bounds
    refreshControlVisibility();       // clear the modified-from-default dots (and blocked state) now everything is back to shipped
    persist();
  });

  // Beat chips dominate the share blob: every control × L/M/H for every effect,
  // almost all false — ~90% of the JSON, which pushed share URLs past 49k chars.
  // That's long enough that chat clients truncate the link (a truncated ?s= just
  // fails JSON.parse and silently opens the default scene) and TinyURL rejects it
  // outright. So send only the chips that DIFFER from the effect's own default
  // selection: applyBlob skips ids/bands a blob doesn't mention, leaving them at
  // the default the state was seeded with, so a diff decodes to the same thing.
  // Pruning is share-only — localStorage and Backup have no length limit and stay
  // verbose, and an older full blob still loads unchanged (a superset of a diff).
  function pruneBeats(all) {
    const out = {};
    for (const e in all) {
      const def = presetBeat(e), keep = {};
      for (const id in all[e]) {
        const cur = all[e][id], d = def[id], diff = {};
        for (const band of ["low", "mid", "high"]) if (!d || cur[band] !== d[band]) diff[band] = cur[band];
        if (Object.keys(diff).length) keep[id] = diff;
      }
      if (Object.keys(keep).length) out[e] = keep;
    }
    return out;
  }
  // Same idea for pulse shapes: keep only sliders whose shape differs from the
  // effect's default (almost always "snap"), so they cost nothing in the common case.
  function prunePulses(all) {
    const out = {};
    for (const e in all) {
      const def = presetPulse(e), keep = {};
      for (const id in all[e]) if (all[e][id] !== (def[id] || PULSE_DEFAULT)) keep[id] = all[e][id];
      if (Object.keys(keep).length) out[e] = keep;
    }
    return out;
  }
  // ...and for pulse lengths (almost always the default PULSE_DROP).
  function prunePlens(all) {
    const out = {};
    for (const e in all) {
      const def = presetPlen(e), keep = {};
      for (const id in all[e]) if (all[e][id] !== (def[id] || PULSE_DROP)) keep[id] = all[e][id];
      if (Object.keys(keep).length) out[e] = keep;
    }
    return out;
  }

