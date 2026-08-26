  // ---- beat-detection tuning (its own "Beat tuning" box, or ?beat=1) ----
  // Live sliders for the detector thresholds in beatCfg. Edits write straight into
  // beatCfg and re-derive the FFT bins when a band edge moves; the box sits outside
  // any dev-tool opt-out, so the delegated onEdit persists them AND autosaves them into the
  // selected preset, which is the whole point of the tuning being per-scene. (The beat-trace
  // toggle shares this box but carries data-nopersist, precisely to stay out of that.)
  // `var`, not `let`: installBeatTune runs during startup (restore/share → applyBlob)
  // long before this line, and reads `beatUi && beatUi.wired` — same reason `card` is
  // a var. With `let` that read is a TDZ crash, not a falsy skip.
  var beatUi = { on: false, wired: false };
  function beatChanged(bandsMoved) {
    if (bandsMoved && audio.on) computeBins();   // new Hz edges take effect without an audio restart
    // Every trigger still INHERITING one of these values is now using a stale copy — the
    // armed-trigger list caches the resolved tuning, so editing the global box has to
    // invalidate it or the global sliders would appear to do nothing until the next re-arm.
    trigDirty = true;
    syncTrigTune();                              // the per-box rows re-read what they inherit
    // No persist() here: these sliders carry no dev-tool opt-out, so onEdit already persisted
    // and folded the change into the selected preset. Calling it again would double-write.
  }
  function beatRow(label, val, min, max, step, fmt, set) {   // name + range slider + live readout
    const row = document.createElement("div"); row.className = "beat-row";
    const nm = document.createElement("span"); nm.className = "beat-name"; nm.textContent = label;
    const sl = document.createElement("input"); sl.type = "range"; sl.min = min; sl.max = max; sl.step = step; sl.value = val;
    const out = document.createElement("span"); out.className = "beat-val"; out.textContent = fmt(val);
    sl.addEventListener("input", () => { const v = +sl.value; out.textContent = fmt(v); set(v); beatChanged(false); });
    row.append(nm, sl, out);
    return row;
  }
  function beatChkRow(label, val, set) {                      // name + tick
    const row = document.createElement("div"); row.className = "beat-row";
    const nm = document.createElement("span"); nm.className = "beat-name"; nm.textContent = label;
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!val;
    cb.addEventListener("change", () => { set(cb.checked); beatChanged(false); });
    row.append(nm, cb);
    return row;
  }
  function beatBandRow(label, b) {                           // name + lo Hz + – + hi Hz
    const row = document.createElement("div"); row.className = "beat-row beat-band";
    const nm = document.createElement("span"); nm.className = "beat-name"; nm.textContent = label;
    const lo = document.createElement("input"), hi = document.createElement("input");
    for (const f of [lo, hi]) { f.type = "number"; f.className = "beat-f"; f.min = 1; f.step = 10; }
    lo.value = beatCfg.bands[b][0]; hi.value = beatCfg.bands[b][1];
    const dash = document.createElement("span"); dash.className = "beat-dash"; dash.textContent = "–";
    const commit = () => {
      const a = +lo.value, c = +hi.value;
      if (isFinite(a) && isFinite(c) && a >= 1 && c > a) { beatCfg.bands[b] = [a, c]; beatChanged(true); }
    };
    lo.addEventListener("input", commit); hi.addEventListener("input", commit);
    row.append(nm, lo, dash, hi);
    addNumArrows(lo); addNumArrows(hi);   // side-by-side steppers, like every number field
    return row;
  }
  function beatBuild() {
    const body = el("beatBody");
    body.textContent = "";
    const sec = t => { const d = document.createElement("div"); d.className = "beat-sec"; d.textContent = t; body.appendChild(d); };
    sec("Sensitivity — flux ÷ median (lower = more beats)");
    for (let b = 0; b < 3; b++) body.appendChild(
      beatRow(BANDLABEL[b], beatCfg.fluxK[b], 0.5, 6, 0.1, v => v.toFixed(1) + "×", v => beatCfg.fluxK[b] = v));
    sec("Relative floor — fraction of recent peak");
    body.appendChild(beatRow("all", beatCfg.floor, 0, 1, 0.01, v => v.toFixed(2), v => beatCfg.floor = v));
    sec("Refractory — min gap between beats (ms)");
    for (let b = 0; b < 3; b++) body.appendChild(
      beatRow(BANDLABEL[b], beatCfg.refract[b], 20, 500, 5, v => v + "ms", v => beatCfg.refract[b] = v));
    sec("Bands — frequency range (Hz)");
    for (let b = 0; b < 3; b++) body.appendChild(beatBandRow(BANDLABEL[b], b));
    // ---- TEMPO ---------------------------------------------------------------------------
    // Everything above answers "was that a beat?" after the fact. This answers "when is the
    // next one?", which is what an anticipatory pulse shape needs. Both ship neutral, so a
    // scene that never touches them detects beats exactly as it always did.
    sec("Tempo — predict the beat instead of reacting to it");
    body.appendChild(beatRow("lead", beatCfg.lead, 0, 400, 5,
      v => v ? v + "ms early" : "off", v => beatCfg.lead = v));
    body.appendChild(beatChkRow("lock", beatCfg.lock, v => beatCfg.lock = v));
    // The tracked tempo, so its behaviour is visible while tuning rather than something you
    // infer from the visual. It replaced a per-band EMA of the last inter-beat gap, which had
    // no phase and could not survive a missed onset.
    const bpm = document.createElement("div");
    bpm.className = "beat-sec beat-bpm"; bpm.id = "beatBpm"; bpm.textContent = "—";
    body.appendChild(bpm);
  }
  // Driven from frame(), like the meter: this is live state, not a control.
  function beatBpmTick() {
    const n = el("beatBpm");
    if (!n || !beatUi.on) return;                 // only while the box is open
    const T = audio.tempo;
    n.textContent = !audioLive() ? "—"
      : T.conf >= CONF_MIN ? Math.round(T.bpm) + " BPM   ·   lock " + Math.round(T.conf * 100) + "%"
      : "listening for a tempo…" + (T.bpm ? "   (" + Math.round(T.bpm) + " BPM, " + Math.round(T.conf * 100) + "%)" : "");
  }
  function beatReset() {
    installBeatTune(mergeBeatTune(null));   // mergeBeatTune(null) IS the shipped defaults
    beatChanged(true);
    // Reset is a click, not an input event, so the delegated onEdit never sees it —
    // persist and fold it into the selected preset by hand.
    persist();
    if (persistReady && !applyingPreset) autosavePreset();
    el("beatMsg").textContent = "Restored the shipped detector defaults.";
  }
  function beatWire() {
    if (beatUi.wired) return;
    beatUi.wired = true;
    el("beatReset").addEventListener("click", beatReset);
    beatBuild();                  // rebuilt by installBeatTune when a preset brings its own
    const d = el("beatDetails");
    d.addEventListener("toggle", () => { beatUi.on = d.open; });
  }
  function beatToggle(on) {       // programmatic open (e.g. ?beat=1); users just click the summary
    const d = el("beatDetails");
    const want = on === undefined ? !d.open : !!on;
    d.open = want;                // its own box — nothing to open around it
  }
  beatWire();
  if (/[?&]beat=1/.test(location.search)) { setPanel(false); beatToggle(true); }

