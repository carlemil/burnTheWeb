  // ---- Beat-trace toggle ----
  // Lives in the Beat tuning box now, next to the thresholds it exists to help you set. It
  // carries data-nopersist, because that box (unlike the old Diagnostics section) deliberately
  // does NOT escape onEdit — its sliders are per-preset scene data and must autosave, so a dev
  // tool sitting among them has to opt out by hand or it gets folded into the preset too.
  //
  // The frame + FPS counter has no toggle any more: H (hide all chrome) already governs it via
  // body.ui-hidden, and a second control for the same thing was only ever a way for the two to
  // disagree. `#frames.hidden` survives in the CSS as the mechanism ?hideui/H drive.
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
    if (e.key === "m" || e.key === "M") { cardWanted = false; cardOpen(false); closePalDetail(); closePalEditor(); closePalPick(); closeFilterPicker(); closeTransPick(); setPanel(!panel.classList.contains("hidden")); }
    else if (e.key === "f" || e.key === "F") toggleFullscreen();
    // S for sound — M would be the video-player convention, but it is the menu here.
    else if (e.key === "s" || e.key === "S") toggleMute();
    else if (e.key === "h" || e.key === "H") setUiHidden(!document.body.classList.contains("ui-hidden"));   // hide/show all chrome
    else if (e.key === "Escape") { closeHelp(); closeRestore(); closePalDetail(); closePalEditor(); closePalPick(); closeFilterPicker(); closeTransPick(); cardWanted = false; cardOpen(false); }
  });

