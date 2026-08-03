  // ---- palette editor -------------------------------------------------------
  // Opened by the + (built-in) or ✎ (custom) on any palette swatch. The ramp is edited as
  // colour STOPS on a gradient bar: click the bar to add one, drag a handle to move it, and
  // the native <input type="color"> does the colour picking — a fast, familiar control
  // instead of a hand-rolled wheel.
  //
  // The central design decision is **edit live, not as a draft**. A palette is referenced by
  // index and re-derived from `PALETTES` every frame (per-layer bakes, the morph, the CPU
  // mirror), so a "draft" ramp held to one side would have to be threaded through all of
  // those paths. Instead the custom palette is created and SELECTED the moment the editor
  // opens, and every edit rewrites it in place — so the whole pipeline previews it for free,
  // with no special case anywhere.
  //
  // Opening the + on a built-in therefore makes a copy immediately, which would litter the
  // list with strays every time you merely looked. So: a fresh copy that is closed **without
  // a single edit** is removed again. Peeking costs nothing; editing keeps it.
  let paleIdx = -1;          // index in PALETTES of the palette being edited (a custom, always)
  let paleFresh = false;     // did THIS session create it? (⇒ discard on a no-op close)
  let paleDirty = false;     // has anything been edited?
  let paleOrig = null;       // the stops the editor opened with, for Revert
  let paleSel = null;        // the selected stop, held by identity (positions re-sort on drag)
  let paleFallback = 0;      // palette to fall back to if this one is deleted (the source)

  const paleStops = () => (PALETTES[paleIdx] && PALETTES[paleIdx].stops) || [];
  const paleClone = st => st.map(s => [s[0], s[1].slice(0, 3)]);
  const h2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  const paleHex = c => "#" + h2(c[0]) + h2(c[1]) + h2(c[2]);
  const paleFromHex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  function paleGradCss(stops) {
    return "linear-gradient(to right, " + stops
      .map(s => "rgb(" + clamp(s[1][0]) + "," + clamp(s[1][1]) + "," + clamp(s[1][2]) + ") " + (s[0] * 100).toFixed(2) + "%")
      .join(",") + ")";
  }

  // Rebuild the live PALETTES entry from the current stops and push it through everything
  // that shows a palette. `full` also rebuilds the swatch grid + <select> options, which is
  // only needed when a palette is ADDED or REMOVED — a stop edit just repaints one swatch,
  // so dragging a handle doesn't rebuild (and steal focus from) the control being dragged.
  function paleApply(full) {
    const st = paleStops();
    PALETTES[paleIdx] = customPalEntry({ name: PALETTES[paleIdx].name, stops: st });
    if (full) buildPalSwatches();
    else {
      const sw = el("palswatches") && el("palswatches").querySelector('.palsw[data-pal="' + paleIdx + '"]');
      if (sw) sw.style.background = paleGradCss(st);
      const opt = paletteSel.querySelector('option[value="' + paleIdx + '"]');
      if (opt) opt.textContent = PALETTES[paleIdx].name;
    }
    // Repaint the on-screen ramp if this palette is the one showing. Guarded on `morphing`:
    // mid-cycle the frame loop owns paletteBase, and it re-reads PALETTES each step anyway.
    if (+paletteSel.value === paleIdx && !morphing) setPalette(paleIdx);
    paleRender();
  }

  // Draw the bar, the handles, and the fields for the selected stop.
  function paleRender() {
    if (paleIdx < 0 || !PALETTES[paleIdx]) return;
    const st = paleStops();
    el("pale-grad").style.background = paleGradCss(st);
    const host = el("pale-stops");
    host.textContent = "";
    if (st.indexOf(paleSel) < 0) paleSel = st[0];
    st.forEach(s => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pale-h" + (s === paleSel ? " sel" : "");
      b.style.left = (s[0] * 100) + "%";
      b.style.background = "rgb(" + clamp(s[1][0]) + "," + clamp(s[1][1]) + "," + clamp(s[1][2]) + ")";
      b.title = Math.round(s[0] * 100) + "% · " + paleHex(s[1]);
      b.setAttribute("aria-label", "Stop at " + Math.round(s[0] * 100) + " percent");
      b.addEventListener("pointerdown", ev => paleDragStart(ev, b, s));
      host.appendChild(b);
    });
    if (paleSel) {
      el("pale-color").value = paleHex(paleSel[1]);
      el("pale-pos").value = Math.round(paleSel[0] * 100);
    }
    // The two ends are what make the ramp span 0..1, so keep at least PAL_MIN_STOPS.
    el("pale-del").classList.toggle("off", st.length <= PAL_MIN_STOPS);
    el("pale-add").classList.toggle("off", st.length >= PAL_MAX_STOPS);
    el("pale-title").textContent = "Palette editor · " + PALETTES[paleIdx].name;
    el("pale-hint").textContent = st.length + " stops · the scene updates as you edit. "
      + "Index 0 always shows the layer's Background, and the darkest few steps are eased "
      + "into it, so the very low end looks softer on screen than it does here.";
  }

  // Dragging a handle. The stop list is re-sorted on every move (so a handle dragged past its
  // neighbour really does change order), which is exactly why the selection is held by object
  // identity rather than by index — an index would silently start pointing at another stop.
  function paleDragStart(ev, btn, stop) {
    ev.preventDefault(); ev.stopPropagation();
    paleSel = stop;
    const bar = el("pale-grad");
    btn.setPointerCapture(ev.pointerId);
    const move = e => {
      const r = bar.getBoundingClientRect();
      stop[0] = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
      paleStops().sort((a, b) => a[0] - b[0]);
      paleEdited(false);
    };
    const up = () => {
      btn.releasePointerCapture(ev.pointerId);
      btn.removeEventListener("pointermove", move);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointercancel", up);
      paleCommit();                 // persist ONCE on release, not on every pointermove
    };
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    paleRender();
  }

  // An edit happened: mark dirty and repaint. `full` for add/remove (rebuilds the grid).
  function paleEdited(full) {
    paleDirty = true;
    paleApply(full);
  }
  // Write the palette list to storage. Separate from paleEdited so a drag persists once on
  // release rather than on every pointermove — the same reason the layer gain slider does.
  function paleCommit() {
    if (paleIdx < 0) return;
    persist();
    autosavePreset();
  }

  // Open the editor for palette `i`. A built-in is copied first; a custom is edited directly.
  function openPalEditor(i) {
    const src = PALETTES[i] || PALETTES[0];
    if (src.custom) {
      paleIdx = i; paleFresh = false;
      paleFallback = 0;
    } else {
      if (PALETTES.length - PAL_BUILTIN >= PAL_MAX_CUSTOM) {
        alert("You already have " + PAL_MAX_CUSTOM + " custom palettes — delete one first.");
        return;
      }
      // Copy the built-in's exact control points where it has them (grad carries its stops);
      // Fire / Rainbow / Grayscale are procedural and get a faithful sampled approximation.
      PALETTES.push(customPalEntry({ name: paleCopyName(src.name), stops: palStopsOf(i) }));
      paleIdx = PALETTES.length - 1;
      paleFresh = true;
      paleFallback = i;             // Delete / a no-op close returns to the palette it came from
      buildPalSwatches();
      paleSelectLive(paleIdx);      // ...and show it at once, so editing previews live
    }
    paleDirty = false;
    paleOrig = paleClone(paleStops());
    paleSel = paleStops()[0];
    el("pale-name").value = PALETTES[paleIdx].name;
    el("pale-delpal").classList.remove("off");
    el("paledlg").classList.remove("hidden");
    paleRender();
  }
  // "Fire" → "Fire copy", then "Fire copy 2", … so two copies of one built-in are tellable
  // apart in the swatch list without making you rename them first.
  function paleCopyName(base) {
    const taken = new Set(PALETTES.map(p => p.name));
    let n = base + " copy";
    for (let k = 2; taken.has(n); k++) n = base + " copy " + k;
    return n;
  }
  // Select a palette the way a swatch click does, so the morph/persist path is identical.
  function paleSelectLive(i) {
    paletteSel.value = String(i);
    paletteSel.dispatchEvent(new Event("change", { bubbles: true }));
    syncPalSwatches();
  }

  function closePalEditor() {
    // A copy nobody edited is a stray: drop it and go back to the palette it came from.
    if (paleFresh && !paleDirty && paleIdx >= PAL_BUILTIN) {
      const back = paleFallback;
      PALETTES.splice(paleIdx, 1);
      buildPalSwatches();
      paleSelectLive(back);
    }
    paleIdx = -1; paleFresh = false; paleDirty = false; paleSel = null; paleOrig = null;
    el("paledlg").classList.add("hidden");
  }

  // Delete the custom being edited. Palette references are INDICES, so removing one from the
  // middle of the custom tail shifts every later custom down — `palRemapDeleted` rewrites the
  // stored references (live stack, per-effect extras, and every preset) to match. Without it,
  // deleting the first of three customs silently re-points scenes at the wrong ramp.
  function deletePalEditor() {
    if (paleIdx < PAL_BUILTIN) return;
    const gone = paleIdx, back = paleFallback;
    if (!paleFresh && !confirm("Delete the custom palette “" + PALETTES[gone].name
        + "”? Any layer using it falls back to " + PALETTES[back].name + ".")) return;
    PALETTES.splice(gone, 1);
    palRemapDeleted(gone, back);
    paleIdx = -1; paleFresh = false; paleDirty = false; paleSel = null;
    el("paledlg").classList.add("hidden");
    buildPalSwatches();
    paleSelectLive(Math.min(back, PALETTES.length - 1));
    persist();
    autosavePreset();
  }
  // Rewrite one stored palette reference after `gone` was removed. Values are strings in the
  // DOM and may be numbers in a blob, so it returns the same flavour it was given.
  function palRemapOne(v, gone, back) {
    if (v === null || v === undefined) return v;
    const n = +v;
    if (!Number.isFinite(n)) return v;
    const out = n === gone ? back : n > gone ? n - 1 : n;
    return typeof v === "string" ? String(out) : out;
  }
  function palRemapDeleted(gone, back) {
    stack.forEach(L => { L.palette = palRemapOne(L.palette, gone, back); });
    for (const e in extras) if (extras[e]) extras[e].palette = palRemapOne(extras[e].palette, gone, back);
    presets.forEach(p => {
      if (p.extra) p.extra.palette = palRemapOne(p.extra.palette, gone, back);
      (p.layers || []).forEach(L => { L.palette = palRemapOne(L.palette, gone, back); });
    });
    paletteSel.value = String(palRemapOne(+paletteSel.value, gone, back));
    // The in-use set is indices too, so it shifts with everything else — without this,
    // deleting the first of three customs silently drops a different ramp out of the cycle.
    if (palUse) {
      const next = new Set();
      palUse.forEach(i => { const r = palRemapOne(i, gone, back); if (r >= 0 && r < PALETTES.length) next.add(r); });
      palUse = next.size ? next : null;
    }
  }

  // ---- wiring ----
  el("pale-close").addEventListener("click", closePalEditor);
  // Save is really "keep and close": edits are already live and already persisted, so there
  // is nothing to flush. It exists because a fresh copy closed with NO edits is discarded on
  // purpose (see closePalEditor) — Save is how you say "keep it anyway", e.g. you wanted a
  // duplicate of Fire under its own name to edit later. So it marks the palette kept first.
  el("pale-save").addEventListener("click", () => {
    if (paleIdx < 0) return;
    paleDirty = true;          // ...so closePalEditor keeps a fresh, unedited copy
    paleCommit();
    closePalEditor();
  });
  el("pale-delpal").addEventListener("click", deletePalEditor);
  el("pale-color").addEventListener("input", () => {
    if (paleSel) { paleSel[1] = paleFromHex(el("pale-color").value); paleEdited(false); }
  });
  el("pale-color").addEventListener("change", paleCommit);
  el("pale-pos").addEventListener("input", () => {
    if (!paleSel) return;
    const v = +el("pale-pos").value;
    if (!Number.isFinite(v)) return;
    paleSel[0] = Math.max(0, Math.min(1, v / 100));
    paleStops().sort((a, b) => a[0] - b[0]);
    paleEdited(false);
  });
  el("pale-pos").addEventListener("change", paleCommit);
  el("pale-name").addEventListener("input", () => {
    const n = el("pale-name").value.trim().slice(0, 40) || "Custom";
    if (paleIdx >= 0) { PALETTES[paleIdx].name = n; paleEdited(false); }
  });
  el("pale-name").addEventListener("change", paleCommit);
  // Add a stop midway to the next one, taking the ramp's colour there — so a new stop starts
  // invisible and you move it where you want, rather than punching a colour into the ramp.
  el("pale-add").addEventListener("click", () => {
    const st = paleStops();
    if (paleIdx < 0 || st.length >= PAL_MAX_STOPS) return;
    const i = Math.max(0, st.indexOf(paleSel));
    const next = st[i + 1] || st[i];
    const pos = st[i + 1] ? (st[i][0] + next[0]) / 2 : Math.min(1, st[i][0] + 0.05);
    const c = PALETTES[paleIdx].fn(Math.round(pos * 255)).slice(0, 3).map(clamp);
    const ns = [pos, c];
    st.push(ns); st.sort((a, b) => a[0] - b[0]);
    paleSel = ns;
    paleEdited(false);
    paleCommit();
  });
  el("pale-del").addEventListener("click", () => {
    const st = paleStops();
    if (st.length <= PAL_MIN_STOPS) return;
    const i = st.indexOf(paleSel);
    if (i < 0) return;
    st.splice(i, 1);
    paleSel = st[Math.min(i, st.length - 1)];
    paleEdited(false);
    paleCommit();
  });
  el("pale-revert").addEventListener("click", () => {
    if (paleIdx < 0 || !paleOrig) return;
    PALETTES[paleIdx].stops = paleClone(paleOrig);
    paleSel = PALETTES[paleIdx].stops[0];
    paleEdited(false);
    paleCommit();
  });
  // Clicking the bar adds a stop right there — the fastest way to shape a ramp, and the
  // reason the bar's cursor is `copy`. Handles stopPropagation their own pointerdown, so a
  // click that starts on a handle drags it instead of adding a stop underneath it.
  el("pale-bar").addEventListener("click", ev => {
    const st = paleStops();
    if (paleIdx < 0 || st.length >= PAL_MAX_STOPS) return;
    const r = el("pale-grad").getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (ev.clientX - r.left) / (r.width || 1)));
    const c = PALETTES[paleIdx].fn(Math.round(pos * 255)).slice(0, 3).map(clamp);
    const ns = [pos, c];
    st.push(ns); st.sort((a, b) => a[0] - b[0]);
    paleSel = ns;
    paleEdited(false);
    paleCommit();
  });
