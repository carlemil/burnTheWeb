  // ---- Backup: ONE FILE PER PRESET, so a single scene can be sent to someone ----
  // The backup used to be one big .json holding everything. That is a fine backup and a
  // terrible way to hand someone a scene: they would have to import the lot and hunt for
  // it. Now each preset is its own self-contained file named after itself, plus one
  // _settings.json for everything that is not a preset (per-effect settings, resolution,
  // auto-cycle, the custom scene's beat tuning) so Backup is still a *complete* backup.

  function downloadText(name, text) {   // Blob → objectURL → synthetic anchor click
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  // Preset names are free text and end up as filenames. Strip what no filesystem
  // accepts, plus Windows' reserved device names (a preset called "CON" is unwritable).
  const WIN_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  function safeFileName(name) {
    let s = String(name == null ? "" : name)
      .replace(/[\/\\:*?"<>|]/g, "-")     // path separators + Windows-illegal
      .replace(/[\x00-\x1f]/g, "")        // control chars
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/, "");             // Windows silently drops trailing dots/spaces
    if (!s) s = "Preset";
    if (WIN_RESERVED.test(s)) s = "_" + s;
    return s.slice(0, 80);
  }
  function stampNow() {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
           "_" + p(d.getHours()) + p(d.getMinutes());
  }
  // The files a backup consists of: [{ name, text }]. Preset files are self-describing
  // and self-contained — `kind` lets Restore tell them from a settings file or from any
  // of the older whole-library shapes without guessing.
  function backupFiles() {
    autosavePreset();                   // fold pending edits into the selected preset
    const snap = fullSnapshot();
    const files = [], used = new Set();
    for (const p of snap.presets) {
      let base = safeFileName(p.name), n = 2;
      while (used.has(base.toLowerCase())) base = safeFileName(p.name) + " (" + n++ + ")";
      used.add(base.toLowerCase());
      const one = serializeBlob({ presets: [p] }).presets[0];   // effect → stable id
      files.push({ name: base + ".json",
                   text: JSON.stringify({ app: "burnTheWeb", kind: "preset", version: 1, appVersion: APP_VERSION, preset: one }, null, 2) });
    }
    // Everything that is not a preset. curPreset is deliberately left out: it is an index
    // into a list that no longer travels as a list, so it could only ever point at the
    // wrong scene once the files are re-selected in a different order.
    const settings = serializeBlob(snap);
    delete settings.presets; delete settings.curPreset;
    files.push({ name: "_settings.json",
                 text: JSON.stringify({ app: "burnTheWeb", kind: "settings", version: 1, appVersion: APP_VERSION, settings }, null, 2) });
    return files;
  }
  // ---- remembering the backup folder ----------------------------------------
  // A browser cannot write to Downloads unprompted; real folders need a directory
  // handle the user picked. But a handle is structured-cloneable, so it can be kept
  // in IndexedDB and reused — the picker then appears once, ever, instead of on every
  // backup. (localStorage is no good here: it only stores strings.)
  const BK_DB = "burnTheWeb.fs", BK_STORE = "handles", BK_KEY = "backupRoot";
  function bkStore(mode, fn) {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return res(null);
      const rq = indexedDB.open(BK_DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(BK_STORE);
      rq.onerror = () => res(null);                 // private mode etc — just re-pick
      rq.onsuccess = () => {
        const db = rq.result;
        let t, out;
        // Every step here can throw, and a throw inside an IDB event handler would
        // leave this promise pending forever — which would hang Backup, not just skip
        // the cache. put() in particular throws DataCloneError wherever directory
        // handles aren't structured-cloneable. Always resolve; the caller re-picks.
        try {
          t = db.transaction(BK_STORE, mode);
          out = fn(t.objectStore(BK_STORE));
        } catch (e) { db.close(); return res(null); }
        t.oncomplete = () => { db.close(); res(out && out.result !== undefined ? out.result : null); };
        t.onerror = t.onabort = () => { db.close(); res(null); };
      };
    });
  }
  const bkGet = () => bkStore("readonly", s => s.get(BK_KEY));
  const bkPut = h => bkStore("readwrite", s => s.put(h, BK_KEY));
  const bkClear = () => bkStore("readwrite", s => s.delete(BK_KEY));
  // A stored handle can go stale (folder deleted) or lose its grant. queryPermission
  // is silent when still granted; requestPermission is a one-click chip, not a folder
  // browser. Anything else ⇒ fall through to a fresh pick.
  async function bkUsable(h) {
    if (!h || !h.queryPermission) return false;
    try {
      const opt = { mode: "readwrite" };
      if (await h.queryPermission(opt) === "granted") return true;
      return await h.requestPermission(opt) === "granted";
    } catch (e) { return false; }
  }
  async function backupRoot(forcePick) {
    if (!forcePick) {
      const saved = await bkGet();
      if (await bkUsable(saved)) return saved;
    }
    const root = await window.showDirectoryPicker({ mode: "readwrite", id: "btwBackup" });
    await bkPut(root);
    return root;
  }
  // Chromium can write a real folder; everything else gets flat files with the stamp in
  // the name. Nesting via `a.download` is not an option for the fallback — the HTML spec
  // has user agents sanitize path components out of the filename, so "backup-x/y.json"
  // arrives as one mangled file rather than a folder.
  async function runBackup(btn, forcePick) {
    const files = backupFiles(), stamp = stampNow();
    const say = (msg, ms) => { btn.textContent = msg; setTimeout(() => btn.textContent = "Backup", ms || 2200); };
    if (window.showDirectoryPicker) {
      let root;
      try { root = await backupRoot(forcePick); }
      catch (e) { btn.textContent = "Backup"; return; }        // user cancelled the picker
      try {
        // BurnTheWeb / <date-time>. No per-scene folder in between: a backup is *every*
        // preset, so naming it after whichever one happened to be selected described the
        // wrong thing and split one backup's history across as many folders as you had
        // presets. One dated folder per backup, all of them siblings.
        let dir = await root.getDirectoryHandle("BurnTheWeb", { create: true });
        dir = await dir.getDirectoryHandle(stamp, { create: true });
        for (const f of files) {
          const fh = await dir.getFileHandle(f.name, { create: true });
          const w = await fh.createWritable();
          await w.write(f.text);
          await w.close();
        }
        say("Saved " + files.length + " files");
        track("backup_folder", { files: files.length });
      } catch (e) {
        // A remembered folder that has been deleted or revoked lands here. Drop it so
        // the next click picks afresh rather than failing forever.
        await bkClear();
        say("Backup failed — click again");
      }
      return;
    }
    // One download per file, spaced out: fired back-to-back, browsers drop all but the
    // first few. The stamp goes in the name since there is no folder to put it in.
    files.forEach((f, i) => setTimeout(() => downloadText("backup-" + stamp + " - " + f.name, f.text), i * 150));
    say("Saving " + files.length + " files…", 400 + files.length * 150);
    track("backup_files", { files: files.length });
  }
  el("exportpresets").addEventListener("click", e => {
    const btn = el("exportpresets");
    btn.textContent = "Saving…";
    runBackup(btn, e.shiftKey);      // shift ⇒ re-pick the folder (see the button's title)
  });
  // Fold every shape we have ever written into the one the restore path understands:
  // a single-preset file, a _settings.json, a whole-library snapshot (the old Backup),
  // a legacy { presets, ranges }, or the oldest bare array. Run BEFORE deserializeBlob,
  // so its `effect` id → index mapping does the work in exactly one place.
  function normalizeBackup(raw) {
    if (Array.isArray(raw)) return { presets: raw };                        // oldest
    if (!raw || typeof raw !== "object") return null;
    if (raw.kind === "preset" && raw.preset) return { presets: [raw.preset] };
    if (raw.kind === "settings" && raw.settings) return raw.settings;
    return raw;                                                             // snapshot / legacy
  }
  // Validate + normalize a DESERIALIZED preset array (numeric effect indices) into the shape
  // the Restore dialog / applyRestore expect. Shared by file import and preset-bundle links.
  // beatTune must be carried through verbatim: the detector thresholds live nowhere else, so
  // dropping them hands the imported preset whatever tuning the recipient sat at. `cam` is
  // carried too, but ONLY as the legacy migration source: a backup written before the camera
  // went per-layer stored one root `cam`, and migrateCam folds it into the states / layers on
  // load. New backups omit it — the camera rides inline in `state` and each layer's `cam`.
  function validatePresetList(arr) {
    return (Array.isArray(arr) ? arr : [])
      .filter(p => p && EFFECTS[p.effect] && p.state && p.beat && p.extra)
      .map(p => ({ name: String(p.name || "Preset"), effect: p.effect,
                   state: mergeState(p.effect, p.state), beat: p.beat, pulse: mergePulse(p.effect, p.pulse), plen: mergePlen(p.effect, p.plen),
                   cam: p.cam, sceneFx: p.sceneFx, beatTune: mergeBeatTune(p.beatTune), ranges: p.ranges, extra: p.extra,
                   ttl: p.ttl, tdur: p.tdur,
                   layers: Array.isArray(p.layers) ? p.layers : undefined }));
  }
  el("importpresets").addEventListener("click", () => el("presetsfile").click());
  el("presetsfile").addEventListener("change", async ev => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";             // allow re-picking the same files later
    if (!files.length) return;
    try {
      const texts = await Promise.all(files.map(f => f.text()));
      const parts = texts.map((t, i) => {
        const n = normalizeBackup(JSON.parse(t));
        if (!n) throw new Error(files[i].name + " isn't a burnTheWeb backup");
        return deserializeBlob(n);
      });
      // Presets accumulate across every file selected; the settings come from whichever
      // file actually carries them (a folder holds one _settings.json among N presets).
      const arr = parts.flatMap(p => (Array.isArray(p) ? p : (p && p.presets) || []));
      const parsed = Object.assign({}, parts.find(p => p && !Array.isArray(p) && p.states) || {});
      for (const p of parts) {        // a legacy { presets, ranges } carries these without states
        if (!p || Array.isArray(p)) continue;
        if (!parsed.ranges && p.ranges) parsed.ranges = p.ranges;
        if (!parsed.beatTune && p.beatTune) parsed.beatTune = p.beatTune;
      }
      parsed.presets = arr;
      delete parsed.curPreset;        // meaningless once presets arrive as separate files
      if (!arr.length && !parsed.states) throw new Error("no presets or settings found");
      const valid = validatePresetList(arr);
      if (!valid.length && !parsed.states) throw new Error("no valid presets in the selection");
      const label = files.length === 1 ? files[0].name : files.length + " files";
      openRestore(parsed, valid, label);   // let the user pick what to restore + how
    } catch (err) { alert("Couldn't read backup: " + err.message); }
  });

  // ---- Restore dialog: choose which parts to bring back, and merge vs replace ----
  let pendingRestore = null;
  function openRestore(parsed, valid, fileName) {
    const hasSettings = !Array.isArray(parsed) && !!parsed.states;
    const hasRanges = !Array.isArray(parsed) && parsed.ranges && typeof parsed.ranges === "object";
    const hasBeat = !Array.isArray(parsed) && parsed.beatTune && typeof parsed.beatTune === "object";
    pendingRestore = { parsed, valid, hasSettings, hasRanges, hasBeat };
    const bits = [];
    if (valid.length) bits.push(valid.length + " preset" + (valid.length === 1 ? "" : "s"));
    if (hasSettings) bits.push("settings"); if (hasRanges) bits.push("ranges"); if (hasBeat) bits.push("beat tuning");
    el("rst-sub").textContent = (fileName || "backup") + " — " + (bits.join(", ") || "nothing usable");
    el("rst-presets-n").textContent = "(" + valid.length + ")";
    // Enable only the parts the selection actually contains; check the available ones.
    const opt = (wrapId, cbId, avail) => {
      const cb = el(cbId); cb.checked = avail; cb.disabled = !avail;
      el(wrapId).classList.toggle("disabled", !avail);
    };
    // Selecting only _settings.json is legitimate, so Presets is no longer always on.
    opt("rst-opt-presets", "rst-presets", valid.length > 0);
    opt("rst-opt-settings", "rst-settings", hasSettings);
    opt("rst-opt-ranges", "rst-ranges", hasRanges);
    opt("rst-opt-beat", "rst-beat", hasBeat);
    el("rst-merge").checked = true;
    el("rst-mode").classList.toggle("disabled", !valid.length);
    el("restoredlg").classList.remove("hidden");
  }
  function closeRestore() { el("restoredlg").classList.add("hidden"); pendingRestore = null; }
  function applyRestore() {
    const p = pendingRestore; if (!p) return;
    autosavePreset();                          // fold pending live edits before snapshotting
    const out = fullSnapshot();                // current everything is the base; override chosen parts
    if (el("rst-presets").checked) {
      let lib;
      if (el("rst-replace").checked) {
        lib = p.valid.slice();                 // Replace: only the backup's presets
      } else {                                 // Merge: overwrite same-named, keep the rest, append new
        lib = out.presets.slice();
        for (const q of p.valid) { const at = lib.findIndex(x => x.name === q.name); if (at >= 0) lib[at] = q; else lib.push(q); }
      }
      out.presets = lib;
      const sel = (!Array.isArray(p.parsed) && p.parsed.curPreset >= 0 && p.parsed.presets && p.parsed.presets[p.parsed.curPreset])
        ? p.parsed.presets[p.parsed.curPreset].name : null;
      out.curPreset = sel ? lib.findIndex(x => x.name === sel) : -1;
      // A shared bundle records which preset the sender had open; land the receiver on it
      // (its scene, not just the dropdown) after the reload — a one-shot marker the startup
      // reads. Cleared on use, so ordinary reloads keep the persisted scene. Backups don't
      // carry curPreset, so this only fires for shared links.
      if (out.curPreset >= 0) sessionStorage.setItem("btw.applyPreset", String(out.curPreset));
      else sessionStorage.removeItem("btw.applyPreset");
    }
    if (p.hasSettings && el("rst-settings").checked) {
      const s = p.parsed;
      out.states = s.states; out.beats = s.beats; out.extras = s.extras;
      if (s.pulses) out.pulses = s.pulses;         // per-effect beat-pulse shapes (absent in pre-feature backups)
      if (s.plens) out.plens = s.plens;            // ...and their lengths
      if (s.cam) out.cam = s.cam;                  // the global camera
      if (Number.isInteger(s.effect)) out.effect = s.effect;
      if (typeof s.cycle === "boolean") out.cycle = s.cycle;
      if (Array.isArray(s.ttl)) out.ttl = s.ttl;   // global preset TTL
      if (s.scale) out.scale = s.scale;
      if (typeof s.panelOpen === "boolean") out.panelOpen = s.panelOpen;
      if (!el("rst-presets").checked) out.curPreset = -1;   // live values came from the file; don't claim a preset
    }
    if (p.hasRanges && el("rst-ranges").checked) out.ranges = p.parsed.ranges;
    if (p.hasBeat && el("rst-beat").checked) out.beatTune = p.parsed.beatTune;
    // Auto-cycle. A FILE restore forces it off, so the cycler doesn't move off what you just
    // restored (written into the blob rather than via stopCycling(), because applyRestore
    // reloads and a live toggle would be lost). A shared LINK, however, carries the sender's
    // auto-cycle toggle on purpose — "share the show" — so honour it: the receiver lands on
    // the selected preset (above) and then cycles the same way the sender's did.
    out.cycle = (!Array.isArray(p.parsed) && p.parsed.__link && typeof p.parsed.cycle === "boolean") ? p.parsed.cycle : false;
    // Write and reload, so the proven load path (restore → applyBlob → setEffect → resize) reapplies it all.
    localStorage.setItem(STORE_KEY, JSON.stringify(serializeBlob(out)));   // effect identity stored as stable ids
    location.reload();
  }
  el("rst-go").addEventListener("click", applyRestore);
  el("rst-cancel").addEventListener("click", closeRestore);
  el("restoredlg").addEventListener("click", e => { if (e.target === el("restoredlg")) closeRestore(); });   // backdrop
  // Merge/Replace only matters when Presets is being restored — dim it otherwise.
  el("rst-presets").addEventListener("change", () => el("rst-mode").classList.toggle("disabled", !el("rst-presets").checked));

  // ---- Share a curated bundle of presets as one link -------------------------
  // The dialog only CURATES which presets go in — it copies a link (libraryUrl →
  // serializeBlob({presets}) → deflate, in persist-share.js), never touching the local
  // library. The recipient's #zp=/#sp= decode lands in openSharedLibrary below, which routes
  // into the SAME Restore dialog a file import uses, so they pick merge vs replace.
  let sharePreBoxes = [];
  const chosenPresets = () => sharePreBoxes.filter(cb => cb.checked).map(cb => presets[+cb.dataset.i]);
  function syncSharePreHint() {
    const n = chosenPresets().length, anyOn = sharePreBoxes.some(cb => cb.checked);
    el("sharepre-hint").textContent = n
      ? n + " preset" + (n === 1 ? "" : "s") + " selected — a bundle link can get long, so use Copy short link if it won't paste."
      : "No presets selected.";
    el("sharepre-all").textContent = anyOn ? "Select none" : "Select all";
    el("sharepre-copy").disabled = el("sharepre-short").disabled = !n;
  }
  function openSharePresets() {
    autosavePreset();                 // fold live edits into the selected preset before bundling
    const list = el("sharepre-list"); list.textContent = "";
    sharePreBoxes = presets.map((p, i) => {
      const lab = document.createElement("label"); lab.className = "sharepre-opt";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true; cb.dataset.i = String(i);
      cb.addEventListener("change", syncSharePreHint);
      const span = document.createElement("span"); span.textContent = p.name; span.title = p.name;
      lab.appendChild(cb); lab.appendChild(span); list.appendChild(lab);
      return cb;
    });
    syncSharePreHint();
    el("sharepredlg").classList.remove("hidden");
  }
  const closeSharePresets = () => el("sharepredlg").classList.add("hidden");
  el("sharepresets").addEventListener("click", openSharePresets);
  el("sharepre-close").addEventListener("click", closeSharePresets);
  el("sharepredlg").addEventListener("click", e => { if (e.target === el("sharepredlg")) closeSharePresets(); });   // backdrop
  el("sharepre-all").addEventListener("click", () => {
    const anyOn = sharePreBoxes.some(cb => cb.checked);
    sharePreBoxes.forEach(cb => { cb.checked = !anyOn; });   // all/some on → none; none on → all
    syncSharePreHint();
  });
  el("sharepre-copy").addEventListener("click", () => {
    const chosen = chosenPresets(); if (!chosen.length) return;
    copyText(libraryUrl(chosen), el("sharepre-copy"), "Link copied!", "Copy link");   // copyText takes the Promise
    track("share_presets", { n: chosen.length });
  });
  el("sharepre-short").addEventListener("click", async () => {
    const chosen = chosenPresets(); if (!chosen.length) return;
    const btn = el("sharepre-short");
    btn.disabled = true; btn.textContent = "Shortening…";
    try {
      const short = await shortenUrl(await libraryUrl(chosen));
      btn.disabled = false;
      copyText(short, btn, "Short link copied!", "Copy short link");
      track("share_presets_short", { n: chosen.length });
    } catch (e) {
      btn.textContent = "Shorten failed";
      setTimeout(() => { btn.textContent = "Copy short link"; syncSharePreHint(); }, 1800);
    }
  });
  // Recipient side of a preset-bundle link (#zp=/#sp=), called (deferred) from applyShared:
  // decode → validate → the Restore dialog. `parsed` carries only presets (no states/ranges/
  // beatTune), so openRestore lights up just the Presets option with merge/replace.
  function openSharedLibrary(raw) {
    const norm = normalizeBackup(raw);
    if (!norm) return;
    const parts = deserializeBlob(norm);
    const arr = Array.isArray(parts) ? parts : ((parts && parts.presets) || []);
    const valid = validatePresetList(arr);
    if (!valid.length) { alert("This link has no usable presets."); return; }
    // Carry the sender's auto-cycle toggle + selected-preset index through to applyRestore;
    // __link marks this as a shared bundle (backups force cycle off, links honour it).
    openRestore({ presets: arr, curPreset: parts.curPreset, cycle: parts.cycle, __link: true }, valid, "shared link");
  }

  // Initial paint: setEffect loads the restored effect's per-effect extras (show-box,
  // random-seed), then applyLayerExtras puts the selected layer's palette + filters live.
  setEffect(+effectSel.value, false);
  applyLayerExtras(stack[stackSel]);
  // ?stack=plasma,sirpinfyer[,…] builds a stack at startup, by effect id. A dev hook in
  // the spirit of ?debug=1 — it exists so the render path can be driven before the layer
  // list UI lands, and it stays useful for reproducing a stack from a bug report.
  // Never persisted: it seeds the live stack and nothing writes it back out.
  {
    const m = location.search.match(/[?&]stack=([^&]+)/);
    if (m) {
      const ids = decodeURIComponent(m[1]).split(",").map(s => s.trim()).filter(Boolean);
      for (let k = 1; k < ids.length && stack.length < STACK_MAX; k++) {
        const fx = effectIndexFromId(ids[k]);
        if (fx >= 0) addStackItem(fx);
      }
      const first = effectIndexFromId(ids[0]);
      if (first >= 0) { selectStack(0); setEffect(first); applyLayerExtras(stack[0]); }
    }
  }
  syncStackUI();                      // draw the layer rows for the restored stack
  let freshVisit = false;
  if (presets.length === 0) {         // first visit: seed the preset library
    presets = defaultPresets();       // one per effect...
    const ds = defaultScenePreset();
    if (ds) {                         // ...plus the shipped opening scene, selected + shown
      presets.unshift(ds);
      applyPreset(0);                 // installs the stack and sets curPreset = 0
      freshVisit = true;
    } else { curPreset = effect; }
  }
  rebuildPresetOptions();
  syncTtlEnabled();                   // match the Preset TTL enabled-state to the restored cycle toggle
  startCredits();                     // burn the credits into the opening frames
  persistReady = true;
  // Save the opening scene once, so a reload keeps it instead of re-applying (and
  // re-morphing the palette) on every visit until the first edit.
  if (freshVisit) persist();
  // A one-shot from applyRestore of a shared bundle: land on the preset the sender had open
  // (its scene, not just the dropdown selection). Cleared on use, so ordinary reloads keep
  // the persisted scene rather than re-applying + re-morphing every time.
  try {
    const pend = sessionStorage.getItem("btw.applyPreset");
    if (pend != null) { sessionStorage.removeItem("btw.applyPreset"); const i = +pend; if (presets[i]) applyPreset(i); }
  } catch (e) {}

  function setPanel(hidden) {
    panel.classList.toggle("hidden", hidden);
    persist();                          // remember panel open/closed across reloads
  }
  // The ☰ hamburger (and the "m" key) toggle the one menu — the dev tools now live
  // inside it as the Diagnostics section, so there's nothing else to collapse.
  toggle.addEventListener("click", () => setPanel(!panel.classList.contains("hidden")));
  // Fullscreen toggle (works on mobile too, where F11 doesn't exist; also the "f" key).
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  }
  el("fs").addEventListener("click", toggleFullscreen);
  const pausedEl = el("paused");
  function setPaused(p) { paused = p; pausedEl.classList.toggle("hidden", !paused); }
  canvas.addEventListener("click", () => setPaused(!paused));
  // Respect reduced-motion: render a frame or two, then freeze so motion is
  // opt-in (click the canvas to animate).
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      requestAnimationFrame(() => requestAnimationFrame(() => setPaused(true)));
  } catch (e) {}
