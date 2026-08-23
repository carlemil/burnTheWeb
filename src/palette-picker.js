  // ---- palette preview picker -----------------------------------------------
  // A gradient swatch per palette, so you can SEE each ramp instead of reading a
  // name off a dropdown. The swatches are pure presentation + a click that drives
  // the existing <select> (set value + dispatch change), so the morph/setPalette
  // handler and the delegated persist/autosave fire exactly as a manual pick does —
  // no new state, no new persistence. The <select> stays in the DOM as the value
  // store (showMorphTarget/applyLayerExtras still set it, validation still reads its
  // options); JS hides it, so a JS failure leaves the native dropdown usable.
  function palGradientCss(i) {
    const fn = PALETTES[i].fn, stops = [], N = 24;
    for (let s = 0; s <= N; s++) {
      const c = fn(Math.round(s / N * 255));
      stops.push("rgb(" + clamp(c[0]) + "," + clamp(c[1]) + "," + clamp(c[2]) + ") " + Math.round(s / N * 100) + "%");
    }
    return "linear-gradient(to right, " + stops.join(",") + ")";
  }
  // Highlight the selected layer's strip from the live <select>, and every other block's from
  // that layer's own stored palette — read through the same fallback layerPalIndex uses.
  function syncPalSwatches() {
    for (let slot = 0; slot < STACK_MAX; slot++) {
      const host = ctlIn(slot, "palswatches");
      if (!host) continue;
      const L = stack[slot];
      const cur = slot === stackSel || !L ? paletteSel.value
        : String(L.palette != null ? L.palette : presetExtra(L.fx).palette);
      host.querySelectorAll(".palsw").forEach(b => b.classList.toggle("active", b.dataset.pal === cur));
    }
  }
  // The <select>'s <option>s ARE the value store, but their list is generated from PALETTES
  // (the single source — names live there) rather than hand-written in the HTML, so adding a
  // palette needs only a PALETTES entry. The option value is still the index, read for
  // validation. There is ONE store for every block, so this half runs once.
  //
  // Every caller must go through here rather than rebuilding a single strip — setPalUse,
  // setPalUseAll, applyBlob's custom install and palRemapDeleted all shift what the indices
  // mean, and a block left with stale data-pal would pick a different ramp than it shows.
  function buildPalSwatches() {
    const cur = paletteSel.value;
    paletteSel.innerHTML = "";
    palByName().forEach(i => {              // by name for the reader; `value` is still the index
      const o = document.createElement("option");
      o.value = String(i); o.textContent = PALETTES[i].name;
      paletteSel.appendChild(o);
    });
    if (cur) paletteSel.value = cur;
    for (let slot = 0; slot < STACK_MAX; slot++) buildPalStrip(slot);
    syncPalSwatches();
  }
  function buildPalStrip(slot) {
    const host = ctlIn(slot, "palswatches");
    if (!host) return;
    host.innerHTML = "";
    palByName().forEach(i => {
      const p = PALETTES[i];
      // Only the palettes in use — plus whichever is selected, always, or picking a scene
      // that stores an unticked ramp would leave the strip with no highlight at all.
      if (!palInUse(i) && String(i) !== paletteSel.value) return;
      // A wrapper, because the swatch is a <button> and HTML forbids nesting one inside it —
      // the edit + is a SIBLING positioned over the swatch's right edge.
      const w = document.createElement("div");
      w.className = "palsw-wrap";
      const b = document.createElement("button");
      b.type = "button"; b.className = "palsw"; b.dataset.pal = String(i);
      b.style.background = palGradientCss(i);
      b.title = p.name + (p.custom ? " (custom)" : "");
      const n = document.createElement("span");
      n.className = "palsw-n"; n.textContent = p.name;
      b.appendChild(n);
      b.addEventListener("click", () => {
        // paletteSel is the SELECTED layer's store, so a pick in another layer's strip has to
        // select it first. The row's capture-phase pointerdown already did that for a real
        // click; this makes it true for a synthetic one too, and costs nothing when it did.
        if (slot !== stackSel && stack[slot]) selectStack(slot);
        paletteSel.value = String(i);
        paletteSel.dispatchEvent(new Event("change", { bubbles: true }));   // morph/setPalette + persist
        syncPalSwatches();
      });
      w.appendChild(b);
      // Only CUSTOMS carry an edit button now. The old + on a built-in ("make an editable
      // copy") moved into the picker as Create new — new palettes start from a plain RGB
      // ramp there instead of shadow-copying whichever ramp you happened to hover.
      if (p.custom) {
        const e = document.createElement("button");
        e.type = "button"; e.className = "palsw-edit"; e.textContent = "✎";
        e.title = "Edit this palette";
        e.setAttribute("aria-label", e.title);
        e.addEventListener("click", ev => {
          ev.stopPropagation();
          if (slot !== stackSel && stack[slot]) selectStack(slot);
          openPalEditor(i);
        });
        w.appendChild(e);
      }
      host.appendChild(w);
    });
    // A labelled tile at the end of the strip opens the in-use picker — same width and
    // rhythm as the ramps so the strip reads as one object. It used to say just "+",
    // which read as "add a palette" when it actually chooses which ones show.
    const add = document.createElement("button");
    add.type = "button"; add.className = "palsw-add"; add.textContent = "+ Choose palettes";
    add.title = "Choose which palettes are in use, or create a new one";
    add.setAttribute("aria-label", add.title);
    add.addEventListener("click", openPalPick);
    host.appendChild(add);
    paletteSel.classList.add("pal-hidden");   // the swatches are the control now; keep the select for its value
    paletteSel.style.display = "none";
    syncPalSwatches();
  }
  // ---- "Palettes in use" picker -----------------------------------------------------
  // Every ramp with a tick, so the strip can stay short. Floating, translucent and
  // non-modal like the other popups; hides on m/Esc with them.
  function openPalPick() { buildPalPick(); el("palpickdlg").classList.remove("hidden"); }
  const closePalPick = () => el("palpickdlg").classList.add("hidden");
  const palPickOpen = () => !el("palpickdlg").classList.contains("hidden");
  function buildPalPick() {
    const host = el("palpick-list");
    if (!host) return;
    host.textContent = "";
    palByName().forEach(i => {
      const p = PALETTES[i];
      if (palGone.has(i)) return;           // tombstoned shipped ramps leave the list too
      const lab = document.createElement("label");
      lab.className = "palpick-row";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = palInUse(i);
      cb.addEventListener("change", () => setPalUse(i, cb.checked));
      const sw = document.createElement("span");
      sw.className = "palpick-sw"; sw.style.background = palGradientCss(i);
      const nm = document.createElement("span");
      nm.className = "palpick-n"; nm.textContent = p.name + (p.custom ? " (custom)" : "");
      lab.appendChild(cb); lab.appendChild(sw); lab.appendChild(nm);
      // EVERY row gets a delete ✕ — customs really delete, shipped ramps tombstone (see
      // deleteAnyPalette). Inside a <label>, so the click must preventDefault too — else
      // it also toggles the in-use checkbox.
      const del = document.createElement("button");
      del.type = "button"; del.className = "palpick-del"; del.textContent = "✕";
      del.title = "Delete " + p.name;
      del.setAttribute("aria-label", del.title);
      del.addEventListener("click", ev => {
        ev.preventDefault(); ev.stopPropagation();
        deleteAnyPalette(i);
      });
      lab.appendChild(del);
      host.appendChild(lab);
    });
  }
  // The ONE deletion entry, confirm included — the per-row ✕ is its only caller now.
  // Customs really delete (indices remap); shipped ramps SOFT-delete into palGone — the
  // entry stays in PALETTES so every scene and share link that references it keeps
  // rendering, and "Select all" resurrects them. The floor is one alive palette TOTAL.
  function deleteAnyPalette(i) {
    const p = PALETTES[i];
    if (!p || palGone.has(i)) return;
    if (palAliveCount() <= 1) { alert("That is the last palette — at least one must remain."); return; }
    const back = palFallbackFor(i);         // an in-use survivor, named in the confirm below
    if (!confirm("Delete the palette “" + p.name + "”? " + (p.custom
      ? "Any layer or scene using it falls back to " + PALETTES[back].name + "."
      : "Scenes that use it keep rendering; it leaves the strip, the picker and the cycle. Select all brings the shipped palettes back."))) return;
    if (p.custom) { deleteCustomPalette(i); return; }
    // A tombstoned built-in still renders for every scene that stores it — only the LIVE
    // selection has to move, and it moves to the same in-use survivor.
    palGone.add(i);
    if (+paletteSel.value === i) {
      const land = palFallbackFor(i);       // computed AFTER the tombstone, so it can't pick i
      palKeepInUse(land);
      paleSelectLive(land);
    }
    buildPalSwatches(); buildPalPick(); persist();
  }
  // Tick / untick one ramp. `palUse` is null while everything is in use, so the first
  // untick has to materialise the full set before removing from it.
  function setPalUse(i, on) {
    if (!palUse) palUse = new Set(PALETTES.map((_, k) => k));
    if (on) palUse.add(i); else palUse.delete(i);
    // Never leave it empty: with nothing in use the strip would vanish and the cycle would
    // have nowhere to go. Emptying it means "all", which is also how it is stored.
    if (!palUse.size) palUse = null;
    if (palUse && palUse.size === PALETTES.length) palUse = null;
    buildPalSwatches();
    buildPalPick();
    persist();
  }
  function setPalUseAll(on) {
    palUse = on ? null : new Set([+paletteSel.value]);   // "none" keeps the one on screen
    if (on) palGone = new Set();            // Select all is the tombstone recovery path
    buildPalSwatches(); buildPalPick(); persist();
  }
  buildPalSwatches();
  el("palpick-close").addEventListener("click", closePalPick);
  el("palpickdlg").addEventListener("click", e => { if (e.target === el("palpickdlg")) closePalPick(); });
  el("palpick-all").addEventListener("click", () => setPalUseAll(true));
  el("palpick-none").addEventListener("click", () => setPalUseAll(false));
  // Create a NEW custom palette: a plain RGB ramp under a name the user must supply (no
  // name ⇒ no palette). Replaces the old + on every built-in swatch. The custom branch of
  // openPalEditor keeps a named palette even when it is closed without an edit — only
  // anonymous shadow-copies were discard-on-close.
  el("palpick-new").addEventListener("click", () => {
    if (PALETTES.length - PAL_BUILTIN >= PAL_MAX_CUSTOM) {
      alert("You already have " + PAL_MAX_CUSTOM + " custom palettes — delete one first.");
      return;
    }
    const name = (prompt("Name the new palette:") || "").trim().slice(0, 40);
    if (!name) return;
    PALETTES.push(customPalEntry({ name, stops: [[0, [255, 0, 0]], [0.5, [0, 255, 0]], [1, [0, 0, 255]]] }));
    const i = PALETTES.length - 1;
    if (palUse) palUse.add(i);            // a materialised in-use set must include the newcomer
    buildPalSwatches(); buildPalPick(); persist();
    closePalPick();
    paleSelectLive(i);                    // show it at once, and open the editor on it
    openPalEditor(i);
  });
  // There is no "Delete selected" button: deleting is the per-row ✕ in the list, where the
  // row says which palette you are about to lose. A button acting on the swatch highlighted
  // behind the open dialog was a second, less obvious way into the same destructive path.
  // Palette inspector (the 👁 button beside the Palette label): the selected palette's full 0–255
  // ramp as a 16×16 grid of colour cells, so every colour is easy to pick out. Shows the raw
  // ramp (each palette's own fn), not the on-screen bake, so banding/reverse/background don't
  // muddy the identity. Hover a cell for its index + hex.
  function openPalDetail() {
    const p = PALETTES[+paletteSel.value] || PALETTES[0];
    el("pal-title").textContent = "Palette · " + p.name;
    const grid = el("pal-grid"); grid.textContent = "";
    const h2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    for (let x = 0; x < 256; x++) {
      const c = p.fn(x), cell = document.createElement("div");
      cell.style.background = "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
      cell.title = "index " + x + " · #" + h2(c[0]) + h2(c[1]) + h2(c[2]);
      grid.appendChild(cell);
    }
    el("paldlg").classList.remove("hidden");
  }
  const closePalDetail = () => el("paldlg").classList.add("hidden");
  el("pal-close").addEventListener("click", closePalDetail);
  el("paldlg").addEventListener("click", e => { if (e.target === el("paldlg")) closePalDetail(); });
  // These four are per-block controls whose one live value belongs to the selected layer, so
  // each is an accessor over ctl() rather than a captured node. Every read and write site —
  // including the render path's showBoxChk.checked — stays written exactly as it was.
  const showBoxChk = { get checked() { const n = ctl("showbox"); return !!n && n.checked; },
                       set checked(v) { for (const n of ctlEach("showbox")) n.checked = v; } };
  const randSeedChk = { get checked() { const n = ctl("randseed"); return !!n && n.checked; },
                        set checked(v) { for (const n of ctlEach("randseed")) n.checked = v; } };
  // ---- palette fold ----------------------------------------------------------
  // The palette body (swatches, Reverse, Background, cycle) is the tallest run of furniture
  // in a layer block and the first thing you stop needing once the colours are settled.
  // ONE boolean for every block, not one per slot: the same policy the group folds use
  // ("folds apply to every block at once"), and it keeps a reorder from carrying a fold to
  // a layer that never had one. Transient — not in fullSnapshot(), so it never rides a
  // scene, a share link or a backup, exactly like every other fold in the app.
  let palFolded = false;
  function syncPalFold() {
    for (const n of ctlEach("palbody")) n.style.display = palFolded ? "none" : "";
    for (const n of ctlEach("pal-fold")) {
      n.textContent = palFolded ? "▸" : "▾";
      n.title = palFolded ? "Show the palette controls" : "Hide the palette controls";
      n.setAttribute("aria-label", palFolded ? "Expand palette" : "Collapse palette");
      n.setAttribute("aria-expanded", palFolded ? "false" : "true");
    }
  }
  function togglePalFold(e) {
    // Inside a <label>, so a bare click would fall through to the label's own activation.
    e.preventDefault(); e.stopPropagation();
    palFolded = !palFolded;
    syncPalFold();
  }
  for (let slot = 0; slot < STACK_MAX; slot++) {
    ctlIn(slot, "showbox").addEventListener("change", () => showBox = showBoxChk.checked);
    // Toggling it re-rolls immediately (on ⇒ jump somewhere random; off ⇒ back to 0).
    ctlIn(slot, "randseed").addEventListener("change", () => { randSeed = randSeedChk.checked; reseedJulia(); });
    ctlIn(slot, "pal-detail-btn").addEventListener("click", openPalDetail);
    const pf = ctlIn(slot, "pal-fold");
    pf.addEventListener("click", togglePalFold);
    // A <b> takes no keyboard activation of its own (role=button + tabindex only makes it
    // focusable), so Enter/Space have to be wired by hand — the same gap `setOff` documents
    // for the row controls.
    pf.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") togglePalFold(e); });
  }
  syncPalFold();
  // Resolution = render downscale (cfg.scale): higher divisor ⇒ coarser + faster.
  // Global (not per-effect); reallocates buffers via resize().
  const resSel = el("res");
  resSel.addEventListener("change", () => { cfg.scale = +resSel.value; resize(); persist(); });
  const cycleChk = el("cycle");
  const presetSel = el("preset");
