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
// and `const valid = arr` … `if (!valid.length)`.
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
const importSrc = cut("        const valid = arr", "        if (!valid.length)");

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

console.log("\n" + (fail ? fail + " FAILED, " : "") + "all " + pass + " passed");
process.exit(fail ? 1 : 0);
