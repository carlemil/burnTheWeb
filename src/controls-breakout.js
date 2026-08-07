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
  // Keyed "<slot>/<key>", not by key alone, so layer 1's Speed box and layer 3's Speed box
  // are two different things and can be open at the same time. A SCENE control has one box
  // for the whole page and is keyed "s/<key>".
  const popped = new Set();
  const popKey = (slot, key) => (slot < 0 ? "s" : slot) + "/" + key;
  const isPopped = (slot, key) => popped.has(popKey(slot, key));
  const rows = {};                   // key -> menu row element (name + +/- button)
  const POPPABLE = CONTROLS.filter(c => c.type === "dual" || c.type === "plain").map(c => c.key);
  // A scene control has ONE box for the whole page, so its popped-state is keyed "s/<key>"
  // whichever block's launcher row you clicked. The sweeps below loop over the four blocks
  // and would otherwise ask about "2/bloom", which is nobody's key — so fold those keys to
  // the scene slot up front, in the one place that reads a slot back out of the set.
  const SCENE_POP_KEYS = new Set(POPPABLE.filter(k => {
    const c = CONTROLS.find(x => x.key === k);
    return !!c && isSceneCtl(c);
  }));
  const popSlot = (slot, key) => (SCENE_POP_KEYS.has(key) ? -1 : slot);
  const ctlLabel = key => { const c = CONTROLS.find(x => x.key === key); return c ? c.label : key; };
  function makePopBtn(slot, key) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ctl-pop";
    b.addEventListener("click", () => togglePop(slot, key));
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
  function ctlRangeInputs(key) { return ctlRangeInputsIn(stackSel, key); }
  function ctlRangeInputsIn(slot, key) {   // a dual's two thumbs share one set of bounds
    const g = k => ctlIn(slot, k) || el(k);      // el() covers the scene controls, which have ids
    const lo = g(key + "-lo"), hi = g(key + "-hi");
    if (lo && hi) return [lo, hi];
    const p = g(key);
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
  // External ▲/▼ steppers for a number field, SIDE BY SIDE after it — the native in-field
  // spinner arrows are a few pixels wide and nearly impossible to aim at, which is the
  // problem the blend row's steppers already solved, so this copies that pattern. The
  // field keeps keyboard entry (.no-spin only hides the native arrows); the buttons step
  // by `getStep()` (default: the field's own step attribute, else 1), clamp to the
  // field's min/max where set, and dispatch bubbling input+change so every existing
  // listener — including the delegated onEdit — fires exactly as if the value was typed.
  function addNumArrows(f, getStep) {
    f.classList.add("no-spin");
    const wrap = document.createElement("span");
    wrap.className = "num-arrows";
    const mk = (glyph, dir) => {
      const b = document.createElement("b");
      b.className = "num-arrow"; b.textContent = glyph;
      b.title = (dir > 0 ? "Increase " : "Decrease ") + (f.title || "value");
      b.setAttribute("aria-label", b.title);
      b.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        const st = getStep ? getStep() : (+f.step > 0 ? +f.step : 1);
        let v = Math.round(((+f.value || 0) + dir * st) * 1e6) / 1e6;
        if (f.min !== "" && v < +f.min) v = +f.min;
        if (f.max !== "" && v > +f.max) v = +f.max;
        f.value = String(v);
        f.dispatchEvent(new Event("input", { bubbles: true }));
        f.dispatchEvent(new Event("change", { bubbles: true }));
      });
      wrap.appendChild(b);
    };
    mk("▲", 1); mk("▼", -1);
    f.after(wrap);
    return wrap;
  }
  function makeRangeEditor(slot, key) {
    const els = ctlRangeInputsIn(slot, key);
    if (!els.length) return null;
    const box = document.createElement("div");
    box.className = "rng-edit";
    // ONE ROW PER FIELD, each starting with its title: label · field · ▲/▼, and a fourth
    // "Reset" row for ↺. Three side-by-side columns could not hold a field plus its
    // stepper pair — max spilled out of the box.
    const fields = {};
    for (const which of ["min", "max", "step"]) {
      const cell = document.createElement("label");
      cell.className = "rng-cell";
      const lbl = document.createElement("span");
      lbl.className = "rng-lbl"; lbl.textContent = which;
      cell.appendChild(lbl);
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
      const line = document.createElement("span");
      line.className = "num-line";
      line.appendChild(f);
      cell.appendChild(line);
      // nudge by the slider's LIVE step (the step field edits it), else 1
      addNumArrows(f, () => +els[0].step > 0 ? +els[0].step : 1);
      box.appendChild(cell);
      fields[which] = f;
    }
    const sync = () => { for (const w in fields) fields[w].value = w === "step" ? stepFieldVal(els[0].step) : els[0][w]; };
    rngSyncs.push(sync);
    const rst = document.createElement("button");
    rst.type = "button"; rst.className = "rng-rst"; rst.textContent = "↺";
    rst.title = "Reset this slider — value, range, beat chips and pulse — to this effect's defaults";
    rst.setAttribute("aria-label", ctlLabel(key) + ": reset to defaults");
    rst.addEventListener("click", e => { e.preventDefault(); resetControl(key); sync(); });
    // The Reset row is NOT part of the Value range section: it resets the whole control
    // (value, range, chips, pulse), so it lives at the FOOT of the box, under the trigger
    // section, behind its own divider — dressBox places it.
    const rcell = document.createElement("div");   // a div, not a label — a label would
    rcell.className = "rng-cell ctl-reset";        // re-trigger the button on text clicks
    const rlbl = document.createElement("span");
    // "reset slider" (lowercase like the other row labels) — the layer block's big
    // "Reset this effect" button uses the same word for a much bigger scope.
    rlbl.className = "rng-lbl"; rlbl.textContent = "reset slider";
    rcell.appendChild(rlbl);
    rcell.appendChild(rst);
    // The bounds fold into a COLLAPSIBLE "Value range" section, closed by default
    // (bounds are set-once knobs). Its own ? explains min/max/step — that blurb no longer
    // rides every control's main ? (openRangeHelp vs openCtlHelp).
    const sec = document.createElement("details");
    sec.className = "rng-sec";
    const sum = document.createElement("summary");
    sum.textContent = "Value range";
    const hq = document.createElement("button");
    hq.type = "button"; hq.className = "ctl-help"; hq.textContent = "?";
    hq.title = "What min / max / step do";
    hq.setAttribute("aria-label", "Value range — help");
    hq.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); openRangeHelp(); });
    sum.appendChild(hq);
    sec.appendChild(sum);
    sec.appendChild(box);
    return { sec, reset: rcell };
  }

  // Who a control belongs to, for the box title. CTL_GROUPS already carries the human
  // name of every family — effects ("Plasma", "Cardioid seed"), the shared ones
  // ("Camera", "Shape & motion") and the filters. Filters get an explicit prefix so
  // "Fire" the filter can't be read as Fire the effect family.
  // ...and WHICH LAYER'S, since two layers running the same effect would otherwise give two
  // boxes with identical titles sitting side by side in the column.
  function ctlOwner(slot, key) {
    const c = CONTROLS.find(x => x.key === key);
    const g = c && c.group;
    const own = (!g || !CTL_GROUPS[g]) ? "" : (g.startsWith("f_") ? "Filter · " : "") + CTL_GROUPS[g];
    return slot < 0 ? own : "L" + (slot + 1) + (own ? " · " + own : "");
  }
  // The layer number is the one part of a box title that changes while the box is open — a
  // reorder moves the layer it belongs to — so it is re-stamped rather than baked in.
  function syncPopOwners() {
    for (let slot = 0; slot < STACK_MAX; slot++) for (const key of POPPABLE) {
      const box = ctlIn(slot, "ctl-" + key);
      const t = box && box.querySelector(".ctl-owner .own-txt");
      if (t) t.textContent = ctlOwner(slot, key);
    }
  }
  // The box's own furniture — owner line, bounds editor, dock button. Split out because the
  // SCENE pass below dresses one box for the whole page rather than one per block.
  function dressBox(slot, key, box) {
    box.classList.add("poppable");
    // Title line, first child so it sits above the label. Only ever visible in
    // #breakout: the menu slot shows the .ctl-row launcher, never the .ctl itself.
    // Always built (even with no owner group) so it can carry the per-box help ?.
    const own = ctlOwner(slot, key);
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
    const rngEd = makeRangeEditor(slot, key);
    if (rngEd) {
      const anchor = box.querySelector(".trig-t");
      box.insertBefore(rngEd.sec, anchor);
      if (anchor) {
        const hr = document.createElement("div");
        hr.className = "ctl-div";
        box.insertBefore(hr, anchor);
      }
      // Reset closes the box: below the trigger section, behind its own divider.
      const hr2 = document.createElement("div");
      hr2.className = "ctl-div";
      box.appendChild(hr2);
      box.appendChild(rngEd.reset);
    }
    box.appendChild(makePopBtn(slot, key));      // the box's own dock button (left gutter in #breakout)
  }
  // The launcher that stays in the menu slot: the control's name, its beat dots and the
  // +/- button. `slot` is the POP slot — -1 for a scene control, which has no wiring
  // record in W and therefore no chips to mirror. (None of the scene controls declares
  // `beat`, so no dots are lost; arm one and it would need a home for a second `w.dots`.)
  function makeLauncherRow(slot, key) {
    const row = document.createElement("div");
    row.className = "ctl-row";
    const name = document.createElement("span");
    name.className = "ctl-row-name"; name.textContent = ctlLabel(key);
    row.appendChild(name);
    // Beat dots, left of the +/- button. Only for sliders that have chips at all —
    // `plain` controls are poppable but never armed, so they get no dots.
    const w = W[slot] && W[slot][key];
    if (w && w.chips) {
      const dots = document.createElement("span");
      dots.className = "ctl-dots";
      const dm = w.dots = {};
      for (const b of ["low", "mid", "high"]) {
        const d = document.createElement("i");
        d.className = "ctl-dot d-" + b;
        d.title = b + " beat";
        dots.appendChild(d);
        dm[b] = d;
      }
      row.appendChild(dots);
    }
    row.appendChild(makePopBtn(slot, key));      // +/- button, right of the name
    return row;
  }
  // Once PER BLOCK. Each block's .ctl boxes get their own owner line, bounds editor, pop
  // button and launcher row, and each is exported into the one #breakout column;
  // refreshBreakout is what keeps only the selected layer's boxes visible.
  for (let slot = 0; slot < STACK_MAX; slot++) POPPABLE.forEach(key => {
    const box = ctlIn(slot, "ctl-" + key);
    if (!box) return;                            // a scene control is not in any block's map
    box.dataset.slot = String(slot);
    dressBox(slot, key, box);
    const row = makeLauncherRow(slot, key);
    box.parentNode.insertBefore(row, box);       // row takes the control's menu slot
    breakout.appendChild(box);                   // full control lives in the column (hidden until popped)
    const w = W[slot] && W[slot][key];
    if (w) w.row = row;
    ctlReg(slot, "row-" + key, row);
  });
  // ---- the SCENE filter params: one box, N rows ---------------------------------
  // A scene control carries an `id` rather than `data-k` and is generated in slot 0 only,
  // so `ctlIn` — a map lookup over the [data-k] nodes — never finds it and the pass above
  // skipped every one. That left Bloom, Barrel, Scanlines, Vignette and Film grain with no
  // slider anywhere: buildFilterUI could not adopt them into their <details> either (same
  // lookup), so they stayed behind in #filterctl, which buildFilterUI then hides. Expanding
  // Bloom showed an empty body and Strength was unreachable. Fire lost `Burn rate` the same
  // way and kept only `Rise`.
  //
  // The rest of this module already anticipates the shape of the fix — popKey's "s/" prefix,
  // refreshBreakout's scene loop, syncPopBtns' "one box, N rows", remapPopped's `s === "s"`
  // skip, ctlOwner dropping the "L2 ·" prefix at slot < 0. Only the construction was missing.
  // So: ONE box in the column, popped as "s/<key>", and one launcher row in EVERY block's
  // copy of that filter's section, because the section is per block and the value is not.
  //
  // Driven off FILTERS rather than POPPABLE so the rows land in the order the filter
  // declares its params (Fire: Rise, then Burn rate). Only filter params are done here:
  // ttl/tdur are scene controls too, but they have one home in the Scene box and already
  // render there in full, so they need no launcher.
  FILTERS.forEach(f => (f.params || []).forEach(key => {
    const c = CONTROLS.find(x => x.key === key);
    if (!c || !isSceneCtl(c) || !POPPABLE.includes(key)) return;
    const box = el("ctl-" + key);
    if (!box) return;
    dressBox(-1, key, box);                      // no data-slot: this box belongs to no layer
    breakout.appendChild(box);
    // One row per block. `secs` is keyed by slot, but a plain query keeps this independent
    // of that map and returns the bodies in block order, which is what the rows want.
    document.querySelectorAll('.filter-sec[data-fid="' + f.id + '"] > .filter-body')
      .forEach((body, slot) => {
        const row = makeLauncherRow(-1, key);
        body.appendChild(row);
        if (slot === 0) rows[key] = row;         // a scene control has no wiring record to hang it on
        ctlReg(slot, "row-" + key, row);
      });
  }));
  // The launcher rows and beat dots are the last per-block pieces to exist, so install
  // slot 0 into the singleton maps now that its record is complete.
  pointMaps(0);
  for (let slot = 0; slot < STACK_MAX; slot++) POPPABLE.forEach(k => syncPopBtns(slot, k));

  function syncPopBtns(slot, key) {   // keep both the menu-row and the box's button in sync
    slot = popSlot(slot, key);
    const docked = !isPopped(slot, key);
    const hosts = slot < 0
      ? ctlEach("row-" + key).concat([rows[key], el("ctl-" + key)])   // a scene control: one box, N rows
      : [ctlIn(slot, "row-" + key), ctlIn(slot, "ctl-" + key)];
    for (const host of hosts) {
      if (!host) continue;
      const b = host.querySelector(".ctl-pop");
      if (!b) continue;
      b.textContent = docked ? "+" : "−";
      b.title = docked ? "Pop out into its own box" : "Return to the menu";
      b.setAttribute("aria-label", ctlLabel(key) + ": " + b.title);
    }
  }
  function popCtl(slot, key) {
    if (isPopped(slot, key)) return;
    popped.add(popKey(slot, key));
    const b = slot < 0 ? el("ctl-" + key) : ctlIn(slot, "ctl-" + key);
    if (b) breakout.appendChild(b);              // append ⇒ boxes stack top→down in click order
    syncPopBtns(slot, key);
    refreshBreakout();
  }
  function dockCtl(slot, key) {
    if (!isPopped(slot, key)) return;
    popped.delete(popKey(slot, key));            // box stays a child of #breakout, just hidden below
    syncPopBtns(slot, key);
    refreshBreakout();
  }
  function togglePop(slot, key) { isPopped(slot, key) ? dockCtl(slot, key) : popCtl(slot, key); }
  // `popped` is keyed by SLOT, so a reorder has to move its entries the way moveOpen moves the
  // fold set — you popped a LAYER's slider, not a position's. Without this the open box stayed
  // where it was and silently started showing (and editing) whichever layer slid into that slot,
  // while its "L3" title stayed right for the slot and wrong for the layer.
  function remapPopped(fn) {
    const was = [...popped];
    popped.clear();
    for (const pk of was) {
      const i = pk.indexOf("/"), s = pk.slice(0, i), key = pk.slice(i + 1);
      if (s === "s") { popped.add(pk); continue; }        // a scene control belongs to no layer
      const n = fn(+s);
      if (n >= 0) popped.add(popKey(n, key));
    }
    // Re-derive what is on screen. Remapping the SET is not enough on its own: which box is
    // visible is decided by refreshBreakout, and the +/- glyphs by syncPopBtns, so without
    // this the entries moved and the column did not — the box stayed on its old slot and
    // carried on showing whichever layer had just slid into it.
    for (let slot = 0; slot < STACK_MAX; slot++) for (const k of POPPABLE) syncPopBtns(slot, k);
    refreshBreakout();
  }
  function movePopped(from, to) {
    remapPopped(s => { if (s === from) return to; let n = s > from ? s - 1 : s; return n >= to ? n + 1 : n; });
  }
  function dropPopped(j) { remapPopped(s => (s === j ? -1 : s > j ? s - 1 : s)); }
  // Dock everything. NOTHING CALLS THIS AUTOMATICALLY any more, and that is the point of
  // per-slot boxes: setEffect, createPreset, Delete and the preset picker all used to empty
  // the column, which is exactly what would stop two layers' boxes sitting side by side —
  // the moment you clicked the other layer to compare, both would close. The column is
  // yours to curate now; a box whose control the layer no longer uses simply hides itself
  // (refreshBreakout), and re-appears if you come back to an effect that has it.
  // Kept because it is one line to call and the obvious thing to want from a keyboard.
  function dockAll() {
    if (!popped.size) return;
    for (const pk of [...popped]) {              // snapshot: dockCtl mutates the set
      const i = pk.indexOf("/");
      dockCtl(pk[0] === "s" ? -1 : +pk.slice(0, i), pk.slice(i + 1));
    }
  }
  // #breakout holds one .ctl per POPPABLE key PER BLOCK. A box shows when ITS OWN slot/key
  // has been popped and the layer that owns it still uses that control — so boxes from
  // different layers coexist, and one whose layer changed to an effect without that slider
  // hides itself rather than lying.
  // #breakout is outside #stacklist, so a box there gets no selection from its layer's row.
  // Each box is stamped with its slot; touching or focusing one selects that layer, exactly
  // as pressing anywhere in the row does. Capture phase, so it runs before the control acts
  // and a drag started in another layer's box applies to an already-selected layer.
  for (const ev of ["pointerdown", "focusin"]) breakout.addEventListener(ev, e => {
    const box = e.target.closest(".ctl[data-slot]");
    if (!box) return;                             // a scene control's box belongs to no layer
    const slot = +box.dataset.slot;
    if (slot !== stackSel && stack[slot]) selectStack(slot);
  }, true);
  function refreshBreakout() {
    let anyVisible = false;
    for (let slot = 0; slot < STACK_MAX; slot++) {
      const shown = shownKeysFor(slot);
      for (const key of POPPABLE) {
        const box = ctlIn(slot, "ctl-" + key);
        if (!box) continue;
        const vis = isPopped(slot, key) && shown.has(key) && !!stack[slot];
        box.style.display = vis ? "" : "none";
        if (vis) anyVisible = true;
      }
    }
    // ...and the scene controls, which have one box outside every block. Gated on the UNION
    // of every live layer's shown keys, not the selected layer's: a scene-wide filter param
    // (Bloom, Scanlines…) belongs to the whole picture, so the Strength box you popped from
    // layer 2's section must not vanish because you clicked layer 1, whose chain lacks Bloom
    // — the filter is still rendering. (`stackSel` alone was fine while these boxes could not
    // be constructed; the scene-filter-params fix made them real.)
    const sceneShown = new Set(shownKeysFor(stackSel));
    for (let s = 0; s < STACK_MAX; s++)
      if (s !== stackSel && stack[s]) for (const k of shownKeysFor(s)) sceneShown.add(k);
    for (const key of POPPABLE) {
      const box = el("ctl-" + key);
      if (!box) continue;
      const vis = isPopped(-1, key) && sceneShown.has(key);
      box.style.display = vis ? "" : "none";
      if (vis) anyVisible = true;
    }
    breakout.classList.toggle("empty", !anyVisible);
  }
  // Nothing to restore any more: a box belongs to its SLOT and stays open until you close
  // it, so switching layers no longer takes any boxes away and there is nothing to put back.
  // This used to exist because setEffect emptied the column on every switch, and it had to
  // be handed the layer's list explicitly, captured before setEffect ran — setEffect ends in
  // persist() → stackOut() → freezeItem(selected), which would re-capture L.popped from the
  // just-cleared live set and wipe the stored value before it could be read. Both the field
  // and that trap are gone with the auto-clear.
  function restoreLayerUi(L, pops) {
    if (!L) return;

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
  // There is no scratch mode to fall back on: a scene is ALWAYS selected, so this write
  // always lands somewhere. Press New first if you want to keep the original.
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
  // Accessors over ctl(), not captured nodes: there is one of these per block and the live
  // value belongs to the selected layer. Reading and writing sites stay written as they were.
  const palrevChk = { get checked() { const n = ctl("palrev"); return !!n && n.checked; },
                      set checked(v) { for (const n of ctlEach("palrev")) n.checked = v; } };
  for (let slot = 0; slot < STACK_MAX; slot++) ctlIn(slot, "palrev").addEventListener("change", () => {
    paletteReverse = palrevChk.checked;
    composePalette(0);
    paletteDirty = true;
    captureLayerExtras(stack[stackSel]);   // so the selected layer owns the new value at once
  });
  // Background (heat 0): black / white / palette. Same re-bake + capture path as reverse.
  const palbgSel = { get value() { const n = ctl("palbg"); return n ? n.value : "palette"; },
                     set value(v) { for (const n of ctlEach("palbg")) n.value = v; } };
  for (let slot = 0; slot < STACK_MAX; slot++) ctlIn(slot, "palbg").addEventListener("change", () => {
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
  // Per block: palcycle is a layer control, so there is one pair of thumbs per stack slot.
  for (let slot = 0; slot < STACK_MAX; slot++)
    for (const id of ["palcycle-lo", "palcycle-hi"])
      ctlIn(slot, id).addEventListener("input", syncMorphFromSlider);
  // Persist any control change (slider drag, select, checkbox) — one delegated
  // listener over the whole panel covers them all. A scene is always selected, so the edit is
  // always auto-saved into one — there is no longer a mode where it goes nowhere.
  function onEdit(e) {
    // A dev tool must never be folded into a preset. This used to be a `#diag` check, but that
    // section is gone and its one surviving toggle (the beat trace) now sits INSIDE the Beat
    // tuning box — which deliberately does not escape this listener, because its sliders are
    // per-preset scene data and must autosave. So the opt-out is per-element and explicit,
    // which also means a future dev control can live anywhere and still opt out.
    if (e.target.closest("[data-nopersist]")) return;
    if (e.target.closest(".rng-edit")) return;   // bounds fields persist via the input they dispatch on the slider
    refreshBlocked();                        // a thumb move can neutralise (or free) a dependent control
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
  for (let slot = 0; slot < STACK_MAX; slot++) ctlIn(slot, "reset").addEventListener("click", () => {
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
        const o = rngShipped(rngKeyOf(inp));    // this effect's own bounds where it declares them
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

