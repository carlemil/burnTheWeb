// Headless probe for preset completeness.
// Usage: node tools/presetprobe.js index.html
//
// Why this exists: a preset is what you hand to someone else, so anything it fails to
// carry is a scene that silently renders differently on their machine. That failure is
// invisible locally — the recipient just gets *their* camera, *their* beat tuning — and
// it already happened once: applyRestore's mapping rebuilt every imported preset without
// `cam`, and camrx/camry/camrz live nowhere else, so every imported preset quietly
// inherited whatever camera the recipient was sitting at.
//
// Two kinds of check:
//   1. STRUCTURAL — every key applyPreset restores must be a key snapshotScene captures,
//      and the import mapping must carry them all too. Read off the real source, so
//      adding a field to one and forgetting the other two is caught by construction
//      rather than by someone noticing their camera is wrong.
//   2. BEHAVIOURAL — mergeBeatTune sliced out and run, pinning its replace semantics.
//
// It slices by source markers, so keep them: `const BEAT_DEFAULTS` … `const beatCfg`,
// `function mergeBeatTune(` … `function installBeatTune(`, `function snapshotScene()`
// … `function defaultPresets(`, `function applyPreset(` … `function createPreset(`,
// `const valid = arr` … `if (!valid.length`, and
// `effectSel.addEventListener("change"` … `paletteSel.addEventListener(`.
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
const s0 = html.indexOf("<script>"), s1 = html.indexOf("</script>", s0);
if (s0 < 0 || s1 < 0) throw new Error("probe: no inline <script> found");
const src = html.slice(s0 + 8, s1);

const cut = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a + 1);
  if (a < 0 || b < 0 || b < a) throw new Error("probe: could not slice " + from + " .. " + to);
  return src.slice(a, b);
};

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};

// --- 1. structural: snapshotScene vs applyPreset vs the import mapping --------
const snapSrc = cut("  function snapshotScene()", "  function defaultPresets(");
const applySrc = cut("  function applyPreset(", "  function createPreset(");
// Markers without leading indentation on purpose: this block sits inside the file-input
// handler, and its nesting depth has already changed once (single file → many).
const importSrc = cut("const valid = arr", "if (!valid.length");

// Keys of the object literal snapshotScene returns (one per line, `key:` or `key,`).
const snapKeys = new Set();
for (const line of snapSrc.slice(snapSrc.indexOf("return {")).split("\n")) {
  const m = line.match(/^\s{6}(\w+)\s*[:,]/);
  if (m) snapKeys.add(m[1]);
}
// Every `p.<key>` applyPreset reads off the stored preset.
const readKeys = new Set([...applySrc.matchAll(/\bp\.(\w+)/g)].map(m => m[1]));
// Keys the import mapping rebuilds each preset with.
const importKeys = new Set([...importSrc.matchAll(/(\w+):/g)].map(m => m[1]));

ok(snapKeys.size >= 9, "snapshotScene returns a populated object", [...snapKeys].join(","));
for (const k of ["effect", "state", "beat", "pulse", "plen", "cam", "beatTune", "ranges", "extra"])
  ok(snapKeys.has(k), "snapshotScene captures `" + k + "`");

{
  const missing = [...readKeys].filter(k => !snapKeys.has(k));
  ok(!missing.length,
     "every field applyPreset restores is one snapshotScene captures",
     missing.length ? "applyPreset reads p." + missing.join(", p.") + " — never saved" : [...readKeys].join(","));
}
{
  // `name` is added by the caller, not by snapshotScene.
  const missing = [...snapKeys].filter(k => !importKeys.has(k));
  ok(!missing.length,
     "the import mapping carries every field a preset stores",
     missing.length ? "dropped on import: " + missing.join(", ") : [...importKeys].join(","));
  ok(importKeys.has("name"), "...and names the imported preset");
}
// The regression that motivated the probe, pinned by name so it reads as intent.
ok(importKeys.has("cam"), "import keeps `cam` (camrx/camry/camrz exist nowhere else)");
ok(importKeys.has("beatTune"), "import keeps `beatTune`");

// --- 2. behavioural: mergeBeatTune replace semantics --------------------------
const code =
  "  const " + cut("const BEAT_DEFAULTS", "const beatCfg").slice("const ".length) + ";\n" +
  cut("  function mergeBeatTune(", "  // Write a validated tuning") +
  "\nreturn { mergeBeatTune, BEAT_DEFAULTS };";
const P = new Function(code)();
const D = P.BEAT_DEFAULTS;

