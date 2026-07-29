  // ---- Diagnostics checkboxes: frame + FPS counter and the beat-trace canvas ----
  el("diagFrames").checked = !framesEl.classList.contains("hidden");
  el("diagFrames").addEventListener("change", e => framesEl.classList.toggle("hidden", !e.target.checked));
  el("diagTrace").checked = dbg.on;
  el("diagTrace").addEventListener("change", e => dbgToggle(e.target.checked));

  // Hide-all-UI mode: strip every button, the fps counter and the whole menu for a clean
  // capture — from ?hideui in the URL, or the "h" key. Transient (never persisted); the menu's
  // own open/closed state is untouched, so bringing the UI back restores it exactly.
  const setUiHidden = h => document.body.classList.toggle("ui-hidden", h);
  {
    const v = new URLSearchParams(location.search).get("hideui");
    if (v !== null && !/^(0|false|off|no)$/i.test(v)) setUiHidden(true);
  }

  window.addEventListener("keydown", e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;   // don't eat typing in fields
    // The one menu (dev tools live inside it now). Hide the floating tool popups — the Orbit
    // editor and the Palette inspector — along with it, so M gives a clean view.
    if (e.key === "m" || e.key === "M") { cardWanted = false; cardOpen(false); closePalDetail(); closePalEditor(); setPanel(!panel.classList.contains("hidden")); }
    else if (e.key === "f" || e.key === "F") toggleFullscreen();
    else if (e.key === "h" || e.key === "H") setUiHidden(!document.body.classList.contains("ui-hidden"));   // hide/show all chrome
    else if (e.key === "Escape") { closeHelp(); closeRestore(); closePalDetail(); closePalEditor(); cardWanted = false; cardOpen(false); }
  });

