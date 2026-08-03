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
  function syncPalSwatches() {
    const host = el("palswatches");
    if (!host) return;
    const cur = paletteSel.value;
    host.querySelectorAll(".palsw").forEach(b => b.classList.toggle("active", b.dataset.pal === cur));
  }
  function buildPalSwatches() {
    const host = el("palswatches");
    if (!host) return;
    // The <select>'s <option>s ARE the value store, but their list is generated from PALETTES
    // (the single source — names live there) rather than hand-written in the HTML, so adding a
    // palette needs only a PALETTES entry. The option value is still the index, read for validation.
    const cur = paletteSel.value;
    paletteSel.innerHTML = "";
    PALETTES.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = String(i); o.textContent = p.name;
      paletteSel.appendChild(o);
    });
    if (cur) paletteSel.value = cur;
    host.innerHTML = "";
    PALETTES.forEach((p, i) => {
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
        paletteSel.value = String(i);
        paletteSel.dispatchEvent(new Event("change", { bubbles: true }));   // morph/setPalette + persist
        syncPalSwatches();
      });
      w.appendChild(b);
      const e = document.createElement("button");
      e.type = "button"; e.className = "palsw-edit"; e.textContent = p.custom ? "✎" : "+";
      // A built-in opens as a COPY (the shipped ramps stay pristine, so "Reset this effect"
      // and every existing scene keep meaning what they meant); a custom opens for editing.
      e.title = p.custom ? "Edit this palette" : "Make an editable copy of " + p.name;
      e.setAttribute("aria-label", e.title);
      e.addEventListener("click", ev => { ev.stopPropagation(); openPalEditor(i); });
      w.appendChild(e);
      host.appendChild(w);
    });
    // A swatch-shaped "+" at the end of the strip opens the in-use picker. Deliberately the
    // same size and rhythm as the ramps rather than a button underneath: it reads as "one
    // more slot" and keeps the strip a single object.
    const add = document.createElement("button");
    add.type = "button"; add.className = "palsw-add"; add.textContent = "+";
    add.title = "Choose which palettes are in use";
    add.setAttribute("aria-label", "Choose which palettes are in use");
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
    PALETTES.forEach((p, i) => {
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
      host.appendChild(lab);
    });
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
    buildPalSwatches(); buildPalPick(); persist();
  }
  buildPalSwatches();
  el("palpick-close").addEventListener("click", closePalPick);
  el("palpickdlg").addEventListener("click", e => { if (e.target === el("palpickdlg")) closePalPick(); });
  el("palpick-all").addEventListener("click", () => setPalUseAll(true));
  el("palpick-none").addEventListener("click", () => setPalUseAll(false));
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
  el("pal-detail-btn").addEventListener("click", openPalDetail);
  el("pal-close").addEventListener("click", closePalDetail);
  el("paldlg").addEventListener("click", e => { if (e.target === el("paldlg")) closePalDetail(); });
  const showBoxChk = el("showbox");
  showBoxChk.addEventListener("change", () => showBox = showBoxChk.checked);
  const randSeedChk = el("randseed");
  // Toggling it re-rolls immediately (on ⇒ jump somewhere random; off ⇒ back to 0).
  randSeedChk.addEventListener("change", () => { randSeed = randSeedChk.checked; reseedJulia(); });
  // Resolution = render downscale (cfg.scale): higher divisor ⇒ coarser + faster.
  // Global (not per-effect); reallocates buffers via resize().
  const resSel = el("res");
  resSel.addEventListener("change", () => { cfg.scale = +resSel.value; resize(); persist(); });
  const cycleChk = el("cycle");
  const presetSel = el("preset");
