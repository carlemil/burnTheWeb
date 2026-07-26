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
      const b = document.createElement("button");
      b.type = "button"; b.className = "palsw"; b.dataset.pal = String(i);
      b.style.background = palGradientCss(i);
      b.title = p.name;
      const n = document.createElement("span");
      n.className = "palsw-n"; n.textContent = p.name;
      b.appendChild(n);
      b.addEventListener("click", () => {
        paletteSel.value = String(i);
        paletteSel.dispatchEvent(new Event("change", { bubbles: true }));   // morph/setPalette + persist
        syncPalSwatches();
      });
      host.appendChild(b);
    });
    paletteSel.classList.add("pal-hidden");   // the swatches are the control now; keep the select for its value
    paletteSel.style.display = "none";
    syncPalSwatches();
  }
  buildPalSwatches();
  // Palette inspector (▦ button beside the Palette label): the selected palette's full 0–255
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