{
  const d = P.mergeBeatTune(null);
  ok(JSON.stringify(d.fluxK) === JSON.stringify(D.fluxK) &&
     d.floor === D.floor &&
     JSON.stringify(d.refract) === JSON.stringify(D.refract) &&
     JSON.stringify(d.bands) === JSON.stringify(D.bands),
     "mergeBeatTune(null) is exactly the shipped defaults");
  ok(P.mergeBeatTune(undefined).floor === D.floor, "...and so is mergeBeatTune(undefined)");
  ok(P.mergeBeatTune({}).floor === D.floor, "...and an empty object (a pre-feature preset)");

  // THE assertion: a partial tuning must not inherit the previously applied one. This is
  // what merging into the live beatCfg would get wrong — preset A's sensitivity would
  // leak into preset B, and a preset saved before the feature would inherit everything.
  const a = P.mergeBeatTune({ fluxK: [5, 5, 5], floor: 0.9, refract: [400, 400, 400] });
  const b = P.mergeBeatTune({ floor: 0.2 });
  ok(a.fluxK[0] === 5 && a.floor === 0.9, "a full tuning round-trips", JSON.stringify(a.fluxK));
  ok(b.floor === 0.2, "a partial tuning keeps the field it supplies");
  ok(JSON.stringify(b.fluxK) === JSON.stringify(D.fluxK) &&
     JSON.stringify(b.refract) === JSON.stringify(D.refract),
     "...and DEFAULTS the rest rather than inheriting the previous preset",
     "fluxK " + JSON.stringify(b.fluxK) + " refract " + JSON.stringify(b.refract));

  // Returned arrays must be copies, or two presets would share one tuning.
  const c1 = P.mergeBeatTune(null), c2 = P.mergeBeatTune(null);
  c1.fluxK[0] = 99; c1.bands[0][0] = 99;
  ok(c2.fluxK[0] !== 99 && c2.bands[0][0] !== 99 && D.fluxK[0] !== 99 && D.bands[0][0] !== 99,
     "results are deep copies — neither shared with each other nor with BEAT_DEFAULTS");
}
{
  // Junk must fall back rather than throw or land in the detector.
  ok(P.mergeBeatTune({ fluxK: "nope", floor: "x", refract: null, bands: 7 }).floor === D.floor,
     "wrong-typed fields are ignored");
  ok(P.mergeBeatTune({ floor: 5 }).floor === D.floor, "an out-of-range floor is rejected");
  ok(P.mergeBeatTune({ fluxK: [-1, 0, NaN] }).fluxK[0] === D.fluxK[0], "a non-positive fluxK is rejected");
  ok(P.mergeBeatTune({ bands: [[100, 50]] }).bands[0][0] === D.bands[0][0], "an inverted band is rejected");
  ok(P.mergeBeatTune({ bands: [[1, 99000]] }).bands[0][1] === D.bands[0][1], "a band above Nyquist is rejected");
  let threw = false;
  try { P.mergeBeatTune({ bands: [] }); P.mergeBeatTune({ bands: [null, 3] }); } catch (e) { threw = true; }
  ok(!threw, "a short/sparse bands array doesn't throw (reachable from a hand-edited backup)");
}

