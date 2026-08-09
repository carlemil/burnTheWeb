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
  // `quiet` suppresses the way-back hint. Hiding the UI removes the panel footer that names
  // the H key, so an interactive hide has to say how to undo itself or it reads as a crash —
  // but ?hideui exists for headless screenshots, where anything drawn over the visual is the
  // bug. Hence: hint on H and on the menu item, silence on the URL.
  const uiHint = el("uihint");
  var uiHintTimer = 0;
  function flashUiHint() {
    if (!uiHint) return;
    clearTimeout(uiHintTimer);
    uiHint.classList.remove("hidden", "fading");
    // Two stages: hold, then fade, then take it out of the layout entirely so it can never
    // catch a late screenshot.
    uiHintTimer = setTimeout(() => {
      uiHint.classList.add("fading");
      uiHintTimer = setTimeout(() => uiHint.classList.add("hidden"), 600);
    }, 2200);
  }
  function hideUiHint() {
    if (!uiHint) return;
    clearTimeout(uiHintTimer);
    uiHint.classList.add("hidden");
    uiHint.classList.remove("fading");
  }
  function setUiHidden(h, quiet) {
    document.body.classList.toggle("ui-hidden", h);
    if (h && !quiet) flashUiHint(); else hideUiHint();
  }
  {
    const v = new URLSearchParams(location.search).get("hideui");
    if (v !== null && !/^(0|false|off|no)$/i.test(v)) setUiHidden(true, true);
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
    // Escape closes EVERY dialog. Keep this list complete — the gallery and the sync nudge
    // were both missing from it for a release, closable by mouse only, which is the same way
    // the .pal-close and ui-hidden selector lists have each rotted. tools/uiprobe.js now
    // asserts that every dialog id turns up here.
    else if (e.key === "Escape") { closeHelp(); closeRestore(); closePalDetail(); closePalEditor(); closePalPick(); closeFilterPicker(); closeTransPick(); galOpen(false); dismissSyncIfOpen(); closeTutorial(); cardWanted = false; cardOpen(false); }
  });