// --- 3. switching effect stays on the selected preset and folds the change in ----
// This has been all three ways round: deselect, auto-select a preset for the new effect,
// and now stay put. A preset is "my scene" and its effect is just another field of it, so
// the switch is an edit like any other. The knock-on is intended: a preset keeps its name
// when you change its effect. Asserted structurally because the previous two behaviours
// both looked reasonable in isolation and someone will be tempted to "fix" this again.
{
  const src2 = cut('effectSel.addEventListener("change"', "paletteSel.addEventListener(");
  ok(!/curPreset\s*=\s*-1/.test(src2), "the effect chooser no longer deselects the preset");
  ok(/autosavePreset\(\)/.test(src2), "...it folds the new effect into the selected preset");
  ok(/setEffect\(/.test(src2), "...and still switches the effect");
}

// --- 4. saved scenes survive a registry reorder -------------------------------
// The per-effect maps used to be stored keyed by registry position, so reordering or
// removing an effect silently handed every saved scene to whichever effect now sat at
// that index — in localStorage, Backups and share links. Nothing surfaces it until
// someone reorders EFFECTS, at which point everyone's saved settings are already wrong.
// Serialize under one registry, deserialize under a shuffled one, and check the values
// followed their effect rather than their slot.
{
  const mk = ids => ids.map(id => ({ id }));
  const build = ids => new Function("EFFECTS",
    cut("  const LEGACY_EFFECT_IDS", "  // Per-effect slider presets") +
    "\nreturn { serializeBlob, deserializeBlob };")(mk(ids));

  const A = ["sirpinfyer", "tetrafyer", "animejulia", "plasma", "tunnel"];
  const wrote = build(A).serializeBlob({
    effect: 4,                                   // tunnel
    states: { 0: { points: 111 }, 3: { pspeed: 333 }, 4: { tunspeed: 444 } },
    extras: { 3: { palette: "3" }, 4: { palette: "9" } },
  });
  ok(typeof wrote.states.tunnel === "object" && wrote.states.plasma.pspeed === 333,
     "stored scenes are keyed by stable id, not by position", Object.keys(wrote.states).join(","));

  // Same data read back by a build where the registry has been shuffled and one effect
  // removed. Nothing else about the blob changes.
  const B = ["plasma", "tunnel", "sirpinfyer", "animejulia"];   // tetrafyer retired
  const read = build(B).deserializeBlob(JSON.parse(JSON.stringify(wrote)));
  ok(read.effect === 1, "`effect` still resolves to tunnel's new index", String(read.effect));
  ok(read.states[0] && read.states[0].pspeed === 333, "plasma's scene followed plasma to index 0",
     JSON.stringify(read.states[0]));
  ok(read.states[1] && read.states[1].tunspeed === 444, "tunnel's scene followed tunnel to index 1",
     JSON.stringify(read.states[1]));
  ok(read.states[2] && read.states[2].points === 111, "sirpinfyer's scene followed it to index 2",
     JSON.stringify(read.states[2]));
  ok(read.extras[0].palette === "3" && read.extras[1].palette === "9",
     "extras follow their effect too, not just states");
  ok(Object.keys(read.states).length === 3, "the retired effect's scene is dropped, not misfiled",
     Object.keys(read.states).join(","));

  // Blobs written before this change carry numeric keys; the registry has only ever been
  // appended to, so those positions are still correct and must load unchanged.
  const legacy = build(A).deserializeBlob({ effect: "plasma", states: { 0: { points: 7 }, 3: { pspeed: 8 } } });
  ok(legacy.states[0].points === 7 && legacy.states[3].pspeed === 8,
     "a pre-id blob's numeric keys still load", JSON.stringify(Object.keys(legacy.states)));
}

// --- 5. backup file naming + shape normalization ------------------------------
const B = new Function(
  cut("  const WIN_RESERVED", "  function stampNow(") +
  cut("  function normalizeBackup(", "  el(\"importpresets\")") +
  "\nreturn { safeFileName, normalizeBackup };")();

{
  const f = B.safeFileName;
  ok(f("Fire Thing") === "Fire Thing", "an ordinary name is left alone", f("Fire Thing"));
  // A preset name is free text and becomes a filename; these are the ways that bites.
  ok(!/[\/\\:*?"<>|]/.test(f('a/b\\c:d*e?f"g<h>i|j')), "path separators and illegal chars are stripped",
     f('a/b\\c:d*e?f"g<h>i|j'));
  ok(f("  padded  ") === "padded", "surrounding whitespace is trimmed", "'" + f("  padded  ") + "'");
  ok(!/[. ]$/.test(f("trailing dot.")), "no trailing dot (Windows drops them silently)", f("trailing dot."));
  ok(f("") === "Preset" && f(null) === "Preset" && f(undefined) === "Preset",
     "an empty/missing name falls back rather than producing '.json'");
  ok(f("CON") === "_CON" && f("nul") === "_nul" && f("COM1") === "_COM1",
     "Windows reserved device names are escaped", f("CON") + "," + f("nul"));
  ok(f("ok.name") === "ok.name", "an interior dot is fine");
  ok(f("x".repeat(300)).length <= 80, "absurdly long names are truncated", f("x".repeat(300)).length);
  ok(f("a bc") === "abc", "control characters are removed", JSON.stringify(f("a bc")));
}
{
  const n = B.normalizeBackup;
  // Every shape Backup has ever written has to keep restoring.
  ok(JSON.stringify(n([{ name: "x" }])) === '{"presets":[{"name":"x"}]}',
     "oldest bare array becomes { presets }");
  ok(n({ kind: "preset", preset: { name: "p" } }).presets.length === 1,
     "a single-preset file becomes a one-entry preset list");
  ok(n({ kind: "settings", settings: { states: {} } }).states !== undefined,
     "a settings file unwraps to the settings object");
  ok(n({ presets: [], ranges: {} }).ranges !== undefined, "a legacy { presets, ranges } passes through");
  ok(n({ states: {}, presets: [] }).states !== undefined, "a whole-library snapshot passes through");
  ok(n(null) === null && n(7) === null && n("x") === null, "junk is rejected, not guessed at");
  ok(n({ kind: "preset" }).kind === "preset",
     "a preset file with no payload falls through rather than throwing");
}

console.log("\n" + (fail ? fail + " FAILED, " : "") + "all " + pass + " passed");
process.exit(fail ? 1 : 0);
